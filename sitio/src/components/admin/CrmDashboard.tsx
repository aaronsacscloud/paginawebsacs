import { useState, useEffect, Component } from 'react';
import type { ReactNode } from 'react';
import PipelineTab from './crm/PipelineTab';
import DealsTab from './crm/DealsTab';
import AutomationsTab from './crm/AutomationsTab';
import SchedulingTab from './crm/SchedulingTab';
import ContactProfile from './crm/ContactProfile';
import DashboardTab from './crm/DashboardTab';
import RevenueHub from './RevenueHub';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 48, textAlign: 'center', color: '#E54B4B' }}>
        <h3>Error en el componente</h3>
        <pre style={{ fontSize: '0.75rem', color: '#888', marginTop: 12, textAlign: 'left', maxWidth: 600, margin: '12px auto', background: '#f5f5f5', padding: 16, borderRadius: 8, overflow: 'auto' }}>{this.state.error}</pre>
      </div>
    );
    return this.props.children;
  }
}

type Tab = 'dashboard' | 'pipeline' | 'deals' | 'agenda' | 'automations' | 'clientes' | 'cotizaciones' | 'pagos' | 'config';

// SVG icons (Squarespace-style, clean strokes)
const ICONS: Record<string, string> = {
  dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  pipeline: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
  deals: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  clientes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  cotizaciones: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  pagos: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  agenda: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  automations: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  config: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
};

const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { id: 'dashboard' as Tab, label: 'Dashboard', icon: 'dashboard' },
      { id: 'pipeline' as Tab, label: 'Contactos', icon: 'pipeline' },
      { id: 'deals' as Tab, label: 'Deals', icon: 'deals' },
      { id: 'clientes' as Tab, label: 'Clientes', icon: 'clientes' },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { id: 'cotizaciones' as Tab, label: 'Cotizaciones', icon: 'cotizaciones' },
      { id: 'pagos' as Tab, label: 'Pagos', icon: 'pagos' },
      { id: 'agenda' as Tab, label: 'Agenda', icon: 'agenda' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { id: 'automations' as Tab, label: 'Automatizaciones', icon: 'automations' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { id: 'config' as Tab, label: 'Configuración', icon: 'config' },
    ],
  },
];

function getInitialTab(): Tab {
  if (typeof window === 'undefined') return 'dashboard';
  const params = new URLSearchParams(window.location.search);
  const t = params.get('tab') as Tab | null;
  const allIds = NAV_SECTIONS.flatMap(s => s.items.map(i => i.id));
  if (t && allIds.includes(t)) return t;
  return 'dashboard';
}

export default function CrmDashboard() {
  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [profileContactId, setProfileContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest?.('.crm-search-wrapper')) setShowSearch(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const switchTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    history.replaceState(null, '', url.toString());
  };

  const revenueTab = (['clientes', 'cotizaciones', 'pagos', 'config'].includes(tab)) ? tab : 'dashboard';
  const sidebarWidth = sidebarCollapsed ? 60 : 220;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', background: '#f5f6f8', display: 'flex' }}>
      {/* ─── Sidebar ─── */}
      <div style={{
        width: sidebarWidth, flexShrink: 0, background: '#fff', color: '#1a1a1a',
        display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 110, overflow: 'hidden',
        borderRight: '1px solid #e8e8e8',
      }}>
        {/* Logo */}
        <div style={{
          padding: sidebarCollapsed ? '16px 0' : '16px 20px', display: 'flex', alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          borderBottom: '1px solid #f0f0f0', minHeight: 56,
        }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Clash Display',sans-serif", fontSize: '1.25rem', fontWeight: 700, color: '#1a1a1a' }}>Sacs</span>
              <span style={{
                fontSize: '0.5rem', fontWeight: 700, color: '#4B7BE5',
                background: 'rgba(75,123,229,0.06)', padding: '2px 6px', borderRadius: 3,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>CRM</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              background: 'none', border: 'none', color: '#ccc',
              cursor: 'pointer', fontSize: '1rem', padding: 4,
            }}
          >{sidebarCollapsed ? '→' : '←'}</button>
        </div>

        {/* Search (sidebar) */}
        {!sidebarCollapsed && (
          <div style={{ padding: '12px 16px' }}>
            <div className="crm-search-wrapper" style={{ position: 'relative' }}>
              <input
                value={searchQuery}
                onChange={async (e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length >= 2) {
                    const res = await fetch(`/api/crm/search?q=${encodeURIComponent(e.target.value)}`);
                    const data = await res.json();
                    setSearchResults(data.results || []);
                    setShowSearch(true);
                  } else { setShowSearch(false); }
                }}
                onFocus={() => { if (searchResults.length) setShowSearch(true); }}
                placeholder="Buscar..."
                style={{
                  width: '100%', padding: '8px 10px 8px 30px', fontSize: '0.75rem',
                  border: '1px solid #e8e8e8', borderRadius: 8,
                  background: '#fafafa', color: '#1a1a1a', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              {showSearch && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                  background: '#fff', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                  maxHeight: 300, overflowY: 'auto', zIndex: 300,
                }}>
                  {searchResults.map((r: any, i: number) => {
                    const icons: Record<string, string> = { contact: '👤', company: '🏢', deal: '💰', quote: '📄' };
                    const colors: Record<string, string> = { contact: '#4B7BE5', company: '#6C5CE7', deal: '#2AB5A0', quote: '#F39C12' };
                    return (
                      <div key={i} onClick={() => { if (r.type === 'contact') setProfileContactId(r.id); setShowSearch(false); setSearchQuery(''); }}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8f9fb'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
                      >
                        <span>{icons[r.type] || '📎'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nombre || r.numero || r.empresa}</div>
                          <div style={{ fontSize: '0.625rem', color: '#999' }}>{r.email || r.plan || r.stage || ''}</div>
                        </div>
                        <span style={{ fontSize: '0.5rem', fontWeight: 700, color: colors[r.type] || '#999', background: (colors[r.type] || '#999') + '15', padding: '1px 5px', borderRadius: 8 }}>{r.type}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Nav sections */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.label} style={{ marginBottom: 8 }}>
              {!sidebarCollapsed && (
                <div style={{
                  padding: '6px 20px', fontSize: '0.5625rem', fontWeight: 700,
                  color: '#bbb', textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}>{section.label}</div>
              )}
              {section.items.map(item => {
                const isActive = tab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => switchTab(item.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      gap: sidebarCollapsed ? 0 : 10,
                      justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                      padding: sidebarCollapsed ? '10px 0' : '8px 20px',
                      background: isActive ? '#f5f5f5' : 'transparent',
                      color: isActive ? '#1a1a1a' : '#888',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: '0.8125rem', fontWeight: isActive ? 600 : 400,
                      borderLeft: isActive ? '3px solid #1a1a1a' : '3px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, color: isActive ? '#1a1a1a' : '#aaa' }} dangerouslySetInnerHTML={{ __html: ICONS[item.icon] || '' }} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        {!sidebarCollapsed && (
          <div style={{
            padding: '12px 20px', borderTop: '1px solid #f0f0f0',
            fontSize: '0.625rem', color: '#ccc',
          }}>
            <a href="/" style={{ color: '#aaa', textDecoration: 'none', fontSize: '0.6875rem' }}>← Volver al sitio</a>
          </div>
        )}
      </div>

      {/* ─── Main Content ─── */}
      <div style={{ flex: 1, marginLeft: sidebarWidth, transition: 'margin-left 0.2s ease', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Content */}
        {tab === 'dashboard' ? (
          <ErrorBoundary><DashboardTab /></ErrorBoundary>
        ) : tab === 'pipeline' ? (
          <PipelineTab />
        ) : tab === 'deals' ? (
          <DealsTab />
        ) : tab === 'agenda' ? (
          <SchedulingTab />
        ) : tab === 'automations' ? (
          <ErrorBoundary><AutomationsTab /></ErrorBoundary>
        ) : (
          <RevenueHub _initialTab={revenueTab as any} _hideNav={true} />
        )}
      </div>

      {/* Contact Profile Overlay */}
      {profileContactId && (
        <ContactProfile contactId={profileContactId} onClose={() => setProfileContactId(null)} />
      )}
    </div>
  );
}
