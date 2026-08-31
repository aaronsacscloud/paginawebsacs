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
             dias_sin_venta, uso_sacs, actividad, actividad_sync_at, ultima_venta_at, months_active, health_score)`)
    .eq('id', id).single();
  if (error || !caso) return json({ error: 'No existe ese caso.' }, 404);

  /* ── ¿ESTE CLIENTE SÍ LO USABA? ────────────────────────────────────────
     La ventana viva marca cero para todo el que se fue, así que no distingue
     al que operaba todos los días del que nunca arrancó — y esa diferencia es
     la que decide si vale la pena rescatarlo.
     Se contesta con lo que sí sobrevive: la foto que se guarda al abrir el
     caso, el mejor mes del histórico diario y la fecha de su última venta.
     Cuando no hay nada, se dice que no hay registro; pintar ceros diría que
     nunca lo usó, que es una afirmación distinta y probablemente falsa. */
  const co: any = (caso as any).companies || {};
  const { data: snaps } = await supabase.from('uso_snapshots')
    .select('fecha, ventas_30d, total_30d, usuarios_operando')
    .eq('company_id', (caso as any).company_id)
    .order('total_30d', { ascending: false, nullsFirst: false })
    .limit(1);
  const mejor = (snaps || [])[0] || null;
  const foto = (caso as any).actividad_al_abrir?.actividad || null;
  const usoAntes = {
    // El mejor 30 días del que tengamos registro, venga de la foto del caso o
    // del histórico diario — se queda el mayor de los dos.
    mejor_ventas: Math.max(Number(mejor?.ventas_30d || 0), Number(foto?.ventas_30d || 0)) || 0,
    mejor_monto: Math.max(Number(mejor?.total_30d || 0), Number(foto?.total_30d || 0)) || 0,
    mejor_fecha: Number(foto?.total_30d || 0) >= Number(mejor?.total_30d || 0) && foto
      ? ((caso as any).actividad_al_abrir?.tomada_at || null) : (mejor?.fecha || null),
    usuarios: Math.max(Number(mejor?.usuarios_operando || 0), Number(foto?.usuarios || 0)) || 0,
    ultima_venta_at: (caso as any).actividad_al_abrir?.ultima_venta_at || co.ultima_venta_at || null,
    dias_sin_venta: (caso as any).actividad_al_abrir?.dias_sin_venta ?? co.dias_sin_venta ?? null,
    meses_activo: (caso as any).actividad_al_abrir?.months_active ?? co.months_active ?? null,
    hay_registro: !!(mejor || foto),
    // Desde cuándo existe el histórico: sin esta fecha, un cero se lee como
    // «no lo usaba» cuando en realidad es «se fue antes de que midiéramos».
    historico_desde: null as string | null,
  };
  if (!usoAntes.mejor_ventas && !usoAntes.mejor_monto) {
    const { data: primero } = await supabase.from('uso_snapshots')
      .select('fecha').order('fecha', { ascending: true }).limit(1);
    usoAntes.historico_desde = (primero || [])[0]?.fecha || null;
  }

  // La historia del caso y la de la cuenta son la MISMA: se pide por empresa,
  // no por caso, para que el rescate se lea con todo lo que ya pasó antes.
  const { data: historia } = await supabase.from('activities')
    .select('id, tipo, titulo, descripcion, created_at, automatico, churn_caso_id')
    .eq('company_id', caso.company_id).order('created_at', { ascending: false }).limit(60);

  // Los episodios anteriores: un reincidente se trabaja distinto y hay que verlo.
  const { data: episodios } = await supabase.from('churn_casos')
    .select('id, episodio, etapa, resultado, resultado_motivo, detectado_at, cerrado_at, mrr_perdido')
    .eq('company_id', caso.company_id).neq('id', id).order('episodio', { ascending: false });

  /* Las suscripciones VIVAS de la empresa: son las únicas con las que se
     puede marcar recuperado, y mandarlas aquí evita que el vendedor tenga que
     salir a Suscripciones, copiar un uuid y volver. */
  const { data: subsVivas } = await supabase.from('subscriptions')
    .select('id, nombre_plan, ciclo, mrr, estado, fecha_inicio')
    .eq('company_id', caso.company_id)
    .in('estado', ['activa', 'programada', 'pendiente_pago'])
    .neq('id', caso.subscription_id || '00000000-0000-0000-0000-000000000000')
    .order('created_at', { ascending: false });

  const { data: cts } = await supabase.from('contacts')
    .select('whatsapp, telefono').eq('company_id', caso.company_id).limit(20);
  const tel = (cts || []).map((c: any) => c.whatsapp || c.telefono).find(Boolean) || null;

  // Las propuestas del caso: la vigente y las que quedaron reemplazadas.
  const { data: propuestas } = await supabase.from('quotes')
    .select('id, numero, estado, vigencia, created_at, vistas, primera_vista_at, ultima_vista_at, aceptado_por, aceptado_fecha, rechazado_fecha, rescate_desde, rescate_hasta, rescate_mrr_regreso, rescate_compromisos, rescate_esperamos')
    .eq('churn_caso_id', id).order('created_at', { ascending: false });

  /* Los compromisos, con su estado real: prometer en un PDF y no tener quién
     lo persiga es exactamente cómo se perdió esta gente la primera vez. */
  const { data: compromisos } = await supabase.from('mejoras')
    .select('id, titulo, estado, fecha_compromiso, fecha_entrega')
    .eq('company_id', caso.company_id).is('archived_at', null)
    .order('fecha_compromiso', { ascending: true });

  const { data: equipo } = await supabase.from('team_members')
    .select('id, nombre').eq('activo', true).order('nombre');

  return json({ caso, uso_antes: usoAntes, historia: historia || [], episodios: episodios || [], subs_vivas: subsVivas || [], equipo: equipo || [], tel, propuestas: propuestas || [], compromisos: compromisos || [] });
};

/** Un toque: lo que se hizo con el cliente, y qué sigue. */
export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const { data: caso } = await supabase.from('churn_casos').select('*').eq('id', b.id).single();
  if (!caso) return json({ error: 'No existe ese caso.' }, 404);

  if (b.accion === 'extender') {
    if (caso.etapa !== 'gracia') return json({ error: 'Solo se extiende una gracia en curso.' }, 400);
    if (!b.gracia_fin || String(b.gracia_fin) <= new Date().toISOString().slice(0, 10)) {
      return json({ error: 'La nueva fecha tiene que ser futura.', campo: 'gracia_fin' }, 400);
    }
    /* La SEGUNDA extensión exige explicar por qué. No se prohíbe —a veces hay
       razón— pero extender sin fin es regalar el sistema en cuotas, y la nota
       es lo que obliga a que alguien lo decida en vez de dejarlo correr. */
    if ((caso.gracia_extensiones || 0) >= 1 && !String(b.motivo || '').trim()) {
      return json({ error: 'Es la segunda extensión: escribe por qué se extiende otra vez.', campo: 'motivo' }, 400);
    }
    await supabase.from('churn_casos').update({
      gracia_fin: b.gracia_fin,
      gracia_extensiones: (caso.gracia_extensiones || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', b.id);
    await anotar(caso, 'nota', `Gracia extendida hasta ${b.gracia_fin}`,
      String(b.motivo || '') || `Extensión ${(caso.gracia_extensiones || 0) + 1}`, false);
    return json({ ok: true });
  }

  // Un toque normal.
  const texto = String(b.texto || '').trim();
  if (!texto) return json({ error: 'Escribe qué pasó.' }, 400);
  const tipo = ['nota', 'llamada', 'whatsapp', 'correo', 'reunion'].includes(b.tipo) ? b.tipo : 'nota';
  const TIT: Record<string, string> = { nota: 'Nota', llamada: 'Llamada', whatsapp: 'WhatsApp', correo: 'Correo', reunion: 'Reunión' };
  await anotar(caso, tipo, `${TIT[tipo]} · ${user.email || 'equipo'}`, texto, false);

  const campos: any = { updated_at: new Date().toISOString() };
  if (b.proximo_paso != null) {
    if (String(b.proximo_paso).trim() && !b.proximo_paso_at) {
      return json({ error: 'Ponle fecha al próximo paso: sin fecha, no vuelve solo.', campo: 'proximo_paso_at' }, 400);
    }
    campos.proximo_paso = String(b.proximo_paso).trim() || null;
    campos.proximo_paso_at = b.proximo_paso_at || null;
  }
  /* Registrar un contacto REAL mueve el caso a conciliación solo. La etapa
     describe lo que está pasando; pedirle además al vendedor que la mueva a
     mano es pedirle que le cuente al sistema lo que el sistema ya vio. */
  if (caso.etapa === 'detectado' && ['llamada', 'whatsapp', 'correo', 'reunion'].includes(tipo)) {
    Object.assign(campos, camposDeTransicion('conciliacion'));
    await anotar(caso, 'nota', 'Pasó a En conciliación', 'Automático: se registró el primer contacto.');
  }
  await supabase.from('churn_casos').update(campos).eq('id', b.id);
  return json({ ok: true, etapa: campos.etapa || caso.etapa });
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

  /* Recuperado exige que la suscripción sea REAL, de esta empresa, viva y
     distinta de la que se canceló. Con solo pedir que el uuid exista, pegar
     el id de la sub cancelada pasaba la validación y el constraint: quedaba
     un «recuperado» que no paga, que es justo el dato que esto existe para
     impedir — y contaminaba la tasa, el MRR recuperado y el ledger. */
  let subNueva: any = null;
  if (destino === 'recuperado') {
    const { data: sub } = await supabase.from('subscriptions')
      .select('id, company_id, estado, mrr').eq('id', b.subscription_nueva_id).maybeSingle();
    if (!sub) return json({ error: 'Esa suscripción no existe.', campo: 'subscription_nueva_id' }, 400);
    if (sub.company_id !== caso.company_id) return json({ error: 'Esa suscripción es de otra empresa.', campo: 'subscription_nueva_id' }, 400);
    if (sub.id === caso.subscription_id) return json({ error: 'Esa es la suscripción que canceló. Hace falta la NUEVA.', campo: 'subscription_nueva_id' }, 400);
    if (!['activa', 'programada', 'pendiente_pago'].includes(sub.estado)) {
      return json({ error: `Esa suscripción está ${sub.estado}: para recuperar tiene que estar viva.`, campo: 'subscription_nueva_id' }, 400);
    }
    subNueva = sub;
  }

  const campos = camposDeTransicion(destino, b);
  if (b.motivo_categoria) campos.motivo_categoria = b.motivo_categoria;
  if (b.motivo_detalle) campos.motivo_detalle = String(b.motivo_detalle).trim();

  /* La etapa de origen va en el WHERE: entre leer el caso y escribirlo, otra
     persona pudo moverlo. Sin esto, dos cierres simultáneos —uno «recuperado»
     y otro «perdido»— se pisaban sin que nadie se enterara. */
  const { data: tocadas, error } = await supabase.from('churn_casos')
    .update(campos).eq('id', b.id).eq('etapa', caso.etapa).select('id');
  if (error) return json({ error: error.message }, 500);
  if (!tocadas?.length) return json({ error: 'Alguien más movió este caso mientras lo trabajabas. Vuelve a abrirlo para ver cómo quedó.' }, 409);

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
