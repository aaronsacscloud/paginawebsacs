import { useEffect, useState } from 'react';
import { S } from './SubscriptionsTab';
import { confirmar } from '../../../lib/ui/confirmar';

/* ═══ Vincular las suscripciones que ya viven en Mercado Pago ═══
 * NO se vinculan solas: emparejar mal manda los cobros de un cliente a la
 * suscripción de otro, y eso se descubre semanas después cuando a uno le cobran
 * de más y al otro no. Se proponen candidatos con su razón y decide una persona. */

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const card = { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 16, marginBottom: 10 } as const;
const ESTADO: Record<string, { t: string; bg: string; c: string }> = {
  authorized: { t: 'cobrando', bg: 'rgba(42,181,160,.15)', c: '#1A8F7A' },
  paused: { t: 'pausada', bg: 'rgba(232,168,56,.18)', c: '#a06600' },
  pending: { t: 'pendiente', bg: 'rgba(232,168,56,.18)', c: '#a06600' },
  cancelled: { t: 'cancelada', bg: '#f3f4f6', c: '#9aa0a8' },
};

export default function VincularMercadoPago() {
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(false);
  const [todas, setTodas] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  // Alta abierta: { mp_id, company_id, nombre_plan }
  const [alta, setAlta] = useState<any>(null);

  async function cargar(t = todas) {
    setCargando(true);
    try { setD(await fetch('/api/crm/arr/mp-suscripciones' + (t ? '?todas=1' : '')).then(r => r.json())); }
    catch { setD({ error: 'No se pudo cargar' }); }
    setCargando(false);
  }
  useEffect(() => { cargar(false); }, []);

  async function vincular(mp: any, cand: any) {
    if (!await confirmar(`¿Vincular la suscripción de Mercado Pago "${mp.concepto}" (${money(mp.monto)}) con ${cand.cliente}?\n\nA partir de ahora sus cobros se van a registrar solos en esa suscripción.`)) return;
    setTrabajando(mp.mp_id);
    const j = await fetch('/api/crm/arr/mp-suscripciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_id: cand.subscription_id, mp_preapproval_id: mp.mp_id, payer_email: mp.correo_pagador }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo vincular' }));
    setTrabajando(null);
    if (j?.error) alert(j.error); else cargar();
  }

  /* Los empates de 100 puntos —correo idéntico— no merecen un clic cada uno.
     Solo entran esos: bajar el umbral aquí convertiría un atajo en una forma
     rápida de mandar los cobros de un cliente a la suscripción de otro. */
  const seguras = (d?.data || []).filter((m: any) => !m.vinculada && m.candidatos?.[0]?.puntos >= 100
    && (m.candidatos.length === 1 || m.candidatos[1].puntos < 100));

  async function vincularLote() {
    const lista = seguras.map((m: any) => ({
      subscription_id: m.candidatos[0].subscription_id, mp_preapproval_id: m.mp_id,
      payer_email: m.correo_pagador, cliente: m.candidatos[0].cliente,
    }));
    if (!await confirmar(`¿Vincular ${lista.length} suscripciones de un golpe?\n\n${lista.map((l: any) => '· ' + l.cliente).join('\n')}\n\nSolo van las que empatan por correo idéntico.`)) return;
    setTrabajando('lote');
    const j = await fetch('/api/crm/arr/mp-suscripciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lote: lista }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo' }));
    setTrabajando(null);
    if (j?.error) alert(j.error);
    else if (j.fallidas?.length) alert(`Se vincularon ${j.vinculadas}.\n\nNo se pudo con ${j.fallidas.length}:\n${j.fallidas.map((f: any) => '· ' + (f.cliente || f.mp_preapproval_id) + ': ' + f.error).join('\n')}`);
    cargar();
  }

  async function crear(mp: any, companyId: string, nombrePlan: string) {
    if (!companyId) { alert('Elige el cliente.'); return; }
    const cliente = (d?.empresas || []).find((e: any) => e.id === companyId)?.nombre || 'ese cliente';
    if (!await confirmar(`¿Dar de alta "${nombrePlan}" (${money(mp.monto)}/${mp.ciclo === 'anual' ? 'año' : 'mes'}) en ${cliente}?\n\nSe crea la suscripción con los datos de Mercado Pago y queda vinculada: sus cobros se van a registrar solos.`)) return;
    setTrabajando(mp.mp_id);
    const j = await fetch('/api/crm/arr/mp-suscripciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crear: true, company_id: companyId, mp_preapproval_id: mp.mp_id, nombre_plan: nombrePlan, payer_email: mp.correo_pagador }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo dar de alta' }));
    setTrabajando(null);
    if (j?.error) alert(j.error); else { setAlta(null); cargar(); }
  }

  async function desvincular(mp: any) {
    if (!await confirmar(`¿Separar esta suscripción de ${mp.vinculada.cliente}?\n\nSus próximos cobros dejarán de registrarse solos.`)) return;
    setTrabajando(mp.mp_id);
    await fetch('/api/crm/arr/mp-suscripciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription_id: mp.vinculada.subscription_id, desvincular: true }),
    }).catch(() => { });
    setTrabajando(null); cargar();
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>Suscripciones que ya cobras en Mercado Pago</div>
          <div style={{ fontSize: '0.79rem', color: '#8a8f98' }}>
            Vincúlalas con su cliente del CRM y sus cobros se registrarán solos, sin capturar nada.
          </div>
        </div>
        {seguras.length > 1 && (
          <button style={{ ...S.btnSmall, minHeight: 38, borderRadius: 50, background: '#4B7BE5', color: '#fff', border: 'none', fontWeight: 700 }}
            disabled={trabajando === 'lote'} onClick={vincularLote}>
            {trabajando === 'lote' ? '…' : `Vincular ${seguras.length} seguras`}
          </button>
        )}
        <button style={{ ...S.btnSmall, minHeight: 38 }} disabled={cargando} onClick={() => { const t = !todas; setTodas(t); cargar(t); }}>
          {todas ? 'Solo las activas' : 'Ver también canceladas'}
        </button>
        <button style={{ ...S.btnSmall, minHeight: 38 }} disabled={cargando} onClick={() => cargar()}>{cargando ? '…' : '↻ Actualizar'}</button>
      </div>

      {d?.error && <div style={{ ...card, background: '#fdecea', borderColor: '#f0c4bd', color: '#b93333', fontWeight: 600 }}>{d.error}</div>}

      {d?.data && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, fontSize: '0.78rem' }}>
          <span style={{ padding: '4px 11px', borderRadius: 99, background: '#e6f6f2', color: '#1A8F7A', fontWeight: 700 }}>{d.vinculadas} vinculadas</span>
          <span style={{ padding: '4px 11px', borderRadius: 99, background: '#fff5e6', color: '#a06600', fontWeight: 700 }}>{d.sin_vincular} sin vincular</span>
          {d.arr_no_capturado > 0 && (
            <span style={{ padding: '4px 11px', borderRadius: 99, background: 'rgba(229,75,75,.12)', color: '#E54B4B', fontWeight: 700 }}
              title="Anualizado de lo que Mercado Pago está cobrando hoy sin vincular a ninguna suscripción del CRM. Parte puede estar capturada y solo faltarle el vínculo; el resto no está en el ARR.">
              {money(d.arr_no_capturado)}/año cobrándose sin vincular
            </span>
          )}
          {d.modo === 'prueba' && (
            <span style={{ padding: '4px 11px', borderRadius: 99, background: 'rgba(232,168,56,.18)', color: '#a06600', fontWeight: 700 }}>
              ⚠️ estás en MODO PRUEBA: aquí no salen tus suscripciones reales
            </span>
          )}
        </div>
      )}

      {cargando && !d && <div style={{ padding: 24, color: '#999' }}>Consultando Mercado Pago…</div>}

      {(d?.data || []).map((mp: any) => {
        const e = ESTADO[mp.estado_mp] || { t: mp.estado_mp, bg: '#f3f4f6', c: '#666' };
        return (
          <div key={mp.mp_id} style={{ ...card, borderLeft: '4px solid ' + (mp.vinculada ? '#1A8F7A' : '#E8A838') }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 250 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: '0.92rem' }}>{mp.concepto || '(sin concepto)'}</b>
                  <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, background: e.bg, color: e.c }}>{e.t}</span>
                  <b style={{ fontSize: '0.88rem' }}>{money(mp.monto)}<span style={{ color: '#999', fontWeight: 400 }}>/{mp.ciclo === 'anual' ? 'año' : 'mes'}</span></b>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#8a8f98', marginTop: 4 }}>
                  {mp.correo_pagador ? <>paga <b style={{ color: '#555' }}>{mp.correo_pagador}</b> · </> : null}
                  {mp.cobros_hechos != null ? <>{mp.cobros_hechos} cobros · {money(mp.total_cobrado)} acumulado · </> : null}
                  {mp.proximo_cobro ? <>próximo {mp.proximo_cobro}</> : 'sin próximo cobro'}
                </div>
              </div>
              {mp.vinculada && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem' }}>→ <b>{mp.vinculada.cliente}</b>
                    <div style={{ fontSize: '0.72rem', color: '#999' }}>{mp.vinculada.nombre_plan}</div>
                  </div>
                  <button style={{ ...S.btnSmall, minHeight: 34, color: '#b93333', borderColor: '#f0c4bd' }}
                    disabled={trabajando === mp.mp_id} onClick={() => desvincular(mp)}>Separar</button>
                </div>
              )}
            </div>

            {!mp.vinculada && (
              <div style={{ marginTop: 10, borderTop: '1px solid #f4f4f4', paddingTop: 10 }}>
                {mp.candidatos?.length ? (
                  <>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 6 }}>¿Con cuál cliente es?</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {mp.candidatos.map((c: any) => (
                        <div key={c.subscription_id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#fafbfc', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <b style={{ fontSize: '0.83rem' }}>{c.cliente}</b>
                            <span style={{ fontSize: '0.76rem', color: '#777' }}> · {c.nombre_plan} · {money(c.precio)}/{c.ciclo === 'anual' ? 'año' : 'mes'}</span>
                            <div style={{ fontSize: '0.71rem', color: '#8a8f98' }}>{c.porque.join(' · ')}{c.correo ? ' · ' + c.correo : ''}</div>
                          </div>
                          <button style={{ ...S.btnSmall, minHeight: 34, background: c.puntos >= 100 ? '#1A8F7A' : '#fff', color: c.puntos >= 100 ? '#fff' : '#333', border: c.puntos >= 100 ? 'none' : '1px solid #ddd', fontWeight: 700 }}
                            disabled={trabajando === mp.mp_id} onClick={() => vincular(mp, c)}>Vincular</button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#a06600' }}>
                    No encontré una suscripción que se le parezca. Lo más probable es que se esté cobrando
                    algo que nunca se dio de alta en el CRM.
                  </div>
                )}

                {/* Cobrar algo que el CRM no tiene es ARR real que no se está
                    reportando. Sin esta salida, la única opción era vincularlo a
                    una suscripción equivocada o dejarlo fuera para siempre. */}
                {alta?.mp_id === mp.mp_id ? (
                  <div style={{ marginTop: 10, background: '#FAFAF8', border: '1px solid #ececec', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8C8C8C', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                      Dar de alta en el CRM
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <label style={{ flex: 1, minWidth: 200, fontSize: '0.75rem', color: '#4A4A4A' }}>Cliente
                        <select value={alta.company_id} onChange={e => setAlta({ ...alta, company_id: e.target.value })}
                          style={{ width: '100%', marginTop: 3, padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: '0.85rem', background: '#fff' }}>
                          <option value="">— elige el cliente —</option>
                          {(d?.empresas || []).map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                        </select>
                      </label>
                      <label style={{ flex: 1, minWidth: 200, fontSize: '0.75rem', color: '#4A4A4A' }}>Nombre del plan
                        <input value={alta.nombre_plan} onChange={e => setAlta({ ...alta, nombre_plan: e.target.value })}
                          style={{ width: '100%', marginTop: 3, padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: '0.85rem' }} />
                      </label>
                      <button style={{ ...S.btnSmall, minHeight: 38, background: '#4B7BE5', color: '#fff', border: 'none', fontWeight: 700, borderRadius: 50, padding: '10px 20px' }}
                        disabled={trabajando === mp.mp_id} onClick={() => crear(mp, alta.company_id, alta.nombre_plan)}>
                        {trabajando === mp.mp_id ? '…' : 'Dar de alta y vincular'}
                      </button>
                      <button style={{ ...S.btnSmall, minHeight: 38, borderRadius: 50 }} onClick={() => setAlta(null)}>Cancelar</button>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#8C8C8C', marginTop: 8 }}>
                      El monto ({money(mp.monto)}/{mp.ciclo === 'anual' ? 'año' : 'mes'}), el ciclo y la próxima
                      factura se toman de Mercado Pago, no de esta pantalla.
                      {mp.desde ? ` Se viene cobrando desde ${mp.desde}.` : ''}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    <button style={{ ...S.btnSmall, minHeight: 34, borderRadius: 50 }}
                      onClick={() => setAlta({ mp_id: mp.mp_id, company_id: mp.empresa_sugerida?.company_id || '', nombre_plan: mp.concepto || '' })}>
                      {mp.candidatos?.length ? 'No es ninguna · dar de alta en el CRM' : 'Dar de alta en el CRM'}
                    </button>
                    {mp.empresa_sugerida && (
                      <span style={{ fontSize: '0.73rem', color: '#8C8C8C', marginLeft: 8 }}>
                        sugerido: <b style={{ color: '#4A4A4A' }}>{mp.empresa_sugerida.cliente}</b> — {mp.empresa_sugerida.porque}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
