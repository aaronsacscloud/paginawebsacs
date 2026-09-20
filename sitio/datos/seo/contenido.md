# Plan de contenido SEO — sacscloud.com (moda)

Auditoría de código + datos reales de producción (tabla `de_contenido` en Supabase,
leída en modo solo-lectura el 19-sep-2026). No se editó ningún archivo.

## 0. Qué hay REALMENTE hoy (no lo que el código sugiere que debería haber)

Dato clave que cambia el diagnóstico: desde el 15-sep-2026 existe un **Sacs
Demand Engine** (`sitio/src/lib/demanda/`) que escribe autónomamente en tres de
las secciones de este plan (`/comparar`, `/recursos`, `/software-para`) directo
a Supabase — esas rutas son `prerender = false` y leen `de_contenido` en cada
visita. Esto NO es contenido "por escribir a mano": ya hay un sistema que
publica ahí solo, con cola, ciclos y auditoría propia. El trabajo de este plan
para esas tres secciones es **decirle al motor qué le falta** (briefs y
prioridad), no escribir markdown.

| Sección | Cómo se sirve | Estado real (Supabase, 19-sep) |
|---|---|---|
| `/giros/[slug]` | Astro estático, a mano | **23 giros de moda** publicados + `/giros` (índice) + `_coming-soon.astro` (placeholder). Ver lista completa en §1b. |
| `/producto/[slug]` | Astro estático, a mano, datos en `src/data/product.ts` | **28 páginas de función** + `/producto` (hub, nuevo, cuenta las funciones) + `/producto/tienda-en-linea` (página aparte, más pesada) |
| `/soluciones/[slug]` | Astro estático | 2: `boutique.astro`, `cadena.astro` (por tamaño de negocio, no por giro) |
| `/comparar/[slug]` | **Motor de demanda** | **17 publicadas**, 0 en borrador. Lista completa en §1c. |
| `/recursos/[slug]` | **Motor de demanda** | **11 publicadas + 5 en borrador** (ya escritas, sin publicar). Lista completa en §1d. |
| `/software-para/[slug]` | **Motor de demanda** | **0 (cero) publicadas.** La ruta existe, el índice no (no hay `/software-para/index.astro`), y no hay ni una pieza en la tabla. Es el hueco más grande del sitio — ver §1a. |
| `/herramientas/[slug]` | Astro + registro en código (`src/lib/demanda/herramientas/`) | **3 calculadoras vivas**: `curva-de-tallas`, `sale-o-no-sale` (temporada), `nivelar-entre-tiendas`. Más `/herramientas/mcp` (cómo conectarlas a un asistente de IA). |
| `/casos-de-exito/[slug]` | Astro estático | 4 casos: Casa Maca, La Bella Pandita (boutique/cadena), Liveshow (merch de eventos), Sandmade (trajes de baño) + índice |
| `/content/blog/` | Astro Content Collections | **3 entradas**: bienvenida (mar-2026, anuncio de marca), bershka y machina (jun-2025, piezas editoriales de industria, no atadas a keyword ninguna). Prácticamente inactivo desde que `/recursos` existe — el blog no es hoy parte real de la estrategia de búsqueda. |
| i18n / inglés / Latam | — | **No existe.** Sitio 100% es-MX. La única variante geográfica es `src/pages/giros/novias-y-fiesta/[pais].astro` (países de Latam, solo para el giro de novias, en español). No hay `/en/`, no hay `hreflang`, no hay contenido en inglés en ningún punto del repo. |

**Hallazgo de higiene que vale la pena pasar al agente técnico:** `giros/index.astro`
filtra a `businessSectors.filter(g => g.moda)` — es decir, la página ya es
100% moda — pero su `description` (meta) sigue diciendo *"ropa, zapaterías,
joyerías, **farmacias, ferreterías, minisúpers** y más"*, residuo de cuando el
sitio era multi-giro genérico. Le está mintiendo a Google sobre su propio
contenido.

**Segundo hallazgo, este de arquitectura de enlaces (se retoma en §4):** revisé
el HTML fuente de una página de giro (`zapateria.astro`), de una plantilla de
herramienta (`herramientas/[slug].astro`) y del cuerpo ya publicado de una
comparativa real (`sacs-vs-sicar`, leído directo de Supabase). **Ninguna de las
tres tiene un solo enlace interno contextual** (a `/producto`, `/recursos`,
`/giros`, `/comparar` o `/herramientas` entre sí). Los únicos `href` que salen
de una página de giro o de caso de éxito son al menú, al pie, a `/prueba-gratis`
y a `/contacto`. El motor de demanda sí soporta enlaces dentro del cuerpo (hay
lógica explícita en `bloques.ts` para sanearlos), pero las 17 comparativas
publicadas usan bloques de texto, tabla, cita, lista y cta — **cero bloques de
enlace**. El sitio tiene piezas buenas que no se citan entre sí.

---

## 1. Mapa de intención actual vs. la que falta

### 1a. Por producto (quien ya sabe que busca un sistema)

| Búsqueda | ¿Hay página? | URL que debe rankear |
|---|---|---|
| software para tienda de ropa | **No** | Crear `/software-para/tienda-de-ropa` |
| punto de venta para boutique | **No** | Crear `/software-para/punto-de-venta-para-boutique` |
| sistema de inventario por talla y color | Parcial — `/producto/inventario-omnicanal` existe y trae el tema, pero está escrita para alguien que ya conoce Sacs (funcionalidad, no investigación). No la dupliques: úsala como destino de enlace desde el nuevo contenido informativo. | `/producto/inventario-omnicanal` (verificar que el `<title>` incluya la frase exacta; si no, es ajuste técnico, no contenido nuevo) |
| programa para zapatería | **No** — `/giros/zapateria` existe pero es "cómo Sacs sirve a zapaterías", no "qué debe traer un programa para zapatería" (la persona todavía está comparando opciones) | Crear `/software-para/zapaterias`, que enlaza abajo a `/giros/zapateria` y a las comparativas `sacs-vs-sicar` y `sacs-vs-syska-pos` (ya publicadas) |
| sistema para mayoreo de ropa | **No** — es el hueco más caro de los cinco. No hay ni página de función (`/producto` no tiene una página de mayoreo/B2B), ni giro, ni software-para. Sí hay una guía en borrador (`precios-mayoreo-y-menudeo-mismo-inventario`, sin publicar) y un recurso publicado tangencial (`catalogo-de-mayoreo`) | Crear `/software-para/mayoreo-de-ropa`; publicar el borrador existente como apoyo; considerar si `/producto` necesita una página de función de mayoreo (fuera del alcance de este plan de contenido, pero anótalo) |

### 1b. Por giro (ya hay 23 — evaluación de sobra/falta)

Los 23: Tiendas de Ropa (`marcas-de-ropa`), Concept Store (`boutique-multimarca`),
Consignación y Segunda Mano (`consignacion`), Merch de Eventos
(`merchandising-eventos`), Novias y Fiesta (`novias-y-fiesta`, con variantes por
país), Activewear, Zapaterías, Joyerías, Western y Vaquera, Lencería y Ropa
Interior, Uniformes, Ropa Infantil y Bebés, Renta de Vestidos y Trajes, Bolsas y
Accesorios de Piel, Trajes de Baño y Playa, Sastrería y Trajes a Medida, Ópticas
de Moda, Telas y Mercería, Tallas Grandes, Ropa de Maternidad, Outlet y Remates
de Marca, Emprendedoras Digitales, Papelería y Arte.

**Veredicto: no faltan giros grandes.** La cobertura del ramo de moda en México
es de las cosas mejor hechas del sitio — cubre desde el giro obvio (zapatería,
joyería) hasta nichos reales del mercado mexicano (western/vaquera, telas y
mercería, consignación/segunda mano) que un competidor genérico no se molesta
en nombrar.

- **Uno sobra, o al menos desentona:** *Papelería y Arte* no es moda (es la
  única etiqueta del grupo "moda" que no viste a nadie). Si se quedó de la
  época en que el sitio era multi-giro, es candidato a moverse fuera de la
  familia moda o a fusionarse como sub-caso de Emprendedoras Digitales; si hay
  una razón de negocio para conservarlo (papelería fina ligada a bodas/eventos,
  por ejemplo), vale la pena decirlo explícito en la página para que no lea
  como injerto.
- **Ninguno falta con urgencia.** Los candidatos que se evaluaron y se
  descartan por ahora: "ropa deportiva/tenis" (ya cubierto por Activewear +
  Zapaterías), "boutique de lujo" (cabe en Concept Store), "ropa de trabajo
  industrial" (cabe en Uniformes). Si en el futuro el ABM abre un giro nuevo
  fuerte en Latam, ese sí ameritaría página propia — pero eso lo decide la
  demanda real, no una lista a priori.

### 1c. Comparativas (ya hay 17 — buena cobertura, faltan roles)

Publicadas: Shopify POS, SICAR, Square, Loyverse, Odoo, Lightspeed Retail,
Alegra POS, Bind ERP, JOOR, Vendty, Pulpos, Syska POS, ManagementPro POS,
Gestión QBS Moda, alternativas a Sizes and Colors, "sistema genérico vs. de
moda" y "software de moda para talla, color y temporada" (las dos últimas son
piezas conceptuales, no 1-a-1).

**Lo que falta:**
- **Un roundup**, no una comparativa 1-a-1: hoy todo es "Sacs vs. X". No existe
  "los sistemas para tiendas de ropa en México, comparados" — el formato que
  una IA cita cuando alguien pregunta "¿cuál es el mejor sistema para mi
  tienda de ropa?" sin nombrar a nadie todavía. Es el hueco de mayor apalancamiento
  de esta sección porque cada fila puede enlazar a la comparativa 1-a-1 que ya
  existe.
- **Aspel (SAE/Caja) y Contpaqi Comercial** — son, junto con SICAR, el trío que
  de verdad usa el comercio mexicano de mostrador; Aspel en particular no está.
- **Wix/Tiendanube** para quien busca resolver solo la tienda en línea y llega
  comparando ecommerce genérico, no POS.

### 1d. Quien busca resolver un problema (recursos)

Publicadas (11): apartados en tienda de ropa, catálogo de mayoreo, corridas
rotas en zapatería, curva de tallas (definición), inventario talla/color en
sucursales, nivelación de inventario (definición), qué tallas recomprar, ropa
que no se vende, sell-through (definición), tienda física y en línea, WhatsApp
para tiendas de ropa.

En borrador, ya escritas, **sin publicar** (5): permisos de cajeras y corte de
caja, "¿Sacs cobra por canal?", precios de mayoreo y menudeo con el mismo
inventario, cómo probar un sistema antes de pagar, qué equipo necesitas para
el punto de venta. **Publicarlas es la ganancia más barata de todo este plan**:
ya existen, el costo es cero contenido nuevo.

**Lo que de verdad falta y el usuario pidió nombrando:**
- "cómo hacer la curva de tallas" — hoy solo existe la *definición* de qué es
  la curva (`curva-de-tallas`, tipo `definicion`); falta el **cómo-se-calcula**
  paso a paso, que es intención distinta (how-to vs. qué-es) y el puente natural
  hacia la calculadora `/herramientas/curva-de-tallas`.
- "qué es sell-through" — **sí existe** (`sell-through`, publicada).
- "cómo levantar pedidos en una feria de moda" — **no existe nada**. Es una
  búsqueda de temporada muy real en el calendario de moda mexicano (Intermoda,
  SAPICA) y nadie en el ramo la responde bien todavía.
- "cómo controlar inventario por tallas" — cubierto de forma indirecta por
  `inventario-talla-color-sucursales`, pero esa guía asume varias sucursales;
  falta la versión para una sola tienda/una sola sucursal.
- Punto de reorden y costo de maquila no tienen guía (van ligados a las
  calculadoras que faltan, ver 1e).

### 1e. Herramientas gratis

Vivas: curva de tallas, "¿vas a sacar este estilo a tiempo?" (sell-through +
temporada), "qué mover entre tus tiendas" (nivelación). Bien pensadas —
resuelven problemas reales del ramo y ya están conectadas a MCP (un asistente
de IA las puede invocar directo, sin llave).

**Faltan las tres que el objetivo nombra explícitamente:**
- Calculadora de margen/markup (precio de venta a partir de costo + margen
  objetivo, y al revés)
- Calculadora de punto de reorden por talla (cuándo reordenar antes de que la
  M se rompa, usando el mismo dato que ya alimenta `nivelar-entre-tiendas`)
- Calculadora de costo de maquila (para marcas que fabrican, no solo revenden)

### 1f. Inglés / Latam

No hay nada que auditar: no existe ni una página en inglés ni una ruta con
`hreflang`. La única regionalización real es la carpeta de país dentro de
`giros/novias-y-fiesta`, y sigue en español.

**Recomendación, no una lista de tareas:** no abrir inglés — Sacs vende en
México y Latam en español; una tienda que busca en inglés no es el comprador.
Sobre Latam: el motor de demanda todavía no tiene encendida la fuente de
Search Console (Etapa 1, bloqueada esperando accesos según
`ESTADO-DEMAND-ENGINE.md`), así que hoy no hay dato real de qué mezcla de país
llega por orgánico. Antes de invertir en variantes por país fuera de novias,
espera ese dato — es exactamente el tipo de volumen que este plan no debe
inventar.

---

## 2. Las 30 búsquedas que más importan

Sin datos de volumen (Search Console todavía no está conectado al motor de
demanda). Orden por **criterio comercial**: primero quien está a una decisión
de comprar (busca por producto o compara marcas), luego quien ya se identificó
con un giro, luego problema→herramienta (más lejos de la compra pero most
alto volumen de intención de búsqueda real del ramo), al final lo conceptual
que alimenta autoridad de tema.

| # | Búsqueda | URL que debe rankear |
|---|---|---|
| 1 | software para tienda de ropa | `/software-para/tienda-de-ropa` (crear) |
| 2 | sistema para mayoreo de ropa | `/software-para/mayoreo-de-ropa` (crear) |
| 3 | punto de venta para boutique | `/software-para/punto-de-venta-para-boutique` (crear) |
| 4 | programa para zapatería | `/software-para/zapaterias` (crear) |
| 5 | sistema para tienda de novias | `/software-para/tienda-de-novias` (crear) |
| 6 | sistema de inventario por talla y color | `/producto/inventario-omnicanal` (existe) |
| 7 | Sacs vs Shopify POS | `/comparar/sacs-vs-shopify-pos` (existe) |
| 8 | Sacs vs SICAR / SICAR para tienda de ropa | `/comparar/sacs-vs-sicar` (existe) |
| 9 | mejor sistema para tienda de ropa en México | `/comparar/mejores-sistemas-para-tiendas-de-ropa-mexico` (crear, roundup) |
| 10 | Sacs vs Aspel | `/comparar/sacs-vs-aspel-sae` (crear) |
| 11 | alternativas a Sizes and Colors | `/comparar/alternativas-a-sizes-and-colors` (existe) |
| 12 | punto de venta para joyería | `/giros/joyeria` (existe) — reforzar con enlace desde `/software-para` nuevo |
| 13 | sistema para boutique multimarca / consignación | `/giros/boutique-multimarca` y `/giros/consignacion` (existen) |
| 14 | qué es la curva de tallas | `/recursos/curva-de-tallas` (existe) |
| 15 | cómo calcular la curva de tallas | `/recursos/curva-de-tallas-como-calcularla` (crear) |
| 16 | calculadora de curva de tallas | `/herramientas/curva-de-tallas` (existe) |
| 17 | qué es el sell-through | `/recursos/sell-through` (existe) |
| 18 | cómo controlar inventario por tallas | `/recursos/inventario-talla-color-sucursales` (existe, ampliar caso de 1 sola tienda) |
| 19 | cómo evitar el quiebre de talla | `/recursos/quiebre-de-talla-como-evitarlo` (crear) |
| 20 | apartados en tienda de ropa | `/recursos/apartados-tienda-de-ropa` (existe) |
| 21 | cómo levantar pedidos en una feria de moda | `/recursos/pedidos-en-feria-de-moda` (crear) |
| 22 | calculadora de margen para ropa | `/herramientas/margen` (crear) |
| 23 | punto de reorden por talla | `/herramientas/punto-de-reorden` (crear) |
| 24 | costo de maquila | `/recursos/costo-de-maquila` + `/herramientas/costo-de-maquila` (crear ambas) |
| 25 | corridas rotas zapatería | `/recursos/corridas-rotas-zapateria` (existe) |
| 26 | inventario para tienda de tallas grandes | `/giros/tallas-grandes` (existe) |
| 27 | sistema para tienda de ropa deportiva / activewear | `/giros/activewear` (existe) |
| 28 | WhatsApp para vender ropa | `/recursos/whatsapp-para-tiendas-de-ropa` (existe) |
| 29 | cómo probar un sistema antes de pagar | `/recursos/probar-un-sistema-antes-de-pagarlo` (existe, en borrador — publicar) |
| 30 | qué equipo necesito para mi punto de venta | `/recursos/que-equipo-necesito-punto-de-venta` (existe, en borrador — publicar) |

---

## 3. Los 12 contenidos a escribir primero

Antes que nada, y sin contar en los 12 porque no es "escribir" sino "aprobar":
**publica los 5 borradores que ya están listos en `de_contenido`** (§1d). Es
la ganancia de más alto retorno de todo el plan porque el costo ya se pagó.

1. **`/software-para/tienda-de-ropa`** — "Software para tienda de ropa: qué
   debe tener (con o sin Sacs)". Intención: investigación, primer contacto.
   Responde: qué módulos son indispensables (POS, inventario por talla/color,
   apartados, tienda en línea), qué diferencia a uno genérico de uno de moda,
   cuánto cuesta el rango del mercado. Dato propio: la curva de tallas y el
   sell-through como los dos números que un sistema genérico no calcula.
   Enlaza a: `/producto/inventario-omnicanal`, `/producto/punto-de-venta`,
   `/comparar` (roundup), `/giros` (índice), `/planes`.

2. **`/software-para/mayoreo-de-ropa`** — "Sistema para mayoreo de ropa:
   catálogo, precios y pedidos". Intención: marca/distribuidor que vende a
   otras tiendas, no al público. Responde: cómo se maneja precio de mayoreo
   vs. menudeo sin capturarlo dos veces, mínimos por línea, catálogo para
   compradores. Dato propio: un solo inventario para menudeo y mayoreo (no dos
   sistemas). Enlaza a: `/recursos/catalogo-de-mayoreo`,
   `/recursos/precios-mayoreo-y-menudeo-mismo-inventario` (una vez publicada),
   `/giros/marcas-de-ropa`, `/recursos/pedidos-en-feria-de-moda` (nuevo, #10).

3. **`/software-para/punto-de-venta-para-boutique`** — Intención: dueña de una
   boutique buscando POS. Responde: qué necesita una boutique que un POS de
   abarrotes no trae (apartados, cambios sin ticket, looks armados). Dato
   propio: el patrón de apartado con abonos, específico del ramo. Enlaza a:
   `/producto/apartados-y-pedidos`, `/giros/boutique-multimarca`,
   `/giros/marcas-de-ropa`, `/comparar/sacs-vs-square`.

4. **`/software-para/zapaterias`** — "Programa para zapatería: qué pedirle
   antes de comprar". Responde: manejo de números de calzado (curva EU/MX),
   control por caja, temporada. Dato propio: corridas rotas por número, tal
   como se documentó en `/recursos/corridas-rotas-zapateria`. Enlaza a:
   `/giros/zapateria`, `/comparar/sacs-vs-sicar`, `/comparar/sacs-vs-syska-pos`,
   `/recursos/corridas-rotas-zapateria`.

5. **`/comparar/mejores-sistemas-para-tiendas-de-ropa-mexico`** — roundup.
   Intención: comparación sin marca todavía en mente (la más citable por una
   IA). Responde: qué opción conviene según tamaño de tienda, si factura, si
   vende en línea. Dato propio: tabla que apunta a las 17 comparativas 1-a-1
   ya publicadas como fuente ampliada. Enlaza a: cada `/comparar/sacs-vs-*`
   existente, `/planes`.

6. **`/herramientas/margen`** — "Calculadora de margen y markup para moda".
   Intención: transaccional, calculadora suelta pero también de investigación
   de precio. Responde: precio de venta a partir de costo + margen deseado, y
   qué margen deja cada descuento. Dato propio: ejemplo con curva de tallas
   (mismo margen, distinto punto de equilibrio por talla si unas rotan más
   que otras). Enlaza a: `/herramientas/costo-de-maquila` (nuevo),
   `/recursos/que-tallas-recomprar`, `/producto/reportes-y-analitica`.

7. **`/herramientas/punto-de-reorden`** — Intención: transaccional. Responde:
   cuándo reordenar cada talla antes de romper la corrida, usando venta diaria
   y tiempo de reposición. Dato propio: mismo motor que ya usa
   `nivelar-entre-tiendas`, así que se puede anunciar como "el mismo cálculo
   que corre dentro de Sacs, aquí gratis para una sola tienda". Enlaza a:
   `/herramientas/curva-de-tallas`, `/producto/ordenes-de-compra`,
   `/recursos/corridas-rotas-zapateria`.

8. **`/herramientas/costo-de-maquila`** + su guía compañera
   **`/recursos/costo-de-maquila`** — Intención: marca que fabrica (no solo
   revende). Responde: cómo meter tela, avío, corte, confección y merma en un
   costo por prenda. Dato propio: ligarlo al margen (#6) para mostrar el
   precio final recomendado por prenda fabricada. Enlaza a:
   `/giros/marcas-de-ropa`, `/herramientas/margen`.

9. **`/recursos/curva-de-tallas-como-calcularla`** — companion how-to de la
   definición ya publicada. Intención: quiere el método, no el concepto.
   Responde: paso a paso con un ejemplo numérico real, corrigiendo por días
   agotada. Dato propio: exactamente la lógica de
   `/herramientas/curva-de-tallas` (el "auditor de curva"), contada en texto.
   Enlaza a: `/herramientas/curva-de-tallas`, `/recursos/curva-de-tallas`
   (definición), `/producto/ordenes-de-compra`.

10. **`/recursos/pedidos-en-feria-de-moda`** — "Cómo levantar pedidos en una
    feria de moda sin perder ninguno". Intención: temporal/estacional (previo
    a Intermoda, SAPICA). Responde: cómo capturar el pedido sin internet en el
    stand, cómo no duplicar el mínimo de línea, cómo convertirlo en orden de
    compra el lunes siguiente. Dato propio: cobro y captura sin internet, ya
    documentado en el giro de Merch de Eventos. Enlaza a:
    `/giros/marcas-de-ropa`, `/software-para/mayoreo-de-ropa` (nuevo, #2),
    `/producto/ordenes-de-compra`.

11. **`/recursos/quiebre-de-talla-como-evitarlo`** — Intención: problema
    agudo y recurrente ("se me acabó la M otra vez"). Responde: por qué se
    rompe la corrida, cómo detectarlo antes de que pase, qué hacer cuando ya
    pasó (traspaso vs. recompra). Dato propio: la nivelación entre tiendas
    como la salida cuando ya se rompió. Enlaza a:
    `/herramientas/nivelar-entre-tiendas`, `/herramientas/punto-de-reorden`
    (nuevo, #7), `/producto/nivelacion-de-inventario`.

12. **`/software-para/tienda-de-novias`** — Intención: producto, giro de alto
    ticket y ya priorizado por el ABM de novias (cadencia activa desde
    14-sep-2026 según memoria del equipo). Responde: apartados con anticipo
    largo (meses, no días), tallas por medida/ajuste, cita agendada. Dato
    propio: el apartado sin reloj que ya existe como patrón en el giro de
    Consignación, adaptado a anticipo de vestido. Enlaza a:
    `/giros/novias-y-fiesta`, `/producto/apartados-y-pedidos`, `/agendar`.

---

## 4. Arquitectura de enlaces

**Hubs (cabecera de tema):**
- `/producto` — hub de función (28 páginas colgando)
- `/giros` — hub de vertical (23 giros colgando)
- `/comparar` — hub de comparativas (17 colgando, más el roundup nuevo que a
  su vez debería ser el sub-hub que las une)
- `/recursos` — hub de guías (11 publicadas + 5 por publicar colgando)
- `/herramientas` — hub de calculadoras (3 colgando, 3 más por crear)
- `/software-para` — **debería ser el hub de intención genérica de compra,
  pero hoy no existe ni el índice ni una sola pieza.** Es el hub más
  importante que falta construir, porque es el único de los cinco pensado
  para atrapar a alguien que todavía no sabe que Sacs existe.

**Lo que cuelga y a dónde debería subir (y hoy no sube):**
- Cada `/giros/[slug]` debería enlazar hacia arriba a `/software-para/[su-
  categoría]` una vez exista, y lateralmente a su comparativa relevante en
  `/comparar` y a la guía de `/recursos` que le toque. Hoy no enlaza a nada de
  eso (evidencia en §0).
- Cada `/herramientas/[slug]` debería enlazar a la guía de `/recursos` que
  explica el concepto detrás del cálculo, y al `/giros` donde ese cálculo
  importa más. Hoy no enlaza a nada (evidencia en §0).
- Cada `/comparar/[slug]` debería enlazar al `/giros` del nicho de esa
  comparativa y a `/software-para` cuando exista. Hoy los bloques de cuerpo no
  incluyen ni un enlace (evidencia en §0, cuerpo real de `sacs-vs-sicar`).
- `/casos-de-exito/[slug]` debería enlazar al `/giros` correspondiente (Casa
  Maca y La Bella Pandita → `/giros/marcas-de-ropa` o `/giros/boutique-
  multimarca`; Liveshow → `/giros/merchandising-eventos`; Sandmade →
  `/giros/trajes-de-bano`) y no lo hace: solo enlaza a `/casos-de-exito`,
  `/prueba-gratis` y `/contacto`.

**Acción concreta más barata:** el motor de demanda ya tiene el tipo de bloque
`cta` en su esquema (`bloques.ts`); añadir soporte a un bloque de enlace
interno (o simplemente permitir que el brief pida 2-3 enlaces salientes
obligatorios por pieza) resuelve de un golpe el hueco en `/comparar` y
`/recursos` para todo lo que se publique de aquí en adelante — sin tocar lo ya
publicado. Para `/giros` y `/herramientas`, que son Astro a mano, el arreglo
es una sección "Sigue leyendo" al pie de cada plantilla con 2-3 enlaces fijos
por giro/herramienta.

---

## 5. Canibalización

No hay canibalización grave hoy — el problema del sitio es el opuesto
(páginas aisladas, no páginas compitiendo). Los dos puntos de fricción reales:

1. **`/producto/inventario-omnicanal` vs. el futuro `/software-para/inventario-
   por-talla-y-color`.** Por eso en §1a se recomienda NO crear esa página de
   `/software-para` — reforzar la que ya existe en vez de duplicarla. Si más
   adelante se crea, que sea con ángulo claramente distinto (comparación de
   opciones del mercado) y enlazando a la de producto, nunca compitiendo por
   el mismo título.

2. **`curva-de-tallas` (definición, `/recursos`) vs. `curva-de-tallas-como-
   calcularla` (how-to, nuevo, #9) vs. `curva-de-tallas` (herramienta,
   `/herramientas`).** Tres piezas, mismo tema, mismo slug base — riesgo real
   si no se distingue el título y el `<title>` de cada una con precisión
   ("qué es" / "cómo se calcula" / "calculadora"). Vigilar cuando se publique
   la #9: si el motor de demanda las escribe parecido, terminan compitiendo
   entre sí en vez de reforzarse. Recomendación: que cada una enlace
   explícitamente a las otras dos como "ver también", en vez de repetir su
   contenido.

3. **El blog vs. `/recursos`.** No compiten por keyword (el blog no está
   optimizado a intención de búsqueda), pero si alguien reactiva el blog sin
   saber que `/recursos` ya es el hub real de guías del ramo, hay riesgo de
   que una entrada de blog nueva duplique un tema que `/recursos` ya cubre
   mejor y con más estructura (FAQ, tabla, schema). Regla simple: todo tema de
   "cómo resolver X en la tienda" va a `/recursos`, no al blog; el blog se
   queda para anuncios de marca y piezas editoriales de industria, que es lo
   único que hoy tiene.

4. **Giros muy cercanos entre sí** (Concept Store / Consignación,
   Novias-y-Fiesta / Renta-de-Vestidos, Bolsas-y-Accesorios / Western)
   comparten vocabulario pero no compiten de verdad porque cada uno tiene su
   propia ficha de producto y su propio "solo aquí" en `navigation.ts` — es
   diferenciación real, no la misma página con otro nombre. No requieren
   acción.
