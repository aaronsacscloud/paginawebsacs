// La ficha a un lado del chat de lo que alguien citó con @: cotización, cliente,
// lead, pago o cobranza. Para los tres primeros se monta LA MISMA ficha que ya
// usa el CRM (ClienteDrawer360, LeadDrawer, CotizacionActividad) en modo
// embebido; pago y cobranza no tienen pantalla propia en el CRM y se arma aquí
// con lo que devuelve /espacio/menciones?ficha=.
import { lazy, Suspense, useEffect, useState } from 'react';
import { api, type Cita } from './api';
import { Ic, CITA_ETIQ } from './ui';
import Cargando from '../ui/Cargando';

const ClienteDrawer360 = lazy(() => import('../ClienteDrawer360'));
const LeadDrawer = lazy(() => import('../LeadDrawer'));
const CotizacionActividad = lazy(() => import('../CotizacionActividad'));

const money = (n: any) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fecha = (s?: string | null) => s ? new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const METODO: Record<string, string> = { mercadopago: 'Mercado Pago', transferencia: 'Transferencia', tarjeta: 'Tarjeta', stripe: 'Stripe', efectivo: 'Efectivo', oxxo: 'OXXO', otro: 'Otro' };
const ESTADO_SUB: Record<string, string> = { activa: 'Activa', pausada: 'Pausada', cancelada: 'Cancelada', vencida: 'Vencida', trial: 'Prueba' };
// Mismas palabras que la pestaña de Cobranza (CobranzaTab.GESTION / SENAL).
const GESTION: Record<string, string> = { sin_contactar: 'Sin contactar', contactado: 'Contactado', promesa: 'Promesa de pago', negociando: 'Negociando', plan_pagos: 'En parcialidades', incobrable: 'Incobrable' };
const SENAL: Record<string, string> = { vendiendo: 'Vendiendo hoy', tibia: 'Poca venta', 'sin vender': 'Sin vender' };
const ESTADO_COT: Record<string, string> = { sent: 'enviada', accepted: 'aceptada', paid: 'pagada', rejected: 'rechazada', expired: 'vencida', draft: 'borrador' };

/** A qué pestaña del CRM lleva "Abrir en el CRM" para cada tipo. */
function destinoCrm(c: Cita, extra?: { company_id?: string | null }): string {
  if (c.tipo === 'lead') return `pipeline?lead=${c.id}`;
  if (c.tipo === 'cliente') return `clientes?company=${c.id}`;
  if (c.tipo === 'cotizacion') return 'cotizaciones';
  if (c.tipo === 'pago') return extra?.company_id ? `clientes?company=${extra.company_id}&ct=subs` : 'pagos';
  return 'cobranza';
}

export default function Ficha({ cita, movil, onCerrar, onIr, onAbrirOtra }: {
  cita: Cita; movil: boolean; onCerrar: () => void; onIr: (destino: string) => void; onAbrirOtra: (c: Cita) => void;
}) {
  const [f, setF] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const propia = cita.tipo === 'pago' || cita.tipo === 'cobranza';
  useEffect(() => {
    setF(null); setErr(null);
    if (!propia) return;
    let vivo = true;
    api.ficha(cita.tipo, cita.id).then(r => { if (vivo) setF(r.ficha); }).catch(e => { if (vivo) setErr(e?.message || 'No se pudo cargar'); });
    return () => { vivo = false; };
  }, [cita.tipo, cita.id, propia]);

  const compania = f?.cliente?.id || null;
  return (
    <>
      <div className="eq-cab">
        {movil && <button className="eq-ib" onClick={onCerrar} aria-label="Volver">{Ic.atras}</button>}
        <h2><span className={'eq-ficha-tipo ' + cita.tipo}>{CITA_ETIQ[cita.tipo] || cita.tipo}</span><span className="eq-ficha-nombre">{cita.nombre || cita.id.slice(0, 8)}</span></h2>
        <button className="eq-btn" onClick={() => onIr(destinoCrm(cita, { company_id: compania }))} title="Ir a la pestaña del CRM">Abrir en el CRM</button>
        {!movil && <button className="eq-ib" onClick={onCerrar} aria-label="Cerrar">{Ic.cerrar}</button>}
      </div>
      <div className="eq-lista eq-ficha">
        {!propia && (
          <Suspense fallback={<Cargando texto="Cargando ficha…" alto={200} />}>
            {cita.tipo === 'cliente' && <ClienteDrawer360 key={cita.id} companyId={cita.id} onClose={onCerrar} onChanged={() => null} embebido />}
            {cita.tipo === 'lead' && <LeadDrawer key={cita.id} contactId={cita.id} onClose={onCerrar} onChanged={() => null} embebido onAbrirOtro={(id: string) => onAbrirOtra({ tipo: 'lead', id, nombre: '' })} />}
            {cita.tipo === 'cotizacion' && (
              <>
                <div className="eq-ficha-acciones"><a className="eq-btn" href={`/cotizacion/${cita.id}?admin=1`} target="_blank" rel="noreferrer">Ver documento</a></div>
                <CotizacionActividad key={cita.id} quoteId={cita.id} onClose={onCerrar} embebido />
              </>
            )}
          </Suspense>
        )}
        {propia && !f && !err && <Cargando texto={cita.tipo === 'pago' ? 'Cargando pago…' : 'Cargando cobranza…'} alto={200} />}
        {err && <div className="eq-vacio"><b>No se pudo cargar</b>{err}</div>}
        {f && f.tipo === 'pago' && <FichaPago f={f} onAbrirOtra={onAbrirOtra} />}
        {f && f.tipo === 'cobranza' && <FichaCobranza f={f} onAbrirOtra={onAbrirOtra} />}
      </div>
    </>
  );
}

function Dato({ k, v, tinta }: { k: string; v: any; tinta?: string }) {
  if (v === null || v === undefined || v === '') return null;
  return <div className="eq-dato"><small>{k}</small><span style={tinta ? { color: tinta, fontWeight: 800 } : undefined}>{v}</span></div>;
}

function FichaPago({ f, onAbrirOtra }: { f: any; onAbrirOtra: (c: Cita) => void }) {
  const p = f.pago, co = f.cliente, cot = f.cotizacion, sub = f.suscripcion;
  const dup = p.estado === 'duplicado';
  return (
    <>
      <div className={'eq-ficha-cifra' + (dup || p.reembolsado ? ' mal' : '')}>
        <small>{dup ? 'Pago duplicado' : p.reembolsado ? 'Pago reembolsado' : 'Pago confirmado'}</small>
        <b>{money(p.monto)}</b>
        <span>{fecha(p.fecha)} · {METODO[p.metodo] || p.metodo || 'sin método'}</span>
      </div>
      <div className="eq-datos">
        <Dato k="Referencia" v={p.referencia} />
        <Dato k="Acuse" v={p.numero_acuse} />
        <Dato k="Periodo cubierto" v={p.periodo_cubierto} />
        <Dato k="Pasarela" v={p.pasarela} />
        {p.comision != null && Number(p.comision) > 0 && <Dato k="Comisión" v={money(p.comision)} />}
        {p.neto != null && Number(p.neto) > 0 && <Dato k="Neto" v={money(p.neto)} />}
        <Dato k="Notas" v={p.notas} />
        <Dato k="Registrado" v={fecha(p.created_at)} />
      </div>
      {co && (
        <button className="eq-ficha-liga" onClick={() => onAbrirOtra({ tipo: 'cliente', id: co.id, nombre: co.nombre_comercial || co.nombre })}>
          <small>Cliente</small><b>{co.nombre_comercial || co.nombre}</b><span>{[co.sacs_account, co.plan].filter(Boolean).join(' · ')}</span>
        </button>
      )}
      {cot && (
        <button className="eq-ficha-liga" onClick={() => onAbrirOtra({ tipo: 'cotizacion', id: cot.id, nombre: `${cot.numero || ''} ${cot.empresa || ''}`.trim() })}>
          <small>Cotización</small><b>{cot.numero} · {cot.empresa}</b><span>{money(cot.total)} · {ESTADO_COT[cot.estado] || cot.estado}</span>
        </button>
      )}
      {sub && (
        <div className="eq-ficha-liga quieto">
          <small>Suscripción</small><b>{sub.nombre_plan}</b><span>{money(sub.precio)} {sub.ciclo} · {ESTADO_SUB[sub.estado] || sub.estado} · próxima {fecha(sub.proxima_factura)}</span>
        </div>
      )}
      <div className="eq-ficha-acciones">
        <a className="eq-btn" href={`/acuse/${p.id}`} target="_blank" rel="noreferrer">Ver acuse</a>
        {p.comprobante_url && <a className="eq-btn" href={p.comprobante_url} target="_blank" rel="noreferrer">Comprobante</a>}
      </div>
    </>
  );
}

function FichaCobranza({ f, onAbrirOtra }: { f: any; onAbrirOtra: (c: Cita) => void }) {
  const r = f.fila, s = f.suscripcion, co = f.cliente;
  if (!r) {
    // Ya no está en el tablero: se pagó, se pausó o se canceló.
    return (
      <>
        <div className="eq-ficha-cifra bien">
          <small>Ya no está en cobranza</small>
          <b>{ESTADO_SUB[s.estado] || s.estado}</b>
          <span>{s.nombre_plan} · {money(s.precio)} {s.ciclo} · próxima {fecha(s.proxima_factura)}</span>
        </div>
        <div className="eq-datos">
          <Dato k="Pagos realizados" v={s.pagos_realizados} />
          <Dato k="Total pagado" v={money(s.total_pagado)} />
          <Dato k="Gestión" v={s.cobranza_estado ? GESTION[s.cobranza_estado] || s.cobranza_estado : null} />
          <Dato k="Promesa" v={s.cobranza_promesa ? fecha(s.cobranza_promesa) : null} />
          <Dato k="Nota" v={s.cobranza_nota} />
        </div>
        {co && <button className="eq-ficha-liga" onClick={() => onAbrirOtra({ tipo: 'cliente', id: co.id, nombre: co.nombre_comercial || co.nombre })}><small>Cliente</small><b>{co.nombre_comercial || co.nombre}</b><span>{co.sacs_account}</span></button>}
      </>
    );
  }
  const vencido = Number(r.dias) > 0;
  return (
    <>
      <div className={'eq-ficha-cifra' + (vencido ? ' mal' : ' aviso')}>
        <small>{vencido ? `${r.dias} ${r.dias === 1 ? 'día' : 'días'} de atraso` : r.dias === 0 ? 'Vence hoy' : `Vence en ${-r.dias} ${r.dias === -1 ? 'día' : 'días'}`}</small>
        <b>{money(r.deuda)}</b>
        <span>{r.plan} · {r.ciclo} · vence {fecha(r.vence)}</span>
      </div>
      <div className="eq-datos">
        <Dato k="Detalle" v={r.detalle} />
        <Dato k="Precio" v={money(r.precio)} />
        <Dato k="Pagado" v={r.pagado != null ? money(r.pagado) : null} />
        <Dato k="Pagos" v={r.pagos} />
        <Dato k="Gestión" v={r.gestion ? GESTION[r.gestion] || r.gestion : null} />
        <Dato k="Promesa" v={r.promesa ? fecha(r.promesa) : null} />
        <Dato k="Señal" v={r.senal ? SENAL[r.senal] || r.senal : null} />
        <Dato k="Nota" v={r.nota} />
        {r.plan_pagos && <Dato k="Plan de pagos" v="Sí" />}
      </div>
      {co?.id && <button className="eq-ficha-liga" onClick={() => onAbrirOtra({ tipo: 'cliente', id: co.id, nombre: co.nombre })}><small>Cliente</small><b>{co.nombre}</b><span>{co.sacs_account}</span></button>}
      {r.link && <div className="eq-ficha-acciones"><a className="eq-btn" href={r.link} target="_blank" rel="noreferrer">Link de pago</a></div>}
    </>
  );
}
