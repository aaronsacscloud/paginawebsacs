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
      secciones: [
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
        para: 'Si la pieza no se vende, el contrato vence: aviso, rebaja, renovación o devolución. El detalle completo está en el proceso 2.',
        puntos: [
          'El cliente entiende qué pasa con una pieza que no se vende y lo ve reflejado en el sistema.',
          'Una pieza vendida y pagada queda cerrada (liquidada) y no aparece como pendiente en ningún lado.'
        ]
      }

      ]
    },
    /*__PROCESOS__*/
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
