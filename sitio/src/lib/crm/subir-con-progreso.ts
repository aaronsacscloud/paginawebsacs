/**
 * SUBIR MIDIENDO — porque `fetch` no sabe cuánto lleva subido.
 *
 * Mandar una foto de 5 MB por datos son veinte segundos mirando un botón
 * deshabilitado, sin saber si va a la mitad o si se murió hace rato. La
 * diferencia entre "esperar" y "no saber si esperar" es toda la sensación.
 *
 * `fetch` NO expone el progreso de SUBIDA (sí el de bajada, que aquí no
 * sirve). El único camino en el navegador es XMLHttpRequest y su
 * `upload.onprogress`. Por eso este archivo existe teniendo fetch en todos
 * lados: no es nostalgia, es la única API que da el dato.
 *
 * Devuelve lo mismo que se esperaría de fetch para no cambiar a los que
 * llaman: un objeto ya parseado, o `{ error }` legible. Nunca lanza.
 */

export type Progreso = (pct: number | null) => void;

/** Algunos servidores no mandan el tamaño total; ahí el progreso es null (indeterminado). */
function conectar(xhr: XMLHttpRequest, onProgreso?: Progreso) {
  if (!onProgreso) return;
  xhr.upload.onprogress = (e) => {
    onProgreso(e.lengthComputable && e.total > 0 ? Math.min(99, Math.round((e.loaded / e.total) * 100)) : null);
  };
  // 100 al terminar de SUBIR, no al terminar la petición: lo que queda después
  // es el servidor trabajando, y dejar la barra en 87 mientras tanto se lee
  // como que se atoró.
  xhr.upload.onload = () => onProgreso(100);
}

/** PUT crudo de un archivo (subida directa a Storage con URL firmada). */
export function putConProgreso(url: string, file: File, headers: Record<string, string>, onProgreso?: Progreso): Promise<{ ok: boolean; status: number }> {
  return new Promise(resolve => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      conectar(xhr, onProgreso);
      xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
      xhr.onerror = () => resolve({ ok: false, status: 0 });
      xhr.send(file);
    } catch { resolve({ ok: false, status: 0 }); }
  });
}

/** POST de un FormData, con la respuesta ya parseada como JSON. */
export function postConProgreso(url: string, fd: FormData, onProgreso?: Progreso): Promise<any> {
  return new Promise(resolve => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      conectar(xhr, onProgreso);
      xhr.onload = () => {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve({ error: `Respuesta ilegible del servidor (${xhr.status})` }); }
      };
      xhr.onerror = () => resolve({ error: 'Se cortó la conexión durante la subida' });
      xhr.send(fd);
    } catch (e) { resolve({ error: String(e) }); }
  });
}
