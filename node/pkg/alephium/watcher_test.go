package alephium

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	sdk "github.com/alephium/go-sdk"
	"github.com/go-test/deep"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
)

func TestSubscribeEvents(t *testing.T) {
	randomEvent := func(confirmations uint8) *sdk.ContractEvent {
		return &sdk.ContractEvent{
			BlockHash:  randomByte32().ToHex(),
			TxId:       randomByte32().ToHex(),
			EventIndex: 0,
			Fields:     []sdk.Val{u256Field(int(confirmations))},
		}
	}

	event0 := randomEvent(0)
	event1 := randomEvent(2)
	// event from orphan block
	event2 := randomEvent(0)

	events := make([]sdk.ContractEvent, 0)
	isCanonicalBlock := uint32(1)
	contractAddress := randomAddress()
	watcher := &Watcher{
		chainIndex: &ChainIndex{
			FromGroup: 0,
			ToGroup:   0,
		},
		currentHeight: 0,
	}

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
			json.NewEncoder(w).Encode(&sdk.ContractEvents{
				Events:    events[from:],
				NextStart: int32(len(events)),
			})
			return
		}

		if strings.HasPrefix(r.RequestURI, "/blockflow/is-block-in-main-chain") {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(atomic.LoadUint32(&isCanonicalBlock) == 1)
			return
		}

		if strings.HasPrefix(r.RequestURI, "/blockflow/headers") {
			w.Header().Set("Content-Type", "application/json")
			height := atomic.LoadInt32(&watcher.currentHeight)
			json.NewEncoder(w).Encode(&sdk.BlockHeaderEntry{
				Height: height,
			})
			return
		}
	}))

	toUnconfirmed := func(event *sdk.ContractEvent) (*UnconfirmedEvent, error) {
		confirmations, err := toUint8(event.Fields[0])
		assert.Nil(t, err)
		return &UnconfirmedEvent{
			event,
			*confirmations,
		}, nil
	}

	confirmedEvents := make([]*ConfirmedEvent, 0)
	handler := func(logger *zap.Logger, confirmed []*ConfirmedEvent) error {
		confirmedEvents = append(confirmedEvents, confirmed...)
		return nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logger, err := zap.NewDevelopment()
	assert.Nil(t, err)
	client := NewClient(server.URL, "", 10)
	errC := make(chan error)
	go watcher.subscribe_(ctx, logger, client, contractAddress, toUnconfirmed, handler, 500*time.Millisecond, errC)

	time.Sleep(1 * time.Second)
	assert.True(t, len(confirmedEvents) == 0)

	// event0 confirmed
	atomic.StoreInt32(&watcher.currentHeight, 1)
	events = append(events, *event0)
	time.Sleep(1 * time.Second)
	assert.True(t, len(confirmedEvents) == 1)
	diff := deep.Equal(confirmedEvents[0].event.ContractEvent, event0)
	assert.Nil(t, diff)

	// event1 not confirmed
	atomic.StoreInt32(&watcher.currentHeight, 2)
	events = append(events, *event1)
	time.Sleep(1 * time.Second)
	assert.True(t, len(confirmedEvents) == 1)

	// event1 confirmed
	atomic.StoreInt32(&watcher.currentHeight, 4)
	time.Sleep(1 * time.Second)
	assert.True(t, len(confirmedEvents) == 2)
	diff = deep.Equal(confirmedEvents[1].event.ContractEvent, event1)
	assert.Nil(t, diff)

	// event2
	atomic.StoreUint32(&isCanonicalBlock, 0)
	events = append(events, *event2)
	time.Sleep(1 * time.Second)
	assert.True(t, len(confirmedEvents) == 2)
}
