-- Biblioteca de documentos del CRM + envíos (22-sep-2026).
--
-- Pedido del dueño: los documentos que se crean (p. ej. la presentación del
-- Programa de flujos) se guardan en Configuración → Documentos cuando él dice
-- «guárdalo en el CRM», y al mandar un correo desde la ficha de una cuenta se
-- eligen de los ACTIVOS.
--
-- crm_documentos          — lo que se puede adjuntar (liga, PDF, presentación).
-- crm_documento_envios    — cada vez que un documento salió en un correo, a
--                           quién y de qué cuenta. La liga del correo apunta a
--                           /d/<envio_id>, que marca la apertura y redirige:
--                           así la biblioteca puede decir «6 cuentas · 4 abrieron».

create table if not exists crm_documentos (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  descripcion  text,
  tipo         text not null default 'liga' check (tipo in ('presentacion', 'pdf', 'liga')),
  url          text not null,
  miniatura    text,
  vence        date,
  activo       boolean not null default true,
  creado_por   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create table if not exists crm_documento_envios (
  id            uuid primary key default gen_random_uuid(),
  documento_id  uuid not null references crm_documentos(id) on delete cascade,
  company_id    uuid references companies(id) on delete set null,
  contact_id    uuid references contacts(id) on delete set null,
  para          text,
  enviado_por   text,
  enviado_at    timestamptz not null default now(),
  abierto_at    timestamptz,
  aperturas     integer not null default 0
);

create index if not exists crm_documento_envios_doc_idx on crm_documento_envios (documento_id);
create index if not exists crm_documento_envios_company_idx on crm_documento_envios (company_id);

-- Mismo modelo que el resto del CRM: solo el servidor (service role) lee y escribe.
alter table crm_documentos enable row level security;
alter table crm_documento_envios enable row level security;
