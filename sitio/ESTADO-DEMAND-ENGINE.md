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

---

## Etapa 1 · Inteligencia — parte A hecha (15-sep-2026)

**Dónde vamos realmente:** el motor ya VE demanda. No la de Google todavía (eso
está bloqueado esperando los accesos), sino la que llevaba años dentro del CRM
sin que nadie la leyera: 2,427 señales de WhatsApp, soporte, mejoras pedidas,
motivos de pérdida y churn, agrupadas en 411 problemas canónicos.

### Qué quedó construido
- **Esquema E1** (`2026-09-15-demand-engine-E1.sql` + `-rpc` + `-refundir` + `-niveles`):
  señales, consultas, problemas, páginas, métricas por página, datos crudos de
  buscadores y analítica, oportunidades, predicciones, competidores (24 semilla),
  problemas técnicos, enlaces, series de métricas y usos de herramientas.
- **`fuentes/crm.ts`** — la demanda de primera mano, con cursor por sub-fuente.
- **`senales.ts`** — registro por lotes con anonimización obligatoria.
- **`embeddings.ts`** — proveedor FIJO por instalación (OpenAI o Gemini), con su
  umbral de unión medido.
- **`normalizar.ts`** — texto suelto → pregunta canónica → consulta → problema.
- **`paginas.ts`** — inventario del sitio desde el sitemap + grafo de enlaces.
- **Banco de pruebas local** `scripts/de-probar.mjs` + `de-hooks.mjs`: corre el
  motor de verdad desde la terminal, sin levantar Astro.
- **`privacidad.test.ts`** dentro de `npm test`.

### Lo que la prueba real encontró (y que no se hubiera visto de otra forma)
1. **La semántica del nivel de autonomía estaba invertida.** Con el motor en
   nivel 2, hasta la prueba de vida de la cola pedía permiso del dueño. El nivel
   es el MÍNIMO de autonomía global que una acción necesita, no «qué tan
   autónoma es». Corregido en `-niveles.sql`.
2. **El anonimizador compartido no tapaba teléfonos escritos de corrido.**
   `redact.ts` exigía separadores, así que `5547780632` pasaba entero a los
   prompts. Afectaba también al agente SDR. Arreglado y con prueba.
3. **Se pagaba un paso que no podía terminar.** Sin `OPENAI_API_KEY` el modelo
   leía las señales (y cobraba) y el agrupado se saltaba en silencio, así que
   las mismas señales volvían a pagarse en cada vuelta. Ahora las dependencias
   se comprueban ANTES de la primera llamada cara.
4. **El umbral de parecido es propiedad del MODELO, no una constante.** Con 0.85
   —correcto para OpenAI— y vectores de Gemini truncados a 1536, el vecino más
   parecido de 326 problemas llegaba a 0.849: no se fusionaba nada nunca y 9 de
   cada 10 señales abrían un problema nuevo. Medido: mediana 0.762, p90 0.827.
   Revisados los pares a mano, **0.82** es donde siguen siendo la misma
   pregunta. Con eso, la tasa de problemas nuevos cayó del 90% al 4%.
5. **Los enlaces se perdían en silencio.** Una página enlaza varias veces al
   mismo destino (menú + pie + cuerpo) y dos filas con la misma llave en el
   mismo lote hacen que Postgres rechace el lote entero. Como el error no se
   miraba, los 6,700 enlaces desaparecían y la corrida reportaba éxito.
6. **Las 120 páginas salían huérfanas** porque el sitemap publica `/blog/` y el
   HTML enlaza `/blog`. Una sola función de normalización para los dos lados;
   ahora las huérfanas son 6, y las seis son de verdad (portal de partner,
   reset de contraseña, baja de correo, embed de pago, cancelar/reagendar cita).
7. **Supabase rechaza un UPDATE sin WHERE**, así que la función de recuento de
   enlaces fallaba callada.

### Lo que el motor ya sabe (medido)
- 2,427 señales · 411 problemas canónicos · 550 consultas · 120 páginas ·
  7,618 enlaces internos · 6 huérfanas reales · 9 páginas `noindex` ·
  7 sin meta descripción · 8 sin H1 · 7 con menos de 300 palabras.
- Lo que más pide el ramo hoy (por volumen de señales): reimprimir tickets de
  venta, productos que no se ven en el punto de venta, cajeros sin caja
  asignada, facturar pedidos, precio de la solución, cuánto vendí en el mes.
- Costo de procesar el corpus: **$0.02 por cada 60 señales** (Haiku + embeddings).

### Bloqueado, esperando al dueño
`ingerir.gsc` y `ingerir.ga4` están construidos como conector pero **sin
credencial**: en *Sistema → Lo que me falta* aparece qué hacer en cada uno.
Igual Reddit, YouTube, PageSpeed, DataForSEO, Perplexity y xAI.

### Lo que sigue (parte B de la etapa 1)
E1.9 score de oportunidades · E1.10 competidores (lectura pública, no necesita
llaves) · E1.11 pantallas Explorador/SEO/Competidores/Oportunidades ·
E1.12 Resumen con datos reales.

---

## Etapa 1 · parte B hecha (15-sep-2026) + UN AVISO URGENTE

### ⚠️ La cuenta de Anthropic se quedó SIN SALDO y el agente SDR no puede responder
Medido en `ia_uso`: 5,159 llamadas fallidas el 7-sep, 5,910 el 8-sep, 1,775 el
14-sep y otra vez hoy. Casi todas son `agente:respuesta` — el agente de
WhatsApp intentando contestarle a un lead y no pudiendo. **Esto es producción
rota y no depende del motor de demanda**: hay que reponer saldo en la cuenta de
Anthropic. Se le avisó al dueño.

De paso se arregló lo que lo empeoraba: un fallo de saldo o de llave se
reintentaba como cualquier otro error. Ahora se reconoce como DEFINITIVO y la
acción se detiene con el motivo en vez de insistir mil veces contra algo que
ningún reintento arregla.

### Qué quedó construido
- **`evaluar.ts`** — el modelo juzga cualidades (relevancia, conversión,
  potencial de herramienta, de contenido, de red, valor del dato, distribución
  por IA, dificultad) y deja escrito por qué. El código calcula el número.
- **`score.ts`** — score determinista 0-100 con los pesos vigentes y desglose
  por factor guardado en cada oportunidad.
- **`oportunidades.ts`** — de problema a oportunidad, una por problema y tipo.
- **Pantallas** Explorador (con la evidencia de cada problema) y Oportunidades
  (con el puntaje abierto en sus ocho factores). Resumen reescrito con datos
  reales, y lo que aún no se puede medir dicho como tal.
- **`/api/crm/demanda/demanda`** con las vistas problemas, oportunidades,
  señales, páginas y resumen.
- **Presupuesto del motor leído de `ia_uso`**, no de un contador: un contador
  aparte solo cuenta lo que alguien se acordó de sumarle. Y separado del resto
  de la IA del CRM, que gasta ~$126/mes por su cuenta.

### Cuatro errores más que solo aparecieron con datos reales
8. **Refundir era O(n²) y dejó de funcionar al crecer.** Buscaba el mejor par
   de toda la tabla en cada pasada: a 326 problemas eran segundos, a 990 se
   quedó sin tiempo y devolvió vacío — y como el handler no miraba el error del
   RPC, producción reportó «nada que fundir · 0 problemas» tan tranquila. Ahora
   cada problema pregunta por su vecino con el índice HNSW: 262 fusiones en 8 s.
9. **La llave foránea pisaba el traslado.** Mudar y borrar iban en el MISMO
   statement con CTEs; como `cluster_id` está declarada `on delete set null`, el
   borrado anulaba justo las filas que el update acababa de mudar. Regla nueva:
   mudar y borrar son dos statements, siempre.
10. **El contador de frecuencia contaba fuentes, no señales.** Agregaba por
    (problema, fuente) y luego hacía `count(*)`, que cuenta las fuentes. Todo el
    catálogo decía «visto 3 veces» como máximo. El daño no era el número sino la
    PRIORIDAD: el score usa la frecuencia, así que el backlog quedaba ordenado
    por casi nada. El más pedido resultó tener 188, no 3.
11. **El tipo de oportunidad se decidía sin mirar de QUIÉN venía.** El primer
    backlog propuso escribir una página para «agendar una llamada» (28 veces) y
    meter «conocer más sobre el software» al roadmap. Ahora cada problema se
    clasifica en demanda de **mercado** (capturable), de **cliente actual**
    (producto) o **en proceso** (ventas), y el origen viaja en el prompt porque
    el mismo texto significa cosas distintas según quién lo dijo.

### Lo que el motor sabe ahora
2,518 señales · 1,457 con problema asignado · ~850 problemas · 2,234 consultas ·
120 páginas · 7,618 enlaces. Lo más pedido, con su origen:
«cómo conectarme a soporte» 188 (WhatsApp 138 + soporte 48), «si se puede
contratar por mes» 151 (todo WhatsApp), «no puedo facturar pedidos» 31.

### Para retomar
1. **Reponer saldo de Anthropic.** Sin eso no corre ni el motor ni el agente SDR.
2. `node scripts/de-probar.mjs evaluar 30` → evalúa el resto de los problemas.
3. `node scripts/de-probar.mjs puntuar` → score + backlog de oportunidades.
4. Revisar el backlog en el CRM y afinar las reglas de `decidirTipo`.
5. Etapa 2 cuando lleguen los accesos de Google.

---

## Etapa 2 · parte A hecha (16-sep-2026) — el motor ya puede publicar solo

**Dónde vamos:** el motor publica sin build. Primera página viva:
https://www.sacscloud.com/recursos/curva-de-tallas/

### Qué quedó construido
- **Esquema** `de_contenido` + `de_contenido_versiones` + sincronización
  automática al inventario de páginas.
- **`bloques.ts`** — el cuerpo son bloques TIPADOS, no markdown. Se escapa todo
  y el renderizador pone las etiquetas (nada de lo que produce un modelo se
  interpreta como marcado), y unas preguntas frecuentes se vuelven `FAQPage` y
  unos pasos `HowTo` sin adivinar nada.
- **`publicar.ts`** — publicar, versionar, revertir y retirar.
- **Rutas dinámicas** `/recursos/[slug]`, `/comparar/[slug]`,
  `/software-para/[slug]` con caché de CDN; `ContenidoMotor.astro` con los
  tokens del sitio, índice con anclas y fecha de actualización visible.
- **`/sitemap-demanda.xml`** y **`/llms.txt`** + **`/llms-full.txt`** generados
  al vuelo, los tres declarados en robots.txt.
- **Pantalla de SEO técnico** y **motor de enlazado interno**.
- **`scripts/de-shot.mjs`** para capturas de QA.

### Dos cosas rotas que encontró al mirar afuera
12. **El `/llms.txt` llevaba seis semanas mintiendo.** Es el archivo que leen
    ChatGPT, Claude y Perplexity para saber qué es el sitio, y decía «Sistema
    Operativo para Retailers Conscientes» —el posicionamiento purgado—, no
    mencionaba la moda, y sus doce enlaces apuntaban a `sacs.com.mx`, que no
    responde. Igual `llms-full.txt`. Ahora se generan desde la ficha de producto
    del agente comercial: no hay segunda copia que se pueda desfasar.
13. **El schema `Organization` de TODAS las páginas** declaraba `url` y `logo`
    en ese mismo dominio muerto (arreglado en el commit anterior).

### Preguntas para el dueño
- El `llms.txt` viejo afirmaba «el 10% de cada licencia se destina a impacto
  social» y mencionaba el asistente **AXO**. No se incluyeron en el nuevo porque
  no se pudieron verificar contra la ficha de producto vigente. Si siguen siendo
  ciertos, hay que agregarlos; si no, ya salieron.
- Nueve páginas están en `noindex` a propósito, entre ellas
  `/recursos/tiktok-fashion` y `/prueba-gratis`. ¿Es lo que se quiere? Ahora ya
  no están en el sitemap, pero siguen sin poder rankear.
- El título de las páginas termina en «| SACS» en mayúsculas, y la marca visible
  es «Sacs».

### Lo que sigue
1. **Reponer saldo de Anthropic** — sigue bloqueando normalizar, evaluar y todo
   el contenido generado.
2. Más piezas del corpus canónico (se pueden escribir a mano mientras tanto).
3. Competidores: diff de sitemaps, no necesita llaves.
4. Pipeline de contenido con las 9 auditorías (necesita saldo).

---

## 16-sep-2026 (tarde) · respuestas del dueño aplicadas + competidores + corpus

### Las tres respuestas
1. **El 10% de impacto social es real** (confirmado por el dueño, y además está
   en el pie de todas las páginas) y **AXO existe** (ficha de producto, plan
   Automatiza). Los dos vuelven a `/llms.txt` y `/llms-full.txt`.
2. **Los `noindex` se decidieron por las palabras reales de cada página**:
   `/recursos/tiktok-fashion` (877 palabras) y `/campana/curva-de-tallas`
   (calculadora) **se indexan**; `/prueba-gratis` (34 palabras) y
   `/campana/punto-de-venta` (repite lo de /producto con menos) **siguen fuera**.
3. **La marca es «Sacs» visible y «Sacscloud» como identidad única.** El título
   de cada página decía «| SACS», que se lee como acrónimo. Corregido, más 605
   apariciones en las descripciones de las 28 funciones y sus páginas.

### Tres páginas vacías desde el andamiaje original
La regla de contenido delgado estaba MUERTA: contaba el HTML entero y el armazón
del sitio son ~1,800 palabras, así que una página vacía contaba 1,872. Contando
solo lo de dentro de `<main>` aparecieron `/producto/`, `/nosotros/` y
`/manifiesto/`, las tres publicadas, indexables y en el sitemap, con el
comentario «el contenido irá aquí» dentro.
- `/producto/` ya es un hub real con las 28 funciones (455 palabras, `ItemList`).
- `/nosotros/` y `/manifiesto/` salen del índice. **Necesitan la voz del dueño**:
  la de nosotros pesa para que una IA reconozca a la empresa como entidad, y la
  del manifiesto es donde vive el 10%.

### Competidores
`competidores.ts` lee los sitemaps públicos, guarda la foto y compara. 16 de 24
accesibles, 20,534 páginas en la línea base. Se reportan CAMBIOS, no
inventarios, y la primera foto no genera avisos.

### Corpus canónico: 3 definiciones publicadas
`/recursos/curva-de-tallas` · `/recursos/nivelacion-inventario-entre-tiendas` ·
`/recursos/sell-through`. Enlazadas entre ellas, y la primera manda a la
calculadora. **Las tres se publicaron sin desplegar nada** — que es la prueba de
que la arquitectura de la etapa 2A funciona.

### Sigue bloqueado
El saldo de Anthropic. Sin él no corren `normalizar`, `clasificar` ni el pipeline
de contenido generado. Todo lo de arriba se hizo sin tocarlo.

---

## Etapa 3 · Visibilidad en IA — hecha (17-sep-2026)

**Dónde vamos:** el motor mide en cuatro plataformas y tiene su línea base.

### La línea base, que es el dato del proyecto
- **48 mediciones** (12 preguntas × 4 plataformas). **Sacs aparece 0 veces.**
- **Visibilidad en IA: 0 de 100.**
- En buscadores: **5.1% del tráfico** viene de gente que no nos conocía; el 95%
  restante son clientes tecleando «sacscloud iniciar sesión».
- Buscando consultas del ramo en 16 meses de Search Console: **cero**.

### Qué se construyó
- `geo/proveedores.ts` — ChatGPT, Gemini, Claude y Perplexity, **todas con
  búsqueda web encendida** (sin eso se mide lo que el modelo recuerda, no lo que
  contesta hoy). Grok queda fuera: falta llave y su uso en México es marginal.
- `geo/medir.ts` — medición, extracción con modelo barato, AVS y series.
- 30 preguntas de comprador redactadas a mano (giro · problema · comparativa ·
  tamaño). No son keywords: nadie le escribe «software moda méxico» a ChatGPT.
- Pantalla **Visibilidad en IA** con las tres vistas.
- Muestreo dentro del ciclo diario.

### Lo que la medición encontró
- **Quién ocupa el lugar:** Shopify (3 de 4 plataformas), Odoo, Alegra POS,
  Square, Bind ERP, ManagementPro, Loyverse.
- **En quién confía la IA:** syskapos.com, alegra.com, mproerp.com, sicar.mx,
  puntodeventa.com.mx, capterra.mx.
- **Los competidores reales de México no eran los que yo había puesto.** La
  semilla tenía Shopify, Odoo, NetSuite. Los que salen son SICAR X, Syska POS,
  Multicomercio, Loggro, INTAC… y los de moda: **Sizes and Colors** (lo señaló
  el dueño), Adiasoft, Regtrix. Son 45 competidores ahora.
- **La categoría «software hecho para moda» está VACANTE**: al pedir
  explícitamente software especializado, las IAs siguen contestando genéricos.
  Ni Sizes and Colors domina esa respuesta. No vamos tarde a una carrera que
  otro lidera: la carrera no ha empezado.

### Decisiones y trampas
- **Plataforma no consultable = `NO_DISPONIBLE` con motivo, nunca un cero.** Un
  cero se promedia y arrastra; un hueco declarado se ve y se arregla.
- **El dato duro manda sobre el juicio**: si el texto no contiene el nombre, no
  lo menciona, diga lo que diga el extractor. Si discrepan, la confianza baja a
  0.6 en vez de fingir certeza.
- **Perplexity: la API cambió.** `sonar` en `/chat/completions` ya no existe;
  ahora es `perplexity/sonar` en `/v1/responses`. Y los créditos de API se
  compran APARTE de la suscripción Pro, que no sirve para esto.
- **Tercer fallo silencioso del proyecto**: se crearon funciones de SQL antes que
  su tabla y el error se mandó a `/dev/null`; el motor dijo «no hay prompts que
  medir» tan tranquilo. Regla: verificar después de crear.
- **No compilar mientras corre un trabajo pesado**: el servidor se queda sin
  memoria y el build falla con un error que no es el real.

### Proveedores de IA
Cuatro con llave (Gemini, Groq, Anthropic, OpenAI) y el orden **depende del
trabajo**: volumen a Gemini (3× más barato), criterio y estrategia a Anthropic.
Si uno falla por saldo o cuota, pasa al siguiente.

### Lo que sigue
1. Medir las 18 preguntas restantes del catálogo.
2. Etapa 4: herramientas gratis y MCP.
3. Etapa 5: atribución y aprendizaje.
4. Pendiente del dueño: `XAI_API_KEY` (opcional), `DATAFORSEO_*` y Reddit.

---

## Etapa 4 · parte A hecha (17-sep-2026) — la primera herramienta, por tres puertas

Hasta aquí el motor **escribía**. A partir de aquí **hace cosas**, y eso cambia
el tipo de activo: una IA puede describir un artículo, pero una herramienta que
funciona sin registro es algo que puede *ejecutar* y citar. El objetivo declarado
por el dueño («que seamos el referente») se gana antes por ahí que por un blog.

### Qué quedó construido

| Puerta | Dirección | Qué hace |
|---|---|---|
| Web | `/herramientas/` y `/herramientas/curva-de-tallas` | Sin registro, sin pedir correo. Arranca con datos de ejemplo marcados. |
| MCP | `POST /api/mcp` | JSON-RPC 2.0, sin llave. `initialize` · `tools/list` · `tools/call`. |
| API | `GET/POST /api/herramientas/<slug>` | GET devuelve el esquema de entrada; POST calcula. |

Las tres pasan por `invocar()` (`src/lib/demanda/herramienta.ts`): una función,
un esquema, una medición. **Nunca dupliques el cálculo en el navegador**: el día
que se separen, la respuesta de ChatGPT deja de ser la del sitio y no hay forma
de notarlo.

Archivos: `src/lib/demanda/herramientas/{index,curva,curva.test}.ts`,
`src/components/herramientas/CurvaTallas.tsx`, `src/pages/herramientas/*`,
`src/pages/api/herramientas/[slug].ts`, `src/pages/api/mcp.ts`.

### Cómo se agrega la siguiente herramienta

1. Un archivo en `src/lib/demanda/herramientas/` que llame a `definirHerramienta`
   con su `slug`, su esquema zod y —obligatorio— su `momento_sacs`.
2. Una línea de `import` en `herramientas/index.ts`. Sin eso el registro no la
   conoce y **ninguna** puerta la ve.
3. Si tiene puerta web: su isla, su `import` y su `{h.slug === '…' && <Isla client:load />}`
   en `herramientas/[slug].astro`, más sus pasos en `PASOS` (son el método, y es
   lo que una IA puede explicar sin abrir la página).

Ponle `.describe()` a **cada** campo del esquema. No es documentación de
cortesía: es lo único que un modelo lee al decidir qué mandar por el MCP.

### El cálculo, y por qué está así

La idea: *una talla que vendió poco no es lo mismo que una talla que no estuvo*.
Con el ejemplo real (M agotada el día 9 de 60), la lectura de siempre manda
comprar 30% de M y la corregida 45%: **23% de las piezas cambian de talla**.

- **Tope de 3× en la proyección.** Proyectar plano 14 piezas de 9 días a 60 da
  93 y es falso: la demanda decae con la temporada. Sin tope, una talla agotada
  el día 2 se lleva la compra entera detrás de un dato de dos días.
- **Núcleo mínimo de tres tallas.** Con el corte al 60% pelado, la M se llevaba
  el núcleo sola y la alerta de corrida rota no saltaba nunca.
- **Reparto por resto mayor.** Redondear normal devuelve 5, 6 u 8 al repartir 7
  piezas entre 5 tallas, y la orden sale por una cantidad que nadie pidió.

### Cinco trampas que salieron aquí

1. **Astro contesta 200 sin la isla.** Elegir el componente con `ISLAS[slug]`
   deja la página completa —schema, método, nota de API— y **sin la
   herramienta**. Astro necesita verlo escrito para empaquetar su hidratación;
   lo dice en el log del servidor y responde 200 igual. Cualquier monitoreo por
   código de estado la ve perfecta. **Regla: componente con `client:*` va
   escrito, nunca desde una variable.**
2. **El nav es `fixed` y no empuja.** Tres cabeceras arrancaban debajo de él,
   `/producto` incluido. Medido: 102px con barra de idioma, 72px bajo 641px.
   Está en el token `--nav-alto` de `global.css`; úsalo, no lo midas otra vez.
3. **Dos calculadoras por la misma búsqueda.** Ya existía
   `/campana/curva-de-tallas` (del correo del día 3). No son la misma —aquella
   compara métodos, esta calcula— pero competían por «curva de tallas». La
   landing quedó `noindex` y manda a la herramienta. **Antes de publicar algo
   nuevo, busca si ya hay una página nuestra por esa consulta.**
4. **El motor inventó una URL y la publicó.** `/recursos/curva-de-tallas` decía
   «hicimos una calculadora» apuntando a la landing de campaña. Existía de
   casualidad. El auditor de enlaces no comprueba lo que el generador promete en
   prosa: pendiente de la etapa 5.
5. **`prerender = false` = fuera de los dos sitemaps.** @astrojs/sitemap solo ve
   lo que el build escribe en disco. Las rutas dinámicas van en
   `sitemap-demanda.xml.ts`, que es el sitemap de lo que no pasa por build.

### Privacidad

`de_herramienta_usos` guarda slug, puerta, visitor_id, ok y ms. **`resumen` se
deja NULO a propósito**: es derivado, no la entrada cruda, pero nombra las tallas
y los productos del retailer. La promesa de la herramienta es que sus números no
se quedan aquí. Para saber qué herramienta convierte basta slug + visitor_id.

### Prueba

`npm test` → 4 suites, la nueva con 20 casos
(`src/lib/demanda/herramientas/curva.test.ts`). Necesita el hook de resolución
(`--import ./scripts/de-registrar-hooks.mjs`) porque el repo importa sin
extensión. QA con navegador en 1280 y 390 px, sin errores de JS ni desborde:
https://code.sacscloud.com/shots/dc7c5b22401d3636.png

### Lo que sigue de la etapa 4

1. Dos herramientas más (candidatas: sell-through por estilo, nivelación entre
   tiendas — las dos ya tienen artículo publicado al que engancharse).
2. Anunciar el MCP donde los clientes lo puedan conectar, y medir si lo usan.
3. Sacs Fashion Retail Index: el dato propio que nadie más puede publicar.
4. Autoridad y PR.
