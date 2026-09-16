-- 16-sep-2026 · Segunda pasada de limpieza: lo que encontró la revisión del
-- barrido. Esta sí toca datos VIVOS de México, no solo la base nueva.
--
-- QUÉ PASÓ (G1 de la revisión). El cargador por país deduplica contra la base
-- por DOMINIO del sitio, sin mirar país ni giro. Como las tiendas de una marca
-- publican el mismo sitio, las 32 tiendas españolas de Pronovias se pegaron a
-- la cuenta mexicana «Pronovias Monterrey» —que está `sin_tocar`, o sea viva—,
-- las 38 de Rosa Clará a una cuenta de Lima, y así seis grupos. La cuenta de
-- Monterrey acabó con 33 teléfonos españoles, un wa.me de Madrid y dos correos
-- de la central: uno de ellos `infringements@pronovias.es`, el buzón de
-- infracciones legales de la marca. La cadencia de México le habría escrito
-- ahí. El arreglo de raíz va en carga-pais.py (comparar país y giro antes de
-- fusionar); esto quita lo que ya se coló.
begin;

-- 1 · Canales con la lada de OTRO de nuestros países ─────────────────────────
-- Solo los que traen la lada internacional escrita: los números nacionales sin
-- lada (la convención vieja de México: «55 5104 7416») se quedan como están.
update abm_canales c set estado = 'invalido'
  from abm_cuentas a, (values
     ('México','52'),('España','34'),('Argentina','54'),('Colombia','57'),('Chile','56'),
     ('Perú','51'),('Ecuador','593'),('Costa Rica','506'),('Panamá','507'),('Uruguay','598'),
     ('Guatemala','502'),('República Dominicana','1')) as l(pais, lada)
 where a.id = c.cuenta_id and l.pais = a.pais
   and c.estado <> 'invalido'
   and c.tipo in ('telefono', 'whatsapp_tienda', 'whatsapp_dueno')
   and regexp_replace(c.valor, '\D', '', 'g') ~ '^(34|54|57|56|51|593|506|507|598|502)'
   and regexp_replace(c.valor, '\D', '', 'g') !~ ('^' || l.lada);

-- 2 · Los correos de la central de una marca, pegados a la tienda equivocada ──
-- `infringements@`, `privacy@`, `dpo@` y los buzones de las herramientas de
-- cookies o del diseñador de la tipografía del tema: ninguno es el negocio.
update abm_canales set estado = 'invalido'
 where tipo like 'email%' and estado <> 'invalido'
   and (lower(valor) ~ '^(infringements|privacy|dpo|dpo\.support|gdpr|gdprcommittee|legal|abuse|postmaster|webmaster)@'
        or lower(valor) ~ '@(gdprlocal|linktr\.ee|promokit|aplazame|domain\.com|demo\.com|emerson)\.?'
        or lower(valor) in ('impallari@gmail.com', 'hello@rfuenzalida.com', 'matt@pixelspread.com', 'nobleui123@gmail.com'));

-- 3 · WhatsApp de Argentina sin el 9 ─────────────────────────────────────────
-- En Argentina el móvil se marca +54 9 <área> <número>; `es_movil` daba por
-- bueno cualquier número (el 9 estaba como opcional en su regex), así que 90
-- canales quedaron como +54 sin el 9: ese wa.me no abre ninguna conversación y
-- además le regalaba 8 puntos de accesibilidad a 82 cuentas. No se «arregla»
-- metiéndole un 9 —no sabemos si el número es móvil o fijo—: se invalida y lo
-- vuelve a levantar el raspador cuando el sitio lo publique bien.
update abm_canales c set estado = 'invalido'
  from abm_cuentas a
 where a.id = c.cuenta_id and a.pais = 'Argentina' and c.tipo like 'whatsapp%'
   and c.estado <> 'invalido' and regexp_replace(c.valor, '\D', '', 'g') ~ '^54[^9]';

-- 4 · Ciudades que no se pueden imprimir en un correo ────────────────────────
update abm_cuentas set ciudad = 'San Sebastián'       where ciudad = 'Donostia San Sebastián';
update abm_cuentas set ciudad = 'Ciudad de Guatemala' where ciudad ~ '^Zona \d+ Guatemala$';
update abm_cuentas set ciudad = 'Ciudad de Panamá'    where ciudad in ('Bella Vista', 'Costa del Este') and pais = 'Panamá';

-- 5 · Redes sociales que apuntan a páginas del sistema ───────────────────────
-- `instagram.com/rsrc.php`, `facebook.com/recover`, `/settings`, `/docs`… son
-- rutas de la propia plataforma que el raspador tomó por el perfil del
-- negocio. Como canal de contacto no sirven y ensucian la ficha.
delete from abm_canales
 where tipo in ('dm_ig', 'dm_fb')
   and lower(valor) ~ '(rsrc\.php|/recover|/settings|/docs|/pages|/people|/policies|/legal|/help|/privacy|/terms|/brand|/explore|/linktree|/wordpresscom|/whatsapp|/https|/profile\.php$|/[a-z]$)';
update abm_cuentas set instagram = null
 where instagram is not null and lower(instagram) ~ '(rsrc\.php|/recover|/settings|/docs|/pages|/people|/legal|/brand|/explore|/linktree|/wordpresscom|/whatsapp|/https)';
update abm_cuentas set facebook = null
 where facebook is not null and lower(facebook) ~ '(rsrc\.php|/recover|/settings|/docs|/pages|/people|/legal|/brand|/explore|/linktree|/wordpresscom|/whatsapp|/https)';

-- 6 · Lo que no es una casa de novias ────────────────────────────────────────
-- Entraron por una categoría SECUNDARIA de Maps siendo su categoría principal
-- otra cosa: maquillaje, salón de belleza, floristería, plaza comercial,
-- organizador de eventos, zapatería, papelería de invitaciones… El guion de
-- novias no les habla. Se quedan en pausa, con su motivo, hasta decidir giro.
update abm_cuentas set etapa = 'en_pausa',
       pausa_motivo = 'No es del giro: entró por una categoría secundaria de Maps (su categoría principal es otra). Revisar a qué giro va antes de escribirle.'
 where giro = 'novias' and pais <> 'México' and etapa in ('en_pausa', 'sin_tocar')
   and lower(substring(nota from 'Categoría: ([^.]*)')) in (
     'wedding planner', 'event planner', 'party planner', 'event management company', 'wedding service',
     'make-up artist', 'beauty salon', 'hairdresser', 'florist', 'shopping mall', 'jewelry store',
     'shoe store', 'invitation printing service', 'party store', 'novelty store', 'gift shop',
     'fabric store', 'fabric wholesaler', 'needlework shop', 'sewing shop', 'costume store',
     'costume rental service', 'tuxedo shop', 'children''s clothing store', 'photographer', 'photography studio');

commit;

select (select count(*) from abm_canales where estado = 'invalido') canales_invalidos,
       (select count(*) from abm_cuentas where giro = 'novias' and pais <> 'México' and (tiene_email or tiene_wa)) contactables,
       (select count(*) from abm_cuentas where giro = 'novias' and pais <> 'México' and etapa = 'en_pausa') en_pausa;
