package alephium

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/readiness"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"go.uber.org/zap"
)

type Watcher struct {
	url    string
	apiKey string

	governanceContract          string
	tokenBridgeContract         string
	tokenWrapperFactoryContract string
	chainIndex                  *ChainIndex

	readiness readiness.Component

	msgChan  chan *common.MessagePublication
	setChan  chan *common.GuardianSet
	obsvReqC chan *gossipv1.ObservationRequest

	minConfirmations uint64
	currentHeight    uint32

	dbPath string
}

type message struct {
	event         *Event
	confirmations uint8
}

type PendingMessages struct {
	blockHeader *BlockHeader
	messages    []*message
}

type ConfirmedMessages struct {
	blockHeader *BlockHeader
	messages    []*message
}

func messageFromEvent(
	event *Event,
	governanceContract string,
	minConfirmations uint8,
) (*message, error) {
	if event.ContractId != governanceContract {
		return &message{
			event:         event,
			confirmations: minConfirmations,
		}, nil
	}

	consistencyLevel, err := event.Fields[len(event.Fields)-1].ToUint64()
	if err != nil {
		return nil, err
	}

	confirmations := uint8(consistencyLevel)
	if confirmations < minConfirmations {
		confirmations = minConfirmations
	}
	return &message{
		event:         event,
		confirmations: confirmations,
	}, nil
}

func NewAlephiumWatcher(
	url string,
	apiKey string,
	fromGroup uint8,
	toGroup uint8,
	contracts []string,
	readiness readiness.Component,
	messageEvents chan *common.MessagePublication,
	setEvents chan *common.GuardianSet,
	minConfirmations uint64,
	obsvReqC chan *gossipv1.ObservationRequest,
	dbPath string,
) *Watcher {
	if len(contracts) != 3 {
		return nil
	}
	return &Watcher{
		url:                         url,
		apiKey:                      apiKey,
		governanceContract:          contracts[0],
		tokenBridgeContract:         contracts[1],
		tokenWrapperFactoryContract: contracts[2],

		chainIndex: &ChainIndex{
			FromGroup: fromGroup,
			ToGroup:   toGroup,
		},

		readiness:        readiness,
		msgChan:          messageEvents,
		setChan:          setEvents,
		obsvReqC:         obsvReqC,
		minConfirmations: minConfirmations,
		dbPath:           dbPath,
	}
}

func (w *Watcher) Run(ctx context.Context) error {
	p2p.DefaultRegistry.SetNetworkStats(vaa.ChainIDAlephium, &gossipv1.Heartbeat_Network{
		ContractAddress: w.governanceContract,
	})

	db, err := open(w.dbPath)
	if err != nil {
		return err
	}

	logger := supervisor.Logger(ctx)
	logger.Info("Alephium watcher started")

	contracts := []string{w.governanceContract, w.tokenBridgeContract, w.tokenWrapperFactoryContract}
	client := NewClient(w.url, w.apiKey, 10)
	confirmedC := make(chan *ConfirmedMessages, 8)
	errC := make(chan error)
	validator := newValidator(contracts, confirmedC, w.msgChan, db)

	go w.getEvents(ctx, client, 0, errC, confirmedC)
	go validator.run(ctx, errC)

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errC:
		return err
	}
}

func (w *Watcher) handleObsvRequest(ctx context.Context, client *Client) {
	for {
		select {
		case <-ctx.Done():
			return
		case req := <-w.obsvReqC:
			assume(req.ChainId == uint32(vaa.ChainIDAlephium))
			// TODO: get event by txId
		}
	}
}

func (w *Watcher) getEvents(ctx context.Context, client *Client, fromHeight uint32, errC chan<- error, confirmedC chan<- *ConfirmedMessages) {
	logger := supervisor.Logger(ctx)
	currentHeight := fromHeight
	pendings := map[uint32]*PendingMessages{}
	contracts := []string{w.governanceContract, w.tokenBridgeContract, w.tokenWrapperFactoryContract}

	getMessagesFromBlock := func(height uint32) (*PendingMessages, error) {
		hashes, err := client.GetHashes(ctx, w.chainIndex, height)
		if err != nil {
			return nil, err
		}

		if len(hashes) == 0 {
			return nil, fmt.Errorf("empty hashes for block %d", height)
		}

		blockHash := hashes[0]
		events, err := client.GetContractEventsFromBlock(ctx, blockHash, contracts)
		if err != nil {
			return nil, err
		}

		header, err := client.GetBlockHeader(ctx, blockHash)
		if err != nil {
			return nil, err
		}

		messages := make([]*message, len(events))
		for i, event := range events {
			msg, err := messageFromEvent(event, w.governanceContract, uint8(w.minConfirmations))
			if err != nil {
				return nil, err
			}
			messages[i] = msg
		}
		return &PendingMessages{
			messages:    messages,
			blockHeader: header,
		}, nil
	}

	checkConfirmations := func(currentHeight uint32) error {
		for height, pending := range pendings {
			if height+uint32(w.minConfirmations) > currentHeight {
				continue
			}

			blockHash := pending.messages[0].event.BlockHash
			isCanonical, err := client.IsBlockInMainChain(ctx, blockHash)
			if err != nil {
				return err
			}

			pendingMsg := pending
			// forked, we need to re-request events for the height
			if !isCanonical {
				msgs, err := getMessagesFromBlock(height)
				if err != nil {
					logger.Error("handle fork: failed to get events", zap.Uint32("height", height))
					return err
				}
				pendingMsg = msgs
			}

			unconfirmedMessages := make([]*message, 0)
			confirmedMessages := make([]*message, 0)
			for _, message := range pendingMsg.messages {
				if height+uint32(message.confirmations) > currentHeight {
					unconfirmedMessages = append(unconfirmedMessages, message)
					continue
				}
				confirmedMessages = append(confirmedMessages, message)
			}

			confirmed := &ConfirmedMessages{
				blockHeader: pendingMsg.blockHeader,
				messages:    confirmedMessages,
			}
			// it's safe to update map entry within range loop
			if len(unconfirmedMessages) == 0 {
				delete(pendings, height)
			} else {
				pendings[height] = &PendingMessages{
					messages:    unconfirmedMessages,
					blockHeader: pendingMsg.blockHeader,
				}
			}
			confirmedC <- confirmed
		}
		return nil
	}

	msgs, err := getMessagesFromBlock(fromHeight)
	if err != nil {
		errC <- err
		return
	}
	pendings[fromHeight] = msgs

	t := time.NewTicker(20 * time.Second)
	defer t.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			height, err := client.GetCurrentHeight(ctx, w.chainIndex)
			if err != nil {
				logger.Error("failed to get current height", zap.Error(err))
				errC <- err
			}

			atomic.StoreUint32(&w.currentHeight, height)

			if height <= currentHeight {
				continue
			}

			for h := currentHeight + 1; h <= height; h++ {
				msgs, err := getMessagesFromBlock(h)
				if err != nil {
					logger.Error("failed to get events", zap.Error(err), zap.Uint32("height", h))
				}
				pendings[h] = msgs
			}

			currentHeight = height
			checkConfirmations(currentHeight)
		}
	}
}
