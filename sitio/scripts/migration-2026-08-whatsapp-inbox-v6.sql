-- Inbox v6 "WOW" (paridad de front con sacs_inbox). Aplicar a mano.

-- v6a · Secciones de vistas del sidebar (las vistas viven en crm_vistas
-- tabla='wa_inbox'; su config jsonb gana seccion_id/emoji/modo/logica/condiciones)
create table if not exists wa_inbox_secciones (
  id uuid primary key default gen_random_uuid(),
  emoji text not null default '📁',
  nombre text not null,
  descripcion text,
  orden int not null default 100,
  created_at timestamptz not null default now()
);

-- v6b · Metadata de mensajes (reacciones, transcripciones extra, etc.)
alter table wa_mensajes add column if not exists metadata jsonb;

-- v6c · wa_respuestas → snippets completos (los atajos "/" siguen igual)
alter table wa_respuestas
  add column if not exists titulo text,
  add column if not exists categoria text,
  add column if not exists header text,
  add column if not exists footer text,
  add column if not exists botones jsonb,
  add column if not exists media_url text,
  add column if not exists media_tipo text,
  add column if not exists usage_count int not null default 0;

-- v6d · Biblioteca de medios del inbox (bucket Storage: wa-media)
create table if not exists wa_media_files (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  categoria text,
  path text not null,
  tipo text not null,              -- image | video | audio | document
  mime text,
  bytes int,
  usage_count int not null default 0,
  created_at timestamptz not null default now()
);
