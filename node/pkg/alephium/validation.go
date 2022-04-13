package alephium

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"fmt"

	"github.com/dgraph-io/badger/v3"
	"go.uber.org/zap"
	// We should not rely on ETH, but some data structures of wormhole use ETH hash
)

func (w *Watcher) validateTokenBridgeForChainCreatedEvents(event *tokenBridgeForChainCreated) (bool, error) {
	if !event.senderId.equalWith(w.tokenBridgeContractId) {
		return true, fmt.Errorf("invalid sender for token bridge for chain created event, expected %v, have %v", w.tokenBridgeContractId.ToHex(), event.senderId.ToHex())
	}
	if err := w.db.addTokenBridgeForChain(event.remoteChainId, event.contractId); err != nil {
		return false, fmt.Errorf("failed to persist token bridge for chain to db, err %v", err)
	}
	if err := w.db.addRemoteChainId(event.contractId, event.remoteChainId); err != nil {
		return false, fmt.Errorf("failed to persist remote chain id to db, err %v", err)
	}
	w.tokenBridgeForChainCache.Store(event.remoteChainId, &event.contractId)
	w.remoteChainIdCache.Store(event.contractId, &event.remoteChainId)
	return false, nil
}

func (w *Watcher) validateUndoneSequencesRemovedEvents(
	event *undoneSequencesRemoved,
	remoteChainIdGetter func(Byte32) (*uint16, error),
) (bool, error) {
	remoteChainId, err := remoteChainIdGetter(event.senderId)
	if err != nil {
		return true, err
	}
	length := len(event.sequences)
	for i := 0; i < length; i += 8 {
		data := event.sequences[i : i+8]
		sequence := binary.BigEndian.Uint64(data)
		if err := w.db.addUndoneSequence(*remoteChainId, sequence); err != nil {
			return true, err
		}
	}
	return false, nil
}

func (w *Watcher) validateUndoneSequenceCompletedEvents(event *undoneSequenceCompleted) (bool, error) {
	if !event.senderId.equalWith(w.tokenBridgeContractId) {
		return true, fmt.Errorf("invalid sender for undone sequence completed event, expected %v, have %v", w.tokenBridgeContractId.ToHex(), event.senderId.ToHex())
	}
	if err := w.db.setSequenceExecuted(event.remoteChainId, event.sequence); err != nil {
		return false, fmt.Errorf("failed to set undone sequence executing, err %v", err)
	}
	return false, nil
}

// return skipIfError, error
func (w *Watcher) validateTokenWrapperCreatedEvent(event *tokenWrapperCreated) (bool, error) {
	if !event.senderId.equalWith(w.tokenWrapperFactoryContractId) {
		err := fmt.Errorf("invalid sender for token wrapper created event, expected %s, have %s", w.tokenWrapperFactoryContractId.ToHex(), event.senderId.ToHex())
		return true, err
	}

	contractId, err := w.getTokenBridgeForChain(event.remoteChainId)
	if err == badger.ErrKeyNotFound {
		err := fmt.Errorf("token bridge for chain does not exist: %v", event.remoteChainId)
		return true, err
	}
	if err != nil {
		err := fmt.Errorf("failed to get token bridge for chain contract, err %v, remoteChainId %v", err, event.remoteChainId)
		return false, err
	}
	if !bytes.Equal(event.tokenBridgeForChainId[:], contractId[:]) {
		err := fmt.Errorf(
			"ignore invalid token wrapper created event, expected %s, have %s",
			event.tokenBridgeForChainId.ToHex(),
			contractId.ToHex(),
		)
		return true, err
	}

	if event.isLocalToken {
		key := LocalTokenWrapperKey{
			localTokenId:  event.tokenId,
			remoteChainId: event.remoteChainId,
		}
		exist, err := w.db.localTokenWrapperExist(&key)
		if err != nil {
			err := fmt.Errorf("failed to check if local token wrapper already exist, err %v", err)
			return false, err
		}

		if exist {
			err := fmt.Errorf("local token wrapper already exist, tokenId %s, remoteChainId %v", event.tokenId.ToHex(), event.remoteChainId)
			return true, err
		}

		w.localTokenWrapperCache.Store(key, &event.tokenWrapperId)
		w.db.addLocalTokenWrapper(&key, event.tokenWrapperId)
	} else {
		w.remoteTokenWrapperCache.Store(event.tokenId, &event.tokenWrapperId)
		w.db.addRemoteTokenWrapper(event.tokenId, event.tokenWrapperId)
	}
	return false, nil
}

func (w *Watcher) validateGovernanceMessages(event *WormholeMessage) (bool, error) {
	if !event.senderId.equalWith(w.tokenBridgeContractId) {
		err := fmt.Errorf("invalid sender for wormhole message, expect %v, have %v", w.tokenBridgeContractId.ToHex(), event.senderId.ToHex())
		return true, err
	}
	if !event.isTransferMessage() {
		// we only need to validate transfer message
		return false, nil
	}
	transferMsg := TransferMessageFromBytes(event.payload)
	return w.validateTransferMessage(transferMsg)
}

func (w *Watcher) handleGovernanceMessages(logger *zap.Logger, confirmed *ConfirmedEvents) error {
	for _, e := range confirmed.events {
		wormholeMsg, err := e.event.toWormholeMessage()
		if err != nil {
			logger.Error("invalid wormhole message", zap.Error(err), zap.String("event", e.event.toString()))
			return err
		}
		logger.Debug(
			"receive event from alephium contract",
			zap.String("emitter", wormholeMsg.senderId.ToHex()),
			zap.String("payload", hex.EncodeToString(wormholeMsg.payload)),
		)
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

func (w *Watcher) validateTransferMessage(transferMsg *TransferMessage) (bool, error) {
	var contractId *Byte32
	var err error
	if transferMsg.isLocalToken {
		contractId, err = w.getLocalTokenWrapper(transferMsg.tokenId, transferMsg.toChainId)
	} else {
		contractId, err = w.getRemoteTokenWrapper(transferMsg.tokenId)
	}

	if err != nil {
		return true, fmt.Errorf("faield to get token wrapper id, err %v", err)
	}
	if !bytes.Equal(contractId[:], transferMsg.tokenWrapperId[:]) {
		return true, fmt.Errorf("invalid sender for transfer message, expect %s, have %s", contractId.ToHex(), transferMsg.tokenWrapperId.ToHex())
	}
	return false, nil
}

func (w *Watcher) getRemoteChainId(contractId Byte32) (*uint16, error) {
	if value, ok := w.remoteChainIdCache.Load(contractId); ok {
		return (value).(*uint16), nil
	}
	remoteChainId, err := w.db.getRemoteChainId(contractId)
	if err != nil {
		return nil, err
	}
	w.remoteChainIdCache.Store(contractId, remoteChainId)
	return remoteChainId, nil
}

func (w *Watcher) getTokenBridgeForChain(chainId uint16) (*Byte32, error) {
	if value, ok := w.tokenBridgeForChainCache.Load(chainId); ok {
		return value.(*Byte32), nil
	}
	contractId, err := w.db.getTokenBridgeForChain(chainId)
	if err != nil {
		return nil, err
	}
	w.tokenBridgeForChainCache.Store(chainId, contractId)
	return contractId, nil
}

func (w *Watcher) getRemoteTokenWrapper(tokenId Byte32) (*Byte32, error) {
	if value, ok := w.remoteTokenWrapperCache.Load(tokenId); ok {
		return value.(*Byte32), nil
	}
	contractId, err := w.db.GetRemoteTokenWrapper(tokenId)
	if err != nil {
		return nil, err
	}
	w.remoteTokenWrapperCache.Store(tokenId, contractId)
	return contractId, err
}

func (w *Watcher) getLocalTokenWrapper(tokenId Byte32, remoteChainId uint16) (*Byte32, error) {
	key := LocalTokenWrapperKey{
		localTokenId:  tokenId,
		remoteChainId: remoteChainId,
	}
	if value, ok := w.localTokenWrapperCache.Load(key); ok {
		return value.(*Byte32), nil
	}
	contractId, err := w.db.GetLocalTokenWrapper(tokenId, remoteChainId)
	if err != nil {
		return nil, err
	}
	w.localTokenWrapperCache.Store(key, contractId)
	return contractId, err
}
