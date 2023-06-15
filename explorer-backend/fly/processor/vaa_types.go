package processor

import (
	"context"

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
)

// VAAPushFunc is a function to push VAA message.
type VAAPushFunc func(context.Context, *vaa.VAA, []byte) error

// VAANotifyFunc is a function to notify saved VAA message.
type VAANotifyFunc func(context.Context, *vaa.VAA, []byte) error

type Message struct {
	vaa        *vaa.VAA
	serialized []byte
}
