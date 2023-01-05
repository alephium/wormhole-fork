package p

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"log"
	"strings"

	"cloud.google.com/go/bigtable"
	"cloud.google.com/go/pubsub"
	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/holiman/uint256"
)

type PubSubMessage struct {
	Data []byte `json:"data"`
}

type Emitters struct {
	TokenTransferEmitters map[string]string
	NFTEmitters           map[string]string
}

// this address is an emitter for BSC and Polygon.
var sharedEmitterAddress = "0000000000000000000000005a58505a96d1dbf8df91cb21b54419fc36e93fde"

type (
	TokenTransfer struct {
		PayloadId     uint8
		Amount        uint256.Int
		OriginAddress [32]byte
		OriginChain   uint16
		TargetAddress []byte
	}
	NFTTransfer struct {
		PayloadId     uint8
		OriginAddress [32]byte
		OriginChain   uint16
		Symbol        [32]byte
		Name          [32]byte
		TokenId       uint256.Int
		URI           []byte
		TargetAddress [32]byte
	}
	AssetMeta struct {
		PayloadId    uint8
		TokenAddress [32]byte
		TokenChain   uint16
		Decimals     uint8
		Symbol       [32]byte
		Name         [32]byte
	}
)

func DecodeTokenTransfer(data []byte) (*TokenTransfer, error) {
	tt := &TokenTransfer{}
	tt.PayloadId = data[0]

	reader := bytes.NewReader(data[1:])

	if err := binary.Read(reader, binary.BigEndian, &tt.Amount); err != nil {
		return nil, fmt.Errorf("failed to read Amount: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &tt.OriginAddress); err != nil {
		return nil, fmt.Errorf("failed to read OriginAddress: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &tt.OriginChain); err != nil {
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
	tt.TargetAddress = targetAddress

	return tt, nil
}
func DecodeNFTTransfer(data []byte) (*NFTTransfer, error) {
	nt := &NFTTransfer{}
	nt.PayloadId = data[0]

	reader := bytes.NewReader(data[1:])

	if err := binary.Read(reader, binary.BigEndian, &nt.OriginAddress); err != nil {
		return nil, fmt.Errorf("failed to read OriginAddress: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &nt.OriginChain); err != nil {
		return nil, fmt.Errorf("failed to read OriginChain: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &nt.Symbol); err != nil {
		return nil, fmt.Errorf("failed to read Symbol: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &nt.Name); err != nil {
		return nil, fmt.Errorf("failed to read Name: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &nt.TokenId); err != nil {
		return nil, fmt.Errorf("failed to read TokenId: %w", err)
	}

	// uri len
	uriLen, er := reader.ReadByte()
	if er != nil {
		return nil, fmt.Errorf("failed to read URI length")
	}

	// uri
	uri := make([]byte, int(uriLen))
	n, err := reader.Read(uri)
	if err != nil || n == 0 {
		return nil, fmt.Errorf("failed to read uri [%d]: %w", n, err)
	}
	nt.URI = uri[:n]

	if err := binary.Read(reader, binary.BigEndian, &nt.TargetAddress); err != nil {
		return nil, fmt.Errorf("failed to read : %w", err)
	}

	return nt, nil
}

func DecodeAssetMeta(data []byte) (*AssetMeta, error) {
	am := &AssetMeta{}
	am.PayloadId = data[0]

	reader := bytes.NewReader(data[1:])

	tokenAddress := [32]byte{}
	if n, err := reader.Read(tokenAddress[:]); err != nil || n != 32 {
		return nil, fmt.Errorf("failed to read TokenAddress [%d]: %w", n, err)
	}
	am.TokenAddress = tokenAddress

	if err := binary.Read(reader, binary.BigEndian, &am.TokenChain); err != nil {
		return nil, fmt.Errorf("failed to read TokenChain: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &am.Decimals); err != nil {
		return nil, fmt.Errorf("failed to read Decimals: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &am.Symbol); err != nil {
		return nil, fmt.Errorf("failed to read Symbol: %w", err)
	}

	if err := binary.Read(reader, binary.BigEndian, &am.Name); err != nil {
		return nil, fmt.Errorf("failed to read Name: %w", err)
	}

	return am, nil
}

// TEMP: until this https://forge.certus.one/c/wormhole/+/1850 lands
func MakeRowKey(emitterChain vaa.ChainID, emitterAddress vaa.Address, targetChain vaa.ChainID, sequence uint64) string {
	// left-pad the sequence with zeros to 16 characters, because bigtable keys are stored lexicographically
	return fmt.Sprintf("%d:%s:%d:%016d", emitterChain, emitterAddress, targetChain, sequence)
}
func writePayloadToBigTable(ctx context.Context, rowKey string, colFam string, mutation *bigtable.Mutation, forceWrite bool) error {
	mut := mutation
	if !forceWrite {
		filter := bigtable.ChainFilters(
			bigtable.FamilyFilter(colFam),
			bigtable.ColumnFilter("PayloadId"))
		mut = bigtable.NewCondMutation(filter, nil, mutation)
	}

	err := tbl.Apply(ctx, rowKey, mut)
	if err != nil {
		log.Printf("Failed to write payload for %v to BigTable. err: %v", rowKey, err)
		return err
	}
	return nil
}
func TrimUnicodeFromByteArray(b []byte) []byte {
	// Escaped Unicode that has been observed in payload's token names and symbol:
	null := "\u0000"
	start := "\u0002"
	ack := "\u0006"
	tab := "\u0009"
	control := "\u0012"
	return bytes.Trim(b, null+start+ack+tab+control)
}

func addReceiverAddressToMutation(mut *bigtable.Mutation, ts bigtable.Timestamp, chainID uint16, hexAddress string) {
	nativeAddress := transformHexAddressToNative(vaa.ChainID(chainID), hexAddress)
	if vaa.ChainID(chainID) == vaa.ChainIDSolana {
		nativeAddress = fetchSolanaAccountOwner(nativeAddress)
	}
	if nativeAddress != "" {
		mut.Set(columnFamilies[6], "ReceiverAddress", ts, []byte(nativeAddress))
	}
}

func loadTokenTransferEmitters() (map[string]string, error) {
	networks := []string{"mainnet", "devnet", "testnet"}
	emitters := make(map[string]string)
	for _, network := range networks {
		configs, err := common.ReadConfigsByNetwork(network)
		if err != nil {
			return nil, err
		}
		emitters[configs.Alephium.TokenBridgeEmitterAddress] = configs.Alephium.Contracts.TokenBridge
		emitters[configs.Ethereum.TokenBridgeEmitterAddress] = configs.Ethereum.Contracts.TokenBridge
	}
	return emitters, nil
}

// ProcessVAA is triggered by a PubSub message, emitted after row is saved to BigTable by guardiand
func ProcessVAA(ctx context.Context, m PubSubMessage, emitters *Emitters) error {
	data := string(m.Data)
	if data == "" {
		return fmt.Errorf("no data to process in message")
	}

	signedVaa, err := vaa.Unmarshal(m.Data)
	if err != nil {
		log.Println("failed Unmarshaling VAA")
		return err
	}

	// create the bigtable identifier from the VAA data
	rowKey := MakeRowKey(signedVaa.EmitterChain, signedVaa.EmitterAddress, signedVaa.TargetChain, signedVaa.Sequence)
	emitterHex := strings.ToLower(signedVaa.EmitterAddress.String())
	payloadId := int(signedVaa.Payload[0])

	// BSC and Polygon have the same contract address: "0x5a58505a96d1dbf8df91cb21b54419fc36e93fde".
	// The BSC contract is the NFT emitter address.
	// The Polygon contract is the token transfer emitter address.
	// Due to that, ensure that the block below only runs for token transfers by checking for chain == 4 and emitter addaress.
	if _, ok := emitters.TokenTransferEmitters[emitterHex]; ok && !(signedVaa.EmitterChain == 4 && signedVaa.EmitterAddress.String() == sharedEmitterAddress) {
		// figure out if it's a transfer or asset metadata

		if payloadId == 1 {
			// token transfer
			payload, decodeErr := DecodeTokenTransfer(signedVaa.Payload)
			if decodeErr != nil {
				log.Println("failed decoding payload for row ", rowKey)
				return decodeErr
			}
			log.Printf("Processing Transfer: Amount %v\n", fmt.Sprint(payload.Amount[3]))

			// save payload to bigtable, then publish a new PubSub message for further processing
			colFam := columnFamilies[2]
			mutation := bigtable.NewMutation()
			ts := bigtable.Now()
			mutation.Set(colFam, "PayloadId", ts, []byte(fmt.Sprint(payload.PayloadId)))
			// TODO: find a better way of representing amount as a string
			amount := []byte(fmt.Sprint(payload.Amount[3]))
			if payload.Amount[2] != 0 {
				log.Printf("payload.Amount is larger than uint64 for row %v", rowKey)
				amount = payload.Amount.Bytes()
			}
			targetAddressHex := hex.EncodeToString(payload.TargetAddress[:])
			mutation.Set(colFam, "Amount", ts, amount)
			mutation.Set(colFam, "OriginAddress", ts, []byte(hex.EncodeToString(payload.OriginAddress[:])))
			mutation.Set(colFam, "OriginChain", ts, []byte(fmt.Sprint(payload.OriginChain)))
			mutation.Set(colFam, "TargetAddress", ts, []byte(targetAddressHex))

			addReceiverAddressToMutation(mutation, ts, uint16(signedVaa.TargetChain), targetAddressHex)

			writeErr := writePayloadToBigTable(ctx, rowKey, colFam, mutation, false)
			if writeErr != nil {
				return writeErr
			}

			// now that the payload is saved to BigTable,
			// pass along the message to the topic that will calculate TokenTransferDetails
			pubSubTokenTransferDetailsTopic.Publish(ctx, &pubsub.Message{Data: m.Data})
		} else if payloadId == 2 {
			// asset meta
			payload, decodeErr := DecodeAssetMeta(signedVaa.Payload)
			if decodeErr != nil {
				log.Println("failed decoding payload for row ", rowKey)
				return decodeErr
			}

			addressHex := hex.EncodeToString(payload.TokenAddress[:])
			chainID := vaa.ChainID(payload.TokenChain)
			nativeAddress := transformHexAddressToNative(chainID, addressHex)
			name := string(TrimUnicodeFromByteArray(payload.Name[:]))
			symbol := string(TrimUnicodeFromByteArray(payload.Symbol[:]))

			// find the CoinGecko id of this token
			coinGeckoCoinId, foundSymbol, foundName := fetchCoinGeckoCoinId(chainID, nativeAddress, symbol, name)

			// populate the symbol & name if they were blank, and we found values
			if symbol == "" && foundSymbol != "" {
				symbol = foundSymbol
			}
			if name == "" && foundName != "" {
				name = foundName
			}

			log.Printf("Processing AssetMeta: Name %v, Symbol %v, coingeckoId %v\n", name, symbol, coinGeckoCoinId)

			// save payload to bigtable
			colFam := columnFamilies[3]
			mutation := bigtable.NewMutation()
			ts := bigtable.Now()

			mutation.Set(colFam, "PayloadId", ts, []byte(fmt.Sprint(payload.PayloadId)))
			mutation.Set(colFam, "TokenAddress", ts, []byte(addressHex))
			mutation.Set(colFam, "TokenChain", ts, []byte(fmt.Sprint(payload.TokenChain)))
			mutation.Set(colFam, "Decimals", ts, []byte(fmt.Sprint(payload.Decimals)))
			mutation.Set(colFam, "Name", ts, []byte(name))
			mutation.Set(colFam, "Symbol", ts, []byte(symbol))
			mutation.Set(colFam, "CoinGeckoCoinId", ts, []byte(coinGeckoCoinId))
			mutation.Set(colFam, "NativeAddress", ts, []byte(nativeAddress))

			writeErr := writePayloadToBigTable(ctx, rowKey, colFam, mutation, false)
			return writeErr
		} else {
			// unknown payload type
			log.Println("encountered unknown payload type for row ", rowKey)
			return nil
		}
	} else if _, ok := emitters.NFTEmitters[emitterHex]; ok {
		if payloadId == 1 {
			// NFT transfer
			payload, decodeErr := DecodeNFTTransfer(signedVaa.Payload)
			if decodeErr != nil {
				log.Println("failed decoding payload for row ", rowKey)
				return decodeErr
			}
			log.Printf("Processing NTF: Name %v, Symbol %v\n", string(TrimUnicodeFromByteArray(payload.Name[:])), string(TrimUnicodeFromByteArray(payload.Symbol[:])))

			// save payload to bigtable
			colFam := columnFamilies[4]
			mutation := bigtable.NewMutation()
			ts := bigtable.Now()

			targetAddressHex := hex.EncodeToString(payload.TargetAddress[:])
			mutation.Set(colFam, "PayloadId", ts, []byte(fmt.Sprint(payload.PayloadId)))
			mutation.Set(colFam, "OriginAddress", ts, []byte(hex.EncodeToString(payload.OriginAddress[:])))
			mutation.Set(colFam, "OriginChain", ts, []byte(fmt.Sprint(payload.OriginChain)))
			mutation.Set(colFam, "Symbol", ts, TrimUnicodeFromByteArray(payload.Symbol[:]))
			mutation.Set(colFam, "Name", ts, TrimUnicodeFromByteArray(payload.Name[:]))
			mutation.Set(colFam, "TokenId", ts, payload.TokenId.Bytes())
			mutation.Set(colFam, "URI", ts, TrimUnicodeFromByteArray(payload.URI))
			mutation.Set(colFam, "TargetAddress", ts, []byte(targetAddressHex))

			addReceiverAddressToMutation(mutation, ts, uint16(signedVaa.TargetChain), targetAddressHex)

			writeErr := writePayloadToBigTable(ctx, rowKey, colFam, mutation, false)
			return writeErr
		} else {
			// unknown payload type
			log.Println("encountered unknown payload type for row ", rowKey)
			return nil
		}
	}

	// this is not a payload we are ready to decode & save. return success
	return nil
}
