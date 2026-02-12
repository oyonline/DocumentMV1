package domain

import "errors"

// Sentinel errors for business-level failures.
var (
	ErrNotFound      = errors.New("resource not found")
	ErrForbidden     = errors.New("access denied")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrAlreadyExists = errors.New("resource already exists")
	ErrInvalidInput  = errors.New("invalid input")
)
