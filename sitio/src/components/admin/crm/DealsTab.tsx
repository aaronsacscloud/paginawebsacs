import { useState, useEffect, useRef } from 'react';
import { useToast, Toast, logStageChange, SlaBadge, ActivityChips, KanbanSkeleton } from './crmHelpers';

// ─── Types ───
interface Deal {
  id: string; created_at: string; updated_at: string;
  nombre: string; contact_id: string; company_id: string | null;
  plan: string | null; sucursales: number; billing_period: string | null;
  valor_mensual: number; valor_total: number;
  stage: string; stage_changed_at: string; probabilidad: number;
  motivo_perdida: string | null; competidor: string | null;
  fecha_cierre_esperada: string | null; closed_at: string | null;
  days_in_pipeline: number | null; quote_id: string | null;
  owner_id: string | null; archived_at: string | null;
  contacts: { id: string; nombre: string; email: string | null; whatsapp: string | null } | null;
  companies: { id: string; nombre: string; plan: string | null } | null;
}

interface ContactOption {
  id: string; nombre: string; email: string | null; whatsapp: string | null;
  company_id: string | null;
  companies: { id: string; nombre: string } | null;
}

interface Activity {
  id: string; created_at: string; tipo: string; titulo: string | null;
  descripcion: string | null; metadata: any; automatico: boolean;
}

// ─── Constants ───
// STAGES es mutable: por defecto trae el pipeline base y se REEMPLAZA con el
// pipeline "oportunidad" configurable al montar (Configuración → Pipelines).
let STAGES: { id: string; label: string; prob: number; color: string }[] = [
  { id: 'calificacion', label: 'Calificación', prob: 20, color: '#6C5CE7' },
  { id: 'demo_agendada', label: 'Demo agendada', prob: 40, color: '#4B7BE5' },
  { id: 'demo_realizada', label: 'Demo realizada', prob: 60, color: '#E8A838' },
  { id: 'cotizacion_enviada', label: 'Cotización enviada', prob: 70, color: '#F39C12' },
  { id: 'negociacion', label: 'Negociación', prob: 80, color: '#2AB5A0' },
  { id: 'cerrada_ganada', label: 'Cerrada ganada', prob: 100, color: '#2e7d32' },
  { id: 'cerrada_perdida', label: 'Cerrada perdida', prob: 0, color: '#999' },
];

const PLAN_PRICES: Record<string, number> = { vende: 600, controla: 900, fideliza: 1400, automatiza: 5900 };

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const date = new Date(d.length === 10 ? d + 'T12:00:00' : d);
  if (isNaN(date.getTime())) return '—';
  return `${date.getDate()}/${date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}/${date.getFullYear()}`;
};
const stageColor = (s: string) => STAGES.find(st => st.id === s)?.color || '#ccc';
const stageLabel = (s: string) => STAGES.find(st => st.id === s)?.label || s;

// Etapas de cierre detectadas por KEY (robusto a que renombren el label). Las
// keys del pipeline oportunidad conservan 'ganad'/'perdid'. La conversión a
// cliente + comisión en el server (deals.ts) también se dispara con esas keys.
const isWonKey = (k: string) => /ganad/i.test(k);
const isLostKey = (k: string) => /perdid/i.test(k);
const isClosedKey = (k: string) => isWonKey(k) || isLostKey(k);
function probFor(key: string, arr: { key: string }[]): number {
  if (isWonKey(key)) return 100;
  if (isLostKey(key)) return 0;
  const opens = arr.filter(s => !isClosedKey(s.key));
  const pos = opens.findIndex(s => s.key === key);
  return pos >= 0 ? Math.min(95, Math.round((pos + 1) / (opens.length + 1) * 100)) : 50;
}

// ─── Activity helpers ───
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
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: '0.8125rem', border: '1px solid #e0e0e0', borderRadius: 8, outline: 'none', fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' as const };
const td: React.CSSProperties = { padding: '10px 14px', color: '#555' };
const dealBulkBtn: React.CSSProperties = { fontSize: '0.72rem', fontWeight: 700, padding: '5px 10px', borderRadius: 7, border: 'none', background: '#b93333', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' };

// ─── Main Component ───
export default function DealsTab({ onConfig }: { onConfig?: () => void } = {}) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Deal | null>(null);
  const [, forceRender] = useState(0);
  const { toast, show } = useToast();

  // Reemplaza STAGES con el pipeline "oportunidad" configurable (si existe).
  useEffect(() => {
    fetch('/api/crm/pipelines').then(r => r.json()).then(j => {
      const op = (j.data || []).find((p: any) => p.tipo === 'oportunidad');
      if (op?.stages?.length) {
        STAGES = op.stages.map((s: any) => ({ id: s.key, label: s.label, color: s.color, prob: probFor(s.key, op.stages) }));
        forceRender(x => x + 1);
      }
    }).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/crm/deals');
    const data = await res.json();
    setDeals(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const moveStage = async (deal: Deal, newStage: string) => {
    if (deal.stage === newStage) return;
    const prob = STAGES.find(s => s.id === newStage)?.prob ?? deal.probabilidad;
    const updates: Record<string, any> = { id: deal.id, stage: newStage, probabilidad: prob };
    if (isClosedKey(newStage)) {
      updates.closed_at = new Date().toISOString();
    }
    // Optimista: refleja el movimiento de inmediato en el kanban.
    setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, stage: newStage, probabilidad: prob } : d));
    await fetch('/api/crm/deals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const toLabel = stageLabel(newStage);
    logStageChange({ deal_id: deal.id, contact_id: deal.contact_id, company_id: deal.company_id, fromLabel: stageLabel(deal.stage), toLabel });
    show(isWonKey(newStage) ? '🎉 Oportunidad ganada — convertida en cliente' : `Movida a ${toLabel}`);
    load();
  };

  // Acciones en lote sobre oportunidades seleccionadas en la tabla.
  const bulkUpdate = async (ids: string[], patch: Record<string, any>, msg: string) => {
    await Promise.all(ids.map(id => fetch('/api/crm/deals', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }),
    })));
    await load();
    show(msg);
  };

  // Stats
  const openDeals = deals.filter(d => !isClosedKey(d.stage));
  const totalPipeline = openDeals.reduce((s, d) => s + d.valor_total, 0);
  const weightedValue = openDeals.reduce((s, d) => s + d.valor_total * (d.probabilidad / 100), 0);
  const won = deals.filter(d => isWonKey(d.stage));
  const lost = deals.filter(d => isLostKey(d.stage));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Top stats bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', background: '#fff', borderBottom: '1px solid #f0f0f0', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', overflowX: 'auto' }}>
          {[
            { l: 'Abiertos', v: String(openDeals.length), c: '#4B7BE5' },
            { l: 'Pipeline', v: fmt(totalPipeline), c: '#6C5CE7' },
            { l: 'Ponderado', v: fmt(weightedValue), c: '#2AB5A0' },
            { l: 'Ganados', v: String(won.length), c: '#2e7d32' },
            { l: 'Perdidos', v: String(lost.length), c: '#999' },
          ].map(s => (
            <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: s.c }}>{s.v}</span>
              <span style={{ fontSize: '0.625rem', color: '#999', fontWeight: 500 }}>{s.l}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowCreate(true)} style={{ ...btn, background: '#1a1a1a', color: '#fff' }}>+ Nuevo deal</button>
          <button onClick={() => setView(view === 'kanban' ? 'table' : 'kanban')} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>
            {view === 'kanban' ? '☰ Tabla' : '▦ Kanban'}
          </button>
          <button onClick={() => onConfig?.()} title="Configurar etapas del pipeline de Oportunidades" style={{ ...btn, background: '#f5f5f5', color: '#555' }}>⚙️ Etapas</button>
          <button onClick={load} style={{ ...btn, background: '#f5f5f5', color: '#555' }}>↻</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '16px 24px', overflow: 'auto' }}>
        {loading ? (
          <KanbanSkeleton cols={5} />
        ) : view === 'kanban' ? (
          <KanbanView deals={deals} onSelect={setSelected} onMove={moveStage} />
        ) : (
          <TableView deals={deals} onSelect={setSelected} onBulk={bulkUpdate} />
        )}
      </div>

      {/* Create Modal */}
      {showCreate && <CreateDealModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}

      {/* Detail Drawer */}
      {selected && (
        <DealDrawer
          deal={selected}
          onClose={() => setSelected(null)}
          onSaved={() => { load(); }}
          onRefresh={async (id: string) => {
            const res = await fetch('/api/crm/deals');
            const data = await res.json();
            const updated = (Array.isArray(data) ? data : []).find((d: Deal) => d.id === id);
            if (updated) setSelected(updated);
          }}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}

// ─── Kanban View ───
function KanbanView({ deals, onSelect, onMove }: { deals: Deal[]; onSelect: (d: Deal) => void; onMove: (d: Deal, s: string) => void }) {
  const openStages = STAGES.filter(s => !isClosedKey(s.id));
  const closedStages = STAGES.filter(s => isClosedKey(s.id));
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const drop = (stageId: string) => { if (drag) { const d = deals.find(x => x.id === drag); if (d) onMove(d, stageId); } setDrag(null); setOver(null); };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', minHeight: 400, paddingBottom: 16 }}>
        {openStages.map(stage => {
          const items = deals.filter(d => d.stage === stage.id);
          const stageTotal = items.reduce((s, d) => s + d.valor_total, 0);
          return (
            <div key={stage.id} style={{ minWidth: 220, flex: '1 0 220px', display: 'flex', flexDirection: 'column' }}
              onDragOver={e => { e.preventDefault(); setOver(stage.id); }}
              onDragLeave={() => setOver(o => o === stage.id ? null : o)}
              onDrop={() => drop(stage.id)}>
              <div style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{stage.label}</span>
                  <span style={{ fontSize: '0.6875rem', color: '#bbb', fontWeight: 600 }}>{items.length}</span>
                </div>
                {stageTotal > 0 && <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: stage.color }}>{fmt(stageTotal)}</span>}
              </div>
              <div style={{ flex: 1, background: over === stage.id ? '#eef4ff' : '#f0f1f3', borderRadius: 10, padding: 6, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 80, border: over === stage.id ? '1px solid #c3d7ff' : '1px solid transparent', transition: 'background 0.12s' }}>
                {items.map(deal => (
                  <DealCard key={deal.id} deal={deal} onSelect={onSelect} onMove={onMove}
                    dragging={drag === deal.id} onDragStart={() => setDrag(deal.id)} onDragEnd={() => { setDrag(null); setOver(null); }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Closed deals row */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        {closedStages.map(stage => {
          const items = deals.filter(d => d.stage === stage.id);
          return (
            <div key={stage.id} style={{ flex: 1 }}>
              <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.color }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{stage.label}</span>
                <span style={{ fontSize: '0.6875rem', color: '#bbb', fontWeight: 600 }}>{items.length}</span>
              </div>
              <div style={{ background: '#f0f1f3', borderRadius: 10, padding: 6, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 40 }}>
                {items.slice(0, 5).map(deal => (
                  <div key={deal.id} onClick={() => onSelect(deal)} style={{ background: '#fff', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{deal.nombre}</span>
                      <span style={{ fontSize: '0.6875rem', color: '#999', marginLeft: 8 }}>{deal.contacts?.nombre}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: stage.color, fontSize: '0.8125rem' }}>{fmt(deal.valor_total)}</span>
                  </div>
                ))}
                {items.length > 5 && <div style={{ fontSize: '0.6875rem', color: '#999', textAlign: 'center', padding: 4 }}>+{items.length - 5} más</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({ deal, onSelect, onMove, dragging, onDragStart, onDragEnd }: { deal: Deal; onSelect: (d: Deal) => void; onMove: (d: Deal, s: string) => void; dragging?: boolean; onDragStart?: () => void; onDragEnd?: () => void }) {
  const currentIdx = STAGES.findIndex(s => s.id === deal.stage);
  const nextStages = STAGES.filter((s, i) => s.id !== deal.stage && i >= currentIdx - 1 && i <= currentIdx + 2 && !isLostKey(s.id)).slice(0, 3);
  // SLA: días en la etapa actual (o en el pipeline si no hay marca de etapa).
  const since = deal.stage_changed_at || deal.created_at;

  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      onClick={() => onSelect(deal)} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'grab', boxShadow: dragging ? '0 4px 14px rgba(0,0,0,0.14)' : '0 1px 3px rgba(0,0,0,0.06)', fontSize: '0.8125rem', opacity: dragging ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ fontWeight: 700, color: '#1a1a1a', marginBottom: 2, flex: 1, minWidth: 0 }}>{deal.nombre}</div>
        <SlaBadge since={since} umbralAmbar={10} umbralRojo={30} label="en etapa" />
      </div>
      <div style={{ fontSize: '0.6875rem', color: '#999' }}>
        {deal.companies?.nombre || ''}{deal.contacts?.nombre ? ` · ${deal.contacts.nombre}` : ''}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1a1a1a' }}>{fmt(deal.valor_total)}</span>
        <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: stageColor(deal.stage) + '18', color: stageColor(deal.stage) }}>
          {deal.probabilidad}%
        </span>
      </div>
      {/* Quick move buttons (además del drag & drop) */}
      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' as const }}>
        {nextStages.map(s => (
          <button key={s.id} onClick={e => { e.stopPropagation(); onMove(deal, s.id); }}
            style={{ fontSize: '0.5rem', padding: '2px 5px', borderRadius: 4, border: '1px solid #e0e0e0', background: '#fafafa', color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>
            → {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Table View ───
function TableView({ deals, onSelect, onBulk }: { deals: Deal[]; onSelect: (d: Deal) => void; onBulk?: (ids: string[], patch: Record<string, any>, msg: string) => void | Promise<void> }) {
  const [sortCol, setSortCol] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const ids = [...sel];
  const lostStage = STAGES.find(s => isLostKey(s.id))?.id;
  const runBulk = async (patch: Record<string, any>, msg: string) => { if (onBulk) await onBulk(ids, patch, msg); setSel(new Set()); };

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sorted = [...deals].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortCol) {
      case 'created_at': return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'nombre': return dir * a.nombre.localeCompare(b.nombre);
      case 'empresa': return dir * ((a.companies?.nombre || '').localeCompare(b.companies?.nombre || ''));
      case 'contacto': return dir * ((a.contacts?.nombre || '').localeCompare(b.contacts?.nombre || ''));
      case 'plan': return dir * ((a.plan || '').localeCompare(b.plan || ''));
      case 'valor_total': return dir * (a.valor_total - b.valor_total);
      case 'stage': return dir * a.stage.localeCompare(b.stage);
      case 'probabilidad': return dir * (a.probabilidad - b.probabilidad);
      default: return 0;
    }
  });

  const cols = [
    { key: 'created_at', label: 'Fecha' },
    { key: 'nombre', label: 'Deal' },
    { key: 'empresa', label: 'Empresa' },
    { key: 'contacto', label: 'Contacto' },
    { key: 'plan', label: 'Plan' },
    { key: 'valor_total', label: 'Valor' },
    { key: 'stage', label: 'Stage' },
    { key: 'probabilidad', label: 'Prob.' },
  ];

  const allChecked = sorted.length > 0 && sorted.every(d => sel.has(d.id));

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
      {ids.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#1a1a1a', color: '#fff', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{ids.length} seleccionados</span>
          {lostStage && <button onClick={() => { if (confirm(`¿Marcar ${ids.length} como perdidas?`)) runBulk({ stage: lostStage, probabilidad: 0, closed_at: new Date().toISOString() }, `${ids.length} marcadas perdidas`); }} style={dealBulkBtn}>✕ Marcar perdidas</button>}
          <button onClick={() => setSel(new Set())} style={{ ...dealBulkBtn, background: 'transparent', border: '1px solid #555' }}>Cancelar</button>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 8px 10px 14px', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}><input type="checkbox" checked={allChecked} onChange={() => setSel(allChecked ? new Set() : new Set(sorted.map(d => d.id)))} /></th>
              {cols.map(h =>
              <th key={h.key} onClick={() => toggleSort(h.key)} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: sortCol === h.key ? '#1a1a1a' : '#aaa', background: '#fafafa', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                {h.label} {sortCol === h.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
            )}</tr>
          </thead>
          <tbody>
            {sorted.map(d => (
              <tr key={d.id} onClick={() => onSelect(d)} style={{ cursor: 'pointer', borderBottom: '1px solid #f8f8f8', background: sel.has(d.id) ? '#f5f8ff' : undefined }}>
                <td style={{ ...td, cursor: 'default' }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.has(d.id)} onChange={() => toggle(d.id)} /></td>
                <td style={td}>{fmtDate(d.created_at)}</td>
                <td style={{ ...td, fontWeight: 700, color: '#1a1a1a' }}>{d.nombre}</td>
                <td style={td}>{d.companies?.nombre || '—'}</td>
                <td style={td}>{d.contacts?.nombre || '—'}</td>
                <td style={td}><span style={{ textTransform: 'capitalize' as const }}>{d.plan || '—'}</span></td>
                <td style={{ ...td, fontWeight: 700 }}>{fmt(d.valor_total)}</td>
                <td style={td}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: stageColor(d.stage) + '18', color: stageColor(d.stage) }}>{stageLabel(d.stage)}</span>
                </td>
                <td style={td}><span style={{ fontWeight: 600, color: stageColor(d.stage) }}>{d.probabilidad}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Create Deal Modal ───
function CreateDealModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nombre, setNombre] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<ContactOption[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [plan, setPlan] = useState('');
  const [sucursales, setSucursales] = useState(1);
  const [billingPeriod, setBillingPeriod] = useState('mensual');
  const [valorMensual, setValorMensual] = useState(0);
  const [valorTotal, setValorTotal] = useState(0);
  const [fechaCierre, setFechaCierre] = useState('');
  const [saving, setSaving] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-calc prices
  useEffect(() => {
    if (plan && PLAN_PRICES[plan]) {
      const vm = PLAN_PRICES[plan] * sucursales;
      setValorMensual(vm);
      setValorTotal(billingPeriod === 'anual' ? vm * 10 : vm);
    }
  }, [plan, sucursales, billingPeriod]);

  const searchContacts = (q: string) => {
    setContactSearch(q);
    setSelectedContact(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) { setContactResults([]); setShowDropdown(false); return; }
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/crm/contacts?search=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      setContactResults(data.contacts || []);
      setShowDropdown(true);
    }, 300);
  };

  const pickContact = (c: ContactOption) => {
    setSelectedContact(c);
    setContactSearch(c.nombre);
    setShowDropdown(false);
    if (!nombre) setNombre(c.companies?.nombre ? `${c.companies.nombre} – Deal` : `${c.nombre} – Deal`);
  };

  const submit = async () => {
    if (!nombre || !selectedContact) return;
    setSaving(true);
    await fetch('/api/crm/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        contact_id: selectedContact.id,
        company_id: selectedContact.company_id,
        plan: plan || null,
        sucursales,
        billing_period: billingPeriod,
        valor_mensual: valorMensual,
        valor_total: valorTotal,
        fecha_cierre_esperada: fechaCierre || null,
      }),
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, padding: 28, width: 480, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1a1a1a' }}>Nuevo Deal</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
        </div>

        <Label>Nombre del deal</Label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Restaurante Oaxaca – Fideliza" style={input} />

        <Label>Contacto</Label>
        <div style={{ position: 'relative' }}>
          <input value={contactSearch} onChange={e => searchContacts(e.target.value)} placeholder="Buscar contacto por nombre, email..." style={input} />
          {showDropdown && contactResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
              {contactResults.map(c => (
                <div key={c.id} onClick={() => pickContact(c)} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.8125rem', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{c.nombre}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#999' }}>{c.email || ''}{c.companies?.nombre ? ` · ${c.companies.nombre}` : ''}</div>
                </div>
              ))}
            </div>
          )}
          {selectedContact && (
            <div style={{ fontSize: '0.6875rem', color: '#2AB5A0', fontWeight: 600, marginTop: -4, marginBottom: 8 }}>
              Contacto seleccionado: {selectedContact.nombre}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <Label>Plan</Label>
            <select value={plan} onChange={e => setPlan(e.target.value)} style={input}>
              <option value="">Sin plan</option>
              <option value="vende">Vende ($600)</option>
              <option value="controla">Controla ($900)</option>
              <option value="fideliza">Fideliza ($1,400)</option>
              <option value="automatiza">Automatiza ($5,900)</option>
            </select>
          </div>
          <div>
            <Label>Sucursales</Label>
            <input type="number" min={1} value={sucursales} onChange={e => setSucursales(Math.max(1, parseInt(e.target.value) || 1))} style={input} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <Label>Periodo de facturación</Label>
            <select value={billingPeriod} onChange={e => setBillingPeriod(e.target.value)} style={input}>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual (10 meses)</option>
            </select>
          </div>
          <div>
            <Label>Fecha cierre esperada</Label>
            <input type="date" value={fechaCierre} onChange={e => setFechaCierre(e.target.value)} style={input} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          <div>
            <Label>Valor mensual</Label>
            <input type="number" value={valorMensual} onChange={e => { const v = parseFloat(e.target.value) || 0; setValorMensual(v); setValorTotal(billingPeriod === 'anual' ? v * 10 : v); }} style={input} />
          </div>
          <div>
            <Label>Valor total</Label>
            <input type="number" value={valorTotal} onChange={e => setValorTotal(parseFloat(e.target.value) || 0)} style={input} />
          </div>
        </div>

        <button onClick={submit} disabled={saving || !nombre || !selectedContact} style={{ ...btn, background: '#1a1a1a', color: '#fff', width: '100%', marginTop: 16, justifyContent: 'center', opacity: (!nombre || !selectedContact) ? 0.5 : 1 }}>
          {saving ? 'Creando...' : 'Crear deal'}
        </button>
      </div>
    </div>
  );
}

// ─── Deal Drawer ───
function DealDrawer({ deal, onClose, onSaved, onRefresh }: { deal: Deal; onClose: () => void; onSaved: () => void; onRefresh: (id: string) => void }) {
  const [editStage, setEditStage] = useState(deal.stage);
  const [editPlan, setEditPlan] = useState(deal.plan || '');
  const [editValorMensual, setEditValorMensual] = useState(deal.valor_mensual);
  const [editValorTotal, setEditValorTotal] = useState(deal.valor_total);
  const [editFechaCierre, setEditFechaCierre] = useState(deal.fecha_cierre_esperada || '');
  const [editMotivoPerdida, setEditMotivoPerdida] = useState(deal.motivo_perdida || '');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditStage(deal.stage);
    setEditPlan(deal.plan || '');
    setEditValorMensual(deal.valor_mensual);
    setEditValorTotal(deal.valor_total);
    setEditFechaCierre(deal.fecha_cierre_esperada || '');
    setEditMotivoPerdida(deal.motivo_perdida || '');
    loadActivities();
  }, [deal.id]);

  const loadActivities = async () => {
    const res = await fetch(`/api/crm/activities?deal_id=${deal.id}&limit=30`);
    const data = await res.json();
    setActivities(Array.isArray(data) ? data : []);
  };

  const save = async () => {
    setSaving(true);
    const updates: Record<string, any> = {
      id: deal.id,
      stage: editStage,
      plan: editPlan || null,
      valor_mensual: editValorMensual,
      valor_total: editValorTotal,
      fecha_cierre_esperada: editFechaCierre || null,
      probabilidad: STAGES.find(s => s.id === editStage)?.prob ?? deal.probabilidad,
    };
    if (isLostKey(editStage)) {
      updates.motivo_perdida = editMotivoPerdida || null;
      updates.closed_at = deal.closed_at || new Date().toISOString();
    }
    if (isWonKey(editStage)) {
      updates.closed_at = deal.closed_at || new Date().toISOString();
    }
    await fetch('/api/crm/deals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setSaving(false);
    onSaved();
    onRefresh(deal.id);
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    await fetch('/api/crm/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: deal.contact_id,
        company_id: deal.company_id,
        deal_id: deal.id,
        tipo: 'nota',
        titulo: 'Nota',
        descripcion: noteText.trim(),
      }),
    });
    setNoteText('');
    await loadActivities();
    setSaving(false);
  };

  // Registro rápido de actividad (chips) ligado a esta oportunidad.
  const logQuick = async (tipo: string, label: string) => {
    await fetch('/api/crm/activities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: deal.contact_id, company_id: deal.company_id, deal_id: deal.id, tipo, titulo: label }),
    });
    await loadActivities();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{ width: 500, maxWidth: '90vw', background: '#fff', overflowY: 'auto', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1a1a1a' }}>{deal.nombre}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: stageColor(deal.stage) + '18', color: stageColor(deal.stage) }}>{stageLabel(deal.stage)}</span>
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f5f5f5', color: '#888' }}>{deal.probabilidad}%</span>
              {deal.days_in_pipeline != null && <span style={{ fontSize: '0.5625rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#f5f5f5', color: '#aaa' }}>{deal.days_in_pipeline}d en pipeline</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Deal fields */}
          <Label>Etapa</Label>
          <select value={editStage} onChange={e => setEditStage(e.target.value)} style={input}>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label} ({s.prob}%)</option>)}
          </select>

          {isLostKey(editStage) && (
            <>
              <Label>Motivo de pérdida</Label>
              <input value={editMotivoPerdida} onChange={e => setEditMotivoPerdida(e.target.value)} placeholder="¿Por qué se perdió?" style={input} />
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Label>Plan</Label>
              <select value={editPlan} onChange={e => setEditPlan(e.target.value)} style={input}>
                <option value="">Sin plan</option>
                <option value="vende">Vende</option>
                <option value="controla">Controla</option>
                <option value="fideliza">Fideliza</option>
                <option value="automatiza">Automatiza</option>
              </select>
            </div>
            <div>
              <Label>Fecha cierre esperada</Label>
              <input type="date" value={editFechaCierre} onChange={e => setEditFechaCierre(e.target.value)} style={input} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Label>Valor mensual</Label>
              <input type="number" value={editValorMensual} onChange={e => setEditValorMensual(parseFloat(e.target.value) || 0)} style={input} />
            </div>
            <div>
              <Label>Valor total</Label>
              <input type="number" value={editValorTotal} onChange={e => setEditValorTotal(parseFloat(e.target.value) || 0)} style={input} />
            </div>
          </div>

          <button onClick={save} disabled={saving} style={{ ...btn, background: '#1a1a1a', color: '#fff', width: '100%', marginTop: 8, justifyContent: 'center' }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>

          {/* Contact info */}
          {deal.contacts && (
            <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 12, marginTop: 20 }}>
              <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>Contacto</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1a1a1a' }}>{deal.contacts.nombre}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {deal.contacts.whatsapp && (
                  <a href={`https://wa.me/${deal.contacts.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" style={{ ...btn, background: '#e8f5e9', color: '#2e7d32', fontSize: '0.75rem', padding: '6px 10px', textDecoration: 'none' }}>WhatsApp</a>
                )}
                {deal.contacts.email && (
                  <a href={`mailto:${deal.contacts.email}`} style={{ ...btn, background: '#e3f2fd', color: '#1565c0', fontSize: '0.75rem', padding: '6px 10px', textDecoration: 'none' }}>Email</a>
                )}
              </div>
            </div>
          )}

          {/* Company info */}
          {deal.companies && (
            <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 12, marginTop: 12 }}>
              <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>Empresa</div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1a1a1a' }}>{deal.companies.nombre}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: '0.75rem' }}>
                {deal.companies.plan && <span style={{ color: '#4B7BE5', fontWeight: 600 }}>Plan: {deal.companies.plan}</span>}
              </div>
            </div>
          )}

          {/* Related quote */}
          {deal.quote_id && (
            <div style={{ marginTop: 12 }}>
              <a href={`/cotizacion/${deal.quote_id}`} target="_blank" rel="noopener" style={{ ...btn, background: '#f5f5f5', color: '#4B7BE5', textDecoration: 'none', width: '100%', justifyContent: 'center' }}>
                Ver cotización →
              </a>
            </div>
          )}

          {/* Registro rápido de actividad */}
          <Label style={{ marginTop: 20 }}>Registrar actividad</Label>
          <ActivityChips onLog={logQuick} disabled={saving} />

          {/* Add note */}
          <Label>Agregar nota</Label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Escribir nota..." style={{ ...input, flex: 1, marginBottom: 0 }}
              onKeyDown={e => { if (e.key === 'Enter') addNote(); }} />
            <button onClick={addNote} disabled={saving || !noteText.trim()} style={{ ...btn, background: '#4B7BE5', color: '#fff' }}>+</button>
          </div>

          {/* Activity Timeline */}
          <Label>Timeline</Label>
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
  );
}

// ─── Tiny helpers ───
function Label({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, marginTop: 12, ...s }}>{children}</div>;
}
