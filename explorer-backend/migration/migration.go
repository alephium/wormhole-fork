package migration

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

func checkError(err error) error {
	if err != nil {
		target := &mongo.CommandError{}
		isCommandError := errors.As(err, target)
		if !isCommandError || err.(mongo.CommandError).Code != 48 { // collection already exists
			return err
		}
	}
	return nil
}

func createCollection(db *mongo.Database, name string) error {
	err := db.CreateCollection(context.TODO(), name)
	return checkError(err)
}

// TODO: move this to migration tool that support mongodb.
func Run(db *mongo.Database) error {
	// Created guardianset collection
	if err := createCollection(db, "guardianSets"); err != nil {
		return err
	}

	// Created tokens collection
	if err := createCollection(db, "tokens"); err != nil {
		return err
	}

	// Created tokentransfers collection
	if err := createCollection(db, "tokenTransfers"); err != nil {
		return err
	}

	// Created transactions collection
	if err := createCollection(db, "transactions"); err != nil {
		return err
	}

	// Created statistics collection
	if err := createCollection(db, "statistics"); err != nil {
		return err
	}

	// Created heartbeats collection.
	if err := createCollection(db, "heartbeats"); err != nil {
		return err
	}

	// Created observations collection.
	if err := createCollection(db, "observations"); err != nil {
		return err
	}

	// Created vaaCounts collection.
	if err := createCollection(db, "vaaCounts"); err != nil {
		return err
	}

	// Create vaas collection.
	if err := createCollection(db, "vaas"); err != nil {
		return err
	}

	// Create missing vaas collection.
	if err := createCollection(db, "missingVaas"); err != nil {
		return err
	}

	missingVaaIndexes := mongo.IndexModel{Keys: bson.D{{Key: "indexedAt", Value: -1}}}
	// create indexes in missing vaas collection
	_, err := db.Collection("missingVaas").Indexes().CreateOne(context.TODO(), missingVaaIndexes)
	if checkError(err) != nil {
		return err
	}

	vaaIndexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "timestamp", Value: 1}}},
		{Keys: bson.D{{Key: "txId", Value: 1}}},
		{
			Keys: bson.D{
				{Key: "emitterAddr", Value: 1},
				{Key: "emitterChain", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "emitterChain", Value: 1},
				{Key: "emitterAddr", Value: 1},
				{Key: "targetChain", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "emitterChain", Value: 1},
				{Key: "emitterAddr", Value: 1},
				{Key: "targetChain", Value: 1},
				{Key: "sequence", Value: 1},
			},
		},
	}

	// create indexes in vaas collection
	_, err = db.Collection("vaas").Indexes().CreateMany(context.TODO(), vaaIndexes)
	if checkError(err) != nil {
		return err
	}

	observationIndexes := []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "indexedAt", Value: 1}},
		},
		{
			Keys: bson.D{
				{Key: "emitterChain", Value: 1},
				{Key: "emitterAddr", Value: 1},
				{Key: "targetChain", Value: 1},
				{Key: "sequence", Value: 1},
			},
		},
		{
			Keys: bson.D{{Key: "messageId", Value: 1}},
		},
	}

	// create indexes in observations collection
	_, err = db.Collection("observations").Indexes().CreateMany(context.TODO(), observationIndexes)
	if checkError(err) != nil {
		return err
	}

	guardianSetIndex := mongo.IndexModel{Keys: bson.D{{Key: "index", Value: 1}}}
	// create indexes in guardiansets collection
	_, err = db.Collection("guardianSets").Indexes().CreateOne(context.TODO(), guardianSetIndex)
	if checkError(err) != nil {
		return err
	}

	tokenAddressIndex := mongo.IndexModel{Keys: bson.D{{Key: "tokenAddress", Value: 1}}}
	_, err = db.Collection("tokens").Indexes().CreateOne(context.TODO(), tokenAddressIndex)
	if checkError(err) != nil {
		return err
	}

	tokenTransferIndexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "timestamp", Value: 1}}},
		{
			Keys: bson.D{{Key: "tokenAddress", Value: 1}},
		},
		{
			Keys: bson.D{
				{Key: "emitterChain", Value: 1},
				{Key: "emitterAddr", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "emitterChain", Value: 1},
				{Key: "emitterAddr", Value: 1},
				{Key: "targetChain", Value: 1},
			},
		},
	}
	_, err = db.Collection("tokenTransfers").Indexes().CreateMany(context.TODO(), tokenTransferIndexes)
	if checkError(err) != nil {
		return err
	}

	statsIndexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "date", Value: 1}}},
		{
			Keys: bson.D{
				{Key: "date", Value: 1},
				{Key: "emitterChain", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "date", Value: 1},
				{Key: "emitterChain", Value: 1},
				{Key: "emitterAddr", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "date", Value: 1},
				{Key: "emitterChain", Value: 1},
				{Key: "emitterAddr", Value: 1},
				{Key: "targetChain", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "date", Value: 1},
				{Key: "emitterChain", Value: 1},
				{Key: "emitterAddr", Value: 1},
				{Key: "targetChain", Value: 1},
				{Key: "tokenChain", Value: 1},
				{Key: "tokenAddress", Value: 1},
			},
		},
	}
	_, err = db.Collection("statistics").Indexes().CreateMany(context.TODO(), statsIndexes)
	if checkError(err) != nil {
		return err
	}

	transactionsIndexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "txId", Value: 1}}},
		{Keys: bson.D{{Key: "address", Value: 1}}},
		{
			Keys: bson.D{
				{Key: "address", Value: 1},
				{Key: "emitterChain", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "address", Value: 1},
				{Key: "emitterChain", Value: 1},
				{Key: "targetChain", Value: 1},
			},
		},
		{Keys: bson.D{{Key: "eventIndex", Value: 1}}},
		{Keys: bson.D{{Key: "timestamp", Value: 1}}},
	}
	_, err = db.Collection("transactions").Indexes().CreateMany(context.TODO(), transactionsIndexes)
	if checkError(err) != nil {
		return err
	}

	return nil
}
