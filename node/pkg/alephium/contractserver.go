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
	db *AlphDatabase

	remoteTokenWrapperCache  map[Byte32]string
	localTokenWrapperCache   map[Byte32]map[uint16]string
	tokenBridgeForChainCache map[uint16]string
}

func (c *contractService) getRemoteTokenWrapper(tokenId Byte32) (string, error) {
	if value, ok := c.remoteTokenWrapperCache[tokenId]; ok {
		return value, nil
	}
	contractAddress, err := c.db.getRemoteTokenWrapper(tokenId)
	if err != nil {
		return "", err
	}
	c.remoteTokenWrapperCache[tokenId] = contractAddress
	return contractAddress, nil
}

func (c *contractService) getLocalTokenWrapper(tokenId Byte32, remoteChainId uint16) (string, error) {
	wrappers, exist := c.localTokenWrapperCache[tokenId]
	if exist {
		if value, ok := wrappers[remoteChainId]; ok {
			return value, nil
		}
	}
	contractAddress, err := c.db.getLocalTokenWrapper(tokenId, remoteChainId)
	if err != nil {
		return "", err
	}
	if !exist {
		c.localTokenWrapperCache[tokenId] = map[uint16]string{}
	}
	c.localTokenWrapperCache[tokenId][remoteChainId] = contractAddress
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
	tokenWrapperAddress, err := c.getRemoteTokenWrapper(byte32)
	if err != nil {
		return nil, err
	}
	return &alephiumv1.GetTokenWrapperAddressResponse{
		TokenWrapperAddress: tokenWrapperAddress,
	}, nil
}

func (c *contractService) GetLocalTokenWrapperAddress(ctx context.Context, req *alephiumv1.GetLocalTokenWrapperAddressRequest) (*alephiumv1.GetTokenWrapperAddressResponse, error) {
	tokenId, err := toContractId(req.TokenId)
	if err != nil {
		return nil, fmt.Errorf("invalid local token address %s", req.TokenId)
	}
	tokenWrapperAddress, err := c.getLocalTokenWrapper(tokenId, uint16(req.ChainId))
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

func contractServiceRunnable(db *AlphDatabase, listenAddr string, logger *zap.Logger) (supervisor.Runnable, error) {
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
