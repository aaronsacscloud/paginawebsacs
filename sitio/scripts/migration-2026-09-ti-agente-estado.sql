-- TRABAJO INTELIGENTE · el estado del agente por lead (reloj de silencio):
-- {ciclo, toque, base_at, siguiente_at, ultimo_toque_at, llamada_at, tarjeta_at, pausa_hasta, angulos:[…]}
-- Regenerable; vive junto al perfil.
alter table ti_perfil add column if not exists agente_estado jsonb not null default '{}'::jsonb;
create index if not exists ti_perfil_agente_sig on ti_perfil ((agente_estado->>'siguiente_at'));
