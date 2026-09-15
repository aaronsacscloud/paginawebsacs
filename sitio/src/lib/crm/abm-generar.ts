// Escribir la cadencia de UNA cuenta: el expediente, el guion del giro y la IA.
//
// Vivía dentro de POST /api/crm/abm/cadencias (accion 'generar'), y ahí solo
// podía dispararlo una persona desde la ficha. El goteo —envíos progresivos,
// diez cuentas nuevas por día— necesita escribir la misma cadencia sin sesión
// y desde el cron, así que la redacción se mueve aquí y la ruta la llama.
// Las reglas son las mismas en los dos caminos; el único parámetro nuevo es
// quién firma la nota de la bitácora y si el primer correo sale hoy.
import { supabase } from '../supabase';
import { anthropic, MODELS } from '../ai/client';
import { limpiar, apuntar, GIROS, variablesDe, rellenar, nombrePila } from './abm.lib';
import { paisDe, regionDe, asuntoPais, type Region } from './abm-paises';

/**
 * Producto sin talla: joyería, bolsas, sombreros, lentes, accesorios.
 * Si el subgiro también nombra ropa o calzado («trajes y accesorios de
 * caballero», «vestidos de fiesta y accesorios»), manda la ropa: el pedido
 * de esa marca se levanta por talla aunque venda accesorios al lado. Salió
 * del primer lote de Intermoda (14-sep-2026), donde la sola palabra
 * «accesorios» iba a dejar sin tallas a una marca de trajes.
 */
const SIN_TALLA = /JOYER|BISUTER|BOLSA|CARTERA|MOCHILA|PIEL\b|MARROQUIN|SOMBRER|GORRA|ACCESOR|CINTUR|CINTOS|LENTES|RELOJ|MASCADA|PA[ÑN]UEL|BUFAND|FLORES|BILLETER|MONEDER|VELOS?\b/i;
const CON_TALLA = /ROPA|VESTID|TRAJE|JEANS|PANTAL|CAMIS|BLUS|CHAMARR|SUDADER|PLAYER|CALZADO|ZAPAT|TENIS|BOTAS?\b|UNIFORM|LENCER|BIKINI|LEGGING|FALDA|SACOS?\b|ROPON|ABRIGO|SU[ÉE]TER|TEJIDO DE PUNTO|PRENDA|MODA INFANTIL|CEREMONIAS/i;
export const sinTalla = (subgiro?: string | null) => {
  const s = String(subgiro || '');
  return SIN_TALLA.test(s) && !CON_TALLA.test(s);
};

/** La cadencia activa del giro y la ruta para una región, con caída a México. */
export async function cadenciaDe(giro: string, ruta: string, region: Region): Promise<{ data: { id: string; nombre: string; region: string } | null }> {
  const q = (r: string) => supabase.from('abm_cadencias').select('id, nombre, region')
    .eq('giro', giro).eq('ruta', ruta).eq('activa', true).eq('region', r).maybeSingle();
  const { data } = await q(region);
  if (data || region === 'mexico') return { data: data as any };
  return (await q('mexico')) as any;
}

/** Lo que sabemos de la cuenta, resumido para que la IA no invente nada. */
export function expediente(c: any, canales: any[], personas: any[], senales: any[]) {
  const l: string[] = [];
  l.push(`Negocio: ${c.nombre}`);
  l.push(`Giro: ${GIROS[c.giro] || c.giro}${c.subgiro ? ` (${c.subgiro})` : ''}`);
  l.push(`Ciudad: ${c.ciudad || 'México'} · País: ${c.pais} · Moneda: ${c.moneda}`);
  // Segmentación por país (14-sep-2026): la IA tiene que saber en qué
  // español escribe y cómo le dicen a la fiesta de quince en ese país. Se
  // le da como dato del expediente, tajante, no como pista en el objetivo.
  const pp = paisDe(c.pais);
  if (pp.region === 'mexico') l.push('Registro: español de México. El negocio está en México: cuando el texto base diga «en todo México» o «XV años», déjalo.');
  else l.push(`Registro: español neutro de Latinoamérica, trato de ${pp.trato}, SIN mexicanismos (nada de «checar», «platicar», «ahorita», «apartado», «padrísimo», «XV años»). En ${pp.nombre} a la fiesta de quince se le dice «${pp.xv}» y la moneda es ${pp.moneda.toUpperCase()}: no escribas cifras en pesos mexicanos como si fueran locales.`);
  if (c.sucursales) l.push(`Sucursales: ${c.sucursales} (${c.sucursales_confianza})`);
  else l.push('Sucursales: no verificadas');
  if (c.google_rating) l.push(`Google: ${c.google_rating}${c.google_resenas ? ` con ${c.google_resenas} reseñas` : ''}`);
  if (c.plataforma_web) l.push(`Su tienda en línea corre en ${c.plataforma_web}`);
  if (c.sitio_http === 0 || Number(c.sitio_http) >= 400) l.push('Su sitio NO responde ahora mismo');
  if (c.sitio_carrito === false) l.push('No vende en línea (su sitio no tiene carrito)');
  if (c.ig_seguidores) l.push(`Instagram: ${c.ig_seguidores} seguidores`);
  if (c.senal_expansion) l.push(`Señal de que crece: ${c.senal_expansion}`);
  if (c.ultima_publicacion) l.push(`Última publicación: ${c.ultima_publicacion}`);
  if (c.contexto) l.push(`Contexto: ${c.contexto}`);
  // Las marcas de feria mezclan ropa con joyería, bolsas y sombreros. El guion
  // base habla de tallas; a quien vende producto sin talla hay que decirle
  // «modelo y color». Se decide AQUÍ, con el subgiro, y se le dice a la IA de
  // forma tajante en los dos sentidos: cuando la pista iba en el objetivo de
  // cada correo como «si vende joyería…», la IA la aplicó también a una
  // marca de ropa y le quitó las tallas a todo el guion.
  if (c.giro === 'marcas') l.push(sinTalla(c.subgiro)
    ? 'Producto: SIN TALLA (joyería, bolsas, sombreros o accesorios). Habla de modelo y color; nunca escribas «talla», «curva de tallas» ni «mediana».'
    : 'Producto: ROPA O CALZADO, con tallas. Conserva las tallas y colores tal como vienen en el texto base.');
  if (c.nota) l.push(`Nota de la investigación: ${c.nota}`);
  const p = personas[0];
  /* SOLO EL NOMBRE DE PILA, y a propósito. Si aquí entra el nombre completo,
     la IA lo escribe: con "Juan Carlos Medina Fernández" en el expediente salió
     un correo que abría "Hola Juan Carlos". Saludar con nombre y apellido suena
     a base de datos, que es justo lo que no queremos parecer. El apellido no le
     sirve a la IA para redactar, así que ni se lo pasamos — una regla que el
     modelo puede desobedecer es peor que un dato que no tiene.

     nombrePila() respeta los compuestos: "Juan Carlos Medina" se queda en
     "Juan Carlos" —a Juan Carlos nadie le dice Juan— pero "Cielo Inzunza" se
     corta a "Cielo". */
  const pila = nombrePila(p?.nombre);
  if (p && pila) l.push(`Persona que decide (nombre de pila, es el ÚNICO que puedes escribir): ${pila}${p.cargo ? `, ${p.cargo}` : ''}`);
  const cs = canales.map(x => x.tipo).join(', ');
  l.push(`Canales disponibles: ${cs || 'ninguno verificado'}`);
  // Las quejas de sus clientes van aparte y marcadas: son lo mejor que
  // tenemos para abrir, porque el problema lo dice su comprador, no nosotros.
  const quejas = senales.filter((s: any) => s.tipo === 'resena_mala');
  for (const s of quejas.slice(0, 3)) l.push(`QUEJA DE UN CLIENTE SUYO en Google: "${s.detalle}"`);
  for (const s of senales.filter((s: any) => s.tipo !== 'resena_mala').slice(0, 3)) l.push(`Señal (${s.fecha || 'del estudio'}): ${s.detalle}`);
  return l.join('\n');
}

export const REGLAS = `Reglas de escritura, sin excepción:
- El español que dice el expediente (de México, o neutro de Latinoamérica), tono de persona. Nada de "solución integral", "potenciar", "revolucionar", "líder".
- TODOS los correos van en TEXTO PLANO, sin imágenes. Nunca HTML.
- El correo 1 es el de PRESENTACIÓN y es el único largo (hasta 200 palabras).
  Su trabajo es que el prospecto entienda POR QUÉ le llega: no se registró en
  ningún lado, lo encontramos nosotros investigando su giro. Respeta esa
  explicación tal como viene en el texto base — no la suavices ni la quites, y
  JAMÁS escribas que se registró, pidió información o dejó sus datos: no pasó.
  Este correo SÍ lleva las dos ligas del texto base (agendar y WhatsApp);
  déjalas completas y no inventes otras.
- Del correo 2 en adelante: máximo 90 palabras y SIN enlaces.
- Cada correo AVANZA: no repetir el anterior con otras palabras.
- Una sola pregunta al final, concreta.
- Al saludar usa SOLO el nombre de pila: "Hola Cielo", nunca "Hola Cielo Inzunza".
  Nombre y apellido suena a base de datos. Si no hay nombre, no saludes por
  nombre: "Buen día." y a lo que sigue.
- Asunto de 3 a 6 palabras, en minúscula, sin signos de admiración ni emoji.
- NO INVENTES NADA. Solo puedes usar hechos del expediente. Si un dato no está, no escribas esa frase.
- Prohibido inventar cifras de resultados. El único caso que puedes citar: en un cliente nuestro,
  cadena de moda, encontramos 1.2 millones de pesos mexicanos (unos 60 mil dólares) mal repartidos entre su centro de distribución
  y sus tiendas, con apenas 50 claves de producto.
- No prometas llamadas ni juntas largas: se ofrece un diagnóstico de 15 minutos con sus datos.
- Si el expediente trae una QUEJA DE UN CLIENTE SUYO, úsala en el primer correo, pero
  CON CUIDADO: se alude a lo que pasó, no se restriega ni se cita entre comillas. "Vi que a
  alguien le pasó que…" suena a reproche; "cuando hay varias tiendas, lo típico es que se
  venda algo que ya no está" reconoce el problema sin humillar a nadie. Nunca digas que
  leíste sus reseñas malas.`;

export const CORREO_OK = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

export type Generado =
  | { ok: true; correos: number; whatsapps: number; con_ia: boolean; ia_error: string | null; toque_ids: string[]; destino: string }
  | { ok: false; error: string; status: number };

export type OpcionesGenerar = {
  /** Quién firma la nota de la bitácora («Andrea generó…», «El goteo escribió…»). */
  autor: string;
  con_ia?: boolean;
  /** El goteo que la pidió: se apunta en cada toque para poder contarlos. */
  goteo_id?: string | null;
  /** true = el primer correo se programa para AHORA y los demás cuentan desde
   *  hoy. Desde la ficha el correo 1 va al día siguiente (hay tiempo de leerlo);
   *  en el goteo la lectura ya pasó al encender la opción y el lote de hoy es
   *  el que sale hoy. */
  arranca_hoy?: boolean;
};

/** Escribe y guarda (como borrador) la cadencia de correo de una cuenta. */
export async function generarCadencia(cuenta_id: string, op: OpcionesGenerar): Promise<Generado> {
  const { data: c } = await supabase.from('abm_cuentas').select('*').eq('id', cuenta_id).maybeSingle();
  if (!c) return { ok: false, error: 'no existe', status: 404 };
  if (c.etapa === 'no_contactar') return { ok: false, error: 'esta cuenta pidió no ser contactada', status: 409 };
  // A un cliente que ya nos paga no se le manda correo en frío.
  if (c.ya_es_cliente) return { ok: false, error: `ya es cliente nuestro (${c.ya_es_cliente}): no entra a prospección en frío`, status: 409 };

  const [{ data: canales }, { data: personas }, { data: senales }] = await Promise.all([
    supabase.from('abm_canales').select('*').eq('cuenta_id', c.id).neq('estado', 'opt_out'),
    supabase.from('abm_personas').select('*').eq('cuenta_id', c.id).order('confirmado', { ascending: false }),
    supabase.from('abm_senales').select('*').eq('cuenta_id', c.id).order('fecha', { ascending: false }).limit(5),
  ]);
  // Solo una dirección con forma de dirección: seis truncadas sin dominio
  // bastaban para disparar el disyuntor de rebotes el primer día.
  const correo = (canales || []).find(x => x.tipo.startsWith('email') && x.estado !== 'invalido' && x.estado !== 'rebote' && CORREO_OK.test(String(x.valor || '')));
  if (!correo) return { ok: false, error: 'esta cuenta no tiene correo verificado: su cadencia empieza por otro canal', status: 409 };

  // Nadie recibe dos veces: si ya hay toques vivos, no se genera otra cadencia.
  const { count: vivos } = await supabase.from('abm_toques').select('id', { count: 'exact', head: true })
    .eq('cuenta_id', c.id).in('estado', ['borrador', 'aprobado', 'programado', 'enviando']);
  if (vivos) return { ok: false, error: `ya tiene ${vivos} correos en la fila; cancélalos antes de generar otra cadencia`, status: 409 };

  const ruta = c.ruta || 'demo';
  /* La cadencia y las plantillas son de la REGIÓN de la cuenta (manual
     §13.3): México tiene su guion, Latam el suyo en español neutro. Si la
     región todavía no tiene guion para ese giro, se cae al de México para
     que ninguna cuenta se quede sin cadencia —y el expediente ya le dijo a
     la IA en qué español reescribirlo—. */
  const region = regionDe(c.pais);
  const { data: base } = await cadenciaDe(c.giro, ruta, region);
  const { data: pasosTodos } = base
    ? await supabase.from('abm_pasos').select('id, dia, orden, canal, nota, plantilla_id').eq('cadencia_id', base.id).order('dia')
    : { data: [] as any[] };
  // Los días de los correos se leen por posición: si entran los pasos de
  // WhatsApp a la misma lista, el correo 2 hereda el día del WhatsApp 1.
  const pasos = (pasosTodos || []).filter((x: any) => x.canal === 'email');
  const pasosWa = (pasosTodos || []).filter((x: any) => x.canal === 'whatsapp');
  const { data: plantillas } = await supabase.from('abm_plantillas')
    .select('orden, asunto, cuerpo, objetivo, imagen, boton_texto, boton_url').eq('giro', c.giro).eq('ruta', ruta).eq('canal', 'email').eq('activa', true)
    .eq('region', (base as any)?.region || 'mexico').order('orden');

  const guion = (plantillas || []).map((p: any, i: number) =>
    `Correo ${i + 1} (día ${(pasos || [])[i]?.dia ?? [1, 3, 7, 11, 16, 22, 30][i] ?? 1}) — objetivo: ${p.objetivo || 'avanzar'}\nAsunto base: ${p.asunto}\nTexto base:\n${p.cuerpo}`
  ).join('\n\n---\n\n');
  if (!guion) return { ok: false, error: `todavía no hay plantillas escritas para el giro ${c.giro}`, status: 409 };

  const prompt = `Eres el redactor de correo frío de Sacscloud (sistema mexicano de inventario y punto de venta para negocios de moda).
Te doy el EXPEDIENTE de un prospecto real y el GUION de la cadencia de su giro. Tu trabajo es adaptar cada correo
del guion a ESTE negocio, usando solo lo que dice el expediente.

EXPEDIENTE
${expediente(c, canales || [], personas || [], senales || [])}

GUION DE LA CADENCIA (${GIROS[c.giro] || c.giro}, ruta ${ruta})
${guion}

${REGLAS}

Devuelve SOLO un JSON válido, sin explicaciones ni cercas de código:
{"correos":[{"dia":1,"asunto":"…","cuerpo":"…"}, …]}`;

  // La cadencia se arma SOLA con los datos de la cuenta. La IA es una mejora
  // encima, no un requisito: si no hay crédito o falla, los correos salen
  // igual —rellenados con lo que sabemos— y se marca que no pasó por IA.
  const persona0 = (personas || [])[0];
  const vars = variablesDe(c, persona0);
  /* Los días salen de los PASOS de la cadencia, no de un arreglo escrito
     aquí. El arreglo fijo [1,3,7,11,16,22,30] se quedó corto en cuanto una
     cadencia creció a 8 correos: el octavo caía en i*4+1 = 29 y quedaba
     ANTES que el séptimo, que va en 30. Y desde que novias lleva el correo
     de presentación, sus días reales son 1,4,6,10,14,19,25,33 — con el
     arreglo viejo los toques se programaban en fechas que no existen en la
     cadencia. El guion que recibe la IA ya leía los pasos; esto es lo que
     de verdad agenda, y leía otra cosa. */
  const dias = (pasos || []).map((x: any) => Number(x.dia)).filter(Boolean);
  const base0 = (plantillas || []).map((p: any, i: number) => ({
    dia: dias[i] ?? [1, 3, 7, 11, 16, 22, 30][i] ?? (i * 4 + 1),
    asunto: asuntoPais(c.pais, rellenar(p.asunto, vars)),
    cuerpo: rellenar(p.cuerpo, vars),
    // La imagen y el botón NO los toca la IA: son del correo, no del texto.
    imagen: p.imagen || null, boton_texto: p.boton_texto || null, boton_url: p.boton_url || null,
  }));

  let correos = base0;
  let conIa = false;
  /* Por qué falló la IA viaja en la RESPUESTA, no solo al log. Un fallo de
     IA no rompe la cadencia —sale con la plantilla— así que es invisible:
     19 cuentas de novias salieron sin adaptar y solo se notó al contarlas.
     Quien genera tiene que poder leer la causa sin pedir logs de Vercel. */
  let iaError: string | null = null;
  if (op.con_ia !== false) {
    try {
      const r: any = await (anthropic as any).messages.create({
        // 8 correos de ~150 palabras no caben holgados en 4000 tokens. Ojo:
        // esto NO fue la causa de las 19 cadencias de novias que salieron
        // sin IA —eso era saldo agotado de la cuenta de Anthropic, y se vio
        // recién cuando el error viajó en la respuesta—. El tope se sube
        // igual porque el margen sí estaba corto; lo que no se usa no se
        // cobra.
        model: MODELS.sonnet, max_tokens: 12000,
        messages: [{ role: 'user', content: prompt }],
      });
      const txt = (r?.content || []).map((x: any) => x?.text || '').join('').trim();
      const limpio = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const salida = JSON.parse(limpio);
      const lista = Array.isArray(salida?.correos) ? salida.correos.slice(0, 8) : [];
      if (!lista.length) iaError = `la IA respondió sin correos utilizables (${txt.length} caracteres, empieza: ${txt.slice(0, 80)})`;
      if (lista.length) {
        correos = lista.map((m: any, i: number) => ({
          dia: Number(m.dia) || base0[i]?.dia || (i * 4 + 1),
          asunto: asuntoPais(c.pais, rellenar(String(m.asunto || base0[i]?.asunto || ''), vars)),
          cuerpo: rellenar(String(m.cuerpo || base0[i]?.cuerpo || ''), vars),
          // Se conservan los del paso: la IA adapta el texto, no el diseño.
          imagen: base0[i]?.imagen || null,
          boton_texto: base0[i]?.boton_texto || null, boton_url: base0[i]?.boton_url || null,
        }));
        conIa = true;
      }
    } catch (e: any) {
      // Se distingue el corte por longitud de cualquier otro fallo: son dos
      // problemas distintos y antes los dos se veían igual en el log.
      const msg = String(e?.message || e);
      const cortado = /Unexpected end of JSON|Unterminated string|JSON/i.test(msg);
      iaError = `${cortado ? 'respuesta CORTADA (sube max_tokens)' : e?.status ? `HTTP ${e.status}` : 'fallo'}: ${msg.slice(0, 240)}`;
      console.warn('[abm] la IA no pudo pulir la cadencia, va la versión de plantilla:', iaError);
    }
  }
  if (!correos.length) return { ok: false, error: 'no se pudo armar la cadencia', status: 500 };

  // Desde la ficha el correo 1 (día 1) cae mañana. En el goteo el día 1 es
  // HOY: se resta el primer día para que la fecha 0 sea ahora mismo.
  const hoy = Date.now();
  const desplaza = op.arranca_hoy ? (Number(correos[0]?.dia) || 1) : 0;
  const filas = correos.map((m: any, i: number) => ({
    cuenta_id: c.id, cadencia_id: base?.id || null, persona_id: persona0?.id || null,
    goteo_id: op.goteo_id || null,
    canal: 'email', destino: correo.valor,
    asunto: limpiar(m.asunto, 200), cuerpo: limpiar(m.cuerpo, 6000),
    imagen: m.imagen || null, boton_texto: m.boton_texto || null, boton_url: m.boton_url || null,
    estado: 'borrador',                                   // NADA sale sin que una persona lo apruebe
    programado_at: new Date(hoy + ((Number(m.dia) || (i * 4 + 1)) - desplaza) * 864e5).toISOString(),
  }));
  const { data: ins, error } = await supabase.from('abm_toques').insert(filas).select('id');
  if (error) return { ok: false, error: error.message, status: 500 };
  const toqueIds = (ins || []).map((r: any) => r.id);

  // WhatsApp: SOLO al número que el negocio publicó él mismo (declarado o ya
  // entregado); el trigger de la base rechaza cualquier otro. El texto sale de
  // la plantilla del giro tal cual —es una plantilla de Meta, no la toca la IA—.
  let whatsapps = 0;
  const wa = (canales || []).find(x => x.tipo === 'whatsapp_dueno' && ['declarado', 'valido'].includes(x.estado))
          || (canales || []).find(x => x.tipo.startsWith('whatsapp') && ['declarado', 'valido'].includes(x.estado));
  if (wa && pasosWa.length) {
    const ids = pasosWa.map((x: any) => x.plantilla_id).filter(Boolean);
    const { data: pls } = ids.length
      ? await supabase.from('abm_plantillas').select('id, cuerpo, meta_nombre').in('id', ids).eq('activa', true)
      : { data: [] as any[] };
    const filasWa = pasosWa.map((x: any) => {
      const pl = (pls || []).find((p: any) => p.id === x.plantilla_id);
      if (!pl?.meta_nombre) return null;
      return {
        cuenta_id: c.id, cadencia_id: base?.id || null, paso_id: x.id, persona_id: persona0?.id || null,
        goteo_id: op.goteo_id || null,
        canal: 'whatsapp', destino: wa.valor, asunto: null,
        cuerpo: limpiar(rellenar(pl.cuerpo, vars), 1024),
        estado: 'borrador',
        programado_at: new Date(hoy + ((Number(x.dia) || 2) - desplaza) * 864e5).toISOString(),
      };
    }).filter(Boolean);
    if (filasWa.length) {
      const { data: insWa, error: eWa } = await supabase.from('abm_toques').insert(filasWa).select('id');
      if (eWa) console.warn('[abm] no se pudieron crear los WhatsApp de la cadencia:', eWa.message);
      else { whatsapps = filasWa.length; toqueIds.push(...(insWa || []).map((r: any) => r.id)); }
    }
  }

  await apuntar(c.id, 'sistema', 'nota', { texto: `${op.autor} generó una cadencia de ${filas.length} correos${whatsapps ? ` y ${whatsapps} WhatsApp` : ''}${conIa ? '' : ' (sin IA: se armó con la plantilla del giro)'}, pendiente de aprobar` });
  return { ok: true, correos: filas.length, whatsapps, con_ia: conIa, ia_error: iaError, toque_ids: toqueIds, destino: correo.valor };
}
