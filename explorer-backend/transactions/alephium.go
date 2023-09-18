package transactions

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"

	sdk "github.com/alephium/go-sdk"
	"github.com/alephium/wormhole-fork/explorer-backend/utils"
	"github.com/alephium/wormhole-fork/node/pkg/alephium"
	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/btcsuite/btcutil/base58"
	"go.uber.org/zap"
)

const ALPHContractAddressPrefix byte = 3

type AlephiumWatcher struct {
	client             *alephium.Client
	chainConfig        *common.ChainConfig
	logger             *zap.Logger
	blockTxsC          chan<- []*BlockTransactions
	explorerBackendUrl string
	fromEventIndex     uint32
	pollInterval       uint
}

func NewAlephiumWatcher(
	config *common.ChainConfig,
	nodeUrl string,
	apiKey string,
	logger *zap.Logger,
	blockTxsC chan<- []*BlockTransactions,
	explorerBackendUrl string,
	fromEventIndex uint32,
	pollInterval uint,
) *AlephiumWatcher {
	client := alephium.NewClient(nodeUrl, apiKey, 10)
	return &AlephiumWatcher{
		client:             client,
		chainConfig:        config,
		logger:             logger,
		blockTxsC:          blockTxsC,
		explorerBackendUrl: explorerBackendUrl,
		fromEventIndex:     fromEventIndex,
		pollInterval:       pollInterval,
	}
}

func (w *AlephiumWatcher) Run() func(ctx context.Context) error {
	return func(ctx context.Context) error {
		nodeVersion, err := w.client.GetNodeVersion(ctx)
		if err != nil {
			w.logger.Error("failed to get node version", zap.Error(err))
			return err
		}

		isSynced, err := w.client.IsCliqueSynced(ctx)
		if err != nil {
			w.logger.Error("failed to get self cliqued synced", zap.Error(err))
			return err
		}
		if !*isSynced {
			return err
		}

		w.logger.Info("alephium watcher started", zap.String("version", nodeVersion.Version), zap.Uint32("fromEventIndex", w.fromEventIndex))

		eventsC := make(chan []*EventsPerIndex)
		errC := make(chan error)
		go w.fetchEvents(ctx, w.fromEventIndex, errC, eventsC)
		go w.handleEvents(ctx, errC, eventsC)

		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-errC:
			return err
		}
	}
}

func (w *AlephiumWatcher) fetchEvents(ctx context.Context, fromEventIndex uint32, errC chan<- error, eventsC chan<- []*EventsPerIndex) {
	contractAddress, err := alephium.ToContractAddress(w.chainConfig.Contracts.Governance)
	if err != nil {
		w.logger.Error("invalid governance contract id", zap.String("contractId", w.chainConfig.Contracts.Governance), zap.Error(err))
		errC <- err
		return
	}
	chainIndex := &alephium.ChainIndex{
		FromGroup: int32(w.chainConfig.GroupIndex),
		ToGroup:   int32(w.chainConfig.GroupIndex),
	}

	fromIndex := fromEventIndex
	ticker := time.NewTicker(time.Duration(w.pollInterval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			count, err := w.client.GetContractEventsCount(ctx, *contractAddress)
			if err != nil {
				w.logger.Error("failed to get current events count", zap.Error(err))
				errC <- err
				return
			}

			if uint32(*count) == fromIndex {
				continue
			}

			for {
				events, err := w.client.GetContractEvents(ctx, *contractAddress, int32(fromIndex), chainIndex.FromGroup)
				if err != nil {
					w.logger.Error("failed to get contract events", zap.Uint32("fromIndex", fromIndex), zap.Error(err))
					errC <- err
					return
				}

				allEvents := fromContractEvents(events, fromIndex)
				if len(allEvents) > 0 {
					eventsC <- allEvents
				}
				fromIndex = uint32(events.NextStart)
				if events.NextStart == *count {
					break
				}
			}
		}
	}
}

func (w *AlephiumWatcher) handleEvents(ctx context.Context, errC chan<- error, eventsC <-chan []*EventsPerIndex) {
	for {
		select {
		case <-ctx.Done():
			return
		case events := <-eventsC:
			allTxs := make(map[string][]*BridgeTransaction)
			for _, e := range events {
				for _, event := range e.events {
					w.logger.Debug("handle contract event", zap.String("txId", event.TxId), zap.String("blockHash", event.BlockHash))
					wormholeMessage, err := alephium.ToWormholeMessage(event.Fields, event.TxId)
					if err != nil {
						w.logger.Error("ignore invalid wormhole message", zap.String("txId", event.TxId), zap.Error(err))
						errC <- err
						return
					}
					if !wormholeMessage.IsTransferTokenVAA() {
						w.logger.Info("ignore non-transfer token wormhole message", zap.String("txId", event.TxId))
						continue
					}
					sender, err := getAlphTxSender(ctx, w.explorerBackendUrl, event.TxId)
					if err != nil {
						w.logger.Error("failed to get tx sender", zap.String("txId", event.TxId), zap.Error(err))
						errC <- err
						return
					}
					w.logger.Info("new bridge transaction from alephium", zap.String("sender", *sender), zap.String("txId", event.TxId))
					bridgeTx := &BridgeTransaction{
						vaaId:      wormholeMessage.GetID(),
						txId:       event.TxId,
						address:    *sender,
						eventIndex: e.eventIndex,
					}
					_, ok := allTxs[event.BlockHash]
					if ok {
						allTxs[event.BlockHash] = append(allTxs[event.BlockHash], bridgeTx)
					} else {
						allTxs[event.BlockHash] = []*BridgeTransaction{bridgeTx}
					}
				}
			}

			blockTxs := make([]*BlockTransactions, 0)
			for blockHash, txs := range allTxs {
				blockHeader, err := w.client.GetBlockHeader(ctx, blockHash)
				if err != nil {
					w.logger.Error("failed to get block header", zap.String("blockHash", blockHash), zap.Error(err))
					errC <- err
					return
				}
				blockTimestamp := time.Unix(blockHeader.Timestamp/1000, (blockHeader.Timestamp%1000)*int64(time.Millisecond)).UTC()
				blockTxs = append(blockTxs, &BlockTransactions{
					blockNumber:    uint32(blockHeader.Height),
					blockHash:      blockHash,
					blockTimestamp: &blockTimestamp,
					txs:            txs,
					chainId:        vaa.ChainIDAlephium,
				})
			}

			if len(blockTxs) > 0 {
				w.blockTxsC <- blockTxs
			}
		}
	}
}

type Input struct {
	Address string `json:"address"`
}

type AlephiumTxInfo struct {
	Inputs []Input `json:"inputs"`
}

func (t *AlephiumTxInfo) getUniqueInputAddress() (*string, error) {
	if len(t.Inputs) == 0 {
		return nil, fmt.Errorf("this transaction has no inputs")
	}
	address := ""
	for _, input := range t.Inputs[0:] {
		bytes := base58.Decode(input.Address)
		if len(bytes) == 0 || bytes[0] == ALPHContractAddressPrefix {
			continue
		}
		if address == "" {
			address = input.Address
			continue
		}
		if input.Address != address {
			return nil, fmt.Errorf("this transaction has multiple inputs with different addresses")
		}
	}
	return &address, nil
}

func getAlphTxSender(ctx context.Context, url string, txId string) (*string, error) {
	requestUrl := fmt.Sprintf("%s/transactions/%s", url, txId)
	req, err := http.NewRequest("GET", requestUrl, nil)
	if err != nil {
		return nil, err
	}
	res, err := utils.DefaultRateLimitClient.Do(ctx, req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}
	var txInfo AlephiumTxInfo
	err = json.Unmarshal(body, &txInfo)
	if err != nil {
		return nil, fmt.Errorf("invalid response, error: %v", err)
	}
	return txInfo.getUniqueInputAddress()
}

type EventsPerIndex struct {
	events     []*sdk.ContractEvent
	eventIndex uint32
}

func fromContractEvents(events *sdk.ContractEvents, fromIndex uint32) []*EventsPerIndex {
	result := make([]*EventsPerIndex, 0)
	eventIndex := fromIndex
	acc := make([]*sdk.ContractEvent, 0)
	for i := 0; i < len(events.Events); i++ {
		e := events.Events[i]
		if len(acc) == 0 || e.BlockHash == acc[0].BlockHash {
			acc = append(acc, &e)
		} else {
			result = append(result, &EventsPerIndex{
				events:     acc,
				eventIndex: eventIndex,
			})
			acc = make([]*sdk.ContractEvent, 0)
			acc = append(acc, &e)
			eventIndex += 1
		}
	}
	result = append(result, &EventsPerIndex{
		events:     acc,
		eventIndex: eventIndex,
	})
	return result
}
