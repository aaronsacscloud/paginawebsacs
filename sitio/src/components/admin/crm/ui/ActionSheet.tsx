// ActionSheet — menú de acciones táctil (bottom sheet) del CRM mobile-first.
// Reemplaza dropdowns hover-only en touch: filas de ≥48px, safe-area, backdrop.
// En desktop también funciona (bottom sheet centrado angosto) — aceptable según
// el plan; los consumidores pueden seguir usando su dropdown en desktop si quieren.
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
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
  /* Alta = expandida. Arranca en su tamaño normal y crece si la arrastras: una
     hoja que abre a pantalla completa tapa el contexto de dónde saliste. */
  const [alta, setAlta] = useState(false);
  const asa = useRef<number | null>(null);
  useEffect(() => { if (!open) setAlta(false); }, [open]);
  if (!open) return null;

  return (
    <>
      {/* Los colores van por CLASE, no en línea. Esta hoja se quedó blanca en
          modo oscuro cuando el resto de la app ya era negra —el tema no puede
          alcanzar un `background:'#fff'` escrito aquí dentro—: un rectángulo
          blanco a pantalla completa de madrugada. */}
      <style>{CSS_HOJA}</style>
      <div className="ash-velo" onClick={onClose} style={{ zIndex }} />
      <div role="menu" className={'ash' + (alta ? ' alta' : '')} style={{ zIndex: zIndex + 1 }}>
        {/* El asa se ve arrastrable, así que TIENE que arrastrar: si parece un
            control y no responde, se lee como que la pantalla está trabada.
            Arriba la agranda a pantalla casi completa, abajo la cierra. La zona
            táctil es toda la franja superior, no los 4 px de la rayita. */}
        <div className="ash-asa-zona"
          onTouchStart={(e) => { asa.current = e.touches[0].clientY; }}
          onTouchMove={(e) => {
            if (asa.current == null) return;
            const d = e.touches[0].clientY - asa.current;
            if (d < -28) { setAlta(true); asa.current = null; }
            else if (d > 60) { asa.current = null; onClose(); }
          }}
          onTouchEnd={() => { asa.current = null; }}
          onClick={() => setAlta(v3 => !v3)}>
          <div className="ash-asa" />
        </div>
        {title != null && <div className="ash-tit">{title}</div>}
        <div className="ash-lista">
          {items.map((it, i) => {
            /* Un separador es un item deshabilitado SIN acción: se dibuja como
               encabezado de sección y no como una fila apagada, que es como se
               veía — igual que un botón roto. */
            const esSeparador = it.disabled && !it.icon;
            return (
              <button key={i} role={esSeparador ? undefined : 'menuitem'} disabled={it.disabled}
                onClick={() => { if (it.disabled) return; onClose(); it.onClick(); }}
                className={'ash-i' + (it.active ? ' on' : '') + (it.danger ? ' mal' : '') + (esSeparador ? ' sep' : '')}>
                {it.icon && <span className="ash-ico">{it.icon}</span>}
                <span className="ash-tx">{it.label}</span>
                {it.active && <span className="ash-ok">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* La hoja SUBE en vez de aparecer de golpe: 190 ms es lo que separa «algo
   cambió» de «esto salió de aquí». El velo entra a la vez, un poco más lento,
   para que el fondo se apague sin parpadeo. */
const CSS_HOJA = `
@keyframes ash-sube { from { transform: translate(-50%, 16px); opacity: .4 } to { transform: translate(-50%, 0); opacity: 1 } }
@keyframes ash-vela { from { opacity: 0 } to { opacity: 1 } }
.ash-velo { position: fixed; inset: 0; background: rgba(8,7,12,.55); backdrop-filter: blur(2px); animation: ash-vela 220ms ease both; }
.ash {
  position: fixed; left: 50%; bottom: 0; transform: translateX(-50%);
  width: min(480px, 100%); max-height: 78dvh; display: flex; flex-direction: column;
  background: #fff; color: #16181d;
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -12px 40px rgba(10,8,20,.22);
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
  animation: ash-sube 190ms cubic-bezier(.22,.61,.36,1) both;
}
.ash-asa-zona { padding: 8px 0 4px; cursor: grab; flex-shrink: 0; touch-action: none; }
.ash-asa { width: 38px; height: 4px; border-radius: 99px; background: #d8dbe2; margin: 0 auto; }
.ash.alta { max-height: 94dvh; }
.ash-tit { padding: 8px 20px 6px; font-size: .68rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #9a9aa8; flex-shrink: 0; }
/* min-height:0 es LO QUE HACE QUE HAGA SCROLL. Un hijo de un flex column no
   encoge por debajo de su contenido salvo que se le diga; sin esto la lista
   crecía más allá de la hoja y overflow-y:auto no llegaba a activarse nunca:
   los últimos renglones quedaban cortados y no había forma de bajar.
   El padding de abajo deja pasar la barra de pestanas, que va ENCIMA: sin el,
   el último renglón queda debajo de «Inbox» y no se puede tocar. */
.ash-lista {
  flex: 1 1 auto; min-height: 0;
  overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
  padding-bottom: calc(var(--crm-bottomnav-h, 64px) + 10px);
}
.ash-i {
  display: flex; align-items: center; gap: 12px; width: 100%; min-height: 50px;
  padding: 12px 20px; border: 0; background: none; cursor: pointer; text-align: left;
  font-family: inherit; font-size: .95rem; font-weight: 600; color: #16181d;
  border-left: 3px solid transparent; transition: background 130ms ease;
}
.ash-i:active { background: #f4f4f7; }
.ash-i.on { background: #F3F1FE; color: #5B4BD6; font-weight: 800; border-left-color: #5B4BD6; }
.ash-i.mal { color: #b93333; }
.ash-i:disabled { cursor: default; }
.ash-ico { flex-shrink: 0; display: flex; align-items: center; }
.ash-tx { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ash-ok { color: #5B4BD6; font-weight: 800; }
.ash-i.sep { min-height: 0; padding: 16px 20px 5px; cursor: default; background: none; border-left-color: transparent; }
.ash-i.sep .ash-tx { font-size: .66rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #9a9aa8; }

@media (prefers-color-scheme: dark) and (max-width: 899px) {
  [data-crm-dark="1"] .ash { background: #17171d; color: #F2F1F7; box-shadow: 0 -12px 40px rgba(0,0,0,.55); }
  [data-crm-dark="1"] .ash-asa { background: #3a3a45; }
  [data-crm-dark="1"] .ash-tit, [data-crm-dark="1"] .ash-i.sep .ash-tx { color: #7e7b89; }
  [data-crm-dark="1"] .ash-i { color: #F2F1F7; }
  [data-crm-dark="1"] .ash-i:active { background: #212129; }
  [data-crm-dark="1"] .ash-i.on { background: #241F3D; color: #B7A8F7; border-left-color: #B7A8F7; }
  [data-crm-dark="1"] .ash-i.mal { color: #F0857A; }
  [data-crm-dark="1"] .ash-ok { color: #B7A8F7; }
}
@media (prefers-reduced-motion: reduce) { .ash, .ash-velo { animation: none } }
`;
