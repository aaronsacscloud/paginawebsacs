-- Config del envío en frío: el calentamiento y el freno viven en la base, no
-- en el código, porque el dueño tiene que poder pausarlo sin un despliegue.
create table if not exists abm_config (
  clave text primary key,
  valor text not null,
  nota text,
  updated_at timestamptz default now()
);
insert into abm_config (clave, valor, nota) values
  ('calentamiento_inicio', to_char(current_date,'YYYY-MM-DD'), 'Día 1 de la rampa. El cupo diario sube desde aquí.'),
  ('tope_diario',          '120', 'Techo operativo de correos en frío por día, ya calentado el dominio.'),
  ('cupo_inicial',         '15',  'Con cuántos empieza la rampa el primer día.'),
  ('pausado',              'si',  'si = no sale ningún correo en frío. Arranca pausado a propósito.'),
  ('tope_por_cuenta_dia',  '1',   'Nunca dos correos al mismo negocio el mismo día.')
on conflict (clave) do nothing;

alter table abm_toques add column if not exists send_id uuid;
create index if not exists abm_toques_send_ix on abm_toques (send_id);
alter table abm_cuentas add column if not exists ultimo_toque_at timestamptz;
