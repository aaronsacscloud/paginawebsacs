# Auditoría de datos estructurados (schema.org) y GEO — sacscloud.com

Repo: `/opt/sacs/paginawebsacs/sitio` (Astro). Solo auditoría, nada editado.
Fuente única de identidad: `src/data/entidad.ts` (`SCHEMA_BASE()` = Organization + SoftwareApplication,
inyectado por `src/layouts/BaseLayout.astro` en TODAS las páginas). `src/components/StructuredData.astro`
solo serializa el/los objetos que le pasen — no valida nada.

Ordenado por impacto. Impacto = qué tanto mueve la aguja de "Google/una IA reconoce y cita a Sacs
como LA entidad de este software", no solo "cumple el spec".

---

## 0. Lo que ya está BIEN hecho (no tocar, replicar el patrón)

- `src/data/entidad.ts`: un solo `@id` (`https://www.sacscloud.com/#organizacion`) para la Organization,
  referenciado desde `software()` (`publisher: {'@id': ENTIDAD_ID}`). Arquitectura de entidad correcta.
  El comentario del propio archivo documenta que antes apuntaba a `sacs.com.mx` (dominio muerto) y a un
  logo 404 — ya corregido.
- `PERFILES` (sameAs) vacío A PROPÓSITO mientras no haya perfiles confirmados. Postura correcta: un
  `sameAs` roto resta más credibilidad que no tenerlo. Ver sección 2 sobre qué sí se puede confirmar hoy.
- `src/lib/demanda/publicar.ts` (motor de demanda: rutas `/recursos/*`, `/comparar/*`, `/software-para/*`):
  emite `Article` con `@id`, `mainEntityOfPage`, `author: {'@id': ENTIDAD_ID}`, `publisher: {'@id': ENTIDAD_ID}`,
  `datePublished` y `dateModified` reales. Este es el patrón de referencia — el resto del sitio debería
  imitarlo, no al revés.
- `src/lib/demanda/bloques.ts` (`schemaDeCuerpo`): genera `FAQPage` y `HowTo` directo de bloques
  estructurados (pregunta/respuesta ya separados), sin inferir nada de markdown. Ya vivo en
  `/recursos/*`, `/comparar/*`, `/software-para/*`.
- `/herramientas/[slug].astro`: `HowTo` con pasos reales para cada calculadora; `/herramientas/mcp.astro`:
  describe un servidor MCP público (`WebAPI`) — pensado explícitamente para que un agente de IA lo use,
  no solo lo lea. Es de las piezas más GEO-forward del sitio.
- `/indice-moda-mexico.astro`: `Dataset` (no `Article`) con `license: CC-BY-4.0`, `isAccessibleForFree`,
  `variableMeasured` con cifras propias y fecha de corte. Exactamente el tipo de "dato citable con cifra
  y fecha" que pide GEO. **Ojo: está detrás de un candado (`leerPublicado()` devuelve null hasta que el
  dueño lo publique) — no está vivo todavía.** Es lo más valioso del sitio para que una IA cite a Sacs
  como fuente y no está encendido.
- `robots.txt` ya permite explícitamente GPTBot, anthropic-ai, ClaudeBot, PerplexityBot y Google-Extended,
  y declara dos sitemaps (build + demanda).

---

## 1. Máximo impacto — huecos que tocan CADA página o páginas de alto tráfico

### 1.1 BreadcrumbList: existe en UNA sola plantilla de 111 páginas

Grep de `BreadcrumbList` en todo `src/`: el único resultado es `src/layouts/BlogLayout.astro`. Cero en
`/producto/*`, `/giros/*` (23 páginas), `/soluciones/*`, `/casos-de-exito/*`, `/comparar/*`, `/recursos/*`,
`/software-para/*`, `/herramientas/*`. El propio plan del motor de demanda (`PLAN-DEMAND-ENGINE.md:297`)
ya prevé `BreadcrumbList` en las rutas dinámicas — no está implementado aún.

**Propuesta**: un helper en `src/data/entidad.ts` (o un nuevo `src/lib/breadcrumb.ts`) que arme la lista
desde la ruta y `src/data/navigation.ts` (fuente única de la jerarquía de giros/producto), y un componente
`BreadcrumbSchema.astro` que cada página le pasa a `structuredData` junto con su propio schema.

```ts
// ejemplo para /giros/zapateria
export function breadcrumb(items: { name: string; url?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.url ? { item: it.url } : {}), // el último ítem no lleva url
    })),
  };
}
```

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://www.sacscloud.com/" },
    { "@type": "ListItem", "position": 2, "name": "Giros", "item": "https://www.sacscloud.com/giros" },
    { "@type": "ListItem", "position": 3, "name": "Zapaterías" }
  ]
}
```

### 1.2 `/planes` — la página comercial más importante del sitio no emite NADA propio

`src/pages/planes.astro` llama a `<BaseLayout title=... description=...>` **sin `structuredData`**. Solo
recibe el `SCHEMA_BASE()` genérico (Organization + un único `Offer` "desde $810" en `software()`). No hay
`AggregateOffer` con los 5 planes reales (`src/data/plans.ts`: Vende $810 → Automatiza, con precio mensual
y anual en 9 monedas), y las 6 preguntas reales del acordeón (`pricingFaqs` en `plans.ts`, renderizadas por
`FAQAccordion` en la sección "SECTION 6: FAQ") no tienen `FAQPage`.

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "@id": "https://www.sacscloud.com/#software",
  "name": "Sacs",
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "MXN",
    "lowPrice": 527,
    "highPrice": 2500,
    "offerCount": 5,
    "url": "https://www.sacscloud.com/planes"
  }
}
```
(`lowPrice`/`highPrice` deben salir de `Math.min`/`Math.max` sobre `plans.map(p => p.annual.mxn)` —
no hardcodear; hoy `desde` en `entidad.ts` ya calcula el mínimo con `PLANES`, que es una tabla DISTINTA
(`src/lib/crm/ti/conocimiento/planes.ts`, la que usa el agente comercial) — ver riesgo 5.3 sobre estas
dos fuentes de precio.)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "¿Puedo cambiar de plan en cualquier momento?",
      "acceptedAnswer": { "@type": "Answer", "text": "Sí. Subes o bajas de plan cuando quieras, sin penalización. Si la temporada alta te pide más, subes en noviembre y bajas en febrero. El cambio entra en tu siguiente periodo de facturación." }
    },
    {
      "@type": "Question",
      "name": "¿Qué pasa con mi catálogo si cancelo?",
      "acceptedAnswer": { "@type": "Answer", "text": "Todo sigue disponible 90 días después de cancelar. Exportas cuando quieras tus modelos con sus tallas y colores, tu cartera de clientas y tu historial de ventas. No hay cargo por cancelar." }
    }
  ]
}
```
(las 6 preguntas completas están en `src/data/plans.ts:406-431`, listas para mapear 1:1.)

### 1.3 Home (`/`) — FAQ real sin marcar, y `WebSite` sin `SearchAction`

`src/pages/index.astro` monta `<FAQAccordion locale="es" />` con 6 preguntas reales (`src/i18n/translations/es.json`,
llaves `faq.q1..q6/a1..a6`: precio, tiempo de setup, soporte, integraciones, seguridad, migración) y NO
las marca. Único `structuredData` pasado es `sitioWeb()`.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "¿Cuánto cuesta Sacs?", "acceptedAnswer": { "@type": "Answer", "text": "No hay plan gratuito permanente, pero puedes probar Sacs gratis 7 días sin tarjeta. Los planes de pago comienzan en $810 MXN/mes (Vende) e incluyen punto de venta, tienda en línea, venta multicanal y soporte." } },
    { "@type": "Question", "name": "¿Se integra con otras herramientas?", "acceptedAnswer": { "@type": "Answer", "text": "Sí. Sacs se integra con los principales procesadores de pago, plataformas de e-commerce, sistemas contables y herramientas de marketing. También ofrecemos una API abierta." } }
  ]
}
```
(las 6 completas en `es.json` bajo `faq.*` — y las mismas llaves existen en `en/fr/it/pt.json`, así que el
`FAQPage` se puede generar por locale sin traducir nada de más.)

`sitioWeb()` en `entidad.ts` no tiene `potentialAction`. **Antes de agregar `SearchAction`: no existe
ninguna página de resultados de búsqueda pública en el sitio** (`grep -r "buscar\|search" src/pages` solo
devuelve endpoints internos del CRM bajo `/api/crm/*`). Declarar un `SearchAction` que apunte a una URL
que no resuelve resultados reales es justo el tipo de marcado engañoso que el punto 5 pide evitar — no
proponer el JSON-LD hasta que exista un `/buscar?q={term}` real, o omitirlo.

---

## 2. `sameAs` — qué es real y qué no

`PERFILES` está vacío. Auditando el repo y verificando en vivo:

- **LinkedIn — confirmado real**: `https://www.linkedin.com/company/sacscloud` — página de empresa activa,
  1,283 seguidores, "Sacscloud.com", Cancún, fundada 2010. Referenciada también en
  `src/pages/api/email-templates/seed.ts:434`.
- **YouTube — canal real pero sin verificar actividad**: `src/pages/api/yt/oauth.ts` documenta un flujo
  OAuth completo para administrar **el canal @sacscloud como cuenta de marca** (código funcionando, ya en
  uso). El fetch en vivo confirma que `youtube.com/@sacscloud` existe (título de página "Sacscloud -
  YouTube") pero no pude leer suscriptores/videos desde aquí. Recomendación: confirmar con el dueño que
  el canal tiene contenido antes de publicarlo en `sameAs` — un canal de marca vacío tampoco ayuda.
- **Instagram, Facebook, TikTok (`@sacscloud`)**: aparecen como URLs reales en la plantilla de email
  `src/pages/api/email-templates/seed.ts:416-434` y en `src/lib/email/footer.ts` (que sí soporta un
  `tiktok_url` por tenant). No pude confirmarlos por fetch (Instagram/Facebook devuelven la pantalla de
  login a un fetch anónimo, TikTok solo el slogan genérico) — **no es evidencia de que NO existan, solo
  de que no se pueden verificar así**. No los propongo en `sameAs` sin que alguien con sesión los abra y
  confirme que están activos y que el handle es el correcto.

```json
{
  "sameAs": [
    "https://www.linkedin.com/company/sacscloud"
  ]
}
```
Agregar YouTube/Instagram/Facebook/TikTok a este arreglo en `entidad.ts` (`PERFILES`) en cuanto se
confirme cada uno a mano — el archivo ya está preparado para eso (`...(PERFILES.length ? {sameAs...} : {})`).

---

## 3. Por tipo de página

### 3.1 `/producto/[slug]` y `/producto/tienda-en-linea` (28 páginas de función) — CERO schema propio

Usan `ProductLayout.astro`, que solo reenvía `title/description/noindex/preloadImage` a `BaseLayout` —
**nunca pasa `structuredData`**. Cada página de función (ej. `/producto/traspasos-entre-sucursales`) solo
lleva el `Organization`+`SoftwareApplication` genérico de `SCHEMA_BASE()`. No hay `SoftwareApplication`
por función con su propio `featureList`, ni `BreadcrumbList` (pilar → función), a pesar de que
`getPillarForFeature` ya calcula esa jerarquía en tiempo de build.

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://www.sacscloud.com/producto/traspasos-entre-sucursales#app",
  "name": "Sacs — Traspasos y nivelación entre sucursales",
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "Retail Management Software",
  "operatingSystem": "Web",
  "isPartOf": { "@id": "https://www.sacscloud.com/#software" },
  "featureList": ["<sacar de feature.description / content de product-pages.ts>"]
}
```

### 3.2 `/soluciones/boutique.astro` y `/soluciones/cadena.astro`

Usan `BaseLayout` directo, sin `structuredData` (grep confirma que ninguna de las dos pasa la prop). Son
candidatas obvias a `SoftwareApplication` con `audience` distinto de las genéricas y `BreadcrumbList`.

### 3.3 `/giros/*` (23 páginas de oficio: zapatería, joyería, novias, uniformes, etc.)

Ninguna pasa `structuredData` (verificado en `zapateria.astro`, `joyeria.astro`, `marcas-de-ropa.astro`).
Solo `/giros/index.astro` tiene un `ItemList` de las 23. El tipo correcto para "software para tiendas de
zapatos" NO es otro `SoftwareApplication` genérico repetido 23 veces (canibaliza la entidad principal) —
es **`Service`** (con `serviceType` = el giro y `provider: {'@id': ENTIDAD_ID}`), más `BreadcrumbList`.

```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "https://www.sacscloud.com/giros/zapateria#servicio",
  "serviceType": "Software para zapaterías",
  "provider": { "@id": "https://www.sacscloud.com/#organizacion" },
  "areaServed": { "@type": "Country", "name": "MX" },
  "audience": { "@type": "BusinessAudience", "audienceType": "Zapaterías" },
  "url": "https://www.sacscloud.com/giros/zapateria"
}
```
Estas páginas NO tienen sección de preguntas frecuentes hoy (confirmé en `zapateria.astro` y `joyeria.astro`:
cero ocurrencias de "Preguntas frecuentes"/FAQ) — no hay nada que marcar como `FAQPage` todavía; sería
contenido nuevo, fuera del alcance de esta auditoría.

### 3.4 `/blog/[...slug]` — el `BlogPosting` existe pero es INCONSISTENTE con el resto del sitio

`src/layouts/BlogLayout.astro` sí emite `BlogPosting` + `BreadcrumbList` (el único lugar del sitio con
BreadcrumbList). Pero comparado con el patrón bueno de `publicar.ts` (sección 0), le faltan piezas y
repite el error de identidad que `entidad.ts` ya había corregido en el resto del sitio:

- **`publisher: {'@type': 'Organization', name: 'SACS', url: SITIO}`** — Organization inline, NO referencia
  `{'@id': ENTIDAD_ID}`. Un rastreador ve DOS organizaciones distintas de Sacs en el sitio: una completa
  con `alternateName`/`logo`/`knowsAbout` (home, planes, etc.) y otra pelona llamada literalmente "SACS"
  (blog). Es la clase de inconsistencia de entidad que el punto 5 pide evitar.
- **`author` por defecto es `{'@type': 'Person', name: 'SACS'}`** cuando el post no trae autor —
  "SACS" como *Person* es incoherente (es una organización, no una persona) y además el schema del
  content collection (`src/content.config.ts:11`) sí soporta autores reales: `bershka.md` usa
  `author: "Andrea Araujo"`, `bienvenida.md` usa `"Equipo SACS"`. Regla limpia: si `author` es un nombre
  de persona real → `Person` (idealmente con `url`/`sameAs` a su perfil si existe); si es "Equipo SACS" →
  `Organization` con `{'@id': ENTIDAD_ID}`, nunca `Person`.
- **Falta `dateModified`**: el schema de contenido (`content.config.ts:10`) ya tiene `updatedDate:
  z.coerce.date().optional()`, pero `BlogLayout.astro` (interfaz `Props`, línea 6-12) **ni siquiera
  acepta `updatedDate`** como prop, y `blog/[...slug].astro` no se la pasa. Google pide `datePublished` o
  `dateModified` en `Article`/`BlogPosting` para elegibilidad de rich results con fecha.
- **Falta `mainEntityOfPage`** y `@id`.

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "@id": "https://www.sacscloud.com/blog/bershka#articulo",
  "mainEntityOfPage": "https://www.sacscloud.com/blog/bershka",
  "headline": "...",
  "datePublished": "2026-...",
  "dateModified": "2026-...",
  "author": { "@type": "Person", "name": "Andrea Araujo" },
  "publisher": { "@id": "https://www.sacscloud.com/#organizacion" }
}
```
Solo hay 3 posts hoy (`src/content/blog/*.md`), así que el arreglo es barato.

### 3.5 `/casos-de-exito/*` — sin schema, y un riesgo de contenido debajo

4 páginas (`liveshow`, `casa-maca`, `sandmade`, `la-bella-pandita`) + índice: **ninguna pasa
`structuredData`**. El tipo correcto es `Article` (no hay `CaseStudy` en schema.org) con
`about: {'@id': PRODUCTO_ID}`.

Sobre `Review`/`AggregateRating` — auditando las 4 citas textuales:

| Página | Cita atribuida a | ¿Marcable como `Review` de un cliente real? |
|---|---|---|
| `liveshow.astro` | **Mariana López, Directora de Operaciones** (Liveshow Merchandising) | Sí — nombre y cargo reales, cliente real |
| `sandmade.astro` | "Equipo Sandmade" | Débil — sin nombre de persona, pero atribuible a la organización cliente |
| `la-bella-pandita.astro` | "Equipo La Bella Pandita" | Débil, mismo caso |
| `casa-maca.astro` | **Andrea Araujo, CGO Sacscloud** | **No** — es personal de Sacs, no del cliente; ver riesgo 5.1 |

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Cómo Liveshow Merchandising evita perder ventas en conciertos con 100+ puntos de venta",
  "about": { "@id": "https://www.sacscloud.com/#software" },
  "author": { "@id": "https://www.sacscloud.com/#organizacion" },
  "review": {
    "@type": "Review",
    "reviewBody": "En un concierto llegamos a perder el 20% de nuestras ventas en solo dos horas porque el sistema cayó.",
    "author": { "@type": "Person", "name": "Mariana López", "jobTitle": "Directora de Operaciones", "worksFor": { "@type": "Organization", "name": "Liveshow Merchandising" } },
    "itemReviewed": { "@id": "https://www.sacscloud.com/#software" }
  }
}
```
**No propongo `AggregateRating` en ningún caso**: no hay un número de reseñas verificable ni una
calificación numérica real detrás de estas 4 páginas — inventar un promedio de estrellas sobre 4 casos de
estudio (que ni siquiera son reseñas, son historias escritas por Sacs) es exactamente el marcado que
Google penaliza como engañoso (ver Reseñas/AggregateRating en su política de spam de datos estructurados).

### 3.6 `/comparar/*` — qué se puede marcar sin riesgo

Ya usan `Article` vía el motor de demanda (`leerPublicado` + `publicar.ts`, sección 0) — correcto y ya
vivo. Comparan a Sacs contra Shopify POS, SICAR, Sizes and Colors (según `comparar/index.astro:46`). Lo
que SÍ se puede agregar sin riesgo: `BreadcrumbList` (falta, como en todo el sitio) y, donde el cuerpo ya
trae una tabla de features lado a lado, un bloque `FAQPage` si el contenido trae preguntas — eso ya lo
resuelve `schemaDeCuerpo`. **Lo que NO se debe marcar**: cualquier cosa que dé a entender que es una
`Review`/comparación de terceros verificada (`Review` de Shopify o SICAR) — es contenido propio de Sacs
comparándose, no una reseña independiente.

---

## 4. GEO — qué le falta al sitio para que un modelo lo cite

- **`/llms.txt`: no existe** (`find . -iname "llms*.txt"` → vacío). El propio plan del motor de demanda ya
  lo tiene contemplado (`PLAN-DEMAND-ENGINE.md:215`: "`llms.txt` dinámico desde `de_paginas` + `de_contenido`")
  pero no está implementado. Es de las piezas de más bajo costo / más alto impacto de GEO que quedan: un
  endpoint que liste, en texto plano, qué es Sacs, el índice de páginas reales (`/producto/*`, `/giros/*`,
  `/recursos/*`, `/planes`) y — cuando se publique — el `/indice-moda-mexico` como fuente de cifras.
- **Robots de IA: ya resuelto.** `public/robots.txt` ya permite GPTBot, anthropic-ai, ClaudeBot,
  PerplexityBot y Google-Extended explícitamente.
- **Páginas de definición ("qué es la curva de tallas", "qué es sell-through")**: el motor de demanda ya
  tiene la infraestructura para generarlas (`src/lib/demanda/herramientas/curva.ts` calcula curva de
  tallas de verdad; `entidad.ts` ya declara "curva de tallas" y "sell-through" en `knowsAbout`) y las
  secciones `/recursos/*` y `/software-para/*` viven en Supabase (`de_contenido`), no en el repo — no pude
  verificar desde el código si ya existen piezas publicadas con esos títulos exactos. Recomendación:
  confirmarlo consultando `de_contenido` directamente (o pedirle al dueño/operador del motor), no asumir.
- **Datos citables con cifra y fecha**: existe exactamente uno, `/indice-moda-mexico` (`Dataset`, sección
  0), y está apagado a propósito. Es la pieza de mayor apalancamiento de todo el sitio para GEO — la nota
  del propio archivo lo dice: *"de todo lo que este motor puede hacer para que una IA nos cite, esto es lo
  único que ningún competidor puede copiar"*. No hay nada más que auditar aquí salvo: cuando se publique,
  cambiar `creator`/`publisher` de `{'@type':'Organization', name:'Sacs', url: SITIO}` (inline) a
  `{'@id': ENTIDAD_ID}` para no repetir el mismo error de identidad partida que el blog (sección 3.4).
- **Consistencia del nombre/descripción/cifras — una grieta encontrada**: `src/components/SEO.astro`
  documenta explícitamente la regla ("Sacs" en lo que lee la gente, "Sacscloud"/"SACS" solo en datos
  estructurados para desambiguar) pero la rompe en la misma línea: `<meta property="og:site_name"
  content="SACS" />` (mayúsculas, no "Sacs"). El mismo patrón se repite en `BlogLayout.astro`
  (`publisher.name: 'SACS'`). Google/los LLM leen `og:site_name` como señal de nombre de sitio — tener
  "Sacs" en `<title>`/JSON-LD y "SACS" en Open Graph es la inconsistencia de superficie que el punto 4 de
  esta auditoría pide vigilar. Arreglo: `og:site_name` → `Sacs`.

---

## 5. Riesgos — marcado que Google podría considerar engañoso

1. **La cita de "casa-maca.astro" (sección 3.5)**: está escrita con el mismo componente `<blockquote
   class="cs-quote"><cite>` que las citas de clientes reales, pero es de **Andrea Araujo, CGO de
   Sacscloud** — personal propio, no el cliente. Aunque hoy no hay `Review` en ninguna página, si algún
   futuro cambio marca "todas las citas de casos de éxito" como `Review` de forma automática, esta caería
   ahí como una reseña de cliente inventada. No es un problema de schema hoy, pero es una trampa lista
   para cuando alguien automatice el marcado — señalarlo antes de que pase.
2. **`logo` de la Organization apunta a `og-default.png` (1200×630)**, una imagen de Open Graph, no un
   logo cuadrado. Las guías de Google para el logo de Organization piden una imagen cuadrada (mínimo
   112×112, sin fondo transparente). No es "engañoso" pero sí inválido para el uso que Google le da
   (Knowledge Panel). El repo ya tiene assets cuadrados reales (`public/crm-icon-512.png`, 512×512;
   `public/brand/sacs-icon-*.svg`) — usar uno de esos, o generar un `/logo.png` dedicado.
3. **Dos tablas de precios distintas alimentan datos estructurados distintos**: `entidad.ts` calcula
   `desde = Math.min(...PLANES.map(p => p.anualMes))` de `src/lib/crm/ti/conocimiento/planes.ts` (la ficha
   que usa el agente comercial/IA), mientras que la página `/planes` que un humano ve usa
   `src/data/plans.ts` (`plans[].annual.mxn`). Si alguna vez divergen, el `Offer` del `SoftwareApplication`
   global (visible en TODAS las páginas) diría un precio y `/planes` otro — inconsistencia de precio es
   justo lo que Google Merchant/rich results marcan como riesgo de desajuste dato-estructurado-vs-página.
   No pude confirmar si hoy coinciden (no crucé los dos archivos número por número) — vale la pena que
   quien mantenga precios verifique que sigan sincronizados o unifique la fuente.
4. **`SearchAction` — no proponerlo todavía** (ya cubierto en 1.3): no existe página de resultados de
   búsqueda pública en el sitio; declarar la acción sin un target real que devuelva resultados es
   marcado que no cumple lo que promete.
5. **`sameAs` de redes que no pude verificar en vivo** (Instagram/Facebook/TikTok, sección 2): existen
   como URLs en plantillas internas de correo, pero un fetch anónimo no confirma que la cuenta está activa
   ni que el handle es correcto. Publicarlas en `sameAs` sin que alguien las abra a mano y confirme
   corre el mismo riesgo que ya evitó `entidad.ts` con el dominio muerto `sacs.com.mx`: una ficha de
   identidad que apunta a algo que no existe o no es lo que dice ser.

---

## Resumen de archivos tocados en esta auditoría (ninguno editado)

- `src/data/entidad.ts`, `src/components/StructuredData.astro`, `src/layouts/BaseLayout.astro`
- `src/pages/planes.astro`, `src/pages/index.astro`, `src/data/plans.ts`
- `src/layouts/ProductLayout.astro`, `src/pages/producto/[slug].astro`, `src/pages/producto/index.astro`
- `src/pages/soluciones/boutique.astro`, `src/pages/soluciones/cadena.astro`
- `src/pages/giros/*.astro` (23 páginas), `src/pages/giros/index.astro`
- `src/layouts/BlogLayout.astro`, `src/pages/blog/[...slug].astro`, `src/content.config.ts`, `src/content/blog/*.md`
- `src/pages/casos-de-exito/*.astro`
- `src/pages/comparar/*.astro`, `src/pages/recursos/*.astro`, `src/pages/software-para/[slug].astro`,
  `src/lib/demanda/publicar.ts`, `src/lib/demanda/bloques.ts`
- `src/pages/herramientas/*.astro`, `src/pages/indice-moda-mexico.astro`, `src/pages/enterprise.astro`
- `src/components/SEO.astro`, `src/components/FAQAccordion.astro`, `src/i18n/translations/es.json`
- `src/data/navigation.ts`, `public/robots.txt`, `PLAN-DEMAND-ENGINE.md`
- `src/pages/api/email-templates/seed.ts`, `src/lib/email/footer.ts`, `src/pages/api/yt/oauth.ts`
  (evidencia de perfiles sociales)
