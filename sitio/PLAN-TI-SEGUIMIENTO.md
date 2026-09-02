# Plan integral de mejora · seguimiento, calificación y aprendizaje diario del agente

Fecha: 2026-09-02 · Estado: BORRADOR para decidir con el dueño (preguntas S1–S9).
Contexto: agente SDR en sombra con carril de pruebas; reloj de silencio 3 toques (20 h / 72 h / 168 h) →
llamada (192 h) → tarjeta «¿seguimos o lo dejamos?» (216 h); ICP + calidad de conversación (evaluarLead);
plantillas marketing→utility fuera de ventana; ciclo nocturno ti-aprender (rampa, no-era-lead, ángulos,
huecos de wiki, correcciones implícitas, patrón→regla, pares); Aprendizaje con fichas de 6 pasos.

## S1 · El lead respondió, le contestamos y calla mientras se cierra la ventana de 24 h
HOY: el primer toque de silencio sale 20 h después de NUESTRO último mensaje. Si el lead escribió hace 23 h,
la ventana (que se cuenta desde SU último mensaje) puede cerrarse antes del toque y ya solo queda plantilla.
HUECO: no existe el «toque de cierre de ventana» y el ángulo del primer toque no depende de en qué se quedó
la conversación (pregunta abierta, precio dado, horario ofrecido, cita agendada).
PROPUESTA: un toque de cierre a las 22 h del ÚLTIMO MENSAJE DEL LEAD (no del nuestro), gratis y en texto,
con ángulo según el estado: pregunta abierta → repreguntar corto; precio dado → un dato de valor (imagen del
módulo, caso de una tienda parecida); horario ofrecido → confirmar si le acomoda o proponer llamada de 10 min;
agendada → nada (solo recordatorios). Máx. 1 por ventana; nunca si el humano ya intervino. El ángulo se
evalúa por respuesta en 48 h (ya existe el medidor de ángulos).
PREGUNTAS: S1.1 ¿Siempre usamos la última hora de la ventana o solo si la conversación iba bien
(interés ≥ medio)? S1.2 ¿Qué ángulo por defecto: repreguntar, dato de valor o llamada rápida?

## S2 · Cómo se califica al prospecto para saber cuándo parar (y quién decide)
HOY: ICP (giro/tiendas) + conversación (0–100) fijan el máximo de toques (1/2/3). La tarjeta «¿seguimos o lo
dejamos?» sale el día 9 y a las 48 h sin respuesta se aplica la propuesta del agente.
HUECO: no hay un ÍNDICE único que suba y baje con lo que pasa (plantilla sin respuesta, llamada sin
contestar, lead que abre pero no contesta), ni una pantalla diaria que diga «este contacto se ha comportado
así; se sugiere descalificar» con fundamentos y donde el humano califique el criterio.
PROPUESTA: «Índice de vida» (0–100) = ICP + conversación + recencia − toques sin respuesta − plantillas sin
respuesta − llamadas sin contestar + señales (vio cotización, abrió liga, pidió precio). Estados: SEGUIR
(>60), BAJAR RITMO (35–60), SUGERIR DESCALIFICAR (<35 tras ≥3 intentos), NUTRICIÓN. Sección diaria
«Calificación» en Trabajo inteligente: lista masiva con índice, fundamentos (plática real resumida,
intentos hechos, por qué), botones «De acuerdo / No, seguir / No era lead (motivo)». Cada veredicto es
lección (ajusta pesos por fuente/giro en el ciclo nocturno).
PREGUNTAS: S2.1 ¿Cuántos intentos mínimos antes de sugerir descalificar? S2.2 ¿Se aplica solo a las 48 h
como hoy o siempre espera tu clic? S2.3 ¿Descalificado = nutrición mensual (plantilla de valor) o silencio total?

## S3 · Reunión confirmada, contestó la última pregunta y ya no hay nada que decir
HOY: el agente no distingue «cerró bien» de «quedó callado»: podría tocar silencio a un lead que ya confirmó.
PROPUESTA: estado ESPERANDO_REUNIÓN: cuando hay cita vigente y el último mensaje del lead es de cierre
(«gracias», «ok», «nos vemos», emoji) o todas sus preguntas quedaron contestadas (salida.interes + sin
pregunta abierta), el agente NO manda toques; solo recordatorios del sistema y, opcional, un mensaje de
preparación 24 h antes («trae tu Excel / tus 3 productos más vendidos»). Si el lead pregunta algo,
contesta normal. Después de la demo, el seguimiento lo lleva el consultor (o el agente, ver S3.2).
PREGUNTAS: S3.1 ¿Mensaje de preparación 24 h antes: sí/no y qué pide? S3.2 Tras la demo, ¿quién da
seguimiento: consultor (tareas), agente, o agente solo si el consultor no escribió en 24 h?

## S4 · Cómo decide qué plantilla mandar fuera de ventana (y cómo la crea)
HOY: un par base (marketing→utility) con el ángulo en la variable; el agente redacta el ángulo (una oración).
Solo crea el par base; 3 rechazos apagan la creación.
HUECO: una sola familia de plantillas para todos los momentos (retomar tras no-show, promo vigente,
preparación de demo, «¿seguimos?») y sin visibilidad de cuáles entregan/responden.
PROPUESTA: familias por momento (seguimiento, no-show, preparación, promo, cierre de ciclo) creadas por el
agente con revisión del dueño ANTES de mandarlas a Meta; selección por estado + ICP; tablero de plantillas
(enviadas / entregadas / respondidas) y retiro automático de la que no responde.
PREGUNTAS: S4.1 ¿El agente crea plantillas nuevas solo (y solo Meta aprueba) o tú apruebas el texto antes?
S4.2 ¿Máximo de plantillas nuevas por semana?

## S5 · Clientes (ciclo de vida cliente): nada por ahora
HOY: el agente ya ignora a quien no es lead/oportunidad (respuestas, silencio, citas). Siguen corriendo
recordatorios de agenda, secuencias de correo y cadencias humanas.
PROPUESTA: candado explícito «modo cliente»: el agente no propone, no toca, no manda plantillas; si un
cliente escribe, va a soporte (tarea) y se registra el dato. Excepción configurable para upsell cuando
unifiquemos el proceso.
PREGUNTA: S5.1 ¿Hay alguna excepción hoy (p. ej., cliente que pide prueba de un módulo nuevo) o candado total?

## S6 · Promociones vigentes como «plus» al hablar de precio
HOY: planes.ts dice «migración gratis» dentro de los planes y «descuentos según caso, los ve el consultor».
La promo del 35 % y la migración «normalmente $9,000» no existen para el agente: CONTRADICE lo que ya sabe.
PROPUESTA: «Promociones vigentes» en Trabajo inteligente (nombre, qué incluye, vigencia, a quién aplica,
texto sugerido). El agente las menciona como plus al dar precio y guarda en el contacto qué oferta le dijo y
hasta cuándo (propiedades.ofertas); el consultor la ve en el panel y en la reunión; al vencer, el agente
deja de mencionarla y no promete lo vencido.
PREGUNTAS: S6.1 ¿35 % sobre qué (anual, todos los planes, primer año)? S6.2 ¿La migración vale $9,000 y
es gratis solo en promo, o es gratis siempre como dice planes.ts? S6.3 ¿La promo se menciona antes de
saber giro/tiendas o solo con el precio del plan?

## S7 · Sugerencias de seguimiento según el caso + pestaña de descalificados con fundamentos
HOY: los ángulos del silencio son libres (el modelo decide); no hay matriz por (agendó / hubo llamada /
respondió sobre agenda) ni una pestaña de descalificados.
PROPUESTA: matriz de ángulos: no agendó y no responde sobre horario → llamada rápida de 10 min (el agente
la ofrece y crea tarea si acepta); agendó y calla → preparación; hubo llamada sin cierre → recap de lo
hablado + siguiente paso; nunca respondió → dato de valor. Pestaña «Descalificados y sugeridos» con: índice,
plática real (últimos mensajes), intentos (toques, plantillas, llamadas), razón y botón «revivir».
PREGUNTAS: S7.1 ¿La llamada rápida la ofrece el agente al lead o solo se sugiere al consultor?
S7.2 ¿Cambia el ángulo automáticamente tras 1 toque sin respuesta o tras 2?

## S8 · Medidor de tokens y costo
HOY: ia_log guarda costo por acción (últimos 7 días: $3.14 en respuestas, $0.39 en toques, $0.13 citas,
$0.11 reescrituras). No hay pantalla ni alerta.
PROPUESTA: pestaña «Consumo»: hoy / 7 d / 30 d por acción, por lead y por resultado (¿lo que costó agendó?),
costo por cita agendada, presupuesto mensual con alerta al 80 % y modo ahorro (Sonnet para toques de
silencio y extracción; Opus solo para respuestas en vivo).
PREGUNTAS: S8.1 ¿Presupuesto mensual objetivo? S8.2 ¿Modo ahorro automático al 80 % o solo aviso?

## S9 · Revisión diaria masiva con propuestas de mejora
HOY: ti-aprender ajusta reglas por la noche, pero no revisa CADA conversación ni propone acciones concretas
(«a este mándale otro mensaje antes de que cierre la ventana», «a este cámbiale la plantilla»).
PROPUESTA: cron «Revisión diaria» (8:00): por conversación con actividad ayer → avance (etapa antes/después,
preguntas abiertas), qué funcionó, propuesta concreta (mensaje extra, plantilla, llamada, adjunto, cambiar
ángulo, descalificar) con su fundamento. Pestaña «Revisión diaria» con aceptar/rechazar (aceptar crea el
envío pendiente o la tarea); cada veredicto entrena. Objetivo explícito de cada propuesta: que el prospecto
pregunte más, se explaye más y llegue a la demo.
PREGUNTAS: S9.1 ¿Las propuestas se ejecutan solas si no las tocas en N horas (como el veto) o siempre con
clic? S9.2 ¿Hora de la revisión (8:00) y ¿te llega resumen por WhatsApp?

## Decisiones tomadas (ronda 1 · 2026-09-02)
- S2.1 Antes de SUGERIR descalificar: 3 toques + 1 plantilla + 1 llamada (el ciclo completo).
- S2.2 Ejecuta con RAMPA: al inicio con clic del dueño; cuando sus veredictos coincidan con el agente 20 veces
  seguidas, pasa a automático (misma rampa que las respuestas).
- S2.3 Descalificado por silencio → ciclo de vida «descalificado: no respondió» y entra SOLO a la secuencia
  mecánica de nutrición para ese tipo de lead (sin IA; la secuencia ya existe). Si responde, revive.
- S1.1 Toque de cierre de ventana SOLO si quedó una pregunta nuestra (u horarios ofrecidos) sin responder.
- Derivado de la prueba (22:25): con CITA VIGENTE no hay toques de silencio; lo llevan los recordatorios y si
  el lead pregunta se le contesta normal (adelanta S3). El reinicio del reloj ya no borra el resto del estado.

## Plan por fases (después de tus respuestas)
F1 Índice de vida + sección «Calificación» diaria (S2, S7 pestaña descalificados) · F2 Toque de cierre de
ventana + estado esperando_reunión (S1, S3) · F3 Promociones vigentes (S6) · F4 Familias de plantillas y
tablero (S4) · F5 Consumo (S8) · F6 Revisión diaria con propuestas (S9) · F7 Candado cliente explícito (S5).
Cada fase entra con su lección en LECCIONES-TI.md y su caso en PRUEBAS-AGENTE.md.
