package publicrpc

import (
	"context"
	"encoding/hex"
	"fmt"

	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/db"
	publicrpcv1 "github.com/alephium/wormhole-fork/node/pkg/proto/publicrpc/v1"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// PublicrpcServer implements the publicrpc gRPC service.
type PublicrpcServer struct {
	publicrpcv1.UnsafePublicRPCServiceServer
	logger *zap.Logger
	db     *db.Database
	gst    *common.GuardianSetState

	governanceChainId vaa.ChainID
	governanceEmitter vaa.Address
}

func NewPublicrpcServer(
	logger *zap.Logger,
	db *db.Database,
	gst *common.GuardianSetState,
	governanceChainId vaa.ChainID,
	governanceEmitterAddress vaa.Address,
) *PublicrpcServer {
	return &PublicrpcServer{
		logger: logger.Named("publicrpcserver"),
		db:     db,
		gst:    gst,

		governanceChainId: governanceChainId,
		governanceEmitter: governanceEmitterAddress,
	}
}

func (s *PublicrpcServer) GetLastHeartbeats(ctx context.Context, req *publicrpcv1.GetLastHeartbeatsRequest) (*publicrpcv1.GetLastHeartbeatsResponse, error) {
	gs := s.gst.Get()
	if gs == nil {
		return nil, status.Error(codes.Unavailable, "guardian set not fetched from chain yet")
	}

	resp := &publicrpcv1.GetLastHeartbeatsResponse{
		Entries: make([]*publicrpcv1.GetLastHeartbeatsResponse_Entry, 0),
	}

	// Fetch all heartbeats (including from nodes not in the guardian set - which
	// can happen either with --disableHeartbeatVerify or when the guardian set changes)
	for addr, v := range s.gst.GetAll() {
		for peerId, hb := range v {
			resp.Entries = append(resp.Entries, &publicrpcv1.GetLastHeartbeatsResponse_Entry{
				VerifiedGuardianAddr: addr.Hex(),
				P2PNodeAddr:          peerId.Pretty(),
				RawHeartbeat:         hb,
			})
		}
	}

	return resp, nil
}

func decodeEmitterAddress(emitterAddress string) (*vaa.Address, error) {
	address, err := hex.DecodeString(emitterAddress)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, fmt.Sprintf("failed to decode address: %v", err))
	}
	if len(address) != 32 {
		return nil, status.Error(codes.InvalidArgument, "address must be 32 bytes")
	}

	addr := vaa.Address{}
	copy(addr[:], address)
	return &addr, nil
}

func (s *PublicrpcServer) GetSignedVAA(ctx context.Context, req *publicrpcv1.GetSignedVAARequest) (*publicrpcv1.GetSignedVAAResponse, error) {
	if req.MessageId == nil {
		return nil, status.Error(codes.InvalidArgument, "no message ID specified")
	}

	emitterAddress, err := decodeEmitterAddress(req.MessageId.EmitterAddress)
	if err != nil {
		return nil, err
	}

	b, err := s.db.GetSignedVAABytes(vaa.VAAID{
		EmitterChain:   vaa.ChainID(req.MessageId.EmitterChain.Number()),
		EmitterAddress: *emitterAddress,
		TargetChain:    vaa.ChainID(req.MessageId.TargetChain.Number()),
		Sequence:       req.MessageId.Sequence,
	})

	if err != nil {
		if err == db.ErrVAANotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		s.logger.Error("failed to fetch VAA", zap.Error(err), zap.Any("request", req))
		return nil, status.Error(codes.Internal, fmt.Sprintf("internal server error: %v", err))
	}

	return &publicrpcv1.GetSignedVAAResponse{
		VaaBytes: b,
	}, nil
}

func validateBatchSize(size int) error {
	if size > 20 {
		return status.Error(codes.InvalidArgument, "batch size exceed 20")
	}
	return nil
}

func (s *PublicrpcServer) GetNonGovernanceVAABatch(ctx context.Context, req *publicrpcv1.GetNonGovernanceVAABatchRequest) (*publicrpcv1.GetNonGovernanceVAABatchResponse, error) {
	if err := validateBatchSize(len(req.Sequences)); err != nil {
		return nil, err
	}

	emitterAddress, err := decodeEmitterAddress(req.EmitterAddress)
	if err != nil {
		return nil, err
	}

	entries := make([]*publicrpcv1.GetNonGovernanceVAABatchResponse_Entry, 0)
	for _, sequence := range req.Sequences {
		b, err := s.db.GetSignedVAABytes(vaa.VAAID{
			EmitterChain:   vaa.ChainID(req.EmitterChain.Number()),
			EmitterAddress: *emitterAddress,
			TargetChain:    vaa.ChainID(req.TargetChain.Number()),
			Sequence:       sequence,
		})
		if err != nil {
			if err == db.ErrVAANotFound {
				// skip the current sequence
				continue
			}
			s.logger.Error("failed to fetch VAA", zap.Error(err), zap.Any("request", req))
			return nil, status.Error(codes.Internal, fmt.Sprintf("internal server error: %v", err))
		}
		entries = append(entries, &publicrpcv1.GetNonGovernanceVAABatchResponse_Entry{
			Sequence: sequence,
			VaaBytes: b,
		})
	}

	return &publicrpcv1.GetNonGovernanceVAABatchResponse{Entries: entries}, nil
}

func (s *PublicrpcServer) GetGovernanceVAABatch(ctx context.Context, req *publicrpcv1.GetGovernanceVAABatchRequest) (*publicrpcv1.GetGovernanceVAABatchResponse, error) {
	if err := validateBatchSize(len(req.Sequences)); err != nil {
		return nil, err
	}

	entries := make([]*publicrpcv1.GetGovernanceVAABatchResponse_Entry, 0)
	vaas, err := s.db.GetGovernanceVAABatch(s.governanceChainId, s.governanceEmitter, req.Sequences)
	if err != nil {
		return nil, status.Error(codes.Internal, fmt.Sprintf("internal server error: %v", err))
	}
	for _, vaa := range vaas {
		entries = append(entries, &publicrpcv1.GetGovernanceVAABatchResponse_Entry{
			TargetChain: publicrpcv1.ChainID(vaa.TargetChain),
			Sequence:    vaa.Sequence,
			VaaBytes:    vaa.VaaBytes,
		})
	}
	return &publicrpcv1.GetGovernanceVAABatchResponse{
		Entries: entries,
	}, nil
}

func (s *PublicrpcServer) GetCurrentGuardianSet(ctx context.Context, req *publicrpcv1.GetCurrentGuardianSetRequest) (*publicrpcv1.GetCurrentGuardianSetResponse, error) {
	gs := s.gst.Get()
	if gs == nil {
		return nil, status.Error(codes.Unavailable, "guardian set not fetched from chain yet")
	}

	resp := &publicrpcv1.GetCurrentGuardianSetResponse{
		GuardianSet: &publicrpcv1.GuardianSet{
			Index:     gs.Index,
			Addresses: make([]string, len(gs.Keys)),
		},
	}

	for i, v := range gs.Keys {
		resp.GuardianSet.Addresses[i] = v.Hex()
	}

	return resp, nil
}
