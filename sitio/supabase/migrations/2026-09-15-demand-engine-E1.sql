-- ════════════════════════════════════════════════════════════════════════════
-- SACS DEMAND ENGINE · Etapa 1 · Inteligencia
--
-- El esqueleto de lo que el motor SABE: señales crudas, consultas
-- normalizadas, problemas canónicos, páginas propias, oportunidades con su
-- predicción, competidores, problemas técnicos y las series de métricas.
--
-- ADITIVA e idempotente. Depende de la migración E0.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · SEÑALES ─────────────────────────────────────────────────────────────
-- Todo lo que entra al motor, crudo y con su procedencia. La regla que no se
-- negocia vive en la columna `naturaleza`: una inferencia jamás se presenta
-- como un hecho observado, y quien lea una cifra puede llegar a su fuente.
create table if not exists de_senales (
  id            uuid primary key default gen_random_uuid(),
  clave_idem    text not null unique,
  tipo_fuente   text not null,          -- gsc|ga4|crm|comunidad|serp|ia|competidor|manual
  fuente        text not null,          -- el conector concreto
  fuente_url    text,
  observada_at  timestamptz not null default now(),
  pais          text not null default 'MX',
  idioma        text not null default 'es',
  naturaleza    text not null,
  tipo_senal    text not null,          -- consulta|pregunta|queja|deseo|objecion|mencion|cambio|problema
  query_cruda   text,
  texto         text,
  payload       jsonb not null default '{}'::jsonb,
  confianza     numeric(3,2) not null default 0.7,
  query_id      uuid,
  cluster_id    uuid,
  icp           text[] not null default '{}',
  peso          numeric(6,2) not null default 1,
  procesada     boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint de_senales_naturaleza_ck check (naturaleza in ('observada','inferida','estimada','generada')),
  constraint de_senales_confianza_ck  check (confianza between 0 and 1)
);
create index if not exists de_senales_sin_procesar_idx on de_senales (created_at) where not procesada;
create index if not exists de_senales_cluster_idx on de_senales (cluster_id);
create index if not exists de_senales_fuente_idx on de_senales (fuente, observada_at desc);

-- ── 2 · CONSULTAS NORMALIZADAS ──────────────────────────────────────────────
-- Cuatro formas de preguntar lo mismo son cuatro filas aquí y UN problema allá.
-- El texto original se conserva siempre: es lo que la gente escribe de verdad y
-- vale para el contenido y para los prompts.
create table if not exists de_queries (
  id                 uuid primary key default gen_random_uuid(),
  texto_norm         text not null,
  texto_original     text not null,
  pais               text not null default 'MX',
  idioma             text not null default 'es',
  intent             text,               -- informacional|comercial|transaccional|navegacional|comparativa
  intent_comercial   numeric(3,2),
  embedding          vector(1536),
  cluster_id         uuid,
  volumen_estimado   int,
  volumen_naturaleza text,
  dificultad         numeric(5,2),
  posicion_actual    numeric(5,2),
  pagina_actual      text,
  clics_28d          int not null default 0,
  impresiones_28d    int not null default 0,
  ctr_28d            numeric(6,4),
  tendencia          text,               -- sube|baja|estable|nueva
  fuentes            text[] not null default '{}',
  senales_n          int not null default 1,
  primera_vez_at     timestamptz not null default now(),
  actualizada_at     timestamptz not null default now(),
  constraint de_queries_unica unique (texto_norm, pais, idioma)
);
create index if not exists de_queries_cluster_idx on de_queries (cluster_id);
create index if not exists de_queries_oportunidad_idx on de_queries (posicion_actual, impresiones_28d desc);

-- ── 3 · PROBLEMAS CANÓNICOS (la base de demanda) ────────────────────────────
create table if not exists de_clusters (
  id                       uuid primary key default gen_random_uuid(),
  problema_canonico        text not null,
  descripcion              text,
  categoria                text references de_taxonomia(id),
  subcategoria             text,
  etapa_journey            text,
  icp                      text[] not null default '{}',
  pais                     text[] not null default array['MX'],
  idioma                   text not null default 'es',
  embedding                vector(1536),
  naturaleza_dominante     text not null default 'inferida',
  frecuencia_estimada      int,
  tendencia                text,
  dificultad               numeric(5,2),
  -- Los ocho factores del score, cada uno 0-100 y con su evidencia aparte.
  relevancia_sacs          numeric(5,2),
  potencial_conversion     numeric(5,2),
  potencial_herramienta    numeric(5,2),
  potencial_contenido      numeric(5,2),
  potencial_red            numeric(5,2),
  valor_dato               numeric(5,2),
  potencial_distribucion_ia numeric(5,2),
  confianza                numeric(3,2) not null default 0.5,
  score_oportunidad        numeric(5,2),
  estado                   text not null default 'nuevo',   -- nuevo|activo|cubierto|descartado
  queries_n                int not null default 0,
  senales_n                int not null default 0,
  /** Quién responde hoy esta pregunta en buscadores y en IA. */
  capturado_por            jsonb not null default '{}'::jsonb,
  pagina_sacs              text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists de_clusters_score_idx on de_clusters (score_oportunidad desc nulls last);
create index if not exists de_clusters_categoria_idx on de_clusters (categoria);

-- Búsqueda semántica: con pocos miles de filas el escaneo secuencial alcanza,
-- pero el índice evita la sorpresa el día que sean cien mil.
do $$ begin
  if not exists (select 1 from pg_class where relname = 'de_clusters_embedding_idx') then
    execute 'create index de_clusters_embedding_idx on de_clusters using hnsw (embedding vector_cosine_ops)';
  end if;
exception when others then null; end $$;

alter table de_senales  drop constraint if exists de_senales_cluster_fk;
alter table de_senales  add  constraint de_senales_cluster_fk foreign key (cluster_id) references de_clusters(id) on delete set null;
alter table de_queries  drop constraint if exists de_queries_cluster_fk;
alter table de_queries  add  constraint de_queries_cluster_fk foreign key (cluster_id) references de_clusters(id) on delete set null;

-- ── 4 · PÁGINAS PROPIAS ─────────────────────────────────────────────────────
-- Las del repositorio y las que publica el motor, en el mismo inventario: el
-- enlazado interno y la canibalización no distinguen quién las escribió.
create table if not exists de_paginas (
  url            text primary key,
  tipo           text not null default 'estatica',  -- estatica|dinamica|herramienta
  origen         text not null default 'repo',      -- repo|motor
  cluster_id     uuid references de_clusters(id) on delete set null,
  titulo         text,
  h1             text,
  meta_desc      text,
  canonical      text,
  estado_http    int,
  indexable      boolean,
  indexada_gsc   boolean,
  palabras       int,
  enlaces_in     int not null default 0,
  enlaces_out    int not null default 0,
  huerfana       boolean not null default false,
  schema_tipos   text[] not null default '{}',
  cwv            jsonb,
  decay_estado   text,
  decay_detalle  jsonb,
  citabilidad    numeric(5,2),
  rastreada_at   timestamptz,
  publicada_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists de_paginas_cluster_idx on de_paginas (cluster_id);
create index if not exists de_paginas_decay_idx on de_paginas (decay_estado) where decay_estado is not null;

create table if not exists de_pagina_metricas (
  fecha        date not null,
  url          text not null,
  clics        int not null default 0,
  impresiones  int not null default 0,
  posicion     numeric(6,2),
  sesiones     int not null default 0,
  sesiones_ia  int not null default 0,
  leads        int not null default 0,
  demos        int not null default 0,
  primary key (fecha, url)
);

-- ── 5 · DATOS CRUDOS DE BUSCADORES Y ANALÍTICA ──────────────────────────────
-- Se guardan tal cual llegan. Reprocesar una regla no debe exigir volver a
-- pedirle a Google dieciséis meses de historia.
create table if not exists de_gsc_diario (
  fecha       date not null,
  query       text not null,
  pagina      text not null,
  pais        text not null default 'mex',
  dispositivo text not null default 'todos',
  clics       int not null default 0,
  impresiones int not null default 0,
  ctr         numeric(6,4),
  posicion    numeric(6,2),
  primary key (fecha, query, pagina, pais, dispositivo)
);
create index if not exists de_gsc_query_idx on de_gsc_diario (query, fecha desc);
create index if not exists de_gsc_pagina_idx on de_gsc_diario (pagina, fecha desc);

create table if not exists de_ga4_diario (
  fecha        date not null,
  pagina       text not null,
  canal        text not null default 'otro',
  pais         text not null default 'MX',
  sesiones     int not null default 0,
  usuarios     int not null default 0,
  fuente_medio text,
  conversiones jsonb not null default '{}'::jsonb,
  primary key (fecha, pagina, canal, pais)
);

-- ── 6 · OPORTUNIDADES ───────────────────────────────────────────────────────
create table if not exists de_oportunidades (
  id                  uuid primary key default gen_random_uuid(),
  clave_idem          text not null unique,
  tipo                text not null,
  cluster_id          uuid references de_clusters(id) on delete set null,
  titulo              text not null,
  descripcion         text,
  evidencia           jsonb not null default '{}'::jsonb,
  score               numeric(5,2),
  desglose            jsonb not null default '{}'::jsonb,
  pesos_version       int,
  estado              text not null default 'nueva',
  riesgo              text not null default 'LOW',
  esfuerzo            text,                -- S|M|L
  accion_recomendada  text,
  impacto_esperado    text,
  descubrimiento_tipo text,                -- marketing|producto|integracion|dato|red|marketplace|api|skill
  efectos             jsonb not null default '{}'::jsonb,
  url                 text,
  accion_id           uuid,
  resultado           jsonb,
  archivada_motivo    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint de_oportunidades_estado_ck check (estado in
    ('nueva','evaluando','aprobada','en_curso','publicada','medida','descartada','archivada'))
);
create index if not exists de_oportunidades_ranking_idx on de_oportunidades (estado, score desc nulls last);
create index if not exists de_oportunidades_cluster_idx on de_oportunidades (cluster_id);

-- Antes de actuar, decir qué se espera. Sin esto no hay forma de aprender:
-- todo resultado parece bueno cuando nadie escribió la apuesta.
create table if not exists de_predicciones (
  id             uuid primary key default gen_random_uuid(),
  oportunidad_id uuid references de_oportunidades(id) on delete cascade,
  accion_id      uuid,
  esperado       jsonb not null,
  confianza      numeric(3,2) not null default 0.5,
  horizonte_dias int not null default 90,
  evaluar_at     date not null,
  real           jsonb,
  evaluada_at    timestamptz,
  error_relativo numeric(8,4),
  veredicto      text,
  created_at     timestamptz not null default now()
);
create index if not exists de_predicciones_pendientes_idx on de_predicciones (evaluar_at) where evaluada_at is null;

-- ── 7 · COMPETIDORES ────────────────────────────────────────────────────────
create table if not exists de_competidores (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  dominio            text not null unique,
  tipo               text,             -- plataforma|erp|pos|herramienta_nicho|regional|marketplace
  categorias         text[] not null default '{}',
  mercados           text[] not null default array['MX'],
  descubierto_por    text,
  activo             boolean not null default true,
  sitemap_url        text,
  paginas_conocidas  int not null default 0,
  citas_ia           int not null default 0,
  notas              text,
  ultimo_snapshot_at timestamptz,
  created_at         timestamptz not null default now()
);

-- Solo CAMBIOS. Un informe de todo lo que un competidor tiene no lo lee nadie;
-- lo que importa es lo que hizo distinto esta semana.
create table if not exists de_competidor_snapshots (
  id            uuid primary key default gen_random_uuid(),
  clave_idem    text not null unique,
  competidor_id uuid references de_competidores(id) on delete cascade,
  fecha         date not null default current_date,
  tipo_cambio   text not null,
  url           text,
  resumen       text,
  evidencia     jsonb not null default '{}'::jsonb,
  relevancia    int not null default 50,
  created_at    timestamptz not null default now()
);
create index if not exists de_comp_snap_idx on de_competidor_snapshots (competidor_id, fecha desc);

-- ── 8 · PROBLEMAS TÉCNICOS Y ENLACES ────────────────────────────────────────
create table if not exists de_issues (
  id           uuid primary key default gen_random_uuid(),
  clave_idem   text not null unique,
  tipo         text not null,
  severidad    text not null default 'media',   -- critica|alta|media|baja
  url          text,
  detalle      jsonb not null default '{}'::jsonb,
  estado       text not null default 'abierto', -- abierto|en_cola|resuelto|ignorado
  accion_id    uuid,
  detectado_at timestamptz not null default now(),
  resuelto_at  timestamptz,
  visto_ultima timestamptz not null default now()
);
create index if not exists de_issues_abiertos_idx on de_issues (severidad, detectado_at desc) where estado = 'abierto';

create table if not exists de_enlaces (
  desde    text not null,
  hacia    text not null,
  anchor   text,
  tipo     text not null default 'cuerpo',
  visto_at timestamptz not null default now(),
  primary key (desde, hacia)
);

-- ── 9 · SERIES DE MÉTRICAS ──────────────────────────────────────────────────
-- Un formato largo a propósito: cada indicador se puede filtrar por dimensión
-- (país, ICP, plataforma, canal) sin agregar una columna cada vez.
create table if not exists de_metricas_diarias (
  fecha      date not null,
  metrica    text not null,
  dimension  text not null default 'total',
  valor_dim  text not null default 'todo',
  valor      numeric(14,4),
  detalle    jsonb not null default '{}'::jsonb,
  primary key (fecha, metrica, dimension, valor_dim)
);
create index if not exists de_metricas_serie_idx on de_metricas_diarias (metrica, fecha desc);

-- ── 10 · USO DE HERRAMIENTAS ────────────────────────────────────────────────
-- Se adelanta a la etapa 4 porque el contrato de herramientas ya la escribe:
-- mejor la tabla vacía que un registro que se traga en silencio.
create table if not exists de_herramienta_usos (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null,
  puerta     text not null default 'web',
  visitor_id text,
  contact_id uuid,
  ok         boolean not null default true,
  ms         int,
  resumen    text,
  created_at timestamptz not null default now()
);
create index if not exists de_herr_usos_idx on de_herramienta_usos (slug, created_at desc);

-- ── 11 · COMPETIDORES SEMILLA ───────────────────────────────────────────────
-- El punto de partida; el motor descubre el resto solo. Se separan las
-- plataformas grandes de las herramientas de nicho a propósito: en las
-- respuestas de IA compiten en preguntas distintas.
insert into de_competidores (nombre, dominio, tipo, categorias, mercados, descubierto_por) values
  ('Shopify',        'shopify.com',      'plataforma', array['ecommerce','punto_de_venta','catalogo'], array['MX','LATAM','GLOBAL'],'semilla'),
  ('Lightspeed',     'lightspeedhq.com', 'pos',        array['punto_de_venta','inventario','multi_tienda'], array['MX','GLOBAL'],'semilla'),
  ('Odoo',           'odoo.com',         'erp',        array['inventario','compras','contabilidad'], array['MX','LATAM'],'semilla'),
  ('NetSuite',       'netsuite.com',     'erp',        array['inventario','contabilidad','analitica'], array['MX','GLOBAL'],'semilla'),
  ('Cegid',          'cegid.com',        'erp',        array['multi_tienda','inventario','merchandising'], array['GLOBAL'],'semilla'),
  ('Cin7',           'cin7.com',         'erp',        array['inventario','mayoreo','pedidos'], array['GLOBAL'],'semilla'),
  ('Tiendanube',     'tiendanube.com',   'plataforma', array['ecommerce','catalogo'], array['MX','LATAM'],'semilla'),
  ('Bind ERP',       'bind.com.mx',      'regional',   array['inventario','contabilidad','punto_de_venta'], array['MX'],'semilla'),
  ('Contpaqi',       'contpaqi.com',     'regional',   array['contabilidad','inventario'], array['MX'],'semilla'),
  ('Microsip',       'microsip.com',     'regional',   array['inventario','punto_de_venta','contabilidad'], array['MX'],'semilla'),
  ('Alegra',         'alegra.com',       'regional',   array['contabilidad','inventario'], array['MX','LATAM'],'semilla'),
  ('Bsale',          'bsale.com.mx',     'regional',   array['punto_de_venta','inventario'], array['MX','LATAM'],'semilla'),
  ('Square',         'squareup.com',     'pos',        array['punto_de_venta','pedidos'], array['MX','GLOBAL'],'semilla'),
  ('Vtex',           'vtex.com',         'plataforma', array['ecommerce','marketplaces'], array['MX','LATAM'],'semilla'),
  ('Inventory Planner','inventory-planner.com','herramienta_nicho', array['pronostico','reposicion','compras'], array['GLOBAL'],'semilla'),
  ('Prediko',        'prediko.io',       'herramienta_nicho', array['pronostico','compras'], array['GLOBAL'],'semilla'),
  ('Faire',          'faire.com',        'marketplace', array['mayoreo','proveedores'], array['GLOBAL'],'semilla'),
  ('Brandboom',      'brandboom.com',    'herramienta_nicho', array['mayoreo','catalogo'], array['GLOBAL'],'semilla'),
  ('JOOR',           'jooraccess.com',   'herramienta_nicho', array['mayoreo','catalogo'], array['GLOBAL'],'semilla'),
  ('Botika',         'botika.io',        'herramienta_nicho', array['modelos_ia','fotografia'], array['GLOBAL'],'semilla'),
  ('Vmake',          'vmake.ai',         'herramienta_nicho', array['modelos_ia','fotografia','video'], array['GLOBAL'],'semilla'),
  ('Wati',           'wati.io',          'herramienta_nicho', array['whatsapp','atencion_cliente'], array['MX','GLOBAL'],'semilla'),
  ('Treble',         'treble.ai',        'herramienta_nicho', array['whatsapp','marketing'], array['MX','LATAM'],'semilla'),
  ('Kommo',          'kommo.com',        'herramienta_nicho', array['crm','whatsapp'], array['MX','LATAM'],'semilla')
on conflict (dominio) do nothing;

-- ── 12 · RLS ────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'de_senales','de_queries','de_clusters','de_paginas','de_pagina_metricas',
    'de_gsc_diario','de_ga4_diario','de_oportunidades','de_predicciones',
    'de_competidores','de_competidor_snapshots','de_issues','de_enlaces',
    'de_metricas_diarias','de_herramienta_usos'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
