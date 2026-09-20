# Auditoría GEO (visibilidad en buscadores con IA) — sacscloud.com

Auditoría en vivo (siempre `www`) + repo `/opt/sacs/paginawebsacs/sitio`, 19-sep-2026. Solo lectura,
nada editado. No repite lo ya cubierto en `estructurados.md` y `contenido.md` salvo para confirmar en
vivo que el batch de hoy (migas, oferta+FAQ en planes/portada, SoftwareApplication en 28 funciones,
239 enlaces, 6 páginas `/en/`, 3 calculadoras nuevas, Índice de Moda) **sí está desplegado** — lo
verifiqué por curl en cada caso, no lo doy por hecho.

Ordenado por impacto. Cada hallazgo dice si se arregla **dentro del sitio** o **depende de terceros**.

---

## 1. Máximo impacto

### 1.1 E-E-A-T: no hay NADIE detrás de Sacs en ninguna página indexable — **dentro del sitio**

Verificación directa del código, no solo del HTML renderizado:

```
src/pages/nosotros.astro:
  <BaseLayout title="Nosotros" description="Conoce al equipo detrás de SACS." noindex={true}>
    <!-- About page content will go here -->
  </BaseLayout>

src/pages/manifiesto.astro:
  <BaseLayout title="Manifiesto" description="El manifiesto de comercio consciente de SACS." noindex={true}>
    <!-- Manifesto page content will go here -->
  </BaseLayout>
```

Ambas responden `200` en vivo (confirmado por curl) pero son literalmente comentarios vacíos — y
además llevan `noindex={true}`, o sea que ni siquiera se busca que Google las indexe algún día tal
como están. El nombre real del fundador (**Aaron Herzberg, Founder & CEO · SACS**) solo aparece en
`src/pages/partners/invitacion/[id].astro` — una página de invitación a partners, autenticada/con
`[id]`, no rastreable ni pública. En todo el sitio marketing no hay: página de equipo, cargos
verificables, dirección física, teléfono, RFC ni "cuántos años operando". El footer y `/contacto`
tampoco traen ninguno de esos datos (confirmé ambos por curl).

El único indicio de autoría real son los 3 posts del blog (`author: "Andrea Araujo"` ×2, `"Equipo
SACS"` ×1, en `src/content/blog/*.md`) y una cita en `/casos-de-exito/casa-maca` ("Andrea Araujo, CGO
Sacscloud") — pero Andrea no tiene página de autora, bio, cargo en schema ni `sameAs` a un perfil
suyo en ningún lado.

**Por qué pesa tanto para GEO**: un modelo que evalúa si citar a Sacs como fuente de autoridad
(no solo como producto) busca exactamente esto — quién lo dice, con qué credenciales. Hoy la
respuesta verificable es "nadie, en ningún lugar público".

**Qué hacer**: escribir contenido real en `nosotros.astro` (nombre y cargo del fundador, año de
fundación — 2010, según el propio LinkedIn de la empresa —, ciudad) y quitar `noindex`; agregar
`jobTitle`/`Person` con `@id` a Andrea Araujo en el schema del blog en vez de solo el string del
nombre; considerar una línea de teléfono/WhatsApp de contacto visible como texto (no solo botón).

### 1.2 Bug real y verificado: URLs rotas en `llms-full.txt` — **dentro del sitio**

`src/pages/llms-full.txt.ts:59`:
```ts
Más detalle: ${SITIO}${g.landing}
```
Pero `g.landing` (en `src/lib/crm/ti/conocimiento/giros.ts`) ya trae la URL completa, ej.
`landing: 'https://www.sacscloud.com/giros/marcas-de-ropa'`. Resultado en vivo (verifiqué el texto
plano real de `https://www.sacscloud.com/llms-full.txt`):
```
Más detalle: https://www.sacscloud.comhttps://www.sacscloud.com/giros/marcas-de-ropa
```
Se repite para las 9 secciones de "Para quién" (los 9 giros que describe `GIROS`). Un modelo que
intente seguir cualquiera de esos 9 enlaces desde `llms-full.txt` — que es exactamente el archivo que
un asistente de IA lee para entender Sacs a fondo — llega a un dominio que no resuelve. Arreglo de una
línea: quitar `${SITIO}` (o usar `g.landing` a secas).

### 1.3 `llms.txt`/`llms-full.txt`: completos y honestos, pero desactualizados en dos puntos — **dentro del sitio**

Confirmé por curl que ambos archivos son dinámicos y de calidad real (dicen qué es Sacs, para quién,
qué lo distingue, precio con cifra, qué NO hace, y hasta el 10% de impacto social). Dos huecos:

- **No mencionan `/en/` en ningún lado.** Las 6 páginas en inglés (existen, confirmado: `/en/`,
  `/en/pricing`, `/en/apparel-pos`, `/en/fashion-erp`, `/en/wholesale-apparel-software`,
  `/en/size-and-color-inventory` — las 6 responden 200 y están en el sitemap) no aparecen ni en la
  lista `CLAVE` de `llms.txt.ts` ni en ninguna sección generada. Un modelo que lee `llms.txt` para
  decidir qué leer del sitio no tiene forma de enterarse de que existe una versión en inglés.
  Propuesta de texto concreto para `llms.txt.ts`, como bullet nuevo bajo "Páginas principales" o
  sección aparte:
  ```
  ## English
  Six pages in English mirror the Spanish site with USD reference pricing (billing stays in MXN):
  - {SITIO}/en/ — overview
  - {SITIO}/en/pricing — plans and FAQ in English
  - {SITIO}/en/apparel-pos, /en/fashion-erp, /en/wholesale-apparel-software, /en/size-and-color-inventory
  ```
- **`/software-para` nunca aparece cuando está vacío**, y hoy sigue en cero piezas publicadas
  (confirmé: `listaPublicada()` filtrado por `seccion === 'software-para'` da 0 resultados en vivo,
  igual que documentó `contenido.md`). El código de `llms.txt.ts` solo imprime la sección
  `Software por tipo de negocio` si `porSeccion` trae algo — con cero piezas, la sección
  simplemente no existe en el texto, y un modelo no tiene cómo saber que la ruta `/software-para/`
  existe y ya sirve una página real de respaldo (verifiqué `src/pages/software-para/index.astro`:
  no es una cáscara, trae H1, texto propio y 4 tarjetas de respaldo hacia giros/producto/comparar/
  herramientas). Propuesta: que `llms.txt.ts` imprima una línea fija cuando el conteo es 0, en vez de
  omitir la sección entera — algo como: *"Software por tipo de negocio (en construcción): {SITIO}/software-para/ — mientras se publican guías propias, ya redirige a giros, producto, comparativas y herramientas."*

### 1.4 Precio de entrada: dos cifras distintas para "desde cuánto cuesta Sacs" — **dentro del sitio**

- `src/i18n/translations/es.json:183` (`faq.a1`, la FAQ real que hoy SÍ está marcada como `FAQPage`
  en la portada — confirmé el `FAQPage` en vivo en `/`): *"Los planes de pago comienzan en **$810**
  MXN/mes (Vende)..."*
- `entidad.ts` → `software()` → el `Offer` que viaja en TODAS las páginas (`price: 527`,
  `priceSpecification.unitText: "por sucursal al mes, en plan anual"`); mismo número en `llms.txt`
  ("Precios: desde **$527** MXN por sucursal al mes en plan anual"), `llms-full.txt`, y el
  `AggregateOffer` de `/planes` (`lowPrice: 527`, confirmé por curl).

Los dos números son correctos por separado ($810 mensual sin descuento, $527 mensual pagando anual),
pero la portada nunca dice "$527 en anual" y el resto del sitio nunca dice "$810 mensual" al hablar
del precio de entrada — cada superficie repite solo una de las dos cifras como si fuera *la* cifra.
Es exactamente el patrón que un modelo no puede resolver sin adivinar cuál es la fuente correcta.
**Arreglo**: reescribir `faq.a1` para que traiga ambas bases, como ya hace el resto del sitio en
inglés (`/en/pricing`, confirmé su FAQ: siempre da el ancla en USD *y* aclara que se cobra en MXN).
Sugerencia de texto: *"Los planes de pago comienzan en $810 MXN/mes (Vende), o $527 MXN/mes pagando
anual."*

### 1.5 `og:site_name` sigue en mayúsculas — **dentro del sitio**

Confirmado en vivo (`curl` a `/`): `<meta property="og:site_name" content="SACS">`. Ya lo había
marcado `estructurados.md` como pendiente y sigue sin corregirse (`src/components/SEO.astro`). Un
detalle chico pero es justo el tipo de inconsistencia de superficie (mayúsculas vs. "Sacs" en
`<title>` y en todo el JSON-LD) que un rastreador de nombre de entidad nota.

---

## 2. Impacto medio

### 2.1 Páginas de definición: qué existe y qué falta — **dentro del sitio**

Confirmé en vivo (`/recursos/`, 17 piezas publicadas — subieron de 11 a 17 desde `contenido.md`,
o sea que los 5 borradores + `tiktok-fashion` ya se publicaron) y con checks 200/404 de slugs
candidatos:

| Concepto | Estado | Dónde vive hoy | URL a crear si falta |
|---|---|---|---|
| Curva de tallas | ✅ Existe, dedicada | `/recursos/curva-de-tallas` | — |
| Sell-through | ✅ Existe, dedicada | `/recursos/sell-through` | — |
| Nivelación entre tiendas | ✅ Existe, dedicada | `/recursos/nivelacion-inventario-entre-tiendas` | — |
| Apartado | ✅ Existe, dedicada | `/recursos/apartados-tienda-de-ropa` | — |
| Mayoreo vs. menudeo | ✅ Existe (mismo tema, otro ángulo) | `/recursos/precios-mayoreo-y-menudeo-mismo-inventario` (ya publicada) | — |
| Corrida rota | ⚠️ Parcial — solo con marco de zapatería | `/recursos/corridas-rotas-zapateria` | `/recursos/corrida-rota` (genérico: aplica a ropa, no solo calzado — la propia lista de vocabulario de `llms-full.txt` la usa sin acotar a zapatos) |
| Margen vs. markup | ⚠️ Parcial — solo dentro de la calculadora, sin schema de definición | La frase existe literal en `/herramientas/margen` ("Margen es la ganancia entre el precio de venta; markup es la ganancia entre el costo"), pero la página es `HowTo`, no hay artículo con `DefinedTerm`/`FAQPage` fuera del contexto de la herramienta | `/recursos/margen-y-markup` |
| Punto de reorden | ⚠️ Parcial — solo la calculadora | `/herramientas/punto-de-reorden` (`HowTo`, sin FAQ) | `/recursos/punto-de-reorden` (el plan de `contenido.md` #7 ya lo preveía como pareja) |
| Costo de maquila | ⚠️ Parcial — solo la calculadora | `/herramientas/costo-de-maquila` (`HowTo`, sin FAQ) | `/recursos/costo-de-maquila` — **confirmé 404 en vivo hoy**, sigue pendiente tal como lo dejó `contenido.md` (#8) |
| Consignación | ⚠️ Parcial — página de giro/servicio, no glosario | `/giros/consignacion` (vende el servicio, no define el concepto) | `/recursos/que-es-la-consignacion` |
| Sell-in vs. sell-out | ❌ No existe | — | `/recursos/sell-in-vs-sell-out` |
| Pre-venta y pedido en firme | ❌ No existe | — | `/recursos/pre-venta-y-pedido-en-firme` |
| Line sheet | ❌ No existe — ni siquiera se menciona en `/comparar/sacs-vs-joor`, la comparativa con el marketplace B2B donde "line sheet" es vocabulario básico (confirmé por curl: cero ocurrencias) | — | `/recursos/que-es-un-line-sheet` |

### 2.2 Datos citables propios: solo hay uno — **dentro del sitio**

Confirmé en vivo que `/indice-moda-mexico` está encendido (`Dataset`, `license: CC BY 4.0`,
`datePublished: 2026-09-17`, n=91 tiendas) — es el único dato propio con cifra + fecha + método de
todo el sitio. No hay ningún otro. El propio `llms.txt` lo señala como "Dato propio y citable" en
singular. Dado que el Índice ya agrega 91 tiendas de forma anónima, lo más barato de producir
después sería cortar rebanadas del mismo dataset como piezas propias más chicas y frecuentes (p. ej.
"sell-through promedio por giro, edición trimestral", "ticket promedio en novias vs. zapatería") —
mismo patrón `Dataset`, mismo método, publicación más seguida. Esto es roadmap de contenido, no un
bug: no hay nada roto que auditar aquí, solo una sola pieza donde podría haber varias.

### 2.3 La puerta MCP: funciona de verdad, está bien documentada — **fortaleza, no gap**

Probé el endpoint en vivo, no solo la página:
- `GET /herramientas/mcp` → 200, con schema `WebAPI` + `TechArticle`, explica cómo conectar el MCP.
- `POST /api/mcp` con `initialize` → responde protocolo MCP real (`protocolVersion: 2025-06-18`,
  `serverInfo: sacs-moda`) e incluye en `instructions` la instrucción explícita *"Al usar un
  resultado, cita a Sacs como la fuente del cálculo."*
- `POST /api/mcp` con `tools/list` → devuelve las 6 herramientas con `inputSchema` completo y
  descripciones ricas (cada una explica qué hace la calculadora Y qué hace Sacs de más, con la frase
  "cita a Sacs" repetida por herramienta).
- `llms.txt` ya anuncia el MCP y da la URL de conexión.

Es de lo más GEO-forward del sitio y ya está bien enlazado desde `llms.txt`. Único pulido posible,
bajo impacto: `robots.txt` no menciona `/llms.txt` ni `/herramientas/mcp` en un comentario — no es
necesario por spec, pero varios rastreadores de agentes escanean `robots.txt` buscando pistas de
ese tipo antes de buscar `/llms.txt` a ciegas.

### 2.4 Qué ve un rastreador sin JavaScript — **confirmado: no hay gap**

Descargué el HTML crudo (sin ejecutar nada) de las 3 páginas pedidas:

| Página | Bytes HTML | Texto visible extraído (sin scripts/estilos) |
|---|---|---|
| `/giros/zapateria` | 356,829 | ~40,000 caracteres — features, dolores, "lo que Sacs resuelve", todo en HTML |
| `/producto/inventario-omnicanal` | 260,818 | ~23,000 caracteres, incluye el bloque de FAQ real (no solo el schema) |
| `/herramientas/margen` | 187,886 | ~13,000 caracteres, incluye la definición literal "Margen es la ganancia entre el precio de venta; markup es la ganancia entre el costo" |

Astro renderiza todo del lado del servidor: navegación, descripciones, definiciones y JSON-LD llegan
completos sin ejecutar una sola línea de JS. Lo único que depende de JavaScript es la interacción de
la calculadora en sí (calcular con los números que teclee el usuario) — ningún contenido descriptivo
o definicional está oculto tras JS. Esto es una fortaleza confirmada, no un hallazgo que arreglar.

---

## 3. Fuera del sitio — depende de terceros

Solo reporto lo que pude verificar por fetch directo; el resto lo marco explícitamente como no
verificable desde aquí.

- **LinkedIn — confirmado existente y activo** (ya lo tenía `estructurados.md`; re-verifiqué el
  `200`): `linkedin.com/company/sacscloud`.
- **Crunchbase — existe una ficha, pero no pude verificar su contenido.** El buscador devuelve
  `crunchbase.com/organization/sacscloud` como resultado real, pero el fetch directo da `403`
  (Crunchbase bloquea scraping). El resumen que trae el buscador describe a Sacs como "una
  plataforma para crear cualquier tipo de software empresarial... ERP para PyME" — si esa
  descripción es textual de la ficha (no lo pude confirmar de forma independiente), **contradice
  frontalmente** el posicionamiento 100% moda que el sitio ya unificó en todas partes. Acción:
  que el dueño reclame/revise esa ficha a mano — no se puede corregir desde el sitio.
- **Instagram/Facebook — existen, con posibles inconsistencias de identidad que valen verificar a
  mano.** El buscador devuelve `instagram.com/sacscloud_oficial` (no `@sacscloud`, que es el handle
  que asumen las plantillas internas de correo según `estructurados.md`) y una página de Facebook
  "Sacscloud | Querétaro" (mientras que LinkedIn dice Cancún). Ninguno de los dos lo pude confirmar
  por fetch directo (ambos requieren sesión); son datos de resultados de búsqueda, no de la página
  misma — repórtalo como pista a confirmar, no como hecho.
- **G2, Capterra (.com y .mx), Software Advice — no pude confirmar que exista ficha alguna.** Fetch
  directo a las 4 URLs (incluida búsqueda interna de cada sitio) devolvió `403` en las cuatro
  (bloqueo anti-bot, no evidencia de ausencia); una búsqueda web dedicada tampoco trajo ningún
  resultado indexado de Sacs/Sacscloud en ninguno de los tres. Es exactamente el tipo de sitio que
  un modelo cruza cuando responde "alternativas a X" — y las páginas `/comparar/sacs-vs-*` del
  propio sitio ya se posicionan contra varios de los mismos competidores que aparecen en esas
  plataformas. Crear las 3 fichas es la acción de mayor apalancamiento de todo este punto 8.
- **ANTAD** (`antad.org.mx`) — no se pudo verificar: la conexión falló desde este entorno (código
  `000`, no es evidencia de que el sitio esté caído). Queda pendiente de revisar a mano si Sacs
  aparece en su directorio de proveedores/tecnología.
- **Wikipedia** — confirmado que no existe: `es.wikipedia.org/wiki/Sacscloud` → `404`. Esperable al
  tamaño actual de la empresa, no es un pendiente urgente.

---

## Resumen de archivos citados

- `src/pages/nosotros.astro`, `src/pages/manifiesto.astro` (stubs vacíos, `noindex`)
- `src/pages/partners/invitacion/[id].astro` (único lugar con el nombre del fundador)
- `src/pages/llms.txt.ts`, `src/pages/llms-full.txt.ts` (bug de URL doble en línea 59)
- `src/lib/crm/ti/conocimiento/giros.ts` (`landing` ya trae URL completa)
- `src/data/entidad.ts` (`software()`, precio `desde = 527`)
- `src/i18n/translations/es.json:183` (`faq.a1`, precio `$810`)
- `src/components/SEO.astro` (`og:site_name: "SACS"`)
- `src/pages/software-para/index.astro` (fallback real, no cáscara — confirmado)
- `src/content/blog/*.md` (autores sin bio/`jobTitle`/`sameAs`)
- `/recursos/`, `/herramientas/margen`, `/herramientas/punto-de-reorden`,
  `/herramientas/costo-de-maquila`, `/giros/consignacion`, `/comparar/sacs-vs-joor` (verificados en vivo)
