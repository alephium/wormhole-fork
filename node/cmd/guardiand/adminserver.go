package guardiand

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/rand"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/certusone/wormhole/node/pkg/db"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	publicrpcv1 "github.com/certusone/wormhole/node/pkg/proto/publicrpc/v1"
	"github.com/certusone/wormhole/node/pkg/publicrpc"
	ethcommon "github.com/ethereum/go-ethereum/common"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/certusone/wormhole/node/pkg/common"
	nodev1 "github.com/certusone/wormhole/node/pkg/proto/node/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	"github.com/certusone/wormhole/node/pkg/vaa"
)

type nodePrivilegedService struct {
	nodev1.UnimplementedNodePrivilegedServiceServer
	db           *db.Database
	injectC      chan<- *vaa.VAA
	obsvReqSendC chan *gossipv1.ObservationRequest
	logger       *zap.Logger
	signedInC    chan *gossipv1.SignedVAAWithQuorum
}

// adminGuardianSetUpdateToVAA converts a nodev1.GuardianSetUpdate message to its canonical VAA representation.
// Returns an error if the data is invalid.
func adminGuardianSetUpdateToVAA(req *nodev1.GuardianSetUpdate, timestamp time.Time, guardianSetIndex uint32, nonce uint32, sequence uint64, targetChainId vaa.ChainID) (*vaa.VAA, error) {
	if len(req.Guardians) == 0 {
		return nil, errors.New("empty guardian set specified")
	}

	if len(req.Guardians) > common.MaxGuardianCount {
		return nil, fmt.Errorf("too many guardians - %d, maximum is %d", len(req.Guardians), common.MaxGuardianCount)
	}

	addrs := make([]ethcommon.Address, len(req.Guardians))
	for i, g := range req.Guardians {
		if !ethcommon.IsHexAddress(g.Pubkey) {
			return nil, fmt.Errorf("invalid pubkey format at index %d (%s)", i, g.Name)
		}

		ethAddr := ethcommon.HexToAddress(g.Pubkey)
		for j, pk := range addrs {
			if pk == ethAddr {
				return nil, fmt.Errorf("duplicate pubkey at index %d (duplicate of %d): %s", i, j, g.Name)
			}
		}

		addrs[i] = ethAddr
	}

	v := vaa.CreateGovernanceVAA(timestamp, nonce, sequence, targetChainId, guardianSetIndex,
		vaa.BodyGuardianSetUpdate{
			Keys:     addrs,
			NewIndex: guardianSetIndex + 1,
		}.Serialize())

	return v, nil
}

// adminUpdateMessageFeeToVAA converts a nodev1.UpdateMessageFee message to its canonical VAA representation.
// Returns an error if the data is invalid.
func adminUpdateMessageFeeToVAA(req *nodev1.UpdateMessageFee, timestamp time.Time, guardianSetIndex uint32, nonce uint32, sequence uint64, targetChainId vaa.ChainID) (*vaa.VAA, error) {
	if len(req.NewMessageFee) != 32 {
		return nil, errors.New("invalid new message fee")
	}

	messageFee, err := hex.DecodeString(req.NewMessageFee)
	if err != nil {
		return nil, errors.New("invalid message fee encoding (expected hex)")
	}
	v := vaa.CreateGovernanceVAA(timestamp, nonce, sequence, targetChainId, guardianSetIndex,
		vaa.BodyUpdateMessageFee{
			NewMessageFee: messageFee,
		}.Serialize())

	return v, nil
}

func adminTransferFeeToVAA(req *nodev1.TransferFee, timestamp time.Time, guardianSetIndex uint32, nonce uint32, sequence uint64, targetChainId vaa.ChainID) (*vaa.VAA, error) {
	if len(req.Amount) != 32 {
		return nil, errors.New("invalid transfer amount")
	}
	if len(req.Recipient) != 32 {
		return nil, errors.New("invalid recipient address")
	}
	amount, err := hex.DecodeString(req.Amount)
	if err != nil {
		return nil, errors.New("invalid amount encoding (expected hex)")
	}
	recipient, err := hex.DecodeString(req.Recipient)
	if err != nil {
		return nil, errors.New("invalid recipient encoding (expected hex)")
	}
	v := vaa.CreateGovernanceVAA(timestamp, nonce, sequence, targetChainId, guardianSetIndex,
		vaa.BodyTransferFee{
			Amount:    amount,
			Recipient: recipient,
		}.Serialize())
	return v, nil
}

// adminContractUpgradeToVAA converts a nodev1.ContractUpgrade message to its canonical VAA representation.
// Returns an error if the data is invalid.
func adminContractUpgradeToVAA(req *nodev1.ContractUpgrade, timestamp time.Time, guardianSetIndex uint32, nonce uint32, sequence uint64, targetChainId vaa.ChainID) (*vaa.VAA, error) {
	payload, err := hex.DecodeString(req.Payload)
	if err != nil {
		return nil, errors.New("invalid payload encoding (expected hex)")
	}
	v := vaa.CreateGovernanceVAA(timestamp, nonce, sequence, targetChainId, guardianSetIndex,
		vaa.BodyContractUpgrade{
			Payload: payload,
		}.Serialize())

	return v, nil
}

// tokenBridgeRegisterChain converts a nodev1.TokenBridgeRegisterChain message to its canonical VAA representation.
// Returns an error if the data is invalid.
func tokenBridgeRegisterChain(req *nodev1.BridgeRegisterChain, timestamp time.Time, guardianSetIndex uint32, nonce uint32, sequence uint64, targetChainId vaa.ChainID) (*vaa.VAA, error) {
	if req.ChainId > math.MaxUint16 {
		return nil, errors.New("invalid chain_id")
	}

	b, err := hex.DecodeString(req.EmitterAddress)
	if err != nil {
		return nil, errors.New("invalid emitter address encoding (expected hex)")
	}

	if len(b) != 32 {
		return nil, errors.New("invalid emitter address (expected 32 bytes)")
	}

	emitterAddress := vaa.Address{}
	copy(emitterAddress[:], b)

	v := vaa.CreateGovernanceVAA(timestamp, nonce, sequence, targetChainId, guardianSetIndex,
		vaa.BodyTokenBridgeRegisterChain{
			Module:         req.Module,
			ChainID:        vaa.ChainID(req.ChainId),
			EmitterAddress: emitterAddress,
		}.Serialize())

	return v, nil
}

// tokenBridgeUpgradeContract converts a nodev1.BridgeUpgradeContract message to its canonical VAA representation.
// Returns an error if the data is invalid.
func tokenBridgeUpgradeContract(req *nodev1.BridgeUpgradeContract, timestamp time.Time, guardianSetIndex uint32, nonce uint32, sequence uint64, targetChainId vaa.ChainID) (*vaa.VAA, error) {
	payload, err := hex.DecodeString(req.Payload)
	if err != nil {
		return nil, errors.New("invalid payload encoding (expected hex)")
	}
	v := vaa.CreateGovernanceVAA(timestamp, nonce, sequence, targetChainId, guardianSetIndex,
		vaa.BodyTokenBridgeUpgradeContract{
			Module:  req.Module,
			Payload: payload,
		}.Serialize())

	return v, nil
}

func tokenBridgeDestroyContracts(req *nodev1.TokenBridgeDestroyUnexecutedSequenceContracts, timestamp time.Time, guardianSetIndex, nonce uint32, sequence uint64, targetChainId vaa.ChainID) (*vaa.VAA, error) {
	v := vaa.CreateGovernanceVAA(timestamp, nonce, sequence, targetChainId, guardianSetIndex,
		vaa.BodyTokenBridgeDestroyContracts{
			EmitterChain: vaa.ChainID(req.EmitterChain),
			Sequences:    req.Sequences,
		}.Serialize())

	return v, nil
}

func tokenBridgeUpdateMinimalConsistencyLevel(req *nodev1.TokenBridgeUpdateMinimalConsistencyLevel, timestamp time.Time, guardianSetIndex, nonce uint32, sequence uint64, targetChainId vaa.ChainID) (*vaa.VAA, error) {
	v := vaa.CreateGovernanceVAA(timestamp, nonce, sequence, targetChainId, guardianSetIndex,
		vaa.BodyTokenBridgeUpdateMinimalConsistencyLevel{
			NewConsistencyLevel: uint8(req.NewConsistencyLevel),
		}.Serialize())
	return v, nil
}

func TokenBridgeUpdateRefundAddress(req *nodev1.TokenBridgeUpdateRefundAddress, timestamp time.Time, guardianSetIndex, nonce uint32, sequence uint64, targetChainId vaa.ChainID) (*vaa.VAA, error) {
	address, err := hex.DecodeString(req.NewRefundAddress)
	if err != nil {
		return nil, errors.New("invalid refund address encoding (expected hex)")
	}
	v := vaa.CreateGovernanceVAA(timestamp, nonce, sequence, targetChainId, guardianSetIndex,
		vaa.BodyTokenBridgeUpdateRefundAddress{
			NewRefundAddress: address,
		}.Serialize())
	return v, nil
}

func (s *nodePrivilegedService) InjectGovernanceVAA(ctx context.Context, req *nodev1.InjectGovernanceVAARequest) (*nodev1.InjectGovernanceVAAResponse, error) {
	s.logger.Info("governance VAA injected via admin socket", zap.String("request", req.String()))

	var (
		v   *vaa.VAA
		err error
	)

	timestamp := time.Unix(int64(req.Timestamp), 0)

	digests := make([][]byte, len(req.Messages))

	for i, message := range req.Messages {
		if message.TargetChainId > math.MaxUint16 {
			return nil, fmt.Errorf("invalid target chain id: %d", message.TargetChainId)
		}
		targetChainId := vaa.ChainID(message.TargetChainId)
		switch payload := message.Payload.(type) {
		case *nodev1.GovernanceMessage_UpdateMessageFee:
			v, err = adminUpdateMessageFeeToVAA(payload.UpdateMessageFee, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_TransferFee:
			v, err = adminTransferFeeToVAA(payload.TransferFee, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_GuardianSet:
			v, err = adminGuardianSetUpdateToVAA(payload.GuardianSet, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_ContractUpgrade:
			v, err = adminContractUpgradeToVAA(payload.ContractUpgrade, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_BridgeRegisterChain:
			v, err = tokenBridgeRegisterChain(payload.BridgeRegisterChain, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_BridgeContractUpgrade:
			v, err = tokenBridgeUpgradeContract(payload.BridgeContractUpgrade, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_DestroyUnexecutedSequenceContracts:
			v, err = tokenBridgeDestroyContracts(payload.DestroyUnexecutedSequenceContracts, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_UpdateMinimalConsistencyLevel:
			v, err = tokenBridgeUpdateMinimalConsistencyLevel(payload.UpdateMinimalConsistencyLevel, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		case *nodev1.GovernanceMessage_UpdateRefundAddress:
			v, err = TokenBridgeUpdateRefundAddress(payload.UpdateRefundAddress, timestamp, req.CurrentSetIndex, message.Nonce, message.Sequence, targetChainId)
		default:
			panic(fmt.Sprintf("unsupported VAA type: %T", payload))
		}
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}

		// Generate digest of the unsigned VAA.
		digest := v.SigningMsg()

		s.logger.Info("governance VAA constructed",
			zap.Any("vaa", v),
			zap.String("digest", digest.String()),
		)

		s.injectC <- v

		digests[i] = digest.Bytes()
	}

	return &nodev1.InjectGovernanceVAAResponse{Digests: digests}, nil
}

// fetchMissing attempts to backfill a gap by fetching and storing missing signed VAAs from the network.
// Returns true if the gap was filled, false otherwise.
func (s *nodePrivilegedService) fetchMissing(
	ctx context.Context,
	nodes []string,
	c *http.Client,
	chain vaa.ChainID,
	addr string,
	seq uint64) (bool, error) {

	// shuffle the list of public RPC endpoints
	rand.Shuffle(len(nodes), func(i, j int) {
		nodes[i], nodes[j] = nodes[j], nodes[i]
	})

	ctx, cancel := context.WithTimeout(ctx, time.Second)
	defer cancel()

	for _, node := range nodes {
		req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf(
			"%s/v1/signed_vaa/%d/%s/%d", node, chain, addr, seq), nil)
		if err != nil {
			return false, fmt.Errorf("failed to create request: %w", err)
		}

		resp, err := c.Do(req)
		if err != nil {
			s.logger.Warn("failed to fetch missing VAA",
				zap.String("node", node),
				zap.String("chain", chain.String()),
				zap.String("address", addr),
				zap.Uint64("sequence", seq),
				zap.Error(err),
			)
			continue
		}

		switch resp.StatusCode {
		case http.StatusNotFound:
			resp.Body.Close()
			continue
		case http.StatusOK:
			type getVaaResp struct {
				VaaBytes string `json:"vaaBytes"`
			}
			var respBody getVaaResp
			if err := json.NewDecoder(resp.Body).Decode(&respBody); err != nil {
				resp.Body.Close()
				s.logger.Warn("failed to decode VAA response",
					zap.String("node", node),
					zap.String("chain", chain.String()),
					zap.String("address", addr),
					zap.Uint64("sequence", seq),
					zap.Error(err),
				)
				continue
			}

			// base64 decode the VAA bytes
			vaaBytes, err := base64.StdEncoding.DecodeString(respBody.VaaBytes)
			if err != nil {
				resp.Body.Close()
				s.logger.Warn("failed to decode VAA body",
					zap.String("node", node),
					zap.String("chain", chain.String()),
					zap.String("address", addr),
					zap.Uint64("sequence", seq),
					zap.Error(err),
				)
				continue
			}

			s.logger.Info("backfilled VAA",
				zap.Uint16("chain", uint16(chain)),
				zap.String("address", addr),
				zap.Uint64("sequence", seq),
				zap.Int("numBytes", len(vaaBytes)),
			)

			// Inject into the gossip signed VAA receive path.
			// This has the same effect as if the VAA was received from the network
			// (verifying signature, publishing to BigTable, storing in local DB...).
			s.signedInC <- &gossipv1.SignedVAAWithQuorum{
				Vaa: vaaBytes,
			}

			resp.Body.Close()
			return true, nil
		default:
			resp.Body.Close()
			return false, fmt.Errorf("unexpected response status: %d", resp.StatusCode)
		}
	}

	return false, nil
}

func (s *nodePrivilegedService) FindMissingMessages(ctx context.Context, req *nodev1.FindMissingMessagesRequest) (*nodev1.FindMissingMessagesResponse, error) {
	b, err := hex.DecodeString(req.EmitterAddress)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid emitter address encoding: %v", err)
	}
	emitterAddress := vaa.Address{}
	copy(emitterAddress[:], b)

	ids, first, last, err := s.db.FindEmitterSequenceGap(db.VAAID{
		EmitterChain:   vaa.ChainID(req.EmitterChain),
		EmitterAddress: emitterAddress,
		TargetChain:    vaa.ChainID(req.TargetChain),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "database operation failed: %v", err)
	}

	if req.RpcBackfill {
		c := &http.Client{}
		unfilled := make([]uint64, 0, len(ids))
		for _, id := range ids {
			if ok, err := s.fetchMissing(ctx, req.BackfillNodes, c, vaa.ChainID(req.EmitterChain), emitterAddress.String(), id); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to backfill VAA: %v", err)
			} else if ok {
				continue
			}
			unfilled = append(unfilled, id)
		}
		ids = unfilled
	}

	resp := make([]string, len(ids))
	for i, v := range ids {
		resp[i] = fmt.Sprintf("%d/%s/%d/%d", req.EmitterChain, emitterAddress, req.TargetChain, v)
	}
	return &nodev1.FindMissingMessagesResponse{
		MissingMessages: resp,
		FirstSequence:   first,
		LastSequence:    last,
	}, nil
}

func adminServiceRunnable(
	logger *zap.Logger,
	socketPath string,
	injectC chan<- *vaa.VAA,
	signedInC chan *gossipv1.SignedVAAWithQuorum,
	obsvReqSendC chan *gossipv1.ObservationRequest,
	db *db.Database,
	gst *common.GuardianSetState,
) (supervisor.Runnable, error) {
	// Delete existing UNIX socket, if present.
	fi, err := os.Stat(socketPath)
	if err == nil {
		fmode := fi.Mode()
		if fmode&os.ModeType == os.ModeSocket {
			err = os.Remove(socketPath)
			if err != nil {
				return nil, fmt.Errorf("failed to remove existing socket at %s: %w", socketPath, err)
			}
		} else {
			return nil, fmt.Errorf("%s is not a UNIX socket", socketPath)
		}
	}

	// Create a new UNIX socket and listen to it.

	// The socket is created with the default umask. We set a restrictive umask in setRestrictiveUmask
	// to ensure that any files we create are only readable by the user - this is much harder to mess up.
	// The umask avoids a race condition between file creation and chmod.

	laddr, err := net.ResolveUnixAddr("unix", socketPath)
	if err != nil {
		return nil, fmt.Errorf("invalid listen address: %v", err)
	}
	l, err := net.ListenUnix("unix", laddr)
	if err != nil {
		return nil, fmt.Errorf("failed to listen on %s: %w", socketPath, err)
	}

	logger.Info("admin server listening on", zap.String("path", socketPath))

	nodeService := &nodePrivilegedService{
		injectC:      injectC,
		obsvReqSendC: obsvReqSendC,
		db:           db,
		logger:       logger.Named("adminservice"),
		signedInC:    signedInC,
	}

	publicrpcService := publicrpc.NewPublicrpcServer(logger, db, gst)

	grpcServer := common.NewInstrumentedGRPCServer(logger)
	nodev1.RegisterNodePrivilegedServiceServer(grpcServer, nodeService)
	publicrpcv1.RegisterPublicRPCServiceServer(grpcServer, publicrpcService)
	return supervisor.GRPCServer(grpcServer, l, false), nil
}

func (s *nodePrivilegedService) SendObservationRequest(ctx context.Context, req *nodev1.SendObservationRequestRequest) (*nodev1.SendObservationRequestResponse, error) {
	s.obsvReqSendC <- req.ObservationRequest
	s.logger.Info("sent observation request", zap.Any("request", req.ObservationRequest))
	return &nodev1.SendObservationRequestResponse{}, nil
}

func (s *nodePrivilegedService) GetNextGovernanceVAASequence(ctx context.Context, req *nodev1.GetNextGovernanceVAASequenceRequest) (*nodev1.GetNextGovernanceVAASequenceResponse, error) {
	maxSequence, err := s.db.MaxGovernanceVAASequence(vaa.ChainID(req.TargetChain))
	if err != nil {
		return nil, err
	}
	nextSequence := *maxSequence + 1
	return &nodev1.GetNextGovernanceVAASequenceResponse{
		Sequence: nextSequence,
	}, nil
}
