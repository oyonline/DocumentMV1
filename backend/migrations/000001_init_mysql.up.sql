-- ============================================================
-- MySQL equivalent of 000001_init.up.sql (PostgreSQL)
-- UUID stored as CHAR(36), timestamps as DATETIME(6)
-- ============================================================

-- Users
CREATE TABLE users (
    id            CHAR(36)     NOT NULL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Documents
CREATE TABLE documents (
    id                CHAR(36)                            NOT NULL PRIMARY KEY,
    owner_id          CHAR(36)                            NOT NULL,
    title             VARCHAR(500)                        NOT NULL,
    visibility        ENUM('PRIVATE','PUBLIC','SHARED')   NOT NULL DEFAULT 'PRIVATE',
    latest_version_id CHAR(36)                            DEFAULT NULL,
    created_at        DATETIME(6)                         NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at        DATETIME(6)                         NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_documents_owner FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Document versions (immutable log)
CREATE TABLE document_versions (
    id          CHAR(36)    NOT NULL PRIMARY KEY,
    document_id CHAR(36)    NOT NULL,
    content     LONGTEXT    NOT NULL,
    created_by  CHAR(36)    NOT NULL,
    created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_versions_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_versions_creator  FOREIGN KEY (created_by)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FK: documents.latest_version_id -> document_versions.id
ALTER TABLE documents
    ADD CONSTRAINT fk_documents_latest_version
    FOREIGN KEY (latest_version_id) REFERENCES document_versions(id);

-- Document shares
CREATE TABLE document_shares (
    id          CHAR(36)          NOT NULL PRIMARY KEY,
    document_id CHAR(36)          NOT NULL,
    user_id     CHAR(36)          NOT NULL,
    role        ENUM('VIEW','EDIT') NOT NULL DEFAULT 'VIEW',
    created_at  DATETIME(6)       NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_shares_doc_user (document_id, user_id),
    CONSTRAINT fk_shares_document FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_shares_user     FOREIGN KEY (user_id)     REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes (same as PostgreSQL migration)
CREATE INDEX idx_documents_owner          ON documents(owner_id);
CREATE INDEX idx_documents_visibility     ON documents(visibility);
CREATE INDEX idx_doc_versions_document    ON document_versions(document_id);
CREATE INDEX idx_doc_versions_created_at  ON document_versions(document_id, created_at DESC);
CREATE INDEX idx_doc_shares_document      ON document_shares(document_id);
CREATE INDEX idx_doc_shares_user          ON document_shares(user_id);
