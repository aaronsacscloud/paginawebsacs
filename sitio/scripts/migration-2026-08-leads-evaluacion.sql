-- ═══════════════════════════════════════════════════════════════════════════
-- LEADS · Evaluación y seguimiento. Cuatro ejes, no una lista larga.
--
--   1. ETAPA        — dónde va. Se DERIVA de hechos (hay toque, hay reunión,
--                     hay cotización, pagó). `etapa_manual` solo puede
--                     ADELANTARLA, nunca retrocederla: manda la más avanzada.
--   2. CALIFICACIÓN — si vale la pena. A mano, al hablar con él.
--   3. PRÓXIMO PASO — qué sigue y cuándo. Hoy en 0 de 105 leads: es el campo
--                     que convierte una lista de leads en una lista de trabajo.
--      DESENLACE    — solo al cerrar. "Solo quería información" vive aquí: no
--                     es una etapa por la que se pasa, es cómo terminó.
--   4. ESFUERZO     — no se captura, se mide (llamadas, correos, WhatsApp).
--
-- Los motivos son CONFIGURABLES: vienen unos de fábrica y el usuario agrega los
-- suyos desde Configuración. Sin eso, la lista se queda corta el primer mes y
-- la gente empieza a escribir el motivo real en otro lado.
-- ═══════════════════════════════════════════════════════════════════════════

alter table contacts
  add column if not exists calificacion        text,
  add column if not exists calificacion_motivo text,
  add column if not exists calificacion_at     timestamptz,
  add column if not exists calificacion_por    text,
  add column if not exists desenlace           text,
  add column if not exists desenlace_at        timestamptz,
  add column if not exists etapa_manual        text,
  add column if not exists proximo_paso        text;

-- Sin CHECK a propósito en `calificacion`: el valor válido lo decide la
-- aplicación y un CHECK obligaría a una migración cada vez que se agregue uno.
create index if not exists ix_contacts_calificacion on contacts (calificacion) where calificacion is not null;
create index if not exists ix_contacts_followup on contacts (next_followup) where next_followup is not null;

create table if not exists crm_lead_motivos (
  id uuid primary key default gen_random_uuid(),
  clave       text not null,
  label       text not null,
  -- descarte = por qué no califica · desenlace = cómo terminó el lead
  tipo        text not null check (tipo in ('descarte','desenlace')),
  orden       int  not null default 100,
  activo      boolean not null default true,
  de_fabrica  boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_lead_motivo on crm_lead_motivos (tipo, clave);

-- Los de fábrica. Se pueden desactivar pero no borrar: si se borrara uno ya
-- usado, los leads descartados con él se quedarían sin explicación.
insert into crm_lead_motivos (clave, label, tipo, orden, de_fabrica) values
  ('solo_informacion', 'Solo buscaba información', 'descarte', 10, true),
  ('no_es_su_giro',    'No es su giro',            'descarte', 20, true),
  ('muy_chico',        'Muy chico para el plan',   'descarte', 30, true),
  ('sin_presupuesto',  'Sin presupuesto',          'descarte', 40, true),
  ('ya_tiene_sistema', 'Ya tiene otro sistema',    'descarte', 50, true),
  ('no_contesta',      'No contesta',              'descarte', 60, true),
  ('ganado',           'Ganado',                   'desenlace', 10, true),
  ('precio',           'Se cayó por precio',       'desenlace', 20, true),
  ('sin_respuesta',    'Nunca respondió',          'desenlace', 30, true),
  ('solo_informacion', 'Solo quería información',  'desenlace', 40, true),
  ('giro_o_tamano',    'No es su giro o tamaño',   'desenlace', 50, true),
  ('otro_proveedor',   'Se fue con otro',          'desenlace', 60, true),
  ('a_futuro',         'A futuro',                 'desenlace', 70, true)
on conflict (tipo, clave) do nothing;

alter table crm_lead_motivos enable row level security;
