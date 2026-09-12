-- El descuento de MONTO FIJO no se repartía entre las partidas
--
-- `netoDePartida` sabía repartir un descuento en porcentaje pero no uno de
-- monto fijo: le faltaba la base sobre la que se aplicó, así que devolvía el
-- precio de LISTA. Una cotización con descuento fijo dejaba a sus partidas
-- valiendo más de lo que el cliente pagó, y ese número se copia a la mejora que
-- las cobra, a la expansión de la renovación y al reporte del cliente.
--
-- Medido: COT-78905 de Ruben's — $200,699 de lista, $50,699 de descuento fijo,
-- $150,000 de total. La mejora del e-commerce quedó en $146,000 cuando su parte
-- del cobro son $109,118 (146,000 ÷ 200,699 × 150,000). $36,882 de más.
--
-- Es la ÚNICA mejora afectada: de las tres cotizaciones con descuento fijo que
-- hay en el CRM, solo esta tiene una mejora ligada. El arreglo del código va en
-- src/lib/crm/pagos-unicos.ts.

update mejoras m
   set valor = round(
         (i->>'monto')::numeric
         * (1 - q.descuento_global / nullif((select sum((x->>'monto')::numeric)
                                               from jsonb_array_elements(q.items) x
                                              where (x->>'monto')::numeric > 0), 0))
       ),
       updated_at = now()
  from quotes q,
       lateral jsonb_array_elements(q.items) i
 where m.quote_id = q.id
   and q.descuento_tipo = 'fijo'
   and coalesce(q.descuento_global, 0) > 0
   and trim(i->>'nombre') = trim(m.quote_item)
   and (i->>'monto')::numeric > 0
   and m.valor is distinct from round(
         (i->>'monto')::numeric
         * (1 - q.descuento_global / nullif((select sum((x->>'monto')::numeric)
                                               from jsonb_array_elements(q.items) x
                                              where (x->>'monto')::numeric > 0), 0)));
