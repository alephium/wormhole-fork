package server

import (
	"strconv"

	"github.com/alephium/wormhole-fork/explorer-backend/storage"
	"github.com/gofiber/fiber/v2"
	fiberLog "github.com/gofiber/fiber/v2/middleware/logger"
	"go.uber.org/zap"
)

type Server struct {
	app    *fiber.App
	port   string
	logger *zap.Logger
}

func NewServer(logger *zap.Logger, repository *storage.Repository, apiPort uint) *Server {
	ctrl := NewController(repository)
	app := fiber.New()
	app.Use(fiberLog.New(fiberLog.Config{
		Format: "level=info timestamp=${time} method=${method} path=${path} status${status} request_id=${locals:requestid}\n",
	}))
	api := app.Group("/api")
	api.Get("/health", ctrl.HealthCheck)
	api.Get("/ready", ctrl.ReadyCheck)
	return &Server{
		app:    app,
		port:   strconv.FormatUint(uint64(apiPort), 10),
		logger: logger,
	}
}

// Start listen serves HTTP requests from addr.
func (s *Server) Start() {
	go func() {
		s.app.Listen(":" + s.port)
	}()
}

// Stop gracefull server.
func (s *Server) Stop() {
	_ = s.app.Shutdown()
}
