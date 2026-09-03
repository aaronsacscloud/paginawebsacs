-- 2026-09-03 · Cierre del ciclo de aprendizaje: reglas y guion como DATOS, prueba antes de aplicar,
-- corridas observables, resultado del lead y ejemplos por parecido.
alter table ti_reglas
  add column if not exists texto text,            -- la regla redactada (1-2 líneas) que entra al prompt
  add column if not exists etapa text,            -- etapa del guion a la que aplica (null = global)
  add column if not exists alcance text,          -- global | etapa | giro:<x>
  add column if not exists version int default 1,
  add column if not exists prueba jsonb,          -- {n, sin, con, delta, at, costo, casos:[...]}
  add column if not exists origen text,           -- patron | curador | dueno | manual
  add column if not exists nota text,
  add column if not exists decidida_por uuid,
  add column if not exists decidida_at timestamptz,
  add column if not exists activa_desde timestamptz,
  add column if not exists retirada_at timestamptz;
create index if not exists ix_ti_reglas_estado on ti_reglas (estado, clave);

create table if not exists ti_guion_versiones (
  id uuid primary key default gen_random_uuid(),
  clave text not null check (clave in ('guion','wiki','limites')),
  version int not null,
  texto text not null,
  nota text,
  created_by uuid,
  created_at timestamptz default now(),
  unique (clave, version)
);

create table if not exists ti_corridas (
  id uuid primary key default gen_random_uuid(),
  cron text not null,
  inicio timestamptz not null default now(),
  fin timestamptz,
  duracion_ms int,
  ok boolean,
  pasos jsonb default '{}'::jsonb,
  error text
);
create index if not exists ix_ti_corridas_cron on ti_corridas (cron, inicio desc);

alter table ti_calificaciones add column if not exists resultado jsonb;   -- {respondio_48h, respondio_min, agendo_7d, medido_at}
alter table ti_envios add column if not exists resultado jsonb;

-- Ejemplos por parecido (pg_trgm + unaccent ya instalados): el mensaje del lead contra mensaje_lead+situación,
-- con empujón por etapa y por ser corrección de una persona.
create or replace function ti_ejemplos_parecidos(q text, etapa text default null, n int default 8)
returns table(id uuid, estado text, situacion text, pulida text, fuente text, por_que text, imagen_id uuid, adjuntos jsonb, score real)
language sql stable as $$
  select e.id, e.estado, e.situacion, e.pulida, e.fuente, e.por_que, e.imagen_id, e.adjuntos,
    (similarity(unaccent(lower(coalesce(e.mensaje_lead,'') || ' ' || coalesce(e.situacion,''))), unaccent(lower(coalesce(q,''))))
      + case when etapa is not null and e.estado = etapa then 0.15 else 0 end
      + case when e.fuente in ('correccion_dueno','correccion_implicita') then 0.10 else 0 end)::real as score
  from ia_ejemplos e
  where e.estado_rev = 'aprobado' and coalesce(e.estado,'') <> 'reactivacion'
  order by score desc, e.created_at desc
  limit n
$$;
