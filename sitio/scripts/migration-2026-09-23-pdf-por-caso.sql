-- ══ UN PDF POR CASO DE LAS LLAMADAS (23-sep-2026) ═══════════════════════════
-- Pedido del dueño: lo que se manda en cada caso (precios, «ya tengo sistema»,
-- «¿cómo funciona?») va en un PDF como el de «más información», con su
-- plantilla de marketing (PDF de encabezado) y su utility de respaldo.
-- El código que elige la plantilla vive en CONTENIDOS_PDF (plantillas-agente.ts);
-- aquí va la biblioteca de las llamadas (tel_conocimiento) y los atajos del inbox.

-- 1) La info general deja de reclamar precios/planes/demo: ahora tienen PDF propio.
update tel_conocimiento
   set claves = array['informacion','info','material','que es','presentacion','general'], updated_at = now()
 where pdf_url = 'https://www.sacscloud.com/info/sacs-informacion.pdf';

-- 2) Los tres contenidos nuevos (el tema es el que usa CONTENIDOS_PDF).
insert into tel_conocimiento (tema, claves, texto, pdf_url, origen, estado)
select v.tema, v.claves, v.texto, v.pdf_url, 'pdf-por-caso-2026-09-23', 'activo'
  from (values
    ('los planes y precios de Sacs',
     array['precio','precios','costo','cuesta','cuanto','planes','plan','cotizacion','presupuesto','mensualidad','tarifa'],
     'Planes por sucursal, sin permanencia: Vende $810/mes ($527 al mes pagando anual), Controla $1,215 ($790), Fideliza y Multiplica $1,890 ($1,229), Automatiza $3,780 ($2,457). La migración la hacemos nosotros y el precio se respeta año con año. Todo a detalle en https://www.sacscloud.com/planes',
     'https://www.sacscloud.com/info/sacs-precios.pdf'),
    ('cómo cambiarte a Sacs desde tu sistema actual',
     array['cambiarte','cambio','cambiar','migrar','migracion','tengo sistema','odoo','sicar','shopify','aspel','microsip','eleventa','excel','comparativa'],
     'Te cambias sin empezar de cero: nosotros pasamos tus productos con tallas y colores, tus clientes y tu inventario; lo revisas antes de arrancar y no se detiene la venta. Sin permanencia.',
     'https://www.sacscloud.com/info/sacs-cambiate.pdf'),
    ('cómo es la demo y cómo arrancas con Sacs',
     array['demo','demostracion','funciona','como funciona','implementacion','arranque','arrancas','capacitacion','instalacion'],
     'En la demo vemos Sacs con tus productos: venta, inventario por talla y color, sucursales y tienda en línea. Después: migramos tu información, capacitamos a tu equipo y arrancas acompañado.',
     'https://www.sacscloud.com/info/sacs-demo-arranque.pdf')
  ) as v(tema, claves, texto, pdf_url)
 where not exists (select 1 from tel_conocimiento k where k.pdf_url = v.pdf_url);

-- 3) Atajos del inbox con su PDF (/precios, /cambio, /demo), como /info.
insert into wa_respuestas (atajo, titulo, categoria, texto, media_url, media_tipo)
select v.atajo, v.titulo, 'ventas', v.texto, v.media_url, 'document'
  from (values
    ('precios', 'Planes y precios de Sacs (PDF)',
     'Hola {{primer_nombre}}, te comparto los planes de Sacs: el precio es por sucursal, sin permanencia, y pagando anual te sale más barato. La migración la hacemos nosotros. Todo a detalle en https://www.sacscloud.com/planes' || chr(10) || chr(10) || '¿Cuántas tiendas manejas? Así te digo cuál te conviene.',
     'https://www.sacscloud.com/info/sacs-precios.pdf'),
    ('cambio', 'Cámbiate a Sacs sin empezar de cero (PDF)',
     'Hola {{primer_nombre}}, te comparto cómo es cambiarte a Sacs desde el sistema que ya usas: nosotros pasamos tus productos con tallas y colores, tus clientes y tu inventario, y no se detiene la venta.' || chr(10) || chr(10) || '¿Qué sistema usas hoy? Te digo exactamente qué migramos.',
     'https://www.sacscloud.com/info/sacs-cambiate.pdf'),
    ('demo', 'Tu demo y tu arranque con Sacs (PDF)',
     'Hola {{primer_nombre}}, te comparto cómo es la demo de Sacs y cómo arrancas: la vemos con tus productos en pantalla, y después migramos tu información y capacitamos a tu equipo.' || chr(10) || chr(10) || '¿Qué día te acomoda para verla 30 minutos?',
     'https://www.sacscloud.com/info/sacs-demo-arranque.pdf')
  ) as v(atajo, titulo, texto, media_url)
 where not exists (select 1 from wa_respuestas r where r.atajo = v.atajo);
