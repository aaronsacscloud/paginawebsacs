/**
 * Contenido de la landing de UNIFORMES (17-sep-2026): escolares, empresariales, médicos e
 * industriales. Sale de la ficha del oficio (scratchpad/giros-fichas/uniformes.md) con el dictamen
 * del referee aplicado: bastilla (no dobladillo), toma de tallas y relación de tallas por empleado
 * (no tallaje ni nómina de tallas), camisola y overol con reflejante (el casquillo es de la bota),
 * "apoyo a la escuela" (nunca "comisión" en público), ciclo escolar, kínder en talla 2 y 3, y el
 * bloque propio "La lista manda" (lista de la escuela como plantilla prenda lisa + escudo, y el
 * módulo como almacén de temporada: salió − vendido − regresó), sin repetir curva ni nivelación.
 *
 * Funciones prometidas que NO están construidas hoy (decisión del dueño 17-sep: se muestran como
 * parte del sistema; se construyen si el cliente las pide): lista por escuela/empresa que arma el
 * pedido, módulo como sucursal de temporada, estatus y entrega parcial del apartado, bordado como
 * movimiento de inventario (sale lisa, entra con escudo), orden de bordado con ponchados, relación
 * de tallas por empleado, precio por rango de talla, etiquetas por escuela/prenda/talla, usuarios
 * eventuales solo-cobro, estado de cuenta de la escuela, crédito empresarial, liga de pago del saldo
 * por WhatsApp, recordatorio de dotación.
 */
import type { SuiteSeccion } from '../suite-ropa';
import { mockMatriz, mockBarras, mockTicket, mockLista } from './_mocks';

const IMG = '/images/giros/uniformes';

export const bannerUN = {
  eyebrow: 'SACS · Uniformes',
  titulo: 'La lista de la escuela arma el pedido.',
  resalte: 'El módulo cobra sin internet.',
  sub: 'Listas por escuela y por empresa, apartados con anticipo y saldo, el módulo de regreso a clases como almacén de temporada, el bordado del escudo como orden de servicio y la relación de tallas por empleado para facturar — con un mismo inventario para tu tienda, tus módulos y tu WhatsApp.',
  foto: `${IMG}/portada.webp`,
  fotoAlt: 'Tienda de uniformes escolares en agosto: polos por talla, suéteres con escudo, la lista de la escuela en la tablet del mostrador',
  avisos: [
    { modulo: 'Apartado listo', texto: 'Primaria · 4º · suéter 10 y polo 10 bordados · saldo $420 · aviso enviado', pos: 1 as const, tono: 'verde' as const, sello: 'Hoy' },
    { modulo: 'Módulo sin señal', texto: 'Secundaria · mesa 2 · 38 ventas en espera de subir · cobrando', pos: 2 as const, tono: 'azul' as const, sello: 'Ahora' },
    { modulo: 'Se acabó la 12', texto: 'Suéter marino · talla 12 · 0 en el módulo · 14 en la tienda · traspaso pedido', pos: 3 as const, tono: 'ambar' as const, sello: 'Agosto' },
  ],
};

export const manifiestoUN = {
  intro: 'Sabemos cómo se venden los uniformes',
  frases: [
    'Tienes <b>diez escuelas</b> y cada una tiene su lista, su precio y su escudo, y todo está en la cabeza de la encargada y en tres libretas.',
    'En agosto no sabes si la <b>talla 12</b> del suéter está en la tienda, en el módulo o ya la vendiste, hasta que la mamá está enfrente.',
    'Tenías <b>400 apartados</b> y en agosto no sabías cuáles ya estaban listos ni quién te debía saldo.',
    'El módulo de la escuela <b>no tiene internet</b>: cobras con terminal y libreta y en la noche nadie sabe cuánto entró de verdad.',
    'Cortaste por lo que te acordabas del año pasado y te quedaron <b>300 piezas</b> de talla 4 y 16, y la escuela cambió el modelo.',
    'El <b>bordado</b> se te atora: no sabes qué órdenes van primero, qué ponchado ya tienes y qué le prometiste a la empresa para el viernes.',
    'La primera semana de clases se te regresan <b>200 prendas</b> por cambio de talla y se te revuelve todo el inventario.',
    'La empresa te pide factura por <b>120 empleados</b> con talla y nombre de cada uno y te tardas dos días armando la relación.',
  ],
  cierre: 'Ningún sistema de ropa entiende que aquí el pedido lo arma la lista de la escuela, que el módulo es un almacén que nace en julio y muere en septiembre, ni que un suéter liso sirve para diez escuelas hasta que se le borda el escudo. Sacs sí: cada pantalla que sigue funciona igual en el mostrador, en la mesa del módulo sin señal y en el WhatsApp. Y encima puedes poner agentes de IA para que hagan el trabajo repetitivo: el aviso de “ya está listo”, el recordatorio de saldo y el sugerido de cuánto cortar por escuela.',
};

export const variantesUN = {
  eyebrow: 'Una sola escuela',
  titulo: 'Esto es lo que de verdad hay detrás de',
  resalte: '“el uniforme de la primaria”.',
  sub: 'Cuatro prendas de diario, de la talla 2 a la 16. Y cada talla lleva su propia existencia en la tienda y en el módulo: cuando se acaba la 10 del suéter, la mamá se va con el de enfrente aunque tengas veinte de la 4.',
  ejeA: ['2', '4', '6', '8', '10', '12', '14', '16'],
  filas: [
    { nombre: 'Polo blanco', img: `${IMG}/prod-blanco.webp`, alt: 'Polo escolar blanco' },
    { nombre: 'Suéter marino', img: `${IMG}/prod-marino.webp`, alt: 'Suéter escolar azul marino' },
    { nombre: 'Playera roja', img: `${IMG}/prod-rojo.webp`, alt: 'Playera deportiva roja' },
    { nombre: 'Polo verde', img: `${IMG}/prod-verde.webp`, alt: 'Polo escolar verde' },
  ],
  matriz: [
    [6, 9, 12, 14, 2, 0, 4, 5],
    [3, 5, 8, 6, 0, 0, 3, 4],
    [4, 6, 9, 10, 5, 3, 2, 2],
    [2, 4, 7, 8, 1, 0, 2, 3],
  ],
  unidad: 'piezas',
  genero: 'f' as const,
  leyendas: ['Con existencia', 'Quedan pocas', 'Agotada'] as [string, string, string],
  remate: 'El suéter marino ya no tiene 10 ni 12: justo las que más se apartan. Eso se ve aquí, en agosto, no en el inventario de diciembre.',
};

export const cortinaUN = {
  fotoAntes: `${IMG}/cortina-antes.webp`,
  fotoDespues: `${IMG}/cortina-despues.webp`,
  altAntes: 'Dueña de una tienda de uniformes en julio, rodeada de libretas de apartados y bolsas con nombre, buscando un pedido',
  altDespues: 'La misma dueña en agosto, enseñando en la tablet a una mamá que su apartado ya está listo',
  libreta: ['Primaria 4º — ¿ya está el 10?', 'Módulo secundaria: 38 sin subir', 'Saldo Sra. López $420'],
  filas: [
    { que: '¿De qué escuela y qué grado?', donde: 'La lista en pantalla', dato: 'Se arma el pedido solo: prendas, talla, precio, anticipo y saldo' },
    { que: '¿Ya está listo el apartado?', donde: 'Estatus de cada prenda', dato: 'Por cortar, cosida, bordada, lista; el aviso sale por WhatsApp' },
    { que: 'El módulo sin señal', donde: 'Cobra igual', dato: 'Sube en la noche y el corte del módulo cuadra con las cajas' },
    { que: 'Factura por 120 empleados', donde: 'La relación de tallas', dato: 'Cada empleado con su talla y su nombre bordado, facturado junto' },
  ],
  pieDespues: 'La misma dueña, el mismo agosto. Ya no busca en tres libretas: ve.',
};

export const casosUN = [
  {
    id: 'corte',
    titulo: 'Marzo y abril: el corte',
    texto: 'Cortas lo que vas a vender en agosto sin haber vendido nada. El pedido al taller sale por escuela y talla con lo que se vendió el ciclo pasado, lo apartado hasta hoy y la sugerencia de la IA de cuánto cortar. Y la prenda se corta lisa: el escudo se borda cuando ya está apartada.',
    remate: 'Si te pasas, es sobrante un año en bodega. Si te quedas corto, la mamá se va con el de enfrente.',
    img: `${IMG}/caso-taller.webp`,
    alt: 'Fabricante de uniformes con su bordadora de seis cabezas bordando un escudo genérico en suéteres marinos',
  },
  {
    id: 'apartado',
    titulo: 'Mayo y junio: el apartado con anticipo',
    texto: 'Es el dinero que entra antes de tener la prenda y lo que te dice cuánto cortar. Cada apartado con su escuela, su grado, su anticipo, su saldo y su fecha; cada prenda con su estatus. La mamá liquida el saldo con una liga por WhatsApp y recoge en el módulo.',
    remate: 'Sin esto, en agosto hay notas perdidas, saldos sin cobrar y prendas que se entregan dos veces.',
    img: `${IMG}/proceso-lista.webp`,
    alt: 'Empleada capturando la lista de una escuela y el apartado de una mamá en la tablet del mostrador',
  },
  {
    id: 'modulo',
    titulo: 'Agosto: el módulo y la tienda a reventar',
    texto: 'Vendes la mitad del año en cuatro semanas, con módulos sin internet en varias escuelas y traspasos diarios. El módulo es un almacén de temporada: nace con un traspaso contado por talla, cobra sin señal, entrega apartados y cobra saldos, y muere con un regreso contado.',
    remate: 'Salió, vendido, regresó: la diferencia que nadie explicaba ahora tiene nombre.',
    img: `${IMG}/caso-modulo.webp`,
    alt: 'Módulo de venta de uniformes en el patio techado de una escuela, con las cajas por talla y la tablet cobrando',
  },
  {
    id: 'septiembre',
    titulo: 'Septiembre: cambios, sobrante y el apoyo a la escuela',
    texto: 'La primera semana se regresan tallas: cada cambio es un movimiento (sale la 10, entra la 12), no una devolución. Después se cierra el módulo, se cuenta lo que quedó por escuela y se liquida el apoyo a la escuela con su estado de cuenta.',
    remate: 'Si el cambio no se registra como cambio, el inventario queda mentiroso el resto del ciclo.',
    img: `${IMG}/proceso-cambio.webp`,
    alt: 'Mamá cambiando un suéter escolar de talla en el mostrador la primera semana de clases',
  },
];

export const seccionesUN: SuiteSeccion[] = [
  {
    id: 'lista', tag: 'La lista',
    titulo: 'Escuela, grado, y el pedido se arma solo',
    texto: 'Cada escuela y cada empresa con su lista: prendas, tallas y precio, con recargo de talla extra. La encargada pregunta “¿de qué escuela y qué grado?” y la lista arma el pedido con su anticipo y su saldo.',
    bullets: ['Una lista por escuela y por ciclo escolar; se versiona cuando la escuela cambia algo', 'Precio por rango de talla: la 16 y la XL en adelante con su recargo', 'La misma lista en la tienda en línea: la mamá escoge escuela y grado y le sale solo lo suyo'],
    visual: mockTicket('Primaria · 4º grado · apartado', [['Polo blanco · 10', '$280'], ['Suéter marino con escudo · 10', '$520'], ['Pantalón gris · 10', '$390'], ['Deportivo: pants y playera · 10', '$610']], ['Total · anticipo $900 · saldo $900', '$1,800'], 'Recoge en el módulo el 12 de agosto · aviso por WhatsApp cuando esté listo'),
  },
  {
    id: 'escudo', tag: 'Bordado',
    titulo: 'La prenda lisa sirve para diez escuelas',
    texto: 'El suéter liso vale para todas hasta que se le borda el escudo. Bordar es un movimiento de inventario: sale prenda lisa, entra prenda de la escuela. Se borda lo apartado; lo demás se queda liso y sirve el año que entra aunque la escuela cambie de modelo.',
    bullets: ['Sale liso, entra con escudo: el inventario sabe cuántos son de cada escuela', 'Orden de bordado con ponchado, puntadas, cantidad y fecha; cola de qué va primero', 'Catálogo de ponchados: qué escudos y logos ya tienes y de quién son'],
    visual: mockLista('Cola de bordado · esta semana', [['Primaria · escudo · 140 suéteres · apartados', 'Bordando', 'ok'], ['Empresa · logo pecho · 120 camisas · relación por empleado', 'Viernes', 'aviso'], ['Clínica · nombres · 36 filipinas', 'Listo', 'ok'], ['Secundaria · escudo · 80 polos · sin ponchado', 'Falta ponchado', 'gris']], 'Cada orden descuenta prenda lisa y suma prenda de la escuela'),
  },
  {
    id: 'modulo', tag: 'El módulo',
    titulo: 'Un almacén que nace en julio y muere en septiembre',
    texto: 'Al módulo se llevan cajas contadas por talla, la lista de apartados de esa escuela y una tablet. Cobra sin internet y sube en la noche; al cerrar el ciclo, lo que regresa se cuenta y la diferencia tiene nombre.',
    bullets: ['Traspaso a la sucursal de temporada, contado por prenda y talla', 'Cobra sin señal con usuarios eventuales que solo pueden cobrar', 'Corte de caja por módulo, por día y por persona'],
    visual: mockBarras('Módulo · Secundaria · cierre', [['Salió', '900 pz', 100], ['Vendido', '812 pz', 90], ['Regresó', '70 pz', 8], ['Diferencia', '18 pz · 2 %', 2]], 'Lo que salió menos lo vendido menos lo que regresó'),
  },
  {
    id: 'tallas', tag: 'Tallas',
    titulo: '¿Dónde está la 12 del suéter?',
    texto: 'Existencia por escuela, prenda y talla en la tienda, en cada módulo y en las demás sucursales. Traspaso de emergencia en agosto desde el celular, con conteo, y etiquetas por escuela, prenda y talla impresas desde el sistema.',
    bullets: ['De la 2 a la 16 y de la S a la XXL, por escuela', 'Traspasos tienda ↔ módulo ↔ sucursal con conteo de ida y de regreso', 'Cambio de talla como movimiento: sale la 10, entra la 12, con ventana de días'],
    visual: mockMatriz('Suéter marino · Primaria · existencia', ['4', '6', '8', '10', '12', '14', '16'], [['Tienda', [5, 8, 12, 14, 0, 4, 5]], ['Módulo', [2, 3, 6, 0, 0, 2, 1]], ['Sucursal 2', [3, 4, 5, 6, 3, 2, 2]]], 'La 12 se acabó en tienda y módulo: traspaso de 3 desde la sucursal 2', [1, 4]),
  },
  {
    id: 'empresa', tag: 'Empresas y clínicas',
    titulo: 'La relación de tallas por empleado, y la factura junta',
    texto: 'Cotización, muestra, toma de tallas, orden de compra, producción, bordado, entrega y factura. La relación de tallas es la lista del mundo empresarial: 120 empleados, cada uno con su talla y su nombre bordado, entregado por paquete y facturado junto, a 30 o 60 días.',
    bullets: ['Toma de tallas como cita con fecha; relación por empleado en el pedido', 'Cotización → orden de compra → producción → factura, en un solo flujo', 'Recordatorio de dotación anual o semestral por cuenta en el CRM'],
    visual: mockLista('Empresa · dotación 2026 · 120 empleados', [['Camisa manga larga · 120 · con logo · por talla y nombre', 'Bordando', 'aviso'], ['Pantalón · 120 · por cintura', 'Listo', 'ok'], ['Chaleco con reflejante · 40 · almacén', 'Listo', 'ok'], ['Factura a 30 días · orden de compra 4412', 'Al entregar', 'gris']], 'La relación se exporta con talla y nombre por empleado'),
  },
  {
    id: 'whatsapp', tag: 'WhatsApp',
    titulo: '“Ya está listo tu apartado”',
    texto: 'Cuando la prenda cambia a lista, el aviso sale solo por WhatsApp con la liga para liquidar el saldo. La mamá paga sin ir y recoge en el módulo. Y el recordatorio de saldo con fecha llega antes de que empiecen las clases.',
    bullets: ['Aviso automático por estatus del apartado', 'Liga de pago para el saldo; recordatorio con fecha', 'La conversación queda en la ficha de la mamá con la escuela y las tallas de sus hijos'],
    visual: mockLista('WhatsApp · avisos de hoy', [['Sra. López · Primaria 4º · listo · liga de saldo $900', 'Pagado', 'ok'], ['Sr. Ramos · Secundaria 1º · listo · recoge en módulo', 'Enviado', 'ok'], ['Sra. Ortiz · saldo $420 · vence el 10', 'Recordatorio', 'aviso'], ['Clínica · 36 filipinas con nombre · listas', 'Enviado', 'gris']], 'Cada aviso queda en la ficha de la clienta'),
  },
];

export const planoUN = [
  {
    id: 'mostrador', nombre: 'Mostrador y caja con la lista', simbolo: 'mostrador' as const,
    foto: `${IMG}/zona-mostrador.webp`, alt: 'Mostrador de una tienda de uniformes con la lista de la escuela en la tablet y una mamá recibiendo su polo',
    pie: 'Aquí se pregunta de qué escuela y qué grado, y la lista arma el pedido.',
    pregunta: '¿De qué escuela y qué grado?',
    caja: { x: 68, y: 264, w: 216, h: 104 },
    items: [
      { t: 'Las listas de todas las escuelas y empresas en pantalla, no en la pared' },
      { t: 'Anticipo, saldo y venta de mostrador; factura si la piden' },
      { t: 'La nota del apartado impresa o por WhatsApp' },
      { t: 'Cambio de talla en septiembre como movimiento, sin revolver la caja' },
      { t: 'Bastilla y meter la cintura como compostura con fecha, con o sin costo' },
    ],
  },
  {
    id: 'piso', nombre: 'Piso de venta por escuela', simbolo: 'anaqueles' as const,
    foto: `${IMG}/zona-entrada.webp`, alt: 'Piso de venta de una tienda de uniformes con polos y suéteres agrupados por escuela y por talla',
    pie: 'La ropa agrupada por escuela y, dentro de cada escuela, por prenda y talla.',
    pregunta: '¿Hay la 10 del suéter de esta escuela?',
    caja: { x: 68, y: 82, w: 216, h: 172 },
    items: [
      { t: 'Existencia por escuela, prenda y talla: de la 2 a la 16 y de la S a la XXL' },
      { t: 'Etiquetas por escuela, prenda y talla impresas desde el sistema' },
      { t: 'El deportivo junto al diario de la misma escuela para que se lleven los dos' },
      { t: 'Médico y empresarial en su propio muro: filipina, quirúrgico, bata, camisola' },
      { t: 'Lo que se vendió por talla alimenta el sugerido de cuánto cortar el ciclo que entra', plan: 'Automatiza' },
    ],
  },
  {
    id: 'probador', nombre: 'Probador y mesa de cambios', simbolo: 'probadores' as const,
    foto: `${IMG}/zona-probador.webp`, alt: 'Probador y mesa de cambios de una tienda de uniformes, con la cinta métrica colgada',
    pie: 'En septiembre es la fila de cambios: se recibe con etiqueta y se entrega la otra talla.',
    pregunta: '¿Se la cambio aunque la compró en el módulo?',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Cambio de talla con ventana de días y etiqueta puesta, aunque se haya comprado en otra sucursal o en el módulo' },
      { t: 'Sale la 10, entra la 12: el inventario queda derecho' },
      { t: 'Pantalón sin bastilla o con bastilla: se apunta la compostura ahí mismo' },
      { t: 'Toma de tallas de la empresa como cita, con la relación por empleado' },
      { t: 'La mamá queda en el CRM con la escuela y las tallas de sus hijos para el ciclo que entra', plan: 'Fideliza' },
    ],
  },
  {
    id: 'bodega', nombre: 'Bodega de temporada y armado del módulo', ambito: 'Detrás del mostrador', simbolo: 'paquetes' as const,
    foto: `${IMG}/zona-bodega.webp`, alt: 'Bodega de una tienda de uniformes antes del regreso a clases, con las bolsas por escuela y talla y las cajas del módulo',
    pie: 'Las cajas del módulo se arman aquí, contadas por talla, y aquí regresan a contarse.',
    pregunta: '¿Cuánto salió al módulo y cuánto regresó?',
    caja: { x: 298, y: 208, w: 128, h: 96 },
    items: [
      { t: 'Traspaso al módulo contado por prenda y talla; regreso contado al cerrar' },
      { t: 'Bolsas de apartados por nombre y fecha, con su estatus' },
      { t: 'Recepción del corte de la maquila contra lo pedido' },
      { t: 'Sobrante del ciclo pasado en su rincón y con su costo, para que se vea', plan: 'Controla' },
      { t: 'Conteo con el celular sin cerrar la tienda' },
    ],
  },
  {
    id: 'taller', nombre: 'Taller de bordado y pedidos especiales', fuera: true, simbolo: 'armado' as const,
    foto: `${IMG}/zona-taller.webp`, alt: 'Taller de bordado de una tienda de uniformes: la bordadora de seis cabezas y la mesa de revisión',
    pie: 'La bordadora casa la prenda lisa con la escuela; las órdenes corporativas se arman por empleado.',
    pregunta: '¿Qué orden de bordado va primero?',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Orden de bordado con ponchado, puntadas, cantidad, taller y fecha; cola de qué va primero' },
      { t: 'Catálogo de ponchados por escuela y empresa' },
      { t: 'Bordar como movimiento de inventario: sale prenda lisa, entra prenda de la escuela' },
      { t: 'Órdenes corporativas armadas por empleado en paquetes con su etiqueta' },
      { t: 'Pedidos especiales y tallas extra sobre pedido, con anticipo y fecha' },
    ],
  },
];

export const pasosUN = [
  { cuando: 'Día 1', titulo: 'Tus listas, cargadas', texto: 'Nos das tus listas de escuelas y empresas y tu inventario, y lo subimos nosotros. No capturas nada.', detalle: 'Escuela, grado, prenda, talla y precio, con la existencia real de la tienda y los apartados vivos con su anticipo y su saldo.', img: `${IMG}/proceso-recibir.webp`, alt: 'Recepción del corte de la maquila en la puerta trasera de una tienda de uniformes' },
  { cuando: 'Día 2', titulo: 'Tu operación, configurada', texto: 'Queda como ya trabajas: tus escuelas, tus maquilas, tu bordadora y tus módulos.', detalle: 'El apoyo a cada escuela según convenio, la ventana de cambios de talla, el recargo de talla extra y quién puede cobrar en el módulo.', img: `${IMG}/proceso-bordado.webp`, alt: 'Orden de bordado de nombres en filipinas junto a la bordadora' },
  { cuando: 'Día 3', titulo: 'Capacitación', texto: 'Una sesión con tu equipo antes de abrir. Armar un apartado desde la lista y cobrar en el módulo se aprende en media hora.', detalle: 'Y se practica lo del regreso a clases: el traspaso al módulo, el cobro sin señal y el cambio de talla.', img: `${IMG}/proceso-modulo.webp`, alt: 'Empleada cobrando en el módulo de una escuela con la tablet sin internet' },
  { cuando: 'Día 4', titulo: 'Arranca una tienda', texto: 'La primera sucursal vende con Sacs. El sistema viejo sigue en pie por si acaso.', detalle: 'Con los apartados vivos ya migrados: ninguna mamá llega por su uniforme y se encuentra con que su nota no existe.', img: `${IMG}/proceso-cambio.webp`, alt: 'Cambio de talla de un suéter escolar en el mostrador la primera semana de clases' },
  { cuando: 'Día 5', titulo: 'Arrancan las demás', texto: 'Con la primera resuelta, las otras entran el mismo día, y los módulos se abren como sucursales de temporada.', detalle: 'Y el reporte del regreso a clases ya sale por escuela, prenda y talla, que es donde se ve el ciclo.', img: `${IMG}/cierre.webp`, alt: 'Dueña y empleadas contando el sobrante de una escuela por talla al cerrar la temporada' },
];
export const ticketUN = { lineas: [{ n: 'Polo blanco · 10', p: '$280' }, { n: 'Suéter marino con escudo · 10', p: '$520' }, { n: 'Saldo del apartado · Primaria 4º', p: '−$900' }], total: '$0 · liquidado' };

export const escalaUN = [
  { n: '1 tienda', nombre: 'La tienda de la colonia', cambia: ['La dueña se sabe las listas de memoria; los apartados van en libreta', 'El módulo se cobra con terminal y efectivo, y en la noche nadie sabe cuánto entró', 'Una persona lleva bordado, caja y bodega'], sistema: ['La lista por escuela arma el pedido y el apartado con anticipo y saldo', 'El módulo cobra sin internet y sube en la noche', 'Estatus de cada prenda y aviso de “ya está listo” por WhatsApp'], dato: { valor: '$210,000', rotulo: 'en caja en junio con 400 apartados de 3 prendas al 50 % de anticipo' } },
  { n: '5 tiendas', nombre: 'La cadena de la zona', cambia: ['Cada sucursal tiene sus escuelas, pero las mamás se cruzan', 'Traspasos diarios en agosto y “déjame hablar a la otra tienda”', 'El taller o la maquila surte a todas'], sistema: ['Existencia por escuela, prenda y talla en todas las sucursales y módulos', 'Traspasos con conteo de ida y de regreso', 'Un solo pedido a taller que reparte por sucursal'], dato: { valor: '2 %', rotulo: 'de diferencia en el módulo que ahora tiene nombre: salió, vendido, regresó' } },
  { n: '50 tiendas', nombre: 'La cadena con almacén central', cambia: ['Cientos de escuelas; las listas cambian y nadie se entera', 'El módulo es operación: 80 mesas en tres semanas con gente eventual', 'Gerente de zona y encargadas que no conocen al dueño'], sistema: ['Listas centralizadas por ciclo que bajan a todas las sucursales', 'Módulos como sucursales de temporada con usuarios eventuales solo-cobro', 'Sobrante por escuela y sucursal, y el estado de cuenta de cada escuela'], dato: { valor: '80', rotulo: 'mesas de módulo cerrando el mismo día con su corte' } },
  { n: '150 tiendas', nombre: 'La fábrica con tiendas', cambia: ['El corte de 200 mil piezas se decide en marzo con datos de septiembre', 'Corporativo desde una mesa de ventas con crédito', 'Licitaciones estatales y programas de uniformes gratuitos'], sistema: ['IA de surtido por escuela, prenda y talla con tres ciclos de historia', 'Cotización, orden de compra, producción y factura en un flujo; crédito a 30, 45 y 60 días', 'Tienda en línea por escuela surtida desde la sucursal más cercana'], dato: { valor: '3 ciclos', rotulo: 'de venta por escuela y talla detrás de cada decisión de corte' } },
];

export const problemasUN = {
  entrada: 'Casi toda tienda de uniformes que llega con nosotros trae uno de estos dos papeles en el cajón: el reporte de un sistema de ropa que no sabe qué es una lista de escuela ni un módulo, o la cotización de un desarrollo a la medida que iba a resolverlo. Ninguno fue una tontería. Los dos fallan, por motivos distintos.',
  quienes: 'las tiendas y fábricas de uniformes que ya la usan',
};

export const cifrasUN = {
  foto: `${IMG}/escala.webp`,
  alt: 'Almacén central de una cadena de uniformes en julio, con los pedidos por escuela en bolsas listos para salir a los módulos',
  frase: 'Desde la tienda de la colonia hasta la fábrica con tiendas y licitaciones.',
  encuadre: 'center 45%',
};
