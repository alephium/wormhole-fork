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
	"github.com/dgraph-io/badger/v3"
	"go.uber.org/zap"

	// We should not rely on ETH, but some data structures of wormhole use ETH hash
	ethCommon "github.com/ethereum/go-ethereum/common"
)

const transferPayloadId byte = 1

func (w *Watcher) validateTokenWrapperEvents(
	ctx context.Context,
	logger *zap.Logger,
	confirmed *ConfirmedEvents,
	tokenWrapperInfoGetter func(string) (*tokenWrapperInfo, error),
) error {
	if len(confirmed.events) == 0 {
		return nil
	}

	maxIndex := confirmed.events[0].eventIndex
	batch := newBatch()
	for _, event := range confirmed.events {
		if event.eventIndex > maxIndex {
			maxIndex = event.eventIndex
		}

		address := event.event.Fields[0].ToAddress()
		info, err := tokenWrapperInfoGetter(address)
		if err == ErrInvalidContract {
			logger.Error("invalid sender contract for token wrapper events", zap.String("contractAddress", address))
			continue
		}
		if err != nil {
			logger.Error("failed to get token wrapper info", zap.Error(err))
			return err
		}

		contractId, err := w.getTokenBridgeForChain(info.remoteChainId)
		if err == badger.ErrKeyNotFound {
			logger.Error("token bridge for chain does not exist", zap.Uint16("chainId", info.remoteChainId))
			continue
		}
		if err != nil {
			logger.Error("failed to get token bridge for chain contract", zap.Error(err), zap.Uint16("chainId", info.remoteChainId))
			return err
		}
		if !bytes.Equal(info.tokenBridgeForChainId[:], contractId[:]) {
			logger.Error("ignore invalid token wrapper", zap.Error(err))
			continue
		}

		if info.isLocalToken {
			key := LocalTokenWrapperKey{
				localTokenId:  info.tokenId,
				remoteChainId: info.remoteChainId,
			}
			exist, err := batch.localTokenWrapperExist(&key, w.db)
			if err != nil {
				logger.Error("failed to check if local token wrapper already exist", zap.Error(err))
				return err
			}

			if exist {
				logger.Error("local token wrapper already exist")
				continue
			}

			w.localTokenWrapperCache.Store(key, &info.tokenWrapperId)
			batch.writeLocalTokenWrapper(info.tokenId, info.remoteChainId, info.tokenWrapperId)
		} else {
			w.remoteTokenWrapperCache.Store(info.tokenId, &info.tokenWrapperId)
			batch.writeRemoteTokenWrapper(info.tokenId, info.tokenWrapperId)
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
			logger.Error("invalid contract id for undone sequence event, ignore this event", zap.Error(err), zap.Any("contractId", e.event.Fields[0].Value))
			continue
		}

		info, err := w.getTokenBridgeForChainInfo(ctx, client, *contractId)
		if err == ErrInvalidContract {
			logger.Error("invalid sender contract for undone sequence events", zap.String("contractId", contractId.ToHex()))
			continue
		}
		if err != nil {
			logger.Error("failed to get token bridge for chain info", zap.Error(err))
			return err
		}

		tokenBridgeForChainId, err := w.getTokenBridgeForChain(info.remoteChainId)
		if err != nil {
			logger.Error("failed to get token bridge for chain id", zap.Error(err), zap.Uint16("remoteChainId", info.remoteChainId))
			continue
		}

		if !bytes.Equal(tokenBridgeForChainId[:], info.contractId[:]) {
			logger.Error("invalid undone sequence event sender contract", zap.String("expect", tokenBridgeForChainId.ToHex()), zap.String("have", info.contractId.ToHex()))
			continue
		}
		sequence, err := e.event.Fields[1].ToUint64()
		if err != nil {
			logger.Error("invalid undone sequence", zap.Error(err), zap.Any("sequence", e.event.Fields[1].Value))
			continue
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
	contractId, err := w.db.getRemoteChain(chainId)
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
	assume(len(event.Fields) == 5)
	emitter, err := event.Fields[0].ToByte32()
	if err != nil {
		return nil, err
	}
	sequence, err := event.Fields[1].ToUint64()
	if err != nil {
		return nil, err
	}
	nonceBytes := event.Fields[2].ToByteVec()
	if len(nonceBytes) != 4 {
		return nil, fmt.Errorf("invalid nonce size")
	}
	nonce := binary.BigEndian.Uint32(nonceBytes)
	payload := event.Fields[3].ToByteVec()
	consistencyLevel, err := event.Fields[4].ToUint8()
	if err != nil {
		return nil, err
	}
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

func writeBigInt(buffer *bytes.Buffer, num *big.Int) {
	var byte32 Byte32
	buffer.Write(num.FillBytes(byte32[:]))
}

func writeUint16(buffer *bytes.Buffer, value uint16) {
	data := make([]byte, 2)
	binary.BigEndian.PutUint16(data, value)
	buffer.Write(data)
}

func writeBool(buffer *bytes.Buffer, value bool) {
	if value {
		buffer.WriteByte(1)
	} else {
		buffer.WriteByte(0)
	}
}

func (t *TransferMessage) encode() []byte {
	buffer := new(bytes.Buffer)
	buffer.WriteByte(transferPayloadId)
	writeBigInt(buffer, &t.amount)
	buffer.Write(t.tokenId[:])
	writeUint16(buffer, t.tokenChainId)
	buffer.Write(t.toAddress[:])
	writeUint16(buffer, t.toChainId)
	writeBigInt(buffer, &t.fee)
	writeBool(buffer, t.isLocalToken)
	buffer.Write(t.senderId[:])
	return buffer.Bytes()
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
