// WHATSAPP · Acciones de venta EJECUTABLES desde el panel del inbox.
//
// La regla: lo mínimo indispensable para ejecutar SIN salir de la conversación.
//  - Cotizar: plan + periodo + sucursales + extras → crear → link al instante
//    → enviar por WhatsApp (texto con link si la ventana está abierta;
//    plantilla UTILITY si está cerrada) y/o por correo.
//  - Agendar: fecha → horarios reales disponibles → confirmar (las
//    confirmaciones por correo+WhatsApp y la secuencia de demo son automáticas
//    del sistema de agenda) — o ENVIARLE los horarios al cliente para que
//    elija él con el link público, y todo se confirma solo.
// Los precios salen del MISMO catálogo que la cotización grande (PLAN_PRICES);
// los envíos van por los MISMOS endpoints del inbox — cero caminos paralelos.
import { useEffect, useMemo, useState } from 'react';
import { C } from './estilo';
import { PLANS, PLAN_PRICES, IMPL_PRICES, fmt } from '../../../../lib/quotes/constants';

const BASE = 'https://www.sacscloud.com';
const PLANES_VENDIBLES = PLANS.filter(p => PLAN_PRICES[p] > 0);
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const inp: React.CSSProperties = { border: `1px solid ${C.g200}`, borderRadius: 8, padding: '10px 12px', fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box', width: '100%', minHeight: 44 };
const btnP: React.CSSProperties = { border: 'none', background: C.moradoTinta, color: '#fff', borderRadius: 9, padding: '12px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', minHeight: 48, boxSizing: 'border-box' };
const btnG: React.CSSProperties = { border: `1px solid ${C.g200}`, background: '#fff', borderRadius: 9, padding: '11px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: C.g700, minHeight: 48, boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 800, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em', margin: '10px 0 4px' };
const pill = (on: boolean): React.CSSProperties => ({ border: '1.5px solid', borderColor: on ? '#c9bcf7' : C.g200, background: on ? C.moradoAgua : '#fff', color: on ? C.moradoTinta : C.g500, borderRadius: 999, padding: '11px 14px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44, boxSizing: 'border-box' });

function fechaHumana(f: string) {
  const [y, m, d] = f.split('-').map(Number);
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  return `${dias[new Date(y, m - 1, d).getDay()]} ${d} ${MESES[m - 1]}`;
}
function horaHumana(h: string) {
  const [hh, mm] = h.split(':').map(Number);
  const ampm = hh >= 12 ? 'pm' : 'am';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

export default function AccionesVenta({ contacto, empresa, conv, ventanaAbierta, abrirFicha, accionInicial, refrescar }: {
  contacto: any; empresa: any; conv: any; ventanaAbierta: boolean;
  abrirFicha?: () => void; accionInicial?: 'cotizar' | 'agendar' | null; refrescar?: () => void;
}) {
  const [vista, setVista] = useState<'menu' | 'cotizar' | 'agendar'>(accionInicial || 'menu');
  useEffect(() => { if (accionInicial) setVista(accionInicial); }, [accionInicial]);
  const telefono = conv?.telefono || contacto?.whatsapp || null;
  const nombre = [contacto?.nombre, contacto?.apellido].filter(Boolean).join(' ') || contacto?.nombre || '';
  const primerNombre = String(contacto?.nombre || '').trim().split(/\s+/)[0] || 'Hola';

  // ── Los atajos que solo navegan (sin flujo propio todavía) ──
  const atajos = [
    { e: '🎯', t: 'Oportunidad', d: 'Nueva oportunidad', href: `/admin/crm?tab=oportunidades`, ok: !!(empresa || contacto) },
    { e: '👤', t: 'Ficha 360', d: 'Ver completa', onClick: abrirFicha, ok: !!empresa },
    { e: '🧾', t: 'Estado de cuenta', d: 'Suscripciones', href: `/admin/crm?tab=suscripciones`, ok: !!empresa },
    { e: '📣', t: 'Masivo', d: 'Incluir en campaña', href: `/admin/crm?tab=wa-masivos`, ok: true },
  ];

  if (vista === 'cotizar') return <Cotizar contacto={contacto} empresa={empresa} conv={conv} telefono={telefono} nombre={nombre} primerNombre={primerNombre} ventanaAbierta={ventanaAbierta} volver={() => setVista('menu')} refrescar={refrescar} />;
  if (vista === 'agendar') return <Agendar contacto={contacto} empresa={empresa} conv={conv} telefono={telefono} nombre={nombre} primerNombre={primerNombre} ventanaAbierta={ventanaAbierta} volver={() => setVista('menu')} refrescar={refrescar} />;

  return (
    <div className="accv" style={{ padding: 14 }}>
      <EstiloAccv />
      <div style={{ fontSize: 10, fontWeight: 800, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Ventas · se ejecutan aquí mismo</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <BotonAccion e="📄" t="Cotización" d="Crear y enviar aquí" ok={!!contacto} onClick={() => setVista('cotizar')} destacado />
        <BotonAccion e="📅" t="Reunión" d="Agendar o mandar horarios" ok={!!contacto} onClick={() => setVista('agendar')} destacado />
        {atajos.map(a => (
          <BotonAccion key={a.t} e={a.e} t={a.t} d={a.ok ? a.d : 'Sin contacto'} ok={a.ok}
            onClick={() => a.onClick ? a.onClick() : (a.href && (window.location.href = a.href))} />
        ))}
      </div>
    </div>
  );
}

function BotonAccion({ e, t, d, ok, onClick, destacado }: { e: string; t: string; d: string; ok: boolean; onClick?: () => void; destacado?: boolean }) {
  return (
    <button disabled={!ok} onClick={onClick} className="wa-grupo"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: 12, borderRadius: 12, minHeight: 44, border: `1px solid ${destacado ? '#c9bcf7' : C.g100}`, background: destacado ? 'rgba(238,236,254,.35)' : '#fff', cursor: ok ? 'pointer' : 'not-allowed', fontFamily: 'inherit', filter: ok ? 'none' : 'grayscale(1)', opacity: ok ? 1 : .5 }}>
      <span style={{ fontSize: 22 }}>{e}</span>
      <b style={{ fontSize: 11 }}>{t}</b>
      <span style={{ fontSize: 9, color: C.g400 }}>{d}</span>
    </button>
  );
}

// El CSS móvil del CRM aplana botones con !important y especificidad alta;
// estas reglas viajan con el componente (se montan también en el detalle
// móvil) y ganan por especificidad (.accv repetido) — targets táctiles 44/48.
export function EstiloAccv() {
  return (
    <style>{`
      .accv.accv.accv button { min-height: 44px !important; }
      .accv.accv.accv button.accv-grande { min-height: 48px !important; }
      .accv-tap.accv-tap.accv-tap { min-height: 44px !important; }
    `}</style>
  );
}

function Volver({ volver, titulo }: { volver: () => void; titulo: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, position: 'relative', zIndex: 5 }}>
      <EstiloAccv />
      <button onClick={volver} style={{ ...btnG, padding: '4px 12px', fontSize: 12 }}>←</button>
      <b style={{ fontSize: 12.5 }}>{titulo}</b>
    </div>
  );
}

// ══ COTIZAR: crear + link + enviar, sin salir ═══════════════════════════════
function Cotizar({ contacto, empresa, conv, telefono, nombre, primerNombre, ventanaAbierta, volver, refrescar }: any) {
  const [plan, setPlan] = useState('controla');
  const [periodo, setPeriodo] = useState<'mensual' | 'anual'>('mensual');
  const [sucursales, setSucursales] = useState(String(empresa?.sucursales || 1));
  const [conImpl, setConImpl] = useState(false);
  const [extras, setExtras] = useState<{ nombre: string; monto: string; recurrente: boolean }[]>([]);
  const [creando, setCreando] = useState(false);
  const [hecha, setHecha] = useState<any>(null);   // { id, folio }
  const [msg, setMsg] = useState('');
  const [enviado, setEnviado] = useState<{ wa?: boolean; correo?: boolean }>({});

  const suc = Math.max(1, parseInt(sucursales) || 1);
  const factorAnual = periodo === 'anual' ? 10 : 1;   // regla de planes: el año son 10 meses (2 gratis)
  const subPlan = (PLAN_PRICES[plan] || 0) * suc * factorAnual;
  const subImpl = conImpl ? (IMPL_PRICES[plan] || 0) : 0;
  // Solo cuentan los extras COMPLETOS (concepto + monto): un extra a medias no
  // entra ni al total ni a la cotización — nada de cobros invisibles.
  const extrasValidos = extras.filter(x => x.nombre.trim() && (parseFloat(x.monto) || 0) > 0);
  const extraMonto = (x: any) => (parseFloat(x.monto) || 0) * (x.recurrente ? factorAnual : 1);
  const subExtras = extrasValidos.reduce((a, x) => a + extraMonto(x), 0);
  const total = subPlan + subImpl + subExtras;
  const extrasAMedias = extras.some(x => (x.nombre.trim() ? !(parseFloat(x.monto) > 0) : (parseFloat(x.monto) || 0) > 0));

  const crear = async () => {
    setMsg(''); setCreando(true);
    const items: any[] = [{ tipo: 'plan', nombre: plan, sucursales: suc, precio_unitario: PLAN_PRICES[plan] || 0, periodo, descuento_pct: 0, subtotal: subPlan }];
    if (conImpl) items.push({ tipo: 'extra', categoria_comision: 'personalizacion', nombre: `Implementación ${plan.charAt(0).toUpperCase()}${plan.slice(1)}`, monto: subImpl, recurrente: false, subtotal: subImpl });
    for (const x of extrasValidos) {
      const monto = parseFloat(x.monto) || 0;
      items.push({ tipo: 'extra', categoria_comision: 'personalizacion', nombre: x.nombre.trim(), monto,
        recurrente: x.recurrente, periodo_extra: x.recurrente ? (periodo === 'anual' ? 'anual' : 'mensual') : 'unico',
        subtotal: extraMonto(x) });
    }
    const r = await fetch('/api/revenue/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresa: empresa?.nombre_comercial || empresa?.nombre || nombre || 'Por definir',
        contacto: nombre || null, email: contacto?.email || null, whatsapp: telefono || null,
        company_id: empresa?.id || null, contact_id: contacto?.id || null,
        items, iva_incluido: false, moneda: 'MXN', estado: 'draft', created_via: 'inbox',
        // El servidor NO recalcula en el POST: los totales viajan explícitos
        // (misma regla que el editor grande) o la cotización sale en $0.
        subtotal: total, iva_monto: 0, total,
      }),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setCreando(false);
    if (r?.error || !r?.id) { setMsg(r?.error || 'No se pudo crear la cotización.'); return; }
    setHecha({ id: r.id, folio: r.folio || r.id.slice(0, 8) });
    refrescar?.();
  };

  const link = hecha ? `${BASE}/cotizacion/${hecha.id}` : '';
  const enviarWA = async () => {
    setMsg('');
    const body = ventanaAbierta
      ? { conversation_id: conv?.id || undefined, telefono: conv?.id ? undefined : telefono, texto: `${primerNombre}, tu cotización ${hecha.folio} ya está lista 🙂 La puedes ver aquí: ${link} — cualquier duda me dices por aquí y la ajustamos.` }
      : { telefono, plantilla: { nombre: 'cotizacion_lista', idioma: 'es_MX', params: [primerNombre, String(hecha.folio)] } };
    const r = await fetch('/api/crm/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    if (r?.error) { setMsg(`WhatsApp: ${r.error}`); return; }
    fetch('/api/revenue/quotes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: hecha.id, estado: 'enviada' }) }).catch(() => {});
    setEnviado(e => ({ ...e, wa: true }));
  };
  const enviarCorreo = async () => {
    setMsg('');
    const r = await fetch('/api/crm/whatsapp/enviar-correo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contacto?.id, para: contacto?.email, asunto: `Tu cotización ${hecha.folio} de Sacs`, texto: `Hola ${primerNombre},\n\nTu cotización ${hecha.folio} ya está lista. La puedes revisar aquí:\n${link}\n\nCualquier duda respóndeme este correo o mi WhatsApp y la ajustamos juntos.\n\nSaludos,\nEquipo Sacs` }),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    if (r?.error) { setMsg(`Correo: ${r.error}`); return; }
    fetch('/api/revenue/quotes', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: hecha.id, estado: 'enviada' }) }).catch(() => {});
    setEnviado(e => ({ ...e, correo: true }));
  };

  if (hecha) return (
    <div className="accv" style={{ padding: 14 }}>
      <Volver volver={volver} titulo={`Cotización ${hecha.folio} creada`} />
      <div style={{ border: `1px solid ${C.g200}`, borderRadius: 10, padding: 12, background: '#fff' }}>
        <div style={{ fontSize: 11, color: C.g500, marginBottom: 6 }}>El link del cliente:</div>
        <a href={`${link}?admin=1`} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: C.moradoTinta, fontWeight: 700, wordBreak: 'break-all' }}>{link}</a>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          <button style={btnG} onClick={() => { navigator.clipboard?.writeText(link); setMsg('Link copiado.'); }}>Copiar</button>
          <button style={{ ...btnP, background: telefono ? '#059669' : C.g300, flex: 1 }} disabled={!telefono || enviado.wa} onClick={enviarWA}>
            {enviado.wa ? 'Enviado por WhatsApp ✓' : ventanaAbierta ? 'Enviar por WhatsApp' : 'Avisar por WhatsApp (plantilla)'}
          </button>
          <button style={{ ...btnP, flex: 1, background: contacto?.email ? C.moradoTinta : C.g300 }} disabled={!contacto?.email || enviado.correo} onClick={enviarCorreo}>
            {enviado.correo ? 'Enviado por correo ✓' : 'Enviar por correo'}
          </button>
        </div>
        {!ventanaAbierta && telefono && !enviado.wa && (
          <p style={{ fontSize: 10, color: C.ambar700, margin: '8px 0 0' }}>La ventana de 24 h está cerrada: va una plantilla de aviso; el link completo mándalo cuando responda (o ya va en el correo).</p>
        )}
        {!telefono && <p style={{ fontSize: 10, color: C.g400, margin: '8px 0 0' }}>Sin WhatsApp en la ficha.</p>}
        {!contacto?.email && <p style={{ fontSize: 10, color: C.g400, margin: '4px 0 0' }}>Sin correo en la ficha.</p>}
        {msg && <p style={{ fontSize: 11, color: msg.includes('copiado') ? C.emerald700 : C.rojo700, margin: '8px 0 0' }}>{msg}</p>}
      </div>
    </div>
  );

  return (
    <div className="accv" style={{ padding: 14 }}>
      <Volver volver={volver} titulo="Nueva cotización" />
      <span style={lbl}>Plan</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
        {PLANES_VENDIBLES.map(p => (
          <button key={p} onClick={() => setPlan(p)} style={{ ...pill(plan === p), borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
            <b style={{ textTransform: 'capitalize' }}>{p}</b><span style={{ fontSize: 10.5, fontWeight: 600 }}>{fmt(PLAN_PRICES[p])}/mes por sucursal</span>
          </button>
        ))}
      </div>
      <span style={lbl}>Periodo</span>
      <div style={{ display: 'flex', gap: 5 }}>
        <button onClick={() => setPeriodo('mensual')} style={pill(periodo === 'mensual')}>Mensual</button>
        <button onClick={() => setPeriodo('anual')} style={pill(periodo === 'anual')}>Anual · 2 meses gratis</button>
      </div>
      <span style={lbl}>Sucursales</span>
      <input type="number" min={1} value={sucursales} onChange={e => setSucursales(e.target.value)}
        onBlur={() => setSucursales(String(Math.max(1, parseInt(sucursales) || 1)))} style={{ ...inp, width: 90 }} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5, fontWeight: 600, margin: '10px 0 0', cursor: 'pointer', minHeight: 44 }}>
        <input type="checkbox" checked={conImpl} onChange={e => setConImpl(e.target.checked)} style={{ width: 18, height: 18 }} />
        Implementación ({fmt(IMPL_PRICES[plan] || 0)} único)
      </label>
      <span style={lbl}>Extras</span>
      {extras.map((x, i) => (
        <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
          <input placeholder="Concepto" value={x.nombre} onChange={e => setExtras(extras.map((y, j) => j === i ? { ...y, nombre: e.target.value } : y))} style={{ ...inp, flex: 1 }} />
          <input placeholder="$" type="number" value={x.monto} onChange={e => setExtras(extras.map((y, j) => j === i ? { ...y, monto: e.target.value } : y))} style={{ ...inp, width: 76 }} />
          <button title={x.recurrente ? 'Cobro mensual' : 'Cobro único'} onClick={() => setExtras(extras.map((y, j) => j === i ? { ...y, recurrente: !y.recurrente } : y))} style={{ ...btnG, minHeight: 36, padding: '4px 8px', fontSize: 10 }}>{x.recurrente ? '/mes' : 'único'}</button>
          <button onClick={() => setExtras(extras.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', color: C.g400, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
        </div>
      ))}
      <button style={{ ...btnG, minHeight: 32, padding: '4px 10px', fontSize: 11 }} onClick={() => setExtras([...extras, { nombre: '', monto: '', recurrente: false }])}>+ Agregar extra</button>
      {extrasAMedias && <p style={{ fontSize: 10, color: C.ambar700, margin: '8px 0 0' }}>Un extra sin concepto o sin monto NO se incluye — complétalo o quítalo.</p>}
      <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: C.moradoAgua, fontSize: 12, fontWeight: 700, color: C.moradoTinta }}>
        Total {periodo === 'anual' ? 'del año' : 'mensual'}: {fmt(subPlan + extrasValidos.filter(x => x.recurrente).reduce((a, x) => a + extraMonto(x), 0))}
        {(subImpl > 0 || extrasValidos.some(x => !x.recurrente)) && <span style={{ fontWeight: 600 }}> + {fmt(subImpl + extrasValidos.filter(x => !x.recurrente).reduce((a, x) => a + (parseFloat(x.monto) || 0), 0))} por única vez</span>}
      </div>
      <button className="accv-grande" style={{ ...btnP, width: '100%', marginTop: 10 }} disabled={creando} onClick={crear}>{creando ? 'Creando…' : `Crear cotización · ${fmt(total)}`}</button>
      {msg && <p style={{ fontSize: 11, color: C.rojo700, margin: '8px 0 0' }}>{msg}</p>}
    </div>
  );
}

// ══ AGENDAR: horarios reales aquí mismo, o mandárselos al cliente ═══════════
function Agendar({ contacto, empresa, conv, telefono, nombre, primerNombre, ventanaAbierta, volver, refrescar }: any) {
  const [slots, setSlots] = useState<Record<string, string[]> | null>(null);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [email, setEmail] = useState(contacto?.email || '');
  const [proxima, setProxima] = useState<any>(null);
  const [ocupado, setOcupado] = useState(false);
  const [hecho, setHecho] = useState<'agendada' | 'enviado_wa' | 'enviado_correo' | ''>('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const from = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 11 * 86400000).toISOString().slice(0, 10);
    fetch(`/api/scheduling/available-slots?slug=demo&from=${from}&to=${to}`)
      .then(r => r.json()).then(j => setSlots(j.dates || {})).catch(() => setSlots({}));
    if (empresa?.id) {
      const hoy = new Date().toISOString().slice(0, 10);
      fetch(`/api/scheduling/reuniones?company_id=${empresa.id}&from=${hoy}`).then(r => r.json())
        .then(j => setProxima((j.reuniones || j.bookings || j.data || [])
          .find((b: any) => b.estado === 'confirmada' && (!contacto?.id || !b.contact_id || b.contact_id === contacto.id)) || null))
        .catch(() => {});
    }
  }, [contacto?.id, empresa?.id]);

  const dias = useMemo(() => Object.keys(slots || {}).filter(f => (slots as any)[f]?.length).slice(0, 8), [slots]);
  const primeros = useMemo(() => {
    const out: string[] = [];
    for (const f of dias) { for (const h of (slots as any)[f]) { out.push(`${fechaHumana(f)} ${horaHumana(h)}`); if (out.length >= 4) return out; } }
    return out;
  }, [dias, slots]);

  const emailValido = /.+@.+\..+/.test(email.trim());
  const agendar = async () => {
    setMsg('');
    if (!emailValido) { setMsg('Escribe un correo válido: ahí llega su confirmación e invitación de calendario.'); return; }
    setOcupado(true);
    const r = await fetch('/api/scheduling/book', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type_slug: 'demo', fecha, hora_inicio: hora, nombre: nombre || primerNombre, email: email.trim(), whatsapp: telefono || undefined, empresa: empresa?.nombre_comercial || empresa?.nombre || undefined, notas: 'Agendada desde el inbox por el equipo', timezone: 'America/Mexico_City', utm_source: 'inbox' }),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setOcupado(false);
    if (r?.error) { setMsg(r.error); return; }
    setHecho('agendada');
    refrescar?.();
  };

  const textoHorarios = `${primerNombre}, estos son los horarios más próximos para tu sesión consultiva (30-60 min, sin costo):\n\n${primeros.map(s => `• ${s}`).join('\n')}\n\nElige el que te acomode aquí y queda confirmada al momento (te llega la invitación por correo y WhatsApp):\n${BASE}/agendar/demo`;
  const enviarFechasWA = async () => {
    setMsg('');
    const r = await fetch('/api/crm/whatsapp/enviar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: conv?.id || undefined, telefono: conv?.id ? undefined : telefono, texto: textoHorarios }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    if (r?.error) { setMsg(`WhatsApp: ${r.error}`); return; }
    setHecho('enviado_wa');
  };
  const enviarFechasCorreo = async () => {
    setMsg('');
    const r = await fetch('/api/crm/whatsapp/enviar-correo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_id: contacto?.id, para: email.trim() || contacto?.email, asunto: 'Horarios para tu sesión consultiva con Sacs', texto: textoHorarios }) }).then(x => x.json()).catch(e => ({ error: String(e) }));
    if (r?.error) { setMsg(`Correo: ${r.error}`); return; }
    setHecho('enviado_correo');
  };

  if (hecho === 'agendada') return (
    <div className="accv" style={{ padding: 14 }}>
      <Volver volver={volver} titulo="Reunión agendada ✓" />
      <div style={{ border: `1px solid #A7F3D0`, background: C.emerald50, borderRadius: 10, padding: 12, fontSize: 12, color: C.emerald700, lineHeight: 1.5 }}>
        <b>{fechaHumana(fecha)} · {horaHumana(hora)}</b><br />
        La confirmación ya va en camino por correo y WhatsApp, con su invitación de calendario y link de Meet. La secuencia de «Demo agendada» lo toma sola en la próxima corrida.
      </div>
    </div>
  );

  return (
    <div className="accv" style={{ padding: 14 }}>
      <Volver volver={volver} titulo="Agendar reunión" />
      {proxima && (
        <div style={{ border: `1px solid ${C.ambar200}`, background: C.ambar50, borderRadius: 10, padding: '8px 11px', fontSize: 11, color: C.ambar700, marginBottom: 10 }}>
          Ya tiene reunión el <b>{fechaHumana(String(proxima.fecha))} · {horaHumana(String(proxima.hora_inicio).slice(0, 5))}</b>. Antes de duplicar, mejor reagendar esa.
        </div>
      )}
      {(hecho === 'enviado_wa' || hecho === 'enviado_correo') && (
        <div style={{ border: `1px solid #A7F3D0`, background: C.emerald50, borderRadius: 10, padding: '8px 11px', fontSize: 11, color: C.emerald700, marginBottom: 10 }}>
          Horarios enviados {hecho === 'enviado_wa' ? 'por WhatsApp' : 'por correo'} ✓ — cuando elija, todo se confirma solo (correo + WhatsApp + secuencia).
        </div>
      )}
      {slots === null && <p style={{ fontSize: 11, color: C.g400 }}>Cargando horarios disponibles…</p>}
      {slots !== null && !dias.length && <p style={{ fontSize: 11, color: C.rojo700 }}>No hay horarios disponibles en los próximos 10 días — revisa la disponibilidad en Agenda.</p>}
      {dias.length > 0 && <>
        <span style={lbl}>Día</span>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {dias.map(f => <button key={f} onClick={() => { setFecha(f); setHora(''); }} style={pill(fecha === f)}>{fechaHumana(f)}</button>)}
        </div>
        {fecha && <>
          <span style={lbl}>Horario (CDMX)</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {((slots as any)[fecha] || []).map((h: string) => <button key={h} onClick={() => setHora(h)} style={pill(hora === h)}>{horaHumana(h)}</button>)}
          </div>
        </>}
        <span style={lbl}>Correo del cliente (obligatorio para confirmar)</span>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@correo.com" style={inp} />
        <button className="accv-grande" style={{ ...btnP, width: '100%', marginTop: 10, background: fecha && hora && emailValido ? C.moradoTinta : C.g300 }} disabled={!fecha || !hora || !emailValido || ocupado} onClick={agendar}>
          {ocupado ? 'Agendando…' : !emailValido ? 'Falta un correo válido' : fecha && hora ? `Agendar ${fechaHumana(fecha)} · ${horaHumana(hora)}` : 'Elige día y horario'}
        </button>
        <div style={{ borderTop: `1px solid ${C.g100}`, margin: '14px 0 10px', paddingTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.g700, marginBottom: 6 }}>¿Prefieres que elija él? Mándale los horarios:</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ ...btnG, flex: 1, color: '#059669', borderColor: '#A7F3D0', ...(!telefono || !ventanaAbierta ? { opacity: .45, cursor: 'not-allowed', filter: 'grayscale(.6)' } : {}) }} disabled={!telefono || !ventanaAbierta} onClick={enviarFechasWA}
              title={!ventanaAbierta ? 'Ventana de 24 h cerrada: usa el correo o una plantilla desde el composer' : ''}>Por WhatsApp</button>
            <button style={{ ...btnG, flex: 1, color: C.moradoTinta, ...(!(email.trim() || contacto?.email) ? { opacity: .45, cursor: 'not-allowed' } : {}) }} disabled={!(email.trim() || contacto?.email)} onClick={enviarFechasCorreo}>Por correo</button>
          </div>
          {!ventanaAbierta && telefono && <p style={{ fontSize: 10, color: C.ambar700, margin: '6px 0 0' }}>La ventana de WhatsApp está cerrada — por correo sí sale ya, con el link para que elija.</p>}
        </div>
      </>}
      {msg && <p style={{ fontSize: 11, color: C.rojo700, margin: '8px 0 0' }}>{msg}</p>}
    </div>
  );
}
