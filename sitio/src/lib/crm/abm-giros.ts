// ══ Los giros del motor Account-Based, con su nombre en la pantalla ══════════
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
};
