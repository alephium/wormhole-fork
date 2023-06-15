package server

import (
	"context"

	"github.com/alephium/wormhole-fork/explorer-backend/storage"
	"github.com/gofiber/fiber/v2"
)

// Controller definition.
type Controller struct {
	repository *storage.Repository
}

// NewController creates a Controller instance.
func NewController(repo *storage.Repository) *Controller {
	return &Controller{repository: repo}
}

// HealthCheck handler for the endpoint /health.
func (c *Controller) HealthCheck(ctx *fiber.Ctx) error {
	return ctx.JSON(struct {
		Status string `json:"status"`
	}{Status: "OK"})
}

// ReadyCheck handler for the endpoint /ready
func (c *Controller) ReadyCheck(ctx *fiber.Ctx) error {
	// check mongo db is ready.
	mongoStatus := c.checkMongoStatus(ctx.Context())
	if !mongoStatus {
		return ctx.Status(fiber.StatusInternalServerError).JSON(struct {
			Ready string `json:"ready"`
		}{Ready: "NO"})
	}

	// return success response.
	return ctx.Status(fiber.StatusOK).JSON(struct {
		Ready string `json:"ready"`
	}{Ready: "OK"})
}

func (c *Controller) checkMongoStatus(ctx context.Context) bool {
	mongoStatus, err := c.repository.GetMongoStatus(ctx)
	if err != nil {
		return false
	}

	// check mongo server status
	mongoStatusCheck := (mongoStatus.Ok == 1 && mongoStatus.Pid > 0 && mongoStatus.Uptime > 0)
	if !mongoStatusCheck {
		return false
	}

	// check mongo connections
	if mongoStatus.Connections.Available <= 0 {
		return false
	}
	return true
}
