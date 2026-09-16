-- ══ La seguridad industrial no es fashion retail ═════════════════════════════
--
-- CÓMO SALIÓ. Revisando quién va PRIMERO en la fila del goteo de calzado tras
-- recalificar la base: los doce de la cabeza no eran fábricas de zapatos.
--
--     Segurihigiene · Safety Depot (×4) · Provesicsa Seguridad Industrial
--     Seguridad del Puerto · Symonds Safety · MDR Safety Footwear · ESYKA
--     Equipos, Herramientas y Seguridad Industrial · Equípate con Seguridad…
--
-- Venden bota de trabajo, casco y guantes a fábricas. Sí es calzado, y hasta
-- tienen inventario por número — pero la cadencia de `calzado` está escrita
-- para «la fábrica o marca que vende POR CORRIDA A ZAPATERÍAS», habla de SAPICA
-- y ofrece «crédito y estado de cuenta por cada cliente zapatería». A un
-- distribuidor de equipo de protección eso no le dice nada: sus clientes son
-- plantas, no zapaterías.
--
-- Y el encargo es fashion retail. Son 39 cuentas repartidas en cinco giros de
-- moda, 14 de ellas en la fila hoy.
--
-- NO SE MARCAN `no_contactar`: no son basura, son OTRO MERCADO. Pasan al giro
-- `seguridad_industrial`, que no tiene cadencia escrita — así el goteo no las
-- puede tomar y, si alguien intenta generarles, la guarda de `generarCadencia`
-- lo dice con todas sus letras en vez de mandarles el correo equivocado.
-- El día que se decida escribirles, están enteras y agrupadas.
--
-- LA TRAMPA DEL PATRÓN, otra vez. La primera versión se llevaba negocios de
-- UNIFORMES —«Dagar Textil: Uniformes y Equipo de Protección Personal», «UPE |
-- Uniformes Profesionales», «Blara Uniformes y equipos de seguridad»— que sí
-- son moda y tienen su cadencia en `scrubs`. Por eso el `!~* 'uniforme'`: lo
-- que manda es cuál es el negocio principal, no que la palabra aparezca.

update abm_cuentas set
  giro = 'seguridad_industrial',
  nota = coalesce(nota || ' · ', '') || 'Movido desde ' || giro || ': vende equipo de protección industrial, no moda. Otro mercado, no basura.'
where pais = 'México' and etapa <> 'no_contactar'
  and giro <> 'seguridad_industrial'
  and nombre ~* '\m(seguridad industrial|equipo de seguridad|proteccion personal|protección personal|seguridad e higiene|segurihigiene|safety|epp)\M'
  and nombre !~* '\muniforme';

-- Y las dos que ningún patrón atrapa, a mano (la regla de siempre: buscar un
-- patrón para dos renglones es cómo se acaba borrando «Bordados Levi's»).
update abm_cuentas set etapa = 'no_contactar',
  nota = coalesce(nota || ' · ', '') || 'No es un negocio de moda: fabricante de semiconductores.'
where nombre = 'Skyworks Solutions' and etapa <> 'no_contactar';

update abm_cuentas set etapa = 'no_contactar',
  nota = coalesce(nota || ' · ', '') || 'No es un negocio de moda: fábrica de pinturas.'
where nombre like 'Industrial de Pinturas Ecatepec%' and etapa <> 'no_contactar';

select
 (select count(*) from abm_cuentas where giro='seguridad_industrial') a_seguridad,
 (select count(*) from abm_cuentas where giro='calzado' and pais='México' and etapa='sin_tocar'
    and (tiene_email or tiene_wa)) calzado_en_fila;
