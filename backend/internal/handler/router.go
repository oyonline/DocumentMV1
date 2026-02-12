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
	docH := NewDocumentHandler(docSvc)

	// ---------- Public routes ----------
	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/register", authH.Register)
		r.Post("/login", authH.Login)
	})

	// ---------- Protected routes ----------
	r.Group(func(r chi.Router) {
		r.Use(mw.Auth(cfg.JWTSecret))

		r.Route("/api/docs", func(r chi.Router) {
			r.Get("/", docH.List)
			r.Post("/", docH.Create)
			r.Get("/{id}", docH.GetDetail)
			r.Put("/{id}", docH.Update)
			r.Get("/{id}/versions", docH.ListVersions)
		})
	})

	// Health check
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(`{"status":"ok"}`)) //nolint:errcheck
	})

	return r
}
