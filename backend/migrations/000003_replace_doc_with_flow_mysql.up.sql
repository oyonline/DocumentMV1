-- ============================================================
-- Migration 003: Replace Document with Flow (MySQL)
-- Drop old document tables, create new flow tables
-- ============================================================

-- Drop old tables (reverse FK order)
DROP TABLE IF EXISTS document_shares;
DROP TABLE IF EXISTS document_versions;
DROP TABLE IF EXISTS documents;

-- Flows (replaces documents)
CREATE TABLE flows (
    id                CHAR(36)     NOT NULL PRIMARY KEY,
    flow_no           VARCHAR(20)  NOT NULL,
    title             VARCHAR(500) NOT NULL,
    owner_id          CHAR(36)     NOT NULL,
    owner_dept_id     VARCHAR(100) NOT NULL DEFAULT '',
    overview          TEXT         DEFAULT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    diagram_json      LONGTEXT     DEFAULT NULL,
    latest_version_id CHAR(36)     DEFAULT NULL,
    created_at        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_flows_flow_no (flow_no),
    CONSTRAINT fk_flows_owner FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Flow nodes
CREATE TABLE flow_nodes (
    id              CHAR(36)      NOT NULL PRIMARY KEY,
    flow_id         CHAR(36)      NOT NULL,
    node_no         VARCHAR(20)   NOT NULL DEFAULT '',
    name            VARCHAR(200)  NOT NULL,
    intro           TEXT          DEFAULT NULL,
    raci_json       TEXT          DEFAULT NULL,
    exec_form       VARCHAR(50)   DEFAULT NULL,
    duration_min    DECIMAL(10,2) DEFAULT NULL,
    duration_max    DECIMAL(10,2) DEFAULT NULL,
    duration_unit   VARCHAR(10)   NOT NULL DEFAULT 'DAY',
    prereq_text     TEXT          DEFAULT NULL,
    outputs_text    TEXT          DEFAULT NULL,
    subtasks_json   TEXT          DEFAULT NULL,
    sort_order      INT           NOT NULL DEFAULT 0,
    created_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_flow_nodes_flow FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Flow versions (snapshot-based)
CREATE TABLE flow_versions (
    id            CHAR(36)    NOT NULL PRIMARY KEY,
    flow_id       CHAR(36)    NOT NULL,
    snapshot_json LONGTEXT    NOT NULL,
    created_by    CHAR(36)    NOT NULL,
    created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_flow_versions_flow    FOREIGN KEY (flow_id)    REFERENCES flows(id) ON DELETE CASCADE,
    CONSTRAINT fk_flow_versions_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FK: flows.latest_version_id -> flow_versions.id
ALTER TABLE flows
    ADD CONSTRAINT fk_flows_latest_version
    FOREIGN KEY (latest_version_id) REFERENCES flow_versions(id);

-- Flow shares
CREATE TABLE flow_shares (
    id          CHAR(36)                    NOT NULL PRIMARY KEY,
    flow_id     CHAR(36)                    NOT NULL,
    user_id     CHAR(36)                    NOT NULL,
    role        ENUM('VIEW','EDIT')         NOT NULL DEFAULT 'VIEW',
    created_at  DATETIME(6)                 NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uk_flow_shares (flow_id, user_id),
    CONSTRAINT fk_flow_shares_flow FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
    CONSTRAINT fk_flow_shares_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes
CREATE INDEX idx_flows_owner       ON flows(owner_id);
CREATE INDEX idx_flows_status      ON flows(status);
CREATE INDEX idx_flow_nodes_flow   ON flow_nodes(flow_id);
CREATE INDEX idx_flow_nodes_sort   ON flow_nodes(flow_id, sort_order);
CREATE INDEX idx_flow_versions_flow      ON flow_versions(flow_id);
CREATE INDEX idx_flow_versions_created   ON flow_versions(flow_id, created_at DESC);
CREATE INDEX idx_flow_shares_flow  ON flow_shares(flow_id);
CREATE INDEX idx_flow_shares_user  ON flow_shares(user_id);
