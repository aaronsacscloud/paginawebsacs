import { useState } from 'react';
import PipelineTab from './crm/PipelineTab';
import DealsTab from './crm/DealsTab';
import AutomationsTab from './crm/AutomationsTab';
import ContactProfile from './crm/ContactProfile';
import RevenueHub from './RevenueHub';

type Tab = 'pipeline' | 'deals' | 'automations' | 'clientes' | 'cotizaciones' | 'pagos' | 'dashboard' | 'config';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pipeline', label: 'Contactos' },
  { id: 'deals', label: 'Deals' },
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

  const switchTab = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    history.replaceState(null, '', url.toString());
  };

  // Map CRM tab to RevenueHub tab
  const revenueTab = (['clientes', 'cotizaciones', 'pagos', 'dashboard', 'config'].includes(tab)) ? tab : 'dashboard';

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
      </div>

      {/* Content */}
      {tab === 'pipeline' ? (
        <PipelineTab />
      ) : tab === 'deals' ? (
        <DealsTab />
      ) : tab === 'automations' ? (
        <AutomationsTab />
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
