-- 13-sep-2026 · Cada paso de WhatsApp puede llevar su plantilla de respaldo.
--
-- Regla del dueño: siempre una de marketing y una de utility, «por si no llega la
-- primera». El agente de Trabajo Inteligente ya trabajaba con ese par; las
-- cadencias no — cada paso tenía UNA plantilla y si Meta la frenaba (tope de
-- marketing del día, calidad, o el contacto sin marketing habilitado), ese paso
-- simplemente no salía y nadie se enteraba.
alter table crm_secuencia_pasos add column if not exists wa_plantilla_utility text;
comment on column crm_secuencia_pasos.wa_plantilla_utility is 'Plantilla UTILITY de respaldo: se manda si la de marketing falla.';
