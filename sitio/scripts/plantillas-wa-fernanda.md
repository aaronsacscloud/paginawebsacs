# Plantillas de WhatsApp de Fernanda

**Creadas en Meta el 2026-08-30.** Este archivo era la lista de pendientes; ahora
es el registro de qué se dio de alta y qué falta.

En WhatsApp escribe **Fernanda**; Andrea queda para la sesión consultiva.
Separar las voces le da más peso a Andrea: su nombre aparece cuando la
conversación sube de nivel, no en un acuse automático.

| Plantilla | Categoría | Para qué | Reemplaza a |
|---|---|---|---|
| `cadencia_equipo` | MARKETING | Cadencia de leads, genérica | `cadencia_consultora` (ya borrada) |
| `cadencia_equipo_moda` | MARKETING | Cadencia de leads, moda | `cadencia_consultora_moda` (sigue viva, ver abajo) |
| `prueba_academia` | UTILITY | Prueba gratis · día 2 | — |
| `prueba_productos` | UTILITY | Prueba gratis · día 6 | — |
| `prueba_inventario` | UTILITY | Prueba gratis · día 10 | — |

## Dos cosas que costaron encontrar

**`KAPSO_BUSINESS_ACCOUNT_ID` ya está en el entorno** (desde el 22 de agosto).
Este archivo decía que no, y por eso las plantillas llevaban días esperando: el
bloqueo se resolvió sin que nadie lo anotara. Se crean desde
**CRM ▸ WhatsApp ▸ Plantillas**, sin salir del sistema.

**Meta no admite que el cuerpo empiece ni termine con una variable.**
`prueba_productos` y `prueba_inventario` abrían con `{{1}}` tal como estaban
escritas aquí; se les antepuso el saludo. El error que devuelve Meta es un 100
genérico («Petición inválida») que no dice nada hasta abrir el `error_detalle`.

## Lo que falta

1. Que Meta apruebe las cinco (de minutos a 24 h). Una plantilla en PENDING
   **no se envía**: el paso de la cadencia se salta en silencio.
2. Apuntar los pasos de las secuencias a las nuevas.
3. Recién entonces, borrar `cadencia_consultora_moda`. Hoy está dentro de una
   secuencia: quitarla antes dejaría ese paso mudo.

## Por qué UTILITY en las tres de prueba

El lead ya se registró y está usando el sistema: son mensajes de servicio sobre
algo que él inició, no promoción. Meta recategoriza por su cuenta, así que si
las mueve a MARKETING no hay que pelear — solo cuentan distinto para la ventana.
