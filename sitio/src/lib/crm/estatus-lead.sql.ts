// LEADS v2 · El recálculo del estatus operativo, en UNA pasada set-based.
//
// Extiende la escalera de lead-etapa.ts con los peldaños que faltaban
// (sin_respuesta, respondio, descubrimiento) y la escribe en la columna.
// Idempotente a propósito: el cron nocturno lo corre completo y cualquier
// deriva se autocorrige. La MISMA consulta sirve para el backfill.
//
// Escalera (gana el peldaño más alto que los HECHOS sostengan):
//   nuevo(0) → contactado(1) → sin_respuesta(2) → respondio(3) →
//   descubrimiento(4) → agendado(5) → demo_hecha(6) → cotizado(7) →
//   negociando(8, manual) · descartado(9, manual, retrocede a propósito)
export const SQL_RECALCULO_ESTATUS = `
with hechos as (
  select ct.id,
    -- toques SALIENTES: mensajes de WhatsApp nuestros + correos + llamadas hechas
    coalesce(wa.salientes, 0) + coalesce(em.enviados, 0) + coalesce(ll.total, 0) as toques,
    least(wa.primer_saliente, em.primer_envio, ll.primera) as primer_toque,
    -- respondió: el primer ENTRANTE real de WhatsApp
    least(wa.primer_entrante, emi.primer_entrante) as respondio_at_calc,
    -- discovery: llamada contestada de 3+ min CON minuta
    coalesce(ll.discovery, false) as discovery,
    coalesce(bk.agendadas, 0) as agendadas,
    coalesce(bk.asistidas, 0) as asistidas,
    coalesce(qt.n, 0) as cotizaciones,
    ct.etapa_manual, ct.calificacion, ct.desenlace, ct.lifecycle_stage,
    ct.estatus_lead as actual, ct.respondio_at as respondio_guardado
  from contacts ct
  left join lateral (
    select count(*) filter (where m.direccion = 'saliente') salientes,
           min(m.created_at) filter (where m.direccion = 'saliente') primer_saliente,
           min(m.created_at) filter (where m.direccion = 'entrante') primer_entrante
    from wa_conversaciones w join wa_mensajes m on m.conversation_id = w.id
    where w.contact_id = ct.id
  ) wa on true
  left join lateral (
    select count(*) enviados, min(created_at) primer_envio
    from email_sends where contact_id = ct.id and estado not in ('queued','failed')
  ) em on true
  left join lateral (
    -- respuesta por CORREO: también es "respondió"
    select min(m.created_at) primer_entrante
    from email_conversations ec join email_messages m on m.conversation_id = ec.id
    where ec.contact_id = ct.id and m.direccion = 'entrante'
  ) emi on true
  left join lateral (
    select count(*) total, min(l.created_at) primera,
           bool_or(l.estado = 'terminada' and coalesce(l.duracion_seg, 0) >= 180 and l.minuta is not null) discovery
    from wa_llamadas l join wa_conversaciones w2 on w2.id = l.conversation_id
    where w2.contact_id = ct.id
  ) ll on true
  left join lateral (
    select count(*) filter (where estado is distinct from 'cancelada') agendadas,
           count(*) filter (where lower(coalesce(estado,'')) like 'asisti%') asistidas
    from bookings where contact_id = ct.id
  ) bk on true
  left join lateral (
    select count(*) n from quotes
    where contact_id = ct.id and estado not in ('deleted', 'plantilla')
  ) qt on true
  where ct.archived_at is null
),
calculo as (
  select id, respondio_at_calc, actual,
    case
      -- descartar retrocede a propósito: es decisión humana explícita
      when calificacion = 'no_califica' or (desenlace is not null and desenlace <> 'ganado') or lifecycle_stage = 'churned' then 'descartado'
      when etapa_manual = 'negociando' then 'negociando'
      when cotizaciones > 0 then 'cotizado'
      when asistidas > 0 then 'demo_hecha'
      when agendadas > 0 then 'agendado'
      when discovery then 'descubrimiento'
      when respondio_at_calc is not null or respondio_guardado is not null then 'respondio'
      when toques >= 3 and respondio_at_calc is null and respondio_guardado is null
           and primer_toque < now() - interval '14 days' then 'sin_respuesta'
      when toques > 0 then 'contactado'
      else 'nuevo'
    end as nuevo_estatus
  from hechos
),
cambio as (
  update contacts ct set
    estatus_lead = c.nuevo_estatus,
    estatus_lead_at = case when ct.estatus_lead is distinct from c.nuevo_estatus then now() else ct.estatus_lead_at end,
    respondio_at = coalesce(ct.respondio_at, c.respondio_at_calc)
  from calculo c
  where ct.id = c.id and (ct.estatus_lead is distinct from c.nuevo_estatus
                          or (ct.respondio_at is null and c.respondio_at_calc is not null))
  returning ct.id, c.actual as antes, c.nuevo_estatus as despues
),
-- El movimiento queda FIRMADO en la actividad (regla del veredicto: todo
-- cambio automático con actor y regla citada).
bitacora as (
  insert into activities (contact_id, tipo, titulo, automatico, metadata)
  select id, 'estatus_cambio',
    'Estatus del lead: ' || antes || ' → ' || despues || ' (recálculo por hechos)',
    true, jsonb_build_object('antes', antes, 'despues', despues, 'actor', 'sistema')
  from cambio where antes is distinct from despues
  returning 1
)
select (select count(*) from cambio) as cambiados, (select count(*) from bitacora) as bitacoras
`;
