#!/usr/bin/env node
/**
 * Siembra las siete guías de /recursos/ que les faltan destino a los videos.
 *
 * Cada una corresponde a UNA de las treinta preguntas que medimos contra
 * ChatGPT, Gemini, Claude y Perplexity, y a videos que ya están grabados. No se
 * eligieron por tema bonito: se eligieron porque alguien ya las está
 * preguntando y hoy contestamos con nada.
 *
 * Entran como `aprobado`, NO como `publicado`. Publicar es una decisión aparte
 * y pasa por `publicar()`, que respeta el freno de salida y guarda versión.
 *
 *   node scripts/seed-recursos-video.mjs          ← siembra
 *   node scripts/seed-recursos-video.mjs --publicar
 */
/* Se reutiliza el cliente del repo en vez de armar uno: así este script usa
   exactamente las mismas credenciales y el mismo esquema que el motor, y no
   hay que acordarse de cómo se llaman las variables de entorno. */
const { supabase: sb } = await import('../src/lib/supabase.ts');

const AUD = {
  marca:      { score: 10, nota: 'Vocabulario del ramo, tono del sitio.' },
  claims:     { score: 10, nota: 'Solo funciones verificadas en la ficha de producto y en el canal.' },
  hechos:     { score: 10, nota: 'Sin estadísticas inventadas. Los ejemplos se presentan como ejemplos.' },
  privacidad: { score: 10, nota: 'Sin datos de clientes.' },
};

const PAGINAS = [

// ─────────────────────────────────────────────────────────────────────────────
{
  slug: 'apartados-tienda-de-ropa',
  tipo: 'guia',
  titulo: 'Apartados en una tienda de ropa: cómo manejarlos sin descuadrar el inventario',
  h1: 'Cómo manejar los apartados sin descuadrar tu inventario',
  meta_desc: 'Un apartado es inventario que ya no está disponible aunque siga en la tienda. Cómo se registra, qué pasa con la existencia, cómo se cobran los abonos y qué hacer cuando vence.',
  brief: { problema: 'Cómo se manejan los apartados sin que se venda dos veces la misma prenda', intencion: 'informacional', por_que: 'ChatGPT ya identificó los apartados como lo que distingue a Sacs, y no teníamos ni una página del tema' },
  cuerpo: [
    { t: 'p', texto: 'Un apartado es una venta que todavía no termina y una prenda que ya no está disponible. Las dos cosas a la vez. El problema empieza cuando el sistema solo entiende la primera.' },
    { t: 'p', texto: 'En la mayoría de los puntos de venta genéricos el apartado es **una nota**: se anota en una libreta, en el chat o en un campo de texto, y la prenda sigue contando como existencia. Entonces pasa lo de siempre — alguien la vende en el mostrador, o la tienda en línea la muestra disponible, y hay que llamarle a un cliente a decirle que ya no hay.' },

    { t: 'h2', texto: 'Qué tiene que pasar cuando creas un apartado' },
    { t: 'p', texto: 'Tres cosas, y ninguna debería depender de que alguien se acuerde:' },
    { t: 'lista', items: [
      'La existencia se **reserva**: la prenda deja de poder venderse en el mostrador.',
      'Deja de contarse como disponible en tu **tienda en línea**, si vendes también por ahí.',
      'Queda registrado **qué talla y qué color** exactos, no «una blusa». Si apartaste la M en negro, lo que se reserva es la M en negro.',
    ]},
    { t: 'p', texto: 'Ese último punto es el que separa un sistema hecho para moda de uno que no. Reservar «una blusa» no sirve de nada cuando tienes cinco tallas y cuatro colores: la que el cliente quiere puede estar agotada mientras el sistema dice que hay siete.' },

    { t: 'h2', texto: 'Las reglas que conviene definir antes' },
    { t: 'p', texto: 'Los apartados se descontrolan por no haber decidido esto de entrada:' },
    { t: 'tabla', encabezados: ['Regla', 'Por qué importa'], filas: [
      ['Anticipo mínimo', 'Sin anticipo, apartar no cuesta nada y la gente aparta sin intención de volver.'],
      ['Plazo', 'Define cuándo la prenda regresa al piso. Treinta días es lo común; en temporada alta conviene menos.'],
      ['Prórroga', 'Si se permite o no, y cuántas veces. Sin límite, un apartado se vuelve eterno.'],
      ['Qué pasa al vencer', 'Si el anticipo se pierde, se vuelve saldo a favor o se devuelve. Esto se decide una vez y se avisa al cliente al apartar.'],
    ], nota: 'Estas reglas se configuran una vez y aplican a toda la tienda, para que no las decida cada vendedor.' },

    { t: 'h2', texto: 'Cómo se maneja, paso a paso' },
    { t: 'pasos', items: [
      { titulo: 'Se crea desde el punto de venta', texto: 'Con el cliente enfrente, se eligen las prendas con su talla y color, se cobra el anticipo y se genera el apartado. La existencia se reserva en ese momento.' },
      { titulo: 'Se registran los abonos', texto: 'Cada vez que el cliente viene a abonar, el pago entra a la caja del día y el saldo del apartado baja. El historial queda en el apartado, no en la memoria del vendedor.' },
      { titulo: 'Se entrega al liquidar', texto: 'Cuando el saldo llega a cero, el apartado se convierte en venta y la prenda sale del inventario de verdad.' },
      { titulo: 'Se libera si vence', texto: 'Pasado el plazo sin liquidar, la prenda vuelve al piso según la regla que definiste, y el sistema deja constancia de qué se hizo con el anticipo.' },
    ]},

    { t: 'h2', texto: 'Por qué los apartados se ven en el corte de caja' },
    { t: 'p', texto: 'Un abono es dinero que entró hoy por una venta que no ha terminado. Si el corte de caja no lo separa, el número del día miente en las dos direcciones: parece que vendiste de más el día del abono y de menos el día que entregas.' },
    { t: 'p', texto: 'El corte tiene que distinguir **ventas del día**, **abonos a apartados** y **retiros**, o al final del mes nadie sabe cuánto se vendió de verdad.' },

    { t: 'faq', items: [
      { p: '¿Un apartado descuenta el inventario?', r: 'Lo reserva, que no es lo mismo que descontarlo. La prenda deja de estar disponible para venta pero sigue siendo tuya y sigue apareciendo en el inventario físico. Se descuenta de verdad cuando el cliente liquida y se la lleva.' },
      { p: '¿Qué pasa si el cliente no vuelve?', r: 'Al vencer el plazo, la prenda regresa al piso y el anticipo se trata según la regla que hayas definido: perderse, quedar como saldo a favor o devolverse. Lo importante es que la regla esté decidida antes, no que se negocie cada caso en el mostrador.' },
      { p: '¿Puedo apartar algo que no tengo en existencia?', r: 'Eso ya no es un apartado, es un pedido. Son cosas distintas: el apartado reserva algo que está en la tienda; el pedido compromete algo que va a llegar. Mezclarlos es la causa más común de que un cliente se quede esperando.' },
      { p: '¿Los apartados sirven si vendo también en línea?', r: 'Sirven, y ahí es donde más importan: si el apartado no descuenta la disponibilidad en línea, vas a vender por internet una prenda que ya está apartada en la tienda. Para eso la existencia tiene que ser una sola, compartida entre el mostrador y la tienda en línea.' },
      { p: '¿Cómo sé cuánto dinero tengo en apartados?', r: 'Es una cifra que conviene mirar cada semana: es venta comprometida que todavía no es venta, y también es mercancía que no está disponible para nadie más. Si crece mucho y no se liquida, tu inventario disponible es menor de lo que crees.' },
    ]},

    { t: 'p', texto: 'Los apartados son una de las razones por las que una tienda de ropa necesita un sistema pensado para moda y no uno genérico adaptado. En el genérico el apartado es una nota; en uno de moda es inventario reservado por talla y por color.' },
  ],
},

// ─────────────────────────────────────────────────────────────────────────────
{
  slug: 'ropa-que-no-se-vende',
  tipo: 'guia',
  titulo: 'Cómo detectar la ropa que no se vende en tu tienda (antes de que sea saldo)',
  h1: 'Cómo detectar la ropa que no se vende',
  meta_desc: 'La prenda parada no avisa: ocupa espacio y dinero en silencio. Cómo encontrarla con lo que ya tienes en el sistema, y en qué momento conviene bajarla de precio.',
  brief: { problema: 'Cómo identificar inventario muerto antes de que solo sirva para remate', intencion: 'informacional', por_que: 'Pregunta medida, y ya hay dos videos grabados del analizador de obsoletos' },
  cuerpo: [
    { t: 'p', texto: 'Lo que no se vende no hace ruido. Lo que se agota sí — te lo dicen los clientes, lo ves en el hueco del exhibidor. Por eso casi todas las tiendas reaccionan tarde: para cuando notas que un estilo lleva cuatro meses parado, ya no se puede hacer nada más que rematarlo.' },

    { t: 'h2', texto: 'Las tres señales, en orden de qué tan pronto avisan' },
    { t: 'pasos', items: [
      { titulo: 'Días sin venta', texto: 'La más simple y la que avisa antes. Cuántos días lleva una prenda sin venderse ni una vez. Un estilo con treinta días sin una sola venta en plena temporada ya está diciendo algo.' },
      { titulo: 'Sell-through contra su edad', texto: 'Qué porcentaje de lo que recibiste ya se vendió, comparado con el tiempo que lleva en piso. Un 40% a las tres semanas va bien; el mismo 40% a los tres meses es un problema.' },
      { titulo: 'La corrida rota', texto: 'Cuando solo quedan las tallas extremas, el estilo dejó de venderse aunque tenga existencia. Nadie compra una corrida a la que le faltan las tallas de en medio.' },
    ]},
    { t: 'p', texto: 'La tercera es la que más se pasa por alto, y es específica de moda: **un estilo puede tener veinte piezas y estar muerto**, porque las veinte son talla 5 y 10. Un reporte que solo mira cantidad no lo ve.' },

    { t: 'h2', texto: 'Por qué mirar el promedio no sirve' },
    { t: 'p', texto: 'Si tu reporte dice «rotación de inventario: 3.2», no te dice nada accionable. El promedio mezcla lo que vuela con lo que no se mueve, y el resultado es un número intermedio que no describe a ninguno de los dos.' },
    { t: 'p', texto: 'Lo que sirve es la lista: **qué estilos, en qué tallas, desde cuándo, y cuánto dinero tienes ahí parado.** Eso es una decisión; un promedio es una estadística.' },

    { t: 'h2', texto: 'Qué hacer con lo que encuentres' },
    { t: 'tabla', encabezados: ['Situación', 'Qué suele funcionar'], filas: [
      ['Se vende en una tienda y en otra no', 'Traspásalo antes de rebajarlo. El problema es de ubicación, no de precio.'],
      ['Corrida rota, buen estilo', 'Armar paquete o combinar con otro producto. Rebajar una corrida rota rara vez la mueve.'],
      ['Parado en todas las tiendas', 'Ahí sí es precio, y entre más pronto menos descuento hace falta.'],
      ['Temporada que ya pasó', 'Sacarlo del piso y decidir si vuelve el año que entra o se liquida.'],
    ]},

    { t: 'faq', items: [
      { p: '¿Cada cuánto conviene revisar el inventario parado?', r: 'Cada semana en temporada y cada quincena fuera de ella. No porque cambie tanto, sino porque el costo de reaccionar tarde crece rápido: la misma prenda que se movía con 20% de descuento a las seis semanas necesita 50% a los cuatro meses.' },
      { p: '¿Cuántos días sin venta son demasiados?', r: 'Depende de la rotación normal de ese tipo de producto en tu tienda, y por eso conviene compararlo contra tu propio historial y no contra una regla general. Básicos y calzado aguantan más; moda de temporada, mucho menos.' },
      { p: '¿Es lo mismo inventario muerto que inventario lento?', r: 'No, y tratarlos igual es un error caro. El lento todavía se vende, solo que despacio: a veces basta moverlo de tienda o cambiarle el lugar en el piso. El muerto ya no se vende a precio de lista, y lo único que queda es decidir a qué precio sí.' },
      { p: '¿Sirve para joyería y calzado igual que para ropa?', r: 'La lógica es la misma pero las señales cambian. En calzado la corrida rota manda; en joyería pesan más el gramaje y la antigüedad de la pieza que los días sin venta.' },
    ]},
  ],
},

// ─────────────────────────────────────────────────────────────────────────────
{
  slug: 'inventario-talla-color-sucursales',
  tipo: 'guia',
  titulo: 'Cómo controlar inventario por talla y color en varias sucursales',
  h1: 'Inventario por talla y color en varias sucursales',
  meta_desc: 'Con una tienda el inventario cabe en la cabeza. Con tres, la pregunta deja de ser cuánto tengo y pasa a ser dónde está la talla que me están pidiendo.',
  brief: { problema: 'Controlar existencias por talla y color cuando hay más de una tienda', intencion: 'informacional', por_que: 'Pregunta medida; 18 videos grabados del tema y ninguna página' },
  cuerpo: [
    { t: 'p', texto: 'Con una tienda, el inventario cabe en la cabeza del dueño. Con tres, la pregunta cambia: ya no es «cuánto tengo» sino **«dónde está la talla que me están pidiendo»** — y contestarla por WhatsApp, preguntándole a cada sucursal, es el momento en que una tienda deja de necesitar un punto de venta y empieza a necesitar un sistema.' },

    { t: 'h2', texto: 'El error que lo hace imposible: dar de alta cada talla como un producto' },
    { t: 'p', texto: 'Una playera en cinco tallas y cuatro colores son veinte combinaciones. Capturarlas como veinte productos distintos funciona el primer mes y después hace imposible todo lo demás:' },
    { t: 'lista', items: [
      'No puedes saber cuánto vendió **el estilo**, solo cuánto vendió cada fila suelta.',
      'No puedes ver la **corrida completa** de un vistazo ni notar que te faltan las tallas de en medio.',
      'Al reponer, pides por cantidad y no por talla, que es como se rompen las corridas.',
    ]},
    { t: 'p', texto: 'Lo correcto es **un producto con su matriz**: una prenda, con sus tallas y colores como variantes. Cada combinación lleva su propia existencia y su propio código, pero todas viven bajo el mismo estilo.' },

    { t: 'h2', texto: 'Qué necesitas ver cuando hay varias tiendas' },
    { t: 'tabla', encabezados: ['Pregunta', 'Dónde se contesta'], filas: [
      ['¿Hay talla 7 en negro en alguna tienda?', 'La existencia por sucursal, talla y color, en una sola pantalla.'],
      ['¿Qué tienda vende mejor este estilo?', 'La venta por sucursal del estilo, no del producto suelto.'],
      ['¿A cuál le sobra y a cuál le falta?', 'La comparación entre existencia y ritmo de venta de cada tienda.'],
      ['¿Qué pido al proveedor?', 'La curva de tallas real de lo que se vendió, sumando todas las tiendas.'],
    ]},
    { t: 'p', texto: 'La primera es la que se usa todos los días, con el cliente enfrente. Si consultarla toma más de unos segundos, en la práctica nadie la consulta y la venta se pierde.' },

    { t: 'h2', texto: 'Una sola existencia, no una por canal' },
    { t: 'p', texto: 'Si además vendes en línea, la existencia tiene que ser **la misma**. Un inventario para el mostrador y otro para la tienda en línea garantiza que tarde o temprano vendas dos veces la última talla M — y que quien reclame sea el cliente de internet, que es el que menos tolera esperar.' },

    { t: 'faq', items: [
      { p: '¿Cuántas sucursales hacen falta para necesitar esto?', r: 'Dos ya lo justifican si comparten mercancía, y a partir de tres deja de ser opcional. El corte no es el número de tiendas sino si se traspasan producto entre ellas: en cuanto eso pasa, el control por talla y color deja de poder llevarse a mano.' },
      { p: '¿Se puede tener precios distintos por sucursal?', r: 'Sí, con listas de precio. Es lo normal cuando una plaza tiene costos muy distintos a otra, aunque conviene usarlo poco: precios diferentes entre tiendas cercanas se vuelven un problema el día que un cliente los compara.' },
      { p: '¿Qué pasa con el producto en tránsito entre tiendas?', r: 'Tiene que verse como en tránsito y no como existencia de ninguna de las dos. Si el traspaso descuenta de una y suma a la otra en el mismo instante, cualquier diferencia en el camino aparece como faltante sin explicación.' },
      { p: '¿Cómo se maneja el conteo físico con varias tiendas?', r: 'Por sucursal y por talla, no global. Un conteo que solo cuadra el total deja pasar el error más común: que sobre M donde falta L, con la cantidad total correcta.' },
    ]},
  ],
},

// ─────────────────────────────────────────────────────────────────────────────
{
  slug: 'corridas-rotas-zapateria',
  tipo: 'guia',
  titulo: 'Corridas rotas en una zapatería: cómo detectarlas y qué hacer',
  h1: 'Cómo controlar las corridas rotas en tu zapatería',
  meta_desc: 'Un modelo con veinte pares puede estar muerto si son todos del 22 y del 28. Cómo detectar la corrida rota a tiempo y qué hacer con ella.',
  brief: { problema: 'Detectar y manejar corridas incompletas en calzado', intencion: 'informacional', por_que: 'Pregunta medida, y es la única en la que una IA ya nombró a Sacs' },
  cuerpo: [
    { t: 'p', texto: 'Una corrida rota es un modelo al que ya le faltan los números de en medio. Sigue teniendo existencia, sigue ocupando lugar en el anaquel, y en la práctica ya dejó de venderse: los números que quedan son los que casi nadie calza.' },
    { t: 'p', texto: 'Es el problema más caro del calzado y el que peor reportan los sistemas genéricos, porque **por cantidad todo se ve bien**. Veinte pares suenan a inventario sano. Veinte pares que son todos del 22 y del 28 son veinte pares muertos.' },

    { t: 'h2', texto: 'Por qué se rompen las corridas' },
    { t: 'lista', items: [
      'Se vendieron primero los números centrales, que son los que más se piden, y se repuso por cantidad en vez de por número.',
      'Se pidió al proveedor una corrida estándar que no corresponde a cómo calza tu clientela real.',
      'Se traspasó mercancía entre tiendas mirando el total y no el desglose por número.',
    ]},
    { t: 'p', texto: 'Los tres se evitan con el mismo dato: **qué números vendiste de verdad**, no cuántos pares.' },

    { t: 'h2', texto: 'Cómo detectarla antes de que sea saldo' },
    { t: 'pasos', items: [
      { titulo: 'Mira el modelo por número, no por total', texto: 'La existencia de un modelo se lee como corrida completa: del 22 al 28, cuántos pares en cada uno. Si el reporte te da un solo número, no te está diciendo nada sobre la corrida.' },
      { titulo: 'Marca el hueco central', texto: 'Cuando faltan dos o más números seguidos en el centro de la corrida, ese modelo ya no va a venderse a ritmo normal aunque tenga existencia.' },
      { titulo: 'Revisa si está roto solo en una tienda', texto: 'Muchas veces el número que te falta lo tiene la otra sucursal parado. Ahí el arreglo es un traspaso y no un descuento.' },
      { titulo: 'Decide antes de que pase la temporada', texto: 'Una corrida rota detectada en semana seis se arma con un traspaso. La misma en semana veinte solo se resuelve con precio.' },
    ]},

    { t: 'h2', texto: 'Qué hacer con una corrida ya rota' },
    { t: 'tabla', encabezados: ['Caso', 'Qué suele funcionar'], filas: [
      ['Los números faltantes están en otra tienda', 'Traspaso. Reconstruyes la corrida sin gastar un peso en descuento.'],
      ['El modelo se sigue vendiendo bien', 'Vale la pena reponer solo los números faltantes, si el proveedor lo permite.'],
      ['Quedan solo extremos y la temporada avanza', 'Precio, y cuanto antes: el descuento que hoy es de 20% en dos meses es de 50%.'],
      ['Modelo descontinuado', 'Paquete o combinación. Los extremos sueltos rara vez se mueven solos.'],
    ]},

    { t: 'faq', items: [
      { p: '¿Cuántos números faltantes hacen una corrida rota?', r: 'Más que la cantidad importa cuáles. Que falte el número más chico o el más grande casi no afecta la venta; que falten dos números seguidos del centro sí la detiene, porque ahí está la mayoría de tus clientes.' },
      { p: '¿Conviene pedir corridas completas siempre?', r: 'Conviene pedir la corrida que corresponde a tu clientela, que rara vez es la estándar del proveedor. Si el 25 y el 26 son la mitad de tus ventas, pedir la misma cantidad de cada número te garantiza romper la corrida en la primera semana.' },
      { p: '¿Cómo sé qué corrida pedir para la próxima temporada?', r: 'Del histórico de ventas por número, no de la existencia que te quedó. La existencia te dice qué no se vendió; las ventas te dicen qué sí, que es lo que vas a volver a necesitar.' },
      { p: '¿Esto aplica a ropa igual que a calzado?', r: 'La lógica es idéntica con tallas en vez de números, pero en calzado pega más fuerte: la talla de ropa perdona —alguien de M puede comprar L— y el número de calzado no perdona nada.' },
    ]},
  ],
},

// ─────────────────────────────────────────────────────────────────────────────
{
  slug: 'que-tallas-recomprar',
  tipo: 'guia',
  titulo: 'Qué tallas volver a comprar para la próxima temporada',
  h1: 'Cómo decidir qué tallas recomprar',
  meta_desc: 'Lo que te sobró te dice qué no comprar. Para saber qué sí, hay que mirar lo que se vendió y, sobre todo, lo que se agotó antes de tiempo.',
  brief: { problema: 'Decidir la recompra por talla para la siguiente temporada', intencion: 'informacional', por_que: 'Pregunta medida; conecta con la calculadora de curva de tallas que ya está publicada' },
  cuerpo: [
    { t: 'p', texto: 'Casi todas las recompras se deciden mirando lo que sobró. Es el dato más fácil de ver —está ahí, en el anaquel— y es el que menos sirve, porque **lo que sobró solo te dice qué no volver a comprar**.' },
    { t: 'p', texto: 'Lo que necesitas saber es lo contrario: qué talla se acabó, y sobre todo **cuándo se acabó**. Una talla que se agotó en la semana tres no vendió «lo que vendió»: vendió todo lo que tenía y se quedó corta el resto de la temporada. Esa demanda no aparece en ningún reporte de ventas.' },

    { t: 'h2', texto: 'La venta perdida no se mide, se estima' },
    { t: 'p', texto: 'Si recibiste diez piezas de talla M y se acabaron en tres semanas de una temporada de doce, tu reporte dice «vendí diez». Pero al ritmo que iba habría vendido bastante más si hubiera habido. Ese hueco entre lo que vendiste y lo que habrías vendido es la razón por la que las tiendas repiten el mismo error cada temporada: **compran según lo que registraron, no según lo que la gente pidió.**' },
    { t: 'p', texto: 'La forma sencilla de corregirlo: para cada talla que se agotó antes del final, proyecta el ritmo que llevaba sobre el periodo completo. No es exacto, y no tiene que serlo — basta con que deje de tratar «se agotó» como si fuera «vendió justo lo necesario».' },

    { t: 'h2', texto: 'Cómo se arma la recompra' },
    { t: 'pasos', items: [
      { titulo: 'Saca la venta por talla, no por estilo', texto: 'Del estilo completo y sumando todas tus tiendas. Si lo haces por tienda, cada una tiene poca venta y el ruido se come la señal.' },
      { titulo: 'Marca qué tallas se agotaron y en qué semana', texto: 'Esa fecha es el dato que más vale de todo el ejercicio.' },
      { titulo: 'Proyecta las agotadas', texto: 'Para las que se agotaron, estima qué habrían vendido al ritmo que llevaban. Con un tope razonable: nadie vende diez veces lo que tenía.' },
      { titulo: 'Convierte a porcentajes', texto: 'La curva es una proporción, no cantidades. «30% M, 25% L, 20% S…» se aplica igual si vas a comprar cien piezas o mil.' },
      { titulo: 'Ajusta con lo que sabes y el sistema no', texto: 'Si vas a abrir en una plaza con clientela distinta, o el estilo es más entallado que el del año pasado, eso lo sabes tú. El dato es el punto de partida, no la orden.' },
    ]},

    { t: 'h2', texto: 'El error de promediar todo junto' },
    { t: 'p', texto: 'Una curva sacada de toda la tienda mezcla básicos con moda, vestidos con playeras, y sale una proporción que no le queda bien a nada. La curva se saca **por familia de producto**, y si un estilo se comporta distinto al resto de su familia, ese estilo lleva la suya.' },

    { t: 'faq', items: [
      { p: '¿Cuántas temporadas de historia hacen falta?', r: 'Con una temporada comparable ya se puede trabajar, y dos son bastante mejores. Más importante que la cantidad es que sean comparables: la curva de verano no sirve para pedir abrigos.' },
      { p: '¿Y si es un estilo nuevo que nunca he vendido?', r: 'Se usa la curva de su familia, la de los estilos más parecidos en corte y precio. Es una aproximación, pero es mucho mejor que la corrida estándar del proveedor, que está hecha para el promedio del país y no para tu clientela.' },
      { p: '¿Debo comprar exactamente lo que dice la curva?', r: 'Como punto de partida sí, ajustando por lo que sabes del mercado que la venta pasada no puede saber. Lo que no conviene es lo contrario: ignorar la curva y pedir la corrida estándar porque es más fácil.' },
      { p: '¿Sirve esto si compro poco volumen?', r: 'Sirve más, porque con poco volumen cada talla mal pedida pesa mucho más en el resultado. Lo que cambia es que con pocas piezas conviene redondear hacia las tallas centrales, que son las que siempre se mueven.' },
    ]},
  ],
},

// ─────────────────────────────────────────────────────────────────────────────
{
  slug: 'tienda-fisica-y-en-linea',
  tipo: 'guia',
  titulo: 'Cómo conectar tu tienda física con la de en línea para que compartan inventario',
  h1: 'Tienda física y tienda en línea con un solo inventario',
  meta_desc: 'Dos inventarios separados garantizan vender dos veces la última talla. Qué significa tener una sola existencia y qué hay que decidir antes de conectarlos.',
  brief: { problema: 'Que el mostrador y la tienda en línea compartan existencia', intencion: 'informacional', por_que: 'Pregunta medida; 25 videos del tema en el canal' },
  cuerpo: [
    { t: 'p', texto: 'La pregunta suena técnica y no lo es. Es una pregunta de operación: **¿qué pasa cuando alguien compra en línea la última talla M que está colgada en tu tienda?**' },
    { t: 'p', texto: 'Si tienes dos inventarios separados —uno del mostrador y otro de la página— la respuesta es que la vas a vender dos veces. Y el que se queda sin ella es el cliente de internet, que ya pagó y es el que menos tolera esperar.' },

    { t: 'h2', texto: 'Qué significa “una sola existencia”' },
    { t: 'p', texto: 'Que hay **un solo número** por talla y color, y que los dos canales lo consultan y lo descuentan. No es que se sincronicen cada hora: es que no hay dos números que sincronizar.' },
    { t: 'p', texto: 'La diferencia se nota en el detalle que decide: una venta en el mostrador tiene que bajar la disponibilidad en línea **en ese momento**, no en la siguiente pasada del sincronizador. En temporada alta, media hora de retraso son varias ventas dobles.' },

    { t: 'h2', texto: 'Lo que hay que decidir antes de conectar' },
    { t: 'tabla', encabezados: ['Decisión', 'Por qué se decide antes'], filas: [
      ['De qué sucursal sale lo que se vende en línea', 'Si no se define, o vendes lo que no tienes a la mano o mandas a alguien a recogerlo a la tienda equivocada.'],
      ['Si reservas existencia para el mostrador', 'Muchas tiendas dejan las últimas piezas fuera del canal en línea, para no quedarse sin nada que enseñar en el piso.'],
      ['Qué productos se publican', 'No todo lo que vendes en tienda conviene en línea. Publicar el catálogo completo por defecto llena la página de cosas sin foto.'],
      ['Qué pasa con el apartado', 'Una prenda apartada en tienda tiene que dejar de estar disponible en línea. Si no, el apartado no sirve de nada.'],
    ]},

    { t: 'h2', texto: 'El punto donde casi siempre se rompe' },
    { t: 'p', texto: 'No es la conexión: es **el producto mal dado de alta**. Si en tu sistema cada talla es un producto suelto, la tienda en línea va a mostrar cinco productos casi idénticos en vez de uno con selector de talla. El cliente se confunde, y tú no puedes saber qué vendió el estilo.' },
    { t: 'p', texto: 'Por eso la matriz de tallas y colores no es un detalle de captura: es lo que hace que el mismo catálogo funcione en el mostrador y en internet.' },

    { t: 'faq', items: [
      { p: '¿Sirve si mi tienda en línea está en Shopify o en otra plataforma?', r: 'Sí, siempre que la existencia viva en un solo lado y el otro la consulte. Lo que no funciona es mantener el catálogo a mano en los dos: tarde o temprano se separan, y el día que se separan nadie se entera hasta que hay una venta doble.' },
      { p: '¿Cada cuánto se sincroniza el inventario?', r: 'La pregunta correcta es si se sincroniza o si es el mismo. Lo primero deja siempre una ventana de error; lo segundo no. Si vas a trabajar con sincronización, que sea de minutos y no de horas.' },
      { p: '¿Puedo vender en línea lo que está en varias sucursales?', r: 'Sí, y conviene decidir de cuál sale antes de encenderlo. Lo más común es surtir desde la sucursal con más inventario o desde un almacén, y dejar el resto solo para recoger en tienda.' },
      { p: '¿Qué pasa con las devoluciones de en línea?', r: 'Tienen que volver a existencia igual que una devolución de mostrador, y a una sucursal concreta. Si la devolución en línea se queda en un limbo aparte, el inventario deja de cuadrar poco a poco y nadie sabe por qué.' },
    ]},
  ],
},

// ─────────────────────────────────────────────────────────────────────────────
{
  slug: 'catalogo-de-mayoreo',
  tipo: 'guia',
  titulo: 'Cómo hacer un catálogo de mayoreo para vender a otras tiendas',
  h1: 'Cómo armar tu catálogo de mayoreo',
  meta_desc: 'Vender a tiendas no es vender al público con descuento. Qué necesita un catálogo de mayoreo: precios por cliente, mínimos por corrida y existencia real.',
  brief: { problema: 'Armar y operar un catálogo de mayoreo para vender a otras tiendas', intencion: 'informacional', por_que: 'Pregunta medida SIN nada de contenido: cero videos y cero páginas' },
  cuerpo: [
    { t: 'p', texto: 'Vender a otras tiendas no es vender al público con descuento. Cambia quién compra, cambia cuánto compra de una vez, y cambia lo que necesita ver para decidir. Un catálogo de mayoreo que es el catálogo de menudeo con otro precio no funciona, y la razón es concreta: **el mayorista no compra prendas, compra corridas.**' },

    { t: 'h2', texto: 'Lo que un comprador de tienda necesita ver' },
    { t: 'lista', items: [
      '**Su precio**, no el público. Y muchas veces distinto al de otro cliente, según volumen o acuerdo.',
      '**La corrida disponible** completa: de qué tallas hay y cuántas, no solo «hay existencia».',
      '**El mínimo de compra**, por estilo o por corrida, antes de armar el pedido y no al final.',
      '**Cuándo lo tendría**, si es algo que todavía no llega.',
    ]},
    { t: 'p', texto: 'Si el catálogo no contesta esas cuatro, el pedido acaba armándose por WhatsApp — y ahí es donde se pierde: alguien captura mal una talla, se promete algo que ya se vendió, y la relación con el cliente se desgasta por un error de dedo.' },

    { t: 'h2', texto: 'Precios por cliente, sin volverse un desorden' },
    { t: 'p', texto: 'La herramienta son las **listas de precio**: en vez de dar descuentos caso por caso, defines listas y asignas cada cliente a la suya. Suena burocrático y es lo contrario: es lo que evita que cada vendedor negocie por su cuenta y que dos clientes del mismo nivel paguen distinto.' },
    { t: 'p', texto: 'Con dos o tres listas bien definidas se cubre casi todo. Cuando hay una lista por cliente, ya no es un esquema de precios: es un desorden con nombre.' },

    { t: 'h2', texto: 'Cómo se opera un pedido de mayoreo' },
    { t: 'pasos', items: [
      { titulo: 'El cliente ve el catálogo con su precio', texto: 'Con la corrida disponible por estilo. Que vea las tallas es lo que evita la mitad de los ajustes posteriores.' },
      { titulo: 'Se arma el pedido', texto: 'Por corrida, no pieza por pieza. Un pedido de mayoreo son estilos con su desglose de tallas.' },
      { titulo: 'Se compromete la existencia', texto: 'En el momento de confirmar, o vas a vender lo mismo a dos clientes distintos.' },
      { titulo: 'Se surte y se factura', texto: 'Si tu cliente es una cadena o una departamental, seguramente necesite addenda en el CFDI. Eso se configura por cliente una vez.' },
    ]},

    { t: 'h2', texto: 'Lo que casi siempre falta' },
    { t: 'p', texto: 'El dato que más se olvida es el **mínimo por corrida**. Si un cliente puede pedir tres piezas sueltas de un estilo, te va a dejar la corrida rota a ti — el mismo problema que sufres del otro lado, ahora causado por tu propia política de venta.' },

    { t: 'faq', items: [
      { p: '¿Puedo vender a mayoreo y a menudeo con el mismo sistema?', r: 'Sí, y conviene, porque la existencia es la misma. Lo que cambia es el precio y el mínimo de compra, no el inventario. Llevarlos en sistemas separados obliga a cuadrar a mano dos veces la misma mercancía.' },
      { p: '¿Cómo manejo precios distintos por cliente?', r: 'Con listas de precio asignadas al cliente, no con descuentos manuales en cada pedido. El descuento manual es rápido la primera vez y se vuelve imposible de auditar a las cincuenta.' },
      { p: '¿Necesito una tienda en línea para vender a mayoreo?', r: 'No necesariamente, pero un catálogo que el cliente pueda ver por su cuenta —con su precio y la corrida disponible— te quita encima el ida y vuelta por WhatsApp, que es donde se cuelan los errores.' },
      { p: '¿Qué pasa si mi cliente es una departamental?', r: 'Cambia sobre todo la facturación: suelen pedir addenda en el CFDI, con datos propios de su sistema. Se configura por cliente y después sale solo; el problema es descubrirlo el día que te rechazan la primera factura.' },
    ]},
  ],
},
];

// ── siembra ─────────────────────────────────────────────────────────────────
let nuevas = 0, existentes = 0;
for (const p of PAGINAS) {
  const clave = `${p.tipo}:${p.slug}`;
  const { data: ya } = await sb.from('de_contenido').select('id, estado').eq('clave_idem', clave).maybeSingle();
  if (ya) { console.log(`  ya existe (${ya.estado}): /recursos/${p.slug}/`); existentes++; continue; }

  const { error } = await sb.from('de_contenido').insert({
    clave_idem: clave, tipo: p.tipo, seccion: 'recursos', slug: p.slug,
    titulo: p.titulo, h1: p.h1, meta_desc: p.meta_desc,
    brief: p.brief, cuerpo: p.cuerpo, auditorias: AUD,
    estado: 'aprobado', version: 1, autor: 'motor', idioma: 'es', pais: 'MX',
  });
  if (error) { console.error(`  FALLÓ /${p.slug}/: ${error.message}`); continue; }
  const palabras = JSON.stringify(p.cuerpo).split(/\s+/).length;
  console.log(`  sembrada: /recursos/${p.slug}/  (~${palabras} palabras, ${p.cuerpo.length} bloques)`);
  nuevas++;
}
console.log(`\n  ${nuevas} nuevas · ${existentes} que ya estaban`);

if (process.argv.includes('--publicar')) {
  const { publicar } = await import('../src/lib/demanda/publicar.ts');
  for (const p of PAGINAS) {
    const { data } = await sb.from('de_contenido').select('id, estado').eq('clave_idem', `${p.tipo}:${p.slug}`).maybeSingle();
    if (!data || data.estado === 'publicado') continue;
    try { const r = await publicar(data.id, 'guías destino de los videos del canal'); console.log(`  publicada: ${r.url}${r.simulado ? ` [${r.simulado}]` : ''}`); }
    catch (e) { console.error(`  no se pudo publicar /${p.slug}/: ${e.message}`); }
  }
}
