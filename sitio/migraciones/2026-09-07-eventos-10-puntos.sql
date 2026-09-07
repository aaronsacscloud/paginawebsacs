-- Eventos · los 10 puntos de la propuesta · 2026-09-07
--
-- 1 Bandeja "después de la feria": qué pasó con cada registro (le escribí,
--   respondió, demo) vive EN el registro, no solo en el contacto: así la
--   bandeja se ordena por lo que falta y el cron sabe a quién se le olvidó.
-- 2 Demo en el stand: el registro apunta al booking real (bookings.id).
-- 3 Citas antes de la feria: horario del stand para abrir huecos, el masivo
--   de invitación y la cita (otro booking) por registro.
-- 6 Captura por gafete/tarjeta: de dónde salió el registro.
-- 7 Turnos del equipo: quién está en el stand cada día y a qué hora.
-- 8 Ruta del recorrido: nota y asignado por expositor.
-- 9 Fit medido: lo que dicen los pesos, junto al fit que se investigó.
-- 10 Calendario iCal: el token vive en abm_config (kv), no hace falta columna.

alter table ev_registros
  add column if not exists contactado_at timestamptz,
  add column if not exists contactado_por uuid,
  add column if not exists respondio_at timestamptz,
  add column if not exists demo_at timestamptz,
  add column if not exists demo_booking_id uuid references bookings(id) on delete set null,
  add column if not exists cita_booking_id uuid references bookings(id) on delete set null,
  add column if not exists capturado_via text default 'manual';   -- manual|gafete_qr|tarjeta|cita
create index if not exists ev_registros_seguimiento_ix on ev_registros (edicion_id, temperatura, contactado_at);

create table if not exists ev_turnos (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid not null references ev_ediciones(id) on delete cascade,
  usuario_id uuid not null,
  nombre text,
  dia date not null,
  desde time not null default '10:00',
  hasta time not null default '18:00',
  created_at timestamptz default now()
);
create index if not exists ev_turnos_edicion_ix on ev_turnos (edicion_id, dia, desde);

alter table ev_ediciones
  add column if not exists horario_stand jsonb,          -- {desde:'10:00', hasta:'18:00', duracion:15}
  add column if not exists invitacion_broadcast_id uuid; -- el masivo "estamos en X, agenda 15 min"

alter table ev_expositores
  add column if not exists nota text,
  add column if not exists asignado_a uuid,
  add column if not exists asignado_nombre text;

alter table ev_eventos
  add column if not exists fit_medido int,
  add column if not exists fit_medido_nota text,
  add column if not exists fit_medido_at timestamptz;

-- 3 · Citas en el stand ANTES de la feria. Cada cita es también un booking real
-- (sale en Reuniones, manda recordatorios, se puede cancelar), pero la liga con
-- la edición y con el registro de "sí llegó" vive aquí: bookings no sabe de ferias.
create table if not exists ev_citas (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid not null references ev_ediciones(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  nombre text, empresa text, whatsapp text, email text, giro text,
  dia date not null, hora time not null,
  estado text not null default 'agendada',        -- agendada|llego|no_llego|cancelada
  registro_id uuid references ev_registros(id) on delete set null,
  origen text default 'liga',                     -- liga|invitacion|crm
  nota text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint ev_citas_estado_ck check (estado in ('agendada','llego','no_llego','cancelada'))
);
create index if not exists ev_citas_edicion_ix on ev_citas (edicion_id, dia, hora);

-- Tipo de reunión para la cita en el stand: 15 min, presencial, sin minuta
-- obligatoria (la "minuta" de una cita de stand es el registro que se captura).
-- activo=false a propósito: no debe salir en /agendar/<slug> ni en la lista de
-- ligas del inbox; solo se agenda desde la liga de la feria (/e/<token>/cita).
insert into event_types (nombre, slug, descripcion, duracion_minutos, buffer_despues_minutos, aviso_minimo_horas, max_dias_adelanto, ubicacion_tipo, ubicacion_detalles, color, categoria, requiere_minuta, activo)
select 'Cita en el stand', 'cita-stand', 'Quince minutos en el stand de Sacscloud durante la feria', 15, 0, 1, 120, 'presencial', 'Stand de Sacscloud en la feria', '#9B8CFA', 'demo', false, false
where not exists (select 1 from event_types where slug = 'cita-stand');
