# Radar de visibilidad en agentes — dónde vamos

Este archivo es el punto de retomada. Si abres el proyecto sin contexto, lee
esto primero y luego `scripts/seo-semanal.prompt.md`.

Última actualización: **19-sep-2026**

---

## Qué es esto

Que los modelos de IA recomienden Sacs cuando un dueño de tienda de ropa o
calzado les pregunta qué usar. No es SEO de buscador: es quién sale citado en
la respuesta.

| Pieza | Archivo |
|---|---|
| Catálogo de preguntas | `datos/seo-preguntas.json` |
| Medidor | `scripts/seo-medir.mjs` |
| Parte a Discord | `scripts/seo-reportar.mjs` |
| La rutina semanal | `scripts/seo-semanal.prompt.md` |
| Histórico (se apila) | `datos/seo-bitacora.jsonl` |

## Dónde quedamos

**Catálogo reenfocado a 30 preguntas de dueño de moda** — boutique 19,
zapatería 5, mayorista 4, merch 2 — con eje `persona` y un nivel nuevo,
`negocio`, que es la pregunta del dueño y no la del comprador de software.

La vara para que una pregunta entre: **no importa que diga «ropa» — importa que
quien la teclea venda ropa o calzado.** Por eso se fue «CFDI 4.0» (eso lo
pregunta igual una ferretería) y se quedó «mi sistema dice que hay y no hay».

**Línea base: 0 de 30.** Pero el número que manda es otro: **7 de las 12
preguntas nuevas no citan a nadie**, y las 7 son del nivel `negocio` —cambios
de talla, sacar temporada pasada, números de en medio, curva de tallas, cuánto
comprar, qué marcas dejan margen, dinero parado en calzado.

Eso invierte la lógica del tablero. Una pregunta donde citan a Shopify obliga a
**desplazar** a Shopify. Una donde no citan a nadie **la gana el primero que
publique algo creíble.** Las preguntas sin competencia no son el peor blanco:
son el mejor.

De paso, primera aparición de un competidor mexicano (SICAR) en lo que un
modelo APRENDIÓ, no en lo que buscó.

**Publicado y vivo:** `blog/descuadre-inventario-anatomia` — el caso de
LiveShows Merchandising / Laufey reconstruido movimiento por movimiento, con el
nombre del cliente autorizado por el dueño.

## Lo que sigue: UNA pieza, «curva de tallas»

Una, bien. Es el término exacto del ramo, nadie lo ocupa, y es de las que no
citan a nadie. Y solo nosotros podemos contestarla con lo que tenemos: **la
curva real medida de una zapatería mexicana**, no traducida de un manual
gringo.

**El detalle del dato, que no es menor:** las opciones de variante viven en
`variante1`, `variante2`… — estructuradas, pero **posicionales y sin etiqueta**.
En una cuenta la talla es `variante1`, en otra es `variante2`. Hay que
resolverlo cuenta por cuenta cotejando los valores contra un vocabulario de
tallas (XS–XL, 22–30, 2–16). Ver `sacs_api/lib/variantes.lib.js`.

Ese paso es justo lo que le da foso a la pieza: si fuera trivial, cualquiera la
publicaría.

## Bloqueado, esperando al dueño

1. **Lectura a Mongo** para medir la curva. El clasificador bloqueó la corrida
   de sondeo el 19-sep. Sin dato propio no se escribe la pieza — es la regla que
   tiene puesta la rutina.
2. **Webhook de Discord de #ventas** → guardarlo como `DISCORD_SEO_URL`. Sin eso
   el parte semanal se queda en el servidor.

## El cron sigue APAGADO, a propósito

`scripts/instalar-cron-seo.sh` existe y no se ha corrido. Primero una vuelta
completa a mano con la pieza de tallas: si la fórmula mueve la aguja, se
automatiza; si no, automatizaríamos producir texto.

## Una trampa que ya se cerró

Hasta el 19-sep, `draft: true` **no hacía nada**: las tres rutas del blog leían
`getCollection('blog')` a pelo, así que un borrador tenía URL viva en producción
y entraba al sitemap. Eso vaciaba la única promesa que sostiene la rutina —la
máquina escribe, una persona publica—, que es lo que nos separa del patrón que
Google llama abuso de contenido a escala.

Cerrado con `postsPublicados()` en `src/lib/blog.ts`. **Toda ruta nueva que
liste artículos usa esa función**, nunca `getCollection('blog')` directo.
