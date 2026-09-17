// DEMAND ENGINE · la visibilidad en las IAs.
//
// Mide una sola cosa, y es la que el dueño pidió: cuando alguien del ramo le
// pregunta a una IA qué software usar, ¿aparece Sacs? ¿en qué lugar? ¿y a quién
// citan en su lugar?
//
// La regla que hace honesto el número: si una plataforma no se pudo consultar,
// se guarda NO_DISPONIBLE con su motivo. Nunca un cero. Un cero se promedia y
// arrastra el resultado; un hueco declarado se ve y se arregla.
import { supabase } from '../../supabase';
import { preguntarA, plataformasDisponibles, type Plataforma } from './proveedores';
import { preguntar } from '../ia';
import { registrar } from '../handlers';
import { diaCdmx } from '../fechas';
import type { ResultadoHandler } from '../tipos';

/** Cómo llamamos a la marca en los textos. «Sacs» solo, en minúsculas, aparece
 *  dentro de otras palabras (buscar, sacsa), así que se pide el límite. */
const NOMBRES = /\bsacs\s?cloud\b|\bsacscloud\b|\bsacs\b/i;

const ESQUEMA = {
  type: 'object',
  properties: {
    menciona_sacs: { type: 'boolean' },
    posicion_sacs: { type: 'integer', description: 'lugar en que aparece Sacs en la lista, 1 el primero; 0 si no aparece' },
    recomendacion: { type: 'string', enum: ['primera_opcion', 'entre_las_opciones', 'mencion_de_paso', 'no_aparece'] },
    sentimiento: { type: 'string', enum: ['positivo', 'neutro', 'negativo', 'no_aplica'] },
    competidores: { type: 'array', items: { type: 'string' }, description: 'productos recomendados, en el orden en que aparecen' },
    razon: { type: 'string', description: 'por qué recomienda lo que recomienda, en una línea' },
  },
  required: ['menciona_sacs', 'recomendacion', 'competidores'],
};

const SISTEMA = `Lees la respuesta que una IA le dio a alguien que busca software para su negocio de moda en México, y extraes datos. No opinas ni completas: si algo no está, no está.

- menciona_sacs: si aparece «Sacs», «Sacscloud» o «Sacs Cloud» como un producto recomendado. Que aparezca la palabra dentro de otra (buscar, sacsa) NO cuenta.
- posicion_sacs: en qué lugar de la lista aparece (1 = el primero). 0 si no aparece.
- recomendacion: qué tan fuerte es la mención de Sacs.
- competidores: los productos que SÍ recomienda, en orden. Solo nombres de producto, no categorías.
- razon: por qué recomienda el primero, en una línea.`;

export type Muestra = {
  prompt_id: string; plataforma: Plataforma; estado: string;
  menciona: boolean; posicion: number; competidores: string[]; citas: string[];
};

export async function medirPrompt(promptId: string, texto: string, pais = 'MX'): Promise<{ muestras: Muestra[]; costo: number }> {
  const plataformas = plataformasDisponibles();
  const muestras: Muestra[] = [];
  let costo = 0;

  // En paralelo: son cuatro llamadas lentas y hacerlas en fila multiplica por
  // cuatro el tiempo de la corrida sin ganar nada.
  const respuestas = await Promise.all(plataformas.map(p => preguntarA(p, texto, pais)));

  for (const r of respuestas) {
    if (r.estado !== 'ok' || !r.texto) {
      await supabase.from('de_ia_muestras').insert({
        prompt_id: promptId, plataforma: r.plataforma, modelo: r.modelo || null,
        fecha: diaCdmx(), estado: r.estado === 'no_disponible' ? 'no_disponible' : 'error',
        respuesta: { motivo: r.motivo }, confianza: 0,
      });
      muestras.push({ prompt_id: promptId, plataforma: r.plataforma, estado: r.estado, menciona: false, posicion: 0, competidores: [], citas: [] });
      continue;
    }

    // Se lee con un modelo barato: extraer datos de un texto es trabajo de
    // volumen, no de criterio.
    const e = await preguntar<any>({
      agente: 'geo_extractor', trabajo: 'volumen',
      sistema: SISTEMA, usuario: r.texto.slice(0, 12000), esquema: ESQUEMA, max_tokens: 3000,
      contexto: { plataforma: r.plataforma },
    });
    costo += e.costo_usd;

    // El dato duro manda sobre el juicio: si el texto NO contiene el nombre, no
    // lo menciona, diga lo que diga el extractor.
    const enTexto = NOMBRES.test(r.texto);
    const d = e.datos || {};
    const menciona = enTexto && !!d.menciona_sacs;

    await supabase.from('de_ia_muestras').insert({
      prompt_id: promptId, plataforma: r.plataforma, modelo: r.modelo || null,
      fecha: diaCdmx(), estado: 'ok',
      sacs_mencionado: menciona,
      posicion: menciona ? (Number(d.posicion_sacs) || null) : null,
      fuerza_recomendacion: { primera_opcion: 3, entre_las_opciones: 2, mencion_de_paso: 1, no_aparece: 0 }[d.recomendacion as string] ?? 0,
      sentimiento: d.sentimiento || null,
      competidores: (d.competidores || []).slice(0, 20),
      citas: r.citas.slice(0, 30),
      urls_citadas: r.citas.slice(0, 30),
      url_sacs_citada: r.citas.find(u => /sacscloud/i.test(u)) || null,
      resumen_razon: (d.razon || '').slice(0, 400),
      // La respuesta completa se guarda: dentro de seis meses, cuando el número
      // haya cambiado, la única forma de saber POR QUÉ es haberla guardado.
      respuesta: { texto: r.texto.slice(0, 20000), ms: r.ms },
      confianza: enTexto === !!d.menciona_sacs ? 0.95 : 0.6,
    });

    muestras.push({
      prompt_id: promptId, plataforma: r.plataforma, estado: 'ok',
      menciona, posicion: Number(d.posicion_sacs) || 0,
      competidores: d.competidores || [], citas: r.citas,
    });
  }

  return { muestras, costo };
}

/** El AI Visibility Score: 0 a 100. Tres cosas, con el peso que les toca. */
export async function calcularAvs(dias = 30): Promise<Record<string, number>> {
  const { data } = await supabase.rpc('de_avs', { dias });
  const r = (data || [])[0] || {};
  const medidas = Number(r.medidas || 0);
  if (!medidas) return { avs: 0, medidas: 0 };

  const mencion = Number(r.con_mencion || 0) / medidas;
  const cita = Number(r.con_cita || 0) / medidas;
  const top3 = Number(r.en_top3 || 0) / medidas;

  const metricas = {
    // Aparecer es lo básico; que te citen la URL vale más (es tráfico y es
    // verificable); estar entre los tres primeros es lo que decide una compra.
    avs: Math.round((mencion * 40 + cita * 25 + top3 * 35) * 10) / 10,
    tasa_mencion: Math.round(mencion * 1000) / 10,
    tasa_cita: Math.round(cita * 1000) / 10,
    tasa_top3: Math.round(top3 * 1000) / 10,
    medidas,
    prompts_cubiertos: Number(r.prompts || 0),
  };

  const fecha = diaCdmx();
  for (const [metrica, valor] of Object.entries(metricas)) {
    await supabase.from('de_metricas_diarias').upsert(
      { fecha, metrica, dimension: 'ia', valor_dim: 'todo', valor },
      { onConflict: 'fecha,metrica,dimension,valor_dim' });
  }
  return metricas;
}

registrar('geo.muestrear', async (a, ctx): Promise<ResultadoHandler> => {
  // Los más rancios primero: así todos se miden por turno y la serie no tiene
  // huecos en unos prompts y sobra en otros.
  const { data: prompts } = await supabase.rpc('de_prompts_por_medir', { limite: Number(a.payload?.limite) || 8 });
  if (!prompts?.length) return { ok: true, resumen: 'no hay prompts que medir' };

  let costo = 0, medidos = 0, apariciones = 0;
  for (const p of prompts) {
    if (Date.now() > ctx.limite - 60_000) break;
    const r = await medirPrompt(p.id, p.prompt, p.pais || 'MX');
    costo += r.costo; medidos++;
    apariciones += r.muestras.filter(m => m.menciona).length;
    await supabase.from('de_prompts_ia').update({ medido_at: new Date().toISOString() }).eq('id', p.id);
  }

  const avs = await calcularAvs();
  return {
    ok: true,
    resumen: `${medidos} prompts medidos · Sacs apareció ${apariciones} ${apariciones === 1 ? 'vez' : 'veces'} · visibilidad ${avs.avs}/100`,
    datos: { medidos, apariciones, avs },
    costo_usd: costo,
  };
});

registrar('geo.score', async (): Promise<ResultadoHandler> => {
  const avs = await calcularAvs();
  return { ok: true, resumen: `visibilidad en IA: ${avs.avs}/100 sobre ${avs.medidas} mediciones`, datos: avs };
});
