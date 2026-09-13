-- Canales que solo se ven con NAVEGADOR (13-sep-2026).
--
-- Estas 21 casas de novia salieron vacías con fetch: son Shopify/React y el
-- contacto lo inyecta el JS (el botón flotante de WhatsApp, el pie, el widget).
-- Pintando la página aparecieron 4. Las otras 17 no es que escondan el
-- contacto: varias ya ni siquiera responden (HTTP 000, 404, páginas de 169
-- bytes) — eso es señal de dolor, no un hueco de datos.
--
-- webmaster@cieloinzunza.com entra con confianza BAJA: es dirección de rol del
-- panel de hosting, no del negocio, y su dominio apunta el MX a sí mismo.
insert into abm_canales (cuenta_id, tipo, valor, confianza, es_de_la_tienda, estado) values
('bfc3e291-e0c9-4e54-bb3d-e3ea6f014333','whatsapp_tienda','526181129813','media',true,'sin_probar'),
('bfc3e291-e0c9-4e54-bb3d-e3ea6f014333','telefono','526188122900','media',true,'sin_probar'),
('bf28a55b-6d8f-49d1-8d48-9c463c9463cd','telefono','529841476204','media',true,'sin_probar'),
('bf28a55b-6d8f-49d1-8d48-9c463c9463cd','email_generico','valma.mx@gmail.com','media',true,'sin_probar'),
('b277ec13-4450-4285-be39-031dc43f4fdd','email_generico','webmaster@cieloinzunza.com','baja',true,'sin_probar'),
('410f995b-89f4-464c-8e7d-e8b70ee6b02c','email_generico','ventas@bridalgallery.com','media',true,'sin_probar');

insert into abm_fuentes (cuenta_id, campo, valor, metodo, confianza, agente) values
('bfc3e291-e0c9-4e54-bb3d-e3ea6f014333','whatsapp','526181129813','sitio_propio','media','navegador'),
('bfc3e291-e0c9-4e54-bb3d-e3ea6f014333','telefono','526188122900','sitio_propio','media','navegador'),
('bf28a55b-6d8f-49d1-8d48-9c463c9463cd','telefono','529841476204','sitio_propio','media','navegador'),
('bf28a55b-6d8f-49d1-8d48-9c463c9463cd','correo','valma.mx@gmail.com','sitio_propio','media','navegador'),
('b277ec13-4450-4285-be39-031dc43f4fdd','correo','webmaster@cieloinzunza.com','sitio_propio','baja','navegador'),
('410f995b-89f4-464c-8e7d-e8b70ee6b02c','correo','ventas@bridalgallery.com','sitio_propio','media','navegador');
