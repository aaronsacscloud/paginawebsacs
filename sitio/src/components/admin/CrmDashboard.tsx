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

type Tab = 'pipeline' | 'deals' | 'agenda' | 'automations' | 'clientes' | 'cotizaciones' | 'pagos' | 'dashboard' | 'config';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pipeline', label: 'Contactos' },
  { id: 'deals', label: 'Deals' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'automations', label: 'Automatizaciones' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'cotizaciones', label: 'Cotizaciones' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'config', label: 'Config' },
];

function getInitialTab(): Tab {
  if (typeof window === 'undefined') return 'pipeline';
  const params = new URLSearchParams(window.location.search);
  const t = params.get('tab') as Tab | null;
  if (t && TABS.some(tab => tab.id === t)) return t;
  return 'pipeline';
}

export default function CrmDashboard() {
  const [tab, setTab] = useState<Tab>(getInitialTab);
  const [profileContactId, setProfileContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const close = () => setShowSearch(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const switchTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    history.replaceState(null, '', url.toString());
  };

  // Map CRM tab to RevenueHub tab
  const revenueTab = (['clientes', 'cotizaciones', 'pagos', 'config'].includes(tab)) ? tab : 'dashboard';

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', background: '#f5f6f8', display: 'flex', flexDirection: 'column' }}>
      {/* Nav Bar */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #eee', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0', marginRight: 32 }}>
            <span style={{ fontFamily: "'Clash Display',sans-serif", fontSize: '1.25rem', fontWeight: 700 }}>Sacs</span>
            <span style={{
              fontSize: '0.5625rem', fontWeight: 700, color: '#4B7BE5',
              background: 'rgba(75,123,229,0.08)', padding: '2px 8px', borderRadius: 4,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>CRM</span>
          </div>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              style={{
                padding: '14px 16px', fontSize: '0.8125rem',
                fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? '#1a1a1a' : '#999',
                background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid #1a1a1a' : '2px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >{t.label}</button>
          ))}
        </div>
        {/* Global Search */}
        <div style={{ position: 'relative', marginLeft: 'auto' }} onClick={e => e.stopPropagation()}>
          <input
            value={searchQuery}
            onChange={async (e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.length >= 2) {
                const res = await fetch(`/api/crm/search?q=${encodeURIComponent(e.target.value)}`);
                const data = await res.json();
                setSearchResults(data.results || []);
                setShowSearch(true);
              } else {
                setShowSearch(false);
              }
            }}
            onFocus={() => { if (searchResults.length) setShowSearch(true); }}
            placeholder="Buscar contactos, empresas, deals..."
            style={{
              padding: '6px 12px 6px 32px', fontSize: '0.8125rem',
              border: '1px solid #e0e0e0', borderRadius: 8, outline: 'none',
              fontFamily: 'inherit', width: 240, background: '#fafafa',
            }}
          />
          {/* Search icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          {/* Results dropdown */}
          {showSearch && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              width: 320, maxHeight: 400, overflowY: 'auto',
              background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid #f0f0f0', zIndex: 200,
            }}>
              {searchResults.map((r: any, i: number) => {
                const typeLabel = ({ contact: '\u{1F464}', company: '\u{1F3E2}', deal: '\u{1F4B0}', quote: '\u{1F4C4}' } as Record<string, string>)[r.type] || '';
                const typeColor = ({ contact: '#4B7BE5', company: '#6C5CE7', deal: '#2AB5A0', quote: '#F39C12' } as Record<string, string>)[r.type] || '#999';
                return (
                  <div key={i}
                    onClick={() => {
                      if (r.type === 'contact') setProfileContactId(r.id);
                      setShowSearch(false);
                      setSearchQuery('');
                    }}
                    style={{
                      padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                      display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8125rem',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8f9fb'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
                  >
                    <span style={{ fontSize: '1rem' }}>{typeLabel}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{r.nombre || r.numero || r.empresa}</div>
                      <div style={{ fontSize: '0.6875rem', color: '#999' }}>
                        {r.email || r.plan || r.stage || r.estado || ''}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: typeColor, background: typeColor + '15', padding: '2px 6px', borderRadius: 10 }}>
                      {r.type}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {tab === 'pipeline' ? (
        <PipelineTab />
      ) : tab === 'deals' ? (
        <DealsTab />
      ) : tab === 'agenda' ? (
        <SchedulingTab />
      ) : tab === 'automations' ? (
        <ErrorBoundary><AutomationsTab /></ErrorBoundary>
      ) : tab === 'dashboard' ? (
        <ErrorBoundary><DashboardTab /></ErrorBoundary>
      ) : (
        <RevenueHub _initialTab={revenueTab as any} _hideNav={true} />
      )}

      {/* Contact Profile Overlay */}
      {profileContactId && (
        <ContactProfile contactId={profileContactId} onClose={() => setProfileContactId(null)} />
      )}
    </div>
  );
}
