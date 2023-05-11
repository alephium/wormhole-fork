package storage

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strconv"

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/mr-tron/base58"
	"go.mongodb.org/mongo-driver/bson/bsontype"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/x/bsonx/bsoncore"
)

type Uint64 uint64

func (u Uint64) MarshalBSONValue() (bsontype.Type, []byte, error) {
	ui64Str := strconv.FormatUint(uint64(u), 10)
	d128, err := primitive.ParseDecimal128(ui64Str)
	return bsontype.Decimal128, bsoncore.AppendDecimal128(nil, d128), err
}

func (u *Uint64) UnmarshalBSONValue(t bsontype.Type, b []byte) error {
	d128, _, ok := bsoncore.ReadDecimal128(b)
	if !ok {
		return errors.New("Uint64 UnmarshalBSONValue error")
	}

	ui64, err := strconv.ParseUint(d128.String(), 10, 64)
	if err != nil {
		return err
	}

	*u = Uint64(ui64)
	return nil
}

type AttestToken struct {
	TokenAddress vaa.Address
	TokenChain   vaa.ChainID
	Decimals     uint8
	Symbol       string
	Name         string
}

type TokenTransfer struct {
	Amount        big.Int
	TokenAddress  vaa.Address
	TokenChain    vaa.ChainID
	TargetAddress []byte
}

func DecodeAttestToken(data []byte) (*AttestToken, error) {
	var attestToken AttestToken
	reader := bytes.NewReader(data[1:])
	if n, err := reader.Read(attestToken.TokenAddress[:]); err != nil || n != 32 {
		return nil, fmt.Errorf("failed to read TokenAddress [%d]: %w", n, err)
	}

	if err := binary.Read(reader, binary.BigEndian, &attestToken.TokenChain); err != nil {
		return nil, fmt.Errorf("failed to read TokenChain: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &attestToken.Decimals); err != nil {
		return nil, fmt.Errorf("failed to read Decimals: %w", err)
	}

	symbolBytes := make([]byte, 32)
	if err := binary.Read(reader, binary.BigEndian, &symbolBytes); err != nil {
		return nil, fmt.Errorf("failed to read Symbol: %w", err)
	}
	attestToken.Symbol = bytesToString(symbolBytes)

	nameBytes := make([]byte, 32)
	if err := binary.Read(reader, binary.BigEndian, &nameBytes); err != nil {
		return nil, fmt.Errorf("failed to read Name: %w", err)
	}
	attestToken.Name = bytesToString(nameBytes)

	return &attestToken, nil
}

func DecodeTokenTransfer(data []byte) (*TokenTransfer, error) {
	var tokenTransfer TokenTransfer
	reader := bytes.NewReader(data[1:])

	amountBytes := make([]byte, 32)
	if err := binary.Read(reader, binary.BigEndian, &amountBytes); err != nil {
		return nil, fmt.Errorf("failed to read Amount: %w", err)
	}
	tokenTransfer.Amount.SetBytes(amountBytes)

	if n, err := reader.Read(tokenTransfer.TokenAddress[:]); err != nil || n != 32 {
		return nil, fmt.Errorf("failed to read OriginAddress: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &tokenTransfer.TokenChain); err != nil {
		return nil, fmt.Errorf("failed to read OriginChain: %w", err)
	}

	var targetAddressSize uint16
	if err := binary.Read(reader, binary.BigEndian, &targetAddressSize); err != nil {
		return nil, fmt.Errorf("failed to read TargetAddressSize: %w", err)
	}

	targetAddress := make([]byte, targetAddressSize)
	if err := binary.Read(reader, binary.BigEndian, &targetAddress); err != nil {
		return nil, fmt.Errorf("failed to read TargetAddress: %w", err)
	}
	tokenTransfer.TargetAddress = targetAddress

	return &tokenTransfer, nil
}

func bytesToString(bs []byte) string {
	return string(bytes.Trim(bs, "\u0000"))
}

func toNativeAddress(chain vaa.ChainID, address vaa.Address) (string, error) {
	switch chain {
	case vaa.ChainIDEthereum, vaa.ChainIDBSC:
		bytes := address[12:]
		addr := fmt.Sprintf("0x%v", hex.EncodeToString(bytes))
		return addr, nil
	case vaa.ChainIDAlephium:
		return base58.Encode(append([]byte{0x00}, address[:]...)), nil
	default:
		return "", fmt.Errorf("unknown address from chain %v", chain)
	}
}
