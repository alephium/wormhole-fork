package transactions

import (
	"fmt"

	"github.com/alephium/wormhole-fork/explorer-api-server/middleware"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/btcsuite/btcutil/base58"
	"github.com/ethereum/go-ethereum/common"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

type Controller struct {
	srv    *Service
	logger *zap.Logger
}

func NewController(serv *Service, logger *zap.Logger) *Controller {
	return &Controller{srv: serv, logger: logger.With(zap.String("module", "TransactionsController"))}
}

func (c *Controller) extractSender(ctx *fiber.Ctx) (*sender, error) {
	emitterChain, err := middleware.ExtractEmitterChainID(ctx, c.logger)
	if err != nil {
		return nil, err
	}
	targetChain, err := middleware.ExtractTargetChainID(ctx, c.logger)
	if err != nil {
		return nil, err
	}
	addressParam := ctx.Params("address")
	address, err := validateAddress(emitterChain, addressParam)
	if err != nil {
		return nil, err
	}
	return &sender{*address, emitterChain, targetChain}, nil
}

func (c *Controller) GetTransactionsBySender(ctx *fiber.Ctx) error {
	p, err := middleware.ExtractPagination(ctx)
	if err != nil {
		return err
	}
	sender, err := c.extractSender(ctx)
	if err != nil {
		return err
	}
	transactions, err := c.srv.GetTransactionsBySender(ctx.Context(), sender, p)
	if err != nil {
		return err
	}
	return ctx.JSON(transactions)
}

func (c *Controller) GetTransactionNumberBySender(ctx *fiber.Ctx) error {
	sender, err := c.extractSender(ctx)
	if err != nil {
		return err
	}
	txNumber, err := c.srv.GetTransactionNumberBySender(ctx.Context(), sender)
	if err != nil {
		return err
	}
	response := struct {
		TxNumber int64 `json:"txNumber"`
	}{
		TxNumber: *txNumber,
	}
	return ctx.JSON(response)
}

func validateAddress(emitterChainId vaa.ChainID, address string) (*string, error) {
	switch emitterChainId {
	case vaa.ChainIDAlephium:
		bs := base58.Decode(address)
		if len(bs) == 0 {
			return nil, fmt.Errorf("invalid alephium address")
		}
		return &address, nil
	case vaa.ChainIDEthereum, vaa.ChainIDBSC:
		if !common.IsHexAddress(address) {
			return nil, fmt.Errorf("invalid %v address", emitterChainId.String())
		}
		// returns an EIP55-compliant hex string representation of the address
		addr := common.HexToAddress(address).Hex()
		return &addr, nil
	default:
		return nil, fmt.Errorf("invalid emitter chain id")
	}
}

type sender struct {
	address      string
	emitterChain vaa.ChainID
	targetChain  vaa.ChainID
}
