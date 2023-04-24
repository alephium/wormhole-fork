package common

import (
	"errors"

	gossipv1 "github.com/alephium/wormhole-fork/node/pkg/proto/gossip/v1"
)

const ObsvReqChannelSize = 50

var ErrChanFull = errors.New("channel is full")

func PostObservationRequest(obsvReqSendC chan<- *gossipv1.ObservationRequest, req *gossipv1.ObservationRequest) error {
	select {
	case obsvReqSendC <- req:
		return nil
	default:
		return ErrChanFull
	}
}
