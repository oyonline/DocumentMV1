package handler

import (
	"net/http"

	"docmv/internal/service"

	"github.com/go-chi/chi/v5"
)

// AdminHandler handles user-management endpoints (ADMIN only).
type AdminHandler struct {
	authSvc *service.AuthService
}

func NewAdminHandler(authSvc *service.AuthService) *AdminHandler {
	return &AdminHandler{authSvc: authSvc}
}

// ---------- Request types ----------

type createUserRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"` // optional, defaults to USER
}

type resetPasswordRequest struct {
	Password string `json:"password"`
}

// ---------- Handlers ----------

// ListUsers handles GET /api/admin/users
func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.authSvc.ListUsers(r.Context())
	if err != nil {
		respondError(w, err)
		return
	}
	respondOK(w, users)
}

// CreateUser handles POST /api/admin/users
func (h *AdminHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, err)
		return
	}

	user, err := h.authSvc.CreateUser(r.Context(), req.Email, req.Password, req.Role)
	if err != nil {
		respondError(w, err)
		return
	}

	respondCreated(w, user)
}

// ResetPassword handles POST /api/admin/users/{id}/reset_password
func (h *AdminHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	userID, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		respondError(w, err)
		return
	}

	var req resetPasswordRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, err)
		return
	}

	if err := h.authSvc.ResetPassword(r.Context(), userID, req.Password); err != nil {
		respondError(w, err)
		return
	}

	respondOK(w, map[string]string{"status": "ok"})
}
