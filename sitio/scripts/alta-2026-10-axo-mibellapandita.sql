-- ═══ AXO como producto + venta de AXO Super Power a Mi Bella Pandita (23-oct-2026) ═══
--
-- Pedido del dueño: los planes de AXO (presentación «AXO · noviembre 2026») como producto
-- nuevo en el catálogo, igual que las licencias, y una cotización ya aceptada y pagada de
-- AXO Super Power para mibellapandita, con acceso desde el lunes 26-oct-2026 y cobro el día
-- 26 de cada mes.
--
-- Se hizo con los endpoints del CRM (no con SQL), así que deal, pago, acuse y suscripción
-- nacieron como en cualquier venta:
--   POST /api/crm/arr/plans (x5, categoria 'axo')      → axo_starter, axo_pro, axo_super_power,
--                                                          axo_super_power_20x, axo_corporativo_50x
--   POST /api/revenue/quotes                            → COT-80137 ($10,500 + IVA = $12,180)
--   POST /api/revenue/mark-accepted                     → aceptada por Mi Bella Pandita
--   POST /api/revenue/mark-paid (enviar_acuse:false)    → acuse AC-2026-0128, sub activa
-- y un solo ajuste a mano, a la suscripción (este UPDATE):
update subscriptions
   set nombre_plan = 'AXO Super Power',
       plan_id = (select id from plans where slug = 'axo_super_power'),
       fecha_inicio = '2026-10-26', proxima_factura = '2026-11-26',
       mrr = 10500, arr = 126000          -- sin IVA; monto_proximo sigue en $12,180 con IVA
 where quote_id = (select id from quotes where numero = 'COT-80137');
--
-- Lo que INCLUYE cada plan (para cotización y acuse) vive en src/data/axo-planes.ts.
--
-- PARA DESHACER la venta:
--   delete from subscriptions where quote_id = (select id from quotes where numero='COT-80137');
--   delete from payments      where quote_id = (select id from quotes where numero='COT-80137');
--   delete from deals         where quote_id = (select id from quotes where numero='COT-80137');
--   delete from quotes        where numero   = 'COT-80137';
-- Y los planes (solo si nadie los usa): delete from plans where categoria = 'axo';
