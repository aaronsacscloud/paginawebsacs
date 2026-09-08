// La respuesta del cliente al pie del reporte: sí / quiero más detalle / dudas.
//
// Es la única señal de vuelta que da un documento. Vale más que la apertura:
// abrir dice que llegó, esto dice qué le pareció.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const VALIDAS = ['si', 'mas', 'dudas'];
const TEXTO: Record<string, string> = { si: 'Le sirvió', mas: 'Quiere más detalle', dudas: 'Tiene dudas' };

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b.reporte_id || '');
  const r = String(b.reaccion || '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !VALIDAS.includes(r)) return json({ ok: false }, 400);

  const { data: rep } = await supabase.from('reportes_trabajo').select('company_id, folio').eq('id', id).maybeSingle();
  await supabase.from('reportes_trabajo')
    .update({ reaccion: r, reaccion_at: new Date().toISOString() }).eq('id', id);

  if (rep?.company_id) {
    await supabase.from('activities').insert({
      company_id: rep.company_id, tipo: 'reporte_reaccion',
      titulo: `Reporte ${rep.folio}: ${TEXTO[r]}`, automatico: true,
    }).then(() => {}, () => {});
  }
  return json({ ok: true });
};
