// Biblioteca de documentos del CRM (Configuración → Documentos).
//
// GET    ?activos=1        → la lista, con a cuántas cuentas se mandó cada uno
//                            y cuántas lo abrieron. `activos=1` es lo que pide
//                            el correo de la ficha: solo lo prendido y vigente.
// POST   { titulo, url, tipo?, descripcion?, vence?, miniatura? } → alta
// PATCH  { id, ...campos }  → editar o prender/apagar
// DELETE ?id=               → se archiva, no se borra: sus envíos son historia.
//
// Un documento VENCIDO se trata como apagado aunque su casilla diga activo: la
// promoción que venció el 28 no puede seguir saliendo el 29 porque nadie se
// acordó de apagarla.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
const TIPOS = ['presentacion', 'pdf', 'liga'];
const hoyMx = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);

function limpiar(b: any) {
  const o: any = {};
  if (b.titulo !== undefined) o.titulo = String(b.titulo || '').trim().slice(0, 160);
  if (b.descripcion !== undefined) o.descripcion = String(b.descripcion || '').trim().slice(0, 400) || null;
  if (b.url !== undefined) o.url = String(b.url || '').trim();
  if (b.miniatura !== undefined) o.miniatura = String(b.miniatura || '').trim() || null;
  if (b.tipo !== undefined) o.tipo = TIPOS.includes(b.tipo) ? b.tipo : 'liga';
  if (b.vence !== undefined) o.vence = /^\d{4}-\d{2}-\d{2}$/.test(String(b.vence || '')) ? b.vence : null;
  if (b.activo !== undefined) o.activo = b.activo === true;
  return o;
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const { data, error } = await supabase.from('crm_documentos')
    .select('id, titulo, descripcion, tipo, url, miniatura, vence, activo, creado_por, created_at')
    .is('archived_at', null).order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, 500);

  const hoy = hoyMx();
  let docs = (data || []).map(d => ({ ...d, vencido: !!(d.vence && d.vence < hoy) }));
  if (url.searchParams.get('activos') === '1') docs = docs.filter(d => d.activo && !d.vencido);

  // Cuántas cuentas lo recibieron y cuántas lo abrieron.
  const ids = docs.map(d => d.id);
  const stats: Record<string, { cuentas: Set<string>; abrieron: Set<string> }> = {};
  if (ids.length) {
    const { data: env } = await supabase.from('crm_documento_envios')
      .select('documento_id, company_id, para, abierto_at').in('documento_id', ids);
    for (const e of (env || [])) {
      const s = stats[e.documento_id] || (stats[e.documento_id] = { cuentas: new Set(), abrieron: new Set() });
      const quien = e.company_id || e.para || '';
      s.cuentas.add(quien);
      if (e.abierto_at) s.abrieron.add(quien);
    }
  }
  return json({
    documentos: docs.map(d => ({ ...d, cuentas: stats[d.id]?.cuentas.size || 0, abrieron: stats[d.id]?.abrieron.size || 0 })),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const o = limpiar(await request.json().catch(() => ({})));
  if (!o.titulo) return json({ error: 'Ponle nombre al documento.' }, 400);
  if (!/^https?:\/\//i.test(o.url || '')) return json({ error: 'La liga tiene que empezar con https://' }, 400);
  const { data, error } = await supabase.from('crm_documentos')
    .insert({ ...o, creado_por: (user as any)?.email || (user as any)?.nombre || null }).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, documento: data });
};

export const PATCH: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  if (!UUID.test(String(b?.id || ''))) return json({ error: 'Falta el documento.' }, 400);
  const o = limpiar(b);
  if (o.url !== undefined && !/^https?:\/\//i.test(o.url)) return json({ error: 'La liga tiene que empezar con https://' }, 400);
  if (o.titulo !== undefined && !o.titulo) return json({ error: 'Ponle nombre al documento.' }, 400);
  const { data, error } = await supabase.from('crm_documentos')
    .update({ ...o, updated_at: new Date().toISOString() }).eq('id', b.id).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, documento: data });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const id = String(url.searchParams.get('id') || '');
  if (!UUID.test(id)) return json({ error: 'Falta el documento.' }, 400);
  const { error } = await supabase.from('crm_documentos')
    .update({ archived_at: new Date().toISOString(), activo: false }).eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
