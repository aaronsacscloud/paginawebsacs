// WHATSAPP · De `variables_map` a los valores reales del contacto.
//
// Las plantillas guardaban su mapa de variables («primer_nombre», «giro») desde
// que se creó el editor, y NADA lo leía: el motor de cadencias mandaba siempre
// `[primerNombre]` a secas, así que una plantilla de dos o tres variables salía
// mal o no salía. Eso ataba las cadencias a mensajes genéricos justo donde más
// sirve lo concreto: «en tu zapatería de dos tiendas», no «en tu negocio».
//
// Cuando un dato NO existe, esto NO inventa ni manda un guion: devuelve
// `falta`, y quien envía decide saltarse ese paso. Un WhatsApp que dice «tu
// negocio de —» es peor que no mandarlo.
//
// ══ UNA SOLA LISTA DE CAMPOS (18-sep-2026) ═════════════════════════════════
// Había DOS y no coincidían: la pantalla de plantillas ofrecía doce campos
// (email, teléfono, etapa, MRR…) y este archivo sólo entendía once, casi todos
// distintos. ¿Qué pasaba? Elegías «email» en el editor, se guardaba, se veía
// bien… y el día que una cadencia intentaba mandar esa plantilla, `valores`
// devolvía `falta: email` y el mensaje NO SALÍA. Sin error a la vista: el paso
// simplemente se saltaba.
//
// Ahora la lista vive aquí y la pantalla la importa. Un campo nuevo se agrega
// en UN sitio y funciona en los tres caminos: el editor, el envío a mano y la
// cadencia automática.
import { sanearParam } from './sanear';

export type CampoPlantilla = {
  clave: string;
  /** Lo que se lee en la pantalla. */
  etiqueta: string;
  /** Para agrupar el selector: la lista larga sin grupos no se puede leer. */
  grupo: 'Persona' | 'Negocio' | 'Comercial' | 'Nosotros';
  /** Ejemplo que Meta exige para revisar la plantilla. Se pone solo. */
  ejemplo: string;
  leer: (c: any, yo?: any) => string | null;
};

const txt = (v: any) => String(v ?? '').trim() || null;

export const CAMPOS: CampoPlantilla[] = [
  // ── Persona ──────────────────────────────────────────────────────────────
  { clave: 'primer_nombre', etiqueta: 'Primer nombre', grupo: 'Persona', ejemplo: 'María', leer: (c) => txt(String(c?.nombre || '').split(/\s+/)[0]) },
  { clave: 'nombre', etiqueta: 'Nombre completo', grupo: 'Persona', ejemplo: 'María López', leer: (c) => txt(c?.nombre) },
  { clave: 'apellido', etiqueta: 'Apellido', grupo: 'Persona', ejemplo: 'López', leer: (c) => txt(c?.apellido) },
  { clave: 'puesto', etiqueta: 'Puesto', grupo: 'Persona', ejemplo: 'dueña', leer: (c) => txt(c?.puesto) },
  { clave: 'email', etiqueta: 'Correo', grupo: 'Persona', ejemplo: 'maria@boutique.com', leer: (c) => txt(c?.email) },
  { clave: 'telefono', etiqueta: 'Teléfono', grupo: 'Persona', ejemplo: '55 1234 5678', leer: (c) => txt(c?.telefono || c?.whatsapp) },
  // ── Negocio ──────────────────────────────────────────────────────────────
  { clave: 'empresa', etiqueta: 'Marca / tienda', grupo: 'Negocio', ejemplo: 'Boutique Lily', leer: (c) => txt(c?.empresa || c?.marca || c?.companies?.nombre_comercial || c?.companies?.nombre) },
  { clave: 'giro', etiqueta: 'Giro', grupo: 'Negocio', ejemplo: 'zapatería', leer: (c) => txt(c?.giro || c?.companies?.giro) },
  { clave: 'ciudad', etiqueta: 'Ciudad', grupo: 'Negocio', ejemplo: 'León', leer: (c) => txt(c?.ciudad || c?.companies?.ciudad) },
  { clave: 'estado', etiqueta: 'Estado', grupo: 'Negocio', ejemplo: 'Guanajuato', leer: (c) => txt(c?.estado || c?.companies?.estado) },
  { clave: 'sitio_web', etiqueta: 'Sitio web', grupo: 'Negocio', ejemplo: 'boutiquelily.com', leer: (c) => txt(c?.sitio_web || c?.companies?.sitio_web) },
  { clave: 'instagram', etiqueta: 'Instagram', grupo: 'Negocio', ejemplo: '@boutiquelily', leer: (c) => txt(c?.instagram || c?.companies?.instagram) },
  {
    /** «una tienda» / «tres tiendas»: el número crudo dentro de una frase se lee a máquina. */
    clave: 'sucursales', etiqueta: 'Sucursales (en palabras)', grupo: 'Negocio', ejemplo: 'dos tiendas',
    leer: (c) => {
      const n = Number(c?.sucursales ?? c?.sucursales_interes ?? c?.companies?.sucursales);
      if (!Number.isFinite(n) || n < 1) return null;
      const letras = ['una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
      return `${letras[n - 1] || n} ${n === 1 ? 'tienda' : 'tiendas'}`;
    },
  },
  { clave: 'sistema_actual', etiqueta: 'Sistema que usa hoy', grupo: 'Negocio', ejemplo: 'Excel', leer: (c) => txt(c?.sistema_actual) },
  // ── Comercial ────────────────────────────────────────────────────────────
  { clave: 'plan', etiqueta: 'Plan', grupo: 'Comercial', ejemplo: 'Controla', leer: (c) => txt(c?.plan || c?.plan_interes || c?.companies?.plan) },
  { clave: 'etapa', etiqueta: 'Etapa', grupo: 'Comercial', ejemplo: 'oportunidad', leer: (c) => txt(c?.etapa || c?.lifecycle_stage) },
  { clave: 'mrr', etiqueta: 'MRR', grupo: 'Comercial', ejemplo: '$1,890', leer: (c) => (c?.mrr != null && c?.mrr !== '' ? `$${Number(c.mrr).toLocaleString('es-MX')}` : null) },
  {
    clave: 'fecha_renovacion', etiqueta: 'Fecha de renovación', grupo: 'Comercial', ejemplo: '15 de octubre',
    leer: (c) => (c?.fecha_renovacion ? new Date(`${String(c.fecha_renovacion).slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : null),
  },
  { clave: 'cuenta', etiqueta: 'Cuenta de prueba', grupo: 'Comercial', ejemplo: 'boutiquelily', leer: (c) => txt(c?.prueba_cuenta) },
  // ── Nosotros ─────────────────────────────────────────────────────────────
  { clave: 'agente', etiqueta: 'Quien escribe (tu nombre)', grupo: 'Nosotros', ejemplo: 'Andrea', leer: (_c, yo) => txt(yo?.nombre) },
  { clave: 'mi_empresa', etiqueta: 'Nuestra marca', grupo: 'Nosotros', ejemplo: 'Sacs', leer: () => 'Sacs' },
];

/** Compatibilidad con el mapa viejo `Record<clave, leer>`. */
export const CAMPOS_PLANTILLA: Record<string, (c: any) => string | null> = Object.fromEntries(CAMPOS.map(c => [c.clave, (x: any) => c.leer(x)]));
export const campoDe = (clave: string) => CAMPOS.find(c => c.clave === clave) || null;

/* ══ EL CAMPO ABIERTO ══════════════════════════════════════════════════════
   Pedido del dueño (18-sep-2026): «una variable de campo abierto que yo voy a
   agregar para la plantilla, para poner lo que yo quiera».

   Se guarda como `libre:Promoción del mes`. La diferencia con dejarlo vacío —
   que ya se podía— es el NOMBRE: al mandar la plantilla, el CRM pide
   «Promoción del mes» en vez de «Variable {{3}}», y quien la manda sabe qué va
   ahí sin abrir la plantilla para leer el texto. */
export const ES_LIBRE = (campo?: string | null) => String(campo || '').startsWith('libre:');
export const etiquetaLibre = (campo?: string | null) => String(campo || '').slice(6).trim() || 'Texto libre';
/** Cómo se llama esta variable en las pantallas. */
export const nombreVariable = (campo: string | null | undefined, i: number) =>
  ES_LIBRE(campo) ? etiquetaLibre(campo) : (campoDe(String(campo || ''))?.etiqueta || `Variable {{${i + 1}}}`);

export type ValoresPlantilla = { ok: true; valores: string[] } | { ok: false; falta: string };

/**
 * Los valores en el orden {{1}}..{{n}}. `mapa` es `wa_plantillas.variables_map`.
 * Sin mapa (lo normal en las plantillas viejas) se asume el primer nombre, que
 * es lo que el motor mandaba antes: así ninguna plantilla existente cambia.
 */
export function valoresPlantilla(c: any, mapa: any, nVariables = 1, yo?: any): ValoresPlantilla {
  const campos: string[] = Array.isArray(mapa) && mapa.length ? mapa : ['primer_nombre'];
  const usados = campos.slice(0, Math.max(nVariables, 1));
  const valores: string[] = [];
  for (const campo of usados) {
    /* Un campo abierto no lo puede resolver una cadencia: nadie escribió ese
       texto. Se dice con su nombre —«falta Promoción del mes»— en vez de
       mandar un hueco, que es lo que Meta rechaza y lo que el cliente lee como
       un error nuestro. */
    if (ES_LIBRE(campo)) return { ok: false, falta: etiquetaLibre(campo) };
    const def = campoDe(String(campo));
    const v = def ? def.leer(c, yo) : null;
    /* El nombre es el único que tolera respaldo: sin él se saluda igual. Los demás
       son el contenido del mensaje — si faltan, el mensaje no se manda. */
    if (!v) {
      if (campo === 'nombre' || campo === 'primer_nombre') { valores.push('👋'); continue; }
      return { ok: false, falta: def?.etiqueta || String(campo) };
    }
    valores.push(sanearParam(v));
  }
  return { ok: true, valores };
}
