-- Add role column to users table (PostgreSQL)
-- Default 'USER'; admin account will be seeded by the application on startup.
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER';
