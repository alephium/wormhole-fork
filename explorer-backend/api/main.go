package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/alephium/wormhole-fork/explorer-backend/api/handlers/guardian"
	"github.com/alephium/wormhole-fork/explorer-backend/api/handlers/heartbeats"
	"github.com/alephium/wormhole-fork/explorer-backend/api/handlers/infraestructure"
	"github.com/alephium/wormhole-fork/explorer-backend/api/handlers/observations"
	"github.com/alephium/wormhole-fork/explorer-backend/api/handlers/vaa"
	wormscanCache "github.com/alephium/wormhole-fork/explorer-backend/api/internal/cache"
	"github.com/alephium/wormhole-fork/explorer-backend/api/internal/db"
	"github.com/alephium/wormhole-fork/explorer-backend/api/middleware"
	"github.com/alephium/wormhole-fork/explorer-backend/api/response"
	"github.com/ansrivas/fiberprometheus/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cache"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	ipfslog "github.com/ipfs/go-log/v2"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
)

var cacheConfig = cache.Config{
	Next: func(c *fiber.Ctx) bool {
		return c.Query("refresh") == "true"
	},
	Expiration:           1 * time.Second,
	CacheControl:         true,
	StoreResponseHeaders: true,
}

var rootCmd = &cobra.Command{
	Use:   "explorer",
	Short: "Wormhole explorer backend",
	Run:   run,
}

var (
	port             *uint
	logLevel         *string
	enableCache      *bool
	redisUri         *string
	mongodbUri       *string
	mongodbName      *string
	enableStackTrace *bool
)

func init() {
	port = rootCmd.Flags().Uint("port", 8100, "Server API port")
	logLevel = rootCmd.Flags().String("logLevel", "debug", "Log level")
	enableCache = rootCmd.Flags().Bool("enableCache", false, "Enable last sequence cache")
	redisUri = rootCmd.Flags().String("redisUri", "", "Redis URI(you need to specify this if enableCache is true)")
	mongodbUri = rootCmd.Flags().String("mongodbUri", "", "Mongodb URI")
	mongodbName = rootCmd.Flags().String("mongodbName", "", "Mongodb Name")
	enableStackTrace = rootCmd.Flags().Bool("enableStackTrace", false, "Enable stack trace")
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
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func run(cmd *cobra.Command, args []string) {
	appCtx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Logging
	lvl, err := ipfslog.LevelFromString(*logLevel)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Invalid logging level set: %v", *logLevel)
		panic(err)
	}

	rootLogger := ipfslog.Logger("wormhole-api").Desugar()
	ipfslog.SetAllLoggers(lvl)

	checkConfigs(rootLogger)

	// Setup DB
	cli, err := db.Connect(appCtx, *mongodbUri)
	if err != nil {
		rootLogger.Fatal("Failed to connected to mongodb")
	}
	db := cli.Database(*mongodbName)

	// Get cache get function
	cacheGetFunc := NewCache(rootLogger)

	// Setup repositories
	vaaRepo := vaa.NewRepository(db, rootLogger)
	obsRepo := observations.NewRepository(db, rootLogger)
	infraestructureRepo := infraestructure.NewRepository(db, rootLogger)
	heartbeatsRepo := heartbeats.NewRepository(db, rootLogger)
	guardianSetRepo := guardian.NewRepository(db, rootLogger)

	// Setup services
	vaaService := vaa.NewService(vaaRepo, cacheGetFunc, rootLogger)
	obsService := observations.NewService(obsRepo, rootLogger)
	infraestructureService := infraestructure.NewService(infraestructureRepo, rootLogger)
	heartbeatsService := heartbeats.NewService(heartbeatsRepo, rootLogger)
	guardianService := guardian.NewService(guardianSetRepo, rootLogger)

	// Setup controllers
	vaaCtrl := vaa.NewController(vaaService, rootLogger)
	observationsCtrl := observations.NewController(obsService, rootLogger)
	infraestructureCtrl := infraestructure.NewController(infraestructureService)
	guardianCtrl := guardian.NewController(guardianService, rootLogger)
	heartbeatsCtrl := heartbeats.NewController(heartbeatsService, rootLogger)

	// Setup app with custom error handling.
	response.SetEnableStackTrace(*enableStackTrace)
	app := fiber.New(fiber.Config{ErrorHandler: middleware.ErrorHandler})

	// Middleware
	prometheus := fiberprometheus.New("wormscan")
	prometheus.RegisterAt(app, "/metrics")
	app.Use(prometheus.Middleware)

	app.Use(requestid.New())
	app.Use(logger.New(logger.Config{
		Format: "level=info timestamp=${time} method=${method} path=${path} status${status} request_id=${locals:requestid}\n",
	}))

	api := app.Group("/api")
	api.Use(cors.New()) // TODO CORS restrictions?
	api.Use(middleware.ExtractPagination)

	api.Get("/health", infraestructureCtrl.HealthCheck)
	api.Get("/ready", infraestructureCtrl.ReadyCheck)

	// vaas resource
	vaas := api.Group("/vaas")
	vaas.Use(cache.New(cacheConfig))
	vaas.Get("/vaa-counts", vaaCtrl.GetVaaCount)
	vaas.Get("/recent", vaaCtrl.FindRecent)
	vaas.Get("/transactions/:txId", vaaCtrl.FindByTxId)
	vaas.Get("/:emitterChain", vaaCtrl.FindByChain)
	vaas.Get("/:emitterChain/:emitterAddress", vaaCtrl.FindByEmitter)
	vaas.Get("/:emitterChain/:emitterAddress/:targetChain", vaaCtrl.FindByEmitterAndTargetChain)
	vaas.Get("/:emitterChain/:emitterAddress/:targetChain/:sequence", vaaCtrl.FindById)

	// oservations resource
	observations := api.Group("/observations")
	observations.Get("/:emitterChain", observationsCtrl.FindAllByChain)
	observations.Get("/:emitterChain/:emitterAddress", observationsCtrl.FindAllByEmitter)
	observations.Get("/:emitterChain/:emitterAddress/:targetChain", observationsCtrl.FindAllByEmitterAndTargetChain)
	observations.Get("/:emitterChain/:emitterAddress/:targetChain/:sequence", observationsCtrl.FindAllByVAA)
	observations.Get("/:emitterChain/:emitterAddress/:targetChain/:sequence/:signer/:hash", observationsCtrl.FindOne)

	// guardianSet resource.
	guardianSet := api.Group("/guardianset")
	guardianSet.Get("/current", guardianCtrl.GetGuardianSet)
	// heartbeats resource.
	heartbeats := api.Group("/heartbeats")
	heartbeats.Get("", func(ctx *fiber.Ctx) error {
		gs, err := guardianCtrl.GetCurrentGuardianSet(ctx.Context())
		if err != nil {
			return err
		}
		return heartbeatsCtrl.GetLastHeartbeats(ctx, gs.Addresses)
	})

	app.Listen(":" + strconv.Itoa(int(*port)))
}

// NewCache return a CacheGetFunc to get a value by a Key from cache.
func NewCache(looger *zap.Logger) wormscanCache.CacheGetFunc {
	if !*enableCache {
		dummyCacheClient := wormscanCache.NewDummyCacheClient()
		return dummyCacheClient.Get
	}
	cacheClient := wormscanCache.NewCacheClient(*redisUri, true, looger)
	return cacheClient.Get
}
