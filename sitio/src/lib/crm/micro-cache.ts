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
      // Timeout defensivo: si el backend se atora (visto en prod: cuelgues de
      // ~60 s intermitentes de infra), respondemos 504 rápido y NO cacheamos —
      // el cliente SWR muestra su caché y reintenta después.
      const texto = await Promise.race([
        microCache(k, ttlMs, async () => {
          const r = await handler(ctx);
          if (r.status !== 200) throw new Error('no-cacheable');
          return await r.text();
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout-9s')), 9000)),
      ]);
      return new Response(texto, { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    } catch (err: any) {
      if (String(err?.message) === 'timeout-9s') {
        return new Response(JSON.stringify({ error: 'El servidor tardó demasiado. Intenta de nuevo.' }), { status: 504, headers: { 'Content-Type': 'application/json' } });
      }
      return handler(ctx);
    }
  };
}
