-- Checklists de entrega con el cliente (19-oct-2026).
-- Una fila = una sesión de revisión (ej. «dashboard y reportes de consignación»
-- con un cliente). La página pública /entrega/<guia>?s=<codigo> lee y guarda
-- aquí lo que el consultor captura en la tableta. El código es la llave: largo
-- y aleatorio, igual que la liga de una minuta.
create table if not exists public.entregas_checklist (
  codigo      text primary key check (codigo ~ '^[a-z0-9]{12,40}$'),
  guia        text not null,
  cliente     text,
  data        jsonb not null default '{}'::jsonb,
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists entregas_checklist_guia_idx on public.entregas_checklist (guia, updated_at desc);
-- Solo el servidor (service key) la toca: RLS encendido y sin políticas.
alter table public.entregas_checklist enable row level security;
