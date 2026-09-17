# Auditoría móvil del sitio — 17 de septiembre de 2026

Medida con navegadores de verdad, no a ojo: **Safari (WebKit) en iPhone 13 y en
iPhone SE, y Chrome en Pixel 7**, sobre las ocho páginas más visitadas. Cada
mejora de esta lista sale de algo que la medición encontró y que se volvió a
medir después de arreglarlo.

| | Antes | Después |
|---|---|---|
| Hallazgos totales | **445** | **212** |
| Controles imposibles de apretar | 192 | **4** |
| Texto por debajo de 12 px | 108 | 81 (el resto son maquetas) |
| Páginas que se movían de lado | 2 | **0** |
| Campos que hacían zoom en iOS | 12 | **0** reales |
| Imágenes que saltaban al cargar | 16 | **0** |

Lo que queda en la columna de la derecha son, casi todo, falsos positivos ya
verificados uno por uno: carruseles que se deslizan a propósito, la cabecera
fija, y texto dentro de las maquetas que imitan la pantalla del sistema.

---

## Lo más grave que apareció, y no lo buscábamos

**La marca salía cortada en la cabecera de todos los teléfonos.** «Sacs» se
partía por arriba y «Fashion Commerce» caía en un segundo renglón que no cabía
en los 72 px de la barra. Estaba así en las tres pantallas y en las ocho
páginas. Ahora va en una sola línea, como se escribe la marca y como se ve en
escritorio.

---

## Las 50 mejoras, por lo que resuelven

### Que nada se salga ni se corte (1-7)
1. Se acabó la deriva lateral: 52 px en Partners y 12 px en una página de giro, esa franja blanca que aparece al arrastrar.
2. Las cajas de una rejilla ahora sí se encogen en iPhone SE: los pasos de Partners salían 72 px más anchos que su columna.
3. Lo mismo en la comparativa de los giros, que se salía 48 px.
4. Las palabras largas parten en vez de empujar la caja en pantallas de 320 px.
5. La tabla de comparación de producto (1,320 px contra 390 de pantalla) avisa que se desliza, con una sombra en el borde que desaparece al llegar al final.
6. Se descartó forzar todas las tablas a bloque: cambiaba cómo se dibujan y la comparativa ya vivía en un contenedor que hace scroll.
7. El mismo aviso de deslizamiento en los otros carruseles: pestañas de la suite y pasos del plano.

### Que el dedo acierte (8-20)
8. Los enlaces del pie de página medían 18 px de alto y van uno debajo de otro: ahora 44 px cada uno, con una línea que los separa.
9. El logo de la cabecera: área de toque de 44 px sin tocar el dibujo.
10. El botón de la vertical, igual, pero sin estirar su barra separadora.
11. Los enlaces de «ver más» al final de cada sección, de 26 a 44 px.
12. Las pestañas de la ficha de producto.
13. Los enlaces de bloque y los de preguntas frecuentes.
14. Los interruptores de periodo de los planes.
15. Los botones de las maquetas: «Apartar», «Pagar y apartar», «Cobrar», «Enviar broadcast», que estaban entre 23 y 39 px.
16. Los puntos de los carruseles, de 10 × 10 px a un área de 44 sin cambiar el punto.
17. Las pestañas del plano de tienda («01 Piso de venta»), de 34 px.
18. Los enlaces dentro de un párrafo, que se apretaban con la línea de arriba.
19. Las pestañas y píldoras que estaban a 0 y 2 px una de otra: ahora hay 8 px entre ellas.
20. El retraso de 300 ms al tocar, que hacía sentir la página lenta.

### Que se pueda leer (21-30)
21. Las antetítulos de sección estaban en 10 y 11 px: «01 · Tipo de alianza», «Calcula tu ingreso», «Migración incluida».
22. Los sellos del inicio: «Google Reviews» a 10 px, con los tres apretados en una fila de 390 px. Ahora 12 px y dos columnas en pantallas chicas.
23. Veintinueve renglones de las maquetas que llegaban hasta 6.5 px, corregidos en su origen.
24. Las etiquetas de tabla y de lista de definición.
25. La letra chica de la calculadora de Partners.
26. Las etiquetas de la maqueta de devoluciones.
27. Interlineado de 1.2 a 1.4 en las frases largas de Partners, de los giros y de la ficha de producto.
28. El texto del cuerpo ya no lleva espaciado negativo en móvil, que pegaba las palabras.
29. Los precios dejan de bailar al cambiar de plan o de moneda: cifras de ancho fijo.
30. El foco del teclado se ve también aquí, para quien navega desde una tableta con teclado.

### Que el teléfono se comporte como teléfono (31-42)
31. El notch y la barra de gestos: todo lo pegado al fondo respeta la zona segura. Antes la barra de WhatsApp, el menú y los modales quedaban debajo.
32. Lo mismo a los lados, para el iPhone en horizontal.
33. Los campos ya no disparan el zoom de iOS, ese que agranda la página y no vuelve sola: pasaba en el selector de moneda y en los campos de Partners.
34. El teclado ya no tapa el campo que estás llenando.
35. El menú móvil usa la altura que de verdad se ve en Safari, no la de la pantalla completa: su último renglón caía debajo de la barra de direcciones.
36. Con el menú abierto, el fondo se queda quieto en vez de arrastrarse.
37. El rebote al final de un panel ya no arrastra la página de atrás.
38. El destello gris al tocar se cambió por uno de la marca.
39. Dejar el dedo sobre una imagen ya no abre el menú del sistema.
40. Las anclas ya no aterrizan debajo de la cabecera fija: al tocar un enlace del menú, el título quedaba tapado.
41. El botón flotante de WhatsApp ya no tapa el último botón de cada página, que suele ser el que más importa.
42. Los fondos animados y los desenfoques grandes se apagan o se reducen en móvil: se comían batería sin aportar nada en 390 px.

### Que no salte al cargar (43-50)
43. Las tres fotos del recorrido del inicio llevan sus medidas.
44. La tablet del inicio, igual.
45. Las tres tarjetas de casos de éxito.
46. La cortina antes/después, que se comparte en las quince páginas de giro.
47. El plano de tienda, también compartido.
48. El cierre y las cifras de cada giro.
49. Las miniaturas de producto de las maquetas.
50. La foto de Partners que salía dos veces sin medidas.

---

## Cómo volver a correrla

El script vive en el scratchpad de la sesión, pero se reconstruye en diez
minutos: abre cada página en los tres perfiles, recorre el árbol y apunta
desbordes, áreas de toque por debajo de 44 px, texto por debajo de 12,
campos que disparan el zoom de iOS, imágenes sin medidas y errores de consola.

**Dos trampas que costaron tiempo:**

- Un control puede tener su área de toque en un elemento invisible. Si el
  medidor no lo mira, reporta como fallo algo que ya está resuelto: así
  aparecían 57 falsos positivos.
- El detector de contraste automático no sirve sobre degradados ni fotos:
  daba 1,552 hallazgos, casi todos falsos. El contraste se revisa a ojo o con
  una herramienta que entienda el fondo real.
