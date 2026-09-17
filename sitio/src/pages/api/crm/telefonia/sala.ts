// LA SALA DE LA LLAMADA · lo que pasa mientras hablas, y lo que pasa al colgar.
//
// Una sola puerta para la pantalla de la llamada (SalaLlamada.tsx):
//
//   GET  ?call_id=CA…            → lo oído, las acciones que pidió y el cierre
//   POST {accion:'hacer'}        → ejecuta una acción y devuelve QUÉ pasó
//   POST {accion:'descartar'}    → no era eso
//   POST {accion:'dictar'}       → «lo que había que hacer era…» (y lo aprende)
//   POST {accion:'responder'}    → qué mandarle cuando no sabíamos (y lo guarda)
//   POST {accion:'agregar'}      → una acción del catálogo, a mano
//   POST {accion:'cerrar'}       → cuelga: cierra el item y pide el cierre con IA
//   POST {accion:'aplicar'}      → confirma el cierre propuesto
//
// POR QUÉ TODO JUNTO: es UNA pantalla que se abre en el segundo en que alguien
// contesta y se cierra cuando cuelga. Repartirlo en seis endpoints daría seis
// sesiones que validar y seis formas de que la pantalla quede a medias.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { itemDeLlamada, cerrarLlamadaSuelta } from '../../../../lib/telefonia/suelta';
import { deLaLlamada, ejecutar, dictar, catalogo, type Ctx } from '../../../../lib/telefonia/acciones';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const ES_SID = (s: string) => /^CA[0-9a-f]{32}$/i.test(s);

/** El contexto de la llamada para las acciones, creando el item si hace falta. */
async function contexto(callSid: string, user: any): Promise<Ctx | null> {
  const it = await itemDeLlamada(callSid, { userId: user?.id || null, nombreUsuario: user?.nombre || user?.name || null });
  if (!it) return null;
  return {
    callSid, itemId: it.id, contactId: it.contact_id, conversationId: it.conversation_id,
    telefono: it.telefono, nombre: it.nombre, userId: user?.id || null,
  };
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const callSid = String(url.searchParams.get('call_id') || '');
  if (!ES_SID(callSid)) return json({ error: 'call_id inválido' }, 400);

  const ctx = await contexto(callSid, user);
  if (!ctx) return json({ hay: false, acciones: [], oido: [] });

  const { data: it } = await supabase.from('tel_sesion_items')
    .select('oido, estado, cierre_estado, cierre_ia, resultado, nota, duracion_seg').eq('id', ctx.itemId!).maybeSingle();
  const oido: any[] = Array.isArray(it?.oido) ? (it!.oido as any) : [];

  return json({
    hay: true, item_id: ctx.itemId,
    /* Lo que se oyó, en orden y sin parciales: el vendedor tiene que poder
       comprobar de un vistazo que la máquina está oyendo lo mismo que él. */
    oido: oido.filter(o => o.final).slice(-40).map(o => ({ quien: o.quien || 'contacto', texto: o.texto, t: o.t })),
    escuchando: oido.length > 0,
    acciones: await deLaLlamada(callSid),
    catalogo: catalogo(),
    cierre: { estado: it?.cierre_estado || null, propuesta: (it?.cierre_ia as any)?.propuesta || null, hecho: (it?.cierre_ia as any)?.hecho || null, motivo: (it?.cierre_ia as any)?.motivo || null },
    llamada: { estado: it?.estado || null, resultado: it?.resultado || null, duracion_seg: it?.duracion_seg || null },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const accion = String(b.accion || '');
  const callSid = String(b.call_id || '');

  // ── Ejecutar / descartar lo ya anotado ────────────────────────────────────
  if (accion === 'hacer' || accion === 'descartar') {
    const id = String(b.accion_id || '');
    const { data: fila } = await supabase.from('tel_acciones').select('id, call_sid').eq('id', id).maybeSingle();
    if (!fila) return json({ error: 'Esa acción ya no existe' }, 404);
    if (accion === 'descartar') {
      await supabase.from('tel_acciones').update({ estado: 'descartada', resultado: 'no era eso', updated_at: new Date().toISOString() }).eq('id', id);
      return json({ ok: true, acciones: await deLaLlamada(fila.call_sid) });
    }
    const r = await ejecutar(id, { userId: user.id, params: b.params || {} });
    return json({ ...r, acciones: await deLaLlamada(fila.call_sid) });
  }

  if (!ES_SID(callSid)) return json({ error: 'call_id inválido' }, 400);
  const ctx = await contexto(callSid, user);
  if (!ctx) return json({ error: 'Esta llamada no está en el CRM todavía' }, 404);

  // ── «Lo que había que hacer era…»: se hace y se aprende ───────────────────
  if (accion === 'dictar') {
    const r = await dictar(ctx, String(b.texto || ''), { userId: user.id, frase: b.frase || null });
    return json({ ...r, acciones: await deLaLlamada(callSid) });
  }

  // ── No sabíamos qué mandarle: el vendedor lo escribe, sale y queda guardado ─
  if (accion === 'responder') {
    const { responderEnvio } = await import('../../../../lib/telefonia/cierre');
    const r = await responderEnvio(String(b.envio_id || ''), String(b.texto || ''), { userId: user.id, autor: (user as any).nombre || null });
    if (r.ok && b.accion_id) {
      await supabase.from('tel_acciones').update({ estado: 'hecha', resultado: r.motivo.slice(0, 400), updated_at: new Date().toISOString() }).eq('id', String(b.accion_id));
    }
    return json({ ...r, dicho: r.motivo, acciones: await deLaLlamada(callSid) });
  }

  // ── Una acción del catálogo, elegida a mano (sin esperar a que se oiga) ────
  if (accion === 'agregar') {
    const cual = String(b.cual || '');
    if (!catalogo().some(c => c.id === cual)) return json({ error: 'Esa acción no existe' }, 400);
    const { data: fila, error } = await supabase.from('tel_acciones').insert({
      call_sid: callSid, item_id: ctx.itemId, contact_id: ctx.contactId, conversation_id: ctx.conversationId,
      telefono: ctx.telefono, accion: cual, params: b.params || {}, frase: b.frase || 'lo elegiste tú',
      origen: 'manual', confianza: 1, estado: 'propuesta', user_id: user.id,
    }).select('id').maybeSingle();
    // El índice único: esa acción ya estaba en esta llamada, y eso no es un error.
    if (error && !fila) return json({ ok: true, ya: true, acciones: await deLaLlamada(callSid) });
    return json({ ok: true, accion_id: fila?.id || null, acciones: await deLaLlamada(callSid) });
  }

  // ── Colgó: se cierra el item y se pide el cierre con IA ───────────────────
  if (accion === 'cerrar') {
    const r = await cerrarLlamadaSuelta(callSid, { userId: user.id, resultado: b.resultado || null, nota: b.nota || null });
    if (!r.itemId) return json({ ok: false, error: 'no se pudo cerrar la llamada' });
    /* Se ESPERA a la propuesta (tiene tope propio de 20 s) en vez de contestar
       y dejarla corriendo: en serverless lo que no se espera se mata a medias,
       y un cierre a medias es justo lo que hay que rescatar después. */
    let propuesta: any = null, motivo: string | null = null;
    try {
      const { proponerCierre } = await import('../../../../lib/telefonia/cierre');
      propuesta = await proponerCierre(r.itemId);
    } catch (e: any) { motivo = String(e?.message || e).slice(0, 200); }
    const { data: it } = await supabase.from('tel_sesion_items').select('cierre_estado, cierre_ia').eq('id', r.itemId).maybeSingle();
    return json({
      ok: true, item_id: r.itemId,
      cierre: { estado: it?.cierre_estado || null, propuesta: propuesta || (it?.cierre_ia as any)?.propuesta || null, motivo: motivo || (it?.cierre_ia as any)?.motivo || null },
      acciones: await deLaLlamada(callSid),
    });
  }

  // ── Confirmar el cierre propuesto ────────────────────────────────────────
  if (accion === 'aplicar') {
    const { aplicarCierre } = await import('../../../../lib/telefonia/cierre');
    const r = await aplicarCierre(String(b.item_id || ctx.itemId), {
      userId: user.id, autor: (user as any).nombre || null,
      ajustes: { resultado: b.resultado || undefined, nota: b.nota || undefined },
    });
    return json({ ...r, acciones: await deLaLlamada(callSid) });
  }

  return json({ error: 'Acción desconocida' }, 400);
};
