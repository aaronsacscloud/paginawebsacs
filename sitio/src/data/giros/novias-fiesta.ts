/**
 * Contenido de la Suite para Casas de Novias y Vestidos de Fiesta.
 *
 * El giro: vestidos de novia, XV años y fiesta. El piso tiene MUESTRAS por
 * talla; el vestido bueno se pide sobre pedido y tiene que llegar, probarse y
 * ajustarse ANTES de una fecha que no se mueve. Se paga en abonos largos y el
 * taller de ajustes vive de fechas de prueba.
 *
 * Verdades del producto que sostienen la página: apartados con anticipo y
 * abonos + recordatorios (core), pedidos con fecha, Órdenes de Servicio con
 * procesos por etapas (el taller), perfil de clienta (Fideliza). NADA de
 * renta: no está verificado en el producto y no se promete.
 *
 * Padrón: la casa tiene un piso de muestras y un taller. Personajes: Valeria
 * (novia, boda 14 de marzo) y Ximena (XV años). Vestido ejemplo: $28,000 con
 * 30% de anticipo.
 */
import type { SuiteSeccion } from '../suite-ropa';

export const cortinaNovias = {
  fotoAntes: '/images/suite-novia-hoy.webp',
  fotoDespues: '/images/suite-novia-resuelto.webp',
  altAntes: 'Dueña de una casa de novias hojeando un cuaderno de citas y abonos entre vestidos enfundados',
  altDespues: 'La misma dueña mostrando en su tablet el plan de abonos y las pruebas de un vestido',
  libreta: ['Valeria — ¿cuánto debe?', '1ª prueba… ¿el 25 o el 29?'],
  filas: [
    { que: 'Valeria · boda 14 mar', donde: 'Abonado', dato: '$19,290 de $28,000' },
    { que: 'Vestido corte sirena · talla 8', donde: 'En camino', dato: 'llega 20 ene' },
    { que: '1ª prueba', donde: 'Taller', dato: '25 ene' },
  ],
};

export const casosNovias = [
  {
    id: 'cita',
    titulo: 'Se prueba la muestra, se pide su talla',
    texto:
      'El piso tiene muestras por talla; el vestido de ella se pide sobre pedido. El apartado toma el anticipo, fija la fecha de la boda y desde ahí todo se cuenta hacia atrás.',
    remate: 'El vestido no es urgente el día que se pide. Es urgente el día que ya no llega.',
    img: '/images/caso-novia-cita.webp',
    alt: 'Novia frente al espejo con un vestido de muestra mientras la vendedora toma notas en una tablet',
  },
  {
    id: 'abonos',
    titulo: 'El papá pregunta cuánto falta',
    texto:
      'El vestido se paga en abonos hasta dos semanas antes del evento. Cada abono queda en el apartado, con recordatorios — y la pregunta "¿cuánto debo?" se contesta en un toque, no buscando el cuaderno.',
    remate: 'Un abono que no se registra es una discusión en la entrega — el peor día posible para discutir.',
    img: '/images/caso-novia-abonos.webp',
    alt: 'Padre de familia pagando un abono en el mostrador de la casa de novias',
  },
  {
    id: 'taller',
    titulo: 'El taller vive de fechas de prueba',
    texto:
      'Cada vestido en ajustes es una orden de servicio con sus etapas: primera prueba, ajuste, prueba final, plancha y entrega. La costurera ve su cola del día; tú ves qué vestido va tarde.',
    remate: 'Un ajuste sin fecha es un vestido que se plancha la mañana de la boda.',
    img: '/images/caso-novia-taller.webp',
    alt: 'Costurera ajustando el dobladillo de un vestido de novia en el taller con alfileres',
  },
  {
    id: 'entrega',
    titulo: 'La semana de la entrega',
    texto:
      'La semana antes del evento todo converge: último abono, prueba final y entrega con funda. El sistema junta las tres fechas en una sola vista para que nada caiga en viernes a las 8.',
    remate: 'En este giro no hay devoluciones que valgan: la fecha pasó o no pasó.',
    img: '/images/caso-novia-entrega.webp',
    alt: 'Entrega de un vestido de novia enfundado a la clienta y su mamá en el mostrador',
  },
];

export const pasosNovias = [
  {
    cuando: 'Día 1', titulo: 'Tus vestidos y tus apartados, cargados',
    texto: 'Nos das tu lista y la subimos nosotros. No capturas nada.',
    detalle: 'Cada modelo con sus tallas de muestra, y los apartados vivos con su saldo y su fecha de evento — nadie llega a abonar y su papel no existe.',
    img: '/images/proc-novia-1.webp',
    alt: 'Consultor con laptop y la dueña revisando la lista de vestidos junto a los enfundados',
  },
  {
    cuando: 'Día 2', titulo: 'Tu taller, configurado',
    texto: 'Quedan tus etapas de ajuste, como ya trabajas.',
    detalle: 'Primera prueba, ajuste, prueba final, plancha y entrega — con los tiempos de tu costurera, no los de un manual.',
    img: '/images/proc-novia-2.webp',
    alt: 'Dueña y consultor configurando las etapas del taller frente a una tablet',
  },
  {
    cuando: 'Día 3', titulo: 'Capacitación',
    texto: 'Una sesión con tu equipo antes de abrir. Registrar un abono se aprende en la primera media hora.',
    detalle: 'Y se practica lo de diario: el apartado con fecha de evento, la orden del taller y la entrega.',
    img: '/images/proc-novia-3.webp',
    alt: 'Equipo de la casa de novias en capacitación alrededor del mostrador',
  },
  {
    cuando: 'Día 4', titulo: 'Arranca la casa',
    texto: 'La tienda opera con SACS. El sistema viejo sigue en pie por si acaso.',
    detalle: 'Con los abonos del día entrando ya al sistema y el cuaderno guardado, no tirado.',
    img: '/images/proc-novia-4.webp',
    alt: 'Vendedora registrando el primer abono del día en la casa de novias',
  },
  {
    cuando: 'Día 5', titulo: 'La primera semana de entregas',
    texto: 'La vista de la semana junta pruebas, últimos abonos y entregas.',
    detalle: 'Y por primera vez ves el taller completo: qué vestido va a tiempo y cuál necesita que alguien corra hoy, no el viernes.',
    img: '/images/proc-novia-5.webp',
    alt: 'Dueña revisando en su tablet las entregas de la semana entre vestidos enfundados',
  },
];

const est = {
  wrap: 'font-family:var(--font-body), system-ui, sans-serif;',
  h: 'font-size:11px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;',
  ok: 'background:var(--ok-fondo);color:var(--ok-texto);',
  lo: 'background:var(--aviso-fondo);color:var(--aviso-texto);',
};

export const seccionesNovias: SuiteSeccion[] = [
  {
    id: 'apartado',
    tag: 'El apartado',
    titulo: 'El apartado con la fecha del evento adentro',
    texto:
      'El anticipo aparta el vestido y la fecha de la boda queda en el apartado desde el día uno. Los abonos se registran en segundos — y con recordatorios (desde Fideliza) nadie llega a la entrega debiendo.',
    bullets: [
      'Anticipo + abonos por parcialidades, con su saldo siempre a la vista',
      'Recordatorios de abono (desde Fideliza) — el cobro no depende de la memoria de nadie',
      'La fecha del evento manda: todo se cuenta hacia atrás desde ella',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Apartado · Valeria · boda 14 de marzo</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        ${[['Vestido','$28,000'],['Anticipo (30%)','$8,400'],['Abonado','$19,290'],['Resta','$8,710']]
          .map(([k,v])=>`<div style="border:1px solid #E7EAF0;border-radius:10px;padding:10px;background:#fff;">
          <div style="font-size:10px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;">${k}</div>
          <div style="font-size:14px;font-weight:800;color:var(--color-text-primary);font-variant-numeric:tabular-nums;">${v}</div></div>`).join('')}
      </div>
      <div style="${est.ok}border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800;text-align:center;">Último abono: 28 de febrero · dos semanas antes de la boda</div>
    </div>`,
  },
  {
    id: 'muestra',
    tag: 'Piso y pedido',
    titulo: 'La muestra se prueba; su talla se pide',
    texto:
      'El piso vive de muestras por talla y el vestido de cada clienta se pide sobre pedido. El sistema distingue las dos cosas: la muestra marcada como muestra — fuera de la tienda en línea — y el pedido que tiene que llegar a tiempo.',
    bullets: [
      'Muestras marcadas como muestra, aparte del pedido de cada clienta',
      'El pedido con su fecha de llegada, amarrada a la fecha del evento',
      'El pedido que va tarde contra su boda se ve en rojo — y el aviso llega solo desde Automatiza',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Corte sirena · pedidos vivos</p>
      ${[['Valeria · talla 8','Llega 20 ene · boda 14 mar','ok'],['Fernanda · talla 4','Llega 2 feb · boda 21 feb','lo'],['Muestra piso · talla 6','Marcada · fuera de línea','ok']]
        .map(([p,e,t])=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:6px;background:#fff;">
          <span style="font-size:12px;font-weight:700;color:var(--color-text-primary);">${p}</span>
          <span style="${t==='ok'?est.ok:est.lo}font-size:11px;font-weight:800;border-radius:999px;padding:3px 10px;">${e}</span>
        </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">El de Fernanda llega justo: 19 días para dos pruebas — alguien tiene que llamar hoy</p>
    </div>`,
  },
  {
    id: 'taller',
    tag: 'El taller',
    titulo: 'El taller como etapas, no como montaña',
    texto:
      'Cada vestido en ajustes es una orden de servicio con sus etapas: primera prueba, ajuste, prueba final, plancha, entrega. La costurera ve su día; tú ves el taller completo y qué vestido va tarde contra su fecha compromiso.',
    bullets: [
      'Etapas configurables — las tuyas, no las de un manual',
      'Cada vestido con su fecha de prueba y su responsable',
      'Cada vestido con su fecha compromiso a la vista',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Taller · hoy</p>
      ${[['Valeria · sirena 8','1ª prueba · 25 ene','ok'],['Ximena · XV años','Ajuste de talle','ok'],['Sofía · fiesta','Prueba final · va tarde','lo']]
        .map(([p,e,t])=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:6px;background:#fff;">
          <span style="font-size:12px;font-weight:700;color:var(--color-text-primary);">${p}</span>
          <span style="${t==='ok'?est.ok:est.lo}font-size:11px;font-weight:800;border-radius:999px;padding:3px 10px;">${e}</span>
        </div>`).join('')}
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">El de Sofía va tarde contra su fecha compromiso: alguien corre hoy, no el viernes</p>
    </div>`,
  },
  {
    id: 'clienta',
    tag: 'La clienta',
    titulo: 'La clienta que vuelve: XV, boda, bautizo',
    texto:
      'La familia que compró los XV vuelve por la boda. El perfil guarda qué se llevó, sus tallas y sus fechas — y la casa le habla por WhatsApp con nombre y apellido, no con "estimada clienta".',
    bullets: [
      'Perfil con compras, tallas y eventos de cada familia',
      'Recordatorios y avisos por WhatsApp',
      'Campañas por temporada: graduaciones, XV, bodas de diciembre',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Familia Herrera</p>
      ${[['2023','XV de Regina · vestido y accesorios'],['2024','Graduación · vestido de fiesta'],['Hoy','Boda de Valeria en taller · y el XV de Ximena en ajuste']]
        .map(([a,e])=>`<div style="display:flex;gap:10px;padding:7px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:5px;background:#fff;">
          <b style="font-size:11px;color:var(--color-text-tertiary);min-width:34px;">${a}</b>
          <span style="font-size:12px;font-weight:600;color:var(--color-text-primary);">${e}</span>
        </div>`).join('')}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px;">
        ${[['Valeria','talla 8'],['Ximena','talla 4'],['Sra. Herrera','talla 12']]
          .map(([n,t])=>`<div style="border:1px solid #E7EAF0;border-radius:10px;padding:8px;background:#fff;text-align:center;">
          <div style="font-size:10px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;">${n}</div>
          <div style="font-size:12px;font-weight:800;color:var(--color-text-primary);">${t}</div></div>`).join('')}
      </div>
      <p style="margin:10px 0 0;font-size:11px;color:var(--color-text-tertiary);">Tres eventos, una familia — la casa que los acompañó las tres veces</p>
    </div>`,
  },
  {
    id: 'semana',
    tag: 'La semana',
    titulo: 'La semana se arma con fechas, no con sustos',
    texto:
      'Pruebas y entregas de la semana, con su fecha cada una. La lista de la semana se revisa el lunes con fechas en mano — no el viernes de memoria.',
    bullets: [
      'Cada entrega y cada prueba con su fecha y su responsable',
      'El saldo quedó en cero desde el 28 de febrero — esta semana nadie habla de dinero',
      'Lo que va tarde se ve el lunes, no el viernes a las 8',
    ],
    visual: `<div style="${est.wrap}">
      <p style="${est.h}">Semana del 9 de marzo · la lista</p>
      ${[['Mié 11','Prueba final · Valeria','ok'],['Jue 12','Saldo en $0 desde el 28 de febrero','ok'],['Vie 13','Entrega con funda · 12:00','ok']]
        .map(([d,e,t])=>`<div style="display:flex;gap:10px;padding:7px 12px;border:1px solid #E7EAF0;border-radius:10px;margin-bottom:5px;background:#fff;">
          <b style="font-size:11px;color:var(--color-text-tertiary);min-width:48px;">${d}</b>
          <span style="font-size:12px;font-weight:600;color:var(--color-text-primary);">${e}</span>
        </div>`).join('')}
      <div style="${est.ok}border-radius:10px;padding:8px 12px;font-size:12px;font-weight:800;text-align:center;">Sábado 14: la boda ya no es tu problema — es su fiesta</div>
    </div>`,
  },
];

export const planoNovias = [
  {
    id: 'piso',
    nombre: 'Piso de muestras',
    simbolo: 'rieles',
    foto: '/images/plano-novia-piso.webp',
    alt: 'Piso de una casa de novias: vestidos blancos en rieles espaciados y vestidos de XV en color',
    pie: 'Aquí se enamoran del vestido. La muestra no se vende: se pide su talla.',
    pregunta: '«¿Este modelo lo tienes en talla 8?»',
    caja: { x: 68, y: 82, w: 216, h: 166 },
    items: [
      { t: 'Muestras marcadas por modelo y talla, aparte de los pedidos' },
      { t: 'El pedido sobre pedido con su fecha de llegada', plan: 'Controla' },
      { t: 'Apartado con anticipo desde el probador' },
      { t: 'Perfil de la clienta con tallas y fechas', plan: 'Fideliza' },
      { t: 'Etiquetas con código de barras por modelo y talla' },
    ],
  },
  {
    id: 'probador',
    nombre: 'Probadores',
    simbolo: 'probadores',
    foto: '/images/plano-novia-probador.webp',
    alt: 'Probador amplio de la casa de novias con espejo triple y tarima',
    pie: 'La cita más importante de la venta pasa aquí.',
    pregunta: '«¿Me lo apartas? La boda es el 14 de marzo.»',
    caja: { x: 298, y: 82, w: 128, h: 112 },
    items: [
      { t: 'El apartado nace con la fecha del evento adentro' },
      { t: 'Anticipo y plan de abonos en el momento' },
      { t: 'Recordatorios de abono por WhatsApp', plan: 'Fideliza' },
      { t: 'La talla que no está en muestra se pide ahí mismo', plan: 'Controla' },
      { t: 'Cotización para la mamá que "lo piensa"' },
    ],
  },
  {
    id: 'taller',
    nombre: 'El taller',
    ambito: 'Detrás del piso',
    simbolo: 'anaqueles',
    foto: '/images/plano-novia-taller.webp',
    alt: 'Taller de ajustes con máquina de coser, maniquí y vestidos en proceso',
    pie: 'Del vestido que llegó al vestido que le queda: etapas con fecha.',
    pregunta: '«¿Para cuándo queda el de Valeria?»',
    caja: { x: 298, y: 208, w: 128, h: 96 },
    items: [
      { t: 'Órdenes de servicio con tus etapas de ajuste' },
      { t: 'Cada orden con su fecha compromiso de prueba' },
      { t: 'El taller completo a la vista: qué va a tiempo y qué no' },
      { t: 'Costos del ajuste al ticket, sin cobros olvidados' },
      { t: 'Registro de empleados, horarios, turnos y asistencia', extra: true },
    ],
  },
  {
    id: 'mostrador',
    nombre: 'Mostrador',
    simbolo: 'mostrador',
    foto: '/images/plano-novia-mostrador.webp',
    alt: 'Mostrador elegante de la casa de novias con tablet y fundas de vestido',
    pie: 'Abonos, entregas y la cuenta clara de cada familia.',
    pregunta: '«Vengo a abonar al vestido de mi hija.»',
    caja: { x: 68, y: 262, w: 216, h: 106 },
    items: [
      { t: 'El abono se registra en segundos, con saldo a la vista' },
      { t: 'Cortes de caja y arqueos, como en cualquier tienda' },
      { t: 'Recibo por WhatsApp de cada abono' },
      { t: 'Factura desde la caja cuando la piden' },
      { t: 'Corte ciego: el cajero no sabe cuánto debe haber', plan: 'Fideliza' },
    ],
  },
  {
    id: 'linea',
    nombre: 'En línea',
    fuera: true,
    simbolo: 'paquetes',
    foto: '/images/plano-novia-linea.webp',
    alt: 'Rincón de la casa con vestidos fotografiados para el catálogo en línea',
    pie: 'El catálogo que la novia manda al grupo de la boda.',
    pregunta: '«¿Tienen página? Le quiero enseñar a mi mamá.»',
    caja: { x: 480, y: 148, w: 158, h: 156 },
    items: [
      { t: 'Catálogo en línea de modelos — la cita empieza en el celular' },
      { t: 'WhatsApp, Instagram y Facebook con el mismo catálogo' },
      { t: 'La cita se coordina por WhatsApp, con el catálogo a la mano' },
      { t: 'Campañas por temporada: XV, graduaciones, bodas', plan: 'Fideliza' },
      { t: 'Perfil de la familia: sus eventos y sus tallas', plan: 'Fideliza' },
    ],
  },
];
