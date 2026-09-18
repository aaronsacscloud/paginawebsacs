-- LAS ACCIONES QUE PIDE EL CLIENTE EN LA LLAMADA (17-sep-2026)
--
-- Pedido del dueño: «me pidió una acción —enviar la información por WhatsApp—.
-- En el momento en que alguien pida una acción, la IA tiene que ejecutar esa
-- acción y explicar qué acción hizo; y si no reconoce cuál, que yo se la
-- explique para que aprenda.»
--
-- Dos tablas, y la segunda es la que aprende:
--   · tel_acciones       — lo que se oyó, qué acción es, si se hizo y QUÉ PASÓ.
--   · tel_accion_reglas  — las frases que enseñan a reconocerla la próxima vez.

create table if not exists tel_acciones (
  id uuid primary key default gen_random_uuid(),
  -- La llamada. `call_sid` es la llave viva (la sala pregunta por ella);
  -- `item_id` amarra con el riel de Llamadas inteligentes (cierre, envíos).
  call_sid text,
  item_id uuid references tel_sesion_items(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  conversation_id uuid references wa_conversaciones(id) on delete set null,
  telefono text,
  -- Qué acción (id del catálogo de lib/telefonia/acciones.ts) y con qué datos.
  accion text not null,
  params jsonb not null default '{}'::jsonb,
  -- La frase que la disparó, tal cual se oyó: es la evidencia que se le enseña
  -- a quien acaba de colgar, y el ejemplo que aprende la regla.
  frase text,
  origen text not null default 'regla',          -- regla | ia | dictada | manual
  confianza numeric,
  estado text not null default 'propuesta',      -- propuesta | hecha | descartada | fallo
  -- QUÉ PASÓ, en palabras: «salió por plantilla» no es «salió como mensaje».
  resultado text,
  user_id uuid references team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tel_acciones_call_idx on tel_acciones (call_sid);
create index if not exists tel_acciones_item_idx on tel_acciones (item_id);
create index if not exists tel_acciones_fecha_idx on tel_acciones (created_at desc);
-- La misma acción no se propone dos veces en la misma llamada.
create unique index if not exists tel_acciones_una_por_llamada
  on tel_acciones (call_sid, accion) where call_sid is not null;

create table if not exists tel_accion_reglas (
  id uuid primary key default gen_random_uuid(),
  accion text not null,
  patron text not null,
  origen text not null default 'vendedor',       -- semilla | vendedor | ia
  estado text not null default 'activa',         -- activa | propuesta | rechazada
  ejemplo text,
  call_sid text,
  veces integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tel_accion_reglas_unica on tel_accion_reglas (accion, patron);
create index if not exists tel_accion_reglas_estado_idx on tel_accion_reglas (estado);

-- El interruptor de la transcripción en vivo de las llamadas NORMALES
-- (entrantes y marcadas a mano). Encendida por omisión: es lo que permite
-- hacer en el momento lo que el cliente pide. Se apaga aquí si algún día la
-- factura de Twilio lo pide.
alter table wa_config add column if not exists tel_dictado boolean not null default true;

-- LA PRIMERA ENTRADA DE LA BIBLIOTECA DE ENVÍOS.
-- Sin esto, el caso más común —«mándame la información por WhatsApp»— no puede
-- ejecutarse: la sala tendría que preguntar qué mandar justo la primera vez,
-- que es cuando más caro sale no tenerlo. El texto sale de WIKI_COMERCIAL (lo
-- aprobado y público: módulos, planes de /planes y la demo de 15 minutos) y NO
-- trae nada interno — ni datos bancarios, ni política de descuentos. Se edita
-- desde Configuración ▸ Telefonía ▸ «Lo que ya sabemos mandar».
insert into tel_conocimiento (tema, claves, texto, origen, estado)
select 'la información de Sacs',
  array['informacion','info','material','que es','presentacion','planes','precios','demo','general'],
  $txt$Sacs es el sistema para marcas y tiendas de moda en México: punto de venta, inventario por talla y color, tienda en línea y facturación, todo en el mismo lugar.

LO QUE RESUELVE
· Punto de venta rápido, que sigue vendiendo aunque se caiga el internet, con cortes de caja y turnos.
· Inventario por talla y color, en todas tus tiendas, con traspasos entre ellas y conteo físico.
· Tu tienda en línea, WhatsApp, Instagram, TikTok Shop y Mercado Libre trabajando sobre el MISMO inventario.
· Facturación electrónica (CFDI 4.0) directo desde la venta.
· Tus clientas: monedero y puntos, apartados, pedidos y promociones.
· Reportes de lo que se vende, lo que no se mueve y cuánto estás ganando de verdad.

LOS PLANES (precio mensual por sucursal; en anual es alrededor de 35 % menos)
· Vende — $810: tu primera tienda.
· Controla — $1,215: varias tiendas, traspasos y compras de temporada.
· Fideliza y Multiplica — $1,890: tus clientas, monedero, membresías.
· Automatiza — $3,780: automatizaciones e inteligencia artificial.
Cada plan incluye todo lo del anterior. Sin permanencia.

EL SIGUIENTE PASO
Una demostración en línea de 15 minutos, sin costo, con TUS productos dentro del sistema: www.sacscloud.com/agendar/demo

Si hoy trabajas en Excel o en otro sistema, la migración la hacemos nosotros: productos, clientes e historial. Tú no vacías nada a mano.

www.sacscloud.com$txt$,
  'semilla', 'activo'
where not exists (select 1 from tel_conocimiento where tema = 'la información de Sacs');

-- CUÁNTAS VECES LE COLGAMOS SIN HABLAR (18-sep-2026, marcación en paralelo).
-- Cuando alguien contesta, a las otras líneas se les cuelga mientras timbran y
-- vuelven a la lista sin gastarles el intento. Sin contar esos cortes, el mismo
-- contacto podía quedar en ping-pong: marcado, cortado y devuelto una y otra
-- vez, sonándole el teléfono sin que nadie le hable nunca.
alter table tel_sesion_items add column if not exists cortes integer not null default 0;
