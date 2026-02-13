package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type contextKey string

const (
	UserIDKey contextKey = "userID"
	RoleKey   contextKey = "userRole"
)

// UserIDFromCtx extracts the authenticated user ID from the request context.
func UserIDFromCtx(ctx context.Context) (uuid.UUID, bool) {
	v, ok := ctx.Value(UserIDKey).(uuid.UUID)
	return v, ok
}

// RoleFromCtx extracts the authenticated user role from the request context.
func RoleFromCtx(ctx context.Context) string {
	v, _ := ctx.Value(RoleKey).(string)
	return v
}

// Auth returns middleware that validates a Bearer JWT and sets user ID + role in context.
func Auth(secret string) func(http.Handler) http.Handler {
	secretBytes := []byte(secret)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" {
				http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"missing token"}}`, http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(header, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
				http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"invalid auth header"}}`, http.StatusUnauthorized)
				return
			}

			token, err := jwt.Parse(parts[1], func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
				}
				return secretBytes, nil
			})
			if err != nil || !token.Valid {
				http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"invalid or expired token"}}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"invalid claims"}}`, http.StatusUnauthorized)
				return
			}

			sub, _ := claims["sub"].(string)
			userID, err := uuid.Parse(sub)
			if err != nil {
				http.Error(w, `{"error":{"code":"UNAUTHORIZED","message":"invalid user id in token"}}`, http.StatusUnauthorized)
				return
			}

			role, _ := claims["role"].(string)

			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			ctx = context.WithValue(ctx, RoleKey, role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireAdmin rejects requests from non-ADMIN users with 403.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if RoleFromCtx(r.Context()) != "ADMIN" {
			http.Error(w, `{"error":{"code":"FORBIDDEN","message":"admin access required"}}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
