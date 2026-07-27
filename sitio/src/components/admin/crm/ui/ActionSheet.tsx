// ActionSheet — menú de acciones táctil (bottom sheet) del CRM mobile-first.
// Reemplaza dropdowns hover-only en touch: filas de ≥48px, safe-area, backdrop.
// En desktop también funciona (bottom sheet centrado angosto) — aceptable según
// el plan; los consumidores pueden seguir usando su dropdown en desktop si quieren.
import type { ReactNode } from 'react';
import { useDrawerHistory } from '../../../../lib/ui/mobile';

export type ActionItem = {
  label: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;      // ej. etapa actual marcada
  onClick: () => void;
};

export default function ActionSheet({
  open, onClose, title, items, zIndex = 950,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  items: ActionItem[];
  zIndex?: number;
}) {
  useDrawerHistory(open, onClose);
  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', zIndex }} />
      <div role="menu" style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 0, zIndex: zIndex + 1,
        width: 'min(480px, 100%)',
        background: '#fff', borderRadius: '16px 16px 0 0',
        boxShadow: '0 -8px 30px rgba(0,0,0,0.18)',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
        maxHeight: '75dvh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: '#d8dbe2', margin: '8px auto 4px', flexShrink: 0 }} />
        {title != null && (
          <div style={{ padding: '6px 18px 8px', fontSize: '0.72rem', fontWeight: 800, color: '#8a8f98', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{title}</div>
        )}
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
          {items.map((it, i) => (
            <button key={i} role="menuitem" disabled={it.disabled}
              onClick={() => { if (it.disabled) return; onClose(); it.onClick(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                minHeight: 48, padding: '12px 18px', border: 'none', background: it.active ? '#f0f4ff' : 'none',
                cursor: it.disabled ? 'default' : 'pointer', textAlign: 'left',
                fontSize: '0.95rem', fontWeight: it.active ? 800 : 600,
                color: it.disabled ? '#b8bcc4' : it.danger ? '#b93333' : '#16181d',
                borderTop: i > 0 ? '1px solid #f4f5f8' : 'none',
              }}>
              {it.icon && <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{it.icon}</span>}
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
              {it.active && <span style={{ color: '#3764c4', fontWeight: 800 }}>✓</span>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
