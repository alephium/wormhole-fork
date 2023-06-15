package utils

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

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
)

type CoinGeckoCoin struct {
	Id     string `json:"id"`
	Symbol string `json:"symbol"`
	Name   string `json:"name"`
}

const coinGeckoUrl = "https://api.coingecko.com/api/v3/"

var CoinGeckoCoins map[string][]CoinGeckoCoin

func FetchCoinGeckoCoins() {
	url := fmt.Sprintf("%vcoins/list", coinGeckoUrl)
	req, reqErr := http.NewRequest("GET", url, nil)
	if reqErr != nil {
		log.Fatalf("failed coins request, err: %v", reqErr)
	}

	result, err := fetch[[]CoinGeckoCoin](req)
	if err != nil {
		log.Fatalf("failed to fetch coin list, err: %v", err)
	}

	var geckoCoins = map[string][]CoinGeckoCoin{}
	for _, coin := range *result {
		symbol := strings.ToLower(coin.Symbol)
		geckoCoins[symbol] = append(geckoCoins[symbol], coin)
	}
	CoinGeckoCoins = geckoCoins
}

func FetchCoinGeckoCoin(chainId vaa.ChainID, symbol, name string) *CoinGeckoCoin {
	if tokens, ok := CoinGeckoCoins[strings.ToLower(symbol)]; ok {
		if len(tokens) == 1 {
			return &tokens[0]
		}
		for _, token := range tokens {
			if token.Name == name {
				return &token
			}
			if strings.Contains(strings.ToLower(strings.ReplaceAll(name, " ", "")), strings.ReplaceAll(token.Id, "-", "")) {
				return &token
			}
		}
	}
	return nil
}

type CoinGeckoMarket [2]float64

type CoinGeckoMarketRes struct {
	Prices []CoinGeckoMarket `json:"prices"`
}

type CoinGeckoErrorRes struct {
	Error string `json:"error"`
}

func rangeFromTime(t time.Time, hours int) (start time.Time, end time.Time) {
	duration := time.Duration(hours) * time.Hour
	return t.Add(-duration), t.Add(duration)
}

func fetch[T any](request *http.Request) (*T, error) {
	res, resErr := http.DefaultClient.Do(request)
	if resErr != nil {
		return nil, fmt.Errorf("failed to fetch, err: %v", resErr)
	}
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("invalid status code: %v", res.StatusCode)
	}

	defer res.Body.Close()
	body, bodyErr := ioutil.ReadAll(res.Body)
	if bodyErr != nil {
		return nil, fmt.Errorf("failed to read response body, err: %v", bodyErr)
	}

	var result T
	parseErr := json.Unmarshal(body, &result)
	if parseErr != nil {
		var errRes CoinGeckoErrorRes
		if err := json.Unmarshal(body, &errRes); err == nil {
			return nil, fmt.Errorf(errRes.Error)
		}
		return nil, fmt.Errorf("failed to decode response, err: %v", parseErr)
	}
	return &result, nil
}

func FetchCoinGeckoPrice(coinId string, timestamp time.Time) (float64, error) {
	start, end := rangeFromTime(timestamp, 12)
	priceUrl := fmt.Sprintf("%vcoins/%v/market_chart/range?vs_currency=usd&from=%v&to=%v", coinGeckoUrl, coinId, start.Unix(), end.Unix())
	req, reqErr := http.NewRequest("GET", priceUrl, nil)
	if reqErr != nil {
		return 0, reqErr
	}

	result, err := fetch[CoinGeckoMarketRes](req)
	if err != nil {
		return 0, err
	}
	if len(result.Prices) >= 1 {
		hourAgo := time.Now().Add(-time.Duration(1) * time.Hour)
		withinLastHour := timestamp.After(hourAgo)
		var priceIndex int
		if withinLastHour {
			// use the last price in the list, latest price
			priceIndex = len(result.Prices) - 1
		} else {
			// use a price from the middle of the list, as that should be
			// closest to the timestamp.
			numPrices := len(result.Prices)
			priceIndex = numPrices / 2
		}
		price := result.Prices[priceIndex][1]
		return price, nil
	}
	return 0, fmt.Errorf("no price found for %v", coinId)
}

type Price struct {
	USD float64 `json:"usd"`
}
type CoinGeckoCoinPrices map[string]Price

func fetchCoinGeckoPrices(coinIds []string) (map[string]float64, error) {
	baseUrl := "https://api.coingecko.com/api/v3/"
	url := fmt.Sprintf("%vsimple/price?ids=%v&vs_currencies=usd", baseUrl, strings.Join(coinIds, ","))
	req, reqErr := http.NewRequest("GET", url, nil)
	if reqErr != nil {
		return nil, fmt.Errorf("failed to fetch coin prices, err: %v", reqErr)
	}

	result, err := fetch[CoinGeckoCoinPrices](req)
	if err != nil {
		return nil, err
	}

	priceMap := map[string]float64{}
	for coinId, price := range *result {
		price := price.USD
		priceMap[coinId] = price

	}
	return priceMap, nil
}

func FetchTokenPrices(ctx context.Context, coinIds []string) (map[string]float64, error) {
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

func CalcNotionalAmount(amount *big.Int, decimals uint8, price float64) *big.Float {
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
