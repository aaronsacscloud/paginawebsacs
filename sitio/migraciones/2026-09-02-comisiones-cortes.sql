-- ════════════════════════════════════════════════════════════════════════
-- Comisiones · el CORTE como entidad
-- ════════════════════════════════════════════════════════════════════════
--
-- Hasta ahora "el periodo" era solo un filtro de fechas en una pantalla. Eso
-- alcanza para mirar, pero no para operar: no hay nada que cerrar, nada que
-- enviar al consultor, nada que marcar como pagado de una vez, y ningún lugar
-- donde meter lo que el cálculo automático no supo resolver.
--
-- El corte convierte ese filtro en un documento con estado:
--
--   abierto   se está formando. El recálculo lo refresca cada madrugada.
--   cerrado   ya se le envió al consultor. No absorbe nada nuevo.
--   pagado    liquidado. No se toca jamás.
--
-- Y trae la pieza que faltaba: los AJUSTES. Un pago que el sistema no supo
-- comisionar —sin SKU, sin dueño, capturado raro— se agrega a mano como ajuste
-- en vez de perderse. Si el corte ya se cerró, el ajuste queda PENDIENTE
-- (corte_id NULL) y lo absorbe el siguiente automáticamente: es lo que hace que
-- nada se caiga entre dos semanas.

begin;

-- ═══ 1 · El corte ═══
create table if not exists comision_cortes (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references team_members(id) on delete restrict,

  -- El ciclo del marco: lunes a viernes, se paga el lunes siguiente.
  desde           date not null,
  hasta           date not null,
  paga_el         date,

  estado          text not null default 'abierto',
  -- false = lo generó una persona para un periodo especifico, fuera del ciclo.
  automatico      boolean not null default true,

  lineas          integer not null default 0,
  monto_lineas    numeric not null default 0,
  monto_ajustes   numeric not null default 0,
  total           numeric not null default 0,

  generado_at     timestamptz not null default now(),
  cerrado_at      timestamptz,
  pagado_at       timestamptz,
  pago_referencia text,
  nota            text,
  created_at      timestamptz not null default now(),

  constraint comision_cortes_estado_ck check (estado in ('abierto','cerrado','pagado')),
  constraint comision_cortes_rango_ck  check (hasta >= desde)
);

-- Un solo corte automático por persona y periodo. Los manuales pueden
-- repetirse: son consultas puntuales, no el ciclo.
create unique index if not exists comision_cortes_auto_uniq
  on comision_cortes (owner_id, desde, hasta) where automatico;
create index if not exists comision_cortes_owner_idx  on comision_cortes (owner_id, desde desc);
create index if not exists comision_cortes_estado_idx on comision_cortes (estado);

-- ═══ 2 · La línea sabe en qué corte se fue ═══
alter table comision_lineas
  add column if not exists corte_id uuid references comision_cortes(id) on delete set null;
create index if not exists comision_lineas_corte_idx on comision_lineas (corte_id);

-- ═══ 3 · Ajustes ═══
--
-- corte_id NULL = PENDIENTE: todavía no entró a ningún corte y el siguiente que
-- se genere para esa persona lo absorbe. Es la mecánica de "agrégalo ahí mismo
-- y que lo considere para la próxima".
create table if not exists comision_ajustes (
  id           uuid primary key default gen_random_uuid(),
  corte_id     uuid references comision_cortes(id) on delete set null,
  owner_id     uuid not null references team_members(id) on delete restrict,

  -- abono = súmale al consultor · cargo = réstale
  tipo         text not null,
  concepto     text not null,
  monto        numeric not null,

  -- Si el ajuste nace de un pago que el cálculo no supo comisionar, queda
  -- ligado: así el mismo pago no se agrega dos veces y se puede auditar.
  payment_id   uuid references payments(id) on delete set null,

  nota         text,
  creado_por   uuid references team_members(id) on delete set null,
  created_at   timestamptz not null default now(),

  constraint comision_ajustes_tipo_ck  check (tipo in ('abono','cargo')),
  constraint comision_ajustes_monto_ck check (monto > 0)
);

create index if not exists comision_ajustes_corte_idx on comision_ajustes (corte_id);
-- Los pendientes se buscan por dueño en cada generación.
create index if not exists comision_ajustes_pend_idx  on comision_ajustes (owner_id) where corte_id is null;
-- Un pago no reconocido no se puede agregar dos veces.
create unique index if not exists comision_ajustes_pago_uniq
  on comision_ajustes (payment_id, owner_id) where payment_id is not null;

commit;
