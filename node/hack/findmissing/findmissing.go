package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math"

	"github.com/alephium/wormhole-fork/node/pkg/common"
	nodev1 "github.com/alephium/wormhole-fork/node/pkg/proto/node/v1"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"google.golang.org/grpc"
)

var (
	adminRPC       = flag.String("adminRPC", "/run/guardiand/admin.socket", "Admin RPC address")
	shouldBackfill = flag.Bool("backfill", true, "Backfill missing sequences")
	onlyChain      = flag.String("only", "", "Only check this chain")
	targetChain    = flag.Uint("targetChain", 0, "VAA target chain id")
)

func getAdminClient(ctx context.Context, addr string) (*grpc.ClientConn, error, nodev1.NodePrivilegedServiceClient) {
	conn, err := grpc.DialContext(ctx, fmt.Sprintf("unix:///%s", addr), grpc.WithInsecure())

	if err != nil {
		log.Fatalf("failed to connect to %s: %v", addr, err)
	}

	c := nodev1.NewNodePrivilegedServiceClient(conn)
	return conn, err, c
}

func main() {
	flag.Parse()

	if *targetChain > math.MaxUint16 {
		log.Fatalf("invalid target chain id: %d", *targetChain)
	}

	ctx := context.Background()

	conn, err, admin := getAdminClient(ctx, *adminRPC)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get admin client: %v", err)
	}

	var only vaa.ChainID
	if *onlyChain != "" {
		only, err = vaa.ChainIDFromString(*onlyChain)
		if err != nil {
			log.Fatalf("failed to parse chain id: %v", err)
		}
	}

	for _, emitter := range common.KnownEmitters {
		if only != vaa.ChainIDUnset {
			if emitter.ChainID != only {
				continue
			}
		}

		log.Printf("requesting missing sequences for %v %s", emitter.ChainID, emitter.Emitter)

		msg := nodev1.FindMissingMessagesRequest{
			EmitterChain:   uint32(emitter.ChainID),
			TargetChain:    uint32(*targetChain),
			EmitterAddress: emitter.Emitter,
			RpcBackfill:    *shouldBackfill,
			BackfillNodes:  common.PublicRPCEndpoints,
		}
		resp, err := admin.FindMissingMessages(ctx, &msg)
		if err != nil {
			log.Fatalf("failed to run find FindMissingMessages RPC: %v", err)
		}

		for _, id := range resp.MissingMessages {
			fmt.Println(id)
		}
	}
}
