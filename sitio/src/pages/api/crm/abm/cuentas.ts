// Cuentas objetivo del motor Account-Based.
//
// GET  /api/crm/abm/cuentas                    → lista con filtros y conteos
//      ?giro= &etapa= &ruta= &canal=email|wa &q= &orden=puntaje|nombre|rating &pagina=
// GET  /api/crm/abm/cuentas?id=                → la ficha 360 completa
// POST /api/crm/abm/cuentas { accion, … }
//   etapa        { id, etapa }
//   responsable  { id, responsable_id }
//   confirmar    { id, campo, valor }            ← lo que nos dijeron GANA sobre lo investigado
//   persona      { id, nombre, cargo?, email?, whatsapp?, telefono?, es_dueno? }
//   canal        { id, tipo, valor, confianza?, es_de_la_tienda? }
//   canal_estado { canal_id, estado }
//   nota         { id, texto }
//   no_contactar { id, motivo? }                 ← se honra en TODOS los canales, para siempre
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, limpiar, apuntar, calcularPuntaje, rutaDe, ETAPAS } from '../../../../lib/crm/abm.lib';

export const prerender = false;

const SEL = 'id, nombre, giro, subgiro, ciudad, pais, moneda, sucursales, sucursales_confianza, tamano, ruta, ' +
  'sitio, plataforma_web, sitio_http, sitio_carrito, sitio_seg, instagram, ig_seguidores, tiktok, facebook, linkedin, ' +
  'google_rating, google_resenas, contexto, senal_expansion, ultima_publicacion, nota, ' +
  'encaje, dolor, accesibilidad, puntaje, etapa, responsable_id, ya_es_cliente, created_at, updated_at';

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);

  const id = url.searchParams.get('id');
  if (id) {
    if (!esUuid(id)) return json({ error: 'id inválido' }, 400);
    const { data: cuenta } = await supabase.from('abm_cuentas').select(SEL).eq('id', id).maybeSingle();
    if (!cuenta) return json({ error: 'no existe' }, 404);
    const [canales, personas, fuentes, senales, actividad, toques] = await Promise.all([
      supabase.from('abm_canales').select('id, tipo, valor, confianza, estado, es_de_la_tienda, persona_id').eq('cuenta_id', id).order('tipo'),
      supabase.from('abm_personas').select('id, nombre, cargo, es_dueno, email, telefono, whatsapp, linkedin, facebook, instagram, confirmado, confirmado_at').eq('cuenta_id', id).order('created_at'),
      supabase.from('abm_fuentes').select('id, campo, valor, url, metodo, confianza, obtenido_at').eq('cuenta_id', id).order('obtenido_at', { ascending: false }),
      supabase.from('abm_senales').select('id, tipo, detalle, url, fecha, peso').eq('cuenta_id', id).order('fecha', { ascending: false }),
      supabase.from('abm_actividad').select('id, canal, tipo, texto, transcripcion, detalle, ocurrio_at').eq('cuenta_id', id).order('ocurrio_at', { ascending: false }).limit(120),
      supabase.from('abm_toques').select('id, canal, destino, asunto, cuerpo, estado, programado_at, enviado_at, resultado').eq('cuenta_id', id).order('programado_at', { ascending: true }).limit(40),
    ]);
    return json({
      cuenta, canales: canales.data || [], personas: personas.data || [], fuentes: fuentes.data || [],
      senales: senales.data || [], actividad: actividad.data || [], toques: toques.data || [],
    });
  }

  const giro = url.searchParams.get('giro') || '';
  const etapa = url.searchParams.get('etapa') || '';
  const ruta = url.searchParams.get('ruta') || '';
  const canal = url.searchParams.get('canal') || '';
  const q = limpiar(url.searchParams.get('q') || '', 80);
  const orden = url.searchParams.get('orden') || 'puntaje';
  const pagina = Math.max(0, Number(url.searchParams.get('pagina') || 0));
  const POR = 60;

  let sel = supabase.from('abm_cuentas').select(SEL, { count: 'exact' });
  if (giro) sel = sel.eq('giro', giro);
  if (etapa) sel = sel.eq('etapa', etapa);
  if (ruta) sel = sel.eq('ruta', ruta);
  if (q) sel = sel.or(`nombre.ilike.%${q}%,ciudad.ilike.%${q}%,contexto.ilike.%${q}%,nota.ilike.%${q}%`);
  if (canal) {
    const tipos = canal === 'email' ? ['email_direccion', 'email_generico'] : canal === 'wa' ? ['whatsapp_tienda', 'whatsapp_dueno'] : [canal];
    const { data: ids } = await supabase.from('abm_canales').select('cuenta_id').in('tipo', tipos).limit(5000);
    const lista = Array.from(new Set((ids || []).map((r: any) => r.cuenta_id)));
    sel = lista.length ? sel.in('id', lista) : sel.eq('id', '00000000-0000-0000-0000-000000000000');
  }
  sel = orden === 'nombre' ? sel.order('nombre')
      : orden === 'rating' ? sel.order('google_rating', { ascending: false, nullsFirst: false })
      : orden === 'sucursales' ? sel.order('sucursales', { ascending: false, nullsFirst: false })
      : sel.order('puntaje', { ascending: false });
  const { data, count, error } = await sel.range(pagina * POR, pagina * POR + POR - 1);
  if (error) return json({ error: error.message }, 500);

  // Los canales de la página, para que la tabla muestre por dónde entrarle
  const ids = (data || []).map((c: any) => c.id);
  const { data: cans } = ids.length
    ? await supabase.from('abm_canales').select('cuenta_id, tipo, valor, confianza, estado').in('cuenta_id', ids)
    : { data: [] as any[] };
  const porCuenta: Record<string, any[]> = {};
  for (const c of cans || []) (porCuenta[c.cuenta_id] ||= []).push(c);

  return json({
    cuentas: (data || []).map((c: any) => ({ ...c, canales: porCuenta[c.id] || [] })),
    total: count || 0, pagina, por: POR,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'json inválido' }, 400); }
  const accion = String(b?.accion || '');
  const id = b?.id;
  if (accion !== 'canal_estado' && !esUuid(id)) return json({ error: 'id inválido' }, 400);

  if (accion === 'etapa') {
    const etapa = String(b.etapa || '');
    if (!(ETAPAS as readonly string[]).includes(etapa)) return json({ error: 'etapa inválida' }, 400);
    const { error } = await supabase.from('abm_cuentas').update({ etapa, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return json({ error: error.message }, 500);
    await apuntar(id, 'sistema', 'nota', { texto: `${yo.nombre} movió la cuenta a ${etapa}` });
    return json({ ok: true });
  }

  if (accion === 'responsable') {
    const r = b.responsable_id && esUuid(b.responsable_id) ? b.responsable_id : null;
    const { error } = await supabase.from('abm_cuentas').update({ responsable_id: r, updated_at: new Date().toISOString() }).eq('id', id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  // Lo que nos dijeron gana sobre lo que investigamos.
  if (accion === 'confirmar') {
    const CAMPOS = new Set(['sucursales', 'plataforma_web', 'nota', 'ciudad', 'subgiro']);
    const campo = String(b.campo || '');
    if (!CAMPOS.has(campo)) return json({ error: 'campo no confirmable' }, 400);
    const valor = campo === 'sucursales' ? Number(b.valor) || null : limpiar(b.valor, 1000);
    const patch: any = { [campo]: valor, updated_at: new Date().toISOString() };
    if (campo === 'sucursales') { patch.sucursales_confianza = 'confirmada'; patch.ruta = rutaDe(valor as number); }
    const { error } = await supabase.from('abm_cuentas').update(patch).eq('id', id);
    if (error) return json({ error: error.message }, 500);
    await supabase.from('abm_fuentes').insert({ cuenta_id: id, campo, valor: String(valor ?? ''), metodo: 'confirmado_por_el_prospecto', confianza: 'alta', agente: yo.nombre });
    await apuntar(id, 'sistema', 'nota', { texto: `${yo.nombre} confirmó ${campo}: ${valor}` });
    return json({ ok: true });
  }

  if (accion === 'persona') {
    const nombre = limpiar(b.nombre, 120);
    if (!nombre) return json({ error: 'falta el nombre' }, 400);
    const { data, error } = await supabase.from('abm_personas').insert({
      cuenta_id: id, nombre, cargo: limpiar(b.cargo, 120) || null, es_dueno: !!b.es_dueno,
      email: limpiar(b.email, 200) || null, telefono: limpiar(b.telefono, 60) || null,
      whatsapp: limpiar(b.whatsapp, 60) || null, linkedin: limpiar(b.linkedin, 300) || null,
      confirmado: true, confirmado_por: yo.id, confirmado_at: new Date().toISOString(),
    }).select('id').single();
    if (error) return json({ error: error.message }, 500);
    if (b.whatsapp) await supabase.from('abm_canales').insert({ cuenta_id: id, persona_id: data.id, tipo: 'whatsapp_dueno', valor: limpiar(b.whatsapp, 60), confianza: 'alta', es_de_la_tienda: false, estado: 'valido' });
    if (b.email) await supabase.from('abm_canales').insert({ cuenta_id: id, persona_id: data.id, tipo: 'email_direccion', valor: limpiar(b.email, 200), confianza: 'alta', es_de_la_tienda: false, estado: 'valido' });
    await apuntar(id, 'sistema', 'nota', { texto: `${yo.nombre} capturó a ${nombre}${b.cargo ? ' (' + b.cargo + ')' : ''}` });
    return json({ ok: true, persona_id: data.id });
  }

  if (accion === 'canal') {
    const tipo = String(b.tipo || ''); const valor = limpiar(b.valor, 300);
    if (!tipo || !valor) return json({ error: 'faltan datos' }, 400);
    const { error } = await supabase.from('abm_canales').insert({
      cuenta_id: id, tipo, valor, confianza: b.confianza || 'alta',
      es_de_la_tienda: b.es_de_la_tienda !== false, estado: 'valido', verificado_at: new Date().toISOString(),
    });
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (accion === 'canal_estado') {
    if (!esUuid(b.canal_id)) return json({ error: 'canal inválido' }, 400);
    const { error } = await supabase.from('abm_canales').update({ estado: String(b.estado || 'sin_probar') }).eq('id', b.canal_id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (accion === 'nota') {
    const texto = limpiar(b.texto, 4000);
    if (!texto) return json({ error: 'nota vacía' }, 400);
    await apuntar(id, 'sistema', 'nota', { texto: `${yo.nombre}: ${texto}` });
    return json({ ok: true });
  }

  // Se honra para siempre y en todos los canales.
  if (accion === 'no_contactar') {
    await supabase.from('abm_cuentas').update({ etapa: 'no_contactar', updated_at: new Date().toISOString() }).eq('id', id);
    const { data: cans } = await supabase.from('abm_canales').select('valor, tipo').eq('cuenta_id', id);
    for (const c of cans || []) {
      await supabase.from('abm_no_contactar').upsert({ valor: c.valor, tipo: c.tipo, motivo: limpiar(b.motivo, 300) || 'pidió no ser contactado' }, { onConflict: 'valor' });
    }
    await supabase.from('abm_toques').update({ estado: 'cancelado' }).eq('cuenta_id', id).in('estado', ['borrador', 'aprobado', 'programado']);
    await apuntar(id, 'sistema', 'baja', { texto: `${yo.nombre} marcó no contactar` });
    return json({ ok: true });
  }

  return json({ error: 'acción desconocida' }, 400);
};
