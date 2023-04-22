package storage

import (
	"context"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/alephium/wormhole-fork/explorer-backend/fly/utils"
	"github.com/alephium/wormhole-fork/node/pkg/common"
	gossipv1 "github.com/alephium/wormhole-fork/node/pkg/proto/gossip/v1"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	eth_common "github.com/ethereum/go-ethereum/common"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.uber.org/zap"
)

const TokenTransferPayloadId = 1
const AttestTokenPayloadId = 2

// TODO separate and maybe share between fly and web
type Repository struct {
	db                *mongo.Database
	log               *zap.Logger
	governanceChain   vaa.ChainID
	governanceEmitter vaa.Address
	cache             *sequencesCache
	tokenTransferC    chan<- *tokenTransferDetails
	collections       struct {
		vaas           *mongo.Collection
		missingVaas    *mongo.Collection
		heartbeats     *mongo.Collection
		observations   *mongo.Collection
		vaaCounts      *mongo.Collection
		guardianSets   *mongo.Collection
		tokens         *mongo.Collection
		tokenTransfers *mongo.Collection
		statistics     *mongo.Collection
	}
}

// TODO wrap repository with a service that filters using redis
func NewRepository(
	ctx context.Context,
	db *mongo.Database,
	log *zap.Logger,
	governanceChain vaa.ChainID,
	governanceEmitter vaa.Address,
	statDuration time.Duration,
) *Repository {
	cache := newSequencesCache()
	tokenTransferC := make(chan *tokenTransferDetails, 64)
	r := &Repository{db, log, governanceChain, governanceEmitter, cache, tokenTransferC, struct {
		vaas           *mongo.Collection
		missingVaas    *mongo.Collection
		heartbeats     *mongo.Collection
		observations   *mongo.Collection
		vaaCounts      *mongo.Collection
		guardianSets   *mongo.Collection
		tokens         *mongo.Collection
		tokenTransfers *mongo.Collection
		statistics     *mongo.Collection
	}{
		vaas:           db.Collection("vaas"),
		missingVaas:    db.Collection("missingVaas"),
		heartbeats:     db.Collection("heartbeats"),
		observations:   db.Collection("observations"),
		vaaCounts:      db.Collection("vaaCounts"),
		guardianSets:   db.Collection("guardianSets"),
		tokens:         db.Collection("tokens"),
		tokenTransfers: db.Collection("tokenTransfers"),
		statistics:     db.Collection("statistics"),
	}}
	r.RunStat(ctx, tokenTransferC, statDuration)
	return r
}

func (s *Repository) getMissingSequences(ctx context.Context, emitterId *emitterId, sequence uint64) ([]uint64, error) {
	seq := s.cache.getNextSequence(emitterId)
	if seq == nil {
		nextSeq, err := s.nextSequence(ctx, emitterId)
		if err != nil {
			return nil, err
		}
		s.cache.setNextSequence(emitterId, *nextSeq)
		seq = nextSeq
	}

	if *seq >= sequence {
		return nil, nil
	}
	size := int(sequence - *seq)
	vaaIds := make([]uint64, size)
	for i := 0; i < size; i++ {
		vaaIds[i] = *seq + uint64(i)
	}
	return vaaIds, nil
}

func (s *Repository) upsertMissingIds(ctx context.Context, emitterId *emitterId, sequence uint64) error {
	missingSequences, err := s.getMissingSequences(ctx, emitterId, sequence)
	if err != nil {
		return err
	}
	s.cache.setNextSequence(emitterId, sequence+1)
	if missingSequences == nil {
		return nil
	}
	s.log.Info("Found missing sequences", zap.String("emitterId", emitterId.toString()), zap.Uint64("currentSeq", sequence), zap.Uint64s("missings", missingSequences))
	var (
		now    = time.Now()
		models = make([]mongo.WriteModel, len(missingSequences))
	)
	for i, seq := range missingSequences {
		id := emitterId.toVaaId(seq)
		doc, err := toDoc(MissingVaaUpdate{id})
		if err != nil {
			return err
		}
		update := bson.D{
			{Key: "$set", Value: doc},
			{Key: "$setOnInsert", Value: indexedAt(now)},
		}
		filter := bson.D{{Key: "_id", Value: id}}
		models[i] = mongo.NewUpdateOneModel().SetUpdate(update).SetUpsert(true).SetFilter(filter)
	}
	opts := options.BulkWrite().SetOrdered(true)
	_, err = s.collections.missingVaas.BulkWrite(ctx, models, opts)
	return err
}

func (s *Repository) getEmitterId(v *vaa.VAA) *emitterId {
	if v.EmitterChain == s.governanceChain && v.EmitterAddress == s.governanceEmitter {
		return &emitterId{
			emitterChain:        v.EmitterChain,
			emitterAddress:      v.EmitterAddress,
			isGovernanceEmitter: true,
		}
	}
	return &emitterId{
		emitterChain:        v.EmitterChain,
		emitterAddress:      v.EmitterAddress,
		targetChain:         v.TargetChain,
		isGovernanceEmitter: false,
	}
}

func (s *Repository) UpsertVaa(ctx context.Context, v *vaa.VAA, serializedVaa []byte) error {
	emitterId := s.getEmitterId(v)
	err := s.upsertMissingIds(ctx, emitterId, v.Sequence)
	if err != nil {
		return nil
	}
	return s.upsertVaa(ctx, v, serializedVaa)
}

func (s *Repository) upsertVaa(ctx context.Context, v *vaa.VAA, serialized []byte) error {
	id := v.MessageID()
	txId, err := s.getTxIdByMessageId(ctx, id)
	if err != nil {
		s.log.Warn("failed to get the tx id", zap.String("messageId", id), zap.Error(err))
	}
	now := time.Now()
	if err = s.processVaa(ctx, v, &now); err != nil {
		s.log.Error("failed to process vaa", zap.String("messageId", id), zap.Error(err))
	}
	vaaDoc := VaaUpdate{
		ID:               id,
		Timestamp:        &v.Timestamp,
		Version:          v.Version,
		EmitterChain:     v.EmitterChain,
		EmitterAddr:      v.EmitterAddress.String(),
		TargetChain:      v.TargetChain,
		Sequence:         v.Sequence,
		TxId:             txId,
		GuardianSetIndex: v.GuardianSetIndex,
		Vaa:              serialized,
		UpdatedAt:        &now,
	}

	update := bson.M{
		"$set":         vaaDoc,
		"$setOnInsert": indexedAt(now),
		"$inc":         bson.D{{Key: "revision", Value: 1}},
	}

	opts := options.Update().SetUpsert(true)
	result, err := s.collections.vaas.UpdateByID(ctx, id, update, opts)
	if err == nil && s.isNewRecord(result) {
		s.updateVAACount(v.EmitterChain)
	}
	return err
}

func (s *Repository) processVaa(ctx context.Context, v *vaa.VAA, now *time.Time) error {
	if v.EmitterChain == s.governanceChain && v.EmitterAddress == s.governanceEmitter {
		return nil
	}
	switch v.Payload[0] {
	case TokenTransferPayloadId:
		tokenTransfer, err := DecodeTokenTransfer(v.Payload)
		if err != nil {
			return err
		}
		return s.upsertTokenTransfer(ctx, v, tokenTransfer)
	case AttestTokenPayloadId:
		attestToken, err := DecodeAttestToken(v.Payload)
		if err != nil {
			return err
		}
		return s.upsertToken(ctx, v, attestToken, now)
	default:
		return fmt.Errorf("unknown payload id %v", v.Payload[0])
	}
}

func (s *Repository) getTokenPrice(coinGeckoCoinId, symbol string, timestamp time.Time) float64 {
	if coinGeckoCoinId == "" {
		return 0
	}
	price, err := utils.FetchCoinGeckoPrice(coinGeckoCoinId, timestamp)
	if err != nil {
		s.log.Error("failed to fetch price from coingecko", zap.String("tokenSymbol", symbol), zap.Error(err))
		return 0
	}
	return price
}

func (s *Repository) upsertTokenTransfer(ctx context.Context, v *vaa.VAA, tokenTransfer *TokenTransfer) error {
	id := v.MessageID()
	tokenAddress := strings.ToLower(hex.EncodeToString(tokenTransfer.TokenAddress[:]))
	s.log.Debug("new token transfer vaa", zap.String("tokenAddress", tokenAddress), zap.Uint16("tokenChain", uint16(tokenTransfer.TokenChain)), zap.String("amount", tokenTransfer.Amount.String()))
	tokenDoc, err := s.getToken(ctx, tokenAddress, tokenTransfer.TokenChain)
	if err != nil {
		return fmt.Errorf("the token does not exist, address: %v, chainId: %v", tokenAddress, tokenTransfer.TokenChain)
	}

	price := s.getTokenPrice(tokenDoc.CoinGeckoCoinId, tokenDoc.Symbol, v.Timestamp.UTC())
	notionalUSD, _ := utils.CalcNotionalAmount(&tokenTransfer.Amount, tokenDoc.Decimals, price).Float64()
	emitterAddr := hex.EncodeToString(v.EmitterAddress[:])
	tokenTransferDoc := TokenTransferUpdate{
		ID:           id,
		EmitterChain: v.EmitterChain,
		EmitterAddr:  emitterAddr,
		TargetChain:  v.TargetChain,
		TokenAddress: tokenAddress,
		Symbol:       tokenDoc.Symbol,
		TokenChain:   tokenDoc.TokenChain,
		ToAddress:    hex.EncodeToString(tokenTransfer.TargetAddress),
		Amount:       tokenTransfer.Amount.String(),
		NotionalUSD:  notionalUSD,
		PriceUSD:     fmt.Sprintf("%v", price),
		Timestamp:    &v.Timestamp,
	}
	update := bson.D{{Key: "$set", Value: tokenTransferDoc}}
	opts := options.Update().SetUpsert(true)
	_, err = s.collections.tokenTransfers.UpdateByID(context.TODO(), id, update, opts)
	if err != nil {
		return err
	}
	details := &tokenTransferDetails{
		emitterChain: v.EmitterChain,
		emitterAddr:  emitterAddr,
		targetChain:  v.TargetChain,
		tokenChain:   tokenTransfer.TokenChain,
		tokenAddress: tokenAddress,
		amount:       &tokenTransfer.Amount,
		notionalUSD:  notionalUSD,
		timestamp:    &v.Timestamp,
	}
	s.tokenTransferC <- details
	return nil
}

func (s *Repository) getToken(ctx context.Context, tokenAddress string, tokenChain vaa.ChainID) (*TokenUpdate, error) {
	filter := bson.D{{Key: "_id", Value: getTokenId(tokenAddress, tokenChain)}}
	result := s.collections.tokens.FindOne(ctx, filter)
	if err := result.Err(); err != nil {
		return nil, err
	}
	var doc TokenUpdate
	if err := result.Decode(&doc); err != nil {
		return nil, err
	}

	return &doc, nil
}

func getTokenId(address string, tokenChain vaa.ChainID) string {
	return fmt.Sprintf("%v:%v", address, tokenChain)
}

func (s *Repository) upsertToken(ctx context.Context, v *vaa.VAA, attestToken *AttestToken, now *time.Time) error {
	tokenAddress := strings.ToLower(hex.EncodeToString(attestToken.TokenAddress[:]))
	s.log.Debug("new attest token vaa", zap.String("tokenAddress", tokenAddress), zap.Uint16("tokenChain", uint16(attestToken.TokenChain)))
	id := getTokenId(tokenAddress, attestToken.TokenChain)
	nativeAddress, err := toNativeAddress(attestToken.TokenChain, attestToken.TokenAddress)
	if err != nil {
		return err
	}
	coin := utils.FetchCoinGeckoCoin(attestToken.TokenChain, attestToken.Symbol, attestToken.Name)
	tokenDoc := TokenUpdate{
		ID:            id,
		TokenAddress:  tokenAddress,
		TokenChain:    attestToken.TokenChain,
		Decimals:      attestToken.Decimals,
		NativeAddress: nativeAddress,
		UpdatedAt:     now,
	}
	if coin != nil {
		tokenDoc.Symbol = coin.Symbol
		tokenDoc.Name = coin.Name
		tokenDoc.CoinGeckoCoinId = coin.Id
	} else {
		tokenDoc.Symbol = attestToken.Symbol
		tokenDoc.Name = attestToken.Name
		tokenDoc.CoinGeckoCoinId = ""
	}
	update := bson.D{{Key: "$set", Value: tokenDoc}}
	opts := options.Update().SetUpsert(true)
	_, err = s.collections.tokens.UpdateByID(context.TODO(), id, update, opts)
	return err
}

func (s *Repository) HasVAA(ctx context.Context, emitterId *emitterId, seq uint64) (bool, error) {
	var filter interface{}
	if emitterId.isGovernanceEmitter {
		filter = bson.D{
			{Key: "emitterChain", Value: emitterId.emitterChain},
			{Key: "emitterAddr", Value: emitterId.emitterAddress.String()},
			{Key: "sequence", Value: seq},
		}
	} else {
		filter = bson.D{{Key: "_id", Value: emitterId.toVaaId(seq)}}
	}
	res := s.collections.vaas.FindOne(ctx, filter)
	err := res.Err()
	if err == nil {
		return true, nil
	}
	if err == mongo.ErrNoDocuments {
		return false, nil
	}
	return false, err
}

// TODO: bulk write
func (s *Repository) upsertVaas(ctx context.Context, vaas [][]byte) error {
	for _, serialized := range vaas {
		v, err := vaa.Unmarshal(serialized)
		if err != nil {
			return err
		}
		if err = s.upsertVaa(ctx, v, serialized); err != nil {
			return err
		}
	}
	return nil
}

func (s *Repository) nextSequence(ctx context.Context, emitterId *emitterId) (*uint64, error) {
	if emitterId.isGovernanceEmitter {
		return s.nextGovernanceSequence(ctx, emitterId.emitterChain, emitterId.emitterAddress)
	}
	return s.nextEmitterSequence(ctx, emitterId)
}

func (s *Repository) nextEmitterSequence(ctx context.Context, emitterId *emitterId) (*uint64, error) {
	findOptions := options.Find().SetAllowDiskUse(true).SetSort(bson.D{{Key: "sequence", Value: -1}}).SetLimit(1)
	filter := bson.M{
		"emitterChain": emitterId.emitterChain,
		"emitterAddr":  emitterId.emitterAddress.String(),
		"targetChain":  emitterId.targetChain,
	}
	cursor, err := s.collections.vaas.Find(ctx, filter, findOptions)
	if err != nil {
		return nil, err
	}
	return extractSequenceFromCursor(ctx, cursor)
}

func (s *Repository) nextGovernanceSequence(
	ctx context.Context,
	governanceChain vaa.ChainID,
	governanceAddr vaa.Address,
) (*uint64, error) {
	findOptions := options.Find().SetAllowDiskUse(true).SetSort(bson.D{{Key: "sequence", Value: -1}}).SetLimit(1)
	filter := bson.M{
		"emitterChain": governanceChain,
		"emitterAddr":  governanceAddr.String(),
	}
	cursor, err := s.collections.vaas.Find(ctx, filter, findOptions)
	if err != nil {
		return nil, err
	}
	return extractSequenceFromCursor(ctx, cursor)
}

func extractSequenceFromCursor(ctx context.Context, cursor *mongo.Cursor) (*uint64, error) {
	if !cursor.Next(ctx) {
		nextSequence := uint64(0)
		return &nextSequence, nil
	}
	var res bson.M
	err := cursor.Decode(&res)
	if err != nil {
		return nil, err
	}
	nextSequence := uint64(res["sequence"].(int64) + 1)
	return &nextSequence, nil
}

func (s *Repository) removeMissingIds(ctx context.Context, emitterId *emitterId, seqs []uint64) error {
	vaaIds := make([]string, len(seqs))
	for i, seq := range seqs {
		vaaIds[i] = emitterId.toVaaId(seq)
	}
	filter := bson.D{{Key: "_id", Value: bson.D{{Key: "$in", Value: vaaIds}}}}
	_, err := s.collections.missingVaas.DeleteMany(ctx, filter)
	return err
}

func (s *Repository) getTxIdByMessageId(ctx context.Context, messageId string) ([]byte, error) {
	filter := bson.D{{Key: "messageId", Value: messageId}}
	var observation ObservationUpdate
	err := s.collections.observations.FindOne(ctx, filter).Decode(&observation)
	if err != nil {
		return nil, err
	}
	return observation.TxId, nil
}

func (s *Repository) UpsertObservation(o *gossipv1.SignedObservation) error {
	vaaID := strings.Split(o.MessageId, "/")
	if len(vaaID) != 4 {
		return fmt.Errorf("invalid vaa id: %s", o.MessageId)
	}
	emitterChainIdStr, emitter, targetChainIdStr, sequenceStr := vaaID[0], vaaID[1], vaaID[2], vaaID[3]
	id := fmt.Sprintf("%s/%s/%s", o.MessageId, hex.EncodeToString(o.Addr), hex.EncodeToString(o.Hash))
	now := time.Now()
	emitterChain, err := strconv.ParseUint(emitterChainIdStr, 10, 16)
	if err != nil {
		return err
	}
	targetChain, err := strconv.ParseUint(targetChainIdStr, 10, 16)
	if err != nil {
		return err
	}
	sequence, err := strconv.ParseUint(sequenceStr, 10, 64)
	if err != nil {
		return err
	}
	addr := eth_common.BytesToAddress(o.GetAddr())
	obs := ObservationUpdate{
		EmitterChain: vaa.ChainID(emitterChain),
		Emitter:      emitter,
		TargetChain:  vaa.ChainID(targetChain),
		Sequence:     sequence,
		MessageID:    o.GetMessageId(),
		Hash:         o.GetHash(),
		TxId:         o.GetTxHash(),
		GuardianAddr: addr.String(),
		Signature:    o.GetSignature(),
		UpdatedAt:    &now,
	}

	update := bson.M{
		"$set":         obs,
		"$setOnInsert": indexedAt(now),
	}
	opts := options.Update().SetUpsert(true)
	_, err = s.collections.observations.UpdateByID(context.TODO(), id, update, opts)
	if err != nil {
		s.log.Error("Error inserting observation", zap.Error(err))
	}
	return err
}

func (s *Repository) UpsertGuardianSet(gs *common.GuardianSet) error {
	addresses := make([]string, len(gs.Keys))
	for i, key := range gs.Keys {
		addresses[i] = key.Hex()
	}
	doc := &GuardianSetDoc{
		Addresses: addresses,
		Index:     gs.Index,
	}
	filter := bson.D{{Key: "index", Value: doc.Index}}
	update := bson.D{{Key: "$set", Value: doc}}
	opts := options.Update().SetUpsert(true)
	_, err := s.collections.guardianSets.UpdateOne(context.Background(), filter, update, opts)
	return err
}

func (s *Repository) UpsertHeartbeat(hb *gossipv1.Heartbeat) error {
	id := hb.GuardianAddr
	now := time.Now()
	update := bson.D{{Key: "$set", Value: hb}, {Key: "$set", Value: bson.D{{Key: "updatedAt", Value: now}}}, {Key: "$setOnInsert", Value: bson.D{{Key: "indexedAt", Value: now}}}}
	opts := options.Update().SetUpsert(true)
	_, err := s.collections.heartbeats.UpdateByID(context.TODO(), id, update, opts)
	return err
}

func (s *Repository) updateVAACount(chainID vaa.ChainID) {
	update := bson.D{{Key: "$inc", Value: bson.D{{Key: "count", Value: uint64(1)}}}}
	opts := options.Update().SetUpsert(true)
	_, _ = s.collections.vaaCounts.UpdateByID(context.TODO(), chainID, update, opts)
}

func (s *Repository) isNewRecord(result *mongo.UpdateResult) bool {
	return result.MatchedCount == 0 && result.ModifiedCount == 0 && result.UpsertedCount == 1
}

// GetMongoStatus get mongo server status
func (r *Repository) GetMongoStatus(ctx context.Context) (*MongoStatus, error) {
	command := bson.D{{Key: "serverStatus", Value: 1}}
	result := r.db.RunCommand(ctx, command)
	if result.Err() != nil {
		return nil, result.Err()
	}

	var mongoStatus MongoStatus
	err := result.Decode(&mongoStatus)
	if err != nil {
		return nil, err
	}
	return &mongoStatus, nil
}

func (r *Repository) FindOldestMissingIds(ctx context.Context, emitterId *emitterId, size int64) ([]uint64, error) {
	idPrefix := emitterId.toString()
	regex := primitive.Regex{
		Pattern: fmt.Sprintf("^%s.*", idPrefix),
		Options: "i",
	}
	filter := bson.D{{Key: "_id", Value: bson.D{{Key: "$regex", Value: regex}}}}
	opts := options.Find().SetAllowDiskUse(true).SetSort(bson.D{{Key: "indexedAt", Value: 1}}).SetLimit(size)
	cursor, err := r.collections.missingVaas.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	var seqs []uint64
	for cursor.Next(ctx) {
		var res bson.M
		if err = cursor.Decode(&res); err != nil {
			return nil, err
		}
		id := res["_id"].(string)
		index := strings.LastIndex(id, "/")
		if index == -1 {
			return nil, fmt.Errorf("invalid vaa id: %v", id)
		}
		seq, err := strconv.ParseUint(id[index+1:], 10, 64)
		if err != nil {
			return nil, err
		}
		seqs = append(seqs, seq)
	}
	return seqs, nil
}

func toDoc(v interface{}) (*bson.D, error) {
	var doc *bson.D
	data, err := bson.Marshal(v)
	if err != nil {
		return nil, err
	}

	if err = bson.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	return doc, err
}
