package guardiand

import (
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	"log"
	"math/big"
	"strconv"
	"strings"

	"github.com/btcsuite/btcutil/bech32"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"github.com/ethereum/go-ethereum/common"
	"github.com/mr-tron/base58"
	"github.com/spf13/pflag"
	"github.com/tendermint/tendermint/libs/rand"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/spf13/cobra"
	"google.golang.org/protobuf/encoding/prototext"

	"github.com/certusone/wormhole/node/pkg/devnet"
	nodev1 "github.com/certusone/wormhole/node/pkg/proto/node/v1"
)

var messageFee *string
var transferFeeAmount *string
var transferFeeRecipient *string
var subContractSize *int
var consistencyLevel *int
var refundAddress *string
var setUpdateNumGuardians *int
var templateGuardianIndex *int
var chainID *string
var contractUpgradePayload *string
var address *string
var module *string
var shutdownGuardianKey *string
var shutdownPubKey *string

func init() {
	contractUpgradeFlagSet := pflag.NewFlagSet("upgrade", pflag.ExitOnError)
	contractUpgradePayload = contractUpgradeFlagSet.String("payload", "", "Contract upgrade payload")

	registerChainFlagSet := pflag.NewFlagSet("governance", pflag.ExitOnError)
	address = registerChainFlagSet.String("new-address", "", "New address (hex, base58 or bech32)")

	moduleFlagSet := pflag.NewFlagSet("module", pflag.ExitOnError)
	module = moduleFlagSet.String("module", "", "Module name")

	authProofFlagSet := pflag.NewFlagSet("auth-proof", pflag.ExitOnError)
	shutdownGuardianKey = authProofFlagSet.String("guardian-key", "", "Guardian key to sign proof. File path or hex string")
	shutdownPubKey = authProofFlagSet.String("proof-pub-key", "", "Public key to encode in proof")

	templateGuardianIndex = TemplateCmd.PersistentFlags().Int("idx", 2, "Default current guardian set index")
	chainID = TemplateCmd.PersistentFlags().String("chain-id", "", "Chain ID")

	messageFee = AdminClientUpdateMessageFeeTemplateCmd.Flags().String("fee", "", "New message fee")
	TemplateCmd.AddCommand(AdminClientUpdateMessageFeeTemplateCmd)

	transferFeeFlagSet := pflag.NewFlagSet("transfer-fee", pflag.ExitOnError)
	transferFeeAmount = transferFeeFlagSet.String("amount", "", "Transfer fee amount")
	transferFeeRecipient = transferFeeFlagSet.String("recipient", "", "Transfer fee recipient")
	AdminClientTransferFeeTemplateCmd.Flags().AddFlagSet(transferFeeFlagSet)

	subContractSize = AdminClientTokenBridgeDestroyContractsCmd.Flags().Int("num", 2, "Number of sub contracts in example file")
	TemplateCmd.AddCommand(AdminClientTokenBridgeDestroyContractsCmd)

	consistencyLevel = AdminClientTokenBridgeUpdateConsistencyLevelCmd.Flags().Int("consistency-level", 10, "New consistency level")
	TemplateCmd.AddCommand(AdminClientTokenBridgeUpdateConsistencyLevelCmd)

	refundAddress = AdminClientTokenBridgeUpdateRefundAddressCmd.Flags().String("address", "", "New refund address")
	TemplateCmd.AddCommand(AdminClientTokenBridgeUpdateRefundAddressCmd)

	setUpdateNumGuardians = AdminClientGuardianSetTemplateCmd.Flags().Int("num", 1, "Number of devnet guardians in example file")
	TemplateCmd.AddCommand(AdminClientGuardianSetTemplateCmd)

	AdminClientContractUpgradeTemplateCmd.Flags().AddFlagSet(contractUpgradeFlagSet)
	TemplateCmd.AddCommand(AdminClientContractUpgradeTemplateCmd)

	AdminClientTokenBridgeRegisterChainCmd.Flags().AddFlagSet(registerChainFlagSet)
	AdminClientTokenBridgeRegisterChainCmd.Flags().AddFlagSet(moduleFlagSet)
	TemplateCmd.AddCommand(AdminClientTokenBridgeRegisterChainCmd)

	AdminClientTokenBridgeUpgradeContractCmd.Flags().AddFlagSet(contractUpgradeFlagSet)
	AdminClientTokenBridgeUpgradeContractCmd.Flags().AddFlagSet(moduleFlagSet)
	TemplateCmd.AddCommand(AdminClientTokenBridgeUpgradeContractCmd)

	AdminClientShutdownProofCmd.Flags().AddFlagSet(authProofFlagSet)
	TemplateCmd.AddCommand(AdminClientShutdownProofCmd)
}

var TemplateCmd = &cobra.Command{
	Use:   "template",
	Short: "Guardian governance VAA template commands ",
}

var AdminClientUpdateMessageFeeTemplateCmd = &cobra.Command{
	Use:   "update-message-fee",
	Short: "Generate an update message fee template",
	Run:   runUpdateMessageFeeTemplate,
}

var AdminClientTransferFeeTemplateCmd = &cobra.Command{
	Use:   "transfer-fee",
	Short: "Generate a transfer fee template",
	Run:   runTransferFeeTemplate,
}

var AdminClientGuardianSetTemplateCmd = &cobra.Command{
	Use:   "guardian-set-update",
	Short: "Generate an empty guardian set template",
	Run:   runGuardianSetTemplate,
}

var AdminClientContractUpgradeTemplateCmd = &cobra.Command{
	Use:   "contract-upgrade",
	Short: "Generate an empty contract upgrade template",
	Run:   runContractUpgradeTemplate,
}

var AdminClientTokenBridgeRegisterChainCmd = &cobra.Command{
	Use:   "token-bridge-register-chain",
	Short: "Generate an empty token bridge chain registration template at specified path",
	Run:   runTokenBridgeRegisterChainTemplate,
}

var AdminClientTokenBridgeUpgradeContractCmd = &cobra.Command{
	Use:   "token-bridge-upgrade-contract",
	Short: "Generate an empty token bridge contract upgrade template at specified path",
	Run:   runTokenBridgeUpgradeContractTemplate,
}

var AdminClientTokenBridgeDestroyContractsCmd = &cobra.Command{
	Use:   "destroy-unexecuted-sequence-contracts",
	Short: "Generate a destroy unexecuted sequence contracts template",
	Run:   runDestroyUnexecutedSequenceContractsTemplate,
}

var AdminClientTokenBridgeUpdateConsistencyLevelCmd = &cobra.Command{
	Use:   "update-consistency-level",
	Short: "Generate a update minimal consistency level template",
	Run:   runUpdateConsistencyLevelTemplate,
}

var AdminClientTokenBridgeUpdateRefundAddressCmd = &cobra.Command{
	Use:   "update-refund-address",
	Short: "Generate a update refund address consistency level template",
	Run:   runUpdateRefundAddressTemplate,
}

var AdminClientShutdownProofCmd = &cobra.Command{
	Use:   "shutdown-proof",
	Short: "Generate an auth proof for shutdown voting on behalf of the guardian.",
	Run:   runShutdownProofTemplate,
}

func marshalTemplate(template *nodev1.InjectGovernanceVAARequest) {
	b, err := prototext.MarshalOptions{Multiline: true}.Marshal(template)
	if err != nil {
		panic(err)
	}
	fmt.Print(string(b))
}

func runUpdateMessageFeeTemplate(cmd *cobra.Command, args []string) {
	chainID, err := parseChainID(*chainID)
	if err != nil {
		log.Fatal(err)
	}
	fee, _ := new(big.Int).SetString(*messageFee, 10)
	if fee == nil {
		log.Fatal("invalid message fee")
	}
	m := &nodev1.InjectGovernanceVAARequest{
		CurrentSetIndex: uint32(*templateGuardianIndex),
		Messages: []*nodev1.GovernanceMessage{
			{
				Sequence:      rand.Uint64(),
				Nonce:         rand.Uint32(),
				TargetChainId: uint32(chainID),
				Payload: &nodev1.GovernanceMessage_UpdateMessageFee{
					UpdateMessageFee: &nodev1.UpdateMessageFee{NewMessageFee: hex.EncodeToString(common.LeftPadBytes(fee.Bytes(), 32))},
				},
			},
		},
	}
	marshalTemplate(m)
}

func runTransferFeeTemplate(cmd *cobra.Command, args []string) {
	amount, _ := new(big.Int).SetString(*transferFeeAmount, 10)
	if amount == nil {
		log.Fatal("invalid transfer amount")
	}
	_, err := hex.DecodeString(*transferFeeRecipient)
	if err != nil {
		log.Fatal(err)
	}
	m := &nodev1.InjectGovernanceVAARequest{
		CurrentSetIndex: uint32(*templateGuardianIndex),
		Messages: []*nodev1.GovernanceMessage{
			{
				Sequence:      rand.Uint64(),
				Nonce:         rand.Uint32(),
				TargetChainId: uint32(vaa.ChainIDUnset),
				Payload: &nodev1.GovernanceMessage_TransferFee{
					TransferFee: &nodev1.TransferFee{
						Amount:    hex.EncodeToString(common.LeftPadBytes(amount.Bytes(), 32)),
						Recipient: *transferFeeRecipient,
					},
				},
			},
		},
	}
	marshalTemplate(m)
}

func runGuardianSetTemplate(cmd *cobra.Command, args []string) {
	// Use deterministic devnet addresses as examples in the template, such that this doubles as a test fixture.
	guardians := make([]*nodev1.GuardianSetUpdate_Guardian, *setUpdateNumGuardians)
	for i := 0; i < *setUpdateNumGuardians; i++ {
		k := devnet.InsecureDeterministicEcdsaKeyByIndex(crypto.S256(), uint64(i))
		guardians[i] = &nodev1.GuardianSetUpdate_Guardian{
			Pubkey: crypto.PubkeyToAddress(k.PublicKey).Hex(),
			Name:   fmt.Sprintf("Example validator %d", i),
		}
	}

	m := &nodev1.InjectGovernanceVAARequest{
		CurrentSetIndex: uint32(*templateGuardianIndex),
		Messages: []*nodev1.GovernanceMessage{
			{
				Sequence:      rand.Uint64(),
				Nonce:         rand.Uint32(),
				TargetChainId: uint32(vaa.ChainIDUnset),
				Payload: &nodev1.GovernanceMessage_GuardianSet{
					GuardianSet: &nodev1.GuardianSetUpdate{Guardians: guardians},
				},
			},
		},
	}
	marshalTemplate(m)
}

func validateContractUpgradePayload(str string, targetChain vaa.ChainID) (*string, error) {
	switch targetChain {
	case vaa.ChainIDEthereum:
		address, err := parseAddress(str)
		if err != nil {
			return nil, err
		}
		return &address, nil
	case vaa.ChainIDAlephium:
		payload, err := hex.DecodeString(str)
		if err != nil {
			return nil, err
		}
		hexStr := hex.EncodeToString(payload)
		return &hexStr, err
	default:
		return nil, fmt.Errorf("chain id %v not supported", targetChain)
	}
}

func runContractUpgradeTemplate(cmd *cobra.Command, args []string) {
	chainID, err := parseChainID(*chainID)
	if err != nil {
		log.Fatal(err)
	}
	payload, err := validateContractUpgradePayload(*contractUpgradePayload, chainID)
	if err != nil {
		log.Fatal(err)
	}

	m := &nodev1.InjectGovernanceVAARequest{
		CurrentSetIndex: uint32(*templateGuardianIndex),
		Messages: []*nodev1.GovernanceMessage{
			{
				Sequence:      rand.Uint64(),
				Nonce:         rand.Uint32(),
				TargetChainId: uint32(chainID),
				Payload: &nodev1.GovernanceMessage_ContractUpgrade{
					ContractUpgrade: &nodev1.ContractUpgrade{
						Payload: *payload,
					},
				},
			},
		},
	}
	marshalTemplate(m)
}

func runTokenBridgeRegisterChainTemplate(cmd *cobra.Command, args []string) {
	address, err := parseAddress(*address)
	if err != nil {
		log.Fatal(err)
	}
	chainID, err := parseChainID(*chainID)
	if err != nil {
		log.Fatal(err)
	}

	m := &nodev1.InjectGovernanceVAARequest{
		CurrentSetIndex: uint32(*templateGuardianIndex),
		Messages: []*nodev1.GovernanceMessage{
			{
				Sequence:      rand.Uint64(),
				Nonce:         rand.Uint32(),
				TargetChainId: uint32(vaa.ChainIDUnset),
				Payload: &nodev1.GovernanceMessage_BridgeRegisterChain{
					BridgeRegisterChain: &nodev1.BridgeRegisterChain{
						Module:         *module,
						ChainId:        uint32(chainID),
						EmitterAddress: address,
					},
				},
			},
		},
	}
	marshalTemplate(m)
}

func runTokenBridgeUpgradeContractTemplate(cmd *cobra.Command, args []string) {
	chainID, err := parseChainID(*chainID)
	if err != nil {
		log.Fatal(err)
	}
	payload, err := validateContractUpgradePayload(*contractUpgradePayload, chainID)
	if err != nil {
		log.Fatal(err)
	}

	m := &nodev1.InjectGovernanceVAARequest{
		CurrentSetIndex: uint32(*templateGuardianIndex),
		Messages: []*nodev1.GovernanceMessage{
			{
				Sequence:      rand.Uint64(),
				Nonce:         rand.Uint32(),
				TargetChainId: uint32(chainID),
				Payload: &nodev1.GovernanceMessage_BridgeContractUpgrade{
					BridgeContractUpgrade: &nodev1.BridgeUpgradeContract{
						Module:  *module,
						Payload: *payload,
					},
				},
			},
		},
	}
	marshalTemplate(m)
}

func runDestroyUnexecutedSequenceContractsTemplate(cmd *cobra.Command, args []string) {
	sequences := make([]uint64, 0)
	for i := 0; i < *subContractSize; i++ {
		sequences = append(sequences, uint64(i))
	}
	m := &nodev1.InjectGovernanceVAARequest{
		CurrentSetIndex: uint32(*templateGuardianIndex),
		Messages: []*nodev1.GovernanceMessage{
			{
				Sequence:      rand.Uint64(),
				Nonce:         rand.Uint32(),
				TargetChainId: uint32(vaa.ChainIDAlephium),
				Payload: &nodev1.GovernanceMessage_DestroyUnexecutedSequenceContracts{
					DestroyUnexecutedSequenceContracts: &nodev1.TokenBridgeDestroyUnexecutedSequenceContracts{
						EmitterChain: uint32(vaa.ChainIDUnset),
						Sequences:    sequences,
					},
				},
			},
		},
	}
	marshalTemplate(m)
}

func runUpdateConsistencyLevelTemplate(cmd *cobra.Command, args []string) {
	m := &nodev1.InjectGovernanceVAARequest{
		CurrentSetIndex: uint32(*templateGuardianIndex),
		Messages: []*nodev1.GovernanceMessage{
			{
				Sequence:      rand.Uint64(),
				Nonce:         rand.Uint32(),
				TargetChainId: uint32(vaa.ChainIDAlephium),
				Payload: &nodev1.GovernanceMessage_UpdateMinimalConsistencyLevel{
					UpdateMinimalConsistencyLevel: &nodev1.TokenBridgeUpdateMinimalConsistencyLevel{
						NewConsistencyLevel: uint32(*consistencyLevel),
					},
				},
			},
		},
	}
	marshalTemplate(m)
}

func runUpdateRefundAddressTemplate(cmd *cobra.Command, args []string) {
	_, err := hex.DecodeString(*refundAddress)
	if err != nil {
		log.Fatal(err)
	}

	m := &nodev1.InjectGovernanceVAARequest{
		CurrentSetIndex: uint32(*templateGuardianIndex),
		Messages: []*nodev1.GovernanceMessage{
			{
				Sequence:      rand.Uint64(),
				Nonce:         rand.Uint32(),
				TargetChainId: uint32(vaa.ChainIDAlephium),
				Payload: &nodev1.GovernanceMessage_UpdateRefundAddress{
					UpdateRefundAddress: &nodev1.TokenBridgeUpdateRefundAddress{
						NewRefundAddress: *refundAddress,
					},
				},
			},
		},
	}
	marshalTemplate(m)
}

func runShutdownProofTemplate(cmd *cobra.Command, args []string) {
	// ensure values were passed
	if *shutdownPubKey == "" {
		log.Fatal("--proof-pub-key cannot be blank.")
	}
	if *shutdownGuardianKey == "" {
		log.Fatal("--guardian-key cannot be blank.")
	}

	// load the guardian key that will sign the proof
	var guardianKey *ecdsa.PrivateKey
	var keyErr error
	// check if the key is a hex string
	_, hexDecodeErr := hex.DecodeString(*shutdownGuardianKey)
	if hexDecodeErr == nil {
		guardianKey, keyErr = crypto.HexToECDSA(*shutdownGuardianKey)
	} else {
		// the supplied guardian key is not hex, must be a file path to load
		guardianKey, keyErr = loadGuardianKey(*shutdownGuardianKey)
	}
	if keyErr != nil {
		log.Fatal("failed fetching guardian key.", keyErr)
	}

	// create the payload of the proof
	pubKey := common.HexToAddress(*shutdownPubKey)
	digest := crypto.Keccak256Hash(pubKey.Bytes())

	// sign the payload of the proof
	ethProof, err := crypto.Sign(digest.Bytes(), guardianKey)
	if err != nil {
		log.Fatal("failed creating proof.", err)
	}

	// log the public key in the proof and the public key that signed the proof
	fmt.Printf(
		"The following proof will allow public key \"%v\" to vote on behalf of guardian \"%v\":\n",
		pubKey.Hex(),
		crypto.PubkeyToAddress(guardianKey.PublicKey),
	)

	proofHex := hex.EncodeToString(ethProof)
	fmt.Print(proofHex)
}

// parseAddress parses either a hex-encoded address and returns
// a left-padded 32 byte hex string.
func parseAddress(s string) (string, error) {
	// try base58
	b, err := base58.Decode(s)
	if err == nil {
		return leftPadAddress(b)
	}

	// try bech32
	_, b, err = bech32.Decode(s)
	if err == nil {
		return leftPadAddress(b)
	}

	// try hex
	if len(s) > 2 && strings.ToLower(s[:2]) == "0x" {
		s = s[2:]
	}

	a, err := hex.DecodeString(s)
	if err != nil {
		return "", fmt.Errorf("invalid hex address: %v", err)
	}
	return leftPadAddress(a)
}

func leftPadAddress(a []byte) (string, error) {
	if len(a) > 32 {
		return "", fmt.Errorf("address longer than 32 bytes")
	}
	return hex.EncodeToString(common.LeftPadBytes(a, 32)), nil
}

// parseChainID parses a human-readable chain name or a chain ID.
func parseChainID(name string) (vaa.ChainID, error) {
	s, err := vaa.ChainIDFromString(name)
	if err == nil {
		return s, nil
	}

	// parse as uint32
	i, err := strconv.ParseUint(name, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("failed to parse as name or uint32: %v", err)
	}

	return vaa.ChainID(i), nil
}
