package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math"
	"math/big"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/ethereum"
	ethAbi "github.com/alephium/wormhole-fork/node/pkg/ethereum/abi"
	gossipv1 "github.com/alephium/wormhole-fork/node/pkg/proto/gossip/v1"
	nodev1 "github.com/alephium/wormhole-fork/node/pkg/proto/node/v1"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	eth "github.com/ethereum/go-ethereum"
	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	ethClient "github.com/ethereum/go-ethereum/ethclient"
	ethRpc "github.com/ethereum/go-ethereum/rpc"
	"google.golang.org/grpc"
)

var (
	network        = flag.String("network", "", "Network type (devnet, testnet, mainnet)")
	adminRPC       = flag.String("adminRPC", "/run/guardiand/admin.socket", "Admin RPC address")
	nodeURL        = flag.String("nodeURL", "", "Full node RPC url")
	emitterChainId = flag.Uint("emitterChainId", 2, "VAA emitter chain id")
	targetChainId  = flag.Uint("targetChainId", 255, "VAA target chain id")
	dryRun         = flag.Bool("dryRun", true, "Dry run")
	step           = flag.Uint64("step", 10000, "Step")
	sleepTime      = flag.Int("sleepTime", 0, "Time to sleep between loops when getting logs")
	backfill       = flag.Bool("backfill", false, "Backfill missing messages from a list of remote nodes")
)

func getAdminClient(ctx context.Context, addr string) (*grpc.ClientConn, nodev1.NodePrivilegedServiceClient, error) {
	conn, err := grpc.DialContext(ctx, fmt.Sprintf("unix:///%s", addr), grpc.WithInsecure())

	if err != nil {
		log.Fatalf("failed to connect to %s: %v", addr, err)
	}

	c := nodev1.NewNodePrivilegedServiceClient(conn)
	return conn, c, err
}

func getLogs(ctx context.Context, client *ethClient.Client, contractAddress eth_common.Address, fromHeight, toHeight uint64) ([]types.Log, error) {
	query := eth.FilterQuery{
		FromBlock: big.NewInt(int64(fromHeight)),
		ToBlock:   big.NewInt(int64(toHeight)),
		Addresses: []eth_common.Address{contractAddress},
		Topics:    [][]eth_common.Hash{{ethereum.LogMessagePublishedTopic}},
	}
	logs, err := client.FilterLogs(ctx, query)
	if err != nil {
		return nil, err
	}
	return logs, nil
}

func checkFlagsAndGetChainConfig() (*common.BridgeConfig, *common.ChainConfig) {
	if *nodeURL == "" {
		log.Fatalf("please specify the full node RPC url")
	}

	bridgeConfig, err := common.ReadConfigsByNetwork(*network)
	if err != nil {
		log.Fatalf("failed to read configs, network: %s", *network)
	}

	if *targetChainId > math.MaxUint16 {
		log.Fatalf("invalid target chain id: %d", *targetChainId)
	}

	switch vaa.ChainID(*emitterChainId) {
	case vaa.ChainIDEthereum:
		return bridgeConfig, bridgeConfig.Ethereum
	case vaa.ChainIDBSC:
		return bridgeConfig, bridgeConfig.Bsc
	default:
		log.Fatalf("invalid chain id %v", *emitterChainId)
		return nil, nil
	}
}

func main() {
	flag.Parse()

	bridgeConfig, chainConfig := checkFlagsAndGetChainConfig()
	coreContract := eth_common.HexToAddress(chainConfig.Contracts.Governance)
	ctx := context.Background()

	rawClient, err := ethRpc.DialContext(ctx, *nodeURL)
	if err != nil {
		log.Fatalf("failed to connect to full node, error: %v", err)
	}
	client := ethClient.NewClient(rawClient)
	filterer, err := ethAbi.NewAbiFilterer(coreContract, client)
	if err != nil {
		log.Fatalf("failed to create abi filter, error: %v", err)
	}
	currentHeight, err := client.BlockNumber(ctx)
	if err != nil {
		log.Fatalf("failed to get current height: %v", err)
	}

	log.Printf("current height: %d", currentHeight)

	missingMessages := make(map[eth_common.Address]map[uint64]bool)

	conn, admin, err := getAdminClient(ctx, *adminRPC)
	if err != nil {
		log.Fatalf("failed to get admin client: %v", err)
	}
	defer conn.Close()

	contract := eth_common.HexToAddress(chainConfig.Contracts.TokenBridge)
	emitterAddress := chainConfig.TokenBridgeEmitterAddress

	log.Printf("requesting missing messages for %s (%v)", emitterAddress, contract)

	msg := nodev1.FindMissingMessagesRequest{
		EmitterChain:   uint32(*emitterChainId),
		TargetChain:    uint32(*targetChainId),
		EmitterAddress: emitterAddress,
		RpcBackfill:    *backfill,
		BackfillNodes:  bridgeConfig.Guardian.GuardianUrls,
	}
	resp, err := admin.FindMissingMessages(ctx, &msg)
	if err != nil {
		log.Fatalf("failed to run find FindMissingMessages RPC: %v", err)
	}

	msgs := []*vaa.VAAID{}
	for _, id := range resp.MissingMessages {
		fmt.Println(id)
		vId, err := vaa.VaaIDFromString(id)
		if err != nil {
			log.Fatalf("failed to parse VAAID: %v", err)
		}
		msgs = append(msgs, vId)
	}

	if len(msgs) == 0 {
		log.Printf("no missing messages found for %s", emitterAddress)
		return
	}

	lowest := msgs[0].Sequence
	highest := msgs[len(msgs)-1].Sequence

	log.Printf("found %d missing messages for %s: %d – %d", len(msgs), emitterAddress, lowest, highest)

	if _, ok := missingMessages[contract]; !ok {
		missingMessages[contract] = make(map[uint64]bool)
	}
	for _, msg := range msgs {
		missingMessages[contract][msg.Sequence] = true
	}

	// Press enter to continue if not in dryRun mode
	if !*dryRun {
		fmt.Println("press enter to continue")
		fmt.Scanln()
	}

	log.Printf("finding sequences")

	toHeight := currentHeight
	step := *step
	for {
		fromHeight := uint64(0)
		if toHeight >= step {
			fromHeight = toHeight - step
		}

		log.Printf("requesting logs from block %d to %d", fromHeight, toHeight)

		logs, err := getLogs(ctx, client, coreContract, fromHeight, toHeight)
		if err != nil {
			log.Fatalf("failed to get logs: %v", err)
		}
		toHeight = fromHeight

		if len(logs) == 0 {
			log.Printf("no logs found")
			continue
		}

		log.Printf("got %d logs (first block: %d, last block: %d)",
			len(logs), logs[0].BlockNumber, logs[len(logs)-1].BlockNumber)

		if len(logs) >= 1000 {
			// Bail if we exceeded the maximum number of logs returns in single API call -
			// we might have skipped some and would have to make another call to get the rest.
			//
			// This is a one-off script, so we just set an appropriate interval and bail
			// if we ever hit this.
			log.Fatalf("range exhausted - %d logs found", len(logs))
		}

		var min, max uint64
		for _, l := range logs {
			msg, err := filterer.ParseLogMessagePublished(l)
			if err != nil {
				log.Fatalf("failed to parse log, error: %v", err)
			}

			if msg.TargetChainId != uint16(*targetChainId) {
				continue
			}

			seq := msg.Sequence
			if seq < min || min == 0 {
				min = seq
			}
			if seq > max {
				max = seq
			}

			emitter := msg.Sender
			tx := msg.Raw.TxHash

			if _, ok := missingMessages[msg.Sender]; !ok {
				continue
			}
			if !missingMessages[emitter][seq] {
				continue
			}

			log.Printf("found missing message %d for %s in tx %s", seq, emitter, tx.Hex())
			delete(missingMessages[emitter], seq)

			log.Printf("requesting re-observation for %s", tx.Hex())

			_, err = admin.SendObservationRequest(ctx, &nodev1.SendObservationRequestRequest{
				ObservationRequest: &gossipv1.ObservationRequest{
					ChainId: uint32(*emitterChainId),
					TxHash:  tx.Bytes(),
				}})
			if err != nil {
				log.Fatalf("failed to send observation request: %v", err)
			}
		}

		log.Printf("seq: %d - %d", min, max)

		var total int
		for em, entries := range missingMessages {
			total += len(entries)
			log.Printf("%d missing messages for %s left", len(entries), em.Hex())
		}
		if total == 0 {
			log.Printf("no missing messages left")
			break
		}
		if fromHeight == 0 {
			break
		}
		// Allow sleeping between loops for chains that have aggressive blocking in the explorers
		if sleepTime != nil {
			time.Sleep(time.Duration(*sleepTime) * time.Second)
		}
	}
}
