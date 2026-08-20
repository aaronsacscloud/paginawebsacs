# Páginas de giro — el manual

Todo lo que sigue salió de hacer **zapatería** de principio a fin: doce rondas,
tres referees con veto y cuatro rechazos del dueño del sitio. Está escrito para
que el siguiente giro —moda, y después los demás— no vuelva a pagar esas
rondas.

Léelo completo antes de tocar un giro nuevo. La mitad de las reglas parecen
obvias hasta que ves el error que las produjo.

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
| `SuiteScroll` | El recorrido de funcionalidades con panel pegajoso. **Seis secciones, no catorce** |
| `SuiteDireccion` | Para quien firma: comparativo de sucursales y las reglas contra la fuga |
| `SuiteProceso` | Cómo se cambia sin cerrar: la escena se queda quieta y los pasos pasan. Trae las tres formas de implementar y la caja sin conexión |
| `SuiteIntegral` | Vender, controlar, fidelizar y administrar en un círculo, con las funciones del giro |
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
casos → recorrido → **bloque propio 1** → dirección → **bloque propio 2** →
proceso → integral → planes → **salida** → cierre.

Lo que de verdad convence son los bloques propios. Si quedan después de veinte
pantallas, nadie llega.

---

## 3. Lo propio del giro

Cada giro lleva **al menos un bloque que fuera de ese oficio no significaría
nada**. La prueba: si al cambiarle las etiquetas sirve para otro negocio, está
mal pensado.

| Giro | Bloque propio | Por qué solo sirve ahí |
|---|---|---|
| Zapaterías | `ZapCorridaCerrada` — la docena 1-2-3-3-2-1 del fabricante contra tu venta real por número | La corrida cerrada solo existe en calzado |
| Zapaterías | `ZapNivelacion` — la matriz número × tienda y los traspasos que cierran corrida, uno por uno | Nivelar por número con medios; y que un cero en un número que ahí no sale **no es un hueco** |
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
8. **Los tres referees en paralelo**, con capturas frescas de escritorio, de
   móvil y de cada bloque nuevo por separado. Un referee que no ve el bloque lo
   califica por código y lo dice. Todos con veto y **mínimo 9 de 10**:
   - **Oficio** — ¿alguien del gremio encontraría algo que delate desconocimiento?
   - **Calidad** — especificidad, verdad del producto, diseño no genérico, conversión, ejecución.
   - **Diseño y fotografía** — ¿las fotos aguantan el zoom? ¿la escena corresponde
     a su caso? ¿el bloque se lee o es una pared de texto? ¿se ve como el resto
     del sitio?
9. Rondas hasta que los tres pasen de 9. En zapatería fueron cuatro.

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

### Oficio

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
- **Registro socioeconómico correcto.** Una boutique de mármol no es el cliente
  de una página de zapaterías.

### Largo

- **Objetivo: 20,000–28,000 px en escritorio.** Zapatería llegó a 33,900 y se
  bajó a 27,800 sin perder un argumento.
- **El recorrido no repite lo que ya argumenta un bloque propio.** Cuatro
  secciones de zapatería decían lo mismo que la corrida cerrada, la nivelación y
  el círculo: seis mil píxeles de eco.
- Palancas medidas: `SuiteScroll` a seis secciones y 62vh (−5,600 px),
  `CtaDudas` a 250vh (−1,350), `SuiteVariantes` a 200vh, y una sola franja de
  salida de más (−110).

---

## 6. Deuda conocida

- `plans.ts` **se contradice sobre sell-through**: la lista de Controla lo
  incluye y la tabla comparativa lo da solo a Automatiza. Las páginas están
  gateadas a la lectura estricta (Automatiza). Falta cerrarlo en el archivo.
- **Joyería y moda siguen con la estructura vieja**: cubo, hero oscuro con el
  POS de fondo, `SuiteFormal`, `SuiteMigracion`. Les toca esta misma pasada.
- El **CFDI** quedó como una viñeta dentro de *Administrar* al retirar
  `SuiteFormal`. Para una cadena con contabilidad formal es eliminatorio: vale
  la pena vigilar que no se pierda.
