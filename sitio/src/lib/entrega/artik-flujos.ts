// Flujos de trabajo de ARTIK Snowpark · Cocina, Compras/resurtidos y Eventos (2-nov-2026).
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

export type Area = 'cocina' | 'compras' | 'eventos' | 'otras';

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
  puntos: string[];    // referencias a los PDF (01–13, 29–31) y nuevos (N1…)
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
  otras: { nombre: 'Otras áreas detectadas', quien: 'Cajas y administración', color: 'otras' },
};

export const FLUJOS: Flujo[] = [
  // ─────────────────────────────── COCINA ───────────────────────────────
  {
    id: 'recepcion-conversion',
    num: 'F1',
    area: 'cocina',
    titulo: 'Recepción de insumos con conversión de unidades',
    para: 'Recibir como viene del proveedor (galones, cajas, garrafones) y que el inventario quede en la unidad en que se usa (ml, g, piezas), con el costo correcto y cuadrado contra la factura.',
    puntos: ['01', '08', 'N3'],
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
      { t: 'Se captura tal como viene', q: 'Cocina', d: '12 galones, 1 caja, 2 garrafones: la presentación del proveedor.' },
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
      'Lista de consumibles por dotación: mayonesa, cátsup, chiles jalapeños, azúcar, mascabado, sustituto de azúcar y los que se agreguen.',
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
    puntos: ['08', '09', '13', 'N1'],
    hoy: [
      { t: 'Hasta hace tres semanas se hacía recepción directa', q: 'Cocina', d: 'Ahora se usa la orden de compra, pero a veces se crea el mismo día que llega la mercancía.' },
      { t: 'Se pide el lunes y se entrega el martes', q: 'Estef' },
      { t: 'Administración paga siempre por adelantado', q: 'Norma', d: 'Pero sin recepción o sin factura no tiene con qué liberar el pago.' },
      { t: 'Si llega de menos, se recibe completo', q: 'Estef', d: 'Y el proveedor promete descontarlo en el siguiente pedido.' },
      { t: 'Nadie lleva la cuenta de lo prometido', q: '—' },
    ],
    dolor: [
      'Recibir antes de contar da por buena mercancía que no llegó.',
      'Cuando el proveedor nota que no se cuenta, empieza a mandar menos.',
      'Los descuentos prometidos dependen de que alguien se acuerde.',
      'Administración y compras se frenan entre sí: una pide la recepción y la otra no puede recibir lo que no ha llegado.',
    ],
    queda: [
      { t: 'Orden de compra el día del pedido', q: 'Estef', d: 'El lunes, no el martes.' },
      { t: 'Pago anticipado contra la orden', q: 'Norma', d: 'Queda como saldo a favor con el proveedor.' },
      { t: 'Llega la mercancía y se cuenta', q: 'Cocina', d: 'Contra la orden: pedido contra recibido.' },
      { t: 'Se recibe SOLO lo que llegó bien', q: 'Estef', d: 'Solo eso sube al inventario.' },
      { t: 'Se descuenta del saldo a favor lo entregado', q: 'Sistema' },
      { t: 'Lo que faltó queda como saldo a favor', q: 'Sistema', d: 'Ligado a la factura y visible en la ficha del proveedor.' },
      { t: 'En el siguiente pedido aparece el saldo', q: 'Estef', d: 'Para aplicarlo y avisarle al proveedor.' },
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
      lineas: ['Factura de $10,000: se pagan $8,000 y los $2,000 restantes el mes siguiente. Para Artik no cambia nada en la gestión de facturas: el complemento de pago lo emite el proveedor.'],
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
      'Requisito previo: inventario confiable (F2, F5, F7 y F18).',
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
    puntos: ['17', '34', '35', '37', '42', '46'],
    hoy: [
      { t: 'Los paquetes escolares y corporativos se mezclan', q: 'Ventas', d: 'En taquilla no se sabe qué precio aplica a una escuela.' },
      { t: 'El paquete escolar se arma a mano', q: 'Taquilla', d: 'Se cobró el acceso y aparte «hamburguesa $110» y «calcetas $70».' },
      { t: 'El acceso y la comida se capturan igual', q: 'Ventas', d: 'Como si ambos fueran artículos.' },
      { t: 'Las calcetas no llevan talla', q: 'Ventas' },
      { t: 'Los adicionales van en notas o en «cobro extra»', q: 'Ventas', d: 'DJ, karaoke, decoración, globos, pastel, montajes.' },
    ],
    dolor: [
      'Taquilla cobra precios manuales y los cortes no cuadran con el evento.',
      'No se separa lo que es servicio (acceso, atracciones) de lo que es producto (comida, calcetas).',
      'Se descuenta la talla equivocada de calcetas.',
    ],
    queda: [
      { t: 'Paquetes separados por tipo', q: 'Dirección', d: 'Taquilla solo ve los precios escolares en un evento escolar.' },
      { t: 'El acceso se registra como servicio', q: 'Sistema', d: 'Y la comida y las calcetas como productos, cada uno con su precio y su descuento.' },
      { t: 'Cada paquete dice qué incluye por persona', q: 'Dirección', d: 'Y se multiplica por los asistentes: 1 pizza completa para 4 niños.' },
      { t: 'Opciones de comida acotadas', q: 'Ventas', d: 'Máximo dos opciones por grupo, por cantidad: 40 hamburguesas y 40 de otra opción.' },
      { t: 'Calcetas por talla', q: 'Coordinación', d: 'Se elige la talla al entregar y solo se descuenta esa.' },
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
    ],
    prueba: [
      'Un evento escolar de 80 personas sale a $449 por persona sin capturar precios a mano.',
      'Con alimentos, descuenta hamburguesas, papas, refrescos y calcetas por talla.',
    ],
  },
  {
    id: 'reglamento-confirmacion',
    num: 'F15',
    area: 'eventos',
    titulo: 'Liga del evento: reglamento, permisos, confirmación y cambios',
    para: 'Que el cliente acepte por escrito lo que contrató, las reglas y las penalizaciones, y que cada cambio quede registrado.',
    puntos: ['15', '16', '44', '45', 'N5', 'N6'],
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
    titulo: 'Pagos y comprobantes del evento',
    para: 'Que cada pago quede con su comprobante y su referencia, para que no haya discusión sobre cuánto se depositó.',
    puntos: ['N7'],
    hoy: [
      { t: 'El cliente manda la foto del comprobante', q: 'Cliente', d: 'Por WhatsApp.' },
      { t: 'El comprobante no se guarda en el sistema', q: 'Ventas' },
      { t: 'Los pagos grandes esperan a Administración', q: 'Ventas', d: 'Se pide que confirmen el ingreso y luego se registra.' },
    ],
    dolor: [
      'Un cliente dijo que depositó $2,000 y en realidad fueron $1,000; no había cómo demostrarlo a la mano.',
    ],
    queda: [
      { t: 'Se registra el pago en el evento', q: 'Ventas', d: 'Monto, banco, referencia y la imagen del comprobante.' },
      { t: 'Administración lo confirma', q: 'Administración', d: 'Cuando el dinero ya está en la cuenta.' },
      { t: 'El cliente lo ve en su liga', q: 'Sistema', d: 'Pagado, pendiente y cada comprobante.' },
    ],
    ejemplo: {
      titulo: 'Ejemplo de la sesión',
      lineas: ['«Yo deposité $2,000». Con el pago registrado: BBVA, referencia y la imagen. El comprobante dice $1,000.'],
    },
    reglas: [
      'Pago con monto, banco, referencia y archivo adjunto.',
      'Estado del pago: registrado o confirmado por Administración.',
    ],
    decidir: [
      { p: '¿A partir de qué monto se espera la confirmación de Administración?', quien: 'Norma' },
    ],
    prueba: [
      'Registro un pago con su comprobante y el cliente lo ve en su liga.',
    ],
  },
  {
    id: 'evento-produccion',
    num: 'F18',
    area: 'eventos',
    titulo: 'Del evento a cocina: horarios, extras y entregas',
    para: 'Que cocina sepa qué preparar, para cuándo y para quién, sin notas ni grupos de WhatsApp, y que todo lo que sale se registre.',
    puntos: ['14', '19', '20', '21', '48', '49', '30'],
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
      { t: 'El inventario se aparta pocos días antes', q: 'Sistema', d: 'Con el reporte de eventos de la semana (F10), no desde que se vende.' },
      { t: 'Antes de la hora, la comanda llega a cocina', q: 'Sistema', d: 'A la pantalla de cocina, arriba, en color de eventos, con nombre del evento, hora y responsable.' },
      { t: 'Los extras se capturan en la tableta', q: 'Coordinador', d: 'Como productos, nunca como nota; llegan a cocina y se suman a la cuenta.' },
      { t: 'Cocina marca lo entregado por artículo', q: 'Chef Mau', d: 'Pendiente, preparado, entregado (F4).' },
      { t: 'Cada cambio deja rastro', q: 'Sistema', d: 'Quién, cuándo, por qué y quién lo autorizó: «Pedrito agregó 5 Coca-Cola».' },
    ],
    reglas: [
      'Hora de comida obligatoria en la reserva y visible en el calendario.',
      'Apartado de inventario solo dentro de los días previos acordados.',
      'Extras siempre como productos en el evento.',
      'Permisos: ventas y coordinación agregan o cambian; los anfitriones solo con autorización; cocina entrega.',
    ],
    decidir: [
      { p: 'Matriz de permisos: quién agrega, cambia, entrega o cancela.', quien: 'Coordinación' },
      { p: 'Responsables de las tabletas de canje (con suplentes para días de descanso).', quien: 'Coordinación' },
      { p: '¿Cuántos días antes se aparta el inventario y cuánto antes llega la comanda a cocina?', quien: 'Chef Mau y Coordinación' },
    ],
    prueba: [
      'Al reservar, el calendario no deja empalmar otra comida a la misma hora sin aviso.',
      'Un evento de diciembre no aparta inventario en noviembre.',
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
];

// Otras áreas: salieron en las conversaciones de cocina y compras, pero son
// de otra sesión. Se anotan para no perderlas.
export const OTRAS = [
  {
    num: 'A1',
    titulo: 'Cajas: una sesión por persona y cobros por área',
    puntos: ['N9'],
    hoy: 'Un cobro de paletas, helados y chocolates de otra área se registró en la caja de cocina: a una caja le faltaron $500 y a la otra le sobraron. Con la cámara se vio que fue un cobro cruzado y la persona tuvo que pagarlo.',
    propuesta: [
      'Que una persona no pueda abrir una segunda caja mientras tiene otra abierta: aviso de «tienes una sesión abierta».',
      'Que cada caja venda solo los productos de su área.',
      'Si un área necesita algo de otra, una transferencia rápida de inventario.',
      'Revisar que cada usuario entre con su propio nombre.',
    ],
    quien: 'Cajas y Dirección',
  },
  {
    num: 'A2',
    titulo: 'Cortes que no llegan completos a las cuentas',
    puntos: ['N10'],
    hoy: 'El efectivo y los cobros con tarjeta de los cortes no se reflejan completos en las cuentas. Un día de $191,000 tenía $21,000 sin reflejar. Por eso Administración no pudo registrar cuentas por pagar: el saldo decía que no había dinero y sí había. La revisión va desde el 6 de agosto; los cobros en línea (Stripe) se van a manejar aparte.',
    propuesta: [
      'Sesión con Administración para revisar el manejo del efectivo, la caja chica y los bancos.',
      'Que cada corte llegue completo a su cuenta y se pueda cerrar el día con el saldo real.',
    ],
    quien: 'Norma · Administración',
  },
];

// Verificación de los puntos de los reportes PDF contra las conversaciones.
// `u` = puntos que decían lo mismo y se unieron en un solo flujo.
export const VERIFICACION: { n: string; t: string; e: 'completo' | 'complementado'; c: string; f: string; u?: string }[] = [
  { n: '01', t: 'Conversión de unidades en recepción', e: 'complementado', c: 'Precio con impuestos y cuadre al centavo contra la factura; presentaciones por caja y bolsa (bollo: 225 piezas); quién recibe cuando el chef descansa.', f: 'F1' },
  { n: '02', t: 'Costeo y merma técnica en recetas', e: 'complementado', c: 'Ejemplos reales: jitomate 35 → 40 g y papa 140 g en crudo. Las porciones por asistentes pasan al paquete (F14).', f: 'F2' },
  { n: '03', t: 'Faltantes recurrentes en consumos de eventos', e: 'complementado', c: 'Causas encontradas: extras capturados como nota, cubetas de cerveza no descontadas, inventario apartado desde el día que se vende y combos de taquilla que no cuentan como venta de cocina.', f: 'F7 · F20' },
  { n: '04', t: 'Insumos de libre disposición en mesas', e: 'completo', c: 'Se agrega el método de dotación y conteo con ejemplo, y la lista completa (azúcar, mascabado, sustituto, jalapeños).', f: 'F3' },
  { n: '05', t: 'Control de mermas y pérdidas', e: 'complementado', c: 'Responsable por persona para medir, daño de proveedor detectado al acomodar, sobrantes por cambios o menos invitados y política de cobrar o absorber.', f: 'F5' },
  { n: '06', t: 'Fallos de visualización en KDS', e: 'completo', c: 'Frecuencia reportada (una o dos veces por semana); el pedido del cliente desde la mesa depende de resolver esto primero.', f: 'F4' },
  { n: '07', t: 'Validación de entrega de pedidos', e: 'completo', c: 'Hoy se hace en papel con firma de caja; un ticket entregado no debe poder entregarse otra vez.', f: 'F4', u: '21' },
  { n: '08', t: 'Compra y recepción como etapas independientes', e: 'complementado', c: 'Faltaba el pago anticipado: Artik siempre paga antes y Administración necesita liberar el pago sin esperar la recepción.', f: 'F8' },
  { n: '09', t: 'Entregas incompletas y diferencias por proveedor', e: 'complementado', c: 'Saldo a favor en la ficha del proveedor, aplicado en el siguiente pedido; acuerdos de pago en partes (calcetas).', f: 'F8 · F9' },
  { n: '10', t: 'Resurtido con base en ventas históricas', e: 'completo', c: 'Temporada alta en noviembre y diciembre; el Excel del chef se sustituye; las órdenes automáticas dependen de un inventario confiable.', f: 'F10' },
  { n: '11', t: 'Separar resurtido normal de eventos', e: 'completo', c: 'Revisión del lunes con dos columnas: eventos confirmados (Mau) y venta normal (Estef).', f: 'F10' },
  { n: '12', t: 'Compras imprevistas y eventos exprés', e: 'complementado', c: 'Magnitud real (hasta 800 hamburguesas, cajas de 72), Ventas autorizada a vender para el mismo día, validar con cocina y espacio antes de cerrar.', f: 'F11', u: '31 · 36' },
  { n: '13', t: 'Tablero de compras y recepción', e: 'completo', c: 'Se agregan las columnas de saldo a favor y abonos programados.', f: 'F8 · F9' },
  { n: '14', t: 'Reservas que afectan existencias antes de tiempo', e: 'complementado', c: 'Ejemplo: 500 hamburguesas apartadas que no existen frenan las compras automáticas. Se aparta con el reporte semanal de eventos.', f: 'F18 · F10' },
  { n: '15', t: 'Confirmación previa de alimentos', e: 'complementado', c: 'Plazo de 3 días antes para horario y alimentos; el cliente lo acepta por escrito en la liga del evento; escuelas y empresas ya lo firman.', f: 'F15', u: '16 · 44 · 45' },
  { n: '16', t: 'Registro y responsabilidad por cambios tardíos', e: 'completo', c: 'Penalización mencionada: cambio de fecha 10 %. La política sigue por decidir con la Dirección.', f: 'F15', u: '15' },
  { n: '17', t: 'Paquetes y productos compuestos', e: 'complementado', c: 'Porciones por asistentes (1 pizza completa = 4 niños) y pasteles de vainilla y chocolate.', f: 'F14', u: '34 · 37 · 42 · 46' },
  { n: '18', t: 'Menús especiales de evento', e: 'completo', c: 'Dice lo mismo que el 29.', f: 'F12', u: '29' },
  { n: '19', t: 'Extras y productos adicionales', e: 'complementado', c: 'El coordinador los captura en tableta y llegan a cocina; caso de 30 cubetas de cerveza sin descontar.', f: 'F18' },
  { n: '20', t: 'Pedidos de eventos en KDS', e: 'completo', c: 'Dice lo mismo que el 30.', f: 'F4 · F18', u: '30' },
  { n: '21', t: 'Entregas parciales y evitar dobles surtidos', e: 'completo', c: 'Dice lo mismo que el 07.', f: 'F4 · F18', u: '07' },
  { n: '22', t: 'Conciliación de consumo y rentabilidad', e: 'completo', c: 'Dice lo mismo que el 47.', f: 'F20', u: '47' },
  { n: '29', t: 'Menús corporativos y especiales con costo por evento', e: 'complementado', c: 'Ejemplo real de margen ($1,600 cobrados contra ≈ $300 de costo por persona) y medir cuáles se repiten.', f: 'F12', u: '18' },
  { n: '30', t: 'KDS vinculado a evento y permisos por función', e: 'complementado', c: 'Color propio con estrella, nombre del evento y del responsable, hora de entrega y extras sumados a la cuenta.', f: 'F4 · F18', u: '20 · 49' },
  { n: '31', t: 'Insumos extraordinarios desde la confirmación comercial', e: 'completo', c: 'Se atiende con el aviso de evento exprés y el menú especial.', f: 'F11 · F12', u: '12' },
  { n: '32', t: 'Prospección y cotizaciones antes del primer anticipo', e: 'complementado', c: 'Se agrega reasignar el vendedor cuando un compañero lo cubre en su descanso.', f: 'F13', u: '33 · 50' },
  { n: '33', t: 'Clasificar eventos desde su registro', e: 'completo', c: 'Cumpleaños, escolar, corporativo y marketing, con su propio catálogo de paquetes.', f: 'F13' },
  { n: '34', t: 'Catálogo de paquetes corporativos parametrizados', e: 'complementado', c: 'Contenido real: taquiza (alambre de arrachera y de pollo), refresco, agua y agua mineral, rally y coffee break premium.', f: 'F14' },
  { n: '35', t: 'Adicionales comerciales como conceptos estructurados', e: 'complementado', c: 'Se suman los permisos con cobro (meter adornos o regalos propios).', f: 'F14 · F15' },
  { n: '36', t: 'Trazabilidad de eventos exprés', e: 'completo', c: 'Dice lo mismo que el 12.', f: 'F11', u: '12' },
  { n: '37', t: 'Separar accesos y atracciones de alimentos', e: 'complementado', c: 'Caso real: taquilla cobró el paquete escolar como «hamburguesa $110» y «calcetas $70» por separado.', f: 'F14' },
  { n: '38', t: 'Asistentes por edad y uso real de atracciones', e: 'completo', c: 'Hoy se cuenta a un adulto como niño si va a usar atracciones.', f: 'F16' },
  { n: '39', t: 'Lista digital de invitados y check-in', e: 'complementado', c: 'La lista se llena en la liga del evento hasta 3 días antes; los «+3» de la hoja se cobran dentro del evento en taquilla.', f: 'F16', u: '38 · 40 · 43' },
  { n: '40', t: 'Carga masiva de grupos escolares', e: 'completo', c: 'Listas de 150 a 200 personas en PDF o foto.', f: 'F16' },
  { n: '41', t: 'Cortesías, acompañantes e influencers', e: 'complementado', c: 'Caso real: un evento de marketing aparecía con $19,900 sin cobrar; pastel de cortesía sin registro.', f: 'F19' },
  { n: '42', t: 'Calcetas por talla dentro de paquetes', e: 'completo', c: 'Se elige la talla al entregar.', f: 'F14' },
  { n: '43', t: 'Capacidad, espacios VIP y límite de asistentes', e: 'completo', c: 'Aviso cuando el grupo rebasa el espacio contratado.', f: 'F16' },
  { n: '44', t: 'Reglamento, permisos y penalizaciones', e: 'complementado', c: 'Caso real: permiso para meter adornos de Halloween con cobro adicional; reporte de penalizaciones cobradas.', f: 'F15' },
  { n: '45', t: 'Confirmación digital y control de versiones', e: 'complementado', c: 'La misma liga muestra pagos, comprobantes y lista de invitados.', f: 'F15' },
  { n: '46', t: 'Paquetes escolares y alimentación opcional', e: 'complementado', c: 'Precios dichos: $449 de acceso (50 a 100 personas) y $180 de alimentos ($110 + $70 de calcetas).', f: 'F14' },
  { n: '47', t: 'Reporte integral de ingresos y consumos por evento', e: 'completo', c: 'Dice lo mismo que el 22.', f: 'F20', u: '22' },
  { n: '48', t: 'Autorización y auditoría de cambios operativos', e: 'complementado', c: 'Solo ventas y coordinación editan; anfitriones con autorización; responsables de tabletas con suplentes.', f: 'F18' },
  { n: '49', t: 'Programación de entregas y avisos a cocina', e: 'complementado', c: 'Hora de comida obligatoria en la reserva y calendario de horas ocupadas para no empalmar fiestas.', f: 'F18', u: '30' },
  { n: '50', t: 'Atribución comercial y conversión', e: 'completo', c: 'Canal, campaña o influencer y vendedor desde el primer contacto.', f: 'F13', u: '32' },
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
  { n: 'N9', t: 'Cajas: una sesión por persona y cobros por área', f: 'A1' },
  { n: 'N10', t: 'Cortes que no llegan completos a las cuentas', f: 'A2' },
];

// Próximos pasos: solo lo que se dijo en las sesiones.
export const PASOS = [
  { q: 'Sacs', t: 'Se lleva los flujos para definir qué se ajusta en el sistema y la siguiente semana capacita por área con el nuevo proceso.' },
  { q: 'Eventos', t: 'Compartir el Drive con los Excel y PDF que se usan hoy (horarios, listas de invitados, cotizaciones), sin las pestañas del global.' },
  { q: 'Eventos', t: 'Mandar dudas y comentarios por el grupo de WhatsApp; ahí Sacs avisa lo que vaya quedando.' },
  { q: 'Compras', t: 'Reunir varias facturas reales de distintos proveedores para probar las reglas de conversión y de cuadre.' },
  { q: 'Cocina', t: 'Anotar dispositivo, hora y folio de la próxima comanda que no aparezca en la pantalla.' },
  { q: 'Administración', t: 'Sesión para revisar efectivo, caja chica y bancos, para que todo caiga en su cuenta.' },
];
