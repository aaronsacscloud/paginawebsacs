// Cobranza: solo lo que está pendiente de cobro.
//
// Es una pantalla de TRABAJO, no de análisis: se abre para cobrar, así que cada
// fila trae con qué hacerlo y la lista viene ordenada por días de atraso —lo más
// viejo primero, que es lo que menos se cobra solo.
//
// Anuales y mensuales van separadas porque se cobran distinto: la anual pone en
// juego la renovación completa; en la mensual lo que importa no es el monto sino
// cuántos meses lleva sin pagar.
import { useEffect, useState } from 'react';
import ClienteDrawer360 from './ClienteDrawer360';

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '—';
const fmtCorta = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '') : '—';
const iso = (d: Date) => d.toISOString().slice(0, 10);

const GESTION: Record<string, { l: string; bg: string; fg: string }> = {
  sin_contactar: { l: 'sin contactar', bg: '#f4f4f6', fg: '#6B7280' },
  contactado: { l: 'contactado', bg: '#E3EDFD', fg: '#2C5FC4' },
  promesa: { l: 'promesa de pago', bg: '#EEECFE', fg: '#5B4BD6' },
  negociando: { l: 'negociando', bg: '#FEF6E7', fg: '#9a6a10' },
  plan_pagos: { l: 'en parcialidades', bg: '#EEECFE', fg: '#5B4BD6' },
  incobrable: { l: 'incobrable', bg: '#FEF0EF', fg: '#C0554E' },
};
const SENAL: Record<string, { l: string; bg: string; fg: string }> = {
  vendiendo: { l: 'vendiendo hoy', bg: '#EAF8F2', fg: '#1E8A63' },
  tibia: { l: 'poca venta', bg: '#FEF6E7', fg: '#9a6a10' },
  'sin vender': { l: 'sin vender', bg: '#FEF0EF', fg: '#C0554E' },
};

const S = {
  wrap: { maxWidth: 1280, margin: '0 auto', padding: 24 } as const,
  card: { background: '#fff', border: '1px solid #eeeef1', borderRadius: 12, padding: '16px 18px', marginBottom: 14 } as const,
  kl: { fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase' as const, letterSpacing: '.06em' } as const,
  kv: { fontSize: '1.65rem', fontWeight: 800, marginTop: 5, letterSpacing: '-.02em', lineHeight: 1 } as const,
  ks: { fontSize: '0.69rem', color: '#8a8a8a', marginTop: 5, lineHeight: 1.4 } as const,
  h: { fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.9px', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 } as const,
  hr: { marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 500, textTransform: 'none' as const, letterSpacing: 0, color: '#a5a2af' } as const,
  hd: { fontSize: '0.72rem', color: '#8a8a8a', marginBottom: 12 } as const,
  th: { fontSize: '0.55rem', fontWeight: 800, color: '#b3b1bb', textTransform: 'uppercase' as const, letterSpacing: '.07em', textAlign: 'left' as const, padding: '7px 8px', borderBottom: '1px solid #f0eff3' } as const,
  td: { padding: '10px 8px', fontSize: '0.78rem', borderBottom: '1px solid #f7f6fa', verticalAlign: 'middle' as const } as const,
  mini: { border: '1px solid #e2e4e9', borderRadius: 7, padding: '4px 9px', fontSize: '0.68rem', fontWeight: 700, color: '#555', background: '#fff', whiteSpace: 'nowrap' as const, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' } as const,
  mp: { border: 'none', background: '#9B8CFA', color: '#fff' } as const,
  mv: { borderColor: '#cdeadd', color: '#1E8A63', background: '#EAF8F2' } as const,
  tag: (bg: string, fg: string) => ({ fontSize: '0.56rem', fontWeight: 800, background: bg, color: fg, borderRadius: 20, padding: '2px 7px', whiteSpace: 'nowrap' as const }) as const,
  btnP: { border: 'none', borderRadius: 9, padding: '8px 15px', background: '#9B8CFA', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as const,
  fi: { border: '1.5px solid #e4dffb', borderRadius: 9, padding: '8px 11px', fontSize: '0.78rem', background: '#fdfcff', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit' } as const,
  fl: { fontSize: '0.62rem', fontWeight: 800, color: '#7a7684', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 4 } as const,
};
const seg = (on: boolean) => ({
  border: 'none', cursor: 'pointer', padding: '6px 13px', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'inherit',
  background: on ? 'rgba(244,168,205,.34)' : 'transparent', color: on ? '#9c3d70' : '#8a8a92',
}) as const;

export default function CobranzaTab() {
  const [d, setD] = useState<any>(null);
  const [vista, setVista] = useState<'vencidas' | 'plan' | 'porvencer'>('vencidas');
  const [abierta, setAbierta] = useState<string | null>(null);   // fila con el plan desplegado
  const [gestion, setGestion] = useState<any>(null);
  const [partir, setPartir] = useState<any>(null);
  const [cliente, setCliente] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const cargar = () => fetch('/api/crm/cobranza').then(r => r.json()).then(setD).catch(() => setD({ error: true }));
  useEffect(() => { cargar(); }, []);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 2400); };

  if (!d) return <div style={{ ...S.wrap, color: '#999', fontSize: '0.85rem' }}>Cargando cobranza…</div>;
  if (d.error) return <div style={{ ...S.wrap, color: '#C0554E', fontSize: '0.85rem' }}>No se pudo cargar la cobranza.</div>;

  const k = d.kpis;

  const Fila = ({ f, mensual }: any) => {
    const g = GESTION[f.gestion] || GESTION.sin_contactar;
    const se = f.senal ? SENAL[f.senal] : null;
    const abierto = abierta === f.id;
    return (
      <>
        <tr>
          <td style={S.td}>
            <div style={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => setCliente(f.company_id)}>{f.cliente}</div>
            {f.cuenta && <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>{f.cuenta}</div>}
          </td>
          <td style={S.td}>{f.plan}</td>
          <td style={S.td}>{fmtDate(f.vence)}</td>
          <td style={{ ...S.td, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: f.dias > 90 ? '#C0554E' : f.dias > 7 ? '#9a6a10' : '#5B4BD6' }}>{f.dias}</td>
          <td style={S.td}>
            <b style={{ color: f.dias > 90 ? '#C0554E' : '#1a1a1a' }}>{money(f.deuda)}</b>
            {f.detalle && <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>{f.detalle}</div>}
            {!f.detalle && f.pagado > 0 && <div style={{ fontSize: '0.67rem', color: '#a5a2af' }}>lleva {money(f.pagado)} pagados</div>}
          </td>
          <td style={S.td}>
            <span style={S.tag(g.bg, g.fg)}>{g.l}</span>
            {f.promesa && <div style={{ fontSize: '0.65rem', color: String(f.promesa) < iso(new Date()) ? '#C0554E' : '#5B4BD6', marginTop: 3 }}>promete el {fmtCorta(f.promesa)}</div>}
          </td>
          <td style={S.td}>{se ? <span style={S.tag(se.bg, se.fg)}>{se.l}</span> : <span style={{ color: '#c9c7d0' }}>—</span>}</td>
          <td style={S.td}>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <button style={{ ...S.mini, ...S.mp }} onClick={() => setGestion({ ...f, modo: 'pago' })}>Registrar pago</button>
              {f.plan_pagos.length > 0
                ? <button style={S.mini} onClick={() => setAbierta(abierto ? null : f.id)}>{abierto ? 'Ocultar plan' : 'Ver plan'}</button>
                : !mensual && <button style={S.mini} onClick={() => setPartir(f)}>Partir en pagos</button>}
              {f.link && <a style={{ ...S.mini, ...S.mv }} href={f.link} target="_blank" rel="noreferrer">Link de cobro</a>}
              <button style={S.mini} onClick={() => setGestion({ ...f, modo: 'gestion' })}>Gestión</button>
            </div>
          </td>
        </tr>
        {abierto && f.plan_pagos.length > 0 && (
          <tr>
            <td colSpan={8} style={{ background: '#faf8ff', borderTop: '1px solid #ece7fa', padding: '11px 14px' }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#5B4BD6', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Plan de pagos · {money(f.plan_pagos.reduce((a: number, x: any) => a + x.monto, 0))} en {f.plan_pagos.length} exhibiciones
              </div>
              {f.plan_pagos.map((x: any) => {
                const venc = x.estado === 'pendiente' && String(x.fecha) < iso(new Date());
                return (
                  <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: '0.76rem', borderTop: '1px solid #ece7fa' }}>
                    <span style={{ width: 74, fontWeight: 700 }}>{x.numero} de {x.total}</span>
                    <span style={{ width: 92, color: '#6b6b74' }}>{fmtDate(x.fecha)}</span>
                    <span style={{ width: 84, fontWeight: 800 }}>{money(x.monto)}</span>
                    <span style={{ width: 130 }}>
                      {x.estado === 'pagada'
                        ? <span style={S.tag('#EAF8F2', '#1E8A63')}>pagada</span>
                        : venc ? <span style={S.tag('#FEF0EF', '#C0554E')}>vencida</span>
                          : <span style={S.tag('#f4f4f6', '#6B7280')}>por vencer</span>}
                    </span>
                    {x.estado === 'pendiente' && (
                      <button style={{ ...S.mini, ...S.mp, marginLeft: 'auto' }}
                        onClick={() => setGestion({ ...f, modo: 'pago', exhibicion: x })}>Cobrar esta</button>
                    )}
                  </div>
                );
              })}
            </td>
          </tr>
        )}
      </>
    );
  };

  const Tabla = ({ filas, mensual }: any) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...S.th, minWidth: 150 }}>Cliente</th>
            <th style={{ ...S.th, minWidth: 140 }}>Plan</th>
            <th style={{ ...S.th, width: 110 }}>Venció</th>
            <th style={{ ...S.th, width: 50 }}>Días</th>
            <th style={{ ...S.th, width: 120 }}>Debe</th>
            <th style={{ ...S.th, width: 110 }}>Gestión</th>
            <th style={{ ...S.th, width: 100 }}>Señal</th>
            <th style={{ ...S.th, minWidth: 230 }} />
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && <tr><td style={{ ...S.td, color: '#c9c7d0' }} colSpan={8}>Nada por cobrar aquí.</td></tr>}
          {filas.map((f: any) => <Fila key={f.id} f={f} mensual={mensual} />)}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={S.wrap}>
      <style>{`
        .cob-5 { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:12px; }
        .cob-4 { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:10px; }
        @media (max-width: 1100px) { .cob-5, .cob-4 { grid-template-columns:repeat(2, minmax(0,1fr)); } }
        @media (max-width: 620px)  { .cob-5, .cob-4 { grid-template-columns:1fr; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Cobranza</h2>
          <div style={{ fontSize: '0.75rem', color: '#8a8a8a', marginTop: 2 }}>Solo lo pendiente de cobro: a quién, desde cuándo y con qué</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', border: '1px solid #efe7f1', borderRadius: 20, overflow: 'hidden', background: '#fff' }}>
            {([['vencidas', 'Vencidas'], ['plan', 'En parcialidades'], ['porvencer', 'Por vencer']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setVista(v)} style={seg(vista === v)}>{l}</button>
            ))}
          </span>
        </div>
      </div>

      {msg && <div style={{ background: '#EAF8F2', color: '#1E8A63', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.8rem', fontWeight: 700 }}>{msg}</div>}

      <div className="cob-5" style={{ marginBottom: 14 }}>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={S.kl}>Por cobrar hoy</div><div style={{ ...S.kv, color: '#C0554E' }}>{money(k.por_cobrar)}</div>
          <div style={S.ks}>{k.cuentas} suscripciones vencidas</div>
        </div>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={S.kl}>Atraso promedio</div><div style={S.kv}>{k.atraso_prom} <span style={{ fontSize: '0.8rem', color: '#b3afbd', fontWeight: 600 }}>días</span></div>
          <div style={S.ks}>la más vieja: {k.atraso_max} días</div>
        </div>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={S.kl}>En parcialidades</div><div style={{ ...S.kv, color: '#5B4BD6' }}>{money(k.en_parcialidades)}</div>
          <div style={S.ks}>{k.planes} planes · {k.exhibiciones_pendientes} pagos por vencer</div>
        </div>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={S.kl}>Recuperado este mes</div><div style={{ ...S.kv, color: '#1E8A63' }}>{money(k.recuperado)}</div>
          <div style={S.ks}>lo cobrado desde el día 1</div>
        </div>
        <div style={{ ...S.card, marginBottom: 0 }}>
          <div style={S.kl}>Promesas de pago</div><div style={{ ...S.kv, color: '#9a6a10' }}>{k.promesas}</div>
          <div style={S.ks}>{money(k.promesas_monto)} comprometidos</div>
        </div>
      </div>

      {/* Los tramos son el lenguaje de la cobranza: a 7 días se cobra con un
          recordatorio; a 90 ya es una negociación. */}
      <div className="cob-4" style={{ marginBottom: 14 }}>
        {d.tramos.map((t: any, i: number) => {
          const col = i === 0 ? ['#FEF0EF', '#f7c9c5', '#C0554E'] : i === 1 ? ['#fff6f5', '#f7d9d6', '#C0554E'] : i === 2 ? ['#FEF6E7', '#f5e2b8', '#9a6a10'] : ['#EEECFE', '#ddd6fb', '#5B4BD6'];
          return (
            <div key={t.k} style={{ background: col[0], border: `1px solid ${col[1]}`, borderRadius: 10, padding: '10px 13px' }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 800, color: col[2], textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.k}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: col[2], marginTop: 3 }}>{money(t.monto)}</div>
              <div style={{ fontSize: '0.64rem', color: col[2], marginTop: 1 }}>{t.n} {t.n === 1 ? 'cuenta' : 'cuentas'}</div>
            </div>
          );
        })}
      </div>

      {vista === 'vencidas' && (<>
        <div style={S.card}>
          <div style={S.h}>Anuales<span style={S.hr}>{d.anuales.length} vencidas</span></div>
          <div style={S.hd}>Un solo cobro grande al año. Si el cliente no puede de golpe, se parte en exhibiciones desde aquí.</div>
          <Tabla filas={d.anuales} />
        </div>
        <div style={S.card}>
          <div style={S.h}>Mensuales<span style={S.hr}>{d.mensuales.length} vencidas</span></div>
          <div style={S.hd}>Aquí la deuda se acumula mes con mes: lo que importa no es el precio del plan, es cuántos meses lleva sin pagar.</div>
          <Tabla filas={d.mensuales} mensual />
        </div>
      </>)}

      {vista === 'plan' && (
        <div style={S.card}>
          <div style={S.h}>Planes de pago vivos<span style={S.hr}>{d.con_plan.length}</span></div>
          <div style={S.hd}>Anualidades que se están cobrando en exhibiciones. Cada una vence sola y se cobra sola.</div>
          <Tabla filas={d.con_plan} />
        </div>
      )}

      {vista === 'porvencer' && (
        <div style={S.card}>
          <div style={S.h}>Por vencer<span style={S.hr}>próximos 30 días · {d.por_vencer.length}</span></div>
          <div style={S.hd}>Todavía no deben nada. Cobrar antes del vencimiento es lo más barato que existe.</div>
          <Tabla filas={d.por_vencer} />
        </div>
      )}

      {gestion && <Gestion f={gestion} onCerrar={() => setGestion(null)} onListo={(t: string) => { setGestion(null); flash(t); cargar(); }} />}
      {partir && <PartirEnPagos f={partir} onCerrar={() => setPartir(null)} onListo={() => { setPartir(null); flash('Plan de pagos creado'); cargar(); }} />}
      {cliente && <ClienteDrawer360 companyId={cliente} onClose={() => setCliente(null)} onChanged={cargar} />}
    </div>
  );
}

/* Registrar el pago o dejar constancia de la gestión.
 * La promesa CON FECHA es lo que convierte una lista en una agenda: el día que
 * vence, la cuenta vuelve a subir sola. */
function Gestion({ f, onCerrar, onListo }: any) {
  const esPago = f.modo === 'pago';
  const [monto, setMonto] = useState(String(f.exhibicion?.monto ?? f.deuda));
  const [fecha, setFecha] = useState(iso(new Date()));
  const [metodo, setMetodo] = useState('transferencia');
  const [referencia, setReferencia] = useState('');
  const [estado, setEstado] = useState(f.gestion === 'plan_pagos' ? 'contactado' : f.gestion);
  const [promesa, setPromesa] = useState(f.promesa || '');
  const [nota, setNota] = useState(f.nota || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function guardar() {
    setBusy(true); setError('');
    if (esPago) {
      // El mismo endpoint que usa Suscripciones: recalcula la próxima factura,
      // el ARR y deja el comprobante. Duplicar esa lógica aquí sería la forma
      // segura de que un día los dos caminos dejen de coincidir.
      const r = await fetch('/api/crm/arr/register-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: f.id, company_id: f.company_id, monto: Number(monto), fecha, metodo, referencia }),
      }).then(x => x.json()).catch(() => null);
      if (!r || r.error) { setBusy(false); setError(r?.error || 'No se pudo registrar el pago.'); return; }
      if (f.exhibicion) {
        await fetch('/api/crm/cobranza', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exhibicion_id: f.exhibicion.id, pago_id: r.payment_id || r.payment?.id || null }),
        }).catch(() => {});
      }
      setBusy(false); onListo('Pago registrado'); return;
    }
    await fetch('/api/crm/cobranza', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_id: f.id, estado, promesa: estado === 'promesa' ? promesa : null, nota }),
    }).catch(() => {});
    setBusy(false); onListo('Gestión guardada');
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 962, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 420 }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>{esPago ? 'Registrar pago' : 'Gestión de cobranza'}</h3>
          <span style={{ fontSize: '0.72rem', color: '#7a6fc9' }}>{f.cliente}</span>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '14px 17px 17px' }}>
          {esPago ? (<>
            {f.exhibicion && (
              <div style={{ background: '#EEECFE', borderRadius: 9, padding: '8px 11px', fontSize: '0.75rem', color: '#5B4BD6', marginBottom: 11, fontWeight: 700 }}>
                Exhibición {f.exhibicion.numero} de {f.exhibicion.total} · vencía el {fmtDate(f.exhibicion.fecha)}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              <div><div style={S.fl}>Monto</div><input style={S.fi} type="number" value={monto} onChange={e => setMonto(e.target.value)} /></div>
              <div><div style={S.fl}>Fecha</div><input style={S.fi} type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            </div>
            <div style={{ marginTop: 9 }}><div style={S.fl}>Cómo pagó</div>
              <select style={S.fi} value={metodo} onChange={e => setMetodo(e.target.value)}>
                {['transferencia', 'efectivo', 'tarjeta', 'oxxo', 'mercadopago', 'stripe', 'otro'].map(m => <option key={m} value={m}>{m}</option>)}
              </select></div>
            <div style={{ marginTop: 9 }}><div style={S.fl}>Referencia</div>
              <input style={S.fi} value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="folio, últimos 4 dígitos…" /></div>
          </>) : (<>
            <div style={S.fl}>En qué va</div>
            <select style={S.fi} value={estado} onChange={e => setEstado(e.target.value)}>
              {Object.entries(GESTION).filter(([k]) => k !== 'plan_pagos').map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
            </select>
            {estado === 'promesa' && (
              <div style={{ marginTop: 9 }}>
                <div style={S.fl}>¿Qué día paga?</div>
                <input style={S.fi} type="date" value={String(promesa).slice(0, 10)} onChange={e => setPromesa(e.target.value)} />
                <div style={{ fontSize: '0.68rem', color: '#a5a2af', marginTop: 4 }}>Ese día la cuenta vuelve a subir en la lista.</div>
              </div>
            )}
            <div style={{ marginTop: 9 }}><div style={S.fl}>Qué dijo</div>
              <textarea style={{ ...S.fi, resize: 'vertical' }} rows={3} value={nota} onChange={e => setNota(e.target.value)} placeholder="Pidió factura antes de pagar…" /></div>
          </>)}
          {error && <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', color: '#C0554E', marginTop: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 13 }}>
            <button style={{ ...S.btnP, opacity: busy ? .6 : 1 }} disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : esPago ? 'Registrar pago' : 'Guardar'}</button>
            <button style={{ ...S.mini, padding: '8px 14px' }} onClick={onCerrar}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Partir una anualidad en exhibiciones. */
function PartirEnPagos({ f, onCerrar, onListo }: any) {
  const [n, setN] = useState(3);
  const [primera, setPrimera] = useState(iso(new Date()));
  const [cada, setCada] = useState<'mes' | 'quincena'>('mes');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const base = Math.floor(f.deuda / n);
  const prev = Array.from({ length: n }, (_, i) => {
    const d = new Date(primera + 'T12:00:00');
    d.setDate(d.getDate() + (cada === 'mes' ? 30 : 15) * i);
    return { fecha: iso(d), monto: i === 0 ? f.deuda - base * (n - 1) : base };
  });

  async function crear() {
    setBusy(true); setError('');
    const r = await fetch('/api/crm/cobranza', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_id: f.id, exhibiciones: n, primera, cada, total: f.deuda }),
    }).then(x => x.json()).catch(() => null);
    setBusy(false);
    if (!r || r.error) { setError(r?.error || 'No se pudo crear el plan.'); return; }
    onListo();
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 962, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 420, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', display: 'flex', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, flex: 1 }}>Partir en exhibiciones</h3>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>
        <div style={{ padding: '14px 17px 17px' }}>
          <div style={{ fontSize: '0.78rem', color: '#6b6b74', marginBottom: 12 }}>
            <b>{f.cliente}</b> · {f.plan}<br />Se debe <b>{money(f.deuda)}</b>, vencido hace {f.dias} días.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <div><div style={S.fl}>Exhibiciones</div>
              <select style={S.fi} value={n} onChange={e => setN(Number(e.target.value))}>
                {[2, 3, 4, 5, 6, 8, 10, 12].map(x => <option key={x} value={x}>{x}</option>)}
              </select></div>
            <div><div style={S.fl}>Primera el</div><input style={S.fi} type="date" value={primera} onChange={e => setPrimera(e.target.value)} /></div>
          </div>
          <div style={{ marginTop: 9 }}><div style={S.fl}>Cada</div>
            <select style={S.fi} value={cada} onChange={e => setCada(e.target.value as any)}>
              <option value="mes">Mes</option><option value="quincena">Quincena</option>
            </select></div>

          <div style={{ background: '#faf8ff', border: '1px solid #ece7fa', borderRadius: 10, padding: '10px 12px', margin: '12px 0' }}>
            {prev.map((x, i) => (
              <div key={i} style={{ display: 'flex', fontSize: '0.75rem', padding: '3px 0' }}>
                <span>{i + 1} · {fmtDate(x.fecha)}</span><b style={{ marginLeft: 'auto' }}>{money(x.monto)}</b>
              </div>
            ))}
            <div style={{ display: 'flex', fontSize: '0.78rem', borderTop: '1px solid #ece7fa', marginTop: 4, paddingTop: 6, color: '#5B4BD6', fontWeight: 800 }}>
              <span>Total</span><b style={{ marginLeft: 'auto' }}>{money(f.deuda)}</b>
            </div>
          </div>

          <div style={{ fontSize: '0.68rem', color: '#a5a2af', lineHeight: 1.45, marginBottom: 11 }}>
            La renovación no se mueve: sigue venciendo en su fecha. Esto solo parte cómo se cobra lo de este periodo.
          </div>
          {error && <div style={{ background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', color: '#C0554E', marginBottom: 10 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...S.btnP, opacity: busy ? .6 : 1 }} disabled={busy} onClick={crear}>{busy ? 'Creando…' : 'Crear plan'}</button>
            <button style={{ ...S.mini, padding: '8px 14px' }} onClick={onCerrar}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
