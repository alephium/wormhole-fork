package alephium

import (
	"context"
	"encoding/hex"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/readiness"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"github.com/dgraph-io/badger/v3"
	"go.uber.org/zap"
)

const MaxForkHeight = uint32(100)

type Watcher struct {
	url    string
	apiKey string

	governanceContract          string
	tokenBridgeContract         string
	tokenWrapperFactoryContract string
	chainIndex                  *ChainIndex
	initHeight                  uint32

	readiness readiness.Component

	msgChan  chan *common.MessagePublication
	setChan  chan *common.GuardianSet
	obsvReqC chan *gossipv1.ObservationRequest

	minConfirmations uint8
	currentHeight    uint32

	db *db
}

type UnconfirmedEvent struct {
	blockHeader   *BlockHeader
	event         *Event
	eventIndex    uint64
	confirmations uint8
}

func NewAlephiumWatcher(
	url string,
	apiKey string,
	fromGroup uint8,
	toGroup uint8,
	contracts []string,
	initHeight uint32,
	readiness readiness.Component,
	messageEvents chan *common.MessagePublication,
	setEvents chan *common.GuardianSet,
	minConfirmations uint64,
	obsvReqC chan *gossipv1.ObservationRequest,
	dbPath string,
) (*Watcher, error) {
	if len(contracts) != 3 {
		return nil, fmt.Errorf("invalid contract ids")
	}
	db, err := open(dbPath)
	if err != nil {
		return nil, err
	}

	return &Watcher{
		url:                         url,
		apiKey:                      apiKey,
		governanceContract:          contracts[0],
		tokenBridgeContract:         contracts[1],
		tokenWrapperFactoryContract: contracts[2],

		initHeight: initHeight,
		chainIndex: &ChainIndex{
			FromGroup: fromGroup,
			ToGroup:   toGroup,
		},

		readiness:        readiness,
		msgChan:          messageEvents,
		setChan:          setEvents,
		obsvReqC:         obsvReqC,
		minConfirmations: uint8(minConfirmations),
		db:               db,
	}, nil
}

func (w *Watcher) ContractServer(logger *zap.Logger, listenAddr string) (supervisor.Runnable, error) {
	return contractServiceRunnable(w.db, listenAddr, logger)
}

func (w *Watcher) Run(ctx context.Context) error {
	p2p.DefaultRegistry.SetNetworkStats(vaa.ChainIDAlephium, &gossipv1.Heartbeat_Network{
		ContractAddress: w.governanceContract,
	})

	logger := supervisor.Logger(ctx)
	client := NewClient(w.url, w.apiKey, 10)
	nodeInfo, err := client.GetNodeInfo(ctx)
	if err != nil {
		logger.Error("failed to get node info", zap.Error(err))
		return err
	}
	logger.Info("alephium watcher started", zap.String("url", w.url), zap.String("version", nodeInfo.BuildInfo.ReleaseVersion))

	nextTokenBridgeEventIndex, err := w.fetchTokenBridgeForChainAddresses(ctx, logger, client)
	if err != nil {
		logger.Error("failed to fetch token bridge for chain addresses", zap.Error(err))
		return err
	}

	nextTokenWrapperFactoryIndex, err := w.fetchTokenWrapperAddresses(ctx, logger, client)
	if err != nil {
		logger.Error("failed to fetch token wrapper addresses", zap.Error(err))
		return err
	}

	readiness.SetReady(w.readiness)

	errC := make(chan error)
	confirmedEventsC := make(chan []*UnconfirmedEvent)
	tokenBridgeHeightC := make(chan uint32)
	tokenWrapperFactoryHeightC := make(chan uint32)
	governanceHeightC := make(chan uint32)
	validator := newValidator(w.governanceContract, w.msgChan, w.db)

	go w.handleObsvRequest(ctx, logger, client, confirmedEventsC)
	go w.monitoringHeight(ctx, logger, client, errC, []chan<- uint32{tokenBridgeHeightC, tokenWrapperFactoryHeightC, governanceHeightC})
	go w.handleTokenBridgeEvents(ctx, logger, client, *nextTokenBridgeEventIndex, errC, tokenBridgeHeightC)
	go w.handleTokenWrapperFactoryEvents(ctx, logger, client, *nextTokenWrapperFactoryIndex, errC, tokenWrapperFactoryHeightC)
	go w.handleGovernanceEvents(ctx, logger, client, errC, governanceHeightC, confirmedEventsC)
	go validator.run(ctx, logger, errC, confirmedEventsC)

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errC:
		return err
	}
}

func (w *Watcher) monitoringHeight(ctx context.Context, logger *zap.Logger, client *Client, errC chan<- error, destinations []chan<- uint32) {
	t := time.NewTicker(10 * time.Second)
	defer t.Stop()

	lastHeight := uint32(0)

	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			height, err := client.GetCurrentHeight(ctx, w.chainIndex)
			if err != nil {
				logger.Error("failed to get current height", zap.Error(err))
				errC <- err
				return
			}

			atomic.StoreUint32(&w.currentHeight, height)

			if height != lastHeight {
				lastHeight = height
				for _, dest := range destinations {
					dest <- height
				}
			}
		}
	}
}

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

	// TODO: wait for confirmed???
	batch := newBatch()
	for _, event := range events.Events {
		remoteChainId, tokenBridgeForChainAddress, err := client.GetTokenBridgeForChainInfo(ctx, event, w.chainIndex.FromGroup)
		if err != nil {
			logger.Error("failed to get token bridge for chain info", zap.Error(err))
			return nil, err
		}
		batch.writeTokenBridgeForChain(*remoteChainId, *tokenBridgeForChainAddress)
	}
	batch.updateLastTokenBridgeEventIndex(*count)
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

	// TODO: wait for confirmed???
	batch := newBatch()
	for _, event := range events.Events {
		remoteTokenId, tokenWrapperAddress, err := client.GetTokenWrapperInfo(ctx, event, w.chainIndex.FromGroup)
		if err != nil {
			logger.Error("failed to get token wrapper info", zap.Error(err))
			return nil, err
		}
		batch.writeRemoteTokenWrapper(*remoteTokenId, *tokenWrapperAddress)
	}
	batch.updateLastTokenWrapperFactoryEventIndex(*count)
	return count, nil
}

func (w *Watcher) handleObsvRequest(ctx context.Context, logger *zap.Logger, client *Client, confirmedC chan<- []*UnconfirmedEvent) {
	for {
		select {
		case <-ctx.Done():
			return
		case req := <-w.obsvReqC:
			assume(req.ChainId == uint32(vaa.ChainIDAlephium))
			txId := hex.EncodeToString(req.TxHash)
			txStatus, err := client.GetTransactionStatus(ctx, txId)
			if err != nil {
				logger.Error("failed to get transaction status", zap.String("txId", txId), zap.Error(err))
				continue
			}

			blockHash := txStatus.BlockHash
			isCanonical, err := client.IsBlockInMainChain(ctx, blockHash)
			if err != nil {
				logger.Error("failed to check mainchain block", zap.String("blockHash", blockHash), zap.Error(err))
				continue
			}
			if !isCanonical {
				logger.Info("ignore orphan block", zap.String("blockHash", blockHash))
				continue
			}

			currentHeight := atomic.LoadUint32(&w.currentHeight)

			unconfirmedEvents, err := w.getGovernanceEventsFromBlockHash(ctx, client, blockHash, txId)
			if err != nil {
				logger.Info("failed to get events from block", zap.String("blockHash", blockHash), zap.Error(err))
				continue
			}

			confirmedEvents := make([]*UnconfirmedEvent, 0)
			for _, event := range unconfirmedEvents {
				if event.blockHeader.Height+uint32(event.confirmations) <= currentHeight {
					logger.Info("re-boserve event",
						zap.String("txId", txId),
						zap.String("blockHash", blockHash),
						zap.Uint32("blockHeight", event.blockHeader.Height),
						zap.Uint32("currentHeight", currentHeight),
						zap.Uint8("confirmations", event.confirmations),
					)
					confirmedEvents = append(confirmedEvents, event)
				} else {
					logger.Info("ignore unconfirmed re-observed event",
						zap.String("txId", txId),
						zap.String("blockHash", blockHash),
						zap.Uint32("blockHeight", event.blockHeader.Height),
						zap.Uint32("currentHeight", currentHeight),
						zap.Uint8("confirmations", event.confirmations),
					)
				}
			}
			if len(confirmedEvents) > 0 {
				confirmedC <- confirmedEvents
			}
		}
	}
}

func (w *Watcher) getGovernanceEventsFromBlockHash(
	ctx context.Context,
	client *Client,
	blockHash string,
	txId string,
) ([]*UnconfirmedEvent, error) {
	events, err := client.GetContractEventsFromBlockHash(ctx, blockHash, []string{w.governanceContract})
	if err != nil {
		return nil, err
	}

	header, err := client.GetBlockHeader(ctx, blockHash)
	if err != nil {
		return nil, err
	}

	unconfirmedEvents := make([]*UnconfirmedEvent, len(events))
	for _, event := range events {
		if event.TxId != txId {
			continue
		}
		unconfirmed, err := w.toUnconfirmedEvent(ctx, event, header)
		if err != nil {
			return nil, err
		}
		unconfirmedEvents = append(unconfirmedEvents, unconfirmed)
	}
	return unconfirmedEvents, nil
}

func (w *Watcher) toUnconfirmedEvent(ctx context.Context, event *Event, header *BlockHeader) (*UnconfirmedEvent, error) {
	if event.ContractAddress != w.governanceContract {
		return &UnconfirmedEvent{
			blockHeader:   header,
			event:         event,
			confirmations: w.minConfirmations,
		}, nil
	}

	consistencyLevel, err := event.Fields[len(event.Fields)-1].ToUint64()
	if err != nil {
		return nil, err
	}

	confirmations := uint8(consistencyLevel)
	if confirmations < w.minConfirmations {
		confirmations = w.minConfirmations
	}
	return &UnconfirmedEvent{
		event:         event,
		confirmations: confirmations,
	}, nil
}

func (w *Watcher) handleTokenBridgeEvents(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	nextIndex uint64,
	errC chan<- error,
	newBlockC <-chan uint32,
) {
	handler := func(confirmed []*UnconfirmedEvent) error {
		if len(confirmed) == 0 {
			return nil
		}

		maxIndex := uint64(0)
		batch := newBatch()
		for _, event := range confirmed {
			if event.eventIndex > maxIndex {
				maxIndex = event.eventIndex
			}

			remoteChainId, tokenBridgeForChainAddress, err := client.GetTokenBridgeForChainInfo(ctx, event.event, w.chainIndex.FromGroup)
			if err != nil {
				logger.Error("failed to get token bridge for chain info", zap.Error(err))
				return err
			}
			batch.writeTokenBridgeForChain(*remoteChainId, *tokenBridgeForChainAddress)
		}
		batch.updateLastTokenBridgeEventIndex(maxIndex)
		return w.db.writeBatch(batch)
	}

	w.getContractEvents(ctx, logger, client, w.tokenBridgeContract, nextIndex, errC, newBlockC, handler)
}

func (w *Watcher) handleTokenWrapperFactoryEvents(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	nextIndex uint64,
	errC chan<- error,
	newBlockC <-chan uint32,
) {
	handler := func(confirmed []*UnconfirmedEvent) error {
		if len(confirmed) == 0 {
			return nil
		}

		maxIndex := uint64(0)
		batch := newBatch()
		for _, event := range confirmed {
			if event.eventIndex > maxIndex {
				maxIndex = event.eventIndex
			}

			remoteTokenId, tokenWrapperAddress, err := client.GetTokenWrapperInfo(ctx, event.event, w.chainIndex.FromGroup)
			if err != nil {
				logger.Error("failed to get token wrapper info", zap.Error(err))
				return err
			}
			batch.writeRemoteTokenWrapper(*remoteTokenId, *tokenWrapperAddress)
		}
		batch.updateLastTokenWrapperFactoryEventIndex(maxIndex)
		return w.db.writeBatch(batch)
	}

	w.getContractEvents(ctx, logger, client, w.tokenWrapperFactoryContract, nextIndex, errC, newBlockC, handler)
}

func (w *Watcher) handleGovernanceEvents(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	errC chan<- error,
	newBlockC <-chan uint32,
	confirmedC chan<- []*UnconfirmedEvent,
) error {
	count, err := client.GetContractEventsCount(ctx, w.governanceContract)
	if err != nil {
		logger.Error("failed to get governance contract count", zap.Error(err))
		errC <- err
		return err
	}

	handler := func(confirmed []*UnconfirmedEvent) error {
		confirmedC <- confirmed
		return nil
	}

	w.getContractEvents(ctx, logger, client, w.governanceContract, *count, errC, newBlockC, handler)
	return nil
}

func (w *Watcher) getContractEvents(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	contractAddress string,
	_nextIndex uint64,
	errC chan<- error,
	newBlockC <-chan uint32,
	handler func([]*UnconfirmedEvent) error,
) {
	unconfirmedEvents := map[uint64]*UnconfirmedEvent{}
	nextIndex := _nextIndex

	t := time.NewTicker(10 * time.Second)
	defer t.Stop()

	for {
		select {
		case <-ctx.Done():
			return

		case <-t.C:
			count, err := client.GetContractEventsCount(ctx, contractAddress)
			if err != nil {
				logger.Error("failed to get contract event count", zap.String("contractAddress", contractAddress), zap.Error(err))
				errC <- err
				return
			}

			if nextIndex+1 > *count {
				continue
			}

			to := (*count - 1)
			events, err := client.GetContractEventsByIndex(ctx, contractAddress, nextIndex, to)
			if err != nil {
				logger.Error("failed to get contract events", zap.Uint64("from", nextIndex), zap.Uint64("to", to), zap.Error(err))
				errC <- err
				return
			}

			assume(len(events.Events) == int(to-nextIndex+1))
			for i, event := range events.Events {
				header, err := client.GetBlockHeader(ctx, event.BlockHash)
				if err != nil {
					logger.Error("failed to get block header", zap.String("hash", event.BlockHash), zap.Error(err))
					errC <- err
					return
				}
				unconfirmed, err := w.toUnconfirmedEvent(ctx, event, header)
				if err != nil {
					logger.Error("failed to convert to unconfirmed event", zap.Error(err))
					errC <- err
					return
				}
				unconfirmed.eventIndex = nextIndex + uint64(i)
				unconfirmedEvents[unconfirmed.eventIndex] = unconfirmed
			}

		case height := <-newBlockC:
			confirmed := make([]*UnconfirmedEvent, 0)
			for eventIndex, unconfirmed := range unconfirmedEvents {
				if unconfirmed.blockHeader.Height+uint32(unconfirmed.confirmations) > height {
					continue
				}

				isCanonical, err := client.IsBlockInMainChain(ctx, unconfirmed.event.BlockHash)
				if err != nil {
					logger.Error("failed to check mainchain block", zap.Error(err))
					errC <- err
					return
				}

				if !isCanonical {
					// it's safe to update map in range loop
					delete(unconfirmedEvents, eventIndex)
					continue
				}

				confirmed = append(confirmed, unconfirmed)
				delete(unconfirmedEvents, eventIndex)
			}

			if err := handler(confirmed); err != nil {
				logger.Error("failed to handle confirmed events", zap.Error(err))
				errC <- err
				return
			}
		}
	}
}
