package utils

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"strings"

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
