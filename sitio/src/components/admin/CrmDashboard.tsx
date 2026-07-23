import { useState, useEffect, Component } from 'react';
import type { ReactNode } from 'react';
import PipelineTab from './crm/PipelineTab';
import DealsTab from './crm/DealsTab';
import AutomationsTab from './crm/AutomationsTab';
import SchedulingTab from './crm/SchedulingTab';
import ContactProfile from './crm/ContactProfile';
import DashboardTab from './crm/DashboardTab';
import PartnersTab from './crm/PartnersTab';
import CommissionsTab from './crm/CommissionsTab';
import ContentReviewTab from './crm/ContentReviewTab';
import RevenueHub from './RevenueHub';
import ClientesTab from './crm/ClientesTab';
import ReunionesTab from './crm/ReunionesTab';
import SubscriptionsTab from './crm/SubscriptionsTab';
import PagosTab from './crm/PagosTab';
import PipelinesConfig from './crm/PipelinesConfig';

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

type Tab = 'dashboard' | 'pipeline' | 'deals' | 'agenda' | 'reuniones' | 'automations' | 'clientes' | 'suscripciones' | 'cotizaciones' | 'pagos' | 'config' | 'pipelines' | 'agents' | 'desempeno' | 'partners' | 'commissions' | 'content-review';

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
  partners: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11l-3 3-1.5-1.5"/></svg>',
};

const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { id: 'dashboard' as Tab, label: 'Dashboard', icon: 'dashboard' },
      { id: 'pipeline' as Tab, label: 'Leads', icon: 'pipeline' },
      { id: 'deals' as Tab, label: 'Oportunidades', icon: 'deals' },
      { id: 'clientes' as Tab, label: 'Clientes', icon: 'clientes' },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { id: 'suscripciones' as Tab, label: 'Suscripciones · ARR', icon: 'pagos' },
      { id: 'cotizaciones' as Tab, label: 'Cotizaciones', icon: 'cotizaciones' },
      { id: 'pagos' as Tab, label: 'Pagos', icon: 'pagos' },
      { id: 'reuniones' as Tab, label: 'Reuniones', icon: 'agenda' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { id: 'automations' as Tab, label: 'Automatizaciones', icon: 'automations' },
    ],
  },
  {
    label: 'Partners',
    items: [
      { id: 'partners' as Tab, label: 'Partners', icon: 'partners' },
      { id: 'commissions' as Tab, label: 'Comisiones', icon: 'pagos' },
      { id: 'content-review' as Tab, label: 'Revisar contenido', icon: 'automations' },
    ],
  },
  {
    label: 'IA',
    items: [
      { id: 'agents' as Tab, label: 'Agentes IA', icon: 'automations' },
      { id: 'desempeno' as Tab, label: 'Mi desempeño', icon: 'dashboard' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { id: 'agenda' as Tab, label: 'Agenda', icon: 'agenda' },
      { id: 'pipelines' as Tab, label: 'Pipelines', icon: 'pipeline' },
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
  // Pipeline preseleccionado al abrir la config de etapas desde un segmento
  // (Leads / Oportunidades / Clientes → "⚙️ Configurar etapas").
  const [pipelineTipo, setPipelineTipo] = useState<string>('lead');
  const goConfigPipeline = (tipo: string) => { setPipelineTipo(tipo); setTab('pipelines'); };
  const [profileContactId, setProfileContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest?.('.crm-search-wrapper')) setShowSearch(false);
    };
    document.addEventListener('click', close);

    // Detectar mobile y auto-colapsar
    const checkMobile = () => {
      const mobile = window.innerWidth < 900;
      setIsMobile(mobile);
      if (mobile) setSidebarCollapsed(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      document.removeEventListener('click', close);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const switchTab = (t: Tab) => {
    setTab(t);
    if (isMobile) setSidebarCollapsed(true);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    history.replaceState(null, '', url.toString());
  };

  const revenueTab = (['cotizaciones', 'config'].includes(tab)) ? tab : 'dashboard';
  // En mobile, cuando expanded el sidebar es overlay (no empuja el contenido)
  const mobileExpanded = isMobile && !sidebarCollapsed;
  const sidebarWidth = sidebarCollapsed ? (isMobile ? 0 : 60) : 220;
  const mainMarginLeft = isMobile ? 0 : sidebarWidth;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', background: '#f5f6f8', display: 'flex' }}>
      <style dangerouslySetInnerHTML={{ __html: CRM_MOBILE_CSS }} />
      {/* Backdrop mobile cuando sidebar overlay abierto */}
      {mobileExpanded && (
        <div onClick={() => setSidebarCollapsed(true)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 109,
        }} />
      )}
      {/* Hamburger button mobile (visible solo cuando sidebar colapsado) */}
      {isMobile && sidebarCollapsed && (
        <button onClick={() => setSidebarCollapsed(false)} style={{
          position: 'fixed', top: 12, left: 12, zIndex: 108, width: 40, height: 40,
          background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }} aria-label="Abrir menú">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7"/>
            <line x1="4" y1="12" x2="20" y2="12"/>
            <line x1="4" y1="17" x2="20" y2="17"/>
          </svg>
        </button>
      )}
      {/* ─── Sidebar ─── */}
      <div style={{
        width: mobileExpanded ? 260 : sidebarWidth, flexShrink: 0, background: '#fff', color: '#1a1a1a',
        display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease, transform 0.2s ease',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 110, overflow: 'hidden',
        borderRight: '1px solid #e8e8e8',
        transform: (isMobile && sidebarCollapsed) ? 'translateX(-100%)' : 'translateX(0)',
        boxShadow: mobileExpanded ? '4px 0 24px rgba(0,0,0,0.18)' : 'none',
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
            fontSize: '0.6875rem', color: '#aaa', display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <a href="/admin/cambiar-password" style={{ color: '#888', textDecoration: 'none' }}>🔑 Cambiar contraseña</a>
            <button
              onClick={async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {} window.location.href = '/admin/login'; }}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#888', fontSize: '0.6875rem', fontFamily: 'inherit', textAlign: 'left' }}>
              ⎋ Cerrar sesión
            </button>
            <a href="/" style={{ color: '#aaa', textDecoration: 'none' }}>← Volver al sitio</a>
          </div>
        )}
      </div>

      {/* ─── Main Content ─── */}
      <div style={{ flex: 1, marginLeft: mainMarginLeft, transition: 'margin-left 0.2s ease', display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingTop: isMobile ? 60 : 0 }}>
        {/* Content */}
        {tab === 'dashboard' ? (
          <ErrorBoundary><DashboardTab /></ErrorBoundary>
        ) : tab === 'pipeline' ? (
          <PipelineTab onConfig={() => goConfigPipeline('lead')} />
        ) : tab === 'deals' ? (
          <DealsTab onConfig={() => goConfigPipeline('oportunidad')} />
        ) : tab === 'suscripciones' ? (
          <ErrorBoundary><SubscriptionsTab /></ErrorBoundary>
        ) : tab === 'agenda' ? (
          <SchedulingTab />
        ) : tab === 'automations' ? (
          <ErrorBoundary><AutomationsTab /></ErrorBoundary>
        ) : tab === 'partners' ? (
          <ErrorBoundary><PartnersTab /></ErrorBoundary>
        ) : tab === 'commissions' ? (
          <ErrorBoundary><CommissionsTab /></ErrorBoundary>
        ) : tab === 'content-review' ? (
          <ErrorBoundary><ContentReviewTab /></ErrorBoundary>
        ) : tab === 'agents' ? (
          <div style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 700 }}>Agentes IA</h2>
            <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: 20 }}>
              Dashboard completo de agentes con kill switches, approvals y traces.
            </p>
            <a href="/admin/agents" target="_blank" style={{
              display: 'inline-block', padding: '10px 18px', background: '#1a1a1a', color: '#fff',
              borderRadius: 6, textDecoration: 'none', fontWeight: 600, fontSize: '0.8125rem'
            }}>Abrir dashboard de agentes →</a>
            <div style={{ marginTop: 24, padding: 16, background: '#fafafa', borderRadius: 8, fontSize: '0.8125rem', color: '#555', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Agentes disponibles:</div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li><strong>hello_agent</strong> — demo + smoke test infra</li>
                <li><strong>meeting_prep</strong> — brief antes de demos (manual / event-triggered)</li>
                <li><strong>quote_drafter</strong> — transcripción → cotización (HITL)</li>
                <li><strong>service_recommender</strong> — sugerencias de add-ons (auto)</li>
                <li><strong>churn_watchdog</strong> — análisis de riesgo cada 6h (auto, cron)</li>
                <li><strong>lead_distributor</strong> — routing automático de leads (auto, rules-only)</li>
              </ul>
            </div>
          </div>
        ) : tab === 'desempeno' ? (
          <div style={{ padding: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 700 }}>Mi desempeño</h2>
            <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: 20 }}>
              MRR, comisiones, pipeline, leaderboard. Partners ven solo lo suyo; founder ve agregado.
            </p>
            <a href="/app/dashboard?user_id=YOUR_USER_ID" target="_blank" style={{
              display: 'inline-block', padding: '10px 18px', background: '#1a1a1a', color: '#fff',
              borderRadius: 6, textDecoration: 'none', fontWeight: 600, fontSize: '0.8125rem'
            }}>Abrir dashboard de desempeño →</a>
            <div style={{ marginTop: 12, fontSize: '0.75rem', color: '#888' }}>
              Reemplaza YOUR_USER_ID con tu team_members.id
            </div>
          </div>
        ) : tab === 'reuniones' ? (
          <ReunionesTab onOpenContact={(id) => setProfileContactId(id)} />
        ) : tab === 'pagos' ? (
          <ErrorBoundary><PagosTab /></ErrorBoundary>
        ) : tab === 'clientes' ? (
          <ClientesTab onConfig={() => goConfigPipeline('cliente')} />
        ) : tab === 'pipelines' ? (
          <ErrorBoundary><PipelinesConfig initialTipo={pipelineTipo} /></ErrorBoundary>
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

const CRM_MOBILE_CSS = `
  @media (max-width: 900px) {
    body { overflow-x: hidden; }
  }
`;
