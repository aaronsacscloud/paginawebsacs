// CHURN · un caso: leerlo entero y moverlo de etapa.
//
// TODA transición pasa por aquí y por `validarTransicion`. La UI esconde
// botones; esconder no es impedir. Quien pegue a mano se topa con la misma
// pared, y las tres reglas que más duelen viven además como constraints.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import {
  validarTransicion, camposDeTransicion, sincronizarHermanos, anotar,
  ETAPA, type Etapa,
} from '../../../../lib/crm/churn.lib';
import { avisoEnCuenta } from '../../../../lib/crm/prueba';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Falta el caso.' }, 400);

  const { data: caso, error } = await supabase.from('churn_casos')
    .select(`*, companies(id, nombre, nombre_comercial, sacs_account, sucursales, plan, estado_cuenta,
             dias_sin_venta, uso_sacs, actividad_sync_at, health_score)`)
    .eq('id', id).single();
  if (error || !caso) return json({ error: 'No existe ese caso.' }, 404);

  // La historia del caso y la de la cuenta son la MISMA: se pide por empresa,
  // no por caso, para que el rescate se lea con todo lo que ya pasó antes.
  const { data: historia } = await supabase.from('activities')
    .select('id, tipo, titulo, descripcion, created_at, automatico, churn_caso_id')
    .eq('company_id', caso.company_id).order('created_at', { ascending: false }).limit(60);

  // Los episodios anteriores: un reincidente se trabaja distinto y hay que verlo.
  const { data: episodios } = await supabase.from('churn_casos')
    .select('id, episodio, etapa, resultado, resultado_motivo, detectado_at, cerrado_at, mrr_perdido')
    .eq('company_id', caso.company_id).neq('id', id).order('episodio', { ascending: false });

  return json({ caso, historia: historia || [], episodios: episodios || [] });
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (!b.id) return json({ error: 'Falta el caso.' }, 400);

  const { data: caso } = await supabase.from('churn_casos').select('*').eq('id', b.id).single();
  if (!caso) return json({ error: 'No existe ese caso.' }, 404);

  // ── Edición simple (sin cambiar de etapa) ──
  if (!b.etapa) {
    const campos: any = { updated_at: new Date().toISOString() };
    for (const k of ['motivo_categoria', 'motivo_detalle', 'owner_id', 'proximo_paso', 'proximo_paso_at', 'notas']) {
      if (k in b) campos[k] = b[k];
    }
    /* Un próximo paso sin fecha se olvida: es exactamente el caso que este
       módulo existe para evitar. */
    if (campos.proximo_paso && !campos.proximo_paso_at) {
      return json({ error: 'Ponle fecha al próximo paso: sin fecha, no vuelve solo.' }, 400);
    }
    const { error } = await supabase.from('churn_casos').update(campos).eq('id', b.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // ── Transición de etapa ──
  const destino = b.etapa as Etapa;
  const falla = validarTransicion(caso, destino, b);
  if (falla) return json(falla, 400);

  const campos = camposDeTransicion(destino, b);
  if (b.motivo_categoria) campos.motivo_categoria = b.motivo_categoria;
  if (b.motivo_detalle) campos.motivo_detalle = String(b.motivo_detalle).trim();

  const { error } = await supabase.from('churn_casos').update(campos).eq('id', b.id);
  if (error) return json({ error: error.message }, 500);

  // Los campos hermanos, en el mismo acto.
  await sincronizarHermanos(caso, destino);

  /* Entrar a gracia devuelve el acceso a SACS. Que falle el desbloqueo NO
     revierte la etapa: son dos hechos distintos y se reporta el fallo para
     reintentarlo, igual que hace el módulo de pruebas. Lo contrario —tirar la
     transición— dejaría al equipo sin saber si el acuerdo quedó pactado. */
  let acceso: any = null;
  if (destino === 'gracia') {
    const { data: emp } = await supabase.from('companies').select('sacs_account').eq('id', caso.company_id).single();
    if (emp?.sacs_account) {
      const r = await avisoEnCuenta(emp.sacs_account, 'desbloquear');
      acceso = r.ok ? { ok: true } : { ok: false, error: r.error };
    } else {
      acceso = { ok: false, error: 'La empresa no tiene cuenta de SACS ligada.' };
    }
  }

  const detalle = destino === 'gracia'
    ? `${b.gracia_acuerdo} · hasta ${b.gracia_fin} · vuelve a $${Number(b.gracia_mrr).toLocaleString('es-MX')}`
    : destino === 'irrecuperable' ? String(b.resultado_motivo || '')
    : destino === 'recuperado' ? 'Suscripción nueva ligada al caso' : '';
  await anotar(caso, 'nota', `Pasó a ${ETAPA(destino).l}`, detalle, false);

  return json({ ok: true, acceso });
};
