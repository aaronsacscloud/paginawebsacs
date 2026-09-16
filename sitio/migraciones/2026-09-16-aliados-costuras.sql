-- ══ Las tres costuras de los correos de aliados ══════════════════════════════
--
-- Los cuatro arcos de aliados (consultor, orquestador, referidor, tecnologia)
-- usan tres variables que salen del catálogo por SUBGIRO: {{apertura}},
-- {{su_gente}} y {{dolor_cliente}}. El código ya las produce. El problema es
-- qué pasa cuando vienen vacías —subgiro raro, o aliado sin tipo— porque van
-- pegadas a la frase sin condicional:
--
--     «Le escribo a Estudio Marlene por algo concreto..»
--     «Le vende a, y lo que pasa del otro lado es esto:.»
--
-- Y esto NO lo caza la red que cancela un correo con marcas de plantilla: la
-- variable sí se sustituyó, solo que por nada. Es peor que el corchete que
-- había antes, porque antes se cancelaba y ahora saldría.
--
-- 1 · LAS FRASES SE VUELVEN BORRABLES. Cada variable queda dentro de su propio
--     [[si …]], con la frase completa adentro y el punto incluido. Sin tipo de
--     aliado el correo pierde una oración y se sigue leyendo; con tipo va igual
--     que hoy.
--
-- 2 · FUERA EL PIPE. El saludo era «[[si persona]]Hola {{persona}}. | [[/si]]»
--     y con nombre salía «Hola Marlene. | Le escribo a…»: una barra vertical
--     en medio de un correo en frío. Se queda el salto de línea, como en todas
--     las demás cadencias.
--
-- (La tercera parte del arreglo es de código: `tipoDeAliado` ahora acepta los
--  subgiros viejos que cada tipo declara en `ya` —«Firma», «Escuela»,
--  «Comunidad», «Creadora», «Consultora independiente»—. Eran 29 cuentas
--  contactables cayendo al respaldo vacío por una llave que no empataba.)

-- 1 · el saludo, sin barra y con salto de línea
update abm_plantillas
set cuerpo = replace(cuerpo, '[[si persona]]Hola {{persona}}. | [[/si]]',
                             '[[si persona]]Hola {{persona}}.' || chr(10) || '[[/si]]')
where giro = 'aliados' and cuerpo like '%Hola {{persona}}. | [[/si]]%';

-- 2 · la apertura, como oración propia que se puede borrar entera
update abm_plantillas
set cuerpo = replace(cuerpo, ' {{apertura}}.', '[[si apertura]] {{apertura}}.[[/si]]')
where giro = 'aliados' and cuerpo like '% {{apertura}}.%' and cuerpo not like '%[[si apertura]]%';

-- 3 · el renglón de «a quién le vende» y su dolor: una sola frase condicional
update abm_plantillas
set cuerpo = replace(cuerpo,
  'Le vende a {{su_gente}}, y lo que pasa del otro lado es esto: {{dolor_cliente}}.' || chr(10),
  '[[si su_gente]]Le vende a {{su_gente}}, y lo que pasa del otro lado es esto: {{dolor_cliente}}.' || chr(10) || '[[/si]]')
where giro = 'aliados' and cuerpo like '%Le vende a {{su_gente}}%' and cuerpo not like '%[[si su_gente]]%';

select
 (select count(*) from abm_plantillas where giro='aliados' and cuerpo like '%. | %') con_pipe,
 (select count(*) from abm_plantillas where giro='aliados' and cuerpo like '% {{apertura}}.%' and cuerpo not like '%[[si apertura]]%') apertura_suelta,
 (select count(*) from abm_plantillas where giro='aliados' and cuerpo like '%Le vende a {{su_gente}}%' and cuerpo not like '%[[si su_gente]]%') sugente_suelta;
