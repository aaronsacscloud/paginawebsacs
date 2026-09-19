// Acceso al brief. Todo pasa por el token: es la única llave y por eso nada
// aquí acepta un id de brief que venga del navegador.
import { supabase } from '../supabase';
import { ETAPAS } from './etapas';

export type Brief = {
  id: string;
  token: string;
  cliente: string;
  proyecto: string;
  contacto: string | null;
  email: string | null;
  whatsapp: string | null;
  quote_numero: string | null;
  resumen: Record<string, any>;
  firmado_por: string | null;
  firmado_puesto: string | null;
  firmado_email: string | null;
  firmado_at: string | null;
  firma_png: string | null;
  avisos_email: string[] | null;
  avisos_copia: string[] | null;
  created_at: string;
};

export type EtapaFila = {
  id: string;
  clave: string;
  orden: number;
  estado: 'bloqueada' | 'abierta' | 'enviada' | 'cambios' | 'aprobada';
  respuestas: Record<string, any>;
  enviada_at: string | null;
  aprobada_at: string | null;
  nota_sacs: string | null;
  updated_at: string;
};

/** Un token vacío o absurdo nunca debe llegar a la base. */
export function tokenValido(t: unknown): t is string {
  return typeof t === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(t);
}

export async function briefPorToken(token: string): Promise<Brief | null> {
  if (!tokenValido(token)) return null;
  const { data } = await supabase.from('proyecto_brief').select('*').eq('token', token).maybeSingle();
  return (data as Brief) || null;
}

/**
 * Las etapas del brief, creando las que falten. Así, agregar una etapa al
 * cuestionario no obliga a tocar la base ni a re-sembrar los briefs vivos.
 */
export async function etapasDe(briefId: string): Promise<EtapaFila[]> {
  const { data } = await supabase
    .from('proyecto_etapa')
    .select('*')
    .eq('brief_id', briefId)
    .order('orden');
  const filas = (data || []) as EtapaFila[];
  const hay = new Set(filas.map((f) => f.clave));
  const faltan = ETAPAS.filter((e) => !hay.has(e.clave));
  if (faltan.length) {
    // Las etapas nacen ABIERTAS. No dependen de la firma ni de que se haya
    // cerrado la anterior (dueno, 19-sep-2026: "lo que se necesita es que
    // estas secciones esten abiertas"). La firma sigue existiendo como
    // constancia de quien responde por el brief, pero ya no es una puerta:
    // quien entra con el link puede empezar a contestar de inmediato.
    const nuevas = faltan.map((e) => ({
      brief_id: briefId,
      clave: e.clave,
      orden: e.orden,
      estado: 'abierta',
    }));
    const { data: creadas } = await supabase.from('proyecto_etapa').insert(nuevas).select('*');
    filas.push(...(((creadas || []) as EtapaFila[]) || []));
  }

  // Si se intercala una etapa nueva, las viejas se quedarian con el orden de
  // antes y la lista saldria desordenada. Aqui se sincroniza contra la
  // definicion, que es la unica fuente de verdad del orden.
  for (const e of ETAPAS) {
    const f = filas.find((x) => x.clave === e.clave);
    if (f && f.orden !== e.orden) {
      await supabase.from('proyecto_etapa').update({ orden: e.orden }).eq('id', f.id);
      f.orden = e.orden;
    }
  }
  // Una etapa que se quitó del cuestionario deja su fila en la base. Si se
  // devolviera, el brief diría "0 de 12 etapas" cuando son 11, y el contador
  // nunca llegaría al final. Se filtra, no se borra: si tenía respuestas, ahí
  // siguen por si la etapa vuelve.
  const vivas = new Set(ETAPAS.map((e) => e.clave));
  const huerfanas = filas.filter((f) => !vivas.has(f.clave));
  if (huerfanas.length) {
    console.warn(`[proyecto] etapas fuera del cuestionario, ocultas: ${huerfanas.map((f) => f.clave).join(', ')}`);
  }

  const resultado = filas.filter((f) => vivas.has(f.clave));
  resultado.sort((a, b) => a.orden - b.orden);
  return resultado;
}

export async function bitacora(
  briefId: string,
  actor: 'cliente' | 'sacs',
  accion: string,
  etapaClave?: string | null,
  detalle?: string | null,
) {
  await supabase.from('proyecto_bitacora').insert({
    brief_id: briefId,
    etapa_clave: etapaClave || null,
    actor,
    accion,
    detalle: detalle || null,
  });
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
