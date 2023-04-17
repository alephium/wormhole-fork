package utils

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
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

func init() {
	CoinGeckoCoins = fetchCoinGeckoCoins()
}

func fetchCoinGeckoCoins() map[string][]CoinGeckoCoin {
	url := fmt.Sprintf("%vcoins/list", coinGeckoUrl)
	req, reqErr := http.NewRequest("GET", url, nil)
	if reqErr != nil {
		log.Fatalf("failed coins request, err: %v", reqErr)
	}

	res, resErr := http.DefaultClient.Do(req)
	if resErr != nil {
		log.Fatalf("failed get coins response, err: %v", resErr)
	}

	defer res.Body.Close()
	body, bodyErr := ioutil.ReadAll(res.Body)
	if bodyErr != nil {
		log.Fatalf("failed decoding coins body, err: %v", bodyErr)
	}

	var parsed []CoinGeckoCoin
	parseErr := json.Unmarshal(body, &parsed)
	if parseErr != nil {
		log.Printf("fetchCoinGeckoCoins failed parsing body. err %v\n", parseErr)
	}

	var geckoCoins = map[string][]CoinGeckoCoin{}
	for _, coin := range parsed {
		symbol := strings.ToLower(coin.Symbol)
		geckoCoins[symbol] = append(geckoCoins[symbol], coin)
	}
	return geckoCoins
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

func FetchCoinGeckoPrice(coinId string, timestamp time.Time) (*float64, error) {
	hourAgo := time.Now().Add(-time.Duration(1) * time.Hour)
	withinLastHour := timestamp.After(hourAgo)
	start, end := rangeFromTime(timestamp, 12)

	priceUrl := fmt.Sprintf("%vcoins/%v/market_chart/range?vs_currency=usd&from=%v&to=%v", coinGeckoUrl, coinId, start.Unix(), end.Unix())
	req, reqErr := http.NewRequest("GET", priceUrl, nil)
	if reqErr != nil {
		return nil, reqErr
	}

	res, resErr := http.DefaultClient.Do(req)
	if resErr != nil {
		return nil, resErr
	}
	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("failed to get CoinGecko prices")
	}

	defer res.Body.Close()
	body, bodyErr := ioutil.ReadAll(res.Body)
	if bodyErr != nil {
		return nil, bodyErr
	}

	var parsed CoinGeckoMarketRes
	parseErr := json.Unmarshal(body, &parsed)
	if parseErr != nil {
		var errRes CoinGeckoErrorRes
		if err := json.Unmarshal(body, &errRes); err == nil {
			return nil, fmt.Errorf(errRes.Error)
		}
		return nil, parseErr
	}
	if len(parsed.Prices) >= 1 {
		var priceIndex int
		if withinLastHour {
			// use the last price in the list, latest price
			priceIndex = len(parsed.Prices) - 1
		} else {
			// use a price from the middle of the list, as that should be
			// closest to the timestamp.
			numPrices := len(parsed.Prices)
			priceIndex = numPrices / 2
		}
		price := parsed.Prices[priceIndex][1]
		return &price, nil
	}
	return nil, fmt.Errorf("no price found for %v", coinId)
}
