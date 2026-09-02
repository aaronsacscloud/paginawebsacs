-- ════════════════════════════════════════════════════════════════════════
-- Comisiones · condición C: puntualidad de la cobranza
-- ════════════════════════════════════════════════════════════════════════
--
-- Tercera condición para cobrar completo la renovación anual: que el dinero
-- ENTRE a tiempo. Antes del vencimiento, el mismo día, o a más tardar 5 días
-- después. Pasado ese margen, esa renovación paga la tasa reducida.
--
-- Por qué es una condición y no un descuento: la comisión de renovación se
-- paga por sostener la cuenta, y sostenerla incluye cobrarla. Una anualidad
-- que entra dos meses tarde ya costó dinero en flujo antes de generar nada.
--
-- El dato ya existe y no hay que inventarlo: `payments.vencia_el` guarda la
-- fecha en que TOCABA pagar, capturada al registrar el pago —antes de que
-- `subscriptions.proxima_factura` se pise con el periodo siguiente—, y
-- `dias_atraso` la diferencia. Negativo = pagó antes de tiempo.
--
-- Si un pago NO trae vencimiento, la puntualidad queda SIN EVALUAR y no
-- castiga. Es la misma regla que el resto del módulo: nunca se cobra de menos
-- por un dato que nadie capturó.

begin;

-- NULL = este modelo no evalúa puntualidad. 5 = el margen del marco.
alter table comision_modelos
  add column if not exists dias_gracia_cobro integer;

alter table comision_lineas
  add column if not exists dias_atraso      integer,
  add column if not exists fuera_de_tiempo  boolean not null default false;

-- El modelo del marco de colaboración sí la evalúa, con 5 días de margen.
update comision_modelos set dias_gracia_cobro = 5
 where es_default and dias_gracia_cobro is null;

commit;
