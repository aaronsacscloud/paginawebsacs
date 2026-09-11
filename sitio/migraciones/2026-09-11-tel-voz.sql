-- Fernanda al teléfono (voz con IA en el marcador)
-- 1. Quién habla en la sesión: el vendedor (manual), Fernanda sola (ia) o Fernanda con el vendedor escuchando (asistido).
alter table tel_sesiones add column if not exists modo text not null default 'manual';
alter table tel_sesiones drop constraint if exists tel_sesiones_modo_chk;
alter table tel_sesiones add constraint tel_sesiones_modo_chk check (modo in ('manual','ia','asistido'));
-- 2. Lo que midió la central en cada llamada de Fernanda (latencias, herramientas, tokens, costo, handoff).
alter table tel_sesion_items add column if not exists voz jsonb;
-- 3. Configuración única (Configuración → Telefonía → Fernanda): voz, revelar_ia, tope de gasto, anexo del guion.
create table if not exists tel_voz_config (
  id int primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into tel_voz_config (id) values (1) on conflict do nothing;
-- 4. Llamadas de prueba (llamar-prueba.mjs): no tienen item del marcador, pero sí queremos las métricas.
create table if not exists tel_voz_pruebas (
  id bigserial primary key,
  item text not null,
  call_sid text,
  resumen jsonb,
  created_at timestamptz not null default now()
);
