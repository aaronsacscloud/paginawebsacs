import { useEffect, useState } from 'react';
import { ESPECIALIDADES } from '../../../data/partner-especialidades';
import { FIL_TIERS } from '../../../data/filantropia';

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
  // Interest tracking (enriched from API)
  interest_score?: number;
  interest_signature_attempted?: boolean;
  interest_contract_accepted?: boolean;
  interest_modal_opens?: number;
  interest_active_seconds?: number;
  interest_sessions?: number;
  // Stats vivas del partner (solo presentes si team_member_id existe)
  member_last_login_at?: string | null;
  member_created_at?: string | null;
  member_activo?: boolean | null;
  stats_leads?: number;
  stats_demos_agendadas?: number;
  stats_demos_realizadas?: number;
  stats_clientes?: number;
  stats_comm_pending?: number;
  stats_comm_earned?: number;
  stats_comm_paid?: number;
}

const TIPO_LABELS: Record<string, { label: string; tagline: string; color: string }> = {
  embajador:    { label: 'Embajador', tagline: 'Free + 50% comisión + 3-4 videos/mes', color: '#4B7BE5' },
  distribuidor: { label: 'Distribuidor', tagline: 'Cuota única + comisión recurrente', color: '#6C5CE7' },
  integrador:   { label: 'Integrador', tagline: 'B2B · implementación técnica', color: '#2AB5A0' },
  reseller:     { label: 'Reseller', tagline: 'White-label / canal indirecto', color: '#E8A838' },
  consultor:    { label: 'Consultor', tagline: 'Asesoría especializada', color: '#E54B4B' },
};

const ESTADO_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  // Al crearse la invitación ya queda ACTIVA (el link funciona) — eliminamos el
  // concepto de borrador. draft / sent / viewed se muestran todos como 'Activa'.
  draft:                 { label: 'Activa',                 color: '#3764c4', bg: 'rgba(75,123,229,0.1)' },
  sent:                  { label: 'Activa',                 color: '#3764c4', bg: 'rgba(75,123,229,0.1)' },
  viewed:                { label: 'Activa · vista',         color: '#3764c4', bg: 'rgba(75,123,229,0.1)' },
  submitted_for_review:  { label: 'Firmada · por aprobar',  color: '#a06600', bg: 'rgba(232,168,56,0.16)' },
  accepted:              { label: 'Aprobada',               color: '#1e8471', bg: 'rgba(42,181,160,0.12)' },
  declined:              { label: 'Rechazada',              color: '#b93333', bg: 'rgba(229,75,75,0.10)' },
  cancelled:             { label: 'Cancelada',              color: '#666',    bg: '#f0f0f0' },
  expired:               { label: 'Vencida',                color: '#999',    bg: 'rgba(153,153,153,0.10)' },
};

// Sub-estado de actividad real del partner (solo aplica cuando estado='accepted').
// Capa de información encima del estado de invitación para que el founder vea
// si el partner ya está produciendo, solo entró sin hacer nada, o todavía no entró.
type Activity = { label: string; color: string; bg: string };
function getActivitySubstate(it: Invitation): Activity | null {
  if (it.estado !== 'accepted') return null;
  const clientes = Number(it.stats_clientes || 0);
  const leads = Number(it.stats_leads || 0);
  const demosAg = Number(it.stats_demos_agendadas || 0);
  const demosRe = Number(it.stats_demos_realizadas || 0);
  const hasLogin = !!it.member_last_login_at;

  if (clientes > 0) return { label: `Produciendo · ${clientes} ${clientes === 1 ? 'cliente' : 'clientes'}`, color: '#0a6b3d', bg: 'rgba(16,185,129,0.16)' };
  if (demosRe > 0)  return { label: `${demosRe} ${demosRe === 1 ? 'demo realizada' : 'demos realizadas'}`, color: '#5b21b6', bg: 'rgba(139,92,246,0.16)' };
  if (demosAg > 0)  return { label: `${demosAg} ${demosAg === 1 ? 'demo agendada' : 'demos agendadas'}`, color: '#1e40af', bg: 'rgba(59,130,246,0.16)' };
  if (leads > 0)    return { label: `${leads} ${leads === 1 ? 'lead' : 'leads'}`, color: '#3764c4', bg: 'rgba(75,123,229,0.14)' };
  if (hasLogin)     return { label: 'Entró · sin actividad', color: '#a06600', bg: 'rgba(232,168,56,0.14)' };
  return { label: 'No ha entrado al portal', color: '#999', bg: 'rgba(153,153,153,0.12)' };
}

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
  const [vigenciaEdit, setVigenciaEdit] = useState<Invitation | null>(null);
  const [vigenciaVal, setVigenciaVal] = useState('');
  const [vigenciaSaving, setVigenciaSaving] = useState(false);
  // Kebab menu de acciones: ID de la fila con menu abierto + posición del dropdown
  const [openMenu, setOpenMenu] = useState<{ id: string; top?: number; bottom?: number; right: number } | null>(null);
  // Rachas filantrópicas del mes (partners de cobro) — best-effort
  const [rachas, setRachas] = useState<any>(null);
  useEffect(() => {
    fetch('/api/partners/rachas-filantropia')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && Array.isArray(d.partners)) setRachas(d); })
      .catch(() => {});
  }, []);

  // Click fuera del menú lo cierra
  useEffect(() => {
    if (!openMenu) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-row-actions-menu]') && !target.closest('[data-row-actions-trigger]')) {
        setOpenMenu(null);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenu(null);
    }
    function onScroll() {
      setOpenMenu(null);
    }
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onScroll, { capture: true });
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onScroll, { capture: true } as any);
    };
  }, [openMenu]);

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
    sent: list.filter(i => i.estado === 'draft' || i.estado === 'sent' || i.estado === 'viewed').length,
    pending: list.filter(i => i.estado === 'submitted_for_review').length,
    accepted: list.filter(i => i.estado === 'accepted').length,
    declined: list.filter(i => i.estado === 'declined' || i.estado === 'cancelled').length,
  };
  const conversionPct = stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0;

  function copyLink(id: string) {
    const url = `${window.location.origin}/partners/invitacion/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copiado:\n' + url);
    });
  }

  // Mensaje listo para WhatsApp/correo. Si la invitación es DE COBRO
  // (costo_unico > 0), incluye el gancho del incentivo filantrópico.
  function copyMensaje(it: Invitation) {
    const url = `${window.location.origin}/partners/invitacion/${it.id}`;
    const nombre = (it.nombre || '').split(' ')[0] || 'Hola';
    const esDeCobro = Number(it.costo_unico || 0) > 0;
    const filLine = esDeCobro
      ? `\n\n🕊️ Incluye hasta +${FIL_TIERS[FIL_TIERS.length - 1].extra}% de comisión extra al mes por filantropía — totalmente opcional.`
      : '';
    const msg = `${nombre}, te comparto tu invitación personal al programa de partners de SACS. Ahí vienen tus términos, tu esquema de comisiones y la firma digital — todo en un solo link:\n\n${url}${filLine}\n\nCualquier duda me dices y lo revisamos juntos. 🤝`;
    navigator.clipboard.writeText(msg).then(() => {
      alert('Mensaje de invitación copiado — pégalo en WhatsApp o correo.');
    }).catch(() => {
      alert('No se pudo copiar automáticamente. Mensaje:\n\n' + msg);
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

  async function cancelInvitation(it: Invitation) {
    if (!confirm(`¿Cancelar por completo la invitación ${it.numero} de ${it.nombre}?\n\nEl link público dejará de funcionar y el partner la verá como CANCELADA y totalmente vencida. Puedes reactivarla luego con "Editar vigencia".\n\nEsto NO borra la invitación.`)) return;
    try {
      const res = await fetch('/api/partners/invitations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'founder' },
        // cancelada + vigencia en el pasado → el partner la ve cancelada y totalmente vencida
        body: JSON.stringify({ id: it.id, estado: 'cancelled', vigencia: new Date().toISOString() }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Error');
      }
      setOpenMenu(null);
      load();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  // Editar vigencia: abre el modal con la fecha actual (o +30 días por defecto).
  function abrirVigencia(it: Invitation) {
    setOpenMenu(null);
    const base = it.vigencia ? new Date(it.vigencia) : new Date(Date.now() + 30 * 86400000);
    // si ya venció, sugiere +30 días desde hoy
    const sug = (it.vigencia && new Date(it.vigencia) < new Date()) ? new Date(Date.now() + 30 * 86400000) : base;
    setVigenciaVal(sug.toISOString().slice(0, 10));
    setVigenciaEdit(it);
  }
  async function guardarVigencia() {
    if (!vigenciaEdit || !vigenciaVal) return;
    setVigenciaSaving(true);
    try {
      // vence al FINAL del día elegido
      const iso = new Date(vigenciaVal + 'T23:59:59').toISOString();
      const est = vigenciaEdit.estado;
      // reactivar si estaba vencida/cancelada; no tocar aceptadas/en revisión/declinadas
      const reactivar = est === 'expired' || est === 'cancelled' || est === 'sent' || est === 'viewed' || est === 'draft';
      const body: any = { id: vigenciaEdit.id, vigencia: iso };
      if (reactivar) body.estado = 'sent';
      const res = await fetch('/api/partners/invitations', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-user-id': 'founder' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Error'); }
      setVigenciaEdit(null); load();
    } catch (err: any) { alert('Error: ' + err.message); }
    setVigenciaSaving(false);
  }

  async function deleteInvitation(it: Invitation) {
    const isAccepted = it.estado === 'accepted';
    const firstConfirm = isAccepted
      ? `⚠️ ELIMINACIÓN COMPLETA · invitación + partner del team\n\nEsta invitación YA FUE ACEPTADA y generó un partner activo en SACS.\n\nSe borran en cascada:\n• La invitación (folio ${it.numero})\n• El link público y landing personalizada\n• Todas las sesiones de tracking\n• El partner del team (cuenta de acceso, sesiones, password tokens)\n• Sus content submissions, strikes, payouts, comisiones, certificaciones\n• Visitas a su landing\n\nEsta acción NO se puede deshacer.\n\n¿Continuar?`
      : `Vas a eliminar la invitación ${it.numero} de ${it.nombre}.\n\nSe borran:\n• La invitación de la base de datos\n• El link público y la landing personalizada\n• Todas las sesiones de tracking\n\nEsta acción NO se puede deshacer.\n\n¿Continuar?`;
    if (!confirm(firstConfirm)) return;
    if (isAccepted) {
      const second = `Confirmación final: escribe el número de folio (${it.numero}) para eliminar.`;
      const typed = prompt(second, '');
      if (typed !== it.numero) {
        alert('Folio incorrecto. Eliminación cancelada.');
        return;
      }
    }
    try {
      const res = await fetch('/api/partners/invitations?id=' + encodeURIComponent(it.id), {
        method: 'DELETE',
        headers: { 'x-user-id': 'founder' },
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Error eliminando invitación');
      }
      setOpenMenu(null);
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
        <StatCard label="Activas" value={stats.sent.toString()} accent="#4B7BE5" />
        <StatCard label="Aceptadas · por aprobar" value={stats.pending.toString()} accent="#E8A838" />
        <StatCard label="Aprobadas" value={stats.accepted.toString()} accent="#2AB5A0" />
        <StatCard label="Conversión" value={`${conversionPct}%`} accent="#6C5CE7" />
      </div>

      {/* 🕊️ Rachas filantrópicas del mes — partners DE COBRO. A quién empujar:
          el que va cerca del siguiente nivel gana con un recordatorio. */}
      {rachas && rachas.partners.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e8e8ec', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1a1a1a' }}>
              🕊️ Rachas filantrópicas · {rachas.mes}
              <span style={{ fontWeight: 400, color: '#888', marginLeft: 8 }}>
                {rachas.partners.filter((p: any) => p.extra_pct > 0).length} con extra activo · {rachas.partners.filter((p: any) => p.empujable).length} a un empujón del siguiente nivel
                · ⚠️ el % extra se aplica MANUALMENTE al preparar la liquidación del mes
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {rachas.partners.slice(0, 12).map((p: any) => (
              <div key={p.invitation_id} title={p.pts_pendientes > 0 ? `${p.pts_pendientes} pts en revisión` : undefined}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999,
                  fontSize: '0.75rem', fontWeight: 600,
                  background: p.extra_pct > 0 ? 'rgba(42,181,160,0.10)' : (p.empujable ? 'rgba(232,168,56,0.12)' : '#f5f6f8'),
                  color: p.extra_pct > 0 ? '#1b7f6f' : (p.empujable ? '#8a6414' : '#555'),
                  border: `1px solid ${p.extra_pct > 0 ? 'rgba(42,181,160,0.3)' : (p.empujable ? 'rgba(232,168,56,0.35)' : '#e8e8ec')}`,
                }}>
                <span>{p.nombre || p.empresa || '—'}</span>
                <span style={{ fontWeight: 800 }}>{p.pts_aprobados} pts</span>
                {p.extra_pct > 0 && <span>+{p.extra_pct}%</span>}
                {p.empujable && <span>⚡ faltan {p.faltan}</span>}
              </div>
            ))}
            {rachas.partners.length > 12 && (
              <span style={{ fontSize: '0.75rem', color: '#888', alignSelf: 'center' }}>y {rachas.partners.length - 12} más…</span>
            )}
          </div>
        </div>
      )}

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
      <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 14 }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#999', fontSize: '0.875rem' }}>Cargando invitaciones...</div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : (
          <div style={{ overflowX: 'auto', overflowY: 'visible', WebkitOverflowScrolling: 'touch', borderRadius: 14 }}>
          <table style={{ width: '100%', minWidth: 1400, borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e5e5' }}>
                <th style={thStyle}>Folio</th>
                <th style={thStyle}>Prospecto</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Comisión</th>
                <th style={thStyle} title="Veces que el prospecto abrió su invitación">Vistas</th>
                <th style={thStyle} title="Interés del partner basado en tiempo activo, apertura del contrato, calc, intento de firma">Interés</th>
                <th style={thStyle} title="Última vez que abrió la invitación">Última apertura</th>
                <th style={thStyle} title="Última vez que el partner entró al portal post-aprobación">Actividad</th>
                <th style={thStyle} title="Leads · demos agendadas / realizadas · clientes firmados">Pipeline</th>
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
                      <InterestBadge
                        estado={it.estado}
                        score={Number(it.interest_score || 0)}
                        signatureAttempted={!!it.interest_signature_attempted}
                        contractAccepted={!!it.interest_contract_accepted}
                        modalOpens={Number(it.interest_modal_opens || 0)}
                        activeSeconds={Number(it.interest_active_seconds || 0)}
                        sessions={Number(it.interest_sessions || 0)}
                      />
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
                    {/* Actividad — login del portal post-aprobación */}
                    <td style={tdStyle}>
                      {it.estado !== 'accepted' ? (
                        <span style={{ fontSize: '0.6875rem', color: '#ccc' }}>—</span>
                      ) : it.member_last_login_at ? (
                        <>
                          <div style={{ fontSize: '0.75rem', color: '#0a6b3d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                            {fmtRelative(it.member_last_login_at)}
                          </div>
                          <div style={{ fontSize: '0.625rem', color: '#999', marginTop: 1 }}>{fmtDate(it.member_last_login_at)}</div>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.6875rem', color: '#a06600', fontWeight: 600, fontStyle: 'italic' }}>
                          no ha entrado
                        </span>
                      )}
                    </td>
                    {/* Pipeline — leads · demos · clientes */}
                    <td style={tdStyle}>
                      {it.estado !== 'accepted' ? (
                        <span style={{ fontSize: '0.6875rem', color: '#ccc' }}>—</span>
                      ) : (
                        <PipelineCell
                          leads={Number(it.stats_leads || 0)}
                          demosAg={Number(it.stats_demos_agendadas || 0)}
                          demosRe={Number(it.stats_demos_realizadas || 0)}
                          clientes={Number(it.stats_clientes || 0)}
                        />
                      )}
                    </td>
                    <td style={tdStyle}>{fmtDate(it.vigencia)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 5, alignItems: 'flex-start' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '4px 10px',
                          background: estadoInfo.bg, color: estadoInfo.color,
                          borderRadius: 999,
                          fontSize: '0.6875rem', fontWeight: 700,
                          letterSpacing: '0.04em', textTransform: 'uppercase',
                        }}>{estadoInfo.label}</span>
                        {(() => {
                          const sub = getActivitySubstate(it);
                          if (!sub) return null;
                          return (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '2px 8px',
                              background: sub.bg, color: sub.color,
                              borderRadius: 999,
                              fontSize: '0.625rem', fontWeight: 700,
                              letterSpacing: '0.04em',
                            }}>{sub.label}</span>
                          );
                        })()}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' as const }}>
                      <button
                        data-row-actions-trigger
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          if (openMenu?.id === it.id) {
                            setOpenMenu(null);
                          } else {
                            // Estima la altura del dropdown: ~44px por item × hasta 8 items + 12 padding
                            const ESTIMATED_HEIGHT = 360;
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const spaceAbove = rect.top;
                            const openUp = spaceBelow < ESTIMATED_HEIGHT && spaceAbove > spaceBelow;
                            setOpenMenu({
                              id: it.id,
                              top: openUp ? undefined : rect.bottom + 6,
                              bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
                              right: window.innerWidth - rect.right,
                            });
                          }
                        }}
                        title="Acciones"
                        style={{
                          width: 32, height: 32,
                          padding: 0,
                          background: openMenu?.id === it.id ? '#1a1a1a' : '#fff',
                          color: openMenu?.id === it.id ? '#fff' : '#666',
                          border: '1px solid ' + (openMenu?.id === it.id ? '#1a1a1a' : '#e0e0e0'),
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: '1rem',
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          lineHeight: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 160ms ease, border-color 160ms ease, color 160ms ease',
                        }}
                      >
                        ⋯
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

      {/* Dropdown de acciones del kebab — position fixed para escapar el overflow del table */}
      {openMenu && (() => {
        const it = filtered.find(x => x.id === openMenu.id);
        if (!it) return null;
        const items: Array<{ label: string; onClick: () => void; href?: string; color?: string; bg?: string }> = [
          { label: 'Ver invitación', onClick: () => {}, href: `/partners/invitacion/${it.id}?admin=1` },
          { label: 'Copiar link público', onClick: () => copyLink(it.id) },
          { label: '💬 Copiar mensaje de invitación', onClick: () => copyMensaje(it) },
          { label: 'Editar invitación', onClick: () => { setEditing(it); setShowCreate(true); } },
          { label: '📅 Editar vigencia', onClick: () => abrirVigencia(it) },
        ];
        if (it.estado === 'submitted_for_review') {
          items.push({ label: 'Aprobar invitación', onClick: () => approveInvitation(it), color: '#fff', bg: '#2AB5A0' });
        }
        if (it.estado === 'accepted') {
          items.push({ label: 'Activar Plan Fideliza', onClick: () => provisionFideliza(it), color: '#fff', bg: '#6C5CE7' });
        }
        if (it.estado === 'accepted' || it.estado === 'submitted_for_review') {
          items.push({ label: 'Cambiar / reenviar acceso', onClick: () => setRecoverInvitation(it) });
        }
        if ((it as any).team_member_id) {
          items.push({ label: 'Ver detalle del partner', onClick: () => setDetailPartnerId((it as any).team_member_id) });
        }
        // Cancelar disponible para invitaciones no aceptadas / no canceladas
        const isCancellable = it.estado !== 'cancelled' && it.estado !== 'accepted' && it.estado !== 'declined';
        if (isCancellable) {
          items.push({ label: 'Cancelar invitación', onClick: () => cancelInvitation(it), color: '#a06600' });
        }
        // Eliminar siempre disponible (al final, en rojo)
        items.push({ label: '🗑 Eliminar invitación', onClick: () => deleteInvitation(it), color: '#c94a2c' });
        return (
          <div
            data-row-actions-menu
            role="menu"
            style={{
              position: 'fixed',
              ...(openMenu.top !== undefined ? { top: openMenu.top } : {}),
              ...(openMenu.bottom !== undefined ? { bottom: openMenu.bottom } : {}),
              right: openMenu.right,
              minWidth: 220,
              maxHeight: 'calc(100vh - 24px)',
              overflowY: 'auto' as const,
              background: '#fff',
              border: '1px solid #e5e5e5',
              borderRadius: 12,
              boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.04)',
              padding: 6,
              zIndex: 999,
              animation: 'fadeInMenu 120ms ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item, i) => {
              const styles: React.CSSProperties = {
                display: 'block',
                width: '100%',
                textAlign: 'left' as const,
                padding: '10px 12px',
                background: item.bg || 'transparent',
                color: item.color || '#1a1a1a',
                border: 'none',
                borderRadius: 8,
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'background 120ms ease',
              };
              const handleClick = () => {
                item.onClick();
                if (!item.href) setOpenMenu(null);
              };
              if (item.href) {
                return (
                  <a
                    key={i}
                    href={item.href}
                    target="_blank"
                    rel="noopener"
                    style={styles}
                    onMouseEnter={e => (e.currentTarget.style.background = item.bg ? item.bg : '#fafafa')}
                    onMouseLeave={e => (e.currentTarget.style.background = item.bg || 'transparent')}
                    onClick={() => setOpenMenu(null)}
                  >{item.label}</a>
                );
              }
              return (
                <button
                  key={i}
                  style={styles}
                  onClick={handleClick}
                  onMouseEnter={e => (e.currentTarget.style.background = item.bg ? item.bg : '#fafafa')}
                  onMouseLeave={e => (e.currentTarget.style.background = item.bg || 'transparent')}
                >{item.label}</button>
              );
            })}
          </div>
        );
      })()}

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

      {vigenciaEdit && (
        <div onClick={e => { if (e.target === e.currentTarget) setVigenciaEdit(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 22, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontWeight: 800 }}>Editar vigencia</h3>
              <button onClick={() => setVigenciaEdit(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#666', marginBottom: 12 }}>
              Invitación <b>{vigenciaEdit.numero}</b> de {vigenciaEdit.nombre}. Estará vigente hasta la fecha elegida; {(vigenciaEdit.estado === 'expired' || vigenciaEdit.estado === 'cancelled') ? <b>se reactivará</b> : 'seguirá activa'} y el link público funcionará.
            </div>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#777', display: 'block', marginBottom: 4 }}>Vigente hasta</label>
            <input type="date" value={vigenciaVal} onChange={e => setVigenciaVal(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.9rem', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {[30, 90, 365].map(dd => (
                <button key={dd} type="button" onClick={() => setVigenciaVal(new Date(Date.now() + dd * 86400000).toISOString().slice(0, 10))} style={{ fontSize: '0.72rem', padding: '4px 8px', border: '1px solid #ddd', borderRadius: 6, background: '#fafafa', cursor: 'pointer' }}>+{dd === 365 ? '1 año' : dd + ' días'}</button>
              ))}
            </div>
            <button onClick={guardarVigencia} disabled={vigenciaSaving || !vigenciaVal} style={{ width: '100%', marginTop: 16, padding: '10px 14px', border: 'none', borderRadius: 8, background: '#1A8F7A', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: vigenciaSaving || !vigenciaVal ? 0.6 : 1 }}>{vigenciaSaving ? 'Guardando…' : 'Guardar vigencia'}</button>
          </div>
        </div>
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
              {/* Hero: estado vivo del partner */}
              {(() => {
                const leads = (data.contacts || []).length;
                const demosAg = (data.bookings || []).filter((b: any) => b.estado === 'agendada' || b.estado === 'confirmada').length;
                const demosRe = (data.bookings || []).filter((b: any) => b.estado === 'realizada').length;
                const clientes = (data.deals || []).filter((d: any) => d.stage === 'cerrada_ganada' || d.stage === 'won' || (d.closed_at && d.stage !== 'cerrada_perdida')).length;
                const hasLogin = !!data.member.last_login_at;
                const stateColor = clientes > 0 ? '#0a6b3d' : demosRe > 0 ? '#5b21b6' : demosAg > 0 ? '#1e40af' : leads > 0 ? '#3764c4' : hasLogin ? '#a06600' : '#999';
                const stateLabel =
                  clientes > 0 ? `Produciendo · ${clientes} ${clientes === 1 ? 'cliente' : 'clientes'}`
                  : demosRe > 0 ? `${demosRe} ${demosRe === 1 ? 'demo realizada' : 'demos realizadas'}`
                  : demosAg > 0 ? `${demosAg} ${demosAg === 1 ? 'demo agendada' : 'demos agendadas'}`
                  : leads > 0 ? `${leads} ${leads === 1 ? 'lead atribuido' : 'leads atribuidos'}`
                  : hasLogin ? 'Entró al portal · sin actividad aún'
                  : 'No ha entrado al portal aún';
                return (
                  <section style={{
                    background: `linear-gradient(135deg, ${stateColor}10, ${stateColor}06)`,
                    border: `1px solid ${stateColor}33`,
                    borderRadius: 12,
                    padding: '16px 18px',
                    marginBottom: 16,
                  }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: stateColor + '20', color: stateColor, borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: stateColor }} />
                      {stateLabel}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                      <HeroStat label="Login portal" value={hasLogin ? fmtRelative(data.member.last_login_at) : 'Nunca'} accent={hasLogin ? '#0a6b3d' : '#a06600'} />
                      <HeroStat label="Leads" value={String(leads)} accent="#3764c4" />
                      <HeroStat label="Demos" value={`${demosAg + demosRe}`} sub={`${demosAg} ag · ${demosRe} real`} accent="#5b21b6" />
                      <HeroStat label="Clientes" value={String(clientes)} accent="#0a6b3d" />
                    </div>
                  </section>
                );
              })()}

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

function HeroStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #ececec' }}>
      <div style={{ fontSize: 9, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'Clash Display, Sora, sans-serif', fontSize: 18, fontWeight: 600, color: accent, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>{sub}</div>}
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
    initial_password: '',  // siempre se reinicia en cada edit por seguridad (no persiste en form state)
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
    // Especialidad de nicho (genérico vs especialista de giro). Vive en tabulador.especialidad.
    especialidad: (editing?.tabulador && (editing.tabulador as any).especialidad) || {
      enabled: false,
      giro: 'papeleria',
    },
    // Paquete escalonado de licencias (modo interno). Vive dentro de tabulador.escalonado.
    escalonado: (editing?.tabulador && (editing.tabulador as any).escalonado) || {
      enabled: false,
      resale_price: 14000,
      tiers: [
        { price: 10000, licenses: 3 },
        { price: 18000, licenses: 5 },
        { price: 35000, licenses: 10 },
        { price: 50000, licenses: 15 },
        { price: 70000, licenses: 21 },
        { price: 100000, licenses: 30 },
      ],
    },
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
          { icon: 'leads', title: 'Leads asignados (opcional)', detail: 'No es un compromiso de SACS. Según tu desempeño y tu expertise en un giro, SACS puede empezar a enviarte oportunidades calificadas para que las atiendas y las sumes a tu cartera.', value_label: 'Según desempeño' },
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
      // Empaquetamos escalonado y especialidad dentro de tabulador (la API persiste tabulador como JSON).
      const merged = { ...form, tabulador: { ...(form.tabulador || {}), escalonado: form.escalonado, especialidad: form.especialidad } };
      const body = editing ? { id: editing.id, ...merged } : merged;
      const res = await fetch('/api/partners/invitations', {
        method, headers: { 'Content-Type': 'application/json', 'x-user-id': 'founder' },
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

  // ── Paquete escalonado helpers ──
  function setEsc(key: string, v: any) {
    setForm((p: any) => ({ ...p, escalonado: { ...(p.escalonado || {}), [key]: v } }));
  }
  function updateTier(i: number, key: 'price' | 'licenses', v: number) {
    setForm((p: any) => ({
      ...p,
      escalonado: {
        ...(p.escalonado || {}),
        tiers: (p.escalonado?.tiers || []).map((t: any, idx: number) => idx === i ? { ...t, [key]: v } : t),
      },
    }));
  }
  function addTier() {
    setForm((p: any) => ({
      ...p,
      escalonado: { ...(p.escalonado || {}), tiers: [...(p.escalonado?.tiers || []), { price: 0, licenses: 0 }] },
    }));
  }
  function removeTier(i: number) {
    setForm((p: any) => ({
      ...p,
      escalonado: { ...(p.escalonado || {}), tiers: (p.escalonado?.tiers || []).filter((_: any, idx: number) => idx !== i) },
    }));
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

          {/* Enfoque: genérico vs especialista de nicho */}
          <Section title="Enfoque de la invitación">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => set('especialidad', { ...(form.especialidad || {}), enabled: false })}
                style={{
                  padding: 14,
                  background: !form.especialidad?.enabled ? 'rgba(75,123,229,0.07)' : '#fff',
                  border: '1px solid ' + (!form.especialidad?.enabled ? '#4B7BE5' : '#e5e5e5'),
                  borderRadius: 12, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: !form.especialidad?.enabled ? '#4B7BE5' : '#1a1a1a', marginBottom: 2 }}>
                  Genérico
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#666', lineHeight: 1.4 }}>
                  SACS completo, todos los giros. La invitación estándar.
                </div>
              </button>
              <button
                type="button"
                onClick={() => set('especialidad', { ...(form.especialidad || {}), enabled: true, giro: form.especialidad?.giro || 'papeleria' })}
                style={{
                  padding: 14,
                  background: form.especialidad?.enabled ? 'rgba(34,197,94,0.07)' : '#fff',
                  border: '1px solid ' + (form.especialidad?.enabled ? '#22C55E' : '#e5e5e5'),
                  borderRadius: 12, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: form.especialidad?.enabled ? '#16a34a' : '#1a1a1a', marginBottom: 2 }}>
                  Especialista de nicho
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#666', lineHeight: 1.4 }}>
                  La invitación entera se enfoca a UN giro (papelerías, farmacias…). Mismas reglas de comisión, distinto posicionamiento.
                </div>
              </button>
            </div>
            {form.especialidad?.enabled && (
              <div style={{ marginTop: 12, padding: 16, border: '1px solid rgba(34,197,94,0.3)', background: '#f7fdf9', borderRadius: 10 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>
                  Giro de especialidad
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
                  {Object.values(ESPECIALIDADES).map((e: any) => (
                    <button
                      key={e.giro}
                      type="button"
                      onClick={() => set('especialidad', { ...(form.especialidad || {}), giro: e.giro })}
                      style={{
                        padding: '10px 12px',
                        background: form.especialidad?.giro === e.giro ? e.color + '14' : '#fff',
                        border: '1px solid ' + (form.especialidad?.giro === e.giro ? e.color : '#e5e5e5'),
                        borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: form.especialidad?.giro === e.giro ? e.color : '#1a1a1a' }}>{e.label}</div>
                      <div style={{ fontSize: '0.625rem', color: '#999', marginTop: 2 }}>{e.badge}</div>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: '0.6875rem', color: '#666', lineHeight: 1.5 }}>
                  La invitación mostrará el badge del giro en el hero, el pitch del nicho, las suites
                  del giro (ej. papelería: Suite de Oficina + Suite de Listas Escolares + operación de
                  mostrador) y su mercado objetivo. Comisiones y compromisos no cambian.
                </div>
              </div>
            )}
          </Section>

          {/* Prospecto */}
          <Section title="Prospecto">
            <Grid2>
              <Field label="Nombre completo *" value={form.nombre} onChange={v => set('nombre', v)} placeholder="Mariana López" />
              <Field label="Empresa o marca" value={form.empresa} onChange={v => set('empresa', v)} placeholder="(opcional)" />
              <Field label="Email" type="email" value={form.email} onChange={v => set('email', v)} placeholder="tu@correo.com" />
              <Field label="WhatsApp" value={form.whatsapp} onChange={v => set('whatsapp', v)} placeholder="55 1234 5678" />
            </Grid2>
            <Field
              label="Contraseña inicial (opcional)"
              type="text"
              value={form.initial_password || ''}
              onChange={v => set('initial_password', v)}
              placeholder="Mín. 6 caracteres · ej. SacsPartner2026"
              hint="Si la defines aquí, al aprobar la invitación el partner recibe un email con email + esta contraseña y puede entrar de inmediato a sacscloud.com/partner/login. Si la dejas vacía, recibe un link para crear su propia contraseña."
            />
          </Section>

          {/* Términos económicos */}
          <Section title="Términos económicos">
            <Grid3>
              <Field label="Comisión %" type="number" value={form.comision_pct} onChange={v => set('comision_pct', Number(v) || 0)} />
              <Field label="Moneda" value={form.moneda} onChange={v => set('moneda', v)} />
              <Field label="Vigencia (fecha de cierre)" type="date" value={form.vigencia} onChange={v => set('vigencia', v)} hint={editing ? 'Puedes extender editando esta fecha. El inicio se mantiene en la creación original.' : 'Inicio se cuenta desde hoy (creación de la invitación).'} />
            </Grid3>
            <Field
              label="Monto de entrada · pago único"
              type="number"
              value={form.costo_unico}
              onChange={v => set('costo_unico', Number(v) || 0)}
              placeholder="0 = invitación gratis"
              hint={`Déjalo en 0 para una invitación gratis. Si pones un monto (en ${form.moneda || 'MXN'}), la invitación se vuelve "de cobro": en vez de "gratis / sin costo" aparece esa inversión única de entrada en toda la invitación — resumen, términos económicos, FAQ y el contrato. La prueba gratis del cliente, los bonos y la cuenta Fideliza ($14k/año) siguen siendo gratis.`}
            />
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

            {/* Paquete escalonado de licencias — modo interno, no público */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '14px 16px', marginTop: 12,
              border: form.escalonado?.enabled ? '1.5px solid #6C5CE7' : '1px solid #ececec',
              background: form.escalonado?.enabled ? 'rgba(108,92,231,0.06)' : '#fafafa',
              borderRadius: 10, cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}>
              <input
                type="checkbox"
                checked={!!form.escalonado?.enabled}
                onChange={e => setEsc('enabled', e.target.checked)}
                style={{ marginTop: 3, accentColor: '#6C5CE7', width: 16, height: 16, flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', color: '#1a1a1a', marginBottom: 4 }}>
                  Paquete escalonado de licencias <span style={{ fontSize: '0.6875rem', color: '#6C5CE7', fontWeight: 700, letterSpacing: '0.04em' }}>· INTERNO</span>
                </span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#666', lineHeight: 1.5 }}>
                  El partner compra licencias Fideliza al mayoreo y las revende a precio público. Cuando se activa,
                  la invitación reemplaza el enfoque de comisión por la reventa de paquetes y muestra las ganancias.
                  No aparece en ninguna página pública — solo en esta invitación.
                </span>
              </span>
            </label>

            {form.escalonado?.enabled && (
              <div style={{ marginTop: 12, padding: 16, border: '1px solid rgba(108,92,231,0.25)', background: '#fbfaff', borderRadius: 10 }}>
                <Field
                  label="Precio de reventa por licencia (precio público Fideliza)"
                  type="number"
                  value={form.escalonado.resale_price}
                  onChange={v => setEsc('resale_price', Number(v) || 0)}
                  hint="A este precio el partner revende cada licencia a sus clientes. Por defecto $14,000/año."
                />
                <div style={{ marginTop: 14, fontSize: '0.75rem', fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Niveles · inversión → licencias
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(form.escalonado.tiers || []).map((t: any, i: number) => {
                    const resale = Number(form.escalonado.resale_price) || 0;
                    const profit = resale * Number(t.licenses || 0) - Number(t.price || 0);
                    return (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', color: '#999' }}>$</span>
                        <input type="number" value={t.price} onChange={e => updateTier(i, 'price', Number(e.target.value) || 0)}
                          style={{ width: 100, padding: '8px 10px', fontSize: '0.8125rem', border: '1px solid #ddd', borderRadius: 8, outline: 'none' }} placeholder="inversión" />
                        <span style={{ fontSize: '0.75rem', color: '#999' }}>→</span>
                        <input type="number" value={t.licenses} onChange={e => updateTier(i, 'licenses', Number(e.target.value) || 0)}
                          style={{ width: 70, padding: '8px 10px', fontSize: '0.8125rem', border: '1px solid #ddd', borderRadius: 8, outline: 'none' }} placeholder="lic." />
                        <span style={{ fontSize: '0.75rem', color: '#666' }}>licencias</span>
                        <span style={{ fontSize: '0.75rem', color: profit >= 0 ? '#0a6b3d' : '#c0392b', fontWeight: 600, marginLeft: 'auto' }}>
                          ganancia ${Math.round(profit).toLocaleString('es-MX')}
                        </span>
                        <button type="button" onClick={() => removeTier(i)} title="Quitar nivel"
                          style={{ width: 28, height: 28, border: '1px solid #eee', background: '#fff', borderRadius: 6, color: '#c0392b', cursor: 'pointer', fontSize: '0.875rem', lineHeight: 1 }}>×</button>
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={addTier}
                  style={{ marginTop: 10, padding: '7px 14px', fontSize: '0.75rem', fontWeight: 600, background: 'transparent', color: '#6C5CE7', border: '1px solid rgba(108,92,231,0.4)', borderRadius: 8, cursor: 'pointer' }}>
                  + Agregar nivel
                </button>
              </div>
            )}
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

/** Celda compacta con leads · demos · clientes del partner. */
function PipelineCell({ leads, demosAg, demosRe, clientes }: {
  leads: number; demosAg: number; demosRe: number; clientes: number;
}) {
  if (!leads && !demosAg && !demosRe && !clientes) {
    return <span style={{ fontSize: '0.6875rem', color: '#bbb', fontStyle: 'italic' }}>sin actividad aún</span>;
  }
  const Pill = ({ n, label, color, bg }: { n: number; label: string; color: string; bg: string }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 3,
      padding: '2px 7px',
      background: bg, color,
      borderRadius: 6,
      fontSize: '0.6875rem', fontWeight: 700,
      lineHeight: 1.3,
    }}
    title={label}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8125rem' }}>{n}</span>
      <span style={{ fontSize: '0.5625rem', fontWeight: 600, opacity: 0.8, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{label}</span>
    </span>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4 }}>
      {leads > 0    && <Pill n={leads}    label="leads"    color="#3764c4" bg="rgba(75,123,229,0.12)" />}
      {demosAg > 0  && <Pill n={demosAg}  label="agend."   color="#5b21b6" bg="rgba(139,92,246,0.12)" />}
      {demosRe > 0  && <Pill n={demosRe}  label="realiz."  color="#7c3aed" bg="rgba(139,92,246,0.18)" />}
      {clientes > 0 && <Pill n={clientes} label="clientes" color="#0a6b3d" bg="rgba(16,185,129,0.16)" />}
    </div>
  );
}

function InterestBadge({
  estado, score, signatureAttempted, contractAccepted, modalOpens, activeSeconds, sessions,
}: {
  estado?: string;
  score: number; signatureAttempted: boolean; contractAccepted: boolean;
  modalOpens: number; activeSeconds: number; sessions: number;
}) {
  // Si la persona ya firmó (submitted_for_review) o ya está aprobada (accepted),
  // el "interés" pre-firma deja de ser información viva — pasamos a mostrar
  // que la firma quedó hecha. No tiene sentido seguir diciendo "casi firma"
  // cuando ya firmó.
  if (estado === 'submitted_for_review' || estado === 'accepted') {
    const isApproved = estado === 'accepted';
    return (
      <span
        title={isApproved ? 'Firmó la invitación y fue aprobada como partner' : 'Firmó la invitación · pendiente de aprobación del founder'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px',
          background: 'rgba(16,185,129,0.12)', color: '#0a6b3d',
          borderRadius: 999,
          fontSize: '0.75rem', fontWeight: 700,
          letterSpacing: '0.02em',
        }}>
        <span aria-hidden="true">✓</span>
        <span>FIRMÓ</span>
      </span>
    );
  }
  if (estado === 'declined') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px',
        background: 'rgba(229,75,75,0.10)', color: '#b93333',
        borderRadius: 999,
        fontSize: '0.75rem', fontWeight: 700,
        letterSpacing: '0.02em',
      }}>
        <span aria-hidden="true">✕</span>
        <span>RECHAZÓ</span>
      </span>
    );
  }
  if (score === 0 && !signatureAttempted && sessions === 0) {
    return <span style={{ fontSize: '0.75rem', color: '#bbb', fontStyle: 'italic' }}>—</span>;
  }
  let icon = '❄️', bg = '#f0f4ff', fg = '#5a6c8a';
  if (score >= 75) { icon = '🔥'; bg = '#fff1ee'; fg = '#c94a2c'; }
  else if (score >= 50) { icon = '✨'; bg = '#fff8e1'; fg = '#b8870b'; }
  else if (score >= 25) { icon = '👀'; bg = '#eef9f6'; fg = '#1A8F7A'; }

  const mins = Math.floor(activeSeconds / 60);
  const tooltip = [
    `Score: ${score}/100`,
    `Tiempo activo: ${mins} min`,
    `Sesiones: ${sessions}`,
    `Abrió contrato: ${modalOpens} vez(es)`,
    contractAccepted ? '✓ Marcó "he leído íntegramente"' : null,
    signatureAttempted ? '✓ Intentó firmar (no completó)' : null,
  ].filter(Boolean).join('\n');

  return (
    <span title={tooltip} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px',
      background: bg, color: fg,
      borderRadius: 999,
      fontSize: '0.75rem', fontWeight: 700,
      letterSpacing: '0.02em',
    }}>
      <span aria-hidden="true">{icon}</span>
      <span>{score}</span>
      {signatureAttempted && <span style={{ fontSize: '0.625rem', color: '#c94a2c', fontWeight: 700, letterSpacing: '0.08em' }}>· CASI FIRMA</span>}
    </span>
  );
}

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
  // Fijar contraseña manualmente
  const [settingPassword, setSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwResult, setPwResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const teamMemberId = (invitation as any).team_member_id as string | undefined;

  async function setManualPassword() {
    if (newPassword.length < 8) {
      setPwResult({ ok: false, msg: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    setPwBusy(true); setPwResult(null);
    try {
      const res = await fetch('/api/partners/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'founder' },
        body: JSON.stringify({ team_member_id: teamMemberId, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setPwResult({
        ok: true,
        msg: `✓ Contraseña fijada para ${data.email}. El partner ya puede entrar en sacscloud.com/partner/login con esa contraseña. (Sus sesiones anteriores se cerraron.)`,
      });
      setSettingPassword(false);
      setNewPassword('');
    } catch (e: any) {
      setPwResult({ ok: false, msg: e.message || String(e) });
    } finally {
      setPwBusy(false);
    }
  }

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
              {teamMemberId && (
                <button onClick={() => { setSettingPassword(s => !s); setPwResult(null); }} disabled={busy} style={{
                  padding: '11px 18px', fontSize: 13, fontWeight: 600,
                  background: settingPassword ? '#1a1a1a' : 'transparent', color: settingPassword ? '#fff' : '#1a1a1a',
                  border: '1px solid ' + (settingPassword ? '#1a1a1a' : '#ddd'), borderRadius: 8, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}>Fijar contraseña</button>
              )}
            </div>

            {settingPassword && (
              <div style={{ marginTop: 14, padding: 14, background: '#f7f8fa', border: '1px solid #e5e5e5', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8, lineHeight: 1.5 }}>
                  Escribe la contraseña que quieres asignarle (mín. 8 caracteres). Anótala — no se vuelve a mostrar.
                  Sus sesiones activas se cerrarán y deberá entrar con la nueva contraseña.
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="nueva contraseña"
                    autoComplete="off"
                    style={{ flex: 1, minWidth: 200, padding: '11px 14px', fontSize: 14, fontFamily: 'monospace', border: '1px solid #ddd', borderRadius: 8, outline: 'none' }}
                  />
                  <button onClick={setManualPassword} disabled={pwBusy} style={{
                    padding: '11px 18px', fontSize: 13, fontWeight: 600,
                    background: '#1a1a1a', color: '#fff',
                    border: 'none', borderRadius: 8, cursor: pwBusy ? 'wait' : 'pointer', fontFamily: 'inherit',
                  }}>{pwBusy ? 'Guardando…' : 'Guardar'}</button>
                </div>
              </div>
            )}

            {pwResult && (
              <div style={{
                marginTop: 14, padding: '12px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
                background: pwResult.ok ? 'rgba(42,181,160,0.10)' : 'rgba(229,75,75,0.10)',
                color: pwResult.ok ? '#1A8F7A' : '#b93333',
                border: `1px solid ${pwResult.ok ? 'rgba(42,181,160,0.25)' : 'rgba(229,75,75,0.25)'}`,
              }}>{pwResult.msg}</div>
            )}
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
  // Fijar contraseña manualmente
  const [settingPassword, setSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwResult, setPwResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function setManualPassword() {
    if (newPassword.length < 8) {
      setPwResult({ ok: false, msg: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    setPwBusy(true); setPwResult(null);
    try {
      const res = await fetch('/api/partners/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'founder' },
        body: JSON.stringify({ team_member_id: memberId, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setPwResult({
        ok: true,
        msg: `✓ Contraseña fijada para ${data.email}. El partner ya puede entrar en ${data.login_url} con esa contraseña. (Sus sesiones anteriores se cerraron.)`,
      });
      setSettingPassword(false);
      setNewPassword('');
    } catch (e: any) {
      setPwResult({ ok: false, msg: e.message || String(e) });
    } finally {
      setPwBusy(false);
    }
  }

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
          <button
            onClick={() => { setSettingPassword(true); setPwResult(null); }}
            disabled={busy}
            style={{
              padding: '10px 16px', fontSize: 13, fontWeight: 600,
              background: 'transparent', color: '#1a1a1a',
              border: '1px solid #ddd', borderRadius: 8, cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Fijar contraseña manualmente
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

      {settingPassword && (
        <div style={{ marginTop: 14, padding: 14, background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 8, lineHeight: 1.5 }}>
            Escribe la contraseña que quieres asignarle a <strong style={{ color: '#1a1a1a' }}>{memberName}</strong> (mín. 8 caracteres).
            Anótala — no se vuelve a mostrar. Sus sesiones activas se cerrarán y deberá entrar con la nueva contraseña.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="nueva contraseña"
              autoComplete="off"
              style={{
                flex: 1, minWidth: 220,
                padding: '10px 14px', fontSize: 14, fontFamily: 'monospace',
                border: '1px solid #ddd', borderRadius: 8, outline: 'none',
              }}
            />
            <button
              onClick={setManualPassword}
              disabled={pwBusy}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 600,
                background: '#1a1a1a', color: '#fff',
                border: 'none', borderRadius: 8, cursor: pwBusy ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >{pwBusy ? 'Guardando…' : 'Guardar contraseña'}</button>
            <button
              onClick={() => { setSettingPassword(false); setNewPassword(''); }}
              disabled={pwBusy}
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

      {pwResult && (
        <div style={{
          marginTop: 14, padding: '12px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
          background: pwResult.ok ? 'rgba(42,181,160,0.10)' : 'rgba(229,75,75,0.10)',
          color: pwResult.ok ? '#1A8F7A' : '#b93333',
          border: `1px solid ${pwResult.ok ? 'rgba(42,181,160,0.25)' : 'rgba(229,75,75,0.25)'}`,
        }}>
          {pwResult.msg}
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
