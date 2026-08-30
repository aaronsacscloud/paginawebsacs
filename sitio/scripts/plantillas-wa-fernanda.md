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
| `prueba_sesion_consultor` | UTILITY | Prueba gratis · día 5 · sesión | — |
| `prueba_sesion_repaso` | UTILITY | Prueba gratis · día 12 · sesión | — |
| `prueba_cierre_sesion` | MARKETING | Prueba gratis · día 15 · sesión tras el cierre | — |

## Dos cosas que costaron encontrar

**`KAPSO_BUSINESS_ACCOUNT_ID` ya está en el entorno** (desde el 22 de agosto).
Este archivo decía que no, y por eso las plantillas llevaban días esperando: el
bloqueo se resolvió sin que nadie lo anotara. Se crean desde
**CRM ▸ WhatsApp ▸ Plantillas**, sin salir del sistema.

**Meta no admite que el cuerpo empiece ni termine con una variable.**
`prueba_productos` y `prueba_inventario` abrían con `{{1}}` tal como estaban
escritas aquí; se les antepuso el saludo. El error que devuelve Meta es un 100
genérico («Petición inválida») que no dice nada hasta abrir el `error_detalle`.

## Estado

Las cinco primeras quedaron **APPROVED** el 30 ago 2026 y están enganchadas.
`cadencia_consultora_moda` ya se borró después de apuntar su paso a
`cadencia_equipo_moda`.

Las tres de sesión con consultor se crearon el mismo día y están en **PENDING**.
Una plantilla sin aprobar **no se envía**: el paso se salta en silencio, así que
hay que ver que digan APPROVED antes de prender la cadencia.

Para revisarlas sin entrar a ninguna pantalla:

```
node scripts/estado-plantillas-wa.mjs
```

## Por qué UTILITY en las tres de prueba

El lead ya se registró y está usando el sistema: son mensajes de servicio sobre
algo que él inició, no promoción. Meta recategoriza por su cuenta, así que si
las mueve a MARKETING no hay que pelear — solo cuentan distinto para la ventana.
