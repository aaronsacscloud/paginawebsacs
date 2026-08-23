// WHATSAPP · El rail izquierdo: filtros con contadores, etapas del ciclo de
// vida y vistas guardadas (crm_vistas, tabla 'wa_inbox').
import { useEffect, useState } from 'react';
import { LIFECYCLE } from '../../../../lib/crm/lifecycle';
import type { Filtros } from './InboxPro';

const FILTROS = [
  { id: 'todas', label: 'Todas' },
  { id: 'mias', label: 'Mías' },
  { id: 'sin_asignar', label: 'Sin asignar' },
  { id: 'no_leidas', label: 'No leídas' },
];

const fila = (activo: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 8,
  padding: '7px 10px', fontSize: '0.78rem',
  background: activo ? '#EEECFE' : 'transparent',
  color: activo ? '#5B4BD6' : '#555', fontWeight: activo ? 800 : 600,
});
const seccion: React.CSSProperties = {
  fontSize: '0.58rem', fontWeight: 800, color: '#b3b1bb', textTransform: 'uppercase',
  letterSpacing: '.07em', padding: '14px 10px 5px',
};
const num: React.CSSProperties = { marginLeft: 'auto', fontSize: '0.68rem', color: '#a5a2af', fontVariantNumeric: 'tabular-nums' };

export default function RailInbox({ counts, filtros, setFiltros }: {
  counts: any; filtros: Filtros; setFiltros: (f: Filtros) => void;
}) {
  const [vistas, setVistas] = useState<any[]>([]);
  const [guardando, setGuardando] = useState(false);

  const cargarVistas = () => fetch('/api/crm/vistas?tabla=wa_inbox').then(r => r.json())
    .then(j => setVistas(j.data || [])).catch(() => {});
  useEffect(() => { cargarVistas(); }, []);

  const hayFiltroActivo = filtros.filtro !== 'todas' || !!filtros.etapa || !!filtros.search;
  const guardarVista = async () => {
    const nombre = window.prompt('Nombre de la vista (ej. "No leídas de clientes"):');
    if (!nombre?.trim()) return;
    setGuardando(true);
    await fetch('/api/crm/vistas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabla: 'wa_inbox', nombre: nombre.trim(), config: filtros }),
    }).catch(() => {});
    setGuardando(false); cargarVistas();
  };
  const borrarVista = async (id: string) => {
    await fetch('/api/crm/vistas', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    }).catch(() => {});
    cargarVistas();
  };

  const vistaActiva = vistas.find(v => JSON.stringify(v.config) === JSON.stringify(filtros));

  return (
    <div style={{ borderRight: '1px solid #f0eff3', overflowY: 'auto', padding: '10px 8px', background: '#fdfcff' }}>
      {FILTROS.map(f => (
        <button key={f.id} style={fila(filtros.filtro === f.id && !filtros.etapa)}
          onClick={() => setFiltros({ ...filtros, filtro: f.id, etapa: '' })}>
          {f.label}
          <span style={num}>{f.id === 'todas' ? counts.todas ?? '' : f.id === 'mias' ? counts.mias ?? '' : f.id === 'sin_asignar' ? counts.sin_asignar ?? '' : counts.no_leidas ?? ''}</span>
        </button>
      ))}

      <div style={seccion}>Ciclo de vida</div>
      {LIFECYCLE.filter(e => (counts.por_etapa?.[e.id] || 0) > 0 || filtros.etapa === e.id).map(e => (
        <button key={e.id} style={fila(filtros.etapa === e.id)}
          onClick={() => setFiltros({ ...filtros, etapa: filtros.etapa === e.id ? '' : e.id })}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: e.fg, opacity: .55, flexShrink: 0 }} />
          {e.label}
          <span style={num}>{counts.por_etapa?.[e.id] || 0}</span>
        </button>
      ))}
      {!Object.keys(counts.por_etapa || {}).length && (
        <div style={{ padding: '4px 10px', fontSize: '0.68rem', color: '#b3b1bb' }}>Sin contactos ligados aún.</div>
      )}

      <div style={seccion}>Vistas</div>
      {vistas.map(v => (
        <div key={v.id} style={{ display: 'flex', alignItems: 'center' }}>
          <button style={{ ...fila(vistaActiva?.id === v.id), flex: 1 }} onClick={() => setFiltros({ filtro: 'todas', etapa: '', search: '', ...v.config })}>
            {v.nombre}
          </button>
          <button title="Borrar vista" onClick={() => borrarVista(v.id)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c9c7d1', fontSize: '0.72rem', padding: '0 6px' }}>✕</button>
        </div>
      ))}
      {hayFiltroActivo && !vistaActiva && (
        <button style={{ ...fila(false), color: '#2C5FC4', fontWeight: 700 }} disabled={guardando} onClick={guardarVista}>
          + Guardar esta vista
        </button>
      )}
      {!vistas.length && !hayFiltroActivo && (
        <div style={{ padding: '4px 10px', fontSize: '0.68rem', color: '#b3b1bb', lineHeight: 1.5 }}>
          Filtra y guarda la combinación como vista.
        </div>
      )}
    </div>
  );
}
