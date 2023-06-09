package guardian

import (
	"context"

	"go.uber.org/zap"
)

type Service struct {
	repo   *Repository
	logger *zap.Logger
}

func NewService(dao *Repository, logger *zap.Logger) *Service {
	return &Service{repo: dao, logger: logger.With(zap.String("module", "GuardianSetService"))}
}

func (s *Service) GetCurrentGuardianSet(ctx context.Context) (*GuardianSetDoc, error) {
	return s.repo.GetCurrentGuardianSet(ctx)
}
