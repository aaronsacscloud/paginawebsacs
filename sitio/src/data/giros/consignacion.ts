/**
 * Contenido de la Suite para Tiendas de Consignación (preloved / segunda mano).
 *
 * El giro: la tienda vende piezas QUE NO SON SUYAS. Cada pieza tiene dueña con
 * nombre, comisión pactada por contrato, un ciclo de estados (custodia → venta
 * → vendida → liquidada) y una cuenta que rendir. El canal estrella es el Live.
 *
 * La Suite de Consignación es el corazón del giro y SE COTIZA APARTE — se dice
 * en cada bloque donde se vende. Los estados, el contrato con firma remota, las
 * dinámicas y el saldo a favor son el módulo REAL (sacs3/consignacion*).
 *
 * Padrón de la página: la tienda tiene UNA sucursal (así opera el ramo) y las
 * consignantes de ejemplo son Ana, Regina y Sofía. Comisión de ejemplo: 40% la
 * tienda / 60% la clienta (se pacta por contrato, pieza por pieza).
 */
import type { SuiteSeccion } from '../suite-ropa';

export const cortinaConsigna = {
  fotoAntes: '/images/suite-consig-hoy.webp',
  fotoDespues: '/images/suite-consig-resuelto.webp',
  altAntes: 'Dueña de una tienda de consignación entre bolsas y cajas de piezas recibidas, hojeando una libreta',
  altDespues: 'La misma dueña en el mostrador, enseñando en su tablet el estado de cuenta de una consignante',
  libreta: ['¿Qué le debo a Ana?', 'Bolsa camel — ¿de quién era?'],
  filas: [
    { que: 'Clóset de Ana · 12 piezas', donde: '6 vendidas', dato: '$4,140 a favor' },
    { que: 'Bolsa dorada · pieza única', donde: 'Apartada', dato: 'fuera de línea' },
    { que: 'Live del jueves · 18 piezas', donde: 'Se vendieron', dato: '7' },
  ],
};

/* ── Las cuatro situaciones de siempre en una consignación ── */
export const casosConsigna = [
  {
    id: 'maletas',
    titulo: 'Llega una clienta con dos maletas',
    texto:
      'Se valúa pieza por pieza, se pacta la comisión y el contrato sale con todo congelado: piezas, precios y porcentajes. Firma ahí mismo — o desde su casa, con un link que dura 48 horas.',
    remate: 'Sin contrato firmado no hay custodia: la pieza que se pierde sin papel se paga dos veces, en dinero y en confianza.',
    img: '/images/caso-consig-maletas.webp',
    alt: 'Clienta entregando prendas de sus maletas a la dueña de la tienda sobre el mostrador de recepción',
  },
  {
    id: 'live',
    titulo: 'El Live de los jueves',
    texto:
      'Programas la dinámica, le asignas las piezas y vendes en vivo. La pieza vendida se baja sola del catálogo y al final sabes qué se vendió, qué regresó y cuánto convirtió el Live.',
    remate: 'El Live vende en una noche lo de una semana — y sin control, también vende dos veces la misma pieza.',
    img: '/images/caso-consig-live.webp',
    alt: 'Vendedora transmitiendo un live de ventas con su celular en un aro de luz, mostrando una prenda',
  },
  {
    id: 'autentica',
    titulo: 'La bolsa que levanta dudas',
    texto:
      'La pieza dudosa se bloquea: no se puede vender ni apartar mientras se revisa. Si resulta no auténtica, sigue su propio camino — devolución, cargo o penalización — sin ensuciar el resto del clóset.',
    remate: 'Una sola pieza no auténtica vendida te cuesta la reputación que tardaste años en juntar.',
    img: '/images/caso-consig-autentica.webp',
    alt: 'Dueña examinando con cuidado los herrajes de un bolso de diseñador sobre el mostrador',
  },
  {
    id: 'cuenta',
    titulo: '"¿Ya se vendió algo mío?"',
    texto:
      'La consignante lo ve sola en su portal: qué sigue en piso, qué se vendió y cuánto tiene a favor. Y cuando toca liquidar, la mayoría prefiere dejarlo como saldo y estrenar de la tienda.',
    remate: 'Cada "déjame revisar y te aviso" es una consignante que la próxima vez lleva su clóset a otro lado.',
    img: '/images/caso-consig-cuenta.webp',
    alt: 'Consignante revisando en su celular el estado de cuenta de sus piezas en una cafetería',
  },
];

/* ── Cómo se implementa en una consignación ── */
export const pasosConsigna = [
  {
    cuando: 'Día 1', titulo: 'Tus piezas y tus consignantes, cargados',
    texto: 'Nos das tu lista y la subimos nosotros. No capturas nada.',
    detalle: 'Cada pieza con su dueña, su comisión y su estado — y los saldos a favor que ya debes, para no empezar con cuentas viejas en una libreta.',
    img: '/images/proc-consig-1.webp',
    alt: 'Consultor con laptop y la dueña revisando la lista de piezas consignadas junto al perchero',
  },
  {
    cuando: 'Día 2', titulo: 'Tu contrato y tus reglas',
    texto: 'Queda tu contrato, con tus comisiones y tus tiempos — no un machote genérico.',
    detalle: 'Los porcentajes por tipo de pieza, la vigencia, qué pasa con lo que no se vende y quién autoriza una rebaja.',
    img: '/images/proc-consig-2.webp',
    alt: 'Dueña y consultor revisando el formato del contrato de consignación en la oficina',
  },
  {
    cuando: 'Día 3', titulo: 'Capacitación',
    texto: 'Una sesión con tu equipo antes de abrir. Recibir un clóset y cobrar una pieza se aprende en la primera media hora.',
    detalle: 'Y se practica lo de diario: el alta con foto, el apartado y el Live con sus piezas asignadas.',
    img: '/images/proc-consig-3.webp',
    alt: 'Equipo de la tienda en capacitación alrededor del mostrador antes de abrir',
  },
  {
    cuando: 'Día 4', titulo: 'Arranca la tienda',
    texto: 'La tienda vende con SACS. El sistema viejo sigue en pie por si acaso.',
    detalle: 'Con los apartados vivos migrados y cada pieza en su estado real: la que estaba apartada sigue apartada.',
    img: '/images/proc-consig-4.webp',
    alt: 'Cajera cobrando la primera venta del día con una compañera acompañando',
  },
  {
    cuando: 'Día 5', titulo: 'La primera liquidación sin libreta',
    texto: 'A la semana, la primera consignante cobra — o deja su dinero como saldo — con su cuenta clara.',
    detalle: 'Y tú ves por primera vez tu comisión del periodo como un número, no como una corazonada.',
    img: '/images/proc-consig-5.webp',
    alt: 'Dueña de la tienda mostrando en su tablet el estado de cuenta a una consignante sonriente',
  },
];

/* ── El recorrido de funcionalidades (SuiteScroll) ── */
const est = {
  wrap: 'font-family:var(--font-body), system-ui, sans-serif;',
  h: 'font-size:11px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;',
  ok: 'background:var(--ok-fondo);color:var(--ok-texto);',
  lo: 'background:var(--aviso-fondo);color:var(--aviso-texto);',
};

export const seccionesConsigna: SuiteSeccion[] = [
  {
    id: 'contrato',
    tag: 'Alta y contrato',
    titulo: 'El clóset entra con contrato, no con confianza',
    texto:
      'Valúas pieza por pieza y el contrato sale con todo congelado: piezas, precios, comisiones y vigencia. Tu clienta firma en el mostrador o desde su casa, con un link que caduca a las 48 horas. Es la Suite de Consignación y se cotiza aparte de tu plan.',
    bullets: [
      'El contrato en PDF, con las piezas y su comisión — pareja o pieza por pieza',
      'Firma presencial o remota — sin perseguir a nadie con papeles',
      'Al firmar, el lote completo queda activo y en custodia',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Contrato 0214 · Clóset de Ana · 12 piezas · comisión pactada: 40%</p>
      ${[['Bolsa de piel camel','$2,800','40%'],['Vestido de seda negro','$1,450','40%'],['Zapatos de diseñador · del 24','$1,900','40%']]
        .map(([p,v,c])=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:6px;background:#fff;">
          <span style="font-size:12px;font-weight:700;color:var(--color-text-primary);">${p}</span>
          <span style="font-size:11px;color:var(--color-text-secondary);font-variant-numeric:tabular-nums;">${v}</span>
          <span style="font-size:11px;font-weight:800;color:var(--color-text-secondary);">comisión ${c}</span>
        </div>`).join('')}
      <div style="${est.ok}border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800;text-align:center;">Firmado a distancia · ayer 7:42 pm · lote activo</div>
    </div>`,
  },
  {
    id: 'estados',
    tag: 'La pieza única',
    titulo: 'Cada pieza sabe en qué parte de su vida va',
    texto:
      'Una pieza consignada no es "producto con existencia 1": es una pieza con dueña y con ciclo. El sistema la lleva de la recepción a la venta, de la venta a la liquidación — y la bloquea cuando algo no cuadra.',
    bullets: [
      'Recibida, disponible, apartada, vendida, liquidada',
      'La pieza dudosa se bloquea: ni se vende ni se aparta hasta resolverse',
      'La apartada se aparta de verdad — y se despublica en línea mientras tanto',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Bolsa de fiesta dorada · pieza única</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        ${[['Recibida','8 mayo','#FFFBEB','#B45309'],['Disponible','10 mayo','#ECFDF5','#047857'],['Apartada','ayer · fuera de línea','#EFF6FF','#2563EB'],['Vendida','—','#F5F3FF','#7C3AED']]
          .map(([e,f,bg,fg])=>`<div style="border:1px solid #E7EAF0;border-radius:10px;padding:9px 12px;background:${bg};">
          <div style="font-size:11.5px;font-weight:800;color:${fg};">${e}</div>
          <div style="font-size:10.5px;color:var(--color-text-tertiary);margin-top:2px;">${f}</div></div>`).join('')}
      </div>
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">La apartada se baja sola de la tienda en línea; al venderse pasa a vendida — y a liquidada cuando le pagas a su dueña</p>
    </div>`,
  },
  {
    id: 'lives',
    tag: 'Lives y dinámicas',
    titulo: 'El Live con sus piezas contadas',
    texto:
      'Programas el Live o el unboxing, le asignas piezas y vendes en vivo por donde ya vendes: Facebook, WhatsApp, Instagram o TikTok. Al final la dinámica te dice qué se vendió, qué regresó al piso y cuánto convirtió.',
    bullets: [
      'Las piezas del Live siguen vendibles — de eso se trata el Live',
      'La vendida se baja sola del catálogo y de la tienda en línea',
      'Conversión por dinámica: qué jueves vendió y cuál no',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Live del jueves · 8:00 pm</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
        ${[['Asignadas','18'],['Vendidas','7'],['Regresan al piso','11']]
          .map(([k,v])=>`<div style="border:1px solid #E7EAF0;border-radius:10px;padding:10px;background:#fff;text-align:center;">
          <div style="font-size:10px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;">${k}</div>
          <div style="font-size:16px;font-weight:800;color:var(--color-text-primary);">${v}</div></div>`).join('')}
      </div>
      <div style="${est.ok}border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800;text-align:center;">39% de conversión · $9,350 vendidos en una noche</div>
    </div>`,
  },
  {
    id: 'cuenta',
    tag: 'La cuenta clara',
    titulo: 'La cuenta se le rinde sola a cada clienta',
    texto:
      'La consignante ve su estado de cuenta en su portal: qué sigue en piso, qué se vendió y cuánto tiene a favor. Y al liquidar, la mayoría prefiere dejarlo como saldo — dinero que se queda en tu tienda.',
    bullets: [
      'Portal de la consignante: sus piezas y su saldo, sin llamarte',
      'Liquidas por transferencia o a saldo a favor, con bono si tú quieres',
      'El saldo se gasta en tienda: la que consigna también estrena',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Estado de cuenta · Ana · agosto</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        ${[['Piezas vendidas','6 de 12'],['Venta total','$6,900'],['Le toca (60%)','$4,140'],['Siguen en piso','6 piezas']]
          .map(([k,v])=>`<div style="border:1px solid #E7EAF0;border-radius:10px;padding:10px;background:#fff;">
          <div style="font-size:10px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;">${k}</div>
          <div style="font-size:14px;font-weight:800;color:var(--color-text-primary);">${v}</div></div>`).join('')}
      </div>
      ${[['Bolsa de piel camel','Vendida · 12 ago','le toca $1,680'],['Vestido de seda negro','Vendida · 19 ago','le toca $870'],['Abrigo de lana','Sigue en piso','—']]
        .map(([p2,e,m])=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:7px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:5px;background:#fff;">
          <span style="font-size:11.5px;font-weight:700;color:var(--color-text-primary);">${p2}</span>
          <span style="font-size:10.5px;color:var(--color-text-tertiary);">${e}</span>
          <span style="font-size:11px;font-weight:800;color:var(--color-text-secondary);font-variant-numeric:tabular-nums;">${m}</span>
        </div>`).join('')}
      <p style="margin:0 0 6px;font-size:10.5px;color:var(--color-text-tertiary);">…y las otras 9 piezas en su corte completo</p>
      <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:var(--color-text-primary);border-top:1px solid #E7EAF0;margin:6px 0 8px;padding-top:8px;"><span>A liquidar del corte</span><b style="font-variant-numeric:tabular-nums;">$4,140</b></div>
      <div style="${est.ok}border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800;text-align:center;">Prefirió saldo a favor · ya apartó una bolsa con él</div>
    </div>`,
  },
  {
    id: 'retiros',
    tag: 'Retiros',
    titulo: 'Lo que no se vendió se regresa sin pleito',
    texto:
      'Cuando vence la vigencia, armas la lista de retiro en un clic: qué piezas son, dónde están y en qué estado. La clienta recibe sus piezas con lista en mano y su cuenta queda cerrada — o el contrato se renueva y las piezas siguen.',
    bullets: [
      'Lista de retiro por consignante, pieza por pieza',
      'La pieza retirada sale de custodia con constancia',
      'Incidentes con su propio camino: pérdida, daño o disputa',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Retiro · Clóset de Regina · vigencia vencida</p>
      ${[['Abrigo de lana gris','Piso · perchero 3','regresa'],['Vestido rojo talla M','Bodega · caja 12','regresa'],['Cinturón de piel','Vendido el 12 ago','liquidar $312']]
        .map(([p,d,a])=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:6px;background:#fff;">
          <span style="font-size:12px;font-weight:700;color:var(--color-text-primary);">${p}</span>
          <span style="font-size:11px;color:var(--color-text-secondary);">${d}</span>
          <span style="${a==='regresa'?est.lo:est.ok}font-size:11px;font-weight:800;border-radius:999px;padding:3px 10px;">${a}</span>
        </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">2 piezas por entregar · y liquidando los $312, la cuenta cierra en cero</p>
    </div>`,
  },
];

/* ── El plano de la tienda de consignación ── */
export const planoConsigna = [
  {
    id: 'piso',
    nombre: 'Piso de venta',
    simbolo: 'rieles',
    foto: '/images/plano-consig-piso.webp',
    alt: 'Piso de venta de una tienda de consignación: percheros curados con piezas únicas y un exhibidor de bolsas',
    pie: 'Cada pieza del perchero es única — y cada una tiene dueña.',
    pregunta: '«¿Esta bolsa de quién es y desde cuándo está aquí?»',
    caja: { x: 68, y: 82, w: 216, h: 166 },
    items: [
      { t: 'Cada pieza con su dueña, su comisión y su fecha de entrada', suite: true },
      { t: 'Punto de venta que cobra la pieza única sin sobrevenderla' },
      { t: 'Apartado que bloquea la pieza de verdad', suite: true },
      { t: 'Cobra con tarjeta, efectivo o transferencia, sin terminal obligatoria' },
      { t: 'La pieza con más semanas en piso, a la vista', suite: true },
    ],
  },
  {
    id: 'recepcion',
    nombre: 'Recepción y valuación',
    ambito: 'Detrás del mostrador',
    simbolo: 'anaqueles',
    foto: '/images/plano-consig-recepcion.webp',
    alt: 'Mesa de valuación con una bolsa de diseñador, lupa, guantes y una tablet para el alta de piezas',
    pie: 'Aquí se decide qué entra, a qué precio y con qué comisión.',
    pregunta: '«¿Cuánto le pongo y cuánto me toca?»',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Alta con foto, condición y medidas de cada pieza', suite: true },
      { t: 'Contrato con las piezas y comisiones congeladas', suite: true },
      { t: 'Firma en el mostrador o remota, con link de 48 horas', suite: true },
      { t: 'La pieza dudosa se bloquea hasta revisarse', suite: true },
      { t: 'Etiquetas con código de barras al dar de alta' },
    ],
  },
  {
    id: 'bodega',
    nombre: 'Bodega',
    ambito: 'Detrás del mostrador',
    simbolo: 'anaqueles',
    foto: '/images/plano-consig-bodega.webp',
    alt: 'Bodega ordenada de una consignación con cajas etiquetadas y prendas enfundadas colgadas',
    pie: 'Lo que te dejaron en custodia y aún no sale al piso. Es de alguien.',
    pregunta: '«¿Dónde quedó el clóset que recibí el martes?»',
    caja: { x: 298, y: 208, w: 128, h: 96 },
    items: [
      { t: 'Custodia por lote y por consignante, desde la firma hasta el retiro', suite: true },
      { t: 'Lista de retiro cuando vence la vigencia', suite: true },
      { t: 'Incidentes: pérdida, daño o disputa, con su camino', suite: true },
      { t: 'Conteo físico desde el celular', plan: 'Controla' },
      { t: 'Kardex y trazabilidad de cada movimiento', plan: 'Controla' },
    ],
  },
  {
    id: 'mostrador',
    nombre: 'Mostrador',
    simbolo: 'mostrador',
    foto: '/images/plano-consig-mostrador.webp',
    alt: 'Mostrador de una tienda de consignación con tablet de cobro, bolsas de papel y una pieza en empaque',
    pie: 'La caja que no se detiene — y que sabe de quién es cada pieza.',
    pregunta: '«¿Le liquido a Ana hoy o le doy saldo?»',
    caja: { x: 68, y: 262, w: 216, h: 106 },
    items: [
      { t: 'Cobro normal: la comisión se reparte sola al vender', suite: true },
      { t: 'Liquidación por transferencia o a saldo a favor', suite: true },
      { t: 'El saldo se gasta en tienda, como cualquier pago', suite: true },
      { t: 'Ticket por WhatsApp y la caja cobra sin internet' },
      { t: 'Cortes de caja y arqueos, como en cualquier tienda' },
      { t: 'Registro de empleados, horarios, turnos y asistencia', extra: true },
    ],
  },
  {
    id: 'linea',
    nombre: 'En línea y en vivo',
    fuera: true,
    simbolo: 'paquetes',
    foto: '/images/plano-consig-linea.webp',
    alt: 'Rincón de transmisión con aro de luz y celular junto a una mesa de empaque de pedidos',
    pie: 'El Live, la tienda en línea y el portal de tus consignantes.',
    pregunta: '«¿La pieza del Live sigue disponible en línea?»',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Lives y dinámicas con piezas asignadas y conversión', suite: true },
      { t: 'Tienda en línea con el mismo inventario del piso' },
      { t: 'La pieza vendida se baja sola de todos los canales' },
      { t: 'Portal de la consignante: sus piezas y su saldo', suite: true },
      { t: 'WhatsApp, Instagram, Facebook y TikTok Shop' },
    ],
  },
];
