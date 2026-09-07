-- Ferias y eventos físicos · 2026-09-07
--
-- Cuatro niveles, y cada uno responde una pregunta distinta:
--   ev_eventos     ¿QUÉ evento existe y vale la pena?   (catálogo: Intermoda, SAPICA…)
--   ev_ediciones   ¿CUÁNDO y en dónde, y qué decidimos?  (una fila por fecha; Expo Tu Boda son 8 al año)
--   ev_registros   ¿A QUIÉN conocimos ahí?               (cada persona es un contacts real: NO es un lead paralelo)
--   ev_gastos      ¿CUÁNTO costó?                         (sin esto el ROI es opinión)
-- Más ev_tareas (la lista de preparación con fechas) y ev_expositores (a quién ir a buscar
-- cuando el evento lo recorremos en vez de poner stand).

create table if not exists ev_eventos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  tipo text not null default 'feria_comercial',   -- feria_comercial|expo_consumidor|zona_mayoreo|semana_moda|congreso|feria_retail_tech
  giros text[] not null default '{}',
  organizador text, sede text, ciudad text, estado_geo text,
  sitio_web text, instagram text, correo_contacto text, telefono text,
  frecuencia text,
  expositores_n int, visitantes_n int, fuente_cifras text,
  perfil_expositor text, perfil_visitante text,
  costo_stand text, costo_entrada text, fuente_costos text,
  como_participar text,
  area_tecnologia boolean,
  descripcion text,
  quien_es_prospecto text,                         -- expositores|visitantes|ambos
  fit_puntaje int default 0, fit_por_que text, rol_recomendado text, prospectos_alcanzables text,
  huecos text,
  fuentes jsonb default '[]'::jsonb,
  decision text not null default 'evaluar',        -- ir|evaluar|no_ir
  decision_nota text, decision_por uuid, decision_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint ev_eventos_decision_ck check (decision in ('ir','evaluar','no_ir'))
);

create table if not exists ev_ediciones (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references ev_eventos(id) on delete cascade,
  nombre text not null,                            -- "Intermoda 86", "Expo Tu Boda CDMX marzo"
  inicio date not null, fin date,
  estado_fecha text not null default 'estimada',   -- confirmada|estimada|pasada
  fuente_fecha text,
  ciudad text, sede text,
  limite_registro date,                            -- para apartar stand; si no se sabe, 90 días antes
  url_registro text,
  participacion text not null default 'sin_decidir',  -- sin_decidir|vamos|no_vamos|fuimos
  rol text,                                        -- stand|recorrido|visitante|patrocinio
  stand_numero text,
  meta_registros int, meta_demos int, meta_clientes int,
  presupuesto numeric,
  equipo jsonb default '[]'::jsonb,                -- [{id,nombre}]
  notas text,
  retro jsonb,                                     -- {que_funciono, que_no, repetir, aprendizajes, cerrada_at}
  token_publico text,                              -- la liga del QR: /e/<token>
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint ev_ediciones_part_ck check (participacion in ('sin_decidir','vamos','no_vamos','fuimos'))
);
create index if not exists ev_ediciones_evento_ix on ev_ediciones (evento_id, inicio);
create index if not exists ev_ediciones_inicio_ix on ev_ediciones (inicio);
create unique index if not exists ev_ediciones_token_ux on ev_ediciones (token_publico) where token_publico is not null;

-- Cada registro ES un contacto del CRM (contact_id). Aquí solo vive lo que
-- pasó en el evento: quién lo capturó, qué tan caliente salió, qué dijo.
create table if not exists ev_registros (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid not null references ev_ediciones(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  abm_cuenta_id uuid references abm_cuentas(id) on delete set null,
  capturado_por uuid, capturado_por_nombre text,
  capturado_at timestamptz default now(),
  modo text not null default 'stand',              -- stand|recorrido|qr
  nombre text, empresa text, puesto text, giro text, sucursales int, sistema_actual text,
  whatsapp text, email text, ciudad text, instagram text,
  temperatura text default 'tibio',                -- caliente|tibio|frio
  quiere_demo boolean default false,
  interes text, nota text, foto_url text,
  stand_visitado text,
  consentimiento boolean default false, consentimiento_at timestamptz,
  ya_era text,                                     -- null|cliente|cuenta_objetivo|contacto  (lo que ya sabíamos de él)
  bienvenida_wa_at timestamptz, bienvenida_wa_error text,
  bienvenida_email_at timestamptz,
  cliente_local_id text,                           -- id que generó el teléfono sin red (anti-duplicado al sincronizar)
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint ev_registros_temp_ck check (temperatura in ('caliente','tibio','frio')),
  constraint ev_registros_modo_ck check (modo in ('stand','recorrido','qr'))
);
create index if not exists ev_registros_edicion_ix on ev_registros (edicion_id, capturado_at desc);
create index if not exists ev_registros_contact_ix on ev_registros (contact_id);
create unique index if not exists ev_registros_local_ux on ev_registros (edicion_id, cliente_local_id) where cliente_local_id is not null;

create table if not exists ev_gastos (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid not null references ev_ediciones(id) on delete cascade,
  concepto text not null,
  categoria text not null default 'otro',          -- stand|viaje|material|personal|muestras|otro
  monto numeric not null default 0,
  fecha date default current_date,
  nota text, registrado_por uuid,
  created_at timestamptz default now()
);
create index if not exists ev_gastos_edicion_ix on ev_gastos (edicion_id);

create table if not exists ev_tareas (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid not null references ev_ediciones(id) on delete cascade,
  titulo text not null,
  fase text not null default 'antes',              -- antes|durante|despues
  vence date,
  orden int default 0,
  hecha boolean default false, hecha_at timestamptz, hecha_por uuid,
  clave text,                                      -- de la plantilla, para no duplicar al regenerar
  created_at timestamptz default now()
);
create index if not exists ev_tareas_edicion_ix on ev_tareas (edicion_id, fase, orden);

-- A quién buscar en el pasillo: cuentas objetivo que exponen en esa edición.
create table if not exists ev_expositores (
  id uuid primary key default gen_random_uuid(),
  edicion_id uuid not null references ev_ediciones(id) on delete cascade,
  abm_cuenta_id uuid references abm_cuentas(id) on delete cascade,
  nombre text not null, stand text, pabellon text,
  visitado boolean default false, visitado_at timestamptz, visitado_por uuid,
  registro_id uuid references ev_registros(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists ev_expositores_edicion_ix on ev_expositores (edicion_id, visitado, stand);
create unique index if not exists ev_expositores_ux on ev_expositores (edicion_id, abm_cuenta_id);  -- completo, no parcial: PostgREST no manda el predicado en ON CONFLICT

alter table ev_eventos     enable row level security;
alter table ev_ediciones   enable row level security;
alter table ev_registros   enable row level security;
alter table ev_gastos      enable row level security;
alter table ev_tareas      enable row level security;
alter table ev_expositores enable row level security;

-- La bienvenida automática se decide por edición: qué plantilla de WhatsApp (aprobada por
-- Meta, tipo utilidad, con {{1}} nombre y {{2}} evento) y si también va correo.
alter table ev_ediciones add column if not exists plantilla_wa text, add column if not exists email_bienvenida boolean default true;
