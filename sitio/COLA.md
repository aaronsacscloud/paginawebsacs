# Cola de trabajo

Lo que el dueño manda mientras hay una tarea en curso se anota aquí en cuanto llega,
con su fecha y sus palabras. No interrumpe: se toma al terminar lo que se está haciendo.
Ver la regla en `CLAUDE.md` (Cola de trabajo).

## Pendiente

- [x] **2026-09-15 · Cadencia de descalificados con los mismos correos y otro ritmo.** «los correos de los que están en
      rezagados son los mismos que deben recibir en descalificados con el fin de estar top of mind, pero maneja las
      cadencias diferentes para ver cuál tiene mayor resultado; recuerda crear todas las funciones en el sistema para
      que un humano realmente lo pueda hacer» → HECHO: creada y APAGADA (31 correos, martes, 1 por semana), y en la
      pantalla de Secuencias ya se puede duplicar, elegir etapa y ritmo.

- [x] **2026-09-15 · Selección múltiple con Cmd y acciones masivas.** «aquí con cmd en Mac que pueda seleccionar varias
      y me permita hacer acciones masivas, como poder cerrar y dejar como resueltas varias al mismo tiempo» → HECHO:
      Cmd/Ctrl suma, Shift toma el rango, y la barra permite resolverlas todas con su categoría.

- [x] **2026-09-15 · Ver rápido si abrió el correo, y por qué parecían dos.** «quiero ver rápido si no la ha leído o si
      sí… en los correos también debo tener esa data» + «creo que se envió 2 veces un correo o por qué un aviso me dice
      que sí lo abrió y otro dice que no» → HECHO: eran DOS correos (la campaña y nuestra respuesta, con el mismo
      asunto). Cada renglón lleva su hora y su estado completo.

- [ ] **2026-09-15 · El respaldo de utility debe hablar del MISMO tema.** «a Jakob se le envió lo del nuevo número, pero
      al no salir el de marketing salió este de utility que no tiene nada que ver con el mensaje anterior; aquí debemos
      manejar otro tipo de formas en caso de que el de marketing no pase, pero que no sea algo que saque de onda al
      cliente o al prospecto porque no tiene nada que ver.» → EN CURSO.

- [x] **2026-09-15 · «No contestadas» también con correos y llamadas.** «que igual aparezca cuando envía correo el
      cliente y pues no le hemos contestado… y las llamadas que lleguen por aquí que aparezcan ahí» → HECHO.

- [x] **2026-09-14 · «Ya no estoy interesado» debe descalificar de verdad.** «esto genera una descalificación automática
      al prospecto y si previamente ya era rezagado pues solo se descalifica y se termina el flujo, y debe mencionar en
      el inbox de forma interna una nota que se cambió su etapa de ciclo de vida a descalificado y realmente lo debe
      hacer» → HECHO: la baja se aplica en `aplicarOptOut`, con su nota de sistema en el hilo. Jovanna, al día.

- [x] **2026-09-14 · El hueco de arriba en Leads (teléfono).** «Aquí aparece un espacio raro arriba, que no aparezca
      eso por favor» → HECHO: eran los 140 px de aire de la barra de abajo, cobrados también a la cabecera.

- [x] **2026-09-14 · El que llegó por el correo de winback desde un WhatsApp desconocido.** «dale, tú liga a Matin, haz
      tú el proceso, y deja la funcionalidad para otro caso similar» → HECHO: Matin ligado a su ficha de sujuma, y la
      regla del clic en el `wa.me` del correo corriendo en la puerta de entrada.

- [x] **2026-09-14 · Al enviar, que no me suba la lista hasta arriba.** «el contacto lo pasa arriba, el cual está bien,
      pero a mí me manda también arriba… que siga seleccionado pero que yo siga donde estoy en la lista, si ya hice
      scroll y estoy abajo que no me suba, que pueda seleccionar al siguiente contacto» → HECHO: la vista se ancla a la
      fila que estás mirando (escritorio y teléfono).

- [x] **2026-09-14 · El envío debe sentirse inmediato.** «al momento de escribir en el composer y darle click a enviar
      debe ser más limpio el efecto de envío y que se sienta inmediato… me gustaría que se vea al instante que aparece
      en el inbox aunque tarde un poco más en realmente enviarlo, en web y mobile» → HECHO: la caja se limpia y la
      burbuja se pinta al instante; medido 349 ms en escritorio y 160 ms en teléfono con una red de 3 s.

- [x] **2026-09-14 · Un cliente entró como «WhatsApp 7300», sin nombre.** «me lo pone como cliente, pero no tengo su
      nombre, ¿cómo así llegó a cliente o usar Sacs, de dónde lo saca y por qué no aparece su nombre?» → HECHO los
      cuatro puntos: búsqueda por los últimos 10 dígitos, teléfonos normalizados, fichas de Mario fusionadas y el
      nombre (ruta `username` de Kapso + la empresa cuando la ficha nació sin nombre).

- [x] **2026-09-14 · La lista no debe moverse al enviar.** «al enviar un mensaje normal o de una plantilla que la lista
      me mantenga ahí donde estoy para ir con el siguiente contacto, ahorita me sube hasta arriba y pierdo el hilo de a
      quién contactar» → HECHO: orden fijo desde el primer envío, con aviso y botón «Reordenar».

- [x] **2026-09-14 · Las tres rayas del inbox móvil no abren nada.** «Le doy click a los 3 renglones de arriba y no hace
      nada, solo pone un blur pero no muestra nada de los filtros o vistas que debería mostrarme» → HECHO: la hoja se
      escribía dentro del carril de pestañas (scroll horizontal) y iOS recorta ahí lo `position:fixed`.

- [x] **2026-09-14 · Si el consultor tomó la conversación, no más sugerencias.** «aquí yo ya tomé la conversación… la
      respuesta que me está dando la IA está bien, pero como yo ya me estoy comunicando con el prospecto, ahí ya no hay
      más sugerencias. ¿Cuándo cambia esto? Si el prospecto vuelve a dejar de escribir y se cierra otra vez la
      conversación, ahí vuelves con el proceso de la cadencia en donde te hayas quedado.» → HECHO.

- [x] **2026-09-14 · Compartir la liga de una conversación.** «que pueda compartir el link de una conversacion para
      pasarlo a cualquier compañero y que se le pueda dar seguimiento puntual al tema, dame la opción de darle click a
      un botón al seleccionar una conversación y al darle click me genera un link que me permite compartir» → HECHO
      (botón en la barra del hilo + liga por mensaje + mandársela a un compañero con recado).

- [x] **2026-09-14 · La secuencia de rezagados parecía mandar todo el día 1.** «aqui me meti a ver la secuencia de los
      rezagados pero si es real esta info el día 1 se envían demasiados correos y el chiste es que vaya enviando día a
      día no todo en el día 1 podrías revisar» → REVISADO: el cron manda UNO por vez (medido: 3 envíos hoy, uno por
      persona). Lo que estaba mal era la pantalla. Arreglada.

- [x] **2026-09-14 · Respaldo de utility cuando falla el mensaje de marketing.** «este mensaje de marketing tuvo error,
      pero si hay error siempre debe haber uno de respaldo de utility que se envíe para que el prospecto sí le llegue el
      mensaje de seguimiento, igual revisa eso por favor» (caso Maribel, +52 66 7795 6276: «Meta limitó los mensajes de
      marketing a este número»). → HECHO: la cadencia manda por `mandarPlantilla` con respaldo SIEMPRE (el del paso o el
      genérico `pendiente_retomar`), que es lo único que cubre el fallo que Meta reporta DESPUÉS por webhook. 19 de 22
      pasos de WhatsApp no tenían respaldo configurado. Los 10 leads que se quedaron sin nada RECUPERADOS el 14-sep
      («si dale»): 10 de 10 entregados, cero fallos.

- [ ] **2026-09-14 · Facturación dentro de Info general + campo de sucursales del negocio.**
      «la informacion de facturacion puede estar dentro de la informacion del cliente. No me manejes formatos que
      hagan que se descuadre el diseno de la informacion general del cliente. Adicional, quiero que me agregues un
      campo de sucursal: las que tienen activas dentro del sistema y las que tiene el negocio […] si Oculani en
      realidad tiene cuatro sucursales pero contrató una, ahí ya sé que existe una oportunidad de expansión […] y
      que al final esto se pueda agregar como una oportunidad»
      → Ya lo había pedido antes (bloque fiscal suelto). Dos piezas: (1) los datos fiscales viven DENTRO de Info
      general sin romper la rejilla; (2) `sucursales_negocio` en companies + la brecha contra las activas + botón
      para volverla oportunidad.

- [ ] **2026-09-14 · El flujo de ideas → oportunidad → cotización en la ficha del cliente.**
      Propuesta y prototipo entregados (code.sacscloud.com/shots/flujo-ideas.html). Falta el visto bueno del dueño
      para montarlo: cuatro listas, una acción principal por renglón y la idea que sale de la lista al cotizarse.

- [x] **2026-09-13 · La firma de pantalla en los demás módulos (Soporte, Taller, Consultoría, Leads).** → HECHO el mismo día: las cuatro montadas con las frases que eligió el dueño, y el Tablero pasó a usar el componente compartido.
      «me gustaria que en estas pantallas puedas poner los efectos del mensaje y las estrellas de acuerdo a su
      gestion de cada uno que el diseno de la frase que correspinderia y los destellos que hemos puesto en
      cotizaciones y clientes ese es la nueva gestion de branding guardalo solo antes de ponerlo en los demas
      dame las frases y el prototipo que deberia de tener esto metelo en la cola»
      → Primero: guardar la regla en el sistema visual (hecho), entregar las FRASES y el PROTOTIPO. Montarlo en las
      cuatro pantallas se hace después, con el visto bueno del dueño.

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

## 2026-09-10 · Llamar desde el móvil, dentro del CRM (no con el marcador del sistema)
> «que esto igual funcione en mobile, es decir en la parte de arriba de la
> conversación al tener la conversación abierta debe haber un acceso rápido con
> el icono de llamada donde yo pueda dar click y hablar en ese preciso momento
> al usuario y que haga todo el proceso desde el teléfono, que desde ahí lo
> pueda transcribir y absolutamente todo ese proceso, que funcione con una
> interfaz limpia, optimizada y fluida para hablar con el contacto al momento.»

⚠️ Cambia una decisión que hoy está tomada a propósito: en móvil NO se
intercepta el `tel:` y manda el marcador del sistema. Eso significa que HOY una
llamada desde el celular no se graba ni genera minuta — justo lo que se pide.
Hay que llamar por WebRTC también en el teléfono (se puede: getUserMedia sobre
HTTPS), con su propia interfaz a pantalla completa, y cuidar audio/altavoz,
bloqueo de pantalla y que la llamada sobreviva el cambio de pestaña.

---
## Hecho el 2026-09-10/11
- ✅ Bitácora de llamadas + buzón detectado
- ✅ El nombre siempre visible en la lista
- ✅ Contadores por contacto + regla de WhatsApp tras el buzón
- ✅ Minuta en PDF con marca, en inbox/ficha, y envío al cliente
- ✅ Llamar desde el celular dentro del CRM + 5 mejoras

- 2026-09-11 · (detectado por mí) `agente_calla: solo contestó el bot del lead` se registra cada 4 min por el mismo lead (861 en 3 días). Registrar una vez por lead y día.
- 2026-09-11 · (detectado por mí) César siguió el hilo (plantilla de reactivación) en vez de la nota del paso 6 del planificador: medir cuántas veces el modelo ignora la nota PLANIFICADOR y reforzarla si pasa seguido.

## 2026-09-11 · Voz realista con IA que llama sola (GOAL) — llegó a media tarea (bug review del marcador)

Texto del dueño tal cual:

> Ok, ahora lo quiero llevar a otro nivel, en donde quiero que, este, tengamos, primero, una voz realista. Va a ser una voz de mujer, este, con tono mexicano, que va a ser una ella, este, que va a poder hacer este proceso directamente. O sea, vamos a tener el proceso manual por ía, este, automático por ía o manual, para que lo haga un humano. Ahora, para el tema de la ía, tenemos que configurar y dejarlo listo para que de forma automática, al igual que está programado la IA para que obtenga los datos del usuario, le pregunte las cosas importantes, se haga entender del negocio, y de ahí agende la reunión de Discovery o la reunión de demo, tiene que ser lo mismo con el usuario, con el cliente. Entonces, este, ¿por qué esto es importante? Lo importante aquí es que la voz esté en tiempo real, que la voz se so ese es el /goal Entonces, basado en este objetivo, quiero que planees todo lo que necesitamos usar. No importa si tenemos que gastar en APIs, piensa primero en el stack que se tiene que hacer, piensa en en lo que tú tienes que saber de mí o cómo tienes que generar el prompt. Este, piensa en el proceso, en cómo se va a habilitar dentro del front para que sea automático después de generar la lista. Asegúrate de que la llamada sea totalmente fluida. Eso es lo más importante de todo. Entonces, tenemos que asegurarnos que el prompt y todo lo que está atrás sea muy bueno para que este objetivo se cumpla de verdad, piense en la automatización al finalizar la llamada para el tema de la agenda y para el tema del discovery, el seguimiento del proceso. ¿Qué pasa si el prospecto no contesta? ¿Cómo pasa la siguiente llamada y cómo lo reintenta? todos estos temas. Verificarlos, analizarlos y optimizarlos al máximo hasta lograr el gol. Entonces, primero hace el plan, y el plan debe contener las etapas claras por las que se va a desarrollar, los diferentes casos de uso que se van a implementar, los diagramas de flujo, de cómo se va a integrar, qué tipo de IA vamos a utilizar, qué tipo de APIs vamos a utilizar, todo el stack tecnológico que se va a manejar, las validaciones y los casos de uso más relevantes, etcétera.

Estado: en cola. Se toma al terminar el bug review + commit + push del marcador (M1/M2/M7/M9/M10). Entrega: PLAN primero (etapas, casos de uso, diagramas, IA/APIs/stack, validaciones), no código.

## 2026-09-13 · Proveedores de SAPICA (calzado, León)
Llegó a media tarea mientras se cargaba Villa Hidalgo. Texto del dueño:

> Y AGREGA ESTOS COMO SAPICA | Y que son calzado o zapateria ya que son de ese
> giro igual por favor […ARCHIVO: ~600 proveedores con correo y teléfono…]
> agregalas y tambien cruzalas con información web informacion de google
> informacion relevante que sirva si no encuentras la marca no te preocupes y
> sigue con la otra y asi hasta terminar

Pendiente: cargar como giro de calzado/zapatería marcados SAPICA, cruzar contra
las cuentas que YA existen (hay un `2026-09-05-abm-sapica.sql` previo) y
enriquecer con lo que se encuentre en web.

## 2026-09-13 · Cadencia SAPICA (puro correo)
**Dueño:** «Ok ahora vamos hacer una cadencia pero esta si de puro correo para los de la base de datos de SAPICA que está más segmentado a calzado, matrices corridas etc ármate todo pero esta si es puro correo».
- [x] HECHO el mismo día: 2 cadencias (demo/diagnóstico) × 8 correos solo email, pieza, 8 fotos, MX (606/636 válidos), 56 cuentas fuera (proveedores, sombreros, marroquinería, competidor), goteo «SAPICA · diez al día» activo con la firma del dueño → arranca lunes 14-sep 10:00 CDMX.

## 2026-09-13 · Cadencia Intermoda (puro correo)
**Dueño:** «Y de ahí la de intermoda igual considerando todo el contexto» (llegó mientras se armaba la de SAPICA; se hace después de SAPICA con el mismo esquema: solo correo, goteo, MX).
- [x] HECHO el mismo día: giro nuevo `marcas` (los 558 de Intermoda salen de fabricantes/distribuidores), 2 cadencias × 8 correos solo email, pieza «Un modelo con su curva», 8 fotos, MX (558/564 válidos), 95 fuera (81 proveedores en pausa, 14 ajenos/competidores), goteo «Intermoda · cuarenta al día» activo con la firma del dueño → arranca lunes 14-sep 10:00 CDMX después del de SAPICA. Arreglo en abm-generar: tallas vs. modelo-y-color se decide por subgiro.

## 2026-09-14 · Verificar con ZeroBounce las tres bases (Villa Hidalgo, SAPICA, Intermoda)

Texto del dueño: «de esto si lo quiero hacer peor mañana o pasado ahorita no
tngo presupuesto».

Contexto: el 14-sep el disyuntor pausó el cartero con 3 rebotes de 15 envíos
(correos personales de Villa Hidalgo que no existen; el MX no los detecta).
Ninguna de las tres bases pasó por ZeroBounce: ~1,170 direcciones válidas por
MX, ~1 centavo USD cada una (~$12 USD). El cron `abm-verificar-correos` ya
existe (`?cuantas=100&giro=…`). Se corre cuando el dueño diga que ya hay
presupuesto; mientras, el disyuntor y la rampa cuidan el dominio.

- [ ] Esperando el OK del dueño (mañana o pasado, 15/16-sep-2026)

## 2026-09-14 · Correos ABM fuera de México: empresa global + agenda que funcione desde España

Llegó mientras se hacía la liga a la página del giro en los correos de novias. Palabras del dueño:
«y revisa bien el tema igual de la agenda porque si mando esto a españa por ejemplo no quiero que
haya dudas del usuario que solo somos de méxico que se entienda que somos una empresa global y
también si alguien de españa nos agenda revisa que el calendario mande bien la información de la
agenda y todo el rollo que funcione de forma integral si agenda alguien de españa.»

- [x] Revisar textos del correo (pie «hecho en México», «demos de lunes a viernes», número +52) para que
      no suene a empresa solo de México. → `ALCANCE` en `abm-correo.ts`: «Atendemos negocios de moda en
      México, Latinoamérica y España por videollamada, en su horario»; WhatsApp «desde cualquier país»;
      pie «Equipo en México, clientes en más de 7 países»; demos «en su horario».
- [x] Probar de punta a punta `/agendar/demo` como alguien de España (14-sep-2026, local con zona Madrid):
      `zona.ts` nuevo (23 zonas, hora local con cambio de día, 24 h en Europa, lada por zona),
      BookingPage/ReschedulePage en la hora del visitante, «Agregar al calendario» en UTC (antes mandaba
      la hora CDMX sin zona: 8 h de error), correos de confirmación con la hora del invitado y la de CDMX,
      WhatsApp con +34 automático, demo a 30 min (migración `2026-09-14-demo-treinta-minutos-event-type.sql`).
      Booking de prueba borrado. Pendiente por el dueño: sus horarios 9–18 CDMX caen 17:00–02:00 Madrid.

## 2026-09-14 · Los destellos en TODAS las vistas de clientes — y las tarjetas en blanco

Llegó mientras se reestructuraba la ficha de la orden del taller. Palabras del dueño:
«Adicional, para que lo agregues en la cola, en todas las vistas que tienen clientes, quiero que se
vea el fondo de las estrellitas como aquí. Solamente no quiero que pongas esos colores morados en
las cards. Déjalas en blanco como estaban y solamente haz el efecto de las estrellitas que tiene
atrás ese símbolo, por favor.»

Qué significa, para no equivocarse al aplicarlo:
- Lo que SÍ se replica es la **banda de destellos detrás del título** (`<Chispas />` + `<Sello>`), la
  misma de Cotizaciones, Clientes, Taller, Soporte, Consultoría y Leads.
- Lo que NO se replica es el **degradado lila→rosa de la tarjeta faro**. Las tarjetas se quedan
  BLANCAS, con su franja de color de 3 px como el resto del CRM.

- [x] Quitar el degradado morado de la tarjeta grande del Taller de la cuenta (14-sep-2026).
- [ ] Poner la banda de destellos + sello en las pestañas de la ficha del cliente que todavía no la
      tienen: Info general, Suscripciones, Actividad, Reuniones, Conversaciones, Soporte, Outbound,
      Renovación.
- [ ] Revisar las demás vistas con clientes (Onboarding, Churn, Cobranza, Renovaciones) y ponerles la
      suya con su frase.
- [ ] Decidir qué pasa con la tarjeta faro que YA existe en Clientes: el dueño la aprobó como branding
      en su momento; preguntarle si también la quiere en blanco o si esa se queda como la excepción.

## 2026-09-15 · El diseño de TODAS las vistas del cliente: tarjetas primero, limpias, y solo las estrellas de fondo

Llegó mientras se implementaba el stepper de la orden del taller. Palabras del dueño:
«quiero que verifiques el tema del diseño porque no me lo estás respetando. Todas las vistas deben
de verse primero con sus cards, y esos cards se deben de ver de forma simplificada y minimalista,
como hemos venido manejando el diseño. Lo único que vas a hacer diferente es que vas a poner las
estrellas en el fondo, como está en el taller, pero sin que me agregues "taller". En los
subsecuentes, eso no debe de pasar en ninguna adicional. Consultoría ya me lo cambiaste y se ve
como un color de alerta muy feo. Me estás dando dos botones de agregar cuando debería de ser uno y
"emglobar" como esa sección. Entonces quiero que esta sección se vea limpia, que el diseño sea igual
para todas las secciones.»

Las reglas que salen de aquí, para no volver a romperlas:
- **Las tarjetas van PRIMERO** en cada pestaña. Nada de un título o una banda con frase empujándolas
  hacia abajo: el nombre de la sección ya está en la pestaña.
- **Solo las estrellas de fondo.** La franja de destellos sí, en todas. El título y el sello con la
  frase NO — eso es para las pantallas de módulo, no para las pestañas de la ficha.
- **Nada de agua de alerta donde no hay alerta.** Ámbar y rojo solo para lo vencido o lo que frena.
  Un degradado de color a todo lo ancho se lee como un aviso aunque sea un dato.
- **Un solo botón de agregar por sección**, arriba, que engloba lo de abajo.

- [x] Consultoría: tarjeta del dinero en blanco con franja verde, sugerencias en blanco, el puente al
      taller sin ámbar, y UN botón «+ Agregar» para toda la sección (15-sep-2026).
- [x] Los destellos de fondo en las diez pestañas de la ficha, sin título ni frase (15-sep-2026).
- [x] Repasar pestaña por pestaña —Info general, Suscripciones, Renovación, Actividad, Reuniones,
      Conversaciones, Soporte, Outbound— (15-sep-2026). Medido en el navegador: **ningún** bloque de
      color a todo lo ancho quedó en ninguna, y las ocho arrancan en el mismo punto.
- [x] Reuniones: los cuatro botones de estado por renglón se volvieron un estado + «cambiar»
      (15-sep-2026). Con once reuniones eran 44 botones en pantalla.

## 15-sep-2026 · Aliados de los corredores (Villa Hidalgo, Zapotlanejo…)
> «iugal quiero por ejemplo partners espeicifcos de los corredores como
> villahidalgo personas locales que ya les vendan a ellos igual conz
> apotlanejo y así con los diferentes corredores d emexico una ve que temrine
> sbusca ahi»

Buscar aliados POR CORREDOR, no solo por tipo: la persona local que ya le
vende a los locatarios de Villa Hidalgo, de Zapotlanejo, de Moroleón, del
corredor de León. Entra después de terminar la carga de los tipos que están
corriendo ahora.

## 2026-09-15 · La oportunidad de expansión, desde las sucursales — HECHO

Venía de: «si Oculani, en realidad, tiene cuatro sucursales pero contrató una, ahí ya sé que existe
una oportunidad de expansión […] y que, al final, esto se pueda agregar como una oportunidad.»

- [x] En Info general, debajo de «3 sin contratar · expansión», un botón **Crear la oportunidad**
      que abre el cuadro con el monto YA calculado —el ARR activo entre las sucursales que paga, por
      las que faltan— y la fecha de cierre. Nace con `origen: 'expansion'` para poder medir después
      cuánto de lo vendido salió de este hueco. Si la cuenta no tiene ARR (vitalicias), lo dice y
      pide el monto a mano en vez de inventar un precio.

## 2026-09-16 · Nota de contexto al agendar, que viaje a Google Calendar — HECHO

> «aqui al agendar una sesión es importante que me aparezca ujna nota que
> tambien debe aparece en google claendar que me permita agregar directamente
> toda la informaicón que el cleinte quiere ver o quien es el cliente o mas
> detalles del cliente, pero que esto se genere en automatico leyendo la
> conversación para darle un contexto al consultor debe tener lo que se habl oque
> se quiere ver quien es el cliente, que busca, etc y tambien un link para ver la
> conversación en el. CRM y así el consultor al ver la reunión le puede dar click
> y ver todo de forma inmediata.»

Dónde: el panel **Acciones → Agendar reunión** del inbox (día · horario ·
correo del cliente). Ahí falta una **nota de contexto**:

- [x] Se **genera sola leyendo la conversación** (ya existe el botón «Resumir»
      del inbox — reusar ese motor, no hacer otro). Debe traer: quién es el
      cliente, qué busca, qué pidió ver en la sesión y lo que se habló.
- [x] Se puede **editar antes de confirmar**: la IA propone, el humano corrige.
- [x] Viaja a la **descripción del evento de Google Calendar**, no solo al CRM —
      el consultor abre la invitación y ya tiene el contexto, sin entrar a nada.
- [x] Incluye un **link directo a la conversación en el CRM** dentro de esa misma
      descripción, para pasar de la invitación al hilo con un clic.

## 2026-09-16 · Cuatro casos del inbox (Montse, orden fijo, ciclo de vida, correo)

> **Caso 1:** «Monse menciono que no le interesa, en este caso debería de haberlo
> descalificado después de esa respuesta, peudes revisar porque no lo hizo? y
> tambien sacarlo de la cadencia e ingresarlo a la cadencia de descalificado que
> esta mal en el flujo que no sucedio esto.»
>
> **Caso 2:** «Esta solución no funciono correctamente, en donde pones esto de
> orden fijo mientras contestas no sirve porque deja de ser dinamico y estar
> apretando un botón es muy incomodo.»
>
> **Caso 3:** «Agregar un selector a un costado de sin asignar y dejar todos esos
> selector que se vean iguales y agregar uno que se llame "etapa de ciclo de
> vida" […] que exista la etapa "En conciliación" […] cuando un cliente perdido
> pasa a esta etapa y esta en una cadencia, en automático se elimina de las
> cadencias […] una opción rápida que me permita dar un click poner el motivo de
> seguimiento, ponerle una fecha y tener una sección en el inbox con un filtro
> […] que diga "Pidio seguimiento" […] analiza bien la logica que podríamos
> implementar aquí y realicemos el plan para ello.»
>
> **Caso 4:** «Aqui no llego el correo de confirmación por Marketing, debemos
> tener algna alternativa de utility para estos casos tambien.»

- [x] **1 · Montse dijo que no y siguió viva.** Diagnosticar por qué el botón
      «Ahora no» no la descalificó, no la sacó de la cadencia ni la metió a la
      de descalificados. Arreglar el flujo.
- [x] **2 · «Orden fijo mientras contestas» no sirve.** Deja la lista estática y
      obliga a apretar un botón. Rediseñar.
- [x] **3 · Selector de etapa + «En conciliación» + «Pidió seguimiento».** HECHO. Resuelto el bloqueo que frenaba: los números de churn
      salen de `churn_casos`, NO de `lifecycle_stage`, así que una etapa nueva no
      los mueve. ⚠️ Ojo con los guards `.in('lifecycle_stage',
      ['cliente','churned'])` de churn.lib.ts:39 — hay que sumarles la etapa
      nueva o un caso que se recupere DESDE conciliación no cerraría. Falta
      construirlo.
- [x] **4 · Confirmación que no llegó.** Plantilla UTILITY de respaldo cuando la
      de marketing no entra.

## 16-sep-2026 · video del dueño sobre el Taller (HECHO)

> «En esta sección lo que necesito es que donde está todas para arrancar y en
> desarrollo, realmente aquí en la lista del taller únicamente muéstrame las
> cuentas y el proceso. […] En vez de que diga nadie la ha tomado, sin fecha,
> ya pasaron de fecha, lo vamos a manejar como total, por arrancar, en
> desarrollo y en espera de tu OK. […] Y acá quítame estas para que solamente
> me muestres el buscador, este botón déjalo como nuevo orden. Y aquí cuando yo
> le dé clic a Rubén me tiene que aparecer un filtro para que pueda separarlas
> en las diferentes gestiones que se tienen por la etapa en la que se
> encuentra, porque aquí por ejemplo se juntan todas estas, estas también están
> filtrando y esta también filtra, entonces no tiene sentido y se ve mal. Por
> favor acomódame esto para que realmente tenga una lógica. De aquí por ejemplo
> hay algunas sin fechas que mandé que tengo que borrar porque realmente no
> están bien, entonces que me dé la opción de quitarlas.»
> https://www.veed.io/view/b47306b3-5bf9-4629-9b10-3517dda989a0

Hecho: las 4 tarjetas son el único filtro de arriba, se fue la tira de vistas
guardadas y «Solo las mías», la barra de abajo quedó en buscador + Nueva orden,
y dentro de la cuenta el filtro es por ETAPA con «Sin fecha» detrás de la raya.
Quitar ya existía desde el commit 6fc84fc9 (el dueño grabó con un bundle viejo:
en el video se ve el aviso «Versión nueva lista · Actualizar»).

## 2026-09-16 · Páginas completas de cada giro (llegó a media tarea de Partners)
Texto del dueño: «vamos ahora con las paginas completas de cada giro y necesito que me ayudes a
orquestrar la instrucción ahi te van los puntos clave a seguir.» — el dueño va a mandar los puntos
clave; se toma al terminar las 5 secciones nuevas de /partners (calculadora, certificación,
5 días, portal, niveles). Estado: EN CURSO desde 17-sep (plan en src/data/giros/README.md §7).

## 2026-09-17 · Llamadas: botón, sesión en vivo, espacio propio, conciliación

> **Caso 6:** «Agregar un botón para llamar desde esta sección con un click y
> tambien en el detalle del lead para que sea mas rapido el proceso.»
>
> **Caso 7 (sesión de llamadas):** «1. Al momento que contestan la llamada la
> pantalla debe ser más clara, mostrarme un punto verde o algo que muestre que
> está activo. 2. Por más que hablaba el usuario no me escuchaba, entonces quita
> lo de la barra espaciadora: de forma automática que yo me escuche al momento
> que me pases la llamada. 3. Pasó que estaba llamando y un contacto me estaba
> llamando al mismo tiempo: que se marque como ocupado, en automático le llegue
> un WhatsApp al contacto diciendo que estoy en llamada y que reintente en 5
> minutos o espere a que nosotros le llamemos. 4. Cuando agendo una demo a un
> horario específico, o discovery, o el prospecto dice que no le interesa:
> agendar en automático al terminar la llamada, o descalificar y cambiarle el
> status, además de las notas que tome la IA; y debe decirme justo después de la
> llamada qué acciones se van a realizar para confirmarlas. Todo lo más
> automático posible y al mismo tiempo confiable, y yo debo ver lo que está
> ejecutando siempre en tiempo real. 5. Cualquier otra cosa que pueda hacer más
> eficiente el proceso, bienvenido sea.»
>
> **Caso 8:** «Cuando estoy en la sección de llamadas inteligentes pero le doy
> click a cualquier filtro no me lleva al inbox, se queda en llamadas
> inteligentes. Debemos sacarlo de ahí, darle su propio espacio, y al inicio de
> la experiencia generar un filtro específico y de ahí crear la lista, pero que
> sea dinámico, que no dependa del inbox. Optimiza esa lógica.»
>
> **Caso 9:** «Hacer carta de conciliación y proceso para conciliación de los
> clientes perdidos (ya tengo 3 que me dijeron que sí les interesa). Una carta
> tipo acuerdo con su link que le pueda cargar todo, para que me den el sí,
> firmen, y se inicie el proceso de reconciliación.»
>
> **Caso 10:** «Optimizar el calendario de Andrea para que las reuniones siempre
> sean a partir de las 12:00 PM: que revise si está bien en el sistema y
> adicional a eso que bloquee todo para las 12:00 PM en adelante.»

- [ ] **6 · Botón de llamar** en la lista de llamadas y en el detalle del lead.
- [ ] **7 · La sesión de llamadas, de punta a punta.** Indicador en vivo de
      llamada activa · quitar la barra espaciadora y abrir el micro solo al
      pasar la llamada · ocupado + aviso por WhatsApp con reintento en 5 min ·
      cierre automático (agendar / descalificar / notas de IA) con confirmación
      previa de las acciones · verlo todo en tiempo real.
- [ ] **8 · Llamadas inteligentes con espacio propio**, con su filtro de arranque
      y lista dinámica, sin depender del inbox.
- [ ] **9 · Carta y proceso de conciliación** con link y firma (3 casos vivos).
- [ ] **10 · Agenda de Andrea a partir de las 12:00 PM** — revisar y bloquear.
