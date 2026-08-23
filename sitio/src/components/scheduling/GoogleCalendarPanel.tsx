// Panel de conexión con Google Calendar.
//
// Vivía dentro de SchedulingHub, así que para cambiar de cuenta había que
// entrar a Reuniones. Es un ajuste, no una pantalla de trabajo: ahora también
// se monta en Configuración → Reuniones → Agenda. Está en su propio archivo
// para que Configuración no arrastre el hub entero (que pesa y va lazy).
//
// Qué hace: lee /api/scheduling/google/status, manda al flujo OAuth con
// /auth y corta con /disconnect. La identidad sale de la cookie de sesión.
import { useState, useEffect } from 'react';

export function GoogleCalendarPanel() {
  const [status, setStatus] = useState<{ connected: boolean; email: string | null; connected_at: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/scheduling/google/status', { credentials: 'same-origin' });
      const d = await r.json();
      setStatus({ connected: !!d.connected, email: d.email || null, connected_at: d.connected_at || null });
    } catch {
      setStatus({ connected: false, email: null, connected_at: null });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // El callback vuelve a donde se empezó: si conectas desde Configuración,
  // regresas a Configuración y no a la agenda.
  const conectar = () => {
    const ret = encodeURIComponent(window.location.pathname + window.location.hash);
    window.location.href = `/api/scheduling/google/auth?return_url=${ret}`;
  };

  const desconectar = async () => {
    if (!confirm('¿Desconectar este Google Calendar?\n\nLas reuniones que agendes dejarán de crear evento y liga de Meet. Los eventos ya creados se quedan en ese calendario.')) return;
    setBusy(true);
    try {
      await fetch('/api/scheduling/google/disconnect', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await load();
    } finally { setBusy(false); }
  };

  const conectado = !!status?.connected;

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        padding: '14px 16px', borderRadius: 12,
        background: conectado ? '#EAF8F2' : '#fafbfd',
        border: `1px solid ${conectado ? 'rgba(79,191,149,.45)' : '#e8eaf0'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: '#fff',
            border: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
              <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
              <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
              <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
              <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#241d43' }}>Google Calendar</div>
            <div style={{ fontSize: '0.76rem', color: '#6b7280', marginTop: 2 }}>
              {loading
                ? 'Comprobando…'
                : conectado
                  ? <>Conectado{status?.email ? <> con <b style={{ color: '#1E8A63' }}>{status.email}</b></> : ''} · cada reunión crea su evento y su liga de Meet</>
                  : 'Sin conectar. Las reuniones que agendes se quedan solo en el CRM.'}
            </div>
          </div>
        </div>
        {!loading && (
          conectado
            ? <button onClick={desconectar} disabled={busy}
                style={{ border: '1px solid #ddd', background: '#fff', color: '#666', borderRadius: 9, padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? .6 : 1 }}>
                {busy ? 'Desconectando…' : 'Desconectar'}
              </button>
            : <button onClick={conectar}
                style={{ border: 'none', background: '#9B8CFA', color: '#fff', borderRadius: 9, padding: '8px 16px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Conectar
              </button>
        )}
      </div>

      {/* Cambiar de cuenta son dos pasos y no es obvio: hay que soltar la
          actual antes de que Google vuelva a preguntar con cuál entrar. */}
      {conectado && (
        <div style={{ fontSize: '0.74rem', color: '#8a8590', marginTop: 10, lineHeight: 1.55 }}>
          <b style={{ color: '#241d43' }}>¿Cambiar de cuenta?</b> Desconecta y vuelve a conectar: Google te preguntará con cuál
          entrar. Los eventos ya creados se quedan en el calendario viejo, así que cancelar después una de esas
          reuniones no los borrará.
        </div>
      )}
    </div>
  );
}

export default GoogleCalendarPanel;
