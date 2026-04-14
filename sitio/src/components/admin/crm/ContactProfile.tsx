import { useState, useEffect, useRef } from 'react';

// ─── Types ───
interface Company {
  id: string; nombre: string; plan: string | null; sucursales: number;
  mrr: number; arr: number; estado_cuenta: string;
  fecha_renovacion: string | null; giro: string | null;
  rfc: string | null; razon_social: string | null;
}

interface Contact {
  id: string; created_at: string; nombre: string; apellido: string | null;
  email: string | null; whatsapp: string | null; telefono: string | null;
  tipo: string; lifecycle_stage: string; lead_score: number;
  total_time_on_site: number; pages_visited: string | null; page_count: number;
  giro: string | null; sucursales_interes: number | null;
  plan_interes: string | null; next_followup: string | null;
  last_contact_at: string | null; puesto: string | null;
  fuente: string | null; visitor_id: string | null;
  company_id: string | null;
  companies: Company | null;
  deals: Deal[];
  activities: Activity[];
  quotes: Quote[];
}

interface Deal {
  id: string; created_at: string; nombre: string; stage: string;
  plan: string | null; valor_total: number; probabilidad: number;
}

interface Activity {
  id: string; created_at: string; tipo: string; titulo: string | null;
  descripcion: string | null; metadata: any; automatico: boolean;
}

interface Quote {
  id: string; numero: string | null; empresa: string | null;
  total: number; estado: string; created_at: string;
}

// ─── Constants ───
const LIFECYCLE_STAGES = [
  { id: 'suscriptor', label: 'Suscriptor', color: '#94a3b8' },
  { id: 'lead', label: 'Lead', color: '#6C5CE7' },
  { id: 'lead_calificado', label: 'MQL', color: '#4B7BE5' },
  { id: 'oportunidad', label: 'Oportunidad', color: '#E8A838' },
  { id: 'cliente', label: 'Cliente', color: '#2AB5A0' },
  { id: 'evangelista', label: 'Evangelista', color: '#F39C12' },
  { id: 'churned', label: 'Churned', color: '#999' },
];

const TIPO_OPTIONS = [
  { id: 'lead', label: 'Lead' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'partner', label: 'Partner' },
  { id: 'churned', label: 'Churned' },
];

const PLAN_OPTIONS = [
  { id: '', label: 'Sin plan' },
  { id: 'vende', label: 'Vende' },
  { id: 'controla', label: 'Controla' },
  { id: 'fideliza', label: 'Fideliza' },
  { id: 'automatiza', label: 'Automatiza' },
];

const ACTIVITY_TYPES = [
  { id: 'nota', label: 'Nota', icon: '\u{1F4DD}' },
  { id: 'llamada', label: 'Llamada', icon: '\u{1F4DE}' },
  { id: 'whatsapp_enviado', label: 'WhatsApp enviado', icon: '\u{1F4F1}' },
  { id: 'email_enviado', label: 'Email enviado', icon: '\u{2709}\u{FE0F}' },
  { id: 'demo_agendada', label: 'Demo agendada', icon: '\u{1F4C5}' },
  { id: 'demo_realizada', label: 'Demo realizada', icon: '\u{1F4C5}' },
  { id: 'pago_recibido', label: 'Pago recibido', icon: '\u{1F4B0}' },
];

const ACTIVITY_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'nota', label: 'Notas' },
  { id: 'email', label: 'Emails' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'llamada', label: 'Llamadas' },
  { id: 'demo', label: 'Demos' },
  { id: 'cotizacion', label: 'Cotizaciones' },
  { id: 'pago', label: 'Pagos' },
  { id: 'sistema', label: 'Sistema' },
];

const DEAL_STAGES: Record<string, { label: string; color: string }> = {
  calificacion: { label: 'Calificacion', color: '#6C5CE7' },
  demo_agendada: { label: 'Demo agendada', color: '#4B7BE5' },
  demo_realizada: { label: 'Demo realizada', color: '#E8A838' },
  cotizacion_enviada: { label: 'Cotizacion enviada', color: '#F39C12' },
  negociacion: { label: 'Negociacion', color: '#2AB5A0' },
  cerrada_ganada: { label: 'Cerrada ganada', color: '#2e7d32' },
  cerrada_perdida: { label: 'Cerrada perdida', color: '#999' },
};

const QUOTE_STATES: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: '#94a3b8' },
  enviada: { label: 'Enviada', color: '#4B7BE5' },
  vista: { label: 'Vista', color: '#E8A838' },
  aceptada: { label: 'Aceptada', color: '#2AB5A0' },
  pagada: { label: 'Pagada', color: '#2e7d32' },
  rechazada: { label: 'Rechazada', color: '#E54B4B' },
  expirada: { label: 'Expirada', color: '#999' },
};

const ACCOUNT_STATES: Record<string, { label: string; color: string }> = {
  activo: { label: 'Activo', color: '#2e7d32' },
  trial: { label: 'Trial', color: '#4B7BE5' },
  vencido: { label: 'Vencido', color: '#E54B4B' },
  suspendido: { label: 'Suspendido', color: '#E8A838' },
  cancelado: { label: 'Cancelado', color: '#999' },
};

// ─── Color maps ───
function activityColor(tipo: string): string {
  const colors: Record<string, string> = {
    nota: '#4B7BE5', llamada: '#6C5CE7', whatsapp_enviado: '#25D366',
    whatsapp_recibido: '#25D366', email_enviado: '#1565c0', email_recibido: '#1565c0',
    demo_agendada: '#E8A838', demo_realizada: '#F39C12',
    cotizacion_creada: '#2AB5A0', cotizacion_enviada: '#2AB5A0',
    cotizacion_vista: '#6C5CE7', cotizacion_aceptada: '#2e7d32',
    pago_recibido: '#2e7d32', stage_change: '#E8A838',
    lead_created: '#4B7BE5', page_visit: '#999', sistema: '#ccc',
  };
  return colors[tipo] || '#ccc';
}

function activityLabel(tipo: string): string {
  const labels: Record<string, string> = {
    nota: 'Nota', llamada: 'Llamada', whatsapp_enviado: 'WhatsApp enviado',
    whatsapp_recibido: 'WhatsApp recibido', email_enviado: 'Email enviado',
    email_recibido: 'Email recibido', demo_agendada: 'Demo agendada',
    demo_realizada: 'Demo realizada', cotizacion_creada: 'Cotizacion creada',
    cotizacion_enviada: 'Cotizacion enviada', cotizacion_vista: 'Cotizacion vista',
    cotizacion_aceptada: 'Cotizacion aceptada', pago_recibido: 'Pago recibido',
    stage_change: 'Cambio de etapa', lead_created: 'Lead creado',
    page_visit: 'Visita', sistema: 'Sistema',
  };
  return labels[tipo] || tipo;
}

function activityIcon(tipo: string): string {
  const icons: Record<string, string> = {
    nota: '\u{1F4DD}', llamada: '\u{1F4DE}', whatsapp_enviado: '\u{1F4F1}',
    whatsapp_recibido: '\u{1F4F1}', email_enviado: '\u{2709}\u{FE0F}',
    email_recibido: '\u{1F4E9}', demo_agendada: '\u{1F4C5}',
    demo_realizada: '\u{2705}', cotizacion_creada: '\u{1F4C4}',
    cotizacion_enviada: '\u{1F4E4}', cotizacion_vista: '\u{1F440}',
    cotizacion_aceptada: '\u{1F389}', pago_recibido: '\u{1F4B0}',
    stage_change: '\u{1F504}', lead_created: '\u{2728}',
    page_visit: '\u{1F310}', sistema: '\u{2699}\u{FE0F}',
  };
  return icons[tipo] || '\u{25CF}';
}

// ─── Helpers ───
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

const fmtDate = (d: string | null) => {
  if (!d) return '\u2014';
  const date = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  if (isNaN(date.getTime())) return '\u2014';
  return `${date.getDate()}/${date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}/${date.getFullYear()}`;
};

const fmtDateTime = (d: string) => {
  const date = new Date(d);
  if (isNaN(date.getTime())) return '\u2014';
  const day = `${date.getDate()}/${date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}`;
  const time = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  return `${day} \u00B7 ${time}`;
};

const daysSince = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const avatarColor = (name: string): string => {
  const colors = ['#4B7BE5', '#6C5CE7', '#E8A838', '#2AB5A0', '#F39C12', '#E54B4B', '#1565c0', '#25D366'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

function matchesFilter(tipo: string, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'email') return tipo.startsWith('email');
  if (filter === 'whatsapp') return tipo.startsWith('whatsapp');
  if (filter === 'demo') return tipo.startsWith('demo');
  if (filter === 'cotizacion') return tipo.startsWith('cotizacion');
  if (filter === 'pago') return tipo === 'pago_recibido';
  if (filter === 'sistema') return tipo === 'sistema' || tipo === 'stage_change' || tipo === 'lead_created' || tipo === 'page_visit';
  return tipo === filter;
}

// ─── Props ───
interface Props {
  contactId: string;
  onClose: () => void;
}

// ─── Main Component ───
export default function ContactProfile({ contactId, onClose }: Props) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<'properties' | 'timeline'>('timeline');

  // Editable fields
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', whatsapp: '', telefono: '',
    puesto: '', lifecycle_stage: '', tipo: '', plan_interes: '',
    lead_score: 0, next_followup: '', fuente: '', tags: '',
  });
  const [formDirty, setFormDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Collapsible sections
  const [sections, setSections] = useState({
    contact: true, company: true, deals: true, quotes: true, metrics: true,
  });

  // Activity form
  const [activityType, setActivityType] = useState('nota');
  const [activityText, setActivityText] = useState('');
  const [activitySubmitting, setActivitySubmitting] = useState(false);

  // Call-specific fields
  const [callDuration, setCallDuration] = useState('');
  const [callTranscript, setCallTranscript] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  // Activity filter
  const [activityFilter, setActivityFilter] = useState('all');

  // Expanded timeline items (for call summaries)
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());

  const sidebarRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Check mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load contact
  const loadContact = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setContact(data);
      setForm({
        nombre: data.nombre || '',
        apellido: data.apellido || '',
        email: data.email || '',
        whatsapp: data.whatsapp || '',
        telefono: data.telefono || '',
        puesto: data.puesto || '',
        lifecycle_stage: data.lifecycle_stage || '',
        tipo: data.tipo || '',
        plan_interes: data.plan_interes || '',
        lead_score: data.lead_score || 0,
        next_followup: data.next_followup || '',
        fuente: data.fuente || '',
        tags: '',
      });
      setFormDirty(false);
    } catch (e) {
      console.error('Error loading contact:', e);
    }
    setLoading(false);
  };

  useEffect(() => { loadContact(); }, [contactId]);

  // Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const updateForm = (field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setFormDirty(true);
  };

  const saveContact = async () => {
    if (!contact) return;
    setSaving(true);
    try {
      await fetch('/api/crm/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: contact.id,
          nombre: form.nombre,
          apellido: form.apellido || null,
          email: form.email || null,
          whatsapp: form.whatsapp || null,
          telefono: form.telefono || null,
          puesto: form.puesto || null,
          lifecycle_stage: form.lifecycle_stage,
          tipo: form.tipo,
          plan_interes: form.plan_interes || null,
          lead_score: form.lead_score,
          next_followup: form.next_followup || null,
          fuente: form.fuente || null,
        }),
      });
      setFormDirty(false);
      await loadContact();
    } catch (e) {
      console.error('Error saving contact:', e);
    }
    setSaving(false);
  };

  const addActivity = async () => {
    if (!contact || !activityText.trim()) return;
    setActivitySubmitting(true);
    try {
      const metadata: any = {};
      if (activityType === 'llamada') {
        if (callDuration) metadata.duration_minutes = parseInt(callDuration);
        if (callTranscript) metadata.transcript = callTranscript;
      }
      await fetch('/api/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contact.id,
          company_id: contact.company_id,
          tipo: activityType,
          titulo: activityLabel(activityType),
          descripcion: activityText.trim(),
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        }),
      });
      setActivityText('');
      setCallDuration('');
      setCallTranscript('');
      setShowTranscript(false);
      await loadContact();
    } catch (e) {
      console.error('Error adding activity:', e);
    }
    setActivitySubmitting(false);
  };

  const generateSummary = async () => {
    if (!callTranscript.trim()) return;
    setSummarizing(true);
    try {
      const res = await fetch('/api/calls/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: callTranscript }),
      });
      const data = await res.json();
      if (data.summary) {
        setActivityText(data.summary);
      }
    } catch (e) {
      console.error('Error generating summary:', e);
    }
    setSummarizing(false);
  };

  const toggleActivity = (id: string) => {
    setExpandedActivities(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Loading state ───
  if (loading || !contact) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300, background: '#f5f6f8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid #e0e0e0', borderTopColor: '#4B7BE5',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <span style={{ color: '#999', fontSize: '0.875rem' }}>Cargando contacto...</span>
        </div>
      </div>
    );
  }

  const stageInfo = LIFECYCLE_STAGES.find(s => s.id === contact.lifecycle_stage);
  const fullName = contact.nombre + (contact.apellido ? ` ${contact.apellido}` : '');
  const initials = (contact.nombre.charAt(0) + (contact.apellido?.charAt(0) || '')).toUpperCase();
  const filteredActivities = contact.activities.filter(a => matchesFilter(a.tipo, activityFilter));
  const totalRevenue = contact.deals
    .filter(d => d.stage === 'cerrada_ganada')
    .reduce((sum, d) => sum + d.valor_total, 0);

  // ─── Render ───
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: '#f5f6f8',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>

      {/* ════════════════════════════════════════ */}
      {/* HEADER                                  */}
      {/* ════════════════════════════════════════ */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #e8e8ec',
        padding: isMobile ? '12px 16px' : '14px 28px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, flexShrink: 0,
      }}>
        {/* Left: Avatar + info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, minWidth: 0, flex: 1 }}>
          <div style={{
            width: isMobile ? 40 : 48, height: isMobile ? 40 : 48,
            borderRadius: '50%', background: avatarColor(fullName),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: isMobile ? '0.875rem' : '1rem',
            flexShrink: 0, letterSpacing: '0.02em',
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{
                fontSize: isMobile ? '1rem' : '1.25rem',
                fontWeight: 800, color: '#0f172a', margin: 0,
                fontFamily: "'Sora', sans-serif",
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxWidth: isMobile ? 180 : 'none',
              }}>
                {fullName}
              </h1>
              {!isMobile && contact.companies && (
                <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 500 }}>
                  {contact.companies.nombre}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {contact.puesto && (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{contact.puesto}</span>
              )}
              {contact.puesto && <span style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>\u00B7</span>}
              {/* Lifecycle badge */}
              <span style={{
                fontSize: '0.6875rem', fontWeight: 700,
                padding: '2px 10px', borderRadius: 20,
                background: (stageInfo?.color || '#ccc') + '14',
                color: stageInfo?.color || '#ccc',
                border: `1px solid ${(stageInfo?.color || '#ccc')}30`,
              }}>
                {stageInfo?.label || contact.lifecycle_stage}
              </span>
              {/* Tipo badge */}
              <span style={{
                fontSize: '0.6875rem', fontWeight: 600,
                padding: '2px 10px', borderRadius: 20,
                background: '#f1f5f9', color: '#64748b',
              }}>
                {contact.tipo}
              </span>
              {/* Lead score */}
              {contact.lead_score > 0 && (
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 700,
                  padding: '2px 10px', borderRadius: 20,
                  background: contact.lead_score >= 70 ? '#dcfce7' : contact.lead_score >= 40 ? '#fef3c7' : '#f1f5f9',
                  color: contact.lead_score >= 70 ? '#16a34a' : contact.lead_score >= 40 ? '#d97706' : '#94a3b8',
                }}>
                  {contact.lead_score} pts
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Action buttons */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {!isMobile && (
            <>
              {contact.whatsapp && (
                <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: '0.8125rem', fontWeight: 600, padding: '8px 14px',
                    borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#dcfce7', color: '#16a34a', textDecoration: 'none',
                    fontFamily: 'inherit',
                  }}>
                  <span style={{ fontSize: '0.875rem' }}>{'\u{1F4F1}'}</span> WhatsApp
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: '0.8125rem', fontWeight: 600, padding: '8px 14px',
                    borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#dbeafe', color: '#2563eb', textDecoration: 'none',
                    fontFamily: 'inherit',
                  }}>
                  <span style={{ fontSize: '0.875rem' }}>{'\u{2709}\u{FE0F}'}</span> Email
                </a>
              )}
              {contact.telefono && (
                <a href={`tel:${contact.telefono}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: '0.8125rem', fontWeight: 600, padding: '8px 14px',
                    borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#ede9fe', color: '#7c3aed', textDecoration: 'none',
                    fontFamily: 'inherit',
                  }}>
                  <span style={{ fontSize: '0.875rem' }}>{'\u{1F4DE}'}</span> Llamar
                </a>
              )}
            </>
          )}
          {/* Close button */}
          <button onClick={onClose} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 8,
            border: '1px solid #e2e8f0', background: '#fff',
            cursor: 'pointer', fontSize: '1.125rem', color: '#94a3b8',
            fontFamily: 'inherit', flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            \u2715
          </button>
        </div>
      </header>

      {/* Mobile action buttons */}
      {isMobile && (
        <div style={{
          display: 'flex', gap: 8, padding: '10px 16px',
          background: '#fff', borderBottom: '1px solid #e8e8ec',
          overflowX: 'auto',
        }}>
          {contact.whatsapp && (
            <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: '0.75rem', fontWeight: 600, padding: '6px 12px',
                borderRadius: 6, background: '#dcfce7', color: '#16a34a',
                textDecoration: 'none', whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}>
              {'\u{1F4F1}'} WhatsApp
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: '0.75rem', fontWeight: 600, padding: '6px 12px',
                borderRadius: 6, background: '#dbeafe', color: '#2563eb',
                textDecoration: 'none', whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}>
              {'\u{2709}\u{FE0F}'} Email
            </a>
          )}
          {contact.telefono && (
            <a href={`tel:${contact.telefono}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: '0.75rem', fontWeight: 600, padding: '6px 12px',
                borderRadius: 6, background: '#ede9fe', color: '#7c3aed',
                textDecoration: 'none', whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}>
              {'\u{1F4DE}'} Llamar
            </a>
          )}
        </div>
      )}

      {/* Mobile tab selector */}
      {isMobile && (
        <div style={{
          display: 'flex', background: '#fff', borderBottom: '1px solid #e8e8ec',
        }}>
          <button
            onClick={() => setMobileTab('timeline')}
            style={{
              flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
              fontSize: '0.8125rem', fontWeight: 600,
              color: mobileTab === 'timeline' ? '#0f172a' : '#94a3b8',
              background: 'none',
              borderBottom: mobileTab === 'timeline' ? '2px solid #0f172a' : '2px solid transparent',
              fontFamily: 'inherit',
            }}>
            Timeline
          </button>
          <button
            onClick={() => setMobileTab('properties')}
            style={{
              flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
              fontSize: '0.8125rem', fontWeight: 600,
              color: mobileTab === 'properties' ? '#0f172a' : '#94a3b8',
              background: 'none',
              borderBottom: mobileTab === 'properties' ? '2px solid #0f172a' : '2px solid transparent',
              fontFamily: 'inherit',
            }}>
            Propiedades
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════ */}
      {/* BODY                                    */}
      {/* ════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ──────────────────────────── */}
        {/* LEFT SIDEBAR (Properties)   */}
        {/* ──────────────────────────── */}
        {(!isMobile || mobileTab === 'properties') && (
          <div ref={sidebarRef} style={{
            width: isMobile ? '100%' : '30%',
            minWidth: isMobile ? undefined : 320,
            maxWidth: isMobile ? undefined : 420,
            overflowY: 'auto', background: '#fff',
            borderRight: isMobile ? 'none' : '1px solid #e8e8ec',
            padding: isMobile ? '16px' : '20px',
          }}>

            {/* ── Contact Info Section ── */}
            <CollapsibleSection
              title="Informacion de contacto"
              open={sections.contact}
              onToggle={() => toggleSection('contact')}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <FormField label="Nombre">
                  <input
                    value={form.nombre}
                    onChange={e => updateForm('nombre', e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
                <FormField label="Apellido">
                  <input
                    value={form.apellido}
                    onChange={e => updateForm('apellido', e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
              </div>
              <FormField label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={e => updateForm('email', e.target.value)}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="WhatsApp">
                <input
                  value={form.whatsapp}
                  onChange={e => updateForm('whatsapp', e.target.value)}
                  placeholder="+52 ..."
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Telefono">
                <input
                  value={form.telefono}
                  onChange={e => updateForm('telefono', e.target.value)}
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Puesto">
                <input
                  value={form.puesto}
                  onChange={e => updateForm('puesto', e.target.value)}
                  placeholder="Ej: Director, Gerente..."
                  style={inputStyle}
                />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <FormField label="Lifecycle stage">
                  <select
                    value={form.lifecycle_stage}
                    onChange={e => updateForm('lifecycle_stage', e.target.value)}
                    style={inputStyle}
                  >
                    {LIFECYCLE_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Tipo">
                  <select
                    value={form.tipo}
                    onChange={e => updateForm('tipo', e.target.value)}
                    style={inputStyle}
                  >
                    {TIPO_OPTIONS.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <FormField label="Plan de interes">
                <select
                  value={form.plan_interes}
                  onChange={e => updateForm('plan_interes', e.target.value)}
                  style={inputStyle}
                >
                  {PLAN_OPTIONS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <FormField label="Lead Score">
                  <input
                    type="number"
                    min={0} max={100}
                    value={form.lead_score}
                    onChange={e => updateForm('lead_score', parseInt(e.target.value) || 0)}
                    style={inputStyle}
                  />
                </FormField>
                <FormField label="Proximo seguimiento">
                  <input
                    type="date"
                    value={form.next_followup}
                    onChange={e => updateForm('next_followup', e.target.value)}
                    style={inputStyle}
                  />
                </FormField>
              </div>
              <FormField label="Fuente">
                <input
                  value={form.fuente}
                  onChange={e => updateForm('fuente', e.target.value)}
                  placeholder="organico, tiktok, referido..."
                  style={inputStyle}
                />
              </FormField>
              <FormField label="Tags">
                <input
                  value={form.tags}
                  onChange={e => updateForm('tags', e.target.value)}
                  placeholder="restaurante, cdmx, urgente..."
                  style={inputStyle}
                />
              </FormField>
              {form.tags && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {form.tags.split(',').filter(t => t.trim()).map((tag, i) => (
                    <span key={i} style={{
                      fontSize: '0.6875rem', fontWeight: 600,
                      padding: '2px 8px', borderRadius: 4,
                      background: '#f1f5f9', color: '#475569',
                    }}>
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}

              {/* Save button */}
              {formDirty && (
                <button
                  onClick={saveContact}
                  disabled={saving}
                  style={{
                    width: '100%', padding: '10px 16px', borderRadius: 8,
                    border: 'none', cursor: saving ? 'default' : 'pointer',
                    background: '#0f172a', color: '#fff',
                    fontSize: '0.8125rem', fontWeight: 700,
                    fontFamily: 'inherit', marginTop: 4,
                    opacity: saving ? 0.6 : 1,
                    transition: 'opacity 0.15s ease',
                  }}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              )}
            </CollapsibleSection>

            {/* ── Company Section ── */}
            {contact.companies && (
              <CollapsibleSection
                title="Empresa"
                open={sections.company}
                onToggle={() => toggleSection('company')}
              >
                <div style={{
                  fontSize: '0.9375rem', fontWeight: 700, color: '#0f172a',
                  marginBottom: 12, fontFamily: "'Sora', sans-serif",
                }}>
                  {contact.companies.nombre}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contact.companies.plan && (
                    <PropertyRow label="Plan">
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 700,
                        padding: '2px 10px', borderRadius: 4,
                        background: '#dbeafe', color: '#2563eb',
                        textTransform: 'capitalize' as const,
                      }}>
                        {contact.companies.plan}
                      </span>
                    </PropertyRow>
                  )}
                  <PropertyRow label="Sucursales">{contact.companies.sucursales}</PropertyRow>
                  <PropertyRow label="MRR">
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                      {contact.companies.mrr > 0 ? fmt(contact.companies.mrr) : '\u2014'}
                    </span>
                  </PropertyRow>
                  <PropertyRow label="ARR">
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                      {contact.companies.arr > 0 ? fmt(contact.companies.arr) : '\u2014'}
                    </span>
                  </PropertyRow>
                  <PropertyRow label="Estado">
                    {(() => {
                      const s = ACCOUNT_STATES[contact.companies.estado_cuenta];
                      return (
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 700,
                          padding: '2px 10px', borderRadius: 4,
                          background: (s?.color || '#ccc') + '18',
                          color: s?.color || '#ccc',
                        }}>
                          {s?.label || contact.companies.estado_cuenta}
                        </span>
                      );
                    })()}
                  </PropertyRow>
                  <PropertyRow label="Renovacion">{fmtDate(contact.companies.fecha_renovacion)}</PropertyRow>
                  {contact.companies.rfc && <PropertyRow label="RFC">{contact.companies.rfc}</PropertyRow>}
                  {contact.companies.giro && <PropertyRow label="Giro">{contact.companies.giro}</PropertyRow>}
                  {contact.companies.razon_social && <PropertyRow label="Razon social">{contact.companies.razon_social}</PropertyRow>}
                </div>
              </CollapsibleSection>
            )}

            {/* ── Deals Section ── */}
            {contact.deals.length > 0 && (
              <CollapsibleSection
                title={`Deals (${contact.deals.length})`}
                open={sections.deals}
                onToggle={() => toggleSection('deals')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contact.deals.map(d => {
                    const ds = DEAL_STAGES[d.stage];
                    return (
                      <div key={d.id} style={{
                        background: '#f8fafc', borderRadius: 8, padding: '12px 14px',
                        border: '1px solid #f1f5f9',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                              {d.nombre}
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '0.6875rem', fontWeight: 700,
                                padding: '2px 8px', borderRadius: 4,
                                background: (ds?.color || '#ccc') + '18',
                                color: ds?.color || '#ccc',
                              }}>
                                {ds?.label || d.stage}
                              </span>
                              {d.plan && (
                                <span style={{
                                  fontSize: '0.6875rem', color: '#94a3b8',
                                  textTransform: 'capitalize' as const,
                                }}>
                                  {d.plan}
                                </span>
                              )}
                              <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                                {d.probabilidad}%
                              </span>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '0.875rem', fontWeight: 800, color: '#0f172a',
                            fontFamily: "'Sora', sans-serif",
                          }}>
                            {fmt(d.valor_total)}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', marginTop: 8,
                        }}>
                          <span style={{ fontSize: '0.6875rem', color: '#cbd5e1' }}>
                            {fmtDate(d.created_at)}
                          </span>
                          <span style={{
                            fontSize: '0.6875rem', fontWeight: 600, color: '#4B7BE5',
                            cursor: 'pointer',
                          }}>
                            Ver deal \u2192
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>
            )}

            {/* ── Quotes Section ── */}
            {contact.quotes.length > 0 && (
              <CollapsibleSection
                title={`Cotizaciones (${contact.quotes.length})`}
                open={sections.quotes}
                onToggle={() => toggleSection('quotes')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contact.quotes.map(q => {
                    const qs = QUOTE_STATES[q.estado];
                    return (
                      <a key={q.id} href={`/cotizacion/${q.id}`} target="_blank" rel="noopener"
                        style={{
                          background: '#f8fafc', borderRadius: 8, padding: '12px 14px',
                          border: '1px solid #f1f5f9', textDecoration: 'none', display: 'block',
                          transition: 'border-color 0.15s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#f1f5f9'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>
                              {q.numero ? `COT-${q.numero}` : 'Cotizacion'}
                              {q.empresa ? ` \u00B7 ${q.empresa}` : ''}
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                              <span style={{
                                fontSize: '0.6875rem', fontWeight: 700,
                                padding: '2px 8px', borderRadius: 4,
                                background: (qs?.color || '#ccc') + '18',
                                color: qs?.color || '#ccc',
                              }}>
                                {qs?.label || q.estado}
                              </span>
                              <span style={{ fontSize: '0.6875rem', color: '#cbd5e1' }}>
                                {fmtDate(q.created_at)}
                              </span>
                            </div>
                          </div>
                          <div style={{
                            fontSize: '0.875rem', fontWeight: 800, color: '#0f172a',
                            fontFamily: "'Sora', sans-serif",
                          }}>
                            {fmt(q.total)}
                          </div>
                        </div>
                        <div style={{
                          fontSize: '0.6875rem', fontWeight: 600, color: '#4B7BE5',
                          marginTop: 8, textAlign: 'right' as const,
                        }}>
                          Ver cotizacion \u2192
                        </div>
                      </a>
                    );
                  })}
                </div>
              </CollapsibleSection>
            )}

            {/* ── Key Metrics ── */}
            <CollapsibleSection
              title="Metricas"
              open={sections.metrics}
              onToggle={() => toggleSection('metrics')}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <MetricCard
                  label="Revenue total"
                  value={totalRevenue > 0 ? fmt(totalRevenue) : '$0'}
                  color="#16a34a"
                />
                <MetricCard
                  label="Dias desde creacion"
                  value={String(daysSince(contact.created_at))}
                  color="#4B7BE5"
                />
                <MetricCard
                  label="Actividades"
                  value={String(contact.activities.length)}
                  color="#6C5CE7"
                />
                <MetricCard
                  label="Paginas visitadas"
                  value={String(contact.page_count || 0)}
                  color="#E8A838"
                />
              </div>
              {contact.total_time_on_site > 0 && (
                <div style={{
                  marginTop: 8, padding: '8px 12px', borderRadius: 6,
                  background: '#f8fafc', fontSize: '0.75rem', color: '#64748b',
                }}>
                  Tiempo en sitio:{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {contact.total_time_on_site >= 60
                      ? `${Math.floor(contact.total_time_on_site / 60)}m ${contact.total_time_on_site % 60}s`
                      : `${contact.total_time_on_site}s`}
                  </strong>
                </div>
              )}
              {contact.pages_visited && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
                    Paginas
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {contact.pages_visited.split(',').slice(0, 10).map((p, i) => (
                      <span key={i} style={{
                        fontSize: '0.625rem', padding: '2px 6px', borderRadius: 3,
                        background: '#f1f5f9', color: '#64748b',
                      }}>
                        {p.trim()}
                      </span>
                    ))}
                    {contact.pages_visited.split(',').length > 10 && (
                      <span style={{ fontSize: '0.625rem', color: '#94a3b8' }}>
                        +{contact.pages_visited.split(',').length - 10} mas
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CollapsibleSection>

          </div>
        )}

        {/* ──────────────────────────── */}
        {/* RIGHT: Activity Timeline    */}
        {/* ──────────────────────────── */}
        {(!isMobile || mobileTab === 'timeline') && (
          <div ref={timelineRef} style={{
            flex: 1, overflowY: 'auto',
            padding: isMobile ? '16px' : '20px 28px',
            background: '#f5f6f8',
          }}>

            {/* ── Add Activity Bar ── */}
            <div style={{
              background: '#fff', borderRadius: 12, padding: '16px 20px',
              marginBottom: 20, border: '1px solid #e8e8ec',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <select
                  value={activityType}
                  onChange={e => { setActivityType(e.target.value); setShowTranscript(false); }}
                  style={{
                    ...inputStyle, width: 'auto', marginBottom: 0,
                    fontWeight: 600, color: '#0f172a',
                  }}
                >
                  {ACTIVITY_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>

              <textarea
                value={activityText}
                onChange={e => setActivityText(e.target.value)}
                placeholder="Describe la actividad..."
                rows={3}
                style={{
                  ...inputStyle, marginBottom: 0, resize: 'vertical' as const,
                  minHeight: 72,
                }}
              />

              {/* Call-specific fields */}
              {activityType === 'llamada' && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <FormField label="Duracion (min)" inline>
                      <input
                        type="number"
                        value={callDuration}
                        onChange={e => setCallDuration(e.target.value)}
                        placeholder="30"
                        min={0}
                        style={{ ...inputStyle, width: 80, marginBottom: 0 }}
                      />
                    </FormField>
                    <button
                      onClick={() => setShowTranscript(!showTranscript)}
                      style={{
                        ...smallBtnStyle,
                        background: showTranscript ? '#ede9fe' : '#f1f5f9',
                        color: showTranscript ? '#7c3aed' : '#64748b',
                      }}>
                      {showTranscript ? 'Ocultar transcripcion' : 'Pegar transcripcion'}
                    </button>
                  </div>
                  {showTranscript && (
                    <div style={{ marginTop: 10 }}>
                      <textarea
                        value={callTranscript}
                        onChange={e => setCallTranscript(e.target.value)}
                        placeholder="Pega aqui la transcripcion de la llamada..."
                        rows={5}
                        style={{ ...inputStyle, marginBottom: 8, resize: 'vertical' as const }}
                      />
                      <button
                        onClick={generateSummary}
                        disabled={summarizing || !callTranscript.trim()}
                        style={{
                          ...smallBtnStyle,
                          background: '#0f172a', color: '#fff',
                          opacity: summarizing || !callTranscript.trim() ? 0.5 : 1,
                        }}>
                        {summarizing ? 'Generando...' : '\u{2728} Generar minuta con IA'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  onClick={addActivity}
                  disabled={activitySubmitting || !activityText.trim()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: '0.8125rem', fontWeight: 700, padding: '10px 20px',
                    borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: '#0f172a', color: '#fff',
                    fontFamily: 'inherit',
                    opacity: activitySubmitting || !activityText.trim() ? 0.5 : 1,
                    transition: 'opacity 0.15s ease',
                  }}>
                  {activitySubmitting ? 'Guardando...' : 'Registrar actividad'}
                </button>
              </div>
            </div>

            {/* ── Activity Filters ── */}
            <div style={{
              display: 'flex', gap: 6, marginBottom: 16,
              overflowX: 'auto', paddingBottom: 4,
            }}>
              {ACTIVITY_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setActivityFilter(f.id)}
                  style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    padding: '6px 14px', borderRadius: 20,
                    border: '1px solid',
                    borderColor: activityFilter === f.id ? '#0f172a' : '#e2e8f0',
                    background: activityFilter === f.id ? '#0f172a' : '#fff',
                    color: activityFilter === f.id ? '#fff' : '#64748b',
                    cursor: 'pointer', whiteSpace: 'nowrap' as const,
                    fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                  }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* ── Timeline ── */}
            {filteredActivities.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '48px 20px',
                color: '#94a3b8', fontSize: '0.875rem',
              }}>
                {activityFilter === 'all'
                  ? 'Sin actividades registradas'
                  : 'No hay actividades de este tipo'}
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                {/* Connecting line */}
                <div style={{
                  position: 'absolute', left: 15, top: 24, bottom: 24,
                  width: 2, background: '#e8e8ec', borderRadius: 1,
                }} />

                {filteredActivities.map((a, i) => {
                  const color = activityColor(a.tipo);
                  const icon = activityIcon(a.tipo);
                  const isExpanded = expandedActivities.has(a.id);
                  const hasSummary = a.metadata?.summary || a.metadata?.puntos_clave;
                  const isStageChange = a.tipo === 'stage_change';
                  const isEmail = a.tipo === 'email_enviado' || a.tipo === 'email_recibido';

                  return (
                    <div key={a.id} style={{
                      display: 'flex', gap: 16, marginBottom: i < filteredActivities.length - 1 ? 4 : 0,
                      position: 'relative',
                    }}>
                      {/* Dot */}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: color + '14',
                        border: `2px solid ${color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8125rem', flexShrink: 0, zIndex: 1,
                        marginTop: 16,
                      }}>
                        {icon}
                      </div>

                      {/* Card */}
                      <div style={{
                        flex: 1, minWidth: 0, background: '#fff',
                        borderRadius: 10, padding: '14px 18px',
                        borderLeft: `3px solid ${color}`,
                        border: `1px solid #e8e8ec`,
                        borderLeftWidth: 3, borderLeftColor: color,
                        marginBottom: 8,
                      }}>
                        {/* Header row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a',
                              }}>
                                {a.titulo || activityLabel(a.tipo)}
                              </span>
                              {a.automatico && (
                                <span style={{
                                  fontSize: '0.5625rem', fontWeight: 700,
                                  padding: '1px 6px', borderRadius: 3,
                                  background: '#f1f5f9', color: '#94a3b8',
                                  textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                                }}>
                                  auto
                                </span>
                              )}
                            </div>
                          </div>
                          <span style={{ fontSize: '0.6875rem', color: '#94a3b8', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
                            {fmtDateTime(a.created_at)}
                          </span>
                        </div>

                        {/* Description */}
                        {a.descripcion && (
                          <div style={{
                            fontSize: '0.8125rem', color: '#475569',
                            marginTop: 8, lineHeight: 1.6,
                            whiteSpace: 'pre-wrap' as const,
                          }}>
                            {a.descripcion}
                          </div>
                        )}

                        {/* Stage change */}
                        {isStageChange && a.metadata && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            marginTop: 10,
                          }}>
                            {a.metadata.old_stage && (
                              <span style={{
                                fontSize: '0.6875rem', fontWeight: 700,
                                padding: '2px 8px', borderRadius: 4,
                                background: '#fee2e2', color: '#dc2626',
                              }}>
                                {LIFECYCLE_STAGES.find(s => s.id === a.metadata.old_stage)?.label || a.metadata.old_stage}
                              </span>
                            )}
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>\u2192</span>
                            {a.metadata.new_stage && (
                              <span style={{
                                fontSize: '0.6875rem', fontWeight: 700,
                                padding: '2px 8px', borderRadius: 4,
                                background: '#dcfce7', color: '#16a34a',
                              }}>
                                {LIFECYCLE_STAGES.find(s => s.id === a.metadata.new_stage)?.label || a.metadata.new_stage}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Email details */}
                        {isEmail && a.metadata && (
                          <div style={{
                            marginTop: 10, padding: '10px 12px', borderRadius: 6,
                            background: '#f8fafc', fontSize: '0.75rem',
                          }}>
                            {a.metadata.subject && (
                              <div style={{ marginBottom: 4 }}>
                                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Asunto: </span>
                                <span style={{ color: '#0f172a', fontWeight: 600 }}>{a.metadata.subject}</span>
                              </div>
                            )}
                            {a.metadata.to && (
                              <div style={{ marginBottom: 4 }}>
                                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Para: </span>
                                <span style={{ color: '#475569' }}>{a.metadata.to}</span>
                              </div>
                            )}
                            {a.metadata.status && (
                              <div>
                                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Estado: </span>
                                <span style={{
                                  fontWeight: 700,
                                  color: a.metadata.status === 'clicked' ? '#16a34a'
                                    : a.metadata.status === 'opened' ? '#2563eb' : '#94a3b8',
                                }}>
                                  {a.metadata.status === 'sent' ? 'Enviado'
                                    : a.metadata.status === 'opened' ? 'Abierto'
                                    : a.metadata.status === 'clicked' ? 'Click' : a.metadata.status}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Call duration */}
                        {a.tipo === 'llamada' && a.metadata?.duration_minutes && (
                          <div style={{
                            fontSize: '0.75rem', color: '#64748b', marginTop: 6,
                          }}>
                            Duracion: {a.metadata.duration_minutes} min
                          </div>
                        )}

                        {/* Call summary (expandable) */}
                        {a.tipo === 'llamada' && hasSummary && (
                          <div style={{ marginTop: 10 }}>
                            <button
                              onClick={() => toggleActivity(a.id)}
                              style={{
                                ...smallBtnStyle,
                                background: isExpanded ? '#ede9fe' : '#f1f5f9',
                                color: isExpanded ? '#7c3aed' : '#64748b',
                              }}>
                              {isExpanded ? '\u25B2 Ocultar minuta' : '\u25BC Ver minuta'}
                            </button>
                            {isExpanded && (
                              <div style={{
                                marginTop: 10, padding: '14px 16px', borderRadius: 8,
                                background: '#faf5ff', border: '1px solid #ede9fe',
                              }}>
                                {a.metadata.summary && (
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={{
                                      fontSize: '0.6875rem', fontWeight: 700,
                                      color: '#7c3aed', textTransform: 'uppercase' as const,
                                      letterSpacing: '0.04em', marginBottom: 4,
                                    }}>
                                      Resumen
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6 }}>
                                      {a.metadata.summary}
                                    </div>
                                  </div>
                                )}
                                {a.metadata.puntos_clave && Array.isArray(a.metadata.puntos_clave) && (
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={{
                                      fontSize: '0.6875rem', fontWeight: 700,
                                      color: '#7c3aed', textTransform: 'uppercase' as const,
                                      letterSpacing: '0.04em', marginBottom: 4,
                                    }}>
                                      Puntos clave
                                    </div>
                                    <ul style={{
                                      margin: 0, paddingLeft: 16,
                                      fontSize: '0.8125rem', color: '#475569', lineHeight: 1.8,
                                    }}>
                                      {a.metadata.puntos_clave.map((p: string, idx: number) => (
                                        <li key={idx}>{p}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {a.metadata.proximos_pasos && (
                                  <div style={{ marginBottom: 12 }}>
                                    <div style={{
                                      fontSize: '0.6875rem', fontWeight: 700,
                                      color: '#7c3aed', textTransform: 'uppercase' as const,
                                      letterSpacing: '0.04em', marginBottom: 4,
                                    }}>
                                      Proximos pasos
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6 }}>
                                      {typeof a.metadata.proximos_pasos === 'string'
                                        ? a.metadata.proximos_pasos
                                        : Array.isArray(a.metadata.proximos_pasos)
                                          ? a.metadata.proximos_pasos.join(', ')
                                          : ''}
                                    </div>
                                  </div>
                                )}
                                {a.metadata.sentimiento && (
                                  <div>
                                    <span style={{
                                      fontSize: '0.6875rem', fontWeight: 700,
                                      padding: '3px 10px', borderRadius: 4,
                                      background: a.metadata.sentimiento === 'positivo' ? '#dcfce7'
                                        : a.metadata.sentimiento === 'negativo' ? '#fee2e2' : '#f1f5f9',
                                      color: a.metadata.sentimiento === 'positivo' ? '#16a34a'
                                        : a.metadata.sentimiento === 'negativo' ? '#dc2626' : '#64748b',
                                    }}>
                                      Sentimiento: {a.metadata.sentimiento}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  fontSize: '0.8125rem', border: '1px solid #e2e8f0',
  borderRadius: 6, outline: 'none', fontFamily: 'inherit',
  marginBottom: 0, boxSizing: 'border-box' as const,
  color: '#0f172a', background: '#fff',
  transition: 'border-color 0.15s ease',
};

const smallBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: '0.75rem', fontWeight: 600,
  padding: '6px 12px', borderRadius: 6,
  border: 'none', cursor: 'pointer',
  fontFamily: 'inherit',
};

function CollapsibleSection({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '10px 0', border: 'none', background: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
        <span style={{
          fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8',
          textTransform: 'uppercase' as const, letterSpacing: '0.06em',
        }}>
          {title}
        </span>
        <span style={{
          fontSize: '0.75rem', color: '#cbd5e1',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.2s ease',
          display: 'inline-block',
        }}>
          \u25BC
        </span>
      </button>
      {open && (
        <div style={{
          borderTop: '1px solid #f1f5f9', paddingTop: 12,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

function FormField({ label, children, inline }: {
  label: string; children: React.ReactNode; inline?: boolean;
}) {
  if (inline) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{
          fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8',
          textTransform: 'uppercase' as const, letterSpacing: '0.04em',
          whiteSpace: 'nowrap' as const,
        }}>
          {label}
        </label>
        {children}
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{
        display: 'block', fontSize: '0.6875rem', fontWeight: 600,
        color: '#94a3b8', textTransform: 'uppercase' as const,
        letterSpacing: '0.04em', marginBottom: 4,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', borderBottom: '1px solid #f8fafc',
    }}>
      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: '0.8125rem', color: '#334155', fontWeight: 600 }}>{children}</span>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 8,
      background: color + '08', border: `1px solid ${color}18`,
      textAlign: 'center' as const,
    }}>
      <div style={{
        fontSize: '1.125rem', fontWeight: 800, color,
        fontFamily: "'Sora', sans-serif",
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '0.625rem', fontWeight: 600, color: '#94a3b8',
        textTransform: 'uppercase' as const, letterSpacing: '0.04em',
        marginTop: 2,
      }}>
        {label}
      </div>
    </div>
  );
}
