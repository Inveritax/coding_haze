-- Survey Queue tables for batch survey distribution
-- Version: 2026-01-26

-- Survey batches: groups queue items created together
CREATE TABLE IF NOT EXISTS survey_batches (
    id              SERIAL PRIMARY KEY,
    survey_config_id INTEGER NOT NULL REFERENCES survey_configs(id),
    name            VARCHAR(255),
    scope_type      VARCHAR(50) NOT NULL,
    scope_filter    JSONB,
    total_items     INTEGER NOT NULL DEFAULT 0,
    created_by      VARCHAR(255),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_survey_batches_config ON survey_batches(survey_config_id);

-- Individual survey queue items
CREATE TABLE IF NOT EXISTS survey_queue (
    id              SERIAL PRIMARY KEY,
    unique_id       UUID NOT NULL DEFAULT gen_random_uuid(),
    batch_id        INTEGER NOT NULL REFERENCES survey_batches(id) ON DELETE CASCADE,
    county_id       INTEGER NOT NULL REFERENCES counties(id),
    survey_config_id INTEGER NOT NULL REFERENCES survey_configs(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    sent_at         TIMESTAMP,
    completed_at    TIMESTAMP,
    response_data   JSONB,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_survey_queue_batch_county UNIQUE (batch_id, county_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_queue_batch ON survey_queue(batch_id);
CREATE INDEX IF NOT EXISTS idx_survey_queue_county ON survey_queue(county_id);
CREATE INDEX IF NOT EXISTS idx_survey_queue_config ON survey_queue(survey_config_id);
CREATE INDEX IF NOT EXISTS idx_survey_queue_status ON survey_queue(status);
CREATE INDEX IF NOT EXISTS idx_survey_queue_unique ON survey_queue(unique_id);
