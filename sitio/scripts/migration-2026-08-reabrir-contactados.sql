-- ═══ Regresar los 45 «Contactados» a nuevo y reabrir su conversación ═══════
--
-- Pedido del dueño (31-ago-2026). El conjunto es EXACTAMENTE la pestaña
-- «Contactados» de Leads: se replicó `pestanaDe()` en SQL y se verificó que
-- diera 45, el mismo número que enseña la app. (La vez pasada replicar una
-- pestaña a ojo dio 19 de 108; por eso aquí el número se compara antes de
-- escribir.)
--
-- Es reversible: `respaldo_reapertura_20260831` guarda la etapa, el estatus y
-- el estado de la conversación de cada uno ANTES de tocarlos. Para deshacer,
-- ver el bloque comentado del final.
--
-- ⚠️ Este archivo termina en `rollback` a propósito: así corre como ENSAYO y
--    enseña los números sin escribir nada. Cambia la última línea a `commit;`
--    para aplicarlo de verdad.

begin;

-- Respaldo ANTES de tocar nada: sin esto el cambio no tiene vuelta atrás.
create table if not exists respaldo_reapertura_20260831 (
  contact_id uuid primary key, lifecycle_stage_ant text, estatus_lead_ant text,
  estatus_lead_at_ant timestamptz, conv_id uuid, estado_crm_ant text,
  cierre_categoria_ant text, cierre_nota_ant text, hecho_at timestamptz not null default now());

create temp table _obj as
select c.id from contacts c
where c.contacto_de is null and c.lifecycle_stage = 'lead'
  and coalesce(c.estatus_lead,'nuevo') not in ('nuevo','descartado')
  and c.calificacion is distinct from 'no_califica'
  and (c.prueba_estado is null or c.prueba_estado <> 'activa')
  and not exists (select 1 from bookings b where b.contact_id = c.id);

insert into respaldo_reapertura_20260831 (contact_id, lifecycle_stage_ant, estatus_lead_ant, estatus_lead_at_ant, conv_id, estado_crm_ant, cierre_categoria_ant, cierre_nota_ant)
select c.id, c.lifecycle_stage, c.estatus_lead, c.estatus_lead_at, v.id, v.estado_crm, v.cierre_categoria, v.cierre_nota
from contacts c join _obj o on o.id = c.id
left join lateral (select * from wa_conversaciones w where w.contact_id = c.id order by w.ultimo_mensaje_at desc nulls last limit 1) v on true
on conflict (contact_id) do nothing;

update contacts set lifecycle_stage = 'lead', estatus_lead = 'nuevo', estatus_lead_at = now()
where id in (select id from _obj);

update wa_conversaciones set estado_crm = 'abierta', cierre_categoria = null, cierre_nota = null, snooze_until = null
where contact_id in (select id from _obj) and estado_crm <> 'abierta';

select (select count(*) from _obj) leads_tocados,
       (select count(*) from respaldo_reapertura_20260831) respaldados,
       (select count(*) from contacts where lifecycle_stage='lead' and coalesce(estatus_lead,'nuevo')='nuevo' and contacto_de is null) quedan_en_nuevos,
       (select count(*) from wa_conversaciones where estado_crm='abierta') convs_abiertas,
       (select count(*) from wa_conversaciones where estado_crm='resuelta') convs_resueltas;

rollback;

-- ── Ensayo del 31-ago (rollback): 45 tocados · 45 respaldados ·
--    conversaciones abiertas 23 → 48 · resueltas 256 → 231.

-- ── PARA DESHACER ──────────────────────────────────────────────────────────
-- begin;
-- update contacts c set lifecycle_stage = r.lifecycle_stage_ant,
--        estatus_lead = r.estatus_lead_ant, estatus_lead_at = r.estatus_lead_at_ant
--   from respaldo_reapertura_20260831 r where r.contact_id = c.id;
-- update wa_conversaciones w set estado_crm = r.estado_crm_ant,
--        cierre_categoria = r.cierre_categoria_ant, cierre_nota = r.cierre_nota_ant
--   from respaldo_reapertura_20260831 r where r.conv_id = w.id;
-- commit;
