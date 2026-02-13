package handler

import (
	"net/http"

	"docmv/internal/domain"
	"docmv/internal/middleware"
	"docmv/internal/service"

	"github.com/go-chi/chi/v5"
)

type FlowHandler struct {
	flowSvc *service.FlowService
}

func NewFlowHandler(flowSvc *service.FlowService) *FlowHandler {
	return &FlowHandler{flowSvc: flowSvc}
}

// ListNodes handles GET /api/docs/{id}/nodes
func (h *FlowHandler) ListNodes(w http.ResponseWriter, r *http.Request) {
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

	nodes, err := h.flowSvc.ListNodes(r.Context(), userID, docID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondOK(w, nodes)
}

// CreateNode handles POST /api/docs/{id}/nodes
func (h *FlowHandler) CreateNode(w http.ResponseWriter, r *http.Request) {
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

	var req service.NodeInput
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, err)
		return
	}

	node, err := h.flowSvc.CreateNode(r.Context(), userID, docID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondCreated(w, node)
}

// GetNode handles GET /api/nodes/{nodeId}
func (h *FlowHandler) GetNode(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		respondError(w, domain.ErrUnauthorized)
		return
	}

	nodeID, err := parseUUID(chi.URLParam(r, "nodeId"))
	if err != nil {
		respondError(w, err)
		return
	}

	node, err := h.flowSvc.GetNode(r.Context(), userID, nodeID)
	if err != nil {
		respondError(w, err)
		return
	}

	respondOK(w, node)
}

// UpdateNode handles PUT /api/nodes/{nodeId}
func (h *FlowHandler) UpdateNode(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromCtx(r.Context())
	if !ok {
		respondError(w, domain.ErrUnauthorized)
		return
	}

	nodeID, err := parseUUID(chi.URLParam(r, "nodeId"))
	if err != nil {
		respondError(w, err)
		return
	}

	var req service.NodeInput
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, err)
		return
	}

	node, err := h.flowSvc.UpdateNode(r.Context(), userID, nodeID, req)
	if err != nil {
		respondError(w, err)
		return
	}

	respondOK(w, node)
}
