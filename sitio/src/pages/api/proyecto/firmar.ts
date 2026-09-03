import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { briefPorToken, etapasDe, bitacora, json } from '../../../lib/proyecto/store';

export const prerender = false;

// Firmar el brief. Es lo que arranca el proyecto: hasta que se firma, la
// etapa 1 sigue bloqueada. Firmar dos veces no hace nada — la primera firma
// es la que vale y no se puede sobrescribir desde aquí.
export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await request.json().catch(() => ({}));
  const { token, nombre, puesto, email, firma_png, avisos } = body || {};

  const brief = await briefPorToken(token);
  if (!brief) return json({ error: 'No encontrado' }, 404);
  if (brief.firmado_at) return json({ error: 'Este brief ya fue firmado', ya: true }, 409);

  const n = String(nombre || '').trim();
  if (n.length < 3) return json({ error: 'Escribe tu nombre completo' }, 400);
  // La firma se guarda como PNG en base64. 400 KB es holgado para un trazo y
  // corta de tajo el intento de meter un archivo por esta puerta.
  const firma = typeof firma_png === 'string' && firma_png.startsWith('data:image/png;base64,')
    ? firma_png.slice(0, 400_000)
    : null;
  if (!firma) return json({ error: 'Falta la firma' }, 400);

  // A qué correos avisamos cada vez que revisemos una etapa. Se pide aquí y no
  // después porque es el único momento en que tenemos su atención completa.
  const correos = String(avisos || email || '')
    .split(/[,;\s]+/)
    .map((x: string) => x.trim().toLowerCase())
    .filter((x: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))
    .slice(0, 6);

  await supabase
    .from('proyecto_brief')
    .update({
      avisos_email: correos,
      firmado_por: n,
      firmado_puesto: String(puesto || '').trim().slice(0, 120) || null,
      firmado_email: String(email || '').trim().slice(0, 160) || null,
      firmado_at: new Date().toISOString(),
      firmado_ip: clientAddress || null,
      firma_png: firma,
    })
    .eq('id', brief.id)
    .is('firmado_at', null);

  // Firmado: se abre la primera etapa.
  const etapas = await etapasDe(brief.id);
  const primera = etapas.find((e) => e.orden === 1);
  if (primera && primera.estado === 'bloqueada') {
    await supabase.from('proyecto_etapa').update({ estado: 'abierta' }).eq('id', primera.id);
  }

  await bitacora(brief.id, 'cliente', 'Brief firmado', null, n);
  return json({ ok: true });
};
