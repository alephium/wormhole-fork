package cache

import (
	"context"

	errs "github.com/alephium/wormhole-fork/explorer-api-server/internal/errors"
)

// DummyCacheClient dummy cache client.
type DummyCacheClient struct {
}

// NewDummyCacheClient create a new instance of DummyCacheClient
func NewDummyCacheClient() DummyCacheClient {
	return DummyCacheClient{}
}

// Get get method is a dummy method that always does not find the cache.
// Use this Get function when run development enviroment
func (d *DummyCacheClient) Get(ctx context.Context, key string) (string, error) {
	return "", errs.ErrNotFound
}
