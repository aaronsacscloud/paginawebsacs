// ══ Motor Account-Based · lo que comparten todas las rutas ═══════════════════
//
// "Cuentas objetivo" son PROSPECTOS de moda investigados en frío (tablas abm_*).
// Tres reglas que valen para todo lo que hay aquí:
//
// 1. Un prospecto NO es un cliente. Nunca escriben en companies/subscriptions:
//    si se mezclan, el ARR y el reporte ejecutivo dejan de significar algo. La
//    cuenta se convierte en cliente al ganarse, y hasta entonces.
// 2. Todo dato tiene procedencia. Cada correo, teléfono o conteo guarda de
//    dónde salió y con qué confianza; el vendedor necesita saber si el correo
//    viene del aviso de privacidad (alta) o de un directorio ajeno (baja).
// 3. Lo investigado y lo confirmado son dos verdades. Lo que dijo el prospecto
//    cuando contestó GANA siempre sobre lo que encontramos nosotros, y se
//    guarda aparte con quién lo confirmó.
import { supabase } from '../supabase';
import { ALIADOS } from './abm-aliados';
import { getCurrentUser } from '../auth/scope';

export const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esUuid = (v: any) => typeof v === 'string' && UUID.test(v);
export const limpiar = (v: any, max = 500) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);

export type Quien = { id: string; nombre: string; role: string };

/** La identidad SIEMPRE de la cookie; el navegador nunca dice quién es. */
export async function quien(request: Request): Promise<Quien | null> {
  const u = await getCurrentUser(request);
  if (!u) return null;
  return { id: (u as any).id, nombre: (u as any).name || (u as any).email || 'equipo', role: (u as any).role || 'cs' };
}

import { GIROS, paginaDe } from './abm-giros';
import { paisDe } from './abm-paises';
import { nombrePila, nombreBonito } from './nombre';
export { GIROS };

export const ETAPAS = ['sin_tocar', 'en_cadencia', 'respondio', 'reunion', 'diagnostico', 'propuesta', 'ganada', 'perdida', 'en_pausa', 'no_contactar'] as const;
export const ETAPA_ETIQ: Record<string, string> = {
  sin_tocar: 'Sin tocar', en_cadencia: 'En cadencia', respondio: 'Respondió', reunion: 'Reunión',
  diagnostico: 'Diagnóstico', propuesta: 'Propuesta', ganada: 'Ganada', perdida: 'Perdida', no_contactar: 'No contactar',
};

export const CANAL_ETIQ: Record<string, string> = {
  email_direccion: 'Correo de dirección', email_generico: 'Correo general',
  whatsapp_tienda: 'WhatsApp de la tienda', whatsapp_dueno: 'WhatsApp del dueño',
  telefono: 'Teléfono', dm_ig: 'Instagram', dm_fb: 'Facebook', linkedin: 'LinkedIn',
};

export const METODO_ETIQ: Record<string, string> = {
  sitio_oficial: 'su sitio oficial', aviso_privacidad: 'el aviso de privacidad de su sitio',
  facebook_info: 'la sección Información de su Facebook', google_maps: 'su ficha de Google',
  localizador: 'su localizador de tiendas', instagram: 'su Instagram', prensa: 'una nota de prensa',
  directorio: 'un directorio de terceros', escaner: 'el escaneo de su sitio', investigacion: 'la investigación',
};

/** Puntaje 0-100 = encaje (0-50) + dolor (0-50).
 *
 * La accesibilidad NO entra: ordenar por ella era ordenar por "a quién le
 * hallamos el correo", y eso escondía las cuentas grandes que valen la pena
 * trabajar a mano. Sigue calculándose y se muestra aparte, como filtro. */
// Los topes del puntaje viven en components/admin/crm/abm/ui.tsx: esta
// librería importa el cliente de Supabase del servidor y no puede tocarla React.
const ECOMMERCE = /shopify|woo|vtex|wix|tiendanube|magento|prestashop|squarespace|shopline/i;

export function calcularPuntaje(c: any, senales: any[] = []): { encaje: number; dolor: number; accesibilidad: number; puntaje: number } {
  const suc = Number(c.sucursales || 0);
  const sinConteo = c.sucursales === null || c.sucursales === undefined;

  // ENCAJE (0-50). Cuando no verificamos el tamaño no se castiga a la cuenta por
  // un hueco NUESTRO: se estima por lo que sí sabemos (reseñas y seguidores).
  let encaje: number;
  if (sinConteo) {
    const resenas = Number(c.google_resenas || 0);
    const segui = Number(String(c.ig_seguidores || '').replace(/[^\d.]/g, '')) * (/k/i.test(String(c.ig_seguidores || '')) ? 1000 : 1);
    encaje = 18 + (resenas >= 300 || segui >= 30000 ? 8 : resenas >= 100 || segui >= 10000 ? 4 : 0);
  } else {
    encaje = 12 + (suc >= 2 ? 12 : 0) + (suc >= 5 ? 12 : 0) + (suc >= 15 ? 8 : 0) + (suc >= 30 ? 6 : 0);
  }
  encaje = Math.min(50, encaje);

  // DOLOR (0-50). Lo que de verdad duele, no "si el investigador escribió un
  // párrafo": vender en línea sin ver el piso, el sitio roto, la calificación
  // cayéndose al crecer, y las señales VIVAS que juntó la investigación.
  let dolor = 0;
  if (ECOMMERCE.test(String(c.plataforma_web || '')) && (suc >= 2 || sinConteo)) dolor += 16;
  const sitioCaido = c.sitio_http === 0 || Number(c.sitio_http || 200) >= 400;
  if (sitioCaido) dolor += 12;
  if (c.sitio_carrito === false) dolor += 8;
  if (c.google_rating && Number(c.google_rating) < 4.5 && suc >= 3) dolor += 10;   // se le cae al crecer
  // Las señales pesan según lo que son, y las que llevan fecha además caducan.
  // Una señal SIN fecha es contexto del estudio: pesa poco y no vence — antes
  // todas cargaban la fecha del día en que se sembró la base, así que a los seis
  // meses 578 cuentas iban a perder su dolor el mismo día, por un artefacto.
  const PESO: Record<string, number> = { expansion: 10, vacante: 10, resena_mala: 8, sitio_caido: 8, clic: 6, apertura_correo: 4, post: 2, contexto: 2 };
  const hoy = Date.now();
  for (const s of senales) {
    // El sitio caído ya se cobró arriba con el dato duro del escaneo: la señal
    // es el mismo hecho contado dos veces.
    if (s.tipo === 'sitio_caido' && sitioCaido) continue;
    if (s.vigente === false) continue;
    if (s.caduca_at && String(s.caduca_at) < new Date().toISOString().slice(0, 10)) continue;
    if (s.fecha) {
      const dias = (hoy - new Date(String(s.fecha) + 'T00:00:00Z').getTime()) / 864e5;
      if (dias > 180) continue;                                  // un hecho viejo ya no duele
    }
    // El peso de la fila manda; la tabla es solo el respaldo cuando no lo trae.
    dolor += Number.isFinite(Number(s.peso)) && Number(s.peso) > 0 ? Number(s.peso) : (PESO[s.tipo] ?? 2);
  }
  dolor = Math.min(50, dolor);

  // ACCESIBILIDAD (0-25): aparte del puntaje, para saber por dónde entrarle.
  const acc = Math.min(25, (c.tiene_email ? 12 : 0) + (c.tiene_wa ? 8 : 0) + (c.tiene_persona ? 5 : 0));
  return { encaje, dolor, accesibilidad: acc, puntaje: encaje + dolor };
}

/** Recalcula y guarda. Se llama cada vez que la cuenta cambia de verdad —
 *  confirmar sucursales, capturar al dueño, agregar un canal—, porque un
 *  puntaje que se calculó una vez al sembrar es un puntaje que miente. */
export async function repuntuar(cuenta_id: string) {
  const { data: c } = await supabase.from('abm_cuentas').select('*').eq('id', cuenta_id).maybeSingle();
  if (!c) return;
  const { data: senales } = await supabase.from('abm_senales').select('tipo, fecha, peso, caduca_at, vigente').eq('cuenta_id', cuenta_id);
  // `tiene_persona` no es una columna: se pregunta. Antes se leía de la cuenta
  // —donde no existe— y capturar al dueño BAJABA cinco puntos en vez de subirlos.
  const { count: personas } = await supabase.from('abm_personas')
    .select('id', { count: 'exact', head: true }).eq('cuenta_id', cuenta_id);
  const p = calcularPuntaje({ ...c, tiene_persona: (personas || 0) > 0 }, senales || []);
  await supabase.from('abm_cuentas').update({ ...p, updated_at: new Date().toISOString() }).eq('id', cuenta_id);
}

/** La ruta la decide el tamaño: cinco sucursales o más merecen diagnóstico. */
export const rutaDe = (suc: number | null) => (Number(suc || 0) >= 5 ? 'diagnostico' : 'demo');

/** Deja rastro en la bitácora. Todo lo que le pasa a una cuenta pasa por aquí. */
export async function apuntar(cuenta_id: string, canal: string, tipo: string, extra: Record<string, any> = {}) {
  const { error } = await supabase.from('abm_actividad').insert({
    cuenta_id, canal, tipo,
    persona_id: extra.persona_id || null, toque_id: extra.toque_id || null,
    texto: extra.texto ? limpiar(extra.texto, 4000) : null,
    transcripcion: extra.transcripcion ? limpiar(extra.transcripcion, 20000) : null,
    detalle: extra.detalle || {},
    ocurrio_at: extra.ocurrio_at || new Date().toISOString(),
  });
  if (error) console.error('[abm] no se pudo apuntar la actividad:', error.message);
}

// ── Rellenar una plantilla con los datos REALES de la cuenta ────────────────
//
// Dos formas, y las dos importan:
//   {{variable}}          se sustituye por el dato; si no hay dato, queda vacío
//   [[si variable]]…[[/si]]  el trozo entero desaparece cuando el dato falta
//
// Lo segundo es lo que evita el ridículo de "con  sucursales" o "Hola ,". Una
// frase que depende de un dato que no tenemos no se escribe: se borra.

export { nombrePila };

export function variablesDe(c: any, persona?: any): Record<string, string> {
  /* Los tres hallazgos se calculan antes porque `vimos` depende de ellos.
     El correo 0 abre la lista con «Esto es lo que vimos de ustedes:» y los
     tres renglones de abajo son condicionales, así que cuando la cuenta no
     tiene ninguno quedaban los dos puntos seguidos de nada —2,164 de las
     3,210 cuentas contactables, o sea dos de cada tres (16-sep-2026)—. El
     motor de plantillas no tiene «o», así que la condición se calcula aquí:
     `vimos` está lleno si hay algo que citar, y el renglón de introducción
     se borra solo cuando no lo hay. */
  const sucursales = Number(c.sucursales) > 1 && c.sucursales_confianza !== 'baja' ? String(c.sucursales) : '';
  const plataforma = plataformaLimpia(c.plataforma_web);
  const senal = recorte(c.senal_expansion, 90);
  return {
    /* El nombre como se ESCRIBE, no como lo capturaron en Google Maps. 1,180
       de las 3,205 cuentas contactables vienen gritando («ALMACENES SILVON»)
       o con la ficha listando todas sus marcas («AGORSS / DEEZER / MONACO /
       ESTUDIO S / DEFAY / WHOO /»). Va en el primer renglón del correo que
       jura no ser automático. Ver nombreBonito() para las tres reglas. */
    nombre: nombreBonito(c.nombre),
    ciudad: c.ciudad || '',
    vimos: senal || sucursales || plataforma ? 'sí' : '',
    /* DE DÓNDE SALIÓ LA CUENTA, y por qué son dos banderas. El correo 0 de
       calzado y marcas abre diciendo «estuvimos armando la lista de fábricas
       que exponen en SAPICA y usted salió ahí». Es cierto para las 632 del
       padrón de la feria; NO lo es para las 304 que trajo Google Maps, y 43 de
       ellas ya estaban en la fila del goteo, entre ellas una fábrica de
       pinturas y una reparadora de zapatos. Decirle a alguien que expone en
       una feria a la que no va es mentira verificable en la primera línea.
       El motor no tiene «o», así que van dos banderas complementarias —el
       mismo recurso que `vimos`—: `feria` con el nombre cuando la cuenta viene
       del padrón, `sin_feria` cuando no, para la versión que sí se sostiene. */
    ...(() => {
      const nota = String(c.nota || '');
      const f = /SAPICA/i.test(nota) ? 'SAPICA' : /Intermoda/i.test(nota) ? 'Intermoda' : '';
      return { feria: f, sin_feria: f ? '' : 'sí' };
    })(),
    // No se presume un número de tiendas que no verificamos: equivocarse con
    // "sus 14 tiendas" cuando son 3 tumba la credibilidad del correo entero.
    //
    // Y se exige MÁS DE UNA. Las 14 plantillas que usan esta variable la meten
    // en una frase en plural —"y que traen {{sucursales}} sucursales"—, así que
    // con una sola tienda salía "y que traen 1 sucursales": un correo en frío
    // que abre con una falta de ortografía y presumiendo de saber algo que
    // cualquiera ve. Son 17,782 cuentas con una sola tienda, o sea la mayoría
    // de la base. Vacía aquí, el bloque [[si sucursales]] borra la frase sola y
    // las 14 plantillas quedan bien sin tocar ninguna.
    sucursales,
    rating: c.google_rating ? Number(c.google_rating).toFixed(1) : '',
    resenas: c.google_resenas ? String(c.google_resenas) : '',
    plataforma,
    persona: nombrePila(persona?.nombre),
    giro_nombre: GIROS[c.giro] || c.giro || '',
    ultima_publicacion: recorte(c.ultima_publicacion, 90),
    senal,
    // Segmentación por país (14-sep-2026): el guion de Latam es uno y estas
    // tres lo aterrizan —«en Colombia», «vestidos de 15 años», la página del
    // giro de su país—. En México dicen México, XV años y la página raíz.
    pais: paisDe(c.pais).nombre,
    xv: paisDe(c.pais).xv,
    landing: paginaDe(c.giro, undefined, c.pais)?.url || '',
    /* ── LA APERTURA DEL ALIADO, RESUELTA EN CÓDIGO ─────────────────────────
       Estas tres son las que diferencian al aliado por TIPO: el que surte
       ganchos no abre igual que la escuela. Y se resuelven AQUÍ, no en la IA,
       por un susto real (16-sep-2026): la API de Anthropic se quedó sin
       crédito, la redacción cayó al texto base y el borrador quedó con el
       marcador `[[apertura del expediente…]]` dentro, listo para que alguien
       lo aprobara. Una variable se rellena siempre; una instrucción a la IA
       solo cuando la IA contesta. La IA sigue puliendo el correo, pero si no
       está, lo que sale ya es correcto y ya está diferenciado. */
    ...aperturaAliado(c),
  };
}

/** El tipo de aliado de un subgiro, aceptando también los nombres VIEJOS.
 *
 *  Cada tipo declara en `ya` los subgiros que ya estaban cargados y le
 *  corresponden —«Firma» es la consultora de moda, «Escuela» la escuela—, pero
 *  la búsqueda solo miraba la llave nueva. Resultado: 29 cuentas contactables
 *  con subgiro viejo se quedaban sin apertura, sin su gente y sin su dolor, y
 *  el correo salía «Le escribo a Estudio Marlene por algo concreto..» y «Le
 *  vende a, y lo que pasa del otro lado es esto:.» (16-sep-2026).
 *
 *  El campo `ya` existía justo para esto; lo que faltaba era usarlo. Se compara
 *  sin acentos ni mayúsculas porque los subgiros viejos se escribieron a mano. */
const pelar = (x: string) => x.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
let ALIAS_ALIADO: Record<string, string> | null = null;
export function tipoDeAliado(subgiro?: string | null) {
  const k = String(subgiro || '').trim();
  if (!k) return null;
  if (ALIADOS[k]) return ALIADOS[k];
  if (!ALIAS_ALIADO) {
    ALIAS_ALIADO = {};
    for (const [llave, t] of Object.entries(ALIADOS)) {
      ALIAS_ALIADO[pelar(llave)] = llave;
      for (const viejo of t.ya || []) ALIAS_ALIADO[pelar(viejo)] = llave;
    }
  }
  const llave = ALIAS_ALIADO[pelar(k)];
  return llave ? ALIADOS[llave] : null;
}

/** Lo que el catálogo de aliados sabe del tipo de esta cuenta, como variables.
 *  Vacías si no es aliado: los bloques [[si …]] se borran solos. */
function aperturaAliado(c: any): Record<string, string> {
  if (c.giro !== 'aliados') return { apertura: '', su_gente: '', dolor_cliente: '' };
  const t = tipoDeAliado(c.subgiro);
  if (!t) return { apertura: '', su_gente: '', dolor_cliente: '' };
  /* `apertura` y no `gancho`: el gancho está escrito para nosotros y no se le
     manda a nadie. Y las dos que van A MEDIA FRASE entran en minúscula —«Le
     vende a Marcas y boutiques…» con mayúscula delata la plantilla—. */
  const baja = (t2: string) => t2.charAt(0).toLowerCase() + t2.slice(1);
  return { apertura: t.apertura, su_gente: baja(t.suGente), dolor_cliente: baja(t.dolor) };
}

/** Solo plataformas de verdad. "Facebook (sin sitio propio)" o "no verificable
 *  (el dominio ya no resuelve)" metidos en la frase "su tienda en línea en X"
 *  producen correos absurdos; mejor vacío, que borra la frase completa. */
const PLATAFORMAS = ['Shopify', 'WooCommerce', 'VTEX', 'Wix', 'Tiendanube', 'Magento', 'PrestaShop', 'Squarespace'];
export function plataformaLimpia(v: any): string {
  const t = String(v || '');
  for (const p of PLATAFORMAS) if (new RegExp(p.replace('WooCommerce', 'woo'), 'i').test(t)) return p;
  return '';
}

/** Una frase, no un volcado de la investigación. La señal más larga que hay
 *  mide 413 caracteres: pegada a media frase, el correo deja de parecer escrito
 *  por una persona. Mejor vacía que larga: el bloque [[si …]] la borra sola. */
export function recorte(v: any, max: number): string {
  const t = String(v || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t.replace(/[.;:,]+$/, '');
  const corte = t.slice(0, max);
  const i = Math.max(corte.lastIndexOf(','), corte.lastIndexOf(';'), corte.lastIndexOf('.'));
  return i > 30 ? corte.slice(0, i) : '';
}

export function rellenar(texto: string, v: Record<string, string>): string {
  let t = String(texto || '');
  // Primero los condicionales: si la variable está vacía, se va el bloque entero.
  t = t.replace(/\[\[si\s+([a-z_]+)\]\]([\s\S]*?)\[\[\/si\]\]/gi, (_m, k, cuerpo) => (v[k] ? cuerpo : ''));
  t = t.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, k) => v[k] ?? '');
  // Limpieza de las costuras que deja quitar un trozo.
  return t.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:])/g, '$1')
          .replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');
}
