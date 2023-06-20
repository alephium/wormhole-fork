package utils

import (
	"context"
	"net/http"
	"time"

	"golang.org/x/time/rate"
)

var DefaultLimiter = rate.NewLimiter(rate.Every(time.Second), 3)
var DefaultRateLimitClient = NewRateLimitClient(DefaultLimiter)

type RateLimitClient struct {
	client      *http.Client
	Ratelimiter *rate.Limiter
}

func (c *RateLimitClient) Do(ctx context.Context, req *http.Request) (*http.Response, error) {
	err := c.Ratelimiter.Wait(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func NewRateLimitClient(limiter *rate.Limiter) *RateLimitClient {
	return &RateLimitClient{
		client:      http.DefaultClient,
		Ratelimiter: limiter,
	}
}
