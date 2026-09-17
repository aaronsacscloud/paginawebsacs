// TELEFONÍA · «Estoy en llamada»: avisarle al que llamó mientras yo hablaba.
//
// REPORTE DEL DUEÑO (17-sep-2026): «estaba llamando y un contacto me estaba
// llamando al mismo tiempo; que se marque como ocupado, en automático le llegue
// un WhatsApp diciendo que estoy en llamada y que reintente en 5 minutos o
// espere a que nosotros le llamemos, para darle certeza inmediata».
//
// Quien te llama y escucha el tono hasta que se rinde no sabe si le fallaste o
// si el número está muerto. Un mensaje inmediato convierte una llamada perdida
// en una cita implícita.
//
// POST { telefono, nombre? } → { ok, via: 'texto'|'plantilla'|'solo_tarea', tarea }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getSessionFromRequest } from '../../../../lib/auth/session';
import { telefonoWhatsApp } from '../../../../lib/telefono';
import { enviarTexto, enviarPlantilla, enContexto, KapsoError } from '../../../../lib/whatsapp/kapso-api';
import { registrarMensaje, notaSistema } from '../../../../lib/whatsapp/espejo';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/* LA PLANTILLA: `llamada_ocupado_v1`, UTILITY, es_MX. Creada en Meta el
   17-sep-2026; entra en cuanto Meta la apruebe, sin desplegar nada.

   Hace falta porque quien te llama por teléfono casi nunca tiene abierta la
   ventana de 24 h de WhatsApp —la abre quien ESCRIBE, no quien marca—, así que
   el texto libre no entra. Ninguna de las 27 plantillas aprobadas servía.

   Es UTILITY y no MARKETING a propósito, y por eso está redactada como está:
   contesta a algo que HIZO el cliente (nos llamó), no ofrece nada y no vende.
   Una plantilla de esta familia con una frase comercial se reclasifica sola a
   MARKETING y entonces ya no puede salir fuera de la ventana, que es justo lo
   único para lo que existe.

   Mientras siga PENDING el envío falla y cae a `solo_tarea`, que es el mismo
   camino que ya había: nada se rompe mientras Meta decide. */
const PLANTILLA_OCUPADO: string | null = 'llamada_ocupado_v1';

const TEXTO = (n: string) =>
  `Hola${n ? ` ${n}` : ''}, te marqué pero estoy en otra llamada en este momento. `
  + `Si te urge, vuelve a marcarme en unos 5 minutos; si prefieres, yo te llamo en cuanto cuelgue. `
  + `Dime qué te acomoda y así lo hacemos.`;

export const POST: APIRoute = async ({ request }) => {
  const user = await getSessionFromRequest(request).catch(() => null);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'Body inválido' }, 400); }

  const destino = telefonoWhatsApp(String(b.telefono || ''));
  if (!destino) return json({ error: 'Sin teléfono al cual avisar' }, 400);

  // A quién es, si lo conocemos. Sirve para el saludo y para colgar la tarea.
  const { data: conv } = await supabase.from('wa_conversaciones')
    .select('id, contact_id, contacts(nombre)')
    .eq('telefono', destino).order('ultimo_mensaje_at', { ascending: false }).limit(1).maybeSingle();
  const nombre = String(b.nombre || (conv as any)?.contacts?.nombre || '').trim().split(/\s+/)[0] || '';

  /* ANTI-REPETICIÓN: si vuelve a marcar tres veces seguidas mientras sigo en la
     misma llamada, no se le mandan tres mensajes iguales. Uno cada 30 minutos. */
  if (conv?.id) {
    const hace30 = new Date(Date.now() - 30 * 60000).toISOString();
    const { data: ya } = await supabase.from('wa_mensajes')
      .select('id').eq('conversation_id', conv.id).eq('direccion', 'saliente')
      .contains('metadata', { ocupado_llamada: true }).gte('created_at', hace30).limit(1);
    if (ya?.length) return json({ ok: true, via: 'ya_avisado' });
  }

  enContexto('cita');
  let via: 'texto' | 'plantilla' | 'solo_tarea' = 'solo_tarea';
  const texto = TEXTO(nombre);
  try {
    const r = await enviarTexto(destino, texto);
    const wamid = r?.messages?.[0]?.id || null;
    if (wamid) {
      await registrarMensaje({
        kapsoMessageId: wamid, telefono: destino, direccion: 'saliente', tipo: 'text',
        cuerpo: texto, status: 'sent', autor: 'Telefonía',
        metadata: { ocupado_llamada: true },
      });
      via = 'texto';
    }
  } catch (e: any) {
    const cerrada = e instanceof KapsoError && /131047|window|24/i.test(String(e.message));
    if (cerrada && PLANTILLA_OCUPADO) {
      try {
        // Meta no acepta una variable vacía, y la plantilla empieza con
        // «Hola {{1}},». Sin nombre, «qué tal» es lo único que deja la frase
        // leyéndose bien: «Hola qué tal, recibimos tu llamada».
        const r = await enviarPlantilla(destino, PLANTILLA_OCUPADO, 'es_MX', [nombre || 'qué tal']);
        const wamid = r?.messages?.[0]?.id || null;
        if (wamid) {
          await registrarMensaje({
            kapsoMessageId: wamid, telefono: destino, direccion: 'saliente', tipo: 'template',
            cuerpo: texto, status: 'sent', autor: 'Telefonía',
            metadata: { ocupado_llamada: true, plantilla: PLANTILLA_OCUPADO },
          });
          via = 'plantilla';
        }
      } catch { /* cae a solo_tarea */ }
    }
    if (via === 'solo_tarea') {
      // Que quede dicho en el hilo: si no se le pudo avisar, alguien tiene que
      // saberlo. Una llamada perdida en silencio es la que no se devuelve.
      await notaSistema(destino, 'Te llamó mientras estabas en otra llamada y NO se le pudo avisar por WhatsApp (ventana cerrada y sin plantilla). Hay que devolverle la llamada.')
        .catch(() => {});
    }
  }

  /* LA TAREA, SIEMPRE. Se haya podido avisar o no, prometimos devolver la
     llamada — y una promesa sin dueño ni fecha no se cumple. Hoy mismo. */
  let tarea: any = null;
  if (conv?.contact_id) {
    const { data } = await supabase.from('crm_seguimientos').insert({
      contact_id: conv.contact_id, conversation_id: conv.id,
      motivo: 'Te llamó mientras estabas en otra llamada — devolverle la llamada',
      fecha: new Date().toISOString().slice(0, 10),
      creado_por: (user as any)?.id || null,
    }).select('id').maybeSingle();
    tarea = data;
  }

  return json({ ok: true, via, tarea });
};
