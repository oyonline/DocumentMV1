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

type DocumentRepo struct {
	db *sqlx.DB
}

func NewDocumentRepo(db *sqlx.DB) *DocumentRepo {
	return &DocumentRepo{db: db}
}

// CreateTx inserts a new document within the given transaction.
func (r *DocumentRepo) CreateTx(ctx context.Context, tx *sqlx.Tx, doc *domain.Document) error {
	query := `INSERT INTO documents (id, owner_id, title, visibility, created_at, updated_at)
	           VALUES ($1, $2, $3, $4, NOW(), NOW())
	           RETURNING created_at, updated_at`
	doc.ID = uuid.New()
	err := tx.QueryRowxContext(ctx, query, doc.ID, doc.OwnerID, doc.Title, doc.Visibility).
		Scan(&doc.CreatedAt, &doc.UpdatedAt)
	if err != nil {
		return fmt.Errorf("creating document: %w", err)
	}
	return nil
}

// SetLatestVersionTx updates the latest_version_id and updated_at for a document.
func (r *DocumentRepo) SetLatestVersionTx(ctx context.Context, tx *sqlx.Tx, docID, versionID uuid.UUID) error {
	query := `UPDATE documents SET latest_version_id = $1, updated_at = NOW() WHERE id = $2`
	_, err := tx.ExecContext(ctx, query, versionID, docID)
	if err != nil {
		return fmt.Errorf("setting latest version: %w", err)
	}
	return nil
}

// UpdateTx updates document metadata within a transaction.
func (r *DocumentRepo) UpdateTx(ctx context.Context, tx *sqlx.Tx, doc *domain.Document) error {
	query := `UPDATE documents SET title = $1, visibility = $2, updated_at = NOW()
	           WHERE id = $3 RETURNING updated_at`
	err := tx.QueryRowxContext(ctx, query, doc.Title, doc.Visibility, doc.ID).Scan(&doc.UpdatedAt)
	if err != nil {
		return fmt.Errorf("updating document: %w", err)
	}
	return nil
}

// GetByID returns a single document.
func (r *DocumentRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Document, error) {
	var doc domain.Document
	err := r.db.GetContext(ctx, &doc, `SELECT * FROM documents WHERE id = $1`, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("getting document: %w", err)
	}
	return &doc, nil
}

// ListForUser returns documents visible to the given user:
//   - owned by user (any visibility)
//   - PUBLIC documents
//   - SHARED documents where user has a share record
func (r *DocumentRepo) ListForUser(ctx context.Context, userID uuid.UUID) ([]domain.Document, error) {
	query := `
		SELECT DISTINCT d.*
		FROM documents d
		LEFT JOIN document_shares ds ON d.id = ds.document_id AND ds.user_id = $1
		WHERE d.owner_id = $1
		   OR d.visibility = 'PUBLIC'
		   OR (d.visibility = 'SHARED' AND ds.user_id IS NOT NULL)
		ORDER BY d.updated_at DESC`
	var docs []domain.Document
	if err := r.db.SelectContext(ctx, &docs, query, userID); err != nil {
		return nil, fmt.Errorf("listing documents for user: %w", err)
	}
	return docs, nil
}

// HasReadAccess checks if user can read the document.
func (r *DocumentRepo) HasReadAccess(ctx context.Context, docID, userID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM documents d
			LEFT JOIN document_shares ds ON d.id = ds.document_id AND ds.user_id = $2
			WHERE d.id = $1
			  AND (d.owner_id = $2 OR d.visibility = 'PUBLIC'
			       OR (d.visibility = 'SHARED' AND ds.user_id IS NOT NULL))
		)`
	var ok bool
	if err := r.db.GetContext(ctx, &ok, query, docID, userID); err != nil {
		return false, fmt.Errorf("checking read access: %w", err)
	}
	return ok, nil
}

// HasEditAccess checks if user can edit the document (owner or SHARED+EDIT role).
func (r *DocumentRepo) HasEditAccess(ctx context.Context, docID, userID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1 FROM documents d
			LEFT JOIN document_shares ds ON d.id = ds.document_id AND ds.user_id = $2 AND ds.role = 'EDIT'
			WHERE d.id = $1
			  AND (d.owner_id = $2
			       OR (d.visibility = 'SHARED' AND ds.user_id IS NOT NULL))
		)`
	var ok bool
	if err := r.db.GetContext(ctx, &ok, query, docID, userID); err != nil {
		return false, fmt.Errorf("checking edit access: %w", err)
	}
	return ok, nil
}
