package alephium

import (
	"context"
	"net/http"
	"strings"
	"time"

	sdk "github.com/alephium/go-sdk"
)

type Request[T any] interface {
	Execute() (T, *http.Response, error)
}

func requestWithMetric[T any](req Request[T], timestamp *time.Time, label string) (T, *http.Response, error) {
	result, response, err := req.Execute()
	queryLatency.WithLabelValues(label).Observe(time.Since(*timestamp).Seconds())
	if err != nil {
		alphConnectionErrors.WithLabelValues(label).Inc()
	}
	return result, response, err
}

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

func (c *Client) timeoutContext(ctx context.Context) (*time.Time, context.Context, context.CancelFunc) {
	timestamp := time.Now()
	timeoutCtx, cancel := context.WithDeadline(ctx, timestamp.Add(c.timeout))
	return &timestamp, timeoutCtx, cancel
}

func (c *Client) GetCurrentHeight(ctx context.Context, chainIndex *ChainIndex) (*int32, error) {
	timestamp, timeoutCtx, cancel := c.timeoutContext(ctx)
	defer cancel()

	request := c.impl.BlockflowApi.GetBlockflowChainInfo(timeoutCtx).FromGroup(chainIndex.FromGroup).ToGroup(chainIndex.ToGroup)
	response, _, err := requestWithMetric[*sdk.ChainInfo](request, timestamp, "get_height")
	if err != nil {
		return nil, err
	}
	return &response.CurrentHeight, nil
}

func (c *Client) GetBlockHeader(ctx context.Context, hash string) (*sdk.BlockHeaderEntry, error) {
	timestamp, timeoutCtx, cancel := c.timeoutContext(ctx)
	defer cancel()

	request := c.impl.BlockflowApi.GetBlockflowHeadersBlockHash(timeoutCtx, hash)
	response, _, err := requestWithMetric[*sdk.BlockHeaderEntry](request, timestamp, "get_block_header")
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) IsBlockInMainChain(ctx context.Context, hash string) (*bool, error) {
	timestamp, timeoutCtx, cancel := c.timeoutContext(ctx)
	defer cancel()

	request := c.impl.BlockflowApi.GetBlockflowIsBlockInMainChain(timeoutCtx).BlockHash(hash)
	response, _, err := requestWithMetric[bool](request, timestamp, "check_block_in_main_chain")
	if err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) GetContractEventsByRange(ctx context.Context, contractAddress string, from, limit, group int32) (*sdk.ContractEvents, error) {
	timestamp, timeoutCtx, cancel := c.timeoutContext(ctx)
	defer cancel()

	request := c.impl.EventsApi.GetEventsContractContractaddress(timeoutCtx, contractAddress).Start(from).Limit(limit).Group(group)
	response, _, err := requestWithMetric[*sdk.ContractEvents](request, timestamp, "get_contract_events")
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) GetContractEvents(ctx context.Context, contractAddress string, from, group int32) (*sdk.ContractEvents, error) {
	timestamp, timeoutCtx, cancel := c.timeoutContext(ctx)
	defer cancel()

	request := c.impl.EventsApi.GetEventsContractContractaddress(timeoutCtx, contractAddress).Start(from).Group(group)
	response, _, err := requestWithMetric[*sdk.ContractEvents](request, timestamp, "get_contract_events")
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) GetEventsByTxId(ctx context.Context, txId string) (*sdk.ContractEventsByTxId, error) {
	timestamp, timeoutCtx, cancel := c.timeoutContext(ctx)
	defer cancel()

	request := c.impl.EventsApi.GetEventsTxIdTxid(timeoutCtx, txId)
	response, _, err := requestWithMetric[*sdk.ContractEventsByTxId](request, timestamp, "get_events_by_tx_id")
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) GetContractEventsCount(ctx context.Context, contractAddress string) (*int32, error) {
	timestamp, timeoutCtx, cancel := c.timeoutContext(ctx)
	defer cancel()

	request := c.impl.EventsApi.GetEventsContractContractaddressCurrentCount(timeoutCtx, contractAddress)
	response, r, err := requestWithMetric[int32](request, timestamp, "get_contract_events_count")
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
	timestamp, timeoutCtx, cancel := c.timeoutContext(ctx)
	defer cancel()

	request := c.impl.TransactionsApi.GetTransactionsStatus(timeoutCtx).TxId(txId)
	response, _, err := requestWithMetric[*sdk.TxStatus](request, timestamp, "get_tx_status")
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) GetNodeInfo(ctx context.Context) (*sdk.NodeInfo, error) {
	timestamp, timeoutCtx, cancel := c.timeoutContext(ctx)
	defer cancel()

	request := c.impl.InfosApi.GetInfosNode(timeoutCtx)
	response, _, err := requestWithMetric[*sdk.NodeInfo](request, timestamp, "get_node_info")
	if err != nil {
		return nil, err
	}
	return response, nil
}

func (c *Client) IsCliqueSynced(ctx context.Context) (*bool, error) {
	timestamp, timeoutCtx, cancel := c.timeoutContext(ctx)
	defer cancel()

	request := c.impl.InfosApi.GetInfosSelfClique(timeoutCtx)
	response, _, err := requestWithMetric[*sdk.SelfClique](request, timestamp, "is_clique_synced")
	if err != nil {
		return nil, err
	}
	return &response.Synced, nil
}
