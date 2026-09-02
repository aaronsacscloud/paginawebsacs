import { useEffect, useState } from 'react';
import { ESTILOS_ENVIOS } from './TrabajoEnvios';

/* ═══ Consumo de IA ═══ Cuánto cuesta el agente, en qué, por lead y por resultado, contra el presupuesto. */
const usd = (n?: number | null) => n == null ? '—' : `$${Number(n).toFixed(2)}`;
export default function TrabajoConsumo() {
  const [d, setD] = useState<any>(null);
  const [pres, setPres] = useState('');
  const cargar = () => fetch('/api/crm/ti/consumo').then(r => r.json()).then(x => { setD(x); setPres(String(x.presupuesto || 300)); }).catch(() => setD({ error: 'No se pudo cargar' }));
  useEffect(() => { cargar(); }, []);
  if (!d) return <div className="ti-fin"><p>Cargando…</p></div>;
  if (d.error) return <div className="ti-fin"><p>{d.error}</p></div>;
  const color = d.pct >= 100 ? '#b93333' : d.pct >= 80 ? '#B7791F' : '#14532d';
  const maxDia = Math.max(0.01, ...(d.por_dia || []).map((x: any) => x.usd));
  return (
    <div className="ti-envios" style={{ maxWidth: 980, margin: '0 auto' }}>
      <style>{ESTILOS_ENVIOS}</style>
      <h2 className="ti-h" style={{ margin: 0 }}>Consumo de IA</h2>
      <p className="ti-porque" style={{ margin: '4px 0 12px' }}>Cada llamada al modelo queda con su costo. Presupuesto mensual y aviso al 80 % (solo aviso: nada cambia solo).</p>
      <div className="ti-apr-grid">
        <div><b style={{ color }}>{usd(d.mes)}</b><span>este mes · {d.pct} % de {usd(d.presupuesto)}</span></div>
        <div><b>{usd(d.hoy)}</b><span>hoy</span></div>
        <div><b>{usd(d.d7)}</b><span>últimos 7 días</span></div>
        <div><b>{usd(d.proyeccion_mes)}</b><span>proyección del mes</span></div>
        <div><b>{d.citas_mes}</b><span>citas agendadas por el agente · {d.costo_por_cita != null ? `${usd(d.costo_por_cita)} por cita` : 'sin citas aún'}</span></div>
      </div>
      <div style={{ height: 8, background: '#ece9f5', borderRadius: 8, overflow: 'hidden', margin: '4px 0 14px' }}><div style={{ width: `${Math.min(100, d.pct)}%`, height: '100%', background: color }} /></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ fontSize: '.8rem' }}>Presupuesto mensual (USD)</span>
        <input className="ti-envio-input" style={{ width: 110 }} type="number" min={10} value={pres} onChange={e => setPres(e.target.value)} />
        <button className="ti-btn" onClick={async () => { await fetch('/api/crm/ti/consumo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'presupuesto', usd: Number(pres) }) }); cargar(); }}>Guardar</button>
      </div>
      <h3 className="ti-h3">Por día (30 días)</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90, borderBottom: '1px solid #e8e5f0', paddingBottom: 2, marginBottom: 16 }}>
        {(d.por_dia || []).map((x: any) => <div key={x.dia} title={`${x.dia}: ${usd(x.usd)}`} style={{ flex: 1, background: '#9B8CFA', height: `${Math.max(2, (x.usd / maxDia) * 100)}%`, borderRadius: '3px 3px 0 0' }} />)}
      </div>
      <div className="ti-par">
        <div>
          <h3 className="ti-h3">En qué se gasta (30 días)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem' }}><tbody>
            {(d.por_accion || []).map((a: any) => <tr key={a.accion} style={{ borderTop: '1px solid #eeebf6' }}><td style={{ padding: '6px 4px' }}>{a.accion}</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{a.n}×</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{usd(a.usd)}</td></tr>)}
          </tbody></table>
        </div>
        <div>
          <h3 className="ti-h3">Leads que más cuestan (30 días)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem' }}><tbody>
            {(d.por_lead || []).map((l: any) => <tr key={l.contact_id} style={{ borderTop: '1px solid #eeebf6' }}><td style={{ padding: '6px 4px' }}>{l.nombre} <span className="ti-suave" style={{ margin: 0, fontSize: '.7rem' }}>{l.etapa}</span></td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.n}×</td><td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{usd(l.usd)}</td></tr>)}
          </tbody></table>
        </div>
      </div>
    </div>
  );
}
