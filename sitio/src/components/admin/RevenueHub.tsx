import { useState, useEffect } from 'react';

const PLANS = ['vende', 'controla', 'fideliza', 'automatiza'];
const PLAN_PRICES: Record<string, number> = { vende: 600, controla: 900, fideliza: 1400, automatiza: 2900 };
const METODOS = ['transferencia', 'tarjeta', 'oxxo', 'otro'];
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

interface Client {
  id: string; empresa: string; contacto: string; email: string; whatsapp: string;
  plan: string; sucursales: number; precio_mensual: number; metodo_pago: string;
  fecha_inicio: string; fecha_renovacion: string; estado: string; notas: string;
}

type Tab = 'dashboard' | 'clientes' | 'pagos' | 'cotizaciones';

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

  const load = async () => {
    const [d, c] = await Promise.all([
      fetch('/api/revenue/dashboard').then(r => r.json()),
      fetch('/api/revenue/clients').then(r => r.json()),
    ]);
    setDash(d);
    setClients(Array.isArray(c) ? c : []);
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
                  <div style={{ fontSize: '0.6875rem', color: '#E54B4B' }}>Venció: {c.fecha_renovacion}</div>
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
                  <div style={{ fontSize: '0.6875rem', color: '#E8A838' }}>Renueva: {c.fecha_renovacion}</div>
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
                      {c.fecha_renovacion || '-'}
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
                    <td style={S.td}>{p.fecha}</td>
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
    const ivaMonto = qf.iva_incluido ? afterDisc * 0.16 : 0;
    const grandTotal = afterDisc + ivaMonto;

    const createQuote = async () => {
      setSaving(true);
      const body = { ...qf, subtotal: itemsSubtotal, iva_monto: Math.round(ivaMonto), total: Math.round(grandTotal), estado: qf.estado || 'sent' };
      const isEdit = !!qf.id;
      await fetch('/api/revenue/quotes', { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Cotizaciones</h2>
          <button onClick={() => { setQf({ empresa: '', contacto: '', email: '', whatsapp: '', items: [], iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern', condiciones: 'Precios en MXN. Migracion incluida. Soporte 24/7. Sin contratos.' }); setShowDrawer(true); }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff' }}>+ Nueva cotización</button>
        </div>

        <div style={S.card}>
          <table style={S.table}>
            <thead><tr>{['#', 'Fecha', 'Empresa', 'Total', 'Estado', 'Template', 'Acciones'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {quotes.length === 0 && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center' as const, color: '#ccc', padding: 32 }}>Sin cotizaciones</td></tr>}
              {quotes.map((q: any) => (
                <tr key={q.id} style={S.tr}>
                  <td style={{ ...S.td, fontWeight: 700, color: '#4B7BE5' }}>{q.numero || '-'}</td>
                  <td style={S.td}>{q.created_at?.slice(0, 10)}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{q.empresa}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{fmt(q.total || 0)}</td>
                  <td style={S.td}><span style={{ ...S.badge, background: q.estado === 'accepted' ? '#e8f5e9' : q.estado === 'sent' ? '#fff3e0' : '#f5f5f5', color: q.estado === 'accepted' ? '#2e7d32' : q.estado === 'sent' ? '#e65100' : '#999' }}>{q.estado}</span></td>
                  <td style={S.td}><span style={{ fontSize: '0.625rem', color: '#999', textTransform: 'capitalize' as const }}>{q.template || 'modern'}</span></td>
                  <td style={S.td}>
                    <button onClick={() => { setQf({ ...q, items: Array.isArray(q.items) ? q.items : [] }); setShowDrawer(true); }} style={S.btnSmall}>Editar</button>
                    <a href={`/cotizacion/${q.id}`} target="_blank" rel="noopener" style={{ ...S.btnSmall, textDecoration: 'none', display: 'inline-flex' }}>Ver</a>
                    <button onClick={() => duplicateQuote(q)} style={S.btnSmall}>Duplicar</button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Cotización ${q.numero}: https://www.sacscloud.com/cotizacion/${q.id}`)}`} target="_blank" rel="noopener" style={{ ...S.btnSmall, background: '#e8f5e9', color: '#2e7d32', textDecoration: 'none', display: 'inline-flex' }}>WA</a>
                    <a href={`mailto:${q.email || ''}?subject=${encodeURIComponent(`Cotización ${q.numero} - Sacs`)}&body=${encodeURIComponent(`Hola ${q.contacto || ''},\n\nTe comparto tu cotización:\nhttps://www.sacscloud.com/cotizacion/${q.id}\n\nQuedo al pendiente.\nSaludos`)}`} style={{ ...S.btnSmall, background: '#e3f2fd', color: '#1565c0', textDecoration: 'none', display: 'inline-flex' }}>Email</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <input value={qf.empresa || ''} onChange={e => setQf({ ...qf, empresa: e.target.value })} placeholder="Empresa" style={S.input} />
                <input value={qf.contacto || ''} onChange={e => setQf({ ...qf, contacto: e.target.value })} placeholder="Contacto" style={S.input} />
                <input value={qf.email || ''} onChange={e => setQf({ ...qf, email: e.target.value })} placeholder="Email" style={S.input} />
                <input value={qf.whatsapp || ''} onChange={e => setQf({ ...qf, whatsapp: e.target.value })} placeholder="WhatsApp" style={S.input} />
              </div>

              {/* Items */}
              <div style={S.label}>Conceptos</div>
              {items.map((item: any, idx: number) => (
                <div key={idx} style={{ background: '#f8f9fb', borderRadius: 10, padding: 12, marginBottom: 8, position: 'relative' as const }}>
                  <button onClick={() => removeItem(idx)} style={{ position: 'absolute' as const, top: 8, right: 8, background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                  {item.tipo === 'plan' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div><label style={{ ...S.label, marginTop: 0 }}>Plan</label><select value={item.nombre} onChange={e => updateItem(idx, 'nombre', e.target.value)} style={S.input}>{PLANS.map(p => <option key={p} value={p}>{p} (${PLAN_PRICES[p]})</option>)}</select></div>
                      <div><label style={{ ...S.label, marginTop: 0 }}>Sucursales</label><input type="number" value={item.sucursales} onChange={e => updateItem(idx, 'sucursales', e.target.value)} style={S.input} /></div>
                      <div><label style={{ ...S.label, marginTop: 0 }}>Período</label><select value={item.periodo} onChange={e => updateItem(idx, 'periodo', e.target.value)} style={S.input}><option value="mensual">Mensual</option><option value="anual">Anual (2 meses gratis)</option></select></div>
                      <div><label style={{ ...S.label, marginTop: 0 }}>Desc. %</label><input type="number" value={item.descuento_pct || 0} onChange={e => updateItem(idx, 'descuento_pct', e.target.value)} style={S.input} /></div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
                      <div><label style={{ ...S.label, marginTop: 0 }}>Concepto</label><input value={item.nombre || ''} onChange={e => updateItem(idx, 'nombre', e.target.value)} placeholder="Ej. Implementación" style={S.input} /></div>
                      <div><label style={{ ...S.label, marginTop: 0 }}>Monto</label><input type="number" value={item.monto || ''} onChange={e => updateItem(idx, 'monto', e.target.value)} style={S.input} /></div>
                      <div><label style={{ ...S.label, marginTop: 0 }}>Descripción</label><input value={item.descripcion || ''} onChange={e => updateItem(idx, 'descripcion', e.target.value)} style={S.input} /></div>
                      <div><label style={{ ...S.label, marginTop: 0 }}>Recurrente</label><select value={item.recurrente ? 'si' : 'no'} onChange={e => updateItem(idx, 'recurrente', e.target.value === 'si')} style={S.input}><option value="no">No (único)</option><option value="si">Sí (mensual)</option></select></div>
                    </div>
                  )}
                  <div style={{ textAlign: 'right' as const, fontSize: '0.875rem', fontWeight: 700, color: '#2AB5A0', marginTop: 6 }}>{fmt(item.subtotal || item.monto || 0)}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                <button onClick={addPlanItem} style={{ ...S.btnSmall, flex: 1 }}>+ Plan Sacs</button>
                <button onClick={addExtraItem} style={{ ...S.btnSmall, flex: 1 }}>+ Concepto extra</button>
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
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', marginBottom: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={qf.iva_incluido} onChange={e => setQf({ ...qf, iva_incluido: e.target.checked })} /> Agregar IVA 16%
                </label>
                {qf.iva_incluido && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 4 }}><span>IVA</span><span>{fmt(ivaMonto)}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem', fontWeight: 800, borderTop: '2px solid #1a1a1a', paddingTop: 8, marginTop: 4 }}>
                  <span>Total</span><span style={{ color: '#2AB5A0' }}>{fmt(grandTotal)} {qf.moneda}</span>
                </div>
              </div>

              {/* Config */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div><label style={S.label}>Moneda</label><select value={qf.moneda} onChange={e => setQf({ ...qf, moneda: e.target.value })} style={S.input}><option value="MXN">MXN</option><option value="USD">USD</option></select></div>
                <div><label style={S.label}>Template</label><select value={qf.template} onChange={e => setQf({ ...qf, template: e.target.value })} style={S.input}><option value="modern">Modern</option><option value="dark">Dark</option><option value="classic">Classic</option></select></div>
              </div>
              <div><label style={S.label}>Condiciones</label><textarea value={qf.condiciones || ''} onChange={e => setQf({ ...qf, condiciones: e.target.value })} style={{ ...S.input, height: 60 }} /></div>

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
          {(['dashboard', 'clientes', 'pagos', 'cotizaciones'] as Tab[]).map(t => (
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
