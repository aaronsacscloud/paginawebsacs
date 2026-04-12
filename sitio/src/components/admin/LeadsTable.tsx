import { useState, useEffect } from 'react';

interface Note { date: string; text: string; }

interface Lead {
  id: string; timestamp: string; nombre: string; empresa: string;
  giro: string; sucursales: string; whatsapp: string; email: string;
  paso: string; plan: string; score: number; totalTime: number;
  pagesVisited: string; pageCount: number; stage: string; arr: number;
  nextFollowup: string; lastContact: string; stageHistory: string; notes: Note[];
}

const STAGES = [
  { id: 'nuevo', label: 'Nuevo', color: '#6C5CE7' },
  { id: 'contactado', label: 'Contactado', color: '#4B7BE5' },
  { id: 'demo', label: 'Demo', color: '#E8A838' },
  { id: 'oportunidad', label: 'Oportunidad', color: '#F39C12' },
  { id: 'cliente', label: 'Cliente', color: '#2AB5A0' },
  { id: 'perdido', label: 'Perdido', color: '#999' },
];

const fmt = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;

export default function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'pipeline'|'table'>('pipeline');
  const [selected, setSelected] = useState<Lead|null>(null);
  const [editStage, setEditStage] = useState('');
  const [editArr, setEditArr] = useState('');
  const [editFollowup, setEditFollowup] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/get-leads');
    const data = await res.json();
    setLeads(data.leads || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDetail = (lead: Lead) => {
    setSelected(lead);
    setEditStage(lead.stage);
    setEditArr(String(lead.arr || ''));
    setEditFollowup(lead.nextFollowup || '');
    setEditPlan(lead.plan || '');
    setNoteText('');
  };

  const saveChanges = async () => {
    if (!selected) return;
    setSaving(true);
    await fetch('/api/update-lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: selected.id, stage: editStage,
        arr: editArr, nextFollowup: editFollowup, plan: editPlan,
      }),
    });
    // Notify TikTok when lead becomes a paying customer
    if (editStage === 'cliente' && selected.stage !== 'cliente') {
      await fetch('/api/track-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: selected.email, phone: selected.whatsapp,
          plan: editPlan || selected.plan || 'manual', amount: parseInt(editArr) || selected.arr || 0,
        }),
      }).catch(() => {});
    }
    await load();
    const updated = leads.find(l => l.id === selected.id);
    if (updated) openDetail({ ...updated, stage: editStage, arr: parseInt(editArr)||0, nextFollowup: editFollowup, plan: editPlan });
    setSaving(false);
  };

  const addNote = async () => {
    if (!selected || !noteText.trim()) return;
    setSaving(true);
    await fetch('/api/add-note', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: selected.id, note: noteText }),
    });
    setNoteText('');
    await load();
    setSaving(false);
  };

  const moveStage = async (lead: Lead, newStage: string) => {
    await fetch('/api/update-lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: lead.id, stage: newStage }),
    });
    // Notify TikTok when lead becomes a paying customer
    if (newStage === 'cliente') {
      await fetch('/api/track-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: lead.email, phone: lead.whatsapp,
          plan: lead.plan || 'manual', amount: lead.arr || 0,
        }),
      }).catch(() => {});
    }
    load();
  };

  // Stats
  const totalArr = leads.filter(l => l.stage === 'oportunidad').reduce((s, l) => s + (l.arr||0), 0);
  const clienteArr = leads.filter(l => l.stage === 'cliente').reduce((s, l) => s + (l.arr||0), 0);

  const S: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

  return (
    <div style={{ ...S, minHeight: '100vh', background: '#f5f6f8', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: "'Clash Display',sans-serif", fontSize: '1.25rem', fontWeight: 700 }}>Sacs</span>
          <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#4B7BE5', background: 'rgba(75,123,229,0.08)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>CRM</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setView(view === 'pipeline' ? 'table' : 'pipeline')} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>{view === 'pipeline' ? '☰ Tabla' : '▦ Pipeline'}</button>
          <button onClick={load} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>↻ Actualizar</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, padding: '16px 24px', overflowX: 'auto' }}>
        {[
          { l: 'Total', v: leads.length, c: '#4B7BE5' },
          { l: 'Oportunidades', v: leads.filter(l=>l.stage==='oportunidad').length, c: '#F39C12' },
          { l: 'Pipeline', v: fmt(totalArr) + '/año', c: '#E8A838' },
          { l: 'Clientes', v: leads.filter(l=>l.stage==='cliente').length, c: '#2AB5A0' },
          { l: 'ARR Clientes', v: fmt(clienteArr) + '/año', c: '#2AB5A0' },
        ].map(s => (
          <div key={s.l} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', minWidth: 120, border: '1px solid #f0f0f0', flex: '1 0 auto' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: '0.6875rem', color: '#999', fontWeight: 500, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '0 24px 24px', overflow: 'auto' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>Cargando...</div> :
          view === 'pipeline' ? <PipelineView leads={leads} onSelect={openDetail} onMove={moveStage} /> :
          <TableView leads={leads} onSelect={openDetail} />
        }
      </div>

      {/* Detail Panel */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSelected(null)} style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{ width: 420, maxWidth: '90vw', background: '#fff', overflowY: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1a1a1a' }}>{selected.nombre || 'Sin nombre'}</div>
                <div style={{ fontSize: '0.8125rem', color: '#999' }}>{selected.empresa}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* Stage */}
              <Label>Etapa</Label>
              <select value={editStage} onChange={e => setEditStage(e.target.value)} style={input}>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>

              {/* Contact */}
              <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
                {selected.whatsapp && <a href={`https://wa.me/52${selected.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener" style={{ ...btn, background: '#e8f5e9', color: '#2e7d32', flex: 1, textAlign: 'center' as const, textDecoration: 'none' }}>WhatsApp</a>}
                {selected.email && <a href={`mailto:${selected.email}`} style={{ ...btn, background: '#e3f2fd', color: '#1565c0', flex: 1, textAlign: 'center' as const, textDecoration: 'none' }}>Email</a>}
              </div>

              {/* Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.8125rem', marginBottom: 16 }}>
                <InfoRow label="Email" value={selected.email} />
                <InfoRow label="WhatsApp" value={selected.whatsapp} />
                <InfoRow label="Giro" value={selected.giro} />
                <InfoRow label="Sucursales" value={selected.sucursales} />
                <InfoRow label="Score" value={`${selected.score}/100`} />
                <InfoRow label="Tiempo en sitio" value={selected.totalTime > 60 ? `${Math.floor(selected.totalTime/60)}m` : `${selected.totalTime}s`} />
              </div>

              {/* ARR & Plan */}
              <Label>Plan</Label>
              <select value={editPlan} onChange={e => setEditPlan(e.target.value)} style={input}>
                <option value="">Sin plan</option>
                <option value="vende">Vende</option>
                <option value="controla">Controla</option>
                <option value="fideliza">Fideliza</option>
                <option value="automatiza">Automatiza</option>
              </select>

              <Label>ARR (MXN/año)</Label>
              <input type="number" value={editArr} onChange={e => setEditArr(e.target.value)} placeholder="ej. 14400" style={input} />

              <Label>Próximo seguimiento</Label>
              <input type="date" value={editFollowup} onChange={e => setEditFollowup(e.target.value)} style={input} />

              <button onClick={saveChanges} disabled={saving} style={{ ...btn, background: '#1a1a1a', color: '#fff', width: '100%', marginTop: 12, justifyContent: 'center' }}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>

              {/* Pages visited */}
              {selected.pagesVisited && (
                <>
                  <Label style={{ marginTop: 20 }}>Páginas visitadas ({selected.pageCount})</Label>
                  <div style={{ fontSize: '0.75rem', color: '#888', lineHeight: 1.6 }}>{selected.pagesVisited}</div>
                </>
              )}

              {/* Notes */}
              <Label style={{ marginTop: 20 }}>Notas</Label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Agregar nota..." style={{ ...input, flex: 1, marginBottom: 0 }}
                  onKeyDown={e => { if (e.key === 'Enter') addNote(); }} />
                <button onClick={addNote} disabled={saving || !noteText.trim()} style={{ ...btn, background: '#4B7BE5', color: '#fff' }}>+</button>
              </div>
              {selected.notes?.length > 0 ? selected.notes.slice().reverse().map((n, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#aaa', fontSize: '0.6875rem' }}>{n.date}</span>
                  <div style={{ color: '#333', marginTop: 2 }}>{n.text}</div>
                </div>
              )) : <div style={{ color: '#ccc', fontSize: '0.8125rem' }}>Sin notas</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components
function PipelineView({ leads, onSelect, onMove }: { leads: Lead[]; onSelect: (l: Lead) => void; onMove: (l: Lead, s: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', minHeight: 400, paddingBottom: 16 }}>
      {STAGES.map(stage => {
        const items = leads.filter(l => l.stage === stage.id);
        const stageArr = items.reduce((s, l) => s + (l.arr||0), 0);
        return (
          <div key={stage.id} style={{ minWidth: 220, flex: '1 0 220px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{stage.label}</span>
                <span style={{ fontSize: '0.6875rem', color: '#bbb', fontWeight: 600 }}>{items.length}</span>
              </div>
              {stageArr > 0 && <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: stage.color }}>{fmt(stageArr)}</span>}
            </div>
            <div style={{ flex: 1, background: '#f0f1f3', borderRadius: 10, padding: 6, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 100 }}>
              {items.map(lead => (
                <div key={lead.id} onClick={() => onSelect(lead)} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'box-shadow 0.15s', fontSize: '0.8125rem' }}>
                  <div style={{ fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>{lead.nombre || lead.email}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#999' }}>{lead.empresa}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: '0.625rem', fontWeight: 600, color: lead.score >= 70 ? '#2e7d32' : lead.score >= 40 ? '#E8A838' : '#ccc' }}>{lead.score > 0 ? `${lead.score}pts` : ''}</span>
                    {lead.arr > 0 && <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#F39C12' }}>{fmt(lead.arr)}/año</span>}
                  </div>
                  {/* Quick move buttons */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' as const }}>
                    {STAGES.filter(s => s.id !== lead.stage).slice(0, 3).map(s => (
                      <button key={s.id} onClick={(e) => { e.stopPropagation(); onMove(lead, s.id); }}
                        style={{ fontSize: '0.5625rem', padding: '2px 6px', borderRadius: 4, border: '1px solid #e0e0e0', background: '#fafafa', color: '#888', cursor: 'pointer' }}>
                        → {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableView({ leads, onSelect }: { leads: Lead[]; onSelect: (l: Lead) => void }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr>{['Fecha','Nombre','Empresa','Giro','Suc.','WhatsApp','Email','Etapa','Plan','ARR','Score'].map(h =>
              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#aaa', background: '#fafafa', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' }}>{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {leads.map(l => (
              <tr key={l.id} onClick={() => onSelect(l)} style={{ cursor: 'pointer', borderBottom: '1px solid #f8f8f8' }}>
                <td style={td}>{new Date(l.timestamp).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</td>
                <td style={{ ...td, fontWeight: 700, color: '#1a1a1a' }}>{l.nombre}</td>
                <td style={td}>{l.empresa}</td>
                <td style={td}>{l.giro}</td>
                <td style={td}>{l.sucursales}</td>
                <td style={td}><a href={`https://wa.me/52${(l.whatsapp||'').replace(/\D/g,'')}`} target="_blank" rel="noopener" style={{ color: '#2AB5A0', textDecoration: 'none', fontWeight: 600 }} onClick={e => e.stopPropagation()}>{l.whatsapp}</a></td>
                <td style={td}>{l.email}</td>
                <td style={td}><span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: STAGES.find(s=>s.id===l.stage)?.color+'18', color: STAGES.find(s=>s.id===l.stage)?.color }}>{STAGES.find(s=>s.id===l.stage)?.label}</span></td>
                <td style={td}>{l.plan || '-'}</td>
                <td style={td}>{l.arr > 0 ? fmt(l.arr) : '-'}</td>
                <td style={td}><span style={{ fontWeight: 700, color: l.score >= 70 ? '#2e7d32' : l.score >= 40 ? '#E8A838' : '#ccc' }}>{l.score}</span></td>
              </tr>
            ))}
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
      <div style={{ color: '#333', fontWeight: 500 }}>{value || '-'}</div>
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
