package main

import (
	"log"
	"net/http"

	"docmv/internal/config"
	"docmv/internal/handler"
	"docmv/internal/repository"
	"docmv/internal/service"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	db, err := repository.NewDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	// Repositories
	userRepo := repository.NewUserRepo(db)
	docRepo := repository.NewDocumentRepo(db)
	versionRepo := repository.NewVersionRepo(db)

	// Services
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)
	docSvc := service.NewDocumentService(db, docRepo, versionRepo)

	// Router
	r := handler.NewRouter(cfg, authSvc, docSvc)

	log.Printf("=== DocMV server starting on :%s ===", cfg.ServerPort)
	if err := http.ListenAndServe(":"+cfg.ServerPort, r); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
