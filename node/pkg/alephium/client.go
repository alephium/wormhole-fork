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

func (c *Client) GetEventsFromBlocks(ctx context.Context, from, to, contractAddress string) (*Events, error) {
	path := fmt.Sprintf("/events/contract/within-blocks?fromBlock=%s&toBlock=%s&contractAddress=%s", from, to, contractAddress)
	var result Events
	err := c.get(ctx, path, &result)
	return &result, err
}

func (c *Client) GetEventsFromBlock(ctx context.Context, hash string, contractAddress string) (*Events, error) {
	path := fmt.Sprintf("/events/contract/in-block?block=%s&contractAddress=%s", hash, contractAddress)
	var result Events
	err := c.get(ctx, path, &result)
	return &result, err
}

// TODO: reduce the number of request
func (c *Client) GetContractEventsFromBlockHash(ctx context.Context, hash string, contracts []string) ([]*Event, error) {
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

func (c *Client) GetContractEventsByIndex(ctx context.Context, contractAddress string, from, to uint64) (*Events, error) {
	// TODO: implementation
	return nil, nil
}

func (c *Client) GetContractEventsCount(ctx context.Context, contractAddress string) (*uint64, error) {
	// TODO: implementation
	return nil, nil
}

func (c *Client) GetContractEventsFromBlockHeight(ctx context.Context, chainIndex *ChainIndex, height uint32, contracts []string) ([]*Event, error) {
	hash, err := c.GetHashByHeight(ctx, chainIndex, height)
	if err != nil {
		return nil, err
	}
	return c.GetContractEventsFromBlockHash(ctx, *hash, contracts)
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

type tokenBridgeForChainInfo struct {
	remoteChainId uint16
	address       string
	contractId    Byte32
}

func (c *Client) GetTokenBridgeForChainInfo(ctx context.Context, address string, groupIndex uint8) (*tokenBridgeForChainInfo, error) {
	contractState, err := c.GetContractState(ctx, address, groupIndex)
	if err != nil {
		return nil, err
	}

	assume(contractState.Address == address)
	remoteChainId, err := contractState.Fields[2].ToUint16()
	if err != nil {
		return nil, err
	}

	contractId, err := toContractId(address)
	if err != nil {
		return nil, err
	}
	return &tokenBridgeForChainInfo{
		remoteChainId: remoteChainId,
		address:       address,
		contractId:    contractId,
	}, nil
}

type tokenWrapperInfo struct {
	tokenBridgeForChainId Byte32
	isLocalToken          bool
	remoteChainId         uint16
	tokenId               Byte32
	tokenWrapperAddress   string
	tokenWrapperId        Byte32
}

func (c *Client) GetTokenWrapperInfo(ctx context.Context, event *Event, groupIndex uint8) (*tokenWrapperInfo, error) {
	assume(len(event.Fields) == 1)
	tokenWrapperAddress := event.Fields[0].ToAddress()
	contractState, err := c.GetContractState(ctx, tokenWrapperAddress, groupIndex)
	if err != nil {
		return nil, err
	}
	assume(contractState.Address == tokenWrapperAddress)

	tokenBridgeForChainId, err := contractState.Fields[1].ToByte32()
	if err != nil {
		return nil, err
	}

	remoteChainId, err := contractState.Fields[3].ToUint16()
	if err != nil {
		return nil, err
	}

	tokenContractId, err := contractState.Fields[4].ToByte32()
	if err != nil {
		return nil, err
	}

	isLocalToken := contractState.Fields[5].ToBool()
	tokenWrapperId, err := toContractId(tokenWrapperAddress)
	if err != nil {
		return nil, err
	}

	return &tokenWrapperInfo{
		tokenBridgeForChainId: *tokenBridgeForChainId,
		isLocalToken:          isLocalToken,
		remoteChainId:         remoteChainId,
		tokenId:               *tokenContractId,
		tokenWrapperAddress:   tokenWrapperAddress,
		tokenWrapperId:        tokenWrapperId,
	}, nil
}
