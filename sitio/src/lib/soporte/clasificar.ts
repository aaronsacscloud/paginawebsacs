// SOPORTE · Clasificación de tickets por TEMA y SENTIMIENTO. Basado en reglas
// (determinista, sin costo ni dependencia externa) sobre asunto + vista previa.
// Alimenta el dashboard de soporte (top temas) y la penalización de salud/riesgo.

export const TEMAS = [
  'facturacion', 'inventario', 'bancos', 'pos', 'ventas', 'ecommerce',
  'nivelacion', 'lealtad', 'reportes', 'usuarios', 'producto', 'pagos', 'otros',
] as const;
export type Tema = typeof TEMAS[number];

export const TEMA_LABEL: Record<string, string> = {
  facturacion: 'Facturación', inventario: 'Inventario', bancos: 'Bancos',
  pos: 'Punto de venta', ventas: 'Ventas', ecommerce: 'E-commerce',
  nivelacion: 'Nivelación', lealtad: 'Lealtad', reportes: 'Reportes',
  usuarios: 'Usuarios/Permisos', producto: 'Petición de producto',
  pagos: 'Cobros/Pagos', otros: 'Otros',
};

// Orden importa: el primer tema con match gana.
const REGLAS: Array<[Tema, RegExp]> = [
  ['facturacion', /factur|cfdi|complement|timbr|sat\b|iva\b|desglos|nota de cr|xml/i],
  ['bancos', /banco|conciliaci|syncfy|paybook|bbva|santander|transferenc|estado de cuenta/i],
  ['nivelacion', /nivelaci|cubo|resurtid|m[ií]nimo|m[áa]ximo|traspas|cedis/i],
  ['inventario', /inventar|existenc|kardex|conteo|almac[ée]n|stock|merma/i],
  ['pos', /punto de venta|\bpos\b|caja|corte|turno|ticket de venta|impresora|apertura/i],
  ['ecommerce', /ecommerce|e-commerce|tienda en l|checkout|carrito|widget|catalog[oó]/i],
  ['lealtad', /lealtad|cashback|puntos|moneder|recompens/i],
  ['reportes', /reporte|dashboard|estad[íi]stic|gr[áa]fic|export/i],
  ['usuarios', /usuario|permis|acceso|contrase|login|rol\b|grupo/i],
  ['pagos', /\bcobro|\bpago|suscrip|renovaci|tarjeta|stripe|mercado ?pago/i],
  ['producto', /ser[íi]a posible|pueden agregar|funci[oó]n nueva|sugeren|me gustar[íi]a que|solicit.*m[oó]dulo|no tiene la opci/i],
  ['ventas', /\bventa|apartado|pedido|devoluci|reembols|cliente frecuente/i],
];

export function clasificarTema(texto: string): Tema {
  const t = (texto || '').toLowerCase();
  for (const [tema, re] of REGLAS) if (re.test(t)) return tema;
  return 'otros';
}

// Sentimiento/urgencia: urgente > negativo > neutral. (No marcamos 'positivo'
// en tickets entrantes; el positivo real lo mide la CSAT posterior.)
const RE_URGENTE = /urgent|no (puedo|podemos|funciona|sirve|carga|abre|deja)|no me deja|ca[íi]d[oa]|se cay[oó]|todo el d[íi]a|para(do|da) la operaci|no factur|perd[íi] .*(venta|dinero)|error cr[íi]tico|inmediat|ya mismo|emergencia|urge/i;
const RE_NEGATIVO = /no (me )?(gust|conven|resuelv)|mal servicio|p[eé]sim|molest|inconform|queja|reclam|frustr|otra vez|de nuevo|sigue (igual|fallando|sin)|no ha(n)? resuelto|llevo (d[íi]as|semanas)/i;

export function clasificarSentimiento(texto: string): 'urgente' | 'negativo' | 'neutral' {
  const t = (texto || '');
  if (RE_URGENTE.test(t)) return 'urgente';
  if (RE_NEGATIVO.test(t)) return 'negativo';
  return 'neutral';
}

export function clasificar(asunto?: string | null, preview?: string | null): { tema: Tema; sentimiento: 'urgente' | 'negativo' | 'neutral' } {
  const texto = `${asunto || ''} ${preview || ''}`.trim();
  return { tema: clasificarTema(texto), sentimiento: clasificarSentimiento(texto) };
}
