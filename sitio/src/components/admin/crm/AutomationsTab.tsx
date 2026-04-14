import { useState, useEffect } from 'react';

// ─── Types ───
interface Automation {
  id: string; nombre: string; descripcion: string | null;
  tipo: string; estado: string;
  enrollment_triggers: any[]; goal_criteria: any | null;
  suppression_stages: string[]; allow_reenrollment: boolean;
  total_enrolled: number; total_completed: number; total_achieved_goal: number;
  created_at: string;
}

interface AutomationStep {
  id: string; automation_id: string; orden: number;
  tipo: string; config: any; activo: boolean;
  parent_step_id: string | null; branch_key: string | null;
}

interface AutomationDetail extends Automation {
  steps: AutomationStep[];
  stats: { active: number; completed: number; goal_achieved: number };
}

interface EmailTemplate {
  id: string; nombre: string; asunto: string; tipo: string;
  layout: string; activo: boolean;
}

interface ContactOption {
  id: string; nombre: string; email: string | null;
}

// ─── Constants ───
const TIPOS: Record<string, { label: string; color: string }> = {
  lifecycle: { label: 'Lifecycle', color: '#4B7BE5' },
  drip: { label: 'Drip', color: '#6C5CE7' },
  reenganche: { label: 'Reenganche', color: '#F39C12' },
  onboarding: { label: 'Onboarding', color: '#2AB5A0' },
  custom: { label: 'Custom', color: '#999' },
};

const STEP_TYPES = [
  { id: 'send_email', label: 'Enviar email', icon: '✉' },
  { id: 'wait', label: 'Esperar', icon: '⏳' },
  { id: 'if_then', label: 'Si/Entonces', icon: '❓' },
  { id: 'set_property', label: 'Establecer propiedad', icon: '⚙' },
  { id: 'create_task', label: 'Crear tarea', icon: '📋' },
  { id: 'send_notification', label: 'Enviar notificación', icon: '🔔' },
];

const LIFECYCLE_STAGES = [
  { id: 'suscriptor', label: 'Suscriptor' },
  { id: 'lead', label: 'Lead' },
  { id: 'lead_calificado', label: 'Lead calificado' },
  { id: 'oportunidad', label: 'Oportunidad' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'evangelista', label: 'Evangelista' },
  { id: 'churned', label: 'Churned' },
];

const TRIGGER_TYPES = [
  { id: 'lifecycle_stage_change', label: 'Cambio de etapa' },
  { id: 'property_change', label: 'Cambio de propiedad' },
  { id: 'manual', label: 'Manual' },
];

const OPERATORS = [
  { id: 'eq', label: '= igual a' },
  { id: 'gte', label: '>= mayor o igual' },
  { id: 'lte', label: '<= menor o igual' },
  { id: 'contains', label: 'contiene' },
];

const WAIT_UNITS = [
  { id: 'minutes', label: 'minutos' },
  { id: 'hours', label: 'horas' },
  { id: 'days', label: 'días' },
  { id: 'weeks', label: 'semanas' },
];

const TEMPLATE_TYPES: Record<string, { label: string; color: string }> = {
  marketing: { label: 'Marketing', color: '#6C5CE7' },
  transaccional: { label: 'Transaccional', color: '#4B7BE5' },
  onboarding: { label: 'Onboarding', color: '#2AB5A0' },
  reenganche: { label: 'Reenganche', color: '#F39C12' },
  notificacion: { label: 'Notificación', color: '#999' },
};

const LAYOUT_TYPES: Record<string, string> = {
  branded: 'Branded', minimal: 'Minimal', plain: 'Plain',
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const date = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  if (isNaN(date.getTime())) return '—';
  return `${date.getDate()}/${date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}/${date.getFullYear()}`;
};

// ─── Shared styles ───
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' };
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: '0.8125rem', border: '1px solid #e0e0e0', borderRadius: 8, outline: 'none', fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' as const };
const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0', padding: '20px 24px' };
const label: React.CSSProperties = { fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#999', marginBottom: 4, display: 'block' };
const badge = (color: string): React.CSSProperties => ({ fontSize: '0.625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: color + '18', color, display: 'inline-block' });

function Label({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={{ ...label, ...s }}>{children}</span>;
}

// ─── Main Component ───
export default function AutomationsTab() {
  const [view, setView] = useState<'list' | 'detail' | 'templates'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openDetail = (id: string) => {
    setSelectedId(id);
    setView('detail');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Sub-nav tabs */}
      <div style={{ display: 'flex', gap: 0, background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 24px' }}>
        {[
          { id: 'list' as const, label: 'Automatizaciones' },
          { id: 'templates' as const, label: 'Templates de Email' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setView(tab.id); setSelectedId(null); }}
            style={{
              padding: '12px 20px', fontSize: '0.8125rem', fontWeight: 600,
              border: 'none', borderBottom: (view === tab.id || (view === 'detail' && tab.id === 'list')) ? '2px solid #1a1a1a' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              color: (view === tab.id || (view === 'detail' && tab.id === 'list')) ? '#1a1a1a' : '#999',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {(view === 'list') && <AutomationsList onSelect={openDetail} />}
        {view === 'detail' && selectedId && <AutomationDetail id={selectedId} onBack={() => setView('list')} />}
        {view === 'templates' && <TemplatesView />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// View 1: Automations List
// ═══════════════════════════════════════════════
function AutomationsList({ onSelect }: { onSelect: (id: string) => void }) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/automations');
      const data = await res.json();
      setAutomations(data.automations || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (a: Automation, e: React.MouseEvent) => {
    e.stopPropagation();
    const action = a.estado === 'activo' ? 'pause' : 'activate';
    await fetch('/api/automations/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, action }),
    });
    load();
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a' }}>Automatizaciones</div>
          <div style={{ fontSize: '0.8125rem', color: '#999', marginTop: 2 }}>{automations.length} automatizaciones</div>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ ...btn, background: '#1a1a1a', color: '#fff' }}>+ Nueva automatización</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>Cargando...</div>
      ) : automations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚙</div>
          <div style={{ fontSize: '0.875rem' }}>No hay automatizaciones. Crea la primera.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {automations.map(a => {
            const tipo = TIPOS[a.tipo] || TIPOS.custom;
            const isActive = a.estado === 'activo';
            return (
              <div
                key={a.id}
                onClick={() => onSelect(a.id)}
                style={{ ...card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1a1a1a' }}>{a.nombre}</span>
                    <span style={badge(tipo.color)}>{tipo.label}</span>
                  </div>
                  {a.descripcion && (
                    <div style={{ fontSize: '0.8125rem', color: '#888', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.descripcion}</div>
                  )}
                  <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: '#999' }}>
                    <span>Inscritos: <strong style={{ color: '#555' }}>{a.total_enrolled}</strong></span>
                    <span>Completados: <strong style={{ color: '#555' }}>{a.total_completed}</strong></span>
                    <span>Meta lograda: <strong style={{ color: '#2AB5A0' }}>{a.total_achieved_goal}</strong></span>
                    <span style={{ color: '#ccc' }}>Creado {fmtDate(a.created_at)}</span>
                  </div>
                </div>

                {/* Toggle */}
                <div onClick={e => toggleActive(a, e)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0 }}>
                  <div style={{
                    width: 36, height: 20, borderRadius: 10,
                    background: isActive ? '#2AB5A0' : '#ddd',
                    position: 'relative', transition: 'background 0.2s',
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2,
                      left: isActive ? 18 : 2,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: isActive ? '#2AB5A0' : '#999' }}>
                    {isActive ? 'Activo' : 'Pausado'}
                  </span>
                </div>

                {/* Arrow */}
                <span style={{ color: '#ccc', fontSize: '1.125rem', flexShrink: 0 }}>›</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && <CreateAutomationModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

// ─── Create Automation Modal ───
function CreateAutomationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState('custom');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    await fetch('/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, tipo }),
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{ ...card, position: 'relative', width: 440, maxWidth: '90vw', padding: '28px 32px', zIndex: 1 }}>
        <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 20 }}>Nueva automatización</div>

        <Label>Nombre</Label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Onboarding nuevos clientes" style={input} />

        <Label>Descripción</Label>
        <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Opcional" style={input} />

        <Label>Tipo</Label>
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={input}>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>Cancelar</button>
          <button onClick={save} disabled={saving || !nombre.trim()} style={{ ...btn, background: '#1a1a1a', color: '#fff', opacity: saving || !nombre.trim() ? 0.5 : 1 }}>
            {saving ? 'Guardando...' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// View 2: Automation Detail / Builder
// ═══════════════════════════════════════════════
function AutomationDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [automation, setAutomation] = useState<AutomationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  // Editable fields
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState('custom');
  const [triggers, setTriggers] = useState<any[]>([]);
  const [goalEnabled, setGoalEnabled] = useState(false);
  const [goalType, setGoalType] = useState('lifecycle_stage_reached');
  const [goalStage, setGoalStage] = useState('cliente');
  const [suppressionStages, setSuppressionStages] = useState<string[]>([]);
  const [allowReenrollment, setAllowReenrollment] = useState(false);
  const [reenrollDelay, setReenrollDelay] = useState(24);

  // Step editing
  const [editingStep, setEditingStep] = useState<string | null>(null); // step id or 'new'
  const [stepForm, setStepForm] = useState<{ tipo: string; config: any }>({ tipo: 'send_email', config: {} });
  const [showStepTypeSelector, setShowStepTypeSelector] = useState(false);

  // Enroll contact
  const [enrollSearch, setEnrollSearch] = useState('');
  const [enrollResults, setEnrollResults] = useState<ContactOption[]>([]);
  const [showEnroll, setShowEnroll] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [autoRes, tplRes] = await Promise.all([
        fetch(`/api/automations/${id}`),
        fetch('/api/email-templates'),
      ]);
      const autoData: AutomationDetail = await autoRes.json();
      const tplData = await tplRes.json();
      setAutomation(autoData);
      setTemplates(tplData.templates || []);

      // Populate form fields
      setNombre(autoData.nombre);
      setDescripcion(autoData.descripcion || '');
      setTipo(autoData.tipo);
      const rawTriggers = autoData.enrollment_triggers;
      // Normalize triggers: API may return object or array, with 'conditions' instead of 'config'
      const normalizeTrigger = (t: any) => {
        if (!t || !t.type) return null;
        if (t.config) return t; // Already in expected format
        // Convert from {type, conditions} to {type, config}
        const cond = t.conditions?.[0] || {};
        if (t.type === 'lifecycle_stage_change') return { type: t.type, config: { stage: cond.value || 'lead' } };
        if (t.type === 'property_change') return { type: t.type, config: { property: cond.property || '', operator: cond.operator || 'eq', value: cond.value || '' } };
        return { type: t.type, config: {} };
      };
      const triggerArr = Array.isArray(rawTriggers) ? rawTriggers : rawTriggers ? [rawTriggers] : [];
      setTriggers(triggerArr.map(normalizeTrigger).filter(Boolean));
      setGoalEnabled(!!autoData.goal_criteria);
      if (autoData.goal_criteria) {
        setGoalType(autoData.goal_criteria.type || 'lifecycle_stage_reached');
        setGoalStage(autoData.goal_criteria.stage || 'cliente');
      }
      setSuppressionStages(Array.isArray(autoData.suppression_stages) ? autoData.suppression_stages : []);
      setAllowReenrollment(autoData.allow_reenrollment);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const saveAutomation = async () => {
    setSaving(true);
    await fetch('/api/automations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        nombre,
        descripcion: descripcion || null,
        tipo,
        enrollment_triggers: triggers,
        goal_criteria: goalEnabled ? { type: goalType, stage: goalStage } : null,
        suppression_stages: suppressionStages,
        allow_reenrollment: allowReenrollment,
      }),
    });
    await load();
    setSaving(false);
  };

  const toggleActive = async () => {
    if (!automation) return;
    const action = automation.estado === 'activo' ? 'pause' : 'activate';
    await fetch('/api/automations/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    load();
  };

  // ─── Step CRUD ───
  const addStep = async (tipo: string) => {
    const orden = (automation?.steps?.length || 0) + 1;
    setStepForm({ tipo, config: getDefaultConfig(tipo) });
    setEditingStep('new');
    setShowStepTypeSelector(false);
    // We'll save it when user confirms
  };

  const saveStep = async () => {
    if (editingStep === 'new') {
      const orden = (automation?.steps?.length || 0) + 1;
      await fetch('/api/automations/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automation_id: id, orden, tipo: stepForm.tipo, config: stepForm.config }),
      });
    } else if (editingStep) {
      await fetch('/api/automations/steps', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingStep, tipo: stepForm.tipo, config: stepForm.config }),
      });
    }
    setEditingStep(null);
    load();
  };

  const deleteStep = async (stepId: string) => {
    await fetch('/api/automations/steps', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: stepId }),
    });
    load();
  };

  const startEditStep = (step: AutomationStep) => {
    setStepForm({ tipo: step.tipo, config: step.config || {} });
    setEditingStep(step.id);
  };

  // ─── Enroll contact ───
  const searchContacts = async () => {
    if (!enrollSearch.trim()) return;
    const res = await fetch(`/api/crm/contacts?search=${encodeURIComponent(enrollSearch)}`);
    const data = await res.json();
    setEnrollResults(data.contacts || []);
  };

  const enrollContact = async (contactId: string) => {
    await fetch('/api/automations/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automation_id: id, contact_id: contactId }),
    });
    setShowEnroll(false);
    setEnrollSearch('');
    setEnrollResults([]);
    load();
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>Cargando...</div>;
  if (!automation) return <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>No encontrado</div>;

  const isActive = automation.estado === 'activo';
  const steps = (automation.steps || []).sort((a, b) => a.orden - b.orden);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
        <button onClick={onBack} style={{ ...btn, background: '#f5f5f5', color: '#555', padding: '6px 10px' }}>← Volver</button>
        <input
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          style={{ flex: 1, fontSize: '1rem', fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', color: '#1a1a1a', padding: '4px 0' }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginRight: 8 }}>
            {[
              { l: 'Activos', v: automation.stats?.active ?? 0, c: '#4B7BE5' },
              { l: 'Completados', v: automation.stats?.completed ?? 0, c: '#2AB5A0' },
              { l: 'Meta', v: automation.stats?.goal_achieved ?? 0, c: '#F39C12' },
            ].map(s => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color: s.c }}>{s.v}</span>
                <span style={{ fontSize: '0.5625rem', color: '#999', fontWeight: 500 }}>{s.l}</span>
              </div>
            ))}
          </div>

          {/* Enroll */}
          <button onClick={() => setShowEnroll(!showEnroll)} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>+ Inscribir</button>

          {/* Toggle */}
          <div onClick={toggleActive} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <div style={{
              width: 36, height: 20, borderRadius: 10,
              background: isActive ? '#2AB5A0' : '#ddd',
              position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: isActive ? 18 : 2,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }} />
            </div>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: isActive ? '#2AB5A0' : '#999' }}>
              {isActive ? 'Activo' : 'Pausado'}
            </span>
          </div>

          {/* Save */}
          <button onClick={saveAutomation} disabled={saving} style={{ ...btn, background: '#1a1a1a', color: '#fff', opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Enroll dropdown */}
      {showEnroll && (
        <div style={{ padding: '12px 24px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={enrollSearch}
                onChange={e => setEnrollSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') searchContacts(); }}
                placeholder="Buscar contacto por nombre o email..."
                style={{ ...input, marginBottom: 0, flex: 1 }}
              />
              <button onClick={searchContacts} style={{ ...btn, background: '#4B7BE5', color: '#fff' }}>Buscar</button>
            </div>
            {enrollResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {enrollResults.slice(0, 8).map(c => (
                  <div
                    key={c.id}
                    onClick={() => enrollContact(c.id)}
                    style={{ padding: '6px 10px', borderRadius: 6, background: '#fff', border: '1px solid #f0f0f0', cursor: 'pointer', fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between' }}
                  >
                    <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{c.nombre}</span>
                    <span style={{ color: '#999' }}>{c.email || ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { setShowEnroll(false); setEnrollResults([]); }} style={{ ...btn, background: '#f5f5f5', color: '#999', padding: '6px 10px' }}>✕</button>
        </div>
      )}

      {/* Main content: two panels */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left panel: Steps (60%) */}
        <div style={{ flex: 6, padding: '20px 24px', overflowY: 'auto', borderRight: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Label style={{ marginBottom: 0, fontSize: '0.6875rem' }}>WORKFLOW — {steps.length} pasos</Label>
          </div>

          {/* Steps timeline */}
          <div style={{ position: 'relative' }}>
            {steps.map((step, i) => {
              const stepType = STEP_TYPES.find(t => t.id === step.tipo);
              const isEditing = editingStep === step.id;
              return (
                <div key={step.id} style={{ position: 'relative', marginBottom: 0 }}>
                  {/* Connecting line */}
                  {i < steps.length - 1 && (
                    <div style={{
                      position: 'absolute', left: 18, top: 44, bottom: -4,
                      width: 2, background: '#e0e0e0', zIndex: 0,
                    }} />
                  )}

                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative', zIndex: 1, marginBottom: 16 }}>
                    {/* Step number circle */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      background: step.activo ? '#4B7BE5' : '#ddd',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8125rem', fontWeight: 700,
                    }}>
                      {step.orden}
                    </div>

                    {/* Step card */}
                    <div style={{ ...card, flex: 1, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '1rem' }}>{stepType?.icon || '⚙'}</span>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1a1a1a' }}>{stepType?.label || step.tipo}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => startEditStep(step)} style={{ ...btn, background: '#f5f5f5', color: '#555', padding: '4px 8px', fontSize: '0.6875rem' }}>Editar</button>
                          <button onClick={() => deleteStep(step.id)} style={{ ...btn, background: '#fee', color: '#E54B4B', padding: '4px 8px', fontSize: '0.6875rem' }}>Eliminar</button>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 4 }}>
                        {getStepSummary(step, templates)}
                      </div>

                      {/* Inline edit form */}
                      {isEditing && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                          <StepConfigForm tipo={stepForm.tipo} config={stepForm.config} templates={templates} onChange={config => setStepForm(prev => ({ ...prev, config }))} />
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button onClick={() => setEditingStep(null)} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>Cancelar</button>
                            <button onClick={saveStep} style={{ ...btn, background: '#4B7BE5', color: '#fff' }}>Guardar paso</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New step (being added) */}
            {editingStep === 'new' && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: '#6C5CE7', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8125rem', fontWeight: 700,
                }}>
                  +
                </div>
                <div style={{ ...card, flex: 1, padding: '12px 16px', border: '1.5px solid #4B7BE5' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
                    {STEP_TYPES.find(t => t.id === stepForm.tipo)?.icon} {STEP_TYPES.find(t => t.id === stepForm.tipo)?.label}
                  </div>
                  <StepConfigForm tipo={stepForm.tipo} config={stepForm.config} templates={templates} onChange={config => setStepForm(prev => ({ ...prev, config }))} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => setEditingStep(null)} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>Cancelar</button>
                    <button onClick={saveStep} style={{ ...btn, background: '#4B7BE5', color: '#fff' }}>Agregar paso</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Add step button */}
          {editingStep !== 'new' && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowStepTypeSelector(!showStepTypeSelector)}
                style={{ ...btn, background: '#f5f5f5', color: '#555', width: '100%', justifyContent: 'center', marginTop: 8 }}
              >
                + Agregar paso
              </button>
              {showStepTypeSelector && (
                <div style={{ ...card, position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, padding: '8px', zIndex: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                  {STEP_TYPES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => addStep(t.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '8px 12px', border: 'none', background: 'transparent',
                        borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: '0.8125rem', color: '#1a1a1a', textAlign: 'left' as const,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f5f6f8'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: '1rem' }}>{t.icon}</span>
                      <span style={{ fontWeight: 600 }}>{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel: Configuration (40%) */}
        <div style={{ flex: 4, padding: '20px 24px', overflowY: 'auto', background: '#fafafa' }}>
          {/* Automation info */}
          <Label>TIPO</Label>
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={input}>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <Label>DESCRIPCIÓN</Label>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Descripción de la automatización"
            rows={2}
            style={{ ...input, resize: 'vertical' }}
          />

          {/* Divider */}
          <div style={{ height: 1, background: '#e0e0e0', margin: '16px 0' }} />

          {/* Enrollment Triggers */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Label style={{ marginBottom: 0 }}>TRIGGERS DE INSCRIPCIÓN</Label>
              <button onClick={() => setTriggers([...triggers, { type: 'lifecycle_stage_change', config: { stage: 'lead' } }])} style={{ ...btn, background: '#f5f5f5', color: '#555', padding: '4px 10px', fontSize: '0.6875rem' }}>+ Agregar</button>
            </div>
            {triggers.length === 0 && <div style={{ fontSize: '0.75rem', color: '#bbb', padding: '8px 0' }}>Sin triggers. Solo inscripción manual.</div>}
            {triggers.map((trigger, i) => (
              <div key={i} style={{ ...card, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <select
                    value={trigger.type}
                    onChange={e => {
                      const newTriggers = [...triggers];
                      newTriggers[i] = { type: e.target.value, config: e.target.value === 'lifecycle_stage_change' ? { stage: 'lead' } : e.target.value === 'property_change' ? { property: '', operator: 'eq', value: '' } : {} };
                      setTriggers(newTriggers);
                    }}
                    style={{ ...input, marginBottom: 0, flex: 1 }}
                  >
                    {TRIGGER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <button onClick={() => setTriggers(triggers.filter((_, j) => j !== i))} style={{ ...btn, background: '#fee', color: '#E54B4B', padding: '4px 8px', fontSize: '0.625rem' }}>✕</button>
                </div>

                {trigger.type === 'lifecycle_stage_change' && (
                  <select
                    value={trigger.config?.stage || 'lead'}
                    onChange={e => {
                      const newTriggers = [...triggers];
                      newTriggers[i] = { ...trigger, config: { stage: e.target.value } };
                      setTriggers(newTriggers);
                    }}
                    style={{ ...input, marginBottom: 0 }}
                  >
                    {LIFECYCLE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                )}

                {trigger.type === 'property_change' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={trigger.config?.property || ''}
                      onChange={e => {
                        const newTriggers = [...triggers];
                        newTriggers[i] = { ...trigger, config: { ...trigger.config, property: e.target.value } };
                        setTriggers(newTriggers);
                      }}
                      placeholder="Propiedad"
                      style={{ ...input, marginBottom: 0, flex: 1 }}
                    />
                    <select
                      value={trigger.config?.operator || 'eq'}
                      onChange={e => {
                        const newTriggers = [...triggers];
                        newTriggers[i] = { ...trigger, config: { ...trigger.config, operator: e.target.value } };
                        setTriggers(newTriggers);
                      }}
                      style={{ ...input, marginBottom: 0, width: 100 }}
                    >
                      {OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    <input
                      value={trigger.config?.value || ''}
                      onChange={e => {
                        const newTriggers = [...triggers];
                        newTriggers[i] = { ...trigger, config: { ...trigger.config, value: e.target.value } };
                        setTriggers(newTriggers);
                      }}
                      placeholder="Valor"
                      style={{ ...input, marginBottom: 0, flex: 1 }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#e0e0e0', margin: '16px 0' }} />

          {/* Goal Criteria */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Label style={{ marginBottom: 0 }}>CRITERIO DE META</Label>
              <div onClick={() => setGoalEnabled(!goalEnabled)} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <div style={{
                  width: 28, height: 16, borderRadius: 8,
                  background: goalEnabled ? '#2AB5A0' : '#ddd',
                  position: 'relative', transition: 'background 0.2s',
                }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 2,
                    left: goalEnabled ? 14 : 2,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                  }} />
                </div>
              </div>
            </div>
            {goalEnabled && (
              <div style={{ ...card, padding: '10px 12px' }}>
                <Label>Tipo</Label>
                <select value={goalType} onChange={e => setGoalType(e.target.value)} style={{ ...input, marginBottom: 8 }}>
                  <option value="lifecycle_stage_reached">Etapa de lifecycle alcanzada</option>
                </select>
                <Label>Etapa</Label>
                <select value={goalStage} onChange={e => setGoalStage(e.target.value)} style={{ ...input, marginBottom: 0 }}>
                  {LIFECYCLE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#e0e0e0', margin: '16px 0' }} />

          {/* Suppression */}
          <div style={{ marginBottom: 20 }}>
            <Label>SUPRESIÓN — Excluir etapas</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {LIFECYCLE_STAGES.map(s => {
                const selected = suppressionStages.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (selected) {
                        setSuppressionStages(suppressionStages.filter(x => x !== s.id));
                      } else {
                        setSuppressionStages([...suppressionStages, s.id]);
                      }
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: '0.6875rem', fontWeight: 600,
                      border: selected ? '1.5px solid #E54B4B' : '1px solid #e0e0e0',
                      background: selected ? '#fee' : '#fff',
                      color: selected ? '#E54B4B' : '#666',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#e0e0e0', margin: '16px 0' }} />

          {/* Settings */}
          <div>
            <Label>CONFIGURACIÓN</Label>
            <div style={{ ...card, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={allowReenrollment}
                  onChange={e => setAllowReenrollment(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#4B7BE5' }}
                />
                <span style={{ fontSize: '0.8125rem', color: '#1a1a1a' }}>Permitir re-inscripción</span>
              </div>
              {allowReenrollment && (
                <div>
                  <Label>Delay de re-inscripción (horas)</Label>
                  <input
                    type="number"
                    value={reenrollDelay}
                    onChange={e => setReenrollDelay(Number(e.target.value))}
                    min={0}
                    style={{ ...input, width: 120, marginBottom: 0 }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step Config Form ───
function StepConfigForm({ tipo, config, templates, onChange }: {
  tipo: string; config: any; templates: EmailTemplate[]; onChange: (config: any) => void;
}) {
  switch (tipo) {
    case 'send_email':
      return (
        <div>
          <Label>Template de email</Label>
          <select
            value={config.template_id || ''}
            onChange={e => onChange({ ...config, template_id: e.target.value })}
            style={input}
          >
            <option value="">Seleccionar template...</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.nombre} — {t.asunto}</option>)}
          </select>
        </div>
      );

    case 'wait':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Label>Cantidad</Label>
            <input
              type="number"
              value={config.value || 1}
              onChange={e => onChange({ ...config, value: Number(e.target.value) })}
              min={1}
              style={input}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Label>Unidad</Label>
            <select value={config.unit || 'days'} onChange={e => onChange({ ...config, unit: e.target.value })} style={input}>
              {WAIT_UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
        </div>
      );

    case 'if_then':
      return (
        <div>
          <Label>Propiedad</Label>
          <input value={config.property || ''} onChange={e => onChange({ ...config, property: e.target.value })} placeholder="Ej: lead_score" style={input} />
          <Label>Operador</Label>
          <select value={config.operator || 'eq'} onChange={e => onChange({ ...config, operator: e.target.value })} style={input}>
            {OPERATORS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <Label>Valor</Label>
          <input value={config.value || ''} onChange={e => onChange({ ...config, value: e.target.value })} placeholder="Ej: 40" style={input} />
        </div>
      );

    case 'set_property':
      return (
        <div>
          <Label>Objeto</Label>
          <select value={config.object || 'contact'} onChange={e => onChange({ ...config, object: e.target.value })} style={input}>
            <option value="contact">Contacto</option>
            <option value="company">Empresa</option>
          </select>
          <Label>Propiedad</Label>
          <input value={config.property || ''} onChange={e => onChange({ ...config, property: e.target.value })} placeholder="Ej: lifecycle_stage" style={input} />
          <Label>Valor</Label>
          <input value={config.value || ''} onChange={e => onChange({ ...config, value: e.target.value })} placeholder="Ej: lead_calificado" style={input} />
        </div>
      );

    case 'create_task':
      return (
        <div>
          <Label>Titulo</Label>
          <input value={config.titulo || ''} onChange={e => onChange({ ...config, titulo: e.target.value })} placeholder="Ej: Llamar al contacto" style={input} />
          <Label>Asignar a</Label>
          <input value={config.assign_to || ''} onChange={e => onChange({ ...config, assign_to: e.target.value })} placeholder="Ej: ventas@sacs.com" style={input} />
          <Label>Vence en (dias)</Label>
          <input type="number" value={config.due_in_days || 3} onChange={e => onChange({ ...config, due_in_days: Number(e.target.value) })} min={1} style={{ ...input, width: 120 }} />
        </div>
      );

    case 'send_notification':
      return (
        <div>
          <Label>Mensaje</Label>
          <textarea
            value={config.message || ''}
            onChange={e => onChange({ ...config, message: e.target.value })}
            placeholder="Mensaje de notificación..."
            rows={3}
            style={{ ...input, resize: 'vertical' }}
          />
        </div>
      );

    default:
      return <div style={{ fontSize: '0.75rem', color: '#999' }}>Tipo de paso no reconocido.</div>;
  }
}

// ─── Step helpers ───
function getDefaultConfig(tipo: string): any {
  switch (tipo) {
    case 'send_email': return { template_id: '' };
    case 'wait': return { value: 2, unit: 'days' };
    case 'if_then': return { property: '', operator: 'gte', value: '' };
    case 'set_property': return { object: 'contact', property: '', value: '' };
    case 'create_task': return { titulo: '', assign_to: '', due_in_days: 3 };
    case 'send_notification': return { message: '' };
    default: return {};
  }
}

function getStepSummary(step: AutomationStep, templates: EmailTemplate[]): string {
  const c = step.config || {};
  switch (step.tipo) {
    case 'send_email': {
      const tpl = templates.find(t => t.id === c.template_id);
      return tpl ? `Enviar: ${tpl.nombre}` : 'Email sin template';
    }
    case 'wait': return `Esperar ${c.value || '?'} ${WAIT_UNITS.find(u => u.id === c.unit)?.label || c.unit || 'dias'}`;
    case 'if_then': return `Si ${c.property || '?'} ${c.operator || '?'} ${c.value || '?'}`;
    case 'set_property': return `${c.object || 'contact'}.${c.property || '?'} = ${c.value || '?'}`;
    case 'create_task': return `Tarea: ${c.titulo || 'Sin titulo'}`;
    case 'send_notification': return c.message ? `"${c.message.slice(0, 50)}${c.message.length > 50 ? '...' : ''}"` : 'Sin mensaje';
    default: return JSON.stringify(c);
  }
}

// ═══════════════════════════════════════════════
// View 3: Email Templates
// ═══════════════════════════════════════════════
function TemplatesView() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null); // template id
  const [previewHtml, setPreviewHtml] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Partial<EmailTemplate> & { bloques?: string }>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email-templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadPreview = async (id: string) => {
    setPreview(id);
    try {
      const res = await fetch(`/api/email-templates/${id}`);
      const data = await res.json();
      setPreviewHtml(data.compiled_html || data.html || '<p>Sin preview disponible</p>');
    } catch {
      setPreviewHtml('<p>Error cargando preview</p>');
    }
  };

  const openEditor = (template?: EmailTemplate) => {
    if (template) {
      setEditTemplate({ id: template.id, nombre: template.nombre, asunto: template.asunto, tipo: template.tipo, layout: template.layout, bloques: '' });
    } else {
      setEditTemplate({ nombre: '', asunto: '', tipo: 'marketing', layout: 'branded', bloques: '[]' });
    }
    setShowEditor(true);
  };

  const duplicateTemplate = async (template: EmailTemplate) => {
    await fetch('/api/email-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: `${template.nombre} (copia)`,
        asunto: template.asunto,
        tipo: template.tipo,
        layout: template.layout,
      }),
    });
    load();
  };

  const saveTemplate = async () => {
    const method = editTemplate.id ? 'PUT' : 'POST';
    const body: any = {
      nombre: editTemplate.nombre,
      asunto: editTemplate.asunto,
      tipo: editTemplate.tipo,
      layout: editTemplate.layout,
    };
    if (editTemplate.id) body.id = editTemplate.id;
    if (editTemplate.bloques) {
      try {
        body.bloques = JSON.parse(editTemplate.bloques);
      } catch { /* leave as is */ }
    }
    await fetch('/api/email-templates', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setShowEditor(false);
    load();
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a' }}>Templates de Email</div>
          <div style={{ fontSize: '0.8125rem', color: '#999', marginTop: 2 }}>{templates.length} templates</div>
        </div>
        <button onClick={() => openEditor()} style={{ ...btn, background: '#1a1a1a', color: '#fff' }}>+ Nuevo template</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>Cargando...</div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>✉</div>
          <div style={{ fontSize: '0.875rem' }}>No hay templates. Crea el primero.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {templates.map(t => {
            const tipoInfo = TEMPLATE_TYPES[t.tipo] || { label: t.tipo, color: '#999' };
            return (
              <div key={t.id} style={{ ...card }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1a1a1a' }}>{t.nombre}</div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <span style={badge(tipoInfo.color)}>{tipoInfo.label}</span>
                    <span style={badge('#999')}>{LAYOUT_TYPES[t.layout] || t.layout}</span>
                  </div>
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#888', marginBottom: 12 }}>
                  <strong>Asunto:</strong> {t.asunto}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => loadPreview(t.id)} style={{ ...btn, background: '#f5f5f5', color: '#555', fontSize: '0.6875rem', padding: '5px 10px' }}>Preview</button>
                  <button onClick={() => openEditor(t)} style={{ ...btn, background: '#f5f5f5', color: '#555', fontSize: '0.6875rem', padding: '5px 10px' }}>Editar</button>
                  <button onClick={() => duplicateTemplate(t)} style={{ ...btn, background: '#f5f5f5', color: '#555', fontSize: '0.6875rem', padding: '5px 10px' }}>Duplicar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setPreview(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{ position: 'relative', width: 680, maxWidth: '95vw', maxHeight: '85vh', background: '#fff', borderRadius: 12, overflow: 'hidden', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1a1a1a' }}>Preview</span>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
            </div>
            <iframe
              srcDoc={previewHtml}
              style={{ flex: 1, border: 'none', minHeight: 500 }}
              sandbox="allow-same-origin"
              title="Email Preview"
            />
          </div>
        </div>
      )}

      {/* Editor panel */}
      {showEditor && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowEditor(false)} style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{ width: 560, maxWidth: '90vw', background: '#fff', overflowY: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1a1a1a' }}>{editTemplate.id ? 'Editar template' : 'Nuevo template'}</span>
              <button onClick={() => setShowEditor(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
            </div>

            {/* Form */}
            <div style={{ padding: '20px 24px', flex: 1 }}>
              <Label>Nombre</Label>
              <input value={editTemplate.nombre || ''} onChange={e => setEditTemplate({ ...editTemplate, nombre: e.target.value })} placeholder="Nombre del template" style={input} />

              <Label>Asunto</Label>
              <input value={editTemplate.asunto || ''} onChange={e => setEditTemplate({ ...editTemplate, asunto: e.target.value })} placeholder="Asunto del email" style={input} />

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Label>Tipo</Label>
                  <select value={editTemplate.tipo || 'marketing'} onChange={e => setEditTemplate({ ...editTemplate, tipo: e.target.value })} style={input}>
                    {Object.entries(TEMPLATE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <Label>Layout</Label>
                  <select value={editTemplate.layout || 'branded'} onChange={e => setEditTemplate({ ...editTemplate, layout: e.target.value })} style={input}>
                    {Object.entries(LAYOUT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>

              <Label>Bloques (JSON)</Label>
              <textarea
                value={editTemplate.bloques || ''}
                onChange={e => setEditTemplate({ ...editTemplate, bloques: e.target.value })}
                placeholder='[{"tipo": "texto", "contenido": "Hola {{nombre}}"}]'
                rows={10}
                style={{ ...input, fontFamily: 'monospace', fontSize: '0.75rem', resize: 'vertical' }}
              />
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEditor(false)} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>Cancelar</button>
              <button onClick={saveTemplate} disabled={!editTemplate.nombre?.trim()} style={{ ...btn, background: '#1a1a1a', color: '#fff', opacity: !editTemplate.nombre?.trim() ? 0.5 : 1 }}>
                {editTemplate.id ? 'Guardar cambios' : 'Crear template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
