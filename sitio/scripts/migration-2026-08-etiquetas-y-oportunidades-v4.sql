-- ═══ Etiquetas transversales + oportunidades v4 ═══
--
-- ETIQUETAS: una sola tabla de etiquetas para TODO el CRM (clientes,
-- oportunidades y suscripciones) en vez de tres listas paralelas. Si cada
-- sección tuviera las suyas, "Joyería" existiría tres veces escrita de tres
-- formas y ningún filtro cruzaría — que es justo lo que hace inútil etiquetar.
-- La asignación es polimórfica (entidad + entidad_id) porque el catálogo es
-- compartido pero lo etiquetado no.
--
-- No hay FK a companies/deals/subscriptions a propósito: una sola tabla no
-- puede apuntar a tres padres. La limpieza de asignaciones huérfanas se hace
-- por barrido, no por cascada — y una asignación huérfana no rompe nada, solo
-- ocupa una fila.

create table if not exists crm_etiquetas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  color      text not null default '#4B7BE5',
  descripcion text,
  created_at timestamptz not null default now()
);
-- Sin duplicados por mayúsculas/espacios: "VIP", "vip" y "Vip " son la misma.
create unique index if not exists crm_etiquetas_nombre_idx on crm_etiquetas (lower(btrim(nombre)));

create table if not exists crm_etiqueta_asignaciones (
  id          uuid primary key default gen_random_uuid(),
  etiqueta_id uuid not null references crm_etiquetas(id) on delete cascade,
  entidad     text not null check (entidad in ('company', 'deal', 'subscription')),
  entidad_id  uuid not null,
  created_at  timestamptz not null default now()
);
create unique index if not exists crm_etiqueta_asig_unica on crm_etiqueta_asignaciones (etiqueta_id, entidad, entidad_id);
create index if not exists crm_etiqueta_asig_entidad_idx on crm_etiqueta_asignaciones (entidad, entidad_id);

alter table crm_etiquetas enable row level security;
alter table crm_etiqueta_asignaciones enable row level security;

-- ═══ Oportunidades v4 ═══

-- PRÓXIMO PASO. "Un trato sin siguiente paso agendado es un trato muerto" — la
-- regla de Pipedrive. No basta con saber cuándo se enfrió: hay que ver de
-- antemano cuál no tiene nada agendado.
alter table deals add column if not exists proximo_paso     text;
alter table deals add column if not exists proximo_paso_at  date;

-- RETENCIÓN: una oportunidad puede ser NEGATIVA (evitar que se caiga un
-- cliente). El valor es el MRR en riesgo, y NO se suma al pipeline de venta:
-- retener no es vender, y mezclarlos infla el pronóstico.
--   categoria ahora admite: nuevo | upsell | renovacion | retencion

-- Umbral de estancamiento POR ETAPA (el "rotting" configurable de Pipedrive).
-- Vive en el JSON de stages de pipelines: stages[].rot_dias. Nada que alterar
-- aquí; queda anotado para no buscarlo después.
