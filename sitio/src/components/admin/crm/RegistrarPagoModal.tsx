// Registrar el cobro de una cotización.
//
// Antes eran dos prompt() del navegador, uno tras otro. La forma de pago se
// escribía a mano —"trasferencia" con un typo y el reporte por método deja de
// cuadrar— y en celular es casi imposible. Además no decían nada de lo que el
// cobro dispara, que es lo que de verdad importa: al pagar, la oportunidad se
// gana, el lead se vuelve cliente y nace su suscripción.
import { useEffect, useState } from 'react';

const METODOS: { id: string; label: string }[] = [
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'oxxo', label: 'OXXO' },
  { id: 'mercadopago', label: 'Mercado Pago' },
  { id: 'stripe', label: 'Stripe' },
  { id: 'otro', label: 'Otro' },
];

const money = (n: any) => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });

export default function RegistrarPagoModal({ quote, onCerrar, onListo }: {
  quote: { id: string; numero?: string; empresa?: string; total?: number; abonado?: number };
  onCerrar: () => void;
  onListo: (r: any) => void;
}) {
  const total = Number(quote.total || 0);
  const yaPagado = Number(quote.abonado || 0);
  const saldo = Math.max(0, total - yaPagado);

  const [metodo, setMetodo] = useState('transferencia');
  const [monto, setMonto] = useState(String(Math.round(saldo || total)));
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [referencia, setReferencia] = useState('');
  const [acuse, setAcuse] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !guardando) onCerrar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [guardando, onCerrar]);

  const guardar = async () => {
    const m = parseFloat(monto);
    if (!(m > 0)) { setError('El monto tiene que ser mayor a cero.'); return; }
    setError(''); setGuardando(true);
    const r = await fetch('/api/revenue/mark-paid', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId: quote.id, metodo, referencia: referencia.trim() || null, fecha, monto: m, enviar_acuse: acuse }),
    }).then(x => x.json()).catch(() => ({ error: 'Error de red al registrar el pago.' }));
    setGuardando(false);
    if (r?.error) { setError(r.error); return; }
    onListo(r);
  };

  const L = { fontSize: '0.62rem', color: '#9a9a9a', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 3 };
  const I = { border: '1px solid #dcdce2', borderRadius: 8, padding: '9px 11px', fontSize: '0.82rem', width: '100%', fontFamily: 'inherit' as const, background: '#fff' };

  return (
    <div onClick={() => !guardando && onCerrar()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 50px rgba(16,24,40,.22)', width: 430, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 18px 0' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Registrar pago</h3>
          <div style={{ fontSize: '0.74rem', color: '#8a8a8a', marginTop: 2 }}>
            {quote.numero} · {quote.empresa} · {money(total)}
            {yaPagado > 0 && <> · ya abonado {money(yaPagado)}</>}
          </div>
        </div>

        <div style={{ padding: '14px 18px 18px' }}>
          <div style={L}>Forma de pago</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {METODOS.map(m => (
              <button key={m.id} onClick={() => setMetodo(m.id)}
                style={{ border: '1px solid', borderColor: metodo === m.id ? '#1a1a1a' : '#dcdce2', background: metodo === m.id ? '#1a1a1a' : '#fff',
                  color: metodo === m.id ? '#fff' : '#555', borderRadius: 20, padding: '6px 13px', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer' }}>
                {m.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div><div style={L}>Monto</div>
              <input type="number" value={monto} onChange={e => setMonto(e.target.value)} style={I} /></div>
            <div><div style={L}>Fecha del pago</div>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={I} /></div>
          </div>

          <div style={L}>Referencia · número de operación</div>
          <input value={referencia} onChange={e => setReferencia(e.target.value)}
            placeholder="Ej. SPEI 0012345678 — opcional" style={{ ...I, marginBottom: 10 }} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.76rem', color: '#555', cursor: 'pointer', marginBottom: 12 }}>
            <input type="checkbox" checked={acuse} onChange={e => setAcuse(e.target.checked)} />
            Enviar acuse de recibo por correo
          </label>

          {/* Decir ANTES lo que va a pasar. Cobrar dispara cuatro cosas que no
              se deshacen solas; verlas listadas evita el "¿y por qué de repente
              aparece como cliente?". */}
          <div style={{ background: '#f7f4ff', border: '1px solid #e4dbfb', borderRadius: 9, padding: '11px 12px', fontSize: '0.73rem', color: '#5b4a91', lineHeight: 1.6 }}>
            <b style={{ color: '#3b2a6b' }}>Al guardar, además:</b>
            <div>· Su oportunidad pasa a <b>ganada</b>, o se crea ya ganada si no existía</div>
            <div>· Si era un lead, <b>se convierte en cliente</b></div>
            <div>· Se crea la <b>suscripción</b> de lo recurrente que se vendió</div>
            <div>· Lo de pago único queda en su cuenta <b>sin sumar al ARR</b></div>
          </div>

          {error && (
            <div style={{ marginTop: 10, background: '#fdecec', border: '1px solid #f5c6c6', borderRadius: 8, padding: '8px 10px', fontSize: '0.75rem', color: '#8c2020' }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={guardar} disabled={guardando}
              style={{ background: '#1a1a1a', color: '#fff', border: 0, borderRadius: 8, padding: '10px 18px', fontSize: '0.8rem', fontWeight: 700, cursor: guardando ? 'wait' : 'pointer', opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Registrando…' : 'Registrar pago'}
            </button>
            <button onClick={onCerrar} disabled={guardando}
              style={{ background: '#fff', border: '1px solid #dcdce2', borderRadius: 8, padding: '10px 15px', fontSize: '0.8rem', fontWeight: 600, color: '#555', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Lo que el cierre dejó, en una línea legible. Se muestra después de cobrar:
// si el lead se convirtió en cliente y nació una suscripción, hay que decirlo.
export function resumenCierre(cierre: any): string {
  if (!cierre || cierre.error) return '';
  const partes: string[] = [];
  if (cierre.oportunidad_creada) partes.push('se creó su oportunidad ganada');
  else if (cierre.deal_id) partes.push('su oportunidad pasó a ganada');
  if (cierre.convirtio_lead) partes.push('el lead ahora es cliente');
  else if (cierre.cliente_creado) partes.push('se creó el cliente');
  if (cierre.sub_creada) partes.push('se creó su suscripción');
  if (cierre.unico_creado) partes.push('se registró el pago único');
  return partes.length ? partes.join(' · ') : '';
}
