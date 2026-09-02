// /api/crm/comisiones/periodo — lo que hay que pagar en un rango de fechas.
//
// GET  ?desde&hasta[&owner_id][&estado]  → resumen por persona + el detalle.
// POST { accion:'recalcular' | 'marcar_pagado' | 'aprobar' | 'cancelar' }
//
// El periodo se define por la FECHA DEL PAGO del cliente, no por la fecha de
// cálculo: se comisiona dinero cobrado, y el corte es cuándo entró.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { recalcularComisiones } from '../../../../lib/crm/comisiones.recalculo';
import { r2 } from '../../../../lib/crm/comisiones.lib';

// Los totales del periodo se calculan sobre TODAS las líneas, no sobre la
// primera página. Con `.limit(3000)` la tarjeta "Comisión del periodo" habría
// empezado a mostrar un número falso sin que nada lo indicara.
const PAGINA = 1000;
async function leerTodo(construir: () => any, tope = 30000) {
  const filas: any[] = [];
  for (let off = 0; off < tope; off += PAGINA) {
    const { data, error } = await construir().range(off, off + PAGINA - 1);
    if (error) throw error;
    filas.push(...(data || []));
    if (!data || data.length < PAGINA) return { filas, truncado: false };
  }
  return { filas, truncado: true };
}

export const prerender = false;
const json = (o: any, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const HOY = () => new Date().toISOString().slice(0, 10);
const esFecha = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export const GET: APIRoute = async ({ url }) => {
  try {
    const p = url.searchParams;
    const hoy = HOY();
    const desde = esFecha(p.get('desde')) ? p.get('desde')! : hoy.slice(0, 8) + '01';
    const hasta = esFecha(p.get('hasta')) ? p.get('hasta')! : hoy;
    const owner_id = p.get('owner_id') || '';
    const estado = p.get('estado') || '';

    const construirLineas = () => {
      let q = supabase.from('comision_lineas')
        .select('*, team_members(id, nombre, email), companies(id, nombre, nombre_comercial), payments(id, referencia, metodo)')
        .gte('fecha', desde).lte('fecha', hasta)
        .order('fecha', { ascending: false }).order('id');
      if (owner_id) q = q.eq('owner_id', owner_id);
      if (estado) q = q.eq('estado', estado);
      return q;
    };
    const { filas: lineas, truncado } = await leerTodo(construirLineas);

    // ── Resumen por persona ──
    // Las canceladas se listan pero NO suman: una comisión revertida sigue
    // siendo parte del expediente del periodo, y esconderla es lo que hace que
    // luego nadie entienda por qué el total no cuadra con la lista.
    type Fila = {
      owner_id: string; nombre: string; email: string;
      lineas: number; bruto: number; base: number; monto: number;
      por_pagar: number; pagado: number; sin_regla: number; overrides: number; tardias: number;
    };
    const porPersona = new Map<string, Fila>();
    let sinRegla = 0, tardias = 0;
    for (const l of (lineas || []) as any[]) {
      const k = l.owner_id;
      if (!porPersona.has(k)) porPersona.set(k, {
        owner_id: k, nombre: l.team_members?.nombre || '—', email: l.team_members?.email || '',
        lineas: 0, bruto: 0, base: 0, monto: 0, por_pagar: 0, pagado: 0, sin_regla: 0, overrides: 0, tardias: 0,
      });
      const f = porPersona.get(k)!;
      f.lineas++;
      if (l.sin_regla) { f.sin_regla++; sinRegla++; }
      if (l.fuera_de_tiempo) { f.tardias++; tardias++; }
      if (l.estado === 'cancelada') continue;
      if (l.tipo === 'override_partner') f.overrides++;
      // El bruto de un override NO se suma: es el MISMO dinero cobrado que ya
      // contó la línea de la venta. Sumarlo duplicaría el "cobrado" del periodo.
      if (l.tipo !== 'override_partner') f.bruto = r2(f.bruto + Number(l.monto_bruto || 0));
      if (l.tipo !== 'override_partner') f.base = r2(f.base + Number(l.base || 0));
      f.monto = r2(f.monto + Number(l.monto || 0));
      if (l.estado === 'pagada') f.pagado = r2(f.pagado + Number(l.monto || 0));
      else f.por_pagar = r2(f.por_pagar + Number(l.monto || 0));
    }
    const resumen = [...porPersona.values()].sort((a, b) => b.monto - a.monto);

    // ── Trabajo pendiente que NO se ve en las líneas ──
    // Pagos del periodo que no generaron línea porque nadie tiene asignada la
    // cuenta. Es el hueco más caro del sistema: dinero cobrado que no le está
    // contando a nadie. Va en la respuesta para que la pantalla lo grite.
    const { filas: sinDuenoRaw } = await leerTodo(() => supabase.from('payments')
      .select('id, fecha, monto, reembolsado, company_id, companies(id, nombre, nombre_comercial, comision_owner_id), subscriptions(comision_owner_id)')
      .gte('fecha', desde).lte('fecha', hasta)
      .or('estado.is.null,estado.not.in.(anulado,cancelado,duplicado)')
      .order('fecha').order('id'));
    // Un pago reembolsado no es dinero pendiente de atribuir: inflaba la cifra
    // del aviso con plata que ya se devolvió.
    const sinAtribuir = (sinDuenoRaw || []).filter((x: any) =>
      x.reembolsado !== true && !x.subscriptions?.comision_owner_id && !x.companies?.comision_owner_id);

    // La lista de consultores del filtro sale de aquí y NO del resumen: si
    // saliera del resumen, al elegir a una persona el desplegable se quedaría
    // solo con ella y no habría forma de saltar a otra.
    const { data: personas } = await supabase.from('team_members')
      .select('id, nombre').eq('activo', true).order('nombre');

    return json({
      desde, hasta, truncado,
      lineas: lineas || [],
      resumen, personas: personas || [],
      totales: {
        monto: r2(resumen.reduce((a, f) => a + f.monto, 0)),
        por_pagar: r2(resumen.reduce((a, f) => a + f.por_pagar, 0)),
        pagado: r2(resumen.reduce((a, f) => a + f.pagado, 0)),
        lineas: (lineas || []).length,
        sin_regla: sinRegla,
        tardias,
      },
      sin_atribuir: {
        pagos: sinAtribuir.length,
        monto: r2(sinAtribuir.reduce((a: number, x: any) => a + Number(x.monto || 0), 0)),
        muestra: sinAtribuir.slice(0, 20).map((x: any) => ({
          id: x.id, fecha: x.fecha, monto: Number(x.monto || 0),
          empresa: x.companies?.nombre_comercial || x.companies?.nombre || 'Sin empresa',
          company_id: x.company_id,
        })),
      },
    });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();

    if (b.accion === 'recalcular') {
      const hoy = HOY();
      const desde = esFecha(b.desde) ? b.desde : hoy.slice(0, 8) + '01';
      const hasta = esFecha(b.hasta) ? b.hasta : hoy;
      const r = await recalcularComisiones(desde, hasta);
      return json({ ok: true, resultado: r });
    }

    const ids: string[] = Array.isArray(b.ids) ? b.ids.filter(Boolean) : [];
    if (!ids.length) return json({ error: 'No hay líneas seleccionadas.' }, 400);

    if (b.accion === 'marcar_pagado') {
      // Solo se marcan las que NO están pagadas: reintentar el botón no debe
      // mover la fecha de pago de algo que ya se liquidó.
      const { data, error } = await supabase.from('comision_lineas')
        .update({
          estado: 'pagada',
          pagada_at: new Date().toISOString(),
          pago_referencia: (b.referencia || '').trim() || null,
        })
        .in('id', ids).not('estado', 'in', '(pagada)').select('id');
      if (error) throw error;
      return json({ ok: true, afectadas: (data || []).length });
    }

    if (b.accion === 'aprobar') {
      const { data, error } = await supabase.from('comision_lineas')
        .update({ estado: 'aprobada' }).in('id', ids).eq('estado', 'calculada').select('id');
      if (error) throw error;
      return json({ ok: true, afectadas: (data || []).length });
    }

    if (b.accion === 'cancelar') {
      const { data, error } = await supabase.from('comision_lineas')
        .update({ estado: 'cancelada', monto: 0 }).in('id', ids).neq('estado', 'pagada').select('id');
      if (error) throw error;
      return json({ ok: true, afectadas: (data || []).length });
    }

    return json({ error: 'Acción no reconocida.' }, 400);
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
