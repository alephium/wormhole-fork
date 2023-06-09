package vaa

import (
	"context"
	"fmt"

	errs "github.com/alephium/wormhole-fork/explorer-api-server/internal/errors"
	"github.com/alephium/wormhole-fork/explorer-api-server/internal/pagination"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/pkg/errors"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"
)

// Repository definition
type Repository struct {
	db          *mongo.Database
	logger      *zap.Logger
	collections struct {
		vaas     *mongo.Collection
		vaaCount *mongo.Collection
	}
}

// NewRepository create a new Repository.
func NewRepository(db *mongo.Database, logger *zap.Logger) *Repository {
	return &Repository{db: db,
		logger: logger.With(zap.String("module", "VaaRepository")),
		collections: struct {
			vaas     *mongo.Collection
			vaaCount *mongo.Collection
		}{
			vaas:     db.Collection("vaas"),
			vaaCount: db.Collection("vaaCounts"),
		}}
}

func (r *Repository) RawQuery(ctx context.Context, filter interface{}, options ...*options.FindOptions) ([]*VaaDoc, error) {
	cur, err := r.collections.vaas.Find(ctx, filter, options...)
	if err != nil {
		requestID := fmt.Sprintf("%v", ctx.Value("requestid"))
		r.logger.Error("failed execute Find command to get vaas",
			zap.Error(err), zap.Any("filter", filter), zap.String("requestID", requestID))
		return nil, errors.WithStack(err)
	}
	var vaas []*VaaDoc
	err = cur.All(ctx, &vaas)
	if err != nil {
		requestID := fmt.Sprintf("%v", ctx.Value("requestid"))
		r.logger.Error("failed decoding cursor to []*VaaDoc", zap.Error(err), zap.Any("filter", filter),
			zap.String("requestID", requestID))
		return nil, errors.WithStack(err)
	}
	return vaas, err
}

// Find get a list of *VaaDoc.
// The input parameter [q *VaaQuery] define the filters to apply in the query.
func (r *Repository) Find(ctx context.Context, q *VaaQuery) ([]*VaaDoc, error) {
	if q == nil {
		q = Query()
	}
	sort := bson.D{{q.SortBy, q.GetSortInt()}}
	return r.RawQuery(ctx, q.toBSON(), options.Find().SetLimit(q.PageSize).SetSkip(q.Offset).SetSort(sort))
}

// FindOne get *VaaDoc.
// The input parameter [q *VaaQuery] define the filters to apply in the query.
func (r *Repository) FindOne(ctx context.Context, q *VaaQuery) (*VaaDoc, error) {
	var vaaDoc VaaDoc
	err := r.collections.vaas.FindOne(ctx, q.toBSON()).Decode(&vaaDoc)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errs.ErrNotFound
		}
		requestID := fmt.Sprintf("%v", ctx.Value("requestid"))
		r.logger.Error("failed execute FindOne command to get vaas",
			zap.Error(err), zap.Any("q", q), zap.String("requestID", requestID))
		return nil, errors.WithStack(err)
	}

	return &vaaDoc, err
}

// GetVaaCount get a count of vaa by chainID.
func (r *Repository) GetVaaCount(ctx context.Context, q *VaaQuery) ([]*VaaStats, error) {
	if q == nil {
		q = Query()
	}
	sort := bson.D{{q.SortBy, q.GetSortInt()}}
	cur, err := r.collections.vaaCount.Find(ctx, q.toBSON(), options.Find().SetLimit(q.PageSize).SetSkip(q.Offset).SetSort(sort))
	if err != nil {
		requestID := fmt.Sprintf("%v", ctx.Value("requestid"))
		r.logger.Error("failed execute Find command to get vaaCount",
			zap.Error(err), zap.String("requestID", requestID))
		return nil, errors.WithStack(err)
	}
	var varCounts []*VaaStats
	err = cur.All(ctx, &varCounts)
	if err != nil {
		requestID := fmt.Sprintf("%v", ctx.Value("requestid"))
		r.logger.Error("failed decoding cursor to []*VaaStats", zap.Error(err), zap.Any("q", q),
			zap.String("requestID", requestID))
		return nil, errors.WithStack(err)
	}
	return varCounts, nil
}

// VaaQuery respresent a query for the vaa mongodb document.
type VaaQuery struct {
	pagination.Pagination
	emitterChain   vaa.ChainID
	emitterAddress string
	targetChain    vaa.ChainID
	sequence       *uint64
	txId           []byte
}

// Query create a new VaaQuery with default pagination vaues.
func Query() *VaaQuery {
	page := pagination.FirstPage()
	return &VaaQuery{Pagination: *page}
}

// SetEmitterChain set the emitterChain field of the VaaQuery struct.
func (q *VaaQuery) SetEmitterChain(chainID vaa.ChainID) *VaaQuery {
	q.emitterChain = chainID
	return q
}

// SetTargetChain set the targetChain field of the VaaQuery struct.
func (q *VaaQuery) SetTargetChain(chainID vaa.ChainID) *VaaQuery {
	q.targetChain = chainID
	return q
}

// SetEmitterAddress set the emitter field of the VaaQuery struct.
func (q *VaaQuery) SetEmitterAddress(emitter string) *VaaQuery {
	q.emitterAddress = emitter
	return q
}

// SetSequence set the sequence field of the VaaQuery struct.
func (q *VaaQuery) SetSequence(seq uint64) *VaaQuery {
	q.sequence = &seq
	return q
}

func (q *VaaQuery) SetTxId(txId []byte) *VaaQuery {
	q.txId = txId
	return q
}

// SetPagination set the pagination field of the VaaQuery struct.
func (q *VaaQuery) SetPagination(p *pagination.Pagination) *VaaQuery {
	q.Pagination = *p
	return q
}

func (q *VaaQuery) toBSON() *bson.D {
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
	if q.sequence != nil {
		r = append(r, bson.E{Key: "sequence", Value: *q.sequence})
	}
	if len(q.txId) > 0 {
		r = append(r, bson.E{Key: "txId", Value: primitive.Binary{Subtype: 0, Data: q.txId}})
	}
	return &r
}
