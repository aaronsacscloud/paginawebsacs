// DEMAND ENGINE · registrar señales.
//
// Una señal es un hecho con procedencia. La firma de esta función obliga a
// declarar de dónde salió y con qué naturaleza porque esa es la regla que
// sostiene todo lo demás: si una inferencia puede entrar disfrazada de
// observación, ningún número de arriba significa nada.
import { supabase } from '../supabase';
import { redactPII } from '../ai/redact';
import type { Naturaleza } from './tipos';

export type EntradaSenal = {
  clave_idem: string;
  tipo_fuente: string;
  fuente: string;
  fuente_url?: string | null;
  observada_at?: string | Date;
  pais?: string;
  idioma?: string;
  naturaleza: Naturaleza;
  tipo_senal: string;
  query_cruda?: string | null;
  texto?: string | null;
  payload?: Record<string, any>;
  confianza?: number;
  icp?: string[];
  peso?: number;
};

/** Nada que venga de una persona entra sin pasar por aquí. Es una decisión de
 *  diseño, no una precaución: las señales se leen después en prompts, en
 *  pantallas y algún día en contenido público. */
/* Buena parte de lo que llega por WhatsApp son FORMULARIOS pegados: «Full
   name: …», «Nombre y apellido: …», «ADMINISTRADOR …». El anonimizador general
   caza correos, teléfonos y RFC, pero no un nombre suelto —detectar nombres por
   patrón es adivinar—. Lo que sí se puede hacer sin adivinar es tapar el VALOR
   que va después de una etiqueta que anuncia un dato personal. Es donde están
   casi todos los nombres de estas fuentes, y el resto lo corta el paso
   siguiente, que reescribe la señal como pregunta del ramo y tiene prohibido
   conservar nombres propios. */
const ETIQUETAS_PERSONALES = [
  /\b(full name|nombre y apellido|nombre completo|nombre del administrador|administrador|contacto|atenci[oó]n a|a nombre de)\s*:?\s*[^\n,;|]{3,60}/gi,
  /\b(direcci[oó]n|domicilio|calle)\s*:\s*[^\n;|]{5,90}/gi,
];

function limpiar(t?: string | null): string | null {
  if (!t) return null;
  let texto = redactPII(t).text;
  for (const re of ETIQUETAS_PERSONALES) {
    texto = texto.replace(re, (m) => `${m.split(/[:]/)[0]}: [DATO PERSONAL]`);
  }
  return texto.slice(0, 4000);
}

export async function registrarSenal(e: EntradaSenal): Promise<'nueva' | 'repetida'> {
  const { error } = await supabase.from('de_senales').insert({
    clave_idem: e.clave_idem,
    tipo_fuente: e.tipo_fuente,
    fuente: e.fuente,
    fuente_url: e.fuente_url || null,
    observada_at: e.observada_at ? new Date(e.observada_at).toISOString() : new Date().toISOString(),
    pais: e.pais || 'MX',
    idioma: e.idioma || 'es',
    naturaleza: e.naturaleza,
    tipo_senal: e.tipo_senal,
    query_cruda: limpiar(e.query_cruda),
    texto: limpiar(e.texto),
    payload: e.payload || {},
    confianza: e.confianza ?? 0.7,
    icp: e.icp || [],
    peso: e.peso ?? 1,
  });
  // El choque de clave es el comportamiento esperado, no un error: significa
  // que este hecho ya estaba registrado.
  if (error) return 'repetida';
  return 'nueva';
}

/**
 * Por lotes. Una fila por viaje tardaba 60 ms cada una: quinientas señales eran
 * medio minuto y las dieciséis mil del histórico de WhatsApp no cabían jamás en
 * los 300 segundos que da Vercel. En bloques de 500, con el índice único
 * haciendo de filtro, la misma carga son segundos.
 */
export async function registrarVarias(es: EntradaSenal[]): Promise<{ nuevas: number; repetidas: number }> {
  if (!es.length) return { nuevas: 0, repetidas: 0 };
  let nuevas = 0;

  for (let i = 0; i < es.length; i += 500) {
    const bloque = es.slice(i, i + 500).map(e => ({
      clave_idem: e.clave_idem,
      tipo_fuente: e.tipo_fuente,
      fuente: e.fuente,
      fuente_url: e.fuente_url || null,
      observada_at: e.observada_at ? new Date(e.observada_at).toISOString() : new Date().toISOString(),
      pais: e.pais || 'MX',
      idioma: e.idioma || 'es',
      naturaleza: e.naturaleza,
      tipo_senal: e.tipo_senal,
      query_cruda: limpiar(e.query_cruda),
      texto: limpiar(e.texto),
      payload: e.payload || {},
      confianza: e.confianza ?? 0.7,
      icp: e.icp || [],
      peso: e.peso ?? 1,
    }));
    // `ignoreDuplicates` es lo que hace que reingerir sea inofensivo: lo que ya
    // estaba se salta sin error y sin sobrescribir.
    const { data, error } = await supabase
      .from('de_senales')
      .upsert(bloque, { onConflict: 'clave_idem', ignoreDuplicates: true })
      .select('id');
    if (error) throw new Error(`[senales] no se pudo guardar el lote: ${error.message}`);
    nuevas += (data || []).length;
  }
  return { nuevas, repetidas: es.length - nuevas };
}
