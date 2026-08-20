// /api/crm/email/reglas-web — las reglas de comportamiento en el sitio.
//
// GET              lista + catálogo de tipos + rutas realmente visitadas
// GET ?listas=1    las prearmadas, con a cuánta gente habrían alcanzado
// POST             crea (o crea una prearmada con ?listo=<id>)
// POST ?simular=1  cuánta gente cumpliría, sin guardar nada
// PUT              actualiza · activar/pausar incluidos
// DELETE           borra
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { resolverTenant } from '../../../../lib/email/tenant';
import { TIPOS, simular, type Regla } from '../../../../lib/email/reglas-web';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

/**
 * Reglas prearmadas para los recorridos que los datos ya muestran.
 * `embudo` es el nombre del embudo listo que debería dispararse — se liga si
 * ya existe, y si no se avisa: crear una regla que apunta a la nada es el
 * fallo más caro, porque no da error.
 */
const LISTAS = [
  {
    id: 'vio_precios',
    nombre: 'Vio precios y no agendó',
    tipo: 'pagina' as const,
    config: { rutas: ['/planes', '/precios'] },
    retraso_minutos: 25, prioridad: 70, espera_dias: 30,
    embudo: 'Bienvenida a lead nuevo',
    por_que: 'La página de precios es la señal de compra más clara que hay. Veinticinco minutos después, no en el momento.',
  },
  {
    id: 'agendador_abandonado',
    nombre: 'Abrió el agendador y no reservó',
    tipo: 'ausencia' as const,
    config: { rutas: ['/agendar'], dias: 2 },
    retraso_minutos: 20, prioridad: 90, espera_dias: 45,
    embudo: 'Bienvenida a lead nuevo',
    por_que: 'Es tu página más visitada (148 veces en 90 días). Llegar hasta ahí y no reservar es una duda concreta, no falta de interés.',
  },
  {
    id: 'comparando',
    nombre: 'Está comparando (precios + casos)',
    tipo: 'combinacion' as const,
    config: { rutas: ['/planes', '/casos-de-exito'], dias: 7 },
    retraso_minutos: 30, prioridad: 80, espera_dias: 30,
    embudo: 'Después de la reunión',
    por_que: 'Ver precios Y casos en la misma semana no es curiosidad: está armando el argumento para convencer a alguien más.',
  },
  {
    id: 'caliente',
    nombre: 'Cruzó 40 de intención',
    tipo: 'intencion' as const,
    config: { umbral: 40 },
    retraso_minutos: 15, prioridad: 60, espera_dias: 60,
    embudo: 'Bienvenida a lead nuevo',
    por_que: 'Sin anticipar recorridos: quien acumula visitas, clics y cotizaciones vistas entra solo, por el camino que sea.',
  },
];

export const GET: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);

  if (url.searchParams.get('listas') === '1') {
    const { data: autos } = await supabase.from('automations')
      .select('id, nombre').eq('tenant_id', t.id).is('archived_at', null);
    const porNombre = new Map((autos || []).map((a: any) => [a.nombre, a.id]));
    const { data: ya } = await supabase.from('web_reglas').select('nombre').eq('tenant_id', t.id);
    const creadas = new Set((ya || []).map((r: any) => r.nombre));

    const out = [];
    for (const l of LISTAS) {
      const sim = await simular({ ...l, tenant_id: t.id, automation_id: null, estado: 'borrador', descripcion: null } as any, 30);
      out.push({
        ...l, alcance_30d: sim.total, ya_existe: creadas.has(l.nombre),
        embudo_id: porNombre.get(l.embudo) || null,
        falta_embudo: !porNombre.has(l.embudo) ? l.embudo : null,
      });
    }
    return json({ listas: out });
  }

  // Las rutas que la gente DE VERDAD visita: elegir de una lista real evita
  // reglas que apuntan a páginas que nadie abre o que ya no existen.
  const { data: vs } = await supabase.from('contact_visits')
    .select('ruta').gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString()).limit(20000);
  const conteo: Record<string, number> = {};
  for (const v of vs || []) {
    const r = String(v.ruta || '/').split('?')[0];
    conteo[r] = (conteo[r] || 0) + 1;
  }
  const rutas = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([ruta, n]) => ({ ruta, visitas: n }));

  const { data: reglas } = await supabase.from('web_reglas')
    .select('*, automations(nombre, estado)').eq('tenant_id', t.id).order('prioridad', { ascending: false });
  const { data: embudos } = await supabase.from('automations')
    .select('id, nombre, estado').eq('tenant_id', t.id).is('archived_at', null).order('nombre');

  return json({ reglas: reglas || [], tipos: TIPOS, rutas, embudos: embudos || [] });
};

export const POST: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));

  if (url.searchParams.get('simular') === '1' || body?.simular) {
    if (!body?.tipo) return json({ error: 'Falta el tipo de regla.' }, 400);
    const sim = await simular({
      tenant_id: t.id, nombre: body.nombre || 'simulación', tipo: body.tipo,
      config: body.config || {}, automation_id: null,
      retraso_minutos: 20, prioridad: 50, espera_dias: 30, estado: 'borrador',
    } as any, Math.min(90, Number(body.dias) || 30));
    return json(sim);
  }

  const listo = url.searchParams.get('listo') || body?.listo;
  const base = listo ? LISTAS.find(l => l.id === listo) : null;
  if (listo && !base) return json({ error: 'No existe esa regla prearmada.' }, 404);

  const nombre = String(base?.nombre || body?.nombre || '').trim();
  if (!nombre) return json({ error: 'Ponle nombre a la regla.' }, 400);
  const tipo = base?.tipo || body?.tipo;
  if (!tipo || !(tipo in TIPOS)) return json({ error: 'Elige un tipo de regla válido.' }, 400);

  // Sin duplicar: dos reglas iguales activas disparan dos veces.
  const { data: ya } = await supabase.from('web_reglas')
    .select('id').eq('tenant_id', t.id).eq('nombre', nombre).maybeSingle();
  if (ya) return json({ regla: ya, ya_existia: true });

  let automationId = body?.automation_id || null;
  if (base && !automationId) {
    const { data: a } = await supabase.from('automations')
      .select('id').eq('tenant_id', t.id).eq('nombre', base.embudo).is('archived_at', null).maybeSingle();
    automationId = a?.id || null;
  }

  const { data, error } = await supabase.from('web_reglas').insert({
    tenant_id: t.id, nombre, descripcion: base?.por_que || body?.descripcion || null,
    tipo, config: base?.config || body?.config || {},
    automation_id: automationId,
    retraso_minutos: base?.retraso_minutos ?? Number(body?.retraso_minutos) ?? 20,
    prioridad: base?.prioridad ?? Number(body?.prioridad) ?? 50,
    espera_dias: base?.espera_dias ?? Number(body?.espera_dias) ?? 30,
  }).select().single();
  if (error) return json({ error: error.message }, 500);

  return json({
    regla: data,
    aviso: !automationId ? `Falta elegir qué embudo dispara${base ? ` (el sugerido es "${base.embudo}" y todavía no existe)` : ''}. Sin eso la regla no envía nada.` : null,
  }, 201);
};

export const PUT: APIRoute = async ({ request, url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  if (!t) return json({ error: 'Sin inquilino.' }, 404);
  const body = await request.json().catch(() => ({} as any));
  if (!body?.id) return json({ error: 'Falta el id.' }, 400);

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const k of ['nombre', 'descripcion', 'config', 'automation_id', 'retraso_minutos', 'prioridad', 'espera_dias']) {
    if (k in body) updates[k] = body[k];
  }

  if (body.estado) {
    const { data: actual } = await supabase.from('web_reglas')
      .select('automation_id, activado_at').eq('id', body.id).eq('tenant_id', t.id).maybeSingle();
    if (body.estado === 'activa') {
      if (!(body.automation_id || actual?.automation_id)) {
        return json({ error: 'Elige qué embudo dispara antes de activarla.' }, 400);
      }
      // ARRANQUE LIMPIO, igual que los embudos: al activar, el reloj empieza
      // AHORA. Sin esto, encender una regla dispararía correos por lo que la
      // gente navegó el mes pasado — y eso no se puede deshacer.
      updates.activado_at = new Date().toISOString();
    }
    updates.estado = body.estado;
  }

  const { data, error } = await supabase.from('web_reglas')
    .update(updates).eq('id', body.id).eq('tenant_id', t.id).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ regla: data });
};

export const DELETE: APIRoute = async ({ url }) => {
  const t = await resolverTenant(url.searchParams.get('tenant'));
  const id = url.searchParams.get('id');
  if (!t || !id) return json({ error: 'Falta el id.' }, 400);
  await supabase.from('web_reglas').delete().eq('id', id).eq('tenant_id', t.id);
  return json({ ok: true });
};
