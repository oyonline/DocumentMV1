package handler

import (
	"net/http"

	"docmv/internal/config"
	mw "docmv/internal/middleware"
	"docmv/internal/service"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// NewRouter builds the HTTP router with all routes and middleware.
func NewRouter(cfg *config.Config, authSvc *service.AuthService, docSvc *service.DocumentService) http.Handler {
	r := chi.NewRouter()

	// ---------- Global middleware ----------
	r.Use(chimw.Recoverer)
	r.Use(chimw.RealIP)
	r.Use(mw.RequestLogger)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://127.0.0.1:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	authH := NewAuthHandler(authSvc)
	flowH := NewFlowHandler(flowSvc)
	adminH := NewAdminHandler(authSvc)
	flowH := NewFlowHandler(flowSvc)

	// ---------- Public routes ----------
	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/login", authH.Login)
		// Self-registration disabled: return 403 if hit
		r.Post("/register", authH.Register)
	})

	// ---------- Protected routes ----------
	r.Group(func(r chi.Router) {
		r.Use(mw.Auth(cfg.JWTSecret))

		// Document routes (unchanged)
		r.Route("/api/docs", func(r chi.Router) {
			r.Get("/", docH.List)
			r.Post("/", docH.Create)
			r.Get("/{id}", docH.GetDetail)
			r.Put("/{id}", docH.Update)
			r.Get("/{id}/versions", docH.ListVersions)
		})

		// Admin routes (ADMIN role required)
		r.Route("/api/admin", func(r chi.Router) {
			r.Use(mw.RequireAdmin)
			r.Get("/users", adminH.ListUsers)
			r.Post("/users", adminH.CreateUser)
			r.Post("/users/{id}/reset_password", adminH.ResetPassword)
		})
	})

	// Health check
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(`{"status":"ok"}`)) //nolint:errcheck
	})

	return r
}
