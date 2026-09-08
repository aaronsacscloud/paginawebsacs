-- Rescata los pagos de cotización que quedaron sin empresa.
--
-- Causa: revenue/mark-paid.ts insertaba el pago sin `company_id` (arreglado en
-- el commit "Cotizaciones: el pago que las liquida ya se cuelga de la empresa").
-- Efecto: el dinero no salía en la ficha del cliente ni contaba como expansión,
-- porque comisiones.recalculo.ts filtra `.not('company_id','is',null)`.
--
-- Solo se tocan los pagos cuya COTIZACIÓN sí tiene empresa: ahí no hay
-- ambigüedad, el dueño del pago es el dueño de la cotización. Los que cuelgan
-- de una cotización sin empresa se quedan como están: adivinarlos por el texto
-- del nombre es como se ensucian las cuentas.

update payments p
   set company_id = q.company_id,
       contact_id = coalesce(p.contact_id, q.contact_id)
  from quotes q
 where q.id = p.quote_id
   and p.company_id is null
   and q.company_id is not null;
