-- ============================================================================
--  Pipelines configurables del CRM
--  Fecha: 2026-07-21
--  - Tabla `pipelines`: un pipeline por tipo (lead/oportunidad/cliente) con
--    etapas en JSONB [{key,label,color}]. Editable desde Configuración.
--  - Campo `pipeline_stage` aditivo en contacts/companies/deals para ubicar
--    cada registro en su etapa (vistas Kanban). NO toca lifecycle_stage /
--    deals.stage / estado_cuenta (que mueven ARR y comisiones).
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('lead','oportunidad','cliente')),
  nombre text NOT NULL DEFAULT 'Pipeline',
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  activo boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tipo)   -- un pipeline por tipo (simple)
);

ALTER TABLE contacts  ADD COLUMN IF NOT EXISTS pipeline_stage text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS pipeline_stage text;
ALTER TABLE deals     ADD COLUMN IF NOT EXISTS pipeline_stage text;

CREATE INDEX IF NOT EXISTS idx_contacts_pipeline_stage  ON contacts(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_companies_pipeline_stage ON companies(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_stage     ON deals(pipeline_stage);

-- Semilla de los 3 pipelines por defecto (no pisa si ya existen).
INSERT INTO pipelines (tipo, nombre, stages) VALUES
('lead', 'Prospección', '[
  {"key":"nuevo","label":"Nuevo","color":"#64748B"},
  {"key":"contactado","label":"Contactado","color":"#4B7BE5"},
  {"key":"calificado","label":"Calificado","color":"#7c3aed"},
  {"key":"nutriendo","label":"Nutriendo","color":"#0891b2"},
  {"key":"descartado","label":"Descartado","color":"#94a3b8"}
]'::jsonb),
('oportunidad', 'Ventas', '[
  {"key":"calificacion","label":"Calificación","color":"#64748B"},
  {"key":"demo_agendada","label":"Demo agendada","color":"#4B7BE5"},
  {"key":"demo_realizada","label":"Demo realizada","color":"#6C5CE7"},
  {"key":"cotizacion_enviada","label":"Cotización enviada","color":"#0891b2"},
  {"key":"negociacion","label":"Negociación","color":"#E8A838"},
  {"key":"cerrada_ganada","label":"Ganada","color":"#1A8F7A"},
  {"key":"cerrada_perdida","label":"Perdida","color":"#E54B4B"}
]'::jsonb),
('cliente', 'Ciclo de vida', '[
  {"key":"onboarding","label":"Onboarding","color":"#4B7BE5"},
  {"key":"activo","label":"Activo","color":"#1A8F7A"},
  {"key":"expansion","label":"En expansión","color":"#7c3aed"},
  {"key":"riesgo","label":"En riesgo","color":"#E8A838"},
  {"key":"recuperar","label":"Recuperar","color":"#E54B4B"}
]'::jsonb)
ON CONFLICT (tipo) DO NOTHING;

-- Verificación
SELECT tipo, nombre, jsonb_array_length(stages) AS n_etapas FROM pipelines ORDER BY tipo;
