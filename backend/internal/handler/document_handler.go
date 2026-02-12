package handler

import (
	"fmt"
	"net/http"

	"docmv/internal/domain"
	"docmv/internal/middleware"
	"docmv/internal/service"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type DocumentHandler struct {
	docSvc *service.DocumentService
}

func NewDocumentHandler(docSvc *service.DocumentService) *DocumentHandler {
	return &DocumentHandler{docSvc: docSvc}
}

// ---------- Request types ----------

type createDocRequest struct {
	Title      string            `json:"title"`
	Content    string            `json:"content"`
	Visibility domain.Visibility `json:"visibility"`
}

type updateDocRequest struct {
	Title      string            `json:"title"`
	Content    string            `json:"content"`
	Visibility domain.Visibility `json:"visibility"`
}

// ---------- Handlers ----------

// List handles GET /api/docs
func (h *DocumentHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		respondError(w, domain.ErrUnauthorized)
		return
	}

	docs, err := h.docSvc.List(r.Context(), userID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondOK(w, docs)
}

// Create handles POST /api/docs
func (h *DocumentHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		respondError(w, domain.ErrUnauthorized)
		return
	}

	var req createDocRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, err)
		return
	}

	doc, err := h.docSvc.Create(r.Context(), userID, service.CreateDocInput{
		Title:      req.Title,
		Content:    req.Content,
		Visibility: req.Visibility,
	})
	if err != nil {
		respondError(w, err)
		return
	}

	respondCreated(w, doc)
}

// GetDetail handles GET /api/docs/{id}
func (h *DocumentHandler) GetDetail(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		respondError(w, domain.ErrUnauthorized)
		return
	}

	docID, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, err)
		return
	}

	detail, err := h.docSvc.GetDetail(r.Context(), userID, docID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondOK(w, detail)
}

// Update handles PUT /api/docs/{id}
func (h *DocumentHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		respondError(w, domain.ErrUnauthorized)
		return
	}

	docID, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, err)
		return
	}

	var req updateDocRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, err)
		return
	}

	doc, err := h.docSvc.Update(r.Context(), userID, docID, service.UpdateDocInput{
		Title:      req.Title,
		Content:    req.Content,
		Visibility: req.Visibility,
	})
	if err != nil {
		respondError(w, err)
		return
	}

	respondOK(w, doc)
}

// ListVersions handles GET /api/docs/{id}/versions
func (h *DocumentHandler) ListVersions(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		respondError(w, domain.ErrUnauthorized)
		return
	}

	docID, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, err)
		return
	}

	versions, err := h.docSvc.ListVersions(r.Context(), userID, docID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondOK(w, versions)
}

// ---------- Helpers ----------

func parseUUID(s string) (uuid.UUID, error) {
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, fmt.Errorf("%w: invalid id format", domain.ErrInvalidInput)
	}
	return id, nil
}
