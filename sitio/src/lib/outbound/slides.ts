// OUTBOUND · Carrusel de imágenes (contenido.slides) para campañas in-app.
//
// Una campaña `modal` (o `tarjeta_inicio`, en versión compacta) puede llevar
// de 2 a 6 diapositivas { imagen, titulo?, texto? } que sacs3 pinta como
// carrusel encima del título/mensaje/botones de siempre. Sin slides (o con
// menos de 2) la campaña se ve exactamente como antes.
//
// Módulo PURO (sin supabase ni catálogo) para poder probarlo aislado. La
// misma regla de imagen que el resto del Outbound: solo https de
// *.sacscloud.com — sacs3 la vuelve a validar al pintar.

export const SLIDES_MIN = 2;
export const SLIDES_MAX = 6;
export const SLIDE_TITULO_MAX = 60;
export const SLIDE_TEXTO_MAX = 180;
/** Auto-avance opcional en segundos (0/ausente = apagado). */
export const SLIDES_AUTO_MIN = 3;
export const SLIDES_AUTO_MAX = 15;
/** Formatos que saben pintar el carrusel. */
export const FORMATOS_CON_SLIDES = ['modal', 'tarjeta_inicio'];

export interface Slide { imagen: string; titulo?: string; texto?: string }

function urlSacs(u: string): boolean {
  try {
    const url = new URL(String(u || ''));
    if (url.protocol !== 'https:') return false;
    return url.hostname === 'sacscloud.com' || url.hostname.endsWith('.sacscloud.com');
  } catch { return false; }
}

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/u;

/** Errores del carrusel (vacío = válido o sin carrusel). */
export function validarSlides(formato: string, ct: any): string[] {
  const errores: string[] = [];
  const slides = ct?.slides;
  if (slides == null || (Array.isArray(slides) && slides.length === 0)) return errores;
  if (!Array.isArray(slides)) return ['Las diapositivas del carrusel no tienen un formato válido.'];
  if (!FORMATOS_CON_SLIDES.includes(formato)) {
    errores.push('El carrusel solo se puede usar en los formatos «Modal» y «Tarjeta en inicio».');
  }
  if (slides.length < SLIDES_MIN) errores.push(`El carrusel necesita al menos ${SLIDES_MIN} diapositivas (con 1 usa el campo Imagen).`);
  if (slides.length > SLIDES_MAX) errores.push(`Máximo ${SLIDES_MAX} diapositivas en el carrusel.`);
  slides.forEach((s: any, i: number) => {
    const n = i + 1;
    if (!s || !String(s.imagen || '').trim()) { errores.push(`La diapositiva ${n} no tiene imagen.`); return; }
    if (!urlSacs(String(s.imagen).trim())) errores.push(`La imagen de la diapositiva ${n} debe ser una URL https de sacscloud.com.`);
    const t = String(s.titulo || '');
    const x = String(s.texto || '');
    if (t.length > SLIDE_TITULO_MAX) errores.push(`El título de la diapositiva ${n} pasa de ${SLIDE_TITULO_MAX} caracteres.`);
    if (x.length > SLIDE_TEXTO_MAX) errores.push(`El texto de la diapositiva ${n} pasa de ${SLIDE_TEXTO_MAX} caracteres.`);
    if (EMOJI.test(`${t} ${x}`.replace(/⚠/gu, ''))) errores.push(`La diapositiva ${n} lleva emojis decorativos; el estándar de SACS es tipografía limpia.`);
  });
  const auto = ct?.slides_auto_seg;
  if (auto != null && auto !== '' && Number(auto) !== 0) {
    const a = Number(auto);
    if (!Number.isFinite(a) || a < SLIDES_AUTO_MIN || a > SLIDES_AUTO_MAX) {
      errores.push(`El avance automático va de ${SLIDES_AUTO_MIN} a ${SLIDES_AUTO_MAX} segundos (0 = apagado).`);
    }
  }
  return errores;
}

/**
 * Contenido listo para viajar a sacs_api: slides recortadas y sin campos
 * vacíos; fuera de los formatos que lo pintan (o con menos de 2) se quita el
 * carrusel para no mandar basura. Nunca toca el resto del contenido.
 */
export function normalizarSlides(formato: string, ct: any): any {
  if (!ct || typeof ct !== 'object' || !('slides' in ct || 'slides_auto_seg' in ct)) return ct;
  const { slides, slides_auto_seg, ...resto } = ct;
  if (!FORMATOS_CON_SLIDES.includes(formato) || !Array.isArray(slides)) return resto;
  const limpias: Slide[] = slides.slice(0, SLIDES_MAX)
    .filter((s: any) => s && String(s.imagen || '').trim())
    .map((s: any) => {
      const o: Slide = { imagen: String(s.imagen).trim() };
      const t = String(s.titulo || '').trim();
      const x = String(s.texto || '').trim();
      if (t) o.titulo = t.slice(0, SLIDE_TITULO_MAX);
      if (x) o.texto = x.slice(0, SLIDE_TEXTO_MAX);
      return o;
    });
  if (limpias.length < SLIDES_MIN) return resto;
  const out: any = { ...resto, slides: limpias };
  const a = Number(slides_auto_seg) || 0;
  if (a >= SLIDES_AUTO_MIN && a <= SLIDES_AUTO_MAX) out.slides_auto_seg = Math.round(a);
  return out;
}
