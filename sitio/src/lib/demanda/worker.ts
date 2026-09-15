// DEMAND ENGINE · el worker.
//
// Toma trabajo de la cola y lo ejecuta hasta que se le acaba el tiempo. Corre
// dentro de un cron de Vercel, así que su primera obligación es MIRAR EL RELOJ:
// la función muere a los 300 s y una acción que no respeta el límite se lleva
// por delante a las que venían detrás.
import { supabase } from '../supabase';
import { tomar, terminar, fallar } from './cola';
import { leerConfig, presupuesto, cobrar } from './config';
import { handlerDe } from './handlers';
import type { Accion } from './tipos';

export type Corrida = {
  tomadas: number; hechas: number; fallidas: number; muertas: number; reprogramadas: number;
  costo_usd: number; ms: number; detalle: { tipo: string; estado: string; resumen?: string }[];
  frenado?: string;
};

/**
 * @param limiteMs  presupuesto de reloj para TODA la corrida.
 * @param lote      cuántas acciones toma por vuelta.
 */
export async function correrWorker(limiteMs = 230_000, lote = 4): Promise<Corrida> {
  const t0 = Date.now();
  const r: Corrida = { tomadas: 0, hechas: 0, fallidas: 0, muertas: 0, reprogramadas: 0, costo_usd: 0, ms: 0, detalle: [] };
  const cfg = await leerConfig(true);

  if (cfg.kill_switch) { r.frenado = 'kill switch'; r.ms = Date.now() - t0; return r; }

  const pres = await presupuesto(cfg);
  const queda = () => limiteMs - (Date.now() - t0);

  while (queda() > 20_000) {
    // Con el presupuesto agotado solo pasa lo que no cuesta dinero de modelo:
    // lo de primera mano, el sistema y lo ya redactado. Frenar del todo dejaría
    // el motor ciego justo cuando más importa saber qué está pasando.
    const acciones = await tomar(lote, 900);
    if (!acciones.length) break;
    r.tomadas += acciones.length;

    for (const a of acciones as Accion[]) {
      const restante = queda();
      // Devolver a la cola lo que ya no cabe es mejor que empezarlo y que el
      // cron lo corte a la mitad: el lease vencido lo recuperaría igual, pero
      // 15 minutos después.
      if (restante < 15_000) { await devolver(a); r.reprogramadas++; continue; }

      if (pres.agotado && cuesta(a.tipo)) {
        await devolver(a, 60 * 60);
        r.reprogramadas++;
        r.detalle.push({ tipo: a.tipo, estado: 'diferida', resumen: 'presupuesto del mes agotado' });
        continue;
      }

      const h = handlerDe(a.tipo);
      if (!h) {
        await fallar(a, `no hay handler para «${a.tipo}»`, true);
        r.muertas++; r.detalle.push({ tipo: a.tipo, estado: 'muerta', resumen: 'sin handler' });
        continue;
      }

      try {
        const res = await h(a, { limite: Date.now() + Math.min(restante - 10_000, 120_000), cfg, ciclo_id: a.ciclo_id });

        if (res.reprogramar_en_seg) {
          await devolver(a, res.reprogramar_en_seg, true);
          r.reprogramadas++; r.detalle.push({ tipo: a.tipo, estado: 'espera', resumen: res.resumen });
          continue;
        }
        if (!res.ok) {
          const fin = await fallar(a, res.resumen || 'el handler devolvió ok:false', res.definitivo);
          fin === 'muerta' ? r.muertas++ : r.fallidas++;
          r.detalle.push({ tipo: a.tipo, estado: fin, resumen: res.resumen });
          continue;
        }

        const costo = Number(res.costo_usd || 0);
        await terminar(a.id, { resumen: res.resumen || null, ...(res.datos || {}) }, costo);
        if (costo > 0) { await cobrar(costo); r.costo_usd += costo; }
        r.hechas++; r.detalle.push({ tipo: a.tipo, estado: 'ok', resumen: res.resumen });

        if (res.siguientes?.length) {
          const { encolarVarias } = await import('./cola');
          await encolarVarias(res.siguientes.map(s => ({ ...s, ciclo_id: s.ciclo_id ?? a.ciclo_id })), cfg);
        }
      } catch (e: any) {
        const fin = await fallar(a, e);
        fin === 'muerta' ? r.muertas++ : r.fallidas++;
        r.detalle.push({ tipo: a.tipo, estado: fin, resumen: String(e?.message || e).slice(0, 200) });
      }
    }
  }

  r.ms = Date.now() - t0;
  return r;
}

/** Qué tipos consumen modelo (y por tanto presupuesto). */
const cuesta = (tipo: string) =>
  tipo.startsWith('geo.') || tipo.startsWith('contenido.') || tipo === 'clasificar' ||
  tipo === 'agrupar' || tipo.startsWith('aprender.') || tipo.startsWith('ingerir.serp');

/** Vuelve a la cola sin gastar un intento (esperar no es fallar). */
async function devolver(a: Accion, enSeg = 0, reiniciarIntentos = false) {
  await supabase.from('de_acciones').update({
    estado: 'lista', lease_hasta: null,
    programada_at: new Date(Date.now() + enSeg * 1000).toISOString(),
    intentos: reiniciarIntentos ? 0 : Math.max(0, a.intentos - 1),
    updated_at: new Date().toISOString(),
  }).eq('id', a.id);
}
