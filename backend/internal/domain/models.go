package domain

import (
	"time"

	"github.com/google/uuid"
)

// ---------- Enums ----------

type FlowStatus string

const (
	FlowStatusDraft    FlowStatus = "DRAFT"
	FlowStatusInReview FlowStatus = "IN_REVIEW"
	FlowStatusEffective FlowStatus = "EFFECTIVE"
)

type ExecForm string

const (
	ExecFormSystemApproval  ExecForm = "SYSTEM_APPROVAL"
	ExecFormOfflineMeeting  ExecForm = "OFFLINE_MEETING"
	ExecFormEmailConfirm    ExecForm = "EMAIL_CONFIRM"
	ExecFormDocReview       ExecForm = "DOC_REVIEW"
	ExecFormSystemOperation ExecForm = "SYSTEM_OPERATION"
)

type ShareRole string

const (
	ShareRoleView ShareRole = "VIEW"
	ShareRoleEdit ShareRole = "EDIT"
)

type Role string

const (
	RoleAdmin Role = "ADMIN"
	RoleUser  Role = "USER"
)

// ---------- Entities ----------

type User struct {
	ID           uuid.UUID `db:"id" json:"id"`
	Email        string    `db:"email" json:"email"`
	PasswordHash string    `db:"password_hash" json:"-"`
	Role         Role      `db:"role" json:"role"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type Flow struct {
	ID              uuid.UUID  `db:"id" json:"id"`
	FlowNo          string     `db:"flow_no" json:"flow_no"`
	Title           string     `db:"title" json:"title"`
	OwnerID         uuid.UUID  `db:"owner_id" json:"owner_id"`
	OwnerDeptID     string     `db:"owner_dept_id" json:"owner_dept_id"`
	Overview        string     `db:"overview" json:"overview"`
	Status          FlowStatus `db:"status" json:"status"`
	DiagramJSON     string     `db:"diagram_json" json:"diagram_json"`
	LatestVersionID *uuid.UUID `db:"latest_version_id" json:"latest_version_id,omitempty"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
}

type FlowNode struct {
	ID           uuid.UUID `db:"id" json:"id"`
	FlowID       uuid.UUID `db:"flow_id" json:"flow_id"`
	NodeNo       string    `db:"node_no" json:"node_no"`
	Name         string    `db:"name" json:"name"`
	Intro        string    `db:"intro" json:"intro"`
	RACIJSON     string    `db:"raci_json" json:"raci_json"`
	ExecForm     string    `db:"exec_form" json:"exec_form"`
	DurationMin  *float64  `db:"duration_min" json:"duration_min"`
	DurationMax  *float64  `db:"duration_max" json:"duration_max"`
	DurationUnit string    `db:"duration_unit" json:"duration_unit"`
	PrereqText   string    `db:"prereq_text" json:"prereq_text"`
	OutputsText  string    `db:"outputs_text" json:"outputs_text"`
	SubtasksJSON string    `db:"subtasks_json" json:"subtasks_json"`
	SortOrder    int       `db:"sort_order" json:"sort_order"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

type FlowVersion struct {
	ID           uuid.UUID `db:"id" json:"id"`
	FlowID       uuid.UUID `db:"flow_id" json:"flow_id"`
	SnapshotJSON string    `db:"snapshot_json" json:"snapshot_json"`
	CreatedBy    uuid.UUID `db:"created_by" json:"created_by"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type FlowShare struct {
	ID        uuid.UUID `db:"id" json:"id"`
	FlowID    uuid.UUID `db:"flow_id" json:"flow_id"`
	UserID    uuid.UUID `db:"user_id" json:"user_id"`
	Role      ShareRole `db:"role" json:"role"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}
