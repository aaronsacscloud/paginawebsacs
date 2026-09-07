// Punto 6 · Captura por tarjeta de presentación: llega la foto y regresa el
// formulario casi lleno. El gafete con QR (vCard) NO pasa por aquí: se lee en
// el teléfono con BarcodeDetector, sin red y sin gastar IA.
//
// POST { imagen: 'data:image/jpeg;base64,…' } → { nombre, empresa, puesto, whatsapp, email, ciudad, instagram, giro }
import type { APIRoute } from 'astro';
import { json, quien } from '../../../../lib/crm/abm.lib';
import { pedirJSONImagen } from '../../../../lib/ia';
import { GIROS } from '../../../../lib/crm/eventos-catalogos';

export const prerender = false;

const SYSTEM = `Lees tarjetas de presentación de México para un CRM. Devuelves SOLO un JSON con estas llaves (cadena vacía si no aparece):
nombre (nombre y apellido de la persona), empresa, puesto, whatsapp (10 dígitos del celular, sin lada de país; si hay varios teléfonos prefiere el celular/WhatsApp), email, ciudad, instagram (usuario sin @), sitio_web,
giro: una de estas claves según a qué se dedica la empresa: ${Object.entries(GIROS).map(([k, v]) => `${k}=${v}`).join(', ')} (si no se distingue, "otro").
No inventes: si un dato no está en la tarjeta, deja la cadena vacía.`;

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const imagen = String(b?.imagen || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(imagen)) return json({ error: 'Manda la foto como data URL (jpeg, png o webp).' }, 400);
  if (imagen.length > 6_000_000) return json({ error: 'La foto pesa demasiado; toma una más chica.' }, 413);
  try {
    const r = await pedirJSONImagen({ system: SYSTEM, user: 'Lee esta tarjeta y devuelve el JSON.', imagen });
    const t = (v: any, n = 120) => String(v ?? '').trim().slice(0, n);
    const wa = t(r.whatsapp).replace(/\D/g, '').slice(-10);
    return json({ ok: true, datos: {
      nombre: t(r.nombre), empresa: t(r.empresa), puesto: t(r.puesto, 80), whatsapp: wa.length === 10 ? wa : '', email: t(r.email, 160).toLowerCase(),
      ciudad: t(r.ciudad, 80), instagram: t(r.instagram, 80).replace(/^@/, ''), giro: GIROS[t(r.giro)] ? t(r.giro) : 'otro', sitio_web: t(r.sitio_web, 160),
    } });
  } catch (e: any) { return json({ error: String(e?.message || e) }, 502); }
};
