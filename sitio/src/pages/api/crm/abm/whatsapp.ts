// El toque de WhatsApp, listo para mandar con un clic.
//
// Por qué no es automático: la API oficial de Meta exige plantilla aprobada
// para iniciar una conversación, y eso lo aprueba Meta, no nosotros. Pero el
// mensaje SÍ se puede dejar escrito y abrir WhatsApp con él cargado — eso
// funciona hoy, con los 327 números que tenemos, sin permiso de nadie.
//
// Y hay una razón de fondo para que lo mande una persona: el número es el de
// la TIENDA. Contesta una vendedora atendiendo clientas. Un mensaje automático
// con pitch ahí es la forma más rápida de perder el número.
//
// GET  /api/crm/abm/whatsapp?cuenta_id=&paso=abre|sigue|cierra
// POST /api/crm/abm/whatsapp { cuenta_id, paso, texto }   ← se marcó como enviado
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, limpiar, apuntar, variablesDe, rellenar } from '../../../../lib/crm/abm.lib';

export const prerender = false;

const PASOS = new Set(['abre', 'sigue', 'cierra']);

function aLink(valor: string, texto: string): string | null {
  let n = String(valor || '');
  if (n.startsWith('http')) { const m = n.match(/(\d{10,15})/); n = m ? m[1] : ''; }
  n = n.replace(/\D/g, '');
  if (n.length === 10) n = '52' + n;
  if (n.length === 11 && n.startsWith('1')) n = '52' + n.slice(1);
  if (n.length < 10 || n.length > 15) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  const id = url.searchParams.get('cuenta_id');
  const paso = String(url.searchParams.get('paso') || 'abre');
  if (!esUuid(id) || !PASOS.has(paso)) return json({ error: 'parámetros inválidos' }, 400);

  const { data: c } = await supabase.from('abm_cuentas').select('*').eq('id', id).maybeSingle();
  if (!c) return json({ error: 'no existe' }, 404);
  if (c.etapa === 'no_contactar') return json({ error: 'esta cuenta pidió no ser contactada' }, 409);
  if (c.ya_es_cliente) return json({ error: `ya es cliente (${c.ya_es_cliente})` }, 409);

  const [{ data: plantilla }, { data: canales }, { data: personas }] = await Promise.all([
    supabase.from('abm_plantillas').select('cuerpo').eq('giro', c.giro).eq('canal', 'whatsapp').eq('nombre', paso).maybeSingle(),
    supabase.from('abm_canales').select('tipo, valor, estado').eq('cuenta_id', id).like('tipo', 'whatsapp%'),
    supabase.from('abm_personas').select('nombre').eq('cuenta_id', id).order('confirmado', { ascending: false }).limit(1),
  ]);
  if (!plantilla) return json({ error: `todavía no hay mensaje de WhatsApp escrito para ${c.giro}` }, 409);

  // El del dueño gana sobre el de la tienda: si alguien ya nos dio su directo,
  // ahí se escribe.
  const wa = (canales || []).find(x => x.tipo === 'whatsapp_dueno' && x.estado !== 'opt_out')
          || (canales || []).find(x => x.estado !== 'opt_out');
  if (!wa) return json({ error: 'esta cuenta no tiene WhatsApp' }, 409);

  const texto = rellenar(plantilla.cuerpo, variablesDe(c, (personas || [])[0]));
  const enlace = aLink(wa.valor, texto);
  if (!enlace) return json({ error: `el número no sirve para abrir WhatsApp: ${wa.valor}` }, 409);

  const { data: previos } = await supabase.from('abm_actividad')
    .select('id, ocurrio_at, detalle').eq('cuenta_id', id).eq('canal', 'whatsapp').order('ocurrio_at', { ascending: false }).limit(5);

  return json({
    texto, enlace, numero: wa.valor,
    es_de_la_tienda: wa.tipo !== 'whatsapp_dueno',
    previos: previos || [],
  });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'json inválido' }, 400); }
  if (!esUuid(b?.cuenta_id) || !PASOS.has(String(b.paso))) return json({ error: 'parámetros inválidos' }, 400);

  await apuntar(b.cuenta_id, 'whatsapp', 'whatsapp', {
    texto: `${yo.nombre} mandó el WhatsApp «${b.paso}»`,
    detalle: { paso: b.paso, mensaje: limpiar(b.texto, 1000) },
  });
  await supabase.from('abm_cuentas')
    .update({ etapa: 'en_cadencia', ultimo_toque_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', b.cuenta_id).eq('etapa', 'sin_tocar');
  return json({ ok: true });
};
