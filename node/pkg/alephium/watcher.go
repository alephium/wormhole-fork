package alephium

import (
	"context"
	"encoding/hex"
	"fmt"
	"sort"
	"sync/atomic"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/readiness"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"github.com/dgraph-io/badger/v3"
	"go.uber.org/zap"
)

const MaxForkHeight = uint32(100)

type Watcher struct {
	url    string
	apiKey string

	governanceContract          string
	tokenBridgeContract         string
	tokenWrapperFactoryContract string
	chainIndex                  *ChainIndex
	initHeight                  uint32

	readiness readiness.Component

	msgChan  chan *common.MessagePublication
	setChan  chan *common.GuardianSet
	obsvReqC chan *gossipv1.ObservationRequest

	minConfirmations uint64
	currentHeight    uint32

	db *db
}

type message struct {
	event         *Event
	confirmations uint8
}

type PendingMessages struct {
	blockHeader *BlockHeader
	messages    []*message
}

type ConfirmedMessages struct {
	blockHeader *BlockHeader
	messages    []*message
	finished    bool
	reObserved  bool
}

func messageFromEvent(
	event *Event,
	governanceContract string,
	minConfirmations uint8,
) (*message, error) {
	if event.ContractAddress != governanceContract {
		return &message{
			event:         event,
			confirmations: minConfirmations,
		}, nil
	}

	consistencyLevel, err := event.Fields[len(event.Fields)-1].ToUint64()
	if err != nil {
		return nil, err
	}

	confirmations := uint8(consistencyLevel)
	if confirmations < minConfirmations {
		confirmations = minConfirmations
	}
	return &message{
		event:         event,
		confirmations: confirmations,
	}, nil
}

func NewAlephiumWatcher(
	url string,
	apiKey string,
	fromGroup uint8,
	toGroup uint8,
	contracts []string,
	initHeight uint32,
	readiness readiness.Component,
	messageEvents chan *common.MessagePublication,
	setEvents chan *common.GuardianSet,
	minConfirmations uint64,
	obsvReqC chan *gossipv1.ObservationRequest,
	dbPath string,
) (*Watcher, error) {
	if len(contracts) != 3 {
		return nil, fmt.Errorf("invalid contract ids")
	}
	db, err := open(dbPath)
	if err != nil {
		return nil, err
	}

	return &Watcher{
		url:                         url,
		apiKey:                      apiKey,
		governanceContract:          contracts[0],
		tokenBridgeContract:         contracts[1],
		tokenWrapperFactoryContract: contracts[2],

		initHeight: initHeight,
		chainIndex: &ChainIndex{
			FromGroup: fromGroup,
			ToGroup:   toGroup,
		},

		readiness:        readiness,
		msgChan:          messageEvents,
		setChan:          setEvents,
		obsvReqC:         obsvReqC,
		minConfirmations: minConfirmations,
		db:               db,
	}, nil
}

func (w *Watcher) ContractServer(logger *zap.Logger, listenAddr string) (supervisor.Runnable, error) {
	return contractServiceRunnable(w.db, listenAddr, logger)
}

func (w *Watcher) Run(ctx context.Context) error {
	p2p.DefaultRegistry.SetNetworkStats(vaa.ChainIDAlephium, &gossipv1.Heartbeat_Network{
		ContractAddress: w.governanceContract,
	})

	client := NewClient(w.url, w.apiKey, 10)
	logger := supervisor.Logger(ctx)
	nodeInfo, err := client.GetNode(ctx)
	if err != nil {
		logger.Error("get node info error", zap.Error(err))
		return err
	}
	logger.Info("alephium watcher started", zap.String("url", w.url), zap.String("version", nodeInfo.Version))

	fromHeight, err := w.fetchContractAddresses(ctx, logger, client)
	if err != nil {
		logger.Error("failed to fetch contract addresses", zap.Error(err))
		return err
	}
	logger.Info("fetch contract addresses completed")

	contracts := []string{w.governanceContract, w.tokenBridgeContract, w.tokenWrapperFactoryContract}
	confirmedC := make(chan *ConfirmedMessages, 8)
	errC := make(chan error)
	validator := newValidator(client, w.chainIndex.FromGroup, contracts, w.msgChan, w.db)

	go validator.run(ctx, *fromHeight, errC, confirmedC)
	go w.getEvents(ctx, client, *fromHeight, errC, confirmedC)
	go w.handleObsvRequest(ctx, client, confirmedC)

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errC:
		return err
	}
}

func (w *Watcher) fetchContractAddresses(ctx context.Context, logger *zap.Logger, client *Client) (*uint32, error) {
	latestHeight, err := w.db.getLatestHeight()
	if err == badger.ErrKeyNotFound {
		return &w.initHeight, nil
	}
	if err != nil {
		logger.Error("failed to get latest height from db", zap.Error(err))
		return nil, err
	}
	currentHeight, err := client.GetCurrentHeight(ctx, w.chainIndex)
	if err != nil {
		logger.Error("failed to get current height", zap.Error(err))
		return nil, err
	}
	if latestHeight+MaxForkHeight >= currentHeight {
		return &latestHeight, nil
	}

	toHeight := currentHeight - MaxForkHeight
	batch := newBatch()
	contracts := []string{w.tokenBridgeContract, w.tokenWrapperFactoryContract}
	for h := latestHeight + 1; h < toHeight; h++ {
		events, err := client.GetContractEventsFromBlockHeight(ctx, w.chainIndex, h, contracts)
		if err != nil {
			logger.Error("failed to get contract events", zap.Uint32("height", h), zap.Error(err))
			return nil, err
		}
		for _, event := range events {
			switch event.ContractAddress {
			case w.tokenBridgeContract:
				chainId, address, err := client.GetTokenBridgeForChainInfo(ctx, event, w.chainIndex.FromGroup)
				if err != nil {
					logger.Error("failed to get token bridge for chain info", zap.Error(err))
					return nil, err
				}
				batch.writeChain(*chainId, *address)
			case w.tokenWrapperFactoryContract:
				tokenId, address, err := client.GetTokenWrapperInfo(ctx, event, w.chainIndex.FromGroup)
				if err != nil {
					logger.Error("failed to get token wrapper info", zap.Error(err))
					return nil, err
				}
				batch.writeTokenWrapper(*tokenId, *address)
			}
		}
	}
	batch.updateHeight(toHeight - 1)
	if err := w.db.writeBatch(batch); err != nil {
		logger.Error("write to db failed", zap.Error(err))
		return nil, err
	}
	return &toHeight, nil
}

func (w *Watcher) handleObsvRequest(ctx context.Context, client *Client, confirmedC chan<- *ConfirmedMessages) {
	logger := supervisor.Logger(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case req := <-w.obsvReqC:
			assume(req.ChainId == uint32(vaa.ChainIDAlephium))
			txId := hex.EncodeToString(req.TxHash)
			txStatus, err := client.GetTransactionStatus(ctx, txId)
			if err != nil {
				logger.Error("failed to get transaction status", zap.String("txId", txId), zap.Error(err))
				continue
			}

			blockHash := txStatus.BlockHash
			isCanonical, err := client.IsBlockInMainChain(ctx, blockHash)
			if err != nil {
				logger.Error("failed to check mainchain block", zap.String("blockHash", blockHash), zap.Error(err))
				continue
			}
			if !isCanonical {
				logger.Info("ignore orphan block", zap.String("blockHash", blockHash))
				continue
			}

			currentHeight := atomic.LoadUint32(&w.currentHeight)

			filter := func(events []*Event) []*Event {
				results := make([]*Event, 0)
				for _, event := range events {
					if event.TxId == txId {
						results = append(results, event)
					}
				}
				return results
			}
			pendingMsg, err := w.getPendingMessageFromBlockHash(ctx, client, blockHash, []string{w.governanceContract}, filter)
			if err != nil {
				logger.Info("failed to get events from block", zap.String("blockHash", blockHash), zap.Error(err))
				continue
			}

			confirmedMsgs := make([]*message, 0)
			for _, msg := range pendingMsg.messages {
				if pendingMsg.blockHeader.Height+uint32(msg.confirmations) <= currentHeight {
					logger.Info("re-boserve event",
						zap.String("txId", txId),
						zap.String("blockHash", blockHash),
						zap.Uint32("blockHeight", pendingMsg.blockHeader.Height),
						zap.Uint32("currentHeight", currentHeight),
						zap.Uint8("confirmations", msg.confirmations),
					)
					confirmedMsgs = append(confirmedMsgs, msg)
				} else {
					logger.Info("ignore unconfirmed re-observed event",
						zap.String("txId", txId),
						zap.String("blockHash", blockHash),
						zap.Uint32("blockHeight", pendingMsg.blockHeader.Height),
						zap.Uint32("currentHeight", currentHeight),
						zap.Uint8("confirmations", msg.confirmations),
					)
				}
			}
			if len(confirmedMsgs) > 0 {
				confirmed := &ConfirmedMessages{
					blockHeader: pendingMsg.blockHeader,
					messages:    confirmedMsgs,
					finished:    true,
					reObserved:  true,
				}
				confirmedC <- confirmed
			}
		}
	}
}

func (w *Watcher) getPendingMessageFromBlockHash(
	ctx context.Context,
	client *Client,
	blockHash string,
	contracts []string,
	filter func([]*Event) []*Event,
) (*PendingMessages, error) {
	events, err := client.GetContractEventsFromBlockHash(ctx, blockHash, contracts)
	if err != nil {
		return nil, err
	}

	if filter != nil {
		events = filter(events)
	}
	header, err := client.GetBlockHeader(ctx, blockHash)
	if err != nil {
		return nil, err
	}

	messages := make([]*message, len(events))
	for i, event := range events {
		msg, err := messageFromEvent(event, w.governanceContract, uint8(w.minConfirmations))
		if err != nil {
			return nil, err
		}
		messages[i] = msg
	}
	return &PendingMessages{
		messages:    messages,
		blockHeader: header,
	}, nil
}

func (w *Watcher) getMessagesFromBlock(ctx context.Context, client *Client, height uint32, contracts []string) (*PendingMessages, error) {
	hashes, err := client.GetHashes(ctx, w.chainIndex, height)
	if err != nil {
		return nil, err
	}
	if len(hashes) == 0 {
		return nil, fmt.Errorf("empty hashes for block %d", height)
	}
	return w.getPendingMessageFromBlockHash(ctx, client, hashes[0], contracts, nil)
}

func sortedHeights(m map[uint32]*PendingMessages) []uint32 {
	heights := make([]uint32, len(m))
	index := 0
	for height := range m {
		heights[index] = height
		index++
	}
	sort.Slice(heights, func(i, j int) bool {
		return heights[i] < heights[j]
	})
	return heights
}

func (w *Watcher) getEvents(ctx context.Context, client *Client, fromHeight uint32, errC chan<- error, confirmedC chan<- *ConfirmedMessages) {
	logger := supervisor.Logger(ctx)
	currentHeight := fromHeight
	pendings := map[uint32]*PendingMessages{}
	contracts := []string{w.governanceContract, w.tokenBridgeContract, w.tokenWrapperFactoryContract}

	checkConfirmations := func(currentHeight uint32) error {
		// TODO: improve this
		heights := sortedHeights(pendings)
		for _, height := range heights {
			pending := pendings[height]
			if len(pending.messages) == 0 {
				confirmedC <- &ConfirmedMessages{
					blockHeader: pending.blockHeader,
					messages:    pending.messages,
					reObserved:  false,
					finished:    true,
				}
				continue
			}

			if height+uint32(w.minConfirmations) > currentHeight {
				continue
			}

			blockHash := pending.messages[0].event.BlockHash
			isCanonical, err := client.IsBlockInMainChain(ctx, blockHash)
			if err != nil {
				logger.Error("failed to check canonical block", zap.Error(err))
				errC <- err
				return err
			}

			// forked, we need to re-request events for the height
			if !isCanonical {
				msgs, err := w.getMessagesFromBlock(ctx, client, height, contracts)
				if err != nil {
					logger.Error("handle fork: failed to get events", zap.Uint32("height", height))
					errC <- err
					return err
				}
				pending = msgs
			}

			unconfirmedMessages := make([]*message, 0)
			confirmedMessages := make([]*message, 0)
			for _, message := range pending.messages {
				if height+uint32(message.confirmations) > currentHeight {
					unconfirmedMessages = append(unconfirmedMessages, message)
					continue
				}
				confirmedMessages = append(confirmedMessages, message)
			}

			logger.Debug("event confirmations", zap.Int("unconfirmed", len(unconfirmedMessages)), zap.Int("confirmed", len(confirmedMessages)))
			confirmed := &ConfirmedMessages{
				blockHeader: pending.blockHeader,
				messages:    confirmedMessages,
				reObserved:  false,
			}
			confirmedC <- confirmed

			if len(unconfirmedMessages) == 0 {
				confirmed.finished = true
				delete(pendings, height)
			} else {
				confirmed.finished = false
				pendings[height] = &PendingMessages{
					messages:    unconfirmedMessages,
					blockHeader: pending.blockHeader,
				}
			}
		}
		return nil
	}

	readiness.SetReady(w.readiness)
	msgs, err := w.getMessagesFromBlock(ctx, client, fromHeight, contracts)
	if err != nil {
		logger.Error("failed to get events", zap.Error(err), zap.Uint32("height", fromHeight))
		errC <- err
		return
	}
	pendings[fromHeight] = msgs
	logger.Info("get event from height", zap.Uint32("fromHeight", fromHeight))

	t := time.NewTicker(20 * time.Second)
	defer t.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			height, err := client.GetCurrentHeight(ctx, w.chainIndex)
			if err != nil {
				logger.Error("failed to get current height", zap.Error(err))
				errC <- err
				return
			}

			logger.Info("current block height", zap.Uint32("height", height))
			atomic.StoreUint32(&w.currentHeight, height)

			if height <= currentHeight {
				currentHeight = height
				continue
			}

			for h := currentHeight + 1; h <= height; h++ {
				msgs, err := w.getMessagesFromBlock(ctx, client, h, contracts)
				if err != nil {
					logger.Error("failed to get events", zap.Error(err), zap.Uint32("height", h))
					errC <- err
					return
				}
				pendings[h] = msgs
			}

			currentHeight = height
			checkConfirmations(currentHeight)
		}
	}
}
