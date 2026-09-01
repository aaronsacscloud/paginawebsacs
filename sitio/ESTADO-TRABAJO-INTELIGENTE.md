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

### Los archivos que importan

```
src/lib/crm/ti/
  reglas.ts          la cadencia, textos, horarios CDMX, CONFIG_DEFAULT
  motor.ts           enrolar, generarPlan (transformaciones + relojes + deudas), transiciones
  observador.ts      barrido de eventos (respuestas, vistas) → P1
  campos.ts          registro de campos + allow-list de escritura + detector de deudas
  copiloto.ts        la IA que conversa (cobertura por SLA, estafeta, ia_log)
  wiki-comercial.ts  lo que la IA SABE (precios, módulos, límites)
src/components/admin/TrabajoPanel.tsx    el panel (día + pestaña Datos)
src/pages/admin/trabajo.astro            la página
src/pages/api/crm/ti/{plan,tarea,enrolar}.ts
src/pages/api/cron/{ti-plan,ti-observador}.ts
scripts/ti-*.mjs                          siembra, arranque, auditoría, copiloto, aprender
scripts/migration-2026-09-trabajo-inteligente.sql   (ya corrida)
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
