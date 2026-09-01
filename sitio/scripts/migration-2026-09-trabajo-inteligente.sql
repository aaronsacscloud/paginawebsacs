-- TRABAJO INTELIGENTE · F0 — el esquema del motor.
-- Spec: sitio/PLAN-TRABAJO-INTELIGENTE.md (6 rondas de decisiones).
--
-- Principio del modelo: ti_tareas es una PROYECCIÓN del estado — las
-- pendientes se pueden retirar y regenerar; solo las terminadas (hecha/
-- omitida) son historia intocable. La verdad de la cadencia vive en
-- ti_cadencias, una fila por contacto.

-- ── La cadencia humana: una fila por contacto enrolado ──
create table if not exists ti_cadencias (
  contact_id   uuid primary key references contacts(id) on delete cascade,
  paso         text not null default 'T1',          -- T1..T8
  estado       text not null default 'activa',      -- activa | pausada | conversacion | terminada
  pausa_causa  text,                                 -- respondió | pidió_tiempo | ausencia | silenciada
  pausa_hasta  timestamptz,
  iniciada_at  timestamptz not null default now(),
  ultimo_toque_at timestamptz,
  siguiente_at timestamptz not null default now(),  -- cuándo toca el paso actual (se DESLIZA, no se duplica)
  intentos_llamada int not null default 0,
  canal_preferido  text,                             -- candado DURO si el lead lo declaró
  mejor_hora   int,                                  -- hora local aprendida (contestó a las 16 → 16)
  do_not_contact boolean not null default false,
  terminada_motivo text,                             -- descalificado | convertido | agendo | descartado_manual
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ti_cadencias_pendientes on ti_cadencias (estado, siguiente_at);

-- ── Las tareas del día ──
create table if not exists ti_tareas (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid references contacts(id) on delete cascade,
  company_id   uuid,
  owner_id     uuid,
  familia      text not null,      -- contactar | responder | avanzar | decidir | preparar | reparar | higiene
  tipo         text not null,      -- llamada | wa_plantilla | wa_libre | correo | compromiso | responder | estafeta | veredicto | dato | ...
  paso         text,               -- T1..T8 si viene de cadencia
  prioridad    int not null default 4,          -- 1..5
  vence_at     timestamptz not null,
  estado       text not null default 'pendiente', -- pendiente | hecha | omitida | pospuesta | retirada | expirada
  retirada_causa text,             -- agendó | respondió | convertido | duplicado | regenerada …
  atrasada     boolean not null default false,  -- se deslizó de un día anterior (P5 visual)
  resultado    text,               -- específico del tipo (contestó/buzón/…, la_firma/pidió_cambios/…)
  resultado_detalle jsonb,
  payload      jsonb not null default '{}'::jsonb, -- instrucción, hechos hero, mensaje sugerido, tipo de llamada
  origen       text not null default 'cadencia',   -- cadencia | evento | reloj | deuda | manual | reparacion
  lote_tipo    text,               -- para agrupar higiene en bloques
  hecho_at     timestamptz,
  hecho_por    uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists ti_tareas_plan on ti_tareas (owner_id, estado, prioridad, vence_at);
create index if not exists ti_tareas_contacto on ti_tareas (contact_id, estado);
-- Un contacto no lleva DOS tareas pendientes del mismo paso: el generador es
-- idempotente gracias a este candado, no a llevar registro de corridas.
create unique index if not exists ti_tareas_paso_unico
  on ti_tareas (contact_id, paso) where estado = 'pendiente' and paso is not null;

-- ── Omisiones (el alimento del aprendizaje) ──
create table if not exists ti_omisiones (
  id         uuid primary key default gen_random_uuid(),
  tarea_id   uuid references ti_tareas(id) on delete cascade,
  motivo     text not null,   -- ya_contactado | mal_momento | dato_malo | duplicado | no_aplica | otro
  texto      text,
  contexto   jsonb,
  created_at timestamptz not null default now()
);

-- ── Faltas del consultor (responsabilidad 100%) ──
create table if not exists ti_faltas (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid,
  tipo       text not null,   -- p1_fuera_sla | promesa_rota | dia_sin_aviso | tarea_expirada | inconsistencia
  contact_id uuid,
  tarea_id   uuid,
  detalle    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ti_faltas_mes on ti_faltas (owner_id, created_at);

-- ── Reglas aprendidas / propuestas (el proceso NO se automodifica solo) ──
create table if not exists ti_reglas (
  id          uuid primary key default gen_random_uuid(),
  clave       text not null,
  valor       jsonb not null,
  estado      text not null default 'propuesta',  -- propuesta | activa | retirada
  evidencia   jsonb,
  aprobada_por uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Configuración del motor (una sola fila, editable sin deploy) ──
create table if not exists ti_config (
  id int primary key default 1 check (id = 1),
  valor jsonb not null
);
insert into ti_config (id, valor) values (1, '{
  "horario": {"ini": 9, "fin": 18, "tz": "America/Mexico_City"},
  "sla_p1_min": 15,
  "feriados": "ignorar",
  "capacidad_pct": 80,
  "max_por_dia": {"llamada": 1, "mensaje": 1},
  "cadencia_max_dias": 35,
  "valvula_plantilla_horas": 24,
  "alerta_gasto_ia_usd": 200
}'::jsonb)
on conflict (id) do nothing;
