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
	db *Database
}

func (c *contractService) getTokenBridgeForChain(chainId uint16) (string, error) {
	contractId, err := c.db.getRemoteChain(chainId)
	if err != nil {
		return "", err
	}
	return toContractAddress(*contractId), nil
}

func (c *contractService) GetRemoteTokenWrapperAddress(ctx context.Context, req *alephiumv1.GetRemoteTokenWrapperAddressRequest) (*alephiumv1.GetTokenWrapperAddressResponse, error) {
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
	return &alephiumv1.GetTokenWrapperAddressResponse{
		TokenWrapperAddress: toContractAddress(*contractId),
	}, nil
}

func (c *contractService) GetLocalTokenWrapperAddress(ctx context.Context, req *alephiumv1.GetLocalTokenWrapperAddressRequest) (*alephiumv1.GetTokenWrapperAddressResponse, error) {
	tokenId, err := ToContractId(req.TokenId)
	if err != nil {
		return nil, fmt.Errorf("invalid local token address %s", req.TokenId)
	}
	contractId, err := c.db.GetLocalTokenWrapper(tokenId, uint16(req.ChainId))
	if err != nil {
		return nil, err
	}
	return &alephiumv1.GetTokenWrapperAddressResponse{
		TokenWrapperAddress: toContractAddress(*contractId),
	}, nil
}

func (c *contractService) GetTokenBridgeForChainAddress(ctx context.Context, req *alephiumv1.GetTokenBridgeForChainAddressRequest) (*alephiumv1.GetTokenBridgeForChainAddressResponse, error) {
	contractId, err := c.db.getRemoteChain(uint16(req.ChainId))
	if err != nil {
		return nil, err
	}
	if err != nil {
		return nil, err
	}
	return &alephiumv1.GetTokenBridgeForChainAddressResponse{
		TokenBridgeForChainAddress: toContractAddress(*contractId),
	}, nil
}

func contractServiceRunnable(db *Database, listenAddr string, logger *zap.Logger) (supervisor.Runnable, error) {
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
