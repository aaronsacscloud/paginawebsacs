// Lo que el panel "Equipo" le pide al servidor. Todo con la cookie; nada de
// llaves ni ids de usuario en el navegador.
export type Persona = { id: string; nombre: string; foto_url: string | null; rol?: string; visto_at?: string | null; estado?: 'activo' | 'ausente' | 'fuera' };
export type Seccion = { id: string; nombre: string; orden: number };
export type Canal = {
  id: string; seccion_id: string | null; nombre: string; descripcion: string | null;
  tipo: 'charla' | 'sala' | 'directo' | 'sistema'; importante: boolean;
  regla_reunion: { dia_iso: number; hora: string } | null; participantes: string[]; orden: number;
  no_leidos: number; menciones: number; ultimo_at: string | null; silenciado: boolean; ultimo_leido_at: string | null;
};
export type Adjunto = {
  tipo: 'imagen' | 'audio' | 'gif' | 'archivo'; path?: string; thumb?: string; url?: string; thumb_url?: string;
  nombre?: string; bytes?: number; w?: number; h?: number; duracion_s?: number;
  transcripcion?: string | null; transcripcion_estado?: 'ok' | 'pendiente' | 'error';
};
export type Reaccion = { emoji: string; n: number; mia: boolean; quienes: string[] };
export type Mensaje = {
  id: string; canal_id: string; hilo_de: string | null; created_at: string;
  autor: { id: string; nombre: string; foto_url: string | null };
  texto: string; borrado: boolean; editado_at: string | null;
  responde_a: { id: string; autor: { id: string; nombre: string } | null; texto: string } | null;
  menciones: { id: string; nombre: string }[]; adjuntos: Adjunto[]; citas: any[];
  sesion_id: string | null; punto_id: string | null; fijado?: boolean;
  reacciones: Reaccion[]; hilo: { n: number; autores: { id: string; nombre: string; foto_url: string | null }[]; ultima: string } | null;
  cid: string | null; mio: boolean;
  // solo en el navegador
  pendiente?: boolean; fallo?: string;
};
export type Arbol = { yo: Persona & { role: string }; secciones: Seccion[]; canales: Canal[]; personas: Persona[] };

const BASE = '/api/crm/espacio';

async function pedir<T = any>(metodo: string, ruta: string, body?: any): Promise<T> {
  const r = await fetch(BASE + ruta, {
    method: metodo, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j as T;
}

export const api = {
  arbol: () => pedir<Arbol>('GET', '/arbol'),
  mensajes: (p: { canal_id: string; antes?: string; desde?: string; hilo_de?: string; alrededor?: string }) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (v) q.set(k, v);
    return pedir<{ mensajes: Mensaje[]; raiz?: Mensaje; hay_mas: boolean; hay_mas_despues?: boolean }>('GET', `/mensajes?${q}`);
  },
  uno: (id: string) => pedir<{ mensaje: Mensaje }>('GET', `/mensajes?id=${id}`),
  enviar: (b: { canal_id: string; texto: string; responde_a?: string | null; hilo_de?: string | null; adjuntos?: Adjunto[]; cid: string; sesion_id?: string | null; punto_id?: string | null }) =>
    pedir<{ mensaje: Mensaje; repetido?: boolean }>('POST', '/mensajes', b),
  editar: (id: string, texto: string) => pedir<{ mensaje: Mensaje }>('PUT', '/mensajes', { id, texto }),
  fijar: (id: string, fijar: boolean) => pedir<{ mensaje: Mensaje }>('PUT', '/mensajes', { id, fijar }),
  fijados: (canal_id: string) => pedir<{ mensajes: Mensaje[] }>('GET', `/mensajes?canal_id=${canal_id}&fijados=1`),
  borrar: (id: string) => pedir('DELETE', `/mensajes?id=${id}`),
  reaccionar: (mensaje_id: string, emoji: string) => pedir<{ puesta: boolean }>('POST', '/reacciones', { mensaje_id, emoji }),
  leido: (canal_id: string, hasta?: string) => pedir('PUT', '/lecturas', { canal_id, hasta }),
  silenciar: (canal_id: string, silenciar: boolean) => pedir('PUT', '/lecturas', { canal_id, silenciar }),
  seguir: (mensaje_raiz_id: string, on: boolean) => pedir('PUT', '/lecturas', { seguir: mensaje_raiz_id, on }),
  presencia: (estado: 'activo' | 'ausente' | 'fuera', dispositivo: 'movil' | 'escritorio') => pedir('PUT', '/presencia', { estado, dispositivo }),
  realtime: () => pedir<{ url: string | null; key: string | null }>('GET', '/realtime'),
  crearSeccion: (nombre: string) => pedir<{ seccion: Seccion }>('POST', '/secciones', { nombre }),
  editarSeccion: (b: { id: string; nombre?: string; orden?: number; archivar?: boolean }) => pedir('PUT', '/secciones', b),
  crearCanal: (b: { seccion_id: string; nombre: string; descripcion?: string; tipo?: 'charla' | 'sala'; importante?: boolean; regla_reunion?: any }) => pedir<{ canal: Canal }>('POST', '/canales', b),
  abrirDirecto: (con: string) => pedir<{ canal: Canal; existia?: boolean }>('POST', '/canales', { tipo: 'directo', con }),
  editarCanal: (b: { id: string; nombre?: string; descripcion?: string; importante?: boolean; regla_reunion?: any; seccion_id?: string; orden?: number; archivar?: boolean }) => pedir('PUT', '/canales', b),
  // Adjuntos
  subir: (b: { tipo: 'imagen' | 'audio' | 'thumb'; mime: string; bytes: number; nombre?: string }) => pedir<{ path: string; url: string; token: string }>('POST', '/subir', b),
  transcribir: (path: string) => pedir<{ texto: string | null; error?: string }>('POST', '/transcribir', { path }),
  gifs: (q: string) => pedir<{ gifs: { id: string; url: string; preview: string; w: number; h: number }[]; sin_llave?: boolean }>('GET', `/gifs?q=${encodeURIComponent(q)}`),
  buscar: (q: string, canal_id?: string) => pedir<{ resultados: Mensaje[] }>('GET', `/buscar?q=${encodeURIComponent(q)}${canal_id ? `&canal_id=${canal_id}` : ''}`),
  // Salas
  sala: (canal_id: string) => pedir<any>('GET', `/sala?canal_id=${canal_id}`),
  salaAccion: (b: any) => pedir<any>('POST', '/sala', b),
};

export const cid = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

// ── Tiempo, como se dice ────────────────────────────────────────────────────
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function hora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?[ap]\.?\s?m\.?/i, m => m.trim().replace(/\./g, '').toLowerCase());
}

export function diaEtiqueta(iso: string): string {
  const d = new Date(iso); const hoy = new Date();
  const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mismoDia(d, hoy)) return 'Hoy';
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (mismoDia(d, ayer)) return 'Ayer';
  const dif = (hoy.getTime() - d.getTime()) / 864e5;
  if (dif < 7) return DIAS[d.getDay()];
  return `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== hoy.getFullYear() ? ' ' + d.getFullYear() : ''}`;
}

export function hace(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 172800) return 'ayer';
  return `hace ${Math.floor(s / 86400)} días`;
}

export const mismoDia = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
