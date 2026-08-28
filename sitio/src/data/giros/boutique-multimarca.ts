/**
 * Contenido de la Suite para Boutiques Multimarca.
 *
 * El giro: una tienda que vende MARCAS DE OTROS. Compra en la expo dos veces
 * al año y con proveedores locales cada semana; recibe mercancía en firme y a
 * consignación; y su decisión diaria no es "¿qué producto?" sino "¿qué marca
 * merece la percha?". Todo el texto habla de eso.
 *
 * Regla de contenido: NADA genérico y NADA de marcas reales de terceros — se
 * dice "el proveedor de León" o "la marca de mezclilla", nunca un nombre.
 * Padrón de sucursales de la página: Centro · Del Valle · Querétaro.
 */
import type { SuiteSeccion } from '../suite-ropa';

export const cortinaMulti = {
  fotoAntes: '/images/suite-multi-hoy.webp',
  fotoDespues: '/images/suite-multi-resuelto.webp',
  altAntes: 'Dueña de una boutique multimarca entre cajas recién llegadas, revisando notas de proveedor en papel',
  altDespues: 'La misma dueña en el mostrador, revisando en su tablet qué marca se vendió en la semana',
  libreta: ['¿Cuánto le toca al de GDL?', 'Vestidos consigna — ¿cuántos van?'],
  filas: [
    { que: 'Mezclilla recto 28 · firme', donde: 'Centro', dato: '6' },
    { que: 'Vestido consigna · proveedor GDL', donde: 'Del Valle', dato: '7 vend.' },
    { que: 'Por liquidar · proveedor GDL', donde: 'Corte de agosto', dato: '$18,400' },
  ],
};

/* ── Las cuatro situaciones del año en una boutique multimarca ── */
export const casosMulti = [
  {
    id: 'recepcion',
    titulo: 'Llegaron tres proveedores el mismo martes',
    texto:
      'Cada uno con su nota y ninguno con código de barras. Se recibe contra tu pedido — o contra la nota del proveedor cuando no lo hubo —, se imprimen las etiquetas ahí mismo y cada prenda entra con su marca, su costo y su talla.',
    remate: 'Lo que se etiqueta mal se pierde dos veces: en el conteo y en el margen.',
    img: '/images/caso-multi-recepcion.webp',
    alt: 'Empleada de boutique etiquetando prendas recién llegadas junto a cajas abiertas de distintos proveedores',
  },
  {
    id: 'expo',
    titulo: 'Vas a la expo a comprar la temporada',
    texto:
      'Antes de firmar pedidos, sabes qué marca te dejó margen y cuál sigue colgada de la temporada pasada. El porcentaje vendido de cada marca viaja contigo en el celular.',
    remate: 'La compra de la expo se decide en dos días y se carga seis meses.',
    img: '/images/caso-multi-expo.webp',
    alt: 'Dueña de boutique caminando por el pasillo de una expo de moda con el celular en la mano',
  },
  {
    id: 'consigna',
    titulo: 'El proveedor pregunta cuánto se vendió de lo suyo',
    texto:
      'El inventario distingue lo tuyo de lo que está a consignación. El corte por proveedor dice qué se vendió, qué queda y cuánto le toca — sin contar percha a mano.',
    remate: 'Una consigna sin corte claro termina en una discusión — y en un proveedor menos.',
    img: '/images/caso-multi-consigna.webp',
    alt: 'Dueña de boutique mostrando una tablet a un proveedor junto a un perchero de vestidos',
  },
  {
    id: 'look',
    titulo: 'La clienta se lleva el look de tres marcas',
    texto:
      'El vestido es de una marca, el bolso de otra y los aretes de una tercera. Un solo ticket, y cada venta le abona a la cuenta de su marca y de su proveedor.',
    remate: 'La multimarca vende combinaciones que ninguna marca sola puede armar. Ese es el negocio.',
    img: '/images/caso-multi-look.webp',
    alt: 'Vendedora cobrando en el mostrador un conjunto de prendas y accesorios de distintas marcas',
  },
];

/* ── Cómo se implementa, con lo que de verdad se carga en una multimarca ── */
export const pasosMulti = [
  {
    cuando: 'Día 1', titulo: 'Tu surtido, cargado',
    texto: 'Nos das tu archivo o tus notas de proveedor y lo subimos nosotros. No capturas nada.',
    detalle: 'Cada prenda con su marca, su proveedor, su costo y su talla — y separado lo firme de lo que está a consignación.',
    img: '/images/proc-multi-1.webp',
    alt: 'Consultor con laptop y la dueña de la boutique revisando notas de proveedor sobre el mostrador',
  },
  {
    cuando: 'Día 2', titulo: 'Tus proveedores, configurados',
    texto: 'Queda como ya trabajas con cada uno, no como el sistema quiere.',
    detalle: 'Quién te deja consigna y quién vende en firme, los plazos de pago de cada uno y quién puede autorizar un descuento.',
    img: '/images/proc-multi-2.webp',
    alt: 'Dueña de boutique y consultor revisando condiciones de proveedores en la oficina de la tienda',
  },
  {
    cuando: 'Día 3', titulo: 'Capacitación',
    texto: 'Una sesión con tu equipo antes de abrir. Cobrar y buscar una talla se aprende en la primera media hora.',
    detalle: 'Y se practica lo de diario: etiquetar una entrega, el cambio de talla y el apartado con abonos.',
    img: '/images/proc-multi-3.webp',
    alt: 'Equipo de la boutique en capacitación alrededor del mostrador antes de abrir',
  },
  {
    cuando: 'Día 4', titulo: 'Arranca la tienda',
    texto: 'La boutique vende con SACS. El sistema viejo sigue en pie por si acaso.',
    detalle: 'Con sus apartados vivos ya migrados y las consignas con su saldo al día.',
    img: '/images/proc-multi-4.webp',
    alt: 'Cajera cobrando la primera venta del día en la boutique con un acompañante del equipo',
  },
  {
    cuando: 'Día 5', titulo: 'El primer corte por marca',
    texto: 'A la semana ya sabes qué marca vendió y cuál no — con datos, no de memoria.',
    detalle: 'Y con la liquidación de cada consigna lista para cuando el proveedor pase a cobrar.',
    img: '/images/proc-multi-5.webp',
    alt: 'Dueña de la boutique revisando en su tablet el corte de venta por marca en la trastienda',
  },
];

/* ── El recorrido de funcionalidades (SuiteScroll) ── */
const est = {
  wrap: 'font-family:var(--font-body), system-ui, sans-serif;',
  h: 'font-size:11px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;',
  ok: 'background:var(--ok-fondo);color:var(--ok-texto);',
  lo: 'background:var(--aviso-fondo);color:var(--aviso-texto);',
  zero: 'background:var(--color-bg-primary);color:#D4D4D4;',
};

export const seccionesMulti: SuiteSeccion[] = [
  {
    id: 'marca',
    tag: 'Inventario',
    titulo: 'Cada prenda sabe de qué marca y de qué proveedor es',
    texto:
      'La mercancía entra con marca, proveedor, costo y talla. Desde ese momento todo se puede leer por marca: qué hay, qué se vendió y qué se quedó.',
    bullets: [
      'Existencia por marca y por talla, en cada tienda',
      'El costo de cada proveedor, aunque el mismo tipo de prenda venga de tres',
      'Buscas "mezclilla 28" y ves las opciones de todas tus marcas juntas',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Existencia · mezclilla recto · talla 28</p>
      <table style="width:100%;border-collapse:separate;border-spacing:4px;font-size:12px;">
        <tr><th style="text-align:left;font-size:10.5px;color:var(--color-text-tertiary);">Marca</th>
        <th style="font-size:10.5px;color:var(--color-text-tertiary);">Centro</th>
        <th style="font-size:10.5px;color:var(--color-text-tertiary);">Del Valle</th>
        <th style="font-size:10.5px;color:var(--color-text-tertiary);">Querétaro</th>
        <th style="font-size:10.5px;color:var(--color-text-tertiary);">Costo</th></tr>
        ${[['De Torreón · firme',6,3,2,'$412'],['De CDMX · consigna',2,0,1,'$358'],['De Puebla · firme',0,4,3,'$390']]
          .map(([m,a,b,q,c]:any)=>`<tr><td style="font-size:11px;font-weight:700;color:var(--color-text-primary);">${m}</td>
          <td style="${a===0?est.zero:(a<=2?est.lo:est.ok)}border-radius:8px;height:30px;text-align:center;font-weight:800;">${a}</td>
          <td style="${b===0?est.zero:(b<=2?est.lo:est.ok)}border-radius:8px;height:30px;text-align:center;font-weight:800;">${b}</td>
          <td style="${q===0?est.zero:(q<=2?est.lo:est.ok)}border-radius:8px;height:30px;text-align:center;font-weight:800;">${q}</td>
          <td style="text-align:center;font-size:11px;color:var(--color-text-secondary);font-variant-numeric:tabular-nums;">${c}</td></tr>`).join('')}
      </table>
      <p style="margin:12px 0 0;font-size:11px;color:var(--color-text-tertiary);">Tres proveedores del mismo tipo de prenda, cada uno con su costo</p>
    </div>`,
  },
  {
    id: 'etiquetado',
    tag: 'Recepción',
    titulo: 'La mercancía llega sin código. Sale etiquetada.',
    texto:
      'Recibes contra tu pedido — o contra la nota, cuando no lo hubo —, capturas lo que de verdad llegó y las etiquetas con código de barras se imprimen ahí mismo. La prenda queda lista para el piso.',
    bullets: [
      'Etiquetas con tu código, tu precio y la talla, al momento de recibir',
      'Lo que llegó de menos queda registrado frente a la nota del proveedor',
      'El costo entra bien desde el día uno — el margen ya no se adivina',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Recepción · proveedor de Torreón · nota 4218</p>
      ${[['Mezclilla recto 26–34','12 pedidas','12 recibidas','ok'],['Blusa bordada S–XL','18 pedidas','15 recibidas','lo'],['Chamarra corta M–XL','8 pedidas','8 recibidas','ok']]
        .map(([p,a,b,s]:any)=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:6px;background:#fff;">
          <span style="font-size:12px;font-weight:700;color:var(--color-text-primary);">${p}</span>
          <span style="font-size:11px;color:var(--color-text-tertiary);">${a}</span>
          <span style="${s==='ok'?est.ok:est.lo}font-size:11px;font-weight:800;border-radius:999px;padding:3px 10px;">${b}</span>
        </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">35 etiquetas listas para imprimir · faltante descontado de la nota</p>
    </div>`,
  },
  {
    id: 'consigna',
    tag: 'Proveedores',
    titulo: 'Lo firme y la consigna, cada quien con su cuenta',
    texto:
      'El inventario distingue qué es tuyo y qué te dejaron a consignación. Cuando el proveedor pasa, el corte está listo: qué se vendió, qué queda y cuánto le toca. Es la Suite de Consignación y se cotiza aparte de tu plan.',
    bullets: [
      'Inventario por proveedor, con lo vendido y lo que queda en piso',
      'La liquidación sale del sistema, no de contar percha un domingo',
      'Lo que no rotó se regresa con lista en mano, prenda por prenda',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Corte de consigna · proveedor de GDL · agosto</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
        ${[['Dejó','34 piezas'],['Se vendieron','11'],['Quedan','23']]
          .map(([k,v])=>`<div style="border:1px solid #E7EAF0;border-radius:10px;padding:10px;background:#fff;text-align:center;">
          <div style="font-size:10px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;">${k}</div>
          <div style="font-size:16px;font-weight:800;color:var(--color-text-primary);">${v}</div></div>`).join('')}
      </div>
      <div style="${est.ok}border-radius:10px;padding:10px 12px;font-size:12px;font-weight:800;text-align:center;">A liquidar: $18,400 según su acuerdo · pasa el viernes</div>
    </div>`,
  },
  {
    id: 'margen',
    tag: 'Dirección',
    titulo: 'Qué marca te deja — y cuál solo ocupa percha',
    texto:
      'Costeo y utilidad por prenda, leídos por marca. La rotación y el margen juntos dicen a qué proveedor le recompras en la expo y a cuál le regresas la consigna.',
    bullets: [
      'Vendido por marca: cuánto llevas de lo que te surtió — comprado o dejado',
      'Margen real por marca, con el costo que de verdad pagaste',
      'ABC de marcas: la A se resurte, la C se remata o se regresa',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Venta por marca · agosto</p>
      ${[['Mezclilla de Torreón · firme','$59,800','62% de su compra','ok'],['Vestidos GDL · consigna','$28,900','32% de lo que dejó','ok'],['Trajes de baño · consigna','$6,100','18% de lo que dejó','lo']]
        .map(([m,v,s,t]:any)=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:6px;background:#fff;">
          <span style="font-size:12px;font-weight:700;color:var(--color-text-primary);">${m}</span>
          <span style="font-size:11px;color:var(--color-text-secondary);font-variant-numeric:tabular-nums;">${v}</span>
          <span style="${t==='ok'?est.ok:est.lo}font-size:11px;font-weight:800;border-radius:999px;padding:3px 10px;">${s}</span>
        </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">Un 18% vendido a las 12 semanas en piso ya no se recupera solo: se remata o se regresa</p>
    </div>`,
  },
  {
    id: 'canales',
    tag: 'Canales',
    titulo: 'La misma percha, también en línea',
    texto:
      'Tienda en línea, WhatsApp, Instagram, Facebook y TikTok Shop venden del mismo inventario del piso. La prenda de consigna que se vende en línea también le abona a su proveedor.',
    bullets: [
      'Un solo inventario para el piso y todos los canales',
      'La venta en línea baja la talla exacta de la tienda correcta',
      'Ticket por WhatsApp y la caja cobra sin internet',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Vestido bordado · talla M · una sola existencia</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        ${[['Piso de venta','Vendida 2:14 pm','ok'],['Tienda en línea','Se ocultó sola 2:14 pm','ok'],['WhatsApp','"¿Sigue disponible?" → No','lo'],['TikTok Shop','Sin sobreventa','ok']]
          .map(([c,e,t]:any)=>`<div style="border:1px solid #E7EAF0;border-radius:10px;padding:10px;background:#fff;">
          <div style="font-size:10px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;">${c}</div>
          <div style="font-size:11.5px;font-weight:700;color:${t==='ok'?'var(--ok-texto)':'var(--aviso-texto)'};margin-top:3px;">${e}</div></div>`).join('')}
      </div>
      <div style="margin-top:8px;border:1px solid #E7EAF0;border-radius:10px;padding:9px 12px;background:#fff;">
        <div style="font-size:10px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;margin-bottom:5px;">Movimientos de la talla M</div>
        ${[['2:14 pm','Venta en piso · Centro','−1'],['11:03 am','Apartado en línea · Del Valle','−1'],['Ayer','Consigna recibida · el de GDL','+2']]
          .map(([h,e2,d])=>`<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-secondary);padding:2px 0;"><span>${h} · ${e2}</span><b style="font-variant-numeric:tabular-nums;">${d}</b></div>`).join('')}
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:var(--color-text-primary);border-top:1px solid #E7EAF0;margin-top:5px;padding-top:5px;"><span>Disponible ahora</span><b>0 · oculta en línea</b></div>
      </div>
    </div>`,
  },
];

/* ── El plano de la boutique multimarca ── */
export const planoMulti = [
  {
    id: 'piso',
    nombre: 'Piso de venta',
    simbolo: 'rieles',
    foto: '/images/plano-multi-piso.webp',
    alt: 'Piso de venta de una boutique multimarca: percheros con prendas de distintas marcas y una mesa de accesorios',
    pie: 'Cada perchero es una marca distinta — y cada prenda sabe de cuál es.',
    pregunta: '«¿Cuánta percha le doy a cada marca?»',
    caja: { x: 68, y: 82, w: 216, h: 166 },
    items: [
      { t: 'Punto de venta con la matriz de tallas y colores de cada prenda' },
      { t: 'Existencia por marca, talla y color, en cada tienda', plan: 'Controla' },
      { t: 'Venta por marca: qué perchero produce y cuál no', plan: 'Controla' },
      { t: 'Conteo desde el celular, sin cerrar la tienda', plan: 'Controla' },
      { t: 'Looks de varias marcas como kit, en un solo ticket' },
    ],
  },
  {
    id: 'probador',
    nombre: 'Probadores',
    simbolo: 'probadores',
    foto: '/images/plano-multi-probador.webp',
    alt: 'Probadores de una boutique multimarca con cortinas y un espejo de cuerpo entero',
    pie: 'Aquí se arma el look: el vestido de una marca, el bolso de otra.',
    pregunta: '«Le quedó chica. ¿La tienes de otra marca?»',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'La misma prenda en tus otras marcas, sin dejar a la clienta' },
      { t: 'Apartado con anticipo; los abonos, desde Controla', plan: 'Controla' },
      { t: 'Cambio de talla o color, aunque venga de otra tienda', plan: 'Controla' },
      { t: 'Vale a favor cuando no está su talla', plan: 'Controla' },
      { t: 'Cambio sin ticket físico', plan: 'Fideliza' },
    ],
  },
  {
    id: 'trastienda',
    nombre: 'Trastienda',
    ambito: 'Detrás del mostrador',
    simbolo: 'anaqueles',
    foto: '/images/plano-multi-trastienda.webp',
    alt: 'Trastienda de una boutique con cajas de proveedores, prendas por etiquetar y un escritorio con laptop',
    pie: 'Aquí se recibe, se etiqueta y se decide qué marca sigue.',
    pregunta: '«¿Qué le debo a cada proveedor y qué me dejó cada marca?»',
    caja: { x: 298, y: 208, w: 128, h: 96 },
    items: [
      { t: 'Recepción contra tu pedido y etiquetado con código de barras', plan: 'Controla' },
      { t: 'Inventario por proveedor: lo firme y la consigna', suite: true },
      { t: 'Costeo y utilidad por prenda y por marca', plan: 'Controla' },
      { t: 'Cuentas por pagar: qué le debes a cada proveedor y cuándo', plan: 'Controla' },
      { t: 'Registro de empleados, horarios, turnos y asistencia', extra: true },
    ],
  },
  {
    id: 'mostrador',
    nombre: 'Mostrador',
    simbolo: 'mostrador',
    foto: '/images/plano-multi-mostrador.webp',
    alt: 'Mostrador de cobro de una boutique multimarca con bolsas de papel y una tablet como punto de venta',
    pie: 'La caja que no se detiene, ni en sábado ni sin internet.',
    pregunta: '«Es sábado, hay fila y se cayó el internet.»',
    caja: { x: 68, y: 262, w: 216, h: 106 },
    items: [
      { t: 'Punto de venta que sigue cobrando sin conexión' },
      { t: 'Corte de caja y arqueo automáticos al cerrar' },
      { t: 'Ticket por WhatsApp' },
      { t: 'Factura desde la caja, sin anotar el RFC en una libreta' },
      { t: 'Corte ciego: el cajero no sabe cuánto debe haber', plan: 'Fideliza' },
    ],
  },
  {
    id: 'linea',
    nombre: 'En línea',
    fuera: true,
    simbolo: 'paquetes',
    foto: '/images/plano-multi-linea.webp',
    alt: 'Mesa de empaque de una boutique con pedidos en línea, cajas y papel de china',
    pie: 'La misma percha, empacándose para salir.',
    pregunta: '«Vendí en línea algo que ya no estaba en el piso.»',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Tienda en línea con el mismo inventario del mostrador' },
      { t: 'WhatsApp, Instagram, Facebook y TikTok Shop' },
      { t: 'La venta en línea también abona a la cuenta de su proveedor', suite: true },
      { t: 'Perfil de la clienta con lo que compró, de qué marca y en qué talla', plan: 'Fideliza' },
      { t: 'Monedero, puntos y campañas', plan: 'Fideliza' },
    ],
  },
];
