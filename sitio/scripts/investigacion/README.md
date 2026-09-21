# Investigación profunda de una pieza (el «harness» de agentes)

El ciclo diario ya investiga solo con gpt-5 `web_search` (`contenido.competencia`:
5 páginas + 4-8 fuentes). Cuando una pieza importa de verdad —la primera de un
giro, una que va a competir por un AI Overview— se corre ADEMÁS esta
investigación con tres agentes en paralelo (Claude Code, `Agent` general-purpose,
tienen WebFetch/WebSearch y leen páginas que este servidor no puede abrir).

Los tres prompts están en esta carpeta. Se les sustituye `{PREGUNTA}`, `{GIRO}`
y `{TEMA}`, se lanzan a la vez, y su JSON se junta en un `todo.json`:

```json
{"fuentes": <salida de fuentes.md>, "comp": <salida de competencia.md>, "glos": <salida de lenguaje.md>}
```

y se inyecta al brief:

```bash
node --env-file=.env --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
  scripts/investigacion/inyectar-brief.mjs <slug> todo.json
```

Después se corre el gate completo reescribiendo desde cero con esa investigación:

```bash
node --env-file=.env --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs \
  scripts/calidad-correr.mjs <slug> --giro <giro> --reescribir
```

Lo que aporta cada agente y a qué criterio del referee alimenta:

| Agente | Trae | Criterios |
|---|---|---|
| fuentes.md | 8-20 datos con URL verificada (ley, SAT, INEGI, ramo) + lo que NO se encontró | datos_con_fuente, entidad, frescura |
| competencia.md | lectura COMPLETA de 10-15 páginas (H2, tablas, FAQ, schema, imágenes, video, CTAs) + `para_ganar` + `preguntas_sin_contestar` | competencia_superada, preguntas_ia, elementos_seo, video_media |
| lenguaje.md | glosario de 18-27 términos con «también se dice» y «evitar», frases del mostrador, preguntas reales con URL, políticas habituales con fuente, palabras que rankean | glosario, lenguaje_ramo, intencion_compradora, respuesta_corta |

Costo: ~$3-4 por pieza en tokens de agentes (≈ 320k tokens), 5-10 minutos en paralelo.
