import { useState, useEffect } from 'react';

// ─── Types ───
interface Company {
  id: string; nombre: string; plan: string | null; sucursales: number;
  estado_cuenta: string; mrr: number; arr: number;
  fecha_inicio: string | null; fecha_renovacion: string | null;
}

interface Contact {
  id: string; created_at: string; nombre: string; apellido: string | null;
  email: string | null; whatsapp: string | null; tipo: string;
  lifecycle_stage: string; lead_score: number; total_time_on_site: number;
  pages_visited: string | null; page_count: number; giro: string | null;
  sucursales_interes: number | null; plan_interes: string | null;
  next_followup: string | null; last_contact_at: string | null;
  company_id: string | null; puesto: string | null; fuente: string | null;
  companies: Company | null;
  deals: Deal[];
  activities: Activity[];
  quotes: Quote[];
}

interface Deal {
  id: string; created_at: string; nombre: string; stage: string;
  plan: string | null; valor_mensual: number; valor_total: number;
  probabilidad: number; fecha_cierre_esperada: string | null;
  closed_at: string | null;
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
  { id: 'suscriptor', label: 'Suscriptor', color: '#ccc' },
  { id: 'lead', label: 'Lead', color: '#6C5CE7' },
  { id: 'lead_calificado', label: 'MQL', color: '#4B7BE5' },
  { id: 'oportunidad', label: 'Oportunidad', color: '#E8A838' },
  { id: 'cliente', label: 'Cliente', color: '#2AB5A0' },
  { id: 'evangelista', label: 'Evangelista', color: '#F39C12' },
  { id: 'churned', label: 'Churned', color: '#999' },
];

const ACTIVITY_TYPES = [
  { id: 'nota', label: 'Nota' },
  { id: 'llamada', label: 'Llamada' },
  { id: 'whatsapp_enviado', label: 'WhatsApp enviado' },
  { id: 'email_enviado', label: 'Email enviado' },
  { id: 'demo_agendada', label: 'Demo agendada' },
  { id: 'demo_realizada', label: 'Demo realizada' },
];

const DEAL_STAGES: Record<string, { label: string; color: string }> = {
  calificacion: { label: 'Calificación', color: '#6C5CE7' },
  demo_agendada: { label: 'Demo agendada', color: '#4B7BE5' },
  demo_realizada: { label: 'Demo realizada', color: '#E8A838' },
  cotizacion_enviada: { label: 'Cotización enviada', color: '#F39C12' },
  negociacion: { label: 'Negociación', color: '#2AB5A0' },
  cerrada_ganada: { label: 'Cerrada ganada', color: '#2e7d32' },
  cerrada_perdida: { label: 'Cerrada perdida', color: '#999' },
};

const QUOTE_STATES: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: '#999' },
  enviada: { label: 'Enviada', color: '#4B7BE5' },
  vista: { label: 'Vista', color: '#E8A838' },
  aceptada: { label: 'Aceptada', color: '#2AB5A0' },
  pagada: { label: 'Pagada', color: '#2e7d32' },
  rechazada: { label: 'Rechazada', color: '#E54B4B' },
  expirada: { label: 'Expirada', color: '#999' },
};

// ─── Helpers ───
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const date = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  if (isNaN(date.getTime())) return '—';
  return `${date.getDate()}/${date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}/${date.getFullYear()}`;
};

function activityColor(tipo: string): string {
  const colors: Record<string, string> = {
    nota: '#4B7BE5', llamada: '#6C5CE7', whatsapp_enviado: '#25D366',
    email_enviado: '#1565c0', demo_agendada: '#E8A838', demo_realizada: '#F39C12',
    cotizacion_creada: '#2AB5A0', cotizacion_enviada: '#2AB5A0', cotizacion_vista: '#6C5CE7',
    pago_recibido: '#2e7d32', stage_change: '#E8A838', lead_created: '#4B7BE5', sistema: '#ccc',
  };
  return colors[tipo] || '#ccc';
}

function activityLabel(tipo: string): string {
  const labels: Record<string, string> = {
    nota: 'Nota', llamada: 'Llamada', whatsapp_enviado: 'WhatsApp enviado',
    email_enviado: 'Email enviado', demo_agendada: 'Demo agendada', demo_realizada: 'Demo realizada',
    cotizacion_creada: 'Cotización creada', cotizacion_enviada: 'Cotización enviada',
    cotizacion_vista: 'Cotización vista', pago_recibido: 'Pago recibido',
    stage_change: 'Cambio de etapa', lead_created: 'Lead creado', sistema: 'Sistema',
  };
  return labels[tipo] || tipo;
}

// ─── Shared styles ───
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: '0.8125rem', border: '1px solid #e0e0e0', borderRadius: 8, outline: 'none', fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' as const };

// ─── Props ───
interface Props {
  contactId: string;
  onClose: () => void;
}

// ─── Main Component ───
export default function ContactProfile({ contactId, onClose }: Props) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable fields
  const [editLifecycle, setEditLifecycle] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editFollowup, setEditFollowup] = useState('');
  const [editPuesto, setEditPuesto] = useState('');
  const [saving, setSaving] = useState(false);

  // Activity form
  const [activityType, setActivityType] = useState('nota');
  const [activityText, setActivityText] = useState('');

  const loadContact = async () => {
    setLoading(true);
    const res = await fetch(`/api/crm/contacts/${contactId}`);
    const data = await res.json();
    setContact(data);
    setEditLifecycle(data.lifecycle_stage || '');
    setEditPlan(data.plan_interes || '');
    setEditFollowup(data.next_followup || '');
    setEditPuesto(data.puesto || '');
    setLoading(false);
  };

  useEffect(() => { loadContact(); }, [contactId]);

  const saveContact = async () => {
    if (!contact) return;
    setSaving(true);
    await fetch('/api/crm/contacts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: contact.id,
        lifecycle_stage: editLifecycle,
        plan_interes: editPlan || null,
        next_followup: editFollowup || null,
        puesto: editPuesto || null,
        tipo: editLifecycle === 'cliente' ? 'cliente' : editLifecycle === 'churned' ? 'churned' : 'lead',
      }),
    });
    setSaving(false);
    loadContact();
  };

  const addActivity = async () => {
    if (!contact || !activityText.trim()) return;
    setSaving(true);
    await fetch('/api/crm/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: contact.id,
        company_id: contact.company_id,
        tipo: activityType,
        titulo: activityLabel(activityType),
        descripcion: activityText.trim(),
      }),
    });
    setActivityText('');
    setSaving(false);
    loadContact();
  };

  if (loading || !contact) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#f5f6f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#bbb', fontSize: '0.875rem' }}>Cargando contacto...</span>
      </div>
    );
  }

  const stageInfo = LIFECYCLE_STAGES.find(s => s.id === contact.lifecycle_stage);
  const fullName = contact.nombre + (contact.apellido ? ` ${contact.apellido}` : '');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#f5f6f8', display: 'flex', flexDirection: 'column', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* ─── Top Bar ─── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Avatar */}
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: stageInfo?.color || '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.875rem', flexShrink: 0 }}>
            {contact.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1a1a1a' }}>{fullName}</div>
            <div style={{ fontSize: '0.8125rem', color: '#999' }}>{contact.companies?.nombre || ''}{contact.puesto ? ` · ${contact.puesto}` : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (stageInfo?.color || '#ccc') + '18', color: stageInfo?.color }}>{stageInfo?.label}</span>
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f5f5f5', color: '#888' }}>{contact.tipo}</span>
            {contact.lead_score > 0 && (
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: contact.lead_score >= 70 ? '#e8f5e9' : contact.lead_score >= 40 ? '#fff3e0' : '#f5f5f5', color: contact.lead_score >= 70 ? '#2e7d32' : contact.lead_score >= 40 ? '#e65100' : '#aaa' }}>
                {contact.lead_score} pts
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {contact.whatsapp && (
            <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" style={{ ...btn, background: '#e8f5e9', color: '#2e7d32', textDecoration: 'none' }}>WhatsApp</a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} style={{ ...btn, background: '#e3f2fd', color: '#1565c0', textDecoration: 'none' }}>Email</a>
          )}
          <button onClick={onClose} style={{ ...btn, background: '#f5f5f5', color: '#555', fontSize: '1rem', padding: '6px 12px' }}>✕</button>
        </div>
      </div>

      {/* ─── Body: Two columns ─── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Column (60%) */}
        <div style={{ flex: '0 0 60%', overflowY: 'auto', padding: '20px 24px' }}>
          {/* Editable info card */}
          <Card title="Información">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <FieldLabel>Etapa de ciclo de vida</FieldLabel>
                <select value={editLifecycle} onChange={e => setEditLifecycle(e.target.value)} style={inputStyle}>
                  {LIFECYCLE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Plan de interés</FieldLabel>
                <select value={editPlan} onChange={e => setEditPlan(e.target.value)} style={inputStyle}>
                  <option value="">Sin plan</option>
                  <option value="vende">Vende</option>
                  <option value="controla">Controla</option>
                  <option value="fideliza">Fideliza</option>
                  <option value="automatiza">Automatiza</option>
                </select>
              </div>
              <div>
                <FieldLabel>Próximo seguimiento</FieldLabel>
                <input type="date" value={editFollowup} onChange={e => setEditFollowup(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <FieldLabel>Puesto</FieldLabel>
                <input value={editPuesto} onChange={e => setEditPuesto(e.target.value)} placeholder="Ej: Director, Gerente" style={inputStyle} />
              </div>
            </div>
            <button onClick={saveContact} disabled={saving} style={{ ...btn, background: '#1a1a1a', color: '#fff', width: '100%', marginTop: 8, justifyContent: 'center' }}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </Card>

          {/* Contact details grid */}
          <Card title="Datos de contacto" style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <InfoCell label="Email" value={contact.email || '—'} />
              <InfoCell label="WhatsApp" value={contact.whatsapp || '—'} />
              <InfoCell label="Giro" value={contact.giro || '—'} />
              <InfoCell label="Sucursales" value={contact.sucursales_interes ? String(contact.sucursales_interes) : '—'} />
              <InfoCell label="Score" value={contact.lead_score > 0 ? `${contact.lead_score}/100` : '—'} />
              <InfoCell label="Tiempo en sitio" value={contact.total_time_on_site > 60 ? `${Math.floor(contact.total_time_on_site / 60)}m ${contact.total_time_on_site % 60}s` : contact.total_time_on_site > 0 ? `${contact.total_time_on_site}s` : '—'} />
              <InfoCell label="Fuente" value={contact.fuente || '—'} />
              <InfoCell label="Fecha creación" value={fmtDate(contact.created_at)} />
              <InfoCell label="Último contacto" value={fmtDate(contact.last_contact_at)} />
            </div>
          </Card>

          {/* Company card */}
          {contact.companies && (
            <Card title="Empresa" style={{ marginTop: 16 }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{contact.companies.nombre}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <InfoCell label="Plan" value={contact.companies.plan || '—'} />
                <InfoCell label="MRR" value={contact.companies.mrr > 0 ? fmt(contact.companies.mrr) : '—'} />
                <InfoCell label="Sucursales" value={String(contact.companies.sucursales)} />
                <InfoCell label="Estado" value={contact.companies.estado_cuenta || '—'} />
                <InfoCell label="Fecha inicio" value={fmtDate(contact.companies.fecha_inicio)} />
                <InfoCell label="Renovación" value={fmtDate(contact.companies.fecha_renovacion)} />
              </div>
            </Card>
          )}

          {/* Pages visited */}
          {contact.pages_visited && (
            <Card title={`Páginas visitadas (${contact.page_count})`} style={{ marginTop: 16 }}>
              <div style={{ fontSize: '0.75rem', color: '#666', lineHeight: 1.8 }}>
                {contact.pages_visited.split(',').map((p, i) => (
                  <span key={i} style={{ display: 'inline-block', background: '#f5f5f5', padding: '2px 8px', borderRadius: 4, marginRight: 4, marginBottom: 4, fontSize: '0.6875rem' }}>
                    {p.trim()}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column (40%) */}
        <div style={{ flex: '0 0 40%', overflowY: 'auto', padding: '20px 24px', borderLeft: '1px solid #f0f0f0', background: '#fff' }}>
          {/* Quick add activity */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Registrar actividad</SectionLabel>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <select value={activityType} onChange={e => setActivityType(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: '0 0 auto', marginBottom: 0 }}>
                {ACTIVITY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <input value={activityText} onChange={e => setActivityText(e.target.value)} placeholder="Descripción..." style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                onKeyDown={e => { if (e.key === 'Enter') addActivity(); }} />
              <button onClick={addActivity} disabled={saving || !activityText.trim()} style={{ ...btn, background: '#4B7BE5', color: '#fff', flexShrink: 0 }}>+</button>
            </div>
          </div>

          {/* Activity Timeline */}
          <SectionLabel>Timeline</SectionLabel>
          {contact.activities.length === 0 ? (
            <div style={{ color: '#ccc', fontSize: '0.8125rem', padding: '8px 0' }}>Sin actividades</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {contact.activities.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < contact.activities.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: activityColor(a.tipo), marginTop: 4 }} />
                    {i < contact.activities.length - 1 && <div style={{ width: 1, flex: 1, background: '#f0f0f0', marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1a1a1a' }}>{a.titulo || activityLabel(a.tipo)}</span>
                      {a.automatico && <span style={{ fontSize: '0.5rem', fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: '#f5f5f5', color: '#bbb' }}>auto</span>}
                    </div>
                    {a.descripcion && <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 2 }}>{a.descripcion}</div>}
                    <div style={{ fontSize: '0.625rem', color: '#bbb', marginTop: 2 }}>
                      {fmtDate(a.created_at)} · {new Date(a.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Deals section */}
          {contact.deals.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <SectionLabel>Deals ({contact.deals.length})</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {contact.deals.map(d => {
                  const ds = DEAL_STAGES[d.stage];
                  return (
                    <div key={d.id} style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1a1a1a' }}>{d.nombre}</span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1a1a1a' }}>{fmt(d.valor_total)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (ds?.color || '#ccc') + '18', color: ds?.color || '#ccc' }}>{ds?.label || d.stage}</span>
                        {d.plan && <span style={{ fontSize: '0.6875rem', color: '#888', textTransform: 'capitalize' as const }}>{d.plan}</span>}
                        <span style={{ fontSize: '0.6875rem', color: '#bbb' }}>{d.probabilidad}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quotes section */}
          {contact.quotes.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <SectionLabel>Cotizaciones ({contact.quotes.length})</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {contact.quotes.map(q => {
                  const qs = QUOTE_STATES[q.estado];
                  return (
                    <a key={q.id} href={`/cotizacion/${q.id}`} target="_blank" rel="noopener" style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 12px', textDecoration: 'none', display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1a1a1a' }}>
                          {q.numero ? `#${q.numero}` : 'Cotización'}{q.empresa ? ` · ${q.empresa}` : ''}
                        </span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1a1a1a' }}>{fmt(q.total)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (qs?.color || '#ccc') + '18', color: qs?.color || '#ccc' }}>{qs?.label || q.estado}</span>
                        <span style={{ fontSize: '0.6875rem', color: '#bbb' }}>{fmtDate(q.created_at)}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───
function Card({ title, children, style: s }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid #f0f0f0', ...s }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{ fontSize: '0.5625rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '0.8125rem', color: '#333', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>{children}</div>;
}
