// Lo que necesita que una PERSONA decida.
//
// Una base de 2,100 cuentas junta casos que ningún automatismo debe resolver
// solo: un nombre que se parece al de un cliente, una cadena que quizá son dos
// negocios distintos con el mismo nombre, un número que resultó no tener
// WhatsApp. Si eso no vive en un lugar visible, no se resuelve nunca — se
// queda en un comentario de un commit que nadie vuelve a leer.
//
// GET  /api/crm/abm/pendientes
// POST /api/crm/abm/pendientes { accion, id, … }
//   resolver_cliente { id, es_cliente: bool }
//   confirmar_cadena { id, sucursales }        ← lo que se confirmó al llamar
//   descartar        { id, motivo }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, limpiar, apuntar, repuntuar } from '../../../../lib/crm/abm.lib';

export const prerender = false;

const SEL = 'id, nombre, giro, ciudad, sucursales, google_rating, google_resenas, sitio, puntaje, etapa, nota, canales_n, tiene_email, tiene_wa';

export const GET: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);

  const [posiblesClientes, porConfirmar, sinVia, waMuerto, correoDudoso] = await Promise.all([
    // Comparte una palabra con un cliente nuestro. No se bloquea sola: bloquear
    // de más pierde un prospecto, no bloquear le escribe a quien ya paga.
    supabase.from('abm_cuentas').select(SEL).ilike('nota', '%¿Es el cliente%').limit(50),
    // Mismo nombre en estados distintos y sin sitio que los ligue: puede ser una
    // cadena o dos negocios homónimos. Se confirma llamando.
    supabase.from('abm_cuentas').select(SEL).ilike('nota', '%confirmar que sean del mismo dueño%').limit(100),
    // Investigadas y sin forma de alcanzarlas.
    supabase.from('abm_cuentas').select(SEL).eq('canales_n', 0).neq('etapa', 'no_contactar').order('puntaje', { ascending: false }).limit(80),
    // El primer mensaje probó que el número no está en WhatsApp.
    supabase.from('abm_canales').select('id, cuenta_id, valor, tipo, abm_cuentas(nombre, giro, ciudad)').like('tipo', 'whatsapp%').eq('estado', 'invalido').limit(80),
    // Dominio sin servidor de correo declarado: puede recibir o no.
    supabase.from('abm_canales').select('id, cuenta_id, valor, abm_cuentas(nombre, giro, ciudad)').like('tipo', 'email%').eq('confianza', 'baja').neq('estado', 'invalido').limit(80),
  ]);

  // Los giros sin cadencia, calculados a mano (no hay función en la base).
  const { data: giros } = await supabase.from('abm_cuentas').select('giro').eq('tiene_email', true).neq('etapa', 'no_contactar').limit(5000);
  const { data: conPlantilla } = await supabase.from('abm_plantillas').select('giro').eq('canal', 'email');
  const tienen = new Set((conPlantilla || []).map((p: any) => p.giro));
  const faltan: Record<string, number> = {};
  for (const g of giros || []) if (!tienen.has(g.giro)) faltan[g.giro] = (faltan[g.giro] || 0) + 1;

  return json({
    posibles_clientes: posiblesClientes.data || [],
    por_confirmar: porConfirmar.data || [],
    sin_via: sinVia.data || [],
    whatsapp_muerto: waMuerto.data || [],
    correo_dudoso: correoDudoso.data || [],
    giros_sin_cadencia: faltan,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'json inválido' }, 400); }
  if (!esUuid(b?.id)) return json({ error: 'id inválido' }, 400);
  const accion = String(b.accion || '');

  const quitarNota = async (id: string, marca: string) => {
    const { data: c } = await supabase.from('abm_cuentas').select('nota').eq('id', id).maybeSingle();
    const limpia = String(c?.nota || '').split('·').filter(t => !t.includes(marca)).join('·').trim();
    await supabase.from('abm_cuentas').update({ nota: limpia || null, updated_at: new Date().toISOString() }).eq('id', id);
  };

  if (accion === 'resolver_cliente') {
    if (b.es_cliente) {
      await supabase.from('abm_cuentas').update({ ya_es_cliente: 'sí', etapa: 'no_contactar', updated_at: new Date().toISOString() }).eq('id', b.id);
      await apuntar(b.id, 'sistema', 'nota', { texto: `${yo.nombre} confirmó que ya es cliente: no se le escribe` });
    } else {
      await apuntar(b.id, 'sistema', 'nota', { texto: `${yo.nombre} confirmó que NO es el cliente parecido: entra a prospección` });
    }
    await quitarNota(b.id, '¿Es el cliente');
    return json({ ok: true });
  }

  if (accion === 'confirmar_cadena') {
    const n = Number(b.sucursales) || null;
    await supabase.from('abm_cuentas').update({
      sucursales: n, sucursales_confianza: 'confirmada',
      ruta: (n || 0) >= 5 ? 'diagnostico' : 'demo', updated_at: new Date().toISOString(),
    }).eq('id', b.id);
    await quitarNota(b.id, 'confirmar que sean del mismo dueño');
    await apuntar(b.id, 'sistema', 'nota', { texto: `${yo.nombre} confirmó ${n ?? 'sin dato de'} sucursales` });
    await repuntuar(b.id);
    return json({ ok: true });
  }

  if (accion === 'descartar') {
    await supabase.from('abm_cuentas').update({ etapa: 'perdida', updated_at: new Date().toISOString() }).eq('id', b.id);
    await apuntar(b.id, 'sistema', 'nota', { texto: `${yo.nombre} la descartó: ${limpiar(b.motivo, 300) || 'sin motivo'}` });
    return json({ ok: true });
  }

  return json({ error: 'acción desconocida' }, 400);
};
