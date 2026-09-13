// Las conversaciones que pasaron FUERA del CRM, en la ficha del cliente.
//
// El reparto del trabajo es el punto de todo este archivo:
//   · el CHAT se lee aquí, sin IA → conteos, fechas y participantes son DATO;
//   · la IA solo REDACTA → resumen, acuerdos y lo que pidió.
// Pedirle los números a un modelo sería pagar por que adivine algo que ya
// viene escrito, y ese número termina siendo la evidencia con la que se decide
// si una cuenta conserva su tasa.
//
// GET    ?company_id=       → las capturadas de esa cuenta
// POST   accion=analizar    → lee el chat y redacta el borrador. NO guarda.
// POST   accion=guardar     → guarda el RESUMEN y crea las actividades
// POST   accion=gestion     → un acuerdo se vuelve gestión en Consultoría
// DELETE ?id=               → borra la capturada y sus actividades
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { pedirJSON } from '../../../lib/ia';
import { leerChat, paraElModelo } from '../../../lib/crm/chat-whatsapp';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
const hoy = () => new Date().toISOString().slice(0, 10);

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const companyId = String(url.searchParams.get('company_id') || '');
  if (!UUID.test(companyId)) return json({ error: 'Falta la cuenta.' }, 400);

  const { data, error } = await supabase.from('conversaciones_capturadas')
    .select('*').eq('company_id', companyId)
    .order('hasta', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false }).limit(60);
  if (error) return json({ error: error.message }, 500);
  return json({ conversaciones: data || [] });
};

const SISTEMA = `Eres el asistente de una consultora de software para retail (Sacs).
Recibes una conversación de WhatsApp o la descripción de una llamada con un CLIENTE y devuelves JSON.

Reglas que no se rompen:
- NO inventes fechas ni cantidades. El campo "fecha" SOLO se llena si en el texto hay una fecha
  explícita ("el lunes 15 de septiembre", "el 3 de octubre"). Una referencia vaga —"antes del
  Buen Fin", "la próxima semana", "a fin de mes"— NO es una fecha: deja "fecha" vacío y menciona
  esa referencia dentro del resumen del acuerdo. Poner una fecha calculada la convierte en un
  compromiso con día que nadie pactó.
- Escribe como habla la consultora con su cliente en México: claro, directo, sin relleno.
- Un ACUERDO es algo que alguien se comprometió a hacer. Una duda o un comentario no es un acuerdo.
- El resumen de cada acuerdo tiene que servirle a quien lo va a EJECUTAR sin haber leído el chat:
  qué hay que hacer y para qué, en una o dos frases completas.

Devuelve exactamente:
{
  "titulo": "de qué se trató, máximo 60 caracteres",
  "resumen": "2 a 3 frases: qué pasó y en qué quedó",
  "acuerdos": [{ "texto": "qué se acordó, en una línea",
                 "resumen": "qué hay que hacer y para qué, para quien lo va a ejecutar",
                 "quien": "sacs" | "cliente",
                 "fecha": "YYYY-MM-DD o vacío si no se dijo" }],
  "pidio": [{ "titulo": "lo que pidió, corto", "descripcion": "en una línea que el cliente entienda" }],
  "tono": "bien" | "neutral" | "molesto" | "en espera"
}`;

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const accion = String(b?.accion || '');
  const quien = (user as any)?.nombre || (user as any)?.email || 'CRM';

  // ── ANALIZAR: leer el chat y redactar. No toca la base. ──────────────────
  if (accion === 'analizar') {
    const texto = String(b?.texto || '').trim();
    if (texto.length < 20) return json({ error: 'Pega la conversación o cuenta qué pasó — con una línea no alcanza.' }, 400);

    const lectura = leerChat(texto);
    /* Sin marcas de tiempo no es un export: es un texto escrito a mano. Se
       acepta igual —una llamada se cuenta así— pero entonces la fecha la pone
       la persona, no se inventa. */
    const esChat = lectura.total > 0;
    const fechaManual = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.fecha || '')) ? String(b.fecha) : null;
    if (!esChat && !fechaManual) {
      return json({ error: 'Ese texto no trae fechas de WhatsApp, así que dime tú de qué día fue.', pide_fecha: true }, 400);
    }

    let ia: any = null; let iaError: string | null = null;
    try {
      ia = await pedirJSON({
        system: SISTEMA,
        user: esChat
          ? `Conversación de WhatsApp del ${lectura.desde} al ${lectura.hasta}:\n\n${paraElModelo(lectura)}`
          : `Notas de una conversación del ${fechaManual}:\n\n${texto.slice(0, 12000)}`,
      });
    } catch (e: any) { iaError = e?.message || String(e); }

    return json({
      ok: true,
      // Lo medido, que no depende de que la IA haya contestado.
      medido: {
        es_chat: esChat,
        mensajes: lectura.total,
        desde: esChat ? lectura.desde : fechaManual,
        hasta: esChat ? lectura.hasta : fechaManual,
        dias: lectura.dias,
        participantes: lectura.participantes,
        /* Cuántos mensajes puso cada quien cada día. Es lo único del chat que
           vuelve al navegador —fecha, autor y cuenta, nunca el texto—, y hace
           falta ahí porque el lado de cada autor lo decide la persona al
           marcar quién es del cliente. Sin esto habría que volver a mandar el
           chat entero al servidor para guardar. */
        dias_por_autor: (() => {
          const m = new Map<string, { fecha: string; autor: string; n: number }>();
          for (const x of lectura.mensajes) {
            const k = `${x.fecha}|${x.autor}`;
            const r = m.get(k) || { fecha: x.fecha, autor: x.autor, n: 0 };
            r.n++; m.set(k, r);
          }
          return [...m.values()];
        })(),
        ignorados: lectura.ignorados,
      },
      // Lo redactado. Si la IA falló, se devuelve vacío y la persona escribe:
      // un borrador en blanco sirve; uno inventado cuesta la cuenta.
      borrador: {
        titulo: ia?.titulo || '',
        resumen: ia?.resumen || '',
        acuerdos: Array.isArray(ia?.acuerdos) ? ia.acuerdos : [],
        pidio: Array.isArray(ia?.pidio) ? ia.pidio : [],
        tono: ia?.tono || 'neutral',
      },
      ia_error: iaError,
    });
  }

  // ── GUARDAR: el resumen y las actividades con su fecha REAL ──────────────
  if (accion === 'guardar') {
    const companyId = String(b?.company_id || '');
    if (!UUID.test(companyId)) return json({ error: 'Falta la cuenta.' }, 400);
    const resumen = String(b?.resumen || '').trim();
    if (!resumen) return json({ error: 'Falta el resumen: es lo único que se guarda.' }, 400);

    const canal = ['whatsapp', 'llamada', 'otro'].includes(String(b?.canal)) ? String(b.canal) : 'whatsapp';
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.desde || '')) ? String(b.desde) : hoy();
    const hasta = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.hasta || '')) ? String(b.hasta) : desde;
    /* El desglose por día y lado viene del cliente porque allá está el chat:
       aquí solo se guarda el RESUMEN, así que el texto ya no vuelve a pasar
       por el servidor. Se valida que sean fechas y números de verdad. */
    const dias: { fecha: string; lado: string; n: number }[] = Array.isArray(b?.dias)
      ? b.dias.filter((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(d?.fecha)) && Number(d?.n) > 0)
        .map((d: any) => ({ fecha: String(d.fecha), lado: d.lado === 'cliente' ? 'cliente' : 'nosotros', n: Math.min(5000, Math.round(Number(d.n))) }))
      : [];

    const delCliente = dias.filter(d => d.lado === 'cliente').reduce((a, d) => a + d.n, 0);
    const nuestros = dias.filter(d => d.lado === 'nosotros').reduce((a, d) => a + d.n, 0);

    const { data: conv, error } = await supabase.from('conversaciones_capturadas').insert({
      company_id: companyId, contact_id: UUID.test(String(b?.contact_id || '')) ? b.contact_id : null,
      canal, titulo: String(b?.titulo || '').slice(0, 160) || null, resumen,
      acuerdos: Array.isArray(b?.acuerdos) ? b.acuerdos : [],
      pidio: Array.isArray(b?.pidio) ? b.pidio : [],
      tono: String(b?.tono || '').slice(0, 20) || null,
      desde, hasta,
      mensajes: delCliente + nuestros,
      del_cliente: delCliente, nuestros,
      participantes: Array.isArray(b?.participantes) ? b.participantes.slice(0, 30) : [],
      minutos: Number(b?.minutos) > 0 ? Math.round(Number(b.minutos)) : null,
      creado_por: quien,
    }).select('*').single();
    if (error) return json({ error: error.message }, 500);

    /* Las actividades, con la FECHA REAL. Es lo que hace que la cuenta deje de
       verse sin seguimiento y que la evidencia de Renovación diga «contestó el
       11 de septiembre» en vez de «hoy». `created_at` se escribe a propósito:
       sin eso, una conversación de agosto entraría fechada hoy. */
    const filas = (dias.length ? dias : [{ fecha: hasta, lado: 'nosotros', n: 1 }]).map(d => ({
      company_id: companyId,
      contact_id: UUID.test(String(b?.contact_id || '')) ? b.contact_id : null,
      tipo: d.lado === 'cliente' ? 'whatsapp_recibido' : 'whatsapp_enviado',
      titulo: `${d.lado === 'cliente' ? 'Escribió el cliente' : 'Le escribimos'} · ${d.n} mensaje${d.n === 1 ? '' : 's'}`,
      automatico: false,
      created_at: new Date(d.fecha + 'T12:00:00Z').toISOString(),
      metadata: { origen: 'capturado', conversacion_id: conv.id, mensajes: d.n, canal, quien },
    }));
    // Y la del resumen, para que en el timeline se lea qué pasó, no solo que pasó.
    filas.push({
      company_id: companyId,
      contact_id: UUID.test(String(b?.contact_id || '')) ? b.contact_id : null,
      tipo: canal === 'llamada' ? 'llamada' : 'nota',
      titulo: (conv.titulo || 'Conversación registrada') + ' — ' + resumen.slice(0, 240),
      automatico: false,
      created_at: new Date(hasta + 'T12:00:00Z').toISOString(),
      metadata: { origen: 'capturado', conversacion_id: conv.id, canal, quien },
    } as any);
    await supabase.from('activities').insert(filas);

    return json({ ok: true, conversacion: conv, actividades: filas.length });
  }

  // ── GESTIÓN: un acuerdo se vuelve trabajo, con su propio resumen ─────────
  if (accion === 'gestion') {
    const convId = String(b?.conversacion_id || '');
    const i = Number(b?.indice);
    if (!UUID.test(convId) || !Number.isInteger(i) || i < 0) return json({ error: 'Falta el acuerdo.' }, 400);

    const { data: conv } = await supabase.from('conversaciones_capturadas').select('*').eq('id', convId).maybeSingle();
    if (!conv) return json({ error: 'Esa conversación ya no existe.' }, 404);
    const lista = Array.isArray(conv.acuerdos) ? [...conv.acuerdos] : [];
    const ac = lista[i];
    if (!ac) return json({ error: 'Ese acuerdo ya no está.' }, 404);
    if (ac.gestion_id) return json({ error: 'Ese acuerdo ya tiene su gestión.' }, 409);

    /* Nace como COMPROMISO, no como idea: alguien ya dijo que lo iba a hacer.
       El resumen del acuerdo es la descripción — es lo que pidió el dueño:
       que lo que se manda a la gestión diga QUÉ hay que hacer, no «lo del
       chat». Y va como pendiente: si resulta cobrable, se cotiza desde ahí. */
    const { data: mej, error: eM } = await supabase.from('mejoras').insert({
      company_id: conv.company_id,
      titulo: String(ac.texto || 'Acuerdo').slice(0, 200),
      descripcion: String(ac.resumen || ac.texto || '').slice(0, 2000),
      estado: 'en_proceso', categoria: 'pendiente',
      origen: conv.canal === 'llamada' ? 'llamada' : 'whatsapp',
      fecha_compromiso: /^\d{4}-\d{2}-\d{2}$/.test(String(ac.fecha || '')) ? ac.fecha : null,
      visible_cliente: true, creado_por: quien,
    }).select('id, titulo').single();
    if (eM) return json({ error: eM.message }, 500);

    lista[i] = { ...ac, gestion_id: mej.id };
    await supabase.from('conversaciones_capturadas')
      .update({ acuerdos: lista, updated_at: new Date().toISOString() }).eq('id', convId);

    return json({ ok: true, mejora: mej, acuerdos: lista });
  }

  return json({ error: 'Acción desconocida: analizar | guardar | gestion' }, 400);
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const id = String(url.searchParams.get('id') || '');
  if (!UUID.test(id)) return json({ error: 'Falta la conversación.' }, 400);
  // Las actividades se van con ella: si se borra el registro y quedan los
  // renglones, la cuenta seguiría contando un seguimiento que ya no existe.
  await supabase.from('activities').delete().filter('metadata->>conversacion_id', 'eq', id);
  const { error } = await supabase.from('conversaciones_capturadas').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
