-- `monto_proximo` desfasado: siete cuentas cobrándose de más
--
-- `monto_proximo` es «cuánto se cobra la próxima vez» = precio + add-ons −
-- descuentos, y es el número que Cobranza usa para cobrar. El PUT de
-- suscripciones conservaba el valor anterior cuando el cuerpo no lo mandaba
-- —correcto mientras el precio no se mueva, porque ahí viven los add-ons—,
-- pero al EDITAR EL PRECIO lo conservaba igual. Resultado: se corregía una
-- licencia de $3,900 a $910 y Cobranza seguía cobrando $3,900.
--
-- El rastro de `activities` lo confirma caso por caso:
--   Marketplace     precio $3,900→$910    · monto_proximo quedó en 3,900
--   kuubpets        precio $13,950→$7,000 · quedó en 13,950
--   boomfitness     precio $11,210→$9,000→$7,140 · quedó en 9,000
--   elbombazo       precio $9,100→$7,735  · quedó en 9,100
-- Las otras tres (amalove, cafevaboutique, Jose hernandez) no tienen la
-- actividad —se editaron antes de que existiera ese registro— pero están en la
-- misma situación: sin add-ons y sin descuentos.
--
-- Ninguna de las siete tiene add-ons ni descuentos activos, así que por la
-- propia definición del campo `monto_proximo` DEBE ser igual a `precio`. Eso
-- es lo único que corrige este script; los precios no se tocan.
--
-- El arreglo del código va en src/pages/api/crm/arr/subscriptions.ts: al
-- cambiar el precio, `monto_proximo` se vuelve a derivar de sus partes con
-- `recalcMontoProximo`.

update subscriptions s
   set monto_proximo = s.precio,
       updated_at    = now()
 where s.ciclo <> 'vitalicia'
   and s.estado in ('activa', 'pendiente_pago')
   and coalesce(s.monto_proximo, 0) <> coalesce(s.precio, 0)
   -- Solo las que NO tienen de dónde sacar la diferencia. Una con add-ons o
   -- descuentos activos tiene su monto distinto del precio a propósito.
   and not exists (select 1 from subscription_addons a where a.subscription_id = s.id and a.activo)
   and not exists (select 1 from discounts d where d.subscription_id = s.id and d.activo);
