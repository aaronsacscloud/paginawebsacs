import { useEffect, useMemo, useState } from 'react';
import { ClienteDrawer, S } from './SubscriptionsTab';

/* ═══ Clientes REALES — companies con suscripciones, KPIs y actividad SACS ═══
 * Reemplaza la vista legacy (tabla `clients` con datos de demo). Cada fila es
 * un cliente real; clic → 360 (subs, pagos, actividad, notas). */

const PLAN_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  vende:           { bg: 'rgba(75,123,229,0.12)',  color: '#3764c4', label: 'Vende' },
  controla:        { bg: 'rgba(42,181,160,0.14)',  color: '#1A8F7A', label: 'Controla' },
  fideliza:        { bg: 'rgba(108,92,231,0.12)',  color: '#6C5CE7', label: 'Fideliza' },
  automatiza:      { bg: 'rgba(232,168,56,0.16)',  color: '#a06600', label: 'Automatiza' },
  personalizada:   { bg: 'rgba(26,26,26,0.08)',    color: '#1a1a1a', label: 'Personalizada' },
  soporte_premium: { bg: 'rgba(229,75,75,0.10)',   color: '#b93333', label: 'Soporte premium' },
};

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—';

export default function ClientesTab() {
  const [data, setData] = useState<any[]>([]);
  const [tot, setTot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [fPlan, setFPlan] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const j = await fetch('/api/crm/arr/clientes').then(r => r.json());
      if (j.error) throw new Error(j.error);
      setData(j.data || []); setTot(j.tot || null);
    } catch (e: any) { setError(e?.message || 'No se pudo cargar'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => data.filter(c => {
    if (fPlan && c.plan !== fPlan) return false;
    if (fEstado === 'activos' && c.subs_activas === 0) return false;
    if (fEstado === 'pendientes' && c.subs_pendientes === 0) return false;
    if (fEstado === 'riesgo' && !(c.dias_sin_venta != null && c.dias_sin_venta >= 3 && c.subs_activas > 0)) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [c.nombre, c.sacs_account, c.contacto?.nombre, c.contacto?.email].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [data, search, fPlan, fEstado]);

  if (loading) return <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>Cargando clientes reales…</div>;
  if (error) return <div style={{ padding: 48, textAlign: 'center', color: '#E54B4B' }}>{error} <button style={S.btnSmall} onClick={load}>Reintentar</button></div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {[['Clientes', tot?.clientes], ['Con ARR activo', tot?.activos], ['ARR total', money(tot?.arr)]].map(([l, v]) => (
          <div key={String(l)} style={S.kpi}>
            <div style={S.kLabel}>{l}</div>
            <div style={S.kValue}>{v ?? '—'}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, cuenta o contacto…" style={{ ...S.input, flex: 1, minWidth: 220 }} />
          <select value={fPlan} onChange={e => setFPlan(e.target.value)} style={S.input}>
            <option value="">Todos los planes</option>
            {Object.entries(PLAN_BADGE).map(([v, b]) => <option key={v} value={v}>{b.label}</option>)}
          </select>
          <select value={fEstado} onChange={e => setFEstado(e.target.value)} style={S.input}>
            <option value="">Todos</option>
            <option value="activos">Con ARR activo</option>
            <option value="pendientes">Con pendientes de pago</option>
            <option value="riesgo">En riesgo (≥3 días sin vender)</option>
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Cliente', 'Contacto', 'Plan', 'Subs', 'ARR', 'Pagos', 'Total pagado', 'Próx. factura', 'Últ. venta SACS', 'Salud'].map(h => <th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(c => {
                const b = PLAN_BADGE[c.plan] || null;
                const dias = c.dias_sin_venta;
                return (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(c.id)}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{c.nombre}{c.sacs_account && c.sacs_account !== c.nombre ? <span style={{ color: '#aaa', fontWeight: 400 }}> · {c.sacs_account}</span> : null}</td>
                    <td style={S.td}>{c.contacto ? (c.contacto.nombre + (c.contacto.email ? '' : c.contacto.whatsapp ? ' 📱' : '')) : <span style={{ color: '#c62828' }}>sin contacto</span>}</td>
                    <td style={S.td}>{b ? <span style={{ ...S.badge, background: b.bg, color: b.color }}>{b.label}</span> : <span style={{ color: '#bbb' }}>—</span>}</td>
                    <td style={S.td}>{c.subs_activas}{c.subs_pendientes ? <span style={{ color: '#a06600' }}> +{c.subs_pendientes}⏳</span> : ''}</td>
                    <td style={{ ...S.td, fontWeight: 800 }}>{money(c.arr)}{c.arr_pendiente > 0 ? <div style={{ fontSize: '0.68rem', color: '#a06600' }}>+{money(c.arr_pendiente)} pend.</div> : null}</td>
                    <td style={S.td}>{c.pagos_realizados}</td>
                    <td style={S.td}>{money(c.total_pagado)}</td>
                    <td style={{ ...S.td, color: c.proxima_factura && c.proxima_factura < new Date().toISOString().slice(0, 10) ? '#b93333' : '#333' }}>{fmtDate(c.proxima_factura)}</td>
                    <td style={{ ...S.td, color: dias != null && dias > 15 ? '#b93333' : dias != null && dias >= 3 ? '#a06600' : '#333' }}>
                      {c.ultima_venta_at ? fmtDate(c.ultima_venta_at) + (dias != null ? ` (${dias}d)` : '') : (c.sacs_account ? 'sin datos aún' : 'sin cuenta ligada')}
                    </td>
                    <td style={S.td}>{c.health_score == null ? '—' : <span style={{ fontWeight: 800, color: c.health_score >= 70 ? '#1A8F7A' : c.health_score >= 40 ? '#a06600' : '#b93333' }}>{c.health_score}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <div style={{ padding: 28, textAlign: 'center', color: '#999' }}>Sin clientes con esos filtros.</div>}
        </div>
      </div>

      {detailId && <ClienteDrawer companyId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
}
