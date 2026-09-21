-- Lo que le falta a cada pieza, según los especialistas (SEO, IA/agentes,
-- autoridad). Es la lista que el dueño ve en «Seguimiento» y va tachando.
create table if not exists de_contenido_pendientes (
  id uuid primary key default gen_random_uuid(),
  contenido_id uuid not null references de_contenido(id) on delete cascade,
  origen text not null check (origen in ('seo','geo','autoridad','referee')),
  clave text not null,
  titulo text not null,
  detalle text,
  quien text not null default 'dueno' check (quien in ('motor','dueno')),
  prioridad smallint not null default 2,
  impacto text,
  estado text not null default 'pendiente' check (estado in ('pendiente','hecho','descartado')),
  hecho_at timestamptz,
  created_at timestamptz not null default now(),
  unique (contenido_id, clave)
);
create index if not exists de_contenido_pendientes_contenido on de_contenido_pendientes(contenido_id, estado);

insert into de_politicas (tipo_accion, nivel, riesgo, requiere_aprobacion, tope_dia, max_intentos, inmutable, notas) values
  ('contenido.especialista', 2, 'LOW', false, 10, 2, false, 'Dos especialistas (SEO y IA/agentes) revisan cada pieza aprobada o publicada y dejan la lista de pendientes en de_contenido_pendientes.'),
  ('contenido.autoridad',    2, 'LOW', false, 10, 2, false, 'Para lo publicado: mide indexación, citas en IA, enlaces y tráfico, y propone qué falta para darle autoridad (enlaces internos, menciones, ángulos).'),
  ('contenido.angulos',      2, 'LOW', false, 5,  2, false, 'Para lo publicado: propone 3-5 ángulos derivados (comparativa, paso a paso, plantilla, error común) y los mete como oportunidades para el brief.')
on conflict (tipo_accion) do update set notas = excluded.notas, tope_dia = excluded.tope_dia, actualizado_at = now();
