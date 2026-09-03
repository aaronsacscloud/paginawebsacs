// ══ REENGANCHE (goal del dueño 2026-09-03) ═══════════════════════════════════════════════════════════════════
// Las conversaciones donde NOSOTROS escribimos al último (un humano, respond.io, el consultor) y el lead calló nunca
// entraban al ciclo del agente: su universo eran solo sus propios envíos. Aquí se enrolan al ciclo de silencio con una
// marca «reenganche», el primer toque se redacta como RETOMAR (no como toque frío) y el plan queda visible en el inbox.
import { supabase } from '../../supabase';
import { ETAPAS_SDR, fueraDelAlcanceSDR } from './agente';

export async function enrolarReenganche(opts: { limite?: number; minHoras?: number } = {}) {
  const limite = opts.limite ?? 500; const minH = opts.minHoras ?? 48;
  const res: any = { candidatas: 0, enroladas: 0, saltadas: { cliente: 0, etapa: 0, silenciado: 0, ya: 0, consultor: 0, cita: 0, optout: 0 } };
  const { data: convs } = await supabase.from('wa_conversaciones')
    .select('id, contact_id, telefono, ultimo_saliente_at, ultimo_mensaje_texto, contacts(id, nombre, lifecycle_stage, archived_at, wa_optout, propiedades)')
    .eq('ultima_direccion', 'saliente').neq('estado_crm', 'resuelta').not('contact_id', 'is', null)
    .lt('ultimo_saliente_at', new Date(Date.now() - minH * 3600e3).toISOString()).order('ultimo_saliente_at', { ascending: false }).limit(limite);
  const vistos = new Set<string>();
  for (const c of convs || []) {
    const k: any = (c as any).contacts; if (!k || vistos.has(k.id)) continue; vistos.add(k.id);
    res.candidatas++;
    if (k.archived_at || k.wa_optout || (k.propiedades as any)?.reactivacion_excluir) { res.saltadas.optout++; continue; }
    if (k.lifecycle_stage === 'cliente') { res.saltadas.cliente++; continue; }
    if (!ETAPAS_SDR.includes(k.lifecycle_stage)) { res.saltadas.etapa++; continue; }
    const { data: pf } = await supabase.from('ti_perfil').select('silenciar_ia, agente_estado').eq('contact_id', k.id).maybeSingle();
    const st: any = (pf as any)?.agente_estado || {};
    if ((pf as any)?.silenciar_ia || st.cerrado === 'opt_out') { res.saltadas.silenciado++; continue; }
    if (st.reenganche || (Array.isArray(st.intentos) && st.intentos.length)) { res.saltadas.ya++; continue; }
    // Si Reactivación ya lo tiene propuesto o programado, no se duplica aquí.
    const { data: rx } = await supabase.from('ti_reactivacion').select('id').eq('contact_id', k.id).in('estado', ['propuesta', 'programada']).limit(1);
    if ((rx || []).length) { res.saltadas.ya++; continue; }
    if (await fueraDelAlcanceSDR(k.id)) { res.saltadas.consultor++; continue; }
    const { data: cita } = await supabase.from('bookings').select('id').eq('contact_id', k.id).in('estado', ['agendada', 'confirmada', 'reagendada']).gte('fecha', new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10)).limit(1);
    if ((cita || []).length) { res.saltadas.cita++; continue; }
    const base = c.ultimo_saliente_at || new Date(Date.now() - minH * 3600e3).toISOString();
    // ¿Alguna vez escribió? Un lead que nunca contestó no es «retomar»: es el primer acercamiento real, y el agente lo debe saber.
    const { count: nIn } = await supabase.from('wa_mensajes').select('id', { count: 'exact', head: true }).eq('conversation_id', c.id).eq('direccion', 'entrante');
    await supabase.from('ti_perfil').upsert({ contact_id: k.id, agente_estado: { ...st, ciclo: st.ciclo || 1, toque: 0, intentos: [], base_at: base, fase: 'reconectar', cerrado: undefined, pausa_hasta: undefined, reenganche: { desde: new Date().toISOString(), conversation_id: c.id, telefono: c.telefono, ultimo_saliente_at: base, ultimo_texto: String(c.ultimo_mensaje_texto || '').slice(0, 300), respondio_alguna_vez: (nIn || 0) > 0 } }, updated_at: new Date().toISOString() }, { onConflict: 'contact_id' });
    await supabase.from('ia_log').insert({ accion: 'reenganche_enrolado', contact_id: k.id, razon: `último mensaje nuestro ${base}`, detalle: { conversation_id: c.id } });
    res.enroladas++;
  }
  return res;
}

/* ── Probabilidad de respuesta por intento, medida en nuestros propios datos ──
   Para cada lead con intentos del agente: ¿escribió en las 72 h siguientes al intento k? Se cachea 10 min. */
let cacheProb: { at: number; tasas: Record<string, { n: number; si: number }> } | null = null;
export async function tasasRespuesta(): Promise<Record<string, { n: number; si: number; pct: number | null }>> {
  if (cacheProb && Date.now() - cacheProb.at < 10 * 60e3) return conPct(cacheProb.tasas);
  const { data: perfs } = await supabase.from('ti_perfil').select('contact_id, agente_estado').not('agente_estado->intentos', 'is', null).order('updated_at', { ascending: false }).limit(400);
  const filas = (perfs || []).filter(p => Array.isArray((p.agente_estado as any)?.intentos) && (p.agente_estado as any).intentos.length);
  const ids = filas.map(p => p.contact_id);
  const { data: evs } = ids.length ? await supabase.from('ti_eventos').select('contact_id, ocurrio_at').eq('tipo', 'wa_entrante').in('contact_id', ids).gte('ocurrio_at', new Date(Date.now() - 120 * 86400e3).toISOString()) : { data: [] as any[] };
  const porC: Record<string, number[]> = {}; for (const e of evs || []) (porC[e.contact_id] ||= []).push(Date.parse(e.ocurrio_at));
  const tasas: Record<string, { n: number; si: number }> = {};
  for (const p of filas) {
    const ints: any[] = (p.agente_estado as any).intentos.filter((i: any) => i.valido !== false);
    ints.forEach((it: any, idx: number) => {
      const k = `${Math.min(idx + 1, 3)}:${it.tipo === 'plantilla' ? 'plantilla' : 'texto'}`; const t0 = Date.parse(it.at);
      const si = (porC[p.contact_id] || []).some(t => t > t0 && t - t0 < 72 * 3600e3);
      const r = tasas[k] || (tasas[k] = { n: 0, si: 0 }); r.n++; if (si) r.si++;
      const kk = `${Math.min(idx + 1, 3)}`; const r2 = tasas[kk] || (tasas[kk] = { n: 0, si: 0 }); r2.n++; if (si) r2.si++;
    });
  }
  cacheProb = { at: Date.now(), tasas };
  return conPct(tasas);
}
const conPct = (t: Record<string, { n: number; si: number }>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { ...v, pct: v.n >= 5 ? Math.round(v.si / v.n * 100) : null }]));
// Si todavía no hay muestra propia, se usan estos de arranque (se van sustituyendo solos).
const BASE_PCT: Record<string, number> = { '1': 28, '2': 16, '3': 9 };

/** El plan visible del agente para un lead: qué salió, qué va a salir, cuándo, con qué probabilidad, y qué pasa si no contesta. */
export async function planSeguimiento(contactId: string) {
  const [{ data: pf }, { data: pend }, { data: ultEnv }, tasas] = await Promise.all([
    supabase.from('ti_perfil').select('agente_estado, silenciar_ia').eq('contact_id', contactId).maybeSingle(),
    supabase.from('ti_envios').select('id, mensaje, sale_at, origen, plantilla, estado, aprobado_por').eq('contact_id', contactId).in('estado', ['pendiente', 'enviando']).order('sale_at').limit(1),
    supabase.from('ti_envios').select('id, mensaje, enviado_at, origen, plantilla').eq('contact_id', contactId).eq('estado', 'enviado').order('enviado_at', { ascending: false }).limit(1),
    tasasRespuesta(),
  ]);
  const st: any = (pf as any)?.agente_estado || {};
  const intentos: any[] = Array.isArray(st.intentos) ? st.intentos : [];
  const validos = intentos.filter(i => i.valido === true).length;
  const n = validos + 1;
  const pctDe = (k: number, tipo?: string) => { const a = tipo ? tasas[`${k}:${tipo}`] : null; const b = tasas[`${k}`]; return a?.pct ?? b?.pct ?? BASE_PCT[String(Math.min(k, 3))] ?? null; };
  const proximo = (pend || [])[0] || null;
  const ultimo = (ultEnv || [])[0] || null;
  const ultimoIntento = intentos[intentos.length - 1] || null;
  const franjas = ['mañana', 'mediodía', 'tarde'];
  const siguienteFranja = ultimoIntento ? franjas[(franjas.indexOf(ultimoIntento.franja) + 1) % 3] : 'mañana';
  let baseNext = ultimoIntento ? Date.parse(ultimoIntento.at) + 24 * 3600e3 : (st.base_at ? Date.parse(st.base_at) + 20 * 3600e3 : null);
  const yaToca = baseNext != null && baseNext < Date.now();   // el plazo ya venció: se prepara en el próximo tick del horario laboral
  if (yaToca) baseNext = null;
  return {
    activo: !(pf as any)?.silenciar_ia && !st.cerrado, cerrado: st.cerrado || null, pausa_hasta: st.pausa_hasta || null, reenganche: !!st.reenganche, fase: st.fase || null,
    ciclo: st.ciclo || 1, intento_actual: Math.min(n, 3), intentos_validos: validos, intentos_total: intentos.length, max: 3,
    ultimo: ultimo ? { mensaje: ultimo.mensaje, at: ultimo.enviado_at, tipo: ultimo.plantilla ? 'plantilla' : 'texto', origen: ultimo.origen } : null,
    proximo: proximo ? { id: proximo.id, mensaje: proximo.mensaje, sale_at: proximo.sale_at, tipo: proximo.plantilla ? 'plantilla' : 'texto', origen: proximo.origen, aprobado: !!proximo.aprobado_por, probabilidad: pctDe(n, proximo.plantilla ? 'plantilla' : 'texto') } : null,
    si_no_contesta: validos + (proximo ? 1 : 0) >= 3
      ? { que: 'Se agotan los tres intentos reales: pasa a llamada humana y, si sigue callado, se sugiere descalificar con fundamentos.', cuando: null, probabilidad: null }
      : { que: `Intento ${Math.min(validos + (proximo ? 2 : 1), 3)} de 3, en franja de ${siguienteFranja}, con otro ángulo (plantilla si la ventana está cerrada).${yaToca && !proximo ? ' Ya toca: el agente lo propone en el próximo tick dentro del horario (8:00 a 17:00).' : ''}`, cuando: baseNext && !proximo ? new Date(baseNext).toISOString() : proximo ? new Date(Date.parse(proximo.sale_at) + 24 * 3600e3).toISOString() : null, probabilidad: pctDe(Math.min(validos + (proximo ? 2 : 1), 3)) },
    tasas: { '1': pctDe(1), '2': pctDe(2), '3': pctDe(3), muestra: tasas['1']?.n || 0 },
    llamada_at: st.llamada_at || null, agendada_at: st.agendada_at || null,
  };
}
