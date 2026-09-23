// LO QUE EL CLIENTE PIDE **DENTRO** DE LA LLAMADA — y se hace ahí mismo.
//
// PEDIDO DEL DUEÑO (17-sep-2026): «me pidió una acción: enviar la información
// por WhatsApp. En el momento en que alguien pida una acción, la IA tiene que
// ejecutar esa acción. Debes explicar qué acción hiciste o, si no reconoces
// qué acción hacer, que yo te explique cuál deberías hacer para que aprendas.
// Basado en eso, yo pueda ejecutar también esa acción en ese momento: ya sea
// enviarle una plantilla, si la ventana está abierta enviarle un mensaje
// directamente, lo que me pidió.»
//
// LAS TRES DECISIONES QUE EXPLICAN TODO LO DEMÁS
//
// 1. **Reglas primero, IA después.** Lo que dispara una acción es una frase
//    ("mándame la info por WhatsApp"), y para eso una expresión regular es
//    mejor que un modelo: contesta en el mismo milisegundo, es gratis, y —lo
//    que aquí importa— SIGUE FUNCIONANDO cuando no hay saldo de IA. El caso
//    Andrea Romo (17-sep) fue justo eso: el compromiso no se creó porque el
//    cierre con IA murió sin crédito. Una llamada no puede depender de eso.
//    La IA sí entra, pero AL COLGAR: el cierre (`cierre.ts`) lee la llamada
//    entera y recoge lo que las reglas no cazaron —un envío prometido con
//    otras palabras, una cita dicha a medias—. Durante la llamada manda la
//    regla, que contesta en el mismo segundo y no se cae con la facturación.
//
// 2. **No todo se ejecuta solo.** El dueño pidió que la IA EJECUTE. Pero
//    "mándale la información" y "descalifícalo para siempre" no son la misma
//    apuesta: la transcripción en vivo se equivoca, y un mandado de más se
//    perdona — una baja de más, no. Así que cada acción trae `auto`: las que
//    sólo mandan material o crean un recordatorio salen solas; las que tocan
//    la ficha, la agenda o la baja esperan UN clic. Todas, salgan solas o no,
//    dejan escrito QUÉ pasó.
//
// 3. **Lo que no se reconoce se aprende.** Si nadie cazó la frase, quien colgó
//    la dicta ("mándale el PDF de precios") y eso deja dos rastros: la acción
//    hecha ahora y una REGLA nueva en `tel_accion_reglas` para la próxima vez.
//    Es el mismo ciclo de reglas-como-datos de Trabajo Inteligente, no un
//    modelo nuevo. Una regla aprendida NUNCA ejecuta sola: propone. Aprender
//    de oído y disparar de oído son dos permisos distintos.
import { supabase } from '../supabase';
import { sinAcentos } from './oidos';
import { detectarCatalogo, interpretarCuando, LEER, type Detectada, type AccionId } from './acciones-frases';

export { interpretarCuando };
export type { Detectada };

const ahora = () => new Date().toISOString();

export type Ctx = {
  callSid: string;
  itemId?: string | null;
  contactId?: string | null;
  conversationId?: string | null;
  telefono: string;
  nombre?: string | null;
  userId?: string | null;
};

export type Campo = { campo: string; etiqueta: string; tipo: 'texto' | 'fecha' | 'hora' | 'larga'; valor?: string };

type Accion = {
  id: string;
  /** Lo que se le enseña a quien acaba de colgar. Imperativo y corto. */
  etiqueta: string;
  /** Una línea de por qué existe, para la pantalla de configuración. */
  para: string;
  /** ¿Sale sola en cuanto se oye? (ver decisión 2 del encabezado) */
  auto: boolean;
  /** Lo que hace falta antes de ejecutar (la sala lo pregunta). */
  pide?: (params: any) => Campo[];
  ejecutar: (ctx: Ctx, params: any) => Promise<{ ok: boolean; dicho: string; params?: any }>;
};

/* ════════════════════════════════════════════════════════════════════════
   EL CATÁLOGO · los 10 casos, en orden de cuántas veces pasan de verdad.
   El orden importa: gana el primero que caza, así que lo específico va
   antes que lo general («mándame la cotización» antes que «mándame algo»).
   ════════════════════════════════════════════════════════════════════════ */

/** Manda material por WhatsApp reusando el riel de los envíos del cierre:
 *  arma el PDF, decide mensaje libre (ventana de 24 h) o PLANTILLA, y si no
 *  hay ni una ni otra deja la tarea con el PDF listo. Y dice cuál de las tres
 *  pasó, que es justo lo que el dueño pidió saber: «el cliente ve cosas
 *  distintas del otro lado». */
/* ══ «¿QUIÉN ME HABLA?» → UN WHATSAPP CON QUIÉN ERES (22-sep-2026) ═════════
   Mientras hablas le llega tu nombre, Sacs, la liga y POR QUÉ le llamas —con
   la fecha y sus palabras si las hay («el 23 de agosto nos escribiste…»)—.
   Con la ventana de 24 h abierta va como texto; cerrada, con la plantilla
   aprobada de «te marcamos para dar seguimiento» (y su respaldo). */
async function mandarQuienSoy(ctx: Ctx): Promise<{ ok: boolean; dicho: string }> {
  const { telefonoWhatsApp } = await import('../telefono');
  const tel = telefonoWhatsApp(ctx.telefono);
  if (!tel) return { ok: false, dicho: 'el teléfono no sirve para WhatsApp' };
  const { origenDelLead } = await import('./origen');
  const origen = await origenDelLead({ contact_id: ctx.contactId, telefono: tel }).catch(() => null);
  let vendedor = '';
  if (ctx.itemId) {
    const { data: it } = await supabase.from('tel_sesion_items').select('tel_sesiones(presentacion_nombre)').eq('id', ctx.itemId).maybeSingle();
    vendedor = String((it as any)?.tel_sesiones?.presentacion_nombre || '').replace(/ de sacs(cloud)?$/i, '');
  }
  if (!vendedor && ctx.userId) vendedor = String((await supabase.from('team_members').select('nombre').eq('id', ctx.userId).maybeSingle()).data?.nombre || '').split(' ')[0];
  const primer = String(ctx.nombre || '').trim().split(/\s+/)[0];
  const texto = `Hola${primer ? ` ${primer}` : ''}, soy ${vendedor || 'del equipo'} de Sacs, el sistema para tiendas y marcas de moda (www.sacscloud.com).${origen?.corta ? ` Te estoy llamando porque ${origen.corta}${origen.primer_mensaje?.texto ? `: «${origen.primer_mensaje.texto.slice(0, 80)}»` : ''}.` : ''} Este es mi WhatsApp, por si prefieres seguir por aquí.`;
  const { data: conv } = await supabase.from('wa_conversaciones').select('id, ventanas, ultimo_entrante_at, phone_number_id')
    .or([ctx.contactId ? `contact_id.eq.${ctx.contactId}` : null, `telefono.like.%${tel.replace(/\D/g, '').slice(-10)}`].filter(Boolean).join(',')).order('ultimo_mensaje_at', { ascending: false }).limit(1).maybeSingle();
  const { ventanaEnLinea } = await import('../whatsapp/linea');
  if (conv && ventanaEnLinea(conv as any, (conv as any).phone_number_id).abierta) {
    const { enviarTexto } = await import('../whatsapp/kapso-api');
    const { registrarMensaje } = await import('../whatsapp/espejo');
    const r: any = await enviarTexto(tel, texto);
    const wamid = r?.messages?.[0]?.id || null;
    if (wamid) await registrarMensaje({ kapsoMessageId: wamid, telefono: tel, direccion: 'saliente', tipo: 'text', cuerpo: texto, status: 'sent', autor: vendedor || 'Llamada', metadata: { origen: 'llamada', quien_soy: true } });
    return { ok: !!wamid, dicho: wamid ? 'le llegó por WhatsApp quién eres y por qué le llamas' : 'no salió el WhatsApp' };
  }
  const { mandarPlantilla } = await import('../whatsapp/plantilla-espejo');
  const r = await mandarPlantilla({ telefono: tel, plantilla: 'llamada_saliente_util_v3', params: [primer || 'qué tal'], autor: vendedor || 'Llamada', metadata: { origen: 'llamada', quien_soy: true } });
  return { ok: r.enviado, dicho: r.enviado ? 'le llegó por WhatsApp (plantilla, la ventana estaba cerrada)' : `no salió: ${r.motivo || 'sin motivo'}` };
}

async function mandarMaterial(ctx: Ctx, tema: string, detalle: string): Promise<{ ok: boolean; dicho: string; params?: any }> {
  const { telefonoWhatsApp } = await import('../telefono');
  const tel = telefonoWhatsApp(ctx.telefono) || ctx.telefono;
  // ¿Ya sabemos contestar esto? La biblioteca es la misma que alimenta el
  // cierre: lo que un vendedor dictó una vez sirve para todos.
  /* «Sacs» está en TODOS los temas, así que si cuenta como coincidencia todo
     coincide con todo: pedir la cotización acabaría mandando el PDF general
     porque los dos dicen «Sacs». Las palabras que no distinguen nada no
     puntúan. */
  const GENERICAS = new Set(['sacs', 'sacscloud', 'llamada', 'pidio', 'whats', 'whatsapp', 'favor', 'sistema']);
  const claves = Array.from(new Set(sinAcentos(`${tema} ${detalle}`).match(/[a-z0-9]{4,}/g) || []))
    .filter(c => !GENERICAS.has(c)).slice(0, 12);
  const { data: biblio } = await supabase.from('tel_conocimiento')
    .select('id, tema, claves, veces_usado').eq('estado', 'activo').order('veces_usado', { ascending: false }).limit(80);
  const puntua = (k: any) => {
    const suyas = (k.claves || []).map((c: string) => sinAcentos(c));
    const enTema = sinAcentos(String(k.tema || ''));
    return claves.filter(c => suyas.some((s: string) => s.includes(c) || c.includes(s)) || enTema.includes(c)).length;
  };
  const mejor = (biblio || []).map(k => ({ k, p: puntua(k) })).sort((a, b) => b.p - a.p)[0];
  const conocimientoId = mejor && mejor.p >= 1 ? mejor.k.id : null;

  const { data: envio } = await supabase.from('tel_envios').insert({
    item_id: ctx.itemId || null, contact_id: ctx.contactId || null, conversation_id: ctx.conversationId || null,
    telefono: tel, tema, detalle: detalle || null, conocimiento_id: conocimientoId,
    estado: conocimientoId ? 'listo' : 'falta',
  }).select('id').maybeSingle();
  if (!envio) return { ok: false, dicho: 'no se pudo registrar el envío' };

  if (!conocimientoId) {
    /* No hay con qué mandarlo. NO es un fallo: es la pregunta que el dueño
       pidió que se hiciera —«si no reconoces qué hacer, que yo te explique»—.
       La sala pinta el campo, y lo que conteste se manda ahora y se guarda
       para la próxima (responderEnvio). */
    return { ok: false, dicho: `No sé qué mandarle de «${tema}». Escríbelo y sale ahora mismo — y queda guardado para la próxima.`, params: { envio_id: envio.id, pide_texto: true } };
  }
  const { mandarEnvio } = await import('./cierre');
  const r = await mandarEnvio(envio.id);
  if (!r) {
    const { data: e } = await supabase.from('tel_envios').select('estado, motivo').eq('id', envio.id).maybeSingle();
    return { ok: false, dicho: e?.motivo || 'no salió: quedó la tarea para mandarlo a mano', params: { envio_id: envio.id } };
  }
  return { ok: true, dicho: r, params: { envio_id: envio.id } };
}

/** Compromiso con fecha (llamada o reunión) por el MISMO camino que el cierre:
 *  booking + Google Calendar del host + tarea en Mi día + vuelta a la lista. */
async function comprometer(ctx: Ctx, tipo: 'llamada' | 'reunion', params: any): Promise<{ ok: boolean; dicho: string }> {
  const { fecha, hora } = params || {};
  if (!fecha || !hora) return { ok: false, dicho: 'falta el día y la hora' };
  const { crearCompromiso } = await import('./cierre');
  const it = await itemParaCompromiso(ctx);
  if (!it) return { ok: false, dicho: 'esta llamada no está ligada a una ficha; agéndalo desde la agenda' };
  const tipoReunion = ['demo', 'seguimiento', 'cotizacion', 'llamada-discovery'].includes(String(params?.reunion_tipo))
    ? String(params.reunion_tipo) : (tipo === 'reunion' ? 'demo' : 'llamada-discovery');
  const r = await crearCompromiso(it, {
    tipo, fecha, hora,
    duracion_min: tipo === 'reunion' ? (tipoReunion === 'llamada-discovery' ? 15 : 60) : 15,
    motivo: params.motivo || 'lo pidió en la llamada',
    reunion_tipo: tipoReunion,
  }, ctx.userId || null);
  return r ? { ok: true, dicho: `quedó ${r}` } : { ok: false, dicho: 'no se pudo agendar (revisa que la fecha sea futura)' };
}

/** El item con la forma que esperan `crearCompromiso` y los envíos. */
async function itemParaCompromiso(ctx: Ctx) {
  if (ctx.itemId) {
    const { data } = await supabase.from('tel_sesion_items').select('*').eq('id', ctx.itemId).maybeSingle();
    if (data) return data;
  }
  return null;
}

const CATALOGO: Accion[] = [
  {
    id: 'mandar_cotizacion',
    etiqueta: 'Mandarle la cotización por WhatsApp',
    para: 'Pidió precios o una cotización.',
    auto: true,
    ejecutar: (ctx, p) => mandarMaterial(ctx, p?.tema || 'la cotización de Sacs', p?.detalle || 'lo pidió en la llamada'),
  },
  {
    id: 'mandar_material',
    etiqueta: 'Mandarle lo que pidió por WhatsApp',
    para: 'Pidió algo concreto: el catálogo, un video, el manual, el precio de algo.',
    auto: true,
    ejecutar: (ctx, p) => mandarMaterial(ctx, p?.tema || 'lo que pidió en la llamada', p?.detalle || 'lo pidió en la llamada'),
  },
  {
    id: 'quien_soy',
    etiqueta: 'Mandarle quién soy por WhatsApp',
    para: '«¿De dónde?» / «yo no me registré»: le llega tu nombre, Sacs, la liga y por qué le llamas.',
    auto: false,
    ejecutar: (ctx) => mandarQuienSoy(ctx),
  },
  {
    id: 'mandar_info',
    etiqueta: 'Mandarle la información por WhatsApp',
    para: 'El caso más común: «mándame la info».',
    auto: true,
    ejecutar: (ctx, p) => mandarMaterial(ctx, p?.tema || 'la información de Sacs', p?.detalle || 'lo pidió en la llamada'),
  },
  {
    id: 'volver_a_llamar',
    etiqueta: 'Volver a llamarle',
    para: 'Pidió que se le marque después, con día y hora.',
    auto: false,   // la hora hay que confirmarla: la voz se transcribe mal
    pide: (p) => [
      { campo: 'fecha', etiqueta: '¿Qué día?', tipo: 'fecha', valor: p?.fecha || '' },
      { campo: 'hora', etiqueta: '¿A qué hora?', tipo: 'hora', valor: p?.hora || '' },
    ],
    ejecutar: (ctx, p) => comprometer(ctx, 'llamada', p),
  },
  {
    id: 'agendar_demo',
    etiqueta: 'Agendarle la demostración',
    para: 'Quiere ver el sistema: se agenda con su hora real.',
    auto: false,
    pide: (p) => [
      { campo: 'fecha', etiqueta: '¿Qué día?', tipo: 'fecha', valor: p?.fecha || '' },
      { campo: 'hora', etiqueta: '¿A qué hora?', tipo: 'hora', valor: p?.hora || '' },
    ],
    /* `reunion_tipo` viene de la pantalla: demo o discovery. Son dos reuniones
       distintas de verdad —duración, guion y quién la toma— y elegirla al
       colgar es lo que evita agendar una demo a quien todavía no califica. */
    ejecutar: (ctx, p) => comprometer(ctx, 'reunion', p),
  },
  {
    id: 'ahorita_no',
    etiqueta: 'Recordármelo en un rato',
    para: 'Está manejando o en una junta: se le marca en un rato, sin gastar el intento.',
    auto: true,   // sólo crea un recordatorio interno: no toca al cliente
    ejecutar: async (ctx, p) => {
      const cuando = p?.cuando?.fecha && p?.cuando?.hora
        ? new Date(`${p.cuando.fecha}T${p.cuando.hora}:00`)
        : new Date(Date.now() + (Number(p?.minutos) || 15) * 60000);
      const { data } = await supabase.from('ti_tareas').insert({
        contact_id: ctx.contactId || null, owner_id: await duenoDe(ctx), familia: 'llamar', tipo: 'llamada',
        prioridad: 1, vence_at: cuando.toISOString(), origen: 'evento',
        payload: {
          de_llamada: true,
          instruccion: `${ctx.nombre || 'El contacto'}: volver a marcarle (no podía hablar)`,
          porque: 'En la llamada dijo que no era buen momento.', nombre: ctx.nombre, whatsapp: ctx.telefono,
        },
      }).select('id').maybeSingle();
      const h = cuando.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' });
      return data ? { ok: true, dicho: `te lo recuerdo a las ${h} en Mi día` } : { ok: false, dicho: 'no se pudo crear el recordatorio' };
    },
  },
  {
    id: 'soporte',
    etiqueta: 'Pasarlo a soporte',
    para: 'Ya es cliente y tiene un problema: no es venta.',
    auto: true,   // sólo crea la tarea interna
    ejecutar: async (ctx, p) => {
      const { data } = await supabase.from('ti_tareas').insert({
        contact_id: ctx.contactId || null, owner_id: await duenoDe(ctx), familia: 'soporte', tipo: 'responder',
        prioridad: 1, vence_at: ahora(), origen: 'evento',
        payload: {
          de_llamada: true,
          instruccion: `${ctx.nombre || 'El contacto'}: reportó un problema por teléfono`,
          porque: p?.detalle ? `Dijo: «${p.detalle}»` : 'Lo dijo en la llamada.', nombre: ctx.nombre, whatsapp: ctx.telefono,
        },
      }).select('id').maybeSingle();
      return data ? { ok: true, dicho: 'quedó en la bandeja de soporte, para hoy' } : { ok: false, dicho: 'no se pudo crear la tarea' };
    },
  },
  {
    id: 'otro_contacto',
    etiqueta: 'Apuntar a la otra persona',
    para: 'Manda con el socio, el dueño o quien decide.',
    auto: false,
    pide: (p) => [
      { campo: 'quien', etiqueta: '¿Quién es y cómo se llama?', tipo: 'texto', valor: p?.quien || '' },
      { campo: 'telefono_otro', etiqueta: 'Su teléfono (si lo dio)', tipo: 'texto', valor: p?.telefono_otro || '' },
    ],
    ejecutar: async (ctx, p) => {
      const quien = String(p?.quien || '').trim();
      if (!quien) return { ok: false, dicho: 'dime quién es para apuntarlo' };
      const texto = `👤 **La decisión no es suya**: ${quien}${p?.telefono_otro ? ` · ${p.telefono_otro}` : ''}\n\n${p?.detalle || ''}`.trim();
      if (ctx.conversationId) {
        await supabase.from('wa_notas').insert({
          conversation_id: ctx.conversationId, contact_id: ctx.contactId || null, autor: 'Llamada',
          texto, metadata: { tipo: 'nota_llamada', nota_llamada: ctx.callSid, autor_id: ctx.userId || null },
        }).then(() => {}, () => {});
      }
      await supabase.from('ti_tareas').insert({
        contact_id: ctx.contactId || null, owner_id: await duenoDe(ctx), familia: 'avanzar', tipo: 'responder',
        prioridad: 2, vence_at: ahora(), origen: 'evento',
        payload: { de_llamada: true, instruccion: `Buscar a ${quien} (decide por ${ctx.nombre || 'el contacto'})`, porque: 'Lo dijo en la llamada.', nombre: ctx.nombre, whatsapp: p?.telefono_otro || ctx.telefono },
      }).then(() => {}, () => {});
      return { ok: true, dicho: `apuntado en la ficha y en Mi día: hay que buscar a ${quien}` };
    },
  },
  {
    id: 'corregir_dato',
    etiqueta: 'Corregir sus datos',
    para: 'Dijo otro correo, otro teléfono o el nombre de su marca.',
    auto: false,   // la voz transcribe fatal los correos: se confirma a mano
    pide: (p) => [
      { campo: 'campo', etiqueta: '¿Qué dato? (email, empresa, ciudad, puesto, telefono…)', tipo: 'texto', valor: p?.campo || '' },
      { campo: 'valor', etiqueta: 'El valor correcto', tipo: 'texto', valor: p?.valor || '' },
    ],
    ejecutar: async (ctx, p) => {
      if (!ctx.contactId) return { ok: false, dicho: 'esta llamada no está ligada a una ficha' };
      const campo = sinAcentos(String(p?.campo || '')).trim(), valor = String(p?.valor || '').trim();
      if (!campo || !valor) return { ok: false, dicho: 'dime qué dato y con qué valor' };
      /* El teléfono NO es un campo de lead (no está en CAMPOS_LEAD): vive en la
         ficha y se cambia aparte. Todo lo demás pasa por `aplicarDatos`, que es
         quien decide si llena un hueco o pisa un dato existente. */
      if (/^(telefono|celular|whats|whatsapp|numero)$/.test(campo)) {
        const { telefonoWhatsApp } = await import('../telefono');
        const e164 = telefonoWhatsApp(valor);
        if (!e164) return { ok: false, dicho: `«${valor}» no es un teléfono válido` };
        await supabase.from('contacts').update({ telefono: e164, updated_at: ahora() }).eq('id', ctx.contactId);
        return { ok: true, dicho: `teléfono actualizado a ${e164} en su ficha` };
      }
      const { aplicarDatos, CAMPOS_LEAD } = await import('../crm/ti/datos-lead');
      if (!(CAMPOS_LEAD as readonly string[]).includes(campo)) {
        return { ok: false, dicho: `«${campo}» no es un campo de la ficha. Son: ${CAMPOS_LEAD.join(', ')}` };
      }
      const { cambios } = await aplicarDatos(ctx.contactId, [{ campo, valor, confianza: 1, evidencia: String(p?.detalle || 'lo dijo en la llamada').slice(0, 200), corrige: true }], { fuente: 'llamada', conversation_id: ctx.conversationId || null });
      return cambios?.length
        ? { ok: true, dicho: `${cambios.map((c: any) => c.campo).join(', ')} actualizado en su ficha` }
        : { ok: false, dicho: 'el dato quedó igual (ya lo tenía o la ficha no lo acepta)' };
    },
  },
  {
    id: 'no_llamar',
    etiqueta: 'Ya no llamarle nunca',
    para: 'Pidió que no se le vuelva a marcar: se descalifica y sale de todas las campañas.',
    auto: false,   // es para siempre: nunca por una frase mal oída
    ejecutar: async (ctx, p) => {
      if (!ctx.contactId) return { ok: false, dicho: 'esta llamada no está ligada a una ficha' };
      await supabase.from('contacts').update({ no_llamar: true, updated_at: ahora() }).eq('id', ctx.contactId);
      await supabase.from('activities').insert({
        contact_id: ctx.contactId, tipo: 'opt_out', titulo: 'Pidió que no se le llame (en la llamada)',
        descripcion: p?.evidencia || null, automatico: true, metadata: { regla: 'accion_llamada', actor: 'vendedor', call_sid: ctx.callSid },
      }).then(() => {}, () => {});
      let salidas = 'las campañas';
      try {
        const { aplicarRechazo } = await import('../crm/ti/agente');
        await aplicarRechazo(ctx.contactId, `lo pidió en la llamada${p?.evidencia ? `: «${String(p.evidencia).slice(0, 100)}»` : ''}`);
        salidas = 'cadencias y secuencias';
      } catch { /* la marca de no_llamar ya quedó, que es lo que no puede fallar */ }
      return { ok: true, dicho: `no se le vuelve a llamar; se descalificó y salió de ${salidas}` };
    },
  },
];

export const catalogo = () => CATALOGO.map(a => ({ id: a.id, etiqueta: a.etiqueta, para: a.para, auto: a.auto }));
const porId = (id: string) => CATALOGO.find(a => a.id === id) || null;

/* ════════════════════════════════════════════════════════════════════════
   OÍR · de una frase a una acción.
   ════════════════════════════════════════════════════════════════════════ */

type ReglaExtra = { accion: string; re: RegExp; id: string };
let cacheReglas: { t: number; reglas: ReglaExtra[] } = { t: 0, reglas: [] };
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Las reglas que se aprendieron (dictadas por quien colgó). Caché de 60 s:
 *  esto corre dentro del webhook de transcripción, varias veces por minuto. */
export async function reglasAprendidasAcciones(): Promise<ReglaExtra[]> {
  if (Date.now() - cacheReglas.t < 60000) return cacheReglas.reglas;
  const { data } = await supabase.from('tel_accion_reglas').select('id, accion, patron').eq('estado', 'activa').limit(300);
  const reglas: ReglaExtra[] = [];
  for (const f of data || []) {
    const patron = sinAcentos(f.patron).trim();
    if (!patron || !porId(f.accion)) continue;
    try { reglas.push({ accion: f.accion, id: f.id, re: new RegExp(escapeRe(patron).replace(/\s+/g, '\\s+')) }); } catch { /* patrón inválido */ }
  }
  cacheReglas = { t: Date.now(), reglas };
  return reglas;
}

/** Qué acciones pide esta frase: las del catálogo (`acciones-frases.ts`, con
 *  prueba propia) más las que se aprendieron de oído. Vacío casi siempre, y
 *  eso está bien: la mayoría de lo que se dice en una llamada no pide nada. */
export async function detectar(fraseCruda: string): Promise<Detectada[]> {
  const salida = detectarCatalogo(fraseCruda);
  const frase = sinAcentos(fraseCruda);
  if (frase.trim().length < 6) return salida;
  for (const r of await reglasAprendidasAcciones()) {
    if (salida.some(s => s.accion === r.accion)) continue;
    if (r.re.test(frase)) {
      salida.push({ accion: r.accion, frase: fraseCruda.slice(0, 300), origen: 'aprendida', confianza: 0.7, params: LEER[r.accion as AccionId]?.(fraseCruda) || {}, regla_id: r.id });
    }
  }
  return salida;
}

/* ════════════════════════════════════════════════════════════════════════
   ANOTAR Y HACER
   ════════════════════════════════════════════════════════════════════════ */

/** Anota lo detectado en la llamada (una vez por acción y llamada) y ejecuta
 *  las que salen solas. Nunca lanza: corre dentro de un webhook de Twilio. */
export async function anotarYHacer(ctx: Ctx, detectadas: Detectada[]): Promise<void> {
  for (const d of detectadas) {
    try {
      const a = porId(d.accion);
      if (!a) continue;
      const { data: fila } = await supabase.from('tel_acciones').insert({
        call_sid: ctx.callSid, item_id: ctx.itemId || null, contact_id: ctx.contactId || null,
        conversation_id: ctx.conversationId || null, telefono: ctx.telefono,
        accion: d.accion, params: d.params || {}, frase: d.frase,
        origen: d.origen, confianza: d.confianza,
        estado: 'propuesta', user_id: ctx.userId || null,
      }).select('id').maybeSingle();
      if (!fila) continue;   // el índice único dice que ya se había propuesto
      /* ══ LO QUE ENSEÑASTE, ¿SIRVE? ════════════════════════════════════════
         Se cuenta cada vez que una regla aprendida caza de verdad. Sin esta
         cuenta, en Configuración todas las frases se ven iguales y no hay forma
         de saber cuál está trabajando y cuál se enseñó una vez y nunca volvió a
         pasar. Es la mitad que faltaba del ciclo: enseñar, y ver si sirvió. */
      if (d.regla_id) {
        const { data: r0 } = await supabase.from('tel_accion_reglas').select('veces').eq('id', d.regla_id).maybeSingle();
        await supabase.from('tel_accion_reglas').update({ veces: Number(r0?.veces || 0) + 1, updated_at: ahora() }).eq('id', d.regla_id);
      }
      /* AUTO. Sólo las seguras (ver decisión 2), sólo si la cazó una regla del
         catálogo —nunca una aprendida de oído— y sólo si no le falta un dato. */
      const completa = !a.pide || !a.pide(d.params).some(c => !c.valor);
      if (a.auto && d.origen === 'regla' && completa) await ejecutar(fila.id, { userId: ctx.userId || null, auto: true });
    } catch { /* una acción que falla no puede tumbar la transcripción */ }
  }
}

/** Ejecuta una acción anotada y deja escrito QUÉ pasó. */
export async function ejecutar(accionId: string, o: { userId?: string | null; params?: any; auto?: boolean } = {}): Promise<{ ok: boolean; dicho: string; estado: string }> {
  // Candado: dos pestañas (o el auto y un clic) no la hacen dos veces.
  const { data: fila } = await supabase.from('tel_acciones')
    .update({ estado: 'haciendo', updated_at: ahora() })
    .eq('id', accionId).in('estado', ['propuesta', 'pregunta', 'fallo']).select('*').maybeSingle();
  if (!fila) {
    const { data: ya } = await supabase.from('tel_acciones').select('estado, resultado, updated_at').eq('id', accionId).maybeSingle();
    /* UN CANDADO QUE NO SE ABRE ES UNA ACCIÓN PERDIDA. Si la función murió en
       plena ejecución, la acción se queda en «haciendo» y el botón contestaría
       para siempre «ya se hizo» — cuando no se hizo. Pasado un minuto se
       considera muerta y se puede reintentar. */
    const colgada = ya?.estado === 'haciendo' && Date.now() - new Date(ya.updated_at || 0).getTime() > 60000;
    if (colgada) {
      const { data: suelta } = await supabase.from('tel_acciones').update({ estado: 'propuesta', updated_at: ahora() })
        .eq('id', accionId).eq('estado', 'haciendo').select('id').maybeSingle();
      if (suelta) return ejecutar(accionId, o);
    }
    return { ok: ya?.estado === 'hecha', dicho: ya?.resultado || (ya?.estado === 'haciendo' ? 'esa acción va en camino' : 'esa acción ya se hizo'), estado: ya?.estado || 'desconocido' };
  }
  const a = porId(fila.accion);
  if (!a) {
    await supabase.from('tel_acciones').update({ estado: 'fallo', resultado: 'esa acción ya no existe', updated_at: ahora() }).eq('id', accionId);
    return { ok: false, dicho: 'esa acción ya no existe', estado: 'fallo' };
  }
  const params = { ...(fila.params || {}), ...(o.params || {}) };
  const ctx: Ctx = {
    callSid: fila.call_sid, itemId: fila.item_id, contactId: fila.contact_id, conversationId: fila.conversation_id,
    telefono: fila.telefono, userId: o.userId || fila.user_id || null, nombre: await nombreDe(fila.contact_id),
  };
  let r: { ok: boolean; dicho: string; params?: any };
  try { r = await a.ejecutar(ctx, params); }
  catch (e: any) { r = { ok: false, dicho: String(e?.message || e).slice(0, 200) }; }
  /* NO SABER QUÉ MANDAR NO ES UN FALLO, ES UNA PREGUNTA. Pintarlo en rojo
     junto a los errores hacía que lo único que hay que hacer —escribir una
     línea— se viera como algo roto que alguien más va a arreglar. */
  const estado = r.ok ? 'hecha' : r.params?.pide_texto ? 'pregunta' : 'fallo';
  await supabase.from('tel_acciones').update({
    estado, resultado: r.dicho.slice(0, 400), params: { ...params, ...(r.params || {}) },
    user_id: o.userId || fila.user_id || null, updated_at: ahora(),
  }).eq('id', accionId);
  return { ok: r.ok, dicho: r.dicho, estado };
}

/** El dueño de lo que se cree (tareas, reunión). Si la llamada no dijo quién
 *  atendía —pasa en las entrantes hasta que alguien abre la sala—, se cae al
 *  dueño de la sesión de llamadas sueltas. Una tarea sin dueño no la ve nadie. */
async function duenoDe(ctx: Ctx): Promise<string | null> {
  if (ctx.userId) return ctx.userId;
  if (!ctx.itemId) return null;
  const { data } = await supabase.from('tel_sesion_items').select('tel_sesiones(owner_id)').eq('id', ctx.itemId).maybeSingle();
  return (data as any)?.tel_sesiones?.owner_id || null;
}

async function nombreDe(contactId: string | null): Promise<string | null> {
  if (!contactId) return null;
  const { data } = await supabase.from('contacts').select('nombre, apellido').eq('id', contactId).maybeSingle();
  return data ? [data.nombre, data.apellido].filter(Boolean).join(' ') || null : null;
}

/* ════════════════════════════════════════════════════════════════════════
   APRENDER · «si no reconoces qué acción hacer, que yo te explique».
   ════════════════════════════════════════════════════════════════════════ */

/** Quien colgó dicta lo que había que hacer. Se ejecuta ahora y se aprende
 *  para la próxima. Si lo dictado no corresponde a ninguna acción del
 *  catálogo, se manda por WhatsApp como material —que es lo que el 90% de los
 *  dictados son— y se dice claramente que eso fue lo que se entendió. */
export async function dictar(ctx: Ctx, texto: string, o: { userId?: string | null; frase?: string | null } = {}): Promise<{ ok: boolean; dicho: string; accion: string; accion_id: string | null }> {
  const dicho = String(texto || '').trim();
  if (dicho.length < 4) return { ok: false, dicho: 'escribe qué había que hacer', accion: '', accion_id: null };

  // 1. ¿Lo dictado corresponde a una acción conocida? Se lee con las MISMAS
  //    reglas: si «mándale la cotización» la caza el catálogo, se hace esa.
  const encontradas = await detectar(dicho);
  const elegida = encontradas[0] || null;
  const accionId = elegida?.accion || 'mandar_material';
  const a = porId(accionId)!;
  const params = elegida?.params || { tema: dicho.slice(0, 120), detalle: dicho.slice(0, 300) };

  /* 1 bis · LA REGLA QUE SE VA A APRENDER, decidida ANTES de guardar la acción
     para poder enseñarla en la pantalla tal cual queda. Se aprenden las
     primeras seis palabras de lo que dijo EL CLIENTE: una frase entera nunca
     se repite igual, y media frase caza cualquier cosa. */
  const aprender = sinAcentos(String(o.frase || '')).replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const patron = aprender.length >= 10 ? aprender.split(' ').slice(0, 6).join(' ') : null;

  const { data: fila } = await supabase.from('tel_acciones').insert({
    call_sid: ctx.callSid, item_id: ctx.itemId || null, contact_id: ctx.contactId || null,
    conversation_id: ctx.conversationId || null, telefono: ctx.telefono,
    /* La frase que se enseña es LO QUE SE DICTÓ («mándale el PDF de precios»),
       no lo que dijo el cliente: eso otro viaja en `params.aprendido_de`, que es
       de dónde sale la regla. Pintar la del cliente aquí hacía que la acción
       pareciera disparada por una frase que no tenía nada que ver. */
    accion: accionId, params: { ...params, aprendido_de: patron }, frase: dicho.slice(0, 300), origen: 'dictada', confianza: 1,
    estado: 'propuesta', user_id: o.userId || ctx.userId || null,
  }).select('id').maybeSingle();

  /* 2. LA REGLA NUEVA. Lo que se aprende es la frase DEL CLIENTE que nadie
        cazó (`o.frase`), no lo que escribió el vendedor: la próxima vez quien
        va a hablar es el cliente. Sin frase del cliente no hay nada que
        aprender y sólo se hace la acción. */
  if (patron) {
    await supabase.from('tel_accion_reglas').upsert({
      accion: accionId, patron, origen: 'vendedor', estado: 'activa',
      ejemplo: String(o.frase).slice(0, 300), call_sid: ctx.callSid, updated_at: ahora(),
    }, { onConflict: 'accion,patron' }).then(() => {}, () => {});
    cacheReglas = { t: 0, reglas: [] };
  }

  /* Ya estaba anotada en esta llamada (el índice único). Dictarla otra vez no
     es un error: es «hazla». Se ejecuta la que ya existe con lo que se acaba
     de dictar, en vez de contestar que no se puede. */
  if (!fila) {
    const { data: previa } = await supabase.from('tel_acciones').select('id, estado').eq('call_sid', ctx.callSid).eq('accion', accionId).maybeSingle();
    if (!previa) return { ok: false, dicho: 'no se pudo anotar la acción', accion: a.etiqueta, accion_id: null };
    if (previa.estado === 'hecha') return { ok: true, dicho: 'eso ya se hizo en esta llamada', accion: a.etiqueta, accion_id: previa.id };
    const r0 = await ejecutar(previa.id, { userId: o.userId || ctx.userId || null, params });
    return { ok: r0.ok, dicho: r0.dicho, accion: a.etiqueta, accion_id: previa.id };
  }
  // 3. Se hace YA: el dictado es una orden, no una propuesta.
  const r = await ejecutar(fila.id, { userId: o.userId || ctx.userId || null, params });
  return { ok: r.ok, dicho: r.dicho, accion: a.etiqueta, accion_id: fila.id };
}

/** Lo anotado en una llamada, con lo que le falta a cada una para poder salir. */
export async function deLaLlamada(callSid: string) {
  const { data } = await supabase.from('tel_acciones').select('*').eq('call_sid', callSid).order('created_at');
  return (data || []).map(f => {
    const a = porId(f.accion);
    return {
      id: f.id, accion: f.accion, etiqueta: a?.etiqueta || f.accion, auto: !!a?.auto,
      frase: f.frase, aprendido_de: (f.params || {}).aprendido_de || null,
      origen: f.origen, estado: f.estado, resultado: f.resultado,
      params: f.params || {}, pide: a?.pide ? a.pide(f.params || {}) : [],
      pide_texto: !!(f.params || {}).pide_texto, envio_id: (f.params || {}).envio_id || null,
      created_at: f.created_at,
    };
  });
}
