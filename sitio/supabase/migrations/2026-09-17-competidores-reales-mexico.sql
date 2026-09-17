-- DEMAND ENGINE · los competidores DE VERDAD, según las IAs.
--
-- La lista semilla la puse yo de cabeza: Shopify, Odoo, NetSuite, Lightspeed,
-- Cegid, Cin7. Son los nombres grandes del sector — y en México, cuando alguien
-- le pregunta a una IA «qué software uso para mi boutique», no sale ninguno.
--
-- Estos salieron de preguntarle a Gemini con búsqueda web las cuatro preguntas
-- que haría un comprador real (17-sep-2026). En las cuatro, Sacs no apareció
-- ni una vez.
--
-- Es la diferencia entre competir contra quien uno cree y competir contra quien
-- de verdad está ocupando la respuesta.
insert into de_competidores (nombre, dominio, tipo, categorias, mercados, descubierto_por, notas) values
  ('SICAR X',          'sicarx.com',         'regional', array['punto_de_venta','inventario','ecommerce'], array['MX'],'ia:gemini','Sale primero en «mejor software para tienda de ropa en México»'),
  ('Syska POS',        'syskapos.com',       'regional', array['punto_de_venta','inventario','tallas'], array['MX'],'ia:gemini','Aparece en boutique y en zapatería'),
  ('Multicomercio',    'multicomercio.mx',   'regional', array['punto_de_venta','inventario','tallas'], array['MX'],'ia:gemini','Se presenta como específico de boutiques'),
  ('Loggro',           'loggro.com.mx',      'regional', array['punto_de_venta','contabilidad'], array['MX','LATAM'],'ia:gemini',null),
  ('ManagementPro POS','mproerp.com',        'regional', array['punto_de_venta','inventario'], array['MX'],'ia:gemini',null),
  ('EMERGE App',       'emergeapp.net',      'herramienta_nicho', array['inventario','mayoreo'], array['GLOBAL'],'ia:gemini','Sale primero en inventario por talla y color'),
  ('PowerGest',        'powergest.com',      'herramienta_nicho', array['inventario','tallas'], array['GLOBAL'],'ia:gemini',null),
  ('Gestión QBS Moda', 'gestionqbsmoda.com', 'herramienta_nicho', array['inventario','tallas','merchandising'], array['MX'],'ia:gemini','Nombre explícitamente de moda'),
  ('INTAC',            'intac.mx',           'regional', array['inventario','punto_de_venta'], array['MX'],'ia:gemini',null),
  ('QuickPOS AI',      'quickpos.com.mx',    'regional', array['punto_de_venta','automatizacion_ia'], array['MX'],'ia:gemini',null),
  ('Boutick',          'boutick.com',        'herramienta_nicho', array['punto_de_venta','tallas'], array['GLOBAL'],'ia:gemini',null),
  ('SIFO',             'puntodeventa.com.mx','regional', array['punto_de_venta'], array['MX'],'ia:gemini',null),
  ('ClickBalance',     'clickbalance.com',   'regional', array['contabilidad','inventario'], array['MX'],'ia:gemini',null),
  ('Uphance',          'uphance.com',        'herramienta_nicho', array['mayoreo','produccion','tallas'], array['GLOBAL'],'ia:gemini','Específico de apparel'),
  ('AIMS360',          'aims360.com',        'herramienta_nicho', array['mayoreo','produccion'], array['GLOBAL'],'ia:gemini','Sale en la pregunta de mayorista'),
  ('CONTODA',          'contoda.com',        'regional', array['punto_de_venta','inventario'], array['MX'],'ia:gemini',null)
on conflict (dominio) do nothing;

select count(*) total, count(*) filter (where descubierto_por = 'ia:gemini') descubiertos_por_ia from de_competidores;
