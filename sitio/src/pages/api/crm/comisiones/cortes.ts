// /api/crm/comisiones/cortes — el corte semanal: generarlo, verlo, cerrarlo y pagarlo.
//
// GET                       lista de cortes (?estado, ?owner_id, ?limit)
// GET  ?id=X                el detalle: líneas, ajustes y los pagos que no
//                           produjeron comisión en ese rango
// POST {accion:'generar'}   arma los cortes de un rango. Sin fechas usa la
//                           semana cerrada (lunes→viernes) y lo marca automático.
// PUT  {id, accion}         'cerrar' | 'reabrir' | 'pagar' | 'nota'
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { generarCortes, semanaEnCurso, proyeccionCorte, ARMADO, fechaDePago, leerCiclo, pagosNoReconocidos, CORTES_FIRMES } from '../../../../lib/crm/comisiones.cortes';

export const prerender = false;
const json = (o: any, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const esFecha = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export const GET: APIRoute = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');

    // ── Detalle de un corte ──
    if (id) {
      const { data: corte, error } = await supabase.from('comision_cortes')
        .select('*, team_members(id, nombre, email)').eq('id', id).single();
      if (error || !corte) return json({ error: 'Corte no encontrado.' }, 404);

      const [{ data: lineas }, { data: ajustes }] = await Promise.all([
        supabase.from('comision_lineas')
          .select('*, companies(id, nombre, nombre_comercial), payments(referencia, metodo)')
          .eq('corte_id', id).order('fecha'),
        supabase.from('comision_ajustes')
          .select('*').eq('corte_id', id).order('created_at'),
      ]);

      // Solo tiene sentido ofrecer pagos sueltos si el corte todavía admite
      // cambios: en uno cerrado ya no se puede agregar nada.
      const noReconocidos = CORTES_FIRMES.includes(corte.estado)
        ? [] : await pagosNoReconocidos(corte.desde, corte.hasta);

      return json({ corte, lineas: lineas || [], ajustes: ajustes || [], no_reconocidos: noReconocidos });
    }

    // ── Previa: qué de este rango YA está en otro corte ──
    //
    // El asistente la pide antes de crear nada. Sin esto, el paso 2 prometía
    // todas las líneas del periodo y el corte salía con menos, sin explicación
    // — y un total menor sin motivo es lo que hace desconfiar del sistema.
    const pDesde = url.searchParams.get('previa_desde');
    const pHasta = url.searchParams.get('previa_hasta');
    if (pDesde && pHasta) {
      const { data: lin } = await supabase.from('comision_lineas')
        .select('id, fecha, monto, corte_id, owner_id, companies(nombre, nombre_comercial), team_members!comision_lineas_owner_id_fkey(nombre)')
        .gte('fecha', pDesde).lte('fecha', pHasta)
        .not('corte_id', 'is', null)
        .neq('estado', 'cancelada')
        .limit(5000);

      const ids = [...new Set((lin || []).map((l: any) => l.corte_id))] as string[];
      const cortes = new Map<string, any>();
      if (ids.length) {
        const { data } = await supabase.from('comision_cortes').select('id, estado, desde, hasta').in('id', ids);
        for (const c of data || []) cortes.set(c.id, c);
      }
      const detalle = (lin || []).map((l: any) => {
        const c = cortes.get(l.corte_id);
        return {
          cliente: l.companies?.nombre_comercial || l.companies?.nombre || '—',
          consultor: l.team_members?.nombre || '—',
          fecha: l.fecha, monto: Number(l.monto || 0),
          corte_id: l.corte_id, estado: c?.estado || 'desconocido',
          periodo: c ? `${c.desde} → ${c.hasta}` : '—',
        };
      });
      return json({
        ya_cortadas: {
          total: detalle.length,
          monto: Math.round(detalle.reduce((a, d) => a + d.monto, 0) * 100) / 100,
          detalle,
        },
      });
    }

    // ── Listado ──
    let q = supabase.from('comision_cortes')
      .select('*, team_members(id, nombre)')
      .order('desde', { ascending: false }).order('created_at', { ascending: false })
      .limit(Math.min(Number(url.searchParams.get('limit') || 60), 200));
    const estado = url.searchParams.get('estado');
    const owner = url.searchParams.get('owner_id');
    if (estado) q = q.eq('estado', estado);
    if (owner) q = q.eq('owner_id', owner);
    const { data, error } = await q;
    if (error) throw error;

    // Ajustes pendientes: no cuelgan de ningún corte todavía y hay que verlos,
    // porque son dinero comprometido que aún no aparece en ninguna suma.
    const { data: pend } = await supabase.from('comision_ajustes')
      .select('owner_id, tipo, monto, concepto, team_members!comision_ajustes_owner_id_fkey(nombre)')
      .is('corte_id', null);

    // ── El corte que se está juntando ──
    // Va con la lista porque es una fila más del tablero, no una pantalla
    // aparte: la pregunta "¿cuánto llevo?" se hace mirando los cortes.
    const ciclo = await leerCiclo();
    const enCurso = semanaEnCurso(new Date(), ciclo);
    const proyeccion = await proyeccionCorte(enCurso.desde, enCurso.hasta, ciclo.arrastrar_desde);

    return json({
      cortes: data || [],
      en_formacion: { ...enCurso, hora: ARMADO.hora, consultores: proyeccion },
      ciclo,
      sugerido: { ...enCurso, hora: ARMADO.hora },
      pendientes: (pend || []).map((a: any) => ({
        owner_id: a.owner_id, nombre: a.team_members?.nombre || '—',
        concepto: a.concepto, tipo: a.tipo, monto: Number(a.monto || 0),
      })),
    });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const b = await request.json().catch(() => ({}));
    if (b.accion && b.accion !== 'generar') return json({ error: 'Acción no reconocida.' }, 400);

    // Sin fechas = el corte QUE SE ESTÁ JUNTANDO, no el ya cerrado.
    //
    // Antes usaba `semanaCerrada`, que en miércoles devuelve la semana ANTERIOR
    // —la que el cron ya armó el lunes—. Desde la pantalla eso no tiene sentido:
    // el asistente proponía un periodo pasado y el botón de adelantar el corte
    // creaba el equivocado. `semanaEnCurso` es justo lo que armará el próximo
    // cron, así que adelantarlo y esperarlo dan el mismo corte.
    const auto = !esFecha(b.desde) || !esFecha(b.hasta);
    const ciclo = await leerCiclo();
    const s = semanaEnCurso(new Date(), ciclo);
    const desde = auto ? s.desde : b.desde;
    const hasta = auto ? s.hasta : b.hasta;
    if (hasta < desde) return json({ error: 'El rango está al revés.' }, 400);

    const r = await generarCortes(desde, hasta, {
      automatico: auto,
      paga_el: auto ? s.paga_el : fechaDePago(hasta, ciclo.dias_a_pago),
      owner_id: b.owner_id || undefined,
      // Solo el corte automático recoge rezagadas. Un corte MANUAL se pide con
      // un rango explícito —"lo de agosto"— y arrastrarle lo de julio daría un
      // documento que no corresponde con el periodo que dice arriba.
      arrastrar_desde: auto ? ciclo.arrastrar_desde : null,
    });
    return json({ ok: true, resultado: r });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const b = await request.json();
    if (!b.id) return json({ error: 'Falta el corte.' }, 400);

    const { data: corte } = await supabase.from('comision_cortes')
      .select('id, estado').eq('id', b.id).single();
    if (!corte) return json({ error: 'Corte no encontrado.' }, 404);

    if (b.accion === 'cerrar') {
      if (corte.estado !== 'abierto') return json({ error: `El corte ya está ${corte.estado}.` }, 409);
      await supabase.from('comision_cortes')
        .update({ estado: 'cerrado', cerrado_at: new Date().toISOString() }).eq('id', b.id);
      return json({ ok: true, estado: 'cerrado' });
    }

    if (b.accion === 'reabrir') {
      // Un corte PAGADO no se reabre: el dinero ya salió. Lo que se corrige es
      // con un ajuste en el corte siguiente, que además deja rastro.
      if (corte.estado === 'pagado')
        return json({ error: 'Un corte pagado no se reabre. Corrige con un ajuste en el siguiente.' }, 409);
      await supabase.from('comision_cortes')
        .update({ estado: 'abierto', cerrado_at: null }).eq('id', b.id);
      return json({ ok: true, estado: 'abierto' });
    }

    if (b.accion === 'pagar') {
      if (corte.estado === 'pagado') return json({ error: 'Ese corte ya estaba pagado.' }, 409);
      const ahora = new Date().toISOString();
      await supabase.from('comision_cortes').update({
        estado: 'pagado', pagado_at: ahora,
        cerrado_at: corte.estado === 'abierto' ? ahora : undefined,
        pago_referencia: (b.referencia || '').trim() || null,
      }).eq('id', b.id);
      // Las líneas del corte quedan pagadas: es lo que las congela para siempre
      // frente al recálculo de cada madrugada.
      const { data } = await supabase.from('comision_lineas')
        .update({ estado: 'pagada', pagada_at: ahora, pago_referencia: (b.referencia || '').trim() || null })
        .eq('corte_id', b.id).neq('estado', 'pagada').select('id');
      return json({ ok: true, estado: 'pagado', lineas_marcadas: (data || []).length });
    }

    if (b.accion === 'nota') {
      await supabase.from('comision_cortes').update({ nota: (b.nota || '').trim() || null }).eq('id', b.id);
      return json({ ok: true });
    }

    return json({ error: 'Acción no reconocida.' }, 400);
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

/**
 * DELETE /api/crm/comisiones/cortes?id=X — borrar un corte.
 *
 * Las llaves foráneas son ON DELETE SET NULL, así que borrar el corte NO borra
 * sus líneas ni sus ajustes: los suelta. Las líneas vuelven a estar disponibles
 * y los ajustes vuelven a la fila de pendientes, así que el siguiente corte los
 * recoge y no se pierde dinero.
 *
 * PERO hay una trampa que sí paga doble. Las líneas de un corte PAGADO quedan
 * en estado `pagada`; al soltarlas seguirían diciendo "pagada" mientras que
 * `generarCortes` solo descarta las canceladas — así que entrarían enteras al
 * siguiente corte y se cobrarían OTRA VEZ. Por eso al borrar se regresan a
 * `calculada`: si el registro del pago desaparece, para el sistema ese dinero
 * no se ha pagado. Es coherente, y es justo lo que lo vuelve peligroso.
 *
 * De ahí el candado: un corte pagado exige `confirmar: true` en el cuerpo. Los
 * abiertos y los enviados se borran con la confirmación normal de la pantalla.
 */
export const DELETE: APIRoute = async ({ url, request }) => {
  try {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Falta el corte.' }, 400);
    const b = await request.json().catch(() => ({}));

    const { data: c } = await supabase.from('comision_cortes')
      .select('id, estado, desde, hasta, lineas, total').eq('id', id).maybeSingle();
    if (!c) return json({ error: 'Ese corte ya no existe.' }, 404);

    if (c.estado === 'pagado' && b.confirmar !== true) {
      return json({
        error: 'Este corte ya está pagado. Borrarlo deja sus líneas como NO pagadas y volverán a entrar al siguiente corte.',
        requiere_confirmacion: true, lineas: c.lineas, total: c.total,
      }, 409);
    }

    // Primero las líneas, después el corte: si el borrado fallara a medias,
    // es preferible tener líneas sueltas —que el próximo corte recoge— que un
    // corte sin líneas mostrando un total que ya no puede justificar.
    const { error: e1 } = await supabase.from('comision_lineas')
      .update({ corte_id: null, estado: 'calculada', pagada_at: null, pago_referencia: null })
      .eq('corte_id', id);
    if (e1) throw e1;

    const { error: e2 } = await supabase.from('comision_ajustes')
      .update({ corte_id: null }).eq('corte_id', id);
    if (e2) throw e2;

    const { error: e3 } = await supabase.from('comision_cortes').delete().eq('id', id);
    if (e3) throw e3;

    return json({ ok: true, borrado: { desde: c.desde, hasta: c.hasta, estado: c.estado, lineas: c.lineas } });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
