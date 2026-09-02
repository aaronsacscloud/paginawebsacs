-- ════════════════════════════════════════════════════════════════════════
-- Motor de comisiones configurable
-- ════════════════════════════════════════════════════════════════════════
--
-- Qué resuelve: hasta ahora la comisión era un número suelto en
-- team_members.default_commission_pct y una tabla manual (partner_commissions,
-- 0 filas). No había forma de decir "este SKU paga 30% y este otro 55%", ni de
-- saber a quién le toca una venta: contacts.owner_id, subscriptions.partner_id
-- y payments.partner_id estaban TODOS en cero sobre 341 cuentas.
--
-- El modelo tiene cuatro piezas y el orden importa:
--
--   1. MODELO   — el esquema de comisiones, con nombre. Se asigna POR USUARIO,
--                 así cada consultor puede tener condiciones distintas.
--   2. REGLAS   — el % por SKU × origen del cliente. Gana la más específica.
--   3. ATRIBUCIÓN — quién es el dueño de la cuenta y con qué origen entró.
--                 Sin esto no hay a quién pagarle: es el prerrequisito.
--   4. LÍNEAS   — el cálculo, una por pago. Se recalcula a diario y es
--                 idempotente; lo ya PAGADO nunca se recalcula.
--
-- La comisión se genera del PAGO COBRADO, nunca de lo facturado o prometido.

begin;

-- ═══════════════════════════════════════════════════════════════════
-- 1 · MODELOS
-- ═══════════════════════════════════════════════════════════════════
create table if not exists comision_modelos (
  id                       uuid primary key default gen_random_uuid(),
  nombre                   text not null,
  descripcion              text,
  activo                   boolean not null default true,
  es_default               boolean not null default false,

  -- Descuento aplicado al monto cobrado ANTES de sacar el porcentaje. Existe
  -- porque el pago al consultor se hace sin factura de por medio: el 16% es el
  -- IVA que se entera al SAT y el 6% el costo de dispersión de la pagadora.
  desc_corporativa_pct     numeric not null default 16,
  desc_pagadora_pct        numeric not null default 6,
  -- Qué cuenta se asume cuando el pago no dice cuál fue.
  cuenta_default           text not null default 'corporativa',

  -- Tasa reducida cuando la cuenta no cumplió las condiciones de renovación.
  -- NULL = este modelo no usa esa figura.
  tasa_incumplimiento_pct  numeric,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint comision_modelos_cuenta_ck
    check (cuenta_default in ('corporativa', 'pagadora', 'ninguna'))
);

-- Un solo modelo por defecto. Índice parcial: deja tener muchos con false.
create unique index if not exists comision_modelos_default_uniq
  on comision_modelos (es_default) where es_default;

-- ═══════════════════════════════════════════════════════════════════
-- 2 · REGLAS  (el % por SKU × origen)
-- ═══════════════════════════════════════════════════════════════════
--
-- Una regla puede apuntar a un SKU exacto (plan_id), a toda una categoría
-- (categoria) o a cualquier cosa (ambos NULL), y cruzarse o no con el origen
-- del cliente. Gana la MÁS ESPECÍFICA; el desempate se calcula en la lib, no
-- aquí, para poder explicarlo en pantalla.
create table if not exists comision_reglas (
  id           uuid primary key default gen_random_uuid(),
  modelo_id    uuid not null references comision_modelos(id) on delete cascade,
  plan_id      uuid references plans(id) on delete cascade,
  categoria    text,
  origen       text,
  pct          numeric not null,
  nota         text,
  created_at   timestamptz not null default now(),
  constraint comision_reglas_pct_ck check (pct >= 0 and pct <= 100),
  constraint comision_reglas_origen_ck
    check (origen is null or origen in ('lead_sacs','referido','recuperada','heredado'))
);

create index if not exists comision_reglas_modelo_idx on comision_reglas (modelo_id);

-- No dos reglas para la misma combinación exacta. Los NULL no chocan entre sí
-- en un índice normal, por eso se normalizan con coalesce.
create unique index if not exists comision_reglas_combo_uniq on comision_reglas (
  modelo_id,
  coalesce(plan_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(categoria, '*'),
  coalesce(origen, '*')
);

-- ═══════════════════════════════════════════════════════════════════
-- 3 · ATRIBUCIÓN
-- ═══════════════════════════════════════════════════════════════════
-- El origen es del CLIENTE y se fija una sola vez, al registrarlo. Vive en
-- companies porque eso es lo que dice el marco de colaboración; la suscripción
-- solo lo sobrescribe cuando una venta concreta le toca a alguien más.
alter table companies
  add column if not exists comision_owner_id  uuid references team_members(id),
  add column if not exists comision_origen    text,
  add column if not exists comision_origen_at timestamptz,
  add column if not exists comision_nota      text;

do $$ begin
  alter table companies add constraint companies_comision_origen_ck
    check (comision_origen is null or comision_origen in ('lead_sacs','referido','recuperada','heredado'));
exception when duplicate_object then null; end $$;

create index if not exists companies_comision_owner_idx on companies (comision_owner_id);

alter table subscriptions
  add column if not exists comision_owner_id uuid references team_members(id),
  add column if not exists comision_origen   text;

do $$ begin
  alter table subscriptions add constraint subscriptions_comision_origen_ck
    check (comision_origen is null or comision_origen in ('lead_sacs','referido','recuperada','heredado'));
exception when duplicate_object then null; end $$;

-- En qué cuenta cayó realmente el dinero. NULL = usar cuenta_default del modelo.
alter table payments
  add column if not exists comision_cuenta text;

do $$ begin
  alter table payments add constraint payments_comision_cuenta_ck
    check (comision_cuenta is null or comision_cuenta in ('corporativa','pagadora','ninguna'));
exception when duplicate_object then null; end $$;

-- El modelo que le aplica a cada persona. NULL = el modelo por defecto.
alter table team_members
  add column if not exists comision_modelo_id uuid references comision_modelos(id);

-- ═══════════════════════════════════════════════════════════════════
-- 4 · LÍNEAS CALCULADAS
-- ═══════════════════════════════════════════════════════════════════
create table if not exists comision_lineas (
  id               uuid primary key default gen_random_uuid(),
  payment_id       uuid not null references payments(id) on delete cascade,
  owner_id         uuid not null references team_members(id) on delete cascade,
  modelo_id        uuid references comision_modelos(id) on delete set null,
  regla_id         uuid references comision_reglas(id) on delete set null,

  company_id       uuid references companies(id) on delete set null,
  subscription_id  uuid references subscriptions(id) on delete set null,
  plan_id          uuid references plans(id) on delete set null,

  -- La fecha del PAGO es la que define el periodo. No la de la suscripción ni
  -- la del cálculo: se comisiona dinero cobrado, y el periodo es cuándo entró.
  fecha            date not null,

  concepto         text,
  categoria        text,
  origen           text,

  monto_bruto      numeric not null,
  cuenta           text,
  descuento_pct    numeric not null default 0,
  base             numeric not null,
  pct              numeric not null,
  monto            numeric not null,

  estado           text not null default 'calculada',
  -- true = ninguna regla del modelo cubre este pago. La línea se crea igual,
  -- en ceros, para que el hueco SE VEA en el periodo en vez de desaparecer.
  sin_regla        boolean not null default false,
  detalle          jsonb,

  pagada_at        timestamptz,
  pago_referencia  text,
  calculado_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),

  constraint comision_lineas_estado_ck
    check (estado in ('calculada','aprobada','pagada','cancelada'))
);

-- Un pago paga una vez a cada persona. Es lo que hace idempotente el recálculo.
create unique index if not exists comision_lineas_pago_owner_uniq
  on comision_lineas (payment_id, owner_id);
create index if not exists comision_lineas_periodo_idx on comision_lineas (fecha, owner_id);
create index if not exists comision_lineas_estado_idx  on comision_lineas (estado);

commit;
