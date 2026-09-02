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

## Cómo entrenarlo mientras pruebas
- **Próximos envíos**: editar = lección; detener = veto (cuenta para la rampa); «esto hubiera contestado yo» = ejemplo de máxima prioridad.
- **Silenciar IA** en la tarjeta del lead si no debe tocarlo.
- La **tarjeta de decisión**: «no era lead» con motivo enseña exclusiones.
- Cada noche (02:00 CDMX) el ciclo lee vetos, ediciones y resultados y deja propuestas en las notificaciones del CRM.
- Las lecciones de construcción quedan en `LECCIONES-TI.md`.
