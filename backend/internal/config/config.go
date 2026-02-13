package config

import (
	"os"

	"github.com/joho/godotenv"
)

// Config holds all configuration for the application.
type Config struct {
	DBDriver      string // "mysql" or "postgres"
	DBDSN         string // driver-specific DSN
	JWTSecret     string
	ServerPort    string
	AdminEmail    string // default admin account email (seed)
	AdminPassword string // default admin account password (seed)
}

// Load reads configuration from environment variables (with .env fallback).
func Load() (*Config, error) {
	_ = godotenv.Load() // silently ignore if .env doesn't exist

	cfg := &Config{
		DBDriver:      getEnv("DB_DRIVER", "mysql"),
		DBDSN:         getEnv("DB_DSN", "docmv:docmv@tcp(127.0.0.1:3306)/docdb?parseTime=true&charset=utf8mb4&loc=Local"),
		JWTSecret:     getEnv("JWT_SECRET", "dev-secret-change-me"),
		ServerPort:    getEnv("SERVER_PORT", "8080"),
		AdminEmail:    getEnv("ADMIN_EMAIL", "admin@docmv.local"),
		AdminPassword: getEnv("ADMIN_PASSWORD", "admin123"),
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
