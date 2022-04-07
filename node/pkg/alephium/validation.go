package alephium

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"math/big"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"go.uber.org/zap"

	// We should not rely on ETH, but some data structures of wormhole use ETH hash
	ethCommon "github.com/ethereum/go-ethereum/common"
)

const transferPayloadId byte = 1

func (w *Watcher) validateTokenWrapperEvents(ctx context.Context, logger *zap.Logger, client *Client, confirmed *ConfirmedEvents) error {
	if len(confirmed.events) == 0 {
		return nil
	}

	maxIndex := uint64(0)
	batch := newBatch()
	for _, event := range confirmed.events {
		if event.eventIndex > maxIndex {
			maxIndex = event.eventIndex
		}

		info, err := client.GetTokenWrapperInfo(ctx, event.event, w.chainIndex.FromGroup)
		if err != nil {
			logger.Error("failed to get token wrapper info", zap.Error(err))
			return err
		}

		contractId, err := w.getTokenBridgeForChain(info.remoteChainId)
		if err != nil {
			logger.Error("failed to get token bridge for chain contract", zap.Error(err), zap.Uint16("chainId", info.remoteChainId))
			return err
		}
		if !bytes.Equal(info.tokenBridgeForChainId[:], contractId[:]) {
			logger.Error("ignore invalid token wrapper", zap.Error(err))
			continue
		}

		if info.isLocalToken {
			// TODO: check if token wrapper exist
			key := LocalTokenWrapperKey{
				localTokenId:  info.tokenId,
				remoteChainId: info.remoteChainId,
			}
			w.localTokenWrapperCache.Store(key, &info.tokenWrapperId)
			batch.writeLocalTokenWrapper(info.tokenId, info.remoteChainId, info.tokenWrapperAddress)
		} else {
			w.remoteTokenWrapperCache.Store(info.tokenId, &info.tokenWrapperId)
			batch.writeRemoteTokenWrapper(info.tokenId, info.tokenWrapperAddress)
		}
	}
	batch.updateLastTokenWrapperFactoryEventIndex(maxIndex)
	return w.db.writeBatch(batch)
}

func (w *Watcher) validateGovernanceEvents(logger *zap.Logger, confirmed *ConfirmedEvents) error {
	for _, e := range confirmed.events {
		wormholeMsg, err := WormholeMessageFromEvent(e.event)
		if err != nil {
			logger.Error("invalid wormhole message", zap.Any("fields", e.event.Fields))
			return err
		}
		logger.Debug(
			"receive event from alephium contract",
			zap.String("emitter", wormholeMsg.emitter.ToHex()),
			zap.String("payload", hex.EncodeToString(wormholeMsg.payload)),
		)
		emitAddress := toContractAddress(wormholeMsg.emitter)
		if emitAddress != w.tokenBridgeContract {
			// currently only token bridge publish message
			logger.Error("invalid wormhole message, sender is not token bridge", zap.String("sender", emitAddress))
			continue
		}
		if !wormholeMsg.isTransferMessage() {
			w.msgChan <- wormholeMsg.toMessagePublication(e.blockHeader)
			continue
			// we only need to validate transfer message
		}
		transferMsg := TransferMessageFromBytes(wormholeMsg.payload)
		if err := w.validateTransferMessage(transferMsg); err != nil {
			logger.Error("invalid wormhole message, just ignore", zap.Error(err))
			continue
		}
		w.msgChan <- wormholeMsg.toMessagePublication(e.blockHeader)
	}
	return nil
}

func (w *Watcher) validateTransferMessage(transferMsg *TransferMessage) error {
	var contractId *Byte32
	var err error
	if transferMsg.isLocalToken {
		contractId, err = w.getLocalTokenWrapper(transferMsg.tokenId, transferMsg.toChainId)
	} else {
		contractId, err = w.getRemoteTokenWrapper(transferMsg.tokenId)
	}

	if err != nil {
		return err
	}
	if !bytes.Equal(contractId[:], transferMsg.senderId[:]) {
		return fmt.Errorf("invalid sender, expect %s, have %s", contractId.ToHex(), transferMsg.senderId.ToHex())
	}
	return nil
}

func (w *Watcher) validateUndoneSequenceEvents(ctx context.Context, logger *zap.Logger, client *Client, confirmed *ConfirmedEvents) error {
	if len(confirmed.events) == 0 {
		return nil
	}

	maxIndex := uint64(0)
	batch := newBatch()
	for _, e := range confirmed.events {
		if e.eventIndex > maxIndex {
			maxIndex = e.eventIndex
		}

		assume(len(e.event.Fields) == 2)
		contractId, err := e.event.Fields[0].ToByte32()
		if err != nil {
			logger.Error("invalid contract id for undone sequence event", zap.Error(err), zap.Any("contractId", e.event.Fields[0].Value))
			return err
		}

		info, err := w.getTokenBridgeForChainInfo(ctx, client, *contractId)
		if err != nil {
			logger.Error("failed to get token bridge for chain info", zap.Error(err))
			return err
		}
		tokenBridgeForChainId, err := w.getTokenBridgeForChain(info.remoteChainId)
		if err != nil {
			logger.Error("failed to get token bridge for chain id", zap.Error(err))
			return err
		}

		if !bytes.Equal(tokenBridgeForChainId[:], info.contractId[:]) {
			err := fmt.Errorf("invalid token bridge for chain id, expected: %s, have: %s", info.contractId.ToHex(), tokenBridgeForChainId.ToHex())
			logger.Error(err.Error())
			return err
		}
		sequence, err := e.event.Fields[1].ToUint64()
		if err != nil {
			logger.Error("invalid undone sequence", zap.Error(err), zap.Any("sequence", e.event.Fields[1].Value))
			return err
		}
		batch.writeUndoneSequence(info.remoteChainId, sequence)
	}
	batch.updateLastUndoneSequenceEventIndex(maxIndex)
	return w.db.writeBatch(batch)
}

func (w *Watcher) getTokenBridgeForChainInfo(ctx context.Context, client *Client, contractId Byte32) (*tokenBridgeForChainInfo, error) {
	if value, ok := w.tokenBridgeForChainInfoCache.Load(contractId); ok {
		return (value).(*tokenBridgeForChainInfo), nil
	}
	contractAddress := toContractAddress(contractId)
	info, err := client.GetTokenBridgeForChainInfo(ctx, contractAddress, w.chainIndex.FromGroup)
	if err != nil {
		return nil, err
	}
	w.tokenBridgeForChainInfoCache.Store(contractId, info)
	return info, nil
}

func (w *Watcher) getTokenBridgeForChain(chainId uint16) (*Byte32, error) {
	if value, ok := w.tokenBridgeForChainCache.Load(chainId); ok {
		return value.(*Byte32), nil
	}
	contractAddress, err := w.db.getRemoteChain(chainId)
	if err != nil {
		return nil, err
	}
	contractId, err := ToContractId(contractAddress)
	if err != nil {
		return nil, err
	}
	w.tokenBridgeForChainCache.Store(chainId, &contractId)
	return &contractId, nil
}

func (w *Watcher) getRemoteTokenWrapper(tokenId Byte32) (*Byte32, error) {
	if value, ok := w.remoteTokenWrapperCache.Load(tokenId); ok {
		return value.(*Byte32), nil
	}
	contractAddress, err := w.db.GetRemoteTokenWrapper(tokenId)
	if err != nil {
		return nil, err
	}
	contractId, err := ToContractId(contractAddress)
	if err != nil {
		return nil, err
	}
	w.remoteTokenWrapperCache.Store(tokenId, &contractId)
	return &contractId, err
}

func (w *Watcher) getLocalTokenWrapper(tokenId Byte32, remoteChainId uint16) (*Byte32, error) {
	key := LocalTokenWrapperKey{
		localTokenId:  tokenId,
		remoteChainId: remoteChainId,
	}
	if value, ok := w.localTokenWrapperCache.Load(key); ok {
		return value.(*Byte32), nil
	}
	contractAddress, err := w.db.GetLocalTokenWrapper(tokenId, remoteChainId)
	if err != nil {
		return nil, err
	}
	contractId, err := ToContractId(contractAddress)
	if err != nil {
		return nil, err
	}
	w.localTokenWrapperCache.Store(key, &contractId)
	return &contractId, err
}

type WormholeMessage struct {
	event            *Event
	emitter          Byte32
	nonce            uint32
	payload          []byte
	sequence         uint64
	consistencyLevel uint8
}

func (w *WormholeMessage) isTransferMessage() bool {
	return w.payload[0] == transferPayloadId
}

func (w *WormholeMessage) toMessagePublication(header *BlockHeader) *common.MessagePublication {
	second := header.Timestamp / 1000
	milliSecond := header.Timestamp % 1000
	ts := time.Unix(int64(second), int64(milliSecond)*int64(time.Millisecond))

	payload := w.payload
	if w.isTransferMessage() {
		// remove the last 33 bytes from transfer message payload
		payload = w.payload[0 : len(w.payload)-33]
	}

	return &common.MessagePublication{
		TxHash:           ethCommon.HexToHash(w.event.TxId),
		Timestamp:        ts,
		Nonce:            w.nonce,
		Sequence:         w.sequence,
		ConsistencyLevel: w.consistencyLevel,
		EmitterChain:     vaa.ChainIDAlephium,
		EmitterAddress:   vaa.Address(w.emitter),
		Payload:          payload,
	}
}

func WormholeMessageFromEvent(event *Event) (*WormholeMessage, error) {
	assume(len(event.Fields) == 4)
	emitter, err := event.Fields[0].ToByte32()
	if err != nil {
		return nil, err
	}
	sequence, err := event.Fields[1].ToUint64()
	if err != nil {
		return nil, err
	}
	data := event.Fields[2].ToByteVec()

	consistencyLevel, err := event.Fields[3].ToUint8()
	if err != nil {
		return nil, err
	}
	nonce := binary.BigEndian.Uint32(data[0:4])
	payload := data[4:]
	return &WormholeMessage{
		event:            event,
		emitter:          *emitter,
		nonce:            nonce,
		payload:          payload,
		sequence:         sequence,
		consistencyLevel: consistencyLevel,
	}, nil
}

// published message from alephium bridge contract
type TransferMessage struct {
	amount       big.Int
	tokenId      Byte32
	tokenChainId uint16
	toAddress    Byte32
	toChainId    uint16
	fee          big.Int
	isLocalToken bool
	senderId     Byte32
}

func readBigInt(reader *bytes.Reader, num *big.Int) {
	var byte32 Byte32
	size, err := reader.Read(byte32[:])
	assume(size == 32)
	assume(err == nil)
	num.SetBytes(byte32[:])
}

func readUint16(reader *bytes.Reader, num *uint16) {
	err := binary.Read(reader, binary.BigEndian, num)
	assume(err == nil)
}

func readByte32(reader *bytes.Reader, byte32 *Byte32) {
	size, err := reader.Read(byte32[:])
	assume(size == 32)
	assume(err == nil)
}

func readBool(reader *bytes.Reader) bool {
	b, err := reader.ReadByte()
	assume(err == nil)
	return b == 1
}

func TransferMessageFromBytes(data []byte) *TransferMessage {
	assume(data[0] == transferPayloadId)
	reader := bytes.NewReader(data[1:]) // skip the payloadId
	var message TransferMessage
	readBigInt(reader, &message.amount)
	readByte32(reader, &message.tokenId)
	readUint16(reader, &message.tokenChainId)
	readByte32(reader, &message.toAddress)
	readUint16(reader, &message.toChainId)
	readBigInt(reader, &message.fee)
	message.isLocalToken = readBool(reader)
	readByte32(reader, &message.senderId)
	return &message
}
