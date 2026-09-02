-- TRABAJO INTELIGENTE · A0 — la BITÁCORA DE EVENTOS y el PERFIL VIVO.
-- Spec: sitio/PLAN-TI-AUTONOMIA.md (§4.1 y §4.2). Decisión del dueño 2026-09-01.
--
-- ti_eventos es la bitácora canónica, append-only: una fila por señal, venga
-- de donde venga (WhatsApp, cotizaciones, citas, correo, tareas, IA). No la
-- escriben los webhooks: la llenan ADAPTADORES idempotentes que leen las
-- tablas donde los eventos ya caen (lib/crm/ti/eventos.ts). El índice único
-- (fuente_tabla, fuente_id, tipo, ocurrio_at) es lo que hace inofensivo
-- correr un adaptador dos veces.
create table if not exists ti_eventos (
  id           bigserial primary key,
  contact_id   uuid,                           -- puede ser null (conversación sin contacto)
  company_id   uuid,
  tipo         text not null,                  -- lead_entro | wa_entrante | wa_saliente | wa_fallido | wa_leido |
                                               -- cotizacion_enviada|vista|aceptada|rechazada|pagada |
                                               -- cita_creada|asistio|no_asistio|cancelada|reagendada |
                                               -- correo_enviado|abierto|clic|rebote|respondido |
                                               -- llamada | tarea_hecha|omitida | ia_mensaje|ia_no_pudo|ia_error |
                                               -- falta | suscripcion_activa
  canal        text,                           -- wa | correo | llamada | web | crm | ia
  actor        text not null,                  -- lead | humano | ia | sistema | valvula | secuencia | agenda
  payload      jsonb not null default '{}'::jsonb,
  ocurrio_at   timestamptz not null,
  fuente_tabla text not null,
  fuente_id    text not null,
  created_at   timestamptz not null default now()
);
create unique index if not exists ti_eventos_unico
  on ti_eventos (fuente_tabla, fuente_id, tipo, ocurrio_at);
create index if not exists ti_eventos_contacto on ti_eventos (contact_id, ocurrio_at desc);
create index if not exists ti_eventos_tipo     on ti_eventos (tipo, ocurrio_at desc);
create index if not exists ti_eventos_reciente on ti_eventos (ocurrio_at desc);

-- ti_perfil es lo que el sistema RECUERDA de cada lead. Lo determinista lo
-- recalcula perfil.ts desde ti_eventos (se puede borrar y regenerar); lo que
-- extrae la IA (objeciones, intenciones, promesas, resumen) entra por el
-- registro de campos y se conserva.
create table if not exists ti_perfil (
  contact_id            uuid primary key references contacts(id) on delete cascade,
  company_id            uuid,
  -- lo aprendido de las RESPUESTAS (hora local CDMX 0-23; null = sin muestra)
  mejor_hora_wa         int,
  mejor_hora_llamada    int,
  mejor_hora_correo     int,
  horas_respuesta       jsonb not null default '{}'::jsonb,   -- {"wa":{"16":3,"10":1},"llamada":{...}}
  canales               jsonb not null default '{}'::jsonb,   -- {"wa":{"enviados","respondidos","fallidos","leidos"},"correo":{...},"llamada":{"intentos","contestadas"}}
  canal_que_responde    text,                                  -- wa | correo | llamada | ninguno
  canal_preferido       text,                                  -- DECLARADO por el lead: candado duro
  idioma                text,
  -- lo que extrae la IA (A4/A5), por el registro de campos
  objeciones            jsonb not null default '[]'::jsonb,
  intenciones           jsonb not null default '[]'::jsonb,
  promesas              jsonb not null default '[]'::jsonb,
  investigacion         jsonb,
  resumen_ia            text,
  resumen_ia_at         timestamptz,
  -- la lectura del momento
  etapa_interes         text,                                  -- curioso | evaluando | decidiendo | cliente
  score_valor           int,                                   -- 1..5
  score_probabilidad    numeric(4,3),                          -- 0..1
  partner_id            uuid,
  siguiente_paso        text,
  siguiente_paso_razon  text,
  -- candados
  silenciar_ia          boolean not null default false,
  do_not_contact_hasta  timestamptz,
  -- resumen de la bitácora
  primer_evento_at      timestamptz,
  ultimo_evento_at      timestamptz,
  ultimo_evento_tipo    text,
  ultima_respuesta_at   timestamptz,                           -- último evento con actor=lead
  ultimo_toque_at       timestamptz,                           -- último saliente nuestro (humano/ia/sistema)
  eventos_total         int not null default 0,
  senales               jsonb not null default '{}'::jsonb,    -- contadores por tipo
  updated_at            timestamptz not null default now()
);
create index if not exists ti_perfil_respuesta on ti_perfil (ultima_respuesta_at desc);
