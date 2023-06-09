package guardian

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// Controller definition.
type Controller struct {
	srv    *Service
	logger *zap.Logger
}

// NewController create a new controler.
func NewController(srv *Service, logger *zap.Logger) *Controller {
	return &Controller{
		srv:    srv,
		logger: logger.With(zap.String("module", "GuardianController")),
	}
}

func (c *Controller) GetCurrentGuardianSet(ctx context.Context) (*GuardianSetDoc, error) {
	return c.srv.GetCurrentGuardianSet(ctx)
}

// GetGuardianSet handler for the endpoint /api/guardianset/current
// This endpoint has been migrated from the guardian grpc api.
func (c *Controller) GetGuardianSet(ctx *fiber.Ctx) error {
	guardianSet, err := c.GetCurrentGuardianSet(ctx.Context())
	if err != nil {
		return err
	}
	return ctx.Status(fiber.StatusOK).JSON(*guardianSet)
}
