# PLAN · SACS DEMAND ENGINE («Motor de demanda»)

**Estado:** plan completo, esperando el OK del dueño para arrancar F0.
**Autor del plan:** Fable 5.1 (15-sep-2026). **Operador del desarrollo:** Opus 5, por etapas y tareas, calificándose solo antes de avanzar.
**Repo:** `/opt/sacs/paginawebsacs/sitio` (Astro 6 + React 19, `output:'static'` + adaptador Vercel, Supabase `wtzhogdyicekxcnclmyu`).
**Estado vivo entre corridas:** `sitio/ESTADO-DEMAND-ENGINE.md` (lo crea la primera corrida de F0 y lo actualiza cada corrida).

---

## 0. En una pantalla

**North Star:** capturar la mayor parte posible de la demanda de fashion retail (México → LATAM → global) y convertirla en usuarios y clientes de Sacs. No es «más contenido», «más keywords» ni «más tráfico».

**Lo que se construye:** una sección nueva del CRM —**Demand Engine**— que todos los días, sola:

1. recolecta señales (Search Console, GA4, CRM, foros, competidores, respuestas de las IAs),
2. las normaliza en problemas canónicos (clusters semánticos con pgvector),
3. las convierte en oportunidades con un score 0-100 que se recalibra con resultados reales,
4. ejecuta lo que su nivel de autonomía permite (contenido, enlaces, arreglos técnicos, prompts, herramientas),
5. mide (Search Visibility, AI Visibility, Demand Capture Score) y liga cada lead/cliente a la query, prompt, herramienta o página que lo trajo,
6. aprende (predicción vs. resultado → pesos nuevos) y deja armada la cola del día siguiente.

**Tres motores que comparten datos:** buscadores (SEO), descubrimiento en IA (ChatGPT/Claude/Gemini/Perplexity/Grok/Google AI = GEO) y distribución de producto (herramientas gratis, API, MCP, skills).

**Regla de datos (inmutable):** toda señal lleva `naturaleza` ∈ {OBSERVADA, INFERIDA, ESTIMADA, GENERADA} + fuente + URL + fecha + país + idioma + confianza. Nunca se presenta una inferencia como dato. Si una plataforma no se pudo medir, la muestra dice `NO_DISPONIBLE`.

**Orden de construcción (una fase funcional completa antes de la siguiente):**
F0 Cimientos → F1 Inteligencia → F2 Ejecución → F3 GEO → F4 Productos de adquisición → F5 Aprendizaje y atribución → F6 Autonomía continua y autoadministración.

---

## 1. Lo que YA existe y se reutiliza (inspección del 15-sep-2026)

No se construye un CRM nuevo ni una infraestructura de agentes nueva. Lo encontrado:

| Pieza | Dónde | Cómo se reutiliza |
|---|---|---|
| Cliente IA con costo por llamada | `src/lib/ai/client.ts` (`anthropic` proxy → tabla `ia_uso`, `MODELS`, `PRICING`, `calculateCost`) | TODA llamada del motor pasa por aquí. Se actualiza `MODELS` a `claude-opus-5` / `claude-sonnet-5` / `claude-haiku-4-5` y `PRICING` (Sonnet 5 = $2/$10). |
| Auditoría de corridas de agentes | `src/lib/ai/audit.ts` → tabla `agent_runs` (particionada por mes, con tokens, costo, `tool_calls`, `reasoning`, `parent_run_id`) | Cada agente del motor crea su `agent_run`; `de_ciclos` agrupa las corridas de un ciclo. NO se crea otra tabla de runs. |
| Registro de herramientas con políticas | `src/lib/agent-tools/{define,middleware,FORBIDDEN}.ts` + tablas `agent_policies`, `agent_configs`, `agent_tool_log` | Las herramientas de escritura del motor se definen con `defineTool` y pasan por `executeTool` (FORBIDDEN + política + límite diario + log). |
| Crons de Vercel con auth | `vercel.json` (45 crons) + `src/lib/auth/cron.ts` (`isAuthorizedCron`: header `x-vercel-cron` o `Bearer CRON_SECRET`) + `maxDuration: 300` | El worker y los ciclos del motor son crons más. Regla del repo: cada cron ≤ 240 s de trabajo, continúa por cursor. |
| Inngest (6 agentes, keys en Vercel) | `src/inngest/*`, `/api/inngest` | NO se usa para el motor (una sola mecánica de cola, visible en el CRM). Se deja intacto. |
| Base de conocimiento del producto | `src/lib/crm/ti/conocimiento/{giros,planes,producto,casos}.ts`, `wiki-comercial.ts`, tabla `plans` (7 licencias + 15 plugins), `src/data/product-pages.ts`, `src/data/giros/*` | Semilla de la **Knowledge Base aprobada** (`de_conocimiento`). Los precios salen de `plans`, nunca se inventan. |
| pgvector 0.8 + `kb_chunks` (vector(1536), 12 filas) | Supabase | Embeddings para clusters y dedupe semántico. Modelo: `text-embedding-3-small` (OpenAI, key ya en Vercel), 1536 dims — compatible con `kb_chunks`. |
| Atribución de marketing | cookie `sacs_attr` (BaseLayout), `lib/atribucion-marketing.ts`, columnas `contacts.utm_*`, `fuente_detalle`, `visitor_id`, `propiedades.atribucion`; `bookings.atribucion`; `wa_intentos`; `contact_visits` (8,550 filas, con `referrer`), `PageTracker.astro` → `/api/tracking/identify`; `web_reglas` | El motor NO reinventa el tracking: agrega el canal **IA** (referrers `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`, `claude.ai`, `x.com/i/grok` y `utm_source=chatgpt.com`) y liga visita → página/herramienta → lead → deal → suscripción. |
| Datos comerciales de primera mano | `contacts` (383), `companies` (350), `deals`, `quotes`, `subscriptions`, `bookings`, `crm_lead_motivos` (razones de pérdida), `wa_conversaciones`/`wa_mensajes`, `crm_soporte_tickets`, `ti_perfil` | Fuente FIRST-PARTY de demanda: preguntas de prospectos, funciones pedidas, motivos de pérdida, giros, sucursales. Se lee con permisos y se anonimiza antes de que un agente lo vea. |
| Google | `GOOGLE_SERVICE_ACCOUNT_B64` (cuenta de servicio ya usada por Sheets), `googleapis` instalado, `GOOGLE_PLACES_API_KEY`, `GEMINI_API_KEY` | La MISMA cuenta de servicio se agrega como usuario en Search Console y GA4 → conectores sin OAuth ni pantallas nuevas. |
| Otras llaves ya en Vercel | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `RESEND_API_KEY`, `SENDGRID_*`, `POSTHOG` (público) | GEO por API directa (OpenAI + Gemini + Anthropic); faltan Perplexity y xAI. |
| Menú y permisos del CRM | `CrmDashboard.tsx` (`NAV_SECTIONS`, `ESCALERA` rosa→morado, iconos Editorial, `lazySeguro`), `lib/crm/permisos.ts` (8 secciones), `lib/crm/layout.ts` (`WRAP`), `lib/crm/paleta.ts`, `TablaEnterprise`, `ui/Sheet`, `useIsMobile` | Sección nueva `demanda` con su escalón de color, su permiso y sus pantallas con el mismo marco. |
| Sitio público | 107 páginas Astro (40 giros, /soluciones, /producto/[slug], /enterprise, /planes, blog con 3 posts), `SEO.astro`, `StructuredData.astro`, `@astrojs/sitemap`, `robots.txt` (ya permite GPTBot, ClaudeBot, PerplexityBot, Google-Extended) | Inventario inicial de páginas; el contenido nuevo del motor NO se mete como páginas estáticas (ver decisión D3). |
| Reglas de la casa | `CLAUDE.md`: commit siempre / push solo cuando el dueño lo diga; el build de Vercel es el costo; cada deploy para los crons; migraciones en `sitio/supabase/migrations/` y SQL vía Management API | Decisión D3 nace de aquí: publicar contenido no puede depender de un build. |

---

## 2. Decisiones de arquitectura (con su porqué)

**D1 · Estado en Supabase, prefijo `de_`.** Igual que `ti_*`, `abm_*`, `ev_*`, `fin_*`. Nombres en español como el código reciente. Migraciones aditivas, nunca destructivas.

**D2 · Una sola cola y un solo worker.** Tabla `de_acciones` (JOB → QUEUE → WORKER → RESULT → NEXT) tomada con `FOR UPDATE SKIP LOCKED` por el cron `/api/cron/de-worker` cada 5 min. Inngest se queda como está pero no se usa: la cola tiene que verse y aprobarse desde el CRM, y un deploy de Vercel no debe perder trabajo (la cola persiste; el worker retoma).

**D3 · El contenido que publica el motor vive en la base y se sirve dinámico.** Rutas `prerender=false`: `/recursos/[slug]`, `/comparar/[slug]`, `/software-para/[slug]` leen `de_contenido` y se cachean en el CDN (`s-maxage=3600, stale-while-revalidate`). Sitemap propio `/sitemap-demanda.xml` (registrado en Search Console y en `robots.txt`). **Por qué:** la regla del repo es «push solo cuando el dueño lo diga» y cada build cuesta y detiene los crons; si publicar exigiera build, no habría autonomía. Las páginas hechas a mano (giros, soluciones, home) siguen estáticas; tocarlas es una acción de **código** (D5).

**D4 · Dos planos de ejecución.** (a) *Plano producto* — Vercel + Supabase: ingestión, detección, clusters, score, GEO, competidores, briefs, borradores, auditorías, publicación en `de_contenido`, enlaces, métricas, aprendizaje. (b) *Plano repo* — Claude Code (Opus) en el servidor: acciones `tipo='codigo'` (página estática nueva, arreglo técnico en Astro, herramienta gratis nueva, schema en layouts). El operador las toma de la cola, implementa, prueba y **commitea**; el push sigue siendo del dueño = su aprobación.

**D5 · Niveles de autonomía por tipo de acción, riesgo por acción.** Tabla `de_politicas` (tipo_accion → nivel 0-4, riesgo LOW/MEDIUM/HIGH/CRITICAL). LOW corre solo; MEDIUM según nivel; HIGH pide aprobación en la pestaña Aprobaciones; CRITICAL nunca corre sola. Los guardrails (FORBIDDEN, riesgo CRITICAL, esta matriz) no los cambia ningún agente.

**D6 · Modelos por trabajo.** Haiku 4.5 (`claude-haiku-4-5`) para clasificar, normalizar, resumir, monitoreo rutinario — vía **Batches API** (50 % de costo) cuando no urge. Sonnet 5 (`claude-sonnet-5`) para briefs, borradores, auditorías, análisis de SERP/competidor. Opus 5 (`claude-opus-5`, thinking adaptativo, `effort` high) para estrategia semanal/mensual, decisiones de producto, contenido pilar. Embeddings: `text-embedding-3-small`.

**D7 · GEO por API directa, no por scraping.** ChatGPT (OpenAI Responses API con `web_search`), Gemini (grounding con Google Search), Claude (`web_search_20260209`), Perplexity (Sonar), Grok (xAI con live search). Google AI Overviews: solo si se contrata DataForSEO SERP (trae `ai_overview`); si no, `NO_DISPONIBLE`. Cada muestra guarda la respuesta completa y se repite con el mismo prompt/país/idioma para que la serie sea comparable.

**D8 · SEO técnico con rastreador propio + APIs oficiales.** Crawler en el worker (fetch + parse HTML, por lotes de ≤150 URLs por corrida, cursor en la acción). Indexación y estado: Search Console URL Inspection (cuota 2,000/día). Core Web Vitals: PageSpeed Insights API (gratis con key). Nada de servicios de rastreo de pago mientras el sitio tenga <2,000 URLs.

**D9 · Idempotencia por `clave_idem`.** Toda acción, señal, issue, prompt, oportunidad, contenido y experimento lleva una clave única determinista (hash de tipo+sujeto+ventana). Repetir un ciclo no duplica nada; el `ON CONFLICT` es la regla, no la excepción. Antes de crear oportunidad/contenido/herramienta/prompt: búsqueda semántica (cosine > 0.92) → se fusiona, no se duplica.

**D10 · Nada de páginas programáticas sin sustancia.** Una página programática solo nace si su cluster tiene ≥1 señal OBSERVADA, contenido propio (dato del ramo, bloque específico como ya hacen las páginas de giro) y pasa las 9 auditorías de contenido. Tope: 5 páginas programáticas/semana en F2, revisado en la rutina semanal.

**D11 · Reutilizar, no clonar.** `agent_runs`, `ia_uso`, `agent_policies`, `agent_tool_log`, `contacts`/`companies`/`deals`/`subscriptions`, `contact_visits`, `crm_notificaciones` (alertas), `plans`. El motor agrega tablas `de_*` para lo que no existe.

---

## 3. Esquema de datos (`de_*`)

Migración `sitio/supabase/migrations/2026-09-XX-demand-engine-F0.sql` (una por fase). Todas con `id uuid default gen_random_uuid()`, `created_at`/`updated_at timestamptz`, RLS igual que el resto del CRM (service key desde el servidor; nada expuesto al cliente).

| Tabla | Para qué | Columnas clave |
|---|---|---|
| `de_config` | Una fila: configuración viva | `autonomia_global int`, `presupuesto_mensual_usd`, `mercados text[]` (`MX`, luego `CO`,`CL`,`PE`,`AR`,`ES`,`US`), `idiomas text[]`, `umbrales jsonb`, `pesos_version`, `kill_switch bool` |
| `de_conectores` | Fuentes activables desde Ajustes | `tipo` (gsc, ga4, crm, autocomplete, trends, reddit, youtube, serp, keywords, pagespeed, competidor_sitemap, ia_openai, ia_gemini, ia_anthropic, ia_perplexity, ia_xai, dataforseo), `nombre`, `activo`, `config jsonb` (sin secretos: los secretos viven en env), `cadencia`, `ultimo_ok_at`, `ultimo_error`, `cuota_dia`, `uso_dia` |
| `de_senales` | Señal cruda (todo lo que entra) | `clave_idem unique`, `tipo_fuente`, `fuente`, `fuente_url`, `observada_at`, `pais`, `idioma`, `naturaleza` (observada/inferida/estimada/generada), `tipo_senal`, `query_cruda`, `texto`, `payload jsonb`, `confianza numeric`, `query_id`, `cluster_id`, `icp text[]`, `procesada bool` |
| `de_queries` | Query normalizada (una por texto normalizado+país+idioma) | `texto_norm unique(…)`, `texto_original`, `pais`, `idioma`, `intent` (informacional/comercial/transaccional/navegacional/comparativa), `intent_comercial numeric`, `embedding vector(1536)`, `cluster_id`, `volumen_estimado int`, `volumen_naturaleza`, `dificultad`, `posicion_actual`, `pagina_actual`, `clics_28d`, `impresiones_28d`, `tendencia`, `fuentes text[]`, `senales_n` |
| `de_clusters` | Problema canónico (la Demand Database del prompt §9) | `problema_canonico`, `categoria`, `subcategoria`, `etapa_journey`, `icp text[]`, `pais text[]`, `idioma`, `embedding_centroide`, `naturaleza_dominante`, `frecuencia_estimada`, `tendencia`, `dificultad`, `relevancia_sacs`, `potencial_conversion`, `potencial_herramienta`, `potencial_contenido`, `potencial_red`, `valor_dato`, `potencial_distribucion_ia`, `confianza`, `score_oportunidad`, `estado`, `queries_n`, `senales_n`, `capturado_por` (quién gana hoy), `pagina_sacs` |
| `de_taxonomia` | Categorías del journey (semilla: las 50 del prompt §7) + nuevas que proponga el motor con aprobación | `id text pk`, `nombre`, `etapa_macro` (crear/publicar/promocionar/vender/operar/comprar/distribuir/retener/analizar), `activa`, `propuesta_por` |
| `de_icp` | ICP (semilla §8) | `id text pk`, `nombre`, `eje` (tamaño/modelo/mercancía/canal), `prioridad`, `activo` |
| `de_oportunidades` | Backlog priorizado | `clave_idem unique`, `tipo` (los 23 de §20), `cluster_id`, `titulo`, `descripcion`, `score int`, `desglose jsonb` (cada factor), `pesos_version`, `estado` (nueva/evaluando/aprobada/en_curso/publicada/medida/descartada), `riesgo`, `accion_recomendada`, `esfuerzo` (S/M/L), `impacto_esperado`, `prediccion_id`, `resultado jsonb`, `descubrimiento_tipo` (marketing/producto/integracion/dato/red/marketplace/api/skill), `efectos jsonb` (1º/2º/3º orden) |
| `de_predicciones` | Predicción antes de actuar (§22) | `oportunidad_id`, `accion_id`, `esperado jsonb` (trafico, visibilidad, leads, tiempo_a_resultado_dias, costo_usd), `confianza`, `horizonte_dias`, `evaluar_at`, `real jsonb`, `evaluada_at`, `error_relativo`, `veredicto` |
| `de_competidores` | Perfiles | `nombre`, `dominio`, `tipo` (plataforma/erp/pos/herramienta_nicho/regional), `categorias text[]`, `mercados text[]`, `descubierto_por`, `activo`, `sitemap_url`, `ultimo_snapshot_at` |
| `de_competidor_snapshots` | Solo cambios relevantes (§18) | `competidor_id`, `fecha`, `tipo_cambio` (pagina_nueva/herramienta/funcion/precio/integracion/posicionamiento/ranking/cita_ia), `url`, `resumen`, `evidencia jsonb`, `relevancia`, `clave_idem unique` |
| `de_gsc_diario` | Search Console crudo | unique `(fecha, query, pagina, pais, dispositivo)`, `clics`, `impresiones`, `ctr`, `posicion` |
| `de_ga4_diario` | GA4 crudo por página y canal | unique `(fecha, pagina, canal, pais)`, `sesiones`, `usuarios`, `conversiones jsonb`, `fuente_medio` |
| `de_paginas` | Inventario de URLs propias | `url unique`, `tipo` (estatica/dinamica/herramienta), `origen` (repo/de_contenido), `cluster_id`, `titulo`, `h1`, `meta_desc`, `canonical`, `estado_http`, `indexable`, `indexada_gsc`, `rastreada_at`, `palabras`, `enlaces_in`, `enlaces_out`, `schema_tipos text[]`, `cwv jsonb`, `decay_estado`, `decay_detalle jsonb`, `huerfana bool` |
| `de_pagina_metricas` | Serie diaria por página | unique `(fecha, url)`, `clics`, `impresiones`, `posicion`, `sesiones`, `sesiones_ia`, `leads`, `demos` |
| `de_issues` | Cola técnica priorizada (§11) | `clave_idem unique`, `tipo` (los 30 de §11), `severidad`, `url`, `detalle jsonb`, `estado` (abierto/en_cola/resuelto/ignorado), `detectado_at`, `resuelto_at`, `accion_id` |
| `de_enlaces` | Grafo interno | unique `(desde, hacia)`, `anchor`, `tipo` (nav/cuerpo/pie/relacionado), `visto_at` |
| `de_prompts_ia` | Base de prompts (§14) | `clave_idem unique`, `prompt`, `pais`, `idioma`, `icp`, `cluster_id`, `categoria`, `activo`, `frecuencia_dias`, `origen` (semilla/motor/lead/humano) |
| `de_ia_muestras` | Una medición (prompt×plataforma×fecha) | `prompt_id`, `plataforma` (chatgpt/claude/gemini/perplexity/grok/google_ai), `modelo`, `fecha`, `estado` (ok/no_disponible/error), `sacs_mencionado bool`, `posicion int`, `fuerza_recomendacion` (0-3), `sentimiento`, `competidores text[]`, `citas jsonb`, `urls_citadas text[]`, `url_sacs_citada`, `resumen_razon`, `respuesta jsonb`, `confianza`, `costo_usd` |
| `de_contenido` | Brief → borrador → publicado (§23) | `clave_idem unique`, `oportunidad_id`, `cluster_id`, `tipo` (articulo/landing/comparativa/programatica/actualizacion/dataset/reporte), `slug unique`, `ruta` (/recursos, /comparar, /software-para), `titulo`, `h1`, `brief jsonb` (los 21 campos de §23), `cuerpo_md`, `cuerpo_html`, `schema_json jsonb`, `estado` (brief/borrador/auditando/aprobado/publicado/refrescar/retirado), `auditorias jsonb` (hechos/calidad/seo/geo/duplicado/canibalizacion/marca: score+notas), `version`, `publicado_at`, `actualizado_at`, `autor`, `cta_tipo`, `herramienta_id` |
| `de_contenido_versiones` | Historial | `contenido_id`, `version`, `cuerpo_md`, `brief jsonb`, `motivo`, `creada_por` |
| `de_conocimiento` | Knowledge Base aprobada de Sacs (§25) | `tipo` (producto/modulo/funcion/integracion/icp/precio/caso_uso/cliente_autorizado/testimonio/comparativa/manual/mensaje/terminologia/claim_permitido/claim_prohibido), `titulo`, `contenido`, `fuente`, `aprobado bool`, `aprobado_por`, `vigente_desde`, `embedding` |
| `de_herramientas` | Ideas y MVPs (§26-28) | `slug unique`, `nombre`, `cluster_id`, `estado` (idea/evaluada/mvp/publicada/retirada), `viralidad jsonb` (9 factores), `score`, `ruta`, `momento_sacs` (dónde Sacs multiplica), `usos_30d`, `leads_30d`, `demos_30d`, `clientes` |
| `de_herramienta_usos` | Evento de uso | `herramienta_id`, `visitor_id`, `contact_id`, `entrada jsonb` (sin PII), `resultado_resumen`, `compartido bool`, `cta_clic bool`, `at` |
| `de_experimentos` | §52 | `hipotesis`, `metrica`, `linea_base jsonb`, `variacion jsonb`, `control jsonb`, `inicio`, `fin`, `muestra_min`, `resultado jsonb`, `confianza`, `aprendizaje`, `siguiente_accion`, `estado` |
| `de_acciones` | LA COLA (§38) | `clave_idem unique`, `tipo`, `prioridad int`, `estado` (pendiente/lista/corriendo/terminada/fallida/muerta/necesita_aprobacion/aprobada/rechazada/para_operador), `payload jsonb`, `agente`, `intentos`, `max_intentos`, `programada_at`, `iniciada_at`, `terminada_at`, `error jsonb`, `resultado jsonb`, `creada_por`, `depende_de uuid`, `ciclo_id`, `run_id`, `riesgo`, `nivel_requerido`, `aprobada_por`, `aprobada_at`, `lease_hasta` |
| `de_politicas` | Matriz de autonomía (§48-49) | `tipo_accion pk`, `nivel int` (0-4), `riesgo`, `requiere_aprobacion bool`, `tope_dia int`, `notas`, `inmutable bool` |
| `de_ciclos` | Una fila por ciclo diario/semanal/mensual/evento | `tipo`, `inicio`, `fin`, `estado`, `objetivo`, `resumen jsonb` (§70: acciones, cambios, archivos, db, pruebas, resultado, issues, métricas, costo, siguientes), `top5 jsonb`, `costo_usd`, `runs uuid[]` |
| `de_aprendizajes` | §51 | `tipo` (prediccion_vs_real/patron/recalibracion/omision_humana), `sujeto_tipo`, `sujeto_id`, `hallazgo`, `evidencia jsonb`, `propuesta jsonb`, `estado` (propuesto/aprobado/aplicado/rechazado) |
| `de_pesos` | Versiones de los pesos del score (§21) | `version int pk`, `pesos jsonb`, `motivo`, `evidencia jsonb`, `vigente bool`, `creada_por`, `aprobada_por` |
| `de_atribucion` | Toques y conversiones (§34-35) | `contact_id`, `company_id`, `visitor_id`, `tipo_toque` (primero/ultimo/asistido), `canal` (organico/ia/directo/referido/social/herramienta/pagado/partner), `url`, `query`, `prompt_id`, `herramienta_id`, `contenido_id`, `cluster_id`, `campana`, `at` |
| `de_metricas_diarias` | Series de los scores | unique `(fecha, metrica, dimension, valor_dim)`, `valor numeric`, `detalle jsonb` — métricas: `dcs`, `svs`, `avs`, `trafico_organico`, `trafico_ia`, `leads_organicos`, `leads_ia`, `pipeline`, `mention_rate`, `citation_rate`, `sov_ia`, `top3_rate`, `cobertura_prompts` |
| Vistas | `v_de_ingresos_por_origen` (query/prompt/herramienta/página → leads → demos → clientes → ARR), `v_de_resumen_hoy` (lo que cambió y lo que importa) | |

RPC: `de_tomar_acciones(n int)` (`UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING`), `de_buscar_similares(embedding, umbral, tabla)`.

---

## 4. Motor: cola, agentes, políticas

### 4.1 Cola y worker
- `lib/demanda/cola.ts`: `encolar({tipo, payload, prioridad, clave_idem, depende_de, programada_at})` (upsert por `clave_idem`), `tomar(n)`, `terminar`, `fallar` (backoff `min(2^intentos × 5 min, 6 h)`, `max_intentos` por tipo, luego `muerta` + notificación en `crm_notificaciones`).
- `api/cron/de-worker.ts` cada 5 min: toma hasta 8 acciones `lista` cuyas dependencias terminaron, ejecuta `HANDLERS[tipo]` con presupuesto de tiempo (240 s total; cada handler recibe `deadline`), guarda resultado, encola la siguiente si el handler lo pide. Un fallo de un conector no toca a los demás (cada uno es su propia acción).
- Antes de correr: `de_politicas[tipo]` → si `nivel_requerido > de_config.autonomia_global` o `requiere_aprobacion` → `necesita_aprobacion` (aparece en la pestaña Aprobaciones; el dueño aprueba/rechaza; aprobada vuelve a `lista`). `kill_switch` detiene todo salvo lectura.
- Acciones `tipo='codigo'` → `para_operador`: el operador Claude Code las lista con `node scripts/de-operador.mjs --pendientes`, las toma (`--tomar id`), y al terminar `--cerrar id --commit <sha>`.

### 4.2 Agentes (todos con `agent_runs` + `ia_uso`)
| Agente | Modelo | Qué hace | Cadencia |
|---|---|---|---|
| **Orquestador** | código + Opus 5 (solo para decidir prioridades de la semana) | Arma la cadena de acciones del ciclo; cierra el ciclo con TOP 5 | diario / semanal / mensual / evento |
| **Investigador de demanda** | Haiku 4.5 (Batches) | Convierte texto crudo (foros, YouTube, conversaciones WA anonimizadas, motivos de pérdida) en señales tipadas | diario |
| **Analista SEO** | código + Sonnet 5 | Movimientos GSC (pos 4-20, CTR bajo, caídas, queries nuevas, canibalización, query sin página) → oportunidades/issues | diario |
| **SEO técnico** | código | Crawler, URL Inspection, PSI → `de_issues` | semanal (crawl) / diario (sitemap + status) |
| **Analista GEO** | los 5 proveedores + Haiku 4.5 (parsear) | Muestreo de prompts, extracción de menciones/citas/competidores, AVS | diario (muestra) / semanal (barrido completo) |
| **Competidores** | código + Sonnet 5 | Diff de sitemaps, páginas nuevas, precios públicos, menciones en IA | semanal, resumen de cambios |
| **Estratega de contenido** | Sonnet 5 / Opus 5 (pilares) | Decide qué contenido responde a qué cluster; brief de 21 campos | por oportunidad |
| **Creador de contenido** | Sonnet 5 (Opus 5 pilares) | Borrador desde brief + `de_conocimiento` obligatorio | por brief |
| **Auditor de contenido** | Sonnet 5 | 9 auditorías; bloquea si hay claim no aprobado, duplicado (>0.9), canibalización, dato sin fuente | por borrador |
| **Estratega de herramientas** | Opus 5 | ¿Se resuelve gratis con una herramienta? 9 factores de viralidad, momento Sacs, efectos 1º-3º | semanal |
| **Inteligencia de producto** | Opus 5 | Demanda que Sacs no cubre → roadmap (MARKETING/PRODUCT/INTEGRATION/DATA/NETWORK/MARKETPLACE/API/AI SKILL) | mensual |
| **Autoridad** | Sonnet 5 | Entidad Sacs: schema, menciones, directorios, PR digital (propone, nunca manda mensajes masivos) | semanal |
| **Analítica** | código | KPIs, scores, series | diario |
| **Experimentos** | código + Sonnet 5 | Crea/lee experimentos; nunca declara ganador sin muestra mínima | diario |
| **Aprendizaje** | Opus 5 | Predicción vs real, patrones, propone pesos nuevos | semanal (evaluar) / mensual (recalibrar) |

Subagentes solo cuando hay trabajo paralelo real (ej. 5 plataformas de IA, 40 competidores). Nada de subagentes para clasificar una fila.

### 4.3 Matriz de autonomía (semilla de `de_politicas`)
| Tipo de acción | Nivel | Riesgo | Aprobación |
|---|---|---|---|
| Ingerir datos, recalcular métricas y scores | 4 | LOW | no |
| Crear/actualizar señal, query, cluster, oportunidad, issue, prompt, snapshot | 4 | LOW | no |
| Crear brief y borrador (`de_contenido` en borrador) | 4 | LOW | no |
| Publicar contenido nuevo en `/recursos` (dinámico) | 2 al inicio → 3 cuando 20 publicaciones seguidas pasen auditoría ≥ 9/10 | MEDIUM | configurable en Ajustes |
| Refrescar contenido ya publicado por el motor | 3 | MEDIUM | no (reversible: versiones) |
| Corregir enlaces internos en contenido dinámico | 4 | LOW | no |
| Cambiar título/meta/H1 de página estática, enlaces en páginas estáticas, arreglos técnicos | 2 (`codigo` → operador → commit) | MEDIUM | el push del dueño |
| Página programática nueva | 2 | MEDIUM | sí (F2), configurable después |
| Publicar herramienta gratis nueva | 2 (`codigo`) | HIGH | sí |
| Modificar home, /planes, /enterprise, nav | 1 | HIGH | sí, siempre |
| Outreach externo (PR, partners, medios) | 1 | HIGH | sí, siempre; nunca masivo |
| Cambiar precios, borrar contenido, cambiar políticas/pesos vigentes, cambios destructivos en base | 0 | CRITICAL | nunca autónomo |

---

## 5. Conectores (fuentes)

Cada conector: `lib/demanda/conectores/<tipo>.ts` con `probar()`, `ingerir(ventana)` → `de_senales`/tablas crudas, `estado()`. Activación en Ajustes; secretos en Vercel; cuota diaria por conector.

| Conector | Naturaleza | Estado hoy | Lo que hace falta |
|---|---|---|---|
| **Search Console** (`searchanalytics.query`, `sitemaps`, `urlInspection`) | OBSERVADA | cuenta de servicio ya existe | **DUEÑO:** agregar el `client_email` de la cuenta de servicio como usuario (Completo) en la propiedad `sc-domain:sacscloud.com` (o `https://www.sacscloud.com/`). Gratis. |
| **GA4 Data API** (`runReport`) | OBSERVADA | misma cuenta de servicio; `PageTracker`/PostHog ya miden | **DUEÑO:** ID de propiedad GA4 + agregar la cuenta de servicio como Lector. Si no hay GA4, se usa `contact_visits` + PostHog como fuente de sesiones (OBSERVADA parcial) y se marca en Ajustes. |
| **CRM (first-party)** | OBSERVADA | todo en Supabase | nada; el investigador lee `crm_lead_motivos`, `wa_mensajes` (entrantes, anonimizados), `crm_soporte_tickets`, `bookings.respuestas`, `deals`, `contacts.giro/sucursales` |
| **Google Autocomplete** | OBSERVADA (sin volumen) | endpoint público `suggestqueries` | tope 300 consultas/día; se etiqueta fuente `autocomplete` |
| **Google Trends** | ESTIMADA | sin API oficial | vía DataForSEO Trends (si se contrata) o `NO_DISPONIBLE` |
| **Volumen de keywords + SERP + Labs de competidores + AI Overview** | ESTIMADA / OBSERVADA | ninguno | **DUEÑO (recomendado):** cuenta **DataForSEO** pago por uso (depósito inicial $50-100 USD; estimado $30-60/mes). Cubre Keywords Data (volúmenes de Google Ads), SERP con `ai_overview`, Labs (keywords de competidores, ranked keywords), Backlinks básico. Alternativa gratis parcial: Keyword Planner exige cuenta de Google Ads con gasto. |
| **PageSpeed Insights / CrUX** | OBSERVADA | ninguno | **DUEÑO:** key de Google Cloud (gratis, misma consola donde ya vive Places). |
| **YouTube Data API** | OBSERVADA | ninguno | **DUEÑO:** habilitar YouTube Data API v3 en la misma consola (gratis, 10k unidades/día). Busca videos/títulos/comentarios del ramo. |
| **Reddit API** | OBSERVADA | ninguno | **DUEÑO:** crear app en reddit.com/prefs/apps (gratis, 100 req/min). Subreddits: r/ecommerce, r/shopify, r/FashionReps no, r/smallbusiness, r/mexico (hilos de negocio), r/emprendedores. |
| **Quora / TikTok público / foros** | OBSERVADA | sin API | fuera del MVP; se agregan como conector `manual` (pegar URL → el investigador extrae) y, si se contrata, vía DataForSEO Content Analysis. |
| **Competidores (sitemaps, changelogs, pricing)** | OBSERVADA | fetch propio | nada; semilla: Shopify, Lightspeed, Odoo, NetSuite, Oracle Retail, Cegid, Cin7, TiendaNube, Bind ERP, Contpaqi, Microsip, Alegra, Siigo, Bsale, Nubox, Ecwid, Wix, Vend, Square, WooCommerce; herramientas nicho (Botika/Vmake/Zmo AI para modelos IA, Inventory Planner, Prediko, Faire/Brandboom/JOOR para B2B, Wati/Treble/Kommo para WhatsApp) — el motor descubre más por SERP y por menciones en IA. |
| **IA: OpenAI** | OBSERVADA (muestra) | key en Vercel | nada; Responses API + `web_search` |
| **IA: Gemini** | OBSERVADA | key en Vercel | migrar a SDK `@google/genai` (grounding); `@google/generative-ai` queda para lo existente |
| **IA: Claude** | OBSERVADA | key en Vercel | `web_search_20260209` con Sonnet 5 |
| **IA: Perplexity** | OBSERVADA | ninguno | **DUEÑO:** key de Perplexity API (Sonar, ~$5 de crédito inicial; ~$10/mes) |
| **IA: Grok** | OBSERVADA | ninguno | **DUEÑO:** key de xAI API (~$10/mes) |
| **Google AI Overviews / AI Mode** | OBSERVADA | ninguno | solo con DataForSEO SERP; si no, `NO_DISPONIBLE` |
| **Bing Webmaster** | OBSERVADA | ninguno | opcional F5: API key de Bing Webmaster Tools (gratis) |

---

## 6. Los motores (lógica que vive en `lib/demanda/`)

- **`normalizar.ts`** — texto → `texto_norm` (minúsculas, sin acentos con `unaccent`, sin stopwords, lematización ligera) → embedding → `de_queries`; `agrupar()` asigna cluster por cosine ≥ 0.85 al centroide o crea cluster; Haiku nombra el problema canónico y asigna categoría/etapa/ICP/intent con `output_config.format` (JSON estricto). Las queries originales se conservan siempre.
- **`score.ts`** — `score(oportunidad, pesos)`; factores 0-100: demanda (volumen + señales + tendencia), relevancia Sacs (KB + ICP), intención comercial, probabilidad de conversión (histórico de `v_de_ingresos_por_origen`), capacidad de ganar (dificultad, autoridad, quién captura hoy), potencial de distribución, ventaja de red/dato, eficiencia de implementación. Pesos iniciales 20/15/15/15/10/10/10/5 en `de_pesos v1`.
- **`seo/movimientos.ts`** — reglas sobre `de_gsc_diario` (ventanas 7/28 vs 28 anteriores): pos 4-20 con impresiones ≥ 50 → `SEO_CONTENT`/`CONTENT_REFRESH`; impresiones altas + CTR < mediana del rango → `titulo_meta`; caída de posición ≥ 3 → alerta; query nueva con ≥ 20 impresiones → cluster; página perdiendo ≥ 30 % clics → `decay`; ≥ 2 páginas para la misma query con posiciones alternando → `canibalizacion`; query con impresiones y sin página con intent coincidente → `LANDING_PAGE`.
- **`seo/rastreo.ts`** — crawler (fetch, parse5/cheerio-lite sin dependencias pesadas: usar `node-html-parser`), reglas técnicas → `de_issues`; `enlaces.ts` grafo + huérfanas + profundidad; `cwv.ts` PSI.
- **`decay.ts`** — para cada página con caída: SERP actual (si hay proveedor) + preguntas nuevas del cluster + fecha + enlaces → estrategia de actualización en un brief `tipo='actualizacion'`; guarda línea base para medir antes/después.
- **`programatico.ts`** — dimensiones (giro × problema × tamaño × canal × integración × país); candidato solo si hay señal OBSERVADA + bloque propio; tope semanal.
- **`geo/muestrear.ts`** — un proveedor por archivo (`openai.ts`, `gemini.ts`, `anthropic.ts`, `perplexity.ts`, `xai.ts`) con la misma interfaz `preguntar(prompt, pais, idioma) → {texto, citas[], modelo}`; `extraer.ts` (Haiku, JSON estricto): menciones, posición, competidores, sentimiento, fuerza; `avs.ts` calcula Mention Rate, Citation Rate, SoV, Top-3, cobertura, diversidad de citas, autoridad por categoría → **AI Visibility Score 0-100**, filtrable por vertical/ICP/problema/país/plataforma/competidor.
- **`svs.ts`** — Search Visibility Score (ranking, impresiones, CTR, tráfico, cobertura de queries, top 3/10, conversiones).
- **`dcs.ts`** — Demand Capture Score = Σ demanda capturada / Σ demanda relevante detectada, por canal (Google, IA, herramientas, social orgánico, video, skills/API, partners, directo, referido). «Capturada» = hay visita/uso/lead atribuido al cluster en la ventana.
- **`competidores.ts`** — diff de sitemaps (páginas nuevas), fetch de pricing/changelog, Labs si hay DataForSEO, cruce con `de_ia_muestras` (quién es citado); solo cambios relevantes → snapshot.
- **`brechas.ts`** — ¿qué pregunta responde otro y Sacs no? (queries donde un competidor rankea y Sacs no tiene página del cluster; entidades que las IAs asocian al competidor).
- **`contenido/{brief,borrador,auditar,publicar}.ts`** — pipeline §23 con la KB obligatoria: cada afirmación sobre Sacs se cita contra `de_conocimiento` (id); si no hay respaldo → se reescribe o se elimina. `publicar()` escribe `de_contenido.estado='publicado'`, invalida caché (`purge` por URL con la API de Vercel o TTL corto), encola `enlaces_sugerir` y `medir_en(30/60/90 días)`.
- **`enlaces.ts`** — al publicar: páginas que deben enlazarla (mismo cluster/categoría), a cuáles enlazar, anchors variados (nunca > 30 % exacto), huérfanas; contenido dinámico se corrige solo; estático → acción `codigo`.
- **`herramientas.ts`** — evaluación 9 factores + momento Sacs + efectos de orden; MVP = spec para acción `codigo`; medición en `de_herramienta_usos`.
- **`autoridad.ts`** — schema `Organization` + `SoftwareApplication` + `Person` (autores) en BaseLayout (acción `codigo` una vez), `llms.txt` dinámico (`/llms.txt` desde `de_paginas` + `de_contenido`), directorios/menciones como oportunidades `DIGITAL_PR`.
- **`atribucion.ts`** — clasifica canal desde referrer/utm (incluye IA), registra toques en `de_atribucion` (hook en `/api/tracking/identify`, `book.ts`, `save-lead.ts`, `deal-cierre.ts`, `deal-to-subscription.ts`), llena `v_de_ingresos_por_origen`.
- **`aprender.ts`** — evalúa `de_predicciones` vencidas contra real (GSC/GA4/atribución), guarda `de_aprendizajes`, propone `de_pesos` nuevos (mensual) con evidencia; no se aplica sin aprobación hasta F6.
- **`kb.ts`** — semilla y consulta de `de_conocimiento`; `claimsPermitidos()`, `verificarAfirmaciones(texto)`.

---

## 7. Pantallas del CRM (sección «Demand Engine», `sec: 'demanda'`)

Escalón nuevo en `ESCALERA` entre `marketing` y `finanzas` (se reparte la escalera a 8 pasos); permiso `demanda` en `permisos.ts` (founder edit, cs ver, partner no). Marco `WRAP`, `TablaEnterprise` con `mobileCard`, `Sheet` para fichas, paleta `P`. Todo lee de `/api/crm/demanda/*` (gateado por el middleware al vivir bajo `/api/crm/`).

| Tab | Id | Contenido |
|---|---|---|
| **Resumen** | `de-resumen` | Las 9 preguntas de §61 en < 30 s: DCS / SVS / AVS con delta; tráfico orgánico e IA; leads y pipeline por canal; lo que sube/baja (top 5 cada uno); dónde perdemos; oportunidades nuevas; qué hizo el sistema hoy; qué construir; siguientes 5 acciones. Solo lo que cambió. |
| **Explorador** | `de-explorador` | Clusters (problemas) con filtros por categoría/etapa/ICP/país/fuente/naturaleza/tendencia; ficha del cluster: queries, señales con fuente y URL, prompts, quién captura, oportunidades ligadas. |
| **SEO** | `de-seo` | Subtabs: Queries, Páginas, Movimientos, Técnico (issues por severidad), Decaimiento, Canibalización, Enlazado (huérfanas, sugerencias). |
| **Visibilidad IA** | `de-ia` | Prompts (activar/desactivar/agregar), plataformas, AVS e indicadores, menciones y citas por URL, competidores citados, historial por prompt, muestras `NO_DISPONIBLE`. |
| **Competidores** | `de-competidores` | Perfiles, cambios recientes (solo relevantes), rankings compartidos, presencia en IA, herramientas/funciones detectadas. |
| **Oportunidades** | `de-oportunidades` | Backlog con score, tipo, estado, impacto, esfuerzo, acción recomendada, predicción; aprobar/descartar/mandar a cola. |
| **Contenido** | `de-contenido` | Briefs, borradores (con las 9 auditorías y su score), publicados (métricas 30/60/90), por refrescar; editor mínimo (markdown) y vista previa. |
| **Herramientas** | `de-herramientas` | Ideas con score de viralidad, MVPs, uso, conversión, «momento Sacs». |
| **Sistema** | `de-sistema` | Subtabs: **Cola** (pendiente/corriendo/terminada/fallida/muerta), **Aprobaciones** (lo que espera al dueño, con contexto y diff), **Agentes** (corridas: qué analizó, qué cambió, tokens, costo, errores), **Experimentos**, **Aprendizajes** (predicción vs real, pesos propuestos), **Ajustes** (conectores + prueba, cadencias, umbrales, autonomía por tipo, presupuesto, competidores, mercados, kill switch, **Manual del motor**). |

Móvil: paridad con el patrón `useIsMobile` → cards + Sheet; Resumen es la pantalla que el dueño abre desde el celular.

---

## 8. Rutinas

**Diaria (cron `de-ciclo` 06:00 UTC = 00:00 CDMX; el worker ejecuta la cadena durante la madrugada):**
INGERIR (GSC día-2 por el retraso de Google, GA4, CRM, autocomplete, muestra IA del día, sitemaps de competidores) → DETECTAR (movimientos, decay, issues nuevos del sitemap/status, menciones IA ganadas/perdidas, señales nuevas, cambios de conversión) → CLASIFICAR (normalizar, agrupar, ICP, intent) → PUNTUAR → PRIORIZAR (impacto esperado / costo / confianza) → EJECUTAR (lo permitido) → VERIFICAR (la página responde 200, está en sitemap, el enlace existe) → MEDIR (series, scores) → APRENDER (predicciones vencidas) → PLANEAR (cola de mañana + TOP 5 en `de_ciclos.top5` + notificación en la campana del CRM).

**Semanal (lunes 07:00 UTC):** landscape completo (barrido GEO de todos los prompts activos, crawl técnico completo, competidores a fondo, revisión de clusters y tendencias, top páginas ganando/perdiendo, menciones/backlinks, evaluación de herramientas, embudo de conversión por origen, experimentos) → **TOP 5 ACCIONES DE LA SEMANA** (Opus 5 decide con toda la evidencia) → notificación + WhatsApp al dueño (misma vía que `ti_config.dueno_whatsapp`).

**Mensual (día 1):** revisión estratégica (mercados/problemas/herramientas/contenido/ICP/keywords/prompts/experimentos/competidores/producto) → propuesta de recalibración de pesos, prioridades ICP, estrategia de contenido/herramientas/SEO/GEO → todo como `de_aprendizajes` en estado `propuesto` para aprobación.

**Por evento (`encolar()` desde hooks existentes):** lead nuevo (`save-lead`, `book`) → atribución + cluster; cliente nuevo (`deal-to-subscription`) → atribución de revenue; deal perdido (`crm_lead_motivos`) → señal; feature nueva de Sacs (fila en `de_conocimiento`) → cadena producto→demanda→SEO→GEO→contenido→enlaces; página/herramienta publicada → enlaces + medición; caída de ranking ≥ 5 posiciones en top 10 → alerta; error técnico crítico (home 5xx, sitemap roto) → alerta inmediata; lanzamiento de competidor → oportunidad `COMPARISON`; pérdida de visibilidad IA → prompt a revisión.

---

## 9. Fases, tareas y puertas de calificación

**Regla de avance:** ninguna tarea se da por hecha sin (1) su prueba automatizada o SQL de verificación, (2) QA con navegador cuando hay pantalla (Playwright + `shot` con link), (3) un **referí** (subagente con rúbrica) que califique ≥ 9/10 en corrección, integración con lo existente, idempotencia y observabilidad; < 9 → se corrige y se vuelve a calificar. Cada tarea cierra con su commit (sin push) y una línea en `ESTADO-DEMAND-ENGINE.md`. Al cerrar una fase: prueba end-to-end de la fase + actualización de la memoria del proyecto + cuántos commits esperan push.

### F0 · Cimientos (≈ 2 sesiones de Opus)
| # | Tarea | Puerta |
|---|---|---|
| 0.1 | `ESTADO-DEMAND-ENGINE.md` + `scripts/de-operador.mjs` (listar/tomar/cerrar acciones `codigo`, imprimir estado) | el script lista y cierra una acción de prueba |
| 0.2 | Migración F0: `de_config`, `de_politicas` (semilla §4.3), `de_conectores`, `de_acciones`, `de_ciclos`, `de_taxonomia` (semilla §7 del prompt), `de_icp` (semilla §8), `de_pesos v1`, RPC `de_tomar_acciones` | SQL aplicado por Management API, archivo en `supabase/migrations/`, `select` de verificación; correr la migración dos veces no falla (idempotente) |
| 0.3 | `lib/demanda/cola.ts` + `api/cron/de-worker.ts` + handler `noop` + backoff + dead letter + notificación | prueba: 3 acciones (ok, falla-reintenta, falla-muere); dos workers simultáneos no toman la misma (SKIP LOCKED) |
| 0.4 | `api/cron/de-ciclo.ts` (diario/semanal/mensual por parámetro) que arma la cadena con `depende_de`; registro en `de_ciclos` | un ciclo de prueba crea la cadena, el worker la recorre en orden y cierra el ciclo con resumen |
| 0.5 | `lib/demanda/politicas.ts` (nivel/riesgo → estado inicial) + kill switch + tope diario | acción HIGH cae en `necesita_aprobacion`; con kill switch nada corre; CRITICAL nunca |
| 0.6 | `MODELS`/`PRICING` actualizados en `ai/client.ts`; `lib/demanda/ia.ts` (llamada con `agent_run`, JSON estricto con `output_config.format`, Batches helper) | una llamada Haiku queda en `agent_runs` + `ia_uso` con costo; el batch de 20 clasificaciones vuelve completo |
| 0.7 | Sección `demanda` en `CrmDashboard` (escalera de 8, icono, permiso) con tabs vacíos salvo **Sistema** (Cola, Agentes, Ajustes con conectores y prueba de conexión) | shot del menú abierto/plegado; marco verificado; permiso `cs` ve y no edita |
| 0.8 | `api/crm/demanda/{acciones,ciclos,conectores,config,aprobar}.ts` | curl con sesión founder; sin sesión 401 |
| 0.9 | Conector `crm` (first-party) + `probar()` de todos los conectores declarados (aunque no tengan key: dicen «falta X») | Ajustes muestra el estado real de cada conector |
| 0.10 | Alertas: `crm_notificaciones` tipo `demanda_*` + resumen diario en la campana | notificación real visible en el CRM |
| 0.11 | `vercel.json`: crons `de-worker` (*/5) y `de-ciclo` (0 6 * * *, 0 7 * * 1, 0 8 1 * *) | JSON válido; `isAuthorizedCron` en ambos |
| 0.12 | QA e2e F0 + referí + memoria + commits contados | referí ≥ 9/10 |

### F1 · Inteligencia (≈ 4 sesiones)
| # | Tarea | Puerta |
|---|---|---|
| 1.1 | Conector **Search Console**: `searchanalytics` (query×page×country×device, 16 meses de backfill por lotes), sitemaps, `de_gsc_diario` | backfill completo sin duplicados; re-correr un día no duplica |
| 1.2 | Conector **GA4** (o fallback `contact_visits`+PostHog marcado como parcial) → `de_ga4_diario` | 7 días cargados y cuadran con la consola de GA |
| 1.3 | `de_paginas`: inventario desde sitemap + rutas del repo (`src/pages` sin admin/api) + `de_contenido`; estado HTTP, títulos, metas, canonical, indexable | 100 % de URLs del sitemap inventariadas; huérfanas listadas |
| 1.4 | `normalizar.ts` + embeddings + `de_queries` + `agrupar()` → `de_clusters` (Haiku nombra y clasifica) | 2,000 queries de GSC → clusters; muestra de 50 revisada por referí: ≥ 90 % bien agrupadas y bien nombradas |
| 1.5 | Investigador de demanda sobre CRM: motivos de pérdida, preguntas de leads en WA (anonimizadas por `ai/redact.ts`), tickets, respuestas de booking → señales `observada` | 200 señales con fuente y confianza; cero PII en `de_senales` (prueba automática con regex de correos/teléfonos) |
| 1.6 | Conectores autocomplete + YouTube + Reddit (los que tengan key), con cuotas | cada uno ingiere y respeta cuota; uno caído no detiene a los otros |
| 1.7 | `seo/movimientos.ts` (las 9 reglas) → oportunidades + issues + alertas | reglas probadas con datos sintéticos + reales; sin duplicados al repetir |
| 1.8 | `score.ts` + `de_oportunidades` + predicción inicial por oportunidad | 100 % de oportunidades con desglose y `pesos_version`; orden estable |
| 1.9 | Competidores: semilla + diff de sitemaps + descubrimiento por SERP (si DataForSEO) / por menciones | snapshot solo de cambios; segunda corrida = 0 cambios |
| 1.10 | Pantallas **Explorador**, **SEO** (Queries, Páginas, Movimientos), **Competidores**, **Oportunidades** | shots desktop + móvil; marco; referí UX ≥ 9 |
| 1.11 | **Resumen** v1 (DCS/SVS provisionales, subidas/bajadas, oportunidades nuevas, qué hizo el sistema, TOP 5) | responde las 9 preguntas con datos reales |
| 1.12 | `dcs.ts`/`svs.ts` + `de_metricas_diarias` | series de 28 días recalculables e idempotentes |
| 1.13 | Ciclo diario completo corriendo 3 días seguidos sin intervención | 3 filas en `de_ciclos` con estado ok y costo < $3/día |
| 1.14 | QA e2e F1 + referí + memoria | ≥ 9/10 |

### F2 · Ejecución (≈ 4 sesiones)
| # | Tarea | Puerta |
|---|---|---|
| 2.1 | `de_conocimiento` sembrada (giros, planes desde `plans`, módulos de `producto.ts`, casos, claims permitidos/prohibidos, terminología de `GLOSARIO-GIROS.md`, mensajes de marca de `marca.ts`) + pantalla de aprobación en Ajustes | 100 % de filas con `fuente`; el dueño aprueba claims en bloque |
| 2.2 | Rutas dinámicas `/recursos/[slug]`, `/comparar/[slug]`, `/software-para/[slug]` con `BaseLayout` + `SEO` + `StructuredData` (Article/FAQPage/BreadcrumbList) + caché CDN + `/sitemap-demanda.xml` + `robots.txt` | página de prueba sirve 200, HTML válido, schema válido (Rich Results test manual), sitemap válido |
| 2.3 | Pipeline de contenido: brief (21 campos) → borrador (Sonnet/Opus) → 9 auditorías → estado | 3 briefs reales → 3 borradores; auditor bloquea un claim inventado a propósito |
| 2.4 | `publicar()` + versiones + medición programada 30/60/90 + enlaces sugeridos | publicación en `/recursos` visible en producción tras push del dueño de F2 |
| 2.5 | Decay engine + briefs de actualización con línea base | página con caída real detectada → brief con estrategia |
| 2.6 | SEO técnico: crawler por lotes + reglas (30 tipos) + PSI + URL Inspection → `de_issues` | crawl completo del sitio en ≤ 3 corridas; issues reales encontrados y verificados a mano (muestra 10) |
| 2.7 | `enlaces.ts`: grafo, huérfanas, sugerencias, corrección automática en dinámico, acción `codigo` en estático | grafo completo; 0 huérfanas en dinámico tras la corrida |
| 2.8 | Operador de código: flujo `para_operador` → `de-operador.mjs` → commit → `--cerrar`; primera tanda: schema Organization/SoftwareApplication en BaseLayout, `llms.txt`, títulos/metas de 10 páginas con CTR bajo | acciones cerradas con sha; verificación post-push |
| 2.9 | Programático controlado (dimensiones, tope, sustancia) | 5 candidatos generados, ≥ 3 rechazados por falta de sustancia (prueba de que el filtro muerde) |
| 2.10 | Pantallas **Contenido** (con editor y auditorías), **SEO → Técnico/Decaimiento/Canibalización/Enlazado**, **Sistema → Aprobaciones** | shots; aprobar desde el CRM manda a `lista` |
| 2.11 | Ciclo diario con ejecución 5 días seguidos | ≥ 5 acciones ejecutadas/día, 0 muertas sin alerta |
| 2.12 | QA e2e F2 + referí + memoria | ≥ 9/10 |

### F3 · GEO (≈ 3 sesiones)
| # | Tarea | Puerta |
|---|---|---|
| 3.1 | `de_prompts_ia` semilla: 60 prompts (ES-MX 40, ES-LATAM 10, EN 10) por cluster/ICP + generación automática desde clusters top | cada prompt ligado a cluster e ICP |
| 3.2 | Proveedores `openai/gemini/anthropic/perplexity/xai` con interfaz común, timeouts, `NO_DISPONIBLE` honesto | 5 respuestas guardadas completas para el mismo prompt; costo por muestra registrado |
| 3.3 | `extraer.ts` (Haiku, JSON estricto) + `avs.ts` + indicadores | referí revisa 30 extracciones: ≥ 90 % correctas |
| 3.4 | Muestreo diario (10 % de prompts rotando) + barrido semanal completo; `de_metricas_diarias` AVS | dos semanas de serie sin huecos |
| 3.5 | Canal IA en atribución (referrers + `utm_source=chatgpt.com`) → `trafico_ia`, `leads_ia` | una visita simulada desde `chatgpt.com` cae como canal `ia` |
| 3.6 | Brechas GEO: entidades/competidores que las IAs asocian y Sacs no → oportunidades (`COMPARISON`, `SEO_CONTENT`, `DIGITAL_PR`) | oportunidades con evidencia (cita + plataforma + fecha) |
| 3.7 | Pantalla **Visibilidad IA** + AVS en Resumen | shots; filtros por plataforma/país/competidor |
| 3.8 | QA e2e F3 + referí + memoria | ≥ 9/10 |

### F4 · Productos de adquisición (≈ 4 sesiones)
| # | Tarea | Puerta |
|---|---|---|
| 4.1 | `herramientas.ts` (9 factores, momento Sacs, efectos 1º-3º) + `de_herramientas` + pantalla **Herramientas** | el motor rankea ≥ 15 ideas con evidencia de demanda |
| 4.2 | Infra de herramientas: `/herramientas/[slug]` (isla React), `de_herramienta_usos`, CTA natural al flujo de Sacs, atribución `canal='herramienta'` | uso → visitor → lead ligado |
| 4.3 | Herramienta 1 (la que el motor rankee primero; candidatas: calculadora de inventario muerto / qué tallas recomprar / generador de descripciones / auditor de catálogo) — acción `codigo` con aprobación | publicada, medida, 20 usos reales de prueba, referí ≥ 9 |
| 4.4 | Herramienta 2 y 3 | ídem |
| 4.5 | Distribución IA: **MCP público de Sacs** (`/api/mcp`, 2-3 herramientas de solo lectura/simulación: p. ej. «analiza este inventario», «arma un catálogo») + `skill` descargable + página `/desarrolladores` | cliente MCP externo (Claude/ChatGPT) invoca una herramienta con éxito |
| 4.6 | Dataset original v1: **Sacs Fashion Retail Index** (agregado y anonimizado desde `uso_snapshots`/SACS: rotación, tallas, ticket, canales) con controles de privacidad (k-anonimato ≥ 20 cuentas por celda) | reporte publicado como `de_contenido tipo='reporte'` + página; revisión de privacidad documentada |
| 4.7 | Autoridad: directorios/menciones/PR como oportunidades con aprobación; nunca envíos masivos | ≥ 10 oportunidades `DIGITAL_PR` con contacto y ángulo |
| 4.8 | QA e2e F4 + referí + memoria | ≥ 9/10 |

### F5 · Aprendizaje y atribución (≈ 3 sesiones)
| # | Tarea | Puerta |
|---|---|---|
| 5.1 | `atribucion.ts` completo: hooks en identify/book/save-lead/deal-cierre/deal-to-subscription; `de_atribucion`; `v_de_ingresos_por_origen` | responde: qué queries/prompts/herramientas/páginas generan leads, demos, clientes, ARR; cuadra con `subscriptions` |
| 5.2 | Evaluación de predicciones vencidas (30/60/90) + `de_aprendizajes` | 100 % de predicciones vencidas evaluadas |
| 5.3 | Recalibración mensual de pesos (Opus 5) con evidencia → propuesta | propuesta con evidencia; aplicar solo con aprobación |
| 5.4 | Experimentos: crear desde oportunidad, muestra mínima, control, lectura, nunca ganador anticipado | experimento real de títulos (A/B por página, GSC) corrido 14 días |
| 5.5 | DCS completo por canal + Resumen final (las 9 preguntas con revenue) | DCS reproducible; Resumen ≤ 2 s |
| 5.6 | Costo por resultado: «gastamos $X en esta oportunidad y produjo $Y de pipeline» (une `ia_uso`, `agent_runs`, `de_acciones`, `de_atribucion`) | tabla por oportunidad en Sistema → Agentes |
| 5.7 | Pantallas **Sistema → Experimentos / Aprendizajes** | shots |
| 5.8 | QA e2e F5 + referí + memoria | ≥ 9/10 |

### F6 · Autonomía continua y autoadministración (≈ 2 sesiones)
| # | Tarea | Puerta |
|---|---|---|
| 6.1 | Rampa de autonomía: publicar contenido sube a nivel 3 cuando 20 publicaciones seguidas pasen auditoría ≥ 9 y ninguna sea retirada; baja sola con 2 rechazos del dueño en 14 días | rampa probada con datos sintéticos |
| 6.2 | `de-latido`: salud del motor (ciclos que no corrieron, conectores caídos, cola atorada, presupuesto al 80 %) → notificación + WhatsApp al dueño | simular caída → alerta llega |
| 6.3 | **Manual del motor** dentro de Ajustes (qué hace cada agente, cómo leer el Resumen, qué aprobar, cómo agregar un conector/prompt/competidor/mercado, cómo apagar) + runbooks de fallas | el dueño puede agregar un competidor y un prompt sin ayuda |
| 6.4 | Operador autónomo de código: `/loop` en la ventana `work` que cada 30 min toma acciones `para_operador`, implementa, prueba, commitea, y reporta cuántos commits esperan push | 5 acciones de código cerradas en automático |
| 6.5 | Expansión de mercados: activar `CO`/`CL`/`PE`/`AR`/`ES` en Ajustes → prompts, GSC por país, competidores regionales | un país nuevo activado produce clusters y prompts propios |
| 6.6 | Definition of Done (§13) verificada 7 días seguidos + memoria final + entrega | los 12 puntos en verde |

---

## 10. Protocolo de operación para Opus (cada corrida)

**Antes:**
1. `cd /opt/sacs/paginawebsacs/sitio && git status --short && git log --oneline -5`
2. Leer `ESTADO-DEMAND-ENGINE.md` (dónde quedamos, fase, tarea, trampas) y la tarea siguiente de este plan.
3. `node scripts/de-operador.mjs --estado`: último ciclo, acciones fallidas/muertas, `para_operador`, métricas clave, presupuesto.
4. Revisar `COLA.md` (pedidos del dueño que llegaron).
5. Fijar el objetivo concreto de la corrida (una tarea o un bloque de tareas de la misma fase).

**Durante:** investigar antes de tocar (no suponer esquema ni APIs), construir, `npm test` + `tsc` parcial (`tsconfig.cabina.json`, el completo hace OOM), prueba SQL, QA con navegador y `shot`, referí ≥ 9/10, commit en español con detalle. Nunca: force push, borrar tablas, tocar secretos, migraciones destructivas, cambiar precios, push sin que el dueño lo diga.

**Después:** actualizar `ESTADO-DEMAND-ENGINE.md` (hecho, descubrimientos, errores, decisiones, siguiente), fila en `de_ciclos` si fue ciclo, memoria del proyecto si hubo decisión nueva, y decir al dueño: qué quedó, links de shots, cuántos commits esperan push y qué necesita de él.

**Rúbrica del referí (10 puntos):** corrección funcional (3), integración con lo existente sin duplicar (2), idempotencia y manejo de fallos (2), observabilidad (run/costo/log) (1), seguridad (secretos/RLS/permisos) (1), UX conforme al sistema de diseño del CRM (1). < 9 → corregir.

---

## 11. Lo que necesito del dueño (en orden)

| Prioridad | Qué | Para | Costo |
|---|---|---|---|
| **F0** | Su OK a este plan | arrancar | — |
| **F1** | Agregar la cuenta de servicio (`client_email` del `GOOGLE_SERVICE_ACCOUNT_B64`; el motor lo imprime en Ajustes) como usuario **Completo** en Search Console de sacscloud.com | conector GSC | gratis |
| **F1** | ID de propiedad GA4 + cuenta de servicio como **Lector** (o confirmar que no hay GA4) | conector GA4 | gratis |
| **F1** | Habilitar PageSpeed Insights API y YouTube Data API v3 en la consola de Google Cloud donde vive Places; key en Vercel `GOOGLE_API_KEY_PSI_YT` | técnico + señales | gratis |
| **F1** | App de Reddit (client id/secret) → Vercel `REDDIT_CLIENT_ID/SECRET` | señales de comunidad | gratis |
| **F1 (recomendado)** | Cuenta **DataForSEO** (login/password API) → Vercel `DATAFORSEO_LOGIN/PASSWORD` | volúmenes, SERP con AI Overview, keywords de competidores, Trends | depósito $50-100; ~$30-60/mes |
| **F3** | Key de **Perplexity** → `PERPLEXITY_API_KEY`; key de **xAI** → `XAI_API_KEY` | GEO en 5 plataformas | ~$20/mes juntas |
| **F4** | Decidir la primera herramienta gratis entre las que rankee el motor | producto de adquisición | — |
| **F4** | Autorizar el dataset agregado (Fashion Retail Index) y revisar el control de privacidad | autoridad/PR | — |
| **Continuo** | Decir «push» cuando quiera que salga cada bloque; aprobar lo HIGH en la pestaña Aprobaciones | operación | — |

Presupuesto de IA estimado en régimen: $60-120/mes (clasificación en Batches con Haiku, GEO diario ~$1/día, semanal ~$8, Opus para estrategia ~$15/mes). Tope en `de_config.presupuesto_mensual_usd` con alerta al 80 %.

---

## 12. Riesgos y cómo se cierran

- **Slop / claims inventados** → KB obligatoria + auditor que bloquea + rampa de autonomía + versiones para revertir.
- **Duplicar lo que ya hace el CRM** (secuencias, disparadores web, agentes Inngest) → el motor solo lee de ellos y nunca manda mensajes a personas; el outreach queda HIGH.
- **Costo de Vercel** → contenido dinámico (sin builds), crons cada 5 min solo el worker.
- **PII en señales** → `ai/redact.ts` antes de cualquier prompt; prueba automática en 1.5.
- **Datos falsos de terceros** → naturaleza por señal + `NO_DISPONIBLE` + confianza.
- **Google penaliza programático** → D10 (sustancia + tope + auditoría).
- **El motor se automodifica** → `de_politicas.inmutable`, pesos por aprobación, guion de agentes en código versionado.
- **Cuotas y caídas de proveedores** → acción por conector, backoff, dead letter, cuota diaria, latido.

---

## 13. Definition of Done

Demand Engine está terminado cuando, **7 días seguidos sin que nadie le diga qué hacer**, cada día: (1) recolecta señales nuevas, (2) identifica oportunidades nuevas, (3) monitorea SEO, (4) monitorea visibilidad IA, (5) observa competidores, (6) encuentra problemas técnicos, (7) prioriza acciones, (8) ejecuta las autorizadas, (9) mide resultados, (10) los liga a leads/revenue, (11) aprende de resultados anteriores, (12) deja creada la cola siguiente — y el Resumen responde las 9 preguntas de §61 en menos de 30 segundos desde el celular del dueño.
