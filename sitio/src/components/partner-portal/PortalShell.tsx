// Portal del partner · versión minimalista (4 tabs)
// Inicio · Dinero · Compartir · Mi nivel + ProfileDropdown
//
// Reescrito desde 12 tabs a 4 tabs con foco en lo que el embajador necesita:
// ver su dinero, su pipeline de leads, su link de distribución, y su nivel/progreso.
//
// Demo mode: `?demo=1` muestra fixtures realistas para que se vea "lleno" sin
// tener actividad real.

import { useEffect, useState } from 'react';
import HomeTab from './tabs/HomeTab';
import MoneyTab from './tabs/MoneyTab';
import ShareTab from './tabs/ShareTab';
import LevelTab from './tabs/LevelTab';
import ProfileDropdown from './tabs/ProfileDropdown';
import { C } from './tabs/styles';
import { isDemoMode } from './tabs/utils';

type TabId = 'home' | 'dinero' | 'compartir' | 'nivel';

interface Props {
  initialUser: { id: string; nombre: string; email: string };
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home',      label: 'Inicio',     icon: '◉' },
  { id: 'dinero',    label: 'Dinero',     icon: '◈' },
  { id: 'compartir', label: 'Compartir',  icon: '◇' },
  { id: 'nivel',     label: 'Mi nivel',   icon: '◆' },
];

export default function PortalShell({ initialUser }: Props) {
  const [tab, setTab] = useState<TabId>('home');
  const [demoBanner, setDemoBanner] = useState(false);

  useEffect(() => {
    setDemoBanner(isDemoMode());
    const validTabs: TabId[] = ['home', 'dinero', 'compartir', 'nivel'];
    const hash = (window.location.hash || '').replace('#', '') as TabId;
    if (validTabs.includes(hash)) setTab(hash);
    const onHash = () => {
      const h = (window.location.hash || '').replace('#', '') as TabId;
      if (validTabs.includes(h)) setTab(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function go(t: TabId) {
    setTab(t);
    window.location.hash = t;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div style={S.root}>
      {/* Topbar */}
      <header style={S.topbar}>
        <a href="/" style={S.brand}>Sacs</a>
        <span style={S.brandSep}>·</span>
        <span style={S.brandSub}>Portal de partner</span>
        {demoBanner && <span style={S.demoTag}>DEMO</span>}
        <div style={{ flex: 1 }} />
        <ProfileDropdown user={initialUser} />
      </header>

      {/* Demo banner */}
      {demoBanner && (
        <div style={S.demoBanner}>
          Estás viendo el portal con <strong>datos demo</strong>. Quita <code style={{ background: 'rgba(255,255,255,0.18)', padding: '2px 6px', borderRadius: 4 }}>?demo=1</code> de la URL para ver tus datos reales.
        </div>
      )}

      <div style={S.body}>
        {/* Sidebar (desktop) */}
        <nav style={S.sidebar} className="pp-sidebar">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              style={{ ...S.sideBtn, ...(tab === t.id ? S.sideBtnActive : {}) }}
            >
              <span style={{ fontSize: 14, opacity: 0.7, marginRight: 12, width: 18, display: 'inline-block' }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={S.sideFoot}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{initialUser.nombre || 'Partner'}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{initialUser.email}</div>
            <a href="mailto:partners@sacscloud.com" style={{ display: 'block', marginTop: 12, fontSize: 12, color: C.accent, textDecoration: 'none', fontWeight: 500 }}>
              ¿Necesitas ayuda? →
            </a>
          </div>
        </nav>

        {/* Main content */}
        <main style={S.main} className="pp-main">
          <div style={S.mainInner} className="pp-main-inner">
            {tab === 'home'      && <HomeTab user={initialUser} go={go} />}
            {tab === 'dinero'    && <MoneyTab user={initialUser} />}
            {tab === 'compartir' && <ShareTab user={initialUser} />}
            {tab === 'nivel'     && <LevelTab user={initialUser} />}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav style={S.bottomNav} className="pp-bottomnav">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            style={{
              ...S.bottomBtn,
              color: tab === t.id ? C.text : C.muted,
              fontWeight: tab === t.id ? 600 : 500,
            }}
          >
            <span style={{ fontSize: 18, marginBottom: 2 }}>{t.icon}</span>
            <span style={{ fontSize: 11 }}>{t.label}</span>
          </button>
        ))}
      </nav>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 900px) {
          .pp-sidebar { display: none !important; }
          .pp-bottomnav { display: flex !important; }
          .pp-main { padding-bottom: 84px !important; }
          .pp-main-inner { padding: 32px 22px 32px !important; }
          .pp-username { display: none !important; }
        }
        @media (min-width: 901px) {
          .pp-bottomnav { display: none !important; }
        }
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      ` }} />
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: C.bg, fontFamily: 'var(--font-body)', color: C.text },

  topbar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 24px',
    background: '#fff', borderBottom: `1px solid ${C.border}`,
    position: 'sticky', top: 0, zIndex: 10,
  },
  brand: { fontFamily: 'Clash Display, sans-serif', fontWeight: 700, fontSize: 22, color: C.text, textDecoration: 'none', letterSpacing: '-0.02em' },
  brandSep: { color: '#ccc' },
  brandSub: { fontSize: 13, color: C.muted, fontWeight: 500 },
  demoTag: { marginLeft: 10, padding: '2px 8px', background: '#1a1a1a', color: '#C8A55B', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', borderRadius: 4 },

  demoBanner: { padding: '10px 24px', background: '#1a1a1a', color: '#fff', fontSize: 13, textAlign: 'center' as const },

  body: { display: 'flex', minHeight: 'calc(100vh - 53px)' },
  sidebar: {
    width: 220, padding: '24px 14px 18px',
    display: 'flex', flexDirection: 'column' as const, gap: 2,
    borderRight: `1px solid ${C.border}`, background: '#fff', flexShrink: 0,
  },
  sideBtn: {
    display: 'flex', alignItems: 'center',
    padding: '12px 16px',
    background: 'transparent', color: C.textSoft, border: 'none', borderRadius: 10,
    cursor: 'pointer', textAlign: 'left' as const,
    fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
    transition: 'background 0.15s, color 0.15s',
    letterSpacing: '-0.005em',
  },
  sideBtnActive: { background: C.text, color: '#fff' },
  sideFoot: { marginTop: 24, padding: 16, borderTop: `1px solid ${C.borderSoft}`, background: '#fafafa', borderRadius: 10 },

  main: { flex: 1, overflowY: 'auto' as const, minWidth: 0, background: C.bg },
  mainInner: { padding: '56px 64px 96px', maxWidth: 1080, margin: '0 auto' },

  bottomNav: {
    display: 'none',
    position: 'fixed' as const, bottom: 0, left: 0, right: 0,
    background: '#fff', borderTop: `1px solid ${C.border}`,
    justifyContent: 'space-around',
    padding: '10px 4px 14px',
    zIndex: 20,
  },
  bottomBtn: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px 12px', fontFamily: 'inherit',
  },
};
