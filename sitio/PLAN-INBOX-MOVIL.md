# Goal: el Inbox móvil, pulido de punta a punta

Pedido del usuario (2026-08-28). Se ejecuta al cerrar el módulo en curso del
menú «Más». El objetivo declarado: **una experiencia simple, rápida entre
conversaciones, donde siempre se sepa cuál es el siguiente paso, en una
interfaz limpia.**

## Lo que pidió, punto por punto

1. **Entrar a una conversación tarda mucho.** Ir de conversación en
   conversación es tedioso. Optimizar la apertura del hilo.
2. **Prioridad a quien ya respondió.** En la vista «Todos», los contactos que
   contestaron deben verse primero o traer un indicador que diga «esto espera
   tu respuesta». Además, un acceso rápido / toggle que muestre los contactos
   **sin respuesta** para mandarles mensaje de corrido.
3. **El composer es chico y poco intuitivo.** Dejar visibles solo las acciones
   importantes y esconder el resto tras un «Más»; al enfocarlo debe crecer el
   área de escritura.
4. **«importing module script failed» al abrir la ficha del contacto** desde el
   Inbox (pasa en varias secciones). La ficha debe abrirse DENTRO del inbox
   (drawer/hoja), sin sacar de la experiencia. Buscar otros lugares que saquen
   del inbox y aplicar la misma técnica.
5. **PWA instalada en Chrome Android: notificación push cuando entra un lead
   nuevo.** Optimizar ese aviso.
6. **Pestañas de arriba** (Abiertas / Mías / Resueltas): reacomodarlas y sumar
   **«No contestadas»** con prioridad visual.
7. **«Nuevo» truena** (import module). Debe poder crearse un contacto nuevo, y
   además un icono aparte para **abrir conversación con un contacto que ya
   existe** (con sus validaciones). Sumar **buscador** por número, nombre de
   contacto o texto de mensaje.
8. **10 ideas propias** para mejorar el Inbox móvil, ejecutadas de inicio a fin.

## Criterio de cierre

Cada pantalla pasa por el referee de UI/UX móvil (estándar Square) hasta 10/10,
y los 7 puntos del usuario quedan verificados con captura o medición, no de
palabra. Si al revisar aparece algo más, se regresa antes de avanzar.

---

## HECHO (2026-08-31): agendar desde el Inbox (móvil y web)

Commits `4e665f01` y `a1396b96`. Las tres preguntas de análisis quedaron así:
endpoints → `/api/scheduling/{available-slots,book}`; WhatsApp SÍ permite
listas interactivas (10 filas, título de 24 caracteres); y la confirmación vive
en `book.ts`, así que la ruta automática reserva por ahí en vez de abrir un
camino paralelo. Detalle en la memoria `agenda-inbox-whatsapp`.

Lo único que NO se probó de punta a punta es el toque real del cliente: hacerlo
crea una reunión de verdad, con correo al host y evento en el calendario. Las
piezas sí están verificadas por separado.

## El pedido original: agendar desde el Inbox (móvil y web)

Pedido del usuario (2026-08-28, después de los 8 puntos de arriba). Un botón
de **agenda** en la conversación, con dos caminos:

1. **Automático.** Lee los huecos libres de la agenda y le manda al cliente
   unos horarios como botones de WhatsApp. El cliente toca uno y con eso queda:
   se crea la cita, se confirma y se avisa, sin que nadie más intervenga.
2. **Por liga.** Elegir cuál de los calendarios mandar y pegarle la liga al
   cliente para que él escoja.

**Y en los dos casos, siempre:** al quedar agendado sale un WhatsApp *y* un
correo con todos los datos del evento —fecha, hora, con quién, liga de la
reunión—. No es un aviso suelto: es una **secuencia que corre siempre** que se
agenda, venga por donde venga.

Pendiente de análisis antes de tocar código: qué endpoints de agenda existen
hoy (SchedulingTab/reuniones), si la API de WhatsApp permite mensajes
interactivos de lista para los horarios, y dónde vive la plantilla de
confirmación para no crear un camino paralelo al que ya manda el CRM.
