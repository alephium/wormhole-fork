package guardiand

import (
	"fmt"
	"net"

	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/db"
	publicrpcv1 "github.com/alephium/wormhole-fork/node/pkg/proto/publicrpc/v1"
	"github.com/alephium/wormhole-fork/node/pkg/publicrpc"
	"github.com/alephium/wormhole-fork/node/pkg/supervisor"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"go.uber.org/zap"
	"google.golang.org/grpc"
)

func publicrpcServiceRunnable(
	logger *zap.Logger,
	listenAddr string,
	db *db.Database,
	gst *common.GuardianSetState,
	governanceChainId vaa.ChainID,
	governanceEmitter vaa.Address,
) (supervisor.Runnable, *grpc.Server, error) {
	l, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to listen: %w", err)
	}

	logger.Info("publicrpc server listening", zap.String("addr", l.Addr().String()))

	rpcServer := publicrpc.NewPublicrpcServer(logger, db, gst, governanceChainId, governanceEmitter)
	grpcServer := common.NewInstrumentedGRPCServer(logger)
	publicrpcv1.RegisterPublicRPCServiceServer(grpcServer, rpcServer)

	return supervisor.GRPCServer(grpcServer, l, false), grpcServer, nil
}
