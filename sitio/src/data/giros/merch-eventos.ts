/**
 * Contenido de la Suite para Merch de Eventos (conciertos, festivales, ferias
 * y pop-ups).
 *
 * El giro: vender mercancía oficial EN VIVO — el 80% de la venta pasa en unas
 * horas, en un venue sin señal, con filas que se pierden al encore. La casa
 * tiene EL caso real de México (mercancía oficial de giras internacionales:
 * 100+ puntos simultáneos, 150K+ transacciones sin error, 4 ventas por minuto
 * por punto en hora pico) y un paquete de fila probado en pop-ups reales.
 *
 * La Torre de Control del Evento es un PLUGIN que se cotiza aparte — se dice
 * donde se ve. Padrón de la página: la gira tiene fechas en CDMX, GDL y MTY;
 * los puntos de venta se llaman módulos (así les dice el gremio).
 */
import type { SuiteSeccion } from '../suite-ropa';

export const cortinaMerch = {
  fotoAntes: '/images/suite-merch-hoy.webp',
  fotoDespues: '/images/suite-merch-resuelto.webp',
  altAntes: 'Jefe de merch con radio y libreta entre cajas apiladas en la trastienda de un venue',
  altDespues: 'El mismo jefe de merch tranquilo junto al módulo, viendo la venta por punto en su tablet',
  libreta: ['¿Cuánto queda en el módulo 4?', 'Hoodies — ¿ya llegó la caja?'],
  filas: [
    { que: 'Módulo 4 · playera negra M', donde: 'Quedan', dato: '7' },
    { que: 'Traspaso camión → módulo 2', donde: 'En tránsito', dato: '8 min' },
    { que: 'Venta de la noche', donde: 'Al corte', dato: '$1.2M' },
  ],
};

/* ── Las cuatro situaciones donde el evento gana o pierde la noche ── */
export const casosMerch = [
  {
    id: 'puertas',
    titulo: 'Abren puertas y el venue se queda sin WiFi',
    texto:
      'La caja registra y cobra sin internet toda la noche, y sincroniza cuando vuelve la señal. El efectivo no depende de nadie y la terminal trae su propio chip — el módulo no se detiene por el WiFi del venue.',
    remate: 'En un concierto se pierde 20% de la venta en dos horas si el sistema se cae. Nos tocó verlo — por eso existimos.',
    img: '/images/caso-merch-puertas.webp',
    alt: 'Fila de asistentes comprando en un módulo de mercancía dentro de un venue, cajera cobrando con tablet',
  },
  {
    id: 'pico',
    titulo: 'La hora pico: de que cierra el show a que vacían el venue',
    texto:
      'Cada punto de cobro hace hasta 4 ventas por minuto — y un módulo puede tener varios. Escaneas, cobras y entregas sin teclear nada. La fila avanza porque el cobro son tres toques, no un interrogatorio.',
    remate: 'Casi todo el merch se vende en unas horas. Un minuto de fila trabada es venta que se va por la puerta.',
    img: '/images/caso-merch-pico.webp',
    alt: 'Hora pico en el módulo de merch: tres cajeras cobrando en paralelo con la fila avanzando',
  },
  {
    id: 'reabasto',
    titulo: 'El módulo 2 vuela y el 4 no vende',
    texto:
      'Cada módulo tiene su inventario y todo se consolida en vivo. El traspaso sale del camión o del módulo lento al que sí vende — autorizado, surtido y recibido con escáner.',
    remate: 'La talla M no se acaba en el evento: se acaba en el módulo equivocado.',
    img: '/images/caso-merch-reabasto.webp',
    alt: 'Staff con caja al hombro cruzando el pasillo del venue hacia un módulo de merch',
  },
  {
    id: 'corte',
    titulo: 'Termina la fecha y hay que rendir cuentas',
    texto:
      'Corte por módulo y por noche: cuánto vendió cada punto, qué diseño rotó, qué regresa al camión — y la comisión del venue ya contemplada en la cuenta. La gira sigue a GDL con el inventario ya cuadrado.',
    remate: 'Al artista se le rinde cuentas por noche, no "cuando salgan los números".',
    img: '/images/caso-merch-corte.webp',
    alt: 'Jefe de merch revisando el corte de la noche en una tablet junto a cajas cerradas y etiquetadas',
  },
];

/* ── Cómo se implementa para una gira o un pop-up ── */
export const pasosMerch = [
  {
    cuando: 'Semanas antes', titulo: 'Tu catálogo, cargado',
    texto: 'Nos das la lista de productos de la gira y la subimos nosotros. No capturas nada.',
    detalle: 'Cada diseño con su curva de tallas y su precio por fecha — y los kits (playera + póster) armados desde antes.',
    img: '/images/proc-merch-1.webp',
    alt: 'Equipo de producción revisando la lista de productos de la gira con un consultor y una laptop',
  },
  {
    cuando: 'Días antes', titulo: 'Los módulos, armados',
    texto: 'Se define cuántos puntos de venta habrá y qué inventario arranca en cada uno.',
    detalle: 'Cada módulo es su propio almacén: lo que entra, lo que vende y lo que regresa se cuenta por punto.',
    img: '/images/proc-merch-2.webp',
    alt: 'Módulo de merch montándose en el venue con cajas etiquetadas y mercancía colgándose',
  },
  {
    cuando: 'El día', titulo: 'Capacitación exprés',
    texto: 'El staff del evento aprende a cobrar en la primera media hora — muchos cobran por primera vez esa noche.',
    detalle: 'Escanear, cobrar, entregar. Tres toques. Y el encargado sabe autorizar un cambio o un descuento.',
    img: '/images/proc-merch-3.webp',
    alt: 'Staff del evento en capacitación rápida alrededor del módulo antes de abrir puertas',
  },
  {
    cuando: 'Puertas', titulo: 'Se abre y se cobra',
    texto: 'Los módulos venden con o sin internet. El tablero consolida la noche en vivo.',
    detalle: 'Y si un punto se queda sin la talla que vuela, el traspaso sale en minutos, no al día siguiente.',
    img: '/images/proc-merch-4.webp',
    alt: 'Venue lleno con el módulo de merch iluminado cobrando a la fila',
  },
  {
    cuando: 'Al cierre', titulo: 'El corte de la noche',
    texto: 'Corte por módulo, consolidado de la fecha y el inventario listo para viajar a la siguiente ciudad.',
    detalle: 'Lo vendido, lo que regresa al camión y lo que hay que reponer antes de GDL — en una pantalla, no en una madrugada de Excel.',
    img: '/images/proc-merch-5.webp',
    alt: 'Jefe de merch cerrando la noche con su tablet sobre cajas listas para el camión',
  },
];

/* ── El recorrido de funcionalidades ── */
const est = {
  wrap: 'font-family:var(--font-body), system-ui, sans-serif;',
  h: 'font-size:11px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;',
  ok: 'background:var(--ok-fondo);color:var(--ok-texto);',
  lo: 'background:var(--aviso-fondo);color:var(--aviso-texto);',
};

export const seccionesMerch: SuiteSeccion[] = [
  {
    id: 'offline',
    tag: 'La caja',
    titulo: 'El venue se queda sin WiFi. La caja no lo nota.',
    texto:
      'El punto de venta cobra toda la noche sin internet y sincroniza solo cuando vuelve la señal. El efectivo no depende de nadie, la terminal trae su propio chip, y la curva de tallas de cada diseño está a un toque.',
    bullets: [
      'Cobra sin conexión — la venta no se pierde ni se captura dos veces',
      'Escanear, cobrar, entregar: tres toques por venta',
      'Cambios de talla ahí mismo, sin deshacer la venta',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Módulo 2 · playera del tour · negra</p>
      <table style="width:100%;border-collapse:separate;border-spacing:4px;font-size:12px;">
        <tr>${['S','M','L','XL','XXL'].map(t=>`<th style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:700;">${t}</th>`).join('')}</tr>
        <tr>${[[7,'ok'],[12,'lo'],[9,'ok'],[6,'ok'],[2,'lo']].map(([n,t])=>`<td style="${t==='lo'?est.lo:est.ok}border-radius:8px;height:34px;text-align:center;font-weight:800;">${n}</td>`).join('')}</tr>
      </table>
      <p style="margin:6px 0 0;font-size:10.5px;color:var(--color-text-tertiary);">A 12 ventas/min, la M es un minuto de pico: por volar</p>
      <div style="display:flex;justify-content:space-between;margin-top:10px;padding:9px 12px;border:1px solid #E7EAF0;border-radius:10px;background:#fff;">
        <span style="font-size:11px;font-weight:700;color:var(--color-text-secondary);">Sin WiFi desde las 8:14 pm</span>
        <span style="${est.ok}font-size:11px;font-weight:800;border-radius:999px;padding:3px 10px;">Cobrando · 214 ventas por sincronizar</span>
      </div>
    </div>`,
  },
  {
    id: 'modulos',
    tag: 'Los módulos',
    titulo: 'Cada módulo es su propio almacén',
    texto:
      'Lo que entra al módulo, lo que vende y lo que regresa al camión se cuenta por punto — y todo se consolida en vivo. El corte de la noche sale por módulo y por fecha.',
    bullets: [
      'Inventario independiente por módulo, stand o camión',
      'Consolidado de la fecha en una pantalla — lo cobrado sin WiFi entra al reconectar',
      'El corte por punto dice qué módulo produce y cuál estorba',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">La noche · consolidado en vivo</p>
      ${[['Módulo 1 · acceso','$412,300','ok'],['Módulo 2 · pista','$389,150','ok'],['Módulo 4 · mezzanine','$96,400','lo'],['+2 módulos más','$302,150','ok']]
        .map(([m,v,t])=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:9px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:6px;background:#fff;">
          <span style="font-size:12px;font-weight:700;color:var(--color-text-primary);">${m}</span>
          <span style="${t==='ok'?est.ok:est.lo}font-size:11px;font-weight:800;border-radius:999px;padding:3px 10px;font-variant-numeric:tabular-nums;">${v}</span>
        </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">Corte 9:40 pm · lo cobrado sin WiFi entra al reconectar; la M del mezzanine se va a pista</p>
    </div>`,
  },
  {
    id: 'traspasos',
    tag: 'Reabasto en vivo',
    titulo: 'La talla vuela en un módulo y sobra en otro',
    texto:
      'El traspaso sale del camión o del módulo lento hacia el que sí vende: autorizado, surtido y recibido con escáner, mientras el show sigue. La M no se acaba en el evento — se acaba en el módulo equivocado.',
    bullets: [
      'Traspasos entre módulos y desde el camión, en minutos',
      'Quién lo autorizó, quién lo llevó y quién lo recibió',
      'Recepción escaneando al llegar al módulo',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Traspaso 118 · camión → módulo 2</p>
      ${[['Playera negra M','24 pzas','recibidas'],['Playera negra L','18 pzas','recibidas'],['Hoodie del tour M','12 pzas','en tránsito']]
        .map(([p,c,e])=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:6px;background:#fff;">
          <span style="font-size:12px;font-weight:700;color:var(--color-text-primary);">${p}</span>
          <span style="font-size:11px;color:var(--color-text-secondary);">${c}</span>
          <span style="${e==='recibidas'?est.ok:est.lo}font-size:11px;font-weight:800;border-radius:999px;padding:3px 10px;">${e}</span>
        </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">Playeras recibidas con escáner 9:10 pm · el hoodie va en camino</p>
    </div>`,
  },
  {
    id: 'fila',
    tag: 'La fila',
    titulo: 'La fila avanza porque la entrega es un escaneo',
    texto:
      'Para la preventa pagada en línea y los pedidos, el paquete de fila entrega con el celular: se escanea el código del cliente, se marca entregado y el siguiente pasa. Probado en pop-ups reales con filas de horas.',
    bullets: [
      'Preventa pagada en línea que se entrega en el evento',
      'Escáner en el celular del staff: marcar entregado toma segundos',
      'Entrega inmediata al pagar — sin lista impresa ni palomeo a mano',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Entrega de preventa · fila 2</p>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">
        ${[['En fila','63'],['Entregados','448'],['Por minuto','9']]
          .map(([k,v])=>`<div style="border:1px solid #E7EAF0;border-radius:10px;padding:10px;background:#fff;text-align:center;">
          <div style="font-size:10px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;">${k}</div>
          <div style="font-size:16px;font-weight:800;color:var(--color-text-primary);">${v}</div></div>`).join('')}
      </div>
      <div style="${est.ok}border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800;text-align:center;margin-bottom:6px;">Pedido 0448 · escaneado y entregado · 8:41 pm</div>
      ${[['0172','2 playeras M','en mostrador'],['0391','hoodie L','preparando'],['0284','kit playera + póster','en fila']]
        .map(([f,q,e])=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:7px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:5px;background:#fff;">
          <b style="font-size:11px;color:var(--color-text-tertiary);">${f}</b>
          <span style="font-size:11.5px;font-weight:700;color:var(--color-text-primary);">${q}</span>
          <span style="font-size:10.5px;color:var(--color-text-tertiary);">${e}</span>
        </div>`).join('')}
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-tertiary);padding:0 4px;"><span>Los folios no llegan en orden — la fila sí avanza</span><span>7 s por entrega</span></div>
    </div>`,
  },
  {
    id: 'torre',
    tag: 'La torre',
    titulo: 'La Torre de Control: el evento en un semáforo',
    texto:
      'Para la operación grande, la Torre de Control del Evento pinta cada módulo en un semáforo de venta y existencia, y propone el reabasto en vivo. Es un plugin y se cotiza aparte de tu plan.',
    bullets: [
      'Semáforo por módulo: quién vende, quién se queda sin tallas',
      'Propuestas de traspaso con un toque — tú apruebas',
      'Nacida de la operación de giras de 100+ puntos de venta simultáneos',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Torre de control · fecha CDMX</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        ${[['Módulo 1','Vende y tiene','#ECFDF5','#047857'],['Módulo 2','Vende · M baja','#FFFBEB','#B45309'],['Módulo 4','No vende','#FEF2F2','#B91C1C'],['Camión','Reserva lista','#EFF6FF','#2563EB']]
          .map(([m,e,bg,fg])=>`<div style="border:1px solid #E7EAF0;border-radius:10px;padding:9px 12px;background:${bg};">
          <div style="font-size:11.5px;font-weight:800;color:${fg};">${m}</div>
          <div style="font-size:10.5px;color:var(--color-text-tertiary);margin-top:2px;">${e}</div></div>`).join('')}
      </div>
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">Propuesta: 7 M del mezzanine a pista · aprobar</p>
    </div>`,
  },
];

/* ── El plano: el venue, no una tienda ── */
export const planoMerch = [
  {
    id: 'modulo',
    nombre: 'El módulo',
    simbolo: 'mostrador',
    foto: '/images/plano-merch-modulo.webp',
    alt: 'Módulo de merch montado en el venue: pared de playeras colgadas por talla y mostrador de cobro',
    pie: 'El punto de venta que vive una noche y cobra como cien.',
    pregunta: '«¿Cuántas M quedan aquí, en ESTE módulo?»',
    caja: { x: 68, y: 82, w: 216, h: 166 },
    items: [
      { t: 'POS que cobra sin internet toda la noche' },
      { t: 'Curva de tallas por diseño, a un toque' },
      { t: 'Inventario propio por módulo', plan: 'Controla' },
      { t: 'Kits: playera + póster en un solo escaneo' },
      { t: 'Cambio de talla sin deshacer la venta' },
    ],
  },
  {
    id: 'fila',
    nombre: 'La fila',
    simbolo: 'paquetes',
    foto: '/images/plano-merch-fila.webp',
    alt: 'Fila ordenada de asistentes frente al módulo de merch con staff escaneando celulares',
    pie: 'Aquí se gana o se pierde la noche, minuto a minuto.',
    pregunta: '«La fila da vuelta al pasillo. ¿Cuánto tardas por venta?»',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'Tres toques por venta: escanear, cobrar, entregar' },
      { t: 'Preventa pagada en línea, entregada con escáner en el celular' },
      { t: 'Marcar entregado toma segundos — la fila no se detiene' },
      { t: 'Cobro móvil: el staff cobra caminando la fila' },
      { t: 'Recibo por WhatsApp — nadie espera papel' },
    ],
  },
  {
    id: 'camion',
    nombre: 'El camión',
    ambito: 'Atrás del venue',
    simbolo: 'anaqueles',
    foto: '/images/plano-merch-camion.webp',
    alt: 'Cajas de mercancía etiquetadas y apiladas en la zona de carga del venue junto al camión de la gira',
    pie: 'La reserva de la gira — vive en el andén de carga; el croquis lo acerca para leerse.',
    pregunta: '«¿Qué queda en el camión y qué se va a GDL?»',
    caja: { x: 298, y: 208, w: 128, h: 96 },
    items: [
      { t: 'El camión es un almacén más: entra y sale con escáner', plan: 'Controla' },
      { t: 'Traspasos al módulo que sí vende, en minutos', plan: 'Controla' },
      { t: 'Conteo desde el celular antes de cerrar el camión', plan: 'Controla' },
      { t: 'Kardex: qué fecha consumió qué', plan: 'Controla' },
      { t: 'Recepción escaneando al cargar y descargar', plan: 'Controla' },
    ],
  },
  {
    id: 'produccion',
    nombre: 'Producción',
    simbolo: 'rieles',
    foto: '/images/plano-merch-produccion.webp',
    alt: 'Mesa de producción del evento con laptops, radios y el tablero de la gira en una pantalla',
    pie: 'Desde aquí se decide la noche: qué módulo respira y cuál se ahoga.',
    pregunta: '«¿Vamos bien contra la fecha de Monterrey?»',
    caja: { x: 68, y: 262, w: 216, h: 106 },
    items: [
      { t: 'Consolidado de la noche en vivo, módulo por módulo', plan: 'Controla' },
      { t: 'Corte por módulo y por fecha al cierre', plan: 'Controla' },
      { t: 'Comparativo entre fechas de la gira', plan: 'Controla' },
      { t: 'Torre de Control: semáforo y reabasto propuesto', suite: true },
      { t: 'Alertas de picos de venta', plan: 'Automatiza' },
      { t: 'Registro de empleados, horarios, turnos y asistencia', extra: true },
    ],
  },
  {
    id: 'linea',
    nombre: 'En línea',
    fuera: true,
    simbolo: 'paquetes',
    foto: '/images/plano-merch-linea.webp',
    alt: 'Mesa de empaque de pedidos en línea del artista con cajas y mercancía de la gira',
    pie: 'La gira termina; la tienda del artista sigue vendiendo.',
    pregunta: '«¿Y lo que sobró de la gira?»',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Tienda en línea con el inventario que regresó de la gira' },
      { t: 'Preventa del siguiente show desde la misma tienda' },
      { t: 'WhatsApp, Instagram, Facebook y TikTok Shop' },
      { t: 'Un solo inventario para el venue y el ecommerce' },
      { t: 'Perfil del fan: qué compró en qué gira', plan: 'Fideliza' },
    ],
  },
];
