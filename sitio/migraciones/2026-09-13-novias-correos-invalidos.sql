-- Dos correos del segmento novias que NO debían salir. Verificados por DNS.
--
-- 1) Estrómboli → team@latofonts.com
--    latofonts.com es la fundidora tipográfica de la fuente Lato. El correo se
--    raspó del crédito de tipografía del sitio, no del negocio. Y SÍ tiene MX,
--    o sea que habría entregado: le habríamos mandado ocho correos de venta de
--    software para casas de novia a una fundidora de tipos. Una queja basta
--    para tirar el disyuntor de spam de TODO el motor.
--    (su propio dominio, estromboli.com.mx, no tiene MX: no recibe correo)
--
-- 2) Tiscareno Bride → mivestido@tiscaeno.mx
--    Ese dominio no tiene MX: rebote duro. Además le falta la 'r' — el sitio
--    real es tiscarenobride.com (MX de Yandex). NO se corrige a mano: inventar
--    una dirección plausible es exactamente cómo se junta un rebote. Queda
--    para buscar la buena y darla de alta verificada.
--
-- Los rebotes duros en un dominio que apenas se está calentando son lo que
-- hace que el resto del segmento acabe en spam.
update abm_canales x set estado = 'invalido'
  from abm_cuentas c
 where x.cuenta_id = c.id and c.giro = 'novias' and x.tipo like 'email%'
   and x.valor in ('team@latofonts.com', 'mivestido@tiscaeno.mx');

-- Sus borradores se cancelan (no se borran: queda el rastro de que existieron).
update abm_toques t set estado = 'cancelado'
  from abm_cuentas c
 where t.cuenta_id = c.id and c.giro = 'novias' and t.estado = 'borrador'
   and t.destino in ('team@latofonts.com', 'mivestido@tiscaeno.mx');
