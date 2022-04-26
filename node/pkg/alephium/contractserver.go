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

func tokenIdFromHex(id string) (*Byte32, error) {
	bytes, err := hex.DecodeString(id)
	if err != nil || len(bytes) != 32 {
		return nil, fmt.Errorf("invalid token id %s", id)
	}
	var tokenId Byte32
	copy(tokenId[:], bytes)
	return &tokenId, nil
}

func (c *contractService) GetRemoteTokenWrapperId(ctx context.Context, req *alephiumv1.GetRemoteTokenWrapperIdRequest) (*alephiumv1.GetRemoteTokenWrapperIdResponse, error) {
	tokenId, err := tokenIdFromHex(req.TokenId)
	if err != nil {
		return nil, err
	}
	contractId, err := c.db.GetRemoteTokenWrapper(*tokenId)
	if err != nil {
		return nil, err
	}
	return &alephiumv1.GetRemoteTokenWrapperIdResponse{
		TokenWrapperId: contractId[:],
	}, nil
}

func (c *contractService) GetLocalTokenWrapperId(ctx context.Context, req *alephiumv1.GetLocalTokenWrapperIdRequest) (*alephiumv1.GetLocalTokenWrapperIdResponse, error) {
	tokenId, err := tokenIdFromHex(req.TokenId)
	if err != nil {
		return nil, err
	}
	contractId, err := c.db.GetLocalTokenWrapper(*tokenId, uint16(req.ChainId))
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
