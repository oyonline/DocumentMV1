package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"docmv/internal/domain"

	"github.com/google/uuid"
)

// APIResponse is the standard envelope for all API responses.
type APIResponse struct {
	Data      interface{} `json:"data,omitempty"`
	Error     *APIError   `json:"error,omitempty"`
	RequestID string      `json:"request_id"`
}

// APIError carries a machine-readable code and human-readable message.
// Fields is populated when validation fails, mapping field names to error reasons.
type APIError struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}

func respondOK(w http.ResponseWriter, data interface{}) {
	writeJSON(w, http.StatusOK, APIResponse{
		Data:      data,
		RequestID: newRequestID(),
	})
}

func respondCreated(w http.ResponseWriter, data interface{}) {
	writeJSON(w, http.StatusCreated, APIResponse{
		Data:      data,
		RequestID: newRequestID(),
	})
}

func respondError(w http.ResponseWriter, err error) {
	code, status := mapError(err)
	reqID := newRequestID()

	apiErr := &APIError{Code: code, Message: err.Error()}

	// Extract field-level errors from ValidationError
	var ve *domain.ValidationError
	if errors.As(err, &ve) {
		apiErr.Fields = ve.Fields
		log.Printf("[%s] validation failed: %v", reqID, ve.Fields)
	}

	writeJSON(w, status, APIResponse{
		Error:     apiErr,
		RequestID: reqID,
	})
}

func mapError(err error) (code string, status int) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		return "NOT_FOUND", http.StatusNotFound
	case errors.Is(err, domain.ErrForbidden):
		return "FORBIDDEN", http.StatusForbidden
	case errors.Is(err, domain.ErrUnauthorized):
		return "UNAUTHORIZED", http.StatusUnauthorized
	case errors.Is(err, domain.ErrAlreadyExists):
		return "CONFLICT", http.StatusConflict
	case errors.Is(err, domain.ErrInvalidInput):
		return "BAD_REQUEST", http.StatusBadRequest
	default:
		return "INTERNAL_ERROR", http.StatusInternalServerError
	}
}

func newRequestID() string {
	return uuid.New().String()[:8]
}

func decodeJSON(r *http.Request, v interface{}) error {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		return domain.ErrInvalidInput
	}
	return nil
}

func parseUUID(s string) (uuid.UUID, error) {
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.UUID{}, domain.ErrInvalidInput
	}
	return id, nil
}
