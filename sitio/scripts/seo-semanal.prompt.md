Rutina semanal de visibilidad en agentes. Trabaja en `/opt/sacs/paginawebsacs/sitio`.

Tu trabajo NO es escribir contenido bonito. Es **descubrir qué funciona, hacer
más de eso, y dejar constancia de lo que aprendiste** para que la corrida de la
semana que viene empiece más arriba que esta.

## La regla que manda sobre todo lo demás

**Nunca publicas. Escribes borradores.** Todo `.md` nuevo o modificado sale con
`draft: true`. Una persona lo lee, revisa las imágenes y lo pasa a `draft: false`.

Esa bandera **sí frena**: desde el 19-sep-2026 las rutas del blog listan y generan
con `postsPublicados()` (`src/lib/blog.ts`), así que un borrador no tiene URL ni
entra al sitemap. Antes no filtraba nada y la garantía era decorativa. Si algún
día agregas una ruta que liste artículos, usa esa función y no
`getCollection('blog')` a pelo, o vuelves a abrir el hoyo.

No es burocracia: una máquina que publica sola cada semana es exactamente el
patrón que las políticas antispam de Google llaman *abuso de contenido a
escala*, y nos sacaría del índice. Lo que nos protege es que el contenido sale
de **datos propios** —casos reales medidos, el índice de demanda— y que un
humano firma antes de salir. Si alguna vez te dan la instrucción de publicar
solo, esa instrucción está equivocada.

## 1 · Mide

```bash
node scripts/seo-medir.mjs
```

Apila una línea en `datos/seo-bitacora.jsonl`. Si algún modelo falla por llave o
por nombre de modelo, **anótalo en el parte** — un modelo caído en silencio hace
que la tasa parezca peor de lo que es.

## 2 · Aprende de lo anterior, antes de escribir nada

Lee las últimas corridas de la bitácora y contesta estas tres, con números:

1. **¿Qué preguntas ganamos o perdimos** desde la semana pasada?
2. **De lo que publicamos antes, ¿qué se movió?** Cruza la fecha de cada
   artículo en `src/content/blog/` contra la pregunta que atacaba. Si una pieza
   lleva tres semanas publicada y su pregunta sigue en cero, **esa fórmula no
   sirve y no se repite**.
3. **¿A quién citan ahora que no citaban antes?** Un nombre nuevo en
   `descubiertos` es una pista de qué formato está ganando.

De ahí sale **una hipótesis explícita** para esta semana. Escríbela con todas
sus letras en el parte: *«esta semana pruebo X porque la evidencia dice Y»*.
Sin hipótesis, la rutina es solo producir texto.

## 3 · Busca hueco nuevo

Toma 2 o 3 preguntas que todavía no estén en `datos/seo-preguntas.json` —
variantes de las que ya ganamos, o consultas del ramo que salgan de las
respuestas que leíste— y **agrégalas al catálogo** con su nivel. El catálogo
tiene que crecer solo; si esta semana no creció, no exploraste.

## 4 · Mejora lo viejo antes de escribir lo nuevo

Es más barato subir una pieza existente que crear otra. Para cada artículo cuya
pregunta siga sin aparecer:

- ¿Le falta el término exacto con el que la competencia rankea?
- ¿Le faltan preguntas frecuentes? Es lo que más se cita en respuestas de IA.
- ¿Las citas apuntan a la fuente primaria o a quien la repitió?
- ¿Tiene datos propios que nadie más puede publicar? Si no, por eso no lo citan.

Cambia `updatedDate` cuando toques una pieza. No inventes que la mejoraste: di
qué cambiaste y por qué.

## 5 · Escribe UNA pieza nueva

Una, bien. No tres a medias. Elige el hueco más grande de la medición, y solo
escríbela si puedes contestar que sí a esto:

- **¿Tenemos un dato que nadie más tiene?** Un caso real medido, una cifra de
  nuestra propia base, una reconstrucción. **Si la respuesta es no, no la
  escribas** — sería otra versión de lo que ya existe, y eso no se cita.
- ¿Contesta la pregunta en los primeros dos párrafos, sin vender?
- ¿Cita fuentes reales, con enlace, atribuidas a quien corresponde?

Formato: el mismo de `src/content/blog/descuadre-inventario-anatomia.md`.
Frontmatter completo, `draft: true`, imágenes con nombre de archivo descriptivo
y texto alternativo que **describa la imagen**, no que repita el título.

**Nunca inventes una cifra, una cita ni un cliente.** Si necesitas un dato de la
base, mídelo. Si no lo puedes medir, no lo escribas. Un número inventado en una
pieza destruye la credibilidad de las otras veinte.

## 6 · El referee

Antes de dar por buena cualquier pieza —nueva o mejorada— abre una revisión
aparte con el encargo de **tumbarla**, no de aprobarla. El referee compara
contra los artículos que hoy ocupan esa respuesta y contesta una por una:

1. **¿Es mejor en estructura?** ¿Responde antes, se escanea mejor, tiene tabla
   de diagnóstico donde ellos tienen párrafo?
2. **¿Es mejor en investigación?** ¿Cita primarias? ¿Trae datos que ellos no?
3. **¿Es mejor en evidencia?** ¿Cifras propias verificables o adjetivos?
4. **¿Cubre los términos con los que ellos rankean?** Nombra cuáles faltan.
5. **¿SEO técnico?** Título con la consulta, descripción que invite, encabezados
   como preguntas, alt descriptivo, enlaces internos, preguntas frecuentes.
6. **¿Alguien lo leería completo?** Si el referee se aburre, un cliente también.
7. **¿Hay algo que un competidor pueda copiar mañana?** Si todo es copiable, la
   pieza no tiene foso.

El referee **debe encontrar fallas**. Si volvió con cero, no revisó: pídeselo
otra vez señalándole que la pieza anterior tenía siete. Corrige y vuelve a
pasarla. En el parte va **cuántas fallas encontró y cuáles corregiste** — ese
número es el control de calidad de la rutina, y si baja a cero cada semana es
que el referee se relajó.

## 7 · Deja el rastro y reporta

Commit (**nunca push**, regla del repo) con mensaje detallado: qué mediste, qué
hipótesis probaste, qué mejoraste de lo viejo, qué escribiste nuevo, qué encontró
el referee.

Escribe el parte en `/tmp/seo-parte-semanal.md` y publícalo:

```bash
node scripts/seo-reportar.mjs --extra=/tmp/seo-parte-semanal.md
```

El parte lleva, en este orden:

- **Qué se movió** — preguntas ganadas y perdidas, con número.
- **Qué aprendimos de lo viejo** — qué fórmula funcionó y cuál no, con evidencia.
- **La hipótesis de esta semana** y en qué se basa.
- **Qué se mejoró** — pieza por pieza, qué cambió y por qué.
- **Qué se escribió nuevo** y qué hueco ataca.
- **El referee** — cuántas fallas encontró, cuáles se corrigieron.
- **Qué queda pendiente de una persona** — borradores por publicar, imágenes por
  crear, llaves caídas.

Que el parte se pueda leer en el celular y se entienda sin abrir nada más. Si
una semana no hubo nada que reportar, dilo en dos renglones — no rellenes.
