Revisa los briefs de proyecto que estén esperando respuesta de Sacs. Trabaja en
`/opt/sacs/paginawebsacs/sitio`.

## 1. Mira qué hay pendiente

```bash
node scripts/brief-pendientes.mjs
```

Si dice `"pendientes": 0`, **termina sin hacer nada**. No mandes correos, no
escribas nada. Un brief sin novedades no necesita ruido.

## 2. Por cada etapa pendiente, léela de verdad

Para cada pregunta que el cliente contestó, escribe un comentario **concreto**:
cita lo que escribieron, no contestes en general. "Gracias, recibido" a secas no
sirve para nada — o dice algo útil sobre esa respuesta, o no lo escribas.

Y donde la respuesta **no alcanza para construir el sitio**, haz ahí mismo la
pregunta que falta, con `"pregunta": true`. Ejemplos de lo que sí bloquea:

- Una respuesta vaga donde se necesitaba un dato ("varios metales" en vez de cuáles).
- Un permiso que hace falta y no dieron (usar el nombre y la foto de alguien).
- Un dato que abre una decisión de diseño (si el precio se ve o no).
- Algo que contradice otra respuesta de la misma etapa o de una anterior.

**No preguntes por preguntar.** Como mucho **tres preguntas por etapa**, y solo
si de verdad detienen el trabajo. Si con lo que mandaron ya se puede avanzar, no
dejes ninguna: la etapa se aprueba sola y se abre la siguiente, que es el objetivo.

Las respuestas vacías de campos que **no** son obligatorios no son motivo de
pregunta — el cliente decidió saltárselas y está en su derecho.

## 3. Manda la revisión

```bash
echo '{ "token": "...", "clave": "...", "notas": [ ... ], "cierre": "..." }' \
  | node scripts/brief-responder.mjs
```

Cada nota es `{ "campo": "<id>", "texto": "...", "pregunta": true|false }`.

El `cierre` es un párrafo para ellos: qué quedó bien y qué falta. En español de
México, directo, sin adornos y sin disculpas.

El endpoint decide solo: **si dejaste al menos una pregunta, la etapa regresa al
cliente; si no dejaste ninguna, se aprueba y se abre la siguiente.** No hay nada
más que hacer — los correos al cliente y la copia interna salen desde ahí.

## Reglas

- Una etapa a la vez, aunque haya varias pendientes.
- Nunca inventes un dato del cliente ni supongas lo que quiso decir.
- Si algo te parece un error de ellos (un precio raro, una fecha imposible),
  dilo en el comentario de esa pregunta — es justo para lo que sirve.
- Si algo falla y no puedes mandar la revisión, no lo dejes a medias: reporta
  el error en la salida para que se vea en el log.
