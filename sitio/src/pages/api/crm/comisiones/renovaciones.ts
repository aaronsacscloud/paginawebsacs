// /api/crm/comisiones/renovaciones — las dos condiciones de la cláusula 4.
//
// La condición B (venderle a la cuenta al menos el 50% de lo del año anterior)
// es aritmética y se calcula sola. La condición A (contacto y seguimiento
// reales) es de criterio: la marca una persona, y hasta que alguien la marque
// la cuenta NO se castiga.
//
// Esa asimetría es deliberada. Un sistema que baja la comisión porque nadie
// capturó un dato es peor que no tener la regla: cobra de menos por un descuido
// administrativo y nadie se entera hasta que llega el reclamo.
//
// GET  ?anio=2026            → evaluaciones + lo que falta por marcar.
// POST { anio }              → recalcula la condición B de todo el año.
// PUT  { company_id, anio, condicion_a, nota }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { evaluarRenovaciones } from '../../../../lib/crm/comisiones.recalculo';

export const prerender = false;
const json = (o: any, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const anioValido = (n: any) => Number.isInteger(Number(n)) && Number(n) >= 2000 && Number(n) <= 2100;

export const GET: APIRoute = async ({ url }) => {
  try {
    const anio = anioValido(url.searchParams.get('anio'))
      ? Number(url.searchParams.get('anio'))
      : new Date().getFullYear();

    const { data, error } = await supabase.from('comision_evaluaciones')
      .select('*, companies(id, nombre, nombre_comercial, comision_owner_id, comision_origen)')
      .eq('anio', anio)
      .order('base_anterior', { ascending: false })
      .limit(1000);
    if (error) throw error;

    const filas = data || [];
    return json({
      anio,
      evaluaciones: filas,
      resumen: {
        total: filas.length,
        cumplen_b: filas.filter((f: any) => f.cumple_b).length,
        sin_marcar_a: filas.filter((f: any) => f.condicion_a == null).length,
        // Las que ya se sabe que NO cumplen: son las que van a cobrar tasa
        // reducida en su próxima renovación.
        no_cumplen: filas.filter((f: any) => f.cumple === false).length,
      },
    });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json().catch(() => ({}));
    const anio = anioValido(b.anio) ? Number(b.anio) : new Date().getFullYear();
    const r = await evaluarRenovaciones(anio);
    return json({ ok: true, ...r });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();
    if (!b.company_id || !anioValido(b.anio)) return json({ error: 'Falta la empresa o el año.' }, 400);

    const { data: actual } = await supabase.from('comision_evaluaciones')
      .select('id, cumple_b').eq('company_id', b.company_id).eq('anio', Number(b.anio)).maybeSingle();
    if (!actual) return json({ error: 'Esa cuenta no tiene evaluación de ese año. Recalcula primero.' }, 404);

    const condicion_a = b.condicion_a === null ? null : b.condicion_a === true;
    // `cumple` es la conjunción de las dos, y queda en NULL mientras A no se
    // marque: NULL significa "sin evaluar" y el motor lo trata como cumple.
    const cumple = condicion_a == null ? null : (condicion_a && actual.cumple_b);

    const { error } = await supabase.from('comision_evaluaciones')
      .update({ condicion_a, cumple, nota: (b.nota || '').trim() || null })
      .eq('id', actual.id);
    if (error) throw error;
    return json({ ok: true, cumple });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
