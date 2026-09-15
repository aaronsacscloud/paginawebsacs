// ══ Los giros del motor Account-Based, con su nombre en la pantalla ══════════
import { paisDe } from './abm-paises';
//
// Un solo archivo, sin dependencias de servidor, para que lo importen igual
// las rutas de la API y los componentes del navegador. Antes estaba copiado en
// tres lugares y ninguno conocía los giros cargados por el barrido de Maps.
export const GIROS: Record<string, string> = {
  cadenas: 'Cadenas de moda', boutiques: 'Boutiques', renta: 'Renta de vestidos y trajes',
  novias: 'Novias', zapaterias: 'Zapaterías', western: 'Botas western', vintage: 'Vintage y segunda mano',
  joyeria: 'Joyería', relojerias: 'Relojerías', charro: 'Charro y danza', scrubs: 'Uniformes médicos',
  telas: 'Telas y mercería', tallas: 'Tallas extra, maternidad y bebé', deportiva: 'Ropa deportiva y uniformes',
  disfraces: 'Disfraces', sublimado: 'Playeras personalizadas y sublimado', outlets: 'Outlets y saldos',
  jeans: 'Jeans y mezclilla', trajesbano: 'Trajes de baño y playa',
  fabricantes: 'Fabricantes y maquila', distribuidores: 'Distribuidores de ropa',
  operadores: 'Operadores y concept stores', aliados: 'Consultoras y escuelas', canal: 'Canal mayorista',
  // Quien SURTE a las tiendas, no quien vende al público. Va aparte de `canal`
  // —que son las plazas (Moroleón, Zapotlanejo), no proveedores sueltos— y de
  // `distribuidores`, que revende marca ajena. Un mayorista de corredor
  // (Villa Hidalgo, León) fabrica lo suyo y vende por mayoreo y multimarca.
  mayoristas: 'Proveedores mayoristas y multimarca',
  // Quien FABRICA el calzado, no quien lo vende al público —esos son
  // `zapaterias`—. El corredor de León y San Francisco del Rincón: marcas,
  // maquila y los proveedores de la propia industria (suelas, hormas, pieles),
  // que entran marcados porque a esos un ERP de tienda no les sirve.
  calzado: 'Calzado · fabricantes y marcas',
  // La MARCA que expone en feria (Intermoda) para que tiendas y boutiques le
  // levanten pedido: ropa sobre todo, y también joyería, bolsas, sombreros y
  // accesorios. Va aparte de `fabricantes`/`distribuidores` —donde también
  // cayeron 1,600 negocios del barrido de Maps— porque su guion es otro: el
  // pedido de feria, la curva por talla y color, la reposición entre ferias.
  marcas: 'Marcas de moda · expositores de feria',
};

// ── De qué es «su operación», para el cierre de cada correo ─────────────────
//
// El bloque de cierre del correo dice «le mostramos paso a paso cómo optimizar
// su operación de vestidos de novia». Ese complemento cambia por giro y se
// escribe como lo diría la persona del ramo, no como el nombre de catálogo de
// arriba («Calzado · fabricantes y marcas» no cabe en una frase).
export const OPERACION: Record<string, string> = {
  cadenas: 'cadena de tiendas', boutiques: 'boutique', renta: 'renta de vestidos y trajes',
  novias: 'vestidos de novia', zapaterias: 'zapatería', western: 'botas y ropa western',
  vintage: 'ropa vintage y de segunda mano', joyeria: 'joyería', relojerias: 'relojería',
  charro: 'ropa de charro y danza', scrubs: 'uniformes médicos', telas: 'telas y mercería',
  tallas: 'tallas extra, maternidad y bebé', deportiva: 'ropa deportiva y uniformes',
  disfraces: 'disfraces', sublimado: 'playeras personalizadas', outlets: 'saldos y outlet',
  jeans: 'mezclilla', trajesbano: 'trajes de baño', fabricantes: 'fábrica y maquila',
  distribuidores: 'distribución de ropa', operadores: 'tiendas', aliados: 'clientes de moda',
  canal: 'mayoreo', mayoristas: 'mayoreo y multimarca', calzado: 'fábrica de calzado', marcas: 'marca',
};

/** «su operación de …» para un giro; si el giro no está, «moda» sirve para todos. */
export function operacionDe(giro?: string | null): string {
  return OPERACION[String(giro || '')] || 'moda';
}

// ── La página del giro en sacscloud.com ─────────────────────────────────────
//
// Regla del dueño (14-sep-2026, novias): «no los mandes al home de Sacscloud,
// mándalos directo al link de novias y siempre invítalas a ver la página para
// que vean más detalles». Solo giros con página PROPIA y terminada (las de
// src/pages/giros/ que no son el _coming-soon); un giro sin página no manda a
// ningún lado: mejor nada que el home genérico.
export const PAGINA_GIRO: Record<string, { ruta: string; nombre: string }> = {
  novias: { ruta: '/giros/novias-y-fiesta', nombre: 'novias y fiesta' },
  renta: { ruta: '/giros/novias-y-fiesta', nombre: 'novias y fiesta' },
  joyeria: { ruta: '/giros/joyeria', nombre: 'joyerías' },
  zapaterias: { ruta: '/giros/zapateria', nombre: 'zapaterías' },
  boutiques: { ruta: '/giros/boutique-multimarca', nombre: 'boutiques multimarca' },
  marcas: { ruta: '/giros/marcas-de-ropa', nombre: 'marcas de ropa' },
  fabricantes: { ruta: '/giros/marcas-de-ropa', nombre: 'marcas de ropa' },
  deportiva: { ruta: '/giros/activewear', nombre: 'ropa deportiva' },
};

/** La página del giro con su URL completa, o null si el giro no tiene.
 *
 *  Con país (14-sep-2026, segmentación por país): una cuenta de fuera de
 *  México va a la página de SU país cuando existe —hoy solo novias y fiesta
 *  tiene versión por país, con su moneda y sin cifras que solo son ciertas
 *  en México—. Los demás giros no tienen página que le hable a Colombia o a
 *  Chile, y mandar a la de México («personas de soporte en México», precios
 *  en pesos) contradice el correo: mejor nada que la página equivocada. */
export function paginaDe(giro?: string | null, sitio = 'https://www.sacscloud.com', pais?: string | null): { url: string; nombre: string } | null {
  const p = PAGINA_GIRO[String(giro || '')];
  if (!p) return null;
  const base = sitio.replace(/\/$/, '');
  const pp = paisDe(pais);
  if (pp.region === 'mexico') return { url: base + p.ruta, nombre: p.nombre };
  if (p.ruta === '/giros/novias-y-fiesta') return { url: base + pp.landingNovias, nombre: `${p.nombre} en ${pp.nombre}` };
  return null;
}
