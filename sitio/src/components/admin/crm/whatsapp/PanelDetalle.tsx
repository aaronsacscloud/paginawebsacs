// WHATSAPP · Panel de detalle PRO (portado de sacs_inbox/RightPanel): railito
// de tabs (Acciones / Info / Adjuntos / Notas), sub-tabs Info|Actividad,
// EditableFieldRow con Enter/Escape/blur, PhoneFieldRow con lada, grupos
// colapsables, quick actions en grid, y footer fijo de etiquetas.
// Data del CRM: company360 + contacts/[id]. Sin memoria IA ni SACS3.
import { useEffect, useRef, useState } from 'react';
import { telefonoLegible } from '../../../../lib/telefono';
import { useLifecycle, lifecycleDe } from '../../../../lib/crm/lifecycle';
import { pintaEstatus } from '../../../../lib/crm/estatus-lead';
import { useCatalogoEtiquetas } from '../Etiquetas';
import ClienteDrawer360 from '../ClienteDrawer360';
import { Avatar } from './ListaConversaciones';
import { Corazones } from '../ui/Cargando';
import { srcMedia } from './Burbuja';
import VisorMedia, { extensionDe } from './VisorMedia';
import { C, L, label, haceCuanto } from './estilo';
import AccionesVenta, { EstiloAccv } from './AccionesVenta';
import { IcoMas, IcoContacto, IcoClip, IcoBurbuja, IcoChevronAbajo, IcoChevronArriba, IcoLapiz, IcoCopiar } from './Iconos';

const money = (n: any) => (n || n === 0) ? `$${Math.round(Number(n)).toLocaleString('es-MX')}` : '—';
const fecha = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const tag = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 9, fontWeight: 700, background: bg, color: fg, borderRadius: 999, padding: '2px 7px', whiteSpace: 'nowrap', display: 'inline-block' });

type Tab = 'acciones' | 'info' | 'adjuntos' | 'notas';
const TABS: { id: Tab; Ico: any; t: string; accent?: boolean }[] = [
  { id: 'acciones', Ico: IcoMas, t: 'Acciones', accent: true },
  { id: 'info', Ico: IcoContacto, t: 'Info. del contacto' },
  { id: 'adjuntos', Ico: IcoClip, t: 'Archivos adjuntos' },
  { id: 'notas', Ico: IcoBurbuja, t: 'Notas' },
];

// ── Tarjeta KPI del panel: franja de color, etiqueta versalitas, cifra en tinta.
//    Clickeable: abre el detalle de esa tarjeta (breadcrumb ← Resumen). ──
function TarjetaKpi({ color, tinta, etiqueta, cifra, sub, onClick }: { color: string; tinta: string; etiqueta: string; cifra: string; sub?: string; onClick?: () => void }) {
  const activa = !!onClick;
  return (
    <button onClick={onClick} disabled={!activa} style={{
      textAlign: 'left', fontFamily: 'inherit', background: '#fff', borderRadius: 10,
      border: `1px solid ${C.g100}`, borderLeft: `3px solid ${color}`, padding: '9px 11px',
      cursor: activa ? 'pointer' : 'default', display: 'block', width: '100%', minWidth: 0,
    }}
      onMouseEnter={e => { if (activa) { e.currentTarget.style.borderColor = '#d5cdf9'; e.currentTarget.style.borderLeftColor = color; e.currentTarget.style.background = 'rgba(249,248,255,.8)'; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.g100; e.currentTarget.style.borderLeftColor = color; e.currentTarget.style.background = '#fff'; }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: C.g400 }}>{etiqueta}</span>
        {activa && <span aria-hidden style={{ marginLeft: 'auto', color: C.g300, fontSize: 10 }}>›</span>}
      </span>
      <b style={{ display: 'block', fontSize: 14.5, color: tinta, letterSpacing: '-0.01em', margin: '2px 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{cifra}</b>
      {sub && <span title={sub} style={{ display: 'block', fontSize: 10, color: C.g400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
    </button>
  );
}

// ── CollapsibleSection (portado) ──
function Seccion({ id, titulo, n, abiertaDefault, children }: { id: string; titulo: string; n?: number | null; abiertaDefault?: boolean; children: React.ReactNode }) {
  const KEY = 'wa_panel_secciones';
  const leer = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const [abierta, setAbierta] = useState<boolean>(() => { const m = leer(); return id in m ? m[id] : !!abiertaDefault; });
  const toggle = () => { const v = !abierta; setAbierta(v); try { localStorage.setItem(KEY, JSON.stringify({ ...leer(), [id]: v })); } catch { /* privado */ } };
  return (
    <div>
      <button onClick={toggle} aria-expanded={abierta}
        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '10px 16px' }}>
        <span style={label(11)}>{titulo}</span>
        {n != null && n > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: C.g100, color: C.g500, borderRadius: 999, minWidth: 22, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{n}</span>}
        <span style={{ marginLeft: 'auto', color: C.g400, display: 'inline-flex' }}>{abierta ? <IcoChevronArriba size={13} /> : <IcoChevronAbajo size={13} />}</span>
      </button>
      {abierta && <div style={{ padding: '0 16px 12px' }}>{children}</div>}
    </div>
  );
}

// ── EditableFieldRow (portado: hover lapicito, click→input, Enter/Escape/blur) ──
function Campo({ etiqueta, valor, onGuardar, type = 'text', opciones, readOnly, copiable, placeholder = 'Sin datos', formato }: {
  etiqueta: string; valor?: string | null; onGuardar?: (v: string) => void; type?: string;
  opciones?: { v: string; l: string }[]; readOnly?: boolean; copiable?: boolean; placeholder?: string; formato?: (v: string) => string;
}) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(valor || '');
  const [hover, setHover] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const ref = useRef<any>(null);
  useEffect(() => { setV(valor || ''); }, [valor]);
  useEffect(() => { if (editando) setTimeout(() => ref.current?.focus(), 0); }, [editando]);
  const guardar = () => { setEditando(false); if (v !== (valor || '')) onGuardar?.(v); };
  const mostrado = valor ? (formato ? formato(valor) : (opciones?.find(o => o.v === valor)?.l || valor)) : null;
  if (editando && !readOnly) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 12px', background: 'rgba(238,236,254,.35)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.moradoTinta, flexShrink: 0 }}>{etiqueta}</span>
        {opciones ? (
          <select ref={ref} value={v} onChange={e => { setV(e.target.value); setEditando(false); if (e.target.value !== (valor || '')) onGuardar?.(e.target.value); }} onBlur={() => setEditando(false)}
            style={{ flex: 1, minWidth: 0, border: `1px solid #c9bcf7`, borderRadius: 6, padding: '4px 6px', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
            <option value="">—</option>{opciones.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        ) : (
          <input ref={ref} type={type} value={v} onChange={e => setV(e.target.value)} onBlur={guardar}
            onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') { setV(valor || ''); setEditando(false); } }}
            style={{ flex: 1, minWidth: 0, border: `1px solid #c9bcf7`, borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'inherit', textAlign: 'right', outline: 'none' }} />
        )}
      </div>
    );
  }
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={() => !readOnly && setEditando(true)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 12px', cursor: readOnly ? 'default' : 'pointer', background: hover && !readOnly ? 'rgba(249,250,251,.7)' : 'transparent' }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.g400, textTransform: 'uppercase', letterSpacing: '.04em' }}>{etiqueta}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: mostrado ? C.g900 : C.g300, fontStyle: mostrado ? 'normal' : 'italic', overflowWrap: 'anywhere', lineHeight: 1.35 }}>
          {mostrado || placeholder}
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        {copiable && valor && (
          <button onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(valor); setCopiado(true); setTimeout(() => setCopiado(false), 1200); }} title="Copiar"
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: copiado ? C.emerald600 : C.g300, padding: 0, display: 'inline-flex' }}><IcoCopiar size={12} /></button>
        )}
        {!readOnly && <span style={{ color: hover ? C.g500 : C.g300, display: 'inline-flex' }}><IcoLapiz size={12} /></span>}
      </span>
    </div>
  );
}

const LADAS = [{ c: '52', b: '🇲🇽' }, { c: '1', b: '🇺🇸' }, { c: '57', b: '🇨🇴' }, { c: '54', b: '🇦🇷' }, { c: '34', b: '🇪🇸' }, { c: '55', b: '🇧🇷' }, { c: '56', b: '🇨🇱' }, { c: '51', b: '🇵🇪' }];
function CampoTelefono({ etiqueta, valor, onGuardar }: { etiqueta: string; valor?: string | null; onGuardar: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const digitos = (valor || '').replace(/\D/g, '');
  const ladaIni = LADAS.find(l => digitos.startsWith(l.c) && digitos.length > 10)?.c || '52';
  const [lada, setLada] = useState(ladaIni);
  const [num, setNum] = useState(digitos.startsWith(ladaIni) && digitos.length > 10 ? digitos.slice(ladaIni.length) : digitos);
  const [hover, setHover] = useState(false);
  const valido = num.length >= 10;
  const guardar = () => { if (valido) onGuardar(`+${lada}${num}`); setEditando(false); };
  if (editando) {
    return (
      <div style={{ padding: '6px 12px', background: 'rgba(238,236,254,.35)' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.moradoTinta, flexShrink: 0 }}>{etiqueta}</span>
          <select value={lada} onChange={e => setLada(e.target.value)} style={{ width: 90, border: `1px solid #c9bcf7`, borderRadius: 6, padding: '4px 4px', fontSize: 12, fontFamily: 'inherit' }}>
            {LADAS.map(l => <option key={l.c} value={l.c}>{l.b} +{l.c}</option>)}
          </select>
          <input autoFocus type="tel" value={num} onChange={e => setNum(e.target.value.replace(/\D/g, ''))} onBlur={guardar}
            onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') setEditando(false); }}
            style={{ flex: 1, minWidth: 0, border: `1px solid #c9bcf7`, borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
        </div>
        {!valido && <div style={{ fontSize: 10, color: C.rojo500, marginTop: 3, textAlign: 'right' }}>Mínimo 10 dígitos</div>}
      </div>
    );
  }
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={() => setEditando(true)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 12px', cursor: 'pointer', background: hover ? 'rgba(249,250,251,.7)' : 'transparent' }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.g400, textTransform: 'uppercase', letterSpacing: '.04em' }}>{etiqueta}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: valor ? C.g900 : C.g300, fontStyle: valor ? 'normal' : 'italic', whiteSpace: 'nowrap' }}>{valor ? `${LADAS.find(l => l.c === ladaIni)?.b || ''} ${telefonoLegible(valor)}` : 'Sin datos'}</span>
      </span>
      <span style={{ color: hover ? C.g500 : C.g300, display: 'inline-flex', flexShrink: 0 }}><IcoLapiz size={12} /></span>
    </div>
  );
}

const ESTADO_SUB: Record<string, [string, string]> = { activa: [C.emerald50, C.emerald700], pausada: [C.ambar50, C.ambar700], cancelada: [C.rojo50, '#C0554E'] };


// ── Secuencias del contacto: qué recibe en automático y el freno de mano ──
function SeccionSecuencias({ contactId }: { contactId: string }) {
  const [datos, setDatos] = useState<any[] | null>(null);
  const [ocupado, setOcupado] = useState('');
  const cargar = () => fetch(`/api/crm/secuencias/miembro?contact_id=${contactId}`)
    .then(r => r.json()).then(j => setDatos(j.secuencias || [])).catch(() => setDatos([]));
  useEffect(() => { setDatos(null); cargar(); }, [contactId]);
  const accion = async (secuenciaId: string, a: string) => {
    setOcupado(secuenciaId);
    await fetch('/api/crm/secuencias/miembro', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId, secuencia_id: secuenciaId, accion: a }) }).catch(() => {});
    setOcupado(''); cargar();
  };
  if (datos === null || !datos.length) return null;
  const conAlgo = datos;   // todas: el vendedor debe saber qué secuencias existen
  const MOT: Record<string, string> = { respondio: 'respondió', agendo: 'agendó', convertido: 'se hizo cliente', descartado: 'descartado', corte: 'llegó al corte', optout: 'baja de WA', archivado: 'archivado', pausado_manual: 'pausada a mano', viejo_al_activar: 'era muy viejo', demo_hecha: 'asistió a la demo', cancelo: 'canceló la sesión' };
  return (
    <Seccion id="g-secuencias" titulo="Secuencias" n={conAlgo.filter(d => d.estado === 'dentro').length || null}>
      <div style={{ margin: '0 16px 10px', border: `1px solid ${C.g200}`, borderRadius: 10, overflow: 'hidden' }}>
        {conAlgo.map((d, i) => (
          <div key={d.id} style={{ padding: '9px 12px', borderTop: i ? `1px solid ${C.g100}` : 'none', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.g700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</span>
              {d.estado === 'dentro' && <span style={{ fontSize: 9, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: C.emerald50, color: C.emerald700 }}>DÍA {d.dia}</span>}
              {d.estado === 'detenida' && <span style={{ fontSize: 9, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: C.g100, color: C.g500 }}>{MOT[d.motivo] || d.motivo || 'detenida'}</span>}
              {!d.activa && <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: C.ambar50, color: C.ambar700 }}>secuencia apagada</span>}
              {d.estado === 'fuera' && <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: C.g50, color: C.g400 }}>fuera</span>}
            </div>
            {d.estado === 'dentro' && (d.canales_detenidos?.wa || d.canales_detenidos?.correo) && (
              <div style={{ fontSize: 10, color: C.ambar700, marginTop: 3 }}>
                {d.canales_detenidos?.wa && 'WhatsApps detenidos (respondió por WA) — correos siguen. '}
                {d.canales_detenidos?.correo && 'Correos detenidos (respondió por correo) — WhatsApps siguen.'}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
              {d.estado === 'dentro' && (
                <button disabled={ocupado === d.id} onClick={() => accion(d.id, 'pausar')}
                  style={{ border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 7, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: C.rojo700, cursor: 'pointer', fontFamily: 'inherit' }}>Pausar envíos</button>
              )}
              {d.estado === 'detenida' && d.motivo === 'pausado_manual' && (
                <button disabled={ocupado === d.id} onClick={() => accion(d.id, 'reanudar')}
                  style={{ border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 7, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: C.emerald700, cursor: 'pointer', fontFamily: 'inherit' }}>Reanudar</button>
              )}
              {(d.estado === 'fuera' || (d.estado === 'detenida' && d.motivo !== 'pausado_manual')) && d.activa && (
                <button disabled={ocupado === d.id} onClick={() => accion(d.id, 'inscribir')}
                  style={{ border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 7, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: C.moradoTinta, cursor: 'pointer', fontFamily: 'inherit' }}>Inscribir (día 1 hoy)</button>
              )}
              {d.enviados_n > 0 && <span style={{ fontSize: 10, color: C.g400, alignSelf: 'center' }}>{d.enviados_n} envíos</span>}
            </div>
          </div>
        ))}
      </div>
    </Seccion>
  );
}

export default function PanelDetalle({ hilo, api, filaActiva }: { hilo: any; api: any; filaActiva?: any }) {
  // Fila VIRTUAL (contacto sin conversación): el panel funciona igual, con los
  // datos del CRM; hilo llega null y todo lo de mensajes queda vacío.
  const conv = hilo?.conversacion || (filaActiva?.virtual ? {
    id: null, telefono: filaActiva.telefono, contact_id: filaActiva.contact_id, company_id: filaActiva.company_id,
    contacts: filaActiva.contacto ? { id: filaActiva.contacto.id, nombre: filaActiva.contacto.nombre, email: filaActiva.contacto.email, lifecycle_stage: filaActiva.contacto.lifecycle_stage, tipo: filaActiva.contacto.tipo } : null,
    companies: filaActiva.empresa ? { id: filaActiva.empresa.id, nombre: filaActiva.empresa.nombre, nombre_comercial: filaActiva.empresa.nombre, plan: filaActiva.empresa.plan, mrr: filaActiva.empresa.mrr } : null,
  } : null);
  const contactoBase = conv?.contacts || null;
  const [tab, setTab] = useState<Tab>('info');
  const [abiertoPanel, setAbiertoPanel] = useState(true);
  const [subInfo, setSubInfo] = useState<'info' | 'actividad' | 'acciones'>('info');
  const ventanaAbierta = !!(conv?.ultimo_entrante_at && Date.now() - Date.parse(conv.ultimo_entrante_at) < 24 * 3600e3);
  // El CSS móvil del CRM aplana botones con !important: los targets táctiles
  // de las acciones ejecutables se defienden con clase propia.
  const cssAcciones = `
    .accv button { min-height: 44px !important; }
    .accv .accv-grande { min-height: 48px !important; }
    .accv-tap { min-height: 44px !important; }
  `;
  const [nonceCtx, setNonceCtx] = useState(0);   // acciones recién ejecutadas → recargar el contexto
  const [accionInicial, setAccionInicial] = useState<'cotizar' | 'agendar' | null>(null);
  /* Los atajos del composer hablan por el MISMO evento en los dos aparatos.
     En el teléfono abren la hoja de acciones; aquí saltan a la pestaña. El
     composer no tiene por qué saber en cuál de los dos está: si lo supiera,
     cada pantalla nueva tendría que acordarse de avisarle. */
  useEffect(() => {
    const h = (e: any) => {
      setAccionInicial(e?.detail === 'agendar' ? 'agendar' : 'cotizar');
      setTab('acciones');
    };
    document.addEventListener('wa-acciones', h);
    return () => document.removeEventListener('wa-acciones', h);
  }, []);
  const [detalle, setDetalle] = useState<string | null>(null);   // drill-down de una tarjeta (breadcrumb ← Resumen)
  const [ficha, setFicha] = useState(false);
  const [alta, setAlta] = useState<{ empresa: string; contacto: string; email: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  const [d360, setD360] = useState<any>(null);
  const [dCon, setDCon] = useState<any>(null);
  const [ctx, setCtx] = useState<any>(null);            // /panel: salud, desde_ultimo, otros, sugerencias, sacs, propiedades
  const [filtroAct, setFiltroAct] = useState<string>('todo');   // 18
  const cacheId = useRef<string | null>(null);
  const yo = hilo?.yo || null;
  const etapasCat = useLifecycle();
  // 21) Un CS ve el dinero solo de sus cuentas; founder ve todo.
  const ocultarDinero = yo?.rol === 'cs' && ctx?.contacto?.owner_id && ctx.contacto.owner_id !== yo.id;

  useEffect(() => {
    const k = `${conv?.id}|${conv?.company_id}|${conv?.contact_id}|${nonceCtx}`;
    if (!conv || cacheId.current === k) return;
    cacheId.current = k; setD360(null); setDCon(null); setDetalle(null);
    if (conv.company_id) fetch(`/api/crm/arr/company360?id=${conv.company_id}`).then(r => r.json()).then(setD360).catch(() => {});
    if (conv.contact_id) fetch(`/api/crm/contacts/${conv.contact_id}`).then(r => r.json()).then(setDCon).catch(() => {});
    setCtx(null);
    const qs = conv.id ? `wa_id=${conv.id}` : conv.contact_id ? `contact_id=${conv.contact_id}` : conv.company_id ? `company_id=${conv.company_id}` : '';
    if (qs) fetch(`/api/crm/whatsapp/panel?${qs}`).then(r => r.json()).then(setCtx).catch(() => {});
  }, [conv?.id, conv?.company_id, conv?.contact_id, nonceCtx]);
  const ligar = async (contactId: string, companyId?: string | null) => {
    await api.patchConversacion({ contact_id: contactId, company_id: companyId || null });
    cacheId.current = null;
  };

  const contacto = dCon?.contact || dCon || contactoBase;
  const empresa = d360?.company || conv?.companies || null;
  const nombre = contactoBase ? `${contactoBase.nombre || ''} ${contactoBase.apellido || ''}`.trim() : null;
  const etapa = lifecycleDe(contactoBase?.lifecycle_stage);
  // Leads v2: la pastilla del estatus operativo (solo tiene sentido en venta).
  const _est = (contacto as any)?.estatus_lead ?? (conv as any)?._extra?.estatus_lead;
  const _ret = (contacto as any)?.retenido_hasta ?? (conv as any)?._extra?.retenido_hasta;
  const estatusPill = _est ? pintaEstatus(_est, _ret) : null;
  const subs: any[] = (d360?.subscriptions || []).filter(Boolean);
  const deals: any[] = (dCon?.deals || []).filter((d: any) => !['ganado', 'perdido', 'won', 'lost'].includes(String(d.stage || d.etapa || '').toLowerCase()));
  const quotes: any[] = (d360?.quotes || dCon?.quotes || []).slice(0, 5);
  const bookings: any[] = (d360?.bookings || dCon?.bookings || []);
  const proxima = bookings.filter(b => new Date(b.fecha) >= new Date(Date.now() - 86400000)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))[0] || null;
  const timeline: any[] = (d360?.timeline || dCon?.activities || []).slice(0, 12);
  const resumen = d360?.resumen || null;
  // TODO el panel se mide en ARR: si el 360 no lo trae, se anualiza el MRR.
  const arr = (resumen?.arr ?? empresa?.arr ?? null) != null ? Number(resumen?.arr ?? empresa?.arr) : (Number(resumen?.mrr ?? empresa?.mrr) || 0) * 12;
  const arrSub = (su: any) => su.ciclo === 'anual' ? Number(su.precio) || 0 : (Number(su.precio) || 0) * 12;
  const subsActivas = (d360?.subscriptions || []).filter((x: any) => x && String(x.estado || '').match(/activ|trial|prueba/i));
  // Cliente = paga (subs activas o ARR > 0); lo demás es lead en conversión.
  const esCliente = subsActivas.length > 0 || arr > 0;
  const dealsAbiertos = (dCon?.deals || d360?.deals || []).filter((x: any) => x && !['ganado', 'perdido', 'won', 'lost'].includes(String(x.stage || x.etapa || '').toLowerCase()));
  const pipelineTotal = dealsAbiertos.reduce((t: number, x: any) => t + (Number(x.monto ?? x.amount) || 0), 0);
  const utm = Object.entries({ ...(ctx?.propiedades?.contacto || {}) }).filter(([k]) => /^(utm_|tiktok|fbclid|gclid|referr)/i.test(k));
  const media = (hilo?.mensajes || []).filter((m: any) => (m.media_url || m.media_id) && !m.borrado_at).map((m: any) => ({ ...m, _src: srcMedia(m), _dl: srcMedia(m, true) }));
  const notas = hilo?.notas || [];

  const crear = async () => {
    if (!alta?.empresa.trim()) { setMsg('El nombre de la empresa es obligatorio.'); return; }
    setOcupado(true); setMsg('');
    const r = await api.crearContacto({ empresa: alta.empresa.trim(), contacto: alta.contacto.trim(), email: alta.email.trim() || undefined });
    setOcupado(false);
    if (r?.error) { setMsg(r.error); return; }
    setAlta(null); cacheId.current = null;
  };
  const guardar = (campo: string) => (v: string) => { if (contactoBase?.id) api.guardarContacto(contactoBase.id, { [campo]: v || null }); };
  const guardarEmpresa = (campo: string) => async (v: string) => {
    if (!empresa?.id) return;
    await fetch('/api/crm/companies', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: empresa.id, [campo]: v || null }) }).catch(() => {});
    cacheId.current = null; api.refrescar?.();
  };

  const caja: React.CSSProperties = { borderRadius: 12, border: `1px solid ${C.g100}`, overflow: 'hidden' };
  const divisor: React.CSSProperties = { borderTop: `1px solid ${C.g100}` };

  const TabInfo = () => (
    <div>
      {/* Encabezado: quién es (lead vs cliente) */}
      <div style={{ margin: '12px 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: esCliente ? C.emerald700 : C.moradoTinta, background: esCliente ? C.emerald50 : C.moradoAgua, borderRadius: 999, padding: '3px 10px' }}>
          {empresa || contactoBase ? (esCliente ? 'Cliente' : 'Lead') : 'Desconocido'}
        </span>
        {etapa && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: C.g700 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: etapa.fg, opacity: .65 }} />{etapa.label}</span>}
        {!esCliente && estatusPill && <span title="Estatus operativo: se deriva de los hechos (mensajes, llamadas, reuniones, cotizaciones)" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.02em', borderRadius: 999, padding: '3px 10px', background: estatusPill.fondo, color: estatusPill.tinta }}>{estatusPill.label}</span>}
        {empresa && <button onClick={() => setFicha(true)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: C.moradoTinta }}>Ver ficha →</button>}
      </div>

      {/* Resumen compacto: los 5 datos que se leen de un vistazo. Antes eran
          cuatro tarjetas grandes que se comían media pantalla; lo que de verdad
          se consulta a diario son los datos de contacto de abajo. */}
      {(empresa || contactoBase) && (
        <div style={{ margin: '0 16px 10px', borderRadius: 10, border: `1px solid ${C.g100}`, background: 'rgba(250,250,252,.7)', padding: '9px 12px' }}>
          {[
            ['Marca', empresa?.nombre_comercial || empresa?.nombre || null],
            ['Sucursales', empresa?.sucursales != null ? String(empresa.sucursales) : null],
            ['Registro', contacto?.created_at ? fecha(contacto.created_at) : null],
            ['Interacción', hilo?.mensajes?.length
              ? `${hilo.mensajes.length} mensaje${hilo.mensajes.length === 1 ? '' : 's'}${conv?.ultimo_mensaje_at ? ` · ${haceCuanto(conv.ultimo_mensaje_at)}` : ''}`
              : (timeline.length ? `${timeline.length} evento${timeline.length === 1 ? '' : 's'} en el CRM` : null)],
            ['Visitas web', ctx?.web?.en_vivo
              ? `● AHORA en ${ctx.web.en_vivo}`
              : ctx?.web?.total ? `${ctx.web.total} páginas · ${ctx.web.ultima}` : null],
          ].map(([et, v]: any, i: number) => (
            <div key={et} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', borderTop: i ? `1px solid ${C.g50}` : 'none' }}>
              <span style={{ fontSize: 10, color: C.g400, width: 78, flexShrink: 0 }}>{et}</span>
              <span style={{ fontSize: 12, color: v ? C.g900 : C.g300, fontWeight: v ? 600 : 400, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {v || (et === 'Visitas web' ? 'aún no se rastrean' : 'sin dato')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Atajos al detalle: mismos destinos de antes, en pastillas discretas. */}
      {(empresa || contactoBase) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '0 16px 10px' }}>
          {(esCliente
            ? [
                !ocultarDinero && ['suscripciones', `ARR ${money(arr)}`, C.emerald50, C.emerald700],
                ['salud', ctx?.salud?.dias_renovacion != null ? (ctx.salud.dias_renovacion < 0 ? `Renovación vencida` : `Renueva en ${ctx.salud.dias_renovacion} d`) : 'Salud', ctx?.salud?.nivel === 'rojo' ? C.rojo50 : ctx?.salud?.nivel === 'ambar' ? C.ambar100 : C.emerald50, ctx?.salud?.nivel === 'rojo' ? C.rojo700 : ctx?.salud?.nivel === 'ambar' ? C.ambar700 : C.emerald700],
                ctx?.sacs && ['sacs', ctx.sacs.dias_sin_venta === 0 ? 'Vendió hoy' : ctx.sacs.dias_sin_venta != null ? `${ctx.sacs.dias_sin_venta} d sin vender` : 'Uso de SACS', C.moradoAgua, C.moradoTinta],
                (d360?.quotes || []).length && ['cotizaciones', `${d360.quotes.length} cotización${d360.quotes.length === 1 ? '' : 'es'}`, C.azulAgua, C.azulTinta],
              ]
            : [
                ['conversion', etapa?.label || 'Conversión', C.moradoAgua, C.moradoTinta],
                !ocultarDinero && ['oportunidad', dealsAbiertos.length ? `Pipeline ${money(pipelineTotal)}` : 'Sin oportunidades', C.emerald50, C.emerald700],
                ['origen', contacto?.fuente ? `Origen: ${contacto.fuente}` : 'Sin origen', C.azulAgua, C.azulTinta],
                ['interacciones', 'Interacciones', C.ambar100, C.ambar700],
              ]
          ).filter(Boolean).map((x: any) => {
            const [id, txt, bg, fg] = x;
            return (
              <button key={id} onClick={() => setDetalle(id)} style={{
                border: 'none', borderRadius: 999, padding: '4px 11px', background: bg, color: fg,
                fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', maxWidth: '100%',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{txt} ›</button>
            );
          })}
        </div>
      )}

      {hilo?.marketing?.stopped && <div style={{ margin: '4px 16px 0' }}><span style={tag(C.ambar100, C.ambar700)} title="Registrado por Meta: el cliente pidió no recibir marketing por WhatsApp">Sin marketing por WhatsApp</span></div>}

      {/* 14) Qué pasó desde nuestro último mensaje */}
      {ctx?.desde_ultimo && (ctx.desde_ultimo.pagos.n > 0 || ctx.desde_ultimo.correos_abiertos > 0 || ctx.desde_ultimo.reuniones > 0 || ctx.desde_ultimo.correos_recibidos > 0 || ctx.desde_ultimo.uso_sacs.length > 0) && (
        <div style={{ margin: '8px 16px 0', borderRadius: 12, border: `1px solid ${C.azulBorde}`, background: C.azulAgua, padding: '9px 12px', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}><span style={{ ...label(10), color: C.azulTinta }}>Desde tu último mensaje</span><span style={{ fontSize: 10, color: C.azulTinta, opacity: .8 }}>{haceCuanto(ctx.desde_ultimo.desde)}</span></div>
          <ul style={{ margin: 0, paddingLeft: 16, color: C.g700, lineHeight: 1.6 }}>
            {ctx.desde_ultimo.pagos.n > 0 && <li>{ocultarDinero ? `Pagó ${ctx.desde_ultimo.pagos.n} vez${ctx.desde_ultimo.pagos.n === 1 ? '' : 'es'}` : `Pagó ${money(ctx.desde_ultimo.pagos.monto)}${ctx.desde_ultimo.pagos.n > 1 ? ` en ${ctx.desde_ultimo.pagos.n} pagos` : ''}`}</li>}
            {ctx.desde_ultimo.correos_abiertos > 0 && <li>Abrió {ctx.desde_ultimo.correos_abiertos} correo{ctx.desde_ultimo.correos_abiertos === 1 ? '' : 's'}{ctx.desde_ultimo.clics > 0 ? ` y dio ${ctx.desde_ultimo.clics} clic${ctx.desde_ultimo.clics === 1 ? '' : 's'}` : ''}</li>}
            {ctx.desde_ultimo.correos_recibidos > 0 && <li>Te escribió por correo</li>}
            {ctx.desde_ultimo.reuniones > 0 && <li>Agendó {ctx.desde_ultimo.reuniones} reunión{ctx.desde_ultimo.reuniones === 1 ? '' : 'es'}</li>}
            {ctx.desde_ultimo.uso_sacs.length > 0 && <li>Usó SACS: {ctx.desde_ultimo.uso_sacs.join(', ')}</li>}
          </ul>
        </div>
      )}

      {/* 16) Número desconocido: pistas para ligarlo */}
      {!contactoBase && ctx?.sugerencias?.length > 0 && (
        <div style={{ margin: '8px 16px 0', borderRadius: 12, border: `1px solid ${C.ambar200}`, background: C.ambar50, padding: '9px 12px' }}>
          <div style={{ ...label(10), color: C.ambar700, marginBottom: 6 }}>¿Quién es? Pistas del CRM</div>
          {ctx.sugerencias.map((sg: any) => (
            <div key={sg.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sg.nombre || sg.email}{sg.empresa ? ` · ${sg.empresa}` : ''}</b>
                <span style={{ fontSize: 10, color: C.g500 }}>{sg.motivo}</span>
              </span>
              <button onClick={() => ligar(sg.id, sg.company_id)} style={{ border: 'none', background: C.ambar400, color: '#fff', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Es este</button>
            </div>
          ))}
        </div>
      )}

      {/* Alta mínima */}
      {!contactoBase && !empresa && (
        <div style={{ padding: '10px 16px' }}>
          {!alta ? (<>
            <p style={{ fontSize: 12, color: C.g500, lineHeight: 1.5, margin: '0 0 8px' }}>Este número no está en el CRM. Créalo como lead para ligar la conversación y el seguimiento.</p>
            <button onClick={() => setAlta({ empresa: '', contacto: '', email: '' })} style={{ border: 'none', borderRadius: 8, padding: '8px 14px', background: C.morado, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Crear contacto</button>
          </>) : (<>
            {[['Empresa *', 'empresa'], ['Nombre del contacto', 'contacto'], ['Email', 'email']].map(([l, k]) => (
              <div key={k} style={{ marginBottom: 8 }}>
                <label style={{ ...label(10), display: 'block', marginBottom: 3 }}>{l}</label>
                <input value={(alta as any)[k]} onChange={e => setAlta({ ...alta, [k]: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit' }} />
              </div>
            ))}
            {msg && <div style={{ fontSize: 11, color: C.rojo500, marginBottom: 6 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={crear} disabled={ocupado} style={{ border: 'none', borderRadius: 8, padding: '8px 14px', background: C.morado, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{ocupado ? <Corazones size={8} color="#fff" /> : 'Crear y ligar'}</button>
              <button onClick={() => setAlta(null)} style={{ border: `1px solid ${C.g200}`, borderRadius: 8, padding: '8px 12px', background: '#fff', fontSize: 12, color: C.g700, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            </div>
          </>)}
        </div>
      )}

      {/* Grupos de campos (solo el 1º abierto) */}
      {contactoBase && (
        <Seccion id="g-contacto" titulo="Contacto" abiertaDefault>
          <div style={caja}>
            <Campo etiqueta="Nombre" valor={contactoBase.nombre} onGuardar={guardar('nombre')} />
            <div style={divisor} /><Campo etiqueta="Apellido" valor={contactoBase.apellido} onGuardar={guardar('apellido')} />
            <div style={divisor} /><Campo etiqueta="Email" valor={contactoBase.email} onGuardar={guardar('email')} type="email" copiable />
            <div style={divisor} /><CampoTelefono etiqueta="WhatsApp" valor={conv.telefono?.startsWith('+') ? conv.telefono : null} onGuardar={guardar('whatsapp')} />
            <div style={divisor} /><Campo etiqueta="Puesto" valor={contacto?.puesto} onGuardar={guardar('puesto')} />
            <div style={divisor} /><Campo etiqueta="Etapa" valor={contactoBase.lifecycle_stage} opciones={etapasCat.map(s => ({ v: s.id, l: `${(s as any).emoji || ''} ${s.label}`.trim() }))} onGuardar={guardar('lifecycle_stage')} />
            <div style={divisor} /><Campo etiqueta="Origen" valor={contacto?.fuente} readOnly />
          </div>
        </Seccion>
      )}
      {contactoBase && !esCliente && <SeccionSecuencias contactId={contactoBase.id} />}
      {empresa && (
        <Seccion id="g-empresa" titulo="Empresa" n={null}>
          <div style={caja}>
            <Campo etiqueta="Nombre comercial" valor={empresa.nombre_comercial || empresa.nombre} onGuardar={guardarEmpresa('nombre_comercial')} />
            <div style={divisor} /><Campo etiqueta="Plan" valor={empresa.plan} readOnly />
            <div style={divisor} /><Campo etiqueta="Estado" valor={empresa.estado_cuenta} readOnly />
            {!ocultarDinero && <><div style={divisor} /><Campo etiqueta="ARR" valor={String(arr || '')} readOnly formato={money} /></>}
            <div style={divisor} /><Campo etiqueta="Sucursales" valor={empresa.sucursales != null ? String(empresa.sucursales) : null} onGuardar={guardarEmpresa('sucursales')} />
            <div style={divisor} /><Campo etiqueta="Giro" valor={empresa.giro} onGuardar={guardarEmpresa('giro')} />
            <div style={divisor} /><Campo etiqueta="Cuenta SACS" valor={empresa.sacs_account} readOnly copiable />
          </div>
        </Seccion>
      )}
      {empresa && (
        <Seccion id="g-fiscal" titulo="Fiscal">
          <div style={caja}>
            <Campo etiqueta="RFC" valor={empresa.rfc} onGuardar={guardarEmpresa('rfc')} copiable />
            <div style={divisor} /><Campo etiqueta="Razón social" valor={empresa.razon_social} onGuardar={guardarEmpresa('razon_social')} />
          </div>
        </Seccion>
      )}
      {ctx?.otros_contactos?.length > 0 && (
        <Seccion id="g-otros" titulo="Otros contactos" n={ctx.otros_contactos.length}>
          {ctx.otros_contactos.map((oc: any) => (
            <div key={oc.id} style={{ padding: '7px 0', fontSize: 12, borderBottom: `1px solid ${C.g50}` }}>
              <b style={{ display: 'block' }}>{oc.nombre || oc.email || oc.whatsapp}{oc.es_principal ? <span style={{ fontSize: 9, fontWeight: 700, color: C.moradoTinta, background: C.moradoAgua, borderRadius: 999, padding: '0 6px', marginLeft: 6 }}>principal</span> : null}</b>
              <span style={{ fontSize: 11, color: C.g500, display: 'block', lineHeight: 1.4 }}>{[oc.puesto || oc.rol, oc.whatsapp || oc.telefono, oc.email].filter(Boolean).join(' · ')}</span>
              <span style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                {oc.wa_id ? <a href={`/admin/crm?tab=whatsapp&wa_conv=${oc.wa_id}`} style={{ fontSize: 11, fontWeight: 700, color: C.emerald700, textDecoration: 'none' }}>Ver chat</a>
                  : (oc.whatsapp || oc.telefono) ? <a href={`/admin/crm?tab=whatsapp&wa_search=${encodeURIComponent(oc.whatsapp || oc.telefono)}`} style={{ fontSize: 11, fontWeight: 700, color: C.moradoTinta, textDecoration: 'none' }}>Escribir</a> : null}
                {conv.id && <button title="Ligar esta conversación a este contacto" onClick={() => ligar(oc.id, empresa?.id)} style={{ border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 999, padding: '2px 9px', fontSize: 10, color: C.g500, cursor: 'pointer', fontFamily: 'inherit' }}>Es quien escribe</button>}
              </span>
            </div>
          ))}
        </Seccion>
      )}
      {ctx?.sacs && (
        <Seccion id="g-sacs" titulo="Cuenta SACS" n={ctx.sacs.modulos_activos.length}>
          <div style={{ fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
            <span style={tag(C.moradoAgua, C.moradoTinta)}>{ctx.sacs.cuenta}</span>
            {ctx.sacs.cuentas.length > 1 && <span style={tag(C.g100, C.g500)}>+{ctx.sacs.cuentas.length - 1} cuenta{ctx.sacs.cuentas.length - 1 === 1 ? '' : 's'}</span>}
            {ctx.sacs.dias_sin_venta != null && <span style={tag(ctx.sacs.dias_sin_venta > 7 ? C.ambar100 : C.emerald50, ctx.sacs.dias_sin_venta > 7 ? C.ambar700 : C.emerald700)}>{ctx.sacs.dias_sin_venta === 0 ? 'Vendió hoy' : `${ctx.sacs.dias_sin_venta} d sin vender`}</span>}
            {ctx.sacs.lealtad?.activo && <span style={tag(C.g100, C.g500)}>Lealtad {ctx.sacs.lealtad.tipo}</span>}
          </div>
          {ctx.sacs.modulos_activos.map((m: any) => (
            <div key={m.modulo} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, padding: '3px 0', fontSize: 12 }}>
              <span style={{ color: C.g700 }}>{m.modulo}</span>
              <span style={{ color: C.g400, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{Number(m.docs_30d || 0).toLocaleString('es-MX')} <span style={{ color: C.g300 }}>/30 d</span>{m.ultimo ? ` · ${new Date(m.ultimo + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}` : ''}</span>
            </div>
          ))}
          {!ctx.sacs.modulos_activos.length && <div style={{ fontSize: 12, color: C.g300 }}>Sin uso registrado todavía.</div>}
        </Seccion>
      )}
      {(() => {
        const props = { ...(ctx?.propiedades?.empresa || {}), ...(ctx?.propiedades?.contacto || {}) };
        const pares = Object.entries(props).filter(([, v]) => v != null && v !== '' && typeof v !== 'object');
        return pares.length ? (
          <Seccion id="g-props" titulo="Más datos" n={pares.length}>
            <div style={caja}>
              {pares.map(([k, v], i) => (<span key={k}>{i > 0 && <div style={divisor} />}<Campo etiqueta={k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())} valor={String(v)} readOnly copiable /></span>))}
            </div>
          </Seccion>
        ) : null;
      })()}
      {/* «Cotizar aquí» y «Agendar aquí» vivían también AQUÍ, y son los mismos
          dos botones que ya están en la barra del composer. Dos caminos al
          mismo sitio no dan más opciones: dan la duda de si hacen lo mismo. Se
          quedan donde se usan —abajo, mientras escribes— y esta columna se
          libera para lo que sí es de aquí: los datos del cliente. */}
      {(ctx?.llamadas || []).some((l: any) => l.minuta) && (
        <Seccion id="g-llamadas" titulo="Llamadas y minutas" n={(ctx.llamadas || []).filter((l: any) => l.minuta).length} abiertaDefault>
          {(ctx.llamadas || []).filter((l: any) => l.minuta).map((l: any) => <MinutaPanel key={l.call_id} l={l} />)}
        </Seccion>
      )}
      {contactoBase && (
        <Seccion id="g-seguimiento" titulo="Seguimiento" abiertaDefault>
          <div style={caja}>
            <Campo etiqueta="Próximo paso" valor={contacto?.proximo_paso} onGuardar={guardar('proximo_paso')} placeholder="¿Qué sigue?" />
            <div style={divisor} /><Campo etiqueta="Siguiente seguimiento" valor={contacto?.next_followup ? String(contacto.next_followup).slice(0, 10) : null} type="date" onGuardar={guardar('next_followup')} formato={fecha} placeholder="Agendar" />
          </div>
        </Seccion>
      )}
      {/* Clasificación hasta abajo: se consulta poco y arriba tapaba los datos
          de contacto, que son los que se usan todos los días. */}
      {(empresa || contactoBase) && (
        <Seccion id="g-clasif" titulo="Clasificación">
          <Clasificacion entidad={empresa ? 'company' : 'contact'} id={empresa?.id || contactoBase?.id} />
        </Seccion>
      )}
    </div>
  );

  // ── Drill-down de una tarjeta: breadcrumb "← Resumen › X" y el detalle completo ──
  const TITULO_DETALLE: Record<string, string> = {
    suscripciones: 'Suscripciones y ARR', salud: 'Salud de la cuenta', sacs: 'Uso de SACS', cotizaciones: 'Cotizaciones',
    conversion: 'Conversión del lead', oportunidad: 'Pipeline', origen: 'Origen del lead', interacciones: 'Interacciones',
  };
  const DetalleInfo = () => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px 6px', position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
        <button onClick={() => setDetalle(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: C.moradoTinta, padding: 0 }}>← Resumen</button>
        <span style={{ color: C.g300, fontSize: 11 }}>›</span>
        <b style={{ fontSize: 12.5 }}>{TITULO_DETALLE[detalle!] || 'Detalle'}</b>
      </div>
      <div style={{ padding: '4px 16px 16px' }}>
        {detalle === 'suscripciones' && (<>
          <div style={{ background: C.emerald50, borderRadius: 10, padding: '10px 13px', marginBottom: 10 }}>
            <span style={{ ...label(9), color: C.emerald700 }}>ARR total</span>
            <b style={{ display: 'block', fontSize: 20, color: C.emerald700, fontVariantNumeric: 'tabular-nums' }}>{money(arr)}</b>
            <span style={{ fontSize: 10.5, color: C.g500 }}>= lo que esta cuenta paga al año con sus planes actuales</span>
          </div>
          {!subs.length && <div style={{ fontSize: 12, color: C.g400 }}>Sin suscripciones registradas.</div>}
          {subs.map((su: any) => { const [bg, fg] = ESTADO_SUB[su.estado] || [C.g100, C.g500]; return (
            <div key={su.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 0', fontSize: 12, borderBottom: `1px solid ${C.g50}` }}>
              <span style={{ minWidth: 0, flex: 1 }}><b style={{ display: 'block' }}>{su.nombre_plan}</b>
                <span style={{ fontSize: 10, color: C.g400 }}>{su.ciclo === 'anual' ? 'anual' : 'mensual'}{su.proxima_renovacion ? ` · renueva ${fecha(su.proxima_renovacion)}` : ''}</span></span>
              <span style={tag(bg, fg)}>{su.estado}</span>
              <span style={{ color: C.emerald700, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(arrSub(su))}<span style={{ fontWeight: 500, fontSize: 9, color: C.g400 }}>/año</span></span>
            </div>); })}
          <a href="/admin/crm?tab=suscripciones" style={{ display: 'inline-block', marginTop: 10, fontSize: 11, fontWeight: 700, color: C.moradoTinta, textDecoration: 'none' }}>Ver en Suscripciones →</a>
        </>)}
        {detalle === 'salud' && ctx?.salud && (<>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            {ctx.salud.health_score != null && <span style={tag(C.g100, C.g700)}>Salud {ctx.salud.health_score}/100</span>}
            {ctx.salud.dias_renovacion != null && <span style={tag(ctx.salud.dias_renovacion < 0 ? C.rojo50 : ctx.salud.dias_renovacion <= 15 ? C.ambar100 : C.emerald50, ctx.salud.dias_renovacion < 0 ? C.rojo700 : ctx.salud.dias_renovacion <= 15 ? C.ambar700 : C.emerald700)}>{ctx.salud.dias_renovacion < 0 ? `Renovación vencida hace ${-ctx.salud.dias_renovacion} d` : `Renueva en ${ctx.salud.dias_renovacion} d`}</span>}
            {ctx.salud.soporte_estancado && <span style={tag(C.rojo50, C.rojo700)}>Soporte estancado</span>}
          </div>
          <div style={{ fontSize: 12, color: C.g700, lineHeight: 1.7 }}>
            {!ocultarDinero && ctx.salud.last_payment_at && <div>Último pago: <b>{fecha(ctx.salud.last_payment_at)}</b></div>}
            <div>Tickets de soporte abiertos: <b>{ctx.salud.tickets_abiertos || 0}</b></div>
            {ctx.sacs?.dias_sin_venta != null && <div>Días sin vender en SACS: <b>{ctx.sacs.dias_sin_venta}</b></div>}
          </div>
          <a href="/admin/crm?tab=soporte" style={{ display: 'inline-block', marginTop: 10, fontSize: 11, fontWeight: 700, color: C.moradoTinta, textDecoration: 'none' }}>Ver soporte →</a>
        </>)}
        {detalle === 'sacs' && ctx?.sacs && (<>
          <div style={{ fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
            <span style={tag(C.moradoAgua, C.moradoTinta)}>{ctx.sacs.cuenta}</span>
            {ctx.sacs.cuentas.length > 1 && <span style={tag(C.g100, C.g500)}>+{ctx.sacs.cuentas.length - 1} cuenta{ctx.sacs.cuentas.length - 1 === 1 ? '' : 's'}</span>}
            {ctx.sacs.dias_sin_venta != null && <span style={tag(ctx.sacs.dias_sin_venta > 7 ? C.ambar100 : C.emerald50, ctx.sacs.dias_sin_venta > 7 ? C.ambar700 : C.emerald700)}>{ctx.sacs.dias_sin_venta === 0 ? 'Vendió hoy' : `${ctx.sacs.dias_sin_venta} d sin vender`}</span>}
            {ctx.sacs.lealtad?.activo && <span style={tag(C.g100, C.g500)}>Lealtad {ctx.sacs.lealtad.tipo}</span>}
          </div>
          {ctx.sacs.modulos_activos.map((m: any) => (
            <div key={m.modulo} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, padding: '4px 0', fontSize: 12, borderBottom: `1px solid ${C.g50}` }}>
              <span style={{ color: C.g700 }}>{m.modulo}</span>
              <span style={{ color: C.g400, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{Number(m.docs_30d || 0).toLocaleString('es-MX')} <span style={{ color: C.g300 }}>/30 d</span>{m.ultimo ? ` · ${new Date(m.ultimo + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}` : ''}</span>
            </div>
          ))}
          {!ctx.sacs.modulos_activos.length && <div style={{ fontSize: 12, color: C.g300 }}>Sin uso registrado todavía.</div>}
        </>)}
        {detalle === 'cotizaciones' && (<>
          {(d360?.quotes || []).map((q: any) => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', fontSize: 12, borderBottom: `1px solid ${C.g50}` }}>
              <span>{q.numero || String(q.id).slice(0, 6)}</span>
              {q.estado && <span style={tag(q.estado === 'aceptada' ? C.emerald50 : C.g100, q.estado === 'aceptada' ? C.emerald700 : C.g500)}>{({ draft: 'borrador', enviada: 'enviada', aceptada: 'aceptada', rechazada: 'rechazada', vencida: 'vencida' } as any)[q.estado] || q.estado}</span>}
              <span style={{ marginLeft: 'auto', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(q.total)}</span>
            </div>
          ))}
          <a href={`/admin/crm?tab=cotizaciones${empresa ? `&company_id=${empresa.id}` : ''}`} style={{ display: 'inline-block', marginTop: 10, fontSize: 11, fontWeight: 700, color: C.moradoTinta, textDecoration: 'none' }}>Ver en Cotizaciones →</a>
        </>)}
        {detalle === 'conversion' && (<>
          <p style={{ fontSize: 11.5, color: C.g500, margin: '0 0 10px', lineHeight: 1.5 }}>El camino es lead → oportunidad → cliente. Define SIEMPRE el siguiente paso: un lead sin próximo paso se enfría.</p>
          <div style={{ borderRadius: 12, border: `1px solid ${C.g100}`, overflow: 'hidden' }}>
            <Campo etiqueta="Etapa" valor={contactoBase?.lifecycle_stage} opciones={etapasCat.map(s => ({ v: s.id, l: `${(s as any).emoji || ''} ${s.label}`.trim() }))} onGuardar={guardar('lifecycle_stage')} />
            <div style={{ borderTop: `1px solid ${C.g100}` }} /><Campo etiqueta="Próximo paso" valor={contacto?.proximo_paso} onGuardar={guardar('proximo_paso')} placeholder="¿Qué sigue?" />
            <div style={{ borderTop: `1px solid ${C.g100}` }} /><Campo etiqueta="Siguiente seguimiento" valor={contacto?.next_followup ? String(contacto.next_followup).slice(0, 10) : null} type="date" onGuardar={guardar('next_followup')} formato={fecha} placeholder="Agendar" />
          </div>
          {proxima && <div style={{ background: C.moradoAgua, borderRadius: 9, padding: '8px 11px', fontSize: 12, marginTop: 10 }}><b style={{ color: C.moradoTinta }}>Próxima reunión:</b> {fecha(proxima.fecha)} {proxima.hora_inicio ? `· ${proxima.hora_inicio}` : ''}</div>}
        </>)}
        {detalle === 'oportunidad' && (<>
          <div style={{ background: C.emerald50, borderRadius: 10, padding: '10px 13px', marginBottom: 10 }}>
            <span style={{ ...label(9), color: C.emerald700 }}>Pipeline abierto</span>
            <b style={{ display: 'block', fontSize: 20, color: C.emerald700, fontVariantNumeric: 'tabular-nums' }}>{money(pipelineTotal)}</b>
            <span style={{ fontSize: 10.5, color: C.g500 }}>{dealsAbiertos.length ? `en ${dealsAbiertos.length} oportunidad${dealsAbiertos.length === 1 ? '' : 'es'} abierta${dealsAbiertos.length === 1 ? '' : 's'}` : 'sin oportunidades abiertas'}</span>
          </div>
          {dealsAbiertos.map((d: any) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', fontSize: 12, borderBottom: `1px solid ${C.g50}` }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre || d.title || 'Oportunidad'}</span>
              {(d.pipeline_stage || d.stage) && <span style={tag(C.azulAgua, C.azulTinta)}>{d.pipeline_stage || d.stage}</span>}
              <span style={{ color: C.emerald700, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(d.monto ?? d.amount)}</span>
            </div>
          ))}
        </>)}
        {detalle === 'origen' && (<>
          <div style={{ fontSize: 12, color: C.g700, lineHeight: 1.8, marginBottom: 8 }}>
            <div>Fuente: <b>{contacto?.fuente || 'sin registrar'}</b></div>
            {contacto?.created_at && <div>En el CRM desde: <b>{fecha(contacto.created_at)}</b></div>}
          </div>
          {utm.length > 0 && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.g100}`, overflow: 'hidden' }}>
              {utm.map(([k, v], i) => (<span key={k}>{i > 0 && <div style={{ borderTop: `1px solid ${C.g100}` }} />}<Campo etiqueta={k.replace(/_/g, ' ')} valor={String(v)} readOnly copiable /></span>))}
            </div>
          )}
          {!utm.length && <div style={{ fontSize: 11.5, color: C.g400 }}>Sin datos de campaña (UTM). Los leads de anuncios los traen solos.</div>}
        </>)}
        {detalle === 'interacciones' && (<>
          <div style={{ fontSize: 12, color: C.g700, lineHeight: 1.8, marginBottom: 8 }}>
            <div>Mensajes en este chat: <b>{hilo?.mensajes?.length || 0}</b></div>
            {ctx?.desde_ultimo?.correos_abiertos > 0 && <div>Correos abiertos: <b>{ctx.desde_ultimo.correos_abiertos}</b></div>}
            <div>Reuniones: <b>{bookings.length}</b>{proxima ? ` · próxima ${fecha(proxima.fecha)}` : ''}</div>
          </div>
          {timeline.length > 0 && (<>
            <div style={{ ...label(10), margin: '8px 0 4px' }}>Últimos eventos</div>
            {timeline.slice(0, 10).map((t: any, i: number) => (
              <div key={t.id || i} style={{ display: 'flex', gap: 8, padding: '3px 0', fontSize: 12, lineHeight: 1.45 }}>
                <span style={{ color: C.g400, flexShrink: 0, fontVariantNumeric: 'tabular-nums', width: 44 }}>{new Date(t.fecha || t.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                <span style={{ minWidth: 0, color: C.g700 }}>{t.titulo}</span>
              </div>
            ))}
          </>)}
        </>)}
      </div>
    </div>
  );

  // ── Actividad: siete bloques en el orden en que se revisan al preparar una
  // llamada. Sin chips de filtro: eran seis botones para tapar cuatro listas. ──
  const quotesTodas: any[] = (d360?.quotes || dCon?.quotes || []);
  const dealsTodos: any[] = (dCon?.deals || d360?.deals || []);
  const llamadas: any[] = (ctx?.llamadas || []);
  const timelineFull: any[] = (d360?.timeline || dCon?.activities || []);
  const porMes: Record<string, any[]> = {};
  for (const t of timelineFull.slice(0, 60)) {
    const m = new Date(t.fecha || t.created_at).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    (porMes[m] = porMes[m] || []).push(t);
  }
  const vacio = (t: string) => <div style={{ fontSize: 11.5, color: C.g300 }}>{t}</div>;

  const TabActividad = () => (
    <div style={{ paddingTop: 8 }}>
      {contactoBase && <ResumenIA contactId={contactoBase.id} inicial={contacto?.resumen_ia} inicialAt={contacto?.resumen_ia_at} />}
      {/* 1 · Qué ha visto de nosotros */}
      <Seccion id="a-web" titulo="Visitas a la web y material de venta" n={(ctx?.web?.total || 0) + (ctx?.desde_ultimo?.correos_abiertos || 0) + quotesTodas.length} abiertaDefault>
        {ctx?.web?.paginas?.length ? ctx.web.paginas.map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 12, borderBottom: `1px solid ${C.g50}` }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.g700 }}>{p.ruta}</span>
            <span style={{ color: C.g400, flexShrink: 0 }}>{fecha(p.fecha)}</span>
          </div>
        )) : (
          <div style={{ background: C.ambar50, border: `1px solid ${C.ambar200}`, borderRadius: 9, padding: '8px 11px', fontSize: 11.5, color: C.ambar700, lineHeight: 1.5 }}>
            Todavía no sabemos qué páginas ve este contacto: el rastreo del sitio guarda las visitas
            sin ligarlas a una persona. Se arregla haciendo que los links de correos y de WhatsApp
            marquen quién es el visitante.
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 12, color: C.g700, lineHeight: 1.7 }}>
          {ctx?.desde_ultimo?.correos_abiertos > 0 && <div>Abrió {ctx.desde_ultimo.correos_abiertos} correo{ctx.desde_ultimo.correos_abiertos === 1 ? '' : 's'}{ctx.desde_ultimo.clics > 0 ? ` y dio ${ctx.desde_ultimo.clics} clic${ctx.desde_ultimo.clics === 1 ? '' : 's'}` : ''}</div>}
          {quotesTodas.length > 0 && <div>{quotesTodas.length} {quotesTodas.length === 1 ? 'cotización' : 'cotizaciones'}{!ocultarDinero ? ` por ${money(quotesTodas.reduce((t, q) => t + (Number(q.total) || 0), 0))}` : ''}</div>}
        </div>
      </Seccion>

      {/* 2 · Reuniones */}
      <Seccion id="a-reuniones" titulo="Reuniones agendadas" n={bookings.length} abiertaDefault>
        {proxima && (
          <div style={{ background: C.moradoAgua, borderRadius: 9, padding: '8px 11px', fontSize: 12, marginBottom: 7 }}>
            <b style={{ color: C.moradoTinta }}>Próxima:</b> {fecha(proxima.fecha)} {proxima.hora_inicio ? `· ${String(proxima.hora_inicio).slice(0, 5)}` : ''}
            <div style={{ color: C.g500 }}>{proxima.asunto || proxima.event_types?.nombre || 'Reunión'}</div>
          </div>
        )}
        {bookings.length ? bookings.slice(0, 8).map((b: any) => (
          <div key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', fontSize: 12, borderBottom: `1px solid ${C.g50}` }}>
            <span style={{ color: C.g400, width: 62, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fecha(b.fecha)}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.asunto || b.event_types?.nombre || 'Reunión'}</span>
            {b.estado && <span style={tag(b.estado === 'cancelada' ? C.rojo50 : C.emerald50, b.estado === 'cancelada' ? C.rojo700 : C.emerald700)}>{b.estado}</span>}
          </div>
        )) : vacio('Sin reuniones agendadas.')}
      </Seccion>

      {/* 3 · Oportunidades */}
      <Seccion id="a-deals" titulo="Oportunidades" n={dealsTodos.length}>
        {dealsTodos.length ? dealsTodos.slice(0, 8).map((d: any) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', fontSize: 12, borderBottom: `1px solid ${C.g50}` }}>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre || d.title || 'Oportunidad'}</span>
            {(d.pipeline_stage || d.stage) && <span style={tag(C.azulAgua, C.azulTinta)}>{d.pipeline_stage || d.stage}</span>}
            {!ocultarDinero && <span style={{ color: C.emerald700, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(d.monto ?? d.amount)}</span>}
          </div>
        )) : vacio('Sin oportunidades registradas.')}
      </Seccion>

      {/* 4 · Cotizaciones */}
      <Seccion id="a-quotes" titulo="Cotizaciones" n={quotesTodas.length}>
        {quotesTodas.length ? quotesTodas.slice(0, 10).map((q: any) => (
          <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', fontSize: 12, borderBottom: `1px solid ${C.g50}` }}>
            <span>{q.numero || String(q.id).slice(0, 6)}</span>
            {q.estado && <span style={tag(q.estado === 'aceptada' ? C.emerald50 : C.g100, q.estado === 'aceptada' ? C.emerald700 : C.g500)}>{({ draft: 'borrador', enviada: 'enviada', aceptada: 'aceptada', rechazada: 'rechazada', vencida: 'vencida' } as any)[q.estado] || q.estado}</span>}
            {q.vistas > 0
              ? <span title={q.ultima_vista_at ? `Última vez: ${fecha(q.ultima_vista_at)}` : undefined} style={tag(C.emerald50, C.emerald700)}>vista ×{q.vistas}</span>
              : <span style={tag(C.g100, C.g400)}>sin abrir</span>}
            {!ocultarDinero && <span style={{ marginLeft: 'auto', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(q.total)}</span>}
          </div>
        )) : vacio('Sin cotizaciones.')}
      </Seccion>

      {/* 5 · La línea de tiempo completa */}
      <Seccion id="a-timeline" titulo="Actividad" n={timelineFull.length} abiertaDefault>
        {contacto?.created_at && (
          <div style={{ fontSize: 11, color: C.g400, marginBottom: 6 }}>En el CRM desde {fecha(contacto.created_at)}</div>
        )}
        {timelineFull.length ? Object.entries(porMes).map(([mes, items]) => (
          <div key={mes}>
            <div style={{ ...label(10), margin: '8px 0 2px' }}>{mes}</div>
            {items.map((t: any, i: number) => (
              <div key={t.id || i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 12, lineHeight: 1.45 }}>
                <span style={{ color: C.g400, flexShrink: 0, fontVariantNumeric: 'tabular-nums', width: 44 }}>{new Date(t.fecha || t.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                <span style={{ minWidth: 0, color: C.g700 }}>{t.titulo}</span>
              </div>
            ))}
          </div>
        )) : vacio('Sin actividad registrada todavía.')}
      </Seccion>

      {/* 6 · Llamadas */}
      <Seccion id="a-llamadas" titulo="Llamadas" n={llamadas.length}>
        {llamadas.length ? llamadas.map((l: any) => (
          l.minuta ? <MinutaPanel key={l.call_id} l={l} /> : (
            <div key={l.call_id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 12, borderBottom: `1px solid ${C.g50}` }}>
              <span style={{ color: C.g400, width: 62, flexShrink: 0 }}>{fecha(l.ended_at || l.created_at)}</span>
              <span style={{ flex: 1 }}>{l.canal === 'telefono' ? 'Telefónica' : 'WhatsApp'} · {l.direccion === 'saliente' ? 'realizada' : 'recibida'}</span>
              <span style={tag(l.estado === 'terminada' ? C.emerald50 : C.g100, l.estado === 'terminada' ? C.emerald700 : C.g500)}>
                {l.duracion_seg ? `${Math.floor(l.duracion_seg / 60)}:${String(l.duracion_seg % 60).padStart(2, '0')}` : l.estado}
              </span>
            </div>
          )
        )) : vacio('Sin llamadas registradas.')}
      </Seccion>

      {/* 7 · Uso de SACS (prueba gratuita o cuenta viva) */}
      <Seccion id="a-sacs" titulo="Uso de SACS" n={ctx?.sacs?.modulos_activos?.length || null}>
        {ctx?.sacs ? (<>
          <div style={{ fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
            <span style={tag(C.moradoAgua, C.moradoTinta)}>{ctx.sacs.cuenta}</span>
            {ctx.sacs.dias_sin_venta != null && <span style={tag(ctx.sacs.dias_sin_venta > 7 ? C.ambar100 : C.emerald50, ctx.sacs.dias_sin_venta > 7 ? C.ambar700 : C.emerald700)}>{ctx.sacs.dias_sin_venta === 0 ? 'Vendió hoy' : `${ctx.sacs.dias_sin_venta} d sin vender`}</span>}
          </div>
          {ctx.sacs.modulos_activos.map((m: any) => (
            <div key={m.modulo} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, padding: '3px 0', fontSize: 12 }}>
              <span style={{ color: C.g700 }}>{m.modulo}</span>
              <span style={{ color: C.g400, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{Number(m.docs_30d || 0).toLocaleString('es-MX')} <span style={{ color: C.g300 }}>/30 d</span></span>
            </div>
          ))}
          {!ctx.sacs.modulos_activos.length && vacio('La cuenta existe pero todavía no registra uso.')}
        </>) : vacio('Sin cuenta de SACS ligada. Si le das una prueba gratuita, su uso aparece aquí.')}
      </Seccion>
    </div>
  );

  const [filtroAdj, setFiltroAdj] = useState('todos');
  const [visorAdj, setVisorAdj] = useState<any>(null);
  const TabAdjuntos = () => {
    const esImg = (m: any) => m.tipo === 'image' || m.tipo === 'sticker' || /^image\//.test(m.mime || '') || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(m.media_url || '');
    const esVid = (m: any) => m.tipo === 'video' || /^video\//.test(m.mime || '');
    const esAud = (m: any) => m.tipo === 'audio' || /^audio\//.test(m.mime || '');
    const lista = media.filter((m: any) => filtroAdj === 'todos'
      || (filtroAdj === 'fotos' ? (esImg(m) || esVid(m)) : filtroAdj === 'audio' ? esAud(m) : !esImg(m) && !esVid(m) && !esAud(m)));
    const fotos = lista.filter((m: any) => esImg(m) || esVid(m));
    const audios = lista.filter(esAud);
    const otros = lista.filter((m: any) => !esImg(m) && !esVid(m) && !esAud(m));
    return (
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {[['todos', `Todos ${media.length}`], ['fotos', 'Fotos y video'], ['docs', 'Documentos'], ['audio', 'Audio']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltroAdj(v)} style={{ border: 'none', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: filtroAdj === v ? C.emerald50 : C.g100, color: filtroAdj === v ? C.emerald700 : C.g500 }}>{l}</button>
          ))}
        </div>
        {!lista.length && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: C.g100, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: C.g400 }}><IcoClip size={22} /></div>
            <p style={{ fontSize: 12, fontWeight: 600, margin: '8px 0 2px' }}>Sin archivos</p>
            <p style={{ fontSize: 11, color: C.g400 }}>Las fotos y documentos de esta conversación aparecen aquí.</p>
          </div>
        )}
        {fotos.length > 0 && <>
          <div style={{ ...label(10), marginBottom: 6 }}>Fotos y video · {fotos.length}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
            {fotos.map((m: any) => (
              <button key={m.id} onClick={() => setVisorAdj({ ...m, media_url: m._src })} title={fecha(m.created_at)}
                style={{ position: 'relative', border: 'none', padding: 0, borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in', background: C.g100, aspectRatio: '1' }}>
                {esVid(m)
                  ? <video src={m._src} preload="metadata" muted style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />
                  : <img src={m._src} loading="lazy" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {esVid(m) && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, textShadow: '0 1px 6px rgba(0,0,0,.6)' }}>▶</span>}
              </button>
            ))}
          </div>
        </>}
        {audios.length > 0 && <>
          <div style={{ ...label(10), marginBottom: 6 }}>Audio · {audios.length}</div>
          <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {audios.map((m: any) => (
              <span key={m.id}>
                <audio src={m._src} controls preload="none" style={{ width: '100%', height: 32 }} />
                <span style={{ fontSize: 10, color: C.g400 }}>{fecha(m.created_at)}{m.transcript ? ` · ${String(m.transcript).slice(0, 60)}` : ''}</span>
              </span>
            ))}
          </div>
        </>}
        {otros.length > 0 && <div style={{ ...label(10), marginBottom: 6 }}>Documentos · {otros.length}</div>}
        {otros.map((m: any) => {
          const ext = extensionDe({ ...m, media_url: m._src });
          return (
            <button key={m.id} onClick={() => setVisorAdj({ ...m, media_url: m._src })}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '7px 0', cursor: 'pointer', fontFamily: 'inherit', borderBottom: `1px solid ${C.g50}` }}>
              <span style={{ width: 28, height: 34, borderRadius: 5, background: C.morado, color: '#fff', fontSize: 8, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ext}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.filename || m.cuerpo || `Documento ${ext}`}</b>
                <span style={{ fontSize: 10, color: C.g400 }}>{fecha(m.created_at)}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  const TabNotas = () => {
    const sig = contacto?.next_followup ? new Date(contacto.next_followup) : null;
    const vencido = sig && sig < new Date();
    return (
      <div style={{ padding: 14 }}>
        <div style={{ ...label(10), marginBottom: 6 }}>Seguimientos programados</div>
        {sig ? (
          <div style={{ borderRadius: 8, border: `1px solid ${vencido ? C.rojo200 : C.azulBorde}`, background: vencido ? 'rgba(254,242,242,.6)' : '#fbfdff', padding: 10, fontSize: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <b style={{ color: vencido ? C.rojo500 : C.azulTinta, flex: 1 }}>{contacto?.proximo_paso || 'Seguimiento'}</b>
              <button title="Completar" onClick={() => { api.guardarContacto(contactoBase.id, { next_followup: null }); }} style={{ border: 'none', background: C.emerald50, color: C.emerald700, borderRadius: 6, width: 24, height: 24, cursor: 'pointer' }}>✓</button>
              <button title="Cancelar" onClick={() => { api.guardarContacto(contactoBase.id, { next_followup: null, proximo_paso: null }); }} style={{ border: 'none', background: C.g100, color: C.g500, borderRadius: 6, width: 24, height: 24, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ fontSize: 11, color: vencido ? C.rojo500 : C.g500, marginTop: 3 }}>{fecha(contacto.next_followup)}{vencido ? ' · vencido' : ''}</div>
          </div>
        ) : <div style={{ fontSize: 12, color: C.g300, marginBottom: 12 }}>Sin seguimientos. Agenda uno en Info → Seguimiento.</div>}
        {conv.snooze_until && new Date(conv.snooze_until) > new Date() && (
          <div style={{ borderRadius: 8, border: `1px solid ${C.ambar200}`, background: C.ambar50, padding: 10, fontSize: 12, marginBottom: 12, color: C.ambar700 }}>
            Pospuesta hasta {new Date(conv.snooze_until).toLocaleString('es-MX')}
          </div>
        )}
        <div style={{ ...label(10), marginBottom: 6 }}>Comentarios internos</div>
        {!notas.length && <div style={{ fontSize: 12, color: C.g300 }}>Sin comentarios. Usa "Añadir comentario" en el composer.</div>}
        {notas.map((n: any) => (
          <div key={n.id} style={{ background: C.ambar50, border: `1px solid ${C.ambar200}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#7a5a15', marginBottom: 6, lineHeight: 1.45 }}>
            <b style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>{n.autor} · {fecha(n.created_at)}</b>{n.texto}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <style>{cssAcciones}</style>
      {/* Contenido colapsable */}
      {abiertoPanel && (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ height: L.header, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 8px', borderBottom: `1px solid ${C.g100}`, position: 'relative' }}>
            {tab === 'info' ? (['info', 'actividad', 'acciones'] as const).map(s => (
              <button key={s} onClick={() => setSubInfo(s)} style={{ flex: 1, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: subInfo === s ? C.g900 : C.g400, padding: '10px 0', position: 'relative', textTransform: 'capitalize' }}>
                {s}
                {subInfo === s && <span style={{ position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, borderRadius: 999, background: C.moradoTinta }} />}
              </button>
            )) : <b style={{ fontSize: 13, paddingLeft: 8 }}>{TABS.find(t => t.id === tab)?.t}</b>}
          </div>
          <div className="wa-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {/* Se llaman como función (no <Tab />): definidas dentro del componente, como
                elemento serían un "tipo nuevo" en cada render y React desmontaría el tab
                en cada polling (Clasificación parpadeaba). */}
            {tab === 'info' && (subInfo === 'info' ? (detalle ? DetalleInfo() : TabInfo()) : subInfo === 'actividad' ? TabActividad() : <AccionesVenta contacto={contactoBase} empresa={empresa} conv={conv} ventanaAbierta={ventanaAbierta} abrirFicha={() => setFicha(true)} accionInicial={accionInicial} refrescar={() => setNonceCtx(n => n + 1)} />)}
            {/* `accionInicial` también aquí: el evento `wa-acciones` cae en ESTA
                rama (pone tab='acciones'), y al pasarle null el «agendar» se
                perdía — abrías el menú de acciones y tenías que elegir otra vez
                lo que ya habías pedido. */}
            {tab === 'acciones' && <AccionesVenta contacto={contactoBase} empresa={empresa} conv={conv} ventanaAbierta={ventanaAbierta} abrirFicha={() => setFicha(true)} accionInicial={accionInicial} refrescar={() => setNonceCtx(n => n + 1)} />}
            {tab === 'adjuntos' && TabAdjuntos()}
            {tab === 'notas' && TabNotas()}
          </div>
          {/* Footer fijo de etiquetas */}
          {(empresa || contactoBase) && <FooterEtiquetas entidad="wa_conversacion" id={conv.id || conv.email_only_id} />}
        </div>
      )}
      {/* Railito de iconos siempre visible */}
      <div style={{ width: L.railito, flexShrink: 0, borderLeft: `1px solid ${C.g100}`, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6, gap: 4 }}>
        {TABS.map(t => {
          const activo = tab === t.id && abiertoPanel;
          return (
            <button key={t.id} title={t.t} onClick={() => { if (tab === t.id) setAbiertoPanel(a => !a); else { setTab(t.id); setAbiertoPanel(true); } }}
              style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: t.accent ? C.morado : activo ? C.moradoAgua : 'none', color: t.accent ? '#fff' : activo ? C.moradoTinta : C.g400 }}>
              <t.Ico size={17} />
            </button>
          );
        })}
      </div>
      {visorAdj && <VisorMedia m={visorAdj} onCerrar={() => setVisorAdj(null)} />}
      {ficha && empresa && <ClienteDrawer360 companyId={empresa.id} onClose={() => setFicha(false)} onChanged={() => { cacheId.current = null; api.refrescar?.(); }} />}
    </div>
  );
}

/** Etiquetas como chips toggle: asignada = color sólido; disponible = borde punteado. */
function Clasificacion({ entidad, id }: { entidad: 'company' | 'contact'; id: string }) {
  const { cat } = useCatalogoEtiquetas();
  const [mias, setMias] = useState<any[] | null>(null);
  const cargar = () => fetch(`/api/crm/etiquetas?entidad=${entidad}&entidad_id=${id}`).then(r => r.json()).then(j => setMias(j.data || [])).catch(() => setMias([]));
  useEffect(() => { cargar(); }, [entidad, id]);
  const toggle = async (e: any) => {
    const tiene = (mias || []).some(m => m.id === e.id);
    setMias(m => tiene ? (m || []).filter(x => x.id !== e.id) : [...(m || []), e]);   // optimista
    const r = await fetch('/api/crm/etiquetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etiqueta_id: e.id, entidad, entidad_id: id, quitar: tiene }) }).then(x => x.json()).catch(() => null);
    if (!r?.ok) cargar();   // revert
  };
  if (!cat?.length) return null;
  return (
    <div style={{ padding: '8px 16px 4px' }}>
      <div style={{ ...label(10), marginBottom: 6 }}>Clasificación</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {cat.map((e: any) => {
          const on = (mias || []).some(m => m.id === e.id);
          return (
            <button key={e.id} onClick={() => toggle(e)}
              style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '3px 9px', cursor: 'pointer', fontFamily: 'inherit', border: on ? `1px solid ${e.color || C.morado}` : `1px dashed ${C.g300}`, background: on ? (e.color || C.morado) : '#fff', color: on ? '#fff' : C.g400 }}>
              {e.nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Footer fijo: etiquetas de la CONVERSACIÓN con picker y toggle optimista. */
function FooterEtiquetas({ entidad, id }: { entidad: string; id: string }) {
  const { cat } = useCatalogoEtiquetas();
  const [mias, setMias] = useState<any[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const cargar = () => fetch(`/api/crm/etiquetas?entidad=${entidad}&entidad_id=${id}`).then(r => r.json()).then(j => setMias(j.data || [])).catch(() => {});
  useEffect(() => { if (id) cargar(); }, [id]);
  const toggle = async (e: any, quitar: boolean) => {
    setMias(m => quitar ? m.filter(x => x.id !== e.id) : [...m, e]);
    const r = await fetch('/api/crm/etiquetas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ etiqueta_id: e.id, entidad, entidad_id: id, quitar }) }).then(x => x.json()).catch(() => null);
    if (!r?.ok) cargar();
  };
  const disponibles = (cat || []).filter((e: any) => !mias.some(m => m.id === e.id) && (!q || e.nombre.toLowerCase().includes(q.toLowerCase())));
  return (
    <div style={{ borderTop: `1px solid ${C.g100}`, padding: '8px 14px', position: 'relative', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
        <span style={label(10)}>Etiquetas</span>
        <button onClick={() => setAbierto(a => !a)} style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: 6, border: `1px solid ${C.g200}`, background: '#fff', cursor: 'pointer', color: C.g500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><IcoMas size={12} /></button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {!mias.length && <span style={{ fontSize: 11, color: C.g300, fontStyle: 'italic' }}>Sin etiquetas</span>}
        {mias.map(e => (
          <span key={e.id} style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '2px 8px', background: `${e.color || C.morado}20`, color: e.color || C.moradoTinta, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {e.nombre}<button onClick={() => toggle(e, true)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 11 }}>×</button>
          </span>
        ))}
      </div>
      {abierto && (
        <div style={{ position: 'absolute', bottom: '100%', left: 8, right: 8, background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 10, boxShadow: '0 12px 30px rgba(0,0,0,.12)', padding: 8, zIndex: 5 }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar etiqueta…" style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.g200}`, borderRadius: 6, padding: '5px 8px', fontSize: 11, fontFamily: 'inherit', marginBottom: 6 }} />
          <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {!disponibles.length && <span style={{ fontSize: 11, color: C.g400 }}>Nada que agregar.</span>}
            {disponibles.map((e: any) => (
              <button key={e.id} onClick={() => { toggle(e, false); setAbierto(false); }} style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '3px 9px', border: `1px dashed ${C.g300}`, background: '#fff', color: C.g500, cursor: 'pointer', fontFamily: 'inherit' }}>{e.nombre}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


/** Una llamada con minuta en el panel derecho: fecha, duración, expandir. */
function MinutaPanel({ l }: { l: any }) {
  const [abierta, setAbierta] = useState(false);
  const dur = l.duracion_seg ? `${Math.floor(l.duracion_seg / 60)}:${String(l.duracion_seg % 60).padStart(2, '0')}` : '—';
  return (
    <div style={{ border: `1px solid ${C.g100}`, borderLeft: `3px solid ${C.emerald500}`, borderRadius: 10, marginBottom: 6, overflow: 'hidden' }}>
      <button onClick={() => setAbierta(a => !a)} style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '7px 10px', textAlign: 'left' }}>
        <span style={{ minWidth: 0, flex: 1 }}>
          <b style={{ fontSize: 11.5, display: 'block' }}>{l.canal === 'telefono' ? 'Tel' : 'WA'} · {l.direccion === 'saliente' ? 'realizada' : 'recibida'} · {dur}</b>
          <span style={{ fontSize: 10, color: C.g400 }}>{fecha(l.ended_at || l.created_at)}{l.atendida_por_nombre ? ` · ${l.atendida_por_nombre}` : ''}</span>
        </span>
        <span style={{ color: C.g300, fontSize: 10 }}>{abierta ? '▲' : '▼'}</span>
      </button>
      {abierta && <div style={{ borderTop: `1px solid ${C.g100}`, padding: '8px 10px', fontSize: 11.5, color: C.g700, lineHeight: 1.55, whiteSpace: 'pre-wrap', maxHeight: 260, overflowY: 'auto' }}>{String(l.minuta).replace(/^## /gm, '').replace(/^- /gm, '• ')}</div>}
      {l.siguiente_paso && <div style={{ borderTop: `1px solid ${C.g100}`, background: C.moradoAgua, padding: '5px 10px', fontSize: 10.5, color: C.moradoTinta }}><b>Siguiente:</b> {l.siguiente_paso}</div>}
    </div>
  );
}


/** Resumen de la relación, generado SOLO cuando el usuario lo pide. */
function ResumenIA({ contactId, inicial, inicialAt }: { contactId: string; inicial?: string | null; inicialAt?: string | null }) {
  const [resumen, setResumen] = useState<string | null>(inicial || null);
  const [at, setAt] = useState<string | null>(inicialAt || null);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { setResumen(inicial || null); setAt(inicialAt || null); setAbierto(false); }, [contactId]);
  const generar = async () => {
    setCargando(true); setMsg('');
    const r = await fetch('/api/crm/contacts/resumen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contactId }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setCargando(false);
    if (r?.error) { setMsg(r.error); return; }
    setResumen(r.resumen); setAt(r.at); setAbierto(true);
  };
  return (
    <div style={{ margin: '10px 16px 0', borderRadius: 12, border: `1px solid ${C.g100}`, borderLeft: `3px solid ${C.morado}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
        <span style={{ minWidth: 0, flex: 1 }}>
          <b style={{ fontSize: 12 }}>Resumen de la relación</b>
          <span style={{ display: 'block', fontSize: 10, color: C.g400 }}>
            {cargando ? 'Leyendo todo el historial…' : at ? `Generado ${fecha(at)}` : 'Dos años de historia en 30 segundos'}
          </span>
        </span>
        {resumen && !cargando && (
          <button onClick={() => setAbierto(a => !a)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: C.moradoTinta }}>{abierto ? 'Ocultar' : 'Leer'}</button>
        )}
        <button onClick={generar} disabled={cargando}
          style={{ border: 'none', borderRadius: 7, padding: '5px 11px', background: cargando ? C.g100 : C.morado, color: cargando ? C.g400 : '#fff', fontSize: 11, fontWeight: 700, cursor: cargando ? 'default' : 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          {cargando ? <Corazones size={8} color={C.g400} /> : resumen ? 'Actualizar' : 'Generar'}
        </button>
      </div>
      {msg && <div style={{ padding: '0 12px 8px', fontSize: 11, color: C.rojo700 }}>{msg}</div>}
      {abierto && resumen && (
        <div style={{ borderTop: `1px solid ${C.g100}`, padding: '10px 13px', fontSize: 12, color: C.g700, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 340, overflowY: 'auto' }}>
          {resumen.replace(/^## /gm, '').replace(/\*\*/g, '')}
        </div>
      )}
    </div>
  );
}
