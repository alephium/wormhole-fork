package statistics

import (
	"context"

	"go.uber.org/zap"
)

// TODO: remove this
type Service struct {
	repo   *Repository
	logger *zap.Logger
}

func NewService(r *Repository, logger *zap.Logger) *Service {
	return &Service{repo: r, logger: logger.With(zap.String("module", "StatisticService"))}
}

func (s *Service) TotalMessages(ctx context.Context) (*TotalMessages, error) {
	return s.repo.TotalMessages(ctx)
}

func (s *Service) TotalNotionalTransferred(ctx context.Context) (*TotalNotionalTransferred, error) {
	return s.repo.TotalNotionalTransferred(ctx)
}

func (s *Service) TotalNotionalTransferredTo(ctx context.Context) (*TotalNotionalTransferredTo, error) {
	return s.repo.TotalNotionalTransferredTo(ctx)
}

func (s *Service) TVL(ctx context.Context) (*TVL, error) {
	return s.repo.TVL(ctx)
}
