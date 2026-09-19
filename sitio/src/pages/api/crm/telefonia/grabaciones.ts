/* LLAMADAS · las grabaciones, buscables y descargables.
 *
 * PEDIDO DEL DUEÑO (19-sep-2026): «todo hay que grabarlo, porque quiero usar
 * esto luego para pasarlo a ElevenLabs y clonar mi voz junto al pitch que hago,
 * para optimizar la llamada inicial».
 *
 * Hasta hoy el audio sólo se alcanzaba desde la tarjeta de la llamada que
 * tenías delante —y ni eso, porque el botón pedía la firma en un bucket que no
 * existe—. Para lo que él quiere hacer eso no sirve: necesita VARIAS llamadas
 * suyas, de días distintos, elegidas por cuáles salieron bien.
 *
 * Se devuelven firmadas y con caducidad de una hora: el bucket es privado y un
 * audio de una llamada no es algo que deba quedar en una URL eterna.
 */
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);

  const url = new URL(request.url);
  const dias = Math.min(Math.max(Number(url.searchParams.get('dias') || 30), 1), 365);
  const busca = String(url.searchParams.get('busca') || '').trim().toLowerCase();
  /* «Sólo las que sirven para clonar»: por debajo de medio minuto no hay
     material suficiente y sí mucho ruido de saludo cortado. Es un filtro, no
     un borrado: el audio corto se sigue guardando. */
  const minSeg = Math.max(0, Number(url.searchParams.get('min') || 0));

  const desde = new Date(Date.now() - dias * 86400e3).toISOString();
  const { data, error } = await supabase
    .from('wa_llamadas')
    .select('call_id, telefono, direccion, duracion_seg, started_at, grabacion_path, transcript, resultado, conversation_id')
    .not('grabacion_path', 'is', null)
    .gte('started_at', desde)
    .gte('duracion_seg', minSeg)
    .order('started_at', { ascending: false })
    .limit(300);
  if (error) return json({ error: error.message }, 500);

  /* El nombre no vive en la llamada: se trae de la conversación en UN viaje
     (no uno por fila, que con 300 grabaciones serían 300 consultas). */
  const convIds = Array.from(new Set((data || []).map(l => l.conversation_id).filter(Boolean)));
  const nombres = new Map<string, string>();
  if (convIds.length) {
    /* `contacts` NO tiene columna `empresa` —el nombre del negocio vive en
       `companies`—, y pedir una columna que no existe hace que PostgREST
       devuelva el error y CERO filas. La primera versión de esto lo pedía, así
       que la lista salía entera con puros teléfonos y sin un solo nombre: un
       fallo que no truena, sólo empobrece, que son los que más tardan en verse. */
    const { data: convs, error: eConv } = await supabase.from('wa_conversaciones')
      .select('id, contacts(nombre, companies(nombre_comercial, nombre))').in('id', convIds);
    if (eConv) console.error(`[grabaciones] no se pudieron leer los nombres: ${eConv.message}`);
    for (const c of convs || []) {
      const ct: any = (c as any).contacts;
      const emp = ct?.companies?.nombre_comercial || ct?.companies?.nombre || '';
      if (ct?.nombre) nombres.set(String(c.id), [ct.nombre, emp].filter(Boolean).join(' · '));
    }
  }

  const filas = [] as any[];
  for (const l of data || []) {
    const quien = (l.conversation_id && nombres.get(String(l.conversation_id))) || '';
    if (busca && !`${quien} ${l.telefono}`.toLowerCase().includes(busca)) continue;
    const { data: firma } = await supabase.storage.from('wa-media').createSignedUrl(String(l.grabacion_path), 3600);
    if (!firma?.signedUrl) continue;
    filas.push({
      call_id: l.call_id, telefono: l.telefono, nombre: quien, direccion: l.direccion,
      segundos: Number(l.duracion_seg || 0), cuando: l.started_at, resultado: l.resultado,
      url: firma.signedUrl, tiene_transcripcion: !!l.transcript,
    });
  }
  return json({ ok: true, grabaciones: filas, total: filas.length });
};
