// POST /api/crm/arr/aplicar-cobros — repara las ventas ya cobradas cuya licencia
// se quedó 'programada' con la próxima factura en la fecha del alta.
//
// Es el mismo cierre que ahora corre solo al marcar pagada una cotización
// (lib/crm/cobro-cotizacion), aplicado hacia atrás. Idempotente: una licencia
// que ya tiene pagos registrados no se toca.
//
// Body: { dry_run?: boolean (default TRUE), quote_id?: string, cerrar?: boolean }
//   dry_run  simula y reporta sin escribir nada (default — se mira antes de aplicar)
//   quote_id repara UNA sola cotización
//   cerrar   además crea/gana la oportunidad y materializa cliente+licencia
//            cuando la cotización pagada no tiene ninguna (default false)
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { aplicarCobroDeCotizacion, cerrarCotizacionPagada } from '../../../../lib/crm/cobro-cotizacion';

export const prerender = false;
function json(o: any, s = 200) { return new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const dry = body?.dry_run !== false;
    const cerrar = body?.cerrar === true;

    let ids: string[] = [];
    if (body?.quote_id) {
      ids = [String(body.quote_id)];
    } else {
      const { data, error } = await supabase.from('quotes')
        .select('id, pagado_fecha, created_at').eq('estado', 'paid')
        .order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      ids = (data || []).map((q: any) => q.id);
    }

    const aplicadas: any[] = [];
    const sin_efecto: any[] = [];
    for (const id of ids) {
      const r = (cerrar && !dry)
        ? (await cerrarCotizacionPagada(id, { actor: 'backfill' })).cobro
        : await aplicarCobroDeCotizacion(id, { dryRun: dry, actor: 'backfill' });
      if (!r) { sin_efecto.push({ quote_id: id, motivo: 'el cierre no devolvió cobro' }); continue; }
      if (r.aplicado) aplicadas.push({
        quote_id: id, numero: r.numero, dinero: r.dinero, fecha_pago: r.fecha_pago,
        sobrante: r.sobrante, avisos: r.avisos,
        subs: r.subs.map(s => `${s.nombre_plan} (${s.ciclo}): ${s.estado_antes} → ${s.estado} · $${s.asignado} · próxima ${s.proxima_factura_antes || '—'} → ${s.proxima_factura || '—'}`),
      });
      else sin_efecto.push({ quote_id: id, numero: r.numero, motivo: r.motivo, dinero: r.dinero, avisos: r.avisos });
    }

    return json({
      ok: true, dry_run: dry, cerrar,
      revisadas: ids.length,
      aplicadas_n: aplicadas.length,
      aplicadas,
      sin_efecto_n: sin_efecto.length,
      sin_efecto: sin_efecto.slice(0, 100),
    });
  } catch (e: any) { return json({ error: e?.message || String(e) }, 500); }
};
