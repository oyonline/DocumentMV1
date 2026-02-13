package repository

import (
	"context"
	"fmt"
	"time"

	"docmv/internal/domain"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type FlowNodeRepo struct {
	db *sqlx.DB
}

func NewFlowNodeRepo(db *sqlx.DB) *FlowNodeRepo {
	return &FlowNodeRepo{db: db}
}

// ListByFlow returns all nodes for a flow, ordered by sort_order.
func (r *FlowNodeRepo) ListByFlow(ctx context.Context, flowID uuid.UUID) ([]domain.FlowNode, error) {
	query := r.db.Rebind(`SELECT * FROM flow_nodes WHERE flow_id=? ORDER BY sort_order, node_no`)
	nodes := make([]domain.FlowNode, 0)
	if err := r.db.SelectContext(ctx, &nodes, query, flowID); err != nil {
		return nil, fmt.Errorf("listing flow nodes: %w", err)
	}
	return nodes, nil
}

// ReplaceAllTx deletes all existing nodes for a flow and inserts the given ones (within tx).
func (r *FlowNodeRepo) ReplaceAllTx(ctx context.Context, tx *sqlx.Tx, flowID uuid.UUID, nodes []domain.FlowNode) error {
	// Delete existing
	delQuery := tx.Rebind(`DELETE FROM flow_nodes WHERE flow_id=?`)
	if _, err := tx.ExecContext(ctx, delQuery, flowID); err != nil {
		return fmt.Errorf("deleting flow nodes: %w", err)
	}

	// Insert new
	if len(nodes) == 0 {
		return nil
	}

	insQuery := tx.Rebind(`INSERT INTO flow_nodes
		(id, flow_id, node_no, name, intro, raci_json, exec_form,
		 duration_min, duration_max, duration_unit,
		 prereq_text, outputs_text, subtasks_json, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

	now := time.Now()
	for i := range nodes {
		n := &nodes[i]
		if n.ID == uuid.Nil {
			n.ID = uuid.New()
		}
		n.FlowID = flowID
		n.CreatedAt = now
		n.UpdatedAt = now
		if n.DurationUnit == "" {
			n.DurationUnit = "DAY"
		}
		_, err := tx.ExecContext(ctx, insQuery,
			n.ID, n.FlowID, n.NodeNo, n.Name, n.Intro, n.RACIJSON, n.ExecForm,
			n.DurationMin, n.DurationMax, n.DurationUnit,
			n.PrereqText, n.OutputsText, n.SubtasksJSON, n.SortOrder, n.CreatedAt, n.UpdatedAt)
		if err != nil {
			return fmt.Errorf("inserting flow node %s: %w", n.NodeNo, err)
		}
	}
	return nil
}
