-- ══ Ni Liverpool ni la sucursal de Vans son prospectos ═══════════════════════
--
-- CÓMO SALIÓ. Al probar la cadencia nueva de jeans y trajes de baño contra
-- cuentas reales, las que el goteo habría enrolado primero eran: dieciséis
-- sucursales de Liverpool, una Sodimac —que vende cemento—, una suBodega y
-- Pet N'Go, una tienda de mascotas. La lista se ordena por reseñas, y las
-- cadenas grandes tienen miles, así que se van derecho a la cabeza de la fila.
--
-- POR QUÉ NO SIRVEN. Dos razones distintas:
--   · Departamental o autoservicio: Liverpool tiene 28,382 reseñas y sistemas
--     de otra liga. No es el negocio de moda al que le hablamos.
--   · Sucursal de marca internacional: el punto de venta de una tienda Vans o
--     Levi's no lo decide la sucursal, lo decide corporativo —normalmente en
--     otro país—. Escribirle «vi su tienda y le propongo una demo» a la
--     encargada de una franquicia es tiempo perdido para los dos.
--
-- LA TRAMPA DEL PATRÓN, que ya costó una vez con la palabra «plaza». El
-- primer intento buscaba las marcas como subcadena y se llevaba por delante:
--
--     Bordados Levi's              un taller de bordado, apellido del dueño
--     Demin 656 - Carlos Levi's    una tienda de jeans, apellido del dueño
--     Boutique Desigual By Sarai   una boutique independiente que vende la marca
--     ANZARA NOVIAS · Azzara       «zara» adentro de otra palabra
--     Confecciones Mazara          igual
--     CosmoSport Zaragoza Norte    igual, y es un prospecto bueno
--
-- La regla que sí distingue: una sucursal de franquicia EMPIEZA con la marca
-- («Vans Store Los Cabos», «Outlet Levi's® Culiacán»), y un negocio propio la
-- lleva adentro o al final. Por eso el patrón va anclado al inicio y a palabra
-- completa (\M), y solo se admiten «Outlet » y «Tienda » como prefijo. Con eso
-- los seis de arriba se quedan en la base, que es donde deben estar.
--
-- Esto NO borra nada: marca `etapa = 'no_contactar'`. Si mañana Liverpool
-- llama, se le quita la etapa y sigue ahí con todo su historial.

update abm_cuentas set
  etapa = 'no_contactar',
  nota = coalesce(nota || ' · ', '') || 'Tienda departamental o autoservicio: no es el negocio de moda al que va la cadencia.'
where pais = 'México' and etapa is distinct from 'no_contactar'
  and nombre ~* '^(outlet |tienda |the )?(liverpool|coppel|sears|suburbia|walmart|sodimac|subodega|bodega aurrer|chedraui|soriana|sam.s club|costco|elektra|woolworth|waldo.s|home depot)\M';

update abm_cuentas set
  etapa = 'no_contactar',
  nota = coalesce(nota || ' · ', '') || 'Sucursal de marca internacional: el sistema lo decide corporativo, no la tienda.'
where pais = 'México' and etapa is distinct from 'no_contactar'
  and nombre ~* '^(outlet |tienda |the )?(levi.s|converse|nike|adidas|puma|reebok|under armour|vans|skechers|crocs|timberland|hugo boss|calvin klein|tommy hilfiger|lacoste|guess|zara|bershka|stradivarius|massimo dutti|forever 21|aeropostale|american eagle|old navy|quiksilver|billabong|rip curl|vilebrequin|intimissimi|steve madden|nine west|sunglass hut|swarovski|pandora|michael kors|desigual|uniqlo|decathlon|innvictus|dportenis|springfield|cortefiel|mango)\M';

select
 (select count(*) from abm_cuentas where pais='México' and etapa='no_contactar'
    and nota like '%departamental o autoservicio%') departamentales,
 (select count(*) from abm_cuentas where pais='México' and etapa='no_contactar'
    and nota like '%marca internacional%') franquicias;
