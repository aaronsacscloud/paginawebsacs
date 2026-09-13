-- Conversaciones que pasaron FUERA del CRM
--
-- Medido el 12-sep-2026: de los 85 clientes activos, 82 no tienen ni un
-- mensaje ni una llamada en su historial. No es que no se les hable — se les
-- habla por un grupo de WhatsApp, por un celular personal o por teléfono, y
-- nada de eso llega al CRM. Vende Tu Closet, que se lleva completa por un
-- chat, tenía 0 WhatsApp, 0 llamadas y 0 reuniones.
--
-- Eso no es cosmético: la evidencia de Renovación dice «sin conversación
-- registrada», y con esa evidencia enfrente es donde se marca si hubo
-- seguimiento real — de lo cual depende si la cuenta conserva su tasa.
--
-- Aquí se guarda el RESUMEN, no el chat. Decisión del dueño: un grupo trae
-- gente que no es del cliente y conversación que no es del negocio, y guardar
-- todo eso sería quedarse con datos que nadie va a volver a mirar y que sí
-- habría que cuidar. Los conteos y las fechas sí se guardan, porque son lo que
-- convierte esto en evidencia.

create table if not exists conversaciones_capturadas (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  contact_id    uuid,
  canal         text not null default 'whatsapp',   -- whatsapp | llamada | otro
  titulo        text,
  resumen       text,
  -- Cada acuerdo con SU propio resumen, que es lo que se manda a la gestión:
  -- [{ texto, resumen, fecha, gestion_id }]
  acuerdos      jsonb not null default '[]'::jsonb,
  -- Lo que pidió, para poder volverlo idea de Consultoría con un clic.
  pidio         jsonb not null default '[]'::jsonb,
  tono          text,
  -- Lo medido del chat: nunca sale de la IA.
  desde         date,
  hasta         date,
  mensajes      integer not null default 0,
  del_cliente   integer not null default 0,
  nuestros      integer not null default 0,
  participantes jsonb not null default '[]'::jsonb,
  minutos       integer,                            -- para las llamadas
  creado_por    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ix_conv_cap_company on conversaciones_capturadas(company_id, hasta desc);

-- Las actividades que nacen de aquí llevan su marca en `metadata`:
--   { origen: 'capturado', conversacion_id, mensajes: N }
-- `mensajes` existe porque se guarda UNA actividad por día y por lado, no una
-- por mensaje: 134 renglones en el timeline por una sola conversación lo
-- vuelven ilegible, y una sola fila perdería las fechas —que son justo lo que
-- hace falta para decir «contestó el 11 de septiembre»—.

-- ── La cotización que salió de esa conversación (13-sep-2026) ──
-- Pedido del dueño: poder saber que de ese chat nació una cotización. La
-- relación es opcional y de una sola dirección; si la cotización se borra, la
-- conversación se queda (pasó de verdad) y solo pierde la liga.
alter table conversaciones_capturadas
  add column if not exists quote_id uuid references quotes(id) on delete set null;
