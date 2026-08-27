// ══ REGLA DE VELOCIDAD (cliente): toda pantalla de lista PINTA PRIMERO la
// última respuesta buena (sessionStorage) y revalida detrás. El usuario ve
// contenido en <200 ms aunque la API tarde; cuando llega lo fresco, se
// re-pinta. La sesión del navegador es el tope de vida del caché.
// Úsalo en el fetch PRINCIPAL de la pantalla; los secundarios pueden esperar.

/** Llama cb(data, esCache=true) al instante si hay caché, y cb(data, false)
 *  cuando responde la red (y guarda). Devuelve una promesa que resuelve tras
 *  la red; solo rechaza si la red falló Y no había caché que mostrar. */
export function swrGet(url: string, cb: (data: any, esCache: boolean) => void): Promise<void> {
  let pintoCache = false;
  try {
    const raw = sessionStorage.getItem('swr:' + url);
    if (raw) { cb(JSON.parse(raw), true); pintoCache = true; }
  } catch { /* modo privado / lleno: seguimos sin caché */ }
  return fetch(url)
    .then(r => r.json())
    .then(j => {
      cb(j, false);
      try { sessionStorage.setItem('swr:' + url, JSON.stringify(j)); } catch { /* nada */ }
    })
    .catch(err => { if (!pintoCache) throw err; });
}

/** Tras una escritura: tira el caché local para que la próxima carga no
 *  resucite datos viejos. Prefijo vacío = todo el SWR del CRM. */
export function swrInvalidar(prefijo = '') {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('swr:' + prefijo)) sessionStorage.removeItem(k);
    }
  } catch { /* nada */ }
}
