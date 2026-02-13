-- Workflow nodes (associated with a document)
CREATE TABLE workflow_nodes (
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
);

CREATE INDEX idx_workflow_nodes_document ON workflow_nodes(document_id);
