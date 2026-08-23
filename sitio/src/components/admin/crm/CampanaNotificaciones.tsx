import { useEffect, useState, useCallback } from 'react';
import ClienteDrawer360 from './ClienteDrawer360';
import { useIsMobile } from '../../../lib/ui/mobile';

/* ═══ Campana de notificaciones del CRM ═══
 *
 * Lo que se cobra solo también hay que verlo solo. Un cargo domiciliado de
 * Mercado Pago entra de madrugada, se registra el pago y la próxima factura
 * avanza sin que nadie toque nada: perfecto para el cliente, invisible para
 * quien lleva el negocio. Aquí caen esos hechos —el cobro que entró, el que
 * rebotó, el dinero que llegó sin dueño— con un clic al cliente.
 *
 * Se refresca cada 60 s y al volver a la pestaña: los cobros no llegan mientras
 * miras, llegan mientras no.
 */

const NIVEL: Record<string, { punto: string; fondo: string }> = {
  urgente: { punto: '#b93333', fondo: '#fff6f6' },
  alerta:  { punto: '#c2410c', fondo: '#fffaf3' },
  info:    { punto: '#1A8F7A', fondo: '#fff' },
};

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');

function hace(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'hace un momento';
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24); if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

export default function CampanaNotificaciones({ onIrA }: { onIrA?: (tab: string) => void }) {
  const isMobile = useIsMobile();
  const [abierto, setAbierto] = useState(false);
  // Dónde nace el panel cuando la campana vive en el menú: se ancla al botón,
  // no a la esquina de la pantalla. Un panel fijo arriba a la derecha, con el
  // botón abajo a la izquierda, obliga a cruzar la vista de punta a punta.
  const [ancla, setAncla] = useState<{ left: number; bottom: number } | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [cliente, setCliente] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const j = await fetch('/api/crm/notificaciones?limit=40', { cache: 'no-store' }).then(r => r.json());
      setData(j.data || []);
      setNoLeidas(j.no_leidas || 0);
    } catch { /* la campana nunca rompe la pantalla */ }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60000);
    const onFocus = () => cargar();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [cargar]);

  async function marcarLeida(n: any) {
    if (n.leida_at) return;
    // Optimista: el contador tiene que bajar en el clic, no en el siguiente poll.
    setData(prev => prev.map(x => x.id === n.id ? { ...x, leida_at: new Date().toISOString() } : x));
    setNoLeidas(c => Math.max(0, c - 1));
    await fetch('/api/crm/notificaciones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }).catch(() => {});
  }
  async function marcarTodas() {
    setData(prev => prev.map(x => x.leida_at ? x : { ...x, leida_at: new Date().toISOString() }));
    setNoLeidas(0);
    await fetch('/api/crm/notificaciones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ todas: true }) }).catch(() => {});
    cargar();
  }

  function abrir(n: any) {
    marcarLeida(n);
    if (n.company_id) { setAbierto(false); setCliente(n.company_id); return; }
    if (n.destino && onIrA) { setAbierto(false); onIrA(n.destino); }
  }

  // El panel sale PEGADO al renglón del menú. La variante suelta arriba a la
  // derecha era de la campana flotante, que ya no existe.
  const panel: any = isMobile
    ? { position: 'fixed', top: 64, left: 8, right: 8, maxHeight: '72vh' }
    : ancla
      ? { position: 'fixed', left: ancla.left, bottom: ancla.bottom, width: 400, maxHeight: '72vh' }
      : { position: 'fixed', left: 230, bottom: 12, width: 400, maxHeight: '78vh' };

  const alternar = (e: any) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAncla({ left: r.right + 8, bottom: Math.max(12, window.innerHeight - r.bottom) });
    setAbierto(a => !a);
    if (!abierto) cargar();
  };

  // Alguna sin leer que de verdad urge: solo entonces el contador se pinta rojo.
  const hayUrgente = data.some((n: any) => !n.leida_at && n.nivel === 'urgente');

  const icono = (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );

  return (
    <>
      {/* La campana es un RENGLÓN del menú, con el mismo alto y la misma letra
          que los demás. Hubo una versión flotante —fija arriba a la derecha
          cuando el menú estaba plegado o en mobile— y se eliminó: tapaba el
          contenido de la pantalla que se estaba usando. Un aviso no puede
          estorbarle al trabajo que anuncia. */}
        <button onClick={alternar} aria-label="Notificaciones"
          style={{
            display: 'flex', alignItems: 'center', gap: 11, width: 'calc(100% - 16px)', minHeight: 38, textAlign: 'left',
            background: abierto ? '#EEECFE' : 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            margin: '1px 8px', padding: '7px 10px', borderRadius: 9,
            fontSize: '0.79rem', fontWeight: 700, color: '#5a5a63',
          }}>
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: '#9B8CFA' }}>{icono}</span>
          Notificaciones
          {noLeidas > 0 && (
            /* Morado, no rojo: en este módulo el rojo significa "atiéndelo hoy"
               —vencidos, eliminados, inasistencias— y unas notificaciones
               normales gastaban esa señal. Vuelve al rojo SOLO si alguna sin
               leer es urgente; así, cuando aparece, se le hace caso. */
            <span style={{
              marginLeft: 'auto', minWidth: 22, textAlign: 'center', borderRadius: 20,
              background: hayUrgente ? '#C0554E' : '#9B8CFA', color: '#fff',
              fontSize: '0.63rem', fontWeight: 800, padding: '3px 8px',
            }}>{noLeidas > 99 ? '99+' : noLeidas}</span>
          )}
        </button>

      {abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 107, background: isMobile ? 'rgba(0,0,0,0.35)' : 'transparent' }} />
          <div style={{
            ...panel, zIndex: 109, background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.16)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid #f0f0f0' }}>
              <b style={{ fontSize: '0.88rem' }}>Notificaciones</b>
              {noLeidas > 0 && <span style={{ fontSize: '0.7rem', color: '#b93333', fontWeight: 700 }}>{noLeidas} sin leer</span>}
              <div style={{ flex: 1 }} />
              {noLeidas > 0 && <button onClick={marcarTodas} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.73rem', color: '#4B7BE5', fontWeight: 700 }}>Marcar todas</button>}
              <button onClick={() => setAbierto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#999' }}>✕</button>
            </div>

            <div style={{ overflowY: 'auto' }}>
              {data.length === 0 ? (
                <div style={{ padding: 26, textAlign: 'center', color: '#999', fontSize: '0.82rem' }}>
                  {cargando ? 'Cargando…' : 'Nada nuevo. Aquí van a caer los cobros automáticos, los rebotes y el dinero sin dueño.'}
                </div>
              ) : data.map((n: any) => {
                const cfg = NIVEL[n.nivel] || NIVEL.info;
                const empresa = Array.isArray(n.companies) ? n.companies[0] : n.companies;
                return (
                  <div key={n.id} onClick={() => abrir(n)}
                    style={{
                      padding: '11px 14px', borderBottom: '1px solid #f6f6f6', cursor: 'pointer',
                      background: n.leida_at ? '#fff' : cfg.fondo,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 99, background: n.leida_at ? '#ddd' : cfg.punto, marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: n.leida_at ? 500 : 700, color: '#1a1a1a', lineHeight: 1.35 }}>{n.titulo}</div>
                        {n.detalle && <div style={{ fontSize: '0.73rem', color: '#777', lineHeight: 1.45, marginTop: 2 }}>{n.detalle}</div>}
                        <div style={{ fontSize: '0.68rem', color: '#aaa', marginTop: 3 }}>
                          {empresa?.nombre ? empresa.nombre + ' · ' : ''}{hace(n.created_at)}
                        </div>
                      </div>
                      {n.monto != null && <div style={{ fontSize: '0.82rem', fontWeight: 800, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(n.monto)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {cliente && <ClienteDrawer360 companyId={cliente} onClose={() => setCliente(null)} onChanged={cargar} />}
    </>
  );
}
