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

type UserRepo struct {
	db *sqlx.DB
}

func NewUserRepo(db *sqlx.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) Create(ctx context.Context, user *domain.User) error {
	query := r.db.Rebind(`INSERT INTO users (id, email, password_hash, role, created_at)
	           VALUES (?, ?, ?, ?, ?)`)
	user.ID = uuid.New()
	if user.Role == "" {
		user.Role = domain.RoleUser
	}
	user.CreatedAt = time.Now()
	_, err := r.db.ExecContext(ctx, query, user.ID, user.Email, user.PasswordHash, user.Role, user.CreatedAt)
	if err != nil {
		return fmt.Errorf("creating user: %w", err)
	}
	return nil
}

func (r *UserRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	err := r.db.GetContext(ctx, &user, r.db.Rebind(`SELECT * FROM users WHERE email = ?`), email)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("getting user by email: %w", err)
	}
	return &user, nil
}

func (r *UserRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	var user domain.User
	err := r.db.GetContext(ctx, &user, r.db.Rebind(`SELECT * FROM users WHERE id = ?`), id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("getting user by id: %w", err)
	}
	return &user, nil
}

// List returns all users (admin operation). Passwords are excluded by json:"-" tag.
func (r *UserRepo) List(ctx context.Context) ([]domain.User, error) {
	users := make([]domain.User, 0)
	err := r.db.SelectContext(ctx, &users, `SELECT id, email, role, created_at FROM users ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("listing users: %w", err)
	}
	return users, nil
}

// UpdatePassword changes a user's password hash.
func (r *UserRepo) UpdatePassword(ctx context.Context, userID uuid.UUID, hash string) error {
	query := r.db.Rebind(`UPDATE users SET password_hash = ? WHERE id = ?`)
	result, err := r.db.ExecContext(ctx, query, hash, userID)
	if err != nil {
		return fmt.Errorf("updating password: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return domain.ErrNotFound
	}
	return nil
}
