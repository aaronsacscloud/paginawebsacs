-- Aprendizaje: distinguir lo que el dueño APROBÓ explícitamente de lo que salió solo al vencer la ventana.
alter table ti_envios add column if not exists aprobado_por uuid, add column if not exists revisado_at timestamptz;
