// Portal del partner · versión minimalista, Squareup-style
// Sidebar organizado en 3 secciones: Administración · CRM · Activos.
//
// Endpoints API sin cambios — toda la data sigue viniendo de /api/partner-portal/*

import { useEffect, useState } from 'react';
import HomeTab from './tabs/HomeTab';
import MoneyTab from './tabs/MoneyTab';
import ShareTab from './tabs/ShareTab';
import LevelTab from './tabs/LevelTab';
import CertificationsTab from './tabs/CertificationsTab';
import LeadsTab from './tabs/LeadsTab';
import ClientesTab from './tabs/ClientesTab';
import PartnerNetworkTab from './tabs/PartnerNetworkTab';
import BrandKitTab from './tabs/BrandKitTab';
import SacsAccountTab from './tabs/SacsAccountTab';
import MyAccountTab from './tabs/MyAccountTab';
import HelpTab from './tabs/HelpTab';
import ProfileDropdown from './tabs/ProfileDropdown';
import PortalFabs from './tabs/PortalFabs';
import PWAManager from './tabs/PWAManager';
import { C } from './tabs/styles';
import { Icon } from './tabs/icons';
import { isDemoMode } from './tabs/utils';

type TabId =
  | 'home' | 'dinero' | 'compartir' | 'nivel' | 'certs'
  | 'leads' | 'clientes' | 'red'
  | 'brandkit' | 'sacs-account'
  | 'mi-cuenta' | 'ayuda';

interface Props {
  initialUser: { id: string; nombre: string; email: string };
}

type TabItem = { id: TabId; label: string; icon: (p: any) => JSX.Element };

const SECTIONS: { title: string; items: TabItem[] }[] = [
  {
    title: 'Administración',
    items: [
      { id: 'home',      label: 'Inicio',          icon: Icon.Home },
      { id: 'dinero',    label: 'Dinero',          icon: Icon.Money },
      { id: 'compartir', label: 'Compartir',       icon: Icon.Share },
      { id: 'nivel',     label: 'Mi nivel',        icon: Icon.Level },
      { id: 'certs',     label: 'Certificaciones', icon: Icon.Certificate },
    ],
  },
  {
    title: 'CRM',
    items: [
      { id: 'leads',    label: 'Leads',            icon: Icon.Leads },
      { id: 'clientes', label: 'Clientes',         icon: Icon.Customers },
      { id: 'red',      label: 'Red de partners',  icon: Icon.Network },
    ],
  },
  {
    title: 'Activos',
    items: [
      { id: 'brandkit',     label: 'Brand kit',   icon: Icon.BrandKit },
      { id: 'sacs-account', label: 'Cuenta SACS', icon: Icon.SacsAccount },
    ],
  },
  {
    title: 'Cuenta',
    items: [
      { id: 'mi-cuenta', label: 'Mi perfil', icon: Icon.Customers },
      { id: 'ayuda',     label: 'Ayuda',     icon: Icon.Settings },
    ],
  },
];

const ALL_TABS: TabItem[] = SECTIONS.flatMap(s => s.items);

export default function PortalShell({ initialUser }: Props) {
  const [tab, setTab] = useState<TabId>('home');
  const [demoBanner, setDemoBanner] = useState(false);

  useEffect(() => {
    setDemoBanner(isDemoMode());
    const valid: TabId[] = ALL_TABS.map(t => t.id);
    const hash = (window.location.hash || '').replace('#', '') as TabId;
    if (valid.includes(hash)) setTab(hash);
    const onHash = () => {
      const h = (window.location.hash || '').replace('#', '') as TabId;
      if (valid.includes(h)) setTab(h);
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
      {/* Demo banner · arriba de todo */}
      {demoBanner && (
        <div style={S.demoBanner}>
          Estás viendo el portal con <strong>datos demo</strong>. Quita <code style={{ background: 'rgba(75,123,229,0.14)', padding: '2px 6px', borderRadius: 4, fontFamily: 'SF Mono, Courier New, monospace' }}>?demo=1</code> de la URL para ver tus datos reales.
        </div>
      )}

      {/* Topbar mobile-only · para mostrar logo + avatar cuando sidebar está oculto */}
      <header style={S.topbarMobile} className="pp-topbar-mobile">
        <a href="/" style={S.brand}>Sacs</a>
        <span style={S.brandSep}>·</span>
        <span style={S.brandSub}>Portal</span>
        {demoBanner && <span style={S.demoTag}>DEMO</span>}
        <div style={{ flex: 1 }} />
        <ProfileDropdown user={initialUser} />
      </header>

      <div style={S.body}>
        {/* Sidebar (desktop) — logo arriba, profile abajo */}
        <nav style={S.sidebar} className="pp-sidebar">
          {/* Brand block */}
          <div style={S.sidebarBrand}>
            <a href="/" style={S.brand}>Sacs</a>
            <div style={S.brandSubSide}>Portal de partner</div>
            {demoBanner && <span style={{ ...S.demoTag, marginLeft: 0, marginTop: 8, display: 'inline-block' }}>DEMO</span>}
          </div>

          {/* Sections */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 16px' }}>
            {SECTIONS.map((section, sIdx) => (
              <div key={section.title} style={{ marginBottom: sIdx < SECTIONS.length - 1 ? 24 : 0 }}>
                <div style={S.sectionTitle}>{section.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {section.items.map(t => {
                    const isActive = tab === t.id;
                    return (
                      <button key={t.id} onClick={() => go(t.id)}
                        style={{ ...S.sideBtn, ...(isActive ? S.sideBtnActive : {}) }}
                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = C.borderSoft; }}
                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18 }}>
                          <t.icon size={17} color={isActive ? C.brand : C.muted} />
                        </span>
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Profile pinned al fondo del sidebar */}
          <div style={S.sidebarProfile}>
            <ProfileDropdown user={initialUser} variant="sidebar" />
          </div>
        </nav>

        {/* Main content */}
        <main style={S.main} className="pp-main">
          <div style={S.mainInner} className="pp-main-inner">
            {tab === 'home'         && <HomeTab user={initialUser} go={(t) => go(t as TabId)} />}
            {tab === 'dinero'       && <MoneyTab user={initialUser} />}
            {tab === 'compartir'    && <ShareTab user={initialUser} />}
            {tab === 'nivel'        && <LevelTab user={initialUser} />}
            {tab === 'certs'        && <CertificationsTab user={initialUser} />}
            {tab === 'leads'        && <LeadsTab user={initialUser} />}
            {tab === 'clientes'     && <ClientesTab user={initialUser} />}
            {tab === 'red'          && <PartnerNetworkTab user={initialUser} />}
            {tab === 'brandkit'     && <BrandKitTab />}
            {tab === 'sacs-account' && <SacsAccountTab user={initialUser} />}
            {tab === 'mi-cuenta'    && <MyAccountTab user={initialUser} />}
            {tab === 'ayuda'        && <HelpTab user={initialUser} />}
          </div>
        </main>
      </div>

      {/* Floating action buttons · WhatsApp + Install PWA */}
      <PortalFabs user={initialUser} />

      {/* PWA Manager · SW register, offline detection, push hooks */}
      <PWAManager user={initialUser} />

      {/* Mobile bottom nav · solo administración */}
      <nav style={S.bottomNav} className="pp-bottomnav">
        {SECTIONS[0].items.map(t => {
          const isActive = tab === t.id;
          return (
            <button key={t.id} onClick={() => go(t.id)}
              style={{ ...S.bottomBtn, color: isActive ? C.text : C.muted }}>
              <t.icon size={18} color={isActive ? C.text : C.muted} />
              <span style={{ fontSize: 10, marginTop: 3, fontWeight: isActive ? 600 : 500 }}>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 900px) {
          .pp-sidebar { display: none !important; }
          .pp-bottomnav { display: flex !important; }
          .pp-topbar-mobile { display: flex !important; }
          .pp-main { padding-bottom: 84px !important; }
          .pp-main-inner { padding: 32px 22px 32px !important; }
          .pp-username { display: none !important; }
        }
        @media (min-width: 901px) {
          .pp-bottomnav { display: none !important; }
          .pp-topbar-mobile { display: none !important; }
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

  // Topbar solo aparece en mobile (sidebar oculto)
  topbarMobile: {
    display: 'none',
    alignItems: 'center', gap: 10,
    padding: '12px 18px',
    background: '#fff', borderBottom: `1px solid ${C.border}`,
    position: 'sticky' as const, top: 0, zIndex: 10,
  },
  brand: { fontFamily: 'Clash Display, sans-serif', fontWeight: 700, fontSize: 22, color: C.text, textDecoration: 'none', letterSpacing: '-0.02em' },
  brandSep: { color: '#ccc' },
  brandSub: { fontSize: 13, color: C.muted, fontWeight: 500 },
  brandSubSide: { fontSize: 12, color: C.muted, fontWeight: 500, marginTop: 4 },
  demoTag: { marginLeft: 10, padding: '3px 9px', background: C.brandSoft, color: C.brandDark, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', borderRadius: 4 },

  demoBanner: { padding: '10px 24px', background: C.brandSoft, color: C.brandDark, fontSize: 13, textAlign: 'center' as const, borderBottom: `1px solid ${C.brandTint}` },

  body: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: 240,
    display: 'flex', flexDirection: 'column' as const,
    borderRight: `1px solid ${C.border}`, background: '#fff', flexShrink: 0,
    position: 'sticky' as const, top: 0, height: '100vh',
  },
  sidebarBrand: {
    padding: '24px 26px 20px',
    borderBottom: `1px solid ${C.borderSoft}`,
  },
  sidebarProfile: {
    padding: '14px 14px',
    borderTop: `1px solid ${C.borderSoft}`,
    background: '#fafafa',
  },
  sectionTitle: {
    fontSize: 10, fontWeight: 700, color: C.mutedLight,
    letterSpacing: '0.12em', textTransform: 'uppercase' as const,
    padding: '0 14px',
    marginTop: 8,
    marginBottom: 8,
  },
  sideBtn: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 14px',
    background: 'transparent', color: C.textSoft, border: 'none', borderRadius: 10,
    cursor: 'pointer', textAlign: 'left' as const,
    fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
    transition: 'background 0.12s, color 0.12s',
    letterSpacing: '-0.005em',
  },
  sideBtnActive: { background: C.brandSoft, color: C.brand, fontWeight: 600 },

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
    padding: '4px 8px', fontFamily: 'inherit',
  },
};
