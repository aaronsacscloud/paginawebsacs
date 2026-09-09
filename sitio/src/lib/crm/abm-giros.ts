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
};
