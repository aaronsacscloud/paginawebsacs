// Mejoras e ideas de una cuenta.
//
// GET    ?company_id=…            → lista (ideas y entregadas juntas)
// POST   {company_id, titulo, …}  → crea
// PUT    {id, …}                  → actualiza
// DELETE {id}                     → archiva (no borra)
//
// Es UNA sola lista con estados, no dos tablas. La idea que salió en la junta
// de agosto es la mejora entregada de octubre: son el mismo renglón en dos
// momentos. Separarlas obligaría a copiar a mano al aprobarse y se perdería el
// hilo —de qué junta salió, en qué cotización se cobró, cuándo se entregó—, que
// es justo lo que se le enseña al cliente.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { MODULOS_PLANOS } from '../../../lib/crm/modulos-sacs';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const ESTADOS_MEJORA = ['idea', 'cotizada', 'en_proceso', 'entregada', 'descartada'] as const;
const CATEGORIAS = ['personalizacion', 'plugin', 'ajuste', 'modulo', 'capacitacion', 'pendiente', 'otro'];
// De dónde nació el compromiso. La junta se deriva sola de booking_id; los
// demás los captura quien lo da de alta —lo que el cliente pidió por WhatsApp
// es el que más se pierde hoy, porque no queda en ningún lado.
export const ORIGENES = ['junta', 'whatsapp', 'soporte', 'llamada', 'manual'];

// Lo prometido que ya venció. Las cuentas no se pierden por lo que no
// prometiste: se pierden por lo que prometiste y no llegó. Solo cuentan las
// COMPROMETIDAS —cotizada o en proceso—; una idea con fecha tentativa no es una
// promesa rota.
export function vencidas(rows: any[]): any[] {
  const hoy = new Date().toISOString().slice(0, 10);
  return rows.filter(m => m.fecha_compromiso && m.fecha_compromiso < hoy
    && (m.estado === 'cotizada' || m.estado === 'en_proceso'))
    .map(m => ({
      id: m.id, titulo: m.titulo, company_id: m.company_id,
      cliente: m.companies?.nombre_comercial || m.companies?.nombre || null,
      fecha_compromiso: m.fecha_compromiso,
      dias: Math.floor((Date.now() - new Date(m.fecha_compromiso + 'T12:00:00').getTime()) / 86400000),
    }))
    .sort((a, b) => b.dias - a.dias);
}

// Campos que el cliente puede mandar. Lista blanca a propósito: un update con
// company_id o created_at colados movería el renglón de cuenta o falsearía su
// antigüedad.
function limpia(b: any) {
  const p: any = {};
  if (typeof b?.titulo === 'string') p.titulo = b.titulo.trim().slice(0, 200);
  if (typeof b?.descripcion === 'string') p.descripcion = b.descripcion.trim() || null;
  if (ESTADOS_MEJORA.includes(b?.estado)) p.estado = b.estado;
  if (CATEGORIAS.includes(b?.categoria)) p.categoria = b.categoria;
  if (b?.valor !== undefined) p.valor = Math.max(0, Number(b.valor) || 0);
  if (b?.cortesia !== undefined) p.cortesia = !!b.cortesia;
  if (b?.visible_cliente !== undefined) p.visible_cliente = !!b.visible_cliente;
  if ('booking_id' in b) p.booking_id = b.booking_id || null;
  if ('quote_id' in b) p.quote_id = b.quote_id || null;
  if ('deal_id' in b) p.deal_id = b.deal_id || null;
  // El módulo sale del catálogo, no de lo que alguien escriba: en texto libre
  // la misma pantalla acaba como "conteos", "Conteo físico" y "conteos fisicos".
  if ('modulo' in b) p.modulo = MODULOS_PLANOS.includes(b.modulo) ? b.modulo : null;
  // Cómo se dio la capacitación. Explícito y no adivinado por si hay liga: un
  // video que todavía NO se manda es justo el caso que hay que poder ver.
  if ('modo' in b) p.modo = ['junta', 'video', 'agendada'].includes(b.modo) ? b.modo : null;
  // Liga del recurso: el video que se le mandó al cliente para eso que pidió.
  if ('url' in b) p.url = String(b.url || '').trim() || null;
  // De dónde salió el compromiso. Lista cerrada: es un filtro, y en texto libre
  // "whatsapp", "WhatsApp" y "wa" serían tres orígenes distintos.
  // Solo si trae un valor válido: el formulario manda '' cuando nadie lo tocó,
  // y con `null` un simple "editar el título" borraría el origen que ya tenía.
  if (b?.origen && ORIGENES.includes(b.origen)) p.origen = b.origen;
  // De qué señal del sistema nació. Con esto la señal deja de ofrecerse en
  // cuanto existe la idea que la atiende: es lo que evita decir la misma
  // venta dos veces —arriba como señal, abajo como idea—.
  if ('senal_tipo' in b) p.senal_tipo = String(b.senal_tipo || '').trim().slice(0, 60) || null;
  if ('fecha_entrega' in b) p.fecha_entrega = b.fecha_entrega || null;
  if ('fecha_compromiso' in b) p.fecha_compromiso = b.fecha_compromiso || null;
  return p;
}

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const companyId = url.searchParams.get('company_id') || '';

  // Sin cliente devuelve TODAS: las mejoras viven dentro de cada cuenta y así
  // no se ve el conjunto —cuánto dinero hay parado en ideas abiertas ni qué se
  // prometió y ya venció—, que es un embudo entero invisible.
  let q = supabase.from('mejoras')
    .select(companyId
      ? '*, bookings(id, fecha, asunto, event_types(nombre, categoria)), quotes(id, numero, estado, total)'
      // La junta de origen viaja también en la vista global: es lo que permite
      // filtrar "lo que salió de mis juntas de esta semana".
      // `asunto` para que el renglón pueda decir DE QUÉ junta salió, no solo cuándo.
      : '*, companies(id, nombre, nombre_comercial, plan), quotes(id, numero, estado), bookings(id, fecha, asunto)')
    .is('archived_at', null)
    .order('fecha_entrega', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (companyId) q = q.eq('company_id', companyId);
  else q = q.limit(500);

  const { data, error } = await q;
  if (error) return json({ error: error.message }, 500);
  return json({ data: data || [], vencidas: vencidas(data || []) });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const companyId = String(b?.company_id || '');
  const p = limpia(b);
  if (!companyId || !p.titulo) return json({ error: 'Falta el cliente o el título.' }, 400);

  // Entregada sin fecha no sirve para nada: el reporte por periodo se arma con
  // esa fecha y sin ella la mejora no aparece en ningún rango.
  if (p.estado === 'entregada' && !p.fecha_entrega) p.fecha_entrega = new Date().toISOString().slice(0, 10);
  // Si nació ligado a una junta, el origen no se pregunta: se deduce.
  if (!p.origen) p.origen = p.booking_id ? 'junta' : 'manual';

  const { data, error } = await supabase.from('mejoras')
    .insert({ ...p, company_id: companyId, creado_por: user.nombre || user.email || 'CRM' })
    .select('*').single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, data }, 201);
};

export const PUT: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.id || '');
  if (!id) return json({ error: 'Falta la mejora.' }, 400);
  const p = limpia(b);

  // ── Mover la fecha deja rastro ──
  // Una fecha que se recorre tres veces en silencio es la que rompe la
  // confianza: el cliente ve un retraso, no un patrón. Cada cambio se apila con
  // de dónde, a dónde, por qué y quién — el motivo lo manda la pantalla y es
  // obligatorio para poder recorrerla (mover sin decir por qué es lo que hace
  // que el rastro no sirva de nada).
  //
  // El estado NO cuenta como reagenda: entregar tarde no es mover la promesa.
  const cambiaFecha = 'fecha_compromiso' in b;
  if (cambiaFecha) {
    const { data: act } = await supabase.from('mejoras')
      .select('fecha_compromiso, reagendas').eq('id', id).maybeSingle();
    const antes = act?.fecha_compromiso ? String(act.fecha_compromiso).slice(0, 10) : null;
    const ahora = p.fecha_compromiso ? String(p.fecha_compromiso).slice(0, 10) : null;
    if (antes && ahora && antes !== ahora) {
      const motivo = String(b?.motivo || '').trim().slice(0, 160) || 'sin motivo';
      const previas = Array.isArray(act?.reagendas) ? act.reagendas : [];
      p.reagendas = [...previas, {
        de: antes, a: ahora, motivo,
        quien: user.nombre || user.email || 'admin',
        at: new Date().toISOString(),
      }].slice(-30);
    }
  }

  if (p.estado === 'entregada' && !p.fecha_entrega) {
    const { data: act } = await supabase.from('mejoras').select('fecha_entrega').eq('id', id).maybeSingle();
    if (!act?.fecha_entrega) p.fecha_entrega = new Date().toISOString().slice(0, 10);
  }
  p.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('mejoras').update(p).eq('id', id).select('*').single();
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, data });
};

// Archiva, no borra: una mejora que ya se le presentó al cliente en un resumen
// no puede desaparecer del historial porque alguien se arrepintió.
export const DELETE: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.id || '');
  if (!id) return json({ error: 'Falta la mejora.' }, 400);
  const { error } = await supabase.from('mejoras').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
