# Cola de trabajo

Lo que el dueño manda mientras hay una tarea en curso se anota aquí en cuanto llega,
con su fecha y sus palabras. No interrumpe: se toma al terminar lo que se está haciendo.
Ver la regla en `CLAUDE.md` (Cola de trabajo).

## Pendiente

- [x] **2026-09-07 · Eventos: los 10 puntos de la propuesta.** «ok dale a los 10 puntos haz commit y push al terminar y
      de ahí regresamos con todo el tema outboubd» → HECHO 2026-09-07 (commit + push). (1 bandeja después de la feria,
      2 agendar demo en el stand, 3 citas en el stand antes, 4 comparador, 5 presupuesto anual con ROI, 6 captura por
      gafete/tarjeta, 7 turnos del equipo, 8 ruta del recorrido, 9 fit medido vs papel, 10 calendario iCal). Quedan del
      dueño: plantilla de bienvenida por edición «vamos», plantilla de invitación aprobada con hasta 4 variables
      (nombre, feria, stand, liga), y el horario_stand de prueba (10–18 h, 30 min, cupo 2) que dejé en JOYA Octubre 2026.

- [ ] **2026-09-07 · Outbound.** «de ahí regresamos con todo el tema outboubd» → sigue al cerrar los 10 puntos de eventos.

- [ ] **2026-09-07 · Cuentas objetivo: piezas visuales de los 14 giros que faltan + diagnóstico hecho antes de escribir.**
      Propuesto por mí y el dueño respondió «HAZ ESTO [eventos] Y DE AHÍ REFINAMOS LA OTRO». Se toma al cerrar Eventos.

- [ ] **2026-09-07 · Eventos físicos (ferias) como módulo del CRM.** «hacer una sección clara y un calendario claro ahí
      mismo de los eventos más importantes: cuándo es SAPICA, cuándo Intermoda, cuándo son los lugares donde van a
      comprar textiles las boutiques, qué más hay como Intermoda, qué más hay como SAPICA, qué más hay de renta de
      vestidos de novia. Saquemos toda la data: explicación del evento, participantes que van, si es buen fit para
      poner un stand y ganar ahí muchos clientes. Necesito una lista clara de lugares donde debemos asistir y ahí
      mismo todo lo necesario para agregar a los registrados del evento, medir conversiones, medir todo lo requerido
      para llevar una gestión recurrente correcta de cada evento físico. Analiza el caso, considera huecos escondidos,
      crea un plan con todo lo que debe tener el sistema y ejecuta hasta lograr el /goal. Referee de UI/UX/lógica de
      negocio y referee de innovación que simplifique el proceso.» → HECHO 2026-09-07 (commits sin push). Quedan
      del referee: service worker para la cola sin red de /e/[token] (hoy el texto dice la verdad: hay que dejar la
      página abierta o volver a abrir el QR), y el OK del dueño para borrar 4 eventos viejos duplicados.

- [ ] **2026-09-05 · Respuestas libres + evaluación desde el inbox + acciones pedidas por el prospecto.** «Ya me
      gustaría dejar estas respuestas libres pero que desde el inbox pueda evaluar la respuesta y mejorarla para
      futuras, para probar los tiempos, y que al editar un mensaje me ponga más campos para llenarte los datos que
      necesitas para que realmente aprendas. Y otro caso: cuando el prospecto sí desea seguir contactado pero dice
      estoy de viaje o llámame en 3 días (registrar una llamada de discovery) o contáctame en 3 semanas. Cuando pide
      una acción concreta: responder con empatía y programar internamente el seguimiento; si pide llamada un día
      específico, preguntar hora y agendar; si dice contáctame en 30 días, programar el seguimiento a 30 días. Eso va
      en otra subsección de Trabajo inteligente tipo mensajes por agenda. Considerar otros 50 casos típicos.» → HECHO (5-sep): motor de compromisos + sección Programados + respuesta en vivo 24 h + Evaluar en el inbox + chips de cambios.

- [ ] **2026-09-05 · El nombre y los mensajes de bot.** «Verifica que el nombre esté bien, que sea un nombre real, y
      llámala por su nombre; el nombre al inicio es importante. En los primeros dos mensajes sí se usa, como "Hola,
      nombre" o solo "nombre", con variaciones; si ya mandaste dos mensajes con el nombre, ya es demasiado. Y hay que
      generar un patrón que identifique los promocionales: a veces el usuario tiene su propio bot que manda un mensaje
      genérico; esos hay que omitirlos y basar el próximo mensaje en los mensajes anteriores.» → EN CURSO.

- [ ] **2026-09-04 · Mensajes de seguimiento más cálidos y con una pizca de solución.** «Hay algunos que están muy
      duros, no invitan a la respuesta y no se entiende que queríamos conocer más del negocio o cómo Sacs puede
      ayudarlo. Si tenemos algo de información del prospecto, darle una pizca de cómo podemos ayudarle, y de ahí
      decirle que lo mejor sería agendar una demo con opciones esta semana o la próxima. Si ya le ofreciste demo y
      dijo que no, ofrecer una llamada, o al revés. Variar dentro del mensaje, y siempre dar una solución más
      concreta a lo que busca o preguntarle más sobre algo que dijo y no hemos profundizado. Regenerar las
      respuestas con esto.» → SE HACE ANTES DEL ÁRBITRO: cambia los criterios que el árbitro va a medir.

- [ ] **2026-09-04 · Plan de revisión y árbitro de calidad.** «Haz un plan de revisión y dime qué otra cosa no
      estoy viendo o qué otras cosas debemos mejorar en el entendimiento de la IA de qué mensaje enviar para
      asegurar que siempre sea el mejor mensaje posible. Utiliza un referee que analice bien cada respuesta hasta
      que sea 10/10 y avísame cuando se hayan cubierto los criterios de aceptación de cada caso por el cual llega
      un lead, se le da seguimiento y también la descalificación.» → HECHO (5-sep).

## Hecho

- [x] **2026-09-04 · Cola de trabajo.** «Quiero enviarte tareas mientras haces esta, pero en general, cuando mando
      algo mientras trabajas, que siempre sea considerado para agregarlo en una cola de trabajo hasta terminar por
      completo la tarea en curso.» → Regla escrita en `CLAUDE.md` y esta cola creada.

- 2026-09-05 · «ahorita lo único que importa es seguirla entrenando; lo que sí quiero que veas es si cuando modifico una respuesta realmente está aprendiendo o faltan más campos para poder mejorar el prompt, o qué me falta» → tomada al cerrar el fix del reenganche.

- 2026-09-07 · «cuando llega el WhatsApp desde la página web no se le asigna nombre y se le pone WhatsApp… 1) jalar su nombre de WhatsApp e insertarlo; si no es un nombre real o dice WhatsApp, omitir el nombre y mandar solo hola; aplica en conversación en marcha y en plantilla; analizar muy bien el caso e implementar» → tomada de inmediato (mensajes saliendo mal a leads).

- 2026-09-07 · «cambié el mensaje antes de enviarlo y lo mandó igual (plantilla); si Meta rechaza la de marketing que mande la utility en automático y lo diga en el inbox con el tiempo; si cambio el mensaje ligado a plantilla, que use la de marketing con la mejora y aprenda» → tomada junto con el fix del nombre (mismo flujo).

- 2026-09-07 · «ya respondí y ya respondió el lead pero me sigue sugiriendo algo de la conversación pasada; que siempre esté actualizado aunque yo responda de repente» + «aquí la siguiente sugerencia sería descalificarlo y mandarlo a nutrición porque dijo que no tiene dinero» (Cinthya) → tomadas ahora (mismo bloque).

- 2026-09-07 · «los mensajes que yo envíe de forma autónoma en el día (que se registren como enviados por un humano) que también sirvan de aprendizaje, se clasifiquen en el análisis diario y mejoren respuestas y seguimiento» → tomada al cerrar la regeneración.

## 8-sep-2026 · llegaron mientras se construía el reporte de trabajo

**1. Rediseñar la vista de Renovación** (pendiente, con prototipo antes)
> "quiero que revises la vista de renovacion no me parece que este respetando el
> flujo limpio de las demas vistas es por ello que quiero que me muestres como se
> puede ver la ifnrmacion de mejor maneja cosniderando que basado en eso se deben
> de pagar las comisiones es importa te que se puedan poner lo que se pago
> adicional a desde las reuniones de consultoria, el tema de reuniones asignadas,
> mejoras y gestiones levantadas me puedes dar prototipo de vista."

**2. Sacar los datos fiscales de Actividad** (pendiente)
> "esta en actividad esos datos son datos del cliente de pago en primera no deben
> de ser obligatorios para registrar el pago y en caso de que se regstren en el
> pago deben de estar en la informaicon del cliente solo revisa que no dupliquen
> campos no pierdas la logica pero muevelo de actividad por que ahi no va respeta
> el diseno limpio"

## 2026-09-10 · Nota automática de llamada en el inbox (buzón incluido)
> «cuando se mande a Busón, que en automático aparezca el comentario ahí en el
> inbox: una nota interna de que se generó una llamada, se mandó a Busón, se
> esperó tanto tiempo y sonó directamente. Se mandó a Busón el resultado que
> haya tenido. Debe aparecer en la actividad y también debe aparecer dentro del
> inbox como una nota para saber qué sucedió.»

## 2026-09-10 · El nombre siempre visible en la lista del inbox
> «llega un momento que con tanto dato se deja ver el nombre el nombre siempre
> se debe ver optimiza esto por favor»

Con RESUELTA + asignado + fecha + punto de alerta, el nombre se corta a «Ce…»,
«Xi…», «G…». El chip de asignado ya sale como «→ …» (inútil). Renglón 1 debe
ser del nombre; lo secundario baja al renglón 2.

## 2026-09-10 · Contador de llamadas + reglas automáticas configurables
> «quiero asegurarme de que exista un campo que mida la cantidad de llamadas,
> que considere el total de llamadas que le he generado a ella y también cuáles
> han sido contestadas y cuáles han sido no contestadas… que se pueda configurar
> en alguna sección de configuración, en llamadas, un proceso automático: cuando
> se le llame a Busón, se envíe un WhatsApp de utilidad que diga "Hola, ¿qué tal
> te intenté contactar por llamada desde el número tal? Si deseas hablar acerca
> de Sacscloud, lo puedes hacer en este WhatsApp"… y si yo le vuelvo a marcar,
> ya se envió ese mismo, que no envíe un mensaje de vuelta. Que todas esas
> reglas también se puedan configurar desde el sistema.»

1. Contador por contacto: total / contestadas / no contestadas / buzón.
2. Configuración → Llamadas: reglas automáticas editables.
3. Regla: buzón o no contestó → WhatsApp de utilidad, UNA sola vez por contacto
   (no se repite en el 2º y 3er intento).
