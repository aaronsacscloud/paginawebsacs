// El oído del panel: Realtime de Supabase cuando hay llave, poll de 30 s si no.
//
// Lo que llega por el socket son SEÑALES (ids): "hay mensaje nuevo en tal
// canal". El contenido siempre se trae por la API con la cookie. La llave que
// se usa aquí no puede leer ninguna tabla.
//
// Presencia: Realtime Presence dice quién tiene el panel abierto ahora mismo
// (instantáneo); el latido a /presencia deja la última conexión guardada para
// cuando alguien no está.
import { useEffect, useRef, useState } from 'react';
import { api } from './api';

export type Senal =
  | { tipo: 'msg'; canal_id: string; id: string; autor_id: string; hilo_de?: string | null }
  | { tipo: 'msg_upd'; canal_id: string; id: string; hilo_de?: string | null }
  | { tipo: 'reaccion'; canal_id: string; id: string }
  | { tipo: 'canal'; canal_id?: string }
  | { tipo: 'reunion'; canal_id: string }
  | { tipo: 'presencia' }
  | { tipo: 'poll' };

export function useRealtime(yoId: string | null, onSenal: (s: Senal) => void) {
  const [conectado, setConectado] = useState(false);
  const [enLinea, setEnLinea] = useState<string[]>([]);
  const cb = useRef(onSenal); cb.current = onSenal;

  useEffect(() => {
    if (!yoId) return;
    let vivo = true;
    let canal: any = null;
    let cliente: any = null;
    let poll: any = null;
    const movil = window.matchMedia('(max-width: 768px)').matches ? 'movil' : 'escritorio';

    const arrancarPoll = () => {
      if (poll) return;
      poll = setInterval(() => { if (document.visibilityState === 'visible') cb.current({ tipo: 'poll' }); }, 30_000);
    };

    (async () => {
      try {
        const { url, key } = await api.realtime();
        if (!vivo) return;
        if (!url || !key) { arrancarPoll(); return; }
        const { createClient } = await import('@supabase/supabase-js');
        cliente = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        canal = cliente.channel('espacio', { config: { broadcast: { self: true }, presence: { key: yoId } } });
        canal
          .on('broadcast', { event: 'senal' }, (m: any) => { if (m?.payload?.tipo) cb.current(m.payload as Senal); })
          .on('presence', { event: 'sync' }, () => {
            const st = canal.presenceState() as Record<string, any[]>;
            setEnLinea(Object.keys(st));
          })
          .subscribe(async (estado: string) => {
            if (!vivo) return;
            if (estado === 'SUBSCRIBED') {
              setConectado(true);
              if (poll) { clearInterval(poll); poll = null; }
              await canal.track({ id: yoId, d: movil, t: Date.now() });
              // Al reconectar se pudo perder algo: un poll inmediato lo recupera.
              cb.current({ tipo: 'poll' });
            } else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT' || estado === 'CLOSED') {
              setConectado(false);
              arrancarPoll();
            }
          });
      } catch {
        arrancarPoll();
      }
    })();

    // Latido: la última conexión queda guardada aunque el socket no esté.
    const latir = (estado: 'activo' | 'ausente' | 'fuera' = document.visibilityState === 'visible' ? 'activo' : 'ausente') =>
      api.presencia(estado, movil).catch(() => null);
    latir();
    const lat = setInterval(() => latir(), 60_000);
    const vis = () => { latir(); if (document.visibilityState === 'visible') cb.current({ tipo: 'poll' }); };
    document.addEventListener('visibilitychange', vis);
    const adios = () => {
      try { navigator.sendBeacon('/api/crm/espacio/presencia', new Blob([JSON.stringify({ estado: 'fuera', dispositivo: movil })], { type: 'application/json' })); } catch { /* nada */ }
    };
    window.addEventListener('pagehide', adios);

    return () => {
      vivo = false;
      clearInterval(lat);
      if (poll) clearInterval(poll);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pagehide', adios);
      try { canal?.unsubscribe(); cliente?.removeAllChannels(); } catch { /* nada */ }
    };
  }, [yoId]);

  return { conectado, enLinea };
}
