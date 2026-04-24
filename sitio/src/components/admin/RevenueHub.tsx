import { useState, useEffect } from 'react';
import { plans as plansData } from '../../data/plans';

const PLANS = ['vende', 'controla', 'fideliza', 'automatiza'];
const PLAN_PRICES: Record<string, number> = { vende: 600, controla: 900, fideliza: 1400, automatiza: 2900 };
const IMPL_PRICES: Record<string, number> = { vende: 2000, controla: 4000, fideliza: 6000, automatiza: 9000 };
const METODOS = ['transferencia', 'tarjeta', 'oxxo', 'otro'];
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');
const fmtDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  const date = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  if (isNaN(date.getTime())) return '—';
  const day = date.getDate();
  const month = date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// ─── Meta helpers (analytics stored in notas field) ───
function parseMeta(notas: string | null): { text: string; meta: Record<string, any> } {
  if (!notas) return { text: '', meta: {} };
  const sep = '\n---META---\n';
  const idx = notas.indexOf(sep);
  if (idx === -1) return { text: notas, meta: {} };
  try { return { text: notas.slice(0, idx), meta: JSON.parse(notas.slice(idx + sep.length)) }; }
  catch { return { text: notas, meta: {} }; }
}
function serializeMeta(text: string, meta: Record<string, any>): string {
  if (!Object.keys(meta).length) return text;
  return text + '\n---META---\n' + JSON.stringify(meta);
}
function addTimelineEvent(notas: string | null, event: string): string {
  const { text, meta } = parseMeta(notas);
  if (!meta.timeline) meta.timeline = [];
  meta.timeline.push({ event, at: new Date().toISOString() });
  return serializeMeta(text, meta);
}

interface Client {
  id: string; empresa: string; contacto: string; email: string; whatsapp: string;
  plan: string; sucursales: number; precio_mensual: number; metodo_pago: string;
  fecha_inicio: string; fecha_renovacion: string; estado: string; notas: string;
}

type Tab = 'dashboard' | 'clientes' | 'pagos' | 'cotizaciones' | 'config';

interface RevenueHubProps {
  _initialTab?: Tab;
  _hideNav?: boolean;
}

export default function RevenueHub({ _initialTab, _hideNav }: RevenueHubProps = {}) {
  const [tab, setTab] = useState<Tab>(_initialTab || 'dashboard');
  const [dash, setDash] = useState<any>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Client>>({});
  const [payForm, setPayForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [quoteForm, setQuoteForm] = useState<any>({});
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankForm, setBankForm] = useState<any>({});
  const [allQuotes, setAllQuotes] = useState<any[]>([]);

  const load = async () => {
    const [d, c, ba, q] = await Promise.all([
      fetch('/api/revenue/dashboard').then(r => r.json()),
      fetch('/api/revenue/clients').then(r => r.json()),
      fetch('/api/revenue/bank-accounts').then(r => r.json()),
      fetch('/api/revenue/quotes').then(r => r.json()),
    ]);
    setDash(d);
    setClients(Array.isArray(c) ? c : []);
    setBankAccounts(Array.isArray(ba) ? ba : []);
    setAllQuotes(Array.isArray(q) ? q : []);
  };

  useEffect(() => { load(); }, []);

  // Sync tab when controlled by CrmDashboard
  useEffect(() => {
    if (_initialTab && _initialTab !== tab) setTab(_initialTab);
  }, [_initialTab]);

  // ─── Dashboard ───
  const DashboardView = () => {
    if (!dash) return <div style={S.empty}>Cargando...</div>;
    const chartData = Object.entries(dash.monthlyRevenue || {}).map(([month, amount]) => ({
      month: month.slice(5),
      amount,
    }));

    return (
      <div>
        {/* KPIs */}
        <div style={S.kpiRow}>
          {[
            { label: 'MRR', value: fmt(dash.mrr), color: '#4B7BE5' },
            { label: 'ARR', value: fmt(dash.arr), color: '#2AB5A0' },
            { label: 'Clientes activos', value: dash.activeClients, color: '#6C5CE7' },
            { label: 'Churn', value: dash.churnRate + '%', color: dash.churnRate > 5 ? '#E54B4B' : '#2AB5A0' },
          ].map(k => (
            <div key={k.label} style={S.kpi}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: '0.6875rem', color: '#999', fontWeight: 500, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Revenue chart */}
        <div style={S.card}>
          <h3 style={S.cardTitle}>Ingresos mensuales</h3>
          {/* CSS bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200 }}>
            {chartData.map((d: any, i: number) => {
              const max = Math.max(...chartData.map((x: any) => x.amount as number), 1);
              const h = ((d.amount as number) / max) * 180;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div title={fmt(d.amount as number)} style={{ width: '100%', height: h, background: '#4B7BE5', borderRadius: '4px 4px 0 0', minHeight: 2, transition: 'height 0.3s ease' }} />
                  <span style={{ fontSize: '0.5625rem', color: '#aaa' }}>{d.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Overdue */}
          <div style={S.card}>
            <h3 style={{ ...S.cardTitle, color: '#E54B4B' }}>Vencidos ({(dash.overdue || []).length})</h3>
            {(dash.overdue || []).length === 0 ? <div style={S.empty}>Sin vencidos</div> :
              (dash.overdue || []).map((c: any) => (
                <div key={c.id} style={S.listItem}>
                  <div><strong>{c.empresa}</strong> · {c.plan}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#E54B4B' }}>Venció: {fmtDate(c.fecha_renovacion)}</div>
                </div>
              ))
            }
          </div>

          {/* Next renewals */}
          <div style={S.card}>
            <h3 style={S.cardTitle}>Próximas renovaciones</h3>
            {(dash.nextRenewals || []).length === 0 ? <div style={S.empty}>Sin renovaciones próximas</div> :
              (dash.nextRenewals || []).slice(0, 10).map((c: any) => (
                <div key={c.id} style={S.listItem}>
                  <div><strong>{c.empresa}</strong> · {fmt(c.precio_mensual * (c.sucursales || 1))}/mes</div>
                  <div style={{ fontSize: '0.6875rem', color: '#E8A838' }}>Renueva: {fmtDate(c.fecha_renovacion)}</div>
                </div>
              ))
            }
          </div>
        </div>

        {/* By plan */}
        <div style={S.card}>
          <h3 style={S.cardTitle}>Distribución por plan</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
            {Object.entries(dash.byPlan || {}).map(([plan, data]: any) => (
              <div key={plan} style={{ flex: '1 0 120px', background: '#f8f9fb', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: '0.6875rem', color: '#999', textTransform: 'capitalize' as const }}>{plan}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a' }}>{data.count}</div>
                <div style={{ fontSize: '0.6875rem', color: '#4B7BE5' }}>{fmt(data.mrr)}/mes</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline funnel */}
        {allQuotes.length > 0 && (() => {
          const total = allQuotes.length;
          const sent = allQuotes.filter((q: any) => q.estado === 'sent' || q.estado === 'accepted' || q.estado === 'paid');
          const viewed = allQuotes.filter((q: any) => { const { meta } = parseMeta(q.notas); return (meta.views || 0) > 0; });
          const accepted = allQuotes.filter((q: any) => q.estado === 'accepted' || q.estado === 'paid');
          const paid = allQuotes.filter((q: any) => q.estado === 'paid');
          const stages = [
            { label: 'Creadas', count: total, amount: allQuotes.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#999', width: 100 },
            { label: 'Enviadas', count: sent.length, amount: sent.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#4B7BE5', width: total > 0 ? Math.max((sent.length / total) * 100, 20) : 20 },
            { label: 'Vistas', count: viewed.length, amount: viewed.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#6C5CE7', width: total > 0 ? Math.max((viewed.length / total) * 100, 15) : 15 },
            { label: 'Aceptadas', count: accepted.length, amount: accepted.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#2AB5A0', width: total > 0 ? Math.max((accepted.length / total) * 100, 10) : 10 },
            { label: 'Pagadas', count: paid.length, amount: paid.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#2e7d32', width: total > 0 ? Math.max((paid.length / total) * 100, 8) : 8 },
          ];
          return (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Pipeline de cotizaciones</h3>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                {stages.map((st, i) => {
                  const prevCount = i > 0 ? stages[i - 1].count : st.count;
                  const rate = prevCount > 0 ? Math.round((st.count / prevCount) * 100) : 0;
                  return (
                    <div key={st.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 70, fontSize: '0.6875rem', fontWeight: 600, color: '#666', textAlign: 'right' as const }}>{st.label}</div>
                      <div style={{ flex: 1, position: 'relative' as const }}>
                        <div style={{ width: `${st.width}%`, height: 32, background: st.color, borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 10, gap: 8, transition: 'width 0.4s ease', margin: '0 auto' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#fff' }}>{st.count}</span>
                          <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.7)' }}>{fmt(st.amount)}</span>
                        </div>
                      </div>
                      <div style={{ width: 40, fontSize: '0.625rem', fontWeight: 600, color: i === 0 ? 'transparent' : st.count > 0 ? '#2AB5A0' : '#ccc' }}>{i > 0 ? `${rate}%` : ''}</div>
                    </div>
                  );
                })}
              </div>
              {total > 0 && (
                <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#999' }}>Tasa de cierre: <strong style={{ color: accepted.length > 0 ? '#2AB5A0' : '#ccc' }}>{total > 0 ? Math.round((accepted.length / total) * 100) : 0}%</strong></div>
                  <div style={{ fontSize: '0.6875rem', color: '#999' }}>Valor pipeline: <strong style={{ color: '#4B7BE5' }}>{fmt(sent.reduce((s: number, q: any) => s + (q.total || 0), 0))}</strong></div>
                  <div style={{ fontSize: '0.6875rem', color: '#999' }}>Ticket promedio: <strong style={{ color: '#1a1a1a' }}>{fmt(total > 0 ? allQuotes.reduce((s: number, q: any) => s + (q.total || 0), 0) / total : 0)}</strong></div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // ─── Clients ───
  const ClientsView = () => {
    const filtered = clients.filter(c =>
      !search || c.empresa?.toLowerCase().includes(search.toLowerCase()) ||
      c.contacto?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
    );

    const saveClient = async () => {
      setSaving(true);
      if (form.id) {
        await fetch('/api/revenue/clients', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      } else {
        await fetch('/api/revenue/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      }
      setShowForm(false);
      setForm({});
      await load();
      setSaving(false);
    };

    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." style={S.input} />
          <button onClick={() => { setForm({}); setShowForm(true); }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff' }}>+ Nuevo cliente</button>
        </div>

        <div style={S.card}>
          <table style={S.table}>
            <thead>
              <tr>{['Empresa', 'Contacto', 'Plan', 'Suc.', 'Precio/mes', 'Renovación', 'Estado', ''].map(h =>
                <th key={h} style={S.th}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={S.tr}>
                  <td style={{ ...S.td, fontWeight: 700, color: '#1a1a1a' }}>{c.empresa}</td>
                  <td style={S.td}>{c.contacto}</td>
                  <td style={S.td}><span style={{ ...S.badge, background: '#e3f2fd', color: '#1565c0', textTransform: 'capitalize' as const }}>{c.plan || '-'}</span></td>
                  <td style={S.td}>{c.sucursales}</td>
                  <td style={S.td}>{fmt(c.precio_mensual * (c.sucursales || 1))}</td>
                  <td style={S.td}>
                    <span style={{ color: c.fecha_renovacion && c.fecha_renovacion < new Date().toISOString().slice(0, 10) ? '#E54B4B' : '#555' }}>
                      {fmtDate(c.fecha_renovacion)}
                    </span>
                  </td>
                  <td style={S.td}><span style={{ ...S.badge, background: c.estado === 'activo' ? '#e8f5e9' : '#fce4ec', color: c.estado === 'activo' ? '#2e7d32' : '#c62828' }}>{c.estado}</span></td>
                  <td style={S.td}>
                    <button onClick={() => { setForm(c); setShowForm(true); }} style={S.btnSmall}>Editar</button>
                    <button onClick={() => { setSelected(c); setTab('pagos'); }} style={{ ...S.btnSmall, background: '#e8f5e9', color: '#2e7d32' }}>Pago</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Client form modal */}
        {showForm && (
          <div style={S.overlay}>
            <div style={S.modal}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>{form.id ? 'Editar cliente' : 'Nuevo cliente'}</h3>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={S.label}>Empresa</label><input value={form.empresa || ''} onChange={e => setForm({ ...form, empresa: e.target.value })} style={S.input} /></div>
                <div><label style={S.label}>Contacto</label><input value={form.contacto || ''} onChange={e => setForm({ ...form, contacto: e.target.value })} style={S.input} /></div>
                <div><label style={S.label}>Email</label><input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} style={S.input} /></div>
                <div><label style={S.label}>WhatsApp</label><input value={form.whatsapp || ''} onChange={e => setForm({ ...form, whatsapp: e.target.value })} style={S.input} /></div>
                <div><label style={S.label}>Plan</label><select value={form.plan || ''} onChange={e => setForm({ ...form, plan: e.target.value, precio_mensual: PLAN_PRICES[e.target.value] || form.precio_mensual })} style={S.input}><option value="">-</option>{PLANS.map(p => <option key={p} value={p}>{p} (${PLAN_PRICES[p]}/mes)</option>)}</select></div>
                <div><label style={S.label}>Sucursales</label><input type="number" value={form.sucursales || 1} onChange={e => setForm({ ...form, sucursales: parseInt(e.target.value) || 1 })} style={S.input} /></div>
                <div><label style={S.label}>Precio/mes por suc.</label><input type="number" value={form.precio_mensual || ''} onChange={e => setForm({ ...form, precio_mensual: parseFloat(e.target.value) || 0 })} style={S.input} /></div>
                <div><label style={S.label}>Método de pago</label><select value={form.metodo_pago || 'transferencia'} onChange={e => setForm({ ...form, metodo_pago: e.target.value })} style={S.input}>{METODOS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                <div><label style={S.label}>Fecha inicio</label><input type="date" value={form.fecha_inicio || ''} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} style={S.input} /></div>
                <div><label style={S.label}>Fecha renovación</label><input type="date" value={form.fecha_renovacion || ''} onChange={e => setForm({ ...form, fecha_renovacion: e.target.value })} style={S.input} /></div>
                <div><label style={S.label}>Estado</label><select value={form.estado || 'activo'} onChange={e => setForm({ ...form, estado: e.target.value })} style={S.input}><option value="activo">Activo</option><option value="cancelado">Cancelado</option><option value="pendiente">Pendiente</option></select></div>
              </div>
              <div><label style={S.label}>Notas</label><textarea value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} style={{ ...S.input, height: 60, resize: 'vertical' as const }} /></div>
              <button onClick={saveClient} disabled={saving} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', width: '100%', marginTop: 12 }}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Payments ───
  const PaymentsView = () => {
    const [payments, setPayments] = useState<any[]>([]);
    const [loadingP, setLoadingP] = useState(true);

    useEffect(() => {
      fetch('/api/revenue/payments').then(r => r.json()).then(d => { setPayments(Array.isArray(d) ? d : []); setLoadingP(false); });
    }, []);

    const registerPayment = async () => {
      if (!payForm.client_id || !payForm.monto) return;
      setSaving(true);
      await fetch('/api/revenue/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payForm) });
      setPayForm({});
      const d = await fetch('/api/revenue/payments').then(r => r.json());
      setPayments(Array.isArray(d) ? d : []);
      await load();
      setSaving(false);
    };

    return (
      <div>
        {/* Register payment form */}
        <div style={{ ...S.card, marginBottom: 16 }}>
          <h3 style={S.cardTitle}>Registrar pago</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div><label style={S.label}>Cliente</label><select value={payForm.client_id || ''} onChange={e => setPayForm({ ...payForm, client_id: e.target.value })} style={S.input}>
              <option value="">Seleccionar...</option>
              {clients.filter(c => c.estado === 'activo').map(c => <option key={c.id} value={c.id}>{c.empresa}</option>)}
            </select></div>
            <div><label style={S.label}>Monto</label><input type="number" value={payForm.monto || ''} onChange={e => setPayForm({ ...payForm, monto: e.target.value })} placeholder="$" style={S.input} /></div>
            <div><label style={S.label}>Fecha</label><input type="date" value={payForm.fecha || new Date().toISOString().slice(0, 10)} onChange={e => setPayForm({ ...payForm, fecha: e.target.value })} style={S.input} /></div>
            <div><label style={S.label}>Método</label><select value={payForm.metodo || 'transferencia'} onChange={e => setPayForm({ ...payForm, metodo: e.target.value })} style={S.input}>{METODOS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
            <button onClick={registerPayment} disabled={saving} style={{ ...S.btn, background: '#2AB5A0', color: '#fff' }}>{saving ? '...' : 'Registrar'}</button>
          </div>
        </div>

        {/* Payments history */}
        <div style={S.card}>
          <h3 style={S.cardTitle}>Historial de pagos</h3>
          {loadingP ? <div style={S.empty}>Cargando...</div> :
            <table style={S.table}>
              <thead><tr>{['Fecha', 'Cliente', 'Monto', 'Método', 'Referencia'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} style={S.tr}>
                    <td style={S.td}>{fmtDate(p.fecha)}</td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{p.clients?.empresa || '-'}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: '#2AB5A0' }}>{fmt(p.monto)}</td>
                    <td style={S.td}>{p.metodo}</td>
                    <td style={S.td}>{p.referencia || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        </div>
      </div>
    );
  };

  // ─── Quotes ───
  const QuotesView = () => {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [showDrawer, setShowDrawer] = useState(false);
    const [qf, setQf] = useState<any>({ empresa: '', contacto: '', email: '', whatsapp: '', items: [], iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern', condiciones: 'Precios en MXN. Migracion incluida en planes de pago. Soporte 24/7 incluido. Sin contratos de permanencia.' });
    const [qSearch, setQSearch] = useState('');
    const [qFilter, setQFilter] = useState<string>('all');
    const [qSort, setQSort] = useState<{ col: string; asc: boolean }>({ col: 'created_at', asc: false });
    const [qPage, setQPage] = useState(0);
    // HubSpot-style: saved views, advanced filters, bulk selection, column customization, density
    const [qView, setQView] = useState<string>(() => typeof window !== 'undefined' ? (localStorage.getItem('sacs_q_view') || 'all') : 'all');
    const [qPageSize, setQPageSize] = useState<number>(() => typeof window !== 'undefined' ? (parseInt(localStorage.getItem('sacs_q_pagesize') || '25') || 25) : 25);
    const [qSelected, setQSelected] = useState<Set<string>>(new Set());
    const [qDensity, setQDensity] = useState<'compact' | 'comfortable'>(() => typeof window !== 'undefined' ? ((localStorage.getItem('sacs_q_density') as any) || 'comfortable') : 'comfortable');
    const [qVisibleCols, setQVisibleCols] = useState<Set<string>>(() => {
      if (typeof window === 'undefined') return new Set(['numero', 'created_at', 'empresa', 'total', 'estado', 'views', 'actions']);
      const saved = localStorage.getItem('sacs_q_cols');
      return new Set(saved ? JSON.parse(saved) : ['numero', 'created_at', 'empresa', 'total', 'estado', 'views', 'actions']);
    });
    const [qShowColsMenu, setQShowColsMenu] = useState(false);
    const [qShowFilterPopover, setQShowFilterPopover] = useState(false);
    const [qFilters, setQFilters] = useState<Array<{ field: string; op: string; value: any }>>([]);
    const [qMenuRow, setQMenuRow] = useState<string | null>(null);
    const PER_PAGE = qPageSize;
    // Transcript analysis
    const [showTranscriptModal, setShowTranscriptModal] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [showReview, setShowReview] = useState(false);
    // Manual accept modal
    const [acceptForm, setAcceptForm] = useState<any>(null); // { quoteId, numero, nombre, method, nota }
    const [acceptSaving, setAcceptSaving] = useState(false);
    // Reject modal
    const [rejectForm, setRejectForm] = useState<any>(null); // { quoteId, numero, motivo, detalle }
    const [rejectSaving, setRejectSaving] = useState(false);

    useEffect(() => {
      fetch('/api/revenue/quotes').then(r => r.json()).then(d => setQuotes(Array.isArray(d) ? d : []));
    }, []);

    // Close row menu / popovers on outside click
    useEffect(() => {
      const close = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-q-menu]') && !target.closest('button[title="Más acciones"]')) setQMenuRow(null);
      };
      document.addEventListener('mousedown', close);
      return () => document.removeEventListener('mousedown', close);
    }, []);

    // Ensure items is always an array
    const items = Array.isArray(qf.items) ? qf.items : [];

    const addPlanItem = () => {
      setQf({ ...qf, items: [...items, { tipo: 'plan', nombre: 'controla', sucursales: 1, precio_unitario: 900, periodo: 'mensual', descuento_pct: 0, subtotal: 900 }] });
    };

    const addExtraItem = () => {
      setQf({ ...qf, items: [...items, { tipo: 'extra', nombre: '', monto: 0, recurrente: false, descripcion: '' }] });
    };

    const updateItem = (idx: number, field: string, value: any) => {
      const arr = [...items];
      arr[idx] = { ...arr[idx], [field]: value };
      if (arr[idx].tipo === 'plan') {
        const p = PLAN_PRICES[arr[idx].nombre] || 0;
        arr[idx].precio_unitario = p;
        const suc = parseInt(arr[idx].sucursales) || 1;
        const isAnn = arr[idx].periodo === 'anual';
        const sub = p * suc * (isAnn ? 10 : 1);
        const disc = sub * (parseFloat(arr[idx].descuento_pct || 0) / 100);
        arr[idx].subtotal = sub - disc;
      } else if (!arr[idx].es_promocion) {
        const base = parseFloat(arr[idx].monto) || 0;
        const pe = arr[idx].periodo_extra || (arr[idx].recurrente ? 'mensual' : 'unico');
        arr[idx].recurrente = pe === 'mensual' || pe === 'anual';
        arr[idx].subtotal = pe === 'anual' ? base * 10 : base;
      }
      setQf({ ...qf, items: arr });
    };

    const removeItem = (idx: number) => {
      setQf({ ...qf, items: items.filter((_: any, i: number) => i !== idx) });
    };

    // Calculate totals
    const itemsSubtotal = items.reduce((s: number, i: any) => s + (i.subtotal || parseFloat(i.monto) || 0), 0);
    const globalDisc = qf.descuento_tipo === 'pct' ? itemsSubtotal * (parseFloat(qf.descuento_global) || 0) / 100 : (parseFloat(qf.descuento_global) || 0);
    const afterDisc = itemsSubtotal - globalDisc;
    // iva_mode: 'sin' = sin IVA, 'suma' = IVA sumado al total, 'incluido' = IVA ya incluido en precios
    const ivaMode = qf.iva_mode || (qf.iva_incluido ? 'suma' : 'sin');
    const ivaMonto = ivaMode === 'suma' ? afterDisc * 0.16 : ivaMode === 'incluido' ? afterDisc - (afterDisc / 1.16) : 0;
    const grandTotal = ivaMode === 'suma' ? afterDisc + (afterDisc * 0.16) : afterDisc;

    const createQuote = async () => {
      // Validate required fields for TikTok tracking
      if (!qf.empresa?.trim() || !qf.email?.trim() || !qf.whatsapp?.trim()) {
        alert('Empresa, Email y WhatsApp son obligatorios');
        return;
      }
      setSaving(true);
      const isEdit = !!qf.id;
      // Store logo_url in meta, add timeline events
      let notas = qf.notas || '';
      const { text, meta } = parseMeta(notas);
      if (qf.logo_url) meta.logo_url = qf.logo_url;
      else delete meta.logo_url;
      meta.iva_mode = ivaMode;
      meta.mostrar_timer = qf.mostrar_timer !== undefined ? qf.mostrar_timer : true;
      meta.mostrar_features = qf.mostrar_features !== undefined ? qf.mostrar_features : true;
      meta.mostrar_desglose = qf.mostrar_desglose !== undefined ? qf.mostrar_desglose : true;
      meta.mostrar_condiciones = qf.mostrar_condiciones !== undefined ? qf.mostrar_condiciones : true;
      meta.mostrar_key_points = qf.mostrar_key_points !== undefined ? qf.mostrar_key_points : true;
      meta.mostrar_roi = qf.mostrar_roi || false;
      meta.mostrar_antes_despues = qf.mostrar_antes_despues || false;
      meta.mostrar_firma = qf.mostrar_firma !== undefined ? qf.mostrar_firma : true;
      meta.mostrar_qr = qf.mostrar_qr !== undefined ? qf.mostrar_qr : true;
      meta.mostrar_animaciones = qf.mostrar_animaciones !== undefined ? qf.mostrar_animaciones : true;
      meta.mostrar_timeline = qf.mostrar_timeline !== undefined ? qf.mostrar_timeline : true;
      meta.timeline_tipo = qf.timeline_tipo || '1suc';
      meta.mostrar_porque_sacs = qf.mostrar_porque_sacs !== undefined ? qf.mostrar_porque_sacs : true;
      meta.mostrar_implementacion = qf.mostrar_implementacion !== undefined ? qf.mostrar_implementacion : true;
      if (qf.implementacion_nota) meta.implementacion_nota = qf.implementacion_nota;
      else delete meta.implementacion_nota;
      if (qf.key_points?.length) meta.key_points = qf.key_points;
      else delete meta.key_points;
      if (qf.roi) meta.roi = qf.roi;
      else delete meta.roi;
      if (qf.antes_despues?.length) meta.antes_despues = qf.antes_despues;
      else delete meta.antes_despues;

      // Version tracking — full snapshot for navigation
      if (!meta.versions) meta.versions = [];
      const snapshot = {
        at: new Date().toISOString(), total: Math.round(grandTotal),
        items_count: items.length, moneda: qf.moneda || 'MXN',
        items: JSON.parse(JSON.stringify(items)),
        subtotal: itemsSubtotal, iva_monto: Math.round(ivaMonto),
        descuento_global: parseFloat(qf.descuento_global) || 0,
        descuento_tipo: qf.descuento_tipo || 'pct',
        condiciones: qf.condiciones || '',
      };
      if (!isEdit) {
        meta.versions.push({ v: 1, ...snapshot });
      } else {
        const nextV = (meta.versions.length || 0) + 1;
        meta.versions.push({ v: nextV, ...snapshot });
      }

      notas = serializeMeta(text, meta);
      if (!isEdit) {
        notas = addTimelineEvent(notas, 'created');
        notas = addTimelineEvent(notas, 'sent');
      } else {
        notas = addTimelineEvent(notas, 'edited');
      }
      // Remove frontend-only fields
      const { _custom_days, logo_url, iva_mode: _im, _pago_mode, mostrar_timer: _mt, mostrar_features: _mf, mostrar_desglose: _md, mostrar_condiciones: _mc, mostrar_key_points: _mkp, key_points: _kp, roi: _roi, antes_despues: _ad, mostrar_roi: _mr, mostrar_antes_despues: _mad, mostrar_firma: _msf, mostrar_qr: _mq, mostrar_animaciones: _ma, mostrar_timeline: _mtl, timeline_tipo: _tt, mostrar_implementacion: _mi, implementacion_nota: _in, mostrar_porque_sacs: _mps, ...rest } = qf;
      const folioOffset = typeof window !== 'undefined' ? parseInt(localStorage.getItem('sacs_folio_offset') || '0') || 0 : 0;
      const body = { ...rest, notas, subtotal: itemsSubtotal, iva_incluido: ivaMode !== 'sin', iva_monto: Math.round(ivaMonto), total: Math.round(grandTotal), estado: rest.estado || 'sent', _folio_offset: folioOffset };

      // Save quote first
      const res = await fetch('/api/revenue/quotes', { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const savedQuote = await res.json();

      // Generate Stripe link if mode is stripe
      if (_pago_mode === 'stripe' && savedQuote.id && Math.round(grandTotal) > 0) {
        const stripeRes = await fetch('/api/revenue/create-payment-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quote_id: savedQuote.id,
            numero: savedQuote.numero,
            empresa: savedQuote.empresa,
            email: savedQuote.email,
            total: Math.round(grandTotal),
            moneda: savedQuote.moneda || 'MXN',
            items: Array.isArray(savedQuote.items) ? savedQuote.items : [],
            vigencia: savedQuote.vigencia,
          }),
        });
        const stripeData = await stripeRes.json();
        if (stripeData.url) {
          await fetch('/api/revenue/quotes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: savedQuote.id, link_pago: stripeData.url }),
          });
        }
      }

      setShowDrawer(false);
      setQf({ empresa: '', contacto: '', email: '', whatsapp: '', items: [], iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern', condiciones: 'Precios en MXN. Migracion incluida. Soporte 24/7. Sin contratos.' });
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
      setSaving(false);
    };

    const markQuotePaid = async (q: any) => {
      if (!confirm(`¿Marcar cotización ${q.numero} como pagada?`)) return;
      setSaving(true);
      await fetch('/api/revenue/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: q.id }),
      });
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
      setSaving(false);
    };

    const openAcceptModal = (q: any) => {
      setAcceptForm({ quoteId: q.id, numero: q.numero, nombre: q.contacto || q.empresa || '', method: 'whatsapp', nota: '' });
    };

    const openRejectModal = (q: any) => {
      setRejectForm({ quoteId: q.id, numero: q.numero, empresa: q.empresa, motivo: '', detalle: '' });
    };

    const confirmReject = async () => {
      if (!rejectForm) return;
      if (!rejectForm.motivo) { alert('Selecciona el motivo'); return; }
      setRejectSaving(true);
      try {
        const res = await fetch('/api/revenue/mark-rejected', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteId: rejectForm.quoteId,
            motivo: rejectForm.motivo,
            detalle: rejectForm.detalle || '',
            from: 'admin',
          }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data?.error || 'Error al marcar como rechazada'); setRejectSaving(false); return; }
        const d = await fetch('/api/revenue/quotes').then(r => r.json());
        setQuotes(Array.isArray(d) ? d : []);
        setRejectForm(null);
      } finally {
        setRejectSaving(false);
      }
    };

    const confirmAccept = async () => {
      if (!acceptForm) return;
      const nombre = String(acceptForm.nombre || '').trim();
      if (!nombre) { alert('Ingresa el nombre con el que se firmará'); return; }
      setAcceptSaving(true);
      try {
        const res = await fetch('/api/revenue/mark-accepted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId: acceptForm.quoteId, aceptado_por: nombre, method: acceptForm.method, nota_interna: acceptForm.nota }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data?.error || 'Error al aceptar la cotización'); setAcceptSaving(false); return; }
        const d = await fetch('/api/revenue/quotes').then(r => r.json());
        setQuotes(Array.isArray(d) ? d : []);
        setAcceptForm(null);
      } finally {
        setAcceptSaving(false);
      }
    };

    const duplicateQuote = async (q: any) => {
      const copy = { ...q, id: undefined, numero: undefined, estado: 'draft', created_at: undefined };
      setSaving(true);
      await fetch('/api/revenue/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copy) });
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
      setSaving(false);
    };

    // ─── Filter, search, sort, paginate ───
    const estadoLabels: Record<string, string> = { draft: 'Borrador', sent: 'Enviada', accepted: 'Aceptada', paid: 'Pagada', expired: 'Vencida', rejected: 'Rechazada' };
    const estadoColors: Record<string, { bg: string; fg: string; dot: string }> = {
      draft:    { bg: '#f5f5f5', fg: '#666',    dot: '#999' },
      sent:     { bg: '#fff3e0', fg: '#b35500', dot: '#e65100' },
      accepted: { bg: '#e8f5e9', fg: '#1b5e20', dot: '#2e7d32' },
      paid:     { bg: '#e3f2fd', fg: '#0d47a1', dot: '#1565c0' },
      expired:  { bg: '#fce4ec', fg: '#880e4f', dot: '#c62828' },
      rejected: { bg: '#ffebee', fg: '#b71c1c', dot: '#e53935' },
    };

    // Saved views (HubSpot-style presets)
    const savedViews = [
      { id: 'all', label: 'Todas' },
      { id: 'active', label: 'Activas' },              // draft + sent
      { id: 'closing', label: 'En cierre' },           // accepted sin pagar
      { id: 'paid', label: 'Pagadas' },
      { id: 'expiring', label: 'Por vencer' },         // sent con ≤ 5 días
      { id: 'stale', label: 'Sin actividad' },         // sent > 7 días sin vistas
      { id: 'hot', label: 'Más vistas' },              // views ≥ 5
      { id: 'rejected', label: 'Rechazadas' },         // estado=rejected
    ];

    const now = Date.now();
    const daysSince = (iso: string | null | undefined) => {
      if (!iso) return Infinity;
      const t = new Date(iso).getTime();
      if (isNaN(t)) return Infinity;
      return (now - t) / 86400000;
    };
    const daysUntil = (iso: string | null | undefined) => {
      if (!iso) return Infinity;
      const t = new Date(iso).getTime();
      if (isNaN(t)) return Infinity;
      return (t - now) / 86400000;
    };

    const matchesView = (q: any, view: string, viewsCount: number) => {
      if (view === 'all') return true;
      if (view === 'active') return q.estado === 'draft' || q.estado === 'sent';
      if (view === 'closing') return q.estado === 'accepted';
      if (view === 'paid') return q.estado === 'paid';
      if (view === 'expiring') return q.estado === 'sent' && daysUntil(q.vigencia) >= 0 && daysUntil(q.vigencia) <= 5;
      if (view === 'stale') return q.estado === 'sent' && daysSince(q.created_at) > 7 && viewsCount === 0;
      if (view === 'hot') return viewsCount >= 5;
      if (view === 'rejected') return q.estado === 'rejected';
      return true;
    };

    const matchesAdvFilter = (q: any, f: { field: string; op: string; value: any }) => {
      const val = q[f.field];
      if (f.field === 'total') {
        const n = Number(q.total || 0);
        const v = Number(f.value);
        if (f.op === 'gt') return n > v;
        if (f.op === 'lt') return n < v;
        if (f.op === 'eq') return n === v;
      }
      if (f.field === 'created_at' || f.field === 'vigencia') {
        const d = daysSince(val);
        const v = Number(f.value);
        if (f.op === 'within') return d <= v;
        if (f.op === 'older') return d > v;
      }
      if (f.field === 'estado') {
        const list = Array.isArray(f.value) ? f.value : [f.value];
        return list.includes(q.estado);
      }
      return true;
    };

    const filtered = quotes
      .map((q: any) => ({ q, views: parseMeta(q.notas).meta.views || 0 }))
      .filter(({ q, views }) => {
        if (!matchesView(q, qView, views)) return false;
        if (qFilter !== 'all' && q.estado !== qFilter) return false;
        for (const f of qFilters) { if (!matchesAdvFilter(q, f)) return false; }
        if (!qSearch) return true;
        const s = qSearch.toLowerCase();
        return (q.numero || '').toLowerCase().includes(s) ||
          (q.empresa || '').toLowerCase().includes(s) ||
          (q.contacto || '').toLowerCase().includes(s) ||
          (q.email || '').toLowerCase().includes(s) ||
          (q.whatsapp || '').toLowerCase().includes(s) ||
          String(q.total || '').includes(s);
      })
      .sort((a, b) => {
        const dir = qSort.asc ? 1 : -1;
        if (qSort.col === 'total') return ((a.q.total || 0) - (b.q.total || 0)) * dir;
        if (qSort.col === 'views') return (a.views - b.views) * dir;
        const va = a.q[qSort.col] || '';
        const vb = b.q[qSort.col] || '';
        return va < vb ? -dir : va > vb ? dir : 0;
      });

    const filteredQuotes = filtered.map(x => x.q);
    const filteredViewsMap = new Map(filtered.map(x => [x.q.id, x.views]));

    const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / PER_PAGE));
    const safePage = Math.min(qPage, totalPages - 1);
    const paginated = filteredQuotes.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

    // Count by estado + view
    const counts: Record<string, number> = { all: quotes.length };
    quotes.forEach((q: any) => { counts[q.estado] = (counts[q.estado] || 0) + 1; });
    const viewCounts: Record<string, number> = {};
    savedViews.forEach(v => {
      viewCounts[v.id] = quotes.filter((q: any) => matchesView(q, v.id, parseMeta(q.notas).meta.views || 0)).length;
    });

    // KPI stats
    const totalPending = quotes.filter((q: any) => q.estado === 'sent' || q.estado === 'accepted').reduce((s: number, q: any) => s + (q.total || 0), 0);
    const totalPaidThisMonth = quotes.filter((q: any) => {
      if (q.estado !== 'paid') return false;
      const d = new Date(q.updated_at || q.created_at);
      const nd = new Date();
      return d.getMonth() === nd.getMonth() && d.getFullYear() === nd.getFullYear();
    }).reduce((s: number, q: any) => s + (q.total || 0), 0);
    const activeCount = quotes.filter((q: any) => q.estado === 'sent' || q.estado === 'draft').length;
    const avgTicket = quotes.length ? Math.round(quotes.reduce((s: number, q: any) => s + (q.total || 0), 0) / quotes.length) : 0;
    const acceptedOrPaidCount = quotes.filter((q: any) => q.estado === 'accepted' || q.estado === 'paid').length;
    const sentOrBetter = quotes.filter((q: any) => ['sent', 'accepted', 'paid', 'expired'].includes(q.estado)).length;
    const conversionRate = sentOrBetter > 0 ? Math.round((acceptedOrPaidCount / sentOrBetter) * 100) : 0;

    // Persist preferences
    useEffect(() => { try { localStorage.setItem('sacs_q_view', qView); } catch {} }, [qView]);
    useEffect(() => { try { localStorage.setItem('sacs_q_pagesize', String(qPageSize)); } catch {} }, [qPageSize]);
    useEffect(() => { try { localStorage.setItem('sacs_q_density', qDensity); } catch {} }, [qDensity]);
    useEffect(() => { try { localStorage.setItem('sacs_q_cols', JSON.stringify(Array.from(qVisibleCols))); } catch {} }, [qVisibleCols]);

    // Bulk helpers
    const toggleSelect = (id: string) => {
      const next = new Set(qSelected);
      if (next.has(id)) next.delete(id); else next.add(id);
      setQSelected(next);
    };
    const toggleSelectAll = () => {
      const visible = paginated.map((q: any) => q.id);
      const allSelected = visible.every(id => qSelected.has(id));
      const next = new Set(qSelected);
      if (allSelected) visible.forEach(id => next.delete(id));
      else visible.forEach(id => next.add(id));
      setQSelected(next);
    };
    const clearSelection = () => setQSelected(new Set());

    const bulkMarkPaid = async () => {
      if (qSelected.size === 0) return;
      if (!confirm(`¿Marcar ${qSelected.size} cotización(es) como pagada(s)?`)) return;
      setSaving(true);
      for (const id of Array.from(qSelected)) {
        await fetch('/api/revenue/mark-paid', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId: id }),
        }).catch(() => {});
      }
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
      clearSelection();
      setSaving(false);
    };

    const exportCsv = () => {
      const rows = [['#', 'Fecha', 'Empresa', 'Contacto', 'Email', 'WhatsApp', 'Total', 'Moneda', 'Estado', 'Vigencia', 'Vistas']];
      filteredQuotes.forEach((q: any) => {
        const views = filteredViewsMap.get(q.id) || 0;
        rows.push([
          q.numero || '',
          (q.created_at || '').slice(0, 10),
          q.empresa || '',
          q.contacto || '',
          q.email || '',
          q.whatsapp || '',
          String(q.total || 0),
          q.moneda || 'MXN',
          estadoLabels[q.estado] || q.estado || '',
          q.vigencia || '',
          String(views),
        ]);
      });
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cotizaciones-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    };

    const refreshQuotes = async () => {
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
    };

    const allColumns = [
      { id: 'numero', label: '#' },
      { id: 'created_at', label: 'Fecha' },
      { id: 'empresa', label: 'Empresa' },
      { id: 'total', label: 'Total' },
      { id: 'vigencia', label: 'Vigencia' },
      { id: 'estado', label: 'Estado' },
      { id: 'views', label: 'Vistas' },
      { id: 'actions', label: 'Acciones' },
    ];

    const rowPad = qDensity === 'compact' ? '6px 12px' : '12px 14px';

    const SortHeader = ({ col, label }: { col: string; label: string }) => (
      <th style={{ ...S.th, cursor: 'pointer', userSelect: 'none' as const, whiteSpace: 'nowrap' as const, position: 'sticky' as const, top: 0, background: '#fafafa', zIndex: 2 }} onClick={() => setQSort({ col, asc: qSort.col === col ? !qSort.asc : col === 'total' || col === 'views' ? false : true })}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          <span style={{ color: qSort.col === col ? '#1a1a1a' : '#ddd', fontSize: '0.75rem' }}>{qSort.col === col ? (qSort.asc ? '↑' : '↓') : '⇅'}</span>
        </span>
      </th>
    );

    const removeFilter = (idx: number) => setQFilters(qFilters.filter((_, i) => i !== idx));
    const addFilter = (f: { field: string; op: string; value: any }) => { setQFilters([...qFilters, f]); setQShowFilterPopover(false); setQPage(0); };
    const allSelected = paginated.length > 0 && paginated.every((q: any) => qSelected.has(q.id));
    const someSelected = paginated.some((q: any) => qSelected.has(q.id));

    return (
      <div>
        {/* ─── Top header: title + actions ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.01em' }}>Cotizaciones</h2>
            <div style={{ fontSize: '0.8125rem', color: '#888', marginTop: 2 }}>{quotes.length} totales · {filteredQuotes.length} en vista</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={refreshQuotes} title="Actualizar" style={{ ...S.btn, background: '#fff', color: '#666', border: '1px solid #e0e0e0', padding: '8px 12px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
            <button onClick={exportCsv} style={{ ...S.btn, background: '#fff', color: '#666', border: '1px solid #e0e0e0', padding: '8px 14px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar
            </button>
            <button onClick={() => { setTranscript(''); setAnalysisResult(null); setShowTranscriptModal(true); }} style={{ ...S.btn, background: '#f5f5f5', color: '#555', padding: '8px 14px' }}>Transcripción</button>
            <button onClick={() => { setQf({ empresa: '', contacto: '', email: '', whatsapp: '', items: [], iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern', condiciones: 'Precios en MXN. Migracion incluida. Soporte 24/7. Sin contratos.' }); setShowDrawer(true); }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', padding: '8px 18px' }}>+ Nueva cotización</button>
          </div>
        </div>

        {/* ─── KPI stats row ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', padding: '14px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pendiente de pago</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1a1a1a', marginTop: 4 }}>{fmt(totalPending)}</div>
            <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: 2 }}>{counts.sent || 0} enviadas · {counts.accepted || 0} aceptadas</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', padding: '14px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pagado este mes</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#2e7d32', marginTop: 4 }}>{fmt(totalPaidThisMonth)}</div>
            <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: 2 }}>{counts.paid || 0} pagadas totales</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', padding: '14px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Cotizaciones activas</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1a1a1a', marginTop: 4 }}>{activeCount}</div>
            <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: 2 }}>Draft + enviadas</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', padding: '14px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ticket promedio</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1a1a1a', marginTop: 4 }}>{fmt(avgTicket)}</div>
            <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: 2 }}>Todas las cotizaciones</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e5e5', padding: '14px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tasa de conversión</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: conversionRate >= 40 ? '#2e7d32' : '#1a1a1a', marginTop: 4 }}>{conversionRate}%</div>
            <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: 2 }}>Aceptadas / Enviadas</div>
          </div>
        </div>

        {/* ─── Saved views tabs ─── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid #e5e5e5', marginBottom: 12, overflowX: 'auto' as const }}>
          {savedViews.map(v => {
            const active = qView === v.id;
            return (
              <button key={v.id} onClick={() => { setQView(v.id); setQPage(0); clearSelection(); }} style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: active ? '2px solid #1a1a1a' : '2px solid transparent',
                color: active ? '#1a1a1a' : '#666',
                fontWeight: active ? 700 : 500,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap' as const,
                marginBottom: -1,
              }}>
                {v.label}
                <span style={{ marginLeft: 6, fontSize: '0.6875rem', color: active ? '#1a1a1a' : '#aaa', fontWeight: 500 }}>{viewCounts[v.id] || 0}</span>
              </button>
            );
          })}
        </div>

        {/* ─── Search + filter + column tools ─── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const, alignItems: 'center', position: 'relative' as const }}>
          <div style={{ position: 'relative' as const, flex: '1 1 280px', maxWidth: 440 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" style={{ position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={qSearch} onChange={e => { setQSearch(e.target.value); setQPage(0); }} placeholder="Buscar por empresa, contacto, email, WhatsApp, folio o monto..." style={{ ...S.input, paddingLeft: 36, height: 36, fontSize: '0.8125rem' }} />
            {qSearch && (
              <button onClick={() => { setQSearch(''); setQPage(0); }} style={{ position: 'absolute' as const, right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem', padding: 4 }}>✕</button>
            )}
          </div>

          {/* Advanced filter button */}
          <div style={{ position: 'relative' as const }}>
            <button onClick={() => setQShowFilterPopover(!qShowFilterPopover)} style={{ ...S.btnSmall, padding: '0 14px', height: 36, display: 'inline-flex', alignItems: 'center', gap: 6, background: qFilters.length > 0 ? '#e8f0fe' : '#fff', color: qFilters.length > 0 ? '#1a56db' : '#555', borderColor: qFilters.length > 0 ? '#93c5fd' : '#e0e0e0' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Filtros {qFilters.length > 0 && <span style={{ background: '#1a56db', color: '#fff', fontSize: '0.625rem', borderRadius: 10, padding: '1px 6px' }}>{qFilters.length}</span>}
            </button>
            {qShowFilterPopover && (
              <div style={{ position: 'absolute' as const, top: 42, left: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 16, minWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100 }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Agregar filtro</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={() => addFilter({ field: 'total', op: 'gt', value: 10000 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Total &gt; $10,000</button>
                  <button onClick={() => addFilter({ field: 'total', op: 'lt', value: 10000 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Total &lt; $10,000</button>
                  <button onClick={() => addFilter({ field: 'created_at', op: 'within', value: 7 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Creada en últimos 7 días</button>
                  <button onClick={() => addFilter({ field: 'created_at', op: 'within', value: 30 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Creada en últimos 30 días</button>
                  <button onClick={() => addFilter({ field: 'created_at', op: 'older', value: 30 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Creada hace más de 30 días</button>
                  <button onClick={() => addFilter({ field: 'estado', op: 'in', value: ['sent', 'accepted'] })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Enviadas + Aceptadas</button>
                </div>
                <button onClick={() => setQShowFilterPopover(false)} style={{ ...S.btnSmall, width: '100%', marginTop: 10, background: '#f5f5f5' }}>Cerrar</button>
              </div>
            )}
          </div>

          {/* Estado quick chips */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['draft', 'sent', 'accepted', 'paid', 'expired', 'rejected'].map(st => {
              const active = qFilter === st;
              const ec = estadoColors[st];
              const count = counts[st] || 0;
              if (count === 0) return null;
              return (
                <button key={st} onClick={() => { setQFilter(active ? 'all' : st); setQPage(0); }} style={{
                  padding: '0 12px', height: 36, borderRadius: 6,
                  border: active ? `1.5px solid ${ec.dot}` : '1px solid #e0e0e0',
                  background: active ? ec.bg : '#fff',
                  color: active ? ec.fg : '#666',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: ec.dot }}></span>
                  {estadoLabels[st]} <span style={{ fontSize: '0.6875rem', opacity: 0.7, fontWeight: 500 }}>{count}</span>
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1 }}></div>

          {/* Density + columns */}
          <button onClick={() => setQDensity(qDensity === 'compact' ? 'comfortable' : 'compact')} title={`Densidad: ${qDensity}`} style={{ ...S.btnSmall, padding: '0 10px', height: 36, background: '#fff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div style={{ position: 'relative' as const }}>
            <button onClick={() => setQShowColsMenu(!qShowColsMenu)} title="Columnas" style={{ ...S.btnSmall, padding: '0 14px', height: 36, background: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
              Columnas
            </button>
            {qShowColsMenu && (
              <div style={{ position: 'absolute' as const, top: 42, right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 12, minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100 }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Mostrar columnas</div>
                {allColumns.map(c => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: '0.8125rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={qVisibleCols.has(c.id)} onChange={() => {
                      const next = new Set(qVisibleCols);
                      if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                      setQVisibleCols(next);
                    }} />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Active filters chip bar ─── */}
        {qFilters.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: '0.6875rem', color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filtros:</span>
            {qFilters.map((f, i) => {
              let label = '';
              if (f.field === 'total') label = `Total ${f.op === 'gt' ? '>' : f.op === 'lt' ? '<' : '='} ${fmt(f.value)}`;
              else if (f.field === 'created_at') label = `Creada ${f.op === 'within' ? 'en últimos' : 'hace más de'} ${f.value}d`;
              else if (f.field === 'estado') label = `Estado: ${(Array.isArray(f.value) ? f.value : [f.value]).map((s: string) => estadoLabels[s] || s).join(', ')}`;
              return (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#e8f0fe', color: '#1a56db', fontSize: '0.75rem', fontWeight: 600, borderRadius: 14 }}>
                  {label}
                  <button onClick={() => removeFilter(i)} style={{ background: 'none', border: 'none', color: '#1a56db', cursor: 'pointer', padding: 0, fontSize: '0.875rem', lineHeight: 1 }}>✕</button>
                </span>
              );
            })}
            <button onClick={() => { setQFilters([]); setQPage(0); }} style={{ background: 'none', border: 'none', color: '#999', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Limpiar todo</button>
          </div>
        )}

        {/* ─── Bulk selection bar (appears when 1+ selected) ─── */}
        {qSelected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#1a1a1a', color: '#fff', borderRadius: 8, marginBottom: 12 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{qSelected.size} cotización(es) seleccionada(s)</span>
            <div style={{ flex: 1 }}></div>
            <button onClick={bulkMarkPaid} style={{ ...S.btnSmall, background: '#e8f5e9', color: '#2e7d32', borderColor: 'transparent' }}>Marcar como pagadas</button>
            <button onClick={exportCsv} style={{ ...S.btnSmall, background: '#fff', color: '#1a1a1a', borderColor: 'transparent' }}>Exportar selección</button>
            <button onClick={clearSelection} style={{ ...S.btnSmall, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>Deseleccionar</button>
          </div>
        )}

        {/* ─── Table ─── */}
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' as const }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: 36, padding: '8px 0 8px 16px', position: 'sticky' as const, top: 0, background: '#fafafa', zIndex: 2 }}>
                    <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }} onChange={toggleSelectAll} />
                  </th>
                  {qVisibleCols.has('numero') && <SortHeader col="numero" label="#" />}
                  {qVisibleCols.has('created_at') && <SortHeader col="created_at" label="Fecha" />}
                  {qVisibleCols.has('empresa') && <SortHeader col="empresa" label="Empresa" />}
                  {qVisibleCols.has('total') && <SortHeader col="total" label="Total" />}
                  {qVisibleCols.has('vigencia') && <SortHeader col="vigencia" label="Vigencia" />}
                  {qVisibleCols.has('estado') && <SortHeader col="estado" label="Estado" />}
                  {qVisibleCols.has('views') && <SortHeader col="views" label="Vistas" />}
                  {qVisibleCols.has('actions') && <th style={{ ...S.th, position: 'sticky' as const, top: 0, background: '#fafafa', zIndex: 2, textAlign: 'right' as const }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr><td colSpan={Array.from(qVisibleCols).length + 1} style={{ ...S.td, textAlign: 'center' as const, color: '#aaa', padding: 48 }}>
                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>∅</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#666' }}>Sin resultados</div>
                    <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: 4 }}>Prueba limpiar los filtros o ajustar la búsqueda.</div>
                  </td></tr>
                )}
                {paginated.map((q: any) => {
                  const views = filteredViewsMap.get(q.id) || 0;
                  const ec = estadoColors[q.estado] || estadoColors.draft;
                  const isSel = qSelected.has(q.id);
                  const days = q.vigencia ? Math.ceil(daysUntil(q.vigencia)) : null;
                  return (
                    <tr key={q.id} style={{ background: isSel ? '#f0f7ff' : 'transparent', transition: 'background 0.12s' }} onMouseEnter={e => { if (!isSel) (e.currentTarget.style.background = '#f8f9fb'); }} onMouseLeave={e => { if (!isSel) (e.currentTarget.style.background = 'transparent'); }}>
                      <td style={{ padding: `${rowPad.split(' ')[0]} 0 ${rowPad.split(' ')[0]} 16px`, borderBottom: '1px solid #f0f0f0' }}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleSelect(q.id)} />
                      </td>
                      {qVisibleCols.has('numero') && <td style={{ ...S.td, padding: rowPad, fontWeight: 700, color: '#1a1a1a' }}>{q.numero || '-'}</td>}
                      {qVisibleCols.has('created_at') && <td style={{ ...S.td, padding: rowPad, color: '#666', whiteSpace: 'nowrap' as const }}>{fmtDate(q.created_at)}</td>}
                      {qVisibleCols.has('empresa') && <td style={{ ...S.td, padding: rowPad }}>
                        <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{q.empresa || '—'}</div>
                        {(q.contacto || q.email) && <div style={{ fontSize: '0.6875rem', color: '#999', marginTop: 1 }}>{q.contacto}{q.contacto && q.email ? ' · ' : ''}{q.email}</div>}
                      </td>}
                      {qVisibleCols.has('total') && <td style={{ ...S.td, padding: rowPad, fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap' as const }}>{fmt(q.total || 0)} <span style={{ fontSize: '0.625rem', color: '#aaa', fontWeight: 500 }}>{q.moneda || 'MXN'}</span></td>}
                      {qVisibleCols.has('vigencia') && <td style={{ ...S.td, padding: rowPad, whiteSpace: 'nowrap' as const, color: days !== null && days < 0 ? '#c62828' : days !== null && days <= 5 ? '#e65100' : '#666' }}>
                        {q.vigencia ? (days !== null && days < 0 ? `Vencida hace ${-days}d` : days === 0 ? 'Vence hoy' : `${days}d`) : '—'}
                      </td>}
                      {qVisibleCols.has('estado') && <td style={{ ...S.td, padding: rowPad }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: ec.bg, color: ec.fg }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: ec.dot }}></span>
                          {estadoLabels[q.estado] || q.estado}
                        </span>
                      </td>}
                      {qVisibleCols.has('views') && <td style={{ ...S.td, padding: rowPad }}>
                        {views > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 700, color: views >= 5 ? '#6C5CE7' : '#666' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                            {views}
                          </span>
                        ) : <span style={{ color: '#ddd', fontSize: '0.75rem' }}>—</span>}
                      </td>}
                      {qVisibleCols.has('actions') && <td style={{ ...S.td, padding: rowPad, textAlign: 'right' as const, whiteSpace: 'nowrap' as const, position: 'relative' as const }}>
                        <a href={`/cotizacion/${q.id}?admin=1`} target="_blank" rel="noopener" style={{ ...S.btnSmall, textDecoration: 'none', display: 'inline-flex', marginRight: 4 }}>Ver</a>
                        <button onClick={() => { const { meta: m } = parseMeta(q.notas); setQf({ ...q, items: Array.isArray(q.items) ? q.items : [], logo_url: m.logo_url || '', iva_mode: m.iva_mode || (q.iva_incluido ? 'suma' : 'sin'), mostrar_timer: m.mostrar_timer !== undefined ? m.mostrar_timer : true, mostrar_features: m.mostrar_features !== undefined ? m.mostrar_features : true, mostrar_desglose: m.mostrar_desglose !== undefined ? m.mostrar_desglose : true, mostrar_condiciones: m.mostrar_condiciones !== undefined ? m.mostrar_condiciones : true, mostrar_key_points: m.mostrar_key_points !== undefined ? m.mostrar_key_points : true, key_points: m.key_points || [], roi: m.roi || null, antes_despues: m.antes_despues || [], mostrar_roi: m.mostrar_roi || false, mostrar_antes_despues: m.mostrar_antes_despues || false, mostrar_firma: m.mostrar_firma !== undefined ? m.mostrar_firma : true, mostrar_qr: m.mostrar_qr !== undefined ? m.mostrar_qr : true, mostrar_animaciones: m.mostrar_animaciones !== undefined ? m.mostrar_animaciones : true, mostrar_timeline: m.mostrar_timeline !== undefined ? m.mostrar_timeline : true, timeline_tipo: m.timeline_tipo || '1suc', mostrar_implementacion: m.mostrar_implementacion !== undefined ? m.mostrar_implementacion : true, implementacion_nota: m.implementacion_nota || '', mostrar_porque_sacs: m.mostrar_porque_sacs !== undefined ? m.mostrar_porque_sacs : true }); setShowDrawer(true); }} style={S.btnSmall}>Editar</button>
                        <button onClick={(e) => { e.stopPropagation(); setQMenuRow(qMenuRow === q.id ? null : q.id); }} style={{ ...S.btnSmall, background: '#fff', padding: '4px 8px', marginRight: 0 }} title="Más acciones">⋮</button>
                        {qMenuRow === q.id && (
                          <div data-q-menu style={{ position: 'absolute' as const, right: 0, top: 34, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 6, minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50, textAlign: 'left' as const }}>
                            <button onClick={() => { duplicateQuote(q); setQMenuRow(null); }} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 2, justifyContent: 'flex-start' as const, border: 'none', background: 'transparent', padding: '8px 10px', display: 'flex' }}>📋 Duplicar</button>
                            {(q.estado === 'sent' || q.estado === 'draft' || q.estado === 'expired') && <button onClick={() => { openAcceptModal(q); setQMenuRow(null); }} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 2, justifyContent: 'flex-start' as const, border: 'none', background: 'transparent', padding: '8px 10px', display: 'flex', color: '#00695c' }}>✓ Aceptar manualmente</button>}
                            {q.estado !== 'paid' && <button onClick={() => { markQuotePaid(q); setQMenuRow(null); }} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 2, justifyContent: 'flex-start' as const, border: 'none', background: 'transparent', padding: '8px 10px', display: 'flex', color: '#2e7d32' }}>💵 Marcar pagada</button>}
                            {(q.estado === 'sent' || q.estado === 'draft' || q.estado === 'expired') && <button onClick={() => { openRejectModal(q); setQMenuRow(null); }} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 2, justifyContent: 'flex-start' as const, border: 'none', background: 'transparent', padding: '8px 10px', display: 'flex', color: '#c62828' }}>✕ Marcar rechazada</button>}
                            <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0' }}></div>
                            <button onClick={() => { navigator.clipboard.writeText(`https://www.sacscloud.com/cotizacion/${q.id}`); setQMenuRow(null); }} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 2, justifyContent: 'flex-start' as const, border: 'none', background: 'transparent', padding: '8px 10px', display: 'flex' }}>🔗 Copiar link</button>
                            <button onClick={() => { navigator.clipboard.writeText(`https://www.sacscloud.com/cotizacion/${q.id}/implementacion`); setQMenuRow(null); }} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 2, justifyContent: 'flex-start' as const, border: 'none', background: 'transparent', padding: '8px 10px', display: 'flex' }}>⚡ Copiar link proceso</button>
                            <a href={`https://wa.me/?text=${encodeURIComponent(`Cotización ${q.numero}: https://www.sacscloud.com/cotizacion/${q.id}`)}`} target="_blank" rel="noopener" onClick={() => setQMenuRow(null)} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 2, justifyContent: 'flex-start' as const, border: 'none', background: 'transparent', padding: '8px 10px', display: 'flex', textDecoration: 'none' }}>💬 Enviar WhatsApp</a>
                            <a href={`mailto:${q.email || ''}?subject=${encodeURIComponent(`Cotización ${q.numero} - Sacs`)}&body=${encodeURIComponent(`Hola ${q.contacto || ''},\n\nTe comparto tu cotización:\nhttps://www.sacscloud.com/cotizacion/${q.id}\n\nQuedo al pendiente.\nSaludos`)}`} onClick={() => setQMenuRow(null)} style={{ ...S.btnSmall, width: '100%', marginRight: 0, justifyContent: 'flex-start' as const, border: 'none', background: 'transparent', padding: '8px 10px', display: 'flex', textDecoration: 'none' }}>✉️ Enviar por email</a>
                          </div>
                        )}
                      </td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.75rem', color: '#666' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Por página:
                <select value={qPageSize} onChange={e => { setQPageSize(parseInt(e.target.value)); setQPage(0); }} style={{ padding: '4px 8px', fontSize: '0.75rem', border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
              <span>
                {filteredQuotes.length === 0 ? '0' : `${safePage * PER_PAGE + 1}–${Math.min((safePage + 1) * PER_PAGE, filteredQuotes.length)}`} de <strong>{filteredQuotes.length}</strong>
              </span>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button disabled={safePage === 0} onClick={() => setQPage(0)} style={{ ...S.btnSmall, opacity: safePage === 0 ? 0.3 : 1, marginRight: 0 }}>«</button>
                <button disabled={safePage === 0} onClick={() => setQPage(safePage - 1)} style={{ ...S.btnSmall, opacity: safePage === 0 ? 0.3 : 1, marginRight: 0 }}>‹ Anterior</button>
                <span style={{ fontSize: '0.75rem', color: '#666', padding: '0 10px' }}>Página <strong>{safePage + 1}</strong> de {totalPages}</span>
                <button disabled={safePage >= totalPages - 1} onClick={() => setQPage(safePage + 1)} style={{ ...S.btnSmall, opacity: safePage >= totalPages - 1 ? 0.3 : 1, marginRight: 0 }}>Siguiente ›</button>
                <button disabled={safePage >= totalPages - 1} onClick={() => setQPage(totalPages - 1)} style={{ ...S.btnSmall, opacity: safePage >= totalPages - 1 ? 0.3 : 1, marginRight: 0 }}>»</button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Accept Quote Modal (admin manual acceptance) ─── */}
        {acceptForm && (
          <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget && !acceptSaving) setAcceptForm(null); }}>
            <div style={{ ...S.modal, maxWidth: 480 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Aceptar cotización {acceptForm.numero}</h3>
                <button onClick={() => !acceptSaving && setAcceptForm(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 16px', lineHeight: 1.5 }}>
                El cliente cerró pero no firmó en la página. Se marcará como aceptada y se generará la firma automáticamente con el nombre que ingreses.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Nombre que firma</label>
                <input
                  type="text"
                  value={acceptForm.nombre}
                  onChange={e => setAcceptForm({ ...acceptForm, nombre: e.target.value })}
                  placeholder="Ej. Mariana López"
                  style={S.input}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Método de aceptación</label>
                <select value={acceptForm.method} onChange={e => setAcceptForm({ ...acceptForm, method: e.target.value })} style={S.input}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="verbal">Verbal / Llamada</option>
                  <option value="email">Email</option>
                  <option value="reunion">Reunión presencial</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Nota interna (opcional)</label>
                <textarea
                  value={acceptForm.nota}
                  onChange={e => setAcceptForm({ ...acceptForm, nota: e.target.value })}
                  placeholder="Ej. Confirmó por WhatsApp el 15/abr a las 3pm"
                  style={{ ...S.input, height: 70, resize: 'vertical' as const, fontSize: '0.75rem' }}
                />
                <div style={{ fontSize: '0.625rem', color: '#bbb', marginTop: 4 }}>Solo tú la ves. No se muestra al cliente.</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Vista previa de firma</label>
                <div style={{ border: '1px dashed #e0e0e0', borderRadius: 8, padding: '12px 16px', background: '#fafafa', minHeight: 72, display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'Dancing Script','Brush Script MT','Lucida Handwriting','Segoe Script','Apple Chancery',cursive", fontSize: '2rem', fontStyle: 'italic', color: '#1a1a1a', transform: 'rotate(-3deg)', display: 'inline-block' }}>
                    {acceptForm.nombre || 'Firma del cliente'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setAcceptForm(null)} disabled={acceptSaving} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>Cancelar</button>
                <button onClick={confirmAccept} disabled={acceptSaving || !acceptForm.nombre} style={{ ...S.btn, background: acceptSaving || !acceptForm.nombre ? '#bbb' : '#00695c', color: '#fff', cursor: acceptSaving || !acceptForm.nombre ? 'not-allowed' : 'pointer' }}>
                  {acceptSaving ? 'Firmando…' : 'Confirmar aceptación'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Reject Quote Modal ─── */}
        {rejectForm && (
          <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget && !rejectSaving) setRejectForm(null); }}>
            <div style={{ ...S.modal, maxWidth: 480 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Marcar como rechazada — {rejectForm.numero}</h3>
                <button onClick={() => setRejectForm(null)} disabled={rejectSaving} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#666', margin: '0 0 16px', lineHeight: 1.55 }}>Registra el motivo del rechazo. El deal asociado se moverá a <strong>Cerrada perdida</strong> con este motivo.</p>

              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Motivo</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { v: 'precio', l: 'Precio fuera de presupuesto' },
                    { v: 'timing', l: 'No es el momento' },
                    { v: 'competidor', l: 'Competidor elegido' },
                    { v: 'no_fit', l: 'No es el producto que buscan' },
                    { v: 'otro', l: 'Otro motivo' },
                  ].map(opt => {
                    const sel = rejectForm.motivo === opt.v;
                    return (
                      <label key={opt.v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${sel ? '#c62828' : '#e0e0e0'}`, borderRadius: 6, cursor: 'pointer', background: sel ? '#fff5f5' : '#fff', fontSize: '0.8125rem' }}>
                        <input
                          type="radio"
                          name="admin-reject-motivo"
                          value={opt.v}
                          checked={sel}
                          onChange={() => setRejectForm({ ...rejectForm, motivo: opt.v })}
                        />
                        <span style={{ color: sel ? '#c62828' : '#555', fontWeight: sel ? 600 : 500 }}>{opt.l}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Detalle interno (opcional)</label>
                <textarea
                  value={rejectForm.detalle}
                  onChange={e => setRejectForm({ ...rejectForm, detalle: e.target.value })}
                  rows={3}
                  placeholder="Ej. comentario del cliente o análisis competitivo"
                  style={{ ...S.input, resize: 'vertical' as const, fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setRejectForm(null)} disabled={rejectSaving} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>Cancelar</button>
                <button onClick={confirmReject} disabled={rejectSaving || !rejectForm.motivo} style={{ ...S.btn, background: rejectSaving || !rejectForm.motivo ? '#bbb' : '#c62828', color: '#fff', cursor: rejectSaving || !rejectForm.motivo ? 'not-allowed' : 'pointer' }}>
                  {rejectSaving ? 'Guardando…' : 'Confirmar rechazo'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Transcript Modal ─── */}
        {showTranscriptModal && !showReview && (
          <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setShowTranscriptModal(false); }}>
            <div style={{ ...S.modal, maxWidth: 640 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Generar cotización desde transcripción</h3>
                <button onClick={() => setShowTranscriptModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#999', margin: '0 0 12px' }}>Pega la transcripción de tu llamada. La IA extraerá los datos del cliente, recomendará un plan y generará los puntos clave.</p>
              <textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Pega aquí la transcripción completa de la llamada..." style={{ ...S.input, height: 320, resize: 'vertical' as const, fontSize: '0.75rem', lineHeight: 1.6 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: '0.625rem', color: '#ccc' }}>{transcript.length.toLocaleString()} caracteres</span>
                <button onClick={async () => {
                  if (transcript.length < 100) { alert('La transcripción es muy corta. Mínimo 100 caracteres.'); return; }
                  setAnalyzing(true);
                  try {
                    const res = await fetch('/api/revenue/analyze-transcript', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript }) });
                    const data = await res.json();
                    if (data.error) { alert(data.error); setAnalyzing(false); return; }
                    setAnalysisResult(data);
                    setShowReview(true);
                  } catch { alert('Error de conexión. Intenta de nuevo.'); }
                  setAnalyzing(false);
                }} disabled={analyzing || transcript.length < 100} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', opacity: analyzing || transcript.length < 100 ? 0.5 : 1 }}>
                  {analyzing ? 'Analizando...' : 'Analizar con IA'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Analysis Review Screen ─── */}
        {showReview && analysisResult && (
          <div style={{ position: 'fixed' as const, inset: 0, zIndex: 200, background: '#f5f6f8', display: 'flex', flexDirection: 'column' as const }}>
            <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Resultado del análisis</h3>
                {analysisResult.confidence != null && (
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, color: analysisResult.confidence >= 0.7 ? '#2AB5A0' : '#E8A838', background: analysisResult.confidence >= 0.7 ? 'rgba(42,181,160,0.08)' : 'rgba(232,168,56,0.08)', padding: '2px 8px', borderRadius: 4 }}>
                    Confianza: {Math.round(analysisResult.confidence * 100)}%
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => {
                  const r = analysisResult;
                  const rec = r.recommendation || {};
                  const planPrice = PLAN_PRICES[rec.plan] || 900;
                  const discPct = parseFloat(rec.descuento_pct) || 0;
                  const suc = parseInt(rec.sucursales) || 1;
                  const isAnn = rec.periodo === 'anual';
                  const planSub = planPrice * suc * (isAnn ? 10 : 1);
                  const planDisc = planSub * (discPct / 100);
                  const planItems: any[] = [{
                    tipo: 'plan', nombre: rec.plan || 'controla',
                    sucursales: suc, precio_unitario: planPrice,
                    periodo: rec.periodo || 'mensual',
                    descuento_pct: discPct,
                    subtotal: planSub - planDisc,
                  }];
                  const extraItems = (rec.extras || []).map((e: any) => ({
                    tipo: 'extra', nombre: e.nombre, monto: e.monto || 0,
                    descripcion: e.descripcion || '', nota: e.nota || '',
                    periodo_extra: e.periodo_extra || 'unico',
                    recurrente: e.periodo_extra === 'mensual' || e.periodo_extra === 'anual',
                    subtotal: e.periodo_extra === 'anual' ? (e.monto || 0) * 10 : (e.monto || 0),
                  }));
                  // Promoción
                  const promo = rec.promocion;
                  if (promo?.aplicar) {
                    extraItems.push({
                      tipo: 'extra', nombre: promo.nombre || 'Implementación y configuración',
                      descripcion: promo.descripcion || 'Setup inicial, migración y capacitación. Aplica al contratar plan anual.',
                      monto: 0, precio_original: promo.precio_original || IMPL_PRICES[rec.plan] || 4000,
                      es_promocion: true, recurrente: false, subtotal: 0,
                    });
                  }
                  // IVA mode
                  const ivaMode = rec.iva_mode || 'sin';
                  // Notas extra → condiciones
                  const notasExtra = (r.notas_extra || []).filter(Boolean);
                  const condBase = 'Precios en MXN. Migracion incluida. Soporte 24/7. Sin contratos.';
                  const condiciones = notasExtra.length > 0 ? condBase + '\n\n' + notasExtra.join('\n') : condBase;
                  setQf({
                    empresa: r.client?.empresa || '', contacto: r.client?.contacto || '',
                    email: r.client?.email || '', whatsapp: r.client?.whatsapp || '',
                    items: [...planItems, ...extraItems],
                    iva_incluido: ivaMode !== 'sin', iva_mode: ivaMode,
                    descuento_global: 0, descuento_tipo: 'pct',
                    moneda: 'MXN', template: 'modern', condiciones,
                    key_points: r.key_points || [], mostrar_key_points: true,
                    roi: r.roi || null, mostrar_roi: !!(r.roi?.ahorro_mensual),
                    antes_despues: r.antes_despues || [], mostrar_antes_despues: (r.antes_despues || []).length > 0,
                    mostrar_firma: true, mostrar_qr: true, mostrar_animaciones: true,
                  });
                  setShowReview(false); setShowTranscriptModal(false); setShowDrawer(true);
                }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff' }}>Aplicar al formulario</button>
                <button onClick={() => { setShowReview(false); setShowTranscriptModal(false); }} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>Descartar</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gap: 16 }}>
                {/* Client info */}
                <div style={S.card}>
                  <h3 style={S.cardTitle}>Cliente detectado</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><label style={S.label}>Empresa</label><input value={analysisResult.client?.empresa || ''} onChange={e => setAnalysisResult({ ...analysisResult, client: { ...analysisResult.client, empresa: e.target.value } })} style={S.input} /></div>
                    <div><label style={S.label}>Contacto</label><input value={analysisResult.client?.contacto || ''} onChange={e => setAnalysisResult({ ...analysisResult, client: { ...analysisResult.client, contacto: e.target.value } })} style={S.input} /></div>
                    <div><label style={S.label}>Email</label><input value={analysisResult.client?.email || ''} onChange={e => setAnalysisResult({ ...analysisResult, client: { ...analysisResult.client, email: e.target.value } })} style={S.input} /></div>
                    <div><label style={S.label}>WhatsApp</label><input value={analysisResult.client?.whatsapp || ''} onChange={e => setAnalysisResult({ ...analysisResult, client: { ...analysisResult.client, whatsapp: e.target.value } })} style={S.input} /></div>
                  </div>
                </div>

                {/* Plan recommendation */}
                <div style={S.card}>
                  <h3 style={S.cardTitle}>Plan recomendado</h3>
                  <div style={{ background: '#f8f9fb', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic' as const }}>{analysisResult.recommendation?.reasoning}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div><label style={S.label}>Plan</label><select value={analysisResult.recommendation?.plan || 'controla'} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, plan: e.target.value } })} style={S.input}>{PLANS.map(p => <option key={p} value={p}>{p} (${PLAN_PRICES[p]}/mes)</option>)}</select></div>
                    <div><label style={S.label}>Sucursales</label><input type="number" value={analysisResult.recommendation?.sucursales || 1} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, sucursales: parseInt(e.target.value) || 1 } })} style={S.input} /></div>
                    <div><label style={S.label}>Periodo</label><select value={analysisResult.recommendation?.periodo || 'mensual'} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, periodo: e.target.value } })} style={S.input}><option value="mensual">Mensual</option><option value="anual">Anual</option></select></div>
                  </div>
                  {(analysisResult.recommendation?.extras || []).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={S.label}>Extras sugeridos</div>
                      {analysisResult.recommendation.extras.map((ex: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
                          <span style={{ flex: 1, fontSize: '0.8125rem' }}><strong>{ex.nombre}</strong> — {ex.descripcion} <span style={{ color: '#2AB5A0', fontWeight: 700 }}>{fmt(ex.monto || 0)}</span></span>
                          <button onClick={() => { const extras = [...analysisResult.recommendation.extras]; extras.splice(i, 1); setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, extras } }); }} style={{ ...S.btnSmall, color: '#E54B4B' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* IVA, Descuento, Promo */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    <div><label style={S.label}>IVA</label><select value={analysisResult.recommendation?.iva_mode || 'sin'} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, iva_mode: e.target.value } })} style={S.input}><option value="sin">Sin IVA</option><option value="suma">Sumar 16%</option><option value="incluido">Incluido en precios</option></select></div>
                    <div><label style={S.label}>Descuento plan (%)</label><input type="number" value={analysisResult.recommendation?.descuento_pct || 0} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, descuento_pct: parseFloat(e.target.value) || 0 } })} style={S.input} /></div>
                  </div>
                  {analysisResult.recommendation?.promocion?.aplicar && (
                    <div style={{ marginTop: 10, padding: 10, background: '#ecfdf5', borderRadius: 8, border: '1px solid #2AB5A0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#fff', background: '#2AB5A0', padding: '1px 6px', borderRadius: 3, marginRight: 6 }}>PROMO</span>
                        <strong style={{ fontSize: '0.8125rem' }}>{analysisResult.recommendation.promocion.nombre}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#999', marginLeft: 8 }}><s>{fmt(analysisResult.recommendation.promocion.precio_original || 0)}</s> → $0</span>
                      </div>
                      <button onClick={() => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, promocion: { ...analysisResult.recommendation.promocion, aplicar: false } } })} style={{ ...S.btnSmall, color: '#E54B4B' }}>✕</button>
                    </div>
                  )}
                </div>

                {/* Notas extra */}
                {(analysisResult.notas_extra || []).length > 0 && (
                  <div style={S.card}>
                    <h3 style={S.cardTitle}>Notas extra</h3>
                    <p style={{ fontSize: '0.6875rem', color: '#999', margin: '0 0 8px' }}>Observaciones adicionales que se agregan a las condiciones de la cotización</p>
                    {analysisResult.notas_extra.map((nota: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                        <input value={nota} onChange={e => { const n = [...analysisResult.notas_extra]; n[i] = e.target.value; setAnalysisResult({ ...analysisResult, notas_extra: n }); }} style={{ ...S.input, flex: 1, fontSize: '0.75rem' }} />
                        <button onClick={() => { const n = [...analysisResult.notas_extra]; n.splice(i, 1); setAnalysisResult({ ...analysisResult, notas_extra: n }); }} style={{ ...S.btnSmall, color: '#E54B4B' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Key points (Minuta) */}
                <div style={S.card}>
                  <h3 style={S.cardTitle}>Minuta de la reunión ({(analysisResult.key_points || []).length})</h3>
                  <p style={{ fontSize: '0.6875rem', color: '#999', margin: '0 0 12px' }}>Estos puntos aparecerán en la cotización como "Minuta de la reunión"</p>
                  {(analysisResult.key_points || []).map((kp: any, i: number) => (
                    <div key={i} style={{ background: '#f8f9fb', borderRadius: 8, padding: 12, marginBottom: 8, borderLeft: '3px solid #4B7BE5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <input value={kp.title} onChange={e => { const kps = [...analysisResult.key_points]; kps[i] = { ...kps[i], title: e.target.value }; setAnalysisResult({ ...analysisResult, key_points: kps }); }} style={{ ...S.input, fontWeight: 700, marginBottom: 4 }} />
                          <textarea value={kp.detail} onChange={e => { const kps = [...analysisResult.key_points]; kps[i] = { ...kps[i], detail: e.target.value }; setAnalysisResult({ ...analysisResult, key_points: kps }); }} rows={2} style={{ ...S.input, fontSize: '0.75rem' }} />
                        </div>
                        <button onClick={() => { const kps = [...analysisResult.key_points]; kps.splice(i, 1); setAnalysisResult({ ...analysisResult, key_points: kps }); }} style={{ ...S.btnSmall, color: '#E54B4B', flexShrink: 0 }}>✕</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setAnalysisResult({ ...analysisResult, key_points: [...(analysisResult.key_points || []), { title: '', detail: '' }] })} style={S.btnSmall}>+ Agregar punto</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Quote Drawer ─── */}
        {showDrawer && (
          <div style={{ position: 'fixed' as const, inset: 0, zIndex: 200, background: '#f5f6f8', display: 'flex', flexDirection: 'column' as const }}>
            {/* Top bar */}
            <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{qf.id ? `Editar ${qf.numero || 'cotización'}` : 'Nueva cotización'}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={createQuote} disabled={saving || !items.length || !qf.empresa} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', fontSize: '0.75rem', padding: '6px 16px' }}>{saving ? 'Guardando...' : qf.id ? 'Guardar cambios' : 'Crear y enviar'}</button>
                <button onClick={() => setShowDrawer(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>
            </div>
            {/* Split layout */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Left: Form */}
            <div style={{ width: 480, flexShrink: 0, background: '#fff', overflowY: 'auto' as const, padding: 24, borderRight: '1px solid #eee' }}>

              {/* Client */}
              <div style={S.label}>Cliente</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input value={qf.empresa || ''} onChange={e => setQf({ ...qf, empresa: e.target.value })} placeholder="Empresa *" required style={{ ...S.input, borderColor: !qf.empresa ? '#fca5a5' : undefined }} />
                <input value={qf.contacto || ''} onChange={e => setQf({ ...qf, contacto: e.target.value })} placeholder="Contacto" style={S.input} />
                <input value={qf.email || ''} onChange={e => setQf({ ...qf, email: e.target.value })} placeholder="Email *" required type="email" style={{ ...S.input, borderColor: !qf.email ? '#fca5a5' : undefined }} />
                <input value={qf.whatsapp || ''} onChange={e => setQf({ ...qf, whatsapp: e.target.value })} placeholder="WhatsApp *" required type="tel" style={{ ...S.input, borderColor: !qf.whatsapp ? '#fca5a5' : undefined }} />
              </div>

              {/* Client logo */}
              <div style={{ marginBottom: 16 }}>
                <div style={S.label}>Logo del cliente (opcional)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {qf.logo_url ? (
                    <div style={{ position: 'relative' as const, width: 48, height: 48, borderRadius: 8, border: '1px solid #e0e0e0', overflow: 'hidden', flexShrink: 0, background: '#fafafa' }}>
                      <img src={qf.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' as const }} />
                      <button onClick={() => setQf({ ...qf, logo_url: '' })} style={{ position: 'absolute' as const, top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#E54B4B', color: '#fff', border: 'none', fontSize: '0.625rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ) : null}
                  <label style={{ ...S.btnSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, flex: qf.logo_url ? undefined : 1, justifyContent: 'center' as const }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {qf.logo_url ? 'Cambiar' : 'Subir logo'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      const res = await fetch('/api/revenue/upload-logo', { method: 'POST', body: fd });
                      const data = await res.json();
                      if (data.url) setQf({ ...qf, logo_url: data.url });
                      else alert(data.error || 'Error al subir');
                      e.target.value = '';
                    }} />
                  </label>
                  {qf.logo_url && <input value={qf.logo_url} onChange={e => setQf({ ...qf, logo_url: e.target.value })} placeholder="URL del logo" style={{ ...S.input, flex: 1, fontSize: '0.6875rem' }} />}
                </div>
              </div>

              {/* Items */}
              <div style={S.label}>Conceptos</div>
              {items.map((item: any, idx: number) => (
                <div key={idx} style={{ background: item.es_promocion ? '#ecfdf5' : '#f8f9fb', borderRadius: 10, padding: 12, marginBottom: 8, position: 'relative' as const, border: item.es_promocion ? '1.5px solid #2AB5A0' : 'none' }}>
                  <button onClick={() => removeItem(idx)} style={{ position: 'absolute' as const, top: 8, right: 8, background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                  {item.tipo === 'plan' ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Plan</label><select value={item.nombre} onChange={e => updateItem(idx, 'nombre', e.target.value)} style={S.input}>{PLANS.map(p => <option key={p} value={p}>{p} (${PLAN_PRICES[p]})</option>)}</select></div>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Sucursales</label><input type="number" value={item.sucursales} onChange={e => updateItem(idx, 'sucursales', e.target.value)} style={S.input} /></div>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Período</label><select value={item.periodo} onChange={e => updateItem(idx, 'periodo', e.target.value)} style={S.input}><option value="mensual">Mensual</option><option value="anual">Anual (2 meses gratis)</option></select></div>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Desc. %</label><input type="number" value={item.descuento_pct || 0} onChange={e => updateItem(idx, 'descuento_pct', e.target.value)} style={S.input} /></div>
                      </div>
                      <div style={{ marginTop: 6 }}><input value={item.nota || ''} onChange={e => updateItem(idx, 'nota', e.target.value)} placeholder="Nota (opcional)" style={{ ...S.input, fontSize: '0.6875rem' }} /></div>
                    </div>
                  ) : item.es_promocion ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#fff', background: '#2AB5A0', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Promocion</span>
                        <span style={{ fontSize: '0.5625rem', color: '#999' }}>Al contratar plan anual</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6, marginBottom: 6 }}>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Concepto</label><input value={item.nombre || ''} onChange={e => updateItem(idx, 'nombre', e.target.value)} style={S.input} /></div>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Valor original</label><input type="number" value={item.precio_original || ''} onChange={e => updateItem(idx, 'precio_original', parseFloat(e.target.value) || 0)} style={S.input} /></div>
                        <div style={{ gridColumn: '1/-1' }}><label style={{ ...S.label, marginTop: 0 }}>Descripción</label><input value={item.descripcion || ''} onChange={e => updateItem(idx, 'descripcion', e.target.value)} style={S.input} /></div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ textDecoration: 'line-through', color: '#ccc', fontWeight: 600 }}>{fmt(item.precio_original || 0)}</span>
                        <span style={{ fontSize: '1.125rem', fontWeight: 800, color: '#2AB5A0' }}>$0</span>
                        <span style={{ fontSize: '0.625rem', color: '#999', marginLeft: 4 }}>Gratis al contratar plan anual</span>
                      </div>
                      <input value={item.nota || ''} onChange={e => updateItem(idx, 'nota', e.target.value)} placeholder="Nota (opcional)" style={{ ...S.input, fontSize: '0.6875rem' }} />
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Concepto</label><input value={item.nombre || ''} onChange={e => updateItem(idx, 'nombre', e.target.value)} placeholder="Ej. Implementación" style={S.input} /></div>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Monto</label><input type="number" value={item.monto || ''} onChange={e => updateItem(idx, 'monto', e.target.value)} style={S.input} /></div>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Descripción</label><input value={item.descripcion || ''} onChange={e => updateItem(idx, 'descripcion', e.target.value)} style={S.input} /></div>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Periodo</label><select value={item.periodo_extra || (item.recurrente ? 'mensual' : 'unico')} onChange={e => updateItem(idx, 'periodo_extra', e.target.value)} style={S.input}><option value="unico">Unico</option><option value="mensual">Mensual</option><option value="anual">Anual (×10 meses)</option></select></div>
                      </div>
                      <div style={{ marginTop: 6 }}><input value={item.nota || ''} onChange={e => updateItem(idx, 'nota', e.target.value)} placeholder="Nota (opcional)" style={{ ...S.input, fontSize: '0.6875rem' }} /></div>
                    </div>
                  )}
                  {!item.es_promocion && <div style={{ textAlign: 'right' as const, fontSize: '0.875rem', fontWeight: 700, color: '#2AB5A0', marginTop: 6 }}>{fmt(item.subtotal || item.monto || 0)}</div>}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                <button onClick={addPlanItem} style={{ ...S.btnSmall, flex: 1 }}>+ Plan Sacs</button>
                <button onClick={addExtraItem} style={{ ...S.btnSmall, flex: 1 }}>+ Extra</button>
                <button onClick={() => {
                  const mainPlan = items.find((i: any) => i.tipo === 'plan')?.nombre || 'controla';
                  const precio = IMPL_PRICES[mainPlan] || 4000;
                  setQf({ ...qf, items: [...items, { tipo: 'extra', nombre: 'Implementacion y configuracion', descripcion: 'Setup inicial, migracion de datos y capacitacion. Aplica al contratar plan anual.', monto: 0, precio_original: precio, es_promocion: true, recurrente: false, subtotal: 0 }] });
                }} style={{ ...S.btnSmall, flex: 1, background: '#f8f9fb', color: '#2AB5A0', borderColor: '#2AB5A0' }}>+ Promo impl.</button>
                <button onClick={() => {
                  setQf({ ...qf, items: [...items, { tipo: 'extra', nombre: '', descripcion: '', monto: 0, precio_original: 0, es_promocion: true, recurrente: false, subtotal: 0 }] });
                }} style={{ ...S.btnSmall, flex: 1, background: '#f8f9fb', color: '#2AB5A0', borderColor: '#2AB5A0' }}>+ Promo custom</button>
              </div>

              {/* Totals & Config */}
              <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 8 }}>
                  <span>Subtotal</span><span style={{ fontWeight: 700 }}>{fmt(itemsSubtotal)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <div><label style={{ ...S.label, marginTop: 0 }}>Desc. global</label><input type="number" value={qf.descuento_global || 0} onChange={e => setQf({ ...qf, descuento_global: e.target.value })} style={S.input} /></div>
                  <div><label style={{ ...S.label, marginTop: 0 }}>Tipo</label><select value={qf.descuento_tipo} onChange={e => setQf({ ...qf, descuento_tipo: e.target.value })} style={S.input}><option value="pct">Porcentaje %</option><option value="fijo">Monto fijo $</option></select></div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ ...S.label, marginTop: 0 }}>IVA</label>
                  <select value={ivaMode} onChange={e => setQf({ ...qf, iva_mode: e.target.value })} style={S.input}>
                    <option value="sin">Sin IVA</option>
                    <option value="suma">Sumar IVA 16% al total</option>
                    <option value="incluido">IVA incluido en precios</option>
                  </select>
                </div>
                {ivaMode !== 'sin' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 4 }}>
                    <span>{ivaMode === 'incluido' ? 'IVA incluido' : 'IVA (16%)'}</span>
                    <span>{fmt(ivaMonto)}</span>
                  </div>
                )}
                {ivaMode === 'incluido' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#999', marginBottom: 4 }}>
                    <span>Subtotal sin IVA</span>
                    <span>{fmt(afterDisc / 1.16)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem', fontWeight: 800, borderTop: '2px solid #1a1a1a', paddingTop: 8, marginTop: 4 }}>
                  <span>Total</span><span style={{ color: '#2AB5A0' }}>{fmt(grandTotal)} {qf.moneda}</span>
                </div>
              </div>

              {/* Config */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div><label style={S.label}>Moneda</label><select value={qf.moneda} onChange={e => setQf({ ...qf, moneda: e.target.value })} style={S.input}><option value="MXN">MXN</option><option value="USD">USD</option></select></div>
                <div><label style={S.label}>Template</label><select value={qf.template} onChange={e => setQf({ ...qf, template: e.target.value })} style={S.input}><option value="modern">Modern</option><option value="dark">Dark</option><option value="classic">Classic</option></select></div>
              </div>

              {/* Bank account */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={S.label}>Cuenta bancaria</label>
                  <select value={qf.bank_account_id || ''} onChange={e => setQf({ ...qf, bank_account_id: e.target.value || null, mostrar_banco: !!e.target.value })} style={S.input}>
                    <option value="">Sin cuenta bancaria</option>
                    {bankAccounts.map((ba: any) => <option key={ba.id} value={ba.id}>{ba.banco} - {ba.cuenta} {ba.es_default ? '(default)' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Vigencia</label>
                  <select value={qf.urgencia || 'normal'} onChange={e => {
                    const v = e.target.value;
                    const daysMap: Record<string, number> = { normal: 15, urgente: 5, oferta: 3 };
                    const days = daysMap[v];
                    if (days) {
                      const date = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
                      setQf({ ...qf, urgencia: v, vigencia: date });
                    } else {
                      setQf({ ...qf, urgencia: v });
                    }
                  }} style={S.input}>
                    <option value="normal">Normal (15 dias)</option>
                    <option value="urgente">Urgente (5 dias)</option>
                    <option value="oferta">Oferta limitada (3 dias)</option>
                    <option value="custom">Personalizada</option>
                  </select>
                </div>
              </div>

              {/* Custom vigencia */}
              {qf.urgencia === 'custom' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={S.label}>Dias de vigencia</label>
                    <input type="number" min="1" placeholder="Ej. 30" value={qf._custom_days || ''} onChange={e => {
                      const days = parseInt(e.target.value) || 0;
                      const date = days > 0 ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10) : '';
                      setQf({ ...qf, _custom_days: e.target.value, vigencia: date });
                    }} style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>O fecha exacta</label>
                    <input type="date" value={qf.vigencia || ''} onChange={e => {
                      const date = e.target.value;
                      const days = date ? Math.ceil((new Date(date).getTime() - Date.now()) / 86400000) : 0;
                      setQf({ ...qf, vigencia: date, _custom_days: days > 0 ? String(days) : '' });
                    }} style={S.input} />
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.6875rem', color: '#999', marginTop: -8, marginBottom: 12 }}>
                  Vence: {fmtDate(qf.vigencia)}
                </div>
              )}

              {/* Link de pago */}
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Link de pago</label>
                <select value={qf._pago_mode || (qf.link_pago ? 'manual' : 'none')} onChange={e => {
                  const v = e.target.value;
                  if (v === 'none') setQf({ ...qf, _pago_mode: v, link_pago: '' });
                  else setQf({ ...qf, _pago_mode: v });
                }} style={S.input}>
                  <option value="none">Sin link de pago</option>
                  <option value="stripe">Stripe (automatico)</option>
                  <option value="manual">Link manual</option>
                </select>
                {(qf._pago_mode || (qf.link_pago ? 'manual' : 'none')) === 'manual' && (
                  <input value={qf.link_pago || ''} onChange={e => setQf({ ...qf, link_pago: e.target.value })} placeholder="https://..." style={{ ...S.input, marginTop: 6 }} />
                )}
                {(qf._pago_mode || '') === 'stripe' && (
                  <div style={{ fontSize: '0.6875rem', color: '#4B7BE5', marginTop: 6 }}>
                    Se generara un link de Stripe Checkout al guardar la cotización
                  </div>
                )}
              </div>

              {/* Visibility toggles */}
              <div style={{ marginBottom: 12 }}>
                <div style={S.label}>Mostrar en cotización</div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, background: '#f8f9fb', borderRadius: 8, padding: 10 }}>
                  {[
                    { key: 'mostrar_timer', label: 'Contador de tiempo (urgencia)', default: true },
                    { key: 'mostrar_features', label: 'Detalle del plan (qué incluye)', default: true },
                    { key: 'mostrar_desglose', label: 'Resumen de pagos', default: true },
                    { key: 'mostrar_condiciones', label: 'Condiciones', default: true },
                    { key: 'mostrar_key_points', label: 'Minuta de la reunión', default: true },
                    { key: 'mostrar_roi', label: 'Calculadora de ROI', default: false },
                    { key: 'mostrar_antes_despues', label: 'Antes vs Después', default: false },
                    { key: 'mostrar_timeline', label: 'Timeline de implementación', default: true },
                    { key: 'mostrar_implementacion', label: 'Proceso de implementación (pasos operativos)', default: true },
                    { key: 'mostrar_porque_sacs', label: '¿Por qué SACS? (historia, casos de éxito)', default: true },
                    { key: 'mostrar_firma', label: 'Firma digital', default: true },
                    { key: 'mostrar_qr', label: 'Código QR', default: true },
                    { key: 'mostrar_animaciones', label: 'Números animados', default: true },
                  ].map(opt => (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: '#555', cursor: 'pointer' }}>
                      <input type="checkbox" checked={qf[opt.key] !== undefined ? qf[opt.key] : opt.default} onChange={e => setQf({ ...qf, [opt.key]: e.target.checked })} />
                      {opt.label}
                    </label>
                  ))}
                </div>
                {/* Timeline type selector */}
                {(qf.mostrar_timeline !== undefined ? qf.mostrar_timeline : true) && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ ...S.label, marginTop: 0 }}>Tipo de timeline</label>
                    <select value={qf.timeline_tipo || '1suc'} onChange={e => setQf({ ...qf, timeline_tipo: e.target.value })} style={S.input}>
                      <option value="1suc">1 sucursal — Arrancando su primera tienda</option>
                      <option value="2a5suc">2–5 sucursales — Creciendo y necesita orden</option>
                      <option value="5massuc">5+ sucursales — Operación compleja, automatización</option>
                    </select>
                  </div>
                )}
                {/* Implementacion nota */}
                {(qf.mostrar_implementacion !== undefined ? qf.mostrar_implementacion : true) && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ ...S.label, marginTop: 0 }}>Nota en proceso de implementación (opcional)</label>
                    <textarea value={qf.implementacion_nota || ''} onChange={e => setQf({ ...qf, implementacion_nota: e.target.value })} placeholder="Ej. Tu migración incluye integración con SAP" style={{ ...S.input, height: 56, resize: 'vertical' as const, fontSize: '0.75rem' }} />
                    <div style={{ fontSize: '0.625rem', color: '#bbb', marginTop: 4 }}>Se muestra al cliente en la cotización y en el link compartible del proceso.</div>
                  </div>
                )}
              </div>

              <div><label style={S.label}>Condiciones</label><textarea value={qf.condiciones || ''} onChange={e => setQf({ ...qf, condiciones: e.target.value })} style={{ ...S.input, height: 60 }} /></div>

              {/* Key points */}
              {(qf.key_points || []).length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={S.label}>Puntos clave ({qf.key_points.length})</div>
                  {qf.key_points.map((kp: any, i: number) => (
                    <div key={i} style={{ background: '#f8f9fb', borderRadius: 8, padding: 10, marginBottom: 6, borderLeft: '3px solid #4B7BE5', display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <input value={kp.title} onChange={e => { const kps = [...qf.key_points]; kps[i] = { ...kps[i], title: e.target.value }; setQf({ ...qf, key_points: kps }); }} placeholder="Título" style={{ ...S.input, fontWeight: 700, fontSize: '0.75rem', marginBottom: 4 }} />
                        <input value={kp.detail} onChange={e => { const kps = [...qf.key_points]; kps[i] = { ...kps[i], detail: e.target.value }; setQf({ ...qf, key_points: kps }); }} placeholder="Detalle" style={{ ...S.input, fontSize: '0.6875rem' }} />
                      </div>
                      <button onClick={() => { const kps = [...qf.key_points]; kps.splice(i, 1); setQf({ ...qf, key_points: kps }); }} style={{ ...S.btnSmall, color: '#E54B4B', alignSelf: 'flex-start' }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => setQf({ ...qf, key_points: [...(qf.key_points || []), { title: '', detail: '' }] })} style={S.btnSmall}>+ Agregar punto</button>
                </div>
              )}

              {/* ROI editor */}
              {qf.mostrar_roi && (
                <div style={{ marginTop: 12 }}>
                  <div style={S.label}>Calculadora de ROI</div>
                  <div style={{ background: '#f8f9fb', borderRadius: 8, padding: 12 }}>
                    <div style={{ marginBottom: 6 }}><label style={{ ...S.label, marginTop: 0 }}>Problema actual del cliente</label><textarea value={qf.roi?.problema || ''} onChange={e => setQf({ ...qf, roi: { ...(qf.roi || {}), problema: e.target.value } })} placeholder="Ej. Pierden 200 piezas al mes por falta de control" style={{ ...S.input, height: 40, fontSize: '0.6875rem' }} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div><label style={{ ...S.label, marginTop: 0 }}>Ahorro mensual ($)</label><input type="number" value={qf.roi?.ahorro_mensual || ''} onChange={e => setQf({ ...qf, roi: { ...(qf.roi || {}), ahorro_mensual: parseFloat(e.target.value) || 0 } })} placeholder="Ej. 15000" style={S.input} /></div>
                      <div><label style={{ ...S.label, marginTop: 0 }}>Ahorro anual ($)</label><div style={{ ...S.input, background: '#f0f0f0', color: '#2AB5A0', fontWeight: 700 }}>{fmt((qf.roi?.ahorro_mensual || 0) * 12)}</div></div>
                    </div>
                    <div style={{ marginTop: 6 }}><label style={{ ...S.label, marginTop: 0 }}>Detalle del calculo</label><input value={qf.roi?.detalle || ''} onChange={e => setQf({ ...qf, roi: { ...(qf.roi || {}), detalle: e.target.value } })} placeholder="Cómo se estima este ahorro" style={{ ...S.input, fontSize: '0.6875rem' }} /></div>
                  </div>
                </div>
              )}

              {/* Antes/Después editor */}
              {qf.mostrar_antes_despues && (
                <div style={{ marginTop: 12 }}>
                  <div style={S.label}>Antes vs Después</div>
                  {(qf.antes_despues || []).map((row: any, i: number) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 4, marginBottom: 4 }}>
                      <input value={row.aspecto || ''} onChange={e => { const a = [...(qf.antes_despues || [])]; a[i] = { ...a[i], aspecto: e.target.value }; setQf({ ...qf, antes_despues: a }); }} placeholder="Aspecto" style={{ ...S.input, fontSize: '0.6875rem' }} />
                      <input value={row.antes || ''} onChange={e => { const a = [...(qf.antes_despues || [])]; a[i] = { ...a[i], antes: e.target.value }; setQf({ ...qf, antes_despues: a }); }} placeholder="Hoy" style={{ ...S.input, fontSize: '0.6875rem', color: '#ccc' }} />
                      <input value={row.despues || ''} onChange={e => { const a = [...(qf.antes_despues || [])]; a[i] = { ...a[i], despues: e.target.value }; setQf({ ...qf, antes_despues: a }); }} placeholder="Con SACS" style={{ ...S.input, fontSize: '0.6875rem' }} />
                      <button onClick={() => { const a = [...(qf.antes_despues || [])]; a.splice(i, 1); setQf({ ...qf, antes_despues: a }); }} style={{ ...S.btnSmall, color: '#E54B4B' }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => setQf({ ...qf, antes_despues: [...(qf.antes_despues || []), { aspecto: '', antes: '', despues: '' }] })} style={S.btnSmall}>+ Agregar fila</button>
                </div>
              )}

              {/* Timeline */}
              {qf.id && (() => {
                const { meta } = parseMeta(qf.notas);
                const timeline = meta.timeline || [];
                const views = meta.views || 0;
                const eventLabels: Record<string, string> = { created: 'Creada', sent: 'Enviada', viewed: 'Vista', accepted: 'Aceptada', paid: 'Pagada', comment: 'Comentario', reply: 'Respuesta', edited: 'Editada' };
                const eventColors: Record<string, string> = { created: '#999', sent: '#4B7BE5', viewed: '#6C5CE7', accepted: '#2AB5A0', paid: '#2e7d32', comment: '#E8A838', reply: '#4B7BE5', edited: '#E8A838' };
                // Deduplicate: show only first occurrence of each event type (except viewed which shows count)
                const uniqueEvents: any[] = [];
                const seen = new Set<string>();
                for (const t of timeline) {
                  if (t.event === 'viewed') {
                    if (!seen.has('viewed')) { uniqueEvents.push({ ...t, count: views }); seen.add('viewed'); }
                  } else {
                    if (!seen.has(t.event)) { uniqueEvents.push(t); seen.add(t.event); }
                  }
                }
                return uniqueEvents.length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    <div style={S.label}>Historial</div>
                    <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 12 }}>
                      {uniqueEvents.map((t: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < uniqueEvents.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: eventColors[t.event] || '#ccc', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1a1a1a' }}>
                              {eventLabels[t.event] || t.event}
                              {t.event === 'viewed' && t.count > 1 && <span style={{ color: '#6C5CE7', marginLeft: 4 }}>({t.count} veces)</span>}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.625rem', color: '#aaa' }}>{fmtDate(t.at)} {new Date(t.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Comments */}
              {qf.id && (() => {
                const { meta } = parseMeta(qf.notas);
                const comments = meta.comments || [];
                return comments.length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    <div style={S.label}>Comentarios del cliente ({comments.length})</div>
                    <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 12, maxHeight: 240, overflowY: 'auto' as const }}>
                      {comments.map((c: any, i: number) => (
                        <div key={i} style={{ marginBottom: 12, padding: '8px 10px', background: c.from === 'admin' ? '#f0f0f0' : '#fff', borderRadius: 8, border: '1px solid #eee' }}>
                          <div style={{ fontSize: '0.8125rem', color: '#333', lineHeight: 1.5, whiteSpace: 'pre-wrap' as const }}>{c.text}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: c.from === 'admin' ? '#2AB5A0' : '#999', textTransform: 'uppercase' as const }}>{c.from === 'admin' ? 'Sacs' : c.name || 'Cliente'}</span>
                            <span style={{ fontSize: '0.5625rem', color: '#ccc' }}>{fmtDate(c.at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <input id="admin-reply-input" placeholder="Responder al cliente..." style={{ ...S.input, flex: 1, fontSize: '0.75rem' }} onKeyDown={(e: any) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('btn-admin-reply')?.click(); } }} />
                      <button id="btn-admin-reply" onClick={async () => {
                        const input = document.getElementById('admin-reply-input') as HTMLInputElement;
                        const text = input?.value.trim();
                        if (!text) return;
                        await fetch('/api/revenue/quote-comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: qf.id, from: 'admin', name: 'Sacs', text }) });
                        input.value = '';
                        const res = await fetch(`/api/revenue/quotes?id=${qf.id}`).then(r => r.json());
                        setQf({ ...qf, notas: res.notas, items: Array.isArray(qf.items) ? qf.items : [] });
                      }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', fontSize: '0.75rem', padding: '6px 14px' }}>Enviar</button>
                    </div>
                  </div>
                ) : null;
              })()}

            </div>
            {/* Right: Preview */}
            <div style={{ flex: 1, overflowY: 'auto' as const, padding: 32 }}>
              <div style={{ width: '100%', maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                {/* Preview Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '28px 32px 18px', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'Clash Display',sans-serif", fontSize: '1.5rem', fontWeight: 700 }}>Sacs</span>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#4B7BE5', background: 'rgba(75,123,229,0.08)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Cotización</span>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800 }}>{qf.numero || 'COT-XXX'}</div>
                    <div style={{ fontSize: '0.6875rem', color: '#999' }}>Vigencia: {fmtDate(qf.vigencia)}</div>
                  </div>
                </div>

                {/* Preview Client */}
                <div style={{ padding: '16px 32px' }}>
                  <div style={{ fontSize: '0.5rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 2 }}>Cotización para:</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a' }}>{qf.empresa || 'Empresa'}</div>
                  {qf.contacto && <div style={{ fontSize: '0.75rem', color: '#888' }}>{qf.contacto}</div>}
                  {qf.email && <div style={{ fontSize: '0.75rem', color: '#888' }}>{qf.email}</div>}
                </div>

                {/* Preview Key Points */}
                {(qf.key_points || []).length > 0 && (qf.mostrar_key_points !== false) && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Minuta de la reunión</div>
                    {qf.key_points.map((kp: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', alignItems: 'flex-start' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}><path d="M20 6L9 17l-5-5" stroke="#4B7BE5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <div>
                          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#1a1a1a' }}>{kp.title}</div>
                          <div style={{ fontSize: '0.5625rem', color: '#999' }}>{kp.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Preview Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                  <thead>
                    <tr>
                      {['Concepto', 'Detalle', 'Precio', 'Subtotal'].map(h => (
                        <th key={h} style={{ fontSize: '0.5rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#aaa', padding: '8px 12px', textAlign: h === 'Precio' || h === 'Subtotal' ? 'right' as const : 'left' as const, background: '#fafafa', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center' as const, color: '#ddd', fontSize: '0.75rem' }}>Agrega conceptos al formulario</td></tr>}
                    {items.map((item: any, i: number) => {
                      const isP = item.tipo === 'plan';
                      const isPromo = item.es_promocion;
                      const suc = parseInt(item.sucursales) || 1;
                      const isAnn = item.periodo === 'anual';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f5f5f5', background: isPromo ? 'rgba(42,181,160,0.02)' : 'transparent' }}>
                          <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>
                            {isPromo && <span style={{ display: 'inline-block', fontSize: '0.4375rem', fontWeight: 800, color: '#fff', background: '#2AB5A0', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' as const, marginBottom: 2, marginRight: 4 }}>Promo</span>}
                            <strong style={{ color: '#1a1a1a' }}>{isP ? `Plan ${item.nombre}` : (item.nombre || '—')}</strong>
                            {isP && <div style={{ fontSize: '0.5625rem', color: '#bbb' }}>{fmt(item.precio_unitario || 0)}/suc × {suc} suc. × {isAnn ? '10 meses' : '1 mes'}</div>}
                            {item.descripcion && <div style={{ fontSize: '0.5625rem', color: '#bbb' }}>{item.descripcion}</div>}
                            {item.nota && <div style={{ fontSize: '0.5625rem', color: '#4B7BE5', fontStyle: 'italic' as const }}>{item.nota}</div>}
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: '0.6875rem', color: '#888' }}>{isPromo ? 'Promo' : isP ? (isAnn ? 'Anual' : 'Mensual') : item.periodo_extra === 'anual' ? 'Anual' : item.recurrente ? 'Mensual' : 'Único'}</td>
                          <td style={{ padding: '10px 8px', fontSize: '0.6875rem', textAlign: 'right' as const, fontWeight: 600 }}>
                            {isPromo ? <span style={{ textDecoration: 'line-through', color: '#ccc' }}>{fmt(item.precio_original || 0)}</span> : fmt(item.precio_unitario || item.monto || 0)}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '0.6875rem', textAlign: 'right' as const, fontWeight: 600 }}>
                            {isPromo ? <span style={{ color: '#2AB5A0', fontWeight: 800 }}>$0</span> : fmt(item.subtotal || item.monto || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Preview Totals */}
                <div style={{ padding: '16px 32px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888', marginBottom: 4 }}><span>Subtotal</span><span>{fmt(itemsSubtotal)}</span></div>
                  {parseFloat(qf.descuento_global) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#2AB5A0', marginBottom: 4 }}><span>Descuento</span><span>-{fmt(globalDisc)}</span></div>}
                  {ivaMode !== 'sin' && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888', marginBottom: 4 }}><span>{ivaMode === 'incluido' ? 'IVA incluido' : 'IVA (16%)'}</span><span>{fmt(ivaMonto)}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem', fontWeight: 800, borderTop: '2px solid #1a1a1a', paddingTop: 8, marginTop: 4 }}>
                    <span>Total {ivaMode === 'incluido' ? '(IVA incl.)' : ''}</span><span style={{ color: '#2AB5A0' }}>{fmt(grandTotal)} {qf.moneda}</span>
                  </div>
                </div>

                {/* Preview ROI */}
                {qf.mostrar_roi && qf.roi?.ahorro_mensual > 0 && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Retorno de inversión estimado</div>
                    {qf.roi.problema && <div style={{ fontSize: '0.5625rem', color: '#999', marginBottom: 8 }}>{qf.roi.problema}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: 10, textAlign: 'center' as const }}>
                        <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#2AB5A0' }}>{fmt(qf.roi.ahorro_mensual)}</div>
                        <div style={{ fontSize: '0.4375rem', color: '#999', textTransform: 'uppercase' as const }}>Ahorro mensual</div>
                      </div>
                      <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: 10, textAlign: 'center' as const }}>
                        <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#2AB5A0' }}>{fmt(qf.roi.ahorro_mensual * 12)}</div>
                        <div style={{ fontSize: '0.4375rem', color: '#999', textTransform: 'uppercase' as const }}>Ahorro anual</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Antes vs Después */}
                {qf.mostrar_antes_despues && (qf.antes_despues || []).length > 0 && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Antes vs Después</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.5625rem' }}>
                      <thead><tr>
                        <th style={{ padding: '4px 6px', textAlign: 'left' as const, color: '#aaa', fontWeight: 600 }}>Aspecto</th>
                        <th style={{ padding: '4px 6px', textAlign: 'center' as const, color: '#ccc', fontWeight: 600 }}>Hoy</th>
                        <th style={{ padding: '4px 6px', textAlign: 'center' as const, color: '#2AB5A0', fontWeight: 600 }}>Con SACS</th>
                      </tr></thead>
                      <tbody>
                        {(qf.antes_despues || []).map((row: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td style={{ padding: '4px 6px', fontWeight: 700, color: '#1a1a1a' }}>{row.aspecto}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'center' as const, color: '#ccc', textDecoration: 'line-through' }}>{row.antes}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'center' as const, fontWeight: 600 }}>{row.despues}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Preview Payment Breakdown */}
                {(qf.mostrar_desglose !== false) && items.some((i: any) => i.tipo === 'plan') && (() => {
                  const pPlans = items.filter((i: any) => i.tipo === 'plan');
                  const pUnique = items.filter((i: any) => i.tipo === 'extra' && !i.recurrente && !i.es_promocion);
                  const pMonthly = items.filter((i: any) => i.tipo === 'extra' && i.recurrente && i.periodo_extra !== 'anual');
                  const pAnnualPlans = pPlans.filter((i: any) => i.periodo === 'anual');
                  const pMonthlyPlans = pPlans.filter((i: any) => i.periodo === 'mensual');
                  return (
                    <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Resumen de pagos</div>
                      <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, marginBottom: 6, fontSize: '0.625rem' }}>
                        <div style={{ fontWeight: 700, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, fontSize: '0.5rem' }}>Primer pago</div>
                        {pPlans.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>Plan {i.nombre} ({i.periodo})</span><span>{fmt(i.subtotal || 0)}</span></div>)}
                        {pUnique.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>{i.nombre}</span><span>{fmt(i.monto || 0)}</span></div>)}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid #e0e0e0', paddingTop: 4, marginTop: 4 }}><span>Total primer pago</span><span>{fmt(grandTotal)} {qf.moneda}</span></div>
                      </div>
                      {(pMonthlyPlans.length > 0 || pMonthly.length > 0) && (
                        <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, marginBottom: 6, fontSize: '0.625rem' }}>
                          <div style={{ fontWeight: 700, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, fontSize: '0.5rem' }}>Pago mensual recurrente</div>
                          {pMonthlyPlans.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>Plan {i.nombre}</span><span>{fmt(i.subtotal || 0)}</span></div>)}
                          {pMonthly.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>{i.nombre}</span><span>{fmt(i.monto || 0)}</span></div>)}
                        </div>
                      )}
                      {pAnnualPlans.length > 0 && (
                        <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, fontSize: '0.625rem' }}>
                          <div style={{ fontWeight: 700, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, fontSize: '0.5rem' }}>Renovación anual</div>
                          {pAnnualPlans.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>Plan {i.nombre}</span><span>{fmt(i.subtotal || 0)}</span></div>)}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Preview Plan Features */}
                {(qf.mostrar_features !== false) && items.filter((i: any) => i.tipo === 'plan').length > 0 && (() => {
                  const planItems = items.filter((i: any) => i.tipo === 'plan');
                  const features = planItems.map((pi: any) => {
                    const pd = plansData.find(p => p.id === pi.nombre?.toLowerCase());
                    if (!pd) return null;
                    const allF: { category: string; items: string[] }[] = [];
                    let cur: typeof pd | undefined = pd;
                    const visited = new Set<string>();
                    while (cur && !visited.has(cur.id)) {
                      visited.add(cur.id);
                      for (const f of cur.features) { if (typeof f === 'object' && 'category' in f) allF.push(f); }
                      cur = cur.inheritsFrom ? plansData.find(p => p.name === cur!.inheritsFrom) : undefined;
                    }
                    return { name: pd.name, features: allF.reverse(), services: pd.services };
                  }).filter(Boolean);
                  return features.length > 0 ? (
                    <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 10 }}>Que incluye tu plan</div>
                      {features.map((pf: any, fi: number) => (
                        <div key={fi}>
                          <div style={{ fontSize: '0.5rem', fontWeight: 700, color: '#4B7BE5', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid #f0f0f0' }}>Plan {pf.name}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: 10 }}>
                            {pf.features.map((cat: any, ci: number) => (
                              <div key={ci}>
                                <div style={{ fontSize: '0.5rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, marginBottom: 2 }}>{cat.category}</div>
                                {cat.items.map((item: string, ii: number) => (
                                  <div key={ii} style={{ display: 'flex', gap: 4, fontSize: '0.5rem', color: '#666', padding: '1px 0', alignItems: 'flex-start' }}>
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M20 6L9 17l-5-5" stroke="#2AB5A0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    <span>{item}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                          {pf.services.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, marginBottom: 8 }}>
                              {pf.services.map((s: string, si: number) => (
                                <span key={si} style={{ fontSize: '0.5rem', fontWeight: 600, color: '#2AB5A0', background: 'rgba(42,181,160,0.08)', padding: '2px 6px', borderRadius: 10 }}>{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* Preview Conditions */}
                {(qf.mostrar_condiciones !== false) && qf.condiciones && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.5rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 4 }}>Condiciones</div>
                    <div style={{ fontSize: '0.625rem', color: '#999', lineHeight: 1.6, whiteSpace: 'pre-line' as const }}>{qf.condiciones}</div>
                  </div>
                )}

                {/* Preview Footer */}
                <div style={{ padding: '14px 32px', background: '#fafafa', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', fontSize: '0.5625rem', color: '#bbb' }}>
                  <span><strong style={{ color: '#1a1a1a', fontFamily: "'Clash Display',sans-serif" }}>Sacs</strong> Sistema operativo para retailers</span>
                  <span>www.sacscloud.com</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Main Layout ───
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', background: '#f5f6f8' }}>
      {/* Nav */}
      {!_hideNav && (
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0', marginRight: 32 }}>
            <span style={{ fontFamily: "'Clash Display',sans-serif", fontSize: '1.25rem', fontWeight: 700 }}>Sacs</span>
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#2AB5A0', background: 'rgba(42,181,160,0.08)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Revenue</span>
          </div>
          {(['dashboard', 'clientes', 'pagos', 'cotizaciones', 'config'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '14px 16px', fontSize: '0.8125rem', fontWeight: tab === t ? 700 : 500, color: tab === t ? '#1a1a1a' : '#999', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #1a1a1a' : '2px solid transparent', cursor: 'pointer', textTransform: 'capitalize' as const }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/admin/leads" style={{ ...S.btn, background: '#f5f5f5', color: '#555', textDecoration: 'none' }}>CRM</a>
          <button onClick={load} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>↻</button>
        </div>
      </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px' }}>
        {tab === 'dashboard' && <DashboardView />}
        {tab === 'clientes' && <ClientsView />}
        {tab === 'pagos' && <PaymentsView />}
        {tab === 'cotizaciones' && <QuotesView />}
        {tab === 'config' && (
          <div>
            {/* Folio config */}
            <h2 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: 16 }}>Folio de cotizaciones</h2>
            <div style={{ ...S.card, marginBottom: 24 }}>
              <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: 12 }}>Este número se usa como <b>folio inicial</b>. A partir de él, cada cotización nueva se numera de forma consecutiva y nunca se repite.</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Siguiente numero de folio</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#999' }}>COT-</span>
                    <input id="folio-input" type="number" min="1" placeholder="Ej. 100" defaultValue="" style={S.input} />
                  </div>
                </div>
                <button onClick={async () => {
                  const input = document.getElementById('folio-input') as HTMLInputElement;
                  const val = parseInt(input?.value);
                  if (!val || val < 1) { alert('Ingresa un numero valido'); return; }
                  // Validar contra el folio más alto existente (no contra el conteo de filas)
                  const res = await fetch('/api/revenue/quotes');
                  const all = await res.json();
                  let maxExisting = 0;
                  if (Array.isArray(all)) {
                    for (const q of all) {
                      const m = String(q?.numero || '').match(/(\d+)\s*$/);
                      if (m) maxExisting = Math.max(maxExisting, parseInt(m[1], 10));
                    }
                  }
                  if (val <= maxExisting) { alert(`El folio más alto usado es COT-${String(maxExisting).padStart(3, '0')}. El siguiente debe ser mayor a ${maxExisting}.`); return; }
                  // Guardamos offset = val-1 para mantener la convención (folioStart = offset + 1)
                  localStorage.setItem('sacs_folio_offset', String(val - 1));
                  alert(`Listo. La próxima cotización será COT-${String(val).padStart(3, '0')}. Las siguientes serán consecutivas.`);
                  input.value = '';
                }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff' }}>Guardar</button>
              </div>
              {typeof window !== 'undefined' && localStorage.getItem('sacs_folio_offset') && (
                <div style={{ fontSize: '0.6875rem', color: '#4B7BE5', marginTop: 8 }}>Offset configurado: +{localStorage.getItem('sacs_folio_offset')}</div>
              )}
            </div>

            <h2 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: 16 }}>Cuentas bancarias</h2>
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <div><label style={S.label}>Banco</label><input value={bankForm.banco || ''} onChange={e => setBankForm({ ...bankForm, banco: e.target.value })} placeholder="Ej. BBVA" style={S.input} /></div>
                <div><label style={S.label}>Cuenta</label><input value={bankForm.cuenta || ''} onChange={e => setBankForm({ ...bankForm, cuenta: e.target.value })} placeholder="Número de cuenta" style={S.input} /></div>
                <div><label style={S.label}>CLABE</label><input value={bankForm.clabe || ''} onChange={e => setBankForm({ ...bankForm, clabe: e.target.value })} placeholder="18 dígitos" style={S.input} /></div>
                <div><label style={S.label}>RFC</label><input value={bankForm.rfc || ''} onChange={e => setBankForm({ ...bankForm, rfc: e.target.value })} placeholder="RFC" style={S.input} /></div>
                <div><label style={S.label}>Titular</label><input value={bankForm.titular || ''} onChange={e => setBankForm({ ...bankForm, titular: e.target.value })} placeholder="Nombre" style={S.input} /></div>
                <button onClick={async () => {
                  if (!bankForm.banco) return;
                  await fetch('/api/revenue/bank-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...bankForm, es_default: bankAccounts.length === 0 }) });
                  setBankForm({});
                  load();
                }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff' }}>Agregar</button>
              </div>
            </div>
            <div style={S.card}>
              <table style={S.table}>
                <thead><tr>{['Banco', 'Cuenta', 'CLABE', 'RFC', 'Titular', 'Default', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {bankAccounts.length === 0 && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center' as const, color: '#ccc', padding: 32 }}>Sin cuentas bancarias</td></tr>}
                  {bankAccounts.map((ba: any) => (
                    <tr key={ba.id}>
                      <td style={{ ...S.td, fontWeight: 700 }}>{ba.banco}</td>
                      <td style={S.td}>{ba.cuenta}</td>
                      <td style={S.td}>{ba.clabe}</td>
                      <td style={S.td}>{ba.rfc}</td>
                      <td style={S.td}>{ba.titular}</td>
                      <td style={S.td}>{ba.es_default ? <span style={{ ...S.badge, background: '#e8f5e9', color: '#2e7d32' }}>Default</span> : <button onClick={async () => { await fetch('/api/revenue/bank-accounts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ba.id, es_default: true }) }); load(); }} style={S.btnSmall}>Hacer default</button>}</td>
                      <td style={S.td}><button onClick={async () => { await fetch('/api/revenue/bank-accounts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ba.id }) }); load(); }} style={{ ...S.btnSmall, color: '#E54B4B' }}>Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───
const S: Record<string, React.CSSProperties> = {
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
  kpi: { background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #f0f0f0' },
  card: { background: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #f0f0f0', marginBottom: 16 },
  cardTitle: { margin: '0 0 16px', fontSize: '0.875rem', fontWeight: 700, color: '#1a1a1a' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.8125rem' },
  th: { padding: '8px 12px', textAlign: 'left' as const, fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#aaa', background: '#fafafa', borderBottom: '1px solid #f0f0f0' },
  td: { padding: '10px 12px', color: '#555', borderBottom: '1px solid #f8f8f8' },
  tr: { cursor: 'default' },
  btn: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  btnSmall: { fontSize: '0.6875rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fafafa', color: '#666', cursor: 'pointer', marginRight: 4 },
  badge: { fontSize: '0.625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-block' },
  input: { width: '100%', padding: '8px 12px', fontSize: '0.8125rem', border: '1px solid #e0e0e0', borderRadius: 8, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const },
  label: { display: 'block', fontSize: '0.625rem', fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' as const },
  listItem: { padding: '10px 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.8125rem' },
  empty: { textAlign: 'center' as const, padding: 32, color: '#ccc', fontSize: '0.875rem' },
};
