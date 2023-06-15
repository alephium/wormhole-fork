package transactions

import (
	"context"
	"encoding/hex"

	"github.com/alephium/wormhole-fork/explorer-backend/api/handlers/vaa"
	"github.com/alephium/wormhole-fork/explorer-backend/api/internal/pagination"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"
)

type Repository struct {
	db          *mongo.Database
	logger      *zap.Logger
	collections struct {
		transactions *mongo.Collection
		vaas         *mongo.Collection
	}
}

func NewRepository(db *mongo.Database, logger *zap.Logger) *Repository {
	return &Repository{db: db,
		logger: logger.With(zap.String("module", "TransactionsRepository")),
		collections: struct {
			transactions *mongo.Collection
			vaas         *mongo.Collection
		}{
			transactions: db.Collection("transactions"),
			vaas:         db.Collection("vaas"),
		}}
}

func (r *Repository) GetTransactionsBySender(ctx context.Context, sender *sender, p *pagination.Pagination) ([]*TransactionDocWithVAA, error) {
	// we only support order by timestamp now
	opts := options.Find().SetSort(bson.M{"timestamp": -1})
	if p == nil {
		opts.SetSkip(0).SetLimit(20)
	} else {
		opts.SetSkip(p.Offset).SetLimit(p.PageSize)
	}
	filter := bson.M{"address": sender.address, "emitterChain": sender.emitterChain, "targetChain": sender.targetChain}
	cur, err := r.collections.transactions.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}

	transactions := make([]*TransactionDoc, 0)
	for cur.Next(ctx) {
		var doc TransactionDoc
		if err := cur.Decode(&doc); err != nil {
			r.logger.Error("failed to decode transaction doc", zap.String("_id", doc.ID), zap.Error(err))
			continue
		}
		transactions = append(transactions, &doc)
	}
	cur.Close(ctx)

	result := make([]*TransactionDocWithVAA, len(transactions))
	for i := 0; i < len(transactions); i++ {
		tx := transactions[i]
		vaaBytes, err := r.GetVAAById(ctx, tx.ID)
		noVaa := err != nil || vaaBytes == nil
		if noVaa {
			result[i] = &TransactionDocWithVAA{TransactionDoc: *tx, Vaa: ""}
		} else {
			result[i] = &TransactionDocWithVAA{TransactionDoc: *tx, Vaa: hex.EncodeToString(vaaBytes)}
		}
	}

	return result, nil
}

func (r *Repository) GetTransactionNumberBySender(ctx context.Context, sender *sender) (*int64, error) {
	filter := bson.M{"address": sender.address, "emitterChain": sender.emitterChain, "targetChain": sender.targetChain}
	count, err := r.collections.transactions.CountDocuments(ctx, filter)
	if err != nil {
		return nil, err
	}
	return &count, nil
}

func (r *Repository) GetVAAById(ctx context.Context, id string) ([]byte, error) {
	var vaaDoc vaa.VaaDoc
	opts := options.FindOne().SetProjection(bson.D{{Key: "vaas", Value: 1}})
	err := r.collections.vaas.FindOne(ctx, bson.M{"_id": id}, opts).Decode(&vaaDoc)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return vaaDoc.Vaa, nil
}
