package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"docmv/internal/domain"
	"docmv/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	userRepo  *repository.UserRepo
	jwtSecret []byte
}

func NewAuthService(userRepo *repository.UserRepo, jwtSecret string) *AuthService {
	return &AuthService{
		userRepo:  userRepo,
		jwtSecret: []byte(jwtSecret),
	}
}

type AuthResult struct {
	Token string       `json:"token"`
	User  *domain.User `json:"user"`
}

// Login authenticates a user and returns a JWT (with role claim).
func (s *AuthService) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	if email == "" || password == "" {
		return nil, fmt.Errorf("%w: email and password required", domain.ErrInvalidInput)
	}

	user, err := s.userRepo.GetByEmail(ctx, email)
	if errors.Is(err, domain.ErrNotFound) {
		return nil, fmt.Errorf("%w: invalid credentials", domain.ErrUnauthorized)
	}
	if err != nil {
		return nil, fmt.Errorf("finding user: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("%w: invalid credentials", domain.ErrUnauthorized)
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResult{Token: token, User: user}, nil
}

// SeedAdmin ensures the default admin account exists on startup.
// If the email already exists, it is a no-op.
func (s *AuthService) SeedAdmin(ctx context.Context, email, password string) error {
	if email == "" || password == "" {
		return fmt.Errorf("ADMIN_EMAIL and ADMIN_PASSWORD must be set")
	}

	existing, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return fmt.Errorf("checking admin user: %w", err)
	}
	if existing != nil {
		log.Printf("[seed] admin account %s already exists, skipping", email)
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hashing admin password: %w", err)
	}

	admin := &domain.User{
		Email:        email,
		PasswordHash: string(hash),
		Role:         domain.RoleAdmin,
	}
	if err := s.userRepo.Create(ctx, admin); err != nil {
		return fmt.Errorf("creating admin user: %w", err)
	}
	log.Printf("[seed] admin account %s created successfully", email)
	return nil
}

// ---------- Admin operations ----------

// CreateUser creates a new user account (admin-only).
func (s *AuthService) CreateUser(ctx context.Context, email, password, role string) (*domain.User, error) {
	if email == "" || password == "" {
		return nil, fmt.Errorf("%w: email and password required", domain.ErrInvalidInput)
	}
	if len(password) < 6 {
		return nil, fmt.Errorf("%w: password must be at least 6 characters", domain.ErrInvalidInput)
	}

	// Validate role
	userRole := domain.RoleUser
	if role != "" {
		switch domain.Role(role) {
		case domain.RoleAdmin, domain.RoleUser:
			userRole = domain.Role(role)
		default:
			return nil, fmt.Errorf("%w: role must be ADMIN or USER", domain.ErrInvalidInput)
		}
	}

	// Check if email already taken
	existing, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return nil, fmt.Errorf("checking existing user: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("%w: email already registered", domain.ErrAlreadyExists)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	user := &domain.User{
		Email:        email,
		PasswordHash: string(hash),
		Role:         userRole,
	}
	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}

	return user, nil
}

// ListUsers returns all users (admin-only).
func (s *AuthService) ListUsers(ctx context.Context) ([]domain.User, error) {
	return s.userRepo.List(ctx)
}

// ResetPassword changes a user's password (admin-only).
func (s *AuthService) ResetPassword(ctx context.Context, userID uuid.UUID, newPassword string) error {
	if newPassword == "" || len(newPassword) < 6 {
		return fmt.Errorf("%w: password must be at least 6 characters", domain.ErrInvalidInput)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hashing password: %w", err)
	}

	return s.userRepo.UpdatePassword(ctx, userID, string(hash))
}

// ---------- Internal ----------

func (s *AuthService) generateToken(user *domain.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":   user.ID.String(),
		"email": user.Email,
		"role":  string(user.Role),
		"exp":   time.Now().Add(72 * time.Hour).Unix(),
		"iat":   time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("signing token: %w", err)
	}
	return signed, nil
}
