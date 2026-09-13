-- ═══ Imagen y botón por correo, con el cuerpo en texto ════════════════════
--
-- Pedido del dueño: que cada correo lleve su imagen y que la plantilla tenga
-- diseño.
--
-- POR QUÉ NO SE GUARDA EL HTML EN EL CUERPO
-- Lo obvio sería poner el HTML dentro de `cuerpo`. Tres razones para no:
--  1. La versión de TEXTO dejaría de coincidir con la HTML, y esa discrepancia
--     la puntúan los filtros de spam (ya está comentado en el cron).
--  2. La IA reescribe el cuerpo de cada correo para adaptarlo a la cuenta; si
--     el cuerpo trae etiquetas, las va a romper tarde o temprano.
--  3. Cambiar el diseño obligaría a regenerar los 248 correos ya armados.
-- Con la imagen y el botón como columnas, el cuerpo sigue siendo texto —lo que
-- la IA sabe escribir y lo que una persona puede editar en la pantalla— y el
-- diseño vive en UN solo lugar: el armador de HTML del envío.

alter table abm_plantillas add column if not exists imagen text;        -- archivo en /images/mail/
alter table abm_plantillas add column if not exists boton_texto text;
alter table abm_plantillas add column if not exists boton_url text;

alter table abm_toques add column if not exists imagen text;
alter table abm_toques add column if not exists boton_texto text;
alter table abm_toques add column if not exists boton_url text;

-- Una imagen por correo, elegida por lo que DICE ese correo. La del correo 5
-- es una libreta de papel de verdad, que es literalmente el problema del que
-- habla («la libreta no avisa»).
update abm_plantillas set imagen = m.img, boton_texto = m.bt, boton_url = m.bu
from (values
  (0, 'novias-1-presentacion.jpg', 'Ver una demo de 20 minutos', 'https://www.sacscloud.com/agendar/demo'),
  (1, 'novias-2-apartados.jpg',    'Agendar una demo',           'https://www.sacscloud.com/agendar/demo'),
  (2, 'novias-3-talla.jpg',        null, null),
  (3, 'novias-4-ficha.jpg',        'Ver la ficha por dentro',    'https://www.sacscloud.com/agendar/demo'),
  (4, 'novias-5-libreta.jpg',      null, null),
  (5, 'novias-6-tallas.jpg',       null, null),
  (6, 'novias-7-modelos.jpg',      'Agendar una demo',           'https://www.sacscloud.com/agendar/demo'),
  (7, 'novias-8-cierre.jpg',       null, null)
) as m(orden, img, bt, bu)
where abm_plantillas.giro='novias' and abm_plantillas.canal='email' and abm_plantillas.orden = m.orden;
