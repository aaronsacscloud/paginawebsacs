import { useState, useEffect } from 'react';

// ─── Types ───
interface BookingData {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  invitee_nombre: string | null;
  invitee_email: string | null;
  google_meet_link: string | null;
  event_types: {
    nombre: string;
    duracion_minutos: number;
    slug: string;
    color: string;
    ubicacion_tipo: string;
  } | null;
}

interface Suggestion {
  fecha: string;
  hora: string;
  url: string;
}

interface Props {
  token: string;
}

// ─── Constants ───
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DAY_NAMES = [
  'Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado',
];

// ─── Helpers ───
function to12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDateLong(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  const dayName = DAY_NAMES[date.getDay()];
  const monthName = MONTH_NAMES[mo - 1];
  return `${dayName} ${d} de ${monthName}, ${y}`;
}

// ─── Styles ───
const s = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#FAFAF8',
    padding: '24px 16px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  } as React.CSSProperties,
  card: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    width: '100%',
    maxWidth: 480,
    overflow: 'hidden',
  } as React.CSSProperties,
  header: {
    padding: '28px 28px 20px',
    borderBottom: '1px solid #f0f0f0',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  logo: {
    fontFamily: "'Clash Display', 'Sora', sans-serif",
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#1A1A1A',
    margin: '0 0 4px',
    letterSpacing: '-0.02em',
  } as React.CSSProperties,
  body: {
    padding: '24px 28px 28px',
  } as React.CSSProperties,
  heading: {
    fontFamily: "'Sora', sans-serif",
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#1A1A1A',
    margin: '0 0 16px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  subtext: {
    fontSize: '0.875rem',
    color: '#777',
    margin: '0 0 20px',
    textAlign: 'center' as const,
    lineHeight: 1.5,
  } as React.CSSProperties,
  detailCard: {
    background: '#F7F8FA',
    borderRadius: 12,
    padding: '16px 20px',
    marginBottom: 20,
  } as React.CSSProperties,
  detailRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: '0.875rem',
    color: '#555',
    marginBottom: 8,
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '0.875rem',
    border: '1.5px solid #E0E0E0',
    borderRadius: 10,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
    minHeight: 80,
    color: '#1A1A1A',
    background: '#fff',
    transition: 'border-color 0.15s',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#555',
    marginBottom: 6,
  } as React.CSSProperties,
  btnDanger: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '14px 20px',
    fontSize: '0.9375rem',
    fontWeight: 700,
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: '#DC3545',
    color: '#fff',
    transition: 'opacity 0.15s',
  } as React.CSSProperties,
  btnOutline: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px 20px',
    fontSize: '0.875rem',
    fontWeight: 600,
    border: '1.5px solid #E0E0E0',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: '#fff',
    color: '#555',
    transition: 'border-color 0.15s',
    textDecoration: 'none',
  } as React.CSSProperties,
  suggestionCard: {
    display: 'block',
    padding: '12px 16px',
    background: '#F8F9FB',
    borderRadius: 10,
    color: '#4B7BE5',
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 600,
    border: '1.5px solid #E8ECF4',
    marginBottom: 8,
    textAlign: 'center' as const,
    transition: 'border-color 0.15s, background 0.15s',
  } as React.CSSProperties,
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #E0E0E0',
    borderTopColor: '#4B7BE5',
    borderRadius: '50%',
    animation: 'cancel-spin 0.6s linear infinite',
  } as React.CSSProperties,
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#E8F5E9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  } as React.CSSProperties,
};

// ─── Icons ───
function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Component ───
export default function CancelPage({ token }: Props) {
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState('');

  // Fetch booking on mount
  useEffect(() => {
    if (!token) {
      setError('Token de cancelacion no proporcionado.');
      setLoading(false);
      return;
    }

    fetch(`/api/scheduling/booking-by-token?cancel_token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error === 'Booking not found'
            ? 'No se encontro la reserva. Es posible que ya haya sido cancelada.'
            : data.error);
        } else if (data.estado !== 'confirmada') {
          setError(
            data.estado === 'cancelada'
              ? 'Esta reunion ya fue cancelada.'
              : `Esta reunion no puede ser cancelada (estado: ${data.estado}).`,
          );
          setBooking(data);
        } else {
          setBooking(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Error de conexion. Intenta de nuevo.');
        setLoading(false);
      });
  }, [token]);

  // Handle cancel
  const handleCancel = async () => {
    if (!booking) return;
    setCancelling(true);

    try {
      const res = await fetch('/api/scheduling/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.id,
          token,
          motivo: motivo.trim() || null,
          cancelado_por: 'invitado',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al cancelar la reunion.');
        setCancelling(false);
        return;
      }

      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
      setCancelled(true);
    } catch {
      setError('Error de conexion. Intenta de nuevo.');
    }
    setCancelling(false);
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div style={s.wrapper}>
        <style>{`@keyframes cancel-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={s.card}>
          <div style={{ ...s.body, textAlign: 'center', padding: '60px 28px' }}>
            <div style={{ ...s.spinner, margin: '0 auto 16px' }} />
            <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>Cargando informacion...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error && !booking) {
    return (
      <div style={s.wrapper}>
        <div style={s.card}>
          <div style={s.header}>
            <p style={s.logo}>Sacs</p>
          </div>
          <div style={{ ...s.body, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E65100" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 style={{ ...s.heading, marginBottom: 8 }}>No se encontro la reunion</h2>
            <p style={s.subtext}>{error}</p>
            <a href="/" style={{ ...s.btnOutline, display: 'inline-flex', width: 'auto', marginTop: 8, textDecoration: 'none' }}>
              Ir a sacscloud.com
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Cancelled confirmation ──
  if (cancelled && booking) {
    const et = booking.event_types;
    return (
      <div style={s.wrapper}>
        <div style={s.card}>
          <div style={s.header}>
            <p style={s.logo}>Sacs</p>
          </div>
          <div style={s.body}>
            <div style={s.checkCircle}>
              <CheckIcon />
            </div>
            <h2 style={s.heading}>Tu reunion ha sido cancelada</h2>
            <p style={s.subtext}>
              La reunion{et ? ` "${et.nombre}"` : ''} del{' '}
              {formatDateLong(booking.fecha)} a las {to12h(booking.hora_inicio)} ha sido cancelada exitosamente.
            </p>

            {suggestions.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A1A', marginBottom: 12, textAlign: 'center' }}>
                  Puedes reagendar en uno de estos horarios:
                </p>
                {suggestions.map((sug, i) => (
                  <a
                    key={i}
                    href={sug.url}
                    style={s.suggestionCard}
                    onMouseEnter={(e) => {
                      (e.target as HTMLElement).style.borderColor = '#4B7BE5';
                      (e.target as HTMLElement).style.background = '#EEF2FB';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.borderColor = '#E8ECF4';
                      (e.target as HTMLElement).style.background = '#F8F9FB';
                    }}
                  >
                    {formatDateLong(sug.fecha)} a las {to12h(sug.hora)}
                  </a>
                ))}
              </div>
            )}

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <a href="/" style={{ fontSize: '0.875rem', color: '#4B7BE5', fontWeight: 600, textDecoration: 'none' }}>
                Ir a sacscloud.com
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Pre-cancel view ──
  if (!booking) return null;
  const et = booking.event_types;

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.header}>
          <p style={s.logo}>Sacs</p>
        </div>
        <div style={s.body}>
          <h2 style={s.heading}>Cancelar reunion</h2>
          <p style={s.subtext}>
            Estas a punto de cancelar la siguiente reunion:
          </p>

          {/* Meeting details */}
          <div style={s.detailCard}>
            {et && (
              <div style={{ ...s.detailRow, fontWeight: 700, color: '#1A1A1A', fontSize: '0.9375rem', marginBottom: 12 }}>
                {et.nombre}
              </div>
            )}
            <div style={s.detailRow}>
              <CalendarIcon />
              <span>{formatDateLong(booking.fecha)}</span>
            </div>
            <div style={s.detailRow}>
              <ClockIcon />
              <span>{to12h(booking.hora_inicio)} - {to12h(booking.hora_fin)}{et ? ` (${et.duracion_minutos} min)` : ''}</span>
            </div>
            {booking.google_meet_link && (
              <div style={s.detailRow}>
                <VideoIcon />
                <span>Google Meet</span>
              </div>
            )}
            {booking.invitee_nombre && (
              <div style={{ ...s.detailRow, marginBottom: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                <span>{booking.invitee_nombre}</span>
              </div>
            )}
          </div>

          {/* Reason input */}
          <div style={{ marginBottom: 20 }}>
            <label style={s.label}>Motivo de cancelacion (opcional)</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Cuentanos por que necesitas cancelar..."
              style={s.textarea}
              onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = '#4B7BE5'; }}
              onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = '#E0E0E0'; }}
            />
          </div>

          {error && (
            <p style={{ fontSize: '0.8125rem', color: '#DC3545', marginBottom: 12, textAlign: 'center' }}>{error}</p>
          )}

          {/* Cancel button */}
          <button
            onClick={handleCancel}
            disabled={cancelling}
            style={{
              ...s.btnDanger,
              opacity: cancelling ? 0.7 : 1,
              cursor: cancelling ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelling ? 'Cancelando...' : 'Cancelar reunion'}
          </button>

          {/* Back link */}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <a
              href="/"
              style={{ fontSize: '0.875rem', color: '#777', textDecoration: 'none', fontWeight: 500 }}
            >
              Volver
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
