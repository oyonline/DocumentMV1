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

type FlowRepo struct {
	db *sqlx.DB
}

func NewFlowRepo(db *sqlx.DB) *FlowRepo {
	return &FlowRepo{db: db}
}

// CreateTx inserts a new workflow node within the given transaction.
func (r *FlowRepo) CreateTx(ctx context.Context, tx *sqlx.Tx, node *domain.WorkflowNode) error {
	query := tx.Rebind(`INSERT INTO workflow_nodes
		(id, document_id, name, exec_form, description, preconditions, outputs,
		 duration_min, duration_max, duration_unit, raci_json, subtasks_json, diagram_json,
		 created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	node.ID = uuid.New()
	now := time.Now()
	node.CreatedAt = now
	node.UpdatedAt = now
	_, err := tx.ExecContext(ctx, query,
		node.ID, node.DocumentID, node.Name, node.ExecForm,
		node.Description, node.Preconditions, node.Outputs,
		node.DurationMin, node.DurationMax, node.DurationUnit,
		node.RaciJSON, node.SubtasksJSON, node.DiagramRaw,
		node.CreatedAt, node.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("creating workflow node: %w", err)
	}
	return nil
}

// UpdateTx updates an existing workflow node within the given transaction.
func (r *FlowRepo) UpdateTx(ctx context.Context, tx *sqlx.Tx, node *domain.WorkflowNode) error {
	query := tx.Rebind(`UPDATE workflow_nodes SET
		name = ?, exec_form = ?, description = ?, preconditions = ?, outputs = ?,
		duration_min = ?, duration_max = ?, duration_unit = ?,
		raci_json = ?, subtasks_json = ?, diagram_json = ?, updated_at = ?
		WHERE id = ?`)
	node.UpdatedAt = time.Now()
	_, err := tx.ExecContext(ctx, query,
		node.Name, node.ExecForm, node.Description, node.Preconditions, node.Outputs,
		node.DurationMin, node.DurationMax, node.DurationUnit,
		node.RaciJSON, node.SubtasksJSON, node.DiagramRaw, node.UpdatedAt,
		node.ID,
	)
	if err != nil {
		return fmt.Errorf("updating workflow node: %w", err)
	}
	return nil
}

// GetByID returns a single workflow node.
func (r *FlowRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.WorkflowNode, error) {
	var node domain.WorkflowNode
	err := r.db.GetContext(ctx, &node, r.db.Rebind(`SELECT * FROM workflow_nodes WHERE id = ?`), id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("getting workflow node: %w", err)
	}
	node.HydrateJSON()
	return &node, nil
}

// ListByDocument returns all workflow nodes for a document, ordered by creation time.
func (r *FlowRepo) ListByDocument(ctx context.Context, docID uuid.UUID) ([]domain.WorkflowNode, error) {
	query := r.db.Rebind(`SELECT * FROM workflow_nodes WHERE document_id = ? ORDER BY created_at ASC`)
	nodes := make([]domain.WorkflowNode, 0)
	if err := r.db.SelectContext(ctx, &nodes, query, docID); err != nil {
		return nil, fmt.Errorf("listing workflow nodes: %w", err)
	}
	for i := range nodes {
		nodes[i].HydrateJSON()
	}
	return nodes, nil
}

// Delete removes a workflow node by ID.
func (r *FlowRepo) Delete(ctx context.Context, id uuid.UUID) error {
	query := r.db.Rebind(`DELETE FROM workflow_nodes WHERE id = ?`)
	_, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("deleting workflow node: %w", err)
	}
	return nil
}
