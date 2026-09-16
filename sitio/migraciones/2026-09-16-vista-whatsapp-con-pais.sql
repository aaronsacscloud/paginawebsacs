-- ══ `v_whatsapp_contactable` no traía el país, y el cron pedía esa columna ═══
--
-- El arreglo de hoy que acotó el WhatsApp en frío a México filtra con
-- `.eq('pais','México')` sobre esta vista… que no tiene `pais`. PostgREST
-- responde 400 «column v_whatsapp_contactable.pais does not exist» y el cron
-- devuelve 500 en CADA corrida: está agendado `0 16-23 * * 1-5`, o sea 40
-- corridas fallidas por semana, en silencio, porque nadie vigila crons rotos.
--
-- No salió nada malo porque `abm_frio` está apagado. Pero el día que se
-- encendiera, no habría salido un solo WhatsApp y el motivo no aparecería en
-- ningún lado. Un filtro de seguridad que rompe la consulta entera no protege:
-- apaga, y apagar en silencio es lo mismo que fallar en silencio.
--
-- La columna va en la VISTA y no en el código: el país de la cuenta es dato de
-- la cuenta, y la vista ya trae `giro`, `ciudad` y `puntaje` del mismo JOIN.
-- Así el cron puede además leer la hora local de cada quien.

create or replace view v_whatsapp_contactable as
 select x.id, x.cuenta_id, x.persona_id, x.tipo, x.valor, x.confianza,
        x.estado, x.es_de_la_tienda, x.verificado_at, x.created_at,
        c.nombre as cuenta_nombre, c.giro, c.ciudad, c.puntaje, c.pais
   from abm_canales x
   join abm_cuentas c on c.id = x.cuenta_id
  where x.tipo like 'whatsapp%'
    and x.estado = any (array['declarado','valido'])
    and c.etapa is distinct from 'no_contactar'
    and c.ya_es_cliente is null;

select count(*) total, count(*) filter (where pais='México') mexico,
       count(*) filter (where pais<>'México') fuera
from v_whatsapp_contactable;
