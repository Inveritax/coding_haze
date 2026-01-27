-- Survey Configs table for storing survey builder JSON configs
CREATE TABLE IF NOT EXISTS survey_configs (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  config      JSONB NOT NULL,
  status      VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_by  VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_survey_configs_status ON survey_configs(status);
