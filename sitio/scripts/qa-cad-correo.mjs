/** ETAPA 5 · Canal correo: plantillas, variables y contexto. */
import { contacto, empresa, secuencia, suscripcion, cron, miembro, check, resumen, limpiar, soloEsta, sb } from './qa-cadencias.mjs';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cargar = async (ent, out) => { await build({ entryPoints: [ent], bundle: true, platform: 'node', format: 'cjs', outfile: out, logLevel: 'silent', define: { 'import.meta.env': 'process.env' } }); return require(out); };
const { compilar, compilarTexto, interpolar } = await cargar('src/lib/email/plantillas.ts', '/tmp/claude-1000/-opt-sacs/qa-pl.cjs');
const { ctxRenovacion, ctxPlanSiguiente, tramoPara } = await cargar('src/lib/crm/renovacion.ts', '/tmp/claude-1000/-opt-sacs/qa-ren.cjs');
const T = { nombre: 'Sacs', color_acento: '#4B7BE5', sitio: 'https://www.sacscloud.com' };
const hace = d => new Date(Date.now() - d * 864e5).toISOString();
const enviados = async (s, c) => Object.keys((await miembro(s, c))?.enviados || {}).length;

console.log('  ── a) TODAS las plantillas de las 8 cadencias compilan limpias ──');
{
  /* El join !inner de PostgREST necesita FK declarada; si falta, devuelve error
     y `data` sale null — el mismo modo de falla que dejó muertas las secuencias.
     Se traen los ids y luego las plantillas, que no depende de ninguna FK. */
  const { data: ps, error: e1 } = await sb.from('crm_secuencia_pasos')
    .select('email_template_id').eq('canal', 'correo').eq('activo', true);
  if (e1) throw new Error('leyendo pasos: ' + e1.message);
  const ids = [...new Set(ps.map(x => x.email_template_id).filter(Boolean))];
  const { data: tpls, error: e2 } = await sb.from('email_templates')
    .select('nombre, asunto, preview_text, bloques').in('id', ids);
  if (e2) throw new Error('leyendo plantillas: ' + e2.message);
  const data = tpls.map(t => ({ email_templates: t }));
  const ctx = { nombre: 'Ana', empresa: 'Boutique Lume', fecha_renovacion: '1 de enero', monto_renovacion: '$9,900',
    monto_10: '$8,910', monto_5: '$9,405', ahorro_10: '$990', ahorro_5: '$495', limite_10: '1 de diciembre',
    limite_5: '17 de diciembre', plan: 'Controla', plan_actual: 'Controla', plan_siguiente: 'Fideliza',
    punto_1: 'uno', punto_2: 'dos', punto_3: 'tres', descuento_pct: '10' };
  let malas = [], sinCta = 0;
  for (const p of data) {
    const t = p.email_templates;
    const html = compilar(t.bloques, ctx, T, t.preview_text);
    const txt = compilarTexto(t.bloques, ctx);
    const asunto = interpolar(t.asunto, ctx);
    const problemas = [];
    if ((html.match(/\{\{/g) || []).length) problemas.push('variable sin resolver');
    if (/\*\*/.test(html) || /\*\*/.test(txt)) problemas.push('asteriscos');
    if (/\{\{/.test(asunto)) problemas.push('asunto sin resolver');
    if (Buffer.byteLength(html) > 102 * 1024) problemas.push('pesa más de 102 KB (Gmail recorta)');
    if (problemas.length) malas.push(`${t.nombre}: ${problemas.join(', ')}`);
  }
  check(`las ${data.length} plantillas de correo compilan limpias`, malas, []);
}

console.log('  ── b) el contexto de renovación ──');
{
  check('a 95 días → 10%', tramoPara(95), 10);
  check('a 30 días → 10% (el límite entra)', tramoPara(30), 10);
  check('a 29 días → 5%', tramoPara(29), 5);
  check('a 14 días → 0%', tramoPara(14), 0);
  const co = await empresa();
  await suscripcion(co, { ciclo: 'anual', estado: 'activa', monto_proximo: 10000, proxima_factura: new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10) });
  const r = await ctxRenovacion(co);
  check('el monto se formatea', r.monto_renovacion, '$10,000');
  check('el 10% calcula bien', r.monto_10, '$9,000');
  check('y su ahorro', r.ahorro_10, '$1,000');
  const co2 = await empresa();
  await suscripcion(co2, { ciclo: 'anual', estado: 'activa', monto_proximo: 10000, proxima_factura: null });
  check('sin fecha de próxima factura → null (no se manda con huecos)', await ctxRenovacion(co2), null);
}

console.log('  ── c) la escalera de planes ──');
{
  const co = await empresa({ plan: 'controla' });
  const r = await ctxPlanSiguiente(co);
  check('controla sube a Fideliza', r?.plan_siguiente, 'Fideliza');
  check('y trae sus tres puntos', [r?.punto_1, r?.punto_2, r?.punto_3].filter(Boolean).length, 3);
  const co2 = await empresa({ plan: 'automatiza' });
  check('el tope de la escalera → null (no se le ofrece subir)', await ctxPlanSiguiente(co2), null);
  const co3 = await empresa({ plan: null });
  check('sin plan → null', await ctxPlanSiguiente(co3), null);
}

console.log('  ── d) sin datos de renovación el paso se salta ──');
{
  const { data: pl } = await sb.from('email_templates').select('id').eq('nombre', 'Renovación 5 · Renueva antes y te ahorras {{ahorro_10|un 10%}}').maybeSingle();
  const co = await empresa();
  await suscripcion(co, { ciclo: 'anual', estado: 'activa', monto_proximo: 8000, proxima_factura: new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10) });
  /* `para_clientes` es obligatorio en una cadencia de renovación: todos sus
     miembros tienen una suscripción anual ACTIVA —por eso están ahí— y sin la
     bandera la salida por `pago_licencia` los expulsa a todos el primer día.
     La cadencia real la trae; esta prueba se olvidó de ponerla y se
     autodestruyó, que es exactamente lo que la bandera evita. */
  const s = await secuencia({ entrada: { estatus: ['nuevo','contactado','sin_respuesta'], lifecycle: ['lead'], ancla: 'renovacion', para_clientes: true } },
    [{ dia: 51, canal: 'correo', email_template_id: pl.id }]);
  await soloEsta(s);
  const con = await contacto({ company_id: co });
  const coSin = await empresa();
  const sin = await contacto({ company_id: coSin });
  await cron(); await cron();
  check('con datos de renovación → recibe', await enviados(s, con), 1);
  check('sin suscripción → no entra (no hay fecha de ancla)', await miembro(s, sin), null);
}

console.log('  ── d2) sin para_clientes, una cadencia de renovación se autodestruye ──');
{
  const { data: pl } = await sb.from('email_templates').select('id').eq('activo', true).limit(1).single();
  const co = await empresa();
  await suscripcion(co, { ciclo: 'anual', estado: 'activa', monto_proximo: 8000, proxima_factura: new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10) });
  const s = await secuencia({ entrada: { estatus: ['nuevo','contactado','sin_respuesta'], lifecycle: ['lead'], ancla: 'renovacion' } },
    [{ dia: 51, canal: 'correo', email_template_id: pl.id }]);
  await soloEsta(s);
  const c = await contacto({ company_id: co });
  await cron(); await cron();
  check('SIN la bandera sale por pago_licencia el primer día', (await miembro(s, c))?.motivo, 'pago_licencia');
}

console.log('  ── e) sin correo en la ficha, el paso se salta ──');
{
  const { data: pl } = await sb.from('email_templates').select('id').eq('activo', true).limit(1).single();
  const s = await secuencia({}, [{ dia: 1, canal: 'correo', email_template_id: pl.id }]);
  await soloEsta(s);
  const c = await contacto({ email: null });
  await cron(); await cron();
  check('sin correo no se le manda', await enviados(s, c), 0);
  check('pero sigue dentro de la cadencia', (await miembro(s, c))?.motivo ?? null, null);
}

console.log(`\n  limpiando…`); await limpiar();
process.exit(resumen() ? 0 : 1);
