-- Equipo · salas de reunión y mensajes fijados (F5/F6).
--
-- 1) La sesión abierta sabe qué punto se está tratando: así el chat de la
--    sala liga cada mensaje al punto (punto_id) sin que el navegador lo
--    adivine, y quien entra tarde ve "vamos en el 2 de 4".
-- 2) Fijar un mensaje = fecha + quién. Máximo 15 por canal (lo cuida la API).
-- 3) Los acuerdos se marcan hechos también desde Trabajo inteligente: la
--    tarea (ti_tareas.origen='espacio') es la verdad; hecho_at aquí es la copia.

alter table espacio_reunion_sesiones
  add column if not exists punto_actual_id uuid references espacio_reunion_puntos(id) on delete set null,
  add column if not exists nota_cierre text;

alter table espacio_mensajes
  add column if not exists fijado_at timestamptz,
  add column if not exists fijado_por uuid references team_members(id);

create index if not exists espacio_mensajes_fijados_idx on espacio_mensajes (canal_id, fijado_at desc) where fijado_at is not null;

-- Buscar sesiones por sala y fecha (historial) y acuerdos pendientes por persona.
create index if not exists espacio_sesiones_canal_idx on espacio_reunion_sesiones (canal_id, inicio_at desc);
create index if not exists espacio_acuerdos_resp_idx on espacio_acuerdos (responsable_id) where hecho_at is null;
