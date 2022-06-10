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
	events := make([]*ContractEvent, 0)
	contractAddress := randomAddress()
	watcher := &Watcher{
		chainIndex: &ChainIndex{
			FromGroup: 0,
			ToGroup:   0,
		},
	}
	logger, err := zap.NewProduction()
	assert.Nil(t, err)

	batchSize := 1
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.RequestURI == eventCountURI(contractAddress) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(len(events))
			return
		}

		if strings.HasPrefix(r.RequestURI, "/events/contract/") {
			w.Header().Set("Content-Type", "application/json")
			query := r.URL.Query()
			from, err := strconv.Atoi(query["start"][0])
			assert.Nil(t, err)
			to := uint64(from + batchSize)
			event := &ContractEvents{}
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

		if strings.HasPrefix(r.RequestURI, "/blockflow/chain-info") {
			w.Header().Set("Content-Type", "application/json")
			result := struct {
				CurrentHeight uint32 `json:"currentHeight"`
			}{
				CurrentHeight: 0,
			}
			json.NewEncoder(w).Encode(result)
			return
		}
	}))

	lastEventIndexGetter := func() (*uint64, error) {
		return nil, badger.ErrKeyNotFound
	}

	toConfirmedEvents := func(height uint32, events *ContractEvents, fromIndex uint64) (*uint64, []*UnconfirmedEvent, error) {
		confirmed := make([]*UnconfirmedEvent, len(events.Events))
		for i, event := range events.Events {
			confirmed[i] = &UnconfirmedEvent{
				event: event,
			}
		}
		return &events.NextStart, confirmed, nil
	}

	var confirmedEvents *ConfirmedEvents
	handler := func(logger *zap.Logger, confirmed *ConfirmedEvents) error {
		confirmedEvents = confirmed
		return nil
	}

	client := NewClient(server.URL, "", 10)
	eventIndex, err := watcher.fetchEvents_(context.Background(), logger, client, contractAddress, lastEventIndexGetter, toConfirmedEvents, handler)
	assert.Nil(t, err)
	assert.Equal(t, *eventIndex, uint64(0))
	assert.Nil(t, confirmedEvents)

	lastEventIndexGetter = func() (*uint64, error) {
		nextIndex := uint64(0)
		return &nextIndex, nil
	}

	randomEvent := func() *ContractEvent {
		return &ContractEvent{
			BlockHash:  randomByte32().ToHex(),
			TxId:       randomByte32().ToHex(),
			EventIndex: 0,
			Fields:     []*Field{},
		}
	}

	events = append(events, []*ContractEvent{randomEvent(), randomEvent()}...)
	eventIndex, err = watcher.fetchEvents_(context.Background(), logger, client, contractAddress, lastEventIndexGetter, toConfirmedEvents, handler)
	assert.Nil(t, err)
	assert.Equal(t, *eventIndex, uint64(2))
	assert.Equal(t, len(confirmedEvents.events), 1)
	assert.Equal(t, confirmedEvents.events[0].events[0].event, events[1])
}

func TestToUnconfirmedEvents(t *testing.T) {
	watcher := &Watcher{
		minConfirmations: 5,
	}
	logger, err := zap.NewProduction()
	assert.Nil(t, err)

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
		{
			header: BlockHeader{
				Hash:   randomByte32().ToHex(),
				Height: 4,
			},
			isCanonical: true,
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
	events := &ContractEvents{
		Events: []*ContractEvent{
			{
				BlockHash:  blocks[0].header.Hash,
				EventIndex: UndoneSequenceCompletedEventIndex,
			},
			{
				BlockHash:  blocks[0].header.Hash,
				EventIndex: WormholeMessageEventIndex,
			},
			{
				BlockHash:  blocks[1].header.Hash,
				EventIndex: UndoneSequenceCompletedEventIndex,
			},
			{
				BlockHash:  blocks[2].header.Hash,
				EventIndex: UndoneSequencesRemovedEventIndex,
			},
		},
		NextStart: 3,
	}
	eventIndex, unconfirmedEvents, err := watcher.toConfirmedEvents(context.Background(), logger, client, 6, events, 0)
	assert.Nil(t, err)
	assert.Equal(t, *eventIndex, uint64(2))
	assert.Equal(t, len(unconfirmedEvents), 1)
	assert.Equal(t, unconfirmedEvents[0].event.blockHash(), blocks[0].header.Hash)
	assert.Equal(t, unconfirmedEvents[0].event.eventIndex(), UndoneSequenceCompletedEventIndex)
}
