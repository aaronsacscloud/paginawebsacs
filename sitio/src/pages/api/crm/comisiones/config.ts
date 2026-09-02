// /api/crm/comisiones/config — el modelo de comisiones y sus reglas.
//
// GET  devuelve modelos + reglas + catálogo de SKUs + a quién le toca cada
//      modelo, todo junto: la pantalla de configuración necesita las cuatro
//      cosas a la vez y pedirlas por separado la dejaba parpadeando.
// POST crea un modelo · PUT edita modelo o regla · DELETE retira una regla.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const ORIGENES = ['lead_sacs', 'referido', 'recuperada', 'heredado'];
const CUENTAS = ['corporativa', 'pagadora', 'ninguna'];

export const GET: APIRoute = async () => {
  try {
    const [modelos, reglas, planes, miembros, ciclo] = await Promise.all([
      supabase.from('comision_modelos').select('*').order('es_default', { ascending: false }).order('nombre'),
      supabase.from('comision_reglas').select('*').order('created_at'),
      supabase.from('plans').select('id, slug, nombre, categoria, activo').order('categoria').order('orden'),
      supabase.from('team_members').select('id, nombre, email, rol, activo, comision_modelo_id, reclutado_por_id').order('nombre'),
      supabase.from('comision_ciclo').select('dia_cierre, dias_a_pago, arrastrar_desde').eq('id', true).maybeSingle(),
    ]);
    for (const r of [modelos, reglas, planes, miembros]) if (r.error) throw r.error;

    // Categorías que existen de verdad en el catálogo. La pantalla ofrece
    // estas y no una lista escrita a mano, para que un SKU de categoría nueva
    // no quede sin poder configurarse.
    const categorias = [...new Set((planes.data || []).map((p: any) => p.categoria).filter(Boolean))].sort();

    return json({
      modelos: modelos.data || [],
      reglas: reglas.data || [],
      planes: planes.data || [],
      miembros: miembros.data || [],
      categorias,
      ciclo: ciclo.data || { dia_cierre: 5, dias_a_pago: 3, arrastrar_desde: null },
    });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();

    if (b.tipo === 'regla') {
      if (b.pct == null || Number.isNaN(Number(b.pct))) return json({ error: 'Falta el porcentaje.' }, 400);
      if (Number(b.pct) < 0 || Number(b.pct) > 100) return json({ error: 'El porcentaje va de 0 a 100.' }, 400);
      if (b.pct_renovacion != null && b.pct_renovacion !== '' &&
          (Number.isNaN(Number(b.pct_renovacion)) || Number(b.pct_renovacion) < 0 || Number(b.pct_renovacion) > 100))
        return json({ error: 'La tasa de anualidad va de 0 a 100.' }, 400);
      if (b.origen && !ORIGENES.includes(b.origen)) return json({ error: 'Origen no válido.' }, 400);
      if (!b.modelo_id) return json({ error: 'Falta el modelo.' }, 400);
      // La categoría se valida contra el catálogo REAL y no contra una lista
      // escrita a mano: así una categoría nueva funciona sola, y un typo se
      // rechaza en vez de crear una regla que no casa con nada nunca.
      if (b.categoria && !b.plan_id) {
        const { data: cats } = await supabase.from('plans').select('categoria').eq('categoria', b.categoria).limit(1);
        if (!cats?.length) return json({ error: `No existe ningún SKU con la categoría "${b.categoria}".` }, 400);
      }
      // Una regla sin SKU y sin categoría aplica a TODO: se permite (es el
      // comodín), pero no puede además venir sin origen y duplicar el comodín
      // que ya exista — de eso se encarga el índice único.
      const fila = {
        modelo_id: b.modelo_id,
        plan_id: b.plan_id || null,
        categoria: b.plan_id ? null : (b.categoria || null),
        origen: b.origen || null,
        pct: Number(b.pct),
        pct_renovacion: b.pct_renovacion == null || b.pct_renovacion === '' ? null : Number(b.pct_renovacion),
        nota: (b.nota || '').trim() || null,
      };
      const { data, error } = await supabase.from('comision_reglas').insert(fila).select().single();
      if (error) {
        if (String(error.message).includes('duplicate') || error.code === '23505')
          return json({ error: 'Ya existe una regla para esa misma combinación.' }, 409);
        throw error;
      }
      return json({ regla: data });
    }

    // Modelo nuevo
    const nombre = (b.nombre || '').trim();
    if (!nombre) return json({ error: 'El modelo necesita un nombre.' }, 400);
    const { data, error } = await supabase.from('comision_modelos').insert({
      nombre,
      descripcion: (b.descripcion || '').trim() || null,
      desc_corporativa_pct: b.desc_corporativa_pct ?? 16,
      desc_pagadora_pct: b.desc_pagadora_pct ?? 6,
      cuenta_default: CUENTAS.includes(b.cuenta_default) ? b.cuenta_default : 'corporativa',
      tasa_incumplimiento_pct: b.tasa_incumplimiento_pct ?? null,
    }).select().single();
    if (error) throw error;
    return json({ modelo: data });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();

    if (b.tipo === 'regla') {
      if (!b.id) return json({ error: 'Falta el id de la regla.' }, 400);
      const patch: any = {};
      if (b.pct != null) {
        if (Number(b.pct) < 0 || Number(b.pct) > 100) return json({ error: 'El porcentaje va de 0 a 100.' }, 400);
        patch.pct = Number(b.pct);
      }
      // Vacío = la regla deja de distinguir y su renovación cobra `pct`.
      if ('pct_renovacion' in b) {
        const v = b.pct_renovacion === '' || b.pct_renovacion == null ? null : Number(b.pct_renovacion);
        if (v != null && (Number.isNaN(v) || v < 0 || v > 100))
          return json({ error: 'La tasa de anualidad va de 0 a 100.' }, 400);
        patch.pct_renovacion = v;
      }
      if ('nota' in b) patch.nota = (b.nota || '').trim() || null;
      const { data, error } = await supabase.from('comision_reglas').update(patch).eq('id', b.id).select().single();
      if (error) throw error;
      return json({ regla: data });
    }

    // El ciclo de pago: de qué día a qué día corre el corte. Es de la empresa,
    // no de cada persona: cortes con calendarios distintos harían imposible
    // cuadrar una semana.
    if (b.tipo === 'ciclo') {
      const dia = Number(b.dia_cierre), dias = Number(b.dias_a_pago);
      if (!Number.isInteger(dia) || dia < 1 || dia > 7) return json({ error: 'El día de cierre va de 1 (lunes) a 7 (domingo).' }, 400);
      if (!Number.isInteger(dias) || dias < 0 || dias > 14) return json({ error: 'Los días hasta el pago van de 0 a 14.' }, 400);
      // El piso del arrastre. Mover esta fecha hacia atrás hace que el
      // siguiente corte automático recoja las líneas viejas que nunca entraron
      // a ninguno: es la palanca con la que se decide si la historia se paga.
      const piso = b.arrastrar_desde === null ? null : String(b.arrastrar_desde || '');
      if (piso !== null && !/^\d{4}-\d{2}-\d{2}$/.test(piso))
        return json({ error: 'La fecha desde la que se arrastra no es válida.' }, 400);
      const { error } = await supabase.from('comision_ciclo')
        .update({ dia_cierre: dia, dias_a_pago: dias, arrastrar_desde: piso, actualizado_at: new Date().toISOString() })
        .eq('id', true);
      if (error) throw error;
      return json({ ok: true });
    }

    // Asignar el modelo de una persona. Es la pieza que hace que cada
    // consultor pueda tener condiciones distintas.
    if (b.tipo === 'asignar') {
      if (!b.team_member_id) return json({ error: 'Falta la persona.' }, 400);
      const patch: any = {};
      if ('modelo_id' in b) patch.comision_modelo_id = b.modelo_id || null;
      // Quién lo reclutó al canal: es lo que dispara el override del 10%.
      if ('reclutado_por_id' in b) {
        if (b.reclutado_por_id === b.team_member_id)
          return json({ error: 'Nadie puede reclutarse a sí mismo.' }, 400);
        patch.reclutado_por_id = b.reclutado_por_id || null;
      }
      const { error } = await supabase.from('team_members').update(patch).eq('id', b.team_member_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (!b.id) return json({ error: 'Falta el id del modelo.' }, 400);
    const patch: any = { updated_at: new Date().toISOString() };
    for (const k of ['nombre', 'descripcion', 'desc_corporativa_pct', 'desc_pagadora_pct', 'cuenta_default', 'tasa_incumplimiento_pct', 'tope_descuento_pct', 'override_partner_pct', 'dias_gracia_cobro', 'activo']) {
      if (k in b) patch[k] = b[k];
    }
    if (patch.cuenta_default && !CUENTAS.includes(patch.cuenta_default))
      return json({ error: 'Cuenta no válida.' }, 400);

    // Cambiar el modelo por defecto: primero se baja el anterior, porque hay un
    // índice único parcial y ponerlo al revés revienta.
    if (b.es_default === true) {
      await supabase.from('comision_modelos').update({ es_default: false }).neq('id', b.id);
      patch.es_default = true;
    }
    const { data, error } = await supabase.from('comision_modelos').update(patch).eq('id', b.id).select().single();
    if (error) throw error;
    return json({ modelo: data });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

export const DELETE: APIRoute = async ({ url }) => {
  try {
    const id = url.searchParams.get('regla_id');
    if (!id) return json({ error: 'Falta regla_id.' }, 400);
    // Las líneas ya calculadas apuntan a la regla con ON DELETE SET NULL: se
    // quedan con su porcentaje escrito, que es el que se pagó.
    const { error } = await supabase.from('comision_reglas').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
