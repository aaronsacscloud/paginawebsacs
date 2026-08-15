import { useState, useEffect, useRef, Component } from 'react';
import type { ReactNode } from 'react';
import { useIsMobile, isTouchDevice } from '../../lib/ui/mobile';
import BottomNav from './crm/ui/BottomNav';
import ActionSheet from './crm/ui/ActionSheet';
import Sheet from './crm/ui/Sheet';
import PipelineTab from './crm/PipelineTab';
import DealsTab from './crm/DealsTab';
import AutomationsTab from './crm/AutomationsTab';
import SchedulingTab from './crm/SchedulingTab';
import PasarelaMercadoPago from './crm/PasarelaMercadoPago';
import CampanaNotificaciones from './crm/CampanaNotificaciones';
import ContactProfile from './crm/ContactProfile';
import DashboardTab from './crm/DashboardTab';
import PartnersTab from './crm/PartnersTab';
import CommissionsTab from './crm/CommissionsTab';
import ContentReviewTab from './crm/ContentReviewTab';
import RevenueHub from './RevenueHub';
import ClientesTab from './crm/ClientesTab';
import MejorasTab from './crm/MejorasTab';
import ReunionesTab from './crm/ReunionesTab';
import SubscriptionsTab from './crm/SubscriptionsTab';
import PagosTab from './crm/PagosTab';
import PipelinesConfig from './crm/PipelinesConfig';
import AgendaHoy from './crm/AgendaHoy';
import SacsUsuariosTab from './crm/SacsUsuariosTab';
import OportunidadesTab from './crm/OportunidadesTab';

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

type Tab = 'dashboard' | 'hoy' | 'pipeline' | 'deals' | 'agenda' | 'reuniones' | 'automations' | 'clientes' | 'suscripciones' | 'cotizaciones' | 'pagos' | 'config' | 'pipelines' | 'agents' | 'desempeno' | 'partners' | 'commissions' | 'content-review' | 'sacs' | 'oportunidades' | 'cobros' | 'mejoras';

// SVG icons (Squarespace-style, clean strokes)
// Iconos a dos tonos: una silueta rellena con la MISMA tinta del renglón al 18 %
// y el trazo encima. Al activarse no cambia solo el color de la línea —la
// silueta se tiñe con él—, así que el dibujo acompaña al estado en vez de
// quedarse gris.
//
// De paso se corrigieron tres que decían otra cosa: Clientes era una casa (se
// lee "inicio", no una cuenta), Leads era un grupo de personas idéntico al de
// Colaboradores, y Oportunidades era un rayo, que ahí no significa nada.
const ICONS: Record<string, string> = {
  hoy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" opacity=".18"/><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity=".18"/><rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.8"/></svg>',
  pipeline: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 5h18l-7 8v6l-4 2v-8z" fill="currentColor" opacity=".18"/><path d="M3 5h18l-7 8v6l-4 2v-8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  clientes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" fill="currentColor" opacity=".18"/><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M9 8h1.5M13.5 8H15M9 12h1.5M13.5 12H15M10 21v-4h4v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  deals: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 17l5-5 4 3 7-8v13H4z" fill="currentColor" opacity=".18"/><path d="M4 17l5-5 4 3 7-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h5v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  agenda: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" fill="currentColor" opacity=".18"/><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  cotizaciones: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 3h9l4 4v14H6z" fill="currentColor" opacity=".18"/><path d="M6 3h9l4 4v14H6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  pagos: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" fill="currentColor" opacity=".18"/><rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M2 10h20" stroke="currentColor" stroke-width="1.8"/><path d="M6 15h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  suscripciones: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18"/><path d="M19 12a7 7 0 11-2.1-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 4.5V8h-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  mejoras: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l2 5.5L19.5 10 14 12l-2 5.5L10 12 4.5 10 10 8.5z" fill="currentColor" opacity=".18"/><path d="M12 3l2 5.5L19.5 10 14 12l-2 5.5L10 12 4.5 10 10 8.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  oportunidades: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="1.8"/></svg>',
  automations: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="7" width="16" height="12" rx="3" fill="currentColor" opacity=".18"/><rect x="4" y="7" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v4M9 12h.01M15 12h.01M9.5 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  partners: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="4" fill="currentColor" opacity=".18"/><circle cx="9" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M2 21v-1.5A5.5 5.5 0 017.5 14h3a5.5 5.5 0 015.5 5.5V21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18 10.5l2 2 3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  config: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  sacs: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="8" rx="2" fill="currentColor" opacity=".18"/><rect x="2" y="3" width="20" height="8" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="2" y="13" width="20" height="8" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M6 7h.01M6 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

// El pie son SALIDAS, no destinos: mismos iconos de línea que el menú pero más
// chicos, sobre un fondo apenas distinto. Sin emoji, como el resto del módulo.
const ICONO_SALIR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
const ICONO_ATRAS = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>';
/** AA de "Aaron Araujo"; si solo hay correo, sus dos primeras letras. */
const iniciales = (n?: string | null) => {
  const t = String(n || '').trim();
  if (!t) return '—';
  const p = t.split(/[\s@.]+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || t.slice(0, 2).toUpperCase();
};
const ICONO_PLEGAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><polyline points="11 17 6 12 11 7"/><line x1="18" y1="7" x2="18" y2="17"/></svg>';
// Los renglones del pie pesan como los del menú: mismo alto y mismo tipo de
// letra. Antes eran ligas de 11 px que había que buscar.
const pieFila = {
  display: 'flex', alignItems: 'center', gap: 11, width: 'calc(100% - 16px)', minHeight: 38,
  margin: '1px 8px', padding: '7px 10px', borderRadius: 9,
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: '0.79rem', fontWeight: 700, textAlign: 'left' as const,
} as const;
const pieIcono = { display: 'flex', alignItems: 'center', flexShrink: 0 } as const;

const NAV_SECTIONS = [
  // Agrupado por el SUJETO de cada pantalla, no por "lo importante primero":
  // el grupo "Principal" era un cajón de sastre donde convivían un tablero, una
  // lista de pendientes, los leads, los clientes y un radar.
  //
  // Los títulos son los de la consultoría —cuentas, facturación,
  // acompañamiento— y no los del software: "acompañamiento" ya es una palabra
  // que se usa en los filtros de Clientes.
  {
    // Sin título: lo que se abre todos los días no necesita presentación.
    label: '',
    items: [
      { id: 'hoy' as Tab, label: 'Hoy', icon: 'hoy' },
      { id: 'dashboard' as Tab, label: 'Tablero', icon: 'dashboard' },
    ],
  },
  {
    label: 'Cuentas',
    items: [
      { id: 'pipeline' as Tab, label: 'Leads', icon: 'pipeline' },
      { id: 'clientes' as Tab, label: 'Clientes', icon: 'clientes' },
      { id: 'deals' as Tab, label: 'Oportunidades', icon: 'deals' },
      // Reuniones se junta con las cuentas: es con quien te sientas. Antes
      // vivía en Ventas y su gemela "Agenda" en Sistema, en grupos distintos.
      { id: 'reuniones' as Tab, label: 'Reuniones', icon: 'agenda' },
    ],
  },
  {
    label: 'Facturación',
    items: [
      { id: 'cotizaciones' as Tab, label: 'Cotizaciones', icon: 'cotizaciones' },
      { id: 'pagos' as Tab, label: 'Pagos', icon: 'pagos' },
      { id: 'suscripciones' as Tab, label: 'Suscripciones · ARR', icon: 'suscripciones' },
    ],
  },
  {
    label: 'Acompañamiento',
    items: [
      { id: 'mejoras' as Tab, label: 'Mejoras e ideas', icon: 'mejoras' },
      { id: 'oportunidades' as Tab, label: 'Radar de ventas', icon: 'oportunidades' },
    ],
  },
  {
    // "Marketing" agrupaba un solo renglón. Un grupo de uno no agrupa nada.
    label: 'Automatización',
    items: [
      { id: 'automations' as Tab, label: 'Automatizaciones', icon: 'automations' },
      { id: 'agents' as Tab, label: 'Agentes IA', icon: 'automations' },
    ],
  },
  {
    label: 'Colaboradores',
    items: [
      { id: 'partners' as Tab, label: 'Partners', icon: 'partners' },
      { id: 'commissions' as Tab, label: 'Comisiones', icon: 'pagos' },
      { id: 'content-review' as Tab, label: 'Revisar contenido', icon: 'automations' },
      // "Mi desempeño" no tiene nada de IA: es tu marcador.
      { id: 'desempeno' as Tab, label: 'Mi desempeño', icon: 'dashboard' },
    ],
  },
  {
    // Se llama Ajustes y no Configuración para no chocar con el botón del pie,
    // que lleva a otra pantalla.
    label: 'Ajustes',
    items: [
      { id: 'pipelines' as Tab, label: 'Pipelines', icon: 'pipeline' },
      { id: 'cobros' as Tab, label: 'Cobro con Mercado Pago', icon: 'pagos' },
    ],
  },
];

function getInitialTab(): Tab {
  if (typeof window === 'undefined') return 'dashboard';
  const params = new URLSearchParams(window.location.search);
  const t = params.get('tab') as Tab | null;
  // 'agenda' y 'config' ya no son renglones del menú —la primera es una vista
  // dentro de Reuniones y la segunda vive en el pie—, pero las ligas viejas y
  // los enlaces guardados tienen que seguir llevando a donde llevaban.
  const allIds = [...NAV_SECTIONS.flatMap(s => s.items.map(i => i.id)), 'agenda', 'config', 'sacs'];
  if (t && allIds.includes(t)) return t;
  // Mobile aterriza en "Hoy" (inbox diario); desktop en Dashboard.
  if (window.matchMedia('(max-width: 899px)').matches) return 'hoy';
  return 'dashboard';
}

// Destinos del BottomNav mobile (el resto vive en "Más").
const BOTTOM_IDS: Tab[] = ['hoy', 'dashboard', 'clientes', 'deals'];

export default function CrmDashboard() {
  const [tab, setTab] = useState<Tab>(getInitialTab);
  // Pipeline preseleccionado al abrir la config de etapas desde un segmento
  // (Leads / Oportunidades / Clientes → "⚙️ Configurar etapas").
  const [pipelineTipo, setPipelineTipo] = useState<string>('lead');
  const goConfigPipeline = (tipo: string) => { setPipelineTipo(tipo); switchTab('pipelines'); };
  const [profileContactId, setProfileContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Compromisos con fecha vencida en TODAS las cuentas. Se pide una vez al
  // entrar: es la única cifra del menú y solo aparece cuando hay algo tarde.
  const [vencidasMenu, setVencidasMenu] = useState(0);
  const [yo, setYo] = useState<any>(null);
  useEffect(() => {
    let vivo = true;
    fetch('/api/crm/mejoras').then(r => r.json())
      .then(j => { if (vivo) setVencidasMenu((j.vencidas || []).length); }).catch(() => {});
    fetch('/api/auth/yo').then(r => r.json())
      .then(j => { if (vivo && !j.error) setYo(j); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  const isMobile = useIsMobile();
  const searchRef = useRef<HTMLInputElement>(null);
  // Shell mobile: sheet "Más", búsqueda fullscreen y deal a abrir directo.
  const [masOpen, setMasOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [initialDealId, setInitialDealId] = useState<string | null>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  // Auto-colapsar el sidebar al entrar a layout mobile.
  useEffect(() => { if (isMobile) setSidebarCollapsed(true); }, [isMobile]);
  useEffect(() => { if (mobileSearchOpen) setTimeout(() => mobileSearchRef.current?.focus(), 120); }, [mobileSearchOpen]);

  // Cmd/Ctrl+K → enfoca la búsqueda global (abre el sidebar si está colapsado).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSidebarCollapsed(false);
        setTimeout(() => searchRef.current?.focus(), 60);
      }
      if (e.key === 'Escape') setShowSearch(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest?.('.crm-search-wrapper')) setShowSearch(false);
    };
    document.addEventListener('click', close);
    return () => {
      document.removeEventListener('click', close);
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
          position: 'fixed', top: 12, left: 12, zIndex: 108, width: 44, height: 44,
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
      {/* La campana vive en el pie del menú, junto a quién eres. Solo vuelve a
          flotar cuando el menú está plegado o en mobile, donde no hay pie que
          la contenga: lo que pasó solo tiene que verse sin ir a buscarlo. */}
      {(isMobile || sidebarCollapsed) && <CampanaNotificaciones onIrA={(t) => switchTab(t as Tab)} />}
      {/* Lupa mobile: búsqueda global a 2 taps sin abrir el sidebar */}
      {isMobile && sidebarCollapsed && (
        <button onClick={() => setMobileSearchOpen(true)} style={{
          position: 'fixed', top: 12, left: 64, zIndex: 108, width: 44, height: 44,
          background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }} aria-label="Buscar">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>
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
          padding: sidebarCollapsed ? '16px 0' : '15px 20px 14px', display: 'flex', alignItems: sidebarCollapsed ? 'center' : 'flex-start',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between', gap: 10,
          borderBottom: '1px solid #f0f0f0', minHeight: 56,
        }}>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {/* Marca en un solo bloque, como el selector de cuenta del
                  sistema: distintivo, nombre y firma se leen como una unidad. */}
              <span style={{ width: 30, height: 30, borderRadius: 99, background: 'linear-gradient(135deg,#9B8CFA,#7DA6F5)', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: '1.02rem', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.15 }}>
                  Sacs <span style={{ fontSize: '0.5rem', fontWeight: 800, color: '#5B4BD6', background: '#EEECFE', padding: '3px 6px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.08em', verticalAlign: 'middle' }}>CRM</span>
                </div>
                {/* La firma en el rosa de los filtros, bajo el nombre. */}
                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#9c3d70', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2, whiteSpace: 'nowrap' }}>
                  by Andy Araujo
                </div>
              </div>
            </div>
          )}
          {/* Plegado, este es el único modo de volver a abrir; expandido, la
              flecha vive abajo, junto a lo demás que se toca. */}
          {(sidebarCollapsed || isMobile) && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
              style={{
                background: 'none', border: 'none', color: '#ccc',
                cursor: 'pointer', fontSize: '1rem',
                width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: -10,
              }}
            >{sidebarCollapsed ? '→' : '←'}</button>
          )}
        </div>

        {/* Search (sidebar) */}
        {!sidebarCollapsed && (
          <div style={{ padding: '12px 16px' }}>
            <div className="crm-search-wrapper" style={{ position: 'relative' }}>
              <input
                ref={searchRef}
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
                placeholder={isTouchDevice() ? 'Buscar…' : 'Buscar…  (⌘K)'}
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
                      <div key={i} onClick={() => {
                          if (r.type === 'contact') setProfileContactId(r.id);
                          else if (r.type === 'deal') { setInitialDealId(r.id); switchTab('deals'); }
                          else if (r.type === 'company') switchTab('clientes');
                          else if (r.type === 'quote') switchTab('cotizaciones');
                          setShowSearch(false); setSearchQuery('');
                        }}
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
          {NAV_SECTIONS.map((section, si) => (
            <div key={section.label || si} style={{ marginBottom: 4 }}>
              {/* Una línea fina entre bloques: agrupa igual que el título, sin
                  gastar un renglón de texto. */}
              {si > 0 && !sidebarCollapsed && <div style={{ height: 1, background: '#f0eff3', margin: '6px 12px 2px' }} />}
              {!sidebarCollapsed && section.label && (
                <div style={{
                  padding: '10px 18px 3px', fontSize: '0.54rem', fontWeight: 800,
                  color: '#c9c7d0', textTransform: 'uppercase',
                  letterSpacing: '0.13em',
                }}>{section.label}</div>
              )}
              {section.items.map(item => {
                const isActive = tab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => switchTab(item.id)}
                    style={{
                      // Pastilla con aire a los lados, no franja pegada al
                      // borde: el activo se despega y el menú respira.
                      width: sidebarCollapsed ? '100%' : 'calc(100% - 16px)',
                      display: 'flex', alignItems: 'center',
                      gap: sidebarCollapsed ? 0 : 11,
                      justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                      padding: sidebarCollapsed ? '10px 0' : '7px 10px',
                      margin: sidebarCollapsed ? 0 : '1px 8px',
                      minHeight: sidebarCollapsed ? 44 : 38,
                      borderRadius: sidebarCollapsed ? 0 : 9,
                      background: isActive ? '#EEECFE' : 'transparent',
                      color: isActive ? '#5B4BD6' : '#4a4a52',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: '0.79rem', fontWeight: isActive ? 800 : 600,
                      // Un <button> centra su texto: al partirse en dos
                      // renglones, "Cobro con Mercado Pago" quedaba centrado y
                      // desalineado del resto del menú.
                      textAlign: 'left' as const, lineHeight: 1.3,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#faf8ff'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, flexShrink: 0, alignSelf: 'flex-start', marginTop: 1, color: isActive ? '#9B8CFA' : '#9c99a6' }} dangerouslySetInnerHTML={{ __html: ICONS[item.icon] || '' }} />
                    {!sidebarCollapsed && <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>}
                    {/* El único contador del menú, y solo cuando urge: un
                        compromiso con fecha que ya pasó. Poner números en todos
                        los renglones los convertiría en adorno y este dejaría
                        de verse. */}
                    {!sidebarCollapsed && item.id === 'mejoras' && vencidasMenu > 0 && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 800, background: '#FEF0EF', color: '#C0554E', borderRadius: 20, padding: '2px 7px' }}>{vencidasMenu}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer.
            Deja de ser una lista de ligas chiquitas: notificaciones y
            configuración son renglones completos, quién eres vive en su propio
            panel, y abajo una barra con plegar el menú y salir. */}
        {!sidebarCollapsed && (
          <div style={{ borderTop: '1px solid #ece7fa', background: '#faf8ff' }}>
            <div style={{ padding: '8px 0 2px' }}>
              {!isMobile && <CampanaNotificaciones onIrA={(t) => switchTab(t as Tab)} enMenu />}

              <button onClick={() => switchTab('config' as Tab)} style={{ ...pieFila, background: tab === 'config' ? '#EEECFE' : 'none', color: tab === 'config' ? '#5B4BD6' : '#5a5a63' }}>
                <span style={{ ...pieIcono, color: '#9B8CFA' }} dangerouslySetInnerHTML={{ __html: ICONS.config }} />Configuración
              </button>

              <a href="/" style={{ ...pieFila, color: '#a5a2af', fontWeight: 600, textDecoration: 'none' }}>
                <span style={{ ...pieIcono, color: '#b3b1bb' }} dangerouslySetInnerHTML={{ __html: ICONO_ATRAS }} />Volver al sitio
              </a>
            </div>

            {/* Quién entró. El día que haya más de una persona en el CRM, saber
                con qué cuenta estás parado deja de ser un adorno. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', margin: '6px 10px', borderRadius: 11, background: '#EEECFE' }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: '#fff', color: '#5B4BD6', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {iniciales(yo?.nombre || yo?.email)}
              </span>
              <span style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {yo?.nombre || yo?.email || '—'}
                </div>
                {yo?.rol && (
                  /* El rol es una etiqueta que describe, no un botón: por eso va
                     en el rosa de la firma y en pastilla chica. */
                  <span style={{ display: 'inline-block', fontSize: '0.55rem', fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', borderRadius: 5, padding: '2px 7px', marginTop: 4, background: 'rgba(244,168,205,.42)', color: '#9c3d70' }}>
                    {yo.rol}
                  </span>
                )}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderTop: '1px solid #ece7fa', background: '#f3efff' }}>
              <button onClick={() => setSidebarCollapsed(true)} aria-label="Plegar menú"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9c99a6', display: 'flex', padding: 0 }}
                dangerouslySetInnerHTML={{ __html: ICONO_PLEGAR }} />
              <button
                onClick={async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {} window.location.href = '/admin/login'; }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#C0554E', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'inherit' }}>
                <span style={pieIcono} dangerouslySetInnerHTML={{ __html: ICONO_SALIR }} />Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Main Content ─── */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: '100%', marginLeft: mainMarginLeft, transition: 'margin-left 0.2s ease', display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingTop: isMobile ? 64 : 0, paddingBottom: isMobile ? 'var(--crm-bottomnav-h, 64px)' : 0 }}>
        {/* Content */}
        {tab === 'dashboard' ? (
          <ErrorBoundary><DashboardTab /></ErrorBoundary>
        ) : tab === 'hoy' ? (
          <ErrorBoundary><AgendaHoy onOpenContact={(id) => setProfileContactId(id)} onGoDeals={() => switchTab('deals')} /></ErrorBoundary>
        ) : tab === 'pipeline' ? (
          <PipelineTab onConfig={() => goConfigPipeline('lead')} />
        ) : tab === 'deals' ? (
          <DealsTab onConfig={() => goConfigPipeline('oportunidad')} initialDealId={initialDealId} onDealConsumed={() => setInitialDealId(null)} />
        ) : tab === 'suscripciones' ? (
          <ErrorBoundary><SubscriptionsTab /></ErrorBoundary>
        ) : tab === 'cobros' ? (
          <ErrorBoundary><div style={{ padding: '4px 12px 28px' }}><PasarelaMercadoPago /></div></ErrorBoundary>
        ) : tab === 'agenda' || tab === 'reuniones' ? (
          /* Reuniones y Agenda eran dos entradas del menú, en grupos distintos,
             para el mismo tema: las juntas que ya tienes y los horarios en que
             te pueden agendar. Ahora es una sola con dos vistas. */
          <div>
            <div style={{ display: 'flex', gap: 6, padding: '18px 24px 0' }}>
              {([['reuniones', 'Reuniones'], ['agenda', 'Horarios y tipos']] as const).map(([id, l]) => {
                const on = tab === id;
                return (
                  <button key={id} onClick={() => switchTab(id as Tab)} style={{
                    padding: '9px 16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: on ? '#EEECFE' : 'transparent', color: on ? '#5B4BD6' : '#666',
                    borderRadius: '9px 9px 0 0', borderBottom: on ? '2px solid #9B8CFA' : '2px solid transparent',
                    fontWeight: on ? 800 : 500, fontSize: '0.8125rem', marginBottom: -1,
                  }}>{l}</button>
                );
              })}
            </div>
            <div style={{ borderTop: '1px solid #ececec' }}>
              {tab === 'reuniones'
                ? <ReunionesTab onOpenContact={(id) => setProfileContactId(id)} />
                : <SchedulingTab />}
            </div>
          </div>
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
        ) : tab === 'mejoras' ? (
          <ErrorBoundary><MejorasTab /></ErrorBoundary>
        ) : tab === 'pagos' ? (
          <ErrorBoundary><PagosTab /></ErrorBoundary>
        ) : tab === 'clientes' ? (
          <ClientesTab onConfig={() => goConfigPipeline('cliente')} />
        ) : tab === 'sacs' ? (
          <ErrorBoundary><SacsUsuariosTab /></ErrorBoundary>
        ) : tab === 'oportunidades' ? (
          <ErrorBoundary><OportunidadesTab /></ErrorBoundary>
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

      {/* ─── Shell MOBILE: BottomNav + "Más" + búsqueda fullscreen ─── */}
      {isMobile && !mobileExpanded && (
        <BottomNav
          activeId={BOTTOM_IDS.includes(tab) ? tab : '__mas'}
          onSelect={(id) => { if (id === '__mas') setMasOpen(true); else switchTab(id as Tab); }}
          items={[
            ...BOTTOM_IDS.map(id => {
              const item = NAV_SECTIONS.flatMap(s => s.items).find(i => i.id === id)!;
              return { id, label: id === 'deals' ? 'Oportun.' : item.label, icon: ICONS[item.icon] || '' };
            }),
            { id: '__mas', label: 'Más', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>' },
          ]}
        />
      )}
      <ActionSheet
        open={masOpen}
        onClose={() => setMasOpen(false)}
        title="Más secciones"
        items={[
          ...NAV_SECTIONS.flatMap(section =>
            section.items
              .filter(i => !BOTTOM_IDS.includes(i.id))
              .map(i => ({
                label: section.label ? `${section.label} · ${i.label}` : i.label,
                icon: <span style={{ display: 'flex', width: 20, color: '#8a8f98' }} dangerouslySetInnerHTML={{ __html: ICONS[i.icon] || '' }} />,
                active: tab === i.id,
                onClick: () => switchTab(i.id),
              }))
          ),
          { label: '🔑 Cambiar contraseña', onClick: () => { window.location.href = '/admin/cambiar-password'; } },
          { label: '⎋ Cerrar sesión', danger: true, onClick: async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* noop */ } window.location.href = '/admin/login'; } },
        ]}
      />
      <Sheet open={mobileSearchOpen} onClose={() => { setMobileSearchOpen(false); setSearchQuery(''); setSearchResults([]); }} title="Buscar" zIndex={920}>
        <input
          ref={mobileSearchRef}
          value={searchQuery}
          onChange={async (e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.length >= 2) {
              try {
                const res = await fetch(`/api/crm/search?q=${encodeURIComponent(e.target.value)}`);
                const data = await res.json();
                setSearchResults(data.results || []);
              } catch { /* red */ }
            } else setSearchResults([]);
          }}
          placeholder="Cliente, contacto, cotización…"
          style={{ width: '100%', padding: '12px 14px', fontSize: 16, border: '1px solid #e3e5e9', borderRadius: 10, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
        />
        {searchResults.map((r: any, i: number) => {
          const icons: Record<string, string> = { contact: '👤', company: '🏢', deal: '💰', quote: '📄' };
          return (
            <button key={i}
              onClick={() => {
                setMobileSearchOpen(false); setSearchQuery(''); setSearchResults([]);
                if (r.type === 'contact') setProfileContactId(r.id);
                else if (r.type === 'deal') { setInitialDealId(r.id); switchTab('deals'); }
                else if (r.type === 'company') switchTab('clientes');
                else if (r.type === 'quote') switchTab('cotizaciones');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, padding: '10px 6px', border: 'none', borderBottom: '1px solid #f4f5f8', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: '1.05rem' }}>{icons[r.type] || '📎'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre || r.numero || r.empresa}</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#999' }}>{r.email || r.plan || r.stage || r.type}</span>
              </span>
            </button>
          );
        })}
        {searchQuery.length >= 2 && !searchResults.length && (
          <div style={{ color: '#999', fontSize: '0.85rem', padding: 12 }}>Sin resultados para “{searchQuery}”.</div>
        )}
      </Sheet>
    </div>
  );
}

/* HOJA MOBILE CENTRAL del CRM. Los estilos de los tabs son objetos JS inline
 * (ganan en especificidad normal) → aquí se usan !important dentro de media
 * queries: desktop NUNCA entra a estas reglas, así que no cambia nada ≥900px. */
const CRM_MOBILE_CSS = `
  @media (max-width: 899px) {
    body { overflow-x: hidden; }
    /* iOS hace auto-zoom al enfocar inputs con font-size < 16px. Un solo golpe
       para los ~20 tabs sin tocar los objetos E/D/S/M. */
    input, select, textarea { font-size: 16px !important; }
    /* Toasts y bottom-fixed respetando el notch/home-indicator */
    .crm-toast-bottom { bottom: calc(16px + env(safe-area-inset-bottom)) !important; }
    /* Filas de menús/dropdowns con target táctil en mobile */
    .te-item { min-height: 48px !important; }
  }
  /* Grids de 2 columnas (opt-in): colapsan a 1 col en teléfonos angostos */
  @media (max-width: 560px) {
    .crm-2col { grid-template-columns: 1fr !important; }
  }
  /* Wrapper estándar para tablas anchas: scroll interno, nunca corta columnas */
  .crm-scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%; }
  /* Touch: revelar controles que en desktop dependen de hover + feedback táctil */
  @media (hover: none) {
    .ct360 .ct-pencil { opacity: 0.65 !important; }
    .te-item:active, .crm-row:active { background: #eef1f6 !important; }
  }
`;
