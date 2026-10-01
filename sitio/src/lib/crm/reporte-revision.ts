// La REVISIÓN del cliente sobre un reporte: «revisado» por punto, comentarios y
// firma (dueño, 1-oct-2026).
//
// Vive en `activities` como una bitácora de eventos y no en columnas del
// reporte. Dos razones:
//  · la bitácora es justo lo que se pidió ver por dentro —CUÁNDO revisó cada
//    punto, qué comentó y cuándo firmó—, y además sale sola en la Actividad
//    de la cuenta;
//  · no depende de un SQL pendiente: `activities` y su `metadata` jsonb ya
//    existen, así que la función sirve desde el primer despliegue.
//
// El estado actual se ARMA leyendo los eventos en orden: el último «revisado»
// de cada punto manda, los comentarios se acumulan y la firma, una vez puesta,
// cierra el documento.
import { supabase } from '../supabase';
import { llaveEntrega, llaveTrabajo } from './reporte-firma';

export const EV = {
  revisado: 'reporte_revisado',
  comentario: 'reporte_comentario',
  firma: 'reporte_firma',
} as const;
const TIPOS = [EV.revisado, EV.comentario, EV.firma];

export type Comentario = { texto: string; at: string };
export type Revision = {
  revisados: Record<string, string>;          // llave → cuándo lo marcó (ISO)
  comentarios: Record<string, Comentario[]>;  // llave → comentarios ('general' = el del final)
  firma: any | null;                          // { nombre, leyenda, trazo, at, ip, ua, comentario? }
  eventos: any[];                             // la bitácora, para el CRM
};

export const revisionVacia = (): Revision => ({ revisados: {}, comentarios: {}, firma: null, eventos: [] });

/** Arma el estado a partir de los eventos, ya ordenados por fecha. */
export function armar(eventos: any[]): Revision {
  const r = revisionVacia();
  for (const e of eventos) {
    const m = e.metadata || {};
    const at = m.at || e.created_at;
    if (e.tipo === EV.revisado && m.llave) {
      if (m.revisado === false) delete r.revisados[m.llave]; else r.revisados[m.llave] = at;
    } else if (e.tipo === EV.comentario && m.llave && m.texto) {
      (r.comentarios[m.llave] = r.comentarios[m.llave] || []).push({ texto: m.texto, at });
    } else if (e.tipo === EV.firma && m.firma && !r.firma) {
      r.firma = m.firma;   // la PRIMERA firma es la que vale: después ya no se mueve nada
    }
    r.eventos.push({
      tipo: e.tipo, at, llave: m.llave || null, titulo: m.titulo || null,
      revisado: e.tipo === EV.revisado ? m.revisado !== false : undefined,
      texto: m.texto || m.firma?.comentario || null, nombre: m.firma?.nombre || null,
    });
  }
  return r;
}

/** La revisión de UN reporte (la liga pública y sus APIs). */
export async function leerRevision(reporteId: string): Promise<Revision> {
  const { data } = await supabase.from('activities')
    .select('tipo, created_at, metadata')
    .in('tipo', TIPOS).eq('metadata->>reporte_id', reporteId)
    .order('created_at', { ascending: true }).limit(2000);
  return armar(data || []);
}

/** La revisión de VARIOS reportes de un jalón (la lista del CRM). Sin el trazo
 *  de la firma: pesa y la lista no lo pinta. */
export async function leerRevisiones(ids: string[]): Promise<Record<string, Revision>> {
  const out: Record<string, Revision> = {};
  if (!ids.length) return out;
  const { data } = await supabase.from('activities')
    .select('tipo, created_at, metadata->reporte_id, metadata->llave, metadata->revisado, metadata->texto, metadata->titulo, metadata->at, firma_nombre:metadata->firma->>nombre, firma_at:metadata->firma->>at, firma_com:metadata->firma->>comentario')
    .in('tipo', TIPOS).in('metadata->>reporte_id', ids)
    .order('created_at', { ascending: true }).limit(5000);
  const por: Record<string, any[]> = {};
  for (const d of (data || []) as any[]) {
    const e = {
      tipo: d.tipo, created_at: d.created_at,
      metadata: {
        llave: d.llave, revisado: d.revisado, texto: d.texto, titulo: d.titulo, at: d.at,
        firma: d.firma_nombre ? { nombre: d.firma_nombre, at: d.firma_at, comentario: d.firma_com } : undefined,
      },
    };
    (por[d.reporte_id] = por[d.reporte_id] || []).push(e);
  }
  for (const id of ids) out[id] = armar(por[id] || []);
  return out;
}

/** Guarda un evento de la revisión. */
export async function registrar(o: {
  tipo: string; reporteId: string; companyId: string | null; titulo: string; metadata: Record<string, any>;
}) {
  return supabase.from('activities').insert({
    company_id: o.companyId, tipo: o.tipo, titulo: o.titulo, automatico: true,
    metadata: { reporte_id: o.reporteId, at: new Date().toISOString(), ...o.metadata },
  });
}

/** El título del renglón que corresponde a la llave, o null si no es de este reporte. */
export function renglonDe(rep: any, llave: string): string | null {
  const h = rep?.hechos || {};
  if (rep?.tipo === 'entregas') {
    const i = (h.entregas || []).findIndex((_: any, k: number) => llaveEntrega(k) === llave);
    return i >= 0 ? String(h.entregas[i].titulo || 'Entrega') : null;
  }
  const i = (h.trabajos || []).findIndex((t: any, k: number) => llaveTrabajo(t, k) === llave);
  return i >= 0 ? String(h.trabajos[i].titulo || 'Trabajo') : null;
}
