package domain

import (
	"time"

	"github.com/google/uuid"
)

// ---------- Enums ----------

type Visibility string

const (
	VisibilityPrivate Visibility = "PRIVATE"
	VisibilityPublic  Visibility = "PUBLIC"
	VisibilityShared  Visibility = "SHARED"
)

func (v Visibility) Valid() bool {
	switch v {
	case VisibilityPrivate, VisibilityPublic, VisibilityShared:
		return true
	}
	return false
}

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

type Document struct {
	ID              uuid.UUID  `db:"id" json:"id"`
	OwnerID         uuid.UUID  `db:"owner_id" json:"owner_id"`
	Title           string     `db:"title" json:"title"`
	Visibility      Visibility `db:"visibility" json:"visibility"`
	LatestVersionID *uuid.UUID `db:"latest_version_id" json:"latest_version_id,omitempty"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
}

type DocumentVersion struct {
	ID         uuid.UUID `db:"id" json:"id"`
	DocumentID uuid.UUID `db:"document_id" json:"document_id"`
	Content    string    `db:"content" json:"content"`
	CreatedBy  uuid.UUID `db:"created_by" json:"created_by"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

type DocumentShare struct {
	ID         uuid.UUID `db:"id" json:"id"`
	DocumentID uuid.UUID `db:"document_id" json:"document_id"`
	UserID     uuid.UUID `db:"user_id" json:"user_id"`
	Role       ShareRole `db:"role" json:"role"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}
