// Contrato de los PAGOS DIFERIDOS.
//
// Aquí se decide cuánto dinero enseña «Por cobrar este mes». Los casos son los
// que de verdad rompen: un anticipo que cubre exhibiciones en orden, una
// parcialidad vencida que no se puede perder al pasar de mes, y la cotización
// con plan que NO debe contarse además por su total.
import assert from 'node:assert';
import { planDeCotizacion, exhibicionExigible, parcialidadesDelMes } from './plan.ts';

let n = 0;
const t = (nombre: string, fn: () => void) => { fn(); n++; console.log('  ✓', nombre); };

/** Una cotización como las guarda el sistema: el plan vive en el meta de notas. */
const cot = (id: string, numero: string, plan: any[]) => ({
  id, numero, companies: { nombre_comercial: 'Ruben\'s' },
  notas: `Texto libre\n---META---\n${JSON.stringify({ plan_pagos: plan })}`,
});

const PLAN_RUBENS = [
  { fecha: '2026-08-15', monto: 30000, concepto: 'Anticipo' },
  { fecha: '2026-09-15', monto: 30000, concepto: 'Parcialidad 2' },
  { fecha: '2026-10-15', monto: 30000, concepto: 'Parcialidad 3' },
  { fecha: '2026-11-15', monto: 30000, concepto: 'Parcialidad 4' },
  { fecha: '2026-12-15', monto: 30000, concepto: 'Parcialidad 5' },
];

console.log('\nplanDeCotizacion');

t('el abono cubre las exhibiciones en orden de fecha, no a prorrateo', () => {
  const p = planDeCotizacion(cot('q1', 'COT-1', PLAN_RUBENS), 30000, '2026-09-03');
  assert.equal(p[0].estado, 'pagada');
  assert.equal(p[0].cubierto, 30000);
  assert.equal(p[1].estado, 'pendiente');
  assert.equal(p[1].monto, 30000);
});

t('un abono a medias deja la exhibición pendiente por lo que FALTA', () => {
  const p = planDeCotizacion(cot('q1', 'COT-1', PLAN_RUBENS), 42000, '2026-09-03');
  assert.equal(p[0].estado, 'pagada');
  assert.equal(p[1].monto, 18000, 'la segunda debe quedar por 18,000, no por 30,000');
  assert.equal(p[1].cubierto, 12000);
});

t('vencida es la que pasó su fecha y sigue sin cubrirse', () => {
  const p = planDeCotizacion(cot('q1', 'COT-1', PLAN_RUBENS), 0, '2026-09-03');
  assert.equal(p[0].vencida, true, 'el anticipo del 15-ago sin pagar está vencido');
  assert.equal(p[1].vencida, false, 'la del 15-sep todavía no vence');
});

t('sin plan no hay exhibiciones: una venta de un golpe no se inventa parcialidades', () => {
  assert.deepEqual(planDeCotizacion({ id: 'q', notas: 'sin meta' }, 0, '2026-09-03'), []);
});

t('la exigible es la vencida más vieja; si no hay vencidas, la próxima', () => {
  const conVencida = planDeCotizacion(cot('q1', 'COT-1', PLAN_RUBENS), 0, '2026-09-03');
  assert.equal(exhibicionExigible(conVencida)!.concepto, 'Anticipo');
  const alCorriente = planDeCotizacion(cot('q1', 'COT-1', PLAN_RUBENS), 30000, '2026-09-03');
  assert.equal(exhibicionExigible(alCorriente)!.concepto, 'Parcialidad 2');
});

console.log('\nparcialidadesDelMes');

const abon = (id: string, monto: number) => new Map([[id, monto]]);

t('la parcialidad que vence este mes entra en el mes', () => {
  const { filas } = parcialidadesDelMes([cot('q1', 'COT-78905', PLAN_RUBENS)], abon('q1', 30000), '2026-09', '2026-09-03');
  assert.equal(filas.length, 1);
  assert.equal(filas[0].monto, 30000);
  assert.equal(filas[0].proxima_factura, '2026-09-15');
  assert.equal(filas[0].tipo, 'parcialidad');
});

t('las de meses futuros NO entran: no se cobra en septiembre lo de noviembre', () => {
  const { filas } = parcialidadesDelMes([cot('q1', 'COT-1', PLAN_RUBENS)], abon('q1', 30000), '2026-09', '2026-09-03');
  assert.ok(filas.every(f => f.proxima_factura.slice(0, 7) === '2026-09'));
});

t('una vencida de un mes anterior se arrastra: el dinero no se pierde al pasar de mes', () => {
  const { filas } = parcialidadesDelMes([cot('q1', 'COT-1', PLAN_RUBENS)], abon('q1', 0), '2026-09', '2026-09-03');
  assert.equal(filas.length, 2, 'el anticipo vencido de agosto + la de septiembre');
  const vencida = filas.find(f => f.vencida)!;
  assert.equal(vencida.mes_original, '2026-08');
  assert.equal(filas.reduce((s, f) => s + f.monto, 0), 60000);
});

t('una exhibición ya pagada no vuelve a cobrarse', () => {
  const { filas } = parcialidadesDelMes([cot('q1', 'COT-1', PLAN_RUBENS)], abon('q1', 60000), '2026-09', '2026-09-30');
  assert.equal(filas.length, 0, 'anticipo y parcialidad 2 cubiertos: septiembre no debe nada');
});

t('conPlan marca la cotización para que NO se cuente además por su total', () => {
  const { conPlan } = parcialidadesDelMes([cot('q1', 'COT-1', PLAN_RUBENS)], abon('q1', 30000), '2026-09', '2026-09-03');
  assert.ok(conPlan.has('q1'), 'sin esto, $150,000 + $30,000 se suman dos veces');
});

t('una cotización sin plan no se marca: entra completa por venta nueva', () => {
  const { filas, conPlan } = parcialidadesDelMes([{ id: 'q2', numero: 'COT-2', notas: '' }], new Map(), '2026-09', '2026-09-03');
  assert.equal(filas.length, 0);
  assert.equal(conPlan.size, 0);
});

console.log(`\n${n} contratos de pagos diferidos ✓\n`);
