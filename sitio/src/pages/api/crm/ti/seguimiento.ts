// SEGUIMIENTO · paridad 9/10 (decisión del dueño, 2026-09-03). GET: paridad + sugerencias por decidir + historial + galería.
// GET ?contact_id= : solo las sugerencias de ese lead (la compuerta del inbox). POST { accion:'decidir', envio_id, decision,
// mensaje?, adjuntos?, motivo?, detalle? } · { accion:'config', paridad_meta?, paridad_ventana?, agente_modo?, agente_prueba_telefonos? } (dueño).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { leerConfig } from '../../../../lib/crm/ti/motor';
import { paridad, decidirSugerencia, sugerenciasPendientes, historialCalificaciones, revisarParidad } from '../../../../lib/crm/ti/seguimiento';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const cid = url.searchParams.get('contact_id');
  if (cid) {
    const todas = await sugerenciasPendientes(200);
    return json({ pendientes: todas.filter(p => p.contact_id === cid), paridad: await paridad() });
  }
  const { galeriaActiva } = await import('../../../../lib/crm/ti/imagenes-agente');
  const [p, pendientes, historial, galeria, cfg] = await Promise.all([paridad(), sugerenciasPendientes(80), historialCalificaciones(80), galeriaActiva().catch(() => []), leerConfig() as Promise<any>]);
  return json({ paridad: p, pendientes, historial, galeria, config: { agente_activo: cfg.agente_activo === true, agente_modo: cfg.agente_modo || 'sombra', paridad_meta: p.meta, paridad_ventana: p.ventana, agente_prueba_telefonos: cfg.agente_prueba_telefonos || [], veto_min: Number(cfg.agente_veto_min ?? 10) } });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (b.accion === 'decidir') {
    if (!b.envio_id || !['enviar', 'modificar', 'rechazar'].includes(b.decision)) return json({ error: 'Falta envio_id o decisión' }, 400);
    const r = await decidirSugerencia(String(b.envio_id), { decision: b.decision, mensaje: b.mensaje, adjuntos: b.adjuntos, motivo: b.motivo, detalle: b.detalle, userId: user.id });
    return json(r, r?.error ? 400 : 200);
  }
  if (b.accion === 'config') {
    if (user.role !== 'founder') return json({ error: 'Solo el dueño cambia la paridad y el modo del agente' }, 403);
    const cfg: any = await leerConfig();
    const parche: any = {};
    if (b.paridad_meta !== undefined) { const m = Number(b.paridad_meta); if (!(m >= 5 && m <= 10)) return json({ error: 'La meta va de 5 a 10' }, 400); parche.paridad_meta = m; }
    if (b.paridad_ventana !== undefined) { const v = Math.round(Number(b.paridad_ventana)); if (!(v >= 20 && v <= 2000)) return json({ error: 'La ventana va de 20 a 2000 respuestas' }, 400); parche.paridad_ventana = v; }
    if (b.agente_modo !== undefined) { if (!['sombra', 'vivo'].includes(b.agente_modo)) return json({ error: 'Modo inválido' }, 400); parche.agente_modo = b.agente_modo; if (b.agente_modo === 'sombra') parche.paridad_alcanzada_at = null; }
    if (Array.isArray(b.agente_prueba_telefonos)) parche.agente_prueba_telefonos = b.agente_prueba_telefonos.map((t: any) => String(t).replace(/\D/g, '')).filter((t: string) => t.length >= 10).slice(0, 10);
    await supabase.from('ti_config').update({ valor: { ...cfg, ...parche } }).eq('id', 1);
    await supabase.from('ia_log').insert({ accion: 'seguimiento_config', razon: Object.keys(parche).join(', '), detalle: { ...parche, por: user.id } }).then(() => {}, () => {});
    return json({ ok: true, paridad: await paridad({ ...cfg, ...parche }) });
  }
  if (b.accion === 'revisar') return json(await revisarParidad());
  return json({ error: 'Acción desconocida' }, 400);
};
