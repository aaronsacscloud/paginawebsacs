// POST /api/crm/secuencias-inscribir — mete a mano un grupo de leads a una secuencia.
//
// Complementa la entrada automática: aquella corre sola cada día sobre quien
// cumple estatus + etapa + filtro; esta la dispara una persona sobre la lista
// que TIENE ENFRENTE, ya filtrada en la pantalla de Leads. Es el caso de «estos
// 14, ahora».
//
// Deliberadamente NO revisa el filtro de entrada de la secuencia: si el humano
// eligió a estos, entran. El automatismo protege de descuidos; la inscripción
// manual es una decisión, y una decisión no se audita a sí misma.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  // Inscribir manda correos a nombre de la empresa: solo equipo interno.
  const user = await getCurrentUser(request);
  if (!user || !['founder', 'cs'].includes(String((user as any).role || ''))) {
    return json({ error: 'Solo el equipo interno puede inscribir leads.' }, 403);
  }

  const b = await request.json().catch(() => ({} as any));
  const secuenciaId = String(b.secuencia_id || '').trim();
  const ids: string[] = Array.isArray(b.contact_ids) ? b.contact_ids.filter((x: any) => typeof x === 'string').slice(0, 500) : [];
  if (!secuenciaId || !ids.length) return json({ error: 'Falta la secuencia o la lista de leads.' }, 400);

  const { data: sec } = await supabase.from('crm_secuencias').select('id, nombre, activa').eq('id', secuenciaId).maybeSingle();
  if (!sec) return json({ error: 'Esa secuencia no existe.' }, 404);

  // Nunca inscribir a quien pidió no recibir: el optout gana sobre cualquier
  // decisión manual, y por eso se filtra aquí y no en la interfaz.
  const { data: aptos } = await supabase.from('contacts')
    .select('id, nombre, wa_optout, archived_at')
    .in('id', ids);
  const vivos = (aptos || []).filter(c => !c.wa_optout && !c.archived_at);
  const bloqueados = (aptos || []).length - vivos.length;

  const { data: yaEstan } = await supabase.from('crm_secuencia_miembros')
    .select('id, contact_id, detenida_at').eq('secuencia_id', secuenciaId).in('contact_id', vivos.map(c => c.id));
  const previo = new Map((yaEstan || []).map(x => [x.contact_id, x]));

  const ahora = new Date().toISOString();
  let nuevos = 0, reactivados = 0, corriendo = 0;
  const aInsertar: any[] = [];

  for (const c of vivos) {
    const ya = previo.get(c.id);
    if (!ya) { aInsertar.push({ secuencia_id: secuenciaId, contact_id: c.id }); nuevos++; continue; }
    if (!ya.detenida_at) { corriendo++; continue; }   // ya está dentro: no se reinicia
    // Estaba fuera: vuelve a día 1 con el historial de envíos limpio.
    await supabase.from('crm_secuencia_miembros')
      .update({ inicio: ahora, enviados: {}, canales_detenidos: {}, detenida_at: null, motivo: null }).eq('id', ya.id);
    reactivados++;
  }
  if (aInsertar.length) await supabase.from('crm_secuencia_miembros').insert(aInsertar);

  // Queda firmado en la actividad de cada lead: quién lo metió y a qué. Sin
  // esto, un lead empieza a recibir correos y nadie sabe por qué.
  const tocados = [...aInsertar.map(x => x.contact_id), ...vivos.filter(c => previo.get(c.id)?.detenida_at).map(c => c.id)];
  if (tocados.length) {
    await supabase.from('activities').insert(tocados.map(cid => ({
      contact_id: cid, tipo: 'nota',
      titulo: `Inscrito a mano en la secuencia "${sec.nombre}"`,
      metadata: { secuencia_id: secuenciaId, manual: true, por: (user as any).email || (user as any).id || null },
    }))).then(() => {}, () => {});
  }

  return json({
    ok: true, nuevos, reactivados, corriendo, bloqueados,
    aviso: !sec.activa ? `La secuencia "${sec.nombre}" está APAGADA: quedan inscritos pero no reciben nada hasta que se prenda.` : null,
  });
};
