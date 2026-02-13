-- Workflow nodes (associated with a document)
CREATE TABLE workflow_nodes (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_workflow_nodes_document ON workflow_nodes(document_id);
