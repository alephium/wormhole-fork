package alephium

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/dgraph-io/badger/v3"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
)

func TestFetchEvents(t *testing.T) {
	events := make([]*Event, 0)
	contractAddress := randomAddress()
	watcher := &Watcher{}
	logger, err := zap.NewProduction()
	assert.Nil(t, err)

	batchSize := 1
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.RequestURI == eventCountURI(contractAddress) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(len(events))
			return
		}

		if strings.HasPrefix(r.RequestURI, "/events/contract?start=") {
			w.Header().Set("Content-Type", "application/json")
			query := r.URL.Query()
			from, err := strconv.Atoi(query["start"][0])
			assert.Nil(t, err)
			to := uint64(from + batchSize)
			event := &Events{
				ChainFrom: 0,
				ChainTo:   0,
			}
			if len(events) < int(to) {
				event.Events = events[from:]
				event.NextStart = uint64(len(events))
			} else {
				event.Events = events[from:to]
				event.NextStart = to
			}

			json.NewEncoder(w).Encode(event)
			return
		}
	}))

	lastEventIndexGetter := func() (*uint64, error) {
		return nil, badger.ErrKeyNotFound
	}

	toUnconfirmedEvents := func(ctx context.Context, client *Client, events []*Event) ([]*UnconfirmedEvent, error) {
		unconfirmed := make([]*UnconfirmedEvent, len(events))
		for i, event := range events {
			unconfirmed[i] = &UnconfirmedEvent{
				event: event,
			}
		}
		return unconfirmed, nil
	}

	var confirmedEvents *ConfirmedEvents
	handler := func(logger *zap.Logger, confirmed *ConfirmedEvents, b bool) error {
		confirmedEvents = confirmed
		return nil
	}

	client := NewClient(server.URL, "", 10)
	eventIndex, err := watcher.fetchEvents_(context.Background(), logger, client, contractAddress, lastEventIndexGetter, toUnconfirmedEvents, handler)
	assert.Nil(t, err)
	assert.Equal(t, *eventIndex, uint64(0))
	assert.Nil(t, confirmedEvents)

	lastEventIndexGetter = func() (*uint64, error) {
		nextIndex := uint64(0)
		return &nextIndex, nil
	}

	randomEvent := func() *Event {
		return &Event{
			BlockHash:       randomByte32().ToHex(),
			ContractAddress: contractAddress,
			TxId:            randomByte32().ToHex(),
			EventIndex:      0,
			Fields:          []*Field{},
		}
	}

	events = append(events, []*Event{randomEvent(), randomEvent()}...)
	eventIndex, err = watcher.fetchEvents_(context.Background(), logger, client, contractAddress, lastEventIndexGetter, toUnconfirmedEvents, handler)
	assert.Nil(t, err)
	assert.Equal(t, *eventIndex, uint64(2))
	assert.Equal(t, len(confirmedEvents.events), 1)
	assert.Equal(t, confirmedEvents.events[0].events[0].event, events[1])
}

func TestToUnconfirmedEvents(t *testing.T) {
	watcher := &Watcher{}

	blocks := []struct {
		header      BlockHeader
		isCanonical bool
	}{
		{
			header: BlockHeader{
				Hash: randomByte32().ToHex(),
			},
			isCanonical: true,
		},
		{
			header: BlockHeader{
				Hash: randomByte32().ToHex(),
			},
			isCanonical: false,
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.RequestURI, "/blockflow/is-block-in-main-chain") {
			w.Header().Set("Content-Type", "application/json")
			query := r.URL.Query()
			blockHash := query["blockHash"][0]
			for _, block := range blocks {
				if block.header.Hash == blockHash {
					json.NewEncoder(w).Encode(block.isCanonical)
					return
				}
			}
			t.Fatal("invalid block hash")
		}

		if strings.HasPrefix(r.RequestURI, "/blockflow/blocks") {
			w.Header().Set("Content-Type", "application/json")
			parts := strings.Split(r.URL.Path, "/")
			blockHash := parts[3]
			for _, block := range blocks {
				if block.header.Hash == blockHash {
					json.NewEncoder(w).Encode(block.header)
					return
				}
			}
			t.Fatal("invalid block hash")
		}
	}))

	client := NewClient(server.URL, "", 10)
	events := []*Event{
		{
			BlockHash:  blocks[0].header.Hash,
			EventIndex: TokenWrapperCreatedEventIndex,
		},
		{
			BlockHash:  blocks[1].header.Hash,
			EventIndex: TokenWrapperCreatedEventIndex,
		},
	}
	unconfirmedEvents, err := watcher.toUnconfirmedEvents(context.Background(), client, events)
	assert.Nil(t, err)
	assert.Equal(t, len(unconfirmedEvents), 1)
}
