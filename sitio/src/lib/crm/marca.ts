// La marca con la que sale un documento hacia el cliente.
//
// La minuta y el reporte ejecutivo los firma una PERSONA, no la plataforma: el
// cliente recibe el documento de su consultora. Por eso la marca vive en
// team_members y no en una configuración global — si mañana entra otra
// consultora, sube su logo, elige su color y sus minutas salen con su nombre
// sin tocar las de nadie más.
//
// El acento es un catálogo cerrado de cinco colores de la plataforma, no un
// selector libre: un input de color abierto termina en documentos que no se
// parecen a nada.

export type ClaveAcento = 'rosa' | 'morado' | 'azul' | 'verde' | 'tinta';

export type Acento = {
  clave: ClaveAcento;
  label: string;
  /** Fondo del encabezado y de la banda de cierre. */
  hd: string;
  /** Cinta de 3px bajo el encabezado: del acento a los colores del CRM. */
  rule: string;
  /** El color plano, para viñetas, números de sección y rúbrica. */
  fuerte: string;
  /** El mismo color en tinta legible sobre blanco. */
  oscuro: string;
  /** Relleno suavísimo del bloque de acuerdos. */
  suave: string;
  borde: string;
  /** Fondo de las franjas (metadatos y pie). */
  tono: string;
  /** Muestra plana para el selector. */
  swatch: string;
};

export const ACENTOS: Record<ClaveAcento, Acento> = {
  rosa: {
    clave: 'rosa', label: 'Rosa',
    hd: 'radial-gradient(125% 190% at 84% -45%,#F08FBA 0%,#D9538E 42%,#A93A6B 100%)',
    rule: 'linear-gradient(90deg,#D9538E 0%,#9B8CFA 55%,#7DA6F5 100%)',
    fuerte: '#D9538E', oscuro: '#A93A6B',
    suave: 'linear-gradient(180deg,#FEF7FA,#FDF3F7)', borde: '#F7E3EC', tono: '#FEFBFC',
    swatch: 'linear-gradient(135deg,#F08FBA,#B03E71)',
  },
  morado: {
    clave: 'morado', label: 'Morado',
    hd: 'radial-gradient(125% 190% at 84% -45%,#B5A8FF 0%,#6F5CE8 42%,#43349E 100%)',
    rule: 'linear-gradient(90deg,#5B4BD6 0%,#9B8CFA 55%,#7DA6F5 100%)',
    fuerte: '#9B8CFA', oscuro: '#5B4BD6',
    suave: 'linear-gradient(180deg,#FBF9FF,#F8F6FF)', borde: '#EDE7FB', tono: '#FCFBFE',
    swatch: 'linear-gradient(135deg,#B5A8FF,#5B4BD6)',
  },
  azul: {
    clave: 'azul', label: 'Azul',
    hd: 'radial-gradient(125% 190% at 84% -45%,#9CC0F8 0%,#3E74D6 42%,#1C3F86 100%)',
    rule: 'linear-gradient(90deg,#2C5FC4 0%,#7DA6F5 55%,#9B8CFA 100%)',
    fuerte: '#7DA6F5', oscuro: '#2C5FC4',
    suave: 'linear-gradient(180deg,#F8FBFF,#F3F8FE)', borde: '#DEEAFA', tono: '#FBFCFE',
    swatch: 'linear-gradient(135deg,#9CC0F8,#2C5FC4)',
  },
  verde: {
    clave: 'verde', label: 'Verde',
    hd: 'radial-gradient(125% 190% at 84% -45%,#79D3AE 0%,#2FA57A 42%,#125E44 100%)',
    rule: 'linear-gradient(90deg,#1E8A63 0%,#4FBF95 55%,#7DA6F5 100%)',
    fuerte: '#4FBF95', oscuro: '#1E8A63',
    suave: 'linear-gradient(180deg,#F7FDFA,#F1FAF6)', borde: '#DCF0E7', tono: '#FBFDFC',
    swatch: 'linear-gradient(135deg,#79D3AE,#1E8A63)',
  },
  tinta: {
    clave: 'tinta', label: 'Tinta',
    hd: 'radial-gradient(125% 190% at 84% -45%,#3a2f8f 0%,#221a52 45%,#17123A 100%)',
    rule: 'linear-gradient(90deg,#17123A 0%,#9B8CFA 55%,#F4A8CD 100%)',
    fuerte: '#5B4BD6', oscuro: '#2E2560',
    suave: 'linear-gradient(180deg,#FAFAFE,#F6F6FC)', borde: '#E9E7F4', tono: '#FCFCFE',
    swatch: 'linear-gradient(135deg,#4a3f9e,#17123A)',
  },
};

export const LISTA_ACENTOS = Object.values(ACENTOS);
export const acentoDe = (c?: string | null): Acento => ACENTOS[(c || 'rosa') as ClaveAcento] || ACENTOS.rosa;

export type Marca = {
  nombre: string;
  linea: string;
  acento: Acento;
  acento_clave: ClaveAcento;
  logo: string | null;
  iniciales: string;
  pie: string;
  firma: string;
};

/** Iniciales del nombre de marca, para el monograma cuando no hay logo. */
export function iniciales(nombre: string): string {
  const p = String(nombre || '').trim().split(/\s+/).filter(w => w.length > 2 && !/^(de|del|la|el|los|las|y)$/i.test(w));
  if (!p.length) return 'SC';
  return (p[0][0] + (p[1]?.[0] || p[0][1] || '')).toUpperCase();
}

/**
 * La marca de un miembro del equipo, con valores por defecto que nunca dejan
 * un hueco en el documento: sin logo se arma el monograma, sin nombre de marca
 * se usa el nombre de la persona.
 */
export function marcaDe(m: any): Marca {
  const nombre = String(m?.marca_nombre || m?.nombre || 'SACSCloud').trim();
  const acento = acentoDe(m?.marca_acento);
  return {
    nombre,
    linea: String(m?.marca_linea ?? 'Acompañamiento estratégico · SACSCloud').trim(),
    acento, acento_clave: acento.clave,
    // marca_logo_url manda; si no hay, el logo que ya usa en cotizaciones.
    logo: m?.marca_logo_url || m?.logo_url || null,
    iniciales: iniciales(nombre),
    pie: String(m?.marca_pie ?? (m?.email ? `${m.email} · www.sacscloud.com` : 'www.sacscloud.com')).trim(),
    firma: String(m?.marca_firma || m?.nombre || '').trim(),
  };
}

export const CAMPOS_MARCA = ['marca_nombre', 'marca_linea', 'marca_acento', 'marca_logo_url', 'marca_pie', 'marca_firma'] as const;
export const SELECT_MARCA = 'id, nombre, email, logo_url, ' + CAMPOS_MARCA.join(', ');

/**
 * Parte un campo de texto libre en viñetas.
 *
 * Los compromisos se capturan en un textarea: unos escriben renglón por
 * renglón, otros un párrafo con puntos y comas. Se respeta lo que haya —si es
 * un párrafo corrido queda una sola viñeta, que es honesto— pero se limpian
 * los guiones y numeraciones que la gente teclea a mano para que no salgan
 * dos marcas de lista encimadas.
 */
export function vinetas(txt?: string | null): string[] {
  const t = String(txt || '').trim();
  if (!t) return [];
  const porRenglon = t.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
  const base = porRenglon.length > 1 ? porRenglon : t.split(/\s+·\s+|\s*;\s*/).map(s => s.trim()).filter(Boolean);
  return base.map(s => s.replace(/^[-–—•*·]\s*/, '').replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
}

/** Folio estable del documento: MIN + trozo del id + fecha. */
export const folioMinuta = (id: string, fecha?: string | null) =>
  'MIN-' + String(id || '').replace(/-/g, '').slice(0, 4).toUpperCase() + '-' + String(fecha || '').slice(5, 10).replace('-', '');
