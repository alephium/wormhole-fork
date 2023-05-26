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

func NewWatcher(logger *zap.Logger, configs *common.BridgeConfig, db *mongo.Database) *Watcher {
	return &Watcher{
		logger:       logger,
		configs:      configs,
		blockTxsC:    make(chan []*BlockTransactions, 6),
		transactions: db.Collection("transactions"),
	}
}

func (w *Watcher) getLatestEventIndex(ctx context.Context, emitterChain vaa.ChainID) (*uint32, error) {
	filter := bson.D{{Key: "emitterChain", Value: emitterChain}}
	opts := options.FindOne().SetSort(bson.D{{Key: "eventIndex", Value: -1}, {Key: "emitterChain", Value: -1}})
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

func (w *Watcher) Run(
	alphNodeUrl string,
	alphApiKey string,
	alphExplorerBackendUrl string,
	alphPollInterval uint,
	ethRpcUrl string,
	bscRpcUrl string,
) func(context.Context) error {
	return func(ctx context.Context) error {
		alphEventIndex, err := w.getLatestEventIndex(ctx, vaa.ChainIDAlephium)
		if err != nil {
			w.logger.Error("failed to get latest event index", zap.Uint16("chainId", uint16(vaa.ChainIDAlephium)), zap.Error(err))
			return err
		}

		ethEventIndex, err := w.getLatestEventIndex(ctx, vaa.ChainIDEthereum)
		if err != nil {
			w.logger.Error("failed to get latest event index", zap.Uint16("chainId", uint16(vaa.ChainIDEthereum)), zap.Error(err))
			return err
		}

		bscEventIndex, err := w.getLatestEventIndex(ctx, vaa.ChainIDBSC)
		if err != nil {
			w.logger.Error("failed to get latest event index", zap.Uint16("chainId", uint16(vaa.ChainIDBSC)), zap.Error(err))
			return err
		}

		alphWatcher := NewAlephiumWatcher(
			w.configs.Alephium,
			alphNodeUrl,
			alphApiKey,
			w.logger,
			w.blockTxsC,
			alphExplorerBackendUrl,
			*alphEventIndex,
			alphPollInterval,
		)

		ethWatcher, err := NewEVMWatcher(
			w.logger,
			ctx,
			ethRpcUrl,
			vaa.ChainIDEthereum,
			w.configs.Ethereum,
			*ethEventIndex,
			w.blockTxsC,
		)
		if err != nil {
			w.logger.Error("failed to create eth watcher", zap.Error(err))
			return err
		}

		bscWatcher, err := NewEVMWatcher(
			w.logger,
			ctx,
			bscRpcUrl,
			vaa.ChainIDBSC,
			w.configs.Bsc,
			*bscEventIndex,
			w.blockTxsC,
		)
		if err != nil {
			w.logger.Error("failed to create bsc watcher", zap.Error(err))
			return err
		}

		errC := make(chan error)

		alphWatcher.Run(ctx, errC)
		ethWatcher.Run(ctx, errC)
		bscWatcher.Run(ctx, errC)
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
		return 0 // TODO: the block height of the contract deployment tx
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
		return 0 // TODO: the block height of the contract deployment tx
	default:
		panic("invalid network id")
	}
}
