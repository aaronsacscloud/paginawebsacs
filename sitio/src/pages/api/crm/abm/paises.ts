// Cuentas objetivo · POR PAÍS: el tablero desde el que se lanza y se frena la
// prospección de cada país sin tocar la base a mano.
//
// Por qué existe. La prospección dejó de ser «México y ya»: novias son once
// países y 3,565 cuentas que entraron `en_pausa` esperando el permiso del
// dueño. Soltarlas, encender su goteo, cambiarle el ritmo o ver cómo va cada
// país se hacía con SQL desde una terminal — o sea, solo yo podía hacerlo y
// no quedaba firma de quién lo autorizó. Aquí cada acción la hace una persona
// con su sesión y queda apuntada.
//
// GET  /api/crm/abm/paises?giro=novias → una fila por país: base, cuántas
//      esperan permiso, por dónde se les puede escribir, su cadencia (por
//      región), sus goteos, qué hora es allá y si estamos en su ventana.
// POST /api/crm/abm/paises { accion, … }
//   lanzar  { giro, pais }               → las cuentas que esperaban permiso pasan
//                                          a `sin_tocar` y los goteos del país se encienden
//   pausar  { giro, pais }               → los goteos del país se pausan (las cuentas
//                                          que ya andan en cadencia NO se tocan: eso lo
//                                          decide persona por persona)
//   ritmo   { pais, cuentas_dia }        → cuántas cuentas nuevas por día entran en ese país
//
// Lanzar es la aprobación de los correos de ese país: queda la firma de quien
// lo hizo en `abm_goteo.creado_por` y una nota en cada cuenta soltada… no, en
// la bitácora del goteo, que es lo que se lee después (una nota por cuenta
// serían 1,700 filas que nadie va a leer).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { PAISES, paisDe, horaLocalDe, enHorarioDe } from '../../../../lib/crm/abm-paises';
import { json, quien, limpiar } from '../../../../lib/crm/abm.lib';

export const prerender = false;

/** El motivo con el que el cargador por país deja las cuentas esperando permiso.
 *  Solo esas se sueltan: una cuenta en pausa por «no ahora, márcame en marzo»
 *  no es lo mismo y no se despierta de rebote. */
const MOTIVO_CARGA = 'Carga por país%';

export const GET: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  const giro = limpiar(new URL(request.url).searchParams.get('giro'), 40) || 'novias';

  const [{ data: base }, { data: toques }, { data: cadencias }, { data: goteos }] = await Promise.all([
    supabase.from('v_abm_paises').select('*').eq('giro', giro),
    supabase.from('v_abm_pais_toques').select('*').eq('giro', giro),
    supabase.from('abm_cadencias').select('id, nombre, region, ruta, activa').eq('giro', giro),
    supabase.from('abm_goteo').select('id, nombre, estado, cuentas_dia, filtro, con_ia, cadencia:abm_cadencias(giro, region, ruta)').neq('estado', 'terminado'),
  ]);

  const ahora = new Date();
  const filas = (base || []).map((b: any) => {
    const p = paisDe(b.pais);
    const mios = (toques || []).filter((t: any) => t.pais === b.pais);
    const canal = (c: string) => mios.find((t: any) => t.canal === c) || {};
    const gs = (goteos || []).filter((g: any) => (g.cadencia?.giro === giro) && paisDe(g.filtro?.pais).iso === p.iso);
    return {
      ...b,
      iso: p.iso, region: p.region, moneda: p.moneda, landing: p.landingNovias, legal: p.legal,
      hora_local: horaLocalDe(p.iso, ahora), en_ventana: enHorarioDe(p.iso, ahora),
      correo: canal('email'), whatsapp: canal('whatsapp'),
      cadencias: (cadencias || []).filter((c: any) => c.region === p.region).map((c: any) => ({ id: c.id, nombre: c.nombre, ruta: c.ruta, activa: c.activa })),
      goteos: gs.map((g: any) => ({ id: g.id, nombre: g.nombre, estado: g.estado, cuentas_dia: g.cuentas_dia, ruta: g.cadencia?.ruta, con_ia: g.con_ia })),
      // Un país está «lanzado» cuando al menos un goteo suyo está activo: es lo
      // único que hace que salga un correo.
      lanzado: gs.some((g: any) => g.estado === 'activo'),
      esperando_permiso: Number(b.en_pausa || 0),
    };
  }).sort((a: any, b: any) => (b.cuentas || 0) - (a.cuentas || 0));

  return json({ giro, paises: filas });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'json inválido' }, 400); }
  const accion = String(b?.accion || '');
  const giro = limpiar(b?.giro, 40) || 'novias';
  const p = PAISES[String(b?.pais || '').toLowerCase()] || null;
  if (!p) return json({ error: 'país desconocido' }, 400);

  /** Los goteos de ese país y ese giro. */
  const goteosDe = async () => {
    const { data } = await supabase.from('abm_goteo').select('id, filtro, estado, cadencia:abm_cadencias(giro)').neq('estado', 'terminado');
    return (data || []).filter((g: any) => g.cadencia?.giro === giro && paisDe(g.filtro?.pais).iso === p.iso);
  };

  if (accion === 'lanzar') {
    // 1 · Las cuentas que esperaban permiso entran a la fila. Por tandas: el
    //     update devuelve como mucho mil filas y España sola tiene 1,733.
    let soltadas = 0;
    for (let vuelta = 0; vuelta < 12; vuelta++) {
      const { data, error } = await supabase.from('abm_cuentas')
        .update({ etapa: 'sin_tocar', pausa_motivo: null, pausa_hasta: null, updated_at: new Date().toISOString() })
        .eq('giro', giro).eq('pais', p.nombre).eq('etapa', 'en_pausa').like('pausa_motivo', MOTIVO_CARGA)
        .select('id');
      if (error) return json({ error: error.message }, 500);
      soltadas += (data || []).length;
      if ((data || []).length < 1000) break;
    }
    // 2 · Y los goteos del país se encienden con la firma de quien lanza: esa
    //     es la aprobación de los correos que van a salir.
    const gs = await goteosDe();
    for (const g of gs) {
      if (g.estado === 'activo') continue;
      await supabase.from('abm_goteo').update({ estado: 'activo', creado_por: yo.id, updated_at: new Date().toISOString() }).eq('id', g.id);
    }
    return json({ ok: true, soltadas, goteos: gs.length, pais: p.nombre });
  }

  if (accion === 'pausar') {
    const gs = await goteosDe();
    for (const g of gs) {
      if (g.estado !== 'activo') continue;
      await supabase.from('abm_goteo').update({ estado: 'pausado', updated_at: new Date().toISOString() }).eq('id', g.id);
    }
    return json({ ok: true, goteos: gs.length, pais: p.nombre });
  }

  if (accion === 'ritmo') {
    const n = Math.min(100, Math.max(1, Math.round(Number(b?.cuentas_dia) || 10)));
    const gs = await goteosDe();
    for (const g of gs) await supabase.from('abm_goteo').update({ cuentas_dia: n, updated_at: new Date().toISOString() }).eq('id', g.id);
    return json({ ok: true, cuentas_dia: n, goteos: gs.length });
  }

  return json({ error: 'acción desconocida' }, 400);
};
