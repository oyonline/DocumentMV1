package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ---------- Enums ----------

type ExecForm string

const (
	ExecFormManual    ExecForm = "MANUAL"
	ExecFormAutomatic ExecForm = "AUTOMATIC"
	ExecFormDecision  ExecForm = "DECISION"
	ExecFormReview    ExecForm = "REVIEW"
)

func (e ExecForm) Valid() bool {
	switch e {
	case ExecFormManual, ExecFormAutomatic, ExecFormDecision, ExecFormReview:
		return true
	}
	return false
}

type DurationUnit string

const (
	DurationUnitMinute DurationUnit = "MINUTE"
	DurationUnitHour   DurationUnit = "HOUR"
	DurationUnitDay    DurationUnit = "DAY"
	DurationUnitWeek   DurationUnit = "WEEK"
)

func (d DurationUnit) Valid() bool {
	switch d {
	case DurationUnitMinute, DurationUnitHour, DurationUnitDay, DurationUnitWeek:
		return true
	}
	return false
}

// ---------- RACI ----------

type RACI struct {
	R []string `json:"R"`
	A []string `json:"A"`
	S []string `json:"S"`
	C []string `json:"C"`
	I []string `json:"I"`
}

// Normalize ensures all five keys exist with non-nil slices.
func (r *RACI) Normalize() {
	if r.R == nil {
		r.R = []string{}
	}
	if r.A == nil {
		r.A = []string{}
	}
	if r.S == nil {
		r.S = []string{}
	}
	if r.C == nil {
		r.C = []string{}
	}
	if r.I == nil {
		r.I = []string{}
	}
}

// ---------- DiagramJSON ----------

type DiagramJSON struct {
	Nodes []json.RawMessage `json:"nodes"`
	Edges []json.RawMessage `json:"edges"`
}

// Normalize ensures nodes/edges are non-nil slices.
func (d *DiagramJSON) Normalize() {
	if d.Nodes == nil {
		d.Nodes = []json.RawMessage{}
	}
	if d.Edges == nil {
		d.Edges = []json.RawMessage{}
	}
}

// ---------- Entity ----------

type WorkflowNode struct {
	ID            uuid.UUID    `db:"id"             json:"id"`
	DocumentID    uuid.UUID    `db:"document_id"    json:"document_id"`
	Name          string       `db:"name"           json:"name"`
	ExecForm      ExecForm     `db:"exec_form"      json:"exec_form"`
	Description   string       `db:"description"    json:"description"`
	Preconditions string       `db:"preconditions"  json:"preconditions"`
	Outputs       string       `db:"outputs"        json:"outputs"`
	DurationMin   *float64     `db:"duration_min"   json:"duration_min"`
	DurationMax   *float64     `db:"duration_max"   json:"duration_max"`
	DurationUnit  DurationUnit `db:"duration_unit"  json:"duration_unit"`
	RaciJSON      string       `db:"raci_json"      json:"-"`
	SubtasksJSON  string       `db:"subtasks_json"  json:"-"`
	DiagramRaw    string       `db:"diagram_json"   json:"-"`
	CreatedAt     time.Time    `db:"created_at"     json:"created_at"`
	UpdatedAt     time.Time    `db:"updated_at"     json:"updated_at"`

	// Computed fields (populated after DB read)
	Raci        RACI        `db:"-" json:"raci"`
	Subtasks    []string    `db:"-" json:"subtasks"`
	DiagramJSON DiagramJSON `db:"-" json:"diagram_json"`
}

// HydrateJSON parses the raw JSON columns into typed fields.
func (n *WorkflowNode) HydrateJSON() {
	_ = json.Unmarshal([]byte(n.RaciJSON), &n.Raci)
	n.Raci.Normalize()
	_ = json.Unmarshal([]byte(n.SubtasksJSON), &n.Subtasks)
	if n.Subtasks == nil {
		n.Subtasks = []string{}
	}
	_ = json.Unmarshal([]byte(n.DiagramRaw), &n.DiagramJSON)
	n.DiagramJSON.Normalize()
}
