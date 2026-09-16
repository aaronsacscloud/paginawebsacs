-- ════════════════════════════════════════════════════════════════════════════
-- SACS DEMAND ENGINE · Etapa 2 · el contenido que publica el motor
--
-- El contenido vive en la BASE y se sirve dinámico, no como archivos del
-- repositorio. Tres razones, todas de este proyecto:
--
--  1. La regla de la casa es «commit siempre, push solo cuando el dueño lo
--     diga». Si publicar exigiera un push, el motor no podría publicar solo, y
--     entonces no es autónomo: es un generador de borradores.
--  2. Cada despliegue cuesta y, medido aquí, DETIENE los crons varios minutos.
--     Un motor que publica a diario dispararía un build a diario.
--  3. Lo que se publica se tiene que poder REVERTIR en un clic. Con archivos
--     eso es un commit de reversión y otro build; con filas es un update.
--
-- Las páginas escritas a mano siguen siendo estáticas. Esto es solo para lo que
-- el motor produce.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists de_contenido (
  id              uuid primary key default gen_random_uuid(),
  clave_idem      text not null unique,
  oportunidad_id  uuid references de_oportunidades(id) on delete set null,
  cluster_id      uuid references de_clusters(id) on delete set null,
  tipo            text not null,          -- articulo|landing|comparativa|programatica|definicion|reporte
  /** La ruta donde vive: /recursos, /comparar, /software-para. */
  seccion         text not null default 'recursos',
  slug            text not null,
  titulo          text not null,
  h1              text,
  meta_desc       text,
  /** El brief: lo que hay que responder y por qué. Se conserva después de
   *  publicar porque es contra lo que se audita el resultado. */
  brief           jsonb not null default '{}'::jsonb,
  /** El cuerpo son BLOQUES TIPADOS, no markdown ni HTML.
   *  Decisión deliberada: un cuerpo estructurado se puede convertir en schema
   *  (unas preguntas frecuentes se vuelven FAQPage, unos pasos se vuelven
   *  HowTo) y se renderiza sin ejecutar marcado ajeno. Markdown obligaría a
   *  parsear y sanear texto que escribió un modelo, para terminar con menos. */
  cuerpo          jsonb not null default '[]'::jsonb,
  schema_json     jsonb,
  estado          text not null default 'brief',
  auditorias      jsonb not null default '{}'::jsonb,
  version         int  not null default 1,
  autor           text,
  cta_tipo        text,
  idioma          text not null default 'es',
  pais            text not null default 'MX',
  /** Métricas de la página, para medir a 30/60/90 días contra lo predicho. */
  vistas          int not null default 0,
  publicado_at    timestamptz,
  retirado_at     timestamptz,
  actualizado_at  timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint de_contenido_estado_ck check (estado in
    ('brief','borrador','auditando','aprobado','publicado','refrescar','retirado','rechazado')),
  constraint de_contenido_ruta_unica unique (seccion, slug)
);
create index if not exists de_contenido_publicado_idx on de_contenido (seccion, slug) where estado = 'publicado';
create index if not exists de_contenido_estado_idx on de_contenido (estado, actualizado_at desc);

-- Cada publicación guarda de dónde viene. Es lo que hace que revertir sea un
-- update y no una arqueología.
create table if not exists de_contenido_versiones (
  id           uuid primary key default gen_random_uuid(),
  contenido_id uuid not null references de_contenido(id) on delete cascade,
  version      int not null,
  titulo       text,
  cuerpo       jsonb,
  brief        jsonb,
  auditorias   jsonb,
  motivo       text,
  creada_por   text,
  created_at   timestamptz not null default now(),
  unique (contenido_id, version)
);

alter table de_contenido enable row level security;
alter table de_contenido_versiones enable row level security;

-- El inventario de páginas no distingue quién las escribió: el enlazado
-- interno y la canibalización tampoco.
create or replace function de_sincronizar_paginas_publicadas()
returns int language plpgsql as $$
declare n int;
begin
  insert into de_paginas (url, tipo, origen, cluster_id, titulo, h1, meta_desc, indexable, publicada_at, updated_at)
  select 'https://www.sacscloud.com/' || c.seccion || '/' || c.slug || '/',
         'dinamica', 'motor', c.cluster_id, c.titulo, coalesce(c.h1, c.titulo), c.meta_desc,
         true, c.publicado_at, now()
  from de_contenido c
  where c.estado = 'publicado'
  on conflict (url) do update set
    titulo = excluded.titulo, h1 = excluded.h1, meta_desc = excluded.meta_desc,
    cluster_id = excluded.cluster_id, origen = 'motor', updated_at = now();
  get diagnostics n = row_count;

  -- Lo retirado deja de figurar como página viva.
  delete from de_paginas p
  where p.origen = 'motor'
    and not exists (
      select 1 from de_contenido c
      where c.estado = 'publicado'
        and p.url = 'https://www.sacscloud.com/' || c.seccion || '/' || c.slug || '/');
  return n;
end;
$$;
