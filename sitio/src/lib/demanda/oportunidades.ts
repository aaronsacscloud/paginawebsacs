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
  /* EL EJE CORRECTO ES SOBRE QUÉ, NO SOBRE QUIÉN.
     Primero se probó clasificar por quién preguntaba —cliente o desconocido—
     usando el dato del CRM, que es un hecho y no una opinión. Mejoró, pero
     sobre-corrigió: «cuál es el costo» acabó de función de producto.

     El error estaba en la pregunta. Que una duda la tenga un cliente actual NO
     la saca del mercado: «cómo sé qué tallas recomprar» se la hace igual quien
     ya nos paga y quien no nos conoce, y esa segunda persona la escribe en
     Google. Lo que de verdad separa es de qué trata: del OFICIO —cómo se lleva
     un negocio de moda, que cualquiera busca— o de NUESTRO SOFTWARE —cómo se
     comporta Sacs, que fuera de nuestros clientes no busca nadie—.

     El origen de las señales se conserva como evidencia y como contraste: si el
     modelo dice «oficio» y el 100% de las señales vinieron de soporte, la
     etiqueta se corrige sola hacia el software. Un hecho pesa más que un juicio
     cuando se contradicen. */
  const fuentes: Record<string, number> = c.fuentes || {};
  const total = Object.values(fuentes).reduce((a, b) => a + Number(b), 0);
  const deSoporte = Number(fuentes.soporte || 0) + Number(fuentes.mejoras || 0);
  const soloSoporte = total >= 2 && deSoporte / total >= 0.8;

  const sobreQue = soloSoporte ? 'nuestro_software' : (c.capturado_por?.sobre_que || 'oficio');

  // Lo que ya responden las páginas de venta no genera trabajo nuevo: si no
  // rankean, eso es un asunto de SEO sobre una página que ya existe, y lo
  // levantan las reglas de movimientos.
  if (sobreQue === 'comercial' || sobreQue === 'ruido') return null;

  if (sobreQue === 'nuestro_software') {
    return n(c.senales_n) >= 3
      ? { tipo: 'PRODUCT_FEATURE', accion: 'Al roadmap o a la ayuda: es sobre cómo se comporta Sacs, y fuera de nuestros clientes no lo busca nadie', esfuerzo: 'L' }
      : null;
  }

  /* DOS SEÑALES TIENEN QUE COINCIDIR, nunca una sola.
     Lo enseñó el cambio de modelo: un evaluador calificaba «distribución por
     IA» alto para casi todo (60 de media, 33 de 80 por encima de 75) mientras
     daba «potencial de herramienta» casi en cero. Con un umbral suelto sobre un
     número, el backlog se llenó de MCP para cosas como «el cajero tiene
     permisos que no debería tener».

     Y el modelo no se estaba equivocando en las dos: tenía razón en que eso NO
     es una herramienta. El defecto era de la regla, que dejaba decidir a un
     solo número sin contraste. Para que una IA pueda EJECUTAR algo, ese algo
     tiene que poder existir como herramienta: si el potencial de herramienta es
     bajo, no hay nada que ejecutar por más que suene a IA.

     Esto además hace la regla robusta ante el proveedor: un score mal calibrado
     ya no alcanza para desviar el backlog entero. */
  const herramienta = n(c.potencial_herramienta);
  const distribucion = n(c.potencial_distribucion_ia);

  if (herramienta >= 70 && distribucion >= 70)
    return { tipo: 'FREE_TOOL', accion: 'Construir una herramienta gratis que lo resuelva, y exponerla también por API/MCP', esfuerzo: 'L' };
  if (herramienta >= 70)
    return { tipo: 'CALCULATOR', accion: 'Construir una herramienta gratis que lo resuelva', esfuerzo: 'L' };
  if (distribucion >= 75 && herramienta >= 55)
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
        sobre_que: c.capturado_por?.sobre_que || null,
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
