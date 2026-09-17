/**
 * Contenido de la landing de ROPA DE TALLAS GRANDES (17-sep-2026). Sale de la ficha del oficio
 * (scratchpad/giros-fichas/tallas-grandes.md) con las cuatro correcciones de pluma del referee
 * aplicadas: la corrida y las de en medio (42-46), correr el tallaje, la fit,
 * el arreglo, el motivo del cambio, "se abomba de la cadera", el porcentaje de cambios (nunca
 * "tasa"), la curva invertida 8-14-20-22-18-11-5-2, el centro que es el 60 % y la 46 para arriba
 * que es el 36 % (la 46 cuenta en los dos cortes), el consumo promedio del trazo, las letras que
 * se acaban en la 48, la media docena surtida 1-2-2-1 y la docena de una sola talla.
 *
 * El eje de la página es el quiebre de la 46: tu 46 no es tu 44 más grande. Son dos patrones
 * base —uno de la 36 a la 44 y otro de la 46 a la 52— porque cambia la proporción, no el tamaño;
 * y por eso el motivo del cambio aquí es el diagnóstico del patrón, no un trámite de devolución.
 * Ningún otro giro puede escribir esa página: lencería escala por banda y copa, uniformes escala
 * parejo, infantil escala por edad y la tienda de ropa cabe entera en un solo bloque.
 *
 * Funciones prometidas que NO están construidas hoy (decisión del dueño 17-sep: se muestran como
 * parte del sistema; se construyen si el cliente las pide): alerta del centro de la corrida
 * descompletado, ficha de medidas por modelo y recomendador "tu talla en este modelo", medidas de
 * la clienta en su ficha, motivo del cambio en dos toques, cambio por talla en línea, paquetería
 * con guía de retorno, venta en vivo con apartado por comentario, orden de arreglo, orden de
 * maquila con los dos bloques de patrón, costeo por talla y consumo del trazo, escalón de precio
 * de la 48 para arriba, etiqueta por variante con reimpresión al correr el tallaje, mayoreo con
 * media docena surtida, afiliadas con comisiones y el reporte de "no había su talla".
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockMatriz, mockBarras, mockTicket, mockLista, mockCalendario } from './_mocks';

const IMG = '/images/giros/tallas-grandes';

export const bannerTG = {
  eyebrow: 'SACS · Ropa de tallas grandes',
  titulo: 'La 46 no es la 44 más grande.',
  resalte: 'Son dos patrones base.',
  sub: 'La corrida completa de la 36 a la 52 en una cuadrícula, las medidas de cada modelo para que sepa su talla antes de pagar, y el motivo del cambio que te dice si falló la talla o falló tu patrón — con un mismo inventario para tus tiendas, el vivo y el WhatsApp.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Boutique de tallas grandes con la corrida completa en el riel, los separadores de talla a la vista y la matriz talla por color en la tablet del mostrador',
  avisos: [
    { modulo: 'Las de en medio', texto: 'Vestido de punto negro · 44 y 46 en cero · la 38 y la 52 llenas · traspaso sugerido', pos: 1 as const, tono: 'ambar' as const, sello: 'Hoy' },
    { modulo: 'Motivo del cambio', texto: 'Vestido de lino · 9 de 11 cambios dicen “apretó de sisa” en 48 y 50 · es el patrón', pos: 2 as const, tono: 'azul' as const, sello: 'Bloque alto' },
    { modulo: 'Apartado con reloj', texto: 'Vestido de posada · talla 48 · tercer abono · se entrega con la bastilla del jueves', pos: 3 as const, tono: 'verde' as const, sello: 'Diciembre' },
  ],
};

export const manifiestoTG = {
  intro: 'Sabemos cómo se vende la talla extra',
  frases: [
    'Compras cien piezas y a los diez días ya no tienes <b>44 ni 46</b>: te quedan puras 38 y una 52 que nadie se lleva. El rack se ve lleno y no hay nada que vender.',
    'El proveedor te manda la corrida al revés: te <b>carga de chicas</b> y de la 48 te manda dos. Y si compra en non, además hay que correr el tallaje antes de colgarla.',
    'Vendes un vestido en el vivo, lo apartas en comentarios, y a los veinte minutos lo vendes otra vez en el piso. <b>Quedaste mal con las dos.</b>',
    'En línea <b>de cada diez pedidos te regresan tres o cuatro</b>. No es que no les guste: es que nadie sabe qué talla es en <i>ese</i> modelo.',
    'El taller te escala el patrón de la 38 y te saca una 48 que aprieta de sisa y <b>se le abomba de la cadera</b>. Se te regresa toda la corrida alta: un tercio del modelo.',
    'Llega una clienta que no encontró nada en tres tiendas, se prueba, le queda y se lleva cuatro cosas. Esa clienta <b>vale oro</b> y ni sabes cómo se llama.',
    'Tienes la <b>46</b> en la otra sucursal y no te enteras. Le dices que no hay y se va a comprarla en línea a otro lado.',
    'Lo que más te piden es vestido de fiesta <b>de la 46 para arriba</b>, y es justo lo que nadie te surte y lo que más te tardas en mandar hacer.',
    'Te enseña el teléfono: <b>“allá me sale en $180 y sí hay 5XL”</b>. De precio no le compites, y ella tampoco quiere esperar tres semanas para que le llegue algo que no sabe si le va a quedar. Le compites con que aquí se la prueba hoy, aquí le queda y aquí se la ajustas.',
  ],
  cierre: 'Ningún sistema de ropa entiende que aquí la corrida empieza donde las demás la terminan, que la venta está en las de en medio y que de la 46 para arriba cambia la proporción y no el tamaño. Sacs sí: cada pantalla que sigue funciona igual en el mostrador, en el probador, en el vivo y en el WhatsApp. Y encima puedes poner agentes de IA para que hagan el trabajo repetitivo: el aviso de la talla que se está acabando, el resurtido del centro de la corrida y el mensaje de “ya llegó en 48” a quien la estaba esperando.',
};

export const variantesTG = {
  eyebrow: 'Un solo modelo',
  titulo: 'Esto es lo que de verdad hay detrás de',
  resalte: '“el vestido negro”.',
  sub: 'De la 38 a la 52 son ocho tallas, y las de en medio —42, 44 y 46— son el 60 % de la venta. En cuatro colores son 32 existencias de un solo modelo, y la corrida se descompleta por el centro, nunca por las orillas.',
  ejeA: ['38', '40', '42', '44', '46', '48', '50', '52'],
  filas: [
    { nombre: 'Negro', img: `${IMG}/prod-negro.webp`, alt: 'Vestido de punto negro de talla extra' },
    { nombre: 'Rojo', img: `${IMG}/prod-rojo.webp`, alt: 'Vestido de punto rojo de talla extra' },
    { nombre: 'Azul', img: `${IMG}/prod-azul.webp`, alt: 'Vestido de punto azul de talla extra' },
    { nombre: 'Estampado', img: `${IMG}/prod-estampado.webp`, alt: 'Vestido de punto estampado de talla extra' },
  ],
  matriz: [
    [6, 4, 1, 0, 0, 3, 4, 3],
    [5, 3, 0, 0, 1, 2, 3, 2],
    [7, 5, 2, 0, 0, 4, 5, 4],
    [4, 6, 1, 0, 2, 3, 4, 3],
  ],
  unidad: 'piezas',
  genero: 'f' as const,
  leyendas: ['Con existencia', 'Quedan pocas', 'Agotada'] as [string, string, string],
  remate: 'Las de en medio se fueron en diez días y se quedaron las orillas. La clienta de 44 caminó el riel completo y no encontró nada, y el reporte decía que “el vestido negro” tenía 22 piezas.',
};

export const cortinaTG = {
  titulo: '“¿Hasta qué talla subes?”',
  pieAntes: 'La libreta de apartados,<br />y la corrida rota atrás.',
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'Vendedora de una boutique de tallas grandes buscando en la libreta si queda la 46 mientras el riel se ve hueco por el centro',
  altDespues: 'La misma vendedora leyendo en la tablet las medidas del modelo y la existencia de la 46 en la otra sucursal',
  libreta: ['Vestido negro — ¿queda 46?', 'Sra. Lupita — ¿cuánto falta del apartado?', 'Bastilla de graduación — ¿jueves?'],
  filas: [
    { que: '“¿La tienes en 48?”', donde: 'Existencias por sucursal', dato: 'En la del centro hay 2; traspaso con acuse de quien la recibe, no “yo creo que sí hay”' },
    { que: '“¿Qué talla soy en este?”', donde: 'La ficha de medidas del modelo', dato: 'Busto 112, cintura 96, cadera 120: es 46 en este vestido y 44 en la blusa, y queda guardado en su ficha' },
    { que: '¿Por qué se me regresó?', donde: 'El motivo del cambio', dato: 'Nueve “apretó de sisa” en el mismo modelo de la 46 para arriba: no es la talla, es tu patrón del bloque alto' },
    { que: '¿Cuánto falta del apartado?', donde: 'El apartado con abonos y reloj', dato: 'Anticipo, tres quincenas, saldo y la posada del 14; si no se termina, la prenda regresa al piso sola' },
  ],
  pieDespues: 'La misma vendedora, la misma clienta. Ya no adivina la talla: la lee.',
};

export const casosTG = [
  {
    id: 'maquila',
    titulo: 'Febrero y agosto: la corrida que se manda a maquila',
    texto: 'En una tarde se decide cuánta tela se corta por talla para los siguientes cuatro meses. La curva sale del histórico real de venta por talla, por sucursal y por temporada —no del promedio de la cadena—, y el consumo promedio del trazo dice cuántos metros comprar. Antes de firmar la orden, el sistema enseña en qué va la muestra de los dos bloques: la baja en 40 o 42 y la alta en 48 o 50.',
    remate: 'Hacerlo bien cuesta $65,960 al año —el segundo patrón base, la muestra del bloque alto, la prueba de ajuste, el reetiquetado y la sesión de foto— y devuelve 4.4 veces eso. Si el bloque alto sale mal no pierdes una talla: pierdes el 36 % del modelo.',
    img: `${IMG}/proceso-maquila.webp`,
    alt: 'Dueña de una marca de tallas grandes revisando con el taller la corrida por talla antes de cortar',
  },
  {
    id: 'temporada',
    titulo: 'Del 1 al 10 de mayo y del 10 al 24 de diciembre',
    texto: 'El 60 % del mes cae en diez días y lo que se descompleta el primer fin de semana ya no se repone. La alerta diaria de las de en medio por debajo de mínimo llega al celular con el traspaso sugerido de la sucursal que sí las tiene, y el vestido de ocasión se aparta con abonos porque la clienta compra cuando le pagan.',
    remate: 'Cada “no hay tu talla” en esos diez días es una clienta que se va justo cuando traía dinero.',
    img: `${IMG}/caso-ocasion.webp`,
    alt: 'Vitrina de vestidos de ocasión de talla extra en temporada alta, con los apartados etiquetados con el nombre de la clienta',
  },
  {
    id: 'vivo',
    titulo: 'El Buen Fin y el vivo grande',
    texto: 'Vender lo mismo en piso, en línea, en el WhatsApp y en el vivo al mismo tiempo, con una sola existencia. La clienta comenta “mía la 46”, la prenda se aparta al instante con reloj de 24 horas y se le manda el link de cobro; si no paga, regresa sola al piso. El mismo número lo ven la caja, la tienda en línea y quien está transmitiendo.',
    remate: 'Vender tres veces la misma 46 se paga con dinero devuelto y con reputación.',
    img: `${IMG}/caso-vivo.webp`,
    alt: 'Transmisión en vivo desde el cuarto de atrás de una boutique de tallas grandes, con la modelo diciendo qué talla trae puesta',
  },
  {
    id: 'remate',
    titulo: 'Enero y julio: el remate por talla, no por modelo',
    texto: 'Lo que queda son casi siempre las orillas —38 y 50-52— y los colores raros; y si el bloque alto falló, todo lo de la 46 para arriba. La antigüedad de inventario por modelo × talla propone el descuento escalonado solo de las tallas muertas, y marca lo que conviene mandar a mayoreo en media docena surtida en vez de rematarlo.',
    remate: 'Rematar parejo destruye el margen del año; rematar por talla lo salva.',
    img: `${IMG}/caso-mayoreo.webp`,
    alt: 'Mostrador de mayoreo con la media docena surtida de un mismo modelo en tallas 42 a 48',
  },
];

export const seccionesTG: SuiteSeccion[] = [
  {
    id: 'corrida', tag: 'Inventario',
    titulo: 'La corrida completa, de la 36 a la 52, en una sola cuadrícula',
    texto: 'Aquí la matriz es el doble de ancha que en una tienda normal y aguanta las nueve tallas de la 36 a la 52 —y hasta doce cuando el proveedor las trae— sin volverse ilegible en el celular. El sistema habla en el tallaje de cada proveedor —par, non o letra— y avisa cuando hay que correr el tallaje y reimprimir la etiqueta, que con proveedor nuevo pasa seguido. Y sabe que las letras se acaban en la 48: de la 50 para arriba solo hay número.',
    bullets: ['Matriz talla × color de nueve a doce tallas, legible en el mostrador y en el celular', 'Alerta de las de en medio descompletadas: no “se acabó el modelo”, sino “te quedaste sin 42-46”', 'Conteo cíclico por talla desde la primera tienda: la 46 que se probó y se colgó mal descuadra sola'],
    visual: mockMatriz('Vestido de punto · existencia por talla', ['38', '40', '42', '44', '46', '48', '50', '52'], [['Negro', [6, 4, 1, 0, 0, 3, 4, 3]], ['Rojo', [5, 3, 0, 0, 1, 2, 3, 2]]], 'Las de en medio en cero y las orillas llenas: eso es la corrida rota', [0, 3]),
  },
  {
    id: 'curva', tag: 'Compras',
    titulo: 'La curva invertida: aquí la que manda es la 44',
    texto: 'Pides 300 piezas de un modelo y el sistema reparte con tu curva, no con la de una tienda normal: 22 % en 44, 20 % en 42, 18 % en 46. El centro es el 60 % de la compra y de la 46 para arriba van 108 piezas. Cada sucursal con la suya, porque en el norte pesa más arriba y en el sureste más al centro, y el costeo por talla dice cuánta tela comprar con el consumo promedio del trazo.',
    bullets: ['Curva editable y con memoria, propuesta con lo que de verdad vendió esa tienda', 'Aviso cuando el proveedor manda una corrida cerrada que no es tu curva', 'Costeo por talla y consumo del trazo: la 52 lleva 27 % más tela; decides si cobras el escalón de la 48 para arriba'],
    visual: mockBarras('Corrida de 300 piezas · reparto por talla', [['38', '24 pz', 36], ['40', '42 pz', 64], ['42', '60 pz', 91], ['44', '66 pz', 100], ['46', '54 pz', 82], ['48', '33 pz', 50], ['50', '15 pz', 23], ['52', '6 pz', 9]], 'Las de en medio son el 60 % de la compra; de la 46 para arriba, 108 de las 300 piezas'),
  },
  {
    id: 'medidas', tag: 'Medidas',
    titulo: 'La ficha de medidas, modelo por modelo',
    texto: 'La talla de la etiqueta no dice nada: la misma clienta es 44 en un modelo, 46 en otro y 42 en el de al lado. Por eso cada modelo lleva sus medidas en plano —busto, cintura, cadera, largo y sisa— medidas con cinta de costura y regla de patronaje sobre las dos muestras, la del bloque bajo y la del alto. La tienda en línea publica esa tabla y la vendedora la ve en el celular dentro del probador.',
    bullets: ['Medidas en centímetros por modelo, no una tabla genérica para toda la tienda', 'Las medidas de la clienta y la talla que sí le quedó, guardadas en su ficha', '“Tu talla en este modelo”: mete tres medidas y el sistema le dice 46 en el vestido y 44 en la blusa'],
    visual: mockTicket('Vestido de punto · talla 46 · medidas en plano', [['Ancho de busto', '56 cm'], ['Cintura', '50 cm'], ['Cadera', '60 cm'], ['Largo total', '112 cm'], ['Sisa', '27 cm']], ['Su talla aquí', '46'], 'La misma tabla la ve la tienda en línea y el celular de la vendedora en el probador'),
  },
  {
    id: 'cambio', tag: 'Cambios',
    titulo: 'El motivo del cambio es un diagnóstico de patrón',
    texto: 'El cambio por talla es el 70-80 % de todo lo que se regresa: la prenda estaba bien, la talla no. Quien recibe el paquete toca dos veces —apretó de busto, apretó de sisa, grande de cintura, corto de largo, se abomba de la cadera— y ahí se acaba la adivinanza. Si el motivo se reparte parejo, es la clienta que pidió dos tallas; si un modelo concentra “apretó de sisa” de la 46 para arriba, es tu patrón del bloque alto.',
    bullets: ['Cambio por talla sin volver a cobrar: entra la nueva, regresa la vieja al inventario', 'Guía de envío y guía de retorno, con el flete cargado al pedido para ver qué se come el margen', 'Tablero de motivos por modelo: cada punto que le bajas al porcentaje de cambios se ve en la caja'],
    visual: mockLista('Motivos del cambio · últimas cuatro semanas', [['Vestido de lino · 48 y 50 · “apretó de sisa” · 9 de 11', 'Es el patrón', 'aviso'], ['Pantalón recto · “grande de cintura” · 42 y 44', 'Correr el tallaje', 'aviso'], ['Blusa satinada · repartido entre tallas · pidió dos', 'Medidas publicadas', 'ok'], ['Conjunto de punto · un cambio en el mes', 'Sano', 'gris']], 'Nueve clientas diciendo lo mismo del mismo modelo no son nueve tallas: son un patrón que hay que corregir'),
  },
  {
    id: 'vivo', tag: 'Vivo, WhatsApp y línea',
    titulo: '“Mía la 46” y se aparta sola',
    texto: 'Una sola existencia para el piso, la tienda en línea, el WhatsApp y el vivo. Lo apartado en comentarios baja del inventario al instante y genera link de cobro con vencimiento; lo que no se paga en 24 horas regresa al piso. La lista de clientas se avisa por el mismo hilo —“ya llegó en 48”— y las afiliadas traen sus pedidos, su comisión y su cartera en la misma pantalla.',
    bullets: ['Apartado por comentario en el vivo que descuenta la pieza en piso, con reloj de 24 horas', 'WhatsApp con catálogo, cobro y confirmación en el mismo hilo', 'Mayoreo con media docena surtida 42-48 en un clic y docena de una sola talla para el que recompra'],
    visual: mockLista('Vivo del jueves · 118 piezas', [['Vestido rojo · “mía la 46” · link enviado', 'Apartado 24 h', 'ok'], ['Blusa manga tres cuartos · 48 · última pieza · pagada', 'Vendida', 'ok'], ['Conjunto de punto · 50 · no hay · se anota en la lista', 'Aviso al llegar', 'aviso'], ['Mayoreo · tienda de Uriangato · media docena 42-48', 'Estado de cuenta', 'gris']], 'La misma existencia que ve la caja: no se vende dos veces la misma 46'),
  },
  {
    id: 'arreglos', tag: 'Apartados y arreglos',
    titulo: 'El apartado en tres quincenas y el arreglo con fecha',
    texto: 'La clienta compra cuando le pagan: el vestido de posada se abona el 15 y el 30, con saldo a la vista y regreso automático al piso si no se termina. Y casi ninguna prenda sale como se compró —se sube la bastilla, se entra de cintura, se ajusta el de fiesta—: el arreglo es una orden con fecha de entrega, de prenda ya cobrada que sigue en la tienda y que ya no cuenta como inventario.',
    bullets: ['Apartado con anticipo, abonos, saldo y reloj; aviso una semana antes del evento', 'Orden de arreglo con fecha: en ocasión va incluida en el precio, y es lo que trae de regreso a la clienta', 'Agenda de la costurera cargada en mayo y en diciembre, a la vista antes de prometer el jueves'],
    visual: mockCalendario('Apartados y arreglos comprometidos', 'Diciembre', 31, { 5: 'ok', 9: 'aviso', 12: 'lleno', 13: 'lleno', 14: 'lleno', 15: 'aviso', 17: 'lleno', 18: 'lleno', 19: 'lleno', 20: 'aviso', 22: 'ok', 23: 'lleno' }, 'El 15 y el 30 son quincena: ahí se termina de abonar. Del 26 en adelante ya es puro cambio de talla'),
  },
];

export const planoTG = [
  {
    id: 'piso', nombre: 'El piso por corrida', simbolo: 'rieles' as const,
    foto: `${IMG}/zona-piso.webp`, alt: 'Piso de una boutique de tallas grandes con la ropa acomodada por talla dentro de cada modelo y los separadores numerados',
    pie: 'Se acomoda por talla dentro de cada modelo, con separadores que se leen desde la puerta; las de en medio, a la altura de la mano.',
    pregunta: '¿Qué modelo está hueco en 44 y 46?',
    caja: { x: 68, y: 82, w: 216, h: 86 },
    items: [
      { t: 'Existencia por variante y mínimo por talla, con la corrida completa a la vista' },
      { t: 'Alerta de las de en medio descompletadas, con traspaso desde la sucursal que sí las tiene', plan: 'Controla' },
      { t: 'Nada de mesas de puras 38 y 52: eso espanta a la clienta del centro' },
      { t: 'Conteo cíclico por talla cada semana; la 46 se descuadra sola' },
      { t: 'Rotación por talla y por modelo: qué se acaba primero en esta tienda y no en las otras', plan: 'Controla' },
    ],
  },
  {
    id: 'probador', nombre: 'El probador amplio', simbolo: 'probadores' as const,
    foto: `${IMG}/zona-probador.webp`, alt: 'Probador amplio de una boutique de tallas grandes con banca, ganchos, espejo de cuerpo entero y cortina que cierra',
    pie: 'Aquí se cierra la venta: banca, tres ganchos, espejo de cuerpo entero por dentro y cortina que sí cierra.',
    pregunta: '¿Qué talla es en este modelo?',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'La ficha de medidas del modelo en el celular de la vendedora, en centímetros' },
      { t: 'La talla que sí le quedó, guardada en su ficha para la próxima', plan: 'Fideliza' },
      { t: 'Se acercan dos tallas más sin que lo pidan: nadie opina del cuerpo de nadie, se opina de la prenda' },
      { t: 'Aquí se toman las medidas con cinta de la que después va a comprar en línea' },
      { t: 'El botón de “no había su talla” a dos toques; si cuesta más, nadie lo captura' },
    ],
  },
  {
    id: 'ocasion', nombre: 'La vitrina de ocasión', simbolo: 'vitrinas' as const,
    foto: `${IMG}/zona-ocasion.webp`, alt: 'Vitrina de vestidos de fiesta y de graduación en tallas de la 46 a la 52, con los apartados etiquetados',
    pie: 'Fiesta, boda, graduación y posada de la 46 para arriba: lo más escaso del mercado y lo de mejor margen.',
    pregunta: '¿Cuánto le falta al apartado?',
    caja: { x: 68, y: 170, w: 216, h: 80 },
    items: [
      { t: 'Se compra por pieza, no en corrida: nadie quiere ir igual a la boda' },
      { t: 'Apartado con anticipo, abonos, saldo y fecha del evento; aviso una semana antes' },
      { t: 'El arreglo va incluido en el precio y con fecha de entrega' },
      { t: 'La etiqueta lleva el nombre de la clienta escrito a mano y la fecha' },
      { t: 'Se planea con seis meses: lo de diciembre se manda en agosto', plan: 'Controla' },
    ],
  },
  {
    id: 'mostrador', nombre: 'Mostrador, caja y cambios', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-mostrador.webp`, alt: 'Mostrador de una boutique de tallas grandes con la terminal, el gancho de apartados y la pantalla del cambio por talla',
    pie: 'Aquí se cobra, se aparta, se levanta el arreglo y se resuelven los cambios por talla del piso y de la línea.',
    pregunta: '¿Por qué se regresó esta?',
    caja: { x: 68, y: 264, w: 216, h: 104 },
    items: [
      { t: 'POS con pago mixto y sin internet: no se cae el sábado del Buen Fin' },
      { t: 'Apartado con reloj y regreso automático al piso; factura con RFC para oficina y mayoreo' },
      { t: 'Orden de arreglo con fecha: prenda cobrada, todavía en la tienda, fuera del inventario' },
      { t: 'El motivo del cambio capturado en dos toques y la prenda de vuelta al inventario', plan: 'Controla' },
      { t: 'La clienta con su talla, sus medidas y lo que se ha llevado en cuatro años', plan: 'Fideliza' },
    ],
  },
  {
    id: 'taller', nombre: 'El cuarto de atrás: vivo, arreglos y empaque', fuera: true, simbolo: 'paquetes' as const,
    foto: `${IMG}/zona-taller.webp`, alt: 'Cuarto de atrás de una boutique de tallas grandes con el rincón del vivo, la máquina de la costurera y la mesa de empaque',
    pie: 'El rincón del vivo, la máquina de la costurera y la mesa de empaque de los pedidos y de los cambios.',
    pregunta: '¿En qué va el cambio de la 48?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Mismo inventario que el piso; lo apartado en el vivo se descuenta al instante' },
      { t: 'Se miden en plano las dos muestras —bloque bajo y bloque alto— y se captura la ficha del modelo' },
      { t: 'Guías de envío, guías de retorno y la caja etiquetada de los cambios que van de regreso' },
      { t: 'El gancho de los arreglos por entregar, cada uno con su fecha' },
      { t: 'Tablero de motivos del cambio por modelo y días que tarda en resolverse', plan: 'Automatiza' },
    ],
  },
];

export const pasosTG = [
  { cuando: 'Día 1', titulo: 'Tu corrida, cargada', texto: 'Nos das tu lista o tu sistema actual y lo subimos nosotros. No capturas nada.', detalle: 'Modelo, color y talla de la 36 a la 52, con el tallaje de cada proveedor —par, non o letra—, lo que hay que correr de tallaje y la existencia real de cada tienda.', img: `${IMG}/proceso-recibir.webp`, alt: 'Recepción de la corrida de maquila contando pieza por talla en la trastienda de una boutique de tallas grandes' },
  { cuando: 'Día 2', titulo: 'Tu operación, configurada', texto: 'Queda como ya trabajas: tus proveedores, tu maquila, tus sucursales y tus reglas.', detalle: 'Tu curva por tienda, los dos bloques de patrón en la orden de maquila, el escalón de precio de la 48 para arriba si lo cobras, y quién puede dar descuento.', img: `${IMG}/proceso-patron.webp`, alt: 'Patronista corrigiendo la sisa del patrón base del bloque alto junto a la fit de talla 48 en manta' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión con tu equipo antes de abrir. Leer las medidas del modelo y capturar el motivo del cambio se aprende en media hora.', detalle: 'Y se practica lo de todos los días: medir en plano, apartar desde el vivo, levantar el arreglo con fecha y marcar “no había su talla” en dos toques.', img: `${IMG}/proceso-medidas.webp`, alt: 'Encargada midiendo en plano la muestra del bloque alto con cinta de costura y regla de patronaje' },
  { cuando: 'Día 4', titulo: 'Arranca una tienda', texto: 'La primera sucursal vende con Sacs. El sistema viejo sigue en pie por si acaso.', detalle: 'Con los apartados ya migrados: ninguna clienta llega por su vestido de posada y se encuentra con que su papelito no existe.', img: `${IMG}/proceso-cambio.webp`, alt: 'Cambio por talla resuelto en el mostrador, con el motivo capturado en el celular' },
  { cuando: 'Día 5', titulo: 'Arrancan las demás', texto: 'Con la primera resuelta, las otras entran el mismo día.', detalle: 'Y el traspaso de las de en medio entre la tienda del centro y la de la plaza ya corre desde el primer fin de semana.', img: `${IMG}/caso-encontro.webp`, alt: 'Clienta de talla extra viéndose al espejo con un vestido que le queda, y la vendedora un paso atrás' },
];
export const ticketTG = { lineas: [{ n: 'Vestido de punto negro · 46', p: '$1,290' }, { n: 'Blusa manga tres cuartos · 48', p: '$690' }, { n: 'Arreglo · bastilla para el jueves', p: 'Incluido' }], total: '$1,980' };

export const escalaTG = [
  { n: '1 tienda', nombre: 'La boutique del barrio', cambia: ['La dueña compra, vende, hace el vivo, contesta el WhatsApp y manda la maquila', 'Sabe de memoria qué le falta; el riesgo no es el inventario, es el flujo: todo está en tela y en anticipos al taller', 'El apartado, el arreglo y la talla de cada clienta van en libreta'], sistema: ['Inventario único para piso y vivo, apartado con reloj y ficha de la clienta con su talla', 'Cuentas por pagar de maquila y proveedores: cuánto hay comprometido en tela', 'Conteo cíclico por talla desde el día uno'], dato: { valor: '1,500 a 4,000', rotulo: 'piezas de inventario, con ocho a doce tallas por modelo' } },
  { n: '5 tiendas', nombre: 'Las tiendas de la zona', cambia: ['Encargada por tienda; aparece la pregunta “¿quién tiene la 46?” y con ella los traspasos', 'Cada tienda desarrolla su propia curva: la del centro no pesa como la de la plaza', 'La maquila se vuelve seria: mínimos de 80 a 150 por color y patronista de confianza'], sistema: ['Traspasos con acuse, mínimos por variante y por sucursal, corte por tienda', 'Etiqueta por variante con reimpresión cuando se corre el tallaje', 'Los dos patrones base dejan de ser opcionales: en 300 piezas, 108 son del bloque alto'], dato: { valor: '108 de 300', rotulo: 'piezas de cada corrida son de la 46 para arriba' } },
  { n: '50 tiendas', nombre: 'La cadena con almacén central', cambia: ['Ya no compra la dueña: compra un equipo con presupuesto por temporada', 'La curva se calcula por grupo de tiendas —norte, bajío, sureste— y por tipo de plaza', 'El vivo tiene su propio inventario apartado y el cuarto de arreglos se vuelve proveedor con fecha comprometida'], sistema: ['Distribución inicial por curva y rebalanceo a las tres semanas con lo que de verdad se vendió', 'Precios y promociones por grupo de tiendas, comisiones del piso y control de mermas', 'Paquetería con cuenta corporativa, guías de retorno y costo del flete por pedido'], dato: { valor: '3 semanas', rotulo: 'para rebalancear la corrida con la venta real, antes del remate' } },
  { n: '150 tiendas', nombre: 'La empresa de moda de talla extra', cambia: ['Marca propia con calendario de colecciones, dos o tres maquilas fijas y una de emergencia', 'La curva por talla deja de ser opinión de compra y se vuelve decisión financiera', 'Hace falta gobierno del tallaje: que la 46 de este año sea la 46 del año pasado y la misma en los tres talleres'], sistema: ['Pronóstico por talla y por región, tablero de faltantes por talla y auditoría por corrida', 'IA de surtido que lee la corrida de cada tienda, no el promedio de la cadena', 'Tienda en línea con el inventario de los 150 puntos y las medidas de cada modelo'], dato: { valor: '20,000 piezas', rotulo: 'son 2 puntos de error en la curva de la 44 al comprar un millón al año' } },
];

export const problemasTG = {
  doc1: {
    membrete: 'Sistema de ropa', sub: 'Reporte de inventario',
    cab: ['CÓDIGO', 'DESCRIPCIÓN', 'EXIST.'],
    lineas: [
      { a: 'SKU-1184', b: 'VESTIDO PUNTO NEGRO', c: '22' },
      { a: '—', b: '—', c: '—', tenue: true },
      { a: '—', b: '—', c: '—', tenue: true },
    ],
    margen: ['¿y la 46?', '¿por qué se regresó?'],
    sello: 'NO VE<br />LA CORRIDA',
    notas: [
      'Te dice que hay <b>22</b>. No te dice que el 42, el 44 y el 46 ya se fueron.',
      'Su matriz se hizo para <b>seis tallas</b>: con doce se vuelve ilegible en el celular.',
      'No sabe de tallaje <b>par, non ni letra</b>, así que correr el tallaje se hace a mano y se reetiqueta a ojo.',
      'Registra la devolución, no el <b>motivo</b>: nunca vas a saber que es tu patrón del bloque alto.',
    ],
  },
  doc2: {
    membrete: 'Desarrollo a la medida', sub: 'Propuesta · rev. 4',
    cab: ['CONCEPTO', 'PLAZO'],
    lineas: [
      { a: 'MEDIDAS POR MODELO', b: 'FASE 2' },
      { a: 'ENTREGA REAL', b: 'PASÓ DICIEMBRE', tachado: true },
      { a: 'MOTIVO DEL CAMBIO', b: 'NO' },
    ],
    margen: ['+ 3 adendas', 'y llegó el 10 de mayo'],
    sello: 'LLEGÓ<br />TARDE',
    notas: [
      'Costó <b>más de lo cotizado</b> y la ficha de medidas quedó para la fase 2.',
      'Funciona… mientras <b>quien lo hizo conteste el teléfono</b>. Tus meses son mayo y diciembre.',
      'Cada cambio chico —agregar la sisa a la tabla— es <b>una cotización nueva</b>.',
      'No trae apartado desde el vivo ni traspaso entre tiendas. En el Buen Fin, <b>se vende dos veces la misma 46</b>.',
    ],
  },
  filas: [
    { que: 'Matriz de nueve a doce tallas por color, legible', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Curva de compra invertida por tienda', generico: 'No existe', medida: 'Rara vez', sacs: 'Incluido' },
    { que: 'Ficha de medidas por modelo y la talla de la clienta', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'El motivo del cambio y el tablero por modelo', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'Apartado desde el vivo con reloj e inventario único', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Tiempo para arrancar', generico: 'Días', medida: '4 a 9 meses', sacs: 'Días' },
    { que: 'Quién lo mantiene', generico: 'Su proveedor', medida: 'Tú, si lo encuentras', sacs: 'Nosotros, a diario' },
  ],
  entrada: 'Casi toda boutique de talla extra que llega con nosotros trae uno de estos dos papeles en el cajón: el reporte de un sistema de ropa hecho para seis tallas, que no sabe qué son las de en medio ni por qué se regresó la prenda, o la cotización de un desarrollo a la medida que iba a resolverlo. Ninguno fue una tontería. Los dos fallan, por motivos distintos.',
  quienes: 'las boutiques y marcas de talla extra que ya la usan',
};

export const cifrasTG = {
  foto: `${IMG}/escala.webp`,
  alt: 'Almacén central de una cadena de tallas grandes con la corrida repartida por sucursal y por talla',
  frase: 'Desde la boutique del barrio hasta la cadena con maquila propia y almacén central.',
  encuadre: 'center 45%',
};
