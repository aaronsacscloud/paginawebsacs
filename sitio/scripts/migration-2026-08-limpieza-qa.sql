begin;
create temp table _qc as select id from companies where nombre ilike 'qa-%' or nombre ilike 'QA %' or nombre = 'Test Corp';
create temp table _qk as select id from contacts where nombre ilike 'QA %' or email ilike 'qa-%' or campana ilike 'qa-%'
   or nombre ilike '%prueba crm%' or email ilike '%pruebasacscrm%' or company_id in (select id from _qc);

delete from activities            where contact_id in (select id from _qk);
delete from automation_enrollments where contact_id in (select id from _qk);
delete from bookings              where contact_id in (select id from _qk);
delete from churn_events          where contact_id in (select id from _qk);
delete from deals                 where contact_id in (select id from _qk);
delete from email_sends           where contact_id in (select id from _qk);
delete from email_unsubscribes    where contact_id in (select id from _qk);
delete from gifts                 where redeemed_by_contact in (select id from _qk);
delete from partner_commissions   where contact_id in (select id from _qk);
delete from partner_invitations   where contact_id in (select id from _qk);
delete from payments              where contact_id in (select id from _qk);
delete from quotes                where contact_id in (select id from _qk);

delete from activities            where company_id in (select id from _qc);
delete from churn_events          where company_id in (select id from _qc);
delete from deals                 where company_id in (select id from _qc);
delete from discounts             where company_id in (select id from _qc);
delete from mrr_movements         where company_id in (select id from _qc);
delete from payments              where company_id in (select id from _qc);
delete from quotes                where company_id in (select id from _qc);
delete from subscription_addons   where company_id in (select id from _qc);

delete from contacts  where id in (select id from _qk);
delete from companies where id in (select id from _qc);

select (select count(*) from contacts  where nombre ilike 'QA %' or email ilike 'qa-%' or campana ilike 'qa-%' or nombre ilike '%prueba crm%') contactos_qa_restantes,
       (select count(*) from companies where nombre ilike 'qa-%' or nombre ilike 'QA %' or nombre='Test Corp') empresas_qa_restantes,
       (select count(*) from companies) empresas_totales,
       (select count(*) from contacts) contactos_totales,
       (select count(*) from subscriptions) subs_totales,
       (select coalesce(sum(mrr),0) from subscriptions where estado='activa') mrr_activo;
commit;
