// Carga las fotos de uso_snapshots que alimentan las señales de MOMENTO.
// SOLO SERVIDOR (pega a la BD): las funciones puras viven en momento.ts.
import { supabase } from '../supabase';
import type { Snap } from './momento';

const CAMPOS = 'company_id, fecha, ventas_30d, total_30d, usuarios_operando, clientes_total, lealtad_inscritos, conteos_7d, transferencias_7d, facturas_7d, health_score';

/**
 * Para cada empresa: su foto más reciente y la más VIEJA dentro de la ventana.
 * Se piden las dos puntas en una sola query para las ~220 empresas — pedir por
 * empresa serían 440 viajes por corrida.
 */
export async function fotosPorEmpresa(dias = 30): Promise<Record<string, { hoy: Snap; antes: Snap }>> {
  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const out: Record<string, { hoy: Snap; antes: Snap }> = {};
  try {
    // REGLA DE VELOCIDAD: la RPC trae SOLO la primera y última foto por empresa
    // (DISTINCT ON en SQL, ~284 filas) en vez de las ~3,600 del rango completo.
    // Fallback al barrido viejo si la función no existe en esa base.
    let data: any[] | null = null;
    const rpc = await supabase.rpc('uso_snapshots_extremos', { dias });
    if (!rpc.error && rpc.data) data = rpc.data as any[];
    if (!data) {
      const res = await supabase.from('uso_snapshots')
        .select(CAMPOS).gte('fecha', desde).order('fecha', { ascending: true }).range(0, 49999);
      if (res.error || !res.data) return out;
      data = res.data as any[];
    } else {
      data.sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha)));
    }
    // Primera y última fila de cada empresa: como vienen ordenadas por fecha
    // ascendente, la primera que se ve es la más vieja y la última la más nueva.
    for (const r of data as any[]) {
      const k = String(r.company_id);
      if (!out[k]) out[k] = { antes: r as Snap, hoy: r as Snap };
      else out[k].hoy = r as Snap;
    }
  } catch { /* sin historia → las señales de momento simplemente no opinan */ }
  return out;
}
