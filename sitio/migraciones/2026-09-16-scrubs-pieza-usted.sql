-- Tuteo suelto dentro de una cadencia que habla de usted.
--
-- La pieza HTML de scrubs dice «Puedes vender 2 conjuntos, no 6» en medio de
-- ocho correos que tratan de usted. Un cambio de tratamiento a media pieza
-- delata que el bloque se escribió aparte y nadie lo leyó junto con el correo.
--
-- Ojo, y por eso se revisó con cuidado: los «tienes» de calzado, marcas y
-- mayoristas NO son esto. Están dentro de comillas, citando cómo escribe un
-- comprador por WhatsApp —«¿todavía tienes el 24 en negro?»— y ahí el tuteo es
-- correcto: así habla la gente. Se cambia solo donde la voz es nuestra.

update abm_plantillas
set cuerpo = replace(cuerpo, 'Puedes vender 2 conjuntos, no 6.', 'Con eso arma 2 conjuntos, no 6.')
where giro = 'scrubs' and canal = 'pieza' and cuerpo like '%Puedes vender 2 conjuntos%';

select count(*) quedan from abm_plantillas
where activa and canal='pieza' and cuerpo ~ '\m(Puedes|Tienes|Quieres)\M';
