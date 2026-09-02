-- ti_envios: el toque fuera de la ventana de 24 h viaja como PLANTILLA
-- (marketing primero; a los 10 min, si Meta no la entregó, la utility).
alter table ti_envios add column if not exists plantilla jsonb;          -- {marketing, utility, params:[nombre, angulo]}
alter table ti_envios add column if not exists fallback_at timestamptz;  -- cuándo revisar la entrega de la marketing
alter table ti_envios add column if not exists fallback_estado text;     -- pendiente | entregada | utility_enviada | sin_utility | error
create index if not exists ti_envios_fallback on ti_envios (fallback_at) where fallback_estado = 'pendiente';
