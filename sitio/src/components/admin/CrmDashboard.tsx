import { useState, useEffect, useRef, Component, lazy, Suspense } from 'react';
import { lazySeguro } from '../../lib/ui/lazySeguro';
import Cargando from './crm/ui/Cargando';
import { WRAP } from '../../lib/crm/layout';
import type { ReactNode } from 'react';
import { useIsMobile, isTouchDevice } from '../../lib/ui/mobile';
import BottomNav from './crm/ui/BottomNav';
import MasScreen from './crm/ui/MasScreen';
import InicioMovil from './crm/InicioMovil';
import ActionSheet from './crm/ui/ActionSheet';
import Sheet from './crm/ui/Sheet';
import CampanaNotificaciones from './crm/CampanaNotificaciones';
// ══ REGLA DE VELOCIDAD: cada tab es un chunk LAZY. El bundle inicial solo
// lleva el shell (nav + Inicio móvil). Un import estático aquí regresa el
// monolito de 2.2 MB que mataba el primer pintado. ══
// El chunk del TAB ACTIVO se pide en cuanto este módulo evalúa — viaja en
// paralelo con la hidratación en vez de esperarla (client:only → solo browser).
const PRECARGA_TAB: Record<string, () => Promise<any>> = {
  pipeline: () => import('./crm/LeadsTab'),
  clientes: () => import('./crm/ClientesTab'),
  whatsapp: () => import('./crm/whatsapp/WhatsAppTab'),
  cotizaciones: () => import('./RevenueHub'),
  pagos: () => import('./crm/PagosTab'),
  soporte: () => import('./crm/soporte/SoporteTab'),
  suscripciones: () => import('./crm/SubscriptionsTab'),
  oportunidades: () => import('./crm/OportunidadesTab'),
  reuniones: () => import('./crm/ReunionesTab'),
  mejoras: () => import('./crm/MejorasTab'),
  deals: () => import('./crm/DealsTab'),
};
try {
  const t0 = new URLSearchParams(window.location.search).get('tab') || '';
  if (t0 === 'cobranza') PRECARGA_TAB.pagos();
  else PRECARGA_TAB[t0]?.();
} catch { /* SSR u otro entorno: nada */ }

const DealsTab = lazySeguro(() => import('./crm/DealsTab'));
const AutomationsTab = lazySeguro(() => import('./crm/AutomationsTab'));
const EmailTab = lazySeguro(() => import('./crm/email/EmailTab'));
const SecuenciasTab = lazySeguro(() => import('./crm/SecuenciasTab'));
const OutboundTab = lazySeguro(() => import('./crm/outbound/OutboundTab'));
const WhatsAppTab = lazySeguro(() => import('./crm/whatsapp/WhatsAppTab'));
const WaMasivos = lazySeguro(() => import('./crm/whatsapp/Masivos'));
const ConfigWhatsApp = lazySeguro(() => import('./crm/whatsapp/ConfigWhatsApp'));
const MetricasWA = lazySeguro(() => import('./crm/whatsapp/MetricasWA'));
const SchedulingTab = lazySeguro(() => import('./crm/SchedulingTab'));
const PasarelaMercadoPago = lazySeguro(() => import('./crm/PasarelaMercadoPago'));
const ContactProfile = lazySeguro(() => import('./crm/ContactProfile'));
const DashboardTab = lazySeguro(() => import('./crm/DashboardTab'));
const PartnersTab = lazySeguro(() => import('./crm/PartnersTab'));
const CommissionsTab = lazySeguro(() => import('./crm/CommissionsTab'));
const ContentReviewTab = lazySeguro(() => import('./crm/ContentReviewTab'));
const RevenueHub = lazySeguro(() => import('./RevenueHub'));
const ClientesTab = lazySeguro(() => import('./crm/ClientesTab'));
const LeadsTab = lazySeguro(() => import('./crm/LeadsTab'));
const MejorasTab = lazySeguro(() => import('./crm/MejorasTab'));
const MarcaTab = lazySeguro(() => import('./crm/MarcaTab'));
const CobranzaTab = lazySeguro(() => import('./crm/CobranzaTab'));
const ReunionesTab = lazySeguro(() => import('./crm/ReunionesTab'));
const SubscriptionsTab = lazySeguro(() => import('./crm/SubscriptionsTab'));
const PagosTab = lazySeguro(() => import('./crm/PagosTab'));
const PipelinesConfig = lazySeguro(() => import('./crm/PipelinesConfig'));
const AgendaHoy = lazySeguro(() => import('./crm/AgendaHoy'));
const SacsUsuariosTab = lazySeguro(() => import('./crm/SacsUsuariosTab'));
const OportunidadesTab = lazySeguro(() => import('./crm/OportunidadesTab'));
const SoporteTab = lazySeguro(() => import('./crm/soporte/SoporteTab'));

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

type Tab = 'dashboard' | 'hoy' | 'pipeline' | 'deals' | 'agenda' | 'reuniones' | 'automations' | 'clientes' | 'suscripciones' | 'cotizaciones' | 'pagos' | 'config' | 'pipelines' | 'agents' | 'desempeno' | 'partners' | 'commissions' | 'content-review' | 'sacs' | 'oportunidades' | 'cobros' | 'mejoras' | 'cobranza' | 'marca' | 'email' | 'whatsapp' | 'wa-masivos' | 'wa-plantillas' | 'wa-metricas' | 'wa-numero' | 'wa-config' | 'outbound' | 'secuencias' | 'soporte';

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
      { id: 'pagos' as Tab, label: 'Pagos y cobranza', icon: 'pagos' },
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
      { id: 'secuencias' as Tab, label: 'Secuencias', icon: 'automations' },
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
// Pantallas móviles con cabecera propia v5 (m-hdr): sin app bar de 56px.
// Se suman aquí conforme cada pantalla pasa el referee.
/** Esqueleto sobrio mientras baja el chunk del tab (solo primera visita). */
function TabCargando() {
  return (
    <div style={{ padding: '24px' }} aria-busy="true">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="m-skel" style={{ height: 18, borderRadius: 6, margin: '0 0 18px', width: `${[62, 90, 78, 84][i]}%` }} />
      ))}
    </div>
  );
}

const M_HDR_TABS: Tab[] = ['dashboard', 'pipeline', 'clientes', 'whatsapp', 'cotizaciones', 'pagos', 'soporte'];
// Pantallas ADAPTADAS al modo oscuro móvil. El dark se scopea a esta lista con
// data-crm-dark en <html>: una pantalla no adaptada se queda en claro LEGIBLE
// en vez de heredar fondo negro con texto negro (el reporte del usuario).
// El tema no es de unas pantallas sí y otras no: en el teléfono la app es una
// sola. Se van sumando conforme cada módulo del menú «Más» pasa su revisión —
// meter aquí un módulo sin adaptar deja texto claro sobre fondo claro.
// Módulos del menú «Más» que heredan el mapa oscuro genérico (el mismo de la
// ficha dentro de la hoja): se escribieron en claro con estilos inline y se
// repintan por valor serializado en vez de tocar 17 archivos.
const M_AUTO_DARK: Tab[] = ['suscripciones', 'mejoras', 'oportunidades', 'reuniones'];
const M_DARK_TABS: Tab[] = ['dashboard', 'pipeline', 'clientes', 'cotizaciones', 'pagos', 'soporte', 'whatsapp', 'suscripciones', 'mejoras', 'oportunidades', 'reuniones'];
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
  // REGLA DE VELOCIDAD: los chunks de los destinos del pulgar se precargan en
  // idle — el switch de tab nunca espera red. El resto baja al entrar.
  // El scope del modo oscuro sigue al tab activo (ver M_DARK_TABS)
  useEffect(() => {
    document.documentElement.dataset.crmDark = (isMobile && M_DARK_TABS.includes(tab)) ? '1' : '0';
    return () => { delete document.documentElement.dataset.crmDark; };
  }, [tab, isMobile]);
  useEffect(() => {
    const idle = (cb: () => void, t: number) => ('requestIdleCallback' in window)
      ? (window as any).requestIdleCallback(cb, { timeout: t }) : setTimeout(cb, t);
    idle(() => { import('./crm/LeadsTab'); import('./crm/ClientesTab'); import('./crm/whatsapp/WhatsAppTab'); }, 2500);
    idle(() => { import('./RevenueHub'); import('./crm/PagosTab'); import('./crm/soporte/SoporteTab'); import('./crm/OportunidadesTab'); }, 6000);
    // También los DATOS de los destinos del pulgar: el switch pinta del caché
    // sin esperar red (y de paso calienta el micro-caché del servidor).
    idle(() => {
      const prime = (u: string) => {
        try {
          if (sessionStorage.getItem('swr:' + u)) return;
          fetch(u).then(r => r.ok ? r.json() : null).then(j => {
            if (j != null) try { sessionStorage.setItem('swr:' + u, JSON.stringify(j)); } catch { /* nada */ }
          }).catch(() => {});
        } catch { /* nada */ }
      };
      prime('/api/crm/contacts?limit=500&con_etapa=1');
      prime('/api/crm/arr/clientes');
      try {
        if (!sessionStorage.getItem('swr:inbox-lista')) {
          fetch('/api/crm/whatsapp/inbox?filtro=todas&estado=abierta&orden=recientes&limit=50').then(r => r.ok ? r.json() : null).then(j => {
            if (j) try { sessionStorage.setItem('swr:inbox-lista', JSON.stringify({ conversaciones: j.conversaciones || [], counts: j.counts || {} })); } catch { /* nada */ }
          }).catch(() => {});
        }
      } catch { /* nada */ }
    }, 4000);
  }, []);
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
      {isMobile && sidebarCollapsed && !M_HDR_TABS.includes(tab) && (
        <header className="m-appbar" style={{
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
        paddingTop: isMobile ? (M_HDR_TABS.includes(tab) ? 'env(safe-area-inset-top)' : 'calc(56px + env(safe-area-inset-top))') : (tab === 'whatsapp' ? 0 : 22), paddingBottom: isMobile ? 'var(--crm-bottomnav-h, 64px)' : 0,
        background: isMobile ? '#fff' : undefined,
        transitionProperty: 'margin-left, width, max-width, padding-top',
      }}>
        {/* Content — key={tab} remonta el contenido al navegar y dispara la
            transición de entrada móvil (M6): 180ms de fade+rise, como una app. */}
        <div key={tab} className={isMobile ? ('m-tabin' + (M_AUTO_DARK.includes(tab) ? ' m-auto-dark' : '')) : undefined}>
        <Suspense fallback={<TabCargando />}>
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
        ) : tab === 'secuencias' ? (
          <ErrorBoundary><SecuenciasTab /></ErrorBoundary>
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
            <div style={{ background: '#fff', border: '1px solid #eeeef1', borderRadius: 14, padding: '20px 18px', maxWidth: 560 }}>
              <div style={{ fontSize: '1.02rem', fontWeight: 800, marginBottom: 6 }}>Dashboard de desempeño</div>
              <p style={{ color: '#666', fontSize: '0.875rem', margin: '0 0 16px', lineHeight: 1.5 }}>
                MRR, comisiones, pipeline, leaderboard. Partners ven solo lo suyo; founder ve agregado.
              </p>
              <a href="/app/dashboard" target="_blank" style={{
                display: 'inline-block', padding: '12px 18px', background: '#5B4BD6', color: '#fff',
                borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: '0.85rem'
              }}>Abrir dashboard →</a>
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
        </Suspense>
        </div>
      </div>

      {/* Contact Profile Overlay */}
      {profileContactId && (
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#f5f6f8', display: 'grid', placeItems: 'center' }}><Cargando texto="Cargando contacto…" alto={200} /></div>}>
          <ContactProfile contactId={profileContactId} onClose={() => setProfileContactId(null)} />
        </Suspense>
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
          activeId={masOpen ? '__mas' : BOTTOM_IDS.includes(tab) ? tab : '__mas'}
          onSelect={(id) => { if (id === '__mas') { setMasOpen(true); } else { setMasOpen(false); switchTab(id as Tab); } }}
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
    body { overflow-x: hidden; background: #fff; }
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
    /* Tipografía del SISTEMA en el teléfono (dirección v5): así se ve nativa
       en iPhone y Android. Le gana al 'Plus Jakarta Sans' inline del root. */
    [style*="Plus Jakarta"], [style*="Plus Jakarta"] * { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
    /* El lienzo móvil es blanco continuo (la ref no tiene paneles grises). El
       root del CRM pinta #f5f6f8 inline — solo él lleva la fuente inline, así
       que el mismo selector sirve de gancho. */
    [style*="Plus Jakarta"] { background: #fff !important; }
    :root {
      --m-ink: #1a1a1a; --m-soft: #8f8d98; --m-line: #efeef2;
      --m-neutro: #f4f3f6; --m-acc: #5B4BD6; --m-acc-suave: #EEECFE;
      --m-dinero: #1E8A63; --m-rojo: #C0554E; --m-ambar: #a06600;
    }
    /* Encabezado grande de pantalla (título 26/800 + acción a la derecha) */
    .m-hdr { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px 10px; }
    .m-hdr .m-tt { font-size: 2.125rem; font-weight: 800; letter-spacing: -0.02em; color: var(--m-ink); }
    .m-hdr .m-cta { font-size: 0.86rem; font-weight: 700; color: var(--m-acc); background: none; border: none; padding: 0 0 0 8px; min-height: 44px; cursor: pointer; font-family: inherit; }
    /* Número héroe (uno por pantalla, UNA línea de contexto) */
    .m-hero { padding: 4px 24px 16px; }
    .m-hero .m-hl { font-size: 0.8rem; color: var(--m-soft); }
    .m-hero .m-hv { font-size: 2.85rem; font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; margin: 4px 0 2px; line-height: 1.02; color: var(--m-ink); }
    .m-hero .m-hd { font-size: 0.9rem; color: var(--m-soft); margin-top: 2px; }
    /* Encabezado de sección (≤2 palabras, máx 2 por pantalla) */
    .m-sec { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px 0; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--m-soft); }
    .m-sec .m-vt { font-size: 0.78rem; font-weight: 700; color: var(--m-acc); letter-spacing: 0; text-transform: none; cursor: pointer; }
    /* Fila full-bleed con hairline (≤3 datos; la 4ª solo en la excepcional) */
    .m-row { display: flex; gap: 12px; align-items: center; padding: 16px 24px; min-height: 60px; position: relative; background: #fff; cursor: pointer; }
    .m-row::after { content: ''; position: absolute; left: 24px; right: 0; bottom: 0; height: 1px; background: var(--m-line); }
    /* Con avatar, la hairline se alinea a la columna de texto (24 + 38 + 12) */
    .m-row:has(.m-ini)::after { left: 74px; }
    /* La lista cierra sin divisor colgante (Square): la última fila del bloque va limpia */
    .m-row:last-child::after { display: none; }
    .m-row:active { background: var(--m-neutro); }
    .m-row .m-ini { flex: none; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.8rem; background: var(--m-neutro); color: #6a6875; }
    .m-row .m-tx { flex: 1; min-width: 0; }
    .m-row .m-n1 { font-weight: 600; font-size: 0.94rem; line-height: 1.3; letter-spacing: -0.01em; color: var(--m-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .m-row .m-n2 { font-size: 0.8rem; line-height: 1.3; color: var(--m-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .m-row .m-fin { flex: none; text-align: right; align-self: flex-start; }
    .m-row .m-m1 { font-weight: 600; font-size: 0.94rem; line-height: 1.3; font-variant-numeric: tabular-nums; color: var(--m-ink); }
    .m-row .m-m2 { font-size: 0.8rem; line-height: 1.3; color: var(--m-soft); margin-top: 2px; }
    /* ══ DETALLE v5 (fic-body): el cuerpo de la ficha compactado en móvil.
       Las cards del drawer son inline: se pisan por atributo. ══ */
    @media (max-width: 899px) {
      /* KPIs de uso: 2×2 compacto en vez de una card gigante por fila */
      .fic-body [style*="minmax(190px"] { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
      /* cards del drawer: hairline neutra y menos aire; fuera los bordes de color */
      .fic-body [style*="border: 1px solid rgb(236, 236, 236)"] { border-color: #efeef2 !important; padding: 14px 16px !important; margin-bottom: 12px !important; }
      .fic-body [style*="rgb(221, 214, 251)"] { border: 1px solid #efeef2 !important; }
      .fic-body [style*="rgb(207, 224, 250)"] { border: 1px solid #efeef2 !important; }
      /* la barra sticky de periodo, compacta */
      .fic-body [style*="position: sticky"] { padding: 8px 12px !important; }
    }
    /* Carruseles y tab bars scrolleables: fade al borde derecho para que lo
       cortado "asome" en vez de leerse como texto roto (KPIs, tabs) */
    @media (max-width: 899px) {
      [style*="scroll-snap-type"] { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 32px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 32px), transparent); padding-right: 20px !important; }
    }
    /* Segmented scrolleable de la ficha: fade al borde derecho para que la
       pestaña cortada "asome" en vez de amputarse */
    .fic-seg { padding-right: 16px !important; scroll-padding: 16px; scrollbar-width: none; }
    .fic-seg::-webkit-scrollbar { display: none; }
    /* Saca el bloque del padding de 16px del wrap: gutter = solo los 24px de m-* */
    .m-bleed { margin-left: -16px; margin-right: -16px; }
    /* Chips de filtro (≤3; solo el activo lleva conteo) */
    .m-chips { display: flex; gap: 8px; padding: 8px 24px 4px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
    .m-chips::-webkit-scrollbar { display: none; }
    .m-chip { flex: none; font-size: 0.8rem; font-weight: 700; padding: 8px 13px; border-radius: 999px; background: #fff; border: 1px solid #dddce3; color: #4a4854; cursor: pointer; font-family: inherit; }
    .m-chip.on { background: var(--m-acc); border-color: var(--m-acc); color: #fff; }
    /* La cola de trabajo se ve sin tocarla: si hay gente esperando respuesta,
       su pastilla lo dice con el tono de atención aunque no esté activa. */
    .m-chip.urge { border-color: #E8B04B; color: #a06600; }
    /* Punto de «te toca contestar»: va junto a la hora, donde el ojo ya está. */
    .m-pend { display: block; width: 9px; height: 9px; border-radius: 99px; background: var(--m-acc); margin: 5px 0 0 auto; }
    /* ══ DARK móvil (mockup Dark): tokens re-mapeados + overrides de los
       inline claves. SOLO teléfono, SOLO sistema en oscuro y SOLO pantallas
       adaptadas (html[data-crm-dark="1"], ver M_DARK_TABS) — una pantalla no
       adaptada queda en claro legible, nunca fondo negro con texto negro. ══ */
    @media (prefers-color-scheme: dark) and (max-width: 899px) {
      :root[data-crm-dark="1"] {
        --m-ink: #F2F1F7; --m-soft: #918fa0; --m-line: #26262e;
        --m-neutro: #232329; --m-acc: #A78BFA; --m-acc-suave: #2a2440;
        --m-dinero: #34D399; --m-rojo: #F0857A; --m-ambar: #E8B04B;
      }
      [data-crm-dark="1"] body, [data-crm-dark="1"] [style*="Plus Jakarta"], [data-crm-dark="1"] [style*="transition: margin-left"] { background: #131318 !important; }
      /* Lienzos de pantalla con #fff inline: en dark toman el fondo del tema
         (era la mitad blanca con texto claro ilegible que reportó el usuario) */
      [data-crm-dark="1"] .m-lienzo { background: #131318 !important; }
      [data-crm-dark="1"] .m-row { background: transparent; }
      [data-crm-dark="1"] .m-row:active { background: #1d1d24; }
      [data-crm-dark="1"] .m-row .m-n1, [data-crm-dark="1"] .m-row .m-m1 { color: var(--m-ink); }
      [data-crm-dark="1"] .m-row .m-ini { color: #b3b1bd; }
      [data-crm-dark="1"] .m-chip { background: #1d1d24; border-color: #33333d; color: #c9c7d3; }
      [data-crm-dark="1"] .m-chip.on { background: #A78BFA; border-color: #A78BFA; color: #17121f; }
      [data-crm-dark="1"] nav[aria-label="Navegación principal"] { background: #131318 !important; border-top-color: #26262e !important; box-shadow: none !important; }
      [data-crm-dark="1"] nav[aria-label="Navegación principal"] button[aria-current="page"] { color: #B7A8F7 !important; }
      /* inline fijos de las pantallas v5 */
      [data-crm-dark="1"] .m-hdr [style*="color: rgb(26, 26, 30)"] { color: #F2F1F7 !important; }
      [data-crm-dark="1"] .m-hdr [style*="color: rgb(91, 75, 214)"], [data-crm-dark="1"] .m-cta { color: #B7A8F7 !important; }
      [data-crm-dark="1"] input[style*="background: rgb(242, 242, 245)"] { background: #1d1d24 !important; color: #F2F1F7 !important; }
      [data-crm-dark="1"] [style*="color: rgb(30, 138, 99)"] { color: #34D399 !important; }
      [data-crm-dark="1"] [style*="color: rgb(192, 85, 78)"] { color: #F0857A !important; }
      [data-crm-dark="1"] [style*="color: rgb(160, 102, 0)"] { color: #E8B04B !important; }
      [data-crm-dark="1"] [style*="color: rgb(107, 114, 128)"] { color: #9CA3AF !important; }
      [data-crm-dark="1"] [style*="color: rgb(143, 141, 152)"] { color: #918fa0 !important; }
      [data-crm-dark="1"] [style*="background: rgb(244, 243, 246)"], [data-crm-dark="1"] [style*="background: rgb(243, 244, 246)"] { background: #232329 !important; color: #b3b1bd !important; }
      /* ══ Inbox oscuro (lista + hilo + composer). Los estilos son inline: se
         pisan por atributo, siempre con contraste AA sobre #131318. ══ */
      [data-crm-dark="1"] .wa-hilo-m, [data-crm-dark="1"] .wa-hilo-m [style*="background: rgb(255, 255, 255)"] { background: #131318 !important; }
      [data-crm-dark="1"] .wa-hilo-m [style*="color: rgb(17, 24, 39)"], [data-crm-dark="1"] .wa-hilo-m b { color: #F2F1F7 !important; }
      /* burbujas: saliente morado profundo, entrante superficie */
      [data-crm-dark="1"] .wa-hilo-m [style*="border-radius: 16px 16px 6px"] { background: #2a2440 !important; color: #F2F1F7 !important; }
      [data-crm-dark="1"] .wa-hilo-m [style*="border-radius: 16px 16px 16px 6px"] { background: #232329 !important; color: #F2F1F7 !important; }
      [data-crm-dark="1"] .wa-hilo-m [style*="border-radius: 16px 16px 6px"] a { color: #B7A8F7 !important; }
      /* aviso de Meta y franja ámbar en tinta oscura legible */
      [data-crm-dark="1"] .wa-hilo-m [style*="background: rgb(254, 242, 242)"] { background: #2d1a19 !important; color: #F0857A !important; border-color: #43221f !important; }
      [data-crm-dark="1"] .wa-hilo-m [style*="background: rgb(255, 251, 235)"], [data-crm-dark="1"] .wa-hilo-m [style*="rgb(255, 248, 225)"] { background: #2b2314 !important; color: #E8B04B !important; border-color: #3e3118 !important; }
      /* composer: card y campo en superficie oscura */
      [data-crm-dark="1"] .wa-hilo-m [style*="border: 1px solid rgb(229, 231, 235)"] { background: #1d1d24 !important; border-color: #26262e !important; }
      [data-crm-dark="1"] .wa-hilo-m textarea, [data-crm-dark="1"] .wa-hilo-m input[type="text"] { background: transparent !important; color: #F2F1F7 !important; }
      [data-crm-dark="1"] .wa-hilo-m [style*="border-bottom: 1px solid rgb(243, 244, 246)"] { border-bottom-color: #26262e !important; }
      /* Vista rápida (bottom sheet) en oscuro */
      [data-crm-dark="1"] .vr-sheet { background: #131318 !important; }
      [data-crm-dark="1"] .vr-handle { background: #33333d !important; }
      [data-crm-dark="1"] .vr-nom, [data-crm-dark="1"] .vr-hv:not([style*="rgb(192, 85, 78)"]):not([style*="rgb(30, 138, 99)"]):not([style*="rgb(160, 102, 0)"]) { color: #F2F1F7 !important; }
      [data-crm-dark="1"] .vr-acc { background: #232329 !important; color: #F2F1F7 !important; }
      [data-crm-dark="1"] .vr-accp { background: #A78BFA !important; color: #17121f !important; }
      [data-crm-dark="1"] .vr-cl { border-color: #1f1f26 !important; }
      [data-crm-dark="1"] .vr-v:not([style*="rgb(192, 85, 78)"]):not([style*="rgb(30, 138, 99)"]):not([style*="rgb(160, 102, 0)"]) { color: #F2F1F7 !important; }
      [data-crm-dark="1"] .vr-vertodo { color: #B7A8F7 !important; }
      [data-crm-dark="1"] .vr-hint { color: #62626c !important; }
      [data-crm-dark="1"] .vr-ctx, [data-crm-dark="1"] .vr-hl, [data-crm-dark="1"] .vr-hd, [data-crm-dark="1"] .vr-k { color: #918fa0 !important; }
      [data-crm-dark="1"] .vr-hv[style*="rgb(192, 85, 78)"] { color: #F0857A !important; }
      [data-crm-dark="1"] .vr-hv[style*="rgb(30, 138, 99)"], [data-crm-dark="1"] .vr-v[style*="rgb(30, 138, 99)"] { color: #34D399 !important; }
      [data-crm-dark="1"] .vr-v[style*="rgb(160, 102, 0)"] { color: #E8B04B !important; }
      [data-crm-dark="1"] .vr-v[style*="rgb(192, 85, 78)"] { color: #F0857A !important; }
      /* header del hilo: atrás y menú visibles, textos secundarios legibles */
      [data-crm-dark="1"] .wa-hilo-m [aria-label="Atrás"] { color: #F2F1F7 !important; }
      [data-crm-dark="1"] .wa-hilo-m [title="Más acciones"] { color: #F2F1F7 !important; }
      [data-crm-dark="1"] .wa-hilo-m [style*="color: rgb(55, 65, 81)"], [data-crm-dark="1"] .wa-hilo-m [style*="color: rgb(31, 41, 55)"] { color: #c9c7d3 !important; }
      /* Texto tinta-clara y hairlines claros inline → al tema */
      [data-crm-dark="1"] [style*="color: rgb(26, 26, 26)"], [data-crm-dark="1"] [style*="color: rgb(26, 26, 30)"] { color: #F2F1F7 !important; }
      [data-crm-dark="1"] [style*="solid rgb(239, 238, 242)"] { border-color: #26262e !important; }
      /* Badges de etapa fuera de paleta en oscuro: azul #2C5FC4 y morado light → lila */
      [data-crm-dark="1"] [style*="color: rgb(44, 95, 196)"], [data-crm-dark="1"] [style*="color: rgb(91, 75, 214)"] { color: #A78BFA !important; }

      /* ══ LA FICHA DENTRO DE LA HOJA ══════════════════════════════════════
         Las fichas (lead, cliente, oportunidad, cotización) se escribieron en
         claro con estilos INLINE. Embebidas en la hoja heredan el tema: se
         repintan por VALOR SERIALIZADO —React escribe rgb(), nunca #hex— y
         acotadas a .hoja-ficha, para no tocar los mismos tonos en el resto.
         Superficies primero, después texto, después bordes y semánticos. */
      [data-crm-dark="1"] .hoja-ficha { background: #1d1d24 !important; color: #F2F1F7 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(255, 255, 255)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background-color: rgb(255, 255, 255)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(250, 250, 250)"] { background: #1d1d24 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(245, 244, 248)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(244, 244, 246)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(244, 243, 247)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(247, 247, 251)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(245, 246, 248)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(250, 248, 255)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(246, 246, 249)"] { background: #232329 !important; }
      /* Aguas de color: conservan el significado, bajan al nivel del fondo */
      [data-crm-dark="1"] .hoja-ficha [style*="rgb(238, 236, 254)"] { background: #221c33 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="rgb(234, 248, 242)"] { background: #14291f !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="rgb(254, 240, 239)"],
      [data-crm-dark="1"] .hoja-ficha [style*="rgb(251, 236, 234)"] { background: #2d1a19 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="rgb(255, 244, 229)"] { background: #2b2314 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="rgb(227, 237, 253)"] { background: #16203a !important; }
      /* Texto: tinta y grises. El gris del sistema es #918fa0 en oscuro. */
      [data-crm-dark="1"] .hoja-ficha b, [data-crm-dark="1"] .hoja-ficha strong,
      [data-crm-dark="1"] .hoja-ficha h1, [data-crm-dark="1"] .hoja-ficha h2,
      [data-crm-dark="1"] .hoja-ficha h3, [data-crm-dark="1"] .hoja-ficha h4 { color: #F2F1F7; }
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(138, 138, 138)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(165, 162, 175)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(156, 153, 166)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(179, 177, 187)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(182, 178, 194)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(138, 133, 144)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(107, 114, 128)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(107, 107, 116)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(153, 153, 153)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(136, 136, 136)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(102, 102, 102)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(143, 141, 152)"] { color: #918fa0 !important; }
      /* Semánticos: mismos papeles, contraste de oscuro */
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(192, 85, 78)"] { color: #F0857A !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(30, 138, 99)"] { color: #34D399 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(154, 106, 16)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(160, 102, 0)"] { color: #E8B04B !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(91, 75, 214)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(155, 140, 250)"] { color: #B7A8F7 !important; }
      /* Bordes: el hairline del sistema; los de color guardan su tinte */
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(236, 236, 236)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(230, 230, 234)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(238, 238, 238)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(239, 238, 242)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(240, 240, 244)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(244, 244, 246)"] { border-color: #26262e !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(221, 214, 251)"] { border-color: #362c55 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(207, 224, 250)"] { border-color: #23324f !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(247, 201, 197)"] { border-color: #43221f !important; }
      /* Campos: se capturan igual, se leen en oscuro */
      [data-crm-dark="1"] .hoja-ficha input, [data-crm-dark="1"] .hoja-ficha select,
      [data-crm-dark="1"] .hoja-ficha textarea {
        background: #232329 !important; color: #F2F1F7 !important; border-color: #2c2c36 !important;
      }
      [data-crm-dark="1"] .hoja-ficha input::placeholder,
      [data-crm-dark="1"] .hoja-ficha textarea::placeholder { color: #62626c !important; }
      /* Tintas oscuras de la ficha (#241d43 el dato, #3f3b4d el secundario,
         #5c5966 el terciario): en claro son jerarquía, en oscuro serían tinta
         sobre tinta. Medidas con sonda en la ficha del lead. */
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(36, 29, 67)"] { color: #F2F1F7 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(63, 59, 77)"] { color: #c9c7d3 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(92, 89, 102)"],
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(201, 199, 208)"] { color: #918fa0 !important; }
      /* Hairlines restantes: en oscuro se veían como rayas blancas */
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(230, 229, 236)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(245, 244, 248)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(247, 247, 250)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(244, 243, 247)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(243, 241, 248)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(241, 240, 246)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(240, 239, 243)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(247, 247, 250)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(221, 220, 227)"] { border-color: #26262e !important; }
      /* Contornos de color: conservan el semáforo, sin gritar en oscuro */
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(240, 220, 176)"] { border-color: #5a4520 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(240, 196, 189)"] { border-color: #4a2b28 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(230, 221, 250)"] { border-color: #362c55 !important; }
      /* Riel de la línea de tiempo */
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(239, 237, 245)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(248, 247, 252)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(253, 252, 255)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(255, 251, 250)"] { background: #232329 !important; }
      /* Segmented de la ficha del cliente: en claro es track gris con pastilla
         blanca; en oscuro se invertía (pastilla negra sobre track blanco). */
      [data-crm-dark="1"] .hoja-ficha .fic-seg { background: #232329 !important; }
      [data-crm-dark="1"] .hoja-ficha .fic-seg button[style*="background: rgb(255, 255, 255)"] { background: #3a3a46 !important; color: #F2F1F7 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="rgb(242, 242, 245)"] { background: linear-gradient(90deg, rgba(35,35,41,0), #232329 75%) !important; }
      /* Divisor entre las dos cifras de la cabecera del cliente */
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(236, 236, 241)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(236, 236, 236)"] { background: #2a2a33 !important; }
      /* Grises planos del CRM viejo (#f0f0f0, #f5f5f5, #eee, #f2f2f2): como
         borde salían rayas blancas y como fondo pastillas claras. */
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(240, 240, 240)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(245, 245, 245)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(242, 242, 242)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(221, 221, 221)"] { border-color: #26262e !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(245, 245, 245)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(240, 240, 240)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(242, 242, 242)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(238, 238, 238)"] { background: #232329 !important; }
      /* El tema de la ficha vive en variables: una sola definición de forma
         (arriba, global) y aquí solo los valores del oscuro. Así un botón no
         puede quedarse blanco porque su selector no matcheó dos veces. */
      [data-crm-dark="1"] .hoja-ficha {
        --hoja-btn: #232329; --hoja-line: #2c2c36; --hoja-ink: #F2F1F7;
        --hoja-caja: #26262e; --hoja-chip: #232329; --hoja-chip-ink: #918fa0;
      }
      /* La pantalla «Más» es una superficie más de la app, no un overlay
         aparte: sin esto tomaba la tinta clara del tema oscuro sobre su
         blanco original y las secciones se leían fantasma. */
      /* La barra de título es parte de la app, no una franja aparte: sin esto
         quedaba blanca con el título en tinta clara (ilegible) en los módulos
         del menú que ya van en oscuro. */
      [data-crm-dark="1"] .m-buscar { background: #1d1d24 !important; border-color: #2c2c36 !important; color: #F2F1F7 !important; }
      [data-crm-dark="1"] .m-buscar::placeholder { color: #62626c !important; }
      [data-crm-dark="1"] .m-chip.urge { border-color: #6b5220 !important; color: #E8B04B !important; }
      [data-crm-dark="1"] .m-pend { background: #A78BFA !important; }
      [data-crm-dark="1"] .cons-grupo { background: #131318 !important; }
      /* La línea de contexto del hilo (etapa · empresa · origen) es superficie
         de la app, no una franja clara pegada bajo el nombre. */
      [data-crm-dark="1"] .wa-ctx { background: #17171d !important; border-bottom-color: #1f1f26 !important; color: #918fa0 !important; }
      [data-crm-dark="1"] .m-appbar { background: #131318 !important; border-bottom-color: #1f1f26 !important; }
      [data-crm-dark="1"] .mas-screen { background: #131318 !important; }
      /* El borde va por CLASE, no por valor: React expande el shorthand a
         longhands (border-style: none none solid) cuando hay otras propiedades
         de borde, así que [style*="solid rgb(...)"] no lo alcanza. */
      [data-crm-dark="1"] .mas-screen .crm-row { border-bottom-color: #1f1f26 !important; }
      [data-crm-dark="1"] .mas-screen [style*="background: rgb(239, 238, 242)"] { background: #1f1f26 !important; }
      [data-crm-dark="1"] .mas-screen [style*="color: rgb(201, 199, 208)"] { color: #4a4a55 !important; }
      [data-crm-dark="1"] .mas-screen [style*="color: rgb(143, 141, 152)"] { color: #918fa0 !important; }

      /* La alerta no es el dato principal: superficie normal + barra roja de
         2 px. Un panel relleno gritaba más que el ARR de la cuenta. */
      /* Solo la ALERTA (clase propia) baja a superficie con barra roja: la
         regla por valor alcanzaba también a las pastillas de conteo y les
         pintaba un filete rojo de la nada. */
      [data-crm-dark="1"] .hoja-ficha .fic-alerta, [data-crm-dark="1"] .m-auto-dark .fic-alerta {
        background: #1d1d24 !important; border-left: 2px solid #F0857A !important;
        border-radius: 0 10px 10px 0 !important;
      }
      /* Restos medidos en la ficha del cliente: barras de progreso, pastillas
         lilas de fondo y el borde del grupo de periodo. */
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(240, 239, 243)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(247, 246, 250)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(221, 217, 228)"] { background: #2a2a33 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(221, 214, 251)"],
      [data-crm-dark="1"] .hoja-ficha [style*="background: rgb(212, 202, 253)"] { background: #362c55 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(230, 228, 240)"],
      [data-crm-dark="1"] .hoja-ficha [style*="solid rgb(240, 239, 245)"] { border-color: #2c2c36 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="border-radius: 9px"] { border-color: #2c2c36 !important; }
      [data-crm-dark="1"] .hoja-ficha [style*="color: rgb(140, 47, 40)"] { color: #F0857A !important; }
      /* Esqueleto de carga: sobre la superficie de la hoja, jamás en blanco */
      [data-crm-dark="1"] .hoja-sk { background: #26262e !important; }

      /* ── Gráficas y barras de los módulos del menú ─────────────────────
         La capa de gráficas se escribió con tokens claros: bandas #FBFAFF,
         gridlines y tracks de barra #F2F1F7. En oscuro eran lo más brillante
         de la pantalla —ocho meses sin dato se leían como ocho meses al tope—
         así que el track baja al hairline y la banda al morado translúcido. */
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(247, 246, 250)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(238, 238, 241)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(236, 236, 242)"] { border-color: #26262e !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(247, 246, 250)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(242, 241, 247)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(240, 239, 243)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(245, 244, 248)"] { background: #26262e !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(251, 250, 255)"] { background: rgba(167, 139, 250, .06) !important; }
      /* Una sola familia de color: el azul y el magenta de las gráficas eran
         dos acentos más compitiendo con el morado del sistema. */
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(125, 166, 245)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(236, 72, 153)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(217, 83, 142)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(155, 140, 250)"] { background: #A78BFA !important; }
      /* Los degradados de fondo se apagan SOLO en superficies grandes; en una
         barra de progreso quitar la imagen la dejaba vacía teniendo dato. */
      [data-crm-dark="1"] .m-auto-dark [style*="linear-gradient"]:not([style*="height: 100%"]):not([style*="height: 7px"]):not([style*="height: 6px"]) { background-image: none !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(125, 166, 245)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(217, 83, 142)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(79, 191, 149)"] { border-color: #26262e !important; }
      /* El sólido morado en oscuro lleva texto oscuro (contraste), como en el
         resto del sistema */
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(91, 75, 214)"] { background: #A78BFA !important; color: #1d1d24 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(91, 75, 214)"] * { color: #1d1d24 !important; }

      /* ── Los módulos del menú «Más» usan el MISMO mapa ── */
      [data-crm-dark="1"] .m-auto-dark { color: #F2F1F7 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(255, 255, 255)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background-color: rgb(255, 255, 255)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(250, 250, 250)"] { background: #1d1d24 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(245, 244, 248)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(244, 244, 246)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(244, 243, 247)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(247, 247, 251)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(245, 246, 248)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(250, 248, 255)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(246, 246, 249)"] { background: #232329 !important; }
      /* Aguas de color: conservan el significado, bajan al nivel del fondo */
      [data-crm-dark="1"] .m-auto-dark [style*="rgb(238, 236, 254)"] { background: #221c33 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="rgb(234, 248, 242)"] { background: #14291f !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="rgb(254, 240, 239)"],
      [data-crm-dark="1"] .m-auto-dark [style*="rgb(251, 236, 234)"] { background: #2d1a19 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="rgb(255, 244, 229)"] { background: #2b2314 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="rgb(227, 237, 253)"] { background: #16203a !important; }
      /* Texto: tinta y grises. El gris del sistema es #918fa0 en oscuro. */
      [data-crm-dark="1"] .m-auto-dark b, [data-crm-dark="1"] .m-auto-dark strong,
      [data-crm-dark="1"] .m-auto-dark h1, [data-crm-dark="1"] .m-auto-dark h2,
      [data-crm-dark="1"] .m-auto-dark h3, [data-crm-dark="1"] .m-auto-dark h4 { color: #F2F1F7; }
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(51, 51, 51)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(22, 24, 29)"] { color: #F2F1F7 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(119, 119, 119)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(138, 138, 138)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(165, 162, 175)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(156, 153, 166)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(179, 177, 187)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(182, 178, 194)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(138, 133, 144)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(107, 114, 128)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(107, 107, 116)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(153, 153, 153)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(136, 136, 136)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(102, 102, 102)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(143, 141, 152)"] { color: #918fa0 !important; }
      /* Semánticos: mismos papeles, contraste de oscuro */
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(192, 85, 78)"] { color: #F0857A !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(30, 138, 99)"] { color: #34D399 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(154, 106, 16)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(160, 102, 0)"] { color: #E8B04B !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(91, 75, 214)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(155, 140, 250)"] { color: #B7A8F7 !important; }
      /* Bordes: el hairline del sistema; los de color guardan su tinte */
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(236, 236, 236)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(230, 230, 234)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(238, 238, 238)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(239, 238, 242)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(240, 240, 244)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(244, 244, 246)"] { border-color: #26262e !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(221, 214, 251)"] { border-color: #362c55 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(207, 224, 250)"] { border-color: #23324f !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(247, 201, 197)"] { border-color: #43221f !important; }
      /* Campos: se capturan igual, se leen en oscuro */
      [data-crm-dark="1"] .m-auto-dark input, [data-crm-dark="1"] .m-auto-dark select,
      [data-crm-dark="1"] .m-auto-dark textarea {
        background: #232329 !important; color: #F2F1F7 !important; border-color: #2c2c36 !important;
      }
      [data-crm-dark="1"] .m-auto-dark input::placeholder,
      [data-crm-dark="1"] .m-auto-dark textarea::placeholder { color: #62626c !important; }
      /* Tintas oscuras de la ficha (#241d43 el dato, #3f3b4d el secundario,
         #5c5966 el terciario): en claro son jerarquía, en oscuro serían tinta
         sobre tinta. Medidas con sonda en la ficha del lead. */
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(36, 29, 67)"] { color: #F2F1F7 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(63, 59, 77)"] { color: #c9c7d3 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(92, 89, 102)"],
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(201, 199, 208)"] { color: #918fa0 !important; }
      /* Hairlines restantes: en oscuro se veían como rayas blancas */
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(230, 229, 236)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(245, 244, 248)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(247, 247, 250)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(244, 243, 247)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(243, 241, 248)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(241, 240, 246)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(240, 239, 243)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(247, 247, 250)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(221, 220, 227)"] { border-color: #26262e !important; }
      /* Contornos de color: conservan el semáforo, sin gritar en oscuro */
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(240, 220, 176)"] { border-color: #5a4520 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(240, 196, 189)"] { border-color: #4a2b28 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(230, 221, 250)"] { border-color: #362c55 !important; }
      /* Riel de la línea de tiempo */
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(239, 237, 245)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(248, 247, 252)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(253, 252, 255)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(255, 251, 250)"] { background: #232329 !important; }
      /* Segmented de la ficha del cliente: en claro es track gris con pastilla
         blanca; en oscuro se invertía (pastilla negra sobre track blanco). */
      [data-crm-dark="1"] .m-auto-dark .fic-seg { background: #232329 !important; }
      [data-crm-dark="1"] .m-auto-dark .fic-seg button[style*="background: rgb(255, 255, 255)"] { background: #3a3a46 !important; color: #F2F1F7 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="rgb(242, 242, 245)"] { background: linear-gradient(90deg, rgba(35,35,41,0), #232329 75%) !important; }
      /* Divisor entre las dos cifras de la cabecera del cliente */
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(236, 236, 241)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(236, 236, 236)"] { background: #2a2a33 !important; }
      /* Grises planos del CRM viejo (#f0f0f0, #f5f5f5, #eee, #f2f2f2): como
         borde salían rayas blancas y como fondo pastillas claras. */
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(240, 240, 240)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(245, 245, 245)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(242, 242, 242)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(221, 221, 221)"] { border-color: #26262e !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(245, 245, 245)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(240, 240, 240)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(242, 242, 242)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(238, 238, 238)"] { background: #232329 !important; }
      /* El tema de la ficha vive en variables: una sola definición de forma
         (arriba, global) y aquí solo los valores del oscuro. Así un botón no
         puede quedarse blanco porque su selector no matcheó dos veces. */
      [data-crm-dark="1"] .m-auto-dark {
        --hoja-btn: #232329; --hoja-line: #2c2c36; --hoja-ink: #F2F1F7;
        --hoja-caja: #26262e; --hoja-chip: #232329; --hoja-chip-ink: #918fa0;
      }
      /* La pantalla «Más» es una superficie más de la app, no un overlay
         aparte: sin esto tomaba la tinta clara del tema oscuro sobre su
         blanco original y las secciones se leían fantasma. */
      [data-crm-dark="1"] .mas-screen { background: #131318 !important; }
      /* El borde va por CLASE, no por valor: React expande el shorthand a
         longhands (border-style: none none solid) cuando hay otras propiedades
         de borde, así que [style*="solid rgb(...)"] no lo alcanza. */
      [data-crm-dark="1"] .mas-screen .crm-row { border-bottom-color: #1f1f26 !important; }
      [data-crm-dark="1"] .mas-screen [style*="background: rgb(239, 238, 242)"] { background: #1f1f26 !important; }
      [data-crm-dark="1"] .mas-screen [style*="color: rgb(201, 199, 208)"] { color: #4a4a55 !important; }
      [data-crm-dark="1"] .mas-screen [style*="color: rgb(143, 141, 152)"] { color: #918fa0 !important; }

      /* Esta regla (superficie + barra roja) va SOLO en la alerta con su
         clase: por valor alcanzaba a las pastillas de conteo y de filtro, y
         les pintaba un filete rojo que no significaba nada. */
      /* Restos medidos en la ficha del cliente: barras de progreso, pastillas
         lilas de fondo y el borde del grupo de periodo. */
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(240, 239, 243)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(247, 246, 250)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(221, 217, 228)"] { background: #2a2a33 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(221, 214, 251)"],
      [data-crm-dark="1"] .m-auto-dark [style*="background: rgb(212, 202, 253)"] { background: #362c55 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(230, 228, 240)"],
      [data-crm-dark="1"] .m-auto-dark [style*="solid rgb(240, 239, 245)"] { border-color: #2c2c36 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="border-radius: 9px"] { border-color: #2c2c36 !important; }
      [data-crm-dark="1"] .m-auto-dark [style*="color: rgb(140, 47, 40)"] { color: #F0857A !important; }
      /* Esqueleto de carga: sobre la superficie de la hoja, jamás en blanco */
      [data-crm-dark="1"] .hoja-sk { background: #26262e !important; }
      [data-crm-dark="1"] .hoja-skrow { border-bottom-color: #1f1f26 !important; }
    }

    /* Grids de 2 columnas del tab de finanzas ARR: a 1 col en teléfono.
       minmax(0,1fr) y min-width:0 en los hijos: con 1fr a secas, el min-content
       de la tabla interna (420px) infla el grid item y desborda el viewport
       aunque la tabla tenga su propio scroll. */
    .fin-k2 { grid-template-columns: minmax(0, 1fr) !important; }
    .fin-k2 > * { min-width: 0; }
    /* Los cinco KPI del panel financiero a 78 px de ancho cada uno no son
       cinco números: son cinco recortes. En el teléfono van de dos en dos. */
    .fin-k5 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
    .fin-k5 > * { min-width: 0; }
    /* ══ M5 · Piso tipográfico: nada bajo 12 px en el teléfono ══
       Los tabs densos (Consultoría 180 textos <11 px, Clientes 156, Radar 81)
       usan estilos INLINE con 0.55-0.68rem / 9-11px. Una regla externa con
       !important SÍ le gana a un style inline sin !important, y el selector de
       atributo alcanza a todos sin tocar 50 archivos. Los selectores son
       EXACTOS por diseño: "0.7rem" (con la r pegada) no atrapa a 0.75rem. */
    [style*="font-size: 0.5"], [style*="font-size: 0.6"],
    [style*="font-size: 0.7rem"], [style*="font-size: 0.71"], [style*="font-size: 0.72"], [style*="font-size: 0.73"], [style*="font-size: 0.74"],
    [style*="font-size: 8px"], [style*="font-size: 9px"], [style*="font-size: 10px"], [style*="font-size: 10."], [style*="font-size: 11px"], [style*="font-size: 11."] {
      font-size: 0.75rem !important;
    }
    /* El margen compartido del CRM (lib/crm/layout WRAP) trae 56 px laterales
       pensados para escritorio: en 390 px se comen 112. A 16 en el teléfono. */
    [style*="padding: 24px 56px"] { padding: 16px 16px 24px !important; }
    [style*="padding: 0px 56px"], [style*="padding: 0 56px"] { padding: 0 16px !important; }
    /* ══ M5 · Mínimo táctil: ningún BOTÓN bajo 36 px en el teléfono ══
       Los tabs densos repetían controles de 18-32 px por fila (el ⋯ del inbox
       ×49, "Sin fecha ✎" ×22 en Consultoría, "⇄ Mover" ×11 en Oportunidades).
       min-height le gana a height inline, así que esto los levanta a todos sin
       tocar cada archivo. Los <a> inline en prosa quedan exentos a propósito
       (excepción estándar de WCAG para links en línea de texto); las acciones
       primarias del sistema (m-row 60px, fichas 44px, barra 56px) ya cumplen
       ≥44 por su cuenta. */
    .m-tabin button:not(.m-chip), .m-tabin [role="button"],
    .cs-modal-close { min-height: 36px !important; }
    .cs-modal-close { min-width: 40px !important; min-height: 40px !important; box-sizing: border-box !important; }
    /* Action-links de fila (el "Ver" de cotizaciones ×25): son botones con
       etiqueta <a>. Los links de prosa no llevan border/background inline. */
    .m-tabin td a, .m-tabin a[style*="border"], .m-tabin a[style*="background"] {
      min-height: 36px !important; display: inline-flex !important; align-items: center !important;
    }
    /* Vista rápida: pills centradas e iguales (la regla de arriba las pisaba) */
    .m-tabin a.vr-acc[style], .m-tabin a.vr-accp[style], a.vr-acc[style], a.vr-accp[style], .vr-acc, .vr-accp {
      display: inline-flex !important; align-items: center !important; justify-content: center !important;
      flex: 1 1 0 !important; min-height: 44px !important; text-align: center !important; padding: 0 8px !important; width: auto !important;
    }

    /* ══ LA FICHA RESPIRA (Square) ═══════════════════════════════════════
       Las fichas venían del escritorio: cajas con borde dentro de la hoja,
       botones de cuatro colores pegados y cero aire. Dentro de .hoja-ficha
       la caja desaparece —el aire separa, no el marco—, el color se reserva
       al DATO y los botones quedan neutros, altos y de a dos por fila.
       GLOBAL a propósito: en el bloque dark solo aplicaría en oscuro. */
    .hoja-ficha [style*="border-radius: 12px"][style*="solid"]:not(button):not(a):not(input):not(select):not(textarea),
    .m-auto-dark [style*="border-radius: 12px"][style*="solid"]:not(button):not(a):not(input):not(select):not(textarea),
    .hoja-ficha [style*="border-radius: 10px"][style*="solid"]:not(button):not(a):not(input):not(select):not(textarea),
    .m-auto-dark [style*="border-radius: 10px"][style*="solid"]:not(button):not(a):not(input):not(select):not(textarea),
    .hoja-ficha [style*="border-radius: 14px"][style*="solid"]:not(button):not(a):not(input):not(select):not(textarea),
    .m-auto-dark [style*="border-radius: 14px"][style*="solid"]:not(button):not(a):not(input):not(select):not(textarea) {
      border-color: var(--hoja-caja, #efeef2) !important; border-width: 1px !important; border-radius: 14px !important;
      padding: 16px 16px 18px !important; margin-bottom: 18px !important;
    }
    /* Botones secundarios: un solo acabado, sin semáforo de contornos. Solo
       toca lo que YA era botón con contorno —un botón sin borde es una
       pestaña o un enlace de texto (copiar, ver más) y ahí una caja sobra—,
       y el sólido morado se respeta: es la acción principal del bloque. */
    .hoja-ficha button[style*="solid"]:not([style*="border-style: none none"]):not([style*="background: rgb(91, 75, 214)"]):not([style*="background: rgb(155, 140, 250)"]),
    .m-auto-dark button[style*="solid"]:not(.cons-fecha):not([style*="border-style: none none"]):not([style*="background: rgb(91, 75, 214)"]):not([style*="background: rgb(155, 140, 250)"]),
    .hoja-ficha a[style*="solid"]:not([style*="background: rgb(91, 75, 214)"]):not([style*="background: rgb(155, 140, 250)"]),
    .m-auto-dark a[style*="solid"]:not([style*="background: rgb(91, 75, 214)"]):not([style*="background: rgb(155, 140, 250)"]) {
      min-height: 42px !important; border-radius: 12px !important; padding: 0 14px !important;
      border: 1px solid var(--hoja-line, #e4e3ea) !important; background: var(--hoja-btn, #fff) !important;
      color: var(--hoja-ink, #1a1a1a) !important;
      font-weight: 650 !important; display: inline-flex !important; align-items: center !important;
      justify-content: center !important;
    }
    /* Fila de botones: dos por renglón, del mismo ancho, con aire */
    .hoja-ficha [style*="display: flex"][style*="flex-wrap: wrap"],
    .m-auto-dark [style*="display: flex"][style*="flex-wrap: wrap"] { gap: 8px !important; }
    /* Dos por renglón vale para GRUPOS de acciones, no para un chip suelto
       dentro de una línea de texto: ahí el botón se estiraba al 62% del ancho
       y pesaba más que el título de la partida. */
    .hoja-ficha [style*="display: flex"][style*="flex-wrap: wrap"] > button:not(.cons-fecha),
    .m-auto-dark [style*="display: flex"][style*="flex-wrap: wrap"] > button:not(.cons-fecha) { flex: 1 1 calc(50% - 8px) !important; }
    .cons-fecha { flex: 0 0 auto !important; width: max-content !important; align-self: flex-start !important; }
    /* Pastillas: el color decorativo se va; queda el morado del sistema */
    .hoja-ficha [style*="border-radius: 20px"], .hoja-ficha [style*="border-radius: 99px"]:not([style*="width: 6px"]):not([style*="height: 6px"]),
    .m-auto-dark [style*="border-radius: 20px"], .m-auto-dark [style*="border-radius: 99px"]:not([style*="width: 6px"]):not([style*="height: 6px"]) {
      background: var(--hoja-chip, #f4f3f6) !important; color: var(--hoja-chip-ink, #6b6b74) !important;
      align-self: center !important; vertical-align: middle !important;
      padding: 4px 10px !important; line-height: 1.4 !important;
    }
    /* Aire entre secciones y renglones altos: el ojo descansa */
    .hoja-ficha [style*="text-transform: uppercase"],
    .m-auto-dark [style*="text-transform: uppercase"] { margin-bottom: 12px !important; letter-spacing: .09em !important; }
    /* Encabezado de sección con su acción al lado: que no se peguen */
    .hoja-ficha [style*="display: flex"][style*="justify-content: space-between"],
    .m-auto-dark [style*="display: flex"][style*="justify-content: space-between"] { gap: 12px !important; align-items: center !important; }

    /* Fila de filtros de módulo: en el teléfono, tres controles apilados a
       ancho completo son tres renglones de cromo antes del trabajo. El
       buscador manda (ancho completo) y los dos filtros comparten renglón. */
    .mod-filtros { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; align-items: stretch !important; }
    .mod-filtros > input, .mod-filtros > input[type="search"] { grid-column: 1 / -1 !important; min-width: 0 !important; min-height: 44px !important; }
    .mod-filtros > select, .mod-filtros > label, .mod-filtros > div { min-width: 0 !important; }

    /* Las sub-vistas de un módulo son PESTAÑAS, no botones: con contorno se
       leían como seis acciones y el riel les cortaba el borde de abajo. */
    .mod-tabs { padding-bottom: 2px !important; }
    .m-auto-dark .mod-tabs button, .mod-tabs button {
      border: none !important; background: transparent !important; border-radius: 0 !important;
      padding: 0 4px !important; min-height: 40px !important; font-weight: 600 !important;
      color: #83808e !important; box-shadow: none !important;
    }
    .m-auto-dark .mod-tabs button[style*="rgb(238, 236, 254)"],
    .mod-tabs button[style*="rgb(238, 236, 254)"],
    .m-auto-dark .mod-tabs button[style*="rgb(34, 28, 51)"] {
      color: #5B4BD6 !important; font-weight: 800 !important; box-shadow: inset 0 -2px 0 #9B8CFA !important;
    }
    [data-crm-dark="1"] .m-auto-dark .mod-tabs button[style*="rgb(238, 236, 254)"],
    [data-crm-dark="1"] .m-auto-dark .mod-tabs button[style*="rgb(34, 28, 51)"] {
      color: #B7A8F7 !important; box-shadow: inset 0 -2px 0 #A78BFA !important;
    }

    /* La tarjeta de indicador (Cotizaciones, Cobranza, Pagos, Reuniones,
       Consultoría) trae del escritorio una franja de color de 3 px a la
       izquierda. En el teléfono, cuatro franjas de cuatro colores en la misma
       pantalla son cuatro acentos compitiendo: el color se queda en la CIFRA,
       que ya lo lleva, y la tarjeta se aprieta para que quepan dos por fila. */
    .kpi-card { border-left-width: 1px !important; border-left-color: #eeeef1 !important; padding: 13px 14px !important; }
    .kpi-card > div:nth-child(2) { font-size: 1.25rem !important; }
    /* La barra de reparto (asistieron / faltaron) a 3 px se perdía sobre el
       track oscuro: es el dato que dice si la reunión sirvió. */
    .kpi-card > div:last-child[style*="border-radius: 99px"] { height: 5px !important; }

    /* Acción única: a lo ancho parecía el asunto de la pantalla */
    .vr-acc:only-child, .vr-accp:only-child { flex: 0 1 auto !important; padding: 0 26px !important; }

    /* Grupos de acciones (cambiar estado del lead, de la cotización): en el
       teléfono una rejilla de cuatro cajas es justo el amontonamiento que el
       usuario rechazó. Se leen como LISTA: una acción por renglón, sin marco,
       separadas por hairline; el pulgar acierta y el ojo baja en línea recta. */
    .hoja-ficha .ficha-acciones,
    .m-auto-dark .ficha-acciones {
      display: block !important; width: 100% !important; flex: 1 1 100% !important;
      margin-top: 14px !important;
    }
    .hoja-ficha .ficha-acciones > button[style][style][style][style],
    .m-auto-dark .ficha-acciones > button[style][style][style][style],
    .hoja-ficha .ficha-acciones > a[style][style][style][style],
    .m-auto-dark .ficha-acciones > a[style][style][style][style] {
      display: flex !important; width: 100% !important; justify-content: flex-start !important;
      min-height: 48px !important; padding: 0 !important; border: none !important;
      border-bottom: 1px solid var(--hoja-caja, #efeef2) !important; border-radius: 0 !important;
      background: transparent !important; font-weight: 600 !important; font-size: 0.9rem !important;
    }
    .hoja-ficha .ficha-acciones > button:last-child[style][style][style][style],
    .m-auto-dark .ficha-acciones > button:last-child[style][style][style][style],
    .hoja-ficha .ficha-acciones > a:last-child[style][style][style][style],
    .m-auto-dark .ficha-acciones > a:last-child[style][style][style][style] { border-bottom: none !important; }

    /* Rejillas de datos de la ficha: con 342 px de ancho, un auto-fit de
       minmax(150px) mete tres columnas y las etiquetas largas ("ÚLTIMO
       CONTACTO") se encaraman. Dos columnas fijas y ritmo vertical amplio:
       cada dato queda debajo de su etiqueta, que es lo que se venía a leer. */
    .hoja-ficha [style*="gap: 26px"][style*="flex-wrap: wrap"],
    .m-auto-dark [style*="gap: 26px"][style*="flex-wrap: wrap"] {
      display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 20px 14px !important;
    }
    .hoja-ficha [style*="minmax(150px"],
    .m-auto-dark [style*="minmax(150px"] {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 22px 16px !important;
    }
    /* Las rejillas anchas (el layout de dos columnas del escritorio) van a una
       sola columna: en 342 px la segunda columna no es una columna, es un
       recorte. */
    .hoja-ficha [style*="minmax(360px"], .hoja-ficha [style*="minmax(300px"],
    .m-auto-dark [style*="minmax(360px"], .m-auto-dark [style*="minmax(300px"] {
      grid-template-columns: minmax(0, 1fr) !important;
    }
    /* La barra fija de guardar no puede tapar el último bloque */
    .hoja-ficha,
    .m-auto-dark { padding-bottom: 8px; }

    /* El selector de periodo es un ajuste, no un titular: dentro de la hoja
       pierde la caja y la palabra PERIODO —los propios botones lo dicen— y
       deja de competir con lo que de verdad se viene a leer, que es lo de
       abajo (uso de la cuenta, facturación, ventas). */
    .hoja-ficha .fic-periodo,
    .m-auto-dark .fic-periodo {
      position: static !important; border: none !important; background: transparent !important;
      padding: 0 !important; margin: 0 0 16px !important; gap: 10px !important;
    }
    .hoja-ficha .fic-periodo > span:first-child,
    .m-auto-dark .fic-periodo > span:first-child { display: none !important; }
    .hoja-ficha .fic-periodo > span:last-child,
    .m-auto-dark .fic-periodo > span:last-child { display: none !important; }
    .hoja-ficha .fic-periodo button,
    .m-auto-dark .fic-periodo button { min-height: 32px !important; font-size: 0.72rem !important; }

    /* La ficha dentro de la hoja: su scroll no contagia a la página de atrás
       (sin esto, al llegar al final la lista de abajo empieza a moverse) y la
       ficha embebida no repite el ancho ni el aire del panel de escritorio.
       GLOBAL a propósito: dentro del bloque dark solo aplicaría en oscuro. */
    .hoja-ficha { overscroll-behavior: contain; }
    .hoja-ficha > div { width: 100% !important; }

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
