// Registra un clic al WhatsApp comercial.
//
// Un clic NO es un lead: no deja nombre ni correo, y crear un contacto vacío
// por cada clic ensuciaría la lista de leads con fantasmas imposibles de
// contactar. Pero tampoco puede ser invisible: hoy alguien ve el anuncio de
// TikTok, entra a Ferreterías, pide demo por WhatsApp — y el CRM no se entera
// de nada hasta que la persona escribe, si es que escribe.
//
// Por eso se guarda aparte (tabla wa_intentos) y se avisa en la campana: el
// vendedor sabe que viene un mensaje y de qué giro, y cuando llegue puede
// cruzarlo. El CTA NO pasa por aquí: el link sigue yendo directo a wa.me y
// esto se manda por sendBeacon, para que un fallo de red nunca se coma la
// conversión.
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { resolverAtribucion, bloqueAtribucion, resumenAtribucion } from '../../lib/atribucion-marketing';
import { notificar } from '../../lib/crm/notificaciones';
import { origenDe, origenDeRegistro } from '../../lib/crm/origenes';

export const prerender = false;

const ok = () => new Response(null, { status: 204 });

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const giro = String(body?.giro || '').trim().slice(0, 120) || null;
    const contexto = String(body?.contexto || '').trim().slice(0, 60) || null;

    const atribucion = resolverAtribucion(request, body);
    const bloque = bloqueAtribucion(atribucion, request);

    await supabase.from('wa_intentos').insert({
      giro,
      contexto,
      visitor_id: atribucion?.vid || null,
      atribucion: bloque,
      user_agent: (request.headers.get('user-agent') || '').slice(0, 400),
    });

    // Una sola campanada por visitante, giro y día: quien duda y hace clic
    // tres veces es una persona, no tres oportunidades.
    const hoy = new Date().toISOString().slice(0, 10);
    const quien = atribucion?.vid || 'anon';
    const o = origenDe(origenDeRegistro({
      utm_source: atribucion?.p?.s || atribucion?.u?.s,
      fuente: 'website-form',
    }));

    await notificar({
      clave: `wa_intento:${quien}:${giro || 'general'}:${hoy}`,
      tipo: 'wa_intento',
      nivel: 'info',
      titulo: `Pidieron demo por WhatsApp${giro ? ` — ${giro}` : ''}`,
      detalle: [resumenAtribucion(atribucion), o.l, bloque.primer_toque?.landing].filter(Boolean).join(' · '),
      metadata: { giro, contexto, atribucion: bloque },
    });
  } catch { /* nunca falla hacia el usuario: es telemetría */ }

  return ok();
};
