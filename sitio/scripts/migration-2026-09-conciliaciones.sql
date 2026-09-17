-- Cartas de conciliación con firma — 17-sep-2026
--
-- Pedido del dueño: «hacer carta de conciliación y proceso para conciliación de
-- los clientes perdidos (ya tengo 3 que me dijeron que sí les interesa). Una
-- carta tipo acuerdo con su link, para que me den el sí, firmen, y se inicie el
-- proceso de reconciliación.»
--
-- DECISIÓN DE DISEÑO: los TÉRMINOS son un campo, no código.
-- Cada conciliación es una negociación distinta —a uno se le perdona un adeudo,
-- a otro se le baja el precio, a otro se le regalan meses—. Codificar «la carta
-- de conciliación» obligaría a un deploy por cada trato. Aquí el documento se
-- arma con lo que el dueño escriba para ESE cliente, y el sistema aporta lo que
-- sí es igual siempre: la identidad del firmante, el rastro y la fecha.
--
-- LO QUE HACE QUE UNA FIRMA VALGA: no es el garabato, es poder demostrar QUIÉN
-- aceptó QUÉ y CUÁNDO. Por eso se guarda el texto exacto que se le enseñó
-- (`cuerpo` no se edita después de enviada), su nombre, su IP y el momento.
-- Si el documento se pudiera editar después de firmado, la firma no probaría
-- nada.

create table if not exists conciliaciones (
  id           uuid primary key default gen_random_uuid(),
  -- El link público va por token y no por id: un id secuencial o adivinable
  -- deja pasear por los acuerdos de otros clientes.
  token        text not null unique default encode(gen_random_bytes(24), 'hex'),
  company_id   uuid,
  contact_id   uuid references contacts(id) on delete set null,

  titulo       text not null default 'Propuesta de conciliación',
  -- El acuerdo, tal cual se le enseña. Markdown simple.
  cuerpo       text not null,
  -- Lo que se le ofrece, para poder medir después qué funcionó.
  monto        numeric,
  moneda       text default 'MXN',
  vigencia     date,

  estado       text not null default 'borrador'
               check (estado in ('borrador','enviada','aceptada','rechazada','vencida')),
  enviada_at   timestamptz,
  -- La firma: quién dijo que sí, desde dónde y cuándo.
  aceptada_at  timestamptz,
  firmante     text,
  firmante_ip  text,
  rechazada_at timestamptz,
  rechazo_motivo text,

  creado_por   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists conciliaciones_contacto_idx on conciliaciones (contact_id, created_at desc);
create index if not exists conciliaciones_estado_idx on conciliaciones (estado, created_at desc);
