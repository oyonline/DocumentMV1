package middleware

import (
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
)

type requestIDKey struct{}

// RequestLogger logs each request with structured fields: method, path, status, latency, requestId.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		requestID := uuid.New().String()[:8]

		// Wrap response writer to capture status code
		wrapped := &statusWriter{ResponseWriter: w, status: http.StatusOK}

		// Add request ID header
		w.Header().Set("X-Request-ID", requestID)

		next.ServeHTTP(wrapped, r)

		userID := "-"
		if uid, ok := UserIDFromCtx(r.Context()); ok {
			userID = uid.String()[:8]
		}

		log.Printf("[%s] %s %s | status=%d latency=%s user=%s",
			requestID, r.Method, r.URL.Path,
			wrapped.status, time.Since(start).Round(time.Millisecond), userID,
		)
	})
}

type statusWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (w *statusWriter) WriteHeader(code int) {
	if !w.wroteHeader {
		w.status = code
		w.wroteHeader = true
	}
	w.ResponseWriter.WriteHeader(code)
}
