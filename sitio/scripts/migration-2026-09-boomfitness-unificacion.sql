-- Boom Fitness: cuadrar el cobro unificado de 2026-2027
--
-- Sus dos licencias anuales se unificaron al 2026-09-01 (grupo
-- 1f7b9fc7-4475-4e77-873a-b9e4f069b84a). La cuenta acordada con la clienta:
--
--   3 sucursales                                  $21,420
--   1 sucursal                                  +  $7,140
--   ────────────────────────────────────────────────────
--   Total del periodo                             $28,560
--   − crédito de la unificación (30 días ya pagados) −$1,761
--   − 10% de pronto pago (pagar antes del 26 ago)   −$2,680
--   ────────────────────────────────────────────────────
--   TRANSFIRIÓ                                    $24,119
--
-- Los descuentos cierran exacto: 1,761 + 2,680 = 4,441 = 28,560 − 24,119.
--
-- En el CRM solo se habían registrado $21,420, contra la licencia de 3
-- sucursales. La otra quedó en `pendiente_pago` y Cobranza la mostraba como un
-- adeudo de $7,140 que no existe — de hecho el 2 de septiembre le salieron DOS
-- correos de cobranza el mismo día, uno por cada licencia.
--
-- Este script solo cuadra ESTA cuenta. La causa de fondo —que nadie leía el
-- grupo de cobro— se arregla en el código.

-- 1 · El resto de la misma transferencia, contra la licencia que faltaba.
insert into payments (company_id, subscription_id, fecha, monto, metodo, estado, periodo_cubierto, notas)
select s.company_id, s.id, '2026-08-31', 2699, 'transferencia', 'confirmado', '2026',
       'Resto de la transferencia unificada de $24,119 del 31-ago-2026 (los otros $21,420 se registraron contra la licencia de 3 sucursales). La diferencia contra los $28,560 de lista son $1,761 de crédito por la unificación de fechas y $2,680 del 10% de pronto pago.'
  from subscriptions s
 where s.id = '3dd280d0-07c1-4dd7-9b37-56f86c22e553';

-- 2 · La licencia que faltaba queda pagada y alineada al grupo.
update subscriptions
   set estado           = 'activa',
       proxima_factura  = '2027-09-01',
       saldo_favor      = 0,
       pagos_realizados = pagos_realizados + 1,
       total_pagado     = total_pagado + 2699,
       updated_at       = now()
 where id = '3dd280d0-07c1-4dd7-9b37-56f86c22e553';

-- 3 · La de 3 sucursales: se consume el crédito (ya venía descontado en los
--     $24,119) y se alinea al MISMO día que su grupo. Estaba en 2027-08-31,
--     un día antes, por una fecha tecleada a mano al registrar el pago: si se
--     queda así, las dos se vuelven a separar en la siguiente renovación y la
--     unificación habría durado un año.
update subscriptions
   set proxima_factura = '2027-09-01',
       saldo_favor     = 0,
       updated_at      = now()
 where id = 'e55c78c0-8957-4614-b5a9-5cd4d74cdc13';
