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
  team_member_id?: string;
  fideliza_account_at?: string;
  view_count?: number;
  first_viewed_at?: string;
  last_viewed_at?: string;
}

const TIPO_LABELS: Record<string, { label: string; tagline: string; color: string }> = {
  embajador:    { label: 'Embajador', tagline: 'Free + 50% comisión + 3-4 videos/mes', color: '#4B7BE5' },
  distribuidor: { label: 'Distribuidor', tagline: 'Cuota única + comisión recurrente', color: '#6C5CE7' },
  integrador:   { label: 'Integrador', tagline: 'B2B · implementación técnica', color: '#2AB5A0' },
  reseller:     { label: 'Reseller', tagline: 'White-label / canal indirecto', color: '#E8A838' },
  consultor:    { label: 'Consultor', tagline: 'Asesoría especializada', color: '#E54B4B' },
};

const ESTADO_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft:                 { label: 'Borrador',     color: '#666',    bg: '#f5f5f5' },
  sent:                  { label: 'Enviada',      color: '#3764c4', bg: 'rgba(75,123,229,0.1)' },
  viewed:                { label: 'Vista',        color: '#7a4ed3', bg: 'rgba(108,92,231,0.10)' },
  submitted_for_review:  { label: 'Por aprobar',  color: '#a06600', bg: 'rgba(232,168,56,0.16)' },
  accepted:              { label: 'Aprobada',     color: '#1e8471', bg: 'rgba(42,181,160,0.12)' },
  declined:              { label: 'Rechazada',    color: '#b93333', bg: 'rgba(229,75,75,0.10)' },
  expired:               { label: 'Vencida',      color: '#999',    bg: 'rgba(153,153,153,0.10)' },
};

const fmt = (n?: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string) => {
  if (!d) return '';
  const date = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
};
const fmtRelative = (d?: string | null) => {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return 'hace segundos';
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const days = Math.round(hr / 24);
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  const months = Math.round(days / 30);
  if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
  const years = Math.round(months / 12);
  return `hace ${years} ${years === 1 ? 'año' : 'años'}`;
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
  const [detailPartnerId, setDetailPartnerId] = useState<string | null>(null);
  const [recoverInvitation, setRecoverInvitation] = useState<Invitation | null>(null);

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
    pending: list.filter(i => i.estado === 'submitted_for_review').length,
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

  async function provisionFideliza(it: Invitation) {
    if (!(it as any).team_member_id) {
      alert('Aprueba primero al partner antes de provisionarle Fideliza.');
      return;
    }
    const ok = confirm(`Activar SACS Plan Fideliza para ${it.nombre}?\n\nAntes de hacer click:\n1. Crea su cuenta en app.sacscloud.com con plan Fideliza\n2. Ten lista la contraseña temporal para enviarla por separado\n\nEste botón:\n• Marca al partner como provisionado\n• Envía email de bienvenida con instrucciones de acceso`);
    if (!ok) return;
    const nota = prompt('Nota opcional para el partner (aparece en el email):', '') || undefined;
    try {
      const res = await fetch('/api/partners/provision-fideliza', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner_id: (it as any).team_member_id, nota }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      alert(data.already_provisioned ? 'Ya estaba provisionado.' : 'Fideliza activada. Email enviado al partner.');
      load();
    } catch (e: any) {
      alert('Error: ' + (e.message || e));
    }
  }

  async function approveInvitation(it: Invitation) {
    const ok = confirm(`Aprobar a ${it.nombre} como partner?\n\nEsto:\n• Activa la cuenta\n• Crea el team_member con rol partner\n• Envía email de bienvenida con credenciales\n\nAsegúrate de validar primero los datos de cobro y dirección.`);
    if (!ok) return;
    let nota = prompt('Nota opcional para el partner (aparece en el email de bienvenida):', '') || undefined;
    try {
      const res = await fetch('/api/partners/approve-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: it.id, nota }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al aprobar');
      alert('Partner aprobado. Email de bienvenida enviado.');
      load();
    } catch (err: any) {
      alert('Error: ' + (err.message || err));
    }
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
        <StatCard label="Enviadas / vistas" value={stats.sent.toString()} accent="#4B7BE5" />
        <StatCard label="Por aprobar" value={stats.pending.toString()} accent="#E8A838" />
        <StatCard label="Aprobadas" value={stats.accepted.toString()} accent="#2AB5A0" />
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
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e5e5' }}>
                <th style={thStyle}>Folio</th>
                <th style={thStyle}>Prospecto</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Comisión</th>
                <th style={thStyle} title="Veces que el prospecto abrió su invitación">Vistas</th>
                <th style={thStyle} title="Última vez que abrió la invitación">Última apertura</th>
                <th style={thStyle}>Vigencia</th>
                <th style={thStyle}>Estado</th>
                <th style={{ ...thStyle, textAlign: 'right' as const }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(it => {
                const tipoInfo = TIPO_LABELS[it.tipo] || { label: it.tipo, color: '#999', tagline: '' };
                const estadoInfo = ESTADO_LABELS[it.estado] || ESTADO_LABELS.draft;
                const views = Number(it.view_count || 0);
                const lastViewed = it.last_viewed_at;
                // Heat color based on engagement
                const viewsColor = views === 0 ? '#bbb'
                  : views <= 2 ? '#888'
                  : views <= 5 ? '#1A8F7A'
                  : '#4B7BE5';
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
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 700, color: viewsColor, fontSize: '0.9375rem' }}>{views}</span>
                      {views >= 5 && <span style={{ marginLeft: 6, fontSize: '0.625rem', color: '#4B7BE5', fontWeight: 700, letterSpacing: '0.06em' }}>HOT</span>}
                    </td>
                    <td style={tdStyle}>
                      {lastViewed ? (
                        <>
                          <div style={{ fontSize: '0.75rem', color: '#1a1a1a', fontWeight: 500 }}>{fmtRelative(lastViewed)}</div>
                          <div style={{ fontSize: '0.625rem', color: '#999', marginTop: 1 }}>{fmtDate(lastViewed)}</div>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#bbb', fontStyle: 'italic' }}>nunca</span>
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
                        {it.estado === 'submitted_for_review' && (
                          <button style={btnSm('#2AB5A0', '#fff')} onClick={() => approveInvitation(it)}>Aprobar</button>
                        )}
                        {it.estado === 'accepted' && (
                          <button style={btnSm('#6C5CE7', '#fff')} onClick={() => provisionFideliza(it)} title="Activar SACS Plan Fideliza para este partner">Fideliza</button>
                        )}
                        {(it.estado === 'accepted' || it.estado === 'submitted_for_review') && (
                          <button style={btnSm('#E8A838', '#fff')} onClick={() => setRecoverInvitation(it)} title="Cambiar email o reenviar link de acceso del partner">Acceso</button>
                        )}
                        {(it as any).team_member_id && (
                          <button style={btnSm()} onClick={() => setDetailPartnerId((it as any).team_member_id)} title="Ver detalle completo del partner">Detalle</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateDrawer
          editing={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); load(); }}
        />
      )}

      {detailPartnerId && (
        <PartnerDetailDrawer
          partnerId={detailPartnerId}
          onClose={() => setDetailPartnerId(null)}
        />
      )}

      {recoverInvitation && (
        <RecoverAccessModal
          invitation={recoverInvitation}
          onClose={() => setRecoverInvitation(null)}
        />
      )}
    </div>
  );
}

// ─── Partner Detail Drawer ──────────────────────────────────────
function PartnerDetailDrawer({ partnerId, onClose }: { partnerId: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/partners/detail?partner_id=${encodeURIComponent(partnerId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error); else setData(d);
        setLoading(false);
      })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [partnerId]);

  // Esc to close + body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const _fmt = (n?: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
  const _fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 720,
        height: '100vh', overflowY: 'auto',
        background: '#f5f6f8',
        boxShadow: '-12px 0 40px -12px rgba(0,0,0,0.18)',
        animation: 'slideInRight 0.25s ease-out',
      }}>
        <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #ececec', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B7BE5', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Detalle del partner</div>
            <div style={{ fontFamily: 'Clash Display, Sora, sans-serif', fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginTop: 4 }}>
              {data?.member?.nombre || 'Cargando…'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #ddd', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#666', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          {loading && <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>Cargando detalle…</div>}
          {error && <div style={{ padding: 16, background: 'rgba(229,75,75,0.10)', color: '#b93333', borderRadius: 8 }}>{error}</div>}
          {data && (
            <>
              {/* Member overview */}
              <section style={dCard}>
                <h3 style={dCardTitle}>Datos básicos</h3>
                <div style={dRow}><span style={dLabel}>Email</span><span>{data.member.email}</span></div>
                <div style={dRow}><span style={dLabel}>Rol</span><span>{data.member.rol}</span></div>
                <div style={dRow}><span style={dLabel}>Comisión</span><span>{data.member.default_commission_pct ?? 0}%</span></div>
                <div style={dRow}><span style={dLabel}>Activo</span><span>{data.member.activo ? '✓ Sí' : '✗ No'}</span></div>
                <div style={dRow}><span style={dLabel}>Último login</span><span>{_fmtDate(data.member.last_login_at)}</span></div>
                <div style={dRow}><span style={dLabel}>Fideliza activado</span><span>{data.member.fideliza_account_at ? `✓ ${_fmtDate(data.member.fideliza_account_at)}` : '— Pendiente'}</span></div>
                <div style={dRow}><span style={dLabel}>Cuenta creada</span><span>{_fmtDate(data.member.created_at)}</span></div>
              </section>

              {/* Recover access — útil cuando partner registró email mal o perdió contraseña */}
              <RecoverAccessSection memberId={data.member.id} memberEmail={data.member.email} memberName={data.member.nombre} />

              {/* Invitation */}
              {data.invitation && (
                <section style={dCard}>
                  <h3 style={dCardTitle}>Invitación</h3>
                  <div style={dRow}><span style={dLabel}>Folio</span><span>{data.invitation.numero}</span></div>
                  <div style={dRow}><span style={dLabel}>Tipo</span><span>{data.invitation.tipo}</span></div>
                  <div style={dRow}><span style={dLabel}>Estado</span><span>{data.invitation.estado}</span></div>
                  <div style={dRow}><span style={dLabel}>Slug landing</span><span style={{ fontFamily: 'monospace' }}>{data.invitation.slug_landing || '—'}</span></div>
                  <div style={dRow}><span style={dLabel}>Vigencia</span><span>{_fmtDate(data.invitation.vigencia)}</span></div>
                  <div style={dRow}><span style={dLabel}>Aceptada</span><span>{_fmtDate(data.invitation.aceptado_fecha)}</span></div>
                  {data.invitation.slug_landing && (
                    <div style={{ marginTop: 12 }}>
                      <a href={`https://www.sacscloud.com/p/${data.invitation.slug_landing}`} target="_blank" rel="noopener" style={{ fontSize: 12, color: '#4B7BE5' }}>
                        sacscloud.com/p/{data.invitation.slug_landing} ↗
                      </a>
                    </div>
                  )}
                </section>
              )}

              {/* Commissions summary */}
              <section style={dCard}>
                <h3 style={dCardTitle}>Comisiones</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                  <DetailKpi label="Pending" value={_fmt(data.summary.pending)} accent="#E8A838" />
                  <DetailKpi label="Earned" value={_fmt(data.summary.earned)} accent="#4B7BE5" />
                  <DetailKpi label="Paid" value={_fmt(data.summary.paid)} accent="#2AB5A0" />
                  <DetailKpi label="Total" value={_fmt(data.summary.total)} />
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
                  Bonos: {data.summary.countByTipo.prueba_gratis} prueba gratis · {data.summary.countByTipo.demo_completada} demos · {data.summary.countByTipo.venta_directa} ventas
                </div>
                {data.commissions.length > 0 && (
                  <div style={{ background: '#fafafa', borderRadius: 6, padding: 12, fontSize: 12, color: '#555', maxHeight: 260, overflowY: 'auto' }}>
                    {data.commissions.slice(0, 10).map((c: any) => {
                      const canFraud = c.status !== 'paid' && c.status !== 'cancelled';
                      return (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px dashed #ececec', gap: 8 }}>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span>{c.tipo} · </span>
                            <span style={{ color: c.status === 'cancelled' ? '#DC2626' : c.status === 'paid' ? '#2AB5A0' : c.status === 'earned' ? '#4B7BE5' : '#E8A838' }}>{c.status}</span>
                            <span style={{ color: '#999' }}> · {_fmtDate(c.created_at)}</span>
                          </span>
                          <strong style={{ minWidth: 70, textAlign: 'right', textDecoration: c.status === 'cancelled' ? 'line-through' : 'none', color: c.status === 'cancelled' ? '#999' : 'inherit' }}>{_fmt(c.commission_amount)}</strong>
                          {canFraud && (
                            <button
                              onClick={async () => {
                                const reason = window.prompt(`Marcar como fraude esta comisión de ${_fmt(c.commission_amount)} (${c.tipo})?\n\nMotivo (queda en audit trail):`, 'Lead duplicado / fake / no califica');
                                if (!reason || !reason.trim()) return;
                                try {
                                  const res = await fetch('/api/partners/commissions', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'x-user-id': 'founder' },
                                    body: JSON.stringify({ action: 'cancel', commission_id: c.id, reason: `fraud: ${reason.trim()}` }),
                                  });
                                  const json = await res.json();
                                  if (!res.ok || !json.ok) { alert(`Error: ${json.error || json.reason || 'no se pudo cancelar'}`); return; }
                                  // refresh
                                  fetch(`/api/partners/detail?partner_id=${encodeURIComponent(partnerId!)}`)
                                    .then(r => r.json()).then(d => setData(d));
                                } catch (e: any) { alert(`Error: ${e.message || e}`); }
                              }}
                              style={{ padding: '3px 8px', fontSize: 10, background: '#fff', color: '#DC2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', flexShrink: 0, fontWeight: 500 }}
                              title="Cancela esta comisión por fraude o duplicado. Queda registrado en el historial."
                            >
                              Marcar fraude
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Leads */}
              <section style={dCard}>
                <h3 style={dCardTitle}>Leads atribuidos · {data.contacts.length}</h3>
                {data.contacts.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#888' }}>Sin leads atribuidos.</div>
                ) : (
                  <div style={{ background: '#fafafa', borderRadius: 6, padding: 12, fontSize: 12, color: '#555', maxHeight: 200, overflowY: 'auto' }}>
                    {data.contacts.slice(0, 10).map((c: any) => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #ececec' }}>
                        <span><strong>{c.nombre}</strong> · {c.email}</span>
                        <span>{c.lifecycle_stage || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Bookings */}
              <section style={dCard}>
                <h3 style={dCardTitle}>Demos · {data.bookings.length}</h3>
                {data.bookings.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#888' }}>Sin demos agendados.</div>
                ) : (
                  <div style={{ background: '#fafafa', borderRadius: 6, padding: 12, fontSize: 12, color: '#555', maxHeight: 200, overflowY: 'auto' }}>
                    {data.bookings.slice(0, 10).map((b: any) => (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #ececec' }}>
                        <span><strong>{b.invitee_nombre}</strong> · {_fmtDate(b.fecha)}</span>
                        <span>{b.estado}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Deals */}
              <section style={dCard}>
                <h3 style={dCardTitle}>Deals · {data.deals.length}</h3>
                {data.deals.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#888' }}>Sin deals atribuidos.</div>
                ) : (
                  <div style={{ background: '#fafafa', borderRadius: 6, padding: 12, fontSize: 12, color: '#555', maxHeight: 200, overflowY: 'auto' }}>
                    {data.deals.slice(0, 10).map((d: any) => (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px dashed #ececec' }}>
                        <span><strong>{d.nombre}</strong> · {d.stage}</span>
                        <span>{_fmt(d.valor_total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Activities */}
              {data.activities.length > 0 && (
                <section style={dCard}>
                  <h3 style={dCardTitle}>Actividad reciente</h3>
                  <div style={{ background: '#fafafa', borderRadius: 6, padding: 12, fontSize: 12, color: '#555', maxHeight: 200, overflowY: 'auto' }}>
                    {data.activities.slice(0, 12).map((a: any) => (
                      <div key={a.id} style={{ padding: '5px 0', borderBottom: '1px dashed #ececec' }}>
                        <div style={{ fontSize: 11, color: '#999' }}>{_fmtDate(a.created_at)} · {a.tipo}</div>
                        <div>{a.titulo}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      ` }} />
    </div>
  );
}

function DetailKpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 6, padding: 10, border: '1px solid #ececec', borderLeft: accent ? `3px solid ${accent}` : '1px solid #ececec' }}>
      <div style={{ fontSize: 9, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'Clash Display, Sora, sans-serif', fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{value}</div>
    </div>
  );
}

const dCard: React.CSSProperties = { background: '#fff', border: '1px solid #ececec', borderRadius: 8, padding: 18, marginBottom: 14 };
const dCardTitle: React.CSSProperties = { fontFamily: 'Clash Display, Sora, sans-serif', fontSize: 14, fontWeight: 600, margin: '0 0 12px', color: '#1a1a1a' };
const dRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid #f5f5f5' };
const dLabel: React.CSSProperties = { color: '#888', fontWeight: 500 };

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
    tabulador: editing?.tabulador || { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 50, override_red_pct: 10, moneda: 'MXN' },
    terminos: editing?.terminos || '',
    auto_approve: editing ? !!(editing as any).auto_approve : false,
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
          { icon: 'gift',      title: 'Plan Fideliza gratis · sistema SACS completo', detail: 'Te activamos una cuenta SACS en plan Fideliza para usar en tu propio negocio: POS, inventario multi-sucursal, e-commerce, CRM, lealtad, marketing. Costo público: $14,000 MXN/año. Para ti: gratis durante toda tu participación.', value_label: 'Vale $14,000 MXN/año · Gratis' },
          { icon: 'link',      title: 'Landing personalizada con tu link único',     detail: 'Tu propia página dentro de SACS con tu nombre, foto y link único (sacscloud.com/p/tu-slug). Cada visita y registro queda atribuido automáticamente a ti — sin códigos, sin formularios extra.' },
          { icon: 'dashboard', title: 'Portal de partner con métricas en tiempo real', detail: 'Dashboard personal con visitas a tu landing, registros generados, prospectos calificados, conversiones, comisiones acumuladas y pagos liquidados — todo actualizado al instante.' },
          { icon: 'academy',   title: 'Acceso a Academia SACS y capacitaciones',     detail: 'Cursos en línea, playbooks por vertical, demos grabadas y certificación oficial de embajador. Te enviamos cada mes 3-5 palabras clave para enfocar el contenido.' },
          { icon: 'broadcast', title: 'Difusión en el canal SACS',                   detail: 'Republicamos tu contenido en nuestras redes sociales. El alcance es variable y orgánico — puede sumar miles de views adicionales según el contenido.' },
          { icon: 'calendar',  title: 'Reunión trimestral con el equipo SACS',       detail: 'Sesión cada 3 meses para compartir mejoras, casos de éxito y feedback directo con el equipo de producto y dirección.' },
          { icon: 'wallet',    title: 'Liquidación automática cada 30 días',         detail: 'Pagos de comisiones y bonos por transferencia cada 30 días con desglose detallado de cada concepto, cliente y referido — visible siempre desde tu portal.' },
        ],
        compromisos: [
          { title: 'Cuota mínima anual de 10 sucursales',          detail: 'Mínimo 10 sucursales activas vendidas en cualquier plan durante los primeros 12 meses. Pueden ser 10 clientes con 1 sucursal cada uno, 1 cliente con 10 sucursales, o cualquier combinación. Esto es lo que hace al programa sustentable para ambos lados.', frequency: 'Anual' },
          { title: 'Generar 100 puntos al mes con contenido o acciones', detail: 'Cada mes acumulas mínimo 100 puntos en tres formas posibles: contenido publicado, acciones de promoción (demos, eventos, reseñas, intros) o actividades filantrópicas (refugios, comedores, mentorías, voluntariado). No tienes que ser sólo creador — apoyar también suma. Cada acción la subes desde tu panel de partner; sin reporte no se acreditan puntos. Si haces más de 100, el excedente se acumula al siguiente mes.', frequency: 'Mensual · 100 pts', ctaLabel: 'Ver el catálogo completo de puntos →', ctaTab: 'contenido' },
          { title: 'Reportar tu actividad en el portal',          detail: 'Subir el link, foto o evidencia de cada acción (contenido, apoyo o filantropía) desde el tab "Reportar actividad" de tu panel. Admin SACS valida y otorga los puntos.', frequency: 'Por acción' },
          { title: 'Difusión: en tus redes o las del canal SACS', detail: 'Hay dos formas de hacer difusión y ambas suman. Publicas el contenido en tus propias redes (Instagram, TikTok, YouTube o LinkedIn) o nos envías los archivos originales para que lo publiquemos desde el canal SACS y multipliquemos el alcance. Lo importante es que se difunda — y la difusión te genera más visitas a tu link, más demos agendadas y más comisión.', frequency: 'Continuo' },
          { title: 'Cuidar la marca SACS',                        detail: 'Lo que publicas como embajador suma o resta a la marca. Producción cuidada, mensajes alineados al manual, sin polémicas innecesarias, respeto a competidores, clientes y comunidad. Si dudas, lo revisamos juntos antes de publicar.', frequency: 'Continuo' },
          { title: 'Uso correcto del logotipo y tipografías',     detail: 'Aplicar el logotipo SACS solo en su versión oficial. Respetar tipografías, paleta y guidelines del manual de marca.', frequency: 'Continuo' },
        ],
        tabulador: {
          prueba_gratis: 0,
          demo_completada: 0,
          venta_directa_pct: 50,
          override_red_pct: 10,
          moneda: 'MXN',
          notas: 'Pagos cada 30 días por transferencia bancaria. Ciclo con corte el día 1 de cada mes — el partner envía factura entre 1-3 días hábiles antes para que SACS pueda emitir el pago. La comisión del 50% sobre venta directa se acredita al cobrar la primera factura del cliente cerrado por el link único. Al alcanzar Master Partner Nv 1 (5 sucursales activas vendidas) se desbloquea automáticamente un 10% override sobre todo lo que la red del partner venda, pagado por SACS sin descontar nada del 50% directo del invitado. El partner ve en su portal cada click, prueba gratis activada y demo agendada del lead — eso queda como tracking informativo, no genera pago directo.',
        },
        terminos: '',
      },
      distribuidor: {
        comision_pct: 30, costo_unico: 0, costo_mensual: 0,
        beneficios: [
          { icon: 'percent', title: '30% comisión recurrente', detail: 'Sobre el MRR del cliente mientras esté activo.' },
          { icon: 'academy', title: 'Certificación oficial', detail: 'Academia + examen + directorio de partners.' },
          { icon: 'leads', title: 'Leads asignados', detail: 'Oportunidades calificadas por zona o vertical.' },
        ],
        compromisos: [
          { title: 'Vender', detail: 'Mínimo 2 nuevos clientes por trimestre.', frequency: 'Trimestral' },
          { title: 'Implementar', detail: 'Acompañar al cliente las primeras 4 semanas.', frequency: 'Por cliente' },
        ],
        tabulador: { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 30, override_red_pct: 10, moneda: 'MXN' },
        terminos: '',
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
        tabulador: { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 25, override_red_pct: 10, moneda: 'MXN' },
        terminos: '',
      },
      reseller: {
        comision_pct: 20, costo_unico: 0, costo_mensual: 0,
        beneficios: [
          { icon: 'percent', title: '20% comisión recurrente', detail: 'Sobre el MRR de cada cliente que cierres.' },
        ],
        compromisos: [
          { title: 'Vender bajo tu marca', detail: 'Manejo de la relación comercial bajo tu canal.', frequency: 'Continuo' },
        ],
        tabulador: { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 20, override_red_pct: 10, moneda: 'MXN' },
        terminos: '',
      },
      consultor: {
        comision_pct: 15, costo_unico: 0, costo_mensual: 0,
        beneficios: [
          { icon: 'percent', title: '15% por referido', detail: 'Sobre la primera anualidad cobrada al cliente.' },
        ],
        compromisos: [
          { title: 'Recomendar SACS', detail: 'Cuando aplique al diagnóstico del cliente.', frequency: 'Por caso' },
        ],
        tabulador: { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 15, override_red_pct: 10, moneda: 'MXN' },
        terminos: '',
      },
    };
    setForm((p: any) => ({ ...p, tipo, ...(defaults[tipo] || {}) }));
  }

  async function save() {
    if (!form.nombre.trim()) {
      setErrMsg('El nombre del prospecto es obligatorio');
      // Scroll the form panel to top to show the error
      requestAnimationFrame(() => {
        const panel = document.querySelector('[data-create-panel]') as HTMLElement | null;
        if (panel) panel.scrollTop = 0;
      });
      return;
    }
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
      requestAnimationFrame(() => {
        const panel = document.querySelector('[data-create-panel]') as HTMLElement | null;
        if (panel) panel.scrollTop = 0;
      });
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

        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }} data-create-panel>
          {errMsg && (
            <div style={{ marginBottom: 16, padding: '14px 16px', background: 'rgba(229,75,75,0.08)', color: '#b93333', borderRadius: 8, fontSize: '0.8125rem', border: '1px solid rgba(229,75,75,0.2)' }}>
              <strong>Error al guardar:</strong> {errMsg}
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
              <Field label="Moneda" value={form.moneda} onChange={v => set('moneda', v)} />
              <Field label="Vigencia (fecha de cierre)" type="date" value={form.vigencia} onChange={v => set('vigencia', v)} hint={editing ? 'Puedes extender editando esta fecha. El inicio se mantiene en la creación original.' : 'Inicio se cuenta desde hoy (creación de la invitación).'} />
            </Grid3>
            <Field label="Slug de landing (opcional)" value={form.slug_landing} onChange={v => set('slug_landing', v)} placeholder="ej. juanperez (sacscloud.com/p/juanperez)" />

            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '14px 16px', marginTop: 16,
              border: form.auto_approve ? '1.5px solid #2AB5A0' : '1px solid #ececec',
              background: form.auto_approve ? 'rgba(42,181,160,0.06)' : '#fafafa',
              borderRadius: 10, cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}>
              <input
                type="checkbox"
                checked={!!form.auto_approve}
                onChange={e => set('auto_approve', e.target.checked)}
                style={{ marginTop: 3, accentColor: '#2AB5A0', width: 16, height: 16, flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#1a1a1a', marginBottom: 4 }}>
                  Aprobación automática al firmar
                </span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#666', lineHeight: 1.5 }}>
                  Si está activo, el partner queda <strong>aprobado al instante</strong> al firmar — no requiere
                  revisión admin. Útil para invitaciones que ya validaste offline o ya conoces a la persona.
                  <br/><strong>Si no está activo:</strong> al firmar pasa a "submitted_for_review" y un admin debe
                  hacer click en "Aprobar" desde este CRM.
                </span>
              </span>
            </label>
          </Section>

          {/* Beneficios */}
          <Section title="Beneficios" actions={<MiniBtn onClick={addBenefit}>+ Agregar</MiniBtn>}>
            {form.beneficios.length === 0 && <EmptyHint>Sin beneficios. Cambia el tipo de partner o agrega uno manualmente.</EmptyHint>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {form.beneficios.map((b: any, i: number) => (
                <div key={i} style={{ padding: 14, border: '1px solid #e5e5e5', borderRadius: 10, background: '#fafafa' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <select value={b.icon || 'default'} onChange={e => updateBenefit(i, 'icon', e.target.value)} style={selectStyle}>
                      {['gift', 'percent', 'academy', 'community', 'reward', 'leads', 'broadcast', 'calendar', 'link', 'dashboard', 'wallet', 'default'].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <input value={b.title || ''} onChange={e => updateBenefit(i, 'title', e.target.value)} placeholder="Título" style={inputStyle} />
                    <button onClick={() => removeBenefit(i)} style={{ ...btnSm(), background: 'transparent', color: '#b93333', borderColor: 'rgba(229,75,75,0.3)' }}>✕</button>
                  </div>
                  <textarea value={b.detail || ''} onChange={e => updateBenefit(i, 'detail', e.target.value)} placeholder="Detalle del beneficio" rows={2} style={{ ...inputStyle, resize: 'vertical' as const }} />
                  <input
                    value={b.value_label || ''}
                    onChange={e => updateBenefit(i, 'value_label', e.target.value)}
                    placeholder='Valor (opcional, ej. "Vale $14,000/año · Gratis")'
                    style={{ ...inputStyle, marginTop: 8, fontSize: '0.8125rem' }}
                  />
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Venta directa (%)" type="number" value={form.tabulador?.venta_directa_pct ?? 0} onChange={v => setTab('venta_directa_pct', Number(v) || 0)} hint="50% es el valor estándar del programa Embajador. Se cobra sobre la primera factura de cada cliente cerrado por su link." />
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                padding: '12px 14px', background: 'linear-gradient(135deg, #fafaf7, #f5f0e6)',
                border: '1px solid rgba(201,169,107,0.25)', borderRadius: 10,
              }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#c9a96b', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Override sobre red</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 500, color: '#1a1a1a', letterSpacing: '-0.02em', lineHeight: 1 }}>10%</span>
                <span style={{ fontSize: '0.6875rem', color: '#888', lineHeight: 1.4 }}>Automático al alcanzar Master Partner Nv 1 (5 sucursales activas). No editable — es estándar del programa.</span>
              </div>
            </div>
            <FieldArea label="Notas del tabulador" value={form.tabulador?.notas || ''} onChange={v => setTab('notas', v)} placeholder="Cómo se calculan los pagos..." />
          </Section>

          {/* Nota interna */}
          <Section title="Nota interna (no visible al partner)">
            <div style={{
              padding: '12px 14px', marginBottom: 10,
              background: '#fafafa', border: '1px solid #ececec', borderRadius: 8,
              fontSize: '0.75rem', color: '#666', lineHeight: 1.5,
            }}>
              ℹ️ El <strong>contrato completo de 19 cláusulas</strong> (compensación, suspensión, certificaciones,
              override 10% sobre la red, propiedad intelectual, no-competencia, indemnización…) se muestra
              automáticamente en la invitación pública y al firmar — no necesita configurarse aquí. Este campo
              es solo para tu uso interno: recordatorios, contexto del negocio, acuerdos verbales, etc.
              <strong> No se muestra al partner.</strong>
            </div>
            <FieldArea label="Notas internas sobre este partner" value={form.terminos} onChange={v => set('terminos', v)} placeholder="Ej: lo conocí en feria ANTAD · comisión 60% acordada verbal · sector farmacia · referido por Mariana López · etc." rows={4} />
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

        <div style={{ padding: '16px 28px', borderTop: '1px solid #e5e5e5', background: '#fafafa' }}>
          {errMsg && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(229,75,75,0.10)', color: '#b93333', borderRadius: 8, fontSize: '0.8125rem', border: '1px solid rgba(229,75,75,0.25)' }}>
              <strong>No se pudo guardar:</strong> {errMsg}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

function Field({ label, value, onChange, placeholder, type = 'text', hint }: { label: string; value: any; onChange: (v: string) => void; placeholder?: string; type?: string; hint?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
      {hint && <span style={{ fontSize: '0.6875rem', color: '#888', lineHeight: 1.4 }}>{hint}</span>}
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

// ─── Recover Access Modal — accessible from any approved row ──
function RecoverAccessModal({ invitation, onClose }: { invitation: Invitation; onClose: () => void }) {
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(invitation.email || '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; resetUrl?: string } | null>(null);

  async function recover(opts: { changeEmail: boolean }) {
    setBusy(true); setResult(null);
    try {
      const body: any = {
        invitation_id: invitation.id,
        team_member_id: (invitation as any).team_member_id || undefined,
        send_welcome: true,
      };
      if (opts.changeEmail) {
        if (!newEmail.trim() || newEmail.trim() === invitation.email) {
          setResult({ ok: false, msg: 'Pon un email nuevo diferente al actual.' });
          setBusy(false);
          return;
        }
        body.new_email = newEmail.trim();
      }
      const res = await fetch('/api/partners/recover-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'founder' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      const emailOk = data.email_sent;
      const emailWarn = data.email_error;
      const baseMsg = opts.changeEmail
        ? `✓ Email actualizado a ${data.email}.`
        : `✓ Token nuevo generado para ${data.email}.`;
      const sendMsg = emailOk
        ? ' Email de bienvenida enviado por Resend.'
        : ` ⚠️ Email NO se envió (${emailWarn || 'razón desconocida'}). Comparte el link manual abajo.`;
      setResult({ ok: true, msg: baseMsg + sendMsg, resetUrl: data.reset_url });
      setEditingEmail(false);
    } catch (e: any) {
      setResult({ ok: false, msg: e.message || String(e) });
    } finally {
      setBusy(false);
    }
  }

  function copyResetUrl() {
    if (result?.resetUrl) {
      navigator.clipboard.writeText(result.resetUrl);
      setResult(r => r ? { ...r, msg: r.msg + ' (link copiado)' } : r);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, maxWidth: 580, width: '100%',
        padding: 28, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 60px -16px rgba(0,0,0,0.30)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#E8A838', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Recuperar acceso</div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: '#1a1a1a' }}>{invitation.nombre}</h3>
            <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>Folio {invitation.numero}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, color: '#999', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ background: '#fffaf0', border: '1px solid rgba(232,168,56,0.30)', borderRadius: 10, padding: 14, marginBottom: 18 }}>
          <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.55 }}>
            Si el partner registró el email mal, perdió su contraseña o no recibió el email
            de bienvenida — usa esto. El link de reset queda visible para que puedas
            compartirlo manual via WhatsApp si el email no llega.
          </p>
        </div>

        {!editingEmail ? (
          <>
            <div style={{ marginBottom: 14, fontSize: 13, color: '#555' }}>
              <div style={{ marginBottom: 4 }}><strong style={{ color: '#1a1a1a' }}>Email actual:</strong> {invitation.email || '—'}</div>
              {(invitation as any).team_member_id ? (
                <div style={{ fontSize: 11, color: '#1A8F7A' }}>✓ Cuenta de partner ya creada</div>
              ) : (
                <div style={{ fontSize: 11, color: '#E8A838' }}>⚠ Cuenta no encontrada — se creará al ejecutar la recuperación</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => recover({ changeEmail: false })} disabled={busy} style={{
                padding: '11px 18px', fontSize: 13, fontWeight: 600,
                background: '#1a1a1a', color: '#fff',
                border: 'none', borderRadius: 8, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}>{busy ? 'Enviando…' : 'Reenviar email de bienvenida'}</button>
              <button onClick={() => setEditingEmail(true)} disabled={busy} style={{
                padding: '11px 18px', fontSize: 13, fontWeight: 600,
                background: 'transparent', color: '#1a1a1a',
                border: '1px solid #ddd', borderRadius: 8, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}>Cambiar email</button>
            </div>
          </>
        ) : (
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Nuevo email</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="nuevo@correo.com"
                style={{
                  flex: 1, minWidth: 220, padding: '11px 14px', fontSize: 14,
                  border: '1px solid #ddd', borderRadius: 8, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => recover({ changeEmail: true })} disabled={busy} style={{
                padding: '11px 18px', fontSize: 13, fontWeight: 600,
                background: '#1a1a1a', color: '#fff',
                border: 'none', borderRadius: 8, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}>{busy ? 'Guardando…' : 'Actualizar y enviar'}</button>
              <button onClick={() => { setEditingEmail(false); setNewEmail(invitation.email || ''); }} disabled={busy} style={{
                padding: '11px 18px', fontSize: 13, fontWeight: 600,
                background: 'transparent', color: '#999',
                border: '1px solid #eee', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancelar</button>
            </div>
          </div>
        )}

        {result && (
          <div style={{
            marginTop: 16, padding: '12px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
            background: result.ok ? 'rgba(42,181,160,0.10)' : 'rgba(229,75,75,0.10)',
            color: result.ok ? '#1A8F7A' : '#b93333',
            border: `1px solid ${result.ok ? 'rgba(42,181,160,0.25)' : 'rgba(229,75,75,0.25)'}`,
          }}>
            <div>{result.msg}</div>
            {result.resetUrl && (
              <div style={{ marginTop: 10, padding: 10, background: '#fff', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', color: '#333' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Link directo (válido 14 días):</div>
                {result.resetUrl}
                <div style={{ marginTop: 8 }}>
                  <button onClick={copyResetUrl} style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 600,
                    background: '#1a1a1a', color: '#fff',
                    border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                  }}>📋 Copiar link</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Recover Access Section (used in PartnerDetailDrawer) ─────
function RecoverAccessSection({ memberId, memberEmail, memberName }: { memberId: string; memberEmail: string; memberName: string }) {
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(memberEmail || '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; resetUrl?: string } | null>(null);

  async function recover(opts: { changeEmail: boolean }) {
    setBusy(true); setResult(null);
    try {
      const body: any = { team_member_id: memberId, send_welcome: true };
      if (opts.changeEmail) {
        if (!newEmail.trim() || newEmail.trim() === memberEmail) {
          setResult({ ok: false, msg: 'Pon un email nuevo diferente al actual.' });
          setBusy(false);
          return;
        }
        body.new_email = newEmail.trim();
      }
      const res = await fetch('/api/partners/recover-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'founder' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      const emailOk = data.email_sent;
      const emailWarn = data.email_error;
      const baseMsg = opts.changeEmail
        ? `✓ Email actualizado a ${data.email}.`
        : `✓ Token nuevo generado para ${data.email}.`;
      const sendMsg = emailOk
        ? ' Email de bienvenida enviado por Resend.'
        : ` ⚠️ Email NO se envió (${emailWarn || 'razón desconocida'}). Comparte el link manual abajo.`;
      setResult({
        ok: true,
        msg: baseMsg + sendMsg,
        resetUrl: data.reset_url,
      });
      setEditingEmail(false);
    } catch (e: any) {
      setResult({ ok: false, msg: e.message || String(e) });
    } finally {
      setBusy(false);
    }
  }

  function copyResetUrl() {
    if (result?.resetUrl) {
      navigator.clipboard.writeText(result.resetUrl);
      setResult(r => r ? { ...r, msg: r.msg + ' (link copiado al portapapeles)' } : r);
    }
  }

  return (
    <section style={{ ...dCard, background: '#fffaf0', border: '1px solid rgba(232,168,56,0.30)' }}>
      <h3 style={dCardTitle}>Recuperar acceso del partner</h3>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 14px', lineHeight: 1.5 }}>
        Si <strong>{memberName}</strong> registró el email mal, perdió su contraseña o no recibió
        el correo de bienvenida — usa estas herramientas. El link de reset del password queda visible
        aquí para que puedas compartirlo manual si el email no llega.
      </p>

      {!editingEmail ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => recover({ changeEmail: false })}
            disabled={busy}
            style={{
              padding: '10px 16px', fontSize: 13, fontWeight: 600,
              background: '#1a1a1a', color: '#fff',
              border: 'none', borderRadius: 8, cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {busy ? 'Enviando…' : 'Reenviar email de bienvenida'}
          </button>
          <button
            onClick={() => setEditingEmail(true)}
            disabled={busy}
            style={{
              padding: '10px 16px', fontSize: 13, fontWeight: 600,
              background: 'transparent', color: '#1a1a1a',
              border: '1px solid #ddd', borderRadius: 8, cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cambiar email del partner
          </button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
            Email actual: <strong style={{ color: '#1a1a1a' }}>{memberEmail}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="nuevo@correo.com"
              style={{
                flex: 1, minWidth: 220,
                padding: '10px 14px', fontSize: 14,
                border: '1px solid #ddd', borderRadius: 8,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              onClick={() => recover({ changeEmail: true })}
              disabled={busy}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 600,
                background: '#1a1a1a', color: '#fff',
                border: 'none', borderRadius: 8, cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {busy ? 'Guardando…' : 'Actualizar y enviar'}
            </button>
            <button
              onClick={() => { setEditingEmail(false); setNewEmail(memberEmail); }}
              disabled={busy}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 600,
                background: 'transparent', color: '#999',
                border: '1px solid #eee', borderRadius: 8, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >Cancelar</button>
          </div>
        </div>
      )}

      {result && (
        <div style={{
          marginTop: 14, padding: '12px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
          background: result.ok ? 'rgba(42,181,160,0.10)' : 'rgba(229,75,75,0.10)',
          color: result.ok ? '#1A8F7A' : '#b93333',
          border: `1px solid ${result.ok ? 'rgba(42,181,160,0.25)' : 'rgba(229,75,75,0.25)'}`,
        }}>
          <div>{result.msg}</div>
          {result.resetUrl && (
            <div style={{ marginTop: 8, padding: 8, background: '#fff', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Link directo (válido 14 días):</div>
              {result.resetUrl}
              <button
                onClick={copyResetUrl}
                style={{ marginTop: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }}
              >📋 Copiar link</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
