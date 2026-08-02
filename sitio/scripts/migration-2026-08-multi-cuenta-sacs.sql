-- Un cliente puede tener VARIAS cuentas de SACS (p.ej. boomfitness + urban del
-- mismo dueño). Hasta ahora companies.sacs_account era una sola, así que el CRM
-- enseñaba la mitad de su operación real y las señales de riesgo se calculaban
-- sobre datos incompletos.
--
-- Aditivo: `companies.sacs_account` SE CONSERVA como la cuenta PRINCIPAL (todo
-- lo que ya la lee sigue funcionando) y `companies.actividad` pasa a guardar el
-- AGREGADO de todas. El detalle por cuenta vive aquí.
create table if not exists company_sacs_accounts (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  cuenta       text not null,
  es_principal boolean not null default false,
  actividad    jsonb,
  uso_sacs     jsonb,
  sync_at      timestamptz,
  uso_sync_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Una cuenta de SACS pertenece a UN solo cliente: el índice único evita que la
-- misma cuenta se cuente dos veces en el ARR o en las métricas.
create unique index if not exists uq_csa_cuenta on company_sacs_accounts (lower(trim(cuenta)));
create index if not exists ix_csa_company on company_sacs_accounts (company_id);

-- Backfill: la cuenta que ya tenía cada empresa se vuelve su principal.
insert into company_sacs_accounts (company_id, cuenta, es_principal, actividad, sync_at)
select id, lower(trim(sacs_account)), true, actividad, actividad_sync_at
  from companies
 where sacs_account is not null and trim(sacs_account) <> ''
on conflict do nothing;
