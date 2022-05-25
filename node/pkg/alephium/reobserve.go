package alephium

import (
	"context"
	"encoding/hex"
	"sync/atomic"

	"github.com/certusone/wormhole/node/pkg/vaa"
	"go.uber.org/zap"
)

func (w *Watcher) handleObsvRequest(ctx context.Context, logger *zap.Logger, client *Client) {
	eventEmitterAddress := ToContractAddress(w.eventEmitterId)

	for {
		select {
		case <-ctx.Done():
			return
		case req := <-w.obsvReqC:
			assume(req.ChainId == uint32(vaa.ChainIDAlephium))
			assume(len(req.TxHash) == 32)
			txId := hex.EncodeToString(req.TxHash[0:32])
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

			unconfirmedEvents, err := w.getGovernanceEventsByTxId(ctx, client, eventEmitterAddress, blockHash, txId)
			if err != nil {
				logger.Info("failed to get events from block", zap.String("blockHash", blockHash), zap.Error(err))
				continue
			}

			confirmedEvents := make([]*UnconfirmedEvent, 0)
			for _, event := range unconfirmedEvents {
				if event.blockHeader.Height+uint32(event.confirmations) <= currentHeight {
					logger.Info("re-observed event",
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

			if len(confirmedEvents) == 0 {
				continue
			}

			if err := w.handleGovernanceMessages(logger, confirmedEvents); err != nil {
				logger.Error("failed to reobserve transfer message", zap.Error(err))
			}
		}
	}
}

func (w *Watcher) handleGovernanceMessages(logger *zap.Logger, confirmed []*UnconfirmedEvent) error {
	for _, e := range confirmed {
		wormholeMsg, err := e.event.ToWormholeMessage()
		if err != nil {
			logger.Error("invalid wormhole message", zap.Error(err), zap.String("event", e.event.ToString()))
			return err
		}
		skipIfError, err := w.validateGovernanceMessages(wormholeMsg)
		if err != nil && skipIfError {
			logger.Error("ignore invalid governance message", zap.Error(err))
			continue
		}
		if err != nil && !skipIfError {
			logger.Error("failed to validate governance message", zap.Error(err))
			return err
		}
		w.msgChan <- wormholeMsg.toMessagePublication(e.blockHeader)
	}
	return nil
}

func (w *Watcher) getGovernanceEventsByTxId(
	ctx context.Context,
	client *Client,
	address string,
	blockHash string,
	txId string,
) ([]*UnconfirmedEvent, error) {
	events, err := client.GetEventsByTxId(ctx, txId)
	if err != nil {
		return nil, err
	}

	header, err := client.GetBlockHeader(ctx, blockHash)
	if err != nil {
		return nil, err
	}

	unconfirmedEvents := make([]*UnconfirmedEvent, 0)
	for _, event := range events.Events {
		if event.EventIndex != WormholeMessageEventIndex {
			continue
		}
		confirmations, err := event.getConsistencyLevel(w.minConfirmations)
		if err != nil {
			return nil, err
		}
		unconfirmedEvents = append(unconfirmedEvents, &UnconfirmedEvent{
			blockHeader:   header,
			event:         event,
			confirmations: *confirmations,
		})
	}
	return unconfirmedEvents, nil
}
