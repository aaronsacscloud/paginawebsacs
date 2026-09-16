-- 16-sep-2026 · La limpieza de la revisión de bugs, antes de encender los países.
--
-- Salió de revisar a mano la base nueva (novias, 11 países, 3,565 cuentas)
-- buscando lo que se vería MAL en el correo o le llegaría a quien no debe.
-- Cada bloque dice qué encontró y a cuántas cuentas toca.
begin;

-- 1 · Correos que no son del negocio o vienen rotos ──────────────────────────
-- · «info@raiolanetworks.es» es el HOSTING del sitio, no la tienda.
-- · «tuguiawordpress@gmail.com» es un blog de tutoriales que el tema dejó pegado.
-- · «#info@…» y «electr%c3%b3nico:%e2%80%afinfo@…» traen basura del HTML.
-- · «info@señoritoortega.com» tiene eñe: sin punycode ese envío rebota.
-- No se borran —el rastro sirve— se marcan inválidos, que es lo que mira el
-- trigger y la cadencia.
update abm_canales set estado = 'invalido', verificado_at = now()
 where tipo like 'email%'
   and (lower(valor) !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
        or lower(valor) ~ '@(raiolanetworks|wixsite|wordpress|hostinger|webempresa|siteground|godaddy|cookiebot|onetrust)\.'
        or lower(valor) ~ '^(tuguia|info|hola)?[a-z]*wordpress[a-z]*@');

-- 2 · WhatsApp con lada de OTRO país ─────────────────────────────────────────
-- Dos cuentas (Argentina y Colombia) tenían su número con el 52 de México
-- pegado delante: ese mensaje le habría llegado a un desconocido en México.
-- Los metió otro proceso el 15-sep a las 15:59, no el cargador por país.
update abm_canales c set estado = 'invalido'
  from abm_cuentas a
 where a.id = c.cuenta_id and c.tipo like 'whatsapp%' and a.pais <> 'México'
   and regexp_replace(c.valor, '\D', '', 'g') !~ ('^' || case a.pais
        when 'España' then '34' when 'Argentina' then '54' when 'Colombia' then '57'
        when 'Chile' then '56' when 'Perú' then '51' when 'Ecuador' then '593'
        when 'Costa Rica' then '506' when 'Panamá' then '507' when 'Uruguay' then '598'
        when 'Guatemala' then '502' when 'República Dominicana' then '1' else '52' end);

-- 3 · «Ciudad de» ────────────────────────────────────────────────────────────
-- `ciudad_limpia` quita el nombre del país al final de la ciudad («Santiago de
-- Chile» → «Santiago») y con «Ciudad de Panamá» dejó «Ciudad de». En el correo
-- se leería «…, en Ciudad de,». El arreglo de raíz va en paises.py (no cortar
-- si lo que queda termina en preposición); esto repara las 6 ya cargadas.
update abm_cuentas set ciudad = 'Ciudad de Panamá'   where ciudad = 'Ciudad de' and pais = 'Panamá';
update abm_cuentas set ciudad = 'Ciudad de Guatemala' where ciudad = 'Ciudad de' and pais = 'Guatemala';

-- 4 · La ciudad que contradice al nombre ─────────────────────────────────────
-- Cuentas de varias tiendas: se guardó la ciudad de una sucursal y el nombre
-- dice otra («Novias Ávila», ciudad Barcelona). El correo dice «{{nombre}}, en
-- {{ciudad}}»: queda raro justo en el primer renglón. Manda el nombre.
update abm_cuentas set ciudad = 'Valencia'      where nombre = 'La Trajería Valencia'   and pais = 'España';
update abm_cuentas set ciudad = 'Bilbao'        where nombre = 'SIMORRA Bilbao'         and pais = 'España';
update abm_cuentas set ciudad = 'Málaga'        where nombre = 'Valerio Luna Malaga'    and pais = 'España';
update abm_cuentas set ciudad = 'Ávila'         where nombre = 'Novias Ávila'           and pais = 'España';
update abm_cuentas set ciudad = 'Santo Domingo' where nombre = 'LANÓVEA @ Santo Domingo' and pais = 'República Dominicana';

-- 5 · Cadenas de moda que NO son casas de novia ──────────────────────────────
-- Entraron por una categoría secundaria de Maps («Dress store») y caen en la
-- ruta diagnóstico, la que habla de «una cadena de novias». A Adolfo Domínguez
-- o a Maje ese correo les llega mal. Se quedan en pausa con su motivo hasta
-- decidir a qué giro pertenecen (cadenas / boutiques), sin borrarlas.
update abm_cuentas set etapa = 'en_pausa',
       pausa_motivo = 'No es casa de novias: cadena de moda que entró por categoría secundaria. Revisar a qué giro va antes de escribirle.'
 where giro = 'novias' and pais <> 'México'
   and nombre in ('Adolfo Dominguez', 'PUNT ROMA , S.L.', 'Maje', 'Dandara', 'Coosy', 'SIMORRA Bilbao', 'Encuentro Moda');

commit;

select (select count(*) from abm_canales c join abm_cuentas a on a.id=c.cuenta_id where a.giro='novias' and a.pais<>'México' and c.tipo like 'email%' and c.estado='invalido') correos_invalidos,
       (select count(*) from abm_canales c join abm_cuentas a on a.id=c.cuenta_id where a.giro='novias' and a.pais<>'México' and c.tipo like 'whatsapp%' and c.estado='invalido') wa_invalidos,
       (select count(*) from abm_cuentas where giro='novias' and pais<>'México' and (tiene_email or tiene_wa)) contactables;
