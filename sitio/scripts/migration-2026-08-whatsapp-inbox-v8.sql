-- Inbox WhatsApp v8: fluidez + equipo
-- 28) No-leídos POR USUARIO (abrir un chat ajeno ya no se lo "lee" al dueño)
create table if not exists wa_lecturas (
  conversation_id uuid not null references wa_conversaciones(id) on delete cascade,
  user_id uuid not null,
  leido_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
-- 5) ventana 24h por conversación sin recalcular desde mensajes
alter table wa_conversaciones
  add column if not exists ultimo_entrante_at timestamptz,
  add column if not exists ultimo_saliente_at timestamptz,
  add column if not exists alerta text;            -- 11) "Número no alcanzable" etc.
update wa_conversaciones c set
  ultimo_entrante_at = (select max(coalesce(enviado_at, created_at)) from wa_mensajes m where m.conversation_id=c.id and m.direccion='entrante' and m.tipo<>'reaction'),
  ultimo_saliente_at = (select max(coalesce(enviado_at, created_at)) from wa_mensajes m where m.conversation_id=c.id and m.direccion='saliente' and m.tipo<>'reaction')
where ultimo_entrante_at is null;
-- 3/4) envíos programados y recordatorios "si no contesta"
create table if not exists wa_programados (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references wa_conversaciones(id) on delete cascade,
  tipo text not null check (tipo in ('envio','recordatorio')),
  ejecutar_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,      -- envio: {texto|media_url,clase,nombre,caption,cita}; recordatorio: {desde, nota}
  autor_id uuid, autor text,
  estado text not null default 'pendiente' check (estado in ('pendiente','hecho','cancelado','fallido')),
  resultado text,
  created_at timestamptz not null default now(),
  ejecutado_at timestamptz
);
create index if not exists wa_programados_pend on wa_programados (ejecutar_at) where estado='pendiente';
-- 6) presencia: quién está viendo/escribiendo en el hilo
create table if not exists wa_presencia (
  conversation_id uuid not null references wa_conversaciones(id) on delete cascade,
  user_id uuid not null,
  nombre text,
  visto_at timestamptz not null default now(),
  escribiendo_at timestamptz,
  primary key (conversation_id, user_id)
);
-- 23) vistas personales vs compartidas
alter table crm_vistas
  add column if not exists owner_id uuid,
  add column if not exists compartida boolean not null default true;
-- 19) notas por contacto (no solo por hilo)
alter table wa_notas add column if not exists contact_id uuid, add column if not exists menciones uuid[];
update wa_notas n set contact_id = c.contact_id from wa_conversaciones c where c.id = n.conversation_id and n.contact_id is null;
create index if not exists wa_notas_contact on wa_notas (contact_id);
-- 29) marca de re-sync
alter table wa_config add column if not exists resync_at timestamptz;
create or replace function wa_no_leidos_por_usuario(uid uuid)
returns table(conversation_id uuid, n bigint) language sql stable as $$
  select l.conversation_id, count(m.id)
  from wa_lecturas l
  left join wa_mensajes m on m.conversation_id = l.conversation_id
    and m.direccion = 'entrante' and m.tipo <> 'reaction' and m.created_at > l.leido_at
  where l.user_id = uid
  group by l.conversation_id;
$$;
