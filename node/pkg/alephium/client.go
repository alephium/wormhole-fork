package alephium

import (
	"context"
	"fmt"
	"strings"
	"time"

	sdk "github.com/alephium/go-sdk"
)

type Client struct {
	timeout time.Duration
	impl    *sdk.APIClient
}

func NewClient(endpoint string, apiKey string, timeout int) *Client {
	configuration := sdk.NewConfiguration()
	var host string
	if strings.HasPrefix(endpoint, "http://") {
		host = endpoint[7:]
	}
	if strings.HasPrefix(endpoint, "https://") {
		host = endpoint[8:]
	}
	configuration.Host = host

	if apiKey != "" {
		configuration.AddDefaultHeader("X-API-KEY", apiKey)
	}
	return &Client{
		timeout: time.Duration(timeout) * time.Second,
		impl:    sdk.NewAPIClient(configuration),
	}
}

func (c *Client) GetCurrentHeight(ctx context.Context, chainIndex *ChainIndex) (*int32, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	response, _, err := c.impl.BlockflowApi.GetBlockflowChainInfo(timeoutCtx).FromGroup(chainIndex.FromGroup).ToGroup(chainIndex.ToGroup).Execute()
	if err != nil {
		return nil, err
	}
	return &response.CurrentHeight, nil
}

func (c *Client) GetBlockHeader(ctx context.Context, hash string) (*sdk.BlockHeaderEntry, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	response, _, err := c.impl.BlockflowApi.GetBlockflowHeadersBlockHash(timeoutCtx, hash).Execute()
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) IsBlockInMainChain(ctx context.Context, hash string) (*bool, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	response, _, err := c.impl.BlockflowApi.GetBlockflowIsBlockInMainChain(timeoutCtx).BlockHash(hash).Execute()
	if err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) GetContractEventsByRange(ctx context.Context, contractAddress string, from, to, group int32) (*sdk.ContractEvents, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	response, _, err := c.impl.EventsApi.GetEventsContractContractaddress(timeoutCtx, contractAddress).Start(from).End(to).Group(group).Execute()
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) GetContractEvents(ctx context.Context, contractAddress string, from, group int32) (*sdk.ContractEvents, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	response, _, err := c.impl.EventsApi.GetEventsContractContractaddress(timeoutCtx, contractAddress).Start(from).Group(group).Execute()
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) GetEventsByTxId(ctx context.Context, txId string) (*sdk.ContractEventsByTxId, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	response, _, err := c.impl.EventsApi.GetEventsTxIdTxid(timeoutCtx, txId).Execute()
	if err != nil {
		return nil, err
	}
	return response, nil
}

func eventCountURI(contractAddress string) string {
	return fmt.Sprintf("/events/contract/%s/current-count", contractAddress)
}

func (c *Client) GetContractEventsCount(ctx context.Context, contractAddress string) (*int32, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	response, r, err := c.impl.EventsApi.GetEventsContractContractaddressCurrentCount(timeoutCtx, contractAddress).Execute()
	if r.StatusCode == 404 {
		// subscribe event from 0 if contract count not found
		count := int32(0)
		return &count, nil
	}
	if err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) GetTransactionStatus(ctx context.Context, txId string) (*sdk.TxStatus, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	response, _, err := c.impl.TransactionsApi.GetTransactionsStatus(timeoutCtx).TxId(txId).Execute()
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) GetNodeInfo(ctx context.Context) (*sdk.NodeInfo, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	response, _, err := c.impl.InfosApi.GetInfosNode(timeoutCtx).Execute()
	if err != nil {
		return nil, err
	}
	return response, nil
}
