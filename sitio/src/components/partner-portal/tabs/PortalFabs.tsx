// Componentes flotantes globales del portal:
// - WhatsApp button (siempre visible, con logo oficial + label)
// - PWA Install Toast (bottom-center, con X, no persistente)

import { useEffect, useState } from 'react';
import { C } from './styles';
import { Icon } from './icons';

const SUPPORT_WHATSAPP = '5215536634392';

type Props = {
  user: { id: string; nombre: string; email: string };
};

export default function PortalFabs({ user }: Props) {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallToast, setShowInstallToast] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(ios);

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);

    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Detectar mobile para mostrar el toast install
    const checkMobile = () => {
      const mobile = window.matchMedia('(max-width: 900px)').matches;
      if (mobile && !standalone && (ios || true /* o platform compatible */)) {
        // Pequeño delay para no ser molesto al cargar
        setTimeout(() => setShowInstallToast(true), 1500);
      }
    };
    checkMobile();

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  async function handleInstall() {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallPrompt(null);
        setShowInstallToast(false);
      }
    } else if (isIos) {
      setShowIosHint(true);
    }
  }

  const waMessage = encodeURIComponent(`Hola, soy ${user.nombre || 'partner'} (${user.email}). Necesito ayuda con:`);
  const waLink = `https://wa.me/${SUPPORT_WHATSAPP}?text=${waMessage}`;
  const canInstall = !isStandalone && (installPrompt || isIos);

  return (
    <>
      {/* WhatsApp pill button · logo oficial + label */}
      <a href={waLink} target="_blank" rel="noopener"
        className="pp-wa-pill"
        data-tour="wa-fab"
        aria-label="Contactar soporte por WhatsApp">
        <WhatsAppOfficialIcon size={22} />
        <span className="pp-wa-label">WhatsApp</span>
      </a>

      {/* PWA install toast · bottom-center, con X */}
      {canInstall && showInstallToast && (
        <div className="pp-install-toast" role="dialog" aria-label="Agregar a pantalla de inicio">
          <div className="pp-install-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="3" />
              <line x1="12" y1="18" x2="12" y2="18" />
            </svg>
          </div>
          <div className="pp-install-body">
            <div className="pp-install-title">Agrega el portal a tu inicio</div>
            <div className="pp-install-desc">Acceso con un toque, como una app. Sin App Store, sin descargas.</div>
          </div>
          <button onClick={handleInstall} className="pp-install-cta">Agregar</button>
          <button
            onClick={() => setShowInstallToast(false)}
            aria-label="Cerrar"
            className="pp-install-close">
            <Icon.Close size={16} />
          </button>
        </div>
      )}

      {/* iOS install instructions modal */}
      {showIosHint && (
        <>
          <div onClick={() => setShowIosHint(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#fff', borderRadius: 18, padding: '28px 28px 24px',
            width: 'min(400px, calc(100vw - 32px))', zIndex: 301,
            boxShadow: '0 20px 50px -10px rgba(0,0,0,0.30)',
          }}>
            <button onClick={() => setShowIosHint(false)}
              style={{ position: 'absolute', top: 14, right: 14, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 8 }}>
              <Icon.Close size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: C.brandSoft, color: C.brand, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon.Plus size={22} strokeWidth={2.2} />
              </span>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: C.text, margin: 0, letterSpacing: '-0.012em' }}>
                Agregar a pantalla de inicio
              </h3>
            </div>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, margin: '0 0 18px' }}>
              Para acceder al portal con un toque, como una app:
            </p>
            <ol style={{ padding: '0 0 0 20px', margin: 0, fontSize: 14, color: C.textSoft, lineHeight: 1.75 }}>
              <li>Toca el botón <strong style={{ color: C.text }}>Compartir</strong> (cuadro con flecha hacia arriba) en la barra inferior de Safari.</li>
              <li>Desliza hacia abajo y toca <strong style={{ color: C.text }}>"Agregar a pantalla de inicio"</strong>.</li>
              <li>Toca <strong style={{ color: C.text }}>"Agregar"</strong> en la esquina superior derecha.</li>
            </ol>
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        /* WhatsApp pill button */
        .pp-wa-pill {
          position: fixed;
          right: 22px;
          bottom: 24px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 0 20px 0 16px;
          height: 52px;
          border-radius: 999px;
          background: #25D366;
          color: #fff;
          text-decoration: none;
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 12px 28px -8px rgba(37,211,102,0.45);
          z-index: 90;
          transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
          letter-spacing: -0.005em;
        }
        .pp-wa-pill:hover {
          transform: translateY(-2px);
          background: #1FB855;
          box-shadow: 0 16px 32px -8px rgba(37,211,102,0.55);
        }
        .pp-wa-label {
          color: #fff;
        }
        @media (max-width: 900px) {
          .pp-wa-pill {
            bottom: 84px;
            height: 48px;
            padding: 0 18px 0 14px;
            font-size: 13px;
          }
        }

        /* Install toast · bottom-center */
        .pp-install-toast {
          position: fixed;
          left: 50%;
          bottom: 24px;
          transform: translateX(-50%);
          width: min(440px, calc(100vw - 32px));
          background: #fff;
          border: 1px solid ${C.border};
          border-radius: 16px;
          padding: 16px 14px 16px 20px;
          box-shadow: 0 20px 50px -10px rgba(0,0,0,0.18), 0 8px 16px -6px rgba(0,0,0,0.08);
          display: flex;
          align-items: center;
          gap: 14px;
          z-index: 95;
          animation: install-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes install-slide-up {
          from { transform: translate(-50%, calc(100% + 24px)); opacity: 0; }
          to   { transform: translate(-50%, 0); opacity: 1; }
        }
        .pp-install-icon {
          flex-shrink: 0;
          width: 40px; height: 40px;
          border-radius: 12px;
          background: ${C.brandSoft};
          color: ${C.brand};
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .pp-install-body {
          flex: 1;
          min-width: 0;
        }
        .pp-install-title {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 600;
          color: ${C.text};
          letter-spacing: -0.012em;
          line-height: 1.3;
        }
        .pp-install-desc {
          font-size: 12px;
          color: ${C.muted};
          margin-top: 3px;
          line-height: 1.4;
        }
        .pp-install-cta {
          flex-shrink: 0;
          background: ${C.brand};
          color: #fff;
          border: none;
          padding: 10px 16px;
          border-radius: 999px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
          letter-spacing: -0.005em;
        }
        .pp-install-cta:hover { background: ${C.brandDark}; }
        .pp-install-close {
          flex-shrink: 0;
          background: transparent;
          color: ${C.muted};
          border: none;
          padding: 8px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .pp-install-close:hover {
          background: ${C.borderSoft};
          color: ${C.text};
        }

        @media (max-width: 900px) {
          .pp-install-toast {
            bottom: 84px;
            padding: 14px 12px 14px 16px;
            gap: 12px;
          }
          .pp-install-icon { width: 36px; height: 36px; }
          .pp-install-cta { padding: 9px 14px; font-size: 12px; }
        }
      ` }} />
    </>
  );
}

// WhatsApp icono oficial (SVG path optimizado, color blanco para fondo verde)
function WhatsAppOfficialIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M16.04 4.011C9.443 4.011 4.075 9.376 4.072 15.97c-.001 2.108.55 4.166 1.597 5.98L4 28l6.184-1.622a11.954 11.954 0 005.85 1.49h.005c6.595 0 11.962-5.366 11.965-11.96.001-3.196-1.242-6.201-3.5-8.461a11.886 11.886 0 00-8.464-3.436zm0 21.815a9.96 9.96 0 01-5.071-1.388l-.364-.216-3.768.988 1.006-3.672-.237-.376a9.937 9.937 0 01-1.524-5.293c.002-5.478 4.461-9.936 9.944-9.936a9.882 9.882 0 017.029 2.913 9.873 9.873 0 012.91 7.03c-.002 5.479-4.461 9.95-9.925 9.95zm5.452-7.448c-.299-.149-1.769-.873-2.043-.972-.274-.1-.474-.149-.673.15-.2.299-.773.972-.948 1.171-.174.2-.349.224-.648.075-.299-.149-1.262-.465-2.405-1.485-.889-.793-1.49-1.773-1.664-2.071-.174-.299-.018-.46.131-.609.134-.134.299-.349.448-.523.149-.174.199-.299.299-.498.099-.2.05-.374-.025-.523-.075-.149-.673-1.62-.922-2.219-.243-.583-.49-.504-.673-.514-.174-.008-.374-.01-.573-.01a1.097 1.097 0 00-.798.374c-.274.299-1.046 1.022-1.046 2.493s1.07 2.891 1.22 3.09c.149.2 2.107 3.217 5.105 4.512.713.308 1.27.492 1.704.63.715.227 1.367.195 1.882.119.574-.086 1.769-.723 2.018-1.421.249-.698.249-1.297.174-1.421-.074-.124-.273-.199-.572-.348z" />
    </svg>
  );
}
