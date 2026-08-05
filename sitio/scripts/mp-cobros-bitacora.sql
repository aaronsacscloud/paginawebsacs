-- ═══ Bitácora de cobros de Mercado Pago que NO terminan en un pago registrado ═══
--
-- Hasta ahora solo se guardaba lo que salía bien. Todo lo demás se perdía:
--   · un cobro aprobado que no se pudo atribuir a nadie  -> se contestaba 200 y ahí moría
--   · una tarjeta rechazada                              -> ni se miraba
-- Las dos cosas son dinero: la primera es un pago que alguien hizo y nadie acreditó,
-- la segunda es la única señal temprana de que un cliente se va a caer este mes.
create table if not exists crm_cobros_mp (
  id              uuid primary key default gen_random_uuid(),
  mp_payment_id   text not null,
  preapproval_id  text,
  subscription_id uuid references subscriptions(id) on delete set null,
  company_id      uuid references companies(id) on delete cascade,
  payer_email     text,
  monto           numeric not null default 0,
  moneda          text not null default 'MXN',
  -- estado de MP tal cual: approved | rejected | cancelled | refunded | in_process…
  estado          text not null,
  -- status_detail de MP: cc_rejected_insufficient_amount, cc_rejected_call_for_authorize…
  detalle_estado  text,
  motivo          text,               -- el detalle traducido a español
  metodo          text,
  fecha           timestamptz,
  external_reference text,
  -- Resolución humana: 'asignado' cuando se acreditó a una suscripción,
  -- 'descartado' cuando no era nuestro (una devolución, una prueba, otro negocio).
  resolucion      text,
  resuelto_at     timestamptz,
  resuelto_por    text,
  nota            text,
  created_at      timestamptz not null default now()
);
-- Un pago de MP entra UNA vez: el webhook reintenta y la conciliación puede
-- volver a verlo, y dos filas del mismo cobro serían dos avisos de cobranza.
create unique index if not exists ux_cobros_mp_pago on crm_cobros_mp (mp_payment_id);
create index if not exists ix_cobros_mp_pendientes on crm_cobros_mp (estado, resolucion, fecha desc);
create index if not exists ix_cobros_mp_company on crm_cobros_mp (company_id, fecha desc);

-- ═══ Desfase de precio (punto 8) ═══
-- Cuando lo que cobra MP deja de coincidir con lo que dice la suscripción, el
-- ARR reportado es falso y nadie lo nota. Se marca en la suscripción para poder
-- señalarlo donde se ve, no solo en un reporte.
alter table subscriptions add column if not exists mp_monto_cobrado numeric;
alter table subscriptions add column if not exists mp_desfase_at timestamptz;
