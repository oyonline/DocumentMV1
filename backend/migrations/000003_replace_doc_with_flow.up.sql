-- ============================================================
-- Migration 003: Replace Document with Flow (PostgreSQL)
-- Drop old document tables, create new flow tables
-- ============================================================

DROP TABLE IF EXISTS document_shares;
DROP TABLE IF EXISTS document_versions;
DROP TABLE IF EXISTS documents;
DROP TYPE IF EXISTS visibility;

CREATE TABLE flows (
    id                UUID        PRIMARY KEY,
    flow_no           VARCHAR(20) NOT NULL UNIQUE,
    title             VARCHAR(500) NOT NULL,
    owner_id          UUID        NOT NULL REFERENCES users(id),
    owner_dept_id     VARCHAR(100) NOT NULL DEFAULT '',
    overview          TEXT,
    status            VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    diagram_json      TEXT,
    latest_version_id UUID,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE flow_nodes (
    id              UUID           PRIMARY KEY,
    flow_id         UUID           NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    node_no         VARCHAR(20)    NOT NULL DEFAULT '',
    name            VARCHAR(200)   NOT NULL,
    intro           TEXT,
    raci_json       TEXT,
    exec_form       VARCHAR(50),
    duration_min    DECIMAL(10,2),
    duration_max    DECIMAL(10,2),
    duration_unit   VARCHAR(10)    NOT NULL DEFAULT 'DAY',
    prereq_text     TEXT,
    outputs_text    TEXT,
    subtasks_json   TEXT,
    sort_order      INT            NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE flow_versions (
    id            UUID        PRIMARY KEY,
    flow_id       UUID        NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    snapshot_json TEXT        NOT NULL,
    created_by    UUID        NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE flows ADD CONSTRAINT fk_flows_latest_version
    FOREIGN KEY (latest_version_id) REFERENCES flow_versions(id);

CREATE TABLE flow_shares (
    id          UUID        PRIMARY KEY,
    flow_id     UUID        NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id),
    role        VARCHAR(10) NOT NULL DEFAULT 'VIEW',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(flow_id, user_id)
);

CREATE INDEX idx_flows_owner ON flows(owner_id);
CREATE INDEX idx_flows_status ON flows(status);
CREATE INDEX idx_flow_nodes_flow ON flow_nodes(flow_id);
CREATE INDEX idx_flow_nodes_sort ON flow_nodes(flow_id, sort_order);
CREATE INDEX idx_flow_versions_flow ON flow_versions(flow_id);
CREATE INDEX idx_flow_versions_created ON flow_versions(flow_id, created_at DESC);
CREATE INDEX idx_flow_shares_flow ON flow_shares(flow_id);
CREATE INDEX idx_flow_shares_user ON flow_shares(user_id);
