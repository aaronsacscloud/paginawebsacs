# Reglas de velocidad del CRM

Contrato de rendimiento. Toda función o módulo nuevo del CRM entra a producción
cumpliendo esto — y el referee de velocidad lo mide pantalla por pantalla antes
de dar por cerrado un desarrollo.

## Presupuestos (lo que se mide)

| Métrica | Presupuesto | Cómo se mide |
|---|---|---|
| **Pantalla → contenido con datos** | **≤ 1,000 ms** (warm: SW instalado, mediana de 3) | `perf.js` a 390px, 4G (12 Mbps/70 ms RTT), **CPU 2x** (el hardware objetivo es ~2x más rápido) |
| Primera visita absoluta (cold, sin SW) | ≤ 2,500 ms deseable | mismo harness, caché vacío |
| Cambio de tab (chunk y datos precargados) | ≤ 400 ms en hardware real (≈ ≤650 a CPU 2x) | `perf-switch.js`, tap → contenido |
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

6. **Medir antes de dar por bueno.** `CPU=2 node sitio/scripts/perf.js
   https://www.sacscloud.com <tabs>` y `CPU=2 node sitio/scripts/perf-switch.js …`.
   Si una pantalla nueva pasa de 1,000 ms warm (mediana de 3), no se cierra el
   desarrollo: se optimiza o se recorta lo que carga.

## Marca de referencia (cierre del goal, 2026-08-27, producción)

| Pantalla | warm (mediana, CPU 2x) | baseline pre-goal |
|---|---|---|
| Inicio | 545 ms | 1,444 ms |
| Leads | 756 ms | 5,056 ms |
| Clientes | 647 ms | 13,915 ms |
| Inbox | 619 ms | 2,981 ms |
| Cotizaciones | 878 ms | 2,080 ms |
| Pagos | 537 ms | 2,422 ms |
| Soporte | 689 ms | timeouts de 60 s |

Switches: 510–639 ms a CPU 2x (~460–490 a 1x); Inicio 182 ms. El chunk inicial
del CRM: 2.2 MB → 99 KB gzip. Si una medición futura se aleja de esta marca,
algo se rompió: buscar el import estático nuevo, el fetch sin SWR o la query
sin límite.

## Reservas del referee (qué vigilar)

1. **Cold sin Service Worker** (~5 s en Leads/Clientes): solo lo vive un
   navegador nuevo o iOS tras 7 días sin abrir la PWA (Safari purga el SW).
   Con la PWA en uso diario, la "primera del día" va por la ruta warm.
2. **warm_max 1.0–1.4 s**: la mediana cumple, pero la peor de 3 cargas rompe
   el segundo por varianza de Vercel/Supabase. Si se vuelve sostenido, es la
   señal de que la infra (no el código) necesita atención.
3. **Cotizaciones es la pantalla canaria** (878 ms, 122 de margen): cualquier
   columna o join nuevo en esa lista la regresa arriba de 1 s. Medirla
   SIEMPRE al tocarla.
4. **Switches**: 460–490 ms medidos a CPU 1x en el rig; la proyección a un
   iPhone real queda bajo 400 ms pero está pendiente confirmarla on-device.

## Dónde vive cada pieza

- `src/lib/crm/swr.ts` — SWR de cliente (sessionStorage)
- `src/lib/crm/micro-cache.ts` — micro-caché de servidor + wrapper `conMicroCache`
- `CrmDashboard.tsx` — lazy imports + prefetch idle + esqueleto `TabCargando`
- Supabase: función `uso_snapshots_extremos(dias)` (creada 2026-08-27)
- `public/sw-crm.js` — Service Worker (assets cache-first, HTML stale-while-revalidate)
- `crm.astro` — script PRIME (datos del tab activo en paralelo con el bundle)
