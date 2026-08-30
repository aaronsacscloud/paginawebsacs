-- Contador de interacción por contacto: cuánto le escribimos y cuánto responde.
--
-- Aplica a leads, clientes y a quien sea. Hoy esta información existe pero está
-- desparramada en email_sends, email_messages y wa_mensajes: para saber si un
-- contacto nos hace caso hay que cruzar tres tablas a mano, así que en la
-- práctica nadie lo mira. Aquí queda en su ficha, listo para filtrar, ordenar y
-- meter en los avisos.
--
-- La distinción que importa y que casi nadie hace: **abrir no es leer**. Un
-- pixel que carga una vez y ya es alguien que vio el asunto en la vista previa;
-- quien vuelve a abrir el correo, o lo deja abierto, es alguien que lo leyó.
begin;

alter table contacts
  add column if not exists eng_emails_enviados   integer not null default 0,
  add column if not exists eng_emails_abiertos   integer not null default 0,
  add column if not exists eng_emails_rapidos    integer not null default 0,
  add column if not exists eng_emails_leidos     integer not null default 0,
  add column if not exists eng_emails_clic       integer not null default 0,
  add column if not exists eng_emails_respondidos integer not null default 0,
  add column if not exists eng_wa_enviados       integer not null default 0,
  add column if not exists eng_wa_respondidos    integer not null default 0,
  add column if not exists eng_ultimo_abierto_at timestamptz,
  add column if not exists eng_actualizado_at    timestamptz;

comment on column contacts.eng_emails_rapidos is
  'Abiertos en menos de 15 minutos desde el envío: lo estaba esperando, o el asunto le pegó.';
comment on column contacts.eng_emails_leidos is
  'Abiertos MÁS DE UNA VEZ o con el correo abierto más de 30 s. Abrir no es leer: un pixel que carga una vez puede ser la vista previa del cliente de correo.';

create index if not exists idx_contacts_eng_abiertos on contacts (eng_emails_abiertos desc) where eng_emails_abiertos > 0;

-- ── El recálculo, para un contacto o para todos ────────────────────────────
create or replace function public.recalcular_engagement(p_contact uuid default null)
returns integer language plpgsql as $$
declare n integer;
begin
  with e as (
    select s.contact_id,
      count(*)                                                                    enviados,
      count(*) filter (where s.first_opened_at is not null)                        abiertos,
      count(*) filter (where s.first_opened_at is not null
                         and s.first_opened_at - coalesce(s.sent_at, s.created_at) < interval '15 minutes') rapidos,
      -- Leyó: volvió a abrirlo, o lo tuvo abierto más de medio minuto.
      count(*) filter (where coalesce(s.open_count, 0) >= 2
                         or (s.opened_at is not null and s.first_opened_at is not null
                             and s.opened_at - s.first_opened_at > interval '30 seconds')) leidos,
      count(*) filter (where s.clicked_at is not null)                             clic,
      max(s.first_opened_at)                                                       ultimo
    from email_sends s
    where s.contact_id is not null and (p_contact is null or s.contact_id = p_contact)
    group by 1),
  -- Respuestas de correo: un entrante ligado a un envío nuestro.
  r as (
    select s.contact_id, count(distinct m.id) n
    from email_messages m
    join email_sends s on s.id = m.send_id
    where m.direccion = 'entrante' and s.contact_id is not null
      and (p_contact is null or s.contact_id = p_contact)
    group by 1),
  w as (
    select c.contact_id,
      count(*) filter (where m.direccion = 'saliente') enviados,
      count(*) filter (where m.direccion = 'entrante') respondidos
    from wa_conversaciones c
    join wa_mensajes m on m.conversation_id = c.id and m.borrado_at is null
    where c.contact_id is not null and (p_contact is null or c.contact_id = p_contact)
    group by 1)
  update contacts ct set
    eng_emails_enviados    = coalesce(e.enviados, 0),
    eng_emails_abiertos    = coalesce(e.abiertos, 0),
    eng_emails_rapidos     = coalesce(e.rapidos, 0),
    eng_emails_leidos      = coalesce(e.leidos, 0),
    eng_emails_clic        = coalesce(e.clic, 0),
    eng_emails_respondidos = coalesce(r.n, 0),
    eng_wa_enviados        = coalesce(w.enviados, 0),
    eng_wa_respondidos     = coalesce(w.respondidos, 0),
    eng_ultimo_abierto_at  = e.ultimo,
    eng_actualizado_at     = now()
  from (select ct2.id from contacts ct2 where p_contact is null or ct2.id = p_contact) base
  left join e on e.contact_id = base.id
  left join r on r.contact_id = base.id
  left join w on w.contact_id = base.id
  where ct.id = base.id;

  get diagnostics n = row_count;
  return n;
end $$;

-- ── Se mantiene solo ───────────────────────────────────────────────────────
-- El webhook del proveedor marca aperturas y clics; el trigger recalcula ese
-- contacto. Va AFTER y por fila: son decenas de eventos por hora, no miles.
create or replace function public.trg_engagement_email()
returns trigger language plpgsql as $$
begin
  if new.contact_id is not null then perform public.recalcular_engagement(new.contact_id); end if;
  return null;
end $$;

drop trigger if exists trg_eng_email on email_sends;
create trigger trg_eng_email after insert or update of first_opened_at, opened_at, clicked_at, open_count
  on email_sends for each row execute function public.trg_engagement_email();

commit;
