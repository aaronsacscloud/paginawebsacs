-- Reactivación de leads viejos (decisión 2026-09-03): primer contacto personalizado por lead, aprobado por el dueño con rampa.
create table if not exists ti_reactivacion (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  conversation_id uuid, telefono text,
  segmento text not null,                -- intencion (pidió precio/demo) | conversacion (preguntó y no siguió)
  meses_sin_hablar int,
  resumen_lead text, pregunta_original text, angulo text,
  mensaje text not null, mensaje_original text, por_que text,
  estado text not null default 'propuesta',   -- propuesta | programada | enviada | respondio | rechazada | error
  envio_id uuid, sale_at timestamptz,
  decidido_por uuid, decidido_at timestamptz, editado boolean default false, automatica boolean default false,
  modelo text, costo_usd numeric, error text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create unique index if not exists uq_ti_reactivacion_por_lead on ti_reactivacion(contact_id) where estado <> 'rechazada';
create index if not exists ix_ti_reactivacion_estado on ti_reactivacion(estado, created_at desc);

create or replace view v_ti_reactivacion_candidatos as
with ult as (
  select c.contact_id,
         (array_agg(c.id order by c.ultimo_mensaje_at desc nulls last))[1] conv_id,
         (array_agg(c.telefono order by c.ultimo_mensaje_at desc nulls last))[1] telefono,
         max(c.ultimo_entrante_at) ult_in,
         bool_or(exists (select 1 from wa_mensajes m where m.conversation_id = c.id and m.direccion = 'entrante'
                          and m.cuerpo ~* '(precio|cu[aá]nto|demo|cotiza|costo|mensualidad|planes?\M)')) pidio
  from wa_conversaciones c
  where c.contact_id is not null and coalesce(c.interna, false) = false
  group by c.contact_id)
select k.id contact_id, k.nombre, k.email, k.lifecycle_stage, k.company_id,
       coalesce(co.nombre_comercial, co.nombre) empresa,
       u.conv_id conversation_id, u.telefono, u.ult_in,
       (extract(epoch from (now() - u.ult_in)) / 2629800)::int meses_sin_hablar,
       case when u.pidio then 'intencion' else 'conversacion' end segmento
from ult u
join contacts k on k.id = u.contact_id
left join companies co on co.id = k.company_id
where k.archived_at is null
  and k.lifecycle_stage in ('lead','lead_calificado','oportunidad','rezagado','descalificado')
  and coalesce(k.wa_optout, false) = false
  and coalesce(k.descarte_categoria, '') not like 'no_era_lead%'
  and u.ult_in is not null and u.ult_in < now() - interval '60 days' and u.ult_in > now() - interval '365 days'
  and not exists (select 1 from quotes q where q.contact_id = k.id and q.estado not in ('deleted','plantilla'))
  and not exists (select 1 from bookings b where b.contact_id = k.id and b.estado in ('asistio','confirmada','agendada'))
  and not exists (select 1 from ti_perfil p where p.contact_id = k.id and p.silenciar_ia = true)
  and not exists (select 1 from ti_reactivacion r where r.contact_id = k.id)
order by (u.pidio) desc, u.ult_in desc;
