// /api/crm/arr/plans — el catálogo de lo que se puede vender: licencias
// (categoria 'plan') y plugins (categoria 'plugin'). Fuente ÚNICA para la
// cotización, la oportunidad y la suscripción, para que las tres digan lo mismo.
//
// Hasta ago-2026 los plugins vivían hardcodeados aquí: no se podían renombrar
// ni ponerles precio sin un deploy, y como el nombre se escribía a mano en cada
// venta, 175 suscripciones acabaron con 64 nombres distintos para 15 conceptos
// ("PLUGIN PREMIUM ", "plugin premium", "licencia PLUGIN VIP"…). Ahora son
// filas de `plans` y se editan desde Configuración → Planes y plugins.
//
// GET lista · POST crea · PUT edita · DELETE retira (solo si nadie lo usa).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { PLAN_PRICES } from '../../../../lib/quotes/constants';

export const prerender = false;

const json = (o: any, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

// Solo mientras la tabla no exista (SQL-4 pendiente en un entorno nuevo). No
// trae `id`, así que las suscripciones que nazcan ahí quedan sin ligar: es un
// modo degradado, no el camino normal.
const FALLBACK = [
  { slug: 'vende', nombre: 'Plan Vende', precio_mensual: 810, precio_anual: 6318, a_la_medida: false, categoria: 'plan', orden: 1 },
  { slug: 'controla', nombre: 'Plan Controla', precio_mensual: 1215, precio_anual: 9477, a_la_medida: false, categoria: 'plan', orden: 2 },
  { slug: 'fideliza', nombre: 'Plan Fideliza', precio_mensual: 1890, precio_anual: 14742, a_la_medida: false, categoria: 'plan', orden: 3 },
  { slug: 'automatiza', nombre: 'Plan Automatiza', precio_mensual: 3780, precio_anual: 29484, a_la_medida: false, categoria: 'plan', orden: 4 },
  { slug: 'personalizada', nombre: 'Licencia personalizada', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plan', orden: 5 },
  { slug: 'soporte_premium', nombre: 'Soporte premium', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plan', orden: 6 },
  { slug: 'vitalicia_legacy', nombre: 'Licencia Vitalicia Legacy', precio_mensual: null, precio_anual: null, a_la_medida: true, categoria: 'plan', orden: 7 },
];

export const MODALIDADES = ['mensual', 'anual', 'vitalicio'] as const;

// Columnas nuevas (categoria, descripcion, precio_vitalicio, modalidades). Si la
// migración no está aplicada, pedirlas revienta el select ENTERO y el catálogo
// se cae al FALLBACK — que no trae `id`, y sin id no hay uuid para
// subscriptions.plan_id. Por eso el reintento con el juego mínimo de columnas.
const COLS = 'id, slug, nombre, descripcion, precio_mensual, precio_anual, precio_vitalicio, modalidades, a_la_medida, activo, orden, categoria';
const COLS_MIN = 'id, slug, nombre, precio_mensual, precio_anual, a_la_medida, activo, orden';

const faltaColumna = (msg: string) => /categoria|descripcion|modalidades|precio_vitalicio|column|schema cache/i.test(msg || '');

/** Un slug estable a partir del nombre: "Plugin Administración" → plugin_administracion. */
export function slugDe(nombre: string, categoria: string): string {
  const base = String(nombre || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
  if (!base) return '';
  return categoria === 'plugin' && !base.startsWith('plugin_') ? 'plugin_' + base : base;
}

/** Normaliza las modalidades que manda el formulario. Nunca deja el arreglo vacío. */
function modalidadesDe(v: any): string[] {
  const arr = Array.isArray(v) ? v.map(String) : [];
  const limpio = MODALIDADES.filter(m => arr.includes(m));
  return limpio.length ? [...limpio] : ['anual'];
}

/** Cuántas suscripciones cuelgan de cada plan — para el candado de borrado. */
async function usosPorPlan(): Promise<Record<string, number>> {
  const { data } = await supabase.from('subscriptions').select('plan_id').not('plan_id', 'is', null).limit(5000);
  const m: Record<string, number> = {};
  for (const s of (data || []) as any[]) if (s.plan_id) m[s.plan_id] = (m[s.plan_id] || 0) + 1;
  return m;
}

export const GET: APIRoute = async ({ url }) => {
  // ?todos=1 → también los retirados. Configuración los necesita (un concepto
  // retirado sigue explicando las suscripciones que lo traen); los selectores
  // de venta no, porque ya no se ofrecen.
  const todos = url.searchParams.get('todos') === '1';
  const conUsos = url.searchParams.get('usos') === '1';

  let r = await supabase.from('plans').select(COLS).order('orden', { ascending: true });
  let minimo = false;
  if (r.error && faltaColumna(r.error.message || '')) {
    minimo = true;
    r = await supabase.from('plans').select(COLS_MIN).order('orden', { ascending: true }) as any;
  }

  const filas: any[] | null = r.data as any;
  if (r.error || !filas || !filas.length) {
    const fb = FALLBACK.map(p => ({ ...p, precio_mensual: p.precio_mensual ?? PLAN_PRICES[p.slug] ?? null, modalidades: ['mensual', 'anual'], activo: true }));
    return json({ data: fb, fallback: true });
  }

  // Sin las columnas nuevas todo se lee como licencia mensual/anual: es lo que
  // había antes de la migración y no rompe ningún formulario.
  const data = filas
    .map(p => ({
      ...p,
      categoria: p.categoria || 'plan',
      modalidades: Array.isArray(p.modalidades) && p.modalidades.length ? p.modalidades : ['mensual', 'anual'],
    }))
    .filter(p => todos || p.activo !== false);

  if (!conUsos) return json({ data, sin_migrar: minimo || undefined });
  const usos = await usosPorPlan();
  return json({ data: data.map(p => ({ ...p, usos: usos[p.id] || 0 })), sin_migrar: minimo || undefined });
};

/** Campos editables. `slug` no se toca al editar: es la llave con la que se
 *  ligan las suscripciones y renombrarlo las dejaría huérfanas. */
function cuerpo(b: any) {
  const categoria = b.categoria === 'plugin' ? 'plugin' : 'plan';
  const num = (v: any) => (v === '' || v === null || v === undefined ? null : Number(v));
  const precio_mensual = num(b.precio_mensual);
  const precio_anual = num(b.precio_anual);
  const precio_vitalicio = num(b.precio_vitalicio);
  return {
    nombre: String(b.nombre || '').trim().slice(0, 160),
    descripcion: b.descripcion === undefined ? undefined : String(b.descripcion || '').trim().slice(0, 600) || null,
    categoria,
    modalidades: modalidadesDe(b.modalidades),
    precio_mensual, precio_anual, precio_vitalicio,
    // "A la medida" deja de ser un campo que se captura aparte y se contradice
    // con los precios: un concepto es a la medida cuando no tiene ninguno.
    a_la_medida: precio_mensual == null && precio_anual == null && precio_vitalicio == null,
    activo: b.activo !== false,
    orden: Number(b.orden) || null,
  };
}

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => null);
  if (!b?.nombre?.trim()) return json({ error: 'El nombre es obligatorio.' }, 400);

  const c = cuerpo(b);
  const slug = String(b.slug || '').trim() || slugDe(c.nombre, c.categoria);
  if (!slug) return json({ error: 'Del nombre no sale un identificador válido. Usa letras o números.' }, 400);

  const { data: choca } = await supabase.from('plans').select('id, nombre').eq('slug', slug).maybeSingle();
  if (choca) return json({ error: `Ya existe «${choca.nombre}» con ese identificador. Cámbiale el nombre.` }, 409);

  if (c.orden == null) {
    const { data: ult } = await supabase.from('plans').select('orden')
      .eq('categoria', c.categoria).order('orden', { ascending: false }).limit(1).maybeSingle();
    c.orden = (Number(ult?.orden) || (c.categoria === 'plugin' ? 100 : 0)) + 1;
  }

  const { data, error } = await supabase.from('plans').insert({ ...c, slug }).select().single();
  if (error) return json({ error: error.message }, 500);
  return json({ data });
};

export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => null);
  if (!b?.id) return json({ error: 'id requerido' }, 400);
  if (!b?.nombre?.trim()) return json({ error: 'El nombre es obligatorio.' }, 400);

  const c: any = cuerpo(b);
  if (c.descripcion === undefined) delete c.descripcion;
  if (c.orden == null) delete c.orden;
  c.actualizado_at = new Date().toISOString();

  // Renombrar NO reescribe lo vendido: cada suscripción guarda en `nombre_plan`
  // el texto con el que se cerró, y el estado de cuenta del cliente tiene que
  // seguir diciendo lo mismo que su contrato. Emparejar lo viejo es una acción
  // aparte y explícita (`homologar`), con su conteo por delante.
  const { data, error } = await supabase.from('plans').update(c).eq('id', b.id).select().single();
  if (error) return json({ error: faltaColumna(error.message) ? 'Falta aplicar la migración del catálogo (columnas categoria/modalidades).' : error.message }, 500);

  let homologadas = 0;
  if (b.homologar) {
    const { data: subs } = await supabase.from('subscriptions').select('id').eq('plan_id', b.id);
    for (const s of (subs || []) as any[]) {
      const { error: e2 } = await supabase.from('subscriptions').update({ nombre_plan: c.nombre }).eq('id', s.id);
      if (!e2) homologadas++;
    }
  }
  return json({ data, homologadas });
};

export const DELETE: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);

  const { count } = await supabase.from('subscriptions')
    .select('id', { count: 'exact', head: true }).eq('plan_id', id);
  if (count && count > 0) {
    return json({ error: `Lo usan ${count} ${count === 1 ? 'suscripción' : 'suscripciones'}. Desactívalo en vez de borrarlo: deja de ofrecerse y sigue explicando lo ya vendido.` }, 409);
  }
  const { error } = await supabase.from('plans').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
