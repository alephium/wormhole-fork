package alephium

import (
	"context"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	sdk "github.com/alephium/go-sdk"
	"github.com/go-test/deep"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
)

func TestSubscribeEvents(t *testing.T) {
	randomEvent := func(confirmations uint8) *UnconfirmedEvent {
		return &UnconfirmedEvent{
			ContractEvent: &sdk.ContractEvent{
				BlockHash:  randomByte32().ToHex(),
				TxId:       randomByte32().ToHex(),
				EventIndex: 0,
			},
			msg: &WormholeMessage{
				consistencyLevel: confirmations,
			},
		}
	}

	event0 := randomEvent(0)
	event1 := randomEvent(2)
	event2 := randomEvent(0) // event2 from orphan block

	watcher := &Watcher{
		chainIndex: &ChainIndex{
			FromGroup: 0,
			ToGroup:   0,
		},
		currentHeight: 0,
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
	errC := make(chan error)
	eventsC := make(chan []*UnconfirmedEvent)

	isBlockInMainChain := func(hash string) (*bool, error) {
		b := true
		if hash == event2.BlockHash {
			b = false
		}
		return &b, nil
	}

	getBlockHeader := func(hash string) (*sdk.BlockHeaderEntry, error) {
		return &sdk.BlockHeaderEntry{
			Height: atomic.LoadInt32(&watcher.currentHeight),
		}, nil
	}

	go watcher.handleEvents_(ctx, logger, isBlockInMainChain, getBlockHeader, handler, errC, eventsC)

	eventsC <- []*UnconfirmedEvent{}
	assert.True(t, len(confirmedEvents) == 0)

	// event0 confirmed
	atomic.StoreInt32(&watcher.currentHeight, 1)
	eventsC <- []*UnconfirmedEvent{event0, event1}
	time.Sleep(500 * time.Millisecond)
	fmt.Println(len(confirmedEvents))
	assert.True(t, len(confirmedEvents) == 1)
	diff := deep.Equal(confirmedEvents[0].event.ContractEvent, event0.ContractEvent)
	assert.Nil(t, diff)

	// event1 not confirmed
	atomic.StoreInt32(&watcher.currentHeight, 2)
	eventsC <- []*UnconfirmedEvent{}
	time.Sleep(500 * time.Millisecond)
	assert.True(t, len(confirmedEvents) == 1)

	// event1 confirmed
	atomic.StoreInt32(&watcher.currentHeight, 4)
	eventsC <- []*UnconfirmedEvent{}
	time.Sleep(500 * time.Millisecond)
	assert.True(t, len(confirmedEvents) == 2)
	diff = deep.Equal(confirmedEvents[1].event.ContractEvent, event1.ContractEvent)
	assert.Nil(t, diff)

	// event2
	atomic.StoreInt32(&watcher.currentHeight, 8)
	eventsC <- []*UnconfirmedEvent{event2}
	time.Sleep(500 * time.Millisecond)
	assert.True(t, len(confirmedEvents) == 2)
}
