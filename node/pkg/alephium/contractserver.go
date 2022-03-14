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
)

type contractService struct {
	alephiumv1.UnsafeContractServiceServer
	db *db
}

func (c *contractService) GetTokenWrapperID(ctx context.Context, req *alephiumv1.GetTokenWrapperIDRequest) (*alephiumv1.GetTokenWrapperIDResponse, error) {
	bytes, err := hex.DecodeString(req.TokenId)
	if err != nil {
		return nil, err
	}
	if len(bytes) != 32 {
		return nil, fmt.Errorf("invalid token id")
	}

	var byte32 Byte32
	copy(byte32[:], bytes)
	tokenWrapperId, err := c.db.getTokenWrapper(byte32)
	if err != nil {
		return nil, err
	}
	return &alephiumv1.GetTokenWrapperIDResponse{
		TokenWrapperId: tokenWrapperId.ToHex(),
	}, nil
}

func (c *contractService) GetTokenBridgeForChainID(ctx context.Context, req *alephiumv1.GetTokenBridgeForChainIDRequest) (*alephiumv1.GetTokenBridgeForChainIDResponse, error) {
	contractId, err := c.db.getRemoteChain(uint16(req.ChainId))
	if err != nil {
		return nil, err
	}
	return &alephiumv1.GetTokenBridgeForChainIDResponse{
		TokenBridgeForChainId: contractId.ToHex(),
	}, nil
}

func contractServiceRunnable(db *db, listenAddr string, logger *zap.Logger) (supervisor.Runnable, error) {
	l, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return nil, err
	}
	service := &contractService{
		db: db,
	}
	grpcServer := common.NewInstrumentedGRPCServer(logger)
	alephiumv1.RegisterContractServiceServer(grpcServer, service)
	return supervisor.GRPCServer(grpcServer, l, false), nil
}
