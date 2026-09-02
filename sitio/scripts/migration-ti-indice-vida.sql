-- Índice de vida del lead (F4): un número que sube y baja con lo que pasa, y su estado sugerido.
alter table ti_perfil add column if not exists indice_vida int, add column if not exists indice_estado text,
  add column if not exists indice_detalle jsonb, add column if not exists indice_at timestamptz;
