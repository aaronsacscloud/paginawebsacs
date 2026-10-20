// Contenido de la guía de entrega de la Suite de Consignación (19-oct-2026).
// La página /entrega/consignacion lo pinta; lo que se captura con cada cliente
// se guarda aparte (api/entrega/sesion). Cada capítulo es un proceso de punta
// a punta o el bloque de dashboard y reportes.
//
// - `secciones[].puntos`: lo que se valida con el cliente.
// - `hoy` / `filtros`: lo que la pantalla ya muestra (solo reportes).
// - `sugerencias`: faltantes a proponer; pasan a la tabla solo si el cliente los quiere.
// - Los `id` de sección son la llave de lo capturado: NO se renombran.

const TIPOS_FLUJO = ["Mejora de UI", "Mejora de proceso", "Condicional / regla", "Bug"];
const TIPOS_REPORTE = ["Campo / columna", "Dato / cálculo", "Filtro", "Total / subtotal", "Exportación", "Gráfica / indicador", "Reporte nuevo", "Otro"];
const COLS_FLUJO = { a: "Qué hizo / qué esperaba / qué vio", b: "Propuesta del cliente" };
const COLS_REPORTE = { a: "Qué falta", b: "Para qué lo usa el cliente" };

export const GUIA = {
  capitulos: [
    {
      id: "f1",
      nombre: "Alta, venta, liquidación y comisiones",
      resumen: "Del alta del consignatario con su contrato hasta la venta, el pago al consignatario y la comisión de los vendedores.",
      tipos: TIPOS_FLUJO, cols: COLS_FLUJO,
      // Mapa del proceso: cajas en una rejilla de 5 columnas (col 0–4) por
      // filas; `sec` = la etapa a la que salta al tocarla.
      diagrama: {
        titulo: 'Cada pieza termina pagada al consignatario o devuelta al vencer',
        lectura: 'La pieza entra con contrato firmado y sigue uno de dos caminos: se vende y se le paga al consignatario, o vence y se le devuelve. Cada venta genera también la comisión del vendedor; una devolución del cliente final regresa la pieza a la venta.',
        nodos: [
          { id: 'a', c: 0, r: 0, t: 'Configuración', s: '1 · plantilla', sec: 'f1-config' },
          { id: 'b', c: 1, r: 0, t: 'Consignatario', s: '2 · alta y datos', sec: 'f1-alta' },
          { id: 'c', c: 2, r: 0, t: 'Recepción', s: '3 · lote y piezas', sec: 'f1-recepcion' },
          { id: 'd', c: 3, r: 0, t: 'Contrato', s: '4 · firma', sec: 'f1-firma' },
          { id: 'e', c: 4, r: 0, t: 'Preparación', s: '5 · opcional', sec: 'f1-preparacion' },
          { id: 'f', c: 0, r: 1, t: 'Venta', s: '6 · POS / pedido', sec: 'f1-venta' },
          { id: 'g', c: 1, r: 1, t: 'Liquidación', s: '8 · corte', sec: 'f1-liquidacion' },
          { id: 'h', c: 2, r: 1, t: 'Pago', s: '8 · comprobante', sec: 'f1-liquidacion', fin: true },
          { id: 'j', c: 4, r: 1, t: 'Cierre', s: '10 · vencimiento', sec: 'f1-cierre' },
          { id: 'k', c: 0, r: 2, t: 'Devolución', s: '7 · cliente final', sec: 'f1-devoluciones' },
          { id: 'l', c: 1, r: 2, t: 'Comisión', s: '9 · vendedores', sec: 'f1-comisiones' }
        ],
        flechas: [
          { de: 'a', a: 'b' }, { de: 'b', a: 'c' }, { de: 'c', a: 'd' }, { de: 'd', a: 'e' },
          { de: 'e', a: 'f', et: 'se vende' }, { de: 'e', a: 'j', et: 'no se vende' },
          { de: 'f', a: 'g' }, { de: 'g', a: 'h' },
          { de: 'f', a: 'k', et: 'si devuelve', dx: -40 }, { de: 'f', a: 'l', dx: 40 }
        ]
      },
      secciones: [
      {
        id: 'f1-clave',
        clave: true,
        nombre: 'Puntos clave del proceso',
        para: 'Lo mínimo que tiene que funcionar de punta a punta antes de entregar. Se prueba con un consignatario y dos piezas reales: una que se vende de contado y otra que se aparta.',
        puntos: [
          'El contrato firmado refleja las reglas reales del cliente: comisión, vigencia, forma y plazo de pago.',
          'Una pieza recibida aparece en inventario y solo se puede vender cuando está disponible.',
          'Una venta real genera el pago correcto al consignatario (comprobado a mano, con y sin descuento).',
          'Pagar al consignatario cambia la pieza a liquidada, emite el comprobante y su estado de cuenta cuadra.',
          'La comisión del vendedor por esa venta sale correcta en su periodo.',
          'Una devolución del cliente final deja en orden la pieza, el pago al consignatario y la comisión.',
          'El consignatario recibe los avisos de venta y de pago.'
        ]
      },
      {
        id: 'f1-config',
        nombre: 'Etapa 1 · Configuración y plantilla de contrato',
        donde: 'Consignación › Configuración (también Mi Cuenta › Suite de Consignación), tarjeta «Plantillas de contrato (reglas)»',
        para: 'El cliente define hasta 5 plantillas, una predeterminada. Cada una fija el % de comisión de la tienda (y si es negociable, con mínimo y máximo), la vigencia, la renovación, la frecuencia de liquidación, los días para pagar, los días de espera antes de pagar, la forma de pago (dinero o saldo a favor), qué hacer si no se vende y las cláusulas.',
        puntos: [
          'La suite está activa y el menú Consignación muestra sus secciones.',
          'Existe al menos una plantilla con las reglas reales del cliente y está marcada como predeterminada.',
          'El % de comisión, el mínimo y el máximo coinciden con la política comercial del cliente.',
          'La frecuencia de liquidación y los días de pago coinciden con lo que se le promete al consignatario.',
          'Los días de espera antes de pagar cubren el plazo de devolución que da la tienda a sus clientes.',
          'La regla de «no venta» (rebaja, devolución o renovación) es la que el cliente aplica hoy.',
          'Los servicios con cargo (certificación, limpieza, fotos, reparación) y sus importes están dados de alta, y se sabe si se cobran al firmar o se descuentan al liquidar.',
          'El texto de las cláusulas muestra bien las variables (comisión, forma de pago, no venta, vigencia).'
        ]
      },
      {
        id: 'f1-alta',
        nombre: 'Etapa 2 · Alta del consignatario',
        donde: 'Consignación › Consignatarios › «Nuevo Consignatario» (asistente: 1 Datos · 2 Productos · 3 Contrato)',
        para: 'Se capturan los datos personales, de contacto y bancarios. El sistema asigna el folio CONS-AAAA-NNN, avisa si el correo o el teléfono ya existen y valida la CLABE. Se suben la identificación y las fotos de ingreso.',
        puntos: [
          'El alta se completa sin errores y asigna folio CONS-.',
          'Al repetir un correo o teléfono existente, el sistema avisa del posible duplicado.',
          'Una CLABE inválida se rechaza con un mensaje claro.',
          'La identificación y las fotos se suben y se pueden volver a ver desde el perfil.',
          'El consignatario aparece en la lista y su perfil muestra Resumen / Productos / Contrato / Liquidaciones.',
          'Los campos obligatorios son los que el cliente necesita (ni de más ni de menos).'
        ]
      },
      {
        id: 'f1-recepcion',
        nombre: 'Etapa 3 · Recepción de productos (lote)',
        donde: 'Paso 2 del asistente: «Contrato del lote» y «Agregar producto rápido»',
        para: 'Se elige la plantilla del lote y se agregan las piezas con precio, fotos y servicios. Con la primera pieza la plantilla queda bloqueada. Cada pieza recibe SKU CONS-AAAAMMDD-NNN y el lote folio LOTE-AAAA-NNN. El sistema calcula la comisión y el pago estimado al consignatario.',
        nota: 'Cálculo del % de comisión: primero el % negociado (dentro de mínimo y máximo); si no, la tabla escalonada por precio; si no, la tabulada (menos de $6,000 = 30%, desde $6,000 = 20%); si no, el de la plantilla.',
        puntos: [
          'Cada pieza recibe su SKU y queda ligada al consignatario y al lote.',
          'El % de comisión que se muestra corresponde a la regla esperada para ese precio.',
          'Un % negociado fuera del mínimo o máximo se ajusta o se rechaza.',
          'El pago estimado = precio − comisión − servicios que se descuentan. Comprobado a mano con una pieza.',
          'Un precio fuera de límites se rechaza; una baja de precio de 70% o más pide confirmación.',
          'La plantilla no se puede cambiar después de agregar la primera pieza.',
          'Quedó claro cómo se etiqueta físicamente la pieza.'
        ]
      },
      {
        id: 'f1-firma',
        nombre: 'Etapa 4 · Contrato y firma',
        donde: 'Paso 3 del asistente: «Finalizar y Firmar» (presencial) o «Enviar enlace para firmar» (remota, 48 horas)',
        para: 'Antes de firmar se revisan las reglas de activación (datos bancarios y, si se exige, que no tenga adeudos). Al firmar se genera el PDF con QR de verificación y la responsiva de ingreso; el consignatario pasa a activo y las piezas entran al inventario.',
        puntos: [
          'Sin datos bancarios (si la plantilla los exige) no deja firmar y explica por qué.',
          'La firma presencial se captura y el contrato queda firmado.',
          'El enlace de firma remota llega por correo, abre sin cuenta y deja firmar; pasadas 48 horas ya no funciona.',
          'El PDF del contrato muestra datos, piezas, reglas y cláusulas correctas, el logo y un QR que verifica.',
          'La responsiva de ingreso se genera y se puede imprimir.',
          'No se puede firmar dos veces el mismo lote.',
          'Se puede subir un contrato firmado en papel.',
          'Después de firmar, el consignatario queda activo y cada pieza aparece en el inventario de la sucursal y almacén correctos.',
          'Cancelación y adenda de contrato funcionan, si el cliente las usa.'
        ]
      },
      {
        id: 'f1-preparacion',
        nombre: 'Etapa 5 · Preparación y puesta a la venta',
        donde: 'Consignación › Colas de proceso (solo si el proceso post-contrato está activo)',
        para: 'Las piezas pasan por pasos como certificación, limpieza, fotos, reparación y etiquetado. Mientras están en proceso no se venden. Al terminar quedan disponibles.',
        puntos: [
          'Los pasos del proceso son los que el cliente realiza en su operación.',
          'Una pieza en proceso no aparece en la búsqueda del punto de venta.',
          'Al completar los pasos, la pieza queda disponible y aparece en el punto de venta.',
          'Si el cliente no usa proceso, la pieza queda disponible al firmar.'
        ]
      },
      {
        id: 'f1-venta',
        nombre: 'Etapa 6 · Venta en punto de venta o por apartado',
        donde: 'Punto de venta (contado) o Pedidos / Apartados',
        para: 'Solo se venden piezas disponibles. Al cobrar, la pieza pasa a vendida, se guarda quién la vendió y en qué sucursal, se calcula la comisión y el pago al consignatario, y se le avisa. Un apartado reserva la pieza y se vende cuando el pedido queda pagado.',
        nota: 'Cálculo al vender: base = precio cobrado (con descuento y con IVA). Comisión = base × %. Pago al consignatario = base − comisión − servicios pendientes. Por defecto el descuento lo absorbe el consignatario.',
        puntos: [
          'Una pieza en proceso, retenida, vencida o con incidente no aparece en el punto de venta.',
          'La venta de contado se cobra normal y la pieza pasa a vendida en el perfil del consignatario.',
          'Comisión y pago al consignatario comprobados a mano con una venta real. Se acordó con el cliente si la base incluye IVA.',
          'Venta con descuento: se acordó quién lo absorbe (consignatario o tienda) y el resultado coincide.',
          'El vendedor y la sucursal quedan registrados; una venta en otra sucursal se identifica como venta cruzada.',
          'El consignatario recibe el aviso de venta.',
          'Apartado: la pieza no se puede vender a otro cliente; al liquidar el pedido pasa a vendida; al cancelarlo vuelve a disponible.',
          'El lote cambia de estado conforme se vende (activo → parcial → vendido).',
          'Después de cada venta la pieza tiene su pago generado en Liquidaciones.'
        ]
      },
      {
        id: 'f1-devoluciones',
        nombre: 'Etapa 7 · Devoluciones y excepciones de la venta',
        donde: 'Devolución o cancelación en ventas; en el perfil del consignatario: «Cliente devolvió» y «No auténtica»',
        para: 'Si el cliente final devuelve y al consignatario aún no se le paga, la pieza vuelve a disponible y su pago se cancela. Si ya se le pagó, se usa «Cliente devolvió» para recuperar el dinero (cuenta por cobrar o descuento del saldo).',
        puntos: [
          'Devolución antes de pagar al consignatario: la pieza vuelve a disponible y sale de lo pendiente por pagar.',
          'Devolución de una pieza ya pagada: «Cliente devolvió» genera la recuperación esperada.',
          'Pieza no auténtica después de vendida: «No auténtica» da el resultado acordado con el cliente.',
          'Se acordó qué pasa con la comisión del vendedor cuando hay devolución.'
        ]
      },
      {
        id: 'f1-liquidacion',
        nombre: 'Etapa 8 · Liquidación y pago al consignatario',
        donde: 'Perfil del consignatario › Liquidaciones («Por pagar», «Total a Liquidar», «Pagar seleccionadas», «Liquidar (dividir pago)», «Conciliar», «Estado de cuenta»)',
        para: 'Cada venta genera una cuenta por pagar. Liquidación inmediata = una por pieza (folio LIQ-); semanal, quincenal o mensual = un corte por periodo. Fecha de pago = venta + días de pago. Se paga en dinero, en saldo a favor o mixto, y se emite el comprobante.',
        puntos: [
          'La cuenta por pagar aparece con el monto, la fecha de pago y el folio correctos.',
          'Con frecuencia semanal, quincenal o mensual, las ventas del periodo se suman en un solo corte.',
          'Pagar antes de terminar los días de espera no se permite y el mensaje es claro.',
          'Pago total, parcial y de varias liquidaciones a la vez funcionan; el pendiente se actualiza.',
          'Pago en saldo a favor y pago mixto dejan el saldo correcto, incluido el bono si aplica.',
          'Al pagar, la pieza pasa a liquidada.',
          'El comprobante de pago (PDF) se genera y llega por correo.',
          'El estado de cuenta cuadra con lo vendido, pagado y pendiente.',
          'Se acordó con el cliente si necesita retenciones fiscales o factura de la liquidación.',
          'Se revisó cómo se refleja un pago en efectivo en el corte de caja.'
        ]
      },
      {
        id: 'f1-comisiones',
        nombre: 'Etapa 9 · Comisión a vendedores',
        donde: 'Metas y comisiones (planes, periodos, aprobación); reporte «Desempeño de vendedores»',
        para: 'El plan paga sobre venta o sobre margen; en piezas consignadas el margen es la comisión de la tienda. Puede haber comisión de captación para quien registró la pieza. El periodo se calcula, se aprueba y se envía a cuentas por pagar. Las «Metas rápidas» son solo seguimiento.',
        puntos: [
          'El plan refleja el esquema real del cliente (sobre venta o margen, %).',
          'La comisión de una pieza consignada se calcula sobre la base acordada; comprobado a mano.',
          'La comisión de captación se paga a quien registró la pieza, si el cliente la usa.',
          'En apartados, la comisión se genera en el momento acordado (al liquidar o al primer abono).',
          'Calcular, aprobar y enviar el periodo a cuentas por pagar funciona; el pago queda registrado.',
          'El reporte «Desempeño de vendedores» muestra la comisión de cada vendedor y cuadra con el periodo.',
          'Devolución después de aprobado o pagado el periodo: se acordó si se descuenta la comisión.'
        ]
      },
      {
        id: 'f1-cierre',
        nombre: 'Etapa 10 · Cierre del ciclo de la pieza',
        donde: 'Perfil del consignatario («Devolver / retirar»), Solicitudes de retiro y portal del consignatario',
        para: 'Si la pieza no se vende, el contrato vence: aviso, rebaja, renovación o devolución. El detalle completo está en el proceso 2 (Vencimiento, devolución y retiro).',
        puntos: [
          'El cliente entiende qué pasa con una pieza que no se vende y lo ve reflejado en el sistema.',
          'Una pieza vendida y pagada queda cerrada (liquidada) y no aparece como pendiente en ningún lado.'
        ]
      }

      ]
    },
    {
      id: 'p2',
      nombre: 'Vencimiento, devolución y retiro de piezas',
      resumen: 'Qué pasa con una pieza que no se vende: aviso, rebaja, renovación o devolución al consignatario, y las salidas especiales (compra por la tienda, robo o pérdida).',
      tipos: TIPOS_FLUJO, cols: COLS_FLUJO,
      diagrama: {
        titulo: 'Al vencer, el contrato se renueva solo o sus piezas pasan a devolución',
        lectura: 'Una revisión automática diaria avisa 7 días antes, aplica la regla de no venta y, al vencer, renueva o manda las piezas a devolución. Al devolver se cobran los servicios que el consignatario no pagó.',
        nodos: [
          { id: 'a', c: 0, r: 0, t: 'Contrato', s: 'vigente', sec: 'p2-adenda' },
          { id: 'b', c: 1, r: 0, t: 'Aviso', s: '7 días antes', sec: 'p2-aviso' },
          { id: 'c', c: 2, r: 0, t: 'No venta', s: 'rebaja o devolución', sec: 'p2-aviso' },
          { id: 'd', c: 3, r: 0, t: 'Vencimiento', s: 'revisión diaria', sec: 'p2-vence' },
          { id: 'e', c: 4, r: 0, t: 'Renovación', s: 'automática', sec: 'p2-vence', fin: true },
          { id: 'f', c: 3, r: 1, t: 'Por devolver', s: 'ya no se vende', sec: 'p2-vence' },
          { id: 'g', c: 2, r: 1, t: 'Devolver', s: 'sale de inventario', sec: 'p2-devolver' },
          { id: 'h', c: 1, r: 1, t: 'Cobro', s: 'servicios (DEV-)', sec: 'p2-devolver' },
          { id: 'i', c: 3, r: 2, t: 'Compra', s: 'la tienda la compra', sec: 'p2-compra' },
          { id: 'j', c: 0, r: 1, t: 'Adenda', s: 'nueva versión', sec: 'p2-adenda' }
        ],
        flechas: [
          { de: 'a', a: 'b' }, { de: 'b', a: 'c' }, { de: 'c', a: 'd' },
          { de: 'd', a: 'e', et: 'renueva' }, { de: 'd', a: 'f', et: 'no renueva' },
          { de: 'f', a: 'g' }, { de: 'g', a: 'h' },
          { de: 'f', a: 'i', et: 'o la compra' }, { de: 'a', a: 'j', et: 'cambios' }
        ]
      },
      secciones: [
        {
          id: 'p2-clave', clave: true,
          nombre: 'Puntos clave del proceso',
          para: 'Se prueba con un contrato de prueba con vigencia corta (o ya vencido) y con piezas sin vender.',
          puntos: [
            'La revisión diaria corre en la cuenta del cliente: un contrato de prueba vencido cambia de estado al día siguiente.',
            'El consignatario recibe el aviso de «por vencer».',
            'La regla de no venta hace lo que el cliente espera (rebaja una sola vez, o manda a devolución).',
            'Un contrato sin renovación deja sus piezas sin poder venderse, en el punto de venta y en la tienda en línea.',
            'Devolver una pieza la saca del inventario y cobra los servicios pendientes.',
            'Comprar la pieza o registrar robo/pérdida le paga al consignatario lo acordado.'
          ]
        },
        {
          id: 'p2-aviso',
          nombre: 'Etapa 1 · Aviso por vencer y regla de no venta',
          donde: 'Automático (revisión diaria, 7:20 a.m. aprox.). Se ve en la pieza (precio tachado) y en el Dashboard («Contratos por vencer»)',
          para: 'Avisa una sola vez, 7 días antes de vencer. Si la pieza no se vende en los días que marca la plantilla, aplica la acción: rebaja de precio (una vez, con precio anterior tachado), marcar para devolución, o nada si la acción es renovación. Los días cuentan desde la firma.',
          puntos: [
            'El aviso de «por vencer» llega al consignatario por WhatsApp o correo, una sola vez.',
            'Los días de aviso son los que el cliente quiere (el sistema usa 7 por defecto).',
            'La rebaja se aplica una sola vez, con el % de la plantilla, y el precio anterior se ve tachado.',
            'Después de la rebaja, la comisión y el pago al consignatario se recalculan como el cliente espera.',
            'Se acordó si el consignatario debe recibir aviso de la rebaja (hoy no se le avisa).',
            'Con acción «devolución», las piezas quedan por devolver y ya no se venden.'
          ]
        },
        {
          id: 'p2-vence',
          nombre: 'Etapa 2 · Vencimiento y renovación',
          donde: 'Automático (revisión diaria). Chip «Por devolver» en la pieza; filtro «Con piezas por devolver» en Clientes',
          para: 'Con renovación automática el contrato se extiende (45 días por defecto) sin nueva firma y se avisa por correo. Sin renovación, el contrato queda vencido y sus piezas no vendidas pasan a por devolver, con un correo que invita a recogerlas.',
          puntos: [
            'Un contrato con renovación automática se extiende los días acordados y el consignatario recibe el correo.',
            'Un contrato sin renovación queda vencido y sus piezas pasan a «Por devolver».',
            'Una pieza por devolver no aparece en el punto de venta.',
            'Una pieza por devolver deja de mostrarse en la tienda en línea.',
            'El filtro «Con piezas por devolver» muestra a los consignatarios correctos.',
            'El texto del correo de vencimiento es el que el cliente quiere enviar.'
          ]
        },
        {
          id: 'p2-devolver',
          nombre: 'Etapa 3 · Devolver o retirar la pieza',
          donde: 'Perfil del consignatario › Productos › «Devolver / Retirar»',
          para: 'La pieza pasa a devuelta y sale del inventario. Si tiene servicios que el consignatario no pagó al firmar, se genera una cuenta por cobrar con folio DEV- a 15 días. No se permite si la pieza está apartada, tiene incidente o ya se vendió.',
          puntos: [
            'Devolver una pieza la saca del inventario y queda como devuelta en el perfil.',
            'Se genera el cobro DEV- por los servicios pendientes, con el monto correcto.',
            'No se puede devolver una pieza apartada, con incidente o vendida, y el mensaje es claro.',
            'Se puede devolver varias piezas de un consignatario sin hacerlo una por una (si el cliente lo necesita, anotarlo).',
            'Queda constancia de la entrega (quién y cuándo) para el cliente.'
          ]
        },
        {
          id: 'p2-compra',
          nombre: 'Etapa 4 · Compra de la pieza por la tienda, robo o pérdida',
          donde: 'Perfil del consignatario › Productos › «Comprarle la pieza» / «Robo / pérdida» (requiere permiso)',
          para: 'Comprar la pieza paga al consignatario valuación − comisión − cargos (por cuenta por pagar, saldo a favor o pago directo) y la pieza pasa al inventario propio. Robo o pérdida le paga al consignatario como si se hubiera vendido y registra la pieza como pérdida.',
          puntos: [
            'Solo los usuarios con permiso ven «Comprarle la pieza».',
            'El pago al consignatario por la compra se calcula como acordó el cliente.',
            'La pieza comprada aparece en el inventario propio de la tienda.',
            'Robo o pérdida genera el pago al consignatario por el monto correcto.',
            'Se acordó cómo se registra la pérdida para la tienda y si se le cobra a un empleado responsable.'
          ]
        },
        {
          id: 'p2-adenda',
          nombre: 'Etapa 5 · Adenda y cancelación de contrato',
          donde: 'Perfil del consignatario › Contrato › «Más acciones» › «Crear adenda»',
          para: 'La adenda crea una nueva versión firmada del contrato con los precios y cargos actuales y la misma vigencia. La cancelación regresa el lote a borrador.',
          puntos: [
            'Crear una adenda genera la nueva versión y el PDF refleja los cambios.',
            'La adenda conserva la vigencia original.',
            'Se revisó cómo cancela el cliente un contrato (hoy no tiene botón en pantalla).'
          ]
        }
      ]
    },
    {
      id: 'p3',
      nombre: 'Preparación de piezas (colas de proceso)',
      resumen: 'Lo que pasa entre la firma y la venta: certificación, limpieza, fotos, reparación y etiquetado; piezas falsas, no aptas o retenidas; y el cobro de servicios.',
      tipos: TIPOS_FLUJO, cols: COLS_FLUJO,
      diagrama: {
        titulo: 'Una pieza solo se vende cuando completa sus pasos obligatorios',
        lectura: 'Con el proceso activo, cada pieza firmada entra en proceso y no se vende hasta completar los pasos requeridos. Una pieza falsa genera un cobro de penalización; un costo extra alto espera aprobación; una pieza retenida deja de venderse.',
        nodos: [
          { id: 'a', c: 0, r: 0, t: 'Firma', s: 'contrato', sec: 'p3-activar' },
          { id: 'b', c: 1, r: 0, t: 'En proceso', s: 'no se vende', sec: 'p3-activar' },
          { id: 'c', c: 2, r: 0, t: 'Pasos', s: 'certificación, fotos', sec: 'p3-pasos' },
          { id: 'd', c: 3, r: 0, t: 'Disponible', s: 'a la venta', sec: 'p3-pasos', fin: true },
          { id: 'e', c: 1, r: 1, t: 'Fake / no apta', s: 'penalización FAKE-', sec: 'p3-fake' },
          { id: 'f', c: 2, r: 1, t: 'Costo extra', s: 'por aprobar', sec: 'p3-cargos' },
          { id: 'g', c: 3, r: 1, t: 'Retenida', s: 'pausa la venta', sec: 'p3-retener' }
        ],
        flechas: [
          { de: 'a', a: 'b' }, { de: 'b', a: 'c' }, { de: 'c', a: 'd', et: 'completa' },
          { de: 'c', a: 'e', et: 'falsa', dx: -40 }, { de: 'c', a: 'f', et: 'costo', dx: 20 }, { de: 'd', a: 'g', et: 'retener' }
        ]
      },
      secciones: [
        {
          id: 'p3-clave', clave: true,
          nombre: 'Puntos clave del proceso',
          para: 'Se prueba con dos piezas: una que completa todos los pasos y otra que se marca como falsa.',
          puntos: [
            'Una pieza en proceso no se puede vender en ningún canal.',
            'Al completar los pasos obligatorios, la pieza queda disponible y el consignatario recibe aviso.',
            'Una pieza falsa genera el cobro de penalización correcto.',
            'Un costo extra alto espera aprobación antes de cobrarse.',
            'Los servicios cobrados al firmar no se vuelven a descontar al vender.'
          ]
        },
        {
          id: 'p3-activar',
          nombre: 'Etapa 1 · Proceso activo y pasos configurados',
          donde: 'Consignación › Configuración («Proceso post-contrato») y Consignación › Colas de proceso (vistas Cola y Kanban)',
          para: 'Si el proceso está activo, cada pieza firmada entra en proceso. Pasos: certificación, limpieza, fotos, reparación y etiquetado; todos requeridos menos reparación. El orden es sugerido.',
          puntos: [
            'Los pasos activos son los que el cliente realiza en su operación.',
            'Los pasos requeridos son los correctos (reparación es opcional por defecto).',
            'La vista Cola y el Kanban muestran las piezas donde van.',
            'Quedó claro quién en el equipo del cliente es responsable de cada paso.'
          ]
        },
        {
          id: 'p3-pasos',
          nombre: 'Etapa 2 · Completar pasos y evidencias',
          donde: 'Colas de proceso › pieza › «Completar [paso]» › «Guardar y completar»',
          para: 'Cada paso pide sus datos: certificación (resultado, certificadora, número y al menos una evidencia), fotos (mínimo 3), reparación (descripción), etiquetado (confirmar etiqueta colocada). Al terminar los requeridos, la pieza queda disponible.',
          puntos: [
            'Cada paso pide los datos que el cliente necesita, ni más ni menos.',
            'Sin los datos obligatorios, el paso no se puede completar y el mensaje es claro.',
            'Las fotos y evidencias se suben bien desde la tableta o el teléfono.',
            'Al completar el último paso requerido, la pieza aparece en el punto de venta.',
            'El consignatario recibe el aviso de pieza disponible.',
            'La cadena de custodia muestra quién hizo cada paso.'
          ]
        },
        {
          id: 'p3-cargos',
          nombre: 'Etapa 3 · Costos y cargos por aprobar',
          donde: 'Colas de proceso › costo real del paso; «Cargos pendientes de aprobación» (Aprobar / Rechazar)',
          para: 'El costo real de un paso se vuelve cargo al consignatario. Si rebasa el tope en % del precio se rechaza; arriba del umbral de aprobación queda pendiente. Si la pieza trae «Kit limpieza + certificado», esos dos pasos no se cobran aparte.',
          puntos: [
            'El tope de cargo y el umbral de aprobación son los que el cliente quiere.',
            'Un cargo arriba del umbral aparece en pendientes y se puede aprobar o rechazar.',
            'Un cargo aprobado se refleja en el pago al consignatario.',
            'El kit de limpieza + certificado no cobra esos pasos dos veces.',
            'Se acordó qué hacer con un cargo pendiente si la pieza se vende antes de aprobarlo.'
          ]
        },
        {
          id: 'p3-fake',
          nombre: 'Etapa 4 · Pieza falsa o no apta',
          donde: 'Colas de proceso › pieza › «FAKE» / «No apta»',
          para: 'Una pieza falsa genera una cuenta por cobrar FAKE- por la penalización ($1,500 por defecto) más los cargos no pagados. Una pieza no apta no genera cobro; su salida es la devolución.',
          puntos: [
            'Marcar una pieza como falsa genera el cobro FAKE- con el monto acordado.',
            'La penalización es la que el cliente cobra en su política.',
            'Una pieza falsa o no apta no se puede vender.',
            'Una pieza no apta se puede devolver al consignatario.'
          ]
        },
        {
          id: 'p3-retener',
          nombre: 'Etapa 5 · Retener y liberar',
          donde: 'Detalle de la pieza › «Retener (pausar venta)» / «Liberar»',
          para: 'Retener pausa la venta de una pieza disponible o en proceso, pide motivo y la quita de la tienda en línea. Liberar la regresa a su estado anterior.',
          puntos: [
            'Una pieza retenida no se puede vender y se pide el motivo.',
            'La pieza retenida deja de verse en la tienda en línea.',
            'Al liberarla, vuelve a su estado anterior y a la tienda en línea si estaba publicada.'
          ]
        },
        {
          id: 'p3-cobro',
          nombre: 'Etapa 6 · Cobro de servicios al firmar',
          donde: 'Asistente del consignatario › Contrato › cobro de servicios (método de pago y caja abierta)',
          para: 'Los servicios se pueden cobrar al firmar: entran al corte de caja y ya no se descuentan al vender. Lo que no se cobra se descuenta en la liquidación o se cobra si la pieza se devuelve.',
          puntos: [
            'El cobro al firmar pide caja abierta y entra al corte de caja.',
            'Un servicio cobrado al firmar no se descuenta otra vez al liquidar.',
            'Un servicio no cobrado se descuenta en la liquidación.'
          ]
        }
      ]
    },
    {
      id: 'p4',
      nombre: 'Devoluciones, incidentes y recuperaciones',
      resumen: 'Qué pasa cuando el cliente final devuelve una pieza, cuando resulta no auténtica y cuando hay un daño, pérdida o reclamo (incidentes).',
      tipos: TIPOS_FLUJO, cols: COLS_FLUJO,
      diagrama: {
        titulo: 'Una devolución se revierte sola solo si al consignatario aún no se le paga',
        lectura: 'Si al consignatario no se le ha pagado, la devolución en caja revierte la venta sola. Si ya se le pagó, se usa «Cliente devolvió» para recuperar el dinero. Los incidentes bloquean la pieza hasta resolverse.',
        nodos: [
          { id: 'a', c: 0, r: 0, t: 'Venta', s: 'pieza vendida', sec: 'p4-revertida' },
          { id: 'b', c: 1, r: 0, t: 'Devolución', s: 'cliente final', sec: 'p4-revertida' },
          { id: 'c', c: 2, r: 0, t: '¿Ya se pagó?', s: 'al consignatario', sec: 'p4-revertida' },
          { id: 'd', c: 3, r: 0, t: 'Se revierte', s: 'automático', sec: 'p4-revertida' },
          { id: 'e', c: 2, r: 1, t: 'Cliente devolvió', s: 'en el perfil', sec: 'p4-devolvio' },
          { id: 'f', c: 3, r: 1, t: 'Recupera', s: 'cobro o saldo', sec: 'p4-devolvio' },
          { id: 'g', c: 0, r: 2, t: 'Incidente', s: 'daño, robo, reclamo', sec: 'p4-incidente' },
          { id: 'h', c: 1, r: 2, t: 'Bloqueada', s: 'no se vende', sec: 'p4-incidente' },
          { id: 'i', c: 2, r: 2, t: 'Investigación', s: 'y propuesta', sec: 'p4-incidente' },
          { id: 'j', c: 3, r: 2, t: 'Resolver', s: 'con efecto', sec: 'p4-resolver', fin: true }
        ],
        flechas: [
          { de: 'a', a: 'b' }, { de: 'b', a: 'c' }, { de: 'c', a: 'd', et: 'no' },
          { de: 'c', a: 'e', et: 'sí' }, { de: 'e', a: 'f' },
          { de: 'g', a: 'h' }, { de: 'h', a: 'i' }, { de: 'i', a: 'j' }
        ]
      },
      secciones: [
        {
          id: 'p4-clave', clave: true,
          nombre: 'Puntos clave del proceso',
          para: 'Se prueba con dos ventas devueltas: una antes de pagar al consignatario y otra después, y con un incidente de prueba.',
          puntos: [
            'Una devolución antes de pagar al consignatario regresa la pieza a la venta y cancela su pago.',
            'Una devolución después de pagar se resuelve con «Cliente devolvió» y recupera el dinero.',
            'Una pieza no auténtica recupera el dinero y queda bloqueada para siempre.',
            'Un incidente abierto bloquea la pieza para vender, liquidar y retirar.',
            'Resolver un incidente con compensación genera el pago al consignatario.'
          ]
        },
        {
          id: 'p4-revertida',
          nombre: 'Etapa 1 · Devolución antes de pagar al consignatario',
          donde: 'Devolución o cancelación en el punto de venta o en pedidos',
          para: 'Si la cuenta por pagar al consignatario no tiene pagos, la venta se revierte sola: se cancela el pago, la pieza vuelve a disponible, se republica y se avisa al consignatario.',
          puntos: [
            'La pieza vuelve a disponible y aparece de nuevo en el punto de venta.',
            'El pago pendiente al consignatario se cancela o sale del corte.',
            'El consignatario recibe el aviso.',
            'Con una pieza ya pagada, el consignatario no queda afectado hasta que se use «Cliente devolvió» (el equipo sabe que debe hacerlo).'
          ]
        },
        {
          id: 'p4-devolvio',
          nombre: 'Etapa 2 · «Cliente devolvió» (pieza ya pagada)',
          donde: 'Perfil del consignatario › pieza vendida o liquidada › «Cliente devolvió»',
          para: 'Dentro de política: recupera del consignatario el neto pagado con una cuenta por cobrar o descontándolo de su saldo, y la pieza vuelve a la venta. Fuera de política: la tienda se queda la pieza y no se le cobra al consignatario.',
          puntos: [
            'Dentro de política: se recupera el neto por el medio acordado y la pieza vuelve a la venta.',
            'Si el saldo no alcanza, el resto se cobra con cuenta por cobrar.',
            'Fuera de política: la pieza pasa al inventario propio y no se le cobra al consignatario.',
            'Se acordó qué pasa con la comisión del vendedor en una devolución.'
          ]
        },
        {
          id: 'p4-noautentica',
          nombre: 'Etapa 3 · Pieza no auténtica después de vendida',
          donde: 'Perfil del consignatario › pieza vendida › «No auténtica»',
          para: 'Recupera el neto pagado al consignatario siempre con cuenta por cobrar y bloquea la pieza de forma permanente.',
          puntos: [
            'Se genera el cobro por el neto pagado.',
            'La pieza queda bloqueada y no se puede volver a vender.',
            'El proceso con el cliente final (reembolso) está claro para el equipo.'
          ]
        },
        {
          id: 'p4-incidente',
          nombre: 'Etapa 4 · Reportar e investigar un incidente',
          donde: 'Consignación › Incidentes › «Reportar incidente» / «Cambiar estado»',
          para: 'Tipos: daño, mancha, alteración, pérdida, robo, discrepancia, reclamación del cliente o del consignatario. Severidad baja a crítica. Al abrirlo, la pieza queda bloqueada. Estados: abierto, en investigación, propuesta de resolución, aprobación, resuelto.',
          puntos: [
            'Se puede reportar un incidente desde la pieza con tipo y severidad.',
            'La pieza con incidente no se puede vender, liquidar ni retirar.',
            'Los estados reflejan cómo trabaja el cliente; se acordó quién aprueba.',
            'Se acordó si el consignatario debe recibir aviso del incidente (hoy no se le avisa).'
          ]
        },
        {
          id: 'p4-resolver',
          nombre: 'Etapa 5 · Resolver el incidente',
          donde: 'Consignación › Incidentes › «Resolver»',
          para: 'Compensación al consignatario genera una cuenta por pagar COMP- a 15 días. Merma, ajuste de liquidación, cargo a responsable y sin impacto solo se registran. La pieza se desbloquea si no tiene otros incidentes.',
          puntos: [
            'Resolver con compensación genera el pago al consignatario por el monto correcto.',
            'Los efectos que solo se registran (merma, cargo a responsable) se entienden y le sirven al cliente.',
            'Al resolver, la pieza se desbloquea.',
            'La cadena de custodia muestra el historial del incidente.'
          ]
        }
      ]
    },
    {
      id: 'p5',
      nombre: 'Saldo a favor y portal del consignatario',
      resumen: 'Pagar al consignatario con saldo a favor (con bono), cómo lo usa en la tienda, y el portal donde ve sus piezas, pagos y pide retiros.',
      tipos: TIPOS_FLUJO, cols: COLS_FLUJO,
      diagrama: {
        titulo: 'El consignatario cobra en dinero o en saldo, y lo sigue todo desde su portal',
        lectura: 'Al liquidar, el pago puede ir a saldo a favor (con bono) y el consignatario lo usa para comprar en la tienda. Desde su portal ve sus piezas y pagos, pide retiros y solicita cambios bancarios que la tienda aprueba.',
        nodos: [
          { id: 'a', c: 0, r: 0, t: 'Venta', s: 'pieza vendida', sec: 'p5-saldo' },
          { id: 'b', c: 1, r: 0, t: 'Liquidación', s: 'por pagar', sec: 'p5-saldo' },
          { id: 'c', c: 2, r: 0, t: 'Saldo a favor', s: '+ bono', sec: 'p5-saldo' },
          { id: 'd', c: 3, r: 0, t: 'Compra', s: 'en la tienda', sec: 'p5-mixto', fin: true },
          { id: 'e', c: 0, r: 1, t: 'Portal', s: 'enlace propio', sec: 'p5-portal' },
          { id: 'f', c: 1, r: 1, t: 'Retiro', s: 'solicitud', sec: 'p5-retiro' },
          { id: 'g', c: 2, r: 1, t: 'Bandeja', s: 'retiros', sec: 'p5-retiro' },
          { id: 'h', c: 1, r: 2, t: 'Datos bancarios', s: 'cambio', sec: 'p5-bancario' },
          { id: 'i', c: 2, r: 2, t: 'Aprobación', s: 'de la tienda', sec: 'p5-bancario' }
        ],
        flechas: [
          { de: 'a', a: 'b' }, { de: 'b', a: 'c', et: 'a saldo' }, { de: 'c', a: 'd' },
          { de: 'e', a: 'f' }, { de: 'f', a: 'g' },
          { de: 'e', a: 'h', dx: 40 }, { de: 'h', a: 'i' }
        ]
      },
      secciones: [
        {
          id: 'p5-clave', clave: true,
          nombre: 'Puntos clave del proceso',
          para: 'Se prueba con un consignatario que tenga una venta por liquidar y su portal abierto en un teléfono.',
          puntos: [
            'Liquidar a saldo deja el saldo correcto, con el bono acordado.',
            'El consignatario puede pagar una compra en la tienda con su saldo.',
            'El portal muestra sus piezas, pagos y contrato correctos.',
            'Una solicitud de retiro llega a la tienda y se atiende.',
            'Un cambio de datos bancarios no se aplica hasta que la tienda lo aprueba.'
          ]
        },
        {
          id: 'p5-saldo',
          nombre: 'Etapa 1 · Liquidar a saldo a favor',
          donde: 'Perfil del consignatario › tarjeta «Saldo a favor» › «Liquidar a saldo»',
          para: 'Marca la liquidación como pagada con saldo a favor, suma el bono configurado y avisa al consignatario. El saldo es el monedero del cliente (pesos 1:1) y lo que viene de consignación no caduca.',
          puntos: [
            'Liquidar a saldo marca el pago y la pieza como liquidada.',
            'El bono que se suma es el que el cliente ofrece.',
            'El consignatario recibe el aviso con su nuevo saldo.',
            'Se acordó si el reparto dinero/saldo se decide al liquidar (como hoy) o automático por contrato.'
          ]
        },
        {
          id: 'p5-mixto',
          nombre: 'Etapa 2 · Pago mixto y uso del saldo',
          donde: 'Liquidación «dividir pago»; punto de venta con método «Tarjeta de lealtad»',
          para: 'El pago mixto (saldo + otro método) no da bono. En el punto de venta el saldo se cobra con el método «Tarjeta de lealtad». El saldo también paga cobros pendientes (DEV-, FAKE-).',
          puntos: [
            'El pago mixto deja los montos correctos; el cliente sabe que no lleva bono.',
            'En el punto de venta el consignatario paga con su saldo y se descuenta bien.',
            'El saldo puede pagar un cobro pendiente y eso libera la firma de un nuevo contrato.'
          ]
        },
        {
          id: 'p5-portal',
          nombre: 'Etapa 3 · Portal del consignatario',
          donde: 'Perfil › «Portal del consignatario» (Generar, Copiar, WhatsApp, correo, QR, Rotar enlace, Revocar)',
          para: 'Enlace público propio del consignatario. Muestra saldo, pagado, por cobrar, sus productos, servicios, liquidaciones, contrato con días restantes, solicitud de retiro y datos de contacto y bancarios.',
          puntos: [
            'El enlace se envía por WhatsApp o correo y abre en el teléfono.',
            'El portal muestra datos correctos y fáciles de entender para el consignatario.',
            'Rotar o revocar el enlace deja de dar acceso al anterior.',
            'Se ve el último acceso y el número de accesos.'
          ]
        },
        {
          id: 'p5-retiro',
          nombre: 'Etapa 4 · Solicitud de retiro',
          donde: 'Portal › «Solicitar retiro»; tienda: Consignación › Solicitudes de retiro',
          para: 'La solicitud llega a la bandeja con estados solicitada, en proceso, entregada o cancelada. Marcarla como entregada no devuelve piezas: se devuelven una por una desde el perfil.',
          puntos: [
            'La solicitud del portal aparece en la bandeja.',
            'El equipo sabe que debe devolver las piezas desde el perfil (la bandeja no las devuelve).',
            'Se acordó cómo se entera la tienda de una solicitud nueva (hoy no hay aviso).'
          ]
        },
        {
          id: 'p5-bancario',
          nombre: 'Etapa 5 · Cambio de datos bancarios',
          donde: 'Portal (si está habilitado); tienda: alerta «Cambios bancarios por aprobar» › perfil › «Aprobar y aplicar» / «Rechazar»',
          para: 'El consignatario solicita el cambio (CLABE, tarjeta o cuenta) y queda pendiente hasta que la tienda lo aprueba. Viene apagado por defecto.',
          puntos: [
            'Se decidió si el consignatario puede cambiar sus datos bancarios desde el portal.',
            'El cambio queda pendiente y no se aplica hasta aprobarlo.',
            'Al aprobar o rechazar, el consignatario recibe aviso.'
          ]
        }
      ]
    },
    // La importación de consignatarios (antes «p6») queda fuera de la entrega
    // por decisión del cliente (19-oct-2026). Sus ids no se reutilizan.
    {
      id: 'p7',
      nombre: 'Dinámicas: lives y promociones',
      resumen: 'Vender piezas en lives, unboxings o campañas de WhatsApp y medir cuánto convierte cada dinámica.',
      tipos: TIPOS_FLUJO, cols: COLS_FLUJO,
      diagrama: {
        titulo: 'Una dinámica agrupa piezas para venderlas en vivo; no cambia su precio',
        lectura: 'Se crea la dinámica, se le asignan piezas disponibles y se venden por el punto de venta normal. Al finalizar, las no vendidas regresan y se mide la conversión.',
        nodos: [
          { id: 'a', c: 0, r: 0, t: 'Nueva dinámica', s: 'live, unboxing…', sec: 'p7-crear' },
          { id: 'b', c: 1, r: 0, t: 'Asignar piezas', s: 'disponibles', sec: 'p7-asignar' },
          { id: 'c', c: 2, r: 0, t: 'En vivo', s: 'venta por POS', sec: 'p7-venta' },
          { id: 'd', c: 3, r: 0, t: 'Finalizar', s: 'cierre', sec: 'p7-finalizar' },
          { id: 'e', c: 4, r: 0, t: 'Conversión', s: '% y monto', sec: 'p7-finalizar', fin: true },
          { id: 'f', c: 3, r: 1, t: 'Regresan', s: 'no vendidas', sec: 'p7-finalizar' }
        ],
        flechas: [
          { de: 'a', a: 'b' }, { de: 'b', a: 'c' }, { de: 'c', a: 'd' }, { de: 'd', a: 'e' },
          { de: 'd', a: 'f', et: 'no vendidas' }
        ]
      },
      secciones: [
        {
          id: 'p7-clave', clave: true,
          nombre: 'Puntos clave del proceso',
          para: 'Se prueba con una dinámica de 3 piezas: se vende una durante la dinámica y se finaliza.',
          puntos: [
            'Solo se pueden asignar piezas disponibles que no estén en otra dinámica.',
            'La pieza vendida durante la dinámica genera su pago al consignatario como cualquier venta.',
            'Al finalizar, las no vendidas regresan a disponibles.',
            'La conversión (vendidas, % y monto) coincide con lo que pasó.'
          ]
        },
        {
          id: 'p7-crear',
          nombre: 'Etapa 1 · Crear la dinámica',
          donde: 'Consignación › Dinámicas («Lives y dinámicas») › «Nueva dinámica»',
          para: 'Tipos: live, unboxing, WhatsApp o promoción; canales Instagram, Facebook, TikTok, WhatsApp u otro.',
          puntos: [
            'Los tipos y canales son los que el cliente usa.',
            'Crear una dinámica es rápido y claro para el equipo.'
          ]
        },
        {
          id: 'p7-asignar',
          nombre: 'Etapa 2 · Asignar piezas',
          donde: 'Dinámica › «Asignar pieza»',
          para: 'Solo admite piezas activas, disponibles o apartadas, sin bloqueo, que no estén por devolver ni en otra dinámica. Avisa al consignatario cuando su pieza se asigna o regresa.',
          puntos: [
            'Una pieza no disponible no se puede asignar y el mensaje es claro.',
            'El consignatario recibe aviso al asignar su pieza.',
            'Se acordó si al consignatario le conviene recibir este aviso.'
          ]
        },
        {
          id: 'p7-venta',
          nombre: 'Etapa 3 · Venta durante la dinámica',
          donde: 'Punto de venta normal',
          para: 'La dinámica no cambia precio ni comisión: la venta corre por el punto de venta normal y genera su liquidación como cualquier otra.',
          puntos: [
            'La venta se hace en el punto de venta sin pasos extra.',
            'Si el cliente quiere precio especial en la dinámica, quedó anotado (hoy no cambia el precio).'
          ]
        },
        {
          id: 'p7-finalizar',
          nombre: 'Etapa 4 · Finalizar y medir',
          donde: 'Dinámica › «Finalizar» / «Conversión»',
          para: 'Al finalizar, las vendidas quedan como vendidas y el resto regresa. Las estadísticas muestran participantes, vendidas, % de conversión y monto.',
          puntos: [
            'Las piezas no vendidas regresan a disponibles.',
            'La conversión cuenta solo lo vendido durante la dinámica.',
            'Las estadísticas le sirven al cliente para decidir su próxima dinámica.'
          ]
        }
      ]
    },
    // «Buscar en SACS» como acceso rápido (lista de Aaron Herzberg, 20-oct-2026):
    // los 10 puntos clave son las 10 etapas. En cada una se busca, se revisa la
    // vista previa sin abrir nada y se da clic para confirmar que lleva directo
    // al detalle.
    {
      id: 'p8',
      nombre: 'Buscar en SACS: acceso rápido',
      resumen: 'Confirmar que «Buscar en SACS» (la lupa junto al nombre de la cuenta, o Ctrl/⌘ + K) resuelve las consultas diarias de Vende Tu Closet con la Suite de Consignación prendida.',
      tipos: TIPOS_FLUJO, cols: COLS_FLUJO,
      diagrama: {
        titulo: 'Cada búsqueda se resuelve en la vista previa o con un clic al detalle',
        lectura: 'Se abre el buscador con la lupa o Ctrl/⌘ + K, se escribe o se escanea, la vista previa responde sin abrir nada y el clic lleva directo al detalle. Cada usuario solo ve los grupos de resultados de los módulos a los que tiene acceso.',
        nodos: [
          { id: 'a', c: 0, r: 0, t: 'Abrir', s: 'lupa o Ctrl/⌘ + K', sec: 'p8-clave' },
          { id: 'b', c: 1, r: 0, t: 'Buscar', s: 'texto o escáner', sec: 'p8-marca' },
          { id: 'c', c: 2, r: 0, t: 'Vista previa', s: 'sin abrir nada', sec: 'p8-consignataria' },
          { id: 'd', c: 3, r: 0, t: 'Clic', s: 'botón o renglón', sec: 'p8-permisos' },
          { id: 'e', c: 4, r: 0, t: 'Detalle', s: 'resaltado', sec: 'p8-permisos', fin: true },
          { id: 'f', c: 1, r: 1, t: 'Filtros', s: 'en la frase', sec: 'p8-marca' },
          { id: 'g', c: 3, r: 1, t: 'Permisos', s: 'por rol', sec: 'p8-permisos' }
        ],
        flechas: [
          { de: 'a', a: 'b' }, { de: 'b', a: 'c' }, { de: 'c', a: 'd' }, { de: 'd', a: 'e' },
          { de: 'b', a: 'f', et: 'marca, precio…' }, { de: 'd', a: 'g', et: 'según usuario' }
        ]
      },
      secciones: [
        {
          id: 'p8-clave', clave: true,
          nombre: 'Puntos clave del proceso',
          donde: 'La lupa junto al nombre de la cuenta, o Ctrl/⌘ + K, en app.sacscloud.com',
          para: 'Antes de la sesión, las mejoras del buscador deben estar publicadas en app.sacscloud.com. En cada etapa se busca, se revisa la vista previa sin abrir nada y se da clic para confirmar que lleva directo al detalle.',
          nota: 'Límite conocido: al buscar una venta por ticket, si sus piezas ya se le pagaron a la consignataria, solo aparecen las que siguen pendientes. El manual del buscador (botón «Manual» arriba del buscador) explica cada término y forma de búsqueda.',
          puntos: [
            'Las mejoras del buscador están publicadas en app.sacscloud.com.',
            'La lupa junto al nombre de la cuenta abre el buscador.',
            'Ctrl/⌘ + K abre el buscador desde cualquier pantalla.',
            'El botón «Manual» arriba del buscador abre la guía y el equipo sabe consultarla.',
            'El equipo entiende el límite de la búsqueda por ticket con piezas ya pagadas.'
          ]
        },
        {
          id: 'p8-consignataria',
          nombre: 'Etapa 1 · Encontrar a una consignataria',
          donde: 'Buscar en SACS › nombre, teléfono, correo, Instagram o folio CONS-',
          para: 'La vista previa muestra piezas en tienda, vendidas, saldo a favor, lo que se le debe, su próximo pago, su contrato vigente y sus retiros pendientes. Clic → su perfil.',
          nota: 'Caso de Vende Tu Closet: buscar a una consignataria activa por su nombre y luego por su teléfono; comparar los números con su perfil.',
          puntos: [
            'La encuentra por nombre.',
            'La encuentra por teléfono, correo, Instagram y folio CONS-.',
            'La vista previa muestra piezas en tienda, vendidas, saldo a favor, lo que se le debe, próximo pago, contrato vigente y retiros pendientes.',
            'Los números de la vista previa coinciden con su perfil.',
            'El clic abre su perfil.',
            'Se decidió con el cliente qué datos necesita ver la tienda en la tarjeta para no tener que abrir el perfil.'
          ]
        },
        {
          id: 'p8-codigo',
          nombre: 'Etapa 2 · Encontrar una pieza por código',
          donde: 'Buscar en SACS › SKU o código de barras con el lector',
          para: 'El SKU o el código de barras abre la ficha directo, con fotos, precio, comisión, lo que le toca a la consignataria y días a la venta; funciona aunque la pieza ya se haya pagado o devuelto.',
          nota: 'Caso de Vende Tu Closet: escanear la etiqueta de una pieza que está en tienda y de una que ya se vendió.',
          puntos: [
            'Escanear la etiqueta de una pieza en tienda abre su ficha directo.',
            'Escanear una pieza ya vendida también la encuentra.',
            'Una pieza pagada o devuelta también aparece.',
            'La ficha muestra fotos, precio, comisión, lo que le toca a la consignataria y días a la venta.',
            'Se confirmó qué código trae la etiqueta de la tienda y si el lector manda Enter al final.'
          ]
        },
        {
          id: 'p8-marca',
          nombre: 'Etapa 3 · Encontrar piezas por marca con filtros en la frase',
          donde: 'Buscar en SACS › marca + precio, estado y sucursal en la misma búsqueda',
          para: 'Ejemplos: «gucci menos de 15000 polanco», «chanel entre 10 mil y 20 mil», «vendidas», «apartadas».',
          nota: 'Caso de Vende Tu Closet: repetir las 3 búsquedas que más hace el equipo de piso y comparar contra el inventario.',
          puntos: [
            '«gucci menos de 15000 polanco» filtra por marca, precio y sucursal.',
            '«chanel entre 10 mil y 20 mil» entiende el rango de precio escrito así.',
            '«vendidas» y «apartadas» filtran por estado.',
            'Las 3 búsquedas más comunes del equipo de piso coinciden con el inventario.',
            'Se anotaron las búsquedas reales del día a día y los nombres de sucursal que usa el equipo.'
          ]
        },
        {
          id: 'p8-deuda',
          nombre: 'Etapa 4 · Lo que se le debe a las consignatarias',
          donde: 'Buscar en SACS › «vencido», «por pagar», «esta semana» o folio LIQ-',
          para: 'Muestra montos, vencimiento y pagos hechos. «Ir a pagar» abre esa liquidación en Cuentas por pagar.',
          nota: 'Caso de Vende Tu Closet: buscar «vencido» y abrir el pago de una liquidación vencida.',
          puntos: [
            '«vencido» muestra las liquidaciones vencidas con monto y vencimiento.',
            '«por pagar» y «esta semana» muestran lo que corresponde.',
            'Un folio LIQ- encuentra esa liquidación con sus pagos hechos.',
            '«Ir a pagar» abre esa liquidación en Cuentas por pagar.',
            'Se decidió quién del equipo paga y si esos montos los puede ver cualquier usuario.'
          ]
        },
        {
          id: 'p8-comprador',
          nombre: 'Etapa 5 · Cliente comprador y sus apartados',
          donde: 'Buscar en SACS › nombre o teléfono del cliente comprador',
          para: 'Muestra compras, último ticket y apartados con saldo y vencimiento. Clic en un apartado → ese apartado.',
          nota: 'Caso de Vende Tu Closet: buscar a una clienta con un apartado activo y abrirlo desde la vista previa.',
          puntos: [
            'La encuentra por nombre y por teléfono.',
            'La vista previa muestra compras, último ticket y apartados con saldo y vencimiento.',
            'El clic en un apartado abre ese apartado.',
            'Se decidió si el cajero debe ver el historial de compras de la clienta.'
          ]
        },
        {
          id: 'p8-lote',
          nombre: 'Etapa 6 · Lote y contrato',
          donde: 'Buscar en SACS › folio LOTE-',
          para: 'Muestra la consignataria, sus piezas por estado y su contrato (comisión, vence en N días). «Ver contrato» abre ese contrato y el botón de PDF lo descarga.',
          nota: 'Caso de Vende Tu Closet: buscar el lote de una consignataria con contrato por vencer y descargar su PDF.',
          puntos: [
            'El folio LOTE- muestra la consignataria y sus piezas por estado.',
            'Se ve el contrato con su comisión y los días para vencer.',
            '«Ver contrato» abre ese contrato.',
            'El botón de PDF descarga el contrato.',
            'Se decidió qué folio de lote usa la tienda hoy y si el contrato debe salir de aquí o solo del perfil.'
          ]
        },
        {
          id: 'p8-preparacion',
          nombre: 'Etapa 7 · Piezas en preparación',
          donde: 'Buscar en SACS › «por autenticar», «por limpiar», «por fotografiar», «por reparar», «por etiquetar» o «en proceso»',
          para: 'Muestra cuántos días lleva cada pieza y si ya pasó su meta. «Ver en la cola» abre la cola con la pieza resaltada.',
          nota: 'Caso de Vende Tu Closet: buscar «por autenticar» y confirmar que coincide con la cola de proceso.',
          puntos: [
            '«por autenticar» coincide con la cola de proceso.',
            'Las demás búsquedas por etapa («por limpiar», «por fotografiar», «por reparar», «por etiquetar», «en proceso») responden.',
            'Cada pieza muestra los días que lleva y si ya pasó su meta.',
            '«Ver en la cola» abre la cola con la pieza resaltada.',
            'Se definieron los días meta de cada etapa que la tienda va a exigir.'
          ]
        },
        {
          id: 'p8-estancadas',
          nombre: 'Etapa 8 · Piezas estancadas',
          donde: 'Buscar en SACS › «estancadas» o «louis vuitton +60 días»',
          para: 'Muestra las piezas que no se mueven, cuántos días llevan y la acción sugerida (rebajar o devolver).',
          nota: 'Caso de Vende Tu Closet: buscar «estancadas» y revisar si la lista coincide con lo que el equipo ya identifica.',
          puntos: [
            '«estancadas» muestra las piezas que no se mueven con sus días.',
            '«louis vuitton +60 días» combina marca y días.',
            'Cada pieza trae la acción sugerida (rebajar o devolver).',
            'La lista coincide con lo que el equipo ya identifica como estancado.',
            'Se definió cuántos días sin venderse hacen estancada a una pieza en Vende Tu Closet.'
          ]
        },
        {
          id: 'p8-hoy',
          nombre: 'Etapa 9 · Lo que hay que atender hoy',
          donde: 'Buscar en SACS › «retiros», «incidentes», «recuperaciones», «lives», folios DIN-, INC-, REC- o ticket (V-/VEN-)',
          para: 'Muestra el registro con su estado; el clic abre su pantalla con ese registro resaltado.',
          nota: 'Caso de Vende Tu Closet: buscar el ticket de una venta con piezas consignadas y luego «retiros».',
          puntos: [
            'El folio de un ticket (V-/VEN-) con piezas consignadas muestra la venta y sus piezas.',
            '«retiros» muestra las solicitudes con su estado.',
            '«incidentes», «recuperaciones» y «lives» responden.',
            'Los folios DIN-, INC- y REC- encuentran su registro.',
            'El clic abre la pantalla con ese registro resaltado.',
            'Se decidió quién atiende retiros e incidentes, para que solo esa persona vea esos accesos.'
          ]
        },
        {
          id: 'p8-permisos',
          nombre: 'Etapa 10 · Cada clic lleva al detalle, con los permisos de cada usuario',
          donde: 'Buscar en SACS › con un usuario de caja y con uno administrador',
          para: 'El resultado, sus botones, los renglones de la vista previa, las fotos de las piezas y «Ver más» abren el detalle de esa cosa; un usuario sin acceso a un módulo no ve ese grupo de resultados.',
          nota: 'Caso de Vende Tu Closet: repetir los puntos 1 a 9 con un usuario de caja y con uno administrador.',
          puntos: [
            'El resultado, sus botones, los renglones de la vista previa, las fotos y «Ver más» abren el detalle.',
            'Con el usuario de caja, los puntos 1 a 9 se comportan según sus permisos.',
            'Con el usuario administrador, los puntos 1 a 9 muestran todo.',
            'Un usuario sin acceso a un módulo no ve ese grupo de resultados.',
            'Se decidió qué ve cada rol en el buscador (montos por pagar, datos de contacto, contratos).'
          ]
        }
      ]
    },
    {
      id: "rep",
      nombre: "Dashboard y reportes",
      resumen: "Revisión del dashboard general y de los reportes especiales: qué se valida y qué campo, dato o filtro les falta.",
      tipos: TIPOS_REPORTE, cols: COLS_REPORTE,
      secciones: [
      {
        id: 'dashboard',
        nombre: 'Dashboard de consignación',
        donde: 'Consignación › Dashboard',
        para: 'La foto del negocio de consignación: alertas del día, cuánto hay en inventario, cuánto se ha vendido y cuánto se debe a los consignatarios.',
        hoy: ['Franja de alertas', 'Consignatarios activos', 'Valor de inventario', 'Vendido', 'Comisión del negocio', 'Por pagar a consignatarios', 'Saldo a favor', 'Contratos por vencer (30 d)', 'Incidentes abiertos', 'Productos por estado', 'Cargos por servicios', 'Top consignatarios por ventas', 'Antigüedad del inventario', 'Rendimiento por consignatario'],
        filtros: ['Sin filtros'],
        puntos: [
          'Abre sin errores y en un tiempo aceptable con el volumen real del cliente.',
          'Las alertas que aparecen son las que el cliente quiere ver; las que no le sirven se pueden apagar en Configuración.',
          '«Consignatarios activos» coincide con el conteo del cliente.',
          '«Valor de inventario» cuadra con la suma de precios de las piezas disponibles (el cliente entiende que es a precio de venta).',
          '«Vendido» y «Comisión del negocio» se entienden como cifras de todo el histórico (no del mes).',
          '«Por pagar a consignatarios» coincide con la suma de liquidaciones pendientes del perfil de cada consignatario.',
          '«Saldo a favor» coincide con el saldo de los consignatarios.',
          '«Contratos por vencer» coincide con los contratos que vencen en 30 días.',
          'Los rangos de antigüedad (0–30, 31–60, 61–90, más de 90 días) le sirven al cliente para decidir rebajas o devoluciones.',
          '«Rendimiento por consignatario» muestra a todos los consignatarios que el cliente espera ver.',
          'Las cifras se entienden sin explicación: el cliente sabe qué significa cada tarjeta.'
        ],
        sugerencias: [
          { tipo: 'Filtro', texto: 'Rango de fechas (hoy, semana, mes, año) para Vendido y Comisión del negocio.' },
          { tipo: 'Filtro', texto: 'Filtro por sucursal.' },
          { tipo: 'Filtro', texto: 'Filtro por consignatario y por vendedor.' },
          { tipo: 'Dato / cálculo', texto: 'Valor de inventario neto (lo que se pagaría al consignatario) y comisión potencial, además del precio de venta.' },
          { tipo: 'Gráfica / indicador', texto: 'Tarjeta «Pagado a consignatarios» en el periodo.' },
          { tipo: 'Otro', texto: 'Tocar una alerta o una fila para ir al detalle (lista de piezas, contratos o liquidaciones).' },
          { tipo: 'Exportación', texto: 'Exportar el dashboard a Excel o PDF.' },
          { tipo: 'Dato / cálculo', texto: 'Que los rangos de antigüedad se ajusten a los días de «estancado» que configura el cliente.' },
          { tipo: 'Gráfica / indicador', texto: 'Tendencia mensual de ventas y comisión.' }
        ]
      },
      {
        id: 'inicio',
        nombre: 'Dashboard de inicio · pestaña Consignación',
        donde: 'Inicio › Dashboard › pestaña Consignación',
        para: 'El resumen de consignación dentro del dashboard general, con periodo y sucursal.',
        hoy: ['Utilidad neta', 'Por liquidar', 'Ya liquidado', 'Por consignatario', 'Por sucursal', 'Cargos'],
        filtros: ['Periodo', 'Sucursal'],
        puntos: [
          'La pestaña Consignación aparece y carga con la suite activa.',
          'Al cambiar el periodo, todas las cifras cambian de acuerdo con él.',
          'Al cambiar la sucursal, las cifras corresponden solo a esa sucursal.',
          'Las cifras coinciden con las del Dashboard de consignación para el mismo periodo.',
          'La tabla por consignatario muestra comisión y monto liquidado reales (no en cero).',
          'La tabla por sucursal muestra valor consignado, productos activos y liquidaciones reales.',
          '«Por liquidar» y «Ya liquidado» respetan el periodo elegido.',
          'Contratos vencidos, devoluciones pendientes y piezas liberadas muestran cifras reales.'
        ],
        sugerencias: [
          { tipo: 'Gráfica / indicador', texto: 'Tendencia del valor de inventario consignado.' },
          { tipo: 'Filtro', texto: 'Filtro por consignatario.' },
          { tipo: 'Otro', texto: 'Tocar una cifra para ir al reporte de detalle.' }
        ]
      },
      {
        id: 'venta',
        nombre: 'Reporte · Venta por consignación',
        donde: 'Consignación › Reportes (también Reportes › Ventas › Venta por consignación)',
        para: 'Una fila por pieza vendida: cuánto se vendió, cuánto le toca al consignatario, la comisión y el estado de su pago.',
        hoy: ['Foto', 'ID', 'Consignatario', 'Comprador', 'Sucursal', 'Modelo', 'Total de venta', 'Total a recibir', 'Status', 'Días Status', 'Columnas opcionales: Tipo, Marca, Categoría, Cargos, % Comisión, Comisión $, Utilidad, Hora, Usuario, Almacén, Caja, Condición, Folio consignatario, Lote', 'Fila de totales', 'Vista Lista / Por Consignatario', 'Panel de detalle'],
        filtros: ['Fechas (máx. 40 días)', 'Sucursal', 'Almacén', 'Artículo', 'Consignatario', 'Categoría', 'Marca', 'Usuario', 'Caja', 'Estado de liquidación', 'Condición', 'Pestañas: Todos, Pendientes, Liquidados, Urgentes, Recientes', 'Buscador'],
        puntos: [
          'Carga las ventas del periodo y el total coincide con las ventas reales de piezas consignadas.',
          '«Total de venta», «Total a recibir», «Comisión $» y «Utilidad» cuadran a mano con una venta de ejemplo.',
          'La fila de TOTALES suma correctamente.',
          'La columna «Sucursal» muestra el nombre de la sucursal.',
          'Filtrar por sucursal deja solo las ventas de esa sucursal.',
          'Filtrar por almacén, artículo, usuario y caja cambia el resultado.',
          'Las columnas Usuario, Almacén y Caja traen dato.',
          '«Folio Consignatario» muestra el folio que conoce el cliente (CONS-…).',
          'Ordenar por fecha deja las ventas en orden cronológico correcto.',
          'El panel de detalle muestra datos reales de la pieza: días en consigna, historial de precios, actividad y vendedor.',
          'La suma de los cargos por tipo coincide con «Cargos Totales».',
          'El Excel exportado respeta todos los filtros aplicados en pantalla (sucursal, consignatario, búsqueda, pestañas).',
          'Las pestañas «Urgentes» (más de 15 días) y «Recientes» (7 días) usan los plazos que el cliente maneja.',
          'Los atajos del menú (Bolsos, Joyería, Relojes) corresponden a las categorías reales del cliente.',
          'La vista «Por Consignatario» muestra por pagar, liquidado y pago más antiguo correctos.',
          'Con un periodo de mucha venta, el reporte avisa si no está mostrando todo.'
        ],
        sugerencias: [
          { tipo: 'Campo / columna', texto: 'Fecha de venta como columna visible.' },
          { tipo: 'Campo / columna', texto: 'SKU como columna visible.' },
          { tipo: 'Campo / columna', texto: 'Vendedor (asesor) que hizo la venta.' },
          { tipo: 'Campo / columna', texto: 'Comisión del vendedor por pieza.' },
          { tipo: 'Campo / columna', texto: 'Folio de liquidación y fecha de pago al consignatario.' },
          { tipo: 'Campo / columna', texto: 'Folio de contrato.' },
          { tipo: 'Campo / columna', texto: 'Días en inventario (de la entrada a la venta).' },
          { tipo: 'Campo / columna', texto: 'Método de pago de la venta.' },
          { tipo: 'Campo / columna', texto: 'IVA de la venta.' },
          { tipo: 'Campo / columna', texto: 'Cargo de kit y cargo de reparación.' },
          { tipo: 'Filtro', texto: 'Rango de fechas mayor a 40 días (trimestre, año).' },
          { tipo: 'Filtro', texto: 'Filtro por vendedor.' },
          { tipo: 'Filtro', texto: 'Filtro por lote o por contrato.' },
          { tipo: 'Exportación', texto: 'Exportar a PDF.' },
          { tipo: 'Total / subtotal', texto: 'Subtotales por consignatario y por sucursal en la vista lista.' }
        ]
      },
      {
        id: 'estado-cuenta',
        nombre: 'Estado de cuenta del consignatario (PDF)',
        donde: 'Perfil del consignatario › Liquidaciones › Estado de cuenta',
        para: 'El documento que se le entrega al consignatario con lo vendido, lo pagado y lo pendiente.',
        hoy: ['Datos del consignatario', 'Resumen: Total vendido, Comisión, Cargos, Total a liquidar, Pagado, Pendiente', 'Detalle de ventas: Producto (SKU), Venta, Comisión (%), Servicios, Neto, Estado', 'Pagos realizados'],
        filtros: ['Sin filtros (todo el histórico)'],
        puntos: [
          'Se genera y se descarga sin errores.',
          'Los totales del resumen coinciden con la pestaña Liquidaciones del perfil.',
          'El detalle de ventas lista todas las piezas vendidas del consignatario.',
          'Los pagos realizados coinciden con los pagos registrados.',
          'El consignatario entiende el documento sin explicación.',
          'El documento lleva la marca del cliente y se ve profesional.'
        ],
        sugerencias: [
          { tipo: 'Filtro', texto: 'Elegir el periodo del estado de cuenta (mes, rango de fechas).' },
          { tipo: 'Campo / columna', texto: 'Fecha de venta por pieza.' },
          { tipo: 'Campo / columna', texto: 'Folio de liquidación en cada pago.' },
          { tipo: 'Campo / columna', texto: 'Lote y folio de contrato.' },
          { tipo: 'Dato / cálculo', texto: 'Saldo a favor del consignatario.' },
          { tipo: 'Dato / cálculo', texto: 'Piezas que siguen en inventario y piezas devueltas.' },
          { tipo: 'Exportación', texto: 'Versión en Excel.' },
          { tipo: 'Otro', texto: 'Enviar el estado de cuenta por correo o WhatsApp desde el mismo botón.' }
        ]
      },
      {
        id: 'liquidaciones',
        nombre: 'Liquidaciones y pagos a consignatarios',
        donde: 'Perfil del consignatario › Liquidaciones',
        para: 'Saber qué se debe, cuándo vence y pagarlo.',
        hoy: ['Por pagar al consignatario', 'Total a liquidar', 'Próximo pago', 'Vencimientos y conciliación', 'Pagar seleccionadas', 'Liquidar (dividir pago)', 'Pagadas — conciliación bancaria', 'Saldo a favor'],
        filtros: ['Por consignatario (una a la vez)'],
        puntos: [
          'Las liquidaciones pendientes del consignatario coinciden con sus ventas.',
          'Las fechas de pago corresponden a la regla del contrato.',
          'Pagar seleccionadas y pagar dividido funcionan y dejan el saldo correcto.',
          'La conciliación bancaria de lo pagado le sirve al cliente.',
          'El cliente puede ver, en un solo lugar, lo que debe a todos los consignatarios esta semana.'
        ],
        sugerencias: [
          { tipo: 'Otro', texto: 'Vista general de liquidaciones de todos los consignatarios (lista o calendario de vencimientos).' },
          { tipo: 'Filtro', texto: 'Filtros por fecha de vencimiento, estado (pendiente, vencida, pagada) y sucursal.' },
          { tipo: 'Total / subtotal', texto: 'Total a pagar por semana.' },
          { tipo: 'Exportación', texto: 'Exportar las liquidaciones a Excel para tesorería.' },
          { tipo: 'Campo / columna', texto: 'Datos bancarios (CLABE) del consignatario en la lista para pagar.' }
        ]
      },
      {
        id: 'utilidad-ventas',
        nombre: 'Reporte · Utilidad real de las ventas',
        donde: 'Reportes › Comparativo de ventas (sección de consignación)',
        para: 'Cuánto gana realmente el negocio con lo vendido, separando lo que es del consignatario.',
        hoy: ['Agrupar por: Mes, Día, Sucursal, Vendedor, Consignataria, Categoría, Marca, Producto', 'Aviso cuando se corta el resultado'],
        filtros: ['Periodo', 'Agrupación'],
        puntos: [
          'El cliente encuentra el reporte sin ayuda.',
          'La utilidad cuadra con la comisión del Dashboard para el mismo periodo.',
          'Cada agrupación muestra datos coherentes.',
          'El CSV se abre bien en Excel con acentos correctos.',
          'El aviso de resultado recortado se entiende.'
        ],
        sugerencias: [
          { tipo: 'Exportación', texto: 'Exportar a PDF.' },
          { tipo: 'Gráfica / indicador', texto: 'Gráfica de utilidad por mes.' },
          { tipo: 'Otro', texto: 'Acceso directo desde el menú Consignación.' }
        ]
      },
      {
        id: 'utilidad-cobros',
        nombre: 'Reporte · De lo cobrado, ¿cuánto es de las consignatarias?',
        donde: 'Reportes › Comparativo de cobros (sección de consignación)',
        para: 'Separar del dinero que entró a caja la parte que se le debe a los consignatarios.',
        hoy: ['Agrupar por: Método de pago, Mes, Día, Sucursal'],
        filtros: ['Periodo', 'Agrupación'],
        puntos: [
          'El total cobrado coincide con el corte de caja del periodo.',
          'La parte de consignatarias coincide con lo generado en liquidaciones.',
          'La separación por método de pago le sirve al cliente para conciliar.',
          'El CSV se abre bien en Excel.'
        ],
        sugerencias: [
          { tipo: 'Exportación', texto: 'Exportar a PDF.' },
          { tipo: 'Filtro', texto: 'Filtro por consignatario.' },
          { tipo: 'Otro', texto: 'Acceso directo desde el menú Consignación.' }
        ]
      },
      {
        id: 'incidentes',
        nombre: 'Incidentes',
        donde: 'Consignación › Incidentes',
        para: 'Seguimiento de piezas con problema: réplicas, daños, reclamos.',
        hoy: ['Abiertos', 'Críticos / alta', 'Total (filtro)'],
        filtros: ['Abiertos / Todos / Resueltos'],
        puntos: [
          'La lista muestra todos los incidentes del cliente.',
          'Los conteos de las tarjetas coinciden con la lista.',
          'Abrir un incidente muestra su detalle completo y su historial.',
          'Con muchos incidentes, la pantalla avisa si no está mostrando todos.'
        ],
        sugerencias: [
          { tipo: 'Filtro', texto: 'Rango de fechas.' },
          { tipo: 'Filtro', texto: 'Filtro por consignatario, tipo de incidente y sucursal.' },
          { tipo: 'Exportación', texto: 'Exportar a Excel.' },
          { tipo: 'Gráfica / indicador', texto: 'Resumen por tipo y por etapa, con monto de mermas.' }
        ]
      },
      {
        id: 'retiros',
        nombre: 'Solicitudes de retiro',
        donde: 'Consignación › Solicitudes de retiro',
        para: 'Atender lo que el consignatario pide desde su portal: retiros de piezas y cambios de datos.',
        hoy: ['Todas', 'Solicitadas', 'En proceso', 'Entregadas', 'Canceladas'],
        filtros: ['Por estado'],
        puntos: [
          'Una solicitud hecha desde el portal llega a la bandeja.',
          'Cambiar el estado de la solicitud se refleja para el consignatario.',
          'Con muchas solicitudes, la pantalla avisa si no está mostrando todas.'
        ],
        sugerencias: [
          { tipo: 'Campo / columna', texto: 'SKU y foto de las piezas solicitadas.' },
          { tipo: 'Filtro', texto: 'Rango de fechas y filtro por consignatario.' },
          { tipo: 'Exportación', texto: 'Exportar a Excel.' }
        ]
      },
      {
        id: 'faltantes',
        nombre: 'Reportes que el cliente necesita y hoy no tiene a la vista',
        donde: 'Por definir con el cliente',
        para: 'Revisar con el cliente qué otros reportes usa en su operación. El sistema ya calcula varios de estos datos; hace falta definir cuáles quiere ver en pantalla.',
        hoy: [],
        filtros: [],
        puntos: [
          'Se revisaron con el cliente los reportes que hoy lleva fuera del sistema (Excel, cuaderno).',
          'Quedó claro qué reporte usa cada persona del cliente (dueño, gerente, tesorería, vendedores).'
        ],
        sugerencias: [
          { tipo: 'Reporte nuevo', texto: 'Inventario consignado: piezas disponibles por consignatario, lote, sucursal y días en inventario.' },
          { tipo: 'Reporte nuevo', texto: 'Rentabilidad por consignatario: piezas recibidas, vendidas, % vendido, venta, ganancia y clasificación A/B/C.' },
          { tipo: 'Reporte nuevo', texto: 'Marcas que conviene aceptar: % vendido, días para vender, ticket promedio y rebajas por marca.' },
          { tipo: 'Reporte nuevo', texto: 'Inventario en riesgo: piezas estancadas, contrato por vencer y acción sugerida.' },
          { tipo: 'Reporte nuevo', texto: 'Descuentos: cuánto se rebajó, quién lo absorbió y quién lo autorizó, por vendedor.' },
          { tipo: 'Reporte nuevo', texto: 'Tiempos del proceso de ingreso: días por etapa y piezas atoradas.' },
          { tipo: 'Reporte nuevo', texto: 'Servicios: cobrado, costo, absorbido y margen por servicio y proveedor.' },
          { tipo: 'Reporte nuevo', texto: 'Flujo de pagos a consignatarios por semana de vencimiento.' },
          { tipo: 'Reporte nuevo', texto: 'Desempeño de vendedores: piezas, venta, ganancia, comisión, descuentos y captación.' },
          { tipo: 'Reporte nuevo', texto: 'Retención de consignatarios: quién vuelve a traer piezas después de cobrar.' },
          { tipo: 'Reporte nuevo', texto: 'Incidencias: réplicas, no aptas, devoluciones y monto recuperado.' }
        ]
      }

      ]
    }
  ]
};
