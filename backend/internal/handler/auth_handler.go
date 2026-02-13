package handler

import (
	"net/http"

	"docmv/internal/domain"
	"docmv/internal/service"
)

type AuthHandler struct {
	authSvc *service.AuthService
}

func NewAuthHandler(authSvc *service.AuthService) *AuthHandler {
	return &AuthHandler{authSvc: authSvc}
}

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Register is disabled — self-registration is not allowed.
// Kept as a handler to return a clear 403 if someone hits the old endpoint.
func (h *AuthHandler) Register(w http.ResponseWriter, _ *http.Request) {
	respondError(w, domain.ErrForbidden)
}

// Login handles POST /api/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, err)
		return
	}

	result, err := h.authSvc.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		respondError(w, err)
		return
	}

	respondOK(w, result)
}
