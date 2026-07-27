// Kanban reutilizable por etapa de pipeline. Columnas = etapas del pipeline;
// tarjetas = registros agrupados por su pipeline_stage. Drag & drop nativo (mouse)
// → onMove(id, stageKey). En TOUCH el drag HTML5 no dispara, así que cada tarjeta
// tiene un botón "⇄ Mover" que abre un ActionSheet con las etapas. Los que no
// tienen etapa (o una borrada) caen en "Sin etapa".
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useIsMobile } from '../../../lib/ui/mobile';
import ActionSheet from './ui/ActionSheet';

type KStage = { key: string; label: string; color: string };

export default function PipelineKanban({ stages, items, getId, getStage, onMove, renderCard, emptyLabel = 'Sin etapa', colValue }: {
  stages: KStage[];
  items: any[];
  getId: (t: any) => string;
  getStage: (t: any) => string | null | undefined;
  onMove: (id: string, stageKey: string) => void;
  renderCard: (t: any) => ReactNode;
  emptyLabel?: string;
  // Valor agregado a mostrar bajo el conteo de cada columna (ej. suma de ARR).
  colValue?: (its: any[]) => string;
}) {
  const isMobile = useIsMobile();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [moveItem, setMoveItem] = useState<any | null>(null); // tarjeta cuyo ActionSheet "Mover a…" está abierto
  const keys = new Set(stages.map(s => s.key));
  const sinEtapa = items.filter(it => { const k = getStage(it); return !k || !keys.has(k); });
  const colW = isMobile ? '85vw' : 244;

  const Col = ({ st, its, droppable }: { st: { key: string; label: string; color?: string }; its: any[]; droppable: boolean }) => (
    <div
      onDragOver={droppable ? (e => { e.preventDefault(); setOver(st.key); }) : undefined}
      onDragLeave={() => setOver(o => (o === st.key ? null : o))}
      onDrop={droppable ? (() => { if (drag) onMove(drag, st.key); setDrag(null); setOver(null); }) : undefined}
      style={{ minWidth: colW, width: colW, flexShrink: 0, scrollSnapAlign: isMobile ? 'start' : undefined, background: over === st.key ? '#eef4ff' : droppable ? '#f7f8fa' : '#fafafa', borderRadius: 10, padding: 8, border: (droppable ? '1px solid ' : '1px dashed ') + (over === st.key ? '#c3d7ff' : '#e8e8e8') }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px', fontWeight: 700, fontSize: '0.8rem', color: droppable ? '#333' : '#999' }}>
        {st.color ? <span style={{ width: 9, height: 9, borderRadius: 3, background: st.color, display: 'inline-block' }} /> : null}
        {st.label}
        <span style={{ marginLeft: 'auto', color: '#aaa', fontWeight: 600 }}>{its.length}</span>
      </div>
      {colValue && droppable ? <div style={{ padding: '0 6px 10px', fontSize: '0.72rem', fontWeight: 800, color: st.color || '#555' }}>{colValue(its)}</div> : <div style={{ height: 6 }} />}
      {its.map(it => (
        <div key={getId(it)} draggable={!isMobile} onDragStart={() => setDrag(getId(it))} onDragEnd={() => { setDrag(null); setOver(null); }}
          style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 8, padding: 10, marginBottom: 8, cursor: isMobile ? 'default' : 'grab', boxShadow: drag === getId(it) ? '0 4px 14px rgba(0,0,0,0.14)' : 'none' }}>
          {renderCard(it)}
          <button onClick={(e) => { e.stopPropagation(); setMoveItem(it); }}
            style={{ marginTop: 8, width: '100%', minHeight: isMobile ? 40 : 30, border: '1px solid #e6e8ee', borderRadius: 8, background: '#fbfbfd', color: '#555', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
            ⇄ Mover
          </button>
        </div>
      ))}
      {!its.length && <div style={{ padding: 12, textAlign: 'center', color: '#ccc', fontSize: '0.72rem' }}>—</div>}
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollSnapType: isMobile ? 'x mandatory' : undefined, WebkitOverflowScrolling: 'touch' }}>
        {stages.map(st => <Col key={st.key} st={st} its={items.filter(it => getStage(it) === st.key)} droppable />)}
        {sinEtapa.length > 0 && <Col st={{ key: '__none__', label: emptyLabel }} its={sinEtapa} droppable={false} />}
      </div>
      <ActionSheet
        open={!!moveItem}
        onClose={() => setMoveItem(null)}
        title="Mover a…"
        items={stages.map(st => ({
          label: st.label,
          icon: <span style={{ width: 10, height: 10, borderRadius: 3, background: st.color, display: 'inline-block' }} />,
          active: moveItem ? getStage(moveItem) === st.key : false,
          onClick: () => { if (moveItem) onMove(getId(moveItem), st.key); },
        }))}
      />
    </>
  );
}
