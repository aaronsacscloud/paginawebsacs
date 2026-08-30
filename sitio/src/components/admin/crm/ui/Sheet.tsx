// Sheet — overlay estándar del CRM mobile-first.
// Desktop: drawer lateral derecho con backdrop (mismo patrón que D.panel/D.overlay
// de ClienteDrawer360). Mobile (<900px): hoja FULLSCREEN 100dvh con header sticky
// de una fila (botón ← 44×44 + título truncado). Integra useDrawerHistory: el
// botón atrás del teléfono cierra el sheet (no saca del CRM) y el body queda
// con scroll-lock mientras está abierto.
import type { ReactNode } from 'react';
import { useIsMobile, useDrawerHistory } from '../../../../lib/ui/mobile';

export default function Sheet({
  open, onClose, title, headerActions, width = 720, zIndex = 900, children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  headerActions?: ReactNode;
  width?: number;
  zIndex?: number;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  useDrawerHistory(open, onClose);
  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)', zIndex }} />
      <div className="crm-sheet" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: isMobile ? '100%' : width,
        maxWidth: isMobile ? '100%' : '97vw',
        height: '100dvh',
        background: '#fff', zIndex: zIndex + 1,
        display: 'flex', flexDirection: 'column',
        boxShadow: isMobile ? 'none' : '-8px 0 30px rgba(0,0,0,0.15)',
      }}>
        {/* Header sticky de UNA fila */}
        {/* Las clases existen para que el tema oscuro pueda alcanzar la hoja:
            el fondo iba fijo en '#fff' en línea y sin clase, así que NINGUNA
            hoja del CRM cambiaba de color — quedaban blancas con texto oscuro
            en medio de una app negra. */}
        <div className="crm-sheet-hdr" style={{
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          padding: '8px 12px', borderBottom: '1px solid #ececf1', background: '#fff',
          minHeight: 52,
        }}>
          <button onClick={onClose} aria-label={isMobile ? 'Atrás' : 'Cerrar'}
            style={{ width: 44, height: 44, border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.15rem', color: '#444', borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isMobile ? '←' : '✕'}
          </button>
          {title != null && (
            <div style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          )}
          {headerActions && <div style={{ flexShrink: 0, display: 'flex', gap: 6, alignItems: 'center' }}>{headerActions}</div>}
        </div>
        {/* Cuerpo scrolleable con safe-area inferior */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any, padding: isMobile ? '14px 14px calc(20px + env(safe-area-inset-bottom))' : '18px 22px 28px' }}>
          {children}
        </div>
      </div>
    </>
  );
}
