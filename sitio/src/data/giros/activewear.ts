/**
 * Contenido de la Suite para Marcas de Activewear.
 *
 * El giro: marcas mexicanas de ropa deportiva/athleisure que fabrican o
 * importan y venden por DROPS de colorways — sets de top + legging que se
 * agotan por talla en horas, venta fuerte en Instagram/TikTok y tienda en
 * línea, showroom o tienda física, y una comunidad que vuelve.
 *
 * El problema estructural propio: el SET SE ROMPE — el top S vuela y el
 * legging S se queda viudo. Todo el argumento gira ahí.
 *
 * Padrón: colorways Salvia, Lila y Negro; tallas XS–L; el drop sale jueves
 * 8 pm. Personaje: la dueña que fabrica por lotes y vende en línea y en su
 * showroom. Costo de ejemplo: $240 por pieza, a costo.
 */
import type { SuiteSeccion } from '../suite-ropa';

export const cortinaActive = {
  fotoAntes: '/images/suite-active-hoy.webp',
  fotoDespues: '/images/suite-active-resuelto.webp',
  altAntes: 'Dueña de una marca de activewear entre cajas del drop, contando piezas con una libreta',
  altDespues: 'La misma dueña viendo en su tablet el semáforo del drop por talla y colorway',
  libreta: ['Salvia S — ¿quedan tops?', 'Lila… ¿cuántos sets completos?'],
  filas: [
    { que: 'Salvia · top S', donde: 'Quedan', dato: '2' },
    { que: 'Salvia · legging S', donde: 'Quedan', dato: '19' },
    { que: 'Sets completos vendibles', donde: 'Salvia S', dato: '2' },
  ],
};

export const casosActive = [
  {
    id: 'drop',
    titulo: 'Jueves 8 pm: sale el drop',
    texto:
      'El colorway nuevo sale a la venta a la hora exacta en la tienda en línea, Instagram, Facebook y TikTok Shop, con el mismo inventario. Lo que se vende en un canal se descuenta en todos — sin sobrevender la talla que vuela.',
    remate: 'Un drop vende en dos horas lo de dos semanas. Y castiga doble: la sobreventa y el "ya no hay".',
    img: '/images/caso-active-drop.webp',
    alt: 'Dueña y asistente frente a una laptop lanzando el drop, con el rack del colorway nuevo detrás',
  },
  {
    id: 'set',
    titulo: 'El top vuela y el legging se queda',
    texto:
      'El set se vende como kit y también por pieza suelta. El reporte por talla te dice qué pieza se adelanta — y el kit con precio de set empuja a que se vayan juntos.',
    remate: 'Un legging sin su top no es inventario: es un set roto que se remata en la venta nocturna.',
    img: '/images/caso-active-set.webp',
    alt: 'Mesa de dobleces con sets de top y legging emparejados por color y una pieza suelta apartada',
  },
  {
    id: 'cambio',
    titulo: '"Me quedó chico el top" — y su talla ya voló',
    texto:
      'El cambio de talla se hace en tienda o por paquetería, contra el inventario real. Si su talla ya no está, vale a favor o monedero — y la clienta no se va enojada con la marca.',
    remate: 'En compresión, una de cada cinco compras cambia de talla. Ahí se decide si la clienta repite.',
    img: '/images/caso-active-cambio.webp',
    alt: 'Clienta probándose un top deportivo frente al espejo del showroom mientras la vendedora consulta la talla',
  },
  {
    id: 'restock',
    titulo: 'El restock que la comunidad pide',
    texto:
      'La lista de "avísame" del colorway agotado dice cuánto pedir del siguiente lote, por talla. El restock sale con datos del drop anterior, no de corazonada.',
    remate: 'El lote se decide una vez y se carga meses. La talla que sobró la ves colgada; la que faltó, no la ves — se fue a otra marca.',
    img: '/images/caso-active-restock.webp',
    alt: 'Dueña revisando en su tablet la demanda por talla junto a cajas del nuevo lote',
  },
];

export const pasosActive = [
  {
    cuando: 'Día 1', titulo: 'Tu catálogo, cargado',
    texto: 'Nos das tu lista y la subimos nosotros. No capturas nada.',
    detalle: 'Cada colorway con sus tallas de top y de legging, los kits armados y las existencias reales de bodega y showroom.',
    img: '/images/proc-active-1.webp',
    alt: 'Consultor con laptop y la dueña revisando el catálogo de colorways junto al rack',
  },
  {
    cuando: 'Día 2', titulo: 'Tus canales, conectados',
    texto: 'La tienda en línea, Instagram, Facebook y TikTok Shop jalan del mismo inventario desde el día dos.',
    detalle: 'Y el showroom cobra contra ese mismo inventario — se acabó el "déjame ver si queda".',
    img: '/images/proc-active-2.webp',
    alt: 'Configuración de canales en una laptop con la tienda en línea de la marca en pantalla',
  },
  {
    cuando: 'Día 3', titulo: 'Capacitación',
    texto: 'Una sesión con tu equipo. Cobrar un set y hacer un cambio de talla se aprende en la primera media hora.',
    detalle: 'Y se practica lo del giro: el kit, el cambio contra inventario real y el corte del día.',
    img: '/images/proc-active-3.webp',
    alt: 'Equipo de la marca en capacitación alrededor de la mesa del showroom',
  },
  {
    cuando: 'Día 4', titulo: 'Arranca la operación',
    texto: 'Showroom y en línea venden con SACS. El sistema viejo sigue en pie por si acaso.',
    detalle: 'Con los apartados y pedidos vivos migrados, y el corte del primer día cuadrado.',
    img: '/images/proc-active-4.webp',
    alt: 'Primera venta del día en el showroom con la tablet en el mostrador',
  },
  {
    cuando: 'El jueves', titulo: 'Tu primer drop con datos',
    texto: 'El drop sale a la venta a la hora exacta y por primera vez lo ves venderse talla por talla, en vivo.',
    detalle: 'Y al día siguiente sabes qué pieza se adelantó, qué talla se agotó y qué pedir al siguiente lote.',
    img: '/images/proc-active-5.webp',
    alt: 'La dueña viendo el drop venderse en tiempo real en su tablet por la noche',
  },
];

const est = {
  wrap: 'font-family:var(--font-body), system-ui, sans-serif;',
  h: 'font-size:11px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;',
  ok: 'background:var(--ok-fondo);color:var(--ok-texto);',
  lo: 'background:var(--aviso-fondo);color:var(--aviso-texto);',
};

export const seccionesActive: SuiteSeccion[] = [
  {
    id: 'set',
    tag: 'El set',
    titulo: 'El set vive en dos piezas — y el sistema lo sabe',
    texto:
      'El kit top + legging se vende como set con su precio, y cada pieza también suelta. La existencia es por pieza y por talla, así que el set roto se ve venir antes de que pase.',
    bullets: [
      'Kits con precio de set; las piezas, sueltas con el suyo',
      'Existencia por pieza, talla y colorway — no "conjuntos" a ojo',
      'El reporte dice qué pieza se adelanta y en qué talla',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Colorway Salvia · talla S</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        ${[['Top S','Quedan 2','lo'],['Legging S','Quedan 19','lo']]
          .map(([k,v,t])=>`<div style="border:1px solid #E7EAF0;border-radius:10px;padding:10px;background:#fff;">
          <div style="font-size:10px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;">${k}</div>
          <div style="font-size:14px;font-weight:800;color:${t==='lo'?'var(--aviso-texto)':'var(--color-text-primary)'};">${v}</div></div>`).join('')}
      </div>
      <div style="${est.lo}border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800;text-align:center;">Sets completos vendibles: 2 · 17 leggings van a quedar viudos</div>
    </div>`,
  },
  {
    id: 'drop',
    tag: 'El drop',
    titulo: 'El drop sale a la venta a la hora exacta, en todos lados',
    texto:
      'La colección sale a la venta a la hora del drop en la tienda en línea, Instagram, Facebook y TikTok Shop — con un solo inventario. La talla que se agota se apaga sola en todos los canales.',
    bullets: [
      'Un inventario para el drop completo: en línea, redes y showroom',
      'Sin sobreventa: la última S se vende una sola vez',
      'Apartados y pedidos para la que quiere asegurar el suyo',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Drop Salvia · jueves 8:00 pm</p>
      ${[['8:00','A la venta en línea, Instagram y TikTok Shop','ok'],['8:14','Top M agotado · se apaga en todos los canales','lo'],['8:41','$96,300 vendidos · 61% del drop','ok']]
        .map(([h,e,t])=>`<div style="display:flex;gap:10px;padding:8px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:6px;background:#fff;align-items:center;">
          <b style="font-size:11px;color:var(--color-text-tertiary);min-width:34px;">${h}</b>
          <span style="font-size:12px;font-weight:600;color:${t==='ok'?'var(--color-text-primary)':'var(--aviso-texto)'};">${e}</span>
        </div>`).join('')}
    </div>`,
  },
  {
    id: 'cambios',
    tag: 'La talla real',
    titulo: 'El cambio de talla sin drama',
    texto:
      'La compresión engaña y el cambio es parte del negocio. Se hace en tienda o a distancia contra el inventario real; si su talla ya no está, vale a favor o monedero — la clienta se queda con la marca.',
    bullets: [
      'Cambio de talla en tienda o por paquetería',
      'Vale a favor cuando la talla ya voló',
      'El monedero convierte el cambio en la siguiente compra',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Cambio · pedido 1284</p>
      ${[['Top Salvia S → M','En camino a la clienta','ok'],['Top S regresa','Vuelve a inventario al recibirse','ok'],['Diferencia','$0 — mismo precio','ok']]
        .map(([k,v])=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:6px;background:#fff;">
          <span style="font-size:12px;font-weight:700;color:var(--color-text-primary);">${k}</span>
          <span style="font-size:11px;color:var(--color-text-secondary);">${v}</span>
        </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">El top que regresa entra otra vez al drop — no a una caja perdida</p>
    </div>`,
  },
  {
    id: 'comunidad',
    tag: 'La comunidad',
    titulo: 'La clienta del primer drop sigue aquí',
    texto:
      'El perfil guarda sus tallas, sus colorways y sus compras. El monedero y los puntos la traen de vuelta — y las campañas por WhatsApp le avisan del restock de SU talla.',
    bullets: [
      'Perfil con tallas y colorways de cada clienta',
      'Monedero, puntos y niveles para la que compra cada drop',
      'Campañas por WhatsApp y correo segmentadas por comportamiento',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Clienta · Fer</p>
      ${[['Drop Lila','top S + legging S · kit'],['Drop Negro','legging S suelto'],['Hoy','avísame: Salvia S']]
        .map(([a,e])=>`<div style="display:flex;gap:10px;padding:7px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:5px;background:#fff;">
          <b style="font-size:11px;color:var(--color-text-tertiary);min-width:70px;">${a}</b>
          <span style="font-size:12px;font-weight:600;color:var(--color-text-primary);">${e}</span>
        </div>`).join('')}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:4px 0 8px;">
        ${[['Talla','S'],['Colorway','Salvia'],['Compras','3 drops']]
          .map(([k,v])=>`<div style="border:1px solid #E7EAF0;border-radius:10px;padding:8px;background:#fff;text-align:center;">
          <div style="font-size:10px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;">${k}</div>
          <div style="font-size:12px;font-weight:800;color:var(--color-text-primary);">${v}</div></div>`).join('')}
      </div>
      <div style="${est.ok}border-radius:10px;padding:8px 12px;font-size:12px;font-weight:800;text-align:center;">Su talla es S — el aviso del restock le llega a ella primero</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-tertiary);margin-top:8px;padding:0 4px;"><span>Monedero: $340</span><span>Puntos: 1,120 · nivel 2</span></div>
    </div>`,
  },
  {
    id: 'lote',
    tag: 'El siguiente lote',
    titulo: 'El lote se pide con los datos del drop anterior',
    texto:
      'Cuánto pedir de cada talla no se adivina: sale de lo que el drop vendió, de lo que se agotó primero y de la lista de "avísame". El reabasto sugerido arma la propuesta; tú decides.',
    bullets: [
      'Venta por talla y colorway del drop anterior, a la mano',
      'Reabasto sugerido por rotación real',
      'La curva del lote nuevo deja de romper el set',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Propuesta del lote · colorway Salvia</p>
      <table style="width:100%;border-collapse:separate;border-spacing:4px;font-size:12px;">
        <tr><th style="text-align:left;font-size:10.5px;color:var(--color-text-tertiary);">Pieza</th>
        ${['XS','S','M','L'].map(t=>`<th style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:700;">${t}</th>`).join('')}</tr>
        ${[['Top',[20,60,40,20]],['Legging',[20,45,40,25]]]
          .map(([p,v])=>`<tr><td style="font-size:11px;font-weight:700;color:var(--color-text-primary);">${p}</td>${v.map(n=>`<td style="${est.ok}border-radius:8px;height:30px;text-align:center;font-weight:800;">${n}</td>`).join('')}</tr>`).join('')}
      </table>
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">La S del top sube y la del legging baja: el set deja de romperse — biker y sudadera llevan su propia cuenta</p>
    </div>`,
  },
];

export const planoActive = [
  {
    id: 'showroom',
    nombre: 'Showroom',
    simbolo: 'rieles',
    foto: '/images/plano-active-showroom.webp',
    alt: 'Showroom de una marca de activewear: racks por colorway, espejo grande y banca',
    pie: 'La comunidad viene a probarse lo que vio en el drop.',
    pregunta: '«¿Tienes el set Salvia en S?»',
    caja: { x: 68, y: 82, w: 216, h: 166 },
    items: [
      { t: 'Existencia por pieza, talla y colorway, en vivo', plan: 'Controla' },
      { t: 'Kits: el set con precio de set, la pieza suelta con el suyo' },
      { t: 'Cambio de talla contra inventario real' },
      { t: 'Apartado para la que viene por su "avísame"' },
      { t: 'Cobra con tarjeta, efectivo o transferencia' },
    ],
  },
  {
    id: 'probador',
    nombre: 'Probadores',
    simbolo: 'probadores',
    foto: '/images/plano-active-probador.webp',
    alt: 'Probadores del showroom con cortina, espejo y gancho con un set deportivo',
    pie: 'Aquí se descubre la talla real — y se salva o se pierde el cambio.',
    pregunta: '«¿Me lo cambias por la M?»',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'La talla que no está aquí se ve en bodega al momento', plan: 'Controla' },
      { t: 'Cambio exprés de talla o color', plan: 'Controla' },
      { t: 'Vale a favor cuando la talla ya voló', plan: 'Controla' },
      { t: 'El cambio se bonifica a monedero, sin sacar efectivo', plan: 'Fideliza' },
      { t: 'Perfil de la clienta con sus tallas', plan: 'Fideliza' },
    ],
  },
  {
    id: 'bodega',
    nombre: 'Bodega y empaque',
    ambito: 'Detrás del showroom',
    simbolo: 'anaqueles',
    foto: '/images/plano-active-bodega.webp',
    alt: 'Bodega con anaqueles de piezas dobladas por talla y una mesa de empaque con bolsas del envío',
    pie: 'El drop en línea se surte de aquí, pedido por pedido.',
    pregunta: '«¿Cuántos pedidos faltan por empacar del drop?»',
    caja: { x: 298, y: 208, w: 128, h: 96 },
    items: [
      { t: 'Los pedidos del drop en fila, con su guía de envío' },
      { t: 'Recepción del lote contra la orden de compra', plan: 'Controla' },
      { t: 'Conteo desde el celular, sin parar el empaque', plan: 'Controla' },
      { t: 'Kardex: qué drop consumió qué', plan: 'Controla' },
      { t: 'Registro de empleados, horarios, turnos y asistencia', extra: true },
    ],
  },
  {
    id: 'mostrador',
    nombre: 'Mostrador',
    simbolo: 'mostrador',
    foto: '/images/plano-active-mostrador.webp',
    alt: 'Mostrador del showroom con tablet, bolsas de la marca y un set doblado listo',
    pie: 'La caja del showroom, cuadrada con el mismo inventario del drop.',
    pregunta: '«¿Cerramos el día cuadrados?»',
    caja: { x: 68, y: 262, w: 216, h: 106 },
    items: [
      { t: 'POS con o sin internet' },
      { t: 'Cortes de caja y arqueos' },
      { t: 'Ticket por WhatsApp' },
      { t: 'Factura desde la caja cuando la piden' },
      { t: 'Corte ciego: el cajero no sabe cuánto debe haber', plan: 'Fideliza' },
    ],
  },
  {
    id: 'linea',
    nombre: 'El drop en línea',
    fuera: true,
    simbolo: 'paquetes',
    foto: '/images/plano-active-linea.webp',
    alt: 'Set de fotos de producto de la marca con fondo limpio y aro de luz para el drop',
    pie: 'Donde el drop nace: la tienda, las redes y la lista de avísame.',
    pregunta: '«¿Aguantamos el jueves 8 pm?»',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Tienda en línea con el inventario del showroom' },
      { t: 'Instagram, Facebook y TikTok Shop del mismo catálogo' },
      { t: 'La talla agotada se apaga sola en todos los canales' },
      { t: 'Campañas de restock por WhatsApp', plan: 'Fideliza' },
      { t: 'Monedero y puntos para la comunidad', plan: 'Fideliza' },
    ],
  },
];
