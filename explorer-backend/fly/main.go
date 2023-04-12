package main

import (
	"context"
	"time"

	"fmt"
	"os"

	"github.com/alephium/wormhole-fork/explorer-backend/fly/deduplicator"
	"github.com/alephium/wormhole-fork/explorer-backend/fly/guardiansets"
	"github.com/alephium/wormhole-fork/explorer-backend/fly/migration"
	"github.com/alephium/wormhole-fork/explorer-backend/fly/notifier"
	"github.com/alephium/wormhole-fork/explorer-backend/fly/processor"
	"github.com/alephium/wormhole-fork/explorer-backend/fly/server"
	"github.com/alephium/wormhole-fork/explorer-backend/fly/storage"
	"github.com/go-redis/redis/v8"
	"github.com/spf13/cobra"

	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/p2p"
	gossipv1 "github.com/alephium/wormhole-fork/node/pkg/proto/gossip/v1"
	"github.com/alephium/wormhole-fork/node/pkg/supervisor"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/dgraph-io/ristretto"
	"github.com/eko/gocache/v3/cache"
	"github.com/eko/gocache/v3/store"
	eth_common "github.com/ethereum/go-ethereum/common"
	crypto2 "github.com/ethereum/go-ethereum/crypto"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/libp2p/go-libp2p/core/crypto"
	"go.uber.org/zap"
)

var (
	rootCtx       context.Context
	rootCtxCancel context.CancelFunc
)

// TODO refactor to another file/package
func newCache() (cache.CacheInterface[bool], error) {
	c, err := ristretto.NewCache(&ristretto.Config{
		NumCounters: 10000,          // Num keys to track frequency of (1000).
		MaxCost:     10 * (1 << 20), // Maximum cost of cache (10 MB).
		BufferItems: 64,             // Number of keys per Get buffer.
	})
	if err != nil {
		return nil, err
	}
	store := store.NewRistretto(c)
	return cache.New[bool](store), nil
}

func newVAANotifierFunc(enableCache bool, logger *zap.Logger, redisUrl string) processor.VAANotifyFunc {
	if !enableCache {
		return func(context.Context, *vaa.VAA, []byte) error {
			return nil
		}
	}

	client := redis.NewClient(&redis.Options{Addr: redisUrl})
	return notifier.NewLastSequenceNotifier(client).Notify
}

var rootCmd = &cobra.Command{
	Use:   "explorer",
	Short: "Wormhole explorer backend",
	Run:   run,
}

var (
	p2pNetworkId             *string
	p2pPort                  *uint
	p2pBootstrap             *string
	apiPort                  *uint
	nodeKeyPath              *string
	guardianGrpcUrl          *string
	ethRpcUrl                *string
	network                  *string
	logLevel                 *string
	fetchMissingVaasInterval *uint
	fetchVaaBatchSize        *uint
	fetchGuardianSetInterval *uint
	enableCache              *bool
	redisUri                 *string
	mongodbUri               *string
	mongodbName              *string
)

func init() {
	p2pNetworkId = rootCmd.Flags().String("id", "/wormhole/dev", "P2P network id")
	p2pPort = rootCmd.Flags().Uint("p2pPort", 8999, "P2P UDP listener port")
	p2pBootstrap = rootCmd.Flags().String("bootstrap", "", "P2P bootstrap peers (comma-separated)")
	apiPort = rootCmd.Flags().Uint("apiPort", 8101, "Server API port")
	nodeKeyPath = rootCmd.Flags().String("nodeKey", "", "Path to node key (will be generated if it doesn't exist)")
	guardianGrpcUrl = rootCmd.Flags().String("guardianGrpcUrl", "127.0.0.1:7070", "Guardian grpc url")
	ethRpcUrl = rootCmd.Flags().String("ethRpcUrl", "http://127.0.0.1:8545", "ETH rpc url")
	network = rootCmd.Flags().String("network", "devnet", "Network type(devnet, testnet, mainnet)")
	logLevel = rootCmd.Flags().String("logLevel", "debug", "Log level")
	fetchMissingVaasInterval = rootCmd.Flags().Uint("fetchMissingVaasInterval", 300, "Fetch missing vaas interval")
	fetchVaaBatchSize = rootCmd.Flags().Uint("fetchVaaBatchSize", 20, "Fetch vaa batch size")
	fetchGuardianSetInterval = rootCmd.Flags().Uint("fetchGuardianSetInterval", 900, "Fetch guardian set interval")
	enableCache = rootCmd.Flags().Bool("enableCache", false, "Enable last sequence cache")
	redisUri = rootCmd.Flags().String("redisUri", "", "Redis URI(you need to specify this if enableCache is true)")
	mongodbUri = rootCmd.Flags().String("mongodbUri", "", "Mongodb URI")
	mongodbName = rootCmd.Flags().String("mongodbName", "", "Mongodb Name")
}

func checkConfigs(logger *zap.Logger) {
	if *enableCache && (redisUri == nil || *redisUri == "") {
		logger.Fatal("Please specify --redisUri")
	}
	if mongodbUri == nil || *mongodbUri == "" {
		logger.Fatal("Please specify --mongodbUri")
	}
	if mongodbName == nil || *mongodbName == "" {
		logger.Fatal("Please specify --mongodbName")
	}
	if nodeKeyPath == nil || *nodeKeyPath == "" {
		logger.Fatal("Please specify --nodeKey")
	}
	if p2pBootstrap == nil || *p2pBootstrap == "" {
		logger.Fatal("Please specify --bootstrap")
	}
}

func run(cmd *cobra.Command, args []string) {
	bridgeConfig, err := common.ReadConfigsByNetwork(*network)
	if err != nil {
		fmt.Printf("failed to read bridge config, error: %v\n", err)
		os.Exit(1)
	}

	rootCtx, rootCtxCancel = context.WithCancel(context.Background())
	defer rootCtxCancel()
	common.SetRestrictiveUmask()

	lvl, err := ipfslog.LevelFromString(*logLevel)
	if err != nil {
		fmt.Printf("invalid log level, error: %v\n", err)
		os.Exit(1)
	}

	logger := ipfslog.Logger("wormhole-fly").Desugar()

	ipfslog.SetAllLoggers(lvl)

	// Verify flags
	checkConfigs(logger)

	db, err := storage.GetDB(rootCtx, logger, *mongodbUri, *mongodbName)
	if err != nil {
		logger.Fatal("could not connect to DB", zap.Error(err))
	}

	// Run the database migration.
	err = migration.Run(db)
	if err != nil {
		logger.Fatal("error running migration", zap.Error(err))
	}

	governanceEmitter, err := vaa.StringToAddress(bridgeConfig.Guardian.GovernanceEmitterAddress)
	if err != nil {
		logger.Fatal("invalid governance emitter")
	}
	repository := storage.NewRepository(db, logger, vaa.ChainID(bridgeConfig.Guardian.GovernanceChainId), governanceEmitter)

	// Outbound gossip message queue
	sendC := make(chan []byte)

	// Inbound observations
	obsvC := make(chan *gossipv1.SignedObservation, 50)

	// Inbound observation requests
	obsvReqC := make(chan *gossipv1.ObservationRequest, 50)

	// Inbound signed VAAs
	signedInC := make(chan *gossipv1.SignedVAAWithQuorum, 50)

	// Heartbeat updates
	heartbeatC := make(chan *gossipv1.Heartbeat, 50)

	ethGovernanceAddress := eth_common.HexToAddress(bridgeConfig.Ethereum.CoreEmitterAddress)
	guardianSetList, err := guardiansets.GetGuardianSetsFromChain(rootCtx, *ethRpcUrl, ethGovernanceAddress, 0)
	if err != nil {
		logger.Fatal("failed to get guardian sets from chain", zap.Error(err))
	}

	guardianSetC := make(chan *common.GuardianSet, 1)
	guardianSets := guardiansets.NewGuardianSets(
		guardianSetList,
		*ethRpcUrl,
		logger,
		time.Duration(*fetchGuardianSetInterval)*time.Second,
		ethGovernanceAddress,
		guardianSetC,
	)
	guardianSets.UpdateGuardianSet(rootCtx) // Update guardian set periodically

	// Guardian set state managed by processor
	gst := common.NewGuardianSetState(heartbeatC)

	// Bootstrap guardian set, otherwise heartbeats would be skipped
	gst.Set(guardianSets.GetCurrentGuardianSet())

	fetcher, err := storage.NewFetcher(
		bridgeConfig,
		repository,
		time.Duration(*fetchMissingVaasInterval)*time.Second,
		logger,
		uint32(*fetchVaaBatchSize),
		*guardianGrpcUrl,
	)
	if err != nil {
		logger.Fatal("failed to init fetcher", zap.Error(err))
	}
	fetcher.Start(rootCtx)

	// Ignore observation requests
	// Note: without this, the whole program hangs on observation requests
	discardMessages(rootCtx, obsvReqC)

	// Log observations
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case latestGuardianSet := <-guardianSetC:
				gst.Set(latestGuardianSet)
			case o := <-obsvC:
				ok := verifyObservation(logger, o, gst.Get())
				if !ok {
					logger.Error("Could not verify observation", zap.String("id", o.MessageId))
					continue
				}
				err := repository.UpsertObservation(o)
				if err != nil {
					logger.Error("Error inserting observation", zap.Error(err))
				}
			}
		}
	}()

	// Log signed VAAs
	cache, err := newCache()
	if err != nil {
		logger.Fatal("could not create cache", zap.Error(err))
	}
	// Creates a deduplicator to discard VAA messages that were processed previously
	deduplicator := deduplicator.New(cache, logger)
	notifierFunc := newVAANotifierFunc(*enableCache, logger, *redisUri)
	// TODO: configable buffer size
	messageQueue := make(chan *processor.Message, 256)
	// Creates a instance to consume VAA messages from Gossip network and handle the messages
	vaaGossipConsumer := processor.NewVAAGossipConsumer(guardianSets, deduplicator, messageQueue, logger)
	// Creates a instance to consume VAA messages from a queue and store in a storage
	vaaQueueConsumer := processor.NewVAAQueueConsumer(messageQueue, repository, notifierFunc, logger)
	vaaQueueConsumer.Start(rootCtx)

	// start fly http server.
	server := server.NewServer(logger, repository, *apiPort)
	server.Start()

	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case sVaa := <-signedInC:
				v, err := vaa.Unmarshal(sVaa.Vaa)
				if err != nil {
					logger.Error("Error unmarshalling vaa", zap.Error(err))
					continue
				}
				// Push an incoming VAA to be processed
				if err := vaaGossipConsumer.Push(rootCtx, v, sVaa.Vaa); err != nil {
					logger.Error("Error inserting vaa", zap.Error(err))
				}
			}
		}
	}()

	// Log heartbeats
	go func() {
		for {
			select {
			case <-rootCtx.Done():
				return
			case hb := <-heartbeatC:
				err := repository.UpsertHeartbeat(hb)
				if err != nil {
					logger.Error("Error inserting heartbeat", zap.Error(err))
				}
			}
		}
	}()

	// Load p2p private key
	var priv crypto.PrivKey
	priv, err = common.GetOrCreateNodeKey(logger, *nodeKeyPath)
	if err != nil {
		logger.Fatal("Failed to load node key", zap.Error(err))
	}

	// Run supervisor.
	supervisor.New(rootCtx, logger, func(ctx context.Context) error {
		if err := supervisor.Run(ctx, "p2p", p2p.Run(obsvC, obsvReqC, nil, sendC, signedInC, priv, nil, gst, *p2pPort, *p2pNetworkId, *p2pBootstrap, "", false, rootCtxCancel)); err != nil {
			return err
		}

		logger.Info("Started internal services")

		<-ctx.Done()
		return nil
	},
		// It's safer to crash and restart the process in case we encounter a panic,
		// rather than attempting to reschedule the runnable.
		supervisor.WithPropagatePanic)

	<-rootCtx.Done()
	server.Stop()
}

func verifyObservation(logger *zap.Logger, obs *gossipv1.SignedObservation, gs *common.GuardianSet) bool {
	pk, err := crypto2.Ecrecover(obs.GetHash(), obs.GetSignature())
	if err != nil {
		return false
	}

	theirAddr := eth_common.BytesToAddress(obs.GetAddr())
	signerAddr := eth_common.BytesToAddress(crypto2.Keccak256(pk[1:])[12:])
	if theirAddr != signerAddr {
		logger.Error("error validating observation, signer addr and addr don't match",
			zap.String("id", obs.MessageId),
			zap.String("obs_addr", theirAddr.Hex()),
			zap.String("signer_addr", signerAddr.Hex()),
		)
		return false
	}

	_, isFromGuardian := gs.KeyIndex(theirAddr)
	if !isFromGuardian {
		logger.Error("error validating observation, signer not in guardian set",
			zap.String("id", obs.MessageId),
			zap.String("obs_addr", theirAddr.Hex()),
		)
	}
	return isFromGuardian
}

func discardMessages[T any](ctx context.Context, obsvReqC chan T) {
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-obsvReqC:
			}
		}
	}()
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
