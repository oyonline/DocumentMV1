package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

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
	query := tx.Rebind(`INSERT INTO documents (id, owner_id, title, visibility, created_at, updated_at)
	           VALUES (?, ?, ?, ?, ?, ?)`)
	doc.ID = uuid.New()
	now := time.Now()
	doc.CreatedAt = now
	doc.UpdatedAt = now
	_, err := tx.ExecContext(ctx, query, doc.ID, doc.OwnerID, doc.Title, doc.Visibility, doc.CreatedAt, doc.UpdatedAt)
	if err != nil {
		return fmt.Errorf("creating document: %w", err)
	}
	return nil
}

// SetLatestVersionTx updates the latest_version_id and updated_at for a document.
func (r *DocumentRepo) SetLatestVersionTx(ctx context.Context, tx *sqlx.Tx, docID, versionID uuid.UUID) error {
	query := tx.Rebind(`UPDATE documents SET latest_version_id = ?, updated_at = ? WHERE id = ?`)
	_, err := tx.ExecContext(ctx, query, versionID, time.Now(), docID)
	if err != nil {
		return fmt.Errorf("setting latest version: %w", err)
	}
	return nil
}

// UpdateTx updates document metadata within a transaction.
func (r *DocumentRepo) UpdateTx(ctx context.Context, tx *sqlx.Tx, doc *domain.Document) error {
	query := tx.Rebind(`UPDATE documents SET title = ?, visibility = ?, updated_at = ? WHERE id = ?`)
	doc.UpdatedAt = time.Now()
	_, err := tx.ExecContext(ctx, query, doc.Title, doc.Visibility, doc.UpdatedAt, doc.ID)
	if err != nil {
		return fmt.Errorf("updating document: %w", err)
	}
	return nil
}

// GetByID returns a single document.
func (r *DocumentRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Document, error) {
	var doc domain.Document
	err := r.db.GetContext(ctx, &doc, r.db.Rebind(`SELECT * FROM documents WHERE id = ?`), id)
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
	query := r.db.Rebind(`
		SELECT DISTINCT d.*
		FROM documents d
		LEFT JOIN document_shares ds ON d.id = ds.document_id AND ds.user_id = ?
		WHERE d.owner_id = ?
		   OR d.visibility = 'PUBLIC'
		   OR (d.visibility = 'SHARED' AND ds.user_id IS NOT NULL)
		ORDER BY d.updated_at DESC`)
	docs := make([]domain.Document, 0)
	if err := r.db.SelectContext(ctx, &docs, query, userID, userID); err != nil {
		return nil, fmt.Errorf("listing documents for user: %w", err)
	}
	return docs, nil
}

// HasReadAccess checks if user can read the document.
func (r *DocumentRepo) HasReadAccess(ctx context.Context, docID, userID uuid.UUID) (bool, error) {
	query := r.db.Rebind(`
		SELECT EXISTS(
			SELECT 1 FROM documents d
			LEFT JOIN document_shares ds ON d.id = ds.document_id AND ds.user_id = ?
			WHERE d.id = ?
			  AND (d.owner_id = ? OR d.visibility = 'PUBLIC'
			       OR (d.visibility = 'SHARED' AND ds.user_id IS NOT NULL))
		)`)
	var ok bool
	if err := r.db.GetContext(ctx, &ok, query, userID, docID, userID); err != nil {
		return false, fmt.Errorf("checking read access: %w", err)
	}
	return ok, nil
}

// HasEditAccess checks if user can edit the document (owner or SHARED+EDIT role).
func (r *DocumentRepo) HasEditAccess(ctx context.Context, docID, userID uuid.UUID) (bool, error) {
	query := r.db.Rebind(`
		SELECT EXISTS(
			SELECT 1 FROM documents d
			LEFT JOIN document_shares ds ON d.id = ds.document_id AND ds.user_id = ? AND ds.role = 'EDIT'
			WHERE d.id = ?
			  AND (d.owner_id = ?
			       OR (d.visibility = 'SHARED' AND ds.user_id IS NOT NULL))
		)`)
	var ok bool
	if err := r.db.GetContext(ctx, &ok, query, userID, docID, userID); err != nil {
		return false, fmt.Errorf("checking edit access: %w", err)
	}
	return ok, nil
}
