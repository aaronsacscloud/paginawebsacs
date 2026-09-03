-- Segunda tanda de gastos del dueño (2026-09-03 noche). Idempotente por nombre.
insert into fin_gastos (nombre, categoria, monto, periodicidad, dia_cobro, inicio, proveedor, notas, probable)
select v.* from (values
  ('Vercel · sacscloud', 'suscripcion', 500, 'mensual', 15, '2026-09-01'::date, 'Vercel', null, false),
  ('Vercel · Aaron H', 'suscripcion', 750, 'mensual', 15, '2026-09-01'::date, 'Vercel', null, false),
  ('Krisp', 'suscripcion', 690, 'mensual', 15, '2026-09-01'::date, 'Krisp', null, false),
  ('Respond', 'suscripcion', 1000, 'mensual', null, '2026-09-01'::date, 'Respond.io', null, false),
  ('Celular de Andy', 'otro', 1400, 'mensual', null, '2026-09-01'::date, null, 'Herramienta de trabajo', false),
  ('Celular de Aaron', 'otro', 2400, 'mensual', null, '2026-09-01'::date, null, 'Herramienta de trabajo', false),
  ('Konfio · tarjeta', 'otro', 8500, 'mensual', 13, '2026-09-01'::date, 'Konfio', 'Variable: normalmente entre $7,000 y $10,000. El estimado sigue al promedio de lo pagado.', true)
) as v(nombre, categoria, monto, periodicidad, dia_cobro, inicio, proveedor, notas, probable)
where not exists (select 1 from fin_gastos g where g.nombre = v.nombre);
update fin_gastos set monto = 25000, notas = 'Estimado mensual de TikTok ($25,000). Lo real sale de la inversión capturada en Embudo.' where nombre = 'Publicidad (variable, estimado)';
update fin_adeudos set cuota = 5000, notas = 'Saldo $300,000 sin intereses; $5,000 cada día 30.' where nombre = 'Adeudo Michael Bosch';
insert into marketing_gastos (canal, campana, periodo_inicio, periodo_fin, monto, moneda, nota)
select 'tiktok', 'Lead form · septiembre', '2026-09-01', '2026-09-30', 25000, 'MXN', 'Presupuesto mensual habitual (capturado 2026-09-03); ajusta al real' where not exists (select 1 from marketing_gastos where canal = 'tiktok' and periodo_inicio = '2026-09-01');
