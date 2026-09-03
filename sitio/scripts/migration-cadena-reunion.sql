-- Cadena obligatoria después de la reunión (2026-09-03): dueño de la reunión y escalamiento de deudas de dato.
alter table bookings add column if not exists consultor_id uuid references team_members(id);
alter table ti_tareas add column if not exists escalado_at timestamptz;
alter table ti_tareas add column if not exists escalaciones int not null default 0;
update ti_config set valor = valor || '{"consultor_default":"60be8bd8-995a-45ca-926f-1bcb159d3c1e"}'::jsonb where id = 1 and not (valor ? 'consultor_default');
