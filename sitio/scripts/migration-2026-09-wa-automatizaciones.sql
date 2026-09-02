-- ═══ Qué automatización PUEDE escribirle al cliente por WhatsApp ══════════
--
-- Decisión del dueño (2-sep-2026): «esto es lo único que vamos a habilitar
-- ahorita por WhatsApp» — la agenda (confirmación, recordatorio y seguimiento
-- de una reunión YA establecida) y el primer mensaje al contacto. Nada más.
--
-- Es una lista de PERMITIDOS, no de bloqueados, y es FAIL-CLOSED: una clave
-- que no esté aquí, o que esté en false, no envía. Se eligió así porque el
-- barrido de ayer encontró siete automatizaciones distintas escribiéndole al
-- mismo cliente sin saber una de la otra, y una lista de bloqueados no
-- protege contra la octava que alguien agregue mañana.
--
-- Se enciende y se apaga desde aquí sin desplegar.

create table if not exists wa_automatizaciones (
  clave       text primary key,
  nombre      text not null,
  categoria   text not null,
  activa      boolean not null default false,
  nota        text,
  updated_at  timestamptz not null default now()
);

insert into wa_automatizaciones (clave, nombre, categoria, activa, nota) values
  ('agenda_confirmacion', 'Confirmación al agendar', 'agenda', true,
   'Sale una vez, cuando el cliente reserva.'),
  ('agenda_recordatorio', 'Recordatorios de la reunión', 'agenda', true,
   'Los que configuró el usuario en cada tipo de reunión (hoy 1 día, 3 horas y 10 minutos).'),
  ('agenda_seguimiento', 'Seguimiento de la reunión ya agendada', 'agenda', true,
   'No llegó, se canceló, se reagendó, y el «Ahí estaré» del recordatorio.'),
  ('primer_mensaje', 'Primer mensaje al contacto', 'primer_mensaje', true,
   'Marketing con foto primero; si no llega en 10 minutos, la de utilidad.'),

  ('acuse_entrante', 'Acuse automático del inbox («Te leo»)', 'inbox', false,
   'Pausado el 1-sep: mal redactado y se encimaba con la agenda.'),
  ('agenda_horarios_auto', 'Contestar con horarios cuando piden cita', 'agenda', false,
   'Pausado: mandaba una lista de horarios y un link que se leían como si ya hubiera reunión.'),
  ('agenda_reagendar_auto', 'Contestar el botón «Reagendar»', 'agenda', false,
   'Pausado: cambio de horario NO se contesta solo. El toque queda avisado en el inbox.'),
  ('cadencia_leads', 'Secuencias de seguimiento a leads', 'cadencia', false,
   'Las 8 secuencias siguen apagadas en Secuencias; esto es el segundo candado.'),
  ('cobranza', 'Cobranza automática de suscripción vencida', 'cobranza', false,
   'Pausada: le escribe a clientes que pagan pidiendo dinero, sin que nadie lo revise.'),
  ('copiloto_ia', 'Copiloto de IA que responde solo', 'ia', false,
   'Apagado también en ti_config.copiloto_activo.'),
  ('valvula_ti', 'Válvula de plantillas vencidas de Trabajo Inteligente', 'ia', false,
   'Sin plantillas_meta configurado tampoco correría.')
on conflict (clave) do nothing;

-- El primer mensaje y su respaldo. Una fila por NÚMERO: el primer mensaje es
-- uno solo en la vida de ese contacto, y la unicidad por teléfono es lo que
-- impide que dos fuentes de leads le abran conversación dos veces.
create table if not exists wa_primer_mensaje (
  id                  uuid primary key default gen_random_uuid(),
  telefono            text not null unique,
  contact_id          uuid references contacts(id) on delete set null,
  plantilla_marketing text,
  plantilla_utility   text,
  wamid               text,
  enviado_at          timestamptz not null default now(),
  -- Cuándo toca revisar si llegó. Ver el cron `wa-primer-mensaje`.
  verificar_at        timestamptz not null,
  -- esperando · llego · respaldo_enviado · sin_respaldo · cancelado
  estado              text not null default 'esperando',
  detalle             jsonb,
  updated_at          timestamptz not null default now()
);

create index if not exists wa_primer_mensaje_pendientes
  on wa_primer_mensaje (verificar_at) where estado = 'esperando';
