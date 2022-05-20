package alephium

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

const (
	TokenBridgeForChainFieldSize = 8
	TokenWrapperFieldSize        = 9
)

var ErrInvalidContract error = errors.New("invalid contract")

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

func (c *Client) GetHashByHeight(ctx context.Context, chainIndex *ChainIndex, height uint32) (*string, error) {
	hashes, err := c.GetHashes(ctx, chainIndex, height)
	if err != nil {
		return nil, err
	}
	if len(hashes) == 0 {
		return nil, fmt.Errorf("no block for height %v", height)
	}
	return &hashes[0], nil
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

func (c *Client) GetContractEventsByRange(ctx context.Context, contractAddress string, from, to uint64) (*Events, error) {
	var result Events
	path := fmt.Sprintf("/events/contract?start=%d&end=%d&contractAddress=%s", from, to, contractAddress)
	err := c.get(ctx, path, &result)
	return &result, err
}

func (c *Client) GetContractEvents(ctx context.Context, contractAddress string, from uint64) (*Events, error) {
	var result Events
	path := fmt.Sprintf("/events/contract?start=%d&contractAddress=%s", from, contractAddress)
	err := c.get(ctx, path, &result)
	return &result, err
}

func (c *Client) GetEventsByTxId(ctx context.Context, txId string) (*Events, error) {
	var result Events
	path := fmt.Sprintf("/events/tx-script?txId=%s", txId)
	err := c.get(ctx, path, &result)
	return &result, err
}

func eventCountURI(contractAddress string) string {
	return fmt.Sprintf("/events/contract/current-count?contractAddress=%s", contractAddress)
}

func (c *Client) GetContractEventsCount(ctx context.Context, contractAddress string) (*uint64, error) {
	var result uint64
	err := c.get(ctx, eventCountURI(contractAddress), &result)
	return &result, err
}

func (c *Client) GetTransactionStatus(ctx context.Context, txId string) (*TxStatus, error) {
	path := fmt.Sprintf("/transactions/status?txId=%s", txId)
	var result TxStatus
	err := c.get(ctx, path, &result)
	return &result, err
}

func (c *Client) GetNodeInfo(ctx context.Context) (*NodeInfo, error) {
	var info NodeInfo
	err := c.get(ctx, "/infos/node", &info)
	return &info, err
}

func (c *Client) GetContractState(ctx context.Context, contractAddress string, groupIndex uint8) (*ContractState, error) {
	path := fmt.Sprintf("/contracts/%s/state?group=%d", contractAddress, groupIndex)
	var result ContractState
	err := c.get(ctx, path, &result)
	return &result, err
}
