// Componentes flotantes globales del portal:
// - WhatsApp FAB (siempre visible)
// - PWA Install Button (solo mobile, cuando disponible)
//
// Posicionados arriba del bottom nav móvil.

import { useEffect, useState } from 'react';
import { C } from './styles';
import { Icon } from './icons';

const SUPPORT_WHATSAPP = '5215536634392';

type Props = {
  user: { id: string; nombre: string; email: string };
};

export default function PortalFabs({ user }: Props) {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detectar iOS
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(ios);

    // Detectar si ya está corriendo como PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Capturar el evento de instalación (Android/Chrome)
    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  async function handleInstall() {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') setInstallPrompt(null);
    } else if (isIos) {
      setShowIosHint(true);
    } else {
      alert('Tu navegador no soporta instalación. Prueba en Chrome, Edge o Safari iOS.');
    }
  }

  const waLink = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hola, soy ${user.nombre || 'partner'} (${user.email}). Necesito ayuda con:`)}`;
  const canInstall = !isStandalone && (installPrompt || isIos);

  return (
    <>
      {/* WhatsApp FAB */}
      <a href={waLink} target="_blank" rel="noopener"
        className="pp-fab pp-fab-wa"
        aria-label="Contactar soporte por WhatsApp">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        </svg>
      </a>

      {/* Install PWA · solo mobile y cuando aplica */}
      {canInstall && (
        <button onClick={handleInstall} className="pp-fab pp-fab-install" aria-label="Agregar a pantalla de inicio">
          <Icon.Plus size={18} strokeWidth={2.4} color="#fff" />
          <span className="pp-fab-label">Agregar a inicio</span>
        </button>
      )}

      {/* iOS install instructions modal */}
      {showIosHint && (
        <>
          <div onClick={() => setShowIosHint(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#fff', borderRadius: 16, padding: '28px 28px 24px',
            width: 'min(380px, calc(100vw - 32px))', zIndex: 301,
            boxShadow: '0 20px 50px -10px rgba(0,0,0,0.25)',
          }}>
            <button onClick={() => setShowIosHint(false)}
              style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 8 }}>
              <Icon.Close size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: C.brandSoft, color: C.brand, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon.Plus size={20} strokeWidth={2.2} />
              </span>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: C.text, margin: 0, letterSpacing: '-0.012em' }}>
                Agregar a pantalla de inicio
              </h3>
            </div>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, margin: '0 0 18px' }}>
              Para acceder al portal con un toque como una app:
            </p>
            <ol style={{ padding: '0 0 0 20px', margin: 0, fontSize: 14, color: C.textSoft, lineHeight: 1.7 }}>
              <li>Toca el botón <strong style={{ color: C.text }}>Compartir</strong> (cuadro con flecha hacia arriba) en la barra inferior de Safari.</li>
              <li>Desliza hacia abajo y toca <strong style={{ color: C.text }}>"Agregar a pantalla de inicio"</strong>.</li>
              <li>Toca <strong style={{ color: C.text }}>"Agregar"</strong> en la esquina superior derecha.</li>
            </ol>
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .pp-fab {
          position: fixed;
          right: 22px;
          width: 52px; height: 52px;
          border-radius: 50%;
          background: #25D366;
          color: #fff;
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 12px 28px -8px rgba(0,0,0,0.25);
          z-index: 90;
          text-decoration: none;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .pp-fab:hover { transform: translateY(-2px); box-shadow: 0 16px 32px -8px rgba(0,0,0,0.30); }
        .pp-fab-wa { bottom: 28px; }
        .pp-fab-install {
          bottom: 92px;
          width: auto;
          padding: 0 18px 0 14px;
          gap: 8px;
          background: ${C.brand};
          border-radius: 999px;
          height: 48px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
        }
        .pp-fab-label {
          letter-spacing: -0.005em;
        }

        /* En mobile, el bottom nav del portal está abajo (~62px). FABs encima. */
        @media (max-width: 900px) {
          .pp-fab-wa { bottom: 84px; }
          .pp-fab-install { bottom: 148px; }
        }
      ` }} />
    </>
  );
}
