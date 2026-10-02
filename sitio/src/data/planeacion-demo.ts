/**
 * La temporada SIMULADA de /planeacion-de-demanda (1-oct-2026).
 *
 * Todo es un EJEMPLO: una cadena ficticia de ropa deportiva (100 tiendas en 5 regiones, un CEDIS y tienda en
 * línea) que planea su Día del Padre 2027. Guion de la sesión «Nivelación moda flujo completo» (copia en
 * /opt/sacs/seed-demo-moda/proyecto/PROMPT-WEB-PLANEACION.md). Sin marcas reales ni competidores.
 *
 * Los números cuadran entre sí; si cambias uno, recalcula los que dependen de él:
 *  - Compra: 28,400 pronosticadas + 1,800 de colchón − 3,600 que ya tienes = 26,600 piezas por $7.7 M (de $8 M).
 *    Por proveedor: importados (shorts y joggers) 9,900 + 600 − 1,100 = 9,400 por $2.96 M;
 *    nacionales (polos y playeras 15,900 + 900 − 2,400 = 14,400; gorras y calcetas 2,600 + 300 − 100 = 2,800) = 17,200 por $4.74 M.
 *  - Primer reparto: 30,200 piezas (26,600 + 3,600); salen 18,100 (60 %) y se quedan 12,100 (40 %) en el CEDIS.
 *  - Recibido en la temporada: 30,200 + 360 (playera extra) + 540 (polo extra) = 31,100.
 *  - Vendido 29,110 = 93.6 %; sobrante 1,990 = 6.4 % (1,150 básicos que pasan + 840 al outlet).
 *  - A precio completo 25,660 = 82.5 % de lo recibido; rebajas $788 K = 3.7 % de $21.3 M.
 *  - v2 «limpio» (2-oct-2026): en pantalla van menos datos; los que se quitaron no cambian las cuentas.
 *  - Plan semanal (13 semanas, 3 may – 1 ago) suma 28,400; la venta real suma 29,110. A la semana 6 la real va
 *    14,510 contra 13,000 del plan (+12 %): la semana pico sube de 5,800 a 6,500 (fue 6,600).
 *  - Fechas de 2027 verificadas: lun 8 feb, mié 10 feb (8 feb + 2), vie 12 mar, lun 26 abr (26 abr − 75 días = 10 feb;
 *    − 45 días = 12 mar), jue 20 may + 21 días = jue 10 jun, dom 20 jun, lun 21 jun, mié 21 jul (+30 días), dom 1 ago.
 *
 * `obra: true` = EN CONSTRUCCIÓN en el motor (revisado el 1-oct-2026 contra sacs_api por la sesión de nivelación):
 * se muestra con una etiqueta discreta, sin fecha ni promesa de entrega. Lo demás es lógica viva del motor.
 */

export const OBRA = 'En construcción';

/* ─────────────── Acto 0 · La instrucción ─────────────── */
export const INSTRUCCION = {
  fecha: 'Lunes 8 de febrero de 2027',
  faltan: '19 semanas antes del Día del Padre',
  trozos: ['Sacs,', 'planea mi', 'Día del Padre:', 'compra,', 'reparte,', 'resurte', 'y dime qué', 'aprendimos.'],
  respuesta: { h: 'Entendido.', p: 'Empiezo por tus últimos tres Días del Padre.' },
};

export type Modo = 'sugerir' | 'aprobar' | 'auto';

export const FICHA = {
  temporada: {
    v: 'Día del Padre 2027',
    s: 'Venta del 3 de mayo al 1 de agosto. El evento: domingo 20 de junio.',
    otras: ['Navidad', 'Buen Fin', 'Hot Sale', 'Día de las Madres', 'Regreso a clases'],
    nota: 'La misma mecánica para cada temporada.',
  },
  alcance: { v: '100 tiendas, CEDIS y tienda en línea', s: '64 modelos, 18 de ellos nuevos.' },
  presupuesto: { v: '$8,000,000', s: 'de compra para toda la temporada.' },
  metas: { v: '80 % a precio completo', s: 'y rebajas de no más del 6 % de la venta.' },
  analiza: [
    { id: 'ventas', t: 'Las ventas de los últimos 3 Días del Padre' },
    { id: 'alza', t: 'El alza de cada evento' },
    { id: 'tallas', t: 'Las tallas y colores por tienda y región' },
    { id: 'inventario', t: 'Lo que hay en tiendas, en el CEDIS y en camino' },
    { id: 'entregas', t: 'El tiempo de entrega de cada proveedor' },
    { id: 'nuevos', t: 'Los modelos nuevos con sus parecidos' },
  ],
  candados: [
    'Las compras de más de $100,000 me las pasas a aprobar.',
    'No rebajes lo que llegó hace menos de 45 días.',
    'Mínimo 2 piezas por talla núcleo en cada tienda.',
  ],
  nucleo: 'Talla núcleo: las que más vendes, como la M y la L.',
  modos: [
    { id: 'sugerir' as Modo, t: 'Sugerir', s: 'Sacs propone y tú decides cada movimiento.' },
    { id: 'aprobar' as Modo, t: 'Aprobar', s: 'Sacs deja todo listo: traspasos «Por enviar» y órdenes de compra en borrador. Tú apruebas con un clic.' },
    { id: 'auto' as Modo, t: 'Automático', s: 'Con candados: los resurtidos de rutina del CEDIS salen solos y tienes 4 horas para objetar. Traspasos y compras grandes esperan tu clic.' },
  ],
};

/* ─────────────── Las semanas de la temporada (3 may – 1 ago 2027) ─────────────── */
export const SEMANAS = [
  { n: 1, ini: '3 may', fin: '9 may' }, { n: 2, ini: '10 may', fin: '16 may' }, { n: 3, ini: '17 may', fin: '23 may' },
  { n: 4, ini: '24 may', fin: '30 may' }, { n: 5, ini: '31 may', fin: '6 jun' }, { n: 6, ini: '7 jun', fin: '13 jun' },
  { n: 7, ini: '14 jun', fin: '20 jun', evento: true }, { n: 8, ini: '21 jun', fin: '27 jun' }, { n: 9, ini: '28 jun', fin: '4 jul' },
  { n: 10, ini: '5 jul', fin: '11 jul' }, { n: 11, ini: '12 jul', fin: '18 jul' }, { n: 12, ini: '19 jul', fin: '25 jul' },
  { n: 13, ini: '26 jul', fin: '1 ago' },
];
export const SEMANA_EVENTO = 7;

// Piezas por semana de toda la cadena. Los años pasados van alineados a la semana del evento.
export const PLAN_27 = [1500, 1700, 1900, 2100, 2500, 3300, 5800, 2200, 1700, 1500, 1500, 1400, 1300];   // suma 28,400
export const REAL_27 = [1640, 1890, 2130, 2350, 2800, 3700, 6600, 2150, 1500, 1250, 1100, 1100, 900];    // suma 29,110
export const REPRONOSTICO_27 = [1640, 1890, 2130, 2350, 2800, 3700, 6500, 2350, 1700, 1450, 1350, 1250, 1150]; // tras la semana 6
export const ANOS = [
  { ano: 2024, v: [1140, 1290, 1440, 1600, 1900, 2510, 4410, 1670, 1290, 1140, 1140, 1060, 990] },
  { ano: 2025, v: [1260, 1430, 1600, 1760, 2100, 2770, 4870, 1850, 1430, 1260, 1260, 1180, 1090] },
  { ano: 2026, v: [1380, 1560, 1750, 1930, 2300, 3040, 5340, 2020, 1560, 1380, 1380, 1290, 1200] },
];
// Los 3 picos que NO son demanda normal (se apagan en las curvas): año, semana y cuánto subió.
export const PICOS = [
  { ano: 2024, sem: 3, extra: 620, t: 'Venta nocturna' },
  { ano: 2025, sem: 10, extra: 540, t: 'Remate de bodega' },
  { ano: 2026, sem: 5, extra: 760, t: 'Hot Sale' },
];

/* ─────────────── Acto 1 · Pretemporada y pronóstico ─────────────── */
export type Paso = { id: string; clave: string | null; t: string; s?: string; obra?: boolean };
export const PASOS: Paso[] = [
  { id: 'catalogo', clave: null, t: 'Revisé tu catálogo: 64 modelos clasificados.', s: 'Departamento › Categoría › Subcategoría, temporada, básico o de temporada, fit, tela, tallas y colores. Tengo 2 dudas.' },
  { id: 'historia', clave: 'ventas', t: 'Leí 3 Días del Padre, de 2024 a 2026: 1.1 millones de tickets.', s: 'Una curva por año y, encima, el pronóstico 2027 con su banda.', obra: true },
  { id: 'picos', clave: 'ventas', t: 'Separé lo que fue evento de lo que es demanda real: marqué 3 picos.', s: 'Una venta nocturna, un remate de bodega y un Hot Sale. No cuentan como venta normal.' },
  { id: 'alza', clave: 'alza', t: 'El alza de Día del Padre: 2.3 veces lo normal.', s: 'La semana del 14 al 20 de junio.' },
  { id: 'nuevos', clave: 'nuevos', t: 'Pronostiqué los 18 modelos nuevos con sus 3 parecidos.', s: 'Un modelo sin historia se pronostica con los que más se le parecen.', obra: true },
  { id: 'tallas', clave: 'tallas', t: 'Repartí el pronóstico por región, tienda, talla y color.', s: 'El Norte vende más L y XL; el Centro, más M.' },
  { id: 'inventario', clave: 'inventario', t: 'Revisé lo que ya tienes: 3,600 piezas.', s: '2,100 en tiendas, 1,500 en el CEDIS y nada en camino.' },
  { id: 'cortes', clave: 'entregas', t: 'Calculé los cortes de pedido con el tiempo de entrega de cada proveedor.', s: 'Contando hacia atrás desde el 26 de abril, cuando todo debe estar en el CEDIS.' },
  { id: 'compra', clave: null, t: 'Armé la compra: 26,600 piezas por $7.7 M de tus $8 M.', s: '28,400 pronosticadas + 1,800 de colchón − 3,600 que ya tienes.', obra: true },
];

// a) La taxonomía (el árbol) y las dos dudas.
export const ARBOL = [
  { dep: 'Ropa deportiva', cats: [
    { c: 'Polos', n: 14, subs: ['Polo golf · 8', 'Polo piqué · 6'] },
    { c: 'Playeras', n: 16, subs: ['Dry-fit · 10', 'Básica · 6'] },
    { c: 'Shorts', n: 12, subs: ['Running · 7', 'Training · 5'] },
    { c: 'Pants', n: 8, subs: ['Jogger · 8'] },
  ] },
  { dep: 'Accesorios', cats: [
    { c: 'Gorras', n: 8, subs: ['Running · 5', 'Golf · 3'] },
    { c: 'Calcetas', n: 6, subs: ['Tobilleras · 4', 'Largas · 2'] },
  ] },
];
export const CAMPOS = [
  { k: 'Temporada', v: 'Primavera-Verano 2027' },
  { k: 'Ciclo', v: 'Básico de línea · de temporada · reorden' },
  { k: 'Fit', v: 'Slim · Regular · Relaxed' },
  { k: 'Tela', v: 'Piqué · Dry-fit · Nylon con elastano' },
  { k: 'UPF', v: '50+ en polos golf y dry-fit' },
  { k: 'Tallas núcleo', v: 'M y L (S y XL completan la curva)' },
];
export const DUDAS = [
  { q: 'La Playera Básica Blanca se vende todo el año. ¿Es básico de línea o de temporada?', ops: ['Básico de línea', 'De temporada'], sug: 0 },
  { q: 'Verde olivo es un color nuevo (Polo Golf). ¿En qué familia va?', ops: ['Verdes', 'Neutros'], sug: 0 },
];

// e) El modelo nuevo y sus 3 parecidos (piezas por semana).
export const NUEVO = {
  modelo: 'Polo Golf Verde Olivo', foto: 'polo-golf-olivo', total: 1100,
  pron: [54, 64, 74, 84, 101, 131, 227, 88, 66, 58, 55, 50, 45],
  parecidos: [
    { m: 'Polo Golf Marino', ano: 2025, foto: 'polo-golf-marino', v: [53, 64, 73, 82, 100, 130, 226, 88, 66, 58, 56, 51, 45] },
    { m: 'Polo Golf Gris', ano: 2026, foto: 'polo-golf-gris', v: [60, 70, 80, 90, 105, 135, 215, 85, 62, 55, 52, 48, 43] },
    { m: 'Polo Golf Blanco', ano: 2026, foto: 'polo-golf-blanco', v: [48, 58, 70, 80, 98, 128, 240, 92, 70, 62, 58, 52, 46] },
  ],
};

// f) Curvas de talla por región (% de la venta de cada región).
export const CURVAS = [
  { r: 'Norte', nota: 'más L y XL', v: [{ t: 'S', p: 8 }, { t: 'M', p: 22 }, { t: 'L', p: 34 }, { t: 'XL', p: 26 }, { t: 'XXL', p: 10 }] },
  { r: 'Centro', nota: 'más M', v: [{ t: 'S', p: 14 }, { t: 'M', p: 36 }, { t: 'L', p: 30 }, { t: 'XL', p: 15 }, { t: 'XXL', p: 5 }] },
];

// g) Lo que ya tienes.
export const INVENTARIO = [
  { k: 'En tiendas', n: 2100 },
  { k: 'En el CEDIS', n: 1500 },
  { k: 'En camino', n: 0 },
];

// h) Los cortes de pedido, contando hacia atrás desde el 26 de abril.
export const CORTES = {
  hoy: { f: 'lun 8 feb', t: 'Hoy' },
  meta: { f: 'lun 26 abr', t: 'Todo en el CEDIS' },
  venta: { f: 'lun 3 may', t: 'Arranca la venta' },
  evento: { f: 'dom 20 jun', t: 'Día del Padre' },
  proveedores: [
    { q: 'Shorts y joggers importados', dias: 75, corte: 'miércoles 10 de febrero', corto: 'mié 10 feb', nota: 'en 2 días', urgente: true },
    { q: 'Polos y playeras nacionales', dias: 45, corte: 'viernes 12 de marzo', corto: 'vie 12 mar', nota: 'en 32 días' },
  ],
};

// i) La compra.
export const COMPRA = { pronostico: 28400, colchon: 1800, tienes: 3600, compra: 26600, monto: '$7.7 M', presupuesto: '$8 M', usoPct: 96 };

/* ─────────────── Las tarjetas (pretemporada y temporada) ─────────────── */
export type Razon = { t: string; g?: { tipo: 'linea' | 'barras' | 'dias' | 'camino' | 'curva'; v?: number[]; e?: number; a?: string; b?: string; va?: number; vb?: number; ok?: boolean[]; et?: string[]; u?: string } };
export type Tarjeta = {
  id: string; acto: 'pre' | 'vivo';
  hora: string; tienda: string; tipo: string; titulo: string;
  foto?: string; modelo?: string; detalleQue: string;
  tallas?: { t: string; n: number }[];
  ruta?: string; llega?: string;
  porque: Razon[];
  escalon?: 1 | 2 | 3 | 4; respuestas?: string[];
  candado?: string;
  impacto: string[];
  boton: string; hecho: string;
  // rutina = entra en «Mandar las de rutina»; auto = se manda solo en modo Automático (solo resurtido del CEDIS); grande = compra con candado
  rutina?: boolean; auto?: boolean; grande?: boolean; obra?: boolean;
  origen?: string; destino?: string | string[];
};

export const ESCALERA = [
  { q: '¿Ya viene en camino?', a: 'Esperar' },
  { q: '¿Le sobra a otra tienda?', a: 'Traspaso' },
  { q: '¿Hay en el CEDIS?', a: 'Resurtido' },
  { q: '¿Nadie lo tiene?', a: 'Comprar' },
];

export const TARJETAS_PRE: Tarjeta[] = [
  {
    id: 'oc-importados', acto: 'pre', hora: 'lun 8 feb · 19:40', tienda: 'Proveedor importado', tipo: 'Orden de compra',
    titulo: 'Pide shorts y joggers hoy: el corte es en 2 días',
    foto: 'short-running-negro', modelo: 'Shorts y joggers · 20 modelos', detalleQue: '9,400 piezas por $2,960,000. Llegan al CEDIS el 26 de abril.',
    tallas: [{ t: 'S', n: 1100 }, { t: 'M', n: 2500 }, { t: 'L', n: 3000 }, { t: 'XL', n: 2000 }, { t: 'XXL', n: 800 }],
    ruta: 'Proveedor → CEDIS', llega: 'lunes 26 de abril',
    porque: [
      { t: 'El proveedor tarda 75 días. Para tener todo el 26 de abril, hay que pedir antes del miércoles 10 de febrero.', g: { tipo: 'camino', a: '10 feb', b: '26 abr', et: ['Pides', 'Llega'] } },
      { t: 'Pronóstico: 9,900 piezas + 600 de colchón − 1,100 que ya tienes = 9,400.', g: { tipo: 'barras', v: [9900, 600, -1100], et: ['Pronóstico', 'Colchón', 'Ya tienes'] } },
      { t: 'Se redondea a la corrida del proveedor: paquetes de 12 piezas (1-3-4-3-1).' },
      { t: 'El colchón se calcula por modelo, no por cada talla y color.' },
    ],
    escalon: 4, respuestas: ['No: no hay nada en camino.', 'No: a ninguna tienda le sobra.', 'No: el CEDIS no tiene.', 'Sí: comprar 9,400 piezas.'],
    candado: 'Son más de $100,000: te la paso a aprobar.',
    impacto: ['Asegura $5.8 M de venta de shorts y joggers.', 'Sin ella, la temporada arranca sin shorts ni joggers.'],
    boton: 'Aprobar compra', hecho: '✓ Orden de compra OC-1102 enviada al proveedor · llega el 26 de abril',
    grande: true,
  },
  {
    id: 'oc-nacionales', acto: 'pre', hora: 'lun 8 feb · 19:41', tienda: 'Proveedores nacionales', tipo: 'Orden de compra',
    titulo: 'Aprueba la compra de polos y playeras',
    foto: 'polo-pique-marino', modelo: 'Polos, playeras, gorras y calcetas · 44 modelos', detalleQue: '17,200 piezas por $4,740,000: 14,400 polos y playeras, 1,600 gorras y 1,200 pares de calcetas.',
    tallas: [{ t: 'S', n: 1600 }, { t: 'M', n: 4100 }, { t: 'L', n: 4700 }, { t: 'XL', n: 3000 }, { t: 'XXL', n: 1000 }],
    ruta: 'Proveedores → CEDIS', llega: 'lunes 26 de abril',
    porque: [
      { t: 'Los proveedores nacionales tardan 45 días: el corte es el viernes 12 de marzo.', g: { tipo: 'camino', a: '12 mar', b: '26 abr', et: ['Pides', 'Llega'] } },
      { t: 'Polos y playeras: 15,900 pronosticadas + 900 de colchón − 2,400 que ya tienes = 14,400.', g: { tipo: 'barras', v: [15900, 900, -2400], et: ['Pronóstico', 'Colchón', 'Ya tienes'] } },
      { t: 'Gorras y calcetas: 2,600 + 300 − 100 = 2,800.' },
      { t: 'Con las dos compras usas $7.7 M de tus $8 M.' },
    ],
    escalon: 4, respuestas: ['No: no hay nada en camino.', 'No: a ninguna tienda le sobra.', 'No: el CEDIS solo tiene lo de la temporada pasada.', 'Sí: comprar 17,200 piezas.'],
    candado: 'Son más de $100,000: te la paso a aprobar.',
    impacto: ['Asegura $12.4 M de venta de polos, playeras, gorras y calcetas.', 'Quedan $300 K del presupuesto para compras extra.'],
    boton: 'Aprobar compra', hecho: '✓ Órdenes OC-1103 a OC-1106 en borrador · salen el 12 de marzo',
    grande: true,
  },
  {
    id: 'reparto', acto: 'pre', hora: 'mar 27 abr · 06:00', tienda: 'CEDIS → 100 tiendas', tipo: 'Primer reparto',
    titulo: 'Primer reparto: 60 % a tiendas y 40 % se queda en el CEDIS',
    detalleQue: 'De 30,200 piezas salen 18,100 a las 100 tiendas y la tienda en línea. Se quedan 12,100 en el CEDIS.',
    ruta: 'CEDIS → 100 tiendas', llega: 'del 28 al 30 de abril',
    porque: [
      { t: 'En moda, lo que vende cada tienda se sabe hasta que arranca la temporada.' },
      { t: 'El 40 % se queda en el CEDIS para resurtir donde sí se venda.', g: { tipo: 'barras', v: [18100, 12100], et: ['A tiendas', 'En el CEDIS'] } },
      { t: 'Cada tienda recibe la curva completa: mínimo 2 piezas por talla núcleo.' },
      { t: 'Las tiendas A reciben más que las B y las C (3, 2 y 1).' },
    ],
    impacto: ['Ninguna tienda abre la temporada con tallas rotas.', '12,100 piezas listas para ir a donde se vendan.'],
    boton: 'Enviar instrucción', hecho: '✓ Reparto R-0001 · 18,100 piezas salen del CEDIS el 27 de abril',
    obra: true,
  },
];

export const TARJETAS_VIVO: Tarjeta[] = [
  {
    id: 'traspaso', acto: 'vivo', hora: 'mar 18 may · 09:12', tienda: 'Saltillo → Monterrey', tipo: 'Traspaso entre tiendas',
    titulo: 'Polo Piqué Marino: L ×4 y XL ×2 de Saltillo a Monterrey',
    foto: 'polo-pique-marino', modelo: 'Polo Piqué Marino', detalleQue: '6 piezas de Saltillo a Monterrey. Llegan mañana.',
    tallas: [{ t: 'S', n: 0 }, { t: 'M', n: 0 }, { t: 'L', n: 4 }, { t: 'XL', n: 2 }, { t: 'XXL', n: 0 }],
    ruta: 'Saltillo → Monterrey', llega: 'mañana, miércoles 19 de mayo',
    porque: [
      { t: 'Monterrey se queda sin L en 4 días: vende 0.5 al día y le quedan 2.', g: { tipo: 'linea', v: [0.3, 0.4, 0.5, 0.4, 0.6, 0.5, 0.7, 0.5, 0.4, 0.6, 0.5, 0.6, 0.5, 0.5] } },
      { t: 'En Saltillo sobra: tiene 7 L y vende 0.1 al día. Le alcanza para 70 días.', g: { tipo: 'dias', a: 'Saltillo', b: 'Monterrey', va: 70, vb: 4 } },
      { t: 'El CEDIS no tiene L hasta el martes. Entre tiendas llega mañana.', g: { tipo: 'camino', a: 'hoy', b: 'mañana', et: ['Sale de Saltillo', 'Llega a Monterrey'] } },
    ],
    escalon: 2, respuestas: ['No: el resurtido del CEDIS sale hasta el martes.', 'Sí: Saltillo tiene 7 L y vende 0.1 al día.'],
    impacto: ['$5,394 de venta que se salva.', '6 piezas dejan de sobrar en Saltillo.'],
    boton: 'Enviar instrucción', hecho: '✓ Traspaso T-2291 en la lista de Saltillo para hoy',
    rutina: true, origen: 'Saltillo', destino: 'Monterrey',
  },
  {
    id: 'resurtido', acto: 'vivo', hora: 'mié 19 may · 07:00', tienda: 'CEDIS → 14 tiendas del Norte', tipo: 'Resurtido del CEDIS',
    titulo: 'Short Running Negro L y XL: 84 piezas a 14 tiendas del Norte',
    foto: 'short-running-negro', modelo: 'Short Running Negro', detalleQue: '84 piezas, 6 por tienda. Salen hoy y llegan mañana.',
    tallas: [{ t: 'S', n: 0 }, { t: 'M', n: 0 }, { t: 'L', n: 48 }, { t: 'XL', n: 36 }, { t: 'XXL', n: 0 }],
    ruta: 'CEDIS → 14 tiendas del Norte', llega: 'jueves 20 de mayo',
    porque: [
      { t: 'El Norte vende 38 % más tallas grandes de lo planeado.', g: { tipo: 'barras', v: [100, 138], et: ['Plan', 'Real'], u: '%' } },
      { t: 'Para eso se guardó el 40 % en el CEDIS: hay 1,240 L y XL.' },
      { t: 'Ninguna tienda del Norte tiene L y XL de sobra para traspasar.' },
      { t: 'Sin resurtido, se acaban en 6 días, a cuatro semanas del evento.', g: { tipo: 'dias', a: 'Con resurtido', b: 'Sin resurtido', va: 31, vb: 6 } },
    ],
    escalon: 3, respuestas: ['No: no hay nada en camino.', 'No: todas las del Norte van cortas de L y XL.', 'Sí: 1,240 L y XL en el CEDIS.'],
    impacto: ['$54,516 de venta que se salva.', '28 agotados evitados: L y XL en 14 tiendas.'],
    boton: 'Enviar instrucción', hecho: '✓ Resurtido R-5307 sale del CEDIS hoy a las 18:00',
    rutina: true, auto: true, origen: 'CEDIS', destino: 'norte',
  },
  {
    id: 'compra', acto: 'vivo', hora: 'jue 20 may · 10:30', tienda: 'Proveedor de playeras', tipo: 'Compra extra',
    titulo: 'Playera Dry-Fit Blanca: 1 corrida más, 360 piezas',
    foto: 'playera-dryfit-blanca', modelo: 'Playera Dry-Fit Blanca', detalleQue: '1 corrida de 360 piezas por $104,400. Llega el 10 de junio.',
    tallas: [{ t: 'S', n: 40 }, { t: 'M', n: 80 }, { t: 'L', n: 120 }, { t: 'XL', n: 80 }, { t: 'XXL', n: 40 }],
    ruta: 'Proveedor → CEDIS', llega: 'jueves 10 de junio',
    porque: [
      { t: 'Va 18 % arriba del plan.', g: { tipo: 'barras', v: [100, 118], et: ['Plan', 'Real'], u: '%' } },
      { t: 'Con todo lo que hay en la red (tiendas, CEDIS y en camino) se acaba el 12 de junio, 8 días antes del evento.', g: { tipo: 'linea', v: [100, 88, 75, 62, 49, 36, 22, 9, 0], e: 8 } },
      { t: 'El proveedor tarda 21 días: hoy, jueves 20 de mayo, es el último día que conviene pedirla.', g: { tipo: 'camino', a: '20 may', b: '10 jun', et: ['Pides hoy', 'Llega'] } },
      { t: 'Llega con 7 semanas de venta por delante. Sacs no compra lo que llegaría con menos de 4.' },
    ],
    escalon: 4, respuestas: ['No: no hay nada en camino.', 'No: a ninguna tienda le sobra.', 'No: el CEDIS tiene 40 y no alcanzan.', 'Sí: 1 corrida de 360 piezas.'],
    candado: 'Son $104,400: más de $100,000, así que te pide aprobar.',
    impacto: ['$197,640 de venta posible.', 'Llega 10 días antes del evento.'],
    boton: 'Aprobar compra', hecho: '✓ Orden de compra OC-1184 enviada al proveedor · llega el 10 de junio',
    grande: true, origen: 'Proveedor', destino: 'CEDIS',
  },
  {
    id: 'esperar', acto: 'vivo', hora: 'lun 24 may · 08:40', tienda: 'Querétaro', tipo: 'Esperar',
    titulo: 'Pants Jogger Gris: no muevas nada',
    foto: 'jogger-gris', modelo: 'Pants Jogger Gris', detalleQue: 'Vienen 8 piezas del CEDIS, dos de cada talla de la S a la XL. Llegan el jueves.',
    tallas: [{ t: 'S', n: 2 }, { t: 'M', n: 2 }, { t: 'L', n: 2 }, { t: 'XL', n: 2 }],
    ruta: 'CEDIS → Querétaro (ya en camino)', llega: 'jueves 27 de mayo',
    porque: [
      { t: 'Querétaro va corto de joggers, pero ya vienen 8 piezas del CEDIS.', g: { tipo: 'camino', a: 'hoy', b: 'jueves', et: ['En camino', 'Llega'] } },
      { t: 'Con lo que tiene, le alcanza hasta el viernes. Llegan el jueves.', g: { tipo: 'dias', a: 'Le alcanza', b: 'Llegan en', va: 4, vb: 3 } },
      { t: 'Mandar más hoy sería pagar dos fletes por lo mismo.' },
    ],
    escalon: 1, respuestas: ['Sí: 8 piezas del CEDIS llegan el jueves.'],
    impacto: ['Un flete que te ahorras.', 'Ninguna pieza de más en la tienda.'],
    boton: 'Entendido, esperar', hecho: '✓ Querétaro en espera: Sacs revisa el jueves que haya llegado',
    rutina: true, auto: true, destino: 'Querétaro',
  },
  {
    id: 'talla', acto: 'vivo', hora: 'mar 1 jun · 12:15', tienda: 'Guadalajara Sur → Zapopan', tipo: 'Talla rota',
    titulo: 'Polo Piqué Blanco: a Zapopan le falta la M',
    foto: 'polo-pique-blanco', modelo: 'Polo Piqué Blanco', detalleQue: '2 piezas M de Guadalajara Sur a Zapopan. Llegan mañana.',
    tallas: [{ t: 'S', n: 0 }, { t: 'M', n: 2 }, { t: 'L', n: 0 }, { t: 'XL', n: 0 }, { t: 'XXL', n: 0 }],
    ruta: 'Guadalajara Sur → Zapopan', llega: 'mañana, miércoles 2 de junio',
    porque: [
      { t: 'A Zapopan se le acabó la M: la curva se rompió.', g: { tipo: 'curva', ok: [true, false, true, true, true], et: ['S', 'M', 'L', 'XL', 'XXL'] } },
      { t: 'Sin su talla núcleo la prenda se vende menos, aunque haya otras: la clienta no encuentra la suya.' },
      { t: 'Tu candado: mínimo 2 piezas por talla núcleo en cada tienda.' },
      { t: 'Guadalajara Sur tiene 7 M y vende 0.2 al día: le sobran.', g: { tipo: 'dias', a: 'Guadalajara Sur', b: 'Zapopan', va: 35, vb: 0 } },
    ],
    escalon: 2, respuestas: ['No: el próximo resurtido sale en 9 días.', 'Sí: Guadalajara Sur tiene 7 M.'],
    impacto: ['$1,798 de venta que se salva, y la curva completa.', 'La M deja de sobrar en Guadalajara Sur.'],
    boton: 'Enviar instrucción', hecho: '✓ Traspaso T-2304 · Guadalajara Sur → Zapopan, llega mañana',
    rutina: true, origen: 'Guadalajara Sur', destino: 'Zapopan',
  },
  {
    id: 'evento', acto: 'vivo', hora: 'lun 7 jun · 08:05', tienda: 'Mérida', tipo: '¿Evento o demanda real?',
    titulo: 'Mérida vendió 3 veces lo normal ayer',
    foto: 'short-running-negro', modelo: 'Shorts de running y calcetas', detalleQue: 'Domingo 6 de junio: 3.1 veces su venta normal.',
    porque: [
      { t: 'Ayer hubo un medio maratón en Mérida.', g: { tipo: 'linea', v: [11, 12, 10, 13, 12, 11, 34, 12], e: 6 } },
      { t: 'Si cuenta como demanda normal, el pronóstico de Mérida sube y le mandas de más.' },
      { t: 'Marcado como evento, el pico se queda fuera del pronóstico.' },
    ],
    impacto: ['Evita mandarle a Mérida unas 40 piezas de más.'],
    boton: 'Es evento', hecho: '✓ Marcado como evento: no cuenta para el pronóstico de Mérida',
    destino: 'Mérida',
  },
];

// Lo de rutina que no sale como tarjeta (entra en «Mandar las de rutina»): 12 en total con las de arriba.
export const RUTINA = { total: 12, resurtidos: 7, traspasos: 5 };

/* ─────────────── Las 100 tiendas, por región ─────────────── */
export const REGIONES = [
  { id: 'norte', r: 'Norte', ciudades: [['Monterrey', 6], ['Saltillo', 3], ['Chihuahua', 3], ['Hermosillo', 3], ['Torreón', 3], ['Tijuana', 3], ['Culiacán', 3]] },
  { id: 'bajio', r: 'Bajío', ciudades: [['León', 4], ['Querétaro', 5], ['Aguascalientes', 3], ['San Luis Potosí', 3], ['Irapuato', 3]] },
  { id: 'centro', r: 'Centro', ciudades: [['CDMX', 18], ['Puebla', 4], ['Toluca', 4], ['Cuernavaca', 2], ['Pachuca', 2]] },
  { id: 'occidente', r: 'Occidente', ciudades: [['Guadalajara', 5], ['Guadalajara Sur', 1], ['Zapopan', 4], ['Morelia', 2], ['Colima', 2]] },
  { id: 'sureste', r: 'Sureste', ciudades: [['Mérida', 4], ['Cancún', 4], ['Villahermosa', 2], ['Veracruz', 2], ['Oaxaca', 2]] },
] as const;

// El ticker de ventas (precio de lista).
export const TICKER = [
  'Monterrey · Polo Piqué Marino L · $899', 'Tienda en línea · Pants Jogger Gris M · $999', 'Guadalajara · Short Running Negro M · $649',
  'Mérida · Calcetas tobilleras (3 pares) · $299', 'CDMX · Polo Golf Marino L · $1,099', 'Saltillo · Playera Dry-Fit Blanca XL · $549',
  'Puebla · Gorra Running Negra · $449', 'León · Short Running Negro L · $649', 'Querétaro · Polo Piqué Blanco M · $899',
  'Hermosillo · Playera Dry-Fit Blanca L · $549', 'Cancún · Short Training Gris M · $599', 'Toluca · Polo Golf Gris M · $1,099',
  'Tijuana · Pants Jogger Gris L · $999', 'Zapopan · Polo Piqué Marino M · $899', 'CDMX · Playera Básica Blanca M · $349',
  'Chihuahua · Short Running Negro XL · $649',
];

// Lo que pasa cada semana en la consola en vivo (de la 1 a la 7).
export const AVISO_SEMANA_6 = { t: 'Vas 12 % arriba del plan.', s: 'La semana pico sube de 5,800 a 6,500 piezas.' };

/* ─────────────── Acto 3 · Después del evento ─────────────── */
export const CIERRE = {
  fecha: 'Lunes 21 de junio de 2027',
  escalones: [
    { pct: '−20 %', f: 'lunes 21 de junio', t: 'A los 22 modelos con más de 6 semanas de inventario.' },
    { pct: '−40 %', f: 'miércoles 21 de julio', t: 'A los que no giren en 30 días.' },
    { pct: 'Outlet', f: 'domingo 1 de agosto', t: 'Lo que quede se va al outlet.' },
  ],
  protegidos: [
    { t: '9 modelos nuevos', s: 'Llegaron hace menos de 45 días: son la temporada que entra.' },
    { t: 'Los básicos', s: 'Calcetas y playera básica pasan a la siguiente temporada a precio completo.' },
  ],
  // Vivo: Sacs avisa cuándo conviene juntar lo suelto antes de rebajar. En construcción: el plan automático que decide a qué tiendas juntar.
  consolidar: { t: 'Sacs te avisa cuándo conviene juntar lo suelto antes de rebajar.', s: '1 o 2 tallas por tienda no se venden solas. En el ejemplo, 312 piezas sueltas en 61 tiendas se juntan en 18, con la curva completa.', obra: 'El plan automático, en construcción' },
  quedo: {
    total: 1990, pct: '6.4 %', basicos: 1150, outlet: 840,
  },
  bio: {
    modelo: 'Polo Piqué Marino', foto: 'polo-pique-marino',
    hitos: [
      { f: '30 abr', t: 'Llegó' },
      { f: '3 may', t: 'Arrancó' },
      { f: '26 may', t: 'Pagó su lote', s: 'día 24 de venta' },
      { f: '14–20 jun', t: 'Su pico' },
      { f: '21 jun', t: '−20 %', s: 'solo S y XXL' },
      { f: '1 ago', t: 'Vendió el 96 %' },
    ],
    margen: '$1.7 M de margen',
  },
  boton: 'Armar la rebaja',
  hecho: '✓ Lista y etiquetas listas: 22 modelos a −20 % desde el 21 de junio. Te recuerdo el −40 % el 21 de julio.',
  nota: 'Sacs arma la lista y las etiquetas; el cambio de precio lo confirmas tú.',
};

/* ─────────────── Acto 4 · Resultado y lo que aprendió ─────────────── */
export const RESULTADO = {
  fecha: 'Lunes 2 de agosto de 2027',
  // v2 «limpio» (2-oct-2026): solo 6 indicadores; la exactitud del pronóstico va con «lo que aprendió».
  kpis: [
    { k: 'Venta neta', v: '$21.3 M', s: '$700 K arriba del plan', e: 'Lo que vendiste, ya sin descuentos ni devoluciones.' },
    { k: '% vendido', v: '93.6 %', s: 'de todo lo que llegó', e: 'De cada 100 piezas que recibiste, cuántas se vendieron.' },
    { k: 'A precio completo', v: '82.5 %', s: 'meta: 80 %', e: 'Lo que se vendió sin rebaja, contra todo lo que llegó.', meta: true },
    { k: 'Margen bruto', v: '60 %', s: 'de la venta', e: 'Lo que te queda de cada peso después de pagar la mercancía.' },
    { k: 'Rebajas', v: '3.7 %', s: 'meta: no más de 6 %', e: 'Lo que dejaste de cobrar por descuentos.', meta: true },
    { k: 'Rendimiento del inventario', v: '3.1', s: 'veces', e: 'Cada peso que tuviste en inventario dejó $3.10 de margen.' },
  ],
  exactitud: { v: '94 %', s: 'de exactitud del pronóstico', e: 'Qué tan cerca quedó el pronóstico de lo que de verdad se vendió (81 % por modelo y 68 % por tienda y talla).' },
  aciertos: [
    'El pico llegó cuando se pronosticó: 2.3 veces lo normal pronosticado, 2.4 real.',
    'Los traspasos salvaron $850 K de venta antes del domingo.',
    'La playera blanca extra llegó 10 días antes del evento.',
  ],
  errores: [
    { t: 'El Polo Golf Verde Olivo (nuevo) se pronosticó como sus parecidos: 1,100 piezas. Vendió 520.', s: 'El color no pegó.' },
    { t: 'El Short Negro L se agotó en el Bajío 5 días antes del evento.', s: '$180 K de venta perdida.' },
    { t: 'El proveedor de joggers llegó 8 días tarde.', s: 'Su corte se calculó con 75 días; tardó 83.' },
  ],
  aprendio: [
    'Los colores nuevos en polos se pronostican al 60 % de sus parecidos, hasta ver 2 semanas de venta.',
    'En el Bajío, 15 % más de L y XL en shorts.',
    'El proveedor de joggers en realidad tarda 83 días: su corte se adelanta.',
  ],
  nota: 'Se aplica a la siguiente temporada con tu visto bueno.',
  boton: 'Aplicar a Navidad 2027',
  hecho: '✓ Navidad 2027 arranca con lo aprendido. Te lo paso a revisar antes.',
  ciclo: ['Instrucción', 'Pronóstico', 'Temporada', 'Cierre', 'Aprendizaje'],
  cicloFin: 'La siguiente temporada arranca más exacta.',
};

/* ─────────────── Las fases de la consola ─────────────── */
export const FASES = [
  { id: 'instruccion', t: 'Instrucción', ancla: 'pd-instruccion' },
  { id: 'pre', t: 'Pretemporada', ancla: 'pd-pre' },
  { id: 'vivo', t: 'Temporada', ancla: 'pd-vivo' },
  { id: 'cierre', t: 'Cierre', ancla: 'pd-cierre' },
  { id: 'resultado', t: 'Resultado', ancla: 'pd-resultado' },
];

/* ─────────────── Lo que cambia (BeforeAfter) y preguntas frecuentes ─────────────── */
export const ANTES_DESPUES = {
  titulo: 'Lo que cambia en tu temporada',
  antes: { label: 'Sin planear:', h: 'La temporada te sorprende.', puntos: [
    'Compras con el Excel del año pasado y el olfato del comprador.',
    'La L se agota en una tienda y sobra en la de al lado.',
    'Se te pasa el corte del proveedor y la mercancía llega tarde.',
    'Rebajas tarde y parejas: regalas margen en lo que sí se vendía.',
  ] },
  despues: { label: 'Con Sacs:', h: 'Cada pieza, donde se vende.', puntos: [
    'Un pronóstico por temporada, modelo y tienda, con la curva de tallas de cada región.',
    'Antes de mover nada revisa lo que viene en camino; luego traspasa, resurte o compra.',
    'Te avisa del corte de cada proveedor con 8 semanas de anticipación.',
    'Rebajas por escalones, sin tocar los básicos ni lo que acaba de llegar.',
  ] },
};

export const PREGUNTAS = [
  { question: '¿Qué es la planeación de demanda para moda?', answer: 'Es decidir con datos qué comprar, cuánto, para qué tienda, en qué talla y color, y cuándo. En moda se planea por temporada: cada prenda tiene pocas semanas para venderse a precio completo, así que comprar tarde o en la talla equivocada sale caro.' },
  { question: '¿En qué se diferencia de un pronóstico de ventas normal?', answer: 'En una tienda de ropa no basta con saber cuánto vas a vender. Importan la talla, el color, la tienda y la semana. Sacs pronostica por temporada, modelo y tienda, y reparte con la curva de tallas de cada grupo de tiendas: en el ejemplo, el Norte vende más L y XL y el Centro, más M.' },
  { question: '¿Qué datos necesito para empezar?', answer: 'Tus ventas, tu inventario por tienda y CEDIS, y tus proveedores con su tiempo de entrega. Sacs arma solo el diccionario de moda (categoría, temporada, básico o de temporada, tallas núcleo y colores) y tú confirmas lo que tenga duda.' },
  { question: '¿Cómo decide si traspasa, resurte o compra?', answer: 'Con una escalera. Primero revisa lo que ya viene en camino: si alcanza, espera. Si falta, lo saca de una tienda donde sobra de verdad; después, del CEDIS; y solo compra lo que nadie cubre, ya descontando lo que hay en toda la red. Los faltantes muy chicos no se mueven, porque no vale el flete.' },
  { question: '¿Sacs compra y mueve mercancía solo?', answer: 'Tú eliges. De entrada, todo espera tu aprobación: los traspasos salen «Por enviar» y las compras como orden en borrador, a un clic. Con el modo automático con candados, los resurtidos de rutina del CEDIS salen solos y tienes 4 horas para objetar, y las órdenes de compra respetan tu presupuesto y la aprobación por monto. Los traspasos entre tiendas en automático están en construcción.' },
  { question: '¿Cómo maneja eventos como el Día del Padre o el Buen Fin?', answer: 'Calcula hacia atrás el corte de pedido de cada proveedor, te avisa con 8 semanas de anticipación y te pregunta si un pico raro fue evento o demanda real, para no inflar el pronóstico. Hoy el calendario de avisos trae Reyes, San Valentín, Día del Niño, Día de las Madres, Regreso a clases, Buen Fin y Navidad; Día del Padre, Hot Sale y Semana Santa están en construcción, y mientras tanto los armas como colección.' },
  { question: '¿Cómo maneja las rebajas y lo que sobra?', answer: 'Por escalones: −20 % y, a los 30 días, −40 %, con un recordatorio para el segundo escalón. No toca los básicos ni lo que llegó hace menos de 45 días. Sacs arma la lista y las etiquetas, y el cambio de precio lo confirmas tú.' },
  { question: '¿Los números de esta página son reales?', answer: 'No. Es una temporada de ejemplo de una cadena ficticia de ropa deportiva. Lo marcado «en construcción» todavía no está disponible, y no le ponemos fecha.' },
  { question: '¿En qué plan viene?', answer: 'En el plan Automatiza, junto con los avisos, los reportes y el pronóstico de demanda por modelo y tienda.' },
];
