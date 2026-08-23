-- Inbox de WhatsApp (híbrido Kapso): espejo de conversaciones/mensajes,
-- plantillas Meta, masivos con estado por destinatario, y config del embed.
--
-- El chat se ve y se responde en el inbox embebido de Kapso (iframe); estas
-- tablas son el ESPEJO que alimentan los webhooks, para la ficha 360, el
-- timeline (activities) y los reportes de masivos. Aplicar a mano, como todas.

create table if not exists wa_conversaciones (
  id uuid primary key default gen_random_uuid(),
  kapso_conversation_id text unique,
  telefono text not null,                          -- E.164 (+52...)
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  estado text not null default 'active',           -- active | ended
  ultimo_mensaje_at timestamptz not null default now(),
  ultimo_mensaje_texto text,
  ultima_direccion text,                           -- entrante | saliente
  created_at timestamptz not null default now()
);
create index if not exists idx_wa_conv_telefono on wa_conversaciones(telefono);
create index if not exists idx_wa_conv_contact  on wa_conversaciones(contact_id);
create index if not exists idx_wa_conv_company  on wa_conversaciones(company_id);

create table if not exists wa_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references wa_conversaciones(id) on delete cascade,
  kapso_message_id text not null unique,           -- dedup: Kapso entrega at-least-once
  direccion text not null check (direccion in ('entrante', 'saliente')),
  tipo text,                                       -- text | image | audio | document | ...
  cuerpo text,
  transcript text,                                 -- Kapso transcribe las notas de voz
  media_url text,
  status text not null default 'received',         -- received | sent | delivered | read | failed
  error text,
  enviado_at timestamptz,                          -- timestamp del mensaje según Kapso
  created_at timestamptz not null default now()
);
create index if not exists idx_wa_msj_conv on wa_mensajes(conversation_id, created_at);

create table if not exists wa_plantillas (
  id uuid primary key default gen_random_uuid(),
  meta_template_id text,
  nombre text not null,                            -- [a-z0-9_], el nombre en Meta
  idioma text not null default 'es_MX',
  categoria text not null default 'UTILITY',       -- UTILITY | MARKETING | AUTHENTICATION
  cuerpo text not null,
  header text,
  footer text,
  botones jsonb,
  variables int not null default 0,                -- cuántos {{n}} tiene el cuerpo
  status text not null default 'PENDING',          -- PENDING | APPROVED | REJECTED
  rechazo_motivo text,
  created_at timestamptz not null default now(),
  unique (nombre, idioma)
);

create table if not exists wa_broadcasts (
  id uuid primary key default gen_random_uuid(),
  kapso_broadcast_id text unique,
  nombre text not null,
  plantilla_nombre text,
  template_id text,                                -- id de la plantilla en Kapso/Meta
  status text not null default 'borrador',         -- borrador | programado | enviando | enviado | fallido | detenido
  total int not null default 0,
  enviados int not null default 0,
  entregados int not null default 0,
  leidos int not null default 0,
  respondidos int not null default 0,
  fallidos int not null default 0,
  creado_por text,
  last_synced_at timestamptz,                      -- throttle del polling on-demand (60 s)
  sent_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists wa_broadcast_destinatarios (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references wa_broadcasts(id) on delete cascade,
  telefono text not null,                          -- E.164
  -- Congelados al crear el masivo: si el contacto cambia de empresa después,
  -- el reporte sigue diciendo a quién se le mandó ENTONCES.
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  params jsonb,                                    -- template_components por destinatario
  status text not null default 'pending',          -- pending | sent | failed | suppressed
  delivered_at timestamptz,
  read_at timestamptz,
  responded_at timestamptz,
  error_message text,
  unique (broadcast_id, telefono)
);
create index if not exists idx_wa_bd_broadcast on wa_broadcast_destinatarios(broadcast_id, status);

-- Singleton: el token del embed SOLO viene en la respuesta de creación de
-- Kapso; si se pierde hay que crear otro embed. Por eso se persiste aquí y
-- no en una env (expira y debe poder rotar sin deploy).
create table if not exists wa_config (
  id int primary key default 1 check (id = 1),
  embed_token text,
  embed_url text,
  embed_expires_at timestamptz,
  webhook_registrado_at timestamptz,
  updated_at timestamptz not null default now()
);
