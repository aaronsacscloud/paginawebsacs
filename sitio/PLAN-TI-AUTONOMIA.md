# Trabajo Inteligente · de asistente de cadencia a CRM autónomo

> Propuesta integral (2026-09-01), aprobada el mismo día (§12). A0 construido. Parte de lo que YA está en producción
> (ver `ESTADO-TRABAJO-INTELIGENTE.md`) y de los datos vivos del CRM. Nada de
> aquí está construido todavía: es el plan para decidir juntos. El spec
> anterior sigue siendo válido (`PLAN-TRABAJO-INTELIGENTE.md`); esto lo
> extiende, no lo sustituye.

## 1. Veredicto en cinco líneas

1. **Hoy el sistema es un asistente de cadencia humana con IA de respaldo.** El
   humano ejecuta 9 toques; la IA solo cubre huecos (SLA vencido, fuera de
   horario) y hoy está apagada. De las tres capas de aprendizaje diseñadas,
   funciona una (el playbook conversacional); las otras dos imprimen a consola
   y se pierden. `ti_reglas` existe en el esquema y ningún código la lee ni
   la escribe.
2. **Propuesta: invertir el default.** La IA ejecuta TODO lo de texto (WA,
   correo, respuestas, agenda) desde el minuto cero y dentro de límites; el
   humano hace lo que solo un humano hace —la llamada con propósito, la demo,
   el descuento, la queja— y aprueba lo que el sistema aprende. La cadencia
   deja de ser el guion del humano y pasa a ser la **garantía** de que ningún
   lead muere en silencio.
3. **Tres piezas faltan para que sea autónomo de verdad:** una bitácora de
   eventos + perfil vivo por lead (lo que el sistema «recuerda»), reglas como
   datos versionados con un panel donde se ven y se editan por acción, y una
   rampa de autonomía por acción que sube y baja con evidencia.
4. **La reevaluación se vuelve por evento y por puntaje**, no por prioridad
   fija al nacer: cada señal recalcula las tareas de ESE lead; cada 15 min el
   día; cada noche el proceso.
5. **Honestidad sobre el volumen:** hoy hay 56 leads vivos y 18 cadencias. El
   aprendizaje estadístico (qué canal funciona por segmento) tarda meses en
   tener muestra; el cualitativo (qué contestar, qué objeción cómo) funciona
   desde la primera semana. El plan grada la evidencia y no promete lo que la
   muestra no da.

## 2. Diagnóstico: qué hace hoy y qué no

| Capa | Hoy hace | Hoy NO hace |
|---|---|---|
| Inmediato por lead (`alOmitir`) | «ya lo contacté» avanza; «mal momento» pausa 3 días fijos | no aprende fecha declarada («en enero»), no aprende canal preferido salvo `numero_malo` |
| Memoria por lead | `mejor_hora` solo cuando CONTESTA una llamada | nada de las respuestas por WA/correo (hora, canal, idioma, objeciones, intención) |
| Ciclo 24 h (`ti-aprender.mjs`) | pares lead→humano → jugadas propuestas; el dueño aprueba | no mide jugadas (`usos`=0 siempre, `resultados` nunca se escribe); huecos de wiki y patrones se IMPRIMEN y se pierden; no toca cadencia ni reglas; corre a mano, en local |
| Reglas | `ti_config` (horario, SLA, topes) editable sin deploy | cadencia, textos, relojes, límites del copiloto: hardcodeados en `reglas.ts`/`motor.ts` = deploy para cambiar |
| Reevaluación | evento → retira cadencia + inserta P1 (cada 2 min); tick 15 min → desliza, relojes, deudas | la prioridad es un entero fijo al nacer; no hay score por valor × probabilidad × urgencia (decisión 3 del spec, no construida) |
| Autonomía | válvula (sin Meta = inactiva), copiloto tras SLA (apagado), T0 (fuera de TI) | en la práctica hoy: cero acciones autónomas |

**Señales que consume hoy:** WA entrante · vista de cotización · edad de
cotización (3/7/14) · `demo_hecha` 2 d · conversación 3 d · lead 30 d ·
reunión pasada sin resultado · resultado de llamada · tarea vencida · P1 sin
atender en SLA.

**Señales ciegas hoy:** correo respondido/abierto (decisión 6, no hecha) ·
llamada entrante/perdida (Twilio) · cita creada/movida/cancelada/no-show ·
WA leído sin responder · intención del mensaje (`wa-intencion.ts` existe y TI
no lo usa) · fuente/anuncio/giro · score de valor · origen partner · hora a la
que el lead responde por texto · objeción/sentimiento · lo que el consultor
EDITA en el mensaje sugerido (una lección gratis) · segundo ingreso del mismo
lead · visita a /planes.

Datos vivos (2026-09-01): 18 cadencias (10 activas, 8 en conversación), 99
tareas pendientes (94 de datos), 0 omisiones, 1 falta, 6 jugadas aprobadas
con 0 usos, `ti_reglas` vacía, 3 leads `nuevo` y 21 `sin_respuesta`.

## 3. La decisión estratégica: quién ejecuta la cadencia

Tu intuición es correcta y los datos la sostienen: la hora del humano es el
recurso escaso, y las llamadas a ciegas 2ª/3ª/4ª son el trabajo de menor
rendimiento del proceso. Tres modelos posibles:

| Modelo | Humano | IA | Riesgo |
|---|---|---|---|
| A. Hoy: cadencia humana + IA de respaldo | 9 toques, conversación, demo | cubre huecos | el plan se llena de toques fríos; el consultor no llega a lo que cierra |
| B. IA ejecuta todo, humano solo demo | demo | cadencia, conversación, cita | la primera llamada rápida (la de mayor tasa de contacto) se pierde; el lead caliente no oye una voz |
| **C. Recomendado: SDR-IA + closer humano** | T1 <30 min, llamadas CON señal, demo, límites (descuento/queja/contrato), aprobar aprendizajes | todo lo de texto desde el minuto 0, agenda, nutrición, datos, briefing | requiere rampa con candados y kill-switch; empieza en «auto con veto» |

**Reglas del modelo C:**
- La cadencia T1–T8 se conserva como **política por defecto y garantía** (9
  toques / 3 semanas / máx. llamada + 1 mensaje por día), pero cada toque se
  decide el día que toca: la política elige canal, ángulo y hora según el
  perfil del lead. La secuencia fija es la «versión 0» de la política.
- **Llamadas humanas solo con propósito**: T1 (speed-to-lead), llamada con
  señal (abrió cotización, respondió y no aterriza, pidió que le marquen),
  compromiso pactado, recuperación. Las llamadas a ciegas 3ª/4ª se sustituyen
  por texto de la IA salvo que el lead tenga señal o valor alto — y esto se
  mide: si la tasa de contacto de la 3ª llamada a ciegas resulta alta, la
  política la devuelve.
- **La IA conversa desde el primer mensaje** dentro de límites (hoy espera a
  que venza el SLA de 15 min: eso deja al lead en visto 15 min por diseño).
  El humano ve la conversación completa y puede tomarla en cualquier momento;
  la tarea deja de ser «responder» y pasa a «llámale: ya está respondiendo».
- **El objetivo del humano es la cita y la demo.** Su cola trae: llamadas con
  propósito, demos, estafetas donde la IA no pudo, decisiones y lo que aprende
  el sistema. Nada más.
- Voz saliente por IA: sigue en NO (revisar en 6 meses).

## 4. Arquitectura: cinco capas

```
SEÑALES  → ti_eventos (bitácora canónica, append-only)
MEMORIA  → ti_perfil (por lead) · ti_metricas (por segmento) · ti_reglas (proceso, versionado)
           · ti_acciones (rampa) · wiki + adendas + jugadas (conocimiento) · ti_decisiones (memoria del dueño)
POLÍTICA → reglas duras deciden QUÉ puede existir; el score decide CUÁL y CUÁNDO; la IA redacta
EJECUCIÓN→ rampa por acción: N0 humano · N1 un clic · N2 auto con veto · N3 auto
APRENDIZAJE → 6 aprendices nocturnos → propuestas con evidencia → aprobación → medición → retiro
```

### 4.1 Bitácora de eventos (`ti_eventos`)
Una fila por señal, normalizada: `{contact_id, company_id, tipo, canal,
actor (lead|humano|ia|sistema|valvula|secuencia), payload, ocurrio_at,
fuente_tabla, fuente_id}`. Se alimenta con **adaptadores** desde las tablas
donde los eventos ya caen (`wa_mensajes`, `quotes`, `bookings`, `ti_tareas`,
`ia_log`, correo, Twilio) — el observador actual se convierte en el primer
adaptador. Backfill de 90 días al arrancar. Es lo que permite aprender,
auditar y **re-simular** («si esta regla hubiera estado activa el mes pasado,
¿qué habría cambiado?»).

### 4.2 Perfil vivo (`ti_perfil`) — lo que el sistema recuerda de cada lead
`mejor_hora` (de cualquier respuesta, por canal) · `canal_que_responde`
(conteos wa/correo/llamada) · `canal_preferido` declarado (candado) ·
`idioma` · `objeciones` vistas · `intenciones` detectadas · `promesas` ·
`etapa_interes` (curioso / evaluando / decidiendo) · `score_valor` (1–5) ·
`score_probabilidad` · `partner` · `investigacion` (IG/Maps/web) ·
`resumen_ia` (3 líneas, se reescribe tras cada evento relevante) ·
`siguiente_mejor_paso` + razón · `silenciar_ia` · `do_not_contact_hasta`.
Lo determinista lo escribe el actualizador al vuelo; lo textual (objeciones,
intención, promesas) lo extrae la IA con confianza y entra por el registro de
campos (allow-list, graduable a directo).

### 4.3 Política: existencia por reglas, orden por puntaje
- **Reglas de existencia** (duras, versionadas): horario, máx. por día,
  canal preferido, DND, do-not-contact, límites del copiloto, presión WA,
  candados de partner. Deciden qué tareas PUEDEN existir. Cambiarlas
  regenera la proyección de pendientes (nunca la historia).
- **Puntaje** (recalculado por evento y por tick):
  `score = urgencia × valor × probabilidad × (1 + atraso) ÷ costo_humano`,
  con bandas P1–P5 que el humano sigue viendo. `urgencia`: ventana que expira
  (WA 24 h, cotización abierta AHORA, compromiso ±15 min, SLA). `valor`:
  score del lead (sucursales, giro, ticket, partner). `probabilidad`: señal
  <24 h, canal que responde, mejor hora = ahora, etapa de interés.
  `costo_humano`: llamada > mensaje > clic. P1 «respondió» nunca baja de
  banda; el score solo ordena dentro y puede SUBIR una tarea de banda con
  regla explícita (p. ej. valor 5 + señal → P2).
- **Un solo punto de entrada:** `replanificar(contactId, evento)` —
  invalida las pendientes de ese lead que el evento contradice, recalcula el
  siguiente mejor paso desde el perfil, regenera. El tick de 15 min llama a
  lo mismo para los relojes; la noche, para todos.

### 4.4 Rampa de autonomía por acción (`ti_acciones`)
Cuatro niveles: **N0 humano** · **N1 un clic** (sugerido, lápiz) · **N2 auto
con veto** (aparece en «Próximos envíos» 30–60 min antes; sale solo si nadie
lo detiene) · **N3 auto** (sale y queda en bitácora). Cada acción del
catálogo tiene: nivel actual, candados, métrica de graduación, umbral, quién
lo aprobó y cuándo.

| Acción | Nivel inicial | Candado | Sube a N3 cuando |
|---|---|---|---|
| T0 acuse de entrada | N3 | plantilla Meta | — |
| Investigar lead al entrar (IG/Maps/web) | N3 | solo lectura | — |
| Responder FAQ de la wiki (precio de lista, módulos, giros) | N3 | límites del copiloto | — |
| Acuse fuera de horario / puente | N3 | — | — |
| Reagendar con liga | N3 | — | — |
| Activar prueba gratis (pide correo + tienda, activa con funciones del giro, avisa) | N2 | solo leads de moda con giro conocido | 20 activaciones sin corrección |
| Cliente activo → redirigir a soporte con calidez | N3 | detectar `lifecycle_stage = cliente` | — |
| Plantillas T3 / T6 / T8 | N3 | Meta + válvula | — |
| Marketing primero → 10 min → utility si falla | N3 | par declarado; marketing máx. 1/lead/semana; presión WA | — |
| Crear plantillas nuevas (marketing + utility) para un ángulo | N3 (crear) | máx. 3/día; una por (estado, ángulo); sin precios; se apaga con 3 rechazos | el envío sigue la rampa normal |
| Recordatorios de cita 24 h / 1 h | N3 | — | — |
| Briefing pre-demo | N3 | solo lectura | — |
| Enrolar / graduar / pasar a nutrición | N3 | evidencia en bitácora | — |
| Extraer datos de conversación → sugerencia | N3 (sugerir) · N2→N3 por campo | registro de campos | N confirmaciones sin corrección |
| Agendar demo directo sobre calendario | N2 | disponibilidad real, 1 propuesta a la vez | 30 citas sin choque ni queja |
| Correo T5 personalizado | N2 | sin precios fuera de lista | 30 envíos sin veto ni corrección |
| WA con ángulo (T6 redactado por IA) | N2 | presión WA | 30 envíos sin veto |
| Respuestas no-FAQ dentro de la wiki | N2 | límites | 50 respuestas, ≤2 correcciones |
| Feedback de cotización día 3 | N2 | — | 20 envíos sin veto |
| Post no-show / cancelación: reagendar | N2 | — | 20 sin veto |
| Follow-up post-demo con material | N2 | — | 20 sin veto |
| Mover etapa por hechos (cotizado, agendado) | N2 | evidencia obligatoria | 30 sin corrección |
| Mensaje tras respuesta compleja | N1 | — | graduable |
| Cotización rápida | N1 | — | no gradúa |
| Pedir referido | N1 | — | graduable |
| Recuperar promesa rota | N1 | — | no gradúa |
| Llamadas, demo | N0 | — | no gradúa (voz IA: no) |
| Descuentos, quejas, contratos, facturación | N0 | límite duro | no gradúa |
| Veredictos (día 30, día 14) | N0 con propuesta IA | — | graduable a N2 para «descartar sin ninguna señal» |
| Aprobar aprendizajes y cambios de regla | N0 | — | no gradúa |

Subida: la propone el ciclo nocturno con la evidencia; el dueño aprueba.
**Bajada: automática** (2 correcciones humanas en 7 días, o 1 queja del lead
atribuible → baja un nivel y avisa). Kill-switch global y «silenciar IA con
este lead» en toda tarjeta.

### 4.5 Reglas como datos: el panel «Reglas y lógica»
Lo que hoy vive en `reglas.ts` pasa a `ti_reglas` **versionado** (la tabla
ya existe): `clave, valor, version, estado, evidencia, aprobada_por,
vigente_desde, segmento`. El código lee la regla vigente con fallback a la
constante actual (que pasa a ser la versión 0). Tipos de regla: cadencia
(pasos, esperas, canal, bloque) · relojes (umbrales) · límites (máx./día,
horario, SLA, presión) · textos y plantillas (con variantes A/B) · pesos del
puntaje · rampa (niveles) · límites del copiloto · **overrides por
segmento** (fuente, giro, valor, partner).

El panel, por acción (una fila por acción del catálogo), muestra:
1. La regla en lenguaje natural + sus parámetros editables.
2. **Por qué existe** (la decisión y su ronda).
3. Métrica en vivo 30 días: veces disparada · respuesta · cita · omitida · vetada · corregida.
4. Historial de versiones (quién, cuándo, evidencia, resultado después).
5. Propuestas pendientes del ciclo nocturno para ESA regla, con aprobar / rechazar con razón.
6. **Simulador**: «si cambio esto, así se ve el plan de mañana» (corrida en
   seco de `generarPlan` sobre la proyección → diff de tareas).
7. Edición en lenguaje natural: «que el T2 sea WhatsApp para leads de
   Facebook» → el asistente propone el diff de regla; se aprueba.

**Cuándo aplica un cambio:** las reglas de existencia y los límites, en el
siguiente tick (≤15 min) y regeneran las pendientes; los pasos de cadencia,
a los pasos FUTUROS de las cadencias activas (nunca reescriben toques
hechos); los textos, al siguiente envío. Toda edición humana queda como
versión con autor.

## 5. Catálogo de señales

| Señal | Fuente | Hoy | Efecto en la reevaluación |
|---|---|---|---|
| WA entrante | wa_mensajes | sí | P1; conversación viva; retira cadencia; perfil: hora, canal, intención, idioma |
| WA leído sin responder | Kapso status | no | señal débil: siguiente toque cambia ángulo; probabilidad + |
| WA saliente humano / IA / válvula / secuencia | wa_mensajes, ia_log | parcial | cuenta toque; presión WA; atribución del resultado |
| Correo respondido | inbox correo | no | P1 (decisión 6) |
| Correo abierto / clic | tracking SendGrid | no | probabilidad +; hora preferida |
| Correo rebotado | SendGrid | no | canal muerto → cambiar canal; deuda de dato |
| Llamada saliente + resultado + duración | Twilio / manual | manual | transición de cadencia; mejor hora; transcripción → datos |
| Llamada entrante / perdida / buzón | Twilio | no | P1 «te llamó, devuélvela» |
| Cotización enviada | quotes | parcial | arranca relojes 3/7/14; mensaje de acompañamiento |
| Cotización vista (1ª, n-ésima, de noche) | quotes | sí | P1 llamada ahora; 3+/semana → llamada con ángulo; noche → IA |
| Cotización aceptada / pagada / rechazada / vencida | quotes | parcial | retiro total / despedida con pregunta / decisión forzada |
| Cita creada / movida / cancelada | bookings | parcial | recordatorios; briefing; no-show → reparar |
| Cita asistió / no asistió | bookings (deuda) | sí | post-demo; cotizar 2 d; no-show → reagendar |
| Pago / suscripción | subscriptions | parcial | ganado → onboarding; sin suscripción → bloqueante |
| Uso de la cuenta SACS | sacs_account | no (F7) | salud del cliente |
| Visita a /planes o página de giro | web / sacs_attr | no | probabilidad +; ángulo |
| Segundo ingreso del mismo lead | contacts | no | interés +; unir duplicados |
| Fuente / anuncio / partner | sacs_attr, owner | parcial | segmento para overrides y métricas |
| Investigación (IG/Maps/web) | IA | no | valor; giro real; ángulo de apertura |
| Omitir con motivo | ti_omisiones | sí | inmediato por lead; agregado por proceso |
| Posponer | ti_tareas | sí | hora preferida del consultor (no del lead) |
| Edición del mensaje sugerido | panel | no | diff = lección de texto base |
| Corrección / «no debió» a la IA | panel | no | lección de máxima prioridad; baja de rampa |
| Silenciar IA con este lead | panel | no | candado por lead |
| Ausencia declarada del consultor | panel | no | cobertura total; reoptimizar cadencias |
| DND (llamada activa / cita en curso) | Twilio / calendario | no | acumular avisos; IA cubre P1 |
| Falta del consultor | ti_faltas | parcial | calificación; digest; propuesta de mejora |
| Veto en «Próximos envíos» | panel | no | métrica de rampa; lección |
| Aprobación / rechazo de propuesta | panel | no | memoria de decisiones |

## 6. Cómo se reevalúa

- **Por evento (segundos):** el adaptador escribe en `ti_eventos` →
  `replanificar(lead, evento)` → actualiza perfil → invalida pendientes
  contradichas → recalcula siguiente mejor paso y score → regenera. La
  tarjeta en curso nunca se le quita al consultor; la siguiente ya es la
  correcta.
- **Por tick (15 min):** relojes, deslizamientos, válvula, próximos envíos
  N2 que vencieron su ventana de veto, deudas de dato, capacidad del día.
- **Por noche (una vez):** los 6 aprendices, recalibración de scores,
  propuestas, digest del dueño, auditoría de los 30 días.
- **Por mes:** conversión real corrige el valor de las citas (métrica norte
  doble); calificación del consultor; consolidación de adendas a la wiki
  (commit).

Ejemplos: lead abre cotización a las 22:10 → evento → perfil
`etapa_interes=decidiendo` → IA (N2 nocturno) «vi que la estás revisando…»
→ tarea humana P1 para 9:00 «llámale: la revisó anoche 3 veces» con score
alto por valor+señal. Consultor omite T4 con `mal_momento` y texto «está de
viaje hasta el 15» → la IA extrae la fecha → pausa hasta el 15 (no 3 días) →
al día 15 vuelve con «¿ya de regreso?».

## 7. El ciclo de aprendizaje v2

**Dónde corre:** en el servidor (`sacs-dev-01`) con un timer de systemd a las
2:00 CDMX (la llave de Anthropic ya vive aquí; Vercel no la tiene). Escribe
propuestas en Supabase; el panel las lee. Puede migrar a Vercel cuando se
ponga la llave.

**Seis aprendices**, todos con la misma salida: `propuesta {tipo, objetivo,
cambio, evidencia {n, tasa, ejemplos}, confianza}` en `ti_reglas` /
`ia_jugadas` / `wiki_adendas` / `ti_acciones`, estado `propuesta`, hasta que
el dueño aprueba (o el nivel de la acción lo permite).

| # | Aprendiz | Lee | Produce | Evidencia mínima |
|---|---|---|---|---|
| 1 | Playbook conversacional (existe, se completa) | pares lead→humano; correcciones humanas a la IA (prioridad máxima); ediciones del lápiz; vetos | jugadas nuevas; jugadas negativas («no digas esto»); retiros | cualitativa: 1 corrección ya es lección; retiro con 10 usos y 0 respuestas |
| 2 | Wiki | huecos («preguntaron X y no está»), `no_pudo` del copiloto | **adendas** (`wiki_adendas`, estado propuesta → aprobada entra al prompt SIN deploy; se consolidan al .ts cada mes) | 2 apariciones |
| 3 | Política de cadencia | `ti_eventos`: por paso × canal × segmento × hora: respuesta, cita, omisión; por plantilla: entregada / fallida / respondida (marketing vs. utility) | cambio de canal/espera/hora por segmento; variantes A/B de texto; qué categoría de plantilla usar por segmento | n ≥ 30 por celda y diferencia clara; antes, solo reporte |
| 4 | Perfil (determinista, sin LLM) | respuestas del lead por hora y canal | mejor hora y canal por lead y por segmento | 2 respuestas coincidentes |
| 5 | Proceso | omisiones, faltas, posposiciones, vetos | reglas nuevas («no_aplica >50 % en tipo X»), cambios de rampa (subidas propuestas, bajadas automáticas) | 10 casos o 2 correcciones/7 d |
| 6 | Valor y conversión (mensual) | citas → demos → cotizaciones → pagos por fuente/giro/partner/consultor | recalibra `score_valor` y qué citas «valen»; calificación del consultor + propuesta de mejora | mes cerrado |

**Memoria de decisiones (`ti_decisiones`):** cada aprobación y cada rechazo
con su razón. El analista la lee antes de proponer: lo rechazado no se vuelve
a proponer sin evidencia NUEVA; lo aprobado se mide y, si no funcionó, se
propone revertir.

**Medición de jugadas:** cada uso de una jugada por el copiloto se registra
(`usos`), y a las 24 h se anota qué pasó (`resultados`: respondió / se enfrió
/ el humano corrigió / cita). Hoy no se escribe nada de esto.

**Cómo retroalimenta el humano (los 6 gestos, todos desde la tarjeta):**
1. Omitir con motivo (existe).
2. El lápiz: la edición se guarda como diff (nuevo).
3. En cada mensaje de la IA: **Bien · Corregir · No debió** (nuevo).
4. **Silenciar IA con este lead** (nuevo).
5. En Reglas y lógica: comentario en lenguaje natural → propuesta (nuevo).
6. Aprobar / rechazar propuestas con razón (nuevo; hoy es un script).

## 8. Catálogo de casos

Leyenda: **H** humano · **1C** un clic · **AV** auto con veto · **A** auto.
Estado: `hoy` construido · `parcial` · `nuevo`.

### Entrada del lead
| # | Situación | Acción | Quién | Regla | Estado |
|---|---|---|---|---|---|
| E1 | Entra en horario laboral | T0 acuse; la IA investiga (IG/Maps/web); tarea llamada T1 | A · A · H | <30 min | T0 hoy; investigación nuevo |
| E2 | Entra fuera de horario | IA conversa si responde; T1 a primera hora hábil | A · H | horario | parcial (copiloto apagado) |
| E3 | Entra en fin de semana | IA cubre completo y agenda para el lunes | A | decisión 20 | nuevo |
| E4 | Lead de partner | cadencia suave: abre con el nombre del partner, menos toques, directo a cita | A/H | override partner | nuevo |
| E5 | Alto valor (≥3 sucursales, moda, ticket alto) | cadencia premium: owner directo, video-mensaje, SLA corto | política | score_valor ≥4 | nuevo |
| E6 | Duplicado (tel/correo/empresa) | unir, sumar toques, una cadencia por empresa | A | cadencia por empresa | nuevo |
| E7 | Sin teléfono | cadencia solo texto; la IA pide el número en el primer intercambio | A | canal | parcial |
| E8 | Sin ningún canal válido | tarea única «buscar otro canal»; la IA busca en IG/Maps | H+IA | — | nuevo |
| E9 | Responde al T0 antes de la llamada | IA responde al instante; T1 pasa a P1 «llámale: está respondiendo» | A · H | SLA 0 | parcial |
| E10 | Pregunta precio en el primer mensaje | precio de lista + demo (jugada) | A | wiki | hoy (si on) |
| E11 | Reingresa por otro anuncio | interés +; T1 con ese ángulo; no duplicar | A | score | nuevo |
| E12 | Giro que no atendemos (servicio puro) | la IA lo dice con honestidad; nutrición ligera | AV | wiki FAQ | nuevo |
| E13 | Lead en otro idioma | toda la conversación en su idioma | A | límites | nuevo |

### Contacto frío (la cadencia como política)
| # | Situación | Acción | Quién | Regla | Estado |
|---|---|---|---|---|---|
| C1 | T1 no contestó | T2 en otro bloque; WA «te busqué» el MISMO día (llamada + 1 mensaje) | A | máx/día | cambiar (hoy T3 al día siguiente) |
| C2 | Buzón | guion de voz (H) + WA corto (A) | H · A | — | nuevo |
| C3 | Número malo | salta llamadas; deuda de dato; la IA pide el número por WA | A | canal | parcial |
| C4 | Ocupado | reintento en 2 h, no cuenta como intento | A | — | nuevo |
| C5 | Contestó y hubo charla | conversación viva; transcripción alimenta perfil | H | — | hoy |
| C6 | «Márcame el jueves 4 pm» | compromiso P3 a esa hora + recordatorio | H | ±15 min | hoy |
| C7 | «Mándame info» y se apaga | mini-rama de 3 toques con material específico | AV | — | nuevo |
| C8 | Leyó el WA y no respondió | señal débil: el siguiente toque cambia de ángulo | A | perfil | nuevo |
| C9 | Respondió por correo | P1 | H/A | decisión 6 | nuevo |
| C10 | Respondió de noche | IA responde; estafeta en la mañana | A | horario | hoy (si on) |
| C11 | Respondió «ok» / emoji sin intención | la IA hace UNA pregunta de descubrimiento | A | intención | nuevo |
| C12 | 3 toques sin ninguna señal (ni leído) | verificar canal (¿tiene WA?, ¿rebota?) y cambiar | A | — | nuevo |
| C13 | Plantilla vencida 24 h | válvula: sale sola | A | Meta | hoy (falta Meta) |
| C14 | Toca correo T5 | la IA redacta con giro + investigación; sale tras ventana de veto | AV | N2 | nuevo (hoy editar) |
| C15 | Toca T6 ángulo nuevo | la IA elige el ángulo por giro / objeción vista | AV | N2 | nuevo (texto fijo) |
| C16 | Toca T8 cierre | sale solo; si contesta «sigue vivo» → reciclar a T1 con nota | A | — | hoy 1C → A |
| C17 | Fin de cadencia sin señal | descalificado → nutrición 1–2/mes | A | — | parcial (handoff) |
| C18 | En nutrición muestra señal (abre, visita /planes) | sale de nutrición; toque humano con esa señal | A→H | — | nuevo |
| C19 | «Ya no me escribas» | do-not-contact permanente en TODOS los motores | A | duro | parcial |
| C20 | «Ahora no, en enero» | pausa hasta la fecha; la IA confirma; vuelve solo | A | perfil | parcial (3 d fijos) |
| C21 | «Solo por WhatsApp / correo» | canal preferido = candado duro | A | duro | parcial |
| C22 | Cadencia estirada >35 d | salto a T8 | A | config | hoy |
| C23 | Respondió dos veces a las 20:30 | los toques de texto van a esa hora; llamadas en horario | A | perfil | parcial |
| C24 | Feriado | default ignorar; toggle | config | — | hoy |
| C25 | Segmento con tasa de respuesta baja en un paso (n≥30) | cambio de canal propuesto para ese segmento | propone | aprendiz 3 | nuevo |
| C26 | Toque fuera de la ventana de 24 h | **Primero la plantilla MARKETING** (permite imagen, botones, más diseño); si a los **10 min** no está entregada o Meta la rechazó (131049/130472, `status=failed`), sale la **UTILITY** equivalente. Se mide entrega y respuesta de cada una por plantilla y por segmento | A | par marketing→utility declarado; marketing con tope (máx. 1 por lead por semana y presión WA); espera 10 min | nuevo (decisión 2026-09-02) |
| C27 | Hace falta un ángulo y ninguna plantilla aprobada lo cubre | **El agente crea la plantilla solo** (`crearPlantillaMeta`): redacta el par marketing + utility, nombre `ti_<estado>_<angulo>_vN`, espera aprobación (utility: minutos), la usa; si Meta rechaza, lee `rejected_reason` y hace v2 (máx. 2); mide por plantilla y retira las de baja calidad | A (crear) · rampa normal (enviar) | máx. 3 nuevas/día, una por (estado, ángulo), sin precios ni promos, se apaga sola con 3 rechazos seguidos | nuevo (decisión 2026-09-02) |

### Conversación viva
| # | Situación | Acción | Quién | Regla | Estado |
|---|---|---|---|---|---|
| V1 | Pregunta de producto / precio / giro | la IA responde al instante | A | límites | cambiar (hoy espera SLA) |
| V2 | Pide descuento | la IA no negocia: puente + P1 con la jugada de manejo | H | duro | hoy |
| V3 | Queja / cancelación / facturación | acuse empático de la IA; humano | H | duro | hoy |
| V4 | Pide demo | la IA agenda sobre calendario real + briefing | AV→A | N2 | nuevo |
| V5 | Pide reagendar | liga de reagendar | A | jugada | hoy |
| V6 | Pregunta fuera de la wiki | «lo confirmo»; hueco de wiki; P1 humano | A+H | — | parcial |
| V7 | Manda audio | transcribir (Groq) y responder | A | — | nuevo |
| V8 | Manda imagen / documento | humano, con acuse de la IA | H | — | nuevo |
| V9 | 3 días de charla sin cita | primero la IA propone horarios; si no, «ciérralo a cita» humano | A→H | reloj 3 d | parcial |
| V10 | «Lo platico con mi socio» | pausa suave 3 d + material para el socio + follow-up | AV | — | nuevo |
| V11 | «Ya tengo sistema» | jugada de comparación por sistema (Aspel, Bind, Excel…) | A | playbook por objeción | nuevo |
| V12 | «Está caro» | reencuadre por sucursal/valor; si insiste, humano | A→H | límites | nuevo |
| V13 | Pregunta 3 veces lo mismo | confusión: llamada humana | H | — | nuevo |
| V14 | El humano corrige un mensaje de la IA | lección de máxima prioridad; opción de silenciar | H | aprendiz 1 | nuevo |
| V15 | Consultor en llamada / cita (DND) | la IA cubre P1; resumen al colgar | A | — | nuevo |
| V16 | Ausencia declarada | la IA atiende completo; estafetas al regreso | A | — | nuevo |
| V17 | La IA no puede y es de noche | puente «mañana a primera hora» + tarea al tope | A | — | hoy |
| V18 | Dos P1 a la vez | gana la ventana WA que expira antes | política | — | parcial |
| V19 | Escribe por dos canales | una conversación y una tarea consolidadas | A | — | nuevo |
| V20 | Pregunta si habla con un bot | honesta: equipo asistido por IA | A | límites | hoy |
| V21 | Lead pide llamada «ahorita» | P1 llamada; la IA confirma «te marca X en N min» solo si el humano está disponible | H | DND | nuevo |
| V22 | Lead manda ubicación / dirección | perfil: ciudad, sucursal; sin respuesta especial | A | campos | nuevo |

### Cotización
| # | Situación | Acción | Quién | Regla | Estado |
|---|---|---|---|---|---|
| Q1 | Se envía | «te llegó, ¿la vemos juntos?» + relojes 3/7/14 | A | — | parcial |
| Q2 | La abre por primera vez | P1 llamada ahora | H | — | hoy |
| Q3 | La abre 3+ veces en la semana | llamada con ese ángulo | H | — | verificar |
| Q4 | Día 3 sin decisión | la IA pide feedback | AV | reloj | hoy 1C |
| Q5 | Día 7 | llamada con ángulo | H | reloj | hoy |
| Q6 | Día 14 | veredicto extender / rechazar / seguir, con propuesta IA | H | reloj | hoy |
| Q7 | Pidió cambios | nueva versión en <24 h; si no, deuda comercial | H | — | nuevo |
| Q8 | La rechazó | pregunta de despedida; objeción al perfil; nutrición | A | jugada | parcial |
| Q9 | Aceptó / pagó | retiro total; onboarding; RFC bloqueante | A/H | — | parcial |
| Q10 | Vence su vigencia | decisión forzada | H | — | hoy |
| Q11 | La ve de noche | «vi que la revisas, ¿duda? mañana te llama X» | AV | N2 | nuevo |
| Q12 | Multi-sucursal (≥3) | propuesta preparada por la IA (layout E) | AV | — | nuevo |

### Cita y demo
| # | Situación | Acción | Quién | Regla | Estado |
|---|---|---|---|---|---|
| D1 | Cita agendada | confirmación + recordatorios 24 h / 1 h + briefing 30 min antes | A | — | parcial |
| D2 | No confirma el recordatorio | la IA pregunta «¿seguimos?»; si calla, humano llama 2 h antes | A→H | — | nuevo |
| D3 | No-show | la IA reagenda con liga en 10 min; si no, humano al día siguiente | A→H | — | nuevo |
| D4 | Cancela | la IA ofrece 2 horarios; si no toma, pausa 5 d con ángulo | A | — | nuevo |
| D5 | Demo hecha | resultado obligatorio 24 h + mensaje post-demo el mismo día | H (1C) | deuda | parcial |
| D6 | Demo hecha sin cotización 2 d | «cotízale» | H | reloj | hoy |
| D7 | Demo hecha, «lo pienso» | follow-up día 2 con material de lo que vio | AV | — | nuevo |
| D8 | Demo sin el decisor | «agenda con el socio» | H | — | nuevo |
| D9 | Choque de agenda en cita creada por IA | validar cita (layout D) | H | — | nuevo |

### Cliente nuevo y reparación
| # | Situación | Acción | Quién | Regla | Estado |
|---|---|---|---|---|---|
| W1 | Ganado | RFC / razón social bloqueante; cuenta SACS; handoff onboarding | H/A | — | parcial |
| W2 | Ganado sin suscripción en ARR | bloqueante «dinero fantasma» | H | — | spec |
| W3 | Pago prometido no llegó | reparar | H | — | nuevo |
| W4 | 30 días de uso feliz | pedir referido | 1C | — | nuevo |
| R1 | Promesa rota | P1 con disculpa + falta | H | — | hoy |
| R2 | P1 fuera de SLA | la IA cubre + falta + estafeta | A | SLA | hoy (off) |
| R3 | Error de la IA detectado | corrección + disculpa si aplica + silenciar | H | — | nuevo |
| R4 | Lead molesto por insistencia | do-not-contact 30 d; baja la presión del segmento | A | — | nuevo |
| R5 | Mensaje duplicado (dos motores) | inconsistencia; candado `puedeMandarWa` | A | — | parcial |
| R6 | Tarea «hecha» en <5 s | inconsistencia en el log | A | — | spec |

### Datos, operación y aprendizaje
| # | Situación | Acción | Quién | Regla | Estado |
|---|---|---|---|---|---|
| G1 | Reunión de ayer sin resultado | dato comercial 24 h | H | — | hoy |
| G2 | Giro / sucursales faltantes | la IA lo extrae de conversación o investigación → sugerencia | A→1C | campos | parcial |
| G3 | RFC de cliente activo | lote de higiene | 1C | — | hoy |
| G4 | Etapa contradicha por hechos | corregir con evidencia; graduable a directo | A | campos | nuevo |
| G5 | N confirmaciones sin corrección | propuesta de escritura directa | propone | graduación | nuevo |
| G6 | Transcripción de llamada | extracción con confianza («min 3:40») | A | Twilio | pendiente |
| G7 | Declara canal / hora preferida | perfil directo | A | campos | nuevo |
| O1 | Plan >80 % de capacidad | triage por valor; lo diferido visible | política | — | nuevo |
| O2 | Día flojo | banca (reciclados, datos, correos); si se acaba, se dice | política | — | nuevo |
| O3 | Día no trabajado | reacomodo explicado en la 1ª tarjeta | A | — | parcial |
| O4 | 3 faltas en la semana | digest al dueño + propuesta de mejora | A | — | nuevo |
| O5 | 18:30 diario | digest al dueño por WA | A | — | nuevo |
| O6 | Gasto IA > alerta | aviso; nunca corta cobertura | A | config | parcial |
| O7 | Equipo crece | round-robin con tope de carga | política | — | diseñado |
| O8 | Partner | ve solo lo suyo; reglas con override | scope | — | parcial |
| L1 | Jugada con 10 usos y 0 respuestas | propuesta de retiro | propone | aprendiz 1 | nuevo |
| L2 | Hueco de wiki repetido | adenda propuesta → al prompt sin deploy | propone | aprendiz 2 | nuevo |
| L3 | Paso × canal peor en un segmento (n≥30) | cambio de política propuesto | propone | aprendiz 3 | nuevo |
| L4 | `no_aplica` >50 % en un tipo | regla propuesta | propone | aprendiz 5 | parcial |
| L5 | El consultor siempre edita igual un texto | nuevo texto base propuesto | propone | aprendiz 1 | nuevo |
| L6 | Corrección humana a la IA | lección inmediata | A | aprendiz 1 | nuevo |
| L7 | N2 con 30 ejecuciones sin veto | propuesta de subir a N3 | propone | rampa | nuevo |
| L8 | N3 con 2 correcciones en 7 d | baja automática + aviso | A | rampa | nuevo |
| L9 | El dueño rechaza una propuesta | memoria de decisiones | A | — | nuevo |
| L10 | Cierre de mes | conversión recalibra valor de citas y score | propone | aprendiz 6 | nuevo |

## 9. Métricas norte e instrumentación

Diaria (panel del dueño y digest): citas agendadas (por IA / por humano) ·
speed-to-lead real · tasa de respuesta por toque y canal · P1 dentro de SLA ·
coberturas de la IA · vetos y correcciones · faltas · costo IA. Mensual:
conversión por fuente / giro / partner / consultor · calidad de las citas
(demo hecha, cotizada, pagada) · calificación en vivo del consultor. Todo se
calcula desde `ti_eventos`, no desde tablas dispersas.

## 10. Multi-partner

Todo se escopa por `owner_id` / partner (el scope existe): cola propia, panel
del dueño escopado, métricas por partner. Las reglas admiten **override por
partner** (cadencia suave, textos con su nombre, horario propio). El
playbook y la wiki son compartidos por default con secciones por partner. La
rampa es global (la autonomía se gana con la evidencia de todos), pero un
partner nuevo puede arrancar con N2 forzado en sus leads durante 30 días.

## 11. Plan de construcción

| Fase | Entrega verificable | Depende de |
|---|---|---|
| **A0 Bitácora + perfil** — HECHO 2026-09-01 | `ti_eventos` con 7 adaptadores (WA, quotes, bookings, correo, tareas, ia_log, contactos/suscripciones) y backfill 90 d (6,651 eventos, idempotente); `ti_perfil` recalculado desde la bitácora (264); mejor hora/canal desde cualquier respuesta con write-through a la cadencia | — |
| **A1 Reglas como datos + panel** | `ti_reglas` versionado leído por el motor (fallback = constantes); panel «Reglas y lógica» por acción: ver, editar, historial, métrica 30 d, simulador | A0 (métrica) |
| **A2 Rampa + Próximos envíos** | `ti_acciones`; pestaña Próximos envíos con veto; kill-switch; silenciar por lead; bajada automática | A1 |
| **A3 Motor de política** | `replanificar(lead, evento)`; score por evento; cadencia como política (T1–T8 = versión 0); llamadas con propósito; C1/C20/C21/C23 | A0, A1 |
| **A4 Copiloto SDR** | responde desde el minuto 0 dentro de límites; intención (`wa-intencion`); agenda directo; audio; Bien/Corregir/No debió; ausencia y DND | A2 |
| **A5 Aprendizaje v2** | 6 aprendices en timer nocturno del servidor; propuestas a reglas/jugadas/adendas/rampa; medición de jugadas; memoria de decisiones; adendas al prompt | A0–A2 |
| **A6 Panel del dueño** | colas de todos, faltas, coberturas, propuestas pendientes, métricas norte, calificación en vivo, digest 18:30 | A5 |
| **A7 Externos** | Twilio (número + envs) → llamadas con transcripción; overrides por partner | número |
| **A8 Voz** (considerar, 2026-09-02) | (1) **Voz entrante** en el número de Twilio: contesta, entiende giro, califica, agenda y pasa la llamada al consultor si está libre — mismo guion del agente de WhatsApp; stack ElevenLabs Conversational AI (voz, ya pagado) + Claude (cerebro) + Muse Voice Transcribe de Meta (oído: ASR en tiempo real con diarización, $3/1,000 min) sobre Twilio Media Streams. (2) Confirmaciones, recordatorios y no-show por voz. (3) Muse para transcribir llamadas y demos → minuta, datos al CRM, seguimiento post-demo (sustituye a Whisper en F4). **NO** por ahora: salientes en frío (revisar a los 6 meses con datos del agente de WA) ni «dar la demo» (la demo sigue humana; una demo guiada sobre cuenta demo del giro se reabre en 6–12 meses). Costo estimado: ~$0.10 USD/min de conversación + $0.003/min de transcripción | A4 estable + número Twilio |

Orden recomendado: A0 → A1 → A2 → A4 → A3 → A5 → A6. (A4 antes que A3
porque la IA conversando desde el minuto 0 es el cambio de mayor efecto con
menor riesgo si ya existe la rampa con veto.)

## 12. Decisiones del dueño (tomadas 2026-09-01)

1. **Modelo C aprobado**: la IA ejecuta lo de texto y conversa desde el minuto
   0 dentro de límites; el humano hace T1, llamadas con señal, demo, límites y
   aprueba aprendizajes.
2. **La IA agenda demos directo** sobre el calendario real; arranca en N2.
3. **Rampa: la matriz de 4.4 tal cual.**
4. **Umbrales**: 20 ejecuciones limpias suben acciones simples, 30 las de
   agenda/correo/respuestas; bajada automática con 2 correcciones en 7 días
   o 1 queja del lead atribuible.
5. **El ciclo nocturno corre en Supabase**: Edge Function + `pg_cron`
   (`pg_net`), una invocación por aprendiz, llave de Anthropic como secreto
   del proyecto. Se descartó el servidor (es de desarrollo) y Vercel (sin
   llave, `maxDuration`). Cambiar hora o apagar = `UPDATE cron.job`.
6. **T4 y T7 (llamadas a ciegas 3ª y 4ª) pasan a texto de la IA** salvo
   señal o valor alto; se mide la tasa de contacto y la política las
   devuelve si conviene.
7. **Arranque de construcción: A0** (bitácora + perfil).
