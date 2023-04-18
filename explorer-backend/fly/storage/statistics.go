package storage

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"
)

type stat struct {
	totalVAACount       uint32
	totalTransferAmount *big.Int
	totalNotionalUSD    float64
}

type statKey struct {
	emitterChain vaa.ChainID
	emitterAddr  string
	targetChain  vaa.ChainID
	tokenChain   vaa.ChainID
	tokenAddress string
}

type stats struct {
	stats map[statKey]*stat
}

type tokenTransferDetails struct {
	emitterChain vaa.ChainID
	emitterAddr  string
	targetChain  vaa.ChainID
	tokenChain   vaa.ChainID
	tokenAddress string
	amount       *big.Int
	notionalUSD  float64
	timestamp    *time.Time
}

func newStats() *stats {
	return &stats{
		stats: map[statKey]*stat{},
	}
}

func (s *stats) update(details *tokenTransferDetails) {
	key := statKey{
		emitterChain: details.emitterChain,
		emitterAddr:  details.emitterAddr,
		targetChain:  details.targetChain,
		tokenChain:   details.tokenChain,
		tokenAddress: details.tokenAddress,
	}
	statistic, ok := s.stats[key]
	if !ok {
		statistic = &stat{
			totalVAACount:       0,
			totalTransferAmount: big.NewInt(0),
			totalNotionalUSD:    0,
		}
		s.stats[key] = statistic
	}
	statistic.totalVAACount += 1
	statistic.totalTransferAmount.Add(statistic.totalTransferAmount, details.amount)
	statistic.totalNotionalUSD += details.notionalUSD
}

func (s *Repository) RunStat(ctx context.Context, detailsC <-chan *tokenTransferDetails, duration time.Duration) {
	start, end := getDailyTime()
	stats, err := s.init(ctx, start, end)
	if err != nil {
		s.log.Fatal("failed to init", zap.Error(err))
	}
	go s.statistic(ctx, detailsC, duration, start, end, stats)
}

func (s *Repository) statistic(
	ctx context.Context,
	detailsC <-chan *tokenTransferDetails,
	duration time.Duration,
	startTime, endTime time.Time,
	stats *stats,
) {
	detailsCache := make([]*tokenTransferDetails, 0)
	start, end := startTime, endTime
	statsCache := stats
	tick := time.NewTicker(duration)

	for {
		select {
		case <-ctx.Done():
			return

		case details := <-detailsC:
			s.log.Debug("received new token transfer vaa",
				zap.Uint16("emitterChain", uint16(details.emitterChain)),
				zap.Uint16("targetChain", uint16(details.targetChain)),
				zap.Uint16("tokenChain", uint16(details.tokenChain)),
				zap.String("tokenAddress", details.tokenAddress),
				zap.String("amount", details.amount.String()),
			)
			detailsCache = append(detailsCache, details)

		case <-tick.C:
			if len(detailsCache) == 0 {
				break
			}
			s.log.Debug("update statistic tick", zap.Int("cacheSize", len(detailsCache)))
			now := time.Now()
			for _, details := range detailsCache {
				ts := details.timestamp.UTC()
				if ts.After(start) && ts.Before(end) {
					statsCache.update(details)
					continue
				}
				if err := s.updateForDate(ctx, details, &now); err != nil {
					s.log.Error("failed to update statistic for date", zap.Time("date", ts), zap.Error(err))
				}
			}
			detailsCache = make([]*tokenTransferDetails, 0)

			var err error
			if err = s.update(ctx, start, statsCache, &now); err != nil {
				s.log.Error("failed to update statistic", zap.Time("start", start), zap.Time("end", end), zap.Error(err))
			}

			newStart, newEnd := getDailyTime()
			if newStart != start {
				start = newStart
				end = newEnd
				if statsCache, err = s.init(ctx, start, end); err != nil {
					s.log.Error("failed to calc statistic", zap.Time("start", start), zap.Time("end", end), zap.Error(err))
				}
			}
		}
	}
}

func (s *Repository) init(ctx context.Context, start, end time.Time) (*stats, error) {
	filter := bson.M{"timestamp": bson.M{"$gte": start, "$lt": end}}
	cursor, err := s.collections.tokenTransfers.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	stats := newStats()
	for cursor.Next(ctx) {
		var result TokenTransferUpdate
		if err := cursor.Decode(&result); err != nil {
			return nil, err
		}
		amount, succeed := new(big.Int).SetString(result.Amount, 10)
		if amount == nil || !succeed {
			return nil, fmt.Errorf("invalid token transfer amount %v", result.Amount)
		}
		details := &tokenTransferDetails{
			emitterChain: result.EmitterChain,
			emitterAddr:  result.EmitterAddr,
			targetChain:  result.TargetChain,
			tokenChain:   result.TokenChain,
			tokenAddress: result.TokenAddress,
			amount:       amount,
			notionalUSD:  result.NotionalUSD,
			timestamp:    result.Timestamp,
		}
		stats.update(details)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return stats, nil
}

func (s *Repository) update(ctx context.Context, start time.Time, stats *stats, now *time.Time) error {
	if len(stats.stats) == 0 {
		return nil
	}
	writeModels := make([]mongo.WriteModel, 0)
	for key, stat := range stats.stats {
		s.log.Debug("update statistic",
			zap.Uint16("emitterChain", uint16(key.emitterChain)),
			zap.Uint16("targetChain", uint16(key.targetChain)),
			zap.Uint16("tokenChain", uint16(key.tokenChain)),
			zap.String("tokenAddress", key.tokenAddress),
			zap.Uint32("totalVAACount", stat.totalVAACount),
			zap.String("totalTransferAmount", stat.totalTransferAmount.String()),
			zap.Float64("totalNotionalUSD", stat.totalNotionalUSD),
		)
		filter := bson.M{"date": start, "emitterChain": key.emitterChain, "emitterAddr": key.emitterAddr, "targetChain": key.targetChain, "tokenChain": key.tokenChain, "tokenAddress": key.tokenAddress}
		update := bson.M{"totalVAACount": stat.totalVAACount, "totalTransferAmount": stat.totalTransferAmount.String(), "totalNotionalUSD": stat.totalNotionalUSD, "updatedAt": now}
		writeModel := mongo.NewUpdateOneModel().SetFilter(filter).SetUpdate(bson.M{"$set": update}).SetUpsert(true)
		writeModels = append(writeModels, writeModel)
	}
	_, err := s.collections.statistics.BulkWrite(ctx, writeModels)
	return err
}

func (s *Repository) updateForDate(ctx context.Context, details *tokenTransferDetails, now *time.Time) error {
	ts := details.timestamp.UTC()
	date := time.Date(ts.Year(), ts.Month(), ts.Day(), 0, 0, 0, 0, time.UTC)
	filter := bson.M{"date": date, "emitterChain": details.emitterChain, "emitterAddr": details.emitterAddr, "targetChain": details.targetChain, "tokenChain": details.tokenChain, "tokenAddress": details.tokenAddress}
	var doc StatisticUpdate
	err := s.collections.statistics.FindOne(ctx, filter).Decode(&doc)
	if err == nil {
		amount, succeed := new(big.Int).SetString(doc.TotalTransferAmount, 10)
		if !succeed {
			return fmt.Errorf("invalid transfer amount %v", doc.TotalTransferAmount)
		}
		amount.Add(amount, details.amount)
		doc.TotalVAACount += 1
		doc.TotalTransferAmount = amount.String()
		doc.TotalNotionalUSD += details.notionalUSD
		doc.UpdatedAt = now
		_, err = s.collections.statistics.UpdateByID(ctx, doc.ID, bson.M{"$set": doc}, options.Update().SetUpsert(true))
	} else if err == mongo.ErrNoDocuments {
		doc.ID = primitive.NewObjectID().String()
		doc.Date = &date
		doc.EmitterChain = details.emitterChain
		doc.EmitterAddr = details.emitterAddr
		doc.TargetChain = details.targetChain
		doc.TokenChain = details.tokenChain
		doc.TokenAddress = details.tokenAddress
		doc.TotalVAACount = 1
		doc.TotalTransferAmount = details.amount.String()
		doc.TotalNotionalUSD = details.notionalUSD
		doc.UpdatedAt = now
		_, err = s.collections.statistics.InsertOne(ctx, doc)
	}
	return err
}

func getDailyTime() (time.Time, time.Time) {
	now := time.Now().UTC()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	end := start.Add(24 * time.Hour)
	return start, end
}
