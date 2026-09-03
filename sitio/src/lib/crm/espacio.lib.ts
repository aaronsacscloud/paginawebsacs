// ══ Equipo · lo que comparten todas las rutas del chat ═══════════════════════
//
// "Equipo" es el chat de colaboración del CRM (tablas espacio_*). Tres reglas
// que valen para todo lo que hay aquí:
//
// 1. La identidad viene de la cookie. El navegador nunca manda quién es; el
//    autor de un mensaje es el team_member de la sesión y punto.
// 2. Tiempo real = señal, no contenido. Realtime solo avisa "hay algo nuevo en
//    tal canal"; el contenido se trae por la API, con cookie. La llave anónima
//    que vive en el navegador no puede leer ninguna tabla (RLS sin políticas).
// 3. Nada se borra de verdad: un mensaje borrado se marca, porque los hilos y
//    las citas que cuelgan de él siguen necesitando dónde apoyarse.
import { supabase } from '../supabase';
import { getCurrentUser } from '../auth/scope';

export const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esUuid = (v: any) => typeof v === 'string' && UUID.test(v);

/** El Agente IA escribe en los canales de Sistema y contesta @menciones. */
export const AGENTE_IA_ID = 'a7de2512-2bbc-4234-82e9-db4e6b706abf';

export const LIMITES = {
  texto: 4000,
  menciones: 10,
  adjuntos: 6,
  imagen_bytes: 10 * 1024 * 1024,
  audio_bytes: 15 * 1024 * 1024,
  audio_segundos: 300,
  mensajes_por_minuto: 20,
  reacciones_por_minuto: 60,
  editar_minutos: 0,          // 0 = sin ventana; el autor edita cuando quiera (el dueño lo pidió, 3-sep-2026)
  fijados_por_canal: 15,
  pagina: 50,
};

export type Quien = { id: string; nombre: string; foto_url: string | null; role: 'founder' | 'cs' };

/** Quién pide. Solo equipo interno; un partner o un anónimo no existe aquí. */
export async function quien(request: Request): Promise<Quien | null> {
  const u = await getCurrentUser(request);
  if (!u || u.role === 'partner') return null;
  return { id: u.id, nombre: u.nombre || u.email || 'Alguien', foto_url: u.foto_url || null, role: u.role as any };
}

/** Nombre de canal: minúsculas, números y guiones. "Leads Calientes" → "leads-calientes". */
export function slug(s: string): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

// ── Señal en tiempo real ────────────────────────────────────────────────────
// Un solo topic para todo el chat: con dos personas conectadas, un topic por
// canal solo multiplicaría suscripciones. El payload lleva ids, nunca texto.
export type Senal =
  | { tipo: 'msg'; canal_id: string; id: string; autor_id: string; hilo_de?: string | null }
  | { tipo: 'msg_upd'; canal_id: string; id: string; hilo_de?: string | null }
  | { tipo: 'reaccion'; canal_id: string; id: string }
  | { tipo: 'canal'; canal_id?: string }
  | { tipo: 'reunion'; canal_id: string }
  | { tipo: 'presencia' };

export async function emitir(s: Senal): Promise<void> {
  const url = (import.meta.env.SUPABASE_URL || '').trim();
  const key = (import.meta.env.SUPABASE_SERVICE_KEY || '').trim();
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: 'espacio', event: 'senal', payload: s }] }),
    });
  } catch { /* si la señal no sale, el poll de respaldo la cubre en 30 s */ }
}

// ── Ritmo ───────────────────────────────────────────────────────────────────
// Contador en memoria por instancia: en Vercel cada instancia lleva el suyo,
// así que el tope real puede ser algo más alto. Es un freno contra un bucle,
// no un sistema de cuotas.
const ritmo = new Map<string, number[]>();
export function pasaRitmo(clave: string, tope: number): boolean {
  const ahora = Date.now();
  const v = (ritmo.get(clave) || []).filter(t => ahora - t < 60_000);
  if (v.length >= tope) { ritmo.set(clave, v); return false; }
  v.push(ahora); ritmo.set(clave, v);
  return true;
}

// ── Personas ────────────────────────────────────────────────────────────────
export type Persona = { id: string; nombre: string; foto_url: string | null; rol: string; activo: boolean };

/** El equipo que puede estar en el chat: founders y cs activos, más el Agente IA.
 *  La cuenta genérica `admin` (admin@) no es una persona: no aparece. */
export async function equipo(): Promise<Persona[]> {
  const { data } = await supabase.from('team_members')
    .select('id, nombre, foto_url, rol, activo')
    .in('rol', ['founder', 'cs', 'soporte']).eq('activo', true).order('nombre');
  return (data || []).filter((p: any) => p.rol !== 'soporte' || p.id === AGENTE_IA_ID) as Persona[];
}

export async function personasPorId(ids: string[]): Promise<Record<string, Persona>> {
  const u = Array.from(new Set(ids.filter(esUuid)));
  if (!u.length) return {};
  const { data } = await supabase.from('team_members').select('id, nombre, foto_url, rol, activo').in('id', u);
  const out: Record<string, Persona> = {};
  for (const p of data || []) out[p.id] = p as Persona;
  return out;
}

// ── Canales ─────────────────────────────────────────────────────────────────
export type Canal = {
  id: string; seccion_id: string | null; nombre: string; descripcion: string | null;
  tipo: 'charla' | 'sala' | 'directo' | 'sistema'; importante: boolean;
  regla_reunion: { dia_iso: number; hora: string } | null; participantes: string[];
  archivado_at: string | null; orden: number;
};

export async function canalDe(id: string): Promise<Canal | null> {
  if (!esUuid(id)) return null;
  const { data } = await supabase.from('espacio_canales').select('*').eq('id', id).maybeSingle();
  return (data as Canal) || null;
}

/** Un directo solo lo ven sus dos personas; lo demás lo ve todo el equipo. */
export function puedeVerCanal(c: Canal, yo: string): boolean {
  if (c.tipo === 'directo') return (c.participantes || []).includes(yo);
  return true;
}

// ── Mensajes ────────────────────────────────────────────────────────────────
export type Adjunto = {
  tipo: 'imagen' | 'audio' | 'gif' | 'archivo';
  path?: string; thumb?: string; url?: string; nombre?: string; bytes?: number;
  w?: number; h?: number; duracion_s?: number;
  transcripcion?: string | null; transcripcion_estado?: 'ok' | 'pendiente' | 'error';
};

export type Cita = { tipo: 'cliente' | 'lead' | 'tarea' | 'reunion' | 'cotizacion' | 'corte' | 'canal' | 'wiki'; id: string; nombre?: string };

export const SELECT_MENSAJE = 'id, canal_id, hilo_de, autor_id, texto, responde_a, menciones, adjuntos, citas, sesion_id, punto_id, editado_at, borrado_at, fijado_at, fijado_por, metadata, created_at';

/**
 * Da forma a un mensaje para el navegador: autor resuelto, la cita del mensaje
 * al que responde (primera línea), reacciones agrupadas y cuántas respuestas
 * tiene su hilo. Se resuelve en lote para no hacer una consulta por mensaje.
 */
export async function darForma(rows: any[], yo: string) {
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const respondeA = rows.map(r => r.responde_a).filter(Boolean);
  const [personas, { data: citados }, { data: reacciones }, { data: hilos }] = await Promise.all([
    personasPorId([...rows.map(r => r.autor_id), ...rows.flatMap(r => r.menciones || [])]),
    respondeA.length
      ? supabase.from('espacio_mensajes').select('id, autor_id, texto, borrado_at, adjuntos').in('id', respondeA)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('espacio_reacciones').select('mensaje_id, usuario_id, emoji').in('mensaje_id', ids),
    supabase.from('espacio_mensajes').select('hilo_de, autor_id, created_at').in('hilo_de', ids).is('borrado_at', null),
  ]);

  const citadosMap: Record<string, any> = {};
  for (const c of citados || []) citadosMap[c.id] = c;
  const autoresCitados = await personasPorId((citados || []).map((c: any) => c.autor_id));

  const rx: Record<string, Record<string, string[]>> = {};
  for (const r of reacciones || []) {
    rx[r.mensaje_id] ||= {};
    (rx[r.mensaje_id][r.emoji] ||= []).push(r.usuario_id);
  }
  const hilo: Record<string, { n: number; autores: string[]; ultima: string }> = {};
  for (const h of hilos || []) {
    const e = (hilo[h.hilo_de] ||= { n: 0, autores: [], ultima: h.created_at });
    e.n++;
    if (!e.autores.includes(h.autor_id)) e.autores.push(h.autor_id);
    if (h.created_at > e.ultima) e.ultima = h.created_at;
  }

  // Los adjuntos viven en un bucket privado: cada uno sale con una URL firmada
  // de una hora, TODAS en una sola llamada al storage.
  const paths = rows.filter(r => !r.borrado_at).flatMap(r => (r.adjuntos || []).flatMap((a: any) => [a.path, a.thumb])).filter(Boolean) as string[];
  const firmadas: Record<string, string> = {};
  if (paths.length) {
    const { data: f } = await supabase.storage.from('espacio').createSignedUrls(Array.from(new Set(paths)), 3600);
    for (const x of f || []) if (x.path && x.signedUrl) firmadas[x.path] = x.signedUrl;
  }
  const conUrl = (a: any) => ({ ...a, url: a.tipo === 'gif' ? a.url : (a.path ? firmadas[a.path] || null : null), thumb_url: a.thumb ? firmadas[a.thumb] || null : undefined });

  const persona = (id: string) => {
    const p = personas[id] || autoresCitados[id];
    return p ? { id: p.id, nombre: p.nombre, foto_url: p.foto_url } : { id, nombre: 'Alguien', foto_url: null };
  };

  return rows.map(r => {
    const borrado = !!r.borrado_at;
    const c = r.responde_a ? citadosMap[r.responde_a] : null;
    return {
      id: r.id, canal_id: r.canal_id, hilo_de: r.hilo_de, created_at: r.created_at,
      autor: persona(r.autor_id),
      texto: borrado ? '' : r.texto,
      borrado,
      editado_at: r.editado_at,
      responde_a: r.responde_a ? (c ? {
        id: c.id, autor: persona(c.autor_id),
        texto: c.borrado_at ? 'mensaje eliminado' : (c.texto || (Array.isArray(c.adjuntos) && c.adjuntos.length ? (c.adjuntos[0].tipo === 'audio' ? 'audio' : 'imagen') : '')),
      } : { id: r.responde_a, autor: null, texto: 'mensaje eliminado' }) : null,
      menciones: (r.menciones || []).map(persona),
      adjuntos: borrado ? [] : (r.adjuntos || []).map(conUrl),
      citas: borrado ? [] : (r.citas || []),
      sesion_id: r.sesion_id, punto_id: r.punto_id,
      fijado: !!r.fijado_at && !borrado,
      reacciones: Object.entries(rx[r.id] || {}).map(([emoji, quienes]) => ({ emoji, n: quienes.length, mia: quienes.includes(yo), quienes: quienes.map(q => persona(q).nombre) })),
      hilo: hilo[r.id] ? { n: hilo[r.id].n, autores: hilo[r.id].autores.map(persona), ultima: hilo[r.id].ultima } : null,
      cid: r.metadata?.cid || null,
      sistema: r.metadata?.sistema || null,
      mio: r.autor_id === yo,
    };
  });
}

/** Saca los @menciones del texto contra el equipo: guarda ids, no nombres. */
export function extraerMenciones(texto: string, personas: Persona[]): string[] {
  const out: string[] = [];
  const re = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) { const id = m[2]; if (esUuid(id) && personas.some(p => p.id === id) && !out.includes(id)) out.push(id); }
  return out.slice(0, LIMITES.menciones);
}

/** ¿Esto parece una credencial? Aviso, no bloqueo: la regla es que van al gestor. */
export function pareceCredencial(texto: string): boolean {
  return /\b(sbp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}|password\s*[:=]\s*\S{6,}|contraseña\s*[:=]\s*\S{6,})/i.test(texto);
}
