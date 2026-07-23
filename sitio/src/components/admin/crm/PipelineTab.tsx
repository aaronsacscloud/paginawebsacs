import { useState, useEffect } from 'react';
import PipelineKanban from './PipelineKanban';
import { useToast, Toast, logStageChange, SlaBadge, ActivityChips, KanbanSkeleton } from './crmHelpers';

interface Company {
  id: string; nombre: string; plan: string | null; sucursales: number; estado_cuenta: string; mrr: number;
}

interface Contact {
  id: string; created_at: string; nombre: string; apellido: string | null;
  email: string | null; whatsapp: string | null; tipo: string;
  lifecycle_stage: string; lead_score: number; total_time_on_site: number;
  pages_visited: string | null; page_count: number; giro: string | null;
  sucursales_interes: number | null; plan_interes: string | null;
  next_followup: string | null; last_contact_at: string | null;
  company_id: string | null; puesto: string | null; fuente: string | null;
  pipeline_stage: string | null;
  companies: Company | null;
}

interface Activity {
  id: string; created_at: string; tipo: string; titulo: string | null;
  descripcion: string | null; metadata: any; automatico: boolean;
}

const LIFECYCLE_STAGES = [
  { id: 'suscriptor', label: 'Suscriptor', color: '#ccc' },
  { id: 'lead', label: 'Lead', color: '#6C5CE7' },
  { id: 'lead_calificado', label: 'MQL', color: '#4B7BE5' },
  { id: 'oportunidad', label: 'Oportunidad', color: '#E8A838' },
  { id: 'cliente', label: 'Cliente', color: '#2AB5A0' },
  { id: 'evangelista', label: 'Evangelista', color: '#F39C12' },
  { id: 'churned', label: 'Churned', color: '#999' },
];

const TIPOS = [
  { id: 'all', label: 'Todos' },
  { id: 'lead', label: 'Leads' },
  { id: 'cliente', label: 'Clientes' },
  { id: 'churned', label: 'Churned' },
];

const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const date = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  if (isNaN(date.getTime())) return '—';
  return `${date.getDate()}/${date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}/${date.getFullYear()}`;
};

export default function PipelineTab({ onConfig }: { onConfig?: () => void } = {}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  // Vista Leads: por defecto el kanban del pipeline de LEADS configurable.
  const [view, setView] = useState<'lead' | 'table'>('lead');
  const [leadStages, setLeadStages] = useState<{ key: string; label: string; color: string }[]>([]);
  // Segmento Leads: siempre tipo='lead' (los clientes viven en Clientes, las
  // oportunidades en Oportunidades). 'churned' opcional vía el toggle.
  const [verChurned, setVerChurned] = useState(false);
  const filterTipo = verChurned ? 'churned' : 'lead';
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [editStage, setEditStage] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editFollowup, setEditFollowup] = useState('');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [converting, setConverting] = useState(false);
  const { toast, show } = useToast();

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '500' });
    params.set('tipo', filterTipo);   // 'lead' (o 'churned' con el toggle)
    if (search) params.set('search', search);
    const res = await fetch(`/api/crm/contacts?${params}`);
    const data = await res.json();
    setContacts(data.contacts || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterTipo]);
  useEffect(() => {
    fetch('/api/crm/pipelines').then(r => r.json()).then(j => {
      const lead = (j.data || []).find((p: any) => p.tipo === 'lead');
      setLeadStages(lead?.stages || []);
    }).catch(() => {});
  }, []);

  // Etapa del pipeline configurable (lead) — optimista + persiste en contacts.pipeline_stage.
  const setPipelineStage = async (id: string, key: string) => {
    const prev = contacts.find(c => c.id === id);
    setContacts(cs => cs.map(c => c.id === id ? { ...c, pipeline_stage: key } : c));
    try {
      const r = await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, pipeline_stage: key }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); if (j.error) { alert(j.error + '\n¿Corriste migration-2026-07-pipelines.sql?'); load(); return; } }
      const toLabel = leadStages.find(s => s.key === key)?.label || key;
      logStageChange({ contact_id: id, company_id: prev?.company_id || null, fromLabel: prev?.pipeline_stage ? leadStages.find(s => s.key === prev.pipeline_stage)?.label : undefined, toLabel });
      show(`Lead movido a ${toLabel}`);
    } catch { load(); }
  };

  // Convierte un lead en oportunidad: crea un deal ligado al contacto y marca
  // el contacto como 'oportunidad' (así sale del embudo de Leads y vive en
  // Oportunidades). El timeline del contacto conserva el registro.
  const convertirEnOportunidad = async (c: Contact) => {
    if (converting) return;
    setConverting(true);
    try {
      const nombre = (c.companies?.nombre || [c.nombre, c.apellido].filter(Boolean).join(' ') || c.email || 'Oportunidad') + ' – Oportunidad';
      const r = await fetch('/api/crm/deals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, contact_id: c.id, company_id: c.company_id, plan: c.plan_interes || null }),
      });
      if (!r.ok) throw new Error('No se pudo crear la oportunidad');
      await fetch('/api/crm/contacts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, lifecycle_stage: 'oportunidad' }) });
      await logStageChange({ contact_id: c.id, company_id: c.company_id, toLabel: 'Oportunidad', fromLabel: 'Lead' });
      show('Convertido en oportunidad ✓ — ábrelo en la pestaña Oportunidades', 'ok');
      setSelected(null);
      load();
    } catch (e: any) {
      show(e?.message || 'Error al convertir', 'error');
    }
    setConverting(false);
  };

  // Registro rápido de actividad desde el detalle (chips llamada/correo/tarea).
  const logQuick = async (tipo: string, label: string) => {
    if (!selected) return;
    await fetch('/api/crm/activities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: selected.id, company_id: selected.company_id, tipo, titulo: label }),
    });
    const res = await fetch(`/api/crm/activities?contact_id=${selected.id}&limit=30`);
    const acts = await res.json();
    setActivities(Array.isArray(acts) ? acts : []);
    show(`${label} registrada`);
  };

  const openDetail = async (contact: Contact) => {
    setSelected(contact);
    setEditStage(contact.lifecycle_stage);
    setEditPlan(contact.plan_interes || contact.companies?.plan || '');
    setEditFollowup(contact.next_followup || '');
    setNoteText('');
    // Load activities
    const res = await fetch(`/api/crm/activities?contact_id=${contact.id}&limit=30`);
    const acts = await res.json();
    setActivities(Array.isArray(acts) ? acts : []);
  };

  const saveChanges = async () => {
    if (!selected) return;
    setSaving(true);
    await fetch('/api/crm/contacts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        lifecycle_stage: editStage,
        plan_interes: editPlan || null,
        next_followup: editFollowup || null,
        tipo: editStage === 'cliente' ? 'cliente' : editStage === 'churned' ? 'churned' : 'lead',
      }),
    });
    await load();
    setSaving(false);
    // Refresh selected
    const res = await fetch(`/api/crm/contacts?search=${selected.email || selected.nombre}`);
    const data = await res.json();
    const updated = (data.contacts || []).find((c: Contact) => c.id === selected.id);
    if (updated) openDetail(updated);
  };

  const addNote = async () => {
    if (!selected || !noteText.trim()) return;
    setSaving(true);
    await fetch('/api/crm/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: selected.id,
        company_id: selected.company_id,
        tipo: 'nota',
        titulo: 'Nota',
        descripcion: noteText.trim(),
      }),
    });
    setNoteText('');
    // Reload activities
    const res = await fetch(`/api/crm/activities?contact_id=${selected.id}&limit=30`);
    const acts = await res.json();
    setActivities(Array.isArray(acts) ? acts : []);
    setSaving(false);
  };

  // Acciones en lote sobre varios leads seleccionados en la tabla.
  const bulkUpdate = async (ids: string[], patch: Record<string, any>, msg: string) => {
    await Promise.all(ids.map(id => fetch('/api/crm/contacts', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }),
    })));
    await load();
    show(msg);
  };

  const doSearch = () => { load(); };

  // Leads que ya graduaron (oportunidad/cliente) salen del embudo salvo en
  // la vista churned.
  const visibleContacts = verChurned ? contacts : contacts.filter(c => !['oportunidad', 'cliente'].includes(c.lifecycle_stage));

  // Stats del segmento Leads
  const mql = visibleContacts.filter(c => c.lifecycle_stage === 'lead_calificado');
  const sinSeguimiento = visibleContacts.filter(c => !c.next_followup);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Sub-nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', background: '#fff', borderBottom: '1px solid #f0f0f0', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', overflowX: 'auto' }}>
          {[
            { l: verChurned ? 'Churned' : 'Leads', v: visibleContacts.length, c: '#6C5CE7' },
            { l: 'MQL', v: mql.length, c: '#4B7BE5' },
            { l: 'Sin seguimiento', v: sinSeguimiento.length, c: '#E54B4B' },
          ].map(s => (
            <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: s.c }}>{s.v}</span>
              <span style={{ fontSize: '0.625rem', color: '#999', fontWeight: 500 }}>{s.l}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
            placeholder="Buscar..."
            style={{ padding: '6px 12px', fontSize: '0.8125rem', border: '1px solid #e0e0e0', borderRadius: 8, outline: 'none', fontFamily: 'inherit', width: 180 }}
          />
          {/* Toggle: leads activos / churned */}
          <button onClick={() => setVerChurned(v => !v)} title="Ver leads perdidos" style={{
            padding: '4px 10px', borderRadius: 20, fontSize: '0.6875rem', fontWeight: 600,
            border: verChurned ? '1.5px solid #1a1a1a' : '1px solid #e0e0e0',
            background: verChurned ? '#1a1a1a' : '#fff', color: verChurned ? '#fff' : '#666',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{verChurned ? '← Leads activos' : 'Ver churned'}</button>
          <div style={{ display: 'flex', border: '1px solid #e5e5e5', borderRadius: 8, overflow: 'hidden' }}>
            {([['lead', '⚑ Pipeline'], ['table', '☰ Tabla']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} style={{ ...btn, borderRadius: 0, background: view === v ? '#1a1a1a' : '#fff', color: view === v ? '#fff' : '#555' }}>{l}</button>
            ))}
          </div>
          {/* Configurar las etapas del pipeline de Leads directamente */}
          <button onClick={() => onConfig?.()} title="Configurar etapas del pipeline de Leads" style={{ ...btn, background: '#f5f5f5', color: '#555' }}>⚙️ Etapas</button>
          <button onClick={load} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>↻</button>
          <a href="/api/crm/contacts/export" style={{ ...btn, background: '#f5f5f5', color: '#555', textDecoration: 'none' }}>📥 Exportar</a>
          <button onClick={() => setShowImport(true)} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>📤 Importar</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '16px 24px', overflow: 'auto' }}>
        {loading ? <KanbanSkeleton /> :
          view === 'lead' ? (
            leadStages.length === 0
              ? <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>Aún no hay etapas de Leads. <button onClick={() => onConfig?.()} style={{ background: 'none', border: 'none', color: '#4B7BE5', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Configúralas aquí →</button></div>
              : <PipelineKanban
                  stages={leadStages}
                  items={visibleContacts}
                  getId={(c: any) => c.id}
                  // Los leads sin etapa asignada (pipeline_stage NULL) caen en la
                  // PRIMERA etapa, no en un cubo "Sin etapa" escondido.
                  getStage={(c: any) => c.pipeline_stage || leadStages[0]?.key}
                  onMove={(id, key) => setPipelineStage(id, key)}
                  renderCard={(c: any) => (
                    <div onClick={() => openDetail(c)} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', flex: 1, minWidth: 0 }}>{[c.nombre, c.apellido].filter(Boolean).join(' ') || c.email || '—'}</div>
                        <SlaBadge since={c.last_contact_at || c.created_at} label="sin contacto" />
                      </div>
                      {c.companies?.nombre ? <div style={{ fontSize: '0.72rem', color: '#999' }}>{c.companies.nombre}</div> : null}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <div style={{ fontSize: '0.7rem', color: '#aaa', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email || c.whatsapp || ''}</div>
                        {c.lead_score > 0 && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: c.lead_score >= 70 ? '#2e7d32' : c.lead_score >= 40 ? '#a06600' : '#bbb' }}>{c.lead_score}pts</span>}
                      </div>
                    </div>
                  )}
                />
          ) :
          <TableView contacts={visibleContacts} onSelect={openDetail} onBulk={bulkUpdate} />
        }
      </div>

      {/* Detail Panel */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSelected(null)} style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{ width: 460, maxWidth: '90vw', background: '#fff', overflowY: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1a1a1a' }}>{selected.nombre}{selected.apellido ? ` ${selected.apellido}` : ''}</div>
                <div style={{ fontSize: '0.8125rem', color: '#999' }}>{selected.companies?.nombre || '—'}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: LIFECYCLE_STAGES.find(s => s.id === selected.lifecycle_stage)?.color + '18', color: LIFECYCLE_STAGES.find(s => s.id === selected.lifecycle_stage)?.color }}>{LIFECYCLE_STAGES.find(s => s.id === selected.lifecycle_stage)?.label}</span>
                  <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f5f5f5', color: '#888' }}>{selected.tipo}</span>
                  {selected.lead_score > 0 && <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: selected.lead_score >= 70 ? '#e8f5e9' : selected.lead_score >= 40 ? '#fff3e0' : '#f5f5f5', color: selected.lead_score >= 70 ? '#2e7d32' : selected.lead_score >= 40 ? '#e65100' : '#aaa' }}>{selected.lead_score} pts</span>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Quick actions */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {selected.whatsapp && <a href={`https://wa.me/${selected.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" style={{ ...btn, background: '#e8f5e9', color: '#2e7d32', flex: 1, textAlign: 'center' as const, textDecoration: 'none', justifyContent: 'center' }}>WhatsApp</a>}
                {selected.email && <a href={`mailto:${selected.email}`} style={{ ...btn, background: '#e3f2fd', color: '#1565c0', flex: 1, textAlign: 'center' as const, textDecoration: 'none', justifyContent: 'center' }}>Email</a>}
              </div>

              {/* Registro rápido de actividad */}
              <ActivityChips onLog={logQuick} disabled={saving} />

              {/* Convertir en oportunidad */}
              {!['oportunidad', 'cliente'].includes(selected.lifecycle_stage) && (
                <button onClick={() => convertirEnOportunidad(selected)} disabled={converting} style={{ ...btn, background: '#E8A838', color: '#fff', width: '100%', justifyContent: 'center', marginBottom: 16 }}>
                  {converting ? 'Convirtiendo...' : '⚡ Convertir en oportunidad'}
                </button>
              )}

              {/* Lifecycle Stage */}
              <Label>Etapa de ciclo de vida</Label>
              <select value={editStage} onChange={e => setEditStage(e.target.value)} style={input}>
                {LIFECYCLE_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>

              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.8125rem', marginBottom: 16 }}>
                <InfoRow label="Email" value={selected.email || ''} />
                <InfoRow label="WhatsApp" value={selected.whatsapp || ''} />
                <InfoRow label="Giro" value={selected.giro || selected.companies?.nombre || ''} />
                <InfoRow label="Sucursales" value={String(selected.sucursales_interes || selected.companies?.sucursales || '')} />
                <InfoRow label="Score" value={selected.lead_score > 0 ? `${selected.lead_score}/100` : '—'} />
                <InfoRow label="Tiempo en sitio" value={selected.total_time_on_site > 60 ? `${Math.floor(selected.total_time_on_site / 60)}m` : selected.total_time_on_site > 0 ? `${selected.total_time_on_site}s` : '—'} />
                <InfoRow label="Fuente" value={selected.fuente || '—'} />
                <InfoRow label="Creado" value={fmtDate(selected.created_at)} />
              </div>

              {/* Company info if exists */}
              {selected.companies && (
                <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>Empresa</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1a1a1a' }}>{selected.companies.nombre}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '0.75rem' }}>
                    {selected.companies.plan && <span style={{ color: '#4B7BE5', fontWeight: 600 }}>Plan: {selected.companies.plan}</span>}
                    <span style={{ color: '#555' }}>{selected.companies.sucursales} suc.</span>
                    {selected.companies.mrr > 0 && <span style={{ color: '#2AB5A0', fontWeight: 700 }}>{fmt(selected.companies.mrr)}/mes</span>}
                    <span style={{ fontSize: '0.625rem', padding: '1px 6px', borderRadius: 10, background: selected.companies.estado_cuenta === 'activo' ? '#e8f5e9' : '#f5f5f5', color: selected.companies.estado_cuenta === 'activo' ? '#2e7d32' : '#999' }}>{selected.companies.estado_cuenta}</span>
                  </div>
                </div>
              )}

              {/* Plan & Follow-up */}
              <Label>Plan de interés</Label>
              <select value={editPlan} onChange={e => setEditPlan(e.target.value)} style={input}>
                <option value="">Sin plan</option>
                <option value="vende">Vende</option>
                <option value="controla">Controla</option>
                <option value="fideliza">Fideliza</option>
                <option value="automatiza">Automatiza</option>
              </select>

              <Label>Próximo seguimiento</Label>
              <input type="date" value={editFollowup} onChange={e => setEditFollowup(e.target.value)} style={input} />

              <button onClick={saveChanges} disabled={saving} style={{ ...btn, background: '#1a1a1a', color: '#fff', width: '100%', marginTop: 12, justifyContent: 'center' }}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>

              {/* Pages visited */}
              {selected.pages_visited && (
                <>
                  <Label style={{ marginTop: 20 }}>Páginas visitadas ({selected.page_count})</Label>
                  <div style={{ fontSize: '0.75rem', color: '#888', lineHeight: 1.6 }}>{selected.pages_visited}</div>
                </>
              )}

              {/* Notes */}
              <Label style={{ marginTop: 20 }}>Agregar nota</Label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Escribir nota..." style={{ ...input, flex: 1, marginBottom: 0 }}
                  onKeyDown={e => { if (e.key === 'Enter') addNote(); }} />
                <button onClick={addNote} disabled={saving || !noteText.trim()} style={{ ...btn, background: '#4B7BE5', color: '#fff' }}>+</button>
              </div>

              {/* Activity Timeline */}
              <Label>Timeline de actividades</Label>
              {activities.length === 0 ? (
                <div style={{ color: '#ccc', fontSize: '0.8125rem', padding: '8px 0' }}>Sin actividades</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {activities.map((a, i) => (
                    <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < activities.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: activityColor(a.tipo), flexShrink: 0, marginTop: 4 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1a1a1a' }}>{a.titulo || activityLabel(a.tipo)}</div>
                        {a.descripcion && <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 2 }}>{a.descripcion}</div>}
                        <div style={{ fontSize: '0.625rem', color: '#bbb', marginTop: 2 }}>
                          {fmtDate(a.created_at)} · {new Date(a.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          {a.automatico && <span style={{ marginLeft: 6, color: '#ddd' }}>auto</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontWeight: 800 }}>Importar contactos (CSV)</h3>
              <button onClick={() => { setShowImport(false); setImportResult(null); setCsvText(''); }} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: 12 }}>Formato: nombre, email, whatsapp, empresa, giro, sucursales, plan_interes</p>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder={'nombre,email,whatsapp,empresa,giro,sucursales,plan\nJuan Pérez,juan@email.com,5551234567,Tienda X,Moda y ropa,3,controla'}
              rows={10}
              style={{ width: '100%', padding: 12, fontSize: '0.8125rem', border: '1px solid #e0e0e0', borderRadius: 8, fontFamily: 'monospace', boxSizing: 'border-box' as const, resize: 'vertical' }}
            />
            {importResult && (
              <div style={{ marginTop: 12, padding: 12, background: '#f8f9fb', borderRadius: 8, fontSize: '0.8125rem' }}>
                <div>Creados: <strong style={{ color: '#2AB5A0' }}>{importResult.created}</strong></div>
                <div>Omitidos (duplicados): <strong>{importResult.skipped}</strong></div>
                {importResult.errors?.length > 0 && <div style={{ color: '#E54B4B', marginTop: 4 }}>Errores: {importResult.errors.join(', ')}</div>}
              </div>
            )}
            <button
              onClick={async () => {
                setImporting(true);
                const res = await fetch('/api/crm/contacts/import', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ csv: csvText }),
                });
                const result = await res.json();
                setImportResult(result);
                setImporting(false);
                load();
              }}
              disabled={importing || !csvText.trim()}
              style={{ ...btn, background: '#1a1a1a', color: '#fff', width: '100%', marginTop: 12, justifyContent: 'center' }}
            >
              {importing ? 'Importando...' : 'Importar'}
            </button>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}

// ─── Activity helpers ───
function activityColor(tipo: string): string {
  const colors: Record<string, string> = {
    nota: '#4B7BE5', llamada: '#6C5CE7', whatsapp_enviado: '#25D366', whatsapp_recibido: '#25D366',
    email_enviado: '#1565c0', email_recibido: '#1565c0', demo_agendada: '#E8A838', demo_realizada: '#F39C12',
    cotizacion_creada: '#2AB5A0', cotizacion_enviada: '#2AB5A0', cotizacion_vista: '#6C5CE7',
    cotizacion_aceptada: '#2e7d32', pago_recibido: '#2e7d32', stage_change: '#E8A838',
    lead_created: '#4B7BE5', sistema: '#ccc',
  };
  return colors[tipo] || '#ccc';
}

function activityLabel(tipo: string): string {
  const labels: Record<string, string> = {
    nota: 'Nota', llamada: 'Llamada', whatsapp_enviado: 'WhatsApp enviado', whatsapp_recibido: 'WhatsApp recibido',
    email_enviado: 'Email enviado', email_recibido: 'Email recibido', demo_agendada: 'Demo agendada', demo_realizada: 'Demo realizada',
    cotizacion_creada: 'Cotización creada', cotizacion_enviada: 'Cotización enviada', cotizacion_vista: 'Cotización vista',
    cotizacion_aceptada: 'Cotización aceptada', pago_recibido: 'Pago recibido', stage_change: 'Cambio de etapa',
    lead_created: 'Lead creado', form_submitted: 'Formulario enviado', sistema: 'Sistema',
  };
  return labels[tipo] || tipo;
}

// ─── Sub-components ───
function TableView({ contacts, onSelect, onBulk }: { contacts: Contact[]; onSelect: (c: Contact) => void; onBulk?: (ids: string[], patch: Record<string, any>, msg: string) => void | Promise<void> }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allChecked = contacts.length > 0 && contacts.every(c => sel.has(c.id));
  const toggleAll = () => setSel(allChecked ? new Set() : new Set(contacts.map(c => c.id)));
  const ids = [...sel];
  const runBulk = async (patch: Record<string, any>, msg: string) => { if (onBulk) await onBulk(ids, patch, msg); setSel(new Set()); };

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
      {ids.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#1a1a1a', color: '#fff', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{ids.length} seleccionados</span>
          <button onClick={() => runBulk({ next_followup: new Date().toISOString().slice(0, 10) }, `${ids.length} agendados para hoy`)} style={{ ...bulkBtn }}>📅 Seguir hoy</button>
          <button onClick={() => runBulk({ lifecycle_stage: 'lead_calificado' }, `${ids.length} marcados MQL`)} style={{ ...bulkBtn }}>⭐ Marcar MQL</button>
          <button onClick={() => { if (confirm(`¿Marcar ${ids.length} como churned?`)) runBulk({ tipo: 'churned', lifecycle_stage: 'churned' }, `${ids.length} marcados churned`); }} style={{ ...bulkBtn, background: '#b93333' }}>✕ Churned</button>
          <button onClick={() => setSel(new Set())} style={{ ...bulkBtn, background: 'transparent', border: '1px solid #555' }}>Cancelar</button>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 8px 10px 14px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
              {['Fecha', 'Nombre', 'Empresa', 'Giro', 'WhatsApp', 'Email', 'Etapa', 'Tipo', 'Plan', 'Score'].map(h =>
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#aaa', background: '#fafafa', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' }}>{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {contacts.map(c => {
              const stageInfo = LIFECYCLE_STAGES.find(s => s.id === c.lifecycle_stage);
              return (
                <tr key={c.id} onClick={() => onSelect(c)} style={{ cursor: 'pointer', borderBottom: '1px solid #f8f8f8', background: sel.has(c.id) ? '#f5f8ff' : undefined }}>
                  <td style={{ ...td, cursor: 'default' }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} /></td>
                  <td style={td}>{fmtDate(c.created_at)}</td>
                  <td style={{ ...td, fontWeight: 700, color: '#1a1a1a' }}>{c.nombre}</td>
                  <td style={td}>{c.companies?.nombre || '—'}</td>
                  <td style={td}>{c.giro || '—'}</td>
                  <td style={td}>{c.whatsapp ? <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" style={{ color: '#2AB5A0', textDecoration: 'none', fontWeight: 600 }} onClick={e => e.stopPropagation()}>{c.whatsapp}</a> : '—'}</td>
                  <td style={td}>{c.email || '—'}</td>
                  <td style={td}><span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (stageInfo?.color || '#ccc') + '18', color: stageInfo?.color }}>{stageInfo?.label}</span></td>
                  <td style={td}><span style={{ fontSize: '0.625rem', color: '#888' }}>{c.tipo}</span></td>
                  <td style={td}>{c.plan_interes || c.companies?.plan || '—'}</td>
                  <td style={td}><span style={{ fontWeight: 700, color: c.lead_score >= 70 ? '#2e7d32' : c.lead_score >= 40 ? '#E8A838' : '#ccc' }}>{c.lead_score || '—'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{ fontSize: '0.625rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ color: '#333', fontWeight: 500 }}>{value || '—'}</div>
    </div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, marginTop: 12, ...style }}>{children}</div>;
}

// Shared styles
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', fontWeight: 600, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' };
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: '0.8125rem', border: '1px solid #e0e0e0', borderRadius: 8, outline: 'none', fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' as const };
const td: React.CSSProperties = { padding: '10px 14px', color: '#555' };
const bulkBtn: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, padding: '5px 10px', borderRadius: 7, border: 'none', background: '#333', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' };
