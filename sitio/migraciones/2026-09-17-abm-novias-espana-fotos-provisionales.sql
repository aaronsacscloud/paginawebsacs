-- 17-sep-2026 · Fotos provisionales para los cuatro correos nuevos de España.
--
-- Los correos 8 a 11 (la reserva, lo que enseña una temporada, la novia que
-- vuelve, la segunda tienda) apuntaban a fotos que no llegaron a generarse: la
-- cuenta de OpenAI se quedó sin saldo a mitad de la tanda. Un correo con la
-- imagen rota es peor que uno sin imagen, así que se les pone una que SÍ
-- existe y que no delata país —nada de billetes ni de calle mexicana— hasta
-- rehacer las suyas con los prompts que ya están escritos en
-- scripts/_fotos-novias-es.mjs.
begin;
update abm_plantillas set imagen = 'novias-es-2-ficha.jpg'        where giro='novias' and region='espana' and ruta='demo' and canal='email' and imagen = 'novias-es-9-reserva.jpg';
update abm_plantillas set imagen = 'novias-es-7-almacen.jpg'      where giro='novias' and region='espana' and ruta='demo' and canal='email' and imagen = 'novias-es-10-informe.jpg';
update abm_plantillas set imagen = 'novias-es-1-presentacion.jpg' where giro='novias' and region='espana' and ruta='demo' and canal='email' and imagen = 'novias-es-11-fiesta.jpg';
update abm_plantillas set imagen = 'novias-es-8-cierre.jpg'       where giro='novias' and region='espana' and ruta='demo' and canal='email' and imagen = 'novias-es-12-dos-tiendas.jpg';
commit;
select orden, asunto, imagen from abm_plantillas where giro='novias' and region='espana' and ruta='demo' and canal='email' order by orden;
