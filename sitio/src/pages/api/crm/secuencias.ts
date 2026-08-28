// CRM · SECUENCIAS multi-canal: la config completa de cada secuencia
// (reglas, pasos WhatsApp+correo, ventana) y sus métricas de rendimiento.
//   GET  → { secuencias: [{...sec, pasos, metricas}] }
//   POST → crea o actualiza {id?, nombre, descripcion, activa, corte_dias,
//          hora_inicio, hora_fin, pasos: [{dia, canal, email_template_id|wa_plantilla, activo}]}
//   DELETE ?id= → borra (cascade lleva pasos y miembros)
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async () => {
  const [{ data: secs }, { data: pasos }, { data: mets }] = await Promise.all([
    supabase.from('crm_secuencias').select('*').order('created_at'),
    supabase.from('crm_secuencia_pasos').select('*').order('orden'),
    supabase.rpc('crm_secuencias_metricas'),
  ]);
  const porSec = new Map<string, any[]>();
  for (const p of pasos || []) { const a = porSec.get(p.secuencia_id) || []; a.push(p); porSec.set(p.secuencia_id, a); }
  const metPor = new Map<string, any>((mets || []).map((m: any) => [m.secuencia_id, m]));
  return json({
    secuencias: (secs || []).map(s => ({
      ...s, pasos: porSec.get(s.id) || [],
      metricas: metPor.get(s.id) || { en_secuencia: 0, entraron: 0, salidas: {}, correos: 0, whatsapps: 0 },
    })),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({}));
  if (!b?.nombre?.trim()) return json({ error: 'Falta el nombre' }, 400);
  const fila: any = {
    nombre: String(b.nombre).trim().slice(0, 120),
    descripcion: String(b.descripcion || '').slice(0, 500) || null,
    activa: !!b.activa,
    corte_dias: Math.max(1, Math.min(60, Number(b.corte_dias) || 14)),
    hora_inicio: Math.max(0, Math.min(23, Number(b.hora_inicio) ?? 10)),
    hora_fin: Math.max(1, Math.min(24, Number(b.hora_fin) ?? 18)),
  };
  // Días de la semana en que SÍ envía (1=lun … 7=dom) y reglas de entrada.
  if (Array.isArray(b.dias_envio)) {
    const ds = b.dias_envio.map(Number).filter((d: number) => d >= 1 && d <= 7);
    if (ds.length) fila.dias_envio = [...new Set(ds)].sort();
  }
  if (b.entrada && typeof b.entrada === 'object') {
    const ESTATUS_OK = ['nuevo', 'contactado', 'sin_respuesta', 'respondio', 'descubrimiento'];
    const est = Array.isArray(b.entrada.estatus) ? b.entrada.estatus.filter((x: string) => ESTATUS_OK.includes(x)) : [];
    fila.entrada = { estatus: est.length ? est : ['contactado', 'sin_respuesta'], lifecycle: ['lead', 'lead_calificado'] };
  }
  let id = b.id || null;
  if (id) {
    const { error } = await supabase.from('crm_secuencias').update(fila).eq('id', id);
    if (error) return json({ error: error.message }, 500);
  } else {
    const { data, error } = await supabase.from('crm_secuencias').insert(fila).select('id').single();
    if (error) return json({ error: error.message }, 500);
    id = data.id;
  }
  if (Array.isArray(b.pasos)) {
    const filas = b.pasos
      .filter((p: any) => p.dia && ['correo', 'wa'].includes(p.canal))
      .map((p: any, i: number) => ({
        secuencia_id: id, orden: i + 1, dia: Math.max(1, Number(p.dia) || 1), canal: p.canal,
        email_template_id: p.canal === 'correo' ? (p.email_template_id || null) : null,
        wa_plantilla: p.canal === 'wa' ? (String(p.wa_plantilla || '').trim() || null) : null,
        activo: p.activo !== false,
      }));
    const { error: e1 } = await supabase.from('crm_secuencia_pasos').delete().eq('secuencia_id', id);
    if (e1) return json({ error: e1.message }, 500);
    if (filas.length) {
      const { error: e2 } = await supabase.from('crm_secuencia_pasos').insert(filas);
      if (e2) return json({ error: e2.message }, 500);
    }
  }
  return json({ ok: true, id });
};

export const DELETE: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  const { error } = await supabase.from('crm_secuencias').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
