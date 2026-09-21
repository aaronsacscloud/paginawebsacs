# Guía para replicar una pieza de contenido que gana (SEO + IA + uso real)

Cómo se hace una página que aparece en el AI Overview de Google y en las
respuestas de ChatGPT/Gemini/Claude para SU pregunta, y que quien la lee la
usa y sigue hacia la landing del giro. Es el proceso que se corrió con
`/software-para/tienda-de-novias/` el 21-sep-2026 y que el ciclo diario repite
solo para cada oportunidad. Lo que el motor no puede generar, lo pide.

## Por qué aparece quien aparece (el caso «curva de tallas»)

El AI Overview de Google para «curva de tallas» cita a fashionandillustration.com
y a symmetria: primero, y enseña **una imagen que contiene el dato** (la tabla
de curva de tallas y colores), una **definición de una línea** que Google
subraya tal cual, un **«¿para qué sirve?» en tres viñetas**, un **ejemplo
práctico con números** (30 playeras: CH 5, M 10, G 10, XG 5) y un **video de
YouTube** relacionado. Nada de eso es casualidad: es la estructura que un
modelo puede extraer sin leer. Nuestra página tiene que traer exactamente esas
piezas —y además lo que a ellas les falta: fuente, honestidad, lenguaje del
ramo, y un camino hacia el producto.

## Los 18 criterios del referee

Los 7 primeros son los «flujos de SEO/GEO» que circulan (Jev/Ryze); los 11
siguientes son los que faltan ahí y que deciden si la página se usa.

| # | Criterio | Para | Qué exige | Lo comprueba |
|---|---|---|---|---|
| 1 | Mejor que lo que rankea | SEO | Competidores puntuados (respuesta, profundidad, prueba, frescura 0-5), marcados si una IA ya los cita; la nuestra cubre el hueco común | competencia + referee |
| 2 | Título, meta, H1, FAQ, schema | SEO | Cada elemento: mantener o cambiar, con confianza y propuesta | referee (`elementos`) |
| 3 | Contesta lo que se le pregunta a la IA | IA | Contra prompts reales de `de_prompts_ia` + preguntas de foros: cubiertas / sin cubrir | referee |
| 4 | Probabilidad de ser citada | IA | 0-100 y la PRIMERA corrección que más la sube | referee |
| 5 | Términos que convierten | SEO | Búsquedas de comprador (`de_queries.intent_comercial`) y palabras que rankean en título, H1 y primer párrafo | referee |
| 6 | Enlaces internos con razón | SEO | ≥ 3 rutas distintas reales, incluida `/giros/<giro>`, anchors naturales | duras |
| 7 | Comprobaciones sí/no | SEO | ~30 checks automáticos (forma, rutas, precios, honestidad, cortada) | duras |
| 8 | Glosario del ramo | uso | ≥ 6 términos como los dice el giro, usados en el texto → `DefinedTermSet` | duras + referee |
| 9 | Lenguaje del ramo | uso | Glosario del brief usado, lista `evitar` respetada, casos con cifra, cero folleto | duras + referee |
| 10 | Fotos | uso | Portada + ≥ 1 foto intermedia documental con alt | duras + imagen |
| 11 | **Imagen con el dato** | IA | ≥ 1 bloque `diagrama` (tabla real de la página) que se dibuja como PNG con alt → la imagen del AI Overview | duras + imagen |
| 12 | Datos con fuente | IA | ≥ 2 datos con URL, SOLO de las fuentes verificadas del brief | duras |
| 13 | CTA a mitad de camino | uso | Una llamada antes del FAQ, tras la sección del módulo, a `/giros/…`, `/producto/…` o herramienta | duras |
| 14 | Entidad / E-E-A-T | IA | Autor = organización, fechas, nada desmentible | schema + referee |
| 15 | Respuesta corta arriba | IA | Bloque «En corto» 3-5 líneas + primer párrafo ≤ 80 palabras → `speakable` | duras |
| 16 | Frescura | SEO | Fecha visible, datos del año | referee |
| 17 | Se lee en el celular | uso | Párrafos ≤ 110 palabras, subtítulo cada ~250 | duras |
| 18 | Video u otro medio | uso | Video del canal que encaje (VideoObject) o «grabar: …» para el dueño | referee |

Pasa si: honestidad ≥ 9, contesta ≥ 8, promedio ≥ 8, mejor que la competencia,
y los criterios 8, 10, 11, 12, 13, 15 y 6 en ok. Máximo 3 reescrituras.

## Los 10 criterios de IA y agentes que van más allá del referee

Lo que un especialista en búsqueda con IA revisa ADEMÁS de los 18 (viven en
`lib/demanda/especialista.ts` → `CRITERIOS_AGENTES`):

| # | Criterio | Qué exige |
|---|---|---|
| 1 | llms.txt / llms-full.txt | La pieza sale ahí con su resumen (= la respuesta, no el título) |
| 2 | Rastreadores de IA permitidos y rápidos | robots ya permite GPTBot/ClaudeBot/PerplexityBot/Google-Extended; falta medir < 1.5 s sin JS |
| 3 | Entidad + categoría en la misma frase | «Sacs, el sistema para tiendas de moda en México (sacscloud.com)» al menos una vez; `knowsAbout` con el giro |
| 4 | La pregunta en 3 formas | H2 en forma de pregunta; variantes «¿qué sistema me recomiendas…?», «¿existe un software que…?» |
| 5 | Todo dato extraíble sin ver la imagen | El diagrama con caption/tabla; tablas ≤ 6 columnas; nada solo en imagen |
| 6 | Cifras con atribución en línea | «486,645 matrimonios en 2024 (INEGI)» en la misma frase, además del enlace |
| 7 | Qué cambió y cuándo | dateModified real + línea visible «actualizado: qué cambió» |
| 8 | Acciones que un agente puede ejecutar | Agendar sin fricción, calculadora con parámetros en URL, MCP/API cuando exista |
| 9 | Estar en las fuentes que las IAs ya citan | Los 3-5 dominios que citan para la pregunta (`de_ia_muestras.urls_citadas`): aparecer ahí |
| 10 | Consistencia en terceros | Misma descripción/precio/categoría en Capterra, GetApp, Google Business, LinkedIn |

## El loop después del referee (especialista.ts)

```
aprobada ──► contenido.especialista (SEO + IA/agentes) ──► de_contenido_pendientes ──► pestaña «Seguimiento»
publicada ──► contenido.autoridad (cada 7 días: indexada, clics, posición, citas IA, enlaces) ──► pendientes «autoridad»
publicada ──► contenido.angulos (3-5 piezas hermanas) ──► de_oportunidades ──► brief ──► … ──► referee
```

- Cada pendiente dice **quién**: `motor` (lo hace el ciclo) o `dueno` (grabar, subir capturas, conseguir una mención, confirmar un dato). El dueño tacha en «Seguimiento»; lo del motor se tacha solo.
- Corrida manual: `scripts/especialistas-correr.mjs <slug> [--angulos]`.
- Los tres handlers tienen política en `de_politicas` y corren al final del ciclo diario.

## El proceso, paso a paso

```
1 BRIEF ──► 2 INVESTIGACIÓN ──► 3 BORRADOR ──► 4 REFEREE ──► 5 IMÁGENES ──► 6 PREVIEW REAL ──► 7 DUEÑO ──► 8 PUBLICAR
              (automática +            ▲            │ no pasa
               harness de agentes)     └────────────┘ correcciones, máx. 3
```

1. **Brief** (`contenido.brief`): pregunta real, quién, promesa, demostrar, secciones, faq, `giro`, nota de honestidad.
2. **Investigación**:
   - Automática cada día (`contenido.competencia`): gpt-5 web_search lee 5 páginas (puntuadas) + 4-8 fuentes verificadas.
   - **Harness de agentes** para piezas clave (`scripts/investigacion/`): tres agentes en paralelo —fuentes, lectura completa de competencia, lenguaje del ramo— y `inyectar-brief.mjs`. Aporta lo que la automática no alcanza: 15 páginas leídas completas, 19 fuentes, 27 términos, 46 palabras a evitar, 12 «para ganar», 12 preguntas sin contestar.
3. **Borrador** (`contenido.borrador`): bloques `resumen → p → secciones (tabla/pasos, diagrama, imagen, cita, cta intermedia) → glosario → faq → cta final`. Solo afirma la ficha; solo cita fuentes verificadas; usa el glosario; evita la lista `evitar`.
4. **Referee** (`contenido.referee`): duras + 18 criterios + elementos mantener/cambiar + probabilidad de cita + `necesita_del_dueno`.
5. **Imágenes** (`contenido.imagen`): diagrama (SVG→PNG con los datos de la página, sin modelo), portada y fotos intermedias (gpt-image-2, documental).
6. **Preview real**: `/{seccion}/{slug}/?borrador=1` con sesión del CRM → la página tal cual va a salir (plantilla, portada, diagrama, cierre por giro), `noindex`, sin caché.
7. **Dueño** (bandeja «Por aprobar»): veredicto, criterios, contra qué compite, lo que el motor le pide (video, capturas, confirmar un dato), botón «Ver la página real». Publica o rechaza con motivo.
8. **Publicar**: sin despliegue; IndexNow (Bing → ChatGPT) + sitemap a Google.

## Lo que el motor NO puede generar y pide al dueño

El referee lo lista en `necesita_del_dueno` y la bandeja lo enseña. Típicamente:

- **Un video de 3 minutos** del flujo real en Sacs (el referee dice cuál grabar y da el guion en 3 líneas). Se sube al canal, se agrega su id a `src/data/videos-canal.ts` y el bloque `video` entra en la siguiente reescritura.
- **Capturas reales de pantalla** del módulo (apartado con saldo, ficha del CRM con medidas, orden de taller). Se suben a `wa-media/guias/` y se pegan como bloque `imagen` con url.
- **Confirmar un dato de la ficha** (qué plan incluye qué módulo, un automatismo). Se corrige `capacidades.ts` y se reescribe.
- **Una plantilla descargable** (contrato de apartado, ficha de medidas) si el hueco de la competencia la pide.

## Cómo replicarlo para la siguiente pieza

```bash
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
R="node --env-file=.env --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs"

# 1. Ver qué está en brief/borrador
$R scripts/revisar-borradores.mjs

# 2. (piezas clave) lanzar los 3 agentes con los prompts de scripts/investigacion/, juntar todo.json e inyectar
$R scripts/investigacion/inyectar-brief.mjs <slug> todo.json

# 3. Gate completo con borrador nuevo, hasta 3 rondas, imágenes al final
$R scripts/calidad-correr.mjs <slug> --giro <giro> --reescribir

# 4. Preview real (con sesión del CRM) y aprobación en la bandeja
open https://www.sacscloud.com/<seccion>/<slug>/?borrador=1
```

Sin pasos 2-3 a mano, el ciclo diario hace lo mismo con la investigación
automática: brief → competencia → borrador → referee → imagen, con topes en
`de_politicas`.

## El resultado en novias (21-sep-2026)

Cuarta pasada, con la investigación de los tres agentes inyectada y gpt-5 como
redactor y juez (Anthropic sin saldo esa noche): **pasó en la ronda 2 con 18/18
criterios, promedio 8.8, honestidad 9, probabilidad de cita 82-86%**, 3,334
palabras, 2 diagramas (calendario de abonos, línea de tiempo), portada + 2 fotos
documentales, video del canal embebido (`kj4oSo_Iaek`), glosario de 10 términos,
FAQ de 10, CTA a mitad a `/giros/novias-y-fiesta` y cierre a `/agendar`. Costo
$1.01 (+ ~$4 de agentes). Lo que el referee le pide al dueño quedó en la
bandeja: capturas reales del apartado, la orden de taller y el portal; plantilla
de nota de apartado; confirmar qué plan incluye CRM/portal/taller; grabar el
video de 3 min del flujo (guion incluido).

## Lo que se aprendió construyéndolo (para no repetirlo)

1. La vista del juez aplanaba tablas y marcaba «texto corrido» → `aMarkdown()`.
2. `/agendar` existía y se daba por roto → `rutaExiste()` con las secciones fijas.
3. El borrador llegaba cortado con JSON «entero» → tope de tokens 28k + check «cortada» + streaming en el cliente de Anthropic para salidas > 8k.
4. Los automatismos son la mentira más común («el sistema lo ejecuta solo») → regla en el borrador + check duro.
5. Reparto de módulos por plan sin respaldo en la ficha → «confírmalo en la demo».
6. La lista `evitar` del glosario traía palabras normales en México («plazo», «nota», «depósito») → se filtra a anglicismos y términos de España; si no, el check duro tumba páginas buenas.
7. Un `import` de JSON en Node exige atributo `type: json` → los datos estáticos van en `.ts`.
8. Anthropic rechaza esquemas con más de ~10 propiedades por objeto («Schema is too complex»); el esquema del borrador reutiliza campos y se normaliza al leer.
9. gpt-5 manda los encabezados en `titulo` y los numera («1) …»); sin el respaldo en la normalización se perdían todos los h2 y el referee tumbaba la página tres rondas seguidas por «0 secciones h2».
10. Reescribir NO es regenerar: la versión anterior viaja completa y la instrucción es editarla. Regenerando, una página de 9.2 con un párrafo sin punto volvía como una de 8.0 con fallos nuevos.
11. El check «párrafo sin puntuación final» tenía falsos positivos (cifras, «:» antes de una lista) y tumbó una 9.2 en ronda 0; ahora mira el bloque siguiente.
12. El diagrama se dibuja sin modelo (SVG→JPEG con sharp): título y celdas se parten en líneas, nunca se recortan con «…» — lo recortado es justo lo que no queremos que lea una IA.
