package alephium

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	endpoint string
	apiKey   string
	timeout  int // seconds
	impl     *http.Client
}

func NewClient(endpoint string, apiKey string, timeout int) *Client {
	return &Client{
		endpoint: endpoint,
		apiKey:   apiKey,
		timeout:  timeout,
		impl:     &http.Client{},
	}
}

func (c *Client) get(ctx context.Context, path string, result interface{}) error {
	timeout, cancel := context.WithTimeout(ctx, time.Duration(c.timeout)*time.Second)
	defer cancel()

	url := c.endpoint + path
	request, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}

	request = request.WithContext(timeout)
	request.Header.Set("accept", "application/json")
	if c.apiKey != "" {
		request.Header.Set("X-API-KEY", c.apiKey)
	}

	response, err := c.impl.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("request error, url: %s, status code: %d", url, response.StatusCode)
	}

	return json.NewDecoder(response.Body).Decode(result)
}

func (c *Client) GetCurrentHeight(ctx context.Context, chainIndex *ChainIndex) (uint32, error) {
	path := fmt.Sprintf("/blockflow/chain-info?fromGroup=%d&toGroup=%d", chainIndex.FromGroup, chainIndex.ToGroup)
	result := struct {
		CurrentHeight uint32 `json:"currentHeight"`
	}{}

	err := c.get(ctx, path, &result)
	return result.CurrentHeight, err
}

func (c *Client) GetHashes(ctx context.Context, chainIndex *ChainIndex, height uint32) ([]string, error) {
	path := fmt.Sprintf("/blockflow/hashes?fromGroup=%d&toGroup=%d&height=%d", chainIndex.FromGroup, chainIndex.ToGroup, height)
	result := struct {
		Headers []string `json:"headers"`
	}{}
	err := c.get(ctx, path, &result)
	return result.Headers, err
}

func (c *Client) GetBlockHeader(ctx context.Context, hash string) (*BlockHeader, error) {
	path := fmt.Sprintf("/blockflow/blocks/%s", hash)
	var header BlockHeader
	err := c.get(ctx, path, &header)
	return &header, err
}

func (c *Client) IsBlockInMainChain(ctx context.Context, hash string) (bool, error) {
	path := fmt.Sprintf("/blockflow/is-block-in-main-chain?blockHash=%s", hash)
	var result bool
	err := c.get(ctx, path, &result)
	return result, err
}

func (c *Client) GetEventsFromBlocks(ctx context.Context, from, to, contractAddress string) (*Events, error) {
	path := fmt.Sprintf("/events/within-blocks?fromBlock=%s&toBlock=%s&contractAddress=%s", from, to, contractAddress)
	var result Events
	err := c.get(ctx, path, &result)
	return &result, err
}

func (c *Client) GetEventsFromBlock(ctx context.Context, hash string, contractAddress string) (*Events, error) {
	path := fmt.Sprintf("/events/in-block?block=%s&contractAddress=%s", hash, contractAddress)
	var result Events
	err := c.get(ctx, path, &result)
	return &result, err
}

// TODO: reduce the number of request
func (c *Client) GetContractEventsFromBlock(ctx context.Context, hash string, contracts []string) ([]*Event, error) {
	result := make([]*Event, 0)
	for _, contract := range contracts {
		events, err := c.GetEventsFromBlock(ctx, hash, contract)
		if err != nil {
			return nil, err
		}
		result = append(result, events.Events...)
	}
	return result, nil
}
