-- CRM ARR fase 4 — catálogo de planes en BD + columnas para cancelación
-- inteligente, pausa con reanudación y churn ligado a la suscripción.
-- Idempotente. Pegar en el SQL Editor de Supabase.

-- ── 1 · Catálogo de planes (fuente única para todos los formularios) ──
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,               -- 'vende','controla','fideliza','automatiza','personalizada','soporte_premium'
  nombre text NOT NULL,                    -- 'Plan Vende'
  precio_mensual numeric(12,2),            -- null si es a la medida
  precio_anual numeric(12,2),              -- NO derivar 12×: el anual lleva descuento (2 meses gratis)
  a_la_medida boolean NOT NULL DEFAULT false,
  activo boolean NOT NULL DEFAULT true,
  orden int NOT NULL DEFAULT 0,
  vigente_desde date NOT NULL DEFAULT current_date
);

-- Seed / upsert de los 6 planes reales. El anual = 10× el mensual (2 meses de
-- regalo), consistente con Vende ($600/mes → $6,000/año ya implícito en el flujo
-- Regalo Buddy). Editable después desde la tabla; los precios pactados por
-- cliente NO se tocan (viven en subscriptions.precio).
INSERT INTO plans (slug, nombre, precio_mensual, precio_anual, a_la_medida, orden) VALUES
  ('vende',           'Plan Vende',       600,   6000,  false, 1),
  ('controla',        'Plan Controla',    900,   9000,  false, 2),
  ('fideliza',        'Plan Fideliza',    1400,  14000, false, 3),
  ('automatiza',      'Plan Automatiza',  5900,  59000, false, 4),
  ('personalizada',   'Licencia personalizada', NULL, NULL, true, 5),
  ('soporte_premium', 'Soporte premium',       NULL, NULL, true, 6)
ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  precio_mensual = EXCLUDED.precio_mensual,
  precio_anual = EXCLUDED.precio_anual,
  a_la_medida = EXCLUDED.a_la_medida,
  orden = EXCLUDED.orden;

-- ── 2 · Suscripciones: plan_id, precio de lista pactado y cancelación/pausa ──
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plans(id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS precio_lista numeric(12,2);  -- catálogo al momento de pactar (mide descuento)
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancela_al_vencer boolean NOT NULL DEFAULT false; -- cancel_at_period_end
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pausada_hasta date;          -- reanudación obligatoria al pausar
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS ciclo_siguiente text;        -- cambio de ciclo aplicado en la renovación
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS precio_siguiente numeric(12,2);

-- ── 3 · churn_events ligado a la suscripción (hoy solo liga company) ──
ALTER TABLE churn_events ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES subscriptions(id);

-- ── 4 · Mapear los nombre_plan libres actuales a plan_id (best-effort por texto) ──
UPDATE subscriptions s SET plan_id = p.id
FROM plans p
WHERE s.plan_id IS NULL AND (
  (p.slug = 'automatiza'      AND s.nombre_plan ILIKE '%automatiza%') OR
  (p.slug = 'fideliza'        AND s.nombre_plan ILIKE '%fideliza%')  OR
  (p.slug = 'controla'        AND s.nombre_plan ILIKE '%controla%')  OR
  (p.slug = 'vende'           AND s.nombre_plan ILIKE '%vende%')     OR
  (p.slug = 'soporte_premium' AND s.nombre_plan ILIKE '%soporte%')   OR
  (p.slug = 'personalizada'   AND s.nombre_plan ILIKE '%personaliz%')
);
