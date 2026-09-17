-- DEMAND ENGINE · el Índice Sacs de Retail de Moda.
--
-- Es el único activo del motor que ningún competidor puede copiar: sale de la
-- operación real de las tiendas que usan Sacs. Un artículo lo escribe
-- cualquiera; este dato no existe en ningún otro lado.
--
-- ⚠️ SE CALCULA SIEMPRE, SE PUBLICA SOLO SI EL DUEÑO LO DICE.
--
-- `publicado` arranca en FALSE y ninguna rutina lo cambia: se prende a mano.
-- La razón no es técnica. Los Términos y condiciones traen cláusula de
-- confidencialidad sobre «información revelada durante el cumplimiento de este
-- Acuerdo», y aunque un agregado anónimo de 91 empresas no identifica a nadie
-- —ni es dato personal bajo la LFPDPPP—, publicar estadística derivada de la
-- operación de los clientes es una decisión del dueño, no del sistema. Para
-- abrirla hace falta una cláusula que lo permita y, idealmente, una salida para
-- quien no quiera estar.

create table if not exists de_indice (
  id            bigserial primary key,
  -- Una edición por corte. La clave natural evita ediciones duplicadas.
  edicion       text not null unique,          -- '2026-09' o '2026-W38'
  corte         date not null,
  -- Cuántas empresas OPERANDO entraron. Es el número que hay que enseñar
  -- junto a cualquier cifra: sin él, un porcentaje no se puede juzgar.
  n_empresas    integer not null,
  metricas      jsonb not null,
  -- Cómo se definió «operando» en esta edición. Se guarda porque si la
  -- definición cambia, las ediciones dejan de ser comparables y hay que poder
  -- notarlo en vez de descubrirlo tarde.
  definicion    jsonb not null,
  publicado     boolean not null default false,
  publicado_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists de_indice_publicado_idx on de_indice (corte desc) where publicado;

alter table de_indice enable row level security;

comment on table de_indice is
  'Índice Sacs de Retail de Moda. Agregados anónimos (mínimo 20 empresas por cifra). `publicado` se prende A MANO: ver la cláusula de confidencialidad de los Términos.';
comment on column de_indice.publicado is
  'NINGUNA rutina automática pone esto en true. Es decisión del dueño.';
