package alephium

import (
	"context"
	"encoding/hex"
	"sync/atomic"

	sdk "github.com/alephium/go-sdk"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"go.uber.org/zap"
)

func (w *Watcher) handleObsvRequest(ctx context.Context, logger *zap.Logger, client *Client) {
	for {
		select {
		case <-ctx.Done():
			return
		case req := <-w.obsvReqC:
			if req.ChainId != uint32(vaa.ChainIDAlephium) {
				logger.Error("invalid chain id, expect alephium", zap.Uint32("chainId", req.ChainId))
				continue
			}
			if len(req.TxHash) != 32 {
				logger.Error("invalid tx id, expect 32 bytes", zap.Int("haveSize", len(req.TxHash)))
				continue
			}
			txId := hex.EncodeToString(req.TxHash[0:32])
			logger.Debug("handling re-observe request", zap.String("txId", txId))
			txStatus, err := client.GetTransactionStatus(ctx, txId)
			if err != nil {
				logger.Error("failed to get transaction status", zap.String("txId", txId), zap.Error(err))
				continue
			}

			if txStatus.Confirmed == nil {
				logger.Error("tx is not confirmed", zap.Error(err), zap.String("txId", txId))
				continue
			}
			blockHash := txStatus.Confirmed.BlockHash
			events, err := w.getGovernanceEventsByTxId(ctx, logger, client, w.governanceContractAddress, blockHash, txId)
			if err != nil {
				logger.Error("failed to get events from block", zap.String("blockHash", blockHash), zap.Error(err))
				continue
			}
			alphMessagesObserved.Add(float64(len(events)))

			isCanonical, err := client.IsBlockInMainChain(ctx, blockHash)
			if err != nil {
				logger.Error("failed to check mainchain block", zap.String("blockHash", blockHash), zap.Error(err))
				continue
			}
			if !*isCanonical {
				alphMessagesOrphaned.Add(float64(len(events)))
				logger.Info("ignore orphan block", zap.String("blockHash", blockHash))
				continue
			}

			currentHeight := atomic.LoadInt32(&w.currentHeight)
			confirmed := make([]*reobservedEvent, 0)
			for _, event := range events {
				if event.header.Height+int32(event.confirmations) <= currentHeight {
					logger.Info("re-observed event",
						zap.String("txId", txId),
						zap.String("blockHash", blockHash),
						zap.Int32("blockHeight", event.header.Height),
						zap.Int32("currentHeight", currentHeight),
						zap.Uint8("confirmations", event.confirmations),
					)
					alphMessagesConfirmed.Add(float64(len(events)))
					confirmed = append(confirmed, event)
				} else {
					logger.Info("ignore unconfirmed re-observed event",
						zap.String("txId", txId),
						zap.String("blockHash", blockHash),
						zap.Int32("blockHeight", event.header.Height),
						zap.Int32("currentHeight", currentHeight),
						zap.Uint8("confirmations", event.confirmations),
					)
				}
			}

			if len(confirmed) == 0 {
				continue
			}

			if err := w.handleGovernanceMessages(logger, confirmed); err != nil {
				logger.Error("failed to reobserve transfer message", zap.Error(err))
			}
		}
	}
}

func (w *Watcher) handleGovernanceMessages(logger *zap.Logger, confirmed []*reobservedEvent) error {
	for _, e := range confirmed {
		wormholeMsg, err := ToWormholeMessage(e.Fields, e.txId)
		if err != nil {
			logger.Error("invalid wormhole message", zap.Error(err), zap.String("txId", e.txId))
			return err
		}
		if !wormholeMsg.senderId.equalWith(w.tokenBridgeContractId) {
			logger.Error("invalid sender for wormhole message", zap.String("txId", e.txId))
			continue
		}
		w.msgChan <- wormholeMsg.toMessagePublication(e.header)
	}
	return nil
}

func (w *Watcher) getGovernanceEventsByTxId(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	address string,
	blockHash string,
	txId string,
) ([]*reobservedEvent, error) {
	events, err := client.GetEventsByTxId(ctx, txId)
	if err != nil {
		return nil, err
	}

	reobservedEvents := make([]*reobservedEvent, 0)
	for _, event := range events.Events {
		if event.EventIndex != WormholeMessageEventIndex {
			continue
		}

		header, err := client.GetBlockHeader(ctx, event.BlockHash)
		if err != nil {
			return nil, err
		}

		msg, err := ToWormholeMessage(event.Fields, txId)
		if err != nil {
			return nil, err
		}

		if msg.IsAttestTokenVAA() {
			if err = w.validateAttestToken(ctx, msg); err != nil {
				logger.Error("re-observe: ignore invalid attest token event", zap.Error(err))
				continue
			}
		}

		reobservedEvents = append(reobservedEvents, &reobservedEvent{
			&event,
			maxUint8(msg.consistencyLevel, w.minConfirmations),
			header,
			txId,
		})
	}
	return reobservedEvents, nil
}

type reobservedEvent struct {
	*sdk.ContractEventByTxId
	confirmations uint8
	header        *sdk.BlockHeaderEntry
	txId          string
}
