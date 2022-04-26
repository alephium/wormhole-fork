package alephium

import (
	"context"

	"github.com/dgraph-io/badger/v3"
	"go.uber.org/zap"
)

func (w *Watcher) fetchEvents(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	contractAddress string,
) (*uint64, error) {
	lastEventIndexGetter := func() (*uint64, error) {
		return w.db.getLastEventIndex()
	}
	return w.fetchEvents_(ctx, logger, client, contractAddress, lastEventIndexGetter, w.toUnconfirmedEvents, w.handleEvents)
}

func (w *Watcher) fetchEvents_(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	contractAddress string,
	lastEventIndexGetter func() (*uint64, error),
	toUnconfirmedEvents func(context.Context, *Client, []*Event) ([]*UnconfirmedEvent, error),
	handler func(*zap.Logger, *ConfirmedEvents, bool) error,
) (*uint64, error) {
	lastEventIndex, err := lastEventIndexGetter()
	if err == badger.ErrKeyNotFound {
		from := uint64(0)
		return &from, nil
	}

	if err != nil {
		logger.Error("failed to get last event index", zap.Error(err), zap.String("contractAddress", contractAddress))
		return nil, err
	}

	count, err := client.GetContractEventsCount(ctx, contractAddress)
	if err != nil {
		logger.Error("failed to get event count", zap.Error(err), zap.String("contractAddress", contractAddress))
		return nil, err
	}

	from := *lastEventIndex + 1
	allEvents := make([]*UnconfirmedEvent, 0)
	for {
		events, err := client.GetContractEvents(ctx, contractAddress, from)
		if err != nil {
			logger.Error("failed to get events", zap.Error(err), zap.Uint64("from", from), zap.Uint64("to", *count), zap.String("contractAddress", contractAddress))
			return nil, err
		}

		if len(events.Events) == 0 {
			break
		}

		// TODO: wait for confirmed???
		unconfirmedEvents, err := toUnconfirmedEvents(ctx, client, events.Events)
		if err != nil {
			logger.Error("failed to fetch unconfirmed events", zap.Error(err))
			return nil, err
		}
		allEvents = append(allEvents, unconfirmedEvents...)
		from = events.NextStart
	}
	confirmed := &ConfirmedEvents{[]*UnconfirmedEvents{
		{
			eventIndex: *count - 1,
			events:     allEvents,
		},
	}}
	if err := handler(logger, confirmed, true); err != nil {
		return nil, err
	}
	return count, nil
}

func (w *Watcher) toUnconfirmedEvents(ctx context.Context, client *Client, events []*Event) ([]*UnconfirmedEvent, error) {
	unconfirmedEvents := make([]*UnconfirmedEvent, 0)
	for _, event := range events {
		unconfirmed, err := w.toUnconfirmedEvent(ctx, client, event)
		if err != nil {
			return nil, err
		}
		isCanonical, err := client.IsBlockInMainChain(ctx, unconfirmed.blockHeader.Hash)
		if err != nil {
			return nil, err
		}
		if isCanonical {
			unconfirmedEvents = append(unconfirmedEvents, unconfirmed)
		}
	}
	return unconfirmedEvents, nil
}
