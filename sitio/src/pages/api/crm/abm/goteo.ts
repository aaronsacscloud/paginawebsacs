// Envíos progresivos (goteo): la opción con la que una base entra a su
// cadencia de a poco, N cuentas nuevas por día en vez de todas de golpe.
//
// GET  /api/crm/abm/goteo                       → los goteos, su avance, el estado del motor y las cadencias para crear uno
// POST /api/crm/abm/goteo { accion, … }
//   crear         { cadencia_id, cuentas_dia, filtro?, con_ia?, nombre?, nota? }
//   editar        { id, cuentas_dia?, filtro?, hasta?, con_ia?, nombre? }
//   pausar        { id }  ·  reanudar { id }
//   enrolar_ahora { id }  → corre el lote de hoy sin esperar al cartero (sigue sin MANDAR: eso es del cron)
//   motor         { pausado: 'si' | 'no' } → el interruptor global de abm_config
//
// El motor lo enciende una persona. Encender un goteo también lo hace una
// persona y queda con su firma: esa es la aprobación de los correos que el
// goteo va a dejar aprobados cada día (manual, regla 8.3).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, limpiar } from '../../../../lib/crm/abm.lib';
import { elegibles, correrGoteos } from '../../../../lib/crm/abm-goteo';

export const prerender = false;

async function motor() {
  const { data } = await supabase.from('abm_config').select('clave, valor, hasta, nota');
  const cfg: Record<string, any> = Object.fromEntries((data || []).map((r: any) => [r.clave, r]));
  const slug = String(cfg.tenant_slug?.valor || '').trim();
  let remitente: string | null = null;
  if (slug) {
    const { data: t } = await supabase.from('email_tenants').select('from_email').eq('slug', slug).maybeSingle();
    remitente = t?.from_email || null;
  }
  const faltas: string[] = [];
  if (!slug) faltas.push('No hay remitente para el correo en frío (abm_config.tenant_slug): el cartero no manda nada por el remitente de los clientes.');
  else if (!remitente) faltas.push(`El remitente «${slug}» no existe en email_tenants.`);
  if (!(import.meta.env.EMAIL_REPLY_DOMAIN || '').trim()) faltas.push('Falta EMAIL_REPLY_DOMAIN en el entorno: sin él una respuesta no frena la cadencia.');
  return {
    pausado: String(cfg.pausado?.valor || 'si'), pausado_nota: (cfg.pausado?.nota && !/\|/.test(cfg.pausado.nota)) ? cfg.pausado.nota : null, pausado_hasta: cfg.pausado?.hasta || null,
    remitente, faltas,
    cupo_inicial: Number(cfg.cupo_inicial?.valor || 15), tope_diario: Number(cfg.tope_diario?.valor || 120),
  };
}

export const GET: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);

  const [{ data: goteos }, { data: cadencias }, m] = await Promise.all([
    supabase.from('abm_goteo').select('*, cadencia:abm_cadencias(id, nombre, giro, ruta), autor:team_members(nombre)').order('created_at', { ascending: false }),
    supabase.from('abm_cadencias').select('id, nombre, giro, ruta').eq('activa', true).order('nombre'),
    motor(),
  ]);

  const salida: any[] = [];
  for (const g of goteos || []) {
    const [{ data: lotes }, { data: toques }, el] = await Promise.all([
      supabase.from('abm_goteo_lotes').select('fecha, cuentas, sin_ia, motivo, detalle').eq('goteo_id', g.id).order('fecha', { ascending: false }).limit(10),
      supabase.from('abm_toques').select('estado').eq('goteo_id', g.id).limit(5000),
      g.estado === 'terminado' ? Promise.resolve({ cuentas: [], total_base: 0 }) : elegibles(g, 500),
    ]);
    const porEstado: Record<string, number> = {};
    for (const t of toques || []) porEstado[t.estado] = (porEstado[t.estado] || 0) + 1;
    salida.push({
      ...g, autor: (g as any).autor?.nombre || null,
      lotes: lotes || [], toques: porEstado, quedan: el.cuentas.length, base: el.total_base,
      siguientes: el.cuentas.slice(0, Number(g.cuentas_dia) || 10).map((c: any) => ({ id: c.id, nombre: c.nombre, ciudad: c.ciudad, correo: c.correo, puntaje: c.puntaje })),
    });
  }
  return json({ goteos: salida, cadencias: cadencias || [], motor: m });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'json inválido' }, 400); }
  const accion = String(b?.accion || '');

  const filtroDe = (f: any) => {
    const out: Record<string, string> = {};
    if (f?.ciudad) out.ciudad = limpiar(f.ciudad, 80);
    if (f?.subgiro) out.subgiro = limpiar(f.subgiro, 80);
    return out;
  };
  const porDia = (v: any) => Math.min(100, Math.max(1, Math.round(Number(v) || 10)));

  if (accion === 'crear') {
    if (!esUuid(b.cadencia_id)) return json({ error: 'cadencia inválida' }, 400);
    const { data: cad } = await supabase.from('abm_cadencias').select('id, nombre').eq('id', b.cadencia_id).maybeSingle();
    if (!cad) return json({ error: 'esa cadencia no existe' }, 404);
    const filtro = filtroDe(b.filtro);
    const nombre = limpiar(b.nombre, 120) || `${cad.nombre} · ${porDia(b.cuentas_dia)} al día${filtro.ciudad ? ` · ${filtro.ciudad}` : ''}`;
    const { data, error } = await supabase.from('abm_goteo').insert({
      cadencia_id: cad.id, nombre, cuentas_dia: porDia(b.cuentas_dia), filtro,
      con_ia: b.con_ia !== false, estado: 'activo', creado_por: yo.id, nota: limpiar(b.nota, 400) || null,
      hasta: b.hasta ? String(b.hasta).slice(0, 10) : null,
    }).select('id').single();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, id: data.id });
  }

  if (!esUuid(b.id)) return json({ error: 'goteo inválido' }, 400);

  if (accion === 'editar') {
    const patch: any = { updated_at: new Date().toISOString() };
    if (b.cuentas_dia !== undefined) patch.cuentas_dia = porDia(b.cuentas_dia);
    if (b.filtro !== undefined) patch.filtro = filtroDe(b.filtro);
    if (b.con_ia !== undefined) patch.con_ia = !!b.con_ia;
    if (b.nombre !== undefined) patch.nombre = limpiar(b.nombre, 120) || undefined;
    if (b.hasta !== undefined) patch.hasta = b.hasta ? String(b.hasta).slice(0, 10) : null;
    const { error } = await supabase.from('abm_goteo').update(patch).eq('id', b.id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (accion === 'pausar' || accion === 'reanudar') {
    // Reanudar es volver a aprobar: la firma pasa a quien lo reanuda, porque
    // es quien está diciendo «que sigan saliendo».
    const patch: any = { estado: accion === 'pausar' ? 'pausado' : 'activo', updated_at: new Date().toISOString() };
    if (accion === 'reanudar') patch.creado_por = yo.id;
    const { error } = await supabase.from('abm_goteo').update(patch).eq('id', b.id).neq('estado', 'terminado');
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (accion === 'enrolar_ahora') {
    const { data: g } = await supabase.from('abm_goteo').select('estado').eq('id', b.id).maybeSingle();
    if (!g) return json({ error: 'no existe' }, 404);
    if (g.estado !== 'activo') return json({ error: 'el goteo está en pausa o terminado: reanúdalo primero' }, 409);
    const r = await correrGoteos({ solo_id: b.id, forzar: true, quien: yo.nombre });
    return json({ ok: true, lotes: r });
  }

  if (accion === 'motor') {
    const v = b.pausado === 'no' ? 'no' : 'si';
    const { error } = await supabase.from('abm_config')
      .update({ valor: v, hasta: null, nota: `${v === 'no' ? 'encendido' : 'pausado'} por ${yo.nombre} el ${new Date().toISOString().slice(0, 10)}` })
      .eq('clave', 'pausado');
    return error ? json({ error: error.message }, 500) : json({ ok: true, pausado: v });
  }

  return json({ error: 'acción desconocida' }, 400);
};
