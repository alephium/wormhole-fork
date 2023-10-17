// Package observations handle the request of VAA data from governor endpoint defined in the api.
package vaa

import (
	"encoding/hex"
	"strconv"

	"github.com/alephium/wormhole-fork/explorer-api-server/middleware"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

// Controller definition.
type Controller struct {
	srv    *Service
	logger *zap.Logger
}

// NewController create a new controler.
func NewController(serv *Service, logger *zap.Logger) *Controller {
	return &Controller{srv: serv, logger: logger.With(zap.String("module", "VaaController"))}
}

// FindAll handler for the endpoint /vaas/.
func (c *Controller) FindAll(ctx *fiber.Ctx) error {
	p, err := middleware.ExtractPagination(ctx)
	if err != nil {
		return err
	}
	vaas, err := c.srv.FindAll(ctx.Context(), p)
	if err != nil {
		return err
	}
	return ctx.JSON(vaas)
}

func tryToNumber(numStr string, size int) (*uint, error) {
	if numStr == "" {
		return nil, nil
	}
	n, err := strconv.ParseUint(numStr, 10, size)
	num := uint(n)
	return &num, err
}

func (c *Controller) FindRecent(ctx *fiber.Ctx) error {
	numRows, err := tryToNumber(ctx.Query("numRows"), 32)
	if err != nil {
		return err
	}
	emitterChain, err := tryToNumber(ctx.Query("emitterChain"), 16)
	if err != nil {
		return err
	}
	emitterAddr := ctx.Query("emitterAddr")
	vaas, err := c.srv.FindRecent(ctx.Context(), numRows, emitterChain, emitterAddr)
	if err != nil {
		return err
	}
	return ctx.JSON(vaas)
}

// FindByChain handler for the endpoint /vaas/:emitterChain.
func (c *Controller) FindByChain(ctx *fiber.Ctx) error {
	p, err := middleware.ExtractPagination(ctx)
	if err != nil {
		return err
	}
	chainID, err := middleware.ExtractEmitterChainID(ctx, c.logger)
	if err != nil {
		return err
	}
	vaas, err := c.srv.FindByChain(ctx.Context(), chainID, p)
	if err != nil {
		return err
	}
	return ctx.JSON(vaas)
}

// FindByEmitter handler for the endpoint /vaas/:emitterChain/:emitterAddress.
func (c *Controller) FindByEmitter(ctx *fiber.Ctx) error {
	p, err := middleware.ExtractPagination(ctx)
	if err != nil {
		return err
	}
	chainID, emitter, err := middleware.ExtractVAAChainIDEmitter(ctx, c.logger)
	if err != nil {
		return err
	}
	vaas, err := c.srv.FindByEmitter(ctx.Context(), chainID, emitter, p)
	if err != nil {
		return err
	}
	return ctx.JSON(vaas)
}

// FindByEmitterAndTargetChain handler for the endpoint /vaas/:emitterChain/:emitterAddress/:targetChain
func (c *Controller) FindByEmitterAndTargetChain(ctx *fiber.Ctx) error {
	p, err := middleware.ExtractPagination(ctx)
	if err != nil {
		return err
	}
	emitterChain, emitterAddress, targetChain, err := middleware.ExtractVAAEmitterAndTargetChainId(ctx, c.logger)
	if err != nil {
		return err
	}
	vaas, err := c.srv.FindByEmitterAndTargetChain(ctx.Context(), emitterChain, emitterAddress, targetChain, p)
	if err != nil {
		return err
	}
	return ctx.JSON(vaas)
}

// FindById handler for the endpoint /vaas/:emitterChain/:emitterAddress/:targetChain/:sequence.
func (c *Controller) FindById(ctx *fiber.Ctx) error {
	emitterChain, addr, targetChain, seq, err := middleware.ExtractVAAParams(ctx, c.logger)
	if err != nil {
		return err
	}

	vaa, err := c.srv.FindById(ctx.Context(), emitterChain, addr, targetChain, seq)
	if err != nil {
		return err
	}
	return ctx.JSON(vaa)
}

func (c *Controller) GetNextGovernanceSequence(ctx *fiber.Ctx) error {
	emitterChain, addr, err := middleware.ExtractVAAChainIDEmitter(ctx, c.logger)
	if err != nil {
		return err
	}

	sequence, err := c.srv.GetNextGovernanceSequence(ctx.Context(), emitterChain, addr)
	if err != nil {
		return err
	}
	response := struct {
		Sequence uint64 `json:"sequence"`
	}{
		Sequence: *sequence,
	}
	return ctx.JSON(response)
}

// FindByTxId handler for the endpoint /vaas/transactions/:txId
func (c *Controller) FindByTxId(ctx *fiber.Ctx) error {
	txId, err := middleware.ExtractTransactionId(ctx, c.logger)
	if err != nil {
		return err
	}
	txIdBytes, err := hex.DecodeString(txId)
	if err != nil {
		return err
	}
	vaa, err := c.srv.FindByTxId(ctx.Context(), txIdBytes)
	if err != nil {
		return err
	}
	return ctx.JSON(vaa)
}

// FindSignedVAAByID get a VAA []byte from a emitter chain, emitter address, target chain and sequence.
// This endpoint has been migrated from the guardian grpc api.
func (c *Controller) FindSignedVAAByID(ctx *fiber.Ctx) error {
	emitterChain, addr, targetChain, seq, err := middleware.ExtractVAAParams(ctx, c.logger)
	if err != nil {
		return err
	}

	vaa, err := c.srv.FindById(ctx.Context(), emitterChain, addr, targetChain, seq)
	if err != nil {
		return err
	}
	response := struct {
		VaaBytes []byte `json:"vaaBytes"`
	}{
		VaaBytes: vaa.Data.Vaa,
	}
	return ctx.JSON(response)
}

// GetVaaCount handler for the endpoint /vaas/vaa-counts.
func (c *Controller) GetVaaCount(ctx *fiber.Ctx) error {
	p, err := middleware.ExtractPagination(ctx)
	if err != nil {
		return err
	}
	vaas, err := c.srv.GetVaaCount(ctx.Context(), p)
	if err != nil {
		return err
	}
	return ctx.JSON(vaas)
}
