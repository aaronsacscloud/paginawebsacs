import { useState, useEffect } from 'react';

// ─── Types ───
interface EventTypeData {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  duracion_minutos: number;
  color: string;
  ubicacion_tipo: string;
  owner_id: string;
  team_members: { nombre: string; email: string } | null;
}

interface QuestionData {
  id: string;
  tipo: string;
  label: string;
  placeholder: string | null;
  required: boolean;
  options: string[] | null;
  orden: number;
}

interface Props {
  eventType: EventTypeData;
  questions: QuestionData[];
}

interface BookingResult {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  google_meet_link: string | null;
  token_reagendar: string | null;
  token_cancelar: string | null;
}

// ─── Constants ───
const TIMEZONES = [
  { value: 'America/Mexico_City', label: 'Ciudad de Mexico (CST)' },
  { value: 'America/Bogota', label: 'Bogota (COT)' },
  { value: 'America/Lima', label: 'Lima (PET)' },
  { value: 'America/Santiago', label: 'Santiago (CLT)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
  { value: 'America/New_York', label: 'Nueva York (EST)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET)' },
];

const GIROS = [
  'Moda y ropa', 'Calzado', 'Joyeria', 'Novedades', 'Vinos y licores',
  'Comestibles', 'Electronica', 'Bicicletas', 'Supermercado', 'Franquicias', 'Otro',
];

const SUCURSALES_OPTIONS = ['1', '2-3', '4-5', '6-10', '10+'];

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

const LONG_DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

const LONG_MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// ─── Styles ───
const styles = {
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
  cardWide: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    width: '100%',
    maxWidth: 560,
    overflow: 'hidden',
  } as React.CSSProperties,
  header: {
    padding: '28px 28px 20px',
    borderBottom: '1px solid #f0f0f0',
  } as React.CSSProperties,
  logo: {
    fontFamily: "'Clash Display', sans-serif",
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#1A1A1A',
    margin: 0,
    letterSpacing: '-0.02em',
  } as React.CSSProperties,
  eventName: {
    fontFamily: "'Sora', sans-serif",
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#1A1A1A',
    margin: '8px 0 4px',
  } as React.CSSProperties,
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.8125rem',
    color: '#777',
    fontWeight: 500,
  } as React.CSSProperties,
  body: {
    padding: '24px 28px 28px',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '0.9375rem',
    border: '1.5px solid #E0E0E0',
    borderRadius: 10,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
    color: '#1A1A1A',
    background: '#fff',
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '0.9375rem',
    border: '1.5px solid #E0E0E0',
    borderRadius: 10,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    color: '#1A1A1A',
    background: '#fff',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: 36,
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#555',
    marginBottom: 6,
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
  link: {
    background: 'none',
    border: 'none',
    color: '#4B7BE5',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    fontWeight: 600,
    padding: 0,
    textDecoration: 'none',
  } as React.CSSProperties,
  fieldGroup: {
    marginBottom: 16,
  } as React.CSSProperties,
};

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
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = LONG_DAY_NAMES[date.getDay()];
  const monthName = LONG_MONTH_NAMES[m - 1];
  return `${dayName} ${d} de ${monthName}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function generateGcalLink(
  title: string,
  startDate: string,
  startTime: string,
  durationMin: number,
  description: string,
  location: string,
): string {
  const start = `${startDate.replace(/-/g, '')}T${startTime.replace(':', '')}00`;
  const [h, m] = startTime.split(':').map(Number);
  const endTotal = h * 60 + m + durationMin;
  const endH = String(Math.floor(endTotal / 60)).padStart(2, '0');
  const endM = String(endTotal % 60).padStart(2, '0');
  const end = `${startDate.replace(/-/g, '')}T${endH}${endM}00`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;
}

// ─── Main Component ───
export default function BookingPage({ eventType, questions }: Props) {
  const [step, setStep] = useState(1);
  const [timezone, setTimezone] = useState('America/Mexico_City');

  // Step 1: Date selection
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Step 2: Time selection
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Step 3: Form
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    whatsapp: '',
    empresa: '',
    giro: '',
    sucursales: '',
    notas: '',
    answers: {} as Record<string, string>,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Step 4: Confirmation
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);

  // ── Fetch available slots on mount and month change ──
  useEffect(() => {
    const fetchSlots = async () => {
      setLoadingSlots(true);
      const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
      const daysInMonth = getDaysInMonth(viewYear, viewMonth);
      const monthEnd = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      try {
        const res = await fetch(
          `/api/scheduling/available-slots?slug=${eventType.slug}&from=${monthStart}&to=${monthEnd}&tz=${timezone}`,
        );
        if (res.ok) {
          const data = await res.json();
          setAvailableDates(data.slots || {});
        }
      } catch {
        // silent
      }
      setLoadingSlots(false);
    };
    fetchSlots();
  }, [viewYear, viewMonth, timezone, eventType.slug]);

  // ── Month navigation ──
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // ── Form handlers ──
  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateAnswer = (questionId: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: value },
    }));
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/scheduling/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type_id: eventType.id,
          fecha: selectedDate,
          hora_inicio: selectedTime,
          hora_fin: addMinutes(selectedTime, eventType.duracion_minutos),
          timezone,
          invitee_nombre: formData.nombre,
          invitee_email: formData.email,
          invitee_whatsapp: formData.whatsapp,
          invitee_empresa: formData.empresa || null,
          giro: formData.giro || null,
          sucursales: formData.sucursales || null,
          notas: formData.notas || null,
          answers: formData.answers,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al crear la reserva' }));
        setFormError(err.error || 'Este horario ya no esta disponible');
        setSubmitting(false);
        return;
      }

      const result = await res.json();
      setBookingResult(result);
      setStep(4);
    } catch {
      setFormError('Error de conexion. Intenta de nuevo.');
    }
    setSubmitting(false);
  };

  // ── Render helpers ──
  const hostName = eventType.team_members?.nombre || 'Equipo Sacs';

  const locationLabel = (tipo: string): string => {
    const labels: Record<string, string> = {
      google_meet: 'Google Meet',
      zoom: 'Zoom',
      whatsapp: 'WhatsApp',
      telefono: 'Telefono',
      presencial: 'Presencial',
    };
    return labels[tipo] || tipo;
  };

  // ── Render header (shared across steps) ──
  const renderHeader = () => (
    <div style={styles.header}>
      <p style={styles.logo}>Sacs</p>
      <h1 style={styles.eventName}>{eventType.nombre}</h1>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span style={styles.badge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          {eventType.duracion_minutos} min
        </span>
        <span style={styles.badge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
          {hostName}
        </span>
        <span style={styles.badge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          {locationLabel(eventType.ubicacion_tipo)}
        </span>
      </div>
    </div>
  );

  // ── Step 1: Calendar ──
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return (
      <div>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button
            onClick={prevMonth}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, fontSize: '1.125rem', color: '#555' }}
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '1rem', color: '#1A1A1A' }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
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
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.6875rem', fontWeight: 600, color: '#999', padding: '4px 0', textTransform: 'uppercase' as const }}>
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} style={{ width: 44, height: 44 }} />;
            }
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasSlots = availableDates[dateStr] && availableDates[dateStr].length > 0;
            const isPast = dateStr < todayStr;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;

            const cellStyle: React.CSSProperties = {
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              fontSize: '0.875rem',
              fontWeight: hasSlots ? 700 : 400,
              cursor: hasSlots && !isPast ? 'pointer' : 'default',
              border: 'none',
              background: isSelected ? '#4B7BE5' : 'transparent',
              color: isSelected ? '#fff' : isPast || !hasSlots ? '#ccc' : '#1A1A1A',
              transition: 'background 0.15s, color 0.15s',
              position: 'relative' as const,
              fontFamily: 'inherit',
            };

            return (
              <button
                key={dateStr}
                style={cellStyle}
                disabled={isPast || !hasSlots}
                onClick={() => {
                  if (hasSlots && !isPast) {
                    setSelectedDate(dateStr);
                    setSelectedTime(null);
                    setStep(2);
                  }
                }}
                onMouseEnter={(e) => {
                  if (hasSlots && !isPast && !isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.background = '#EBF1FC';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }
                }}
              >
                {day}
                {isToday && (
                  <span style={{
                    position: 'absolute' as const,
                    bottom: 4,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: isSelected ? '#fff' : '#4B7BE5',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {loadingSlots && (
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#999', fontSize: '0.8125rem' }}>
            Cargando disponibilidad...
          </div>
        )}

        {/* Timezone selector */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span style={{ fontSize: '0.75rem', color: '#999', fontWeight: 500 }}>Zona horaria</span>
          </div>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{ ...styles.select, fontSize: '0.8125rem', padding: '8px 12px' }}
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  // ── Step 2: Time selection ──
  const renderTimeSelection = () => {
    if (!selectedDate) return null;
    const slots = availableDates[selectedDate] || [];

    return (
      <div>
        <button
          onClick={() => { setStep(1); setSelectedTime(null); }}
          style={{ ...styles.link, marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span style={{ fontSize: '1rem' }}>&larr;</span> Cambiar fecha
        </button>

        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: '1rem', fontWeight: 700, color: '#1A1A1A', margin: '0 0 16px' }}>
          {formatDateLong(selectedDate)}
        </h2>

        {slots.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.875rem' }}>No hay horarios disponibles para esta fecha.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slots.map(slot => {
              const isSelected = slot === selectedTime;
              const endTime = addMinutes(slot, eventType.duracion_minutos);
              return (
                <button
                  key={slot}
                  onClick={() => setSelectedTime(slot)}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 10,
                    border: `1.5px solid ${isSelected ? '#4B7BE5' : '#E0E0E0'}`,
                    background: isSelected ? '#4B7BE5' : '#fff',
                    color: isSelected ? '#fff' : '#1A1A1A',
                    fontSize: '0.9375rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left' as const,
                    transition: 'all 0.15s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#4B7BE5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#E0E0E0';
                    }
                  }}
                >
                  <span>{to12h(slot)}</span>
                  {isSelected && (
                    <span style={{ fontSize: '0.8125rem', opacity: 0.85 }}>
                      {to12h(slot)} - {to12h(endTime)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selectedTime && (
          <button
            onClick={() => setStep(3)}
            style={{ ...styles.btnPrimary, marginTop: 20 }}
          >
            Confirmar
          </button>
        )}
      </div>
    );
  };

  // ── Step 3: Info form ──
  const renderForm = () => {
    const isValid = formData.nombre.trim() && formData.email.trim() && formData.whatsapp.trim();

    return (
      <div>
        <button
          onClick={() => setStep(2)}
          style={{ ...styles.link, marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span style={{ fontSize: '1rem' }}>&larr;</span> Cambiar horario
        </button>

        {/* Selected date/time summary */}
        {selectedDate && selectedTime && (
          <div style={{
            background: '#F7F8FA',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B7BE5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A1A' }}>
              {formatDateLong(selectedDate)}, {to12h(selectedTime)} - {to12h(addMinutes(selectedTime, eventType.duracion_minutos))}
            </span>
          </div>
        )}

        {/* Form fields */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Nombre *</label>
          <input
            type="text"
            value={formData.nombre}
            onChange={(e) => updateField('nombre', e.target.value)}
            placeholder="Tu nombre completo"
            style={styles.input}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#4B7BE5'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Email *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="tu@empresa.com"
            style={styles.input}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#4B7BE5'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>WhatsApp *</label>
          <input
            type="tel"
            value={formData.whatsapp}
            onChange={(e) => updateField('whatsapp', e.target.value)}
            placeholder="+52 55 1234 5678"
            style={styles.input}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#4B7BE5'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Empresa</label>
          <input
            type="text"
            value={formData.empresa}
            onChange={(e) => updateField('empresa', e.target.value)}
            placeholder="Nombre de tu empresa"
            style={styles.input}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#4B7BE5'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Giro</label>
          <select
            value={formData.giro}
            onChange={(e) => updateField('giro', e.target.value)}
            style={styles.select}
          >
            <option value="">Selecciona un giro</option>
            {GIROS.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Sucursales</label>
          <select
            value={formData.sucursales}
            onChange={(e) => updateField('sucursales', e.target.value)}
            style={styles.select}
          >
            <option value="">Selecciona</option>
            {SUCURSALES_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Custom questions */}
        {questions.map(q => (
          <div key={q.id} style={styles.fieldGroup}>
            <label style={styles.label}>{q.label}{q.required ? ' *' : ''}</label>
            {q.tipo === 'text' && (
              <input
                type="text"
                value={formData.answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                placeholder={q.placeholder || ''}
                style={styles.input}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#4B7BE5'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
              />
            )}
            {q.tipo === 'textarea' && (
              <textarea
                value={formData.answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                placeholder={q.placeholder || ''}
                rows={3}
                style={{ ...styles.input, resize: 'vertical' as const }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#4B7BE5'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
              />
            )}
            {q.tipo === 'select' && q.options && (
              <select
                value={formData.answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                style={styles.select}
              >
                <option value="">{q.placeholder || 'Selecciona'}</option>
                {q.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}
            {q.tipo === 'checkbox' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.answers[q.id] === 'true'}
                  onChange={(e) => updateAnswer(q.id, e.target.checked ? 'true' : 'false')}
                  style={{ width: 18, height: 18, accentColor: '#4B7BE5' }}
                />
                <span style={{ fontSize: '0.875rem', color: '#555' }}>{q.placeholder || 'Si'}</span>
              </label>
            )}
          </div>
        ))}

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Notas</label>
          <textarea
            value={formData.notas}
            onChange={(e) => updateField('notas', e.target.value)}
            placeholder="Algo que debamos saber antes de la reunion?"
            rows={3}
            style={{ ...styles.input, resize: 'vertical' as const }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#4B7BE5'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
          />
        </div>

        {formError && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 16,
            fontSize: '0.875rem',
            color: '#DC2626',
          }}>
            {formError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          style={{
            ...styles.btnPrimary,
            opacity: !isValid || submitting ? 0.5 : 1,
            cursor: !isValid || submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Agendando...' : 'Agendar reunion'}
        </button>
      </div>
    );
  };

  // ── Step 4: Confirmation ──
  const renderConfirmation = () => {
    if (!bookingResult || !selectedDate || !selectedTime) return null;

    const meetingTitle = `${eventType.nombre} — Sacs`;
    const meetingDesc = `Reunion con ${hostName}.\n${eventType.descripcion || ''}`;
    const meetingLocation = bookingResult.google_meet_link || locationLabel(eventType.ubicacion_tipo);
    const gcalLink = generateGcalLink(meetingTitle, selectedDate, selectedTime, eventType.duracion_minutos, meetingDesc, meetingLocation);

    const waMessage = encodeURIComponent(
      `Hola! Acabo de agendar mi ${eventType.nombre} para el ${formatDateLong(selectedDate)} a las ${to12h(selectedTime)}. Confirmado!`,
    );
    const waLink = `https://wa.me/?text=${waMessage}`;

    return (
      <div style={{ textAlign: 'center' as const }}>
        {/* Green check */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: '#ECFDF5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: '1.25rem', fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>
          Listo! Tu reunion esta agendada
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#777', margin: '0 0 24px' }}>
          Te enviamos una confirmacion por email.
        </p>

        {/* Details card */}
        <div style={{
          background: '#F7F8FA',
          borderRadius: 12,
          padding: '20px',
          textAlign: 'left' as const,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: eventType.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1A1A1A' }}>{eventType.nombre}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span style={{ fontSize: '0.875rem', color: '#555' }}>
                {formatDateLong(selectedDate)}, {to12h(selectedTime)} - {to12h(addMinutes(selectedTime, eventType.duracion_minutos))}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={{ fontSize: '0.875rem', color: '#555' }}>{eventType.duracion_minutos} minutos</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              <span style={{ fontSize: '0.875rem', color: '#555' }}>{hostName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{ fontSize: '0.875rem', color: '#555' }}>{locationLabel(eventType.ubicacion_tipo)}</span>
            </div>
            {bookingResult.google_meet_link && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 10l5-3v10l-5-3" /><rect x="1" y="6" width="14" height="12" rx="2" ry="2" />
                </svg>
                <a
                  href={bookingResult.google_meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.875rem', color: '#4B7BE5', fontWeight: 600, textDecoration: 'none' }}
                >
                  Unirse a Google Meet
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          <a
            href={gcalLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...styles.btnPrimary, textDecoration: 'none' }}
          >
            Agregar a Google Calendar
          </a>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...styles.btnOutline, width: '100%', justifyContent: 'center', boxSizing: 'border-box' as const }}
          >
            Enviar por WhatsApp
          </a>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
            {bookingResult.token_reagendar && (
              <a
                href={`/agendar/${eventType.slug}?reschedule=${bookingResult.token_reagendar}`}
                style={{ ...styles.link, fontSize: '0.8125rem' }}
              >
                Reagendar
              </a>
            )}
            {bookingResult.token_cancelar && (
              <a
                href={`/agendar/${eventType.slug}?cancel=${bookingResult.token_cancelar}`}
                style={{ ...styles.link, fontSize: '0.8125rem', color: '#DC2626' }}
              >
                Cancelar
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <p style={{ fontSize: '0.6875rem', color: '#ccc', marginTop: 24, marginBottom: 0 }}>
          Powered by Sacs
        </p>
      </div>
    );
  };

  // ── Main render ──
  const isConfirmation = step === 4;

  return (
    <div style={styles.wrapper}>
      <div style={isConfirmation ? styles.cardWide : styles.card}>
        {renderHeader()}
        <div style={styles.body}>
          {step === 1 && renderCalendar()}
          {step === 2 && renderTimeSelection()}
          {step === 3 && renderForm()}
          {step === 4 && renderConfirmation()}
        </div>
      </div>
    </div>
  );
}
