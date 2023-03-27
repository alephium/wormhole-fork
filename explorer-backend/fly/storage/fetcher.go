package storage

import (
	"context"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/common"
	publicrpcv1 "github.com/alephium/wormhole-fork/node/pkg/proto/publicrpc/v1"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func loadEmitterIds(config *common.BridgeConfig) ([]*emitterId, error) {
	chains := []struct {
		chainId vaa.ChainID
		*common.ChainConfig
	}{
		{vaa.ChainIDAlephium, config.Alephium},
		{vaa.ChainIDEthereum, config.Ethereum},
	}
	emitterIds := make([]*emitterId, 0)
	for i := 0; i < len(chains); i++ {
		emitterChain := chains[i]
		emitterAddress, err := vaa.StringToAddress(emitterChain.TokenBridgeEmitterAddress)
		if err != nil {
			return nil, err
		}
		emitterIds = append(emitterIds, &emitterId{
			emitterChain:        emitterChain.chainId,
			emitterAddress:      emitterAddress,
			targetChain:         vaa.ChainIDUnset,
			isGovernanceEmitter: false,
		})

		for j := 0; j < len(chains); j++ {
			if i == j {
				continue
			}
			targetChain := chains[j]
			emitterIds = append(emitterIds, &emitterId{
				emitterChain:        emitterChain.chainId,
				emitterAddress:      emitterAddress,
				targetChain:         targetChain.chainId,
				isGovernanceEmitter: false,
			})
		}
	}
	governanceEmitter, err := vaa.StringToAddress(config.Guardian.GovernanceEmitterAddress)
	if err != nil {
		return nil, err
	}
	governanceEmitterId := &emitterId{
		emitterChain:        vaa.ChainID(config.Guardian.GovernanceChainId),
		emitterAddress:      governanceEmitter,
		isGovernanceEmitter: true,
	}
	emitterIds = append(emitterIds, governanceEmitterId)
	return emitterIds, nil
}

// Fetch missing vaa from guardian nodes
type Fetcher struct {
	emitterIds []*emitterId
	repository *Repository
	duration   time.Duration
	logger     *zap.Logger
	batchSize  uint32
	guardian   string // TODO: use multiple guardians for avoiding single point of failure
}

func NewFetcher(
	config *common.BridgeConfig,
	repository *Repository,
	duration time.Duration,
	logger *zap.Logger,
	batchSize uint32,
	guardianGrpcUrl string,
) (*Fetcher, error) {
	emitterIds, err := loadEmitterIds(config)
	if err != nil {
		return nil, err
	}
	return &Fetcher{
		emitterIds: emitterIds,
		repository: repository,
		duration:   duration,
		logger:     logger,
		batchSize:  batchSize,
		guardian:   guardianGrpcUrl,
	}, nil
}

func (f *Fetcher) Start(ctx context.Context) {
	go f.start(ctx)
}

func (f *Fetcher) start(ctx context.Context) {
	conn, err := grpc.Dial(f.guardian, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		f.logger.Fatal("failed to connect to guardian", zap.Error(err))
	}
	defer conn.Close()
	client := publicrpcv1.NewPublicRPCServiceClient(conn)

	tick := time.NewTicker(f.duration)
	for {
		select {
		case <-tick.C:
			for _, emitterId := range f.emitterIds {
				if err := f.fetchMissingVaas(ctx, client, emitterId); err != nil {
					f.logger.Error(
						"failed to fetch missing vaas",
						zap.Error(err),
						zap.String("emitterId", emitterId.toString()),
					)
				}
			}

		case <-ctx.Done():
			return
		}
	}
}

func (f *Fetcher) fetchMissingVaas(
	ctx context.Context,
	client publicrpcv1.PublicRPCServiceClient,
	emitterId *emitterId,
) error {
	seqs, err := f.repository.FindOldestMissingIds(ctx, emitterId, int64(f.batchSize))
	if err != nil {
		return err
	}
	f.logger.Info("fetch missing vaas", zap.String("emitter", emitterId.toString()), zap.Uint64s("seqs", seqs))
	filteredSeqs, removedSeqs := f.filterSeqs(ctx, emitterId, seqs)
	if len(filteredSeqs) == 0 {
		return f.repository.removeMissingIds(ctx, emitterId, removedSeqs)
	}

	if emitterId.isGovernanceEmitter {
		request := &publicrpcv1.GetGovernanceVAABatchRequest{Sequences: filteredSeqs}
		response, err := client.GetGovernanceVAABatch(ctx, request)
		if err != nil {
			return err
		}
		return handleFetchResponse(f, ctx, emitterId, response.Entries, removedSeqs)
	}

	request := &publicrpcv1.GetNonGovernanceVAABatchRequest{
		EmitterChain:   publicrpcv1.ChainID(emitterId.emitterChain),
		EmitterAddress: emitterId.emitterAddress.String(),
		TargetChain:    publicrpcv1.ChainID(emitterId.targetChain),
		Sequences:      filteredSeqs,
	}
	response, err := client.GetNonGovernanceVAABatch(ctx, request)
	if err != nil {
		return err
	}
	return handleFetchResponse(f, ctx, emitterId, response.Entries, removedSeqs)
}

type vaaEntry interface {
	GetVaaBytes() []byte
	GetSequence() uint64
}

func handleFetchResponse[T vaaEntry](f *Fetcher, ctx context.Context, emitterId *emitterId, entries []T, removedSeqs []uint64) error {
	serializedVaas := make([][]byte, 0)
	for _, entry := range entries {
		serializedVaas = append(serializedVaas, entry.GetVaaBytes())
		removedSeqs = append(removedSeqs, entry.GetSequence())
	}
	if err := f.repository.upsertVaas(ctx, serializedVaas); err != nil {
		return err
	}
	f.logger.Info("remove missing vaa ids", zap.String("emitter", emitterId.toString()), zap.Uint64s("seqs", removedSeqs))
	return f.repository.removeMissingIds(ctx, emitterId, removedSeqs)
}

func (f *Fetcher) filterSeqs(ctx context.Context, emitterId *emitterId, seqs []uint64) ([]uint64, []uint64) {
	filteredSeqs := make([]uint64, 0)
	removedSeqs := make([]uint64, 0)
	for _, seq := range seqs {
		exists, err := f.repository.HasVAA(ctx, emitterId, seq)
		if err != nil {
			f.logger.Error("failed to check vaa exists", zap.String("vaaId", emitterId.toVaaId(seq)), zap.Error(err))
			continue
		}
		if !exists {
			filteredSeqs = append(filteredSeqs, seq)
		} else {
			removedSeqs = append(removedSeqs, seq)
		}
	}
	return filteredSeqs, removedSeqs
}
