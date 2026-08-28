// MasScreen — la pantalla "Más" del CRM móvil (destino 5 del BottomNav).
//
// Antes era un ActionSheet con 19 renglones planos ("Grupo · Item"): una lista
// sin jerarquía donde había que leer todo para encontrar algo. Ahora es una
// PANTALLA con los mismos grupos del sidebar de escritorio (patrón Ajustes de
// iOS): encabezados de grupo + filas de 52px con chevron. El ojo salta por
// grupos, no por renglones.
//
// Diseño v5 (presupuesto del referee): sin buscador (las filas se escanean
// solas; la lupa global vive en la app bar), filas de texto sin iconos
// decorativos, acento morado SOLO en el ítem activo.
import { useDrawerHistory } from '../../../../lib/ui/mobile';
import AvisosPush from './AvisosPush';

export type MasGrupo = {
  label: string;
  items: { id: string; label: string }[];
};

export default function MasScreen({
  open, grupos, activeId, onSelect, onClose, extras,
}: {
  open: boolean;
  grupos: MasGrupo[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** Filas del pie (Notificaciones, contraseña, salir) — sin grupo. */
  extras: { label: string; danger?: boolean; onClick: () => void }[];
}) {
  // El botón atrás del teléfono cierra la pantalla (mismo contrato que drawers).
  useDrawerHistory(open, onClose);
  if (!open) return null;

  return (
    <div className="mas-screen" style={{
      position: 'fixed', left: 0, right: 0, top: 0,
      bottom: 'var(--crm-bottomnav-h, 64px)', zIndex: 395,
      background: '#fff', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{ padding: '16px 24px 6px', fontSize: '2.125rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#1a1a1a' }}>
        Más
      </div>
      <AvisosPush />
      {grupos.map(g => (
        <div key={g.label || 'sin'}>
          {g.label && (
            <div style={{
              padding: '22px 24px 8px', fontSize: '0.68rem', fontWeight: 700,
              letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8f8d98',
            }}>{g.label}</div>
          )}
          {g.items.map(it => {
            const activo = it.id === activeId;
            return (
              <button key={it.id} onClick={() => onSelect(it.id)} className="crm-row" style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                minHeight: 64, padding: '18px 24px', border: 'none', cursor: 'pointer',
                background: 'none', borderBottom: '1px solid #efeef2',
                fontFamily: 'inherit', fontSize: '1rem', textAlign: 'left',
                fontWeight: activo ? 700 : 500,
                color: activo ? '#5B4BD6' : '#1a1a1a',
              }}>
                <span style={{ flex: 1, minWidth: 0 }}>{it.label}</span>
                <span style={{ color: activo ? '#5B4BD6' : '#c9c7d0', fontSize: '1rem' }}>›</span>
              </button>
            );
          })}
        </div>
      ))}
      <div style={{ height: 1, background: '#efeef2', margin: '18px 0 0' }} />
      {extras.map(x => (
        <button key={x.label} onClick={x.onClick} className="crm-row" style={{
          display: 'flex', alignItems: 'center', width: '100%',
          minHeight: 64, padding: '18px 24px', border: 'none', cursor: 'pointer',
          background: 'none', borderBottom: '1px solid #efeef2',
          fontFamily: 'inherit', fontSize: '1rem', textAlign: 'left',
          fontWeight: 500, color: x.danger ? '#C0554E' : '#1a1a1a',
        }}>{x.label}</button>
      ))}
      <div style={{ height: 28 }} />
    </div>
  );
}
