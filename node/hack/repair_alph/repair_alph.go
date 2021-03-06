package main

import (
	"context"
	"encoding/binary"
	"flag"
	"fmt"
	"log"

	"github.com/certusone/wormhole/node/pkg/alephium"
	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/db"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	nodev1 "github.com/certusone/wormhole/node/pkg/proto/node/v1"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"google.golang.org/grpc"
)

var (
	alphRPC  = flag.String("alphRPC", "http://localhost:12973", "Alephium RPC address")
	apiKey   = flag.String("apiKey", "", "Alephium RPC api key")
	adminRPC = flag.String("adminRPC", "/run/guardiand/admin.socket", "Admin RPC address")
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

	ctx := context.Background()
	conn, admin, err := getAdminClient(ctx, *adminRPC)
	defer conn.Close()
	if err != nil {
		log.Fatalf("failed to get admin client: %v", err)
	}

	var alphEmitter string
	for _, emitter := range common.KnownEmitters {
		if emitter.ChainID == vaa.ChainIDAlephium {
			alphEmitter = emitter.Emitter
		}
	}

	log.Printf("Requesting missing messages for %s", alphEmitter)

	msg := nodev1.FindMissingMessagesRequest{
		EmitterChain:   uint32(vaa.ChainIDAlephium),
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
		alphEmitterAddress string           = alephium.ToContractAddress(alephium.HexToByte32(alphEmitter))
		batchSize          uint64           = 100
		remain             int              = missingMessageSize
		client             *alephium.Client = alephium.NewClient(*alphRPC, *apiKey, 10)
	)

	eventCount, err := client.GetContractEventsCount(ctx, alphEmitterAddress)
	if err != nil {
		log.Fatalf("Failed to get event count, err: %v", err)
	}
	if *eventCount == uint64(0) {
		log.Fatalf("Event count is 0")
	}

	// request events in reverse order
	toIndex := *eventCount
	for {
		if remain == 0 {
			break
		}

		fromIndex := uint64(0)
		if toIndex >= batchSize {
			fromIndex = toIndex - batchSize
		}
		events, err := client.GetContractEventsByRange(ctx, alphEmitterAddress, fromIndex, toIndex)
		if err != nil {
			log.Fatalf("Failed to fetch events, err: %v, fromIndex: %v, toIndex: %v", err, fromIndex, toIndex)
		}

		eventCountOffset := 0
		blockHash := ""
		for _, event := range events.Events {
			if event.BlockHash != blockHash {
				blockHash = event.BlockHash
				eventCountOffset += 1
			}

			if event.EventIndex != alephium.WormholeMessageEventIndex {
				continue
			}

			wormholeMsg, err := event.ToWormholeMessage()
			if err != nil {
				log.Fatalf("Failed to get wormhole message, err: %v, event: %s", err, event.ToString())
			}

			if _, keyExist := missingMessages[wormholeMsg.Sequence]; !keyExist {
				continue
			}
			missingMessages[wormholeMsg.Sequence] = false
			remain -= 1

			eventIndex := fromIndex + uint64(eventCountOffset-1)
			encoded := make([]byte, 40) // 32 bytes txId + 8 bytes eventIndex
			txId := alephium.HexToFixedSizeBytes(event.TxId, 32)
			copy(encoded, txId)
			binary.BigEndian.PutUint64(encoded[32:], eventIndex)

			_, err = admin.SendObservationRequest(
				ctx,
				&nodev1.SendObservationRequestRequest{
					ObservationRequest: &gossipv1.ObservationRequest{
						ChainId: uint32(vaa.ChainIDTerra),
						TxHash:  encoded,
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
	log.Printf("Can't find missing messages for sequences: %v\n", missingSeqs)
}
