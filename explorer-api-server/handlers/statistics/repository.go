package statistics

import (
	"context"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"
)

// TODO: calc from the release date
const daysSinceRelease = 1000
const oneDay = 24 * time.Hour

type statistic[T any] interface {
	update(docs *StatisticDoc) error
	clone() T
}

type statCache[T statistic[T]] struct {
	statKey string
	stat    T
	date    time.Time
	lock    sync.Mutex
}

func newStatCache[T statistic[T]](stateKey string, initValue T, date time.Time) *statCache[T] {
	return &statCache[T]{
		statKey: stateKey,
		stat:    initValue,
		date:    date,
		lock:    sync.Mutex{},
	}
}

func (c *statCache[T]) update(doc *StatisticDoc, logger *zap.Logger) {
	if err := c.stat.update(doc); err != nil {
		logger.Error("failed to update statistic", zap.String("statKey", c.statKey), zap.String("_id", doc.ID), zap.Error(err))
	}
}

func (c *statCache[T]) updateToDate(docs []*StatisticDoc, date time.Time, logger *zap.Logger) {
	c.lock.Lock()
	defer c.lock.Unlock()
	if date.Equal(c.date) {
		return
	}
	c.date = date
	for _, doc := range docs {
		c.update(doc, logger)
	}
}

type Repository struct {
	logger      *zap.Logger
	collections struct {
		statistics *mongo.Collection
		tokens     *mongo.Collection
	}

	totalMessagesCache              *statCache[*TotalMessages]
	totalNotionalTransferredCache   *statCache[*TotalNotionalTransferred]
	totalNotionalTransferredToCache *statCache[*TotalNotionalTransferredTo]
	notionalTVLCache                *statCache[*TVL]
}

func NewRepository(ctx context.Context, db *mongo.Database, logger *zap.Logger) (*Repository, error) {
	r := &Repository{
		logger: logger.With(zap.String("module", "StatisticsRepository")),
		collections: struct {
			statistics *mongo.Collection
			tokens     *mongo.Collection
		}{
			statistics: db.Collection("statistics"),
			tokens:     db.Collection("tokens"),
		}}
	err := r.init(ctx)
	return r, err
}

func (r *Repository) init(ctx context.Context) error {
	now := time.Now().UTC()
	end := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	start := end.Add(-1 * time.Duration(daysSinceRelease) * oneDay)

	totalMessagesCache := newStatCache("totalMessages", emptyTotalMessages(), end)
	totalNotionalTransferredCache := newStatCache("totalNotionalTransferred", emptyTotalNotionalTransferred(), end)
	totalNotionalTransferredToCache := newStatCache("totalNotionalTransferredTo", emptyTotalNotionalTransferredTo(), end)
	notionalTVLCache := newStatCache("notionalTVL", emptyTVL(), end)

	filter := bson.M{"date": bson.M{"$gte": start, "$lt": end}}
	cursor, err := r.collections.statistics.Find(ctx, filter)
	if err != nil {
		return err
	}
	for cursor.Next(ctx) {
		var doc StatisticDoc
		if err := cursor.Decode(&doc); err != nil {
			r.logger.Error("failed to decode doc", zap.String("_id", doc.ID), zap.Error(err))
			continue
		}
		totalMessagesCache.update(&doc, r.logger)
		totalNotionalTransferredCache.update(&doc, r.logger)
		totalNotionalTransferredToCache.update(&doc, r.logger)
		notionalTVLCache.update(&doc, r.logger)
	}
	if err = cursor.Err(); err != nil {
		return err
	}
	r.totalMessagesCache = totalMessagesCache
	r.totalNotionalTransferredCache = totalNotionalTransferredCache
	r.totalNotionalTransferredToCache = totalNotionalTransferredToCache
	r.notionalTVLCache = notionalTVLCache
	r.logger.Info("total messages", zap.Any("messagesPerEmitter", totalMessagesCache.stat.TotalMessagesPerEmitter))
	r.logger.Info("total notional transferred", zap.Any("notionalTransferred", totalNotionalTransferredCache.stat.TotalTransferred))
	r.logger.Info("total notional transferred to", zap.Any("notionalTransferredTo", totalNotionalTransferredToCache.stat.TotalTransferred))
	r.logger.Info("notional tvl", zap.Any("notionalTVL", notionalTVLCache.stat.TVL))
	return nil
}

func (r *Repository) getToken(ctx context.Context, tokenChain vaa.ChainID, tokenAddress string) (*TokenDoc, error) {
	id := fmt.Sprintf("%v:%v", tokenAddress, tokenChain)
	res := r.collections.tokens.FindOne(ctx, bson.M{"_id": id})
	if err := res.Err(); err != nil {
		return nil, err
	}
	var doc TokenDoc
	err := res.Decode(&doc)
	return &doc, err
}

func (r *Repository) getAllTokens(ctx context.Context) ([]*TokenDoc, error) {
	projection := bson.D{
		{Key: "tokenAddress", Value: 1}, {Key: "tokenChain", Value: 1}, {Key: "decimals", Value: 1},
		{Key: "symbol", Value: 1}, {Key: "name", Value: 1}, {Key: "nativeAddress", Value: 1},
	}
	cursor, err := r.collections.tokens.Find(ctx, bson.D{}, options.Find().SetProjection(projection))
	if err != nil {
		return nil, err
	}
	tokens := make([]*TokenDoc, 0)
	for cursor.Next(ctx) {
		var doc TokenDoc
		if err := cursor.Decode(&doc); err != nil {
			r.logger.Error("failed to decode doc", zap.String("_id", doc.ID), zap.Error(err))
			continue
		}
		tokens = append(tokens, &doc)
	}
	return tokens, nil
}

func (r *Repository) getDocsFromInterval(ctx context.Context, start, end time.Time) ([]*StatisticDoc, error) {
	filter := bson.M{"date": bson.M{"$gte": start, "$lt": end}}
	var docs []*StatisticDoc
	cursor, err := r.collections.statistics.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	err = cursor.All(ctx, &docs)
	return docs, err
}

func tryToUpdateCache[T statistic[T]](r *Repository, ctx context.Context, cache *statCache[T], now time.Time) {
	if now.After(cache.date.Add(oneDay)) {
		end := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
		start := cache.date

		docs, err := r.getDocsFromInterval(ctx, start, end)
		if err != nil {
			r.logger.Error("failed to update the statistic cache", zap.String("key", cache.statKey), zap.Error(err))
		} else {
			cache.updateToDate(docs, end, r.logger)
		}
	}
}

func query[T statistic[T]](r *Repository, ctx context.Context, cache *statCache[T], projection bson.D) (T, error) {
	now := time.Now().UTC()
	tryToUpdateCache(r, ctx, cache, now)
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	filter := bson.M{"date": bson.M{"$gte": start, "$lt": now}}
	stat := cache.stat.clone()
	cursor, err := r.collections.statistics.Find(ctx, filter, options.Find().SetProjection(projection))
	if err != nil {
		return stat, err
	}
	for cursor.Next(ctx) {
		var doc StatisticDoc
		if err := cursor.Decode(&doc); err != nil {
			r.logger.Error("failed to decode doc", zap.String("_id", doc.ID), zap.Error(err))
			continue
		}
		if err = stat.update(&doc); err != nil {
			r.logger.Error("failed to update the statistic", zap.String("_id", doc.ID), zap.Error(err))
		}
	}
	return stat, nil
}

func (r *Repository) Query(ctx context.Context, days int, projection bson.D, fn func(*StatisticDoc) error) error {
	now := time.Now().UTC()
	end := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.UTC)
	start := end.Add(-1 * time.Duration(days) * oneDay)
	filter := bson.M{"date": bson.M{"$gte": start, "$lt": end}}
	cursor, err := r.collections.statistics.Find(ctx, filter, options.Find().SetProjection(projection))
	if err != nil {
		return err
	}
	for cursor.Next(ctx) {
		var doc StatisticDoc
		if err := cursor.Decode(&doc); err != nil {
			r.logger.Error("failed to decode doc", zap.String("_id", doc.ID), zap.Error(err))
			continue
		}
		if err = fn(&doc); err != nil {
			r.logger.Error("failed to update the statistic", zap.String("_id", doc.ID), zap.Error(err))
		}
	}
	return cursor.Err()
}

type EmitterKey struct {
	date    int64
	chainId vaa.ChainID
	address string
}

type TotalMessages struct {
	TotalMessagesPerEmitter map[EmitterKey]uint32
}

func emptyTotalMessages() *TotalMessages {
	return &TotalMessages{
		TotalMessagesPerEmitter: map[EmitterKey]uint32{},
	}
}

func (t *TotalMessages) update(doc *StatisticDoc) error {
	key := EmitterKey{
		date:    doc.Date.UTC().Unix(),
		chainId: doc.EmitterChain,
		address: doc.EmitterAddr,
	}
	count, ok := t.TotalMessagesPerEmitter[key]
	if ok {
		t.TotalMessagesPerEmitter[key] = count + doc.TotalVAACount
	} else {
		t.TotalMessagesPerEmitter[key] = doc.TotalVAACount
	}
	return nil
}

func (t *TotalMessages) clone() *TotalMessages {
	newOne := emptyTotalMessages()
	for k, v := range t.TotalMessagesPerEmitter {
		newOne.TotalMessagesPerEmitter[k] = v
	}
	return newOne
}

func (r *Repository) TotalMessages(ctx context.Context) (*TotalMessages, error) {
	projection := bson.D{
		{Key: "_id", Value: 1}, {Key: "date", Value: 1}, {Key: "emitterChain", Value: 1},
		{Key: "emitterAddr", Value: 1}, {Key: "totalVAACount", Value: 1},
	}
	return query(r, ctx, r.totalMessagesCache, projection)
}

type TokenTransferKey struct {
	emitterChain vaa.ChainID
	targetChain  vaa.ChainID
	tokenChain   vaa.ChainID
	tokenAddress string
}

type TotalNotionalTransferred struct {
	TotalTransferred map[TokenTransferKey]float64
}

func emptyTotalNotionalTransferred() *TotalNotionalTransferred {
	return &TotalNotionalTransferred{
		TotalTransferred: map[TokenTransferKey]float64{},
	}
}

func (t *TotalNotionalTransferred) update(doc *StatisticDoc) error {
	key := TokenTransferKey{
		emitterChain: doc.EmitterChain,
		targetChain:  doc.TargetChain,
		tokenChain:   doc.TokenChain,
		tokenAddress: doc.TokenAddress,
	}
	totalAmount, ok := t.TotalTransferred[key]
	if ok {
		t.TotalTransferred[key] = totalAmount + doc.TotalNotionalUSD
	} else {
		t.TotalTransferred[key] = doc.TotalNotionalUSD
	}
	return nil
}

func (t *TotalNotionalTransferred) clone() *TotalNotionalTransferred {
	newOne := emptyTotalNotionalTransferred()
	for k, v := range t.TotalTransferred {
		newOne.TotalTransferred[k] = v
	}
	return newOne
}

func (r *Repository) TotalNotionalTransferred(ctx context.Context) (*TotalNotionalTransferred, error) {
	projection := bson.D{
		{Key: "_id", Value: 1}, {Key: "date", Value: 1}, {Key: "emitterChain", Value: 1}, {Key: "emitterAddr", Value: 1},
		{Key: "targetChain", Value: 1}, {Key: "tokenChain", Value: 1}, {Key: "tokenAddress", Value: 1}, {Key: "totalNotionalUSD", Value: 1},
	}
	return query(r, ctx, r.totalNotionalTransferredCache, projection)
}

type TokenTransferToKey struct {
	date         int64
	targetChain  vaa.ChainID
	tokenChain   vaa.ChainID
	tokenAddress string
}

type TotalNotionalTransferredTo struct {
	TotalTransferred map[TokenTransferToKey]float64
}

func emptyTotalNotionalTransferredTo() *TotalNotionalTransferredTo {
	return &TotalNotionalTransferredTo{
		TotalTransferred: map[TokenTransferToKey]float64{},
	}
}

func (t *TotalNotionalTransferredTo) update(doc *StatisticDoc) error {
	key := TokenTransferToKey{
		date:         doc.Date.UTC().Unix(),
		targetChain:  doc.TargetChain,
		tokenChain:   doc.TokenChain,
		tokenAddress: doc.TokenAddress,
	}
	totalAmount, ok := t.TotalTransferred[key]
	if ok {
		t.TotalTransferred[key] = totalAmount + doc.TotalNotionalUSD
	} else {
		t.TotalTransferred[key] = doc.TotalNotionalUSD
	}
	return nil
}

func (t *TotalNotionalTransferredTo) clone() *TotalNotionalTransferredTo {
	newOne := emptyTotalNotionalTransferredTo()
	for k, v := range t.TotalTransferred {
		newOne.TotalTransferred[k] = v
	}
	return newOne
}

func (r *Repository) TotalNotionalTransferredTo(ctx context.Context) (*TotalNotionalTransferredTo, error) {
	projection := bson.D{
		{Key: "_id", Value: 1}, {Key: "date", Value: 1}, {Key: "targetChain", Value: 1},
		{Key: "tokenChain", Value: 1}, {Key: "tokenAddress", Value: 1}, {Key: "totalNotionalUSD", Value: 1},
	}
	return query(r, ctx, r.totalNotionalTransferredToCache, projection)
}

type TVLKey struct {
	tokenChain   vaa.ChainID
	tokenAddress string
}

type TVL struct {
	TVL map[TVLKey]*big.Int
}

func emptyTVL() *TVL {
	return &TVL{
		TVL: map[TVLKey]*big.Int{},
	}
}

func (t *TVL) update(doc *StatisticDoc) error {
	key := TVLKey{
		tokenChain:   doc.TokenChain,
		tokenAddress: doc.TokenAddress,
	}
	totalAmount, ok := t.TVL[key]
	if !ok {
		totalAmount = big.NewInt(0)
		t.TVL[key] = totalAmount
	}
	amountChanged, succeed := new(big.Int).SetString(doc.TotalTransferAmount, 10)
	if !succeed {
		return fmt.Errorf("invalid transfer amount %v", doc.TotalTransferAmount)
	}
	if doc.EmitterChain == doc.TokenChain {
		totalAmount.Add(totalAmount, amountChanged)
	} else if doc.TargetChain == doc.TokenChain {
		totalAmount.Sub(totalAmount, amountChanged)
	}
	return nil
}

func (t *TVL) clone() *TVL {
	newOne := emptyTVL()
	for k, v := range t.TVL {
		newOne.TVL[k] = v
	}
	return newOne
}

func (r *Repository) TVL(ctx context.Context) (*TVL, error) {
	projection := bson.D{
		{Key: "_id", Value: 1}, {Key: "emitterChain", Value: 1}, {Key: "targetChain", Value: 1},
		{Key: "tokenChain", Value: 1}, {Key: "tokenAddress", Value: 1}, {Key: "totalTransferAmount", Value: 1},
	}
	return query(r, ctx, r.notionalTVLCache, projection)
}
