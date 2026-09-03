-- Gastos recurrentes del dueño (capturados 2026-09-03). Idempotente por nombre.
insert into fin_gastos (nombre, categoria, monto, periodicidad, dia_cobro, inicio, proveedor, notas, probable)
select v.nombre, v.categoria, v.monto, v.periodicidad, v.dia_cobro, v.inicio::date, v.proveedor, v.notas, v.probable from (values
  ('Paul · 1ª quincena', 'nomina', 16500, 'mensual', 15, '2026-09-01', 'Paul', 'Se paga el día 15', false),
  ('Paul · 2ª quincena', 'nomina', 16500, 'mensual', 30, '2026-09-01', 'Paul', 'Se paga el 30 o 31', false),
  ('Marisol · 1ª quincena', 'nomina', 11500, 'mensual', 15, '2026-09-01', 'Marisol', 'Se paga el día 15', false),
  ('Marisol · 2ª quincena', 'nomina', 11500, 'mensual', 30, '2026-09-01', 'Marisol', 'Se paga el día 30', false),
  ('Anthropic · API normal', 'suscripcion', 1500, 'mensual', null, '2026-09-01', 'Anthropic', null, false),
  ('Anthropic · cuenta de tokens 1', 'suscripcion', 4000, 'mensual', 15, '2026-09-01', 'Anthropic', 'Se cobra el 15', false),
  ('Anthropic · cuenta de tokens 2', 'suscripcion', 4000, 'mensual', 15, '2026-09-01', 'Anthropic', 'Se cobra el 15', false),
  ('Anthropic · cuenta de tokens 3', 'suscripcion', 4000, 'mensual', 15, '2026-09-01', 'Anthropic', 'Se cobra el 15', false),
  ('Servidor de Google', 'suscripcion', 12000, 'anual', 30, '2025-12-01', 'Google Cloud', 'Cada 30 de diciembre; el monto varía un poco', false),
  ('GitHub', 'suscripcion', 150, 'mensual', 30, '2026-09-01', 'GitHub', null, false),
  ('Asana', 'suscripcion', 490, 'mensual', 2, '2026-09-01', 'Asana', null, false),
  ('Intercom', 'suscripcion', 1000, 'mensual', 10, '2026-09-01', 'Intercom', null, false),
  ('Supabase · cuenta de Aaron', 'suscripcion', 500, 'mensual', null, '2026-09-01', 'Supabase', null, false),
  ('Supabase · cuenta de Paul', 'suscripcion', 1000, 'mensual', null, '2026-09-01', 'Supabase', null, false),
  ('Publicidad (variable, estimado)', 'marketing', 0, 'mensual', null, '2026-09-01', null, 'Ajusta el estimado; lo real sale de la inversión capturada en Embudo', true)
) as v(nombre, categoria, monto, periodicidad, dia_cobro, inicio, proveedor, notas, probable)
where not exists (select 1 from fin_gastos g where g.nombre = v.nombre);
