package statistics

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"math/big"
	"net/http"
	"strings"
	"time"

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

// TODO: improve this
func fetchTokenPrices(ctx context.Context, coinIds []string) (map[string]float64, error) {
	allPrices := map[string]float64{}

	// Split the list into batches, otherwise the request could be too large
	batch := 100

	for i := 0; i < len(coinIds); i += batch {
		j := i + batch
		if j > len(coinIds) {
			j = len(coinIds)
		}

		prices, err := fetchCoinGeckoPrices(coinIds[i:j])
		if err != nil {
			return nil, err
		}
		for coinId, price := range prices {
			allPrices[coinId] = price
		}

		// CoinGecko rate limit is low (5/second), be very cautious about bursty requests
		time.Sleep(time.Millisecond * 200)
	}

	return allPrices, nil
}

type Price struct {
	USD float64 `json:"usd"`
}
type CoinGeckoCoinPrices map[string]Price
type CoinGeckoErrorRes struct {
	Error string `json:"error"`
}

// takes a list of CoinGeckoCoinIds, returns a map of { coinId: price }.
func fetchCoinGeckoPrices(coinIds []string) (map[string]float64, error) {
	baseUrl := "https://api.coingecko.com/api/v3/"
	url := fmt.Sprintf("%vsimple/price?ids=%v&vs_currencies=usd", baseUrl, strings.Join(coinIds, ","))
	req, reqErr := http.NewRequest("GET", url, nil)
	if reqErr != nil {
		log.Fatalf("failed coins request, err: %v\n", reqErr)
	}

	res, resErr := http.DefaultClient.Do(req)
	if resErr != nil {
		return nil, fmt.Errorf("failed to fetch prices, err: %v", resErr)
	}
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("failed to get coingecko prices, status: %v", res.Status)
	}

	defer res.Body.Close()
	body, bodyErr := ioutil.ReadAll(res.Body)
	if bodyErr != nil {
		return nil, fmt.Errorf("failed to decode response body, err: %v", bodyErr)
	}

	var parsed CoinGeckoCoinPrices
	parseErr := json.Unmarshal(body, &parsed)
	if parseErr != nil {
		var errRes CoinGeckoErrorRes
		if err := json.Unmarshal(body, &errRes); err == nil {
			return nil, fmt.Errorf(errRes.Error)
		}
		return nil, fmt.Errorf("failed to decode payload, err: %v", parseErr)
	}
	priceMap := map[string]float64{}
	for coinId, price := range parsed {
		price := price.USD
		priceMap[coinId] = price

	}
	return priceMap, nil
}

func calcNotionalAmount(amount *big.Int, decimals uint8, price float64) *big.Float {
	// transfers created by the bridge UI will have at most 8 decimals.
	if decimals > 8 {
		decimals = 8
	}
	unit := big.NewInt(0).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	result := big.NewFloat(0).SetInt(amount)
	result.Quo(result, big.NewFloat(0).SetInt(unit))
	result.Mul(result, big.NewFloat(price))
	return result
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

	prices, err := fetchTokenPrices(ctx.Context(), coinIds)
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
		notionalUSD := calcNotionalAmount(v, token.Decimals, price)
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
