// BottomNav — navegación inferior del CRM en mobile (5 destinos).
// Fixed bottom con safe-area; expone su altura como CSS var --crm-bottomnav-h
// (la setea en documentElement al montar) para que el main pueda dar padding.
import { useEffect } from 'react';

export type BottomNavItem = {
  id: string;
  label: string;
  icon: string;          // SVG string (mismo formato que ICONS del CrmDashboard)
};

const NAV_H = 56; // px, sin contar safe-area

export default function BottomNav({
  items, activeId, onSelect,
}: {
  items: BottomNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  useEffect(() => {
    document.documentElement.style.setProperty('--crm-bottomnav-h', `calc(${NAV_H}px + env(safe-area-inset-bottom))`);
    return () => { document.documentElement.style.removeProperty('--crm-bottomnav-h'); };
  }, []);

  return (
    <nav aria-label="Navegación principal" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 400,
      height: `calc(${NAV_H}px + env(safe-area-inset-bottom))`,
      paddingBottom: 'env(safe-area-inset-bottom)',
      background: '#fff', borderTop: '1px solid #e5e7eb',
      display: 'flex', alignItems: 'stretch',
      boxShadow: '0 -2px 12px rgba(16,24,40,0.06)',
    }}>
      {items.map(it => {
        const active = it.id === activeId;
        return (
          <button key={it.id} onClick={() => onSelect(it.id)}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1, minWidth: 0, border: 'none', background: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              color: active ? '#5B4BD6' : '#8a8f98', padding: 0,
            }}>
            <span style={{ display: 'flex', width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}
              dangerouslySetInnerHTML={{ __html: it.icon }} />
            <span style={{ fontSize: '0.6875rem', fontWeight: active ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
