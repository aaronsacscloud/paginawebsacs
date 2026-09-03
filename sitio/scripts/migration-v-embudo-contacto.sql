-- Embudo por ciclo de vida (2026-09-03): agregados por contacto para el dashboard de canal → conversación real → demo → venta.
create or replace view v_embudo_contacto as
with wa as (
  select c.contact_id,
         count(m.id) filter (where m.direccion = 'entrante') msgs_in,
         count(m.id) filter (where m.direccion = 'saliente') msgs_out,
         min(m.created_at) filter (where m.direccion = 'entrante') primer_entrante_at,
         max(m.created_at) filter (where m.direccion = 'entrante') ultimo_entrante_at,
         max(m.created_at) ultimo_mensaje_at,
         (array_agg(c.id order by c.ultimo_mensaje_at desc nulls last))[1] conversation_id
  from wa_conversaciones c left join wa_mensajes m on m.conversation_id = c.id and m.borrado_at is null
  where c.contact_id is not null and coalesce(c.interna, false) = false
  group by c.contact_id),
ll as (
  select c.contact_id, max(l.duracion_seg) llamada_max_seg, count(l.id) filter (where l.duracion_seg >= 120) llamadas_2min
  from wa_llamadas l join wa_conversaciones c on c.id = l.conversation_id where c.contact_id is not null group by c.contact_id),
bk as (
  select contact_id, count(*) citas_total, count(*) filter (where estado = 'asistio') citas_asistio,
         count(*) filter (where estado = 'no_asistio') citas_no_asistio, count(*) filter (where estado in ('agendada','confirmada','reagendada') and fecha >= (now() at time zone 'America/Mexico_City')::date) citas_vigentes,
         count(*) filter (where estado in ('agendada','confirmada','reagendada') and fecha < (now() at time zone 'America/Mexico_City')::date) citas_sin_resultado,
         min(fecha) primera_cita_at
  from bookings where contact_id is not null group by contact_id),
qt as (
  select contact_id, count(*) filter (where estado not in ('deleted','plantilla')) cot_total,
         count(*) filter (where estado = 'paid') cot_pagadas, sum(total) filter (where estado in ('sent','accepted')) cot_abierto_monto
  from quotes where contact_id is not null group by contact_id),
py as (
  select contact_id, sum(monto) pagado, count(*) pagos from payments
  where contact_id is not null and estado = 'confirmado' and coalesce(reembolsado, false) = false group by contact_id),
sb as (
  select contact_id, count(*) suscripciones, sum(mrr) filter (where estado = 'activa') mrr_activo from subscriptions where contact_id is not null group by contact_id)
select k.id contact_id, k.nombre, k.apellido, k.fuente, k.utm_source, k.utm_campaign, k.campana, k.created_at, k.lifecycle_stage, k.estatus_lead,
       k.giro, k.company_id, coalesce(co.nombre_comercial, co.nombre) empresa, k.whatsapp, k.telefono, k.owner_id,
       coalesce(wa.msgs_in, 0) msgs_in, coalesce(wa.msgs_out, 0) msgs_out, wa.primer_entrante_at, wa.ultimo_entrante_at, wa.ultimo_mensaje_at, wa.conversation_id,
       coalesce(ll.llamada_max_seg, 0) llamada_max_seg, coalesce(ll.llamadas_2min, 0) llamadas_2min,
       coalesce(bk.citas_total, 0) citas_total, coalesce(bk.citas_asistio, 0) citas_asistio, coalesce(bk.citas_no_asistio, 0) citas_no_asistio, coalesce(bk.citas_vigentes, 0) citas_vigentes, coalesce(bk.citas_sin_resultado, 0) citas_sin_resultado, bk.primera_cita_at,
       coalesce(qt.cot_total, 0) cot_total, coalesce(qt.cot_pagadas, 0) cot_pagadas, coalesce(qt.cot_abierto_monto, 0) cot_abierto_monto,
       coalesce(py.pagado, 0) pagado, coalesce(py.pagos, 0) pagos, coalesce(sb.suscripciones, 0) suscripciones, coalesce(sb.mrr_activo, 0) mrr_activo,
       ((coalesce(wa.msgs_in, 0) >= 2 and coalesce(wa.msgs_out, 0) >= 2) or coalesce(ll.llamadas_2min, 0) > 0) conversacion_real,
       (coalesce(wa.msgs_in, 0) = 0 and coalesce(ll.llamadas_2min, 0) = 0) nunca_contesto,
       (k.lifecycle_stage = 'descalificado' or k.estatus_lead = 'descartado') descalificado,
       (k.fuente ilike 'tiktok%' or k.utm_source ilike '%tiktok%') es_tiktok
from contacts k
left join companies co on co.id = k.company_id
left join wa on wa.contact_id = k.id left join ll on ll.contact_id = k.id left join bk on bk.contact_id = k.id
left join qt on qt.contact_id = k.id left join py on py.contact_id = k.id left join sb on sb.contact_id = k.id
where k.archived_at is null;
