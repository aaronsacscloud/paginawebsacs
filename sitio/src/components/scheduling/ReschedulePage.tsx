import { useState, useEffect, useCallback } from 'react';

// ─── Types ───
interface BookingData {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  timezone: string | null;
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

interface NewBooking {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  google_meet_link: string | null;
}

interface Props {
  token: string;
}

// ─── Constants ───
const MONTH_NAMES_SHORT = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const MONTH_NAMES_LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DAY_HEADERS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

const DAY_NAMES_LONG = [
  'Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado',
];

// ─── Helpers ───
function to12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function addMinutes(time24: string, minutes: number): string {
  const [h, m] = time24.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function formatDateLong(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  const dayName = DAY_NAMES_LONG[date.getDay()];
  const monthName = MONTH_NAMES_LONG[mo - 1];
  return `${dayName} ${d} de ${monthName}, ${y}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
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
  btnPrimary: {
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
    background: '#4B7BE5',
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
  timeSlot: {
    padding: '10px 16px',
    fontSize: '0.875rem',
    fontWeight: 600,
    border: '1.5px solid #E0E0E0',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: '#fff',
    color: '#1A1A1A',
    transition: 'border-color 0.15s, background 0.15s',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  timeSlotSelected: {
    padding: '10px 16px',
    fontSize: '0.875rem',
    fontWeight: 600,
    border: '1.5px solid #4B7BE5',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: '#EEF2FB',
    color: '#4B7BE5',
    transition: 'border-color 0.15s, background 0.15s',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #E0E0E0',
    borderTopColor: '#4B7BE5',
    borderRadius: '50%',
    animation: 'resched-spin 0.6s linear infinite',
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
export default function ReschedulePage({ token }: Props) {
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Calendar state
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [availableDates, setAvailableDates] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Selection state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Confirmation state
  const [newBooking, setNewBooking] = useState<NewBooking | null>(null);
  const [rescheduled, setRescheduled] = useState(false);

  // Timezone
  const [timezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
    catch { return 'America/Mexico_City'; }
  });

  // Fetch booking on mount
  useEffect(() => {
    if (!token) {
      setError('Token de reagendamiento no proporcionado.');
      setLoading(false);
      return;
    }

    fetch(`/api/scheduling/booking-by-token?reschedule_token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error === 'Booking not found'
            ? 'No se encontro la reserva. Es posible que ya haya sido reagendada.'
            : data.error);
        } else if (data.estado !== 'confirmada') {
          setError(
            data.estado === 'reagendada'
              ? 'Esta reunion ya fue reagendada.'
              : data.estado === 'cancelada'
              ? 'Esta reunion ya fue cancelada.'
              : `Esta reunion no puede ser reagendada (estado: ${data.estado}).`,
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

  // Fetch available slots when month changes or booking loads
  const fetchSlots = useCallback(async (slug: string, year: number, month: number) => {
    setLoadingSlots(true);
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const daysInMonth = getDaysInMonth(year, month);
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    try {
      const res = await fetch(
        `/api/scheduling/available-slots?slug=${slug}&from=${monthStart}&to=${monthEnd}&tz=${timezone}`,
      );
      if (res.ok) {
        const data = await res.json();
        setAvailableDates(data.slots || data.dates || {});
      }
    } catch {
      // silent
    }
    setLoadingSlots(false);
  }, [timezone]);

  useEffect(() => {
    if (booking?.event_types?.slug) {
      fetchSlots(booking.event_types.slug, viewYear, viewMonth);
    }
  }, [booking, viewYear, viewMonth, fetchSlots]);

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDate(null);
    setSelectedTime(null);
  };

  // Handle reschedule
  const handleReschedule = async () => {
    if (!booking || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/scheduling/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.id,
          token,
          nueva_fecha: selectedDate,
          nueva_hora: selectedTime,
          timezone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al reagendar la reunion.');
        setSubmitting(false);
        return;
      }

      setNewBooking(data.booking || data);
      setRescheduled(true);
    } catch {
      setError('Error de conexion. Intenta de nuevo.');
    }
    setSubmitting(false);
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div style={s.wrapper}>
        <style>{`@keyframes resched-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={s.card}>
          <div style={{ ...s.body, textAlign: 'center', padding: '60px 28px' }}>
            <div style={{ ...s.spinner, margin: '0 auto 16px' }} />
            <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>Cargando informacion...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state (no booking) ──
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

  // ── Rescheduled confirmation ──
  if (rescheduled && booking && newBooking) {
    const et = booking.event_types;
    const duration = et?.duracion_minutos || 30;

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
            <h2 style={s.heading}>Tu reunion ha sido reagendada</h2>
            <p style={s.subtext}>
              Hemos movido tu reunion exitosamente.
            </p>

            {/* Old booking (strikethrough) */}
            <div style={{ background: '#FFF8F0', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#999', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                Anterior
              </p>
              <p style={{ fontSize: '0.875rem', color: '#999', margin: 0, textDecoration: 'line-through' }}>
                {formatDateLong(booking.fecha)} a las {to12h(booking.hora_inicio)}
              </p>
            </div>

            {/* New booking */}
            <div style={{ background: '#E8F5E9', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2e7d32', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                Nueva fecha
              </p>
              <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#2e7d32', margin: 0 }}>
                {formatDateLong(newBooking.fecha)} a las {to12h(newBooking.hora_inicio)}
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#555', margin: '4px 0 0' }}>
                {et?.nombre} — {duration} min
              </p>
            </div>

            {/* Meet link */}
            {newBooking.google_meet_link && (
              <a
                href={newBooking.google_meet_link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...s.btnPrimary,
                  textDecoration: 'none',
                  marginBottom: 12,
                }}
              >
                Unirse a Google Meet
              </a>
            )}

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <a href="/" style={{ fontSize: '0.875rem', color: '#4B7BE5', fontWeight: 600, textDecoration: 'none' }}>
                Ir a sacscloud.com
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main reschedule view ──
  if (!booking) return null;
  const et = booking.event_types;
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Time slots for selected date
  const timeSlots = selectedDate ? (availableDates[selectedDate] || []) : [];

  return (
    <div style={s.wrapper}>
      <style>{`@keyframes resched-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={s.card}>
        <div style={s.header}>
          <p style={s.logo}>Sacs</p>
        </div>
        <div style={s.body}>
          <h2 style={s.heading}>Reagendar reunion</h2>

          {/* Current booking info */}
          <div style={{ ...s.detailCard, background: '#FFF8F0' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#999', margin: '0 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
              Fecha actual
            </p>
            {et && (
              <div style={{ ...s.detailRow, fontWeight: 700, color: '#1A1A1A', fontSize: '0.9375rem', marginBottom: 8 }}>
                {et.nombre}
              </div>
            )}
            <div style={s.detailRow}>
              <CalendarIcon />
              <span style={{ textDecoration: 'line-through', color: '#999' }}>{formatDateLong(booking.fecha)}</span>
            </div>
            <div style={{ ...s.detailRow, marginBottom: 0 }}>
              <ClockIcon />
              <span style={{ textDecoration: 'line-through', color: '#999' }}>{to12h(booking.hora_inicio)} - {to12h(booking.hora_fin)}</span>
            </div>
          </div>

          {/* Calendar */}
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A1A', margin: '0 0 16px' }}>
            Selecciona nueva fecha
          </p>

          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button
              onClick={prevMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, fontSize: '1.125rem', color: '#555' }}
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '1rem', color: '#1A1A1A' }}>
              {MONTH_NAMES_SHORT[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, fontSize: '1.125rem', color: '#555' }}
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {DAY_HEADERS.map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.6875rem', fontWeight: 600, color: '#999', padding: '4px 0', textTransform: 'uppercase' as const }}>
                {d}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 20 }}>
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`e-${i}`} style={{ width: 44, height: 44 }} />;
              }
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const hasSlots = availableDates[dateStr] && availableDates[dateStr].length > 0;
              const isPast = dateStr < todayStr;
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;
              const isClickable = !isPast && hasSlots;

              const cellStyle: React.CSSProperties = {
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                fontSize: '0.875rem',
                fontWeight: isSelected || isToday ? 700 : 500,
                cursor: isClickable ? 'pointer' : 'default',
                border: 'none',
                fontFamily: 'inherit',
                transition: 'background 0.15s',
                background: isSelected
                  ? '#4B7BE5'
                  : isClickable
                  ? '#F7F8FA'
                  : 'transparent',
                color: isSelected
                  ? '#fff'
                  : isPast || !hasSlots
                  ? '#ccc'
                  : isToday
                  ? '#4B7BE5'
                  : '#1A1A1A',
              };

              return (
                <button
                  key={dateStr}
                  style={cellStyle}
                  disabled={!isClickable}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    setSelectedTime(null);
                  }}
                  aria-label={`${day} de ${MONTH_NAMES_SHORT[viewMonth]}`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Loading slots indicator */}
          {loadingSlots && (
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ ...s.spinner, width: 20, height: 20, borderWidth: 2, margin: '0 auto' }} />
            </div>
          )}

          {/* Time slots */}
          {selectedDate && timeSlots.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A1A', margin: '0 0 12px' }}>
                Horarios disponibles — {formatDateLong(selectedDate)}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    style={selectedTime === time ? s.timeSlotSelected : s.timeSlot}
                  >
                    {to12h(time)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedDate && timeSlots.length === 0 && !loadingSlots && (
            <p style={{ fontSize: '0.8125rem', color: '#999', textAlign: 'center', margin: '0 0 20px' }}>
              No hay horarios disponibles para esta fecha.
            </p>
          )}

          {/* Error message */}
          {error && (
            <p style={{ fontSize: '0.8125rem', color: '#DC3545', marginBottom: 12, textAlign: 'center' }}>{error}</p>
          )}

          {/* Confirm button */}
          {selectedDate && selectedTime && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ background: '#F7F8FA', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: '0.8125rem', color: '#777', margin: '0 0 4px' }}>Nueva fecha y hora:</p>
                <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                  {formatDateLong(selectedDate)} a las {to12h(selectedTime)}
                </p>
              </div>
              <button
                onClick={handleReschedule}
                disabled={submitting}
                style={{
                  ...s.btnPrimary,
                  opacity: submitting ? 0.7 : 1,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Reagendando...' : 'Confirmar nueva fecha'}
              </button>
            </div>
          )}

          {/* Back link */}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
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
