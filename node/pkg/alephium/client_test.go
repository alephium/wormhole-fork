package alephium

import (
	"context"
	"fmt"
	"testing"
)

const endpoint = "http://127.0.0.1:12973"

var client = NewClient(endpoint, "", 10)
var chainIndex = &ChainIndex{
	FromGroup: 1,
	ToGroup:   1,
}

func TestGetCurrentHeight(t *testing.T) {
	height, err := client.GetCurrentHeight(context.Background(), chainIndex)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Println(height)
}

func TestGetHashes(t *testing.T) {
	hashes, err := client.GetHashes(context.Background(), chainIndex, 100)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Println(hashes)
}

func TestIsInMainChain(t *testing.T) {
	hash := "00000000000672d1a461f8dcd4383802a71bf1c37cea489d629030ee2fc87fc7"
	isCanonical, err := client.IsBlockInMainChain(context.Background(), hash)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Println(isCanonical)
}

func TestGetBlockHeader(t *testing.T) {
	hash := "00000000000672d1a461f8dcd4383802a71bf1c37cea489d629030ee2fc87fc7"
	header, err := client.GetBlockHeader(context.Background(), hash)
	if err != nil {
		t.Fatal(err)
	}
	fmt.Println(header)
}
