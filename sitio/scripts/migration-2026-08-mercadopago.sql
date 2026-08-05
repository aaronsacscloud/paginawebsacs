-- ═══ Cobro con Mercado Pago desde el CRM ═══
--
-- OJO con la dirección del dinero: la integración de sacs_api es de cada COMERCIO
-- cobrándole a SUS compradores (OAuth, credenciales por cuenta). Esto es al revés
-- —SACS cobrándole a sus clientes— así que son credenciales propias, una sola
-- cuenta, y viven aquí.

-- 1 · Credenciales de la pasarela, cifradas en reposo (AES-256-GCM, formato
--     enc-v1: — el mismo de helpers/secrets.js de sacs_api, para no inventar un
--     segundo esquema).
create table if not exists crm_pasarelas (
  pasarela            text primary key,            -- 'mercadopago'
  modo                text not null default 'prueba',  -- prueba | produccion
  token_prueba        text,                        -- cifrado
  token_produccion    text,                        -- cifrado
  webhook_secret      text,                        -- cifrado; valida la firma del webhook
  -- Identidad REAL de la cuenta conectada, tal como la reporta MP. No se confía
  -- en lo que diga la casilla: en la integración de tiendas alguien conectó en
  -- "modo prueba" con una credencial de producción y MP cobró de verdad.
  mp_user_id          text,
  mp_nickname         text,
  mp_email            text,
  token_es_produccion boolean,                     -- lo que el token ES, no lo que dice el formulario
  conectada_at        timestamptz,
  ultimo_test_at      timestamptz,
  ultimo_test_ok      boolean,
  ultimo_test_error   text,
  updated_at          timestamptz not null default now()
);

-- 2 · Bitácora de eventos del webhook. Es la PRIMERA defensa contra el duplicado:
--     Mercado Pago reintenta, y si el mismo pago se procesa dos veces la próxima
--     factura se recorre dos ciclos y dejas de cobrar un mes entero sin que nadie
--     lo note. Se inserta ANTES de procesar; si choca, ya se atendió.
create table if not exists crm_webhook_eventos (
  id            uuid primary key default gen_random_uuid(),
  pasarela      text not null,
  evento_id     text not null,        -- id único del aviso (x-request-id o data.id + topic)
  topic         text,
  payload       jsonb,
  recibido_at   timestamptz not null default now(),
  procesado_at  timestamptz,
  resultado     text,                 -- ok | ignorado | error
  detalle       text
);
create unique index if not exists uq_webhook_evento on crm_webhook_eventos (pasarela, evento_id);
create index if not exists ix_webhook_recibido on crm_webhook_eventos (recibido_at desc);

-- 3 · El pago guarda de qué pasarela viene y su id allá. El índice único es la
--     SEGUNDA defensa: aunque el evento pase dos veces por otra vía, el mismo
--     pago de MP no puede quedar registrado dos veces.
alter table payments
  add column if not exists pasarela      text,
  add column if not exists mp_payment_id text,
  add column if not exists comision      numeric,   -- lo que MP se queda; el pago se guarda BRUTO
  add column if not exists neto          numeric;
create unique index if not exists uq_payments_mp on payments (mp_payment_id) where mp_payment_id is not null;

-- 4 · La suscripción sabe con qué se le cobra y con qué está ligada allá.
alter table subscriptions
  add column if not exists pasarela_cobro    text,   -- stripe | mercadopago | manual
  add column if not exists mp_preapproval_id text,   -- suscripción domiciliada
  add column if not exists mp_link_pago      text,   -- link del periodo vigente
  add column if not exists mp_link_periodo   text,   -- a qué periodo corresponde ese link
  add column if not exists mp_link_at        timestamptz;
create unique index if not exists uq_subs_mp_preapproval on subscriptions (mp_preapproval_id) where mp_preapproval_id is not null;
