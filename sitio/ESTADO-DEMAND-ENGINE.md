# ESTADO · Sacs Demand Engine

> **Lee esto PRIMERO al abrir una sesión nueva**, antes que el plan.
> Después: `node sitio/scripts/de-operador.mjs --estado`, luego `sitio/COLA.md`.

**Dónde vamos:** Etapa 0 (Cimientos) **TERMINADA**. Sigue la Etapa 1 (Inteligencia), que necesita los accesos de Google.

| Documento | Para qué |
|---|---|
| `PLAN-DEMAND-ENGINE.md` | Arquitectura, decisiones y fases |
| `ANALISIS-DEMAND-ENGINE.md` | Casos de uso, diagramas, requerimientos, tablero de tareas |
| `ESTADO-DEMAND-ENGINE.md` | Este archivo: dónde quedamos y con qué trampas |

---

## Etapa 0 · Cimientos — hecha (15-sep-2026)

### Qué quedó construido

**Base de datos** — `sitio/supabase/migrations/2026-09-15-demand-engine-E0.sql`, aplicada.
Once tablas `de_*` y una función. Aditiva e idempotente (corrida dos veces, verificado).

| Tabla | Qué guarda | Semilla |
|---|---|---|
| `de_config` | Autonomía, presupuesto, interruptores, mercados, umbrales | 1 fila, 13 umbrales |
| `de_politicas` | Matriz de autonomía por tipo de acción | 49 tipos, 6 guardrails inmutables |
| `de_conectores` | Las fuentes y qué le falta a cada una | 15 |
| `de_acciones` | **La cola** | — |
| `de_ciclos` | Una corrida del motor con su resumen y TOP 5 | — |
| `de_taxonomia` | Etapas del recorrido del retailer | 50 |
| `de_icp` | A quién le duele (tamaño, modelo, mercancía, canal) | 27 |
| `de_pesos` | Versiones de los pesos del score | v1 vigente |
| `de_memoria` | Lo que no funcionó y lo que el dueño rechazó | — |
| `de_salud` / `de_anomalias` | Latido y datos que no cuadran | — |

**Código** — `sitio/src/lib/demanda/`:
`tipos.ts` · `fechas.ts` (día CDMX) · `config.ts` (config + presupuesto) · `politicas.ts` (en qué estado nace una acción) · `cola.ts` (encolar/tomar/terminar/fallar) · `ciclo.ts` (arma la cadena) · `handlers.ts` (registro + noop, ciclo, cierre, salud) · `worker.ts` · `conectores.ts` (disponibilidad calculada del entorno) · `ia.ts` (llamadas al modelo con costo) · `herramienta.ts` (contrato único web/MCP/API).

**Endpoints** — `/api/cron/de-worker` (cada 5 min), `/api/cron/de-ciclo?tipo=` (diario 06:00 UTC, semanal lunes 07:00, mensual día 1 08:00), y `/api/crm/demanda/{estado,acciones,ajustes,correr}` (gateados por el middleware admin).

**CRM** — sección «Motor de demanda» con escalón propio `#BA51A0`, icono Editorial nuevo (`demanda`), permiso `demanda` en `permisos.ts`, y dos pantallas: **Resumen** y **Sistema** (Cola · Aprobaciones · Lo que me falta · Ajustes).

**Operador** — `sitio/scripts/de-operador.mjs` (`--estado`, `--pendientes`, `--tomar`, `--cerrar`, `--encolar`).

### Pruebas que pasaron (SQL directo contra producción)
1. Migración idempotente: corrida dos veces, mismos conteos.
2. Toma por prioridad: `tomar(2)` devuelve las dos de mayor prioridad, en `corriendo` y con lease.
3. Dependencias: `B` con `depende_de A` no se toma hasta que `A` termina; entonces se promueve sola.
4. Lease vencido: una acción con el lease caducado vuelve a la cola en la siguiente vuelta.
5. **Concurrencia**: tres workers en paralelo sobre 20 acciones → 10 + 10 + 0, las 20 distintas, cero doble toma.

### Decisiones tomadas en esta etapa
- **`MODELS.sonnet5` se agregó APARTE**, sin tocar `MODELS.sonnet`: el agente de Trabajo Inteligente lleva meses calibrado contra Sonnet 4.5 y cambiarle el modelo por debajo sería mover el piso de algo que funciona. El motor de demanda nace en Sonnet 5.
- **Bug arreglado de paso en `lib/ai/client.ts`**: el respaldo de `PRICING` apuntaba a `claude-sonnet-4-7`, que no existe en la tabla. Cualquier modelo desconocido daba coste `NaN` y ese `NaN` se escribía en `ia_uso`, envenenando el gasto del mes.
- **El escalón de color del menú es el punto medio** entre marketing y finanzas (`#BA51A0`), para no recalcular la escalera que el dueño ya aprobó.
- **La disponibilidad de una fuente se calcula del entorno**, no se guarda a mano: una casilla «disponible» en una tabla envejece mal el día que alguien rota una llave.
- **`sistema.cerrar_ciclo` se reprograma en vez de fallar** mientras quede trabajo vivo (`reprogramar_en_seg`), con techo de 6 horas. Esperar no gasta reintentos.

### Trampas descubiertas
- **`node -e` con SQL largo como argumento revienta** (`Check failed: n < buffer_size`). Para correr migraciones hay que leer el archivo desde un script, no pasarlo por `argv`. El helper está en el scratchpad de la sesión; si hace falta otra vez, son 10 líneas: leer el `.sql`, `JSON.stringify`, `POST` a la Management API.
- **`{ ok: true, ...r }` pisaba el booleano** cuando `r` traía un contador llamado `ok`. El contador del worker se llama ahora `hechas`.
- **No existe `src/env.d.ts`** en el repo: cualquier `tsc` fuera de Astro escupe `Property 'env' does not exist on type 'ImportMeta'`. Es ruido preexistente de todo el proyecto, no de este módulo. Para revisar tipos de este módulo: `npx tsc --noEmit -p tsconfig.demanda.json` y descartar esas líneas.
- **El `tsc` completo hace OOM** en este servidor (ya documentado): usar siempre un tsconfig acotado.

---

## Etapa 1 · Inteligencia — lo que sigue

Orden de tareas en `ANALISIS-DEMAND-ENGINE.md` §7. Las dos primeras (E1.1 Search Console y E1.2 analítica) **están bloqueadas hasta que el dueño dé los accesos**; lo que sí se puede adelantar sin él:

1. **E1.5 · Demanda de primera mano del CRM** (no necesita nada de fuera): motivos de pérdida, preguntas de leads en WhatsApp anonimizadas, tickets de soporte → `de_senales`. Incluye la prueba automática de «cero PII».
2. **E1.4 · Normalización, embeddings y clusters** sobre esas señales (usa `OPENAI_API_KEY`, que ya está).
3. **E1.3 · Inventario de páginas** desde el sitemap y `src/pages` (no necesita nada).
4. **E1.10 · Competidores**: semilla y diff de sitemaps (lectura pública).
5. Cuando lleguen los accesos: E1.1, E1.2, E1.6 (Reddit/YouTube), E1.8 (movimientos SEO) y E1.9 (score).

### Lo que hace falta del dueño
| Qué | Para | Costo |
|---|---|---|
| Cuenta de servicio de Google como usuario **Completo en Search Console** + guardar la propiedad en Ajustes | E1.1 · demanda observada de buscadores | gratis |
| Id de propiedad **GA4** + la cuenta de servicio como Lector | E1.2 | gratis |
| `GOOGLE_API_KEY_PSI` y `GOOGLE_API_KEY_YT` en Vercel | Core Web Vitals y YouTube | gratis |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Comunidades | gratis |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | Volumen, SERP y AI Overview | ~$30-60/mes |
| `PERPLEXITY_API_KEY` y `XAI_API_KEY` | Etapa 3 (visibilidad en IA) | ~$20/mes |

El nombre exacto de cada variable y cómo se arregla cada hueco están en `src/lib/demanda/conectores.ts` y se ven en **Sistema → Lo que me falta**.

### Cómo arranca el motor cuando lleguen los accesos
1. Poner las llaves en Vercel y desplegar (una variable nueva no entra al despliegue vivo).
2. En **Sistema → Ajustes**, encender las fuentes que ya digan disponible.
3. **Correr un ciclo** desde el botón, y mirar la Cola.
4. Subir la autonomía de 2 a 3 cuando la primera tanda de contenido pase sus auditorías.
