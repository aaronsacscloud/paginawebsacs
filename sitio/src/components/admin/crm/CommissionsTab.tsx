import { useEffect, useMemo, useState } from 'react';

interface Commission {
  id: string;
  created_at: string;
  partner_id: string;
  tipo: 'venta_directa' | 'demo_completada' | 'prueba_gratis' | 'manual';
  status: 'pending' | 'earned' | 'paid' | 'cancelled';
  commission_amount: number;
  rate_pct?: number;
  deal_value?: number;
  deal_id?: string | null;
  booking_id?: string | null;
  contact_id?: string | null;
  earned_at?: string | null;
  paid_at?: string | null;
  payment_reference?: string | null;
  nota?: string | null;
  notes?: string | null;
  team_members?: { nombre: string; email: string } | null;
  deals?: { nombre: string; stage: string } | null;
}

const TIPO_LABEL: Record<string, string> = {
  prueba_gratis: 'Prueba gratis',
  demo_completada: 'Demo completada',
  venta_directa: 'Venta directa',
  manual: 'Ajuste manual',
};
const TIPO_COLOR: Record<string, string> = {
  prueba_gratis: '#2AB5A0',
  demo_completada: '#4B7BE5',
  venta_directa: '#6C5CE7',
  manual: '#999',
};
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  pending:   { bg: 'rgba(232,168,56,0.16)', color: '#a06600' },
  earned:    { bg: 'rgba(75,123,229,0.12)',  color: '#3764c4' },
  paid:      { bg: 'rgba(42,181,160,0.14)',  color: '#1A8F7A' },
  cancelled: { bg: 'rgba(229,75,75,0.10)',   color: '#b93333' },
};

const fmt = (n?: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—';

export default function CommissionsTab() {
  const [list, setList] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterTipo) params.set('tipo', filterTipo);
      const url = '/api/partners/commissions' + (params.toString() ? `?${params}` : '');
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setList(data.rows || []);
      setSelected(new Set());
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterStatus, filterTipo]);

  const filtered = useMemo(() => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      [c.team_members?.nombre, c.team_members?.email, c.nota, c.notes, c.deals?.nombre]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    );
  }, [list, search]);

  const stats = useMemo(() => {
    const sumBy = (s: string) => list.filter(c => c.status === s).reduce((a, c) => a + Number(c.commission_amount || 0), 0);
    return {
      pending: sumBy('pending'),
      earned: sumBy('earned'),
      paid: sumBy('paid'),
      countPending: list.filter(c => c.status === 'pending').length,
      countEarned: list.filter(c => c.status === 'earned').length,
    };
  }, [list]);

  // Selection helpers
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const selectedRows = useMemo(() => filtered.filter(c => selected.has(c.id)), [filtered, selected]);
  const selectedSum = selectedRows.reduce((a, c) => a + Number(c.commission_amount || 0), 0);
  const selectedPartners = new Set(selectedRows.map(c => c.partner_id));
  const canBulkPay = selectedRows.length > 0 && selectedRows.every(c => c.status === 'earned') && selectedPartners.size === 1;

  // Actions
  async function postAction(action: string, body: any) {
    const res = await fetch('/api/partners/commissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
  }

  async function approveEarned(c: Commission) {
    if (!confirm(`Aprobar bono pending → earned para ${c.team_members?.nombre} (${fmt(c.commission_amount)})?\n\nEsto manda email al partner notificando que su bono fue verificado.`)) return;
    try {
      await postAction('earned', { commission_id: c.id });
      load();
    } catch (e: any) { alert('Error: ' + e.message); }
  }

  async function cancelOne(c: Commission) {
    const reason = prompt(`Motivo de cancelación (visible en notas):`, '');
    if (reason === null) return;
    try {
      await postAction('cancel', { commission_id: c.id, reason });
      load();
    } catch (e: any) { alert('Error: ' + e.message); }
  }

  async function flagFraud(c: Commission) {
    const ok = confirm(`Marcar como FRAUDE el bono de ${c.team_members?.nombre} (${fmt(c.commission_amount)})?\n\nLa commission se cancela con motivo='fraud:...' para audit trail.\nEl partner NO recibirá email (silente).\n\nUsa esto para leads inválidos, registros de prueba que el partner generó él mismo, etc.`);
    if (!ok) return;
    const detail = prompt('Detalle del fraude (queda en notas, solo admin lo ve):', 'Lead inválido / registro auto-generado por el partner');
    if (detail === null) return;
    try {
      await postAction('cancel', { commission_id: c.id, reason: `fraud: ${detail}` });
      load();
    } catch (e: any) { alert('Error: ' + e.message); }
  }

  async function payOne(c: Commission) {
    const ref = prompt(`Referencia de pago (transferencia/folio):`, `MX-${new Date().toISOString().slice(0, 10)}`);
    if (!ref) return;
    try {
      await postAction('paid', { commission_id: c.id, payment_reference: ref });
      load();
    } catch (e: any) { alert('Error: ' + e.message); }
  }

  async function payBulk() {
    if (!canBulkPay) {
      alert('Selecciona varias commissions earned del MISMO partner para pagar en bulk.');
      return;
    }
    const ref = prompt(`Referencia de payout para ${selectedRows.length} comisiones (${fmt(selectedSum)}):`, `MX-${new Date().toISOString().slice(0, 10)}`);
    if (!ref) return;
    try {
      const data = await postAction('paid_bulk', { commission_ids: selectedRows.map(c => c.id), payment_reference: ref });
      alert(`✓ ${data.count} comisiones marcadas como pagadas (${fmt(data.total)}). Email enviado al partner.`);
      load();
    } catch (e: any) { alert('Error: ' + e.message); }
  }

  function exportCSV() {
    const header = ['Fecha', 'Partner', 'Email', 'Tipo', 'Status', 'Monto', 'Referencia', 'Nota'];
    const rows = filtered.map(c => [
      fmtDate(c.created_at),
      c.team_members?.nombre || '',
      c.team_members?.email || '',
      TIPO_LABEL[c.tipo] || c.tipo,
      c.status,
      Number(c.commission_amount || 0).toFixed(2),
      c.payment_reference || '',
      (c.nota || c.notes || '').replace(/[\n\r]+/g, ' '),
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f5f6f8' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#4B7BE5', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Comisiones partner</div>
        <h1 style={{ margin: 0, fontFamily: 'Clash Display, sans-serif', fontSize: '1.75rem', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.015em' }}>Bonos y pagos</h1>
        <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: '#666', maxWidth: 600 }}>
          Revisa, aprueba y paga las comisiones de tus partners. Selecciona varias del mismo partner para hacer un payout único.
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Stat label="Por aprobar" value={fmt(stats.pending)} sub={`${stats.countPending} bonos`} accent="#E8A838" />
        <Stat label="Por pagar" value={fmt(stats.earned)} sub={`${stats.countEarned} comisiones`} accent="#4B7BE5" />
        <Stat label="Pagado" value={fmt(stats.paid)} accent="#2AB5A0" />
        <Stat label="Total registros" value={String(list.length)} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="">Todos los estados</option>
          <option value="pending">Pending (por aprobar)</option>
          <option value="earned">Earned (por pagar)</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} style={selectStyle}>
          <option value="">Todos los tipos</option>
          <option value="prueba_gratis">Prueba gratis</option>
          <option value="demo_completada">Demo completada</option>
          <option value="venta_directa">Venta directa</option>
          <option value="manual">Manual</option>
        </select>
        <input
          type="text" placeholder="Buscar por partner, email, nota…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...selectStyle, flex: 1, minWidth: 220 }}
        />
        <button onClick={exportCSV} style={btn()}>↓ CSV</button>
        {selectedRows.length > 0 && (
          <button onClick={payBulk} disabled={!canBulkPay} style={{ ...btn('#2AB5A0', '#fff'), opacity: canBulkPay ? 1 : 0.5 }}
            title={canBulkPay ? '' : 'Solo earned del mismo partner'}>
            Pagar {selectedRows.length} ({fmt(selectedSum)})
          </button>
        )}
      </div>

      {error && <div style={{ padding: 16, background: 'rgba(229,75,75,0.10)', color: '#b93333', borderRadius: 8, marginBottom: 16 }}>{error}</div>}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ececec', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#888' }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#888' }}>Sin comisiones que coincidan.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={th}><input type="checkbox" onChange={e => setSelected(e.target.checked ? new Set(filtered.map(c => c.id)) : new Set())} /></th>
                <th style={th}>Fecha</th>
                <th style={th}>Partner</th>
                <th style={th}>Tipo</th>
                <th style={th}>Concepto</th>
                <th style={{ ...th, textAlign: 'right' as const }}>Monto</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' as const }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const sc = STATUS_COLOR[c.status] || { bg: '#f5f5f5', color: '#666' };
                const tc = TIPO_COLOR[c.tipo] || '#999';
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={td}><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} disabled={c.status !== 'earned'} /></td>
                    <td style={{ ...td, color: '#888', fontSize: 12 }}>{fmtDate(c.created_at)}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{c.team_members?.nombre || '—'}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{c.team_members?.email}</div>
                    </td>
                    <td style={td}>
                      <span style={{ ...badge, background: tc + '22', color: tc }}>{TIPO_LABEL[c.tipo] || c.tipo}</span>
                    </td>
                    <td style={td}>
                      <div style={{ maxWidth: 280, fontSize: 13, color: '#444' }}>{c.deals?.nombre || c.nota || c.notes || '—'}</div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' as const, fontWeight: 700 }}>{fmt(c.commission_amount)}</td>
                    <td style={td}><span style={{ ...badge, background: sc.bg, color: sc.color }}>{c.status}</span></td>
                    <td style={{ ...td, textAlign: 'right' as const }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        {c.status === 'pending' && <button style={btn('#2AB5A0', '#fff')} onClick={() => approveEarned(c)}>Aprobar</button>}
                        {c.status === 'earned' && <button style={btn('#1a1a1a', '#fff')} onClick={() => payOne(c)}>Pagar</button>}
                        {(c.status === 'pending' || c.status === 'earned') && <button style={btn()} onClick={() => cancelOne(c)}>Cancelar</button>}
                        {(c.status === 'pending' || c.status === 'earned') && <button style={btn('#FFE5E5', '#b93333')} onClick={() => flagFraud(c)} title="Marcar como fraude (cancela silente con audit trail)">⚠ Fraude</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #ececec', borderLeft: accent ? `3px solid ${accent}` : '1px solid #ececec' }}>
      <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'Clash Display, Sora, sans-serif', fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: '0.8125rem', border: '1px solid #e5e5e5',
  borderRadius: 8, background: '#fff', outline: 'none', fontFamily: 'inherit',
};
const th: React.CSSProperties = { textAlign: 'left', padding: '12px 14px', fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #ececec' };
const td: React.CSSProperties = { padding: '12px 14px', verticalAlign: 'top' };
const badge: React.CSSProperties = { display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' };

function btn(bg = '#fff', color = '#1a1a1a'): React.CSSProperties {
  return {
    padding: '6px 12px',
    fontSize: '0.75rem',
    fontWeight: 600,
    border: bg === '#fff' ? '1px solid #e0e0e0' : 'none',
    borderRadius: 6,
    background: bg,
    color,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}
