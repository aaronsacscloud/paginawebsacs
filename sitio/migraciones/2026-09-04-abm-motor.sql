-- Motor Account-Based (prospección de moda) · 2026-09-04
-- Los prospectos viven APARTE de companies/subscriptions: no tocan el ARR.

create table if not exists abm_cuentas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  giro text not null,                    -- renta, novias, zapaterias, joyeria, canal...
  subgiro text,
  ciudad text, estado_geo text,
  pais text not null default 'México',
  moneda text not null default 'MXN',
  sucursales int, sucursales_confianza text default 'media',
  tamano text,                           -- micro | chica | mediana | grande
  ruta text,                             -- demo | diagnostico  (5+ sucursales = diagnostico)
  sitio text, plataforma_web text, sitio_http int, sitio_seg numeric, sitio_carrito boolean,
  instagram text, ig_seguidores text, tiktok text, facebook text, linkedin text,
  google_rating numeric, google_resenas int,
  fundacion int, historia text, modelo text, contexto text,
  senal_expansion text, ultima_publicacion text, nota text,
  encaje int default 0, dolor int default 0, accesibilidad int default 0, puntaje int default 0,
  etapa text not null default 'sin_tocar',
  responsable_id uuid,
  ya_es_cliente text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  constraint abm_cuentas_etapa_ck check (etapa in
    ('sin_tocar','en_cadencia','respondio','reunion','diagnostico','propuesta','ganada','perdida','no_contactar'))
);
create index if not exists abm_cuentas_giro_ix on abm_cuentas (giro, puntaje desc);
create index if not exists abm_cuentas_etapa_ix on abm_cuentas (etapa, updated_at desc);
create unique index if not exists abm_cuentas_nombre_ux on abm_cuentas (lower(nombre), coalesce(ciudad,''));

create table if not exists abm_personas (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references abm_cuentas(id) on delete cascade,
  nombre text not null, cargo text, es_dueno boolean default false,
  email text, telefono text, whatsapp text, linkedin text, facebook text, instagram text,
  confirmado boolean default false, confirmado_por uuid, confirmado_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists abm_personas_cuenta_ix on abm_personas (cuenta_id);

create table if not exists abm_canales (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references abm_cuentas(id) on delete cascade,
  persona_id uuid references abm_personas(id) on delete set null,
  tipo text not null,                    -- email_direccion|email_generico|whatsapp_tienda|whatsapp_dueno|telefono|dm_ig|dm_fb|linkedin
  valor text not null,
  confianza text not null default 'media',   -- alta | media | baja
  estado text not null default 'sin_probar', -- sin_probar|valido|rebote|invalido|no_contesta|opt_out
  es_de_la_tienda boolean default true,
  verificado_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists abm_canales_cuenta_ix on abm_canales (cuenta_id, tipo);

create table if not exists abm_fuentes (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references abm_cuentas(id) on delete cascade,
  campo text not null, valor text, url text,
  metodo text,                            -- sitio_oficial|aviso_privacidad|facebook_info|google_maps|localizador|prensa|directorio|escaner
  confianza text not null default 'media',
  obtenido_at timestamptz default now(), agente text
);
create index if not exists abm_fuentes_cuenta_ix on abm_fuentes (cuenta_id, campo);

create table if not exists abm_senales (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references abm_cuentas(id) on delete cascade,
  tipo text not null,                     -- apertura|vacante|resena_mala|sitio_caido|cambio_gerente|feria|post
  detalle text, url text,
  fecha date default current_date, caduca_at date,
  peso int default 1, created_at timestamptz default now()
);
create index if not exists abm_senales_cuenta_ix on abm_senales (cuenta_id, fecha desc);

create table if not exists abm_plantillas (
  id uuid primary key default gen_random_uuid(),
  giro text not null, canal text not null default 'email',
  nombre text not null, orden int default 1,
  asunto text, cuerpo text not null, formato text default 'texto',  -- texto | html
  objetivo text, variables jsonb default '[]'::jsonb,
  activa boolean default true, created_at timestamptz default now()
);

create table if not exists abm_cadencias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null, giro text not null, ruta text not null default 'demo',
  descripcion text, activa boolean default true,
  creada_por text default 'sistema', created_at timestamptz default now()
);

create table if not exists abm_pasos (
  id uuid primary key default gen_random_uuid(),
  cadencia_id uuid not null references abm_cadencias(id) on delete cascade,
  dia int not null, orden int default 1,
  canal text not null,                    -- email|whatsapp|llamada|linkedin|dm_ig|dm_fb
  plantilla_id uuid references abm_plantillas(id) on delete set null,
  automatico boolean default true, condicion text, nota text
);
create index if not exists abm_pasos_cadencia_ix on abm_pasos (cadencia_id, dia, orden);

create table if not exists abm_toques (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references abm_cuentas(id) on delete cascade,
  cadencia_id uuid references abm_cadencias(id) on delete set null,
  paso_id uuid references abm_pasos(id) on delete set null,
  persona_id uuid references abm_personas(id) on delete set null,
  canal text not null, destino text,
  asunto text, cuerpo text,
  estado text not null default 'borrador', -- borrador|aprobado|programado|enviado|saltado|cancelado|fallido
  programado_at timestamptz, enviado_at timestamptz,
  mensaje_id text, resultado text,
  aprobado_por uuid, aprobado_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists abm_toques_pend_ix on abm_toques (estado, programado_at);
create index if not exists abm_toques_cuenta_ix on abm_toques (cuenta_id, created_at desc);

create table if not exists abm_actividad (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references abm_cuentas(id) on delete cascade,
  persona_id uuid references abm_personas(id) on delete set null,
  toque_id uuid references abm_toques(id) on delete set null,
  canal text not null, tipo text not null,  -- envio|entrega|apertura|clic|respuesta|rebote|spam|baja|llamada|whatsapp|dm|nota|reunion
  detalle jsonb default '{}'::jsonb, texto text, transcripcion text,
  ocurrio_at timestamptz default now(), created_at timestamptz default now()
);
create index if not exists abm_actividad_cuenta_ix on abm_actividad (cuenta_id, ocurrio_at desc);
create index if not exists abm_actividad_tipo_ix on abm_actividad (tipo, ocurrio_at desc);

create table if not exists abm_no_contactar (
  id uuid primary key default gen_random_uuid(),
  valor text not null unique, tipo text not null default 'email',
  motivo text, creado_at timestamptz default now()
);

alter table abm_cuentas    enable row level security;
alter table abm_personas   enable row level security;
alter table abm_canales    enable row level security;
alter table abm_fuentes    enable row level security;
alter table abm_senales    enable row level security;
alter table abm_plantillas enable row level security;
alter table abm_cadencias  enable row level security;
alter table abm_pasos      enable row level security;
alter table abm_toques     enable row level security;
alter table abm_actividad  enable row level security;
alter table abm_no_contactar enable row level security;
