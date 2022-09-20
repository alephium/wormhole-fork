package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math"

	"github.com/certusone/wormhole/node/pkg/alephium"
	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/db"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	nodev1 "github.com/certusone/wormhole/node/pkg/proto/node/v1"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"google.golang.org/grpc"
)

const GovernanceContractId = "b5ab154d4f655ed3b237d29986d3d6cd43402e981b1f4d076cec47af6e2dfc04"

var (
	alphRPC     = flag.String("alphRPC", "http://localhost:12973", "Alephium RPC address")
	apiKey      = flag.String("apiKey", "", "Alephium RPC api key")
	adminRPC    = flag.String("adminRPC", "/run/guardiand/admin.socket", "Admin RPC address")
	groupIndex  = flag.Uint("group", 0, "Contract group index")
	targetChain = flag.Uint("targetChain", 0, "VAA target chain id")
)

func getAdminClient(ctx context.Context, addr string) (*grpc.ClientConn, nodev1.NodePrivilegedServiceClient, error) {
	conn, err := grpc.DialContext(ctx, fmt.Sprintf("unix:///%s", addr), grpc.WithInsecure())

	if err != nil {
		log.Fatalf("failed to connect to %s: %v", addr, err)
	}

	c := nodev1.NewNodePrivilegedServiceClient(conn)
	return conn, c, err
}

func main() {
	flag.Parse()

	if *targetChain > math.MaxUint16 {
		log.Fatalf("invalid target chain id: %d", *targetChain)
	}

	ctx := context.Background()
	conn, admin, err := getAdminClient(ctx, *adminRPC)
	if err != nil {
		log.Fatalf("failed to get admin client, err: %v", err)
	}
	defer conn.Close()

	var alphEmitter string
	for _, emitter := range common.KnownEmitters {
		if emitter.ChainID == vaa.ChainIDAlephium {
			alphEmitter = emitter.Emitter
		}
	}

	log.Printf("Requesting missing messages for %s", alphEmitter)

	msg := nodev1.FindMissingMessagesRequest{
		EmitterChain:   uint32(vaa.ChainIDAlephium),
		TargetChain:    uint32(*targetChain),
		EmitterAddress: alphEmitter,
		RpcBackfill:    true,
		BackfillNodes:  common.PublicRPCEndpoints,
	}
	resp, err := admin.FindMissingMessages(ctx, &msg)
	if err != nil {
		log.Fatalf("failed to run find FindMissingMessages RPC: %v", err)
	}

	msgs := make([]*db.VAAID, len(resp.MissingMessages))
	for i, id := range resp.MissingMessages {
		vId, err := db.VaaIDFromString(id)
		if err != nil {
			log.Fatalf("failed to parse VAAID: %v", err)
		}
		msgs[i] = vId
	}

	if len(msgs) == 0 {
		log.Printf("No missing messages found for %s", alphEmitter)
		return
	}

	missingMessageSize := len(msgs)
	lowest := msgs[0].Sequence
	highest := msgs[missingMessageSize-1].Sequence

	log.Printf("Found %d missing messages for %s: %d - %d", len(msgs), alphEmitter, lowest, highest)

	missingMessages := make(map[uint64]bool)
	for _, msg := range msgs {
		missingMessages[msg.Sequence] = true
	}

	log.Printf("Starting search for missing sequence numbers...")
	var (
		alphEmitterAddress string = alephium.ToContractAddress(alephium.HexToByte32(GovernanceContractId))
		batchSize          int32  = 100
		remain             int    = missingMessageSize
	)
	client := alephium.NewClient(*alphRPC, *apiKey, 10)
	eventCount, err := client.GetContractEventsCount(ctx, alphEmitterAddress)
	if err != nil {
		log.Fatalf("Failed to get event count, err: %v", err)
	}
	if *eventCount == 0 {
		log.Fatalf("Event count is 0")
	}

	// request events in reverse order
	toIndex := *eventCount
	for {
		if remain == 0 {
			break
		}

		fromIndex := int32(0)
		if toIndex >= batchSize {
			fromIndex = toIndex - batchSize
		}
		events, err := client.GetContractEventsByRange(ctx, alphEmitterAddress, fromIndex, batchSize, int32(*groupIndex))
		if err != nil {
			log.Fatalf("Failed to fetch events, err: %v, fromIndex: %v, toIndex: %v", err, fromIndex, toIndex)
		}

		for _, event := range events.Events {
			if event.EventIndex != alephium.WormholeMessageEventIndex {
				continue
			}

			wormholeMsg, err := alephium.ToWormholeMessage(event.Fields, event.TxId)
			if err != nil {
				log.Fatalf("Failed to get wormhole message, err: %v, txId: %s", err, event.TxId)
			}

			if _, keyExist := missingMessages[wormholeMsg.Sequence]; !keyExist {
				continue
			}
			missingMessages[wormholeMsg.Sequence] = false
			remain -= 1

			_, err = admin.SendObservationRequest(
				ctx,
				&nodev1.SendObservationRequestRequest{
					ObservationRequest: &gossipv1.ObservationRequest{
						ChainId: uint32(vaa.ChainIDAlephium),
						TxHash:  alephium.HexToFixedSizeBytes(event.TxId, 32),
					},
				},
			)
			if err != nil {
				log.Fatalf("Failed to request re-observe, err: %v", err)
			}
		}

		if fromIndex == 0 {
			break
		}
		toIndex = fromIndex
	}

	if remain == 0 {
		log.Println("Find missing messages completed")
		return
	}

	missingSeqs := make([]uint64, 0)
	for seq, missing := range missingMessages {
		if missing {
			missingSeqs = append(missingSeqs, seq)
		}
	}
	if len(missingSeqs) != 0 {
		log.Printf("Can't find missing messages for sequences: %v\n", missingSeqs)
	}
}
