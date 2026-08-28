// ══ Cola de envío del inbox ════════════════════════════════════════════════
//
// Regla: el trabajo del usuario no se pierde. Si escribe en el metro y manda
// sin señal, el mensaje NO se descarta ni se queda dando vueltas: entra en
// esta cola, se ve en el hilo como pendiente y sale solo cuando vuelve la red
// (o al tocar «Reintentar»).
//
// Vive en localStorage porque tiene que sobrevivir a cerrar la pestaña, a un
// deploy y a que el teléfono mate la app en segundo plano.
//
// Solo texto: un archivo no cabe en localStorage y encolarlo a medias sería
// prometer algo que no se puede cumplir.

export type EnCola = {
  id: string;               // marca única; viaja al servidor como `idem`
  conv: string;             // conversation_id de WhatsApp
  texto: string;
  cita?: string | null;
  autor?: string | null;
  creado_at: string;
  intentos: number;
  error?: string | null;    // último fallo, para decirlo en la burbuja
};

const LLAVE = 'crm:cola-envio';
const oyentes = new Set<() => void>();

export function leerCola(): EnCola[] {
  if (typeof localStorage === 'undefined') return [];
  try { const j = JSON.parse(localStorage.getItem(LLAVE) || '[]'); return Array.isArray(j) ? j : []; }
  catch { return []; }
}

function escribir(cola: EnCola[]) {
  try { localStorage.setItem(LLAVE, JSON.stringify(cola.slice(-50))); } catch { /* cuota llena */ }
  oyentes.forEach(f => { try { f(); } catch { /* nada */ } });
}

export function agregarACola(m: Omit<EnCola, 'creado_at' | 'intentos'>): EnCola {
  const it: EnCola = { ...m, creado_at: new Date().toISOString(), intentos: 0 };
  escribir([...leerCola(), it]);
  return it;
}

export function quitarDeCola(id: string) {
  escribir(leerCola().filter(x => x.id !== id));
}

export function actualizarEnCola(id: string, cambios: Partial<EnCola>) {
  escribir(leerCola().map(x => x.id === id ? { ...x, ...cambios } : x));
}

export function colaDe(conv: string | null): EnCola[] {
  if (!conv) return [];
  return leerCola().filter(x => x.conv === conv);
}

/** Avisa cuando la cola cambia — también desde otra pestaña. */
export function suscribirCola(cb: () => void): () => void {
  oyentes.add(cb);
  const otra = (e: StorageEvent) => { if (e.key === LLAVE) cb(); };
  if (typeof window !== 'undefined') window.addEventListener('storage', otra);
  return () => { oyentes.delete(cb); if (typeof window !== 'undefined') window.removeEventListener('storage', otra); };
}

/** Marca única del mensaje: es lo que impide que un reintento mande dos veces. */
export const marcaUnica = (): string => {
  try { return crypto.randomUUID(); } catch { /* navegador viejo */ }
  return `c-${Date.now()}-${Math.floor(Math.random() * 1e9).toString(36)}`;
};
