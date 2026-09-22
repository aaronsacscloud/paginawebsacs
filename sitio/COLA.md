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

- [x] **6 · Botón de llamar** en la lista de llamadas y en el detalle del lead. HECHO.
- [~] **8 · Llamadas inteligentes con espacio propio.**
      - [x] El bug reportado: tocar un filtro ya te saca de la cabina y te lleva
            al inbox, en vez de dejarte atrapado con una lista que no coincide.
      - [ ] El espacio propio de verdad: hoy la cabina VIVE dentro de InboxPro
            y recibe `qs={armarQS(filtros)}` — el filtro del inbox. Sacarla es
            registrarla como pestaña propia en CrmDashboard (Tab + allIds + NAV)
            y darle su propio armador de lista de arranque. Es refactor de
            estructura: se hace aparte y con QA de navegador, no al vuelo.
- [x] **9 · Carta y proceso de conciliación.** HECHO el motor: tabla, link con
      token, página pública donde lee y firma, y al firmar arranca solo (pasa a
      «En conciliación», deja la tarea del día y suena la campana). Probado de
      punta a punta. ⚠️ FALTA la pantalla en el CRM para redactarla y mandarla:
      hoy se crea por API. Los TÉRMINOS los escribe el dueño por caso.
- [x] **10 · Agenda de Andrea a partir de las 12:00 PM.** HECHO. NO estaba bien:
      ofrecía desde las 09:00. Ahora 12:00–18:00 L-V, verificado contra el
      agendador público. ⚠️ Quedan 2 reuniones reales ya agendadas antes de las
      12 (Grecia 18-sep 10:00, Jose 18-sep 11:15) — no se tocaron.

## 17-sep-2026 — Etapas de «Perdido» (APROBADO por el dueño)

> «ok adelante con esto» — sobre el plan de tres cajones:
>
> **Etapa — lo que se decide (3 cajones, no 4):**
> - `churned` → Perdido · se fue, la puerta sigue abierta
> - `en_conciliacion` → Perdido · en conciliación · aceptó sentarse
> - `perdido_definitivo` → Perdido · definitivo · dijo que no; no se le vuelve a escribir
>
> **Derivado — lo que pasa (sin trabajo humano):**
> - «Sin respuesta al proceso» = tiene carta `enviada` hace ≥7 días sin contestar
>   → columna y filtro en Churn, más la tarea del día. Siempre correcto, cero
>   mantenimiento. Visualmente lo ves como un cajón más; el dato no se parte.
>
> **Lo que hay que conectar para que sirva de algo:**
> 1. Un solo sitio que diga «a estos no se les toca»: winback, ABM, secuencias y
>    el agente lo consultan. Hoy cada uno decide por su cuenta.
> 2. `perdido_definitivo` se pone solo en tres momentos: rechaza la carta de
>    conciliación (ya lo detecto), aprieta «no me interesa» siendo `churned`, o a
>    mano desde el selector.
> 3. Que la parada sea por «dijo que no» y no por «respondió» — es lo que separa
>    a Mónica de Ezequiel.

Llegó mientras estaba ordenando los selectores de la cabecera del hilo. Se toma
en cuanto eso quede cerrado y verificado.

## 17-sep-2026 — «Cliente» en el selector: relacionar o crear

> «aquí me lo pone así [Cliente · lo pone el cobro, en gris] pero por ejemplo
> este caso es que quiero relacionar este contacto a un cliente que ya existe,
> entonces me debería dejar ponerlo en Cliente y que me pida si relacionarlo o
> crear uno nuevo, y cada uno con su respectivo flujo.»

Tiene razón y resuelve la objeción original: el problema nunca fue marcar
«cliente», fue marcarlo **sin cuenta detrás** —eso es lo que descuadra el ARR—.
Si al elegirlo se obliga a vincular a una `company` que ya existe o a crear la
cuenta ahí mismo, el ARR no se rompe y se ahorra el rodeo de tres pantallas.

Queda por definir: qué es «crear uno nuevo» exactamente (¿empresa sin
suscripción? ¿abre el modal de Nueva suscripción?) y qué pasa con el contacto
que ya tiene `company_id`.

Llegó mientras armaba las plantillas de apertura.

## 17-sep-2026 — Llamadas inteligentes: crear una lista nueva a la medida

> «aquí debo poder crear una nueva lista y poder operarla desde aquí con los
> filtros que seleccione de forma dinámica. Hazlo junto con todos los de la
> cola hasta terminar.»

Las cinco listas fijas cubren los cinco motivos de siempre, pero no dejan
armar «los rezagados de Guadalajara con más de dos sucursales». Hace falta un
armador de filtros en la propia pantalla, que entregue el mismo `qs` que ya
consume la cabina.

## 17-sep-2026 — Churn: la actividad de las secuencias, en el caso

> «aquí hay que agregar una sección de actividad donde se ligue una de las
> secuencias, y saber: qué se le ha enviado, qué ha visto, si se ha dado
> respuesta negativa o positiva. Un listado claro que permita ver si el cliente
> con churn está respondiendo o no a los correos, para tomar decisiones
> rápidas. Que junte toda la información de todas las fuentes de actividad, y
> basado en eso poder decidir más rápido: si seguimos con él, seguimos
> intentando o de plano ya no.»

Va en el drawer del caso (ChurnCaso.tsx), como bloque o pestaña. Fuentes a
juntar: `crm_secuencia_miembros`/`enviados` (qué salió y de qué secuencia),
aperturas y clics del correo, `wa_mensajes` (entrantes y salientes), y la
señal de sí/no que ya sabe leer el agente (RECHAZO_BOTON_RE / senalDeInteres).
La decisión que tiene que soportar la pantalla es una: seguir o soltar — así
que arriba va el veredicto, no la lista.

## 17-sep-2026 — La propuesta de rescate: más campos y un documento formal

> 1. Que me permita personalizar el tiempo que le damos gratis.
> 2. Que me permita agregar más puntos a los que nos comprometemos.
> 3. Que me permita agregar comentarios.
> 4. Que me permita agregar a qué se compromete el cliente.
> 5. Que me permita agregar un valor a lo que normalmente cuesta todo, para
>    que vea el beneficio y lo que le estamos brindando; y que sea clara la
>    fecha en la que pagaría y cuánto pagaría por si desea seguir después del
>    año correspondiente.
>
> «Y mejora el diseño del documento, que se vea muy moderno con toda esta data
> y métele más formal, que se vea como un acuerdo formal.»

Y además (mismo pedido, minutos después):

> «Agrega otras cosas que NO están incluidas y que sí tienen un costo extra de
> la plataforma: son los tokens y la IA, por ejemplo. Que lo pueda agregar como
> no incluido.»

O sea que el documento necesita las dos columnas: lo que SÍ entra en el rescate
y lo que se cobra aparte (tokens, IA). Escribir sólo lo incluido es lo que hace
que el primer recibo con consumo de IA se sienta a traición.

Hoy los meses gratis son tres botones fijos (1/3/6), los compromisos una lista
cerrada de seis, y no hay comentarios, ni compromisos del cliente, ni el valor
de referencia. Toca el formulario de `ChurnCaso.tsx` (propuesta) y el documento
que ve el cliente. Ojo: el punto 5 es el que más vende —enseñar lo que cuesta
normalmente al lado de lo que va a pagar— y el que exige que la fecha y el
monto de renovación queden escritos sin letra chica.

## 17-sep-2026 — La propuesta: editarla, firmarla y ver su actividad

> «Que después de hacer la carta compromiso igual pueda editarla con todos los
> campos nuevos y que quede bien. Y también dale un espacio para que el cliente
> realmente la firme, y ponle todo lo necesario para que vea la actividad y vea
> si la vio, si no la vio, etc.»

Tres cosas distintas:
1. **Editar** — hoy sólo existe «Hacer otra», que crea una nueva y expira la
   anterior. Falta abrir el formulario con los valores cargados. Ojo con la
   regla de la conciliación: lo firmado no se edita. O sea, editable mientras
   NO esté aceptada.
2. **Firmar** — `quotes` ya tiene `aceptado_por`/`aceptado_fecha` y el modal de
   aceptar cotización. Hay que exponerlo en el documento de rescate y que quede
   el nombre como constancia, igual que en la carta de conciliación.
3. **Actividad** — ya hay `vistas`/`primera_vista_at`/`ultima_vista_at` y el
   aviso «Todavía no la abre». Falta el detalle: cuándo la vio, cuántas veces,
   y qué pasó después.

## 17-sep-2026 — La sala de la llamada MANUAL (pendiente, es grande)

> «Cuando llame manual, que también me permita reintentar la llamada con un
> clic, que sea rápido. Y cuando el cliente responda, que me aparezca una
> pantalla, un modal bonito y grande, con: el contexto de lo que se ha hablado,
> las sucursales, la marca en grande, si hemos tenido otras llamadas
> anteriormente, y la parte de agendar una reunión —simple, y que yo pueda ver
> los horarios disponibles—. Todo el proceso similar al que tenemos automatizado
> en llamadas inteligentes… analiza esto, agrega otras 10 cosas que consideres
> importantes.»

**El análisis, para no empezar de cero la próxima vez.** Hoy la llamada manual
usa el widget chico de `Telefonia.tsx` (el negro de la esquina: cronómetro,
nota, silenciar, teclas, colgar). La cabina de Llamadas inteligentes ya tiene
casi todo lo que pide —contexto, resultado, cierre con IA, agenda— pero está
atada a una SESIÓN con lista. Lo correcto NO es duplicarla: es sacar su panel a
un componente que sirva para las dos, con o sin sesión detrás. Si se copia,
en un mes son dos salas distintas y una se queda vieja.

Lo pedido: reintentar con un clic · contexto de la conversación · sucursales ·
marca en grande · llamadas anteriores · agendar viendo horarios reales · notas.

Mis diez, por orden de lo que más duele hoy:
1. **Que no se pueda colgar sin decir qué pasó.** El resultado (contestó /
   buzón / no era / volver a llamar) es lo que alimenta todo lo demás.
2. **Transcripción en vivo**, como en la cabina: leer mientras hablas es lo que
   evita la nota de memoria diez minutos después.
3. **Quién es y qué le duele en una línea**, arriba: etapa, ARR, días sin
   comprar, último motivo. Lo que ya arma `ia.ts` para el consultor.
4. **Lo último que se le dijo por WhatsApp/correo**, textual. Llamar sin saber
   qué le acaban de escribir es cómo se contradice uno.
5. **«Volver a llamar el …»** con fecha, que deje el seguimiento solo. Prometer
   sin fecha es lo que ya nos costó esta gente.
6. **Mandar la liga de agenda por WhatsApp desde la misma sala**, para cuando
   dice «mándamelo y lo veo».
7. **Aviso de zona horaria y de si es buena hora ahí**, que la cabina ya calcula.
8. **Que la nota se guarde sola mientras se escribe** — un cierre que se pierde
   por cerrar la pestaña es peor que no tener nota.
9. **Sugerencia de cierre con IA** al colgar, como en la cabina: propone
   resultado, resumen y siguiente paso, y tú confirmas.
10. **Que la llamada quede en el hilo de WhatsApp** como un mensaje más, con su
    duración y su minuta: hoy hay que ir a otra pantalla para saber que existió.
11. **NOS LLAMAN Y NO ALCANZAMOS: WhatsApp automático** (pedido del dueño).
    Una llamada entrante perdida hoy no deja nada: ni aviso al cliente ni rastro
    accionable. Quien marca y escucha el tono hasta rendirse no sabe si le
    fallamos o si el número está muerto.

    **La cascada, y el orden importa.** Se intenta MARKETING primero —es la que
    puede decir «escríbenos o mándanos una nota de voz», que es una invitación
    comercial— y si no pasa se cae a UTILITY, que es la que Meta deja entrar
    casi siempre porque contesta a algo que HIZO el cliente: nos llamó.
    El fallo esperado de la de marketing no es la ventana (una plantilla de
    marketing sí sale fuera de las 24 h) sino el **opt-out de marketing** del
    contacto —error 131050— y los topes por frecuencia. Ahí entra la utility.

    Las dos ya están creadas en Meta (17-sep, PENDING), con `grupo='llamada'`:

      llamada_perdida_v1       · MARKETING · + botón «Tengo una pregunta»
        «Hola {{1}}, nos llamaste y no alcanzamos a responderte. Te devolvemos
         la llamada lo antes posible. Si prefieres, escríbenos por aquí lo que
         necesitas saber del sistema o mándanos una nota de voz, y te
         contestamos a la brevedad.»

      llamada_perdida_util_v1  · UTILITY · el respaldo
        «Hola {{1}}, recibimos tu llamada y no alcanzamos a contestarte…»

    Falta el disparador: el webhook de Twilio de llamada entrante no contestada
    tiene que llamar a un endpoint como el de `telefonia/ocupado.ts` —que ya
    tiene el anti-repetición de 30 min, el registro en el espejo y la tarea de
    devolver la llamada—, cambiando el texto y metiendo la cascada de dos
    plantillas. Y la tarea SIEMPRE, se haya podido avisar o no: una llamada
    perdida en silencio es la que no se devuelve.

## 17-sep-2026 — Cierre de llamada: lo que falta del caso del dueño

Su caso, textual: «un cliente me respondió, apareció la información, hablé con
él pero realmente no era calificado; entonces al colgar sí me debe mostrar las
opciones para cambiarlo de ciclo de vida, poner una nota clara, y de ahí que ya
me mande a la próxima; igual que me aparezca la opción del calendario ahí mismo
en caso de que de forma automática no se haya creado alguna sesión, y si sí se
creó algo automático que me lo diga al colgar».

HECHO: el selector de etapa en el cierre (5 opciones, las que se deciden en una
llamada). Nota y resultado ya estaban. Y «Al seguir se deja hecho» ya lista los
compromisos con su fecha, la agenda y el calendario cuando la IA los propuso.

HECHO TAMBIÉN (17-sep, misma tanda): el calendario cuando no se creó nada, el
aviso de que no quedó compromiso, y el «lo estás oyendo en vivo».

(quedaba, ya resuelto):
1. **El calendario cuando NO se creó nada.** Hoy, si la IA no entendió un
   compromiso, el cierre no ofrece agendar: hay que salir a la agenda. Debería
   salir el mismo bloque de horarios libres que lleva `SalaLlamada` (ya usa
   `available-slots`, probado), para cerrar la fecha antes de pasar al
   siguiente.
2. **Decir en una línea qué quedó hecho, aunque sea nada.** Cuando la IA no
   propone, el cierre se queda mudo y no se sabe si se creó algo o no. «No se
   creó ningún compromiso» es información, y su ausencia se lee como «algo se
   creó y no me lo dijeron».
3. **Escuchar la llamada con un clic mientras timbra** (pedido aparte): hoy el
   audio sólo llega si estás en la sala. Poder «asomarse» a un timbrado sin
   entrar cambia cómo se decide saltar o esperar.

## 17-sep-2026 — Los 10 puntos «wow» del marcador (2 hechos, 8 pendientes)

Salieron de los bugs reales de hoy, no de una lluvia de ideas. Orden por lo que
más cambia la sensación de usar el marcador.

HECHOS (17-sep):
 2. **«Ya te oyen, habla»** — medio segundo de verde en toda la tarjeta cuando
    se abre el micrófono. El caso Fernando está medido: contestó, el vendedor
    habló al aire y colgó a los 4 s; en lo oído hay una línea suya y ninguna
    del vendedor. La señal existía (una pastilla gris arriba a la derecha) y no
    se veía desde donde se mira.
 3. **El medidor de tu propia voz** en la línea de estado de la cabina. Si no
    se mueve mientras hablas, estás mudo — la comprobación que ningún aviso
    sustituye. El nivel lo mide `Telefonia.tsx` (tiene el stream) y se reparte
    por el evento `tel-nivel`: dos AnalyserNode sobre el mismo micrófono es
    pedir problemas de audio para dibujar la misma barra dos veces.

PENDIENTES, con lo que hace falta para cada uno:
 1. **Que la pantalla nunca pueda mentir** — marca de «última actualización» que
    se pone roja cuando el latido se atrasa. El bug del pulso congelado no se
    pudo ver hasta que alguien lo reportó.
 4. **Transcripción en vivo en la llamada manual** — la cabina la tiene colgada
    del `item` de sesión; hay que separarla del modelo de sesión primero.
 5. **Primera frase sugerida** — el dato ya está en `telefonia/contexto`; falta
    convertirlo en una línea con la que abrir.
 6. **Modo jornada** — una sola pregunta al colgar y todo lo demás solo.
 7. **Deshacer los últimos 30 s** del cierre. Sin él la gente duda antes de
    tocar, y la duda es lo que hace lenta una jornada.
 8. **Reordenar la lista por buena hora** — ya hay lada, zona y el historial de
    a qué hora contestó cada uno.
 9. **Cierre de jornada que diga qué cambió**, no estadísticas.
10. **Que el silencio nunca sea el mensaje** — regla general; ya se aplicó en el
    cierre mudo y en el aviso de buzón, falta barrer el resto.

## 17-sep-2026 — «Enséñame la acción que se va a generar» (con el caso medido)

> «Andrea me dijo: márcame en una hora más. Ahí en automático se debe generar
> una cita en el calendario de seguimiento antes de pasar a la otra llamada, se
> debe transcribir, y se debe demostrar que existe esta acción… cuando en la
> llamada hay un tipo de acción, tienes que mostrar la acción que se va a
> generar para que quien llama tenga certeza de que se está ejecutando.»

**LO MEDIDO EN EL CASO REAL (Andrea Romo, 17-sep 21:02):**
  resultado: contestó · 23 s · grabación: SÍ · transcripción: SÍ
  cierre_estado: `sin_datos`
  cierre_ia.motivo: «Your credit balance is too low to access the Anthropic API»

O sea: **la función existe y no falló — se acabó el saldo de Anthropic**. El
cierre con IA es quien lee la llamada, saca «márcame en una hora» y crea el
compromiso; sin saldo no lee nada, y por eso no se generó la cita. En las
últimas 6 h: 8 cierres `sin_datos`, 4 de ellos por saldo.

Y la grabación que pidió PARA PODER EVALUAR BUGS ya existe: `grabacion_path` y
`transcript` están llenos en esa llamada. Falta decir dónde se oyen.

QUEDA POR HACER:
1. **Recargar saldo de Anthropic** (esto no es código).
2. **Que el cierre diga que murió por saldo, no «sin datos».** Hoy pinta «La IA
   no alcanzó a leer la llamada» con el error crudo escondido en un campo. Eso
   se lee como «la IA no entendió» cuando en realidad es «no hay con qué
   pagarle» — dos problemas con soluciones opuestas.
3. **Enseñar la acción ANTES de pasar al siguiente**, con certeza: el bloque
   «Al seguir se deja hecho» ya lista los compromisos con fecha y hora cuando
   la IA los propone. Falta que NO se pueda pasar al siguiente sin haberla
   visto, y que diga «ya quedó en tu calendario» con el link, no «se va a
   crear».
4. **Un botón para oír la grabación** desde el item de la lista y desde el hilo.
   Los datos están; no hay por dónde reproducirlos.

## 17-sep-2026 — Las acciones que pide el cliente EN la llamada (10 casos)

> «Me pidió una acción: enviar la información por WhatsApp. En el momento en que
> alguien pida una acción, la IA tiene que ejecutar esa acción. Debes explicar
> qué acción hiciste o, si no reconoces qué acción hacer, que yo te explique
> cuál deberías hacer para que aprendas… ya sea enviarle una plantilla, si la
> ventana está abierta enviarle un mensaje directamente.»

HECHO YA: la sala se abre igual en llamadas ENTRANTES, y el nombre sale del
contexto cuando Twilio sólo trae el número (era el bug: se veía la empresa y no
la persona, porque `enganchar()` registra las entrantes con `nombre = null`).

LOS 10 CASOS, en orden de cuántas veces pasan de verdad:

 1. **«Mándame la info por WhatsApp»** — el de hoy. Si la ventana de 24 h está
    abierta: texto libre con el PDF. Si está cerrada: plantilla. Hay que decir
    CUÁL de las dos salió, porque el cliente ve cosas distintas.
 2. **«Márcame en una hora / el jueves»** — compromiso con fecha. `cierre.ts` ya
    lo extrae; hoy muere si no hay saldo de IA (caso Andrea Romo).
 3. **«Mándame la cotización»** — hay cotizador; falta el puente desde la sala.
 4. **«Agéndame una demo»** — ya resuelto por el bloque de horarios del cierre.
 5. **«Háblalo con mi socio / pásame con él»** — segundo contacto en la misma
    cuenta: hoy no hay dónde apuntarlo sin salir.
 6. **«Ya no me llamen»** — opt-out. `aplicarOptOut` existe; falta el botón en
    la sala, que es cuando lo dicen.
 7. **«Mi correo es otro / cámbiame el teléfono»** — corrección de datos. La IA
    ya propone `datos` en el cierre; falta poder dictarlos a mano.
 8. **«Mándame el precio de X»** — pide material concreto: debería ofrecer los
    PDF que ya existen en la biblioteca.
 9. **«Estoy manejando, márcame luego»** — reintento corto (15 min) sin gastar
    un intento del tope.
10. **«Ya soy cliente, tengo un problema»** — no es venta: tarea de soporte. El
    candado de cliente del agente ya hace esto para WhatsApp; falta en la voz.

EL PATRÓN QUE LOS UNE, y es lo que hay que construir una sola vez: un panel de
«acciones de la llamada» donde la IA propone lo que oyó, se EJECUTA con un
clic, y queda escrito qué se hizo. Y cuando no reconoce nada, un campo para
dictarla —«mándale el PDF de precios»— que además se guarda como ejemplo. Eso
último es lo que pidió con «para que aprendas»: el mismo ciclo de reglas-como-
datos que ya existe en Trabajo Inteligente (ti_reglas), no un modelo nuevo.

HECHO (17-sep-2026, commits `033cb4ba` y el siguiente). Los diez están en
`lib/telefonia/acciones-frases.ts` con 54 pruebas en `npm test`, y el panel
vive en la sala de la llamada. Tres decisiones que valen la pena recordar:

 · **Reglas antes que IA.** Lo que dispara una acción es una frase, y para eso
   una expresión regular es instantánea, gratis y sigue funcionando sin saldo
   de Anthropic — que era el bloqueo que aquí decía «no empezarlo sin».
 · **No todas salen solas.** Mandar material o dejar un recordatorio, sí; tocar
   la ficha, la agenda o dar de baja, un clic. Un mandado de más se perdona;
   una baja de más, no.
 · **Las entrantes entraron al riel** con la sesión fantasma de `suelta.ts`, en
   vez de refactorizar el cierre entero: cada llamada normal tiene su item y
   todo lo de Llamadas inteligentes le sirve igual.

Lo que quedó fuera y sigue pendiente:
 · ~~La sala en el teléfono~~ → HECHA el mismo día: en móvil hay un botón «Ver
   la ficha y lo que te pidió» durante la llamada, y al colgar la sala aparece
   sola como resumen. Es pantalla completa, con el colgar de pulgar y con lo
   que se está oyendo y las acciones ARRIBA (una sola columna: lo que pidió no
   puede estar a tres pantallas de scroll).
 · **La biblioteca de envíos nace vacía**: la primera vez que alguien pida «la
   información», la sala va a preguntar qué mandarle. Se contesta una vez y
   queda para siempre (Configuración ▸ Telefonía ▸ Lo que ya sabemos mandar).
   → Ya no: va sembrada «la información de Sacs» desde WIKI_COMERCIAL, así que
   el caso más común sale a la primera.
 · **El caso 3 (cotización) manda un PDF de texto**, no una cotización del
   cotizador. El puente con cotizaciones sigue sin construirse.
 · **Twilio anda en 4.34 USD** (17-sep, medido): el número cuesta 6.25 al mes,
   así que sin recarga la línea se cae. Los 90 USD de este mes NO fueron
   llamadas (ésas van en 1.05): fueron 14 números locales comprados y soltados
   —Twilio cobra el mes completo por cada compra, aunque lo sueltes el mismo
   día—. La transcripción en vivo se midió en 0.027 USD por minuto.

## 18-sep-2026 — Lo que llegó mientras trabajaba en la cabina

- [x] **Plantillas con variables fáciles** (nombre · campo del CRM · campo abierto con etiqueta) →
      HECHO: botones que insertan y renumeran, ejemplos automáticos, las reglas de Meta avisadas
      antes de mandarla, y UNA sola lista de campos (había dos y no coincidían: elegías «email» y
      la cadencia nunca mandaba esa plantilla).
- [x] **KPIs al header, en chico** mientras la jornada está viva → HECHO.
- [x] **La pantalla de decidir, en colapsables** («¿Cómo quedó?», «Etapa», «Seguimiento»,
      «Solicitudes extras»), con lo que la IA entendió arriba y el botón grande abajo → HECHO.
- [x] **Seguimiento con las salidas de verdad**: demo, discovery, volver a marcar en 5/10/15 min,
      1 h, mañana, el lunes, día y hora exactos, y «no llamarle más» que además lo saca de la
      lista → HECHO.
- [x] **«No quedó ninguna cita»** se movió al final de la sesión, en gris → HECHO.
- [x] **Buzón**: se cuenta solo («avisando por WhatsApp…») y sigue a la siguiente → HECHO.
- [x] 🔴 **El WhatsApp del buzón decía «nos llamaste»** en llamadas que hicimos NOSOTROS →
      ARREGLADO (ver el commit; salió a dos clientes reales y se paró en cuanto lo reportó).
- [x] **El loader de los botones** → HECHO (Colgando… / Abriendo el micrófono… / Aplicando lo que
      decidiste…, con 600 ms mínimo para que el clic siempre se vea).
- [x] **¿Dónde escucho las grabaciones?** → contestado en el chat; falta ponerlo en una pantalla:
      hoy se oyen desde la cabina («Oír la llamada») y el PDF/minuta va en el hilo, pero no hay una
      lista de grabaciones para buscar una de hace tres días.
- [x] **Las 5 mejoras extra por cada punto** (UX) → salieron repartidas en cada bloque del día.

## 19-sep-2026 — de la jornada de llamadas del dueño

- [x] 🔴 **El bucle que paraba la jornada** (tarjeta HECHA y sin salida) → ARREGLADO.
- [x] 🔴 **La llamada de 19 min de Maela sin cierre** («Request timed out») → ARREGLADO y
      RECUPERADA; más botón «Volver a leer» para cuando falla por saldo.
- [x] 🔴 **«1 vez más» no se seleccionaba** (botón muerto) → ARREGLADO.
- [x] 🔴 **«Le llamé y no se envió la plantilla»** (candado de cadencias) → ARREGLADO.
- [x] **Móvil**: la pantalla propia de Llamadas no le pasaba `movil` a la cabina → ARREGLADO.
- [x] **Las 5 plantillas cálidas `_v2`** → APROBADAS. Y las `_v3` de utility también (Meta reclasificó las `_v2` de utility como marketing; ver commit). Enganchadas. están PENDING en Meta. El código ya usa la primera
      aprobada, así que entran solas — pero hay que CONFIRMAR que Meta las aprobó.
- [x] **Pantalla de grabaciones** → HECHA (buscar, oír, y bajar una sola voz en WAV para clonarla).: hoy sólo se oyen desde la tarjeta de la llamada. Falta poder
      buscar una de hace tres días. (28 de 124 llamadas tienen audio: la grabación es a petición.)


## 19-sep-2026 · tarde — llegó mientras ensanchaba la conversación

- [x] **Un rezagado que agenda pasa a Oportunidad** (y con eso la IA le suelta el hilo) → HECHO,
      más los 4 contactos que ya estaban agendados y se habían quedado en Rezagado.
- [x] **El select de «Abierta» se desborda** → HECHO: los cuatro controles del encabezado ceden en
      vez de tener un mínimo rígido de 118 px cada uno.
- [x] **La conversación, 30% más ancha** y los laterales más chicos → HECHO (516 → 668 px).
- [x] **Poder COLAPSAR el panel de detalle** para agrandar todavía más la conversación.
- [x] **Quitar la píldora «NOTA» de la lista de conversaciones**: «satura demasiado la pantalla».
- [x] **La píldora «NOTA» de la lista** → QUITADA (la llevaban casi todas las filas).
- [x] **Secciones del panel colapsadas por defecto** → HECHO (la llave sube a v4: por código ya
      nacían cerradas, pero su navegador tenía guardadas las que abrió una vez).
- [x] **Colapsar el panel de detalle** → HECHO: pestaña de 30 px, se recuerda entre sesiones.
- [x] 📌 **REGLA DEL INBOX — siempre debe quedar claro QUÉ se le mandó al cliente.** «En vez de que
      la plantilla diga [Document], que aparezca un preview del PDF, y si le doy clic que pueda ver
      rápido el documento.» Aplica a todo adjunto, no sólo a este caso.
      · YA DIAGNOSTICADO (19-sep): esos mensajes tienen `media_url` NULO en la base, así que hoy no
        hay PDF que previsualizar. El texto «[Document]» lo pone el espejo del webhook al vernos
        mandar la plantilla. La causa raíz es que la minuta sale por `enviarPlantilla` a secas
        —camino que no espeja— en vez de `mandarPlantilla`, que sí guarda `mediaUrl` y `mime`.
        Arreglar eso primero; el preview sale solo detrás.
- [x] 🧹 **Sacar los comentarios internos del hilo** (telefonía, cierre con IA, secuencias): «lo
      satura demasiado». Toda esa información se va a **Actividad**, cada cosa en su sección con su
      detalle. De secuencias basta con: en cuál está activo AHORA, en cuáles estuvo, y qué se mandó
      en cada una — sólo para contexto. Objetivo: que la información se lea más limpia y más clara.
- [x] 📊 **Más señales en el bloque Info de la ficha**, cada una con su modal de detalle al hacer
      clic: correos abiertos · correos con clic · reuniones completadas · reuniones agendadas ·
      secuencias activas · llamadas conectadas · llamadas realizadas.
- [x] **Quitar el chip del número (+1 ···0417) de la lista de conversaciones**: «lo ensucia mucho,
      ese espacio lo satura».
- [x] **El aviso «Meta limitó los mensajes de marketing» no va en la cabecera**: sólo en el mensaje
      que fue rechazado. «Normalmente no es un tema a nivel general.»
- [x] 🐞 **Doble clic en el riel de «Notas» deja el panel en blanco** (el segundo clic lo cierra
      pero la columna se queda vacía en vez de volver a Info).
- [x] 🧹 **El menú del inbox se ve saturado**: ordenarlo para que todo se lea más limpio (las dos
      listas con «Ver 6 más», las vistas, y lo de abajo).
- [x] **Vista «Con reunión próxima»** entre las vistas del inbox, para verificar rápido a quién le
      toca reunión pronto.
- [x] **«Ver ficha» sobra en leads**: la ficha ya es lo que se ve en pantalla. Dejarlo sólo en
      clientes.
- [x] **La cuenta a la que pertenece el cliente, en el panel derecho**, para identificarlo rápido
      cuando ya tiene cuenta. Y si «Marca» está vacía, normalmente la marca ES el nombre de la
      cuenta: rellenarla desde ahí (caso Ramon, ligado a su cuenta).
- ~~Plantilla que no se enviaba~~ → el dueño confirmó que no era un error; se omite.

## 19-sep-2026 · lo ÚNICO que queda abierto de esta sesión

- [x] **El respaldo de utility debe hablar del MISMO tema** (venía del 15-sep) → HECHO. El
      mecanismo ya existía desde entonces (`respaldo_utility` en cada plantilla, y silencio si no
      hay gemela); lo que faltaba eran los DATOS. Emparejadas las que se usan: «nuevo número» y
      «número oficial» con una utility nueva que dice lo mismo, y la de anualidad vencida con otra
      igual. Las cuatro aperturas EN FRÍO se quedan sin pareja a propósito: a quien nunca nos
      escribió no hay utility honesta que mandarle, y el código ya prefiere el silencio.
      En la pantalla de Plantillas ahora se ve cuáles se quedarían mudas («sin respaldo de
      utility»), que es lo que evita que esto se vuelva a pudrir.
- [x] **Quitar las pills «→ Agente» de la lista de conversaciones** → HECHO. (La de la reunión
      —«lun 21 17:00»— se queda: ésa la pediste hoy y sí distingue una fila de otra.)
- [ ] **Las grabaciones, en la ficha del contacto** (inbox ▸ detalle): una sección «Grabaciones»
      para que el consultor que va a dar la reunión escuche rápido el contexto antes de entrar.
- [ ] **Cadencia de la llamada de discovery** (correo + WhatsApp): esa llamada suele ser el mismo
      día o el siguiente, así que hay que recordarle al prospecto después de crearla para asegurar
      que llegue a la hora.
- [ ] **QA visual de todo lo de hoy.** El servidor de dev lleva la tarde caído por
      `src/data/navigation.ts` (otra sesión). Todo está compilado, medido contra la base y con 8
      suites en verde, pero las pantallas nuevas no las he visto con el navegador.

---

## 🧊 CONGELADO — no tocar sin que el dueño lo diga

Decisión del dueño (19-sep-2026): «esos no importan ahora». Son los pendientes
que traía la cola de antes de esta sesión. No se borran —cada uno es una
petición suya con su contexto— pero salen del camino para que lo que queda
arriba sea lo que de verdad está en juego.

Para descongelar uno: se mueve otra vez arriba, con su fecha.

- [ ] **2026-09-15 · El respaldo de utility debe hablar del MISMO tema.** «a Jakob se le envió lo del nuevo número, pero
      al no salir el de marketing salió este de utility que no tiene nada que ver con el mensaje anterior; aquí debemos
      manejar otro tipo de formas en caso de que el de marketing no pase, pero que no sea algo que saque de onda al
      cliente o al prospecto porque no tiene nada que ver.» → EN CURSO.

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

- [ ] Esperando el OK del dueño (mañana o pasado, 15/16-sep-2026)

- [ ] Poner la banda de destellos + sello en las pestañas de la ficha del cliente que todavía no la
      tienen: Info general, Suscripciones, Actividad, Reuniones, Conversaciones, Soporte, Outbound,
      Renovación.

- [ ] Revisar las demás vistas con clientes (Onboarding, Churn, Cobranza, Renovaciones) y ponerles la
      suya con su frase.

- [ ] Decidir qué pasa con la tarjeta faro que YA existe en Clientes: el dueño la aprobó como branding
      en su momento; preguntarle si también la quiere en blanco o si esa se queda como la excepción.

- [ ] **7 · La sesión de llamadas, de punta a punta.**
      - [x] 7.1 Indicador en vivo: semáforo verde «Estás al aire — te escuchan».
      - [x] 7.2 Fuera la barra espaciadora; el micrófono se abre SOLO al contestar.
      - [x] 7.3 Ocupado + aviso por WhatsApp + tarea de devolver la llamada.
            ⚠️ FALTA la plantilla UTILITY en Meta («llamada_ocupado_v1»): quien
            llama por teléfono casi nunca tiene la ventana de 24 h abierta, y
            ninguna de las 27 aprobadas sirve. El mecanismo ya está: se pone el
            nombre en PLANTILLA_OCUPADO (ocupado.ts) y empieza a salir sola.
      - [x] 7.4 Cierre automático. Ya existía agendar + notas + datos + envíos
            con confirmación previa; FALTABA descalificar, que es lo que se
            agregó (mismo bug que Montse por el canal del teléfono).
      - [~] 7.5 Tiempo real: la cabina ya pinta el estado de cada llamada en
            vivo y el cierre enumera lo que va a hacer antes de hacerlo; el
            semáforo del micrófono (7.1) cubre lo que faltaba de la llamada en
            curso. Si quiere una bitácora corriendo, decirlo.

## 2026-09-22 · pedido del dueño (llegó a media tarea de «funciones como existentes» en novias)
> «y genera otros 15 criterios mas que nos den el WOW y vamos a usarlo para todos los contenidos que generemos vuelate la barda ve mas alla que cualquiera tambien en tema de linkbuilding segun se una pagina deb llebar a otra subpagina y esa pagina a una pagina principal (considerando que tenemos una pagina principal de novias como sería la mejor estrategia o sobre que estrategia usas este checklist, pensando que nos queremos posicionar y abarcar todos los angulos posibles para este segmento como sería tu estrategia completa para lograrlo, analizalo y dame un plan completo junto con lo otro que te he comentado. pon esta tarea en cola hasta terminar la anterior»
- [x] 15 criterios «WOW» adicionales (28 → 43) aplicables a todo el contenido → `CRITERIOS_WOW` en calidad.ts, tercer nivel del referee (puntúan, no bloquean); PLAN-NOVIAS-DOMINIO.md
- [x] Estrategia de linkbuilding hub/cluster → PLAN-NOVIAS-DOMINIO.md + artifact; código: listaPorGiro, es_hub, «Mapa del tema», check «spoke enlaza al hub», GuiasDelGiro en la landing de novias
- [x] (22-sep-2026) «el call to action debe ser más visual como el home: en grande "Agenda una demo en línea" con la disponibilidad ahí mismo para agendar al momento, o "envíanos WhatsApp"; más notorio y con mucho más diseño» → cierre de las páginas del motor (ContenidoMotor)

## 21-sep-2026 · reporte para el lead (PENDIENTE — prototipos primero)

> «Necesito que este reporte se pueda hacer como tenemos los reportes de
> entrega que maneje el mismo diseño solo que enfocado en un lead que entienda
> que entendemos lo que busca adicional que se vea tecnológico y que tenga
> frases como para impulsar el cierre y mencionar por atender a la reunión
> tienes el 35% de descuento en la licencia anual de nuestros planes. quiero
> que me des prototipos»

Sale de la minuta de descubrimiento (cómo opera hoy · qué le duele · qué le
interesó · qué le mostramos · objeciones · quién decide · siguiente paso).

## 21-sep-2026 · link de consultoría para que el cliente agende solo (PENDIENTE)

> «necesito que en esta sección puedas darme la opción para mandar a los
> clientes al link de consultoría para que lo puedan agendar y aparezca en mi
> calendario de lunandreajagmail.com, necesito configurar los horarios de
> atención y tiene que estar ligado a mi calendario para que no agende en las
> cosas que ya tengo temas que hacer»

La sección es Reuniones (las tarjetas por tipo). Hay que revisar qué tanto de
esto ya existe: event_types, la página pública de agenda y la conexión de
Google Calendar por host_id (ver memoria `crm-agenda-identidad-google`).

## 22-sep-2026 · descuento del reporte del lead: 35 % o 40 %, preguntando antes (PENDIENTE)
> «ahora de estas reuniones es importante que pueda configurar el 35% de descuento o el 40% dependiendo el caso que me lo preguntee antes de hacerlo»

Hoy el modal de ReporteLead.tsx trae un campo libre con 35 por defecto. Lo que pide:
que al darle «Generar reporte» lo primero sea elegir 35 % o 40 % (sin valor puesto),
y que no se genere hasta elegir.
