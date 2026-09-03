-- ═══ Adeudo de Dibujo Técnico: $50,000 de personalización, 20-sep-2026 ═══
--
-- Pedido del dueño (3-sep-2026): un cobro SEGURO que hay que contemplar en
-- cuentas por cobrar y que tiene que verse en la ficha del cliente.
--
-- POR QUÉ UNA COTIZACIÓN Y NO OTRA COSA:
-- No es una suscripción (no se renueva) ni un gasto. Es una venta cerrada
-- pendiente de cobro, y en este CRM eso se llama cotización aceptada. Además
-- es el ÚNICO vehículo que hoy alimenta «Por cobrar este mes» además de las
-- renovaciones: el plan de parcialidades (`meta.plan_pagos`). Inventar una
-- tabla nueva dejaría el cobro fuera del tablero, que es justo lo que se pidió
-- evitar.
--
-- El plan lleva UNA exhibición: el 20-sep por los $50,000 completos. Es lo que
-- lo hace aparecer en el mes y en el flujo semanal, en su fecha.
--
-- IVA INCLUIDO, como lo dijo el dueño: el total es 50,000 y de ahí se desglosa
--   base   $43,103.45
--   IVA    $ 6,896.55   (50,000 − 50,000/1.16)
--   total  $50,000.00
-- Si se hubiera capturado con IVA por fuera, el cobro real habrían sido
-- $58,000 y el mes quedaría inflado en $8,000.
--
-- PARA DESHACER (borra la cotización y su oportunidad):
--   delete from deals  where quote_id = (select id from quotes where numero='COT-80128');
--   delete from quotes where numero = 'COT-80128';

insert into quotes (
  numero, estado, tipo, created_via,
  company_id, contact_id, empresa, contacto, email, whatsapp,
  items, subtotal, total, moneda,
  iva_incluido, iva_monto,
  descuento_global, descuento_tipo,
  aceptado_fecha, aceptado_por, vigencia, updated_at,
  condiciones, notas
)
select
  'COT-80128', 'accepted', null, 'admin',
  c.id, k.id, c.nombre_comercial, k.nombre, k.email, k.whatsapp,
  jsonb_build_array(jsonb_build_object(
    'tipo', 'extra', 'nombre', 'Personalización', 'monto', '50000',
    'subtotal', 50000, 'recurrente', false,
    'descripcion', 'Personalización acordada con Dibujo Técnico. Pago pactado para el 20 de septiembre de 2026, IVA incluido.'
  )),
  50000, 50000, 'MXN',
  true, 6896.55,
  0, 'fijo',
  now(), 'Acuerdo con el cliente', '2026-09-20', now(),
  'Pago único de $50,000 MXN con IVA incluido, a recibir el 20 de septiembre de 2026.',
  'Adeudo por personalización. Alta manual el 3-sep-2026 a pedido del dueño: acuerdo previo con el cliente, no salió de una cotización enviada por el sistema.'
    || E'\n---META---\n'
    || jsonb_build_object(
         'iva_mode', 'incluido',
         'plan_pagos', jsonb_build_array(jsonb_build_object(
           'id', 'dibujotec2609', 'fecha', '2026-09-20', 'monto', 50000, 'concepto', 'Personalización'
         )),
         'timeline', jsonb_build_array(jsonb_build_object(
           'event', 'alta_manual', 'at', now(),
           'detalle', 'Adeudo de personalización cargado a cuentas por cobrar'
         ))
       )::text
from companies c
join lateral (
  select id, nombre, email, whatsapp from contacts
   where company_id = c.id order by created_at limit 1
) k on true
where c.sacs_account = 'dibujotecnico'
  and not exists (select 1 from quotes where numero = 'COT-80128');

select q.numero, q.estado, q.total, q.iva_incluido, q.iva_monto,
       q.empresa, q.contacto,
       (regexp_match(q.notas, '"plan_pagos":(\[.*?\])'))[1] plan
  from quotes q where q.numero = 'COT-80128';
