// Package observations handle the request of observations data from governor endpoint defined in the api.
package observations

import (
	"context"

	"github.com/alephium/wormhole-fork/explorer-api-server/internal/pagination"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"go.uber.org/zap"
)

// Service definition.
type Service struct {
	repo   *Repository
	logger *zap.Logger
}

// NewService create a new Service.
func NewService(dao *Repository, logger *zap.Logger) *Service {
	return &Service{repo: dao, logger: logger.With(zap.String("module", "ObservationsService"))}
}

// FindAll get all the observations.
func (s *Service) FindAll(ctx context.Context, p *pagination.Pagination) ([]*ObservationDoc, error) {
	return s.repo.Find(ctx, Query().SetPagination(p))
}

// FindByChain get all the observations by emitter chain.
func (s *Service) FindByChain(ctx context.Context, chain vaa.ChainID, p *pagination.Pagination) ([]*ObservationDoc, error) {
	query := Query().SetEmitterChain(chain).SetPagination(p)
	return s.repo.Find(ctx, query)
}

// FindByEmitter get all the observations by emitter chain and emitter address.
func (s *Service) FindByEmitter(ctx context.Context, chain vaa.ChainID, emitter *vaa.Address, p *pagination.Pagination) ([]*ObservationDoc, error) {
	query := Query().SetEmitterChain(chain).SetEmitter(emitter.String()).SetPagination(p)
	return s.repo.Find(ctx, query)
}

// FindByEmitter get all the observations by emitter chain, emitter address and target chain.
func (s *Service) FindByEmitterAndTargetChain(ctx context.Context, emitterChain vaa.ChainID, emitterAddress *vaa.Address, targetChain vaa.ChainID, p *pagination.Pagination) ([]*ObservationDoc, error) {
	query := Query().SetEmitterChain(emitterChain).SetEmitter(emitterAddress.String()).SetTargetChain(targetChain).SetPagination(p)
	return s.repo.Find(ctx, query)
}

// FindByVAA get all the observations for a VAA (emitter chain, emitter addrress, target chain and sequence number).
func (s *Service) FindByVAA(ctx context.Context, emitterChain vaa.ChainID, emitter *vaa.Address, targetChain vaa.ChainID, seq string, p *pagination.Pagination) ([]*ObservationDoc, error) {
	query := Query().SetEmitterChain(emitterChain).SetEmitter(emitter.String()).SetTargetChain(targetChain).SetSequence(seq).SetPagination(p)
	return s.repo.Find(ctx, query)
}

// FindOne get a observation by chainID, emitter address, sequence, signer address and hash.
func (s *Service) FindOne(ctx context.Context, emitterChain vaa.ChainID, emitterAddr *vaa.Address, targetChain vaa.ChainID, seq string, signerAddr *vaa.Address, hash []byte) (*ObservationDoc, error) {
	query := Query().SetEmitterChain(emitterChain).SetEmitter(emitterAddr.String()).SetTargetChain(targetChain).SetSequence(seq).SetGuardianAddr(signerAddr.String()).SetHash(hash)
	return s.repo.FindOne(ctx, query)
}
