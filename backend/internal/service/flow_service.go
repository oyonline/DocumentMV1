package service

import (
	"context"
	"encoding/json"

	"docmv/internal/domain"
	"docmv/internal/repository"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type FlowService struct {
	db       *sqlx.DB
	flowRepo *repository.FlowRepo
	docRepo  *repository.DocumentRepo
}

func NewFlowService(db *sqlx.DB, flowRepo *repository.FlowRepo, docRepo *repository.DocumentRepo) *FlowService {
	return &FlowService{db: db, flowRepo: flowRepo, docRepo: docRepo}
}

// NodeInput holds parameters for creating or updating a workflow node.
type NodeInput struct {
	Name          string              `json:"name"`
	ExecForm      domain.ExecForm     `json:"exec_form"`
	Description   string              `json:"description"`
	Preconditions string              `json:"preconditions"`
	Outputs       string              `json:"outputs"`
	DurationMin   *float64            `json:"duration_min"`
	DurationMax   *float64            `json:"duration_max"`
	DurationUnit  domain.DurationUnit `json:"duration_unit"`
	Raci          *domain.RACI        `json:"raci"`
	Subtasks      []string            `json:"subtasks"`
	DiagramJSON   *domain.DiagramJSON `json:"diagram_json"`
}

// validateNodeInput performs field-level validation and returns a ValidationError if any fields are invalid.
func validateNodeInput(in *NodeInput) error {
	fields := make(map[string]string)

	if in.Name == "" {
		fields["name"] = "required"
	}
	if in.ExecForm == "" {
		fields["exec_form"] = "required"
	} else if !in.ExecForm.Valid() {
		fields["exec_form"] = "invalid_enum"
	}

	if in.DurationUnit != "" && !in.DurationUnit.Valid() {
		fields["duration_unit"] = "invalid_enum"
	}

	if in.DurationMin != nil && in.DurationMax != nil {
		if *in.DurationMin < 0 {
			fields["duration_min"] = "must_be_non_negative"
		}
		if *in.DurationMax < 0 {
			fields["duration_max"] = "must_be_non_negative"
		}
		if *in.DurationMin > *in.DurationMax {
			fields["duration"] = "min_gt_max"
		}
	}

	if len(fields) > 0 {
		return domain.NewValidationError(fields)
	}
	return nil
}

// normalizeInput fills defaults for optional fields.
func normalizeInput(in *NodeInput) {
	if in.Raci == nil {
		in.Raci = &domain.RACI{}
	}
	in.Raci.Normalize()

	if in.Subtasks == nil {
		in.Subtasks = []string{}
	}

	if in.DiagramJSON == nil {
		in.DiagramJSON = &domain.DiagramJSON{}
	}
	in.DiagramJSON.Normalize()

	if in.DurationUnit == "" {
		in.DurationUnit = domain.DurationUnitDay
	}
}

// toNode converts validated input to a WorkflowNode, serialising JSON fields.
func toNode(in *NodeInput) *domain.WorkflowNode {
	raciBytes, _ := json.Marshal(in.Raci)
	subtasksBytes, _ := json.Marshal(in.Subtasks)
	diagramBytes, _ := json.Marshal(in.DiagramJSON)

	return &domain.WorkflowNode{
		Name:          in.Name,
		ExecForm:      in.ExecForm,
		Description:   in.Description,
		Preconditions: in.Preconditions,
		Outputs:       in.Outputs,
		DurationMin:   in.DurationMin,
		DurationMax:   in.DurationMax,
		DurationUnit:  in.DurationUnit,
		RaciJSON:      string(raciBytes),
		SubtasksJSON:  string(subtasksBytes),
		DiagramRaw:    string(diagramBytes),
		Raci:          *in.Raci,
		Subtasks:      in.Subtasks,
		DiagramJSON:   *in.DiagramJSON,
	}
}

// CreateNode creates a new workflow node associated with a document.
func (s *FlowService) CreateNode(ctx context.Context, userID, docID uuid.UUID, in NodeInput) (*domain.WorkflowNode, error) {
	// Verify document edit access
	ok, err := s.docRepo.HasEditAccess(ctx, docID, userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domain.ErrForbidden
	}

	normalizeInput(&in)
	if err := validateNodeInput(&in); err != nil {
		return nil, err
	}

	tx, txErr := s.db.BeginTxx(ctx, nil)
	if txErr != nil {
		return nil, txErr
	}
	defer tx.Rollback() //nolint:errcheck

	node := toNode(&in)
	node.DocumentID = docID

	if err := s.flowRepo.CreateTx(ctx, tx, node); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return node, nil
}

// UpdateNode updates an existing workflow node.
func (s *FlowService) UpdateNode(ctx context.Context, userID, nodeID uuid.UUID, in NodeInput) (*domain.WorkflowNode, error) {
	existing, err := s.flowRepo.GetByID(ctx, nodeID)
	if err != nil {
		return nil, err
	}

	// Verify document edit access
	ok, err := s.docRepo.HasEditAccess(ctx, existing.DocumentID, userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domain.ErrForbidden
	}

	normalizeInput(&in)
	if err := validateNodeInput(&in); err != nil {
		return nil, err
	}

	tx, txErr := s.db.BeginTxx(ctx, nil)
	if txErr != nil {
		return nil, txErr
	}
	defer tx.Rollback() //nolint:errcheck

	node := toNode(&in)
	node.ID = existing.ID
	node.DocumentID = existing.DocumentID
	node.CreatedAt = existing.CreatedAt

	if err := s.flowRepo.UpdateTx(ctx, tx, node); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return node, nil
}

// GetNode returns a single workflow node with access check.
func (s *FlowService) GetNode(ctx context.Context, userID, nodeID uuid.UUID) (*domain.WorkflowNode, error) {
	node, err := s.flowRepo.GetByID(ctx, nodeID)
	if err != nil {
		return nil, err
	}

	ok, err := s.docRepo.HasReadAccess(ctx, node.DocumentID, userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domain.ErrForbidden
	}

	return node, nil
}

// ListNodes returns all workflow nodes for a document.
func (s *FlowService) ListNodes(ctx context.Context, userID, docID uuid.UUID) ([]domain.WorkflowNode, error) {
	ok, err := s.docRepo.HasReadAccess(ctx, docID, userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domain.ErrForbidden
	}

	return s.flowRepo.ListByDocument(ctx, docID)
}
