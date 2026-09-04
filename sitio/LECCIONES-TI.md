# Lecciones del agente SDR · Trabajo Inteligente

Una línea por lección: fecha · de dónde salió · qué fallaba · qué cambió y dónde.
Se lee al arrancar cada sesión del agente. Las reglas viven en el guion y el
conocimiento; aquí queda el rastro de POR QUÉ.

- 2026-09-02 · lote 1 sombra · el agente daba precio antes de saber giro (4/45) → guion: entender primero; precio de lista solo con giro + tiendas.
- 2026-09-02 · lote 1 sombra · invitaba al audio en 21/45 (fórmula) → guion: el audio es una opción, no un cierre de cada mensaje.
- 2026-09-02 · dueño · Sacs es SOLO moda; nada de papelería/farmacia/etc. → conocimiento/giros.ts con 8 giros; contexto dice «si no es moda, dilo con honestidad».
- 2026-09-02 · dueño · solo precios de LICENCIA; plugins/extras se mencionan y el consultor los ve → planes.ts REGLAS_PRECIO.
- 2026-09-02 · dueño · las SUITES no se venden aparte: son segmentación por giro → quitados los «se cotiza aparte»; incluidoPorGiro en cada ficha.
- 2026-09-02 · dueño · la conversación cambia por TAMAÑO (1–2 tiendas: vender rápido, sencillo, e-commerce integrado; 3+: control y automatización) → guion + tamano{chica,grande} por giro.
- 2026-09-02 · dueño · multimarca: lo que vende es lo básico; la consigna solo si la menciona o se le pregunta → ficha multimarca.
- 2026-09-02 · dueño · bisutería ≠ joyería fina: sin gramos ni quilates → alias movidos a ropa; nota en ficha joyería.
- 2026-09-02 · dueño · ejemplos solo de conversaciones de moda → filtro detectarGiro en ti-ejemplos y ti-agente-sombra.
- 2026-09-02 · calificación caso #4 · lead que llega pidiendo demo sin datos → guion: «claro, para que sea especializada necesito giro, tiendas, (web) y qué quieres transformar» o llamada de descubrimiento; el arco entender → empatía → confianza → paso natural → organizar.
- 2026-09-02 · calificación caso #14 · lead que pide precio de entrada → guion/planes: marco «desde $527/mes por sucursal en anual hasta el más completo, depende; hay tipos de descuento según el caso, lo ve el consultor» y regresar a entender; nunca el monto de un descuento.
- 2026-09-02 · calificación caso #22 · respuesta A del agente correcta, siempre dentro del arco.
- 2026-09-02 · calificación #12/#13/#16 · el dueño valida la A del agente en dudas de cita, no-show y queja por espera → guion paso 6: dar TODA la info de la cita (liga, Meet, qué verá), cerrar siempre ofreciendo ayuda, rectificar si no responde en horas, «nos vemos en la reunión» si todo bien.
- 2026-09-02 · calificación #6 · «por ahora no» tras demo+cotización = marcador de poco interés → guion: calificar el interés en cada respuesta (interes.nivel en la salida); el sistema decide insistencia y el paso a descalificado → nutrición.
- 2026-09-02 · calificación #29/#37 · el dueño elige la variante «el arco» para demo y prueba gratis: aceptar + pedir giro, tiendas y qué quiere resolver + ofrecer llamada corta / arrancar la prueba con 15 min de consultor.
- 2026-09-02 · calificación #32 (gym) · negocio que no es de moda: claro y honesto PERO buscando el ángulo (tienda de suplementos/ropa) — consultivo, no vendedor; SPIN Selling como método base → guion QUIÉN ERES.
- 2026-09-02 · calificación #35 · con la página del lead a la vista, reflejar lo que revela de su operación y preguntar lo que pesa en su giro (empatía de giro) → ejemplo aprobado.
- 2026-09-02 · calificación #1 · «sigo buscando» → preguntar qué vende + invitar audio (A del agente) → ejemplo aprobado.
- 2026-09-02 · calificación #24 · el agente SÍ gestiona la prueba gratis (correo + tienda → activar con funciones del giro → avisar); ofrecer arrancarla con consultor → guion + acción nueva en la rampa «activar prueba».
- 2026-09-02 · calificación clientes activos (#39–45) · redirigir a soporte dentro de Sacs con calidez; el agente se queda solo con ventas → guion SI YA ES CLIENTE.
- 2026-09-02 · calificación #19 · «ya estoy en la sala» → confirmar + alerta urgente al consultor → guion EL DÍA DE LA DEMO.
- 2026-09-02 · lote 3 sombra (guion calificado) · #4/#29 piden giro + qué resolver antes de agendar, #14 da el marco de precio y vuelve a entender, #32 honesto con ángulo, #37 prueba con consultor: el guion ya responde como eligió el dueño. Quedan: 1 precio sin giro, 16/45 invitan al audio (bajó de 21).
- 2026-09-02 · construcción · agente en vivo N2 (agente.ts + Próximos envíos + correcciones) apagado hasta tener ANTHROPIC_API_KEY en Vercel.
- 2026-09-02 · dueño · reloj de silencio: 3 toques (d1/d3/d7) → llamada humana d8 → tarjeta «¿Seguimos o lo dejamos?» d9-10 con 4 salidas (seguir sin límite con espacio ×2 / descalificar→nutrición / no era lead con motivo / pausar); sin decisión en 48 h se aplica la propuesta del agente; el motivo de «no era lead» es lección para exclusiones → PLAN §8b, agente.ts tocarSilencios.
- 2026-09-02 · dueño (lote 3, #3 Ariadna) · «¡Hola Ariadna! Soy del equipo…» horas después de haber saludado suena a bot → guion MEMORIA + bloque determinista memoriaConversacion() en el prompt (ya presentado, ya saludó hoy, veces del nombre, audio ya pedido, preguntas ya hechas).
- 2026-09-02 · dueño · antes de que se cierre la ventana de 24 h se evalúa ICP + calidad de la conversación → evaluarLead(): ICP bajo y charla pobre = 1 toque y a la tarjeta (sin gastar la llamada humana); medio = 2; alto = 3 + llamada; la propuesta de la tarjeta sale de ahí.
- 2026-09-02 · construcción · el agendador automático viejo (`agenda_horarios_auto`, `agenda_reagendar_auto`) está PAUSADO por decisión del dueño en otra sesión; el agente agenda por `/api/scheduling/book` bajo su propia llave `agente_sdr` con veto — no reabre esas automatizaciones.
- 2026-09-02 · construcción · `permitido()` devuelve false si no puede leer la tabla: el copiloto viejo dice «no permitido» (copiloto_ia apagado); el agente SDR lo sustituye.
- 2026-09-02 · construcción · paso 4 plantillas (par base creado por el agente, marketing→10 min→utility leyendo wa_mensajes.status), paso 5 (T3–T8 humanos se retiran en modo vivo), paso 6 (cron ti-aprender: rampa con bajada automática, exclusiones por fuente, métricas por toque, huecos de wiki).
- 2026-09-02 · dueño (inbox) · «estoy en un chat y de la nada me cambia a otra persona»: los atajos de una letra j/k/n del inbox se disparaban con el foco en un botón (tras Enviar, un chip o cerrar un modal) y las letras del siguiente mensaje cambiaban de conversación → ahora solo valen si lo último que tocó el usuario fue la lista (`data-lista-wa`). El hilo ya tenía candado contra respuestas tardías de otra conversación.
- 2026-09-02 · dueño · los atajos del inbox van SIEMPRE con ⌘/Ctrl (⌘J siguiente sin responder, ⌘↓/⌘↑ moverse, Esc cerrar): una letra suelta siempre será un accidente esperando. No ⌘N (el navegador lo reserva) ni ⌘K (buscador del CRM).
- 2026-09-02 · dueño · «¿y si no lo alcanzo a corregir antes de que salga?» → la retroalimentación vive en 3 momentos: antes (Próximos envíos: aprobar/editar/detener con motivo), después desde el inbox («Agente · Mejorar» en la burbuja: solo aprender / aprender y mandar), e implícita (el humano escribe justo después del agente sin respuesta del lead → ejemplo dudoso). Y 3 correcciones del mismo estado en 14 días → propuesta de regla del guion, no solo ejemplos.
- 2026-09-02 · dueño · «si el consultor contesta antes de que salga tu sugerencia, ¿aprendes?» → sí: el envío se cancela (nunca dos voces, estado humano_respondio; en sombra también se compara), el par agente/consultor se guarda en ti_envios (humano_respuesta) y como ejemplo dudoso `humano_antes`; se ve lado a lado en Próximos envíos con veredicto del dueño (la del consultor / la del agente / iguales), y lo que nadie revisa en 24 h lo juzga el curador nocturno.
- 2026-09-02 · dueño · Próximos envíos es de UNO EN UNO: aprobar muestra «Enviado a X · Sigue: Y» y pasa al siguiente; la fila queda visible abajo.
- 2026-09-02 · dueño (prueba real, Prueba Aaron) · el lead eligió jueves 3 sep 10:00 (horario real y libre) y el agente contestó «No pude dejar apartado ese horario»; NO era la agenda ni Google: `/api/scheduling/book` insertaba el contacto con `page_count: null` (columna NOT NULL, default 0) cuando la cita llega SIN cookie de atribución —o sea SIEMPRE que agenda el agente (servidor a servidor) y también si el visitante bloquea cookies— → book.ts `Number(atribucion?.n) || 0`. El mensaje genérico escondía el error: el crudo solo estaba en el log de Vercel; se reprodujo en dev con el mismo body.
- 2026-09-02 · misma prueba · el contacto del CRM no tenía correo y /book busca por CORREO: aunque no hubiera fallado, habría creado un contacto duplicado → `agendarDemo` recibe `contactId` y escribe el correo en el contacto ANTES de llamar a /book (si ese correo ya es de otro contacto, no lo pisa).
- 2026-09-02 · misma prueba · «ya le avisé al consultor para que te lo confirme hoy» y el agente se quedaba de brazos cruzados → 4 salidas distintas según la causa: (a) sin correo: lo pide y RECUERDA el horario elegido (`agente_estado.agenda_pendiente.sin_correo`, el modelo lo ve en el prompt y agenda en cuanto llega el correo, sin re-ofrecer horarios); (b) horario ocupado (4xx): ofrece dos reales; (c) error nuestro (5xx/timeout): reintenta una vez en el momento, dice la verdad («problema técnico, no es cosa tuya»), da la liga de la agenda, deja tarea P1 con el error crudo y `reintentarAgendas()` lo vuelve a intentar a los 3/15/60 min — si queda, confirma por WhatsApp y cierra la tarea; si se ocupó, ofrece otros; (d) cita creada SIN liga de Meet (Google Calendar falló pero /book no aborta): no promete la liga, avisa «te la mando en un momento» y escala para que el consultor la mande.
- 2026-09-02 · misma prueba · evaluarLead marcó «giro fuera de moda: Ropa (venta a mayoreo)»: la ficha de ropa no tenía el alias «ropa» a secas → alias `ropa`, `mayoreo de ropa`, `venta a mayoreo`. Un ICP «bajo» por eso le habría recortado los toques de silencio a un lead perfecto.
- 2026-09-02 · dueño · ante un error NUESTRO el agente no se pone técnico ni «te confirmo luego»: rectifica con naturalidad («se me trabó el sistema, cosas que pasan»), le da a elegir el MISMO horario u otros dos reales, y la liga de la agenda; el lead decide → agente.ts rama `!r.ok`. Por detrás: tarea P1, aviso en la pestaña Sistema y reintento silencioso solo si el lead NO ha contestado (si ya habló, la conversación manda y el reintento se retira).
- 2026-09-02 · misma prueba · mientras se reintentaba la cita, el reloj de silencio metió DOS toques con 22 s de diferencia (dos ticks traslapados: cron + tick manual) y uno decía «se nos pasó la hora del jueves» de una cita que aún no ocurría → tocarSilencios: no toca si hay `agenda_pendiente` por error ni si el lead ya tiene cita vigente; candado por lead (un toque de silencio en 30 min); y al quedar la cita se vetan los toques pendientes (`callarSilencioPendiente`).
- 2026-09-02 · dueño · los avisos de lo que la automatización NO pudo resolver van en su propia pestaña «Sistema» de la campana (tipos `sistema_*`), cada uno con «Qué hacer» explícito y clic al hilo → CampanaNotificaciones.tsx; se avisa en: cita fallida, cita sin liga de Meet, reintentos agotados, cita recuperada sola (info).
- 2026-09-02 · dueño · `/book` ahora también encuentra al contacto por WHATSAPP (últimos 10 dígitos) cuando el correo no casa, y le pone el correo si no tenía: el lead que ya conversa con el agente no se duplica.
- 2026-09-02 · dueño · todo el proceso de citas sale a nombre de Andrea Gutiérrez (la cuenta la creó Aaron pero la usa Andrea; un solo usuario por ahora): `team_members.nombre` del founder y `anfitrion_nombre` de sus 9 tipos de evento. Lo ya enviado conserva el nombre viejo.
- 2026-09-02 · dueño (prueba, «Vendo ropa a mayor y tengo 3 sucursales mi correo es…») · el agente SÍ guardó giro, tiendas y correo en el contacto, pero el panel del inbox pinta Marca/Sucursales desde la EMPRESA y un lead que apenas conversa no tiene empresa: se veía «sin dato» → PanelDetalle cae al contacto (Giro, Sucursales) cuando no hay empresa.
- 2026-09-02 · dueño · «si en la conversación hay datos que llenen la ficha, guárdalos; si te das cuenta de que están desactualizados, actualízalos; texto, audio, llamada» → módulo único `datos-lead.ts` (aplicarDatos / extraerDatos / extraerYAplicar): 18 campos (nombre, apellido, correo, marca, giro, tiendas, ciudad, estado, web, Instagram, puesto, plan, sistema actual, dolor, mejor hora, canal, cuándo decide); vacío se llena con confianza ≥ 0.7, distinto se corrige solo si el lead lo dijo claro (corrige:true o ≥ 0.9) y es lead/oportunidad; marca nueva crea/enlaza la empresa; giro/tiendas se espejan en la empresa; todo cambio deja `propiedades.historial_datos` + actividad «Datos actualizados desde la conversación: …» con la cita textual.
- 2026-09-02 · misma decisión · había TRES fuentes ciegas: cuando el consultor contesta antes que el agente (el agente calla y no extraía nada), la minuta de llamada (transcripción) y la nota de una llamada del consultor → las tres pasan por extraerYAplicar (Haiku, ~$0.002 por extracción). El agente además recibe en el prompt TODO lo que el CRM sabe (marca, ciudad, web, correo, puesto, sistema) para detectar correcciones y reportarlas con corrige:true; un dato que usó para una acción (el correo con el que agenda) siempre va en `datos`.
- 2026-09-02 · dueño · «cuando corrijo el mensaje quiero poner qué debe considerar la IA (por ejemplo, depende de cuántas preguntas haga)» → campo «Qué debe considerar el agente» en Próximos envíos y en «Agente · Mejorar» del hilo; se guarda como `CRITERIO:` al frente de `ia_ejemplos.por_que`, el prompt de ejemplos lo enseña como «Criterio del dueño: …» y el ciclo nocturno (patrón → regla) ya lee por_que. Así aprende la REGLA, no solo el texto.
- 2026-09-02 · dueño · «voy agregando cosas que quiero ver en la reunión, ¿dónde se acumulan para el consultor?» → lista viva «Para la reunión» (`contacts.propiedades.temas_reunion`): el agente la llena solo (dato `tema_reunion`, con la frase del lead como evidencia), el consultor agrega/quita/palomea desde el inbox (sección arriba de Seguimiento), y se escribe en la descripción del evento de Google Calendar de la próxima cita (bloque idempotente «— Para la reunión —»). El agente la ve en el prompt y puede prometer con verdad «lo dejo anotado para el jueves».
- 2026-09-02 · construcción · el servidor de desarrollo local se cae porque el OOM killer del slice del usuario ya mató 8 procesos: conviven 2 `astro dev` (4321 mío y 4399 de otra sesión, 1-3 GB cada uno al compilar el CRM), `tsc` completo (1.4 GB), 6 procesos `claude` (~4 GB) y Chromium de Playwright. Remedio: un solo dev server compartido como servicio de usuario con MemoryMax y reinicio automático, QA visual contra producción/preview, y no correr tsc completo en paralelo con el dev server.
- 2026-09-02 · dueño (prueba: reagendó él mismo por la liga) · el sistema mandó la plantilla `sesion_reagendada` («tu sesión consultiva quedó reagendada para el 2026-09-04 a las 09:00», sin liga de Meet) y el agente tomó la cancelación de la cita vieja como una cancelación real («vi que se canceló la reunión…») → (1) reschedule.ts: con la ventana de 24 h abierta el aviso es NATURAL y COMPLETO con la voz del agente («vi que moviste la reunión, cancelé la del jueves…» + día, hora, Meet, correo, «los recordatorios ya son de la nueva fecha»), espejado en el inbox; la plantilla queda para ventana cerrada; (2) atenderCitas ignora la «cancelación» cuando hay cita futura vigente (fue reagenda); (3) despacharEnvios retira cualquier propuesta nacida ANTES de un cambio de agenda y vuelve a decidir con la cita vigente (`agente_reconsidera`). Verificado: los recordatorios filtran por estado confirmada/agendada (la vieja queda cancelada) y el evento viejo de Calendar se borra (deleteCalendarEvent), así que no llegan avisos dobles.
- 2026-09-02 · dueño · «hay respuestas que deben llevar imagen (precio, tallas y colores) y el agente debe poder mandar imágenes específicas» → GALERÍA DEL AGENTE (`ia_imagenes`: nombre, url, qué muestra, cuándo usarla, giros/temas, usos). El dueño la llena desde Próximos envíos (sube archivo al bucket wa-media o pega URL); el agente la ve en el prompt («IMÁGENES QUE PUEDES MANDAR») y devuelve `imagen.id` (máximo una por mensaje, solo si aporta, nunca dos seguidas); se manda como imagen con el texto de pie (≤1024) o texto + imagen; el dueño puede cambiarla/quitarla/adjuntarla en el envío pendiente y eso queda como ejemplo (`ia_ejemplos.imagen_id`, CRITERIO). Reglas del prompt en el guion, sección IMÁGENES.
- 2026-09-02 · dueño · «crea una pestaña Aprendizaje: lo que ya acepté y envié como aprobado, y una sub-pestaña de lo que falta por aprobar o analizar, donde pueda cambiar texto, poner imágenes y seguir optimizando» → pestaña Aprendizaje en Trabajo inteligente (`TrabajoAprendizaje.tsx` + `/api/crm/ti/aprendizaje`): POR REVISAR = ejemplos propuestos/dudosos del ciclo nocturno + mensajes que salieron solos al vencer la ventana (`ti_envios.aprobado_por` null) + pares agente/consultor sin veredicto; APROBADO = ejemplos aprobados + envíos aprobados explícitamente (aprobar/editar-y-enviar ahora marcan `aprobado_por`). Toda tarjeta edita texto, criterio (CRITERIO: en por_que) e imagen de la galería; aprobar un ejemplo reescrito lo convierte en `correccion_dueno`.
- 2026-09-02 · dueño (prueba) · la primera imagen del agente falló con 131053 «WebP image uploads are not currently supported»: WhatsApp solo acepta JPG/PNG y el sitio está en .webp → `asegurarFormatoWhatsApp` (sharp → JPG ≤1600 px al bucket wa-media) al agregar a la galería y, por si acaso, al despachar; si aun así WhatsApp la rechaza (estado failed en el espejo), `revisarFallbacks` reenvía el texto solo, marca la imagen con `error` (deja de ofrecerse) y avisa en la pestaña Sistema.
- 2026-09-02 · dueño · «cuando el lead manda varios mensajes seguidos, que se vea que los leyó todos y que exista la regla» → RÁFAGA: proponerRespuestas espera 75 s desde el último mensaje del lead antes de decidir (la marca no avanza sobre lo que espera; y no se re-propone lo ya atendido), decidirTurno arma la ráfaga (todo lo entrante desde nuestra última respuesta) y se la marca al modelo («N mensajes seguidos: contesta TODOS en una sola respuesta, en orden»); `salida.ultimos_mensajes` se muestra como lista numerada en Próximos envíos y Aprendizaje. Regla en el guion: VARIOS MENSAJES SEGUIDOS.
- 2026-09-02 · dueño · «que pueda agregar una o varias imágenes, PDF o video, con los formatos que permite Kapso, para entrenarlo bien en cuándo y cómo enviarlos» → la galería pasa a RECURSOS DEL AGENTE (`ia_imagenes.tipo` image|document|video, mime, bytes): reglas de WhatsApp en `REGLAS_WA` (JPG/PNG ≤5 MB con conversión; MP4/3GP ≤16 MB; PDF/Office ≤100 MB); subida DIRECTA a Storage con URL firmada (`/api/crm/ti/recurso` firmar→PUT→registrar) porque Vercel corta el body en 4.5 MB; hasta DOS adjuntos por respuesta (`ti_envios.adjuntos`, `ia_ejemplos.adjuntos`, `salida.adjuntos`); el despachador manda el texto como pie del primero (imagen/video, ≤1024) o texto + adjuntos, y espeja cada pieza; el guion dice cuál va cuándo (imagen = ver; PDF = consultar después; video = solo si lo pide o si el flujo se entiende mejor). El selector vive en Próximos envíos y en Aprendizaje (`RecursosAgente.tsx`).
- 2026-09-02 · dueño (prueba: «edité, adjunté imagen, aprobé y la tarjeta no se quitaba; no sé si se guardó») · dos ticks del observador traslapados propusieron DOS veces la misma respuesta con 7 s de diferencia (6 gemelas en 3 días): aprobó una y la gemela seguía ahí, con el texto original y sin imagen; además su edición + imagen no llegaron al servidor (ningún `correccion_dueno`, ningún ejemplo): lo más probable es la página vieja pidiendo chunks nuevos tras el deploy. Arreglos: índice único `uq_ti_envios_pendiente_por_lead` (un pendiente por lead; el segundo insert se descarta con `agente_duplicado_evitado`), y el panel se recarga solo ante `vite:preloadError`. Regla: tras cada deploy, recargar la pestaña antes de seguir probando.
- 2026-09-02 · dueño · «me debe dejar subir más de una imagen, ¿y si quiero mandar más fotos de eso?; que sea más visual» → subida MÚLTIPLE con arrastrar/soltar y vista previa; varias fotos comparten qué muestra/cuándo, se numeran (1/3…) y quedan como GRUPO (`ia_imagenes.grupo`); el selector ofrece «+ todas» por grupo; una respuesta lleva hasta 5 adjuntos (`MAX_ADJUNTOS`; WhatsApp los manda como mensajes seguidos con el texto en el primero). El agente sigue en 1-2 por mensaje salvo cuando el lead pide ver fotos de algo y existe el grupo: entonces manda el grupo completo.
- 2026-09-02 · dueño · «si cambio la respuesta debe quedar claro que se guardará la nueva; quiero poder mandar 2 mensajes; que el agente la vuelva a crear con mi criterio y así la versión final queda ahí mismo» → ficha de Aprendizaje en 6 pasos: (2) botón dinámico «Guardar mi versión y aprobar» + aviso de que se guarda TU versión; casilla «Mandarla en dos mensajes» (Mensaje 1 / Mensaje 2 → se guardan separados por una línea `---`; el despachador parte y espeja cada burbuja; el guion sabe partir con `---`); (3) regla + chips «qué corregir» + «qué evitar» (`EVITAR:` en por_que, visible en el prompt de ejemplos); (5) «Que el agente la reescriba» → `reescribirRespuesta()` (Opus, con contexto del lead, tu versión, regla, evitar, adjuntos) devuelve la versión y «qué cambió»; «Usar esta como versión final» la deja en el paso 2 marcada como reescrita por el agente; (6) decisión.
- 2026-09-02 · dueño · regla definitiva del ciclo de contacto: un INTENTO válido es un texto en horario (dentro de la ventana) o una plantilla que WhatsApp ENTREGÓ (delivered/read; fallida o «sent» sin entregar en 24 h no cuenta); entre intentos ≥ 1 día y en franja distinta (mañana/mediodía/tarde); TRES intentos válidos sin respuesta → llamada humana (ICP medio/alto) → sugerencia de descalificar (tarjeta; con rampa). Si el lead RESPONDE, el ciclo se reinicia y el objetivo pasa a agendar demo o llamada en los siguientes tres mensajes nuestros (al tercero el prompt le pide proponer directo demo/llamada con dos horarios; si aun así no agenda, tarjeta «responde pero no agenda»). Descalificado por silencio → lifecycle `descalificado` + `descarte_categoria=no_respondio` + `estatus_lead=sin_respuesta` (la secuencia mecánica de nutrición entra por ese estatus, sin IA). Estado en `agente_estado.intentos[]`, `fase`, `mensajes_agendar`.
- 2026-09-02 · dueño (prueba) · «mandé un mensaje y no hubo sugerencia»: el mensaje se mandó desde el INBOX del CRM con su usuario (saliente, autor Andrea Gutiérrez), no desde su teléfono; para el agente fue el consultor contestando y calló (regla «nunca dos voces»). Para probar al agente hay que escribir desde el teléfono del carril de pruebas.
- 2026-09-02 · dueño (S6) · PROMOCIONES VIGENTES: el 35 % en anual + implementación y migración sin costo (valor $9,500) se maneja siempre como algo especial y por tiempo limitado; la ventana rota sola (7 ↔ 10 días) al vencer. Vive en `ti_config.promociones` (sección «Promociones vigentes» en Próximos envíos). El agente recibe «PROMOCIÓN VIGENTE… hasta el {fecha}» y la regla de decirla UNA vez como plus al dar precio sin sonar vendedor; cuando un envío la menciona, se guarda en `contacts.propiedades.ofertas` (qué y hasta cuándo) + actividad «Se le ofreció…», el panel del inbox la muestra y el prompt la marca como OFERTA YA DICHA (no repetir; no prometer si venció). Se corrigió planes.ts: la migración NO es gratis siempre.
- 2026-09-02 · dueño (S1.1, S7.2) · TOQUE DE CIERRE DE VENTANA: si nuestro último mensaje dejó una pregunta u horarios sin responder y la ventana de 24 h del lead está por cerrarse (≥ 21.5 h desde SU último mensaje), sale un texto gratis una sola vez (cuenta como intento). Cada intento del ciclo lleva ÁNGULO OBLIGATORIO distinto: 1º repreguntar corto · 2º dato de valor (imagen/caso) · 3º llamada rápida con dos horarios reales.
- 2026-09-02 · dueño (S7.1) · LLAMADA DISCOVERY: tipo de reunión `llamada-discovery` (15 min, copia de la demo, categoría discovery, anfitriona Andrea); el agente ofrece dos horarios reales desde las 11:00 (`horariosParaLlamada`) y agenda con `accion.agendar_llamada` por el mismo /book (necesita correo). Se ofrece cuando no responde sobre el horario de la demo, pide hablar con alguien o como tercer ángulo; nunca si ya tiene demo.
- 2026-09-02 · dueño (S3.1) · PREPARACIÓN: el día antes de la demo (`prepararDemos`, origen `preparacion`), un mensaje natural que pide —si lo tiene— su Excel de inventario o tres productos con tallas y colores, desde el interés por su catálogo para una demo específica; si manda archivo, el agente agradece y lo anota como tema de reunión. Después de la demo el seguimiento es del consultor (S3.2): el agente no interviene.
- 2026-09-02 · dueño (S2, F4) · ÍNDICE DE VIDA 0–100 = ICP (30/18/6) + conversación (≤35) + recencia (≤20) + señales (10) − 8 por intento válido sin respuesta − 2 por plantilla no entregada − 8 por llamada sin resultado. Estados: seguir >60 · bajar ritmo 35–60 · sugerir descalificar <35 con ≥3 intentos o llamada · nutrición (cerrado) · esperando reunión (cita). `calificarLeads()` corre cada noche (ti-aprender) y desde «Evaluar ahora»; guarda `ti_perfil.indice_*` y abre la tarjeta con fundamentos (índice, intentos con franja y fecha, llamada, ángulos, plática real). RAMPA (`ti_config.rampa_descalificar`): cada veredicto humano se compara con la propuesta; 20 coincidencias seguidas → automático (avisa en Sistema; se puede volver al clic). Pestaña «Calificación»: Sugerencias de hoy / Todos los leads / Descalificados (fundamentos + Revivir).
- 2026-09-02 · dueño (S8, F5) · CONSUMO: pestaña «Consumo» (hoy / 7 d / 30 d / mes, proyección, por acción, top leads, citas del agente y costo por cita); presupuesto $300 USD/mes editable (`ti_config.presupuesto_ia_usd`); al 80 % solo AVISO en Sistema (una vez por mes; urgente al 100 %). Nada cambia solo.
- 2026-09-02 · dueño (S5, F8) · CANDADO DE CLIENTE explícito: si escribe un contacto con ciclo de vida `cliente`, el agente no contesta ni propone; se abre una tarea de soporte (familia `soporte`, una abierta por cliente) con su último mensaje. Las cadencias humanas/secuencias no se tocan.
- 2026-09-02 · dueño (S9, F6) · REVISIÓN DIARIA: cron `ti-revision` a las 8:00 CDMX (14:00 UTC) lee cada conversación de lead con mensaje de ayer (Sonnet, con el guion como tono) y guarda en `ti_revision` avance, resumen, qué funcionó, preguntas abiertas y UNA propuesta {tipo, texto listo, fundamento, riesgo}. Pestaña «Revisión diaria»: aceptar ejecuta (mensaje/adjunto/plantilla → envío pendiente con veto; llamada → tarea; cambiar ángulo → `angulo_sugerido` que usa el siguiente toque; descalificar → veredicto), rechazar pide el porqué y reinicia la rampa. Rampa `rampa_revision`: 20 aceptadas seguidas sin editar → las de bajo riesgo salen solas; descalificar y llamada siempre con clic. Resumen al dueño: notificación + WhatsApp a `dueno_whatsapp` (solo llega si su ventana de 24 h está abierta).
- 2026-09-02 · dueño (S4.1, F7) · PLANTILLAS POR MOMENTO: el agente crea solo (Meta aprueba) cinco familias marketing→utility —seguimiento, no_show, preparacion, promo, cierre— con el ángulo en {{2}}, mismo tope de 3 por día y apagado a 3 rechazos; `parListoPara(familia)` cae a seguimiento si la familia no está aprobada. El toque elige familia por momento (3er intento → cierre; pidió precio + promo vigente → promo). Tablero «Plantillas del agente» en Próximos envíos: enviadas / entregadas / leídas / respondieron en 48 h.
- 2026-09-02 · dueño · ALCANCE DEL SDR: el agente acompaña hasta que quede la demo o la llamada discovery (y la preparación previa). Si el lead ya TUVO su reunión (booking `asistio`) o ya tiene COTIZACIÓN (quotes por contact_id, no borrada), el seguimiento es del consultor: `fueraDelAlcanceSDR()` lo saca de respuestas, toques, citas, preparación, calificación (estado «con el consultor») y revisión diaria; si escribe, tarea para el consultor. Llamada discovery: SIEMPRE con ≥ 2 h de anticipación y solo hoy o mañana desde las 11:00 (`horariosParaLlamada`; el tipo de reunión tiene aviso mínimo 2 h y 2 días de adelanto).
- 2026-09-03 · bug review (4 revisores en paralelo: backend, lógica vs decisiones, ventas, comunicación) · 40+ hallazgos; los de código se corrigieron en un lote: el agente no leía mensajes de 17:00–02:00 CDMX (tope de 6 h en la marca → 36 h y marca que no salta eventos no leídos); despacho con reclamo atómico (`enviando`) para no mandar doble; try/catch por lead y por paso en el observador (un 529 ya no apaga el despacho); el reloj de silencio se moría tras la primera reconexión (`base_at` no se limpiaba) → reinicio completo; intentos en sombra/humano quedaban «pendientes de entrega» para siempre; inserts de ti_envios sin revisar error (intentos fantasma, preparación repetida pagando Opus); descalificado por silencio que escribe → revive; tarjetas de veredicto se retiran cuando el lead responde o agenda; el barrido de 48 h solo aplica la tarjeta del ciclo (índice y «no agenda» esperan clic); `lead_calificado` entra al SDR; calificación masiva con candados de sombra y sin pisar ti_config; reunión pasada sin marcar = fuera de alcance; preparación y no-show fuera de ventana salen como plantilla de su familia y la preparación solo de 10 a 18; la utility entregada cuenta como intento; reconsiderar por cambio REAL de la cita (snapshot), no por updated_at; 3 reintentos de agenda agotados no congelan al lead; hilo humano (consultor escribió hace < 4 h → el agente calla y deja tarea); SSRF cerrado en la lectura de la página del lead; mensajes del agente ya no se proyectan como «humano» (contaminaban las correcciones implícitas); rampa de veto cuenta correcciones con criterio; idempotencia del inbox por conversación y liberando la marca si falla; empresa solo por coincidencia exacta normalizada; plantillas: 3 rechazos apagan la creación pero no el refresco; tablero de plantillas en 3 consultas; promo: la fecha que manda es la que se le dijo al lead; revisión diaria: frescura al aceptar y error del insert visible.
- 2026-09-03 · bug review (ventas + comunicación) aplicado al guion y a los textos: regla de los TRES DATOS (giro + tiendas + un dolor → horarios en ese mismo mensaje); PONLE NÚMERO AL DOLOR (una pregunta de magnitud por conversación, devuelta como implicación) y CUÁNDO DECIDE; SEÑALES DE COMPRA (migración, tiempos, socio, Excel, integración, «cómo contrato» → horarios ya) y de ENFRIAMIENTO; marco de precio sin «tipos de descuento» (un número mensual y su anual, pegado a SU número); HORARIOS CERCANOS (hoy si hay > 2 h, nunca a más de 4 días; `horariosParaDemo` a 3 días); micro-compromiso al confirmar (qué quiere ver primero, desde dónde entra, socio invitado); correo opcional a la segunda; CIERRAS CON LO QUE SIGUE (adiós a «¿algo más en lo que te apoye?»); 12 reglas verificables de CÓMO HABLAS (4 líneas, una pregunta, sin admiraciones, sin muletillas, sin nombres internos, cero emojis); SILENCIO reescrito (toque 1 repreguntar con sus palabras · 2 dato de valor · 3 llamada sin despedida); PROMO vencida por lead (nunca fecha nueva); 12 OBJECIONES modelo; cliente → escalar. Textos fijos y notas reescritos (sin correo, ocupado, fallo, sin Meet, reintentos, ráfaga, tercer mensaje, preparación, no-show/cancelación, plantilla) y las 10 plantillas por familia con {{2}} en la misma posición; `reschedule.ts` ya no manda «Listo, Hola:»; wiki moda-first (se quitó «sirve a papelerías»); Vende también lista implementación/migración; pregunta de magnitud por giro y nota de mayoreo en la ficha de ropa.
- 2026-09-02 · dueño · «AGENTE IA» COMO ASIGNADO: miembro de sistema `agente-ia@sacscloud.com` (rol soporte por el check de roles; se identifica por correo). Cuando el agente manda un mensaje y nadie tiene el hilo, la conversación queda asignada a «Agente IA (piloto automático)» y el selector se pinta morado. Si un asesor escribe desde el inbox, la asignación pasa a él (evento en el hilo) y el agente se apaga en esa conversación; para reactivarlo se vuelve a elegir «Agente IA». Regla del agente: hilo asignado a humano → calla y deja tarea; asignado al agente → sigue aunque un humano haya escrito; sin asignar → regla de 4 h.
- 2026-09-03 · dueño (6 decisiones tras el review) · (1) CASOS: solo los de sacscloud.com/casos-de-exito (Casa Maca, La Bella Pandita, Sandmade, Liveshow ya viven en conocimiento/casos.ts; el guion prohíbe cualquier otro nombre o cifra). (2) CORREO OPCIONAL: /book acepta cita solo con WhatsApp (correo null → sin invitación por correo, sin asistente en Calendar; la confirmación, la liga y los recordatorios van por WhatsApp); el agente pide el correo una vez pero agenda igual. (3) OPT-OUT: acción `opt_out` del agente + detección por frase («no me escribas», «baja», «stop»…) → `wa_optout`, silenciar_ia, cerrado opt_out, se vetan pendientes, se terminan cadencias/secuencias/tareas y se confirma en una línea. (4) El agente responde 24/7 (observador `*/2 * * * *`); los toques de silencio siguen en horario laboral y las citas solo de lunes a viernes (`horariosParaDemo` descarta sábado y domingo). (5) LATIDO: cron `ti-latido` cada 15 min: sin tick del observador > 10 min → aviso urgente en Sistema + WhatsApp al dueño; sin entrantes > 3 h en horario hábil → alerta. CACHÉ DE PROMPT: guion+wiki+límites y ejemplos van en bloques `cache_control: ephemeral` (decidirTurno, reescribir y revisión). (6) RESULTADO DE LA DEMO: ya existía como deuda en «Datos» (`reunion_resultado`: 24 h después de la cita sin estado → tarea de dato «Se hizo / No llegó»).

## 2026-09-03 · Píldora del agente, modo sugerencia, reactivación y Datos agrupados

- **Píldora en la cabecera del hilo** (`PildoraAgente` en Hilo.tsx, API `ti/agente-hilo`): tres estados a la vista,
  ACTIVO (morado), OBSERVANDO (hilo de un consultor / modo sugerencia / sombra) y APAGADO AQUÍ. Apagar veta los
  envíos pendientes y marca `ti_perfil.silenciar_ia`. Es la única palanca por conversación; «Silenciar IA» de la
  pestaña es global.
- **Consultor responde → el agente se apaga en ese hilo** (ya era así) y ahora el consultor puede pedir «que me
  sugiera»: `agente_estado.modo = 'sugerir'`. El agente decide como siempre pero inserta `ti_envios` con
  `estado='sugerencia'` (nunca se despacha; el índice único solo cubre `pendiente`). En el inbox aparece arriba
  del compositor con «Usar en el compositor» (lo pone como borrador y remonta el Composer con `composerN`) o
  «Descartar» (queda como veto con motivo → lección).
- **Reactivación de leads viejos** (`reactivacion.ts`, tabla `ti_reactivacion`, vista
  `v_ti_reactivacion_candidatos`, cron 9:30 CDMX L–V): segmento `intencion` (pidió precio/demo/cotización) y
  `conversacion` (preguntó y no siguió); 60–365 días sin hablar; fuera opt-out, «no era lead», con cotización,
  con reunión hecha/agendada, silenciados. Redacta Opus con instrucción implícita (reconocer el tiempo, retomar SU
  pregunta, una novedad, una pregunta fácil, cero pitch, ≤300 caracteres porque va en el `{{2}}` de la plantilla
  `ti_reactivacion_*_v1`; mientras Meta no la apruebe cae a la de seguimiento). Aprobar programa el envío en el
  siguiente hueco (máx. 15/día, horas 10–18 distintas, sin fines de semana) y arranca el ciclo del agente
  (`ciclo+1`, intento 1 = esta plantilla). Rampa `rampa_reactivacion`: 20 aprobadas seguidas sin editar → salen
  solas con 10 min de veto; editar o rechazar la reinicia. Una sola fila por lead (índice parcial).
- **Trampa medida:** Opus a veces devuelve bloques que no son `text` primero; leer `content[0].text` daba vacío
  y la propuesta se perdía en silencio. Siempre `content.filter(type==='text')`.
- **Datos agrupados** (`TrabajoDatos.tsx`): subpestañas por tipo (Facturación, Negocio, Cuenta Sacs, Reunión,
  Contacto) por `campo_clave`, y ficha por cliente con TODOS sus datos pendientes juntos (aunque sean de otro
  grupo), cada uno con su etiqueta y su «por qué». «Guardar los que llené» manda cada tarea por separado al mismo
  endpoint de siempre.
- **Revisión de las 14:00** (`?modo=ventanas`, cron 20:00 UTC L–V): solo conversaciones cuya ventana de 24 h
  cierra hoy (último mensaje del lead hace 16–22 h) y donde la última palabra fue nuestra. Misma tabla
  `ti_revision` (única por día+lead: no duplica las de la mañana).

## 2026-09-03 · Contexto del lead, Embudo y Finanzas (ver PLAN-EMBUDO-FINANZAS.md)

- **Drawer «Ver conversación»** (`crm/ti/ContextoLead.tsx`, API `ti/contexto`): los últimos 20 mensajes de TODAS las
  conversaciones del lead, marcando quién habló (lead / Agente IA / equipo: el agente se reconoce por el
  `kapso_message_id` en `ti_envios`), llamadas con minuta, notas, citas, cotizaciones y `ti_perfil.datos`. Las
  tarjetas le pasan `acciones` para decidir sin cerrar. Está en Revisión diaria, Próximos envíos, Aprendizaje,
  Reactivación y en el desglose del Embudo.
- **Embudo** (`v_embudo_contacto` + `api/crm/embudo` + `EmbudoTab`): las definiciones viven en la vista y en
  `METRICAS` del tab; si cambian, cambiar los dos. Conversación real = ≥2 entrantes y ≥2 salientes o llamada
  ≥120 s. El canal se decide en `CANALES` de la API (TikTok = fuente `tiktok%` o utm_source tiktok). La
  inversión se guarda en `marketing_gastos` (existía vacía) y se prorratea al rango.
- **Finanzas** (`lib/crm/finanzas.ts`): ingresos = `payments.estado='confirmado'` del mes; por cobrar =
  suscripciones activas/pendientes/programadas con `proxima_factura` en el mes y sin pago ligado; comisiones =
  `comision_lineas` del mes (si capturas un gasto de categoría `comision`, las calculadas NO se suman doble);
  pipeline = deals abiertos ponderados por `probabilidad` (30 % si viene vacía). `fin_gastos.aplicaMes`: mensual
  entre inicio/fin, anual mismo mes que inicio, único solo su mes. El cierre (`fin_cierres`) congela; el reporte
  anual mezcla cierres y meses vivos.

## 2026-09-03 (tarde) · La minuta manda, y lo que sale de ella

- **La minuta de descubrimiento ya existía** (`MinutaLead.tsx` + `reuniones/estructurar`): pegas transcripción o notas y
  la IA saca siete campos, requerimientos cotizables y la ficha. Lo que faltaba era la DECISIÓN: ahora la IA propone y
  el consultor confirma «qué sigue» (cotizar / segunda reunión / retomar en fecha / sin interés). Se guarda en
  `bookings.minuta.decision` y `reuniones-decision.ts` la aplica: cotizar → cadena de 48 h; segunda reunión → tarea de
  agendar sin exigir cotización; retomar → `agente_estado.pausa_hasta` + `retomar{fecha,motivo}` y el agente vuelve solo
  (`fueraDelAlcanceSDR` lo deja pasar si no hubo cotización ni reunión después); sin interés → descalificado + deal
  perdido + agente cerrado.
- **La tarea «Minuta» de Datos abre ese mismo modal** (payload `minuta_ia` + `reunion`/`lead`); al guardar se cierra la
  tarea con `detalle.ya_escrito` para NO pisar la minuta estructurada con texto plano.
- **Cancelar o reagendar exige motivo** en las dos puertas (`reuniones` PATCH y `bookings` PUT) y guarda `cancelado_por`
  lead/sacs: el Embudo ya distingue «Canceló el lead».
- **Cotización aceptada sin pago** (7 d) es su propio eslabón (`cotizacion_cobro`); en Finanzas es «por cobrar de venta
  nueva» y sale del pipeline ponderado. Las `expired` entran al flujo de 30 días.
- **RFC/razón social bloqueantes al pagar**: con pago confirmado en 30 días suben a prioridad 3 y se piden juntos; el
  resto sigue en lote de 15.
- **Demo sin consultor** (la agendó el agente): se asigna `consultor_default` y avisa en Sistema ANTES de la reunión.
- **Puntualidad del consultor** en Calificación → Consultores: % a tiempo y horas promedio por eslabón, últimos 60 días.
- **Finanzas**: gastos recurrentes del dueño sembrados (`seed-fin-gastos-2026-09.sql`: nómina en dos quincenas,
  Anthropic ×4, Google anual en diciembre, GitHub, Asana, Intercom, Supabase ×2); `probable` = variable estimada; la
  publicidad real capturada en Embudo sustituye al estimado; comisiones = cortes con `paga_el` en el mes (los lunes),
  con «aceptado por la vendedora» = `recibido_at`.

## 2026-09-03 (noche) · Adeudos, atrasados y la regla del push único

- **Adeudos** (`fin_adeudos` + `fin_adeudos_abonos`): total, saldo (total − abonos), cuota del mes (fija o saldo ÷ meses
  hasta la fecha límite), «toca este mes» = cuota + lo atrasado acumulado (esperado acumulado − pagado), abonos por
  mes. Entra al total de gastos del mes por lo que TOCA, y al cierre por lo ABONADO.
- **Atrasados**: gasto fijo de los 3 meses anteriores sin palomita se junta en el mes actual (banner rojo, «Ya lo
  pagué» lo marca en su mes original). Los variables (`probable`) no se arrastran.
- **Tabla de gastos**: días para pagar (vence = día de cobro del mes o fin de mes), orden por columna y drawer con pago
  (monto real, fecha, nota) e historial (promedio, variación del último pago, % a tiempo).
- **Regla nueva del repo (CLAUDE.md):** cada push para los crons ~16 min. Commitear todo y hacer UN push por bloque.
  Hoy hubo 18 pushes en dos horas: por eso el latido avisó.

## 2026-09-04 · Reenganche de los que callaron (frente A)

- **Por qué no entraban:** el universo de `tocarSilencios` eran los envíos DEL AGENTE; las conversaciones contestadas
  por humanos/respond.io y calladas después no tenían envío y nunca entraban. `enrolarReenganche` (cron horario
  `ti-reenganche`) las marca en `agente_estado.reenganche` con `base_at` = nuestro último mensaje; el universo ahora
  las suma. Primer barrido: 39 candidatas, 38 enroladas (una en «rezagado», fuera de ETAPAS_SDR).
- **El primer toque es RETOMAR, no un toque frío:** nota `REENGANCHE` en el prompt (retoma su último tema, novedad
  solo si sirve, pregunta fácil, empresa/giro reales, cero pitch). Sale con `origen: 'reenganche'`. Muestra real:
  «me quedé con la duda de qué vende La Imperial; si es ropa, calzado o joyería, te platico corto cómo se lleva el
  inventario por talla y color sin libreta ni Excel.»
- **Práctica:** en sombra el toque queda pendiente; «Aprobar y enviar» (Torre, Próximos envíos o el panel del inbox)
  fuerza el envío real (`despacharEnvios({forzar})`). Cada aprobación/edición/veto ya se guarda en `ti_envios`.
- **Plan visible:** `planSeguimiento()` (agente-hilo → `plan`) en el panel del inbox: último, próximo (con
  «Aprobar y enviar» / «Detener»), qué pasa si no contesta y la probabilidad medida (`tasasRespuesta`: % de leads que
  escribieron en 72 h tras el intento k; arranca con 28/16/9 hasta tener 5 muestras).
- **Inbox:** vista «Mensajes programados» (`fi=programados`, `counts.programados`) y chip «Programado HH:MM» en la
  lista. La franja «ya toca» del plan no muestra fechas pasadas.

## 2026-09-04 · Finanzas como grupo (frente B)

- Cuatro páginas (`fin-gastos`, `fin-adeudos`, `fin-ingresos`, `fin-cierre`) sobre el MISMO componente
  (`FinanzasTab pagina=…`) y el mismo motor: no hay dos verdades. `?tab=finanzas` sigue abriendo Gastos.
- **Flujo semanal** (`flujoSemanal` en finanzas.ts): semanas lunes–domingo recortadas al mes; entradas = cobrado neto
  real + renovaciones por `proxima_factura` + venta aceptada a +7 días; salidas = gastos por día de cobro (pagados en su
  fecha real), adeudos por día de pago, cortes por `paga_el`, atrasados en la semana 1. Septiembre: la semana 3 y la 5
  concentran nómina, Anthropic y SAT; el acumulado cierra en −97 mil si no entra más.
- **Neto real**: `payments.neto`/`comision` cuando existen; la utilidad usa el neto y el KPI muestra el bruto.
- **Adeudos** tiene proyección (meses que faltan y mes de liquidación contra la fecha límite).
- **Cierre guiado**: checklist de lo pendiente antes del botón. **Alertas** diarias 8:00 (`fin-alertas`): vence en ≤3
  días, adeudo por abonar, corte del lunes, atrasados.

## 2026-09-04 · Pipeline con contexto (frente C)

- Probabilidad por etapa (calificación 20, demo agendada 40, demo realizada 50, cotización 60, negociación 75,
  aceptada 90); un valor manual distinto de 20 se respeta (20 era el default plano). El ponderado real pasó de 52 mil a
  125 mil: antes todo valía 20 %.
- La fila trae: cliente nuevo vs expansión (empresa con suscripción activa), lead desde, canal, vistas y última
  apertura de la cotización, última actividad, siguiente paso, días en etapa (estancada > 14), duplicados por contacto,
  fecha de cierre (vencida / este mes / sin fecha). Filtros por tipo, vendedor, etapa y orden.
- Forecast por vendedor (comprometido = prob ≥ 60) y conversión por canal a 90 días. Fecha de cierre en el mes →
  «esperado del pipeline» en Ingresos (ponderado), separado de renovaciones y aceptadas.
- Modal de la oportunidad (`?oportunidad=id`): editar etapa/probabilidad/fecha de cierre/siguiente paso (perder exige
  motivo; cada cambio deja actividad `deal_cambio`), cotización con conceptos y aperturas, últimas actividades, otras
  oportunidades del mismo contacto. Clic en el contacto abre `LeadDrawer`.
- Se asignó dueño a 18 oportunidades abiertas que estaban sin vendedor (owner del contacto o consultor por default).

## 2026-09-04 · Lo que no se pagó, y el gasto flexible

- **Regla por defecto:** un gasto fijo sin palomita se RECORRE: aparece en «Atrasado de meses anteriores» del mes
  siguiente y suma al total. Las cuotas de adeudo no pagadas se ACUMULAN al «toca este mes» siguiente. Nada se pierde.
- **Decisiones** (`fin_gastos_decisiones`, `fin_adeudos_decisiones`, por gasto/adeudo y mes original): `recorrer`
  (default explícito), `prorroga` (nueva fecha: el renglón aparece en ESE mes como «prórroga de YYYY-MM», se paga contra
  su mes original, no cuenta como atraso; en adeudos, el monto prorrogado se descuenta del atraso hasta su mes),
  `condonado` (gasto: desaparece; adeudo: abono tipo `condonacion` que baja el saldo), `no_aplica` (gasto: desaparece
  sin rastro). Se deciden en Cierre → «Qué hago con lo que no pagué», o desde el banner de atrasados.
- **«Todos» = todo el mes:** gastos + adeudos que tocan + cortes de comisión + atrasados, y sus renglones aparecen en la
  tabla (los de adeudo/comisión llevan a su pestaña). Antes solo sumaba gastos y por eso «no cuadraba» con el KPI.
- **Gasto flexible:** categoría libre (datalist), USD con tipo de cambio (se guarda original y MXN), periodicidad semanal
  (×4) / quincenal (×2) / bimestral / trimestral / semestral / anual / única, varios días de cobro, método y cuenta de
  pago, deducible, centro de costo (empresa / personal / mixto), rango mín–máx, aviso N días antes, pausar hasta un mes,
  etiquetas, activo. `aplicaMes` entiende las periodicidades nuevas y la pausa; `ocurrenciasMes` multiplica el monto.
- **Trampa que costó el archivo:** `open(F,'w').write(open(F).read())` en Python trunca ANTES de leer: el motor quedó
  vacío y hubo que restaurarlo de git. Nunca abrir para escribir el mismo archivo que se va a leer en la misma línea.

## 2026-09-04 · Señal, cadencia o decisión (aprobado por el dueño)

- **Tres naturalezas:** señal (informa; `ti_senales`, feed y contexto; nunca tarjeta), cadencia (la lleva el agente con
  tope), decisión (tarjeta en la cola). Regla: si pide juicio humano está en la cola; si solo se mira, en señales.
- **Cotización:** la apertura es señal (`observador` ya no crea la llamada «está viendo su cotización»). Intención =
  3+ aperturas en 24 h, ≥ 5 min o reabrir tras 3 días → `toqueCotizacion(..., 'intencion')`: UN mensaje por cotización
  (`agente_estado.cot_toques[quote_id]`). Día 3 usa ese único si no se gastó; día 7 es un segundo toque. Llamada humana
  a los 7 días solo si el lead respondió tras la cotización o el total ≥ `umbral_llamada_cotizacion` (20,000). Día 14
  (veredicto) y día 30 (dormida) siguen siendo decisión.
- **Anti-pesadez:** nunca dos automáticos en 24 h al mismo lead; hilo humano → el agente calla; pendiente previo → no
  se apila.
- **Apagados con el agente activo:** la llamada de bienvenida humana (enrolar T1) y «conversación viva sin cita».
  `demo_cotiza` pasó de WhatsApp a acción «cotizar». Se retiraron 18 tareas de ruido (14 WhatsApp libres, 4 llamadas).
- **Jerarquía de la cola (torre.ts `nivelDe`):** 1 te está esperando · 2 dinero en la mesa (aceptada sin pago, RFC tras
  pago, cotización con respuesta) · 3 aprobaciones del agente · 4 cadena de la reunión · 5 rescate · 6 cierre · 7 datos.
  La cola se agrupa por nivel; dentro, por urgencia y hora. Pulso «Señales hoy» abre el feed en la columna derecha.

## 2026-09-04 · Trabajo inteligente v2: Torre · Informes · Ajustes

- La sección tiene tres pestañas. **Torre** (default, pantalla completa) trae TODO lo que pide decisión: envíos,
  revisión, reactivación, tareas, datos de higiene (nivel 7) y ejemplos de aprendizaje por revisar (nivel 6). La cola se
  filtra con dos selects (Tipo, Cuándo) y, en Datos, «Agrupar por cliente» abre la ficha de `TrabajoDatos` en el centro.
  **Informes**: Leads (Calificación), Revisión diaria, Biblioteca (Aprendizaje aprobado), Consumo. **Ajustes del
  agente**: Herramientas (`TrabajoEnvios soloHerramientas`: promociones, recursos, plantillas) y Reactivación.
- Se retiraron la barra «Tarea 1 de N · atrasadas · Ver fila · Silenciar IA» y las pestañas El día, Datos, Próximos
  envíos, Aprendizaje, Calificación, Revisión, Reactivación y Consumo como entradas de primer nivel. Los componentes
  siguen existiendo (se reutilizan dentro de Informes/Ajustes); `vistaTab` queda como resto sin uso hasta limpiarlo.
- Regla: si pide decisión → cola de la Torre; si solo se mira → Informes; si se configura → Ajustes. Señales → pulso y feed.

## 2026-09-04 · Semáforo de automáticos (para que los flujos no se crucen)

- `lib/crm/ti/semaforo.ts` → `puedeAutomatico(contactId, {telefono, origen, aprobadoHumano})`. Lo consultan el toque de
  silencio, el toque por cotización, la aprobación de reactivación (solo dedupe) y la COMPUERTA FINAL del despachador
  (todo automático sin aprobación humana vuelve a pasar antes de salir; si no pasa, queda `reemplazado` con el motivo).
  Reglas: horas silenciosas 21–8 CDMX (solo se responde), opt-out/píldora, humano escribió < 4 h, un automático cada
  24 h por lead Y por teléfono, tope semanal (3), no apilar pendientes del mismo teléfono. Config en ti_config:
  `silencio_automaticos`, `tope_semanal_automaticos`.
- `alResponderElLead`: cuando el lead escribe, todo lo automático programado para él pasa a `reemplazado`; solo sale la
  respuesta. Va en `proponerRespuestas`.
- Apagados con el agente activo: autorrespuestas del inbox (bienvenida / fuera de horario: `alRecibirMensaje` sale
  temprano), pasos de WhatsApp de la cadencia humana (antes solo en modo vivo; ahora con el agente activo) y la válvula.
  La cadencia humana queda para correo y las llamadas T1/T2 si no hay agente.
- Difusiones: la audiencia excluye a los leads en ciclo del agente (`enCicloAgente`).

## 2026-09-03 · Seguimiento: paridad 9/10 antes de la autonomía

- **Regla nueva:** mientras `agente_modo === 'sombra'` (entrenamiento), TODO lo que el agente redacta para un lead
  real nace `estado: 'sugerencia'` (helper `nace(cfg, telefono)` en agente.ts; los teléfonos de prueba siguen
  naciendo `pendiente`). Antes nacía `pendiente` y al vencer se marcaba `sombra` en silencio: nadie lo veía.
- **Una decisión, tres salidas** (`decidirSugerencia` en seguimiento.ts): enviar (10) · modificar → «Enviar con
  modificaciones» (9/8/6/4/2 según el parecido, Dice sobre bigramas) · rechazar con razón (0). Si el consultor
  contestó por su cuenta (teléfono/otra sesión) el barrido `barrerSugerencias` compara y califica como «humano»;
  a los 3 días sin decisión la sugerencia expira sin calificar.
- **La paridad** = promedio de las últimas `paridad_ventana` (300) filas de `ti_calificaciones` contra `paridad_meta`
  (9). Ventana llena + promedio ≥ meta ⇒ `revisarParidad` pone `agente_modo: 'vivo'` una sola vez, avisa y lo
  registra (`paridad_alcanzada_at`). El dueño lo regresa desde Configuración → Agente IA → Seguimiento.
- **Aprende de las tres:** modificar → `ia_ejemplos` fuente `correccion_dueno` aprobado (entra al few-shot con
  CRITERIO); rechazar → `ia_ejemplos` fuente `rechazo_consultor` estado_rev `rechazado` + bloque nuevo en
  `ejemplosAprobados`: «LO QUE LOS CONSULTORES RECHAZARON (NO contestes así)»; también `ia_log agente_vetado`
  para el ciclo nocturno. Enviar tal cual NO crea ejemplo (inundaría el few-shot y taparía las correcciones).
- **Compuerta del inbox** (Hilo.tsx): con sugerencia pendiente el `<Composer>` NO se monta; en su lugar va
  `DecisionSugerencia` compacto. Rechazar libera el compositor (estado local `liberadas`). El mismo componente
  vive en el panel Seguimiento (una tarjeta a la vez, atajos E/M/R).
- **Trampa de QA vista hoy:** una sugerencia vieja (10 h) que ya había contestado un humano fue calificada 2/10
  por el barrido apenas se convirtió: es lo correcto, pero al sembrar datos de prueba hay que sembrar en la
  conversación de prueba del dueño y borrarlos después, no reciclar filas `sombra` reales.
- **Índice único «un pendiente por lead»** solo cubre `pendiente`: para no acumular sugerencias por lead, el
  reemplazo por nuevo mensaje (`previos`) y el check de cotización ahora incluyen `sugerencia`.
- **Ajustes del dueño (mismo día):** ventana **100**, no 300; y al llegar a la meta NO se activa solo: se marca
  `paridad_lista_at`, avisa y aparece el botón «Activar respuestas automáticas» (config `agente_modo: 'vivo'`, solo
  founder). En entrenamiento también se sugiere en los hilos que lleva un consultor (antes «agente_calla»).
- **Verificado con turno real (3-sep):** una corrección sembrada con imagen de la galería + un rechazo → el few-shot
  incluyó ambos y `decidirTurno` adjuntó esa imagen en un caso parecido. Script: scratchpad/aprende-test.mts (siembra,
  prueba y borra). Si vuelve a dudarse «¿sí aprende?», correr eso antes de tocar prompts.
- Lo que el consultor manda por su cuenta (texto + media_url) se guarda en la calificación y como ejemplo «dudoso»;
  los rechazos entran al patrón→regla del ciclo nocturno (fuente `rechazo_consultor`).

## 2026-09-03 · El ciclo de aprendizaje CERRADO (reglas como datos, prueba antes de aplicar)

- **Guion, wiki y límites viven en `ti_guion_versiones`** (la constante en código es la versión 0 de respaldo). `guionActual()` y
  `bloqueSistemaBase()` en guion-datos.ts arman el primer bloque del prompt; se cachea 60 s por instancia. Editor en
  Configuración → Agente IA → «Guion, wiki y límites» (solo founder guarda; cada guardado = versión nueva; «cargar en el editor»
  restaura).
- **Reglas** = filas de `ti_reglas` (clave regla_guion) con `texto`. Ciclo: propuesta (nocturna por patrón, redactada por Opus; o
  escrita por una persona en Seguimiento → Reglas) → **prueba** (`evaluarRegla`: hasta 24 casos aprobados, el agente responde con
  y sin la regla usando Opus, un juez Sonnet califica 1-10 y marca si la respuesta VIOLA la regla) → activa (bloque «REGLAS
  VIGENTES» con fecha) o retirada. Si la prueba da delta negativo, aprobar exige `forzar`. Cualquier usuario del CRM propone,
  prueba y activa (decisión del dueño); queda `decidida_por`.
- **Ejemplos por parecido:** RPC `ti_ejemplos_parecidos` (pg_trgm+unaccent sobre mensaje_lead+situación, +0.15 misma etapa, +0.10
  corrección humana) trae 8, más las 4 correcciones más recientes siempre. `ejemplosAprobados(estado, mensaje)`; sin mensaje cae al
  orden por fecha.
- **Crons:** `ti-aprender` (08:00 UTC) quedó ligero: paridad (sustituyó a la rampa del veto), no-era-lead, huecos wiki,
  correcciones implícitas, patrón→regla + redacción Opus, citas. `ti-curador` (08:25 UTC) hace lo pesado: pares, curador de
  dudosos/propuestos con 7+ días (Sonnet), higiene (duplicados ≥0.92 → «duplicado»; promos vencidas → «caducado»), prueba de hasta 2
  reglas sin prueba, **resultados** (¿contestó en 48 h? ¿agendó en 7 d? en ti_calificaciones.resultado y ti_envios.resultado),
  calificación masiva, presupuesto. Cada corrida = fila en `ti_corridas` con ms y error por paso; el latido avisa si >26 h sin
  corrida o si terminó con error.
- **Medido el 3-sep en local:** aprender 12 s; curador 92 s (la prueba de 2 reglas = 74 s). La regla nocturna de «agendada» (un
  solo mensaje corto) pasó de 3.73 a 8.41 y de 21 a 1 violaciones en 22 casos; la de «descubriendo» EMPEORÓ (7.14 → 6.62): la
  prueba sirve justo para eso.
- **Momento de la oferta:** cada vez que el agente propone demo o llamada se registra `ia_log oferta_siguiente_paso` con turno y
  qué sabía del lead (giro, tiendas, dolor, interés). Con eso se cruza después contra respuesta/cita.
- Métricas de ángulos (`metricas_silencio`) se retiraron: nadie las leía; el resultado real por origen sale de `resumenResultados`.

## 2026-09-03 (tarde) · «Adelante full»: reglas activas, momento de la oferta, autopsias, muestreo ciego

- **5 reglas vigentes** (todas probadas con-vs-sin): no ofrecer demo sin giro+tiendas+necesidad (6.7 vs 6.2) · agendada: un
  solo mensaje corto (8.4 vs 3.7) · demo solo con señal en el último mensaje, versión corta (6.9 vs 6.1) · no insistir con la
  demo (6.5 vs 6.1) · llamada en vez de demo cuando desconfía/encadena precios (6.3 vs 5.5). Rechazadas: «descubriendo: una
  pregunta» (empeoró), «nuevo: no activar demo» (empeoró), «momento con dos condiciones» (empeoró), «empatía antes de proponer»
  (+0.29, marginal). **Criterio de activación automática:** delta ≥ 0.3 y violaciones ≤ sin+1 (una violación de más es ruido
  del juez; la primera pasada con «≤ sin» rechazó 3 reglas que sí mejoraban).
- **Momento de la oferta:** `ia_log oferta_siguiente_paso` lleva `sabia` desde ti_perfil.intenciones (giro, tiendas, dolor,
  sistema_actual) + `senal` del último mensaje. `medirOfertas` (curador) guarda `cfg.metricas_ofertas` (30 d: prematuras %, por
  turno, responden/agendan con datos vs sin); Seguimiento lo muestra junto con «rechazos por momento» (14 d vs 14 d).
- **Señales conversacionales:** `senalDeInteres()` (precio / quiere_ver / interes) → `ti_senales` tipo interes_conversacion en
  cada turno del lead. Salen en el feed de señales de la Torre.
- **Autopsias** (`autopsias(max, dias)` en biblioteca.ts, curador 5/noche sobre 2 días): deals cerrada_ganada/perdida y bookings
  no_asistio → Opus lee la conversación completa → ia_log autopsia + ejemplo (ganada: fuente autopsia, propuesta; perdida/no-show:
  fuente autopsia_perdida, rechazado → entra al bloque «no contestes así») + regla propuesta si aplica. Probado con 60 días: 3
  autopsias, 3 lecciones útiles (p. ej. «cuando el lead ya dijo que sí, el método de pago nunca es barrera: link de tarjeta en el
  mismo minuto»).
- **Muestreo ciego + rampa de bajada:** en vivo, 10 % de los envíos del agente → ia_ejemplos fuente muestreo estado_rev pendiente
  (Torre); al decidirlo, `aprendizaje.ts` inserta la calificación (10/6/0). `revisarParidad` en vivo: últimas 30 < 8 → vuelve a
  sombra y avisa (`paridad_bajada_at`).
- **Criterio inferido:** al modificar sin escribir criterio, Sonnet deduce la regla del cambio (`inferirCriterio`) y se guarda
  como CRITERIO; el toast lo enseña («El agente entendió: …»).
- Recordatorio de revisión semanal de reglas: lunes en ti-aprender (notificación con vigentes/propuestas).

## 2026-09-04 · Seguimiento de 1 a 4 días (la ventana corta, clasificada)

- **Vista `v_ti_seguimiento_corto`**: lo último fue nuestro, entre 20 h y 4 días, etapa lead/lead_calificado/oportunidad/rezagado,
  sin cita futura ni asistida, sin opt-out. Expone `envio_id/envio_origen/envio_mensaje`: el reloj de silencio suele haber dejado ya
  un mensaje genérico de reenganche para esos mismos leads (25 de 32 el primer día), y la clasificación decide si lo reemplaza.
- **El criterio no es el tiempo, es en qué quedó.** `clasificar()` (Opus, lee el hilo completo) devuelve una de seis situaciones:
  nunca_respondio · quedo_en_demo · falta_dato · pregunto_precio · pensandolo · dijo_no, más `falta`, `angulo` y `resumen`.
  Cada situación trae su propio `comoEscribir` que entra como nota a `decidirTurno` (así el mensaje pasa por guion + reglas
  vigentes + ejemplos por parecido).
- **`dijo_no` NO recibe mensaje:** se veta lo que hubiera en la fila y se propone descalificar como tarea de veredicto en la Torre.
- Todo nace `sugerencia` (en entrenamiento): se evalúa en Seguimiento o en la compuerta del inbox. La tarjeta muestra la
  situación, el resumen de en qué quedó y qué falta. Selector por tipo de mensaje en la cola (la cola mezcla respuestas,
  seguimientos y cotizaciones).
- **Trampa medida:** la primera versión reprocesaba a los mismos leads en cada pasada (la vista los sigue devolviendo porque
  ahora tienen envío en fila) y reemplazaba su propio mensaje: ~$0.11 por lead tirados. Se salta a los que ya tienen
  `envio_origen='seguimiento'`; el botón dice cuántos faltan y se apaga cuando no queda ninguno.
- Costo real medido: ~$0.11 por lead (clasificación Opus + redacción Opus).
- **Ventana de 24 h (4-sep):** enviar una sugerencia con la ventana cerrada reventaba con «Kapso HTTP 422: Cannot send
  non-template messages outside the 24-hour window» en la cara del consultor. Ahora `decidirSugerencia` detecta la ventana
  antes de despachar, le cuelga al envío la plantilla aprobada de la familia que toca y guarda el texto como
  `puente_pendiente`: sale la plantilla y, en cuanto el lead conteste, le llega el mensaje completo. La tarjeta lo avisa
  antes de que le den a Enviar y el error de Kapso ya se traduce a español.
- **Bug de registro silencioso:** `ia_log` tiene `costo_usd`, no `costo`. Dos inserts (seguimiento_clasifica, regla_probada)
  usaban `costo` y fallaban en silencio porque el error iba a un `.then(()=>{},()=>{})`. Si un log «no aparece», revisar
  primero los nombres de columna, no la lógica.
- **El aprendizaje amplifica los errores de dedo:** el dueño editó un mensaje con «Buenoooooos díaa»; el criterio inferido
  guardó «alarga el saludo de forma más cálida» y a las pocas horas tres mensajes decían «Buenos díaaas». Se corrigió solo la
  ortografía (se respetó el saludo largo, que sí era intención). Vale la pena revisar los ejemplos aprobados que introducen
  formas raras antes de que se repliquen.

## 2026-09-04 · «Por descalificar» como sección propia
- Vive en Trabajo inteligente, debajo de Seguimiento (`ti-descalificar` → `TrabajoPanel inicial="descalificar"`).
- `colaDescalificar()` junta las tareas de veredicto con `payload.propuesta === 'descalificar'` (índice de vida y
  clasificador `dijo_no`) y les arma el contexto: qué dijo, cuánto lleva, cuántas veces contestó, cuántos mensajes le
  mandamos, si dejó cotización o demo, y las razones de por qué la decisión importa (dinero que sale del pipeline vs. costo
  de dejarlo abierto).
- Las decisiones se aplican por `/api/crm/ti/tarea` (el mismo camino que la Torre), así la rampa de descalificación sigue
  contando coincidencias hacia el automático.
- **El saludo cálido es intención del dueño, no un typo (4-sep):** «Holaaa», «Buenooos días». Quedó como regla vigente
  («de vez en cuando, uno de cada tres, nunca dos seguidas al mismo lead; alarga solo la vocal del saludo y el resto bien
  escrito»). La prueba con-vs-sin dio neutro (7.17 vs 7.25, cero violaciones de un lado y del otro): se activó forzada
  porque es una decisión de estilo del dueño, no una hipótesis que el juez deba premiar. Lo único que sí se corrigió del
  ejemplo original fue «díaa» → «días».

## 2026-09-04 · Reactivación v2 (4 segmentos + tamaño + investigación) y el selector de plantilla

- **Cuatro segmentos, no dos** (`v_ti_reactivacion_candidatos` v2): `sin_respuesta` (nunca contestó por WhatsApp),
  `ambiguo` (solo saludó, ≤2 entrantes y ninguno >25 caracteres), `conversacion`, `intencion`. Cada uno con su
  `comoEscribir` en SEGMENTOS. Ojo con el matiz: «nunca contestó» es **por WhatsApp**; puede haber historia real por
  otro canal (agendó demo, formulario) y esa SÍ se cita con fecha. La primera redacción del prompt lo prohibía y
  empeoraba los mensajes.
- **El reloj cambia:** si nunca contestó, la ventana de 60-365 días se mide desde NUESTRO último mensaje. Antes esos
  leads (59 en total, 39 en la ventana) no entraban nunca a reactivación.
- **Tamaño (`tamano`)**: una / pocas / cadena / desconocido, desde `contacts.sucursales_interes` o
  `companies.sucursales`. Cambia el argumento: a una tienda no se le habla de traspasos; a una cadena no se le dice
  «tu tiendita».
- **Investigación en línea** (`investigacion.ts`): búsqueda web de Anthropic (`web_search_20250305`, máx. 3 usos,
  ~$0.09-0.18 por lead) → qué venden, dónde, sucursales, Instagram y UNA señal para abrir. Se cachea 90 días en
  `ti_perfil.investigacion`. Prohibido inventar: si no encuentra, `encontrado:false` y el bloque no entra al prompt.
  Ya evitó un mensaje malo (descartó una tienda que resultó ser de comida).
- **Trampa medida:** cambiar la VISTA en la base afecta a producción al instante, aunque el código no esté pusheado.
  El cron de reactivación consumió 18 candidatos nuevos con la vista v2 y el redactor viejo; hubo que borrar y
  regenerar los 9 de segmentos nuevos.
- **Selector de plantilla** (`opcionesPlantilla` + UI): con la ventana cerrada ya no dice «la plantilla aprobada».
  Dice cuál, si es marketing (lleva el texto completo) o utilidad (línea neutra), enseña cómo le llega al lead con
  los parámetros puestos, ofrece las otras familias aprobadas en un selector y explica el escenario (marketing
  primero; a los 10 min sin entrega cae a utilidad y el mensaje completo llega cuando conteste). La familia elegida
  viaja en la decisión.

## 2026-09-04 · El lead que llega por WhatsApp desde la web (y por qué se perdía)

- **Caso real:** alguien entra a `/prueba-gratis`, el botón abre WhatsApp con «Hola 👋 Quiero solicitar una prueba
  gratis de SACS, por favor», lo manda… y no pasaba nada. `ligarContacto` solo BUSCA un contacto por teléfono, nunca
  lo crea, así que la conversación nacía con `contact_id = null`. El agente itera CONTACTOS: sin contacto, invisible.
  Se perdieron 6 leads en 7 días, todos de alta intención (prueba gratis o demo).
- **Arreglo** (`lead-entrante.ts`): al espejar un ENTRANTE de número desconocido se crea el contacto (nombre del
  perfil de WhatsApp si sirve, `fuente: whatsapp_web`, `utm_source: sitio_web`) y se guarda en `propiedades` la
  intención, el mensaje inicial, la URL de origen y el referido. Idempotente y con guarda para el backfill silencioso.
- **Seis intenciones con su propia secuencia** (`INTENCIONES`): prueba_gratis, demo, info, precios, partners, otro.
  `notaDeIntencion()` se la pasa al agente SOLO en el primer turno (si ya hubo ida y vuelta, manda el hilo).
  La de prueba gratis pide una sola cosa (qué vende) y deja correo y tienda para el mensaje siguiente; partners no se
  vende, se escala.
- Los 7 huérfanos se recuperaron a mano (6 con contacto nuevo; uno sin mensaje entrante legible).
- **La secuencia del primer mensaje (4-sep, dueño):** prueba gratis y demo preguntan en un solo bloque QUÉ VENDE y
  CUÁNTAS TIENDAS, y cierran ofreciendo las DOS opciones —prueba por su cuenta, o demo con especialista en menos de
  una hora con sus propios flujos— preguntando cuál prefiere. El correo y el nombre de la tienda se piden hasta que
  eligió. Según la decisión el agente sigue solo: prueba → correo + tienda + activarla; demo → dos horarios.
- **Costo (4-sep):** las pruebas de reglas eran lo más caro ($8.07 en 12 pruebas) porque generan cada caso DOS veces
  con Opus. Bajaron de 24 a 12 casos (~$0.45 por prueba, misma señal). El otro gasto grande fue regenerar mensajes ya
  redactados: $2.83 en 40 reemplazados. Presupuesto de IA fijado en $60/mes para que avise al 80 %.

## 2026-09-04 · Dónde se fue el crédito (y por qué no se podía saber)

- **Cada llamada a la IA se registra ahora en `ia_uso`** (modelo, tokens, caché, búsquedas web, costo, ms, de qué
  archivo:línea salió, y si falló). Se hace con un Proxy sobre `anthropic.messages.create` en `ai/client.ts`, así que
  cubre los 32 puntos de llamada sin tocarlos. Si el registro falla, la llamada sigue.
- **Dos errores propios que hacían imposible la cuenta:** (1) `seguimiento-corto`, `guion-datos` y `biblioteca`
  calculaban el costo de Opus a 15/75 por millón cuando la tabla central `PRICING` dice 5/25 → inflaban 3×; ya usan
  `calculateCost`. (2) Muchas llamadas (clasificaciones, curador, crons, scripts de prueba) no guardaban costo en
  ningún lado, así que el total real siempre iba a quedar corto.
- **Lo caro de verdad:** las pruebas de reglas generan cada caso DOS veces con Opus (con y sin la regla). A 24 casos
  eran ~$0.9 por prueba; ya son 12. Y regenerar mensajes ya escritos costó $2.83 en 40 reemplazos.
- Presupuesto de IA fijado en $60/mes (avisa al 80 %). La pregunta «¿en qué se fue?» ya se contesta con:
  `select proposito, round(sum(costo_usd)::numeric,2), count(*) from ia_uso where created_at::date=current_date group by 1 order by 2 desc`
- **La compuerta en el teléfono (4-sep):** los tres botones no cabían en una fila («Rechazar» salía cortado) y se
  quedaban en 36 px de alto. La causa del alto es la regla global `.m-tabin button:not(...):not([style*="min-height"])
  { min-height:36px !important }` —el piso que funciona como techo—, y su escape es declarar el alto INLINE. Por eso
  `DecisionSugerencia` recibe `movil` y pone `style={{minHeight:46}}` en cada botón. Además, en móvil la acción
  principal ocupa el ancho, las otras dos se reparten abajo, la burbuja y el textarea se hacen scrollables (34 vh /
  32 vh) y al editar los botones quedan pegados al fondo de la compuerta.

## 2026-09-04 · Dónde se van los tokens de verdad (medido en 4 días)

- **$13.5 gastados, $2.06 llegaron a un lead.** 190 mensajes redactados, 20 enviados. El desglose por estado es la
  respuesta a «gastamos demasiado»: reemplazados $4.67 (62), pendientes en fila $3.00 (60), sugerencias esperando
  decisión $2.61 (38), enviados $2.06 (20).
- **La causa del desperdicio grande:** dos sistemas escriben para el mismo lead. El reloj de silencio redacta con
  Opus y horas después el seguimiento de 1 a 4 días lo reclasifica y lo reemplaza ($2.59 en 4 días). Pendiente:
  que el reloj de silencio no toque leads que están dentro de la ventana corta.
- **Modelo por tarea** (`MODELO_TAREA` + `modeloPara(tarea, cfg)`, ajustable sin deploy con `cfg.modelos`):
  Opus se queda donde hay conversación viva (respuesta a un lead que escribió, seguimiento de cotización); todo lo
  demás —toques de silencio, reenganche, reactivación, preparación, cita, seguimiento corto, clasificación,
  curador— pasa a Sonnet, porque es UNA línea que además viaja dentro de una plantilla fija. Medido: respuesta
  $0.1239 vs toque $0.065; con Sonnet el toque baja a ~$0.02.
- **Falta comprobarlo con el juez:** el mismo arnés de `evaluarRegla` (generar con y sin, calificar 1-10) sirve para
  A/B de modelos. Correrlo en cuanto haya crédito antes de dar por buena la baja de calidad cero.

## 2026-09-04 · El peso del prompt y el caché (dónde se van los tokens)

Medido: bloque 1 (guion 6 440 + wiki 1 362 + límites 318 + reglas 584) ≈ **8 714 tokens**; bloque 2 (ejemplos)
≈ 1 614. Dentro del guion, tres secciones son el 79 %: «QUIÉN ERES» (8 758 chars), «SI DICE QUE NO» (5 155) y
«LO QUE SE INSTALA POR GIRO» (4 336).

- **El error caro:** desde que los ejemplos se eligen POR PARECIDO, el bloque 2 cambia en cada llamada, pero seguía
  marcado con `cache_control`. Un punto de caché guarda el PREFIJO hasta ahí, así que cada respuesta pagaba la
  escritura de guion + ejemplos (~10 300 tokens a 1.25× = ~$0.06) y no leía nada. Eso explica por qué una respuesta
  costaba $0.1239 en vez de ~$0.05. Se le quitó el `cache_control` al bloque de ejemplos; el bloque 1, que sí es
  fijo, se sigue cacheando.
- **Regla para el futuro:** un bloque solo lleva `cache_control` si es IDÉNTICO entre llamadas. Si varía por lead o
  por mensaje, marcarlo cuesta dinero en vez de ahorrarlo.
- Comprimir el guion es la palanca MENOR mientras el bloque fijo se cachee bien (leerlo cuesta la décima parte).
  Antes de recortar texto hay que confirmar con `ia_uso` (cache_read vs cache_write) que el caché está pegando.

## 2026-09-04 · A/B de modelos a ciegas (con juez y posiciones alternadas)

El mismo caso real escrito por Opus y por Sonnet, calificado 1-10 por un juez que no sabe cuál es cuál:

| Tarea | Opus | Sonnet | Veredicto |
|---|---|---|---|
| Toque de silencio / reenganche (n=6) | 6.33 | **7.83** | Sonnet mejor |
| Seguimiento de 1 a 4 días (n=6) | 6.67 | **7.83** | Sonnet mejor |
| Respuesta a un lead vivo (n=4) | **7.50** | 5.50 | Opus, y por mucho |

- **Por qué Sonnet gana en los toques:** el juez lo dijo solo — «B es más corta, directa y con una pregunta clara;
  A tiene dos preguntas». Un toque es UNA línea dentro de una plantilla; el modelo grande se pone a agregar datos
  y satura. Justo lo que el guion prohíbe.
- **Por qué Opus gana contestando:** «A responde la duda real, suena humano y cierra con opciones; B ignora el
  'heyyy hoalaa' y pregunta por una demo que no pidieron». Ahí hay conversación viva y contexto que interpretar.
- **Costos reales medidos en `ia_uso`:** Opus $0.0889 por llamada (antes del arreglo de caché: $0.1239) y Sonnet
  $0.0249. El caché ya pega: 42 de 57 llamadas leyeron caché y solo 2 escribieron.
- El juez marcó dos veces el saludo alargado («pierde naturalidad con 'Holaaa'»). Es decisión de estilo del dueño y
  se queda; queda anotado que al juez no le gusta.
- **La ventana de 24 h se revisa en el DESPACHADOR, no en una pantalla (4-sep):** el arreglo original vivía en
  `decidirSugerencia`, así que «enviar ya» desde la Torre y los crons seguían mandando texto libre con la ventana
  cerrada. Meta lo ACEPTA, devuelve wamid y el envío queda «enviado»… y luego lo marca `failed` en el webhook: el
  mensaje nunca llega y nadie se entera. Medido con los dos mensajes de prueba al teléfono del dueño. Ahora, antes
  de mandar, si no hay ventana y el envío no trae plantilla, se le cuelga la de su familia y el texto viaja como
  puente; si no hay plantilla aprobada, se veta en vez de fingir que salió.
- **Un solo mensaje en la fila por lead (4-sep):** el índice único solo cubre `pendiente`, así que en entrenamiento
  —donde todo nace `sugerencia`— el reloj de silencio y el seguimiento de 1 a 4 días escribían para el mismo lead y el
  segundo reemplazaba al primero. Medido: $2.59 en 4 días en mensajes que nunca salieron. Ahora `tocarSilencios` salta
  a quien ya tiene algo esperando decisión (`pendiente|enviando|sugerencia`) y `generarSeguimientos` ya no reemplaza,
  deja lo que haya. Primera corrida con el candado: 51 leads saltados, 0 mensajes nuevos, la fila quedó igual.
