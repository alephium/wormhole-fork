package transactions

import (
	"context"
	"math/big"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/alephium"
	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/ethereum"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	eth "github.com/ethereum/go-ethereum"
	ethCommon "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"go.uber.org/zap"
)

type EVMWatcher struct {
	chainId         vaa.ChainID
	chainConfig     *common.ChainConfig
	connector       *ethereum.EthereumConnector
	contractAddress *ethCommon.Address
	fromHeight      uint32
	blockTxsC       chan<- []*BlockTransactions
	logger          *zap.Logger
}

func NewEVMWatcher(
	logger *zap.Logger,
	ctx context.Context,
	rpcUrl string,
	chainId vaa.ChainID,
	chainConfig *common.ChainConfig,
	fromHeight uint32,
	blockTxsC chan<- []*BlockTransactions,
) (*EVMWatcher, error) {
	contractAddress := ethCommon.HexToAddress(chainConfig.Contracts.Governance)
	namedLogger := logger.Named(chainId.String())
	connector, err := ethereum.NewEthereumConnector(ctx, chainId.String(), rpcUrl, contractAddress, namedLogger)
	if err != nil {
		return nil, err
	}
	return &EVMWatcher{
		chainId:         chainId,
		chainConfig:     chainConfig,
		contractAddress: &contractAddress,
		connector:       connector,
		fromHeight:      fromHeight,
		blockTxsC:       blockTxsC,
		logger:          namedLogger,
	}, nil
}

func (w *EVMWatcher) Run(ctx context.Context, errC chan error) {
	go w.fetchEvents(ctx, errC)
}

func (w *EVMWatcher) fetchEvents(ctx context.Context, errC chan<- error) {
	w.logger.Info("evm watcher started", zap.Uint32("fromHeight", w.fromHeight))

	blockC := make(chan *ethereum.NewBlock, 64)
	subscription, err := w.connector.SubscribeForBlocks(ctx, blockC)
	if err != nil {
		w.logger.Error("failed to subscribe blocks", zap.Error(err))
		errC <- err
		return
	}
	isFirstBlock := true

	for {
		select {
		case <-ctx.Done():
			return
		case err := <-subscription.Err():
			w.logger.Error("error while processing header subscription", zap.Error(err))
			errC <- err
			return
		case block := <-blockC:
			if isFirstBlock {
				isFirstBlock = false
				if err := w.fetchEventsFromBlockRange(ctx, w.fromHeight, uint32(block.Number.Uint64())); err != nil {
					w.logger.Error("failed to fetch events by block range", zap.Error(err))
					errC <- err
					return
				}
			}
			if err := w.fetchEventsByBlockHash(ctx, block.Hash); err != nil {
				w.logger.Error("failed to fetch events by block hash", zap.String("blockHash", block.Hash.Hex()), zap.Error(err))
				errC <- err
				return
			}
		}
	}
}

func (w *EVMWatcher) fetchEventsFromBlockRange(ctx context.Context, fromHeight uint32, toHeight uint32) error {
	if fromHeight >= toHeight {
		return nil
	}

	for height := fromHeight; height < toHeight; height++ {
		if err := w.fetchEventsByBlockNumber(ctx, height); err != nil {
			return err
		}
	}
	return nil
}

func (w *EVMWatcher) fetchEventsByBlockHash(ctx context.Context, blockHash ethCommon.Hash) error {
	client := w.connector.Client()
	header, err := client.HeaderByHash(ctx, blockHash)
	if err != nil {
		w.logger.Error("failed to get header by block hash", zap.String("blockHash", blockHash.Hex()), zap.Error(err))
		return err
	}
	return w.fetchEventsByHeader(ctx, header)
}

func (w *EVMWatcher) fetchEventsByBlockNumber(ctx context.Context, blockNumber uint32) error {
	client := w.connector.Client()
	header, err := client.HeaderByNumber(ctx, big.NewInt(int64(blockNumber)))
	if err != nil {
		w.logger.Error("failed to get header by number", zap.Uint32("blockNumber", blockNumber), zap.Error(err))
		return err
	}
	return w.fetchEventsByHeader(ctx, header)
}

func (w *EVMWatcher) fetchEventsByHeader(ctx context.Context, header *types.Header) error {
	client := w.connector.Client()
	blockHash := header.Hash()
	query := eth.FilterQuery{
		BlockHash: &blockHash,
		Addresses: []ethCommon.Address{*w.contractAddress},
		Topics:    [][]ethCommon.Hash{{ethereum.LogMessagePublishedTopic}},
	}
	logs, err := client.FilterLogs(ctx, query)
	if err != nil {
		w.logger.Error("failed to get logs", zap.String("blockHash", blockHash.Hex()), zap.Error(err))
		return err
	}
	txs := make([]*BridgeTransaction, 0)
	for _, log := range logs {
		message, err := w.connector.ParseLogMessagePublished(log)
		if err != nil {
			w.logger.Error("failed to parse message", zap.String("txId", log.TxHash.Hex()), zap.Error(err))
			return err
		}
		if !isTransferTokenPayload(message.Payload) {
			w.logger.Debug("ignore non-transfer token message", zap.String("txId", log.TxHash.Hex()))
			continue
		}
		vaaId := &vaa.VAAID{
			EmitterChain:   w.chainId,
			EmitterAddress: ethereum.PadAddress(message.Sender),
			TargetChain:    vaa.ChainID(message.TargetChainId),
			Sequence:       message.Sequence,
		}
		sender, err := getEVMTxSender(ctx, client, log.TxHash)
		if err != nil {
			w.logger.Error("failed to get tx sender", zap.String("txId", log.TxHash.Hex()), zap.Error(err))
			return err
		}
		w.logger.Info("new bridge transaction", zap.String("sender", *sender), zap.String("txId", log.TxHash.Hex()))
		txs = append(txs, &BridgeTransaction{
			vaaId:      vaaId,
			txId:       log.TxHash.Hex(),
			address:    *sender,
			eventIndex: uint32(log.BlockNumber),
		})
	}
	if len(txs) > 0 {
		blockTimestamp := time.Unix(int64(header.Time), 0).UTC()
		blockTxs := &BlockTransactions{
			blockNumber:    uint32(header.Number.Uint64()),
			blockHash:      blockHash.Hex(),
			blockTimestamp: &blockTimestamp,
			txs:            txs,
			chainId:        w.chainId,
		}
		w.blockTxsC <- []*BlockTransactions{blockTxs}
	}
	return nil
}

func getEVMTxSender(ctx context.Context, client *ethclient.Client, txId ethCommon.Hash) (*string, error) {
	tx, _, err := client.TransactionByHash(ctx, txId)
	if err != nil {
		return nil, err
	}
	signer := types.LatestSignerForChainID(tx.ChainId())
	sender, err := types.Sender(signer, tx)
	if err != nil {
		return nil, err
	}
	senderStr := sender.Hex()
	return &senderStr, nil
}

func isTransferTokenPayload(payload []byte) bool {
	return len(payload) > 0 && payload[0] == alephium.TransferTokenPayloadId
}
