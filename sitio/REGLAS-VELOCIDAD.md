# Reglas de velocidad del CRM

Contrato de rendimiento. Toda función o módulo nuevo del CRM entra a producción
cumpliendo esto — y el referee de velocidad lo mide pantalla por pantalla antes
de dar por cerrado un desarrollo.

## Presupuestos (lo que se mide)

| Métrica | Presupuesto | Cómo se mide |
|---|---|---|
| **Pantalla → contenido con datos** | **≤ 1,000 ms** (warm: assets en caché, datos fríos) | `perf.js` a 390px, 4G (12 Mbps/70 ms RTT), CPU 4x |
| Primera visita del día (cold) | ≤ 2,500 ms | mismo harness, caché vacío |
| Cambio de tab (chunk ya precargado) | ≤ 400 ms | tap → contenido |
| JS inicial del CRM | ≤ 120 KB gzip (chunk CrmDashboard) | `gzip -c dist/client/_astro/CrmDashboard.*.js \| wc -c` |
| Chunk de un tab | ≤ 100 KB gzip | igual, por chunk |
| API de lectura (p75) | ≤ 600 ms | curl -w time_total ×4 |
| Payload de una lista | ≤ 250 KB sin comprimir | curl -w size_download |

## Las 6 reglas (cómo se cumplen)

1. **Todo tab es un chunk lazy.** Los tabs de `CrmDashboard` se importan con
   `React.lazy()`. Un `import` estático de un tab regresa el monolito de 2.2 MB
   que mataba el primer pintado — prohibido. Los destinos del bottom nav se
   precargan con `requestIdleCallback` (ya está: no lo quites).

2. **Toda pantalla de lista pinta primero el caché y revalida detrás.**
   Usa `swrGet(url, cb)` de `lib/crm/swr.ts` en el fetch PRINCIPAL de la
   pantalla. El usuario ve contenido en <200 ms aunque la API tarde. Tras una
   escritura, `swrInvalidar(prefijo)`.

3. **Todo GET de lectura pesada lleva micro-caché de servidor.**
   Envuélvelo con `conMicroCache('clave', ttlMs, _GET)` de
   `lib/crm/micro-cache.ts` (TTL 10–60 s según frescura tolerable; el CRM es
   founder-only, la respuesta es la misma para toda la ventana). Las
   escrituras del mismo archivo llaman `microCacheInvalidar('')`. Nunca en
   escrituras ni datos por-usuario.

4. **Ninguna query barre de más.** Si solo necesitas extremos/agregados,
   hazlo en SQL (RPC con `DISTINCT ON`/`GROUP BY`), no trayendo miles de
   filas para reducirlas en JS (caso real: `uso_snapshots_extremos` bajó
   3,625 filas a 284). `select` solo las columnas que la pantalla usa; toda
   lista lleva `limit`.

5. **Nada bloquea el primer pintado.** Los fetches de una pantalla se
   disparan en paralelo y cada dato pinta EN CUANTO llega (patrón Inicio) —
   jamás un `Promise.all` que espere al más lento para mostrar el primero.
   Estados de carga = esqueleto (`.m-skel`), no spinner en blanco.

6. **Medir antes de dar por bueno.** `node perf.js https://www.sacscloud.com <tabs>`
   (vive en el scratchpad de sesión; copia en este repo: `sitio/scripts/perf.js`).
   Si una pantalla nueva pasa de 1,000 ms warm, no se cierra el desarrollo:
   se optimiza o se recorta lo que carga.

## Dónde vive cada pieza

- `src/lib/crm/swr.ts` — SWR de cliente (sessionStorage)
- `src/lib/crm/micro-cache.ts` — micro-caché de servidor + wrapper `conMicroCache`
- `CrmDashboard.tsx` — lazy imports + prefetch idle + esqueleto `TabCargando`
- Supabase: función `uso_snapshots_extremos(dias)` (creada 2026-08-27)
