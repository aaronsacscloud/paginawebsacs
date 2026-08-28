# Inbox v2 — plan de ejecución

Pedido del usuario (2026-08-28), sobre la lista de 10 mejoras: entran los
puntos **3, 4, 5, 6, 7, 8, 9 y 10**, y el 10 con una precisión que manda sobre
todo lo demás:

> «al entrar a la conversación sea más rápido; no hay problema si al inicio
> tardas un poco más en cargar la pantalla, pero abrir conversaciones, regresar
> e irme a otra tiene que ser rápido. Y si en ese momento entra una
> conversación de otro lead, poder saberlo en tiempo real.»

**Todo aplica igual a móvil y a web.** Ninguna mejora es solo del teléfono.

---

## Casos de uso que tienen que quedar bien

1. **La ronda de la mañana.** Hay 12 sin contestar. Abro la primera, contesto,
   vuelvo, abro la segunda… Después de la primera, ninguna debe hacerme
   esperar: la conversación aparece completa al instante y el scroll ya está
   donde lo dejé.
2. **Entra un lead mientras trabajo.** Estoy escribiéndole a alguien y entra un
   mensaje de otro. Me tengo que enterar sin salir de donde estoy, y poder
   saltar ahí de un toque — o ignorarlo y seguir.
3. **Vuelvo después de dos horas.** Abro una conversación con 8 mensajes nuevos.
   Necesito ver dónde empieza lo que no había leído, no aterrizar al final y
   subir a ciegas.
4. **Se me va la señal en la calle.** Escribo, mando, y el mensaje no se pierde:
   queda en cola, se ve que está pendiente y sale solo cuando vuelve la red.
5. **La ventana de 24 h se cerró.** Es el caso donde más conversaciones mueren.
   Quiero mandar la plantilla que uso siempre en un toque, sin abrir catálogos.
6. **Mandar una foto.** Del producto, del comprobante, de la pantalla del
   cliente. Desde el teléfono, con la cámara, sin pasar por el explorador de
   archivos.
7. **Retomar una conversación con contexto.** Si alguien del equipo dejó una
   nota interna, tengo que saberlo antes de abrirla, no después de leerla toda.
8. **Cerrar el ciclo.** «Si no contesta en dos días, recuérdamelo» en un toque,
   sin salir del hilo.

---

## Mejores prácticas que se aplican

- **Nada se pide dos veces.** Un hilo ya visitado se guarda en memoria; al
  volver se pinta de inmediato y la red solo refresca por detrás (el mismo
  patrón que ya usa la lista con `swrGet`).
- **Optimista, pero honesto.** Se pinta lo que ya se sabe (nombre, último
  mensaje) mientras llega el resto; y si algo falla, se dice — nunca se deja un
  estado que aparenta éxito.
- **El trabajo no se pierde.** Nada escrito por el usuario desaparece por un
  fallo de red, un deploy o un cambio de pantalla.
- **Avisar sin interrumpir.** Lo que llega mientras trabajas se anuncia en el
  borde de la pantalla, nunca robando el foco ni tapando lo que escribes.
- **Una sola implementación.** Cada mejora vive en el componente compartido, no
  en una rama de móvil y otra de web.
- **Se mide, no se supone.** Cada etapa cierra con una medición en el navegador
  (tiempo de apertura, de regreso, de cambio) y captura en los dos anchos.

---

## Etapas

### E1 · Velocidad al moverse entre conversaciones  *(punto 10)*
- **E1.1** Caché de hilos en memoria (`Map` por conversación) con el hilo
  completo; al abrir uno visitado se pinta al instante y el `fetch` solo
  refresca.
- **E1.2** Cabecera y último mensaje optimistas desde los datos de la fila,
  para que abrir una conversación NUNCA muestre pantalla vacía.
- **E1.3** Precarga de vecinas: al abrir una conversación se traen la anterior
  y la siguiente de la lista (que son las que se abren después).
- **E1.4** Volver a la lista sin refetch: la lista vive en memoria y el regreso
  es instantáneo; el poll sigue por detrás.
- **E1.5** Recordar la posición de scroll por conversación.
- **Medición de cierre:** abrir la 1ª ≤1.5 s; abrir una ya visitada ≤150 ms;
  regresar a la lista ≤100 ms. En móvil y en escritorio.

### E2 · Tiempo real  *(punto 10, segunda mitad)*
- **E2.1** Poll adaptativo: 5 s con la pestaña visible, 30 s en segundo plano,
  inmediato al volver el foco (hoy es fijo).
- **E2.2** Aviso flotante «Nuevo mensaje de X» cuando llega algo de OTRA
  conversación, tocable para saltar, que se va solo a los 6 s.
- **E2.3** El contador de «No contestadas» y el punto de la fila se actualizan
  sin recargar.
- **E2.4** El aviso nunca aparece si el mensaje es de la conversación abierta:
  ahí simplemente se pinta el mensaje.

### E3 · Cola de envío  *(punto 3)*
- **E3.1** Cola persistente (localStorage) con los mensajes que no salieron.
- **E3.2** Estado visible en la burbuja: pendiente · enviando · enviado · falló.
- **E3.3** Reintento automático al recuperar red (`online`) y botón manual.
- **E3.4** Nada se manda dos veces: cada mensaje lleva su marca única.

### E4 · Plantillas usadas recientemente  *(punto 4)*
- **E4.1** Registrar el uso de cada plantilla de Meta (hoy solo se registra el
  de los snippets).
- **E4.2** En la barra de ventana cerrada, las **3 últimas usadas** a un toque.
- **E4.3** Mismo bloque en escritorio.

### E5 · Adjuntar desde la cámara  *(punto 5)*
- **E5.1** En el teléfono, el clip ofrece **Cámara** y **Galería** por separado
  (`capture="environment"` y selector normal).
- **E5.2** En escritorio se queda como está (explorador de archivos).

### E6 · Mensajes nuevos en el hilo  *(punto 6)*
- **E6.1** Línea «Mensajes nuevos» donde empieza lo no leído al abrir.
- **E6.2** Si llegan mientras lees arriba, botón flotante «N nuevos» que baja.
- **E6.3** La marca se limpia al salir de la conversación.

### E7 · Avisos de mensaje entrante  *(punto 7)*
- **E7.1** Push cuando entra un mensaje de WhatsApp, no solo cuando entra un
  lead — reusando la plomería de `push-crm`.
- **E7.2** Contador en el ícono de la PWA (`setAppBadge`).
- **E7.3** Con la app abierta: vibración corta y sonido suave, respetando el
  modo silencio del sistema.

### E8 · Notas internas visibles  *(punto 8)*
- **E8.1** La fila marca si la conversación tiene notas internas.
- **E8.2** Acceso a las notas desde la hoja del menú del hilo.

### E9 · Recordatorio de seguimiento  *(punto 9)*
- **E9.1** «Recuérdame si no contesta» en la hoja del menú, con 1 día / 2 días
  / la próxima semana.
- **E9.2** Visible también en escritorio, donde hoy está enterrado tras «Más».

---

## Regla de cierre

Cada etapa se cierra con: compila, medición en navegador, captura en móvil y en
escritorio, y commit propio. Al final, una pasada del referee de UI/UX móvil
sobre el inbox completo.
