-- Fuera lo que no es moda. Con nombre y apellido, no por regla automática.
--
-- Aarón lo cachó con «El Globo», que estaba clasificado como `boutiques` y es
-- una PASTELERÍA. Al revisar con el tipo de Google salió el bulto: las
-- ÓPTICAS. El barrido buscó "relojerías" y Google agrupa «óptica y relojería»
-- en la misma categoría, así que 44 de las 100 mejores "relojerías" son
-- ópticas.
--
-- POR QUÉ ESTO VA A MANO Y NO POR TIPO DE GOOGLE
-- Probé a cortar por `primaryType` y habría sido un desastre. Google clasifica
-- genérico y los nombres lo demuestran:
--   home_goods_store  → EUROTEXTIL, Telas Junco, Iniciativa Textil   (telas ✓)
--   service           → Sivuplé Polanco, Trajes Nancy, Sastrería     (renta ✓)
--   child_care_agency → La Bodega del Bebé, Baby Corner              (tallas ✓)
--   corporate_office  → Intermoda, Ivonne, Marel de México           (canal ✓)
--   furniture_store   → La Feria de las Telas                        (telas ✓)
-- Cortar esos tipos habría tirado decenas de cuentas buenas sin que nadie se
-- enterara. El tipo de Google sirve para SOSPECHAR, no para decidir.
--
-- Se marcan `no_contactar` con el motivo a la vista. No se borran: si algo
-- quedó mal, se revierte quitando la etapa.

-- 1. Ópticas: venden lentes, no moda.
update abm_cuentas set etapa = 'no_contactar'
 where etapa is distinct from 'no_contactar'
   and (nombre ~* '\m(ó|o)ptic' or nombre ~* 'pupilopt|optometr');

-- 2. Lo que Google clasifica como comida, salud o servicios ajenos, y cuyo
--    nombre NO delata que sea de moda.
update abm_cuentas set etapa = 'no_contactar'
 where etapa is distinct from 'no_contactar'
   and tipo_maps in ('pastry_shop','bakery','cafe','coffee_shop','restaurant',
                     'dessert_shop','bar','hotel','lodging','pharmacy','drugstore',
                     'hospital','doctor','dentist','veterinary_care','gym',
                     'beauty_salon','hair_salon','spa','bank','car_repair',
                     'car_dealer','gas_station','supermarket','grocery_store',
                     'health')
   and nombre !~* 'ropa|moda|boutique|vestid|novia|zapat|calzad|joyer|reloj|textil|tela|uniform|jean|mezclilla|traje|sombrer|bols';

-- 3. Cámaras y asociaciones: no son tiendas, pero SÍ son contactos del ramo.
--    No se sacan; se marcan para que quien trabaje la cola sepa que no van por
--    la misma cadencia que una tienda.
update abm_cuentas set nota = coalesce(nota || ' · ', '') || 'Cámara o asociación del ramo: no es una tienda, la cadencia de tienda no aplica.'
 where tipo_maps = 'association_or_organization' and coalesce(nota,'') not like '%Cámara o asociación%';
