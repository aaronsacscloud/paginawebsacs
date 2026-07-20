import { useState, useEffect, useCallback, useContext, createContext } from 'react';

// ─── Types ───
interface EventType {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  duracion_minutos: number;
  buffer_antes_minutos: number;
  buffer_despues_minutos: number;
  aviso_minimo_horas: number;
  max_reservas_dia: number | null;
  max_dias_adelanto: number;
  tipo_reunion: string;
  ubicacion_tipo: string;
  color: string;
  owner_id: string | null;
  activo: boolean;
  routing_rules?: Record<string, any> | null;
}

interface Booking {
  id: string;
  created_at: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  invitee_nombre: string;
  invitee_email: string;
  invitee_whatsapp: string | null;
  invitee_empresa: string | null;
  estado: string;
  google_meet_link: string | null;
  contact_id: string | null;
  deal_id: string | null;
  notas?: string | null;
  answers?: Record<string, string> | null;
  event_types?: { nombre: string; duracion_minutos: number; color: string };
}

interface AvailabilitySlot {
  dia_semana: number; // 0=Lun, 1=Mar ... 6=Dom
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

interface AvailabilityOverride {
  id: string;
  fecha: string;
  tipo: 'bloqueo' | 'especial';
  hora_inicio: string | null;
  hora_fin: string | null;
}

interface BookingQuestion {
  id: string;
  event_type_id: string;
  tipo: string;
  label: string;
  placeholder: string | null;
  required: boolean;
  options: string[] | null;
  orden: number;
  activo: boolean;
}

// ─── Constants ───
const DIA_LABELS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  no_show: 'No show',
  cancelada: 'Cancelada',
  reagendada: 'Reagendada',
};
const ESTADO_COLORS: Record<string, string> = {
  pendiente: '#E8A838',
  confirmada: '#4B7BE5',
  realizada: '#2e7d32',
  no_show: '#DC2626',
  cancelada: '#999',
  reagendada: '#6C5CE7',
};
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const BUFFER_OPTIONS = [0, 5, 10, 15];
const AVISO_OPTIONS = [1, 2, 4, 8, 24];
const MAX_DIAS_OPTIONS = [7, 14, 30, 60];
const UBICACION_OPTIONS = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telefono', label: 'Telefono' },
  { value: 'presencial', label: 'Presencial' },
];
const PRESET_COLORS = ['#4B7BE5', '#2AB5A0', '#6C5CE7', '#E8A838', '#DC2626', '#059669'];

const DEFAULT_EMAIL_CONFIG: Record<string, any> = {
  confirmation: { subject: '\u2705 Tu demo con SACS est\u00e1 confirmada', heading: '\u00a1Tu demo est\u00e1 confirmada!', body: 'Hola {{nombre}}, tu reuni\u00f3n con SACS ha sido agendada.', show_meet_link: true, show_reschedule_link: true, show_cancel_link: true },
  reminder_24h: { subject: '\u23f0 Recordatorio: Tu demo es ma\u00f1ana', heading: 'Recordatorio: Tu demo es ma\u00f1ana', body: 'Hola {{nombre}}, te recordamos tu reuni\u00f3n con SACS.', enabled: true },
  reminder_1h: { subject: '\u23f0 Tu demo empieza en 1 hora', heading: 'Tu demo empieza en 1 hora', body: 'Hola {{nombre}}, tu reuni\u00f3n empieza pronto.', enabled: true },
  cancellation: { subject: 'Tu reuni\u00f3n con SACS ha sido cancelada', heading: 'Tu reuni\u00f3n ha sido cancelada', body: 'La reuni\u00f3n ha sido cancelada.', show_suggestions: true },
  reschedule: { subject: '\u2705 Tu reuni\u00f3n ha sido reagendada', heading: 'Tu reuni\u00f3n ha sido reagendada', body: 'Tu reuni\u00f3n con SACS ha sido movida a una nueva fecha.' },
};

const EMAIL_TABS: { key: string; label: string }[] = [
  { key: 'confirmation', label: 'Confirmaci\u00f3n' },
  { key: 'reminder_24h', label: 'Recordatorio 24h' },
  { key: 'reminder_1h', label: 'Recordatorio 1h' },
  { key: 'cancellation', label: 'Cancelaci\u00f3n' },
  { key: 'reschedule', label: 'Reagendamiento' },
];

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ─── Shared Styles ───
const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem',
  fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: 'none',
  cursor: 'pointer', fontFamily: 'inherit',
};
const input: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: '0.8125rem',
  border: '1px solid #e0e0e0', borderRadius: 8, outline: 'none',
  fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' as const,
};
const selectStyle: React.CSSProperties = {
  ...input,
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 32,
};
const label: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: '#555', marginBottom: 4,
};
const td: React.CSSProperties = { padding: '10px 14px', color: '#555', fontSize: '0.8125rem' };
const thStyle: React.CSSProperties = {
  padding: '10px 14px', fontSize: '0.6875rem', fontWeight: 700,
  color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  textAlign: 'left' as const, borderBottom: '1px solid #f0f0f0',
};
const card: React.CSSProperties = {
  background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0',
  padding: 20, marginBottom: 12,
};
const modalOverlay: React.CSSProperties = {
  position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.3)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 16,
};
const modalContent: React.CSSProperties = {
  background: '#fff', borderRadius: 14, maxWidth: 520, width: '100%',
  maxHeight: '90vh', overflowY: 'auto' as const, padding: 28,
};

// ─── Helpers ───
// Variant context para que sub-componentes sepan si son admin o partner.
// El helper schedFetch que retorna useSchedFetch() inyecta el header
// `x-user-id: founder` SOLO en variant='admin' (la página /admin/crm no
// tiene cookie de sesión, depende del header). Para variant='partner' NO
// se envía el header — si la cookie sacs_session expiró, los endpoints
// retornan 401 (correcto) en lugar de tratar al partner como founder.
const SchedulingVariantContext = createContext<SchedulingHubVariant>('admin');

function useSchedFetch() {
  const variant = useContext(SchedulingVariantContext);
  return useCallback((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers as HeadersInit | undefined);
    if (variant === 'admin' && !headers.has('x-user-id')) {
      headers.set('x-user-id', 'founder');
    }
    return fetch(input, { ...init, headers, credentials: 'same-origin' });
  }, [variant]);
}

function fmtDate(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-').map(Number);
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${day} ${months[m - 1]} ${y}`;
}

function fmtTime(t: string): string {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Main Component ───
//
// Compartido entre el CRM admin (CrmDashboard) y el partner portal (AgendaTab).
// El scope de qué bookings/event_types/availability se muestran lo aplica el
// backend (src/lib/scheduling/scope.ts) basándose en getCurrentUser():
//   - Partner (rol=partner): solo ve/edita sus propios recursos
//   - Founder/CS: ven/editan todo
// Por eso aquí el variant solo afecta UI (etiquetas, qué subtabs mostrar).
//
// Cualquier mejora a este componente se propaga al admin y al partner.

export type SchedulingHubVariant = 'admin' | 'partner';

export default function SchedulingHub({ variant = 'admin' }: { variant?: SchedulingHubVariant } = {}) {
  // Admin: la operación diaria vive en CRM → Ventas → Reuniones; aquí solo
  // queda la CONFIGURACIÓN (tipos, disponibilidad, stats). Partner conserva sus citas.
  const [subTab, setSubTab] = useState<'reservas' | 'tipos' | 'disponibilidad' | 'estadisticas'>(variant === 'admin' ? 'tipos' : 'reservas');

  // Partner no necesita "Estadísticas" globales (reporting cross-team admin).
  const subTabs = variant === 'admin'
    ? [
        { id: 'tipos' as const, label: 'Tipos de Evento' },
        { id: 'disponibilidad' as const, label: 'Disponibilidad' },
        { id: 'estadisticas' as const, label: 'Estadisticas' },
      ]
    : [
        { id: 'reservas' as const, label: 'Mis citas' },
        { id: 'tipos' as const, label: 'Tipos de evento' },
        { id: 'disponibilidad' as const, label: 'Disponibilidad' },
      ];

  return (
    <SchedulingVariantContext.Provider value={variant}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Sub-tab nav */}
      <div className="sh-subtab-nav" style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f0f0f0', background: '#fff', padding: '0 24px' }}>
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              ...btn,
              background: 'none',
              borderRadius: 0,
              padding: '12px 16px',
              color: subTab === t.id ? '#1A1A1A' : '#999',
              fontWeight: subTab === t.id ? 700 : 500,
              borderBottom: subTab === t.id ? '2px solid #4B7BE5' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="sh-content" style={{ flex: 1, overflow: 'auto' }}>
        {subTab === 'reservas' && <ReservasView />}
        {subTab === 'tipos' && <TiposEventoView />}
        {subTab === 'disponibilidad' && <DisponibilidadView variant={variant} />}
        {subTab === 'estadisticas' && variant === 'admin' && <EstadisticasView />}
      </div>
    </div>

    {/* CSS responsive — apunta a clases que asignamos a los grids más críticos
        + selectores genéricos por estructura. Aplica al admin y al partner. */}
    <style dangerouslySetInnerHTML={{ __html: `
      @media (max-width: 640px) {
        /* Padding del contenedor scrolleable interno */
        .sh-content > div { padding-left: 14px !important; padding-right: 14px !important; }
        /* Sub-tab nav scrolleable horizontal */
        .sh-content { -webkit-overflow-scrolling: touch; }
        /* Grids 1fr 1fr → 1fr */
        .sh-grid-2 { grid-template-columns: 1fr !important; }
        .sh-grid-3 { grid-template-columns: 1fr !important; }
        /* Tabla con scroll horizontal */
        .sh-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .sh-table-wrap table { min-width: 540px; }
        /* Modal full-screen en mobile */
        .sh-modal-content {
          max-height: 100vh !important;
          height: 100vh !important;
          border-radius: 0 !important;
          padding: 18px !important;
        }
        .sh-modal-overlay { padding: 0 !important; }
        /* Cards en EventType list */
        .sh-event-card-grid { grid-template-columns: 1fr !important; }
        /* Sub-tab buttons touch-friendly */
        .sh-subtab-nav { overflow-x: auto; -webkit-overflow-scrolling: touch; white-space: nowrap; }
        .sh-subtab-nav button { flex-shrink: 0; }
      }
    ` }} />
    </SchedulingVariantContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════
// Sub-tab 1: Reservas
// ═══════════════════════════════════════════════════════════
function ReservasView() {
  const schedFetch = useSchedFetch();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterEstado, setFilterEstado] = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterEstado) params.set('estado', filterEstado);
      if (filterEventType) params.set('event_type_id', filterEventType);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);

      const [bRes, etRes] = await Promise.all([
        schedFetch(`/api/scheduling/bookings?${params.toString()}`),
        schedFetch('/api/scheduling/event-types'),
      ]);
      const bData = await bRes.json();
      const etData = await etRes.json();
      setBookings(Array.isArray(bData) ? bData : []);
      setEventTypes(Array.isArray(etData) ? etData : []);
    } catch {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterEstado, filterEventType, filterFrom, filterTo]);

  const updateBookingEstado = async (bookingId: string, estado: string) => {
    await schedFetch('/api/scheduling/bookings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bookingId, estado }),
    });
    load();
  };

  const cancelBooking = async (bookingId: string) => {
    await schedFetch('/api/scheduling/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, admin: 1 }),
    });
    load();
  };

  const rescheduleBooking = async (bookingId: string) => {
    const newDate = prompt('Nueva fecha (YYYY-MM-DD):', new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    if (!newDate) return;
    const newTime = prompt('Nueva hora (HH:MM):', '10:00');
    if (!newTime) return;
    await schedFetch(`/api/scheduling/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId, nueva_fecha: newDate, nueva_hora: newTime, timezone: 'America/Mexico_City' }),
    });
    load();
  };

  // Stats
  const total = bookings.length;
  const proximas = bookings.filter(b => b.estado === 'pendiente' || b.estado === 'confirmada').length;
  const realizadas = bookings.filter(b => b.estado === 'realizada').length;
  const noShow = bookings.filter(b => b.estado === 'no_show').length;
  const canceladas = bookings.filter(b => b.estado === 'cancelada').length;

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, padding: '16px 24px', background: '#fff', borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap' }}>
        {[
          { l: 'Total', v: total, c: '#1A1A1A' },
          { l: 'Proximas', v: proximas, c: '#4B7BE5' },
          { l: 'Realizadas', v: realizadas, c: '#2e7d32' },
          { l: 'No-show', v: noShow, c: '#DC2626' },
          { l: 'Canceladas', v: canceladas, c: '#999' },
        ].map(s => (
          <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: s.c }}>{s.v}</span>
            <span style={{ fontSize: '0.625rem', color: '#999', fontWeight: 500 }}>{s.l}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={load} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>↻</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 24px', background: '#FAFAF8', borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} style={{ ...selectStyle, width: 'auto', marginBottom: 0, minWidth: 130 }}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filterEventType} onChange={e => setFilterEventType(e.target.value)} style={{ ...selectStyle, width: 'auto', marginBottom: 0, minWidth: 150 }}>
          <option value="">Todos los tipos</option>
          {eventTypes.map(et => (
            <option key={et.id} value={et.id}>{et.nombre}</option>
          ))}
        </select>
        <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ ...input, width: 'auto', marginBottom: 0 }} placeholder="Desde" />
        <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ ...input, width: 'auto', marginBottom: 0 }} placeholder="Hasta" />
      </div>

      {/* Table */}
      <div style={{ padding: '16px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>Cargando...</div>
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
            title="Aún no tienes citas"
            description="Cuando un cliente agende contigo via tu link público, las reservas aparecerán aquí. Configura tipos de evento y disponibilidad para empezar."
          />
        ) : (
          <div className="sh-table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Hora</th>
                <th style={thStyle}>Invitado</th>
                <th style={thStyle}>Empresa</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  expanded={expandedId === b.id}
                  onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)}
                  onMarkRealizada={() => updateBookingEstado(b.id, 'realizada')}
                  onMarkNoShow={() => updateBookingEstado(b.id, 'no_show')}
                  onCancel={() => cancelBooking(b.id)}
                  onReschedule={() => rescheduleBooking(b.id)}
                />
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BookingRow({
  booking: b,
  expanded,
  onToggle,
  onMarkRealizada,
  onMarkNoShow,
  onCancel,
  onReschedule,
}: {
  booking: Booking;
  expanded: boolean;
  onToggle: () => void;
  onMarkRealizada: () => void;
  onMarkNoShow: () => void;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  const estadoColor = ESTADO_COLORS[b.estado] || '#999';
  const estadoLabel = ESTADO_LABELS[b.estado] || b.estado;
  const isActionable = b.estado === 'pendiente' || b.estado === 'confirmada';

  return (
    <>
      <tr
        onClick={onToggle}
        style={{ cursor: 'pointer', borderBottom: expanded ? 'none' : '1px solid #f0f0f0' }}
      >
        <td style={td}>{fmtDate(b.fecha)}</td>
        <td style={td}>{fmtTime(b.hora_inicio)}</td>
        <td style={{ ...td, fontWeight: 600, color: '#1A1A1A' }}>{b.invitee_nombre}</td>
        <td style={td}>{b.invitee_empresa || '—'}</td>
        <td style={td}>
          {b.event_types && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.event_types.color }} />
              {b.event_types.nombre}
            </span>
          )}
        </td>
        <td style={td}>
          <span style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 6,
            fontSize: '0.6875rem',
            fontWeight: 700,
            background: estadoColor + '18',
            color: estadoColor,
          }}>
            {estadoLabel}
          </span>
        </td>
        <td style={td} onClick={(e) => e.stopPropagation()}>
          {isActionable && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={onMarkRealizada} style={{ ...btn, background: '#ECFDF5', color: '#059669', padding: '4px 8px', fontSize: '0.6875rem' }}>
                Realizada
              </button>
              <button onClick={onMarkNoShow} style={{ ...btn, background: '#FEF2F2', color: '#DC2626', padding: '4px 8px', fontSize: '0.6875rem' }}>
                No show
              </button>
              <button onClick={onReschedule} style={{ ...btn, background: '#fff3e0', color: '#e65100', padding: '4px 8px', fontSize: '0.6875rem' }}>
                Reagendar
              </button>
              <button onClick={onCancel} style={{ ...btn, background: '#f5f5f5', color: '#999', padding: '4px 8px', fontSize: '0.6875rem' }}>
                Cancelar
              </button>
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
          <td colSpan={7} style={{ padding: '12px 14px', background: '#FAFAF8' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: '0.8125rem' }}>
              <div>
                <span style={{ color: '#999', fontWeight: 600, fontSize: '0.6875rem', display: 'block', marginBottom: 2 }}>EMAIL</span>
                <span style={{ color: '#555' }}>{b.invitee_email}</span>
              </div>
              {b.invitee_whatsapp && (
                <div>
                  <span style={{ color: '#999', fontWeight: 600, fontSize: '0.6875rem', display: 'block', marginBottom: 2 }}>WHATSAPP</span>
                  <span style={{ color: '#555' }}>{b.invitee_whatsapp}</span>
                </div>
              )}
              {b.google_meet_link && (
                <div>
                  <span style={{ color: '#999', fontWeight: 600, fontSize: '0.6875rem', display: 'block', marginBottom: 2 }}>GOOGLE MEET</span>
                  <a href={b.google_meet_link} target="_blank" rel="noopener noreferrer" style={{ color: '#4B7BE5', textDecoration: 'none', fontWeight: 600 }}>
                    {b.google_meet_link}
                  </a>
                </div>
              )}
              {b.notas && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#999', fontWeight: 600, fontSize: '0.6875rem', display: 'block', marginBottom: 2 }}>NOTAS</span>
                  <span style={{ color: '#555' }}>{b.notas}</span>
                </div>
              )}
              {b.answers && Object.keys(b.answers).length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#999', fontWeight: 600, fontSize: '0.6875rem', display: 'block', marginBottom: 4 }}>RESPUESTAS</span>
                  {Object.entries(b.answers).map(([k, v]) => (
                    <div key={k} style={{ color: '#555', marginBottom: 2 }}>
                      <strong>{k}:</strong> {v}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── EmptyState reusable ───
function EmptyState({
  icon, title, description, cta,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{
      textAlign: 'center' as const, padding: '56px 24px',
      background: '#fafbfd', borderRadius: 12, border: '1px dashed #e5e7eb',
      maxWidth: 420, margin: '24px auto',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%', background: '#fff',
        border: '1px solid #e8eaf0', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        color: '#4B7BE5',
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1A1A1A', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: '0.8125rem', color: '#666', lineHeight: 1.55, marginBottom: cta ? 18 : 0 }}>
        {description}
      </div>
      {cta && (
        <button
          onClick={cta.onClick}
          style={{
            padding: '10px 22px', background: '#4B7BE5', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {cta.label}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Sub-tab 2: Tipos de Evento
// ═══════════════════════════════════════════════════════════
function TiposEventoView() {
  const schedFetch = useSchedFetch();
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EventType | null>(null);
  const [showQuestionsFor, setShowQuestionsFor] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await schedFetch('/api/scheduling/event-types');
      const data = await res.json();
      setEventTypes(Array.isArray(data) ? data : []);
    } catch {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActivo = async (et: EventType) => {
    await schedFetch('/api/scheduling/event-types', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: et.id, activo: !et.activo }),
    });
    load();
  };

  const copyLink = (slug: string) => {
    const link = `${window.location.origin}/agendar/${slug}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div style={{ padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#1A1A1A' }}>Tipos de Evento</h3>
        <button onClick={() => { setEditing(null); setShowModal(true); }} style={{ ...btn, background: '#1a1a1a', color: '#fff' }}>
          + Nuevo tipo
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>Cargando...</div>
      ) : eventTypes.length === 0 ? (
        <EmptyState
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
          title="Aún no tienes tipos de evento"
          description="Los tipos de evento definen qué puede agendar tu cliente (ej. demo 30 min, consultoría 60 min). Cada uno tiene su propio link público."
          cta={{ label: '+ Crear primer tipo', onClick: () => { setEditing(null); setShowModal(true); } }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {eventTypes.map(et => (
            <div key={et.id} style={{ ...card, position: 'relative' as const, opacity: et.activo ? 1 : 0.6 }}>
              {/* Color bar */}
              <div style={{ position: 'absolute' as const, top: 0, left: 0, right: 0, height: 4, background: et.color, borderRadius: '12px 12px 0 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 700, color: '#1A1A1A' }}>
                    {et.nombre}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#999' }}>/{et.slug}</p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#999' }}>{et.activo ? 'Activo' : 'Inactivo'}</span>
                  <div
                    onClick={() => toggleActivo(et)}
                    style={{
                      width: 36,
                      height: 20,
                      borderRadius: 10,
                      background: et.activo ? '#4B7BE5' : '#E0E0E0',
                      position: 'relative' as const,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute' as const,
                      top: 2,
                      left: et.activo ? 18 : 2,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }} />
                  </div>
                </label>
              </div>

              {et.descripcion && (
                <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: '#777', lineHeight: 1.4 }}>
                  {et.descripcion}
                </p>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: '0.6875rem', fontWeight: 600, color: '#777',
                  background: '#f5f5f5', padding: '4px 8px', borderRadius: 6,
                }}>
                  {et.duracion_minutos} min
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: '0.6875rem', fontWeight: 600, color: '#777',
                  background: '#f5f5f5', padding: '4px 8px', borderRadius: 6,
                }}>
                  {UBICACION_OPTIONS.find(u => u.value === et.ubicacion_tipo)?.label || et.ubicacion_tipo}
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: '0.6875rem', fontWeight: 600, color: '#777',
                  background: '#f5f5f5', padding: '4px 8px', borderRadius: 6,
                }}>
                  {et.max_dias_adelanto}d adelanto
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
                <button
                  onClick={() => { setEditing(et); setShowModal(true); }}
                  style={{ ...btn, background: '#f5f5f5', color: '#555', flex: 1, justifyContent: 'center' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => copyLink(et.slug)}
                  style={{ ...btn, background: '#EBF1FC', color: '#4B7BE5', flex: 1, justifyContent: 'center' }}
                >
                  {copied === et.slug ? 'Copiado!' : 'Copiar link'}
                </button>
                <button
                  onClick={() => setShowQuestionsFor(showQuestionsFor === et.id ? null : et.id)}
                  style={{ ...btn, background: '#f5f5f5', color: '#555' }}
                >
                  Preguntas
                </button>
              </div>

              {showQuestionsFor === et.id && (
                <QuestionsManager eventTypeId={et.id} />
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <EventTypeModal
          eventType={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => { setShowModal(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Event Type Modal ──
function EventTypeModal({
  eventType,
  onClose,
  onSaved,
}: {
  eventType: EventType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const schedFetch = useSchedFetch();
  const [form, setForm] = useState({
    nombre: eventType?.nombre || '',
    slug: eventType?.slug || '',
    descripcion: eventType?.descripcion || '',
    duracion_minutos: eventType?.duracion_minutos || 30,
    slot_interval_minutos: (eventType as any)?.slot_interval_minutos || '',
    modo_escasez: eventType?.routing_rules?.modo_escasez || false,
    mostrar_recurrencia: eventType?.routing_rules?.mostrar_recurrencia || false,
    oferta_activa: eventType?.routing_rules?.oferta?.mostrar_oferta !== false,
    trial_dias: eventType?.routing_rules?.oferta?.trial_dias || 7,
    descuento_pct: eventType?.routing_rules?.oferta?.descuento_pct || 35,
    migracion_valor: eventType?.routing_rules?.oferta?.migracion_valor || 9000,
    consultoria_horas: eventType?.routing_rules?.oferta?.consultoria_horas || 3,
    consultoria_valor: eventType?.routing_rules?.oferta?.consultoria_valor || 8000,
    mostrar_typing: eventType?.routing_rules?.mostrar_typing !== false,
    _showOferta: false,
    buffer_antes_minutos: eventType?.buffer_antes_minutos || 0,
    buffer_despues_minutos: eventType?.buffer_despues_minutos || 0,
    aviso_minimo_horas: eventType?.aviso_minimo_horas || 2,
    max_reservas_dia: eventType?.max_reservas_dia ?? '',
    max_dias_adelanto: eventType?.max_dias_adelanto || 30,
    ubicacion_tipo: eventType?.ubicacion_tipo || 'google_meet',
    color: eventType?.color || '#4B7BE5',
  });
  const [saving, setSaving] = useState(false);
  const [emailConfig, setEmailConfig] = useState<Record<string, any>>(() => {
    const saved = eventType?.routing_rules?.emails;
    return saved ? { ...DEFAULT_EMAIL_CONFIG, ...saved } : { ...DEFAULT_EMAIL_CONFIG };
  });
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [activeEmailTab, setActiveEmailTab] = useState('confirmation');

  const updateEmailField = (emailKey: string, field: string, value: string | boolean) => {
    setEmailConfig(prev => ({
      ...prev,
      [emailKey]: { ...prev[emailKey], [field]: value },
    }));
  };

  const updateForm = (field: string, value: string | number | boolean) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'nombre' && !eventType) {
        updated.slug = slugify(value as string);
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.slug.trim()) return;
    setSaving(true);

    const payload: Record<string, unknown> = {
      nombre: form.nombre,
      slug: form.slug,
      descripcion: form.descripcion || null,
      duracion_minutos: form.duracion_minutos,
      buffer_antes_minutos: form.buffer_antes_minutos,
      buffer_despues_minutos: form.buffer_despues_minutos,
      aviso_minimo_horas: form.aviso_minimo_horas,
      max_reservas_dia: form.max_reservas_dia === '' ? null : Number(form.max_reservas_dia),
      max_dias_adelanto: form.max_dias_adelanto,
      ubicacion_tipo: form.ubicacion_tipo,
      color: form.color,
      routing_rules: {
        ...(eventType?.routing_rules || {}),
        emails: emailConfig,
        slot_interval_minutos: form.slot_interval_minutos ? Number(form.slot_interval_minutos) : null,
        modo_escasez: form.modo_escasez || false,
        mostrar_recurrencia: form.mostrar_recurrencia || false,
        mostrar_typing: form.mostrar_typing !== false,
        oferta: {
          mostrar_oferta: form.oferta_activa !== false,
          trial_dias: form.trial_dias || 7,
          descuento_pct: form.descuento_pct || 35,
          descuento_plan: 'anual',
          migracion_gratis: true,
          migracion_valor: form.migracion_valor || 9000,
          consultoria_horas: form.consultoria_horas || 3,
          consultoria_valor: form.consultoria_valor || 8000,
        },
      },
    };

    if (eventType) {
      payload.id = eventType.id;
    }

    const res = await schedFetch('/api/scheduling/event-types', {
      method: eventType ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    setSaving(false);
    if (result.error) {
      alert('Error al guardar: ' + result.error);
    } else {
      onSaved();
    }
  };

  return (
    <div className="sh-modal-overlay" style={modalOverlay} onClick={onClose}>
      <div className="sh-modal-content" style={modalContent} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1A1A1A' }}>
            {eventType ? 'Editar tipo de evento' : 'Nuevo tipo de evento'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#999' }}>
            &times;
          </button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={label}>Nombre *</label>
          <input value={form.nombre} onChange={e => updateForm('nombre', e.target.value)} style={input} placeholder="Ej: Demo personalizada" />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={label}>Slug *</label>
          <input value={form.slug} onChange={e => updateForm('slug', e.target.value)} style={input} placeholder="demo-personalizada" />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={label}>Descripcion</label>
          <textarea
            value={form.descripcion}
            onChange={e => updateForm('descripcion', e.target.value)}
            style={{ ...input, resize: 'vertical' as const }}
            rows={2}
            placeholder="Descripcion opcional del tipo de evento"
          />
        </div>

        <div className="sh-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={label}>Duración (min)</label>
            <select value={form.duracion_minutos} onChange={e => updateForm('duracion_minutos', Number(e.target.value))} style={selectStyle}>
              {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Intervalo de slots</label>
            <select value={form.slot_interval_minutos} onChange={e => updateForm('slot_interval_minutos', e.target.value)} style={selectStyle}>
              <option value="">Igual a duración</option>
              <option value="15">Cada 15 min</option>
              <option value="30">Cada 30 min</option>
              <option value="45">Cada 45 min</option>
              <option value="60">Cada 60 min</option>
            </select>
            <div style={{ fontSize: '0.625rem', color: '#999', marginTop: 2 }}>Espaciado entre horarios disponibles</div>
          </div>
          <div>
            <label style={label}>Ubicación</label>
            <select value={form.ubicacion_tipo} onChange={e => updateForm('ubicacion_tipo', e.target.value)} style={selectStyle}>
              {UBICACION_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
        </div>

        <div className="sh-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={label}>Buffer antes (min)</label>
            <select value={form.buffer_antes_minutos} onChange={e => updateForm('buffer_antes_minutos', Number(e.target.value))} style={selectStyle}>
              {BUFFER_OPTIONS.map(b => <option key={b} value={b}>{b} min</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Buffer despues (min)</label>
            <select value={form.buffer_despues_minutos} onChange={e => updateForm('buffer_despues_minutos', Number(e.target.value))} style={selectStyle}>
              {BUFFER_OPTIONS.map(b => <option key={b} value={b}>{b} min</option>)}
            </select>
          </div>
        </div>

        <div className="sh-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={label}>Aviso minimo (hrs)</label>
            <select value={form.aviso_minimo_horas} onChange={e => updateForm('aviso_minimo_horas', Number(e.target.value))} style={selectStyle}>
              {AVISO_OPTIONS.map(a => <option key={a} value={a}>{a}h</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Max reservas/dia</label>
            <input
              type="number"
              value={form.max_reservas_dia}
              onChange={e => updateForm('max_reservas_dia', e.target.value)}
              style={input}
              placeholder="Sin limite"
              min={0}
            />
          </div>
          <div>
            <label style={label}>Max dias adelanto</label>
            <select value={form.max_dias_adelanto} onChange={e => updateForm('max_dias_adelanto', Number(e.target.value))} style={selectStyle}>
              {MAX_DIAS_OPTIONS.map(d => <option key={d} value={d}>{d} dias</option>)}
            </select>
          </div>
        </div>

        {/* Color picker */}
        <div style={{ marginBottom: 20 }}>
          <label style={label}>Color</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => updateForm('color', c)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: c,
                  border: form.color === c ? '3px solid #1A1A1A' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Options toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8125rem', color: '#555' }}>
            <input type="checkbox" checked={form.modo_escasez || false} onChange={e => updateForm('modo_escasez', e.target.checked)} style={{ accentColor: '#4B7BE5' }} />
            Modo escasez (mostrar solo 2-3 horarios por día)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8125rem', color: '#555' }}>
            <input type="checkbox" checked={form.mostrar_recurrencia || false} onChange={e => updateForm('mostrar_recurrencia', e.target.checked)} style={{ accentColor: '#4B7BE5' }} />
            Permitir repetir reunión (recurrencia semanal/quincenal)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8125rem', color: '#555' }}>
            <input type="checkbox" checked={form.mostrar_typing !== false} onChange={e => updateForm('mostrar_typing', e.target.checked)} style={{ accentColor: '#4B7BE5' }} />
            Mostrar "Alguien más está viendo este horario"
          </label>
        </div>

        {/* ── Offer Configuration ── */}
        <div style={{ marginBottom: 16, border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden' }}>
          <button
            onClick={() => updateForm('_showOferta', !form._showOferta)}
            style={{ width: '100%', padding: '12px 16px', background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'inherit' }}
          >
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1a1a1a' }}>Oferta post-agendamiento</span>
            <span style={{ color: '#999', fontSize: '0.75rem' }}>{form._showOferta ? '▲' : '▼'}</span>
          </button>
          {form._showOferta && (
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ fontSize: '0.6875rem', color: '#999', marginBottom: 12 }}>Se muestra al cliente después de confirmar su cita</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.8125rem', color: '#555', marginBottom: 12 }}>
                <input type="checkbox" checked={form.oferta_activa !== false} onChange={e => updateForm('oferta_activa', e.target.checked)} style={{ accentColor: '#4B7BE5' }} />
                Mostrar oferta especial
              </label>
              <div className="sh-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={label}>Días de prueba</label>
                  <input type="number" value={form.trial_dias || 7} onChange={e => updateForm('trial_dias', Number(e.target.value))} style={input} />
                </div>
                <div>
                  <label style={label}>% Descuento</label>
                  <input type="number" value={form.descuento_pct || 35} onChange={e => updateForm('descuento_pct', Number(e.target.value))} style={input} />
                </div>
              </div>
              <div className="sh-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <label style={label}>Valor migración ($)</label>
                  <input type="number" value={form.migracion_valor || 9000} onChange={e => updateForm('migracion_valor', Number(e.target.value))} style={input} />
                </div>
                <div>
                  <label style={label}>Horas consultoría</label>
                  <input type="number" value={form.consultoria_horas || 3} onChange={e => updateForm('consultoria_horas', Number(e.target.value))} style={input} />
                </div>
              </div>
              <div>
                <label style={label}>Valor consultoría ($)</label>
                <input type="number" value={form.consultoria_valor || 8000} onChange={e => updateForm('consultoria_valor', Number(e.target.value))} style={input} />
              </div>
            </div>
          )}
        </div>

        {/* ── Email Customization Section ── */}
        <div style={{ marginBottom: 20, border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden' }}>
          <button
            onClick={() => setShowEmailConfig(!showEmailConfig)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: '#FAFAF8', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 700, color: '#1A1A1A',
            }}
          >
            <span>Personalizar correos</span>
            <span style={{ fontSize: '0.75rem', color: '#999', transition: 'transform 0.2s', transform: showEmailConfig ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              &#9660;
            </span>
          </button>

          {showEmailConfig && (
            <div style={{ padding: 16 }}>
              {/* Email sub-tabs */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f0f0f0', marginBottom: 16, flexWrap: 'wrap' }}>
                {EMAIL_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveEmailTab(tab.key)}
                    style={{
                      ...btn,
                      background: 'none',
                      borderRadius: 0,
                      padding: '8px 12px',
                      fontSize: '0.6875rem',
                      color: activeEmailTab === tab.key ? '#4B7BE5' : '#999',
                      fontWeight: activeEmailTab === tab.key ? 700 : 500,
                      borderBottom: activeEmailTab === tab.key ? '2px solid #4B7BE5' : '2px solid transparent',
                      marginBottom: -1,
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Active email tab content */}
              {EMAIL_TABS.map(tab => {
                if (tab.key !== activeEmailTab) return null;
                const cfg = emailConfig[tab.key] || {};
                const showEnabled = tab.key === 'reminder_24h' || tab.key === 'reminder_1h';

                return (
                  <div key={tab.key} style={{ background: '#FAFAF8', borderRadius: 8, padding: 14 }}>
                    {/* Enabled toggle for reminders */}
                    {showEnabled && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8125rem', color: '#555' }}>
                          <input
                            type="checkbox"
                            checked={cfg.enabled !== false}
                            onChange={e => updateEmailField(tab.key, 'enabled', e.target.checked)}
                          />
                          Enviar este recordatorio
                        </label>
                      </div>
                    )}

                    <div style={{ marginBottom: 10 }}>
                      <label style={label}>Asunto</label>
                      <input
                        value={cfg.subject || ''}
                        onChange={e => updateEmailField(tab.key, 'subject', e.target.value)}
                        style={input}
                        placeholder="Asunto del correo"
                      />
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={label}>Titulo del email</label>
                      <input
                        value={cfg.heading || ''}
                        onChange={e => updateEmailField(tab.key, 'heading', e.target.value)}
                        style={input}
                        placeholder="Titulo principal del email"
                      />
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={label}>Mensaje</label>
                      <textarea
                        value={cfg.body || ''}
                        onChange={e => updateEmailField(tab.key, 'body', e.target.value)}
                        style={{ ...input, resize: 'vertical' as const }}
                        rows={3}
                        placeholder="Cuerpo del mensaje"
                      />
                      <div style={{ fontSize: '0.625rem', color: '#999', marginTop: -4, marginBottom: 4 }}>
                        Tokens disponibles: <code style={{ background: '#eee', padding: '1px 4px', borderRadius: 3 }}>{'{{nombre}}'}</code>{' '}
                        <code style={{ background: '#eee', padding: '1px 4px', borderRadius: 3 }}>{'{{empresa}}'}</code>{' '}
                        <code style={{ background: '#eee', padding: '1px 4px', borderRadius: 3 }}>{'{{fecha}}'}</code>{' '}
                        <code style={{ background: '#eee', padding: '1px 4px', borderRadius: 3 }}>{'{{hora}}'}</code>{' '}
                        <code style={{ background: '#eee', padding: '1px 4px', borderRadius: 3 }}>{'{{duracion}}'}</code>{' '}
                        <code style={{ background: '#eee', padding: '1px 4px', borderRadius: 3 }}>{'{{meet_link}}'}</code>
                      </div>
                    </div>

                    {/* Specific toggles per email type */}
                    {tab.key === 'confirmation' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#555' }}>
                          <input type="checkbox" checked={cfg.show_meet_link !== false} onChange={e => updateEmailField(tab.key, 'show_meet_link', e.target.checked)} />
                          Mostrar enlace de Google Meet
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#555' }}>
                          <input type="checkbox" checked={cfg.show_reschedule_link !== false} onChange={e => updateEmailField(tab.key, 'show_reschedule_link', e.target.checked)} />
                          Mostrar enlace para reagendar
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#555' }}>
                          <input type="checkbox" checked={cfg.show_cancel_link !== false} onChange={e => updateEmailField(tab.key, 'show_cancel_link', e.target.checked)} />
                          Mostrar enlace para cancelar
                        </label>
                      </div>
                    )}

                    {tab.key === 'cancellation' && (
                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#555' }}>
                          <input type="checkbox" checked={cfg.show_suggestions !== false} onChange={e => updateEmailField(tab.key, 'show_suggestions', e.target.checked)} />
                          Sugerir nuevos horarios
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.nombre.trim() || !form.slug.trim()}
            style={{ ...btn, background: '#1a1a1a', color: '#fff', opacity: saving ? 0.5 : 1 }}
          >
            {saving ? 'Guardando...' : eventType ? 'Guardar cambios' : 'Crear tipo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Questions Manager ──
function QuestionsManager({ eventTypeId }: { eventTypeId: string }) {
  const schedFetch = useSchedFetch();
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newQ, setNewQ] = useState({ tipo: 'text', label: '', placeholder: '', required: false, options: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await schedFetch(`/api/scheduling/questions?event_type_id=${eventTypeId}`);
      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : []);
    } catch {
      setQuestions([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventTypeId]);

  const addQuestion = async () => {
    if (!newQ.label.trim()) return;
    await schedFetch('/api/scheduling/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        event_type_id: eventTypeId,
        tipo: newQ.tipo,
        label: newQ.label,
        placeholder: newQ.placeholder || null,
        required: newQ.required,
        options: newQ.tipo === 'select' ? newQ.options.split(',').map((o: string) => o.trim()).filter(Boolean) : null,
        orden: questions.length + 1,
      }),
    });
    setNewQ({ tipo: 'text', label: '', placeholder: '', required: false, options: '' });
    setShowAdd(false);
    load();
  };

  const toggleVisible = async (q: any) => {
    await schedFetch('/api/scheduling/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', id: q.id }),
    });
    load();
  };

  const toggleRequired = async (q: any) => {
    const newRequired = !q.required;
    // When toggling, move to end of the new group
    const targetGroup = newRequired ? requiredQs : optionalQs;
    const maxOrden = targetGroup.length > 0 ? Math.max(...targetGroup.map((x: any) => x.orden)) : 0;
    const newOrden = newRequired ? maxOrden + 1 : 100 + maxOrden + 1; // Opcionales empiezan en 100+
    await schedFetch('/api/scheduling/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: q.id, required: newRequired, orden: newOrden }),
    });
    load();
  };

  const removeQuestion = async (questionId: string) => {
    if (!confirm('¿Eliminar esta pregunta?')) return;
    await schedFetch('/api/scheduling/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: questionId }),
    });
    load();
  };

  // Split questions into required and optional groups
  const requiredQs = questions.filter((q: any) => q.required);
  const optionalQs = questions.filter((q: any) => !q.required);

  const moveQuestion = async (q: any, direction: 'up' | 'down') => {
    // Only move within same group (required or optional)
    const group = q.required ? requiredQs : optionalQs;
    const idx = group.findIndex((x: any) => x.id === q.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= group.length) return;
    const other = group[swapIdx];
    await Promise.all([
      schedFetch('/api/scheduling/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: q.id, orden: other.orden }) }),
      schedFetch('/api/scheduling/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', id: other.id, orden: q.orden }) }),
    ]);
    load();
  };

  const canMoveUp = (q: any) => {
    const group = q.required ? requiredQs : optionalQs;
    return group.findIndex((x: any) => x.id === q.id) > 0;
  };
  const canMoveDown = (q: any) => {
    const group = q.required ? requiredQs : optionalQs;
    return group.findIndex((x: any) => x.id === q.id) < group.length - 1;
  };

  const TIPO_LABELS: Record<string, string> = { text: 'Texto', textarea: 'Texto largo', select: 'Selección', radio: 'Radio', checkbox: 'Checkbox', number: 'Número', phone: 'Teléfono' };

  const renderQuestionRow = (q: any) => (
    <div key={q.id} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
      background: q.activo ? '#fff' : '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0',
      opacity: q.activo ? 1 : 0.5,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flexShrink: 0 }}>
        <button onClick={() => moveQuestion(q, 'up')} disabled={!canMoveUp(q)}
          style={{ background: 'none', border: 'none', cursor: canMoveUp(q) ? 'pointer' : 'default', color: canMoveUp(q) ? '#999' : '#e0e0e0', fontSize: '0.75rem', padding: '0 2px', lineHeight: 1 }}>▲</button>
        <button onClick={() => moveQuestion(q, 'down')} disabled={!canMoveDown(q)}
          style={{ background: 'none', border: 'none', cursor: canMoveDown(q) ? 'pointer' : 'default', color: canMoveDown(q) ? '#999' : '#e0e0e0', fontSize: '0.75rem', padding: '0 2px', lineHeight: 1 }}>▼</button>
      </div>
      <div onClick={() => toggleVisible(q)} style={{ width: 32, height: 18, borderRadius: 9, cursor: 'pointer', background: q.activo ? '#2AB5A0' : '#ddd', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: q.activo ? 16 : 2, transition: 'left 0.2s' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1a1a1a' }}>{q.label}</div>
        <div style={{ fontSize: '0.625rem', color: '#999' }}>{TIPO_LABELS[q.tipo] || q.tipo}{q.options ? ` (${q.options.length} opciones)` : ''}</div>
      </div>
      <button onClick={() => toggleRequired(q)} style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.5625rem', fontWeight: 700, cursor: 'pointer', border: 'none', background: q.required ? '#4B7BE5' : '#f0f0f0', color: q.required ? '#fff' : '#999' }}>
        {q.required ? 'Obligatorio' : 'Opcional'}
      </button>
      <button onClick={() => removeQuestion(q.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '1rem', padding: '0 4px' }}>×</button>
    </div>
  );

  return (
    <div style={{ marginTop: 12, padding: '12px 0 0', borderTop: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Campos del formulario</span>
        <button onClick={() => setShowAdd(!showAdd)} style={{ ...btn, background: '#f5f5f5', color: '#555', padding: '4px 10px', fontSize: '0.6875rem' }}>
          {showAdd ? 'Cancelar' : '+ Agregar campo'}
        </button>
      </div>

      <div style={{ fontSize: '0.625rem', color: '#bbb', marginBottom: 8 }}>
        Nombre, Email y WhatsApp siempre se muestran. Los campos de abajo son configurables.
      </div>

      {loading ? (
        <div style={{ fontSize: '0.8125rem', color: '#bbb', padding: '8px 0' }}>Cargando...</div>
      ) : questions.length === 0 && !showAdd ? (
        <div style={{ fontSize: '0.8125rem', color: '#bbb', padding: '12px 0' }}>Sin campos adicionales. Agrega uno.</div>
      ) : (
        <div>
          {/* Required fields group */}
          {requiredQs.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#4B7BE5', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>Obligatorios</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {requiredQs.map(q => renderQuestionRow(q))}
              </div>
            </div>
          )}
          {/* Optional fields group */}
          {optionalQs.length > 0 && (
            <div>
              <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>Opcionales</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {optionalQs.map(q => renderQuestionRow(q))}
              </div>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div style={{ marginTop: 8, padding: 12, background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
          <div className="sh-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ ...label, fontSize: '0.6875rem' }}>Tipo de campo</label>
              <select value={newQ.tipo} onChange={e => setNewQ(p => ({ ...p, tipo: e.target.value }))} style={{ ...selectStyle, fontSize: '0.75rem', padding: '6px 8px' }}>
                <option value="text">Texto</option>
                <option value="textarea">Texto largo</option>
                <option value="select">Selección (dropdown)</option>
                <option value="number">Número</option>
                <option value="phone">Teléfono</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </div>
            <div>
              <label style={{ ...label, fontSize: '0.6875rem' }}>Nombre del campo</label>
              <input value={newQ.label} onChange={e => setNewQ(p => ({ ...p, label: e.target.value }))} style={{ ...input, fontSize: '0.75rem', padding: '6px 8px' }} placeholder="Ej. Empresa" />
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ ...label, fontSize: '0.6875rem' }}>Placeholder</label>
            <input value={newQ.placeholder} onChange={e => setNewQ(p => ({ ...p, placeholder: e.target.value }))} style={{ ...input, fontSize: '0.75rem', padding: '6px 8px' }} placeholder="Texto de ayuda (opcional)" />
          </div>
          {newQ.tipo === 'select' && (
            <div style={{ marginBottom: 8 }}>
              <label style={{ ...label, fontSize: '0.6875rem' }}>Opciones (separadas por coma)</label>
              <input value={newQ.options} onChange={e => setNewQ(p => ({ ...p, options: e.target.value }))} style={{ ...input, fontSize: '0.75rem', padding: '6px 8px' }} placeholder="Opción 1, Opción 2, Opción 3" />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', color: '#555' }}>
              <input type="checkbox" checked={newQ.required} onChange={e => setNewQ(p => ({ ...p, required: e.target.checked }))} style={{ accentColor: '#4B7BE5' }} />
              Obligatorio
            </label>
            <button onClick={addQuestion} disabled={!newQ.label.trim()} style={{ ...btn, background: '#1a1a1a', color: '#fff', padding: '6px 14px', fontSize: '0.6875rem', opacity: newQ.label.trim() ? 1 : 0.5 }}>
              Agregar campo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Sub-tab 3: Disponibilidad
// ═══════════════════════════════════════════════════════════
function DisponibilidadView({ variant }: { variant: SchedulingHubVariant }) {
  return (
    <div>
      <GoogleCalendarPanel />
      <DisponibilidadSchedule />
    </div>
  );
}

// Panel de conexión con Google Calendar — visible en admin y partner.
// Reusa /api/scheduling/google/status, /auth, /disconnect. Auto-resuelve
// team_member_id basado en cookie sacs_session.
function GoogleCalendarPanel() {
  const schedFetch = useSchedFetch();
  const [status, setStatus] = useState<{ connected: boolean; connected_at: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await schedFetch('/api/scheduling/google/status', { credentials: 'include' });
      const d = await r.json();
      setStatus({ connected: !!d.connected, connected_at: d.connected_at || null });
    } catch {
      setStatus({ connected: false, connected_at: null });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const connect = () => {
    // Redirige al flow OAuth pasando la URL actual como return_url para que
    // el callback regrese al mismo portal (admin o partner) donde inició.
    const ret = encodeURIComponent(window.location.pathname + window.location.hash);
    window.location.href = `/api/scheduling/google/auth?return_url=${ret}`;
  };

  const disconnect = async () => {
    if (!confirm('¿Desconectar tu Google Calendar? Las nuevas citas ya no se sincronizarán automáticamente.')) return;
    setBusy(true);
    try {
      await schedFetch('/api/scheduling/google/disconnect', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '24px 24px 0' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        padding: '14px 16px', borderRadius: 12,
        background: status?.connected ? 'rgba(42,181,160,0.07)' : '#fafbfd',
        border: `1px solid ${status?.connected ? 'rgba(42,181,160,0.30)' : '#e8eaf0'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: '#fff', border: '1px solid #e5e5e5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Google "G" simplificado */}
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
              <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
              <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
              <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
              <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
              Google Calendar
            </div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
              {loading
                ? 'Comprobando…'
                : status?.connected
                  ? `Conectado · las citas se crean automáticamente con Google Meet`
                  : 'Conecta tu calendar para auto-sync y crear Google Meet en cada cita'}
            </div>
          </div>
        </div>
        {!loading && (
          status?.connected
            ? <button onClick={disconnect} disabled={busy} style={{ ...btn, background: '#fff', color: '#666', border: '1px solid #ddd', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Desconectando…' : 'Desconectar'}
              </button>
            : <button onClick={connect} style={{ ...btn, background: '#4B7BE5', color: '#fff' }}>
                Conectar
              </button>
        )}
      </div>
    </div>
  );
}

// Editor de horarios semanales + overrides (lo que era DisponibilidadView original).
function DisponibilidadSchedule() {
  const schedFetch = useSchedFetch();
  const [schedule, setSchedule] = useState<AvailabilitySlot[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timezoneDisplay, setTimezoneDisplay] = useState('');

  // Override form
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideTipo, setOverrideTipo] = useState<'bloqueo' | 'especial'>('bloqueo');
  const [overrideStart, setOverrideStart] = useState('09:00');
  const [overrideEnd, setOverrideEnd] = useState('17:00');

  const load = async () => {
    setLoading(true);
    try {
      const [avRes, ovRes] = await Promise.all([
        schedFetch('/api/scheduling/availability'),
        schedFetch('/api/scheduling/availability-overrides'),
      ]);
      const avData = await avRes.json();
      const ovData = await ovRes.json();

      if (Array.isArray(avData) && avData.length > 0) {
        setSchedule(avData);
      } else {
        // Default schedule: Mon-Fri 9-18
        const defaults: AvailabilitySlot[] = [];
        for (let i = 0; i < 7; i++) {
          defaults.push({
            dia_semana: i,
            hora_inicio: '09:00',
            hora_fin: '18:00',
            activo: i < 5, // Mon-Fri active
          });
        }
        setSchedule(defaults);
      }

      setOverrides(Array.isArray(ovData) ? ovData : []);

      try {
        setTimezoneDisplay(Intl.DateTimeFormat().resolvedOptions().timeZone);
      } catch {
        setTimezoneDisplay('America/Mexico_City');
      }
    } catch {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleDay = (dia: number) => {
    setSchedule(prev => prev.map(s =>
      s.dia_semana === dia ? { ...s, activo: !s.activo } : s,
    ));
  };

  const updateSlotTime = (dia: number, field: 'hora_inicio' | 'hora_fin', value: string) => {
    setSchedule(prev => prev.map(s =>
      s.dia_semana === dia ? { ...s, [field]: value } : s,
    ));
  };

  const addSlot = (dia: number) => {
    const existing = schedule.filter(s => s.dia_semana === dia);
    const lastEnd = existing.length > 0 ? existing[existing.length - 1].hora_fin : '09:00';
    setSchedule(prev => [
      ...prev,
      { dia_semana: dia, hora_inicio: lastEnd, hora_fin: '18:00', activo: true },
    ]);
  };

  const removeSlot = (dia: number, index: number) => {
    const slotsForDay = schedule.filter(s => s.dia_semana === dia);
    if (slotsForDay.length <= 1) return; // Keep at least one
    const slotToRemove = slotsForDay[index];
    let removedCount = 0;
    setSchedule(prev => prev.filter(s => {
      if (s.dia_semana === dia && s.hora_inicio === slotToRemove.hora_inicio && s.hora_fin === slotToRemove.hora_fin && removedCount === 0) {
        removedCount++;
        return false;
      }
      return true;
    }));
  };

  const saveSchedule = async () => {
    setSaving(true);
    await schedFetch('/api/scheduling/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: schedule }),
    });
    setSaving(false);
  };

  const addOverride = async () => {
    if (!overrideDate) return;
    const payload: Record<string, unknown> = {
      fecha: overrideDate,
      tipo: overrideTipo,
    };
    if (overrideTipo === 'especial') {
      payload.hora_inicio = overrideStart;
      payload.hora_fin = overrideEnd;
    }

    await schedFetch('/api/scheduling/availability-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setOverrideDate('');
    load();
  };

  const deleteOverride = async (id: string) => {
    await schedFetch('/api/scheduling/availability-overrides', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>Cargando...</div>;
  }

  // Group schedule by day
  const scheduleByDay: Record<number, AvailabilitySlot[]> = {};
  for (let d = 0; d < 7; d++) {
    scheduleByDay[d] = schedule.filter(s => s.dia_semana === d);
    if (scheduleByDay[d].length === 0) {
      scheduleByDay[d] = [{ dia_semana: d, hora_inicio: '09:00', hora_fin: '18:00', activo: false }];
    }
  }

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* Timezone display */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span style={{ fontSize: '0.8125rem', color: '#777' }}>Zona horaria: <strong style={{ color: '#1A1A1A' }}>{timezoneDisplay}</strong></span>
      </div>

      {/* Weekly schedule */}
      <div style={{ ...card, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 700, color: '#1A1A1A' }}>
          Horario semanal
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2, 3, 4, 5, 6].map(dia => {
            const slots = scheduleByDay[dia];
            const isActive = slots.some(s => s.activo);

            return (
              <div key={dia} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: dia < 6 ? '1px solid #f5f5f5' : 'none' }}>
                {/* Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                  <div
                    onClick={() => toggleDay(dia)}
                    style={{
                      width: 36,
                      height: 20,
                      borderRadius: 10,
                      background: isActive ? '#4B7BE5' : '#E0E0E0',
                      position: 'relative' as const,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute' as const,
                      top: 2,
                      left: isActive ? 18 : 2,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: isActive ? '#1A1A1A' : '#bbb', minWidth: 70 }}>
                    {DIA_LABELS[dia]}
                  </span>
                </div>

                {/* Time ranges */}
                {isActive ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                    {slots.filter(s => s.activo).map((slot, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="time"
                          value={slot.hora_inicio}
                          onChange={e => {
                            const newSchedule = [...schedule];
                            const allForDay = newSchedule.filter(s => s.dia_semana === dia && s.activo);
                            if (allForDay[idx]) allForDay[idx].hora_inicio = e.target.value;
                            setSchedule(newSchedule);
                          }}
                          style={{ ...input, width: 'auto', marginBottom: 0, fontSize: '0.8125rem', padding: '6px 10px' }}
                        />
                        <span style={{ color: '#999', fontSize: '0.8125rem' }}>—</span>
                        <input
                          type="time"
                          value={slot.hora_fin}
                          onChange={e => {
                            const newSchedule = [...schedule];
                            const allForDay = newSchedule.filter(s => s.dia_semana === dia && s.activo);
                            if (allForDay[idx]) allForDay[idx].hora_fin = e.target.value;
                            setSchedule(newSchedule);
                          }}
                          style={{ ...input, width: 'auto', marginBottom: 0, fontSize: '0.8125rem', padding: '6px 10px' }}
                        />
                        {slots.filter(s => s.activo).length > 1 && (
                          <button
                            onClick={() => removeSlot(dia, idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '1rem', padding: '2px 4px' }}
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => addSlot(dia)}
                      style={{ ...btn, background: 'none', color: '#4B7BE5', padding: '2px 0', fontSize: '0.75rem', justifyContent: 'flex-start' }}
                    >
                      + Agregar rango
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.8125rem', color: '#ccc', padding: '6px 0' }}>No disponible</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={saveSchedule}
            disabled={saving}
            style={{ ...btn, background: '#1a1a1a', color: '#fff', opacity: saving ? 0.5 : 1 }}
          >
            {saving ? 'Guardando...' : 'Guardar horario'}
          </button>
        </div>
      </div>

      {/* Date overrides */}
      <div style={card}>
        <h3 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 700, color: '#1A1A1A' }}>
          Excepciones de fecha
        </h3>

        {/* Add override form */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <label style={label}>Fecha</label>
            <input type="date" value={overrideDate} onChange={e => setOverrideDate(e.target.value)} style={{ ...input, marginBottom: 0 }} />
          </div>
          <div>
            <label style={label}>Tipo</label>
            <select value={overrideTipo} onChange={e => setOverrideTipo(e.target.value as 'bloqueo' | 'especial')} style={{ ...selectStyle, marginBottom: 0 }}>
              <option value="bloqueo">Bloquear dia</option>
              <option value="especial">Horario especial</option>
            </select>
          </div>
          {overrideTipo === 'especial' && (
            <>
              <div>
                <label style={label}>Desde</label>
                <input type="time" value={overrideStart} onChange={e => setOverrideStart(e.target.value)} style={{ ...input, marginBottom: 0, width: 'auto' }} />
              </div>
              <div>
                <label style={label}>Hasta</label>
                <input type="time" value={overrideEnd} onChange={e => setOverrideEnd(e.target.value)} style={{ ...input, marginBottom: 0, width: 'auto' }} />
              </div>
            </>
          )}
          <button
            onClick={addOverride}
            disabled={!overrideDate}
            style={{ ...btn, background: '#4B7BE5', color: '#fff', opacity: overrideDate ? 1 : 0.5, marginBottom: 0 }}
          >
            Agregar
          </button>
        </div>

        {/* Existing overrides */}
        {overrides.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: '#bbb', padding: '8px 0' }}>Sin excepciones configuradas</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {overrides.map(ov => (
              <div
                key={ov.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: ov.tipo === 'bloqueo' ? '#FEF2F2' : '#FFFBEB',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    background: ov.tipo === 'bloqueo' ? '#DC262618' : '#E8A83818',
                    color: ov.tipo === 'bloqueo' ? '#DC2626' : '#E8A838',
                  }}>
                    {ov.tipo === 'bloqueo' ? 'Bloqueado' : 'Especial'}
                  </span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1A1A1A' }}>
                    {fmtDate(ov.fecha)}
                  </span>
                  {ov.tipo === 'especial' && ov.hora_inicio && ov.hora_fin && (
                    <span style={{ fontSize: '0.8125rem', color: '#777' }}>
                      {ov.hora_inicio} — {ov.hora_fin}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteOverride(ov.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '1rem', padding: '2px 6px' }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Sub-tab 4: Estadisticas
// ═══════════════════════════════════════════════════════════
interface StatsData {
  period_days: number;
  total: number;
  by_estado: Record<string, number>;
  no_show_rate: number;
  cancel_rate: number;
  avg_lead_time_days: number;
  popular_day: { day: number; label: string; count: number };
  popular_hour: { hour: string; count: number };
  by_week: { week: string; count: number }[];
  by_event_type: { nombre: string; count: number; color: string }[];
}

function EstadisticasView() {
  const schedFetch = useSchedFetch();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = async (d: number) => {
    setLoading(true);
    try {
      const res = await schedFetch(`/api/scheduling/stats?days=${d}`);
      const data = await res.json();
      setStats(data);
    } catch {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => { load(days); }, [days]);

  const kpiCard: React.CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    padding: '20px 24px',
    border: '1px solid #f0f0f0',
    flex: '1 1 0',
    minWidth: 140,
  };

  const statsCard: React.CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    padding: '20px 24px',
    border: '1px solid #f0f0f0',
  };

  if (loading && !stats) {
    return <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>Cargando estadisticas...</div>;
  }

  if (!stats) {
    return <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>No se pudieron cargar las estadisticas</div>;
  }

  // Find max for bar chart
  const maxWeekCount = Math.max(...stats.by_week.map(w => w.count), 1);

  // Format week label
  const fmtWeekLabel = (w: string) => {
    const [, m, d] = w.split('-').map(Number);
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${d} ${months[m - 1]}`;
  };

  // Hour display
  const fmtHourDisplay = (h: string) => {
    const [hr, min] = h.split(':').map(Number);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const h12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
    return `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
  };

  // Estado colors/labels for status bars
  const estadoEntries = Object.entries(stats.by_estado).sort((a, b) => b[1] - a[1]);
  const maxEstadoCount = Math.max(...estadoEntries.map(([, c]) => c), 1);

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* Period selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#1A1A1A' }}>
          Estadisticas de Agenda
        </h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { d: 7, label: '7 dias' },
            { d: 30, label: '30 dias' },
            { d: 90, label: '90 dias' },
          ].map(opt => (
            <button
              key={opt.d}
              onClick={() => setDays(opt.d)}
              style={{
                ...btn,
                background: days === opt.d ? '#1A1A1A' : '#f5f5f5',
                color: days === opt.d ? '#fff' : '#555',
                padding: '6px 12px',
                fontSize: '0.75rem',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 12, color: '#bbb', fontSize: '0.8125rem', marginBottom: 12 }}>
          Actualizando...
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={kpiCard}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>
            Total reservas
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1A1A1A' }}>{stats.total}</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>
            No-show rate
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stats.no_show_rate > 15 ? '#DC2626' : stats.no_show_rate > 5 ? '#E8A838' : '#2e7d32' }}>
            {stats.no_show_rate}%
          </div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>
            Cancelacion rate
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stats.cancel_rate > 20 ? '#DC2626' : stats.cancel_rate > 10 ? '#E8A838' : '#2e7d32' }}>
            {stats.cancel_rate}%
          </div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>
            Lead time promedio
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4B7BE5' }}>
            {stats.avg_lead_time_days}<span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#999', marginLeft: 4 }}>dias</span>
          </div>
        </div>
      </div>

      {/* Bar chart: Bookings by week */}
      <div style={{ ...statsCard, marginBottom: 20 }}>
        <h4 style={{ margin: '0 0 16px', fontSize: '0.8125rem', fontWeight: 700, color: '#1A1A1A' }}>
          Reservas por semana
        </h4>
        {stats.by_week.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: '#bbb', padding: '16px 0' }}>Sin datos</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.by_week.map(w => (
              <div key={w.week} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '0.75rem', color: '#999', minWidth: 55, textAlign: 'right' as const }}>
                  {fmtWeekLabel(w.week)}
                </span>
                <div style={{ flex: 1, height: 24, background: '#f5f5f5', borderRadius: 6, overflow: 'hidden', position: 'relative' as const }}>
                  <div style={{
                    height: '100%',
                    width: `${(w.count / maxWeekCount) * 100}%`,
                    background: '#4B7BE5',
                    borderRadius: 6,
                    minWidth: w.count > 0 ? 4 : 0,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1A1A1A', minWidth: 24, textAlign: 'right' as const }}>
                  {w.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom row: 3 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
        {/* Popular times */}
        <div style={statsCard}>
          <h4 style={{ margin: '0 0 16px', fontSize: '0.8125rem', fontWeight: 700, color: '#1A1A1A' }}>
            Horarios populares
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, marginBottom: 4 }}>
                Dia mas popular
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1A1A' }}>
                  {stats.popular_day.label}
                </span>
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 600, color: '#4B7BE5',
                  background: '#EBF1FC', padding: '2px 8px', borderRadius: 4,
                }}>
                  {stats.popular_day.count} reservas
                </span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, marginBottom: 4 }}>
                Hora mas popular
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1A1A' }}>
                  {fmtHourDisplay(stats.popular_hour.hour)}
                </span>
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 600, color: '#2AB5A0',
                  background: '#E6F7F4', padding: '2px 8px', borderRadius: 4,
                }}>
                  {stats.popular_hour.count} reservas
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* By event type */}
        <div style={statsCard}>
          <h4 style={{ margin: '0 0 16px', fontSize: '0.8125rem', fontWeight: 700, color: '#1A1A1A' }}>
            Por tipo de evento
          </h4>
          {stats.by_event_type.length === 0 ? (
            <div style={{ fontSize: '0.8125rem', color: '#bbb' }}>Sin datos</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.by_event_type.map(et => (
                <div key={et.nombre} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: et.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8125rem', color: '#555', flex: 1 }}>{et.nombre}</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1A1A1A' }}>{et.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By status */}
        <div style={statsCard}>
          <h4 style={{ margin: '0 0 16px', fontSize: '0.8125rem', fontWeight: 700, color: '#1A1A1A' }}>
            Por estado
          </h4>
          {estadoEntries.length === 0 ? (
            <div style={{ fontSize: '0.8125rem', color: '#bbb' }}>Sin datos</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {estadoEntries.map(([estado, count]) => {
                const color = ESTADO_COLORS[estado] || '#999';
                const estadoLabel = ESTADO_LABELS[estado] || estado;
                return (
                  <div key={estado}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color }}>{estadoLabel}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1A1A1A' }}>{count}</span>
                    </div>
                    <div style={{ height: 6, background: '#f5f5f5', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(count / maxEstadoCount) * 100}%`,
                        background: color,
                        borderRadius: 3,
                        minWidth: count > 0 ? 3 : 0,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
