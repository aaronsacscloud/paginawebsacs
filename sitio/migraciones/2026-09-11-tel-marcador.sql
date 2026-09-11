-- LLAMADAS INTELIGENTES · el marcador automático del inbox (11-sep-2026).
--
-- Una SESIÓN es una lista de contactos que se marcan uno tras otro desde el
-- navegador del vendedor, con el servidor haciendo el trabajo pesado: origina
-- la llamada, la mete a una sala de conferencia, escucha quién contestó
-- (persona / buzón / portero) y solo le pasa el mando al vendedor cuando hay
-- una persona. Cada renglón de la lista es un ITEM con su propia máquina de
-- estados.

create table if not exists tel_sesiones (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid,                              -- quien la creó y la opera
  nombre        text not null default 'Sesión de llamadas',
  origen        jsonb not null default '{}'::jsonb, -- {qs, vista, mostrar, filtro…} con qué se armó
  presentacion_nombre text,                        -- «Aarón, de Sacscloud»
  presentacion_motivo text,                        -- «para dar seguimiento a…»
  presentacion_audio_url text,                     -- grabación propia; si es null se usa la voz sintética
  presentacion_voz text not null default 'Polly.Mia-Neural',
  buzon_dejar_mensaje boolean not null default false,
  estado        text not null default 'borrador'
                check (estado in ('borrador','lista','activa','pausada','terminada','cancelada')),
  identity      text,                              -- identidad Twilio del navegador que opera
  sala_sid      text,                              -- ConferenceSid vivo
  agente_call_sid text,                            -- CallSid del navegador dentro de la sala
  agente_en_sala boolean not null default false,
  item_actual   uuid,
  config        jsonb not null default '{}'::jsonb, -- {horario:{ini,fin}, tope_intentos, wrapup_seg, auto_continuar}
  total         int not null default 0,
  contestadas   int not null default 0,
  buzon         int not null default 0,
  sin_contestar int not null default 0,
  porteros      int not null default 0,
  invalidos     int not null default 0,
  segundos_hablados int not null default 0,
  iniciada_at   timestamptz,
  terminada_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists tel_sesiones_owner_idx on tel_sesiones (owner_id, created_at desc);

create table if not exists tel_sesion_items (
  id            uuid primary key default gen_random_uuid(),
  sesion_id     uuid not null references tel_sesiones(id) on delete cascade,
  contact_id    uuid,
  company_id    uuid,
  conversation_id uuid,
  nombre        text,
  empresa       text,
  telefono      text not null,                      -- E.164
  orden         int not null default 0,
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','marcando','timbrando','escuchando','portero','en_linea','cierre','hecho','saltado','excluido')),
  intentos      int not null default 0,
  resultado     text,                               -- contesto|buzon|no_contesto|portero|ocupado|invalido|volver_llamar|no_interesa|dieron_datos
  motivo_exclusion text,
  call_sid      text,
  answered_by   text,                               -- lo que dijo el AMD de Twilio
  veredicto     text,                               -- persona|buzon|portero|duda
  veredicto_fuente text,                            -- reglas|amd|ia|agente
  veredicto_ms  int,                                -- ms desde que contestaron hasta el veredicto
  oido          jsonb not null default '[]'::jsonb, -- [{t, texto, final}] lo que se transcribió
  resumen       text,                               -- lo que se le enseña al vendedor al pasar al mando
  apertura      text,                               -- la primera frase sugerida
  nota          text,
  marcado_at    timestamptz,
  contestado_at timestamptz,
  en_linea_at   timestamptz,
  terminado_at  timestamptz,
  duracion_seg  int,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists tel_sesion_items_sesion_idx on tel_sesion_items (sesion_id, orden);
create index if not exists tel_sesion_items_call_idx on tel_sesion_items (call_sid);

-- La llamada del marcador es una llamada más del historial: se enlaza al item
-- y guarda el resultado con el mismo vocabulario que la cola manual (ABM).
alter table wa_llamadas add column if not exists sesion_item_id uuid;
alter table wa_llamadas add column if not exists resultado text;
create index if not exists wa_llamadas_sesion_item_idx on wa_llamadas (sesion_item_id);

-- «No me llames»: se respeta en el marcador y en la cola manual.
alter table contacts add column if not exists no_llamar boolean not null default false;
