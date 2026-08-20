// OUTBOUND · Motor: audiencia → cuentas, validación, materialización y
// publicación hacia sacs_api (sacs3_global.campanas_inapp).
//
// La audiencia se resuelve en JS sobre las companies con cuenta SACS (son
// centenas, no millones) — mismo trade-off documentado en email/segmentos.ts:
// cero superficie de inyección y un solo lugar donde se leen los jsonb del
// puente (uso_sacs / actividad / intereses), que PostgREST no filtra bien.
import crypto from 'node:crypto';
import { supabase } from '../supabase';
import { cuentasPorEmpresa, normCuenta } from '../crm/sacs-cuentas';
import { urlSacsValida, DESTINOS_MODULO, ACCIONES_BOTON, FORMATOS, MODULOS_PUENTE, slugAgendaValido, type AudienciaDef, type CondicionUso } from './catalogo';

const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = (import.meta.env.CRM_SYNC_SECRET || '').trim();

/**
 * Réplica EXACTA de enHoldout de sacs_api/modules/campanasInapp.js.
 * md5('<campana_id>:<uid>') → primeros 8 hex → mod 100 < pct.
 * El sorteo es inmutable durante la vida de la campaña: así el brazo de
 * control sobrevive las re-materializaciones diarias del modo continuo.
 */
export function enHoldout(campanaId: string, uid: string, pct: number): boolean {
  const p = Number(pct) || 0;
  if (p <= 0) return false;
  const h = crypto.createHash('md5').update(`${campanaId}:${uid}`).digest('hex');
  return (parseInt(h.slice(0, 8), 16) % 100) < p;
}

// ── Resolución de audiencia ──────────────────────────────────────────────────

interface EmpresaEval {
  id: string;
  nombre: string;
  plan: string | null;
  estado_cuenta: string | null;
  dias_sin_venta: number | null;
  giro: string | null;
  months_active: number | null;
  fecha_renovacion: string | null;
  sacs_account: string | null;
  uso_sacs: any;
  intereses: any;
}

function cumpleCondicion(e: EmpresaEval, c: CondicionUso): boolean {
  const num = (x: any) => (x == null || x === '' ? null : Number(x));
  switch (c.campo) {
    case 'plan': return c.operador === 'no_es' ? e.plan !== c.valor : e.plan === c.valor;
    case 'estado_cuenta': return c.operador === 'no_es' ? e.estado_cuenta !== c.valor : e.estado_cuenta === c.valor;
    case 'giro': return (e.giro || '').toLowerCase() === String(c.valor || '').toLowerCase();
    case 'dias_sin_venta': {
      const v = num(e.dias_sin_venta); if (v == null) return false;
      return c.operador === 'mayor_que' ? v > Number(c.valor) : v < Number(c.valor);
    }
    case 'meses_activo': {
      const v = num(e.months_active); if (v == null) return false;
      return c.operador === 'mayor_que' ? v > Number(c.valor) : v < Number(c.valor);
    }
    case 'renovacion_proxima_dias': {
      if (!e.fecha_renovacion) return false;
      const dias = (new Date(e.fecha_renovacion).getTime() - Date.now()) / 86400000;
      return dias >= 0 && dias < Number(c.valor);
    }
    case 'tiene_plugin': {
      // uso_sacs.plugins = ['torre-evento','reglas-catalogo',...] — lo reporta
      // el puente desde info/config.plugins (Ola 2, W1).
      const pls: any[] = (e.uso_sacs && Array.isArray(e.uso_sacs.plugins)) ? e.uso_sacs.plugins : [];
      const tiene = pls.indexOf(String(c.valor || '').trim()) !== -1;
      return c.operador === 'no_es' ? !tiene : tiene;
    }
    case 'usa_modulo': {
      // uso_sacs.modulos = [{ modulo, usa, ... }] — nombres EXACTOS del puente.
      const mods: any[] = (e.uso_sacs && Array.isArray(e.uso_sacs.modulos)) ? e.uso_sacs.modulos : [];
      const usa = mods.some(m => m && m.modulo === c.valor && m.usa);
      return c.operador === 'no_es' ? !usa : usa;
    }
    case 'interes_modulo': {
      const i = e.intereses && e.intereses[String(c.valor)];
      return !!(i && (i.score || 0) > 0);
    }
    default: return false; // campo fuera de catálogo: no acota → no cumple
  }
}

export interface AudienciaResuelta {
  companies: Array<{ id: string; nombre: string; cuentas: string[] }>;
  cuentas: string[];
  exclusiones: { sin_cuenta: number; excluidas_manual: number };
}

/** Empresas (con sus cuentas SACS) que cumplen la definición HOY. */
export async function resolverAudiencia(def: AudienciaDef): Promise<AudienciaResuelta> {
  const { data, error } = await supabase.from('companies')
    .select('id, nombre, plan, estado_cuenta, dias_sin_venta, giro, months_active, fecha_renovacion, sacs_account, uso_sacs, intereses')
    .is('archived_at', null)
    .limit(5000);
  if (error) throw new Error('No se pudieron leer las empresas: ' + error.message);

  const grupos = (def && Array.isArray(def.grupos)) ? def.grupos.filter(g => g && Array.isArray(g.condiciones) && g.condiciones.length) : [];
  const todasSinCondicion = grupos.length === 0;

  const candidatas = (data || []).filter((e: any) =>
    todasSinCondicion || grupos.some(g => g.condiciones.every(c => cumpleCondicion(e as EmpresaEval, c)))
  );

  const mapa = await cuentasPorEmpresa(candidatas.map((e: any) => e.id));
  const excluir = new Set((def?.excluir_cuentas || []).map(normCuenta));
  const incluirExtra = (def?.incluir_cuentas || []).map(normCuenta).filter(Boolean);

  let sinCuenta = 0, excluidas = 0;
  const companies: AudienciaResuelta['companies'] = [];
  const cuentasSet = new Set<string>();
  for (const e of candidatas) {
    const cs = (mapa[e.id] && mapa[e.id].length) ? mapa[e.id] : (normCuenta(e.sacs_account) ? [normCuenta(e.sacs_account)] : []);
    const vivas = cs.filter(c => { if (excluir.has(c)) { excluidas++; return false; } return true; });
    if (!vivas.length) { sinCuenta++; continue; }
    companies.push({ id: e.id, nombre: e.nombre, cuentas: vivas });
    vivas.forEach(c => cuentasSet.add(c));
  }
  for (const c of incluirExtra) cuentasSet.add(c);

  return { companies, cuentas: Array.from(cuentasSet), exclusiones: { sin_cuenta: sinCuenta, excluidas_manual: excluidas } };
}

// ── Validación (los checks del paso Revisión) ────────────────────────────────

export function validarCampana(c: any): string[] {
  const errores: string[] = [];
  if (!c.nombre || !String(c.nombre).trim()) errores.push('Falta el nombre de la campaña.');
  if (!FORMATOS.some(f => f.id === c.formato)) errores.push('Formato desconocido.');
  const ct = c.contenido || {};
  if (c.formato !== 'chat' && c.formato !== 'badge_menu' && !String(ct.titulo || '').trim()) {
    errores.push('Falta el título del mensaje.');
  }
  const botones = Array.isArray(ct.botones) ? ct.botones : [];
  if (botones.length > 2) errores.push('Máximo 2 botones.');
  for (const b of botones) {
    if (!String(b.texto || '').trim()) errores.push('Un botón no tiene texto.');
    if (!ACCIONES_BOTON.some(a => a.id === b.accion)) { errores.push(`Acción de botón fuera de catálogo: "${b.accion}".`); continue; }
    if (b.accion === 'modulo' && !DESTINOS_MODULO.some(d => d.id === b.destino)) {
      errores.push(`El destino "${b.destino}" no está en el catálogo de módulos.`);
    }
    if (b.accion === 'url_sacs' && !urlSacsValida(b.destino)) {
      errores.push('Las URLs de botón solo pueden ser https de sacscloud.com.');
    }
  }
  if (ct.imagen && !urlSacsValida(ct.imagen)) errores.push('La imagen debe estar hospedada en sacscloud.com.');
  if (ct.video && !urlSacsValida(ct.video)) errores.push('El video debe ser una URL https de sacscloud.com (sube el mp4 a code.sacscloud.com; YouTube directo no está permitido).');
  // Sin emoji decorativo (estándar enterprise de sacs3). El ⚠️ de riesgo real se tolera.
  const texto = `${ct.titulo || ''} ${ct.mensaje || ''}`;
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/u.test(texto.replace(/⚠/gu, ''))) {
    errores.push('El contenido lleva emojis decorativos; el estándar de SACS es tipografía limpia.');
  }
  if (c.formato === 'agenda') {
    if (!slugAgendaValido(ct.agenda_slug)) {
      errores.push('El formato "Agendar cita" necesita un tipo de reunión del catálogo (slug inválido o vacío).');
    }
  }
  const comp = c.comportamiento || {};
  if (comp.bloqueante && botones.length === 0) {
    errores.push('Un modal bloqueante necesita al menos un botón: sin él, el usuario queda atrapado sin forma de cerrar.');
  }
  if (comp.bloqueante && !c.bloqueante_aprobada_por) {
    errores.push('Un modal bloqueante necesita aprobación aparte antes de activarse.');
  }
  if (comp.bloqueante && c.formato !== 'modal') errores.push('Solo un modal puede ser bloqueante.');
  if (c.meta && c.meta.tipo === 'uso_modulo' && !MODULOS_PUENTE.includes(c.meta.valor)) {
    errores.push(`La meta apunta a un módulo que el puente no reporta: "${c.meta.valor}".`);
  }
  return errores;
}

// ── Materialización + publicación ────────────────────────────────────────────

/** Doc que viaja a sacs3_global.campanas_inapp (lo que sacs_api sirve tal cual). */
export function docParaSacs(c: any, cuentas: string[]) {
  const nivel = c.nivel || { tipo: 'todos' };
  return {
    campana_id: c.id,
    nombre: c.nombre,
    estado: 'activa',
    formato: c.formato,
    canal: c.canal || 'web',
    prioridad: c.prioridad || 'normal',
    holdout_pct: c.holdout_pct ?? 0,
    variante: c.variante || null,
    guardar_campana: !!c.guardar_campana,
    vigencia: {
      desde: c.vigencia_desde ? new Date(c.vigencia_desde).toISOString() : null,
      hasta: c.vigencia_hasta ? new Date(c.vigencia_hasta).toISOString() : null,
    },
    contenido: c.contenido || {},
    comportamiento: c.comportamiento || {},
    objetivo: {
      cuentas,
      grupos: nivel.tipo === 'grupos' ? (nivel.grupos || []) : null,
      uids: nivel.tipo === 'uids' ? (nivel.uids || []) : null,
    },
  };
}

async function llamarSacs(ruta: string, body: any): Promise<any> {
  const r = await fetch(SACS_API + ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`sacs_api ${ruta} respondió ${r.status}`);
  return r.json();
}

/**
 * Publica (o re-publica) una campaña ACTIVA hacia sacs_api.
 * opts.congelada: usa la lista de cuentas ya materializada (modo 'unica' tras
 *   la activación: editar el título NO debe mover la audiencia).
 * opts.reactivar: levanta deliberadamente la pausa del circuit breaker en
 *   sacs_api (solo activar/reanudar; una republicación de rutina jamás).
 */
export async function publicarCampana(c: any, opts: { congelada?: boolean; reactivar?: boolean } = {}): Promise<{ cuentas: number }> {
  const congeladas: string[] = (opts.congelada && Array.isArray(c.materializada?.cuentas_lista)) ? c.materializada.cuentas_lista : [];
  if (opts.congelada && !congeladas.length) {
    // Degradar en silencio a una resolución fresca movería la audiencia de un
    // modo "una sola vez" — exactamente lo que la congelación promete no hacer.
    throw new Error('Esta campaña no tiene su audiencia congelada guardada (se activó con una versión vieja). Pásala a borrador y actívala de nuevo para congelarla.');
  }
  const res = congeladas.length
    ? { cuentas: congeladas, companies: [], exclusiones: c.materializada?.exclusiones || {} } as any
    : await resolverAudiencia((c.audiencia || {}) as AudienciaDef);
  if (!res.cuentas.length) throw new Error('La audiencia resuelve a 0 cuentas — no hay a quién publicar.');
  const doc: any = docParaSacs(c, res.cuentas);
  if (opts.reactivar) doc.reactivar = true;
  await llamarSacs('/interno/crm/campanas-publicar', { campanas: [doc] });
  await supabase.from('inapp_campanas').update({
    publicada_at: new Date().toISOString(),
    materializada: {
      cuentas: res.cuentas.length,
      companies: congeladas.length ? (c.materializada?.companies || 0) : res.companies.length,
      exclusiones: res.exclusiones,
      // La lista completa se guarda para que el cron evalúe la meta también en
      // las cuentas que NUNCA vieron la campaña (view-through y brazo control).
      cuentas_lista: res.cuentas,
      at: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  }).eq('id', c.id);
  return { cuentas: res.cuentas.length };
}

/** Retira una campaña de la entrega (pausa/término/archivo).
 *  Elimina también su copia efímera de prueba (`<id>-prueba`): sin esto, cada
 *  "Enviar prueba" dejaba un doc activo permanente apuntando a pruebasmongo. */
export async function despublicarCampana(id: string): Promise<void> {
  await llamarSacs('/interno/crm/campanas-publicar', { campanas: [], eliminar: [id, `${id}-prueba`] });
}

/**
 * Lee TODAS las filas paginando de 1000 en 1000. PostgREST tiene max_rows=1000
 * EN ESTE PROYECTO (verificado en la config viva): cualquier .limit() mayor se
 * capa en silencio y las métricas subcuentan. `build` recibe (from,to) y debe
 * devolver la query CON .order() determinista y .range(from,to).
 */
export async function leerPaginado(build: (from: number, to: number) => any, tope = 200000): Promise<any[]> {
  const out: any[] = [];
  for (let off = 0; off < tope; off += 1000) {
    const { data, error } = await build(off, off + 999);
    if (error) throw new Error(error.message);
    const filas = data || [];
    out.push(...filas);
    if (filas.length < 1000) break;
  }
  return out;
}

export async function auditar(campanaId: string | null, accion: string, quien: string | null, detalle?: any) {
  await supabase.from('inapp_auditoria').insert({ campana_id: campanaId, accion, quien, detalle: detalle || null });
}
