-- Brief por etapas de un proyecto (primer caso: ecommerce de Ruben's).
--
-- El cliente entra por un LINK con token — sin cuenta, sin contraseña. El token
-- ES la llave, por eso se genera largo y aleatorio y no se deriva de nada
-- adivinable (nombre, folio de cotización, fecha).
--
-- Tres tablas y nada más: el brief (la portada firmable), sus etapas (una fila
-- por etapa, con las respuestas en jsonb porque el cuestionario va a cambiar
-- entre proyectos) y la bitácora, que es lo que de verdad da control: quién
-- hizo qué y cuándo, sin tener que reconstruirlo de los timestamps.

create table if not exists proyecto_brief (
  id            uuid primary key default gen_random_uuid(),
  token         text unique not null,
  cliente       text not null,
  proyecto      text not null,
  contacto      text,
  email         text,
  whatsapp      text,
  quote_numero  text,
  quote_id      uuid,
  -- Alcance, montos, fechas y responsables congelados al firmar: si mañana se
  -- edita la cotización, el brief firmado no cambia bajo los pies del cliente.
  resumen       jsonb not null default '{}'::jsonb,
  firmado_por    text,
  firmado_puesto text,
  firmado_email  text,
  firmado_at     timestamptz,
  firmado_ip     text,
  firma_png      text,
  vistas         integer not null default 0,
  ultima_vista_at timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists proyecto_etapa (
  id          uuid primary key default gen_random_uuid(),
  brief_id    uuid not null references proyecto_brief(id) on delete cascade,
  clave       text not null,
  orden       integer not null,
  -- bloqueada → abierta → enviada → (cambios → enviada)* → aprobada
  estado      text not null default 'bloqueada',
  respuestas  jsonb not null default '{}'::jsonb,
  enviada_at  timestamptz,
  aprobada_at timestamptz,
  nota_sacs   text,
  updated_at  timestamptz not null default now(),
  unique (brief_id, clave)
);

create table if not exists proyecto_bitacora (
  id          uuid primary key default gen_random_uuid(),
  brief_id    uuid not null references proyecto_brief(id) on delete cascade,
  etapa_clave text,
  actor       text not null,   -- 'cliente' | 'sacs'
  accion      text not null,
  detalle     text,
  at          timestamptz not null default now()
);

create index if not exists proyecto_etapa_brief_idx    on proyecto_etapa (brief_id, orden);
create index if not exists proyecto_bitacora_brief_idx on proyecto_bitacora (brief_id, at desc);
