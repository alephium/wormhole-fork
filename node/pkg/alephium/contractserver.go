package alephium

import (
	"context"
	"encoding/hex"
	"fmt"
	"net"

	"github.com/certusone/wormhole/node/pkg/common"
	alephiumv1 "github.com/certusone/wormhole/node/pkg/proto/alephium/v1"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	"go.uber.org/zap"
	"google.golang.org/grpc"
)

type contractService struct {
	alephiumv1.UnsafeContractServiceServer
	db *Database
}

func (c *contractService) GetRemoteTokenWrapperId(ctx context.Context, req *alephiumv1.GetRemoteTokenWrapperIdRequest) (*alephiumv1.GetRemoteTokenWrapperIdResponse, error) {
	bytes, err := hex.DecodeString(req.TokenId)
	if err != nil {
		return nil, err
	}
	if len(bytes) != 32 {
		return nil, fmt.Errorf("invalid token id")
	}

	var byte32 Byte32
	copy(byte32[:], bytes)
	contractId, err := c.db.GetRemoteTokenWrapper(byte32)
	if err != nil {
		return nil, err
	}
	return &alephiumv1.GetRemoteTokenWrapperIdResponse{
		TokenWrapperId: contractId[:],
	}, nil
}

func (c *contractService) GetLocalTokenWrapperId(ctx context.Context, req *alephiumv1.GetLocalTokenWrapperIdRequest) (*alephiumv1.GetLocalTokenWrapperIdResponse, error) {
	tokenId, err := ToContractId(req.TokenId)
	if err != nil {
		return nil, fmt.Errorf("invalid local token address %s", req.TokenId)
	}
	contractId, err := c.db.GetLocalTokenWrapper(tokenId, uint16(req.ChainId))
	if err != nil {
		return nil, err
	}
	return &alephiumv1.GetLocalTokenWrapperIdResponse{
		TokenWrapperId: contractId[:],
	}, nil
}

func (c *contractService) GetTokenBridgeForChainId(ctx context.Context, req *alephiumv1.GetTokenBridgeForChainIdRequest) (*alephiumv1.GetTokenBridgeForChainIdResponse, error) {
	contractId, err := c.db.getTokenBridgeForChain(uint16(req.ChainId))
	if err != nil {
		return nil, err
	}
	if err != nil {
		return nil, err
	}
	return &alephiumv1.GetTokenBridgeForChainIdResponse{
		TokenBridgeForChainId: contractId[:],
	}, nil
}

func contractServiceRunnable(db *Database, listenAddr string, logger *zap.Logger) (supervisor.Runnable, *grpc.Server, error) {
	l, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return nil, nil, err
	}
	service := &contractService{
		db: db,
	}
	grpcServer := common.NewInstrumentedGRPCServer(logger)
	alephiumv1.RegisterContractServiceServer(grpcServer, service)
	return supervisor.GRPCServer(grpcServer, l, false), grpcServer, nil
}
