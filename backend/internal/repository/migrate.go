package repository

import (
	"fmt"
	"log"

	"github.com/jmoiron/sqlx"
)

// AutoMigrate creates all required tables and columns if they do not exist.
// It is safe to call on every startup — all statements use IF NOT EXISTS or
// equivalent guards so they are no-ops when the schema is already current.
func AutoMigrate(db *sqlx.DB, driver string) error {
	log.Println("[migrate] running auto-migration …")

	switch driver {
	case "postgres":
		return migratePostgres(db)
	case "mysql":
		return migrateMySQL(db)
	default:
		return fmt.Errorf("unsupported driver for auto-migrate: %s", driver)
	}
}

// ── PostgreSQL ──────────────────────────────────────────────────────────────

func migratePostgres(db *sqlx.DB) error {
	stmts := []string{
		// Users
		`CREATE TABLE IF NOT EXISTS users (
			id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email         VARCHAR(255) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			role          VARCHAR(20)  NOT NULL DEFAULT 'USER',
			created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)`,

		// role column (may be missing if old init migration was used)
		`DO $$ BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'users' AND column_name = 'role'
			) THEN
				ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER';
			END IF;
		END $$`,

		// Visibility enum
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_visibility') THEN
				CREATE TYPE doc_visibility AS ENUM ('PRIVATE', 'PUBLIC', 'SHARED');
			END IF;
		END $$`,

		// Share-role enum
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'share_role') THEN
				CREATE TYPE share_role AS ENUM ('VIEW', 'EDIT');
			END IF;
		END $$`,

		// Documents
		`CREATE TABLE IF NOT EXISTS documents (
			id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
			owner_id          UUID           NOT NULL REFERENCES users(id),
			title             VARCHAR(500)   NOT NULL,
			visibility        VARCHAR(20)    NOT NULL DEFAULT 'PRIVATE',
			latest_version_id UUID,
			created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
			updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
		)`,

		// Document versions
		`CREATE TABLE IF NOT EXISTS document_versions (
			id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
			document_id UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
			content     TEXT        NOT NULL DEFAULT '',
			created_by  UUID        NOT NULL REFERENCES users(id),
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,

		// Document shares
		`CREATE TABLE IF NOT EXISTS document_shares (
			id          UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
			document_id UUID       NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
			user_id     UUID       NOT NULL REFERENCES users(id),
			role        VARCHAR(20) NOT NULL DEFAULT 'VIEW',
			created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(document_id, user_id)
		)`,

		// Workflow nodes
		`CREATE TABLE IF NOT EXISTS workflow_nodes (
			id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
			document_id    UUID           NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
			name           VARCHAR(500)   NOT NULL,
			exec_form      VARCHAR(50)    NOT NULL,
			description    TEXT           NOT NULL DEFAULT '',
			preconditions  TEXT           NOT NULL DEFAULT '',
			outputs        TEXT           NOT NULL DEFAULT '',
			duration_min   DOUBLE PRECISION,
			duration_max   DOUBLE PRECISION,
			duration_unit  VARCHAR(20)    NOT NULL DEFAULT 'DAY',
			raci_json      TEXT           NOT NULL DEFAULT '{"R":[],"A":[],"S":[],"C":[],"I":[]}',
			subtasks_json  TEXT           NOT NULL DEFAULT '[]',
			diagram_json   TEXT           NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
			created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
			updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
		)`,

		// Indexes (IF NOT EXISTS supported since PG 9.5)
		`CREATE INDEX IF NOT EXISTS idx_documents_owner          ON documents(owner_id)`,
		`CREATE INDEX IF NOT EXISTS idx_documents_visibility     ON documents(visibility)`,
		`CREATE INDEX IF NOT EXISTS idx_doc_versions_document    ON document_versions(document_id)`,
		`CREATE INDEX IF NOT EXISTS idx_doc_versions_created_at  ON document_versions(document_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_doc_shares_document      ON document_shares(document_id)`,
		`CREATE INDEX IF NOT EXISTS idx_doc_shares_user          ON document_shares(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_workflow_nodes_document  ON workflow_nodes(document_id)`,
	}

	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return fmt.Errorf("postgres migration failed: %w\nSQL: %s", err, s)
		}
	}
	log.Println("[migrate] postgres schema up-to-date")
	return nil
}

// ── MySQL ───────────────────────────────────────────────────────────────────

func migrateMySQL(db *sqlx.DB) error {
	stmts := []string{
		// Users
		`CREATE TABLE IF NOT EXISTS users (
			id            CHAR(36)     NOT NULL PRIMARY KEY,
			email         VARCHAR(255) NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			role          VARCHAR(20)  NOT NULL DEFAULT 'USER',
			created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
			UNIQUE KEY uk_users_email (email)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Documents
		`CREATE TABLE IF NOT EXISTS documents (
			id                CHAR(36)                            NOT NULL PRIMARY KEY,
			owner_id          CHAR(36)                            NOT NULL,
			title             VARCHAR(500)                        NOT NULL,
			visibility        ENUM('PRIVATE','PUBLIC','SHARED')   NOT NULL DEFAULT 'PRIVATE',
			latest_version_id CHAR(36)                            DEFAULT NULL,
			created_at        DATETIME(6)                         NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
			updated_at        DATETIME(6)                         NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
			CONSTRAINT fk_documents_owner FOREIGN KEY (owner_id) REFERENCES users(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Document versions
		`CREATE TABLE IF NOT EXISTS document_versions (
			id          CHAR(36)    NOT NULL PRIMARY KEY,
			document_id CHAR(36)    NOT NULL,
			content     LONGTEXT    NOT NULL,
			created_by  CHAR(36)    NOT NULL,
			created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
			CONSTRAINT fk_versions_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
			CONSTRAINT fk_versions_creator  FOREIGN KEY (created_by)  REFERENCES users(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Document shares
		`CREATE TABLE IF NOT EXISTS document_shares (
			id          CHAR(36)          NOT NULL PRIMARY KEY,
			document_id CHAR(36)          NOT NULL,
			user_id     CHAR(36)          NOT NULL,
			role        ENUM('VIEW','EDIT') NOT NULL DEFAULT 'VIEW',
			created_at  DATETIME(6)       NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
			UNIQUE KEY uk_shares_doc_user (document_id, user_id),
			CONSTRAINT fk_shares_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
			CONSTRAINT fk_shares_user     FOREIGN KEY (user_id)     REFERENCES users(id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		// Workflow nodes
		`CREATE TABLE IF NOT EXISTS workflow_nodes (
			id             CHAR(36)       NOT NULL PRIMARY KEY,
			document_id    CHAR(36)       NOT NULL,
			name           VARCHAR(500)   NOT NULL,
			exec_form      VARCHAR(50)    NOT NULL,
			description    TEXT           NOT NULL,
			preconditions  TEXT           NOT NULL,
			outputs        TEXT           NOT NULL,
			duration_min   DOUBLE,
			duration_max   DOUBLE,
			duration_unit  VARCHAR(20)    NOT NULL DEFAULT 'DAY',
			raci_json      TEXT           NOT NULL,
			subtasks_json  TEXT           NOT NULL,
			diagram_json   TEXT           NOT NULL,
			created_at     TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
			updated_at     TIMESTAMP(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
			FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	}

	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return fmt.Errorf("mysql migration failed: %w\nSQL: %s", err, s)
		}
	}

	// Add role column if missing (MySQL has no ADD COLUMN IF NOT EXISTS)
	mysqlAddColumnIfMissing(db, "users", "role", "VARCHAR(20) NOT NULL DEFAULT 'USER' AFTER password_hash")

	// Indexes (MySQL ignores duplicate index names gracefully via error check)
	indexes := []string{
		`CREATE INDEX idx_documents_owner          ON documents(owner_id)`,
		`CREATE INDEX idx_documents_visibility     ON documents(visibility)`,
		`CREATE INDEX idx_doc_versions_document    ON document_versions(document_id)`,
		`CREATE INDEX idx_doc_versions_created_at  ON document_versions(document_id, created_at DESC)`,
		`CREATE INDEX idx_doc_shares_document      ON document_shares(document_id)`,
		`CREATE INDEX idx_doc_shares_user          ON document_shares(user_id)`,
		`CREATE INDEX idx_workflow_nodes_document  ON workflow_nodes(document_id)`,
	}
	for _, idx := range indexes {
		// Ignore "Duplicate key name" errors
		db.Exec(idx) //nolint:errcheck
	}

	log.Println("[migrate] mysql schema up-to-date")
	return nil
}

// mysqlAddColumnIfMissing adds a column to a table only if it does not already exist.
func mysqlAddColumnIfMissing(db *sqlx.DB, table, column, definition string) {
	var count int
	err := db.Get(&count,
		`SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
		table, column)
	if err != nil || count > 0 {
		return
	}
	sql := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, definition)
	if _, err := db.Exec(sql); err != nil {
		log.Printf("[migrate] warning: failed to add column %s.%s: %v", table, column, err)
	}
}
