// Package observations handle the request of observations data from governor endpoint defined in the api.
package observations

import (
	"context"
	"fmt"

	errs "github.com/alephium/wormhole-fork/explorer-backend/api/internal/errors"
	"github.com/alephium/wormhole-fork/explorer-backend/api/internal/pagination"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/pkg/errors"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"
)

// Repository definition.
type Repository struct {
	db          *mongo.Database
	logger      *zap.Logger
	collections struct {
		observations *mongo.Collection
	}
}

// NewRepository create a new Repository.
func NewRepository(db *mongo.Database, logger *zap.Logger) *Repository {
	return &Repository{db: db,
		logger:      logger.With(zap.String("module", "ObservationsRepository")),
		collections: struct{ observations *mongo.Collection }{observations: db.Collection("observations")},
	}
}

// Find get a list of ObservationDoc pointers.
// The input parameter [q *ObservationQuery] define the filters to apply in the query.
func (r *Repository) Find(ctx context.Context, q *ObservationQuery) ([]*ObservationDoc, error) {
	if q == nil {
		q = Query()
	}
	sort := bson.D{{q.SortBy, q.GetSortInt()}}
	cur, err := r.collections.observations.Find(ctx, q.toBSON(), options.Find().SetLimit(q.PageSize).SetSkip(q.Offset).SetSort(sort))
	if err != nil {
		requestID := fmt.Sprintf("%v", ctx.Value("requestid"))
		r.logger.Error("failed execute Find command to get observations",
			zap.Error(err), zap.Any("q", q), zap.String("requestID", requestID))
		return nil, errors.WithStack(err)
	}
	var obs []*ObservationDoc
	err = cur.All(ctx, &obs)
	if err != nil {
		requestID := fmt.Sprintf("%v", ctx.Value("requestid"))
		r.logger.Error("failed decoding cursor to []*ObservationDoc", zap.Error(err), zap.Any("q", q),
			zap.String("requestID", requestID))
		return nil, errors.WithStack(err)
	}
	return obs, err
}

// Find get ObservationDoc pointer.
// The input parameter [q *ObservationQuery] define the filters to apply in the query.
func (r *Repository) FindOne(ctx context.Context, q *ObservationQuery) (*ObservationDoc, error) {
	if q == nil {
		return nil, errs.ErrMalformedQuery
	}
	var obs ObservationDoc
	err := r.collections.observations.FindOne(ctx, q.toBSON()).Decode(&obs)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errs.ErrNotFound
		}
		requestID := fmt.Sprintf("%v", ctx.Value("requestid"))
		r.logger.Error("failed execute FindOne command to get observations",
			zap.Error(err), zap.Any("q", q), zap.String("requestID", requestID))
		return nil, errors.WithStack(err)
	}
	return &obs, err
}

// ObservationQuery respresent a query for the observation mongodb document.
type ObservationQuery struct {
	pagination.Pagination
	emitterChain   vaa.ChainID
	emitterAddress string
	targetChain    vaa.ChainID
	sequence       string
	guardianAddr   string
	hash           []byte
	uint64
}

// Query create a new ObservationQuery with default pagination vaues.
func Query() *ObservationQuery {
	page := pagination.FirstPage()
	return &ObservationQuery{Pagination: *page}
}

// SetEmitterChain set the emitterChain field of the ObservationQuery struct.
func (q *ObservationQuery) SetEmitterChain(chainID vaa.ChainID) *ObservationQuery {
	q.emitterChain = chainID
	return q
}

// SetTargetChain set the targetChain field of the ObservationQuery struct.
func (q *ObservationQuery) SetTargetChain(chainID vaa.ChainID) *ObservationQuery {
	q.targetChain = chainID
	return q
}

// SetEmitter set the emitter field of the ObservationQuery struct.
func (q *ObservationQuery) SetEmitter(emitter string) *ObservationQuery {
	q.emitterAddress = emitter
	return q
}

// SetSequence set the sequence field of the ObservationQuery struct.
func (q *ObservationQuery) SetSequence(seq string) *ObservationQuery {
	q.sequence = seq
	return q
}

// SetGuardianAddr set the guardianAddr field of the ObservationQuery struct.
func (q *ObservationQuery) SetGuardianAddr(guardianAddr string) *ObservationQuery {
	q.guardianAddr = guardianAddr
	return q
}

// SetHash set the hash field of the ObservationQuery struct.
func (q *ObservationQuery) SetHash(hash []byte) *ObservationQuery {
	q.hash = hash
	return q
}

// SetPagination set the pagination field of the ObservationQuery struct.
func (q *ObservationQuery) SetPagination(p *pagination.Pagination) *ObservationQuery {
	q.Pagination = *p
	return q
}

func (q *ObservationQuery) toBSON() *bson.D {
	r := bson.D{}
	if q.emitterChain > 0 {
		r = append(r, bson.E{Key: "emitterChain", Value: q.emitterChain})
	}
	if q.emitterAddress != "" {
		r = append(r, bson.E{Key: "emitterAddr", Value: q.emitterAddress})
	}
	if q.targetChain > 0 {
		r = append(r, bson.E{Key: "targetChain", Value: q.targetChain})
	}
	if q.sequence != "" {
		r = append(r, bson.E{Key: "sequence", Value: q.sequence})
	}
	if len(q.hash) > 0 {
		r = append(r, bson.E{Key: "hash", Value: q.hash})
	}
	if q.guardianAddr != "" {
		r = append(r, bson.E{Key: "guardianAddr", Value: q.guardianAddr})
	}

	return &r
}
