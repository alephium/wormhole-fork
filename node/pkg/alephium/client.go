package alephium

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	endpoint string
	apiKey   string
	impl     *http.Client
}

func NewClient(endpoint string, apiKey string, timeout int) *Client {
	var httpClient = &http.Client{
		Timeout: time.Second * time.Duration(timeout),
	}
	return &Client{
		endpoint: endpoint,
		apiKey:   apiKey,
		impl:     httpClient,
	}
}

func (c *Client) get(path string, result interface{}) error {
	url := c.endpoint + path
	request, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}

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

func (c *Client) GetCurrentHeight(fromGroup, toGroup uint8) (uint32, error) {
	path := fmt.Sprintf("/blockflow/chain-info?fromGroup=%d&toGroup=%d", fromGroup, toGroup)
	result := struct {
		CurrentHeight uint32 `json:"currentHeight"`
	}{}

	err := c.get(path, &result)
	if err != nil {
		return 0, err
	}
	return result.CurrentHeight, nil
}

func (c *Client) GetHashes(fromGroup, toGroup uint8, height uint32) ([]string, error) {
	path := fmt.Sprintf("/blockflow/hashes?fromGroup=%d&toGroup=%d&height=%d", fromGroup, toGroup, height)
	result := struct {
		Headers []string `json:"headers"`
	}{}

	err := c.get(path, &result)
	if err != nil {
		return nil, err
	}
	return result.Headers, nil
}

func (c *Client) GetEvents(from, to, contractAddress string) (*Events, error) {
	path := fmt.Sprintf("/events/within-blocks?fromBlock=%s&toBlock=%s&contractAddress=%s", from, to, contractAddress)
	var result Events
	err := c.get(path, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}
