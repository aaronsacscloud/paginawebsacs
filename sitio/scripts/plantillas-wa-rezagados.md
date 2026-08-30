# WhatsApp de «Rezagados · top of mind»

Cuatro plantillas, creadas en Meta el 2026-08-30 desde **CRM ▸ WhatsApp ▸
Plantillas** (ya se puede: `KAPSO_BUSINESS_ACCOUNT_ID` está en el entorno desde
el 22 de agosto — el bloqueo que había anotado ya no existe).

Las escribe **Fernanda**. Andrea queda para la sesión consultiva: separar las
voces le da más peso a Andrea, porque su nombre aparece cuando la conversación
sube de nivel y no en un mensaje de drip.

| Plantilla | Semana | Carril | Qué hace |
|---|---|---|---|
| `rezagado_curva` | 3 | miércoles | Una pregunta de un minuto sobre el estilo que se descabala primero. |
| `rezagado_novedad` | 6 | lunes | El video automático con IA, con oferta de enseñarlo. |
| `rezagado_temporada` | 9 | viernes | Las tres hojas que cambian una compra de temporada. |
| `rezagado_puerta` | 12 | miércoles | Ofrece dejar de escribir. |

Las cuatro llevan dos botones de respuesta rápida, y el segundo es siempre una
salida («Ahorita no» / «Ya, gracias»). Un drip sin puerta de salida no es
cortesía: es lo que hace que en vez de contestarte te bloqueen, y un bloqueo le
baja la calidad al número para todos los demás.

## La regla de Meta que costó dos rechazos

> `Variables can't be at the start or end of the template.`

`rezagado_novedad` y `rezagado_puerta` empezaban con `{{1}}` y Meta las rechazó
con un error 100 genérico («Petición inválida»), que no dice nada hasta que se
mira el `error_detalle`. Se arreglaron anteponiendo el saludo — que además suena
mejor que arrancar con el nombre a secas.

## Antes de prender la cadencia

Las cuatro entraron como **PENDING**. Meta tarda de minutos a 24 h, y una
plantilla no aprobada NO se envía: el paso se salta en silencio. Revisar en
**CRM ▸ WhatsApp ▸ Plantillas** que las cuatro digan APPROVED.

## Lo que el motor ya cuida solo

- **Un WhatsApp por lead por día**, contando todo lo que salió — el cron, otra
  secuencia o un vendedor desde la bandeja.
- **Si una persona tomó la conversación, la cadencia se hace a un lado 5 días.**
  El lead no debe escuchar dos voces a la vez.
- Sin `whatsapp` en la ficha, o con `wa_optout`, el paso no se intenta.
