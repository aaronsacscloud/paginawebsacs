-- Hilos de conversación dentro del brief.
--
-- Antes, devolver una etapa era una nota suelta para TODA la etapa: el cliente
-- leía "faltan cosas" y tenía que adivinar dónde. Ahora cada pregunta puede
-- tener su propio hilo — Sacs comenta o repregunta ahí mismo, el cliente
-- contesta ahí mismo — y "qué me falta" deja de ser una interpretación: es la
-- lista de hilos abiertos cuyo último mensaje es nuestro.
--
-- Los mensajes van en un jsonb y no en filas porque siempre se leen completos,
-- nunca se filtran por contenido y son pocos por hilo (dos o tres).

create table if not exists proyecto_hilo (
  id          uuid primary key default gen_random_uuid(),
  brief_id    uuid not null references proyecto_brief(id) on delete cascade,
  etapa_clave text not null,
  -- null = el hilo es de la etapa entera, no de una pregunta
  campo_id    text,
  mensajes    jsonb not null default '[]'::jsonb,
  -- 'abierto' = espera respuesta del cliente. 'resuelto' = Sacs lo dio por bueno.
  estado      text not null default 'abierto',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Un hilo por pregunta. El índice va sobre coalesce porque en Postgres dos
-- NULL no chocan entre sí: sin esto se podrían crear varios hilos de etapa.
create unique index if not exists proyecto_hilo_uno_idx
  on proyecto_hilo (brief_id, etapa_clave, coalesce(campo_id, ''));
create index if not exists proyecto_hilo_brief_idx on proyecto_hilo (brief_id, estado);

-- A quién se le avisa. `avisos_email` lo llena el cliente al firmar; `avisos_copia`
-- es la copia interna de Sacs y no se muestra en la página.
alter table proyecto_brief add column if not exists avisos_email text[] not null default '{}';
alter table proyecto_brief add column if not exists avisos_copia text[] not null default '{}';
-- Última vez que la rutina de revisión miró este brief.
alter table proyecto_brief add column if not exists revisado_at timestamptz;
