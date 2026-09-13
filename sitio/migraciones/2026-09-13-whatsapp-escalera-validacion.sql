-- La escalera de validación de WhatsApp.
--
-- No se le manda WhatsApp a un número que no sabemos si lo tiene. Cada envío a
-- un número sin WhatsApp cuenta contra la calificación de calidad de la línea,
-- y teníamos 554 números inferidos del teléfono listos para salir a ciegas.
--
-- No hay forma de preguntarle a Meta: el endpoint `contacts` del API viejo, que
-- sí respondía si un número estaba registrado, lo neutralizaron a propósito y
-- HOY RESPONDE SIEMPRE "válido". La Cloud API nunca lo tuvo. Quien ofrezca ese
-- servicio está corriendo un cliente no oficial de WhatsApp: viola sus términos
-- y el baneo cae en la cuenta que lo usa.
--
-- Lo que sí se puede es descartar a los que es imposible que lo tengan, y saber
-- con certeza cuáles sí porque el propio negocio lo publica.
--
-- LOS ESTADOS
--   declarado   el negocio publica ese número como WhatsApp (wa.me en su sitio)
--               → CERTEZA. No se valida: ya lo dijo él.
--   probable    Twilio Lookup dice MÓVIL → puede tenerlo
--   descartado  Lookup dice fijo / VoIP fijo / 800 → casi seguro NO
--   valido      un mensaje se entregó → confirmado que SÍ
--   invalido    el envío devolvió 131026, o el número ni existe
--   sin_probar  todavía no se sabe
--
-- REGLA DURA: solo `declarado`, `probable` y `valido` reciben mensaje.

-- 1. Los que raspamos de un enlace wa.me de su propio sitio son DECLARADOS.
--    El negocio publicó "escríbenos por WhatsApp a este número": no hay mejor
--    prueba que esa, y gastar una consulta de Lookup en ellos es tirar dinero.
update abm_canales x set estado = 'declarado', confianza = 'alta',
       verificado_at = coalesce(x.verificado_at, now())
  from abm_fuentes f
 where f.cuenta_id = x.cuenta_id and f.valor = x.valor
   and f.campo = 'whatsapp' and f.metodo = 'sitio_propio'
   and x.tipo like 'whatsapp%' and x.estado = 'sin_probar';

-- 2. El resto se queda 'sin_probar' hasta que Lookup los clasifique. Antes de
--    hoy 'sin_probar' significaba "adelante, todavía no falla"; a partir de
--    ahora significa "NO SABEMOS, no le escribas".

-- 3. Guarda de verdad: nadie manda WhatsApp a un canal no validado. Se pone en
--    la base y no solo en el código, porque a la lista de trabajo la leen
--    varias pantallas y el día que alguien escriba una consulta nueva no se va
--    a acordar de esta regla.
create or replace view v_whatsapp_contactable as
  select x.*, c.nombre as cuenta_nombre, c.giro, c.ciudad, c.puntaje
    from abm_canales x
    join abm_cuentas c on c.id = x.cuenta_id
   where x.tipo like 'whatsapp%'
     and x.estado in ('declarado', 'probable', 'valido')
     and c.etapa is distinct from 'no_contactar'
     and c.ya_es_cliente is null;

comment on view v_whatsapp_contactable is
  'Los ÚNICOS números de WhatsApp a los que se puede escribir. Un número sin validar no está aquí a propósito: mandarle mensaje quema la calificación de la línea. Ver MANUAL-PROSPECCION-ABM.md, sección 6.';
