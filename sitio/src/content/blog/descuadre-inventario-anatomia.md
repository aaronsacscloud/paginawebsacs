---
title: "Por qué tu sistema dice que tienes existencia y en la tienda no hay"
description: "La pantalla decía 409 piezas. En el almacén había cero. Reconstruimos el caso movimiento por movimiento: las seis causas reales de un descuadre de inventario, cómo distinguir cuál tienes y qué revisar hoy en tu propio sistema."
pubDate: 2026-09-19
author: "Equipo Sacs"
tags: ["Inventario", "Retail", "Moda", "Diagnóstico", "Eventos"]
category: "retail"
image: "/images/blog-descuadre-inventario-kardex-409-vs-cero.webp"
draft: true
---

La pantalla decía **409 piezas**. En el almacén no había ninguna.

No era un error de captura ni un robo. El inventario se había descontado correctamente en cada una de las 409 salidas; lo que fallaba era el número que se pintaba en la pantalla. Y encontrarlo tomó reconstruir 3,688 movimientos, uno por uno, con hora exacta.

A esa diferencia entre lo que hay en el piso y lo que dice el sistema se le llama **inventario fantasma**, y casi siempre se busca explicación en la merma o el robo. En este caso no era ninguno de los dos.

Este artículo es esa reconstrucción. No es una lista de causas posibles: es un caso real con sus tiempos, más las seis razones por las que un sistema y una tienda dejan de coincidir —incluidas dos que casi nadie menciona porque solo se ven con el registro de movimientos en la mano.

Si estás leyendo esto porque tu sistema y tu tienda no cuadran, salta directo a [cómo saber cuál tienes](#diagnostico).

## Primero: no es raro, y no eres tú

El dato más citado de la industria viene del laboratorio de RFID de la Universidad de Auburn: la exactitud de inventario de la tienda minorista promedio ronda el **65%** —uno de cada tres registros no corresponde con lo que hay en el piso—. Conviene decir de dónde sale cada número: esa cifra circula a través de publicaciones del sector más que del paper original, así que tómala como orden de magnitud, no como medición de tu negocio.

No es un problema de negocios desordenados. Es el estado normal de la industria, y tiene consecuencias medibles: la investigación de ECR Retail Loss sobre el impacto de mejorar los registros de inventario encontró que **las ventas suben entre 3.8% y 8.4%** —con un promedio cercano al 6%— cuando la exactitud mejora. No porque se venda distinto, sino porque se deja de perder la venta del producto que sí estaba y el sistema decía que no.

Con eso de contexto, vamos al caso.

## El caso: nueve puntos de venta, una noche, 133 piezas en negativo

**LiveShows Merchandising** opera la comercialización de mercancía oficial en conciertos y giras. El 12 de septiembre de 2026 montaron nueve puntos de venta para el concierto de **Laufey en el Palacio de los Deportes** de la Ciudad de México.

Al día siguiente reportaron que, después de recibir la mercancía y repartirla a los puntos, **las existencias no se descontaban**. La pantalla seguía mostrando el inventario completo mientras la mercancía se vendía.

El evento: un almacén general y ocho puntos de venta, **3,688 movimientos de inventario en una sola noche**, 1,902 ventas cobradas desde la app móvil.

Lo primero fue sumar el registro de movimientos de la sudadera del reporte —la *AMOT Hoodie*— almacén por almacén:

| Almacén | Entró | Salió | Debe quedar | Existencia real |
|---|---:|---:|---:|---:|
| Almacén general | 409 | 409 | 0 | 0 ✓ |
| Puerta 6 | 62 | 62 | 0 | 0 ✓ |
| Puerta 5 | 83 | 83 | 0 | 0 ✓ |
| Puerta 7 | 37 | 28 | 9 | 9 ✓ |
| MR Merch | 145 | 148 | −3 | −3 ✓ |
| Cárcamo | 33 | 47 | −14 | −14 ✓ |
| Gym | 22 | 22 | 0 | 0 ✓ |
| Baños | 22 | 19 | 3 | 3 ✓ |
| Dominos | 28 | 30 | −2 | −2 ✓ |

**Los nueve cuadraban.** El motor de inventario nunca dejó de descontar. Entonces, ¿de dónde salía el 409?

De un segundo número.

## Causa 1 · El total del producto y el detalle por talla son dos cosas distintas

Un producto con tallas guarda su inventario en dos lugares: **el detalle por talla**, que baja con cada venta, y **un total por producto**, que se escribe al recibir la mercancía.

Si la pantalla que estás mirando lee el segundo, puede estar congelada. Las horas del caso lo dicen solas:

![Línea de tiempo del descuadre: a las 13:59 entran 409 piezas y el total queda congelado mientras las ventas bajan el detalle por talla hasta cero](/images/blog-descuadre-linea-tiempo-409-congelado.webp)

| Hora | Qué pasó | El total decía |
|---|---|---:|
| 13:59 | Llega la mercancía | 409 |
| 14:18 | Sale por transferencia | 409 |
| 17:57 | Empiezan las ventas | 409 |
| 21:31 | El cliente graba el video del reporte | **409** (real: 0) |

**Cómo detectarlo en tu sistema:** toma un producto con tallas y compara el número que ves en el catálogo contra la suma de sus tallas en ese mismo almacén. Si no coinciden, estás viendo un total derivado que dejó de actualizarse.

## Causa 2 · El renglón partido en dos (la que nadie lista)

Esta es la causa de fondo del caso anterior, y es la que no vas a encontrar en ningún artículo genérico sobre descuadres.

Cuando dos movimientos del mismo producto en el mismo almacén ocurren en el mismo instante, un sistema sin el candado adecuado puede crear **dos registros de existencia en lugar de uno**. Cada uno se queda con la mitad de la historia.

La evidencia fue inapelable: dos copias del mismo registro, nacidas ambas a las **13:59:47**. Una con existencia 409 y cero ventas. La otra con existencia 0 y 409 ventas.

![Dos registros de existencia del mismo producto y almacén creados en el mismo segundo, uno con 409 piezas y cero ventas y otro con cero piezas y 409 ventas](/images/blog-descuadre-renglon-partido-dos-mitades.webp)

Y hay un círculo vicioso escondido: el candado técnico que impide esa duplicación **no se puede instalar mientras existan duplicados**. Para ponerlo hay que limpiarlos primero, y mientras no esté, se siguen creando. El sistema se muerde la cola.

**Cómo detectarlo:** agrupa tu tabla de existencias por producto y almacén y cuenta. Si algún par aparece más de una vez, ahí está.

## Causa 3 · Se vendió antes de capturar la entrada

Aquí termina lo del sistema y empieza lo de la operación —y es, con diferencia, la causa más común de existencias en negativo.

En el caso, 133 piezas quedaron en negativo repartidas en 42 renglones. Al revisar el origen de cada uno:

| Qué pasó | Casos |
|---|---:|
| La primera **venta** ocurrió antes de capturar la transferencia | 22 |
| Recibieron primero, pero vendieron más de lo surtido | 17 |
| Nunca se les registró ninguna entrada | 3 |

El caso más claro fue **Cárcamo**: empezó a cobrar a las **16:17** y su transferencia se registró a las **18:28**. Dos horas y once minutos vendiendo mercancía que, para el sistema, nunca llegó ahí.

**Cómo detectarlo:** para cada par producto–almacén en negativo, compara la fecha de la primera venta contra la de la primera entrada. Si la venta es anterior, ya sabes qué pasó.

## Causa 4 · Dos almacenes con el mismo nombre

Los puntos de venta suelen repetir nombres entre sucursales o entre eventos: *Puerta 5*, *Bodega*, *Caja 2*. Cuando dos almacenes distintos se llaman igual, elegir el equivocado al transferir no produce ningún aviso: **la mercancía entra en uno y se vende del otro**, y los dos quedan descuadrados en direcciones opuestas.

Lo insidioso es que a veces la diferencia es invisible: `"ACCESO B"` y `"ACCESO B "` —con un espacio al final— son dos almacenes distintos para el sistema e idénticos para el ojo.

**Cómo detectarlo:** lista tus almacenes, quítales espacios y acentos, pásalos a mayúsculas y busca repetidos.

## Causa 5 · El registro no se puede leer

Esta no descuadra el inventario, pero hace imposible *demostrar* que está cuadrado —y en la práctica produce la misma llamada.

En el caso, las compras y las transferencias escribían la variante completa —*«LAUFEY AMOT HOODIE M»*— pero las ventas escribían solo *«LAUFEY AMOT HOODIE»*. Con cuatro tallas revueltas bajo el mismo nombre, el saldo del registro brincaba: 19, 17, 13, 5, 12.

Cada talla bajaba perfecto por su lado. Pero cualquiera que sume las entradas y mire ese saldo concluye lo mismo que concluyó el cliente: *«no está descontando»*.

**Cómo detectarlo:** filtra el registro de movimientos por un producto con tallas y revisa si las ventas traen la talla. Si no, tu registro tiene cuatro cuentas intercaladas bajo un mismo renglón.

## Causa 6 · Las de siempre, que también son reales

Las causas clásicas existen y hay que descartarlas: mercancía dañada que nadie reportó, devoluciones no registradas, robo, error al contar la recepción, ventas fuera del sistema. Están bien cubiertas en cualquier manual de inventarios.

La razón por la que van al final de esta lista es que **son las primeras que todo el mundo asume**, y en el caso que reconstruimos no explicaban ni una sola de las 133 piezas.

## Cómo saber cuál de las seis tienes {#diagnostico}

![Árbol de diagnóstico de seis pasos para distinguir si el descuadre es de inventario o de pantalla](/images/blog-descuadre-arbol-diagnostico.webp)

En orden, porque cada paso descarta el siguiente:

1. **¿El registro de movimientos cuadra con la existencia?** Suma entradas menos salidas por producto y almacén y compáralo. Si cuadra, tu inventario está bien y el problema es de **lectura** (causas 1, 2 o 5).
2. **¿Hay renglones duplicados?** Agrupa por producto y almacén. Más de uno es la causa 2.
3. **¿El total del producto coincide con la suma de sus tallas?** Si no, causa 1.
4. **¿Las existencias en negativo tienen su primera venta antes de su primera entrada?** Causa 3.
5. **¿Hay almacenes con el mismo nombre normalizado?** Causa 4.
6. **Solo entonces** cuenta físicamente y busca merma, robo o error de captura.

El orden importa: un conteo físico sobre un sistema con la causa 1 o 2 te va a dar un número que vuelve a descuadrarse a la semana, porque no arreglaste nada.

## Qué se hizo, y qué cuesta no hacerlo

En el caso, la reparación fue en este orden —y no se puede alterar:

1. **Limpiar los renglones partidos**, usando el registro de movimientos como juez: se conserva el que cuadra con la historia, no el más reciente. Donde no había evidencia, no se tocó.
2. **Instalar el candado** que impide que vuelvan a crearse. Antes no se podía; después de limpiar, sí.
3. **Cambiar la pantalla** para que lea la suma de las tallas y no el total derivado.
4. **Completar el registro** para que las ventas escriban la talla.

Resultado verificado después: los 190 renglones de existencia del evento cuadran con su registro de movimientos, y cero renglones partidos.

Lo que no se hizo —y es importante— es ajustar ningún número a mano. **Un ajuste sin conteo físico detrás no arregla el inventario: lo blanquea.** Las 133 piezas en negativo quedaron para conteo, porque son una diferencia real de mercancía y merecen que alguien la cuente.

## Lo que te llevas

Si tu sistema y tu tienda no coinciden, el reflejo es contar. **Cuenta al final, no al principio.** Primero averigua si lo que falla es el inventario o la pantalla, porque son problemas distintos y solo uno se arregla contando.

Y si operas puntos de venta temporales —ferias, eventos, pop-ups— la regla que más piezas salva no es tecnológica: **captura la transferencia antes de abrir el punto.** Dos horas de ventaja en el cobro se convierten en semanas de cuadre después.

## Preguntas frecuentes

**¿Por qué mi sistema muestra existencia si el producto no está en la tienda?**
Por dos familias de razones que se arreglan distinto. O el inventario está bien y la pantalla lee un número derivado que dejó de actualizarse —causas 1 y 2—, o el inventario está mal porque se vendió sin registrar la entrada —causa 3—. Lo primero que hay que averiguar es cuál de las dos.

**¿Cómo sé si el problema es del sistema o de mi operación?**
Suma entradas menos salidas por producto y almacén en tu registro de movimientos y compáralo con la existencia. Si cuadra, tu operación está bien y el problema es de lectura. Si no cuadra, es operativo.

**¿Puede haber existencias en negativo?**
Físicamente no, pero el sistema las muestra cuando se cobró mercancía que nunca se registró como recibida en ese punto. Es el síntoma más claro de la causa 3.

**¿Debo hacer un conteo físico para arreglarlo?**
Sí, pero al final. Un conteo sobre un sistema que todavía tiene la causa 1 o 2 vuelve a descuadrarse en días, porque el conteo no arregló lo que lo producía.

**¿Por qué el saldo de mi registro de movimientos brinca?**
Casi siempre porque varias tallas del mismo producto se escriben bajo un solo nombre. Son varias cuentas intercaladas en el mismo renglón; cada una es correcta, pero juntas no se pueden leer.

---

*Este análisis salió de una revisión real sobre el registro completo de movimientos de la cuenta de LiveShows Merchandising —950,639 movimientos— y los 3,688 del evento de Laufey en el Palacio de los Deportes del 12 de septiembre de 2026. Publicado con su autorización: el caso se cuenta con nombre porque la lección le sirve a cualquiera que monte puntos de venta temporales, y porque fue su reporte el que lo destapó.*

**Fuentes citadas:**
- [Auburn University RFID Lab — exactitud de inventario en tienda](https://cybra.com/average-retailer-inventory-accuracy/)
- [ECR Retail Loss — Measuring the Sales Impact of Improving Inventory Records](https://www.ecrloss.com/research/grow-sales-by-improving-inventory-records/)
