import { useState, useEffect } from 'react';
import ClienteDrawer360 from './ClienteDrawer360';

// ─── Types ───
interface RevenueByPlan {
  count: number;
  mrr: number;
}

interface Deudor {
  id: string;
  nombre: string;
  plan: string;
  mrr: number;
  fecha_renovacion: string;
  days_overdue: number;
}

interface Renovacion {
  id: string;
  nombre: string;
  plan: string;
  mrr: number;
  fecha_renovacion: string;
  days_remaining: number;
}

interface PipelineStage {
  stage: string;
  count: number;
  value: number;
}

interface DashboardData {
  revenue: {
    mrr: number;
    arr: number;
    churn_rate: number;
    avg_ltv: number;
    active_clients: number;
    cancelled_clients: number;
    by_plan: Record<string, RevenueByPlan>;
    payments_this_month: number;
  };
  cobranza: {
    deudores: Deudor[];
    monto_deuda: number;
    renovaciones_proximas: Renovacion[];
  };
  pipeline: {
    total_value: number;
    weighted_value: number;
    open_deals: number;
    won: number;
    lost: number;
    win_rate: number;
    avg_deal_size: number;
    avg_days_to_close: number;
    by_stage: PipelineStage[];
  };
  contacts: {
    total: number;
    leads: number;
    clients: number;
    leads_this_month: number;
    leads_last_month: number;
    lead_growth: number;
  };
  activity: {
    total_this_month: number;
  };
}

// ─── Constants ───
const PLAN_COLORS: Record<string, string> = {
  vende: '#6C5CE7',
  controla: '#4B7BE5',
  fideliza: '#2AB5A0',
  automatiza: '#E8A838',
};

const PLAN_LABELS: Record<string, string> = {
  vende: 'Vende',
  controla: 'Controla',
  fideliza: 'Fideliza',
  automatiza: 'Automatiza',
};

const STAGE_COLORS: Record<string, string> = {
  calificacion: '#6C5CE7',
  demo_agendada: '#4B7BE5',
  demo_realizada: '#E8A838',
  cotizacion_enviada: '#F39C12',
  negociacion: '#2AB5A0',
  cerrada_ganada: '#2e7d32',
  cerrada_perdida: '#999',
};

const STAGE_LABELS: Record<string, string> = {
  calificacion: 'Calificacion',
  demo_agendada: 'Demo agendada',
  demo_realizada: 'Demo realizada',
  cotizacion_enviada: 'Cotizacion enviada',
  negociacion: 'Negociacion',
  cerrada_ganada: 'Cerrada ganada',
  cerrada_perdida: 'Cerrada perdida',
};

// ─── Helpers ───
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');
const fmtK = (n: number) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
};
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtDate = (d: string | null) => {
  if (!d) return '--';
  const date = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  if (isNaN(date.getTime())) return '--';
  return `${date.getDate()}/${date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}`;
};

// ─── Main Component ───
export default function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerCompanyId, setDrawerCompanyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/reports/revenue');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={spinnerStyle} />
          <div style={{ marginTop: 16, color: '#999', fontSize: '0.875rem', fontFamily }}>Cargando dashboard...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>!</div>
          <div style={{ color: '#E54B4B', fontSize: '0.875rem', fontFamily, marginBottom: 16 }}>{error || 'No hay datos disponibles'}</div>
          <button onClick={load} style={{ ...btnBase, background: '#1a1a1a', color: '#fff' }}>Reintentar</button>
        </div>
      </div>
    );
  }

  const { revenue, cobranza, pipeline } = data;
  const dash: any = (data as any).dashboard || {};
  const radar: any[] = dash.radar || [];
  const riesgo: any[] = dash.riesgo || [];
  const reunionesHoy: any[] = dash.reuniones_hoy || [];

  // Compute max MRR for bar chart scale
  const planEntries = Object.entries(revenue.by_plan || {});
  const maxMrr = Math.max(...planEntries.map(([, v]) => v.mrr), 1);

  // Pipeline funnel: filter out closed stages, sort by typical order
  const funnelOrder = ['calificacion', 'demo_agendada', 'demo_realizada', 'cotizacion_enviada', 'negociacion', 'cerrada_ganada'];
  const funnelStages = funnelOrder
    .map(id => {
      const found = (pipeline.by_stage || []).find((s: PipelineStage) => s.stage === id);
      return found ? { ...found, stage: id } : { stage: id, count: 0, value: 0 };
    })
    .filter(s => s.stage !== 'cerrada_perdida');
  const maxFunnelCount = Math.max(...funnelStages.map(s => s.count), 1);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 40px', fontFamily }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: '0.8125rem', color: '#999', margin: '4px 0 0' }}>Vista general del negocio</p>
        </div>
        <button onClick={load} style={{ ...btnBase, background: '#f5f5f5', color: '#555' }}>
          Actualizar
        </button>
      </div>

      {/* ─── KPIs (4): ARR · Clientes activos · Oportunidades $ · Cotizaciones $ ─── */}
      <div className="dash-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <KpiCard
          label="ARR"
          value={fmtK(dash.arr_real ?? revenue.arr)}
          color="#2AB5A0"
          subtitle="Ingreso anual recurrente"
        />
        <KpiCard
          label="Clientes activos"
          value={String(dash.clientes_activos ?? revenue.active_clients)}
          color="#6C5CE7"
          subtitle="con suscripción activa"
        />
        <KpiCard
          label="Oportunidades"
          value={fmtK(dash.oportunidades_monto ?? pipeline.total_value)}
          color="#E8A838"
          subtitle={`${dash.oportunidades_abiertas ?? pipeline.open_deals} abiertas`}
        />
        <KpiCard
          label="Cotizaciones"
          value={fmtK(dash.cotizaciones_monto ?? 0)}
          color="#4B7BE5"
          subtitle={`${dash.cotizaciones_n ?? 0} vivas`}
        />
      </div>

      {/* ─── Section 2: Revenue & Pipeline ─── */}
      <div className="dash-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Left: Revenue by Plan */}
        <div style={cardStyle}>
          <h3 style={cardTitleStyle}>Ingresos por plan</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
            {(['vende', 'controla', 'fideliza', 'automatiza'] as const).map(planId => {
              const plan = revenue.by_plan[planId];
              const mrr = plan?.mrr || 0;
              const count = plan?.count || 0;
              const pct = maxMrr > 0 ? (mrr / maxMrr) * 100 : 0;
              const color = PLAN_COLORS[planId] || '#ccc';
              return (
                <div key={planId}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1a1a1a' }}>{PLAN_LABELS[planId]}</span>
                      <span style={{ fontSize: '0.6875rem', color: '#999', fontWeight: 500 }}>{count} cliente{count !== 1 ? 's' : ''}</span>
                    </div>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 800, color }}>{fmt(mrr)}</span>
                  </div>
                  <div style={{ height: 8, background: '#f0f1f3', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(pct, 2)}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: '#999', fontWeight: 600 }}>Total MRR</span>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1a1a1a' }}>{fmt(revenue.mrr)}</span>
          </div>
        </div>

        {/* Right: Reuniones de hoy */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...cardTitleStyle, margin: 0 }}>Reuniones de hoy</h3>
            {reunionesHoy.length > 0 && (
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#2AB5A0', background: 'rgba(42,181,160,0.1)', padding: '4px 10px', borderRadius: 6 }}>{reunionesHoy.length}</span>
            )}
          </div>
          {reunionesHoy.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#ccc', fontSize: '0.8125rem' }}>No hay reuniones agendadas para hoy</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reunionesHoy.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 8, background: '#fafbfc' }}>
                  <div style={{ fontWeight: 800, color: '#1a1a1a', fontSize: '0.875rem', minWidth: 52 }}>{String(m.hora_inicio || '').slice(0, 5)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.quien}{m.empresa ? ` · ${m.empresa}` : ''}</div>
                    <div style={{ fontSize: '0.7rem', color: '#999' }}>{m.tipo}{m.host ? ` · con ${m.host}` : ''}</div>
                  </div>
                  {m.meet && <a href={m.meet} target="_blank" rel="noreferrer" style={{ ...btnBase, fontSize: '0.68rem', padding: '4px 10px', background: '#e6f6f2', color: '#1A8F7A', textDecoration: 'none' }}>Meet</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Section 3: Cobranza & Renovaciones ─── */}
      <div className="dash-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Left: Deudores */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...cardTitleStyle, margin: 0 }}>Cuentas vencidas</h3>
            {cobranza.monto_deuda > 0 && (
              <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#E54B4B', background: 'rgba(229,75,75,0.08)', padding: '4px 10px', borderRadius: 6 }}>
                Deuda: {fmt(cobranza.monto_deuda)}
              </span>
            )}
          </div>
          {cobranza.deudores.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#ccc', fontSize: '0.8125rem' }}>
              Sin cuentas vencidas
            </div>
          ) : (
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr>
                    {['Empresa', 'Plan', 'MRR', 'Dias vencido', ''].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cobranza.deudores.map((d, i) => {
                    const isOverdue30 = d.days_overdue > 30;
                    return (
                      <tr key={d.id} style={{ background: isOverdue30 ? 'rgba(229,75,75,0.04)' : i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                        <td style={{ ...tdStyle, fontWeight: 700, color: isOverdue30 ? '#E54B4B' : '#1a1a1a' }}>{d.nombre}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: (PLAN_COLORS[d.plan] || '#ccc') + '14', color: PLAN_COLORS[d.plan] || '#888' }}>
                            {PLAN_LABELS[d.plan] || d.plan}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1a1a' }}>{fmt(d.mrr)}</td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 700, color: isOverdue30 ? '#E54B4B' : d.days_overdue > 15 ? '#E8A838' : '#555' }}>
                            {d.days_overdue}d
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <button disabled style={{ ...btnBase, fontSize: '0.6875rem', padding: '4px 10px', background: '#f0f0f0', color: '#bbb', cursor: 'not-allowed' }}>
                            Enviar cobro
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Proximas Renovaciones */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...cardTitleStyle, margin: 0 }}>Proximas renovaciones</h3>
            {cobranza.renovaciones_proximas.length > 0 && (
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#E8A838', background: 'rgba(232,168,56,0.08)', padding: '4px 10px', borderRadius: 6 }}>
                {cobranza.renovaciones_proximas.length} proximas
              </span>
            )}
          </div>
          {cobranza.renovaciones_proximas.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#ccc', fontSize: '0.8125rem' }}>
              Sin renovaciones proximas
            </div>
          ) : (
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr>
                    {['Empresa', 'Plan', 'MRR', 'Fecha', 'Dias'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cobranza.renovaciones_proximas.map((r, i) => {
                    const urgent = r.days_remaining < 7;
                    const ok = r.days_remaining > 15;
                    return (
                      <tr key={r.id} style={{ background: urgent ? 'rgba(232,168,56,0.04)' : i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                        <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1a1a' }}>{r.nombre}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: (PLAN_COLORS[r.plan] || '#ccc') + '14', color: PLAN_COLORS[r.plan] || '#888' }}>
                            {PLAN_LABELS[r.plan] || r.plan}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{fmt(r.mrr)}</td>
                        <td style={tdStyle}>{fmtDate(r.fecha_renovacion)}</td>
                        <td style={tdStyle}>
                          <span style={{
                            fontWeight: 700,
                            color: urgent ? '#E8A838' : ok ? '#2e7d32' : '#555',
                            background: urgent ? 'rgba(232,168,56,0.1)' : ok ? 'rgba(46,125,50,0.08)' : 'transparent',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}>
                            {r.days_remaining}d
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Total MRR at risk */}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#999', fontWeight: 600 }}>MRR en riesgo</span>
                <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#E8A838' }}>
                  {fmt(cobranza.renovaciones_proximas.reduce((sum, r) => sum + r.mrr, 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Oportunidades de venta (Radar) · Cuentas en riesgo ─── */}
      <div className="dash-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        {/* Oportunidades de venta */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...cardTitleStyle, margin: 0 }}>Oportunidades de venta</h3>
            {radar.length > 0 && <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1A8F7A', background: 'rgba(42,181,160,0.1)', padding: '4px 10px', borderRadius: 6 }}>{radar.length}</span>}
          </div>
          {radar.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#ccc', fontSize: '0.8125rem' }}>Sin señales de venta ahora</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {radar.slice(0, 8).map((o) => (
                <div key={o.company_id} onClick={() => setDrawerCompanyId(o.company_id)} style={{ padding: '9px 11px', borderRadius: 8, background: '#f0f7f4', border: '1px solid #d6ebe2', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1A8F7A' }}>{o.cuenta || o.nombre} · {o.titulo}</div>
                  <div style={{ fontSize: '0.75rem', color: '#555', marginTop: 2 }}>{o.accion}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cuentas en riesgo (≥5 días sin vender) */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...cardTitleStyle, margin: 0 }}>Cuentas en riesgo</h3>
            {riesgo.length > 0 && <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#E54B4B', background: 'rgba(229,75,75,0.08)', padding: '4px 10px', borderRadius: 6 }}>{riesgo.length}</span>}
          </div>
          {riesgo.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#ccc', fontSize: '0.8125rem' }}>Sin cuentas en riesgo</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {riesgo.slice(0, 10).map((r) => (
                <div key={r.id} onClick={() => setDrawerCompanyId(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: '#fafbfc', cursor: 'pointer' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cuenta || r.nombre}</div>
                    <div style={{ fontSize: '0.7rem', color: '#999' }}>última venta: {r.ultima_venta_at ? fmtDate(r.ultima_venta_at) : '—'}</div>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: '0.8rem', color: r.dias_sin_venta > 15 ? '#E54B4B' : '#E8A838' }}>{r.dias_sin_venta}d</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {drawerCompanyId && <ClienteDrawer360 companyId={drawerCompanyId} onClose={() => setDrawerCompanyId(null)} onChanged={load} />}

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 900px) {
          .dash-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-two-col { grid-template-columns: 1fr !important; }
          .dash-five-col { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 560px) {
          .dash-kpi-grid { grid-template-columns: 1fr !important; }
          .dash-five-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───
function KpiCard({
  label,
  value,
  color,
  subtitle,
  trend,
  trendValue,
}: {
  label: string;
  value: string;
  color: string;
  subtitle?: string;
  trend?: 'good' | 'bad' | 'neutral';
  trendValue?: string;
}) {
  return (
    <div
      className="dash-kpi-card"
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: '18px 20px',
        borderTop: `3px solid ${color}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: '1.625rem', fontWeight: 800, color: '#1a1a1a', lineHeight: 1.1 }}>{value}</span>
        {trend && trendValue && (
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: trend === 'good' ? '#2e7d32' : trend === 'bad' ? '#E54B4B' : '#999',
          }}>
            {trend === 'good' ? '\u2191' : trend === 'bad' ? '\u2193' : ''} {trendValue}
          </span>
        )}
      </div>
      {subtitle && (
        <div style={{ fontSize: '0.75rem', color: '#bbb', fontWeight: 500, marginTop: 2 }}>{subtitle}</div>
      )}
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  detail,
  badge,
  badgeColor,
}: {
  label: string;
  value: string;
  detail?: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 8px' }}>
      <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#1a1a1a', lineHeight: 1.1 }}>
        {value}
      </div>
      {badge && (
        <span style={{
          display: 'inline-block',
          marginTop: 6,
          fontSize: '0.625rem',
          fontWeight: 700,
          color: badgeColor || '#999',
          background: (badgeColor || '#999') + '14',
          padding: '2px 8px',
          borderRadius: 4,
        }}>
          {badge}
        </span>
      )}
      {detail && (
        <div style={{ fontSize: '0.6875rem', color: '#bbb', marginTop: badge ? 4 : 6 }}>{detail}</div>
      )}
    </div>
  );
}

// ─── Shared styles ───
const fontFamily = "'Plus Jakarta Sans', sans-serif";

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  fontSize: '0.8125rem',
  fontWeight: 600,
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontFamily,
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 800,
  color: '#1a1a1a',
  margin: '0 0 0 0',
};

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left' as const,
  fontSize: '0.625rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: '#aaa',
  background: '#fafbfc',
  borderBottom: '1px solid #f0f0f0',
  whiteSpace: 'nowrap' as const,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: '#555',
  borderBottom: '1px solid #f8f8f8',
};

const spinnerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: '3px solid #f0f0f0',
  borderTopColor: '#4B7BE5',
  borderRadius: '50%',
  animation: 'dashSpin 0.8s linear infinite',
  margin: '0 auto',
};

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('dash-spin-keyframes')) {
  const style = document.createElement('style');
  style.id = 'dash-spin-keyframes';
  style.textContent = '@keyframes dashSpin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}
