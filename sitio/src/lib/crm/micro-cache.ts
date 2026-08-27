// ══ REGLA DE VELOCIDAD (servidor): las lecturas pesadas del CRM llevan
// micro-caché en memoria de la instancia (TTL corto). El CRM es founder-only:
// la respuesta es la misma para todos los requests de la ventana, y 30-60 s de
// frescura no cambian ninguna decisión. En frío no ayuda; en uso real (la
// misma instancia caliente sirve la sesión) convierte 1-2 s en ~0 ms.
// Úsalo SOLO en GET de lectura; nunca en escrituras ni en datos por-usuario.
type Entrada = { at: number; valor: any };
const mapa = new Map<string, Entrada>();
const enVuelo = new Map<string, Promise<any>>();

export async function microCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const e = mapa.get(key);
  if (e && Date.now() - e.at < ttlMs) return e.valor as T;
  // dos requests simultáneos no duplican el trabajo: comparten la promesa
  const vivo = enVuelo.get(key);
  if (vivo) return vivo as Promise<T>;
  const p = fn().then(v => { mapa.set(key, { at: Date.now(), valor: v }); enVuelo.delete(key); return v; })
    .catch(err => { enVuelo.delete(key); throw err; });
  enVuelo.set(key, p);
  return p;
}

/** Invalida (tras una escritura del mismo proceso). Prefijo vacío = todo. */
export function microCacheInvalidar(prefijo = '') {
  for (const k of mapa.keys()) if (k.startsWith(prefijo)) mapa.delete(k);
}

/** Envuelve un GET de lectura: cachea el TEXTO de las respuestas 200 (una
 *  Response no se puede reusar) con el querystring en la clave. Los errores
 *  nunca se cachean. */
export function conMicroCache(clave: string, ttlMs: number, handler: (ctx: any) => Promise<Response>) {
  return async (ctx: any) => {
    try {
      const k = clave + '|' + (new URL(ctx.request.url).search || '');
      const texto = await microCache(k, ttlMs, async () => {
        const r = await handler(ctx);
        if (r.status !== 200) throw new Error('no-cacheable');
        return await r.text();
      });
      return new Response(texto, { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    } catch { return handler(ctx); }
  };
}
