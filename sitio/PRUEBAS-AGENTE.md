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

## Cómo entrenarlo mientras pruebas
- **Próximos envíos**: editar = lección; detener = veto (cuenta para la rampa); «esto hubiera contestado yo» = ejemplo de máxima prioridad.
- **Silenciar IA** en la tarjeta del lead si no debe tocarlo.
- La **tarjeta de decisión**: «no era lead» con motivo enseña exclusiones.
- Cada noche (02:00 CDMX) el ciclo lee vetos, ediciones y resultados y deja propuestas en las notificaciones del CRM.
- Las lecciones de construcción quedan en `LECCIONES-TI.md`.
