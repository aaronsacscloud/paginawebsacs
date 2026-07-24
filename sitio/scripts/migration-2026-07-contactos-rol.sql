-- Migración: multi-contacto por cliente (rol + contacto principal)
-- Correr una vez en el SQL Editor de Supabase.
--
-- Un cliente (company) puede tener VARIOS contactos. Para tenerlos ordenados:
--   rol          → quién es esa persona en la cuenta (dueño, gerente, facturación…)
--   es_principal → el contacto por default (el que sale en la tabla de Clientes,
--                  a quien se escribe por WhatsApp, el que usan los exports).
-- El código es tolerante si esta migración no ha corrido (cae al contacto más
-- antiguo), pero sin ella no se puede marcar principal ni guardar rol.

alter table contacts add column if not exists rol text;
alter table contacts add column if not exists es_principal boolean not null default false;

-- Máximo UN principal por empresa (índice parcial único).
create unique index if not exists uq_contacts_principal_por_company
  on contacts(company_id) where es_principal = true and company_id is not null;

-- Arranque: marca como principal al contacto más antiguo de cada empresa que
-- aún no tenga principal (mismo criterio que ya usaba el código).
update contacts c set es_principal = true
where c.id in (
  select distinct on (company_id) id
  from contacts
  where company_id is not null and archived_at is null
  order by company_id, created_at asc
)
and not exists (
  select 1 from contacts p
  where p.company_id = c.company_id and p.es_principal = true
);
