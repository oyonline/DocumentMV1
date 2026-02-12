package service

import (
	"context"
	"errors"
	"fmt"

	"docmv/internal/domain"
	"docmv/internal/repository"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type DocumentService struct {
	db          *sqlx.DB
	docRepo     *repository.DocumentRepo
	versionRepo *repository.VersionRepo
}

func NewDocumentService(db *sqlx.DB, docRepo *repository.DocumentRepo, versionRepo *repository.VersionRepo) *DocumentService {
	return &DocumentService{db: db, docRepo: docRepo, versionRepo: versionRepo}
}

// CreateDocInput holds parameters for creating a new document.
type CreateDocInput struct {
	Title      string
	Content    string
	Visibility domain.Visibility
}

// Create creates a document with its first version in a single transaction.
func (s *DocumentService) Create(ctx context.Context, userID uuid.UUID, in CreateDocInput) (*domain.Document, error) {
	if in.Title == "" {
		return nil, fmt.Errorf("%w: title is required", domain.ErrInvalidInput)
	}
	if !in.Visibility.Valid() {
		in.Visibility = domain.VisibilityPrivate
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck

	doc := &domain.Document{
		OwnerID:    userID,
		Title:      in.Title,
		Visibility: in.Visibility,
	}
	if err := s.docRepo.CreateTx(ctx, tx, doc); err != nil {
		return nil, err
	}

	version := &domain.DocumentVersion{
		DocumentID: doc.ID,
		Content:    in.Content,
		CreatedBy:  userID,
	}
	if err := s.versionRepo.CreateTx(ctx, tx, version); err != nil {
		return nil, err
	}

	if err := s.docRepo.SetLatestVersionTx(ctx, tx, doc.ID, version.ID); err != nil {
		return nil, err
	}
	doc.LatestVersionID = &version.ID

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}
	return doc, nil
}

// DocumentDetail combines a document with its latest content.
type DocumentDetail struct {
	Document domain.Document `json:"document"`
	Content  string          `json:"content"`
}

// GetDetail returns a document with its latest version content.
// Enforces read access.
func (s *DocumentService) GetDetail(ctx context.Context, userID, docID uuid.UUID) (*DocumentDetail, error) {
	ok, err := s.docRepo.HasReadAccess(ctx, docID, userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domain.ErrForbidden
	}

	doc, err := s.docRepo.GetByID(ctx, docID)
	if err != nil {
		return nil, err
	}

	var content string
	if doc.LatestVersionID != nil {
		v, err := s.versionRepo.GetByID(ctx, *doc.LatestVersionID)
		if err != nil && !errors.Is(err, domain.ErrNotFound) {
			return nil, err
		}
		if v != nil {
			content = v.Content
		}
	}

	return &DocumentDetail{Document: *doc, Content: content}, nil
}

// UpdateDocInput holds parameters for updating a document.
type UpdateDocInput struct {
	Title      string
	Content    string
	Visibility domain.Visibility
}

// Update edits document metadata and creates a new version (single transaction).
// Enforces edit access.
func (s *DocumentService) Update(ctx context.Context, userID, docID uuid.UUID, in UpdateDocInput) (*domain.Document, error) {
	if in.Title == "" {
		return nil, fmt.Errorf("%w: title is required", domain.ErrInvalidInput)
	}

	ok, err := s.docRepo.HasEditAccess(ctx, docID, userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domain.ErrForbidden
	}

	doc, err := s.docRepo.GetByID(ctx, docID)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck

	doc.Title = in.Title
	if in.Visibility.Valid() {
		doc.Visibility = in.Visibility
	}
	if err := s.docRepo.UpdateTx(ctx, tx, doc); err != nil {
		return nil, err
	}

	version := &domain.DocumentVersion{
		DocumentID: doc.ID,
		Content:    in.Content,
		CreatedBy:  userID,
	}
	if err := s.versionRepo.CreateTx(ctx, tx, version); err != nil {
		return nil, err
	}

	if err := s.docRepo.SetLatestVersionTx(ctx, tx, doc.ID, version.ID); err != nil {
		return nil, err
	}
	doc.LatestVersionID = &version.ID

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}
	return doc, nil
}

// List returns all documents visible to the user.
func (s *DocumentService) List(ctx context.Context, userID uuid.UUID) ([]domain.Document, error) {
	return s.docRepo.ListForUser(ctx, userID)
}

// ListVersions returns version history for a document (with read access check).
func (s *DocumentService) ListVersions(ctx context.Context, userID, docID uuid.UUID) ([]domain.DocumentVersion, error) {
	ok, err := s.docRepo.HasReadAccess(ctx, docID, userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, domain.ErrForbidden
	}
	return s.versionRepo.ListByDocument(ctx, docID)
}
