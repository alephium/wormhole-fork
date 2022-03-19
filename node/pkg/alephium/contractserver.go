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

	tokenWrapperCache        map[Byte32]string
	tokenBridgeForChainCache map[uint16]string
}

func (c *contractService) getTokenWrapper(tokenId Byte32) (string, error) {
	if value, ok := c.tokenWrapperCache[tokenId]; ok {
		return value, nil
	}
	contractAddress, err := c.db.getTokenWrapper(tokenId)
	if err != nil {
		return "", err
	}
	c.tokenWrapperCache[tokenId] = contractAddress
	return contractAddress, nil
}

func (c *contractService) getTokenBridgeForChain(chainId uint16) (string, error) {
	if value, ok := c.tokenBridgeForChainCache[chainId]; ok {
		return value, nil
	}
	contractAddress, err := c.db.getRemoteChain(chainId)
	if err != nil {
		return "", err
	}
	c.tokenBridgeForChainCache[chainId] = contractAddress
	return contractAddress, nil
}

func (c *contractService) GetTokenWrapperAddress(ctx context.Context, req *alephiumv1.GetTokenWrapperAddressRequest) (*alephiumv1.GetTokenWrapperAddressResponse, error) {
	bytes, err := hex.DecodeString(req.TokenId)
	if err != nil {
		return nil, err
	}
	if len(bytes) != 32 {
		return nil, fmt.Errorf("invalid token id")
	}

	var byte32 Byte32
	copy(byte32[:], bytes)
	tokenWrapperAddress, err := c.getTokenWrapper(byte32)
	if err != nil {
		return nil, err
	}
	return &alephiumv1.GetTokenWrapperAddressResponse{
		TokenWrapperAddress: tokenWrapperAddress,
	}, nil
}

func (c *contractService) GetTokenBridgeForChainAddress(ctx context.Context, req *alephiumv1.GetTokenBridgeForChainAddressRequest) (*alephiumv1.GetTokenBridgeForChainAddressResponse, error) {
	contractAddress, err := c.getTokenBridgeForChain(uint16(req.ChainId))
	if err != nil {
		return nil, err
	}
	return &alephiumv1.GetTokenBridgeForChainAddressResponse{
		TokenBridgeForChainAddress: contractAddress,
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
