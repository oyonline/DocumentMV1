-- Users
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Visibility & share-role enums
CREATE TYPE doc_visibility AS ENUM ('PRIVATE', 'PUBLIC', 'SHARED');
CREATE TYPE share_role     AS ENUM ('VIEW', 'EDIT');

-- Documents
CREATE TABLE documents (
    id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id          UUID           NOT NULL REFERENCES users(id),
    title             VARCHAR(500)   NOT NULL,
    visibility        doc_visibility NOT NULL DEFAULT 'PRIVATE',
    latest_version_id UUID,
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Document versions (immutable log)
CREATE TABLE document_versions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content     TEXT        NOT NULL DEFAULT '',
    created_by  UUID        NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK: documents.latest_version_id -> document_versions.id
ALTER TABLE documents
    ADD CONSTRAINT fk_documents_latest_version
    FOREIGN KEY (latest_version_id) REFERENCES document_versions(id);

-- Document shares
CREATE TABLE document_shares (
    id          UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID       NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id     UUID       NOT NULL REFERENCES users(id),
    role        share_role NOT NULL DEFAULT 'VIEW',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, user_id)
);

-- Indexes
CREATE INDEX idx_documents_owner          ON documents(owner_id);
CREATE INDEX idx_documents_visibility     ON documents(visibility);
CREATE INDEX idx_doc_versions_document    ON document_versions(document_id);
CREATE INDEX idx_doc_versions_created_at  ON document_versions(document_id, created_at DESC);
CREATE INDEX idx_doc_shares_document      ON document_shares(document_id);
CREATE INDEX idx_doc_shares_user          ON document_shares(user_id);
