package migration

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// TODO: move this to migration tool that support mongodb.
func Run(db *mongo.Database) error {
	// Created heartbeats collection.
	err := db.CreateCollection(context.TODO(), "heartbeats")
	if err != nil {
		target := &mongo.CommandError{}
		isCommandError := errors.As(err, target)
		if !isCommandError || err.(mongo.CommandError).Code != 48 {
			return err
		}
	}

	// Created observations collection.
	err = db.CreateCollection(context.TODO(), "observations")
	if err != nil {
		target := &mongo.CommandError{}
		isCommandError := errors.As(err, target)
		if !isCommandError || err.(mongo.CommandError).Code != 48 {
			return err
		}
	}

	// Created vaaCounts collection.
	err = db.CreateCollection(context.TODO(), "vaaCounts")
	if err != nil {
		target := &mongo.CommandError{}
		isCommandError := errors.As(err, target)
		if !isCommandError || err.(mongo.CommandError).Code != 48 {
			return err
		}
	}

	// Create vaas collection.
	err = db.CreateCollection(context.TODO(), "vaas")
	if err != nil {
		target := &mongo.CommandError{}
		isCommandError := errors.As(err, target)
		if !isCommandError || err.(mongo.CommandError).Code != 48 {
			return err
		}
	}

	// Create missing vaas collection.
	err = db.CreateCollection(context.TODO(), "missingVaas")
	// TODO: improve error handling
	if err != nil {
		target := &mongo.CommandError{}
		isCommandError := errors.As(err, target)
		if !isCommandError || err.(mongo.CommandError).Code != 48 {
			return err
		}
	}

	missingVaaIndexes := mongo.IndexModel{Keys: bson.D{{Key: "indexedAt", Value: -1}}}
	// create indexes in missing vaas collection
	_, err = db.Collection("missingVaas").Indexes().CreateOne(context.TODO(), missingVaaIndexes)
	if err != nil {
		target := &mongo.CommandError{}
		isCommandError := errors.As(err, target)
		if !isCommandError || err.(mongo.CommandError).Code != 48 {
			return err
		}
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
	if err != nil {
		target := &mongo.CommandError{}
		isCommandError := errors.As(err, target)
		if !isCommandError || err.(mongo.CommandError).Code != 48 {
			return err
		}
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
	if err != nil {
		target := &mongo.CommandError{}
		isCommandError := errors.As(err, target)
		if !isCommandError || err.(mongo.CommandError).Code != 48 {
			return err
		}
	}
	return nil
}
