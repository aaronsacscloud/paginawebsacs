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
import { modaSectors } from '../../data/navigation';
import { videosCanal } from '../../data/videos-canal';
import { fichaSacs } from './capacidades';
import { traerTodo } from './paginar';
import { aMarkdown, type Bloque } from './bloques';
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
  nota_honestidad?: string;  // lo que NO podemos afirmar: precios, planes, datos externos, ley
  funciones_a_prometer?: string[]; // funciones que la página describe como de Sacs y no están construidas (para ventas)
  giro?: string;             // slug de /giros/<giro> al que va el cierre de la página
  /* Lo que agregan las fases posteriores (competencia, referee, imagen): */
  competencia?: any;         // páginas que hoy rankean + hueco común (contenido.competencia)
  correcciones?: string[];   // lo que el referee mandó cambiar en la última ronda
  reescrituras?: number;     // cuántas rondas lleva
  portada?: { url: string; alt: string };
  /* Investigación (agentes o contenido.competencia): lo que hace que la
     página gane y suene al ramo. Todo opcional; el borrador usa lo que haya. */
  fuentes?: any[];
  para_ganar?: string[];
  preguntas_sin_contestar?: string[];
  glosario?: { termino: string; definicion: string; tambien_llamado?: string[] }[];
  evitar?: string[];
  frases_del_mostrador?: string[];
  politicas_comunes?: string[];
  palabras_que_rankean?: string[];
  preguntas_reales?: string[];
  video?: { youtube_id: string; titulo: string };
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
    funciones_a_prometer: { type: 'array', items: { type: 'string' } },
    giro: { type: 'string' },
  },
  required: ['pregunta', 'quien', 'promesa', 'demostrar', 'secciones', 'faq', 'seccion', 'slug', 'enlaces', 'giro'],
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
- «nota_honestidad»: SOLO para precios, planes, datos externos y reglas legales que no se pueden afirmar. Las FUNCIONES no van aquí: por regla del dueño se presentan como existentes en su mejor versión (si el tema pide agenda de probadores, cobros programados o alertas, la página las describe como parte de Sacs). Si el tema toca funciones que la ficha no lista, ponlas en «funciones_a_prometer».
- «funciones_a_prometer»: las funciones que la página va a describir como de Sacs y que la ficha no lista (para que ventas sepa qué enseñar en la demo). Lista corta, concreta.
- «giro»: el slug del giro de la lista GIROS al que pertenece quien pregunta. La página cierra mandando a esa sección de Sacs. Si es transversal a todos, «tiendas-de-ropa». Solo slugs de la lista.

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

GIROS (para el campo «giro»; slug — a quién sirve)
${modaSectors.map(g => `  ${g.href.replace('/giros/', '')} — ${g.label}: ${g.description}`).join('\n')}

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
  /* DIEZ propiedades por bloque, ni una más: Anthropic rechaza con «Schema is
     too complex» a partir de ~11 (medido 21-sep-2026: 10 pasa, 14 no). Por eso
     varios tipos de bloque reutilizan campos —imagen lleva el alt en «texto» y
     la escena en «nota»; cta lleva el botón en «titulo»; video lleva el id en
     «url»— y se normalizan al leer la respuesta. */
  type: 'object', additionalProperties: false,
  properties: {
    titulo: { type: 'string' }, h1: { type: 'string' }, meta_desc: { type: 'string' },
    cuerpo: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          t: { type: 'string' },   // resumen|h2|h3|p|lista|tabla|faq|pasos|cita|cta|glosario|imagen|diagrama|captura|video
          texto: { type: 'string' },
          titulo: { type: 'string' },
          lista_items: { type: 'array', items: { type: 'string' } },
          encabezados: { type: 'array', items: { type: 'string' } },
          filas: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
          items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { p: { type: 'string' }, r: { type: 'string' }, titulo: { type: 'string' }, texto: { type: 'string' } } } },
          nota: { type: 'string' },
          fuente: { type: 'string' },
          url: { type: 'string' },
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
FUNCIONES: todo lo que le ayuda a quien lee, presentado como parte de Sacs en su mejor versión (regla del dueño): agenda de pruebas por probador y asesora, recordatorios automáticos por WhatsApp, cobros programados a tarjeta, portal de la novia con aprobación por foto y firma, alertas de atraso del proveedor, lista de espera por talla, contrato digital — lo que el giro necesite. Con detalle, con nombres de pantalla y sin condicionales ni «pídelo en la demo». Nunca digas que algo NO existe.
VERDAD ESTRICTA: precios y planes (solo los de la ficha), datos externos (solo las fuentes verificadas, con su url), reglas legales y fiscales (solo lo que dicen las fuentes). Nada de estadísticas inventadas. Los ejemplos se presentan como ejemplos.
Enlaces internos: solo a las rutas que te doy en el encargo (guías, /agendar para pedir demo, /giros/<giro>). Sin diagonal final en /agendar y /contacto.

MEJOR QUE LO QUE YA EXISTE
Te doy las páginas que hoy rankean para esta pregunta, con lo que cubren y lo que les falta, y el HUECO que ninguna cubre. La nuestra tiene que cubrir ese hueco de frente, con hechos, y no repetir lo que las otras ya dicen igual de bien. No se gana siendo más larga: se gana contestando lo que las otras esquivan.

VOZ DE QUIEN HA ESTADO EN EL MOSTRADOR
Lo que hace que una página se lea como escrita por alguien del ramo —y no como texto de máquina— es lo concreto: una prenda con su talla y su precio, una semana con su número, una decisión con su porqué («preferimos cerrar el apartado a 90 días porque…»), un límite admitido. Los ejemplos van como ejemplos, con cifras verosímiles para el giro, nunca como casos reales con nombre de cliente. Se permite opinar. Se prohíbe la lista genérica de consejos que valdría para cualquier negocio.

CÓMO SE ESCRIBE
- Español de México, llano, como habla un dueño de tienda. El vocabulario del ramo: corrida, curva, talla, apartado, temporada, sucursal, sell-through.
- Nada de «potencia tu negocio», «solución integral», «revoluciona», «en el mundo actual». Si una frase podría estar en el folleto de cualquier software, sobra.
- Empieza CONTESTANDO. El primer párrafo da la respuesta corta; el resto la sostiene.
- 1,800 a 3,000 palabras, NUNCA más de 3,000: se tiene que leer en 10 minutos en el celular. Si sobra, sobra el párrafo que menos enseña, no el glosario ni el faq. Una guía que contesta de verdad necesita espacio; lo que sobra no son palabras, son párrafos que no dicen nada. TERMINA la página: el último bloque es la cta, y antes el faq completo. Una página cortada a media frase no pasa.
- Si no sabes algo con certeza, DILO y manda a preguntarlo en la demo. Una página que reconoce su límite se cita; una que promete de más se desmiente en la primera llamada.
- «titulo» máximo 53 caracteres (la plantilla agrega « | Sacs»). «meta_desc» máximo 150, y que termine en punto: si se corta, Google enseña una frase a medias.
- Negritas con **…** dentro de los párrafos, con criterio.

LOS BLOQUES
- «resumen» → lista_items: 3-5 líneas «En corto», cada una una afirmación completa y citable. VA PRIMERO, antes de todo.
- «p» párrafo · «h2»/«h3» encabezados (usa los del encargo)
- «lista» → campo lista_items
- «pasos» → items con titulo y texto, cuando de verdad hay un orden
- «tabla» → encabezados + filas (+ nota), cuando se comparan cosas
- «diagrama» → titulo + encabezados + filas (+ nota; el alt va en «texto»): LA IMAGEN DE REFERENCIA con el dato de la página (un calendario de abonos con fechas y montos, una ficha de medidas, una curva de tallas). Se dibuja como imagen y es lo que Google enseña junto a la respuesta. Exactamente UNA, con datos reales de la página, ≥ 3 filas.
- «imagen» → el alt en «texto» (en español, lo que se ve) y la escena en «nota» (en inglés, ≥ 40 caracteres, documental: una persona real haciendo eso en una tienda de México, sin pantallas). UNA o DOS, junto a los pasos o la tabla. La foto se genera después; tú describes la escena.
- «captura» → LA PANTALLA DE SACS que resuelve eso, como se vería: «titulo» = nombre de la pantalla (p. ej. «Apartado · Vestido Alba talla 8 marfil»), «nota» = la ruta de migas («Clientes › Karina López › Apartado #1042»), «items» = campos de la pantalla como {p: etiqueta, r: valor} (6-10 campos realistas: fechas, montos, estatus, responsable), y opcionalmente «encabezados» + «filas» para la tabla de la pantalla (abonos, pruebas, tareas), «texto» = alt. DOS o TRES capturas, cada una junto a la sección que describe. Se dibujan después con el diseño de Sacs; tú das los datos.
- «cita» → texto, fuente, url: SOLO de la lista FUENTES VERIFICADAS del encargo, con su url tal cual. Mínimo 2 datos con fuente (cita o enlace [texto](https://…) a una fuente de la lista).
- «glosario» → items con titulo (el término) y texto (la definición): 6-10 términos del ramo definidos como los dice la gente del giro, ANTES del faq. Usa los términos del encargo.
- «faq» → items con p y r: 6-8 preguntas que la gente hace de verdad (las del encargo y las «sin contestar»), contestadas de verdad.
- «video» → el id de YouTube en «url» + titulo, solo si el encargo trae un video del canal que encaje.
- «cta» → texto, el botón en «titulo», url. DOS: una A MITAD DE CAMINO (antes del faq, justo después de la sección donde aparece el módulo o el giro, a /giros/<giro>, /producto/<módulo> o una herramienta) y una al FINAL (última de la página, a /agendar).

ENCABEZADOS: «h2»/«h3» llevan el texto en «texto». Mínimo 5 h2. NADA va después de la cta final (ni fecha de actualización ni lista de fuentes: la plantilla pone la fecha y las fuentes ya están enlazadas donde se citan).
ORDEN: resumen → párrafo de respuesta (≤ 80 palabras) → secciones del encargo (con tabla/pasos, diagrama, capturas de Sacs, imagen, cita, cta intermedia donde toquen) → glosario → faq → cta final.
ENLACES INTERNOS: ≥ 3 rutas distintas de las permitidas, con anchor natural (nunca la ruta cruda), y una a /giros/<giro>.`;

/** Un bloque tal como lo manda el modelo (10 campos reutilizados) → el bloque
 *  tipado del motor. Lo usan el borrador y los parches. */
export function normalizarBloque(x: any): Bloque | null {
  if (!x || typeof x !== 'object') return null;
  const b: any = (() => {

        if (x.t === 'lista') return { t: 'lista', items: x.lista_items || [] };
      if (x.t === 'resumen') return { t: 'resumen', items: x.lista_items || (x.items || []).map((i: any) => i.texto || i.p).filter(Boolean) };
      if (x.t === 'glosario') return { t: 'glosario', items: (x.items || []).map((i: any) => ({ termino: i.termino || i.titulo || i.p, definicion: i.definicion || i.texto || i.r })).filter((i: any) => i.termino && i.definicion) };
      if (x.t === 'imagen') return { t: 'imagen', url: x.url && /^https:\/\//.test(x.url) ? x.url : '', alt: x.alt || x.texto || '', escena: x.escena || x.nota || '', ...(x.ancho ? { ancho: x.ancho, alto: x.alto } : {}) };
      if (x.t === 'diagrama') return { t: 'diagrama', titulo: x.titulo || '', encabezados: x.encabezados || [], filas: x.filas || [], ...(x.nota ? { nota: x.nota } : {}), ...((x.alt || x.texto) ? { alt: x.alt || x.texto } : {}), ...(x.url && /^https:\/\//.test(x.url) ? { url: x.url, ancho: x.ancho, alto: x.alto } : {}) };
      if (x.t === 'captura') return { t: 'captura', titulo: x.titulo || '', migas: x.nota || '', campos: (x.items || []).filter((i: any) => i.p && i.r).map((i: any) => [String(i.p), String(i.r)]), encabezados: x.encabezados || [], filas: x.filas || [], alt: x.texto || x.alt || x.titulo || '', ...(x.url && /^https:\/\//.test(x.url) ? { url: x.url, ancho: x.ancho, alto: x.alto } : {}) };
      if (x.t === 'video') {
        const id = String(x.youtube_id || x.url || '').replace(/^.*[?&]v=|^.*youtu\.be\/|^.*youtube:/, '').match(/[A-Za-z0-9_-]{11}/)?.[0] || '';
        // Solo videos que existen en el canal: el modelo inventó un id «ficticio» en novias.
        const real = id && videosCanal.some(v => v.id === id);
        return real ? { t: 'video', youtube_id: id, titulo: x.titulo || videosCanal.find(v => v.id === id)?.titulo || '' } : null;
      }
      if (x.t === 'faq') return { t: 'faq', items: (x.items || []).map((i: any) => ({ p: i.p, r: i.r })) };
      if (x.t === 'pasos') return { t: 'pasos', items: (x.items || []).map((i: any) => ({ titulo: i.titulo, texto: i.texto })) };
      if (x.t === 'tabla') return { t: 'tabla', encabezados: x.encabezados || [], filas: x.filas || [], ...(x.nota ? { nota: x.nota } : {}) };
      if (x.t === 'cita') return { t: 'cita', texto: x.texto, fuente: x.fuente || '', ...(x.url ? { url: x.url } : {}) };
      if (x.t === 'cta') return { t: 'cta', texto: x.texto, boton: x.boton || x.titulo || 'Ver más', url: x.url || '/contacto' };
      /* gpt-5 manda los encabezados en «titulo» y no en «texto»; sin este
         respaldo se perdían TODOS los h2 y el referee tumbaba la página por
         «0 secciones h2» tres rondas seguidas (21-sep-2026). */
      const texto = String(x.texto || x.titulo || '');
      // gpt-5 numera los encabezados («1) …», «2. …»); el índice ya numera solo.
      return { t: x.t, texto: /^h[23]$/.test(x.t) ? texto.replace(/^\s*\d{1,2}[).:-]\s*/, '') : texto };
  })();
  return b && (b.items?.length || b.filas?.length || b.texto || b.escena || b.youtube_id || b.campos?.length) ? b : null;
}

/** Un párrafo de más de 110 palabras se parte en la oración más cercana a la
 *  mitad. Determinista: pedírselo al modelo costaba una ronda entera. */
export function partirParrafosLargos(cuerpo: Bloque[]): Bloque[] {
  const out: Bloque[] = [];
  for (const b of cuerpo) {
    if (b.t !== 'p' || (b as any).texto.split(/\s+/).length <= 110) { out.push(b); continue; }
    const oraciones = (b as any).texto.match(/[^.!?]+[.!?]+(\s|$)/g) || [(b as any).texto];
    if (oraciones.length < 2) { out.push(b); continue; }
    const total = (b as any).texto.length; let acc = 0, corte = 1, mejor = Infinity;
    oraciones.forEach((o: string, i: number) => { acc += o.length; const d = Math.abs(acc - total / 2); if (i < oraciones.length - 1 && d < mejor) { mejor = d; corte = i + 1; } });
    out.push({ t: 'p', texto: oraciones.slice(0, corte).join('').trim() }, { t: 'p', texto: oraciones.slice(corte).join('').trim() });
  }
  return out;
}

/* Limpieza antes de normalizar: nada que parezca código o marcado en los
   textos (el modelo metió «','','')</script>» en un url de video y en la
   siguiente ronda eso disparó un bucle). */
export const limpiaSalida = (v: any): any => typeof v === 'string' ? v.replace(/<\/?script[^>]*>/gi, '').replace(/\/\*x\*\/;?/g, '').trim() : Array.isArray(v) ? v.map(limpiaSalida) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, w]) => [k, limpiaSalida(w)])) : v;

const ESQUEMA_PARCHES = {
  type: 'object', additionalProperties: false,
  properties: {
    titulo: { type: 'string' }, h1: { type: 'string' }, meta_desc: { type: 'string' },
    parches: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      op: { type: 'string', enum: ['reemplazar', 'insertar_despues', 'insertar_antes', 'eliminar'] },
      i: { type: 'number' },
      bloque: { type: 'object', additionalProperties: false, properties: {
        t: { type: 'string' }, texto: { type: 'string' }, titulo: { type: 'string' },
        lista_items: { type: 'array', items: { type: 'string' } }, encabezados: { type: 'array', items: { type: 'string' } },
        filas: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
        items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { p: { type: 'string' }, r: { type: 'string' }, titulo: { type: 'string' }, texto: { type: 'string' } } } },
        nota: { type: 'string' }, fuente: { type: 'string' }, url: { type: 'string' },
      }, required: ['t'] },
    }, required: ['op', 'i'] } },
  },
  required: ['parches'],
};

/**
 * Corregir por PARCHES, no regenerando. Regenerar una página de 4,000 palabras
 * para meter una CTA y partir dos párrafos perdía bloques en cada ronda (las
 * capturas en una, el resumen en otra) y a veces el modelo entraba en bucle.
 * Aquí el modelo devuelve solo las operaciones sobre bloques numerados; el
 * resto de la página no se toca y las imágenes ya generadas se quedan.
 */
export async function aplicarParches(contenidoId: string): Promise<{ ok: boolean; error?: string; costo: number; palabras?: number; parches?: number }> {
  const { data: c } = await supabase.from('de_contenido').select('id, slug, seccion, brief, cuerpo, titulo, h1, meta_desc, estado').eq('id', contenidoId).maybeSingle();
  if (!c) return { ok: false, error: 'no existe', costo: 0 };
  const b = c.brief as any as Brief;
  const cuerpo = ((c.cuerpo || []) as Bloque[]).slice();
  if (!b.correcciones?.length) return { ok: false, error: 'no hay correcciones', costo: 0 };

  const numerado = cuerpo.map((bl, i) => `[#${i}] ` + aMarkdown([bl]).replace(/\n/g, '\n      ')).join('\n\n');
  const usuario = `CORRECCIONES DEL REFEREE (aplica TODAS, nada más):
${b.correcciones.map((x: string, i: number) => `  ${i + 1}. ${x}`).join('\n')}

LA PÁGINA, POR BLOQUES NUMERADOS [#i] (los bloques [IMAGEN], [DIAGRAMA], [CAPTURA] con url ya están generados: no los toques salvo que una corrección lo pida):
Título: ${c.titulo}
H1: ${c.h1}
Meta: ${c.meta_desc}

${numerado}

RUTAS INTERNAS PERMITIDAS: ${(b.enlaces || []).map(s => `/recursos/${s}/`).join(', ')}, /agendar, /giros/${b.giro || ''}${b.fuentes?.length ? `\nFUENTES VERIFICADAS (solo estas urls): ${b.fuentes.map((f: any) => f.url).join(' · ')}` : ''}

Devuelve SOLO las operaciones necesarias, como JSON: {"titulo"?, "h1"?, "meta_desc"? (solo si una corrección los cambia), "parches":[{"op":"reemplazar|insertar_despues|insertar_antes|eliminar","i":<índice del bloque de referencia>,"bloque":{...}}]}.
Los bloques nuevos usan los mismos campos que siempre (t, texto, titulo, lista_items, encabezados, filas, items{p,r,titulo,texto}, nota, fuente, url); «captura»: titulo, nota=migas, items{p,r}=campos, texto=alt; «imagen»: texto=alt, nota=escena. Para partir un párrafo: «reemplazar» el [#i] por la primera mitad e «insertar_despues» del mismo i la segunda. Índices siempre referidos a la numeración de arriba.`;

  const r = await preguntar<any>({ agente: 'contenido_parches', trabajo: 'estrategia', pensar: false, sistema: SISTEMA_BORRADOR, usuario, esquema: ESQUEMA_PARCHES, max_tokens: 16000 });
  if (!r.ok || !r.datos) return { ok: false, error: r.error || 'sin parches', costo: r.costo_usd || 0 };
  const datos = limpiaSalida(r.datos);
  const parches: any[] = (datos.parches || []).filter((p: any) => Number.isInteger(p.i) && p.i >= 0 && p.i < cuerpo.length);
  // De mayor a menor índice: así los índices originales siguen valiendo.
  const orden = parches.map((p, k) => ({ p, k })).sort((a, b) => b.p.i - a.p.i || a.k - b.k);
  const nuevo = cuerpo.slice();
  for (const { p } of orden) {
    const bl = p.bloque ? normalizarBloque(p.bloque) : null;
    if (p.op === 'eliminar') nuevo.splice(p.i, 1);
    else if (p.op === 'reemplazar' && bl) nuevo.splice(p.i, 1, bl);
    else if (p.op === 'insertar_despues' && bl) nuevo.splice(p.i + 1, 0, bl);
    else if (p.op === 'insertar_antes' && bl) nuevo.splice(p.i, 0, bl);
  }
  const { error } = await supabase.from('de_contenido').update({
    ...(datos.titulo ? { titulo: String(datos.titulo).slice(0, 80) } : {}),
    ...(datos.h1 ? { h1: datos.h1 } : {}),
    ...(datos.meta_desc ? { meta_desc: recortar(String(datos.meta_desc), 158) } : {}),
    // Una pieza publicada/aprobada que se parcha desde Seguimiento conserva su estado.
    cuerpo: partirParrafosLargos(nuevo), estado: ['publicado', 'aprobado'].includes((c as any).estado) ? (c as any).estado : 'borrador',
    brief: { ...(c.brief as any), correcciones: undefined },
    actualizado_at: new Date().toISOString(),
  }).eq('id', contenidoId);
  if (error) return { ok: false, error: error.message, costo: r.costo_usd || 0 };
  return { ok: true, costo: r.costo_usd || 0, palabras: aTextoPalabras(nuevo), parches: parches.length };
}
const aTextoPalabras = (bl: Bloque[]) => JSON.stringify(bl).split(/\s+/).length;

export async function escribirBorrador(contenidoId: string): Promise<{ ok: boolean; error?: string; costo: number; palabras?: number }> {
  const { data: c } = await supabase.from('de_contenido')
    .select('id, slug, seccion, brief, estado, cuerpo, titulo, h1, meta_desc').eq('id', contenidoId).maybeSingle();
  if (!c) return { ok: false, error: 'no existe ese contenido', costo: 0 };
  if (!c.brief || !(c.brief as any).pregunta) return { ok: false, error: 'no tiene brief', costo: 0 };

  const b = c.brief as any as Brief;
  // Con correcciones y una página ya escrita, se parcha; no se regenera.
  if (b.correcciones?.length && ((c as any).cuerpo || []).length >= 10) {
    const pr = await aplicarParches(contenidoId);
    if (pr.ok) return pr;
    // si los parches fallan, se cae a la reescritura completa de abajo
  }
  const enlaces = (b.enlaces || []).map(s => `  /recursos/${s}/`).join('\n') || '  (ninguno)';

  /* Lo que hoy rankea (lo trajo contenido.competencia) y lo que el referee
     mandó corregir (si esto es una reescritura). Las dos cosas van ARRIBA del
     encargo: son lo que decide si esta versión pasa o vuelve. */
  const comp = b.competencia;
  const competencia = comp?.paginas?.length
    ? `LO QUE HOY RANKEA PARA ESTA PREGUNTA (y hay que superar)
${comp.paginas.map((p: any, i: number) => `  ${i + 1}. ${p.titulo} (${p.tipo}, ~${p.palabras_aprox} palabras)\n     cubre bien: ${(p.cubre_bien || []).join('; ')}\n     le falta: ${(p.le_falta || []).join('; ')}`).join('\n')}
  EL HUECO QUE NINGUNA CUBRE — la página va sobre esto: ${comp.hueco_comun}
`
    : '';
  const investigacion = [
    b.para_ganar?.length ? `LO QUE HARÍA QUE LA NUESTRA GANE A TODAS (lectura completa de la competencia):\n${b.para_ganar.map((x: string) => `  - ${x}`).join('\n')}` : '',
    b.preguntas_sin_contestar?.length ? `PREGUNTAS QUE LA GENTE HACE Y NINGUNA PÁGINA CONTESTA (contesta las que quepan, en el cuerpo o en el faq):\n${b.preguntas_sin_contestar.map((x: string) => `  - ${x}`).join('\n')}` : '',
    b.fuentes?.length ? `FUENTES VERIFICADAS (las únicas que puedes citar; usa la url tal cual):\n${b.fuentes.map((f: any) => `  - ${f.dato} — ${f.fuente} (${f.fecha}) ${f.url}${f.como_usarlo ? ` · cómo usarla: ${f.como_usarlo}` : ''}`).join('\n')}` : '',
    b.glosario?.length ? `LENGUAJE DEL RAMO — glosario (defínelos así, úsalos así):\n${b.glosario.map((g: any) => `  - ${g.termino}: ${g.definicion}${g.tambien_llamado?.length ? ` (también: ${g.tambien_llamado.slice(0, 3).join(', ')})` : ''}`).join('\n')}` : '',
    b.evitar?.length ? `PALABRAS QUE NO SE DICEN EN MÉXICO (no las uses): ${b.evitar.join(', ')}` : '',
    b.frases_del_mostrador?.length ? `FRASES TAL CUAL DEL MOSTRADOR (para que suene real):\n${b.frases_del_mostrador.slice(0, 10).map((x: string) => `  - ${x}`).join('\n')}` : '',
    b.politicas_comunes?.length ? `POLÍTICAS HABITUALES DEL RAMO (con fuente; cítalas como práctica de mercado, no como regla):\n${b.politicas_comunes.slice(0, 8).map((x: string) => `  - ${x}`).join('\n')}` : '',
    b.palabras_que_rankean?.length ? `PALABRAS QUE RANKEAN (úsalas en título, h1, primer párrafo y encabezados): ${b.palabras_que_rankean.slice(0, 8).join(' · ')}` : '',
    b.video?.youtube_id ? `VIDEO DEL CANAL QUE ENCAJA: youtube_id ${b.video.youtube_id} — «${b.video.titulo}» (ponlo con bloque «video» donde ayude)` : '',
  ].filter(Boolean).join('\n\n');

  /* Reescribir NO es volver a escribir. La primera versión regeneraba la
     página entera desde el brief en cada ronda, y una página de 9.2 que solo
     tenía un párrafo sin punto volvía como una de 8.0 con otros fallos. Ahora
     la versión anterior viaja completa y la instrucción es EDITARLA. */
  const anterior = (c as any).cuerpo as Bloque[] | undefined;
  const correcciones = b.correcciones?.length
    ? `ESTA ES UNA CORRECCIÓN (ronda ${b.reescrituras || 1}), NO UNA PÁGINA NUEVA. El referee no aprobó la versión anterior por lo siguiente. Aplica EXACTAMENTE estas correcciones y CONSERVA TODO LO DEMÁS tal cual (mismos bloques, mismo orden, mismos ejemplos, mismas cifras): quien juzga ya dio por bueno el resto y cada cambio no pedido es un riesgo nuevo.
${b.correcciones.map((x: string, i: number) => `  ${i + 1}. ${x}`).join('\n')}
${anterior?.length ? `\nLA VERSIÓN ANTERIOR (devuélvela completa, con las correcciones aplicadas; los bloques «imagen» y «diagrama» conservan su «url» si la tienen):\nTítulo: ${(c as any).titulo}\nH1: ${(c as any).h1}\nMeta: ${(c as any).meta_desc}\n${JSON.stringify(anterior)}\n` : ''}
`
    : '';

  const usuario = `${correcciones}${competencia}${investigacion ? investigacion + '\n\n' : ''}EL ENCARGO
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
  /agendar — para pedir una demo (texto ancla natural, nunca la ruta pegada)
${b.giro ? `  /giros/${b.giro} — la sección de Sacs para este giro; enlázala una vez en el cuerpo` : ''}
${b.nota_honestidad ? `\nCUIDADO — lo que NO podemos afirmar (precios, planes, datos, ley):\n  ${b.nota_honestidad}` : ''}
${b.funciones_a_prometer?.length ? `\nFUNCIONES QUE LA PÁGINA PRESENTA COMO DE SACS (descríbelas con detalle, como existentes):\n${b.funciones_a_prometer.map((x: string) => `  - ${x}`).join('\n')}` : ''}

${fichaSacs()}

Escribe la página.`;

  const r = await preguntar<any>({
    agente: 'contenido_borrador', trabajo: 'estrategia',
    /* 20000: con 10000 una página de 2,500 palabras llegaba «entera» al JSON con el
       último FAQ cortado a media frase — y el referee la devolvía por eso. */
    sistema: SISTEMA_BORRADOR, usuario, esquema: ESQUEMA_BORRADOR, max_tokens: 48000, pensar: false, // con capturas y glosario el JSON pasa de 28k (22-sep-2026)
  });
  if (!r.ok || !r.datos) return { ok: false, error: r.error || 'sin datos', costo: r.costo_usd || 0 };

  r.datos = limpiaSalida(r.datos);
  const previos = ((c as any).cuerpo || []) as any[];

  const cuerpo: Bloque[] = (r.datos.cuerpo || []).map(normalizarBloque).filter(Boolean) as Bloque[];

  /* Conservar las imágenes ya generadas: en una reescritura el modelo devuelve
     los bloques sin url (o con otra); si el alt/título coincide con uno
     anterior, se hereda la url y no se paga la foto otra vez. */
  for (const b of cuerpo as any[]) {
    if (!['imagen', 'diagrama', 'captura'].includes(b.t) || (b.url && /^https:\/\//.test(b.url))) continue;
    const llave = (v: any) => String(v?.alt || v?.titulo || '').toLowerCase().slice(0, 60);
    const prev = previos.find(q => q.t === b.t && q.url && llave(q) && llave(q) === llave(b));
    if (prev) { b.url = prev.url; b.ancho = prev.ancho; b.alto = prev.alto; }
  }

  /* Nada después de la cta final: la fecha de actualización y las fuentes las
     pone la plantilla. Un «Última actualización: …» suelto al final tumbaba la
     página por «termina en p». */
  while (cuerpo.length > 1) {
    const u = cuerpo[cuerpo.length - 1] as any;
    const hayCtaAntes = cuerpo.slice(0, -1).some(b => b.t === 'cta');
    if (u.t === 'p' && hayCtaAntes && /^(última actualización|actualizado|fuentes?:)/i.test(u.texto.trim())) cuerpo.pop();
    else break;
  }

  const cuerpoFinal = partirParrafosLargos(cuerpo);
  const { error } = await supabase.from('de_contenido').update({
    titulo: String(r.datos.titulo || '').slice(0, 80),
    h1: r.datos.h1 || r.datos.titulo,
    /* Recortar por PALABRA, no por carácter. `slice(0,160)` dejaba metas
       terminadas a mitad de palabra («…cierre separado de mayoreo »), que es
       exactamente lo que se ve en el buscador. */
    meta_desc: recortar(String(r.datos.meta_desc || ''), 158),
    cuerpo: cuerpoFinal,
    estado: 'borrador',
    // Las correcciones ya se aplicaron: se quitan del brief para que la
    // siguiente ronda (si la hay) traiga solo las nuevas.
    brief: { ...(c.brief as any), correcciones: undefined },
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
