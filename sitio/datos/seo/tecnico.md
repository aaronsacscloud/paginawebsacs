# Auditoría SEO técnica — sacscloud.com
Fecha: 2026-09-19 · Alcance: solo lectura, sin ediciones. Repo: /opt/sacs/paginawebsacs/sitio

Convención: cada hallazgo trae archivo(s), línea(s) y la corrección exacta. Ordenado por impacto.

---

## CRÍTICO

### C1. El selector de idioma del Nav manda a 404 en TODO el sitio
El topbar (desktop) y el menú móvil traen banderas 🇲🇽🇺🇸🇫🇷🇮🇹🇧🇷 que enlazan a `/en/...`, `/fr/...`,
`/it/...`, `/pt/...` para la página actual. **No existe ni una sola página construida en esos
prefijos**: no hay `src/pages/en/`, ni `[locale]`, ni middleware que resuelva el prefijo. Astro es
`output: 'static'` sin esas rutas, así que cualquier clic en esas 4 banderas —desde CUALQUIER
página del sitio, porque el Nav es global— cae en un 404 real.

- `src/components/Nav.astro:24` — `const idiomas = getHreflangLinks(...)` calcula los 5 locales.
- `src/components/Nav.astro:42-53` — topbar desktop, dropdown `.nt-lang-menu`, renderiza `<a href={l.href}>` para los 4 idiomas no-español.
- `src/components/Nav.astro:305` — mismo patrón en el menú móvil (`.mm-lang-opt`).
- `src/i18n/config.ts:2` — `locales = ['es','en','fr','it','pt']` sin que existan las páginas.
- Confirmado: `find src/pages -iname "*[locale]*"` y `*[lang]*` no devuelven nada; no hay `src/middleware.ts` con lógica de locale.

**Corrección exacta**: quitar el bloque de banderas del Nav (desktop y móvil) hasta que existan
páginas reales en esos idiomas. Es decir, borrar/comentar `Nav.astro:42-53` y `Nav.astro` líneas
alrededor de 303-307 (el `.map` de `idiomas`), y dejar solo "Iniciar sesión" en el topbar. Si el
plan es sí construir EN/FR/IT/PT, entonces esto no se borra pero se bloquea con un flag hasta que
las páginas existan (`{idiomas.length > 0 && HAY_PAGINAS_LOCALIZADAS && (...)}`).

### C2. `getHreflangLinks()` se calcula pero nunca se imprime — y aun así sería incorrecto emitirlo hoy
`src/layouts/BaseLayout.astro:34` calcula `hreflangLinks` y la variable NUNCA se usa en el resto del
archivo (870 líneas, un solo match de `hreflangLinks`, el de la asignación). Es decir: **el sitio no
emite NINGÚN `<link rel="alternate" hreflang="...">`** en ninguna página. Dado C1 (no existen páginas
en otros idiomas), no emitirlo hoy es lo correcto — emitirlo apuntaría a 404s. Pero es la misma raíz
que C1: hay infraestructura i18n a medias (config, traducciones en `src/i18n/translations/*.json`,
util de hreflang) sin páginas reales detrás. Recomendación: mientras no haya páginas localizadas,
retirar `getHreflangLinks`/`hreflangLinks` de `BaseLayout.astro:34` (código muerto) junto con el
selector de C1, para que quede un solo sitio en español sin promesas de multi-idioma a medias.

### C3. La descripción de `/giros/` promete giros que el negocio decidió retirar
`src/pages/giros/index.astro:42`:
```
description="SACS se configura para tu giro: ropa, zapaterías, joyerías, farmacias, ferreterías, minisúpers y más. Cada giro con sus propias personalizaciones."
```
"farmacias, ferreterías, minisúpers" son justo los giros que el dueño retiró el 18-sep-2026 (ver
`astro.config.mjs`, bloque `redirects`, comentario: "Giros que NO son moda, retirados... el sitio es
Fashion Commerce"). El body de la página ya solo lista los 21 giros de moda (viene de
`businessSectors`, `src/data/navigation.ts`), pero el `<meta description>` que ve Google sigue
vendiendo el giro genérico que se abandonó — contradice la decisión y el posicionamiento
"fashion retail" que es el objetivo de esta auditoría.

**Texto propuesto** (título también genérico, se corrige junto):
```
title: "Giros de moda — Sacs"
description: "Sacs se ajusta a tu giro de moda: ropa, calzado, joyería, novias y fiesta, lencería, uniformes y 15 giros más. Cada uno con su propia configuración."
```
(47 / 149 caracteres — dentro de rango.)

---

## ALTO

### A1. Título de `/blog/` no dice nada
`src/pages/blog/index.astro:11` → `title="Blog"` (queda "Blog | Sacs", 11 caracteres visibles). No
menciona moda, retail ni de qué habla el blog. Es el título más débil de todo el sitio.

**Propuesto**:
```
title: "Blog de retail de moda — Sacs"
description: "Historias, datos y guías de tiendas de ropa, calzado y joyería en México: lo que de verdad mueve el punto de venta, el inventario y las ventas por WhatsApp."
```
(30 / 158 caracteres.) Archivo: `src/pages/blog/index.astro:11-12`.

### A2. Páginas huérfanas — cero enlaces internos, solo alcanzables por URL directa
Verificado con `grep -rl` de cada ruta contra `src/components` + `src/pages` + `src/data`:

- **`/componentes`** (`src/pages/componentes.astro`) — el propio archivo dice en su body "No es una
  página pública" (línea 13), pero no lleva `noindex`, no está en
  `src/data/no-indexables.ts`, y no tiene ningún enlace entrante. Es una biblioteca de referencia de
  desarrollo, indexable y en el sitemap por descuido.
  **Corrección**: agregar `noindex={true}` en `src/pages/componentes.astro` (bloque `<BaseLayout>`,
  línea 7) y añadir `'/componentes'` a `NO_INDEXABLES` en `src/data/no-indexables.ts:16`.
- **`/indice-moda-mexico`** — página con datos propios y schema (`structuredData={schema}` en
  `src/pages/indice-moda-mexico.astro`), pensada como activo citable. Solo aparece en
  `llms.txt.ts` y en su propio `sitemap-demanda.xml.ts`; ningún humano puede llegar por clic desde
  Nav, Footer o cualquier página de contenido.
  **Corrección**: agregar un enlace visible — el candidato natural es el Footer (columna de
  "Recursos"/"Aprende") o una mención en `/planes` o `/` ("Ver el Índice Sacs de Retail de Moda →").
- **`/buddy`** (Programa Padrino) — cero enlaces internos en todo el repo. Es indexable
  (`prerender = true`, sin `noindex`, no está en `NO_INDEXABLES`) y aparece en el sitemap general,
  pero nada del sitio remite tráfico ni PageRank interno hacia ella. Si es una página exclusivamente
  de campaña (compartida por partners), debería llevar `noindex` como `/prueba-gratis`; si se quiere
  que rankee, necesita al menos un enlace desde `/partners` o el Footer.
- **`/recursos/tiktok-fashion`** (`src/pages/recursos/tiktok-fashion.astro`) — página escrita a mano
  (no generada por el motor de demanda), pero `src/pages/recursos/index.astro:68` solo itera sobre
  `g` (contenido dinámico de `listaPublicada()`), no incluye este archivo estático. El único otro
  archivo que la menciona (`src/pages/recursos/[slug].astro:9`) es un comentario, no un link. Cero
  enlaces reales.
  **Corrección**: agregarla a la lista fija de `/recursos/index.astro` o enlazarla desde algún giro
  relacionado (moda + TikTok Shop).

### A3. `/enterprise`, `/soluciones/boutique` y `/soluciones/cadena` son invisibles en desktop
`modelosNegocio` (los 3 "modelos de negocio": boutique / cadena / marca-fabricante) se importa en
`src/components/Nav.astro:2` pero **solo se usa una vez, en la línea 363**, dentro del bloque móvil
(`.mobile-modelos`, dentro del submenú móvil de "Giros de negocio"). No existe render equivalente en
el mega-menú de escritorio (revisado `Nav.astro:1-230`, sin coincidencias). El Footer tampoco los
enlaza (`grep enterprise|soluciones` en `Footer.astro` → sin resultados).

Resultado: en desktop, `/enterprise` solo se alcanza escribiendo la URL, desde `llms.txt.ts`, o desde
el enlace cruzado dentro de `soluciones/cadena.astro`; `/soluciones/boutique` solo desde
`soluciones/cadena.astro`; ninguna de las tres desde la home en escritorio, que es el 90%+ del
tráfico de escritorio de cualquier sitio B2B.

**Corrección**: agregar los 3 `modelosNegocio` al mega-menú de escritorio, por ejemplo como una fila
superior dentro del dropdown de "Giros de negocio" (`Nav.astro`, cerca de la línea 214, antes del
`gw-more`) o como bloque propio en el mega-menú de "Plataforma".

### A4. Marca inconsistente: "SACS" (mayúsculas) en 10 páginas indexables
`src/components/SEO.astro:23-31` documenta explícitamente la regla: *"La marca se escribe «Sacs», no
«SACS»"*. Sin embargo estas páginas indexables (no admin/partner/app) siguen usando "SACS" en
`title`/`description`:

| Archivo | Línea |
|---|---|
| `src/pages/privacidad.astro` | 4 (title y description) |
| `src/pages/terminos.astro` | 4 (title y description) |
| `src/pages/componentes.astro` | 9 (description) — además candidata a noindex, ver A2 |
| `src/pages/giros/index.astro` | 41-42 (title y description) |
| `src/pages/blog/index.astro` | 12 (description) |
| `src/pages/recursos/tiktok-fashion.astro` | 103 (title) |
| `src/pages/casos-de-exito/index.astro` | 82-83 |
| `src/pages/casos-de-exito/casa-maca.astro` | 6 |
| `src/pages/casos-de-exito/sandmade.astro` | 6 |
| `src/pages/casos-de-exito/liveshow.astro` | 6-7 |
| `src/pages/casos-de-exito/la-bella-pandita.astro` | 6 |

**Corrección**: reemplazar "SACS" por "Sacs" en las 11 líneas de arriba. Ejemplos:
- `privacidad.astro`: `title="Aviso de privacidad — Sacs"` (baja "Aviso de Privacidad | SACS" que
  además usa mayúscula inicial en cada palabra, poco natural en español).
- `terminos.astro`: `title="Términos y condiciones — Sacs"`.
- `casos-de-exito/index.astro`: `title="Casos de éxito — Retailers de moda que crecen con Sacs"`
  (de paso agrega "de moda", ver A5) y `description="Descubre cómo tiendas y marcas de moda
  mexicanas transforman su operación con Sacs. Desde 1 tienda hasta 42 sucursales."`

### A5. Títulos fuera de rango (< 30 caracteres) que no dicen "de qué es" el sistema
Calculado sobre el `<title>` REAL que ve Google (con el sufijo `| Sacs` que agrega
`src/components/SEO.astro:31` cuando el título no menciona ya "sacs"):

| Título final | Long. | Archivo:línea |
|---|---|---|
| "Agenda una demo \| Sacs" | 22 | `src/pages/contacto.astro:4` |
| "Aviso de Privacidad \| SACS" | 26 | `src/pages/privacidad.astro:4` |
| "Términos y Condiciones \| SACS" | 29 | `src/pages/terminos.astro:4` |
| "Todo lo que hace Sacs" | 21 | `src/pages/producto/index.astro:21` |
| "Giros de negocio — SACS" | 23 | `src/pages/giros/index.astro:41` |
| "Suite para Joyerías \| Sacs" | 26 | `src/pages/giros/joyeria.astro:39` |
| "Suite para Papelerías \| Sacs" | 28 | `src/pages/giros/papeleria-y-arte.astro:41` |
| "Suite para Zapaterías \| Sacs" | 28 | `src/pages/giros/zapateria.astro:37` |
| "Sistema para ópticas — Sacs" | 27 | `src/pages/giros/opticas.astro` |

Ninguno es incorrecto por sí solo, pero tres de ellos (joyería, papelería, zapatería) desaprovechan
espacio de SERP sin aportar la palabra "moda"/"tiendas de" que sí llevan sus pares
("Sistema para zapaterías" en vez de "Suite para Zapaterías" — ver A6, es el mismo problema de raíz).

**Propuesto**:
- `giros/joyeria.astro:39` → `const titulo = 'Sistema para joyerías — Sacs';` (28 caract. en título final)
- `giros/papeleria-y-arte.astro:41` → `const titulo = 'Sistema para papelerías y tiendas de arte — Sacs';`
- `giros/zapateria.astro:37` → `const titulo = 'Sistema para zapaterías — Sacs';`
- `producto/index.astro:21` → `title="Todo lo que hace Sacs para tiendas de moda"` (35 caract.)
- `contacto.astro:4` → `title="Agenda una demo con Sacs para tu tienda de moda"` (mejor intención de búsqueda, 38 caract.)

### A6. Dos patrones de título distintos y sin criterio dentro de `/giros/*`
8 de las 21 páginas de giro arman el título con un patrón ("Suite Moda para X" / "Suite para X") y
las otras 13 con otro ("Sistema para X — Sacs"):

- Patrón "Suite": `activewear.astro:27`, `boutique-multimarca.astro:30`, `consignacion.astro:31`,
  `joyeria.astro:39`, `marcas-de-ropa.astro:30`, `merchandising-eventos.astro:30`,
  `papeleria-y-arte.astro:41`, `zapateria.astro:37`.
- Patrón "Sistema": el resto (`bolsas-y-accesorios.astro`, `emprendedoras.astro`, `lenceria.astro`,
  `maternidad.astro`, `opticas.astro`, `outlet.astro`, `renta-de-vestidos.astro`,
  `ropa-infantil.astro`, `sastreria.astro`, `tallas-grandes.astro`, `telas-y-merceria.astro`,
  `trajes-de-bano.astro`, `uniformes.astro`, `western.astro`).

"Sistema para X" es la mejor opción: coincide más con cómo se busca ("sistema para zapatería",
"sistema para tienda de ropa") que "suite", que es más lenguaje de producto que de búsqueda.
**Corrección**: unificar los 8 títulos "Suite" al patrón "Sistema para X — Sacs", cambiando la
constante `titulo` en cada uno de los 8 archivos listados arriba.

---

## MEDIO

### M1. Descripciones fuera de 120-158 caracteres
**Muy cortas (<100, mayor prioridad de arreglo)** — pierden espacio de SERP:

| Archivo | Long. | Texto actual |
|---|---|---|
| `src/data/product.ts:56` (tienda-en-línea, feature) | 74 | "Tu ecommerce conectado al mismo inventario y clientes de tu tienda física." |
| `src/data/product.ts:69` (promociones) | 73 | "Crea promociones avanzadas: 3x2, descuentos por volumen, temporada y más." |
| `src/data/product.ts:269` (portal-de-clientes) | 76 | "Portal personalizado con tu marca para consulta de puntos y autofacturación." |
| `src/data/product.ts:282` (tarjetas-de-regalo) | 72 | "Tarjetas de regalo físicas y digitales canjeables en cualquier sucursal." |
| `src/data/product.ts:408` (orquestador-de-agentes) | 70 | "Conecta Claude, GPT y Gemini para ejecutar tareas complejas en cadena." |
| `src/data/product.ts:95` (social-commerce) | 76 | "Vende en TikTok, Instagram, Facebook y WhatsApp con inventario sincronizado." |
| `src/pages/componentes.astro:9` | 48 | (ver A2, candidata a noindex de todos modos) |

Propuesta para las 3 más flacas (patrón: agregar el "para quién"/"por qué importa"):
```
tienda-en-linea: "Tu ecommerce conectado al mismo inventario y clientes de tu tienda física: lo que vendes en línea baja del mismo stock que el piso, sin duplicar captura."
tarjetas-de-regalo: "Tarjetas de regalo físicas y digitales canjeables en cualquier sucursal de tu tienda de moda, con saldo que se descuenta solo en la caja."
orquestador-de-agentes: "Conecta Claude, GPT y Gemini para ejecutar tareas complejas en cadena: reabasto, pricing y campañas de tu tienda de moda, sin que las armes a mano."
```

**Demasiado largas (>158)**:
- `src/pages/giros/emprendedoras.astro` desc = 160 caracteres.
- `src/pages/giros/maternidad.astro` desc = 160 caracteres.
Recortar 2-3 palabras en ambas (p.ej. quitar "que se liberan solos" → "que se liberan" en
emprendedoras; en maternidad, fusionar "avisos que salen a tiempo y el cruce a lactancia" → "avisos
a tiempo y el cruce a lactancia").

### M2. Contradicción noindex/sitemap dormida en `/producto/[slug]`
`src/pages/producto/[slug].astro:59` — `noindex={feature.status === 'coming-soon'}`. Hoy los 28
features en `src/data/product.ts` están todos en `status: 'live'` (verificado, cero
`'coming-soon'` activos), así que hoy no hay ninguna página noindex+en-sitemap. Pero
`src/data/no-indexables.ts` (la lista que alimenta `enSitemap()`, línea 16) **no tiene ninguna
entrada para `/producto/`**, así que el día que alguien marque un feature como `coming-soon` (el
propio type lo permite: `status: 'live' | 'coming-soon'`), esa página quedará otra vez con
`noindex` en el `<head>` pero visible en el sitemap — exactamente el patrón que el comentario de
`no-indexables.ts:8-10` dice haber corregido en septiembre.
**Corrección preventiva**: en `src/pages/producto/[slug].astro`, filtrar `getStaticPaths()` (línea
16) para no generar página de features `coming-soon`, o agregar a `no-indexables.ts` una regla
dinámica (no es posible con la lista actual basada en substring de URL, porque el slug no lo indica);
la opción robusta es la primera: no publicar la ruta hasta que el feature esté `live`.

### M3. `description={pieza.meta_desc || ''}` puede publicar `<meta description>` vacío
Mismo patrón en tres rutas servidas por el motor de demanda:
- `src/pages/software-para/[slug].astro:26`
- `src/pages/recursos/[slug].astro:26`
- `src/pages/comparar/[slug].astro:26`

Si una pieza publicada no trae `meta_desc`, la página sale con `<meta name="description" content="">`
— Google entonces genera su propio snippet, que suele ser peor que no tener nada curado.
**Corrección**: cambiar el fallback por un valor mínimo garantizado, p.ej.
`description={pieza.meta_desc || pieza.titulo}` o, mejor, que `leerPublicado` rechace piezas sin
`meta_desc` (validación en el motor, no aquí) — pero como parche de defensa en el front sirve el
primero.

### M4. Los 28 `producto/[slug]` no mencionan moda/ropa en el título
Todos siguen el patrón `"{Nombre de la función} — Sacs"` (p.ej. "Punto de Venta — Sacs",
"Inventario Omnicanal — Sacs", fuente: `src/data/product.ts`, campo `title` de cada feature, líneas
42, 55, 68, 81, 94... hasta 420). Es un patrón limpio y no está mal, pero en un sitio posicionado
"fashion retail" pierde la oportunidad de capturar búsquedas tipo "punto de venta para tienda de
ropa". No lo marco como urgente porque son 28 páginas y el cambio de texto de producto es terreno
del equipo de contenido — lo dejo como oportunidad, con 3 ejemplos concretos de los de más tráfico
potencial:
```
punto-de-venta: "Punto de Venta para Tiendas de Ropa — Sacs"
inventario-omnicanal: "Inventario por Talla y Color — Sacs"
tienda-en-linea: "Tienda en Línea para Marcas de Moda — Sacs"
```

---

## BAJO

### B1. Alt text de imágenes: bien en giros, débil en casos de éxito
Contrario a lo que sugería un primer grep (96 coincidencias de `alt=""`), casi todas están en
`src/components/Hero.astro` (mockups decorativos del hero de la home: miniaturas de carrito/catálogo
con el nombre del producto ya visible como texto junto al `<img>`, p.ej. línea 522: "Vestido satén
rosa" en el `<div>` de al lado) — `alt=""` ahí es lo correcto (evita duplicar en lectores de
pantalla), no es un defecto.

Las páginas de giro sí tienen alt descriptivo real, verificado en `src/data/giros/*.ts` (campo
`fotoAlt`), por ejemplo:
- `src/data/giros/western.ts:30`: "Tienda western moderna en León: pared de botas, texanas en el
  anaquel y la corrida por número en la tablet del mostrador."
- `src/data/giros/opticas.ts:43`: "Óptica moderna en México con el muro de armazones iluminado y la
  orden de trabajo en la tablet del mostrador."

Donde sí es débil: `src/pages/casos-de-exito/casa-maca.astro:61-63` — alt genéricos de 2-3 palabras
("Boutique Casa Maca", "Exhibición de ropa Casa Maca", "Prendas Casa Maca") frente al estándar de
los giros. **Corrección**: alinear al mismo nivel de detalle, p.ej. "Interior de la boutique Casa
Maca con racks de ropa organizados por color y muestrario a la vista".

### B2. Nombres de archivo de imagen genéricos (compensado por carpeta + alt)
Los giros usan el patrón `/images/giros/{giro}/portada.webp`, `/images/giros/{giro}/zona-pared.webp`
(`const IMG` en cada `src/data/giros/*.ts`). El nombre de archivo en sí ("portada", "zona-pared") no
dice nada sin la carpeta padre. Es de prioridad baja porque el alt text ya lleva el peso semántico
(B1), pero si se retoca en algún momento, nombrar como
`zapateria-muro-calzado.webp` en vez de `zona-pared.webp` ayuda a búsqueda de imágenes.

### B3. Encabezados: sin evidencia de saltos de nivel en la muestra revisada
Las ~50 páginas indexables revisadas tienen exactamente 1 `<h1>` cada una (mayoría vía componentes
compartidos: `Hero.astro:111`, `GiroBanner.astro:64`, `GiroHero.astro:19`,
`PartnersIntro.astro:26`). Búsqueda de archivos con `<h4>`/`<h5>`/`<h6>` sin ningún `<h2>`/`<h3>` en
el mismo archivo (patrón típico de salto) no encontró ningún caso en `src/components` ni
`src/pages`. No se pudo verificar el ORDEN final en el DOM compuesto (requeriría renderizar, y este
entorno no tiene Node ≥22 para correr `astro build`/`astro dev` — ver nota abajo), así que esto es
una revisión estructural, no un crawl del HTML final.

**Nota técnica**: el servidor tiene Node v20.20.2; `astro dev`/`build` de este proyecto exige Node
≥22.12 (memoria del proyecto), así que no se intentó una build real para no arriesgar un OOM — toda
esta auditoría es estática, sobre el código fuente.

### B4. Redirecciones: limpias
`astro.config.mjs`, bloque `redirects` — 20 entradas, todas de un solo salto (sin cadenas: ninguno
de los destinos —`/enterprise`, `/giros/`— redirige a su vez a otro lado). Verificado que ningún
archivo del repo enlaza internamente a las 18 rutas de giro retiradas
(`belleza-y-cosmetica`, `bicicletas`, `comestibles`, `electronica`, `farmacias`, `ferreterias`,
`florerias`, `franquicias`, `fundas-celulares`, `jugueterias`, `mascotas`, `minisupers`,
`novedades`, `parques-y-atracciones`, `retail-entretenimiento`, `supermercado`, `vinos-y-licores`) ni
a `/marcas`/`/soluciones/marca`. Sin hallazgos.

### B5. robots.txt: correcto
`public/robots.txt` permite explícitamente GPTBot, anthropic-ai, PerplexityBot, Google-Extended y
ClaudeBot, y declara los dos sitemaps (`sitemap-index.xml` del build y `sitemap-demanda.xml` del
motor de demanda, con su propia razón documentada en el comentario del archivo). Sin hallazgos.

### B6. Enlazado interno a giros: sólido
Desde CUALQUIER página, un giro está a 1 clic: el Footer (`src/components/Footer.astro:13-57`)
enlaza los 21 `modaSectors` completos en dos columnas, sitewide; el Nav además muestra 5 en el
mega-menú de escritorio (`TOP_MENU`, `src/data/navigation.ts:732`) y los 21 en el dropdown de
"Giros de negocio" (`sector.href`, `Nav.astro:201-225` desktop, `Nav.astro:339` móvil). Los giros NO
se enlazan entre sí en el cuerpo (ningún `giros/*.astro` tiene un `href="/giros/..."` propio,
dependen del Nav/Footer para el cross-link) ni hacia `/producto/*` salvo el link genérico a
`/planes` que trae `SuiteVariantes`/`SuitePlanes` (`src/components/suite/SuitePlanes.astro:208`).
Es una oportunidad menor (enlaces contextuales "ver también: joyería, bolsas y accesorios" dentro
del cuerpo del giro), no un defecto — el acceso global ya cubre el caso de indexación/PageRank.

---

## Resumen de conteos
- Crítico: 3 (selector de idioma roto sitewide, hreflang código muerto de la misma causa, meta description de /giros/ con giros retirados)
- Alto: 6 (título de blog, 4 páginas huérfanas/semi-huérfanas, 3 páginas invisibles en desktop, marca "SACS" en 10 páginas, 9 títulos <30 car., 2 patrones de título sin criterio en giros)
- Medio: 4 (≈13 descripciones fuera de 120-158, contradicción noindex/sitemap dormida, fallback de description vacío en 3 rutas del motor de demanda, 28 títulos de producto sin "moda")
- Bajo: 6 (alt débil en casos de éxito, nombres de archivo genéricos, encabezados sin hallazgos, redirects limpios, robots.txt correcto, enlazado a giros sólido con oportunidad menor de cross-link)
