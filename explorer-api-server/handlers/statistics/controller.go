package statistics

import (
	"fmt"

	"github.com/alephium/wormhole-fork/explorer-backend/fly/utils"
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

type Controller struct {
	srv    *Service
	logger *zap.Logger
}

func NewController(serv *Service, logger *zap.Logger) *Controller {
	return &Controller{srv: serv, logger: logger.With(zap.String("module", "StatisticController"))}
}

func (c *Controller) TotalMessages(ctx *fiber.Ctx) error {
	totals, err := c.srv.TotalMessages(ctx.Context())
	if err != nil {
		return err
	}

	totalMessagePerEmitter := map[string]uint32{}
	for k, v := range totals.TotalMessagesPerEmitter {
		key := fmt.Sprintf("%v:%v:%v", k.date, uint16(k.chainId), k.address)
		totalMessagePerEmitter[key] = v
	}

	response := struct {
		TotalMessagesPerEmitter map[string]uint32 `json:"totalMessagesPerEmitter"`
	}{
		TotalMessagesPerEmitter: totalMessagePerEmitter,
	}
	return ctx.JSON(response)
}

func (c *Controller) TotalNotionalTransferred(ctx *fiber.Ctx) error {
	totals, err := c.srv.TotalNotionalTransferred(ctx.Context())
	if err != nil {
		return err
	}

	totalNotionalTransferred := map[string]string{}
	for k, v := range totals.TotalTransferred {
		token, err := c.srv.repo.getToken(ctx.Context(), k.tokenChain, k.tokenAddress)
		if err != nil {
			c.logger.Error("failed to get token", zap.Uint16("chainId", uint16(k.tokenChain)), zap.String("address", k.tokenAddress))
			continue
		}
		key := fmt.Sprintf("%v:%v:%v", uint16(k.emitterChain), uint16(k.targetChain), token.Symbol)
		totalNotionalTransferred[key] = fmt.Sprintf("%v", v)
	}

	response := struct {
		NotionalTransferred map[string]string `json:"notionalTransferred"`
	}{
		NotionalTransferred: totalNotionalTransferred,
	}
	return ctx.JSON(response)
}

func (c *Controller) TotalNotionalTransferredTo(ctx *fiber.Ctx) error {
	totals, err := c.srv.TotalNotionalTransferredTo(ctx.Context())
	if err != nil {
		return err
	}

	totalNotionalTransferredTo := map[string]string{}
	for k, v := range totals.TotalTransferred {
		token, err := c.srv.repo.getToken(ctx.Context(), k.tokenChain, k.tokenAddress)
		if err != nil {
			c.logger.Error("failed to get token", zap.Uint16("chainId", uint16(k.tokenChain)), zap.String("address", k.tokenAddress))
			continue
		}
		key := fmt.Sprintf("%v:%v:%v", k.date, uint16(k.targetChain), token.Symbol)
		totalNotionalTransferredTo[key] = fmt.Sprintf("%v", v)
	}

	response := struct {
		NotionalTransferredTo map[string]string `json:"notionalTransferredTo"`
	}{
		NotionalTransferredTo: totalNotionalTransferredTo,
	}
	return ctx.JSON(response)
}

func (c *Controller) NotionalTVL(ctx *fiber.Ctx) error {
	tvl, err := c.srv.TVL(ctx.Context())
	if err != nil {
		return err
	}

	coinIds := make([]string, 0)
	tokens := map[TVLKey]*TokenDoc{}
	for k := range tvl.TVL {
		token, err := c.srv.repo.getToken(ctx.Context(), k.tokenChain, k.tokenAddress)
		if err != nil {
			c.logger.Error("failed to get token", zap.Uint16("chainId", uint16(k.tokenChain)), zap.String("address", k.tokenAddress))
			continue
		}
		if token.CoinGeckoCoinId != "" {
			coinIds = append(coinIds, token.CoinGeckoCoinId)
		}
		tokens[k] = token
	}

	prices, err := utils.FetchTokenPrices(ctx.Context(), coinIds)
	if err != nil {
		return err
	}

	notionalTVL := map[string]string{}
	for k, v := range tvl.TVL {
		token, exist := tokens[k]
		if !exist || token.CoinGeckoCoinId == "" {
			continue
		}
		price := prices[token.CoinGeckoCoinId]
		notionalUSD := utils.CalcNotionalAmount(v, token.Decimals, price)
		key := fmt.Sprintf("%v:%v", uint16(k.tokenChain), token.Symbol)
		notionalTVL[key] = fmt.Sprintf("%v", notionalUSD)
	}

	response := struct {
		NotionalTVL map[string]string `json:"notionalTVL"`
	}{
		NotionalTVL: notionalTVL,
	}
	return ctx.JSON(response)
}

func (c *Controller) GetAllTokens(ctx *fiber.Ctx) error {
	tokens, err := c.srv.GetAllTokens(ctx.Context())
	if err != nil {
		return err
	}
	return ctx.JSON(tokens)
}
