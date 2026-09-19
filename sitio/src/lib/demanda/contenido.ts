// DEMAND ENGINE · del problema detectado a la página escrita.
//
// Dos pasos y están separados a propósito:
//
//   contenido.brief     decide QUÉ página hace falta y por qué
//   contenido.borrador  la escribe
//
// Separarlos cuesta una llamada más y evita el fallo que hunde a todo el
// contenido generado: **escribir sobre el tema en vez de sobre el problema**.
// Con un solo paso, el modelo lee «omnicanalidad» y escribe un ensayo sobre
// omnicanalidad. Con brief, primero tiene que contestar en qué momento está
// quien pregunta, qué duda concreta tiene y qué le contestaríamos si estuviera
// enfrente — y recién entonces escribe.
//
// EL DATO QUE LO HACE POSIBLE, y que casi ningún generador de contenido tiene:
// aquí sabemos CÓMO PREGUNTÓ LA GENTE, literal. Cada oportunidad viene de un
// grupo de búsquedas y mensajes reales. Un ejemplo medido: la oportunidad de
// «omnicanalidad» tiene cuatro formas de preguntarlo y DOS son sobre el precio
// —«es un costo aparte», «tiene costo adicional»—, no sobre cómo montarla.
// Escribir el tutorial de omnicanalidad habría sido contestar otra pregunta.
//
// Los topes y los permisos NO se deciden aquí: viven en `de_politicas`
// (brief 20/día, borrador 10/día, publicar requiere aprobación) y la cola los
// respeta. Este archivo solo sabe escribir.
import { supabase } from '../supabase';
import { preguntar } from './ia';
import { registrar } from './handlers';
import { fichaSacs } from './capacidades';
import { traerTodo } from './paginar';
import type { Bloque } from './bloques';
import type { ResultadoHandler } from './tipos';

/** Recorta sin partir palabras ni dejar la frase colgando. */
function recortar(t: string, max: number): string {
  const s = t.trim();
  if (s.length <= max) return s;
  const corte = s.slice(0, max);
  const i = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf(', '), corte.lastIndexOf(' '));
  return (i > max * 0.6 ? corte.slice(0, i) : corte).replace(/[\s,;:]+$/, '') + '.';
}

/** Cuántas oportunidades se atienden por corrida. El tope de verdad lo pone la
 *  política; esto solo evita que una corrida se coma la cuota del día. */
const POR_CORRIDA = 5;

// ── el brief ────────────────────────────────────────────────────────────────

export type Brief = {
  pregunta: string;          // la duda real, como la tendría en la cabeza quien busca
  quien: string;             // en qué momento está: qué tiene, qué le está pasando
  promesa: string;           // qué se lleva quien la lee, en una frase
  demostrar: string[];       // lo que la página tiene que probar para ser creíble
  secciones: string[];       // el esqueleto
  faq: string[];             // las preguntas que hay que contestar sí o sí
  seccion: 'recursos' | 'comparar' | 'software-para';
  slug: string;
  enlaces: string[];         // slugs de guías propias que encajan
  nota_honestidad?: string;  // lo que NO podemos afirmar y hay que rodear
};

const ESQUEMA_BRIEF = {
  type: 'object', additionalProperties: false,
  properties: {
    pregunta: { type: 'string' }, quien: { type: 'string' }, promesa: { type: 'string' },
    demostrar: { type: 'array', items: { type: 'string' } },
    secciones: { type: 'array', items: { type: 'string' } },
    faq: { type: 'array', items: { type: 'string' } },
    seccion: { type: 'string', enum: ['recursos', 'comparar', 'software-para'] },
    slug: { type: 'string' },
    enlaces: { type: 'array', items: { type: 'string' } },
    nota_honestidad: { type: 'string' },
  },
  required: ['pregunta', 'quien', 'promesa', 'demostrar', 'secciones', 'faq', 'seccion', 'slug', 'enlaces'],
};

const SISTEMA_BRIEF = `Decides qué página hace falta escribir para el sitio de Sacs, un sistema de punto de venta e inventario para tiendas de ropa, calzado y joyería en México.

NO escribes la página. Escribes el encargo: qué contestar, para quién y qué hay que demostrar.

LO QUE MÁS IMPORTA
Te doy LAS FORMAS REALES en que la gente preguntó esto —búsquedas de Google y mensajes de prospectos por WhatsApp—. Léelas con cuidado: la pregunta real casi nunca es el tema.
  Ejemplo real: un grupo etiquetado «omnicanalidad» tenía cuatro formas, y dos eran «¿es un costo aparte?». Quien pregunta no quiere un tutorial de omnicanalidad: quiere saber si le van a cobrar más.
Si las formas se contradicen o apuntan a dos dudas distintas, elige LA MÁS FRECUENTE y dilo en «quien».

CÓMO SE DECIDE CADA CAMPO
- «pregunta»: la duda tal como la tendría en la cabeza quien busca. En su idioma, no en el nuestro.
- «quien»: en qué momento está. Qué tiene ya, qué le está pasando, por qué pregunta HOY. Esto es lo que evita escribir para nadie.
- «promesa»: qué se lleva al terminar de leer. Una frase. Si no sabes decirla, la página no hace falta.
- «demostrar»: dos a cuatro cosas que la página tiene que PROBAR para que le crean. Con qué dato, ejemplo o número. No «hablar de X», sino «probar que X».
- «secciones»: cuatro a siete encabezados, en orden. Que cuenten algo, no que enumeren.
- «faq»: tres a cinco preguntas que alguien haría de verdad después de leer.
- «seccion»: «recursos» para guías del ramo; «comparar» solo si compara con otro producto; «software-para» para páginas por tipo de negocio.
- «slug»: corto, en minúsculas y guiones, sin la marca, en el idioma de la pregunta.
- «enlaces»: slugs de la lista de guías publicadas que de verdad tratan lo mismo. Ninguno si ninguno encaja. NO inventes slugs.
- «nota_honestidad»: si lo que preguntan toca algo que Sacs NO hace según la ficha, dilo aquí y di cómo rodearlo sin mentir. Es el campo más valioso cuando aplica.

Español de México, llano. Si la pregunta es sobre precio, el brief tiene que ir sobre precio.`;

export async function escribirBrief(oportunidadId: string): Promise<{ ok: boolean; brief?: Brief; error?: string; costo: number }> {
  const { data: op } = await supabase.from('de_oportunidades')
    .select('id, titulo, descripcion, tipo, score, evidencia, cluster_id, accion_recomendada')
    .eq('id', oportunidadId).maybeSingle();
  if (!op) return { ok: false, error: 'no existe esa oportunidad', costo: 0 };

  /* Las formas REALES de preguntarlo. Es el insumo que distingue este brief de
     uno escrito mirando un título. */
  const { data: queries } = await supabase.from('de_queries')
    .select('texto_original, intent, intent_comercial, senales_n, impresiones_28d, posicion_actual, fuentes')
    .eq('cluster_id', op.cluster_id || '')
    .order('senales_n', { ascending: false })
    .limit(20);

  const { data: cl } = await supabase.from('de_clusters')
    .select('problema_canonico, descripcion, categoria, etapa_journey, icp')
    .eq('id', op.cluster_id || '').maybeSingle();

  // Lo ya publicado, para no escribir dos veces lo mismo.
  const publicadas = await traerTodo<any>('de_contenido', 'seccion, slug, titulo', q => q.eq('estado', 'publicado'));

  /* LO QUE EL DUEÑO YA RECHAZÓ, y por qué. Es la única pieza que hace que esto
     mejore con el tiempo en vez de repetir el mismo fallo cada semana.
     Sin esto, la sensación es que el motor no aprende — cuando lo que pasa es
     que nadie le contó. */
  const { data: rechazos } = await supabase.from('de_contenido')
    .select('slug, auditorias')
    .eq('estado', 'rechazado')
    .order('actualizado_at', { ascending: false })
    .limit(12);
  const aprendido = (rechazos || [])
    .map(r => (r.auditorias as any)?.rechazo?.motivo)
    .filter(Boolean)
    .map((m: string) => `  - ${m}`)
    .join('\n');

  const formas = (queries || []).map(q =>
    `  «${q.texto_original}» · ${q.intent || 'intención desconocida'}` +
    (q.impresiones_28d ? ` · ${q.impresiones_28d} impresiones en 28 días` : '') +
    (q.posicion_actual ? ` · hoy salimos en posición ${Math.round(q.posicion_actual)}` : '') +
    (q.fuentes ? ` · visto en: ${Array.isArray(q.fuentes) ? q.fuentes.join(', ') : q.fuentes}` : '')
  ).join('\n') || '  (sin formas registradas — usa el título y dilo en «quien»)';

  const usuario = `OPORTUNIDAD DETECTADA
Título: ${op.titulo}
Descripción: ${op.descripcion || '(sin descripción)'}
Puntuación: ${op.score} · Acción sugerida: ${op.accion_recomendada || '—'}
Evidencia: ${JSON.stringify(op.evidencia || {})}
${cl ? `Problema del grupo: ${cl.problema_canonico || '—'} · etapa: ${cl.etapa_journey || '—'} · a quién le pasa: ${JSON.stringify(cl.icp || [])}` : ''}

CÓMO LO PREGUNTÓ LA GENTE (léelo antes de decidir nada)
${formas}

${fichaSacs()}

YA PUBLICADO (no repitas; si el tema ya está cubierto, dilo en «nota_honestidad»)
${publicadas.map(p => `  /${p.seccion}/${p.slug}/ — ${p.titulo}`).join('\n')}
${aprendido ? `\nPOR ESTO SE RECHAZARON PÁGINAS ANTERIORES — no lo repitas:\n${aprendido}` : ''}

Escribe el encargo de la página.`;

  const r = await preguntar<Brief>({
    agente: 'contenido_brief', trabajo: 'estrategia',
    /* 6000 y no 3000: el primer brief que se cortó fue el MEJOR de la tanda —su
       «nota_honestidad» explicaba en detalle que no podemos decir que conectamos
       Instagram y Facebook, y cómo rodearlo sin mentir—. El campo más valioso es
       el más largo, así que apretar aquí es apretar justo donde no conviene. */
    sistema: SISTEMA_BRIEF, usuario, esquema: ESQUEMA_BRIEF, max_tokens: 6000,
  });
  if (!r.ok || !r.datos) return { ok: false, error: r.error || 'sin datos', costo: r.costo_usd || 0 };
  return { ok: true, brief: r.datos, costo: r.costo_usd || 0 };
}

registrar('contenido.brief', async (a): Promise<ResultadoHandler> => {
  const limite = Number(a.payload?.limite) || POR_CORRIDA;

  /* Solo oportunidades de contenido que NADIE haya atendido. `accion_id` se
     llena cuando una oportunidad ya generó trabajo: sin ese filtro, cada
     corrida volvería a escribir el brief de las mismas cinco y pagaría por
     ello todos los días. */
  const { data: ops } = await supabase.from('de_oportunidades')
    .select('id, titulo')
    .in('tipo', ['SEO_CONTENT', 'CONTENT_GAP'])
    .in('estado', ['nueva', 'aprobada'])
    .is('accion_id', null)
    .order('score', { ascending: false })
    .limit(limite);

  if (!ops?.length) return { ok: true, resumen: 'no hay oportunidades de contenido sin atender' };

  let hechos = 0, costo = 0;
  const fallos: string[] = [];
  for (const op of ops) {
    const r = await escribirBrief(op.id);
    costo += r.costo;
    if (!r.ok || !r.brief) { fallos.push(`${op.titulo.slice(0, 30)}: ${r.error}`); continue; }

    const clave = `${r.brief.seccion}:${r.brief.slug}`;
    const { data: ya } = await supabase.from('de_contenido').select('id, estado').eq('clave_idem', clave).maybeSingle();
    if (ya) {
      // Ya existe: se ata la oportunidad a lo que existe en vez de duplicar.
      await supabase.from('de_oportunidades').update({ accion_id: ya.id, resultado: { brief: 'ya existía esa página' } }).eq('id', op.id);
      continue;
    }

    const { data: nuevo, error } = await supabase.from('de_contenido').insert({
      clave_idem: clave, tipo: 'guia', seccion: r.brief.seccion, slug: r.brief.slug,
      titulo: r.brief.pregunta, h1: r.brief.pregunta, meta_desc: r.brief.promesa.slice(0, 160),
      brief: { ...r.brief, oportunidad_id: op.id },
      cuerpo: [], auditorias: {},
      estado: 'brief', version: 1, autor: 'motor', idioma: 'es', pais: 'MX',
    }).select('id').single();

    if (error) { fallos.push(`${r.brief.slug}: ${error.message}`); continue; }
    await supabase.from('de_oportunidades').update({ accion_id: nuevo.id }).eq('id', op.id);
    hechos++;
  }

  return {
    ok: fallos.length === 0,
    resumen: `${hechos} brief(s) escritos${fallos.length ? ` · ${fallos.length} fallaron: ${fallos.join(' | ').slice(0, 160)}` : ''}`,
    datos: { hechos, fallos },
    costo_usd: costo,
  };
});

// ── el borrador ─────────────────────────────────────────────────────────────

const ESQUEMA_BORRADOR = {
  type: 'object', additionalProperties: false,
  properties: {
    titulo: { type: 'string' }, h1: { type: 'string' }, meta_desc: { type: 'string' },
    cuerpo: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          t: { type: 'string', enum: ['h2', 'h3', 'p', 'lista', 'tabla', 'faq', 'pasos', 'cita', 'cta'] },
          texto: { type: 'string' },
          lista_items: { type: 'array', items: { type: 'string' } },
          encabezados: { type: 'array', items: { type: 'string' } },
          filas: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
          nota: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              properties: { p: { type: 'string' }, r: { type: 'string' }, titulo: { type: 'string' }, texto: { type: 'string' } },
            },
          },
          fuente: { type: 'string' }, boton: { type: 'string' }, url: { type: 'string' },
        },
        required: ['t'],
      },
    },
  },
  required: ['titulo', 'h1', 'meta_desc', 'cuerpo'],
};

const SISTEMA_BORRADOR = `Escribes una página para el sitio de Sacs siguiendo un encargo que ya está decidido. No cambias el encargo: lo cumples.

LA REGLA QUE MANDA
Contesta la PREGUNTA del encargo, no el tema. Si la pregunta es sobre precio, la página va sobre precio aunque el tema dé para un tratado.

LO QUE PUEDES AFIRMAR
Solo lo que está en la ficha de Sacs. Si el encargo pide demostrar algo que la ficha no respalda, NO lo inventes: descríbelo como el problema que es y di qué habría que hacer, sin prometer que Sacs lo hace.
Nada de estadísticas inventadas. Nada de «estudios dicen». Los ejemplos se presentan como ejemplos.

CÓMO SE ESCRIBE
- Español de México, llano, como habla un dueño de tienda. El vocabulario del ramo: corrida, curva, talla, apartado, temporada, sucursal, sell-through.
- Nada de «potencia tu negocio», «solución integral», «revoluciona», «en el mundo actual». Si una frase podría estar en el folleto de cualquier software, sobra.
- Empieza CONTESTANDO. El primer párrafo da la respuesta corta; el resto la sostiene.
- 1,000 a 1,600 palabras. Una guía que contesta de verdad necesita espacio; lo que sobra no son palabras, son párrafos que no dicen nada.
- Si no sabes algo con certeza, DILO y manda a preguntarlo en la demo. Una página que reconoce su límite se cita; una que promete de más se desmiente en la primera llamada.
- «titulo» máximo 53 caracteres (la plantilla agrega « | Sacs»). «meta_desc» máximo 150, y que termine en punto: si se corta, Google enseña una frase a medias.
- Negritas con **…** dentro de los párrafos, con criterio.

LOS BLOQUES
- «p» párrafo · «h2»/«h3» encabezados (usa los del encargo)
- «lista» → campo lista_items
- «pasos» → items con titulo y texto, cuando de verdad hay un orden
- «tabla» → encabezados + filas (+ nota), cuando se comparan cosas
- «faq» → items con p y r; usa las preguntas del encargo y contéstalas de verdad
- «cta» → texto, boton, url; una sola al final, a una herramienta gratis o a /contacto
- «cita» solo si citas algo real que venga en el encargo

ESTRUCTURA MÍNIMA: párrafo de respuesta, las secciones del encargo, el faq, y la cta.`;

export async function escribirBorrador(contenidoId: string): Promise<{ ok: boolean; error?: string; costo: number; palabras?: number }> {
  const { data: c } = await supabase.from('de_contenido')
    .select('id, slug, seccion, brief, estado').eq('id', contenidoId).maybeSingle();
  if (!c) return { ok: false, error: 'no existe ese contenido', costo: 0 };
  if (!c.brief || !(c.brief as any).pregunta) return { ok: false, error: 'no tiene brief', costo: 0 };

  const b = c.brief as any as Brief;
  const enlaces = (b.enlaces || []).map(s => `  /recursos/${s}/`).join('\n') || '  (ninguno)';

  const usuario = `EL ENCARGO
Pregunta que hay que contestar: ${b.pregunta}
Quién pregunta y en qué momento: ${b.quien}
Qué se lleva al terminar de leer: ${b.promesa}

Lo que la página tiene que DEMOSTRAR:
${(b.demostrar || []).map(x => `  - ${x}`).join('\n')}

Secciones, en orden:
${(b.secciones || []).map((x, i) => `  ${i + 1}. ${x}`).join('\n')}

Preguntas que hay que contestar en el FAQ:
${(b.faq || []).map(x => `  - ${x}`).join('\n')}

Enlaces propios que encajan (úsalos dentro del texto con [texto](/ruta/) o en la cta):
${enlaces}
${b.nota_honestidad ? `\nCUIDADO — lo que NO podemos afirmar:\n  ${b.nota_honestidad}` : ''}

${fichaSacs()}

Escribe la página.`;

  const r = await preguntar<any>({
    agente: 'contenido_borrador', trabajo: 'estrategia',
    sistema: SISTEMA_BORRADOR, usuario, esquema: ESQUEMA_BORRADOR, max_tokens: 10000,
  });
  if (!r.ok || !r.datos) return { ok: false, error: r.error || 'sin datos', costo: r.costo_usd || 0 };

  // Normalizar al formato de bloques del motor.
  const cuerpo: Bloque[] = (r.datos.cuerpo || []).map((x: any) => {
    if (x.t === 'lista') return { t: 'lista', items: x.lista_items || [] };
    if (x.t === 'faq') return { t: 'faq', items: (x.items || []).map((i: any) => ({ p: i.p, r: i.r })) };
    if (x.t === 'pasos') return { t: 'pasos', items: (x.items || []).map((i: any) => ({ titulo: i.titulo, texto: i.texto })) };
    if (x.t === 'tabla') return { t: 'tabla', encabezados: x.encabezados || [], filas: x.filas || [], ...(x.nota ? { nota: x.nota } : {}) };
    if (x.t === 'cita') return { t: 'cita', texto: x.texto, fuente: x.fuente || '' };
    if (x.t === 'cta') return { t: 'cta', texto: x.texto, boton: x.boton || 'Ver más', url: x.url || '/contacto' };
    return { t: x.t, texto: x.texto || '' };
  }).filter((x: any) => x.items || x.filas || x.texto);

  const { error } = await supabase.from('de_contenido').update({
    titulo: String(r.datos.titulo || '').slice(0, 80),
    h1: r.datos.h1 || r.datos.titulo,
    /* Recortar por PALABRA, no por carácter. `slice(0,160)` dejaba metas
       terminadas a mitad de palabra («…cierre separado de mayoreo »), que es
       exactamente lo que se ve en el buscador. */
    meta_desc: recortar(String(r.datos.meta_desc || ''), 158),
    cuerpo,
    estado: 'borrador',
    actualizado_at: new Date().toISOString(),
  }).eq('id', contenidoId);
  if (error) return { ok: false, error: error.message, costo: r.costo_usd || 0 };

  return { ok: true, costo: r.costo_usd || 0, palabras: JSON.stringify(cuerpo).split(/\s+/).length };
}

registrar('contenido.borrador', async (a): Promise<ResultadoHandler> => {
  const limite = Number(a.payload?.limite) || POR_CORRIDA;
  const { data: pend } = await supabase.from('de_contenido')
    .select('id, slug').eq('estado', 'brief').order('created_at').limit(limite);

  if (!pend?.length) return { ok: true, resumen: 'no hay briefs esperando borrador' };

  let hechos = 0, costo = 0, palabras = 0;
  const fallos: string[] = [];
  for (const c of pend) {
    const r = await escribirBorrador(c.id);
    costo += r.costo;
    if (!r.ok) { fallos.push(`${c.slug}: ${r.error}`); continue; }
    hechos++; palabras += r.palabras || 0;
  }

  return {
    ok: fallos.length === 0,
    resumen: `${hechos} borrador(es) escritos${palabras ? ` · ${Math.round(palabras / Math.max(hechos, 1))} palabras de media` : ''}${fallos.length ? ` · ${fallos.length} fallaron` : ''}`,
    datos: { hechos, fallos },
    costo_usd: costo,
  };
});
