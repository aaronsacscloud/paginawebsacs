-- ═══════════════════════════════════════════════════════════════════════════
-- SOPORTE · Hallazgos comerciales sacados del chat de Intercom.
--
-- Un hallazgo es una PROPUESTA leída de una conversación, no un hecho: "este
-- cliente pidió X" con la frase textual que lo respalda. Vive aparte de
-- expansion_signals a propósito, por dos razones concretas:
--
--   1. `uq_expsig_abierta` es único por (company_id, signal_type) mientras la
--      señal está abierta. Un cliente que pide TRES mejoras distintas tendría
--      una sola fila y las otras dos se perderían pisándose el título.
--   2. Una oportunidad de la bandeja es algo que el negocio ya decidió trabajar.
--      Lo que sale de leer un chat todavía no lo es: primero lo revisa alguien.
--
-- Al ACEPTAR, el hallazgo se materializa en el motor que ya existe
-- (expansion_signals vía registrarOportunidad, o mejoras) y guarda a dónde fue.
-- Así se puede medir el % que se acepta — el único número que dice si el
-- detector sirve o es ruido.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists crm_soporte_hallazgos (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  company_id uuid references companies(id) on delete cascade,
  cuenta text,
  tipo text not null check (tipo in ('oportunidad','mejora','riesgo','testimonio')),
  titulo text not null,
  cita text not null,                  -- frase TEXTUAL del cliente, verificada contra el hilo
  modulo text,
  producto text,                       -- solo del catálogo que se le pasó al modelo
  accion text,
  confianza text check (confianza in ('alta','media')),
  estado text not null default 'pendiente' check (estado in ('pendiente','aceptado','descartado')),
  motivo_descarte text,
  destino text check (destino in ('expansion_signal','mejora')),
  destino_id uuid,                     -- qué se creó al aceptarlo
  huella text not null,                -- dedupe: empresa + tipo + título normalizado
  detectado_at timestamptz not null default now(),
  resuelto_at timestamptz,
  resuelto_por text,
  metadata jsonb
);

-- Un mismo pedido, detectado dos noches seguidas, no debe aparecer dos veces.
-- El índice es PARCIAL: solo bloquea mientras está pendiente, así que si alguien
-- lo descarta y el cliente vuelve a pedirlo meses después, entra de nuevo — eso
-- es información legítima, no un duplicado.
create unique index if not exists uq_hallazgo_pendiente
  on crm_soporte_hallazgos (huella) where estado = 'pendiente';
create index if not exists ix_hallazgo_estado on crm_soporte_hallazgos (estado, detectado_at desc);
create index if not exists ix_hallazgo_company on crm_soporte_hallazgos (company_id);
create index if not exists ix_hallazgo_conv on crm_soporte_hallazgos (conversation_id);

alter table crm_soporte_hallazgos enable row level security;
