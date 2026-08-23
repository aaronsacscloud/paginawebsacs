/**
 * Contenido de la Suite para Papelerías y tiendas de arte.
 *
 * Lo que hace distinto a este giro y no se puede copiar de ningún otro: aquí
 * la unidad de trabajo no es el producto, es el RENGLÓN de una lista escolar
 * —"1 cuaderno profesional cuadro chico 100 h cosido"— que es texto escrito por
 * un maestro y que puede satisfacerse con dos o tres artículos distintos.
 *
 * Y hay un candado legal que manda sobre el diseño: Profeco es explícita en que
 * ninguna escuela puede exigir MARCA determinada ni obligar a comprar con un
 * proveedor o enlace específico. Por eso el kit tiene que ser opcional,
 * desglosable y con equivalencias — no es una función bonita, es lo que hace
 * legal el convenio con el colegio.
 *
 * El calendario manda: 35-45% de la venta anual en seis semanas, con el pico en
 * los doce días previos al inicio de clases. Pero la temporada NO se decide en
 * agosto: se decide en abril, cuando llega la lista, y se compra en mayo.
 *
 * Vocabulario del piso: renglón, profesional/francesa/italiana, rayado (raya,
 * cuadro grande 7 mm, cuadro chico 5 mm, doble raya), hojas (nunca páginas),
 * cosido/engrapado, gruesa (144), saldo (no "obsoleto"), engargolado, enmicado,
 * marcatextos, plumón, colores, clic de copiadora, medio mayoreo.
 */

/* ── Recorrido de funcionalidades ── */
const est = {
  wrap: 'font-family:var(--font-body), system-ui, sans-serif;',
  h: 'font-size:11px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;',
  ok: 'background:var(--ok-fondo);color:var(--ok-texto);',
  lo: 'background:var(--aviso-fondo);color:var(--aviso-texto);',
};

export interface SuiteSeccion {
  id: string;
  tag: string;
  titulo: string;
  texto: string;
  bullets?: string[];
  visual: string;
}

export const seccionesPapeleria: SuiteSeccion[] = [
  {
    id: 'renglon',
    tag: 'Listas escolares',
    titulo: 'La lista no es un producto: son renglones',
    texto:
      'El colegio escribe "1 cuaderno profesional cuadro chico 100 h cosido". Eso no es un artículo: es un renglón que se puede surtir con dos o tres. Cada renglón se amarra a sus equivalentes —económico, sugerido, premium— y el papá elige, que además es lo que la ley exige: ninguna escuela puede imponer marca ni proveedor.',
    bullets: [
      'Captura por colegio y grado, heredando la lista del ciclo anterior',
      'Cada renglón con sus artículos equivalentes y su nivel de precio',
      'Kit armado a precio cerrado, o surtido suelto por el piso',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Renglón 14 · Secundaria 1º · Colegio del Valle</p>
      <div style="border:1px solid var(--color-border-light);border-radius:11px;padding:12px 13px;margin-bottom:10px;">
        <div style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">“1 cuaderno profesional cuadro chico 100 h cosido”</div>
        <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;margin-top:3px;">como lo escribió el colegio</div>
      </div>
      ${[['Económico','cosido pasta flexible','$38'],['Sugerido','cosido pasta dura','$52'],['Premium','cosido pasta dura, hoja de 75 g','$74']]
        .map(([n,d,p]:any)=>`<div style="display:flex;align-items:center;gap:11px;border:1px solid var(--color-border-light);border-radius:11px;padding:10px 13px;margin-bottom:7px;">
          <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">${n}</div>
          <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">${d}</div></div>
          <span style="font-size:13.5px;font-weight:800;color:var(--color-text-primary);">${p}</span>
        </div>`).join('')}
      <p style="margin:12px 0 0;font-size:11px;color:var(--color-text-tertiary);">Los tres cumplen el renglón: profesional, cuadro chico, 100 h y cosido. Lo único que cambia es la marca — y ésa la elige quien compra, no el colegio.</p>
    </div>`,
  },
  {
    id: 'quitar',
    tag: 'Listas escolares',
    titulo: '“Esa ya la tengo”',
    texto:
      'El papá llega con la lista y tres cosas de la casa. Puede quitarlas del kit y el precio baja solo, con el renglón marcado como no surtido — para que en la mesa de armado nadie lo empaque. Lo que se quita se descuenta antes de la caja, no se discute en la caja.',
    bullets: [
      'Quitar renglones del kit desde la vitrina pública, con el precio recalculado',
      'El renglón quitado no se surte: sale del armado y de la orden de compra',
      'Y si el kit va a precio cerrado, agregar queda bloqueado y quitar no',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Lista de Sofía · Primaria 3º</p>
      ${[['Cuaderno forma italiana cuadro grande 100 h × 4','$176','sí',''],['Colores 12 largos','$96','sí',''],['Mochila','$540','no','ya la tiene'],['Juego de geometría','$78','no','ya lo tiene'],['Pegamento blanco 225 g','$62','sí','']]
        .map(([n,p,s,r]:any)=>`<div style="display:flex;align-items:center;gap:11px;border-bottom:1px solid var(--color-border-light);padding:10px 0;">
          <div style="flex:1;"><div style="font-size:12.5px;font-weight:${s==='sí'?'700':'600'};color:${s==='sí'?'var(--color-text-primary)':'var(--color-text-tertiary)'};text-decoration:${s==='sí'?'none':'line-through'};">${n}</div>
          ${r?`<div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">${r}</div>`:''}</div>
          <span style="font-size:13px;font-weight:700;color:${s==='sí'?'var(--color-text-primary)':'var(--color-text-tertiary)'};">${p}</span>
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:11px;border-top:1px dashed var(--color-border-light);">
        <span style="font-size:12px;font-weight:800;color:var(--color-text-primary);">Se lleva</span>
        <span style="font-size:15px;font-weight:800;color:var(--color-text-primary);">$334</span>
      </div>
    </div>`,
  },
  {
    id: 'faltante',
    tag: 'Multisucursal',
    titulo: 'El faltante de $12 que se lleva la lista de $2,800',
    texto:
      'Falta un renglón y el papá se va a completar a otro lado — y se lleva la lista entera, no el renglón. En más de la mitad de los casos la pieza sí existe en la cadena, en la sucursal de enfrente, que entrega mañana contra los cinco días del proveedor.',
    bullets: [
      'Existencia de todas las sucursales desde el mostrador',
      'Traspaso entre tiendas antes de pedirle al proveedor',
      'Pendiente por surtir con folio, y aviso por WhatsApp cuando llega',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Cuaderno cuadro chico 100 h cosido</p>
      ${[['Centro','aquí',0,true],['Del Valle','a 15 min',34,false],['Satélite','a 40 min',12,false],['Coapa','a 25 min',0,false]]
        .map(([n,d,q,aqui]:any)=>`<div style="border:1px solid ${aqui?'var(--alerta-borde)':'var(--color-border-light)'};background:${aqui?'var(--alerta-fondo)':'#fff'};border-radius:11px;padding:11px 13px;margin-bottom:7px;display:flex;align-items:center;gap:11px;">
          <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">${n}</div>
          <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;">${d}</div></div>
          <span style="font-size:14px;font-weight:800;color:${q>0?'var(--ok-texto)':'var(--alerta-texto)'};">${q}</span>
        </div>`).join('')}
      <p style="margin:12px 0 0;font-size:11px;color:var(--color-text-tertiary);">46 piezas en la cadena. Ninguna donde está el papá.</p>
    </div>`,
  },
  {
    id: 'compra',
    tag: 'Compras',
    titulo: 'La lista llegó en mayo y la compra se puso en marzo',
    texto:
      'Los dos hechos están al revés, y por eso se compra lo que no piden y falta lo que sí. Con las listas capturadas, la demanda se explota sola: renglón por alumnos por colegio, menos lo que ya tienes en las sucursales, y lo que queda es la orden de compra.',
    bullets: [
      'Requerimiento agregado por artículo, sumando todos los colegios',
      'Se resta la existencia de todas las tiendas antes de pedir',
      'Órdenes de compra por proveedor, con recepción contra la orden',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Cuaderno cuadro chico · 9 colegios</p>
      ${[['Requerimiento de las listas','4,180 pz','var(--color-text-primary)'],['Existencia en las 4 tiendas','−1,340 pz','var(--ok-texto)'],['Por comprar','2,840 pz','var(--color-text-primary)']]
        .map(([a,b,c]:any)=>`<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--color-border-light);padding:11px 0;">
          <span style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">${a}</span>
          <span style="font-size:13.5px;font-weight:800;color:${c};">${b}</span>
        </div>`).join('')}
      <p style="margin:12px 0 0;font-size:11px;color:var(--color-text-tertiary);">Sin esto se pide de más y aun así falta: son dos errores, no uno.</p>
    </div>`,
  },
  {
    id: 'saldo',
    tag: 'Inventario',
    titulo: 'Lo que sobra en octubre no caduca: se queda parado',
    texto:
      'Un cuaderno no se echa a perder. El problema es el capital detenido y el metro de anaquel que ocupa hasta el julio siguiente. Y hay dos sobrantes distintos: el genérico, que regresa a piso y se vende todo el año, y el específico de un colegio, que si no se remata en septiembre ya se remató en pérdida.',
    bullets: [
      'Cuántos meses lleva cada artículo sin venderse, en toda la cadena',
      'Alertas de exceso y de existencia baja por sucursal',
      'Un precio de remate propio, sin mover el de mostrador',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Cierre al 30 de septiembre</p>
      ${[['Genérico · regresa a piso','$1,440,000','se vende de octubre a mayo','var(--ok-texto)'],['Específico de colegio','$960,000','si no se remata ahora, se remata perdiendo','var(--alerta-texto)']]
        .map(([a,b,c,col]:any)=>`<div style="border:1px solid var(--color-border-light);border-radius:11px;padding:12px 13px;margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;">
            <span style="font-size:12.5px;font-weight:700;color:var(--color-text-primary);">${a}</span>
            <span style="font-size:14px;font-weight:800;color:${col};">${b}</span></div>
          <div style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:600;margin-top:3px;">${c}</div>
        </div>`).join('')}
      <p style="margin:12px 0 0;font-size:11px;color:var(--color-text-tertiary);">A costo, no a precio de lista. Saldo, no merma: la merma es lo roto o lo robado, y es otra cuenta.</p>
    </div>`,
  },
  {
    id: 'servicios',
    tag: 'Servicios',
    titulo: 'La copiadora no es un producto: es un contrato',
    texto:
      'Copias, engargolado, enmicado y empastado sostienen el valle de octubre a febrero, con margen alto. Pero la copiadora se renta y se paga por clic, así que el margen del rincón no es precio menos costo: es precio menos clic —que ya trae tóner y servicio—, menos el arillo, y menos el excedente cuando te pasas de los clics que la renta incluye.',
    bullets: [
      'Los servicios se cobran en la misma caja y en el mismo ticket',
      'Costeo y utilidad por servicio, no sólo por producto',
      'Control de gastos para la renta y el consumible',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Engargolado carta · 120 hojas</p>
      ${[['Precio al público','$85',''],['Clics (120 a $0.28)','−$34',''],['Arillo, mica y pasta','−$14',''],['Excedente de clics sobre la renta','−$6','']]
        .map(([a,b]:any)=>`<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--color-border-light);padding:9px 0;">
          <span style="font-size:12.5px;font-weight:600;color:var(--color-text-secondary);">${a}</span>
          <span style="font-size:13px;font-weight:700;color:var(--color-text-primary);">${b}</span>
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:11px;border-top:1px dashed var(--color-border-light);">
        <span style="font-size:12px;font-weight:800;color:var(--color-text-primary);">Te queda</span>
        <span style="font-size:15px;font-weight:800;color:var(--ok-texto);">$31 · 36%</span>
      </div>
    </div>`,
  },
];

/* ── El antes y el después ── */
export const cortinaPapeleria = {
  eyebrow: 'La misma pregunta, dos veces',
  titulo: '“¿Tiene el de cuadro chico?”',
  sub: 'Baja y la línea se mueve sola — o arrástrala tú. A la izquierda, cómo se responde en agosto. A la derecha, en tres segundos.',
  fotoAntes: '/images/suite-pap-hoy.webp',
  fotoDespues: '/images/suite-pap-resuelto.webp',
  altAntes: 'Empleada de papelería buscando en el anaquel con la lista del colegio en la mano',
  altDespues: 'La misma empleada en el mostrador, con la existencia de las otras tiendas en la tablet',
  libreta: ['Cuadro chico 100 h… ¿queda?', '¿Y en Del Valle?'],
  pieAntes: 'Ir al anaquel, no encontrarlo,<br />y que el papá se lleve la lista completa.',
  filas: [
    { que: 'Cuaderno cuadro chico 100 h', donde: 'Del Valle', dato: '34' },
    { que: 'Colores 12 largos', donde: 'Aquí', dato: '61' },
    { que: 'Juego de geometría', donde: 'Satélite', dato: '12' },
  ],
  pieDespues: 'Se traspasa hoy y se entrega mañana.',
};

/* ── Los cuatro momentos del año ── */
export const casosPapeleria = [
  {
    id: 'regreso',
    titulo: 'Los doce días antes del primer día de clases',
    texto:
      'Del 19 al 30 de agosto se hace el año. La caja no puede detenerse, el papá de la fila no puede esperar a que alguien vaya al anaquel, y lo que falta aquí se busca primero en las otras tiendas — no con el proveedor, que en agosto entrega en cinco días.',
    remate: 'Seis semanas traen entre el 35% y el 45% de la venta anual. El pico son doce días.',
    img: '/images/caso-pap-regreso.webp',
    alt: 'Fila de padres en el mostrador de una papelería en agosto, con las listas en la mano',
  },
  {
    id: 'lista',
    titulo: 'La lista llega en mayo y hay que capturarla completa',
    texto:
      'Nueve colegios por doce grados por treinta y cinco renglones son casi cuatro mil renglones. Pero siete de cada diez no cambian contra el ciclo pasado: se heredan y sólo se tocan los que el maestro movió.',
    remate: 'Capturar de cero son doce jornadas. Heredando, son tres — y la orden de compra sale dos semanas antes.',
    img: '/images/caso-pap-lista.webp',
    alt: 'Empleada capturando la lista de un colegio en la computadora de la trastienda',
  },
  {
    id: 'armado',
    titulo: 'En junio la bodega deja de ser bodega',
    texto:
      'Se vuelve línea de armado: paquetes por colegio y por grado, etiquetados con el nombre del alumno y estibados por fecha de entrega. Lo que un papá quitó de su lista no se empaca, y eso tiene que verse en la mesa, no en la caja.',
    remate: 'Dos personas arman entre cuarenta y sesenta paquetes al día. La cuenta del viernes no puede llevarse en un pizarrón.',
    img: '/images/caso-pap-armado.webp',
    alt: 'Dos empleados armando paquetes escolares en la mesa de la trastienda',
  },
  {
    id: 'octubre',
    titulo: 'Llega octubre y aparece lo que sobró',
    texto:
      'La venta escolar se muere y el negocio se sostiene con servicios y con la oficina. Ahí se ve el tamaño del sobrante — y hay dos: el genérico, que regresa a piso, y el específico de un colegio, que si no se remata en septiembre ya se remató tarde.',
    remate: 'Un cuaderno no caduca. Lo que cuesta es el capital detenido hasta el julio siguiente.',
    img: '/images/caso-pap-octubre.webp',
    alt: 'Empleado revisando cajas de mercancía de temporada en los racks de la bodega',
  },
];

/* ── Los cinco días de la implementación ── */
export const pasosPapeleria = [
  {
    cuando: 'Día 1', titulo: 'Tu catálogo, cargado',
    texto: 'Nos das tu archivo o tu base actual y lo subimos nosotros. No capturas nada.',
    detalle: 'Con la presentación de compra y la de venta: la gruesa de 144 entra y el lápiz sale por pieza; el bulto de cartulina entra y sale por pliego.',
    img: '/images/proc-pap-1.webp',
    alt: 'Consultor con laptop y una empleada revisando el anaquel durante la carga del catálogo',
  },
  {
    cuando: 'Día 2', titulo: 'Tus colegios y tus listas',
    texto: 'Se cargan los colegios con los que ya trabajas y las listas del ciclo pasado.',
    detalle: 'Y se pueden heredar en abril: sólo se tocan los renglones que el maestro cambió.',
    img: '/images/proc-pap-2.webp',
    alt: 'Dueña de la papelería y un consultor revisando las listas de los colegios en la oficina',
  },
  {
    cuando: 'Día 3', titulo: 'Capacitación',
    texto: 'Una sesión con tu equipo antes de abrir. Cobrar y buscar un renglón se aprende en la primera media hora.',
    detalle: 'Y se practica lo de agosto: el kit, el desglose de lo que el papá ya tiene y el pendiente por surtir.',
    img: '/images/proc-pap-3.webp',
    alt: 'Equipo de una papelería en capacitación alrededor del mostrador antes de abrir',
  },
  {
    cuando: 'Día 4', titulo: 'Abre una sucursal',
    texto: 'Arranca la primera tienda, acompañada. Si algo se atora, estamos en la línea.',
    detalle: 'Ese día se cobra, se surte una lista, se factura y se cierra la caja — pero con alguien al lado.',
    img: '/images/proc-pap-4.webp',
    alt: 'Empleada cobrando en el mostrador acompañada por un compañero el primer día',
  },
  {
    cuando: 'Día 5', titulo: 'Abren las demás',
    texto: 'Con lo aprendido en la primera, las otras entran el mismo día.',
    detalle: 'Y desde ese momento el mostrador ve la existencia de toda la cadena, que es lo que salva agosto.',
    img: '/images/proc-pap-5.webp',
    alt: 'Dueña de una cadena de papelerías recorriendo los pasillos, revisando el inventario en su tablet',
  },
];

/**
 * El plano de la papelería.
 *
 * Las zonas son las del oficio y el eje es el CALENDARIO: la misma bodega que
 * en octubre guarda saldo, en junio es una línea de armado con dos personas
 * empacando paquetes por colegio. Por eso la zona se llama por las dos cosas.
 *
 * Lo marcado como complemento son las listas escolares: es un módulo aparte y
 * se cotiza aparte. Lo demás entra con el plan.
 */
export const planoPapeleria = [
  {
    id: 'mostrador',
    nombre: 'Mostrador',
    simbolo: 'mostrador',
    foto: '/images/plano-pap-mostrador.webp',
    alt: 'Mostrador de una papelería en agosto, con padres formados y la lista en la mano',
    pie: 'En agosto es el cuello de botella del negocio: por aquí pasan todos los tickets.',
    pregunta: '«Es 27 de agosto, hay ocho en la fila y se cayó el internet. ¿Sigo cobrando?»',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Punto de venta que sigue cobrando sin conexión' },
      { t: 'Kit escolar a precio cerrado, cobrado en tres minutos', suite: true },
      { t: 'Quitar del kit lo que el papá ya tiene, con el precio recalculado', suite: true },
      { t: 'Factura desde la caja, sin anotar el RFC en una libreta' },
      { t: 'Corte de caja y arqueo automáticos al cerrar' },
    ],
  },
  {
    id: 'piso',
    nombre: 'Piso de venta',
    simbolo: 'gondolas',
    foto: '/images/plano-pap-piso.webp',
    alt: 'Pasillo de una papelería con góndolas de cuadernos y un papá recorriendo con su lista',
    pie: 'Camina la lista en la mano. Aquí se decide si la completa o no.',
    pregunta: '«¿Por qué el anaquel se ve lleno y el cuaderno de cuadro chico ya no hay?»',
    caja: { x: 68, y: 82, w: 216, h: 166 },
    items: [
      { t: 'Existencia por marca, rayado y número de hojas' },
      { t: 'La misma existencia de todas las tiendas, desde el piso', plan: 'Controla' },
      { t: 'Traspaso entre tiendas antes de pedirle al proveedor', plan: 'Controla' },
      { t: 'Conteo desde el celular, sin cerrar la tienda', plan: 'Controla' },
      { t: 'Venta por pliego, por medio pliego y por pieza, del mismo bulto' },
    ],
  },
  {
    id: 'servicios',
    nombre: 'Servicios',
    ambito: 'El rincón de la copiadora',
    simbolo: 'copiado',
    foto: '/images/plano-pap-servicios.webp',
    alt: 'Rincón de servicios de una papelería con copiadora, guillotina y engargoladora',
    pie: 'Lo que sostiene el valle de octubre: copias, engargolado, enmicado y empastado.',
    pregunta: '«¿Cuántos clics llevo este mes y a cómo me salió cada copia con todo y renta?»',
    caja: { x: 298, y: 208, w: 128, h: 96 },
    items: [
      { t: 'El servicio se cobra en la misma caja y en el mismo ticket' },
      { t: 'Costeo y utilidad por servicio, no sólo por producto', plan: 'Controla' },
      { t: 'Control de gastos para la renta y el consumible', plan: 'Controla' },
      { t: 'Cotizaciones para el trabajo grande' },
      { t: 'El trabajo que se deja y se recoge: folio, anticipo y aviso cuando está listo' },
    ],
  },
  {
    id: 'bodega',
    nombre: 'Bodega y armado',
    ambito: 'Detrás del mostrador',
    simbolo: 'armado',
    foto: '/images/plano-pap-bodega.webp',
    alt: 'Mesa de armado de paquetes escolares en la trastienda, con dos empleados empacando',
    pie: 'De mayo a julio deja de ser bodega: es la línea que arma los paquetes.',
    pregunta: '«¿Cuántos paquetes llevamos armados y cuántos faltan para la entrega del sábado?»',
    caja: { x: 68, y: 262, w: 216, h: 106 },
    items: [
      { t: 'Avance del armado por colegio y por grado', suite: true },
      { t: 'Lo que el papá quitó no se empaca ni se compra', suite: true },
      { t: 'Recepción de la entrega contra la orden de compra', plan: 'Controla' },
      { t: 'Cuántos meses lleva cada artículo sin venderse en la cadena', plan: 'Controla' },
      { t: 'Alertas de existencia baja y de exceso', plan: 'Controla' },
    ],
  },
  {
    id: 'linea',
    nombre: 'En línea',
    fuera: true,
    simbolo: 'paquetes',
    foto: '/images/plano-pap-linea.webp',
    alt: 'Empleada leyendo en su celular la foto de una lista que llegó de noche, con el inventario abierto en la tablet',
    pie: 'La lista llega como foto de WhatsApp a las once de la noche. Ahí también se vende.',
    pregunta: '«¿Cuántas listas nos mandaron por WhatsApp que nunca contestamos?»',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Vitrina pública de la lista: el papá la arma desde su teléfono', suite: true },
      { t: 'Tienda en línea con el mismo inventario del mostrador' },
      { t: 'WhatsApp, Instagram, Facebook y TikTok Shop' },
      { t: 'Conciliación de los pedidos que juntó el colegio, contra lo entregado', suite: true },
      { t: 'Perfil del cliente con lo que compró y en qué colegio', plan: 'Fideliza' },
    ],
  },
];

/**
 * Los ocho renglones de la lista de Sofía, para el bloque propio.
 *
 * Cada uno es texto del colegio con dos o tres artículos que lo cumplen: misma
 * especificación, distinta marca o calidad. Ésa es la equivalencia legal —
 * cambiar el rayado o el encuadernado no es equivalencia, es otro producto, y
 * la escuela lo rebota.
 *
 * Un renglón trae faltante a propósito: es el argumento del giro. El de $12
 * que se lleva la lista completa.
 */
export const listaPapeleria = [
  {
    texto: '5 cuadernos profesional cuadro chico 100 h cosido',
    ops: [
      { nombre: 'Económico', detalle: 'cosido, pasta flexible', precio: 190 },
      { nombre: 'Sugerido', detalle: 'cosido, pasta dura', precio: 260 },
      { nombre: 'Premium', detalle: 'cosido, pasta dura, hoja de 75 g', precio: 370 },
    ],
  },
  {
    texto: '2 cuadernos forma italiana cuadro grande 100 h',
    ops: [
      { nombre: 'Económico', detalle: 'engrapado', precio: 62 },
      { nombre: 'Sugerido', detalle: 'cosido', precio: 88 },
    ],
  },
  {
    texto: '1 caja de colores de madera, 24 largos',
    ops: [
      { nombre: 'Económico', detalle: 'caja de cartón', precio: 96 },
      { nombre: 'Sugerido', detalle: 'caja de lata, mina suave', precio: 168 },
      { nombre: 'Premium', detalle: 'mina de 3.3 mm, resistente al agua', precio: 295 },
    ],
    faltante: { donde: 'Del Valle', piezas: 34 },
  },
  {
    texto: '1 juego de geometría con escuadras de 45 y 60',
    ops: [
      { nombre: 'Económico', detalle: 'acrílico, 4 piezas', precio: 45 },
      { nombre: 'Sugerido', detalle: 'acrílico rígido, con transportador de 180°', precio: 78 },
    ],
  },
  {
    texto: '1 pegamento blanco de 225 g',
    ops: [
      { nombre: 'Económico', detalle: 'de 110 g, alcanza medio ciclo', precio: 34 },
      { nombre: 'Sugerido', detalle: 'de 225 g', precio: 62 },
    ],
  },
  {
    texto: '4 marcatextos de colores surtidos',
    ops: [
      { nombre: 'Económico', detalle: 'punta de cincel', precio: 48 },
      { nombre: 'Sugerido', detalle: 'punta doble, tinta de secado rápido', precio: 92 },
    ],
  },
  {
    texto: '1 paquete de 100 hojas blancas, tamaño carta',
    ops: [
      { nombre: 'Económico', detalle: 'de 75 g', precio: 38 },
      { nombre: 'Sugerido', detalle: 'de 90 g, para pluma de gel', precio: 55 },
    ],
  },
  {
    texto: '1 mochila con carro',
    ops: [
      { nombre: 'Económico', detalle: 'poliéster, un compartimento', precio: 420 },
      { nombre: 'Sugerido', detalle: 'refuerzo en costuras, garantía de un ciclo', precio: 690 },
      { nombre: 'Premium', detalle: 'espalda acojinada y ruedas de goma', precio: 1120 },
    ],
  },
];

/**
 * La matriz del cuaderno, para SuiteVariantes.
 *
 * Es el caso de libro del giro: "un cuaderno" no es un producto, es forma ×
 * rayado. Y la forma es mexicana —profesional, francesa, italiana—, no ISO:
 * quien escribe A4 en un catálogo de papelería ya perdió al lector.
 *
 * Los ceros no son huecos: en italiana no se hace doble raya, y el blanco de
 * dibujo casi no se pide en profesional. Un cero en una casilla que ese
 * formato no lleva es normal, igual que en la corrida de calzado.
 */
export const variantesPapeleria = {
  ejeA: ['Raya', 'Cuadro 7 mm', 'Cuadro 5 mm', 'Doble raya', 'Blanco'],
  matriz: [
    [42, 68, 96, 0, 14],
    [31, 55, 40, 22, 0],
    [18, 47, 12, 0, 26],
  ],
  filas: [
    { nombre: 'Profesional', img: '/images/prod-cuaderno-profesional.webp', alt: 'Cuaderno profesional cosido, de pasta lisa' },
    { nombre: 'Francesa', img: '/images/prod-cuaderno-francesa.webp', alt: 'Cuaderno forma francesa cosido, de pasta lisa' },
    { nombre: 'Italiana', img: '/images/prod-cuaderno-italiana.webp', alt: 'Cuaderno forma italiana, apaisado, cosido' },
  ],
  leyendas: ['En anaquel', 'Queda una o dos', 'Sin existencia'],
};
