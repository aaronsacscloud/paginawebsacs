// Flujos de trabajo de ARTIK Snowpark · Cocina, Compras, Eventos, Operación, Dirección y Administración (2-nov-2026).
//
// Sale de tres conversaciones de levantamiento con el área de restaurantes
// (Chef Mau), compras y resurtidos (Estef) y administración, y de los dos
// reportes PDF de levantamiento (puntos 01–13 del 26-oct y 29–31 del 27-oct).
//
// Cada flujo dice: cómo se hace HOY, qué se rompe, cómo QUEDA (propuesta por
// validar), un ejemplo tomado de la plática, las reglas a configurar, lo que
// falta decidir y cómo se da por buena la prueba.
//
// Los ejemplos con números marcados «de ejemplo» son ilustrativos; los demás
// son los que se dijeron en la sesión. Nada de aquí se presenta como hecho en
// el sistema: son propuestas a validar con las personas responsables.

export type Area = 'cocina' | 'compras' | 'eventos' | 'operacion' | 'direccion' | 'administracion' | 'otras';

export interface Paso {
  t: string;   // qué pasa
  q: string;   // quién
  d?: string;  // detalle
}

export interface Flujo {
  id: string;
  num: string;
  area: Area;
  titulo: string;
  para: string;
  puntos: string[];    // referencias a los PDF (01–50, POS-01…) y nuevos (N1…)
  dir?: string;        // ★ lo que dijo o pidió la Dirección sobre este flujo
  hoy: Paso[];
  dolor: string[];
  queda: Paso[];
  ejemplo?: { titulo: string; lineas: string[]; cuenta?: [string, string][]; nota?: string };
  reglas: string[];
  decidir: { p: string; quien: string }[];
  prueba: string[];
}

export const AREAS: Record<Area, { nombre: string; quien: string; color: string }> = {
  cocina: { nombre: 'Cocina', quien: 'Chef Mau · insumos de cocina', color: 'cocina' },
  compras: { nombre: 'Compras y resurtidos', quien: 'Estef · abastecimiento y recepción', color: 'compras' },
  eventos: { nombre: 'Eventos', quien: 'Ventas y coordinación de eventos', color: 'eventos' },
  operacion: { nombre: 'Operación y punto de venta', quien: 'Taquilla, cajas y responsable del parque', color: 'operacion' },
  direccion: { nombre: 'Dirección y finanzas', quien: 'Dirección y Administración', color: 'direccion' },
  administracion: { nombre: 'Administración y contabilidad', quien: 'Norma y Contabilidad', color: 'administracion' },
  otras: { nombre: 'Otras áreas detectadas', quien: 'Administración', color: 'otras' },
};

export const FLUJOS: Flujo[] = [
  // ─────────────────────────────── COCINA ───────────────────────────────
  {
    id: 'recepcion-conversion',
    num: 'F1',
    area: 'cocina',
    titulo: 'Recepción de insumos con conversión de unidades',
    para: 'Recibir como viene del proveedor (galones, cajas, garrafones) y que el inventario quede en la unidad en que se usa (ml, g, piezas), con el costo correcto y cuadrado contra la factura.',
    puntos: ['01', '08', 'N3', 'N23'],
    dir: 'Están pensando en usar AXO. Con AXO la recepción se hace mandando la foto de la factura: el sistema entiende cómo viene cada producto y lo convierte (litros a mililitros); la persona solo valida. Sacs ya tomó fotos de varias facturas para configurarlo.',
    hoy: [
      { t: 'Llega el proveedor', q: 'Cocina', d: 'Casi todos entregan el martes.' },
      { t: 'Se cuenta lo que llegó', q: 'Cocina', d: 'La mayoría viene en caja sellada. El bollo llega en caja de 225 piezas (9 bolsas de 25).' },
      { t: 'Se convierte a mano', q: 'Chef Mau', d: 'Llegaron 12 galones de aderezo: 12 × 3.79 L, y eso es lo que se captura.' },
      { t: 'Se ajustan precios para que cuadre', q: 'Chef Mau', d: 'El sistema suma el impuesto a cada producto y el total no coincide con la factura; se bajan los precios a mano hasta que la diferencia sea de centavos.' },
      { t: 'Entra al inventario', q: 'Sistema' },
    ],
    dolor: [
      'Cada recepción es una captura con cálculo manual: más tiempo y más riesgo de error (litros contra mililitros).',
      'Los precios capturados no son los reales: se «acomodan» para cuadrar el total.',
      'El total casi nunca cuadra a la primera: siempre salen 2, 3 o hasta 10 pesos de diferencia.',
      'Si el chef descansa el martes, que es cuando llega la mayoría de proveedores, nadie más hace la conversión.',
    ],
    queda: [
      { t: 'La recepción parte de la orden de compra', q: 'Compras', d: 'Ya trae proveedor, productos y cantidades pedidas.' },
      { t: 'Se captura tal como viene', q: 'Cocina', d: '12 galones, 1 caja, 2 garrafones: la presentación del proveedor. Con AXO, basta mandar la foto de la factura.' },
      { t: 'El sistema convierte solo', q: 'Sistema', d: 'Con el factor guardado por presentación: 1 galón = 3,790 ml.' },
      { t: 'Se captura el precio de la factura, con impuestos', q: 'Compras', d: 'El sistema separa subtotal e impuestos y calcula el costo por ml, g o pieza.' },
      { t: 'Se valida contra la factura', q: 'Compras', d: 'Es una revisión, no una captura: el total debe coincidir al centavo.' },
      { t: 'Entra al inventario en unidad de consumo', q: 'Sistema', d: 'Y la receta descuenta exactamente lo que usa.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión: 12 galones de aderezo',
      lineas: ['El proveedor factura 12 piezas; cocina usa el aderezo por mililitros.'],
      cuenta: [
        ['Llegan', '12 galones'],
        ['Factor guardado', '1 galón = 3.79 L = 3,790 ml'],
        ['Entra al inventario', '12 × 3,790 = 45,480 ml'],
        ['Costo por ml', 'total de la factura ÷ 45,480'],
      ],
      nota: 'Lo mismo para el bollo (1 caja = 225 piezas) y el aceite de soya (1 garrafón = 10 L = 10,000 ml).',
    },
    reglas: [
      'Factor de conversión por insumo y por presentación de cada proveedor (galón, caja, bolsa, garrafón).',
      'Unidad de consumo definida por insumo: ml, g o pieza. Nunca litros en un insumo y mililitros en su receta.',
      'Captura del precio con impuestos incluidos: el sistema calcula el subtotal.',
      'Diferencia permitida contra la factura: solo centavos por redondeo.',
    ],
    decidir: [
      { p: 'Lista de presentaciones por proveedor con su equivalencia (galón, caja, bolsa, garrafón).', quien: 'Chef Mau y Estef' },
      { p: '¿Quién recibe y valida el conteo los martes que el chef descansa?', quien: 'Cocina' },
      { p: '¿Qué insumos se pesan al recibir (los que vienen en bolsa)?', quien: 'Chef Mau' },
      { p: '¿Se usa AXO para las recepciones? Sacs envía los planes con su recomendación (el básico alcanza para recepciones, reportes, costeo y mínimos y máximos).', quien: 'Dirección' },
    ],
    prueba: [
      'Capturo 12 galones y el inventario sube 45,480 ml.',
      'El costo por ml sale solo, sin calculadora.',
      'El total de la recepción coincide con la factura sin tocar ningún precio.',
    ],
  },
  {
    id: 'recetas-costeo',
    num: 'F2',
    area: 'cocina',
    titulo: 'Recetas y costeo de platillos',
    para: 'Que cada platillo descuente lo que de verdad lleva, con el margen de limpieza ya contemplado, y que nada «variable» provoque negativos.',
    puntos: ['02', '04'],
    dir: 'Está de acuerdo con cómo costea el chef: el margen de limpieza va en la receta y no se registra como merma. Merma es lo que se pierde por completo.',
    hoy: [
      { t: 'Todos los platillos son productos compuestos con insumos', q: 'Chef Mau', d: 'En gramos, mililitros o piezas.' },
      { t: 'Las cantidades van en crudo', q: 'Chef Mau', d: 'La papa: 140 g antes de freírse.' },
      { t: 'El margen de limpieza va dentro de la receta', q: 'Chef Mau', d: 'Jitomate: se aprovechan 35 g y se registran 40 g, para no capturar merma por cada limpieza.' },
      { t: 'Los sobres van dentro de la receta', q: 'Chef Mau', d: 'Mayonesa y cátsup se costearon «más o menos» por hamburguesa.' },
    ],
    dolor: [
      'Hay quien no pide mayonesa y quien se lleva tres sobres: el inventario de sobres nunca cuadra.',
      'El sistema dice «ya no tienes» cuando sí hay en físico, o deja productos en negativo y no deja hacer movimientos.',
    ],
    queda: [
      { t: 'La receta lleva solo lo que el platillo siempre lleva', q: 'Chef Mau', d: 'Bollo, carne, lechuga, jitomate, papa.' },
      { t: 'El margen de limpieza queda a la vista', q: 'Chef Mau', d: 'Se conserva dentro de la receta, pero anotado como rendimiento por insumo para saber cuánto se paga por limpieza.' },
      { t: 'Los consumibles de mesa salen de la receta', q: 'Chef Mau', d: 'Se controlan por dotación (flujo F3).' },
      { t: 'Cada venta descuenta solo lo real', q: 'Sistema', d: 'Sin negativos provocados por porciones variables.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión: hamburguesa',
      lineas: ['Jitomate: 35 g útiles + 5 g de puntas y limpieza = 40 g en la receta.', 'Papa: 140 g en crudo, antes de freírse.', 'Mayonesa y cátsup: fuera de la receta; se controlan por dotación.'],
      cuenta: [
        ['Jitomate en receta', '40 g'],
        ['Rendimiento', '35 ÷ 40 = 87.5 %'],
      ],
    },
    reglas: [
      'Recetas en unidad de consumo (g, ml, pieza), en crudo.',
      'Rendimiento técnico por insumo (limpieza normal) separado de las pérdidas extraordinarias, que van en el flujo F5.',
      'Pasteles y pizzas de eventos: sus porciones por número de personas se definen en el paquete (F14).',
    ],
    decidir: [
      { p: 'Rendimiento real de cada insumo que se limpia (jitomate, lechuga, cebolla…).', quien: 'Chef Mau' },
      { p: 'Lista de lo que sale de las recetas: mayonesa, cátsup, chiles jalapeños, azúcar, mascabado, sustituto de azúcar…', quien: 'Chef Mau' },
    ],
    prueba: [
      'Vendo una hamburguesa y se descuenta bollo, carne, 40 g de jitomate y 140 g de papa, sin sobres.',
      'Después de una semana no aparece ningún insumo de receta en negativo.',
    ],
  },
  {
    id: 'consumibles-mesa',
    num: 'F3',
    area: 'cocina',
    titulo: 'Consumibles de mesa por dotación',
    para: 'Medir lo que de verdad se consume de sobres y condimentos sin registrarlo en cada venta y sin cargarlo a la receta.',
    puntos: ['04'],
    dir: 'Sí hay que controlarlos, como un producto aparte con su propia lógica y sin cargarlos a la receta. Sumó el azúcar y la Nutella de las crepas de la temporada navideña.',
    hoy: [
      { t: 'Los sobres se ponen en el despachador y en mesas', q: 'Cocina', d: 'Cada quien toma; con 800 o 900 personas un sábado es imposible entregarlos uno por uno.' },
      { t: 'También salen a las mesas de los eventos', q: 'Eventos' },
      { t: 'Lo que sobra regresa y se vuelve a usar', q: 'Cocina' },
      { t: 'No se cuentan', q: '—' },
    ],
    dolor: [
      'No se sabe cuánto se consume ni cuánto cuesta.',
      'Al estar dentro de la receta, el inventario «brinca» todo el tiempo.',
    ],
    queda: [
      { t: 'Se registra la dotación que sale', q: 'Cocina', d: 'Por ejemplo: el viernes se dejan 2,000 sobres de cátsup para el fin de semana.' },
      { t: 'Durante el día no se registra nada', q: '—', d: 'La operación no cambia.' },
      { t: 'Se cuenta lo que quedó', q: 'Cocina', d: 'Al cierre del día o el lunes en la mañana.' },
      { t: 'Consumo real = dotación − sobrante', q: 'Sistema', d: 'Se carga como consumo del área, no a cada platillo.' },
      { t: 'Se compara contra visitantes', q: 'Chef Mau', d: 'Sobres por visitante, semana contra semana.' },
    ],
    ejemplo: {
      titulo: 'Números de ejemplo',
      lineas: ['Fin de semana con 800 visitantes el sábado.'],
      cuenta: [
        ['Dotación del viernes', '2,000 sobres'],
        ['Conteo del lunes', '650 sobres'],
        ['Consumo real', '1,350 sobres'],
      ],
      nota: 'Con el dato real se puede decidir cuántos sobres poner y cuánto cuesta la cortesía por visitante.',
    },
    reglas: [
      'Lista de consumibles por dotación: mayonesa, cátsup, chiles jalapeños, azúcar, mascabado, sustituto de azúcar, Nutella de las crepas de temporada y los que se agreguen.',
      'Frecuencia de conteo: por día o por fin de semana.',
    ],
    decidir: [
      { p: '¿Se cuenta diario o cada fin de semana?', quien: 'Chef Mau' },
      { p: '¿Quién entrega la dotación y quién cuenta el sobrante?', quien: 'Cocina' },
      { p: '¿Cómo se registra el costo en la contabilidad (consumo del área o cortesía)?', quien: 'Administración · lo propone Sacs' },
    ],
    prueba: [
      'Registro una dotación y su sobrante, y el inventario baja solo por la diferencia.',
      'Vender una hamburguesa ya no toca los sobres.',
    ],
  },
  {
    id: 'comanda-entrega',
    num: 'F4',
    area: 'cocina',
    titulo: 'De la comanda a la entrega',
    para: 'Que ninguna orden se pierda, que lo entregado quede registrado y que no se entregue dos veces.',
    puntos: ['06', '07', '20', '21', '30'],
    hoy: [
      { t: 'Caja cobra y manda la comanda', q: 'Caja' },
      { t: 'A veces no aparece en la pantalla de cocina', q: 'Cocina', d: 'O se queda congelada al marcarla como terminada y hay que actualizar. Pasa una o dos veces por semana.' },
      { t: 'Los combos se entregan por partes', q: 'Cocina', d: 'Charola de nieve, palomitas, agua, chocolate caliente: se marcan en un papel con firma de caja.' },
      { t: 'En eventos, los extras se piden de palabra', q: 'Eventos', d: 'O en papelitos; con 15 fiestas a la misma hora el sábado, no hay forma de llevar la cuenta.' },
    ],
    dolor: [
      'Cliente: «yo ya pedí», y la orden nunca llegó a cocina.',
      'Con el papel se puede reclamar dos veces el mismo ticket.',
      'Lo que se entrega en eventos sin pasar por el sistema no se cobra ni se descuenta.',
    ],
    queda: [
      { t: 'Toda comanda llega con su folio', q: 'Sistema', d: 'Si no se recibe en pantalla, se avisa; se puede buscar por folio.' },
      { t: 'Los combos muestran sus partes', q: 'Cocina', d: 'Cada parte con casilla entregado o pendiente.' },
      { t: 'Un ticket entregado no se vuelve a entregar', q: 'Sistema', d: 'Si alguien regresa con el mismo ticket, la pantalla dice «ya entregado».' },
      { t: 'Los pedidos de eventos tienen zona propia', q: 'Sistema', d: 'Con otro color y una estrella, el nombre del evento y del responsable.' },
      { t: 'Al terminar, se marca y desaparece', q: 'Cocina', d: 'Sin actualizar la pantalla.' },
    ],
    reglas: [
      'Pantalla de cocina con prioridad para eventos y color propio.',
      'Entrega por parte para combos, con identificador único por ticket.',
      'Pedido del cliente desde su mesa: quedó en plan; va después de asegurar que ninguna comanda se pierde.',
    ],
    decidir: [
      { p: '¿Quién marca la entrega: cocina o despacho?', quien: 'Chef Mau' },
      { p: 'Color y orden de los pedidos de eventos en la pantalla.', quien: 'Chef Mau' },
      { p: 'Para reproducir la falla: dispositivo, hora y folio de la próxima comanda que no aparezca.', quien: 'Cocina → Sacs' },
    ],
    prueba: [
      'Una comanda de prueba aparece en la pantalla de cocina en segundos.',
      'Marcarla como terminada la quita sin actualizar.',
      'Un combo entregado por partes queda «pendiente: chocolate» hasta que se entrega.',
      'El mismo ticket no se puede entregar dos veces.',
    ],
  },
  {
    id: 'mermas',
    num: 'F5',
    area: 'cocina',
    titulo: 'Mermas y pérdidas con motivo y responsable',
    para: 'Que toda pérdida quede registrada con su causa, su costo y quién la generó, para poder medirla y corregirla.',
    puntos: ['05'],
    dir: 'Preguntó dónde están las pérdidas más grandes. Todavía no se sabe porque no se registran; lo que se vio es que vienen más de cambios de menú y accidentes que del proveedor, cuya merma es poca.',
    hoy: [
      { t: 'Se cae una charola', q: 'Meseros de eventos', d: 'La mayoría son chicos nuevos.' },
      { t: 'Llega producto dañado del proveedor', q: 'Cocina', d: 'Se descubre al acomodar: una lata ponchada, un empaque inflado o roto. Es poco, alrededor del 2 %.' },
      { t: 'Sobra comida de eventos', q: 'Cocina', d: 'Por cambios de último momento o porque llegaron menos invitados.' },
      { t: 'Se intenta recuperar', q: 'Cocina', d: 'Se recalienta y se vende si todavía se puede; si no, se tira.' },
      { t: 'No se registra', q: '—', d: 'La empresa absorbe el costo; a veces se cobra al colaborador cuando fue por desorden.' },
    ],
    dolor: [
      'El inventario no cuadra y cocina carga con la diferencia.',
      'No se sabe cuánto dinero se pierde, por qué ni quién lo genera.',
      'Lo que el proveedor promete reponer («la próxima te lo traigo») no queda registrado.',
    ],
    queda: [
      { t: 'Se registra en el momento', q: 'Quien lo detecta', d: 'Producto, cantidad, motivo y foto.' },
      { t: 'Se elige el motivo', q: 'Quien lo detecta', d: 'De una lista corta (abajo).' },
      { t: 'Se anota el responsable cuando aplica', q: 'Chef Mau', d: 'Para medir por persona, no para castigar a la primera.' },
      { t: 'El costo sale solo', q: 'Sistema' },
      { t: 'El daño de proveedor queda ligado a su recepción', q: 'Compras', d: 'Y aparece como saldo a reponer con ese proveedor (flujo F8).' },
      { t: 'Reporte semanal', q: 'Chef Mau', d: 'Por motivo, por persona y por proveedor.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión',
      lineas: ['Con unas 42 fiestas a la semana, en 5 o 6 se cae una charola.', 'Ayer sobraron 16 hamburguesas de un evento: unas se recuperaron y otras no.'],
      cuenta: [
        ['Charolas caídas por semana', '5 a 6'],
        ['Hamburguesas por charola', '6'],
        ['Hamburguesas perdidas por semana', '30 a 36'],
      ],
      nota: 'Las cifras por charola son las que se dijeron; el total semanal es una estimación para dimensionar.',
    },
    reglas: [
      'Motivos: daño de proveedor · caducidad · accidente operativo (charola caída, derrame) · error de evento (cambio de menú o menos invitados) · producto no recuperable.',
      'La merma técnica de limpieza NO se registra aquí: ya está en la receta (F2).',
      'Foto obligatoria en daño de proveedor.',
    ],
    decidir: [
      { p: 'Política de responsabilidad: ¿cuándo se cobra al colaborador y cuándo absorbe la empresa?', quien: 'Dirección' },
      { p: '¿Se reclama al proveedor el producto dañado? ¿Cómo se registra la reposición?', quien: 'Estef' },
      { p: '¿Quién puede registrar pérdidas y quién las autoriza?', quien: 'Chef Mau' },
    ],
    prueba: [
      'Registro 6 hamburguesas caídas con foto y responsable: baja el inventario y aparece en el reporte con su costo.',
      'Una lata ponchada queda ligada al proveedor y a su recepción.',
    ],
  },
  {
    id: 'colaboradores',
    num: 'F6',
    area: 'cocina',
    titulo: 'Consumo de colaboradores',
    para: 'Aplicar el descuento del personal en automático, sin firmas en papel y sin que lo usen personas que no son colaboradores.',
    puntos: ['N4'],
    hoy: [
      { t: 'El colaborador compra con 50 % de descuento', q: 'Caja', d: 'El descuento se aplica a mano.' },
      { t: 'Cocina solo entrega con el ticket firmado', q: 'Cocina', d: 'Para saber que es de verdad un colaborador y que nadie más reclame el mismo platillo.' },
    ],
    dolor: [
      'Ya pasó que familiares o amigos de quien estaba en caja usaron el descuento.',
      'El descuento manual no queda ligado a una persona.',
    ],
    queda: [
      { t: 'Cada colaborador está dado de alta como cliente tipo «Colaborador»', q: 'Administración' },
      { t: 'Al cobrar se selecciona al colaborador', q: 'Caja' },
      { t: 'El 50 % se aplica solo', q: 'Sistema', d: 'Excepto dulcería y helados.' },
      { t: 'El ticket sale con su nombre y «Descuento colaborador»', q: 'Sistema', d: 'Cocina ve el nombre en la comanda: ya no hace falta firma.' },
      { t: 'Familiares: solo con autorización', q: 'Gerencia', d: 'O con aviso previo a la gerencia.' },
    ],
    reglas: [
      'Tipo de cliente «Colaborador» con 50 % de descuento.',
      'Exclusiones: dulcería y helados.',
      'El descuento aparece en el ticket y en el reporte de descuentos por persona.',
    ],
    decidir: [
      { p: 'Lista de colaboradores y quién la mantiene al día (altas y bajas).', quien: 'Administración' },
      { p: '¿Hay límite por día o por turno?', quien: 'Dirección' },
      { p: '¿Cómo se autoriza a familiares?', quien: 'Dirección' },
    ],
    prueba: [
      'Cobro a un colaborador una hamburguesa y un helado: solo la hamburguesa lleva 50 %.',
      'El ticket y la comanda muestran su nombre.',
    ],
  },
  {
    id: 'cuadre-cocina',
    num: 'F7',
    area: 'cocina',
    titulo: 'Cuadre de inventario de cocina por canal',
    para: 'Comparar lo que compró cocina contra todo lo que consumió, venga de donde venga la venta: restaurante, eventos o combos de taquilla.',
    puntos: ['03', 'N8'],
    hoy: [
      { t: 'Cocina compra para todo', q: 'Compras', d: 'Restaurante, fiestas y combos.' },
      { t: 'Muchos combos se cobran en taquilla', q: 'Taquilla', d: 'La comida va dentro del combo y no aparece como venta de cocina.' },
      { t: 'Los eventos se cobran aparte', q: 'Eventos' },
      { t: 'Se compara compras contra ventas del restaurante', q: 'Dirección' },
    ],
    dolor: [
      'Parece que cocina compró de más: se ve todo lo comprado pero solo una parte de lo vendido.',
      'Los faltantes se concentran en hamburguesas, nuggets, agua y refrescos: lo que más sale en eventos.',
    ],
    queda: [
      { t: 'Inventario inicial', q: 'Cocina' },
      { t: '+ Compras recibidas', q: 'Compras' },
      { t: '− Consumo por canal', q: 'Sistema', d: 'Restaurante + eventos + combos de taquilla + colaboradores.' },
      { t: '− Pérdidas registradas', q: 'Sistema', d: 'Del flujo F5, por motivo.' },
      { t: '= Inventario teórico contra físico', q: 'Chef Mau', d: 'La diferencia que queda es la que hay que investigar.' },
    ],
    reglas: [
      'Todo combo o paquete que incluya alimentos descuenta sus componentes del inventario de cocina.',
      'Reporte de consumo de cocina separado por canal.',
    ],
    decidir: [
      { p: '¿Cada cuánto se hace el conteo físico de cocina?', quien: 'Chef Mau' },
      { p: '¿Qué combos de taquilla incluyen alimentos y cuáles son sus componentes?', quien: 'Dirección' },
    ],
    prueba: [
      'Vender un combo en taquilla descuenta sus alimentos del inventario de cocina.',
      'El reporte muestra cuánto se consumió por canal y la diferencia contra el conteo físico.',
    ],
  },

  // ─────────────────────────────── COMPRAS ──────────────────────────────
  {
    id: 'compra-pago-recepcion',
    num: 'F8',
    area: 'compras',
    titulo: 'Orden de compra, pago anticipado, recepción y saldo con el proveedor',
    para: 'Pagar por adelantado sin perder el control: recibir solo lo que de verdad llegó y que lo que falte quede como saldo a favor con el proveedor.',
    puntos: ['08', '09', '13', 'N1', 'N25'],
    dir: 'Su regla: lo que pasa en la realidad se registra en ese momento, ni antes ni después. Si faltaron 10, se reciben 90 y quedan 10 que debe el proveedor. Pagar por adelantado no quita revisar lo que llegó.',
    hoy: [
      { t: 'Hasta hace tres semanas se hacía recepción directa', q: 'Cocina', d: 'Ahora se usa la orden de compra, pero a veces se crea el mismo día que llega la mercancía.' },
      { t: 'Se pide el lunes y se entrega el martes', q: 'Estef' },
      { t: 'Administración paga siempre por adelantado', q: 'Norma', d: 'Pero sin recepción o sin factura no tiene con qué liberar el pago.' },
      { t: 'Si llega de menos, se recibe completo', q: 'Estef', d: 'Y el proveedor promete descontarlo en el siguiente pedido.' },
      { t: 'Nadie lleva la cuenta de lo prometido', q: '—' },
      { t: 'Administración paga el martes y la mercancía llega días después', q: 'Norma', d: 'Los desechables se piden hasta 20 días antes. Mientras no se recibe, el sistema no refleja el pago.' },
    ],
    dolor: [
      'Recibir antes de contar da por buena mercancía que no llegó.',
      'Cuando el proveedor nota que no se cuenta, empieza a mandar menos.',
      'Los descuentos prometidos dependen de que alguien se acuerde.',
      'Administración y compras se frenan entre sí: una pide la recepción y la otra no puede recibir lo que no ha llegado.',
      'Si la mercancía ya se había recibido, para pagarla habría que hacer otra orden y se duplicaría el inventario.',
    ],
    queda: [
      { t: 'Requisición de compra', q: 'Estef', d: 'Lo que se necesita, con el sugerido (F10).' },
      { t: 'Revisión y autorización', q: 'Norma y Dirección', d: 'Administración revisa que sea razonable; la Dirección autoriza y comenta (F27).' },
      { t: 'Orden de compra el día del pedido', q: 'Estef', d: 'El lunes, no el martes. Se le manda al proveedor por correo o WhatsApp desde el sistema.' },
      { t: 'Pago anticipado contra la orden', q: 'Norma', d: 'Queda como saldo a favor con el proveedor.' },
      { t: 'Llega la mercancía y se cuenta', q: 'Cocina', d: 'Contra la orden: pedido contra recibido.' },
      { t: 'Se recibe SOLO lo que llegó bien', q: 'Estef', d: 'Solo eso sube al inventario.' },
      { t: 'Se descuenta del saldo a favor lo entregado', q: 'Sistema' },
      { t: 'Lo que faltó queda como saldo a favor', q: 'Sistema', d: 'Ligado a la factura y visible en la ficha del proveedor.' },
      { t: 'En el siguiente pedido aparece el saldo', q: 'Estef', d: 'Para aplicarlo y avisarle al proveedor.' },
      { t: 'Seguimiento por etapa', q: 'Sistema', d: 'Pendiente de autorizar, de pagar, de recibir o con saldo a favor; quién hizo cada paso y cuánto tardó.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión: proveedor de cerveza',
      lineas: ['Pedido el lunes, entrega el martes; llegaron 18 latas ponchadas. Se recibió completo y se pagó completo; el proveedor dijo que lo descontaría del siguiente pedido.'],
      cuenta: [
        ['Pagado por adelantado', '$20,000'],
        ['Entregado en buen estado', '$18,000'],
        ['Saldo a favor con el proveedor', '$2,000'],
      ],
      nota: 'Los importes son de ejemplo, los mismos que se usaron en la sesión. En el ejemplo de los refrescos: si se piden 50 y llegan 50, la orden se cierra sin saldo.',
    },
    reglas: [
      'Orden de compra antes de la entrega; la recepción siempre parte de una orden.',
      'Recepción parcial: pedido, recibido y diferencia por renglón.',
      'Saldo a favor por proveedor, con su historia por factura.',
      'Tablero de compras: pedido · recibido · pendiente · facturado · pagado · saldo a favor.',
    ],
    decidir: [
      { p: '¿El pago se libera contra la orden o contra la factura?', quien: 'Norma' },
      { p: '¿Quién autoriza la orden y quién el pago?', quien: 'Dirección' },
      { p: '¿Cómo se le comunica al proveedor su saldo pendiente?', quien: 'Estef' },
    ],
    prueba: [
      'Orden de 50 refrescos pagada; se reciben 45: el inventario sube 45 y el proveedor queda con 5 a favor.',
      'La siguiente orden a ese proveedor muestra el saldo para aplicarlo.',
      'Administración ve la orden pagada sin esperar la recepción.',
    ],
  },
  {
    id: 'pagos-parciales',
    num: 'F9',
    area: 'compras',
    titulo: 'Acuerdos de pago en partes',
    para: 'Recibir el pedido completo y pagarlo en abonos acordados, sabiendo en todo momento qué se debe y para cuándo.',
    puntos: ['09', '13', 'N2'],
    dir: 'Con proveedores a crédito, como el de refrescos, los abonos se deciden según el flujo de cada semana; lo único es no dejar facturas vencidas más de un mes.',
    hoy: [
      { t: 'El proveedor ya tiene la producción para Artik', q: 'Proveedor', d: 'Calcetas.' },
      { t: 'Entrega el 100 % en un solo viaje', q: 'Proveedor', d: 'Para no pagar dos fletes.' },
      { t: 'Factura solo el 50 %', q: 'Proveedor', d: 'La otra mitad se paga más adelante.' },
      { t: 'Se recibe el total', q: 'Estef', d: 'Y no queda claro cómo registrar que solo se pagó la mitad.' },
    ],
    dolor: [
      'No se ve qué recepciones están completas pero pendientes de pago.',
      'La fecha del segundo pago depende de la memoria.',
    ],
    queda: [
      { t: 'Se recibe todo lo que llegó', q: 'Estef', d: '100 % al inventario.' },
      { t: 'Se registra el acuerdo de pago', q: 'Norma', d: 'Abono 1: 50 % ahora. Abono 2: 50 % con fecha (por ejemplo, 30 de noviembre).' },
      { t: 'La cuenta por pagar muestra lo pagado y lo pendiente', q: 'Sistema' },
      { t: 'Aviso antes de la fecha del abono', q: 'Sistema' },
      { t: 'La segunda factura se liga cuando llegue', q: 'Norma' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión',
      lineas: ['Factura de $10,000: se pagan $8,000 y los $2,000 restantes el mes siguiente. Para Artik no cambia nada en la gestión de facturas: el complemento de pago lo emite el proveedor.', 'Ejemplo de la Dirección: un evento grande pide $200,000 de refresco; hay $50,000 en bancos; se abonan $20,000 y el resto cuando el evento paga.'],
    },
    reglas: [
      'Abonos programados por cuenta por pagar.',
      'Vista de recepciones «recibido completo · pagado en parte».',
    ],
    decidir: [
      { p: '¿Quién registra el acuerdo y quién lo autoriza?', quien: 'Norma y Dirección' },
      { p: '¿Con cuánta anticipación avisa el sistema del siguiente abono?', quien: 'Norma' },
    ],
    prueba: [
      'Recepción del 100 % con dos abonos: el tablero dice «recibido 100 % · pagado 50 % · pendiente al 30-nov».',
    ],
  },
  {
    id: 'resurtido-semanal',
    num: 'F10',
    area: 'compras',
    titulo: 'Resurtido semanal: venta del parque y eventos por separado',
    para: 'Que cada lunes el sistema diga cuánto pedir, separando la venta del día a día de lo que piden los eventos ya confirmados.',
    puntos: ['10', '11'],
    dir: 'Sacs le explicó que el resurtido debe ver solo la venta del día a día y los eventos confirmados por separado. La Dirección pidió considerar en cada periodo el tiempo de entrega de cada proveedor.',
    hoy: [
      { t: 'El chef manda su pedido en Excel', q: 'Chef Mau → Estef' },
      { t: 'Las existencias del sistema no son confiables', q: '—', d: 'Lo de eventos no se descuenta bien.' },
      { t: 'Se pide el lunes y llega el martes', q: 'Estef', d: 'Un solo pedido para venta y eventos.' },
      { t: 'Pedir de menos deja al cliente sin producto', q: '—' },
    ],
    dolor: [
      'El sugerido del sistema avisa con un porcentaje de existencia, pero no según cuántos días alcanza.',
      'Noviembre y diciembre se venden distinto que agosto: la temporada cambia el pedido.',
      'Dirección quiere órdenes automáticas, pero eso exige un inventario confiable primero.',
    ],
    queda: [
      { t: 'Venta del parque', q: 'Sistema', d: 'Analiza el periodo que se elija (por ejemplo, del 1 al 30 de agosto) y calcula lo necesario para 10, 20 o 30 días.' },
      { t: 'Eventos confirmados de la semana', q: 'Sistema', d: 'Sale del calendario: asistentes × receta del paquete. No es estadística: es lo contratado.' },
      { t: 'Colchón para eventos de último momento', q: 'Sistema', d: 'Un porcentaje que se ajusta con lo medido cada semana.' },
      { t: 'Vista por familia', q: 'Estef', d: 'Insumos de cocina, bebidas, souvenirs y peluches, o todo junto.' },
      { t: 'Revisión del lunes', q: 'Chef Mau y Estef', d: 'Mau valida lo de eventos y cocina; Estef, la venta normal.' },
      { t: 'Se genera la orden de compra', q: 'Estef', d: 'Adiós al Excel.' },
    ],
    reglas: [
      'Periodo de análisis configurable por temporada.',
      'Cobertura en días (10, 20, 30) por familia.',
      'Requerimiento de eventos separado de la venta regular, con vista consolidada.',
      'Tiempo de entrega real de cada proveedor en el cálculo (F28).',
      'Requisito previo: inventario confiable (F2, F5, F7 y F23).',
    ],
    decidir: [
      { p: 'Mínimos, tiempo de entrega y día de pedido por proveedor.', quien: 'Estef' },
      { p: 'Periodos de referencia para temporada alta y baja.', quien: 'Estef y Dirección' },
      { p: 'Porcentaje de colchón para eventos de último momento.', quien: 'Chef Mau y Estef' },
    ],
    prueba: [
      'El lunes sale el sugerido con dos columnas: eventos confirmados y venta del parque.',
      'Se genera la orden de compra desde el sugerido, sin Excel.',
    ],
  },
  {
    id: 'eventos-expres',
    num: 'F11',
    area: 'compras',
    titulo: 'Eventos exprés y compras urgentes',
    para: 'Que un evento vendido de última hora avise de inmediato qué hace falta y si alcanza con lo que hay.',
    puntos: ['12', '31', '36'],
    hoy: [
      { t: 'Ventas puede vender eventos para el mismo día', q: 'Ventas', d: 'Lo autorizó la Dirección. También llegan corporativos, escuelas y grupos de hasta 600 personas.' },
      { t: 'El pedido semanal ya salió', q: 'Estef' },
      { t: 'Cocina se entera tarde', q: 'Chef Mau' },
    ],
    dolor: [
      'La diferencia no es de 20 piezas: puede ser de 800 hamburguesas.',
      'El sistema sugiere «tres cajas» cuando en un solo día salen casi cuatro cajas de 72.',
    ],
    queda: [
      { t: 'Ventas registra el evento exprés', q: 'Ventas', d: 'Con asistentes, paquete y hora.' },
      { t: 'Aviso inmediato a Cocina y Compras', q: 'Sistema', d: 'Con lo que se necesita: receta × asistentes.' },
      { t: 'Se compara con lo disponible', q: 'Sistema', d: 'Existencia menos lo ya comprometido para otros eventos, y espacio libre a esa hora.' },
      { t: 'Cocina confirma si se puede', q: 'Chef Mau', d: 'Idealmente antes de que Ventas cierre la venta.' },
      { t: 'Si falta, compra urgente sugerida', q: 'Estef', d: 'Con el proveedor que pueda entregar a tiempo.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión',
      lineas: ['Hoy se contrata un evento para mañana con 800 hamburguesas. El reporte de la semana debe sumarlo al momento y avisar.'],
      cuenta: [
        ['Hamburguesas por caja', '72'],
        ['800 hamburguesas', '≈ 11.1 cajas'],
      ],
    },
    reglas: [
      'Aviso por evento nuevo o modificado dentro de la semana en curso.',
      'Registro de los eventos exprés para medir el colchón (F10).',
    ],
    decidir: [
      { p: 'Anticipación mínima para aceptar un evento exprés.', quien: 'Dirección y Ventas' },
      { p: '¿Quién autoriza una compra urgente?', quien: 'Dirección' },
      { p: '¿Desde qué momento un evento cuenta como confirmado para compras?', quien: 'Ventas' },
    ],
    prueba: [
      'Creo un evento exprés de 60 personas y llega el aviso con lo necesario contra la existencia.',
    ],
  },
  {
    id: 'menu-especial',
    num: 'F12',
    area: 'compras',
    titulo: 'Menús especiales y corporativos',
    para: 'Atender menús a la medida sin llenar el sistema de productos que se venden una vez, y saber cuánto se ganó.',
    puntos: ['18', '29', '31'],
    hoy: [
      { t: 'Ventas ofrece un menú a la medida', q: 'Ventas', d: 'Tacos, salmón a la plancha con arroz, chilaquiles, coffee break, baguettes de arrachera.' },
      { t: 'Cocina compra insumos especiales', q: 'Chef Mau' },
      { t: 'No se registra como producto', q: '—', d: 'Para no crear un producto compuesto que se vende una vez al año.' },
    ],
    dolor: [
      'No queda registrado cuánto costó ni cuánto se ganó.',
      'No se sabe qué menús se repiten.',
    ],
    queda: [
      { t: 'Eventos registra el «menú especial» en la reservación', q: 'Eventos', d: 'Nombre, asistentes y platillos.' },
      { t: 'Cocina carga insumos y cantidades', q: 'Chef Mau', d: 'Una receta temporal que no ensucia la carta.' },
      { t: 'Compras recibe la lista de insumos', q: 'Estef' },
      { t: 'Al cerrar: costo real contra lo cobrado', q: 'Sistema' },
      { t: 'Se guarda como plantilla', q: 'Eventos', d: 'Si se repite, se considera para la carta.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión: corporativo',
      lineas: [],
      cuenta: [
        ['Cobrado por persona', '$1,600'],
        ['Costo por persona', '≈ $300'],
        ['Margen por persona', '≈ $1,300'],
      ],
    },
    reglas: [
      'Menú especial ligado al evento, con receta temporal y lista de compras.',
      'Reporte de menús especiales: veces pedido, costo y margen.',
    ],
    decidir: [
      { p: '¿Quién autoriza un menú especial y sus sustituciones?', quien: 'Dirección' },
      { p: 'Costo objetivo por persona.', quien: 'Dirección y Chef Mau' },
    ],
    prueba: [
      'Un menú especial para 30 personas genera la lista de compras y, al cerrar, muestra su margen.',
    ],
  },

  // ─────────────────────────────── EVENTOS ──────────────────────────────
  // Sale de las sesiones con ventas y coordinación de eventos y del reporte de
  // Eventos (puntos 14–22 y 32–50). Los puntos que decían lo mismo se unieron
  // en un solo flujo (ver VERIFICACION).
  {
    id: 'prospecto-reserva',
    num: 'F13',
    area: 'eventos',
    titulo: 'Del primer contacto a la reserva',
    para: 'Que cada evento nazca con su tipo, su vendedor y su origen desde el primer contacto, y no solo cuando llega el anticipo.',
    puntos: ['32', '33', '50'],
    hoy: [
      { t: 'El cliente llega por varios canales', q: 'Ventas', d: 'CRM, WhatsApp, teléfono o en persona.' },
      { t: 'El seguimiento se lleva en Excel', q: 'Ventas' },
      { t: 'El evento entra al sistema con el primer pago', q: 'Ventas' },
      { t: 'El tipo de evento se distingue por colores y notas', q: 'Ventas', d: 'Cumpleaños, escolar, corporativo y marketing se mezclan.' },
      { t: 'Si un vendedor descansa, otro lo captura', q: 'Ventas', d: 'Y la venta queda a nombre de quien la capturó.' },
    ],
    dolor: [
      'No se sabe cuántos contactos se pierden ni por qué.',
      'No se pueden separar las ventas por tipo de evento: cada uno tiene paquetes y precios distintos.',
      'Las ventas de los vendedores se revuelven.',
    ],
    queda: [
      { t: 'Se registra el contacto', q: 'Ventas', d: 'Canal, campaña o influencer que lo trajo, y vendedor.' },
      { t: 'Se clasifica desde el inicio', q: 'Ventas', d: 'Tipo: cumpleaños, escolar, corporativo o marketing; empresa o escuela.' },
      { t: 'Se arma y se envía la cotización', q: 'Ventas', d: 'Con el paquete de su tipo (flujo F14).' },
      { t: 'Seguimiento hasta aceptado o perdido', q: 'Ventas', d: 'Si se pierde, con su motivo.' },
      { t: 'Con el anticipo se convierte en reserva', q: 'Ventas', d: 'Conserva la conversación, las fechas y el vendedor.' },
      { t: 'El vendedor se puede reasignar', q: 'Coordinación', d: 'Cuando un compañero lo cubre, la venta queda a nombre de quien la cerró.' },
    ],
    reglas: [
      'Catálogo de tipos de evento: cumpleaños, escolar, corporativo, marketing.',
      'Canal de origen y vendedor obligatorios en cada evento.',
      'Motivo de pérdida al cerrar una cotización sin venta.',
    ],
    decidir: [
      { p: 'Catálogo oficial de tipos de evento y de canales de origen.', quien: 'Ventas y Dirección' },
      { p: '¿Quién puede reasignar el vendedor de un evento?', quien: 'Coordinación' },
    ],
    prueba: [
      'Un contacto de WhatsApp pasa a cotización y luego a reserva sin volver a capturarlo.',
      'El reporte separa ventas por tipo de evento y por vendedor.',
    ],
  },
  {
    id: 'paquetes',
    num: 'F14',
    area: 'eventos',
    titulo: 'Paquetes por tipo de evento',
    para: 'Que cada tipo de evento tenga sus propios paquetes, con lo que incluyen por persona, para que el precio salga solo y el inventario se descuente bien.',
    puntos: ['17', '34', '35', '37', '46', 'N13'],
    hoy: [
      { t: 'Los paquetes escolares y corporativos se mezclan', q: 'Ventas', d: 'En taquilla no se sabe qué precio aplica a una escuela.' },
      { t: 'El paquete escolar se arma a mano', q: 'Taquilla', d: 'Se cobró el acceso y aparte «hamburguesa $110» y «calcetas $70».' },
      { t: 'El acceso y la comida se capturan igual', q: 'Ventas', d: 'Como si ambos fueran artículos.' },
      { t: 'Lo que no está en catálogo se cobra con un botón global', q: 'Ventas', d: 'Barra de hidratación, coffee break, toast de aguacate: el precio va en notas y no toca el inventario.' },
      { t: 'Los regalos de la fiesta no están en el paquete', q: 'Operación', d: 'Peluche, chamarra, velita: se toma lo que haya y se le avisa a Compras por escrito.' },
      { t: 'Los adicionales van en notas o en «cobro extra»', q: 'Ventas', d: 'DJ, karaoke, decoración, globos, pastel, montajes.' },
    ],
    dolor: [
      'Taquilla cobra precios manuales y los cortes no cuadran con el evento.',
      'No se separa lo que es servicio (acceso, atracciones) de lo que es producto (comida, calcetas).',
      'Una barra de hidratación de $15,000 con 10 Powerade no descuenta los Powerade.',
      'Grupos de 10 personas se cobran como el mínimo de 50, pero eso solo queda en notas.',
    ],
    queda: [
      { t: 'Paquetes separados por tipo', q: 'Dirección', d: 'Taquilla solo ve los precios escolares en un evento escolar.' },
      { t: 'El acceso se registra como servicio', q: 'Sistema', d: 'Y la comida y las calcetas como productos, cada uno con su precio y su descuento.' },
      { t: 'Cada paquete dice qué incluye por persona', q: 'Dirección', d: 'Y se multiplica por los asistentes: 1 pizza completa para 4 niños.' },
      { t: 'Opciones de comida acotadas', q: 'Ventas', d: 'Máximo dos opciones por grupo, por cantidad: 40 hamburguesas y 40 de otra opción.' },
      { t: 'Calcetas sin talla en el paquete', q: 'Taquilla', d: 'La talla se elige al entregar (F23).' },
      { t: 'El regalo del festejado es parte del paquete', q: 'Dirección', d: 'Peluche, chamarra o velita: se descuenta al entregar.' },
      { t: 'Adicionales de catálogo', q: 'Ventas', d: 'DJ, karaoke, decoración, globos, pastel: con precio, costo y responsable.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión: paquete escolar (grupo de 50 a 100)',
      lineas: ['Acceso a todas las actividades, más el paquete de alimentos opcional. Hoy se ofrece refresco en lugar de jugo.'],
      cuenta: [
        ['Acceso por persona', '$449'],
        ['Hamburguesa con papas y refresco', '$110'],
        ['Calcetas', '$70'],
        ['Paquete de alimentos (opcional)', '$180'],
        ['Total por persona con alimentos', '$629'],
      ],
      nota: 'Si la escuela no quiere alimentos, solo se cobran las calcetas ($70) además del acceso. Corporativo: taquiza (alambre de arrachera y de pollo), refresco, agua y agua mineral, rally y coffee break premium.',
    },
    reglas: [
      'Paquetes por tipo de evento (cumpleaños, escolar, corporativo) con escalas por número de personas.',
      'Acceso y atracciones como servicio; alimentos y calcetas como producto.',
      'Componentes por persona con multiplicador por asistentes (pasteles, pizzas, bebidas).',
      'Catálogo de adicionales con precio, costo, proveedor y si consume inventario.',
    ],
    decidir: [
      { p: 'Tabla de precios vigente y contenido de cada paquete por tipo.', quien: 'Dirección' },
      { p: 'Tabla de porciones por número de personas (pasteles de vainilla y chocolate, pizzas).', quien: 'Chef Mau y Eventos' },
      { p: '¿Qué adicionales son servicios externos y cuáles consumen inventario?', quien: 'Ventas' },
      { p: 'Regla del mínimo de 50 personas: ¿se mantiene o se crea un paquete chico?', quien: 'Dirección' },
    ],
    prueba: [
      'Un evento escolar de 80 personas sale a $449 por persona sin capturar precios a mano.',
      'Con alimentos, descuenta hamburguesas, papas y refrescos; las calcetas, al entregarlas.',
      'Una barra de hidratación se vende desde el catálogo y descuenta sus Powerade.',
    ],
  },
  {
    id: 'reglamento-confirmacion',
    num: 'F15',
    area: 'eventos',
    titulo: 'Liga del evento: reglamento, permisos, confirmación y cambios',
    para: 'Que el cliente acepte por escrito lo que contrató, las reglas y las penalizaciones, y que cada cambio quede registrado.',
    puntos: ['15', '16', '44', '45', 'N5', 'N6'],
    dir: 'Propuso que el cliente confirme lo que va a pedir 24 horas antes: «si no me confirmas, no te puedo garantizar la hora de tu comida».',
    hoy: [
      { t: 'Se acuerda por teléfono y WhatsApp', q: 'Ventas', d: 'El reglamento se manda en PDF.' },
      { t: 'Los permisos se dan de palabra', q: 'Ventas', d: 'Meter regalos, adornos o decoración propia, a veces con cobro extra.' },
      { t: 'Hay un plazo, pero no se cumple', q: 'Ventas', d: 'Horario y alimentos máximo 3 días antes; el cliente cambia el mismo día.' },
      { t: 'El cliente dice que nunca lo vio', q: 'Cliente', d: '«No lo leí», «nunca me avisaste», aunque esté en la conversación.' },
      { t: 'Escuelas y empresas ya firman', q: 'Ventas', d: 'Con la cotización en PDF firmada no hay cambios el día del evento. En fiestas no se hace.' },
    ],
    dolor: [
      'Las penalizaciones se dicen (cambio de fecha: 10 %) pero no hay nada firmado para cobrarlas.',
      'Un cambio de último minuto se puede olvidar entre tantos eventos y descuadra cocina e inventario.',
      'No se sabe cuánto se ha cobrado en penalizaciones.',
      'Para cambiar de paquete hay que cancelar y crear el evento de nuevo.',
    ],
    queda: [
      { t: 'Al registrar el evento se genera su liga', q: 'Sistema', d: 'Un portal del cliente con todo lo de su fiesta.' },
      { t: 'La liga muestra el resumen', q: 'Sistema', d: 'Fecha, invitados, espacio, menú, hora de comida, extras, precio, pagos y lista de invitados.' },
      { t: 'Muestra el reglamento y los permisos de su evento', q: 'Ventas', d: 'Lo que no se puede hacer y, si se permite, cuánto cuesta (por evento o por persona).' },
      { t: 'El cliente acepta y firma', q: 'Cliente', d: 'Queda registrado quién aceptó y cuándo.' },
      { t: 'Cierre de cambios 3 días antes', q: 'Sistema', d: 'Después del corte, todo cambio queda registrado con hora y lo que ya se había preparado; si aplica, con penalización.' },
      { t: 'Cambio de paquete sin cancelar', q: 'Ventas', d: 'Se conservan los pagos; si cocina ya compró, aplica penalización.' },
      { t: 'Coordinación ve la conversación con el cliente', q: 'Coordinación', d: 'Para reiterarle lo acordado y ver si confirma.' },
    ],
    ejemplo: {
      titulo: 'Ejemplos de la sesión',
      lineas: [
        'Permiso para meter adornos de Halloween: se cobró un adicional, capturado como «cobro extra» en texto.',
        'Un día antes: «ya no son diez niños, son cinco».',
        'Cambio de paquete con contrato de $64,000 y $50,000 pagados: hoy obliga a cancelar y crear de nuevo.',
      ],
      cuenta: [
        ['Contrato', '$64,000'],
        ['Pagado', '$50,000'],
        ['Pendiente', '$14,000'],
      ],
      nota: 'Con el cambio sin cancelar, los $50,000 se conservan y solo se recalcula el pendiente.',
    },
    reglas: [
      'Liga por evento con resumen, reglamento, permisos, firma y versión.',
      'Permisos como conceptos con precio, no como texto.',
      'Penalizaciones configurables (por ejemplo, cambio de fecha 10 %) y reporte de lo cobrado.',
      'Corte de cambios configurable (3 días antes) y registro de todo cambio posterior.',
    ],
    decidir: [
      { p: 'Reglamento, permisos, montos de penalización y excepciones para fiestas: hay que revisarlo con la Dirección, porque el formato firmado ya se había propuesto y no avanzó.', quien: 'Dirección' },
      { p: '¿Qué tipo de firma o aceptación se usa?', quien: 'Dirección y Sacs' },
      { p: '¿Quién puede autorizar un cambio después del corte?', quien: 'Coordinación' },
      { p: 'Corte de cambios a 3 días y confirmación final 24 horas antes, como propuso la Dirección: ¿quedan las dos?', quien: 'Dirección y Ventas' },
    ],
    prueba: [
      'El cliente abre la liga, ve su resumen y el reglamento, y lo acepta; queda registrado.',
      'Un cambio después del corte aparece con hora, quién lo pidió y la penalización.',
      'Un cambio de paquete conserva los pagos.',
    ],
  },
  {
    id: 'invitados-acceso',
    num: 'F16',
    area: 'eventos',
    titulo: 'Lista de invitados, acceso y capacidad',
    para: 'Que la entrada se valide contra una lista del sistema y que lo que se agrega en la puerta se cobre dentro del evento.',
    puntos: ['38', '39', '40', '43'],
    hoy: [
      { t: 'El cliente manda la lista', q: 'Cliente', d: 'Por WhatsApp, impresa o de memoria.' },
      { t: 'En la entrada se valida en una hoja', q: 'Anfitriones', d: 'Se tacha a mano y se anota «+3», «+2», «+5» al margen.' },
      { t: 'Llegan personas que no estaban', q: 'Cliente', d: '«Es mi sobrino, lo encontré y lo traje».' },
      { t: 'Adultos y niños no se distinguen bien', q: 'Ventas', d: 'Se cuenta a un adulto como niño si va a usar atracciones.' },
      { t: 'Las escuelas mandan listas de 150 o 200', q: 'Ventas', d: 'En PDF o foto; se capturan a mano.' },
    ],
    dolor: [
      'Sin lista hay desorden en la entrada y se cuelan personas.',
      'Los «+3» del papel no siempre se cobran.',
      'No se sabe cuántos usaron atracciones ni el aforo real.',
      'Un grupo puede crecer más de lo que cabe en su espacio.',
    ],
    queda: [
      { t: 'La lista se llena en la liga del evento', q: 'Cliente', d: 'A más tardar 3 días antes.' },
      { t: 'Cada invitado lleva su tipo', q: 'Cliente', d: 'Adulto o menor, con o sin atracciones.' },
      { t: 'Escuelas: se sube el archivo', q: 'Ventas', d: 'El sistema lee la lista, marca duplicados y alguien la revisa antes del acceso.' },
      { t: 'En la entrada se palomea en tableta', q: 'Anfitriones', d: 'Llegó o no llegó.' },
      { t: 'Los extras se cobran dentro del evento', q: 'Taquilla', d: 'Quien no estaba en la lista se agrega y se cobra al evento.' },
      { t: 'Aforo por espacio', q: 'Sistema', d: 'Si el grupo rebasa la capacidad del área, avisa: cambio de área o tarifa por ampliación.' },
    ],
    reglas: [
      'Lista de invitados por evento con tipo de asistente.',
      'Importación de listas con revisión humana.',
      'Capacidad por espacio (VIP y salones) y bloqueo de sobreventa.',
      'Previstos contra presentes contra extras cobrados al cerrar.',
    ],
    decidir: [
      { p: 'Rangos de edad y tarifa de cada tipo de asistente.', quien: 'Dirección' },
      { p: '¿Quién palomea en la entrada y en cuántas tabletas?', quien: 'Coordinación' },
      { p: 'Capacidad oficial de cada espacio y política si llegan más.', quien: 'Dirección' },
    ],
    prueba: [
      'Una lista escolar en foto se convierte en lista revisada en el sistema.',
      'En la entrada se palomea; un invitado extra se cobra dentro del evento.',
      'Un grupo que rebasa su espacio da aviso.',
    ],
  },
  {
    id: 'pagos-evento',
    num: 'F17',
    area: 'eventos',
    titulo: 'Pagos, anticipos y comprobantes del evento',
    para: 'Que cada pago quede con su comprobante, y que los anticipos de eventos futuros se vean separados de la venta del mes.',
    puntos: ['N7', 'N10'],
    hoy: [
      { t: 'El cliente manda la foto del comprobante', q: 'Cliente', d: 'Por WhatsApp.' },
      { t: 'El comprobante no se guarda en el sistema', q: 'Ventas' },
      { t: 'Los pagos grandes esperan a Administración', q: 'Ventas', d: 'Se pide que confirmen el ingreso y luego se registra.' },
      { t: 'Ventas reporta sus abonos del día por mensaje', q: 'Ventas', d: '«Mil pesos de tal fiesta». Operación lo cuadra a mano contra el sistema.' },
      { t: 'El reporte de eventos solo da totales', q: 'Sistema', d: 'Sin decir si fue tarjeta, efectivo o transferencia.' },
    ],
    dolor: [
      'Un cliente dijo que depositó $2,000 y en realidad fueron $1,000; no había cómo demostrarlo a la mano.',
      'Un anticipo de octubre para una fiesta de noviembre se suma a la venta de octubre; el Excel de Ventas solo cuenta las fiestas del mes, y las cifras nunca coinciden.',
      '«Vendí $13,000 en transferencia, ¿dónde están?»: hay que entrar evento por evento.',
    ],
    queda: [
      { t: 'Se registra el pago en el evento', q: 'Ventas', d: 'Monto, banco, referencia y la imagen del comprobante.' },
      { t: 'Administración lo confirma', q: 'Administración', d: 'Cuando el dinero ya está en la cuenta.' },
      { t: 'El cliente lo ve en su liga', q: 'Sistema', d: 'Pagado, pendiente y cada comprobante.' },
      { t: 'Reporte de anticipos', q: 'Sistema', d: 'Abonado, por cobrar y el mes del evento al que pertenece, separado de la venta del mes.' },
      { t: 'Desglose por forma de pago', q: 'Sistema', d: 'En el corte y en el reporte de eventos: efectivo, tarjeta y transferencia.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión',
      lineas: ['«Yo deposité $2,000». Con el pago registrado: BBVA, referencia y la imagen. El comprobante dice $1,000.'],
    },
    reglas: [
      'Pago con monto, banco, referencia y archivo adjunto.',
      'Estado del pago: registrado o confirmado por Administración.',
      'Anticipos agrupados por mes del evento.',
    ],
    decidir: [
      { p: '¿A partir de qué monto se espera la confirmación de Administración?', quien: 'Norma' },
    ],
    prueba: [
      'Registro un pago con su comprobante y el cliente lo ve en su liga.',
      'El reporte del mes separa la venta de fiestas del mes de los anticipos de meses siguientes.',
      'Los abonos del día salen por forma de pago sin entrar a cada evento.',
    ],
  },
  {
    id: 'evento-produccion',
    num: 'F18',
    area: 'eventos',
    titulo: 'Del evento a cocina: horarios, extras y entregas',
    para: 'Que cocina sepa qué preparar, para cuándo y para quién, sin notas ni grupos de WhatsApp, y que todo lo que sale se registre.',
    puntos: ['19', '20', '21', '48', '49', '30'],
    dir: 'Para cocina propuso una pantalla aparte para eventos, junto a la del restaurante. Hoy el chef valida lo de eventos pidiendo los tickets y haciendo su propio corte.',
    hoy: [
      { t: 'El horario de comida va en las notas', q: 'Ventas', d: '«A las 3 de la tarde sus alimentos, 40 niños», y también en un grupo de WhatsApp.' },
      { t: 'Hay un Excel de horarios', q: 'Coordinación', d: 'Para no empalmar cinco fiestas a la 1 de la tarde.' },
      { t: 'Al crear la reserva se aparta el inventario', q: 'Sistema', d: 'Aunque el evento sea en diciembre y se venda en octubre.' },
      { t: 'Los extras se piden de palabra o en papel', q: 'Coordinador', d: 'Y antes se anotaban como nota: «10 hamburguesas» no descontaba.' },
      { t: 'Cualquiera puede mover el evento', q: '—', d: 'No queda quién cambió qué.' },
    ],
    dolor: [
      'Un evento que no se cierra deja inventario apartado que no existe (por ejemplo, 500 hamburguesas) y frena las compras.',
      'En una revisión salieron unas 30 cubetas de cerveza de eventos sin descontar.',
      '«Eventos no me avisó»: nadie sabe quién cambió hamburguesas por pizza.',
    ],
    queda: [
      { t: 'La hora de comida se elige al reservar', q: 'Ventas', d: 'Y el calendario muestra las horas ya ocupadas para no empalmar.' },
      { t: 'El inventario se aparta pocos días antes', q: 'Sistema', d: 'No desde que se vende (F23).' },
      { t: 'Antes de la hora, la comanda llega a cocina', q: 'Sistema', d: 'Arriba, en color de eventos, con nombre del evento, hora y responsable; o en una pantalla aparte solo para eventos.' },
      { t: 'Los extras se capturan en la tableta', q: 'Coordinador', d: 'Como productos, nunca como nota; llegan a cocina y se suman a la cuenta.' },
      { t: 'Cocina marca lo entregado por artículo', q: 'Chef Mau', d: 'Pendiente, preparado, entregado (F4).' },
      { t: 'El canje se confirma una sola vez', q: 'Coordinador', d: 'Hoy pide confirmar en dos pantallas.' },
      { t: 'Cada cambio deja rastro', q: 'Sistema', d: 'Quién, cuándo, por qué y quién lo autorizó: «Pedrito agregó 5 Coca-Cola».' },
    ],
    reglas: [
      'Hora de comida obligatoria en la reserva y visible en el calendario.',
      'Extras siempre como productos en el evento.',
      'Permisos: ventas y coordinación agregan o cambian; los anfitriones solo con autorización; cocina entrega.',
    ],
    decidir: [
      { p: 'Matriz de permisos: quién agrega, cambia, entrega o cancela.', quien: 'Coordinación' },
      { p: 'Responsables de las tabletas de canje (con suplentes para días de descanso).', quien: 'Coordinación' },
      { p: '¿Cuánto antes de la hora llega la comanda a cocina?', quien: 'Chef Mau y Coordinación' },
    ],
    prueba: [
      'Al reservar, el calendario no deja empalmar otra comida a la misma hora sin aviso.',
      'Dos extras capturados en la tableta llegan a cocina, se descuentan y suman a la cuenta.',
      'El historial muestra quién hizo cada cambio.',
    ],
  },
  {
    id: 'cortesias-marketing',
    num: 'F19',
    area: 'eventos',
    titulo: 'Cortesías, marketing e influencers',
    para: 'Registrar lo que se regala como cortesía, con su costo y quién lo autorizó, y cobrar solo lo que se consuma de más.',
    puntos: ['41'],
    hoy: [
      { t: 'Marketing ofrece beneficios a influencers', q: 'Marketing', d: 'Entrada del influencer, cinco niños más y dos adultos de regalo.' },
      { t: 'Se registra como evento de marketing', q: 'Ventas' },
      { t: 'El sistema lo muestra como pendiente de cobro', q: 'Sistema', d: 'Y al final hay que aplicar un descuento por el total.' },
      { t: 'Pasteles o cupcakes de cortesía sin registro', q: 'Cocina' },
    ],
    dolor: [
      'La Dirección preguntó por qué un evento decía $19,900 sin cobrar, cuando era cortesía.',
      'Lo regalado no se ve como costo de marketing.',
    ],
    queda: [
      { t: 'Evento de tipo marketing o cortesía', q: 'Ventas', d: 'Con beneficiarios y lo que incluye (6 entradas, 2 adultos, pastel).' },
      { t: 'Autorizado por quien corresponda', q: 'Marketing' },
      { t: 'No aparece como pendiente de cobro', q: 'Sistema', d: 'Su costo se registra como costo de marketing.' },
      { t: 'Lo que se consuma de más se cobra', q: 'Coordinación', d: 'Al agotarse la cortesía, operación lo ve bloqueado.' },
    ],
    reglas: [
      'Tipo de evento marketing o cortesía, separado de los descuentos y las devoluciones.',
      'Costo absorbido por evento y autorizador.',
    ],
    decidir: [
      { p: 'Paquetes reales para influencers y quién los autoriza.', quien: 'Marketing y Dirección' },
    ],
    prueba: [
      'Un evento de influencer no aparece como saldo por cobrar y su costo sale en el reporte de marketing.',
      'Un adicional fuera de la cortesía sí se cobra.',
    ],
  },
  {
    id: 'cierre-evento',
    num: 'F20',
    area: 'eventos',
    titulo: 'Cierre y rentabilidad por evento',
    para: 'Ver en una sola ficha lo que se vendió, lo que se entregó y lo que costó cada evento.',
    puntos: ['22', '47', '03'],
    hoy: [
      { t: 'El ingreso del paquete se ve en ventas', q: 'Sistema' },
      { t: 'Las salidas de cocina no se reflejan igual', q: 'Cocina' },
      { t: 'Taquilla, cocina y contabilidad no se cruzan', q: '—' },
    ],
    dolor: [
      'No se sabe si un evento dejó margen.',
      'Los faltantes de eventos acaban como faltantes de cocina (F7).',
    ],
    queda: [
      { t: 'Ficha del evento', q: 'Sistema', d: 'Vendido, extras, invitados previstos y presentes, cortesías.' },
      { t: 'Consumo', q: 'Sistema', d: 'Comprometido, preparado, entregado y mermas del evento.' },
      { t: 'Costo real y margen', q: 'Sistema' },
      { t: 'Diferencias a revisar', q: 'Coordinación', d: 'Lo cobrado contra lo entregado.' },
    ],
    reglas: [
      'Reporte por evento y tablero por tipo de evento.',
    ],
    decidir: [
      { p: 'Elegir un evento real para cuadrarlo contra taquilla, cocina y contabilidad.', quien: 'Coordinación y Sacs' },
    ],
    prueba: [
      'El evento de prueba muestra vendido, entregado, costo y margen, y cuadra con taquilla.',
    ],
  },
  // ──────────────────────── OPERACIÓN Y PUNTO DE VENTA ────────────────────────
  // Sale de la sesión con taquilla y cajas (sesión 07) y del reporte de
  // Operación/POS. Ese reporte numera sus puntos 01–13; aquí van como
  // POS-01…POS-13 para no confundirlos con los puntos 01–13 del primer reporte.
  {
    id: 'combos-accesos',
    num: 'F21',
    area: 'operacion',
    titulo: 'Accesos y combos en taquilla',
    para: 'Que cada acceso y cada combo diga lo que de verdad incluye, para que se descuente lo entregado y los reportes digan cuánta gente entró y cuánto se vendió de cada cosa.',
    puntos: ['POS-01', 'POS-02', '37', '38', 'N12', 'N21', 'N22'],
    dir: 'Explicó por qué los accesos traen calcetas: la página de venta en línea, propia y con Stripe, necesitaba la entrada ligada a las calcetas para ofrecerlas; fue un parche. Propuso repartir el descuento del combo entre sus componentes y confirmó que el aforo no cuadra: un sábado con 418 ventas, el reporte de visitas daba 258 personas.',
    hoy: [
      { t: 'Taquilla cobra el acceso por persona', q: 'Taquilla', d: '$599 con atracciones, $199 si solo acompaña; calcetas antiderrapantes $70 si no trae.' },
      { t: 'El acceso de acompañante trae calcetas configuradas', q: 'Taquilla', d: 'Se le da «omitir paso» para no entregarlas.' },
      { t: 'Los combos se venden como un solo artículo', q: 'Taquilla', d: 'Por ejemplo, el combo Artik: accesos para 4, 4 calcetas, palomitas y 4 aguas.' },
      { t: 'Cocina entrega viendo el ticket', q: 'Cocina', d: 'Y lo marca a mano.' },
      { t: 'Para saber el aforo se multiplica a mano', q: 'Operación', d: 'Combos vendidos × 4.' },
    ],
    dolor: [
      'Los combos no descuentan la comida ni las calcetas que incluyen.',
      'El reporte de ventas solo dice «combo»: no dice cuánto fue de accesos, de calcetas o de comida, que es lo que pide la Dirección.',
      'El aforo no es confiable porque el combo no trae sus accesos.',
      'El acceso con restaurante (refresco, hamburguesa, hot dog) tampoco descuenta nada; sus dos versiones solo se distinguen por el nombre.',
      'Los accesos y varios productos no tienen costo capturado: no hay margen.',
    ],
    queda: [
      { t: 'El acceso es un servicio', q: 'Dirección', d: 'Dos tipos: con atracciones y acompañante. Sin calcetas adentro.' },
      { t: 'Las calcetas son un complemento', q: 'Taquilla', d: 'Se agregan solo si la persona no trae.' },
      { t: 'El acompañante puede pasar a jugar', q: 'Taquilla', d: 'Paga solo la diferencia.' },
      { t: 'Cada combo lleva sus componentes', q: 'Dirección', d: 'Accesos por persona, calcetas, palomitas, aguas: cada uno se descuenta.' },
      { t: 'El reporte desglosa el combo', q: 'Sistema', d: 'Combos vendidos → accesos, calcetas, alimentos y personas que entraron.' },
      { t: 'Cada acceso y producto tiene su costo', q: 'Administración', d: 'Para ver el margen.' },
      { t: 'El descuento del combo se reparte', q: 'Sistema', d: 'Si el combo sale 20 % más barato, cada componente se registra 20 % abajo: acceso, comida y calcetas.' },
      { t: 'La venta en línea deja de necesitar el parche', q: 'Sacs', d: 'La página ofrece las calcetas como opción sin que el acceso las traiga adentro.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión: combo Artik y accesos',
      lineas: ['Con los componentes bien armados, vender un combo descuenta y cuenta solo.'],
      cuenta: [
        ['Combo Artik ×1 · accesos con atracciones', '4 personas'],
        ['Calcetas (talla al entregar)', '4'],
        ['Palomitas · aguas', '1 · 4'],
        ['Acceso con atracciones + calcetas', '$599 + $70 = $669'],
        ['Acompañante que decide jugar', '$599 − $199 = $400'],
      ],
      nota: 'La Dirección pidió saber quién usa los juegos y quién no; por ahora no importa si es adulto o niño.',
    },
    reglas: [
      'Acceso como servicio, sin componentes físicos.',
      'Combos como paquetes con componentes que descuentan inventario.',
      'Reporte de productos finales separado del reporte de insumos.',
      'Costo capturado en cada acceso y producto.',
    ],
    decidir: [
      { p: '¿Qué combos son paquetes con componentes y cuáles solo un precio comercial?', quien: 'Dirección' },
      { p: 'Costo de cada acceso.', quien: 'Administración' },
      { p: '¿Producto distinto para la venta en línea y para taquilla, o el mismo con las calcetas como opción?', quien: 'Dirección y Sacs' },
    ],
    prueba: [
      'Vendo un combo Artik: se descuentan 4 calcetas, palomitas y 4 aguas, y el aforo sube 4.',
      'Vendo un acceso de acompañante: no pide calcetas.',
      'El reporte del mes dice cuánto fue de accesos, de calcetas y de comida.',
    ],
  },
  {
    id: 'venta-en-linea',
    num: 'F22',
    area: 'operacion',
    titulo: 'Venta en línea: del QR al cierre del pedido',
    para: 'Que una compra en línea se use una sola vez, que cada área marque lo que entregó y que el pedido se cierre y descuente el inventario.',
    puntos: ['POS-04', 'POS-05', 'POS-06', 'POS-07'],
    hoy: [
      { t: 'El cliente llega con su QR', q: 'Cliente' },
      { t: 'Taquilla lo escanea y se abre el pedido', q: 'Taquilla', d: 'Antes había que buscarlo entre cientos.' },
      { t: 'Se imprime el ticket y se entregan calcetas', q: 'Taquilla', d: 'El ticket de pedido en línea ya no sale solo: hay que imprimirlo a mano.' },
      { t: 'No hay un paso de «usado»', q: '—', d: 'El pedido queda abierto y el QR sirve otra vez.' },
      { t: 'Cocina entrega viendo el ticket', q: 'Cocina', d: 'El ticket se puede reimprimir las veces que sea.' },
    ],
    dolor: [
      'Con el mismo QR alguien podría volver otro día con otra familia.',
      'Los pedidos en línea nunca se cierran: el inventario no se descuenta y queda apartado.',
      'La talla de calcetas no se conoce al comprar en línea, y el ticket no la trae.',
      'El cliente ve sus pagos en su liga, pero no lo que ya usó.',
    ],
    queda: [
      { t: 'Compra en línea', q: 'Cliente', d: 'El pedido y su QR traen el detalle del combo.' },
      { t: 'En taquilla se escanea y se valida', q: 'Taquilla', d: 'Que esté vigente y que no se haya usado.' },
      { t: 'La pantalla desglosa el pedido', q: 'Taquilla', d: 'Accesos, calcetas (aquí se elige la talla) y alimentos pendientes.' },
      { t: 'Cada área marca lo que entrega', q: 'Taquilla y cocina', d: 'Con el mismo código; lo que falte queda pendiente.' },
      { t: 'Al terminar se cierra el pedido', q: 'Sistema', d: 'Y se descuenta el inventario real.' },
      { t: 'Queda en la caja y el cajero que lo atendió', q: 'Sistema', d: 'Listo para el corte y la auditoría.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión',
      lineas: ['Combo Artik comprado en línea: en taquilla se entregan las 4 calcetas (con su talla) y se usan los accesos; en cocina, con el mismo código, se piden 2 aguas ahora y 2 después.'],
    },
    reglas: [
      'Estado del pedido: vigente, en uso, cerrado.',
      'Bitácora de reimpresiones y aviso visual si el pedido ya se usó.',
      'Entrega por componente con saldo pendiente visible para el cliente y para operación.',
    ],
    decidir: [
      { p: '¿Quién puede reimprimir un ticket y cuándo procede reponerlo?', quien: 'Operación' },
      { p: '¿El canje en cocina es con el QR del cliente, con un talón con código de barras o con ambos?', quien: 'Operación y Chef Mau' },
    ],
    prueba: [
      'Escaneo un pedido en línea, entrego todo y se cierra; si lo escaneo otra vez dice «ya usado».',
      'Entrego 2 de 4 aguas y el pedido muestra 2 pendientes.',
      'El ticket del pedido en línea se imprime solo.',
    ],
  },
  {
    id: 'apartados-calcetas',
    num: 'F23',
    area: 'operacion',
    titulo: 'Apartados de inventario y calcetas',
    para: 'Que el inventario se aparte solo cuando de verdad se va a entregar, para que no aparezca «no hay» cuando sí hay en la bodega.',
    puntos: ['POS-03', '14', '42'],
    dir: 'Sacs le señaló los apartados como uno de los errores principales: le quitan disponible al inventario y descuadran las compras.',
    hoy: [
      { t: 'Cada evento aparta su inventario desde que se crea', q: 'Sistema', d: 'Aunque la fiesta sea meses después.' },
      { t: 'Las calcetas se apartan por talla y por evento', q: 'Sistema', d: 'Por ejemplo, 20 de cada talla aunque no se usen.' },
      { t: 'Las ventas en línea abiertas también apartan', q: 'Sistema', d: 'Por ejemplo, 192 palomitas apartadas.' },
      { t: 'El paquete lleva calcetas fijas por persona', q: 'Ventas', d: 'Si un niño trae las suyas, se capturan 13 en lugar de 14.' },
      { t: 'Compras hace auditoría y ajusta', q: 'Estef', d: 'Un día se reportó un faltante de 9,000 calcetas.' },
    ],
    dolor: [
      'Al vender un combo el sistema dice que no hay calcetas, cuando sí hay.',
      'Hubo reservas que no se podían hacer por falta de calcetas, y se pidió quitar el candado.',
      'El ajuste de inventario corrige el número, pero el error vuelve a aparecer.',
    ],
    queda: [
      { t: 'Tres números por producto', q: 'Sistema', d: 'Total (lo que hay), apartado y disponible para vender.' },
      { t: 'Los eventos apartan pocos días antes', q: 'Sistema', d: 'Con el reporte semanal de eventos (F10).' },
      { t: 'El paquete pide «calcetas», sin talla', q: 'Ventas', d: 'No se aparta ninguna talla al reservar.' },
      { t: 'La talla se elige al entregar', q: 'Taquilla', d: 'Y solo se descuentan las que se dieron, por talla.' },
      { t: 'Los pedidos en línea se cierran al canjear', q: 'Sistema', d: 'Y liberan lo que tenían apartado (F22).' },
      { t: 'Se limpian los apartados viejos', q: 'Estef', d: 'Una sola vez, al arrancar.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión: calcetas',
      lineas: [],
      cuenta: [
        ['Total en bodega', '12,000'],
        ['Apartadas por eventos', '3,000'],
        ['Disponibles para vender', '9,000'],
      ],
      nota: 'Las 3,000 apartadas no existen como compromiso real: son tallas reservadas por eventos que todavía no llegan.',
    },
    reglas: [
      'Apartado de inventario solo dentro de los días previos acordados.',
      'Calcetas por producto padre en el paquete; talla y cantidad al entregar.',
      'Reporte de apartados con su origen (evento o pedido en línea).',
    ],
    decidir: [
      { p: '¿Cuántos días antes del evento se aparta el inventario?', quien: 'Chef Mau y Ventas' },
      { p: '¿Quién revisa y limpia los apartados que ya no aplican?', quien: 'Estef' },
    ],
    prueba: [
      'Un evento de diciembre no aparta calcetas en noviembre.',
      'Entrego 13 calcetas en un evento de 14 personas y se descuentan 13, por talla.',
      'El disponible de calcetas coincide con lo que hay en bodega.',
    ],
  },
  {
    id: 'cajas-usuarios',
    num: 'F24',
    area: 'operacion',
    titulo: 'Cajas: catálogo, usuario y cambio de cajero',
    para: 'Que cada caja venda solo lo suyo, que cada venta quede a nombre de quien la cobró y que cambiar de cajero no obligue a cerrar la caja.',
    puntos: ['POS-08', 'POS-09', 'POS-10'],
    hoy: [
      { t: 'Todas las cajas ven todos los productos', q: 'Cajas', d: 'Accesos, restaurante, souvenirs.' },
      { t: 'Los usuarios abren cajas por área', q: 'Cajas', d: 'Pero un usuario abierto en otra caja puede cobrar ahí.' },
      { t: 'Si el cajero sale a comer, otro cobra con su sesión', q: 'Cajas' },
    ],
    dolor: [
      'Un cobro de paletas, helados y chocolates de otra área se registró en la caja de cocina: a una le faltaron $500 y a la otra le sobraron. La persona tuvo que pagarlo.',
      'No queda claro quién cobró qué cuando dos personas usan la misma caja.',
    ],
    queda: [
      { t: 'Catálogo por caja', q: 'Administración', d: 'Taquilla: accesos y souvenirs. Restaurante: alimentos. Cada caja ve solo lo suyo.' },
      { t: 'Cada usuario asignado a su estación', q: 'Administración', d: 'Si abre otra caja, no puede cobrar.' },
      { t: 'Una persona, una caja abierta', q: 'Sistema', d: 'Aviso de «tienes una sesión abierta».' },
      { t: 'Cambio de cajero con PIN o tarjeta', q: 'Cajas', d: 'Sin cerrar la caja; cada venta queda a nombre de quien la cobró.' },
      { t: 'Si un área necesita algo de otra', q: 'Cajas', d: 'Transferencia rápida de inventario.' },
    ],
    reglas: [
      'Catálogos (carpetas) por caja.',
      'Permisos por puesto: vender, consultar, cancelar y reimprimir.',
      'PIN o tarjeta de vendedor.',
    ],
    decidir: [
      { p: 'Perfiles reales de taquilla, kiosco, parque y restaurante.', quien: 'Operación' },
      { p: 'PIN o tarjeta, y cómo se resguarda.', quien: 'Operación' },
    ],
    prueba: [
      'En la caja de restaurante no aparecen accesos.',
      'Cambio de cajero con PIN y el corte separa las ventas de cada uno.',
      'Un usuario no puede tener dos cajas abiertas.',
    ],
  },
  {
    id: 'arqueos-retiros',
    num: 'F25',
    area: 'operacion',
    titulo: 'Arqueos, cortes y retiros de efectivo',
    para: 'Revisar la caja durante el día, sacar el efectivo que se acumula con registro y firma, y cerrar con un corte que cuadre.',
    puntos: ['POS-11', 'POS-12', 'POS-13', 'N28'],
    hoy: [
      { t: 'El efectivo se acumula en las cajas', q: 'Cajas', d: 'Sobre todo en fines de semana.' },
      { t: 'Se retira cuando hay mucho', q: 'Supervisor', d: '$10,000 o $20,000; antes no se registraba como movimiento.' },
      { t: 'Todo se cuenta al final del día', q: 'Cajas', d: 'Por eso el cierre se hace tarde.' },
      { t: 'Los gastos de caja chica van por fuera', q: 'Cajas', d: 'Bolsas, jabón: no se registran en Sacs.' },
      { t: 'Las propinas no se registran aparte', q: 'Cajas', d: 'El sistema ya puede hacerlo, pero no se usa; si se cobran con tarjeta, se mezclan con la venta.' },
    ],
    dolor: [
      'Si al final falta dinero, no se sabe en qué momento del día se perdió.',
      'Un retiro que no se registró parece faltante en el corte.',
      'Había miedo de hacer arqueos porque se pensaba que reiniciaban la caja: no lo hacen.',
    ],
    queda: [
      { t: 'Arqueos durante el día', q: 'Supervisor', d: 'Por ejemplo, a las 2 y a las 6 de la tarde, o antes de que el cajero salga a comer. Son informativos: no cierran nada.' },
      { t: 'Retiro de efectivo registrado', q: 'Supervisor', d: 'Parcial o total, monto, a dónde va (bóveda, caja chica, banco), quién lo pidió y quién lo recibió.' },
      { t: 'Firma y comprobante físico', q: 'Supervisor', d: 'El papel firmado y el registro en el sistema.' },
      { t: 'Corte final por denominaciones', q: 'Cajas', d: 'Se capturan billetes y monedas; puede ser corte ciego. Se define el fondo que se queda.' },
      { t: 'Corte por cajero', q: 'Sistema', d: 'Si hubo varios en la misma caja.' },
      { t: 'Gastos de caja chica en el sistema', q: 'Cajas', d: 'Con su concepto y comprobante.' },
      { t: 'Propinas separadas de la venta', q: 'Cajas', d: 'Monto o porcentaje al cobrar; reporte para entregarlas cada semana o quincena.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión',
      lineas: ['Se propone que una caja no pase de $30,000 en efectivo; al llegar, se retira con registro y firma.', 'Arqueo a las 2 de la tarde: bien. A las 6: faltan $500. El error está entre las 2 y las 6.'],
    },
    reglas: [
      'Tipos de movimiento de caja: retiro parcial, retiro total, depósito, gasto de caja chica.',
      'Destinos: bóveda, caja chica, banco (se pueden agregar).',
      'Corte por denominaciones, fondo fijo y, si se decide, corte ciego.',
    ],
    decidir: [
      { p: 'Tope de efectivo por caja (se propuso $30,000).', quien: 'Dirección' },
      { p: 'Fondo de caja, corte ciego o validado.', quien: 'Dirección y Norma' },
      { p: 'Quién autoriza y quién recibe los retiros; formato de firma.', quien: 'Dirección' },
    ],
    prueba: [
      'Hago un retiro de $20,000 con firma: el corte ya no los cuenta como faltante.',
      'Un arqueo a media tarde no cierra la caja.',
      'El corte por denominaciones cuadra con el sistema.',
    ],
  },
  {
    id: 'responsiva',
    num: 'F26',
    area: 'operacion',
    titulo: 'Responsiva digital de acceso',
    para: 'Que cada visitante firme su responsiva una vez, quede guardada con vigencia y se encuentre en segundos en taquilla.',
    puntos: ['N11'],
    hoy: [
      { t: 'La responsiva se llena en un formulario con QR', q: 'Cliente' },
      { t: 'Antes llegaba a una plataforma con nombre y firma', q: '—', d: 'Ahora va a un formulario externo.' },
      { t: 'Se firma en cada visita', q: 'Cliente', d: 'Diez visitas, diez firmas.' },
    ],
    dolor: [
      'Las responsivas no viven en Sacs ni se ligan a la venta.',
      'No se puede buscar a un visitante frecuente.',
    ],
    queda: [
      { t: 'Se firma una vez en el sistema', q: 'Cliente', d: 'Nombre, acompañantes, correo, teléfono y firma.' },
      { t: 'Taquilla la busca', q: 'Taquilla', d: 'Por nombre y fecha de nacimiento.' },
      { t: 'Tiene vigencia', q: 'Sistema', d: 'Aviso cuando está por vencer: «tu registro vence en 5 días, ¿lo renuevas?».' },
    ],
    reglas: [
      'Responsiva ligada al cliente, con vigencia.',
    ],
    decidir: [
      { p: 'Vigencia de la responsiva y su texto legal.', quien: 'Dirección' },
    ],
    prueba: [
      'Un visitante que firmó hace un mes se encuentra por nombre y no vuelve a firmar.',
    ],
  },
  // ──────────────────────── DIRECCIÓN Y FINANZAS ────────────────────────
  // Sale de la sesión con la Dirección y Administración (sesión 08). No hay
  // reporte PDF de esta área: todo lo de aquí son puntos nuevos.
  {
    id: 'cuentas-por-pagar',
    num: 'F27',
    area: 'direccion',
    titulo: 'Cuentas por pagar con autorización',
    para: 'Que ningún gasto se pague ni se borre sin que la Dirección lo autorice, y que se pueda decidir cuándo pagarlo.',
    puntos: ['N15'],
    dir: 'Pidió un paso de autorización: Administración registra el gasto, la Dirección lo aprueba y decide la fecha, y hasta entonces se paga. «A lo mejor está aprobado, pero no quiero que lo pagues hoy, sino en un mes y medio.» Nada se elimina sin avisar.',
    hoy: [
      { t: 'Administración registra el gasto', q: 'Norma', d: 'Por ejemplo, renta: monto, pago y confirmar.' },
      { t: 'La autorización llega por WhatsApp o correo', q: 'Dirección', d: 'Administración manda el reporte y luego otra persona entra a bancos y paga.' },
      { t: 'También lo puede eliminar', q: 'Norma', d: 'Sin que nadie lo revise.' },
      { t: 'A veces un pago junta conceptos distintos', q: 'Norma', d: 'Renta y mantenimiento en el mismo pago.' },
    ],
    dolor: [
      'No hay autorización antes de pagar.',
      'Un gasto eliminado puede ser uno que sí se debía, o uno que solo había que reprogramar.',
      'Si se juntan conceptos, después no se sabe cuánto fue de cada uno.',
    ],
    queda: [
      { t: 'Se registra la cuenta por pagar, por factura', q: 'Norma', d: 'Cada concepto con su factura.' },
      { t: 'La Dirección la revisa', q: 'Dirección', d: 'Aprueba, rechaza o reprograma la fecha, con una nota («negócialo», «págalo el 30»).' },
      { t: 'Se programa el pago', q: 'Sistema', d: 'Con su fecha y su monto, completo o en partes (F9).' },
      { t: 'Se paga', q: 'Norma', d: 'Con el comprobante adjunto. Un solo pago puede cubrir varias facturas del mismo proveedor, y un reembolso de caja chica, varias facturas.' },
      { t: 'Ocultar o eliminar, con autorización', q: 'Dirección', d: 'Se oculta lo que ya no se usa; se elimina solo lo que fue un error.' },
    ],
    ejemplo: {
      titulo: 'Ejemplos de la sesión',
      lineas: [
        'Renta y mantenimiento: conceptos distintos, cada uno con su factura, aunque se paguen el mismo día.',
        'FEMSA: un solo pago que amarra dos facturas, ambas de bebidas.',
      ],
    },
    reglas: [
      'Flujo: registrar → autorizar → programar → pagar.',
      'Cuenta por pagar por factura y por concepto.',
      'Eliminar u ocultar solo con autorización.',
    ],
    decidir: [
      { p: '¿Todo gasto pasa por autorización o solo a partir de cierto monto?', quien: 'Dirección' },
      { p: '¿Quién más puede autorizar cuando la Dirección no está?', quien: 'Dirección' },
    ],
    prueba: [
      'Registro un gasto y no se puede pagar hasta que la Dirección lo aprueba.',
      'La Dirección lo reprograma y aparece en la fecha nueva.',
      'Intento eliminar un gasto y pide autorización.',
    ],
  },
  {
    id: 'proveedores',
    num: 'F28',
    area: 'direccion',
    titulo: 'Proveedores: crédito, tiempo de entrega y catálogo',
    para: 'Que cada proveedor tenga sus días de crédito y su tiempo de entrega reales, y sus productos separados por sabor o talla, para comprar a tiempo y saber qué se vende.',
    puntos: ['N16', 'N17'],
    dir: 'Revisó proveedor por proveedor: hay proveedores en «contado» que en realidad dan 7 días (el sistema los marcaría como atrasados), tiempos de entrega que no son los reales, y productos que se compran como uno solo aunque tengan varios sabores. Pidió revisarlos con Compras y Administración.',
    hoy: [
      { t: 'Hay proveedores en «contado» que dan crédito', q: 'Norma', d: 'Por ejemplo, 7 días.' },
      { t: 'El tiempo de entrega no es el real', q: 'Estef', d: 'Las calcetas tardan hasta 3 semanas y se llegaron a acabar.' },
      { t: 'Hay productos con varios sabores como uno solo', q: 'Estef', d: 'Un proveedor de congelados: un producto con 7 sabores.' },
      { t: 'Los proveedores no tienen categoría', q: 'Norma', d: 'No se sabe cuáles son de alimentos.' },
    ],
    dolor: [
      'El sistema avisaría de pagos atrasados que no lo están.',
      'El sugerido de compra no llega a tiempo si no conoce la entrega real.',
      'No se sabe qué sabor o qué talla se vende y cuál no: se pide de todo y sobra XS.',
    ],
    queda: [
      { t: 'Días de crédito reales', q: 'Norma', d: 'Contado, 7, 15 o 30 días.' },
      { t: 'Tiempo de entrega máximo', q: 'Estef', d: 'Si tarda de 7 a 10 días, se pone 10.' },
      { t: 'Productos por sabor y por talla', q: 'Estef', d: 'Para ver qué se vende y pedir solo eso.' },
      { t: 'Categoría del proveedor', q: 'Norma', d: 'Costo o gasto, partida y concepto (F31).' },
      { t: 'Historial por proveedor', q: 'Sistema', d: 'Lo que se le ha comprado y su saldo (F8).' },
    ],
    reglas: [
      'Días de crédito y tiempo de entrega por proveedor.',
      'Variantes por sabor y talla.',
      'Categoría contable por proveedor.',
    ],
    decidir: [
      { p: 'Revisar proveedor por proveedor: crédito, entrega, productos y categoría.', quien: 'Estef y Norma' },
    ],
    prueba: [
      'Un proveedor a 7 días no aparece como atrasado al día 3.',
      'El reporte muestra cuántas calcetas se vendieron de cada talla.',
    ],
  },
  {
    id: 'reportes-ejecutivos',
    num: 'F29',
    area: 'direccion',
    titulo: 'Reportes ejecutivos por modelo de negocio',
    para: 'Que la Dirección vea en un tablero cómo va cada negocio (parque, restaurante, eventos, souvenirs) y un estado de resultados con costo y gasto separados.',
    puntos: ['N19', 'N27', 'N29'],
    dir: 'Quiere que funcione el reporte ejecutivo: un estado de resultados que separe el costo (alimentos, bebidas) del gasto. Hoy no sirve porque los datos de origen están mal. Se deja para el final, cuando los flujos anteriores ya registren bien.',
    hoy: [
      { t: 'El reporte ejecutivo existe, pero no sirve', q: 'Dirección', d: 'Los datos que lo alimentan están mal cargados.' },
      { t: 'No separa costo de gasto', q: 'Sistema' },
      { t: 'No dice qué incluye cada número', q: 'Sistema', d: '¿Los visitantes incluyen los de fiestas y escuelas?' },
      { t: 'Para saber algo hay que abrir varios reportes', q: 'Dirección' },
    ],
    dolor: [
      'No hay un estado de resultados confiable.',
      'Los reportes de eventos solo dicen «vendiste tanto».',
      'Lo que se come en eventos cuenta como evento, no como alimentos: la Dirección ve que se compró mucho de alimentos y se vendió poco.',
      'Las comisiones de ventas se pagan sobre el total del evento, incluidos los alimentos, que son costo.',
      'No se ve qué producto ya no conviene comprar ni qué paquete se vende más.',
    ],
    queda: [
      { t: 'Estado de resultados', q: 'Sistema', d: 'Costo (alimentos, bebidas) separado de gasto, por la categoría del proveedor (F28).' },
      { t: 'Tablero por modelo de negocio', q: 'Sistema', d: 'Parque: accesos y aforo. Restaurante: insumos y margen. Eventos: ventas, saldos, anticipos y vendedores. Souvenirs.' },
      { t: 'Ventas por categoría y subcategoría', q: 'Sistema', d: 'Alimentos → hamburguesas, alitas…; dulces → cada dulce; atracciones → cada paquete. Así se ve qué dejar de comprar.' },
      { t: 'Eventos separados en atracciones y alimentos', q: 'Sistema', d: 'Lo que se come en un evento suma a alimentos.' },
      { t: 'Comisiones de ventas por tipo', q: 'Dirección', d: 'Sobre atracciones o sobre utilidad, no sobre el costo de los alimentos.' },
      { t: 'Cada dato dice qué incluye', q: 'Sistema' },
      { t: 'Se arma al final', q: 'Sacs', d: 'Cuando combos, apartados, eventos y compras ya registren bien.' },
    ],
    reglas: [
      'Categoría contable en proveedores y gastos.',
      'Tablero por modelo de negocio, con definición de cada indicador.',
    ],
    decidir: [
      { p: '¿Qué indicadores quiere ver la Dirección de cada negocio?', quien: 'Dirección' },
      { p: 'Reglas contables para clasificar costo y gasto (F31).', quien: 'Norma y Contabilidad' },
      { p: '¿Sobre qué se calcula la comisión de los vendedores de eventos?', quien: 'Dirección' },
    ],
    prueba: [
      'El estado de resultados del mes separa costo y gasto, y cuadra con lo registrado.',
      'El tablero de eventos muestra ventas, saldos y anticipos sin abrir otro reporte.',
    ],
  },
  {
    id: 'recursos-humanos',
    num: 'F30',
    area: 'direccion',
    titulo: 'Recursos humanos: checador y expedientes',
    para: 'Registrar entradas y salidas del personal y tener el expediente de cada colaborador en el sistema.',
    puntos: ['N20'],
    dir: 'La prioridad es terminar esta etapa en dos o tres semanas; el módulo completo de recursos humanos va después. Administración pidió avanzar ya con el registro de entradas y salidas. Sacs envía la cotización y la presentación del módulo.',
    hoy: [
      { t: 'No hay checador', q: '—' },
      { t: 'Las altas y bajas se revisan a mano', q: 'Norma', d: 'Contra el IMSS.' },
    ],
    dolor: [
      'No hay registro de quién llegó temprano o tarde.',
      'Los expedientes no están en un solo lugar.',
    ],
    queda: [
      { t: 'Expediente por colaborador', q: 'Norma', d: 'Puesto, salario, tipo (eventual o de planta).' },
      { t: 'Checador de entradas y salidas', q: 'Colaboradores', d: 'Con reconocimiento facial, PIN o huella; puede ser desde su teléfono, limitado a la red del parque.' },
      { t: 'Vacaciones, permisos y actas', q: 'Norma' },
      { t: 'Se conecta con el descuento de colaboradores', q: 'Sistema', d: 'F6.' },
    ],
    reglas: [
      'Expediente por colaborador y método de checado.',
      'Jornadas de lunes a domingo con roles según los eventos; tolerancia de 10 a 15 minutos.',
      'Tiempo extra con validación antes de pagarse; también permisos y vacaciones.',
      'Prima dominical para quien trabaja en fin de semana y apoyo de transporte.',
      'Actas administrativas y contratos subidos al expediente.',
    ],
    decidir: [
      { p: '¿Se implementa ya el checador o al terminar esta etapa?', quien: 'Dirección' },
      { p: 'Método de checado: reconocimiento facial, PIN, huella o teléfono.', quien: 'Norma' },
      { p: '¿El sistema timbra la nómina? Sacs lo confirma.', quien: 'Sacs' },
    ],
    prueba: [
      'Un colaborador checa entrada y salida, y aparece en su expediente.',
    ],
  },
  // ──────────────────────── ADMINISTRACIÓN Y CONTABILIDAD ────────────────────────
  // Sale de la sesión con Administración y Contabilidad (sesión 09). Solo los
  // temas de trabajo; lo personal y los datos del personal se omiten.
  {
    id: 'catalogo-gastos',
    num: 'F31',
    area: 'administracion',
    titulo: 'Catálogo de gastos: partida, concepto y centro de costos',
    para: 'Que cada peso que sale quede clasificado desde que se registra, para que el estado de resultados salga solo y el contador pueda usarlo sin rehacerlo.',
    puntos: ['N18', 'N24'],
    hoy: [
      { t: 'Los gastos entran al sistema sin concepto', q: 'Norma', d: 'Se registran para que cuadre el saldo, no para analizarlos.' },
      { t: 'La clasificación vive en Excel', q: 'Norma', d: 'Partida, concepto y proveedor, mes por mes, con un tablero propio.' },
      { t: 'El contador arma el flujo por su lado', q: 'Contabilidad', d: 'Ingresos, costos y gastos con base en lo pagado y lo cobrado.' },
      { t: 'La tarjeta de crédito se registra como un solo pago', q: 'Norma', d: 'Aunque adentro haya publicidad en redes y otras compras.' },
    ],
    dolor: [
      'Lo que se baja del sistema no le sirve al contador: hay que volver a clasificarlo.',
      'No se distingue costo de venta de gasto, ni gasto fijo de variable.',
      'Un pago de crédito mezcla capital (no es gasto) con intereses (sí lo es).',
    ],
    queda: [
      { t: 'Cada proveedor nace clasificado', q: 'Norma', d: 'Costo o gasto, partida y concepto: al registrarle un pago, se clasifica solo.' },
      { t: 'Partidas', q: 'Contabilidad', d: 'Costo de venta · gastos de venta · administración · operación · gastos bancarios y financieros · créditos · devoluciones · ingresos y aportaciones.' },
      { t: 'Conceptos dentro de cada partida', q: 'Contabilidad', d: 'Alimentos, bebidas, calcetas, nómina, IMSS, comisiones, publicidad, limpieza, mantenimiento, servicios…' },
      { t: 'Fijo o variable', q: 'Norma', d: 'Fijos: renta, luz, agua, servicios. Variables: los que se mueven con la operación (apoyos de fin de semana, limpieza, pasajes).' },
      { t: 'Centro de costos', q: 'Norma', d: 'A qué área pertenece el gasto.' },
      { t: 'Los pagos se reparten', q: 'Norma', d: 'Tarjeta de crédito por concepto; pago de crédito en capital e intereses.' },
    ],
    ejemplo: {
      titulo: 'Ejemplos de la sesión: dónde va cada cosa',
      lineas: [
        'Costo de venta: alimentos, bebidas, calcetas, frozen, ice, nachos, palomitas. Afectan directo a lo que se vende.',
        'Gasto de venta: brazaletes, stickers, desechables, publicidad, reembolsos del gerente. Se usan para vender, pero no son parte del producto.',
        'Administración: nóminas, apoyos, aguinaldo, finiquitos, nómina extraordinaria de cursos de verano, impuestos.',
        'Operación: limpieza, fumigación, mantenimiento, protección civil, servicios, equipo de cocina.',
      ],
    },
    reglas: [
      'Catálogo de partidas y conceptos, igual al que usa el contador.',
      'Proveedor con clasificación por defecto; el gasto la hereda.',
      'Campo de fijo o variable y de centro de costos.',
    ],
    decidir: [
      { p: 'Catálogo final de partidas y conceptos (Administración lo depura con el contador).', quien: 'Norma y Contabilidad' },
      { p: 'Centros de costos que se van a usar.', quien: 'Norma' },
    ],
    prueba: [
      'Registro un pago a un proveedor de alimentos y queda como costo de venta, concepto alimentos, sin capturarlo.',
      'El reporte del mes se baja ya clasificado y el contador no lo rehace.',
    ],
  },
  {
    id: 'bancos-boveda',
    num: 'F32',
    area: 'administracion',
    titulo: 'Bancos, bóveda y caja chica que cuadran',
    para: 'Que lo vendido llegue completo a su cuenta (bóveda, banco, Stripe), que las comisiones queden separadas y que el saldo del sistema sea el real.',
    puntos: ['N9', 'N30'],
    hoy: [
      { t: 'Lo vendido en efectivo no llega completo a la bóveda', q: 'Sistema', d: 'Hay eventos sin cerrar y cortes que no se hacen.' },
      { t: 'Las ventas de Stripe caen días después', q: 'Banco', d: 'Entre 5 y 7 días; el tablero las muestra el mismo día.' },
      { t: 'El banco deposita completo y cobra la comisión aparte', q: 'Banco', d: 'Crédito más alta que débito. Stripe deposita ya sin comisión.' },
      { t: 'La caja chica del gerente se repone cada semana', q: 'Norma', d: 'Un solo gasto con varias facturas.' },
      { t: 'Administración cuadra todo en Excel', q: 'Norma', d: 'Día por día, contra el estado de cuenta.' },
    ],
    dolor: [
      'El sistema dice que no hay dinero para registrar pagos, y en el banco sí lo hay.',
      'La caja chica tiene movimientos que nadie registró.',
      'La Dirección ve la venta de hoy en el tablero y espera el depósito mañana.',
      'Corregirlo a mano con ajustes no resuelve nada: el error vuelve al día siguiente.',
    ],
    queda: [
      { t: 'Cada corte cierra y deposita en su cuenta', q: 'Cajas', d: 'Efectivo a bóveda; tarjeta a banco; en línea a «Stripe por depositar» (F25).' },
      { t: 'Los eventos se cierran', q: 'Coordinación', d: 'Para que su dinero también llegue (F20).' },
      { t: 'Stripe con fecha de depósito', q: 'Sistema', d: 'Lo vendido queda «por depositar» hasta que cae al banco.' },
      { t: 'Comisión por medio de pago', q: 'Norma', d: 'Banco: crédito y débito con su porcentaje. Stripe: neto. Van a gastos bancarios.' },
      { t: 'Caja chica con sus gastos', q: 'Gerente', d: 'Cada reposición con sus facturas.' },
      { t: 'Conciliación con el estado de cuenta', q: 'Norma', d: 'El saldo del sistema contra el del banco; la diferencia se investiga, no se ajusta.' },
      { t: 'Arranque limpio', q: 'Sacs', d: 'Cuando los flujos anteriores registren bien, se parte de saldos reales.' },
    ],
    ejemplo: {
      titulo: 'Ejemplos de la sesión',
      lineas: ['Lo vendido en efectivo contra lo que llegó a la bóveda:'],
      cuenta: [
        ['10 de octubre', '$190,000 vendidos · $75,000 en bóveda'],
        ['11 de octubre', '$88,000 vendidos · $69,000 en bóveda'],
        ['Caja chica', '$25,000 sin ningún gasto registrado'],
      ],
      nota: 'Las cifras son las que se mostraron en la sesión; se van a cuadrar con Administración.',
    },
    reglas: [
      'Cuentas: bóveda, caja chica, bancos y Stripe por depositar.',
      'Comisión por medio de pago y por banco.',
      'Ningún ajuste manual para cuadrar: se corrige el origen.',
    ],
    decidir: [
      { p: '¿A partir de qué fecha se arranca con saldos limpios?', quien: 'Norma y Sacs' },
      { p: 'Porcentajes de comisión de cada banco y de Stripe.', quien: 'Norma' },
    ],
    prueba: [
      'El corte del día llega completo a la bóveda.',
      'Una venta de Stripe aparece «por depositar» y se concilia cuando cae.',
      'El saldo del sistema coincide con el estado de cuenta.',
    ],
  },
  {
    id: 'facturacion-iva',
    num: 'F33',
    area: 'administracion',
    titulo: 'Facturación e IVA correctos',
    para: 'Que toda factura salga con el IVA correcto, sin que nadie tenga que corregirla, y que el cliente pueda facturar solo.',
    puntos: ['N14', 'N31'],
    hoy: [
      { t: 'Hay productos con IVA en 0 % o exentos', q: 'Sistema', d: 'Por ejemplo, pastas; deberían ir al 16 %.' },
      { t: 'Los extras de eventos se capturan a mano', q: 'Ventas', d: 'Y a veces sin IVA.' },
      { t: 'Contabilidad encuentra la diferencia al declarar', q: 'Contabilidad', d: 'Y hay que cancelar y volver a facturar.' },
      { t: 'Las facturas se le piden a una sola persona', q: 'Administración', d: 'Tardan alrededor de semana y media; el kiosco de autofacturación no se usa.' },
    ],
    dolor: [
      'Diferencias de IVA en todo el año, mes por mes.',
      'Facturas canceladas y rehechas.',
    ],
    queda: [
      { t: 'Regla general: todo al 16 %', q: 'Sacs', d: 'El restaurante compra insumos sin IVA, pero vende todo con IVA.' },
      { t: 'Revisión del catálogo', q: 'Sacs', d: 'Ningún producto en 0 % o exento por error.' },
      { t: 'Extras de eventos desde el catálogo', q: 'Ventas', d: 'Ya traen su IVA (F14).' },
      { t: 'Kiosco de autofacturación', q: 'Cliente', d: 'En caja o en línea.' },
    ],
    ejemplo: {
      titulo: 'Ejemplos de la sesión',
      lineas: [],
      cuenta: [
        ['Factura de evento por $52,555', 'IVA sobre $35,598 en lugar de $46,860'],
        ['Factura de evento por $40,700', 'IVA de $2,515 cuando debía ser de alrededor de $5,000'],
        ['Factura de restaurante por $576', 'IVA sobre $420 en lugar de $549'],
      ],
    },
    reglas: [
      'IVA al 16 % por defecto en productos y extras.',
      'Aviso si un producto se da de alta sin IVA.',
    ],
    decidir: [
      { p: '¿Hay algún producto que de verdad vaya sin IVA?', quien: 'Contabilidad' },
    ],
    prueba: [
      'Facturo un evento con extras y el IVA sale sobre el total.',
      'Un cliente factura solo desde el kiosco.',
    ],
  },
  {
    id: 'costeo-productos',
    num: 'F34',
    area: 'administracion',
    titulo: 'Costeo de productos y paquetes',
    para: 'Que cada producto y cada paquete tenga su costo real, con todo lo que lleva, para fijar precios y medir la utilidad.',
    puntos: ['N26'],
    hoy: [
      { t: 'El costeo vive en hojas de cálculo', q: 'Norma', d: 'Producto por producto, con la materia prima actualizada a mano.' },
      { t: 'Varios productos no tienen costo en el sistema', q: 'Sistema', d: 'Los accesos, entre otros.' },
      { t: 'El refresco de lata se compra al mismo precio', q: 'Compras', d: 'Pero cada sabor se vende distinto.' },
    ],
    dolor: [
      'Sin costo en el sistema, los reportes no dicen cuánto se gana.',
      'Sin gramaje en el nombre, una revisión de Profeco puede multar.',
    ],
    queda: [
      { t: 'El costo incluye todo lo que lleva', q: 'Norma', d: 'Producto, empaque, vaso, tapa, popote, bolsita.' },
      { t: 'Porción contra presentación', q: 'Chef Mau', d: 'Papas: 200 g por orden de una bolsa de 1 kg → 5 órdenes.' },
      { t: 'Rendimiento esperado', q: 'Chef Mau', d: 'Ice: de cada bolsa de 9 kg salen al menos 200 vasos, hasta 230.' },
      { t: 'Paquetes costeados por persona', q: 'Norma', d: 'Lo compartido se divide entre los invitados.' },
      { t: 'Gramaje u onzas en el nombre', q: 'Norma', d: 'Dulcería, alimentos y café.' },
      { t: 'Cada sabor, su producto', q: 'Estef', d: 'Para saber qué se vende (F28).' },
    ],
    ejemplo: {
      titulo: 'Ejemplos de la sesión: paquete de fiesta por invitado',
      lineas: ['Mínimo 10 invitados.'],
      cuenta: [
        ['Pastel de $350', '÷ 11 (10 invitados y el festejado)'],
        ['Peluche de $160 (uno por fiesta)', '÷ 10 = $16 por invitado'],
        ['Piñata de $600', '÷ 10 = $60 por invitado'],
        ['Velita', '$15'],
        ['Ice de 24 oz (jarabe, vaso, tapa y popote)', '≈ $45 de costo'],
      ],
    },
    reglas: [
      'Costo por producto con sus componentes y empaques.',
      'Gramaje u onzas en el nombre del producto.',
      'Rendimiento por presentación.',
    ],
    decidir: [
      { p: 'Margen objetivo por categoría.', quien: 'Dirección y Norma' },
      { p: '¿Quién mantiene actualizado el precio de la materia prima?', quien: 'Estef' },
    ],
    prueba: [
      'Cambio el precio del pan y se actualiza el costo de las hamburguesas.',
      'El costo de un paquete de fiesta sale por invitado.',
    ],
  },
];

// Otras áreas: salieron en las conversaciones de cocina y compras, pero son
// de otra sesión. Se anotan para no perderlas.
// Las «otras áreas» que salieron antes (cortes y facturación) ya tienen su
// flujo en Administración (F32 y F33).
export const OTRAS: { num: string; titulo: string; puntos: string[]; hoy: string; propuesta: string[]; quien: string }[] = [];

// Verificación de los puntos de los reportes PDF contra las conversaciones.
// `u` = puntos que decían lo mismo y se unieron en un solo flujo.
export const VERIFICACION: { n: string; t: string; e: 'completo' | 'complementado'; c: string; f: string; u?: string }[] = [
  { n: '01', t: 'Conversión de unidades en recepción', e: 'complementado', c: 'Precio con impuestos y cuadre al centavo contra la factura; presentaciones por caja y bolsa (bollo: 225 piezas); quién recibe cuando el chef descansa.', f: 'F1' },
  { n: '02', t: 'Costeo y merma técnica en recetas', e: 'complementado', c: 'Ejemplos reales: jitomate 35 → 40 g y papa 140 g en crudo. Las porciones por asistentes pasan al paquete (F14).', f: 'F2' },
  { n: '03', t: 'Faltantes recurrentes en consumos de eventos', e: 'complementado', c: 'Causas encontradas: extras capturados como nota, cubetas de cerveza no descontadas, inventario apartado desde el día que se vende y combos de taquilla que no cuentan como venta de cocina.', f: 'F7 · F20' },
  { n: '04', t: 'Insumos de libre disposición en mesas', e: 'completo', c: 'Se agrega el método de dotación y conteo con ejemplo, y la lista completa (azúcar, mascabado, sustituto, jalapeños).', f: 'F3' },
  { n: '05', t: 'Control de mermas y pérdidas', e: 'complementado', c: 'Responsable por persona para medir, daño de proveedor detectado al acomodar, sobrantes por cambios o menos invitados y política de cobrar o absorber.', f: 'F5' },
  { n: '06', t: 'Fallos de visualización en KDS', e: 'completo', c: 'Frecuencia reportada (una o dos veces por semana); el pedido del cliente desde la mesa depende de resolver esto primero.', f: 'F4' },
  { n: '07', t: 'Validación de entrega de pedidos', e: 'completo', c: 'Hoy se hace en papel con firma de caja; un ticket entregado no debe poder entregarse otra vez.', f: 'F4 · F22', u: '21 · POS-07' },
  { n: '08', t: 'Compra y recepción como etapas independientes', e: 'complementado', c: 'Faltaba el pago anticipado: Artik siempre paga antes y Administración necesita liberar el pago sin esperar la recepción.', f: 'F8' },
  { n: '09', t: 'Entregas incompletas y diferencias por proveedor', e: 'complementado', c: 'Saldo a favor en la ficha del proveedor, aplicado en el siguiente pedido; acuerdos de pago en partes (calcetas).', f: 'F8 · F9' },
  { n: '10', t: 'Resurtido con base en ventas históricas', e: 'completo', c: 'Temporada alta en noviembre y diciembre; el Excel del chef se sustituye; las órdenes automáticas dependen de un inventario confiable.', f: 'F10' },
  { n: '11', t: 'Separar resurtido normal de eventos', e: 'completo', c: 'Revisión del lunes con dos columnas: eventos confirmados (Mau) y venta normal (Estef).', f: 'F10' },
  { n: '12', t: 'Compras imprevistas y eventos exprés', e: 'complementado', c: 'Magnitud real (hasta 800 hamburguesas, cajas de 72), Ventas autorizada a vender para el mismo día, validar con cocina y espacio antes de cerrar.', f: 'F11', u: '31 · 36' },
  { n: '13', t: 'Tablero de compras y recepción', e: 'completo', c: 'Se agregan las columnas de saldo a favor y abonos programados.', f: 'F8 · F9' },
  { n: '14', t: 'Reservas que afectan existencias antes de tiempo', e: 'complementado', c: 'Ejemplos: 500 hamburguesas y 3,000 calcetas apartadas que no se van a usar todavía. Se aparta con el reporte semanal de eventos.', f: 'F23 · F10', u: 'POS-03' },
  { n: '15', t: 'Confirmación previa de alimentos', e: 'complementado', c: 'Plazo de 3 días antes para horario y alimentos; el cliente lo acepta por escrito en la liga del evento; escuelas y empresas ya lo firman.', f: 'F15', u: '16 · 44 · 45' },
  { n: '16', t: 'Registro y responsabilidad por cambios tardíos', e: 'completo', c: 'Penalización mencionada: cambio de fecha 10 %. La política sigue por decidir con la Dirección.', f: 'F15', u: '15' },
  { n: '17', t: 'Paquetes y productos compuestos', e: 'complementado', c: 'Porciones por asistentes (1 pizza completa = 4 niños) y pasteles de vainilla y chocolate.', f: 'F14', u: '34 · 37 · 46' },
  { n: '18', t: 'Menús especiales de evento', e: 'completo', c: 'Dice lo mismo que el 29.', f: 'F12', u: '29' },
  { n: '19', t: 'Extras y productos adicionales', e: 'complementado', c: 'El coordinador los captura en tableta y llegan a cocina; caso de 30 cubetas de cerveza sin descontar.', f: 'F18' },
  { n: '20', t: 'Pedidos de eventos en KDS', e: 'completo', c: 'Dice lo mismo que el 30.', f: 'F4 · F18', u: '30' },
  { n: '21', t: 'Entregas parciales y evitar dobles surtidos', e: 'completo', c: 'Dice lo mismo que el 07.', f: 'F4 · F18', u: '07 · POS-07' },
  { n: '22', t: 'Conciliación de consumo y rentabilidad', e: 'completo', c: 'Dice lo mismo que el 47.', f: 'F20', u: '47' },
  { n: '29', t: 'Menús corporativos y especiales con costo por evento', e: 'complementado', c: 'Ejemplo real de margen ($1,600 cobrados contra ≈ $300 de costo por persona) y medir cuáles se repiten.', f: 'F12', u: '18' },
  { n: '30', t: 'KDS vinculado a evento y permisos por función', e: 'complementado', c: 'Color propio con estrella, nombre del evento y del responsable, hora de entrega y extras sumados a la cuenta.', f: 'F4 · F18', u: '20 · 49' },
  { n: '31', t: 'Insumos extraordinarios desde la confirmación comercial', e: 'completo', c: 'Se atiende con el aviso de evento exprés y el menú especial.', f: 'F11 · F12', u: '12' },
  { n: '32', t: 'Prospección y cotizaciones antes del primer anticipo', e: 'complementado', c: 'Se agrega reasignar el vendedor cuando un compañero lo cubre en su descanso.', f: 'F13', u: '33 · 50' },
  { n: '33', t: 'Clasificar eventos desde su registro', e: 'completo', c: 'Cumpleaños, escolar, corporativo y marketing, con su propio catálogo de paquetes.', f: 'F13' },
  { n: '34', t: 'Catálogo de paquetes corporativos parametrizados', e: 'complementado', c: 'Contenido real: taquiza (alambre de arrachera y de pollo), refresco, agua y agua mineral, rally y coffee break premium.', f: 'F14' },
  { n: '35', t: 'Adicionales comerciales como conceptos estructurados', e: 'complementado', c: 'Se suman los permisos con cobro (meter adornos o regalos propios).', f: 'F14 · F15' },
  { n: '36', t: 'Trazabilidad de eventos exprés', e: 'completo', c: 'Dice lo mismo que el 12.', f: 'F11', u: '12' },
  { n: '37', t: 'Separar accesos y atracciones de alimentos', e: 'complementado', c: 'Caso real: taquilla cobró el paquete escolar como «hamburguesa $110» y «calcetas $70» por separado.', f: 'F14 · F21', u: 'POS-02' },
  { n: '38', t: 'Asistentes por edad y uso real de atracciones', e: 'complementado', c: 'Hoy se cuenta a un adulto como niño si va a usar atracciones. La Dirección pidió saber quién juega y quién acompaña; la edad no importa por ahora.', f: 'F16 · F21' },
  { n: '39', t: 'Lista digital de invitados y check-in', e: 'complementado', c: 'La lista se llena en la liga del evento hasta 3 días antes; los «+3» de la hoja se cobran dentro del evento en taquilla.', f: 'F16', u: '38 · 40 · 43' },
  { n: '40', t: 'Carga masiva de grupos escolares', e: 'completo', c: 'Listas de 150 a 200 personas en PDF o foto.', f: 'F16' },
  { n: '41', t: 'Cortesías, acompañantes e influencers', e: 'complementado', c: 'Caso real: un evento de marketing aparecía con $19,900 sin cobrar; pastel de cortesía sin registro.', f: 'F19' },
  { n: '42', t: 'Calcetas por talla dentro de paquetes', e: 'complementado', c: 'El paquete pide «calcetas» sin talla; la talla se elige al entregar. Si un niño trae las suyas, solo se descuentan las que se dieron.', f: 'F23' },
  { n: '43', t: 'Capacidad, espacios VIP y límite de asistentes', e: 'completo', c: 'Aviso cuando el grupo rebasa el espacio contratado.', f: 'F16' },
  { n: '44', t: 'Reglamento, permisos y penalizaciones', e: 'complementado', c: 'Caso real: permiso para meter adornos de Halloween con cobro adicional; reporte de penalizaciones cobradas.', f: 'F15' },
  { n: '45', t: 'Confirmación digital y control de versiones', e: 'complementado', c: 'La misma liga muestra pagos, comprobantes y lista de invitados.', f: 'F15' },
  { n: '46', t: 'Paquetes escolares y alimentación opcional', e: 'complementado', c: 'Precios dichos: $449 de acceso (50 a 100 personas) y $180 de alimentos ($110 + $70 de calcetas).', f: 'F14' },
  { n: '47', t: 'Reporte integral de ingresos y consumos por evento', e: 'completo', c: 'Dice lo mismo que el 22.', f: 'F20', u: '22' },
  { n: '48', t: 'Autorización y auditoría de cambios operativos', e: 'complementado', c: 'Solo ventas y coordinación editan; anfitriones con autorización; responsables de tabletas con suplentes.', f: 'F18' },
  { n: '49', t: 'Programación de entregas y avisos a cocina', e: 'complementado', c: 'Hora de comida obligatoria en la reserva y calendario de horas ocupadas para no empalmar fiestas.', f: 'F18', u: '30' },
  { n: '50', t: 'Atribución comercial y conversión', e: 'completo', c: 'Canal, campaña o influencer y vendedor desde el primer contacto.', f: 'F13', u: '32' },
  // Reporte de Operación y punto de venta (sesión 07): numera 01–13; aquí POS-01…POS-13.
  { n: 'POS-01', t: 'Combos de acceso mal configurados', e: 'complementado', c: 'El combo Artik (accesos para 4, 4 calcetas, palomitas y 4 aguas) no descuenta comida ni calcetas; el reporte solo dice «combo» y el aforo se multiplica a mano. Tampoco descuenta el acceso con restaurante.', f: 'F21', u: 'POS-02' },
  { n: 'POS-02', t: 'Acceso general separado de calcetas y complementos', e: 'complementado', c: 'Precios dichos: $599 con atracciones, $199 acompañante y $70 las calcetas; hoy se usa «omitir paso» porque el acceso trae calcetas configuradas.', f: 'F21', u: 'POS-01 · 37' },
  { n: 'POS-03', t: 'Reservas bloqueadas por inventario asociado al combo', e: 'complementado', c: 'Cada evento aparta tallas de calcetas desde que se crea: 3,000 apartadas y solo 9,000 disponibles de 12,000.', f: 'F23', u: '14' },
  { n: 'POS-04', t: 'Ventas online sin cierre ni consumo efectivo', e: 'complementado', c: 'El QR solo abre el pedido; nada lo marca como usado y el pedido queda abierto. El ticket de pedido en línea ya no se imprime solo.', f: 'F22', u: 'POS-05 · POS-06 · POS-07' },
  { n: 'POS-05', t: 'Reimpresión y reutilización de tickets', e: 'completo', c: 'El ticket se reimprime sin límite y el QR se puede volver a usar.', f: 'F22', u: 'POS-04' },
  { n: 'POS-06', t: 'Ticket poco detallado para el canje', e: 'complementado', c: 'La talla de las calcetas no viene en el ticket; en línea no se conoce y se elige en taquilla.', f: 'F22', u: 'POS-04' },
  { n: 'POS-07', t: 'Entrega parcial y confirmación por componente', e: 'completo', c: 'Dice lo mismo que el 07 y el 21: se unen.', f: 'F22 · F4', u: '07 · 21' },
  { n: 'POS-08', t: 'Carpetas y catálogos por caja', e: 'complementado', c: 'Caso real: un cobro de otra área en la caja de cocina dejó $500 de faltante en una caja y sobrante en otra.', f: 'F24', u: 'POS-09' },
  { n: 'POS-09', t: 'Permisos por usuario y por área', e: 'completo', c: 'Un usuario abierto en otra caja no debe poder cobrar ahí.', f: 'F24', u: 'POS-08' },
  { n: 'POS-10', t: 'Cambio rápido de cajero con PIN o tarjeta', e: 'completo', c: 'Para cuando el cajero sale a comer y otro lo cubre.', f: 'F24' },
  { n: 'POS-11', t: 'Arqueos parciales y corte final por cajero', e: 'complementado', c: 'Arqueos a las 2 y a las 6 de la tarde para ubicar en qué momento se generó un faltante; el arqueo no reinicia la caja.', f: 'F25', u: 'POS-12 · POS-13' },
  { n: 'POS-12', t: 'Cortes por denominaciones y fondo fijo', e: 'completo', c: 'Corte ciego como opción.', f: 'F25' },
  { n: 'POS-13', t: 'Retiros y movimientos de caja', e: 'complementado', c: 'Retiros de $10,000 a $20,000 cuando se acumula; tope propuesto de $30,000 por caja; destino bóveda, caja chica o banco; los gastos de caja chica hoy van fuera de Sacs.', f: 'F25' },
];

// Puntos que salieron en las conversaciones y no estaban en ningún reporte.
export const NUEVOS = [
  { n: 'N1', t: 'Pago anticipado como saldo a favor con el proveedor', f: 'F8' },
  { n: 'N2', t: 'Acuerdos de pago en partes con abonos programados', f: 'F9' },
  { n: 'N3', t: 'Precio de la factura con impuestos incluidos en la recepción', f: 'F1' },
  { n: 'N4', t: 'Descuento de colaboradores como tipo de cliente', f: 'F6' },
  { n: 'N5', t: 'Cambio de paquete sin cancelar el evento', f: 'F15' },
  { n: 'N6', t: 'Coordinación ve la conversación con el cliente', f: 'F15' },
  { n: 'N7', t: 'Pagos del evento con comprobante y referencia', f: 'F17' },
  { n: 'N8', t: 'Cuadre de inventario de cocina por canal', f: 'F7' },
  { n: 'N9', t: 'Cortes que no llegan completos a las cuentas', f: 'F32' },
  { n: 'N10', t: 'Anticipos separados de la venta del mes y desglose por forma de pago', f: 'F17' },
  { n: 'N11', t: 'Responsiva digital con vigencia', f: 'F26' },
  { n: 'N12', t: 'Costo capturado en accesos y productos', f: 'F21' },
  { n: 'N13', t: 'Regalo del festejado y adicionales de eventos en el catálogo', f: 'F14' },
  { n: 'N14', t: 'Kiosco de autofacturación', f: 'F33' },
  { n: 'N15', t: 'Autorización de la Dirección antes de pagar o eliminar un gasto', f: 'F27' },
  { n: 'N16', t: 'Días de crédito y tiempo de entrega reales por proveedor', f: 'F28' },
  { n: 'N17', t: 'Productos por sabor y talla para medir qué se vende', f: 'F28' },
  { n: 'N18', t: 'Estado de resultados con costo y gasto separados', f: 'F31' },
  { n: 'N19', t: 'Tablero por modelo de negocio', f: 'F29' },
  { n: 'N20', t: 'Checador de entradas y salidas y expedientes', f: 'F30' },
  { n: 'N21', t: 'Descuento del combo repartido entre sus componentes', f: 'F21' },
  { n: 'N22', t: 'Calcetas como opción en la venta en línea, sin el parche', f: 'F21' },
  { n: 'N23', t: 'Recepción con la foto de la factura (AXO)', f: 'F1' },
  { n: 'N24', t: 'Gasto fijo o variable y centro de costos', f: 'F31' },
  { n: 'N25', t: 'Requisición y autorización antes de la orden de compra', f: 'F8' },
  { n: 'N26', t: 'Costo con empaques y gramaje en el nombre', f: 'F34' },
  { n: 'N27', t: 'Comisiones de ventas por tipo de venta', f: 'F29' },
  { n: 'N28', t: 'Propinas separadas de la venta', f: 'F25' },
  { n: 'N29', t: 'Ventas por categoría y subcategoría', f: 'F29' },
  { n: 'N30', t: 'Comisiones bancarias por medio de pago y Stripe por depositar', f: 'F32' },
  { n: 'N31', t: 'IVA correcto en productos y extras', f: 'F33' },
];

// Próximos pasos: solo lo que se dijo en las sesiones.
export const PASOS = [
  { q: 'Sacs', t: 'Se lleva los flujos para definir qué se ajusta en el sistema y la siguiente semana capacita por área con el nuevo proceso.' },
  { q: 'Eventos', t: 'Compartir el Drive con los Excel y PDF que se usan hoy (horarios, listas de invitados, cotizaciones), sin las pestañas del global.' },
  { q: 'Eventos', t: 'Mandar dudas y comentarios por el grupo de WhatsApp; ahí Sacs avisa lo que vaya quedando.' },
  { q: 'Compras', t: 'Reunir varias facturas reales de distintos proveedores para probar las reglas de conversión y de cuadre.' },
  { q: 'Cocina', t: 'Anotar dispositivo, hora y folio de la próxima comanda que no aparezca en la pantalla.' },
  { q: 'Administración', t: 'Mandar el catálogo de partidas y conceptos, depurado con el contador, y sus reportes actuales en Excel.' },
  { q: 'Sacs', t: 'Mandar la base de productos para corregir categorías, subcategorías, costos e IVA; revisar la regla general de IVA al 16 %.' },
  { q: 'Sacs', t: 'Capacitación con todo el personal operativo, no solo con los líderes, explicando por qué se hace cada paso.' },
  { q: 'Sacs', t: 'Capacitación de facturación y del kiosco de autofacturación con el equipo.' },
  { q: 'Sacs', t: 'Revisar con seguridad abrir el soporte directo para que cada área reporte sus fallas en el momento, sin pasar por una sola persona.' },
  { q: 'Sacs', t: 'Enviar los planes de AXO con la recomendación, y la cotización y presentación del módulo de recursos humanos.' },
  { q: 'Compras y Administración', t: 'Revisar con Sacs a cada proveedor: crédito, tiempo de entrega, productos por sabor o talla y categoría.' },
];

// ★ Lo que la Dirección marcó como forma de trabajo y como orden de prioridades.
export const DIRECCION = {
  principios: [
    'Los procesos se trabajan como queremos que queden, no como están hoy.',
    'Lo que pasa en la realidad se registra en ese momento: ni antes ni después.',
    'La prioridad es terminar esta etapa en dos o tres semanas. Recursos humanos y los módulos nuevos (pedido desde la mesa, tienda de souvenirs en línea) van después.',
  ],
};
