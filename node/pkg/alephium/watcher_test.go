package alephium

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	sdk "github.com/alephium/go-sdk"
	"github.com/go-test/deep"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
)

func randomEvent(confirmations uint8) *UnconfirmedEvent {
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

func TestSubscribeEvents(t *testing.T) {
	event0 := randomEvent(0)
	event1 := randomEvent(2)
	event2 := randomEvent(2)
	event3 := randomEvent(2)
	event4 := randomEvent(3)
	eventsFromForkChain := []*UnconfirmedEvent{event2, event3}

	watcher := &Watcher{
		chainIndex:         &ChainIndex{0, 0},
		currentHeight:      0,
		blockPollerEnabled: &atomic.Bool{},
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
	heightC := make(chan int32)

	isBlockInMainChain := func(hash string) (*bool, error) {
		var result bool = true
		for _, e := range eventsFromForkChain {
			if e.BlockHash == hash {
				result = false
				break
			}
		}
		return &result, nil
	}

	var blockOfEvent4 *sdk.BlockHeaderEntry
	getBlockHeader := func(hash string) (*sdk.BlockHeaderEntry, error) {
		if hash == event4.BlockHash {
			blockOfEvent4 = &sdk.BlockHeaderEntry{
				Height:    atomic.LoadInt32(&watcher.currentHeight),
				Hash:      hash,
				Timestamp: time.Now().UnixMilli(),
			}
			return blockOfEvent4, nil
		}
		return &sdk.BlockHeaderEntry{
			Height: atomic.LoadInt32(&watcher.currentHeight),
			Hash:   hash,
		}, nil
	}

	go watcher.handleEvents_(ctx, logger, isBlockInMainChain, getBlockHeader, handler, errC, eventsC, heightC)

	sendEventsAtHeight := func(height int32, unconfirmedEvents []*UnconfirmedEvent) {
		atomic.StoreInt32(&watcher.currentHeight, height)
		eventsC <- unconfirmedEvents
		heightC <- height
		time.Sleep(500 * time.Millisecond)
	}

	heightC <- 0
	assert.True(t, len(confirmedEvents) == 0)

	// event0 confirmed
	sendEventsAtHeight(1, []*UnconfirmedEvent{event0, event1, event4})
	assert.True(t, len(confirmedEvents) == 1)
	diff := deep.Equal(confirmedEvents[0].event.ContractEvent, event0.ContractEvent)
	assert.Nil(t, diff)

	// event1 not confirmed
	sendEventsAtHeight(2, []*UnconfirmedEvent{})
	assert.True(t, len(confirmedEvents) == 1)

	// event1 confirmed
	sendEventsAtHeight(4, []*UnconfirmedEvent{})
	assert.True(t, len(confirmedEvents) == 2)
	diff = deep.Equal(confirmedEvents[1].event.ContractEvent, event1.ContractEvent)
	assert.Nil(t, diff)

	// event2 and event3 are not confirmed
	sendEventsAtHeight(5, eventsFromForkChain)
	assert.True(t, len(confirmedEvents) == 2)

	// event2 and event3 are not confirmed
	sendEventsAtHeight(6, []*UnconfirmedEvent{})
	assert.True(t, len(confirmedEvents) == 2)

	// event2 and event3 are confirmed
	// the block of event3 becomes the main chain, but the block of event2 is still in the forked chain
	event3.BlockHash = randomByte32().ToHex()
	sendEventsAtHeight(7, []*UnconfirmedEvent{})
	assert.True(t, len(confirmedEvents) == 3)
	diff = deep.Equal(confirmedEvents[2].event.ContractEvent, event3.ContractEvent)
	assert.Nil(t, diff)

	// the block of event2 becomes the main chain, but we have removed it
	event2.BlockHash = randomByte32().ToHex()
	sendEventsAtHeight(8, []*UnconfirmedEvent{})
	assert.True(t, len(confirmedEvents) == 3)

	blockOfEvent4.Timestamp = time.Now().UnixMilli() - int64(event4.msg.consistencyLevel)*BlockTimeMs
	sendEventsAtHeight(8, []*UnconfirmedEvent{})
	assert.True(t, len(confirmedEvents) == 4)
}

func TestDisableBlockPoller(t *testing.T) {
	watcher := &Watcher{
		chainIndex:         &ChainIndex{0, 0},
		currentHeight:      0,
		blockPollerEnabled: &atomic.Bool{},
		pollIntervalMs:     100,
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	logger, err := zap.NewDevelopment()
	assert.Nil(t, err)

	errC := make(chan error)
	heightC := make(chan int32, 32)
	_currentHeight := int32(0)

	getCurrentHeight := func() (*int32, error) {
		_currentHeight += 1
		return &_currentHeight, nil
	}

	assertCurrentHeightEqual := func(expectedHeight int32) {
		currentHeight := atomic.LoadInt32(&watcher.currentHeight)
		assert.Equal(t, currentHeight, expectedHeight)
	}

	assertCurrentHeightNotLessThan := func(height int32) int32 {
		currentHeight := atomic.LoadInt32(&watcher.currentHeight)
		assert.True(t, currentHeight >= height)
		return currentHeight
	}

	go watcher._fetchHeight(ctx, logger, getCurrentHeight, errC, heightC)

	assertCurrentHeightEqual(0)
	time.Sleep(1 * time.Second)
	assertCurrentHeightEqual(0)

	watcher.EnableBlockPoller()
	time.Sleep(1 * time.Second)
	watcher.DisableBlockPoller()
	currentHeight := assertCurrentHeightNotLessThan(9)

	time.Sleep(1 * time.Second)
	assertCurrentHeightEqual(currentHeight)
}

func TestIsEventConfirmed(t *testing.T) {
	logger, err := zap.NewDevelopment()
	assert.Nil(t, err)
	now := time.Now().UnixMilli()

	tests := []struct {
		eventConsistencyLevel uint8
		eventBlockHeader      *sdk.BlockHeaderEntry
		currentTs             int64
		currentHeight         int32
		isConfirmed           bool
	}{
		{
			eventConsistencyLevel: 0,
			eventBlockHeader:      &sdk.BlockHeaderEntry{Timestamp: now, Height: 100},
			currentTs:             now,
			currentHeight:         100,
			isConfirmed:           true,
		},
		{
			eventConsistencyLevel: 2,
			eventBlockHeader:      &sdk.BlockHeaderEntry{Timestamp: 0, Height: 99},
			currentTs:             now,
			currentHeight:         100,
			isConfirmed:           false,
		},
		{
			eventConsistencyLevel: 2,
			eventBlockHeader:      &sdk.BlockHeaderEntry{Timestamp: now, Height: 98},
			currentTs:             now,
			currentHeight:         100,
			isConfirmed:           false,
		},
		{
			eventConsistencyLevel: 2,
			eventBlockHeader:      &sdk.BlockHeaderEntry{Timestamp: 0, Height: 98},
			currentTs:             now,
			currentHeight:         100,
			isConfirmed:           true,
		},
		{
			eventConsistencyLevel: 2,
			eventBlockHeader:      &sdk.BlockHeaderEntry{Timestamp: now - (2 * BlockTimeMs) + 1, Height: 97},
			currentTs:             now,
			currentHeight:         100,
			isConfirmed:           false,
		},
		{
			eventConsistencyLevel: 2,
			eventBlockHeader:      &sdk.BlockHeaderEntry{Timestamp: now - (2 * BlockTimeMs), Height: 97},
			currentTs:             now,
			currentHeight:         100,
			isConfirmed:           true,
		},
		{
			eventConsistencyLevel: 2,
			eventBlockHeader:      &sdk.BlockHeaderEntry{Timestamp: now - (2 * BlockTimeMs) - 1, Height: 97},
			currentTs:             now,
			currentHeight:         100,
			isConfirmed:           true,
		},
	}

	for _, c := range tests {
		event := &UnconfirmedEvent{
			ContractEvent: &sdk.ContractEvent{
				TxId: randomByte32().ToHex(),
			},
			msg: &WormholeMessage{
				consistencyLevel: c.eventConsistencyLevel,
			},
		}
		assert.Equal(t, isEventConfirmed(logger, event, c.eventBlockHeader, c.currentTs, c.currentHeight), c.isConfirmed)
	}
}
