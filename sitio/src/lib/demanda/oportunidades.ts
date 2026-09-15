// DEMAND ENGINE · de problema a oportunidad.
//
// Un problema es algo que alguien necesita; una oportunidad es algo que
// NOSOTROS podemos hacer al respecto. La traducción no es automática: el mismo
// problema puede pedir una página, una herramienta gratis o una función del
// producto, y elegir mal es la diferencia entre trabajo útil y trabajo perdido.
//
// La regla que evita el pantano: una oportunidad por problema y tipo, con clave
// determinista. Sin eso, cada corrida diaria propondría otra vez lo mismo y el
// backlog se volvería ilegible en una semana — que es como mueren estos
// sistemas.
import { supabase } from '../supabase';
import { registrar } from './handlers';
import { pesosVigentes, factoresDe, combinar } from './score';
import type { ResultadoHandler } from './tipos';

/** Qué hacer con un problema, según cómo salió evaluado. El orden importa: se
 *  toma la PRIMERA que aplique, no todas. */
function decidirTipo(c: any): { tipo: string; accion: string; esfuerzo: 'S' | 'M' | 'L' } | null {
  const n = (x: any, d = 0) => (Number.isFinite(x) ? Number(x) : d);

  // Lo que no es nuestro no genera trabajo, por mucha gente que lo pregunte.
  if (n(c.relevancia_sacs) < 35) return null;

  /* LO PRIMERO es de QUIÉN viene, no cuánto puntúa. El primer backlog real
     propuso escribir una página para «agendar una llamada» (28 veces) y meter
     «conocer más sobre el software» al roadmap. Las dos son de gente que ya
     está hablando con nosotros: no hay demanda que capturar ahí, y el trabajo
     que generan es de ventas o de producto, no de marketing. */
  const tipoDemanda = c.capturado_por?.tipo_demanda || 'mercado';

  if (tipoDemanda === 'en_proceso') return null;   // es del proceso de venta

  if (tipoDemanda === 'cliente_actual') {
    // Un problema que solo existe si ya eres cliente es del producto. Escribir
    // una página sobre un error del sistema no lo arregla.
    return n(c.senales_n) >= 3
      ? { tipo: 'PRODUCT_FEATURE', accion: 'Llevarlo al roadmap: lo viven clientes actuales y no se resuelve con contenido', esfuerzo: 'L' }
      : null;
  }

  if (n(c.potencial_herramienta) >= 75 && n(c.potencial_distribucion_ia) >= 60)
    return { tipo: 'FREE_TOOL', accion: 'Construir una herramienta gratis que lo resuelva, y exponerla también por API/MCP', esfuerzo: 'L' };
  if (n(c.potencial_herramienta) >= 75)
    return { tipo: 'CALCULATOR', accion: 'Construir una herramienta gratis que lo resuelva', esfuerzo: 'L' };
  if (n(c.potencial_distribucion_ia) >= 75)
    return { tipo: 'MCP', accion: 'Exponerlo como herramienta que una IA pueda ejecutar', esfuerzo: 'M' };
  if (n(c.valor_dato) >= 70)
    return { tipo: 'DATASET', accion: 'Publicar el dato agregado del ramo que responde esto', esfuerzo: 'M' };
  if (n(c.potencial_red) >= 70)
    return { tipo: 'WHOLESALE_NETWORK', accion: 'Usarlo como puerta para conectar retailers con mayoristas', esfuerzo: 'L' };
  if (n(c.potencial_contenido) >= 60)
    return { tipo: 'SEO_CONTENT', accion: 'Escribir la página que lo responda mejor que nadie', esfuerzo: 'M' };
  if (n(c.potencial_conversion) >= 65)
    return { tipo: 'LANDING_PAGE', accion: 'Hacerle una página con intención comercial', esfuerzo: 'M' };
  return null;
}

export async function crearOportunidades(limite = 120): Promise<{ nuevas: number; repetidas: number; sin_accion: number }> {
  const { version, pesos } = await pesosVigentes();
  const { data: clusters } = await supabase
    .from('de_clusters')
    .select('*')
    .not('relevancia_sacs', 'is', null)
    .neq('estado', 'descartado')
    .order('score_oportunidad', { ascending: false, nullsFirst: false })
    .limit(limite);

  let nuevas = 0, repetidas = 0, sin_accion = 0;
  for (const c of clusters || []) {
    const d = decidirTipo(c);
    if (!d) { sin_accion++; continue; }

    const clave = `${d.tipo}:${c.id}`;
    const { data: ya } = await supabase.from('de_oportunidades').select('id').eq('clave_idem', clave).maybeSingle();
    if (ya) { repetidas++; continue; }

    const f = factoresDe(c, null);
    const { error } = await supabase.from('de_oportunidades').insert({
      clave_idem: clave,
      tipo: d.tipo,
      cluster_id: c.id,
      titulo: c.problema_canonico,
      descripcion: c.capturado_por?.por_que || null,
      // La evidencia viaja con la oportunidad: quien la apruebe tiene que poder
      // ver de dónde salió sin ir a buscarla.
      evidencia: {
        senales: c.senales_n, formas_de_preguntarlo: c.queries_n,
        categoria: c.categoria, icp: c.icp,
        naturaleza: c.naturaleza_dominante,
        origen: c.fuentes || {},
        tipo_demanda: c.capturado_por?.tipo_demanda || 'mercado',
      },
      score: combinar(f, pesos),
      desglose: f,
      pesos_version: version,
      accion_recomendada: d.accion,
      esfuerzo: d.esfuerzo,
      descubrimiento_tipo: c.capturado_por?.descubrimiento_tipo || null,
      riesgo: 'LOW',
      estado: 'nueva',
    });
    if (error) { repetidas++; continue; }
    nuevas++;
  }
  return { nuevas, repetidas, sin_accion };
}

registrar('oportunidad.crear', async (): Promise<ResultadoHandler> => {
  const r = await crearOportunidades();
  return {
    ok: true,
    resumen: r.nuevas ? `${r.nuevas} oportunidades nuevas (${r.sin_accion} problemas sin acción clara)` : `nada nuevo · ${r.repetidas} ya estaban`,
    datos: r,
  };
});
