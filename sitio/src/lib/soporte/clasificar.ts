// SOPORTE · Clasificación de tickets por TEMA y SENTIMIENTO. Basado en reglas
// (determinista, sin costo ni dependencia externa) sobre asunto + cuerpo del
// primer mensaje. Alimenta el dashboard (top temas) y la penalización de salud.

export const TEMAS = [
  'facturacion', 'inventario', 'catalogo', 'bancos', 'pos', 'ventas', 'ecommerce',
  'nivelacion', 'lealtad', 'reportes', 'usuarios', 'app', 'producto', 'pagos', 'otros',
] as const;
export type Tema = typeof TEMAS[number];

export const TEMA_LABEL: Record<string, string> = {
  facturacion: 'Facturación', inventario: 'Inventario', catalogo: 'Catálogo/Productos',
  bancos: 'Bancos', pos: 'Punto de venta', ventas: 'Ventas', ecommerce: 'E-commerce',
  nivelacion: 'Nivelación', lealtad: 'Lealtad', reportes: 'Reportes',
  usuarios: 'Usuarios/Permisos', app: 'App móvil', producto: 'Petición de producto',
  pagos: 'Cobros/Pagos', otros: 'Otros',
};

// Orden importa: el primer tema con match gana. Los TEMAS ESPECÍFICOS primero;
// 'producto' (petición de función) va al FINAL porque sus frases son amplias
// ("no tiene la opción de facturar el IVA" es facturación, no petición).
const REGLAS: Array<[Tema, RegExp]> = [
  ['facturacion', /factur|cfdi|complement|timbr|\bsat\b|\biva\b|desglos|nota de cr[eé]|xml|r[ée]gimen fiscal|uso de cfdi|constancia fiscal|reten/i],
  ['bancos', /banco|conciliaci|syncfy|paybook|bbva|santander|banorte|banamex|hsbc|transferenc|estado de cuenta|movimiento banc/i],
  ['nivelacion', /nivelaci|cubo|resurtid|m[ií]nimo|m[áa]ximo|traspas|cedis|redistribu|sugerido de compra/i],
  ['catalogo', /cat[áa]logo|\bsku\b|c[oó]digo de barra|variante|producto no (aparece|se ve|carga|detect)|no me detecta|filtro|atributo|ficha de producto|foto del producto|imagen del producto|precio del? producto|lista de precio|categor[íi]a/i],
  ['inventario', /inventar|existenc|kardex|conteo|almac[ée]n|stock|merma|surtido|entrada de mercanc|recepci[oó]n de mercanc|ajuste de inventar/i],
  ['pos', /punto de venta|\bpos\b|\bcaja\b|corte de caja|turno|ticket de venta|impresora|impresi[oó]n|apertura de caja|caj[oó]n|esc[áa]ner|b[áa]scula|etiqueta|tirilla|no imprime/i],
  ['ecommerce', /ecommerce|e-commerce|tienda en l[íi]nea|tienda online|checkout|carrito|widget|env[íi]o.*(paqueter|guía)|paqueter[íi]a|mercado ?libre|shopify|woocommerce/i],
  ['lealtad', /lealtad|cashback|puntos|moneder|recompens|programa de client|nivel de client/i],
  ['app', /\bapp\b|aplicaci[oó]n m[oó]vil|\bapk\b|celular|m[oó]vil|tel[eé]fono no|desde el (cel|tel|m[oó]vil)|sacsmobile|no abre la app/i],
  ['reportes', /reporte|dashboard|estad[íi]stic|gr[áa]fic|export|corte del d[íi]a|cierre del d[íi]a|informe/i],
  ['usuarios', /usuario|permis|acceso(?!rio)|contrase|no me deja entrar|no puedo (entrar|ingresar)|login|inici(ar|o) de sesi|\brol\b|grupo de/i],
  ['pagos', /\bcobro|\bpago(?!\s*de\s*n[oó]mina)|suscrip|renovaci|tarjeta de cr[eé]|stripe|mercado ?pago|domiciliaci|se me cobr[oó]/i],
  ['ventas', /\bventa|apartado|pedido|devoluci|reembols|cancelar? (una|la|el)? ?(venta|ticket)|nota de venta|cliente frecuente|abono/i],
  ['producto', /ser[íi]a posible|pueden agregar|podr[íi]an? (agregar|hacer|poner)|funci[oó]n(alidad)? nueva|nueva funci|sugeren|me gustar[íi]a que|solicit.*(m[oó]dulo|funci)|no tiene la opci|no existe la opci|hace falta (que|una|un)|se puede (agregar|habilitar)/i],
];

export function clasificarTema(texto: string): Tema {
  const t = (texto || '').toLowerCase();
  for (const [tema, re] of REGLAS) if (re.test(t)) return tema;
  return 'otros';
}

// Sentimiento/urgencia: urgente > negativo > neutral. (No marcamos 'positivo'
// en tickets entrantes; el positivo real lo mide la CSAT posterior.)
const RE_URGENTE = /urgent|no (puedo|podemos|funciona|sirve|carga|abre|deja|imprime)|no me deja|ca[íi]d[oa]|se cay[oó]|todo el d[íi]a|para(do|da|liz) .*(operaci|sistema|venta)|no factur|perd[íi] .*(venta|dinero)|error cr[íi]tico|inmediat|ya mismo|emergencia|urge|no me est[áa] dejando|lo m[áa]s pronto/i;
const RE_NEGATIVO = /no (me )?(gust|conven|resuelv|funcion)|mal servicio|p[eé]sim|molest|inconform|queja|reclam|frustr|otra vez|de nuevo|sigue (igual|fallando|sin|mal)|no ha(n)? (resuelto|solucionado)|llevo (d[íi]as|semanas|horas)|ya (les )?(dije|comand|report)|tercera vez|desde hace/i;

export function clasificarSentimiento(texto: string): 'urgente' | 'negativo' | 'neutral' {
  const t = (texto || '');
  if (RE_URGENTE.test(t)) return 'urgente';
  if (RE_NEGATIVO.test(t)) return 'negativo';
  return 'neutral';
}

export function clasificar(asunto?: string | null, cuerpo?: string | null): { tema: Tema; sentimiento: 'urgente' | 'negativo' | 'neutral' } {
  const texto = `${asunto || ''} ${cuerpo || ''}`.trim();
  return { tema: clasificarTema(texto), sentimiento: clasificarSentimiento(texto) };
}
