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
    tabulador: editing?.tabulador || { prueba_gratis: 500, demo_completada: 300, venta_directa_pct: 50, moneda: 'MXN' },
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
          { icon: 'percent',   title: '50% de comisión por venta directa',       detail: 'Sobre cada cliente cerrado a través de tu link único de partner. Se calcula sobre el monto efectivamente cobrado al cliente.' },
          { icon: 'reward',    title: 'Bono por prueba gratis activada',         detail: 'Bono fijo cada vez que un usuario llega por tu link único y se registra para una prueba gratuita en SACS. Pago al confirmar el alta.' },
          { icon: 'reward',    title: 'Bono por demo completada',                detail: 'Bono adicional cuando el prospecto asiste y completa un demo válido con SACS (mínimo 25 min con tomador de decisión presente).' },
          { icon: 'link',      title: 'Landing page personalizada con tu link', detail: 'Tu propia página dentro de SACS con tu nombre, foto y link único (sacscloud.com/p/tu-slug). Cada visita y registro queda atribuido automáticamente a ti.' },
          { icon: 'dashboard', title: 'Portal de partner con métricas en tiempo real', detail: 'Dashboard personal con visitas a tu landing, registros generados, prospectos calificados, conversiones, comisiones acumuladas y pagos liquidados — todo actualizado al instante.' },
          { icon: 'academy',   title: 'Acceso a Academia SACS y capacitaciones', detail: 'Cursos en línea, playbooks por vertical, demos grabadas y certificación oficial de embajador.' },
          { icon: 'gift',      title: 'Plan Fideliza incluido',                  detail: 'Acceso completo al plan Fideliza para tu propio negocio durante toda tu participación. Valor de $18,000 MXN al año.' },
          { icon: 'calendar',  title: 'Reunión trimestral con el equipo SACS',   detail: 'Sesión cada 3 meses para compartir mejoras, casos de éxito y feedback directo con el equipo de producto y dirección.' },
          { icon: 'broadcast', title: 'Difusión en el canal SACS',               detail: 'Republicamos tu contenido en nuestras redes sociales. El alcance es variable y orgánico — puede sumar miles de views adicionales según el contenido.' },
          { icon: 'wallet',    title: 'Pagos automáticos cada 30 días',          detail: 'Comisiones y bonos liquidados por transferencia cada 30 días, con desglose detallado de cada concepto, cliente y referido. Visible siempre desde tu portal.' },
        ],
        compromisos: [
          { title: 'Cuota mínima anual de 10 sucursales',          detail: 'Mínimo 10 sucursales activas vendidas en cualquier plan durante los primeros 12 meses. Pueden ser 10 clientes con 1 sucursal cada uno, 1 cliente con 10 sucursales, o cualquier combinación. Esto es lo que hace al programa sustentable para ambos lados.', frequency: 'Anual' },
          { title: 'Crear 4 videos al mes con la plataforma',     detail: 'Mínimo 4 videos mensuales usando SACS, alineados al plan de trabajo y palabras clave que enviamos al inicio de cada mes.', frequency: 'Mensual' },
          { title: 'Publicar en tus redes sociales',              detail: 'Publicar los videos en tus propias redes (Instagram, TikTok, YouTube o LinkedIn) y compartir con tu audiencia.', frequency: 'Mensual' },
          { title: 'Enviarnos los archivos originales',           detail: 'Compartir con SACS los archivos originales de cada video para que también los publiquemos en nuestros canales y multiplicar el alcance.', frequency: 'Mensual' },
          { title: 'Responder a leads asignados en menos de 24 h', detail: 'Cuando SACS te asigne un lead calificado, contactarlo en menos de 24 horas hábiles. Si no puedes en ese plazo, marcarlo en el portal para reasignar y no enfriar la oportunidad.', frequency: 'Por lead' },
          { title: 'Reporte mensual de actividad',                detail: 'Compartir un resumen mensual desde tu portal: contenido publicado, engagement, leads contactados y feedback. Es lo que nos permite mejorar el programa contigo.', frequency: 'Mensual' },
          { title: 'Representar bien la marca SACS',              detail: 'Hablar siempre de forma positiva y profesional sobre la plataforma. Mantener un tono respetuoso al referirte a competidores, clientes y comunidad.', frequency: 'Continuo' },
          { title: 'Uso correcto del logotipo',                   detail: 'Aplicar el logotipo SACS solo en su versión oficial, sin deformar, recolorear ni mezclar con elementos no aprobados. Respetar áreas de protección.', frequency: 'Continuo' },
          { title: 'Uso correcto de tipografías y guidelines',    detail: 'Respetar el manual de marca: tipografías oficiales, paleta de colores, espaciado, fotografía e iconografía aprobada.', frequency: 'Continuo' },
          { title: 'Asistir al kick-off de embajadores',          detail: 'Sesión inicial de 60 minutos para conocer el modelo, los materiales de marca y las mejores prácticas para representar SACS.', frequency: 'Una vez' },
        ],
        tabulador: {
          prueba_gratis: 500,
          demo_completada: 300,
          venta_directa_pct: 50,
          moneda: 'MXN',
          notas: 'Pagos cada 30 días por transferencia bancaria, con desglose detallado por concepto y cliente visible siempre en tu portal de partner. Bono por prueba gratis se acredita cuando un usuario referido se registra y activa una prueba gratuita en SACS. Bono por demo completada se acredita al cierre del demo válido (mínimo 25 min con tomador de decisión presente). Comisión por venta directa se acredita al cobrar la primera factura del cliente cerrado.',
        },
        terminos: `Programa Embajador SACS — Términos y Condiciones

1. Vigencia y evaluación. El programa tiene vigencia indefinida sujeta a evaluación trimestral del cumplimiento de compromisos por parte de SACS Cloud. SACS se reserva el derecho de revisar el desempeño cada 90 días.

2. Comisiones y pagos. Las comisiones se calculan sobre el monto efectivamente cobrado a clientes referidos (vía link único o atribución manual). El pago se realiza por transferencia bancaria cada 30 días naturales contados desde el inicio del programa, con desglose detallado por concepto, cliente y referido visible siempre desde el portal del partner. Cada liquidación va contra emisión de recibo o factura del embajador.

3. Landing page y portal del partner. SACS habilitará al embajador (i) una landing page personalizada con su nombre y link único bajo el dominio sacscloud.com, y (ii) un portal de partner con métricas en tiempo real (visitas, registros, prospectos, conversiones, comisiones devengadas y pagos liquidados). El embajador es responsable de la información, fotografía y biografía que comparta para su landing.

4. Cumplimiento de compromisos.
   (i) Cuota anual mínima: el embajador se compromete a generar la venta de al menos 10 sucursales activas en SACS durante los primeros 12 meses del programa, en cualquier plan disponible y bajo cualquier combinación (clientes con una o varias sucursales). Esta meta hace al programa sustentable para ambas partes y desbloquea la renovación automática.
   (ii) Si el embajador deja de cumplir los compromisos de contenido por dos (2) meses consecutivos, SACS notificará por escrito y otorgará un periodo de regularización de 30 días naturales antes de pausar los beneficios.
   (iii) Si al cumplirse 12 meses el embajador no alcanza la cuota mínima, SACS y el embajador acordarán un plan de recuperación de 90 días o, en su defecto, terminarán el acuerdo conforme a la cláusula 8.

5. Confidencialidad. El embajador se compromete a no divulgar información estratégica, comercial o financiera de SACS Cloud, sus clientes o aliados, que reciba durante su participación en el programa.

6. Imagen y propiedad intelectual. SACS otorga al embajador una licencia limitada, no exclusiva y revocable para usar la marca SACS conforme al manual de marca durante la vigencia del programa. La propiedad intelectual de los videos creados por el embajador permanece del embajador, quien otorga a SACS una licencia perpetua, mundial y libre de regalías para republicar y promocionar dichos videos en cualquier canal de SACS.

7. Exclusividad parcial. Durante la vigencia del programa, el embajador no representará simultáneamente plataformas competidoras directas (POS / SaaS retail mexicano) sin autorización previa por escrito de SACS.

8. Terminación. Cualquiera de las partes podrá terminar el acuerdo con 30 días de aviso por escrito. Las comisiones devengadas hasta el momento de la terminación se pagarán conforme al ciclo regular y serán visibles en el portal hasta su liquidación.

9. No relación laboral. Este acuerdo no constituye relación laboral, mercantil-asociativa ni de mandato entre las partes. El embajador actúa como colaborador independiente y es responsable de sus propias obligaciones fiscales.

10. Datos personales. El tratamiento de datos personales se rige por el Aviso de Privacidad publicado en sacscloud.com/privacidad.

11. Jurisdicción. Para la interpretación y cumplimiento de este acuerdo, las partes se someten a las leyes y tribunales de la Ciudad de México.`,
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
        tabulador: { prueba_gratis: 0, demo_completada: 300, venta_directa_pct: 30, moneda: 'MXN' },
        terminos: 'Comisión recurrente sobre MRR cobrado mientras el cliente esté al corriente.',
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
        tabulador: { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 25, moneda: 'MXN' },
        terminos: 'Programa para casas de software e integradores B2B.',
      },
      reseller: {
        comision_pct: 20, costo_unico: 0, costo_mensual: 0,
        beneficios: [
          { icon: 'percent', title: '20% comisión recurrente', detail: 'Sobre el MRR de cada cliente que cierres.' },
        ],
        compromisos: [
          { title: 'Vender bajo tu marca', detail: 'Manejo de la relación comercial bajo tu canal.', frequency: 'Continuo' },
        ],
        tabulador: { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 20, moneda: 'MXN' },
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
        tabulador: { prueba_gratis: 0, demo_completada: 0, venta_directa_pct: 15, moneda: 'MXN' },
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
              <Field label="Moneda" value={form.moneda} onChange={v => set('moneda', v)} />
              <Field label="Vigencia" type="date" value={form.vigencia} onChange={v => set('vigencia', v)} />
            </Grid3>
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
                      {['gift', 'percent', 'academy', 'community', 'reward', 'leads', 'broadcast', 'calendar', 'link', 'dashboard', 'wallet', 'default'].map(o => <option key={o} value={o}>{o}</option>)}
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
              <Field label="Prueba gratis ($)" type="number" value={form.tabulador?.prueba_gratis ?? 0} onChange={v => setTab('prueba_gratis', Number(v) || 0)} />
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
