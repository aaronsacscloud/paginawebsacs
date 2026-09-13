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
import { sanearParam } from './kapso-api';

/** Los campos que una plantilla puede pedir. Nombres en español porque se eligen en la pantalla. */
export const CAMPOS_PLANTILLA: Record<string, (c: any) => string | null> = {
  nombre: (c) => String(c?.nombre || '').trim() || null,
  primer_nombre: (c) => String(c?.nombre || '').trim().split(/\s+/)[0] || null,
  apellido: (c) => String(c?.apellido || '').trim() || null,
  empresa: (c) => String(c?.empresa || c?.companies?.nombre_comercial || c?.companies?.nombre || '').trim() || null,
  giro: (c) => String(c?.giro || c?.companies?.giro || '').trim() || null,
  ciudad: (c) => String(c?.ciudad || c?.companies?.ciudad || '').trim() || null,
  /** «una tienda» / «tres tiendas»: el número crudo dentro de una frase se lee a máquina. */
  sucursales: (c) => {
    const n = Number(c?.sucursales_interes ?? c?.companies?.sucursales);
    if (!Number.isFinite(n) || n < 1) return null;
    const letras = ['una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
    return `${letras[n - 1] || n} ${n === 1 ? 'tienda' : 'tiendas'}`;
  },
  sistema_actual: (c) => String(c?.sistema_actual || '').trim() || null,
  plan: (c) => String(c?.plan_interes || c?.companies?.plan || '').trim() || null,
  cuenta: (c) => String(c?.prueba_cuenta || '').trim() || null,
};

export type ValoresPlantilla = { ok: true; valores: string[] } | { ok: false; falta: string };

/**
 * Los valores en el orden {{1}}..{{n}}. `mapa` es `wa_plantillas.variables_map`.
 * Sin mapa (lo normal en las plantillas viejas) se asume el primer nombre, que
 * es lo que el motor mandaba antes: así ninguna plantilla existente cambia.
 */
export function valoresPlantilla(c: any, mapa: any, nVariables = 1): ValoresPlantilla {
  const campos: string[] = Array.isArray(mapa) && mapa.length ? mapa : ['primer_nombre'];
  const usados = campos.slice(0, Math.max(nVariables, 1));
  const valores: string[] = [];
  for (const campo of usados) {
    const lee = CAMPOS_PLANTILLA[String(campo)];
    const v = lee ? lee(c) : null;
    /* El nombre es el único que tolera respaldo: sin él se saluda igual. Los demás
       son el contenido del mensaje — si faltan, el mensaje no se manda. */
    if (!v) {
      if (campo === 'nombre' || campo === 'primer_nombre') { valores.push('👋'); continue; }
      return { ok: false, falta: String(campo) };
    }
    valores.push(sanearParam(v));
  }
  return { ok: true, valores };
}
