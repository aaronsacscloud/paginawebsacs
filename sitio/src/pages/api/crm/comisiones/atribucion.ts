// /api/crm/comisiones/atribucion — de quién es cada cuenta y con qué origen.
//
// Es el PRERREQUISITO del motor: sin dueño no hay a quién pagarle, y sin origen
// no se sabe qué porcentaje aplica. Cuando se construyó esto, las 341 cuentas
// del CRM tenían owner en cero — de ahí que la pantalla empiece por la lista de
// lo que falta asignar y no por un buscador.
//
// GET  ?sin_asignar=1 → cuentas sin dueño, las que más dinero han pagado primero.
// PUT  { company_id | subscription_id, owner_id, origen }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { orSeguro } from '../../../../lib/crm/comisiones.lib';

export const prerender = false;
const json = (o: any, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const ORIGENES = ['lead_sacs', 'referido', 'recuperada', 'heredado'];

export const GET: APIRoute = async ({ url }) => {
  try {
    const soloFaltantes = url.searchParams.get('sin_asignar') === '1';
    const q = (url.searchParams.get('q') || '').trim();

    // Las archivadas quedan fuera de la lista Y del conteo: incluirlas hacía
    // que la cobertura no pudiera llegar a 100% ni asignándolo todo.
    let sel = supabase.from('companies')
      .select('id, nombre, nombre_comercial, estado_cuenta, arr, comision_owner_id, comision_origen, comision_origen_at, comision_nota')
      .is('archived_at', null)
      .order('arr', { ascending: false, nullsFirst: false })
      .limit(1000);
    if (soloFaltantes) sel = sel.is('comision_owner_id', null);
    // El término va ENTRECOMILLADO: la coma separa filtros en PostgREST y
    // buscar «Kshlerin, Kemmer and Adams» partía la consulta en dos filtros
    // inválidos y devolvía un 400.
    if (q) sel = sel.or(`nombre.ilike.${orSeguro('%' + q + '%')},nombre_comercial.ilike.${orSeguro('%' + q + '%')}`);
    const { data: empresas, error } = await sel;
    if (error) throw error;

    const { count: totalEmpresas } = await supabase.from('companies')
      .select('id', { count: 'exact', head: true }).is('archived_at', null);
    const { count: asignadas } = await supabase.from('companies')
      .select('id', { count: 'exact', head: true }).is('archived_at', null).not('comision_owner_id', 'is', null);

    const { data: miembros } = await supabase.from('team_members')
      .select('id, nombre, email, rol, activo').eq('activo', true).order('nombre');

    return json({
      empresas: empresas || [],
      miembros: miembros || [],
      cobertura: { total: totalEmpresas || 0, asignadas: asignadas || 0 },
    });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();
    if (b.origen && !ORIGENES.includes(b.origen)) return json({ error: 'Origen no válido.' }, 400);

    // Asignación masiva: la única forma realista de arrancar con 341 cuentas
    // sin dueño. Mismo dueño y mismo origen para el lote seleccionado.
    // `limpiar:true` es la única forma de DESASIGNAR: mandar owner_id vacío
    // significa "sin cambio", porque la pantalla usa el vacío como neutro.
    const limpiar = b.limpiar === true;
    const idsEmpresa: string[] = Array.isArray(b.company_ids) ? b.company_ids.filter(Boolean) : [];
    if (idsEmpresa.length) {
      const patch: any = { comision_origen_at: new Date().toISOString() };
      if (limpiar) { patch.comision_owner_id = null; patch.comision_origen = null; }
      else {
        if (b.owner_id) patch.comision_owner_id = b.owner_id;
        if (b.origen) patch.comision_origen = b.origen;
      }
      if ('nota' in b) patch.comision_nota = (b.nota || '').trim() || null;
      const { data, error } = await supabase.from('companies').update(patch).in('id', idsEmpresa).select('id');
      if (error) throw error;
      return json({ ok: true, afectadas: (data || []).length });
    }

    // Override a nivel suscripción: una venta concreta que le tocó a otra
    // persona sin que la cuenta cambie de dueño.
    if (b.subscription_id) {
      const patch: any = {};
      if ('owner_id' in b) patch.comision_owner_id = b.owner_id || null;
      if ('origen' in b) patch.comision_origen = b.origen || null;
      const { error } = await supabase.from('subscriptions').update(patch).eq('id', b.subscription_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (b.company_id) {
      const patch: any = { comision_origen_at: new Date().toISOString() };
      if ('owner_id' in b) patch.comision_owner_id = b.owner_id || null;
      if ('origen' in b) patch.comision_origen = b.origen || null;
      if ('nota' in b) patch.comision_nota = (b.nota || '').trim() || null;
      const { error } = await supabase.from('companies').update(patch).eq('id', b.company_id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'Falta company_id, company_ids o subscription_id.' }, 400);
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
