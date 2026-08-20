// OUTBOUND · Convivencia: qué campañas compiten por las mismas cuentas y qué
// clientes ya están saturados esta semana (in-app + email). Lo alimenta el
// bloque de presión del cron (presion_por_company, upsert horario).
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async () => {
  const { data: activas } = await supabase.from('inapp_campanas')
    .select('id, nombre, formato, prioridad, materializada').eq('estado', 'activa').is('archived_at', null).limit(50);
  const camps = (activas || []).map((c: any) => ({
    id: c.id, nombre: c.nombre, formato: c.formato, prioridad: c.prioridad,
    cuentas: new Set<string>((c.materializada?.cuentas_lista || []) as string[]),
  }));

  // Traslapes por pares (pocas campañas activas: el n² es trivial)
  const traslapes: any[] = [];
  for (let i = 0; i < camps.length; i++) {
    for (let j = i + 1; j < camps.length; j++) {
      let comunes = 0;
      for (const cu of camps[i].cuentas) if (camps[j].cuentas.has(cu)) comunes++;
      if (comunes > 0) traslapes.push({ a: camps[i].nombre, b: camps[j].nombre, cuentas: comunes });
    }
  }
  traslapes.sort((x, y) => y.cuentas - x.cuentas);

  const lunes = (() => { const x = new Date(); const dw = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - dw); return x.toISOString().slice(0, 10); })();
  const { data: presion } = await supabase.from('presion_por_company')
    .select('company_id, inapp, emails, companies(nombre)').eq('semana', lunes)
    .order('inapp', { ascending: false }).limit(200);
  const saturados = (presion || [])
    .map((p: any) => ({ nombre: p.companies?.nombre || p.company_id, inapp: p.inapp, emails: p.emails, total: (Number(p.inapp) || 0) + (Number(p.emails) || 0) }))
    .filter(p => p.total >= 3)
    .sort((a, b) => b.total - a.total)
    .slice(0, 30);

  return json({
    semana: lunes,
    campanas: camps.map(c => ({ id: c.id, nombre: c.nombre, formato: c.formato, prioridad: c.prioridad, cuentas: c.cuentas.size })),
    traslapes: traslapes.slice(0, 20),
    saturados,
  });
};
