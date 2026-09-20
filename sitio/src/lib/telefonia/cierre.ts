// LLAMADAS INTELIGENTES · El CIERRE CON IA (decisión del dueño, 11-sep-2026).
//
// Al colgar con una persona, la cabina daba 8 s para picar un chip y escribir
// un apunte, y la minuta llegaba después a la conversación sin regresar al
// item. Aquí la IA lee lo que se transcribió en vivo (las dos pistas) y deja
// TODO propuesto y, si nadie lo toca, hecho:
//   1. Resultado, apunte y siguiente paso.
//   2. Los COMPROMISOS con fecha («te marco el jueves a las 4», «vemos la demo
//      el martes»): se crean como reunión del CRM (bookings) con su evento de
//      Google Calendar, y la llamada además vuelve a la lista con hora.
//   3. Los DATOS que dijo (tiendas, giro, correo, puesto…): se llenan los
//      campos vacíos y se corrigen los que contradijo (datos-lead decide con la
//      confianza).
//   4. Lo que se PROMETIÓ MANDAR («te paso la info de facturación»): se busca
//      en `tel_conocimiento`; si ya se contestó antes, se arma el PDF y sale
//      por WhatsApp (mensaje normal si hay ventana de 24 h, plantilla si no, y
//      si no hay ni plantilla se queda esperando a que escriba). Si no hay con
//      qué, la cabina le pregunta al vendedor y lo que conteste se guarda para
//      la próxima.
import { supabase } from '../supabase';
import { claseDeFallo } from './fallo-cierre';
import { tiposDeReunion, huecosProximos, ajustarAHueco } from './agenda-huecos';
import { anthropic, MODELS, hasApiKey } from '../ai/client';
import { dialogoOido, type Oido } from './oidos';
import { telefonoWhatsApp } from '../telefono';
import { aplicarDatos, CAMPOS_LEAD, type DatoLead } from '../crm/ti/datos-lead';
import { enviarMediaLink, enviarPlantilla, conLinea } from '../whatsapp/kapso-api';
import { ventanaEnLinea } from '../whatsapp/linea';
import { createCalendarEvent } from '../google-calendar';
import { marcarAgendado } from '../crm/estatus-live';
import { envioPDF, guardarEnvioPDF } from './envio-pdf';
import { zonaDeLada, ladaDe, instanteEnZona, fechaHoraEn } from './zonas';

const ahora = () => new Date().toISOString();
export const RESULTADOS_CIERRE = ['contesto', 'volver_llamar', 'dieron_datos', 'no_interesa', 'buzon'];
/* Respaldo si la agenda no contesta: los cuatro de siempre. La lista BUENA se
   lee de `event_types` en cada cierre —hay catorce tipos activos, cada uno con
   su duración, su disponibilidad y sus correos— porque una lista escrita aquí
   se queda vieja el día que alguien crea un tipo nuevo, y entonces el prospecto
   que pide una capacitación termina con una «demo» agendada. */
const TIPOS_BASE: Record<string, number> = { demo: 30, seguimiento: 60, cotizacion: 45, 'llamada-discovery': 15 };
/* ══ 🔴 LA LLAMADA DE 19 MINUTOS QUE SE QUEDÓ SIN CIERRE (18-sep-2026) ═════
   Reporte del dueño sobre la reunión con Maela: «fue una reunión de 30 o 40
   minutos y por alguna razón no veo las referencias ni las solicitudes de la
   IA». En la base: `cierre_estado: sin_datos`, motivo «Request timed out», con
   194 trozos de transcripción y 1162 segundos hablados.

   O sea: la llamada MÁS valiosa del día —diecinueve minutos de conversación
   real— es justo la que se perdía, porque el tope de lectura era fijo en 20 s
   y daba igual si la transcripción traía tres renglones o nueve mil
   caracteres. Cuanto mejor la llamada, más seguro que se caía.

   Ahora el tope crece con lo que hay que leer, y con un techo alto: la sesión
   no se queda esperando —el vendedor decide mientras y la lista sigue—, así
   que alargarlo no cuesta nada salvo unos segundos de una llamada a la IA. El
   que manda a la sesión a seguir sola sigue siendo el de 20 s. */
const ESPERA_PROPUESTA_MS = 20000;   // lo que la SESIÓN espera antes de seguir sin la IA
/* MEDIDO, no estimado: la relectura de la llamada de Maela —11,014 caracteres
   de diálogo— volvió a caerse con 18 s. Sonnet tarda lo que tarda en escribir
   la propuesta entera (nota, compromisos, datos, envíos): son cerca de mil
   tokens de salida, y eso solo ya pasa de veinte segundos.

   Por eso hay DOS presupuestos, y la diferencia es quién espera:

   · `LECTURA_PULSO`: la lectura que corre dentro del latido del navegador. Se
     queda corta a propósito. Un latido que tarda un minuto CONGELA la cabina
     —el guard del pulso tira todo lo que llegue mientras—, y eso ya pasó una
     vez y es peor que quedarse sin propuesta.
   · `LECTURA_HOLGADA`: la del cron de cada 2 minutos y la del botón «volver a
     leer». Ahí nadie está mirando una pantalla que se tenga que mover, así que
     se le da tiempo de sobra. Es la que rescata las llamadas largas, que son
     justo las que importan. */
const LECTURA_PULSO_MS = 18000;
const LECTURA_HOLGADA_MS = 100000;
const tiempoDeLectura = (largo: number, holgado?: boolean) =>
  holgado ? Math.min(LECTURA_HOLGADA_MS, 45000 + Math.round(largo / 4)) : LECTURA_PULSO_MS;

/** Por qué no hubo propuesta, en una palabra que la pantalla pueda usar.
 *  Vive en `fallo-cierre.ts` porque `marcador.ts` también la necesita y carga
 *  este archivo de forma perezosa. */
export { claseDeFallo, type FalloCierre } from './fallo-cierre';
const COLGADO_MS = 2 * 60000;        // un cierre a medias más viejo que esto se rescata

/** Fecha y hora de un compromiso como instante, en la hora DEL CONTACTO (su zona por la lada: «a las 10» en Tijuana son las 12 del centro), o null si no es real, ya pasó o está a más de 90 días. */
function instanteCompromiso(fecha: string, hora: string, zona = 'America/Mexico_City'): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const [h, mi] = hora.split(':').map(Number);
  if (h > 23 || mi > 59) return null;
  if (Number.isNaN(new Date(`${fecha}T12:00:00Z`).getTime()) || new Date(`${fecha}T12:00:00Z`).toISOString().slice(0, 10) !== fecha) return null;   // 2026-02-30 rueda de mes
  const d = instanteEnZona(fecha, hora, zona);
  const dt = d.getTime() - Date.now();
  return dt > 5 * 60000 && dt < 90 * 86400e3 ? d : null;
}

export type Compromiso = {
  tipo: 'llamada' | 'reunion'; fecha: string; hora: string; duracion_min?: number;
  motivo?: string; reunion_tipo?: string; confianza?: number;
  /** La hora que dijo la IA no existía en la agenda de ese flujo y se movió al hueco real más cercano. */
  movido?: boolean;
};
export type Envio = { id?: string; tema: string; detalle?: string; conocimiento_id?: string | null; estado?: string };
/** Lo que puso el cliente y cómo se respondió. El material del guion. */
export type Objecion = { objecion: string; respuesta: string; funciono: boolean | null };
export type Propuesta = {
  resultado: string; nota: string; siguiente_paso: string; no_llamar?: boolean; no_llamar_evidencia?: string;
  objeciones?: Objecion[];
  compromisos: Compromiso[]; datos: DatoLead[]; envios: Envio[]; etapa?: string | null;
};

const primerNombre = (n?: string | null) => String(n || '').trim().split(/\s+/)[0] || '';
const sinAcentosTema = (x: string) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Las palabras que distinguen un tema de otro: «sacs» está en todos. */
const GENERICAS_TEMA = new Set(['sacs', 'sacscloud', 'general', 'sobre', 'para', 'llamada', 'cliente', 'sistema']);
const palabrasFuertes = (x: string) => (x.match(/[a-z0-9]{4,}/g) || []).filter(w => !GENERICAS_TEMA.has(w));

/** Hoy en CDMX, con día de la semana: «el jueves» depende de qué día es. */
function hoyCdmx() {
  const d = new Date();
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const dia = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long' }).format(d);
  const hora = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { fecha, dia, hora };
}

/* ────────────────────────────────────────────────────────────────────────
   1 · PROPONER: la IA lee la llamada y deja la propuesta en el item.
   ──────────────────────────────────────────────────────────────────────── */
export async function proponerCierre(itemId: string, opciones?: { reintento?: boolean; holgado?: boolean }): Promise<Propuesta | null> {
  /* Candado: sólo un latido lo propone. Con `reintento` se admite además
     repetir sobre un cierre que ya falló —lo pide el dueño a mano desde la
     cabina, o el rescate cuando el fallo fue de tiempo—: ahí el trabajo no
     está hecho, está PERDIDO, y volver a leer la misma transcripción no cuesta
     más que otra llamada a la IA. */
  const q = supabase.from('tel_sesion_items').update({ cierre_estado: 'proponiendo', updated_at: ahora() }).eq('id', itemId);
  const { data: it } = await (opciones?.reintento ? q.in('cierre_estado', ['sin_datos']) : q.is('cierre_estado', null)).select('*').maybeSingle();
  if (!it) return null;
  try {
    const oido: Oido[] = Array.isArray(it.oido) ? it.oido : [];
    const dialogo = dialogoOido(oido);
    const delContacto = oido.filter(o => o.final && o.quien !== 'vendedor').map(o => o.texto).join(' ');
    if (!hasApiKey() || delContacto.trim().length < 25) {
      const motivo = !hasApiKey() ? 'sin llave de IA' : 'la transcripción no alcanzó';
      await supabase.from('tel_sesion_items').update({ cierre_estado: 'sin_datos', cierre_ia: { motivo, fallo: claseDeFallo(motivo), largo: delContacto.trim().length, generado_at: ahora() }, updated_at: ahora() }).eq('id', itemId);
      return null;
    }

    const { data: s } = await supabase.from('tel_sesiones').select('presentacion_nombre, presentacion_motivo, owner_id').eq('id', it.sesion_id).maybeSingle();
    const { data: c } = it.contact_id ? await supabase.from('contacts').select('nombre, apellido, email, puesto, giro, sucursales_interes, plan_interes, lifecycle_stage, companies(nombre, nombre_comercial, giro, sucursales, ciudad)').eq('id', it.contact_id).maybeSingle() : { data: null as any };
    const { data: conocimiento } = await supabase.from('tel_conocimiento').select('id, tema, claves').eq('estado', 'activo').order('veces_usado', { ascending: false }).limit(80);
    const hoy = hoyCdmx();
    const emp: any = c?.companies;

    /* ══ LA CITA SE PROPONE SOBRE LOS FLUJOS QUE YA EXISTEN (19-sep-2026) ═══
       Pedido del dueño: «la cita que me debe sugerir debe estar basada en las
       reuniones que tiene el usuario, para que haga match con los flujos que ya
       se tienen —que en automático generan la reunión, el mensaje y todo lo
       demás—; la IA debe elegir si es demo o llamada de seguimiento o cualquier
       CTA que haga match con la intención, y validar los horarios».

       Así que se le dan las dos cosas de verdad: los tipos ACTIVOS de la agenda
       con su duración, y los huecos reales de los tres más probables. Ya no
       inventa ni el tipo ni la hora; elige de lo que existe. Y si la agenda no
       contesta, se sigue con los cuatro de siempre y sin huecos: un cierre sin
       cita es malo, un cierre que no se hace es peor. */
    const tipos = await tiposDeReunion().catch(() => [] as any[]);
    const catalogo = tipos.length ? tipos : Object.entries(TIPOS_BASE).map(([slug, minutos]) => ({ slug, nombre: slug, minutos }));
    /* Sólo de los candidatos probables: pedir los huecos de los catorce tipos
       son catorce viajes a la agenda dentro del cierre de una llamada. */
    const probables = ['demo', 'llamada-discovery', 'seguimiento'].filter(sl => catalogo.some((t: any) => t.slug === sl));
    const huecosPorTipo: Record<string, any[]> = {};
    await Promise.all(probables.map(async sl => { huecosPorTipo[sl] = await huecosProximos(sl, 10, 8); }));
    const agendaTexto = probables.map(sl => {
      const hs = huecosPorTipo[sl] || [];
      return `${sl}: ${hs.length ? hs.map(h => `${h.fecha} ${h.hora}`).join(', ') : '(sin huecos en 10 días)'}`;
    }).join('\n');

    const prompt = `Eres el asistente de cierre de llamadas del CRM de Sacs (software para tiendas de moda en México). Un vendedor acaba de colgar. Abajo va la TRANSCRIPCIÓN EN VIVO (imperfecta: es reconocimiento de voz) con quién dijo qué.
Tu trabajo: dejar la llamada cerrada en el CRM. Responde SOLO un JSON válido con esta forma exacta:
{
 "resultado": "contesto|volver_llamar|dieron_datos|no_interesa|buzon",
 "nota": "2 a 4 renglones: qué quería, qué se le dijo, cómo quedó. En español neutro, sin adornos.",
 "siguiente_paso": "UNA frase imperativa con lo que sigue",
 "no_llamar": false,
 "no_llamar_evidencia": "cita textual de dónde lo pidió, o vacío",
 "compromisos": [{"tipo":"llamada|reunion","fecha":"YYYY-MM-DD","hora":"HH:MM","duracion_min":15,"motivo":"…","reunion_tipo":"demo|seguimiento|cotizacion|llamada-discovery","confianza":0.0-1.0}],
 "datos": [{"campo":"…","valor":"…","confianza":0.0-1.0,"evidencia":"cita textual corta","corrige":false}],
 "envios": [{"tema":"…","detalle":"qué pidió exactamente","conocimiento_id":"uuid o null"}],
 "objeciones": [{"objecion":"lo que dijo para frenar, en SUS palabras","respuesta":"lo que le contestó el vendedor","funciono":true|false|null}],
 "etapa": "lead_calificado|descalificado|null"
}
REGLAS:
- "resultado": volver_llamar si pidió que se le marque después; dieron_datos si dio datos pero no hubo compromiso; no_interesa si lo dijo claramente; buzon si en realidad era una grabadora; si no, contesto.
- "compromisos": SOLO los que tengan fecha u hora dichas o deducibles («el jueves», «mañana a las 4», «la otra semana» = mismo día de la semana + 7). Hoy es ${hoy.dia} ${hoy.fecha}, ${hoy.hora} (hora del centro de México). Si dijo hora sin fecha, es hoy si aún no pasa y mañana si ya pasó. Fines de semana pasan al lunes. Nada de compromisos vagos («luego te busco»).
- "reunion_tipo": elige el que HAGA MATCH con lo que pidió, de esta lista de flujos que existen en la agenda (cada uno trae su duración en minutos y dispara su propio correo, su invitación y sus recordatorios):
${catalogo.map((t: any) => `  · ${t.slug} — ${t.nombre} (${t.minutos} min)`).join('\n')}
  «Te marco / te llamo» = llamada-discovery. «Vemos el sistema / una demo / enséñamelo» = demo. «Ya lo vi, lo platicamos otra vez» = seguimiento. Si pide precios formales = cotizacion. Si pide que le enseñen a usarlo = capacitacion. Usa "duracion_min" la del tipo que elijas.
- HORARIOS QUE DE VERDAD SE PUEDEN AGENDAR (hora del centro de México). Elige UNO de éstos, el más cercano a lo que se habló; NO inventes otra hora:
${agendaTexto || '  (la agenda no contestó: usa la hora que se dijo)'}
- "datos": solo lo dicho EXPLÍCITAMENTE. Campos posibles: ${CAMPOS_LEAD.join(', ')}. «sucursales» es un número; «empresa» es el nombre de su marca/tienda; «giro» qué vende. Si CONTRADICE lo que el CRM tiene, "corrige": true.
- "envios": TODO lo que el vendedor prometió mandar (información, precios, un PDF, un video, una liga, cómo funciona algo). Si el tema coincide con uno de LO QUE YA SABEMOS RESPONDER, pon su id en conocimiento_id; si no, null.
- "objeciones": TODO lo que el cliente puso como freno —precio, «ya tengo sistema», «lo veo con mi socio», «ahorita no», «es muy complicado»— con la respuesta que le dio el vendedor. "objecion" va en SUS palabras, no resumida: lo que se quiere aprender es cómo lo dice la gente. "funciono": true si después de esa respuesta siguió adelante (agendó, dio datos, se interesó), false si ahí se enfrió, null si no se alcanza a saber. Si no puso ninguna objeción, lista vacía — no inventes.
- "etapa": lead_calificado solo si quedó claro que es dueño/decisor de una tienda de moda con interés real. descalificado si dijo que NO le interesa, que no es para él, que no tiene tienda, o que ya no lo contacten — es decir, siempre que "resultado" sea no_interesa. Si no es ninguno de los dos, null. Un «ahora no puedo hablar» o «márcame luego» NO es descalificado: eso es volver_llamar.
- "no_llamar": true solo si pidió que no se le vuelva a llamar, y entonces "no_llamar_evidencia" trae sus palabras.

LO QUE EL CRM YA TIENE: contacto «${[c?.nombre, c?.apellido].filter(Boolean).join(' ') || it.nombre || '?'}», puesto ${c?.puesto || '?'}, correo ${c?.email || 'ninguno'}, giro ${c?.giro || emp?.giro || '?'}, tiendas ${c?.sucursales_interes ?? emp?.sucursales ?? '?'}, empresa ${emp?.nombre_comercial || emp?.nombre || it.empresa || '?'}, ciudad ${emp?.ciudad || '?'}, etapa ${c?.lifecycle_stage || '?'}.
QUIÉN LLAMÓ: ${s?.presentacion_nombre || 'el vendedor'}${s?.presentacion_motivo ? ` (${s.presentacion_motivo})` : ''}.
LO QUE YA SABEMOS RESPONDER (id · tema · palabras clave):
${(conocimiento || []).map(k => `${k.id} · ${k.tema} · ${(k.claves || []).join(', ')}`).join('\n') || '(nada todavía)'}

TRANSCRIPCIÓN:
${dialogo.slice(0, 9000)}`;

    const r = await anthropic.messages.create({ proposito: 'lib/telefonia/cierre.ts:119', model: MODELS.sonnet, max_tokens: 1400, messages: [{ role: 'user', content: prompt }] }, { timeout: tiempoDeLectura(dialogo.length, opciones?.holgado), maxRetries: 0 });
    const texto = (r.content[0] as any)?.text || '';
    const m = texto.match(/\{[\s\S]*\}/);
    const p: any = m ? JSON.parse(m[0]) : null;
    if (!p) throw new Error('la IA no devolvió JSON');

    const conocidos = new Set((conocimiento || []).map(k => k.id));
    const propuesta: Propuesta = {
      resultado: RESULTADOS_CIERRE.includes(String(p.resultado)) ? String(p.resultado) : 'contesto',
      nota: String(p.nota || '').slice(0, 1500),
      siguiente_paso: String(p.siguiente_paso || '').slice(0, 300),
      // No llamar es para siempre: solo con sus palabras como evidencia (la voz mal transcrita no basta).
      no_llamar: p.no_llamar === true && String(p.no_llamar_evidencia || '').trim().length > 10,
      no_llamar_evidencia: String(p.no_llamar_evidencia || '').slice(0, 200),
      // Compromisos: fecha real, en el futuro y a menos de 90 días. Una fecha del pasado volvería a marcar al contacto al instante.
      compromisos: (Array.isArray(p.compromisos) ? p.compromisos : []).filter((x: any) => x && instanteCompromiso(String(x.fecha), String(x.hora), zonaDeLada(it.lada || ladaDe(it.telefono))) && Number(x.confianza ?? 1) >= 0.6)
        .map((x: any) => {
          /* El tipo sale del catálogo VIVO. Si la IA se inventa un slug que no
             existe, se cae al de siempre según sea reunión o llamada — nunca se
             agenda contra un flujo inexistente, que es una cita que no manda
             correo ni invitación. */
          const tipoReal = catalogo.find((t: any) => t.slug === String(x.reunion_tipo));
          const slug = tipoReal?.slug || (x.tipo === 'reunion' ? 'demo' : 'llamada-discovery');
          /* Y la hora se valida contra los huecos de ESE flujo: si la que dijo
             la IA no existe en la agenda, se mueve al hueco real más cercano y
             se dice en el motivo, para que quien confirma lo vea antes de
             aceptar. Antes se creaba la cita igual, encimada o fuera del
             horario de atención de ese tipo. */
          /* Los huecos sólo mandan en las REUNIONES. Un «te marco el jueves a
             las 4» es un recordatorio tuyo: no ocupa la agenda de nadie, no
             manda invitación y no tiene por qué caer en un hueco libre de otra
             persona. Ajustarlo movía la hora que el cliente pidió a la
             conveniencia de un calendario ajeno. */
          const esLlamadaDeVuelta = x.tipo !== 'reunion';
          const hs = esLlamadaDeVuelta ? [] : (huecosPorTipo[slug] || []);
          const ajuste = ajustarAHueco(String(x.fecha), String(x.hora), hs);
          const movido = !!ajuste?.movido;
          return {
            tipo: x.tipo === 'reunion' ? 'reunion' : 'llamada',
            fecha: ajuste?.fecha || x.fecha, hora: ajuste?.hora || x.hora,
            duracion_min: Math.min(Math.max(Number(tipoReal?.minutos) || Number(x.duracion_min) || (x.tipo === 'reunion' ? 60 : 15), 15), 240),
            motivo: `${String(x.motivo || '').slice(0, 200)}${movido ? ` (se movió a ${ajuste!.fecha} ${ajuste!.hora}: a la hora que se habló no había hueco)` : ''}`.slice(0, 260),
            reunion_tipo: slug, confianza: Number(x.confianza ?? 1), movido,
          };
        }).slice(0, 3),
      datos: (Array.isArray(p.datos) ? p.datos : []).filter((d: any) => d && (CAMPOS_LEAD as readonly string[]).includes(String(d.campo)) && String(d.valor || '').trim()).slice(0, 12),
      envios: (Array.isArray(p.envios) ? p.envios : []).filter((e: any) => e && String(e.tema || '').trim())
        .map((e: any) => ({ tema: String(e.tema).slice(0, 120), detalle: String(e.detalle || '').slice(0, 300), conocimiento_id: conocidos.has(String(e.conocimiento_id)) ? String(e.conocimiento_id) : null })).slice(0, 5),
      etapa: p.etapa === 'lead_calificado' ? 'lead_calificado' : p.etapa === 'descalificado' ? 'descalificado' : null,
      /* Tres objeciones como mucho: más que eso no es una llamada con frenos,
         es la IA troceando la misma frase. Y las dos partes son obligatorias —
         una objeción sin respuesta no enseña nada. */
      objeciones: (Array.isArray(p.objeciones) ? p.objeciones : [])
        .filter((o: any) => o && String(o.objecion || '').trim().length > 3 && String(o.respuesta || '').trim().length > 3)
        .map((o: any) => ({ objecion: String(o.objecion).slice(0, 300), respuesta: String(o.respuesta).slice(0, 300), funciono: o.funciono === true ? true : o.funciono === false ? false : null }))
        .slice(0, 3),
    };

    // Los envíos nacen como filas: «listo» si ya sabemos qué mandar, «falta» si hay que preguntarle al vendedor.
    const tel = telefonoWhatsApp(it.telefono) || it.telefono;
    const filas = propuesta.envios.map(e => ({ item_id: it.id, contact_id: it.contact_id, conversation_id: it.conversation_id, telefono: tel, tema: e.tema, detalle: e.detalle || null, conocimiento_id: e.conocimiento_id, estado: e.conocimiento_id ? 'listo' : 'falta' }));
    const { data: creados } = filas.length ? await supabase.from('tel_envios').insert(filas).select('id, tema, estado, conocimiento_id') : { data: [] as any[] };
    propuesta.envios = (creados || []).map(x => ({ id: x.id, tema: x.tema, estado: x.estado, conocimiento_id: x.conocimiento_id }));

    await supabase.from('tel_sesion_items').update({ cierre_estado: 'propuesto', cierre_ia: { propuesta, generado_at: ahora() }, updated_at: ahora() }).eq('id', itemId);
    return propuesta;
  } catch (e: any) {
    const motivo = String(e?.message || e).slice(0, 200);
    /* Se guarda además CUÁNTO había que leer: un «se acabó el tiempo» con nueve
       mil caracteres de transcripción se explica solo, y eso es lo que la
       pantalla le dice al vendedor en vez de dejarlo mirando una tarjeta muda. */
    const largo = dialogoOido(Array.isArray(it.oido) ? it.oido : []).length;
    const intento = Number((it as any)?.cierre_ia?.intento || 0) + (opciones?.reintento ? 1 : 0);
    await supabase.from('tel_sesion_items').update({ cierre_estado: 'sin_datos', cierre_ia: { motivo, fallo: claseDeFallo(motivo), largo, intento, generado_at: ahora() }, updated_at: ahora() }).eq('id', itemId);
    return null;
  }
}

/** ¿Puede la sesión seguir sola? No mientras la IA piensa (tope 20 s) ni mientras haya preguntas abiertas para el vendedor. */
export function cierreListo(it: any): boolean {
  const est = it?.cierre_estado;
  if (!est || est === 'proponiendo') return Date.now() - new Date(it.terminado_at || 0).getTime() > ESPERA_PROPUESTA_MS;
  if (est === 'propuesto') {
    // Con preguntas abiertas para el vendedor se espera, pero no para siempre: a los 90 s lo abierto se vuelve tarea.
    const abiertas = (it.cierre_ia?.propuesta?.envios || []).some((e: any) => e.estado === 'falta');
    if (!abiertas) return true;
    const desdePropuesta = Date.now() - new Date(it.cierre_ia?.generado_at || 0).getTime();
    // Si el vendedor está escribiendo (la cabina late cada ~20 s mientras hay texto), se le espera; nunca más de 5 min.
    const escribiendo = it.cierre_ia?.escribiendo_at && Date.now() - new Date(it.cierre_ia.escribiendo_at).getTime() < 45000;
    if (escribiendo) return desdePropuesta > 5 * 60000;
    return desdePropuesta > 90000;
  }
  return true;
}

/* ────────────────────────────────────────────────────────────────────────
   2 · APLICAR: lo propuesto se vuelve hechos en el CRM.
   ──────────────────────────────────────────────────────────────────────── */
export async function aplicarCierre(itemId: string, o: { userId?: string | null; autor?: string | null; ajustes?: { resultado?: string; nota?: string }; rescate?: boolean } = {}): Promise<{ ok: boolean; hecho: string[] }> {
  // Candado: solo uno aplica. En rescate también se retoma un «aplicando» que se quedó a medias (cada paso es idempotente).
  const { data: it } = await supabase.from('tel_sesion_items').update({ cierre_estado: 'aplicando', updated_at: ahora() })
    .eq('id', itemId).in('cierre_estado', o.rescate ? ['propuesto', 'aplicando'] : ['propuesto']).select('*').maybeSingle();
  if (!it) return { ok: false, hecho: [] };
  const p: Propuesta = it.cierre_ia?.propuesta;
  const hecho: string[] = [];
  const t = ahora();
  try {
    // ── Resultado y apunte (lo que el vendedor ajustó manda) ──────────────
    // El apunte del vendedor (si escribió) ya está en la conversación por el API; aquí va el de la IA.
    const resultado = o.ajustes?.resultado || it.resultado || p.resultado;
    const notaIA = [p.nota, p.siguiente_paso ? `Siguiente paso: ${p.siguiente_paso}` : null].filter(Boolean).join('\n');
    const notaVendedor = o.ajustes?.nota || it.nota || '';
    await supabase.from('tel_sesion_items').update({ resultado, nota: [notaVendedor, notaIA].filter(Boolean).join('\n— IA —\n'), updated_at: t }).eq('id', itemId);
    if (it.call_sid) await supabase.from('wa_llamadas').update({ resultado, siguiente_paso: p.siguiente_paso || null }).eq('call_id', it.call_sid);
    const { data: notaYa } = it.conversation_id && notaIA ? await supabase.from('wa_notas').select('id').eq('conversation_id', it.conversation_id).contains('metadata', { sesion_item: itemId }).limit(1).maybeSingle() : { data: null };
    if (it.conversation_id && notaIA && !notaYa) {
      await supabase.from('wa_notas').insert({
        conversation_id: it.conversation_id, contact_id: it.contact_id || null, autor: 'Cierre con IA',
        texto: `📝 **Cierre de la llamada**\n\n${notaIA}`,
        metadata: { tipo: 'nota_llamada', nota_llamada: it.call_sid || null, sesion_item: itemId, autor_id: o.userId || null, ia: true },
      }).then(() => {}, () => {});
    }
    hecho.push('apunte');
    if (it.contact_id) {
      const upC: any = { updated_at: t };
      if (p.siguiente_paso) upC.proximo_paso = p.siguiente_paso.slice(0, 300);
      if (p.no_llamar) upC.no_llamar = true;
      await supabase.from('contacts').update(upC).eq('id', it.contact_id);
      if (p.no_llamar) {
        await supabase.from('activities').insert({ contact_id: it.contact_id, tipo: 'opt_out', titulo: 'Pidió que no se le llame (en la llamada)', descripcion: p.no_llamar_evidencia || null, automatico: true, metadata: { regla: 'cierre_llamada', actor: 'ia', sesion_item: itemId } }).then(() => {}, () => {});
        hecho.push('no volver a llamar');
      }
    }

    // ── Datos dichos → campos del CRM (datos-lead decide llenar/corregir) ──
    if (it.contact_id && p.datos?.length) {
      const { cambios } = await aplicarDatos(it.contact_id, p.datos, { fuente: 'llamada', conversation_id: it.conversation_id });
      if (cambios.length) hecho.push(`${cambios.length} dato${cambios.length > 1 ? 's' : ''}: ${cambios.map(c => c.campo).join(', ')}`);
    }
    /* ── LA BAJA, QUE ES LA MITAD QUE FALTABA ──────────────────────────────
       La IA ya detectaba `resultado: no_interesa` —sabía perfectamente que el
       prospecto había dicho que no— pero `etapa` solo aceptaba
       `lead_calificado`, así que nadie lo descalificaba: el contacto se quedaba
       en `lead`, con su cadencia viva y dentro de las secuencias, y le seguían
       llegando correos después de haber dicho que no por teléfono.
       Es EXACTAMENTE el caso Montse (15-sep) pero por el otro canal. Se reusa
       `aplicarRechazo`, el mismo camino que ya arregló el de WhatsApp: baja la
       etapa, termina la cadencia, detiene las secuencias y veta los envíos
       pendientes. Una sola forma de descalificar en todo el CRM. */
    if (it.contact_id && p.etapa === 'descalificado') {
      const { aplicarRechazo } = await import('../crm/ti/agente');
      await aplicarRechazo(it.contact_id, `lo dijo en la llamada: «${String(p.nota || '').slice(0, 120)}»`);
      hecho.push('etapa: descalificado, y fuera de cadencias y secuencias');
    }
    // ── Etapa: solo se sube, nunca se baja ────────────────────────────────
    if (it.contact_id && p.etapa === 'lead_calificado') {
      const { data: c } = await supabase.from('contacts').select('lifecycle_stage').eq('id', it.contact_id).maybeSingle();
      if (c?.lifecycle_stage === 'lead') {
        await supabase.from('contacts').update({ lifecycle_stage: 'lead_calificado', updated_at: t }).eq('id', it.contact_id);
        await supabase.from('activities').insert({ contact_id: it.contact_id, tipo: 'etapa_cambio', titulo: 'Calificado en la llamada', automatico: true, metadata: { regla: 'cierre_llamada', actor: 'ia' } }).then(() => {}, () => {});
        hecho.push('etapa: lead calificado');
      }
    }

    // ── Compromisos → reunión + Google Calendar + la lista ────────────────
    /* Si Fernanda ya usó `volver_a_llamar` o `agendar` en la llamada, eso ya quedó hecho con la hora exacta
       que el cliente aceptó. El cierre con IA lee la misma transcripción y volvería a proponerlo: crearía un
       booking (con invitación al cliente por Google Calendar) y pisaría el `volver_at` del item con su propia
       interpretación de la hora. Un «márcame en diez minutos» terminaba como una reunión en la agenda. */
    const yaLoHizoFernanda = new Set(((it.voz as any)?.herramientas || []).map((h: any) => String(h?.nombre)));

    /* ══ Y LO QUE YA SE HIZO DURANTE LA LLAMADA ═════════════════════════════
       Desde el 17-sep, lo que el cliente pide EN la llamada se hace en la
       llamada (`acciones.ts`): si dijo «mándame la info», el PDF ya salió por
       WhatsApp antes de colgar. El cierre lee la MISMA transcripción y, sin
       saberlo, propone mandarlo otra vez — y el cliente recibe dos veces el
       mismo PDF, o acaba con dos citas para la misma hora.

       Es el mismo problema que ya resolvió `yaLoHizoFernanda`, por el otro
       lado: quien actuó primero manda. */
    const { data: accionesHechas } = it.call_sid
      ? await supabase.from('tel_acciones').select('accion, params').eq('call_sid', it.call_sid).eq('estado', 'hecha')
      : { data: [] as any[] };
    const hechas = new Set((accionesHechas || []).map((a: any) => String(a.accion)));
    const temasMandados = (accionesHechas || [])
      .filter((a: any) => /^mandar_/.test(String(a.accion)))
      .map((a: any) => sinAcentosTema(String((a.params || {}).tema || a.accion)));
    /** ¿Este envío es el mismo que ya salió en la llamada? Por palabra fuerte
     *  compartida («cotización», «catálogo», «información»), no por el texto
     *  exacto: la IA lo bautiza distinto cada vez. */
    const yaSeMando = (tema: string) => {
      const mias = palabrasFuertes(sinAcentosTema(tema));
      return temasMandados.some(t => palabrasFuertes(t).some(w => mias.includes(w)));
    };
    for (const cp of p.compromisos || []) {
      if (cp.tipo === 'llamada' && yaLoHizoFernanda.has('volver_a_llamar')) { hecho.push('la llamada de vuelta ya la programó Fernanda en la llamada'); continue; }
      if (cp.tipo === 'reunion' && yaLoHizoFernanda.has('agendar')) { hecho.push('la reunión ya la agendó Fernanda en la llamada'); continue; }
      if (cp.tipo === 'llamada' && (hechas.has('volver_a_llamar') || hechas.has('ahorita_no'))) { hecho.push('la llamada de vuelta ya quedó puesta durante la llamada'); continue; }
      if (cp.tipo === 'reunion' && hechas.has('agendar_demo')) { hecho.push('la reunión ya se agendó durante la llamada'); continue; }
      const r = await crearCompromiso(it, cp, o.userId || null);
      if (r) hecho.push(r);
    }

    // ── Envíos listos → PDF + WhatsApp ────────────────────────────────────
    const { data: envios } = await supabase.from('tel_envios').select('*').eq('item_id', itemId).in('estado', ['listo', 'falta']);
    for (const e of envios || []) {
      if (yaSeMando(e.tema)) {
        await supabase.from('tel_envios').update({ estado: 'omitido', motivo: 'ya se le mandó durante la llamada', updated_at: t }).eq('id', e.id);
        hecho.push(`${e.tema}: ya se le había mandado durante la llamada`);
        continue;
      }
      if (e.estado === 'listo') {
        const r = await mandarEnvio(e.id);
        /* Si NO salió, se dice. `mandarEnvio` ya deja la tarea con el PDF listo
           —no se pierde— pero la pantalla de cierre enseñaba sólo lo que sí
           pasó, y «no te lo dije» es como se promete dos veces lo mismo. */
        if (r) hecho.push(r);
        else {
          const { data: f } = await supabase.from('tel_envios').select('estado, motivo').eq('id', e.id).maybeSingle();
          hecho.push(`${e.tema}: no salió (${f?.motivo || 'sin motivo'}) — quedó la tarea de mandarlo a mano`);
        }
      }
      else {
        /* Nadie contestó qué mandar: queda como tarea para que no se pierda…
           y ADEMÁS se apunta el hueco de la biblioteca. Si tres clientes piden
           lo mismo y nadie lo escribe nunca, el sistema pregunta tres veces y
           el vendedor lo manda tres veces a mano: el agujero está en que no hay
           contenido, no en que falte una tarea. */
        await supabase.from('tel_envios').update({ estado: 'omitido', motivo: 'sin respuesta del vendedor; quedó como tarea', updated_at: t }).eq('id', e.id);
        await tareaMandarAMano(e, null, `En la llamada quedaste de mandárselo${e.detalle ? `: «${e.detalle}»` : ''}. Nadie dijo qué mandar.`, o.userId || null);
        hecho.push(`tarea: mandar ${e.tema}`);
        try {
          const { data: hueco } = await supabase.from('tel_conocimiento')
            .select('id, veces_usado').eq('tema', e.tema).eq('estado', 'hueco').maybeSingle();
          if (hueco) {
            await supabase.from('tel_conocimiento').update({ veces_usado: Number(hueco.veces_usado || 0) + 1, updated_at: t }).eq('id', hueco.id);
          } else {
            await supabase.from('tel_conocimiento').insert({
              tema: e.tema, claves: [], texto: '', origen: 'hueco',
              // `hueco` = lo pidieron y no tenemos qué mandar. No se usa para
              // enviar (el envío sólo mira `activo`): es la lista de lo que
              // falta escribir, ordenada por cuántas veces lo han pedido.
              estado: 'hueco', veces_usado: 1,
            });
          }
        } catch { /* apuntar el hueco no puede tumbar el cierre */ }
      }
    }

    /* ══ «VOLVER A LLAMAR» NO PUEDE QUEDAR EN EL AIRE (17-sep-2026) ════════
       El hueco más caro del cierre, y estaba a la vista: si el desenlace es
       «volver a llamar» pero la IA no sacó una fecha —y nadie apretó uno de los
       atajos— NO QUEDA NADA. Ni tarea, ni item pendiente, ni recordatorio: sólo
       una palabra en un informe. Esa es, literalmente, la llamada que se
       pierde: la persona dijo «márcame luego» y nadie le marcó nunca.

       Si no hay compromiso ni acción hecha, se deja una tarea para mañana a
       las 10 en Mi día y SE DICE en la pantalla de cierre. Mañana a las 10 no
       es adivinar: es el suelo por debajo del cual no se puede caer. Si la
       persona quería otra hora, ahí están los atajos y la fecha exacta. */
    const quedoFecha = (p.compromisos || []).some(cp => cp.tipo === 'llamada')
      || hechas.has('volver_a_llamar') || hechas.has('ahorita_no') || hechas.has('agendar_demo');
    if (resultado === 'volver_llamar' && !quedoFecha && it.contact_id) {
      const { data: ses } = await supabase.from('tel_sesiones').select('owner_id').eq('id', it.sesion_id).maybeSingle();
      const manana = new Date(Date.now() + 86400e3);
      const cuando = instanteEnZona(fechaHoraEn(zonaDeLada(it.lada || ladaDe(it.telefono)), manana).fecha, '10:00', zonaDeLada(it.lada || ladaDe(it.telefono)));
      const { data: ya } = await supabase.from('ti_tareas').select('id').eq('contact_id', it.contact_id).eq('estado', 'pendiente').eq('tipo', 'llamada')
        .gte('vence_at', new Date(Date.now() - 12 * 3600e3).toISOString()).limit(1).maybeSingle();
      if (!ya) {
        await supabase.from('ti_tareas').insert({
          contact_id: it.contact_id, company_id: it.company_id, owner_id: ses?.owner_id || o.userId || null,
          familia: 'llamar', tipo: 'llamada', prioridad: 1, vence_at: cuando.toISOString(), origen: 'evento',
          payload: {
            de_llamada: true,
            instruccion: `${primerNombre(it.nombre) || 'El contacto'}: quedó de volver a llamar y no se puso fecha`,
            porque: 'En la llamada dijo «márcame luego» y nadie fijó día ni hora.', nombre: it.nombre, whatsapp: it.telefono,
          },
        }).then(() => {}, () => {});
        hecho.push('quedó de volver a llamar sin fecha: te lo dejé mañana a las 10 en Mi día');
      }
    }

    /* ══ EL DESENLACE, PEGADO A LA GRABACIÓN (20-sep-2026) ════════════════
       Pedido del dueño: va a grabar muchas más llamadas para entrenar el
       modelo. Medido hoy: de 36 grabaciones, 27 tenían como resultado
       «contestó» — eso dice que alguien levantó el teléfono, no qué pasó. Sin
       saber cuáles acabaron en demo y cuáles en «no me interesa», el audio no
       enseña nada: es archivo, no corpus.

       Aquí es el único sitio donde se sabe de verdad, porque es después de
       aplicar: si se creó la cita, si dio datos, si dijo que no. Se escribe en
       la llamada —junto al audio— para poder pedir «las que acabaron en demo»
       sin cruzar cuatro tablas. Y las objeciones viajan con él, que es lo que
       convierte el corpus en guion. */
    await marcarDesenlace(it, p, hecho);
    await cerrarItem(itemId, { aplicado_at: ahora(), hecho, por: o.userId ? 'vendedor' : 'auto' });
    return { ok: true, hecho };
  } catch (e: any) {
    await cerrarItem(itemId, { aplicado_at: ahora(), hecho, error: String(e?.message || e).slice(0, 200) });
    return { ok: false, hecho };
  }
}

/**
 * En qué acabó la llamada, en una palabra que se pueda filtrar.
 *
 * El orden importa: se mira primero lo más comprometido. Alguien que agendó una
 * demo Y dio datos cuenta como demo — es el desenlace que define la llamada, y
 * mezclarlo con «dio datos» haría que el corpus de demos se quedara corto.
 */
async function marcarDesenlace(it: any, p: Propuesta | null, hecho: string[]) {
  if (!it?.call_sid) return;
  const conDemo = hecho.some(h => /demo/i.test(h));
  const conCita = hecho.some(h => /reunión|reunion|demo|discovery|capacitaci/i.test(h));
  const conLlamada = hecho.some(h => /llamada|volver a llamar/i.test(h));
  const r = String(p?.resultado || it.resultado || '');

  const desenlace = conDemo ? 'agendo_demo'
    : conCita ? 'agendo_reunion'
    : conLlamada || r === 'volver_llamar' ? 'volver_llamar'
    : r === 'no_interesa' ? 'no_interesa'
    : r === 'dieron_datos' || hecho.some(h => /^\d+ dato/.test(h)) ? 'dio_datos'
    : r === 'buzon' || it.resultado === 'buzon' ? 'buzon'
    : it.resultado === 'colgo_rapido' ? 'colgo_sin_hablar'
    : r === 'contesto' || it.resultado === 'contesto' ? 'hablamos'
    : 'sin_contacto';

  await supabase.from('wa_llamadas').update({
    desenlace,
    ...(Array.isArray((p as any)?.objeciones) && (p as any).objeciones.length ? { objeciones: (p as any).objeciones } : {}),
  }).eq('call_id', it.call_sid).then(() => {}, () => {});
}

/** Cierra sobre el `cierre_ia` FRESCO: los envíos ya escribieron ahí sus estados y la foto del claim los pisaría. */
async function cerrarItem(itemId: string, extra: Record<string, any>) {
  const { data: fresh } = await supabase.from('tel_sesion_items').select('cierre_ia').eq('id', itemId).maybeSingle();
  await supabase.from('tel_sesion_items').update({ cierre_estado: 'aplicado', cierre_ia: { ...(fresh?.cierre_ia || {}), ...extra }, updated_at: ahora() }).eq('id', itemId);
}

/** Rescate: cierres que se quedaron a medias (la IA tardó más que la espera, o la función murió aplicando). Lo llama el latido; barato y acotado. */
let ultimoRescate = 0;
export async function rescatarCierres(): Promise<void> {
  if (Date.now() - ultimoRescate < 30000) return;
  ultimoRescate = Date.now();
  try {
    const viejo = new Date(Date.now() - COLGADO_MS).toISOString();

    /* ══ LA LLAMADA QUE NADIE CERRÓ (17-sep-2026) ═══════════════════════════
       Un item puede quedar «hecho» SIN cierre: pasa cada vez que el cliente
       cuelga primero o que quien atendió cierra la pestaña. En la cabina eso no
       existía —el vendedor siempre pasa por el cierre para seguir a la
       siguiente— pero en las llamadas sueltas es el caso NORMAL: el que cuelga
       suele ser el otro. Sin esto, esas llamadas no dejaban ni apunte, ni
       compromiso, ni el envío que se prometió.

       Dos topes, y los dos importan: se espera a que lleve 2 minutos colgada
       (para no pelearse con la pantalla, que está pidiendo el cierre en ese
       momento) y se ignora lo que lleve más de 2 HORAS. Sin ese segundo tope,
       el día que esto se estrene se pondría a cerrar el historial entero —
       agendando reuniones y mandando PDF por llamadas de la semana pasada. */
    const hace2h = new Date(Date.now() - 2 * 3600e3).toISOString();
    const { data: sinCierre } = await supabase.from('tel_sesion_items')
      .select('id').eq('estado', 'hecho').is('cierre_estado', null)
      .lt('terminado_at', viejo).gt('terminado_at', hace2h)
      .order('terminado_at').limit(3);
    for (const it of sinCierre || []) {
      const p = await proponerCierre(it.id);
      if (p) await aplicarCierre(it.id, { userId: null, rescate: true });
    }

    /* ══ LO QUE SE PERDIÓ POR TIEMPO SE VUELVE A LEER SOLO (18-sep-2026) ═══
       Un cierre que murió con «Request timed out» no es una llamada sin nada
       que decir: es una llamada CON todo que decir, cuya lectura no alcanzó a
       terminar. La transcripción sigue guardada, así que releerla no cuesta más
       que otra llamada a la IA — y con el tope de lectura ya escalado por
       tamaño, el segundo intento es el que sí entra.

       Sólo los de tiempo, y sólo dentro de la ventana de 2 horas. Los de saldo
       NO se reintentan solos a propósito: sin crédito, reintentar es quemar
       llamadas fallidas cada 30 segundos. Ése lo dispara el dueño desde la
       cabina cuando ya recargó, que es lo que pidió. */
    const { data: porTiempo } = await supabase.from('tel_sesion_items')
      .select('id, cierre_ia').eq('estado', 'hecho').eq('cierre_estado', 'sin_datos')
      .eq('cierre_ia->>fallo', 'tiempo')
      .lt('terminado_at', viejo).gt('terminado_at', hace2h)
      .order('terminado_at').limit(3);
    /* UN solo reintento automático. Si la segunda lectura también se cae, el
       problema no es el tiempo y seguir pidiéndola cada 30 segundos sólo gasta
       llamadas a la IA; ahí se queda con su botón para que el dueño decida. */
    for (const it of (porTiempo || []).filter((x: any) => !Number(x.cierre_ia?.intento))) {
      const p = await proponerCierre(it.id, { reintento: true, holgado: true });
      if (p) await aplicarCierre(it.id, { userId: null, rescate: true });
    }

    const { data } = await supabase.from('tel_sesion_items').select('id, cierre_estado').eq('estado', 'hecho').in('cierre_estado', ['proponiendo', 'propuesto', 'aplicando']).lt('updated_at', viejo).order('updated_at').limit(5);
    for (const it of data || []) {
      if (it.cierre_estado === 'proponiendo') {
        // La IA nunca contestó (o murió la función): se vuelve a pedir una vez.
        await supabase.from('tel_sesion_items').update({ cierre_estado: null, updated_at: ahora() }).eq('id', it.id).eq('cierre_estado', 'proponiendo');
        const p = await proponerCierre(it.id);
        if (!p) continue;
      }
      await aplicarCierre(it.id, { userId: null, rescate: true });
    }
    // Y los PDF que esperaban a que el cliente escribiera y nunca escribió: al vendedor, a mano.
    const { data: viejos } = await supabase.from('tel_envios').select('*').eq('estado', 'pendiente_ventana').lt('created_at', new Date(Date.now() - 7 * 86400e3).toISOString()).limit(5);
    for (const e of viejos || []) await caducarEnvio(e);
  } catch { /* el latido no se detiene por esto */ }
}

async function caducarEnvio(e: any) {
  const { data: ok } = await supabase.from('tel_envios').update({ estado: 'omitido', motivo: 'pasaron más de 7 días esperando respuesta', updated_at: ahora() }).eq('id', e.id).eq('estado', 'pendiente_ventana').select('id').maybeSingle();
  if (ok) { await marcarEnvioEnItem(e.item_id, e.id, 'omitido'); await tareaMandarAMano(e, e.pdf_url || null, 'Pasaron 7 días sin que contestara el aviso: el PDF no salió solo.'); }
}

/** Una reunión del CRM (con Google Calendar si el host lo tiene conectado) y, si es llamada, la vuelta a la lista con hora. */
/* ══ AGENDAR A MANO DESDE LA LLAMADA (19-sep-2026) ═════════════════════════
   El dueño quiere poder leerle los horarios al prospecto y cerrar ahí mismo,
   «con IA o sin IA». Esto es el «sin IA»: la misma puerta que usa el cierre
   automático —`crearCompromiso`—, así que la cita nace igual que cualquier
   otra: con su tipo de evento, su anfitrión, su invitación de Google, su correo
   y sus recordatorios. Un camino paralelo que insertara en `bookings` a mano
   crearía citas de segunda, sin nada de eso. */
export async function agendarDesdeLlamada(
  itemId: string,
  o: { fecha: string; hora: string; reunion_tipo: string; motivo?: string | null; userId?: string | null },
): Promise<{ ok: boolean; dicho?: string; error?: string }> {
  const { data: it } = await supabase.from('tel_sesion_items').select('*').eq('id', itemId).maybeSingle();
  if (!it) return { ok: false, error: 'No existe esa llamada' };
  const esLlamada = o.reunion_tipo === 'llamada-discovery';
  const dicho = await crearCompromiso(it, {
    tipo: esLlamada ? 'llamada' : 'reunion',
    fecha: o.fecha, hora: o.hora, reunion_tipo: o.reunion_tipo,
    motivo: o.motivo || undefined, confianza: 1,
  }, o.userId || null);
  /* `crearCompromiso` devuelve texto cuando NO pudo (y ese texto explica por
     qué), y null cuando fue bien o cuando ya existía. El texto se pasa tal cual
     a la pantalla: es la diferencia entre «ya quedó» y «no quedó y por esto». */
  if (dicho && /^no se pudo/.test(dicho)) return { ok: false, error: dicho };
  return { ok: true, dicho: dicho || `Quedó agendada para el ${o.fecha} a las ${o.hora}.` };
}

export async function crearCompromiso(it: any, cp: Compromiso, userId: string | null): Promise<string | null> {
  const { data: s } = await supabase.from('tel_sesiones').select('owner_id').eq('id', it.sesion_id).maybeSingle();
  /* ══ CADA COSA AL CALENDARIO DE QUIEN LA TRABAJA (20-sep-2026) ═══════════
     Pedido del dueño: «a mi cuenta también agregaremos mi propio calendario
     para que yo tenga el evento de seguimiento de llamadas, que esas deben ir
     a mi calendario directo; Andrea no ve nada de seguimiento de llamadas pero
     sí la agenda de las reuniones».

     Son dos cosas distintas con dos dueños distintos:

     · VOLVER A LLAMAR («te marco el jueves») es un recordatorio DE QUIEN HABLÓ.
       Nadie más lo puede atender: el hilo de esa conversación está en su
       cabeza. Va a SU calendario — `userId`, quien cerró la llamada.
     · UNA REUNIÓN (demo, discovery, capacitación) es de la AGENDA: tiene
       invitación, correo y a veces otro anfitrión. Sigue colgando del dueño de
       la jornada, que es quien la atiende.

     Hasta hoy las dos usaban el dueño de la jornada, así que los seguimientos
     de él caían en el Google de ella y él no veía ninguno. */
  const slugCitaPrevio = cp.reunion_tipo || (cp.tipo === 'reunion' ? 'demo' : 'llamada-discovery');
  /* ══ 🔴 LA DEMO SE OFRECÍA DE UNA AGENDA Y SE GUARDABA EN OTRA ═══════════
     Encontrado trazando el flujo completo (20-sep-2026), a petición del dueño.
     Las horas que la cabina lee en voz alta salen de la disponibilidad del
     DUEÑO DEL TIPO DE EVENTO —los trece tipos son de Andrea— pero la cita se
     creaba con el dueño de la JORNADA como anfitrión. O sea: le ofrecías al
     prospecto un hueco libre de Andrea y la reunión caía en TU calendario, a
     una hora que quizá tú tenías ocupada. Dos agendas distintas para la misma
     cita.

     La regla, que es la que él describió: una REUNIÓN (demo y las demás de
     agenda) es de quien la da —el dueño del tipo de evento—; una LLAMADA
     (volver a marcar, discovery acordado al teléfono) es de quien habló. */
  const { data: tipoDueno } = cp.tipo === 'reunion'
    ? await supabase.from('event_types').select('owner_id').eq('slug', slugCitaPrevio).maybeSingle()
    : { data: null as any };
  const hostId = cp.tipo === 'llamada'
    ? (userId || s?.owner_id)
    : (tipoDueno?.owner_id || s?.owner_id || userId);
  /* Sin anfitrión no hay agenda donde poner la cita — y callarlo es peor que
     no agendarla: quien colgó se queda creyendo que quedó. Se dice. */
  if (!hostId) return `no se pudo agendar ${cp.tipo === 'llamada' ? 'la llamada' : 'la reunión'} del ${cp.fecha}: la llamada no tiene dueño (ábrela en la pantalla de la llamada o asígnale el contacto a alguien)`;
  const slugCita = slugCitaPrevio;
  const { data: tipo } = await supabase.from('event_types').select('id, nombre, duracion_minutos').eq('slug', slugCita).maybeSingle();
  if (!tipo) return null;
  // La hora que dijo el contacto es en SU zona; la reunión se guarda en la del vendedor (centro), que es la que ve la agenda.
  const zonaContacto = zonaDeLada(it.lada || ladaDe(it.telefono));
  const cuando = instanteCompromiso(cp.fecha, cp.hora, zonaContacto);
  if (!cuando) return null;
  const { fecha, hora } = fechaHoraEn('America/Mexico_City', cuando);
  const dur = Math.min(Math.max(Number(cp.duracion_min) || tipo.duracion_minutos || 30, 15), 240);
  const [h, mi] = hora.split(':').map(Number);
  const finMin = Math.min(h * 60 + mi + dur, 23 * 60 + 59);   // nunca pasa de medianoche: el fin no puede ir antes del inicio
  const horaFin = `${String(Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;
  const suHora = zonaContacto === 'America/Mexico_City' || hora === cp.hora ? '' : ` (${cp.hora} de allá)`;
  const { data: c } = it.contact_id ? await supabase.from('contacts').select('email, nombre, apellido').eq('id', it.contact_id).maybeSingle() : { data: null as any };
  const nombre = [c?.nombre, c?.apellido].filter(Boolean).join(' ') || it.nombre || it.telefono;
  const asunto = cp.tipo === 'llamada' ? `Llamada con ${primerNombre(nombre)}${cp.motivo ? `: ${cp.motivo}` : ''}` : `${tipo.nombre} con ${primerNombre(nombre)}${cp.motivo ? `: ${cp.motivo}` : ''}`;

  // Idempotencia: la misma persona, misma fecha y hora, no se agenda dos veces.
  const { data: ya } = await supabase.from('bookings').select('id').eq('contact_id', it.contact_id || '00000000-0000-0000-0000-000000000000').eq('fecha', fecha).eq('hora_inicio', hora).limit(1).maybeSingle();
  if (ya) return null;

  const { data: bk, error: errBk } = await supabase.from('bookings').insert({
    event_type_id: tipo.id, host_id: hostId, consultor_id: hostId, fecha, hora_inicio: hora, hora_fin: horaFin,
    timezone_host: 'America/Mexico_City', timezone_invitado: zonaContacto,
    invitee_nombre: nombre, invitee_email: c?.email || null, invitee_empresa: it.empresa || null, invitee_notas: cp.motivo || null,
    company_id: it.company_id || null, contact_id: it.contact_id || null, asunto, estado: 'agendada', origen: 'llamada',
    estado_hist: [{ estado: 'agendada', at: ahora(), por: 'Cierre con IA' }],
  }).select('id').maybeSingle();
  if (!bk) return `no se pudo agendar ${cp.tipo === 'llamada' ? 'la llamada' : tipo.nombre.toLowerCase()} del ${fecha}: ${errBk?.message || 'error al guardar'}`;

  /* ══ SI NO ENTRÓ A GOOGLE CALENDAR, SE DICE POR QUÉ ═══════════════════
     Una cita que sólo vive en el CRM es una cita a la que nadie va a llegar:
     no le suena al cliente ni al vendedor. Antes, cuando no había conexión de
     Google, el cierre decía «demo el 24 a las 16:00» a secas y parecía que
     todo había quedado. Ahora se nombra el hueco y se dice dónde se arregla. */
  let google = '';
  try {
    const { data: conexion } = await supabase.from('calendar_connections').select('email').eq('team_member_id', hostId).eq('provider', 'google').eq('activo', true).maybeSingle();
    if (!conexion) google = ' — ⚠️ NO quedó en Google Calendar: conecta tu cuenta en Ajustes ▸ Agenda';
    if (conexion) {
      const ev = await createCalendarEvent(hostId, { summary: asunto, description: [it.empresa, cp.motivo, `Teléfono: ${it.telefono}`].filter(Boolean).join('\n'), startDateTime: `${fecha}T${hora}:00`, endDateTime: `${fecha}T${horaFin}:00`, timezone: 'America/Mexico_City', attendeeEmail: c?.email || undefined });
      if (ev?.eventId) { await supabase.from('bookings').update({ google_event_id: ev.eventId, google_meet_link: ev.meetLink || null }).eq('id', bk.id); google = ' (en Google Calendar)'; }
      else google = ' — ⚠️ Google no aceptó el evento: la cita está en el CRM pero no en tu calendario';
    }
  } catch (e: any) {
    // La reunión ya quedó en el CRM; lo que falta es el calendario, y se dice.
    google = ` — ⚠️ no se pudo poner en Google Calendar (${String(e?.message || e).slice(0, 60)})`;
  }

  if (it.contact_id) {
    await marcarAgendado(it.contact_id).catch(() => {});
    await supabase.from('contacts').update({ next_followup: fecha, updated_at: ahora() }).eq('id', it.contact_id);
    /* ══ 🔴 SÓLO UNA DEMO PROMUEVE (19-sep-2026, corrección) ═══════════════
       Reporte del dueño sobre Emilio Achar: «sólo se pidió una reunión de
       seguimiento, no una demostración en línea, y lo marcó como oportunidad.
       Cuando hay una reunión de seguimiento NO se marca como oportunidad, se
       queda en el estatus que está; lo único que lo marca como oportunidad es
       cuando agenda una demo del sistema».

       Tiene razón y el error fue mío, de hace dos horas: la condición era «es
       una reunión», y bajo eso caben la llamada de vuelta que pidió, el
       seguimiento, la capacitación y la cotización. Una oportunidad es otra
       cosa: es alguien que va a VER el sistema. Confundirlo infla el embudo y
       —peor— le quita el hilo al agente en gente que todavía está en nutrición.

       Ya corregido en los datos: Liduvina vuelve a Rezagado (su cita era una
       llamada de continuación). Francisco Javier y JO-el se quedan: los suyos
       sí eran demos. */
    if (slugCita === 'demo') {
      /* ══ 🔴 UN REZAGADO QUE AGENDA ES UNA OPORTUNIDAD (19-sep-2026) ════════
         Reporte del dueño sobre Estefany: agendó demo en la llamada, quedó
         «Agendó demo»… y su etapa siguió siendo «Rezagado», con la IA
         proponiendo respuestas encima. Le tocaba a él escribirle, que es lo que
         hace un seguimiento personalizado antes de una demo.

         La promoción sólo miraba `lead` y `lead_calificado`. Pero el agente
         atiende TRES etapas —`ETAPAS_SDR` incluye `rezagado` desde el 8-sep— y
         por eso justo la que faltaba era la que más lo necesitaba: un rezagado
         que acepta una demo es el caso de éxito del agente, y se quedaba dentro
         de su alcance para siempre.

         Se lee la lista del propio agente en vez de escribir otra: la regla no
         es «estas tres etapas», es «las etapas que lleva la IA» — y el día que
         alguien le quite o le sume una, esto se entera solo. Dos listas
         parecidas en dos archivos es cómo nació este bug. */
      const { ETAPAS_SDR } = await import('../crm/ti/agente');
      const { data: cl } = await supabase.from('contacts').select('lifecycle_stage').eq('id', it.contact_id).maybeSingle();
      if (cl && ETAPAS_SDR.includes(String(cl.lifecycle_stage))) {
        await supabase.from('contacts').update({ lifecycle_stage: 'oportunidad' }).eq('id', it.contact_id);
        await supabase.from('activities').insert({ contact_id: it.contact_id, tipo: 'etapa_cambio', titulo: `Promovido a Oportunidad desde ${cl.lifecycle_stage === 'rezagado' ? 'Rezagado' : 'Lead'}: agendó reunión en la llamada`, automatico: true, metadata: { regla: 'booking_creado', actor: 'ia', desde: cl.lifecycle_stage } }).then(() => {}, () => {});
      }
    }
  }
  /* ══ 🔴 LA CONFIRMACIÓN AL CLIENTE, QUE NUNCA SALÍA ════════════════════
     Reporte del dueño (18-sep-2026): «se le agendó demo y sí aparece la demo
     agendada, pero no le llegó el WhatsApp de la confirmación».

     Tenía razón y el hueco era éste: `confirmarCitaPorWhatsApp` la llamaban la
     página pública (`book.ts`) y el módulo de eventos, pero NO el cierre de la
     llamada — que es justo por donde entran las citas que salen hablando. La
     reunión quedaba en la agenda y en Google Calendar, y el cliente no se
     enteraba por WhatsApp de nada.

     Va DESPUÉS del intento de Google Calendar a propósito: así el mensaje
     lleva la liga de Meet. Y devuelve por qué no salió, si no salió: «se
     agendó» a secas, cuando al cliente no le llegó nada, es la clase de
     silencio que hace que alguien no se presente. */
  let aviso = '';
  if (cp.tipo === 'reunion') {
    try {
      const { confirmarCitaPorWhatsApp } = await import('../crm/confirmacion-cita');
      const r = await confirmarCitaPorWhatsApp(bk.id);
      aviso = r.ok ? ' y le llegó la confirmación por WhatsApp' : ` (no se le pudo confirmar por WhatsApp: ${r.motivo || 'sin motivo'})`;
    } catch (e: any) { aviso = ` (no se le pudo confirmar por WhatsApp: ${String(e?.message || e).slice(0, 80)})`; }
  }

  if (cp.tipo === 'llamada') {
    // Vuelve a la lista a esa hora (si la sesión sigue viva la marca sola) y a Mi día del vendedor.
    const { reprogramar } = await import('./marcador');
    await reprogramar(it, 0, cp.motivo || 'lo pidió en la llamada', cuando);
    await supabase.from('ti_tareas').insert({
      contact_id: it.contact_id, company_id: it.company_id, owner_id: hostId, familia: 'llamar', tipo: 'llamada', prioridad: 1, vence_at: cuando.toISOString(), origen: 'evento',
      payload: { de_llamada: true, instruccion: `${primerNombre(nombre)}: le prometiste llamarle a las ${hora}${suHora}`, porque: cp.motivo ? `Quedaron en: ${cp.motivo}.` : 'Lo pidió en la llamada.', nombre, whatsapp: it.telefono, booking_id: bk.id, resultados: { contesto: 'Contestó', buzon: 'Buzón', no_contesto: 'No contestó', reagendar: 'Pidió otra hora' } },
    }).then(() => {}, () => {});
  }
  return `${cp.tipo === 'llamada' ? 'llamada' : tipo.nombre.toLowerCase()} el ${fecha} a las ${hora}${suHora}${google}${aviso}`;
}

/* ────────────────────────────────────────────────────────────────────────
   3 · ENVÍOS: lo prometido sale por WhatsApp, con su PDF.
   ──────────────────────────────────────────────────────────────────────── */

/** El vendedor contestó qué mandar: se guarda para la próxima y se manda ahora. */
export async function responderEnvio(envioId: string, texto: string, o: { userId?: string | null; autor?: string | null } = {}): Promise<{ ok: boolean; motivo: string }> {
  const { data: e } = await supabase.from('tel_envios').select('*').eq('id', envioId).maybeSingle();
  if (!e) return { ok: false, motivo: 'no existe el envío' };
  if (!['falta', 'omitido', 'sin_via', 'fallo'].includes(e.estado)) return { ok: false, motivo: e.estado === 'enviado' ? 'ese ya se mandó' : 'ese envío ya va en camino' };
  const cuerpo = String(texto || '').trim();
  if (cuerpo.length < 10) return { ok: false, motivo: 'escribe al menos una línea' };
  const claves = Array.from(new Set(`${e.tema} ${e.detalle || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]{4,}/g) || [])).slice(0, 12);
  // Candado: si dos pestañas contestan a la vez, solo la primera se lleva el envío (la segunda ve otro estado y se retira).
  const { data: mio } = await supabase.from('tel_envios').update({ estado: 'listo', updated_at: ahora() }).eq('id', envioId).eq('estado', e.estado).select('id');
  if (!mio?.length) return { ok: false, motivo: 'ese envío ya lo contestó alguien más' };
  const { data: k } = await supabase.from('tel_conocimiento').insert({ tema: e.tema, claves, texto: cuerpo, origen: 'vendedor', estado: 'activo' }).select('id').maybeSingle();
  await supabase.from('tel_envios').update({ conocimiento_id: k?.id || null, updated_at: ahora() }).eq('id', envioId);
  // Se refleja en la propuesta del item para que la cabina deje de preguntar.
  if (e.item_id) await marcarEnvioEnItem(e.item_id, envioId, 'listo');
  const r = await mandarEnvio(envioId);
  return { ok: !!r, motivo: r || 'no se pudo mandar' };
}

export async function omitirEnvio(envioId: string): Promise<void> {
  const { data: e } = await supabase.from('tel_envios').update({ estado: 'omitido', motivo: 'el vendedor dijo que no', updated_at: ahora() }).eq('id', envioId).select('item_id').maybeSingle();
  if (e?.item_id) await marcarEnvioEnItem(e.item_id, envioId, 'omitido');
}

async function marcarEnvioEnItem(itemId: string, envioId: string, estado: string) {
  const { data: it } = await supabase.from('tel_sesion_items').select('cierre_ia').eq('id', itemId).maybeSingle();
  const ci = it?.cierre_ia;
  if (!ci?.propuesta?.envios) return;
  ci.propuesta.envios = ci.propuesta.envios.map((x: any) => x.id === envioId ? { ...x, estado } : x);
  await supabase.from('tel_sesion_items').update({ cierre_ia: ci, updated_at: ahora() }).eq('id', itemId);
}

/** Arma el PDF (si aún no) y decide por dónde sale. Devuelve una frase de lo que pasó, o null si falló. */
export async function mandarEnvio(envioId: string): Promise<string | null> {
  const { data: e } = await supabase.from('tel_envios').select('*').eq('id', envioId).maybeSingle();
  if (!e || !['listo', 'pendiente_ventana'].includes(e.estado)) return null;
  const t = ahora();
  // Candado: el latido, el vendedor y el webhook pueden querer mandar el mismo a la vez; solo uno lo reclama.
  const { data: mio } = await supabase.from('tel_envios').update({ estado: 'enviando', updated_at: t }).eq('id', envioId).eq('estado', e.estado).select('id').maybeSingle();
  if (!mio) return null;
  try {
    const { data: k } = e.conocimiento_id ? await supabase.from('tel_conocimiento').select('id, tema, texto, pdf_url, veces_usado').eq('id', e.conocimiento_id).maybeSingle() : { data: null as any };
    if (!k?.texto && !k?.pdf_url) {
      await supabase.from('tel_envios').update({ estado: 'fallo', motivo: 'el tema no tiene contenido', updated_at: t }).eq('id', envioId);
      if (e.item_id) await marcarEnvioEnItem(e.item_id, envioId, 'fallo');
      await tareaMandarAMano(e, null, 'El tema guardado no tiene texto ni PDF: mándalo a mano.');
      return null;
    }

    // Quién es, para el PDF y el mensaje.
    let conv: any = null, nombre = '', empresa: string | null = null, vendedor: string | null = null;
    if (e.conversation_id) {
      const { data } = await supabase.from('wa_conversaciones').select('id, telefono, phone_number_id, ventanas, ultimo_entrante_at, contacts(nombre, apellido), companies(nombre, nombre_comercial)').eq('id', e.conversation_id).maybeSingle();
      conv = data;
    } else if (e.contact_id) {
      const { data } = await supabase.from('wa_conversaciones').select('id, telefono, phone_number_id, ventanas, ultimo_entrante_at, contacts(nombre, apellido), companies(nombre, nombre_comercial)').eq('contact_id', e.contact_id).order('ultimo_mensaje_at', { ascending: false }).limit(1).maybeSingle();
      conv = data;
    }
    const c: any = conv?.contacts, em: any = conv?.companies;
    nombre = [c?.nombre, c?.apellido].filter(Boolean).join(' ');
    empresa = em?.nombre_comercial || em?.nombre || null;
    if (e.item_id) {
      const { data: it } = await supabase.from('tel_sesion_items').select('nombre, empresa, sesion_id, tel_sesiones(presentacion_nombre)').eq('id', e.item_id).maybeSingle();
      nombre = nombre || it?.nombre || '';
      empresa = empresa || it?.empresa || null;
      vendedor = (it as any)?.tel_sesiones?.presentacion_nombre || null;
    }

    let url: string = e.pdf_url || '';
    if (!url) {
      if (k.pdf_url) url = String(k.pdf_url);
      else {
        const buf = await envioPDF({ tema: k.tema || e.tema, para: nombre || null, empresa, de: vendedor, cuerpo: k.texto });
        url = await guardarEnvioPDF(envioId, buf);
      }
      await supabase.from('tel_envios').update({ pdf_url: url, updated_at: t }).eq('id', envioId);
    }
    const tel = telefonoWhatsApp(conv?.telefono || e.telefono);
    if (!tel) {
      await supabase.from('tel_envios').update({ estado: 'sin_via', motivo: 'el teléfono no sirve para WhatsApp', updated_at: t }).eq('id', envioId);
      if (e.item_id) await marcarEnvioEnItem(e.item_id, envioId, 'sin_via');
      await tareaMandarAMano(e, url, 'El teléfono no sirve para WhatsApp: mándalo por otro medio.');
      return null;
    }
    const primer = primerNombre(nombre) || 'qué tal';
    const archivo = `${String(k.tema || e.tema).replace(/[^\wáéíóúñÁÉÍÓÚÑ ]+/g, '').slice(0, 60).trim() || 'Informacion'} - Sacscloud.pdf`;
    const mensaje = e.texto || `Hola ${primer}, como quedamos en la llamada, aquí te dejo ${String(k.tema || e.tema).toLowerCase()}. Cualquier duda, con gusto.`;
    const ventana = conv ? ventanaEnLinea(conv, conv.phone_number_id) : { abierta: false, expira_at: null };
    let estado = 'enviado', motivo = 'se mandó por WhatsApp';
    // La línea se fija solo para este envío (conLinea restaura el contexto: el webhook que nos llama sigue con el suyo).
    await conLinea({ contexto: 'cliente', origen: 'telefonia' }, async () => {
      if (ventana.abierta) {
        await enviarMediaLink(tel, 'document', url, archivo, mensaje);
        return;
      }
      const { data: cfg } = await supabase.from('wa_config').select('minuta_envio_plantilla_doc, minuta_envio_plantilla_aviso').eq('id', 1).maybeSingle();
      const aprobada = async (n?: string | null) => { if (!n) return false; const { data } = await supabase.from('wa_plantillas').select('status').eq('nombre', n).order('status').limit(1).maybeSingle(); return String((data as any)?.status || '').toUpperCase() === 'APPROVED'; };
      if (await aprobada(cfg?.minuta_envio_plantilla_doc)) {
        await enviarPlantilla(tel, String(cfg!.minuta_envio_plantilla_doc), 'es_MX', [primer], { headerMedia: { tipo: 'document', link: url, filename: archivo } });
        motivo = 'se mandó con plantilla (fuera de la ventana de 24 h)';
      } else if (e.estado !== 'pendiente_ventana' && await aprobada(cfg?.minuta_envio_plantilla_aviso)) {
        await enviarPlantilla(tel, String(cfg!.minuta_envio_plantilla_aviso), 'es_MX', [primer]);
        estado = 'pendiente_ventana'; motivo = 'se le avisó con plantilla; el PDF sale en cuanto conteste';
      } else if (e.estado === 'pendiente_ventana') {
        estado = 'pendiente_ventana'; motivo = 'sigue esperando a que escriba';
      } else {
        estado = 'sin_via'; motivo = 'fuera de la ventana de 24 h y sin plantilla aprobada: hay que mandarlo a mano';
      }
    });
    if (estado === 'pendiente_ventana' && e.estado === 'pendiente_ventana') {
      await supabase.from('tel_envios').update({ estado: 'pendiente_ventana', updated_at: t }).eq('id', envioId);   // se suelta el candado, sigue esperando
      return null;
    }
    await supabase.from('tel_envios').update({ estado, motivo, enviado_at: estado === 'enviado' ? t : null, updated_at: t }).eq('id', envioId);
    if (estado === 'enviado' && k?.id) await supabase.from('tel_conocimiento').update({ veces_usado: Number(k.veces_usado || 0) + 1, updated_at: t }).eq('id', k.id);
    if (e.item_id) await marcarEnvioEnItem(e.item_id, envioId, estado);
    if (estado === 'sin_via') await tareaMandarAMano(e, url, motivo);
    return `${e.tema}: ${motivo}`;
  } catch (err: any) {
    const motivo = String(err?.message || err).slice(0, 200);
    await supabase.from('tel_envios').update({ estado: 'fallo', motivo, updated_at: t }).eq('id', envioId);
    if (e.item_id) await marcarEnvioEnItem(e.item_id, envioId, 'fallo');
    const { data: e2 } = await supabase.from('tel_envios').select('pdf_url').eq('id', envioId).maybeSingle();
    await tareaMandarAMano(e, e2?.pdf_url || null, `No se pudo mandar por WhatsApp (${motivo}).`);
    return null;
  }
}

/** No salió por WhatsApp: el vendedor lo manda a mano desde Mi día, con el PDF ya armado.
 *  Va como tipo `responder` (familia avanzar): `wa_libre` está filtrado en la torre y en Mi día desde el 3-sep y nadie lo vería. */
async function tareaMandarAMano(e: any, url: string | null, motivo: string, userId?: string | null) {
  if (!e.item_id) return;
  const { data: ya } = await supabase.from('ti_tareas').select('id').eq('estado', 'pendiente').contains('payload', { envio_id: e.id }).limit(1).maybeSingle();
  if (ya) return;
  const { data: it } = await supabase.from('tel_sesion_items').select('contact_id, company_id, nombre, telefono, tel_sesiones(owner_id)').eq('id', e.item_id).maybeSingle();
  const primer = primerNombre(it?.nombre) || '';
  await supabase.from('ti_tareas').insert({
    contact_id: it?.contact_id || null, company_id: it?.company_id || null, owner_id: (it as any)?.tel_sesiones?.owner_id || userId || null, familia: 'avanzar', tipo: 'responder', prioridad: 2, vence_at: ahora(), origen: 'evento',
    payload: {
      de_llamada: true,
      instruccion: `${primer || 'El contacto'}: mandarle ${e.tema}${url ? ' (PDF listo)' : ''}`, porque: motivo, nombre: it?.nombre, whatsapp: it?.telefono, pdf_url: url, envio_id: e.id, tema: e.tema, detalle: e.detalle || null,
      mensaje: `Hola${primer ? ` ${primer}` : ''}, como quedamos en la llamada, aquí te dejo ${String(e.tema).toLowerCase()}.${url ? ` ${url}` : ''} Cualquier duda, con gusto.`,
    },
  }).then(() => {}, () => {});
}

/** Al escribir el cliente se abre la ventana: salen los PDF que quedaron esperando. Lo llama el webhook. Nunca lanza. */
export async function entregarEnviosPendientes(conversationId: string): Promise<number> {
  try {
    const { data } = await supabase.from('tel_envios').select('*').eq('conversation_id', conversationId).eq('estado', 'pendiente_ventana').order('created_at', { ascending: true }).limit(3);
    let n = 0;
    for (const e of data || []) {
      if (Date.now() - Date.parse(e.created_at) > 7 * 86400e3) { await caducarEnvio(e); continue; }
      if (await mandarEnvio(e.id)) n++;
    }
    return n;
  } catch { return 0; }
}
