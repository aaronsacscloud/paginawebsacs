/** ETAPA 1 · Entrada y ancla. Cada caso lleva su contrafactual. */
import { contacto, empresa, secuencia, cron, miembro, check, resumen, limpiar, sb } from './qa-cadencias.mjs';
const { data: pl } = await sb.from('email_templates').select('id').eq('activo', true).limit(1).single();
const PASO = [{ dia: 1, canal: 'correo', email_template_id: pl.id }];
const hace = d => new Date(Date.now() - d * 864e5).toISOString();
const dentro = async (s, c) => (await miembro(s, c)) !== null;

console.log('  ── a) filtro por estatus_lead ──');
{
  const s = await secuencia({ entrada: { estatus: ['contactado'], lifecycle: ['lead'] } }, PASO);
  const si = await contacto({ estatus_lead: 'contactado' });
  const no = await contacto({ estatus_lead: 'negociando' });
  await cron();
  check('el estatus que pide la entrada SÍ entra', await dentro(s, si), true);
  check('otro estatus NO entra', await dentro(s, no), false);
}

console.log('  ── b) filtro por lifecycle_stage ──');
{
  const s = await secuencia({ entrada: { estatus: ['contactado'], lifecycle: ['oportunidad'] } }, PASO);
  const si = await contacto({ lifecycle_stage: 'oportunidad' });
  const no = await contacto({ lifecycle_stage: 'lead' });
  await cron();
  check('la etapa que pide la entrada SÍ entra', await dentro(s, si), true);
  check('otra etapa NO entra', await dentro(s, no), false);
}

console.log('  ── c) filtros finos ──');
{
  // El operador es 'mayor', no 'mayor_que'. Escribir el nombre equivocado NO
  // falla: el evaluador tiene `default: return true` y la condición pasa
  // siempre. Por eso el caso del campo inventado va aquí abajo.
  const s = await secuencia({ entrada: { estatus: ['contactado'], lifecycle: ['lead'],
    filtros: [{ campo: 'sucursales', op: 'mayor', valor: 2 }], logica: 'AND' } }, PASO);
  const si = await contacto({ sucursales_interes: 5 });
  const no = await contacto({ sucursales_interes: 1 });
  await cron();
  check('cumple el filtro fino → entra', await dentro(s, si), true);
  check('NO lo cumple → no entra', await dentro(s, no), false);
}

console.log('  ── c2) el filtro real de Crecimiento: sin_actividad ──');
{
  const s = await secuencia({ entrada: { estatus: ['contactado'], lifecycle: ['lead'],
    filtros: [{ campo: 'sin_actividad', op: 'hace_menos', valor: '15' }], logica: 'AND' } }, PASO);
  const activo  = await contacto({ ultima_actividad_venta_at: hace(3) });
  const dormido = await contacto({ ultima_actividad_venta_at: hace(90) });
  await cron();
  check('el que vendió hace 3 días entra', await dentro(s, activo), true);
  check('el dormido de 90 días NO entra', await dentro(s, dormido), false);
}

console.log('  ── c3) un campo inventado pasa a TODOS (por eso avisa) ──');
{
  const s = await secuencia({ entrada: { estatus: ['contactado'], lifecycle: ['lead'],
    filtros: [{ campo: 'dias_sin_venta', op: 'menor_que', valor: 15 }], logica: 'AND' } }, PASO);
  const cualquiera = await contacto({ ultima_actividad_venta_at: hace(365) });
  await cron();
  check('el filtro roto NO filtra: entra hasta el de un año sin vender', await dentro(s, cualquiera), true);
}

console.log('  ── d) el corte descarta al viejo ──');
{
  const s = await secuencia({ corte_dias: 30, entrada: { estatus: ['contactado'], lifecycle: ['lead'], ancla: 'created_at' } }, PASO);
  const nuevo = await contacto({ created_at: hace(5) });
  const viejo = await contacto({ created_at: hace(400) });
  await cron();
  check('dentro del corte entra', await dentro(s, nuevo), true);
  check('pasado el corte NO entra', await dentro(s, viejo), false);
}

console.log('  ── e) sin fecha de ancla NO entra ──');
{
  const s = await secuencia({ entrada: { estatus: ['contactado'], lifecycle: ['lead'], ancla: 'prueba_inicio' } }, PASO);
  const con = await contacto({ prueba_inicio: hace(2) });
  const sin = await contacto({ prueba_inicio: null });
  await cron();
  check('con la fecha del ancla entra', await dentro(s, con), true);
  check('SIN la fecha del ancla no entra (no se le manda el día 1 en su día 9)', await dentro(s, sin), false);
}

console.log('  ── f) el que ya está dentro no se re-enrola ──');
{
  const s = await secuencia({}, PASO);
  const c = await contacto();
  await cron();
  const m1 = await miembro(s, c);
  await cron();
  const m2 = await miembro(s, c);
  check('la fecha de inicio no se reescribe', m1.inicio, m2.inicio);
  const { count } = await sb.from('crm_secuencia_miembros')
    .select('id', { count: 'exact', head: true }).eq('secuencia_id', s).eq('contact_id', c);
  check('hay exactamente UN miembro', count, 1);
}

console.log('  ── g) el que salió hace poco no vuelve a entrar ──');
{
  const s = await secuencia({}, PASO);
  const c = await contacto();
  await cron();
  await sb.from('crm_secuencia_miembros').update({ detenida_at: hace(5), motivo: 'corte' })
    .eq('secuencia_id', s).eq('contact_id', c);
  await cron();
  const m = await miembro(s, c);
  // Un contacto recién creado tiene su ancla FRESCA, y eso cuenta como
  // «levantó la mano»: vuelve a entrar aunque salió hace 5 días. Para probar
  // la regla de los 90 hay que envejecer también el ancla.
  check('salió hace 5 días pero su ancla es fresca → vuelve (levantó la mano)', m.detenida_at ?? null, null);
  await sb.from('contacts').update({ created_at: hace(200), estatus_lead_at: hace(200) }).eq('id', c);
  await sb.from('crm_secuencia_miembros').update({ detenida_at: hace(5), motivo: 'corte' }).eq('secuencia_id', s).eq('contact_id', c);
  await cron();
  check('sin señal nueva y salió hace 5 días → sigue fuera', (await miembro(s, c)).detenida_at !== null, true);
  await sb.from('crm_secuencia_miembros').update({ detenida_at: hace(120) })
    .eq('secuencia_id', s).eq('contact_id', c);
  await cron();
  check('salió hace 120 días → puede volver', (await miembro(s, c))?.detenida_at ?? null, null);
}

console.log(`\n  limpiando…`); await limpiar();
process.exit(resumen() ? 0 : 1);
