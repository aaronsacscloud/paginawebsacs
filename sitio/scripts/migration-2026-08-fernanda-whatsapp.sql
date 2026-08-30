-- En WhatsApp escribe Fernanda; Andrea es quien da la demo.
--
-- Separar las dos voces le da peso a Andrea: cuando aparece, es porque la
-- conversación subió de nivel. Si contesta los mensajes automáticos, su nombre
-- se gasta antes de llegar a la sesión.
--
-- Se cambian tres cosas: el acuse de la secuencia por evento, los textos
-- precargados de los botones de WhatsApp de los correos, y el pie del correo
-- cuando invita a escribir por WhatsApp. Las PLANTILLAS de Meta no se tocan
-- aquí — cambiarles el cuerpo exige volver a pasar por aprobación.
begin;

-- 1 · El acuse del WhatsApp entrante
update crm_secuencias
set entrada = jsonb_set(entrada, '{acuse,en_horario}',
      to_jsonb('Te leo 👋 Soy Fernanda, del equipo de Sacs. Dame unos minutos y te contesto por aquí mismo.'::text))
where disparador = 'wa_entrante';

update crm_secuencias
set entrada = jsonb_set(entrada, '{acuse,fuera}',
      to_jsonb('Te leo 👋 Soy Fernanda, del equipo de Sacs. Ahorita ya estamos fuera de horario — te contesto en cuanto abramos, a partir de las 9 de la mañana.'::text))
where disparador = 'wa_entrante';

-- 2 · Los textos precargados de los botones (van A WhatsApp, los lee Fernanda).
-- El reconocedor de intención NO depende del nombre —matchea por frases como
-- "hueco de curva"— así que cambiarlo no rompe el etiquetado.
update email_templates
set bloques = replace(bloques::text, 'Hola%20Andrea', 'Hola%20Fernanda')::jsonb
where bloques::text like '%Hola\%20Andrea%';

commit;

-- 3 · Los botones hablaban en primera persona ("escríbeme", "te acompaño") y
-- el correo lo firma Andrea — pero el botón ahora lleva a Fernanda. Se pasan a
-- voz de equipo: quien contesta es el equipo, y Andrea aparece cuando toca la
-- sesión. Así su nombre no se gasta en el acuse automático.
begin;
update email_templates set bloques = replace(bloques::text,
  '¿Alguna de las diez te suena a tu operación? Cuéntame cuál.',
  '¿Alguna de las diez te suena a tu operación? Cuéntanos cuál y te respondemos.')::jsonb;
update email_templates set bloques = replace(bloques::text,
  'Tráeme el estilo que se te descabaló más rápido y te enseño cuánto cambia la compra con cada método.',
  'Mándanos el estilo que se te descabaló más rápido y te enseñamos cuánto cambia la compra con cada método.')::jsonb;
update email_templates set bloques = replace(bloques::text,
  'Dime cuántas son y te enseño cómo se vería tu tablero de traspasos.',
  'Dinos cuántas son y te enseñamos cómo se vería tu tablero de traspasos.')::jsonb;
update email_templates set bloques = replace(bloques::text,
  'Te digo con honestidad qué te falta antes de pensar en pantallas.',
  'Te decimos con honestidad qué te falta antes de pensar en pantallas.')::jsonb;
update email_templates set bloques = replace(bloques::text,
  'Escríbeme y te acompaño en el primer módulo.',
  'Escríbenos y te acompañamos en el primer módulo.')::jsonb;
update email_templates set bloques = replace(bloques::text,
  'Mándame una captura y te digo si le falta algo.',
  'Mándanos una captura y te decimos si le falta algo.')::jsonb;
update email_templates set bloques = replace(bloques::text,
  'Es el paso donde más gente se atora. Escríbeme y lo hacemos juntas.',
  'Es el paso donde más gente se atora. Escríbenos y lo hacemos contigo.')::jsonb;
update email_templates set bloques = replace(bloques::text,
  'Te acompaño en vivo mientras la haces. Toma cinco minutos.',
  'Te acompañamos en vivo mientras la haces. Toma cinco minutos.')::jsonb;
update email_templates set bloques = replace(bloques::text,
  'Dime cuántas son y te enseño cómo se ve tu tablero.',
  'Dinos cuántas son y te enseñamos cómo se ve tu tablero.')::jsonb;
commit;
