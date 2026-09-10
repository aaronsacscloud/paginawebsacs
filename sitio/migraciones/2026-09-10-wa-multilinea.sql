-- MULTILÍNEA de WhatsApp (10-sep-2026): los 10 puntos.
-- 1) La línea como dato de primera clase: reglas de ruteo por contexto, topes y disyuntor por línea.
alter table wa_numeros
  add column if not exists pausada boolean not null default false,        -- disyuntor: calidad baja → no salen masivos/cadencias
  add column if not exists pausada_motivo text,
  add column if not exists tope_diario integer,                            -- null = sin tope propio (Meta manda)
  add column if not exists firma text,                                     -- identidad: cómo se presenta quien contesta por esta línea
  add column if not exists agente_nombre text,
  add column if not exists redirigir_a text,                               -- auto-respuesta: "escríbenos al otro número"
  add column if not exists redirigir_texto text,
  add column if not exists retirada_at timestamptz;                        -- cuándo se apagó (sunset)

-- 4) Reglas de ruteo: por contexto (lead, cliente, agente, cita, sistema, masivo, prospeccion, evento) y, opcional, origen del contacto.
create table if not exists wa_reglas_linea (
  id uuid primary key default gen_random_uuid(),
  orden integer not null default 100,
  contexto text not null,                 -- '*' = cualquiera
  origen text,                            -- fuente del contacto (tiktok, web, …) o null
  phone_number_id text not null references wa_numeros(phone_number_id) on delete cascade,
  activa boolean not null default true,
  nota text,
  created_at timestamptz not null default now()
);
create index if not exists wa_reglas_linea_orden on wa_reglas_linea (activa, orden);

-- 7) La ventana de 24 h es por (línea, cliente): {phone_number_id: último entrante por esa línea}.
alter table wa_conversaciones
  add column if not exists ventanas jsonb not null default '{}'::jsonb,
  add column if not exists migrada_at timestamptz,                         -- 5) ya se le avisó del número nuevo
  add column if not exists auto_redirigir_at timestamptz;                  -- 6) ya se le mandó la redirección (una cada 7 días)
update wa_conversaciones set ventanas = jsonb_build_object(phone_number_id, ultimo_entrante_at)
  where phone_number_id is not null and ultimo_entrante_at is not null and ventanas = '{}'::jsonb;

-- 8) Masivos y programados guardan su línea al crearse, no la resuelven al mandar.
alter table wa_broadcasts add column if not exists phone_number_id text;
alter table wa_programados add column if not exists phone_number_id text;
update wa_programados p set phone_number_id = c.phone_number_id from wa_conversaciones c
  where p.conversation_id = c.id and p.phone_number_id is null and p.estado = 'pendiente';

-- 5) Migración asistida del +1 al +52 (config en wa_config, fila 1).
alter table wa_config
  add column if not exists migracion_activa boolean not null default false,
  add column if not exists migracion_desde text,
  add column if not exists migracion_hacia text,
  add column if not exists migracion_plantilla text,
  add column if not exists migracion_tope_diario integer not null default 40,
  add column if not exists migracion_dias_actividad integer not null default 180;
