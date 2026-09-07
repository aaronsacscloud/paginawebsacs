// Catálogos del módulo de eventos que se comparten entre el navegador y el
// servidor. Sin imports: este archivo entra al bundle del cliente, y un import
// de supabase aquí metería la llave del servidor en el navegador.
// Giros de las PERSONAS (los mismos de Cuentas objetivo, para que el contacto
// que se registra en el stand quede clasificado igual que uno investigado).
export const GIROS: Record<string, string> = {
  cadenas: 'Cadenas de moda', boutiques: 'Boutiques', renta: 'Renta de vestidos y trajes', novias: 'Novias y XV',
  zapaterias: 'Zapaterías', western: 'Botas western', vintage: 'Vintage y segunda mano', joyeria: 'Joyería',
  relojerias: 'Relojerías', opticas: 'Ópticas', charro: 'Charro y danza', scrubs: 'Uniformes', telas: 'Telas y mercería',
  tallas: 'Tallas extra, maternidad y bebé', fabricantes: 'Fabricantes de ropa', distribuidores: 'Distribuidores',
  canal: 'Canal mayorista', deportiva: 'Ropa deportiva', infantil: 'Ropa infantil', operadores: 'Operadores y concept stores', otro: 'Otro',
};
// Giros a los que SIRVE un evento (vocabulario de la investigación).
export const GIROS_EVENTO: Record<string, string> = {
  boutiques: 'Boutiques', fabricantes: 'Fabricantes', distribuidores: 'Distribuidores', marcas: 'Marcas', zapaterias: 'Zapaterías',
  western: 'Western', novias: 'Novias y XV', renta_vestidos: 'Renta de vestidos', joyerias: 'Joyerías', relojerias: 'Relojerías',
  opticas: 'Ópticas', deportiva: 'Deportiva', ninos: 'Infantil', tallas: 'Tallas extra y maternidad', vintage: 'Vintage',
  lenceria: 'Lencería', uniformes: 'Uniformes', mayoreo_textil: 'Textil y mayoreo', consultoras: 'Consultoras', departamental: 'Departamentales',
  concept_store: 'Concept stores', consignacion: 'Consignación', cadenas: 'Cadenas', canal: 'Canal mayorista',
};
