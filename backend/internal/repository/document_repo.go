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

func (r *DocumentRepo) UpdateTx(ctx context.Context, tx *sqlx.Tx, doc *domain.Document) error {
	query := tx.Rebind(`UPDATE documents SET title = ?, visibility = ?, latest_version_id = ?, updated_at = ? WHERE id = ?`)
	doc.UpdatedAt = time.Now()
	_, err := tx.ExecContext(ctx, query, doc.Title, doc.Visibility, doc.LatestVersionID, doc.UpdatedAt, doc.ID)
	if err != nil {
		return fmt.Errorf("updating document: %w", err)
	}
	return nil
}

// ListVisible returns documents visible to the given user (owner, public, or shared).
func (r *DocumentRepo) ListVisible(ctx context.Context, userID uuid.UUID) ([]domain.Document, error) {
	query := r.db.Rebind(`
		SELECT DISTINCT d.* FROM documents d
		LEFT JOIN document_shares ds ON d.id = ds.document_id AND ds.user_id = ?
		WHERE d.owner_id = ? OR d.visibility = 'PUBLIC' OR ds.id IS NOT NULL
		ORDER BY d.updated_at DESC`)
	docs := make([]domain.Document, 0)
	if err := r.db.SelectContext(ctx, &docs, query, userID, userID); err != nil {
		return nil, fmt.Errorf("listing documents: %w", err)
	}
	return docs, nil
}

// HasEditAccess checks if a user can edit a document (owner or share role=EDIT).
func (r *DocumentRepo) HasEditAccess(ctx context.Context, docID, userID uuid.UUID) (bool, error) {
	var count int
	query := r.db.Rebind(`
		SELECT COUNT(*) FROM documents d
		LEFT JOIN document_shares ds ON d.id = ds.document_id AND ds.user_id = ? AND ds.role = 'EDIT'
		WHERE d.id = ? AND (d.owner_id = ? OR ds.id IS NOT NULL)`)
	err := r.db.GetContext(ctx, &count, query, userID, docID, userID)
	if err != nil {
		return false, fmt.Errorf("checking edit access: %w", err)
	}
	return count > 0, nil
}

// HasReadAccess checks if a user can read a document (owner, public, or any share).
func (r *DocumentRepo) HasReadAccess(ctx context.Context, docID, userID uuid.UUID) (bool, error) {
	var count int
	query := r.db.Rebind(`
		SELECT COUNT(*) FROM documents d
		LEFT JOIN document_shares ds ON d.id = ds.document_id AND ds.user_id = ?
		WHERE d.id = ? AND (d.owner_id = ? OR d.visibility = 'PUBLIC' OR ds.id IS NOT NULL)`)
	err := r.db.GetContext(ctx, &count, query, userID, docID, userID)
	if err != nil {
		return false, fmt.Errorf("checking read access: %w", err)
	}
	return count > 0, nil
}
