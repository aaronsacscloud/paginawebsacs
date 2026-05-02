import { useEffect, useState } from 'react';

interface Invitation {
  id: string;
  numero?: string;
  tipo: string;
  nombre: string;
  email?: string;
  whatsapp?: string;
  empresa?: string;
  comision_pct?: number;
  costo_unico?: number;
  costo_mensual?: number;
  moneda?: string;
  vigencia?: string;
  estado: string;
  template?: string;
  slug_landing?: string;
  beneficios?: any[];
  compromisos?: any[];
  tabulador?: any;
  terminos?: string;
  aceptado_por?: string;
  aceptado_fecha?: string;
  decline_motivo?: string;
  created_at?: string;
}

const TIPO_LABELS: Record<string, { label: string; tagline: string; color: string }> = {
  embajador:    { label: 'Embajador', tagline: 'Free + 50% comisión + 3-4 videos/mes', color: '#4B7BE5' },
  distribuidor: { label: 'Distribuidor', tagline: 'Cuota única + comisión recurrente', color: '#6C5CE7' },
  integrador:   { label: 'Integrador', tagline: 'B2B · implementación técnica', color: '#2AB5A0' },
  reseller:     { label: 'Reseller', tagline: 'White-label / canal indirecto', color: '#E8A838' },
  consultor:    { label: 'Consultor', tagline: 'Asesoría especializada', color: '#E54B4B' },
};

const ESTADO_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Borrador',  color: '#666',    bg: '#f5f5f5' },
  sent:     { label: 'Enviada',   color: '#3764c4', bg: 'rgba(75,123,229,0.1)' },
  viewed:   { label: 'Vista',     color: '#7a4ed3', bg: 'rgba(108,92,231,0.10)' },
  accepted: { label: 'Aceptada',  color: '#1e8471', bg: 'rgba(42,181,160,0.12)' },
  declined: { label: 'Rechazada', color: '#b93333', bg: 'rgba(229,75,75,0.10)' },
  expired:  { label: 'Vencida',   color: '#999',    bg: 'rgba(153,153,153,0.10)' },
};

const fmt = (n?: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string) => {
  if (!d) return '';
  const date = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
};

export default function PartnersTab() {
  const [list, setList] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<string>('');
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Invitation | null>(null);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterEstado) params.set('estado', filterEstado);
      if (filterTipo) params.set('tipo', filterTipo);
      const url = '/api/partners/invitations' + (params.toString() ? `?${params}` : '');
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar');
      setList(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterEstado, filterTipo]);

  const filtered = list.filter(it => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [it.nombre, it.email, it.empresa, it.numero].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
  });

  // Stats
  const stats = {
    total: list.length,
    sent: list.filter(i => i.estado === 'sent' || i.estado === 'viewed').length,
    accepted: list.filter(i => i.estado === 'accepted').length,
    declined: list.filter(i => i.estado === 'declined').length,
  };
  const conversionPct = stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0;

  function copyLink(id: string) {
    const url = `${window.location.origin}/partners/invitacion/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copiado:\n' + url);
    });
  }

  async function markAsSent(it: Invitation) {
    try {
      const res = await fetch('/api/partners/invitations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: it.id, estado: 'sent' }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Error');
      }
      load();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f5f6f8' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#4B7BE5', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Programa Partners</div>
          <h1 style={{ margin: 0, fontFamily: 'Clash Display, sans-serif', fontSize: '1.75rem', fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.015em' }}>
            Invitaciones a partners
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: '#666', maxWidth: 540 }}>
            Crea propuestas de embajadores, distribuidores e integradores. Cada invitación se firma con su link público y al aceptar genera el partner en SACS.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowCreate(true); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 20px',
            background: '#1a1a1a', color: '#fff',
            border: 'none', borderRadius: 10,
            fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.15s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#4B7BE5')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Nueva invitación
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Invitaciones totales" value={stats.total.toString()} />
        <StatCard label="Pendientes" value={stats.sent.toString()} accent="#4B7BE5" />
        <StatCard label="Aceptadas" value={stats.accepted.toString()} accent="#2AB5A0" />
        <StatCard label="Conversión" value={`${conversionPct}%`} accent="#6C5CE7" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email, folio..."
          style={{ flex: 1, minWidth: 200, padding: '10px 14px', fontSize: '0.8125rem', border: '1px solid #e5e5e5', borderRadius: 10, background: '#fff', outline: 'none' }}
        />
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} style={selectStyle}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABELS).map(([v, info]) => <option key={v} value={v}>{info.label}</option>)}
        </select>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} style={selectStyle}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_LABELS).map(([v, info]) => <option key={v} value={v}>{info.label}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ padding: 14, background: 'rgba(229,75,75,0.08)', border: '1px solid rgba(229,75,75,0.25)', color: '#b93333', borderRadius: 10, marginBottom: 16, fontSize: '0.8125rem' }}>
          {error}
        </div>
      )}

      {/* List */}
      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#999', fontSize: '0.875rem' }}>Cargando invitaciones...</div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e5e5' }}>
                <th style={thStyle}>Folio</th>
                <th style={thStyle}>Prospecto</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Comisión</th>
                <th style={thStyle}>Vigencia</th>
                <th style={thStyle}>Estado</th>
                <th style={{ ...thStyle, textAlign: 'right' as const }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(it => {
                const tipoInfo = TIPO_LABELS[it.tipo] || { label: it.tipo, color: '#999', tagline: '' };
                const estadoInfo = ESTADO_LABELS[it.estado] || ESTADO_LABELS.draft;
                return (
                  <tr key={it.id} style={{ borderBottom: '1px solid #f0f0f0', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <td style={tdStyle}><span style={{ fontWeight: 700, color: '#1a1a1a' }}>{it.numero || '—'}</span></td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{it.nombre}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#999', marginTop: 2 }}>
                        {[it.email, it.empresa].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px',
                        background: tipoInfo.color + '15',
                        color: tipoInfo.color,
                        borderRadius: 999,
                        fontSize: '0.6875rem', fontWeight: 600,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}>{tipoInfo.label}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{Number(it.comision_pct ?? 0)}%</span>
                      {Number(it.costo_unico ?? 0) > 0 && (
                        <div style={{ fontSize: '0.6875rem', color: '#999' }}>+ {fmt(it.costo_unico)} cuota</div>
                      )}
                      {Number(it.costo_mensual ?? 0) > 0 && (
                        <div style={{ fontSize: '0.6875rem', color: '#999' }}>+ {fmt(it.costo_mensual)}/mes</div>
                      )}
                    </td>
                    <td style={tdStyle}>{fmtDate(it.vigencia)}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px',
                        background: estadoInfo.bg, color: estadoInfo.color,
                        borderRadius: 999,
                        fontSize: '0.6875rem', fontWeight: 700,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}>{estadoInfo.label}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' as const }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <a href={`/partners/invitacion/${it.id}?admin=1`} target="_blank" rel="noopener" style={btnSm()}>Ver</a>
                        <button style={btnSm()} onClick={() => copyLink(it.id)}>Link</button>
                        <button style={btnSm()} onClick={() => { setEditing(it); setShowCreate(true); }}>Editar</button>
                        {it.estado === 'draft' && (
                          <button style={btnSm('#1a1a1a', '#fff')} onClick={() => markAsSent(it)}>Enviar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateDrawer
          editing={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: '0.8125rem',
  border: '1px solid #e5e5e5',
  borderRadius: 10,
  background: '#fff',
  outline: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const thStyle: React.CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left' as const,
  fontSize: '0.625rem',
  fontWeight: 700,
  color: '#999',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  color: '#555',
  verticalAlign: 'middle' as const,
};

function btnSm(bg = '#fff', color = '#1a1a1a'): React.CSSProperties {
  return {
    padding: '6px 12px',
    fontSize: '0.6875rem',
    fontWeight: 600,
    background: bg,
    color,
    border: bg === '#fff' ? '1px solid #e5e5e5' : 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  };
}

function StatCard({ label, value, accent = '#1a1a1a' }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{
      padding: 18,
      background: '#fff',
      border: '1px solid #e5e5e5',
      borderRadius: 12,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '1.75rem', fontWeight: 300, color: accent, letterSpacing: '-0.025em', lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 56, height: 56,
        background: 'rgba(75,123,229,0.10)',
        color: '#4B7BE5',
        borderRadius: 16,
        marginBottom: 18,
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
      </div>
      <div style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '1.25rem', fontWeight: 500, color: '#1a1a1a', marginBottom: 8, letterSpacing: '-0.01em' }}>
        Sin invitaciones todavía
      </div>
      <div style={{ fontSize: '0.875rem', color: '#666', maxWidth: 380, margin: '0 auto 20px', lineHeight: 1.55 }}>
        Crea tu primera invitación para invitar a embajadores, distribuidores o integradores al programa SACS.
      </div>
      <button
        onClick={onCreate}
        style={{
          padding: '12px 22px',
          background: '#1a1a1a', color: '#fff',
          border: 'none', borderRadius: 10,
          fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600,
          cursor: 'pointer',
        }}
      >Crear primera invitación</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Drawer: create / edit invitation
// ─────────────────────────────────────────────────────────────────

interface DrawerProps {
  editing: Invitation | null;
  onClose: () => void;
  onSaved: () => void;
}

function CreateDrawer({ editing, onClose, onSaved }: DrawerProps) {
  const [form, setForm] = useState<any>(() => ({
    tipo: editing?.tipo || 'embajador',
    nombre: editing?.nombre || '',
    email: editing?.email || '',
    whatsapp: editing?.whatsapp || '',
    empresa: editing?.empresa || '',
    comision_pct: editing?.comision_pct ?? 50,
    costo_unico: editing?.costo_unico ?? 0,
    costo_mensual: editing?.costo_mensual ?? 0,
    moneda: editing?.moneda || 'MXN',
    vigencia: editing?.vigencia || (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })(),
    template: editing?.template || 'modern',
    slug_landing: editing?.slug_landing || '',
    beneficios: editing?.beneficios || [],
    compromisos: editing?.compromisos || [],
    tabulador: editing?.tabulador || { demo_agendada: 200, demo_completada: 500, venta_directa_pct: 50, moneda: 'MXN' },
    terminos: editing?.terminos || '',
  }));
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // When tipo changes (and not editing), pre-fill defaults
  function setTipo(tipo: string) {
    if (editing) { setForm((p: any) => ({ ...p, tipo })); return; }
    const defaults: Record<string, any> = {
      embajador: {
        comision_pct: 50, costo_unico: 0, costo_mensual: 0,
        beneficios: [
          { icon: 'gift', title: 'Sistema SACS gratis', detail: 'Acceso completo al SaaS sin costo durante el programa.' },
          { icon: 'percent', title: '50% de comisión', detail: 'Sobre cada venta directa generada con tu link.' },
          { icon: 'academy', title: 'Capacitación premium', detail: 'Academia SACS, demos grabadas y soporte directo.' },
          { icon: 'community', title: 'Comunidad de embajadores', detail: 'Networking, sesiones mensuales y mentoría.' },
          { icon: 'reward', title: 'Recompensas por demo', detail: 'Bonos por demos agendadas y completadas.' },
        ],
        compromisos: [
          { title: 'Crear contenido', detail: 'Publica de 3 a 4 videos al mes sobre SACS en tus redes.', frequency: 'Mensual' },
          { title: 'Mantener nivel', detail: 'Cumple con la cuota de contenido para conservar acceso gratis y la comisión del 50%.', frequency: 'Continuo' },
          { title: 'Asistir a kick-off', detail: 'Sesión de onboarding de 60 min para aprender el modelo y materiales.', frequency: 'Una vez' },
        ],
        tabulador: { demo_agendada: 200, demo_completada: 500, venta_directa_pct: 50, moneda: 'MXN', notas: 'Pagos mensuales. Demo agendada al confirmarse; demo completada al cierre del demo válido.' },
        terminos: 'Programa de embajadores sujeto a cumplimiento de compromisos de contenido. Pagos mensuales vía transferencia.',
      },
      distribuidor: {
        comision_pct: 30, costo_unico: 5000, costo_mensual: 0,
        beneficios: [
          { icon: 'percent', title: '30% comisión recurrente', detail: 'Sobre el MRR del cliente mientras esté activo.' },
          { icon: 'academy', title: 'Certificación oficial', detail: 'Academia + examen + directorio de partners.' },
          { icon: 'leads', title: 'Leads asignados', detail: 'Oportunidades calificadas por zona o vertical.' },
        ],
        compromisos: [
          { title: 'Vender', detail: 'Mínimo 2 nuevos clientes por trimestre.', frequency: 'Trimestral' },
          { title: 'Implementar', detail: 'Acompañar al cliente las primeras 4 semanas.', frequency: 'Por cliente' },
        ],
        tabulador: { demo_agendada: 0, demo_completada: 300, venta_directa_pct: 30, moneda: 'MXN' },
        terminos: 'Cuota única de certificación. Comisión recurrente sobre MRR cobrado mientras el cliente esté al corriente.',
      },
      integrador: {
        comision_pct: 25, costo_unico: 0, costo_mensual: 0,
        beneficios: [
          { icon: 'percent', title: '25% sobre implementación', detail: 'Comisión sobre fees de implementación cobrados.' },
          { icon: 'academy', title: 'Acceso técnico', detail: 'Documentación API, ambientes sandbox y soporte L2.' },
        ],
        compromisos: [
          { title: 'Certificarse técnicamente', detail: 'Pasar la certificación SACS Integrator.', frequency: 'Una vez' },
        ],
        tabulador: { demo_agendada: 0, demo_completada: 0, venta_directa_pct: 25, moneda: 'MXN' },
        terminos: 'Programa para casas de software e integradores B2B.',
      },
      reseller: {
        comision_pct: 20, costo_unico: 10000, costo_mensual: 0,
        beneficios: [
          { icon: 'percent', title: '20% comisión recurrente', detail: 'Sobre el MRR de cada cliente que cierres.' },
        ],
        compromisos: [
          { title: 'Vender bajo tu marca', detail: 'Manejo de la relación comercial bajo tu canal.', frequency: 'Continuo' },
        ],
        tabulador: { demo_agendada: 0, demo_completada: 0, venta_directa_pct: 20, moneda: 'MXN' },
        terminos: 'Programa de reventa con white-labeling sujeto a aprobación.',
      },
      consultor: {
        comision_pct: 15, costo_unico: 0, costo_mensual: 0,
        beneficios: [
          { icon: 'percent', title: '15% por referido', detail: 'Sobre la primera anualidad cobrada al cliente.' },
        ],
        compromisos: [
          { title: 'Recomendar SACS', detail: 'Cuando aplique al diagnóstico del cliente.', frequency: 'Por caso' },
        ],
        tabulador: { demo_agendada: 0, demo_completada: 0, venta_directa_pct: 15, moneda: 'MXN' },
        terminos: 'Programa de consultoría con referidos pagados a 30 días post-cobro.',
      },
    };
    setForm((p: any) => ({ ...p, tipo, ...(defaults[tipo] || {}) }));
  }

  async function save() {
    if (!form.nombre.trim()) { setErrMsg('El nombre del prospecto es obligatorio'); return; }
    setSaving(true); setErrMsg(null);
    try {
      const method = editing ? 'PUT' : 'POST';
      const body = editing ? { id: editing.id, ...form } : form;
      const res = await fetch('/api/partners/invitations', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      onSaved();
    } catch (err: any) {
      setErrMsg(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  function set<K extends string>(key: K, v: any) { setForm((p: any) => ({ ...p, [key]: v })); }
  function setTab(key: string, v: any) {
    setForm((p: any) => ({ ...p, tabulador: { ...(p.tabulador || {}), [key]: v } }));
  }

  function addBenefit() {
    setForm((p: any) => ({ ...p, beneficios: [...(p.beneficios || []), { icon: 'default', title: '', detail: '' }] }));
  }
  function removeBenefit(i: number) {
    setForm((p: any) => ({ ...p, beneficios: (p.beneficios || []).filter((_: any, idx: number) => idx !== i) }));
  }
  function updateBenefit(i: number, key: string, v: string) {
    setForm((p: any) => ({
      ...p,
      beneficios: (p.beneficios || []).map((b: any, idx: number) => idx === i ? { ...b, [key]: v } : b),
    }));
  }

  function addCompromiso() {
    setForm((p: any) => ({ ...p, compromisos: [...(p.compromisos || []), { title: '', detail: '', frequency: '' }] }));
  }
  function removeCompromiso(i: number) {
    setForm((p: any) => ({ ...p, compromisos: (p.compromisos || []).filter((_: any, idx: number) => idx !== i) }));
  }
  function updateCompromiso(i: number, key: string, v: string) {
    setForm((p: any) => ({
      ...p,
      compromisos: (p.compromisos || []).map((c: any, idx: number) => idx === i ? { ...c, [key]: v } : c),
    }));
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div style={{
        width: '100%', maxWidth: 720,
        background: '#fff',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 48px rgba(0,0,0,0.15)',
      }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#4B7BE5', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              {editing ? 'Editar invitación' : 'Nueva invitación'}
            </div>
            <div style={{ fontFamily: 'Clash Display, sans-serif', fontSize: '1.375rem', fontWeight: 500, color: '#1a1a1a', marginTop: 4, letterSpacing: '-0.01em' }}>
              Programa Partners SACS
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', color: '#999', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          {errMsg && (
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(229,75,75,0.08)', color: '#b93333', borderRadius: 8, fontSize: '0.8125rem' }}>
              {errMsg}
            </div>
          )}

          {/* Tipo */}
          <Section title="Tipo de partner">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {Object.entries(TIPO_LABELS).map(([v, info]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTipo(v)}
                  style={{
                    padding: 14,
                    background: form.tipo === v ? info.color + '12' : '#fff',
                    border: '1px solid ' + (form.tipo === v ? info.color : '#e5e5e5'),
                    borderRadius: 12,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: form.tipo === v ? info.color : '#1a1a1a', marginBottom: 2 }}>
                    {info.label}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#666', lineHeight: 1.4 }}>{info.tagline}</div>
                </button>
              ))}
            </div>
          </Section>

          {/* Prospecto */}
          <Section title="Prospecto">
            <Grid2>
              <Field label="Nombre completo *" value={form.nombre} onChange={v => set('nombre', v)} placeholder="Mariana López" />
              <Field label="Empresa o marca" value={form.empresa} onChange={v => set('empresa', v)} placeholder="(opcional)" />
              <Field label="Email" type="email" value={form.email} onChange={v => set('email', v)} placeholder="tu@correo.com" />
              <Field label="WhatsApp" value={form.whatsapp} onChange={v => set('whatsapp', v)} placeholder="55 1234 5678" />
            </Grid2>
          </Section>

          {/* Términos económicos */}
          <Section title="Términos económicos">
            <Grid3>
              <Field label="Comisión %" type="number" value={form.comision_pct} onChange={v => set('comision_pct', Number(v) || 0)} />
              <Field label="Cuota única" type="number" value={form.costo_unico} onChange={v => set('costo_unico', Number(v) || 0)} />
              <Field label="Cuota mensual" type="number" value={form.costo_mensual} onChange={v => set('costo_mensual', Number(v) || 0)} />
            </Grid3>
            <Grid2>
              <Field label="Moneda" value={form.moneda} onChange={v => set('moneda', v)} />
              <Field label="Vigencia" type="date" value={form.vigencia} onChange={v => set('vigencia', v)} />
            </Grid2>
            <Field label="Slug de landing (opcional)" value={form.slug_landing} onChange={v => set('slug_landing', v)} placeholder="ej. juanperez (sacscloud.com/p/juanperez)" />
          </Section>

          {/* Beneficios */}
          <Section title="Beneficios" actions={<MiniBtn onClick={addBenefit}>+ Agregar</MiniBtn>}>
            {form.beneficios.length === 0 && <EmptyHint>Sin beneficios. Cambia el tipo de partner o agrega uno manualmente.</EmptyHint>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {form.beneficios.map((b: any, i: number) => (
                <div key={i} style={{ padding: 14, border: '1px solid #e5e5e5', borderRadius: 10, background: '#fafafa' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <select value={b.icon || 'default'} onChange={e => updateBenefit(i, 'icon', e.target.value)} style={selectStyle}>
                      {['gift', 'percent', 'academy', 'community', 'reward', 'leads', 'default'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <input value={b.title || ''} onChange={e => updateBenefit(i, 'title', e.target.value)} placeholder="Título" style={inputStyle} />
                    <button onClick={() => removeBenefit(i)} style={{ ...btnSm(), background: 'transparent', color: '#b93333', borderColor: 'rgba(229,75,75,0.3)' }}>✕</button>
                  </div>
                  <textarea value={b.detail || ''} onChange={e => updateBenefit(i, 'detail', e.target.value)} placeholder="Detalle del beneficio" rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} />
                </div>
              ))}
            </div>
          </Section>

          {/* Compromisos */}
          <Section title="Compromisos del partner" actions={<MiniBtn onClick={addCompromiso}>+ Agregar</MiniBtn>}>
            {form.compromisos.length === 0 && <EmptyHint>Sin compromisos.</EmptyHint>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {form.compromisos.map((c: any, i: number) => (
                <div key={i} style={{ padding: 14, border: '1px solid #e5e5e5', borderRadius: 10, background: '#fafafa' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input value={c.title || ''} onChange={e => updateCompromiso(i, 'title', e.target.value)} placeholder="Título (ej. Crear contenido)" style={inputStyle} />
                    <input value={c.frequency || ''} onChange={e => updateCompromiso(i, 'frequency', e.target.value)} placeholder="Frecuencia" style={{ ...inputStyle, maxWidth: 140 }} />
                    <button onClick={() => removeCompromiso(i)} style={{ ...btnSm(), background: 'transparent', color: '#b93333', borderColor: 'rgba(229,75,75,0.3)' }}>✕</button>
                  </div>
                  <textarea value={c.detail || ''} onChange={e => updateCompromiso(i, 'detail', e.target.value)} placeholder="Detalle (ej. Publicar 3-4 videos al mes)" rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} />
                </div>
              ))}
            </div>
          </Section>

          {/* Tabulador */}
          <Section title="Tabulador de recompensas">
            <Grid3>
              <Field label="Demo agendada ($)" type="number" value={form.tabulador?.demo_agendada ?? 0} onChange={v => setTab('demo_agendada', Number(v) || 0)} />
              <Field label="Demo completada ($)" type="number" value={form.tabulador?.demo_completada ?? 0} onChange={v => setTab('demo_completada', Number(v) || 0)} />
              <Field label="Venta directa (%)" type="number" value={form.tabulador?.venta_directa_pct ?? 0} onChange={v => setTab('venta_directa_pct', Number(v) || 0)} />
            </Grid3>
            <FieldArea label="Notas del tabulador" value={form.tabulador?.notas || ''} onChange={v => setTab('notas', v)} placeholder="Cómo se calculan los pagos..." />
          </Section>

          {/* Términos legales */}
          <Section title="Condiciones y términos legales">
            <FieldArea label="Términos generales" value={form.terminos} onChange={v => set('terminos', v)} placeholder="Texto legal o condiciones especiales..." rows={4} />
          </Section>

          {/* Visual */}
          <Section title="Diseño visual">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {(['modern', 'dark', 'classic'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('template', t)}
                  style={{
                    padding: 16,
                    background: form.template === t ? 'rgba(75,123,229,0.08)' : '#fff',
                    border: '1px solid ' + (form.template === t ? '#4B7BE5' : '#e5e5e5'),
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'center' as const,
                    fontFamily: 'inherit',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: form.template === t ? '#4B7BE5' : '#1a1a1a',
                    textTransform: 'capitalize' as const,
                  }}
                >{t}</button>
              ))}
            </div>
          </Section>
        </div>

        <div style={{ padding: '16px 28px', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
          <button onClick={onClose} style={{ ...btnSm(), padding: '10px 18px', fontSize: '0.8125rem' }}>Cancelar</button>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '12px 22px',
              background: saving ? '#999' : '#1a1a1a', color: '#fff',
              border: 'none', borderRadius: 10,
              fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear invitación')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Drawer helpers
// ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 12px',
  fontSize: '0.8125rem',
  border: '1px solid #e5e5e5',
  borderRadius: 8,
  background: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
  color: '#1a1a1a',
  boxSizing: 'border-box' as const,
  width: '100%',
};

function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#4B7BE5', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{title}</div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>{children}</div>;
}
function Grid3({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>{children}</div>;
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </label>
  );
}
function FieldArea({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle, resize: 'vertical' as const, minHeight: 60 }} />
    </label>
  );
}

function MiniBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px',
        fontSize: '0.6875rem', fontWeight: 600,
        background: 'rgba(75,123,229,0.10)',
        color: '#4B7BE5',
        border: 'none', borderRadius: 8,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >{children}</button>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 14, background: '#fafafa', border: '1px dashed #e5e5e5', borderRadius: 10, fontSize: '0.75rem', color: '#999', textAlign: 'center' as const }}>
      {children}
    </div>
  );
}
