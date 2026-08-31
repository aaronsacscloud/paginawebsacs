import { useState, useEffect, useRef } from 'react';
import { WRAP } from '../../lib/crm/layout';
import { useIsMobile } from '../../lib/ui/mobile';
import { createPortal } from 'react-dom';
import CotizacionActividad from './crm/CotizacionActividad';
import CamposConfig from './crm/CamposPersonalizados';
import PipelinesConfig from './crm/PipelinesConfig';
import PlanesConfig from './crm/PlanesConfig';
import { swrGet } from '../../lib/crm/swr';
import VistaRapida from './crm/ui/VistaRapida';
// El hub de agenda ya viene lazy: no engorda el bundle de Cotizaciones.
import SchedulingTab from './crm/SchedulingTab';
import MotivosLead from './crm/MotivosLead';
import MarcaTab from './crm/MarcaTab';
import PasarelaMercadoPago from './crm/PasarelaMercadoPago';
import UsuariosPermisos from './crm/UsuariosPermisos';
import MiPerfil from './crm/MiPerfil';
import { GoogleCalendarPanel } from '../scheduling/GoogleCalendarPanel';
import CotizacionesDashboard from './crm/CotizacionesDashboard';
import RegistrarPagoModal, { resumenCierre } from './crm/RegistrarPagoModal';
import { plans as plansData } from '../../data/plans';
import { PLANS, PLAN_PRICES, IMPL_PRICES, METODOS, COMISION_CATEGORIAS, COMISION_LABELS, COMISION_RATES, fmt, fmtDate } from '../../lib/quotes/constants';
import { parseMeta, serializeMeta, addTimelineEvent } from '../../lib/quotes/meta';

// ─── Gama del módulo ───
// Dos familias con trabajos distintos.
//
// MORADO #9B8CFA y AZUL CIELO #7DA6F5 son los protagonistas: visten los botones
// importantes y todo lo estructural. Sus versiones aguadas rellenan las
// pastillas y sus versiones oscuras dan el texto que va encima — no son colores
// nuevos, es el mismo tono subido o bajado de luz.
//
// VERDE y ROJO están reservados al dinero y a nada más: verde un monto que ya
// se pagó, rojo lo vencido o eliminado. Por eso "por qué se pierden" va en azul
// y no en rojo — perder por precio no es una urgencia de hoy.
const M = {
  violeta: '#9B8CFA', azul: '#7DA6F5',
  violetaAgua: '#EEECFE', azulAgua: '#E3EDFD', azulAgua2: '#DDE8FC',
  violetaTinta: '#5B4BD6', azulTinta: '#2C5FC4', violetaHondo: '#4536BE',
  // Pastel en la FORMA —punto, franja, barra— y tinta en la CIFRA. El color
  // suave es decoración; la cantidad de dinero es información y si se despinta
  // hay que acercarse a la pantalla para leerla, docenas de veces al día.
  verde: '#4FBF95', verdeTinta: '#1E8A63', verdeAgua: '#EAF8F2',
  rojo: '#EF7A72', rojoTinta: '#C0554E', rojoAgua: '#FEF0EF',
  gris: '#E5E3EA', grisAgua: '#F4F4F6', grisTinta: '#6B7280', grisPunto: '#C9C7D0',
} as const;
import { PLANTILLAS_ROI, PLANES_SIN_PLANTILLA, driversParaPlanes, costoHoraParaPlanes, calcularRoi, payback, textoSupuestos, type Driver } from '../../lib/quotes/roi';

// ── Cuándo la vieron ──
// El número de vistas dice que hay interés; CUÁNDO fue la última dice si el
// interés es de ahora o de la semana pasada — que es lo que decide si vale la
// pena llamar hoy. Se arma el detalle completo para el hover y un "hace X"
// visible sin tener que pasar el mouse.
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-MX', {
  timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
function haceTexto(iso?: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'hace segundos';
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24); return d === 1 ? 'ayer' : `hace ${d} d`;
}
function detalleVistas(meta: any): string {
  const n = meta?.views || 0;
  if (!n) return 'Nadie la ha abierto todavía.';
  const eventos = (meta.timeline || []).filter((t: any) => t.event === 'viewed' && t.at).map((t: any) => t.at).reverse();
  const lineas = [
    `${n} ${n === 1 ? 'vista' : 'vistas'}`,
    meta.first_viewed_at ? `Primera: ${fechaHora(meta.first_viewed_at)}` : '',
    meta.last_viewed_at ? `Última: ${fechaHora(meta.last_viewed_at)} (${haceTexto(meta.last_viewed_at)})` : '',
  ].filter(Boolean);
  if (eventos.length > 1) {
    lineas.push('', 'Cada vez que la abrió:');
    // Las 10 más recientes: el histórico completo de una cotización muy vista
    // no cabe en un tooltip y tampoco se lee.
    for (const at of eventos.slice(0, 10)) lineas.push('· ' + fechaHora(at));
    if (eventos.length > 10) lineas.push(`… y ${eventos.length - 10} más`);
  }
  return lineas.join('\n');
}
import { calcQuoteTotals } from '../../lib/quotes/totals';
import Cargando, { Corazones } from './crm/ui/Cargando';
import { SeccionWA } from './crm/whatsapp/ConfigWhatsApp';

interface Client {
  id: string; empresa: string; contacto: string; email: string; whatsapp: string;
  plan: string; sucursales: number; precio_mensual: number; metodo_pago: string;
  fecha_inicio: string; fecha_renovacion: string; estado: string; notas: string;
}

type Tab = 'dashboard' | 'cotizaciones' | 'config';

interface RevenueHubProps {
  _initialTab?: Tab;
  _hideNav?: boolean;
}

/** AA de "Aaron Araujo"; si solo hay correo, sus dos primeras letras. */
const inicialesYo = (n?: string | null) => {
  const t = String(n || '').trim();
  if (!t) return '—';
  const p = t.split(/[\s@.]+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || t.slice(0, 2).toUpperCase();
};


// ── Configuración y personalización ─────────────────────────────────────────
// Una pantalla completa, no una pestaña más: se abre encima del CRM y se cierra
// con la X, como la del sistema. A la izquierda los MISMOS grupos y módulos del
// menú —así, cuando aparezca una configuración nueva, ya se sabe dónde va—; a
// la derecha sus ajustes, cada uno con su valor actual a la vista para no tener
// que abrirlo, y adentro el editor de siempre.

type CfgItem = { id: string; ico: string; t: string; d: string; v?: string; mudado?: boolean; editor: React.ReactNode };
type CfgMod = { id: string; nom: string; sub: string; items: CfgItem[] };
type CfgGrupo = { g: string; mods: CfgMod[] };

const CFG_ICONOS: Record<string, string> = {
  yo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1" stroke-linecap="round"/></svg>',
  llave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v4M15.5 12v3" stroke-linecap="round"/></svg>',
  marca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="9.5" r="5.5"/><path d="M9 14.5 8 22l4-2.2L16 22l-1-7.5" stroke-linejoin="round"/></svg>',
  gente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="4"/><path d="M2 21v-1.5A5.5 5.5 0 017.5 14h3a5.5 5.5 0 015.5 5.5V21M17 8h5M19.5 5.5v5" stroke-linecap="round"/></svg>',
  campos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M8 13h8M8 16.5h5" stroke-linecap="round"/></svg>',
  pipe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h18l-7 8v6l-4 2v-8z" stroke-linejoin="round"/></svg>',
  folio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l4 4v14H6z" stroke-linejoin="round"/><path d="M14 3v5h5M9 13h6M9 17h4" stroke-linecap="round"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5" stroke-linecap="round"/></svg>',
  banco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10l9-6 9 6M5 10v8M19 10v8M3 20h18M9 10v8M15 10v8" stroke-linecap="round"/></svg>',
  tarjeta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h3" stroke-linecap="round"/></svg>',
  agenda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4" stroke-linecap="round"/></svg>',
  catalogo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 4.5-8 4.5-8-4.5z" stroke-linejoin="round"/><path d="M4 12l8 4.5 8-4.5M4 16.5L12 21l8-4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a4 4 0 01-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 015.4-5.4z" stroke-linejoin="round"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.5 8.5 0 01-12.6 7.4L3 21l2.2-5.2A8.5 8.5 0 1121 11.5z" stroke-linejoin="round"/></svg>',
  etiqueta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12V4h8l9 9-8 8-9-9z" stroke-linejoin="round"/><circle cx="7.5" cy="7.5" r="1.4"/></svg>',
  tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3h4l2 5-2.5 1.5a12 12 0 006 6L16 13l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z" stroke-linejoin="round"/></svg>',
};

function CfgFila({ it, ruta, onAbrir }: { it: CfgItem; ruta?: string; onAbrir: () => void }) {
  return (
    <button onClick={onAbrir}
      style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', textAlign: 'left', padding: '16px 20px', background: '#fff', border: 'none', borderBottom: '1px solid #f6f4fb', cursor: 'pointer', fontFamily: 'inherit' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FBFAFF'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}>
      <span style={{ width: 42, height: 42, borderRadius: 12, background: '#F3F0FE', color: '#7C6BF0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ display: 'flex', width: 19, height: 19 }} dangerouslySetInnerHTML={{ __html: CFG_ICONOS[it.ico] || '' }} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: '0.91rem', fontWeight: 700, color: '#241d43' }}>
          {it.t}
          {it.mudado && <span style={{ marginLeft: 8, fontSize: '0.52rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', background: '#FFF4E5', color: '#9a6a10', borderRadius: 20, padding: '2px 8px', verticalAlign: 2 }}>Antes en Ajustes</span>}
        </span>
        <span style={{ display: 'block', fontSize: '0.77rem', color: '#8e88a8', marginTop: 2, lineHeight: 1.45, maxWidth: '66ch' }}>
          {ruta && <b style={{ color: '#a49dbd', fontWeight: 700 }}>{ruta} — </b>}{it.d}
        </span>
      </span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {it.v && <span style={{ fontSize: '0.73rem', color: '#a49dbd', fontWeight: 600 }}>{it.v}</span>}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9c4dc" strokeWidth="2" strokeLinecap="round"><polyline points="9 6 15 12 9 18" /></svg>
      </span>
    </button>
  );
}

function CfgPantalla({ mapa, mod, item, q, onMod, onItem, onQ, onCerrar }: {
  mapa: CfgGrupo[]; mod: string; item: string; q: string;
  onMod: (m: string) => void; onItem: (m: string, i: string) => void; onQ: (v: string) => void; onCerrar: () => void;
}) {
  // Mientras está abierta, lo de atrás no se mueve: si el CRM sigue con scroll
  // propio, cerrar la pantalla te deja en otro punto de la lista.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, []);

  const todos = mapa.flatMap(g => g.mods.map(m => ({ ...m, g: g.g })));
  const actual = todos.find(m => m.id === mod) || todos[0];
  const abierto = actual?.items.find(i => i.id === item) || null;
  const busca = q.trim().toLowerCase();
  const hits = busca
    ? todos.flatMap(m => m.items.filter(i => `${i.t} ${i.d} ${m.nom}`.toLowerCase().includes(busca)).map(i => ({ i, m })))
    : [];

  const pantalla = (
    /* Medidas en unidades de VENTANA, no del contenedor: aunque algún ancestro
       creara un bloque contenedor —un transform, un filter, un contain—, la
       pantalla sigue midiendo lo que mide la ventana. Con inset:0 a secas se
       encogía al tamaño de ese ancestro. */
    <div style={{
      position: 'fixed', top: 0, left: 0, zIndex: 200,
      width: '100vw', height: '100dvh', maxWidth: '100vw',
      background: '#fff', display: 'flex', flexDirection: 'column',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{ height: 4, flexShrink: 0, background: 'linear-gradient(90deg,#9B8CFA 0%,#7DA6F5 55%,rgba(244,168,205,.9) 100%)' }} />
      {/* En el teléfono no caben dos columnas: el riel se vuelve una lista
          corta arriba —con su propio scroll— y el contenido queda debajo. */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* La página del CRM esconde el cromo del sitio público con
           "nav, header, footer { display:none !important }". Esta pantalla no
           usa esas etiquetas, y además se blinda por clase: una clase gana a un
           selector de etiqueta aunque los dos lleven !important. */
        .cfg-cab, .cfg-cuerpo, .cfg-riel, .cfg-main { display: revert !important; }
        .cfg-cab { display: flex !important; }
        .cfg-cuerpo { display: grid !important; }
        .cfg-riel, .cfg-main { display: block !important; }
        @media (max-width: 860px) {
          .cfg-cuerpo { grid-template-columns: 1fr !important; grid-template-rows: auto 1fr; }
          .cfg-riel { max-height: 30vh; border-right: none !important; border-bottom: 1px solid #f0eef7; }
          .cfg-main { padding: 18px 16px 50px !important; }
        }
        @media (max-width: 620px) {
          /* El título y el buscador dejan de pelearse por el mismo renglón. */
          .cfg-cab { padding: 12px 16px 12px !important; gap: 10px !important; }
          .cfg-cab h1 { font-size: 1.05rem !important; }
          .cfg-cab-acc { margin-left: 0 !important; width: 100%; }
          .cfg-cab-acc > div { flex: 1; width: auto !important; }
        }
      ` }} />

      <div className="cfg-cab" style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 22px 14px', borderBottom: '1px solid #f0eef7', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '1.32rem', fontWeight: 800, letterSpacing: '-.02em', margin: 0, color: '#241d43' }}>Configuración y personalización</h1>
          <p style={{ fontSize: '0.77rem', color: '#6b7280', margin: '3px 0 0' }}>Cada ajuste vive donde vive su módulo.</p>
        </div>
        <div className="cfg-cab-acc" style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #eae4f8', background: '#FBFAFF', borderRadius: 10, padding: '0 12px', height: 36, width: 240 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a49dbd" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input value={q} onChange={e => onQ(e.target.value)} placeholder="Buscar un ajuste…"
              style={{ border: 'none', background: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '0.8rem', color: '#241d43', width: '100%' }} />
          </div>
          <button onClick={onCerrar} title="Cerrar" aria-label="Cerrar configuración"
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid #efedf6', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>

      <div className="cfg-cuerpo" style={{ flex: 1, display: 'grid', gridTemplateColumns: '262px 1fr', minHeight: 0 }}>
        {/* Riel: los grupos del menú, con sus módulos */}
        <div className="cfg-riel" style={{ borderRight: '1px solid #f0eef7', overflowY: 'auto', padding: '10px 0 30px', background: '#fdfcff' }}>
          {mapa.map((g, gi) => (
            <div key={g.g}>
              <div style={{ fontSize: '0.55rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: '#b0a8c9', padding: gi === 0 ? '8px 22px 6px' : '16px 22px 6px' }}>{g.g}</div>
              {g.mods.map(m => {
                const on = m.id === actual?.id && !busca;
                return (
                  <button key={m.id} onClick={() => onMod(m.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 16px)', margin: '1px 8px',
                      textAlign: 'left', border: 'none', background: on ? '#F0EDFE' : 'none', color: on ? '#4C3BD0' : '#4b4560',
                      fontFamily: 'inherit', fontSize: '0.83rem', fontWeight: on ? 700 : 500, padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
                    }}
                    onMouseEnter={e => { if (!on) (e.currentTarget as HTMLElement).style.background = '#f6f3fd'; }}
                    onMouseLeave={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'none'; }}>
                    {m.nom}
                    {m.items.length > 0 && <span style={{ marginLeft: 'auto', fontSize: '0.58rem', fontWeight: 800, color: on ? '#7C6BF0' : '#a49dbd' }}>{m.items.length}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Contenido */}
        <div className="cfg-main" style={{ overflowY: 'auto', minWidth: 0, padding: '24px 30px 60px' }}>
          {busca ? (
            <>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#241d43' }}>Resultados</h2>
              <p style={{ fontSize: '0.81rem', color: '#6b7280', margin: '0 0 18px' }}>{hits.length} ajuste{hits.length === 1 ? '' : 's'} con “{q.trim()}”.</p>
              {hits.length ? (
                <div style={{ border: '1px solid #f0eef7', borderRadius: 16, overflow: 'hidden', width: '100%', maxWidth: 900 }}>
                  {hits.map(h => <CfgFila key={h.m.id + h.i.id} it={h.i} ruta={`${h.m.g} › ${h.m.nom}`} onAbrir={() => onItem(h.m.id, h.i.id)} />)}
                </div>
              ) : (
                <div style={{ maxWidth: 900, border: '1px dashed #e6dff7', borderRadius: 16, padding: 24, background: '#fdfcff', color: '#6b7280', fontSize: '0.82rem' }}>
                  Nada con ese nombre. Los ajustes se llaman como el módulo al que pertenecen.
                </div>
              )}
            </>
          ) : abierto ? (
            <>
              <button onClick={() => onMod(actual.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 700, color: '#7C6BF0', cursor: 'pointer', padding: 0, marginBottom: 12 }}>
                ← {actual.nom}
              </button>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#241d43' }}>{abierto.t}</h2>
              <p style={{ fontSize: '0.81rem', color: '#6b7280', margin: '0 0 18px', lineHeight: 1.55, maxWidth: '74ch' }}>{abierto.d}</p>
              <div style={{ maxWidth: 980 }}>{abierto.editor}</div>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: '#241d43' }}>{actual?.nom}</h2>
              <p style={{ fontSize: '0.81rem', color: '#6b7280', margin: '0 0 18px', lineHeight: 1.55, maxWidth: '74ch' }}>{actual?.sub}</p>
              {actual?.items.length ? (
                <div style={{ border: '1px solid #f0eef7', borderRadius: 16, overflow: 'hidden', width: '100%', maxWidth: 900 }}>
                  {actual.items.map(it => <CfgFila key={it.id} it={it} onAbrir={() => onItem(actual.id, it.id)} />)}
                </div>
              ) : (
                <div style={{ maxWidth: 900, border: '1px dashed #e6dff7', borderRadius: 16, padding: 24, background: '#fdfcff', color: '#6b7280', fontSize: '0.82rem', lineHeight: 1.65 }}>
                  <b style={{ color: '#241d43' }}>Todavía no hay nada que configurar aquí.</b><br />
                  Cuando este módulo tenga un ajuste —un catálogo, un aviso, una plantilla— este es su lugar, y no una pantalla aparte.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Al <body>: así ningún contenedor del CRM puede recortarla ni encogerla.
  // En el servidor no hay document, y entonces se devuelve tal cual.
  return typeof document !== 'undefined' ? createPortal(pantalla, document.body) : pantalla;
}

export default function RevenueHub({ _initialTab, _hideNav }: RevenueHubProps = {}) {
  const [tab, setTab] = useState<Tab>(_initialTab || 'dashboard');
  // Quién entró: lo pinta la sección "Datos del usuario" de Configuración.
  const [yo, setYo] = useState<any>(null);
  useEffect(() => {
    let vivo = true;
    fetch('/api/auth/yo').then(r => r.json()).then(j => { if (vivo && !j.error) setYo(j); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  const [dash, setDash] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [quoteForm, setQuoteForm] = useState<any>({});
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankForm, setBankForm] = useState<any>({});
  // Configuración: qué sección del sistema se está viendo y qué ajuste está
  // abierto. Arranca cerrado: la pantalla es un índice, no un formulario.
  const [cfgMod, setCfgMod] = useState<string>('perfil');
  const [cfgItem, setCfgItem] = useState<string>('');
  const [cfgQ, setCfgQ] = useState<string>('');
  const [altaBanco, setAltaBanco] = useState<any>(null);
  const [recup, setRecup] = useState<any>(null);
  const [condicionesTpl, setCondicionesTpl] = useState<any[]>([]);
  const [allQuotes, setAllQuotes] = useState<any[]>([]);
  const [partnersById, setPartnersById] = useState<Record<string, { nombre: string; email?: string }>>({});

  const load = async () => {
    // Aparte del Promise.all de abajo: meterlo ahí corría las posiciones del
    // destructuring y las cotizaciones se cargaban con los datos del banco.
    fetch('/api/revenue/condiciones').then(r => r.json())
      .then(x => setCondicionesTpl(Array.isArray(x) ? x : [])).catch(() => {});
    // REGLA DE VELOCIDAD: las cotizaciones pintan del caché de la sesión al
    // instante; la red las refresca junto con el resto del hub.
    try { const raw = sessionStorage.getItem('swr:/api/revenue/quotes'); if (raw) { const qc = JSON.parse(raw); if (Array.isArray(qc)) setAllQuotes(qc); } } catch { /* nada */ }
    const [d, ba, q, p] = await Promise.all([
      fetch('/api/revenue/dashboard').then(r => r.json()),
      fetch('/api/revenue/bank-accounts').then(r => r.json()),
      fetch('/api/revenue/quotes').then(r => r.json()),
      fetch('/api/revenue/partners-list').then(r => r.json()).catch(() => []),
    ]);
    setDash(d);
    setBankAccounts(Array.isArray(ba) ? ba : []);
    setAllQuotes(Array.isArray(q) ? q : []);
    try { if (Array.isArray(q)) sessionStorage.setItem('swr:/api/revenue/quotes', JSON.stringify(q)); } catch { /* nada */ }
    const map: Record<string, { nombre: string; email?: string }> = {};
    (Array.isArray(p) ? p : []).forEach((row: any) => {
      if (row?.id) map[row.id] = { nombre: row.nombre || 'Partner', email: row.email };
    });
    setPartnersById(map);
  };

  useEffect(() => { load(); }, []);

  const [dashCot, setDashCot] = useState(false);

  // Sync tab when controlled by CrmDashboard
  useEffect(() => {
    if (_initialTab && _initialTab !== tab) setTab(_initialTab);
  }, [_initialTab]);

  // ─── Dashboard ───
  const DashboardView = () => {
    if (!dash) return <Cargando texto="Cargando el tablero…" alto={220} />;
    const chartData = Object.entries(dash.monthlyRevenue || {}).map(([month, amount]) => ({
      month: month.slice(5),
      amount,
    }));

    return (
      <div>
        {/* KPIs */}
        <div style={S.kpiRow}>
          {[
            { label: 'MRR', value: fmt(dash.mrr), color: '#4B7BE5' },
            { label: 'ARR', value: fmt(dash.arr), color: '#2AB5A0' },
            { label: 'Clientes activos', value: dash.activeClients, color: '#6C5CE7' },
            { label: 'Churn', value: dash.churnRate + '%', color: dash.churnRate > 5 ? '#E54B4B' : '#2AB5A0' },
          ].map(k => (
            <div key={k.label} style={S.kpi}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: '0.6875rem', color: '#999', fontWeight: 500, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Revenue chart */}
        <div style={S.card}>
          <h3 style={S.cardTitle}>Ingresos mensuales</h3>
          {/* CSS bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200 }}>
            {chartData.map((d: any, i: number) => {
              const max = Math.max(...chartData.map((x: any) => x.amount as number), 1);
              const h = ((d.amount as number) / max) * 180;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div title={fmt(d.amount as number)} style={{ width: '100%', height: h, background: '#4B7BE5', borderRadius: '4px 4px 0 0', minHeight: 2, transition: 'height 0.3s ease' }} />
                  <span style={{ fontSize: '0.5625rem', color: '#aaa' }}>{d.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Overdue */}
          <div style={S.card}>
            <h3 style={{ ...S.cardTitle, color: '#E54B4B' }}>Vencidos ({(dash.overdue || []).length})</h3>
            {(dash.overdue || []).length === 0 ? <div style={S.empty}>Sin vencidos</div> :
              (dash.overdue || []).map((c: any) => (
                <div key={c.id} style={S.listItem}>
                  <div><strong>{c.empresa}</strong> · {c.plan}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#E54B4B' }}>Venció: {fmtDate(c.fecha_renovacion)}</div>
                </div>
              ))
            }
          </div>

          {/* Next renewals */}
          <div style={S.card}>
            <h3 style={S.cardTitle}>Próximas renovaciones</h3>
            {(dash.nextRenewals || []).length === 0 ? <div style={S.empty}>Sin renovaciones próximas</div> :
              (dash.nextRenewals || []).slice(0, 10).map((c: any) => (
                <div key={c.id} style={S.listItem}>
                  <div><strong>{c.empresa}</strong> · {fmt(c.precio_mensual * (c.sucursales || 1))}/mes</div>
                  <div style={{ fontSize: '0.6875rem', color: '#E8A838' }}>Renueva: {fmtDate(c.fecha_renovacion)}</div>
                </div>
              ))
            }
          </div>
        </div>

        {/* By plan */}
        <div style={S.card}>
          <h3 style={S.cardTitle}>Distribución por plan</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
            {Object.entries(dash.byPlan || {}).map(([plan, data]: any) => (
              <div key={plan} style={{ flex: '1 0 120px', background: '#f8f9fb', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: '0.6875rem', color: '#999', textTransform: 'capitalize' as const }}>{plan}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a' }}>{data.count}</div>
                <div style={{ fontSize: '0.6875rem', color: '#4B7BE5' }}>{fmt(data.mrr)}/mes</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline funnel */}
        {allQuotes.length > 0 && (() => {
          const total = allQuotes.length;
          const sent = allQuotes.filter((q: any) => q.estado === 'sent' || q.estado === 'accepted' || q.estado === 'paid');
          const viewed = allQuotes.filter((q: any) => { const { meta } = parseMeta(q.notas); return (meta.views || 0) > 0; });
          const accepted = allQuotes.filter((q: any) => q.estado === 'accepted' || q.estado === 'paid');
          const paid = allQuotes.filter((q: any) => q.estado === 'paid');
          const stages = [
            { label: 'Creadas', count: total, amount: allQuotes.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#999', width: 100 },
            { label: 'Enviadas', count: sent.length, amount: sent.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#4B7BE5', width: total > 0 ? Math.max((sent.length / total) * 100, 20) : 20 },
            { label: 'Vistas', count: viewed.length, amount: viewed.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#6C5CE7', width: total > 0 ? Math.max((viewed.length / total) * 100, 15) : 15 },
            { label: 'Aceptadas', count: accepted.length, amount: accepted.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#2AB5A0', width: total > 0 ? Math.max((accepted.length / total) * 100, 10) : 10 },
            { label: 'Pagadas', count: paid.length, amount: paid.reduce((s: number, q: any) => s + (q.total || 0), 0), color: '#2e7d32', width: total > 0 ? Math.max((paid.length / total) * 100, 8) : 8 },
          ];
          return (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Pipeline de cotizaciones</h3>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                {stages.map((st, i) => {
                  const prevCount = i > 0 ? stages[i - 1].count : st.count;
                  const rate = prevCount > 0 ? Math.round((st.count / prevCount) * 100) : 0;
                  return (
                    <div key={st.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 70, fontSize: '0.6875rem', fontWeight: 600, color: '#666', textAlign: 'right' as const }}>{st.label}</div>
                      <div style={{ flex: 1, position: 'relative' as const }}>
                        <div style={{ width: `${st.width}%`, height: 32, background: st.color, borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 10, gap: 8, transition: 'width 0.4s ease', margin: '0 auto' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#fff' }}>{st.count}</span>
                          <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.7)' }}>{fmt(st.amount)}</span>
                        </div>
                      </div>
                      <div style={{ width: 40, fontSize: '0.625rem', fontWeight: 600, color: i === 0 ? 'transparent' : st.count > 0 ? '#2AB5A0' : '#ccc' }}>{i > 0 ? `${rate}%` : ''}</div>
                    </div>
                  );
                })}
              </div>
              {total > 0 && (
                <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#999' }}>Tasa de cierre: <strong style={{ color: accepted.length > 0 ? '#2AB5A0' : '#ccc' }}>{total > 0 ? Math.round((accepted.length / total) * 100) : 0}%</strong></div>
                  <div style={{ fontSize: '0.6875rem', color: '#999' }}>Valor pipeline: <strong style={{ color: '#4B7BE5' }}>{fmt(sent.reduce((s: number, q: any) => s + (q.total || 0), 0))}</strong></div>
                  <div style={{ fontSize: '0.6875rem', color: '#999' }}>Ticket promedio: <strong style={{ color: '#1a1a1a' }}>{fmt(total > 0 ? allQuotes.reduce((s: number, q: any) => s + (q.total || 0), 0) / total : 0)}</strong></div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  // ─── Quotes ───
  const QuotesView = () => {
    const [quotes, setQuotes] = useState<any[]>([]);
    // Mientras no llega la PRIMERA respuesta, la tabla no está vacía: está
    // cargando. Sin esta bandera la pantalla decía "Sin resultados" con las
    // pestañas en cero, que se lee como "no hay nada" y no como "ya viene".
    const [quotesCargando, setQuotesCargando] = useState(true);
    const [showDrawer, setShowDrawer] = useState(false);
    const [qf, setQf] = useState<any>({ empresa: '', contacto: '', email: '', whatsapp: '', items: [], iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern', condiciones: (condicionesTpl.find((t: any) => t.es_default) || condicionesTpl[0])?.texto || 'Precios en MXN. Migracion incluida en planes de pago. Soporte por chat SACS y WhatsApp incluido. Sin contratos de permanencia.' });
    const [qSearch, setQSearch] = useState('');
    const [qFilter, setQFilter] = useState<string>('all');
    const [qSort, setQSort] = useState<{ col: string; asc: boolean }>({ col: 'created_at', asc: false });
    const [qPage, setQPage] = useState(0);
    // HubSpot-style: saved views, advanced filters, bulk selection, column customization, density
    const [qView, setQView] = useState<string>(() => typeof window !== 'undefined' ? (localStorage.getItem('sacs_q_view') || 'all') : 'all');
    const [qPageSize, setQPageSize] = useState<number>(() => typeof window !== 'undefined' ? (parseInt(localStorage.getItem('sacs_q_pagesize') || '25') || 25) : 25);
    const [qSelected, setQSelected] = useState<Set<string>>(new Set());
    const [qDensity, setQDensity] = useState<'compact' | 'comfortable'>(() => typeof window !== 'undefined' ? ((localStorage.getItem('sacs_q_density') as any) || 'comfortable') : 'comfortable');
    const [qVisibleCols, setQVisibleCols] = useState<Set<string>>(() => {
      const defaults = ['numero', 'created_at', 'empresa', 'origen', 'total', 'abonado', 'estado', 'views', 'actions'];
      if (typeof window === 'undefined') return new Set(defaults);
      const saved = localStorage.getItem('sacs_q_cols');
      return new Set(saved ? JSON.parse(saved) : defaults);
    });
    const [qShowColsMenu, setQShowColsMenu] = useState(false);
    const [qShowFilterPopover, setQShowFilterPopover] = useState(false);
    const [qFilters, setQFilters] = useState<Array<{ field: string; op: string; value: any }>>([]);
    const [qMenuRow, setQMenuRow] = useState<string | null>(null);
    // El menú se ancla con position FIXED y las coordenadas del botón. En
    // absolute lo recortaba el contenedor de la tabla: con una sola fila —o con
    // la última de la lista— se veía cortado a la mitad.
    const [qMenuPos, setQMenuPos] = useState<{ x: number; y: number; arriba: boolean }>({ x: 0, y: 0, arriba: false });
    // Eliminar una cotización pide MOTIVO: es un documento que se le mandó al
    // cliente con folio y precio, y borrarlo sin explicación es lo que después
    // impide saber por qué se le cotizó dos veces.
    const [aEliminar, setAEliminar] = useState<any[]>([]);
    const [verActividad, setVerActividad] = useState<string | null>(null);
    // Los 5 números del mes se calculan en el servidor: dos de ellos necesitan
    // los ABONOS, y aquí solo hay cotizaciones. Calcularlos en el front daría un
    // "pendiente" que ignora los anticipos.
    const [kpis, setKpis] = useState<any>(null);
    // ══ Móvil v5 (mockup Cotizaciones): chips Abiertas/Aceptadas/Vencidas ══
    const esMovilQ = useIsMobile();
    const [chipQ, setChipQ] = useState<'abiertas' | 'aceptadas' | 'vencidas'>('abiertas');
    const [rapidaQ, setRapidaQ] = useState<any>(null);
    // Cada tarjeta se abre con la lista que forma su número: un KPI que no se
    // puede desarmar termina en "¿de dónde salió esto?".
    const [panelKpi, setPanelKpi] = useState<string>('');
    const cargarKpis = () => swrGet('/api/revenue/quotes/kpis', setKpis).catch(() => {});
    useEffect(() => { cargarKpis(); }, []);

    // Llegar desde "Cotizar esta idea" (ficha del cliente → Mejoras). La idea
    // que salió en una junta se vuelve cobro sin volver a capturarla: se abre
    // la cotización con el concepto y el monto ya puestos.
    useEffect(() => {
      if (typeof window === 'undefined') return;
      const p = new URLSearchParams(window.location.search);
      if (p.get('nueva') !== '1') return;
      // Llegar desde la MINUTA DE UN LEAD: los conceptos ya se decidieron en la
      // junta, así que se traen de la reunión en vez de recapturarlos. La
      // cotización no se crea sola —el precio y el descuento los pone una
      // persona—, solo se abre el formulario lleno.
      const reunionId = p.get('reunion');
      if (reunionId) {
        window.history.replaceState({}, '', window.location.pathname + '?tab=cotizaciones');
        (async () => {
          const r = await fetch('/api/scheduling/reuniones?id=' + encodeURIComponent(reunionId)).then(x => x.json()).catch(() => null);
          const b0 = (Array.isArray(r?.data) ? r.data[0] : Array.isArray(r) ? r[0] : null);
          const min = b0?.minuta || {};
          const reqs = (Array.isArray(min.requerimientos) ? min.requerimientos : []).filter((x: any) => x.incluir);
          // El PRIMER número: "3 tiendas + 1 bodega" no son 31 sucursales.
          const suc = Math.max(1, parseInt(String(min.ficha?.sucursales || '').match(/\d+/)?.[0] || '1', 10));
          const banco2 = bankAccounts.find((x: any) => x.es_default) || bankAccounts[0];
          const items: any[] = [];
          if (min.plan_sugerido) {
            items.push({ tipo: 'plan', nombre: min.plan_sugerido, periodo: 'anual', sucursales: String(suc), descuento_pct: 0 });
          }
          // Lo que ya viene dentro del plan NO se cobra aparte: entraría dos
          // veces en el total y el prospecto lo nota.
          for (const q of reqs) {
            if (q.incluido || q.categoria === 'plan') continue;
            items.push({ tipo: 'extra', categoria_comision: 'personalizacion', nombre: q.titulo,
                         monto: Number(q.valor || 0), recurrente: false, descripcion: q.cita ? `Lo pidió así: "${q.cita}"` : '' });
          }
          setQf({
            empresa: p.get('empresa') || '', contacto: b0?.invitee_nombre || '', email: b0?.invitee_email || '', whatsapp: b0?.invitee_whatsapp || '',
            company_id: p.get('company_id') || b0?.company_id || null,
            items, iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern',
            condiciones: (condicionesTpl.find((t: any) => t.es_default) || condicionesTpl[0])?.texto || '',
            notas: min.intereso ? `De la reunión del ${b0?.fecha || ''}: ${min.intereso}` : '',
            ...(banco2 ? { bank_account_id: banco2.id, mostrar_banco: true } : {}),
          });
          setShowDrawer(true);
        })();
        return;
      }
      const concepto = (p.get('concepto') || '').trim();
      const monto = Math.max(0, Number(p.get('importe') || 0));
      const banco = bankAccounts.find((b: any) => b.es_default) || bankAccounts[0];
      setQf({
        empresa: p.get('empresa') || '', contacto: '', email: '', whatsapp: '',
        company_id: p.get('company_id') || null,
        items: concepto ? [{ tipo: 'extra', categoria_comision: 'personalizacion', nombre: concepto, monto, recurrente: false, descripcion: p.get('detalle') || '' }] : [],
        iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern',
        condiciones: (condicionesTpl.find((t: any) => t.es_default) || condicionesTpl[0])?.texto || '',
        ...(banco ? { bank_account_id: banco.id, mostrar_banco: true } : {}),
      });
      setShowDrawer(true);
      // Se limpia la barra de direcciones: recargar no debe volver a abrir una
      // cotización nueva encima de la que se está capturando.
      window.history.replaceState({}, '', window.location.pathname);
    }, [bankAccounts.length, condicionesTpl.length]);
    // El archivo se carga aparte: son pocas y no tienen por qué pesar en la
    // vista de todos los días.
    const [archivadas, setArchivadas] = useState<any[]>([]);
    const cargarArchivadas = () => fetch('/api/revenue/quotes?archivadas=1').then(r => r.json())
      .then(d => setArchivadas(Array.isArray(d) ? d : [])).catch(() => {});
    const PER_PAGE = qPageSize;
    // Transcript analysis
    const [showTranscriptModal, setShowTranscriptModal] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [showReview, setShowReview] = useState(false);
    // Manual accept modal
    const [acceptForm, setAcceptForm] = useState<any>(null); // { quoteId, numero, nombre, method, nota }
    const [acceptSaving, setAcceptSaving] = useState(false);
    // Reject modal
    const [rejectForm, setRejectForm] = useState<any>(null); // { quoteId, numero, motivo, detalle }
    const [rejectSaving, setRejectSaving] = useState(false);
    // Minuta IA
    const [formattingMinuta, setFormattingMinuta] = useState(false);
    const [minutaError, setMinutaError] = useState<string | null>(null);
    // Extender vigencia
    const [extendForm, setExtendForm] = useState<any>(null); // { id, numero, vigencia, days }
    const [extending, setExtending] = useState(false);

    // El catálogo de plugins (Configuración → Planes y plugins). El botón
    // "+ Plugin" abría un renglón EN BLANCO: el nombre se tecleaba a mano en
    // cada venta y por eso hay 64 nombres distintos para 15 conceptos. Ahora
    // se elige del catálogo y el concepto entra homologado, con su descripción
    // y su precio de lista.
    const [catPlugins, setCatPlugins] = useState<any[]>([]);
    const [pickerPlugin, setPickerPlugin] = useState(false);
    useEffect(() => {
      fetch('/api/crm/arr/plans').then(r => r.json())
        .then(j => setCatPlugins((j.data || []).filter((p: any) => p.categoria === 'plugin')))
        .catch(() => {});
    }, []);

    useEffect(() => {
      fetch('/api/revenue/quotes').then(r => r.json())
        .then(d => setQuotes(Array.isArray(d) ? d : []))
        .catch(() => {})
        .finally(() => setQuotesCargando(false));
    }, []);

    // Close row menu / popovers on outside click
    useEffect(() => {
      const close = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-q-menu]') && !target.closest('button[title="Más acciones"]')) setQMenuRow(null);
      };
      // Un menú fijo se queda flotando si la página se mueve debajo: se cierra.
      const cerrarScroll = () => setQMenuRow(null);
      document.addEventListener('mousedown', close);
      window.addEventListener('scroll', cerrarScroll, true);
      window.addEventListener('resize', cerrarScroll);
      return () => {
        document.removeEventListener('mousedown', close);
        window.removeEventListener('scroll', cerrarScroll, true);
        window.removeEventListener('resize', cerrarScroll);
      };
    }, []);

    // Ensure items is always an array
    const items = Array.isArray(qf.items) ? qf.items : [];
    const [cobrando, setCobrando] = useState<any>(null);
    const [verMasOpc, setVerMasOpc] = useState(false);

    // ─── Paquetes: el cliente elige ENTRE opciones, no si compra ───
    // La maquinaria ya existía —la cotización pública pinta las pestañas y
    // recalcula el total de cada una— pero solo el portal de partners podía
    // armarlas. Desde aquí no había forma, así que la plantilla Interactiva
    // habría salido vacía.
    const paquetes: any[] = Array.isArray(qf.paquetes) ? qf.paquetes : [];
    const paquetesOn = paquetes.length >= 2;
    const togglePaquetes = () => {
      if (paquetesOn) {
        // Al apagar, los conceptos vuelven a ser de todos: dejarlos marcados
        // los escondería si mañana se vuelve a encender con otras opciones.
        setQf({ ...qf, paquetes: [], items: items.map((it: any) => { const { paquete: _p, ...r } = it; return r; }) });
      } else {
        setQf({ ...qf, paquetes: [{ id: 'a', nombre: 'Opción Esencial' }, { id: 'b', nombre: 'Opción Completa' }] });
      }
    };
    const totalDePaquete = (pid: string) => calcQuoteTotals({
      items: items.filter((it: any) => !it.paquete || it.paquete === pid),
      descuento_global: qf.descuento_global, descuento_tipo: qf.descuento_tipo, iva_mode: ivaMode,
    }).grandTotal;

    const addPlanItem = () => {
      setQf({ ...qf, items: [...items, { tipo: 'plan', nombre: 'controla', sucursales: 1, precio_unitario: 1215, periodo: 'mensual', descuento_pct: 0, subtotal: 1215 }] });
    };

    const addExtraItem = () => {
      setQf({ ...qf, items: [...items, { tipo: 'extra', nombre: '', monto: 0, recurrente: false, descripcion: '' }] });
    };

    // Cada botón guarda su categoria_comision. No es cosmético: licencia,
    // plugin, personalizacion y hardware son las categorías con las que YA se
    // calcula la comisión del partner (35 / 25 / 20 / 5 %). Metiendo todo como
    // "Extra" sin categoría, el sistema la ADIVINABA leyendo el nombre del
    // concepto — un plugin llamado "conector con Shopify" pegaba de casualidad,
    // y uno llamado "enlace con su ERP" se comisionaba como personalización.
    const addPluginItem = () => {
      // Sin catálogo cargado no se bloquea la venta: cae al renglón libre de
      // siempre. Peor que un nombre a mano es no poder cotizar.
      if (!catPlugins.length) {
        setQf({ ...qf, items: [...items, { tipo: 'extra', categoria_comision: 'plugin', nombre: '', monto: 0, recurrente: false, descripcion: '' }] });
        return;
      }
      setPickerPlugin(true);
    };

    /** Mete un plugin del catálogo como concepto, ya con su modalidad de cobro.
     *  `precio_es_total` avisa que el monto YA es el del periodo: sin él, un
     *  plugin de $9,900 al año se multiplicaría por 10 (la regla de los planes,
     *  donde el monto se captura mensual y el año son 10 meses). */
    const elegirPlugin = (p: any, modalidad: string) => {
      const precio = modalidad === 'vitalicio' ? p.precio_vitalicio
        : modalidad === 'anual' ? p.precio_anual : p.precio_mensual;
      const monto = Number(precio) || 0;
      setQf({ ...qf, items: [...items, {
        tipo: 'extra', categoria_comision: 'plugin',
        nombre: p.nombre, descripcion: p.descripcion || '', plan_slug: p.slug,
        monto, subtotal: monto, precio_es_total: true,
        periodo_extra: modalidad === 'vitalicio' ? 'unico' : modalidad,
        recurrente: modalidad !== 'vitalicio',
      }] });
      setPickerPlugin(false);
    };
    const addPersonalizacionItem = () => {
      setQf({ ...qf, items: [...items, { tipo: 'extra', categoria_comision: 'personalizacion', nombre: '', monto: 0, recurrente: false, descripcion: '' }] });
    };

    // Una sola tarjeta de concepto. Se extrae de la lista porque ahora hay dos
    // listas —conceptos y promociones— y las dos pintan lo mismo. El índice que
    // recibe es el REAL dentro de items: filtrar y reindexar haría que borrar
    // una promoción borrara el concepto que quedó en esa posición.
    const renderItem = (item: any, idx: number) => (
                  <div key={idx} style={{ background: item.es_promocion ? '#ecfdf5' : '#f8f9fb', borderRadius: 10, padding: 12, marginBottom: 8, position: 'relative' as const, border: item.es_promocion ? '1.5px solid #2AB5A0' : 'none' }}>
                    <button onClick={() => removeItem(idx)} style={{ position: 'absolute' as const, top: 8, right: 8, background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                    {item.tipo === 'plan' ? (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Plan</label><select value={item.nombre} onChange={e => updateItem(idx, 'nombre', e.target.value)} style={S.input}>{PLANS.map(p => <option key={p} value={p}>{p} (${PLAN_PRICES[p]})</option>)}</select></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Sucursales</label><input type="number" value={item.sucursales} onChange={e => updateItem(idx, 'sucursales', e.target.value)} style={S.input} /></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Período</label><select value={item.periodo} onChange={e => updateItem(idx, 'periodo', e.target.value)} style={S.input}><option value="mensual">Mensual</option><option value="anual">Anual (2 meses gratis)</option></select></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Desc. %</label><input type="number" value={item.descuento_pct || 0} onChange={e => updateItem(idx, 'descuento_pct', e.target.value)} style={S.input} /></div>
                        </div>
                        <div style={{ marginTop: 6 }}><input value={item.nota || ''} onChange={e => updateItem(idx, 'nota', e.target.value)} placeholder="Nota (opcional)" style={{ ...S.input, fontSize: '0.6875rem' }} /></div>
                      </div>
                    ) : item.es_promocion ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#fff', background: '#2AB5A0', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Promocion</span>
                          <span style={{ fontSize: '0.5625rem', color: '#999' }}>Al contratar plan anual</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6, marginBottom: 6 }}>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Concepto</label><input value={item.nombre || ''} onChange={e => updateItem(idx, 'nombre', e.target.value)} style={S.input} /></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Valor original</label><input type="number" value={item.precio_original || ''} onChange={e => updateItem(idx, 'precio_original', parseFloat(e.target.value) || 0)} style={S.input} /></div>
                          <div style={{ gridColumn: '1/-1' }}><label style={{ ...S.label, marginTop: 0 }}>Descripción</label><input value={item.descripcion || ''} onChange={e => updateItem(idx, 'descripcion', e.target.value)} style={S.input} /></div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ textDecoration: 'line-through', color: '#ccc', fontWeight: 600 }}>{fmt(item.precio_original || 0)}</span>
                          <span style={{ fontSize: '1.125rem', fontWeight: 800, color: '#2AB5A0' }}>$0</span>
                          <span style={{ fontSize: '0.625rem', color: '#999', marginLeft: 4 }}>Gratis al contratar plan anual</span>
                        </div>
                        <input value={item.nota || ''} onChange={e => updateItem(idx, 'nota', e.target.value)} placeholder="Nota (opcional)" style={{ ...S.input, fontSize: '0.6875rem' }} />
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Concepto</label><input value={item.nombre || ''} onChange={e => updateItem(idx, 'nombre', e.target.value)} placeholder="Ej. Implementación" style={S.input} /></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Monto</label><input type="number" value={item.monto || ''} onChange={e => updateItem(idx, 'monto', e.target.value)} style={S.input} /></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Descripción</label><input value={item.descripcion || ''} onChange={e => updateItem(idx, 'descripcion', e.target.value)} style={S.input} /></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Periodo</label><select value={item.periodo_extra || (item.recurrente ? 'mensual' : 'unico')} onChange={e => updateItem(idx, 'periodo_extra', e.target.value)} style={S.input}><option value="unico">{item.precio_es_total ? 'Vitalicio / único' : 'Unico'}</option><option value="mensual">Mensual</option><option value="anual">{item.precio_es_total ? 'Anual' : 'Anual (×10 meses)'}</option></select></div>
                        </div>
                        <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
                          <input value={item.nota || ''} onChange={e => updateItem(idx, 'nota', e.target.value)} placeholder="Nota (opcional)" style={{ ...S.input, fontSize: '0.6875rem' }} />
                          {/* Visible y corregible: de esta categoría depende la
                              comisión del partner. Si se deja vacía, el sistema
                              la adivina leyendo el nombre — que es lo que pasaba
                              con todo antes de separar los botones. */}
                          {paquetesOn && (
                            <select value={item.paquete || ''} onChange={e => updateItem(idx, 'paquete', e.target.value || undefined)}
                              title="¿En qué opción aparece este concepto?" style={{ ...S.input, fontSize: '0.6875rem' }}>
                              <option value="">En todas las opciones</option>
                              {paquetes.map((p: any) => <option key={p.id} value={p.id}>Solo {p.nombre}</option>)}
                            </select>
                          )}
                          {!item.es_promocion && (
                            <select value={item.categoria_comision || ''} onChange={e => updateItem(idx, 'categoria_comision', e.target.value)}
                              title="Define la comisión del partner" style={{ ...S.input, fontSize: '0.6875rem' }}>
                              <option value="">Categoría: automática</option>
                              {COMISION_CATEGORIAS.map(c => <option key={c} value={c}>{COMISION_LABELS[c]} · {COMISION_RATES[c]}%</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    )}
                    {!item.es_promocion && <div style={{ textAlign: 'right' as const, fontSize: '0.875rem', fontWeight: 700, color: '#2AB5A0', marginTop: 6 }}>{fmt(item.subtotal || item.monto || 0)}</div>}
                  </div>
    );

    const updateItem = (idx: number, field: string, value: any) => {
      const arr = [...items];
      arr[idx] = { ...arr[idx], [field]: value };
      if (arr[idx].tipo === 'plan') {
        const p = PLAN_PRICES[arr[idx].nombre] || 0;
        arr[idx].precio_unitario = p;
        const suc = parseInt(arr[idx].sucursales) || 1;
        const isAnn = arr[idx].periodo === 'anual';
        const sub = p * suc * (isAnn ? 10 : 1);
        const disc = sub * (parseFloat(arr[idx].descuento_pct || 0) / 100);
        arr[idx].subtotal = sub - disc;
      } else if (!arr[idx].es_promocion) {
        const base = parseFloat(arr[idx].monto) || 0;
        const pe = arr[idx].periodo_extra || (arr[idx].recurrente ? 'mensual' : 'unico');
        arr[idx].recurrente = pe === 'mensual' || pe === 'anual';
        // El ×10 es la regla de los PLANES: el monto se captura mensual y el
        // año son 10 meses (2 gratis). Un plugin del catálogo trae el precio ya
        // del periodo, así que multiplicarlo cobraría diez veces de más.
        arr[idx].subtotal = pe === 'anual' && !arr[idx].precio_es_total ? base * 10 : base;
      }
      setQf({ ...qf, items: arr });
    };

    const removeItem = (idx: number) => {
      setQf({ ...qf, items: items.filter((_: any, i: number) => i !== idx) });
    };

    // iva_mode: 'sin' = sin IVA, 'suma' = IVA sumado al total, 'incluido' = IVA ya incluido en precios
    const ivaMode = qf.iva_mode || (qf.iva_incluido ? 'suma' : 'sin');
    const { itemsSubtotal, globalDisc, afterDisc, ivaMonto, grandTotal } = calcQuoteTotals({
      items,
      descuento_global: qf.descuento_global,
      descuento_tipo: qf.descuento_tipo,
      iva_mode: ivaMode,
    });

    const createQuote = async () => {
      // Validate required fields for TikTok tracking
      if (!qf.empresa?.trim() || !qf.email?.trim() || !qf.whatsapp?.trim()) {
        alert('Empresa, Email y WhatsApp son obligatorios');
        return;
      }
      setSaving(true);
      const isEdit = !!qf.id;
      // Store logo_url in meta, add timeline events
      let notas = qf.notas || '';
      const { text, meta } = parseMeta(notas);
      if (qf.logo_url) meta.logo_url = qf.logo_url;
      else delete meta.logo_url;
      meta.iva_mode = ivaMode;
      meta.mostrar_timer = qf.mostrar_timer !== undefined ? qf.mostrar_timer : true;
      meta.mostrar_features = qf.mostrar_features !== undefined ? qf.mostrar_features : true;
      meta.mostrar_desglose = qf.mostrar_desglose !== undefined ? qf.mostrar_desglose : true;
      meta.mostrar_condiciones = qf.mostrar_condiciones !== undefined ? qf.mostrar_condiciones : true;
      meta.mostrar_key_points = qf.mostrar_key_points !== undefined ? qf.mostrar_key_points : true;
      meta.mostrar_roi = qf.mostrar_roi || false;
      meta.mostrar_antes_despues = qf.mostrar_antes_despues || false;
      meta.mostrar_firma = qf.mostrar_firma !== undefined ? qf.mostrar_firma : true;
      meta.mostrar_qr = qf.mostrar_qr !== undefined ? qf.mostrar_qr : true;
      meta.mostrar_animaciones = qf.mostrar_animaciones !== undefined ? qf.mostrar_animaciones : true;
      meta.mostrar_timeline = qf.mostrar_timeline !== undefined ? qf.mostrar_timeline : true;
      meta.timeline_tipo = qf.timeline_tipo || '1suc';
      meta.mostrar_porque_sacs = qf.mostrar_porque_sacs !== undefined ? qf.mostrar_porque_sacs : true;
      meta.mostrar_implementacion = qf.mostrar_implementacion !== undefined ? qf.mostrar_implementacion : true;
      if (qf.promo_label?.trim()) meta.promo_label = qf.promo_label.trim();
      else delete meta.promo_label;
      // El plan de parcialidades viaja con la cotización: es parte del trato.
      if (Array.isArray(qf.plan_pagos) && qf.plan_pagos.length) {
        meta.plan_pagos = qf.plan_pagos
          .filter((x: any) => Number(x.monto) > 0 && x.fecha)
          .map((x: any, i: number) => ({ id: x.id || 'p' + i, fecha: String(x.fecha).slice(0, 10), monto: Number(x.monto), concepto: String(x.concepto || `Parcialidad ${i + 1}`).slice(0, 80) }))
          .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha));
      } else delete meta.plan_pagos;
      if (qf.minuta_raw?.trim()) meta.minuta_raw = qf.minuta_raw.trim();
      else delete meta.minuta_raw;
      if (paquetes.length >= 2) meta.paquetes = paquetes;
      else delete meta.paquetes;
      if (qf.key_points?.length) meta.key_points = qf.key_points;
      else delete meta.key_points;
      if (qf.roi) meta.roi = qf.roi;
      else delete meta.roi;
      if (qf.antes_despues?.length) meta.antes_despues = qf.antes_despues;
      else delete meta.antes_despues;

      // Version tracking — full snapshot for navigation
      if (!meta.versions) meta.versions = [];
      const snapshot = {
        at: new Date().toISOString(), total: Math.round(grandTotal),
        items_count: items.length, moneda: qf.moneda || 'MXN',
        items: JSON.parse(JSON.stringify(items)),
        subtotal: itemsSubtotal, iva_monto: Math.round(ivaMonto),
        descuento_global: parseFloat(qf.descuento_global) || 0,
        descuento_tipo: qf.descuento_tipo || 'pct',
        condiciones: qf.condiciones || '',
      };
      if (!isEdit) {
        meta.versions.push({ v: 1, ...snapshot });
      } else {
        const nextV = (meta.versions.length || 0) + 1;
        meta.versions.push({ v: nextV, ...snapshot });
      }

      notas = serializeMeta(text, meta);
      if (!isEdit) {
        notas = addTimelineEvent(notas, 'created');
        notas = addTimelineEvent(notas, 'sent');
      } else {
        notas = addTimelineEvent(notas, 'edited');
      }
      // Remove frontend-only fields
      const { _custom_days, _es_cliente, _ctx_n, _ctx_ultima, logo_url, iva_mode: _im, _pago_mode, mostrar_timer: _mt, mostrar_features: _mf, mostrar_desglose: _md, mostrar_condiciones: _mc, mostrar_key_points: _mkp, key_points: _kp, roi: _roi, antes_despues: _ad, mostrar_roi: _mr, mostrar_antes_despues: _mad, mostrar_firma: _msf, mostrar_qr: _mq, mostrar_animaciones: _ma, mostrar_timeline: _mtl, timeline_tipo: _tt, mostrar_implementacion: _mi, implementacion_nota: _in, mostrar_porque_sacs: _mps, promo_label: _pl, minuta_raw: _mr2, paquetes: _pq, ...rest } = qf;
      const folioOffset = typeof window !== 'undefined' ? parseInt(localStorage.getItem('sacs_folio_offset') || '0') || 0 : 0;
      // Con opciones, el documento se guarda con el total de la PRIMERA: sumar los
      // conceptos de todas daría un total que no corresponde a nada que el cliente
      // pueda comprar. Cuando elija otra y acepte, el servidor lo recalcula.
      const tCot = paquetes.length >= 2
        ? calcQuoteTotals({ items: items.filter((it: any) => !it.paquete || it.paquete === paquetes[0].id), descuento_global: qf.descuento_global, descuento_tipo: qf.descuento_tipo, iva_mode: ivaMode })
        : { itemsSubtotal, ivaMonto, grandTotal };
      const body = { ...rest, notas, subtotal: tCot.itemsSubtotal, iva_incluido: ivaMode !== 'sin', iva_monto: Math.round(tCot.ivaMonto), total: Math.round(tCot.grandTotal), estado: rest.estado || 'sent', _folio_offset: folioOffset };

      // Save quote first
      const res = await fetch('/api/revenue/quotes', { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const savedQuote = await res.json();

      // Generate Stripe link if mode is stripe
      if (_pago_mode === 'stripe' && savedQuote.id && Math.round(grandTotal) > 0) {
        const stripeRes = await fetch('/api/revenue/create-payment-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quote_id: savedQuote.id,
            numero: savedQuote.numero,
            empresa: savedQuote.empresa,
            email: savedQuote.email,
            total: Math.round(grandTotal),
            moneda: savedQuote.moneda || 'MXN',
            items: Array.isArray(savedQuote.items) ? savedQuote.items : [],
            vigencia: savedQuote.vigencia,
          }),
        });
        const stripeData = await stripeRes.json();
        if (stripeData.url) {
          await fetch('/api/revenue/quotes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: savedQuote.id, link_pago: stripeData.url }),
          });
        }
      }

      setShowDrawer(false);
      setQf({ empresa: '', contacto: '', email: '', whatsapp: '', items: [], iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern', condiciones: (condicionesTpl.find((t: any) => t.es_default) || condicionesTpl[0])?.texto || 'Precios en MXN. Migracion incluida. Soporte por chat SACS y WhatsApp. Sin contratos.', ...(() => { const d = bankAccounts.find((b: any) => b.es_default) || bankAccounts[0]; return d ? { bank_account_id: d.id, mostrar_banco: true } : {}; })() });
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
      setSaving(false);
    };

    // Abre el modal. Los dos prompt() encadenados se escribían a mano —un typo
    // en "transferencia" y el reporte por método deja de cuadrar— y en celular
    // eran impracticables. Tampoco decían que cobrar cierra la oportunidad y
    // convierte al lead en cliente.
    const markQuotePaid = (q: any) => setCobrando(q);

    const trasCobrar = async (data: any) => {
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
      setCobrando(null);
      const extra = resumenCierre(data?.cierre);
      const linea = extra ? '\n' + extra.charAt(0).toUpperCase() + extra.slice(1) + '.' : '';
      if (data?.acuse_url) {
        const goNow = confirm(`✓ Pago registrado.${linea}\n\nAcuse: ${data.acuse_url}\n${data?.acuse_email?.ok ? 'Email enviado al cliente.' : 'No se pudo enviar el email — abre el acuse y reenvíalo.'}\n\n¿Abrir el acuse ahora?`);
        if (goNow) window.open(data.acuse_url + '?admin', '_blank');
      } else {
        alert(`✓ Pago registrado.${linea}`);
      }
    };

    const formatMinuta = async () => {
      const raw = (qf.minuta_raw || '').trim();
      setMinutaError(null);
      if (raw.length < 30) {
        setMinutaError('Escribe al menos 30 caracteres con los puntos de la llamada.');
        return;
      }
      // Warn before overwriting existing manual edits
      const existing = (qf.key_points || []).length;
      if (existing > 0) {
        const ok = confirm(`Ya tienes ${existing} ${existing === 1 ? 'punto' : 'puntos'} en la minuta. Procesar con IA reemplazará todos los puntos actuales. ¿Continuar?`);
        if (!ok) return;
      }
      setFormattingMinuta(true);
      try {
        const res = await fetch('/api/revenue/format-minuta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw }),
        });
        let data: any = {};
        try { data = await res.json(); } catch { /* non-JSON response */ }
        if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
        const newPoints = Array.isArray(data.key_points) ? data.key_points : [];
        if (newPoints.length === 0) {
          setMinutaError('No se pudieron extraer puntos. Agrega más detalle a las notas y vuelve a intentar.');
        } else {
          // La IA también propone los números del ROI cuando la minuta los
          // menciona. Se PRELLENAN, no se dan por buenos: el bloque queda
          // visible con sus renglones para revisarlos antes de mandar.
          const r = data.roi;
          const patch: any = { key_points: newPoints };
          if (r) {
            const planes = Array.from(new Set(items.filter((i: any) => i.tipo === 'plan').map((i: any) => i.nombre)))
              .filter((x: any) => !PLANES_SIN_PLANTILLA.includes(x)) as string[];
            const drivers = driversParaPlanes(planes);
            const entradas = {
              ventas_mes: r.ventas_mes || undefined, stock_valor: r.stock_valor || undefined,
              compras_mes: r.compras_mes || undefined, clientes_activos: r.clientes_activos || undefined,
              ticket_promedio: r.ticket_promedio || undefined, costo_hora: costoHoraParaPlanes(planes),
            };
            // Si dijo cuántas horas gasta, se respeta ese número en vez del de
            // la plantilla: es dato del cliente contra un supuesto nuestro.
            if (r.horas_admin) for (const d of drivers) if (d.tipo === 'horas') d.valor = r.horas_admin;
            const c = calcularRoi(entradas, drivers);
            if (c.mensual > 0) {
              patch.roi = { ...(qf.roi || {}), ...entradas, drivers, problema: r.problema || qf.roi?.problema || '', ahorro_mensual: c.mensual };
              patch.mostrar_roi = true;
            }
          }
          setQf({ ...qf, ...patch });
        }
      } catch (e: any) {
        setMinutaError(e?.message || 'Error de red al procesar la minuta');
      } finally {
        setFormattingMinuta(false);
      }
    };

    const openExtendModal = (q: any) => {
      setExtendForm({ id: q.id, numero: q.numero, vigencia: q.vigencia, days: 2 });
    };

    const submitExtend = async () => {
      if (!extendForm) return;
      const days = parseInt(extendForm.days);
      if (!Number.isFinite(days) || days < 1) { alert('Días inválidos'); return; }
      setExtending(true);
      try {
        const res = await fetch('/api/revenue/extend-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: extendForm.id, days }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al extender');
        const d = await fetch('/api/revenue/quotes').then(r => r.json());
        setQuotes(Array.isArray(d) ? d : []);
        setExtendForm(null);
      } catch (e: any) {
        alert(e.message || 'Error al extender la cotización');
      } finally {
        setExtending(false);
      }
    };

    const openAcceptModal = (q: any) => {
      setAcceptForm({ quoteId: q.id, numero: q.numero, nombre: q.contacto || q.empresa || '', method: 'whatsapp', nota: '' });
    };

    const openRejectModal = (q: any) => {
      setRejectForm({ quoteId: q.id, numero: q.numero, empresa: q.empresa, motivo: '', detalle: '' });
    };

    const confirmReject = async () => {
      if (!rejectForm) return;
      if (!rejectForm.motivo) { alert('Selecciona el motivo'); return; }
      setRejectSaving(true);
      try {
        const res = await fetch('/api/revenue/mark-rejected', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteId: rejectForm.quoteId,
            motivo: rejectForm.motivo,
            detalle: rejectForm.detalle || '',
            from: 'admin',
          }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data?.error || 'Error al marcar como rechazada'); setRejectSaving(false); return; }
        const d = await fetch('/api/revenue/quotes').then(r => r.json());
        setQuotes(Array.isArray(d) ? d : []);
        setRejectForm(null);
      } finally {
        setRejectSaving(false);
      }
    };

    const confirmAccept = async () => {
      if (!acceptForm) return;
      const nombre = String(acceptForm.nombre || '').trim();
      if (!nombre) { alert('Ingresa el nombre con el que se firmará'); return; }
      setAcceptSaving(true);
      try {
        const res = await fetch('/api/revenue/mark-accepted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId: acceptForm.quoteId, aceptado_por: nombre, method: acceptForm.method, nota_interna: acceptForm.nota }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data?.error || 'Error al aceptar la cotización'); setAcceptSaving(false); return; }
        const d = await fetch('/api/revenue/quotes').then(r => r.json());
        setQuotes(Array.isArray(d) ? d : []);
        setAcceptForm(null);
      } finally {
        setAcceptSaving(false);
      }
    };

    const duplicateQuote = async (q: any) => {
      const copy = { ...q, id: undefined, numero: undefined, estado: 'draft', created_at: undefined };
      setSaving(true);
      await fetch('/api/revenue/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copy) });
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
      setSaving(false);
    };

    // ─── Filter, search, sort, paginate ───
    const estadoLabels: Record<string, string> = { draft: 'Borrador', sent: 'Enviada', accepted: 'Aceptada', paid: 'Pagada', expired: 'Vencida', rejected: 'Rechazada', parcial: 'Parcial', deleted: 'Eliminado' };
    const estadoColors: Record<string, { bg: string; fg: string; dot: string }> = {
      // Fondo aguado y punto saturado: se distinguen a un metro sin que la
      // tabla se vuelva un semáforo. Solo pagada y vencida salen de la familia
      // morado/azul, porque son las dos que hablan de dinero.
      draft:    { bg: M.grisAgua,    fg: M.grisTinta,    dot: M.grisPunto },
      sent:     { bg: M.azulAgua,    fg: M.azulTinta,    dot: M.azul },
      parcial:  { bg: M.violetaAgua, fg: M.violetaTinta, dot: M.violeta },
      accepted: { bg: M.violetaAgua, fg: M.violetaHondo, dot: M.violetaTinta },
      paid:     { bg: M.verdeAgua,   fg: M.verdeTinta,   dot: M.verde },
      expired:  { bg: M.rojoAgua,    fg: M.rojoTinta,    dot: M.rojo },
      rejected: { bg: M.grisAgua,    fg: M.grisTinta,    dot: M.grisPunto },
      deleted:  { bg: M.rojoAgua,    fg: M.rojoTinta,    dot: M.rojo },
    };

    /**
     * El estado que se MUESTRA. "Enviada" con un anticipo encima es falso: ya
     * pagó una parte. Y una enviada que el cliente abrió no es lo mismo que una
     * que quizá ni le llegó — la primera se persigue, la segunda se reenvía.
     */
    const estadoVisual = (q: any, _vistas: number): string => {
      const abonado = Number(q.abonado || 0);
      const total = Number(q.total || 0);
      if (q.estado !== 'paid' && abonado > 0 && abonado < total - 0.01) return 'parcial';
      return q.estado;
    };

    // ── La próxima parcialidad pactada ──
    // Las fechas del plan se capturan al cotizar y viven en el meta de la
    // cotización. Aquí se leen para poder decir CUÁNDO toca el siguiente pago
    // en vez de cuántos días le quedan a un precio que el cliente ya aceptó.
    const hoyISO = new Date().toISOString().slice(0, 10);
    const abonadoPorQuote = new Map<string, number>((quotes || []).map((q: any) => [q.id, Number(q.abonado || 0)]));
    const proximaParcialidad = (q: any): { fecha: string; numero: number; total: number; monto: number } | null => {
      let meta: any = {};
      try {
        const sep = '\n---META---\n';
        const i = String(q.notas || '').indexOf(sep);
        if (i >= 0) meta = JSON.parse(String(q.notas).slice(i + sep.length));
      } catch { /* sin meta legible: no hay plan */ }
      const plan = Array.isArray(meta?.plan_pagos) ? [...meta.plan_pagos] : [];
      if (!plan.length) return null;
      plan.sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha)));
      // El dinero abonado cubre las exhibiciones en orden de fecha: es la única
      // regla que no inventa nada cuando no hay recibo por parcialidad.
      let restante = Number(q.abonado || 0);
      for (let i = 0; i < plan.length; i++) {
        const monto = Number(plan[i].monto || 0);
        const cubierto = Math.min(monto, Math.max(0, restante));
        restante -= cubierto;
        if (monto - cubierto > 0.01) {
          return { fecha: String(plan[i].fecha || '').slice(0, 10), numero: i + 1, total: plan.length, monto: Math.round((monto - cubierto) * 100) / 100 };
        }
      }
      return null;
    };

    // Saved views (HubSpot-style presets)
    const savedViews = [
      { id: 'all', label: 'Todas' },
      { id: 'active', label: 'Activas' },              // draft + sent
      { id: 'closing', label: 'En cierre' },           // accepted sin pagar
      { id: 'paid', label: 'Pagadas' },
      { id: 'expiring', label: 'Por vencer' },         // sent con ≤ 5 días
      { id: 'stale', label: 'Sin actividad' },         // sent > 7 días sin vistas
      { id: 'hot', label: 'Más vistas' },              // views ≥ 5
      { id: 'rejected', label: 'Rechazadas' },         // estado=rejected
      { id: 'archivadas', label: 'Archivadas' },     // eliminadas, con su motivo
    ];

    const now = Date.now();
    const daysSince = (iso: string | null | undefined) => {
      if (!iso) return Infinity;
      const t = new Date(iso).getTime();
      if (isNaN(t)) return Infinity;
      return (now - t) / 86400000;
    };
    const daysUntil = (iso: string | null | undefined) => {
      if (!iso) return Infinity;
      const t = new Date(iso).getTime();
      if (isNaN(t)) return Infinity;
      return (t - now) / 86400000;
    };

    const matchesView = (q: any, view: string, viewsCount: number) => {
      if (view === 'all') return true;
      if (view === 'active') return q.estado === 'draft' || q.estado === 'sent';
      if (view === 'closing') return q.estado === 'accepted';
      if (view === 'paid') return q.estado === 'paid';
      if (view === 'expiring') return q.estado === 'sent' && daysUntil(q.vigencia) >= 0 && daysUntil(q.vigencia) <= 5;
      if (view === 'stale') return q.estado === 'sent' && daysSince(q.created_at) > 7 && viewsCount === 0;
      if (view === 'hot') return viewsCount >= 5;
      if (view === 'rejected') return q.estado === 'rejected';
      // El archivo se cuenta y se lista aparte (la lista activa nunca trae
      // archivadas). Sin esta línea caía en el `return true` de abajo y la
      // pestaña anunciaba 32 archivadas cuando había 3.
      if (view === 'archivadas') return q.estado === 'deleted';
      return true;
    };

    const matchesAdvFilter = (q: any, f: { field: string; op: string; value: any }) => {
      const val = q[f.field];
      if (f.field === 'total') {
        const n = Number(q.total || 0);
        const v = Number(f.value);
        if (f.op === 'gt') return n > v;
        if (f.op === 'lt') return n < v;
        if (f.op === 'eq') return n === v;
      }
      if (f.field === 'created_at' || f.field === 'vigencia') {
        const d = daysSince(val);
        const v = Number(f.value);
        if (f.op === 'within') return d <= v;
        if (f.op === 'older') return d > v;
      }
      if (f.field === 'estado') {
        const list = Array.isArray(f.value) ? f.value : [f.value];
        return list.includes(q.estado);
      }
      return true;
    };

    const fuente = qView === 'archivadas' ? archivadas : quotes;
    const filtered = fuente
      .map((q: any) => ({ q, views: parseMeta(q.notas).meta.views || 0 }))
      .filter(({ q, views }) => {
        if (qView !== 'archivadas' && !matchesView(q, qView, views)) return false;
        if (qFilter !== 'all' && q.estado !== qFilter) return false;
        for (const f of qFilters) { if (!matchesAdvFilter(q, f)) return false; }
        if (!qSearch) return true;
        const s = qSearch.toLowerCase();
        return (q.numero || '').toLowerCase().includes(s) ||
          (q.empresa || '').toLowerCase().includes(s) ||
          (q.contacto || '').toLowerCase().includes(s) ||
          (q.email || '').toLowerCase().includes(s) ||
          (q.whatsapp || '').toLowerCase().includes(s) ||
          String(q.total || '').includes(s);
      })
      .sort((a, b) => {
        const dir = qSort.asc ? 1 : -1;
        if (qSort.col === 'total') return ((a.q.total || 0) - (b.q.total || 0)) * dir;
        if (qSort.col === 'abonado') return ((a.q.abonado || 0) - (b.q.abonado || 0)) * dir;
        if (qSort.col === 'views') return (a.views - b.views) * dir;
        const va = a.q[qSort.col] || '';
        const vb = b.q[qSort.col] || '';
        return va < vb ? -dir : va > vb ? dir : 0;
      });

    const filteredQuotes = filtered.map(x => x.q);
    const filteredViewsMap = new Map(filtered.map(x => [x.q.id, x.views]));

    const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / PER_PAGE));
    const safePage = Math.min(qPage, totalPages - 1);
    const paginated = filteredQuotes.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

    // Count by estado + view
    const counts: Record<string, number> = { all: quotes.length };
    quotes.forEach((q: any) => { counts[q.estado] = (counts[q.estado] || 0) + 1; });
    const viewCounts: Record<string, number> = {};
    savedViews.forEach(v => {
      viewCounts[v.id] = v.id === 'archivadas'
        ? archivadas.length
        : quotes.filter((q: any) => matchesView(q, v.id, parseMeta(q.notas).meta.views || 0)).length;
    });

    // KPI stats
    const totalPending = quotes.filter((q: any) => q.estado === 'sent' || q.estado === 'accepted').reduce((s: number, q: any) => s + (q.total || 0), 0);
    const totalPaidThisMonth = quotes.filter((q: any) => {
      if (q.estado !== 'paid') return false;
      const d = new Date(q.updated_at || q.created_at);
      const nd = new Date();
      return d.getMonth() === nd.getMonth() && d.getFullYear() === nd.getFullYear();
    }).reduce((s: number, q: any) => s + (q.total || 0), 0);
    const activeCount = quotes.filter((q: any) => q.estado === 'sent' || q.estado === 'draft').length;
    const avgTicket = quotes.length ? Math.round(quotes.reduce((s: number, q: any) => s + (q.total || 0), 0) / quotes.length) : 0;
    const acceptedOrPaidCount = quotes.filter((q: any) => q.estado === 'accepted' || q.estado === 'paid').length;
    const sentOrBetter = quotes.filter((q: any) => ['sent', 'accepted', 'paid', 'expired'].includes(q.estado)).length;
    const conversionRate = sentOrBetter > 0 ? Math.round((acceptedOrPaidCount / sentOrBetter) * 100) : 0;

    // Persist preferences
    useEffect(() => { try { localStorage.setItem('sacs_q_view', qView); } catch {} }, [qView]);
    // Se pide solo cuando se entra al archivo, y al volver de archivar algo.
    useEffect(() => { cargarArchivadas(); }, []);
    useEffect(() => { if (qView === 'archivadas') cargarArchivadas(); }, [qView]);
    useEffect(() => { try { localStorage.setItem('sacs_q_pagesize', String(qPageSize)); } catch {} }, [qPageSize]);
    useEffect(() => { try { localStorage.setItem('sacs_q_density', qDensity); } catch {} }, [qDensity]);
    useEffect(() => { try { localStorage.setItem('sacs_q_cols', JSON.stringify(Array.from(qVisibleCols))); } catch {} }, [qVisibleCols]);

    // Bulk helpers
    const toggleSelect = (id: string) => {
      const next = new Set(qSelected);
      if (next.has(id)) next.delete(id); else next.add(id);
      setQSelected(next);
    };
    const toggleSelectAll = () => {
      const visible = paginated.map((q: any) => q.id);
      const allSelected = visible.every(id => qSelected.has(id));
      const next = new Set(qSelected);
      if (allSelected) visible.forEach(id => next.delete(id));
      else visible.forEach(id => next.add(id));
      setQSelected(next);
    };
    const clearSelection = () => setQSelected(new Set());

    const bulkMarkPaid = async () => {
      if (qSelected.size === 0) return;
      if (!confirm(`¿Marcar ${qSelected.size} cotización(es) como pagada(s)?`)) return;
      setSaving(true);
      for (const id of Array.from(qSelected)) {
        await fetch('/api/revenue/mark-paid', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId: id }),
        }).catch(() => {});
      }
      const d = await fetch('/api/revenue/quotes').then(r => r.json());
      setQuotes(Array.isArray(d) ? d : []);
      clearSelection();
      setSaving(false);
    };

    const exportCsv = () => {
      const rows = [['#', 'Fecha', 'Empresa', 'Contacto', 'Email', 'WhatsApp', 'Total', 'Moneda', 'Estado', 'Vigencia', 'Vistas']];
      filteredQuotes.forEach((q: any) => {
        const views = filteredViewsMap.get(q.id) || 0;
        rows.push([
          q.numero || '',
          (q.created_at || '').slice(0, 10),
          q.empresa || '',
          q.contacto || '',
          q.email || '',
          q.whatsapp || '',
          String(q.total || 0),
          q.moneda || 'MXN',
          estadoLabels[q.estado] || q.estado || '',
          q.vigencia || '',
          String(views),
        ]);
      });
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cotizaciones-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    };

    const allColumns = [
      { id: 'numero', label: '#' },
      { id: 'created_at', label: 'Fecha' },
      { id: 'empresa', label: 'Empresa' },
      { id: 'origen', label: 'Origen' },
      { id: 'total', label: 'Total' },
      { id: 'abonado', label: 'Abonado' },
      { id: 'vigencia', label: 'Vigencia' },
      { id: 'estado', label: 'Estado' },
      { id: 'views', label: 'Vistas' },
      { id: 'actions', label: 'Acciones' },
    ];

    const rowPad = qDensity === 'compact' ? '6px 12px' : '12px 14px';

    // Ancho fijo por columna: sin esto el navegador reparte a ojo y la tabla
    // baila cada vez que cambia el contenido — es lo que hacía que se vieran
    // cuadradas y descuadradas entre sí.
    const anchoCol: Record<string, number | undefined> = {
      numero: 92, created_at: 96, empresa: undefined, origen: 110,
      total: 114, abonado: 104, vigencia: 114, estado: 112, views: 60, actions: 104,
    };
    const alinCol: Record<string, 'left' | 'right' | 'center'> = { total: 'right', abonado: 'right', views: 'center', actions: 'right' };

    const SortHeader = ({ col, label }: { col: string; label: string }) => (
      <th style={{ ...S.th, cursor: 'pointer', userSelect: 'none' as const, whiteSpace: 'nowrap' as const, position: 'sticky' as const, top: 0, background: '#fafafa', zIndex: 2, width: anchoCol[col], textAlign: (alinCol[col] || 'left') as any }} onClick={() => setQSort({ col, asc: qSort.col === col ? !qSort.asc : col === 'total' || col === 'abonado' || col === 'views' ? false : true })}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          <span style={{ color: qSort.col === col ? '#1a1a1a' : '#ddd', fontSize: '0.75rem' }}>{qSort.col === col ? (qSort.asc ? '↑' : '↓') : '⇅'}</span>
        </span>
      </th>
    );

    const removeFilter = (idx: number) => setQFilters(qFilters.filter((_, i) => i !== idx));
    const addFilter = (f: { field: string; op: string; value: any }) => { setQFilters([...qFilters, f]); setQShowFilterPopover(false); setQPage(0); };
    const allSelected = paginated.length > 0 && paginated.every((q: any) => qSelected.has(q.id));
    const someSelected = paginated.some((q: any) => qSelected.has(q.id));

    return (
      <div>
        {cobrando && <RegistrarPagoModal quote={cobrando} onCerrar={() => setCobrando(null)} onListo={trasCobrar} />}
        {/* ══ Pantalla MÓVIL v5 (mockup Cotizaciones): cabecera + héroe verde
            "Cobrado del mes" + chips + lista Seguimiento. El chrome de
            escritorio (KPIs, tabs, búsqueda, tabla) queda !esMovilQ; los
            modales y el drawer de edición se comparten. ══ */}
        {esMovilQ && (() => {
          const vDe = (q: any) => Number(parseMeta(q.notas).meta.views || 0);
          const abiertas = quotes.filter((q: any) => q.estado === 'draft' || q.estado === 'sent');
          const aceptadas = quotes.filter((q: any) => q.estado === 'accepted' || estadoVisual(q, vDe(q)) === 'parcial');
          const vencidas = quotes.filter((q: any) => q.estado === 'expired' || (q.estado === 'sent' && q.vigencia && daysUntil(q.vigencia) < 0));
          const listaQ = [...(chipQ === 'abiertas' ? abiertas : chipQ === 'aceptadas' ? aceptadas : vencidas)]
            .sort((a: any, b: any) => Number(b.total || 0) - Number(a.total || 0));
          const contexto = (q: any) => {
            const v = vDe(q);
            if (q.estado === 'accepted') return 'espera anticipo';
            if (estadoVisual(q, v) === 'parcial') return `${fmt(Number(q.abonado || 0))} abonado`;
            if (v > 0) return `vista ${v} ${v === 1 ? 'vez' : 'veces'}`;
            const d = Math.floor(daysSince(q.created_at));
            return d <= 0 ? 'enviada hoy' : d === 1 ? 'enviada ayer' : `enviada hace ${d} días`;
          };
          const estadoDer = (q: any) => {
            const v = vDe(q);
            const ev = estadoVisual(q, v);
            if (ev === 'accepted') return { t: 'aceptada', c: '#1E8A63' };
            if (ev === 'parcial') return { t: 'parcial', c: '#1E8A63' };
            if (chipQ === 'vencidas') return { t: 'vencida', c: '#C0554E' };
            if (q.estado === 'sent' && v === 0 && daysSince(q.created_at) > 3) return { t: 'sin respuesta', c: '#a06600' };
            return null;
          };
          return (
            <div className="m-bleed">
              <div className="m-hdr">
                <div className="m-tt">Cotizaciones</div>
                <button className="m-cta" onClick={() => { setQf({ empresa: '', contacto: '', email: '', whatsapp: '', items: [], iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern', condiciones: (condicionesTpl.find((t: any) => t.es_default) || condicionesTpl[0])?.texto || '', ...(() => { const d = bankAccounts.find((b: any) => b.es_default) || bankAccounts[0]; return d ? { bank_account_id: d.id, mostrar_banco: true } : {}; })() }); setShowDrawer(true); }}>＋ Nueva</button>
              </div>
              <div className="m-hero">
                <div className="m-hl">Cobrado del mes</div>
                <div className="m-hv" style={{ color: '#1E8A63' }}>{fmt(Number(kpis?.cobrado?.monto || 0))}</div>
                <div className="m-hd">{kpis?.cobrado?.cotizaciones ?? 0} {(kpis?.cobrado?.cotizaciones ?? 0) === 1 ? 'cotización cobrada' : 'cotizaciones cobradas'}</div>
              </div>
              <div className="m-chips">
                {([['abiertas', 'Abiertas', abiertas.length], ['aceptadas', 'Aceptadas', aceptadas.length], ['vencidas', 'Vencidas', vencidas.length]] as const).map(([v, l, n]) => {
                  const on = chipQ === v;
                  return (
                    <button key={v} className={'m-chip' + (on ? ' on' : '')} onClick={() => setChipQ(v)}>
                      {l}{on ? ' ' + n : ''}
                    </button>
                  );
                })}
              </div>
              {chipQ === 'abiertas' && listaQ.length > 0 && <div className="m-sec">Seguimiento</div>}
              {listaQ.length === 0 && (
                <div style={{ padding: '28px 24px', color: '#8f8d98', fontSize: '0.86rem' }}>
                  {chipQ === 'vencidas' ? 'Nada vencido. Todo al día.' : chipQ === 'aceptadas' ? 'Aún no hay aceptadas este periodo.' : 'Sin cotizaciones abiertas.'}
                </div>
              )}
              {listaQ.map((q: any) => {
                const ed = estadoDer(q);
                return (
                  <div key={q.id} className="m-row" onClick={() => setRapidaQ(q)}>
                    <div className="m-tx">
                      <div className="m-n1">{String(q.empresa || q.contacto || q.numero || '').replace(/\S+/g, (w: string) => w[0].toUpperCase() + (w.length > 2 && w === w.toUpperCase() ? w.slice(1).toLowerCase() : w.slice(1)))}</div>
                      <div className="m-n2">{contexto(q)}</div>
                    </div>
                    <div className="m-fin">
                      <div className="m-m1">{fmt(Number(q.total || 0))}</div>
                      {ed && <div className="m-m2" style={{ color: ed.c }}>{ed.t}</div>}
                    </div>
                  </div>
                );
              })}
              {rapidaQ && (() => {
                const q = rapidaQ;
                const abonado = Number(q.abonado || 0);
                const saldo = Math.max(0, Number(q.total || 0) - abonado);
                const v = vDe(q);
                const dEnv = Math.floor(daysSince(q.created_at));
                const venceEn = q.vigencia ? Math.ceil(daysUntil(q.vigencia)) : null;
                return (
                  <VistaRapida abierta onCerrar={() => setRapidaQ(null)} onVerTodo={() => { const id = q.id; setRapidaQ(null); setVerActividad(id); }}
                    nombre={String(q.empresa || q.contacto || q.numero || '').replace(/\S+/g, (w: string) => w[0].toUpperCase() + (w.length > 2 && w === w.toUpperCase() ? w.slice(1).toLowerCase() : w.slice(1)))}
                    estado={q.numero}
                    contexto={[`enviada ${dEnv <= 0 ? 'hoy' : dEnv === 1 ? 'ayer' : 'hace ' + dEnv + ' días'}`, venceEn != null ? (venceEn < 0 ? 'vencida' : 'vence en ' + venceEn + ' d') : null].filter(Boolean).join(' · ')}
                    heroLabel={saldo > 0 && abonado > 0 ? 'Saldo por cobrar' : saldo > 0 ? 'Total' : 'Cobrada'}
                    heroValor={fmt(saldo > 0 ? saldo : Number(q.total || 0))}
                    heroTono={saldo > 0 && (venceEn != null && venceEn < 0) ? 'rojo' : undefined}
                    heroLectura={v > 0 ? <><b style={{ color: '#1E8A63' }}>la abrió {v === 1 ? '1 vez' : v + ' veces'}</b></> : <span style={{ color: '#a06600' }}>aún no la abre</span>}
                    acciones={[
                      { label: 'Cobrar', primaria: true, onClick: () => { setRapidaQ(null); setCobrando(q); } },
                      { label: 'Ver documento', onClick: () => window.open(`/cotizacion/${q.id}?admin=1`, '_blank', 'noopener') },
                    ]}
                    claves={[
                      abonado > 0
                        ? { k: 'Total', v: fmt(Number(q.total || 0)) }
                        : { k: 'Abonado', v: fmt(0) },
                      { k: 'Estado', v: estadoLabels[estadoVisual(q, v)] || q.estado },
                      { k: 'Vigencia', v: q.vigencia ? new Date(String(q.vigencia).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '').replace(/ de /g, ' ') : '—' },
                    ]}
                    verTodoLabel="Ver cotización completa ›"
                    ficha={esMovilQ ? (
                      <CotizacionActividad quoteId={q.id} embebido onClose={() => setRapidaQ(null)}
                        onCambio={async () => {
                          const d2 = await fetch('/api/revenue/quotes').then(r => r.json()).catch(() => null);
                          if (Array.isArray(d2)) setQuotes(d2);
                        }} />
                    ) : undefined} />
                );
              })()}
              {verActividad && (
                <CotizacionActividad quoteId={verActividad} onClose={() => setVerActividad(null)}
                  onCambio={async () => {
                    const d2 = await fetch('/api/revenue/quotes').then(r => r.json()).catch(() => null);
                    if (Array.isArray(d2)) setQuotes(d2);
                    cargarArchivadas();
                  }} />
              )}
            </div>
          );
        })()}
        {!esMovilQ && (<>
        {/* ─── Top header: title + actions ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.01em' }}>Cotizaciones</h2>
            <div style={{ fontSize: '0.8125rem', color: '#888', marginTop: 2 }}>{quotes.length} totales · {filteredQuotes.length} en vista</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Exportar y Transcripción quedan como ÍCONOS: son herramientas, no
                acciones del día. Con `title` dicen qué hacen al pasar el mouse.
                El ⟳ se fue: la lista ya se recarga sola después de cada acción,
                que es cuando de verdad cambia algo. */}
            <button onClick={exportCsv} title="Exportar a CSV" aria-label="Exportar a CSV"
              style={{ ...S.btn, background: '#fff', color: '#666', border: '1px solid #e0e0e0', width: 38, height: 38, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button onClick={() => { setTranscript(''); setAnalysisResult(null); setShowTranscriptModal(true); }}
              title="Analizar transcripción de una llamada" aria-label="Analizar transcripción"
              style={{ ...S.btn, background: '#fff', color: '#666', border: '1px solid #e0e0e0', width: 38, height: 38, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
            </button>
            {/* Dashboard antes de crear y sin ícono: la fila termina en la
                acción, no en el destino. Con los dos al mismo peso visual el ojo
                dudaba cuál apretar; ahora "Nueva cotización" cierra y manda. */}
            <button onClick={() => setDashCot(true)}
              style={{ ...S.btn, background: '#fff', color: M.azulTinta, border: `1.5px solid ${M.azul}`, borderRadius: 12, padding: '9px 20px', fontWeight: 700 }}>
              Dashboard
            </button>
            <button onClick={() => { setQf({ empresa: '', contacto: '', email: '', whatsapp: '', items: [], iva_incluido: false, descuento_global: 0, descuento_tipo: 'pct', moneda: 'MXN', template: 'modern', condiciones: (condicionesTpl.find((t: any) => t.es_default) || condicionesTpl[0])?.texto || 'Precios en MXN. Migracion incluida. Soporte por chat SACS y WhatsApp. Sin contratos.', ...(() => { const d = bankAccounts.find((b: any) => b.es_default) || bankAccounts[0]; return d ? { bank_account_id: d.id, mostrar_banco: true } : {}; })() }); setShowDrawer(true); }}
              style={{ ...S.btn, background: M.violeta, color: '#fff', padding: '8px 18px', fontWeight: 700 }}>+ Nueva cotización</button>
          </div>
        </div>

        {/* ─── KPI stats row ─── */}
        {/* Mismo diseño de siempre: título, dato grande, línea secundaria. Sin
            gráficas y sin una palabra de más — se leen de un vistazo o no
            sirven. Todo el bloque mira SOLO el mes en curso. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
          {(() => {
            const k = kpis;
            const card = (titulo: string, valor: string, sec: React.ReactNode, color = '#1a1a1a', onClick?: () => void, franja: string = M.violeta) => (
              <div onClick={onClick} style={{ background: '#fff', border: '1px solid #ececec', borderLeft: `3px solid ${franja}`, padding: '14px 16px', borderRadius: 10, cursor: onClick ? 'pointer' : 'default' }}>
                <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{titulo}</div>
                <div style={{ fontSize: '1.375rem', fontWeight: 700, color, marginTop: 4 }}>{valor}</div>
                <div style={{ fontSize: '0.6875rem', color: '#888', marginTop: 2 }}>{sec}</div>
              </div>
            );
            // La variación se pinta sola: verde arriba, rojo abajo. Y cuando no
            // hay mes anterior con qué comparar NO se inventa un "+100%".
            const varTxt = (v: number | null) => (v === null || v === undefined)
              ? <span style={{ color: '#bbb' }}>sin mes anterior</span>
              : <span style={{ color: v > 0 ? M.verdeTinta : v < 0 ? M.azulTinta : '#888', fontWeight: 700 }}>{v > 0 ? '↑' : v < 0 ? '↓' : '='} {Math.abs(v)}%</span>;

            if (!k) return [0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ background: '#fff', border: '1px solid #ececec', borderLeft: `3px solid ${M.violetaAgua}`, padding: '14px 16px', borderRadius: 10 }}>
                <div style={{ height: 9, width: '55%', background: '#f0f0f0', borderRadius: 4 }} />
                <div style={{ height: 20, width: '70%', background: '#f0f0f0', borderRadius: 4, marginTop: 8 }} />
                <div style={{ height: 9, width: '85%', background: '#f6f6f6', borderRadius: 4, marginTop: 8 }} />
              </div>
            ));

            return (
              <>
                {card('Cotizado este mes', fmt(k.cotizado.monto),
                  <>{varTxt(k.cotizado.variacion)} vs. mes anterior · {k.cotizado.cotizaciones} cotizaci{k.cotizado.cotizaciones === 1 ? 'ón' : 'ones'} · <b style={{ color: M.violeta }}>ver</b></>,
                  '#1a1a1a', () => setPanelKpi('cotizado'), M.azul)}
                {/* Cerrado se fecha por el PAGO REGISTRADO, no por la captura:
                    marcar hoy como pagada una cotización cuyo pago fue en julio
                    no la vuelve venta de agosto. */}
                {card('Cerrado este mes', fmt(k.cerrado.monto),
                  <>{fmt(k.cerrado.liquidado)} liquidado{k.cerrado.en_parcialidades > 0 ? ` · ${fmt(k.cerrado.en_parcialidades)} en parcialidades` : ''} · <b style={{ color: M.violeta }}>ver</b></>,
                  M.violetaTinta, () => setPanelKpi('cerrado'), M.violeta)}
                {card('Cobrado este mes', fmt(k.cobrado.monto),
                  <>{k.cobrado.cotizaciones} cotizaci{k.cobrado.cotizaciones === 1 ? 'ón' : 'ones'}{k.cobrado.anticipos > 0 ? ` · ${fmt(k.cobrado.anticipos)} son anticipos` : ''} · <b style={{ color: M.violeta }}>ver</b></>,
                  M.verdeTinta, () => setPanelKpi('cobrado'), M.verde)}
                {/* Solo lo exigible DENTRO del mes: lo que toca en noviembre no
                    se cobra hoy y no tiene por qué inflar el número de hoy. */}
                {card('Por cobrar este mes', fmt(k.por_cobrar.monto),
                  (k.por_cobrar.n || 0) === 0
                    ? <>Sin exhibiciones con fecha en el mes{k.por_cobrar.sin_fechas ? <> · {k.por_cobrar.sin_fechas} ganada{k.por_cobrar.sin_fechas === 1 ? '' : 's'} sin fechas acordadas</> : ''} · <b style={{ color: M.violeta }}>ver</b></>
                    : <>{k.por_cobrar.n} exhibici{k.por_cobrar.n === 1 ? 'ón' : 'ones'}{k.por_cobrar.vencido > 0 ? <span style={{ color: M.rojoTinta, fontWeight: 800 }}> · {fmt(k.por_cobrar.vencido)} pasado de fecha</span> : ''} · <b style={{ color: M.violeta }}>ver</b></>,
                  (k.por_cobrar.vencido || 0) > 0 ? M.rojoTinta : '#1a1a1a',
                  () => setPanelKpi('por_cobrar'), M.rojo)}
                {/* La única tarjeta de conversión, medida sobre las cotizaciones
                    del propio mes: comparar contra otro mes mezclaría dos
                    poblaciones distintas. */}
                {card('Cierre del mes', k.cierre.pct === null ? '—' : k.cierre.pct + '%',
                  k.cierre.pct === null
                    ? 'Todavía no se cotiza nada este mes'
                    : <>{k.cierre.cerradas} de {k.cierre.generadas} cotizadas · {k.cierre.pagadas} ya pagada{k.cierre.pagadas === 1 ? '' : 's'} ({k.cierre.pct_pagadas}%) · <b style={{ color: M.violeta }}>ver</b></>,
                  (k.cierre.pct || 0) >= 50 ? M.verdeTinta : '#1a1a1a', () => setPanelKpi('cierre'), M.azul)}
              </>
            );
          })()}
        </div>

        {/* El desglose de la tarjeta que se abrió. Vive aquí y no en cada
            tarjeta para que las cinco compartan el mismo formato. */}
        {panelKpi && kpis && (() => {
          const P: any = {
            cotizado: { t: 'Cotizado este mes', d: kpis.cotizado.detalle, nota: 'Todo lo generado en el mes, se haya cerrado o no.' },
            cerrado: { t: 'Cerrado este mes', d: kpis.cerrado.detalle, agrupado: true, nota: 'Aceptadas o pagadas, fechadas por el pago registrado. Se separan las liquidadas de las que van en parcialidades: la venta ya se cerró en las dos, pero solo una sigue teniendo cobranza detrás.' },
            cobrado: { t: 'Cobrado este mes', d: kpis.cobrado.detalle, nota: 'Dinero que entró este mes, anticipos incluidos.' },
            por_cobrar: {
              t: 'Por cobrar este mes',
              d: [...kpis.por_cobrar.detalle, ...(kpis.por_cobrar.detalle_sin_fechas || []).map((x: any) => ({ ...x, sin_fecha: true }))],
              nota: 'Solo las exhibiciones con fecha acordada que caen hasta fin de mes, incluidas las que ya pasaron de su fecha. Lo ganado sin plan de pagos no está vencido —la vigencia caduca el precio, no un pago— y va aparte, al final.',
            },
            cierre: { t: 'Cierre del mes', d: kpis.cierre.detalle, agrupado: true, nota: 'Las cotizaciones generadas este mes, agrupadas por dónde quedaron: pagadas, cerradas sin liquidar y abiertas.' },
          }[panelKpi];
          if (!P) return null;
          const money = (n: any) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
          const fecha = (f: string) => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '') : '—';
          return (
            <div onClick={e => { if (e.target === e.currentTarget) setPanelKpi(''); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 970, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 620, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column' as const }}>
                <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>{P.t}</h3>
                  <span style={{ fontSize: '0.72rem', color: '#7a6fc9' }}>{P.d.length} {P.d.length === 1 ? 'renglón' : 'renglones'}</span>
                  <button onClick={() => setPanelKpi('')} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </div>
                <div style={{ padding: '13px 17px', overflowY: 'auto' as const }}>
                  <div style={{ fontSize: '0.76rem', color: '#6b6b74', lineHeight: 1.55, marginBottom: 11 }}>{P.nota}</div>
                  {P.d.length === 0 && <div style={{ fontSize: '0.8rem', color: '#a5a2af' }}>Nada aquí todavía.</div>}
                  {P.d.map((x: any, i: number) => (
                    <div key={'g' + i} style={{ display: 'contents' }}>
                    {P.agrupado && x.grupo && x.grupo !== P.d[i - 1]?.grupo && (
                      <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase' as const, letterSpacing: '.07em', margin: i ? '14px 0 2px' : '0 0 2px' }}>{x.grupo}</div>
                    )}
                    <div style={{ padding: '9px 0', borderTop: i ? '1px solid #f4f3f7' : 'none' }}>
                      <div style={{ display: 'flex', gap: 9, alignItems: 'baseline', flexWrap: 'wrap' as const }}>
                        <a href={x.numero && x.numero !== '—' ? `/cotizacion/${x.id}` : undefined} target="_blank" rel="noreferrer"
                          style={{ fontSize: '0.83rem', fontWeight: 700, color: '#1a1a1a', textDecoration: 'none' }}>
                          {x.numero || '—'}
                        </a>
                        <span style={{ fontSize: '0.8rem', color: '#4c4a57', flex: 1, minWidth: 120 }}>{x.empresa}</span>
                        {x.fecha && <span style={{ fontSize: '0.73rem', color: x.vencido ? '#C0554E' : '#8a8a92' }}>{fecha(x.fecha)}</span>}
                        <b style={{ fontSize: '0.85rem' }}>{money(x.monto ?? x.total ?? x.saldo)}</b>
                      </div>
                      {x.sin_fecha && (
                        <div style={{ fontSize: '0.72rem', color: '#9a6a10', marginTop: 2 }}>
                          Ganada, con saldo y sin fechas acordadas · no se cuenta como exigible
                        </div>
                      )}
                      {(x.abonado > 0 || x.exhibicion || x.anticipo || x.metodo) && (
                        <div style={{ fontSize: '0.72rem', color: '#8a8590', marginTop: 2 }}>
                          {x.exhibicion ? `exhibición ${x.exhibicion} · ` : ''}
                          {x.anticipo ? 'anticipo · ' : ''}
                          {x.metodo ? x.metodo + ' · ' : ''}
                          {x.abonado > 0 ? `abonó ${money(x.abonado)} de ${money(x.total)}` : ''}
                        </div>
                      )}
                      {Array.isArray(x.exhibiciones) && x.exhibiciones.length > 0 && (
                        <div style={{ marginTop: 5, paddingLeft: 10, borderLeft: '2px solid #ece7fa' }}>
                          {x.exhibiciones.map((e: any) => (
                            <div key={e.numero} style={{ display: 'flex', gap: 8, fontSize: '0.73rem', color: '#5B4BD6', padding: '2px 0' }}>
                              <span style={{ width: 74 }}>{e.numero} de {e.total}</span>
                              <span style={{ width: 70 }}>{fecha(e.fecha)}</span>
                              <b>{money(e.monto)}</b>
                              <span style={{ marginLeft: 'auto', color: e.estado === 'pagada' ? '#1E8A63' : '#a5a2af' }}>{e.estado}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {Array.isArray(x.exhibiciones) && x.exhibiciones.length === 0 && (
                        <div style={{ fontSize: '0.72rem', color: '#9a6a10', marginTop: 3 }}>
                          Sin fechas acordadas · se pueden fijar con “Partir en pagos”, en Cobranza.
                        </div>
                      )}
                    </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ─── Saved views tabs ─── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid #e5e5e5', marginBottom: 12, overflowX: 'auto' as const }}>
          {savedViews.map(v => {
            const active = qView === v.id;
            const n = viewCounts[v.id] || 0;
            return (
              <button key={v.id} onClick={() => { setQView(v.id); setQPage(0); clearSelection(); }} style={{
                padding: '10px 16px',
                // La activa se marca con fondo, no solo con la línea: sobre una
                // barra de nueve pestañas el subrayado solo se ve si ya sabes
                // dónde buscarlo.
                background: active ? M.violetaAgua : 'transparent',
                borderRadius: active ? '9px 9px 0 0' : 0,
                border: 'none',
                borderBottom: active ? `2px solid ${M.violeta}` : '2px solid transparent',
                color: active ? M.violetaTinta : '#666',
                fontWeight: active ? 800 : 500,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap' as const,
                marginBottom: -1,
              }}>
                {v.label}
                {/* El contador en pastilla: pegado al texto, "Todas 27" se lee
                    como una sola palabra. En cero va más tenue — una pestaña
                    vacía no debe invitar al clic. */}
                <span style={{
                  marginLeft: 6, fontSize: '0.66rem', fontWeight: active ? 800 : 700,
                  background: active ? '#fff' : '#f3f3f6',
                  color: active ? M.violetaTinta : n === 0 ? '#c4c4cc' : '#8a8a92',
                  borderRadius: 20, padding: '2px 8px',
                }}>{quotesCargando ? '·' : n}</span>
              </button>
            );
          })}
        </div>

        {/* ─── Search + filter + column tools ─── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const, alignItems: 'center', position: 'relative' as const }}>
          <div style={{ position: 'relative' as const, flex: '1 1 280px', maxWidth: 440 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" style={{ position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={qSearch} onChange={e => { setQSearch(e.target.value); setQPage(0); }} placeholder="Buscar por empresa, contacto, email, WhatsApp, folio o monto..." style={{ ...S.input, paddingLeft: 36, height: 36, fontSize: '0.8125rem' }} />
            {qSearch && (
              <button onClick={() => { setQSearch(''); setQPage(0); }} style={{ position: 'absolute' as const, right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem', padding: 4 }}>✕</button>
            )}
          </div>

          {/* Advanced filter button */}
          <div style={{ position: 'relative' as const }}>
            <button onClick={() => setQShowFilterPopover(!qShowFilterPopover)} style={{ ...S.btnSmall, padding: '0 14px', height: 36, display: 'inline-flex', alignItems: 'center', gap: 6, background: qFilters.length > 0 ? '#e8f0fe' : '#fff', color: qFilters.length > 0 ? '#1a56db' : '#555', borderColor: qFilters.length > 0 ? '#93c5fd' : '#e0e0e0' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Filtros {qFilters.length > 0 && <span style={{ background: '#1a56db', color: '#fff', fontSize: '0.625rem', borderRadius: 10, padding: '1px 6px' }}>{qFilters.length}</span>}
            </button>
            {qShowFilterPopover && (
              <div style={{ position: 'absolute' as const, top: 42, left: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: 16, minWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 100 }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Agregar filtro</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={() => addFilter({ field: 'total', op: 'gt', value: 10000 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Total &gt; $10,000</button>
                  <button onClick={() => addFilter({ field: 'total', op: 'lt', value: 10000 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Total &lt; $10,000</button>
                  <button onClick={() => addFilter({ field: 'created_at', op: 'within', value: 7 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Creada en últimos 7 días</button>
                  <button onClick={() => addFilter({ field: 'created_at', op: 'within', value: 30 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Creada en últimos 30 días</button>
                  <button onClick={() => addFilter({ field: 'created_at', op: 'older', value: 30 })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Creada hace más de 30 días</button>
                  <button onClick={() => addFilter({ field: 'estado', op: 'in', value: ['sent', 'accepted'] })} style={{ ...S.btnSmall, justifyContent: 'flex-start', padding: '8px 10px', width: '100%' }}>Enviadas + Aceptadas</button>
                </div>
                <button onClick={() => setQShowFilterPopover(false)} style={{ ...S.btnSmall, width: '100%', marginTop: 10, background: '#f5f5f5' }}>Cerrar</button>
              </div>
            )}
          </div>

          {/* Los chips de estado vivían aquí y duplicaban las pestañas de
              arriba (Pagadas y Rechazadas salían dos veces). Se quitaron: las
              vistas mandan, y este renglón queda para buscar y filtrar. */}
        </div>

        {/* ─── Bulk selection bar (appears when 1+ selected) ─── */}
        {qSelected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#1a1a1a', color: '#fff', borderRadius: 8, marginBottom: 12 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{qSelected.size} cotización(es) seleccionada(s)</span>
            <div style={{ flex: 1 }}></div>
            <button onClick={bulkMarkPaid} style={{ ...S.btnSmall, background: M.verdeAgua, color: M.verdeTinta, borderColor: 'transparent' }}>Marcar como pagadas</button>
            {qView === 'archivadas' ? (
              <button onClick={async () => {
                if (!confirm(`¿Restaurar ${qSelected.size} cotización(es)? Vuelven al estado que tenían antes de archivarse.`)) return;
                await fetch('/api/revenue/quotes/eliminar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: Array.from(qSelected), restaurar: true }) });
                clearSelection(); cargarArchivadas();
                const d = await fetch('/api/revenue/quotes').then(r => r.json()).catch(() => null);
                if (Array.isArray(d)) setQuotes(d);
              }} style={{ ...S.btnSmall, background: '#fff', color: '#1a1a1a', borderColor: 'transparent' }}>↩️ Restaurar</button>
            ) : (
              /* Varias hacia la MISMA cotización nueva: el caso de dos que se
                 fusionan en una tercera. Se archivan juntas y la nueva queda
                 apuntada por las dos. */
              <button onClick={() => setAEliminar(filteredQuotes.filter((q: any) => qSelected.has(q.id)))}
                style={{ ...S.btnSmall, background: '#fdeaea', color: '#b93333', borderColor: 'transparent', fontWeight: 700 }}>
                🗑 Eliminar ({qSelected.size})
              </button>
            )}
            <button onClick={exportCsv} style={{ ...S.btnSmall, background: '#fff', color: '#1a1a1a', borderColor: 'transparent' }}>Exportar selección</button>
            <button onClick={clearSelection} style={{ ...S.btnSmall, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>Deseleccionar</button>
          </div>
        )}

        {/* ─── Table ─── */}
        <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' as const }}>
            {/* `fixed` hace que los anchos de arriba se respeten y que la
                columna sin ancho (Empresa) absorba lo que sobre: al 80% ya no
                queda hueco a la derecha y al 100% no se desborda cortando
                Acciones. `minWidth` es el piso antes de permitir scroll. */}
            <table style={{ ...S.table, tableLayout: 'fixed' as const, minWidth: 1040 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width: 36, padding: '8px 0 8px 16px', position: 'sticky' as const, top: 0, background: '#fafafa', zIndex: 2 }}>
                    <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }} onChange={toggleSelectAll} />
                  </th>
                  {qVisibleCols.has('numero') && <SortHeader col="numero" label="#" />}
                  {qVisibleCols.has('created_at') && <SortHeader col="created_at" label="Fecha" />}
                  {qVisibleCols.has('empresa') && <SortHeader col="empresa" label="Empresa" />}
                  {qVisibleCols.has('origen') && <th style={{ ...S.th, width: anchoCol.origen, position: 'sticky' as const, top: 0, background: '#fafafa', zIndex: 2, whiteSpace: 'nowrap' as const }}>Origen</th>}
                  {qVisibleCols.has('total') && <SortHeader col="total" label="Total" />}
                  {qVisibleCols.has('abonado') && <SortHeader col="abonado" label="Abonado" />}
                  {qVisibleCols.has('vigencia') && <SortHeader col="vigencia" label="Vigencia" />}
                  {qVisibleCols.has('estado') && <SortHeader col="estado" label="Estado" />}
                  {qVisibleCols.has('views') && <SortHeader col="views" label="Vistas" />}
                  {qVisibleCols.has('actions') && <th style={{ ...S.th, width: anchoCol.actions, position: 'sticky' as const, top: 0, background: '#fafafa', zIndex: 2, textAlign: 'right' as const }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr><td colSpan={Array.from(qVisibleCols).length + 1} style={{ ...S.td, textAlign: 'center' as const, color: '#aaa', padding: quotesCargando ? 12 : 48 }}>
                    {quotesCargando ? <Cargando texto="Cargando cotizaciones…" alto={200} /> : (<>
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>∅</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#666' }}>Sin resultados</div>
                      <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: 4 }}>Prueba limpiar los filtros o ajustar la búsqueda.</div>
                    </>)}
                  </td></tr>
                )}
                {paginated.map((q: any) => {
                  const views = filteredViewsMap.get(q.id) || 0;
                  const estVis = estadoVisual(q, views);
                  const ec = estadoColors[estVis] || estadoColors.draft;
                  const isSel = qSelected.has(q.id);
                  const days = q.vigencia ? Math.ceil(daysUntil(q.vigencia)) : null;
                  const qMeta = parseMeta(q.notas).meta;
                  return (
                    <tr key={q.id} style={{ background: isSel ? '#f0f7ff' : 'transparent', transition: 'background 0.12s' }} onMouseEnter={e => { if (!isSel) (e.currentTarget.style.background = '#f8f9fb'); }} onMouseLeave={e => { if (!isSel) (e.currentTarget.style.background = 'transparent'); }}>
                      <td style={{ padding: `${rowPad.split(' ')[0]} 0 ${rowPad.split(' ')[0]} 16px`, borderBottom: '1px solid #f0f0f0' }}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleSelect(q.id)} />
                      </td>
                      {qVisibleCols.has('numero') && <td style={{ ...S.td, padding: rowPad, fontWeight: 700, color: '#1a1a1a' }}>{q.numero || '-'}</td>}
                      {qVisibleCols.has('created_at') && <td style={{ ...S.td, padding: rowPad, color: '#666', whiteSpace: 'nowrap' as const }}>{fmtDate(q.created_at)}</td>}
                      {qVisibleCols.has('empresa') && <td style={{ ...S.td, padding: rowPad }}>
                        {/* Una línea por dato y recortado con "…": el correo
                            largo partía el renglón y descuadraba toda la fila. */}
                        <div style={{ fontWeight: 600, color: '#1a1a1a', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{q.empresa || '—'}</div>
                        {(q.contacto || q.email) && <div title={`${q.contacto || ''}${q.contacto && q.email ? ' · ' : ''}${q.email || ''}`} style={{ fontSize: '0.6875rem', color: '#999', marginTop: 1, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{q.contacto}{q.contacto && q.email ? ' · ' : ''}{q.email}</div>}
                      </td>}
                      {qVisibleCols.has('origen') && <td style={{ ...S.td, padding: rowPad, whiteSpace: 'nowrap' as const, overflow: 'hidden' }}>
                        {q.partner_id ? (
                          <span title={`Partner: ${partnersById[q.partner_id]?.nombre || 'Partner'}`}
                            style={{ display: 'inline-block', maxWidth: '100%', padding: '3px 8px', borderRadius: 999, background: '#EEF2FB', color: '#3764C4', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, verticalAlign: 'middle' }}>
                            P: {partnersById[q.partner_id]?.nombre || 'Partner'}
                          </span>
                        ) : (
                          <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: 999, background: '#f0f0f0', color: '#666', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.02em' }}>SACS</span>
                        )}
                      </td>}
                      {qVisibleCols.has('total') && <td style={{ ...S.td, padding: rowPad, fontWeight: 700, color: '#1a1a1a', whiteSpace: 'nowrap' as const, textAlign: 'right' as const }}>{fmt(q.total || 0)} <span style={{ fontSize: '0.625rem', color: '#aaa', fontWeight: 500 }}>{q.moneda || 'MXN'}</span></td>}
                      {/* Lo abonado en verde SIEMPRE, sin importar el estado de
                          la cotización: es un monto que ya se pagó. Una vencida
                          con anticipo lleva pastilla roja y cifra verde — los
                          dos hechos son ciertos y ahora se ven juntos. */}
                      {qVisibleCols.has('abonado') && <td style={{ ...S.td, padding: rowPad, whiteSpace: 'nowrap' as const, textAlign: 'right' as const, fontWeight: Number(q.abonado || 0) >= Number(q.total || 0) - 0.01 && Number(q.abonado || 0) > 0 ? 800 : 700, color: Number(q.abonado || 0) > 0 ? M.verdeTinta : '#c9c7d0' }}>{Number(q.abonado || 0) > 0 ? fmt(q.abonado) : '—'}</td>}
                      {qVisibleCols.has('vigencia') && (() => {
                        // La vigencia caduca el PRECIO de una propuesta. Una
                        // cotización que el cliente ya aceptó —o que ya lleva
                        // abonos— no está vencida por más que esa fecha pase:
                        // lo que sigue viva es su cobranza. En ese caso la
                        // columna muestra la próxima parcialidad, y solo se
                        // pinta de rojo si ESA fecha ya pasó.
                        const cerrada = q.estado === 'accepted' || q.estado === 'paid' || (abonadoPorQuote.get(q.id) || 0) > 0;
                        const prox = cerrada ? proximaParcialidad(q) : null;
                        if (cerrada) {
                          const atrasada = !!prox && prox.fecha < hoyISO;
                          return (
                            <td style={{ ...S.td, padding: rowPad, whiteSpace: 'nowrap' as const, color: atrasada ? M.rojoTinta : '#8a8a8a', fontWeight: atrasada ? 700 : 400 }}>
                              {prox
                                ? <span title={`Parcialidad ${prox.numero} de ${prox.total}`}>{fmtDate(prox.fecha)}</span>
                                : <span title="Aceptada: la vigencia del precio ya no aplica" style={{ color: '#c4c4cc' }}>—</span>}
                            </td>
                          );
                        }
                        return (
                          <td style={{ ...S.td, padding: rowPad, whiteSpace: 'nowrap' as const, color: days !== null && days < 0 ? M.rojoTinta : '#8a8a8a', fontWeight: days !== null && days < 0 ? 700 : 400 }}>
                            {q.vigencia ? (days === 0 ? 'Hoy' : `${Math.abs(days as number)} ${Math.abs(days as number) === 1 ? 'día' : 'días'}`) : '—'}
                          </td>
                        );
                      })()}
                      {qVisibleCols.has('estado') && <td style={{ ...S.td, padding: rowPad }}>
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, alignItems: 'flex-start' }}>
                          {/* La columna de ESTADO muestra el estado y nada más.
                              Todo lo demás —a quién reemplaza, por qué se
                              archivó— vive en el panel de actividad: meterlo
                              aquí rompía la lectura de la tabla, que es para
                              barrer 35 cotizaciones de un vistazo. */}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: ec.bg, color: ec.fg }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ec.dot }}></span>
                            {estadoLabels[estVis] || estVis}
                          </span>

                        </div>
                      </td>}
                      {qVisibleCols.has('views') && <td style={{ ...S.td, padding: rowPad, textAlign: 'center' as const, whiteSpace: 'nowrap' as const }}>
                        {(() => {
                          const mv = parseMeta(q.notas).meta;
                          return views > 0 ? (
                            /* Solo el ojo y el número: el "hace 2 min" no cabía
                               y partía la celda en tres renglones. El detalle
                               completo sigue en el hover y en el panel. */
                            <span onClick={(e) => { e.stopPropagation(); setVerActividad(q.id); }}
                              title={detalleVistas(mv) + '\n\nClic para ver toda la actividad'}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 700, color: views >= 5 ? '#6C5CE7' : '#666', cursor: 'pointer' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg>
                              {views}
                            </span>
                          ) : <span title="Nadie la ha abierto todavía." style={{ color: '#ddd', fontSize: '0.75rem', cursor: 'help' }}>—</span>;
                        })()}
                      </td>}
                      {qVisibleCols.has('actions') && <td style={{ ...S.td, padding: `${rowPad.split(' ')[0]} 12px ${rowPad.split(' ')[0]} 2px`, textAlign: 'right' as const, whiteSpace: 'nowrap' as const, position: 'relative' as const }}>
                        <a href={`/cotizacion/${q.id}?admin=1`} target="_blank" rel="noopener" style={{ ...S.btnSmall, textDecoration: 'none', display: 'inline-flex', marginRight: 4, padding: '4px 9px' }}>Ver</a>

                        <button onClick={(e) => {
                          e.stopPropagation();
                          if (qMenuRow === q.id) { setQMenuRow(null); return; }
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          // Si no cabe hacia abajo, se abre hacia arriba: con la
                          // última fila de la lista el menú quedaba fuera de la
                          // pantalla y no se alcanzaba a leer.
                          const alto = 330;
                          const arriba = r.bottom + alto > window.innerHeight && r.top > alto;
                          setQMenuPos({ x: Math.max(8, window.innerWidth - r.right), y: arriba ? window.innerHeight - r.top + 6 : r.bottom + 6, arriba });
                          setQMenuRow(q.id);
                        }} style={{ ...S.btnSmall, background: '#fff', padding: '4px 8px', marginRight: 0 }} title="Más acciones">⋮</button>
                        {qMenuRow === q.id && (
                          <div data-q-menu style={{
                            position: 'fixed' as const, right: qMenuPos.x,
                            ...(qMenuPos.arriba ? { bottom: qMenuPos.y } : { top: qMenuPos.y }),
                            maxHeight: '70vh', overflowY: 'auto' as const,
                            background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 6, minWidth: 220,
                            boxShadow: '0 12px 40px rgba(16,24,40,0.16)', zIndex: 1000, textAlign: 'left' as const,
                          }}>
                            <button onClick={() => { setVerActividad(q.id); setQMenuRow(null); }}
                              style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 3, justifyContent: 'flex-start', border: `1px solid ${M.violetaAgua}`, background: M.violetaAgua, padding: '9px 10px', display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start', fontWeight: 800, color: M.violetaHondo }}>
                              Ver actividad y pagos
                              <span style={{ fontSize: '0.63rem', fontWeight: 400, color: '#7a6fc9', marginTop: 1 }}>estado, abonos y vistas</span>
                            </button>
                            {/* ── Lo que toca según el estado ──
                                Un solo renglón, siempre en el mismo lugar: cobrar
                                si está viva, el acuse si ya se pagó, extender si
                                venció. Sin esto había que adivinar dónde estaba
                                cada cosa según en qué estado cayó la cotización. */}
                            {(() => {
                              const est = estadoVisual(q, filteredViewsMap.get(q.id) || 0);
                              if (est === 'paid') return (
                                <button onClick={async () => {
                                  setQMenuRow(null);
                                  // El acuse vive en el pago, no en la cotización: hay
                                  // que resolverlo antes de poder abrirlo.
                                  const j = await fetch(`/api/revenue/quotes/actividad?id=${q.id}`).then(r => r.json()).catch(() => null);
                                  const pago = (j?.pagos || [])[0];
                                  if (pago?.id) window.open(`/acuse/${pago.id}?admin`, '_blank');
                                  else alert('Esta cotización está marcada como pagada pero no tiene un pago registrado, así que no hay acuse que abrir.');
                                }}
                                  style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 4, justifyContent: 'flex-start', border: '1px solid #cdeadd', background: M.verdeAgua, padding: '8px 10px', display: 'flex', fontWeight: 800, color: M.verdeTinta }}>
                                  Ver acuse de pago
                                </button>
                              );
                              if (est === 'expired') return (
                                <button onClick={() => { setExtendForm({ id: q.id, numero: q.numero, vigencia: q.vigencia, days: 2 }); setQMenuRow(null); }}
                                  style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 4, justifyContent: 'flex-start', border: '1px solid #f7c9c5', background: M.rojoAgua, padding: '8px 10px', display: 'flex', fontWeight: 800, color: M.rojoTinta }}>
                                  Extender vigencia
                                </button>
                              );
                              if (est === 'rejected' || est === 'deleted') return null;
                              return (
                                <button onClick={() => { setCobrando(q); setQMenuRow(null); }}
                                  style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 4, justifyContent: 'flex-start', border: '1px solid #cdeadd', background: M.verdeAgua, padding: '8px 10px', display: 'flex', fontWeight: 800, color: M.verdeTinta }}>
                                  Registrar pago
                                </button>
                              );
                            })()}
                            <button onClick={() => { const { meta: m } = parseMeta(q.notas); setQf({ ...q, items: Array.isArray(q.items) ? q.items : [], logo_url: m.logo_url || '', iva_mode: m.iva_mode || (q.iva_incluido ? 'suma' : 'sin'), mostrar_timer: m.mostrar_timer !== undefined ? m.mostrar_timer : true, mostrar_features: m.mostrar_features !== undefined ? m.mostrar_features : true, mostrar_desglose: m.mostrar_desglose !== undefined ? m.mostrar_desglose : true, mostrar_condiciones: m.mostrar_condiciones !== undefined ? m.mostrar_condiciones : true, mostrar_key_points: m.mostrar_key_points !== undefined ? m.mostrar_key_points : true, key_points: m.key_points || [], roi: m.roi || null, antes_despues: m.antes_despues || [], mostrar_roi: m.mostrar_roi || false, mostrar_antes_despues: m.mostrar_antes_despues || false, mostrar_firma: m.mostrar_firma !== undefined ? m.mostrar_firma : true, mostrar_qr: m.mostrar_qr !== undefined ? m.mostrar_qr : true, mostrar_animaciones: m.mostrar_animaciones !== undefined ? m.mostrar_animaciones : true, mostrar_timeline: m.mostrar_timeline !== undefined ? m.mostrar_timeline : true, timeline_tipo: m.timeline_tipo || '1suc', mostrar_implementacion: m.mostrar_implementacion !== undefined ? m.mostrar_implementacion : true, implementacion_nota: m.implementacion_nota || '', mostrar_porque_sacs: m.mostrar_porque_sacs !== undefined ? m.mostrar_porque_sacs : true, promo_label: m.promo_label || '', minuta_raw: m.minuta_raw || '', plan_pagos: m.plan_pagos || [], paquetes: Array.isArray(m.paquetes) ? m.paquetes : [] }); setShowDrawer(true); setMinutaError(null); setQMenuRow(null); }}
                              style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', textDecoration: 'none', color: '#1a1a1a' }}>Editar</button>
                            <button onClick={() => { duplicateQuote(q); setQMenuRow(null); }} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', textDecoration: 'none', color: '#1a1a1a' }}>Duplicar</button>
                            <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.09em', padding: '9px 10px 3px' }}>Enviar al cliente</div>
                            <a href={`https://wa.me/?text=${encodeURIComponent(`Cotización ${q.numero}: https://www.sacscloud.com/cotizacion/${q.id}`)}`} target="_blank" rel="noopener" onClick={() => setQMenuRow(null)} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', textDecoration: 'none', color: '#1a1a1a' }}>WhatsApp</a>
                            <a href={`mailto:${q.email || ''}?subject=${encodeURIComponent(`Cotización ${q.numero} - Sacs`)}&body=${encodeURIComponent(`Hola ${q.contacto || ''},\n\nTe comparto tu cotización:\nhttps://www.sacscloud.com/cotizacion/${q.id}\n\nQuedo al pendiente.\nSaludos`)}`} onClick={() => setQMenuRow(null)} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', textDecoration: 'none', color: '#1a1a1a' }}>Correo</a>
                            <button onClick={() => { navigator.clipboard.writeText(`https://www.sacscloud.com/cotizacion/${q.id}`); setQMenuRow(null); }} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', textDecoration: 'none', color: '#1a1a1a' }}>Copiar liga de la cotización</button>
                            <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.09em', padding: '9px 10px 3px' }}>Después de la venta</div>
                            <button onClick={() => { navigator.clipboard.writeText(`https://www.sacscloud.com/cotizacion/${q.id}/implementacion`); setQMenuRow(null); }} style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start', textDecoration: 'none', color: '#1a1a1a' }}>
                              Copiar liga del proceso
                              <span style={{ fontSize: '0.63rem', color: '#a5a2af' }}>seguimiento de implementación</span>
                            </button>
                            <div style={{ height: 1, background: '#f0f0f0', margin: '6px 4px' }}></div>
                            <button onClick={() => { setAEliminar([q]); setQMenuRow(null); }}
                              style={{ ...S.btnSmall, width: '100%', marginRight: 0, marginBottom: 1, justifyContent: 'flex-start', border: 'none', background: 'transparent', padding: '7px 10px', display: 'flex', textDecoration: 'none', color: M.rojoTinta }}>Eliminar cotización</button>
                          </div>
                        )}
                      </td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {verActividad && (
            <CotizacionActividad quoteId={verActividad} onClose={() => setVerActividad(null)}
              onCambio={async () => {
                const d2 = await fetch('/api/revenue/quotes').then(r => r.json()).catch(() => null);
                if (Array.isArray(d2)) setQuotes(d2);
                cargarArchivadas();
              }} />
          )}
          {aEliminar.length > 0 && (
            <EliminarCotizacionModal
              seleccion={aEliminar}
              quotes={quotes}
              onClose={() => setAEliminar([])}
              onDone={async (msg: string) => {
                setAEliminar([]); clearSelection();
                const d = await fetch('/api/revenue/quotes').then(r => r.json()).catch(() => null);
                if (Array.isArray(d)) setQuotes(d);
                alert(msg);
              }}
            />
          )}

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.75rem', color: '#666' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Por página:
                <select value={qPageSize} onChange={e => { setQPageSize(parseInt(e.target.value)); setQPage(0); }} style={{ padding: '4px 8px', fontSize: '0.75rem', border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
              <span>
                {filteredQuotes.length === 0 ? '0' : `${safePage * PER_PAGE + 1}–${Math.min((safePage + 1) * PER_PAGE, filteredQuotes.length)}`} de <strong>{filteredQuotes.length}</strong>
              </span>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button disabled={safePage === 0} onClick={() => setQPage(0)} style={{ ...S.btnSmall, opacity: safePage === 0 ? 0.3 : 1, marginRight: 0 }}>«</button>
                <button disabled={safePage === 0} onClick={() => setQPage(safePage - 1)} style={{ ...S.btnSmall, opacity: safePage === 0 ? 0.3 : 1, marginRight: 0 }}>‹ Anterior</button>
                <span style={{ fontSize: '0.75rem', color: '#666', padding: '0 10px' }}>Página <strong>{safePage + 1}</strong> de {totalPages}</span>
                <button disabled={safePage >= totalPages - 1} onClick={() => setQPage(safePage + 1)} style={{ ...S.btnSmall, opacity: safePage >= totalPages - 1 ? 0.3 : 1, marginRight: 0 }}>Siguiente ›</button>
                <button disabled={safePage >= totalPages - 1} onClick={() => setQPage(totalPages - 1)} style={{ ...S.btnSmall, opacity: safePage >= totalPages - 1 ? 0.3 : 1, marginRight: 0 }}>»</button>
              </div>
            )}
          </div>
        </div>
        </>)}

        {/* ─── Accept Quote Modal (admin manual acceptance) ─── */}
        {acceptForm && (
          <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget && !acceptSaving) setAcceptForm(null); }}>
            <div style={{ ...S.modal, maxWidth: 480 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Aceptar cotización {acceptForm.numero}</h3>
                <button onClick={() => !acceptSaving && setAcceptForm(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#888', margin: '0 0 16px', lineHeight: 1.5 }}>
                El cliente cerró pero no firmó en la página. Se marcará como aceptada y se generará la firma automáticamente con el nombre que ingreses.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Nombre que firma</label>
                <input
                  type="text"
                  value={acceptForm.nombre}
                  onChange={e => setAcceptForm({ ...acceptForm, nombre: e.target.value })}
                  placeholder="Ej. Mariana López"
                  style={S.input}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Método de aceptación</label>
                <select value={acceptForm.method} onChange={e => setAcceptForm({ ...acceptForm, method: e.target.value })} style={S.input}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="verbal">Verbal / Llamada</option>
                  <option value="email">Email</option>
                  <option value="reunion">Reunión presencial</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Nota interna (opcional)</label>
                <textarea
                  value={acceptForm.nota}
                  onChange={e => setAcceptForm({ ...acceptForm, nota: e.target.value })}
                  placeholder="Ej. Confirmó por WhatsApp el 15/abr a las 3pm"
                  style={{ ...S.input, height: 70, resize: 'vertical' as const, fontSize: '0.75rem' }}
                />
                <div style={{ fontSize: '0.625rem', color: '#bbb', marginTop: 4 }}>Solo tú la ves. No se muestra al cliente.</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Vista previa de firma</label>
                <div style={{ border: '1px dashed #e0e0e0', borderRadius: 8, padding: '12px 16px', background: '#fafafa', minHeight: 72, display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'Dancing Script','Brush Script MT','Lucida Handwriting','Segoe Script','Apple Chancery',cursive", fontSize: '2rem', fontStyle: 'italic', color: '#1a1a1a', transform: 'rotate(-3deg)', display: 'inline-block' }}>
                    {acceptForm.nombre || 'Firma del cliente'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setAcceptForm(null)} disabled={acceptSaving} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>Cancelar</button>
                <button onClick={confirmAccept} disabled={acceptSaving || !acceptForm.nombre} style={{ ...S.btn, background: acceptSaving || !acceptForm.nombre ? '#bbb' : '#00695c', color: '#fff', cursor: acceptSaving || !acceptForm.nombre ? 'not-allowed' : 'pointer' }}>
                  {acceptSaving ? 'Firmando…' : 'Confirmar aceptación'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Reject Quote Modal ─── */}
        {rejectForm && (
          <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget && !rejectSaving) setRejectForm(null); }}>
            <div style={{ ...S.modal, maxWidth: 480 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Marcar como rechazada — {rejectForm.numero}</h3>
                <button onClick={() => setRejectForm(null)} disabled={rejectSaving} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#666', margin: '0 0 16px', lineHeight: 1.55 }}>Registra el motivo del rechazo. El deal asociado se moverá a <strong>Cerrada perdida</strong> con este motivo.</p>

              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Motivo</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { v: 'precio', l: 'No aceptó el monto' },
                    { v: 'competidor', l: 'Contrató otro sistema' },
                    { v: 'timing', l: 'No era el momento' },
                    { v: 'no_fit', l: 'Le faltaba una función que necesitaba' },
                    { v: 'sin_respuesta', l: 'Nunca respondió' },
                    { v: 'cancelo_proyecto', l: 'Canceló el proyecto / cerró el negocio' },
                    { v: 'otro', l: 'Otro motivo' },
                  ].map(opt => {
                    const sel = rejectForm.motivo === opt.v;
                    return (
                      <label key={opt.v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1px solid ${sel ? '#c62828' : '#e0e0e0'}`, borderRadius: 6, cursor: 'pointer', background: sel ? '#fff5f5' : '#fff', fontSize: '0.8125rem' }}>
                        <input
                          type="radio"
                          name="admin-reject-motivo"
                          value={opt.v}
                          checked={sel}
                          onChange={() => setRejectForm({ ...rejectForm, motivo: opt.v })}
                        />
                        <span style={{ color: sel ? '#c62828' : '#555', fontWeight: sel ? 600 : 500 }}>{opt.l}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Detalle interno (opcional)</label>
                <textarea
                  value={rejectForm.detalle}
                  onChange={e => setRejectForm({ ...rejectForm, detalle: e.target.value })}
                  rows={3}
                  placeholder="Ej. comentario del cliente o análisis competitivo"
                  style={{ ...S.input, resize: 'vertical' as const, fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setRejectForm(null)} disabled={rejectSaving} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>Cancelar</button>
                <button onClick={confirmReject} disabled={rejectSaving || !rejectForm.motivo} style={{ ...S.btn, background: rejectSaving || !rejectForm.motivo ? '#bbb' : '#c62828', color: '#fff', cursor: rejectSaving || !rejectForm.motivo ? 'not-allowed' : 'pointer' }}>
                  {rejectSaving ? 'Guardando…' : 'Confirmar rechazo'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Extender vigencia Modal ─── */}
        {extendForm && (() => {
          const today = new Date(); today.setHours(12,0,0,0);
          const baseDate = extendForm.vigencia ? new Date(extendForm.vigencia + 'T12:00:00') : today;
          const fromDate = baseDate < today ? today : baseDate;
          const days = parseInt(extendForm.days) || 0;
          const newDate = days > 0 ? new Date(fromDate.getTime() + days * 86400000) : fromDate;
          const fmtLong = (d: Date) => {
            const wd = d.toLocaleDateString('es-MX', { weekday: 'long' });
            return `${wd[0].toUpperCase() + wd.slice(1)} ${d.getDate()} de ${d.toLocaleDateString('es-MX', { month: 'long' })}`;
          };
          const isExpired = baseDate < today;
          return (
            <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget && !extending) setExtendForm(null); }}>
              <div style={{ ...S.modal, maxWidth: 460 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>⏱️ Extender vigencia — {extendForm.numero}</h3>
                  <button onClick={() => setExtendForm(null)} disabled={extending} style={{ border: 'none', background: 'transparent', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#666', margin: '0 0 14px', lineHeight: 1.55 }}>
                  {isExpired
                    ? <>Esta cotización <strong>está vencida</strong>. Al extenderla volverá a estado <em>enviada</em> con la nueva fecha desde hoy.</>
                    : <>Vigencia actual: <strong>{fmtLong(baseDate)}</strong>. Suma días sobre esa fecha.</>}
                </p>

                <label style={S.label}>Días de extensión</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[2, 3, 5, 7].map(opt => {
                    const sel = parseInt(extendForm.days) === opt;
                    return (
                      <button key={opt} onClick={() => setExtendForm({ ...extendForm, days: opt })} style={{ flex: 1, padding: '10px 8px', border: `1.5px solid ${sel ? '#1d4ed8' : '#e0e0e0'}`, background: sel ? '#eff6ff' : '#fff', color: sel ? '#1d4ed8' : '#555', borderRadius: 6, fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer' }}>
                        +{opt}d
                      </button>
                    );
                  })}
                </div>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={extendForm.days}
                  onChange={e => setExtendForm({ ...extendForm, days: e.target.value })}
                  placeholder="Personalizado (1–60)"
                  style={{ ...S.input, marginBottom: 14 }}
                />

                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <div style={{ fontSize: '0.6875rem', color: '#0c4a6e', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>Nueva vigencia</div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0c4a6e' }}>{fmtLong(newDate)}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#0369a1', marginTop: 2 }}>El cliente verá el contador y los precios con promoción hasta esa fecha.</div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setExtendForm(null)} disabled={extending} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>Cancelar</button>
                  <button onClick={submitExtend} disabled={extending || !days || days < 1} style={{ ...S.btn, background: extending || !days ? '#bbb' : '#1d4ed8', color: '#fff', cursor: extending || !days ? 'not-allowed' : 'pointer' }}>
                    {extending ? 'Extendiendo…' : `Extender +${days || 0} días`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ─── Transcript Modal ─── */}
        {showTranscriptModal && !showReview && (
          <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setShowTranscriptModal(false); }}>
            <div style={{ ...S.modal, maxWidth: 640 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Generar cotización desde transcripción</h3>
                <button onClick={() => setShowTranscriptModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#999', margin: '0 0 12px' }}>Pega la transcripción de tu llamada. La IA extraerá los datos del cliente, recomendará un plan y generará los puntos clave.</p>
              <textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Pega aquí la transcripción completa de la llamada..." style={{ ...S.input, height: 320, resize: 'vertical' as const, fontSize: '0.75rem', lineHeight: 1.6 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{ fontSize: '0.625rem', color: '#ccc' }}>{transcript.length.toLocaleString()} caracteres</span>
                <button onClick={async () => {
                  if (transcript.length < 100) { alert('La transcripción es muy corta. Mínimo 100 caracteres.'); return; }
                  setAnalyzing(true);
                  try {
                    const res = await fetch('/api/revenue/analyze-transcript', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript }) });
                    const data = await res.json();
                    if (data.error) { alert(data.error); setAnalyzing(false); return; }
                    setAnalysisResult(data);
                    setShowReview(true);
                  } catch { alert('Error de conexión. Intenta de nuevo.'); }
                  setAnalyzing(false);
                }} disabled={analyzing || transcript.length < 100} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', opacity: analyzing || transcript.length < 100 ? 0.5 : 1 }}>
                  {analyzing ? 'Analizando...' : 'Analizar con IA'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Analysis Review Screen ─── */}
        {showReview && analysisResult && (
          <div style={{ position: 'fixed' as const, inset: 0, zIndex: 200, background: '#f5f6f8', display: 'flex', flexDirection: 'column' as const }}>
            <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Resultado del análisis</h3>
                {analysisResult.confidence != null && (
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, color: analysisResult.confidence >= 0.7 ? '#2AB5A0' : '#E8A838', background: analysisResult.confidence >= 0.7 ? 'rgba(42,181,160,0.08)' : 'rgba(232,168,56,0.08)', padding: '2px 8px', borderRadius: 4 }}>
                    Confianza: {Math.round(analysisResult.confidence * 100)}%
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => {
                  const r = analysisResult;
                  const rec = r.recommendation || {};
                  const planPrice = PLAN_PRICES[rec.plan] || 1215;
                  const discPct = parseFloat(rec.descuento_pct) || 0;
                  const suc = parseInt(rec.sucursales) || 1;
                  const isAnn = rec.periodo === 'anual';
                  const planSub = planPrice * suc * (isAnn ? 10 : 1);
                  const planDisc = planSub * (discPct / 100);
                  const planItems: any[] = [{
                    tipo: 'plan', nombre: rec.plan || 'controla',
                    sucursales: suc, precio_unitario: planPrice,
                    periodo: rec.periodo || 'mensual',
                    descuento_pct: discPct,
                    subtotal: planSub - planDisc,
                  }];
                  const extraItems = (rec.extras || []).map((e: any) => ({
                    tipo: 'extra', nombre: e.nombre, monto: e.monto || 0,
                    descripcion: e.descripcion || '', nota: e.nota || '',
                    periodo_extra: e.periodo_extra || 'unico',
                    recurrente: e.periodo_extra === 'mensual' || e.periodo_extra === 'anual',
                    subtotal: e.periodo_extra === 'anual' ? (e.monto || 0) * 10 : (e.monto || 0),
                  }));
                  // Promoción
                  const promo = rec.promocion;
                  if (promo?.aplicar) {
                    extraItems.push({
                      tipo: 'extra', nombre: promo.nombre || 'Implementación y configuración',
                      descripcion: promo.descripcion || 'Setup inicial, migración y capacitación. Aplica al contratar plan anual.',
                      monto: 0, precio_original: promo.precio_original || IMPL_PRICES[rec.plan] || 4000,
                      es_promocion: true, recurrente: false, subtotal: 0,
                    });
                  }
                  // IVA mode
                  const ivaMode = rec.iva_mode || 'sin';
                  // Notas extra → condiciones
                  const notasExtra = (r.notas_extra || []).filter(Boolean);
                  const condBase = 'Precios en MXN. Migracion incluida. Soporte por chat SACS y WhatsApp. Sin contratos.';
                  const condiciones = notasExtra.length > 0 ? condBase + '\n\n' + notasExtra.join('\n') : condBase;
                  setQf({
                    empresa: r.client?.empresa || '', contacto: r.client?.contacto || '',
                    email: r.client?.email || '', whatsapp: r.client?.whatsapp || '',
                    items: [...planItems, ...extraItems],
                    iva_incluido: ivaMode !== 'sin', iva_mode: ivaMode,
                    descuento_global: 0, descuento_tipo: 'pct',
                    moneda: 'MXN', template: 'modern', condiciones,
                    key_points: r.key_points || [], mostrar_key_points: true,
                    roi: r.roi || null, mostrar_roi: !!(r.roi?.ahorro_mensual),
                    antes_despues: r.antes_despues || [], mostrar_antes_despues: (r.antes_despues || []).length > 0,
                    mostrar_firma: true, mostrar_qr: true, mostrar_animaciones: true,
                  });
                  setShowReview(false); setShowTranscriptModal(false); setShowDrawer(true);
                }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff' }}>Aplicar al formulario</button>
                <button onClick={() => { setShowReview(false); setShowTranscriptModal(false); }} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>Descartar</button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              <div style={{ maxWidth: 800, margin: '0 auto', display: 'grid', gap: 16 }}>
                {/* Client info */}
                <div style={S.card}>
                  <h3 style={S.cardTitle}>Cliente detectado</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><label style={S.label}>Empresa</label><input value={analysisResult.client?.empresa || ''} onChange={e => setAnalysisResult({ ...analysisResult, client: { ...analysisResult.client, empresa: e.target.value } })} style={S.input} /></div>
                    <div><label style={S.label}>Contacto</label><input value={analysisResult.client?.contacto || ''} onChange={e => setAnalysisResult({ ...analysisResult, client: { ...analysisResult.client, contacto: e.target.value } })} style={S.input} /></div>
                    <div><label style={S.label}>Email</label><input value={analysisResult.client?.email || ''} onChange={e => setAnalysisResult({ ...analysisResult, client: { ...analysisResult.client, email: e.target.value } })} style={S.input} /></div>
                    <div><label style={S.label}>WhatsApp</label><input value={analysisResult.client?.whatsapp || ''} onChange={e => setAnalysisResult({ ...analysisResult, client: { ...analysisResult.client, whatsapp: e.target.value } })} style={S.input} /></div>
                  </div>
                </div>

                {/* Plan recommendation */}
                <div style={S.card}>
                  <h3 style={S.cardTitle}>Plan recomendado</h3>
                  <div style={{ background: '#f8f9fb', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic' as const }}>{analysisResult.recommendation?.reasoning}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div><label style={S.label}>Plan</label><select value={analysisResult.recommendation?.plan || 'controla'} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, plan: e.target.value } })} style={S.input}>{PLANS.map(p => <option key={p} value={p}>{p} (${PLAN_PRICES[p]}/mes)</option>)}</select></div>
                    <div><label style={S.label}>Sucursales</label><input type="number" value={analysisResult.recommendation?.sucursales || 1} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, sucursales: parseInt(e.target.value) || 1 } })} style={S.input} /></div>
                    <div><label style={S.label}>Periodo</label><select value={analysisResult.recommendation?.periodo || 'mensual'} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, periodo: e.target.value } })} style={S.input}><option value="mensual">Mensual</option><option value="anual">Anual</option></select></div>
                  </div>
                  {(analysisResult.recommendation?.extras || []).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={S.label}>Extras sugeridos</div>
                      {analysisResult.recommendation.extras.map((ex: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
                          <span style={{ flex: 1, fontSize: '0.8125rem' }}><strong>{ex.nombre}</strong> — {ex.descripcion} <span style={{ color: '#2AB5A0', fontWeight: 700 }}>{fmt(ex.monto || 0)}</span></span>
                          <button onClick={() => { const extras = [...analysisResult.recommendation.extras]; extras.splice(i, 1); setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, extras } }); }} style={{ ...S.btnSmall, color: '#E54B4B' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* IVA, Descuento, Promo */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    <div><label style={S.label}>IVA</label><select value={analysisResult.recommendation?.iva_mode || 'sin'} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, iva_mode: e.target.value } })} style={S.input}><option value="sin">Sin IVA</option><option value="suma">Sumar 16%</option><option value="incluido">Incluido en precios</option></select></div>
                    <div><label style={S.label}>Descuento plan (%)</label><input type="number" value={analysisResult.recommendation?.descuento_pct || 0} onChange={e => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, descuento_pct: parseFloat(e.target.value) || 0 } })} style={S.input} /></div>
                  </div>
                  {analysisResult.recommendation?.promocion?.aplicar && (
                    <div style={{ marginTop: 10, padding: 10, background: '#ecfdf5', borderRadius: 8, border: '1px solid #2AB5A0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#fff', background: '#2AB5A0', padding: '1px 6px', borderRadius: 3, marginRight: 6 }}>PROMO</span>
                        <strong style={{ fontSize: '0.8125rem' }}>{analysisResult.recommendation.promocion.nombre}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#999', marginLeft: 8 }}><s>{fmt(analysisResult.recommendation.promocion.precio_original || 0)}</s> → $0</span>
                      </div>
                      <button onClick={() => setAnalysisResult({ ...analysisResult, recommendation: { ...analysisResult.recommendation, promocion: { ...analysisResult.recommendation.promocion, aplicar: false } } })} style={{ ...S.btnSmall, color: '#E54B4B' }}>✕</button>
                    </div>
                  )}
                </div>

                {/* Notas extra */}
                {(analysisResult.notas_extra || []).length > 0 && (
                  <div style={S.card}>
                    <h3 style={S.cardTitle}>Notas extra</h3>
                    <p style={{ fontSize: '0.6875rem', color: '#999', margin: '0 0 8px' }}>Observaciones adicionales que se agregan a las condiciones de la cotización</p>
                    {analysisResult.notas_extra.map((nota: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                        <input value={nota} onChange={e => { const n = [...analysisResult.notas_extra]; n[i] = e.target.value; setAnalysisResult({ ...analysisResult, notas_extra: n }); }} style={{ ...S.input, flex: 1, fontSize: '0.75rem' }} />
                        <button onClick={() => { const n = [...analysisResult.notas_extra]; n.splice(i, 1); setAnalysisResult({ ...analysisResult, notas_extra: n }); }} style={{ ...S.btnSmall, color: '#E54B4B' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Key points (Minuta) */}
                <div style={S.card}>
                  <h3 style={S.cardTitle}>Minuta de la reunión ({(analysisResult.key_points || []).length})</h3>
                  <p style={{ fontSize: '0.6875rem', color: '#999', margin: '0 0 12px' }}>Estos puntos aparecerán en la cotización como "Minuta de la reunión"</p>
                  {(analysisResult.key_points || []).map((kp: any, i: number) => (
                    <div key={i} style={{ background: '#f8f9fb', borderRadius: 8, padding: 12, marginBottom: 8, borderLeft: `3px solid ${M.violeta}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <input value={kp.title} onChange={e => { const kps = [...analysisResult.key_points]; kps[i] = { ...kps[i], title: e.target.value }; setAnalysisResult({ ...analysisResult, key_points: kps }); }} style={{ ...S.input, fontWeight: 700, marginBottom: 4 }} />
                          <textarea value={kp.detail} onChange={e => { const kps = [...analysisResult.key_points]; kps[i] = { ...kps[i], detail: e.target.value }; setAnalysisResult({ ...analysisResult, key_points: kps }); }} rows={2} style={{ ...S.input, fontSize: '0.75rem' }} />
                        </div>
                        <button onClick={() => { const kps = [...analysisResult.key_points]; kps.splice(i, 1); setAnalysisResult({ ...analysisResult, key_points: kps }); }} style={{ ...S.btnSmall, color: '#E54B4B', flexShrink: 0 }}>✕</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setAnalysisResult({ ...analysisResult, key_points: [...(analysisResult.key_points || []), { title: '', detail: '' }] })} style={S.btnSmall}>+ Agregar punto</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Quote Drawer ─── */}
        {showDrawer && (
          <div className="rh-quote-drawer" style={{ position: 'fixed' as const, inset: 0, zIndex: 200, background: '#f5f6f8', display: 'flex', flexDirection: 'column' as const }}>
            {/* Top bar */}
            <div className="rh-quote-topbar" style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{qf.id ? `Editar ${qf.numero || 'cotización'}` : 'Nueva cotización'}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={createQuote} disabled={saving || !items.length || !qf.empresa} style={{ ...S.btn, background: M.violeta, color: '#fff', fontSize: '0.75rem', padding: '6px 16px' }}>{saving ? 'Guardando...' : qf.id ? 'Guardar cambios' : 'Crear y enviar'}</button>
                <button onClick={() => setShowDrawer(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#999' }}>✕</button>
              </div>
            </div>
            {/* Split layout */}
            <div className="rh-quote-split" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Left: Form */}
            <div className="rh-quote-form" style={{ width: 640, flexShrink: 0, background: '#fff', overflowY: 'auto' as const, padding: 24, borderRight: '1px solid #eee' }}>

              {/* ── Cliente ──
                  Un buscador sobre clientes Y leads a la vez: quien cotiza no
                  sabe —ni tiene por qué— en qué tabla está esa persona. Elegir
                  aquí es lo que LIGA la cotización; escribiéndola a mano nace
                  desconectada y no aparece en la ficha de nadie (es lo que pasó
                  con las 32 que hay hoy). */}
              <div style={S.label}>Cliente</div>
              {qf.company_id ? (
                <div style={{ background: '#f7f9fc', border: '1px solid #e2e8f2', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                        {qf.empresa}
                        {(() => {
                          const cl = qf._clase || (qf._es_cliente ? 'cliente' : 'lead');
                          const est: Record<string, any> = {
                            cliente: { t: 'Cliente', bg: '#f0e9ff', fg: '#6d4bc7' },
                            lead: { t: 'Lead', bg: '#e8f0fd', fg: '#3764c4' },
                            excliente: { t: 'Excliente', bg: '#f4f5f7', fg: '#5b6472' },
                          };
                          const e = est[cl] || est.lead;
                          return <span style={{ marginLeft: 6, fontSize: '0.6rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: e.bg, color: e.fg }}>{e.t}</span>;
                        })()}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#888' }}>{[qf.contacto, qf.email, qf.whatsapp].filter(Boolean).join(' · ') || 'sin contacto'}</div>
                      {qf._ctx_n ? (
                        <div style={{ fontSize: '0.72rem', color: '#a06600', marginTop: 2 }}>
                          Ya tiene {qf._ctx_n} cotización{qf._ctx_n === 1 ? '' : 'es'}{qf._ctx_ultima ? ` · última ${qf._ctx_ultima}` : ''}
                        </div>
                      ) : null}
                    </div>
                    <button onClick={() => setQf({ ...qf, company_id: null, contact_id: null, _es_cliente: false, _clase: '', _ctx_n: 0, _ctx_ultima: '' })}
                      style={{ ...S.btnSmall, marginRight: 0 }}>Cambiar</button>
                  </div>
                  {/* Decirlo explícito: si no, no hay forma de saber si el clic
                      en el buscador sí agarró. */}
                  <div style={{ fontSize: '0.7rem', color: '#0f7a56', marginTop: 6 }}>
                    Ligada — ya aparece en su ficha y en su historial.
                  </div>
                </div>
              ) : (
                <ClienteBuscador
                  valorInicial={qf.empresa || ''}
                  datos={{ empresa: qf.empresa, contacto: qf.contacto, email: qf.email, whatsapp: qf.whatsapp }}
                  onElegir={(r: any) => setQf({
                    ...qf, company_id: r.company_id, contact_id: r.contact_id || null,
                    empresa: r.empresa || r.contacto, contacto: r.contacto || '',
                    email: r.email || qf.email || '', whatsapp: r.whatsapp || qf.whatsapp || '',
                    _es_cliente: !!r.es_cliente, _clase: r.clase || (r.es_cliente ? 'cliente' : 'lead'), _ctx_n: r.n || 0,
                    _ctx_ultima: r.ultima ? `${r.ultima.numero} · $${Number(r.ultima.total || 0).toLocaleString('es-MX')} · ${r.ultima.estado}` : '',
                  })}
                />
              )}
              {/* Estos cuatro son lo que se IMPRIME. Se pueden cambiar sin
                  tocar la ficha del cliente: un contacto distinto para esta
                  cotización es un caso real y no debe editar el CRM. */}
              <div style={{ fontSize: '0.63rem', fontWeight: 700, color: '#a3a3a3', textTransform: 'uppercase' as const, letterSpacing: '.07em', margin: '14px 0 7px' }}>
                Datos que salen en la cotización
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input value={qf.empresa || ''} onChange={e => setQf({ ...qf, empresa: e.target.value })} placeholder="Empresa *" required style={{ ...S.input, borderColor: !qf.empresa ? '#fca5a5' : undefined }} />
                <input value={qf.contacto || ''} onChange={e => setQf({ ...qf, contacto: e.target.value })} placeholder="Contacto" style={S.input} />
                <input value={qf.email || ''} onChange={e => setQf({ ...qf, email: e.target.value })} placeholder="Email *" required type="email" style={{ ...S.input, borderColor: !qf.email ? '#fca5a5' : undefined }} />
                <input value={qf.whatsapp || ''} onChange={e => setQf({ ...qf, whatsapp: e.target.value })} placeholder="WhatsApp *" required type="tel" style={{ ...S.input, borderColor: !qf.whatsapp ? '#fca5a5' : undefined }} />
              </div>
              {/* Aviso, no candado: cotizar rápido en una llamada es un caso real
                  y bloquear el guardado haría que se escriba cualquier cosa con
                  tal de avanzar. El candado va al aceptar o cobrar. */}
              {!qf.company_id && (qf.empresa || '').trim().length > 1 && (
                <div style={{ fontSize: '0.7rem', color: '#b45309', marginBottom: 8 }}>
                  ⚠ Sin cliente ligado: no va a aparecer en su ficha ni en su historial. Búscalo arriba o créalo.
                </div>
              )}

              {/* Client logo */}
              <div style={{ marginBottom: 16 }}>
                <div style={S.label}>Logo del cliente (opcional)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {qf.logo_url ? (
                    <div style={{ position: 'relative' as const, width: 48, height: 48, borderRadius: 8, border: '1px solid #e0e0e0', overflow: 'hidden', flexShrink: 0, background: '#fafafa' }}>
                      <img src={qf.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' as const }} />
                      <button onClick={() => setQf({ ...qf, logo_url: '' })} style={{ position: 'absolute' as const, top: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: '#E54B4B', color: '#fff', border: 'none', fontSize: '0.625rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ) : null}
                  <label style={{ ...S.btnSmall, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, flex: qf.logo_url ? undefined : 1, justifyContent: 'center' as const }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {qf.logo_url ? 'Cambiar' : 'Subir logo'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append('file', file);
                      const res = await fetch('/api/revenue/upload-logo', { method: 'POST', body: fd });
                      const data = await res.json();
                      if (data.url) setQf({ ...qf, logo_url: data.url });
                      else alert(data.error || 'Error al subir');
                      e.target.value = '';
                    }} />
                  </label>
                  {qf.logo_url && <input value={qf.logo_url} onChange={e => setQf({ ...qf, logo_url: e.target.value })} placeholder="URL del logo" style={{ ...S.input, flex: 1, fontSize: '0.6875rem' }} />}
                </div>
              </div>

              {/* Items */}
              {/* ── Minuta de la reunión ──
                  Va ANTES de los conceptos porque es la que dice qué se acordó:
                  cuántas sucursales, qué le urge, qué descuento se prometió.
                  Estaba hasta el fondo, después de los toggles, y ahí se llenaba
                  —si se llenaba— cuando la cotización ya estaba armada. */}
              {(qf.mostrar_key_points !== false) && (
                <div style={{ marginTop: 12, background: '#fafbfd', border: '1px solid #e8eaf0', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <div style={S.label}>Minuta de la reunión</div>
                    <div style={{ fontSize: '0.625rem', color: '#999' }}>{(qf.key_points || []).length} {((qf.key_points || []).length === 1 ? 'punto' : 'puntos')}</div>
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#777', marginBottom: 8, lineHeight: 1.5 }}>
                    Pega aquí los puntos raw que platicaste con el cliente. Después da clic en <strong>Estructurar con IA</strong> y lo acomodamos en una minuta profesional.
                  </div>
                  {/* Antes, sin pasar por la IA la minuta no salía en la
                      cotización del cliente: se escribía y desaparecía sin
                      avisar. Ahora sí sale, y aquí se dice cómo. */}
                  <div style={{ fontSize: '0.6875rem', color: (qf.key_points || []).length ? '#1E8A63' : '#7a6fc9', marginBottom: 8, lineHeight: 1.5 }}>
                    {(qf.key_points || []).length
                      ? 'El cliente la ve estructurada en puntos.'
                      : 'Si no la estructuras, el cliente la ve tal como la escribas aquí. Las líneas que empiecen con "1.", "2." salen como títulos.'}
                  </div>
                  <textarea
                    value={qf.minuta_raw || ''}
                    onChange={e => setQf({ ...qf, minuta_raw: e.target.value })}
                    placeholder="Ej. cliente tiene 3 sucursales, le urge controlar inventario porque pierde 200 piezas al mes; quiere migrar de microsip; le gusta lealtad por whatsapp; presupuesto ~25k; cierra en mayo; pidió descuento si paga anual..."
                    rows={5}
                    style={{ ...S.input, fontSize: '0.75rem', resize: 'vertical' as const, minHeight: 100, fontFamily: 'inherit', lineHeight: 1.5 }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' as const }}>
                    <button
                      onClick={formatMinuta}
                      disabled={formattingMinuta || !(qf.minuta_raw || '').trim()}
                      style={{ ...S.btnSmall, background: '#1a1a1a', color: '#fff', padding: '6px 14px', opacity: formattingMinuta || !(qf.minuta_raw || '').trim() ? 0.5 : 1, cursor: formattingMinuta || !(qf.minuta_raw || '').trim() ? 'not-allowed' : 'pointer' }}
                    >
                      {formattingMinuta ? '⏳ Procesando…' : '✨ Estructurar con IA'}
                    </button>
                    {(qf.key_points || []).length > 0 && (
                      <button
                        onClick={() => { if (confirm('¿Borrar los puntos actuales y dejar el editor vacío?')) setQf({ ...qf, key_points: [] }); }}
                        style={{ ...S.btnSmall, color: '#999' }}
                      >
                        Limpiar puntos
                      </button>
                    )}
                    <span style={{ fontSize: '0.625rem', color: '#bbb' }}>Mín. 30 caracteres</span>
                  </div>
                  {minutaError && (
                    <div style={{ marginTop: 8, padding: '6px 10px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 6, fontSize: '0.6875rem', color: '#c53030' }}>
                      {minutaError}
                    </div>
                  )}

                  {(qf.key_points || []).length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e0e3eb' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#555', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Puntos estructurados</div>
                      {qf.key_points.map((kp: any, i: number) => (
                        <div key={i} style={{ background: '#fff', borderRadius: 8, padding: 10, marginBottom: 6, borderLeft: `3px solid ${M.violeta}`, display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <input value={kp.title} onChange={e => { const kps = [...qf.key_points]; kps[i] = { ...kps[i], title: e.target.value }; setQf({ ...qf, key_points: kps }); }} placeholder="Título" style={{ ...S.input, fontWeight: 700, fontSize: '0.75rem', marginBottom: 4 }} />
                            <input value={kp.detail} onChange={e => { const kps = [...qf.key_points]; kps[i] = { ...kps[i], detail: e.target.value }; setQf({ ...qf, key_points: kps }); }} placeholder="Detalle" style={{ ...S.input, fontSize: '0.6875rem' }} />
                          </div>
                          <button onClick={() => { const kps = [...qf.key_points]; kps.splice(i, 1); setQf({ ...qf, key_points: kps }); }} style={{ ...S.btnSmall, color: '#E54B4B', alignSelf: 'flex-start' }}>✕</button>
                        </div>
                      ))}
                      <button onClick={() => setQf({ ...qf, key_points: [...(qf.key_points || []), { title: '', detail: '' }] })} style={S.btnSmall}>+ Agregar punto manual</button>
                    </div>
                  )}
                </div>
              )}


              <div style={S.label}>Conceptos</div>
              {items.map((it: any, i: number) => [it, i] as [any, number]).filter((par: [any, number]) => !par[0].es_promocion).map((par: [any, number]) => renderItem(par[0], par[1]))}
              <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                <button onClick={addPlanItem} style={{ ...S.btnSmall, flex: 1 }}>+ Plan SACS</button>
                <button onClick={addPluginItem} style={{ ...S.btnSmall, flex: 1 }}>+ Plugin</button>
                <button onClick={addPersonalizacionItem} style={{ ...S.btnSmall, flex: 1 }}>+ Personalización</button>
                <button onClick={addExtraItem} style={{ ...S.btnSmall, flex: 1 }}>+ Extra</button>
              </div>

              {/* Catálogo de plugins. Se elige el concepto Y cómo se cobra en
                  el mismo gesto: cada plugin solo ofrece las modalidades que
                  tiene declaradas en Configuración, así no se cuela un
                  vitalicio en algo que se renueva. */}
              {pickerPlugin && (
                <div onClick={() => setPickerPlugin(false)}
                  style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,32,.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                  <div onClick={e => e.stopPropagation()}
                    style={{ background: '#fff', borderRadius: 14, width: 'min(520px,100%)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px -20px rgba(20,18,32,.5)' }}>
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0eef8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#241d43' }}>Elegir plugin</div>
                        <div style={{ fontSize: '0.72rem', color: '#8a8590', marginTop: 1 }}>Se agrega con su descripción y su precio de lista. Los puedes cambiar después.</div>
                      </div>
                      <button onClick={() => setPickerPlugin(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a5a2af', fontSize: '1.05rem' }}>✕</button>
                    </div>
                    <div style={{ overflowY: 'auto', padding: '6px 0' }}>
                      {catPlugins.map((p: any) => (
                        <div key={p.slug} style={{ padding: '11px 18px', borderBottom: '1px solid #f7f6fb' }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#241d43' }}>{p.nombre}</div>
                          {p.descripcion && <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2, lineHeight: 1.45 }}>{p.descripcion}</div>}
                          <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                            {(p.modalidades || ['anual']).map((m: string) => {
                              const precio = m === 'vitalicio' ? p.precio_vitalicio : m === 'anual' ? p.precio_anual : p.precio_mensual;
                              const etiqueta = m === 'vitalicio' ? 'Vitalicio' : m === 'anual' ? 'Anual' : 'Mensual';
                              return (
                                <button key={m} onClick={() => elegirPlugin(p, m)}
                                  style={{ ...S.btnSmall, borderColor: '#ddd6fb', color: '#5B4BD6', fontWeight: 700 }}>
                                  {etiqueta} · {precio ? fmt(Number(precio)) : 'a la medida'}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {!catPlugins.length && (
                        <div style={{ padding: '18px', textAlign: 'center', color: '#a5a2af', fontSize: '0.8rem' }}>
                          No hay plugins en el catálogo. Se dan de alta en Configuración → Planes y plugins.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Promociones y cortesías ──
                  Sección aparte, no un botón más en la fila de conceptos. Una
                  promoción no es un concepto: es un concepto con precio tachado.
                  Revueltos, se escoge por color y se acaba metiendo una cortesía
                  donde iba un cobro. */}
              <div style={S.label}>Promociones y cortesías</div>
              {items.map((it: any, i: number) => [it, i] as [any, number]).filter((par: [any, number]) => par[0].es_promocion).map((par: [any, number]) => renderItem(par[0], par[1]))}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button onClick={() => {
                  const mainPlan = items.find((i: any) => i.tipo === 'plan')?.nombre || 'controla';
                  const precio = IMPL_PRICES[mainPlan] || 4000;
                  setQf({ ...qf, items: [...items, { tipo: 'extra', nombre: 'Implementacion y configuracion', descripcion: 'Setup inicial, migracion de datos y capacitacion. Aplica al contratar plan anual.', monto: 0, precio_original: precio, es_promocion: true, recurrente: false, subtotal: 0 }] });
                }} style={{ ...S.btnSmall, flex: 1, background: '#f8f9fb', color: '#2AB5A0', borderColor: '#2AB5A0' }}>+ Implementación de cortesía</button>
                <button onClick={() => {
                  setQf({ ...qf, items: [...items, { tipo: 'extra', nombre: '', descripcion: '', monto: 0, precio_original: 0, es_promocion: true, recurrente: false, subtotal: 0 }] });
                }} style={{ ...S.btnSmall, flex: 1, background: '#f8f9fb', color: '#2AB5A0', borderColor: '#2AB5A0' }}>+ Promoción libre</button>
              </div>
              {/* Cuánto se está regalando, en un solo número. Hoy no aparecía en
                  ningún lado: se veía concepto por concepto y nunca el total. */}
              {(() => {
                const regalado = items.filter((i: any) => i.es_promocion)
                  .reduce((a: number, i: number | any) => a + (Number(i.precio_original || 0) - Number(i.monto || 0)), 0);
                if (regalado <= 0) return null;
                return (
                  <div style={{ fontSize: '0.72rem', color: '#1A8F7A', background: '#eefaf7', borderRadius: 7, padding: '8px 10px', marginBottom: 16, fontWeight: 600 }}>
                    Estás regalando {fmt(regalado)} en esta cotización
                  </div>
                );
              })()}

              {/* ── Paquetes ──
                  Cambia la pregunta: de "¿compras?" a "¿cuál?". Solo tiene
                  sentido con la plantilla Interactiva, así que se enciende sola
                  al elegirla y se avisa si falta una de las dos cosas. */}
              <div style={{ marginBottom: 14, borderTop: '1px solid #f0f0f2', paddingTop: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={paquetesOn} onChange={togglePaquetes} />
                  Ofrecer 2–3 opciones al cliente
                </label>
                {paquetesOn && (
                  <div style={{ marginTop: 10, background: '#f8f9fb', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: '0.71rem', color: '#777', marginBottom: 8, lineHeight: 1.5 }}>
                      Asigna cada concepto a una opción con el selector de su tarjeta, o déjalo en todas.
                    </div>
                    {paquetes.map((p: any, pi: number) => {
                      const n = items.filter((it: any) => !it.paquete || it.paquete === p.id).length;
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <input value={p.nombre}
                            onChange={e => setQf({ ...qf, paquetes: paquetes.map((x: any, i: number) => i === pi ? { ...x, nombre: e.target.value } : x) })}
                            style={{ ...S.input, maxWidth: 200 }} />
                          <span style={{ fontSize: '0.72rem', color: '#888' }}>{n} concepto{n === 1 ? '' : 's'} · <b style={{ color: '#1a1a1a' }}>{fmt(totalDePaquete(p.id))}</b></span>
                          {paquetes.length > 2 && (
                            <button onClick={() => setQf({ ...qf, paquetes: paquetes.filter((_: any, i: number) => i !== pi), items: items.map((it: any) => it.paquete === p.id ? { ...it, paquete: undefined } : it) })}
                              style={{ background: 'none', border: 'none', color: '#E54B4B', cursor: 'pointer' }}>✕</button>
                          )}
                        </div>
                      );
                    })}
                    {paquetes.length < 3 && (
                      <button onClick={() => {
                        const usados = paquetes.map((p: any) => p.id);
                        const next = ['a', 'b', 'c'].find(x => !usados.includes(x)) || 'c';
                        setQf({ ...qf, paquetes: [...paquetes, { id: next, nombre: 'Opción Premium' }] });
                      }} style={S.btnSmall}>+ Otra opción</button>
                    )}
                    <div style={{ fontSize: '0.68rem', color: '#999', marginTop: 8 }}>
                      El total de la cotización es el de la primera opción. Cuando el cliente elija otra y acepte, el documento se queda con esa.
                    </div>
                  </div>
                )}
                {/* Las dos mitades tienen que ir juntas: paquetes sin plantilla
                    Interactiva se ven como una lista más, y la plantilla sin
                    paquetes no tiene nada que ofrecer. */}
                {paquetesOn && qf.template !== 'interactiva' && (
                  <div style={{ fontSize: '0.71rem', color: '#b45309', marginTop: 8 }}>
                    Tienes opciones armadas pero la plantilla no es la Interactiva.
                    <button onClick={() => setQf({ ...qf, template: 'interactiva' })} style={{ border: 'none', background: 'none', color: '#3764c4', cursor: 'pointer', fontWeight: 700, fontSize: '0.71rem' }}>Cambiar a Interactiva</button>
                  </div>
                )}
                {!paquetesOn && qf.template === 'interactiva' && (
                  <div style={{ fontSize: '0.71rem', color: '#b45309', marginTop: 8 }}>
                    La plantilla Interactiva necesita opciones para que el cliente elija.
                    <button onClick={togglePaquetes} style={{ border: 'none', background: 'none', color: '#3764c4', cursor: 'pointer', fontWeight: 700, fontSize: '0.71rem' }}>Crear dos opciones</button>
                  </div>
                )}
              </div>

              {/* Totals & Config */}
              <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 8 }}>
                  <span>Subtotal</span><span style={{ fontWeight: 700 }}>{fmt(itemsSubtotal)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <div><label style={{ ...S.label, marginTop: 0 }}>Desc. global</label><input type="number" value={qf.descuento_global || 0} onChange={e => setQf({ ...qf, descuento_global: e.target.value })} style={S.input} /></div>
                  <div><label style={{ ...S.label, marginTop: 0 }}>Tipo</label><select value={qf.descuento_tipo} onChange={e => setQf({ ...qf, descuento_tipo: e.target.value })} style={S.input}><option value="pct">Porcentaje %</option><option value="fijo">Monto fijo $</option></select></div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ ...S.label, marginTop: 0 }}>IVA</label>
                  <select value={ivaMode} onChange={e => setQf({ ...qf, iva_mode: e.target.value })} style={S.input}>
                    <option value="sin">Sin IVA</option>
                    <option value="suma">Sumar IVA 16% al total</option>
                    <option value="incluido">IVA incluido en precios</option>
                  </select>
                </div>
                {ivaMode !== 'sin' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 4 }}>
                    <span>{ivaMode === 'incluido' ? 'IVA incluido' : 'IVA (16%)'}</span>
                    <span>{fmt(ivaMonto)}</span>
                  </div>
                )}
                {ivaMode === 'incluido' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#999', marginBottom: 4 }}>
                    <span>Subtotal sin IVA</span>
                    <span>{fmt(afterDisc / 1.16)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem', fontWeight: 800, borderTop: '2px solid #1a1a1a', paddingTop: 8, marginTop: 4 }}>
                  <span>Total</span><span style={{ color: '#2AB5A0' }}>{fmt(grandTotal)} {qf.moneda}</span>
                </div>
              </div>

              {/* ── Parcialidades ──
                  Cuando se pacta en pagos, las FECHAS se acuerdan al cotizar, no
                  después: son parte del trato. Guardarlas aquí es lo que permite
                  saber qué debería entrar cada mes y cobrar a tiempo, en vez de
                  descubrir el vencimiento cuando ya pasó. */}
              {(() => {
                const plan: any[] = Array.isArray(qf.plan_pagos) ? qf.plan_pagos : [];
                const setPlan = (p: any[]) => setQf({ ...qf, plan_pagos: p });
                const sumado = plan.reduce((a, x) => a + (Number(x.monto) || 0), 0);
                const totalQ = Number(qf.total || 0);
                const fin = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
                return (
                  <div style={{ marginTop: 12, background: '#fafbfd', border: '1px solid #e8eaf0', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <label style={{ ...S.label, marginTop: 0, marginBottom: 0, flex: 1 }}>Plan de pagos (parcialidades)</label>
                      <button onClick={() => setPlan([...plan, { id: 'p' + Date.now().toString(36) + plan.length, fecha: fin(plan.length), monto: '', concepto: plan.length === 0 ? 'Anticipo' : `Parcialidad ${plan.length + 1}` }])}
                        style={{ ...S.btnSmall, marginRight: 0 }}>+ Parcialidad</button>
                      {plan.length === 0 && totalQ > 0 && (
                        <button onClick={() => setPlan([
                          { id: 'p1', fecha: fin(0), monto: Math.round(totalQ / 2), concepto: 'Anticipo 50%' },
                          { id: 'p2', fecha: fin(1), monto: totalQ - Math.round(totalQ / 2), concepto: 'Liquidación 50%' },
                        ])} style={{ ...S.btnSmall, marginRight: 0 }}>50 / 50</button>
                      )}
                    </div>
                    {plan.length === 0 ? (
                      <div style={{ fontSize: '0.7rem', color: '#999' }}>Sin parcialidades: se cobra en un solo pago.</div>
                    ) : plan.map((x: any, i: number) => (
                      <div key={x.id || i} style={{ display: 'flex', gap: 6, marginBottom: 5, alignItems: 'center' }}>
                        <input value={x.concepto || ''} onChange={e => setPlan(plan.map((y, j) => j === i ? { ...y, concepto: e.target.value } : y))}
                          placeholder="concepto" style={{ ...S.input, flex: 1, fontSize: '0.75rem', padding: '6px 8px' }} />
                        <input type="date" value={x.fecha || ''} onChange={e => setPlan(plan.map((y, j) => j === i ? { ...y, fecha: e.target.value } : y))}
                          style={{ ...S.input, width: 140, fontSize: '0.75rem', padding: '6px 8px' }} />
                        <input type="number" value={x.monto} onChange={e => setPlan(plan.map((y, j) => j === i ? { ...y, monto: e.target.value } : y))}
                          placeholder="monto" style={{ ...S.input, width: 110, fontSize: '0.75rem', padding: '6px 8px' }} />
                        <button onClick={() => setPlan(plan.filter((_, j) => j !== i))} style={{ ...S.btnSmall, marginRight: 0, color: '#b93333' }}>✕</button>
                      </div>
                    ))}
                    {plan.length > 0 && (
                      /* El descuadre se avisa, no se corrige solo: puede ser
                         intencional (un saldo que se define después) y ajustar
                         a la fuerza cambiaría lo pactado sin avisar. */
                      <div style={{ fontSize: '0.7rem', marginTop: 4, color: Math.abs(sumado - totalQ) < 1 ? '#2e7d32' : '#b45309' }}>
                        Suman {fmt(sumado)} de {fmt(totalQ)}
                        {Math.abs(sumado - totalQ) >= 1 ? ` · faltan ${fmt(totalQ - sumado)} por repartir` : ' · cuadra'}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Plantilla ──
                  Escondida en un <select> junto a la moneda, nadie la cambiaba:
                  no se veía qué hacía cada una. Aquí se elige viendo el nombre y
                  para qué sirve, y la vista previa de la derecha cambia al
                  instante. */}
              <div style={{ marginBottom: 14 }}>
                <div style={S.label}>Plantilla</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  {[
                    { id: 'modern', n: 'Moderna', d: 'Color de marca y contador. La de siempre.' },
                    { id: 'dark', n: 'Oscura', d: 'La misma, en fondo negro.' },
                    { id: 'interactiva', n: 'Interactiva', d: 'El cliente elige entre 2–3 opciones.' },
                    { id: 'ejecutiva', n: 'Ejecutiva', d: 'Una pantalla: problema, número y arranque.' },
                  ].map(t => {
                    const on = (qf.template || 'modern') === t.id;
                    return (
                      <button key={t.id} onClick={() => setQf({ ...qf, template: t.id })}
                        style={{ textAlign: 'left' as const, cursor: 'pointer', borderRadius: 9, padding: '9px 11px',
                          border: '1.5px solid', borderColor: on ? '#1a1a1a' : '#e2e2e8', background: on ? '#1a1a1a' : '#fff' }}>
                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: on ? '#fff' : '#1a1a1a' }}>{t.n}</div>
                        <div style={{ fontSize: '0.65rem', color: on ? 'rgba(255,255,255,.6)' : '#9a9a9a', marginTop: 1, lineHeight: 1.35 }}>{t.d}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Config */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div><label style={S.label}>Moneda</label><select value={qf.moneda} onChange={e => setQf({ ...qf, moneda: e.target.value })} style={S.input}><option value="MXN">MXN</option><option value="USD">USD</option></select></div>
                <div />
              </div>

              {/* Promo label */}
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Etiqueta de promoción <span style={{ color: '#999', fontWeight: 400 }}>(opcional)</span></label>
                <input
                  value={qf.promo_label || ''}
                  onChange={e => setQf({ ...qf, promo_label: e.target.value.toUpperCase().slice(0, 40) })}
                  placeholder="Ej. VERANO -20%, OFERTA MAYO, FUNDADORES SACS"
                  style={S.input}
                />
                <div style={{ fontSize: '0.6875rem', color: '#999', marginTop: 4 }}>
                  Aparece junto al contador en la cotización del cliente. Máx. 40 caracteres.
                </div>
              </div>

              {/* Alta rápida de cuenta: salir a Configuración a medio cotizar
                  es la razón por la que la cotización se manda sin datos de pago. */}
              {altaBanco && (
                <div style={{ background: '#fafbfd', border: '1px dashed #cfd6e4', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#666', marginBottom: 8 }}>Nueva cuenta bancaria</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input value={altaBanco.alias} onChange={e => setAltaBanco({ ...altaBanco, alias: e.target.value })} placeholder="Alias — ej. BBVA pesos" style={S.input} />
                    <input value={altaBanco.banco} onChange={e => setAltaBanco({ ...altaBanco, banco: e.target.value })} placeholder="Banco *" style={S.input} />
                    <input value={altaBanco.titular} onChange={e => setAltaBanco({ ...altaBanco, titular: e.target.value })} placeholder="Titular" style={S.input} />
                    <input value={altaBanco.cuenta} onChange={e => setAltaBanco({ ...altaBanco, cuenta: e.target.value })} placeholder="Cuenta" style={S.input} />
                    <input value={altaBanco.clabe} onChange={e => setAltaBanco({ ...altaBanco, clabe: e.target.value })} placeholder="CLABE" style={S.input} />
                    <input value={altaBanco.rfc} onChange={e => setAltaBanco({ ...altaBanco, rfc: e.target.value })} placeholder="RFC" style={S.input} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={async () => {
                      if (!altaBanco.banco.trim()) { alert('El banco es obligatorio.'); return; }
                      const r = await fetch('/api/revenue/bank-accounts', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...altaBanco, activa: true, es_default: bankAccounts.length === 0 }),
                      }).then(x => x.json()).catch(() => null);
                      if (!r?.id) { alert('No se pudo guardar la cuenta.'); return; }
                      setBankAccounts([...bankAccounts, r]);
                      // Se selecciona sola: se dio de alta para usarla ahora.
                      setQf({ ...qf, bank_account_id: r.id, mostrar_banco: true });
                      setAltaBanco(null);
                    }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', padding: '6px 14px', fontSize: '0.78rem' }}>Guardar y usar</button>
                    <button onClick={() => setAltaBanco(null)} style={{ ...S.btnSmall, marginRight: 0 }}>Cancelar</button>
                  </div>
                </div>
              )}

              {/* Bank account */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={S.label}>Cuenta bancaria</label>
                  <select value={qf.bank_account_id || ''} onChange={e => setQf({ ...qf, bank_account_id: e.target.value || null, mostrar_banco: !!e.target.value })} style={S.input}>
                    <option value="">Sin cuenta bancaria</option>
                    {/* El alias primero: con dos cuentas del mismo banco, "BBVA
                        - 1234" y "BBVA - 5678" no se distinguen de un vistazo. */}
                    {bankAccounts.map((ba: any) => (
                      <option key={ba.id} value={ba.id}>
                        {ba.alias ? `${ba.alias} · ` : ''}{ba.banco}{ba.cuenta ? ` - ${ba.cuenta}` : ''}{ba.es_default ? ' (predeterminada)' : ''}
                      </option>
                    ))}
                  </select>
                  {bankAccounts.length === 0 ? (
                    // Antes solo decía "Sin cuenta bancaria" y parecía roto. No
                    // lo está: no hay ninguna capturada.
                    <button onClick={() => setAltaBanco({ banco: '', alias: '', titular: '', cuenta: '', clabe: '', rfc: '' })}
                      style={{ ...S.btnSmall, marginTop: 6, marginRight: 0, width: '100%' }}>
                      No hay cuentas capturadas · + Agregar una
                    </button>
                  ) : (
                    <button onClick={() => setAltaBanco({ banco: '', alias: '', titular: '', cuenta: '', clabe: '', rfc: '' })}
                      style={{ border: 'none', background: 'none', color: '#3764c4', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, padding: '4px 0 0' }}>
                      + Agregar cuenta
                    </button>
                  )}
                </div>
                <div>
                  <label style={S.label}>Vigencia</label>
                  <select value={qf.urgencia || 'normal'} onChange={e => {
                    const v = e.target.value;
                    const daysMap: Record<string, number> = { normal: 15, urgente: 5, oferta: 3 };
                    const days = daysMap[v];
                    if (days) {
                      const date = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
                      setQf({ ...qf, urgencia: v, vigencia: date });
                    } else {
                      setQf({ ...qf, urgencia: v });
                    }
                  }} style={S.input}>
                    <option value="normal">Normal (15 dias)</option>
                    <option value="urgente">Urgente (5 dias)</option>
                    <option value="oferta">Oferta limitada (3 dias)</option>
                    <option value="custom">Personalizada</option>
                  </select>
                </div>
              </div>

              {/* Custom vigencia */}
              {qf.urgencia === 'custom' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label style={S.label}>Dias de vigencia</label>
                    <input type="number" min="1" placeholder="Ej. 30" value={qf._custom_days || ''} onChange={e => {
                      const days = parseInt(e.target.value) || 0;
                      const date = days > 0 ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10) : '';
                      setQf({ ...qf, _custom_days: e.target.value, vigencia: date });
                    }} style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>O fecha exacta</label>
                    <input type="date" value={qf.vigencia || ''} onChange={e => {
                      const date = e.target.value;
                      const days = date ? Math.ceil((new Date(date).getTime() - Date.now()) / 86400000) : 0;
                      setQf({ ...qf, vigencia: date, _custom_days: days > 0 ? String(days) : '' });
                    }} style={S.input} />
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.6875rem', color: '#999', marginTop: -8, marginBottom: 12 }}>
                  Vence: {fmtDate(qf.vigencia)}
                </div>
              )}

              {/* Link de pago */}
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Link de pago</label>
                <select value={qf._pago_mode || (qf.link_pago ? 'manual' : 'none')} onChange={e => {
                  const v = e.target.value;
                  if (v === 'none') setQf({ ...qf, _pago_mode: v, link_pago: '' });
                  else setQf({ ...qf, _pago_mode: v });
                }} style={S.input}>
                  <option value="none">Sin link de pago</option>
                  <option value="stripe">Stripe (automatico)</option>
                  <option value="manual">Link manual</option>
                </select>
                {(qf._pago_mode || (qf.link_pago ? 'manual' : 'none')) === 'manual' && (
                  <input value={qf.link_pago || ''} onChange={e => setQf({ ...qf, link_pago: e.target.value })} placeholder="https://..." style={{ ...S.input, marginTop: 6 }} />
                )}
                {(qf._pago_mode || '') === 'stripe' && (
                  <div style={{ fontSize: '0.6875rem', color: '#4B7BE5', marginTop: 6 }}>
                    Se generara un link de Stripe Checkout al guardar la cotización
                  </div>
                )}
              </div>

              {/* Visibility toggles */}
              <div style={{ marginBottom: 12 }}>
                {/* ── Mostrar en cotización ──
                    Trece casillas en fila hacían que ninguna se leyera. Arriba
                    quedan las tres que sí se deciden por cliente; el resto vive
                    detrás de "Ver más" porque se pone una vez y no se vuelve a
                    tocar. */}
                <div style={S.label}>Mostrar en cotización</div>
                {(() => {
                  const OPCIONES = [
                    { key: 'mostrar_timer', label: 'Contador de tiempo (urgencia)', default: true, principal: true },
                    { key: 'mostrar_features', label: 'Detalle del plan (qué incluye)', default: true, principal: true },
                    { key: 'mostrar_firma', label: 'Firma digital', default: true, principal: true },
                    { key: 'mostrar_desglose', label: 'Resumen de pagos', default: true },
                    { key: 'mostrar_condiciones', label: 'Condiciones', default: true },
                    { key: 'mostrar_key_points', label: 'Minuta de la reunión', default: true },
                    { key: 'mostrar_roi', label: 'Calculadora de ROI', default: false },
                    { key: 'mostrar_antes_despues', label: 'Antes vs Después', default: false },
                    { key: 'mostrar_timeline', label: 'Timeline de implementación', default: true },
                    { key: 'mostrar_implementacion', label: 'Proceso de implementación', default: true },
                    { key: 'mostrar_porque_sacs', label: '¿Por qué SACS? (historia, casos de éxito)', default: true },
                    { key: 'mostrar_qr', label: 'Código QR', default: true },
                    { key: 'mostrar_animaciones', label: 'Números animados', default: true },
                  ];
                  const val = (o: any) => (qf[o.key] !== undefined ? qf[o.key] : o.default);
                  const secundarias = OPCIONES.filter(o => !o.principal);
                  // Cuántas de las de abajo están apagadas: si alguien las movió,
                  // hay que poder verlo sin abrir el bloque.
                  const apagadas = secundarias.filter(o => !val(o)).length;
                  const fila = (o: any) => (
                    <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: '#555', cursor: 'pointer' }}>
                      <input type="checkbox" checked={val(o)} onChange={e => setQf({ ...qf, [o.key]: e.target.checked })} />
                      {o.label}
                    </label>
                  );
                  return (
                    <div style={{ background: '#f8f9fb', borderRadius: 8, padding: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                        {OPCIONES.filter(o => o.principal).map(fila)}
                      </div>
                      <button onClick={() => setVerMasOpc(!verMasOpc)}
                        style={{ border: 'none', background: 'none', color: '#3764c4', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, padding: '8px 0 0' }}>
                        {verMasOpc ? 'Ver menos' : `Ver más (${secundarias.length})`}
                        {!verMasOpc && apagadas > 0 && <span style={{ color: '#b45309', fontWeight: 600 }}> · {apagadas} apagada{apagadas === 1 ? '' : 's'}</span>}
                      </button>
                      {verMasOpc && (
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid #ecedf1' }}>
                          {secundarias.map(fila)}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* Timeline type selector */}
                {(qf.mostrar_timeline !== undefined ? qf.mostrar_timeline : true) && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ ...S.label, marginTop: 0 }}>Tipo de timeline</label>
                    <select value={qf.timeline_tipo || '1suc'} onChange={e => setQf({ ...qf, timeline_tipo: e.target.value })} style={S.input}>
                      <option value="1suc">1 sucursal — Arrancando su primera tienda</option>
                      <option value="2a5suc">2–5 sucursales — Creciendo y necesita orden</option>
                      <option value="5massuc">5+ sucursales — Operación compleja, automatización</option>
                    </select>
                  </div>
                )}
              </div>

              {/* ── Condiciones ──
                  El texto vivía escrito a mano en cada cotización, así que cada
                  quien mandaba su versión. Ahora se elige una plantilla y el
                  texto queda COPIADO en la cotización: cambiar la plantilla
                  después no altera lo que un cliente ya recibió. */}
              <div>
                <label style={S.label}>Condiciones</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' as const }}>
                  {condicionesTpl.map((t: any) => (
                    <button key={t.id} onClick={() => setQf({ ...qf, condiciones: t.texto })}
                      title={t.texto}
                      style={{ border: '1px solid', borderColor: qf.condiciones === t.texto ? '#1a1a1a' : '#dcdce2',
                        background: qf.condiciones === t.texto ? '#1a1a1a' : '#fff', color: qf.condiciones === t.texto ? '#fff' : '#555',
                        borderRadius: 20, padding: '4px 12px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                      {t.nombre}{t.es_default ? ' ·' : ''}
                    </button>
                  ))}
                  <button onClick={async () => {
                    const texto = (qf.condiciones || '').trim();
                    if (texto.length < 10) { alert('Escribe primero las condiciones que quieres guardar.'); return; }
                    const nombre = prompt('Nombre de la plantilla:', '');
                    if (!nombre?.trim()) return;
                    const r = await fetch('/api/revenue/condiciones', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ nombre: nombre.trim(), texto }),
                    }).then(x => x.json()).catch(() => null);
                    if (r?.id) setCondicionesTpl([...condicionesTpl, r]);
                    else alert(r?.error || 'No se pudo guardar la plantilla.');
                  }} style={{ border: 'none', background: 'none', color: '#3764c4', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}>
                    Guardar esta como plantilla
                  </button>
                </div>
                <textarea value={qf.condiciones || ''} onChange={e => setQf({ ...qf, condiciones: e.target.value })} style={{ ...S.input, height: 60 }} />
              </div>

              {/* ── Calculadora de ROI ──
                  Antes eran cuatro campos de texto y lo único automático era
                  multiplicar por 12; nadie la usaba porque inventar el número
                  cuesta más que capturarlo. Ahora se capturan tres datos que el
                  cliente ya dijo y la plantilla del plan hace el resto. */}
              {qf.mostrar_roi && (() => {
                const planesCotizados = Array.from(new Set(items.filter((i: any) => i.tipo === 'plan').map((i: any) => i.nombre)))
                  .filter((p: any) => !PLANES_SIN_PLANTILLA.includes(p)) as string[];
                const r = qf.roi || {};
                // Los drivers se guardan en la cotización: si mañana cambian las
                // plantillas, una cotización vieja sigue explicando SU número.
                const drivers: Driver[] = Array.isArray(r.drivers) && r.drivers.length ? r.drivers : driversParaPlanes(planesCotizados);
                const entradas = {
                  ventas_mes: r.ventas_mes, costo_hora: r.costo_hora || costoHoraParaPlanes(planesCotizados),
                  stock_valor: r.stock_valor, compras_mes: r.compras_mes,
                  clientes_activos: r.clientes_activos, ticket_promedio: r.ticket_promedio,
                };
                const calc = calcularRoi(entradas, drivers);
                const setRoi = (patch: any) => {
                  // Se recalcula y se guarda el resultado: la vista previa y la
                  // cotización del cliente leen ahorro_mensual, no los drivers.
                  const c2 = calcularRoi({ ...entradas, ...patch }, drivers);
                  setQf({ ...qf, roi: { ...r, drivers, ...patch, ahorro_mensual: c2.mensual } });
                };
                const setDriver = (i: number, patch: any) => {
                  const ds = drivers.map((d, j) => j === i ? { ...d, ...patch } : d);
                  const c2 = calcularRoi(entradas, ds);
                  setQf({ ...qf, roi: { ...r, drivers: ds, ahorro_mensual: c2.mensual } });
                };
                // Contra el costo RECURRENTE, no contra el total: la
                // implementación es un pago único y mezclarla infla los días.
                const mensualPlan = items.filter((i: any) => i.tipo === 'plan' && !i.es_promocion)
                  .reduce((a: number, i: any) => a + (Number(i.subtotal) || 0) / (i.periodo === 'anual' ? 12 : 1), 0);
                const pb = payback(calc.mensual, mensualPlan);
                const necesitaVentas = drivers.some(d => d.on && ['pct_ventas'].includes(d.tipo)) && !(Number(r.ventas_mes) > 0);

                return (
                  <div style={{ marginTop: 12 }}>
                    <div style={S.label}>Calculadora de ROI</div>
                    {planesCotizados.length === 0 ? (
                      <div style={{ fontSize: '0.72rem', color: '#8a6212', background: '#fff8ec', border: '1px solid #f5e2b8', borderRadius: 8, padding: '9px 11px' }}>
                        Agrega un plan a los conceptos y aquí aparece su plantilla de ahorros.
                        Los planes a la medida y la póliza de soporte no traen plantilla: se venden por alcance.
                      </div>
                    ) : (
                      <div style={{ background: '#f8f9fb', borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: '0.7rem', color: '#5b30c4', background: '#f4efff', borderRadius: 6, padding: '6px 9px', marginBottom: 10 }}>
                          Plantilla: <b>{planesCotizados.map(p => PLANTILLAS_ROI[p]?.titulo || p).join(' + ')}</b> — se eligió por el plan cotizado
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Ventas al mes ($)</label>
                            <input type="number" value={r.ventas_mes || ''} onChange={e => setRoi({ ventas_mes: parseFloat(e.target.value) || 0 })} placeholder="Ej. 600000" style={{ ...S.input, borderColor: necesitaVentas ? '#fca5a5' : undefined }} /></div>
                          <div><label style={{ ...S.label, marginTop: 0 }}>Costo de la hora ($)</label>
                            <input type="number" value={entradas.costo_hora} onChange={e => setRoi({ costo_hora: parseFloat(e.target.value) || 0 })} style={S.input} /></div>
                          {drivers.some(d => d.on && d.tipo === 'pct_stock') && (
                            <div><label style={{ ...S.label, marginTop: 0 }}>Valor del inventario ($)</label>
                              <input type="number" value={r.stock_valor || ''} onChange={e => setRoi({ stock_valor: parseFloat(e.target.value) || 0 })} style={S.input} /></div>
                          )}
                          {drivers.some(d => d.on && d.tipo === 'pct_compras') && (
                            <div><label style={{ ...S.label, marginTop: 0 }}>Compras al mes ($)</label>
                              <input type="number" value={r.compras_mes || ''} onChange={e => setRoi({ compras_mes: parseFloat(e.target.value) || 0 })} style={S.input} /></div>
                          )}
                          {drivers.some(d => d.on && d.tipo === 'clientes_dormidos') && (<>
                            <div><label style={{ ...S.label, marginTop: 0 }}>Clientes activos</label>
                              <input type="number" value={r.clientes_activos || ''} onChange={e => setRoi({ clientes_activos: parseFloat(e.target.value) || 0 })} style={S.input} /></div>
                            <div><label style={{ ...S.label, marginTop: 0 }}>Ticket promedio ($)</label>
                              <input type="number" value={r.ticket_promedio || ''} onChange={e => setRoi({ ticket_promedio: parseFloat(e.target.value) || 0 })} style={S.input} /></div>
                          </>)}
                        </div>

                        <div style={{ ...S.label, marginTop: 4 }}>De dónde sale el ahorro</div>
                        {drivers.map((d, i) => {
                          const ren = calc.renglones.find(x => x.key === d.key);
                          return (
                            <div key={d.key} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 92px', gap: 6, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f0f1f4', opacity: d.on ? 1 : 0.45 }}>
                              <label style={{ fontSize: '0.73rem', display: 'flex', gap: 6, alignItems: 'flex-start', cursor: 'pointer' }}>
                                <input type="checkbox" checked={d.on} onChange={e => setDriver(i, { on: e.target.checked })} style={{ marginTop: 3 }} />
                                <span>{d.label}<small style={{ display: 'block', color: '#9a9a9a', fontSize: '0.66rem' }}>{d.detalle}</small></span>
                              </label>
                              <input type="number" step="0.1" value={d.valor} onChange={e => setDriver(i, { valor: parseFloat(e.target.value) || 0 })}
                                title={d.tipo === 'horas' ? 'Horas al mes' : 'Porcentaje'}
                                style={{ ...S.input, textAlign: 'center' as const, fontSize: '0.72rem', padding: '5px 4px' }} />
                              <div style={{ textAlign: 'right' as const, fontWeight: 800, color: ren ? '#1A8F7A' : '#ccc', fontSize: '0.75rem' }}>
                                {ren ? fmt(ren.monto) : '—'}
                              </div>
                            </div>
                          );
                        })}

                        <div style={{ display: 'flex', gap: 20, background: '#f4f2f8', borderRadius: 9, padding: '11px 13px', marginTop: 10 }}>
                          <div><div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: '#8a8a8a' }}>Ahorro al mes</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7C3AED' }}>{fmt(calc.mensual)}</div></div>
                          <div><div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: '#8a8a8a' }}>Al año</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{fmt(calc.anual)}</div></div>
                          {pb && (<div><div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: '#8a8a8a' }}>Se paga en</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{pb}</div></div>)}
                        </div>

                        {necesitaVentas && (
                          // Preferible no mostrar ROI que mostrar uno inventado:
                          // el dato es del cliente y hay que preguntarlo.
                          <div style={{ fontSize: '0.7rem', color: '#b45309', marginTop: 8 }}>
                            Falta cuánto vende al mes. Sin ese dato el bloque no se imprime en la cotización.
                          </div>
                        )}
                        <div style={{ marginTop: 8 }}>
                          <label style={{ ...S.label, marginTop: 0 }}>Problema del cliente (opcional)</label>
                          <input value={r.problema || ''} onChange={e => setRoi({ problema: e.target.value })} placeholder="Ej. Pierden 200 piezas al mes por falta de control" style={{ ...S.input, fontSize: '0.72rem' }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Antes/Después editor */}
              {qf.mostrar_antes_despues && (
                <div style={{ marginTop: 12 }}>
                  <div style={S.label}>Antes vs Después</div>
                  {(qf.antes_despues || []).map((row: any, i: number) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 4, marginBottom: 4 }}>
                      <input value={row.aspecto || ''} onChange={e => { const a = [...(qf.antes_despues || [])]; a[i] = { ...a[i], aspecto: e.target.value }; setQf({ ...qf, antes_despues: a }); }} placeholder="Aspecto" style={{ ...S.input, fontSize: '0.6875rem' }} />
                      <input value={row.antes || ''} onChange={e => { const a = [...(qf.antes_despues || [])]; a[i] = { ...a[i], antes: e.target.value }; setQf({ ...qf, antes_despues: a }); }} placeholder="Hoy" style={{ ...S.input, fontSize: '0.6875rem', color: '#ccc' }} />
                      <input value={row.despues || ''} onChange={e => { const a = [...(qf.antes_despues || [])]; a[i] = { ...a[i], despues: e.target.value }; setQf({ ...qf, antes_despues: a }); }} placeholder="Con SACS" style={{ ...S.input, fontSize: '0.6875rem' }} />
                      <button onClick={() => { const a = [...(qf.antes_despues || [])]; a.splice(i, 1); setQf({ ...qf, antes_despues: a }); }} style={{ ...S.btnSmall, color: '#E54B4B' }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => setQf({ ...qf, antes_despues: [...(qf.antes_despues || []), { aspecto: '', antes: '', despues: '' }] })} style={S.btnSmall}>+ Agregar fila</button>
                </div>
              )}

              {/* Timeline */}
              {qf.id && (() => {
                const { meta } = parseMeta(qf.notas);
                const timeline = meta.timeline || [];
                const views = meta.views || 0;
                const eventLabels: Record<string, string> = { created: 'Creada', sent: 'Enviada', viewed: 'Vista', accepted: 'Aceptada', paid: 'Pagada', comment: 'Comentario', reply: 'Respuesta', edited: 'Editada' };
                const eventColors: Record<string, string> = { created: '#999', sent: '#4B7BE5', viewed: '#6C5CE7', accepted: '#2AB5A0', paid: '#2e7d32', comment: '#E8A838', reply: '#4B7BE5', edited: '#E8A838' };
                // Deduplicate: show only first occurrence of each event type (except viewed which shows count)
                const uniqueEvents: any[] = [];
                const seen = new Set<string>();
                for (const t of timeline) {
                  if (t.event === 'viewed') {
                    if (!seen.has('viewed')) { uniqueEvents.push({ ...t, count: views }); seen.add('viewed'); }
                  } else {
                    if (!seen.has(t.event)) { uniqueEvents.push(t); seen.add(t.event); }
                  }
                }
                return uniqueEvents.length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    <div style={S.label}>Historial</div>
                    <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 12 }}>
                      {uniqueEvents.map((t: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < uniqueEvents.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: eventColors[t.event] || '#ccc', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1a1a1a' }}>
                              {eventLabels[t.event] || t.event}
                              {t.event === 'viewed' && t.count > 1 && <span style={{ color: '#6C5CE7', marginLeft: 4 }}>({t.count} veces)</span>}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.625rem', color: '#aaa' }}>{fmtDate(t.at)} {new Date(t.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Comments */}
              {qf.id && (() => {
                const { meta } = parseMeta(qf.notas);
                const comments = meta.comments || [];
                return comments.length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    <div style={S.label}>Comentarios del cliente ({comments.length})</div>
                    <div style={{ background: '#f8f9fb', borderRadius: 10, padding: 12, maxHeight: 240, overflowY: 'auto' as const }}>
                      {comments.map((c: any, i: number) => (
                        <div key={i} style={{ marginBottom: 12, padding: '8px 10px', background: c.from === 'admin' ? '#f0f0f0' : '#fff', borderRadius: 8, border: '1px solid #eee' }}>
                          <div style={{ fontSize: '0.8125rem', color: '#333', lineHeight: 1.5, whiteSpace: 'pre-wrap' as const }}>{c.text}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: c.from === 'admin' ? '#2AB5A0' : '#999', textTransform: 'uppercase' as const }}>{c.from === 'admin' ? 'Sacs' : c.name || 'Cliente'}</span>
                            <span style={{ fontSize: '0.5625rem', color: '#ccc' }}>{fmtDate(c.at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <input id="admin-reply-input" placeholder="Responder al cliente..." style={{ ...S.input, flex: 1, fontSize: '0.75rem' }} onKeyDown={(e: any) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('btn-admin-reply')?.click(); } }} />
                      <button id="btn-admin-reply" onClick={async () => {
                        const input = document.getElementById('admin-reply-input') as HTMLInputElement;
                        const text = input?.value.trim();
                        if (!text) return;
                        await fetch('/api/revenue/quote-comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: qf.id, from: 'admin', name: 'Sacs', text }) });
                        input.value = '';
                        const res = await fetch(`/api/revenue/quotes?id=${qf.id}`).then(r => r.json());
                        setQf({ ...qf, notas: res.notas, items: Array.isArray(qf.items) ? qf.items : [] });
                      }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', fontSize: '0.75rem', padding: '6px 14px' }}>Enviar</button>
                    </div>
                  </div>
                ) : null;
              })()}

            </div>
            {/* Right: Preview */}
            <div className={`rh-quote-preview rh-prev-${qf.template || 'modern'}`} style={{ flex: 1, overflowY: 'auto' as const, padding: 32 }}>
              {/* La vista previa se viste igual que el documento real: si aquí se
                  ve de otra forma, se diseña a ciegas. */}
              <div className="rh-doc" style={{ width: '100%', maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(16,24,40,.06), 0 14px 36px rgba(16,24,40,.10)', overflow: 'hidden' }}>
                <div style={{ height: 4, background: 'linear-gradient(90deg,#9B8CFA 0%,#7DA6F5 55%,rgba(244,168,205,.9) 100%)' }} />
                {/* Preview Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '24px 30px 18px', borderBottom: '1px solid #f0eff3', background: '#fcfbfe' }}>
                  <div>
                    <div style={{ fontFamily: "'Clash Display',sans-serif", fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-.01em' }}>Sacs</div>
                    <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#9c3d70', textTransform: 'uppercase' as const, letterSpacing: '0.11em', marginTop: 3 }}>Cotización</div>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#3f3b4d' }}>{qf.numero || 'COT-XXX'}</div>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Vigencia: {fmtDate(qf.vigencia)}</div>
                  </div>
                </div>

                {/* Preview Client */}
                <div style={{ padding: '15px 30px', borderBottom: '1px solid #f0eff3' }}>
                  <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Cotización para</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#16181d', marginTop: 4 }}>{qf.empresa || 'Empresa'}</div>
                  {qf.contacto && <div style={{ fontSize: '0.74rem', color: '#6b7280' }}>{qf.contacto}</div>}
                  {qf.email && <div style={{ fontSize: '0.74rem', color: '#6b7280' }}>{qf.email}</div>}
                </div>

                {/* Encabezado de la plantilla Ejecutiva, también en la vista
                    previa: elegir plantilla sin ver el cambio es elegir a ciegas. */}
                {qf.template === 'ejecutiva' && (
                  <div style={{ margin: '0 32px 14px', border: '1px solid #e6e6ea', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ background: '#0f7a56', color: '#fff', padding: '7px 11px', fontSize: '0.6rem', fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Recomendación</span>
                      <span>{(() => { const pl = items.find((i: any) => i.tipo === 'plan' && !i.es_promocion); return pl ? `Plan ${String(pl.nombre || '').replace(/_/g, ' ')}` : 'Propuesta SACS'; })()}</span>
                    </div>
                    <div style={{ padding: 11 }}>
                      {qf.roi?.problema && <div style={{ fontSize: '0.58rem', color: '#666', marginBottom: 8, lineHeight: 1.5 }}>{qf.roi.problema}</div>}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: 6 }}>
                        {[
                          ['Inversión mensual', fmt(items.filter((i: any) => i.tipo === 'plan' && !i.es_promocion).reduce((a: number, i: any) => a + (Number(i.subtotal) || 0) / (i.periodo === 'anual' ? 12 : 1), 0)), '#1a1a1a'],
                          ...(qf.roi?.ahorro_mensual > 0 ? [['Ahorro estimado', fmt(qf.roi.ahorro_mensual), '#0f7a56']] : []),
                          ['Arranque', qf.timeline_tipo === '5massuc' ? '4 semanas' : qf.timeline_tipo === '2a5suc' ? '3 semanas' : '2 semanas', '#1a1a1a'],
                        ].map(([k, v, c]: any) => (
                          <div key={k} style={{ background: '#f7f8fa', borderRadius: 7, padding: 7 }}>
                            <div style={{ fontSize: '0.46rem', color: '#9a9a9a', textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>{k}</div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: c }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Las opciones, cuando la cotización las ofrece */}
                {paquetesOn && (
                  <div style={{ margin: '0 32px 14px', display: 'flex', gap: 6 }}>
                    {paquetes.map((p: any, i: number) => (
                      <div key={p.id} style={{ flex: 1, border: '2px solid', borderColor: i === 0 ? '#7C3AED' : '#e5e5e5', background: i === 0 ? '#7C3AED' : '#fff', color: i === 0 ? '#fff' : '#1a1a1a', borderRadius: 9, padding: '8px 9px' }}>
                        <div style={{ fontSize: '0.55rem', opacity: 0.75 }}>{p.nombre}</div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800 }}>{fmt(totalDePaquete(p.id))}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Contador. Vivía solo en la cotización real: se prendía la
                    casilla y en la vista previa no pasaba nada, así que parecía
                    que el interruptor estaba muerto. */}
                {(qf.mostrar_timer !== false) && (
                  <div className="rh-warn" style={{ margin: '14px 30px 0', background: '#FEF6E7', border: '1px solid #f5e2b8', borderRadius: 10, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#9a6a10' }}>
                      {/* daysUntil devuelve Infinity cuando no hay fecha —no null—,
                          y por eso la vista previa decía "Faltan Infinity días". */}
                      {(() => {
                        const d = daysUntil(qf.vigencia);
                        if (!Number.isFinite(d)) return 'Vigencia por definir';
                        const n = Math.ceil(d);
                        return n < 0 ? 'Vigencia vencida' : n === 0 ? 'Vence hoy' : `Faltan ${n} día${n === 1 ? '' : 's'}`;
                      })()}
                    </span>
                    <span style={{ fontSize: '0.66rem', color: '#b08a4a' }}>· cuenta regresiva en vivo para el cliente</span>
                  </div>
                )}

                {/* Preview Key Points */}
                {(qf.key_points || []).length > 0 && (qf.mostrar_key_points !== false) && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Minuta de la reunión</div>
                    {qf.key_points.map((kp: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', alignItems: 'flex-start' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}><path d="M20 6L9 17l-5-5" stroke="#4B7BE5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <div>
                          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#1a1a1a' }}>{kp.title}</div>
                          <div style={{ fontSize: '0.5625rem', color: '#999' }}>{kp.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Preview Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                  <thead>
                    <tr>
                      {['Concepto', 'Detalle', 'Precio', 'Subtotal'].map(h => (
                        <th key={h} style={{ fontSize: '0.5rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#aaa', padding: '8px 12px', textAlign: h === 'Precio' || h === 'Subtotal' ? 'right' as const : 'left' as const, background: '#fafafa', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center' as const, color: '#ddd', fontSize: '0.75rem' }}>Agrega conceptos al formulario</td></tr>}
                    {items.map((item: any, i: number) => {
                      const isP = item.tipo === 'plan';
                      const isPromo = item.es_promocion;
                      const suc = parseInt(item.sucursales) || 1;
                      const isAnn = item.periodo === 'anual';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f5f5f5', background: isPromo ? 'rgba(42,181,160,0.02)' : 'transparent' }}>
                          <td style={{ padding: '10px 12px', fontSize: '0.75rem' }}>
                            {isPromo && <span style={{ display: 'inline-block', fontSize: '0.4375rem', fontWeight: 800, color: '#fff', background: '#2AB5A0', padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase' as const, marginBottom: 2, marginRight: 4 }}>Promo</span>}
                            <strong style={{ color: '#1a1a1a' }}>{isP ? (item.titulo || `Plan ${item.nombre}`) : (item.nombre || '—')}</strong>
                            {isP && <div style={{ fontSize: '0.5625rem', color: '#bbb' }}>{fmt(item.precio_unitario || 0)}/suc × {suc} suc. × {isAnn ? '10 meses' : '1 mes'}</div>}
                            {item.descripcion && <div style={{ fontSize: '0.5625rem', color: '#bbb' }}>{item.descripcion}</div>}
                            {item.nota && <div style={{ fontSize: '0.5625rem', color: '#4B7BE5', fontStyle: 'italic' as const }}>{item.nota}</div>}
                          </td>
                          <td style={{ padding: '10px 8px', fontSize: '0.6875rem', color: '#888' }}>{isPromo ? 'Promo' : isP ? (isAnn ? 'Anual' : 'Mensual') : item.periodo_extra === 'anual' ? 'Anual' : item.recurrente ? 'Mensual' : 'Único'}</td>
                          <td style={{ padding: '10px 8px', fontSize: '0.6875rem', textAlign: 'right' as const, fontWeight: 600 }}>
                            {isPromo ? <span style={{ textDecoration: 'line-through', color: '#ccc' }}>{fmt(item.precio_original || 0)}</span> : fmt(item.precio_unitario || item.monto || 0)}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '0.6875rem', textAlign: 'right' as const, fontWeight: 600 }}>
                            {isPromo ? <span className="rh-money" style={{ color: '#2AB5A0', fontWeight: 800 }}>$0</span> : fmt(item.subtotal || item.monto || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Preview Totals — el total es el ancla del documento y va en
                    lila, como el adeudo del estado de cuenta. En verde diría
                    "pagado", que es justo lo que todavía no pasa. */}
                <div style={{ padding: '14px 30px 4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#6b7280', padding: '4px 0' }}><span>Subtotal</span><span>{fmt(itemsSubtotal)}</span></div>
                  {parseFloat(qf.descuento_global) > 0 && <div className="rh-money" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#1E8A63', padding: '4px 0' }}><span>Descuento</span><span>-{fmt(globalDisc)}</span></div>}
                  {ivaMode !== 'sin' && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#6b7280', padding: '4px 0' }}><span>{ivaMode === 'incluido' ? 'IVA incluido' : 'IVA (16%)'}</span><span>{fmt(ivaMonto)}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, padding: '15px 17px', borderRadius: 12, background: 'linear-gradient(135deg,#EEECFE,rgba(244,168,205,.22))' }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#5B4BD6' }}>
                      Inversión total {ivaMode === 'incluido' ? '· IVA incl.' : ''}
                    </span>
                    <span className="rh-money" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#3f2fb8', letterSpacing: '-.02em' }}>{fmt(grandTotal)} {qf.moneda}</span>
                  </div>
                </div>

                {/* Preview ROI — lo que ve el cliente */}
                {qf.mostrar_roi && qf.roi?.ahorro_mensual > 0 && (() => {
                  const rr = qf.roi || {};
                  const ds: Driver[] = Array.isArray(rr.drivers) ? rr.drivers : [];
                  const c = calcularRoi(rr, ds);
                  const supuestos = textoSupuestos(c.renglones);
                  const mensualPlan = items.filter((i: any) => i.tipo === 'plan' && !i.es_promocion)
                    .reduce((a: number, i: any) => a + (Number(i.subtotal) || 0) / (i.periodo === 'anual' ? 12 : 1), 0);
                  const pb = payback(rr.ahorro_mensual, mensualPlan);
                  return (
                    <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Retorno de inversión estimado</div>
                      {rr.problema && <div style={{ fontSize: '0.5625rem', color: '#999', marginBottom: 8 }}>{rr.problema}</div>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: 10, textAlign: 'center' as const }}>
                          <div className="rh-money" style={{ fontSize: '1.125rem', fontWeight: 800, color: '#2AB5A0' }}>{fmt(rr.ahorro_mensual)}</div>
                          <div style={{ fontSize: '0.4375rem', color: '#999', textTransform: 'uppercase' as const }}>Ahorro mensual</div>
                        </div>
                        <div style={{ flex: 1, background: '#f8f9fb', borderRadius: 8, padding: 10, textAlign: 'center' as const }}>
                          <div className="rh-money" style={{ fontSize: '1.125rem', fontWeight: 800, color: '#2AB5A0' }}>{fmt(rr.ahorro_mensual * 12)}</div>
                          <div style={{ fontSize: '0.4375rem', color: '#999', textTransform: 'uppercase' as const }}>Ahorro anual</div>
                        </div>
                      </div>
                      {pb && (
                        <div style={{ background: '#f4f2f8', borderRadius: 8, padding: 9, textAlign: 'center' as const, marginTop: 8, fontSize: '0.6875rem', fontWeight: 800, color: '#5b30c4' }}>
                          Se paga solo en {pb} de operación
                        </div>
                      )}
                      {/* El supuesto se imprime junto al número. Un ahorro sin
                          decir de dónde sale es lo primero que el cliente pone
                          en duda; con el desglose, se discute — que es lo que
                          se busca que pase en la junta. */}
                      {supuestos && (
                        <div style={{ fontSize: '0.5rem', color: '#999', marginTop: 8, lineHeight: 1.5, borderTop: '1px solid #f4f4f6', paddingTop: 6 }}>
                          <b>Cómo se estima:</b> {supuestos}. Supuestos conservadores, sujetos a la operación real del negocio.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Preview Antes vs Después */}
                {qf.mostrar_antes_despues && (qf.antes_despues || []).length > 0 && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Antes vs Después</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.5625rem' }}>
                      <thead><tr>
                        <th style={{ padding: '4px 6px', textAlign: 'left' as const, color: '#aaa', fontWeight: 600 }}>Aspecto</th>
                        <th style={{ padding: '4px 6px', textAlign: 'center' as const, color: '#ccc', fontWeight: 600 }}>Hoy</th>
                        <th className="rh-money" style={{ padding: '4px 6px', textAlign: 'center' as const, color: '#2AB5A0', fontWeight: 600 }}>Con SACS</th>
                      </tr></thead>
                      <tbody>
                        {(qf.antes_despues || []).map((row: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                            <td style={{ padding: '4px 6px', fontWeight: 700, color: '#1a1a1a' }}>{row.aspecto}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'center' as const, color: '#ccc', textDecoration: 'line-through' }}>{row.antes}</td>
                            <td style={{ padding: '4px 6px', textAlign: 'center' as const, fontWeight: 600 }}>{row.despues}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Preview Payment Breakdown */}
                {(qf.mostrar_desglose !== false) && items.some((i: any) => i.tipo === 'plan') && (() => {
                  const pPlans = items.filter((i: any) => i.tipo === 'plan');
                  const pUnique = items.filter((i: any) => i.tipo === 'extra' && !i.recurrente && !i.es_promocion);
                  const pMonthly = items.filter((i: any) => i.tipo === 'extra' && i.recurrente && i.periodo_extra !== 'anual');
                  const pAnnualPlans = pPlans.filter((i: any) => i.periodo === 'anual');
                  const pMonthlyPlans = pPlans.filter((i: any) => i.periodo === 'mensual');
                  return (
                    <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 8 }}>Resumen de pagos</div>
                      <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, marginBottom: 6, fontSize: '0.625rem' }}>
                        <div style={{ fontWeight: 700, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, fontSize: '0.5rem' }}>Primer pago</div>
                        {pPlans.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>Plan {i.nombre} ({i.periodo})</span><span>{fmt(i.subtotal || 0)}</span></div>)}
                        {pUnique.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>{i.nombre}</span><span>{fmt(i.monto || 0)}</span></div>)}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid #e0e0e0', paddingTop: 4, marginTop: 4 }}><span>Total primer pago</span><span>{fmt(grandTotal)} {qf.moneda}</span></div>
                      </div>
                      {(pMonthlyPlans.length > 0 || pMonthly.length > 0) && (
                        <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, marginBottom: 6, fontSize: '0.625rem' }}>
                          <div style={{ fontWeight: 700, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, fontSize: '0.5rem' }}>Pago mensual recurrente</div>
                          {pMonthlyPlans.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>Plan {i.nombre}</span><span>{fmt(i.subtotal || 0)}</span></div>)}
                          {pMonthly.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>{i.nombre}</span><span>{fmt(i.monto || 0)}</span></div>)}
                        </div>
                      )}
                      {pAnnualPlans.length > 0 && (
                        <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, fontSize: '0.625rem' }}>
                          <div style={{ fontWeight: 700, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4, fontSize: '0.5rem' }}>Renovación anual</div>
                          {pAnnualPlans.map((i: any, idx: number) => <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#666', padding: '2px 0' }}><span>Plan {i.nombre}</span><span>{fmt(i.subtotal || 0)}</span></div>)}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Preview Plan Features */}
                {(qf.mostrar_features !== false) && items.filter((i: any) => i.tipo === 'plan').length > 0 && (() => {
                  const planItems = items.filter((i: any) => i.tipo === 'plan');
                  const features = planItems.map((pi: any) => {
                    const pd = plansData.find(p => p.id === pi.nombre?.toLowerCase());
                    if (!pd) return null;
                    const allF: { category: string; items: string[] }[] = [];
                    let cur: typeof pd | undefined = pd;
                    const visited = new Set<string>();
                    while (cur && !visited.has(cur.id)) {
                      visited.add(cur.id);
                      for (const f of cur.features) { if (typeof f === 'object' && 'category' in f) allF.push(f); }
                      cur = cur.inheritsFrom ? plansData.find(p => p.name === cur!.inheritsFrom) : undefined;
                    }
                    return { name: pd.name, features: allF.reverse(), services: pd.services };
                  }).filter(Boolean);
                  return features.length > 0 ? (
                    <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 10 }}>Que incluye tu plan</div>
                      {features.map((pf: any, fi: number) => (
                        <div key={fi}>
                          <div style={{ fontSize: '0.5rem', fontWeight: 700, color: '#4B7BE5', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid #f0f0f0' }}>Plan {pf.name}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginBottom: 10 }}>
                            {pf.features.map((cat: any, ci: number) => (
                              <div key={ci}>
                                <div style={{ fontSize: '0.5rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' as const, marginBottom: 2 }}>{cat.category}</div>
                                {cat.items.map((item: string, ii: number) => (
                                  <div key={ii} style={{ display: 'flex', gap: 4, fontSize: '0.5rem', color: '#666', padding: '1px 0', alignItems: 'flex-start' }}>
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M20 6L9 17l-5-5" stroke="#2AB5A0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    <span>{item}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                          {pf.services.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const, marginBottom: 8 }}>
                              {pf.services.map((s: string, si: number) => (
                                <span key={si} style={{ fontSize: '0.5rem', fontWeight: 600, color: '#2AB5A0', background: 'rgba(42,181,160,0.08)', padding: '2px 6px', borderRadius: 10 }}>{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* Preview Conditions */}
                {(qf.mostrar_condiciones !== false) && qf.condiciones && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.5rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 4 }}>Condiciones</div>
                    <div style={{ fontSize: '0.625rem', color: '#999', lineHeight: 1.6, whiteSpace: 'pre-line' as const }}>{qf.condiciones}</div>
                  </div>
                )}

                {/* Timeline de implementación */}
                {(qf.mostrar_timeline !== false) && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Timeline de implementación</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(qf.timeline_tipo === '5massuc' ? ['Kickoff', 'Migración', 'Configuración', 'Capacitación', 'Go live']
                        : qf.timeline_tipo === '2a5suc' ? ['Kickoff', 'Migración', 'Capacitación', 'Go live']
                        : ['Kickoff', 'Configuración', 'Go live']).map((paso, i) => (
                        <div key={paso} style={{ flex: 1, textAlign: 'center' as const }}>
                          <div style={{ height: 4, background: i === 0 ? '#4B7BE5' : '#e6ecf8', borderRadius: 3 }} />
                          <div style={{ fontSize: '0.5rem', color: '#999', marginTop: 4 }}>{paso}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Proceso de implementación */}
                {(qf.mostrar_implementacion !== false) && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 6 }}>Proceso de implementación</div>
                    <div style={{ fontSize: '0.5625rem', color: '#999', lineHeight: 1.7 }}>
                      Alta de la cuenta · Carga de catálogo e inventario · Configuración de sucursales y usuarios · Capacitación del equipo · Acompañamiento en el arranque
                    </div>
                  </div>
                )}

                {/* ¿Por qué SACS? */}
                {(qf.mostrar_porque_sacs !== false) && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 6 }}>¿Por qué SACS?</div>
                    <div style={{ fontSize: '0.5625rem', color: '#999', lineHeight: 1.7 }}>Historia, casos de éxito y respaldo del equipo.</div>
                  </div>
                )}

                {/* Firma digital y QR */}
                {((qf.mostrar_firma !== false) || (qf.mostrar_qr !== false)) && (
                  <div style={{ padding: '14px 32px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 14, alignItems: 'flex-end' }}>
                    {(qf.mostrar_firma !== false) && (
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.5rem', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>Firma digital</div>
                        <div style={{ borderBottom: '1px solid #dcdce2', height: 26 }} />
                        <div style={{ fontSize: '0.5rem', color: '#bbb', marginTop: 4 }}>El cliente firma desde la liga y queda registrada con fecha</div>
                      </div>
                    )}
                    {(qf.mostrar_qr !== false) && (
                      <div style={{ textAlign: 'center' as const }}>
                        <div style={{ width: 46, height: 46, borderRadius: 6, background: 'repeating-conic-gradient(#1a1a1a 0% 25%, #fff 0% 50%) 0 0/9px 9px', border: '1px solid #e6e6ea' }} />
                        <div style={{ fontSize: '0.5rem', color: '#bbb', marginTop: 4 }}>QR</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Números animados no tiene bloque: es un efecto que solo
                    existe en la cotización viva. Se dice, en vez de dejar la
                    casilla sin ningún eco visible. */}
                {(qf.mostrar_animaciones !== false) && (
                  <div style={{ padding: '8px 32px', fontSize: '0.5rem', color: '#c4c4c4', borderTop: '1px solid #f6f6f6' }}>
                    Los montos se animan al abrir la cotización.
                  </div>
                )}

                {/* Preview Footer */}
                <div className="rh-soft rh-mute" style={{ padding: '14px 32px', background: '#fafafa', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', fontSize: '0.5625rem', color: '#bbb' }}>
                  <span><strong style={{ color: '#1a1a1a', fontFamily: "'Clash Display',sans-serif" }}>Sacs</strong> Sistema operativo para retailers</span>
                  <span>www.sacscloud.com</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Main Layout ───
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', background: '#f5f6f8' }}>
      <style dangerouslySetInnerHTML={{ __html: REVENUE_HUB_MOBILE_CSS }} />
      {/* Nav */}
      {!_hideNav && (
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0', marginRight: 32 }}>
            <span style={{ fontFamily: "'Clash Display',sans-serif", fontSize: '1.25rem', fontWeight: 700 }}>Sacs</span>
            <span className="rh-money" style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#2AB5A0', background: 'rgba(42,181,160,0.08)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Revenue</span>
          </div>
          {(['dashboard', 'cotizaciones', 'config'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '14px 16px', fontSize: '0.8125rem', fontWeight: tab === t ? 700 : 500, color: tab === t ? '#1a1a1a' : '#999', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #1a1a1a' : '2px solid transparent', cursor: 'pointer', textTransform: 'capitalize' as const }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/admin/leads" style={{ ...S.btn, background: '#f5f5f5', color: '#555', textDecoration: 'none' }}>CRM</a>
          <button onClick={load} style={{ ...S.btn, background: '#f5f5f5', color: '#555' }}>↻</button>
        </div>
      </div>
      )}

      {/* Content */}
      <div style={WRAP}>
        {tab === 'dashboard' && <DashboardView />}
        {/* El dashboard ocupa el lugar de la lista, no se encima: como panel
            flotante quedaba por debajo del menú lateral y se cortaba al
            abrirlo. Así el ancho lo decide el contenedor de siempre. */}
        {tab === 'cotizaciones' && (dashCot
          ? <CotizacionesDashboard onCerrar={() => setDashCot(false)} />
          : <QuotesView />)}
        {tab === 'config' && (() => {
          /* El catálogo de ajustes: los MISMOS grupos y módulos del menú del
             CRM. Cada renglón dice qué configura, cómo está hoy —el valor a la
             derecha, para no tener que abrir— y trae adentro el editor que ya
             existía. Los módulos sin ajustes no se esconden: dicen que este es
             su lugar cuando lo haya, así el hueco es información. */
          const MAPA: CfgGrupo[] = [
            { g: 'General', mods: [
              { id: 'perfil', nom: 'Mi perfil', sub: 'Tu nombre, tu correo y tu foto dentro del CRM.', items: [
                { id: 'datos', ico: 'yo', t: 'Datos del usuario', v: yo?.nombre || undefined,
                  d: 'Nombre completo, correo y foto. La foto se usa en el menú, en la actividad de cada cliente y como anfitrión de las reuniones.',
                  editor: <MiPerfil onGuardado={() => { try { window.dispatchEvent(new Event('sacs-perfil')); } catch { /* noop */ } }} /> },
                { id: 'pass', ico: 'llave', t: 'Contraseña', d: 'Cambia con qué entras al CRM.',
                  editor: <a href="/admin/cambiar-password" style={{ ...S.btn, background: M.violeta, color: '#fff', textDecoration: 'none', display: 'inline-block' }}>Cambiar contraseña</a> },
              ]},
              { id: 'marca', nom: 'Mi marca', sub: 'Cómo te ve un cliente en los documentos que le mandas.', items: [
                { id: 'marca', ico: 'marca', t: 'Marca de los documentos', mudado: true,
                  d: 'Logo, nombre, línea, color de acento y firma con los que salen la minuta, el estado de cuenta y la cotización. Es de cada persona, no de la empresa.',
                  editor: <MarcaTab sinTitulo /> },
              ]},
              { id: 'usuarios', nom: 'Usuarios y permisos', sub: 'Quién entra al CRM y qué ve cada quien.', items: [
                { id: 'usuarios', ico: 'gente', t: 'Personas con acceso', 
                  d: 'Alta de personas, rol de arranque y permiso por sección: edita, solo ve o no entra. Se revisa también en el servidor.',
                  editor: <UsuariosPermisos /> },
              ]},
            ]},
            { g: 'Cuentas', mods: [
              { id: 'clientes', nom: 'Clientes', sub: 'Lo que se guarda de una cuenta y por dónde pasa.', items: [
                { id: 'campos-cliente', ico: 'campos', t: 'Campos personalizados',
                  d: 'Giro, subgiro, colaboradores, tipo de acompañamiento, origen. Se capturan en la ficha y sirven de filtro en la lista.',
                  editor: <CamposConfig entidad="company" sinTitulo /> },
                { id: 'etapas-cliente', ico: 'pipe', t: 'Etapas del cliente', v: 'Pipeline', mudado: true,
                  d: 'Las columnas por las que pasa una cuenta ya ganada.',
                  editor: <PipelinesConfig initialTipo="cliente" sinTitulo /> },
              ]},
              { id: 'contactos', nom: 'Contactos', sub: 'Lo que se guarda de una persona.', items: [
                { id: 'campos-contacto', ico: 'campos', t: 'Campos personalizados',
                  d: 'Lo que se guarda además de nombre, correo y teléfono.',
                  editor: <CamposConfig entidad="contact" sinTitulo /> },
              ]},
              { id: 'leads', nom: 'Leads', sub: 'El embudo de lo que todavía no es cliente.', items: [
                { id: 'etapas-lead', ico: 'pipe', t: 'Etapas del lead', v: 'Pipeline', mudado: true,
                  d: 'Las columnas del embudo y qué significa cada una.',
                  editor: <PipelinesConfig initialTipo="lead" sinTitulo /> },
                { id: 'motivos-lead', ico: 'campos', t: 'Motivos de descarte y desenlace',
                  d: 'Por qué un lead no califica y cómo terminó. Vienen unos de fábrica y puedes agregar los tuyos.',
                  editor: <MotivosLead /> },
              ]},
              { id: 'oportunidades', nom: 'Oportunidades', sub: 'Cómo avanza lo que se está vendiendo.', items: [
                { id: 'etapas-op', ico: 'pipe', t: 'Etapas de la oportunidad', v: 'Pipeline', mudado: true,
                  d: 'Hasta ganarse o perderse, y los motivos de pérdida.',
                  editor: <PipelinesConfig initialTipo="oportunidad" sinTitulo /> },
              ]},
              { id: 'reuniones', nom: 'Reuniones', sub: 'Cómo se agenda contigo.', items: [
                { id: 'agenda', ico: 'agenda', t: 'Tipos de reunión, disponibilidad y ligas', v: 'Agenda',
                  d: 'Los tipos que se pueden agendar contigo —consultoría, capacitación, demo—, con su duración, su color y la liga que le mandas al cliente. Y los horarios en que te pueden reservar. Vivía colgado de Reuniones, pero es un ajuste que se toca una vez, no trabajo del día.',
                  editor: <SchedulingTab /> },
                /* Conectar el calendario vive AQUÍ y no en un grupo aparte:
                   llegó a haber dos entradas de Reuniones en Configuración
                   —una por cada cosa— y son el mismo ajuste. Va suelto además
                   del hub porque cambiar de cuenta es lo que más se hace y no
                   debería exigir entrar a toda la agenda y buscarlo. */
                { id: 'google-calendar', ico: 'agenda', t: 'Google Calendar',
                  d: 'Con qué cuenta de Google se crean los eventos y las ligas de Meet. Ojo: la conexión es por persona del equipo, así que la que valga es la que conectes desde tu propia sesión.',
                  editor: <GoogleCalendarPanel /> },
              ]},
            ]},
            { g: 'Facturación', mods: [
              { id: 'catalogo', nom: 'Planes y plugins', sub: 'Lo único que se puede vender, escrito una sola vez.', items: [
                { id: 'planes', ico: 'catalogo', t: 'Catálogo de licencias y plugins', v: 'Catálogo',
                  d: 'Nombre, a qué se refiere, cómo se cobra —mensual, anual o vitalicio— y precio de lista. De aquí salen las opciones de la cotización, de la oportunidad y de la suscripción, así que las tres dicen lo mismo.',
                  editor: <PlanesConfig sinTitulo /> },
              ]},
              { id: 'cotizaciones', nom: 'Cotizaciones', sub: 'Cómo sale el documento que recibe un cliente.', items: [
                { id: 'folio', ico: 'folio', t: 'Folio',
                  d: 'El número con el que arranca la siguiente. De ahí en adelante son consecutivos y no se repiten.',
                  editor: (<div>
<div style={{ ...S.card, marginBottom: 24 }}>
                      <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: 12 }}>Este número se usa como <b>folio inicial</b>. A partir de él, cada cotización nueva se numera de forma consecutiva y nunca se repite.</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
                      <div style={{ flex: 1 }}>
                      <label style={S.label}>Siguiente numero de folio</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#999' }}>COT-</span>
                      <input id="folio-input" type="number" min="1" placeholder="Ej. 100" defaultValue="" style={S.input} />
                      </div>
                      </div>
                      <button onClick={async () => {
                      const input = document.getElementById('folio-input') as HTMLInputElement;
                      const val = parseInt(input?.value);
                      if (!val || val < 1) { alert('Ingresa un numero valido'); return; }
                      // Validar contra el folio más alto existente (no contra el conteo de filas)
                      const res = await fetch('/api/revenue/quotes');
                      const all = await res.json();
                      let maxExisting = 0;
                      if (Array.isArray(all)) {
                      for (const q of all) {
                      const m = String(q?.numero || '').match(/(\d+)\s*$/);
                      if (m) maxExisting = Math.max(maxExisting, parseInt(m[1], 10));
                      }
                      }
                      if (val <= maxExisting) { alert(`El folio más alto usado es COT-${String(maxExisting).padStart(3, '0')}. El siguiente debe ser mayor a ${maxExisting}.`); return; }
                      // Guardamos offset = val-1 para mantener la convención (folioStart = offset + 1)
                      localStorage.setItem('sacs_folio_offset', String(val - 1));
                      alert(`Listo. La próxima cotización será COT-${String(val).padStart(3, '0')}. Las siguientes serán consecutivas.`);
                      input.value = '';
                      }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff' }}>Guardar</button>
                      </div>
                      {typeof window !== 'undefined' && localStorage.getItem('sacs_folio_offset') && (
                      <div style={{ fontSize: '0.6875rem', color: '#4B7BE5', marginTop: 8 }}>Offset configurado: +{localStorage.getItem('sacs_folio_offset')}</div>
                      )}
                      </div>
                  </div>) },
                { id: 'tyc', ico: 'doc', t: 'Términos y condiciones',
                  v: condicionesTpl.length ? `${condicionesTpl.length} plantilla${condicionesTpl.length === 1 ? '' : 's'}` : undefined,
                  d: 'Las plantillas que puede traer. Al elegir una, su texto queda copiado: cambiarla aquí no altera lo que un cliente ya recibió.',
                  editor: (<div>
<div style={{ ...S.card, marginBottom: 24 }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 12, lineHeight: 1.6 }}>
                      La marcada como <b>predeterminada</b> es la que trae una cotización nueva. Al elegir una plantilla, su texto
                      queda <b>copiado</b> en la cotización: cambiarla aquí no altera lo que un cliente ya recibió.
                      </div>
                      {condicionesTpl.map((t: any) => (
                      <div key={t.id} style={{ border: '1px solid #ececec', borderRadius: 9, padding: 10, marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <input value={t.nombre} onChange={e => setCondicionesTpl(condicionesTpl.map((x: any) => x.id === t.id ? { ...x, nombre: e.target.value } : x))}
                      style={{ ...S.input, fontWeight: 700, maxWidth: 220 }} />
                      {t.es_default
                      ? <span style={{ ...S.badge, background: '#e8f5e9', color: '#2e7d32' }}>Predeterminada</span>
                      : <button onClick={async () => {
                      await fetch('/api/revenue/condiciones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, es_default: true }) });
                      setCondicionesTpl(condicionesTpl.map((x: any) => ({ ...x, es_default: x.id === t.id })));
                      }} style={S.btnSmall}>Hacer predeterminada</button>}
                      <span style={{ flex: 1 }} />
                      <button onClick={async () => {
                      await fetch('/api/revenue/condiciones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, nombre: t.nombre, texto: t.texto }) });
                      alert('Plantilla guardada.');
                      }} style={S.btnSmall}>Guardar</button>
                      <button onClick={async () => {
                      if (!confirm(`¿Quitar la plantilla "${t.nombre}"?\n\nLas cotizaciones que ya la usaron conservan su texto.`)) return;
                      await fetch('/api/revenue/condiciones', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) });
                      setCondicionesTpl(condicionesTpl.filter((x: any) => x.id !== t.id));
                      }} style={{ ...S.btnSmall, color: '#E54B4B' }}>Quitar</button>
                      </div>
                      <textarea value={t.texto} onChange={e => setCondicionesTpl(condicionesTpl.map((x: any) => x.id === t.id ? { ...x, texto: e.target.value } : x))}
                      style={{ ...S.input, height: 64, fontSize: '0.75rem', resize: 'vertical' as const }} />
                      </div>
                      ))}
                      <button onClick={async () => {
                      const r = await fetch('/api/revenue/condiciones', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ nombre: 'Nueva plantilla', texto: 'Escribe aquí los términos y condiciones.' }),
                      }).then(x => x.json()).catch(() => null);
                      if (r?.id) setCondicionesTpl([...condicionesTpl, r]);
                      }} style={S.btnSmall}>+ Nueva plantilla</button>
                      </div>
                  </div>) },
              ]},
              { id: 'pagos', nom: 'Pagos', sub: 'Por dónde entra el dinero.', items: [
                { id: 'bancos', ico: 'banco', t: 'Cuentas bancarias',
                  v: bankAccounts.length ? `${bankAccounts.length} cuenta${bankAccounts.length === 1 ? '' : 's'}` : 'Sin cuentas',
                  d: 'Los datos que se imprimen en la cotización para que el cliente transfiera.',
                  editor: (<div>
<div style={{ ...S.card, marginBottom: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                      <div><label style={S.label}>Alias</label><input value={bankForm.alias || ''} onChange={e => setBankForm({ ...bankForm, alias: e.target.value })} placeholder="Ej. BBVA pesos" style={S.input} /></div>
                      <div><label style={S.label}>Banco</label><input value={bankForm.banco || ''} onChange={e => setBankForm({ ...bankForm, banco: e.target.value })} placeholder="Ej. BBVA" style={S.input} /></div>
                      <div><label style={S.label}>Cuenta</label><input value={bankForm.cuenta || ''} onChange={e => setBankForm({ ...bankForm, cuenta: e.target.value })} placeholder="Número de cuenta" style={S.input} /></div>
                      <div><label style={S.label}>CLABE</label><input value={bankForm.clabe || ''} onChange={e => setBankForm({ ...bankForm, clabe: e.target.value })} placeholder="18 dígitos" style={S.input} /></div>
                      <div><label style={S.label}>RFC</label><input value={bankForm.rfc || ''} onChange={e => setBankForm({ ...bankForm, rfc: e.target.value })} placeholder="RFC" style={S.input} /></div>
                      <div><label style={S.label}>Titular</label><input value={bankForm.titular || ''} onChange={e => setBankForm({ ...bankForm, titular: e.target.value })} placeholder="Nombre" style={S.input} /></div>
                      <button onClick={async () => {
                      if (!bankForm.banco) return;
                      await fetch('/api/revenue/bank-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...bankForm, es_default: bankAccounts.length === 0 }) });
                      setBankForm({});
                      load();
                      }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff' }}>Agregar</button>
                      </div>
                      </div>
                      <div style={S.card}>
                      <table style={S.table}>
                      <thead><tr>{['Banco', 'Cuenta', 'CLABE', 'RFC', 'Titular', 'Default', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                      <tbody>
                      {bankAccounts.length === 0 && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center' as const, color: '#ccc', padding: 32 }}>Sin cuentas bancarias</td></tr>}
                      {bankAccounts.map((ba: any) => (
                      <tr key={ba.id}>
                      <td style={{ ...S.td, fontWeight: 700 }}>{ba.banco}</td>
                      <td style={S.td}>{ba.cuenta}</td>
                      <td style={S.td}>{ba.clabe}</td>
                      <td style={S.td}>{ba.rfc}</td>
                      <td style={S.td}>{ba.titular}</td>
                      <td style={S.td}>{ba.es_default ? <span style={{ ...S.badge, background: '#e8f5e9', color: '#2e7d32' }}>Default</span> : <button onClick={async () => { await fetch('/api/revenue/bank-accounts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ba.id, es_default: true }) }); load(); }} style={S.btnSmall}>Hacer default</button>}</td>
                      <td style={S.td}><button onClick={async () => { await fetch('/api/revenue/bank-accounts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ba.id }) }); load(); }} style={{ ...S.btnSmall, color: '#E54B4B' }}>Eliminar</button></td>
                      </tr>
                      ))}
                      </tbody>
                      </table>
                      </div>
                  </div>) },
                { id: 'mp', ico: 'tarjeta', t: 'Cobro con Mercado Pago', mudado: true,
                  d: 'La cuenta con la que se generan las ligas de pago con tarjeta.',
                  editor: <PasarelaMercadoPago /> },
              ]},
              { id: 'cobranza', nom: 'Cobranza', sub: 'Cuándo se considera tarde y a quién se le avisa.', items: [] },
              { id: 'suscripciones', nom: 'Suscripciones · ARR', sub: 'Las licencias que se renuevan solas.', items: [
                { id: 'recuperar', ico: 'tool', t: 'Oportunidades que faltan', v: 'Mantenimiento',
                  d: 'Genera la oportunidad de las cotizaciones ya cobradas, vencidas o rechazadas que se quedaron sin ella. Correrlo dos veces no duplica nada.',
                  editor: (<div>
<div style={{ ...S.card, marginBottom: 24 }}>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: 12, lineHeight: 1.6 }}>
                      Genera la oportunidad de las cotizaciones que ya están <b>cobradas, vencidas o rechazadas</b> y se quedaron
                      sin ella. Se crean ya cerradas y <b>con su fecha real</b> — una venta de julio no aparece como cerrada hoy.
                      Solo se tocan las que tienen cliente ligado: sin empresa, la oportunidad no aparecería en ninguna ficha.
                      Correrlo dos veces no duplica nada.
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
                      <button onClick={async () => {
                      const r = await fetch('/api/revenue/quotes/recuperar-oportunidades', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dry: true }),
                      }).then(x => x.json()).catch(() => null);
                      setRecup(r);
                      }} style={S.btnSmall}>Ver qué se recuperaría</button>
                      <button onClick={async () => {
                      if (!confirm('Se van a crear las oportunidades faltantes de las cotizaciones ya cobradas, vencidas y rechazadas.\n\n¿Continuar?')) return;
                      const r = await fetch('/api/revenue/quotes/recuperar-oportunidades', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dry: false }),
                      }).then(x => x.json()).catch(() => null);
                      setRecup(r);
                      }} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', padding: '6px 14px', fontSize: '0.78rem' }}>Recuperar ahora</button>
                      </div>
                      {recup && (
                      <div style={{ marginTop: 12, fontSize: '0.76rem', lineHeight: 1.6 }}>
                      {recup.cerradas > 0 && (
                      <div style={{ marginBottom: 8, background: M.verdeAgua, border: '1px solid #cdeadd', borderRadius: 8, padding: '9px 11px', color: M.verdeTinta }}>
                      <b>{recup.cerradas} cotización{recup.cerradas === 1 ? '' : 'es'} ya cobrada{recup.cerradas === 1 ? '' : 's'} se cerró como ganada.</b>{' '}
                      {(recup.cerradas_detalle || []).map((x: any) => x.numero).join(' · ')} — con eso el lead pasa a cliente y nace su suscripción.
                      </div>
                      )}
                      <b>{recup.dry ? 'Se recuperarían' : 'Se recuperaron'} {recup.recuperadas}</b>
                      {' '}({recup.ganadas} ganadas · {recup.perdidas} perdidas)
                      {(recup.detalle || []).length > 0 && (
                      <div style={{ marginTop: 6, maxHeight: 160, overflowY: 'auto' as const, background: '#fafafa', borderRadius: 7, padding: 9 }}>
                      {recup.detalle.map((x: any) => (
                      <div key={x.numero} style={{ fontSize: '0.72rem', color: '#555' }}>
                      {x.numero} · {x.empresa} · {fmt(x.total)} — {x.etapa === 'cerrada_ganada' ? 'ganada' : 'perdida'} el {String(x.closed_at || '').slice(0, 10)}
                      </div>
                      ))}
                      </div>
                      )}
                      {(recup.sin_cliente_ligado || []).length > 0 && (
                      <div style={{ marginTop: 10, background: '#fff8ec', border: '1px solid #f5e2b8', borderRadius: 8, padding: '9px 11px', color: '#8a6212' }}>
                      <b>{recup.sin_cliente_ligado.length} no se pueden recuperar todavía</b> porque no tienen cliente ligado.
                      Lígalas desde la lista y su oportunidad nace sola:
                      <div style={{ marginTop: 5, fontSize: '0.72rem' }}>
                      {recup.sin_cliente_ligado.map((x: any) => `${x.numero} (${x.empresa || 'sin nombre'})`).join(' · ')}
                      </div>
                      </div>
                      )}
                      {(recup.fallidas || []).length > 0 && (
                      <div style={{ marginTop: 8, color: '#b4302f', fontSize: '0.73rem' }}>
                      Fallaron {recup.fallidas.length}: {recup.fallidas.map((f: any) => `${f.numero} (${f.motivo})`).join(' · ')}
                      </div>
                      )}
                      </div>
                      )}
                      </div>
                  </div>) },
              ]},
            ]},
            { g: 'Acompañamiento', mods: [
              { id: 'consultoria', nom: 'Consultoría', sub: 'Los compromisos que se pactan con el cliente.', items: [] },
              { id: 'radar', nom: 'Radar de ventas', sub: 'Qué cuentas se marcan como oportunidad.', items: [] },
            ]},
            /* WhatsApp: sus ajustes vivían en una pantalla aparte colgada
               del menú del canal. Que ESTE módulo guardara su configuración en
               otro sitio que todos los demás obligaba a recordarlo cada vez.
               Aquí abajo son renglones como cualquier otro, y el cuerpo de cada
               uno es el MISMO componente que ya existía (SeccionWA): una sola
               copia, para que las dos no se separen con el tiempo. */
            { g: 'WhatsApp', mods: [
              { id: 'wa-mensajes', nom: 'Mensajes', sub: 'Con qué se responde y con qué se abre una conversación.', items: [
                { id: 'plantillas', ico: 'doc', t: 'Plantillas de Meta',
                  d: 'Los mensajes aprobados por Meta, que son los únicos con los que se puede escribir primero fuera de la ventana de 24 horas.',
                  editor: <SeccionWA id="plantillas" /> },
                { id: 'snippets', ico: 'tool', t: 'Snippets',
                  d: 'Respuestas guardadas que salen escribiendo "/" en el chat. Lo que se contesta veinte veces al día se escribe una.',
                  editor: <SeccionWA id="snippets" /> },
                { id: 'archivos', ico: 'catalogo', t: 'Archivos',
                  d: 'La biblioteca de imágenes y documentos que se adjuntan desde el chat sin volver a subirlos.',
                  editor: <SeccionWA id="archivos" /> },
              ]},
              { id: 'wa-conversacion', nom: 'La conversación', sub: 'Por dónde pasa un contacto y qué corre solo.', items: [
                { id: 'etapas', ico: 'pipe', t: 'Ciclo de vida',
                  d: 'Las etapas por las que pasa un contacto del inbox. Son las mismas que ordenan las vistas de la bandeja.',
                  editor: <SeccionWA id="etapas" /> },
                { id: 'motivos', ico: 'folio', t: 'Motivos de cierre',
                  d: 'Por qué se da por resuelta una conversación. Es lo que después permite contar en qué se están yendo.',
                  editor: <SeccionWA id="motivos" /> },
                { id: 'etiquetas', ico: 'etiqueta', t: 'Etiquetas',
                  d: 'El catálogo transversal del CRM: la misma etiqueta sirve en conversaciones, leads y clientes.',
                  editor: <SeccionWA id="etiquetas" /> },
                { id: 'automatizacion', ico: 'tool', t: 'Automatización',
                  d: 'Mensaje de bienvenida, horario de atención y a quién se le asigna lo que entra.',
                  editor: <SeccionWA id="automatizacion" /> },
              ]},
              { id: 'wa-numero', nom: 'El número', sub: 'La línea con la que se escribe y lo que Meta cobra por ella.', items: [
                { id: 'numero', ico: 'wa', t: 'Número y pagos',
                  d: 'Salud del número, perfil del negocio que ve el cliente y la facturación de Meta.',
                  editor: <SeccionWA id="numero" /> },
                { id: 'telefonia', ico: 'tel', t: 'Telefonía',
                  d: 'Llamadas normales con número de México, para cuando WhatsApp no alcanza.',
                  editor: <SeccionWA id="telefonia" /> },
                { id: 'duplicados', ico: 'gente', t: 'Duplicados',
                  d: 'Contactos repetidos detectados por teléfono o correo, listos para fusionar.',
                  editor: <SeccionWA id="duplicados" /> },
              ]},
            ]},
            { g: 'Automatización', mods: [
              { id: 'email', nom: 'Email marketing', sub: 'Con qué cara salen los correos.', items: [] },
              { id: 'outbound', nom: 'Outbound', sub: 'Los mensajes dentro de SACS3.', items: [] },
              { id: 'agentes', nom: 'Agentes IA', sub: 'Qué corre solo y cada cuánto.', items: [] },
            ]},
            { g: 'Colaboradores', mods: [
              { id: 'partners', nom: 'Partners', sub: 'La red que vende contigo.', items: [] },
              { id: 'comisiones', nom: 'Comisiones', sub: 'Cuánto se paga y cuándo.', items: [] },
            ]},
          ];
          return (
            <CfgPantalla
              mapa={MAPA} mod={cfgMod} item={cfgItem} q={cfgQ}
              onMod={(m) => { setCfgMod(m); setCfgItem(''); setCfgQ(''); }}
              onItem={(m, i) => { setCfgMod(m); setCfgItem(i); setCfgQ(''); }}
              onQ={setCfgQ}
              onCerrar={() => {
                // Dentro del CRM el que manda es el menú: se le avisa y él
                // decide a dónde volver. Suelto (RevenueHub solo), vuelve al
                // tablero de cotizaciones.
                try { window.dispatchEvent(new Event('sacs-cerrar-config')); } catch { /* noop */ }
                setTab('dashboard');
              }}
            />
          );
        })()}
      </div>
    </div>
  );
}

// ─── Styles ───
const S: Record<string, React.CSSProperties> = {
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
  kpi: { background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #f0f0f0' },
  card: { background: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #f0f0f0', marginBottom: 16 },
  cardTitle: { margin: '0 0 16px', fontSize: '0.875rem', fontWeight: 700, color: '#1a1a1a' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.8125rem' },
  th: { padding: '8px 12px', textAlign: 'left' as const, fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#aaa', background: '#fafafa', borderBottom: '1px solid #f0f0f0' },
  td: { padding: '10px 12px', color: '#555', borderBottom: '1px solid #f8f8f8' },
  tr: { cursor: 'default' },
  btn: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', fontWeight: 600, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  btnSmall: { fontSize: '0.6875rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid #e0e0e0', background: '#fafafa', color: '#666', cursor: 'pointer', marginRight: 4 },
  badge: { fontSize: '0.625rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-block' },
  input: { width: '100%', padding: '8px 12px', fontSize: '0.8125rem', border: '1px solid #e0e0e0', borderRadius: 8, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const },
  label: { display: 'block', fontSize: '0.625rem', fontWeight: 600, color: '#999', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' as const },
  listItem: { padding: '10px 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.8125rem' },
  empty: { textAlign: 'center' as const, padding: 32, color: '#ccc', fontSize: '0.875rem' },
};

// CSS responsive — drawer del editor de cotizaciones mobile-friendly
const REVENUE_HUB_MOBILE_CSS = `
  /* ── Tema de la vista previa según la plantilla ──
     El documento está pintado con estilos inline, así que teñirlo por plantilla
     solo se puede con !important acotado a esta clase. Los acentos se devuelven
     por CLASE y no por selector de atributo: React serializa los colores inline
     a rgb(), así que [style*="#2AB5A0"] nunca casa. */
  .rh-prev-dark { background: #0f0f12; border-radius: 12px; }
  .rh-prev-dark .rh-doc { background: #17171c !important; box-shadow: none !important; }
  .rh-prev-dark .rh-doc,
  .rh-prev-dark .rh-doc div, .rh-prev-dark .rh-doc span,
  .rh-prev-dark .rh-doc td, .rh-prev-dark .rh-doc th,
  .rh-prev-dark .rh-doc strong, .rh-prev-dark .rh-doc small,
  .rh-prev-dark .rh-doc s { color: #e9e9ee !important; border-color: rgba(255,255,255,0.09) !important; }
  .rh-prev-dark .rh-doc .rh-mute, .rh-prev-dark .rh-doc .rh-mute * { color: rgba(255,255,255,0.45) !important; }
  .rh-prev-dark .rh-doc .rh-money, .rh-prev-dark .rh-doc .rh-money * { color: #2AB5A0 !important; }
  .rh-prev-dark .rh-doc .rh-soft { background: rgba(255,255,255,0.05) !important; }
  .rh-prev-dark .rh-doc .rh-warn, .rh-prev-dark .rh-doc .rh-warn * { color: #fdba74 !important; }
  .rh-prev-dark .rh-doc .rh-warn { background: rgba(253,186,116,0.10) !important; border-color: rgba(253,186,116,0.28) !important; }

  .rh-prev-interactiva { background: #f7f4ff; border-radius: 12px; }
  .rh-prev-ejecutiva { background: #f3f8f6; border-radius: 12px; }

  @media (max-width: 900px) {
    .rh-quote-topbar { padding: 10px 14px !important; }
    .rh-quote-topbar h3 { font-size: 0.875rem !important; }
    .rh-quote-split { flex-direction: column !important; overflow-y: auto !important; }
    .rh-quote-form { width: 100% !important; padding: 16px !important; border-right: none !important; border-bottom: 1px solid #eee !important; }
    .rh-quote-form > div[style*="grid-template-columns"],
    .rh-quote-form div[style*="gridTemplateColumns"] { grid-template-columns: 1fr !important; }
    .rh-quote-preview { padding: 18px !important; }
    .rh-quote-preview > div[style*="max-width: 640"],
    .rh-quote-preview > div[style*="maxWidth: 640"] { max-width: 100% !important; }
  }
`;

/* ═══ Eliminar cotización ═══
 *
 * No borra: archiva y deja escrito POR QUÉ, QUIÉN y CUÁNDO. Una cotización es
 * un documento que salió al cliente con folio, precio y vigencia; que se esfume
 * sin rastro es lo que después impide explicar por qué se le cotizó dos veces o
 * por qué cambió el precio.
 *
 * Cuando el motivo es "se generó una nueva", se elige cuál la reemplaza —solo
 * cotizaciones DEL MISMO CLIENTE, porque ligar la de otro rompe los dos
 * historiales— y el vínculo queda en las dos direcciones.
 */
const MOTIVOS_ELIMINAR: { v: string; l: string }[] = [
  { v: 'nueva_cotizacion', l: 'Se generó una nueva cotización' },
  { v: 'error_captura', l: 'Me equivoqué al generar la cotización' },
  { v: 'duplicada', l: 'La cotización está duplicada' },
  { v: 'cambios_cliente', l: 'El cliente solicitó cambios' },
  { v: 'operacion_cancelada', l: 'La operación fue cancelada' },
  { v: 'otro', l: 'Otro' },
];

function EliminarCotizacionModal({ seleccion, quotes, onClose, onDone }: {
  seleccion: any[]; quotes: any[]; onClose: () => void; onDone: (msg: string) => void;
}) {
  const quote = seleccion[0];
  const varias = seleccion.length > 1;
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [reemplazo, setReemplazo] = useState('');
  const [busy, setBusy] = useState(false);

  // Del mismo cliente: por empresa ligada o, si no la hay, por correo. Se
  // excluyen las que se están archivando y lo ya archivado.
  const ids = seleccion.map((q: any) => q.id);
  const delCliente = (quotes || []).filter((q: any) => {
    if (ids.includes(q.id) || q.estado === 'deleted') return false;
    if (quote.company_id && q.company_id) return q.company_id === quote.company_id;
    if (quote.email && q.email) return String(q.email).toLowerCase() === String(quote.email).toLowerCase();
    return false;
  });
  // Archivar juntas cotizaciones de clientes distintos hacia UNA nueva no tiene
  // sentido: se avisa en vez de dejar que el servidor lo rechace al final.
  const mezcla = varias && seleccion.some((q: any) => (quote.company_id && q.company_id)
    ? q.company_id !== quote.company_id
    : String(q.email || '').toLowerCase() !== String(quote.email || '').toLowerCase());

  async function confirmar() {
    if (!motivo) { alert('Elige el motivo de la eliminación.'); return; }
    if (motivo === 'otro' && !detalle.trim()) { alert('Escribe el motivo: "Otro" a secas no explica nada después.'); return; }
    if (motivo === 'nueva_cotizacion' && !reemplazo) { alert('Indica cuál cotización reemplaza a esta.'); return; }
    setBusy(true);
    const j = await fetch('/api/revenue/quotes/eliminar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, motivo, motivo_detalle: detalle.trim() || null, reemplazada_por_id: reemplazo || null }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo archivar' }));
    setBusy(false);
    if (j?.error) { alert(j.error); return; }
    onDone(`${j.eliminadas} cotización(es) archivada(s): ${(j.numeros || []).join(', ')}`
      + (j.reemplazada_por ? ` · las reemplaza la ${j.reemplazada_por.numero}` : ''));
  }

  const inp: React.CSSProperties = { padding: '9px 10px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box', background: '#fff' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 14px', overflow: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, width: 'min(560px, 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{varias ? `Archivar ${seleccion.length} cotizaciones` : `Eliminar cotización ${quote.numero}`}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#999' }}>✕</button>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: 14, lineHeight: 1.5 }}>
          {varias
            ? <>{seleccion.map((q: any) => q.numero).join(', ')} · {quote.empresa || quote.contacto}. Se archivan con el MISMO motivo.</>
            : <>{quote.empresa || quote.contacto} · ${Number(quote.total || 0).toLocaleString('es-MX')}.</>}
          {' '}No se borran: pasan al archivo y quedan en el historial del cliente con el motivo, quién y cuándo. Se pueden restaurar.
        </div>
        {mezcla && (
          <div style={{ fontSize: '0.78rem', color: '#b93333', background: '#fdeaea', border: '1px solid #f5c6c6', borderRadius: 8, padding: 10, marginBottom: 12 }}>
            Hay cotizaciones de clientes distintos en la selección. Se pueden archivar juntas, pero no apuntarlas a una misma cotización nueva.
          </div>
        )}

        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>MOTIVO DE ELIMINACIÓN *</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
          {MOTIVOS_ELIMINAR.map(m => (
            <label key={m.v} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', padding: '7px 9px', borderRadius: 8, cursor: 'pointer', background: motivo === m.v ? '#f5f7ff' : 'transparent', border: '1px solid ' + (motivo === m.v ? '#d8e0fb' : 'transparent') }}>
              <input type="radio" name="motivo-eliminar" checked={motivo === m.v} onChange={() => setMotivo(m.v)} />
              {m.l}
            </label>
          ))}
        </div>

        {motivo === 'nueva_cotizacion' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888', display: 'block', marginBottom: 3 }}>{varias ? '¿QUÉ COTIZACIÓN LAS REEMPLAZA? *' : '¿QUÉ COTIZACIÓN REEMPLAZA A ESTA? *'}</label>
            {delCliente.length ? (
              <>
                <select value={reemplazo} onChange={e => setReemplazo(e.target.value)} style={inp}>
                  <option value="">— elegir —</option>
                  {delCliente.map((q: any) => (
                    <option key={q.id} value={q.id}>
                      {q.numero} · ${Number(q.total || 0).toLocaleString('es-MX')} · {q.estado} · {new Date(q.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </option>
                  ))}
                </select>
                {reemplazo && (
                  <div style={{ fontSize: '0.76rem', color: '#1A8F7A', marginTop: 6 }}>
                    {seleccion.map((q: any) => q.numero).join(' + ')} → reemplazada{varias ? 's' : ''} por {delCliente.find((q: any) => q.id === reemplazo)?.numero}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: '0.78rem', color: '#a06600', background: '#fff8ec', border: '1px solid #f5e2b8', borderRadius: 8, padding: 10 }}>
                Este cliente no tiene otra cotización a la cual apuntar. Créala primero, o elige otro motivo.
              </div>
            )}
          </div>
        )}

        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888', display: 'block', marginBottom: 3 }}>
          {motivo === 'otro' ? 'CUÉNTAME EL MOTIVO *' : 'NOTA (opcional)'}
        </label>
        <input value={detalle} onChange={e => setDetalle(e.target.value)} placeholder="lo que ayude a entenderlo dentro de tres meses" style={{ ...inp, marginBottom: 16 }} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={confirmar} disabled={busy || !motivo || (motivo === 'nueva_cotizacion' && !reemplazo)}
            style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#b93333', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', opacity: (busy || !motivo || (motivo === 'nueva_cotizacion' && !reemplazo)) ? 0.5 : 1 }}>
            {busy ? 'Archivando…' : (varias ? `Confirmar archivado de ${seleccion.length}` : 'Confirmar eliminación')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ Buscador de cliente para la cotización ═══
 *
 * Busca en clientes Y leads a la vez. Elegir aquí es lo que liga la cotización
 * al CRM; escribir el nombre a mano la deja huérfana y fuera de la ficha del
 * cliente — que es como quedaron las 32 que existen hoy.
 *
 * Si no existe, se crea en el momento sin salir del editor. Y antes de crear,
 * avisa si ya hay algo parecido: detectar el duplicado cuesta un query, y
 * fusionarlo después cuesta una tarde.
 */
function ClienteBuscador({ valorInicial, datos, onElegir }: { valorInicial?: string; datos?: any; onElegir: (r: any) => void }) {
  // La caja arranca VACÍA aunque la cotización ya traiga nombre: prellenada se
  // leía como un campo más que ya está lleno y nadie la tocaba. Lo escrito se
  // ofrece en una pastilla de un clic, debajo.
  const [q, setQ] = useState('');
  const [res, setRes] = useState<any[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [creando, setCreando] = useState<any>(null);
  const [dupes, setDupes] = useState<any>(null);
  const [filtro, setFiltro] = useState<'todos' | 'cliente' | 'lead' | 'excliente'>('todos');
  const [cursor, setCursor] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = (texto: string) => {
    setQ(texto); setAbierto(true);
    if (timer.current) clearTimeout(timer.current);
    if (texto.trim().length < 2) { setRes([]); return; }
    // 250 ms: teclear rápido no puede disparar una consulta por letra.
    timer.current = setTimeout(async () => {
      setBuscando(true);
      const j = await fetch('/api/crm/buscar-cliente?q=' + encodeURIComponent(texto)).then(r => r.json()).catch(() => ({}));
      setRes(j?.resultados || []); setCursor(0); setBuscando(false);
    }, 250);
  };

  async function abrirAlta() {
    // Se arrastra lo que ya está capturado en la cotización: volver a teclear
    // correo y teléfono es justo el momento en que se abandona y se deja sin ligar.
    setCreando({
      empresa: q.trim() || datos?.empresa || '', contacto: datos?.contacto || '',
      email: datos?.email || '', whatsapp: datos?.whatsapp || '', tipo: 'lead',
    });
    setAbierto(false);
    const nombre = q.trim() || datos?.empresa || '';
    const j = await fetch(`/api/crm/buscar-cliente?duplicado=${encodeURIComponent(nombre)}&email=${encodeURIComponent(datos?.email || '')}`).then(r => r.json()).catch(() => ({}));
    setDupes(j);
  }

  async function crear() {
    if (!creando.empresa.trim()) { alert('El cliente es la EMPRESA: escribe su nombre.'); return; }
    const j = await fetch('/api/crm/buscar-cliente', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creando),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo crear' }));
    if (j?.error) { alert(j.error); return; }
    onElegir({ ...j, contacto: creando.contacto, email: creando.email, whatsapp: creando.whatsapp, es_cliente: creando.tipo === 'cliente', clase: creando.tipo, n: 0 });
    setCreando(null); setDupes(null);
  }

  if (creando) {
    return (
      <div style={{ background: '#fafbfd', border: '1px dashed #cfd6e4', borderRadius: 8, padding: 12, marginBottom: 8 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#666', marginBottom: 6 }}>Nuevo cliente</div>
        {dupes && (dupes.empresas_parecidas?.length > 0 || dupes.contactos_mismo_correo?.length > 0) && (
          <div style={{ fontSize: '0.72rem', color: '#b45309', background: '#fff8ec', border: '1px solid #f5e2b8', borderRadius: 7, padding: '7px 9px', marginBottom: 8 }}>
            Ya existe algo parecido — ¿es alguno de estos?
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
              {(dupes.empresas_parecidas || []).map((x: any) => (
                <button key={x.id} onClick={() => { onElegir({ company_id: x.id, empresa: x.nombre, es_cliente: x.estado_cuenta === 'activo' }); setCreando(null); setDupes(null); }}
                  style={{ ...S.btnSmall, marginRight: 0 }}>{x.nombre}</button>
              ))}
              {(dupes.contactos_mismo_correo || []).map((x: any) => (
                <button key={x.id} onClick={() => { const co = Array.isArray(x.companies) ? x.companies[0] : x.companies; onElegir({ company_id: co?.id || null, contact_id: x.id, empresa: co?.nombre || x.nombre, contacto: x.nombre, email: x.email }); setCreando(null); setDupes(null); }}
                  style={{ ...S.btnSmall, marginRight: 0 }}>{x.nombre} ({x.email})</button>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input value={creando.empresa} onChange={e => setCreando({ ...creando, empresa: e.target.value })} placeholder="Empresa *" style={S.input} />
          <input value={creando.contacto} onChange={e => setCreando({ ...creando, contacto: e.target.value })} placeholder="Contacto (persona)" style={S.input} />
          <input value={creando.email} onChange={e => setCreando({ ...creando, email: e.target.value })} placeholder="Correo" style={S.input} />
          <input value={creando.whatsapp} onChange={e => setCreando({ ...creando, whatsapp: e.target.value })} placeholder="WhatsApp" style={S.input} />
        </div>
        {/* Nace como lead salvo que se diga lo contrario: casi siempre se cotiza
            a alguien que todavía no compra, y marcarlo cliente de entrada
            ensucia la cuenta de cuántas cuentas nuevas trajiste. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span style={{ display: 'inline-flex', background: '#f2f3f5', borderRadius: 20, padding: 3, gap: 3 }}>
            {(['lead', 'cliente'] as const).map(t => (
              <button key={t} onClick={() => setCreando({ ...creando, tipo: t })}
                style={{ border: 'none', cursor: 'pointer', borderRadius: 20, padding: '3px 12px', fontSize: '0.68rem', fontWeight: 800,
                  background: creando.tipo === t ? '#3764c4' : 'transparent', color: creando.tipo === t ? '#fff' : '#6b7280' }}>
                {t === 'lead' ? 'Lead' : 'Cliente'}
              </button>
            ))}
          </span>
          <span style={{ fontSize: '0.71rem', color: '#8a8a8a' }}>se guarda así en su ficha</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={crear} style={{ ...S.btn, background: '#1a1a1a', color: '#fff', padding: '6px 14px', fontSize: '0.78rem' }}>Crear y ligar</button>
          <button onClick={() => { setCreando(null); setDupes(null); }} style={{ ...S.btnSmall, marginRight: 0 }}>Cancelar</button>
        </div>
      </div>
    );
  }

  const clases: Record<string, { txt: string; bg: string; fg: string }> = {
    cliente:   { txt: 'Cliente',   bg: '#f0e9ff', fg: '#6d4bc7' },
    lead:      { txt: 'Lead',      bg: '#e8f0fd', fg: '#3764c4' },
    excliente: { txt: 'Excliente', bg: '#f4f5f7', fg: '#5b6472' },
  };
  const estadoTxt: Record<string, string> = { sent: 'enviada', draft: 'borrador', accepted: 'aceptada', paid: 'pagada', expired: 'vencida', rejected: 'rechazada' };
  const estadoCol: Record<string, string> = { sent: '#a15c07', accepted: '#2c5fc4', paid: '#0f7a56', expired: '#b4302f', rejected: '#5b6472', draft: '#8a8a8a' };

  const visibles = res.filter((r: any) => filtro === 'todos' || r.clase === filtro);
  const elegir = (r: any) => { onElegir(r); setAbierto(false); setCursor(0); };

  // ↑↓ para moverse y ↵ para elegir: quien está capturando una cotización no
  // suelta el teclado para tomar el mouse.
  const teclas = (e: any) => {
    if (!abierto) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, visibles.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && visibles[cursor]) { e.preventDefault(); elegir(visibles[cursor]); }
    else if (e.key === 'Escape') { setAbierto(false); }
  };

  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, border: '1.5px solid #b9a0f0', borderRadius: 9, padding: '0 12px', background: '#fbfaff' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.2" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
          <input value={q} onChange={e => buscar(e.target.value)} onFocus={() => setAbierto(true)} onKeyDown={teclas}
            placeholder="Buscar cliente o lead…"
            title="Empresa, contacto, correo, teléfono, cuenta SACS o folio"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '10px 0', fontSize: '0.85rem', fontFamily: 'inherit' }} />
        </div>
        <button onClick={abrirAlta} style={{ ...S.btnSmall, marginRight: 0, whiteSpace: 'nowrap' as const, padding: '0 14px', fontWeight: 700 }}>+ Nuevo</button>
      </div>
      {/* Lo que ya estaba escrito en la cotización, a un clic: es el caso más
          común —abrir una vieja sin ligar— y obliga a retecleárselo. */}
      {!q && (valorInicial || '').trim().length > 1 && (
        <button onClick={() => buscar((valorInicial || '').trim())}
          style={{ border: '1px solid #e6e2ef', background: '#f4f2f8', color: '#5b4a91', borderRadius: 20, padding: '5px 12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
          Buscar “{(valorInicial || '').trim()}”
        </button>
      )}
      {abierto && q.trim().length >= 2 && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6, zIndex: 41, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,0.12)', maxHeight: 340, overflowY: 'auto' }}>
            {res.length > 0 && (
              <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderBottom: '1px solid #f2f2f2', background: '#fcfcfd', position: 'sticky' as const, top: 0 }}>
                {([['todos', 'Todos'], ['cliente', 'Clientes'], ['lead', 'Leads'], ['excliente', 'Exclientes']] as const).map(([k, t]) => {
                  const n = k === 'todos' ? res.length : res.filter((r: any) => r.clase === k).length;
                  if (!n && k !== 'todos') return null;
                  return (
                    <button key={k} onClick={() => { setFiltro(k); setCursor(0); }}
                      style={{ border: 'none', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                        background: filtro === k ? '#1a1a1a' : '#f2f3f5', color: filtro === k ? '#fff' : '#6b7280' }}>
                      {t} <span style={{ opacity: 0.55 }}>{n}</span>
                    </button>
                  );
                })}
                <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: '#b8b8b8', alignSelf: 'center' }}>↑↓ mover · ↵ elegir</span>
              </div>
            )}
            {buscando && <div style={{ padding: 10, fontSize: '0.78rem', color: '#999' }}>Buscando…</div>}
            {!buscando && visibles.length === 0 && <div style={{ padding: 10, fontSize: '0.78rem', color: '#999' }}>Sin resultados.</div>}
            {visibles.map((r: any, i: number) => {
              const cl = clases[r.clase] || clases.lead;
              return (
                <div key={i} onClick={() => elegir(r)} onMouseEnter={() => setCursor(i)}
                  style={{ padding: '9px 10px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5', background: cursor === i ? '#f7f7fa' : '#fff' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                    {r.empresa || r.contacto}
                    <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: cl.bg, color: cl.fg }}>{cl.txt}</span>
                    {r.sacs_account && <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#f4f5f7', color: '#5b6472' }}>{r.sacs_account}</span>}
                    {r.dup && <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#fdecec', color: '#b4302f' }}>posible duplicado</span>}
                    {r.via_folio && <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#eef2ff', color: '#3764c4' }}>por {r.via_folio}</span>}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#888' }}>{[r.contacto, r.email, r.whatsapp].filter(Boolean).join(' · ')}</div>
                  {r.n ? (
                    <div style={{ fontSize: '0.7rem', color: '#8a8a8a', marginTop: 2 }}>
                      {r.n} cotización{r.n === 1 ? '' : 'es'}
                      {r.ultima ? <> · última {r.ultima.numero} por ${Number(r.ultima.total || 0).toLocaleString('es-MX')} — <b style={{ color: estadoCol[r.ultima.estado] || '#8a8a8a' }}>{estadoTxt[r.ultima.estado] || r.ultima.estado}</b></> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <button onClick={abrirAlta} style={{ width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: '#fafafa', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: '#1a1a1a' }}>
              + Crear "{q.trim()}" como cliente nuevo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
