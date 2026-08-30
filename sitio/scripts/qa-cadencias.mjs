/**
 * ARNÉS DE PRUEBAS DE CADENCIAS
 *
 * POR QUÉ EXISTE
 * Casi ninguna condición del motor se puede probar leyendo el código ni
 * corriendo el cron en seco. En seco NO se insertan miembros y NO se envía
 * nada, así que un «graduados: 0» sale igual con el arreglo y sin él — ya pasó
 * en esta misma sesión: una prueba en seco dio verde sobre un archivo que
 * nunca se había modificado.
 *
 * Este arnés siembra estados controlados, corre el cron DE VERDAD, afirma el
 * resultado y limpia. Todo lo que crea lleva el prefijo `qa-` y vive en una
 * secuencia desechable: no toca a ningún cliente real ni a ninguna de las ocho
 * cadencias de producción.
 *
 * REGLA DE ORO DE CADA PRUEBA: incluir el CONTRAFACTUAL. Un caso que pasa no
 * prueba nada si el mismo caso pasaría también con la lógica rota.
 *
 *   node scripts/qa-cadencias.mjs            # todo
 *   node scripts/qa-cadencias.mjs entrada    # una etapa
 *   node scripts/qa-cadencias.mjs --dejar    # no limpia (para inspeccionar)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

// `require` no existe en un módulo ESM; el bundle del cron se emite en CJS
// porque es lo único que se puede cargar de un archivo suelto sin package.json.
const require = createRequire(import.meta.url);

const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;

export const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/**
 * ⚠️ EL CANDADO. No lo quites.
 *
 * Una secuencia de prueba ACTIVA recluta a todo contacto real que cumpla su
 * entrada. Pasó: una secuencia qa con la entrada por omisión enroló a 199 leads
 * reales y le mandó un correo a 59 de ellos. El arnés estaba corriendo contra
 * la base de producción y nada lo impedía.
 *
 * Ahora TODA secuencia del arnés lleva un filtro por esta campaña, y TODO
 * contacto del arnés la trae puesta. Ningún contacto real la tiene, así que
 * ninguno puede entrar — el candado es de datos, no de disciplina.
 *
 * Y por si alguien crea una secuencia sin pasar por `secuencia()`, `cron()`
 * verifica después de cada corrida que no haya entrado nadie de fuera, apaga
 * todo y truena.
 */
export const MARCA = 'qa-arnes-cadencias';
const FILTRO_MARCA = { campo: 'campana', op: 'es', valor: MARCA };

/* El cron se compila una vez y se reusa. `import.meta.env` → process.env para
   que las variables lleguen igual que en Vercel. */
let _cron = null;
export async function cron({ dry = false } = {}) {
  if (!_cron) {
    const out = '/tmp/claude-1000/-opt-sacs/qa-cron.cjs';
    await build({ entryPoints: ['src/pages/api/cron/leads-cadencia.ts'], bundle: true, platform: 'node',
      format: 'cjs', outfile: out, logLevel: 'silent', define: { 'import.meta.env': 'process.env' } });
    _cron = require(out);
  }
  const r = await _cron.GET({ url: new URL(`http://qa/${dry ? '?dry=1' : ''}`), request: { headers: { get: () => '1' } } });
  const salida = JSON.parse(await r.text());

  /* Red de seguridad: ¿entró alguien que no es del arnés? Se comprueba SIEMPRE,
     no solo cuando algo falla, porque el daño de esto no se nota hasta que un
     cliente contesta un correo que nunca debió recibir. */
  const { data: colados } = await sb.from('crm_secuencia_miembros')
    .select('contact_id, crm_secuencias!inner(nombre), contacts!inner(email, campana)')
    .like('crm_secuencias.nombre', 'qa-%').neq('contacts.campana', MARCA).limit(5);
  if (colados?.length) {
    await sb.from('crm_secuencias').update({ activa: false }).like('nombre', 'qa-%');
    throw new Error(`🚨 ${colados.length}+ contactos REALES entraron a una secuencia del arnés. Todas apagadas. ` +
      `Primero: ${colados.map(x => x.contacts?.email).join(', ')}`);
  }
  return salida;
}

// ── Afirmaciones ─────────────────────────────────────────────────────────────
let _ok = 0, _mal = 0; const _fallos = [];
export function check(nombre, real, esperado) {
  const igual = JSON.stringify(real) === JSON.stringify(esperado);
  if (igual) { _ok++; console.log(`    ✓ ${nombre}`); }
  else { _mal++; _fallos.push(nombre); console.log(`    ✗ ${nombre}\n        esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)}`); }
  return igual;
}
export function resumen() {
  console.log(`\n  ${_ok} pasan · ${_mal} fallan`);
  if (_mal) console.log('  fallaron: ' + _fallos.join(' · '));
  return _mal === 0;
}

// ── Siembra y limpieza ───────────────────────────────────────────────────────
const CREADOS = { contacts: [], companies: [], secuencias: [], campanas: [], subs: [] };

/** Una empresa desechable. */
export async function empresa(campos = {}) {
  const id = randomUUID();
  await sb.from('companies').insert({ id, nombre: `qa-${id.slice(0, 8)}`, estado_cuenta: 'prospecto', ...campos });
  CREADOS.companies.push(id);
  return id;
}

/** Un contacto desechable. Siempre con correo y WhatsApp de prueba. */
export async function contacto(campos = {}) {
  const id = randomUUID();
  const { error } = await sb.from('contacts').insert({
    id, nombre: 'QA', apellido: id.slice(0, 6), email: `qa-${id.slice(0, 8)}@example.invalid`,
    whatsapp: null, tipo: 'lead', lifecycle_stage: 'lead', estatus_lead: 'contactado',
    ...campos,
    campana: MARCA,   // el candado: va DESPUÉS del spread para que nadie lo pise
  });
  if (error) throw new Error('sembrando contacto: ' + error.message);
  CREADOS.contacts.push(id);
  return id;
}

/** Una secuencia desechable, activa por omisión. */
export async function secuencia(campos = {}, pasos = []) {
  const id = randomUUID();
  /* El filtro de la marca se AÑADE a los que traiga el caso, y con lógica AND.
     Si el caso pide lógica OR, el candado se rompería —bastaría cumplir la otra
     condición— así que en ese caso se rechaza el montaje en vez de correr con
     una secuencia que puede reclutar gente real. */
  const entradaBase = campos.entrada || { estatus: ['nuevo', 'contactado', 'sin_respuesta'], lifecycle: ['lead'] };
  if (entradaBase.logica === 'OR') throw new Error('El arnés no admite lógica OR: rompería el candado de la campaña.');
  const entrada = { ...entradaBase, filtros: [...(entradaBase.filtros || []), FILTRO_MARCA], logica: 'AND' };

  const { error } = await sb.from('crm_secuencias').insert({
    id, nombre: `qa-${id.slice(0, 8)}`, activa: true, corte_dias: 3650, objetivo: 'respondio',
    hora_inicio: 0, hora_fin: 24, dias_envio: [1, 2, 3, 4, 5, 6, 7],
    ...campos, entrada,
  });
  if (error) throw new Error('sembrando secuencia: ' + error.message);
  CREADOS.secuencias.push(id);
  if (pasos.length) {
    const { error: e2 } = await sb.from('crm_secuencia_pasos')
      .insert(pasos.map((p, i) => ({ secuencia_id: id, orden: (i + 1) * 10, activo: true, ...p })));
    if (e2) throw new Error('sembrando pasos: ' + e2.message);
  }
  return id;
}

/** Una campaña in-app gobernada por secuencia. */
export async function campanaInapp(secuenciaId, campos = {}) {
  const id = randomUUID();
  await sb.from('inapp_campanas').insert({
    id, nombre: `qa-${id.slice(0, 8)}`, estado: 'activa', formato: 'tarjeta_inicio', canal: 'web',
    prioridad: 'normal', modo: 'continua', contenido: { titulo: 'QA', mensaje: 'Prueba.', botones: [] },
    comportamiento: {}, audiencia: { grupos: [], incluir_cuentas: [], solo_manual: true },
    nivel: { tipo: 'todos' }, origen_secuencia: secuenciaId, objetivo_texto: 'QA', ...campos,
  });
  CREADOS.campanas.push(id);
  return id;
}

export async function suscripcion(companyId, campos = {}) {
  const id = randomUUID();
  await sb.from('subscriptions').insert({ id, company_id: companyId, nombre_plan: 'QA', ciclo: 'anual', estado: 'activa', ...campos });
  CREADOS.subs.push(id);
  return id;
}

/** Estado de un contacto dentro de una secuencia. */
export async function miembro(secuenciaId, contactId) {
  const { data } = await sb.from('crm_secuencia_miembros')
    .select('inicio, enviados, detenida_at, motivo').eq('secuencia_id', secuenciaId).eq('contact_id', contactId).maybeSingle();
  return data;
}

/** Qué se le envió, por canal. */
export async function envios(contactId) {
  const { data } = await sb.from('activities').select('tipo, titulo, metadata')
    .eq('contact_id', contactId).eq('tipo', 'secuencia_envio');
  return (data || []).map(a => a.metadata?.canal).sort();
}

export async function limpiar() {
  // El orden importa: los miembros y pasos cuelgan de la secuencia con cascade,
  // pero las actividades y suscripciones cuelgan del contacto y de la empresa.
  for (const id of CREADOS.subs) await sb.from('subscriptions').delete().eq('id', id);
  for (const id of CREADOS.secuencias) await sb.from('crm_secuencias').delete().eq('id', id);
  for (const id of CREADOS.campanas) await sb.from('inapp_campanas').delete().eq('id', id);
  for (const id of CREADOS.contacts) {
    await sb.from('activities').delete().eq('contact_id', id);
    await sb.from('crm_secuencia_miembros').delete().eq('contact_id', id);
    await sb.from('contacts').delete().eq('id', id);
  }
  for (const id of CREADOS.companies) await sb.from('companies').delete().eq('id', id);
  const n = Object.values(CREADOS).reduce((a, x) => a + x.length, 0);
  for (const k of Object.keys(CREADOS)) CREADOS[k] = [];
  return n;
}
