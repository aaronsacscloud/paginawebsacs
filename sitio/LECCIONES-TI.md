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
