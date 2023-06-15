package transactions

import (
	"context"

	"github.com/alephium/wormhole-fork/explorer-backend/api/internal/pagination"
	"go.uber.org/zap"
)

type Service struct {
	repo   *Repository
	logger *zap.Logger
}

func NewService(r *Repository, logger *zap.Logger) *Service {
	return &Service{repo: r, logger: logger.With(zap.String("module", "TransactionsService"))}
}

func (s *Service) GetTransactionsBySender(ctx context.Context, sender *sender, p *pagination.Pagination) ([]*TransactionDocWithVAA, error) {
	return s.repo.GetTransactionsBySender(ctx, sender, p)
}

func (s *Service) GetTransactionNumberBySender(ctx context.Context, sender *sender) (*int64, error) {
	return s.repo.GetTransactionNumberBySender(ctx, sender)
}
