// Tab "Pagos" del CRM — ligado de verdad al sistema ARR (subscriptions + payments),
// NO al legacy clients. Dos bloques:
//  1) Por cobrar: vencidos + próximos (de /api/crm/arr/summary) con "Abonar" inline
//     (reusa RegistrarPagoModal → activa la sub y avanza proxima_factura).
//  2) Historial de pagos (de /api/crm/arr/payments): por contacto, con TIPO y CONCEPTO,
//     filtros por tipo/referencia y resumen por método.
import { useState, useEffect } from 'react';
import { S, RegistrarPagoModal, ClienteDrawer } from './SubscriptionsTab';

const fmt = (n: number) => '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const today = () => new Date().toISOString().slice(0, 10);

const METODOS = ['transferencia', 'tarjeta', 'stripe', 'efectivo', 'oxxo', 'otro'];
const METODO_LABEL: Record<string, string> = { transferencia: 'Transferencia', tarjeta: 'Tarjeta', stripe: 'Stripe', efectivo: 'Efectivo', oxxo: 'OXXO', otro: 'Otro' };
const METODO_COLOR: Record<string, string> = { transferencia: '#2563eb', tarjeta: '#7c3aed', stripe: '#635bff', efectivo: '#16a34a', oxxo: '#dc2626', otro: '#6b7280' };

// Semáforo de mora: 1-7 días ámbar, 8-30 naranja, +30 rojo.
function moraBadge(dias: number) {
  const [bg, fg] = dias >= 30 ? ['#fde8e8', '#b93333'] : dias >= 8 ? ['#ffedd5', '#c2410c'] : ['#fef3c7', '#b45309'];
  return { background: bg, color: fg, padding: '2px 8px', borderRadius: 6, fontWeight: 700 as const, fontSize: 11 };
}

export default function PagosTab() {
  const [summary, setSummary] = useState<any>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [porTipo, setPorTipo] = useState<Record<string, { count: number; monto: number }>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPago, setShowPago] = useState(false);
  const [pagoPrefill, setPagoPrefill] = useState<any>(null);
  const [drawerCompany, setDrawerCompany] = useState<string | null>(null);
  const [fMetodo, setFMetodo] = useState('');
  const [fQ, setFQ] = useState('');
  const [toast, setToast] = useState('');

  // Dunning — genera un link de pago Stripe para el cobro y lo copia/abre.
  const linkPago = async (subscription_id: string, monto: number) => {
    setToast('Generando link de pago…');
    try {
      const r = await fetch('/api/crm/arr/stripe-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription_id, monto }) });
      const d = await r.json();
      if (d.url) {
        try { await navigator.clipboard.writeText(d.url); } catch { /* clipboard puede fallar sin https/permiso */ }
        window.open(d.url, '_blank');
        setToast('Link de pago copiado y abierto en otra pestaña.');
      } else setToast(d.error || 'No se pudo generar el link (¿Stripe configurado?).');
    } catch { setToast('Error generando el link de pago.'); }
    setTimeout(() => setToast(''), 4000);
  };

  const loadPayments = () => {
    const p = new URLSearchParams();
    if (fMetodo) p.set('metodo', fMetodo);
    if (fQ) p.set('q', fQ);
    p.set('limit', '200');
    return fetch('/api/crm/arr/payments?' + p.toString()).then(r => r.json()).then(d => {
      setPayments(d.payments || []); setPorTipo(d.porTipo || {}); setTotal(d.total || 0);
    }).catch(() => {});
  };

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/crm/arr/summary').then(r => r.json()).then(setSummary).catch(() => {}),
      fetch('/api/crm/arr/subscriptions').then(r => r.json()).then(d => setSubs(d.data || [])).catch(() => {}),
      loadPayments(),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { const t = setTimeout(loadPayments, 300); return () => clearTimeout(t); }, [fMetodo, fQ]);

  const vencidas: any[] = summary?.vencidas || [];
  const proximos: any[] = (summary?.meses?.[0]?.cobros || []).filter((c: any) => c.fecha >= today());
  const totalPorCobrar = [...vencidas, ...proximos].reduce((a, v) => a + (Number(v.monto) || 0), 0);

  const abonar = (subscription_id: string) => { setPagoPrefill({ subscription_id }); setShowPago(true); };

  if (loading && !summary) return <div style={{ padding: 40, color: '#888' }}>Cargando pagos…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Pagos</h2>
          <div style={{ color: '#888', fontSize: 13 }}>Cobranza en vivo: próximos cobros y todo el historial, por contacto y tipo.</div>
        </div>
        <button onClick={() => { setPagoPrefill(null); setShowPago(true); }} style={{ ...S.btn, background: '#2AB5A0', color: '#fff' }}>+ Registrar pago</button>
      </div>

      {/* ── KPIs / pronóstico ── */}
      {summary?.kpis && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={S.kpi}>
            <div style={S.kLabel}>ARR activo</div>
            <div style={S.kValue}>{fmt(summary.kpis.arr_activo || 0)}</div>
            {summary.meta?.monto ? <div style={S.kSub}>{Math.round(100 * (summary.kpis.arr_activo || 0) / Number(summary.meta.monto))}% de la meta {fmt(Number(summary.meta.monto))}</div> : null}
          </div>
          <div style={S.kpi}>
            <div style={S.kLabel}>Por cobrar</div>
            <div style={S.kValue}>{fmt(totalPorCobrar)}</div>
            <div style={{ ...S.kSub, color: vencidas.length ? '#b93333' : '#999' }}>{fmt(vencidas.reduce((a, v) => a + (Number(v.monto) || 0), 0))} vencido · {vencidas.length} cuentas</div>
          </div>
          <div style={S.kpi}>
            <div style={S.kLabel}>Cobranza esperada · 12m</div>
            <div style={S.kValue}>{fmt((summary.meses || []).reduce((a: number, m: any) => a + (Number(m.contratado) || 0), 0))}</div>
            <div style={S.kSub}>proyección de suscripciones activas</div>
          </div>
        </div>
      )}

      {/* ── Por cobrar (vencidos + próximos) ── */}
      <div style={S.card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Por cobrar
          <span style={{ color: '#999', fontWeight: 400, fontSize: 13 }}> · {vencidas.length + proximos.length} cobros · {fmt(totalPorCobrar)}</span>
        </div>
        {(vencidas.length === 0 && proximos.length === 0) ? (
          <div style={{ color: '#16a34a', fontSize: 14 }}>✓ No hay cobros pendientes ni vencidos.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Estado', 'Empresa', 'Concepto', 'Vence', 'Monto', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {vencidas.map((v) => (
                <tr key={'v' + v.subscription_id}>
                  <td style={S.td}><span style={moraBadge(v.dias_vencida)}>Vencido {v.dias_vencida}d</span></td>
                  <td style={S.td}>{v.empresa}</td>
                  <td style={S.td}>{v.plan} <span style={{ color: '#999' }}>· {v.ciclo}</span></td>
                  <td style={{ ...S.td, color: '#b93333' }}>{fmtDate(v.vencida_desde)}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{fmt(v.monto)}</td>
                  <td style={S.td}><div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => abonar(v.subscription_id)} style={{ ...S.btnSmall, background: '#2AB5A0', color: '#fff', border: 'none' }}>Abonar</button>
                    <button onClick={() => linkPago(v.subscription_id, v.monto)} style={S.btnSmall} title="Generar link de pago Stripe">🔗 Link</button>
                  </div></td>
                </tr>
              ))}
              {proximos.map((c) => (
                <tr key={'p' + c.subscription_id}>
                  <td style={S.td}><span style={{ background: '#eef4ff', color: '#2563eb', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11 }}>Próximo</span></td>
                  <td style={S.td}>{c.empresa}</td>
                  <td style={S.td}>{c.plan} <span style={{ color: '#999' }}>· {c.ciclo}</span></td>
                  <td style={S.td}>{fmtDate(c.fecha)}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{fmt(c.monto)}</td>
                  <td style={S.td}><div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => abonar(c.subscription_id)} style={{ ...S.btnSmall, background: '#eef7f5', color: '#2AB5A0', border: '1px solid #cdeae4' }}>Abonar</button>
                    <button onClick={() => linkPago(c.subscription_id, c.monto)} style={S.btnSmall} title="Generar link de pago Stripe">🔗 Link</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Historial de pagos ── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800 }}>Historial de pagos <span style={{ color: '#999', fontWeight: 400, fontSize: 13 }}>· {total}</span></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input placeholder="Buscar referencia…" value={fQ} onChange={e => setFQ(e.target.value)} style={{ ...S.input, width: 170 }} />
            <select value={fMetodo} onChange={e => setFMetodo(e.target.value)} style={S.input}>
              <option value="">Todos los tipos</option>
              {METODOS.map(m => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
            </select>
          </div>
        </div>

        {/* resumen por tipo (clic = filtra) */}
        {Object.keys(porTipo).length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {Object.entries(porTipo).sort((a, b) => b[1].monto - a[1].monto).map(([m, v]) => (
              <span key={m} onClick={() => setFMetodo(fMetodo === m ? '' : m)}
                style={{ cursor: 'pointer', border: `1px solid ${fMetodo === m ? (METODO_COLOR[m] || '#888') : '#e5e7eb'}`, background: fMetodo === m ? (METODO_COLOR[m] || '#888') + '14' : '#fff', borderRadius: 999, padding: '4px 12px', fontSize: 12 }}>
                <b style={{ color: METODO_COLOR[m] || '#374151' }}>{METODO_LABEL[m] || m}</b> · {v.count} · {fmt(v.monto)}
              </span>
            ))}
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Fecha', 'Contacto / Empresa', 'Tipo', 'Concepto', 'Referencia', 'Monto'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#999', padding: 24 }}>Sin pagos con estos filtros.</td></tr>
            ) : payments.map((p) => {
              const contacto = p.contacts ? `${p.contacts.nombre || ''} ${p.contacts.apellido || ''}`.trim() : '';
              const empresa = p.companies?.nombre || '';
              const compId = p.companies?.id;
              return (
                <tr key={p.id} onClick={() => compId && setDrawerCompany(compId)} style={{ cursor: compId ? 'pointer' : 'default' }}>
                  <td style={S.td}>{fmtDate(p.fecha)}</td>
                  <td style={S.td}>{contacto || empresa || '—'}{contacto && empresa ? <span style={{ color: '#999' }}> · {empresa}</span> : null}</td>
                  <td style={S.td}><span style={{ color: METODO_COLOR[p.metodo] || '#374151', fontWeight: 700, fontSize: 12 }}>{METODO_LABEL[p.metodo] || p.metodo}</span></td>
                  <td style={S.td}>{p.subscriptions?.nombre_plan || '—'}{p.subscriptions?.ciclo ? <span style={{ color: '#999' }}> · {p.subscriptions.ciclo}</span> : null}</td>
                  <td style={{ ...S.td, color: '#888' }}>{p.numero_acuse || p.referencia || '—'}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{fmt(p.monto)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showPago && <RegistrarPagoModal subs={subs as any} prefill={pagoPrefill} onClose={() => { setShowPago(false); setPagoPrefill(null); }} onDone={() => { setShowPago(false); setPagoPrefill(null); loadAll(); }} />}
      {drawerCompany && <ClienteDrawer companyId={drawerCompany} onClose={() => setDrawerCompany(null)} onChanged={loadAll} />}
      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>{toast}</div>}
    </div>
  );
}
