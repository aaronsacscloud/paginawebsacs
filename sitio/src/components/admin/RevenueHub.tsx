import { useState, useEffect } from 'react';

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

export default function RevenueHub() {
  const [tab, setTab] = useState<Tab>('dashboard');
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
    const PER_PAGE = 10;

    useEffect(() => {
      fetch('/api/revenue/quotes').then(r => r.json()).then(d => setQuotes(Array.isArray(d) ? d : []));
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
      } else {
        arr[idx].subtotal = parseFloat(arr[idx].monto) || 0;
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
      setSaving(true);
      const isEdit = !!qf.id;
      // Store logo_url in meta, add timeline events
      let notas = qf.notas || '';
      const { text, meta } = parseMeta(notas);
      if (qf.logo_url) meta.logo_url = qf.logo_url;
      else delete meta.logo_url;
      meta.iva_mode = ivaMode;
      notas = serializeMeta(text, meta);
      if (!isEdit) {
        notas = addTimelineEvent(notas, 'created');
        notas = addTimelineEvent(notas, 'sent');
      }
      // Remove frontend-only fields
      const { _custom_days, logo_url, iva_mode: _im, _pago_mode, ...rest } = qf;
      const body = { ...rest, notas, subtotal: itemsSubtotal, iva_incluido: ivaMode !== 'sin', iva_monto: Math.round(ivaMonto), total: Math.round(grandTotal), estado: rest.estado || 'sent' };

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

    const duplicateQuote = async (q: any) => {
      const copy = { ...q, id: undefined, numero: undefined, estado: 'draft', created_at: undefined };
      setSaving(true);
      await fetch('/api/revenue/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copy) });
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
      setSaving(false);
    };

    // ─── Filter, search, sort, paginate ───
    const estadoLabels: Record<string, string> = { draft: 'Borrador', sent: 'Enviada', accepted: 'Aceptada', paid: 'Pagada', expired: 'Vencida' };
    const estadoColors: Record<string, { bg: string; fg: string }> = {
      draft: { bg: '#f5f5f5', fg: '#999' },
      sent: { bg: '#fff3e0', fg: '#e65100' },
      accepted: { bg: '#e8f5e9', fg: '#2e7d32' },
      paid: { bg: '#e3f2fd', fg: '#1565c0' },
      expired: { bg: '#fce4ec', fg: '#c62828' },
    };

    const filtered = quotes
      .filter((q: any) => {
        if (qFilter !== 'all' && q.estado !== qFilter) return false;
        if (!qSearch) return true;
        const s = qSearch.toLowerCase();
        return (q.numero || '').toLowerCase().includes(s) ||
          (q.empresa || '').toLowerCase().includes(s) ||
          (q.contacto || '').toLowerCase().includes(s) ||
          (q.email || '').toLowerCase().includes(s);
      })
      .sort((a: any, b: any) => {
        const dir = qSort.asc ? 1 : -1;
        if (qSort.col === 'total') return ((a.total || 0) - (b.total || 0)) * dir;
        if (qSort.col === 'views') {
          const va = parseMeta(a.notas).meta.views || 0;
          const vb = parseMeta(b.notas).meta.views || 0;
          return (va - vb) * dir;
        }
        const va = a[qSort.col] || '';
        const vb = b[qSort.col] || '';
        return va < vb ? -dir : va > vb ? dir : 0;
      });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const safePage = Math.min(qPage, totalPages - 1);
    const paginated = filtered.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

    // Count by estado
    const counts: Record<string, number> = { all: quotes.length };
    quotes.forEach((q: any) => { counts[q.estado] = (counts[q.estado] || 0) + 1; });

    const SortHeader = ({ col, label }: { col: string; label: string }) => (
      <th style={{ ...S.th, cursor: 'pointer', userSelect: 'none' as const, whiteSpace: 'nowrap' as const }} onClick={() => setQSort({ col, asc: qSort.col === col ? !qSort.asc : col === 'total' || col === 'views' ? false : true })}>
        {label} {qSort.col === col ? (qSort.asc ? '↑' : '↓') : ''}
      </th>
    );

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Cotizaciones <span style={{ fontWeight: 400, color: '#aaa', fontSize: '0.875rem' }}>({filtered.length})</span></h2>
          <button onClick={() => { setQf({ empresa: '', contacto: '', email: '', whatsapp: '', items: [], iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern', condiciones: 'Precios en MXN. Migracion incluida. Soporte 24/7. Sin contratos.' }); setShowDrawer(true); }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff' }}>+ Nueva cotización</button>
        </div>

        {/* Search + filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          <div style={{ position: 'relative' as const, flex: '1 1 220px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" style={{ position: 'absolute' as const, left: 10, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={qSearch} onChange={e => { setQSearch(e.target.value); setQPage(0); }} placeholder="Buscar por empresa, contacto, numero..." style={{ ...S.input, paddingLeft: 32 }} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'draft', 'sent', 'accepted', 'paid'].map(st => {
              const active = qFilter === st;
              const label = st === 'all' ? 'Todas' : estadoLabels[st] || st;
              const count = counts[st] || 0;
              return (
                <button key={st} onClick={() => { setQFilter(st); setQPage(0); }} style={{
                  padding: '5px 12px', borderRadius: 20, border: active ? '1.5px solid #1a1a1a' : '1px solid #e0e0e0',
                  background: active ? '#1a1a1a' : '#fff', color: active ? '#fff' : '#666',
                  fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  {label} <span style={{ fontSize: '0.5625rem', opacity: 0.7 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div style={S.card}>
          <table style={S.table}>
            <thead><tr>
              <SortHeader col="numero" label="#" />
              <SortHeader col="created_at" label="Fecha" />
              <SortHeader col="empresa" label="Empresa" />
              <SortHeader col="total" label="Total" />
              <SortHeader col="estado" label="Estado" />
              <SortHeader col="views" label="Vistas" />
              <th style={S.th}>Acciones</th>
            </tr></thead>
            <tbody>
              {paginated.length === 0 && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center' as const, color: '#ccc', padding: 32 }}>{qSearch || qFilter !== 'all' ? 'Sin resultados' : 'Sin cotizaciones'}</td></tr>}
              {paginated.map((q: any) => {
                const { meta } = parseMeta(q.notas);
                const views = meta.views || 0;
                const ec = estadoColors[q.estado] || estadoColors.draft;
                return (
                  <tr key={q.id} style={{ ...S.tr, transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fb')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...S.td, fontWeight: 700, color: '#4B7BE5' }}>{q.numero || '-'}</td>
                    <td style={S.td}>{fmtDate(q.created_at)}</td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 700, color: '#1a1a1a' }}>{q.empresa}</div>
                      {q.contacto && <div style={{ fontSize: '0.625rem', color: '#aaa' }}>{q.contacto}</div>}
                    </td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{fmt(q.total || 0)}</td>
                    <td style={S.td}><span style={{ ...S.badge, background: ec.bg, color: ec.fg }}>{estadoLabels[q.estado] || q.estado}</span></td>
                    <td style={S.td}>
                      {views > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 700, color: '#6C5CE7' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                          {views}
                        </span>
                      ) : <span style={{ color: '#ddd', fontSize: '0.75rem' }}>—</span>}
                    </td>
                    <td style={S.td}>
                      <button onClick={() => { const { meta: m } = parseMeta(q.notas); setQf({ ...q, items: Array.isArray(q.items) ? q.items : [], logo_url: m.logo_url || '', iva_mode: m.iva_mode || (q.iva_incluido ? 'suma' : 'sin') }); setShowDrawer(true); }} style={S.btnSmall}>Editar</button>
                      <a href={`/cotizacion/${q.id}`} target="_blank" rel="noopener" style={{ ...S.btnSmall, textDecoration: 'none', display: 'inline-flex' }}>Ver</a>
                      <button onClick={() => duplicateQuote(q)} style={S.btnSmall}>Duplicar</button>
                      <button onClick={() => { navigator.clipboard.writeText(`https://www.sacscloud.com/cotizacion/${q.id}`); const btn = document.activeElement as HTMLButtonElement; btn.textContent = 'Copiado'; setTimeout(() => { btn.textContent = 'Copiar'; }, 1500); }} style={{ ...S.btnSmall, background: '#f3e8ff', color: '#7c3aed' }}>Copiar</button>
                      <a href={`https://wa.me/?text=${encodeURIComponent(`Cotización ${q.numero}: https://www.sacscloud.com/cotizacion/${q.id}`)}`} target="_blank" rel="noopener" style={{ ...S.btnSmall, background: '#e8f5e9', color: '#2e7d32', textDecoration: 'none', display: 'inline-flex' }}>WA</a>
                      <a href={`mailto:${q.email || ''}?subject=${encodeURIComponent(`Cotización ${q.numero} - Sacs`)}&body=${encodeURIComponent(`Hola ${q.contacto || ''},\n\nTe comparto tu cotización:\nhttps://www.sacscloud.com/cotizacion/${q.id}\n\nQuedo al pendiente.\nSaludos`)}`} style={{ ...S.btnSmall, background: '#e3f2fd', color: '#1565c0', textDecoration: 'none', display: 'inline-flex' }}>Email</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 0', borderTop: '1px solid #f0f0f0', marginTop: 4 }}>
              <span style={{ fontSize: '0.6875rem', color: '#999' }}>
                {safePage * PER_PAGE + 1}–{Math.min((safePage + 1) * PER_PAGE, filtered.length)} de {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button disabled={safePage === 0} onClick={() => setQPage(0)} style={{ ...S.btnSmall, opacity: safePage === 0 ? 0.3 : 1 }}>«</button>
                <button disabled={safePage === 0} onClick={() => setQPage(safePage - 1)} style={{ ...S.btnSmall, opacity: safePage === 0 ? 0.3 : 1 }}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} onClick={() => setQPage(i)} style={{ ...S.btnSmall, background: i === safePage ? '#1a1a1a' : '#fafafa', color: i === safePage ? '#fff' : '#666', borderColor: i === safePage ? '#1a1a1a' : '#e0e0e0', minWidth: 28, justifyContent: 'center' as const, display: 'inline-flex' }}>{i + 1}</button>
                ))}
                <button disabled={safePage >= totalPages - 1} onClick={() => setQPage(safePage + 1)} style={{ ...S.btnSmall, opacity: safePage >= totalPages - 1 ? 0.3 : 1 }}>›</button>
                <button disabled={safePage >= totalPages - 1} onClick={() => setQPage(totalPages - 1)} style={{ ...S.btnSmall, opacity: safePage >= totalPages - 1 ? 0.3 : 1 }}>»</button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Quote Drawer ─── */}
        {showDrawer && (
          <div style={{ position: 'fixed' as const, inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={() => setShowDrawer(false)} style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />
            <div style={{ width: 520, maxWidth: '95vw', background: '#fff', overflowY: 'auto' as const, boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>{qf.id ? `Editar ${qf.numero || 'cotización'}` : 'Nueva cotización'}</h3>
                <button onClick={() => setShowDrawer(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>

              {/* Client */}
              <div style={S.label}>Cliente</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input value={qf.empresa || ''} onChange={e => setQf({ ...qf, empresa: e.target.value })} placeholder="Empresa" style={S.input} />
                <input value={qf.contacto || ''} onChange={e => setQf({ ...qf, contacto: e.target.value })} placeholder="Contacto" style={S.input} />
                <input value={qf.email || ''} onChange={e => setQf({ ...qf, email: e.target.value })} placeholder="Email" style={S.input} />
                <input value={qf.whatsapp || ''} onChange={e => setQf({ ...qf, whatsapp: e.target.value })} placeholder="WhatsApp" style={S.input} />
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
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>{item.nombre}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 8 }}>{item.descripcion}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: '0.75rem', color: '#999' }}>Valor original:</span>
                        <span style={{ textDecoration: 'line-through', color: '#ccc', fontWeight: 600 }}>{fmt(item.precio_original || 0)}</span>
                        <span style={{ fontSize: '1.125rem', fontWeight: 800, color: '#2AB5A0' }}>$0</span>
                      </div>
                      <input value={item.nota || ''} onChange={e => updateItem(idx, 'nota', e.target.value)} placeholder="Nota (opcional)" style={{ ...S.input, fontSize: '0.6875rem' }} />
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Concepto</label><input value={item.nombre || ''} onChange={e => updateItem(idx, 'nombre', e.target.value)} placeholder="Ej. Implementación" style={S.input} /></div>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Monto</label><input type="number" value={item.monto || ''} onChange={e => updateItem(idx, 'monto', e.target.value)} style={S.input} /></div>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Descripción</label><input value={item.descripcion || ''} onChange={e => updateItem(idx, 'descripcion', e.target.value)} style={S.input} /></div>
                        <div><label style={{ ...S.label, marginTop: 0 }}>Recurrente</label><select value={item.recurrente ? 'si' : 'no'} onChange={e => updateItem(idx, 'recurrente', e.target.value === 'si')} style={S.input}><option value="no">No (único)</option><option value="si">Sí (mensual)</option></select></div>
                      </div>
                      <div style={{ marginTop: 6 }}><input value={item.nota || ''} onChange={e => updateItem(idx, 'nota', e.target.value)} placeholder="Nota (opcional)" style={{ ...S.input, fontSize: '0.6875rem' }} /></div>
                    </div>
                  )}
                  {!item.es_promocion && <div style={{ textAlign: 'right' as const, fontSize: '0.875rem', fontWeight: 700, color: '#2AB5A0', marginTop: 6 }}>{fmt(item.subtotal || item.monto || 0)}</div>}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                <button onClick={addPlanItem} style={{ ...S.btnSmall, flex: 1 }}>+ Plan Sacs</button>
                <button onClick={addExtraItem} style={{ ...S.btnSmall, flex: 1 }}>+ Concepto extra</button>
                <button onClick={() => {
                  const mainPlan = items.find((i: any) => i.tipo === 'plan')?.nombre || 'controla';
                  const precio = IMPL_PRICES[mainPlan] || 4000;
                  setQf({ ...qf, items: [...items, { tipo: 'extra', nombre: 'Implementacion y configuracion', descripcion: 'Setup inicial, migracion de datos y capacitacion', monto: 0, precio_original: precio, es_promocion: true, recurrente: false, subtotal: 0 }] });
                }} style={{ ...S.btnSmall, flex: 1, background: '#e8f5e9', color: '#2e7d32' }}>+ Promocion</button>
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

              <div><label style={S.label}>Condiciones</label><textarea value={qf.condiciones || ''} onChange={e => setQf({ ...qf, condiciones: e.target.value })} style={{ ...S.input, height: 60 }} /></div>

              {/* Timeline */}
              {qf.id && (() => {
                const { meta } = parseMeta(qf.notas);
                const timeline = meta.timeline || [];
                const views = meta.views || 0;
                const eventLabels: Record<string, string> = { created: 'Creada', sent: 'Enviada', viewed: 'Vista', accepted: 'Aceptada', paid: 'Pagada', comment: 'Comentario', reply: 'Respuesta' };
                const eventColors: Record<string, string> = { created: '#999', sent: '#4B7BE5', viewed: '#6C5CE7', accepted: '#2AB5A0', paid: '#2e7d32', comment: '#E8A838', reply: '#4B7BE5' };
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

              <button onClick={createQuote} disabled={saving || !items.length || !qf.empresa} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', width: '100%', marginTop: 16, justifyContent: 'center' }}>{saving ? 'Guardando...' : qf.id ? 'Guardar cambios' : 'Crear y enviar cotización'}</button>
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

      {/* Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px' }}>
        {tab === 'dashboard' && <DashboardView />}
        {tab === 'clientes' && <ClientsView />}
        {tab === 'pagos' && <PaymentsView />}
        {tab === 'cotizaciones' && <QuotesView />}
        {tab === 'config' && (
          <div>
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
