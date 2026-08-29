-- LIMPIEZA DE LA DATA DE QA DEL CRM  ·  2026-08-29  ·  PENDIENTE DE EJECUTAR
--
-- Qué borra (contado antes de escribirlo, no estimado):
--     4 empresas        QA WhatsApp (borrar), Zapatería QA (borrar), QA 2, QA 3
--     4 contactos       Test Lead, Pedro Contador QA, Prueba QA Inbox, QA Captura
--     4 conversaciones  los números +52 55 9911 22xx / 9988 7766
--    33 mensajes de WhatsApp
--    41 actividades
--     1 suscripción     <-- ACTIVA, con $17,880 de ARR
--     1 pago            <-- CONFIRMADO, $1,490
--
-- LO IMPORTANTE: esa suscripción y ese pago NO son adorno. Están dentro de los
-- totales que ve el dueño. De los $1,923,409 de ARR del CRM, $17,880 (0.93%)
-- son de una empresa que se llama literalmente "QA WhatsApp (borrar)", y de los
-- $3,136,981 en pagos confirmados, $1,490 también. Mientras esto viva, todo
-- reporte de dinero del CRM viene inflado.
--
-- Va en UNA transacción y en orden de dependencias (hijos antes que padres): si
-- algo falla a media lista, no queda medio borrado. Al final consulta el ARR ya
-- sin la basura y cuántas filas de QA sobreviven — deben ser cero.
--
-- Cómo correrlo (Management API, ver CLAUDE.md -> Secretos):
--   TOK=$(cat .supabase-token)
--   curl -s -X POST "https://api.supabase.com/v1/projects/wtzhogdyicekxcnclmyu/database/query" \
--     -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
--     --data "{\"query\": $(node -e 'console.log(JSON.stringify(require("fs").readFileSync("sitio/scripts/limpieza-2026-08-datos-qa.sql","utf8")))')}"
--
-- NO se ejecutó desde la sesión que lo escribió: el entorno bloquea escrituras
-- destructivas en producción, y está bien que así sea. Lo corre una persona.

begin;

create temp table _emp on commit drop as
  select id from companies where nombre ilike '%QA%' or nombre ilike '%borrar%';

create temp table _con on commit drop as
  select id from contacts
   where nombre ilike '%QA%' or nombre ilike '%borrar%'
      or whatsapp like '%99112%' or whatsapp like '%99887766%' or whatsapp = '+525551234567'
      or email ilike '%qa%example%' or email ilike '%test%example%' or email ilike '%qa-captura%'
      or company_id in (select id from _emp);

create temp table _wc on commit drop as
  select id from wa_conversaciones
   where contact_id in (select id from _con) or company_id in (select id from _emp)
      or telefono like '%99112%' or telefono like '%99887766%';

-- Hijos de la conversación primero: si se borra la conversación antes, los
-- mensajes quedan huérfanos apuntando a nada (o la FK aborta la transacción).
delete from wa_mensajes  where conversation_id in (select id from _wc);
delete from wa_notas     where conversation_id in (select id from _wc);
delete from wa_eventos   where conversation_id in (select id from _wc);
delete from wa_lecturas  where conversation_id in (select id from _wc);
delete from wa_llamadas  where conversation_id in (select id from _wc);
delete from wa_conversaciones where id in (select id from _wc);

delete from activities         where contact_id in (select id from _con);
delete from contact_visits     where contact_id in (select id from _con);
delete from tiktok_crm_eventos where contact_id in (select id from _con);
delete from crm_etiqueta_asignaciones
      where entidad_id in (select id::text from _con)
         or entidad_id in (select id::text from _emp);
delete from quotes   where contact_id in (select id from _con) or company_id in (select id from _emp);
delete from bookings where contact_id in (select id from _con);

-- El dinero al final y antes de la empresa: es lo que limpia los totales.
delete from payments      where company_id in (select id from _emp);
delete from subscriptions where company_id in (select id from _emp);

delete from contacts  where id in (select id from _con);
delete from companies where id in (select id from _emp);

-- Comprobación en la MISMA transacción: si algo de esto no sale en cero, hay
-- que hacer rollback en vez de commit.
select
  (select coalesce(sum(s.arr), 0) from subscriptions s where s.estado = 'activa') as arr_despues,
  (select count(*) from companies where nombre ilike '%QA%' or nombre ilike '%borrar%') as empresas_qa_restantes,
  (select count(*) from wa_conversaciones where telefono like '%99112%') as convs_qa_restantes;

commit;
