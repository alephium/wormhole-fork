package vaa

import (
	"context"
	"fmt"
	"strconv"

	"github.com/alephium/wormhole-fork/explorer-backend/api/internal/cache"
	errs "github.com/alephium/wormhole-fork/explorer-backend/api/internal/errors"
	"github.com/alephium/wormhole-fork/explorer-backend/api/internal/pagination"
	"github.com/alephium/wormhole-fork/explorer-backend/api/response"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/pkg/errors"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"
)

// Service definition.
type Service struct {
	repo         *Repository
	getCacheFunc cache.CacheGetFunc
	logger       *zap.Logger
}

// NewService create a new Service.
func NewService(r *Repository, getCacheFunc cache.CacheGetFunc, logger *zap.Logger) *Service {
	return &Service{repo: r, getCacheFunc: getCacheFunc, logger: logger.With(zap.String("module", "VaaService"))}
}

// FindAll get all the the vaa.
func (s *Service) FindAll(ctx context.Context, p *pagination.Pagination) (*response.Response[[]*VaaDoc], error) {
	if p == nil {
		p = pagination.FirstPage()
	}

	query := Query().SetPagination(p)
	vaas, err := s.repo.Find(ctx, query)
	res := response.Response[[]*VaaDoc]{Data: vaas}
	return &res, err
}

func (s *Service) FindRecent(ctx context.Context, numRows *uint, emitterChain *uint, emitterAddr string) (*response.Response[[]*VaaDoc], error) {
	filter := bson.M{}
	if emitterChain != nil {
		filter["emitterChain"] = *emitterChain
	}
	if emitterAddr != "" {
		filter["emitterAddr"] = emitterAddr
	}
	sort := bson.M{"updatedAt": -1}
	var limit int64 = 10
	if numRows != nil {
		limit = int64(*numRows)
	}
	vaas, err := s.repo.RawQuery(ctx, filter, options.Find().SetSort(sort).SetLimit(limit))
	if err != nil {
		return nil, err
	}
	res := response.Response[[]*VaaDoc]{Data: vaas}
	return &res, err
}

// FindByChain get all the vaa by chainID.
func (s *Service) FindByChain(ctx context.Context, chain vaa.ChainID, p *pagination.Pagination) (*response.Response[[]*VaaDoc], error) {
	query := Query().SetEmitterChain(chain).SetPagination(p)
	vaas, err := s.repo.Find(ctx, query)
	res := response.Response[[]*VaaDoc]{Data: vaas}
	return &res, err
}

// FindByEmitter get all the vaa by chainID and emitter address.
func (s *Service) FindByEmitter(ctx context.Context, chain vaa.ChainID, emitter *vaa.Address, p *pagination.Pagination) (*response.Response[[]*VaaDoc], error) {
	query := Query().SetEmitterChain(chain).SetEmitterAddress(emitter.String()).SetPagination(p)
	vaas, err := s.repo.Find(ctx, query)
	res := response.Response[[]*VaaDoc]{Data: vaas}
	return &res, err
}

func (s *Service) FindByEmitterAndTargetChain(ctx context.Context, emitterChain vaa.ChainID, emitterAddress *vaa.Address, targetChain vaa.ChainID, p *pagination.Pagination) (*response.Response[[]*VaaDoc], error) {
	query := Query().SetEmitterChain(emitterChain).SetEmitterAddress(emitterAddress.String()).SetTargetChain(targetChain).SetPagination(p)
	vaas, err := s.repo.Find(ctx, query)
	res := response.Response[[]*VaaDoc]{Data: vaas}
	return &res, err
}

// FindById get a vaa by chainID, emitter address and sequence number.
func (s *Service) FindById(ctx context.Context, emitterChain vaa.ChainID, emitter *vaa.Address, targetChain vaa.ChainID, seq uint64) (*response.Response[*VaaDoc], error) {
	// check vaa sequence indexed
	isVaaNotIndexed := s.discardVaaNotIndexed(ctx, emitterChain, emitter, targetChain, strconv.FormatUint(seq, 10))
	if isVaaNotIndexed {
		return nil, errs.ErrNotFound
	}

	query := Query().SetEmitterChain(emitterChain).SetEmitterAddress(emitter.String()).SetTargetChain(targetChain).SetSequence(seq)
	vaa, err := s.repo.FindOne(ctx, query)
	res := response.Response[*VaaDoc]{Data: vaa}
	return &res, err
}

func (s *Service) FindByTxId(ctx context.Context, txId []byte) (*response.Response[*VaaDoc], error) {
	query := Query().SetTxId(txId)
	vaa, err := s.repo.FindOne(ctx, query)
	res := response.Response[*VaaDoc]{Data: vaa}
	return &res, err
}

// GetVaaCount get a list a list of vaa count grouped by chainID.
func (s *Service) GetVaaCount(ctx context.Context, p *pagination.Pagination) (*response.Response[[]*VaaStats], error) {
	if p == nil {
		p = pagination.FirstPage()
	}
	query := Query().SetPagination(p)
	stats, err := s.repo.GetVaaCount(ctx, query)
	res := response.Response[[]*VaaStats]{Data: stats}
	return &res, err
}

// discardVaaNotIndexed discard a vaa request if the input sequence for a chainID, address is greatter than or equals
// the cached value of the sequence for this chainID, address.
// If the sequence does not exist we can not discard the request.
func (s *Service) discardVaaNotIndexed(ctx context.Context, emitterChain vaa.ChainID, emitterAddress *vaa.Address, targetChain vaa.ChainID, seq string) bool {
	key := fmt.Sprintf("%s:%d:%s:%d", "wormscan:vaa-max-sequence", emitterChain, emitterAddress.String(), targetChain)
	sequence, err := s.getCacheFunc(ctx, key)
	if err != nil {
		if errors.Is(err, errs.ErrInternalError) {
			requestID := fmt.Sprintf("%v", ctx.Value("requestid"))
			s.logger.Error("error getting value from cache",
				zap.Error(err), zap.String("requestID", requestID))
		}
		return false
	}

	inputSquence, err := strconv.ParseUint(seq, 10, 64)
	if err != nil {
		requestID := fmt.Sprintf("%v", ctx.Value("requestid"))
		s.logger.Error("error invalid input sequence number",
			zap.Error(err), zap.String("seq", seq), zap.String("requestID", requestID))
		return false
	}
	cacheSequence, err := strconv.ParseUint(sequence, 10, 64)
	if err != nil {
		requestID := fmt.Sprintf("%v", ctx.Value("requestid"))
		s.logger.Error("error invalid cached sequence number",
			zap.Error(err), zap.String("sequence", sequence), zap.String("requestID", requestID))
		return false
	}

	// Check that the input sequence is indexed.
	if cacheSequence >= inputSquence {
		return false
	}
	return true
}
