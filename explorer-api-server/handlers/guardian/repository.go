package guardian

import (
	"context"
	"fmt"

	"github.com/pkg/errors"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"
)

type Repository struct {
	db          *mongo.Database
	logger      *zap.Logger
	collections struct {
		guardianSets *mongo.Collection
	}
}

func NewRepository(db *mongo.Database, logger *zap.Logger) *Repository {
	return &Repository{db: db,
		logger:      logger.With(zap.String("module", "GuardianSetsRepository")),
		collections: struct{ guardianSets *mongo.Collection }{guardianSets: db.Collection("guardianSets")},
	}
}

func (r *Repository) GetCurrentGuardianSet(ctx context.Context) (*GuardianSetDoc, error) {
	opts := options.FindOne().SetSort(bson.M{"index": -1})
	var guardianSet GuardianSetDoc
	err := r.collections.guardianSets.FindOne(ctx, bson.D{}, opts).Decode(&guardianSet)
	if err != nil {
		requestID := fmt.Sprintf("%v", ctx.Value("requestid"))
		r.logger.Error("failed decoding cursor to GuardianSetDoc", zap.Error(err), zap.String("requestID", requestID))
		return nil, errors.WithStack(err)
	}
	return &guardianSet, nil
}
