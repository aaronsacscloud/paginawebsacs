-- Canales sacados del SITIO PROPIO de cada casa de novia (13-sep-2026).
--
-- Se midió antes de decidir el canal: de 33 casas de novia con sitio, UNA
-- publica correo. Son tiendas Shopify sin un solo mailto:. En este ramo el
-- canal es WhatsApp, y por eso esto trae sobre todo números, no correos.
--
-- Reglas aplicadas, todas por lo que salió mal hoy:
--  · Solo números mexicanos verosímiles (52 + 10 dígitos, lada válida).
--  · De cada sitio se queda el número MAS REPETIDO: el de la tienda sale en
--    todas las páginas; el del que hizo la web, una sola vez.
--  · Ninguno se repite entre cuentas (un número compartido seria de un
--    proveedor, no del negocio). Verificado: cero repetidos.
--  · hola@aguiar.mx se verifico por MX (Google) antes de darlo de alta.
--  · Dos telefonos ya existian en abm_canales y NO se vuelven a insertar.
--
-- Un tope de descarga de 600 KB estaba escondiendo la mitad: las paginas de
-- Shopify pesan ~2 MB y el enlace de WhatsApp de Innovia estaba en el byte
-- 1,122,790. Con el tope subido a 6 MB aparecieron los que faltaban.
insert into abm_canales (cuenta_id, tipo, valor, confianza, es_de_la_tienda, estado) values
('ab7b9e1c-86fe-46a8-9cbf-87cdab0f51ea','whatsapp_tienda','524491734732','media',true,'sin_probar'),
('295e6eb2-c569-49a3-936e-d034d8b7f1a4','telefono','523327207389','media',true,'sin_probar'),
('295e6eb2-c569-49a3-936e-d034d8b7f1a4','email_generico','hola@aguiar.mx','media',true,'sin_probar'),
('b97da424-d911-46c6-96f0-a53f8af26bd6','whatsapp_tienda','528136391003','media',true,'sin_probar'),
('f333ad0e-b722-48c0-9d97-158f4dee0e64','whatsapp_tienda','526145990767','media',true,'sin_probar'),
('99db7eca-6713-4bbb-81a1-6facda0f617f','whatsapp_tienda','528133865560','media',true,'sin_probar'),
('99db7eca-6713-4bbb-81a1-6facda0f617f','telefono','528113650957','media',true,'sin_probar'),
('7011e479-5612-4b72-b1c0-954b261d50be','whatsapp_tienda','524774036740','media',true,'sin_probar'),
('4b0aaba5-408a-4486-a101-fe6db52f6a5e','whatsapp_tienda','526621396339','media',true,'sin_probar'),
('6c161422-92e1-4415-b82e-0c5e8d000019','whatsapp_tienda','524425761518','media',true,'sin_probar'),
('63b61188-db0b-4337-a403-d124530f48bf','telefono','529931214005','media',true,'sin_probar'),
('b1be4165-ee7c-4ba9-9ba4-7827f7e909b1','telefono','528183543224','media',true,'sin_probar'),
('b1be4165-ee7c-4ba9-9ba4-7827f7e909b1','email_generico','adabellanoviasyprincesas@gmail.com','media',true,'sin_probar');

insert into abm_fuentes (cuenta_id, campo, valor, metodo, confianza, agente) values
('ab7b9e1c-86fe-46a8-9cbf-87cdab0f51ea','whatsapp','524491734732','sitio_propio','media','raspado-sitio'),
('295e6eb2-c569-49a3-936e-d034d8b7f1a4','telefono','523327207389','sitio_propio','media','raspado-sitio'),
('295e6eb2-c569-49a3-936e-d034d8b7f1a4','correo','hola@aguiar.mx','sitio_propio','media','raspado-sitio'),
('b97da424-d911-46c6-96f0-a53f8af26bd6','whatsapp','528136391003','sitio_propio','media','raspado-sitio'),
('f333ad0e-b722-48c0-9d97-158f4dee0e64','whatsapp','526145990767','sitio_propio','media','raspado-sitio'),
('99db7eca-6713-4bbb-81a1-6facda0f617f','whatsapp','528133865560','sitio_propio','media','raspado-sitio'),
('99db7eca-6713-4bbb-81a1-6facda0f617f','telefono','528113650957','sitio_propio','media','raspado-sitio'),
('7011e479-5612-4b72-b1c0-954b261d50be','whatsapp','524774036740','sitio_propio','media','raspado-sitio'),
('4b0aaba5-408a-4486-a101-fe6db52f6a5e','whatsapp','526621396339','sitio_propio','media','raspado-sitio'),
('6c161422-92e1-4415-b82e-0c5e8d000019','whatsapp','524425761518','sitio_propio','media','raspado-sitio'),
('63b61188-db0b-4337-a403-d124530f48bf','telefono','529931214005','sitio_propio','media','raspado-sitio'),
('b1be4165-ee7c-4ba9-9ba4-7827f7e909b1','telefono','528183543224','sitio_propio','media','raspado-sitio'),
('b1be4165-ee7c-4ba9-9ba4-7827f7e909b1','correo','adabellanoviasyprincesas@gmail.com','sitio_propio','media','raspado-sitio');
