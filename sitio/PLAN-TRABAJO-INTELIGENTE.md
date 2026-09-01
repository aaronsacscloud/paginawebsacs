# Trabajo Inteligente — el motor de siguiente mejor acción

> Estado: **PROCESO APROBADO** (2026-08-31). Sigue: diseñar la interfaz juntos,
> luego construir por fases. Primero LEADS; clientes en segunda etapa.

## La idea en una línea

El consultor no ve listas: ve **UNA tarea a pantalla completa** — a quién tocar
ahora, por qué, con el contexto y los botones para ejecutarla ahí mismo. Detrás,
una cadencia genera el plan del día, un observador lo reordena en vivo, y una
memoria aprende de cada «omitir».

## Decisiones cerradas (con el dueño, 2026-08-31)

1. **Speed-to-lead**: la primera llamada NO espera 24 h. Lead que entra en
   horario laboral → llamada en <30 min. Fuera de horario → primera hora hábil.
2. **9 toques en ~3 semanas** antes de descalificar (4 llamadas, 3 WA, 2 correos).
3. **Cola por consultor con dueño**: cada lead tiene owner y su cadencia cae en
   la cola de esa persona; el dueño del CRM ve las colas de todos.
4. **Envío sugerido = 1 clic con lápiz**: el mensaje armado se ve completo;
   «Enviar» lo manda tal cual, el lápiz permite editar antes.
5. **Horario laboral**: L-V 9:00–18:00 CDMX. Define cuándo aplica el <30 min,
   cuándo se genera el plan y cuándo NO se sugieren llamadas.
6. **Disparos P1** (interrupción máxima): WhatsApp entrante · llamada
   entrante/perdida del lead · respondió un correo · **abrió/vio la cotización**.
   (Agendó/movió reunión NO es P1: ya lo cubren los avisos existentes.)
7. **Nombre**: «Trabajo inteligente». Prefijo de tablas: `ti_`.
8. **Nutrición**: al descalificar, el lead se enrola en una **secuencia nueva de
   largo plazo** (1-2 toques/mes) sobre el motor de secuencias existente (F5).

## Lo que YA existe y este módulo debe usar, no duplicar

| Pieza | Dónde | Papel en Trabajo Inteligente |
|---|---|---|
| Motor de secuencias multi-secuencia | `api/cron/leads-cadencia.ts` (850 líneas) | Envíos AUTOMÁTICOS y la nutrición post-descalificación. Ya sabe: responder detiene solo el canal, pausa "pidió tiempo", presión WA |
| Escalera del lead | `estatus_lead`: nuevo → contactado/respondió → descubrimiento → agendado → demo_hecha → … / descartado, sin_respuesta | El estado del que se derivan las tareas |
| SLA de primer toque | `api/cron/leads-sla.ts` (aviso 30/120 min) | El módulo lo ABSORBE: la tarea P2 es la alarma; los avisos quedan de respaldo |
| Telefonía Twilio | `lib/telefonia/twilio.ts` + `api/telefonia/*` (token voz navegador, TwiML, grabación) | Click-to-call desde la tarjeta; el webhook de estado registra el intento |
| Inbox WhatsApp (Kapso) | `api/crm/whatsapp/*` | Enviar plantilla/mensaje desde la tarjeta; el entrante dispara P1 |
| Cotizaciones (vistas) | `quotes.vistas`, `primera_vista_at` | Señal P1 "la está viendo ahora" |
| Atribución | cookie `sacs_attr` → propiedades del lead | Contexto de la tarjeta: de qué anuncio/giro/página vino |
| Agendador + reuniones | `wa_agenda_ofertas`, booking | Compromisos con hora = P3 |
| owner_id en contacts | `applyPartnerScope(..., 'owner_id')` | La cola por consultor |

**Regla de coordinación** (la más importante para no dispararse doble): mientras
un lead está en cadencia humana (T1–T8), las secuencias automáticas de
seguimiento quedan **pausadas para él**. Los WA/correos de la cadencia humana
salen del panel (1 clic), no del cron. Al descalificar, se le pasa la estafeta
a la secuencia de nutrición y sale del plan humano.

## La cadencia (máquina de estados del lead frío)

```
T0   Lead entra → WhatsApp automático al instante              [AUTOMÁTICO]
T1   Llamada <30 min (horario laboral; si no, 1ª hora hábil)   [HUMANO · P2]
T2   Llamada intento 2 — otro bloque horario, día 2            [HUMANO]
T3   WhatsApp "te busqué" (plantilla)                           [1 CLIC]
T4   Llamada intento 3 — día 4                                 [HUMANO]
T5   Correo personalizado (IA redacta, humano edita) — día 7   [EDITAR]
T6   WhatsApp con ángulo nuevo (caso de su giro) — día 10      [1 CLIC]
T7   Llamada último intento — día 14                           [HUMANO]
T8   Cierre "¿lo dejamos aquí?" — día 18-21                    [1 CLIC]
     → sin respuesta: DESCALIFICADO → secuencia de nutrición   [AUTOMÁTICO]
```

Reglas transversales:
- **Resultado de llamada obligatorio**: contestó / buzón / no contestó / número
  malo / ocupado. «Número malo» corta la rama de llamadas (no se queman
  intentos contra un número muerto) y salta a WA/correo; abre corrección del dato.
- Llamadas repartidas en **bloques distintos** (mañana/tarde), nunca dos el
  mismo medio día.
- **Cualquier respuesta rompe la cadencia** → el lead pasa a «conversación
  viva»: las tareas dejan de ser de cadencia y son de seguimiento a lo hablado.
  Ahí el consultor manda y el sistema solo recuerda compromisos.
- Compromiso pactado con hora («márcame el jueves 4pm») → tarea P3 a su hora,
  le gana a la cadencia del día.
- Contestó y hubo conversación real por teléfono → `contactado`, la cadencia
  fría termina igual que con una respuesta escrita.

## El observador — prioridades de la cola

La cola se recalcula con cada evento (webhook WA, estado Twilio, vista de
cotización, cita). El reordenamiento es ENTRE tareas: la tarjeta que estás
viendo nunca se te quita de las manos; al terminarla, la siguiente es la P1.

| P | Qué | SLA |
|---|---|---|
| **P1** | Respondió (WA/llamada/correo) o está viendo la cotización | minutos; se inyecta como siguiente tarea con aviso visual |
| **P2** | Lead nuevo sin primer toque humano | <30 min en horario |
| **P3** | Compromisos con hora (llamada pactada, reunión hoy) | a su hora, con margen |
| **P4** | Cadencia del día (T2…T8 que vencen hoy) | durante el día |
| **P5** | Rezagos de ayer | se arrastran, marcados atrasados |

## Humano / sugerido / automático

| Tipo | Ejemplos | Regla |
|---|---|---|
| Automático | T0, recordatorios de cita, mover a nutrición, registrar resultados Twilio | nada que suene "personal" sale solo fuera de esto |
| 1 clic | T3, T6, T8, reagendar tras buzón | texto ya armado con datos del lead; humano aprueba (lápiz opcional) |
| Editar | T5, primer mensaje tras respuesta compleja | IA redacta borrador con contexto; humano lo hace suyo |
| Humano puro | llamadas, conversación viva, calificar/descalificar antes de tiempo | el sistema pone contexto y botones |

(Coherente con la regla del módulo de email: la IA siempre borrador.)

## Omitir + autoaprendizaje

Motivos de catálogo (+ texto libre): ya lo contacté por otro lado · no es buen
momento · dato equivocado · duplicado · esta tarea no aplica a este tipo de
lead · otro.

Dos niveles:
1. **Inmediato (por lead)**: el motivo ajusta ESE lead ya — "ya lo contacté"
   registra el toque y avanza; "no es buen momento" pospone con cooldown;
   "dato equivocado" abre la corrección ahí mismo.
2. **Agregado (por proceso)**: cada omisión → `ti_omisiones` (tarea, contexto,
   motivo). Un análisis periódico detecta patrones («T2 a leads de Facebook se
   omite el 70%») y **propone cambios de regla que el dueño aprueba** — el
   proceso NO se automodifica en silencio; el panel de «reglas aprendidas»
   muestra qué cambió, cuándo y con qué evidencia.

## Modelo de datos propuesto (se afina en F0)

- `ti_tareas`: id, contact_id, owner_id, tipo (llamada/wa_plantilla/wa_libre/
  correo/compromiso/responder), paso (T1..T8|null), prioridad (1-5), vence_at,
  estado (pendiente/hecha/omitida/pospuesta/expirada), payload (mensaje
  sugerido, plantilla, tel), resultado, hecho_at, contexto_snapshot.
- `ti_omisiones`: tarea_id, motivo, texto, contexto, created_at.
- `ti_reglas`: regla propuesta/activa, evidencia, aprobada_por, estado.
- Config de cadencia: reusar `crm_cadencia_pasos`/`wa_config` donde alcance;
  lo humano (llamadas, bloques) probablemente pide tabla propia `ti_pasos`.
- El generador corre como cron temprano (plan del día) + recálculo por evento
  (webhooks). **Patrón obligatorio de crons**: nada de barridos ciegos.

## La interfaz (boceto — SE DISEÑA JUNTOS antes de construir)

Pantalla completa, una tarea. Barra: «Tarea 12 de 37 · 3 respondieron hoy».
La tarjeta: instrucción en una línea («Llámale — 2º intento, ayer no
contestó»), contexto que importa (fuente/anuncio, giro, último mensaje, cuándo
entró, historial de toques), botonera según tipo: enviar plantilla / redactar /
llamar (Twilio en el navegador) / editar correo. Abajo: Hecho · Omitir ·
Posponer. Móvil con el estándar m-* del CRM. Sin emoji; paleta de `paleta.ts`.

## Replanificación y casos límite (cerrado con el dueño, 2026-08-31 · 2ª ronda)

Cuatro principios que resuelven la mayoría:
1. **La fila es una proyección, no una libreta**: las tareas pendientes se
   derivan del estado del lead; un evento invalida y regenera, no apila.
2. **Nada muere en silencio: se transforma** — una vencida se re-decide
   (sube, se desliza, se convierte o se retira con causa registrada).
3. **Triage por valor, no por antigüedad**: con sobrecarga gana el lead
   caliente nuevo, no la tarea más vieja. FIFO aquí es un error.
4. **Las reglas duras deciden QUÉ existe; la IA decide el orden, redacta y
   CONVERSA** — con límites escritos (ver Copiloto).

Transformaciones al vencer:
- **P1 respondió**: nunca expira. Si el consultor no responde en el SLA, **la
  IA responde ella misma** (ver Copiloto) y la falta va al log del consultor.
- **P3 compromiso con hora**: se vuelve «promesa rota» — tarea al tope con la
  recuperación redactada; queda en la sección de FALTAS del consultor y el
  seguimiento del lead se recalcula frente a eso.
- **P2 lead nuevo de ayer**: sigue arriba, etiquetado honesto («entró ayer y
  nadie lo tocó»).
- **P4 cadencia**: se desliza sin duplicarse (reloj relativo al último toque,
  espaciado conservado). Si el deslizamiento estira la cadencia >35 días,
  salta al cierre T8. **Válvula aprobada**: plantilla de cadencia vencida
  24 h+ SALE SOLA (con nota en el hilo); solo plantillas fijas — nunca
  correos ni texto redactado.
- **Sobrecarga**: capacidad medida (ritmo real por tipo), plan al ~80%,
  triage P1 → promesas rotas → P2 → P3 → P4 por valor del lead; lo diferido
  queda visible («8 se recorrieron a mañana»), nunca se tira en silencio.
- **Día flojo**: la «banca» — reciclados con ángulo nuevo por IA, datos rotos,
  correos adelantables. Si la banca se acaba, el día terminó: se dice, no se
  inventa trabajo.
- **Reacomodo**: tras un día no trabajado, la primera tarjeta explica qué
  reacomodó el sistema y por qué.
- Colisiones: dos P1 → gana la ventana WA que expira antes; P1 nunca
  interrumpe la tarjeta en curso; P3 con hora gana en su ventana ±15 min;
  3 señales del mismo lead → UNA tarea consolidada.
- Raros: «ya no me escribas» → do-not-contact permanente; sin canales → tarea
  única «buscar otro canal»; duplicado → unir y SUMAR toques; compró → retiro
  total y onboarding; «mándame info» y se apaga → mini-rama de 3 toques;
  disputa de llamada → la grabación de Twilio es el árbitro.

## El copiloto IA (decisión del dueño: la IA conversa, el humano es responsable)

**La IA es un miembro del equipo, no un redactor.** Reglas:

1. **Cobertura por tardanza**: si un P1 rebasa el SLA sin que el consultor
   responda, la IA analiza la conversación completa y **responde ella misma**,
   de forma humana, con la base de conocimiento. No escala, no espera: cubre.
2. **Cobertura por ausencia declarada**: el consultor avisa su ausencia (a la
   IA, en lenguaje natural) → las cadencias se re-optimizan y la IA atiende
   las conversaciones completas hasta el regreso; lo que requiere humanidad
   se guarda con contexto para el regreso.
3. **La estafeta**: cuando el humano retoma, la tarjeta le dice qué pasó —
   «este lead esperó 3 h 40 fuera de lo estipulado; lo cubrí con 2 mensajes;
   la falta quedó en tu log» — y la IA ya analizó la conversación para
   sugerir la siguiente acción recalculada (la tarea ya no es «responder»,
   es «revisa lo que contesté y toma la estafeta»).
4. **Límites de lo que responde sola** (propuesta a validar en la práctica):
   información del producto, módulos, giros, cómo funciona X, links, agendar
   cita (reusa agenda-oferta), precios DE LISTA públicos. Nunca: negociar
   descuentos, prometer features o fechas, facturación/contratos, quejas —
   eso se guarda para el humano con nota de espera.
5. **Identidad** (recomendación registrada): la IA firma como parte del
   equipo, no se hace pasar por el consultor específico.
6. **Base de conocimiento**: una WIKI COMERCIAL para la IA, construida desde
   la página pública (giros, módulos, precios, casos) + la verdad del
   producto en sacs3/sacs4. Versionada en el repo como la wiki de procesos
   (`wiki-contenido.ts` es el precedente). Es una fase propia (F5).
7. Infra existente que se reusa: `lib/ai/client.ts` (Anthropic + costos),
   `lib/agent-tools/*` (registro con FORBIDDEN y aprobar/rechazar corridas),
   `api/agents/*`.

## Responsabilidad del consultor (decisión del dueño)

- **Log de faltas** por consultor: P1 atendido fuera de SLA, promesa rota,
  día no trabajado sin aviso, tarea expirada. Cada falta con su contexto.
- Al retomar, el sistema se lo dice de frente (sin drama, con datos): cuánto
  esperó el lead, qué cubrió la IA, y que quedó en el log.
- **Calificación mensual por IA**: lee el mes del consultor (faltas, tiempos
  de respuesta, omisiones, resultados: respuestas/citas/ventas) y produce una
  calificación + **propuesta de mejora mensual** concreta. Alimenta la
  pestaña `desempeno` existente.
- El motor recalcula el seguimiento del LEAD frente a cada inconsistencia:
  una promesa rota cambia el tono del siguiente toque; una cobertura de IA
  cambia la tarea del humano.

## Datos que se llenan solos (3ª ronda, aprobada 2026-09-01)

**Principio**: el dato se captura donde nace (en la tarjeta de la acción) o lo
extrae la IA de la conversación; al humano solo se le pide EL CAMPO exacto,
nunca «abre la ficha y llena».

- **Tres clases de deuda de dato**: BLOQUEANTE (impide una acción de hoy — se
  pega como primer paso de esa tarjeta, no va a lote) · COMERCIAL con
  vencimiento (reunión de ayer sin resultado a las 24 h, cotización vencida,
  hechos que contradicen la etapa — ¡TikTok lee la etapa!) · HIGIENE (va en
  lote).
- **Registro declarativo de campos** (extiende el patrón `campos-config.ts`):
  cada campo vigilado declara dónde vive, quién puede escribirlo
  (humano / IA-confirmada / IA-directa), su clase y cuándo «se debe».
  Agregar un campo = agregar un renglón.
- **Catálogo día 1** (aprobado): resultado de reunión a las 24 h · RFC/razón
  social al volverse cliente · cuenta SACS sin ligar · giro+sucursales+ciudad.
- **Pipeline de llamada**: grabación → transcripción SIEMPRE → extracción IA
  con confianza (resultado, datos nuevos, compromisos, objeciones, resumen
  3 líneas) → lo demás cae a la pestaña «Datos» como sugerencias con su
  fuente («lo dijo al min 3:40») → confirmar 1 clic escribe y firma. Igual
  sobre WhatsApp (barrido diario) y minutas (`draft-from-transcript` existe).
- **Escritura directa de la IA: graduación por aciertos** — todo empieza con
  confirmación; N confirmaciones sin corrección → el sistema PROPONE pasar
  ese campo a directo y el dueño aprueba.
- **Lotes en los valles**: el generador agrupa las tareas de dato por tipo y
  las sirve como UNA tarjeta-bloque (enter-enter-enter) colocada en los
  valles del día — nunca entre dos llamadas en caliente.
- **Grabación**: locución breve automática al conectar («esta llamada puede
  ser grabada»), aprobada.

## Llamada con propósito (aprobado 2026-09-01)

Toda llamada lleva TIPO: primera llamada · seguimiento de cadencia ·
seguimiento de cotización · compromiso pactado · recuperación de promesa.
- Las llamadas que genera el sistema **ya traen el tipo puesto**.
- En llamadas que el consultor inicia por fuera, el cuadrito de tipo aparece
  ANTES de marcar; si lo deja vacío, el sistema pregunta al colgar.
- **El resultado es específico del tipo**: una llamada de cotización termina
  en «la firma / pidió cambios / la rechazó / no contestó», no en el
  genérico contestó/no contestó.

## Relojes de estancamiento (umbrales aprobados 2026-09-01)

Regla madre: **a los 30 días, todo lead tiene estatus de ciclo de vida claro,
sin excepción**. El replanificador audita diario.

| Reloj | Umbral | Qué genera |
|---|---|---|
| Cotización sin decisión | **3 · 7 · 14 días** | día 3 feedback (¿la vio?), día 7 llamada con ángulo, día 14 decisión forzada: extender con razón o marcar rechazada |
| Cotización vista 3+ veces en la semana sin responder | al detectarse | llamada con ese ángulo (además del P1 de «la está viendo ahora») |
| Demo hecha sin cotización | **2 días** | tarea «cotízale o di por qué no» |
| Conversación viva sin cita | **3 días** | tarea «ciérralo a cita» con horarios del agendador listos |
| «Pidió tiempo» vencido | el día pactado | vuelve solo al plan |
| Ganado sin suscripción | al marcarse | BLOQUEANTE: dinero fantasma en el ARR |
| Día 30 sin definición | 30 días | **la IA propone el veredicto con el historial leído** («propongo descartar: 9 toques, 0 respuestas») y el humano decide en un clic |

## Próximos envíos (pedido 2026-09-01)

Pestaña del panel que muestra **lo que va a salir en la próxima hora** —
cadencia, secuencias y coberturas del copiloto — cada renglón con: hora, lead,
el mensaje que saldrá, el último mensaje del lead y su actividad reciente.
Desde ahí se puede **editar el mensaje, detener el envío o pedirle el cambio
al asistente en lenguaje natural** («pausa la cadencia de Dannae hasta el
lunes»). También muestra las coberturas por vencer («si no contestas antes de
las 11:05, la cubro yo») con la opción de tomarla antes.

## Autoaprendizaje de 24 h (esquema pedido 2026-09-01)

**Dónde viven los datos**: no hay que subir nada a ningún lado — las
conversaciones SON el dataset y ya caen todas en el Supabase del CRM
(`wa_conversaciones`/`wa_mensajes`, la nueva tabla de llamadas con
transcripción, `ti_*`). El ciclo nocturno lee de ahí.

**El ciclo (cada 24 h)**:
1. RECOLECTA las últimas 24 h: conversaciones donde respondió el HUMANO (esas
   son las lecciones: lo que la IA no supo o no tenía permitido), respuestas
   de la IA + qué pasó después (respondió, se enfrió, el humano corrigió),
   omisiones, transcripciones de llamadas.
2. DESTILA: pares pregunta→respuesta-que-funcionó, objeción→manejo, y huecos
   de la wiki («preguntaron X 3 veces y la wiki no lo cubre»).
3. PROPONE: jugadas nuevas al playbook (`ia_jugadas`), parches a la wiki
   comercial, ajustes de cadencia — todo como propuesta con evidencia.
4. APRUEBA el dueño en el panel de aprendizajes; lo aprobado entra al prompt
   del copiloto desde el día siguiente. (Graduable a auto, como los campos.)
5. MIDE: cada jugada guarda uso y resultado; la que no funciona se retira.

**Log total**: `ia_log` — cada comportamiento de la IA (mensaje enviado,
sugerencia, cobertura, decisión de triage) con su razón, su fuente y su costo
(el tracking de costos ya existe en `lib/ai/client.ts`).

## Huecos cerrados (4ª ronda, 2026-09-01)

Reglas propuestas y no vetadas:
- **Cadencia por EMPRESA, no por contacto**: dos motores jamás tocan a la
  misma empresa en paralelo; duplicados se unen y SUMAN toques.
- **La IA se equivoca**: botón «silenciar IA con este lead» en toda tarjeta;
  la corrección del humano a la IA es la lección de MÁXIMA prioridad del
  ciclo de 24 h; kill-switch global del dueño.
- **P1 nocturno irresoluble** (queja, descuento): la IA responde «te contesto
  mañana a primera hora» y deja la tarea al tope — nunca negocia por cubrir.
- **Fallback de todo lo automático**: sin transcripción → resultado a mano;
  nada se cae en silencio.
- **Meta**: las plantillas T3/T6/T8 deben aprobarse ANTES del arranque
  (checklist F0 — tarda días).
- **Presión WA**: el copiloto respeta `puedeMandarWa` — tope por lead por día
  aunque tres motores quieran escribirle.
- **Anti-trampa**: Twilio es el árbitro; tareas «hechas» en <5 s se marcan
  como inconsistencia en el log de faltas.
- Idioma: la IA responde en el idioma del lead. Tablero del dueño: F6.

Decisiones del dueño:
1. **Reparto de leads**: todos al dueño por ahora; el round-robin con tope de
   carga queda diseñado para activarse cuando crezca el equipo, sin rediseño.
2. **Llamada entrante a Twilio**: suena al owner en el navegador (celular de
   respaldo); si nadie toma → buzón → transcripción → P1 «te llamó,
   devuélvela». (La IA de voz puede sumarse encima después.)
3. **Arranque con backlog**: la IA audita TODO el backlog y propone por lotes
   (revivir con ángulo / a nutrición / descartar); el dueño aprueba por lote
   y el día 1 arranca limpio.
4. **Métrica norte DOBLE**: el autoaprendizaje optimiza CITAS AGENDADAS día a
   día, y cada mes la CONVERSIÓN real corrige qué citas valen (calidad, no
   solo cantidad).

## Jerarquía de la tarjeta y taxonomía de tareas (5ª ronda, 2026-09-01)

**La tarjeta se organiza alrededor de LA DECISIÓN, no del contacto.** Jerarquía
fija en TODO layout: (1) la decisión en una línea → (2) los 2-3 HECHOS que la
deciden, grandes (fila `hechos`, tabular-nums, tono semántico) → (3) la acción
→ (4) el resto del expediente PLEGADO en «Historial y contexto» (details).

**7 familias de decisión = 7 layouts** (el tipo solo cambia contenido):
- **A CONTACTAR** «¿logro contacto ahora?» — hero: ventana, intentos, canal.
  Tipos: 1ª llamada, cadencia 2º/3º, compromiso, plantilla 1-clic, correo,
  ⁺reintento canal nuevo, ⁺video-mensaje alto valor, ⁺toque a nutrición con
  señal, ⁺reciclado con ángulo IA.
- **B RESPONDER** «¿qué contesto?» — hero: mensaje entrante + intención.
  Tipos: P1, estafeta IA, ⁺objeción detectada con manejo del playbook.
- **C AVANZAR** «¿qué acerca el cierre?» — hero: señales + dinero.
  Tipos: seguimiento cotización, ⁺cotizar (2d post-demo), ⁺cerrar a cita,
  ⁺cerrar venta (link de pago), ⁺post-demo mismo día, ⁺confirmar asistencia,
  ⁺pedir referido.
- **D DECIDIR** «¿sí o no?» — hero: propuesta de la IA + evidencia.
  Tipos: ⁺veredicto día 30, ⁺decisión forzada cotización d14, ⁺aprobar lote
  (backlog/aprendizajes), ⁺validar cita IA con choque de agenda.
- **E PREPARAR** «¿estoy listo?» — layout documento: quién es / qué le duele /
  qué enseñarle / cómo abrir. Tipos: ⁺briefing pre-demo 30 min antes,
  ⁺propuesta multi-sucursal.
- **F REPARAR** «¿cómo recupero la confianza?» — hero: qué se rompió y hace
  cuánto. Tipos: promesa rota, ⁺no-show, ⁺pago prometido que no llegó,
  ⁺corrección de error de la IA, ⁺encuesta de despedida.
- **G HIGIENE** «¿es cierto este dato?» — micro-layout de lote. Tipos: dato
  faltante/sugerido, ⁺etapa contradicha por los hechos.

32 tipos (22 nuevos ⁺). La maqueta v4 demuestra un layout por familia con
leads reales (incluye briefing de Edith y veredicto día 30 de Alisson Cruz).

## 20 ángulos operativos (6ª ronda, aprobada 2026-09-01)

Operación: (1) una tarea a la vez + **fila de solo lectura** (ver sin poder
brincar; el orden lo defiende el sistema) · (2) **DND automático** con llamada
Twilio activa o cita en curso — los avisos se acumulan y al colgar se ve el
resumen; el SLA de la IA sigue corriendo · (3) móvil = **paridad total**
(estándar m-*) · (4) **push de P1 solo en horario laboral**; fuera de horario
la IA cubre y nadie suena.

Experiencia del lead: (5) máximo por día: **llamada + 1 mensaje** (nunca 2
mensajes fríos el mismo día; si responde ya es conversación) · (6) **la IA
aprende la mejor hora por lead** (contestó a las 4pm → sus toques van a esa
hora) · (7) canal preferido declarado = **candado duro** (la IA lo detecta y
lo registra) · (8) feriados: **toggle configurable, default IGNORAR** (el
comercio en MX trabaja feriados).

IA: (9) tono **tú cercano mexicano** (el lenguaje del ramo) · (10) la IA
**agenda directo** sobre disponibilidad real del calendario, con briefing
automático · (11) **voz saliente: NO por ahora** (revisar en 6 meses) ·
(12) gasto IA **sin tope, con alerta** (~$200 USD/mes) sobre el tracking
existente.

Equipo: (13) cada consultor ve **solo su cola**; el dueño todas
(partner-scope existente) · (14) **calificación EN VIVO siempre visible** en
su panel — nadie se sorprende a fin de mes · (15) **sobrio, sin
gamificación** (estándar enterprise) · (16) **digest diario 6:30 pm por
WhatsApp al dueño**: hechas/diferidas, respuestas, citas, coberturas IA,
faltas, y qué propone aprender.

Negocio: (17) **score de valor automático** → cadencia premium (owner
directo, video-mensaje, SLA corto) · (18) leads de partners: **cadencia
suave** que abre con el nombre del partner — menos toques, directo a cita ·
(19) **la IA investiga al lead al entrar** (IG/Maps/web: tamaño, giro real,
reseñas) — alimenta primer toque, briefing y campos · (20) **fin de semana:
la IA cubre completo** — conversa, responde y agenda citas para el lunes;
el lunes abre con estafetas ordenadas.

## Fases

- **F0** — Modelo de datos + motor de cadencia + generador del plan +
  transformaciones de vencimiento (verificable por API, sin UI). Coordina
  con secuencias (pausa mutua).
- **F1** — Panel una-tarea-a-la-vez, web y móvil, con WA integrado (plantilla
  1-clic, redactar, correo con borrador IA) + tarjeta del reacomodo.
- **F2** — Observador en vivo: webhooks WA/Twilio/cotización-vista reordenan;
  válvula de plantillas 24 h+; consolidación de señales; relojes de
  estancamiento + auditoría de los 30 días.
- **F3** — Omitir con motivos + `ti_omisiones` + log de faltas + DEUDAS DE
  DATO (registro de campos, inline, lotes en valles) + panel de reglas
  aprendidas.
- **F4** — Twilio: click-to-call, llamada con propósito (tipo + resultado
  específico), locución de grabación, transcripción SIEMPRE, extracción IA →
  pestaña «Datos» con graduación por aciertos.
- **F5** — **Wiki comercial + copiloto IA**: base de conocimiento desde la
  web y sacs3/sacs4; cobertura por tardanza y ausencia; la estafeta; pestaña
  «Próximos envíos» con control en lenguaje natural; `ia_log`.
- **F6** — Autoaprendizaje de 24 h (playbook `ia_jugadas` + panel de
  aprendizajes) + analista: calificación mensual del consultor + propuesta
  de mejora; nutrición de largo plazo + handoff al descalificar.
- **F7** — CLIENTES: mismas piezas + señales de uso/ARR/churn (renovaciones,
  cuentas por caer, upsell). Se diseña cuando leads esté rodando.

## Qué NO es este módulo

- No reemplaza el inbox: responder conversaciones vivas largas se hace en el
  inbox; la tarea P1 te lleva ahí con un clic.
- No reemplaza las secuencias: ellas siguen siendo el canal automático.
- No es un dashboard de métricas: es una fila de ejecución. (Las métricas del
  módulo —tasa de contacto, toques hasta respuesta, omisiones— vendrán después.)
