// TRABAJO INTELIGENTE · CONSUMO DE IA (F5, decisión S8): cuánto cuesta el agente, en qué, por lead y por
// resultado; presupuesto mensual ($300 USD) y aviso al 80 % (solo aviso, nada cambia solo).
import { supabase } from '../../supabase';
import { leerConfig } from './motor';
import { notificar } from '../notificaciones';

const ACCION_L: Record<string, string> = { agente_propone: 'Respuestas en vivo', agente_toque_silencio: 'Toques de silencio', agente_cita: 'Citas (no-show / cancelación)', agente_reescribe: 'Reescrituras (Aprendizaje)', agente_preparacion: 'Preparación de demo', datos_lead: 'Extracción de datos', copiloto: 'Copiloto', agente_reconsidera: 'Reconsideraciones' };
const inicioMes = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };

export async function resumenConsumo() {
  const cfg: any = await leerConfig();
  const presupuesto = Number(cfg.presupuesto_ia_usd) || 300;
  const desde30 = new Date(Date.now() - 30 * 86400e3).toISOString();
  const { data: rows } = await supabase.from('ia_log').select('accion, contact_id, costo_usd, created_at').gte('created_at', desde30).gt('costo_usd', 0).limit(20000);
  const hoy = new Date().toISOString().slice(0, 10), d7 = new Date(Date.now() - 7 * 86400e3).toISOString(), mes = inicioMes();
  const tot = { hoy: 0, d7: 0, d30: 0, mes: 0 } as Record<string, number>;
  const porAccion: Record<string, { usd: number; n: number }> = {}; const porDia: Record<string, number> = {}; const porLead: Record<string, { usd: number; n: number }> = {};
  for (const r of rows || []) {
    const c = Number(r.costo_usd) || 0; const dia = String(r.created_at).slice(0, 10);
    tot.d30 += c; if (dia === hoy) tot.hoy += c; if (r.created_at >= d7) tot.d7 += c; if (r.created_at >= mes) tot.mes += c;
    const k = ACCION_L[r.accion] || r.accion; porAccion[k] = porAccion[k] || { usd: 0, n: 0 }; porAccion[k].usd += c; porAccion[k].n++;
    porDia[dia] = (porDia[dia] || 0) + c;
    if (r.contact_id) { porLead[r.contact_id] = porLead[r.contact_id] || { usd: 0, n: 0 }; porLead[r.contact_id].usd += c; porLead[r.contact_id].n++; }
  }
  const { count: citasMes } = await supabase.from('ia_log').select('id', { count: 'exact', head: true }).eq('accion', 'agente_agendo').gte('created_at', mes);
  const topIds = Object.entries(porLead).sort((a, b) => b[1].usd - a[1].usd).slice(0, 10).map(([id]) => id);
  const { data: cs } = topIds.length ? await supabase.from('contacts').select('id, nombre, lifecycle_stage').in('id', topIds) : { data: [] as any[] };
  const nombre: Record<string, any> = {}; for (const c of cs || []) nombre[c.id] = c;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    presupuesto, mes: r2(tot.mes), pct: presupuesto ? Math.round((tot.mes / presupuesto) * 100) : 0, hoy: r2(tot.hoy), d7: r2(tot.d7), d30: r2(tot.d30),
    citas_mes: citasMes || 0, costo_por_cita: citasMes ? r2(tot.mes / citasMes) : null,
    por_accion: Object.entries(porAccion).map(([k, v]) => ({ accion: k, usd: r2(v.usd), n: v.n })).sort((a, b) => b.usd - a.usd),
    por_dia: Object.entries(porDia).sort().map(([dia, usd]) => ({ dia, usd: r2(usd) })),
    por_lead: topIds.map(id => ({ contact_id: id, nombre: nombre[id]?.nombre || '—', etapa: nombre[id]?.lifecycle_stage || '', usd: r2(porLead[id].usd), n: porLead[id].n })),
    proyeccion_mes: r2(tot.d7 / 7 * 30),
  };
}

/** Al 80 % del presupuesto: aviso en Sistema (una vez por mes). Solo aviso, por decisión del dueño. */
export async function revisarPresupuesto() {
  const r = await resumenConsumo();
  if (r.pct < 80) return { pct: r.pct, aviso: false };
  const mesKey = new Date().toISOString().slice(0, 7);
  const nueva = await notificar({ clave: `sistema_presupuesto_ia:${mesKey}:${r.pct >= 100 ? '100' : '80'}`, tipo: 'sistema_presupuesto_ia', nivel: r.pct >= 100 ? 'urgente' : 'alerta', titulo: `La IA del agente va en ${r.pct} % del presupuesto ($${r.mes} de $${r.presupuesto} USD)`, detalle: `Proyección del mes: $${r.proyeccion_mes}. ${r.citas_mes} citas agendadas por el agente este mes${r.costo_por_cita ? ` ($${r.costo_por_cita} por cita)` : ''}.`, metadata: { origen: 'agente', que_hacer: 'Revisa la pestaña Consumo: qué acciones y qué leads gastan más. Si quieres, sube el presupuesto ahí mismo o silencia leads que no aportan.', pct: r.pct } });
  return { pct: r.pct, aviso: nueva };
}
