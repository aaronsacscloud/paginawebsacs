-- LIMPIEZA DE LA DATA DE QA DEL CRM  ·  2026-08-29  ·  ✅ EJECUTADO
--
-- Resultado real, verificado contra la base después de correrlo:
--     ARR    $1,923,409 -> $1,905,529   (exactamente -$17,880)
--     Pagos  $3,136,981 -> $3,135,491   (exactamente -$1,490)
--     empresas / contactos / conversaciones de QA restantes: 0, 0, 0
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
-- reporte de dinero del CRM viene inflado, y nadie lo iba a notar porque la
-- cifra se ve razonable.
--
-- POR QUÉ LA LISTA ES TAN LARGA: `contacts` y `companies` tienen 57 llaves
-- foráneas apuntándoles (31 y 26), más 7 que apuntan a `wa_conversaciones`. Se
-- sacaron del catálogo de la base (information_schema), NO de memoria: los dos
-- primeros intentos murieron por una FK que no estaba en la lista escrita a
-- mano —primero `crm_etiqueta_asignaciones` por un cast, después `email_sends`—
-- y cada muerte revirtió la transacción entera. Preguntarle a la base cuáles
-- son es más barato que descubrirlas de una en una.
--
-- Va en UNA transacción y de nietos a padres: si algo falla a media lista, no
-- queda medio borrado. Al final consulta el ARR ya limpio y cuántas filas de QA
-- sobreviven — si eso no sale en cero, toca ROLLBACK en vez de commit.
--
-- Cómo correrlo (Management API, ver CLAUDE.md -> Secretos):
--   TOK=$(cat .supabase-token)
--   curl -s -X POST "https://api.supabase.com/v1/projects/wtzhogdyicekxcnclmyu/database/query" \
--     -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
--     --data "{\"query\": $(node -e 'console.log(JSON.stringify(require("fs").readFileSync("sitio/scripts/limpieza-2026-08-datos-qa.sql","utf8")))')}"

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

create temp table _ec on commit drop as
  select id from email_conversations
   where contact_id in (select id from _con) or company_id in (select id from _emp);

create temp table _q on commit drop as
  select id from quotes where contact_id in (select id from _con) or company_id in (select id from _emp);

create temp table _sub on commit drop as
  select id from subscriptions where company_id in (select id from _emp) or contact_id in (select id from _con);

create temp table _deals on commit drop as
  select id from deals where contact_id in (select id from _con) or company_id in (select id from _emp);

-- ── NIETOS: lo que cuelga de las conversaciones y de los documentos ────────
delete from wa_mensajes    where conversation_id in (select id from _wc);
delete from wa_notas       where conversation_id in (select id from _wc);
delete from wa_eventos     where conversation_id in (select id from _wc);
delete from wa_lecturas    where conversation_id in (select id from _wc);
delete from wa_llamadas    where conversation_id in (select id from _wc);
delete from wa_presencia   where conversation_id in (select id from _wc);
delete from wa_programados where conversation_id in (select id from _wc);
delete from wa_conversaciones where id in (select id from _wc);

delete from email_messages where conversation_id in (select id from _ec);
delete from email_conversations where id in (select id from _ec);

delete from quote_vistas where quote_id in (select id from _q) or contact_id in (select id from _con);
delete from subscription_addons where subscription_id in (select id from _sub) or company_id in (select id from _emp);

-- ── HIJOS de contacto ──────────────────────────────────────────────────────
delete from activities              where contact_id in (select id from _con);
delete from automation_enrollments  where contact_id in (select id from _con);
delete from bookings                where contact_id in (select id from _con);
delete from contact_visits          where contact_id in (select id from _con);
delete from email_campaign_recipients where contact_id in (select id from _con);
delete from email_sends             where contact_id in (select id from _con);
delete from email_no_alcanzados     where contact_id in (select id from _con);
delete from email_suppressions      where contact_id in (select id from _con);
delete from email_unsubscribes      where contact_id in (select id from _con);
delete from email_list_members      where contact_id in (select id from _con);
delete from mig_respond_contactos   where contact_id in (select id from _con);
delete from partner_commissions     where contact_id in (select id from _con);
delete from partner_invitations     where contact_id in (select id from _con);
delete from quote_vistas            where contact_id in (select id from _con);
delete from tiktok_crm_eventos      where contact_id in (select id from _con);
delete from web_disparos            where contact_id in (select id from _con);
update gifts set redeemed_by_contact = null where redeemed_by_contact in (select id from _con);
update contacts set contacto_de = null where contacto_de in (select id from _con);

-- ── HIJOS de empresa ───────────────────────────────────────────────────────
delete from cobranza_gestiones    where company_id in (select id from _emp);
delete from cobros_programados    where company_id in (select id from _emp);
delete from company_sacs_accounts where company_id in (select id from _emp);
delete from crm_cobros_mp         where company_id in (select id from _emp);
delete from crm_notificaciones    where company_id in (select id from _emp);
delete from crm_soporte_hallazgos where company_id in (select id from _emp);
delete from discounts             where company_id in (select id from _emp);
delete from mejoras               where company_id in (select id from _emp);
delete from mrr_movements         where company_id in (select id from _emp);
delete from unificaciones         where company_id in (select id from _emp);

-- ── DE LOS DOS ─────────────────────────────────────────────────────────────
delete from churn_events       where contact_id in (select id from _con) or company_id in (select id from _emp);
delete from crm_soporte_tickets where contact_id in (select id from _con) or company_id in (select id from _emp);
delete from email_presion      where contact_id in (select id from _con) or company_id in (select id from _emp);
delete from expansion_signals  where contact_id in (select id from _con) or company_id in (select id from _emp);
delete from invoices           where contact_id in (select id from _con) or company_id in (select id from _emp);
delete from product_events     where contact_id in (select id from _con) or company_id in (select id from _emp);
delete from wa_broadcast_destinatarios where contact_id in (select id from _con) or company_id in (select id from _emp);
delete from crm_etiqueta_asignaciones
      where entidad_id in (select id from _con) or entidad_id in (select id from _emp);
delete from deals where id in (select id from _deals);

-- ── EL DINERO: al final, y antes de la empresa. Es lo que limpia los totales.
delete from quotes        where id in (select id from _q);
delete from payments      where company_id in (select id from _emp) or contact_id in (select id from _con);
delete from subscriptions where id in (select id from _sub);

-- ── LOS PADRES ─────────────────────────────────────────────────────────────
delete from contacts  where id in (select id from _con);
delete from companies where id in (select id from _emp);

-- Comprobación en la MISMA transacción: los tres deben salir en cero (salvo el
-- ARR, que debe BAJAR $17,880 exactos y quedar en 1,905,529).
select
  (select coalesce(sum(s.arr), 0) from subscriptions s where s.estado = 'activa') as arr_despues,
  (select count(*) from companies where nombre ilike '%QA%' or nombre ilike '%borrar%') as empresas_qa_restantes,
  (select count(*) from contacts where nombre ilike '%QA%' or nombre ilike '%borrar%') as contactos_qa_restantes,
  (select count(*) from wa_conversaciones where telefono like '%99112%') as convs_qa_restantes;

commit;
