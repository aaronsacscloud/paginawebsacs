// La paleta del CRM. Una sola.
//
// REGLA DEL PROYECTO: el morado del CRM es #9B8CFA y su tinta #5B4BD6. Los
// tomó Cotizaciones primero y son los que mandan; cualquier pantalla nueva usa
// ESTOS y no un morado parecido. Un módulo con su propio tono se lee como otro
// producto, y con veinte pantallas la diferencia deja de ser un detalle.
//
// Cómo se reparte el color, que importa tanto como cuál es:
//
//  · PASTEL en la forma —franja, punto, barra, fondo de pastilla—. Es
//    decoración: dice de qué habla el bloque antes de leerlo.
//  · TINTA en la cifra. Una cantidad de dinero es información, y si se
//    despinta hay que acercarse a la pantalla para leerla, docenas de veces
//    al día.
//  · AGUA para fondos de pastilla y estados suaves.
//
// Y el significado no se negocia: verde es dinero que entró, rosa/rojo es
// dinero que se fue, ámbar es algo que urge, morado es el recurrente y lo
// propio del sistema.
export const P = {
  // Morado — el color del CRM
  violeta: '#9B8CFA',
  violetaTinta: '#5B4BD6',
  violetaHondo: '#4536BE',
  violetaAgua: '#EEECFE',
  violetaBorde: '#ddd6fb',

  // Azul — lo que acompaña al morado (segundo plano, cifras neutras)
  azul: '#7DA6F5',
  azulTinta: '#2C5FC4',
  azulAgua: '#E3EDFD',

  // Rosa — la firma de la marca y lo que se va
  rosa: '#D9538E',
  rosaSuave: '#EFA6CA',
  rosaTinta: '#9c3d70',
  rosaAgua: 'rgba(244,168,205,.42)',

  // Verde — dinero que entró, cosas que están bien
  verde: '#4FBF95',
  verdeTinta: '#1E8A63',
  verdeAgua: '#EAF8F2',

  // Rojo — vencido, perdido, roto
  rojo: '#EF7A72',
  rojoTinta: '#C0554E',
  rojoAgua: '#FEF0EF',

  // Ámbar — atención, todavía no es un problema
  ambar: '#E8A838',
  ambarTinta: '#9a6a10',
  ambarAgua: '#FFF4E5',

  // Neutros
  tinta: '#241d43',
  texto: '#4a4a52',
  suave: '#6b7280',
  tenue: '#8a8590',
  gris: '#a5a2af',
  linea: '#ececec',
  lineaSuave: '#f5f4f8',
  papel: '#fff',
  fondo: '#f5f6f8',
} as const;

/** La cinta de marca: encabeza documentos y pantallas completas. */
export const CINTA = `linear-gradient(90deg,${P.violeta} 0%,${P.azul} 55%,rgba(244,168,205,.9) 100%)`;

/** El bloque lila que ancla un total o una fecha clave. */
export const BLOQUE_LILA = `linear-gradient(135deg,${P.violetaAgua},rgba(244,168,205,.22))`;

/**
 * La tarjeta de KPI del CRM: fondo blanco, borde tenue y una FRANJA de color a
 * la izquierda que dice de qué habla el número. La estableció Cotizaciones y
 * es la forma estándar en todo el sistema.
 */
export const tarjetaKpi = (franja: string = P.violeta) => ({
  background: P.papel,
  border: `1px solid ${P.linea}`,
  borderLeft: `3px solid ${franja}`,
  borderRadius: 10,
  padding: '15px 17px',
});
