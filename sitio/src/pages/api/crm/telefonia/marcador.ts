// LLAMADAS INTELIGENTES · La API de la cabina (con sesión del CRM).
//
// GET  ?id=<sesión>            → estado vivo (y el latido: cierra huecos de tiempo)
// GET  ?id=<sesión>&items=1    → la lista completa con su estado
// GET  ?lista=1                → mis sesiones recientes
// POST { accion, ... }         → crear · iniciar · pausar · reanudar · siguiente ·
//                                saltar · colgar · tomar · resultado · nota ·
//                                excluir · incluir · terminar · relanzar · presentacion
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { twilioRest, telefoniaConfigurada, telefoniaFaltantes } from '../../../../lib/telefonia/twilio';
import {
  crearSesion, iniciarSesion, pausarSesion, terminarSesion, siguiente, saltar, tomar, latir, estadoSesion, listarItems, compromisosDeSesion, relanzar, recontar, getSesion,
} from '../../../../lib/telefonia/marcador';
import { aplicarCierre, responderEnvio, omitirEnvio, proponerCierre, RESULTADOS_CIERRE } from '../../../../lib/telefonia/cierre';
import { vozConfigurada, configVoz, MODOS, type Modo } from '../../../../lib/telefonia/voz';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const UUID = /^[0-9a-f-]{36}$/i;
const modoDe = (m: any): Modo => ((MODOS as readonly string[]).includes(String(m)) ? m : 'manual');
const identidadDe = (userId: string) => `crm-${String(userId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;

/** La sesión es de quien la creó (o de un fundador). */
async function mia(id: string, user: any) {
  if (!UUID.test(id)) return null;
  const s = await getSesion(id);
  if (!s) return null;
  if (s.owner_id && s.owner_id !== user.id && !['founder', 'cs'].includes(String(user.role))) return null;
  return s;
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  if (url.searchParams.get('lista')) {
    /* ⚠️ FUERA LA SESIÓN FANTASMA. Las llamadas sueltas —entrantes y las que
       marcas a mano— cuelgan de una sesión con `origen.suelta` para poder usar
       el mismo riel (`lib/telefonia/suelta.ts`). No es una jornada: no se armó,
       no marca a nadie y no tiene lista. Listarla entre «tus jornadas
       anteriores» invita a abrirla y a darle «Seguir» a algo que no sigue. */
    const { data } = await supabase.from('tel_sesiones')
      .select('id, nombre, estado, total, contestadas, buzon, sin_contestar, porteros, invalidos, segundos_hablados, iniciada_at, terminada_at, created_at, origen, presentacion_nombre, presentacion_motivo, modo')
      .eq('owner_id', user.id).not('origen', 'cs', '{"suelta":true}')
      .order('created_at', { ascending: false }).limit(30);
    return json({ sesiones: data || [], telefonia: telefoniaConfigurada(), faltantes: telefoniaFaltantes(), identity: identidadDe(user.id), fernanda: vozConfigurada() });
  }

  const id = String(url.searchParams.get('id') || '');
  const s = await mia(id, user);
  if (!s) return json({ error: 'No existe la sesión' }, 404);
  if (url.searchParams.get('items')) return json({ items: await listarItems(id) });
  if (url.searchParams.get('compromisos')) return json({ compromisos: await compromisosDeSesion(id) });
  const est = await latir(id);
  return json({ ...est, identity: identidadDe(user.id) });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const accion = String(b.accion || '');

  try {
    if (accion === 'crear') {
      if (!Array.isArray(b.items) || !b.items.length) return json({ error: 'La lista está vacía' }, 400);
      if (b.items.length > 500) return json({ error: 'Máximo 500 contactos por sesión' }, 400);
      const r = await crearSesion(user.id, {
        nombre: String(b.nombre || '').slice(0, 120) || undefined, origen: b.origen || {}, items: b.items,
        presentacion_nombre: String(b.presentacion_nombre || '').slice(0, 80), presentacion_motivo: String(b.presentacion_motivo || '').slice(0, 240),
        buzon_dejar_mensaje: !!b.buzon_dejar_mensaje, config: b.config || {},
        modo: modoDe(b.modo),
      });
      return json({ ok: true, ...r });
    }

    const s = await mia(String(b.id || ''), user);
    if (!s) return json({ error: 'No existe la sesión' }, 404);

    switch (accion) {
      case 'presentacion': {
        await supabase.from('tel_sesiones').update({
          presentacion_nombre: String(b.presentacion_nombre ?? s.presentacion_nombre ?? '').slice(0, 80) || null,
          presentacion_motivo: String(b.presentacion_motivo ?? s.presentacion_motivo ?? '').slice(0, 240) || null,
          buzon_dejar_mensaje: b.buzon_dejar_mensaje ?? s.buzon_dejar_mensaje,
          nombre: String(b.nombre ?? s.nombre).slice(0, 120),
          config: { ...(s.config || {}), ...(b.config || {}) }, updated_at: new Date().toISOString(),
          // Quién habla viaja con la presentación; solo cambia con la sesión parada.
          ...(b.modo !== undefined && ['borrador', 'lista', 'pausada'].includes(s.estado) ? { modo: modoDe(b.modo) } : {}),
        }).eq('id', s.id);
        if (b.modo !== undefined && modoDe(b.modo) !== 'manual' && !vozConfigurada()) return json({ error: 'Fernanda no está configurada (VOZ_SECRET)' }, 503);
        return json({ ok: true });
      }
      case 'iniciar':
      case 'reanudar': {
        if (!telefoniaConfigurada()) return json({ error: 'Telefonía sin configurar', faltantes: telefoniaFaltantes() }, 503);
        if (s.modo && s.modo !== 'manual' && !vozConfigurada()) return json({ error: 'Fernanda no está configurada (VOZ_SECRET)' }, 503);
        if (s.modo && s.modo !== 'manual' && !(await configVoz()).encendida) return json({ error: 'Fernanda está apagada (Configuración → Telefonía). Cambia «Quién habla» a «Yo» o enciéndela.' }, 409);
        const ok = await iniciarSesion(s.id, identidadDe(user.id));
        // Con Fernanda sola no hay que esperar a que el vendedor entre a la sala: el primer latido ya marca.
        if (ok && s.modo === 'ia') latir(s.id).catch(() => {});
        return ok ? json({ ok: true, identity: identidadDe(user.id) }) : json({ error: `La sesión está ${s.estado}` }, 409);
      }
      case 'modo': {
        // Quién habla: se cambia entre llamadas (con la sesión lista o pausada).
        if (!['lista', 'pausada'].includes(s.estado)) return json({ error: 'Pausa la sesión para cambiar quién habla' }, 409);
        const modo = modoDe(b.modo);
        if (modo !== 'manual' && !vozConfigurada()) return json({ error: 'Fernanda no está configurada (VOZ_SECRET)' }, 503);
        await supabase.from('tel_sesiones').update({ modo, updated_at: new Date().toISOString() }).eq('id', s.id);
        return json({ ok: true, modo });
      }
      /* Devuelve el ESTADO, no un `{ok:true}` pelado: así el botón repinta la
         pantalla con la respuesta y no tiene que esperar al siguiente sondeo.
         «Pausar» que tarda dos segundos en verse es «Pausar» que parece roto, y
         entonces se aprieta otra vez. */
      case 'pausar': await pausarSesion(s.id, 'Pausada por ti'); return json({ ok: true, ...(await estadoSesion(s.id)) });
      case 'terminar': await terminarSesion(s.id); return json({ ok: true });
      case 'siguiente': return json(await siguiente(s.id));
      case 'saltar': return json(await saltar(s.id));
      case 'tomar': return json({ ok: await tomar(s.id) });
      case 'colgar': {
        // Cuelga la pata del contacto (la del vendedor sigue en la sala).
        const it = s.item_actual ? (await supabase.from('tel_sesion_items').select('id, call_sid, estado').eq('id', s.item_actual).maybeSingle()).data : null;
        if (it?.call_sid && !['hecho', 'cierre'].includes(it.estado)) {
          if (b.resultado) await supabase.from('tel_sesion_items').update({ resultado: String(b.resultado).slice(0, 30) }).eq('id', it.id);
          try { await twilioRest(`/Calls/${it.call_sid}.json`, { Status: 'completed' }); } catch { /* ya colgó */ }
        }
        return json({ ok: true });
      }
      case 'resultado':
      case 'nota': {
        const itemId = String(b.item || s.item_actual || '');
        if (!UUID.test(itemId)) return json({ error: 'Falta el item' }, 400);
        const cambio: any = { updated_at: new Date().toISOString() };
        if (b.resultado !== undefined) cambio.resultado = String(b.resultado || '').slice(0, 30) || null;
        if (b.nota !== undefined) cambio.nota = String(b.nota || '').slice(0, 2000) || null;
        const { data: it } = await supabase.from('tel_sesion_items').update(cambio).eq('id', itemId).eq('sesion_id', s.id).select('id, call_sid, conversation_id, contact_id').maybeSingle();
        if (it?.call_sid) {
          const w: any = {};
          if (cambio.resultado !== undefined) w.resultado = cambio.resultado;
          if (Object.keys(w).length) await supabase.from('wa_llamadas').update(w).eq('call_id', it.call_sid);
        }
        // «No me llames» se respeta para siempre, no solo en esta lista.
        if (cambio.resultado === 'no_interesa' && b.no_llamar && it?.contact_id) await supabase.from('contacts').update({ no_llamar: true }).eq('id', it.contact_id);
        if (cambio.nota && it?.conversation_id) {
          await supabase.from('wa_notas').insert({
            conversation_id: it.conversation_id, contact_id: it.contact_id || null, autor: (user as any)?.nombre || 'Equipo',
            texto: `📝 **Apunte de la sesión de llamadas**\n\n${cambio.nota}`,
            metadata: { tipo: 'nota_llamada', nota_llamada: it.call_sid || null, sesion_item: itemId, autor_id: user.id },
          }).then(() => {}, () => {});
        }
        await recontar(s.id);
        return json({ ok: true });
      }
      case 'excluir':
      case 'incluir': {
        const itemId = String(b.item || '');
        if (!UUID.test(itemId)) return json({ error: 'Falta el item' }, 400);
        const ex = accion === 'excluir';
        await supabase.from('tel_sesion_items').update({ estado: ex ? 'excluido' : 'pendiente', motivo_exclusion: ex ? 'lo quitaste tú' : null, updated_at: new Date().toISOString() })
          .eq('id', itemId).eq('sesion_id', s.id).in('estado', ex ? ['pendiente'] : ['excluido']);
        await recontar(s.id);
        return json({ ok: true });
      }
      case 'relanzar': {
        const r = await relanzar(s.id, user.id, Array.isArray(b.cuales) ? b.cuales : undefined);
        return json({ ok: true, ...r });
      }
      /* ── Cierre con IA ─────────────────────────────────────────────── */
      case 'cierre': {
        // «Confirmar»: aplica lo propuesto (con los ajustes del vendedor) sin esperar al wrap-up.
        const itemId = String(b.item || s.item_actual || '');
        if (!UUID.test(itemId)) return json({ error: 'Falta el item' }, 400);
        const { data: it } = await supabase.from('tel_sesion_items').select('id, sesion_id').eq('id', itemId).eq('sesion_id', s.id).maybeSingle();
        if (!it) return json({ error: 'No es un item de tu sesión' }, 404);
        const ajustes: any = {};
        if (b.resultado !== undefined && RESULTADOS_CIERRE.includes(String(b.resultado))) ajustes.resultado = String(b.resultado);   // texto libre rompería relanzar y los contadores
        if (b.nota !== undefined) ajustes.nota = String(b.nota || '').slice(0, 2000) || undefined;
        // Lo que escribió el vendedor se guarda en el item ANTES: si la IA no propuso nada (`sin_datos`), no se pierde.
        const previo: any = {};
        if (ajustes.resultado) previo.resultado = ajustes.resultado;
        if (ajustes.nota) previo.nota = ajustes.nota;
        if (Object.keys(previo).length) await supabase.from('tel_sesion_items').update({ ...previo, updated_at: new Date().toISOString() }).eq('id', itemId);
        const r = await aplicarCierre(itemId, { userId: user.id, autor: (user as any)?.nombre || null, ajustes });
        await recontar(s.id);
        return json(r);
      }
      /* ══ CORREGIR LO QUE LA IA PROPUSO, ANTES DE QUE PASE ═══════════════
         Pedido del dueño (17-sep): antes era todo o nada — si la cita salía a
         las 4 y era a las 5, o la dejabas mal o la hacías a mano después, con
         el siguiente ya timbrando. Aquí se cambia la hora, se quita lo que
         sobra y se aplica lo que queda. */
      case 'cierre_editar': {
        const itemId = String(b.item || s.item_actual || '');
        if (!UUID.test(itemId)) return json({ error: 'Falta el item' }, 400);
        const { data: it } = await supabase.from('tel_sesion_items').select('id, cierre_ia, cierre_estado').eq('id', itemId).eq('sesion_id', s.id).maybeSingle();
        if (!it) return json({ error: 'No es un item de tu sesión' }, 404);
        const p0: any = (it.cierre_ia as any)?.propuesta;
        if (!p0) return json({ error: 'Esa llamada no tiene propuesta que corregir' }, 400);
        const c = b.cambios || {};
        if (Array.isArray(c.compromisos)) {
          /* Sólo fecha y hora: el tipo, el motivo y la duración los pone la IA
             y cambiarlos desde aquí abriría la puerta a una reunión sin tipo. */
          p0.compromisos = (p0.compromisos || []).map((cp: any, i: number) => {
            const e = c.compromisos.find((x: any) => Number(x.i) === i);
            if (!e) return cp;
            if (e.quitar) return null;
            return { ...cp, fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(e.fecha)) ? e.fecha : cp.fecha, hora: /^\d{2}:\d{2}$/.test(String(e.hora)) ? e.hora : cp.hora };
          }).filter(Boolean);
        }
        if (Array.isArray(c.quitar_datos)) p0.datos = (p0.datos || []).filter((_: any, i: number) => !c.quitar_datos.includes(i));
        if (c.etapa === null || c.etapa === 'null') p0.etapa = null;
        if (Array.isArray(c.quitar_envios)) {
          for (const id of c.quitar_envios) if (UUID.test(String(id))) await omitirEnvio(String(id));
          p0.envios = (p0.envios || []).map((e: any) => (c.quitar_envios.includes(e.id) ? { ...e, estado: 'omitido' } : e));
        }
        await supabase.from('tel_sesion_items').update({ cierre_ia: { ...(it.cierre_ia as any), propuesta: p0, editada_at: new Date().toISOString() }, updated_at: new Date().toISOString() }).eq('id', itemId);
        return json({ ok: true, ...(await estadoSesion(s.id)) });
      }
      /* «No fue eso»: se tira la propuesta entera y manda lo que diga la
         persona. Sin esto había que desarmarla pieza por pieza para que no se
         aplicara, y la salida fácil era dejar que la IA hiciera algo mal. */
      case 'cierre_descartar': {
        const itemId = String(b.item || s.item_actual || '');
        if (!UUID.test(itemId)) return json({ error: 'Falta el item' }, 400);
        const { data: it } = await supabase.from('tel_sesion_items').select('id, cierre_ia').eq('id', itemId).eq('sesion_id', s.id).maybeSingle();
        if (!it) return json({ error: 'No es un item de tu sesión' }, 404);
        for (const e of ((it.cierre_ia as any)?.propuesta?.envios || [])) if (e?.id && ['falta', 'listo'].includes(String(e.estado))) await omitirEnvio(String(e.id));
        await supabase.from('tel_sesion_items').update({
          cierre_estado: 'descartado',
          cierre_ia: { ...(it.cierre_ia as any), descartada_at: new Date().toISOString(), por: user.id },
          updated_at: new Date().toISOString(),
        }).eq('id', itemId);
        return json({ ok: true, ...(await estadoSesion(s.id)) });
      }
      /* DESHACER lo que se acaba de aplicar. Dos minutos, que es lo que tarda
         uno en darse cuenta de que confirmó de más: cancela la reunión creada,
         frena el PDF que no ha salido y borra la tarea. Lo que YA salió por
         WhatsApp no se puede deshacer y se dice. */
      case 'cierre_deshacer': {
        const itemId = String(b.item || '');
        if (!UUID.test(itemId)) return json({ error: 'Falta el item' }, 400);
        const { data: it } = await supabase.from('tel_sesion_items').select('id, contact_id, cierre_ia, cierre_estado').eq('id', itemId).eq('sesion_id', s.id).maybeSingle();
        if (!it) return json({ error: 'No es un item de tu sesión' }, 404);
        const aplicado = (it.cierre_ia as any)?.aplicado_at;
        if (!aplicado) return json({ error: 'Esa llamada no se ha aplicado' }, 400);
        if (Date.now() - new Date(aplicado).getTime() > 3 * 60000) return json({ error: 'Ya pasaron más de dos minutos: hay que deshacerlo a mano' }, 400);
        const deshecho: string[] = [];
        // Reuniones creadas por ESTE cierre (origen llamada, del mismo contacto, recién nacidas).
        if (it.contact_id) {
          const { data: bks } = await supabase.from('bookings').select('id, fecha, hora_inicio')
            .eq('contact_id', it.contact_id).eq('origen', 'llamada').eq('estado', 'agendada')
            .gt('created_at', new Date(new Date(aplicado).getTime() - 60000).toISOString()).limit(5);
          for (const bk of bks || []) {
            await supabase.from('bookings').update({ estado: 'cancelada' }).eq('id', bk.id);
            await supabase.from('ti_tareas').delete().contains('payload', { booking_id: bk.id });
            deshecho.push(`se canceló la reunión del ${bk.fecha} a las ${String(bk.hora_inicio).slice(0, 5)}`);
          }
        }
        const { data: envs } = await supabase.from('tel_envios').select('id, tema, estado').eq('item_id', itemId);
        for (const e of envs || []) {
          if (['listo', 'pendiente_ventana', 'falta'].includes(String(e.estado))) { await omitirEnvio(e.id); deshecho.push(`no se manda ${e.tema}`); }
          else if (e.estado === 'enviado') deshecho.push(`${e.tema} YA se le mandó: eso no se puede deshacer`);
        }
        return json({ ok: true, deshecho });
      }
      /* La grabación, para oírla mientras decides. Firmada y corta: el audio de
         una llamada no puede quedar colgando en una URL pública. */
      case 'grabacion': {
        const itemId = String(b.item || s.item_actual || '');
        if (!UUID.test(itemId)) return json({ error: 'Falta el item' }, 400);
        const { data: it } = await supabase.from('tel_sesion_items').select('call_sid').eq('id', itemId).eq('sesion_id', s.id).maybeSingle();
        if (!it?.call_sid) return json({ error: 'Esa llamada no tiene grabación' }, 404);
        const { data: ll } = await supabase.from('wa_llamadas').select('grabacion_path').eq('call_id', it.call_sid).maybeSingle();
        if (!ll?.grabacion_path) return json({ ok: false, motivo: 'La grabación todavía no llega (tarda hasta un minuto después de colgar).' });
        /* ══ 🔴 «OÍR LA LLAMADA» NUNCA PUDO FUNCIONAR (19-sep-2026) ══════
           Partía `grabacion_path` por la primera barra y usaba ese trozo como
           nombre del bucket. Pero la ruta que guarda la minuta es
           `llamadas/CAxxx.mp3` DENTRO del bucket `wa-media` — no hay ningún
           bucket llamado «llamadas» (comprobado: los seis del proyecto son
           quotes, crm-docs, wa-media, comprobantes, proyectos y espacio). O
           sea que el botón pedía la firma en un bucket inexistente y devolvía
           «no se pudo abrir la grabación», SIEMPRE, desde el primer día.

           Nadie lo notó porque el mensaje de error se parece mucho al de «la
           grabación todavía no llega», que sí es un caso normal durante el
           primer minuto. Dos fallos distintos contando la misma historia. */
        const { data: firma } = await supabase.storage.from('wa-media').createSignedUrl(String(ll.grabacion_path), 600);
        return firma?.signedUrl ? json({ ok: true, url: firma.signedUrl }) : json({ ok: false, motivo: 'No se pudo abrir la grabación' });
      }
      case 'cierre_escribiendo': {
        // El vendedor está contestando una pregunta del cierre: el auto-continuar espera (tope de 5 min desde la propuesta).
        const itemId = String(b.item || s.item_actual || '');
        if (!UUID.test(itemId)) return json({ error: 'Falta el item' }, 400);
        const { data: it } = await supabase.from('tel_sesion_items').select('id, cierre_ia').eq('id', itemId).eq('sesion_id', s.id).maybeSingle();
        if (!it) return json({ error: 'No es un item de tu sesión' }, 404);
        await supabase.from('tel_sesion_items').update({ cierre_ia: { ...(it.cierre_ia || {}), escribiendo_at: new Date().toISOString() }, updated_at: new Date().toISOString() }).eq('id', itemId);
        return json({ ok: true });
      }
      case 'cierre_respuesta': {
        // El vendedor dijo qué mandar: se guarda para la próxima y se manda ya.
        const envioId = String(b.envio || '');
        if (!UUID.test(envioId)) return json({ error: 'Falta el envío' }, 400);
        const { data: e } = await supabase.from('tel_envios').select('id, item_id, tel_sesion_items(sesion_id)').eq('id', envioId).maybeSingle();
        if (!e || (e as any)?.tel_sesion_items?.sesion_id !== s.id) return json({ error: 'No es un envío de tu sesión' }, 404);
        return json(await responderEnvio(envioId, String(b.texto || ''), { userId: user.id, autor: (user as any)?.nombre || null }));
      }
      case 'cierre_omitir': {
        const envioId = String(b.envio || '');
        if (!UUID.test(envioId)) return json({ error: 'Falta el envío' }, 400);
        const { data: e } = await supabase.from('tel_envios').select('id, tel_sesion_items(sesion_id)').eq('id', envioId).maybeSingle();
        if (!e || (e as any)?.tel_sesion_items?.sesion_id !== s.id) return json({ error: 'No es un envío de tu sesión' }, 404);
        await omitirEnvio(envioId);
        return json({ ok: true });
      }
      /* ══ VOLVER A LEER LA LLAMADA (18-sep-2026) ════════════════════════
         Pedido del dueño: «si por alguna razón algo no se generó al terminar
         la llamada por créditos, que pueda recargar créditos y de ahí
         regenerarlo, para que no se pierda todo eso que se tuvo que haber
         realizado».

         Ésa es la clave: cuando el cierre falla, el trabajo NO está hecho, está
         PERDIDO — y la transcripción, que es lo caro de conseguir, sigue
         guardada. Releerla cuesta una llamada a la IA. Los fallos de tiempo se
         reintentan solos; los de saldo no, porque sin crédito reintentar solo
         sería quemar fallos cada 30 segundos. Éste es ese botón. */
      case 'cierre_regenerar': {
        const itemId = String(b.item || '');
        if (!UUID.test(itemId)) return json({ error: 'Falta la llamada' }, 400);
        const { data: it } = await supabase.from('tel_sesion_items').select('id, sesion_id, cierre_estado').eq('id', itemId).maybeSingle();
        if (!it || it.sesion_id !== s.id) return json({ error: 'No es una llamada de tu sesión' }, 404);
        if (it.cierre_estado !== 'sin_datos') return json({ error: 'Esa llamada no quedó pendiente de leer' }, 409);
        const p = await proponerCierre(itemId, { reintento: true, holgado: true });
        if (!p) {
          const { data: post } = await supabase.from('tel_sesion_items').select('cierre_ia').eq('id', itemId).maybeSingle();
          const motivo = String((post as any)?.cierre_ia?.motivo || '');
          const fallo = String((post as any)?.cierre_ia?.fallo || 'otro');
          return json({
            error: fallo === 'saldo' ? 'La cuenta de IA sigue sin saldo. Recarga en Anthropic y vuelve a intentar.'
              : fallo === 'tiempo' ? 'Otra vez se acabó el tiempo de lectura. Intenta de nuevo en un momento.'
              : fallo === 'sin_transcripcion' ? 'Esta llamada no dejó transcripción que leer.'
              : `No se pudo leer la llamada: ${motivo || 'sin detalle'}`,
          }, 409);
        }
        return json({ ok: true, ...(await estadoSesion(s.id)) });
      }
      case 'estado': return json(await estadoSesion(s.id));
      default: return json({ error: 'Acción desconocida' }, 400);
    }
  } catch (e: any) {
    return json({ error: String(e?.message || e).slice(0, 300) }, 500);
  }
};
