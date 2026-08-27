import { useState, useEffect, useRef, Component } from 'react';
import { WRAP } from '../../lib/crm/layout';
import type { ReactNode } from 'react';
import { useIsMobile, isTouchDevice } from '../../lib/ui/mobile';
import BottomNav from './crm/ui/BottomNav';
import MasScreen from './crm/ui/MasScreen';
import InicioMovil from './crm/InicioMovil';
import ActionSheet from './crm/ui/ActionSheet';
import Sheet from './crm/ui/Sheet';
import DealsTab from './crm/DealsTab';
import AutomationsTab from './crm/AutomationsTab';
import EmailTab from './crm/email/EmailTab';
import OutboundTab from './crm/outbound/OutboundTab';
import WhatsAppTab from './crm/whatsapp/WhatsAppTab';
import WaMasivos from './crm/whatsapp/Masivos';
import ConfigWhatsApp from './crm/whatsapp/ConfigWhatsApp';
import MetricasWA from './crm/whatsapp/MetricasWA';
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
import LeadsTab from './crm/LeadsTab';
import MejorasTab from './crm/MejorasTab';
import MarcaTab from './crm/MarcaTab';
import CobranzaTab from './crm/CobranzaTab';
import ReunionesTab from './crm/ReunionesTab';
import SubscriptionsTab from './crm/SubscriptionsTab';
import PagosTab from './crm/PagosTab';
import PipelinesConfig from './crm/PipelinesConfig';
import AgendaHoy from './crm/AgendaHoy';
import SacsUsuariosTab from './crm/SacsUsuariosTab';
import OportunidadesTab from './crm/OportunidadesTab';
import SoporteTab from './crm/soporte/SoporteTab';

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

type Tab = 'dashboard' | 'hoy' | 'pipeline' | 'deals' | 'agenda' | 'reuniones' | 'automations' | 'clientes' | 'suscripciones' | 'cotizaciones' | 'pagos' | 'config' | 'pipelines' | 'agents' | 'desempeno' | 'partners' | 'commissions' | 'content-review' | 'sacs' | 'oportunidades' | 'cobros' | 'mejoras' | 'cobranza' | 'marca' | 'email' | 'whatsapp' | 'wa-masivos' | 'wa-plantillas' | 'wa-metricas' | 'wa-numero' | 'wa-config' | 'outbound' | 'soporte';

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
  marca: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="9.5" r="5.5" fill="currentColor" opacity=".18"/><circle cx="12" cy="9.5" r="5.5" stroke="currentColor" stroke-width="1.8"/><path d="M9 14.5 8 22l4-2.2L16 22l-1-7.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  clientes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" fill="currentColor" opacity=".18"/><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M9 8h1.5M13.5 8H15M9 12h1.5M13.5 12H15M10 21v-4h4v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  deals: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 17l5-5 4 3 7-8v13H4z" fill="currentColor" opacity=".18"/><path d="M4 17l5-5 4 3 7-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h5v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  agenda: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="3" fill="currentColor" opacity=".18"/><rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M8 3v4M16 3v4M3 10h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  cotizaciones: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 3h9l4 4v14H6z" fill="currentColor" opacity=".18"/><path d="M6 3h9l4 4v14H6z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  pagos: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" fill="currentColor" opacity=".18"/><rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M2 10h20" stroke="currentColor" stroke-width="1.8"/><path d="M6 15h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  suscripciones: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18"/><path d="M19 12a7 7 0 11-2.1-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 4.5V8h-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  mejoras: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l2 5.5L19.5 10 14 12l-2 5.5L10 12 4.5 10 10 8.5z" fill="currentColor" opacity=".18"/><path d="M12 3l2 5.5L19.5 10 14 12l-2 5.5L10 12 4.5 10 10 8.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  oportunidades: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="1.8"/></svg>',
  whatsapp: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.4-1.15A8.5 8.5 0 1 0 12 3.5z" fill="currentColor" opacity=".18"/><path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.4-1.15A8.5 8.5 0 1 0 12 3.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.8 12h.01M12 12h.01M15.2 12h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  'wa-metricas': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="12" width="4" height="8" rx="1" fill="currentColor" opacity=".18"/><rect x="10" y="7" width="4" height="13" rx="1" fill="currentColor" opacity=".18"/><rect x="4" y="12" width="4" height="8" rx="1" stroke="currentColor" stroke-width="1.8"/><rect x="10" y="7" width="4" height="13" rx="1" stroke="currentColor" stroke-width="1.8"/><rect x="16" y="3" width="4" height="17" rx="1" stroke="currentColor" stroke-width="1.8"/></svg>',
  'wa-masivos': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 10v4l10 4V6L4 10z" fill="currentColor" opacity=".18"/><path d="M4 10v4l10 4V6L4 10z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M17 9.5a3.5 3.5 0 0 1 0 5M6.5 14.5V18a1.5 1.5 0 0 0 3 0v-2.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  'wa-numero': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="7" y="2" width="10" height="20" rx="2.5" fill="currentColor" opacity=".18"/><rect x="7" y="2" width="10" height="20" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M11 18h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  'wa-plantillas': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2.5" fill="currentColor" opacity=".18"/><rect x="5" y="3" width="14" height="18" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M9 8h6M9 12h6M9 16h3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  automations: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="7" width="16" height="12" rx="3" fill="currentColor" opacity=".18"/><rect x="4" y="7" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M12 3v4M9 12h.01M15 12h.01M9.5 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  partners: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="4" fill="currentColor" opacity=".18"/><circle cx="9" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M2 21v-1.5A5.5 5.5 0 017.5 14h3a5.5 5.5 0 015.5 5.5V21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18 10.5l2 2 3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  config: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".18"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  outbound: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 10v4l11 5V5L3 10z" fill="currentColor" opacity=".18"/><path d="M3 10v4l11 5V5L3 10z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M17 9a4 4 0 010 6M7 14.5V18a2 2 0 002 2h1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  sacs: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="8" rx="2" fill="currentColor" opacity=".18"/><rect x="2" y="3" width="20" height="8" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="2" y="13" width="20" height="8" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M6 7h.01M6 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

// El pie son SALIDAS, no destinos: mismos iconos de línea que el menú pero más
// chicos, sobre un fondo apenas distinto. Sin emoji, como el resto del módulo.
const ICONO_SALIR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
/** AA de "Aaron Araujo"; si solo hay correo, sus dos primeras letras. */
const iniciales = (n?: string | null) => {
  const t = String(n || '').trim();
  if (!t) return '—';
  const p = t.split(/[\s@.]+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || t.slice(0, 2).toUpperCase();
};
/* La chispa de la marca. Sin caja: el símbolo solo, en el degradado de la
 * firma (morado → rosa). Se genera por tamaño porque el id del degradado tiene
 * que ser único — dos SVG con el mismo id y el segundo hereda el del primero. */
const CHISPA = (px: number) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" aria-hidden="true">`
  + `<defs><linearGradient id="chispa-${px}" x1="0" y1="0" x2="1" y2="1">`
  + `<stop offset="0%" stop-color="#9B8CFA"/><stop offset="100%" stop-color="#D9538E"/></linearGradient></defs>`
  + `<path d="M12 1.6c.62 6.6 3.18 9.16 9.78 9.78-6.6.62-9.16 3.18-9.78 9.78-.62-6.6-3.18-9.16-9.78-9.78C8.82 10.76 11.38 8.2 12 1.6z" fill="url(#chispa-${px})"/></svg>`;

const ICONO_FLECHA = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

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
    // "Hoy" salió del menú —lo que avisaba ya lo avisa la campana— y "Tablero"
    // se llama Dashboard, que es como se le dice en voz alta. La pantalla de
    // Hoy sigue existiendo para las ligas viejas (?tab=hoy).
    label: '',
    items: [
      { id: 'dashboard' as Tab, label: 'Dashboard', icon: 'dashboard' },
    ],
  },
  {
    label: 'Cuentas', sec: 'cuentas', icon: 'clientes',
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
    label: 'Facturación', sec: 'facturacion', icon: 'cotizaciones',
    items: [
      { id: 'cotizaciones' as Tab, label: 'Cotizaciones', icon: 'cotizaciones' },
      // Pagos se comió a Cobranza: eran el mismo trabajo —el dinero— visto en
      // dos momentos, y "Por cobrar" salía duplicado en las dos pantallas.
      // Ahora Cobranza es la vista "Recuperación" de adentro de Pagos.
      { id: 'pagos' as Tab, label: 'Pagos', icon: 'pagos' },
      { id: 'suscripciones' as Tab, label: 'Suscripciones · ARR', icon: 'suscripciones' },
    ],
  },
  {
    label: 'Acompañamiento', sec: 'acompanamiento', icon: 'mejoras',
    items: [
      { id: 'mejoras' as Tab, label: 'Consultoría', icon: 'mejoras' },
      { id: 'oportunidades' as Tab, label: 'Radar de ventas', icon: 'oportunidades' },
      { id: 'soporte' as Tab, label: 'Soporte', icon: 'automations' },
    ],
  },
  {
    /* WhatsApp deja de ser CUATRO renglones sueltos del menú: sus pantallas
       —conversaciones, masivos, métricas, configuración— son vistas del mismo
       canal, no cuatro módulos. Eran 4 de las 19 entradas. */
    label: 'WhatsApp', sec: 'automatizacion', icon: 'whatsapp',
    items: [
      { id: 'whatsapp' as Tab, label: 'Conversaciones', icon: 'whatsapp' },
      { id: 'wa-masivos' as Tab, label: 'Masivos', icon: 'wa-masivos' },
      { id: 'wa-metricas' as Tab, label: 'Métricas', icon: 'wa-metricas' },
      { id: 'wa-config' as Tab, label: 'Configuración', icon: 'wa-plantillas' },
    ],
  },
  {
    // Se queda con lo que de verdad CORRE SOLO. Antes cargaba también con todo
    // WhatsApp, que es un canal que se atiende a mano.
    label: 'Automatización', sec: 'automatizacion', icon: 'automations',
    items: [
      // Email vive junto a las automatizaciones porque es la misma pregunta
      // ("qué le llega solo al cliente"), vista desde el canal.
      { id: 'email' as Tab, label: 'Email marketing', icon: 'automations' },
      { id: 'outbound' as Tab, label: 'Outbound', icon: 'outbound' },
      { id: 'automations' as Tab, label: 'Automatizaciones', icon: 'automations' },
      { id: 'agents' as Tab, label: 'Agentes IA', icon: 'automations' },
    ],
  },
  {
    // "Colaboradores" no decía qué había adentro. Son los partners y lo que se
    // les paga; "Mi desempeño" se viene con ellos porque es el mismo tablero.
    label: 'Partners', sec: 'colaboradores', icon: 'partners',
    items: [
      { id: 'partners' as Tab, label: 'Partners', icon: 'partners' },
      { id: 'commissions' as Tab, label: 'Comisiones', icon: 'pagos' },
      { id: 'content-review' as Tab, label: 'Revisar contenido', icon: 'automations' },
      { id: 'desempeno' as Tab, label: 'Mi desempeño', icon: 'dashboard' },
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
  // Cobranza dejó de ser pestaña y es una vista de Pagos. Las ligas guardadas
  // (y la campana, que manda destino='cobranza') tienen que seguir llegando.
  if (t === 'cobranza') {
    const u = new URL(window.location.href);
    u.searchParams.set('tab', 'pagos');
    u.searchParams.set('vista', 'recuperacion');
    window.history.replaceState({}, '', u);
    return 'pagos';
  }
  const allIds = [...NAV_SECTIONS.flatMap(s => s.items.map(i => i.id)), 'agenda', 'config', 'sacs', 'hoy', 'pipelines', 'marca', 'cobros', 'cobranza'];
  if (t && allIds.includes(t)) return t;
  return 'dashboard';
}

// Destinos del BottomNav mobile (el resto vive en "Más").
// Decisión del dueño (goal mobile-first v5): Inicio · Leads · Clientes · Inbox.
// Leads y Clientes van SEPARADOS (como en escritorio) y el Inbox de WhatsApp es
// EL caso de uso móvil. La Agenda vive en Inicio ("Hoy") y en Más.
const BOTTOM_IDS: Tab[] = ['dashboard', 'pipeline', 'clientes', 'whatsapp'];
// Cómo se llama cada destino en la barra (más corto que el label del sidebar).
const BOTTOM_LABELS: Record<string, string> = { dashboard: 'Inicio', pipeline: 'Leads', clientes: 'Clientes', whatsapp: 'Inbox' };

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
  /* El menú PLEGADO enseña un icono por GRUPO, no uno por pantalla. Pintando
     cada renglón salían 19 iconos en una tira que ni cabía, y los grupos que el
     menú abierto ya tiene desaparecían justo cuando más falta hacen. Tocar un
     grupo abre este volado con sus pantallas: se llega a cualquiera sin
     desplegar el menú, o sea sin devolver el ancho que da tenerlo plegado. */
  const [flyGrupo, setFlyGrupo] = useState<{ label: string; y: number } | null>(null);
  useEffect(() => { if (!sidebarCollapsed) setFlyGrupo(null); }, [sidebarCollapsed]);
  // Compromisos con fecha vencida en TODAS las cuentas. Se pide una vez al
  // entrar: es la única cifra del menú y solo aparece cuando hay algo tarde.
  const [vencidasMenu, setVencidasMenu] = useState(0);
  const [yo, setYo] = useState<any>(null);
  useEffect(() => {
    let vivo = true;
    fetch('/api/crm/mejoras').then(r => r.json())
      .then(j => { if (vivo) setVencidasMenu((j.vencidas || []).length); }).catch(() => {});
    const traerYo = () => fetch('/api/auth/yo').then(r => r.json())
      .then(j => { if (vivo && !j.error) setYo(j); }).catch(() => {});
    traerYo();
    // Al guardar el perfil (nombre o foto) el pie del menú se actualiza sin
    // recargar: es lo primero que uno mira para comprobar que sí guardó.
    const alGuardar = () => traerYo();
    window.addEventListener('sacs-perfil', alGuardar);
    // Configuración se abre a pantalla completa y se cierra con su X: avisa
    // aquí para volver a donde se estaba, no a una pantalla cualquiera.
    const alCerrarConfig = () => switchTab(volverDeConfig.current);
    window.addEventListener('sacs-cerrar-config', alCerrarConfig);
    // Un aviso que manda a otra sección tiene que poder llevarte: el de
    // Consultoría ("tienes N revisiones") apunta a Soporte, y sin esto habría
    // que buscarla a mano en el menú, que es justo lo que el aviso evita.
    const alIrTab = (e: Event) => {
      const destino = (e as CustomEvent).detail;
      if (typeof destino === 'string') switchTab(destino as Tab);
    };
    window.addEventListener('sacs-ir-tab', alIrTab);
    return () => {
      vivo = false;
      window.removeEventListener('sacs-perfil', alGuardar);
      window.removeEventListener('sacs-cerrar-config', alCerrarConfig);
      window.removeEventListener('sacs-ir-tab', alIrTab);
    };
  }, []);
  // Las secciones que esta persona puede ver. Mientras carga se muestra todo:
  // parpadear el menú completo y luego recortarlo se lee como un error.
  const permisos = (yo?.permisos || null) as Record<string, string> | null;
  /* Acordeón: UN grupo abierto a la vez. Con los 19 módulos desplegados el
     menú medía 25 renglones y había que hacer scroll dentro de él para llegar
     a Partners. Así siempre mide lo mismo. */
  const grupoDeTab = (t: Tab) => NAV_SECTIONS.find(g => g.items.some(i => i.id === t))?.label || null;
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(() => grupoDeTab(getInitialTab()));
  // Al cambiar de pantalla (buscador global, atajo, link) se abre su grupo: si
  // no, el menú se queda enseñando otro y uno no sabe dónde está parado.
  useEffect(() => { const g = grupoDeTab(tab); if (g) setGrupoAbierto(g); }, [tab]);

  const seccionesVisibles = NAV_SECTIONS.filter(sec => {
    const k = (sec as any).sec as string | undefined;
    if (!k || !permisos) return true;
    return permisos[k] !== 'no';
  });
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

  // De dónde se venía al abrir Configuración: su X devuelve ahí, no a una
  // pantalla cualquiera.
  const volverDeConfig = useRef<Tab>('dashboard');
  const switchTab = (t: Tab) => {
    setTab(prev => { if (t === 'config' && prev !== 'config') volverDeConfig.current = prev; return t; });
    if (isMobile) setSidebarCollapsed(true);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    history.replaceState(null, '', url.toString());
  };

  // El inbox de WhatsApp quiere TODA la pantalla: al entrar, el menú se
  // pliega solo y al salir vuelve como estaba. Solo escritorio (en móvil ya
  // se pliega con cada cambio de tab). Si el usuario lo expande a mano dentro
  // del inbox, se respeta: esto solo actúa en la TRANSICIÓN de tab.
  const colapsoPrevio = useRef<boolean | null>(null);
  useEffect(() => {
    if (isMobile) return;
    if (tab === 'whatsapp') {
      if (colapsoPrevio.current === null) {
        colapsoPrevio.current = sidebarCollapsed;
        setSidebarCollapsed(true);
      }
    } else if (colapsoPrevio.current !== null) {
      setSidebarCollapsed(colapsoPrevio.current);
      colapsoPrevio.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isMobile]);

  const revenueTab = (['cotizaciones', 'config'].includes(tab)) ? tab : 'dashboard';
  // En mobile, cuando expanded el sidebar es overlay (no empuja el contenido)
  const mobileExpanded = isMobile && !sidebarCollapsed;
  // En mobile no hay pie de menú donde vivir: las notificaciones entran como
  // un renglón de la hoja "Más" y esta bandera abre su panel.
  const [notifOpen, setNotifOpen] = useState(false);
  const sidebarWidth = sidebarCollapsed ? (isMobile ? 0 : 64) : 220;
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
      {/* App bar móvil: el título del tab orienta y la lupa busca. El hamburger
          desapareció a propósito — la navegación completa vive en la barra
          inferior y en "Más" (el sidebar overlay quedó como código inerte). */}
      {isMobile && sidebarCollapsed && (
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 108,
          height: 'calc(56px + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          background: '#fff', borderBottom: '1px solid #efeef2',
          display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 20, paddingRight: 10,
        }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: '1.06rem', fontWeight: 800, letterSpacing: '-0.015em', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {masOpen ? 'Más' : (BOTTOM_LABELS[tab] || NAV_SECTIONS.flatMap(s => s.items).find(i => i.id === tab)?.label || 'CRM')}
          </span>
          <button onClick={() => setMobileSearchOpen(true)} style={{
            width: 44, height: 44, background: 'none', border: 'none', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }} aria-label="Buscar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>
            </svg>
          </button>
        </header>
      )}
      {/* La campana NO flota. Vivía suelta arriba a la derecha cuando el menú
          estaba plegado o en mobile, y ahí tapaba contenido de la pantalla que
          se estaba usando —el railito del inbox fue solo el caso más visible—.
          Su único lugar es el pie del menú, junto a quién eres. */}

      {/* ─── Sidebar ───
          Papel lila —el degradado de la cinta de la cotización— con el renglón
          activo en tarjeta blanca. Se invierte la figura a propósito: el
          contenido de la derecha es blanco, así que el menú se separa solo sin
          necesidad de una línea, y el activo se ve de reojo entre veinte
          renglones. */}
      <div style={{
        width: mobileExpanded ? 260 : sidebarWidth, flexShrink: 0,
        background: 'linear-gradient(180deg,#FBFAFF 0%,#F6F3FE 55%,#F4EFFC 100%)', color: '#4b4560',
        display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease, transform 0.2s ease',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 110, overflow: 'hidden',
        borderRight: '1px solid #eae4f8',
        transform: (isMobile && sidebarCollapsed) ? 'translateX(-100%)' : 'translateX(0)',
        boxShadow: mobileExpanded ? '4px 0 24px rgba(60,30,140,0.18)' : 'none',
      }}>
        {/* Logo */}
        <div style={{
          padding: sidebarCollapsed ? '14px 0 12px' : '13px 14px 12px', display: 'flex', alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start', gap: 9,
          borderBottom: '1px solid #ece7fa', minHeight: 56,
        }}>
          {/* La chispa. Antes era un círculo con degradado y NADA adentro:
              ocupaba el lugar de un logo sin serlo, y plegado el menú se
              quedaba sin marca. Va sin caja —el símbolo solo, en el degradado
              de la firma— porque el papel del menú ya es lila y una caja más
              encima lo ensucia. */}
          <span style={{ width: 29, height: 29, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            dangerouslySetInnerHTML={{ __html: CHISPA(27) }} />
          {!sidebarCollapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: '0.98rem', fontWeight: 700, color: '#241d43', lineHeight: 1.1 }}>
                Sacs <span style={{ fontSize: '0.47rem', fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg,#9B8CFA,#7DA6F5)', padding: '2px 5px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.09em', verticalAlign: 'middle' }}>CRM</span>
              </div>
              {/* La firma lleva el degradado del contador de la cotización,
                  pero saltándose el tramo azul claro: a 8 px en mayúsculas ese
                  azul se lee grisáceo sobre el papel lila y la palabra de en
                  medio se apagaba. Va del morado al rosa de la firma. */}
              <div style={{
                fontSize: '0.53rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                marginTop: 3, whiteSpace: 'nowrap',
                background: 'linear-gradient(100deg,#7C6BF0 0%,#8E7DEF 35%,#D9538E 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>
                by Andy Araujo
              </div>
            </div>
          )}
          {/* El control de plegar se fue AL PIE. Aquí arriba quedaba pegado a
              "Cerrar sesión" del otro extremo y se confundían: ahora están en
              lados opuestos del menú. */}
        </div>

        {/* Search (sidebar) */}
        {!sidebarCollapsed && (
          <div style={{ padding: '10px 12px 6px' }}>
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
                  border: '1px solid #eae4f8', borderRadius: 9,
                  background: '#fff', color: '#241d43', outline: 'none',
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
          {seccionesVisibles.map((section, si) => (
            <div key={section.label || si} style={{ marginBottom: 4 }}>
              {/* Una línea fina entre bloques: agrupa igual que el título, sin
                  gastar un renglón de texto. */}
              {si > 0 && !sidebarCollapsed && <div style={{ height: 1, background: '#ece7fa', margin: '6px 12px 2px' }} />}
              {si > 0 && sidebarCollapsed && <div style={{ height: 1, background: '#e7e0f7', margin: '7px auto', width: 26 }} />}
              {/* El título del grupo deja de ser un rótulo muerto y se vuelve
                  el botón que lo abre. Cerrado, un punto morado dice cuál
                  contiene la pantalla en la que estás — sin eso uno se pierde
                  al plegar. */}
              {!sidebarCollapsed && section.label && (() => {
                const abierto = grupoAbierto === section.label;
                const tieneActivo = section.items.some(i => i.id === tab);
                return (
                  <button
                    onClick={() => setGrupoAbierto(abierto ? null : section.label!)}
                    aria-expanded={abierto}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      width: 'calc(100% - 16px)', margin: '1px 8px', padding: '8px 10px',
                      border: 'none', background: 'transparent', borderRadius: 9, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: '0.79rem', textAlign: 'left' as const,
                      fontWeight: tieneActivo ? 800 : 700,
                      color: tieneActivo ? '#4C3BD0' : '#4b4560',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.62)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{ display: 'flex', width: 20, flexShrink: 0, justifyContent: 'center', color: tieneActivo ? '#7C6BF0' : '#a49dbd' }}
                      dangerouslySetInnerHTML={{ __html: ICONS[section.items[0]?.icon] || '' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>{section.label}</span>
                    {tieneActivo && !abierto && (
                      <span style={{ width: 6, height: 6, borderRadius: 99, background: '#9B8CFA', flexShrink: 0 }} />
                    )}
                    <span style={{ display: 'flex', width: 14, flexShrink: 0, color: '#b3aecb', transform: abierto ? 'rotate(90deg)' : 'none', transition: 'transform .18s ease' }}
                      dangerouslySetInnerHTML={{ __html: ICONO_FLECHA }} />
                  </button>
                );
              })()}
              {/* Plegado y con grupo: UN botón por grupo, no uno por pantalla. */}
              {sidebarCollapsed && section.label && (() => {
                const contieneActiva = section.items.some(i => i.id === tab);
                const urge = section.items.some(i => i.id === 'mejoras') && vencidasMenu > 0;
                const abierto = flyGrupo?.label === section.label;
                return (
                  <button title={section.label}
                    onClick={e => {
                      if (abierto) { setFlyGrupo(null); return; }
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setFlyGrupo({ label: section.label, y: r.top });
                    }}
                    style={{
                      position: 'relative', width: 44, minHeight: 40, margin: '2px auto',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      background: contieneActiva || abierto ? '#fff' : 'transparent',
                      boxShadow: contieneActiva || abierto ? '0 2px 10px rgba(60,30,140,.10)' : 'none',
                      color: contieneActiva ? '#4C3BD0' : '#4b4560',
                      transition: 'background .15s ease, box-shadow .15s ease',
                    }}
                    onMouseEnter={e => { if (!contieneActiva && !abierto) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.62)'; }}
                    onMouseLeave={e => { if (!contieneActiva && !abierto) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <span style={{ display: 'flex', width: 20, color: contieneActiva ? '#7C6BF0' : '#a49dbd' }}
                      dangerouslySetInnerHTML={{ __html: ICONS[(section as any).icon] || ICONS[section.items[0].icon] || '' }} />
                    {/* Sin el punto, un pendiente vencido queda invisible en
                        cuanto se pliega el menú: el contador vive en el renglón
                        de Consultoría, que aquí ya no se pinta. */}
                    {urge && <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 99, background: '#C0554E' }} />}
                  </button>
                );
              })()}
              {((sidebarCollapsed && !section.label) || (!sidebarCollapsed && (!section.label || grupoAbierto === section.label))) && section.items.map(item => {
                const isActive = tab === item.id;
                /* Dentro de un grupo abierto, el renglón se sangra y cambia su
                   icono por un punto: con el icono puesto se veía igual que la
                   cabecera y no se entendía que colgaba de ella. */
                const enGrupo = !sidebarCollapsed && !!section.label;
                return (
                  <button
                    key={item.id}
                    onClick={() => switchTab(item.id)}
                    // Plegado no hay texto: el nombre lo dice el globito del
                    // sistema, que además no se puede quedar pegado en pantalla.
                    title={sidebarCollapsed ? item.label : undefined}
                    style={{
                      // Tarjeta blanca con aire a los lados, no franja pegada
                      // al borde: el activo se levanta del papel lila.
                      position: 'relative',
                      width: sidebarCollapsed ? 44 : 'calc(100% - 16px)',
                      display: 'flex', alignItems: 'center',
                      gap: sidebarCollapsed ? 0 : 11,
                      justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                      padding: sidebarCollapsed ? 0 : (enGrupo ? '7px 10px 7px 38px' : '7px 10px'),
                      margin: sidebarCollapsed ? '2px auto' : '1px 8px',
                      minHeight: sidebarCollapsed ? 40 : 38,
                      borderRadius: sidebarCollapsed ? 11 : 9,
                      background: isActive ? '#fff' : 'transparent',
                      boxShadow: isActive ? '0 2px 10px rgba(60,30,140,.10)' : 'none',
                      color: isActive ? '#4C3BD0' : '#4b4560',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: '0.79rem', fontWeight: isActive ? 800 : 600,
                      // Un <button> centra su texto: al partirse en dos
                      // renglones, "Cobro con Mercado Pago" quedaba centrado y
                      // desalineado del resto del menú.
                      textAlign: 'left' as const, lineHeight: 1.3,
                      transition: 'background 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.62)'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {/* El filo morado→rosa del activo: la misma cinta del
                        documento, de canto. */}
                    {isActive && !sidebarCollapsed && (
                      <span style={{ position: 'absolute', left: -8, top: 6, bottom: 6, width: 3, borderRadius: '0 3px 3px 0', background: 'linear-gradient(180deg,#9B8CFA,#D9538E)' }} />
                    )}
                    {enGrupo
                      ? <span style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', width: 5, height: 5, borderRadius: 99, background: isActive ? '#9B8CFA' : '#c9c4d8', flexShrink: 0 }} />
                      : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, flexShrink: 0, alignSelf: sidebarCollapsed ? 'center' : 'flex-start', marginTop: sidebarCollapsed ? 0 : 1, color: isActive ? '#7C6BF0' : '#a49dbd' }} dangerouslySetInnerHTML={{ __html: ICONS[item.icon] || '' }} />}
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
        {!sidebarCollapsed ? (
          <div style={{ borderTop: '1px solid #e7e0f7', background: 'rgba(255,255,255,.5)' }}>
            <div style={{ padding: '6px 0 2px' }}>
              {!isMobile && <CampanaNotificaciones onIrA={(t) => switchTab(t as Tab)} />}

              <button onClick={() => switchTab('config' as Tab)} style={{ ...pieFila, background: tab === 'config' ? '#fff' : 'none', boxShadow: tab === 'config' ? '0 2px 10px rgba(60,30,140,.10)' : 'none', color: tab === 'config' ? '#4C3BD0' : '#4b4560' }}>
                <span style={{ ...pieIcono, color: '#a49dbd' }} dangerouslySetInnerHTML={{ __html: ICONS.config }} />Configuración
              </button>

            {/* Salir va aquí, DESPUÉS de configuración y como un renglón más:
                arriba estaba pegada a la flecha de plegar y se confundían. */}
            <button
              onClick={async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {} window.location.href = '/admin/login'; }}
              style={{ ...pieFila, color: '#B24C57' }}>
              <span style={{ ...pieIcono, color: '#B24C57', opacity: .85 }} dangerouslySetInnerHTML={{ __html: ICONO_SALIR }} />Cerrar sesión
            </button>
            </div>

            {/* Quién entró. El día que haya más de una persona en el CRM, saber
                con qué cuenta estás parado deja de ser un adorno. Se le da clic
                para ir a tu perfil: el bloque estaba ahí sin hacer nada. */}
            <button
              onClick={() => switchTab('config' as Tab)}
              title="Ver mi perfil"
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 20px)', textAlign: 'left', padding: '9px 12px', margin: '6px 10px', borderRadius: 11, background: '#fff', border: 'none', boxShadow: '0 1px 3px rgba(40,20,90,.08)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {/* Con foto se ve la cara; sin ella, las iniciales de siempre. */}
              <span style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: yo?.foto_url ? `#fff url(${yo.foto_url}) center/cover no-repeat` : 'linear-gradient(135deg,#9B8CFA,#7DA6F5)',
                color: '#fff', fontSize: '0.73rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {!yo?.foto_url && iniciales(yo?.nombre || yo?.email)}
              </span>
              <span style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.81rem', fontWeight: 800, color: '#241d43', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {yo?.nombre || yo?.email || '—'}
                </div>
                {yo?.rol && (
                  /* El rol es una etiqueta que describe, no un botón: por eso va
                     en el rosa de la firma y en pastilla chica. */
                  <span style={{ display: 'inline-block', fontSize: '0.53rem', fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', borderRadius: 5, padding: '2px 6px', marginTop: 3, background: 'rgba(244,168,205,.42)', color: '#9c3d70' }}>
                    {yo.rol}
                  </span>
                )}
              </span>
            </button>

            {/* La última franja es el control de plegar, con su texto: es lo
                que estaba arriba y se confundía con salir. */}
            <button
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Plegar menú"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px 14px', borderTop: '1px solid #e7e0f7', background: 'none', border: 'none', borderTopStyle: 'solid', cursor: 'pointer', color: '#4b4560', fontSize: '0.74rem', fontWeight: 700, fontFamily: 'inherit' }}>
              <span style={{ display: 'flex', opacity: .7 }} dangerouslySetInnerHTML={{ __html: ICONO_PLEGAR }} />Plegar menú
            </button>
          </div>
        ) : !isMobile && (
          /* Plegado, el pie es el botón de ABRIR. Salir no se repite aquí: es
             una acción de una vez al día y, con el riel angosto, un icono rojo
             suelto se lee como una alerta. La campana tampoco: plegado ya
             flota arriba a la derecha. */
          <div style={{ borderTop: '1px solid #e7e0f7', padding: '6px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={() => setSidebarCollapsed(false)}
              aria-label="Abrir menú" title="Abrir menú"
              style={{ width: 44, height: 38, borderRadius: 11, border: 'none', background: 'none', cursor: 'pointer', color: '#8e88a8', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scaleX(-1)' }}
              dangerouslySetInnerHTML={{ __html: ICONO_PLEGAR }} />
          </div>
        )}
      </div>

      {/* ─── Main Content ─── */}
      {/* El menú es `position: fixed`, así que el contenido se recorre con
          marginLeft. Con maxWidth al 100% el bloque medía el ancho COMPLETO de
          la pantalla y luego se empujaba: sobraban 220 px por la derecha y las
          tarjetas y los botones de la tabla salían cortados. El ancho tiene que
          descontar el menú. */}
      <div style={{
        flex: 1, minWidth: 0,
        width: isMobile ? '100%' : `calc(100% - ${mainMarginLeft}px)`,
        maxWidth: isMobile ? '100%' : `calc(100% - ${mainMarginLeft}px)`,
        marginLeft: mainMarginLeft, transition: 'margin-left 0.2s ease, width 0.2s ease, max-width 0.2s ease',
        display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'hidden',
        // El inbox de WhatsApp va a PANTALLA COMPLETA: sin la franja de 22px del shell.
        paddingTop: isMobile ? 'calc(56px + env(safe-area-inset-top))' : (tab === 'whatsapp' ? 0 : 22), paddingBottom: isMobile ? 'var(--crm-bottomnav-h, 64px)' : 0,
        transitionProperty: 'margin-left, width, max-width, padding-top',
      }}>
        {/* Content — key={tab} remonta el contenido al navegar y dispara la
            transición de entrada móvil (M6): 180ms de fade+rise, como una app. */}
        <div key={tab} className={isMobile ? 'm-tabin' : undefined}>
        {tab === 'dashboard' ? (
          /* M4: en el teléfono, Inicio responde "¿cómo voy y qué me toca?" en 4
             zonas — el Dashboard completo es de escritorio. */
          <ErrorBoundary>{isMobile ? <InicioMovil onIrA={(t) => switchTab(t as Tab)} /> : <DashboardTab />}</ErrorBoundary>
        ) : tab === 'hoy' ? (
          <ErrorBoundary><AgendaHoy onOpenContact={(id) => setProfileContactId(id)} onGoDeals={() => switchTab('deals')} /></ErrorBoundary>
        ) : tab === 'pipeline' ? (
          <ErrorBoundary><LeadsTab /></ErrorBoundary>
        ) : tab === 'deals' ? (
          <DealsTab onConfig={() => goConfigPipeline('oportunidad')} initialDealId={initialDealId} onDealConsumed={() => setInitialDealId(null)} />
        ) : tab === 'suscripciones' ? (
          <ErrorBoundary><SubscriptionsTab /></ErrorBoundary>
        ) : tab === 'cobros' ? (
          <ErrorBoundary><div style={WRAP}><PasarelaMercadoPago /></div></ErrorBoundary>
        ) : tab === 'agenda' || tab === 'reuniones' ? (
          /* Reuniones y Agenda eran dos entradas del menú, en grupos distintos,
             para el mismo tema: las juntas que ya tienes y los horarios en que
             te pueden agendar. Ahora es una sola con dos vistas. */
          /* La tira de dos pestañas se fue: ninguna otra página del CRM tiene
             una encima del título, y dejaba a Reuniones sin cabecera propia.
             Ahora "Horarios y tipos" es el botón de destino de su cabecera
             —como "Dashboard" en Cotizaciones— y del otro lado hay un regreso. */
          <div>
            {tab === 'reuniones' ? (
              <ReunionesTab onOpenContact={(id) => setProfileContactId(id)} />
            ) : (
              <>
                <div style={{ padding: '18px 24px 0' }}>
                  {/* Su casa es Configuración → Reuniones; ahí es donde regresa.
                      Esta ruta se queda viva para los enlaces que ya existían. */}
                  <button onClick={() => switchTab('config' as Tab)}
                    style={{ border: '1px solid #ddd6fb', background: '#fff', color: '#5B4BD6', borderRadius: 9, padding: '8px 13px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ← Configuración
                  </button>
                </div>
                <SchedulingTab />
              </>
            )}
          </div>
        ) : tab === 'email' ? (
          <ErrorBoundary><EmailTab /></ErrorBoundary>
        ) : tab === 'whatsapp' ? (
          <ErrorBoundary><WhatsAppTab /></ErrorBoundary>
        ) : tab === 'wa-masivos' ? (
          <ErrorBoundary><WaMasivos /></ErrorBoundary>
        ) : tab === 'wa-config' ? (
          <ErrorBoundary><ConfigWhatsApp /></ErrorBoundary>
        ) : tab === 'wa-plantillas' ? (
          <ErrorBoundary><ConfigWhatsApp inicial="plantillas" /></ErrorBoundary>
        ) : tab === 'wa-metricas' ? (
          <ErrorBoundary><MetricasWA /></ErrorBoundary>
        ) : tab === 'wa-numero' ? (
          <ErrorBoundary><ConfigWhatsApp inicial="numero" /></ErrorBoundary>
        ) : tab === 'outbound' ? (
          <ErrorBoundary><OutboundTab /></ErrorBoundary>
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
        ) : tab === 'cobranza' ? (
          // Ya no hay renglón de menú que lleve aquí; queda como red por si algún
          // enlace interno viejo pone el estado a mano.
          <ErrorBoundary><CobranzaTab /></ErrorBoundary>
        ) : tab === 'mejoras' ? (
          <ErrorBoundary><MejorasTab /></ErrorBoundary>
        ) : tab === 'soporte' ? (
          <ErrorBoundary><SoporteTab /></ErrorBoundary>
        ) : tab === 'pagos' ? (
          <ErrorBoundary><PagosTab /></ErrorBoundary>
        ) : tab === 'clientes' ? (
          <ClientesTab onConfig={() => goConfigPipeline('cliente')} />
        ) : tab === 'sacs' ? (
          <ErrorBoundary><SacsUsuariosTab /></ErrorBoundary>
        ) : tab === 'oportunidades' ? (
          <ErrorBoundary><OportunidadesTab /></ErrorBoundary>
        ) : tab === 'marca' ? (
          <ErrorBoundary><MarcaTab /></ErrorBoundary>
        ) : tab === 'pipelines' ? (
          <ErrorBoundary><PipelinesConfig initialTipo={pipelineTipo} /></ErrorBoundary>
        ) : (
          <RevenueHub _initialTab={revenueTab as any} _hideNav={true} />
        )}
        </div>
      </div>

      {/* Contact Profile Overlay */}
      {profileContactId && (
        <ContactProfile contactId={profileContactId} onClose={() => setProfileContactId(null)} />
      )}

      {/* ─── Shell MOBILE: BottomNav + "Más" + búsqueda fullscreen ─── */}
      {/* El volado del grupo. Fijo y anclado al botón: la lista del menú tiene
          overflow y un panel absoluto adentro se recortaría. */}
      {sidebarCollapsed && flyGrupo && (() => {
        const sec = seccionesVisibles.find(x => x.label === flyGrupo.label);
        if (!sec) return null;
        const alto = 44 + sec.items.length * 34;
        const top = Math.max(8, Math.min(flyGrupo.y, window.innerHeight - alto - 12));
        return (
          <>
            <div onClick={() => setFlyGrupo(null)} style={{ position: 'fixed', inset: 0, zIndex: 940 }} />
            <div style={{
              position: 'fixed', left: 70, top, zIndex: 941, minWidth: 208,
              background: '#fff', border: '1px solid #e6e0f6', borderRadius: 12,
              boxShadow: '0 14px 34px rgba(36,29,67,.2)', padding: 7,
            }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: '#a49dbd', padding: '5px 10px 4px' }}>
                {sec.label}
              </div>
              {sec.items.map(item => {
                const act = tab === item.id;
                return (
                  <button key={item.id}
                    onClick={() => { setFlyGrupo(null); switchTab(item.id); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                      border: 'none', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: '0.81rem', fontWeight: act ? 800 : 600,
                      background: act ? '#EEECFE' : 'transparent', color: act ? '#4C3BD0' : '#4b4560',
                    }}
                    onMouseEnter={e => { if (!act) (e.currentTarget as HTMLElement).style.background = '#f6f4ff'; }}
                    onMouseLeave={e => { if (!act) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                    <span style={{ display: 'flex', width: 17, flexShrink: 0, color: act ? '#7C6BF0' : '#a49dbd' }}
                      dangerouslySetInnerHTML={{ __html: ICONS[item.icon] || '' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
                    {item.id === 'mejoras' && vencidasMenu > 0 && (
                      <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#FEF0EF', color: '#C0554E', borderRadius: 20, padding: '2px 7px' }}>{vencidasMenu}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}
      {isMobile && !mobileExpanded && (
        <BottomNav
          activeId={BOTTOM_IDS.includes(tab) ? tab : '__mas'}
          onSelect={(id) => { if (id === '__mas') setMasOpen(true); else switchTab(id as Tab); }}
          items={[
            ...BOTTOM_IDS.map(id => {
              const item = NAV_SECTIONS.flatMap(s => s.items).find(i => i.id === id)!;
              return { id, label: BOTTOM_LABELS[id] || item.label, icon: ICONS[item.icon] || '' };
            }),
            { id: '__mas', label: 'Más', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>' },
          ]}
        />
      )}
      <MasScreen
        open={masOpen}
        activeId={tab}
        onClose={() => setMasOpen(false)}
        onSelect={(id) => { switchTab(id as Tab); setMasOpen(false); }}
        grupos={NAV_SECTIONS
          .map(section => ({
            label: section.label || '',
            items: section.items.filter(i => !BOTTOM_IDS.includes(i.id)).map(i => ({ id: i.id, label: i.label })),
          }))
          .filter(g => g.items.length > 0)}
        extras={[
          { label: 'Notificaciones', onClick: () => { setMasOpen(false); setNotifOpen(true); } },
          { label: 'Cambiar contraseña', onClick: () => { window.location.href = '/admin/cambiar-password'; } },
          { label: 'Cerrar sesión', danger: true, onClick: async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* noop */ } window.location.href = '/admin/login'; } },
        ]}
      />
      {/* El panel de notificaciones en mobile: sin renglón propio, lo abre la
          hoja "Más". Antes lo abría una campana flotante que tapaba la pantalla. */}
      {isMobile && (
        <CampanaNotificaciones onIrA={(t) => switchTab(t as Tab)}
          abiertoDesdeFuera={notifOpen} onCerrar={() => setNotifOpen(false)} />
      )}
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

    /* ══ M0 · Tokens del sistema móvil (dirección v5: Square + morado) ══
       Presupuesto por pantalla — LEY para todos los tabs: 1 número héroe,
       ≤3 chips sin conteo, ≤2 secciones de ≤2 palabras, filas de ≤3 datos,
       ≤2 colores de estado, 5 valores tipográficos. El estado sano guarda
       silencio. Ver el goal "CRM de bolsillo". */
    :root {
      --m-ink: #1a1a1a; --m-soft: #8f8d98; --m-line: #efeef2;
      --m-neutro: #f4f3f6; --m-acc: #5B4BD6; --m-acc-suave: #EEECFE;
      --m-dinero: #1E8A63; --m-rojo: #C0554E; --m-ambar: #a06600;
    }
    /* Encabezado grande de pantalla (título 26/800 + acción a la derecha) */
    .m-hdr { display: flex; align-items: flex-end; justify-content: space-between; padding: 14px 20px 10px; }
    .m-hdr .m-tt { font-size: 1.55rem; font-weight: 800; letter-spacing: -0.02em; color: var(--m-ink); }
    .m-hdr .m-cta { font-size: 0.86rem; font-weight: 700; color: var(--m-acc); background: none; border: none; padding: 8px 0 8px 12px; cursor: pointer; font-family: inherit; }
    /* Número héroe (uno por pantalla, UNA línea de contexto) */
    .m-hero { padding: 4px 20px 14px; }
    .m-hero .m-hl { font-size: 0.8rem; color: var(--m-soft); }
    .m-hero .m-hv { font-size: 1.9rem; font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; margin: 2px 0; color: var(--m-ink); }
    .m-hero .m-hd { font-size: 0.8rem; color: var(--m-soft); }
    /* Encabezado de sección (≤2 palabras, máx 2 por pantalla) */
    .m-sec { display: flex; justify-content: space-between; align-items: center; padding: 20px 20px 8px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--m-soft); }
    .m-sec .m-vt { font-size: 0.78rem; font-weight: 700; color: var(--m-acc); letter-spacing: 0; text-transform: none; cursor: pointer; }
    /* Fila full-bleed con hairline (≤3 datos; la 4ª solo en la excepcional) */
    .m-row { display: flex; gap: 12px; align-items: center; padding: 13px 20px; min-height: 60px; border-bottom: 1px solid var(--m-line); background: #fff; cursor: pointer; }
    .m-row:active { background: var(--m-neutro); }
    .m-row .m-ini { flex: none; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.8rem; background: var(--m-neutro); color: #6a6875; }
    .m-row .m-tx { flex: 1; min-width: 0; }
    .m-row .m-n1 { font-weight: 600; font-size: 0.94rem; letter-spacing: -0.01em; color: var(--m-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .m-row .m-n2 { font-size: 0.8rem; color: var(--m-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .m-row .m-fin { flex: none; text-align: right; }
    .m-row .m-m1 { font-weight: 600; font-size: 0.94rem; font-variant-numeric: tabular-nums; color: var(--m-ink); }
    .m-row .m-m2 { font-size: 0.8rem; color: var(--m-soft); margin-top: 1px; }
    /* Chips de filtro (≤3; solo el activo lleva conteo) */
    .m-chips { display: flex; gap: 8px; padding: 8px 20px 4px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
    .m-chips::-webkit-scrollbar { display: none; }
    .m-chip { flex: none; font-size: 0.8rem; font-weight: 700; padding: 8px 13px; border-radius: 999px; background: #fff; border: 1px solid #dddce3; color: #4a4854; cursor: pointer; font-family: inherit; }
    .m-chip.on { background: var(--m-acc); border-color: var(--m-acc); color: #fff; }
    /* Grids de 2 columnas del tab de finanzas ARR: a 1 col en teléfono.
       minmax(0,1fr) y min-width:0 en los hijos: con 1fr a secas, el min-content
       de la tabla interna (420px) infla el grid item y desborda el viewport
       aunque la tabla tenga su propio scroll. */
    .fin-k2 { grid-template-columns: minmax(0, 1fr) !important; }
    .fin-k2 > * { min-width: 0; }
    /* ══ M5 · Piso tipográfico: nada bajo 12 px en el teléfono ══
       Los tabs densos (Consultoría 180 textos <11 px, Clientes 156, Radar 81)
       usan estilos INLINE con 0.55-0.68rem / 9-11px. Una regla externa con
       !important SÍ le gana a un style inline sin !important, y el selector de
       atributo alcanza a todos sin tocar 50 archivos. Los selectores son
       EXACTOS por diseño: "0.7rem" (con la r pegada) no atrapa a 0.75rem. */
    [style*="font-size: 0.5"], [style*="font-size: 0.6"],
    [style*="font-size: 0.7rem"], [style*="font-size: 0.71"], [style*="font-size: 0.72"], [style*="font-size: 0.73"], [style*="font-size: 0.74"],
    [style*="font-size: 8px"], [style*="font-size: 9px"], [style*="font-size: 10px"], [style*="font-size: 11px"], [style*="font-size: 11."] {
      font-size: 0.75rem !important;
    }
    /* El margen compartido del CRM (lib/crm/layout WRAP) trae 56 px laterales
       pensados para escritorio: en 390 px se comen 112. A 16 en el teléfono. */
    [style*="padding: 24px 56px"] { padding: 16px 16px 24px !important; }
    [style*="padding: 0px 56px"], [style*="padding: 0 56px"] { padding: 0 16px !important; }
    /* M6 · Transición de entrada al cambiar de tab (como una app nativa). */
    .m-tabin { animation: m-tabin 180ms ease; }
    @keyframes m-tabin { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .m-tabin { animation: none; } }
    /* Skeleton compartido */
    .m-skel { background: linear-gradient(90deg, var(--m-neutro) 25%, #eceaf1 50%, var(--m-neutro) 75%); background-size: 200% 100%; animation: m-skel 1.1s infinite linear; border-radius: 8px; }
    @keyframes m-skel { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) { .m-skel { animation: none; } }
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
