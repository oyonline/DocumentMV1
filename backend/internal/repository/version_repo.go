package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

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

// CreateTx inserts a new document version within the given transaction.
func (r *VersionRepo) CreateTx(ctx context.Context, tx *sqlx.Tx, v *domain.DocumentVersion) error {
	query := `INSERT INTO document_versions (id, document_id, content, created_by, created_at)
	           VALUES ($1, $2, $3, $4, NOW()) RETURNING created_at`
	v.ID = uuid.New()
	err := tx.QueryRowxContext(ctx, query, v.ID, v.DocumentID, v.Content, v.CreatedBy).Scan(&v.CreatedAt)
	if err != nil {
		return fmt.Errorf("creating version: %w", err)
	}
	return nil
}

// ListByDocument returns all versions of a document, newest first.
func (r *VersionRepo) ListByDocument(ctx context.Context, docID uuid.UUID) ([]domain.DocumentVersion, error) {
	query := `SELECT * FROM document_versions WHERE document_id = $1 ORDER BY created_at DESC`
	var versions []domain.DocumentVersion
	if err := r.db.SelectContext(ctx, &versions, query, docID); err != nil {
		return nil, fmt.Errorf("listing versions: %w", err)
	}
	return versions, nil
}

// GetByID returns a single version.
func (r *VersionRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.DocumentVersion, error) {
	var v domain.DocumentVersion
	err := r.db.GetContext(ctx, &v, `SELECT * FROM document_versions WHERE id = $1`, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("getting version: %w", err)
	}
	return &v, nil
}

// GetLatestByDocument returns the latest version of a document.
func (r *VersionRepo) GetLatestByDocument(ctx context.Context, docID uuid.UUID) (*domain.DocumentVersion, error) {
	var v domain.DocumentVersion
	query := `SELECT * FROM document_versions WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1`
	err := r.db.GetContext(ctx, &v, query, docID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("getting latest version: %w", err)
	}
	return &v, nil
}
