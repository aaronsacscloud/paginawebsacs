-- Tres cosas que le faltaban a las cadencias para funcionar y para medirse.
--
-- 1) prueba_inicio: la fecha en que arrancó la prueba gratis. Sin ella el cron
--    usaba estatus_lead_at como "cuándo llegó", y mover a alguien a la etapa
--    prueba_gratis NO toca ese campo: un lead nutrido dos meses entraba con
--    fecha de hace dos meses y el corte lo descartaba. Nunca recibía el día 1.
-- 2) El ANCLA es configurable por secuencia (entrada.ancla). Cada cadencia
--    cuenta desde lo que a ella le importa, no desde un campo fijo del código.
-- 3) Métricas por CANAL con resultados, no solo envíos.
begin;

alter table contacts add column if not exists prueba_inicio timestamptz;
comment on column contacts.prueba_inicio is
  'Cuándo arrancó su prueba gratis. Es el ancla de la cadencia de onboarding: los días se cuentan desde aquí, no desde que cambió de estatus.';

create index if not exists idx_contacts_prueba_inicio on contacts (prueba_inicio) where prueba_inicio is not null;

-- ── Métricas con resultados por canal ──────────────────────────────────────
-- Lo que faltaba: se contaban los ENVÍOS por canal pero no lo que PASÓ después
-- de cada uno. "Mandé 40 correos y 12 WhatsApps" no dice si la cadencia sirvió.
drop function if exists public.crm_secuencias_resultados();
create function public.crm_secuencias_resultados()
returns table (
  secuencia_id uuid,
  correo_enviados bigint, correo_abiertos bigint, correo_clic bigint,
  wa_enviados bigint, wa_respondidos bigint,
  respondieron bigint, agendaron bigint, cotizaron bigint, convirtieron bigint,
  monto_cotizado numeric
)
language sql stable as $$
  with env as (
    select (a.metadata->>'secuencia_id')::uuid sid,
      count(*) filter (where a.metadata->>'canal' = 'correo') correos,
      count(*) filter (where a.metadata->>'canal' = 'wa') was
    from activities a where a.tipo = 'secuencia_envio' group by 1),
  -- Correo: solo los envíos que son PASOS de esa secuencia, no cualquier correo.
  cor as (
    select cm.secuencia_id sid,
      count(distinct s.id) filter (where s.first_opened_at is not null or s.opened_at is not null) abiertos,
      count(distinct s.id) filter (where s.clicked_at is not null) clics
    from crm_secuencia_miembros cm
    join email_sends s on s.contact_id = cm.contact_id and s.created_at >= cm.inicio
    join crm_secuencia_pasos p on p.secuencia_id = cm.secuencia_id and p.canal = 'correo'
      and s.template_id in (p.email_template_id, p.email_template_id_b)
    group by 1),
  -- WhatsApp: un entrante DESPUÉS de entrar cuenta como respuesta al canal.
  wa as (
    select cm.secuencia_id sid, count(distinct cm.contact_id) respondieron
    from crm_secuencia_miembros cm
    join wa_conversaciones c on c.contact_id = cm.contact_id
    join wa_mensajes m on m.conversation_id = c.id
      and m.direccion = 'entrante' and m.created_at >= cm.inicio and m.borrado_at is null
    group by 1),
  -- Resultados del negocio, siempre contados DESPUÉS de entrar a la cadencia:
  -- si la reunión es anterior, no la produjo esta secuencia.
  res as (
    select cm.secuencia_id sid,
      count(distinct cm.contact_id) filter (where b.id is not null) agendaron,
      count(distinct cm.contact_id) filter (where q.id is not null) cotizaron,
      coalesce(sum(distinct q.total), 0) monto
    from crm_secuencia_miembros cm
    left join bookings b on b.contact_id = cm.contact_id and b.created_at >= cm.inicio
    left join quotes   q on q.contact_id = cm.contact_id and q.created_at >= cm.inicio
    group by 1),
  conv as (
    select cm.secuencia_id sid, count(distinct cm.contact_id) n
    from crm_secuencia_miembros cm
    join contacts ct on ct.id = cm.contact_id and ct.lifecycle_stage = 'cliente'
    group by 1),
  resp as (
    select cm.secuencia_id sid, count(distinct cm.contact_id) n
    from crm_secuencia_miembros cm
    where cm.canales_detenidos::text like '%respondio%'
    group by 1)
  select sec.id,
    coalesce(env.correos, 0), coalesce(cor.abiertos, 0), coalesce(cor.clics, 0),
    coalesce(env.was, 0), coalesce(wa.respondieron, 0),
    coalesce(resp.n, 0), coalesce(res.agendaron, 0), coalesce(res.cotizaron, 0), coalesce(conv.n, 0),
    coalesce(res.monto, 0)
  from crm_secuencias sec
  left join env  on env.sid  = sec.id
  left join cor  on cor.sid  = sec.id
  left join wa   on wa.sid   = sec.id
  left join res  on res.sid  = sec.id
  left join conv on conv.sid = sec.id
  left join resp on resp.sid = sec.id
$$;

-- La cadencia de prueba cuenta desde que arrancó la prueba, no desde el estatus.
update crm_secuencias
set entrada = entrada || '{"ancla": "prueba_inicio", "salir_al_convertir": true}'::jsonb
where nombre = 'Prueba gratis · 14 días';

commit;
