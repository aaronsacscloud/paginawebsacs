# Trabajo Inteligente — DÓNDE QUEDAMOS (2026-09-01)

> Para retomar en otra sesión (Fable 5.1 o quien sea): lee **este archivo
> primero**, luego `PLAN-TRABAJO-INTELIGENTE.md` (el spec completo con las 6
> rondas de decisiones). Todo lo de abajo YA ESTÁ EN PRODUCCIÓN salvo lo
> marcado como pendiente.

## Qué es

Panel de «siguiente mejor acción» para el vendedor: una tarea a la vez, con
el contexto y los botones para ejecutarla. Vive en **`/admin/trabajo`** (página
completa) y como **tab del CRM** (`/admin/crm?tab=trabajo`, primer renglón del
menú lateral, arriba de Dashboard).

## Construido (con su commit)

| Fase | Commit | Qué |
|---|---|---|
| F0 motor | `60c20cc3` | esquema `ti_*`, cadencia 9 toques/3 semanas, transformaciones, API, cron |
| Arranque | `007b227d` | auditoría IA del backlog: 9 revividos con ángulo, 39 a nutrición |
| F1 panel | `aae94f62` `16d1bb33` | los 7 layouts, WhatsApp/correo reales, omitir, fila |
| F2 observador | `e87bfc53` | respuestas y vistas de cotización → P1; relojes 3·7·14, 2d, 3d, 30d |
| F3 datos | `04413f99` | registro de campos, detector de deudas, pestaña Datos con escritura real |
| F5+F6 copiloto | `b09458b3` | wiki comercial, cobertura por SLA, ciclo de aprendizaje 24 h |
| **A0 bitácora + perfil** | (pendiente de commit) | `ti_eventos` con 7 adaptadores idempotentes + backfill 90 d (6,651 eventos); `ti_perfil` recalculado desde la bitácora (264 perfiles); mejor hora desde CUALQUIER respuesta con write-through a `ti_cadencias.mejor_hora` |

### Los archivos que importan

```
src/lib/crm/ti/
  reglas.ts          la cadencia, textos, horarios CDMX, CONFIG_DEFAULT
  motor.ts           enrolar, generarPlan (transformaciones + relojes + deudas), transiciones
  observador.ts      barrido de eventos (respuestas, vistas) → P1
  campos.ts          registro de campos + allow-list de escritura + detector de deudas
  copiloto.ts        la IA que conversa (cobertura por SLA, estafeta, ia_log)
  wiki-comercial.ts  lo que la IA SABE (precios, módulos, límites)
  eventos.ts         A0: adaptadores → ti_eventos (marca de agua por fuente en ti_config.eventos_marca)
  perfil.ts          A0: recalcularPerfil(contactId) desde ti_eventos → ti_perfil (determinista, regenerable)
src/components/admin/TrabajoPanel.tsx    el panel (día + pestaña Datos)
src/pages/admin/trabajo.astro            la página
src/pages/api/crm/ti/{plan,tarea,enrolar}.ts
src/pages/api/cron/{ti-plan,ti-observador,ti-eventos}.ts   (ti-eventos: backfill ?dias=N, ?fuentes=a,b, ?perfiles=todos)
scripts/ti-*.mjs                          siembra, arranque, auditoría, copiloto, aprender
scripts/migration-2026-09-trabajo-inteligente.sql   (ya corrida)
scripts/migration-2026-09-ti-eventos.sql            (ya corrida: ti_eventos + ti_perfil)
```

### Interruptores (todos reversibles)

```bash
cd /opt/sacs/paginawebsacs/sitio
node scripts/ti-copiloto.mjs --estado|--on|--off   # el copiloto (HOY: APAGADO)
node scripts/ti-encender-arranque.mjs [--apagar]   # auto-enrolar leads nuevos (HOY: ENCENDIDO)
node scripts/ti-sembrar-demo.mjs [--limpiar]       # los 10 contactos demo (HOY: SEMBRADOS)
node scripts/ti-aprender.mjs [--ver|--aprobar]     # el ciclo de 24 h
node scripts/ti-auditoria-backlog.mjs [--solo-reporte|--reparar]
```

Crons en `vercel.json`: `ti-plan` cada 15 min y `ti-observador` cada 2 min,
ambos 14-23 UTC L-V (= horario laboral CDMX).

## LA SIGUIENTE ETAPA: autonomía (aprobada 2026-09-01)

Spec: `PLAN-TI-AUTONOMIA.md` (decisiones tomadas en §12). Orden: A0 → A1
(reglas como datos + panel «Reglas y lógica») → A2 (rampa + Próximos envíos)
→ A4 (copiloto SDR desde el minuto 0) → A3 (motor de política) → A5
(aprendizaje v2 en Supabase Edge + pg_cron — hay que `create extension
pg_cron, pg_net`, hoy NO están instaladas) → A6 (panel del dueño).

A0 HECHO (verificado en local contra el Supabase de prod): backfill de 90 d
idempotente (2ª corrida = solo lo nuevo), tick del observador incremental
(`eventos`, `perfiles` en su respuesta). Datos: 86 leads con mejor hora de
WA aprendida, 101 responden por WA, 0 por correo; el copiloto sigue apagado.

## EL AGENTE SDR DE WHATSAPP (pedido del dueño 2026-09-02) — en construcción

La IA lleva TODO lo previo a la reunión: entender giro/operación/dolor (texto o
audio), escuchar, ofrecer llamada o demo, agendar, confirmar, reagendar no-shows
y pasar la mano al consultor cuando la reunión ya se hizo. Para esos leads se
retiran las secuencias WA automáticas y los pasos WA de 1 clic (T3/T6/T8); el
humano: llamadas con propósito (T1 a 2 h sin respuesta, rescate tras 3 toques,
pre-cita si no confirma), demo y límites. **Sacs es solo moda**: el agente solo
habla de los 8 giros del sitio.

```
src/lib/crm/ti/agente-guion.ts        el GUION: estados, el orden (entender → escuchar → ofrecer → agendar → sostener → pasar la mano), contrato JSON
src/lib/crm/ti/conocimiento/
  giros.ts      8 fichas de moda (del sitio + oficio) + detectarGiro()
  planes.ts     4 planes de LICENCIA con precios (de plans.ts); complementos solo se mencionan
  producto.ts   ~35 módulos (del menú de sacs3) con plan mínimo, giros y «no hace»
  casos.ts      4 casos de éxito (landings)
  index.ts      contextoParaLead({giroCrm, conversacion, ultimoMensaje}) → ~2.5k tokens SOLO de lo relevante
scripts/ti-agente-sombra.mjs   MODO SOMBRA: decide sobre conversaciones reales sin enviar → ti_sombra (lote 2026-09-02: 45 casos, artifact 88a6e7e4)
scripts/ti-ejemplos.mjs        de conversaciones de MODA que convirtieron → ia_ejemplos (estado_rev propuesta) para que el dueño apruebe
scripts/migration-2026-09-ti-sombra.sql · migration-2026-09-ia-ejemplos.sql   (corridas)
```

Los scripts nuevos importan TS directo: correr con el Node 22 portátil y
`--experimental-strip-types` (los imports internos llevan extensión `.ts`;
`allowImportingTsExtensions` ya está en el tsconfig de Astro).

Plan del agente (cada paso lo prueba el dueño antes del siguiente): 1 sombra
(hecho) → 2 en vivo N2 con veto + botón «esto hubiera contestado yo» en el
inbox → 3 agenda directo + confirmaciones conversacionales + no-show → 4 reloj
de silencio con plantillas (marketing primero, 10 min, utility; el agente crea
los pares de plantillas solo, máx. 3/día) → 5 llamadas humanas con propósito
→ 6 medición y rampa a N3. Después: A8 voz entrante (ElevenLabs + Claude +
Muse de Meta para transcribir).

**Dónde «rellena» el dueño**: hoy por comentarios en los artifacts (sombra y
ejemplos) o por chat; yo lo traduzco a guion/ejemplos/reglas. La sección
«Conocimiento» del panel (A1) tendrá pestañas Giros · Producto · Planes ·
Ejemplos · Adendas con edición, fuente y fecha de compilación; lo editado a
mano nunca lo pisa el compilador nocturno.

Pagos/config necesarios: `ANTHROPIC_API_KEY` y `GROQ_API_KEY` en Vercel
(agente en vivo + transcribir audios: 105 de 106 audios de leads sin
transcripción); plantillas en Meta las crea el agente.

## PENDIENTES (dependen de algo externo)

1. **F4 Twilio** — el esqueleto ya existe (`lib/telefonia/twilio.ts` con token
   de voz sin SDK, TwiML, webhooks de estado y grabación). Faltan **el número
   y las envs `TWILIO_*` en Vercel**. Con eso: click-to-call desde la tarjeta,
   locución de grabación, transcripción SIEMPRE y extracción → sugerencias de
   dato en el lote. El panel ya dice «la llamada sale de tu teléfono por ahora».
2. **Válvula de plantillas** — registrar **T3/T6/T8 en Meta** y mapearlas en
   `ti_config.plantillas_meta` (`{"T3":"nombre_plantilla", …}`). Sin eso NO
   dispara, por diseño (nunca sale texto libre solo).
3. **Encender el copiloto** cuando el dueño quiera ver mensajes reales:
   `node scripts/ti-copiloto.mjs --on`.
4. **Sin maqueta todavía**: el panel del dueño (colas de todos, faltas,
   coberturas de la IA, aprobación de jugadas) y la calificación mensual del
   consultor — es lo que faltaba de F6.

## Trampas que ya costaron tiempo (no repetir)

- **`CrmDashboard.tsx` es un índice compartido**: otra sesión trabaja ahí
  (Comisiones). Commitear por **índice selectivo** (`git apply --cached` con
  solo los hunks propios) y verificar con `git diff --cached | grep -i comisiones`.
- **Los mensajes de WhatsApp son `direccion = 'entrante' | 'saliente'`**, no
  `in`/`out`. Y `wa_mensajes.kapso_message_id` es NOT NULL.
- **`ANTHROPIC_API_KEY` no vive en este repo**: los scripts la leen al vuelo de
  `/opt/sacs/sacs_api/.env`. En Vercel NO está puesta — si algún día el
  copiloto debe correr en el cron de producción, hay que agregarla ahí.
- **El dev server de Astro se cae solo** y deja cache viciado (504 Outdated
  Optimize Dep): matarlo y relanzarlo. QA con `astro-dev-toolbar` removido
  (`document.querySelector('astro-dev-toolbar')?.remove()`), si no intercepta
  los clics de Playwright.
- **Verificar deploys con `www`** y con cookie de sesión.
- **Cambiar `.env` reinicia el dev server y deja Vite roto** («Cannot read
  properties of undefined (reading 'call')»): matar, borrar
  `node_modules/.vite`, relanzar con el Node 22 portátil
  (`/tmp/claude-1000/-opt-sacs/67948eee-…/scratchpad/node22/bin`). El
  `CRON_SECRET` local (solo en `.env`, ignorado) sirve para disparar
  `/api/cron/*` a mano con `Authorization: Bearer`.
- **`quotes` no tiene `updated_at`**: el adaptador lee por cada reloj propio
  (`primera_vista_at`, `aceptado_fecha`…). `bookings` sí, pero el cambio de
  estado no tiene hora propia: se toma `updated_at` (payload `aprox`).
- Los contactos demo llevan `propiedades.demo_ti = true`, canales
  `@sembrado.demo` / `+5215500010xx`; el copiloto tiene candado para no
  escribirles.

## Datos reales que el sistema ya encontró (por si sirven de contexto)

- 9 leads con señal real revividos con ángulo (Sinia pidió precio y le
  mandaron catálogo sin cifra; Dannae y Amado Jr son el mismo negocio).
- 7 cotizaciones `sent` estancadas; una de julio ya cayó a decisión forzada.
- Ursula abrió su cotización (6 vistas, $24,750) y generó P1 «la está viendo».
- 45 clientes activos sin RFC, 4 sin cuenta SACS, 2 reuniones del 31-ago sin
  resultado registrado.
- El ciclo de 24 h destiló 6 jugadas y 6 huecos de wiki de conversaciones
  reales (precio anual, almacén como sucursal, canal de soporte, reagendar…).
