CREATE TABLE IF NOT EXISTS api_gateway_requests (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  method VARCHAR(16) NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms DOUBLE PRECISION NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  request_body JSONB,
  response_body JSONB,
  completed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_gateway_requests_created_at_idx
  ON api_gateway_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS api_gateway_requests_path_status_idx
  ON api_gateway_requests (path, status_code, created_at DESC);
