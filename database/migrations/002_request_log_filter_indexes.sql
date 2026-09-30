CREATE INDEX IF NOT EXISTS api_gateway_requests_method_created_at_idx
  ON api_gateway_requests (method, created_at DESC);

CREATE INDEX IF NOT EXISTS api_gateway_requests_status_created_at_idx
  ON api_gateway_requests (status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS api_gateway_requests_completed_created_at_idx
  ON api_gateway_requests (completed, created_at DESC);
