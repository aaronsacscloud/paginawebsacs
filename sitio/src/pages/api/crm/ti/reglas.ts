// REGLAS DEL AGENTE (datos, no código). GET: propuestas, activas, retiradas. POST { accion: proponer | probar | aprobar |
// rechazar | retirar | editar, id?, texto?, etapa?, nota?, forzar? }. Cualquier usuario del CRM propone, prueba y activa
// (decisión del dueño 3-sep: el consultor lo hace desde la pantalla); queda registrado quién.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { proponerRegla, evaluarRegla, decidirRegla, reglasVigentes, redactarPropuestasPendientes } from '../../../../lib/crm/ti/guion-datos';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function listar() {
  const { data } = await supabase.from('ti_reglas').select('id, clave, estado, texto, etapa, alcance, version, prueba, origen, nota, valor, evidencia, decidida_por, decidida_at, activa_desde, retirada_at, created_at').eq('clave', 'regla_guion').order('created_at', { ascending: false }).limit(200);
  const uids = [...new Set((data || []).map(r => r.decidida_por).filter(Boolean))] as string[];
  const { data: us } = uids.length ? await supabase.from('team_members').select('id, nombre').in('id', uids) : { data: [] as any[] };
  const filas = (data || []).map(r => ({ ...r, evidencias: (r.valor as any)?.evidencias || [], correcciones: (r.valor as any)?.correcciones || null, decidida_por_nombre: (us || []).find((u: any) => u.id === r.decidida_por)?.nombre || null, valor: undefined, evidencia: undefined }));
  return { propuestas: filas.filter(r => r.estado === 'propuesta' && r.texto), sin_texto: filas.filter(r => r.estado === 'propuesta' && !r.texto).length, activas: filas.filter(r => r.estado === 'activa'), retiradas: filas.filter(r => r.estado === 'retirada').slice(0, 30) };
}

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  return json(await listar());
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const uid = user.id;
  let r: any;
  if (b.accion === 'proponer') r = await proponerRegla({ texto: b.texto, etapa: b.etapa || null, origen: 'dueno', userId: uid, nota: b.nota });
  else if (b.accion === 'probar' && b.id) r = await evaluarRegla(String(b.id));
  else if (['aprobar', 'rechazar', 'retirar', 'editar'].includes(b.accion) && b.id) r = await decidirRegla(String(b.id), { decision: b.accion, texto: b.texto, nota: b.nota, userId: uid, forzar: !!b.forzar });
  else if (b.accion === 'redactar_pendientes') r = await redactarPropuestasPendientes(Number(b.n) || 4);
  else return json({ error: 'Acción desconocida' }, 400);
  if (r?.error) return json(r, 400);
  await reglasVigentes(true);
  return json({ ...r, ...(await listar()) });
};
