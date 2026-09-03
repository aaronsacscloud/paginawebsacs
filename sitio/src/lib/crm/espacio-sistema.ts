// ══ Equipo · los canales de Sistema ═════════════════════════════════════════
//
// Lo que el CRM avisa por la campana (lead nuevo, ticket abierto o resuelto,
// cotización vista, un cron que se rompió) se escribe TAMBIÉN en su canal de
// Sistema, con autor = Agente IA y una pastilla al registro. Es la misma señal
// que hoy llega por WhatsApp y Discord, pero en el lugar donde el equipo ya
// está platicando: se puede reaccionar y abrir un hilo ("este lead lo tomo yo")
// sin salir del chat.
//
// Son canales de solo lectura y silenciados por defecto —no cuentan como no
// leído ni hacen push— porque son un río: 50 avisos al día que nadie pidió
// leer en el momento. La campana sigue siendo el aviso; esto es la bitácora.
//
// La entrada es `notificar()`: no se engancha cada punto del CRM uno por uno,
// se enganchan las notificaciones, que ya son idempotentes por clave. Lo que no
// pasa por la campana no aparece aquí, y eso es a propósito.
import { supabase } from '../supabase';
import { AGENTE_IA_ID, emitir, type Cita } from './espacio.lib';

export type CanalSistema = 'leads-nuevos' | 'tickets' | 'commits' | 'errores';

/** A qué canal va un tipo de notificación; null = no se espeja (ruido). */
export function canalPara(tipo: string): CanalSistema | null {
  const t = String(tipo || '');
  if (!t || t.startsWith('espacio_')) return null;            // el chat no se avisa a sí mismo
  if (/^sistema_|^aviso_interno_falla$|_fall[ao]$|_error$/.test(t)) return 'errores';
  if (/^(ticket_|soporte_)/.test(t)) return 'tickets';
  if (/^(lead_|demo_|cotizacion_|prueba_|agenda_)/.test(t)) return 'leads-nuevos';
  return null;                                                  // wa_*, pagos, comisiones, churn, ti_*: tienen su pantalla
}

const ids: Partial<Record<CanalSistema, string | null>> = {};
async function idCanal(nombre: CanalSistema): Promise<string | null> {
  if (nombre in ids) return ids[nombre] || null;
  const { data } = await supabase.from('espacio_canales').select('id').eq('tipo', 'sistema').eq('nombre', nombre).is('archivado_at', null).maybeSingle();
  ids[nombre] = data?.id || null;
  return ids[nombre] || null;
}

export type EscritoSistema = {
  canal: CanalSistema;
  /** Idempotencia: con la misma clave no se escribe dos veces. */
  clave?: string | null;
  titulo: string;
  detalle?: string | null;
  nivel?: 'info' | 'alerta' | 'urgente';
  citas?: Cita[];
  /** A dónde lleva la pastilla "Abrir": mismo criterio que la campana. */
  abrir?: { contact_id?: string | null; company_id?: string | null; conversation_id?: string | null; churn_caso_id?: string | null; destino?: string | null; url?: string | null };
  extra?: Record<string, any>;
};

/** Escribe en el canal de Sistema. Nunca lanza: es un espejo, no el hecho. */
export async function escribirSistema(o: EscritoSistema): Promise<string | null> {
  try {
    const canal_id = await idCanal(o.canal);
    if (!canal_id) return null;
    if (o.clave) {
      const { data: ya } = await supabase.from('espacio_mensajes').select('id').eq('metadata->>clave', o.clave).limit(1);
      if (ya?.length) return ya[0].id;
    }
    const titulo = String(o.titulo || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    const detalle = String(o.detalle || '').trim().slice(0, 1200);
    const texto = `**${titulo}**${detalle ? `\n${detalle}` : ''}`;
    const { data, error } = await supabase.from('espacio_mensajes').insert({
      canal_id, autor_id: AGENTE_IA_ID, texto, menciones: [], adjuntos: [],
      citas: (o.citas || []).slice(0, 4),
      metadata: { sistema: { nivel: o.nivel || 'info', ...(o.abrir || {}), ...(o.extra || {}) }, ...(o.clave ? { clave: o.clave } : {}) },
    }).select('id').single();
    if (error) { console.warn('[espacio-sistema]', error.message); return null; }
    await emitir({ tipo: 'msg', canal_id, id: data.id, autor_id: AGENTE_IA_ID });
    return data.id;
  } catch (e: any) { console.warn('[espacio-sistema]', e?.message || e); return null; }
}

/** El espejo de una notificación de la campana: resuelve nombres para las pastillas. */
export async function espejarNotificacion(n: { tipo: string; nivel?: string | null; clave?: string | null; titulo: string; detalle?: string | null; company_id?: string | null; destino?: string | null; metadata?: any }): Promise<void> {
  const canal = canalPara(n.tipo);
  if (!canal) return;
  const m = n.metadata || {};
  const citas: Cita[] = [];
  try {
    if (m.contact_id) {
      const { data: c } = await supabase.from('contacts').select('id, nombre, apellido').eq('id', m.contact_id).maybeSingle();
      if (c) citas.push({ tipo: 'lead', id: c.id, nombre: [c.nombre, c.apellido].filter(Boolean).join(' ') || 'Lead' });
    }
    if (n.company_id) {
      const { data: e } = await supabase.from('companies').select('id, nombre, nombre_comercial').eq('id', n.company_id).maybeSingle();
      if (e) citas.push({ tipo: 'cliente', id: e.id, nombre: e.nombre_comercial || e.nombre || 'Cliente' });
    }
  } catch { /* sin nombre la pastilla igual abre por id */ }
  await escribirSistema({
    canal, clave: n.clave ? `notif:${n.clave}` : null,
    titulo: n.titulo, detalle: n.detalle,
    nivel: (n.nivel as any) || 'info', citas,
    abrir: { contact_id: m.contact_id || null, company_id: n.company_id || null, conversation_id: m.conversation_id || null, churn_caso_id: m.churn_caso_id || null, destino: n.destino || null },
    extra: { tipo: n.tipo, ...(m.que_hacer ? { que_hacer: String(m.que_hacer).slice(0, 300) } : {}), ...(m.intercom_url ? { url: m.intercom_url } : {}) },
  });
}

// ── Lo que se subió ──────────────────────────────────────────────────────────
// #commits no necesita webhook de GitHub ni token: cada despliegue de Vercel
// trae su commit en el entorno. La primera vez que una instancia nueva atiende
// el chat, deja el aviso (una vez por sha, por la clave). Dice lo que está EN
// PRODUCCIÓN, que es lo que importa —un commit sin push no está desplegado.
let despliegueVisto = false;
export async function anotarDespliegue(): Promise<void> {
  if (despliegueVisto) return;
  despliegueVisto = true;
  const env: any = (typeof process !== 'undefined' && process.env) || {};
  const sha = String(env.VERCEL_GIT_COMMIT_SHA || '').trim();
  if (!sha || env.VERCEL_ENV !== 'production') return;
  const msg = String(env.VERCEL_GIT_COMMIT_MESSAGE || '').replace(/\r\n/g, '\n').trim();
  const [primera, ...resto] = msg.split('\n');
  const autor = String(env.VERCEL_GIT_COMMIT_AUTHOR_NAME || env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN || '').trim();
  const owner = env.VERCEL_GIT_REPO_OWNER, repo = env.VERCEL_GIT_REPO_SLUG;
  const url = owner && repo ? `https://github.com/${owner}/${repo}/commit/${sha}` : null;
  await escribirSistema({
    canal: 'commits', clave: `deploy:${sha}`,
    titulo: primera || `Despliegue ${sha.slice(0, 7)}`,
    detalle: [resto.join('\n').trim().slice(0, 900), `${autor ? `${autor} · ` : ''}${env.VERCEL_GIT_COMMIT_REF || 'main'} · ${sha.slice(0, 7)}`].filter(Boolean).join('\n'),
    nivel: 'info', abrir: { url }, extra: { sha, ref: env.VERCEL_GIT_COMMIT_REF || null },
  });
}
