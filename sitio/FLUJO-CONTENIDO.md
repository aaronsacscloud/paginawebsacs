# El flujo de una página, de la pregunta a la bandeja

Cómo llega una página del motor a la bandeja del dueño, y por qué **nada
llega sin haber pasado por el referee**. Código: `src/lib/demanda/contenido.ts`
(brief y borrador) y `src/lib/demanda/calidad.ts` (competencia, referee,
portada). Corre solo en el ciclo diario; se puede correr a mano sobre una
pieza con `scripts/calidad-correr.mjs`.

## Las siete fases

```
oportunidad ──► 1 BRIEF ──► 2 COMPETENCIA ──► 3 BORRADOR ──► 4 REFEREE ──┐
                   ▲                                              │       │
                   └──────── correcciones (máx. 2 rondas) ◄── no pasa     │ pasa
                                                                          ▼
                                            7 PUBLICAR ◄── 6 DUEÑO ◄── 5 PORTADA
                                              (IndexNow, sitemap)   (bandeja)
```

| # | Fase | Handler | Qué hace | Qué guarda | Costo |
|---|------|---------|----------|------------|-------|
| 1 | **Brief** | `contenido.brief` | Lee las formas REALES de preguntar (`de_queries`), la ficha de Sacs y los rechazos anteriores. Escribe el encargo: pregunta, quién, promesa, qué demostrar, secciones, faq, **giro**, **nota de honestidad**. | `de_contenido.brief` (estado `brief`) | ~$0.10 |
| 2 | **Competencia** | `contenido.competencia` | Con `gpt-5 web_search` busca y lee las 5 páginas que hoy mejor contestan la pregunta. De cada una: estructura, qué cubre, qué le falta, por qué rankea. Y el **hueco común** que ninguna cubre. Da de alta en `de_competidores` a los proveedores que no vigilábamos. | `de_paginas_similares` + `brief.competencia` | ~$0.40 |
| 3 | **Borrador** | `contenido.borrador` | Escribe en bloques tipados, solo afirma lo que la ficha respalda, cubre el hueco de la competencia. Si es reescritura, aplica exactamente las `correcciones` del referee. | `cuerpo`, `titulo`, `meta_desc` (estado `borrador`) | ~$0.25 |
| 4 | **Referee** | `contenido.referee` | Primero las **comprobaciones duras** (sin modelo, abajo). Luego juzga en 6 ejes contra la competencia. Pasa solo si honestidad ≥ 9, contesta ≥ 7, promedio ≥ 7.5 y es mejor que la competencia. Si no, devuelve a `brief` con 2-6 correcciones concretas. Tras 2 rondas sin pasar → **atascada**. | `auditorias.referee`; estado `aprobado` o `brief` | ~$0.15 |
| 5 | **Portada** | `contenido.imagen` | Solo para lo aprobado. Escena documental decidida por el modelo barato, imagen con `gpt-image-2`, a 1200×630 JPG en storage público (`wa-media/guias/`). Sin despliegue. | `brief.portada` | ~$0.20 |
| 6 | **Dueño** | bandeja «Por aprobar» | Ve la pregunta, la nota de honestidad, el veredicto en 6 ejes, contra qué compite, la portada, el cierre por giro y el cuerpo. Publica o rechaza **con motivo** (el motivo entra al siguiente brief). | `auditorias.humana` o `rechazo` | 2 min |
| 7 | **Publicar** | `publicar()` | Guarda versión, respeta `frenoDeSalida`, avisa por IndexNow (Bing → ChatGPT) y reenvía el sitemap a Google. | estado `publicado` | $0 |

Costo por página que pasa a la primera: ~$1.10. Con dos reescrituras: ~$1.60.

## Los seis ejes del referee (0-10)

| Eje | La pregunta que se hace | Mínimo |
|-----|--------------------------|--------|
| contesta | ¿El primer párrafo responde la pregunta tal cual la haría quien busca? | 7 |
| profundidad | ¿Enseña algo que quien lleva una tienda no sabía, con ejemplos con número? | — |
| voz_experto | ¿Lee como escrito por alguien que ha estado en el mostrador? Casos concretos, opiniones, límites admitidos. Cero folleto. | — |
| honestidad | ¿Afirma SOLO lo que la ficha de Sacs respalda? ¿Respeta la nota del brief? Un invento = fallo. | **9** |
| estructura_geo | ¿FAQ real, tabla o pasos con hechos, encabezados citables sueltos? | — |
| vs_competencia | Contra las 5 que rankean: ¿cubre el hueco común y es más útil en lo concreto? | debe ser «mejor» |

Promedio de los seis ≥ 7.5.

## Las comprobaciones duras (sin modelo, no se equivocan)

- Título ≤ 53 · meta 90-158 y no termina a media frase.
- 4 a 9 h2 · ≥ 2 enlaces internos · todos a rutas que existen (`rutaExiste()`).
- Primer párrafo ≤ 110 palabras y no empieza con preámbulo.
- Bloque `faq` con ≥ 4 preguntas · `tabla` o `pasos` · `cta` al final.
- ≥ 4 cifras con unidad · ninguna frase de folleto · ≤ 2 párrafos de > 140 palabras.
- Ningún precio presentado como de Sacs fuera de $810 / $1,215 / $1,890 / $3,780.
- Si el brief avisó algo que NO se puede afirmar, la página lo DICE (negación presente).
- No está cortada: termina en faq/cta y ningún párrafo acaba sin puntuación.

Las graves (precio, ruta inexistente, honestidad callada, sin faq, sin cta,
cortada) mandan sobre el modelo: aunque el juez diga «pasa», no pasa.

## Sobre «que Google no detecte que es IA»

Google no penaliza el origen, penaliza lo genérico a escala. Lo que sí se
puede medir y exigir es lo que hace que una página parezca —y sea— de alguien
del ramo: casos con prenda, talla y cifra; opiniones; límites admitidos; cero
frases de folleto. Ese es el eje `voz_experto`, y el borrador lo tiene como
regla. Además: autor y editor en el schema son la **organización**, nunca una
persona inventada; la portada es fotografía documental (nada de hologramas);
y los precios, la ficha y los enlaces son verificables.

## Lo que se aprendió en la primera pieza (novias, 20-sep-2026)

Cuatro rondas de referee antes de pasar (8.4/10, mejor que BridalOp,
BridalLive, Lightspeed, Tulle y BrideALL). Lo que cayó y lo que se arregló:

1. **La vista del juez flattenaba las tablas.** El referee marcaba «tabla como
   texto corrido ilegible» porque `aTexto()` le daba la tabla en una línea. Se
   creó `aMarkdown()` para el juez: tablas, pasos y faq marcados. Una
   reescritura entera se fue en un defecto que no existía.
2. **`/agendar` existía y el referee lo daba por roto.** La lista de rutas
   solo tenía guías y herramientas. Ahora `rutaExiste()` conoce las
   secciones fijas del sitio y compara sin diagonal final.
3. **El borrador llegaba cortado y el JSON parecía entero.** Con 10,000
   tokens una página de 2,500 palabras terminaba en «[no». Subido a 20,000 y
   la comprobación dura «cortada» lo atrapa.
4. **Los automatismos son la mentira más común.** «El sistema lo ejecuta»,
   «recordatorio automático», «se domicilia». Regla nueva en el borrador:
   solo se dice si la ficha usa esa palabra para esa función.
5. **Reparto de funciones por plan.** La ficha solo dice qué trae Vende; el
   borrador adjudicaba módulos a Fideliza y Controla. El referee lo tumbó dos
   veces hasta que la tabla de planes dijo «confírmalo en la demo».

## Cómo correrlo a mano

```bash
export PATH=/tmp/node-v22.12.0-linux-x64/bin:$PATH
node --env-file=.env --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
  scripts/calidad-correr.mjs <slug> [--giro novias-y-fiesta] [--sin-imagen]
```

Enseña el veredicto de cada ronda con los fallos, reescribe hasta dos veces,
y si pasa genera la portada. Es exactamente lo que hace el ciclo diario.

## Políticas (`de_politicas`)

| tipo_accion | nivel | tope/día | aprueba |
|---|---|---|---|
| contenido.brief | 1 | 20 | no |
| contenido.competencia | 2 | 10 | no |
| contenido.borrador | 2 | 10 | no |
| contenido.referee | 2 | 15 | no |
| contenido.imagen | 2 | 5 | no |
| contenido.publicar | 3 | 5 | **sí, siempre** |
