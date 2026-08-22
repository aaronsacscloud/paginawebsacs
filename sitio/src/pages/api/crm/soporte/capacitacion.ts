// SOPORTE · Capacitación: de qué NO se está entendiendo el sistema.
//
// Agrupa los hallazgos de tipo `duda` —lo que el cliente preguntó de algo que
// SÍ existe— por módulo. Es el temario de un workshop sacado de lo que la gente
// preguntó de verdad, no de lo que suponemos que cuesta trabajo.
//
// Se ordena por CLIENTES DISTINTOS, no por número de dudas. Un cliente que
// pregunta cinco veces lo mismo es un problema de atención de ESE cliente;
// cinco clientes preguntando una vez es un hueco de capacitación. Ordenar por
// volumen confunde los dos y manda a armar el workshop equivocado.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ url }) => {
  const estado = url.searchParams.get('estado') || 'pendiente';
  let q = supabase.from('crm_soporte_hallazgos')
    .select('id, conversation_id, company_id, cuenta, titulo, cita, modulo, accion, confianza, estado, detectado_at, companies(nombre, nombre_comercial, plan)')
    .eq('tipo', 'duda').order('detectado_at', { ascending: false }).limit(500);
  if (estado !== 'todos') q = q.eq('estado', estado);
  const { data, error } = await q;
  if (error) return json({ error: error.message, grupos: [] }, 200);

  const filas = (data || []).map((f: any) => {
    const e = Array.isArray(f.companies) ? f.companies[0] : f.companies;
    const { companies, ...resto } = f;
    return { ...resto, nombre: e?.nombre_comercial || e?.nombre || f.cuenta || 'Sin identificar', plan: e?.plan || null };
  });

  // Agrupado por módulo. Sin módulo va a su propio cajón y NO se disfraza de
  // tema: mezclarlas con las clasificadas inventaría un grupo que no existe.
  const mapa = new Map<string, any>();
  for (const f of filas) {
    const k = f.modulo || '(sin módulo)';
    let g = mapa.get(k);
    if (!g) { g = { modulo: k, sin_clasificar: !f.modulo, dudas: [], clientes: new Set<string>() }; mapa.set(k, g); }
    g.dudas.push(f);
    g.clientes.add(f.company_id || `cuenta:${f.cuenta}`);
  }

  const grupos = [...mapa.values()]
    .map(g => ({
      modulo: g.modulo,
      sin_clasificar: g.sin_clasificar,
      clientes: g.clientes.size,
      n: g.dudas.length,
      // Un workshop se justifica cuando el hueco es de VARIOS, no de uno.
      amerita_workshop: g.clientes.size >= 3,
      nombres: [...new Set(g.dudas.map((d: any) => d.nombre))].slice(0, 12),
      dudas: g.dudas,
    }))
    .sort((a, b) => b.clientes - a.clientes || b.n - a.n || a.modulo.localeCompare(b.modulo));

  const clientesTotal = new Set(filas.map((f: any) => f.company_id || `cuenta:${f.cuenta}`)).size;
  return json({
    grupos,
    resumen: {
      dudas: filas.length,
      clientes: clientesTotal,
      modulos: grupos.filter(g => !g.sin_clasificar).length,
      para_workshop: grupos.filter(g => g.amerita_workshop).length,
      sin_clasificar: grupos.find(g => g.sin_clasificar)?.n || 0,
    },
  });
};
