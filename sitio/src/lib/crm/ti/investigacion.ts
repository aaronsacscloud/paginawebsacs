/**
 * INVESTIGACIÓN DE LA EMPRESA (decisión del dueño, 2026-09-04).
 *
 * Antes de escribirle a un lead viejo —sobre todo al que nunca contestó— vale más un dato real de SU negocio
 * que cualquier plantilla. Este módulo busca en línea (Instagram, sitio, directorios) qué vende, dónde está y
 * de qué tamaño es, y devuelve UNA señal concreta para romper el hielo.
 *
 * Se guarda en ti_perfil.investigacion y se reusa 90 días: buscar cuesta (~$0.05 por lead) y las tiendas no
 * cambian de giro cada semana. Si no encuentra nada, lo dice: es mejor no inventar que adornar.
 */
import { supabase } from '../../supabase';
import { anthropic, MODELS, hasApiKey } from '../../ai/client';

export type Investigacion = {
  encontrado: boolean;
  que_venden: string | null;
  donde: string | null;
  sucursales: number | null;
  instagram: string | null;
  sitio: string | null;
  senal: string | null;          // el dato concreto con el que se abre la conversación
  confianza: number;             // 0-1: qué tan seguros estamos de que es ESA tienda
  buscado_at: string;
  costo?: number;
  fuentes?: string[];
};

const DIAS_FRESCA = 90;

export async function investigacionGuardada(contactId: string): Promise<Investigacion | null> {
  const { data } = await supabase.from('ti_perfil').select('investigacion').eq('contact_id', contactId).maybeSingle();
  const inv: any = (data as any)?.investigacion;
  if (!inv?.buscado_at) return null;
  if (Date.now() - Date.parse(inv.buscado_at) > DIAS_FRESCA * 86400e3) return null;
  return inv as Investigacion;
}

/** Busca en línea. `forzar` ignora la caché. Devuelve null solo si no hay API key o truena la búsqueda. */
export async function investigarEmpresa(o: { contactId: string; nombre?: string | null; empresa?: string | null; giro?: string | null; ciudad?: string | null; telefono?: string | null }, forzar = false): Promise<Investigacion | null> {
  if (!hasApiKey()) return null;
  if (!forzar) { const ya = await investigacionGuardada(o.contactId); if (ya) return ya; }
  const quien = [o.empresa, o.nombre].filter(Boolean).join(' / ');
  if (!quien.trim()) return null;

  const prompt = `Busca en internet este negocio mexicano y dime qué vende de verdad. Es un prospecto de Sacs (software para tiendas de moda y retail en México).

Nombre del negocio: ${o.empresa || '(no lo sabemos)'}${o.nombre ? ` · persona de contacto: ${o.nombre}` : ''}${o.giro ? ` · giro que nos dijeron: ${o.giro}` : ''}${o.ciudad ? ` · ciudad: ${o.ciudad}` : ''}
Busca su Instagram, Facebook, sitio web o fichas de directorios. Máximo 3 búsquedas.

Reglas para no inventar:
- Si no encuentras algo que claramente sea ESE negocio, "encontrado": false y todo lo demás en null. No adornes.
- "senal" tiene que ser un dato verificable y concreto que sirva para abrir la conversación (lo que venden, una colección, que tienen varias sucursales, que venden en línea, que hacen liveshows). Nada de halagos genéricos.
- "sucursales": solo si lo viste (direcciones listadas, "nuestras 3 tiendas"); si no, null.

Responde SOLO JSON: {"encontrado":bool,"que_venden":"en pocas palabras, o null","donde":"ciudad o zona, o null","sucursales":número o null,"instagram":"@handle o null","sitio":"url o null","senal":"1 línea, o null","confianza":0.0-1.0,"fuentes":["urls que usaste"]}`;

  try {
    const r: any = await anthropic.messages.create({
      model: MODELS.sonnet, max_tokens: 800,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 } as any],
      messages: [{ role: 'user', content: prompt }],
    });
    const txt = (r.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const m = txt.match(/\{[\s\S]*\}/);
    const busquedas = Number(r.usage?.server_tool_use?.web_search_requests) || 0;
    const costo = ((r.usage?.input_tokens || 0) * 3 + (r.usage?.output_tokens || 0) * 15) / 1e6 + busquedas * 0.01;
    let j: any = {}; if (m) { try { j = JSON.parse(m[0]); } catch { /* sin JSON */ } }
    const inv: Investigacion = {
      encontrado: !!j.encontrado,
      que_venden: j.que_venden ? String(j.que_venden).slice(0, 200) : null,
      donde: j.donde ? String(j.donde).slice(0, 120) : null,
      sucursales: Number.isFinite(Number(j.sucursales)) && Number(j.sucursales) > 0 ? Number(j.sucursales) : null,
      instagram: j.instagram ? String(j.instagram).slice(0, 80) : null,
      sitio: j.sitio ? String(j.sitio).slice(0, 200) : null,
      senal: j.senal ? String(j.senal).slice(0, 300) : null,
      confianza: Math.max(0, Math.min(1, Number(j.confianza) || 0)),
      fuentes: Array.isArray(j.fuentes) ? j.fuentes.slice(0, 4).map(String) : [],
      buscado_at: new Date().toISOString(),
      costo: Math.round(costo * 1000) / 1000,
    };
    await supabase.from('ti_perfil').upsert({ contact_id: o.contactId, investigacion: inv, updated_at: new Date().toISOString() }, { onConflict: 'contact_id' }).then(() => {}, () => {});
    return inv;
  } catch { return null; }
}

/** El bloque que entra al prompt del redactor. Vacío si no se encontró nada creíble. */
export function textoInvestigacion(inv: Investigacion | null): string {
  if (!inv?.encontrado || inv.confianza < 0.5) return '';
  const partes = [
    inv.que_venden ? `venden ${inv.que_venden}` : null,
    inv.donde ? `en ${inv.donde}` : null,
    inv.sucursales ? `con ${inv.sucursales} sucursales` : null,
    inv.instagram ? `Instagram ${inv.instagram}` : null,
  ].filter(Boolean).join(', ');
  return `\n\nLO QUE ENCONTRAMOS DE SU NEGOCIO EN LÍNEA (búscale el ángulo aquí; úsalo con naturalidad, como quien se dio una vuelta por su Instagram, NUNCA digas «investigué» ni «vi en internet»):\n${partes}${inv.senal ? `\nSeñal para abrir: ${inv.senal}` : ''}\nSi algo de esto no cuadra con lo que él nos dijo, gana lo que él dijo.`;
}
