-- ════════════════════════════════════════════════════════════════════════════
-- SACS DEMAND ENGINE · Etapa 3 · visibilidad en las IAs
--
-- Mide lo que el dueño pidió: cuando alguien del ramo le pregunta a una IA qué
-- software usar, ¿aparece Sacs?, ¿en qué lugar?, ¿y a quién citan en su lugar?
-- ════════════════════════════════════════════════════════════════════════════

-- Las PREGUNTAS, no las palabras clave. Nadie le escribe «software moda méxico»
-- a ChatGPT: le escribe una pregunta entera. Por eso el catálogo se redacta a
-- mano y no se deriva de keywords.
create table if not exists de_prompts_ia (
  id              uuid primary key default gen_random_uuid(),
  clave_idem      text not null unique,
  prompt          text not null,
  pais            text not null default 'MX',
  idioma          text not null default 'es',
  icp             text,
  cluster_id      uuid references de_clusters(id) on delete set null,
  categoria       text,                      -- giro|problema|comparativa|tamano
  activo          boolean not null default true,
  frecuencia_dias int not null default 7,
  origen          text not null default 'semilla',   -- semilla|motor|lead|humano
  medido_at       timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists de_prompts_turno_idx on de_prompts_ia (medido_at nulls first) where activo;

-- UNA medición: una pregunta, en una plataforma, un día.
--
-- `estado` es lo que hace honesto el número: si una plataforma no se pudo
-- consultar se guarda 'no_disponible' con su motivo, NUNCA un cero. Un cero se
-- promedia y arrastra el resultado; un hueco declarado se ve y se arregla.
create table if not exists de_ia_muestras (
  id                   uuid primary key default gen_random_uuid(),
  prompt_id            uuid not null references de_prompts_ia(id) on delete cascade,
  plataforma           text not null,        -- chatgpt|gemini|claude|perplexity|grok
  modelo               text,
  fecha                date not null default current_date,
  estado               text not null default 'ok',   -- ok|no_disponible|error
  sacs_mencionado      boolean,
  posicion             int,
  fuerza_recomendacion int,                  -- 3 primera opción · 0 no aparece
  sentimiento          text,
  competidores         text[] not null default '{}',
  citas                jsonb not null default '[]'::jsonb,
  urls_citadas         text[] not null default '{}',
  url_sacs_citada      text,
  resumen_razon        text,
  /** La respuesta completa. Dentro de seis meses, cuando el número haya
   *  cambiado, la única forma de saber POR QUÉ es haberla guardado. */
  respuesta            jsonb not null default '{}'::jsonb,
  confianza            numeric(3,2) not null default 0.9,
  costo_usd            numeric(12,6) not null default 0,
  created_at           timestamptz not null default now()
);
create index if not exists de_muestras_prompt_idx on de_ia_muestras (prompt_id, fecha desc);
create index if not exists de_muestras_fecha_idx on de_ia_muestras (fecha desc, plataforma);

alter table de_prompts_ia enable row level security;
alter table de_ia_muestras enable row level security;

insert into de_politicas (tipo_accion, nivel, riesgo, requiere_aprobacion, tope_dia, max_intentos, notas) values
  ('geo.muestrear', 0, 'LOW', false, 400, 2, 'Le pregunta a las IAs como lo haría un comprador'),
  ('geo.score',     0, 'LOW', false, null, 2, 'Calcula el AI Visibility Score')
on conflict (tipo_accion) do update set nivel = 0, riesgo = 'LOW';

-- Quién ocupa el lugar que queremos, contado sobre las respuestas reales.
create or replace function de_competidores_en_ia(dias int default 30)
returns table (competidor text, veces bigint, plataformas bigint)
language sql stable as $$
  select lower(trim(c)) comp, count(*), count(distinct plataforma)
  from de_ia_muestras m, unnest(m.competidores) c
  where m.estado = 'ok' and m.fecha > current_date - dias and length(trim(c)) between 2 and 40
  group by 1 order by 2 desc;
$$;

-- En quién CONFÍA la IA para esta categoría. Es la mitad del valor: dice dónde
-- hay que estar, no solo si estamos.
create or replace function de_fuentes_citadas_ia(dias int default 30)
returns table (dominio text, veces bigint, plataformas bigint)
language sql stable as $$
  select lower(regexp_replace(regexp_replace(u, '^https?://(www\.)?', ''), '/.*$', '')) dom,
         count(*), count(distinct plataforma)
  from de_ia_muestras m, unnest(m.urls_citadas) u
  where m.estado = 'ok' and m.fecha > current_date - dias and u <> ''
  group by 1 order by 2 desc;
$$;
