Revisa los briefs de proyecto que estén esperando respuesta de Sacs. Trabaja en
`/opt/sacs/paginawebsacs/sitio`.

## 1. Mira qué hay pendiente

```bash
node scripts/brief-pendientes.mjs
```

Si dice `"pendientes": 0`, **termina sin hacer nada**. No mandes correos, no
escribas nada. Un brief sin novedades no necesita ruido.

Fíjate en el campo **`ronda`** de cada etapa: es cuántas veces ya la revisamos.
Manda sobre todo lo demás de este documento.

## 2. Cómo se contesta

Para **cada** pregunta que el cliente contestó, escribe un comentario. No un
acuse: un comentario de verdad, de dos o tres renglones, que haga tres cosas:

1. **Repite lo que entendiste**, con sus palabras. Que vea que se leyó.
2. **Di qué vas a hacer con eso.** «Con esto la ficha de producto ya puede
   filtrar por metal», «esto va tal cual a la sección Nosotros». Es lo que
   convierte un formulario en una conversación.
3. **Si falta profundidad, profundiza ahí mismo.**

Ejemplo de lo que NO sirve: «Gracias, recibido.»
Ejemplo de lo que sí:

> «"Abrimos en 1987 en un local de 20 metros" es exactamente el arranque que
> necesita la sección Nosotros — el dato concreto vale más que cualquier
> adjetivo. Con eso ya se escribe el primer párrafo. Para el segundo me falta
> una cosa: ¿Don Ruben sigue en la casa o ya la lleva la segunda generación? Y
> si el local de 20 metros todavía existe, ¿dónde está? Una foto de ese local,
> aunque sea del celular y esté fea, vale oro en esa página.»

### Pide material siempre que venga al caso

En este proyecto **entre más material tengamos, mejor**. Cada vez que una
respuesta se pueda ilustrar, pídelo en el mismo comentario:

- Una pieza, una colección, una boutique → **fotos**
- Un proceso, el taller, una técnica → **video, aunque sea del celular**
- Un efecto, un sitio, una referencia → **el link y una captura marcando qué**
- Un dato de la casa (el primer local, el fundador, un reconocimiento) →
  **la foto vieja, aunque esté maltratada**
- Algo que ya hacen hoy (un ticket, un certificado, una lista de precios) →
  **el archivo tal como esté**

Dilo sin pena y baja la barrera: «una foto del celular sirve», «no tiene que
estar bonita», «si pesa mucho, súbanla a Drive y pega el link».

## 3. Cuántas preguntas, según la ronda

Este es el candado que hace que el brief avance. Una pregunta con
`"pregunta": true` **bloquea la etapa**: no se aprueba hasta que la contesten.
Si en cada ronda dejas preguntas nuevas, el cliente nunca cierra una sección y
abandona el brief.

| Ronda | Cuánto profundizar | Máximo de preguntas |
|---|---|---|
| **1** | A fondo. Es tu oportunidad de sacarle todo el detalle. | **hasta 5** |
| **2** | Solo lo que quedó a medias de la ronda 1. | **hasta 2** |
| **3 o más** | Nada nuevo. Solo lo que de verdad impide construir. | **0, salvo que sea imposible avanzar sin eso** |

Reglas dentro de eso:

- **Nunca repreguntes sobre un campo donde ya hay dos mensajes tuyos.** Si a la
  segunda no lo dieron, no lo van a dar: coméntalo sin `pregunta` y sigue.
- En la ronda 1, que **al menos una** de tus preguntas sea de profundidad —
  la que va debajo de la respuesta obvia — y **al menos una** pida material
  (foto, video, archivo o link), donde tenga sentido.
- Lo que quieras pedir de más allá del tope: pídelo como comentario **sin**
  `pregunta`. Ellos lo van a leer igual y muchos lo contestan; y si no, la etapa
  ya avanzó.
- Un campo NO obligatorio que dejaron vacío no es motivo de pregunta. Decidieron
  saltárselo y están en su derecho.

## 4. Manda la revisión

```bash
node scripts/brief-responder.mjs '{ "token": "...", "clave": "...", "notas": [ ... ], "cierre": "..." }'
```

Pásalo **como argumento, en una sola línea, entre comillas SIMPLES**. No por
stdin, no con heredoc, no con tubería: esta sesión corre con una lista blanca de
comandos y no puede encadenar ni escribir archivos temporales.

Dos reglas de entrecomillado que ya costaron una corrida:

- **Nunca escribas un apóstrofo literal** dentro del JSON: rompe las comillas
  simples del shell y el comando se parte. Escribe `\u0027`
  (`Ruben\u0027s`) o redacta sin apóstrofo (`la casa Ruben`, `de ellos`).
- Punto y coma, dos puntos, acentos, `¿?` y `«»` son seguros **mientras el
  argumento vaya entre comillas simples**. Si algo se atora, casi siempre es
  porque se coló un apóstrofo.

Cada nota es `{ "campo": "<id>", "texto": "...", "pregunta": true|false }`.

El `cierre` es un párrafo para ellos: qué quedó bien, qué falta y por qué
importa. En español de México, directo, sin adornos y sin disculpas.

El endpoint decide solo: **si dejaste al menos una pregunta, la etapa regresa al
cliente; si no dejaste ninguna, se aprueba, se abre la siguiente y a él le cae
su galleta de la fortuna.** Los correos salen desde ahí.

## Reglas

- Una etapa a la vez, aunque haya varias pendientes.
- Nunca inventes un dato del cliente ni supongas lo que quiso decir.
- Si algo te parece un error de ellos (un precio raro, una fecha imposible, una
  contradicción con otra etapa), dilo en el comentario de esa pregunta — es
  justo para lo que sirve.
- Si algo falla y no puedes mandar la revisión, no lo dejes a medias: reporta
  el error en la salida para que se vea en el log.
