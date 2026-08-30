// ══ REGLA DE VELOCIDAD (cliente): toda pantalla de lista PINTA PRIMERO la
// última respuesta buena (localStorage: sobrevive a cerrar la app) y revalida detrás. El usuario ve
// contenido en <200 ms aunque la API tarde; cuando llega lo fresco, se
// re-pinta. La sesión del navegador es el tope de vida del caché.
// Úsalo en el fetch PRINCIPAL de la pantalla; los secundarios pueden esperar.

/** Llama cb(data, esCache=true) al instante si hay caché, y cb(data, false)
 *  cuando responde la red (y guarda). Devuelve una promesa que resuelve tras
 *  la red; solo rechaza si la red falló Y no había caché que mostrar. */
/* La caché vive en localStorage, no en sessionStorage.
 *
 * sessionStorage muere al cerrar la pestaña, y en una PWA instalada CADA
 * arranque es sesión nueva: la caché no existía nunca justo donde más falta
 * hace. Con localStorage, abrir la app en el metro pinta la última lista buena
 * y revalida cuando haya señal, en vez de enseñar un hueco.
 *
 * 24 h de tope: pasado ese punto, mostrar datos de anteayer como si fueran de
 * hoy engaña más de lo que ayuda — mejor esperar a la red.
 *
 * Se apoya en lib/ui/snapshot, que ya resuelve las dos cosas que esto necesita:
 * qué hacer cuando la cuota se llena (tirar lo del CRM y reintentar una vez) y
 * BORRAR TODO al cerrar sesión, que aquí importa porque quedan nombres y datos
 * de clientes en el aparato. */
import { leerSnap, guardarSnap } from './snapshot';

const MAX_EDAD = 24 * 3600e3;

export function swrGet(url: string, cb: (data: any, esCache: boolean) => void): Promise<void> {
  let pintoCache = false;
  const guardado = leerSnap<any>(url, MAX_EDAD);
  if (guardado !== null && guardado !== undefined) { cb(guardado, true); pintoCache = true; }
  return fetch(url)
    .then(r => r.json())
    .then(j => {
      cb(j, false);
      guardarSnap(url, j);
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
