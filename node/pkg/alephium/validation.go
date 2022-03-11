package alephium

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"math/big"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"go.uber.org/zap"

	// We should not rely on ETH, but some data structures of wormhole use ETH hash
	ethCommon "github.com/ethereum/go-ethereum/common"
)

const transferPayloadId byte = 1

type validator struct {
	governanceContract          string
	tokenBridgeContract         string
	tokenWrapperFactoryContract string

	confirmedC <-chan *ConfirmedMessages
	msgC       chan<- *common.MessagePublication

	remoteChainCache  map[uint16]*Byte32
	tokenWrapperCache map[Byte32]*Byte32

	db *db
}

func newValidator(
	contracts []string,
	confirmedC <-chan *ConfirmedMessages,
	msgC chan<- *common.MessagePublication,
	db *db,
) (*validator, error) {
	if len(contracts) != 3 {
		return nil, fmt.Errorf("expect 3 contracts, but have: %v", contracts)
	}
	return &validator{
		governanceContract:          contracts[0],
		tokenBridgeContract:         contracts[1],
		tokenWrapperFactoryContract: contracts[2],

		confirmedC: confirmedC,
		msgC:       msgC,

		remoteChainCache:  map[uint16]*Byte32{},
		tokenWrapperCache: map[Byte32]*Byte32{},

		db: db,
	}, nil
}

func (v *validator) run(ctx context.Context, errC chan<- error) {
	logger := supervisor.Logger(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case confirmed := <-v.confirmedC:
			batch := newBatch()
			for _, message := range confirmed.messages {
				switch message.event.ContractId {
				case v.governanceContract:
					wormholeMsg, err := WormholeMessageFromEvent(message.event)
					if err != nil {
						logger.Error("invalid wormhole message", zap.Any("fields", message.event.Fields))
						errC <- err
						return
					}
					if !wormholeMsg.isTransferMessage() {
						v.msgC <- wormholeMsg.toMessagePublication(confirmed.blockHeader)
						// we only need to validate transfer message
						continue
					}
					transferMsg := TransferMessageFromBytes(wormholeMsg.payload)
					if err := v.validateTransferMessage(transferMsg); err != nil {
						errC <- err
						logger.Error("invalid wormhole message", zap.Error(err))
						return
					}
					v.msgC <- wormholeMsg.toMessagePublication(confirmed.blockHeader)

				case v.tokenBridgeContract:
					// TODO: handle contract create event

				case v.tokenWrapperFactoryContract:
					// TODO: handle contract create event

				}
			}

			if confirmed.finished {
				batch.updateHeight(confirmed.blockHeader.Height)
			}

			if err := v.db.writeBatch(batch); err != nil {
				errC <- err
				return
			}
		}
	}
}

func (v *validator) validateTransferMessage(transferMsg *TransferMessage) error {
	var contractId *Byte32
	var err error
	if transferMsg.isNativeToken {
		contractId, err = v.getRemoteChain(transferMsg.toChainId)
	} else {
		contractId, err = v.getTokenWrapper(transferMsg.tokenId)
	}

	if err != nil {
		return err
	}
	if !bytes.Equal(contractId[:], transferMsg.senderId[:]) {
		return fmt.Errorf("invalid sender, expect %s, have %s", contractId.ToHex(), transferMsg.senderId.ToHex())
	}
	return nil
}

func (v *validator) getRemoteChain(chainId uint16) (*Byte32, error) {
	if value, ok := v.remoteChainCache[chainId]; ok {
		return value, nil
	}
	contractId, err := v.db.getRemoteChain(chainId)
	if err != nil {
		return nil, err
	}
	v.remoteChainCache[chainId] = &contractId
	return &contractId, nil
}

func (v *validator) getTokenWrapper(tokenId Byte32) (*Byte32, error) {
	if value, ok := v.tokenWrapperCache[tokenId]; ok {
		return value, nil
	}
	contractId, err := v.db.getTokenWrapper(tokenId)
	if err != nil {
		return nil, err
	}
	v.tokenWrapperCache[tokenId] = &contractId
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
	var emitter Byte32
	copy(emitter[:], event.Fields[0].ToByteVec())

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
		emitter:          emitter,
		nonce:            nonce,
		payload:          payload,
		sequence:         sequence,
		consistencyLevel: consistencyLevel,
	}, nil
}

// published message from alephium bridge contract
type TransferMessage struct {
	amount        big.Int
	tokenId       Byte32
	tokenChainId  uint16
	toAddress     Byte32
	toChainId     uint16
	fee           big.Int
	isNativeToken bool
	senderId      Byte32
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

func readByte32(reader *bytes.Reader, byte32 Byte32) {
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
	readByte32(reader, message.tokenId)
	readUint16(reader, &message.tokenChainId)
	readByte32(reader, message.toAddress)
	readUint16(reader, &message.toChainId)
	readBigInt(reader, &message.fee)
	message.isNativeToken = readBool(reader)
	readByte32(reader, message.senderId)
	return &message
}
