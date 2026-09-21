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

### Segunda herramienta: «¿Vas a sacar este estilo a tiempo?» (`/herramientas/sale-o-no-sale`)

Hay cien calculadoras de sell-through en internet y todas hacen lo mismo:
dividir. Ninguna contesta la pregunta que el comprador trae en la cabeza, que es
binaria: **¿rebajo o no rebajo?** Esta parte del sell-through y llega hasta el
sobrante proyectado, el dinero parado y —lo que no hace nadie— la **última
semana útil para actuar**.

La semana límite sale de que cada semana sin actuar la existencia baja despacio
pero las semanas restantes bajan rápido: la aceleración que haría falta sube.
El límite es la última semana en que esa aceleración todavía cabe en lo que el
usuario cree que puede acelerar (2× por omisión, elegible). **Ese múltiplo es un
supuesto declarado, no un dato del mercado**, y se dice en la respuesta: inventar
una elasticidad de precio habría sido fabricar un número con cara de hecho.

Tres decisiones:

- **El veredicto va por el TAMAÑO del sobrante, no por si existe.** Partir en
  `sobrante > 0` equivale exactamente a `aceleración > 1`, y daba la misma
  alarma por 3 piezas de 100 que por 80 de 200. Un aviso que salta por nada
  enseña a ignorar el aviso. El corte quedó en 5% de lo recibido.
- **Sin una sola venta no hay ritmo que proyectar.** Salía «vender 0× más
  rápido», que no significa nada. Ahora nombra el problema real: el estilo no
  arrancó, y eso no se arregla con una rebaja.
- **El sobrante es un PISO.** La cuenta supone ritmo constante y en moda el
  ritmo baja. Va en la respuesta, no en la letra chica: quien cree que su
  estimación es generosa espera, y esperar es lo que no hay que hacer.

Cierra el círculo con la primera: cuando el veredicto es «no sale», manda al
auditor de curva de tallas, porque el sell-through del estilo esconde el de la
talla — un estilo «al 30%» puede ser centro agotado y extremos intactos, y ahí
la rebaja no arregla nada.

### Tercera herramienta: «Qué mover entre tus tiendas» (`/herramientas/nivelar-entre-tiendas`)

Las hojas de cálculo de nivelación igualan cobertura. Esta no: **repara el
máximo de corridas rotas con las menos piezas movidas**, que es lo que de verdad
devuelve ventas. Una tienda a la que le falta una talla del centro no vende poco
ese modelo: no lo vende. Y su reporte dirá «aquí no gusta», que es la mentira
que entra a la siguiente orden de compra, le compra menos, y le rompe la corrida
otra vez.

Tres reglas del algoritmo, cada una de un error que cometió antes:

- **Se atienden primero las tiendas con MENOS huecos.** Empezar por la más rota
  gasta el inventario disponible en el caso más caro y deja sin reparar dos que
  costaban poco.
- **O repara entera o no mueve nada.** La primera versión mandaba 4 piezas a una
  tienda a la que igual le seguía faltando otra talla: cero corridas reparadas,
  flete pagado, y la donante más débil. Ahora se simula y se confirma o se
  deshace — es atómico.
- **Nadie puede donar hasta quedar por debajo del mínimo.** Eso es mover el
  problema y pagar por moverlo.

Y una respuesta que no da ninguna competencia: cuando sumando la cadena entera
no alcanza, dice **«esto no se mueve, se compra»** y lista cuántas piezas
faltan por talla. Es una respuesta distinta y más útil que una lista de
traspasos imposibles.

**La entrada se puede pegar desde Excel**, que es donde el dato vive de verdad;
nadie tiene la existencia por talla y tienda en la cabeza. El parser acepta
tabuladores, comas y punto y coma, con o sin encabezado. Dos trampas medidas:

- **En calzado las tallas SON números** (23, 23.5, 24), así que «¿tiene alguna
  celda no numérica?» no detecta el encabezado y la fila de títulos se leía como
  una tienda. Se agregó la señal que sí sirve: cómo se llama la primera celda.
- **«Plaza» es nombre de tienda tan común como etiqueta de columna.** Estaba en
  la lista de etiquetas y se comía la primera tienda de una tabla sin encabezado.
  La lista quedó solo con palabras que nadie le pone de nombre a una tienda —
  entre equivocarse comiéndose una tienda y equivocarse dejando las tallas sin
  nombre, lo segundo se ve en la rejilla y se corrige.
- **`filter(Boolean)` sobre los encabezados recorría las columnas.** Una celda
  vacía a media tabla dejaba las cantidades pegadas a la talla equivocada, y el
  resultado salía coherente pero mal. Ahora se conserva la posición.

**El pegado propone, la rejilla confirma**: el resultado del parseo cae en una
tabla editable, así que ningún error de lectura llega al cálculo sin que la
persona lo vea.

### La página del MCP (`/herramientas/mcp`)

Un servidor que nadie sabe conectar es un servidor que nadie usa. Esta página es
la diferencia entre tener la capacidad y tenerla disponible, y se enlaza desde el
índice de herramientas, el sitemap del motor y `/llms.txt`.

Dos decisiones sobre qué dice:

- **No describe menús de productos ajenos.** Los clientes de MCP cambian su
  interfaz cada pocas semanas; unas instrucciones con nombres de botones
  envejecen mal y hacen quedar mal a quien las siguió. Da la dirección, el JSON
  estándar y el nombre genérico del ajuste. Eso no caduca.
- **Enseña lo que la IA va a contestar**, con la salida real de la herramienta.
  Quien evalúa conectar algo a su asistente quiere ver la respuesta antes de
  instalar nada — y eso es también lo que hace la página citable.

La lista de herramientas de esa página sale del registro, así que una
herramienta nueva aparece sola.

⚠️ `/herramientas/mcp` es un archivo estático (`mcp.astro`) que convive con la
ruta dinámica `[slug].astro`. Astro le da precedencia al estático; si algún día
se define una herramienta con slug `mcp`, su página quedaría tapada sin avisar.

### Índice Sacs de Retail de Moda — CALCULADO, **NO PUBLICADO**

De todo lo que el motor puede hacer para que una IA nos cite, esto es lo único
que ningún competidor puede copiar. Un artículo sobre curva de tallas lo escribe
cualquiera con un buen prompt; «el ticket mediano de las tiendas de moda en
México es de $640» solo lo puede decir quien tiene las cajas.

**Edición 2026-09, sobre 91 tiendas operando:**

| | |
|---|---|
| Ticket promedio | **$640** (p25 $350 · p75 $1,740) |
| Tickets al mes | **318** (p25 66 · p75 901) |
| Días seguidos sin vender | **0** (p75 = 1) |
| Hizo conteo físico esta semana | **7%** |
| Movió mercancía entre tiendas esta semana | **18%** |

Y la adopción de 31 módulos. Los tres números que sostienen todo el argumento
del sitio:

- **48% mueve inventario entre tiendas · 5% lo nivela.** Mover es la mitad del
  trabajo; saber QUÉ mover es la otra, y ahí casi nadie tiene método.
- **82% compra sin orden de compra en el sistema.** La decisión de curva de
  tallas se toma fuera de cualquier sistema, de memoria o en una hoja.
- **48% no cuenta su inventario nunca.**

#### ⚠️ Por qué NO está publicado (y qué falta para publicarlo)

`de_indice.publicado` arranca en `false` y **ninguna rutina lo cambia**. La
página `/indice-moda-mexico` contesta **404** mientras no haya una edición
publicada, y está fuera del sitemap.

No es un pendiente técnico, es una decisión que no me toca: los **Términos y
condiciones traen cláusula de confidencialidad** sobre «información revelada
durante el cumplimiento de este Acuerdo». Un agregado anónimo de 91 empresas no
identifica a nadie ni es dato personal bajo la LFPDPPP, pero publicar
estadística sacada de la operación de los clientes lo decide el dueño.

**Para abrirlo hacen falta dos cosas, en este orden:**

1. Una cláusula en los Términos que permita publicar estadística agregada y
   anónima, e idealmente una salida para quien no quiera estar.
2. El OK del dueño. Entonces basta un `update de_indice set publicado = true`
   — no hace falta desplegar.

#### Las reglas de anonimato viven en el código, no en el buen juicio

`src/lib/demanda/indice.ts`:

- **`MIN_EMPRESAS = 20`.** Debajo de eso una cifra no se publica con advertencia:
  no se publica. Es un umbral de anonimato, no de significancia.
- **Solo «operando»** (`ventas_30d > 0 y dias_sin_venta <= 30`). Sin ese filtro
  la mediana de días sin venta daba **p90 = 271 días** — una estadística sobre
  NUESTRA baja de clientes disfrazada de dato del ramo. La definición se guarda
  con cada edición: si cambia, las ediciones dejan de ser comparables y hay que
  poder notarlo.
- **El mismo filtro para la adopción.** La primera versión la medía sobre «toda
  empresa con datos de uso» y metía cuentas dormidas al denominador: decía que
  el ramo usa menos de lo que usa. (Punto de venta salía 93%; es 100%.)
- **El ticket se redondea a decenas** y nunca sale la cifra de una sola tienda.

Verificado en el HTML generado: cero UUIDs, cero correos, cero nombres de
cuenta.

**Correr:** `node --experimental-strip-types --import ./scripts/de-registrar-hooks.mjs scripts/de-indice.mjs [--guardar]`
(sin `--guardar` solo imprime).

#### Lo que le falta al índice para ser fuerte

- **No se puede segmentar por giro.** `companies.giro` está vacío en 111 de 145
  y donde existe es texto libre («moda», «Moda», «SNEAKERS», «Multimarca…»).
  Con giro limpio el índice pasaría de una cifra nacional a una por ramo, que
  es mucho más citable. Es trabajo de datos, no de código.
- **Ocho semanas de historia** (desde 2026-07-25). Una edición mensual empieza a
  tener serie —y por tanto tendencia, que es lo más citable— en unos meses.

### Lo que sigue de la etapa 4

1. Autoridad y PR.
2. Medir si el MCP se usa de verdad (`de_herramienta_usos` con `puerta='mcp'`).
   Hoy la tabla está limpia: las filas de prueba se borraron y desarrollo ya no
   escribe.

### Cómo se ven las tres juntas

Se enganchan entre ellas y con los artículos, que era el punto:

- `/recursos/curva-de-tallas` → auditor de curva
- auditor de curva → `/recursos/nivelacion-...` cuando la corrida está rota
- `sale-o-no-sale` → auditor de curva antes de rebajar (el sell-through del
  estilo esconde el de la talla)
- `nivelar-entre-tiendas` → auditor de curva cuando el núcleo fue supuesto


---

## Revisión de bugs (17-sep-2026) — nueve fallos, tres ya hacían daño

Revisión sistemática buscando fallos **silenciosos**: los que no tiran nada y
por eso nadie encuentra. El patrón que más apareció es siempre el mismo —una
escritura a Supabase cuyo error nadie mira, o una lectura que PostgREST corta en
1000 filas sin avisar—.

### Los que ya estaban ocurriendo

1. **El motor priorizaba mal lo que escribe.** `puntuarClusters` leía
   `de_queries` sin límite: 2,762 consultas, entraban 1,000. El 64% de la
   evidencia no contaba. Al arreglarlo: **92 de 149 problemas cambiaron de
   score** y **9 de las 10 posiciones del top cambiaron**.
2. **Las herramientas guardaban el visitante vacío.** Las tres islas leían
   `localStorage.getItem('sacs_vid')` y `sacs_vid` es una **cookie**. Siempre
   null → la cadena de atribución de la etapa 5 no tenía de dónde colgarse. Se
   lee del lado del servidor, donde nadie lo puede olvidar.
3. **La nivelación rellenaba filas con ceros inventados.** Por API/MCP, una
   tienda con una talla de menos salía con un cero en la última, el cero se leía
   como hueco del núcleo, y la herramienta proponía mover piezas para tapar un
   agujero inexistente.

### Los que esperaban su momento

4. **Bucle infinito de pago.** El vigilante revivía acciones con lease vencido
   sin mirar `max_intentos`. El tope solo vivía en `fallar()`, que corre cuando
   el worker SOBREVIVE — o sea, no en el caso para el que existe el vigilante.
5. **El presupuesto del mes se podía cruzar dentro de una corrida** (foto vieja
   leída una vez antes del bucle).
6. **`//otrositio.com` pasaba como enlace interno** (empieza con `/`).
7. **Pagar dos veces por la misma señal** (marcado sin revisar el error).
8. **Publicar/revertir/retirar devolvían éxito sin escribir.** `revertir()` es
   el botón de emergencia: devolver la versión sin haber escrito deja el daño
   publicado y a todos creyendo que ya se arregló.
9. **El AVS se podía mover por un accidente de infraestructura** (sin índice
   único, un worker muerto entre medir y marcar duplicaba muestras).

### La regla que sale de aquí

**Toda escritura a Supabase mira su error.** Si el fallo pierde trabajo ya
pagado, se lanza; si estamos ya manejando un error, se avisa por consola y se
sigue. Y **toda lectura que cuenta, promedia o agrupa usa `traerTodo()`**
(`src/lib/demanda/paginar.ts`): si leer bien es más incómodo que leer mil,
alguien va a leer mil.

Prueba nueva: `bloques.test.ts`, 62 casos sobre la frontera de seguridad —donde
texto de un MODELO se vuelve HTML servido en el dominio—. `npm test` son 7
suites, 202 casos.

---

## Etapa 5 · parte A hecha (17-sep-2026) — la atribución

La pregunta que justifica el motor entero: **¿qué de esto trae clientes?** Todo
lo demás cuenta lo que el motor HACE; esto cuenta lo que CONSIGUE. Sin ello el
sistema optimiza lo que sabe medir en vez de lo que importa.

### La cadena

    activo del motor  →  toque anónimo   →  contacto   →  cliente   →  ARR
    (página o          (sacs_vid en      (contacts.    (subscri-
     herramienta)       cookie)           visitor_id)   ptions)

Cuatro vistas en la base (`2026-09-17-demand-engine-E5-atribucion.sql`):

- **`de_toques`** — cada contacto entre un visitante y un activo del motor. Es
  vista y no tabla: el dato ya vive en `de_herramienta_usos` y `contact_visits`,
  y copiarlo crearía dos verdades que se separan.
- **`de_recorridos`** — por contacto: qué lo trajo (primer toque) y qué lo
  convenció (último). Son dos preguntas distintas y dos presupuestos distintos.
  **Solo cuenta toques ANTERIORES al alta**: lo que alguien navegó después de
  ser cliente no lo trajo, y contarlo es la manera más fácil de que estos
  números mientan a favor.
- **`de_atribucion`** — el resumen por activo: leads, clientes, ARR.
- **`de_atribucion_cobertura`** — sobre cuántos se puede opinar.

Pantalla: CRM → Motor de demanda → **«¿Qué trae clientes?»**
https://code.sacscloud.com/shots/755df3efa91d2c08.png

### ⚠️ La cobertura va SIEMPRE junto a las cifras

Solo **17 de 388 contactos (4.4%)** traen rastro web, porque la mayoría de los
leads llegan por WhatsApp, por el ABM y por TikTok — esa gente nunca tuvo una
cookie nuestra. Enseñar «0 clientes atribuidos» sin ese marco es **inventar un
fracaso**, y a un dueño que lee eso hay que darle tres meses para que vuelva a
creer en el número.

Por eso la cobertura viaja en la misma respuesta del endpoint y no en una
llamada aparte: separarlas es garantizar que alguna pantalla acabe enseñando una
sin la otra.

### Dónde va hoy

    26 visitantes tocaron el motor · 0 se han vuelto contacto · $0 atribuido

Es el resultado correcto, no un bug: las páginas llevan un día y las
herramientas horas. (Y una parte de esos toques es tráfico propio de QA con
navegador; no convierte nunca, así que no ensucia la atribución, pero conviene
saberlo al leer los conteos pequeños.)

### Lo que sigue de la etapa 5

1. Evaluación de predicciones: el motor apuesta un score y hay que medir si
   acertó.
2. Recalibración de pesos con lo aprendido.
3. Experimentos (A/B de títulos y formatos).
4. Demand Capture Score.


---

## Etapa 6 · parte A hecha (17-sep-2026) — la rampa de autonomía

La pregunta de esta etapa no es técnica: **¿cómo se gana un sistema el derecho a
hacer más cosas solo?**

### La asimetría, que es lo único importante

- **BAJAR es automático.** Dos rechazos del dueño del mismo tipo en 14 días y
  ese tipo pierde autonomía al instante, sin preguntar. Corre dentro del ciclo
  diario: un freno que hay que acordarse de pisar no es un freno.
- **SUBIR solo se PROPONE.** El motor reúne la evidencia y la enseña; el permiso
  lo da una persona con un clic.

Un sistema que se otorga permisos a sí mismo no es autónomo, es un sistema sin
frenos con buena prensa. Y la asimetría no es timidez, es aritmética: equivocarse
bajando cuesta unas aprobaciones de más; equivocarse subiendo cuesta que el
motor publique en un sitio real algo que nadie quería — y eso se paga en
confianza, que es lo que más tarda en volver.

### Los criterios (`src/lib/demanda/autonomia.ts`)

Se evalúa **tipo por tipo**, no en bloque: subir la autonomía global de golpe
mezcla lo que el motor ya hace bien (agrupar señales) con lo que apenas empieza
(publicar), y el permiso acaba concedido por el promedio de dos cosas que no se
parecen.

1. **Ningún rechazo del dueño en 14 días.** Es el que más pesa: el único que
   mide si el CRITERIO del motor coincide con el de la persona, y no solo si el
   código no truena.
2. **Al menos 5 aprobaciones del dueño.** Cero rechazos sobre cero decisiones no
   es buen historial, es un historial VACÍO — y confundir las dos cosas es
   exactamente cómo un sistema se sube solo.
3. **Menos del 10% de corridas muertas**, sobre un mínimo de 10 corridas.
4. Para contenido, lo que fijó el plan (tarea 6.1): **20 publicaciones seguidas
   con auditoría ≥ 9** (se toma la PEOR nota de cada una, no el promedio) y
   **ninguna retirada**.

Las políticas `inmutable` y las de riesgo `CRITICAL` quedan fuera de la rampa:
si bastara con portarse bien un rato para quitarse los frenos, no serían frenos.
`autonomia.revisar` es ella misma inmutable.

### El candado del servidor

`POST /api/crm/demanda/ajustes` con `conceder_autonomia` **vuelve a calcular la
evidencia en el servidor** antes de conceder. Un permiso concedido sobre una
lista que mandó el cliente es un permiso concedido por el cliente.

Probado: conceder algo no ganado → 409 con lo que falta; conceder un guardrail →
403; conceder un tipo inventado → 400. Cero políticas cambiadas.

### Probado de punta a punta

Se simularon dos rechazos de `contenido.borrador`:

    bajó solo: nivel 2 → 3
    y con la autonomía global en 2, ese tipo pasó a nacer «necesita_aprobacion»

Datos de prueba borrados y política restaurada a 2.

### Dónde va hoy

Ningún tipo se ha ganado subir, y la pantalla dice por qué: **el dueño no ha
aprobado nada todavía** (0 aprobaciones de las 2 que esperan) y falta historial.
Es la respuesta correcta, no un bloqueo.

Pantalla: CRM → Motor de demanda → Sistema → Ajustes
https://code.sacscloud.com/shots/33e793e84f582e70.png

### Un estorbo local que cuesta tres minutos cada vez

El segundo `astro build` seguido en esta máquina falla siempre con
`EEXIST: mkdir '.vercel/output/server/'`. **No es un bug del código**: el
adaptador de Vercel hace `mkdirSync` sin `recursive` sobre el directorio que
dejó el build anterior. En el CI de Vercel nunca pasa porque cada build arranca
en limpio; en local pasa uno de cada dos.

La compilación en sí ya terminó cuando esto revienta —el log dice
`Rearranging server assets ✓`— así que es puro tiempo perdido diagnosticando
algo que no está roto.

**Usa `npm run build:local`**, que borra `.vercel/output` antes. Tres minutos
por build, y ya lo pagué dos veces en esta sesión.

---

## Etapa 6 · parte B (17-sep-2026) — el latido, y dos controles que no controlaban

### 🔴 El modo simulación era un interruptor sin efecto

«Modo simulación (decide y muestra, sin publicar)» solo marcaba la fila del
ciclo y cambiaba su clave de idempotencia. **Ninguna función que publica,
revierte, retira o edita una página consultaba esa bandera.** Quien lo
encendiera para ir con cuidado habría publicado igual.

Un control de seguridad que no controla nada es peor que no tenerlo: el que no
existe se nota, y el que miente da permiso para confiarse.

Lo mismo con el **apagador**: `encolar()` lo respeta, así que no entra trabajo
nuevo — pero una publicación disparada desde la API no pasa por la cola. El
dueño que aprieta «Apagar el motor» espera que deje de escribir, no que deje de
encolar.

**Los dos viven ahora en `src/lib/demanda/salida.ts`, en UNA pregunta:** ¿puedo
afectar al mundo de afuera ahora mismo? Repartir esa comprobación por cada
función que escribe es garantizar que la próxima se olvide.

Cubre `publicar`, `retirar` y —el agujero más fácil de no ver— **`enlaces`, que
edita el cuerpo de páginas ya publicadas**: es un efecto hacia afuera tanto como
publicar, aunque no lo parezca por llamarse «enlaces».

`revertir` NO se frena por simulación: deshacer un daño no es afectar al mundo,
es dejar de afectarlo. Sí respeta el apagador, que es otra decisión.

Probado de punta a punta sobre contenido real: simulación → no tocó nada y dijo
qué habría hecho; normal → publicó; apagado → no publicó. El artículo se
restauró a su versión anterior.

### El latido (`/api/cron/de-latido`, cada 30 min)

Un sistema autónomo no muere gritando: **se queda callado**. Deja de tomar
trabajo, o lo toma y no lo acaba — y todas esas formas de estar muerto se ven
igual desde fuera que estar tranquilo.

**Es un cron PROPIO y no un paso del ciclo**, y esa es la decisión que importa:
un vigilante que se ejecuta desde la cola no puede avisar cuando el muerto es la
cola.

Cuatro signos, con topes generosos a propósito (un latido que avisa por
cualquier cosa se silencia a la semana, y entonces no avisa por nada):

1. **El worker termina trabajo** — solo cuenta si hay trabajo esperando.
2. **El ciclo diario abre** — 26 h de margen: un despliegue a las 6 se come la
   invocación y esperar al día siguiente es lo correcto.
3. **El motor se revisa a sí mismo.**
4. **Nada se queda colgado** — leases vencidos son el síntoma de un worker que
   se muere a media acción.

Avisa **como mucho una vez al día** (la clave lleva la fecha): un motor callado
tres días avisando cada media hora convierte la campana en ruido.

**El latido deja huella de que corrió** (`de_config.latido_at`), sano o no. Sin
eso, «corrió y todo bien» era indistinguible de «no corrió» — y el fallo que el
latido NO puede reportar es el suyo propio. Con la marca, ese silencio envejece
y se ve: si pasan más de 90 minutos, el propio latido lo levanta como signo
(«lo que ves puede estar viejo»). Probado simulando 3 h sin correr.

Es el problema clásico del vigilante. La salida barata no es otro vigilante
—tendría el mismo problema un nivel más arriba— sino hacer que **el silencio sea
medible**.

El panel va ARRIBA de todo en la pantalla Sistema:
https://code.sacscloud.com/shots/4bb8538b9f6fc88e.png

### 🔴 Y el autodiagnóstico encontró un bug a la primera

`diagnosticar()` agrupa las acciones muertas de 24 h y enseña el error más
repetido. La primera vez que se corrió:

    «agrupar» se rindió 4 veces en 24 h: DELETE requires a WHERE clause

**`agrupar` llevaba DOS DÍAS muriendo en producción** (16 y 17 de septiembre, 3
intentos cada día) y nadie lo había visto. La causa: `delete from _pares;`
dentro de `de_refundir_clusters`. Supabase trae encendida la extensión que
bloquea UPDATE y DELETE sin WHERE, **y también aplica dentro de una función y
sobre una tabla temporal**.

Es la SEGUNDA vez que este proyecto tropieza con eso (la primera fue un UPDATE
en `de_recontar_enlaces`, que falló en silencio). Queda como regla: **en este
proyecto UPDATE y DELETE siempre llevan WHERE**, aunque la intención sea tocar
todas las filas y aunque la tabla sea temporal.

Arreglado con `truncate` —hace lo que se quiere, es más rápido, y no se puede
«simplificar» de vuelta sin que se note—. Al correrlo: **16 problemas duplicados
fundidos** que llevaban dos días acumulándose (1,173 → 1,157).

Sin el latido, el síntoma —clusters que se acumulan— habría tardado semanas en
ser evidente.

---

## Etapa 6 · parte C (17-sep-2026) — el operador de código

El motor encontraba **105 cosas mal en el sitio y no podía arreglar ninguna**:
están en archivos `.astro` del repositorio, y el motor corre en Vercel, donde el
código fuente no existe. Nadie había cerrado ese hueco.

### El reparto de conocimiento, que es lo que hace las órdenes útiles

- **El motor sabe QUÉ está mal** — qué URLs, qué regla, con qué gravedad. Lo
  midió rastreando el sitio de verdad.
- **El operador sabe DÓNDE están los archivos** — corre dentro del repo y puede
  COMPROBAR que el archivo existe.

Si el motor adivinara rutas de archivo desde Vercel, produciría órdenes que
apuntan a archivos inexistentes. Eso no cuesta cero: cuesta el rato de quien las
lee antes de descubrirlo.

`scripts/de-operador.mjs --pendientes` resuelve URL → archivo, **agrupa por
archivo** (varias URLs pueden salir de la misma plantilla dinámica; abrirla siete
veces es siete veces el mismo trabajo) y detecta las rutas dinámicas para decir
que ahí el arreglo no es editar un archivo.

### Una orden POR REGLA, no por página

25 metas cortas en 25 páginas son UNA tarea —escribir 25 metas con el mismo
criterio, de una sentada— no 25 tareas de una línea. Partirlas produce una cola
que parece enorme y que en realidad es un rato de trabajo, y eso desanima a
quien la abre.

La clave de idempotencia lleva el **conteo de URLs**: con la fecha se crearía una
orden nueva cada día con el mismo trabajo dentro; con solo la regla, una orden
vieja taparía los hallazgos nuevos. Con el conteo, la orden se rehace cuando el
alcance cambia — que es cuando de verdad es otra tarea.

Corre en el ciclo **semanal**, no el diario: una cola que se reescribe cada
mañana no es una cola, es ruido.

### 🔴 Y la primera tanda de órdenes destapó dos cosas

**1. Cuatro páginas que nunca debieron estar en el índice.** El motor las
levantó como «contenido delgado» y el arreglo no era escribir más:

- `/app/dashboard` y `/app/inbox` — **11 palabras cada una**, indexables. Son
  pantallas de la aplicación: le estábamos ofreciendo a Google dos páginas
  vacías.
- `/bienvenida` — acuse de «tu cuenta ha sido creada». Indexarla significa que
  un buscador puede mandar ahí a alguien que no se registró.
- `/registro` — formulario, misma familia que `/prueba-gratis`, que ya estaba
  fuera por esta razón exacta.

Las cuatro con `noindex` y fuera del sitemap. La regla cuenta palabras y no
puede distinguir «flaca» de «nunca fue contenido»; ahora el motor **señala las
sospechosas por su ruta** y el operador decide. Sin eso, alguien acaba
escribiéndole 600 palabras al inbox de la aplicación.

**2. Un falso positivo mío, visto al mirar la salida.** El patrón
`/\/bienvenida/` sin anclar marcaba `/blog/bienvenida/` —un artículo de 255
palabras— como acuse transaccional. Es decir: proponía sacar del índice un
artículo del blog. Los patrones van anclados al inicio de la ruta.

Aquí un falso positivo es peor que un falso negativo: lo segundo deja una página
flaca sin arreglar; lo primero esconde contenido bueno.

### Las 7 órdenes que esperan

    [media] Páginas con muy poco texto        41 páginas (4 son «no indexar»)
    [media] Páginas sin H1                     5
    [media] Páginas sin meta descripción       2
    [media] Títulos demasiado cortos           1
    [baja]  Meta descripciones cortas         25
    [baja]  Meta descripciones largas         24
    [baja]  Títulos demasiado largos           7

`node scripts/de-operador.mjs --pendientes`

---

## Etapa 5 · parte B (17-sep-2026) — el marcador y el aprendizaje

### 🔴 Primero: el ciclo se saltaba SEIS de sus dieciocho fases, en silencio

`armarCadena` hacía `if (!hayHandler(f.tipo)) continue;` sin decir nada. Los
conectores sí reportan por qué se omiten; las fases no. Resultado: el ciclo
llevaba días reportándose completo mientras omitía métricas, atribución y todo
el aprendizaje — **sin un solo fallo en la bitácora**, porque lo que no se
encola no puede fallar.

Ahora las fases omitidas entran en `omitidos` con su motivo, igual que los
conectores. Quedan tres sin construir: `detectar.decay`, `detectar.competidor`,
`aprender.recalibrar`.

### El Demand Capture Score · **3.2 / 100**

UN número que contesta: ¿qué tanto de la demanda que existe estamos capturando?
No sustituye a las otras métricas, las ordena — un tablero de quince cifras no
se mira; una que se mueve, sí.

| Parte | Peso | Hoy | Por qué pesa eso |
|---|---|---|---|
| Visibilidad en IA | 40 | **0.0** | Es el objetivo declarado. AVS 0/100. |
| Búsqueda sin marca | 25 | **3.0** | 5% de los clics no son de marca (meta 40%). El 95% restante es gente que ya nos conocía, y eso no es capturar demanda nueva. |
| Uso de activos | 20 | **0.2** | 2 usos en 30 días (meta 200). Un activo que nadie toca no captura nada. |
| Conversión | 15 | **0.0** | 0 de 26 visitantes dejaron datos (meta 5%). |

**Los techos son metas declaradas, no límites naturales.** Da igual que sean
discutibles; lo que no da igual es que estén escritos, porque si no el número
sube o baja según quién lo calcule.

Se enseña con las cuatro partes ABIERTAS: un agregado sin su descomposición no
se puede accionar. Saber que vas en 3 no dice qué mover; saber que la
visibilidad en IA aporta 0 de 40, sí.

Pantalla: CRM → Motor de demanda → Resumen (arriba de todo)
https://code.sacscloud.com/shots/d1fd9f0f5afd2a2f.png

### La serie diaria (`metricas.calcular`, `atribucion.procesar`)

Sin serie, dentro de tres meses nadie puede decir «el AVS pasó de 0 a X»: solo
cuánto vale hoy. Y una cifra sin ayer no distingue un sistema que funciona de
uno quieto.

Se guarda TODO cada día, aunque sea cero: guardar solo cuando hay algo deja
huecos, y un hueco es indistinguible de un cero al dibujar la gráfica seis meses
después. La atribución se congela igual —vive en vistas, que son una foto del
ahora— **con su cobertura al lado siempre**, porque una serie de leads
atribuidos sin cobertura no distingue «el motor mejoró» de «llegó más gente por
la web».

### 🔴 Y me volví a equivocar igual que al principio

La primera versión de `metricas.calcular` decía **«6 métricas guardadas»
habiendo guardado CERO**: `detalle` es NOT NULL y le pasaba `null`. El error se
registraba por consola y el resumen contaba intentos.

Es exactamente la clase de mentira que esta sesión lleva arreglando todo el día,
y la escribí otra vez. Ahora `guardarMetrica` devuelve si guardó, el handler
cuenta resultados, y **falla** si no guardó todo — una métrica que no queda es
un hueco en la serie, y la serie es el único motivo por el que esto existe.

Verificado contando en la base: 24 métricas guardadas hoy.

### Un bug de mi propio helper

`contar()` pedía `select('id')` y **no toda tabla tiene `id`** — `de_paginas` se
identifica por `url`. Fallaba con un error VACÍO (PostgREST no dice qué columna
falta), que es la peor forma de fallar: manda a buscar donde no es. Ahora pide
`*` con `head: true`, que no transfiere nada y no supone columnas.

### Predicciones

El mecanismo existe y está vacío: el motor no ha publicado nada por el flujo
completo de oportunidad, que es donde se registra la apuesta. Construirlo antes
que los datos es a propósito — hacerlo después, con las predicciones ya vencidas
y sin nadie que las guardara, es no poder evaluarlas nunca.

---

## 17-sep-2026 (noche) — el ciclo completo, y el Índice publicado

### ✅ El Índice está PÚBLICO

Decisión del dueño: publicar y él se encarga de la parte legal.
`/indice-moda-mexico` responde 200, con schema `Dataset` y licencia CC BY 4.0
—citarlo no hay que consultarlo con nadie—. Anunciado en el sitemap del motor y
en `/llms.txt` bajo «Dato propio y citable».

El sitemap solo lo incluye **si hay edición publicada**: anunciar una URL que
contesta 404 gasta la credibilidad del sitemap en una página que no existe, y
esa credibilidad se usa para las que sí.

### ❌ Las «2 acciones esperando tu OK» no existían

Eran artefactos de mi propia prueba de vida de la cola (`clave_idem: local:…`,
payload vacío). Lo dije como si fueran decisiones reales del dueño y no lo eran.
Borradas. La rampa de autonomía no está bloqueada por inacción: está esperando
que el motor produzca trabajo real que aprobar.

### Las 18 fases del ciclo, completas

Faltaban tres y ya están:

**`detectar.decay`** — páginas que pierden visibilidad. La corrección que lo hace
honesto: **se compara contra el movimiento del PROPIO sitio**. Una página que
cae 30% mientras todo el sitio cae 30% no decae: es la temporada. En moda eso no
es académico — un sistema sin esa corrección avisaría cada enero de que todo se
muere.

Resultado hoy: *ninguna página cae más que el sitio* (el sitio −4.2% en 28 días).

Dos falsos positivos que se quitaron al verlos:
- `/prueba-gratis` pasó de 68 impresiones a 0 **porque yo la saqué del índice**
  esta mañana. Reportar eso es avisar de una decisión propia.
- Otros subdominios (`app.`, `middle.`) no son contenido que el motor gestione.

**Y eso destapó algo que sí importa:** en Search Console aparecen
`dev.sacscloud.com` (578 impresiones, **responde 200 sin noindex ni
robots.txt** — un entorno de desarrollo abierto a Google) y `ww.sacscloud.com`
(con una w de menos, **310 impresiones y 106 clics** que eran del sitio bueno).
Quedan como hallazgos `subdominio_indexado` de severidad alta. No los arreglo
desde este repo: son DNS y otros despliegues.

**`detectar.competidor`** — temas que varios competidores tocaron y nosotros no.

La primera versión sacaba palabras sueltas de la ruta y devolvió **3,356
«temas»** encabezados por `product`, `marketing`, `contact` y `pricing` — que no
son temas, son secciones de menú que tiene todo el mundo. Ahora usa el último
segmento de la URL y exige que sea de **varias palabras**: un slug de una
palabra es una sección, uno de varias es un artículo.

Con eso: **120 temas reales**, y el mercado dice algo claro —

    5 comp · case-studies              4 comp · inventory-management
    4 comp · whatsapp-business-api     4 comp · marketing-automation
    3 comp · whatsapp-business         3 comp · chatbot-whatsapp
    3 comp · whatsapp-marketing        3 comp · crm-whatsapp
    3 comp · fashion-and-apparel

**Cinco temas distintos de WhatsApp**, cada uno tocado por 3-4 competidores. Y
Sacs TIENE WhatsApp —inbox, Kapso, multilínea— y no tiene contenido sobre eso.

**`aprender.recalibrar`** — ajusta los pesos del score con la evidencia. La regla
que lo hace seguro: **sin 30 predicciones evaluadas NO recalibra**. Un ajuste
sobre cuatro casos no aprende: mueve los pesos al azar y lo llama aprendizaje —
y como el score decide qué escribe el motor, eso son semanas trabajando en lo
que no importa. Tope del 20% de movimiento por ronda, para que una racha de un
mes no dé la vuelta al criterio.

Pide aprobación **siempre**, y guarda la versión nueva SIN activarla: la
aprobación de la acción y la activación de los pesos son dos decisiones.

### La evidencia ahora dice su edad

La orden «páginas sin H1» incluía `/producto/`, que tenía H1 desde hacía horas:
el rastreo es semanal y yo pedí las órdenes el mismo día. Ahora cada orden dice
cuándo se midió y avisa si pasa de tres días.

Se rastreó de nuevo (105 de 127 páginas frescas) antes de tocar nada.

### Lo que sigue

1. Experimentos (A/B de títulos y formatos).
2. Las 7 órdenes de trabajo del sitio.
3. El contenido de WhatsApp, que es el hueco más grande que encontró el motor.

---

## 17-sep-2026 · Las cuentas de IA y por qué el AVS era 0

### Perplexity contestaba sin buscar

`perplexity/sonar` en `/v1/responses` responde **de su propia memoria** si no se
le pasa `tools: [{ type: 'web_search' }]`. No da error, no avisa: contesta bien
y sin una sola fuente. Así estuvimos midiendo lo que el modelo recuerda de su
entrenamiento en vez de lo que ve un usuario de Perplexity en pantalla — que es
justo lo que la gente usa Perplexity para hacer.

17 muestras con cero fuentes que parecían «la IA no cita a nadie».

Y las fuentes **no** vienen donde uno las busca: son un elemento propio del
`output` con `type: 'search_results'`, no `content[].annotations`. Se leen las
dos formas porque las dos existen.

### Cada plataforma guarda las citas distinto

ChatGPT y Perplexity devuelven la URL completa; **Gemini devuelve solo el
dominio** en `title` (su `uri` es un redirector de Google que no dice de quién
es la fuente). Cualquier cosa que agrupe citas por dominio tiene que aceptar las
dos formas — de ahí la función `de_dominio_citado()`.

Sin eso, 199 citas se agrupaban bajo un dominio vacío y parecía que nadie citaba
nada.

### Quién SÍ está citado (y nosotros no)

Con la medición arreglada, los dominios que las IAs usan como fuente:

```
treinta.co · mproerp.com · alegra.com · emergeapp.net · joor.com · orisha.com
youtube.com · syskapos.com · sicarx.com · bind.com.mx · lightspeedhq.com
gestionqbsmoda.com · sizesandcolors.com · infor.com · powergest.com · capterra.mx
```

`sacscloud.com` **no aparece ninguna vez**. Y dos de esa lista no son
competidores: **capterra.mx** (directorio de reseñas) y **youtube.com**. Son
superficies de terceros donde no hay que ganarle a nadie — hay que existir. Es
el camino más corto a la primera cita, más corto que otro artículo propio.

### El saldo de las cuentas: lo que enseñó el apagón

Anthropic y OpenAI se quedaron sin crédito. Lo importante no es el apagón, es lo
que se vio al medirlo:

- **9,152 llamadas fallidas en cinco días**, 5,474 en un solo día. No cuestan
  dinero (un 400 no se cobra), pero cada una es un viaje de red antes de empezar
  a trabajar y deja un fallo en `ia_uso` que no es un fallo del motor. Con miles
  así, la bitácora deja de servir para encontrar los fallos que sí importan.
- **La conmutación entre proveedores funcionaba** —por eso nadie lo vio: el
  trabajo salía por Gemini—. Lo que faltaba era **memoria**: cada llamada volvía
  a descubrir lo mismo desde cero. Ahora un proveedor que responde por saldo o
  llave inválida queda apuntado media hora, en memoria y en
  `de_config.umbrales.ia_sin_saldo`.
- `quota` y `exceeded` quedan FUERA de esa marca aunque sí disparen la
  conmutación: en Gemini casi siempre son el límite **por minuto**, que se libera
  solo. Marcar a Gemini media hora por un límite de sesenta segundos sería
  cambiar un problema por otro peor.
- Si TODOS están marcados se intenta igual con el orden completo. Una marca
  vieja no puede dejar al motor mudo.

**El CRM no tiene esa conmutación** (solo respaldo de plantilla de WhatsApp):
`agente:silencio` y `agente:respuesta` simplemente no corrieron. Ningún cliente
quedó sin contestar —se verificó: 0 conversaciones con entrante sin respuesta—
pero el seguimiento de leads callados se detuvo. Es un hueco pendiente.

### La medición GEO gastaba sin contarlo

`medirPrompt` sumaba solo el extractor. Las **cuatro llamadas a las plataformas**
no pasaban por `preguntar()` —no pueden: tienen que preguntar tal cual, sin
sistema ni esquema, o dejan de medir lo que ve un comprador— y por eso no
entraban a `ia_uso` ni al presupuesto. Las 68 muestras decían `costo_usd = 0`.

Con un tope de $150 al mes, eso es un tope que no ve venir su propio gasto. Se
agregó `anotarUso()` en `ia.ts`: la misma puerta a `ia_uso` sin obligar a pasar
por el contrato de `preguntar`.

El gasto se apunta **antes** de mirar si la muestra sirve: una respuesta que
llegó y luego no se pudo aprovechar se pagó igual.

### Contexto de gasto

El motor lleva **$3.64 de $150** en el mes. Lo que se comió el saldo de las
cuentas fue el CRM (agente de Trabajo Inteligente, ABM, guiones), no esto.

### La primera medición completa: AVS 0.4 y la primera mención

30 prompts × 4 plataformas, con saldo en las cuatro y Perplexity buscando de
verdad. 163 mediciones buenas, 5 errores (todos de Claude por tiempo de espera,
ninguno de saldo).

**Sacs apareció UNA vez en 120 respuestas**, y vale la pena leer cuál:

> **ChatGPT · «¿Cuál es el mejor punto de venta para una zapatería en México?»**
> Posición 6 · positivo · citó `www.sacscloud.com/?utm_source=openai`
> «Especializado en moda/calzado (matriz por número y color) y puede timbrar
> CFDI 4.0 desde el sistema. Ideal si haces apartados y comisiones por vendedor.»

Ese `?utm_source=openai` importa: **ChatGPT entró a la página y la leyó.** El
sitio no es invisible ni ilegible para el buscador de la IA. El problema no es
técnico — es que para las otras 29 preguntas no nos encuentra.

Y la pregunta donde sí nos encontró es la MÁS específica de las 30: zapatería,
no «tienda de ropa». Donde el nicho se estrecha, lo especializado gana. Eso dice
por dónde se escribe.

### Lo que citan las IAs (y no es lo que uno espera)

```
 12/30 preguntas  youtube.com          ← la fuente #1, por encima de Shopify
  9/30            shopify.com
  7/30            alegra.com · mproerp.com · loggro.com.mx
  6/30            help.shopify.com · gestionqbsmoda.com · infor.com
                  squareup.com · larksuite.com · emergeapp.net
  5/30            stockagile.com · treinta.co
  4/30            sicar.mx · pulpos.com · aptean.com · joor.com
```

**YouTube es la fuente que más citan las IAs para estas preguntas.** No es un
competidor: es una superficie donde no hay que ganarle a nadie, hay que existir.
Sacs tiene 31 videos en `public/` y video-guías hechas para clientes; nada de
eso está donde la IA lo pueda citar.

Los competidores que las IAs NOMBRAN (distinto de a quién citan):

```
 11/30  Shopify POS · Odoo        7/30  Pulpos · Lightspeed Retail · Alegra POS
  9/30  Shopify                   6/30  Square POS · Bind ERP · ManagementPro POS
```

Casi todos son genéricos. Los especializados en moda —Sizes and Colors,
gestionQBS, Stockagile— aparecen abajo. Ese es el hueco.

---

## 18-sep-2026 · El motor era ciego a lo que el motor publica

El día empezó buscando por qué las IAs no nos encuentran y terminó encontrando
que **el problema no era el sitio: era que el motor no veía su propio trabajo.**

### La cadena completa, porque cada eslabón escondía al siguiente

1. `/recursos/` devolvía **404** teniendo once guías publicadas debajo. No había
   índice, así que nada las enlazaba.
2. El rastreo leía **un solo sitemap** —`sitemap-index.xml`, el del build— y todo
   lo que el motor publica vive en `sitemap-demanda.xml`, porque son rutas
   `prerender = false` que el build nunca escribe en disco.
3. Por eso las guías salían `en_sitemap: false`, `huerfana: true` y con
   `palabras: null` — nunca se rastreaban.
4. Y esos hallazgos **no se podían resolver**, porque describían un problema que
   no existía. El motor se acusaba a sí mismo de esconder lo que acababa de
   publicar.

**Yo caí en el mismo error al diagnosticar**: comprobé si las guías estaban en el
sitemap mirando `sitemap-0.xml`, concluí que faltaban y lo reporté así. Estaban,
en el otro. Cuando un sistema tiene dos sitemaps, «¿está en el sitemap?» es una
pregunta mal hecha.

### Dos fallos más en el mismo upsert del rastreo

- **`en_sitemap` era un cerrojo de una sola vuelta.** Un bloque la pone en
  `false` cuando una página desaparece del sitemap y nada la devolvía a `true`
  cuando volvía. Una página recuperada quedaba fuera de la auditoría —título,
  meta, H1, schema— sin que nadie lo notara.
- **El rastreo escribía `origen: 'repo'` en todo**, incluidas las guías del
  motor. La limpieza de contenido retirado borra `where origen = 'motor'`: una
  guía retirada se habría quedado para siempre como página viva, generando
  hallazgos sobre una URL que devuelve 404.

Ahora los sitemaps se leen de **robots.txt** (ya es la declaración pública de
cuáles son) y un sitemap caído detiene el rastreo en vez de dejarlo continuar
con un mapa incompleto — sin eso, un 500 pasajero habría marcado once guías
como salidas del sitemap.

### El gasto se contaba doble

Cada llamada del motor a Anthropic dejaba DOS filas en `ia_uso` con los mismos
tokens y el mismo costo: `claude-sonnet-5` y `anthropic:claude-sonnet-5`. Los
demás proveedores se llaman con `fetch` pelón, pero Anthropic va por el cliente
instrumentado del repo (`lib/ai/client.ts`), que ya registra su consumo — y
`preguntar()` lo registraba otra vez.

**El tope de $150 al mes habría frenado el motor a los $75 reales.** Esa es la
peor forma de fallar: desde afuera parece un límite respetado, no un error.

### El tope real del título es 53, no 60

La plantilla agrega « | Sacs» al renderizar y lo que Google recorta es el
`<title>` completo. Dos guías salieron con 62 caracteres estando «dentro» de 60.
Al escribir contenido nuevo, el título del CONTENIDO cabe en **53**.

### Y el caché de media hora

Las páginas dinámicas llevan `s-maxage=1800`. Un cambio a una guía publicada
tarda hasta treinta minutos en verse en producción — y mientras tanto el rastreo
lee lo viejo y levanta hallazgos correctos pero caducos. No es un error; hay que
saberlo antes de perseguir un fantasma.

### Resultado medible del día

```
hallazgos abiertos   89 → 55     (51 resueltos)
severidad crítica     0
severidad alta        0  ← eran 3, y eran los subdominios
guías huérfanas      11 → 0
guías en el sitemap   0 → 12
```

### El canal de YouTube: 509 videos, no 30

`@sacscloud` tiene **509 videos y 219,914 vistas** con 550 suscriptores. El
diagnóstico duro: **0 de 509 tienen subtítulos**, 154 no tienen descripción y
369 no tienen etiquetas. El 81% de las vistas está en 20 videos, y uno solo —el
de márgenes del ticket, de 2020— tiene 113,435: la mitad del canal.

Lo que importa para el objetivo: los 20 más vistos **ya están titulados como
pregunta** («¿Cómo funciona la versión OFFLINE?») y por eso funcionan. Los que no
jalan son los que se llaman como el módulo interno («EXCEL Y VENTAS SIN
EXISTENCIA», «ALTA MANIAL CON RECEPCION»).

Y el reparto por tema delata el hueco: talla y color tiene 5 videos, apartados 7,
**mayoreo cero** — siendo las tres preguntas medidas.

`scripts/yt-generar.mjs` reescribe los 224 que concentran el 95% de las vistas;
`scripts/yt-aplicar.mjs` los sube. **Escribir en YouTube exige OAuth del dueño
del canal**: ni una llave de API ni una cuenta de servicio sirven (Google
responde `youtubeSignupRequired`). Es un paso humano, una sola vez.

---

## 18-sep-2026 (tarde) · Comparativas, metas, y el canal completo

### Las cinco comparativas

`/comparar/` existía vacía mientras 5 de las 30 preguntas medidas son
comparativas. Ahora contesta las cinco: Shopify POS, SICAR, alternativas a
Sizes and Colors, genérico vs. moda, y «qué software maneja mejor talla, color
y temporada».

**La regla que las hace citables: una comparativa que solo gana es una que
nadie cita.** Cada página dice dónde la otra opción es mejor, y lo dice
citando textualmente lo que las IAs contestaron (`de_ia_muestras`). ChatGPT
dice que Shopify «suele bastar con complejidad operativa baja»; la página lo
cita y señala que esa condición es la que decide. Claude dice que SICAR «ya
tiene versión de moda con matriz de atributos»; la página lo reconoce.

**De dónde sale cada dato**, para que no haya que confiar:
- Precios: `planes.astro`. Vende $810 · Controla $1,215 · Fideliza $1,890 ·
  Automatiza $3,780. MXN/mes por tienda, sin contratos.
- Funciones: carpetas en `sacs3/src/views` (apartados, consignación completa,
  nivelación, mín/máx, demanda insatisfecha, días en anaquel, listas
  escolares, joyería, marketplaces con ML/Shopify/WooCommerce, 46 vistas con
  listas de precio).
- Terceros: respuestas reales de IAs o documentación pública. Lo que no está en
  ninguno se plantea como pregunta al proveedor, no como afirmación.

**El hallazgo de la quinta:** a «qué software maneja mejor talla, color y
temporada» las IAs contestan Centric PLM, Aptean, BlueCherry — sistemas para
fabricantes que cuestan un departamento. Una tienda no necesita un PLM. Esa
distinción no la hacía nadie.

### Las 41 metas largas

Google corta en ~160. La más larga tenía 283. Viven en SEIS formas distintas
(`description=` literal, `const desc`, registro de herramienta, plantilla por
país, plantilla con variables, frontmatter de blog); el parche
`scripts/metas-recortar.py` va texto exacto por texto exacto y exige que
aparezca una vez. **El comprobador me atajó doce recortes míos que seguían
pasándose por 1-12 caracteres.** Contar a ojo no sirve.

### El canal, cerrado

214 de 509 retitulados como pregunta y en contexto de moda (regla del dueño:
aunque el video sea genérico, se escribe en contexto de moda). 3 ocultados
(privados, no borrados). 6 + 1 pendientes por cuota, con `yt-terminar.sh` en
cron a las 07:15 UTC que se apaga sola al terminar.

**La trampa de la rutina:** con la cuota agotada, el ensayo en seco no imprime
nada, y la primera versión leía esa ausencia como «cero pendientes» — se habría
quitado del crontab dejando 6 videos sin aplicar para siempre. «No pude
comprobar» no es «no hay nada que hacer».

### Sigue abierto

- **DNS** (dueño): `dev.sacscloud.com` indexado sin noindex; comodín
  `*.sacscloud.com`; `ww.sacscloud.com` sin redirección.
- **OpenAI sin créditos otra vez** a las 22:52: solo $0.49 en 9 llamadas desde
  la recarga. O fue de un dólar o algo no instrumentado gasta.
- **Huecos vs competidor**: 15, casi todos ruido (WhatsApp ya cubierto,
  `tap-pay-android` y `buy-button` son de Square, `release-notes` y
  `getting-started` son docs). Vale un changelog público; lo demás no.

## 20-sep-2026 · El gate de calidad: nada llega a la bandeja sin pasar el referee

Construido `src/lib/demanda/calidad.ts` con tres fases nuevas del ciclo diario
entre el brief y la bandeja: **competencia** (gpt-5 `web_search` lee las 5
páginas que hoy rankean para la pregunta y guarda en `de_paginas_similares`),
**referee** (comprobaciones duras + juicio en 6 ejes contra la competencia;
devuelve a brief con correcciones, máx. 2 rondas, luego «atascada») e
**imagen** (portada documental con gpt-image-2 a storage, solo para lo que
pasó). Bloque `imagen` en `bloques.ts`; cierre por giro en `ContenidoMotor`
(`brief.giro` → `/giros/<giro>`); OG image en las tres rutas del motor. La
bandeja enseña veredicto, competencia, portada y giro; solo lista lo aprobado
y lo atascado. Primera pieza que pasó: `/software-para/tienda-de-novias/`
(8.4/10 tras 2 reescrituras, $1.27). El flujo completo y lo aprendido están
en `FLUJO-CONTENIDO.md`.

## 21-sep-2026 · Referee v2: 18 criterios, investigación con agentes, preview real

El referee pasó de 6 ejes a **18 criterios** (7 de los «flujos SEO/GEO» que
circulan + 11 propios: glosario, lenguaje del ramo, fotos, **diagrama con el
dato** —la imagen que enseña un AI Overview—, datos con fuente verificada, CTA a
mitad de camino, entidad, respuesta corta, frescura, legibilidad, video). Devuelve
además elementos mantener/cambiar, probabilidad de cita 0-100 con su primera
corrección, prompts de IA cubiertos/sin cubrir, video sugerido y
`necesita_del_dueno` (lo que el motor no puede generar). Bloques nuevos en
`bloques.ts`: `resumen` (speakable), `glosario` (DefinedTermSet), `diagrama`
(SVG→PNG con sharp, ImageObject), `imagen` intermedia (placeholder que llena
`contenido.imagen`), `video` (VideoObject). `contenido.competencia` ahora
puntúa competidores (respuesta/profundidad/prueba/frescura), marca si una IA ya
los cita, y busca fuentes verificadas. **Preview real**:
`/{seccion}/{slug}/?borrador=1` con sesión del CRM (noindex, sin caché), botón
en la bandeja. Investigación profunda con 3 agentes en `scripts/investigacion/`
(+ `inyectar-brief.mjs`). Todo documentado en `GUIA-CONTENIDO-REPLICABLE.md`.

Tropiezos: `import` de JSON en Node pide `type: json` (los datos van en .ts);
Anthropic exige streaming para salidas > 8k tokens (se hace en el proxy de
`ai/client.ts`); «Schema is too complex» y «additionalProperties must be false»
en el esquema del borrador (se dejó laxo y se normaliza al leer).
