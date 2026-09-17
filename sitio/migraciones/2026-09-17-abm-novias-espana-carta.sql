-- 17-sep-2026 · Ajustes del texto para el modo CARTA.
--
-- Al ver los once correos en un buzón de verdad salieron dos cosas:
-- · La firma aparecía dos veces: el texto acababa en «Un saludo, Andrea» y
--   debajo el sistema pintaba la firma del inquilino. Se quita del texto: la
--   firma la pone el correo, con su nombre completo y su puesto.
-- · «Y que llevan 2 tiendas.» quedaba coja — era un condicional pegado a la
--   frase anterior. Se redacta entera.
begin;
update abm_plantillas
   set cuerpo = regexp_replace(cuerpo, '\n+Un saludo,\nAndrea\s*$', '')
 where giro = 'novias' and region = 'espana' and canal = 'email' and cuerpo like '%Un saludo,%';

update abm_plantillas
   set cuerpo = replace(cuerpo, '[[si sucursales]] Y que llevan {{sucursales}} tiendas.[[/si]]',
                                '[[si sucursales]] Vimos también que llevan {{sucursales}} tiendas.[[/si]]')
 where giro = 'novias' and region = 'espana' and canal = 'email';
commit;
select orden, asunto, right(cuerpo, 60) final from abm_plantillas where giro='novias' and region='espana' and ruta='demo' and canal='email' order by orden limit 3;
