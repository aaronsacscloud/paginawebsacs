-- TRABAJO INTELIGENTE · MODO SOMBRA del agente SDR (paso 1 del plan del
-- 2026-09-02). El agente decide sobre conversaciones REALES sin enviar nada;
-- el dueño califica cada decisión (bien / corregir / no_debio) y su sugerencia
-- es la lección de máxima prioridad. Misma tabla que usará el botón del
-- inbox «esto hubiera contestado yo» cuando el agente esté en vivo.
create table if not exists ti_sombra (
  id             uuid primary key default gen_random_uuid(),
  lote           text not null,                 -- corrida (fecha-etiqueta)
  caso           int not null,                  -- número visible para comentar
  conversation_id uuid,
  contact_id     uuid,
  corte_at       timestamptz not null,          -- el último mensaje del lead que el agente vio
  contexto       jsonb not null,                -- los mensajes que vio (recortados)
  salida         jsonb not null,                -- lo que decidió el agente
  humano_respuesta text,                        -- lo que de verdad contestó el humano después
  modelo         text,
  costo_usd      numeric(10,6),
  veredicto      text,                          -- bien | corregir | no_debio
  sugerencia     text,                          -- «esto hubiera contestado yo»
  calificado_por uuid,
  calificado_at  timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists ti_sombra_lote on ti_sombra (lote, caso);
