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
import { useEffect, useMemo, useRef, useState } from 'react';
import { C } from './estilo';
import { Corazones } from '../ui/Cargando';
import { PLANS, PLAN_PRICES, MESES_ANUAL, IMPL_PRICES, fmt } from '../../../../lib/quotes/constants';
import CuentaSacs from '../CuentaSacs';
import { IcoChispas } from './Iconos';

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

export default function AccionesVenta({ contacto, empresa, conv, ventanaAbierta, abrirFicha, accionInicial, refrescar, resumenIa, resumenIaAt }: {
  contacto: any; empresa: any; conv: any; ventanaAbierta: boolean;
  abrirFicha?: () => void; accionInicial?: 'cotizar' | 'agendar' | null; refrescar?: () => void;
  /** El resumen de la relación se pinta AQUÍ: generarlo es una acción, no una
   *  actividad que ya ocurrió. Vivía en la pestaña «Actividad», entre cosas
   *  pasadas, y era la única tarjeta de ahí con un botón que hace algo. */
  resumenIa?: string | null; resumenIaAt?: string | null;
}) {
  const [vista, setVista] = useState<'menu' | 'cotizar' | 'agendar' | 'seguimiento' | 'conciliacion'>(accionInicial || 'menu');
  const [cuentaAbierta, setCuentaAbierta] = useState(false);
  const [resumenAbierto, setResumenAbierto] = useState(false);
  useEffect(() => { if (accionInicial) setVista(accionInicial); }, [accionInicial]);
  const telefono = conv?.telefono || contacto?.whatsapp || null;
  const nombre = [contacto?.nombre, contacto?.apellido].filter(Boolean).join(' ') || contacto?.nombre || '';
  const primerNombre = String(contacto?.nombre || '').trim().split(/\s+/)[0] || 'Hola';

  // ── Los atajos que solo navegan (sin flujo propio todavía) ──
  const atajos = [
    { e: '👤', t: 'Ficha 360', d: 'Ver completa', onClick: abrirFicha, ok: !!empresa },
    { e: '🧾', t: 'Estado de cuenta', d: 'Suscripciones', href: `/admin/crm?tab=suscripciones`, ok: !!empresa },
    { e: '📣', t: 'Masivo', d: 'Incluir en campaña', href: `/admin/crm?tab=wa-masivos`, ok: true },
  ];

  if (vista === 'cotizar') return <Cotizar contacto={contacto} empresa={empresa} conv={conv} telefono={telefono} nombre={nombre} primerNombre={primerNombre} ventanaAbierta={ventanaAbierta} volver={() => setVista('menu')} refrescar={refrescar} />;
  if (vista === 'conciliacion') return <CartaConciliacion contacto={contacto} empresa={empresa} primerNombre={primerNombre} volver={() => setVista('menu')} refrescar={refrescar} />;
  if (vista === 'seguimiento') return <PedirSeguimiento contacto={contacto} conv={conv} primerNombre={primerNombre} volver={() => setVista('menu')} refrescar={refrescar} />;
  if (vista === 'agendar') return <Agendar contacto={contacto} empresa={empresa} conv={conv} telefono={telefono} nombre={nombre} primerNombre={primerNombre} ventanaAbierta={ventanaAbierta} volver={() => setVista('menu')} refrescar={refrescar} />;

  return (
    <div className="accv" style={{ padding: 14 }}>
      <EstiloAccv />
      {/* ── UNA SOLA CUADRÍCULA ──────────────────────────────────────────────
          Aquí había tres formas conviviendo: una barra ancha arriba («Resumen
          de la relación», con su botón morado a la derecha), la cuadrícula de
          cuadros en medio, y otra barra ancha al final (la cuenta de SACS).
          Tres lenguajes para lo mismo —cosas que se pueden hacer con este
          contacto— y dos de ellas rompiendo la retícula por arriba y por abajo.

          Ahora es una cuadrícula y ya: todo lo que se puede hacer es un cuadro
          del mismo tamaño. Lo que necesita más espacio —el resumen generado, la
          cuenta con sus motivos de revocación— se despliega DEBAJO al tocar su
          cuadro, no antes. */}
      <div style={{ fontSize: 10, fontWeight: 800, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Ventas · se ejecutan aquí mismo</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <BotonAccion e="📄" t="Cotización" d="Crear y enviar aquí" ok={!!contacto} onClick={() => setVista('cotizar')} destacado />
        <BotonAccion e="📅" t="Reunión" d="Agendar o mandar horarios" ok={!!contacto} onClick={() => setVista('agendar')} destacado />
        {/* «Te marco en 30 días» necesitaba un lugar: vivía en la cabeza de
            quien contestó y se perdía. Dos campos y ya — motivo y fecha—,
            porque si pedir un seguimiento cuesta más que anotarlo en un papel,
            se anota en el papel. Aparece en la bandeja «Pidió seguimiento». */}
        <BotonAccion e="⏰" t="Seguimiento" d="Prometiste marcarle" ok={!!contacto} onClick={() => setVista('seguimiento')} />
        {/* La carta de conciliación se redacta AQUÍ y no por API: el motor se
            construyó primero, pero una carta que solo se puede crear con curl
            no la usa nadie. Se ofrece solo a quien ya se fue o se descalificó —
            mandarle una conciliación a un cliente activo no tiene sentido. */}
        {['churned', 'descalificado', 'rezagado', 'en_conciliacion'].includes(String(contacto?.lifecycle_stage || '')) && (
          <BotonAccion e="🤝" t="Conciliación" d="Carta con firma" ok={!!contacto} onClick={() => setVista('conciliacion')} />
        )}
        {atajos.map(a => (
          <BotonAccion key={a.t} e={a.e} t={a.t} d={a.ok ? a.d : 'Sin contacto'} ok={a.ok}
            onClick={() => a.onClick ? a.onClick() : (a.href && (window.location.href = a.href))} />
        ))}
        {contacto?.id && (
          <BotonAccion e="🧠" t="Resumen" d={resumenAbierto ? 'Ocultar' : 'La relación en 30 s'} ok
            onClick={() => setResumenAbierto(v => !v)} />
        )}
        {/* La cuenta va de últimas: revocarla es lo que MENOS veces se hace de
            esta pantalla. Solo si hay cuenta ligada. */}
        {contacto?.id && (
          <BotonAccion e="🔐" t="Acceso a SACS" d={cuentaAbierta ? 'Ocultar' : 'Ver y revocar'} ok
            onClick={() => setCuentaAbierta(v => !v)} />
        )}
      </div>

      {resumenAbierto && contacto?.id && (
        <div style={{ marginTop: 10 }}>
          <ResumenRelacion contactId={contacto.id} inicial={resumenIa} inicialAt={resumenIaAt} />
        </div>
      )}
      {cuentaAbierta && contacto?.id && (
        <div style={{ marginTop: 10 }}>
          <CuentaSacs contactId={contacto.id} companyId={empresa?.id} compacto alCambiar={refrescar} />
        </div>
      )}
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

/* ══ CARTA DE CONCILIACIÓN ═══════════════════════════════════════════════════
   Se redacta, se manda y se copia la liga sin salir de la conversación.

   Lo importante de esta pantalla es lo que NO hace: no trae la carta escrita.
   Cada conciliación es un trato distinto —a uno le perdonas un adeudo, a otro
   le bajas el precio— y una plantilla fija haría que se mandaran cartas que no
   corresponden. Lo que sí trae son tres arranques para no partir de la hoja en
   blanco, que es lo que de verdad frena.

   Y avisa antes de crear: lo que escribas es lo que el cliente va a firmar, y
   después de mandarla el texto ya no se toca — un documento editable después
   de firmado no prueba nada. */
function CartaConciliacion({ contacto, empresa, primerNombre, volver, refrescar }: {
  contacto: any; empresa: any; primerNombre: string; volver: () => void; refrescar?: () => void;
}) {
  const [titulo, setTitulo] = useState('Volvamos a trabajar juntos');
  const [cuerpo, setCuerpo] = useState('');
  const [monto, setMonto] = useState('');
  const [vigencia, setVigencia] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  const [url, setUrl] = useState('');
  const [copiado, setCopiado] = useState(false);

  const negocio = empresa?.nombre_comercial || empresa?.nombre || 'tu tienda';
  const ARRANQUES: { t: string; texto: string }[] = [
    { t: 'Le perdono el adeudo', texto: `${primerNombre}, queremos que ${negocio} vuelva a usar Sacs.\n\nCancelamos el adeudo que quedó pendiente: empiezas de cero, sin deber nada.\n\nRetomas con la misma información que ya tenías —tu catálogo, tus clientes, tu historial— y te acompañamos las primeras semanas para dejarlo funcionando.` },
    { t: 'Le bajo el precio', texto: `${primerNombre}, queremos que ${negocio} vuelva a usar Sacs.\n\nTe respetamos el precio que tenías cuando te fuiste, congelado por 12 meses.\n\nRetomas con toda tu información y te acompañamos las primeras semanas para dejarlo funcionando.` },
    { t: 'Le regalo meses', texto: `${primerNombre}, queremos que ${negocio} vuelva a usar Sacs.\n\nLos primeros dos meses corren por nuestra cuenta: los usas sin pagar y decides después.\n\nRetomas con toda tu información y te acompañamos para dejarlo funcionando desde el primer día.` },
  ];

  const enDias = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const crear = async (mandar: boolean) => {
    setMsg('');
    if (cuerpo.trim().length < 40) { setMsg('Escribe el acuerdo: qué le ofreces y qué esperas de él.'); return; }
    setOcupado(true);
    const r = await fetch('/api/crm/conciliacion', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'crear', contact_id: contacto?.id, company_id: empresa?.id || undefined,
        titulo: titulo.trim() || undefined, cuerpo: cuerpo.trim(),
        monto: monto ? Number(monto) : undefined, vigencia: vigencia || undefined,
      }),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    if (r?.error) { setOcupado(false); setMsg(r.error); return; }
    if (mandar) {
      const e = await fetch('/api/crm/conciliacion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'enviar', id: r.id }),
      }).then(x => x.json()).catch(() => ({}));
      if (e?.error) { setOcupado(false); setMsg(e.error); return; }
    }
    setOcupado(false); setUrl(r.url); refrescar?.();
  };

  if (url) return (
    <div className="accv" style={{ padding: 14 }}>
      <EstiloAccv />
      <Volver volver={volver} titulo="Conciliación" />
      <div style={{ border: `1px solid ${C.g200}`, borderRadius: 10, padding: 16, marginTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.emerald700 }}>Lista para mandar</div>
        <p style={{ fontSize: 11.5, color: C.g500, margin: '8px 0 10px', lineHeight: 1.5 }}>
          Mándale esta liga por WhatsApp. Cuando la firme, pasa solo a <b>En conciliación</b>, te deja la tarea del día y te avisa.
        </p>
        <div style={{ fontSize: 11, color: C.moradoTinta, wordBreak: 'break-all', background: C.moradoAgua, borderRadius: 8, padding: '8px 10px' }}>{url}</div>
        <button className="accv-grande" style={{ ...btnP, width: '100%', marginTop: 10 }}
          onClick={() => { navigator.clipboard?.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}>
          {copiado ? 'Copiada' : 'Copiar la liga'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="accv" style={{ padding: 14 }}>
      <EstiloAccv />
      <Volver volver={volver} titulo="Carta de conciliación" />
      <p style={{ fontSize: 11.5, color: C.g500, margin: '2px 0 10px', lineHeight: 1.5 }}>
        Lo que escribas es <b>lo que va a firmar</b>. Después de mandarla el texto ya no se puede cambiar.
      </p>

      <span style={lbl}>Título</span>
      <input value={titulo} onChange={e => setTitulo(e.target.value)} style={inp} />

      <span style={lbl}>Empezar desde</span>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
        {ARRANQUES.map(a => (
          <button key={a.t} onClick={() => setCuerpo(a.texto)} style={pill(cuerpo === a.texto)}>{a.t}</button>
        ))}
      </div>

      <span style={lbl}>El acuerdo</span>
      <textarea value={cuerpo} onChange={e => setCuerpo(e.target.value)} rows={9}
        placeholder="Qué le ofreces y qué esperas de él. Se lee tal cual, así que escríbelo como se lo dirías de frente."
        style={{ ...inp, minHeight: 150, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <span style={lbl}>Monto (opcional)</span>
          <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="9000" style={inp} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={lbl}>Vence (opcional)</span>
          <input type="date" value={vigencia} min={enDias(1)} onChange={e => setVigencia(e.target.value)} style={inp} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
        {[['15 días', 15], ['30 días', 30]].map(([t, d]) => (
          <button key={String(t)} onClick={() => setVigencia(enDias(Number(d)))} style={pill(vigencia === enDias(Number(d)))}>{t}</button>
        ))}
      </div>

      <button className="accv-grande" onClick={() => crear(true)} disabled={ocupado || cuerpo.trim().length < 40}
        style={{ ...btnP, width: '100%', marginTop: 12, background: cuerpo.trim().length >= 40 ? C.moradoTinta : C.g300 }}>
        {ocupado ? 'Creando…' : 'Crear y obtener la liga'}
      </button>
      <button onClick={volver} style={{ ...btnG, marginTop: 8, width: '100%', color: C.g500 }}>Volver</button>
      {msg && <p style={{ fontSize: 11, color: C.rojo700, margin: '8px 0 0' }}>{msg}</p>}
    </div>
  );
}

/* ══ PIDIÓ SEGUIMIENTO ═══════════════════════════════════════════════════════
   Pedido del dueño (16-sep-2026): «tengo que darle seguimiento en 30 días,
   entonces me gustaría una opción rápida de un click, poner el motivo, ponerle
   una fecha».

   Dos campos y tres atajos de fecha. Deliberadamente NO hay más: si registrar la
   promesa cuesta más que apuntarla en un papel, se apunta en el papel y el CRM
   se queda sin saberlo. El resultado sale en la bandeja «Pidió seguimiento»,
   ordenada por fecha con los vencidos arriba. */
function PedirSeguimiento({ contacto, conv, primerNombre, volver, refrescar }: {
  contacto: any; conv: any; primerNombre: string; volver: () => void; refrescar?: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState('');
  const [hecho, setHecho] = useState(false);

  const enDias = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const hoy = new Date().toISOString().slice(0, 10);
  const humana = (f: string) => { if (!f) return ''; const [y, m, d] = f.split('-').map(Number); return `${d} ${MESES[m - 1]}`; };

  const guardar = async () => {
    setMsg('');
    if (!motivo.trim()) { setMsg('Escribe para qué es: en 30 días nadie se acuerda.'); return; }
    if (!fecha) { setMsg('Elige la fecha en que le toca.'); return; }
    setOcupado(true);
    const r = await fetch('/api/crm/whatsapp/etapa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'seguimiento', id: conv?.id, contact_id: contacto?.id, motivo: motivo.trim(), fecha }),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setOcupado(false);
    if (r?.error) { setMsg(r.error); return; }
    setHecho(true); refrescar?.();
  };

  if (hecho) return (
    <div className="accv" style={{ padding: 14 }}>
      <EstiloAccv />
      <Volver volver={volver} titulo="Seguimiento" />
      <div style={{ border: `1px solid ${C.g200}`, borderRadius: 10, padding: 16, marginTop: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.emerald700 }}>Anotado para el {humana(fecha)}</div>
        <p style={{ fontSize: 11.5, color: C.g500, margin: '8px 0 0', lineHeight: 1.5 }}>
          Lo vas a encontrar en la bandeja <b>Pidió seguimiento</b>, con los vencidos hasta arriba.
        </p>
      </div>
    </div>
  );

  return (
    <div className="accv" style={{ padding: 14 }}>
      <EstiloAccv />
      <Volver volver={volver} titulo="Pidió seguimiento" />
      <p style={{ fontSize: 11.5, color: C.g500, margin: '2px 0 10px', lineHeight: 1.5 }}>
        Lo que le prometiste a {primerNombre}. Sale de la bandeja el día que toca.
      </p>

      <span style={lbl}>¿Para qué?</span>
      <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2}
        placeholder="Ej. Retomar cuando termine su temporada alta"
        style={{ ...inp, minHeight: 56, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.45 }} />

      <span style={lbl}>¿Cuándo?</span>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
        {[['En 7 días', 7], ['En 15', 15], ['En 30', 30], ['En 60', 60]].map(([t, d]) => (
          <button key={String(t)} onClick={() => setFecha(enDias(Number(d)))} style={pill(fecha === enDias(Number(d)))}>{t}</button>
        ))}
      </div>
      <input type="date" value={fecha} min={hoy} onChange={e => setFecha(e.target.value)} style={inp} />

      <button className="accv-grande" onClick={guardar} disabled={ocupado || !motivo.trim() || !fecha}
        style={{ ...btnP, width: '100%', marginTop: 12, background: (motivo.trim() && fecha) ? C.moradoTinta : C.g300 }}>
        {ocupado ? 'Guardando…' : fecha ? `Recordármelo el ${humana(fecha)}` : 'Elige la fecha'}
      </button>
      <button onClick={volver} style={{ ...btnG, marginTop: 8, width: '100%', color: C.g500 }}>Volver</button>
      {msg && <p style={{ fontSize: 11, color: C.rojo700, margin: '8px 0 0' }}>{msg}</p>}
    </div>
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
  const [periodo, setPeriodo] = useState<'mensual' | 'anual'>('anual');
  const [sucursales, setSucursales] = useState(String(empresa?.sucursales || 1));
  const [conImpl, setConImpl] = useState(false);
  const [extras, setExtras] = useState<{ nombre: string; monto: string; recurrente: boolean }[]>([]);
  const [creando, setCreando] = useState(false);
  const [hecha, setHecha] = useState<any>(null);   // { id, folio }
  const [msg, setMsg] = useState('');
  const [enviado, setEnviado] = useState<{ wa?: boolean; correo?: boolean }>({});

  const suc = Math.max(1, parseInt(sucursales) || 1);
  const factorAnual = periodo === 'anual' ? MESES_ANUAL : 1;   // regla de planes: 12 meses con 35% de descuento (×7.8)
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
    const items: any[] = [{ tipo: 'plan', nombre: plan, sucursales: suc, precio_unitario: PLAN_PRICES[plan] || 0, periodo, descuento_pct: 0, subtotal: subPlan, meses_anual: periodo === 'anual' ? MESES_ANUAL : undefined }];
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
  const [hecho, setHecho] = useState<'agendada' | 'enviado_wa' | 'enviado_correo' | 'oferta' | ''>('');
  const [msg, setMsg] = useState('');
  /* La nota de contexto que lee el consultor en su invitación. Vive aquí y no
     en el backend del agendado porque el humano la corrige ANTES de confirmar. */
  const [nota, setNota] = useState('');
  const [notaCargando, setNotaCargando] = useState(false);
  const [notaMsg, setNotaMsg] = useState('');
  /* DOS CAMINOS, y se eligen ANTES de ver nada más.
     Antes esta pantalla era un formulario de reserva con el «mándale los
     horarios» escondido debajo: para la mitad de los casos —el cliente todavía
     no dijo cuándo puede— había que bajar hasta el pie y adivinar que eso
     existía. Son dos intenciones distintas y ahora se preguntan de frente. */
  const [ruta, setRuta] = useState<null | 'reservar' | 'lista' | 'auto'>(null);
  /* Cuántos días entran en la lista. «Hoy» sirve para cerrar el mismo día;
     7 días es para quien anda ocupado y necesita opciones. */
  const [rango, setRango] = useState<1 | 3 | 7>(3);

  useEffect(() => {
    /* Desde HOY, no desde mañana. «Mándale los horarios de hoy» era imposible
       porque la consulta empezaba el día siguiente: quien contesta a las 10 de
       la mañana con hueco a las 5 de la tarde no podía cerrar el mismo día. */
    const from = new Date().toISOString().slice(0, 10);
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

  /* La nota se genera UNA vez al abrir la ruta de reservar, no al confirmar:
     si se generara al final, el humano no alcanzaría a corregirla — que es
     justo lo que evita que una nota inventada llegue al calendario. Y no se
     repite si ya hay texto: regenerar encima de lo que alguien acaba de
     escribir borraría su trabajo sin avisar. */
  const generarNota = async () => {
    if (!conv?.id) return;
    setNotaCargando(true); setNotaMsg('');
    const r = await fetch('/api/crm/whatsapp/ia', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'contexto', wa_id: conv.id }),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setNotaCargando(false);
    if (r?.error) { setNotaMsg(r.error); return; }
    if (r?.nota) setNota(String(r.nota));
  };
  const yaPedida = useRef(false);
  useEffect(() => {
    if (ruta !== 'reservar' || !conv?.id || yaPedida.current || nota.trim()) return;
    yaPedida.current = true;
    generarNota();
  }, [ruta, conv?.id]);

  const agendar = async () => {
    setMsg('');
    if (!emailValido) { setMsg('Escribe un correo válido: ahí llega su confirmación e invitación de calendario.'); return; }
    setOcupado(true);
    const r = await fetch('/api/scheduling/book', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type_slug: 'demo', fecha, hora_inicio: hora, nombre: nombre || primerNombre, email: email.trim(), whatsapp: telefono || undefined, empresa: empresa?.nombre_comercial || empresa?.nombre || undefined, notas: nota.trim() || 'Agendada desde el inbox por el equipo', wa_conv_id: conv?.id || undefined, timezone: 'America/Mexico_City', utm_source: 'inbox' }),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setOcupado(false);
    if (r?.error) { setMsg(r.error); return; }
    setHecho('agendada');
    refrescar?.();
  };

  /* Los huecos DEL RANGO elegido, agrupados por día. Se listan hasta 4 horarios
     por día: una lista de veinte se lee como formulario y nadie contesta «el
     tercero de la segunda fila». */
  const porDiaDelRango = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const limite = new Date(hoy.getTime() + (rango - 1) * 86400000).toISOString().slice(0, 10);
    return Object.keys(slots || {}).sort()
      .filter(f => f <= limite && ((slots as any)[f] || []).length)
      .map(f => ({ fecha: f, horas: ((slots as any)[f] as string[]).slice(0, 4) }));
  }, [slots, rango]);

  const textoHorarios = porDiaDelRango.length
    ? `${primerNombre}, estos son los horarios disponibles para tu sesión consultiva (30-60 min, sin costo):\n\n`
      + porDiaDelRango.map(d => `${fechaHumana(d.fecha)}: ${d.horas.map(horaHumana).join(', ')}`).join('\n')
      + `\n\n¿Cuál te queda mejor? Con que me digas el día y la hora, yo la agendo.`
    : `${primerNombre}, ¿qué día te queda bien para tu sesión consultiva? La agendo y te llega la invitación.`;
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

  /* RUTA AUTOMÁTICA · el cliente toca un horario y queda agendado solo.
     Es la diferencia entre «te mando los horarios y me dices» —que obliga a
     alguien a volver a entrar— y que la reunión exista sin que nadie más
     intervenga. El correo NO es opcional: ahí le llega la invitación de
     calendario, y sin él tocaría un horario para nada. */
  const [ofertaMsg, setOfertaMsg] = useState('');
  const mandarOfertaTocable = async () => {
    setMsg(''); setOfertaMsg('');
    if (!emailValido) { setMsg('Escribe un correo válido: ahí le llega su invitación de calendario.'); return; }
    setOcupado(true);
    const r = await fetch('/api/crm/whatsapp/agenda-oferta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conv?.id || undefined, telefono: conv?.id ? undefined : telefono,
        dias: rango, email: email.trim(), nombre: nombre || primerNombre,
        empresa: empresa?.nombre_comercial || empresa?.nombre || undefined,
      }),
    }).then(x => x.json()).catch(e => ({ error: String(e) }));
    setOcupado(false);
    if (r?.error) { setMsg(r.error); return; }
    setOfertaMsg(`Le mandé ${(r.opciones || []).length} horarios.`);
    setHecho('oferta');
    refrescar?.();
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
      {hecho === 'oferta' && (
        <div style={{ border: `1px solid #A7F3D0`, background: C.emerald50, borderRadius: 10, padding: '8px 11px', fontSize: 11, color: C.emerald700, marginBottom: 10, lineHeight: 1.5 }}>
          {ofertaMsg} Cuando toque uno, la reunión se agenda sola y le llega la confirmación por WhatsApp y correo. Aquí verás la línea en la conversación.
        </div>
      )}
      {(hecho === 'enviado_wa' || hecho === 'enviado_correo') && (
        <div style={{ border: `1px solid #A7F3D0`, background: C.emerald50, borderRadius: 10, padding: '8px 11px', fontSize: 11, color: C.emerald700, marginBottom: 10 }}>
          Horarios enviados {hecho === 'enviado_wa' ? 'por WhatsApp' : 'por correo'} ✓ — cuando elija, todo se confirma solo (correo + WhatsApp + secuencia).
        </div>
      )}
      {/* ══ LAS DOS RUTAS, DE FRENTE ═══════════════════════════════════════
          Antes esto era un formulario de reserva con «mándale los horarios»
          escondido en el pie. Pero cuando el cliente todavía no dijo cuándo
          puede —que es la mitad de las veces— reservar por él es adivinar.
          Se pregunta primero qué quieres hacer, y cada ruta enseña solo lo suyo. */}
      {!ruta && slots !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <button onClick={() => setRuta('auto')} disabled={!ventanaAbierta}
            title={!ventanaAbierta ? 'Ventana de 24 h cerrada: primero manda una plantilla desde el composer' : ''}
            style={{ ...btnP, minHeight: 46, textAlign: 'left', padding: '0 14px', ...(!ventanaAbierta ? { opacity: .45, cursor: 'not-allowed' } : {}) }}>
            Que elija y se agende solo
            <span style={{ display: 'block', fontSize: 10.5, fontWeight: 500, opacity: .85, marginTop: 2 }}>
              Toca un horario en WhatsApp y queda hecho
            </span>
          </button>
          <button onClick={() => setRuta('lista')}
            style={{ ...btnG, minHeight: 46, textAlign: 'left', padding: '0 14px' }}>
            Enviar lista de horarios
            <span style={{ display: 'block', fontSize: 10.5, fontWeight: 500, color: C.g500, marginTop: 2 }}>
              Él elige y tú la agendas después
            </span>
          </button>
          <button onClick={() => setRuta('reservar')}
            style={{ ...btnG, minHeight: 46, textAlign: 'left', padding: '0 14px' }}>
            Agendar reunión
            <span style={{ display: 'block', fontSize: 10.5, fontWeight: 500, color: C.g500, marginTop: 2 }}>
              Ya sabes el día y la hora
            </span>
          </button>
        </div>
      )}

      {/* ══ RUTA 0 · QUE SE AGENDE SOLO ═══════════════════════════════════
          Los mismos huecos de siempre, pero como lista tocable de WhatsApp:
          el cliente elige y la reunión existe. Nadie tiene que volver a entrar
          a capturarla, que es donde se perdían. */}
      {ruta === 'auto' && slots !== null && (
        <div style={{ marginTop: 4 }}>
          <span style={lbl}>Cuántos días ofrecerle</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {([[1, 'Solo hoy'], [3, 'Próximos 3 días'], [7, 'Próximos 7 días']] as const).map(([d, l]) => (
              <button key={d} onClick={() => setRango(d)} style={pill(rango === d)}>{l}</button>
            ))}
          </div>

          <span style={{ ...lbl, marginTop: 12 }}>Correo del cliente (ahí llega su invitación)</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@correo.com" style={inp} />

          <div style={{ border: `1px solid ${C.g200}`, borderRadius: 10, padding: '10px 12px', fontSize: 12, color: C.g700, lineHeight: 1.5, marginTop: 10 }}>
            Verá una lista con hasta 10 horarios —máximo dos por día, para que
            tenga de dónde escoger— y con tocar uno queda agendado. Se le manda
            la confirmación con fecha, hora, quién lo atiende y la liga de la
            reunión, por WhatsApp y por correo.
            {porDiaDelRango.length === 0 && (
              <span style={{ display: 'block', color: C.ambar700, marginTop: 6 }}>
                Ahora mismo no hay huecos en ese rango: prueba con más días.
              </span>
            )}
          </div>

          <button className="accv-grande" onClick={mandarOfertaTocable}
            disabled={ocupado || !emailValido || !porDiaDelRango.length}
            style={{ ...btnP, width: '100%', marginTop: 10, background: emailValido && porDiaDelRango.length ? C.moradoTinta : C.g300 }}>
            {ocupado ? 'Mandando…' : !emailValido ? 'Falta un correo válido' : 'Mandarle los horarios'}
          </button>
          <button onClick={() => setRuta(null)}
            style={{ ...btnG, marginTop: 8, width: '100%', color: C.g500 }}>Volver</button>
        </div>
      )}

      {/* ══ RUTA 1 · MANDAR LA LISTA ══════════════════════════════════════ */}
      {ruta === 'lista' && slots !== null && (
        <div style={{ marginTop: 4 }}>
          <span style={lbl}>Qué tanto abarcar</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {([[1, 'Solo hoy'], [3, 'Próximos 3 días'], [7, 'Próximos 7 días']] as const).map(([d, l]) => (
              <button key={d} onClick={() => setRango(d)} style={pill(rango === d)}>{l}</button>
            ))}
          </div>

          {/* Se enseña EL MENSAJE, no una promesa de mensaje: va a salir tal
              cual y con el nombre del cliente adentro. */}
          <span style={{ ...lbl, marginTop: 12 }}>Esto es lo que se manda</span>
          <div style={{ border: `1px solid ${C.g200}`, borderRadius: 10, padding: '10px 12px', fontSize: 12, color: C.g700, whiteSpace: 'pre-line', lineHeight: 1.5, maxHeight: 190, overflowY: 'auto' }}>
            {textoHorarios}
          </div>
          {!porDiaDelRango.length && (
            <div style={{ fontSize: 11, color: C.ambar700, marginTop: 6, lineHeight: 1.45 }}>
              No hay horarios libres en ese rango. Prueba con más días — o mándalo así y que él proponga.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={enviarFechasWA} disabled={!ventanaAbierta}
              style={{ ...btnP, flex: 1, ...(!ventanaAbierta ? { opacity: .45, cursor: 'not-allowed' } : {}) }}
              title={!ventanaAbierta ? 'Ventana de 24 h cerrada: usa el correo o una plantilla desde el composer' : ''}>
              Enviar por WhatsApp
            </button>
            <button onClick={enviarFechasCorreo}
              style={{ ...btnG, flex: 1, color: C.moradoTinta, ...(!(email.trim() || contacto?.email) ? { opacity: .45, cursor: 'not-allowed' } : {}) }}>
              Por correo
            </button>
          </div>
          <button onClick={() => setRuta(null)}
            style={{ ...btnG, marginTop: 8, width: '100%', color: C.g500 }}>Volver</button>
        </div>
      )}

      {slots === null && <p style={{ fontSize: 11, color: C.g400 }}>Cargando horarios disponibles…</p>}
      {ruta === 'reservar' && slots !== null && !dias.length && <p style={{ fontSize: 11, color: C.rojo700 }}>No hay horarios disponibles en los próximos 10 días — revisa la disponibilidad en Agenda.</p>}
      {ruta === 'reservar' && dias.length > 0 && <>
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

        {/* ── CONTEXTO PARA EL CONSULTOR ───────────────────────────────────
            Quien da la sesión casi nunca es quien la agendó. Antes llegaba a
            la videollamada con una invitación que solo decía el nombre y el
            correo, y los primeros diez minutos se iban en «cuéntame otra vez
            qué necesitas» — con el cliente repitiendo lo que ya había escrito.
            Esta nota se genera sola leyendo el hilo, se puede corregir, y
            viaja a la descripción del evento de Google junto con la liga a la
            conversación. El consultor abre su calendario y ya sabe todo. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 0' }}>
          <span style={{ ...lbl, margin: 0, flex: 1 }}>Contexto para quien da la sesión</span>
          {conv?.id && (
            <button onClick={generarNota} disabled={notaCargando}
              style={{ border: `1px solid #c9bcf7`, borderRadius: 8, padding: '3px 10px', background: '#fff',
                color: C.moradoTinta, fontSize: 11, fontWeight: 700, cursor: notaCargando ? 'default' : 'pointer',
                fontFamily: 'inherit', opacity: notaCargando ? .6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <IcoChispas size={11} /> {notaCargando ? 'Leyendo el hilo…' : nota ? 'Regenerar' : 'Generar con IA'}
            </button>
          )}
        </div>
        <textarea value={nota} onChange={e => setNota(e.target.value)} rows={nota ? 9 : 3}
          placeholder={conv?.id ? 'Se genera solo del hilo, o escríbelo tú. Va en la invitación del calendario.' : 'Qué necesita saber el consultor antes de la sesión. Va en la invitación del calendario.'}
          style={{ ...inp, minHeight: 64, resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit', whiteSpace: 'pre-wrap' }} />
        <p style={{ fontSize: 10.5, color: C.g400, margin: '4px 0 0', lineHeight: 1.45 }}>
          Esto se ve en el evento de Google Calendar, junto con la liga para abrir la conversación en el CRM.
          {notaMsg && <span style={{ color: C.rojo700 }}> · {notaMsg.slice(0, 160)}</span>}
        </p>

        <button className="accv-grande" style={{ ...btnP, width: '100%', marginTop: 10, background: fecha && hora && emailValido ? C.moradoTinta : C.g300 }} disabled={!fecha || !hora || !emailValido || ocupado} onClick={agendar}>
          {ocupado ? 'Agendando…' : !emailValido ? 'Falta un correo válido' : fecha && hora ? `Agendar ${fechaHumana(fecha)} · ${horaHumana(hora)}` : 'Elige día y horario'}
        </button>
        {/* El «¿prefieres que elija él?» que vivía aquí se fue arriba, a su
            propia ruta: escondido al pie de un formulario de reserva, había que
            bajar hasta el final y adivinar que existía. Ahora se pregunta antes
            de nada, y esta pantalla se dedica solo a reservar. */}
        <button onClick={() => setRuta(null)}
          style={{ ...btnG, marginTop: 10, width: '100%', color: C.g500 }}>Volver</button>
      </>}
      {msg && <p style={{ fontSize: 11, color: C.rojo700, margin: '8px 0 0' }}>{msg}</p>}
    </div>
  );
}

/** Resumen de la relación: es una ACCIÓN —se genera a petición y cuesta—,
 *  no algo que ya pasó. Vivía en la pestaña «Actividad», entre hechos del
 *  pasado, siendo la única tarjeta de ahí con un botón que hace trabajo. */
const fechaRes = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function ResumenRelacion({ contactId, inicial, inicialAt }: { contactId: string; inicial?: string | null; inicialAt?: string | null }) {
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
            {cargando ? 'Leyendo todo el historial…' : at ? `Generado ${fechaRes(at)}` : 'Dos años de historia en 30 segundos'}
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
