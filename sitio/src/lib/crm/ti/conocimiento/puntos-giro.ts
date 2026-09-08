/**
 * LOS PUNTOS DEL PASO 1 (glosario del dueño, 8-sep-2026 · ver sitio/GLOSARIO-GIROS.md).
 *
 * En cuanto Fernanda tiene los tres datos (modelo de negocio, giro, sucursales), dice: primero la NOVEDAD (catálogo
 * automático con IA, para ropa, calzado y uniformes), luego los puntos de la combinación giro × modelo × tamaño, numerados,
 * y cierra con la pregunta abierta. Aquí vive ese glosario como datos; `puntosPara` arma la lista para un lead concreto.
 */
import type { GiroId } from './giros.ts';

export type ModeloNegocio = 'multimarca' | 'monomarca' | 'fabricante' | 'mayorista' | 'venta' | 'renta' | 'ambas' | 'otro' | null | undefined;
export type SubGiro = 'lenceria' | 'western' | 'uniformes';

export const NOVEDAD_IA = {
  aplicaA: ['ropa', 'multimarca', 'zapateria', 'activewear', 'novias', 'merch'] as string[],   // ropa, calzado y uniformes (y sus variantes)
  titulo: 'Catálogo automático con IA',
  comoDecirlo: 'Antes de lo demás te comparto una novedad: acabamos de lanzar el catálogo automático con IA. Subes la foto de la prenda, el sistema la edita, te genera los demás colores, la pone en tu propia modelo hiperrealista y hasta te arma el video para reels. Es de lo más nuevo que tenemos para tiendas como la tuya.',
  detalle: [
    'Subes la foto de la prenda o el par y el sistema la edita en automático (fondo, luz, recorte).',
    'Si el modelo viene en más colores, la IA genera cada color sin volver a fotografiar.',
    'Creas tu propia modelo hiperrealista y la prenda se le pone en automático, en el formato que necesitas.',
    'De ahí se genera el video para reels y redes sociales. Todo automatizado, listo para publicar.',
  ],
};

/** Transversales: se mencionan cuando la plática toca el tema (apartados, corte, finanzas; matriz de tallas). */
export const TRANSVERSALES = {
  apartados_finanzas: ['Cancelación de apartado con reglas de devolución de abonos.', 'Corte de caja que refleja cancelaciones y comisiones sobre la venta completa del apartado y sus abonos.', 'Factura a público en general automática por ventas y abonos.', 'Gastos, cuentas por pagar y contabilidad en el mismo sistema.'],
  matriz: 'Ver las existencias en la matriz talla × color, por sucursal, con aviso de agotados, y hacer la compra y el traspaso desde la misma matriz (clave en calzado, jeans y trajes de baño).',
};

type Puntos = { base: string[]; combos: Record<string, string[]> };

const tam = (sucursales?: number | null) => (Number(sucursales) >= 2 ? 'varias' : 'una');
const modeloClave = (m: ModeloNegocio): 'multimarca' | 'fabricante' | 'mayorista' => (m === 'mayorista' ? 'mayorista' : m === 'monomarca' || m === 'fabricante' ? 'fabricante' : 'multimarca');

export const PUNTOS: Record<string, Puntos> = {
  ropa: {
    base: [
      'Cada prenda se lleva por talla y color, así sabes exactamente qué te queda de cada una.',
      'Lo que vendes por WhatsApp, Instagram o tu tienda en línea se descuenta del mismo inventario que el mostrador.',
      'Cambios de talla en el mostrador, aunque la compra haya sido en otra tienda o en línea.',
      'Apartados con abonos y recordatorio, sin cuaderno.',
    ],
    combos: {
      'multimarca:una': ['Cada prenda con su marca y su proveedor, y el corte que te dice qué marca sí vende y cuál ocupa percha sin pagar.'],
      'multimarca:varias': ['Qué talla hay en cada tienda y traspasos sin llamadas.', 'Nivelación entre tiendas: el sistema propone mover lo que sobra en una a la que le falta.', 'Compra por curva de tallas con datos de venta real, no de memoria.'],
      'fabricante:una': ['Un solo inventario para tu taller, tu showroom y tus canales en línea.', 'Lanzamiento o drop con un solo inventario: la talla agotada se apaga sola en todos los canales.'],
      'fabricante:varias': ['Qué talla hay en cada tienda y traspasos sin llamadas.', 'Nivelación entre tiendas y desde la bodega o el taller.', 'Producción por curva con datos de todas las tiendas.'],
      'mayorista:una': ['Listas de precio de menudeo y mayoreo: por paquete, docena o surtido, sin calcular a mano.', 'Crédito y estado de cuenta por cliente tienda.', 'Pedidos por WhatsApp o catálogo con existencia real.', 'Surtido por paquete o corrida completa, y sabes qué tallas te quedan sueltas.'],
      'mayorista:varias': ['Listas de precio de menudeo y mayoreo, crédito por cliente y pedidos por catálogo con existencia real.', 'Vendedores con metas y comisiones calculadas.', 'Compra y reabasto con datos por punto.', 'Cuentas por pagar a proveedores y bancos en el mismo sistema.'],
    },
  },
  zapateria: {
    base: [
      'Corrida completa con medios números: cada modelo por color y número, sabes qué pares te quedan de cada uno.',
      'Aviso de corrida rota: cuando faltan los números de en medio, el sistema te avisa antes de que el modelo se vuelva saldo.',
      'Cambio de número en el mostrador, aunque la compra haya sido en otra tienda o en línea.',
      'Apartados por quincena con abonos y recordatorio, y lo que vendes en línea baja del mismo inventario.',
    ],
    combos: {
      'multimarca:una': ['Marca y proveedor en cada par, con el corte por marca.', 'Tienda en línea integrada con el mismo inventario por número.', 'Pedido de temporada por embarques: qué llegó y qué falta por llegar.', 'Ficha de cliente y aviso cuando llega su número.'],
      'multimarca:varias': ['Qué número hay en cada tienda y traspasos.', 'Nivelar la corrida entre tiendas y desde la bodega.', 'Pedido de temporada por embarques con datos de cada tienda.', 'Corte por marca y por tienda.'],
      'fabricante:una': ['Un solo inventario para fábrica, tienda y línea.', 'Producción por corrida con datos: qué números sobraron y cuáles se agotaron.', 'Lanzamiento de modelo con un solo inventario: el número agotado se apaga solo.', 'Ficha de cliente y lista de avísame.'],
      'fabricante:varias': ['Qué número hay en cada tienda y traspasos.', 'Nivelar la corrida entre tiendas y desde la fábrica o bodega.', 'Producción por corrida con datos de todas las tiendas.', 'Un solo inventario para fábrica, tiendas y línea.'],
      'mayorista:una': ['Listas de precio de menudeo y mayoreo por corrida, docena o surtido.', 'Crédito y estado de cuenta por cliente tienda.', 'Pedidos por WhatsApp o catálogo con existencia real por número.', 'Venta por corrida completa o números sueltos.'],
      'mayorista:varias': ['Listas de precio, crédito por cliente y pedidos por catálogo con existencia real.', 'Existencia por bodega y traspasos.', 'Vendedores con metas y comisiones.', 'Compra y reabasto con datos por punto, y cuentas por pagar a proveedores.'],
    },
  },
  joyeria: {
    base: [
      'Precio por gramo con tu factor por quilataje: cada pieza vale lo que pesa, no lo que dice una etiqueta vieja.',
      'Repreciar la vitrina en masa cuando sube el oro: simulas, aplicas y salen etiquetas nuevas sin cerrar la cortina.',
      'Costo histórico y margen real por pieza, aunque el metal haya cambiado de precio.',
      'Órdenes de reparación y servicio: la pieza del cliente, el joyero propio o externo, el avance y la entrega, con su cobro.',
      'Apartados largos con abonos y recordatorio, y lo que vendes en línea baja del mismo inventario.',
    ],
    combos: {
      'fabricante:una': ['Compra de oro y metal con costo por lote; de ahí sale el costo de cada pieza.', 'Pieza sobre pedido con diseño, anticipo y fecha, visible para el taller.', 'Catálogo con foto y venta en línea de piezas únicas sin duplicarlas.', 'Cumplimiento LFPIORPI desde el sistema.'],
      'fabricante:varias': ['Un solo precio del gramo para todas las sucursales.', 'Existencia por vitrina y traspasos pieza por pieza.', 'Taller central con las órdenes de todas las sucursales, con fecha y responsable.', 'Vendedores con metas y comisiones por sucursal sobre margen real.'],
      'multimarca:una': ['Marca y proveedor en cada pieza con su costo: qué línea sí vende.', 'Consigna del proveedor separada de lo propio, con liquidación calculada.', 'Catálogo con foto y venta en línea y WhatsApp con el mismo inventario.', 'Ficha de cliente con fechas y aniversarios para avisarle.'],
      'multimarca:varias': ['Un solo precio del gramo para todas las sucursales.', 'Existencia por vitrina y traspasos de piezas.', 'Corte por marca y por sucursal.', 'Vendedores con metas y comisiones por sucursal.'],
      'mayorista:una': ['Precio por gramo por lista de cliente: menudeo, mayoreo, distribuidor.', 'Crédito y estado de cuenta por cliente joyería.', 'Pedidos por catálogo o WhatsApp con existencia real.', 'Venta por peso y por lote con el total calculado por peso y quilate.'],
      'mayorista:varias': ['Precio por gramo por lista, crédito por cliente y pedidos por catálogo.', 'Existencia por bodega y traspasos pieza por pieza.', 'Vendedores o rutas con metas y comisiones.', 'Compra de metal y reabasto con datos por punto, y cuentas por pagar.'],
    },
  },
  novias: {
    base: [],
    combos: {
      'venta': ['Apartado con la fecha del evento adentro, con abonos y recordatorio.', 'Muestras de piso vs. pedido sobre medida: qué se pidió y cuándo llega.', 'Taller de ajustes por etapas con órdenes de servicio.', 'Ficha de la familia y sus eventos, y lo que vendes en línea baja del mismo inventario.'],
      'renta': ['Calendario de renta por prenda, sin empalmes.', 'Depósito, entrega y devolución registrados, con el estado en que volvió.', 'Tintorería y arreglo entre rentas, con fecha de disponibilidad.', 'Historial de cada prenda: rentas y desgaste, para saber cuándo retirarla.'],
      'varias': ['Qué muestra o prenda está en qué sucursal y traspasos.', 'Taller central con las órdenes de todas las sucursales.', 'Calendario de renta compartido entre sucursales.', 'Apartados multisucursal, con cancelaciones por reglas y comisiones sobre la venta completa del apartado.'],
    },
  },
  consignacion: {
    base: [
      'Cada pieza con su dueña y su comisión por contrato: al vender, la liquidación sale sola con el porcentaje pactado.',
      'Estado de cuenta que la consignante ve sola en su portal, con saldo a favor y retiros.',
      'Contrato con firma remota y vigencia: recepción de piezas firmada desde el celular, con fecha de retiro o rebaja.',
      'Lives y tienda en línea con un solo inventario: lo vendido en el Live se baja al momento.',
    ],
    combos: {
      'mixta': ['Lo firme separado de la consigna: margen y comisión por separado.'],
      'varias': ['Pieza por tienda y traspasos.'],
      'extra': ['Lista de espera y recepción por cita con reglas de lo que se acepta.', 'Autenticidad y disputas: pieza en revisión con evidencia y resolución registradas.'],
    },
  },
  activewear: {
    base: [
      'Drop con un solo inventario en todos los canales: sale a la hora exacta y la talla agotada se apaga sola en Shopify, TikTok, Instagram y showroom.',
      'El set como kit con el descase visible: top y legging juntos o sueltos, y ves por talla cuál se quedó viudo.',
      'Cambio de talla aunque la compra fue en línea, con el inventario actualizado.',
      'Lote nuevo con datos del drop anterior: qué talla y colorway sobró o se agotó.',
    ],
    combos: {
      'showroom': ['Showroom con POS y fila afuera: misma línea, empaque y envíos del mismo inventario.'],
      'comunidad': ['Comunidad: lista de avísame y campañas de restock.'],
      'varias': ['Existencia por sede o bodega y traspasos.'],
      'envios': ['Envíos y devoluciones con guía desde el sistema.'],
    },
  },
  merch: {
    base: [
      'Cobrar sin internet en el venue: el POS sigue cobrando aunque se caiga la señal y sincroniza después.',
      'Un almacén por módulo y traspasos en vivo: la talla que se acabó en un módulo y sobra en otro se mueve durante el show.',
      'Entrega de preventa con escáner, sin lista impresa.',
      'Corte por módulo y por fecha al terminar la noche.',
      'Reporte del evento con la comisión del promotor o del artista, y conciliación de mercancía al cerrar.',
      'Torre de control: traspasos entre puntos en tiempo real y semáforo por módulo, para giras y eventos grandes.',
    ],
    combos: {},
  },
};

/** Sub-giros de ropa con base propia (se suman a la base de ropa). */
export const SUBGIROS: Record<SubGiro, { alias: string[]; puntos: string[] }> = {
  lenceria: { alias: ['lencería', 'lenceria', 'brasier', 'brassier', 'copa', 'babydoll', 'ropa interior', 'íntima', 'intima'], puntos: [
    'Talla y copa como existencias distintas: un mismo brasier en 34B, 34C y 36B son tres existencias; sabes cuál se está acabando.',
    'Conjuntos y babydoll por talla y color, sin mezclar con la copa.',
    'Reposición por talla y copa con datos: qué combinaciones se agotan primero.',
    'Venta discreta por WhatsApp y catálogo con talla y copa disponibles, que baja del mismo inventario.',
  ] },
  western: { alias: ['western', 'vaquero', 'vaquera', 'botas', 'sombrero', 'cinto', 'piteado', 'palenque', 'feria'], puntos: [
    'Botas por número, horma y punta, con medios números: sabes qué pares quedan de cada uno.',
    'Sombreros por talla y cintos por medida como existencias distintas, con aviso de agotados.',
    'Temporadas de feria y palenque con inventario por punto: lo que se lleva sale como almacén aparte y se cobra sin internet.',
    'Apartados por quincena y cambio de número en mostrador aunque se compró en otra tienda.',
  ] },
  uniformes: { alias: ['uniforme', 'uniformes', 'escolar', 'escolares', 'bordado', 'empresarial', 'médico', 'medico', 'filipina', 'scrub'], puntos: [
    'Listas por escuela o empresa: cada una con su lista de prendas, tallas y precios; el pedido se arma desde la lista.',
    'Pedidos por talla con anticipo, saldo y fecha de entrega, sin cuaderno.',
    'Temporada de regreso a clases con inventario por punto: el módulo en la escuela sale como almacén aparte y cobra sin internet.',
    'Bordado o personalización como orden de servicio, con taller y fecha de entrega.',
  ] },
};

export function detectarSubgiro(texto: string): SubGiro | null {
  const t = String(texto || '').toLowerCase();
  for (const [id, s] of Object.entries(SUBGIROS) as [SubGiro, { alias: string[] }][]) if (s.alias.some(a => t.includes(a))) return id;
  return null;
}

/** La lista del paso 1 para un lead: novedad (si aplica) + base + combinación, tope 5 puntos (la novedad va aparte). */
export function puntosPara(o: { giroId: GiroId | string | null | undefined; modelo?: ModeloNegocio; sucursales?: number | null; subgiro?: SubGiro | null; texto?: string }): { novedad: string | null; puntos: string[]; combinacion: string } {
  const g = o.giroId ? PUNTOS[o.giroId] : null;
  const t = tam(o.sucursales);
  const novedad = o.giroId && (NOVEDAD_IA.aplicaA.includes(String(o.giroId)) || o.subgiro === 'uniformes') && !['novias', 'merch'].includes(String(o.giroId)) ? NOVEDAD_IA.comoDecirlo : null;
  if (!g) return { novedad, puntos: [], combinacion: 'sin giro' };
  let lista: string[] = [];
  let combinacion = `${o.giroId} · ${t === 'varias' ? 'varias tiendas' : 'una tienda'}`;
  if (o.giroId === 'novias') {
    const m = o.modelo === 'renta' ? 'renta' : o.modelo === 'ambas' ? 'ambas' : 'venta';
    lista = [...(m !== 'renta' ? g.combos.venta : []), ...(m !== 'venta' ? g.combos.renta : []), ...(t === 'varias' ? g.combos.varias : [])];
    combinacion = `novias · ${m} · ${t}`;
  } else if (o.giroId === 'consignacion') {
    const txt = String(o.texto || '').toLowerCase();
    lista = [...g.base, ...(/firme|compro|propia|mixta/.test(txt) ? g.combos.mixta : []), ...(t === 'varias' ? g.combos.varias : []), ...g.combos.extra];
  } else if (o.giroId === 'activewear') {
    const txt = String(o.texto || '').toLowerCase();
    lista = [...g.base, ...(/showroom|fila/.test(txt) ? g.combos.showroom : []), ...g.combos.comunidad, ...(t === 'varias' ? g.combos.varias : []), ...(/env[ií]o|paqueter/.test(txt) ? g.combos.envios : [])];
  } else if (o.giroId === 'merch') {
    lista = [...g.base];
  } else {
    const k = `${modeloClave(o.modelo)}:${t}`;
    const sub = o.subgiro && SUBGIROS[o.subgiro] ? SUBGIROS[o.subgiro].puntos : [];
    const combo = g.combos[k] || [];
    // Tope de 5 sin perder lo específico: hasta 2 del sub-giro, hasta 2 de la combinación (modelo × tamaño) y la base completa el resto.
    const subN = Math.min(2, sub.length), comboN = Math.min(2, combo.length);
    lista = [...sub.slice(0, subN), ...g.base.slice(0, Math.max(0, 5 - subN - comboN)), ...combo.slice(0, comboN)];
    combinacion = `${o.giroId}${o.subgiro ? ` (${o.subgiro})` : ''} · ${modeloClave(o.modelo)} · ${t}`;
  }
  return { novedad, puntos: lista.slice(0, 5), combinacion };
}

/** El bloque para el prompt del paso 1. */
export function bloquePuntos(r: ReturnType<typeof puntosPara>): string {
  if (!r.puntos.length && !r.novedad) return '';
  return `\n\nPUNTOS DEL PASO 1 PARA ESTE LEAD (${r.combinacion}); dilos en este orden, numerados 1. 2. 3., en sus palabras y sin agregar funciones que no estén aquí:${r.novedad ? `\nPRIMERO LA NOVEDAD (siempre antes de los puntos, como una de nuestras innovaciones más nuevas del giro): «${r.novedad}»` : ''}\n${r.puntos.map((p, i) => `${i + 1}. ${p}`).join('\n')}\nCierra con UNA pregunta abierta: cuál es el problema que hoy más quiere resolver, o qué le gustaría optimizar en su operación.`;
}
