/**
 * Contenido de la landing de SASTRERÍA Y TRAJES A LA MEDIDA (17-sep-2026). Sale de la ficha del
 * oficio (scratchpad/giros-fichas/sastreria.md) con el dictamen del sastre de 30 años aplicado: se
 * dice a la medida (nunca "a medida"), traje de línea (no "traje listo"), espejo de tres cuerpos
 * (no "de tres hojas"), saco (no chaqueta ni americana), una prueba con el saco ya armado a los 10
 * o 15 días —el hilván con dos pruebas es del traje fino—, la tarjeta del cliente es el oro de la
 * sastrería, la hechura es medio negocio y si echas a perder la tela del cliente se la pagas, el
 * maquilero cobra a destajo y en diciembre se va desde el 15 (la fecha real de corte es el 12), lo
 * importado se pide por corte y tarda de 2 a 6 semanas mientras lo nacional se resurte cuando se
 * acaba, de cada pieza queda una cola de 1.5 a 2.5 m que ya no da saco, donde hay banderilla no se
 * corta, casar la raya se lleva de 10 a 30 cm más, y el traje de línea se surte regular con unas
 * pocas de corto y largo. Bloque propio: cuando entra la tijera, esos metros dejan de ser
 * inventario y se vuelven de una persona con nombre —un traje a la medida mal cortado no le queda a
 * nadie más en el mundo, y además hay una boda con fecha.
 *
 * Funciones prometidas que NO están construidas hoy (decisión del dueño 17-sep: se muestran como
 * parte del sistema; se construyen si el cliente las pide): ficha de medidas con historial, repetir
 * traje sin volver a medir, orden de trabajo del taller, fechas para atrás desde la fecha del
 * evento, tablero del taller por etapa, tela por metro con colas y banderillas, tabla de consumo
 * por talla y modelo, pedido de tela por metro con fecha prometida, muestrario en la tablet, matriz
 * talla-largo con drop, composturas con contraseña y canal de tintorería, orden de ajuste del traje
 * de línea, vale de tela al maquilero, hechura sin consumo de pieza, reproceso con culpable y
 * costo, urgente con recargo, trajes abandonados con aviso, comisión del que tomó la medida, grupo
 * de padrinos y chambelanes, ficha de dama y de camisa, corporativo por empleado con contrarrecibo,
 * auditoría de la medida capturada en tienda, costo real del traje y cita en línea.
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockMatriz, mockBarras, mockTicket, mockLista, mockCalendario } from './_mocks';

const IMG = '/images/giros/sastreria';

export const bannerSA = {
  eyebrow: 'SACS · Sastrería y trajes a la medida',
  titulo: 'Cuando entra la tijera,',
  resalte: 'la tela ya tiene dueño.',
  sub: 'La ficha de medidas que no se pierde, la orden de trabajo pegada a la tela y las fechas de corte y de prueba contadas para atrás desde la boda. Los metros que quedan de cada clave, el vale de tela del maquilero y la compostura con su contraseña. En el mostrador, en la mesa de corte y en el WhatsApp.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Sastrería moderna a la medida con el muro de piezas de casimir, la mesa de corte y la ficha de medidas del cliente en la tablet',
  avisos: [
    { modulo: 'Último día para cortar', texto: 'Boda del 20 de mayo · corta a más tardar el 8 de abril · si va con maquilero, una semana antes', pos: 1 as const, tono: 'ambar' as const, sello: 'Abril' },
    { modulo: 'Metros que quedan', texto: 'Azul marino clave 4711 · quedan 6.20 m · alcanza para un padrino, faltan 2 · el corte pedido llega en 4 semanas', pos: 2 as const, tono: 'rojo' as const, sello: 'Mayo' },
    { modulo: 'Ya está tu traje', texto: 'Sr. Ibarra · terminado y planchado · saldo $4,200 · orden 3187', pos: 3 as const, tono: 'verde' as const, sello: 'Hoy' },
  ],
};

export const manifiestoSA = {
  intro: 'Sabemos cómo se hace un traje',
  frases: [
    'El cliente regresa por su traje de cada año y no encuentras <b>su tarjeta</b>. Lo vuelves a medir y te da pena.',
    'Cortaste la tela del novio y en la prueba te diste cuenta de que la <b>boda era una semana antes</b> de lo que apuntaste.',
    'Se te acabó el <b>azul marino</b> a la mitad de los padrinos; el corte tarda seis semanas y cuando llega no es el mismo lote: el tono no empata y se nota en la foto de la boda.',
    'El <b>maquilero</b> te trae los trajes el viernes que él quiere, no el que tú prometiste. Y una vez te manchó la tela del novio.',
    'El que tomó la medida la tomó mal, y el <b>reproceso</b> te lo comes tú sin saber cuánto te costó.',
    'Tienes <b>ocho trajes terminados</b> que nadie recoge, la mitad pagados, colgados al fondo del taller.',
    'Tienes cuarenta <b>40R</b> colgados y ni un solo 44L, y el que entró hoy medía 44L.',
    'Las <b>composturas</b> se te pierden: nadie sabe si ya se pagó, si ya está lista o en qué bolsa quedó, y el cliente llega diciendo que perdió su contraseña.',
  ],
  cierre: 'Ningún sistema de ropa entiende que aquí el inventario se vuelve de una persona: en el momento en que entra la tijera, esos 3.20 metros dejan de ser tuyos y son del señor que se casa el 20. Un traje a la medida mal cortado no le queda a nadie más en el mundo. Sacs sí lo entiende: cada pantalla que sigue funciona igual en el mostrador, en la mesa de corte y en el WhatsApp. Y encima puedes poner agentes de IA para que hagan el trabajo repetitivo: el recordatorio de la prueba, el aviso de “ya está tu traje” y la llamada al cliente que hizo traje hace un año.',
};

export const variantesSA = {
  eyebrow: 'Un solo modelo',
  titulo: 'Esto es lo que de verdad hay detrás de',
  resalte: '“el traje azul”.',
  sub: 'Un mismo saco de dos botones va de la 38 a la 48 en este ejemplo —el traje de línea llega hasta la 54—, y cada talla en regular, corto y largo: son 18 existencias por casimir, no seis. Abajo está solo el regular en cuatro telas —marino, gris Oxford, negro y de raya—; contando corto y largo son 72 trajes distintos de un solo modelo, y el de raya además se lleva de 10 a 30 cm más porque hay que casar la raya.',
  ejeA: ['38R', '40R', '42R', '44R', '46R', '48R'],
  filas: [
    { nombre: 'Azul marino', img: `${IMG}/prod-marino.webp`, alt: 'Saco de traje de casimir azul marino de dos botones' },
    { nombre: 'Gris Oxford', img: `${IMG}/prod-gris.webp`, alt: 'Saco de traje de casimir gris Oxford de dos botones' },
    { nombre: 'Negro', img: `${IMG}/prod-negro.webp`, alt: 'Saco de traje de casimir negro de dos botones' },
    { nombre: 'De raya', img: `${IMG}/prod-raya.webp`, alt: 'Saco de traje de casimir gris de raya, con el dibujo casado en la solapa' },
  ],
  matriz: [
    [2, 6, 9, 4, 1, 0],
    [1, 5, 7, 3, 1, 0],
    [2, 4, 6, 2, 0, 0],
    [0, 2, 3, 1, 0, 0],
  ],
  unidad: 'trajes',
  genero: 'm' as const,
  leyendas: ['Con existencia', 'Quedan pocos', 'Agotado'] as [string, string, string],
  remate: 'que comprar, colgar y contar por talla y por largo. Y eso es solo el regular: el señor de hoy medía 44L y no hay un solo 44 largo colgado en toda la tienda. El reporte decía que del “traje azul” había 22.',
};

export const cortinaSA = {
  titulo: '“¿No tiene mi medida?”',
  pieAntes: 'La libreta, el calendario de la pared<br />y el cliente esperando a que lo midan otra vez.',
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'Sastre buscando la tarjeta de medidas de un cliente en su libreta vieja, con las contraseñas de compostura y el calendario de la pared',
  altDespues: 'El mismo sastre con la tablet en el mostrador: la ficha de medidas del cliente y la línea de fechas de la orden',
  libreta: ['Sr. Ibarra — ¿dónde quedó su tarjeta?', 'Boda del 20 — ¿ya se cortó?', 'Azul marino 4711 — ¿cuánto queda?'],
  filas: [
    { que: '“Ya me ha hecho traje”', donde: 'Su ficha de medidas', dato: 'Las 18 medidas de hace 14 meses, con sus notas de postura; solo se le saca de la pretina dos dedos y se abre la orden' },
    { que: '¿Alcanza para la boda del 20?', donde: 'Las fechas contadas para atrás', dato: 'Último día para cortar: 8 de abril. Prueba el 24 de abril, entrega el 13 de mayo. Con maquilero, una semana antes' },
    { que: '¿Cuánto queda del azul marino?', donde: 'La pieza, en metros', dato: '6.20 m de la clave 4711: sale uno de los dos padrinos que faltan y ya no da el otro; el corte pedido llega en cuatro semanas y es otro lote' },
    { que: '“Perdí mi contraseña”', donde: 'La compostura, por su nombre', dato: 'Subir bastilla y meter de la pretina, pagada, lista desde el martes, bolsa del jueves' },
  ],
  pieDespues: 'El mismo sastre, el mismo cliente. Ya no lo vuelve a medir: abre su ficha.',
};

export const casosSA = [
  {
    id: 'temporada',
    titulo: 'Abril a junio y octubre a diciembre: cada traje tiene fecha de evento',
    texto: 'Bodas, primeras comuniones, graduaciones y posadas: el taller está a tope y de ahí se cuenta para atrás. Una prueba que se corre una semana tumba la entrega, y un urgente que se cuela desacomoda a todos los demás. El tablero del taller ordena por fecha del evento —no por quién llegó primero—, marca los urgentes y dice a qué órdenes recorren. El grupo de padrinos o de chambelanes se corta junto y del mismo lote, con las medidas de cada quien y su propio cobro.',
    remate: 'Aquí no se pierde un cliente: se pierde el novio y sus ocho padrinos.',
    img: `${IMG}/caso-padrinos.webp`,
    alt: 'Grupo de padrinos de boda midiéndose para trajes iguales en una sastrería, con la misma pieza de casimir extendida en la mesa de corte',
  },
  {
    id: 'corporativo',
    titulo: 'Febrero y agosto: el corporativo abre presupuesto y cierra pedidos',
    texto: 'Sesenta trajes de caballero y de dama, misma tela y mismo modelo, medidos en la oficina del cliente y entregados con etiqueta por persona. Se cotiza por empresa, se aparta la tela del que entre en abril y se compra con tiempo: lo importado se pide por corte y tarda de 2 a 6 semanas, lo nacional se resurte cuando se acaba. El cobro va con orden de compra, contrarrecibo y pago a 30, 60 o 90 días, con factura y complemento de pago.',
    remate: 'Si la tela se pide tarde, no hay traje; si se pide de otro lote, el tono no empata y se nota en la foto.',
    img: `${IMG}/caso-corporativo.webp`,
    alt: 'Sastre y su ayudante tomando medidas a empleados de una empresa en la sala de juntas de la oficina, con la relación por empleado en la laptop',
  },
  {
    id: 'flojos',
    titulo: 'Enero y julio-agosto: el taller parado y el traje colgado',
    texto: 'Los meses flojos se viven de la compostura y de la hechura: subir la bastilla, meter de la pretina, entallar de bota, acortar manga. Ticket chico y volumen alto, con precio de lista, contraseña impresa con fecha y el corte con la tintorería de junto. Y es cuando se liquida el traje de línea que no rotó: la matriz talla-largo por tienda dice qué rematar y qué traspasar, en vez de malbaratar parejo.',
    remate: 'El error casi nunca fue el precio: fueron tallas y largos que nunca debieron pedirse para esa plaza.',
    img: `${IMG}/caso-composturas.webp`,
    alt: 'Mostrador de composturas de una sastrería con el cliente entregando su saco y la contraseña numerada prendida en la manga',
  },
  {
    id: 'regresa',
    titulo: 'Agosto y enero: el cliente que hace traje cada año',
    texto: 'El ejecutivo que se hizo traje hace 10 a 14 meses es la venta más barata que tienes, y hoy se te olvida. Con su ficha guardada —sus medidas, la tela que escogió, el evento y lo que pagó— el sistema arma la lista de a quién hablarle y le manda el WhatsApp con la tela nueva. Cuando llega, no se vuelve a medir: se abre la orden jalando su tarjeta y se le ajusta la pretina.',
    remate: 'Volver a medirlo no es un trámite: es decirle que perdiste su tarjeta.',
    img: `${IMG}/caso-regresa.webp`,
    alt: 'Cliente de años en la tarima frente al espejo de tres cuerpos mientras el sastre le mete de la pretina y la vendedora compara su ficha de medidas en la tablet',
  },
];

export const seccionesSA: SuiteSeccion[] = [
  {
    id: 'ficha', tag: 'Clientes',
    titulo: 'La tarjeta del cliente, que es el oro de la sastrería',
    texto: 'De 12 a 20 medidas más las notas de postura —hombro caído, espalda encorvada, panza— y sus fotos, guardadas en el cliente para siempre y con historial por fecha para ver cómo cambió de peso. La ficha de dama es otra: traje sastre, falda, blusa. Y la de camisa lleva lo suyo: cuello, puño, largo de manga y pecho.',
    bullets: ['Ficha de caballero, de dama y de camisa, cada una con sus campos', 'Repetir traje sin volver a medir: se jala la tarjeta anterior y solo se ajusta la pretina', 'La medida que sale de rango no se manda a cortar: se pregunta antes de que entre la tijera'],
    visual: mockLista('Ficha del Sr. Ibarra · última medida hace 14 meses', [['Pecho 104 · cintura 96 (+3) · sisa y bota sin cambio', 'Actualizada', 'ok'], ['Nota de postura: hombro derecho caído', 'De su tarjeta', 'gris'], ['Traje anterior: casimir gris Oxford, dos botones, valenciana', 'Repetir', 'ok'], ['Pretina: sacarle dos dedos', 'A confirmar en la prueba', 'aviso']], 'La medida no se vuelve a tomar: se corrige en la prueba y se guarda'),
  },
  {
    id: 'fechas', tag: 'Fecha del evento',
    titulo: 'La boda es el 20: el sistema cuenta para atrás',
    texto: 'Capturas la fecha del evento y salen solas las demás: último día para vender, último día para cortar, prueba, terminado y entrega, mínimo una semana antes. Si va con maquilero se corre todo una semana, y en diciembre más: el taller de afuera se va desde el 15, así que la fecha real de corte es el 12.',
    bullets: ['Si ya no alcanza, lo dice antes de cobrar: traje de línea con ajustes o urgente con recargo', 'El urgente se cobra aparte, se mete adelante y avisa a qué órdenes recorre', 'Cita de toma de medidas y de prueba por sastre, con recordatorio por WhatsApp'],
    visual: mockCalendario('Boda del 20 de mayo · orden 3184', 'Abril', 30, { 8: 'lleno', 9: 'aviso', 10: 'aviso', 24: 'lleno', 25: 'ok', 26: 'ok' }, 'El 8 es el último día para cortar; el 24, la prueba. Con maquilero, todo una semana antes'),
  },
  {
    id: 'taller', tag: 'Taller',
    titulo: 'La orden de trabajo va pegada a la tela, y el tablero dice dónde va',
    texto: 'Modelo, tela, forro, botones, solapa normal o de pico, tipo de bolsa, valenciana, las medidas y las cuatro fechas: se imprime y se engrapa al bulto. Sin orden no se corta. Todas las órdenes se ven por etapa —cortado, armado, prueba, terminado, entregado— y por sastre, con lo que va tarde en rojo.',
    bullets: ['Vale de tela al maquilero: cuántos metros salieron, con qué orden, qué regresó y qué se le paga a destajo', 'Lo que echó a perder se le descuenta; lo que se rehace queda marcado como reproceso con culpable y costo', 'Hechura: “tela recibida 3.40 m, del cliente”, sin consumo de pieza y con precio solo de mano de obra — y queda escrito que si se echa a perder, se la pagas'],
    visual: mockLista('Tablero del taller · hoy', [['Orden 3184 · novio · boda 20 de mayo · corte hecho', 'Armado', 'ok'], ['Orden 3190 · urgente con recargo · sábado', 'Va primero', 'aviso'], ['Orden 3171 · maquilero Ramírez · vale de 3.40 m', 'Viernes', 'gris'], ['Orden 3155 · se levanta el cuello · rehacer talle', 'Reproceso', 'aviso']], 'El maquilero recoge el lunes y entrega el viernes; su vale de tela sale con el bulto'),
  },
  {
    id: 'tela', tag: 'Inventario',
    titulo: 'La tela en metros, no en piezas',
    texto: 'Cada pieza con su clave y sus metros: el corte de cada traje se descuenta al momento, se marca dónde hay banderilla para no cortar ahí y se pide bonificación. El consumo sale de lo que se llevó tu taller —3.20 un 42R de dos botones, +0.30 el cruzado, de 0.50 a 0.70 el chaleco y de 10 a 30 cm más si hay que casar la raya o el cuadro.',
    bullets: ['Pedido al proveedor en metros, con clave del muestrario y fecha prometida', 'El corte pedido por traje (de 2 a 6 semanas) se distingue de la pieza de resurtido', 'La cola de pieza menor a 3 m queda como inventario aparte: da chaleco o pantalón suelto, y se traspasa'],
    visual: mockBarras('Metros que quedan por clave', [['4711 marino', '6.20 m', 21], ['5028 gris Ox.', '18.40 m', 61], ['3390 negro', '0.00 m', 0], ['Colas < 3 m', '11.70 m', 39]], 'Del marino sale un padrino más y el segundo ya no: son 3.20 m cada uno y quedan 6.20'),
  },
  {
    id: 'linea', tag: 'Traje de línea',
    titulo: 'Talla y largo, que es la matriz de verdad de una tienda de trajes',
    texto: 'De la 36 a la 54, cada una en regular, corto y largo, con el saco y el pantalón como par y su drop en la etiqueta. Se surte casi todo regular y unas pocas de corto y largo, y ahí se decide la temporada: en el norte se venden más largos y tallas grandes; en el centro, regular.',
    bullets: ['Existencias por sucursal y traspaso: dónde está el 44L y quién lo manda', 'Al vender el traje de gancho se abre sola la orden de ajuste: bastilla, meter de los costados, acortar manga, con su fecha', 'El pantalón se entrega sin bastilla: el largo lo resuelve el taller en dos o tres días'],
    visual: mockMatriz('Traje de línea · existencia por talla y largo', ['38', '40', '42', '44', '46', '48'], [['Regular', [4, 11, 14, 9, 5, 2]], ['Corto', [1, 2, 3, 1, 0, 0]], ['Largo', [0, 1, 2, 0, 1, 0]]], 'Cuarenta y cinco regulares colgados y ni un 44L: justo el que entró hoy', [2, 3]),
  },
  {
    id: 'mostrador', tag: 'Mostrador',
    titulo: 'El anticipo, la contraseña y el “ya está tu traje”',
    texto: 'Sin anticipo no se corta: la mitad o cuando menos lo de la tela, con abonos y recordatorio del saldo. La compostura entra con precio de lista y sale con su contraseña impresa y su fecha, con estado —recibida, en taller, lista, entregada— aunque el cliente pierda el papelito. Y el WhatsApp avisa solo cuando la orden cambia de etapa.',
    bullets: ['Composturas que entran por la tintorería de junto, con su comisión y su corte', 'Trajes abandonados: días parados, saldo pendiente y aviso a los 30, 90 y 180 días', 'Costo real por orden: tela, forro, botones, hechura a destajo, pruebas y reprocesos contra lo que cobraste'],
    visual: mockTicket('Orden 3184 · novio · boda 20 de mayo', [['Traje a la medida · casimir azul marino · tres piezas', '$14,800'], ['Corte de 3.70 m (3.20 del 42R + 0.50 del chaleco)', 'de la pieza 4711'], ['Anticipo recibido', '−$7,400']], ['Saldo a la entrega', '$7,400'], 'Se entrega en funda contra el saldo, una semana antes de la boda'),
  },
];

export const planoSA = [
  {
    id: 'telas', nombre: 'Muro de telas y muestrario', simbolo: 'anaqueles' as const,
    foto: `${IMG}/zona-rollos.webp`, alt: 'Muro de piezas de casimir por color en una sastrería, con la mesa baja de las cartas de telas abiertas',
    pie: 'Aquí se enseña, no se corta: el cliente compra tocando la tela y cada recorte trae su clave y su precio por metro.',
    pregunta: '¿Cuánto queda del azul marino?',
    caja: { x: 68, y: 82, w: 216, h: 80 },
    items: [
      { t: 'Cada pieza con su clave y sus metros; el corte de cada traje se descuenta al momento' },
      { t: 'Muestrario en la tablet: clave, composición, precio y metros que quedan o en cuánto llega el corte' },
      { t: 'Donde hay banderilla no se corta: se marca y se pide bonificación al proveedor' },
      { t: 'Estante de colas menores a 3 m: para qué alcanzan y a qué tienda se traspasan', plan: 'Controla' },
      { t: 'Pedido en metros con fecha prometida; el corte importado de 2 a 6 semanas, aparte del resurtido', plan: 'Automatiza' },
    ],
  },
  {
    id: 'probador', nombre: 'Probador y piso del traje de línea', simbolo: 'probadores' as const,
    foto: `${IMG}/zona-probador.webp`, alt: 'Probador de sastrería con tarima y espejo de tres cuerpos, junto a los racks de traje de línea por talla',
    pie: 'La tarima, el espejo de tres cuerpos y buena luz de frente: aquí se toma la medida, se hace la prueba y se cierra la venta.',
    pregunta: '¿Hay 44 largo?',
    caja: { x: 68, y: 170, w: 216, h: 86 },
    items: [
      { t: 'Ficha de medidas en la tablet: caballero, dama y camisa, cada una con sus campos' },
      { t: 'Una prueba con el saco ya armado, marcada con jaboncillo; hilván y dos pruebas en el traje fino' },
      { t: 'Traje de línea por talla y largo, con saco y pantalón como par y su drop' },
      { t: 'Existencias por sucursal y traspaso: dónde está el 44L', plan: 'Controla' },
      { t: 'Cita de toma de medidas y de prueba por sastre, con recordatorio por WhatsApp', plan: 'Fideliza' },
    ],
  },
  {
    id: 'corte', nombre: 'Mesa de corte', simbolo: 'armado' as const,
    foto: `${IMG}/zona-corte.webp`, alt: 'Mesa de corte larga de una sastrería con el cortador trazando sobre el casimir con jaboncillo y la orden de trabajo engrapada a la tela',
    pie: 'La mesa del cortador, que trabaja solo: sin orden de trabajo no se corta, y lo que se corta ya es de alguien.',
    pregunta: '¿Cuánto se lleva este 46 cruzado?',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Orden de trabajo impresa y engrapada al bulto: modelo, tela, forro, botones, solapa, bolsas, valenciana y las cuatro fechas' },
      { t: 'Consumo por talla y modelo, con lo que se suma por casar la raya o el cuadro' },
      { t: 'El corte se descuenta de la pieza en metros, con su clave y su lote' },
      { t: 'Hechura: la tela del cliente se cuenta delante de él y queda anotada en la orden' },
      { t: 'Reproceso con culpable y costo: el que midió, el cortador o el maquilero', plan: 'Controla' },
    ],
  },
  {
    id: 'mostrador', nombre: 'Mostrador, caja y entrega', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-mostrador.webp`, alt: 'Mostrador de una sastrería con el POS, el perchero de trajes listos en funda y las bolsas de composturas colgadas por día',
    pie: 'Aquí se cobra el anticipo, se da la contraseña de la compostura y se entrega el traje en funda con su etiqueta.',
    pregunta: '¿Ya se puede entregar?',
    caja: { x: 68, y: 264, w: 216, h: 104 },
    items: [
      { t: 'Anticipo, abonos y saldo a la entrega; cobra con y sin internet' },
      { t: 'Composturas con precio de lista y contraseña impresa con fecha; estado aunque el cliente pierda el papelito' },
      { t: 'Lo que entra por la tintorería de junto, con su comisión y su corte' },
      { t: 'Factura al ejecutivo y al corporativo, con complemento de pago', plan: 'Controla' },
      { t: 'Perchero de abandonados: días parados, saldo y aviso a los 30, 90 y 180 días', plan: 'Fideliza' },
    ],
  },
  {
    id: 'taller', nombre: 'Taller y maquila', fuera: true, simbolo: 'paquetes' as const,
    foto: `${IMG}/zona-taller.webp`, alt: 'Taller de sastrería con las máquinas, la mesa de plancha y el maquilero entregando el viernes los trajes terminados en ganchos',
    pie: 'Los sastres, la costurera y el planchador adentro; el maquilero recoge el lunes y entrega el viernes.',
    pregunta: '¿Qué me debe el maquilero?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Tablero por etapa y por sastre: cortado, armado, prueba, terminado, entregado' },
      { t: 'Vale de tela al maquilero: metros que salieron, prendas que regresó y pago a destajo' },
      { t: 'Urgente con recargo que se mete adelante y avisa a qué órdenes recorre' },
      { t: 'Grupo de padrinos o chambelanes: varios clientes, un mismo lote y una misma fecha' },
      { t: 'Costo real por orden contra el precio de venta, con pruebas y reprocesos adentro', plan: 'Controla' },
    ],
  },
];

export const pasosSA = [
  { cuando: 'Día 1', titulo: 'Tus telas y tus clientes, cargados', texto: 'Nos das tu lista o tu sistema actual y lo subimos nosotros. No capturas nada.', detalle: 'Piezas con su clave y sus metros, las colas, el traje de línea por talla y largo, y las tarjetas de medidas que ya tengas en libreta.', img: `${IMG}/proceso-tela.webp`, alt: 'Cliente y vendedora revisando la carta de telas de una sastrería, con los metros de cada clave en la tablet' },
  { cuando: 'Día 2', titulo: 'Tu operación, configurada', texto: 'Queda como ya trabajas: tus consumos, tus maquileros, tu lista de composturas y tus tiempos.', detalle: 'Cuánto se lleva cada talla y modelo, lo que se suma por casar la raya, el recargo del urgente, el colchón del maquilero y quién firma la orden de trabajo.', img: `${IMG}/proceso-corte.webp`, alt: 'Cortador trazando el patrón sobre el casimir con jaboncillo, con la orden de trabajo engrapada a la tela' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión con tu equipo antes de abrir. Tomar la medida en la ficha y abrir la orden con la fecha del evento se aprende en media hora.', detalle: 'Y se practica lo de todos los días: la compostura con su contraseña, el vale de tela del maquilero y el cobro del anticipo.', img: `${IMG}/proceso-medidas.webp`, alt: 'Manos del sastre tomando la medida de pecho con la cinta mientras la ficha se llena en la tablet' },
  { cuando: 'Día 4', titulo: 'Arranca una tienda', texto: 'La primera sucursal vende con Sacs. El sistema viejo sigue en pie por si acaso.', detalle: 'Con las órdenes vivas ya migradas: ningún novio llega a su prueba y se encuentra con que su fecha no existe.', img: `${IMG}/proceso-prueba.webp`, alt: 'Prueba del saco ya armado frente al espejo de tres cuerpos, con el sastre marcando la espalda con jaboncillo' },
  { cuando: 'Día 5', titulo: 'Arrancan las demás', texto: 'Con la primera resuelta, las otras entran el mismo día.', detalle: 'Y el traspaso del 44L entre tiendas y la entrega contra saldo ya corren desde el primer fin de semana.', img: `${IMG}/proceso-entrega.webp`, alt: 'Entrega del traje terminado en funda en el mostrador de la sastrería, con el saldo cobrado en la tablet' },
];
export const ticketSA = { lineas: [{ n: 'Traje a la medida · marino · tres piezas', p: '$14,800' }, { n: 'Compostura · subir bastilla', p: '$180' }, { n: 'Anticipo recibido', p: '−$7,400' }], total: '$7,580 · liquida a la entrega' };

export const escalaSA = [
  { n: '1 local', nombre: 'La sastrería del dueño', cambia: ['El dueño mide, corta, cobra y arma; la tarjeta está en la libreta y en su cabeza', 'Medio ingreso es compostura y hechura, con el precio de lista pegado en la pared', 'El riesgo es la memoria: las fechas en el calendario y las contraseñas en una libreta'], sistema: ['La ficha de medidas deja de vivir en la libreta y no se vuelve a medir al cliente', 'Las fechas de corte, prueba y entrega salen de la fecha del evento', 'Una caja, un celular y la compostura con su contraseña impresa'], dato: { valor: '1 prueba', rotulo: 'con el saco ya armado, a los 10 o 15 días; dos y con hilván solo en el traje fino' } },
  { n: '5 locales', nombre: 'La sastrería con taller central', cambia: ['La tienda mide y el taller corta en otro lado, o lo hacen dos o tres maquileros a destajo', 'La orden de trabajo y el vale de tela tienen que viajar completos o el taller corta mal', 'Aparece el costo que nadie apuntaba: el reproceso, que ya lo paga la casa'], sistema: ['Orden de trabajo y vale de tela impresos, iguales en las cinco tiendas', 'La ficha del cliente se abre en cualquier sucursal; ya no hay que conocerlo', 'Reproceso con culpable y costo, y el primer traspaso de traje de línea'], dato: { valor: '3.20 m', rotulo: 'para un 42R de dos botones: +0.30 el cruzado y de 10 a 30 cm por casar la raya' } },
  { n: '50 sucursales', nombre: 'La cadena de tiendas de trajes', cambia: ['El traje de línea manda: matriz talla-largo por plaza y liquidaciones por región', 'El taller de ajustes es el cuello de botella de cada tienda y se mide en días de entrega', 'Lo hecho a la medida es un programa: se captura en tienda y se corta en fábrica'], sistema: ['Auditoría de la medida capturada en tienda antes de que el corte salga a fábrica', 'Días de entrega del taller de ajustes por sucursal, y traspasos por talla y largo', 'Corporativo con contrarrecibo a 30/60/90 y comisión del que tomó la medida'], dato: { valor: '36 a 54', rotulo: 'cada talla en regular, corto y largo, con su drop y el pantalón sin bastilla' } },
  { n: '150 sucursales', nombre: 'La operación nacional', cambia: ['Centro de distribución, surtido por rotación y traspasos diarios', 'El taller de ajustes se subcontrata por plaza: mismos precios y tiempos por contrato', 'Concesiones en departamental y franquicias, cada una con su corte de caja'], sistema: ['Lo hecho a la medida vive del CRM: se mide en Monterrey y se entrega en Mérida', 'Tiempos y precios del taller subcontratado, medidos por plaza', 'WhatsApp y tienda en línea como puerta principal, con la cita agendada desde el celular'], dato: { valor: '1 ficha', rotulo: 'de medidas por cliente, viva en toda la cadena y en toda su vida' } },
];

export const problemasSA = {
  doc1: {
    membrete: 'Sistema de ropa', sub: 'Reporte de inventario',
    cab: ['CÓDIGO', 'DESCRIPCIÓN', 'EXIST.'],
    lineas: [
      { a: 'SKU-4711', b: 'CASIMIR AZUL MARINO', c: '1' },
      { a: '—', b: '—', c: '—', tenue: true },
      { a: '—', b: '—', c: '—', tenue: true },
    ],
    margen: ['¿1 qué, metros o pieza?', '¿y el 44 largo?'],
    sello: 'NO VE<br />LOS METROS',
    notas: [
      'Te dice que hay <b>una</b>. No te dice que quedan <b>6.20 m</b> y que no alcanzan para los dos padrinos que faltan.',
      'Cuenta piezas, no metros: la <b>cola</b> de 2 m y la pieza de 50 valen lo mismo para él.',
      'No sabe de <b>largo</b>: el 44R y el 44L son el mismo renglón, y el que entró hoy medía 44L.',
      'No sabe que esos metros ya tienen dueño desde que entró la tijera, ni que hay una <b>boda el 20</b>.',
    ],
  },
  doc2: {
    membrete: 'Desarrollo a la medida', sub: 'Propuesta · rev. 4',
    cab: ['CONCEPTO', 'PLAZO'],
    lineas: [
      { a: 'FICHA DE MEDIDAS', b: 'FASE 2' },
      { a: 'ENTREGA REAL', b: 'PASÓ MAYO', tachado: true },
      { a: 'TABLERO DEL TALLER', b: 'NO' },
    ],
    margen: ['+ 3 adendas', 'y pasaron las bodas'],
    sello: 'LLEGÓ<br />TARDE',
    notas: [
      'Costó <b>más de lo cotizado</b> y la ficha de medidas quedó para la fase 2.',
      'Funciona… mientras <b>quien lo hizo conteste el teléfono</b>. Tu mes es mayo.',
      'Cada cambio chico —sumar los centímetros de <b>casar la raya</b>— es una cotización nueva.',
      'No trae vale de tela al maquilero ni contraseña de compostura. En temporada, <b>el tablero se hace a mano</b>.',
    ],
  },
  filas: [
    { que: 'La ficha de medidas del cliente, con su historial', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Fechas de corte y prueba contadas desde el evento', generico: 'No existe', medida: 'Rara vez', sacs: 'Incluido' },
    { que: 'Tela por metro, con colas y banderillas', generico: 'No existe', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Orden de trabajo y vale de tela al maquilero', generico: 'No existe', medida: 'No existe', sacs: 'Incluido' },
    { que: 'Talla y largo del traje de línea, con traspasos', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Composturas con precio de lista y contraseña', generico: 'A medias', medida: 'A veces', sacs: 'Incluido' },
    { que: 'Tiempo para arrancar', generico: 'Días', medida: '4 a 9 meses', sacs: 'Días' },
  ],
  entrada: 'Casi toda sastrería que llega con nosotros trae uno de estos dos papeles en el cajón: el reporte de un sistema de ropa que cuenta piezas donde hay metros y no sabe de largos, o la cotización de un desarrollo a la medida que iba a resolverlo. Ninguno fue una tontería. Los dos fallan, por motivos distintos.',
  quienes: 'las sastrerías y tiendas de trajes que ya la usan',
};

export const cifrasSA = {
  foto: `${IMG}/escala.webp`,
  alt: 'Taller central de ajustes de una cadena de tiendas de trajes, con los racks por talla y los trajes terminados en funda listos para salir a las sucursales',
  frase: 'Desde la sastrería del dueño hasta la cadena con taller central y programa a la medida.',
  encuadre: 'center 45%',
};
