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

type FlowVersionRepo struct {
	db *sqlx.DB
}

func NewFlowVersionRepo(db *sqlx.DB) *FlowVersionRepo {
	return &FlowVersionRepo{db: db}
}

// CreateTx inserts a new flow version within the given transaction.
func (r *FlowVersionRepo) CreateTx(ctx context.Context, tx *sqlx.Tx, v *domain.FlowVersion) error {
	query := tx.Rebind(`INSERT INTO flow_versions (id, flow_id, snapshot_json, created_by, created_at)
	           VALUES (?, ?, ?, ?, ?)`)
	v.ID = uuid.New()
	v.CreatedAt = time.Now()
	_, err := tx.ExecContext(ctx, query, v.ID, v.FlowID, v.SnapshotJSON, v.CreatedBy, v.CreatedAt)
	if err != nil {
		return fmt.Errorf("creating flow version: %w", err)
	}
	return nil
}

// ListByFlow returns all versions for a flow (metadata only), newest first.
func (r *FlowVersionRepo) ListByFlow(ctx context.Context, flowID uuid.UUID) ([]domain.FlowVersion, error) {
	query := r.db.Rebind(`SELECT id, flow_id, created_by, created_at FROM flow_versions WHERE flow_id=? ORDER BY created_at DESC`)
	versions := make([]domain.FlowVersion, 0)
	if err := r.db.SelectContext(ctx, &versions, query, flowID); err != nil {
		return nil, fmt.Errorf("listing flow versions: %w", err)
	}
	return versions, nil
}

// GetByID returns a single version with full snapshot.
func (r *FlowVersionRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.FlowVersion, error) {
	var v domain.FlowVersion
	err := r.db.GetContext(ctx, &v, r.db.Rebind(`SELECT * FROM flow_versions WHERE id=?`), id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("getting flow version: %w", err)
	}
	return &v, nil
}
