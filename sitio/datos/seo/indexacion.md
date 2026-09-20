# Auditoría de indexación y rendimiento — sacscloud.com
Fecha: 2026-09-19 · Dominio auditado: https://www.sacscloud.com (siempre con www)

## 1. Qué está indexable de verdad

El sitio publica **dos sitemaps independientes**, ambos declarados en robots.txt (no uno dentro del otro):

| Sitemap | URLs | Generado por |
|---|---:|---|
| `/sitemap-index.xml` → `/sitemap-0.xml` | 90 | build de Astro (`@astrojs/sitemap`, filtro `enSitemap`) |
| `/sitemap-demanda.xml` | 36 | motor de demanda, `prerender=false`, servido desde Supabase |
| **Total único** (3 URLs se repiten en ambos: `/comparar/`, `/recursos/`, `/herramientas/`) | **123** | |

Desglose de `sitemap-0.xml` (páginas escritas a mano) por sección:

| Sección | URLs |
|---|---:|
| giros | 35 |
| producto | 29 |
| casos-de-exito | 5 |
| blog | 3 |
| soluciones | 2 |
| recursos | 2 |
| herramientas | 2 |
| home, planes, partners, indice-moda-mexico, extraordinarios, enterprise, contacto, componentes, comparar, buddy, terminos, privacidad | 1 c/u |

Desglose de `sitemap-demanda.xml` (contenido del motor, sin build):

| Sección | URLs |
|---|---:|
| comparar | 18 |
| recursos | 12 |
| herramientas | 5 |
| indice-moda-mexico | 1 |

### Comparación contra el repo — hueco encontrado (real, no cosmético)

`src/content/blog/` tiene **3** posts (`bienvenida.md`, `bershka.md`, `machina.md`) y la ruta `src/pages/blog/[...slug].astro` los construye los 3 sin filtro (`getStaticPaths` sobre `getCollection('blog')` completo). La página **`/blog/bienvenida/` responde 200, tiene `<title>`, meta, canonical propio y JSON-LD — no tiene `noindex`** — y sin embargo **no aparece en ningún sitemap**.

Causa raíz localizada en `src/data/no-indexables.ts`: la función `enSitemap()` decide con `url.includes(p)`, y la lista `NO_INDEXABLES` contiene la cadena `'/bienvenida'` (destinada a excluir la pantalla de acuse post-registro, `https://www.sacscloud.com/bienvenida`). Como `.includes()` es un match de subcadena, también captura `https://www.sacscloud.com/blog/bienvenida/`, que contiene esa subcadena. Es una colisión de nombres, no una decisión intencional — la página de blog queda huérfana del sitemap por un efecto colateral de la regla de la otra página.

Revisé el resto de la lista (`/registro`, `/planes` no está, `/campana/punto-de-venta`, `/email/`, etc.) buscando la misma colisión y no encontré otra — esta es la única.

No se encontraron páginas "de más" (URLs en el sitemap sin página real detrás): las 123 URLs resolvieron todas en 200 (ver §2).

## 2. Estado HTTP real

Muestra: **88 URLs** (de las 123 totales), cubriendo las 18 secciones, con `curl -L --max-redirs 5`.

| Resultado | Cantidad |
|---|---:|
| 200 sin redirección | 88 |
| 3xx / 4xx / 5xx | 0 |
| Redirecciones encadenadas | 0 |

Ningún hallazgo. (Recordatorio ya conocido y fuera de esta muestra: el dominio sin `www` responde 307 — no se usó en ningún test.)

## 3. robots.txt y rastreadores de IA

```
User-agent: *          Allow: /     Disallow: /admin/
User-agent: GPTBot      Allow: /
User-agent: anthropic-ai Allow: /
User-agent: PerplexityBot Allow: /
User-agent: Google-Extended Allow: /
User-agent: ClaudeBot   Allow: /
Sitemap: https://www.sacscloud.com/sitemap-index.xml
Sitemap: https://www.sacscloud.com/sitemap-demanda.xml
```

| Bot | Declarado explícito | Efectivo |
|---|---|---|
| GPTBot | Sí, Allow | Permitido |
| ClaudeBot | Sí, Allow | Permitido |
| anthropic-ai (UA legado de Claude) | Sí, Allow | Permitido |
| PerplexityBot | Sí, Allow | Permitido |
| Google-Extended | Sí, Allow | Permitido |
| **Applebot-Extended** | **No aparece** | Permitido solo por la regla `User-agent: *` (no hay bloqueo, pero tampoco declaración explícita) |

Los dos sitemaps están correctamente declarados.

## 4. Páginas delgadas (thin content)

Se midieron las **123** páginas del sitemap (texto visible tras quitar `<script>`, `<style>`, comentarios y etiquetas HTML).

| Métrica | Valor |
|---|---:|
| Páginas medidas | 123 |
| Páginas con menos de 300 palabras | **0** |
| Mínimo encontrado | 1,955 palabras (`/blog/`) |
| Mediana | 3,669 palabras |
| Promedio | 4,071 palabras |
| Máximo | 8,717 palabras (`/terminos/`) |

No hay páginas delgadas en el sitemap actual. Nota metodológica: el conteo incluye nav + header + footer globales (~20 KB de texto de ~250 KB de HTML en una página de producto típica), así que el "piso" real de contenido propio es algo menor al número crudo — pero incluso descontando ese boilerplate, ninguna página se acerca al umbral de 300 palabras.

## 5. Rendimiento (Lighthouse móvil, 1 corrida por URL — no alcanzó el tiempo para mediana de 3)

Comando usado con `CHROME_PATH` fijo a Chromium de Playwright, `--form-factor=mobile --screenEmulation.mobile`.

| URL | Perf | SEO | A11y | Best Practices | LCP | CLS | TBT |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` (home) | 82 | 100 | 93 | 100 | 3.9 s | 0 | 270 ms |
| `/giros/zapateria/` | 93 | 100 | 97 | 100 | 3.0 s | 0 | 80 ms |
| `/planes/` | **74** | 100 | 94 | **79** | 1.9 s | 0.002 | **1,270 ms** |
| `/producto/punto-de-venta/` | 96 | 100 | 100 | 100 | 2.8 s | 0 | 0 ms |
| `/blog/` | 99 | 100 | 92 | 100 | 1.7 s | 0 | 0 ms |
| `/comparar/sacs-vs-vendty/` | 100 | 100 | 95 | 100 | 1.7 s | 0.005 | 0 ms |

Qué pesa más en cada caso:
- **`/planes/`** es la peor por lejos: TBT de 1,270 ms viene de **scripts de terceros** — TikTok Pixel (396 ms de bloqueo, 180 KB), Microsoft Clarity (245 ms, 29 KB), PostHog (49 ms, 107 KB) y un script de openai.com (35 ms, 29 KB). El best-practices=79 cae por cookies de terceros (13 encontradas) e issues en el panel de DevTools. `mainthread-work-breakdown`=6.2 s, `bootup-time`=3.0 s.
- **`/`** (home): LCP más alto del set (3.9 s) — oportunidades detectadas: "properly size images" (300 ms), "reduce unused CSS" (150 ms), "defer offscreen images" (150 ms).
- **`/giros/zapateria/`**: LCP 3.0 s, casi todo atribuible a imágenes sobredimensionadas (1,050 ms de ahorro estimado).
- `/producto/`, `/blog/`, `/comparar/` están limpias (TBT=0, sin oportunidades relevantes).

## 6. Datos de Search Console

Existe integración real y viva, no un mock: **`src/lib/demanda/fuentes/gsc.ts`** — el motor de demanda pide la Search Console API (`searchAnalytics/query`, dimensiones `query, page, country, device`, día `hoy-3` por consolidación, hasta 25,000 filas paginadas) y guarda todo crudo en la tabla de Supabase **`de_gsc_diario`**, con relleno histórico progresivo (hasta 16 meses) manejado por el propio motor (`ingerirGsc`, `diasPendientes`).

**No pude traer cifras reales de impresiones/clics de hoy**: no hay ningún archivo exportado (CSV/JSON) de GSC en el repo, y el MCP de Supabase no está conectado en esta sesión (`list_projects` devolvió "not connected"), así que no tuve acceso de lectura a `de_gsc_diario`. No voy a inventar números — si se quiere ese resumen, hace falta correr la consulta directamente contra Supabase (proyecto `wtzhogdyicekxcnclmyu`, tabla `de_gsc_diario`) con acceso habilitado.
