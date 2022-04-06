package alephium

import (
	"context"

	"github.com/dgraph-io/badger/v3"
	"go.uber.org/zap"
)

func (w *Watcher) fetchTokenBridgeForChainAddresses(ctx context.Context, logger *zap.Logger, client *Client) (*uint64, error) {
	lastTokenBridgeEventIndex, err := w.db.getLastTokenBridgeEventIndex()
	if err == badger.ErrKeyNotFound {
		from := uint64(0)
		return &from, nil
	}

	if err != nil {
		logger.Error("failed to get last token bridge event index", zap.Error(err))
		return nil, err
	}

	count, err := client.GetContractEventsCount(ctx, w.tokenBridgeContract)
	if err != nil {
		logger.Error("failed to get token bridge event count", zap.Error(err))
		return nil, err
	}

	from := *lastTokenBridgeEventIndex + 1
	to := *count - 1
	events, err := client.GetContractEventsByIndex(ctx, w.tokenBridgeContract, from, to)
	if err != nil {
		logger.Error("failed to get token bridge events", zap.Uint64("from", from), zap.Uint64("to", to))
		return nil, err
	}

	unconfirmed, err := w.toUnconfirmedEvents(ctx, client, events.Events)
	if err != nil {
		logger.Error("failed to fetch unconfirmed events", zap.Error(err))
		return nil, err
	}
	// TODO: wait for confirmed???
	confirmed := &ConfirmedEvents{
		events:          unconfirmed,
		contractAddress: w.tokenWrapperFactoryContract,
	}
	if err := w.updateTokenBridgeForChain(ctx, logger, client, confirmed); err != nil {
		return nil, err
	}
	return count, nil
}

func (w *Watcher) fetchTokenWrapperAddresses(ctx context.Context, logger *zap.Logger, client *Client) (*uint64, error) {
	lastTokenWrapperFactoryEventIndex, err := w.db.getLastTokenWrapperFactoryEventIndex()
	if err == badger.ErrKeyNotFound {
		from := uint64(0)
		return &from, nil
	}

	if err != nil {
		logger.Error("failed to get last token wrapper factory event index", zap.Error(err))
		return nil, err
	}

	count, err := client.GetContractEventsCount(ctx, w.tokenWrapperFactoryContract)
	if err != nil {
		logger.Error("failed to get token wrapper factory event count", zap.Error(err))
		return nil, err
	}

	from := *lastTokenWrapperFactoryEventIndex + 1
	to := *count - 1
	events, err := client.GetContractEventsByIndex(ctx, w.tokenWrapperFactoryContract, from, to)
	if err != nil {
		logger.Error("failed to get token wrapper factory events", zap.Uint64("from", from), zap.Uint64("to", to))
		return nil, err
	}

	unconfirmed, err := w.toUnconfirmedEvents(ctx, client, events.Events)
	if err != nil {
		logger.Error("failed to fetch unconfirmed events", zap.Error(err))
		return nil, err
	}
	// TODO: wait for confirmed???
	confirmed := &ConfirmedEvents{
		events:          unconfirmed,
		contractAddress: w.tokenWrapperFactoryContract,
	}
	if err := w.validateTokenWrapperEvents(ctx, logger, client, confirmed); err != nil {
		return nil, err
	}
	return count, nil
}
