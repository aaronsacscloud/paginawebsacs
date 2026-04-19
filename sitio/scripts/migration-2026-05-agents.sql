-- ═══════════════════════════════════════════════════════════════════
--  Migration: CRM con agentes IA + partner model
--  Fecha: 2026-04-19
--  Autor: Aaron (via Claude Code)
--
--  Tablas nuevas:
--    - agent_runs (particionada mensual, HNSW-ready)
--    - agent_configs (kill switches + modelo candidato)
--    - agent_tool_log
--    - agent_policies
--    - kb_chunks (pgvector HNSW)
--    - agent_metrics
--    - partner_commissions (comisiones por deal)
--    - product_events (PLG ingestion, futuro)
--
--  Mods a existentes:
--    - team_members.default_commission_pct
--
--  Idempotente (IF NOT EXISTS). Seguro re-correr.
-- ═══════════════════════════════════════════════════════════════════

-- Extensión vector (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 1. agent_runs (particionada por mes) ───
CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  agent_name text NOT NULL,
  agent_version text NOT NULL DEFAULT 'v1',
  trigger_type text NOT NULL CHECK (trigger_type IN ('cron','event','webhook','user','manual')),
  trigger_ref text,
  contact_id uuid,
  company_id uuid,
  deal_id uuid,
  owner_id uuid REFERENCES team_members(id),
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','awaiting_approval','approved','rejected','completed','failed','timeout')),
  input jsonb NOT NULL,
  output jsonb,
  tool_calls jsonb DEFAULT '[]'::jsonb,
  reasoning text,
  model text NOT NULL,
  input_tokens int DEFAULT 0,
  output_tokens int DEFAULT 0,
  cache_read_tokens int DEFAULT 0,
  cache_write_tokens int DEFAULT 0,
  cost_usd numeric(10,6) DEFAULT 0,
  latency_ms int,
  approved_by uuid REFERENCES team_members(id),
  approved_at timestamptz,
  assigned_to uuid REFERENCES team_members(id),
  rejected_reason_category text CHECK (rejected_reason_category IN
    ('wrong_price','wrong_tone','missing_context','hallucinated_fact','dangerous_action','other')),
  rejected_reason_detail text,
  parent_run_id uuid,
  error jsonb,
  pii_fields text[] DEFAULT '{}',
  retention_until timestamptz,
  langfuse_trace_id text,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

ALTER TABLE agent_runs SET (toast_tuple_target = 128);

-- Particiones iniciales (3 meses de runway + 2 meses atrás para seed)
CREATE TABLE IF NOT EXISTS agent_runs_2026_04 PARTITION OF agent_runs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS agent_runs_2026_05 PARTITION OF agent_runs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS agent_runs_2026_06 PARTITION OF agent_runs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS agent_runs_2026_07 PARTITION OF agent_runs
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_runs_trigger_uniq
  ON agent_runs (agent_name, trigger_ref, created_at)
  WHERE trigger_ref IS NOT NULL AND trigger_type IN ('webhook','event');

CREATE INDEX IF NOT EXISTS idx_agent_runs_status_live
  ON agent_runs(status, created_at DESC)
  WHERE status IN ('running','awaiting_approval');

CREATE INDEX IF NOT EXISTS idx_agent_runs_owner
  ON agent_runs(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_assigned
  ON agent_runs(assigned_to, status)
  WHERE status = 'awaiting_approval';

-- ─── 2. agent_configs (kill switches) ───
CREATE TABLE IF NOT EXISTS agent_configs (
  agent_name text PRIMARY KEY,
  enabled boolean DEFAULT true,
  rollout_pct int DEFAULT 100 CHECK (rollout_pct BETWEEN 0 AND 100),
  auto_approve boolean DEFAULT false,
  auto_approve_threshold_mxn numeric(12,2),
  undo_window_minutes int DEFAULT 60,
  min_confidence numeric(3,2) DEFAULT 0.85,
  max_runs_per_day int DEFAULT 1000,
  max_cost_per_run_usd numeric(10,4) DEFAULT 0.50,
  current_model text DEFAULT 'claude-sonnet-4-7',
  candidate_model text,
  fallback_model text DEFAULT 'claude-haiku-4-5',
  updated_at timestamptz DEFAULT now()
);

-- Seed configs v1 (idempotent)
INSERT INTO agent_configs (agent_name, auto_approve, enabled) VALUES
  ('hello_agent', true, true),
  ('meeting_prep', true, true),
  ('quote_drafter', false, true),
  ('service_recommender', true, true)
ON CONFLICT (agent_name) DO NOTHING;

-- ─── 3. agent_tool_log (grano fino de tool calls) ───
CREATE TABLE IF NOT EXISTS agent_tool_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  tool_name text NOT NULL,
  args jsonb,
  result jsonb,
  latency_ms int,
  error jsonb,
  called_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_tool_log_run ON agent_tool_log(run_id, called_at);

-- ─── 4. agent_policies (enforced runtime) ───
CREATE TABLE IF NOT EXISTS agent_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  action_type text NOT NULL,
  requires_approval boolean DEFAULT true,
  min_deal_value numeric(12,2),
  approver_role text,
  daily_limit int,
  notes text,
  UNIQUE (agent_name, action_type)
);

-- Seed default policies
INSERT INTO agent_policies (agent_name, action_type, requires_approval, notes) VALUES
  ('quote_drafter', 'send_to_client', true, 'Quotes siempre requieren approval hasta precision validada'),
  ('quote_drafter', 'draft_internal', false, 'Drafts quedan en inbox del partner, no envían'),
  ('meeting_prep', 'send_internal', false, 'Briefs internos no requieren approval'),
  ('service_recommender', 'suggest_inline', false, 'Solo sugerencias UI, no acciones')
ON CONFLICT (agent_name, action_type) DO NOTHING;

-- ─── 5. kb_chunks (RAG con HNSW) ───
CREATE TABLE IF NOT EXISTS kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  source text NOT NULL,
  source_id text,
  source_url text,
  title text,
  content text NOT NULL,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,
  chunk_index int DEFAULT 0,
  tokens int,
  ttl_days int
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding ON kb_chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_source ON kb_chunks(source);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_metadata ON kb_chunks USING gin (metadata);

-- ─── 6. agent_metrics (para evals + feedback loop) ───
CREATE TABLE IF NOT EXISTS agent_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  run_id uuid,
  metric_name text NOT NULL,
  metric_value numeric,
  metric_payload jsonb,
  recorded_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent ON agent_metrics(agent_name, recorded_at DESC);

-- ─── 7. partner_commissions ───
CREATE TABLE IF NOT EXISTS partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES team_members(id),
  rate_pct numeric(5,2) NOT NULL,
  deal_value numeric(12,2) NOT NULL,
  commission_amount numeric(12,2) NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','earned','paid','cancelled'))
    DEFAULT 'pending',
  earned_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  notes text,
  UNIQUE (deal_id)
);
CREATE INDEX IF NOT EXISTS idx_commissions_partner_status
  ON partner_commissions(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_commissions_deal ON partner_commissions(deal_id);

-- Trigger updated_at en partner_commissions
CREATE OR REPLACE FUNCTION update_partner_commissions_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_partner_commissions_updated_at ON partner_commissions;
CREATE TRIGGER trg_partner_commissions_updated_at
BEFORE UPDATE ON partner_commissions
FOR EACH ROW EXECUTE FUNCTION update_partner_commissions_updated_at();

-- ─── 8. product_events (PLG ingestion, futuro) ───
CREATE TABLE IF NOT EXISTS product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_payload jsonb,
  occurred_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_events_company_time
  ON product_events(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_type
  ON product_events(event_type, occurred_at DESC);

-- ─── 9. team_members.default_commission_pct ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='team_members' AND column_name='default_commission_pct') THEN
    ALTER TABLE team_members ADD COLUMN default_commission_pct numeric(5,2) DEFAULT 20.00;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
--  FIN migration-2026-05-agents.sql
-- ═══════════════════════════════════════════════════════════════════
