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
alter table wa_config add column if not exists catalog_id text; alter table wa_config add column if not exists ubicaciones jsonb default '[]'::jsonb;
-- Etapa B: plantillas con media, calidad, mapa de variables
alter table wa_plantillas add column if not exists header_tipo text default 'TEXT', add column if not exists header_media_url text, add column if not exists header_handle text, add column if not exists calidad text, add column if not exists calidad_at timestamptz, add column if not exists variables_map jsonb, add column if not exists status_at timestamptz, add column if not exists ejemplos jsonb, add column if not exists tipo_especial text;
-- Etapa C: llamadas de WhatsApp
create table if not exists wa_llamadas (
  id uuid primary key default gen_random_uuid(),
  call_id text unique not null,
  conversation_id uuid references wa_conversaciones(id) on delete set null,
  telefono text not null,
  direccion text not null check (direccion in ('entrante','saliente')),
  estado text not null default 'timbrando',   -- timbrando | aceptada | rechazada | terminada | fallida | perdida
  sdp_offer text, sdp_answer text,
  atendida_por uuid, atendida_por_nombre text,
  started_at timestamptz not null default now(), answered_at timestamptz, ended_at timestamptz,
  duracion_seg int, motivo text, payload jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists wa_llamadas_conv on wa_llamadas (conversation_id, started_at desc);
create index if not exists wa_llamadas_estado on wa_llamadas (estado) where estado='timbrando';
alter table wa_config add column if not exists webhook_meta_id text, add column if not exists calling jsonb;
-- Etapa F: varios números + salud
create table if not exists wa_numeros (
  phone_number_id text primary key,
  display_phone_number text, nombre text, business_account_id text,
  activo boolean not null default true, es_default boolean not null default false,
  webhook_id text, calidad text, tier text, salud jsonb, salud_at timestamptz,
  created_at timestamptz not null default now()
);
alter table wa_conversaciones add column if not exists phone_number_id text;
alter table wa_config add column if not exists salud jsonb, add column if not exists salud_at timestamptz, add column if not exists kapso_customer_id text;
-- L1: catálogo configurable de etapas del ciclo de vida (encima de contacts.lifecycle_stage)
create table if not exists crm_lifecycle_etapas (
  id text primary key,
  nombre text not null,
  emoji text not null default '·',
  color text not null default '#9B8CFA',
  orden int not null default 0,
  tipo text not null default 'abierta' check (tipo in ('abierta','ganada','perdida')),
  sugerencias jsonb not null default '[]'::jsonb,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
insert into crm_lifecycle_etapas (id, nombre, emoji, color, orden, tipo) values
  ('suscriptor','Suscriptor','📰','#6B7280',1,'abierta'),
  ('lead','Nuevo lead','✨','#6B7280',2,'abierta'),
  ('lead_calificado','Calificado','✅','#5B4BD6',3,'abierta'),
  ('oportunidad','Oportunidad','🎯','#2C5FC4',4,'abierta'),
  ('cliente','Cliente','💚','#1E8A63',5,'ganada'),
  ('evangelista','Evangelista','⭐','#1E8A63',6,'ganada'),
  ('churned','Perdido','🌙','#C0554E',7,'perdida')
on conflict (id) do nothing;
alter table crm_vistas add column if not exists compartida_con uuid[];
-- El CHECK fijo impedía etapas personalizadas. La validación pasa a FK contra el catálogo.
alter table contacts drop constraint if exists contacts_lifecycle_stage_check;
alter table contacts add constraint contacts_lifecycle_stage_fk
  foreign key (lifecycle_stage) references crm_lifecycle_etapas(id);
update contacts set lifecycle_stage='demo_agendada_qa' where id='fe715b87-ba50-4f8b-acf7-2f6510fd2607';
-- Vistas predeterminadas del inbox (del equipo, editables/borrables como cualquiera)
insert into crm_vistas (tabla, nombre, config, compartida, orden)
select 'wa_inbox', v.nombre, v.config::jsonb, true, v.orden from (values
 ('Sin respuesta +4 h', '{"emoji":"⏰","modo":"con_conversacion","logica":"AND","descripcion":"El cliente habló y nadie ha contestado en más de 4 horas","condiciones":[{"campo":"sin_respuesta","op":"hace_mas","valor":"4 h"}]}', 1),
 ('Ventana por cerrar', '{"emoji":"⏳","modo":"con_conversacion","logica":"AND","descripcion":"Quedan menos de 4 h para poder escribir libre; después solo plantilla","condiciones":[{"campo":"ventana","op":"es","valor":"por_cerrar"}]}', 2),
 ('Renovaciones 30 días', '{"emoji":"📅","modo":"todas","logica":"AND","descripcion":"Clientes cuya renovación cae en los próximos 30 días (incluye sin conversación)","condiciones":[{"campo":"renovacion","op":"en_menos","valor":"30 días"}]}', 3),
 ('Clientes sin vender 7 días', '{"emoji":"😴","modo":"todas","logica":"AND","descripcion":"Cuentas conectadas a SACS sin ventas en una semana: llámales antes de que se enfríen","condiciones":[{"campo":"etapa","op":"es","valor":"cliente"},{"campo":"dias_sin_venta","op":"mayor","valor":"7"}]}', 4),
 ('Cuentas en riesgo', '{"emoji":"🚨","modo":"todas","logica":"AND","descripcion":"Salud menor a 50: renovación vencida, sin uso o con tickets estancados","condiciones":[{"campo":"salud","op":"menor","valor":"50"}]}', 5),
 ('Leads nuevos de la semana', '{"emoji":"✨","modo":"todas","logica":"AND","descripcion":"Contactos creados en los últimos 7 días en etapa de lead","condiciones":[{"campo":"etapa","op":"es","valor":"lead"},{"campo":"creado","op":"hace_menos","valor":"7 días"}]}', 6),
 ('Sin dueño asignado', '{"emoji":"🙋","modo":"todas","logica":"AND","descripcion":"Contactos activos que nadie del equipo tiene a su cargo","condiciones":[{"campo":"dueno","op":"es","valor":"nadie"},{"campo":"etapa","op":"no_es","valor":"churned"}]}', 7)
) as v(nombre, config, orden)
where not exists (select 1 from crm_vistas x where x.tabla='wa_inbox' and x.nombre=v.nombre);
