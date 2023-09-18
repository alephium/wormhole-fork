package guardiand

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	_ "net/http/pprof" // #nosec G108 we are using a custom router (`router := mux.NewRouter()`) and thus not automatically expose pprof.
	"os"
	"path"
	"strings"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/alephium"
	"github.com/alephium/wormhole-fork/node/pkg/db"
	"github.com/alephium/wormhole-fork/node/pkg/ecdsasigner"
	"github.com/alephium/wormhole-fork/node/pkg/ethereum"
	"github.com/alephium/wormhole-fork/node/pkg/notify/discord"
	"github.com/alephium/wormhole-fork/node/pkg/telemetry"
	"github.com/alephium/wormhole-fork/node/pkg/version"
	"github.com/benbjohnson/clock"
	"go.uber.org/zap/zapcore"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/devnet"
	"github.com/alephium/wormhole-fork/node/pkg/p2p"
	"github.com/alephium/wormhole-fork/node/pkg/processor"
	gossipv1 "github.com/alephium/wormhole-fork/node/pkg/proto/gossip/v1"
	publicrpcv1 "github.com/alephium/wormhole-fork/node/pkg/proto/publicrpc/v1"
	"github.com/alephium/wormhole-fork/node/pkg/readiness"
	"github.com/alephium/wormhole-fork/node/pkg/reporter"
	"github.com/alephium/wormhole-fork/node/pkg/supervisor"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	eth_common "github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/spf13/cobra"
	"go.uber.org/zap"

	ipfslog "github.com/ipfs/go-log/v2"
)

var (
	p2pNetworkID *string
	p2pPort      *uint
	p2pBootstrap *string

	nodeKeyPath *string

	adminSocketPath *string

	dataDir *string

	statusAddr *string

	guardianKeyPath *string
	// solanaContract  *string

	ethRPC            *string
	ethPollIntervalMs *uint

	bscRPC            *string
	bscPollIntervalMs *uint

	// polygonRPC      *string
	// polygonContract *string

	// ethRopstenRPC      *string
	// ethRopstenContract *string

	// auroraRPC      *string
	// auroraContract *string

	// fantomRPC      *string
	// fantomContract *string

	// avalancheRPC      *string
	// avalancheContract *string

	// oasisRPC      *string
	// oasisContract *string

	// karuraRPC      *string
	// karuraContract *string

	// acalaRPC      *string
	// acalaContract *string

	// klaytnRPC      *string
	// klaytnContract *string

	// celoRPC      *string
	// celoContract *string

	// moonbeamRPC      *string
	// moonbeamContract *string

	// neonRPC      *string
	// neonContract *string

	// terraWS       *string
	// terraLCD      *string
	// terraContract *string

	// algorandIndexerRPC   *string
	// algorandIndexerToken *string
	// algorandAlgodRPC     *string
	// algorandAlgodToken   *string
	// algorandAppID        *uint64

	// solanaWsRPC *string
	// solanaRPC   *string

	alphRPC            *string
	alphApiKey         *string
	alphPollIntervalMs *uint

	logLevel *string

	devnetGuardianIndex *int
	integrationTest     *bool

	network  *string
	nodeName *string

	publicRPC *string
	publicWeb *string

	tlsHostname *string
	tlsProdEnv  *bool

	disableHeartbeatVerify *bool
	disableTelemetry       *bool

	telemetryKey *string

	discordToken   *string
	discordChannel *string

	cloudKMSEnabled *bool
	cloudKMSKeyName *string
)

func init() {
	p2pNetworkID = NodeCmd.Flags().String("id", "/wormhole/dev", "P2P network identifier")
	p2pPort = NodeCmd.Flags().Uint("port", 8999, "P2P UDP listener port")
	p2pBootstrap = NodeCmd.Flags().String("bootstrap", "", "P2P bootstrap peers (comma-separated)")

	statusAddr = NodeCmd.Flags().String("statusAddr", "[::]:6060", "Listen address for status server (disabled if blank)")

	nodeKeyPath = NodeCmd.Flags().String("nodeKey", "", "Path to node key (will be generated if it doesn't exist)")

	adminSocketPath = NodeCmd.Flags().String("adminSocket", "", "Admin gRPC service UNIX domain socket path")

	dataDir = NodeCmd.Flags().String("dataDir", "", "Data directory")

	guardianKeyPath = NodeCmd.Flags().String("guardianKey", "", "Path to guardian key (required)")
	// solanaContract = NodeCmd.Flags().String("solanaContract", "", "Address of the Solana program (required)")

	ethRPC = NodeCmd.Flags().String("ethRPC", "", "Ethereum RPC URL")
	ethPollIntervalMs = NodeCmd.Flags().Uint("ethPollIntervalMs", 3000, "The poll interval for ethereum watcher")

	bscRPC = NodeCmd.Flags().String("bscRPC", "", "Binance Smart Chain RPC URL")
	bscPollIntervalMs = NodeCmd.Flags().Uint("bscPollIntervalMs", 3000, "The poll interval for bsc watcher")

	// polygonRPC = NodeCmd.Flags().String("polygonRPC", "", "Polygon RPC URL")
	// polygonContract = NodeCmd.Flags().String("polygonContract", "", "Polygon contract address")

	// ethRopstenRPC = NodeCmd.Flags().String("ethRopstenRPC", "", "Ethereum Ropsten RPC URL")
	// ethRopstenContract = NodeCmd.Flags().String("ethRopstenContract", "", "Ethereum Ropsten contract address")

	// avalancheRPC = NodeCmd.Flags().String("avalancheRPC", "", "Avalanche RPC URL")
	// avalancheContract = NodeCmd.Flags().String("avalancheContract", "", "Avalanche contract address")

	// oasisRPC = NodeCmd.Flags().String("oasisRPC", "", "Oasis RPC URL")
	// oasisContract = NodeCmd.Flags().String("oasisContract", "", "Oasis contract address")

	// auroraRPC = NodeCmd.Flags().String("auroraRPC", "", "Aurora Websocket RPC URL")
	// auroraContract = NodeCmd.Flags().String("auroraContract", "", "Aurora contract address")

	// fantomRPC = NodeCmd.Flags().String("fantomRPC", "", "Fantom Websocket RPC URL")
	// fantomContract = NodeCmd.Flags().String("fantomContract", "", "Fantom contract address")

	// karuraRPC = NodeCmd.Flags().String("karuraRPC", "", "Karura RPC URL")
	// karuraContract = NodeCmd.Flags().String("karuraContract", "", "Karura contract address")

	// acalaRPC = NodeCmd.Flags().String("acalaRPC", "", "Acala RPC URL")
	// acalaContract = NodeCmd.Flags().String("acalaContract", "", "Acala contract address")

	// klaytnRPC = NodeCmd.Flags().String("klaytnRPC", "", "Klaytn RPC URL")
	// klaytnContract = NodeCmd.Flags().String("klaytnContract", "", "Klaytn contract address")

	// celoRPC = NodeCmd.Flags().String("celoRPC", "", "Celo RPC URL")
	// celoContract = NodeCmd.Flags().String("celoContract", "", "Celo contract address")

	// moonbeamRPC = NodeCmd.Flags().String("moonbeamRPC", "", "Moonbeam RPC URL")
	// moonbeamContract = NodeCmd.Flags().String("moonbeamContract", "", "Moonbeam contract address")

	// neonRPC = NodeCmd.Flags().String("neonRPC", "", "Neon RPC URL")
	// neonContract = NodeCmd.Flags().String("neonContract", "", "Neon contract address")

	// terraWS = NodeCmd.Flags().String("terraWS", "", "Path to terrad root for websocket connection")
	// terraLCD = NodeCmd.Flags().String("terraLCD", "", "Path to LCD service root for http calls")
	// terraContract = NodeCmd.Flags().String("terraContract", "", "Wormhole contract address on Terra blockchain")

	// algorandIndexerRPC = NodeCmd.Flags().String("algorandIndexerRPC", "", "Algorand Indexer RPC URL")
	// algorandIndexerToken = NodeCmd.Flags().String("algorandIndexerToken", "", "Algorand Indexer access token")
	// algorandAlgodRPC = NodeCmd.Flags().String("algorandAlgodRPC", "", "Algorand Algod RPC URL")
	// algorandAlgodToken = NodeCmd.Flags().String("algorandAlgodToken", "", "Algorand Algod access token")
	// algorandAppID = NodeCmd.Flags().Uint64("algorandAppID", 0, "Algorand app id")

	// solanaWsRPC = NodeCmd.Flags().String("solanaWS", "", "Solana Websocket URL (required")
	// solanaRPC = NodeCmd.Flags().String("solanaRPC", "", "Solana RPC URL (required")

	alphRPC = NodeCmd.Flags().String("alphRPC", "", "Alephium RPC URL (required)")
	alphApiKey = NodeCmd.Flags().String("alphApiKey", "", "Alphium RPC api key")
	alphPollIntervalMs = NodeCmd.Flags().Uint("alphPollIntervalMs", 4000, "The poll interval of alephium watcher")

	logLevel = NodeCmd.Flags().String("logLevel", "info", "Logging level (debug, info, warn, error, dpanic, panic, fatal)")

	devnetGuardianIndex = NodeCmd.Flags().Int("devnetGuardianIndex", 0, "Specify devnet guardian index")
	integrationTest = NodeCmd.Flags().Bool("integrationTest", false, "Launch node for integration testing")

	network = NodeCmd.Flags().String("network", "", "Network type (devnet, testnet, mainnet)")
	nodeName = NodeCmd.Flags().String("nodeName", "", "Node name to announce in gossip heartbeats")

	publicRPC = NodeCmd.Flags().String("publicRPC", "", "Listen address for public gRPC interface")
	publicWeb = NodeCmd.Flags().String("publicWeb", "", "Listen address for public REST and gRPC Web interface")

	tlsHostname = NodeCmd.Flags().String("tlsHostname", "", "If set, serve publicWeb as TLS with this hostname using Let's Encrypt")
	tlsProdEnv = NodeCmd.Flags().Bool("tlsProdEnv", false,
		"Use the production Let's Encrypt environment instead of staging")

	disableHeartbeatVerify = NodeCmd.Flags().Bool("disableHeartbeatVerify", false,
		"Disable heartbeat signature verification (useful during network startup)")
	disableTelemetry = NodeCmd.Flags().Bool("disableTelemetry", false,
		"Disable telemetry")

	telemetryKey = NodeCmd.Flags().String("telemetryKey", "",
		"Telemetry write key")

	discordToken = NodeCmd.Flags().String("discordToken", "", "Discord bot token (optional)")
	discordChannel = NodeCmd.Flags().String("discordChannel", "", "Discord channel name (optional)")

	cloudKMSEnabled = NodeCmd.Flags().Bool("cloudKMSEnabled", false, "Turn on Cloud KMS support for Guardian Key")
	cloudKMSKeyName = NodeCmd.Flags().String("cloudKMSKeyName", "", "Cloud KMS key name for Guardian Key")
}

var (
	rootCtx       context.Context
	rootCtxCancel context.CancelFunc
)

// "Why would anyone do this?" are famous last words.
//
// We already forcibly override RPC URLs and keys in dev mode to prevent security
// risks from operator error, but an extra warning won't hurt.
const devwarning = `
        +++++++++++++++++++++++++++++++++++++++++++++++++++
        |   NODE IS RUNNING IN INSECURE DEVELOPMENT MODE  |
        |                                                 |
        |      Do not use network=devnet in prod.         |
        +++++++++++++++++++++++++++++++++++++++++++++++++++

`

// NodeCmd represents the node command
var NodeCmd = &cobra.Command{
	Use:   "node",
	Short: "Run the guardiand node",
	Run:   runNode,
}

// observationRequestBufferSize is the buffer size of the per-network reobservation channel
const observationRequestBufferSize = 25

func runNode(cmd *cobra.Command, args []string) {
	if *network != "devnet" && *network != "testnet" && *network != "mainnet" {
		fmt.Printf("invalid network type %s\n", *network)
		os.Exit(1)
	}

	unsafeDevMode := *network == "devnet"
	if unsafeDevMode {
		fmt.Print(devwarning)
	}

	if *integrationTest && !unsafeDevMode {
		fmt.Println("Integration tests can only be run in devnet mode")
		os.Exit(1)
	}

	if !*integrationTest {
		common.LockMemory()
	}
	common.SetRestrictiveUmask()

	// Refuse to run as root in production mode.
	if !unsafeDevMode && os.Geteuid() == 0 {
		fmt.Println("can't run as uid 0")
		os.Exit(1)
	}

	// Set up logging. The go-log zap wrapper that libp2p uses is compatible with our
	// usage of zap in supervisor, which is nice.
	lvl, err := ipfslog.LevelFromString(*logLevel)
	if err != nil {
		fmt.Println("Invalid log level")
		os.Exit(1)
	}

	logger := zap.New(zapcore.NewCore(
		consoleEncoder{zapcore.NewConsoleEncoder(
			zap.NewDevelopmentEncoderConfig())},
		zapcore.AddSync(zapcore.Lock(os.Stderr)),
		zap.NewAtomicLevelAt(zapcore.Level(lvl))))

	if unsafeDevMode {
		// Use the hostname as nodeName. For production, we don't want to do this to
		// prevent accidentally leaking sensitive hostnames.
		hostname, err := os.Hostname()
		if err != nil {
			panic(err)
		}
		*nodeName = hostname

		// Put node name into the log for development.
		logger = logger.Named(*nodeName)
	}

	// Override the default go-log config, which uses a magic environment variable.
	ipfslog.SetAllLoggers(lvl)

	// Register components for readiness checks.
	readiness.RegisterComponent(common.ReadinessEthSyncing)
	readiness.RegisterComponent(common.ReadinessBSCSyncing)
	readiness.RegisterComponent(common.ReadinessAlephiumSyncing)

	if *statusAddr != "" {
		// Use a custom routing instead of using http.DefaultServeMux directly to avoid accidentally exposing packages
		// that register themselves with it by default (like pprof).
		router := mux.NewRouter()

		// pprof server. NOT necessarily safe to expose publicly - only enable it in dev mode to avoid exposing it by
		// accident. There's benefit to having pprof enabled on production nodes, but we would likely want to expose it
		// via a dedicated port listening on localhost, or via the admin UNIX socket.
		if unsafeDevMode {
			// Pass requests to http.DefaultServeMux, which pprof automatically registers with as an import side-effect.
			router.PathPrefix("/debug/pprof/").Handler(http.DefaultServeMux)
		}

		// Simple endpoint exposing node readiness (safe to expose to untrusted clients)
		router.HandleFunc("/readyz", readiness.Handler)

		// Prometheus metrics (safe to expose to untrusted clients)
		router.Handle("/metrics", promhttp.Handler())

		go func() {
			logger.Info("status server listening on [::]:6060")
			// SECURITY: If making changes, ensure that we always do `router := mux.NewRouter()` before this to avoid accidentally exposing pprof
			logger.Error("status server crashed", zap.Error(http.ListenAndServe(*statusAddr, router)))
		}()
	}

	bridgeConfig, err := common.ReadConfigsByNetwork(*network)
	if err != nil {
		logger.Fatal("failed to read configs", zap.String("network", *network), zap.Error(err))
	}
	alphConfig := bridgeConfig.Alephium
	ethConfig := bridgeConfig.Ethereum
	bscConfig := bridgeConfig.Bsc

	ethContract := eth_common.HexToAddress(ethConfig.Contracts.Governance)
	bscContract := eth_common.HexToAddress(bscConfig.Contracts.Governance)

	governanceChainId := vaa.ChainID(bridgeConfig.Guardian.GovernanceChainId)
	governanceEmitterAddress, err := vaa.StringToAddress(bridgeConfig.Guardian.GovernanceEmitterAddress)
	if err != nil {
		logger.Fatal("invalid governance emitter address", zap.String("address", bridgeConfig.Guardian.GovernanceEmitterAddress), zap.Error(err))
	}

	// In devnet mode, we automatically set a number of flags that rely on deterministic keys.
	if unsafeDevMode {

		// Use the first guardian node as bootstrap if it is not specified
		if *p2pBootstrap == "" {
			g0key, err := peer.IDFromPrivateKey(devnet.DeterministicP2PPrivKeyByIndex(0))
			if err != nil {
				panic(err)
			}

			*p2pBootstrap = fmt.Sprintf("/dns4/guardian-0.guardian/udp/%d/quic/p2p/%s", *p2pPort, g0key.String())
		}
	}

	// Verify flags

	if *nodeKeyPath == "" && !unsafeDevMode { // In devnet mode, keys are deterministically generated.
		logger.Fatal("Please specify --nodeKey")
	}
	if *guardianKeyPath == "" && !*cloudKMSEnabled && !unsafeDevMode {
		logger.Fatal("Please either specify --guardianKey or --cloudKMSEnabled")
	}
	if *cloudKMSEnabled && unsafeDevMode {
		logger.Fatal("Please do not specify --cloudKMSEnabled in devnet")
	}
	if *adminSocketPath == "" {
		logger.Fatal("Please specify --adminSocket")
	}
	if *dataDir == "" && !unsafeDevMode {
		logger.Fatal("Please specify --dataDir")
	}
	if *ethRPC == "" {
		logger.Fatal("Please specify --ethRPC")
	}
	if *nodeName == "" {
		logger.Fatal("Please specify --nodeName")
	}

	if *cloudKMSEnabled {
		if *cloudKMSKeyName == "" {
			logger.Fatal("Please specify --cloudKMSKeyName")
		}
	}

	// Complain about Infura on mainnet.
	//
	// As it turns out, Infura has a bug where it would sometimes incorrectly round
	// block timestamps, which causes consensus issues - the timestamp is part of
	// the VAA and nodes using Infura would sometimes derive an incorrect VAA,
	// accidentally attacking the network by signing a conflicting VAA.
	//
	// Node operators do not usually rely on Infura in the first place - doing
	// so is insecure, since nodes blindly trust the connected nodes to verify
	// on-chain message proofs. However, node operators sometimes used
	// Infura during migrations where their primary node was offline, causing
	// the aforementioned consensus oddities which were eventually found to
	// be Infura-related. This is generally to the detriment of network security
	// and a judgement call made by individual operators. In the case of Infura,
	// we know it's actively dangerous so let's make an opinionated argument.
	//
	// Insert "I'm a sign, not a cop" meme.
	//
	if strings.Contains(*ethRPC, "mainnet.infura.io") {
		// strings.Contains(*polygonRPC, "polygon-mainnet.infura.io") {
		logger.Fatal("Infura is known to send incorrect blocks - please use your own nodes")
	}

	// polygonContractAddr := eth_common.HexToAddress(*polygonContract)
	// ethRopstenContractAddr := eth_common.HexToAddress(*ethRopstenContract)
	// avalancheContractAddr := eth_common.HexToAddress(*avalancheContract)
	// oasisContractAddr := eth_common.HexToAddress(*oasisContract)
	// auroraContractAddr := eth_common.HexToAddress(*auroraContract)
	// fantomContractAddr := eth_common.HexToAddress(*fantomContract)
	// karuraContractAddr := eth_common.HexToAddress(*karuraContract)
	// acalaContractAddr := eth_common.HexToAddress(*acalaContract)
	// klaytnContractAddr := eth_common.HexToAddress(*klaytnContract)
	// celoContractAddr := eth_common.HexToAddress(*celoContract)
	// moonbeamContractAddr := eth_common.HexToAddress(*moonbeamContract)
	// neonContractAddr := eth_common.HexToAddress(*neonContract)
	// solAddress, err := solana_types.PublicKeyFromBase58(*solanaContract)
	// if err != nil {
	// 	logger.Fatal("invalid Solana contract address", zap.Error(err))
	// }

	if unsafeDevMode {
		idx, err := devnet.GetDevnetIndex()
		if err == nil {
			*devnetGuardianIndex = idx
		} else if err != nil && cmd.Flags().Lookup("devnetGuardianIndex") == nil {
			logger.Fatal("Failed to parse hostname - are we running in devnet?", zap.Error(err))
		}
	}

	// the first guardian node is the bootstrap node on the devnet
	if unsafeDevMode && *devnetGuardianIndex != 0 {
		logger.Info("wait for the bootstrap node to establish networking", zap.Int("index", *devnetGuardianIndex))
		time.Sleep(15 * time.Second)
	}

	// In devnet mode, we generate a deterministic guardian key and write it to disk.
	if unsafeDevMode {

		// Set the guardian key path if it is not specified
		if *guardianKeyPath == "" {
			keyPath := fmt.Sprintf("/run/node/bridge.key-%d", *devnetGuardianIndex)
			guardianKeyPath = &keyPath
		}

		gk := devnet.InsecureDeterministicEcdsaKeyByIndex(ethcrypto.S256(), uint64(*devnetGuardianIndex))
		err = writeGuardianKey(gk, "auto-generated deterministic devnet key", *guardianKeyPath, true)
		if err != nil {
			logger.Fatal("failed to write devnet guardian key", zap.Error(err))
		}

		// Set the data path if it is not specified
		if *dataDir == "" {
			dbPath := fmt.Sprintf("/run/node/data-%d", *devnetGuardianIndex)
			dataDir = &dbPath
		}

		logger.Info("devnet guardian", zap.Int("index", *devnetGuardianIndex), zap.String("keyPath", *guardianKeyPath), zap.String("dbPath", *dataDir))
		if err != nil {
			logger.Fatal("failed to write devnet guardian key", zap.Error(err))
		}
	}

	// Database
	dbPath := path.Join(*dataDir, "db")
	if err := os.MkdirAll(dbPath, 0700); err != nil {
		logger.Fatal("failed to create database directory", zap.Error(err))
	}
	db, err := db.Open(dbPath)
	if err != nil {
		logger.Fatal("failed to open database", zap.Error(err))
	}
	defer db.Close()

	// Guardian key
	var guardianSigner ecdsasigner.ECDSASigner
	if *cloudKMSEnabled {
		bCtx := context.Background()
		kmsClient, err := ecdsasigner.NewKMSClient(bCtx, *cloudKMSKeyName)
		if err != nil {
			log.Fatalf("Failed to setup KMS client: %v", err)
		}
		defer kmsClient.Client.Close()
		guardianSigner = kmsClient
	} else {
		gk, err := loadGuardianKey(*guardianKeyPath)
		if err != nil {
			logger.Fatal("Failed to load guardian key from file", zap.Error(err))
		}
		guardianSigner = &ecdsasigner.ECDSAPrivateKey{Value: gk}
	}

	guardianPubkey := guardianSigner.PublicKey()
	guardianAddr := ethcrypto.PubkeyToAddress(guardianPubkey).String()
	logger.Info("Loaded guardian key", zap.String(
		"address", guardianAddr))

	p2p.DefaultRegistry.SetGuardianAddress(guardianAddr)

	// Node's main lifecycle context.
	rootCtx, rootCtxCancel = context.WithCancel(context.Background())
	defer rootCtxCancel()

	// Ethereum lock event channel
	lockC := make(chan *common.MessagePublication)

	// Ethereum incoming guardian set updates
	setC := make(chan *common.GuardianSet)

	// Outbound gossip message queue
	sendC := make(chan []byte)

	// Inbound observations
	obsvC := make(chan *gossipv1.SignedObservation, 50)

	// Inbound signed VAAs
	signedInC := make(chan *gossipv1.SignedVAAWithQuorum, 50)

	// Inbound observation requests from the p2p service (for all chains)
	obsvReqC := make(chan *gossipv1.ObservationRequest, common.ObsvReqChannelSize)

	// Outbound observation requests
	obsvReqSendC := make(chan *gossipv1.ObservationRequest, common.ObsvReqChannelSize)

	// Injected VAAs (manually generated rather than created via observation)
	injectC := make(chan *vaa.VAA)

	// Guardian set state managed by processor
	gst := common.NewGuardianSetState(nil)

	// Per-chain observation requests
	chainObsvReqC := make(map[vaa.ChainID]chan *gossipv1.ObservationRequest)

	// Observation request channel for each chain supporting observation requests.
	chainObsvReqC[vaa.ChainIDEthereum] = make(chan *gossipv1.ObservationRequest, observationRequestBufferSize)
	chainObsvReqC[vaa.ChainIDBSC] = make(chan *gossipv1.ObservationRequest, observationRequestBufferSize)
	chainObsvReqC[vaa.ChainIDAlephium] = make(chan *gossipv1.ObservationRequest, observationRequestBufferSize)

	go handleReobservationRequests(rootCtx, clock.New(), logger, obsvReqC, chainObsvReqC)

	var notifier *discord.DiscordNotifier
	if *discordToken != "" {
		notifier, err = discord.NewDiscordNotifier(*discordToken, *discordChannel, logger)
		if err != nil {
			logger.Error("failed to initialize Discord bot", zap.Error(err))
		}
	}

	// Load p2p private key
	var priv crypto.PrivKey
	if unsafeDevMode {
		priv = devnet.DeterministicP2PPrivKeyByIndex(int64(*devnetGuardianIndex))
	} else {
		priv, err = common.GetOrCreateNodeKey(logger, *nodeKeyPath)
		if err != nil {
			logger.Fatal("Failed to load node key", zap.Error(err))
		}
	}

	// Enable unless it is disabled. For devnet, only when --telemetryKey is set.
	if !*disableTelemetry && (!unsafeDevMode || unsafeDevMode && *telemetryKey != "") {
		logger.Info("Telemetry enabled")

		if *telemetryKey == "" {
			logger.Fatal("Please specify --telemetryKey")
		}

		creds, err := decryptTelemetryServiceAccount()
		if err != nil {
			logger.Fatal("Failed to decrypt telemetry service account", zap.Error(err))
		}

		// Get libp2p peer ID from private key
		pk := priv.GetPublic()
		peerID, err := peer.IDFromPublicKey(pk)
		if err != nil {
			logger.Fatal("Failed to get peer ID from private key", zap.Error(err))
		}

		tm, err := telemetry.New(context.Background(), telemetryProject, creds, map[string]string{
			"node_name":     *nodeName,
			"node_key":      peerID.Pretty(),
			"guardian_addr": guardianAddr,
			"network":       *p2pNetworkID,
			"version":       version.Version(),
		})
		if err != nil {
			logger.Fatal("Failed to initialize telemetry", zap.Error(err))
		}
		defer tm.Close()
		logger = tm.WrapLogger(logger)
	} else {
		logger.Info("Telemetry disabled")
	}

	// Redirect ipfs logs to plain zap
	ipfslog.SetPrimaryCore(logger.Core())

	// provides methods for reporting progress toward message attestation, and channels for receiving attestation lifecyclye events.
	attestationEvents := reporter.EventListener(logger)

	publicrpcService, publicrpcServer, err := publicrpcServiceRunnable(logger, *publicRPC, db, gst, governanceChainId, governanceEmitterAddress)

	if err != nil {
		log.Fatal("failed to create publicrpc service socket", zap.Error(err))
	}

	// local admin service socket
	adminService, err := adminServiceRunnable(logger, *adminSocketPath, injectC, signedInC, obsvReqSendC, db, gst, governanceChainId, governanceEmitterAddress)
	if err != nil {
		logger.Fatal("failed to create admin service socket", zap.Error(err))
	}

	publicwebService, err := publicwebServiceRunnable(logger, *publicWeb, *publicRPC, publicrpcServer,
		*tlsHostname, *tlsProdEnv, path.Join(*dataDir, "autocert"), publicrpcv1.RegisterPublicRPCServiceHandler)
	if err != nil {
		log.Fatal("failed to create publicrpc service socket", zap.Error(err))
	}

	// Run supervisor.
	supervisor.New(rootCtx, logger, func(ctx context.Context) error {
		if err := supervisor.Run(ctx, "p2p", p2p.Run(
			obsvC, obsvReqC, obsvReqSendC, sendC, signedInC, priv, guardianSigner, gst, *p2pPort, *p2pNetworkID, *p2pBootstrap, *nodeName, *disableHeartbeatVerify, rootCtxCancel)); err != nil {
			return err
		}

		if err := supervisor.Run(ctx, "ethwatch",
			ethereum.NewEthWatcher(*ethRPC, ethContract, "eth", common.ReadinessEthSyncing, vaa.ChainIDEthereum, lockC, setC, chainObsvReqC[vaa.ChainIDEthereum], unsafeDevMode, ethPollIntervalMs, false).Run); err != nil {
			return err
		}

		if *bscRPC != "" {
			if err := supervisor.Run(ctx, "bscwatch",
				ethereum.NewEthWatcher(*bscRPC, bscContract, "bsc", common.ReadinessBSCSyncing, vaa.ChainIDBSC, lockC, setC, chainObsvReqC[vaa.ChainIDBSC], unsafeDevMode, bscPollIntervalMs, true).Run); err != nil {
				return err
			}
		}

		// if err := supervisor.Run(ctx, "algorandwatch",
		// 	algorand.NewWatcher(*algorandIndexerRPC, *algorandIndexerToken, *algorandAlgodRPC, *algorandAlgodToken, *algorandAppID, lockC, setC, chainObsvReqC[vaa.ChainIDAlgorand]).Run); err != nil {
		// 	return err
		// }

		alphWatcher, err := alephium.NewAlephiumWatcher(
			*alphRPC, *alphApiKey, alphConfig, common.ReadinessAlephiumSyncing,
			lockC, *alphPollIntervalMs, chainObsvReqC[vaa.ChainIDAlephium],
		)
		if err != nil {
			logger.Error("failed to create alephium watcher", zap.Error(err))
			return err
		}
		if err := supervisor.Run(ctx, "alph-watcher", alphWatcher.Run); err != nil {
			logger.Error("failed to run alephium watcher", zap.Error((err)))
		}

		p := processor.NewProcessor(ctx,
			db,
			lockC,
			setC,
			sendC,
			obsvC,
			obsvReqSendC,
			injectC,
			signedInC,
			guardianSigner,
			gst,
			attestationEvents,
			notifier,
			governanceChainId,
			governanceEmitterAddress,
		)
		if err := supervisor.Run(ctx, "processor", p.Run); err != nil {
			return err
		}

		if err := supervisor.Run(ctx, "admin", adminService); err != nil {
			return err
		}
		if *publicRPC != "" {
			if err := supervisor.Run(ctx, "publicrpc", publicrpcService); err != nil {
				return err
			}
		}
		if *publicWeb != "" {
			if err := supervisor.Run(ctx, "publicweb", publicwebService); err != nil {
				return err
			}
		}

		logger.Info("Started internal services")

		<-ctx.Done()
		return nil
	},
		// It's safer to crash and restart the process in case we encounter a panic,
		// rather than attempting to reschedule the runnable.
		supervisor.WithPropagatePanic)

	<-rootCtx.Done()
	logger.Info("root context cancelled, exiting...")
	// TODO: wait for things to shut down gracefully
}

func decryptTelemetryServiceAccount() ([]byte, error) {
	// Decrypt service account credentials
	key, err := base64.StdEncoding.DecodeString(*telemetryKey)
	if err != nil {
		return nil, fmt.Errorf("failed to decode: %w", err)
	}

	ciphertext, err := base64.StdEncoding.DecodeString(telemetryServiceAccount)
	if err != nil {
		panic(err)
	}

	creds, err := common.DecryptAESGCM(ciphertext, key)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	return creds, err
}
