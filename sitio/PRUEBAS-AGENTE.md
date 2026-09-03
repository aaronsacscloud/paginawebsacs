# Guion de pruebas del agente SDR (carril de pruebas)

El agente está ENCENDIDO en modo SOMBRA: decide sobre todos los leads pero solo
MANDA a los teléfonos del carril de pruebas (`ti_config.agente_prueba_telefonos`).
Para esos números el reloj de silencio corre acelerado (factor 60: 20 h → 20 min,
día 3 → 72 min, día 7 → 168 min, llamada humana → 192 min, tarjeta → 216 min).

```bash
node scripts/ti-agente.mjs --prueba +5215512345678   # tu número entra al carril
node scripts/ti-agente.mjs --estado                    # ver carril, modo y factor
node scripts/ti-agente.mjs --quitar-prueba +52…        # al terminar
```

El número de prueba debe existir como CONTACTO tipo lead en el CRM (si el inbox
lo muestra como «Desconocido», dale «Crear contacto» o pídele a Claude que lo cree).
El agente responde con ventana de veto (10 min): cada respuesta se ve antes en
Trabajo Inteligente → Próximos envíos; ahí puedes editarla, detenerla o
mandarla ya.

## Los flujos a probar (desde tu WhatsApp, al número de ventas)

| # | Escribe… | Debe pasar |
|---|---|---|
| 1 | «Hola, cuánto cuesta» | NO da precio: pregunta qué vendes y cuántas tiendas (marco de precio solo si insistes) |
| 2 | «Tengo una boutique de ropa, 2 tiendas, llevo todo en Excel» | Refleja tu operación con vocabulario de ropa, una frase de cómo ayuda, y propone llamada o demo |
| 3 | «Va, la demo» | Ofrece DOS horarios reales del calendario; si el CRM no tiene tu correo, lo pide |
| 4 | «El jueves a las 11 · mi correo es …» | Crea la cita de verdad (te llega invitación por WhatsApp y correo); en Próximos envíos se ve «Al salir, el agente agenda la demo…» |
| 5 | «¿Por qué plataforma es?» / «¿a qué hora era?» | Da toda la info (Meet, liga, hora) y cierra ofreciendo ayuda; sin volver a saludar ni a presentarse |
| 6 | «Muévela» | Liga de reagendar o dos horarios nuevos |
| 7 | No contestes 20 min después de un mensaje suyo | Toque 1 con ángulo distinto (si la ventana sigue abierta, texto; si cerró, plantilla marketing → 10 min → utility) |
| 8 | Sigue sin contestar ~3 h | Toques 2 y 3, luego TAREA de llamada humana en Trabajo Inteligente y, después, la tarjeta «¿Seguimos o lo dejamos?» con 4 salidas |
| 9 | Manda un AUDIO contando tu negocio | Lo transcribe y responde a lo que dijiste |
| 10 | Manda tu página web | La lee y te habla de TU negocio |
| 11 | «¿Me haces descuento?» | No negocia: puente + pasa al consultor (aparece P1 en Trabajo Inteligente) |
| 12 | «Por ahora no» | Respeta, pregunta qué cambió, interés bajo → descalificado |
| 13 | «Tengo un gimnasio, control de accesos» | Honesto: no es lo nuestro; busca el ángulo (¿venden ropa o suplementos?) |
| 14 | Escribe en inglés | Responde en inglés |

## Cuando el agente agenda: las condiciones y qué debe pasar en cada una

La cita se crea por el mismo camino que la página pública (`/api/scheduling/book`),
así que hereda sus reglas. Esto es lo que el agente hace en cada caso (código en
`agente.ts` bloque `accion.agendar` + `agenda-agente.ts` + `reintentarAgendas`):

| Condición | Qué hace el agente | Qué ves tú |
|---|---|---|
| Eliges un horario de los que ofreció y el CRM ya tiene tu correo | Agenda; el mensaje confirma día/hora; llega invitación por correo y WhatsApp | `ia_log agente_agendo`, booking con `google_meet_link` |
| Eliges horario pero NO hay correo | No inventa: pide el correo y **recuerda** el horario; cuando lo das, agenda ese mismo sin re-ofrecer | `agente_agenda_sin_correo`; `ti_perfil.agente_estado.agenda_pendiente.motivo=sin_correo` |
| El correo que das ya es de OTRO contacto del CRM | No pisa el correo del otro; /book enlaza la cita al contacto dueño de ese correo | tarea normal; revisar duplicado a mano |
| El horario se ocupó entre que lo ofreció y elegiste (o pediste uno con < 2 h) | «Se acaba de ocupar» + dos horarios reales nuevos | `agente_agenda_ocupado` |
| Error nuestro (500, timeout, columna rota) | Reintenta 1 vez al momento; si sigue: «problema técnico, no es cosa tuya» + liga de la agenda; tarea P1 con el error crudo; reintento automático a los 3 / 15 / 60 min; si queda te confirma solo y cierra la tarea | `agente_agenda_fallo` (con `intentos`), luego `agente_agendo … (reintento N)` |
| La cita se creó pero Google Calendar no dio liga de Meet | Confirma la cita sin prometer liga («te la mando en un momento») y escala | `agente_agendo` con `sin_meet:true` + tarea P1 |
| Ya tienes una cita vigente y pides otra | El prompt le muestra la cita vigente: ofrece moverla (liga de reagendar) en vez de duplicar | `citaTexto` en el contexto |
| Modo sombra y tu número NO es de prueba | No manda nada ni agenda (solo se registra la propuesta) | `ti_sombra` |

Para forzar cada caso desde tu WhatsApp: borra tu correo del contacto (`update contacts set email=null`)
y elige un horario → caso «sin correo»; da un correo de otro contacto → caso «correo ajeno»;
pide «hoy en media hora» → caso «< 2 h / ocupado».

## Los datos del lead se aprenden solos (qué se guarda y desde dónde)

| Fuente | Cómo entra | Quién extrae |
|---|---|---|
| Mensaje de texto o nota de voz del lead, contestado por el agente | `datos` de la salida del agente | El agente (Opus) |
| Mensaje del lead que contestó el CONSULTOR antes que el agente | El agente calla, pero lee lo que dijo el lead | Haiku (`extraerYAplicar`) |
| Llamada con minuta (WhatsApp/Twilio) | Transcripción completa | Haiku |
| Nota que deja el consultor al cerrar una tarea de llamada | El texto de la nota | Haiku |
| Formulario de la agenda pública | Ya escribía giro/tiendas/empresa | `/book` |

Campos: nombre, apellido, correo, marca/tienda, giro, sucursales, ciudad, estado, sitio web, Instagram, puesto,
plan de interés, sistema actual, dolor, mejor hora, canal preferido, cuándo decide.

Reglas: vacío → se llena (confianza ≥ 0.7). Distinto → se corrige solo si el lead lo dijo claro
(`corrige:true` o confianza ≥ 0.9) y el contacto es lead/oportunidad (a un cliente no se le tocan datos de cuenta
desde un chat). Marca nueva → se crea/enlaza la empresa. Giro y tiendas se espejan en la empresa. Un correo que
ya es de otro contacto no se pisa. Todo cambio queda en la ficha: actividad «Datos actualizados desde la
conversación: Giro, Sucursales» con la cita textual, y `propiedades.historial_datos`.

Para probarlo desde tu WhatsApp: di «ya no son 3 tiendas, abrimos otra, son 4» → la ficha debe pasar a 4 y en la
línea de tiempo aparece el cambio con tu frase. Di «mi tienda se llama X y estamos en Guadalajara» → aparece la
empresa enlazada con ciudad. Si contesta el consultor en vez del agente, debe pasar igual.

## Enseñarle el criterio, no solo el texto

Al editar un mensaje (Próximos envíos o «Agente · Mejorar» en el hilo) hay un segundo campo: **Qué debe
considerar el agente**. Ahí va la regla detrás de tu cambio («si hace varias preguntas, contéstalas todas en un
solo mensaje y cierra con una sola pregunta»). El texto corregido es el ejemplo; el criterio es lo que
generaliza: el agente lo lee junto al ejemplo y el ciclo nocturno lo convierte en propuesta de regla cuando se repite.

## «Para la reunión»: la agenda de la demo se arma sola

Cada cosa que el lead dice que quiere ver en la demo la anota el agente (con la frase textual) en la sección
**Para la reunión** del panel del inbox; tú puedes agregar, quitar o palomear temas. La lista se escribe también
en la descripción del evento de Google Calendar de la próxima cita, así el consultor la ve al abrir la reunión.
Prueba: di «también quiero ver cómo manejan el e-commerce» → aparece el tema en el panel y en el evento.

## Imágenes, PDF y video: los recursos del agente

En Próximos envíos, abajo, está **Recursos del agente**: sube imagen (JPG/PNG ≤5 MB; WebP se convierte), PDF
(≤100 MB) o video (MP4 ≤16 MB) y dile *qué muestra* y *cuándo conviene mandarlo*. El agente los ve en su prompt y
adjunta hasta dos por mensaje solo cuando aportan: imagen para ver algo concreto, PDF para lo que se consulta
después, video solo si lo pide o si el flujo se entiende mejor viéndolo. En cada envío pendiente y en cada tarjeta
de Aprendizaje puedes agregar/quitar adjuntos (de la galería o subiendo ahí mismo) y eso queda como ejemplo.
Prueba: sube la ficha de precios en PDF con «cuándo: pide precio detallado o lo va a compartir con su socio» y
pide «¿me pasas los precios para enseñárselos a mi socia?» desde tu WhatsApp.

## Varios mensajes seguidos (ráfaga)

Si mandas 3 o 4 mensajes uno tras otro, el agente espera ~75 s a que termines, los lee como un solo turno y
contesta todo en un solo mensaje, en orden. En Próximos envíos verás «Prueba dijo · 4 mensajes seguidos (el
agente los leyó todos)» con la lista numerada. Prueba: manda «¿tienen físico o es digital?», «¿cuánto cuesta la
migración?», «¿la implementación la hacen ustedes?» en menos de un minuto.

## Promoción vigente

En Próximos envíos, abajo, «Promociones vigentes»: nombre, cómo la explica el agente, fecha límite y si rota sola.
Prueba: pide precio desde tu WhatsApp con giro y tiendas ya dados → el agente da el precio de lista y, una sola
vez, el plus («esta semana y media está el 35 % en el anual y la implementación y migración, que vale $9,500, va
sin costo, hasta el …»). En el panel del lead aparece «Oferta dicha · vence …» y en su línea de tiempo «Se le
ofreció…». Si vuelves a pedir precio, no la repite como novedad.

## Llamada discovery, cierre de ventana y preparación

- **Llamada rápida**: no contestes cuando te ofrezca horarios de demo; al tercer intento (o si dices «¿me pueden llamar?»)
  debe ofrecerte dos horarios de 15 min a partir de las 11:00. Acepta uno → se agenda «Llamada discovery» en el
  calendario del consultor (necesita tu correo) y te llega la invitación.
- **Cierre de ventana**: si te hizo una pregunta y no contestas, a las ~22 h de tu último mensaje (acelerado en el
  carril de pruebas) manda un texto corto repreguntando; solo una vez y solo si había pregunta abierta.
- **Preparación**: el día antes de la demo te pide, con naturalidad, tu Excel o tres productos con tallas y colores.
  Si mandas un archivo, agradece y lo anota en «Para la reunión».

## Las pestañas nuevas de Trabajo inteligente

- **Calificación**: sugerencias del día con fundamentos (índice de vida, intentos, plática real) y botones; todos los leads con su índice; descalificados con «Revivir». Rampa 20 coincidencias → automático.
- **Revisión diaria** (8:00): por conversación de ayer, qué pasó y una propuesta con fundamento; aceptar la ejecuta (mensaje programado con veto, tarea, ángulo, descalificar); rechazar pide el porqué.
- **Consumo**: gasto hoy / 7 d / mes contra el presupuesto de $300, por acción y por lead; costo por cita del agente.
- En Próximos envíos, abajo: Promociones vigentes, Plantillas del agente (tablero de entrega/respuesta) y Recursos del agente.

## Cómo entrenarlo mientras pruebas
- **Próximos envíos**: editar = lección; detener = veto (cuenta para la rampa); «esto hubiera contestado yo» = ejemplo de máxima prioridad.
- **Silenciar IA** en la tarjeta del lead si no debe tocarlo.
- La **tarjeta de decisión**: «no era lead» con motivo enseña exclusiones.
- Cada noche (02:00 CDMX) el ciclo lee vetos, ediciones y resultados y deja propuestas en las notificaciones del CRM.
- Las lecciones de construcción quedan en `LECCIONES-TI.md`.

## Pruebas del 2026-09-03 · píldora, modo sugerencia, reactivación, Datos agrupados

1. **Píldora en el hilo.** Abre cualquier conversación con contacto ligado: arriba, junto a Asignar, debe verse
   «IA activa» (morado) en el número de prueba y «IA observa» (gris) en un lead real mientras el agente esté en
   sombra. Clic → menú con Activar / Que me sugiera / Apagar aquí.
2. **Consultor escribe → se apaga.** Con la píldora en «IA activa», manda un mensaje desde el inbox. La píldora
   debe pasar a «IA observa» y el asignado a ti. Vuelve con «Activar».
3. **Modo sugerencia.** En un hilo tuyo elige «Que me sugiera». Escribe desde el teléfono de prueba; en el
   siguiente tick (≤2 min) debe aparecer la tarjeta «Sugerencia del agente» arriba del compositor. «Usar en el
   compositor» la deja escrita como borrador; «Descartar» la registra como veto.
4. **Reactivación.** Trabajo inteligente → Reactivación. «Redactar 5 ahora» genera propuestas (≈1 min cada una).
   Cada tarjeta dice quién es, qué preguntó y la palanca. Aprobar programa el envío en el siguiente hueco
   (10–18 CDMX, horas distintas); en modo sombra solo sale de verdad si el número es de prueba. Rechazar pide motivo.
5. **Datos.** Subpestañas Facturación / Negocio…; lista de clientes a la izquierda; ficha con todos sus datos.
   «Guardar los que llené» guarda solo los capturados.
6. **Revisión de las 14:00.** A mano: `curl -H "Authorization: Bearer $CRON" ".../api/cron/ti-revision?modo=ventanas"`.
   Solo debe revisar conversaciones cuya ventana cierra hoy y donde la última palabra fue nuestra.
