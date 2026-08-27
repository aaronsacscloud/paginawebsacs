// InicioMovil — la pantalla de arranque del CRM en el teléfono (goal "CRM de
// bolsillo", M4). Responde UNA pregunta en 2 segundos: ¿cómo va el negocio y
// qué me toca hoy?
//
// Presupuesto v5 (referee): 4 zonas exactas — saludo · número héroe (una línea
// de contexto) · Hoy (agenda) · Necesita tu atención (cross-tab, por urgencia).
// El estado sano guarda silencio: si no hay vencidas ni tickets, la sección de
// atención simplemente no aparece.
//
// En escritorio este componente no existe: el Dashboard completo sigue igual.
import { useEffect, useState } from 'react';

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-MX');

export default function InicioMovil({ onIrA }: { onIrA: (tab: string) => void }) {
  const [cobrado, setCobrado] = useState<number | null>(null);
  const [meta, setMeta] = useState<number>(0);
  const [venc, setVenc] = useState<{ monto: number; n: number } | null>(null);
  const [tickets, setTickets] = useState<number | null>(null);
  const [reuniones, setReuniones] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const hoy = new Date();
    const y = hoy.getFullYear(), m = hoy.getMonth();
    const d1 = new Date(y, m, 1).toISOString().slice(0, 10);
    const d2 = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    const h = hoy.toISOString().slice(0, 10);
    Promise.allSettled([
      fetch(`/api/crm/reports/tablero?desde=${d1}&hasta=${d2}`).then(r => r.json()),
      fetch('/api/crm/cobranza').then(r => r.json()),
      fetch('/api/crm/soporte/dashboard?dias=14').then(r => r.json()),
      fetch(`/api/scheduling/reuniones?from=${h}&to=${h}`).then(r => r.json()),
    ]).then(([t, c, s, r]) => {
      if (t.status === 'fulfilled') {
        // Shape real del tablero: { cobrado: { monto, n }, ... } — sin kpis ni meta
        // (la meta vive en la config del tablero de escritorio; aquí el contexto
        // de la línea 2 es el ARR, que el endpoint sí trae).
        const v = t.value as any;
        setCobrado(Number(v?.cobrado?.monto ?? 0));
        setMeta(Number(v?.recurrente?.arr_hoy ?? 0));
      }
      if (c.status === 'fulfilled') {
        const k = (c.value as any)?.kpis || {};
        if (k.vencido > 0) setVenc({ monto: k.vencido, n: k.vencido_n || 0 });
      }
      if (s.status === 'fulfilled') {
        const tt = (s.value as any)?.totales || {};
        const pend = Number(tt.abiertos || 0);
        if (pend > 0) setTickets(pend);
      }
      if (r.status === 'fulfilled') {
        const lista = (r.value as any)?.reuniones || (Array.isArray(r.value) ? r.value : []);
        setReuniones(lista.slice(0, 3));
      }
      setCargando(false);
    });
  }, []);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  // Sin coma, como la referencia: "jueves 27 de agosto".
  const _f = new Date();
  const fecha = _f.toLocaleDateString('es-MX', { weekday: 'long' }) + ' ' + _f.getDate() + ' de ' + _f.toLocaleDateString('es-MX', { month: 'long' });

  return (
    <div style={{ background: '#fff', minHeight: '60vh' }}>
      {/* saludo + avatar (referencia: misma fila, avatar 44px a la derecha) */}
      <div className="m-hdr" style={{ alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#8f8d98' }}>{fecha}</div>
          <div className="m-tt">{saludo}</div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F3F4F6', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '1.02rem' }}>A</div>
      </div>

      {/* héroe: lo cobrado del mes */}
      <div className="m-hero">
        <div className="m-hl">Cobrado del mes</div>
        {cargando && cobrado == null
          ? <div className="m-skel" style={{ width: 170, height: 38, margin: '4px 0' }} />
          : <div className="m-hv">{money(cobrado || 0)}</div>}
        {meta > 0 && cobrado != null && (
          <div className="m-hd">ARR {money(meta)}</div>
        )}
      </div>

      {/* Hoy */}
      <div className="m-sec">Hoy <span className="m-vt" onClick={() => onIrA('reuniones')}>Agenda ›</span></div>
      {cargando && !reuniones.length && <div className="m-skel" style={{ height: 52, margin: '4px 20px' }} />}
      {!cargando && reuniones.length === 0 && (
        <div style={{ padding: '12px 24px 22px', fontSize: '0.94rem', color: '#9CA3AF', borderBottom: '1px solid #efeef2' }}>Sin reuniones hoy.</div>
      )}
      {reuniones.map((r: any, i: number) => (
        <div key={r.id || i} className="m-row" onClick={() => onIrA('reuniones')}>
          <div style={{ flex: 'none', width: 56, fontWeight: 600, fontSize: '0.9rem', color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
            {(r.hora_inicio || '').slice(0, 5) || '—'}
          </div>
          <div className="m-tx">
            <div className="m-n1">{r.asunto || r.invitee_nombre || 'Reunión'}</div>
            <div className="m-n2">{r.invitee_nombre && r.asunto ? r.invitee_nombre : (r.google_meet_link ? 'Google Meet' : 'agenda')}</div>
          </div>
        </div>
      ))}

      {/* Necesita tu atención — solo habla la excepción */}
      {(venc || tickets) && <div className="m-sec">Necesita tu atención</div>}
      {tickets != null && (
        <div className="m-row" onClick={() => onIrA('soporte')}>
          <div className="m-tx">
            <div className="m-n1">{tickets} ticket{tickets > 1 ? 's' : ''} de soporte abierto{tickets > 1 ? 's' : ''}</div>
            <div className="m-n2">esperando respuesta</div>
          </div>
          <div className="m-fin" style={{ alignSelf: 'center' }}><div className="m-m2">›</div></div>
        </div>
      )}
      {venc && (
        <div className="m-row" onClick={() => onIrA('pagos')}>
          <div className="m-tx">
            <div className="m-n1">Cobranza vencida</div>
            <div className="m-n2">{venc.n} cuenta{venc.n > 1 ? 's' : ''}</div>
          </div>
          <div className="m-fin"><div className="m-m1" style={{ color: '#C0554E' }}>{money(venc.monto)}</div></div>
        </div>
      )}
      <div style={{ height: 24 }} />
    </div>
  );
}
