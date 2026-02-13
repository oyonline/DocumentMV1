package domain

import (
	"errors"
	"fmt"
)

// Sentinel errors for business-level failures.
var (
	ErrNotFound      = errors.New("resource not found")
	ErrForbidden     = errors.New("access denied")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrAlreadyExists = errors.New("resource already exists")
	ErrInvalidInput  = errors.New("invalid input")
)

// ValidationError carries per-field error details while still wrapping ErrInvalidInput.
type ValidationError struct {
	Fields map[string]string // e.g. {"name": "required", "exec_form": "required"}
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%v", ErrInvalidInput)
}

func (e *ValidationError) Unwrap() error {
	return ErrInvalidInput
}

// NewValidationError creates a ValidationError with the given field errors.
func NewValidationError(fields map[string]string) *ValidationError {
	return &ValidationError{Fields: fields}
}
