package config

import (
	"os"

	"github.com/joho/godotenv"
)

// Config holds all configuration for the application.
type Config struct {
	DatabaseURL string
	JWTSecret   string
	ServerPort  string
}

// Load reads configuration from environment variables (with .env fallback).
func Load() (*Config, error) {
	_ = godotenv.Load() // silently ignore if .env doesn't exist

	cfg := &Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgres://docmv:docmv@localhost:5432/docmv?sslmode=disable"),
		JWTSecret:   getEnv("JWT_SECRET", "dev-secret-change-me"),
		ServerPort:  getEnv("SERVER_PORT", "8080"),
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
