package service

import (
	"context"
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

type CreateDocInput struct {
	Title      string `json:"title"`
	Content    string `json:"content"`
	Visibility string `json:"visibility"`
}

type UpdateDocInput struct {
	Title      string `json:"title"`
	Content    string `json:"content"`
	Visibility string `json:"visibility"`
}

type DocumentDetail struct {
	Document domain.Document `json:"document"`
	Content  string          `json:"content"`
}

func (s *DocumentService) List(ctx context.Context, userID uuid.UUID) ([]domain.Document, error) {
	return s.docRepo.ListVisible(ctx, userID)
}

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

	detail := &DocumentDetail{Document: *doc}

	if doc.LatestVersionID != nil {
		versions, err := s.versionRepo.ListByDocument(ctx, docID)
		if err != nil {
			return nil, err
		}
		if len(versions) > 0 {
			detail.Content = versions[0].Content
		}
	}

	return detail, nil
}

func (s *DocumentService) Create(ctx context.Context, userID uuid.UUID, in CreateDocInput) (*domain.Document, error) {
	if in.Title == "" {
		return nil, fmt.Errorf("%w: title is required", domain.ErrInvalidInput)
	}

	vis := domain.Visibility(in.Visibility)
	if vis == "" {
		vis = domain.VisibilityPrivate
	}
	if !vis.Valid() {
		return nil, fmt.Errorf("%w: invalid visibility", domain.ErrInvalidInput)
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback() //nolint:errcheck

	doc := &domain.Document{
		OwnerID:    userID,
		Title:      in.Title,
		Visibility: vis,
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

	doc.LatestVersionID = &version.ID
	if err := s.docRepo.UpdateTx(ctx, tx, doc); err != nil {
		return nil, err
	}

	return doc, tx.Commit()
}

func (s *DocumentService) Update(ctx context.Context, userID, docID uuid.UUID, in UpdateDocInput) (*domain.Document, error) {
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

	tx, txErr := s.db.BeginTxx(ctx, nil)
	if txErr != nil {
		return nil, txErr
	}
	defer tx.Rollback() //nolint:errcheck

	if in.Title != "" {
		doc.Title = in.Title
	}
	if in.Visibility != "" {
		vis := domain.Visibility(in.Visibility)
		if !vis.Valid() {
			return nil, fmt.Errorf("%w: invalid visibility", domain.ErrInvalidInput)
		}
		doc.Visibility = vis
	}

	version := &domain.DocumentVersion{
		DocumentID: docID,
		Content:    in.Content,
		CreatedBy:  userID,
	}
	if err := s.versionRepo.CreateTx(ctx, tx, version); err != nil {
		return nil, err
	}
	doc.LatestVersionID = &version.ID

	if err := s.docRepo.UpdateTx(ctx, tx, doc); err != nil {
		return nil, err
	}

	return doc, tx.Commit()
}

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
