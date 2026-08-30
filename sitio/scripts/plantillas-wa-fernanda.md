# Plantillas de WhatsApp pendientes de alta en Meta

En WhatsApp escribe **Fernanda**; Andrea queda para la sesión consultiva. Separar
las voces le da más peso a Andrea: su nombre aparece cuando la conversación sube
de nivel, no en un acuse automático.

Se crean desde la consola de Kapso (`inbox.kapso.ai`) o desde
**CRM ▸ WhatsApp ▸ Plantillas** — pero esto último **necesita
`KAPSO_BUSINESS_ACCOUNT_ID` en el entorno**, que hoy no está puesta ni en el
`.env` local ni en Vercel. Enviar plantillas sí funciona; crearlas no.

Al aprobarlas: apuntar los pasos de las secuencias a las nuevas y **apagar**
`cadencia_consultora` y `cadencia_consultora_moda`, que dicen Andrea.

---

## 1 · `cadencia_equipo` — MARKETING · es_MX
Reemplaza a `cadencia_consultora`.

```
Hola {{1}}, soy Fernanda, del equipo de Sacs. Te escribo por la solicitud que registraste.

Trabajamos con marcas que operan varias sucursales y me gustaría entender cómo va la tuya. Cuando gustes platicamos por aquí.

Y si te sirve, te agendo una sesión con Andrea, nuestra consultora — ella acompañó a las marcas de nuestros casos de éxito.
```

## 2 · `cadencia_equipo_moda` — MARKETING · es_MX
Reemplaza a `cadencia_consultora_moda`.

```
Hola {{1}}, soy Fernanda, del equipo de Sacs — el sistema especializado en retail de moda (boutiques, ropa, calzado y accesorios). Te escribimos por correo, pero por aquí es más directo 🙂

Lo que hacemos es implementar tu operación contigo de inicio a fin: catálogo con tallas y colores, apartados, sucursales y venta en línea.

¿Te agendo una sesión consultiva sin costo con Andrea, nuestra consultora de moda? Son 20 minutos y la hace con tu propia boutique, no con demos.
```

## 3 · `prueba_academia` — UTILITY · es_MX
Día 2 de la secuencia «Prueba gratis · 14 días».

```
Hola {{1}}, soy Fernanda de Sacs. ¿Ya pudiste entrar a la Academia?

Está en el menú de la izquierda, arriba del Dashboard. Con la primera tarea se te enciende la racha y empiezas a acumular saldo.

Si se te complica, te acompañamos en vivo — son cinco minutos.
```

## 4 · `prueba_productos` — UTILITY · es_MX
Día 6.

```
{{1}}, ¿cómo vas con tus productos?

Si tienes tu catálogo en Excel no lo captures a mano: lo subimos de un jalón contigo.

Y si te atoraste con las tallas y colores, ese es el paso donde más gente se traba. Dinos y lo armamos juntos.
```

## 5 · `prueba_inventario` — UTILITY · es_MX
Día 10.

```
{{1}}, vas a la mitad de tu prueba de Sacs.

¿Alguna duda de cómo ver tus existencias por sucursal o de armar una orden de compra?

Pregúntanos lo que sea por aquí — para eso estamos.
```

---

## Por qué UTILITY en las tres de prueba

El lead ya se registró y está usando el sistema: son mensajes de servicio sobre
algo que él inició, no promoción. Meta recategoriza por su cuenta, así que si las
mueve a MARKETING no hay que pelear — solo cuentan distinto para la ventana.
