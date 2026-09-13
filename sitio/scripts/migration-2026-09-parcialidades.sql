-- ══ EL PLAN DE PAGOS DE UNA COTIZACIÓN ══════════════════════════════════
--
-- Por qué hace falta una tabla y no bastaba con lo que ya había:
--
-- La cotización COT-78905 (Ruben's, $150,000) se pactó en CINCO pagos de
-- $31,895 —13-ago, 15-sep, 15-oct, 15-nov y 15-dic—, y eso está escrito en el
-- campo `condiciones`, que es texto libre para imprimir en el PDF. El sistema
-- no puede leer ahí: para el tablero esa cotización solo es «$150,000 por
-- cobrar», cuando la verdad es que $30,000 ya entraron y $120,000 entran en
-- fechas conocidas. Ese calendario es dinero futuro con nombre y día, que es
-- justo lo que un tablero tiene que poder sumar.
--
-- `quotes.cobranza_promesa` no alcanza: guarda UNA fecha, la de la próxima
-- promesa de pago. Un plan de cinco mensualidades necesita cinco renglones.
--
-- Lo que NO se guarda aquí: cuánto se ha pagado. Eso se calcula sumando los
-- `payments` ligados a la cotización — si se guardara en dos lados, tarde o
-- temprano uno de los dos miente.
create table if not exists quote_parcialidades (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes(id) on delete cascade,
  numero      int  not null,                       -- 1, 2, 3… el orden del plan
  fecha       date not null,                       -- cuándo toca pagarla
  monto       numeric(12,2) not null check (monto > 0),
  -- Se marca sola cuando entra el pago que la cubre; se puede marcar a mano
  -- cuando el pago llegó por otra vía.
  pagada_at   date,
  payment_id  uuid references payments(id) on delete set null,
  nota        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (quote_id, numero)
);

create index if not exists idx_parcialidades_quote on quote_parcialidades(quote_id);
-- El tablero pregunta «¿qué entra en los próximos 90 días?»: ese índice es el
-- que contesta sin leer la tabla entera.
create index if not exists idx_parcialidades_fecha on quote_parcialidades(fecha) where pagada_at is null;

comment on table quote_parcialidades is
  'Plan de pagos de una cotización: una fila por parcialidad pactada. Lo pagado NO vive aquí, se suma de payments.';
