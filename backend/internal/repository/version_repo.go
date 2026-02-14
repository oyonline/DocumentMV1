package repository

import (
	"context"
	"fmt"
	"time"

	"docmv/internal/domain"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type VersionRepo struct {
	db *sqlx.DB
}

func NewVersionRepo(db *sqlx.DB) *VersionRepo {
	return &VersionRepo{db: db}
}

func (r *VersionRepo) CreateTx(ctx context.Context, tx *sqlx.Tx, v *domain.DocumentVersion) error {
	query := tx.Rebind(`INSERT INTO document_versions (id, document_id, content, created_by, created_at)
		VALUES (?, ?, ?, ?, ?)`)
	v.ID = uuid.New()
	v.CreatedAt = time.Now()
	_, err := tx.ExecContext(ctx, query, v.ID, v.DocumentID, v.Content, v.CreatedBy, v.CreatedAt)
	if err != nil {
		return fmt.Errorf("creating version: %w", err)
	}
	return nil
}

func (r *VersionRepo) ListByDocument(ctx context.Context, docID uuid.UUID) ([]domain.DocumentVersion, error) {
	query := r.db.Rebind(`SELECT * FROM document_versions WHERE document_id = ? ORDER BY created_at DESC`)
	versions := make([]domain.DocumentVersion, 0)
	if err := r.db.SelectContext(ctx, &versions, query, docID); err != nil {
		return nil, fmt.Errorf("listing versions: %w", err)
	}
	return versions, nil
}
