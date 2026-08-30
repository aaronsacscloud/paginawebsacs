import { useEffect, useState } from 'react';
import { S } from './SubscriptionsTab';
import { confirmar } from '../../../lib/ui/confirmar';

/* ═══ Lo que Mercado Pago cobró y no terminó en un pago registrado ═══
 *
 * Dos listas distintas y las dos cuestan dinero:
 *  · SIN IDENTIFICAR — alguien pagó y nadie supo de quién era. El dinero ya
 *    está en la cuenta y ese cliente aparece como moroso.
 *  · RECHAZADOS — la tarjeta rebotó. Es la señal más temprana de que ese
 *    ingreso se cae este mes, y solo sirve si se ve el mismo día. */

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fecha = (f?: string | null) => (f ? new Date(f).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
const card = { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 14, marginBottom: 10 } as const;

export default function CobrosSinIdentificar() {
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(false);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [ver, setVer] = useState<'pendientes' | 'rechazos'>('pendientes');

  async function cargar() {
    setCargando(true);
    try { setD(await fetch('/api/crm/arr/mp-cobros').then(r => r.json())); }
    catch { setD({ error: 'No se pudo cargar' }); }
    setCargando(false);
  }
  useEffect(() => { cargar(); }, []);

  async function resolver(c: any, body: any, pregunta: string) {
    if (!await confirmar(pregunta)) return;
    setTrabajando(c.id);
    const j = await fetch('/api/crm/arr/mp-cobros', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: c.id, ...body }),
    }).then(r => r.json()).catch(() => ({ error: 'No se pudo' }));
    setTrabajando(null);
    if (j?.error) alert(j.error); else cargar();
  }

  const pend = d?.sin_identificar || [];
  const rech = d?.rechazos || [];

  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>Cobros que no se registraron</div>
          <div style={{ fontSize: '0.79rem', color: '#8a8f98' }}>
            Pagos que entraron sin saber de quién son, y cobros que rebotaron.
          </div>
        </div>
        {/* El webhook solo se entera de lo que pasa a partir de hoy. Todo lo
            cobrado ANTES de conectar la pasarela es invisible, y ahí están los
            pagos sueltos de clientes viejos que nadie acreditó. */}
        <button style={{ ...S.btnSmall, minHeight: 38, borderRadius: 50 }} disabled={cargando}
          title="Sale a Mercado Pago por los cobros de los últimos meses que el CRM nunca vio"
          onClick={async () => {
            if (!await confirmar('¿Buscar en Mercado Pago los cobros de los últimos 12 meses que el CRM no tenga?\n\nSolo los lista para que los acredites: no registra nada solo.')) return;
            setCargando(true);
            const j = await fetch('/api/crm/arr/mp-cobros?escanear=1&dias=365').then(r => r.json()).catch(() => ({ error: 'No se pudo' }));
            setCargando(false);
            setD(j);
            if (j?.barrido?.error) alert(j.barrido.error);
            else if (j?.barrido) alert(`Revisé ${j.barrido.revisados} cobros.\n\nNuevos por identificar: ${j.barrido.nuevos}\nMovimientos propios ignorados: ${j.barrido.propios}`);
          }}>{cargando ? '…' : 'Buscar cobros pasados'}</button>
        <button style={{ ...S.btnSmall, minHeight: 38, borderRadius: 50 }} disabled={cargando} onClick={cargar}>{cargando ? '…' : '↻ Actualizar'}</button>
      </div>

      <div style={{ display: 'flex', gap: 7, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setVer('pendientes')}
          style={{ ...S.btnSmall, minHeight: 36, borderRadius: 50, fontWeight: ver === 'pendientes' ? 800 : 600, background: ver === 'pendientes' ? '#1a1a1a' : '#fff', color: ver === 'pendientes' ? '#fff' : '#333', border: ver === 'pendientes' ? 'none' : '1px solid #ddd' }}>
          Sin identificar ({pend.length}){d?.total_sin_identificar ? ' · ' + money(d.total_sin_identificar) : ''}
        </button>
        <button onClick={() => setVer('rechazos')}
          style={{ ...S.btnSmall, minHeight: 36, borderRadius: 50, fontWeight: ver === 'rechazos' ? 800 : 600, background: ver === 'rechazos' ? '#1a1a1a' : '#fff', color: ver === 'rechazos' ? '#fff' : '#333', border: ver === 'rechazos' ? 'none' : '1px solid #ddd' }}>
          Rechazados ({rech.length}){d?.clientes_con_rechazo ? ` · ${d.clientes_con_rechazo} clientes` : ''}
        </button>
      </div>

      {d?.error && <div style={{ ...card, background: '#fdecea', borderColor: '#f0c4bd', color: '#E54B4B', fontWeight: 600 }}>{d.error}</div>}

      {ver === 'pendientes' && (pend.length ? pend.map((c: any) => (
        <div key={c.id} style={{ ...card, borderLeft: '4px solid #E8A838' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <b style={{ fontSize: '0.95rem' }}>{money(c.monto)}</b>
            <span style={{ fontSize: '0.78rem', color: '#8a8f98' }}>
              {fecha(c.fecha)}{c.payer_email ? <> · pagó <b style={{ color: '#4A4A4A' }}>{c.payer_email}</b></> : ''}
              {c.metodo ? ' · ' + c.metodo : ''}
            </span>
            <button style={{ ...S.btnSmall, minHeight: 32, borderRadius: 50, marginLeft: 'auto', color: '#8C8C8C' }}
              disabled={trabajando === c.id}
              onClick={() => resolver(c, { descartar: true, nota: prompt('¿Por qué se descarta? (opcional)') || null },
                `¿Sacar este pago de ${money(c.monto)} de la bandeja sin acreditarlo a nadie?`)}>
              No es nuestro
            </button>
          </div>
          <div style={{ marginTop: 10, borderTop: '1px solid #f4f4f4', paddingTop: 10 }}>
            {c.candidatos?.length ? (
              <>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8C8C8C', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>¿A quién se lo acredito?</div>
                {c.candidatos.map((k: any) => (
                  <div key={k.subscription_id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#FAFAF8', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <b style={{ fontSize: '0.83rem' }}>{k.cliente}</b>
                      <span style={{ fontSize: '0.76rem', color: '#777' }}> · {k.nombre_plan} · {money(k.precio)}</span>
                      <div style={{ fontSize: '0.71rem', color: '#8C8C8C' }}>{k.porque.join(' · ')}</div>
                    </div>
                    <button style={{ ...S.btnSmall, minHeight: 34, borderRadius: 50, fontWeight: 700, background: k.puntos >= 100 ? '#4B7BE5' : '#fff', color: k.puntos >= 100 ? '#fff' : '#333', border: k.puntos >= 100 ? 'none' : '1px solid #ddd' }}
                      disabled={trabajando === c.id}
                      onClick={() => resolver(c, { subscription_id: k.subscription_id },
                        `¿Acreditar ${money(c.monto)} a ${k.cliente} (${k.nombre_plan})?\n\nSe registra el pago, se recorre su próxima factura y se recalcula su ARR.`)}>
                      Acreditar
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: '0.78rem', color: '#a06600' }}>
                No encontré a quién pudiera pertenecer. Búscalo por el correo del pagador en Mercado Pago,
                o descártalo si no era un cobro nuestro.
              </div>
            )}
          </div>
        </div>
      )) : <div style={{ ...card, color: '#8C8C8C', fontSize: '0.85rem' }}>Nada pendiente: todos los pagos que entraron están acreditados.</div>)}

      {ver === 'rechazos' && (rech.length ? rech.map((c: any) => {
        const co: any = Array.isArray(c.companies) ? c.companies[0] : c.companies;
        const su: any = Array.isArray(c.subscriptions) ? c.subscriptions[0] : c.subscriptions;
        return (
          <div key={c.id} style={{ ...card, borderLeft: '4px solid #E54B4B' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <b style={{ fontSize: '0.95rem' }}>{money(c.monto)}</b>
              <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, background: 'rgba(229,75,75,.12)', color: '#E54B4B' }}>
                {c.motivo || 'rechazado'}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#8a8f98' }}>{fecha(c.fecha)}</span>
            </div>
            <div style={{ fontSize: '0.79rem', color: '#4A4A4A', marginTop: 5 }}>
              {co ? <b>{co.sacs_account || co.nombre}</b> : <span style={{ color: '#a06600' }}>sin cliente identificado</span>}
              {su ? ` · ${su.nombre_plan}` : ''}
              {c.payer_email ? ` · ${c.payer_email}` : ''}
            </div>
          </div>
        );
      }) : <div style={{ ...card, color: '#8C8C8C', fontSize: '0.85rem' }}>Ningún cobro rebotado en los últimos 90 días.</div>)}
    </div>
  );
}
