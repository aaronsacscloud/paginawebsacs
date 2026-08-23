// WHATSAPP · Panel de detalle PRO (portado de sacs_inbox/RightPanel): railito
// de tabs (Acciones / Info / Adjuntos / Notas), sub-tabs Info|Actividad,
// EditableFieldRow con Enter/Escape/blur, PhoneFieldRow con lada, grupos
// colapsables, quick actions en grid, y footer fijo de etiquetas.
// Data del CRM: company360 + contacts/[id]. Sin memoria IA ni SACS3.
import { useEffect, useRef, useState } from 'react';
import { telefonoLegible } from '../../../../lib/telefono';
import { LIFECYCLE, lifecycleDe } from '../../../../lib/crm/lifecycle';
import { useCatalogoEtiquetas } from '../Etiquetas';
import ClienteDrawer360 from '../ClienteDrawer360';
import { Avatar } from './ListaConversaciones';
import { Corazones } from '../ui/Cargando';
import { srcMedia } from './Burbuja';
import { C, L, label, haceCuanto } from './estilo';
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

export default function PanelDetalle({ hilo, api }: { hilo: any; api: any }) {
  const conv = hilo.conversacion;
  const contactoBase = conv?.contacts || null;
  const [tab, setTab] = useState<Tab>('info');
  const [abiertoPanel, setAbiertoPanel] = useState(true);
  const [subInfo, setSubInfo] = useState<'info' | 'actividad'>('info');
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
  // 21) Un CS ve el dinero solo de sus cuentas; founder ve todo.
  const ocultarDinero = yo?.rol === 'cs' && ctx?.contacto?.owner_id && ctx.contacto.owner_id !== yo.id;

  useEffect(() => {
    const k = `${conv?.id}|${conv?.company_id}|${conv?.contact_id}`;
    if (!conv || cacheId.current === k) return;
    cacheId.current = k; setD360(null); setDCon(null);
    if (conv.company_id) fetch(`/api/crm/arr/company360?id=${conv.company_id}`).then(r => r.json()).then(setD360).catch(() => {});
    if (conv.contact_id) fetch(`/api/crm/contacts/${conv.contact_id}`).then(r => r.json()).then(setDCon).catch(() => {});
    setCtx(null);
    const qs = conv.id ? `wa_id=${conv.id}` : conv.contact_id ? `contact_id=${conv.contact_id}` : conv.company_id ? `company_id=${conv.company_id}` : '';
    if (qs) fetch(`/api/crm/whatsapp/panel?${qs}`).then(r => r.json()).then(setCtx).catch(() => {});
  }, [conv?.id, conv?.company_id, conv?.contact_id]);
  const ligar = async (contactId: string, companyId?: string | null) => {
    await api.patchConversacion({ contact_id: contactId, company_id: companyId || null });
    cacheId.current = null;
  };

  const contacto = dCon?.contact || dCon || contactoBase;
  const empresa = d360?.company || conv?.companies || null;
  const nombre = contactoBase ? `${contactoBase.nombre || ''} ${contactoBase.apellido || ''}`.trim() : null;
  const etapa = lifecycleDe(contactoBase?.lifecycle_stage);
  const subs: any[] = (d360?.subscriptions || []).filter(Boolean);
  const deals: any[] = (dCon?.deals || []).filter((d: any) => !['ganado', 'perdido', 'won', 'lost'].includes(String(d.stage || d.etapa || '').toLowerCase()));
  const quotes: any[] = (d360?.quotes || dCon?.quotes || []).slice(0, 5);
  const bookings: any[] = (d360?.bookings || dCon?.bookings || []);
  const proxima = bookings.filter(b => new Date(b.fecha) >= new Date(Date.now() - 86400000)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))[0] || null;
  const timeline: any[] = (d360?.timeline || dCon?.activities || []).slice(0, 12);
  const resumen = d360?.resumen || null;
  const media = (hilo.mensajes || []).filter((m: any) => (m.media_url || m.media_id) && !m.borrado_at).map((m: any) => ({ ...m, _src: srcMedia(m), _dl: srcMedia(m, true) }));
  const notas = hilo.notas || [];

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
      {/* Card de contexto */}
      <div style={{ margin: '12px 16px 4px', borderRadius: 12, border: `1px solid ${C.g100}`, background: 'rgba(249,250,251,.5)', padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={label(10)}>{empresa ? 'Cliente' : contactoBase ? 'Lead' : 'Desconocido'}</span>
          {empresa && <button onClick={() => setFicha(true)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: C.moradoTinta }}>Ver ficha →</button>}
        </div>
        {etapa && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: etapa.fg, opacity: .6 }} /><span style={{ fontSize: 12, fontWeight: 600 }}>{etapa.label}</span></div>}
        {empresa ? (<>
          <div style={{ display: 'flex', gap: 6, fontSize: 12, alignItems: 'center', flexWrap: 'wrap', whiteSpace: 'nowrap' }}>
            {ctx?.salud && <span title={`Salud de la cuenta: ${ctx.salud.nivel}`} style={{ width: 9, height: 9, borderRadius: 999, background: ctx.salud.nivel === 'rojo' ? C.rojo500 : ctx.salud.nivel === 'ambar' ? C.ambar400 : C.emerald500, flexShrink: 0 }} />}
            {!ocultarDinero && <span style={{ color: C.emerald700, fontWeight: 700 }}>{money(resumen?.mrr ?? empresa.mrr)}<span style={{ fontWeight: 500, fontSize: 10 }}> MRR</span></span>}
            <span style={{ color: C.g300 }}>·</span><span style={{ color: C.g500 }}>{empresa.plan || 'sin plan'}</span>
            <span style={{ color: C.g300 }}>·</span><span style={{ color: C.g500 }}>{subs.length} sub{subs.length === 1 ? '' : 's'}</span>
          </div>
          {ctx?.salud && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
              {ctx.salud.dias_renovacion != null && <span style={tag(ctx.salud.dias_renovacion < 0 ? C.rojo50 : ctx.salud.dias_renovacion <= 15 ? C.ambar100 : C.g100, ctx.salud.dias_renovacion < 0 ? C.rojo700 : ctx.salud.dias_renovacion <= 15 ? C.ambar700 : C.g500)}>
                {ctx.salud.dias_renovacion < 0 ? `Renovación vencida hace ${-ctx.salud.dias_renovacion} d` : `Renueva en ${ctx.salud.dias_renovacion} d`}</span>}
              {ctx.salud.last_payment_at && !ocultarDinero && <span style={tag(C.g100, C.g500)}>Último pago {fecha(ctx.salud.last_payment_at)}</span>}
              {ctx.salud.tickets_abiertos > 0 && <span style={tag(C.ambar100, C.ambar700)}>{ctx.salud.tickets_abiertos} ticket{ctx.salud.tickets_abiertos === 1 ? '' : 's'} de soporte</span>}
              {ctx.salud.soporte_estancado && <span style={tag(C.rojo50, C.rojo700)}>Soporte estancado</span>}
              {ctx.salud.health_score != null && <span style={tag(C.g100, C.g500)}>Salud {ctx.salud.health_score}/100</span>}
            </div>
          )}
        </>) : contactoBase ? (
          <div style={{ fontSize: 12, color: C.g500 }}>{contacto?.fuente ? `Origen: ${contacto.fuente}` : 'Sin origen registrado'}</div>
        ) : null}
      </div>

      {/* Clasificación: etiquetas toggle con borde punteado */}
      {(empresa || contactoBase) && <Clasificacion entidad={empresa ? 'company' : 'contact'} id={empresa?.id || contactoBase?.id} />}

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
            <div style={divisor} /><Campo etiqueta="Etapa" valor={contactoBase.lifecycle_stage} opciones={LIFECYCLE.map(s => ({ v: s.id, l: s.label }))} onGuardar={guardar('lifecycle_stage')} />
            <div style={divisor} /><Campo etiqueta="Origen" valor={contacto?.fuente} readOnly />
          </div>
        </Seccion>
      )}
      {empresa && (
        <Seccion id="g-empresa" titulo="Empresa" n={null}>
          <div style={caja}>
            <Campo etiqueta="Nombre comercial" valor={empresa.nombre_comercial || empresa.nombre} onGuardar={guardarEmpresa('nombre_comercial')} />
            <div style={divisor} /><Campo etiqueta="Plan" valor={empresa.plan} readOnly />
            <div style={divisor} /><Campo etiqueta="Estado" valor={empresa.estado_cuenta} readOnly />
            {!ocultarDinero && <><div style={divisor} /><Campo etiqueta="MRR" valor={String(resumen?.mrr ?? empresa.mrr ?? '')} readOnly formato={money} />
            <div style={divisor} /><Campo etiqueta="ARR" valor={String(resumen?.arr ?? empresa.arr ?? '')} readOnly formato={money} /></>}
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
      {contactoBase && (
        <Seccion id="g-seguimiento" titulo="Seguimiento" abiertaDefault>
          <div style={caja}>
            <Campo etiqueta="Próximo paso" valor={contacto?.proximo_paso} onGuardar={guardar('proximo_paso')} placeholder="¿Qué sigue?" />
            <div style={divisor} /><Campo etiqueta="Siguiente seguimiento" valor={contacto?.next_followup ? String(contacto.next_followup).slice(0, 10) : null} type="date" onGuardar={guardar('next_followup')} formato={fecha} placeholder="Agendar" />
          </div>
        </Seccion>
      )}
    </div>
  );

  const CHIPS_ACT = [['todo', 'Todo'], ['wa', 'WhatsApp'], ['correo', 'Correo'], ['reunion', 'Reuniones'], ['pago', 'Pagos'], ['nota', 'Notas']];
  const tipoDe = (t: any): string => {
    const k = `${t.tipo || ''} ${t.titulo || ''}`.toLowerCase();
    if (/whatsapp|wa_/.test(k)) return 'wa'; if (/correo|email|mail/.test(k)) return 'correo'; if (/reuni|booking|cita|meet/.test(k)) return 'reunion';
    if (/pago|cobro|factura|suscrip/.test(k)) return 'pago'; if (/nota|comentario/.test(k)) return 'nota'; return 'otro';
  };
  const timelineFiltrado = (d360?.timeline || dCon?.activities || []).filter((t: any) => filtroAct === 'todo' || tipoDe(t) === filtroAct).slice(0, 60);
  const porMes: Record<string, any[]> = {};
  for (const t of timelineFiltrado) { const m = new Date(t.fecha || t.created_at).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }); (porMes[m] = porMes[m] || []).push(t); }
  const TabActividad = () => (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '10px 16px 0' }}>
        {CHIPS_ACT.map(([v, l]) => (
          <button key={v} onClick={() => setFiltroAct(v)} style={{ border: `1px solid ${filtroAct === v ? C.g900 : C.g200}`, background: filtroAct === v ? C.g900 : '#fff', color: filtroAct === v ? '#fff' : C.g500, borderRadius: 999, padding: '2px 9px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
        ))}
      </div>
      {empresa && !ocultarDinero && (
        <Seccion id="a-subs" titulo="Suscripciones" n={subs.length} abiertaDefault>
          {!subs.length && <div style={{ fontSize: 12, color: C.g300 }}>Sin suscripciones.</div>}
          {subs.map(su => { const [bg, fg] = ESTADO_SUB[su.estado] || [C.g100, C.g500]; return (
            <div key={su.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', fontSize: 12 }}>
              <b>{su.nombre_plan}</b><span style={tag(bg, fg)}>{su.estado}</span>
              <span style={{ marginLeft: 'auto', color: C.emerald700, fontWeight: 700 }}>{money(su.precio)}<span style={{ color: C.g400, fontWeight: 400 }}>/{su.ciclo === 'anual' ? 'año' : 'mes'}</span></span>
            </div>); })}
        </Seccion>
      )}
      {contactoBase && (
        <Seccion id="a-deals" titulo="Oportunidades" n={deals.length}>
          {!deals.length && <div style={{ fontSize: 12, color: C.g300 }}>Sin oportunidades abiertas.</div>}
          {deals.slice(0, 5).map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', fontSize: 12 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre || d.title || 'Oportunidad'}</span>
              {(d.pipeline_stage || d.stage) && <span style={tag(C.azulAgua, C.azulTinta)}>{d.pipeline_stage || d.stage}</span>}
              <span style={{ color: C.emerald700, fontWeight: 700 }}>{money(d.monto ?? d.amount)}</span>
            </div>
          ))}
        </Seccion>
      )}
      {quotes.length > 0 && (
        <Seccion id="a-quotes" titulo="Cotizaciones" n={quotes.length}>
          {quotes.map(q => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', fontSize: 12 }}>
              <span>{q.numero || String(q.id).slice(0, 6)}</span>
              {q.estado && <span style={tag(q.estado === 'aceptada' ? C.emerald50 : C.g100, q.estado === 'aceptada' ? C.emerald700 : C.g500)}>{q.estado}</span>}
              <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{money(q.total)}</span>
            </div>
          ))}
        </Seccion>
      )}
      {(contactoBase || empresa) && (
        <Seccion id="a-reuniones" titulo="Reuniones" n={bookings.length}>
          {proxima ? (
            <div style={{ background: C.moradoAgua, borderRadius: 9, padding: '8px 11px', fontSize: 12, marginBottom: 6 }}>
              <b style={{ color: C.moradoTinta }}>Próxima:</b> {fecha(proxima.fecha)} {proxima.hora_inicio ? `· ${proxima.hora_inicio}` : ''}
              <div style={{ color: C.g500 }}>{proxima.asunto || proxima.event_types?.nombre || 'Reunión'}</div>
            </div>
          ) : <div style={{ fontSize: 12, color: C.g300 }}>Sin reunión agendada.</div>}
        </Seccion>
      )}
      {timelineFiltrado.length > 0 ? (
        <Seccion id="a-timeline" titulo="Actividad reciente" n={timelineFiltrado.length} abiertaDefault>
          {Object.entries(porMes).map(([mes, items]) => (
            <div key={mes}>
              <div style={{ ...label(10), margin: '8px 0 2px' }}>{mes}</div>
              {items.map((t: any, i: number) => (
                <div key={t.id || i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 12, lineHeight: 1.45 }}>
                  <span style={{ color: C.g400, flexShrink: 0, fontVariantNumeric: 'tabular-nums', width: 44 }}>{new Date(t.fecha || t.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                  <span style={{ minWidth: 0, color: C.g700 }}>{t.titulo}</span>
                </div>
              ))}
            </div>
          ))}
        </Seccion>
      ) : filtroAct !== 'todo' ? <div style={{ padding: '12px 16px', fontSize: 12, color: C.g400 }}>Nada de este tipo en la actividad.</div> : null}
    </div>
  );

  const acciones = [
    { e: '📄', t: 'Cotización', d: 'Nueva cotización', href: `/admin/crm?tab=cotizaciones${empresa ? `&company_id=${empresa.id}` : ''}`, ok: !!(empresa || contactoBase) },
    { e: '📅', t: 'Reunión', d: 'Agendar', href: `/admin/crm?tab=reuniones`, ok: !!contactoBase },
    { e: '🎯', t: 'Oportunidad', d: 'Nueva oportunidad', href: `/admin/crm?tab=oportunidades`, ok: !!(empresa || contactoBase) },
    { e: '👤', t: 'Ficha 360', d: 'Ver completa', onClick: () => setFicha(true), ok: !!empresa },
    { e: '🧾', t: 'Estado de cuenta', d: 'Suscripciones', href: `/admin/crm?tab=suscripciones`, ok: !!empresa },
    { e: '📣', t: 'Masivo', d: 'Incluir en campaña', href: `/admin/crm?tab=wa-masivos`, ok: true },
  ];
  const TabAcciones = () => (
    <div style={{ padding: 14 }}>
      <div style={{ ...label(10), marginBottom: 8 }}>Ventas</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {acciones.map(a => (
          <button key={a.t} disabled={!a.ok} onClick={() => a.onClick ? a.onClick() : (a.href && (window.location.href = a.href))}
            className="wa-grupo"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: 12, borderRadius: 12, border: `1px solid ${C.g100}`, background: '#fff', cursor: a.ok ? 'pointer' : 'not-allowed', fontFamily: 'inherit', filter: a.ok ? 'none' : 'grayscale(1)', opacity: a.ok ? 1 : .5 }}
            onMouseEnter={e => { if (a.ok) { e.currentTarget.style.borderColor = '#c9bcf7'; e.currentTarget.style.background = 'rgba(238,236,254,.4)'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.g100; e.currentTarget.style.background = '#fff'; }}>
            <span style={{ fontSize: 22, transition: 'transform .15s' }}>{a.e}</span>
            <b style={{ fontSize: 11 }}>{a.t}</b>
            <span style={{ fontSize: 9, color: C.g400 }}>{a.ok ? a.d : 'Sin contacto'}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const [filtroAdj, setFiltroAdj] = useState('todos');
  const TabAdjuntos = () => {
    const esImg = (m: any) => m.tipo === 'image' || m.tipo === 'sticker' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(m.media_url || '');
    const lista = media.filter((m: any) => filtroAdj === 'todos' || (filtroAdj === 'fotos' ? esImg(m) : filtroAdj === 'audio' ? m.tipo === 'audio' : !esImg(m) && m.tipo !== 'audio'));
    const fotos = lista.filter(esImg); const otros = lista.filter((m: any) => !esImg(m));
    return (
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {[['todos', 'Todos'], ['fotos', 'Fotos'], ['docs', 'Docs'], ['audio', 'Audio']].map(([v, l]) => (
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
          <div style={{ ...label(10), marginBottom: 6 }}>Fotos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
            {fotos.map((m: any) => <a key={m.id} href={m._src} target="_blank" rel="noreferrer"><img src={m._src} loading="lazy" alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} /></a>)}
          </div>
        </>}
        {otros.map((m: any) => (
          <a key={m.id} href={m._dl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', fontSize: 12, color: C.g700, textDecoration: 'none', borderBottom: `1px solid ${C.g50}` }}>
            <span style={{ fontSize: 16 }}>{m.tipo === 'audio' ? '🎵' : '📄'}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.filename || m.cuerpo || m.tipo}</span>
            <span style={{ fontSize: 10, color: C.g400 }}>{fecha(m.created_at)}</span>
          </a>
        ))}
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
      {/* Contenido colapsable */}
      {abiertoPanel && (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ height: L.header, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 8px', borderBottom: `1px solid ${C.g100}`, position: 'relative' }}>
            {tab === 'info' ? (['info', 'actividad'] as const).map(s => (
              <button key={s} onClick={() => setSubInfo(s)} style={{ flex: 1, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: subInfo === s ? C.g900 : C.g400, padding: '10px 0', position: 'relative', textTransform: 'capitalize' }}>
                {s}
                {subInfo === s && <span style={{ position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, borderRadius: 999, background: C.emerald500 }} />}
              </button>
            )) : <b style={{ fontSize: 13, paddingLeft: 8 }}>{TABS.find(t => t.id === tab)?.t}</b>}
          </div>
          <div className="wa-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {tab === 'info' && (subInfo === 'info' ? <TabInfo /> : <TabActividad />)}
            {tab === 'acciones' && <TabAcciones />}
            {tab === 'adjuntos' && <TabAdjuntos />}
            {tab === 'notas' && <TabNotas />}
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
