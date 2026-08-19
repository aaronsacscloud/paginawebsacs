# Páginas de giro — qué lleva cada una y qué se acumula

Cada giro lleva **los doce bloques base** y **uno propio que no se comparte con
nadie**: algo que fuera de ese oficio no significaría nada. Un bloque que
funciona igual en zapatería y en florería no cumple — eso es un bloque base
disfrazado.

La prueba para saber si el complemento es del giro: si al cambiarle las
etiquetas sirve para otro negocio, está mal pensado.

## Bloques base (todos los giros los llevan)

| Bloque | Qué hace |
|---|---|
| `SuiteManifiesto` | Nombra los dolores del oficio con sus palabras. Sin producto todavía |
| `SuiteCubo` | La variante del giro en 3D. Se le pasa la matriz real |
| `SuiteCortina` | Antes / después arrastrable, con las dos caras del mismo empleado |
| `SuiteProblemas` | El expediente: sistema genérico vs. desarrollo a la medida, con sellos, y el cuadro de los tres caminos |
| `SuiteCifras` | Franja fotográfica a sangre con cifras que se cuentan solas |
| `SuiteRack` | La aritmética del giro: un modelo son N piezas |
| `SuiteScroll` | El recorrido de funcionalidades con panel pegajoso |
| `SuiteDireccion` | Para quien firma: comparativo de sucursales y las reglas contra la fuga |
| `SuiteMigracion` | Cómo se cambia sin cerrar, y la caja sin conexión |
| `SuiteFormal` | La factura (CFDI). Lo eliminatorio para una empresa formal |
| `SuitePlanes` | La escalera de planes y desde dónde viene incluida la suite |
| `SuiteEnsamble` | El cierre en tres actos, con el llamado dentro de la animación |

## Complementos acumulados

Viven en `src/components/giros/` y llevan el prefijo del giro, no `Suite*`.

| Giro | Complemento propio | Por qué solo sirve ahí |
|---|---|---|
| Marcas de ropa | *(pendiente: le toca el suyo)* | |
| Zapaterías | `ZapCorridaCerrada` — la docena 1-2-3-3-2-1 del fabricante contra la venta real por número | La corrida cerrada solo existe en calzado |

Todos mandan su resultado a `/contacto?estimado=`, que la página de agenda lee y
muestra: es lo único que ya sabemos del visitante antes de la llamada.

## El ciclo por giro

1. **Experto del oficio primero.** Antes de escribir una línea: vocabulario, unidades, procesos reales y qué duele. Se hizo al revés en zapatería y costó una vuelta entera.
2. Escribir `src/data/giros/<giro>.ts` con todo el contenido.
3. Generar las imágenes (~9): las dos caras de la cortina, la escena grande y las de producto.
4. Componer la página con los bloques base + todos los complementos acumulados.
5. Añadir el complemento propio del giro — uno que no sirva para ningún otro.
6. QA propio: escritorio y móvil, consola limpia, sin desbordes.
7. **Los dos referees**: el de oficio y el de calidad. Ambos con veto. Se arregla y se vuelve a calificar hasta que los dos aprueben.

## Reglas que salieron de los referees

- **Nada sin respaldo en `plans.ts`.** Si una función es de Automatiza, se dice "(en Automatiza)" ahí donde se vende. La suite viene desde Fideliza; lo que corre con IA, no.
- **Cero estadísticas inventadas.** "Uno de cada cuatro tickets" sin fuente es una mentira con formato de dato.
- **Los números tienen que cuadrar entre bloques.** Si una fila suma 17, el texto no puede decir 18, y el mismo producto no puede tener tres precios distintos en la misma página.
- **El vocabulario es del piso, no del blog.** Número y no talla en calzado; corrida rota y no "par descabalado".
