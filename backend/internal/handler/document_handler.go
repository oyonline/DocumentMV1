package handler

import (
	"net/http"

	"docmv/internal/domain"
	"docmv/internal/middleware"
	"docmv/internal/service"

	"github.com/go-chi/chi/v5"
)

type DocumentHandler struct {
	docSvc *service.DocumentService
}

func NewDocumentHandler(docSvc *service.DocumentService) *DocumentHandler {
	return &DocumentHandler{docSvc: docSvc}
}

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

	var req service.CreateDocInput
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, err)
		return
	}

	doc, err := h.docSvc.Create(r.Context(), userID, req)
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

	var req service.UpdateDocInput
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, err)
		return
	}

	doc, err := h.docSvc.Update(r.Context(), userID, docID, req)
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

// parseUUID is defined in response.go
