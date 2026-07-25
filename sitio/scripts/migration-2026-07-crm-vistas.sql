-- Migración: vistas guardadas de los datatables del CRM (estilo HubSpot).
-- Correr una vez en el SQL Editor de Supabase.
--
-- Cada fila es una vista personalizada de una tabla del CRM: su combinación de
-- búsqueda + filtros rápidos + condiciones avanzadas + orden, con nombre.
-- `tabla` identifica el datatable ('clientes', 'suscripciones', 'pagos'…) para
-- que el mismo sistema sirva en todos.

create table if not exists crm_vistas (
  id uuid primary key default gen_random_uuid(),
  tabla text not null,
  nombre text not null,
  config jsonb not null default '{}',
  orden int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_vistas_tabla on crm_vistas(tabla, orden, created_at);
