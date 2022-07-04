package guardiand

import (
	"context"
	"encoding/hex"
	"fmt"
	"io/ioutil"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/mr-tron/base58"
	"github.com/spf13/pflag"

	"github.com/certusone/wormhole/node/pkg/common"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	publicrpcv1 "github.com/certusone/wormhole/node/pkg/proto/publicrpc/v1"
	"github.com/certusone/wormhole/node/pkg/vaa"

	"github.com/spf13/cobra"
	"github.com/status-im/keycard-go/hexutils"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/encoding/prototext"

	nodev1 "github.com/certusone/wormhole/node/pkg/proto/node/v1"
)

var (
	clientSocketPath *string
	shouldBackfill   *bool
)

func init() {
	// Shared flags for all admin commands
	pf := pflag.NewFlagSet("commonAdminFlags", pflag.ContinueOnError)
	clientSocketPath = pf.String("socket", "", "gRPC admin server socket to connect to")
	err := cobra.MarkFlagRequired(pf, "socket")
	if err != nil {
		panic(err)
	}

	shouldBackfill = AdminClientFindMissingMessagesCmd.Flags().Bool(
		"backfill", false, "backfill missing VAAs from public RPC")

	AdminClientInjectGuardianSetUpdateCmd.Flags().AddFlagSet(pf)
	AdminClientFindMissingMessagesCmd.Flags().AddFlagSet(pf)
	AdminClientListNodes.Flags().AddFlagSet(pf)
	DumpVAAByMessageID.Flags().AddFlagSet(pf)
	SendObservationRequest.Flags().AddFlagSet(pf)
	GetDestroyContractsGovernanceMessage.Flags().AddFlagSet(pf)

	AdminCmd.AddCommand(AdminClientInjectGuardianSetUpdateCmd)
	AdminCmd.AddCommand(AdminClientFindMissingMessagesCmd)
	AdminCmd.AddCommand(AdminClientGovernanceVAAVerifyCmd)
	AdminCmd.AddCommand(AdminClientListNodes)
	AdminCmd.AddCommand(DumpVAAByMessageID)
	AdminCmd.AddCommand(SendObservationRequest)
	AdminCmd.AddCommand(GetDestroyContractsGovernanceMessage)
}

var AdminCmd = &cobra.Command{
	Use:   "admin",
	Short: "Guardian node admin commands",
}

var AdminClientInjectGuardianSetUpdateCmd = &cobra.Command{
	Use:   "governance-vaa-inject [FILENAME]",
	Short: "Inject and sign a governance VAA from a prototxt file (see docs!)",
	Run:   runInjectGovernanceVAA,
	Args:  cobra.ExactArgs(1),
}

var AdminClientFindMissingMessagesCmd = &cobra.Command{
	Use:   "find-missing-messages [EMITTER_CHAIN_ID] [EMITTER_ADDRESS_HEX] [TARGET_CHAIN_ID]",
	Short: "Find sequence number gaps for the given chain ID and emitter address",
	Run:   runFindMissingMessages,
	Args:  cobra.ExactArgs(3),
}

var DumpVAAByMessageID = &cobra.Command{
	Use:   "dump-vaa-by-message-id [MESSAGE_ID]",
	Short: "Retrieve a VAA by message ID (chain/emitter/seq) and decode and dump the VAA",
	Run:   runDumpVAAByMessageID,
	Args:  cobra.ExactArgs(1),
}

var SendObservationRequest = &cobra.Command{
	Use:   "send-observation-request [CHAIN_ID|CHAIN_NAME] [TX_HASH_HEX]",
	Short: "Broadcast an observation request for the given chain ID and chain-specific tx_hash",
	Run:   runSendObservationRequest,
	Args:  cobra.ExactArgs(2),
}

var GetDestroyContractsGovernanceMessage = &cobra.Command{
	Use:   "get-destroy-contracts-governance-message [EMITTER_CHAIN_ID] [GOVERNANCE_SEQUENCE] [SEQUENCE_LIST] [FILE_PATH]",
	Short: "Get destroy contracts governance message",
	Run:   runGetDestroyContractsGovernanceMessage,
	Args:  cobra.ExactArgs(4),
}

func getAdminClient(ctx context.Context, addr string) (*grpc.ClientConn, error, nodev1.NodePrivilegedServiceClient) {
	conn, err := grpc.DialContext(ctx, fmt.Sprintf("unix:///%s", addr), grpc.WithInsecure())

	if err != nil {
		log.Fatalf("failed to connect to %s: %v", addr, err)
	}

	c := nodev1.NewNodePrivilegedServiceClient(conn)
	return conn, err, c
}

func getPublicRPCServiceClient(ctx context.Context, addr string) (*grpc.ClientConn, error, publicrpcv1.PublicRPCServiceClient) {
	conn, err := grpc.DialContext(ctx, fmt.Sprintf("unix:///%s", addr), grpc.WithInsecure())

	if err != nil {
		log.Fatalf("failed to connect to %s: %v", addr, err)
	}

	c := publicrpcv1.NewPublicRPCServiceClient(conn)
	return conn, err, c
}

func runInjectGovernanceVAA(cmd *cobra.Command, args []string) {
	path := args[0]
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err, c := getAdminClient(ctx, *clientSocketPath)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get admin client: %v", err)
	}

	b, err := ioutil.ReadFile(path)
	if err != nil {
		log.Fatalf("failed to read file: %v", err)
	}

	var msg nodev1.InjectGovernanceVAARequest
	err = prototext.Unmarshal(b, &msg)
	if err != nil {
		log.Fatalf("failed to deserialize: %v", err)
	}

	resp, err := c.InjectGovernanceVAA(ctx, &msg)
	if err != nil {
		log.Fatalf("failed to submit governance VAA: %v", err)
	}

	for _, digest := range resp.Digests {
		log.Printf("VAA successfully injected with digest %s", hexutils.BytesToHex(digest))
	}
}

func runFindMissingMessages(cmd *cobra.Command, args []string) {
	emitterChainId, err := strconv.Atoi(args[0])
	if err != nil {
		log.Fatalf("invalid emitter chain ID: %v", err)
	}
	emitterAddress := args[1]

	targetChainId, err := strconv.Atoi(args[2])
	if err != nil {
		log.Fatalf("invalid target chain ID: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	conn, err, c := getAdminClient(ctx, *clientSocketPath)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get admin client: %v", err)
	}

	msg := nodev1.FindMissingMessagesRequest{
		EmitterChain:   uint32(emitterChainId),
		TargetChain:    uint32(targetChainId),
		EmitterAddress: emitterAddress,
		RpcBackfill:    *shouldBackfill,
		BackfillNodes:  common.PublicRPCEndpoints,
	}
	resp, err := c.FindMissingMessages(ctx, &msg)
	if err != nil {
		log.Fatalf("failed to run find FindMissingMessages RPC: %v", err)
	}

	for _, id := range resp.MissingMessages {
		fmt.Println(id)
	}
}

func runGetDestroyContractsGovernanceMessage(cmd *cobra.Command, args []string) {
	chainId, err := strconv.Atoi(args[0])
	if err != nil {
		log.Fatalf("invalid chain id: %v", err)
	}
	sequence, err := strconv.ParseUint(args[1], 10, 64)
	if err != nil {
		log.Fatalf("invalid sequence: %v", err)
	}
	sequencesStr := args[2]
	lst := strings.Split(sequencesStr, ",")
	sequences := make([]uint64, 0)
	for _, seqStr := range lst {
		seq, err := strconv.ParseUint(seqStr, 10, 64)
		if err != nil {
			log.Fatalf("invalid sequence: %v", err)
		}
		sequences = append(sequences, seq)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	conn, err, c := getAdminClient(ctx, *clientSocketPath)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get admin client: %v", err)
	}

	request := &nodev1.GetDestroyContractsGovernanceMessageRequest{
		EmitterChain: uint32(chainId),
		Sequence:     sequence,
		Sequences:    sequences,
	}
	resp, err := c.GetDestroyContractsGovernanceMessage(ctx, request)
	if err != nil {
		log.Fatalf("failed to run GenUndoneTransferGovernanceMsg rpc, error: %v", err)
	}

	injectRequest := &nodev1.InjectGovernanceVAARequest{
		CurrentSetIndex: 0, // TODO: pass in through command argument when we update the guardian set
		Messages:        []*nodev1.GovernanceMessage{resp.Msg},
	}
	data, err := prototext.Marshal(injectRequest)
	if err != nil {
		log.Fatalf("failed to serialize the generated governance msg, err: %v", err)
	}
	if err := ioutil.WriteFile(args[3], data, 0644); err != nil {
		log.Fatalf("failed to save the generated msg, err: %v", err)
	}
}

// runDumpVAAByMessageID uses GetSignedVAA to request the given message,
// then decode and dump the VAA.
func runDumpVAAByMessageID(cmd *cobra.Command, args []string) {
	// Parse the {chain,emitter,seq} string.
	parts := strings.Split(args[0], "/")
	if len(parts) != 4 {
		log.Fatalf("invalid message ID: %s", args[0])
	}
	emitterChainId, err := strconv.ParseUint(parts[0], 10, 32)
	if err != nil {
		log.Fatalf("invalid chain ID: %v", err)
	}
	emitterAddress := parts[1]
	targetChainId, err := strconv.ParseUint(parts[2], 10, 32)
	if err != nil {
		log.Fatalf("invalid chain ID: %v", err)
	}
	seq, err := strconv.ParseUint(parts[3], 10, 64)
	if err != nil {
		log.Fatalf("invalid sequence number: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err, c := getPublicRPCServiceClient(ctx, *clientSocketPath)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get public RPC service client: %v", err)
	}

	msg := publicrpcv1.GetSignedVAARequest{
		MessageId: &publicrpcv1.MessageID{
			EmitterChain:   publicrpcv1.ChainID(emitterChainId),
			EmitterAddress: emitterAddress,
			TargetChain:    publicrpcv1.ChainID(targetChainId),
			Sequence:       seq,
		},
	}
	resp, err := c.GetSignedVAA(ctx, &msg)
	if err != nil {
		log.Fatalf("failed to run GetSignedVAA RPC: %v", err)
	}

	v, err := vaa.Unmarshal(resp.VaaBytes)
	if err != nil {
		log.Fatalf("failed to decode VAA: %v", err)
	}

	log.Printf("VAA with digest %s: %+v\n", v.HexDigest(), spew.Sdump(v))
	fmt.Printf("Bytes:\n%s\n", hex.EncodeToString(resp.VaaBytes))
}

func runSendObservationRequest(cmd *cobra.Command, args []string) {
	chainID, err := parseChainID(args[0])
	if err != nil {
		log.Fatalf("invalid chain ID: %v", err)
	}

	txHash, err := hex.DecodeString(args[1])
	if err != nil {
		txHash, err = base58.Decode(args[1])
		if err != nil {
			log.Fatalf("invalid transaction hash (neither hex nor base58): %v", err)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err, c := getAdminClient(ctx, *clientSocketPath)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get admin client: %v", err)
	}

	_, err = c.SendObservationRequest(ctx, &nodev1.SendObservationRequestRequest{
		ObservationRequest: &gossipv1.ObservationRequest{
			ChainId: uint32(chainID),
			TxHash:  txHash,
		},
	})
	if err != nil {
		log.Fatalf("failed to send observation request: %v", err)
	}
}
