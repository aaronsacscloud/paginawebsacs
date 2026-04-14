import { useState, useEffect, useRef } from 'react';

// ─── Types ───
interface EventTypeData {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  duracion_minutos: number;
  color: string;
  ubicacion_tipo: string;
  tipo_reunion?: string;
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

// ─── Branding Config ───
interface BrandingConfig {
  logo_url: string;
  primary_color: string;
  welcome_message: string;
  confirmation_message: string;
  company_name: string;
}

const BRANDING_DEFAULTS: BrandingConfig = {
  logo_url: '',
  primary_color: '#4B7BE5',
  welcome_message: '',
  confirmation_message: '',
  company_name: 'Sacs',
};

// ─── Main Component ───
export default function BookingPage({ eventType, questions: initialQuestions }: Props) {
  const [step, setStep] = useState(1);
  const [timezone, setTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
    catch { return 'America/Mexico_City'; }
  });

  // ── Load questions dynamically (not from static props) ──
  const [questions, setQuestions] = useState<QuestionData[]>(initialQuestions || []);
  useEffect(() => {
    fetch(`/api/scheduling/questions?event_type_id=${eventType.id}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setQuestions(data); })
      .catch(() => {});
  }, [eventType.id]);

  // ── Branding ──
  const [branding, setBranding] = useState<BrandingConfig>(BRANDING_DEFAULTS);

  // ── Activity tracking ──
  const sessionRef = useRef<string>('');
  const formStartedRef = useRef(false);

  const trackEvent = (event: string, meta?: any) => {
    fetch('/api/scheduling/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, slug: eventType.slug, session_id: sessionRef.current, metadata: meta }),
    }).catch(() => {});
  };

  useEffect(() => {
    sessionRef.current = crypto.randomUUID();
    trackEvent('page_view');
  }, []);

  // ── Fetch branding config ──
  useEffect(() => {
    fetch('/api/scheduling/config')
      .then(res => res.ok ? res.json() : BRANDING_DEFAULTS)
      .then(data => setBranding({ ...BRANDING_DEFAULTS, ...data }))
      .catch(() => {});
  }, []);

  // ── Social Proof & Urgency ──
  const [socialProof, setSocialProof] = useState<any>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [currentToast, setCurrentToast] = useState<any>(null);
  const toastIndexRef = useRef(0);
  const [showAllSlots, setShowAllSlots] = useState(false);

  useEffect(() => {
    fetch('/api/scheduling/social-proof')
      .then(r => r.json())
      .then(data => setSocialProof(data))
      .catch(() => {});
  }, []);

  // Toast rotation - show a new toast every 25-40 seconds
  useEffect(() => {
    if (!socialProof?.toasts?.length) return;

    const showToast = () => {
      const toast = socialProof.toasts[toastIndexRef.current % socialProof.toasts.length];
      setCurrentToast(toast);
      setToastVisible(true);
      toastIndexRef.current++;
      setTimeout(() => setToastVisible(false), 4500);
    };

    // First toast after 8 seconds
    const firstTimeout = setTimeout(showToast, 8000);
    // Then every 25-40 seconds
    const interval = setInterval(showToast, 25000 + Math.random() * 15000);

    return () => { clearTimeout(firstTimeout); clearInterval(interval); };
  }, [socialProof]);

  // Computed primary color from branding
  const primaryColor = branding.primary_color || '#4B7BE5';

  // Step 1: Date selection
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Waitlist (Feature 20)
  const [fullDates, setFullDates] = useState<string[]>([]);
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [waitlistData, setWaitlistData] = useState({ nombre: '', email: '', whatsapp: '' });
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);

  // Step 2: Time selection
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slotCapacity, setSlotCapacity] = useState<Record<string, Record<string, number>>>({});

  // Recurrence (Feature 21)
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'weekly' | 'biweekly'>('weekly');
  const [recurrenceCount, setRecurrenceCount] = useState(4);

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
          setAvailableDates(data.slots || data.dates || {});
          setFullDates(data.full_dates || []);
          if (data.slot_capacity) setSlotCapacity(data.slot_capacity);
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

  // Extract answer by question label (for backward compatibility with empresa/giro/sucursales/notas)
  const extractAnswer = (label: string): string => {
    const q = questions.find(q => q.label.toLowerCase() === label.toLowerCase());
    if (q) return formData.answers[q.id] || '';
    return '';
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
          event_type_slug: eventType.slug,
          fecha: selectedDate,
          hora_inicio: selectedTime,
          hora_fin: addMinutes(selectedTime, eventType.duracion_minutos),
          timezone,
          nombre: formData.nombre,
          email: formData.email,
          whatsapp: formData.whatsapp,
          empresa: formData.empresa || extractAnswer('Empresa') || null,
          giro: formData.giro || extractAnswer('Giro') || null,
          sucursales: formData.sucursales || extractAnswer('Sucursales') || null,
          notas: formData.notas || extractAnswer('Notas') || null,
          answers: Object.entries(formData.answers).filter(([,v]) => v).map(([qid, valor]) => ({ question_id: qid, valor })),
          ...(recurrenceEnabled ? { recurrence: { frequency: recurrenceFrequency, count: recurrenceCount } } : {}),
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
      trackEvent('form_submitted', { date: selectedDate, time: selectedTime, booking_id: result.id });
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
      {branding.logo_url ? (
        <img
          src={branding.logo_url}
          alt={branding.company_name || 'Logo'}
          style={{ height: 32, objectFit: 'contain' as const, marginBottom: 4 }}
          loading="lazy"
          width="auto"
          height="32"
        />
      ) : (
        <p style={styles.logo}>{branding.company_name || 'Sacs'}</p>
      )}
      <h1 style={styles.eventName}>{eventType.nombre}</h1>
      {branding.welcome_message && (
        <p style={{ fontSize: '0.8125rem', color: '#777', margin: '4px 0 8px', lineHeight: 1.5 }}>
          {branding.welcome_message}
        </p>
      )}
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
            const isFull = fullDates.includes(dateStr);
            const isPast = dateStr < todayStr;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            const isClickable = (!isPast && hasSlots) || (!isPast && isFull);

            const cellStyle: React.CSSProperties = {
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              fontSize: '0.875rem',
              fontWeight: hasSlots || isFull ? 700 : 400,
              cursor: isClickable ? 'pointer' : 'default',
              border: isFull && !isPast ? `1.5px dashed ${primaryColor}` : 'none',
              background: isSelected ? primaryColor : 'transparent',
              color: isSelected ? '#fff' : isPast || (!hasSlots && !isFull) ? '#ccc' : isFull ? primaryColor : '#1A1A1A',
              transition: 'background 0.15s, color 0.15s',
              position: 'relative' as const,
              fontFamily: 'inherit',
            };

            return (
              <button
                key={dateStr}
                style={cellStyle}
                disabled={!isClickable}
                onClick={() => {
                  if (isPast) return;
                  if (hasSlots) {
                    setSelectedDate(dateStr);
                    setSelectedTime(null);
                    setShowAllSlots(false);
                    setShowWaitlistForm(false);
                    setWaitlistDone(false);
                    setStep(2);
                    trackEvent('date_selected', { date: dateStr });
                  } else if (isFull) {
                    setSelectedDate(dateStr);
                    setSelectedTime(null);
                    setShowAllSlots(false);
                    setShowWaitlistForm(true);
                    setWaitlistDone(false);
                    setStep(2);
                    trackEvent('waitlist_date_selected', { date: dateStr });
                  }
                }}
                onMouseEnter={(e) => {
                  if (isClickable && !isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.background = `${primaryColor}15`;
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
                    background: isSelected ? '#fff' : primaryColor,
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

        {/* Viewers indicator */}
        {socialProof && (
          <div style={{ textAlign: 'center', fontSize: '0.6875rem', color: '#999', marginTop: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2AB5A0', display: 'inline-block' }} />
              {socialProof.viewers} personas viendo esta página
            </span>
          </div>
        )}
      </div>
    );
  };

  // ── Waitlist submit handler ──
  const handleWaitlistSubmit = async () => {
    if (!selectedDate || !waitlistData.nombre.trim() || !waitlistData.email.trim()) return;
    setWaitlistSubmitting(true);
    try {
      await fetch('/api/scheduling/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type_slug: eventType.slug,
          fecha: selectedDate,
          nombre: waitlistData.nombre,
          email: waitlistData.email,
          whatsapp: waitlistData.whatsapp,
        }),
      });
      setWaitlistDone(true);
      trackEvent('waitlist_submitted', { date: selectedDate });
    } catch { /* silent */ }
    setWaitlistSubmitting(false);
  };

  // ── Step 2: Time selection ──
  const renderTimeSelection = () => {
    if (!selectedDate) return null;
    const slots = availableDates[selectedDate] || [];

    // Show waitlist form if date is full
    if (showWaitlistForm) {
      return (
        <div>
          <button
            onClick={() => { setStep(1); setSelectedTime(null); setShowWaitlistForm(false); setWaitlistDone(false); }}
            style={{ ...styles.link, marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <span style={{ fontSize: '1rem' }}>&larr;</span> Cambiar fecha
          </button>

          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: '1rem', fontWeight: 700, color: '#1A1A1A', margin: '0 0 8px' }}>
            {formatDateLong(selectedDate)}
          </h2>

          {waitlistDone ? (
            <div style={{ textAlign: 'center' as const, padding: '24px 0' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', background: '#ECFDF5',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>
                Te anotamos en la lista de espera
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#777', margin: 0 }}>
                Te avisaremos si se abre un espacio para el {formatDateLong(selectedDate)}.
              </p>
            </div>
          ) : (
            <>
              <div style={{
                background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10,
                padding: '12px 16px', marginBottom: 20,
              }}>
                <p style={{ fontSize: '0.8125rem', color: '#9A3412', margin: 0, lineHeight: 1.5 }}>
                  Este dia esta lleno. Dejanos tus datos y te avisamos si se abre un espacio.
                </p>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Nombre *</label>
                <input
                  type="text"
                  value={waitlistData.nombre}
                  onChange={(e) => setWaitlistData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Tu nombre completo"
                  style={styles.input}
                  onFocus={(e) => { e.currentTarget.style.borderColor = primaryColor; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Email *</label>
                <input
                  type="email"
                  value={waitlistData.email}
                  onChange={(e) => setWaitlistData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="tu@empresa.com"
                  style={styles.input}
                  onFocus={(e) => { e.currentTarget.style.borderColor = primaryColor; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>WhatsApp</label>
                <input
                  type="tel"
                  value={waitlistData.whatsapp}
                  onChange={(e) => setWaitlistData(prev => ({ ...prev, whatsapp: e.target.value }))}
                  placeholder="+52 55 1234 5678"
                  style={styles.input}
                  onFocus={(e) => { e.currentTarget.style.borderColor = primaryColor; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
                />
              </div>

              <button
                onClick={handleWaitlistSubmit}
                disabled={!waitlistData.nombre.trim() || !waitlistData.email.trim() || waitlistSubmitting}
                style={{
                  ...styles.btnPrimary,
                  background: primaryColor,
                  opacity: !waitlistData.nombre.trim() || !waitlistData.email.trim() || waitlistSubmitting ? 0.5 : 1,
                  cursor: !waitlistData.nombre.trim() || !waitlistData.email.trim() || waitlistSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {waitlistSubmitting ? 'Enviando...' : 'Unirme a la lista de espera'}
              </button>
            </>
          )}
        </div>
      );
    }

    // Scarcity mode logic
    const allSlotsForDay = slots;
    const scarcityMode = true;
    const popularTimes = new Set(socialProof?.popular_times || []);

    // In scarcity mode, show only 2-3 slots unless expanded
    const displaySlots = (!scarcityMode || showAllSlots)
      ? allSlotsForDay
      : (() => {
          if (allSlotsForDay.length <= 3) return allSlotsForDay;
          // Pick 2-3 spread-out slots (not all adjacent)
          const indices = new Set<number>();
          indices.add(0);
          indices.add(Math.floor(allSlotsForDay.length / 2));
          if (allSlotsForDay.length > 4) indices.add(allSlotsForDay.length - 2);
          return Array.from(indices).sort((a, b) => a - b).map(i => allSlotsForDay[i]);
        })();
    const hiddenCount = allSlotsForDay.length - displaySlots.length;

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

        {allSlotsForDay.length === 0 ? (
          <p style={{ color: '#999', fontSize: '0.875rem' }}>No hay horarios disponibles para esta fecha.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scarcityMode && allSlotsForDay.length > 3 && !showAllSlots && (
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9A3412', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9A3412" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Últimos horarios disponibles
              </div>
            )}

            {/* Inline activity toast */}
            {currentToast && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', marginBottom: 4,
                background: 'linear-gradient(135deg, #f0fdf4 0%, #f0f9ff 100%)',
                borderRadius: 10, border: '1px solid #d1fae5',
                opacity: toastVisible ? 1 : 0,
                maxHeight: toastVisible ? 60 : 0,
                overflow: 'hidden',
                transition: 'opacity 0.5s ease, max-height 0.5s ease',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6875rem', fontWeight: 800, color: '#16a34a', flexShrink: 0,
                  border: '2px solid #bbf7d0',
                }}>{currentToast.nombre?.charAt(0)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1a1a1a' }}>
                    {currentToast.nombre} agendó una demo
                  </div>
                  <div style={{ fontSize: '0.625rem', color: '#6b7280' }}>
                    para el {currentToast.dia} · {currentToast.hace}
                  </div>
                </div>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              </div>
            )}

            {displaySlots.map(slot => {
              const isSelected = slot === selectedTime;
              const endTime = addMinutes(slot, eventType.duracion_minutos);
              return (
                <button
                  key={slot}
                  onClick={() => { setSelectedTime(slot); trackEvent('time_selected', { date: selectedDate, time: slot }); setTimeout(() => setStep(3), 300); }}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 10,
                    border: `1.5px solid ${isSelected ? primaryColor : '#E0E0E0'}`,
                    background: isSelected ? primaryColor : '#fff',
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
                      (e.currentTarget as HTMLButtonElement).style.borderColor = primaryColor;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#E0E0E0';
                    }
                  }}
                >
                  <span>
                    {to12h(slot)}
                    {popularTimes.has(slot) && (
                      <span style={{ fontSize: '0.5rem', fontWeight: 700, color: '#9A3412', background: '#FFF7ED', padding: '1px 5px', borderRadius: 6, marginLeft: 6 }}>Popular</span>
                    )}
                    {eventType.tipo_reunion === 'grupal' && slotCapacity[selectedDate!] && slotCapacity[selectedDate!][slot] !== undefined && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 400, marginLeft: 8, opacity: 0.7 }}>
                        ({slotCapacity[selectedDate!][slot]} {slotCapacity[selectedDate!][slot] === 1 ? 'lugar disponible' : 'lugares disponibles'})
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <span style={{ fontSize: '0.8125rem', opacity: 0.85 }}>
                      {to12h(slot)} - {to12h(endTime)}
                    </span>
                  )}
                </button>
              );
            })}
            {scarcityMode && hiddenCount > 0 && !showAllSlots && (
              <button
                onClick={() => setShowAllSlots(true)}
                style={{ width: '100%', padding: '10px', background: 'none', border: '1px dashed #ddd', borderRadius: 10, cursor: 'pointer', color: '#999', fontSize: '0.8125rem', fontFamily: 'inherit', marginTop: 6 }}
              >
                + Ver {hiddenCount} horarios más
              </button>
            )}
          </div>
        )}

        {/* Auto-advances to step 3 on time selection — no confirm button needed */}
      </div>
    );
  };

  // ── Step 3: Info form ──
  const renderForm = () => {
    const requiredQuestionsFilled = questions.filter(q => q.required && q.activo !== false).every(q => (formData.answers[q.id] || '').trim());
    const isValid = formData.nombre.trim() && formData.email.trim() && formData.whatsapp.trim() && requiredQuestionsFilled;

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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            onFocus={(e) => { e.currentTarget.style.borderColor = '#4B7BE5'; if (!formStartedRef.current) { formStartedRef.current = true; trackEvent('form_started'); } }}
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
            onFocus={(e) => { e.currentTarget.style.borderColor = '#4B7BE5'; if (!formStartedRef.current) { formStartedRef.current = true; trackEvent('form_started'); } }}
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
            onFocus={(e) => { e.currentTarget.style.borderColor = '#4B7BE5'; if (!formStartedRef.current) { formStartedRef.current = true; trackEvent('form_started'); } }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
          />
        </div>

        {/* All configurable fields from booking_questions */}
        {[...questions.filter(q => q.activo !== false && q.required), ...questions.filter(q => q.activo !== false && !q.required)].map(q => (
          <div key={q.id} style={styles.fieldGroup}>
            <label style={styles.label}>{q.label}{q.required ? ' *' : ''}</label>
            {(q.tipo === 'text' || q.tipo === 'phone' || q.tipo === 'number') && (
              <input
                type={q.tipo === 'phone' ? 'tel' : q.tipo === 'number' ? 'number' : 'text'}
                value={formData.answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                placeholder={q.placeholder || ''}
                style={styles.input}
                onFocus={(e) => { e.currentTarget.style.borderColor = primaryColor; }}
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
                onFocus={(e) => { e.currentTarget.style.borderColor = primaryColor; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E0E0E0'; }}
              />
            )}
            {(q.tipo === 'select' || q.tipo === 'radio') && q.options && (
              <select
                value={formData.answers[q.id] || ''}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                style={styles.select}
              >
                <option value="">{q.placeholder || 'Selecciona'}</option>
                {q.options.map((opt: string) => (
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
                  style={{ width: 18, height: 18, accentColor: primaryColor }}
                />
                <span style={{ fontSize: '0.875rem', color: '#555' }}>{q.placeholder || 'Sí'}</span>
              </label>
            )}
          </div>
        ))}

        {/* Recurrence toggle - only show if enabled in event type config */}
        {(eventType as any).routing_rules?.mostrar_recurrencia ? (
          <div style={{ ...styles.fieldGroup, background: '#F7F8FA', borderRadius: 10, padding: '14px 16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: recurrenceEnabled ? 12 : 0 }}>
              <input
                type="checkbox"
                checked={recurrenceEnabled}
                onChange={(e) => setRecurrenceEnabled(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: primaryColor }}
              />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A1A' }}>
                Repetir esta reunion?
              </span>
            </label>
            {recurrenceEnabled && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ ...styles.label, fontSize: '0.75rem' }}>Frecuencia</label>
                  <select
                    value={recurrenceFrequency}
                    onChange={(e) => setRecurrenceFrequency(e.target.value as 'weekly' | 'biweekly')}
                    style={{ ...styles.select, fontSize: '0.8125rem', padding: '8px 12px' }}
                  >
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quincenal</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <label style={{ ...styles.label, fontSize: '0.75rem' }}>Sesiones</label>
                  <select
                    value={recurrenceCount}
                    onChange={(e) => setRecurrenceCount(Number(e.target.value))}
                    style={{ ...styles.select, fontSize: '0.8125rem', padding: '8px 12px' }}
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>{n} sesiones</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        ) : null}

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
            background: primaryColor,
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

    // Configurable offer (from routing_rules.oferta or defaults)
    const oferta = (eventType as any).routing_rules?.oferta || {
      trial_dias: 7,
      descuento_pct: 35,
      descuento_plan: 'anual',
      migracion_gratis: true,
      migracion_valor: 9000,
      consultoria_horas: 3,
      consultoria_valor: 8000,
      mostrar_oferta: true,
    };

    return (
      <div>
        {/* Success header */}
        <div style={{ textAlign: 'center' as const, marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#ECFDF5',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: '1.25rem', fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>
            ¡Felicidades! Tu sesión está confirmada
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#777', margin: 0 }}>
            Tu consultor te estará esperando. Te enviaremos confirmación por WhatsApp y email.
          </p>
        </div>

        {/* Meeting summary card */}
        <div style={{ background: '#F7F8FA', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 10 }}>Resumen de tu reunión</div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
              <span style={{ color: '#777' }}>Sesión</span>
              <span style={{ fontWeight: 700, color: '#1A1A1A' }}>{eventType.nombre}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
              <span style={{ color: '#777' }}>Fecha</span>
              <span style={{ fontWeight: 600, color: '#1A1A1A' }}>{formatDateLong(selectedDate)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
              <span style={{ color: '#777' }}>Hora</span>
              <span style={{ fontWeight: 600, color: '#1A1A1A' }}>{to12h(selectedTime)} - {to12h(addMinutes(selectedTime, eventType.duracion_minutos))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
              <span style={{ color: '#777' }}>Consultor</span>
              <span style={{ fontWeight: 600, color: '#1A1A1A' }}>{hostName}</span>
            </div>
            {bookingResult.google_meet_link && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', alignItems: 'center' }}>
                <span style={{ color: '#777' }}>Link</span>
                <a href={bookingResult.google_meet_link} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: primaryColor, textDecoration: 'none', fontSize: '0.75rem' }}>
                  Google Meet →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons - calendar + whatsapp */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <a href={gcalLink} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px', background: '#fff', border: '1.5px solid #e0e0e0', borderRadius: 10, textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600, color: '#1A1A1A' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Agregar al calendario
          </a>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Acabo de agendar mi ${eventType.nombre} con SACS para el ${formatDateLong(selectedDate)} a las ${to12h(selectedTime)}`)}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px', background: '#25D366', border: 'none', borderRadius: 10, textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600, color: '#fff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
            WhatsApp
          </a>
        </div>

        {/* QR Code for calendar */}
        <div style={{ textAlign: 'center' as const, marginBottom: 16, padding: '16px', background: '#fafafa', borderRadius: 12 }}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(gcalLink)}&bgcolor=fafafa&color=1a1a1a&margin=0`}
            alt="QR Calendar"
            width={140}
            height={140}
            style={{ borderRadius: 8 }}
          />
          <div style={{ fontSize: '0.6875rem', color: '#999', marginTop: 8 }}>
            Escanea para guardar en tu calendario
          </div>
        </div>

        {/* ═══ SURPRISE OFFER ═══ */}
        {oferta.mostrar_oferta && (
          <div style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f0f9ff 50%, #f0fdf4 100%)', borderRadius: 14, padding: '20px', border: '1.5px solid #e9d5ff', marginBottom: 16 }}>
            <div style={{ textAlign: 'center' as const, marginBottom: 16 }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>🎉</div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '1rem', fontWeight: 800, color: '#1A1A1A', marginBottom: 4 }}>
                ¡Sorpresa! Tenemos algo especial para ti
              </div>
              <div style={{ fontSize: '0.75rem', color: '#777' }}>
                Mientras esperas tu sesión, prueba SACS y llega preparado
              </div>
            </div>

            {/* Offer items */}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {/* Free trial */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem' }}>🚀</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1A1A1A' }}>Prueba gratis de {oferta.trial_dias} días</div>
                  <div style={{ fontSize: '0.6875rem', color: '#777' }}>Experimenta SACS antes de tu sesión</div>
                </div>
                <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 20 }}>GRATIS</span>
              </div>

              {/* Discount */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem' }}>💰</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1A1A1A' }}>{oferta.descuento_pct}% de descuento en plan {oferta.descuento_plan}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#777' }}>Solo durante estos {oferta.trial_dias} días de prueba</div>
                </div>
                <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#9333ea', background: '#f3e8ff', padding: '2px 8px', borderRadius: 20 }}>-{oferta.descuento_pct}%</span>
              </div>

              {/* Migration */}
              {oferta.migracion_gratis && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem' }}>📦</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1A1A1A' }}>Migración gratis</div>
                    <div style={{ fontSize: '0.6875rem', color: '#777' }}>Valor normal: <s>${oferta.migracion_valor?.toLocaleString()}</s> MXN</div>
                  </div>
                  <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 20 }}>GRATIS</span>
                </div>
              )}

              {/* Consultancy */}
              {oferta.consultoria_horas > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem' }}>👨‍💼</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1A1A1A' }}>{oferta.consultoria_horas}h de consultoría con experto</div>
                    <div style={{ fontSize: '0.6875rem', color: '#777' }}>Valor normal: <s>${oferta.consultoria_valor?.toLocaleString()}</s> MXN</div>
                  </div>
                  <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 20 }}>GRATIS</span>
                </div>
              )}
            </div>

            {/* CTA */}
            <a href="/prueba-gratis" target="_blank" rel="noopener noreferrer" style={{
              display: 'block', textAlign: 'center' as const, padding: '14px 24px', marginTop: 16,
              background: '#1A1A1A', color: '#fff', borderRadius: 10, textDecoration: 'none',
              fontWeight: 700, fontSize: '0.875rem',
            }}>
              Activar mi prueba gratis de {oferta.trial_dias} días
            </a>
            <div style={{ textAlign: 'center' as const, fontSize: '0.625rem', color: '#999', marginTop: 6 }}>
              Sin tarjeta de crédito · Se cancela en cualquier momento
            </div>
          </div>
        )}

        {/* Reschedule/Cancel links */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
          {bookingResult.token_reagendar && (
            <a href={`/agendar/${eventType.slug}?reschedule=${bookingResult.token_reagendar}`} style={{ ...styles.link, fontSize: '0.75rem' }}>Reagendar</a>
          )}
          {bookingResult.token_cancelar && (
            <a href={`/agendar/${eventType.slug}?cancel=${bookingResult.token_cancelar}`} style={{ ...styles.link, fontSize: '0.75rem', color: '#DC2626' }}>Cancelar</a>
          )}
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
        {/* Social Proof Banner */}
        {socialProof && (
          <div style={{
            background: '#FFF7ED', padding: '8px 16px', textAlign: 'center',
            fontSize: '0.75rem', color: '#9A3412', fontWeight: 600,
            borderBottom: '1px solid #FED7AA',
          }}>
            {socialProof.bookings_this_week} personas agendaron esta semana
          </div>
        )}
        {renderHeader()}

        {/* Step indicator */}
        {step < 4 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, padding: '16px 24px 0' }}>
            {[
              { n: 1, label: 'Fecha' },
              { n: 2, label: 'Hora' },
              { n: 3, label: 'Datos' },
            ].map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: step >= s.n ? primaryColor : '#f0f0f0',
                    color: step >= s.n ? '#fff' : '#bbb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6875rem', fontWeight: 700,
                    transition: 'all 0.3s ease',
                  }}>{step > s.n ? '✓' : s.n}</div>
                  <span style={{
                    fontSize: '0.5625rem', fontWeight: 600,
                    color: step >= s.n ? '#1a1a1a' : '#bbb',
                    transition: 'color 0.3s ease',
                  }}>{s.label}</span>
                </div>
                {i < 2 && (
                  <div style={{
                    width: 40, height: 2, background: step > s.n ? primaryColor : '#e0e0e0',
                    margin: '0 8px', marginBottom: 18,
                    transition: 'background 0.3s ease',
                  }} />
                )}
              </div>
            ))}
          </div>
        )}

        <div style={styles.body}>
          {step === 1 && renderCalendar()}
          {step === 2 && renderTimeSelection()}
          {step === 3 && renderForm()}
          {step === 4 && renderConfirmation()}
        </div>
      </div>

      {/* Toast moved inline above time slots */}
    </div>
  );
}
