/** ETAPAS 6 y 7 · WhatsApp y dentro de Sacs. */
import { contacto, empresa, secuencia, campanaInapp, cron, miembro, envios, check, resumen, limpiar, soloEsta, sb, HAY_PUENTE } from './qa-cadencias.mjs';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cargar = async (e, o) => { await build({ entryPoints: [e], bundle: true, platform: 'node', format: 'cjs', outfile: o, logLevel: 'silent', define: { 'import.meta.env': 'process.env' } }); return require(o); };
const { intencionDe } = await cargar('src/lib/whatsapp/intencion.ts', '/tmp/claude-1000/-opt-sacs/qa-int.cjs');
const { resolverAudiencia } = await cargar('src/lib/outbound/motor.ts', '/tmp/claude-1000/-opt-sacs/qa-mot.cjs');
const { entregarInapp, retirarInapp } = await cargar('src/lib/crm/secuencia-inapp.ts', '/tmp/claude-1000/-opt-sacs/qa-ia.cjs');
const enviados = async (s, c) => Object.keys((await miembro(s, c))?.enviados || {}).length;

console.log('  ══ ETAPA 6 · WhatsApp ══');
console.log('  ── a) ningún paso apunta a una plantilla sin aprobar ──');
{
  const { data: ps } = await sb.from('crm_secuencia_pasos').select('wa_plantilla').eq('canal', 'wa').eq('activo', true);
  const nombres = [...new Set(ps.map(x => x.wa_plantilla).filter(Boolean))];
  const { data: tp } = await sb.from('wa_plantillas').select('nombre, status').in('nombre', nombres);
  const malas = nombres.filter(n => (tp.find(t => t.nombre === n)?.status) !== 'APPROVED');
  check(`las ${nombres.length} plantillas usadas están APPROVED`, malas, []);
}

console.log('  ── b) sin teléfono el paso se salta, sin sacarlo ──');
{
  const { data: apr } = await sb.from('wa_plantillas').select('nombre').eq('status', 'APPROVED').limit(1).single();
  const s = await secuencia({}, [{ dia: 1, canal: 'wa', wa_plantilla: apr.nombre }]);
  await soloEsta(s);
  const c = await contacto({ whatsapp: null });
  await cron(); await cron();
  check('sin teléfono no se le manda', await enviados(s, c), 0);
  check('pero sigue dentro', (await miembro(s, c))?.motivo ?? null, null);
}

console.log('  ── c) wa_optout excluye desde la consulta de candidatos ──');
{
  const { data: apr } = await sb.from('wa_plantillas').select('nombre').eq('status', 'APPROVED').limit(1).single();
  const s = await secuencia({}, [{ dia: 1, canal: 'wa', wa_plantilla: apr.nombre }]);
  await soloEsta(s);
  const c = await contacto({ wa_optout: true });
  await cron();
  check('quien pidió no recibir WhatsApp ni entra', await miembro(s, c), null);
}

console.log('  ── d) las intenciones reconocen el CTA aunque lo editen ──');
{
  const casos = [
    ['Hola, quiero platicar con un consultor antes de mi renovacion', 'renovacion-consultor'],
    ['Hola, quiero renovar aprovechando el descuento por anticipacion', 'renovacion-descuento'],
    ['Hola, quiero ver que mas puede hacer Sacs por mi operacion. Urge', null],
    ['hola quiero platicar con un consultor antes de mi RENOVACION porque cierro sucursal', 'renovacion-consultor'],
    ['buenas', null],
  ];
  const malos = casos.filter(([t, esp]) => (intencionDe(t)?.clave ?? null) !== esp && esp !== null).map(([t]) => t.slice(0, 40));
  check('reconoce los CTA, incluso editados por el cliente', malos, []);
  check('un «buenas» suelto NO se fuerza a ninguna etiqueta', intencionDe('buenas'), null);
}

console.log('\n  ══ ETAPA 7 · dentro de Sacs ══');
console.log('  ── e) solo_manual: la trampa de las 560 cuentas ──');
{
  const vacia = await resolverAudiencia({ grupos: [], incluir_cuentas: [], solo_manual: true });
  const una = await resolverAudiencia({ grupos: [], incluir_cuentas: ['cuentademonueva'], solo_manual: true });
  const sinBandera = await resolverAudiencia({ grupos: [], incluir_cuentas: ['cuentademonueva'] });
  check('solo_manual + lista vacía → 0 cuentas', vacia.cuentas.length, 0);
  check('solo_manual + 1 cuenta → 1', una.cuentas.length, 1);
  check('SIN la bandera, la misma definición resuelve a toda la base', sinBandera.cuentas.length > 100, true);
}

if (!HAY_PUENTE) { console.log('    ⚠ sin CRM_SYNC_SECRET: se saltan las pruebas de entrega in-app'); }
else {
  console.log('  ── f) entrega, idempotencia y baja ──');
  const s = await secuencia({}, []);
  const camp = await campanaInapp(s);
  const r1 = await entregarInapp(camp, 'cuentademonueva');
  check('primera entrega ok', r1.ok, true);
  const r2 = await entregarInapp(camp, 'cuentademonueva');
  check('segunda dice ya_estaba (no republica de más)', r2.ya_estaba, true);
  await retirarInapp(camp, 'cuentademonueva');
  const { data: cc } = await sb.from('inapp_campanas').select('audiencia').eq('id', camp).single();
  check('la baja deja la audiencia vacía', (cc.audiencia.incluir_cuentas || []).length, 0);

  console.log('  ── g) una campaña de Outbound normal se RECHAZA ──');
  const { data: otra } = await sb.from('inapp_campanas').select('id').is('origen_secuencia', null).limit(1).maybeSingle();
  if (otra) {
    const r3 = await entregarInapp(otra.id, 'cuentademonueva');
    check('rechaza la campaña no gobernada', r3.ok, false);
    check('y dice por qué', /solo_manual/.test(r3.error || ''), true);
  }

  console.log('  ── h) sin cuenta de SACS el paso se salta y NO se marca enviado ──');
  const s2 = await secuencia({}, []);
  const camp2 = await campanaInapp(s2);
  await sb.from('crm_secuencia_pasos').insert({ secuencia_id: s2, orden: 10, dia: 1, canal: 'inapp', inapp_campana_id: camp2, activo: true });
  await soloEsta(s2);
  const c2 = await contacto({ prueba_cuenta: null });
  await cron(); await cron();
  check('sin cuenta no se marca como enviado', await enviados(s2, c2), 0);
  check('y sigue dentro para reintentar', (await miembro(s2, c2))?.motivo ?? null, null);
}

console.log(`\n  limpiando…`); await limpiar();
process.exit(resumen() ? 0 : 1);
