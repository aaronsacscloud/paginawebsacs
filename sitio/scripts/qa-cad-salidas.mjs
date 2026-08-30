/** ETAPA 2 · Las salidas. Cada una con su contrafactual. */
import { contacto, empresa, secuencia, campanaInapp, suscripcion, cron, miembro, check, resumen, limpiar, sb } from './qa-cadencias.mjs';
const { data: pl } = await sb.from('email_templates').select('id').eq('activo', true).limit(1).single();
const PASO = [{ dia: 1, canal: 'correo', email_template_id: pl.id }];
const hace = d => new Date(Date.now() - d * 864e5).toISOString();
const salida = async (s, c) => (await miembro(s, c))?.motivo ?? null;

/** Mete al contacto, luego le cambia algo y vuelve a correr. */
async function tras(campos, secOpts = {}) {
  const s = await secuencia(secOpts, PASO);
  const c = await contacto(campos.antes || {});
  await cron();
  if (campos.despues) await sb.from('contacts').update(campos.despues).eq('id', c);
  if (campos.hook) await campos.hook(c, s);
  await cron();
  return { s, c, motivo: await salida(s, c) };
}

console.log('  ── a) archivado ──');
{
  const r = await tras({ despues: { archived_at: hace(0) } });
  check('archivado → sale', r.motivo, 'archivado');
  const r2 = await tras({});
  check('sin archivar → se queda', r2.motivo, null);
}

console.log('  ── b) descartado, y la lista que lo ignora ──');
{
  const r = await tras({ despues: { estatus_lead: 'descartado' } });
  check('descartado → sale', r.motivo, 'descartado');
  const r2 = await tras({ despues: { estatus_lead: 'descartado' } },
    { entrada: { estatus: ['nuevo','contactado','sin_respuesta','descartado'], lifecycle: ['lead'], ignorar_salidas: ['descartado'] } });
  check('con ignorar_salidas → se queda (el caso del winback)', r2.motivo, null);
}

console.log('  ── c) convertido, y las cadencias de cliente ──');
{
  const r = await tras({ despues: { lifecycle_stage: 'cliente' } });
  check('se volvió cliente en cadencia de lead → sale', r.motivo, 'convertido');
  const r2 = await tras({ despues: { lifecycle_stage: 'cliente' } },
    { entrada: { estatus: ['nuevo','contactado','sin_respuesta'], lifecycle: ['lead','cliente'], para_clientes: true } });
  check('cadencia de cliente → se queda', r2.motivo, null);
}

console.log('  ── d) el corte por días ──');
{
  const s = await secuencia({ corte_dias: 5 }, PASO);
  const c = await contacto();
  await cron();
  await sb.from('crm_secuencia_miembros').update({ inicio: hace(40) }).eq('secuencia_id', s).eq('contact_id', c);
  await cron();
  check('pasado el corte → sale', await salida(s, c), 'corte');
}

console.log('  ── e) pago de licencia anual ──');
{
  const co = await empresa();
  const r = await tras({ antes: { company_id: co }, hook: async () => { await suscripcion(co, { ciclo: 'anual', estado: 'activa' }); } });
  check('anual ACTIVA → sale por pago', r.motivo, 'pago_licencia');
  const co2 = await empresa();
  const r2 = await tras({ antes: { company_id: co2 }, hook: async () => { await suscripcion(co2, { ciclo: 'anual', estado: 'pendiente_pago' }); } });
  check('anual PENDIENTE DE PAGO → NO sale (es a quien hay que empujar)', r2.motivo, null);
  const co3 = await empresa();
  const r3 = await tras({ antes: { company_id: co3 }, hook: async () => { await suscripcion(co3, { ciclo: 'mensual', estado: 'activa' }); } });
  check('mensual activa → NO sale (la salida es del anual)', r3.motivo, null);
}

console.log('  ── f) al salir se baja de las campañas dentro de Sacs ──');
{
  const co = await empresa({ sacs_account: 'cuentademonueva' });
  const s = await secuencia({}, []);
  const camp = await campanaInapp(s);
  await sb.from('crm_secuencia_pasos').insert({ secuencia_id: s, orden: 10, dia: 1, canal: 'inapp', inapp_campana_id: camp, activo: true });
  const c = await contacto({ company_id: co, prueba_cuenta: 'cuentademonueva' });
  // Dos corridas: la primera enrola, la segunda envía. Es el ritmo del motor.
  await cron(); await cron();
  const { data: c1 } = await sb.from('inapp_campanas').select('audiencia').eq('id', camp).single();
  check('entró a la audiencia de la campaña', (c1.audiencia.incluir_cuentas || []).includes('cuentademonueva'), true);
  await sb.from('contacts').update({ estatus_lead: 'descartado' }).eq('id', c);
  await cron();
  check('salió de la cadencia', (await salida(s, c)) !== null, true);
  const { data: c2 } = await sb.from('inapp_campanas').select('audiencia').eq('id', camp).single();
  check('y lo bajaron de la campaña', (c2.audiencia.incluir_cuentas || []).length, 0);
}

console.log(`\n  limpiando…`); await limpiar();
process.exit(resumen() ? 0 : 1);
