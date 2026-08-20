# Páginas de giro — qué lleva cada una y qué se acumula

Cada giro lleva **los bloques base** y **dos cosas propias que no se comparten
con nadie**: un bloque de argumento y su propia animación: algo que fuera de ese oficio no significaría nada. Un bloque que
funciona igual en zapatería y en florería no cumple — eso es un bloque base
disfrazado.

La prueba para saber si el complemento es del giro: si al cambiarle las
etiquetas sirve para otro negocio, está mal pensado.

## Bloques base (todos los giros los llevan)

| Bloque | Qué hace |
|---|---|
| `GiroBanner` | La portada, con la forma del Home: mensaje a la izquierda, la tienda a la derecha y avisos del sistema encima — pero avisos del oficio |
| `BloqueProducto` | El envoltorio de las páginas de producto (`sq-block`), para que los bloques interactivos del giro no inventen su propio formato |
| `SuiteCasos` | Momentos reales del giro: lista de casos y la escena fotográfica que cambia con cada uno |
| `SuiteManifiesto` | Nombra los dolores del oficio con sus palabras. Sin producto todavía |
| `SuiteCubo` | La variante del giro en 3D. Se le pasa la matriz real |
| `SuiteCortina` | Antes / después arrastrable, con las dos caras del mismo empleado |
| `SuiteProblemas` | El expediente: sistema genérico vs. desarrollo a la medida, con sellos, y el cuadro de los tres caminos |
| `SuiteCifras` | Franja fotográfica a sangre con cifras que se cuentan solas |
| `SuiteRack` | La aritmética del giro: un modelo son N piezas. **Opcional**: solo donde el producto suelto ES el argumento. Zapatería y joyería lo quitaron |
| `SuiteSalida` | Franja delgada de salida. Va después del expediente y después de los casos: sin ella hay siete bloques sin dónde hacer clic |
| `SuiteScroll` | El recorrido de funcionalidades con panel pegajoso |
| `SuiteDireccion` | Para quien firma: comparativo de sucursales y las reglas contra la fuga |
| `SuiteProceso` | Cómo se cambia sin cerrar: la escena se queda quieta y los pasos pasan. Trae las tres formas de implementar y la caja sin conexión |
| `SuiteIntegral` | Las cuatro cosas que el negocio hace todos los días —vender, controlar, fidelizar, administrar— en un círculo, con las funciones del giro |
| `SuitePlanes` | La escalera de planes y desde dónde viene incluida la suite |
| `CtaDudas` | El cierre. Es el mismo componente de la portada: el sitio no puede hablar con dos voces donde más importa |

## Complementos acumulados

Viven en `src/components/giros/` y llevan el prefijo del giro, no `Suite*`.

| Giro | Complemento propio | Por qué solo sirve ahí |
|---|---|---|
| Marcas de ropa | *(pendiente: le toca el suyo)* | |
| Zapaterías | `ZapCorridaCerrada` — la docena 1-2-3-3-2-1 del fabricante contra la venta real por número | La corrida cerrada solo existe en calzado |
| Zapaterías | `ZapNivelacion` — la matriz número × tienda y los traspasos que cierran corrida, uno por uno | Nivelar por número con medios, y saber que un cero en un número que ahí no sale no es un hueco |
| Joyerías | `JoyColchon` — tu precio del gramo de fino contra el spot, con lo que hay que reetiquetar y lo que NO se mueve | Solo aquí el costo es una materia prima con precio público que cambia a diario |

### La animación también es del giro

`SuiteCubo` (talla × color × sucursal) sirve donde la unidad es una casilla de
una retícula. Donde no, se hace otra:

| Giro | Animación | Qué cuenta |
|---|---|---|
| Marcas de ropa · Zapaterías | `SuiteCubo` | La retícula de existencias, con sus ejes |
| Joyerías | `JoyGramo` | Un lingote se deshace en gramos y los gramos se reparten en 10K, 14K y 18K: se ve cuánto de cada pieza es oro fino y cuánto es liga |

Dura **dos pantallas de scroll**, no tres, y termina de frente: si acaba de
canto, lo que se armó no se lee.

Todos mandan su resultado a `/contacto?estimado=`, que la página de agenda lee y
muestra: es lo único que ya sabemos del visitante antes de la llamada.

## El ciclo por giro

1. **Experto del oficio primero.** Antes de escribir una línea: vocabulario, unidades, procesos reales y qué duele. Se hizo al revés en zapatería y costó una vuelta entera.
2. Escribir `src/data/giros/<giro>.ts` con todo el contenido.
3. Generar las imágenes (~9): las dos caras de la cortina, la escena grande y las de producto.
4. Componer la página con los bloques base + todos los complementos acumulados.
5. Añadir el complemento propio del giro — uno que no sirva para ningún otro.
6. QA propio: escritorio y móvil, consola limpia, sin desbordes.
7. **Los tres referees**, todos con veto y **mínimo 9 de 10 cada uno**. Se
   lanzan en paralelo, con capturas frescas de escritorio, de móvil y de cada
   bloque nuevo por separado — un referee que no ve el bloque lo califica por
   código y lo dice:
   - **Oficio** — ¿alguien del gremio encontraría algo que delate desconocimiento?
   - **Calidad** — especificidad, verdad del producto, diseño no genérico, conversión, ejecución.
   - **Diseño y fotografía** — ¿las imágenes se ven reales y de buena calidad? ¿La escena
     corresponde al caso que ilustra? ¿El bloque se lee o es una pared de texto?
   Se corrige y se vuelve a calificar en rondas hasta que los tres pasen de 9.

## Reglas que salieron de los referees

- **Nada sin respaldo en `plans.ts`.** Si una función es de Automatiza, se dice "(en Automatiza)" ahí donde se vende. La suite viene desde Fideliza; lo que corre con IA, no.
- **Cero estadísticas inventadas.** "Uno de cada cuatro tickets" sin fuente es una mentira con formato de dato.
- **Los números tienen que cuadrar entre bloques.** Si una fila suma 17, el texto no puede decir 18, y el mismo producto no puede tener tres precios distintos en la misma página.
- **Nada de datos de relleno.** Un número en la portada o en la franja de cifras se gana su lugar o se va. "22 existencias de un solo modelo" no le dice nada a nadie.
- **La animación dura dos pantallas, no tres.** Con más, el visitante siente que la página se le atoró.
- **Las fotos son escenas de trabajo, no catálogo.** El producto suelto solo va donde el producto ES el argumento. En el resto, gente trabajando: un dueño se reconoce antes en su tienda un martes por la tarde que en una foto de estudio. Y nunca pantallas legibles dentro de la foto: una captura falsa se nota y tira el bloque entero.
- **El vocabulario es del piso, no del blog.** Número y no talla en calzado; corrida rota y no "par descabalado"; colchón y no "precio automático" en joyería.
- **No todas las suites vienen en el plan.** La de joyería es plugin y se cotiza aparte: `SuitePlanes` recibe `comoSeVende="complemento"`. Decirlo mal manda al prospecto a la demo esperando otra cosa.
- **Si un módulo existe pero no está en `plans.ts`, no se publica.** Pasó con Reparaciones en joyería: sección escrita y borrada.
- **Al clonar una página, los textos que viven en el .astro también son del giro.** Cambiar solo los imports de datos deja el hero, el manifiesto y el rack hablando del giro anterior.
- **Las fotos se revisan al 300%, no en miniatura.** A tamaño de tarjeta todas
  pasan. Al zoom aparecen las manos de tres dedos, las cajas imposibles y —el
  caso peor— una caja de zapatos que por dentro tiene carpetas. Dos frases fijas
  en cada prompt: *"all hands fully visible with exactly five clearly separated
  fingers"* y el objeto del oficio descrito con todas sus letras.
- **La foto tiene que cumplir lo que promete el título.** Si el titular dice que
  hay tres personas esperando, la escena no puede ser una tienda vacía.
- **Nada de tipografías de sistema.** `cursive`, `"Bradley Hand"`, `"Segoe
  Script"` caen en Comic Sans en Windows y en una serif en Linux. Si se quiere
  manuscrita, se aloja el woff2 (hay Caveat en `/fonts`).
- **Un dato en una animación necesita su rótulo.** Tres anillos girando sin
  decir cuál es 10K y cuál 18K son tres anillos bonitos y ningún argumento.
- **Las escalas de una gráfica salen del dato, no de un tope inventado.** Con un
  tope fijo de 6 y valores de 0 a 4, las barras se aplastan contra el piso y la
  comparación deja de verse.
- **Lo que se apila se apila.** Una franja de sobrante dibujada desde el piso
  tapa la barra que debía complementar, y el bloque termina diciendo lo
  contrario de lo que quiere decir.
- **El dinero se cuenta a costo.** A precio de lista toda cifra de inventario
  parado se infla al doble y el dueño la cuestiona en el acto.
- **Nada de bloques con su propia identidad gráfica.** La línea es la de la
  portada y la de `producto/[slug].astro`; ahí están los componentes. Un bloque
  que trae su propia tipografía, su propia paleta o su propio disfraz se lee
  como de otro sitio aunque por dentro esté bien argumentado.
- **Un contador nunca arranca en cero en el HTML.** Si el script no corre —o si
  alguien captura la página— la franja dice "0 negocios activos". El valor final
  va en el marcado y la animación lo recorre.
- **Un bloque interactivo abre con su resultado puesto.** El visitante que solo
  baja tiene que ver el número; el que quiera ver el antes, lo desarma. Abrir en
  cero regala el argumento.
- **Un solo padrón de sucursales por página.** En cuanto un bloque fija los
  nombres de las tiendas, los demás tienen que usar esos.
- **El recorrido no repite lo que ya argumenta un bloque propio.** Cuatro
  secciones de zapatería decían lo mismo que la corrida cerrada, la nivelación y
  el círculo — seis mil píxeles de eco.
