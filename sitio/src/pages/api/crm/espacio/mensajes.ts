// GET    /api/crm/espacio/mensajes?canal_id=&antes=<iso>|desde=<iso>&hilo_de=&alrededor=<id>
// POST   /api/crm/espacio/mensajes   { canal_id, texto, responde_a?, hilo_de?, adjuntos?, citas?, cid? }
// PUT    /api/crm/espacio/mensajes   { id, texto }         → edita (15 min, solo el autor)
// DELETE /api/crm/espacio/mensajes?id=                     → borra (marca; solo el autor)
//
// El navegador manda `cid` (id de cliente) con cada mensaje: si el socket se
// cae a media subida y reintenta, el índice único lo devuelve en vez de
// duplicarlo. La señal Realtime que se emite lleva ids, nunca el texto.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import {
  json, quien, esUuid, emitir, canalDe, puedeVerCanal, darForma, SELECT_MENSAJE, LIMITES,
  pasaRitmo, equipo, extraerMenciones, type Adjunto,
} from '../../../../lib/crm/espacio.lib';
import { avisar } from '../../../../lib/crm/espacio-avisos';

export const prerender = false;

const ADJ_TIPOS = new Set(['imagen', 'audio', 'gif', 'archivo']);
const CITA_TIPOS = new Set(['cliente', 'lead', 'tarea', 'reunion', 'cotizacion', 'corte', 'canal', 'wiki']);

function limpiarAdjuntos(a: any): Adjunto[] | string {
  if (a === undefined || a === null) return [];
  if (!Array.isArray(a)) return 'Adjuntos inválidos';
  if (a.length > LIMITES.adjuntos) return `Máximo ${LIMITES.adjuntos} adjuntos`;
  const out: Adjunto[] = [];
  for (const x of a) {
    if (!x || !ADJ_TIPOS.has(x.tipo)) return 'Adjunto inválido';
    // Un adjunto propio vive en el bucket (path); un GIF de Tenor trae url.
    if (x.tipo === 'gif') { if (!/^https:\/\/media\.tenor\.com\//.test(String(x.url || ''))) return 'GIF inválido'; }
    else if (!/^[a-z0-9]{4,}\/[\w./-]{8,}$/i.test(String(x.path || ''))) return 'Adjunto sin archivo';
    out.push({
      tipo: x.tipo, path: x.path, thumb: x.thumb, url: x.url, nombre: String(x.nombre || '').slice(0, 120) || undefined,
      bytes: Number(x.bytes) || undefined, w: Number(x.w) || undefined, h: Number(x.h) || undefined,
      duracion_s: Number(x.duracion_s) || undefined,
      transcripcion: typeof x.transcripcion === 'string' ? x.transcripcion.slice(0, 4000) : null,
      transcripcion_estado: x.transcripcion_estado,
    });
  }
  return out;
}

function limpiarCitas(c: any): any[] | string {
  if (c === undefined || c === null) return [];
  if (!Array.isArray(c) || c.length > 10) return 'Citas inválidas';
  const out: any[] = [];
  for (const x of c) {
    if (!x || !CITA_TIPOS.has(x.tipo) || typeof x.id !== 'string' || x.id.length > 80) return 'Cita inválida';
    out.push({ tipo: x.tipo, id: x.id, nombre: String(x.nombre || '').slice(0, 120) });
  }
  return out;
}

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const canal_id = url.searchParams.get('canal_id') || '';
  const c = await canalDe(canal_id);
  if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Canal no encontrado' }, 404);

  const hilo_de = url.searchParams.get('hilo_de');
  const antes = url.searchParams.get('antes');
  const desde = url.searchParams.get('desde');
  const alrededor = url.searchParams.get('alrededor');

  let q = supabase.from('espacio_mensajes').select(SELECT_MENSAJE).eq('canal_id', c.id);
  if (hilo_de) {
    if (!esUuid(hilo_de)) return json({ error: 'Hilo inválido' }, 400);
    // Un hilo se lee entero y en orden: raíz primero, luego las respuestas.
    const { data: raiz } = await supabase.from('espacio_mensajes').select(SELECT_MENSAJE).eq('id', hilo_de).eq('canal_id', c.id).maybeSingle();
    if (!raiz) return json({ error: 'Hilo no encontrado' }, 404);
    const { data, error } = await q.eq('hilo_de', hilo_de).order('created_at', { ascending: true }).limit(500);
    if (error) return json({ error: error.message }, 500);
    const forma = await darForma([raiz, ...(data || [])], yo.id);
    return json({ raiz: forma[0], mensajes: forma.slice(1), hay_mas: false });
  }

  q = q.is('hilo_de', null);
  if (alrededor && esUuid(alrededor)) {
    // Saltar a un mensaje (desde una notificación o una búsqueda): la página
    // que lo contiene, con margen antes y después.
    const { data: m } = await supabase.from('espacio_mensajes').select('created_at').eq('id', alrededor).maybeSingle();
    if (!m) return json({ error: 'Mensaje no encontrado' }, 404);
    const [{ data: a }, { data: d }] = await Promise.all([
      supabase.from('espacio_mensajes').select(SELECT_MENSAJE).eq('canal_id', c.id).is('hilo_de', null).lt('created_at', m.created_at).order('created_at', { ascending: false }).limit(25),
      supabase.from('espacio_mensajes').select(SELECT_MENSAJE).eq('canal_id', c.id).is('hilo_de', null).gte('created_at', m.created_at).order('created_at', { ascending: true }).limit(26),
    ]);
    const rows = [...(a || []).reverse(), ...(d || [])];
    return json({ mensajes: await darForma(rows, yo.id), hay_mas: (a || []).length === 25, hay_mas_despues: (d || []).length === 26 });
  }
  if (desde) {
    // Lo nuevo después de X (el poll de respaldo y la reconexión).
    const { data, error } = await q.gt('created_at', desde).order('created_at', { ascending: true }).limit(200);
    if (error) return json({ error: error.message }, 500);
    return json({ mensajes: await darForma(data || [], yo.id), hay_mas: false });
  }
  if (antes) q = q.lt('created_at', antes);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(LIMITES.pagina);
  if (error) return json({ error: error.message }, 500);
  const rows = (data || []).reverse();
  return json({ mensajes: await darForma(rows, yo.id), hay_mas: (data || []).length === LIMITES.pagina });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const c = await canalDe(b.canal_id);
  if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Canal no encontrado' }, 404);
  if (c.tipo === 'sistema') return json({ error: 'En Sistema escribe el sistema; abre un hilo o responde en otro canal' }, 400);
  if (c.archivado_at) return json({ error: 'Este canal está archivado' }, 400);

  const texto = String(b.texto ?? '').replace(/\r\n/g, '\n').trim();
  const adjuntos = limpiarAdjuntos(b.adjuntos);
  if (typeof adjuntos === 'string') return json({ error: adjuntos }, 400);
  const citas = limpiarCitas(b.citas);
  if (typeof citas === 'string') return json({ error: citas }, 400);
  if (!texto && !adjuntos.length) return json({ error: 'Escribe algo o adjunta algo' }, 400);
  if (texto.length > LIMITES.texto) return json({ error: `Máximo ${LIMITES.texto} caracteres` }, 400);
  if (!pasaRitmo(`msg:${yo.id}`, LIMITES.mensajes_por_minuto)) return json({ error: 'Muy rápido: espera un momento' }, 429);

  let hilo_de: string | null = null;
  let responde_a: string | null = null;
  if (b.hilo_de) {
    if (!esUuid(b.hilo_de)) return json({ error: 'Hilo inválido' }, 400);
    const { data: raiz } = await supabase.from('espacio_mensajes').select('id, hilo_de, canal_id, autor_id').eq('id', b.hilo_de).maybeSingle();
    if (!raiz || raiz.canal_id !== c.id) return json({ error: 'Hilo no encontrado' }, 404);
    // Un solo nivel: si el "raíz" ya es respuesta de un hilo, se cuelga del suyo.
    hilo_de = raiz.hilo_de || raiz.id;
  }
  if (b.responde_a) {
    if (!esUuid(b.responde_a)) return json({ error: 'Respuesta inválida' }, 400);
    const { data: r } = await supabase.from('espacio_mensajes').select('id, canal_id').eq('id', b.responde_a).maybeSingle();
    if (!r || r.canal_id !== c.id) return json({ error: 'Mensaje al que respondes no encontrado' }, 404);
    responde_a = r.id;
  }

  const cid = typeof b.cid === 'string' && /^[\w-]{8,64}$/.test(b.cid) ? b.cid : null;
  if (cid) {
    const { data: ya } = await supabase.from('espacio_mensajes').select(SELECT_MENSAJE).eq('metadata->>cid', cid).maybeSingle();
    if (ya) return json({ ok: true, mensaje: (await darForma([ya], yo.id))[0], repetido: true });
  }

  const eq = await equipo();
  const menciones = extraerMenciones(texto, eq);

  const { data, error } = await supabase.from('espacio_mensajes').insert({
    canal_id: c.id, hilo_de, autor_id: yo.id, texto, responde_a, menciones, adjuntos, citas,
    sesion_id: esUuid(b.sesion_id) ? b.sesion_id : null, punto_id: esUuid(b.punto_id) ? b.punto_id : null,
    metadata: cid ? { cid, ua: (request.headers.get('user-agent') || '').slice(0, 80) } : {},
  }).select(SELECT_MENSAJE).single();
  if (error) {
    if (cid && /duplicate|unique/i.test(error.message)) {
      const { data: ya } = await supabase.from('espacio_mensajes').select(SELECT_MENSAJE).eq('metadata->>cid', cid).maybeSingle();
      if (ya) return json({ ok: true, mensaje: (await darForma([ya], yo.id))[0], repetido: true });
    }
    return json({ error: error.message }, 500);
  }

  // Quien escribe ya leyó hasta aquí.
  await supabase.from('espacio_lecturas').upsert({ canal_id: c.id, usuario_id: yo.id, ultimo_leido_at: data.created_at }, { onConflict: 'canal_id,usuario_id' });
  await emitir({ tipo: 'msg', canal_id: c.id, id: data.id, autor_id: yo.id, hilo_de });

  // Avisos: a quien mencionaste, a quien respondiste, a los del hilo, y en
  // un directo a la otra persona. Cada quien una vez y nunca a uno mismo.
  const resumen = texto.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1').slice(0, 140) || (adjuntos[0]?.tipo === 'audio' ? 'Te mandó un audio' : 'Te mandó una imagen');
  const avisados = new Set<string>([yo.id]);
  const aviso = async (para: string, tipo: any, titulo: string) => {
    if (avisados.has(para)) return; avisados.add(para);
    await avisar({ para, tipo, titulo, detalle: resumen, canal_id: c.id, mensaje_id: data.id, hilo_de, nivel: c.importante ? 'alerta' : 'info' });
  };
  const canalNombre = c.tipo === 'directo' ? 'directo' : `#${c.nombre}`;
  for (const m of menciones) await aviso(m, 'espacio_mencion', `${yo.nombre} te mencionó en ${canalNombre}`);
  if (responde_a) {
    const { data: r } = await supabase.from('espacio_mensajes').select('autor_id').eq('id', responde_a).maybeSingle();
    if (r) await aviso(r.autor_id, 'espacio_respuesta', `${yo.nombre} te respondió en ${canalNombre}`);
  }
  if (hilo_de) {
    const { data: seg } = await supabase.from('espacio_seguimientos').select('usuario_id').eq('mensaje_raiz_id', hilo_de);
    const { data: raiz } = await supabase.from('espacio_mensajes').select('autor_id').eq('id', hilo_de).maybeSingle();
    for (const u of [raiz?.autor_id, ...(seg || []).map(s => s.usuario_id)].filter(Boolean) as string[]) await aviso(u, 'espacio_respuesta', `${yo.nombre} respondió en tu hilo de ${canalNombre}`);
    // Quien escribe en un hilo lo sigue desde entonces.
    await supabase.from('espacio_seguimientos').upsert({ mensaje_raiz_id: hilo_de, usuario_id: yo.id }, { onConflict: 'mensaje_raiz_id,usuario_id' });
  }
  if (c.tipo === 'directo') for (const p of c.participantes) await aviso(p, 'espacio_directo', `${yo.nombre} te escribió`);
  if (c.importante && !hilo_de) {
    // Un canal marcado importante (#decisiones) avisa a todo el equipo humano.
    for (const p of eq) if (p.rol !== 'soporte') await aviso(p.id, 'espacio_importante', `Nuevo en ${canalNombre}`);
  }

  return json({ ok: true, mensaje: (await darForma([data], yo.id))[0] });
};

export const PUT: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (!esUuid(b.id)) return json({ error: 'Falta id' }, 400);
  const texto = String(b.texto ?? '').trim();
  if (!texto || texto.length > LIMITES.texto) return json({ error: 'Texto inválido' }, 400);
  const { data: m } = await supabase.from('espacio_mensajes').select(SELECT_MENSAJE).eq('id', b.id).maybeSingle();
  if (!m || m.borrado_at) return json({ error: 'Mensaje no encontrado' }, 404);
  if (m.autor_id !== yo.id) return json({ error: 'Solo el autor edita' }, 403);
  if (Date.now() - new Date(m.created_at).getTime() > LIMITES.editar_minutos * 60_000) return json({ error: `Solo se edita en los primeros ${LIMITES.editar_minutos} minutos` }, 400);
  const menciones = extraerMenciones(texto, await equipo());
  const { data, error } = await supabase.from('espacio_mensajes').update({ texto, menciones, editado_at: new Date().toISOString() }).eq('id', m.id).select(SELECT_MENSAJE).single();
  if (error) return json({ error: error.message }, 500);
  await emitir({ tipo: 'msg_upd', canal_id: m.canal_id, id: m.id, hilo_de: m.hilo_de });
  return json({ ok: true, mensaje: (await darForma([data], yo.id))[0] });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const id = url.searchParams.get('id') || '';
  if (!esUuid(id)) return json({ error: 'Falta id' }, 400);
  const { data: m } = await supabase.from('espacio_mensajes').select('id, canal_id, hilo_de, autor_id, adjuntos, borrado_at').eq('id', id).maybeSingle();
  if (!m || m.borrado_at) return json({ error: 'Mensaje no encontrado' }, 404);
  if (m.autor_id !== yo.id && yo.role !== 'founder') return json({ error: 'Solo el autor borra' }, 403);
  const { error } = await supabase.from('espacio_mensajes').update({ borrado_at: new Date().toISOString() }).eq('id', id);
  if (error) return json({ error: error.message }, 500);
  // Los archivos sí se van: un borrado que deja la imagen viva no es borrado.
  const paths = (m.adjuntos || []).flatMap((a: any) => [a.path, a.thumb]).filter(Boolean);
  if (paths.length) await supabase.storage.from('espacio').remove(paths).catch(() => null);
  await emitir({ tipo: 'msg_upd', canal_id: m.canal_id, id: m.id, hilo_de: m.hilo_de });
  return json({ ok: true });
};
