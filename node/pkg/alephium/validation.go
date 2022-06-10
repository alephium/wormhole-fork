package alephium

import (
	"bytes"
	"encoding/binary"
	"fmt"

	"github.com/certusone/wormhole/node/pkg/vaa"
)

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

func (w *Watcher) validateTransferMessage(transferMsg *TransferMessage) (bool, error) {
	contractId, err := w.getTokenWrapperId(transferMsg.toChainId, transferMsg.tokenId)
	if err != nil {
		return true, fmt.Errorf("faield to get token wrapper id, err %v", err)
	}
	if !bytes.Equal(contractId[:], transferMsg.tokenWrapperId[:]) {
		return true, fmt.Errorf("invalid sender for transfer message, expect %s, have %s", contractId.ToHex(), transferMsg.tokenWrapperId.ToHex())
	}
	return false, nil
}

func (w *Watcher) getTokenBridgeForChainId(remoteChainId uint16) (*Byte32, error) {
	contractId, ok := w.chainIdToContractId[vaa.ChainID(remoteChainId)]
	if ok {
		return &contractId, nil
	}
	return nil, fmt.Errorf("invalid remote chain id %d", remoteChainId)
}

func (w *Watcher) getRemoteChainId(contractId Byte32) (*uint16, error) {
	value, ok := w.contractIdToChainId[contractId]
	if ok {
		remoteChainId := uint16(value)
		return &remoteChainId, nil
	}
	return nil, fmt.Errorf("invalid contract id %s", contractId.ToHex())
}

func (w *Watcher) getTokenWrapperId(remoteChainId uint16, tokenId Byte32) (*Byte32, error) {
	tokenBridgeForChainId, err := w.getTokenBridgeForChainId(remoteChainId)
	if err != nil {
		return nil, err
	}
	preImage := append(tokenId[:], (*tokenBridgeForChainId)[:]...)
	hash := Byte32(blake2bDoubleHash(preImage))
	return &hash, nil
}
