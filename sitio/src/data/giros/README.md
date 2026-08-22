# Páginas de giro — el manual

Todo lo que sigue salió de hacer **zapatería** y luego **moda** de principio a
fin: veintitantas rondas, tres referees con veto y ocho rechazos del dueño del
sitio. Está escrito para que el siguiente giro no vuelva a pagar esas rondas.

Léelo completo antes de tocar un giro nuevo. La mitad de las reglas parecen
obvias hasta que ves el error que las produjo.

**Cómo se usa este manual:** la sección 2 dice qué bloque va, en qué orden y
qué trabajo hace cada uno; la 3, qué hay que inventar de cero para ese oficio;
la 4, el ciclo y los referees; la 5, las reglas que no se rompen. La referencia
viva es `src/pages/giros/marcas-de-ropa.astro` — es la página más al día, y
copiar su estructura es el camino corto.

| Giro | Estado |
|---|---|
| Zapatería | **Al día.** Lleva además sus dos bloques propios |
| Marcas de ropa | **Al día.** Es la referencia de estructura |
| Joyería | **Al día y aprobada** por los tres referees (oficio 9.2 · calidad 9.2 · diseño 9). Único giro que se vende como complemento |
| Papelería y arte | **Estructura al día**, pendiente de referees y de dos fotos |
| Los demás (~19) | Sin empezar |

---

## 0. Regla cero — antes de tocar nada

**Este manual se lee completo antes de escribir la primera línea de un giro, y
se vuelve a abrir en cada ronda.** No es documentación de consulta: es la lista
de errores ya pagados. Saltárselo significa volver a pagarlos, y ya van veinte
y tantas rondas.

El arranque, en este orden y sin brincos:

1. **Lee este archivo entero.** Sí, entero.
2. **Abre `src/pages/giros/marcas-de-ropa.astro` y `zapateria.astro` en
   paralelo.** Son la referencia viva. Lo que cambia entre las dos es
   contenido; la estructura es la misma, y la tuya también lo será.
3. **Habla con el experto del oficio ANTES de escribir** (sección 4, paso 1) y
   pídele el bloque propio con sus siete puntos.
4. **Verifica cada afirmación contra `plans.ts`** mientras escribes, no al
   final. Al final ya te enamoraste de la frase.
5. **Trabaja hasta la lista de terminado de abajo.** Un giro no está listo
   porque se vea bien: está listo cuando pasa los veinte puntos.

### La lista de terminado

No se entrega ni se presume un giro con un solo renglón sin palomear. Si algo
no se puede cerrar, se escribe en *Deuda conocida* con su motivo — pero se
escribe, no se omite.

**Estructura**

- [ ] El orden de bloques es el de la sección 2, sin bloques retirados.
- [ ] Lleva `GiroBanner` con avisos del oficio, no genéricos.
- [ ] Lleva **al menos un bloque propio** que fuera de ese oficio no significaría nada.
- [ ] Lleva `SuitePlano` con **cinco zonas del oficio** y **cinco renglones cada una**.
- [ ] Exactamente **dos** `SuiteSalida`, y `CtaDudas` al cierre.
- [ ] `SuiteScroll` con **seis o menos** secciones, sin repetir lo que ya argumenta el bloque propio.

**Verdad**

- [ ] Cada función está respaldada en `plans.ts`, y el plan que la incluye es el que se dice.
- [ ] Lo que se cobra aparte está marcado donde se ve.
- [ ] Las cifras de `SuiteCifras` son las cuatro de la casa.
- [ ] Cero estadísticas sin fuente, cero marcas de terceros, cero superlativos sin acordar.
- [ ] Los números cuadran entre bloques y hay un solo padrón de sucursales.

**Oficio**

- [ ] Un experto del gremio revisó vocabulario y aritmética.
- [ ] Ningún término carga dos significados en la misma página.
- [ ] Las palabras son las del piso mexicano, no las del blog ni las de España.

**Ejecución**

- [ ] `npx astro build` limpio y consola del navegador sin errores.
- [ ] Escritorio y móvil sin desbordes horizontales.
- [ ] **Cada bloque interactivo abierto y usado a mano**, no leído en el código.
- [ ] Los rieles se apagan bien: móvil, `prefers-reduced-motion` y pantalla corta.
- [ ] Las fotos revisadas **al 300%**: manos, objetos del oficio y registro socioeconómico.
- [ ] Ninguna imagen rota, medida en producción y no en local.

**Cierre**

- [ ] **Los tres referees en paralelo, con 9 de 10 cada uno.** Con un 8 se rehace.
- [ ] Verificado **en producción**, no en el dev server — y confirmando que el
      despliegue existe de verdad (ver *Deuda conocida*: un push puede quedarse
      sin build y el sitio queda con HTML nuevo y assets viejos).
- [ ] Este manual actualizado con lo aprendido en la vuelta, y la tabla de
      estado por giro al día.

**Comprueba el resultado, no el diff.** Tres veces en la pasada de joyería di
por aplicado un cambio que no se aplicó: un `replace` buscaba el texto en una
línea y en el archivo estaba partido en dos; otro buscaba la regla con sangría y
ahí va sin ella. Ninguno de los dos falló — simplemente no coincidió, y el
commit salió diciendo que estaba hecho. Después de tocar algo, míralo donde de
verdad vive: el HTML servido, el CSS compilado del bundle, el navegador. Y al
esperar un despliegue, **espera un marcador que sólo exista en ese commit**: dos
veces me enganché con texto que ya estaba antes y di por vivo un cambio que
todavía no salía.

**La regla que cierra todas:** cada vuelta tiene que dejar el manual mejor que
como lo encontró. Si en el giro nuevo descubriste una trampa, escríbela aquí
antes de dar por terminado — ese es el único motivo por el que el siguiente
giro cuesta menos que el anterior.

---

## 1. La línea de diseño no se inventa aquí

**La línea es la portada (`src/pages/index.astro`) y las páginas de producto
(`src/pages/producto/[slug].astro`).** Ahí están los componentes, los tokens y
los patrones. Una página de giro NO tiene diseño propio.

Esto costó tres rechazos. Cada vez que un bloque trajo su propia tipografía, su
propia paleta o su propio disfraz, se leyó como pegado de otro sitio —aunque el
argumento por dentro estuviera bien—:

- El primer expediente eran tarjetas oscuras con acento azul: plantilla de
  software, indistinguible de cien más.
- El segundo se disfrazó de papel: crema con grano, Georgia, monoespaciada,
  manuscrita y sellos de goma. Resolvió lo anterior y creó otro problema.
- El tercero —el que quedó— usa el panel gris de las páginas de producto, Sora
  en los titulares y el azul de la marca. El sello de goma pasó a ser una
  **etiqueta de estado**; la anotación al margen, **la pregunta que el documento
  no contesta**. El argumento no perdió una línea.

Traducción práctica: si necesitas un gesto (un sello, una nota, un aviso),
búscale su equivalente en el sistema antes de dibujarlo aparte.

---

## 2. Los bloques base

| Bloque | Qué hace |
|---|---|
| `GiroBanner` | La portada. Mensaje a la izquierda con los sellos de confianza, una foto de la tienda a la derecha y **avisos del sistema encima — avisos del oficio** |
| `SuiteManifiesto` | Nombra los dolores del oficio con sus palabras. Sin producto todavía. **En claro** |
| `SuiteVariantes` | Entra UN producto y se parte en todos los que de verdad son. Sustituyó al cubo 3D |
| `SuiteCortina` | Antes / después arrastrable, con las dos caras del mismo empleado |
| `SuiteProblemas` | Los dos caminos de siempre —genérico y a la medida— con lo que cada documento NO dice, y el cuadro de los tres caminos |
| `SuiteSalida` | Franja delgada de salida. **Dos por página**: después del expediente y después del precio |
| `SuiteCifras` | Franja fotográfica a sangre con cifras que se cuentan solas |
| `SuiteCasos` | Los momentos del año del giro: lista a un lado, la escena fotográfica al otro |
| `SuiteScroll` | El recorrido de funcionalidades con panel pegajoso. **Hasta seis secciones, no catorce** — menos está bien; repetir no |
| `SuiteDireccion` | Para quien firma: comparativo de sucursales y las reglas contra la fuga |
| `SuiteProceso` | Cómo se cambia sin cerrar: la escena se queda quieta y los pasos pasan. Trae las tres formas de implementar y la caja sin conexión |
| `SuitePlano` | La suite completa contada como el plano de la tienda: lámina arquitectónica con zonas, la foto de cada zona y **abajo, todas las funciones a la vez**. Sustituyó a `SuiteIntegral` en moda |
| `SuiteIntegral` | Vender, controlar, fidelizar y administrar en un círculo. **Retirado**: los tres giros ya usan `SuitePlano` |
| `SuitePlanes` | La escalera de planes y desde dónde viene incluida la suite |
| `CtaDudas` | El cierre. **Es el mismo componente de la portada** |
| `BloqueProducto` | El envoltorio de las páginas de producto (`sq-block`). Cualquier pieza interactiva del giro va dentro de él |

Retirados y por qué: `SuiteCubo` (abstracto y 590 KB de Three.js para decir lo
que `SuiteVariantes` dice sin explicación), `SuiteFormal` (resolvía una objeción
chica; la factura vive ahora como punto de *Administrar*), `SuiteMigracion`
(la rejilla de cinco tarjetas, sustituida por `SuiteProceso`), `SuiteEnsamble`
(el sitio hablaba con dos voces en el cierre), `SuiteRack` (solo donde el
producto suelto ES el argumento; ningún giro lo usa ya).

### El orden que funciona

Portada → manifiesto → variantes → cortina → expediente → **salida** → cifras →
casos → recorrido → **bloque propio** → plano → proceso → planes → **salida** →
cierre.

Es literalmente el de `marcas-de-ropa.astro` y el de `zapateria.astro`. Léelos
en paralelo antes de empezar uno nuevo: lo que cambia entre los dos es
contenido, no estructura.

Lo que de verdad convence son los bloques propios. Si quedan después de veinte
pantallas, nadie llega.

### La lógica de cada sección

Cada bloque tiene **un trabajo y sólo uno**. Si dos bloques hacen el mismo, uno
sobra — así se fueron seis mil píxeles de zapatería.

| # | Bloque | El trabajo | Se sabe que falló cuando |
|---|---|---|---|
| 1 | `GiroBanner` | Probar en la primera pantalla que el sistema habla su idioma. Los **avisos** son del oficio, no genéricos | El visitante no sabe si esto es para él |
| 2 | `SuiteManifiesto` | Nombrar el dolor con sus palabras, sin vender nada todavía | Suena a folleto |
| 3 | `SuiteVariantes` | Enseñar el problema estructural del giro en una imagen: un producto que en realidad son cuarenta | Hay que explicarlo con texto |
| 4 | `SuiteCortina` | Poner las dos caras del mismo empleado. **No convencen los datos, convence la cara** | Se ve como dos fotos de stock |
| 5 | `SuiteProblemas` | Desactivar la objeción que ya trae: "yo ya tengo sistema" / "me lo hicieron a la medida" | Se habla mal de alguien |
| — | `SuiteSalida` | Cambiar el ritmo y rematar el tramo. **Dos por página**, ni una más | Se vuelve un eslogan de relleno |
| 6 | `SuiteCifras` | Responder "¿y ustedes quiénes son?". **Cifras de la casa, no del producto** (ver *Verdad*) | Repite funciones que ya se explicaron |
| 7 | `SuiteCasos` | Los momentos del año en que el giro gana o pierde el dinero | Los casos servirían para cualquier negocio |
| 8 | `SuiteScroll` | El recorrido de funcionalidades. **Hasta seis secciones, no catorce** | Repite lo que ya dijo el bloque propio |
| 9 | **Bloque propio** | El argumento que sólo existe en ese oficio. Es lo que cierra | Al cambiarle las etiquetas sirve para otro giro |
| 10 | `SuitePlano` | Probar que la suite está COMPLETA sin que parezca una lista de cuarenta funciones | El visitante cree que le falta comprar módulos |
| 11 | `SuiteProceso` | Matar el miedo a cambiarse: en tienda, por videollamada o solo | Suena a proyecto de meses |
| 12 | `SuitePlanes` | Desde qué plan viene incluido | Esconde lo que se cobra aparte |
| 13 | `CtaDudas` | El cierre. **Es el mismo componente de la portada** | El sitio habla con dos voces al final |

### El patrón del riel (scroll que cuenta)

Dos bloques ya lo usan —`SuitePlano` y `SuiteCortina`— y es el patrón por
defecto para cualquier pieza que haya que *recorrer*. El visitante no descubre
que algo es clicable; hay que llevarlo:

```
<div class="X-riel">                        ← contenedor
  <div class="X-pegado"> …el panel… </div>   ← position: sticky; top: <tope>
  <div class="X-recorrido"></div>            ← height: N * 52vh
</div>
```

Progreso = `(tope − riel.getBoundingClientRect().top) / (riel.offsetHeight −
pegado.offsetHeight)`, saturado a 0..1.

Las cinco trampas, todas pagadas ya:

1. **El recorrido va como caja propia, nunca como `padding-bottom`.** Un sticky
   sólo viaja dentro del *content box* de quien lo contiene; con padding el
   panel se queda clavado arriba y no se pega jamás. Cuesta media hora
   encontrarlo porque el CSS computado dice `position: sticky` y todo parece
   bien.
2. **`body` tiene `overflow-x: clip`** en `global.css`. No rompe el sticky, pero
   es lo primero que uno sospecha; no lo quites.
3. **Tocar una zona tiene que mover el scroll a su tramo.** Si sólo cambias el
   estado, el siguiente movimiento del dedo lo revierte y se lee como roto. En
   la cortina, al soltar el arrastre se resincroniza el scroll: como todo lo que
   está en pantalla es sticky, el salto no se ve.
4. **Se apaga solo** abajo de ~950 px de ancho, con `prefers-reduced-motion`, y
   —esto es lo importante— **si el panel no cabe entero en la pantalla**. Un
   riel que secuestra el scroll para enseñar un bloque cortado es peor que no
   tenerlo. La clase `sin-riel` devuelve todo a estático.
5. **El encabezado no viaja dentro del panel** si eso obliga a achicar la
   imagen. En la cortina, meter el título dentro dejaba la caja más apaisada que
   la foto y le cortaba la cara a la persona — que era justo lo único que hacía
   funcionar el bloque. El título se queda arriba y se va con el scroll.

Y siempre un **indicador visible** de que hay recorrido: en el plano son los
pasos `01…05` con su línea de avance; en la cortina, la frase de arriba. Sin
indicador, la mitad de la gente pasa de largo.

---

## 3. Lo propio del giro

Cada giro lleva **al menos un bloque que fuera de ese oficio no significaría
nada**. La prueba: si al cambiarle las etiquetas sirve para otro negocio, está
mal pensado.

| Giro | Bloque propio | Por qué solo sirve ahí |
|---|---|---|
| Zapaterías | `ZapCorridaCerrada` — la docena 1-2-3-3-2-1 del fabricante contra tu venta real por número | La corrida cerrada solo existe en calzado |
| Zapaterías | `ZapNivelacion` — la matriz número × tienda y los traspasos que cierran corrida, uno por uno | Nivelar por número con medios; y que un cero en un número que ahí no sale **no es un hueco** |
| — | *Nota de zonas:* en calzado el plano lleva **bodega de cajas** y no trastienda, porque el piso sólo exhibe una muestra por modelo y la corrida vive en cajas atrás. La bodega es zona de venta, no almacén | |
| Joyerías | `JoyColchon` — tu precio del gramo de fino contra el spot | Solo aquí el costo es una materia prima con precio público que cambia a diario |
| Joyerías | `JoyGramo` — el lingote que se reparte en 10K, 14K y 18K | Lo mismo |
| Marcas de ropa | *(pendiente)* | |

Todos mandan su resultado a `/contacto?estimado=`, que la página de agenda lee:
es lo único que sabemos del visitante antes de la llamada. **Nunca mandes
`estimado=0`** — le llega a la llamada como si el cliente no tuviera nada que
ganar.

### Cómo se encuentra el bloque propio

No se inventa en el escritorio. Se le pide al **experto del oficio** una
especificación de siete puntos: cuándo se decide, quién autoriza y quién
ejecuta, qué se mueve primero, cuánto cuesta de verdad, los criterios que
ordenan, el paso a paso, y el dato que remata (con su fórmula honesta). De ahí
salió `ZapNivelacion` completo, incluidas las reglas que ningún software
genérico tiene.

---

## 4. El ciclo, paso a paso

1. **Experto del oficio primero.** Antes de escribir una línea: vocabulario,
   unidades, procesos, calendario y qué duele. En zapatería se hizo al revés y
   costó una vuelta entera.
2. **Pídele también el bloque propio** (los siete puntos de arriba).
3. Escribir `src/data/giros/<giro>.ts` con todo el contenido.
4. Generar las imágenes. Son ~14: la de portada, las dos caras de la cortina, la
   de escala, cuatro de casos, cinco de proceso y las de producto para
   `SuiteVariantes`.
5. Componer la página con los bloques base, en el orden de arriba.
6. Añadir el bloque propio.
7. QA propio: escritorio y móvil, consola limpia, sin desbordes, y **abrir cada
   bloque interactivo y usarlo**.
8. **Los tres referees en paralelo** (ver abajo).
9. Rondas hasta que los tres pasen de 9. En zapatería fueron cuatro.

### Los tres referees

Se lanzan **en paralelo, en la misma vuelta**, cada uno como agente aparte y sin
ver el dictamen de los otros — si se corren en fila, el segundo repite al
primero. Los tres tienen **veto** y el umbral es **9 de 10**: con un 8 se
rehace, no se negocia.

| Referee | Su pregunta | Lo que ha cazado |
|---|---|---|
| **Oficio** | ¿Alguien del gremio encontraría algo que delate que no somos del ramo? | El básico etiquetado "se vende solo" cuando un básico se resurte; el medidor de pie llamado escalímetro |
| **Calidad** | Especificidad, verdad contra `plans.ts`, diseño no genérico, conversión y ejecución | El import duplicado que rompía la compilación; el selector de sensibilidad que movía el total 18% cuando por el propio argumento debía mover cero |
| **Diseño y fotografía** | ¿Las fotos aguantan el 300%? ¿La escena corresponde a su caso? ¿Se lee o es una pared de texto? ¿Se ve como el resto del sitio? | Tres de cuatro casos con la foto equivocada; dos escalas de radios en paralelo; cuatro negros distintos, ninguno el token |

Cómo se les habla:

- **Capturas frescas y separadas**: escritorio, móvil, y **cada bloque nuevo por
  su cuenta**. Un referee sin capturas califica por código y lo dice en el
  dictamen; ese dictamen no cuenta.
- **Se les da el contexto de negocio**: qué giro, qué ICP, de dónde llega el
  tráfico. Sin eso califican una página bonita, no una página que vende.
- **Se les pide número y lista accionable**, no prosa.
- **El referee también se equivoca.** Dos veces marcó como falso algo que sí
  estaba en `plans.ts` ("Programación por fecha y hora" es `fideliza: true`;
  "Apartado con anticipo" es `vende: true`). Antes de rehacer, se verifica
  contra el archivo. Cuando el referee tiene razón, se arregla; cuando no, se
  anota y se sigue.
- **Lo que no se puede cerrar se escribe en Deuda conocida**, no se discute
  tres veces.

---

## 5. Reglas

### Verdad

- **Nada sin respaldo en `plans.ts`.** Y el gateo es del **bloque entero**, no
  solo de una viñeta: `ZapNivelacion` demuestra "Nivelación automática con IA",
  que es de Automatiza, y hay que decirlo donde se ve — separando lo que sí
  viene desde Controla (el traspaso: autorizar, surtir, tránsito, recepción).
- **Si existe pero no está en `plans.ts`, no se publica.** Pasó con Reparaciones
  en joyería: sección escrita y borrada. Y con "vamos a tu tienda y
  capacitamos", que no existe en ningún `services[]`.
- **Cero estadísticas inventadas.** "Uno de cada cuatro tickets" sin fuente es
  una mentira con formato de dato.
- **Los números cuadran entre bloques.** Si una fila suma 17, el texto no dice
  18; el mismo producto no tiene tres precios; y un traspaso de ejemplo no puede
  contradecir al bloque de nivelación dos pantallas abajo.
- **Un solo padrón de sucursales por página.** En cuanto un bloque fija los
  nombres, los demás usan esos.
- **El dinero se cuenta a costo.** A precio de lista, toda cifra de inventario
  parado se infla al doble y el dueño la cuestiona en el acto.
- **Al lado de la cifra buena va la fea, del mismo tamaño.** Un bloque que dice
  que todo se recupera es una calculadora de ilusiones — y el dueño lo sabe.
- **Los supuestos se enseñan y se editan.** El "¿a cuánto sacas tu saldo?" es lo
  que vuelve creíble el número.
- **Nunca marcas de terceros.** Ni de cadenas ni de competidores, ni siquiera
  como ejemplo: "una tienda departamental", no su nombre. Riesgo legal.
- **Las cifras de `SuiteCifras` son de la casa, no del producto.** Es el único
  lugar de la página donde se contesta "¿y ustedes quiénes son?"; gastarlo en
  "24 SKU de un modelo" es repetir lo que tres bloques arriba ya se explicó.
  Las cuatro que van hoy en los tres giros: **+3,000 negocios activos ·
  +$7,600 millones transaccionados · 20+ personas de soporte, en México ·
  #1 en retail especializado**. Sólo cambia el primer rótulo para nombrar el
  giro.
- **Las unidades de dinero se confirman antes de publicarse.** En México un
  *billón* son un millón de millones: "$7.6 billones" habría publicado casi la
  quinta parte del PIB del país. Casi siempre es una lectura de *billion* en
  inglés — se pregunta, no se asume.
- **Los superlativos se acuerdan con el dueño.** "#1" es afirmación de marca y
  se publica porque él lo decidió; si alguien pide la fuente, es su llamada, no
  la nuestra.
- **Lo que se cobra aparte se marca donde se ve**, en la misma lista, no en una
  nota al pie. Si el cliente lo descubre en la llamada, la llamada se enfría.
  Y al revés: **lo que es de un plan superior no se lista como incluido** —
  cuatro puntos de "Piso de venta" en moda decían venir en el plan base cuando
  los cuatro son de Controla.

### Oficio

- **Una palabra, un significado.** En zapatería, *remesa* nombraba dos cosas
  distintas —lo que manda el proveedor de León y lo que se mueve entre tus
  propias tiendas— y encima no es la palabra que se usa en México. Quedó
  **embarque** para lo del proveedor y **reparto** para lo interno. Antes de
  elegir un término del oficio, revisa que no esté ya cargando otro trabajo en
  la misma página.
- **Un `<br />` en una prop de título se imprime como texto** si el componente
  la pinta con `{titulo}` en vez de `<Fragment set:html={titulo} />`. Y peor:
  **Astro no falla ante un bloque de props huérfano** —al que le falta su
  etiqueta de apertura— sino que lo imprime crudo en la página. Las dos
  trampas ya se pagaron dos veces cada una, en zapatería y en joyería.
- **El vocabulario es del piso, no del blog.** Número y no talla en calzado;
  corrida rota y no "par descabalado"; colchón y no "precio automático"; medidor
  de pie y no "escalímetro" (que es la regla del dibujante); vale y no "nota de
  crédito" en el mostrador; un par no tiene pareja —el par *son* los dos—.
- **Los ejemplos usan marcas y proveedores que ese giro sí compra.** Poner una
  marca de venta por catálogo junto a las que sí surten a la tienda delata todo.
- **La aritmética la revisa alguien del gremio.** El margen implícito entre el
  precio y el costo tiene que cerrar: el dueño hace esa división de cabeza.

### Diseño

- **La portada nunca lleva el producto de fondo bajo un velo.** No se lee el
  titular ni se ve el producto. La forma es la del Home: mensaje a la izquierda,
  foto a la derecha, avisos encima — y **los avisos son del oficio**, que es lo
  que enseña en la primera pantalla que el sistema habla su idioma.
- **Nada de gris en los titulares.** No es un color de la marca. La antítesis se
  hace con negro contra azul.
- **Sin muros de un solo tono.** Cuatro mil píxeles de negro seguido después de
  un hero claro se sienten como saturación aunque cada bloque esté bien.
- **Un mosaico de color plano satura.** Diez cuadros de color con texto blanco
  encima era lo que más pesaba en el hero; en tarjetas claras con una marca de
  color se ve como una rejilla de POS de verdad.
- **Las escalas de una gráfica salen del dato**, no de un tope inventado.
- **Lo que se apila se apila.** Una franja de sobrante dibujada desde el piso
  tapa la barra que debía complementar y el bloque dice lo contrario.
- **Un contador nunca arranca en cero en el HTML.** Si el script no corre, la
  franja dice "0 negocios activos".
- **Un bloque interactivo abre con su resultado puesto.** El que solo baja tiene
  que ver el número; el que quiera el antes, lo desarma.
- **Los pasos encadenados se ven encadenados.** Un botón que no hace nada hasta
  su turno, sin decirlo, se lee como roto.
- **Toda leyenda explica todos los colores.** El cuarto color sin leyenda es el
  que confunde.
- **Las columnas paralelas llevan la MISMA cantidad de renglones.** Cinco por
  zona en `SuitePlano`. Con una de seis, la rejilla se desalinea y se lee como
  que a las otras cuatro les falta algo — que es justo lo contrario de lo que
  el bloque tiene que demostrar.
- **Nada de pastillas de color en las listas.** Cinco columnas con una pastilla
  "INCLUIDO" en cada renglón se leen como una tabla de precios sucia. El plan y
  lo que se cobra aparte van como **nota tenue en la misma línea**, y el color
  se guarda para lo único que de verdad avisa.
- **El markup inyectado con `set:html` queda fuera del scope de Astro.** Sus
  clases necesitan un `<style is:global>` aparte o presentación inline; si no,
  hereda los valores por defecto — el mobiliario del plano salía relleno de
  negro sólido.
- **Un rótulo dentro de una figura se calcula contra su caja**, no se fija. En
  el plano, el nombre de la zona sale de `caja.w / (largo del nombre)`; a
  tamaño fijo, "PROBADORES" se salía por el muro. Y en celular la figura se
  rotula **sólo por número**, con la clave abajo — que además es como se rotula
  un plano de verdad.
- **Nada de tipografías de sistema.** `cursive`, `"Bradley Hand"`, `"Segoe
  Script"` caen en Comic Sans en Windows. Si hace falta manuscrita, hay Caveat
  alojada en `/fonts` — y solo para lo diegético (la libreta del vendedor
  dentro de una foto), nunca para interfaz.
- **Ojo con la cascada.** Una regla de 900 px que viene después pisa a la de
  760 px. Lo que tenga que ganar va al final del bloque de estilos.

### Fotografía

- **Se revisan al 300%, no en miniatura.** A tamaño de tarjeta todas pasan; al
  zoom aparecen las manos de cuatro dedos, el brannock inventado y la caja de
  zapatos que por dentro tiene carpetas. Dos frases fijas en cada prompt: *"all
  hands fully visible with exactly five clearly separated fingers"* y el objeto
  del oficio descrito con todas sus letras.
- **Si un objeto del oficio sale inventado, se saca de cuadro.** Un aparato
  falso en primer plano tira la foto entera; la afirmación se queda en el texto.
- **La foto cumple lo que promete el título.** Si dice que hay tres personas
  esperando, la escena no puede ser una tienda vacía.
- **Escenas de trabajo, no catálogo.** El producto suelto solo donde el producto
  ES el argumento (`SuiteVariantes`). En el resto, gente trabajando.
- **Nunca pantallas legibles dentro de la foto.** Una captura falsa se nota. Y
  una tablet apagada en la mano tampoco vende: si la pantalla sale, que salga
  apagada por encuadre, no por descuido.
- **Registro socioeconómico correcto** — pero hacia arriba. El ICP no es la
  emprendedora con un local: es el negocio **en crecimiento**, con varias
  tiendas y personal contratado. Las fotos tienen que enseñar **tienda grande y
  personal uniformado**, no un changarro lleno. Seis fotos de moda se
  rehicieron por esto.
- **El par antes/después es la MISMA persona.** Misma ropa, mismo peinado,
  mismo encuadre; sólo cambian la luz y el gesto. Con dos personas distintas la
  cortina se lee como dos fotos de stock; con la misma, la línea alinea casi
  cuadro con cuadro y el argumento se cuenta solo.
- **Ningún objeto de trabajo que la IA no sepa dibujar.** Nada de etiquetadoras,
  terminales bancarias, tablas con clip ni hojas impresas: salen sin gatillo,
  sin teclado o con garabatos en vez de letras. Si el gesto necesita un objeto
  imposible, **se cambia el gesto**. Lo que sí funciona: prendas, ganchos,
  burros, mercancía doblada, un teléfono, una tablet, bolsas de papel, una
  libreta de espiral.

### Largo

- **Objetivo: 20,000–28,000 px de CONTENIDO en escritorio.** Zapatería llegó a
  33,900 y se bajó a 27,800 sin perder un argumento.
- **El riel no cuenta para ese objetivo.** Cada bloque con riel suma su
  recorrido a la altura del documento —el plano ~208vh, la cortina 120vh, unos
  2,950 px entre los dos— pero eso no es contenido que haya que leer, es el
  ritmo con el que se recorre. Al medir, réstalo; si no, la página parece
  inflada y se recorta un argumento por nada.
- **El recorrido no repite lo que ya argumenta un bloque propio.** Cuatro
  secciones de zapatería decían lo mismo que la corrida cerrada, la nivelación y
  el círculo: seis mil píxeles de eco.
- Palancas medidas: `SuiteScroll` a seis secciones y 62vh (−5,600 px),
  `CtaDudas` a 250vh (−1,350), `SuiteVariantes` a 200vh, y una sola franja de
  salida de más (−110).

---

## 6. Deuda conocida

- **Un push puede quedarse sin despliegue.** Con cuatro sesiones empujando al
  mismo repo pasó que el commit llegó a `origin/main` y Vercel nunca construyó:
  el sitio quedó sirviendo HTML nuevo con assets viejos —imágenes en 404 con
  `x-vercel-cache: MISS`, o sea 404 de origen, no de caché—. Se confirma así, y
  se arregla con un commit vacío:

  ```bash
  T=$(cat ~/.claude/projects/-opt-sacs/memory/vercel-token.txt)
  curl -s -H "Authorization: Bearer $T" \
    "https://api.vercel.com/v6/deployments?projectId=prj_YknbNODDtDpknGYan5AnWIn4UW5B&limit=3"
  # ¿el sha de tu commit no aparece? → git commit --allow-empty -m "chore: forzar despliegue"
  ```

- `plans.ts` **se contradice sobre sell-through**: la lista de Controla lo
  incluye y la tabla comparativa lo da solo a Automatiza. Las páginas están
  gateadas a la lectura estricta (Automatiza). Falta cerrarlo en el archivo.
- **Moda se quedó sin bloque propio** al retirar `ModaMarcacion` (recuperable en
  `git show 289039f:sitio/src/components/giros/ModaMarcacion.astro`). Rompe la
  regla de la sección 3 y hay que reponerlo.
- **Joyería: la mesa de compra de oro no se publicó.** Es zona real del giro y,
  según el experto, la operación más rentable del año —se le compra al público
  al 60-70% del fino en enero, cuando la joyería no trae liquidez—, pero el
  módulo no existe. Vale una conversación de producto.
- **Joyería no ha pasado los tres referees.** Ronda 1: 4 / 5.8 / 4. Ronda 2:
  6 / 6.2 / 8. Ronda 3: 7.5 / 6.6 / 8.5. Lo que sigue abierto ahí:
  - **`JoyGramo` va en la posición 3, no en la 9.** Se dejó a propósito: en
    joyería el gramo es el axioma y sin él no se entiende lo que sigue. Pero
    `JoyGramo` (leyes .417/.583/.750) y `JoyColchon` (factores .445/.620/.780)
    cuentan dos veces que el quilataje cambia el precio, con dos juegos de
    números y diez pantallas de por medio. Hay que ponerlos frente a frente o
    fundirlos.
  - **`SuiteDireccion` sólo existe en joyería** y no está en el orden de la
    sección 2. O sube al orden y entra también en moda y calzado, o sale.
  - **Los dos bloques firma usan grises de temperaturas distintas** sobre el
    mismo negro: `JoyColchon` cálidos (#A9A498, #8A8578, #C9C3B4) y `JoyGramo`
    fríos (#A1A1AA, #D4D4D8). Los oros y los negros ya están en tokens; los
    grises no, en ninguno de los dos.
  - **La matriz de medida × quilataje ilustra "un anillo de oro" con un
    solitario**, y la propia página jura que el diamante se cotiza aparte. Falta
    la foto de un anillo liso.
  - **Falta prueba social del giro.** Ningún caso de joyería con nombre y cifra.
    Es lo único que separa la página de un 10, y no es trabajo de review: hace
    falta un cliente que dé permiso.
  - **Papelería: faltan dos fotos y por eso faltan dos bloques.** Se acabaron los
  créditos de OpenAI a media generación. Sin las dos caras de la MISMA empleada
  no se publica `SuiteCortina` —dos personas distintas es el defecto que el
  referee cazó en moda— y sin la quinta foto el proceso quedó en cuatro días.
  En cuanto haya créditos: `suite-pap-resuelto.webp` (la misma mujer de
  `suite-pap-hoy`: camisa azul claro, mandil de mezclilla, pelo recogido bajo,
  ahora tranquila en el mostrador con una tablet) y `proc-pap-5.webp`.
- **`/agendar/demo` no lee `estimado` ni `de`.** Los bloques propios de los
    tres giros los arman y `/contacto` los usa, pero la página de agenda los
    ignora: el dato se pierde en el último salto.
  - **Dos objetos de las fotos no aguantan el 300%**: el cabezal del tripié de
    `plano-joy-linea` (un tubo abierto que no sostiene nada) y la puerta de
    `plano-joy-caja` (un panel liso con tornillos, sin manija ni cerrojos). A
    tamaño de tarjeta pasan; en la próxima regeneración no. El alt ya bajó de
    "caja fuerte de piso" a "armario blindado" para no afirmar lo que el pixel
    no sostiene.
  - **Las tres filas de quilataje usan el mismo archivo de anillo** y cada alt
    lo llama de un quilataje distinto. 10K, 14K y 18K se distinguen a simple
    vista en tono: hace falta un render de anillo liso en tres tonos.
- **"Autorización de descuento" no existe en `plans.ts`** aunque es el argumento
  moral del bloque de trastienda. Hoy se apoya en "Permisos por usuario y
  sucursal" (Controla). Falta decidir si merece su propia línea.
- El **CFDI** quedó como una viñeta dentro de *Administrar* al retirar
  `SuiteFormal`. Para una cadena con contabilidad formal es eliminatorio: vale
  la pena vigilar que no se pierda.
