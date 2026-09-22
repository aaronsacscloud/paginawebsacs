// Reporte de RECOMENDACIONES de una cuenta.
//
// POST { accion: 'analizar', company_id, notas? }
//        → los flujos evaluados con el uso real + la redacción de la IA, para
//          que el consultor los revise. No guarda nada.
// POST { accion: 'generar', company_id, intro, flujos[], programa_doc_id? }
//        → guarda el reporte (RR-) con lo que el consultor dejó y devuelve la liga.
//
// Ver lib/crm/recomendaciones.ts: el estado de cada flujo lo pone el dato; la
// IA solo redacta, y el consultor corrige antes de generar.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { reunirCuenta, evaluarFlujos, redactarRecomendaciones } from '../../../lib/crm/recomendaciones';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;
const ESTADOS = ['completo', 'medio', 'sin_usar'];

export const POST: APIRoute = async ({ request }) => {
  const user: any = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const companyId = String(b?.company_id || '');
  if (!UUID.test(companyId)) return json({ error: 'Falta la cuenta.' }, 400);

  if (b?.accion === 'analizar') {
    const c = await reunirCuenta(companyId);
    if (!c) return json({ error: 'Esa cuenta ya no existe.' }, 404);
    if (!c.tieneUso) return json({ error: 'Esta cuenta todavía no tiene datos de uso de SACS (se sincronizan cada noche). Sin eso no hay flujos que revisar.' }, 400);
    const evaluados = evaluarFlujos(c);
    try {
      const r = await redactarRecomendaciones(c.cliente, evaluados, { notas: String(b?.notas || '').slice(0, 3000), tickets: c.tickets, taller: c.taller, tendencia: c.tendencia });
      return json({ cliente: c.cliente, ...r });
    } catch (e: any) {
      // Sin IA el reporte sirve igual con los hechos crudos: mejor que nada.
      return json({ cliente: c.cliente, intro: '', flujos: evaluados.map(f => ({ ...f, evidencia: f.hechos.join(' '), recomendacion: '' })), aviso: 'La IA no contestó: van los datos sin redactar. ' + String(e?.message || '') });
    }
  }

  if (b?.accion === 'generar') {
    const { data: co } = await supabase.from('companies').select('nombre, nombre_comercial, sacs_account').eq('id', companyId).maybeSingle();
    if (!co) return json({ error: 'Esa cuenta ya no existe.' }, 404);
    const flujos = (Array.isArray(b?.flujos) ? b.flujos : []).slice(0, 12).map((f: any) => ({
      nombre: String(f?.nombre || '').trim().slice(0, 90),
      estado: ESTADOS.includes(f?.estado) ? f.estado : 'medio',
      cadena: (Array.isArray(f?.cadena) ? f.cadena : []).slice(0, 6).map((e: any) => ({ paso: String(e?.paso || '').trim().slice(0, 40), ok: e?.ok === true })).filter((e: any) => e.paso),
      evidencia: String(f?.evidencia || '').trim().slice(0, 500),
      recomendacion: String(f?.recomendacion || '').trim().slice(0, 400),
    })).filter((f: any) => f.nombre);
    if (!flujos.length) return json({ error: 'El reporte no tiene ningún flujo.' }, 400);

    let programa: any = null;
    if (UUID.test(String(b?.programa_doc_id || ''))) {
      const { data: d } = await supabase.from('crm_documentos').select('id, titulo, descripcion, url').eq('id', b.programa_doc_id).maybeSingle();
      if (d) programa = { id: d.id, titulo: d.titulo, texto: d.descripcion || '', url: d.url };
    }
    const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
    const hechos = {
      cliente: co.nombre_comercial || co.nombre || co.sacs_account,
      cuenta_sacs: co.sacs_account || null,
      preparado_por: user?.nombre || null,
      intro: String(b?.intro || '').trim().slice(0, 500),
      flujos,
      resumen: {
        revisados: flujos.length,
        completos: flujos.filter((f: any) => f.estado === 'completo').length,
        a_medias: flujos.filter((f: any) => f.estado !== 'completo').length,
        recomendaciones: flujos.filter((f: any) => f.estado !== 'completo' && f.recomendacion).length,
      },
      programa,
    };
    const { data, error } = await supabase.from('reportes_trabajo').insert({
      company_id: companyId, desde: hoy, hasta: hoy, tipo: 'recomendaciones', hechos,
      creado_por: user?.email || user?.nombre || null,
    }).select('id, folio').single();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, id: data.id, folio: data.folio, resumen: hechos.resumen });
  }

  return json({ error: 'Acción desconocida.' }, 400);
};
