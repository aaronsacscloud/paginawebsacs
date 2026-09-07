-- ═══ La OCURRENCIA: "la junta del lunes 7", como objeto ═══════════════════
--
-- Pedido del dueño (7-sep-2026): «¿qué sucede cuando no le doy play el día
-- específico a la hora específica? ¿y cuando la reagendo para otro horario? ¿y
-- si quiero editar temas de la agenda para reuniones posteriores?».
--
-- POR QUÉ HACEN FALTA ESTAS TABLAS
--
-- Hasta hoy el módulo tenía DOS sustantivos y le faltaba el de en medio:
--
--   · `espacio_canales.regla_reunion` = {dia_iso, hora} — un PATRÓN semanal,
--     no un evento. No se puede mover, ni saltar, ni preparar.
--   · `espacio_reunion_sesiones` — solo existe si alguien apretó play.
--
-- No había nada que representara «la junta del lunes 7 de septiembre». Y como
-- la próxima reunión se CALCULABA con una función pura de la regla y el reloj
-- (`proximaReunion`), en el instante en que se cumplía la hora le sumaba 7
-- días: la junta de hoy se evaporaba sin dejar rastro. Medido el 7-sep-2026 a
-- la 1:50 p.m.: la junta `lunes-semanal` de las 10:00 ya no existía en ningún
-- lado y el panel apuntaba al 14. Nadie podía saber que se había saltado.
--
-- Los cuatro problemas del dueño son ESE hueco, no cuatro bugs distintos.
--
-- MATERIALIZACIÓN PEREZOSA, no un cron poblando el calendario
-- Las ocurrencias se crean por demanda (al leer la sala y en el cron diario que
-- ya existe), solo de HOY hacia adelante y con 28 días de horizonte. No se
-- inventan ocurrencias del pasado: las juntas anteriores a esta migración
-- simplemente no existen como ocurrencia, que es lo honesto — de varias ya hay
-- acta y de otras nadie sabe si se hicieron.

create table if not exists espacio_reunion_ocurrencias (
  id             uuid primary key default gen_random_uuid(),
  canal_id       uuid not null references espacio_canales(id) on delete cascade,

  -- El día al que PERTENECE la junta, en hora de México. Es la llave natural
  -- junto con el canal: mover una junta de las 10:00 a las 16:00 no la vuelve
  -- otra junta, y mantenerla como llave impide que se dupliquen al
  -- materializar dos veces en paralelo (dos pestañas abiertas del CRM).
  fecha          date not null,

  -- Cuándo empieza DE VERDAD. Sale de la regla, o de haberla movido.
  inicio_at      timestamptz not null,
  -- Dónde la había puesto la regla. Si difiere de `inicio_at`, la junta se
  -- movió y el panel lo dice ("movida de las 10:00").
  programada_at  timestamptz not null,

  -- pendiente → nadie le ha dado play todavía
  -- hecha     → se abrió sesión (queda ligada en `sesion_id`)
  -- saltada   → pasó el día sin que nadie la iniciara, o se saltó a propósito
  estado         text not null default 'pendiente'
                 check (estado in ('pendiente', 'hecha', 'saltada')),
  motivo         text,

  sesion_id      uuid references espacio_reunion_sesiones(id) on delete set null,
  movida_por     uuid references team_members(id) on delete set null,
  creada_at      timestamptz not null default now(),
  cerrada_at     timestamptz,

  unique (canal_id, fecha)
);

create index if not exists idx_ocurrencias_canal_fecha
  on espacio_reunion_ocurrencias (canal_id, fecha desc);
-- El barrido pregunta siempre "¿qué quedó pendiente y ya venció?".
create index if not exists idx_ocurrencias_pendientes
  on espacio_reunion_ocurrencias (fecha) where estado = 'pendiente';

-- ── Un punto de agenda puede ir a una junta FUTURA ─────────────────────────
-- NULL = «a la próxima que toque», que es exactamente lo que hacía antes. Por
-- eso la columna es aditiva y no cambia el comportamiento de ningún punto que
-- ya exista: al dar play se siguen llevando todos los de `para_ocurrencia_id`
-- nulo. Lo nuevo es poder apartar un tema para el 3 de octubre sin que se
-- cuele en la junta de hoy.
alter table espacio_reunion_puntos
  add column if not exists para_ocurrencia_id uuid
  references espacio_reunion_ocurrencias(id) on delete set null;

create index if not exists idx_puntos_para_ocurrencia
  on espacio_reunion_puntos (para_ocurrencia_id) where para_ocurrencia_id is not null;

-- Reversible:
--   alter table espacio_reunion_puntos drop column para_ocurrencia_id;
--   drop table espacio_reunion_ocurrencias;
