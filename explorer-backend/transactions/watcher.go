package transactions

import (
	"context"

	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"
)

type Watcher struct {
	configs      *common.BridgeConfig
	blockTxsC    chan []*BlockTransactions
	transactions *mongo.Collection
	logger       *zap.Logger
}

func NewWatcher(logger *zap.Logger, configs *common.BridgeConfig, db *mongo.Database, blockTxsC chan []*BlockTransactions) *Watcher {
	return &Watcher{
		logger:       logger,
		configs:      configs,
		blockTxsC:    blockTxsC,
		transactions: db.Collection("transactions"),
	}
}

func (w *Watcher) GetLatestEventIndexAlephium(ctx context.Context) (*uint32, error) {
	return w.GetLatestEventIndex(ctx, vaa.ChainIDAlephium)
}

func (w *Watcher) GetLatestEventIndexEth(ctx context.Context) (*uint32, error) {
	return w.GetLatestEventIndexEvm(ctx, vaa.ChainIDEthereum, 64)
}

func (w *Watcher) GetLatestEventIndexBsc(ctx context.Context) (*uint32, error) {
	return w.GetLatestEventIndexEvm(ctx, vaa.ChainIDBSC, 15)
}

func (w *Watcher) GetLatestEventIndexEvm(ctx context.Context, chainId vaa.ChainID, confirmations uint32) (*uint32, error) {
	eventIndex, err := w.GetLatestEventIndex(ctx, chainId)
	if err != nil {
		return nil, err
	}
	var fromIndex uint32
	if *eventIndex <= confirmations {
		fromIndex = 1
	} else {
		fromIndex = *eventIndex - confirmations
	}
	return &fromIndex, nil
}

func (w *Watcher) GetLatestEventIndex(ctx context.Context, emitterChain vaa.ChainID) (*uint32, error) {
	filter := bson.D{{Key: "emitterChain", Value: emitterChain}}
	opts := options.FindOne().SetSort(bson.D{{Key: "eventIndex", Value: -1}})
	var result TransactionUpdate
	err := w.transactions.FindOne(ctx, filter, opts).Decode(&result)
	if err == mongo.ErrNoDocuments {
		eventIndex := getDefaultEventIndex(emitterChain, w.configs.Network)
		return &eventIndex, nil
	}
	if err != nil {
		return nil, err
	}
	// returns `result.EventIndex` instead of `result.EventIndex + 1` is to avoid possible errors in the last bulk write
	return &result.EventIndex, nil
}

func (w *Watcher) Run() func(context.Context) error {
	return func(ctx context.Context) error {
		errC := make(chan error)
		go w.handleTxs(ctx, errC)

		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-errC:
			return err
		}
	}
}

func (w *Watcher) handleTxs(ctx context.Context, errC chan error) {
	for {
		select {
		case <-ctx.Done():
			return

		case blockTxsList := <-w.blockTxsC:
			for _, blockTxs := range blockTxsList {
				w.logger.Info(
					"received new txs",
					zap.String("chainId", blockTxs.chainId.String()),
					zap.Uint32("blockHeight", blockTxs.blockNumber),
					zap.String("blockHash", blockTxs.blockHash),
					zap.Int("txsNumber", len(blockTxs.txs)),
				)
				models := make([]mongo.WriteModel, len(blockTxs.txs))
				for i, tx := range blockTxs.txs {
					doc := tx.toDoc(blockTxs.blockNumber, blockTxs.blockHash, blockTxs.blockTimestamp)
					update := bson.D{{Key: "$set", Value: doc}}
					filter := bson.D{{Key: "_id", Value: doc.ID}}
					models[i] = mongo.NewUpdateOneModel().SetUpdate(update).SetUpsert(true).SetFilter(filter)
				}
				opts := options.BulkWrite().SetOrdered(true)
				if _, err := w.transactions.BulkWrite(ctx, models, opts); err != nil {
					w.logger.Error("failed to insert transactions", zap.Error(err))
					errC <- err
					return
				}
			}
		}
	}
}

func getDefaultEventIndex(emitterChain vaa.ChainID, networkId common.NetworkId) uint32 {
	switch emitterChain {
	case vaa.ChainIDAlephium:
		return getAlephiumDefaultEventIndex()
	case vaa.ChainIDEthereum:
		return getEthereumDefaultEventIndex(networkId)
	case vaa.ChainIDBSC:
		return getBSCDefaultEventIndex(networkId)
	default:
		panic("invalid emitter chain")
	}
}

func getAlephiumDefaultEventIndex() uint32 {
	return 0
}

func getEthereumDefaultEventIndex(networkId common.NetworkId) uint32 {
	switch networkId {
	case common.DEVNET:
		return 0
	case common.TESTNET:
		return 8934485 // the block height of the contract deployment tx
	case common.MAINNET:
		panic("eth event index not specified") // TODO: the block height of the contract deployment tx
	default:
		panic("invalid network id")
	}
}

func getBSCDefaultEventIndex(networkId common.NetworkId) uint32 {
	switch networkId {
	case common.DEVNET:
		return 0
	case common.TESTNET:
		return 30048254 // the block height of the contract deployment tx
	case common.MAINNET:
		panic("bsc event index not specified") // TODO: the block height of the contract deployment tx
	default:
		panic("invalid network id")
	}
}
