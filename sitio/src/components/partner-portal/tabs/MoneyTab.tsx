// MoneyTab — estilo banco. El partner ve su saldo como en una cuenta bancaria.
// Flow:
//   1. Cliente paga → comisión queda "en revisión" (24-48h validación SACS)
//   2. Se aprueba → pasa a "confirmado" (acumulando)
//   3. Día 30 del mes → se libera al "saldo disponible"
//   4. Saldo disponible puede usarse para:
//      - Retirar a cuenta bancaria (form de validación → factura → depósito día +1)
//      - Comprar una certificación (descuenta del saldo, sin tarjeta)
//   5. Historial de movimientos (entradas y salidas) como cualquier banca

import { useEffect, useMemo, useState } from 'react';
import { fmt, fmtDate, fmtRel, isDemoMode, apiGet } from './utils';
import { SS, C } from './styles';
import { Icon } from './icons';
import {
  demoSummary, demoLeads, demoPayments, demoPending, demoProfile,
} from '../../../data/partner-portal-demo';

type Movement = {
  id: string;
  type: 'entrada' | 'salida';
  concept: 'comision' | 'retiro' | 'certificacion' | 'ajuste';
  description: string;
  amount: number;
  date: string;
  status?: 'completado' | 'pendiente';
};

export default function MoneyTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [summary, setSummary] = useState<any>(null);
  const [leads, setLeads] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);
  const [pending, setPending] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [certPickerOpen, setCertPickerOpen] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'entrada' | 'salida'>('todos');

  useEffect(() => {
    Promise.all([
      apiGet('/api/partner-portal/summary',  isDemoMode() ? demoSummary  : undefined),
      apiGet('/api/partner-portal/leads',    isDemoMode() ? demoLeads    : undefined),
      apiGet('/api/partner-portal/payments', isDemoMode() ? demoPayments : undefined),
      apiGet('/api/partner-portal/pending',  isDemoMode() ? demoPending  : undefined),
      apiGet('/api/partner-portal/profile',  isDemoMode() ? demoProfile  : undefined),
    ]).then(([s, l, p, pe, pr]) => {
      setSummary(s); setLeads(l); setPayments(p); setPending(pe); setProfile(pr);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={SS.loading}>Cargando tu cuenta…</div>;
  if (!summary) return <div style={{ ...SS.loading, color: C.red }}>No se pudo cargar</div>;

  // ── Cálculo del saldo bancario ──
  const proximoPago     = summary.proximoPago ?? 0;      // earned · listo día 30
  const pendienteRev    = summary.pendiente ?? 0;        // en revisión 24-48h

  // Pipeline esperado = deals firmados pero cliente aún no pagó
  const projectedFromDeals = (leads?.deals || [])
    .filter((d: any) => d.stage === 'pending_payment')
    .reduce((s: number, d: any) => s + Math.round((Number(d.valor_total) || 0) * 0.5), 0);

  // Saldo disponible = todo lo "earned" se libera el día 30. Por simplicidad en demo,
  // si estamos antes del día 30, lo confirmado se muestra como "disponible próximo 30"
  // y solo lo ya liquidado (pagos pasados) es realmente "en el banco".
  const today = new Date();
  const isPastReleaseDay = today.getDate() >= 30;
  const saldoDisponible = isPastReleaseDay ? proximoPago : 0;
  const liberacionPendiente = isPastReleaseDay ? 0 : proximoPago;

  const totalPaidLifetime = payments?.total_paid_lifetime ?? 0;

  // ── Construye historial de movimientos (entradas + salidas) ──
  const movements: Movement[] = useMemo(() => {
    const out: Movement[] = [];

    // Entradas: pagos liquidados históricos
    for (const p of (payments?.payments || [])) {
      out.push({
        id: `pago-${p.payment_reference}`,
        type: 'entrada',
        concept: 'comision',
        description: `Liberación de saldo · ${p.items?.length || 0} comisión${p.items?.length === 1 ? '' : 'es'}`,
        amount: Number(p.total || 0),
        date: p.paid_at || '',
        status: 'completado',
      });
    }
    // Confirmados pendientes (earned)
    for (const e of (pending?.earned || [])) {
      out.push({
        id: `earned-${e.id}`,
        type: 'entrada',
        concept: 'comision',
        description: `Comisión confirmada · ${e.nota || e.contact_nombre || 'Cliente'}`,
        amount: Number(e.commission_amount || 0),
        date: e.earned_at || '',
        status: 'pendiente',
      });
    }
    // Salidas demo (solo en demo mode): un retiro reciente + 1 cert comprada
    if (isDemoMode()) {
      out.push({
        id: 'demo-w1',
        type: 'salida',
        concept: 'retiro',
        description: 'Retiro a BBVA •••2847',
        amount: 4900,
        date: new Date(Date.now() - 12 * 86400000).toISOString(),
        status: 'completado',
      });
    }
    return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [payments, pending]);

  const filteredMovs = filter === 'todos' ? movements : movements.filter(m => m.type === filter);

  // Payout config
  const payout = profile?.payout || null;
  const payoutLabel = payout?.banco && payout?.clabe ? `${payout.banco} •••${String(payout.clabe).slice(-4)}` : null;

  // Próxima fecha de liberación (día 30)
  const nextReleaseDate = new Date(today.getFullYear(), today.getMonth() + (today.getDate() >= 30 ? 1 : 0), 30);

  return (
    <div>
      <h1 style={SS.h1Small}>Dinero</h1>
      <p style={SS.leadSm}>Tu cuenta SACS — todo el dinero que has generado, lo que está confirmado y lo que ya puedes retirar.</p>

      {/* HERO BANCARIO · Saldo disponible */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`,
        color: '#fff',
        borderRadius: 20,
        padding: '40px 44px',
        marginBottom: 18,
        boxShadow: '0 16px 40px -20px rgba(75,123,229,0.45)',
        position: 'relative' as const,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' as const, marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
              Saldo disponible
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.04em' }}>
              {fmt(saldoDisponible)}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 12, lineHeight: 1.5 }}>
              {saldoDisponible > 0
                ? 'Disponible para retirar o usar en una certificación.'
                : liberacionPendiente > 0
                  ? `${fmt(liberacionPendiente)} se libera el ${fmtDate(nextReleaseDate.toISOString())} · día 30 del mes`
                  : 'Cuando tengas comisiones confirmadas, aparecerán acá.'}
            </div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
              Total pagado · histórico
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>
              {fmt(totalPaidLifetime)}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
              {payments?.payments?.length || 0} retiros completados
            </div>
          </div>
        </div>

        {/* CTAs principales · estilo banco */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, paddingTop: 22, borderTop: '1px solid rgba(255,255,255,0.18)' }}>
          <button onClick={() => setWithdrawOpen(true)} disabled={saldoDisponible <= 0}
            style={{
              padding: '13px 22px',
              background: '#fff', color: C.brand,
              border: 'none', borderRadius: 999,
              fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
              cursor: saldoDisponible > 0 ? 'pointer' : 'not-allowed',
              opacity: saldoDisponible > 0 ? 1 : 0.55,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              letterSpacing: '-0.005em',
            }}>
            <Icon.Bank size={16} /> Retirar a mi cuenta
          </button>
          <button onClick={() => setCertPickerOpen(true)} disabled={saldoDisponible <= 0}
            style={{
              padding: '13px 22px',
              background: 'rgba(255,255,255,0.18)', color: '#fff',
              border: '1px solid rgba(255,255,255,0.30)', borderRadius: 999,
              fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
              cursor: saldoDisponible > 0 ? 'pointer' : 'not-allowed',
              opacity: saldoDisponible > 0 ? 1 : 0.55,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              letterSpacing: '-0.005em',
            }}>
            <Icon.Certificate size={16} /> Usar para certificación
          </button>
        </div>
      </div>

      {/* Status row · 3 estados del dinero */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 36 }}>
        <FlowCard
          step="1"
          label="En revisión"
          value={fmt(pendienteRev)}
          desc="SACS valida en 24-48h"
          accent={C.amber}
        />
        <FlowCard
          step="2"
          label="Confirmado · esperando liberación"
          value={fmt(liberacionPendiente)}
          desc={`Se libera ${fmtDate(nextReleaseDate.toISOString())}`}
          accent={C.purple}
        />
        <FlowCard
          step="3"
          label="Proyectado"
          value={fmt(projectedFromDeals)}
          desc="Clientes firmaron · esperan primer pago"
          accent={C.accent}
        />
      </div>

      {/* Cómo funciona tu cuenta */}
      <div style={{ ...SS.note, marginBottom: 28, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Icon.CheckCircle size={18} color={C.brand} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ color: C.text }}>Cómo funciona tu cuenta SACS.</strong>{' '}
          El cliente paga → tu comisión queda <em>en revisión</em> 24-48h →
          pasa a <em>confirmado</em> y se acumula → el <strong>día 30 de cada mes</strong> liberamos todo lo confirmado a tu <strong>saldo disponible</strong>.
          Desde ahí lo retiras a tu cuenta bancaria o lo usas para certificaciones.
        </div>
      </div>

      {/* Historial de movimientos · estilo ledger bancario */}
      <h2 style={SS.h2}>Movimientos</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 16 }}>
        <Chip active={filter === 'todos'} onClick={() => setFilter('todos')} label={`Todos · ${movements.length}`} />
        <Chip active={filter === 'entrada'} onClick={() => setFilter('entrada')} label={`Entradas · ${movements.filter(m => m.type === 'entrada').length}`} color={C.greenDark} />
        <Chip active={filter === 'salida'} onClick={() => setFilter('salida')} label={`Salidas · ${movements.filter(m => m.type === 'salida').length}`} color={C.amber} />
      </div>

      {filteredMovs.length === 0 ? (
        <div style={SS.empty}>Sin movimientos en esta categoría.</div>
      ) : (
        <div style={SS.tableWrap}>
          <table style={SS.table}>
            <thead>
              <tr>
                <th style={SS.th}>Tipo</th>
                <th style={SS.th}>Concepto</th>
                <th style={SS.th}>Fecha</th>
                <th style={SS.th}>Estado</th>
                <th style={{ ...SS.th, textAlign: 'right' as const }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovs.map(m => (
                <tr key={m.id}>
                  <td style={SS.td}>
                    <MovementIcon type={m.type} concept={m.concept} />
                  </td>
                  <td style={SS.td}>
                    <div style={{ fontWeight: 600 }}>{m.description}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2, textTransform: 'capitalize' as const }}>{m.concept.replace('_', ' ')}</div>
                  </td>
                  <td style={SS.td}>{m.date ? fmtRel(m.date) : '—'}</td>
                  <td style={SS.td}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
                      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                      background: m.status === 'completado' ? 'rgba(42,181,160,0.12)' : 'rgba(232,168,56,0.14)',
                      color: m.status === 'completado' ? C.greenDark : C.amber,
                    }}>
                      {m.status === 'completado' ? 'Completado' : 'Pendiente'}
                    </span>
                  </td>
                  <td style={{ ...SS.td, textAlign: 'right' as const, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, color: m.type === 'entrada' ? C.greenDark : C.red }}>
                    {m.type === 'entrada' ? '+' : '−'} {fmt(m.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Configuración de pagos · estilo banca */}
      <h2 style={SS.h2}>Configuración de pagos</h2>
      <div style={{ ...SS.card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${C.borderSoft}`, gap: 16, flexWrap: 'wrap' as const }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Cuenta para retiros</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 4 }}>
              {payoutLabel || <span style={{ color: C.amber }}>Sin configurar</span>}
            </div>
            {payout?.titular && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{payout.titular}</div>}
          </div>
          <button style={SS.btnGhost}
            onClick={() => window.dispatchEvent(new CustomEvent('open-profile-dropdown'))}>
            {payoutLabel ? 'Editar cuenta' : 'Registrar cuenta'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${C.borderSoft}`, gap: 16, flexWrap: 'wrap' as const }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Frecuencia de liberación</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 4 }}>Día 30 de cada mes</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Próxima liberación: {fmtDate(nextReleaseDate.toISOString())}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', gap: 16, flexWrap: 'wrap' as const }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Cómo pides el retiro</div>
            <div style={{ fontSize: 13, color: C.textSoft, marginTop: 6, lineHeight: 1.55, maxWidth: 480 }}>
              Solicitas el retiro desde el botón <strong style={{ color: C.text }}>"Retirar a mi cuenta"</strong>.
              SACS te pide una factura por el monto total. Al día siguiente del envío de tu factura, depositamos el monto a tu cuenta bancaria.
            </div>
          </div>
        </div>
      </div>

      {/* Drawer: retirar dinero */}
      {withdrawOpen && (
        <WithdrawDrawer
          saldo={saldoDisponible}
          payout={payout}
          onClose={() => setWithdrawOpen(false)}
        />
      )}

      {/* Drawer: usar saldo para cert */}
      {certPickerOpen && (
        <CertPickerDrawer
          saldo={saldoDisponible}
          onClose={() => setCertPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────

function FlowCard({ step, label, value, desc, accent }: { step: string; label: string; value: string; desc: string; accent: string }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: '20px 22px', position: 'relative' as const,
      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
          background: `${accent}1a`, color: accent,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
        }}>{step}</span>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: C.text, letterSpacing: '-0.022em', lineHeight: 1.1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{desc}</div>
    </div>
  );
}

function MovementIcon({ type, concept }: { type: 'entrada' | 'salida'; concept: string }) {
  const map: Record<string, { color: string; bg: string; symbol: string }> = {
    comision:     { color: C.greenDark, bg: 'rgba(42,181,160,0.12)', symbol: '↓' },
    retiro:       { color: C.red,       bg: 'rgba(220,38,38,0.10)',  symbol: '↑' },
    certificacion:{ color: C.purple,    bg: 'rgba(108,92,231,0.12)', symbol: '↑' },
    ajuste:       { color: C.muted,     bg: '#f5f5f3',                symbol: '·' },
  };
  const s = map[concept] || map.ajuste;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 32, height: 32, borderRadius: '50%',
      background: s.bg, color: s.color,
      fontSize: 16, fontWeight: 700,
    }}>{s.symbol}</span>
  );
}

function Chip({ active, label, onClick, color }: { active: boolean; label: string; onClick: () => void; color?: string }) {
  const accent = color || C.brand;
  return (
    <button onClick={onClick}
      style={{
        padding: '8px 14px', borderRadius: 999,
        border: `1px solid ${active ? accent : C.border}`,
        background: active ? accent : '#fff',
        color: active ? '#fff' : C.text,
        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        letterSpacing: '-0.005em',
        transition: 'background 0.15s, border-color 0.15s',
      }}>{label}</button>
  );
}

// ─── Drawer: Retirar dinero ────────────────────────────────

function WithdrawDrawer({ saldo, payout, onClose }: { saldo: number; payout: any; onClose: () => void }) {
  const [step, setStep] = useState<'form' | 'confirm' | 'submitted'>('form');
  const [monto, setMonto] = useState(saldo);
  const [titular, setTitular] = useState(payout?.titular || '');
  const [rfc, setRfc] = useState(payout?.rfc || '');
  const [banco, setBanco] = useState(payout?.banco || '');
  const [clabe, setClabe] = useState(payout?.clabe || '');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function canConfirm() {
    return monto > 0 && monto <= saldo && titular.trim() && rfc.trim() && banco.trim() && clabe.trim().length >= 16 && acceptTerms;
  }

  async function submit() {
    setSubmitting(true);
    // En real: POST /api/partner-portal/withdrawals con monto + datos
    setTimeout(() => {
      setSubmitting(false);
      setStep('submitted');
    }, 700);
  }

  return (
    <>
      <div style={SS.drawerBackdrop} onClick={onClose} />
      <div style={SS.drawer}>
        <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 8 }}>
          <Icon.Close size={20} />
        </button>

        {step === 'form' && (
          <>
            <h2 style={SS.h1Small}>Retirar a tu cuenta</h2>
            <p style={SS.leadSm}>
              Saldo disponible: <strong style={{ color: C.text }}>{fmt(saldo)}</strong>
            </p>

            <Field label="Monto a retirar">
              <div style={{ position: 'relative' as const }}>
                <span style={{ position: 'absolute' as const, left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, fontSize: 14, fontWeight: 600 }}>$</span>
                <input type="number" value={monto} onChange={e => setMonto(Number(e.target.value))} style={{ ...inputStyle, paddingLeft: 28 }} max={saldo} />
              </div>
              {monto > saldo && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>Excede tu saldo disponible</div>}
            </Field>

            <h3 style={{ ...SS.h3, marginTop: 22, marginBottom: 12 }}>Datos para depósito</h3>
            <Field label="Titular de la cuenta"><input value={titular} onChange={e => setTitular(e.target.value)} style={inputStyle} /></Field>
            <Field label="RFC"><input value={rfc} onChange={e => setRfc(e.target.value)} style={inputStyle} maxLength={13} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10 }}>
              <Field label="Banco"><input value={banco} onChange={e => setBanco(e.target.value)} style={inputStyle} placeholder="BBVA" /></Field>
              <Field label="CLABE (18 dígitos)"><input value={clabe} onChange={e => setClabe(e.target.value)} style={inputStyle} maxLength={18} /></Field>
            </div>

            <div style={{ ...SS.note, marginTop: 14, marginBottom: 16, fontSize: 12, lineHeight: 1.6 }}>
              <strong>Flujo del retiro.</strong> Al confirmar:
              <ol style={{ paddingLeft: 18, margin: '8px 0 0', display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                <li>SACS te envía un email con el detalle a facturar.</li>
                <li>Emites tu factura (CFDI) por el monto total.</li>
                <li>Al día siguiente de recibir tu factura validada, depositamos a tu cuenta.</li>
                <li>Recibes notificación en el portal cuando se complete.</li>
              </ol>
            </div>

            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 18 }}>
              <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} style={{ marginTop: 3, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: C.textSoft, lineHeight: 1.5 }}>
                Confirmo que los datos son correctos y entiendo que el depósito se procesa después de validar mi factura.
              </span>
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={submit} disabled={!canConfirm() || submitting}
                style={{ ...SS.btn, opacity: canConfirm() && !submitting ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Icon.Bank size={14} /> {submitting ? 'Procesando…' : `Solicitar retiro de ${fmt(monto)}`}
              </button>
              <button onClick={onClose} style={SS.btnGhost}>Cancelar</button>
            </div>
          </>
        )}

        {step === 'submitted' && (
          <>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(42,181,160,0.12)', color: C.greenDark,
              marginBottom: 18,
            }}>
              <Icon.CheckCircle size={28} />
            </div>
            <h2 style={SS.h1Small}>Solicitud recibida</h2>
            <p style={SS.leadSm}>
              Te enviamos un email con los <strong style={{ color: C.text }}>datos para emitir tu factura</strong> por <strong style={{ color: C.text }}>{fmt(monto)}</strong>.
            </p>

            <div style={{ ...SS.note, marginTop: 8 }}>
              <strong>Próximos pasos:</strong>
              <ul style={{ paddingLeft: 20, margin: '8px 0 0', display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                <li>Emite la factura con los datos que te mandamos</li>
                <li>Súbela desde el link en el email (o respóndelo con el PDF/XML)</li>
                <li>Al día siguiente de la validación, depositamos a {banco} •••{clabe.slice(-4)}</li>
                <li>Te avisamos por notificación cuando se complete</li>
              </ul>
            </div>

            <button onClick={onClose} style={{ ...SS.btn, marginTop: 24 }}>Cerrar</button>
          </>
        )}
      </div>
    </>
  );
}

// ─── Drawer: Comprar cert con saldo ──────────────────────────

function CertPickerDrawer({ saldo, onClose }: { saldo: number; onClose: () => void }) {
  const [certs, setCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ certifications: any[] }>('/api/partner-portal/certifications', isDemoMode() ? { certifications: [
      { id: 'demos_consultoria_consciente', shortName: 'Demos · Consultoría Consciente', precio: 350000, precioMostrar: '$3,500', unlocked: false },
      { id: 'impl_una_sucursal', shortName: 'Implementación · 1 sucursal', precio: 750000, precioMostrar: '$7,500', unlocked: false },
      { id: 'migracion_datos', shortName: 'Migración de datos', precio: 750000, precioMostrar: '$7,500', unlocked: false },
      { id: 'impl_multisucursal', shortName: 'Implementación · Multi-sucursal', precio: 1400000, precioMostrar: '$14,000', unlocked: false },
      { id: 'ia_automatizacion', shortName: 'Automatización con IA', precio: 1400000, precioMostrar: '$14,000', unlocked: false },
      { id: 'consultor_ia', shortName: 'Consultor en IA', precio: 2100000, precioMostrar: '$21,000', unlocked: false },
    ] } : undefined).then(d => {
      setCerts(d?.certifications || []);
      setLoading(false);
    });
  }, []);

  const certsDisponibles = certs.filter(c => !c.unlocked && (c.precio / 100) <= saldo);
  const certsLockedSinSaldo = certs.filter(c => !c.unlocked && (c.precio / 100) > saldo);

  async function buy(certId: string) {
    setBuying(certId);
    setTimeout(() => {
      setBuying(null);
      alert('Compra confirmada · cert activa en tu portal (demo)');
      onClose();
    }, 700);
  }

  return (
    <>
      <div style={SS.drawerBackdrop} onClick={onClose} />
      <div style={SS.drawer}>
        <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 8 }}>
          <Icon.Close size={20} />
        </button>
        <h2 style={SS.h1Small}>Usar saldo para certificación</h2>
        <p style={SS.leadSm}>
          Tu saldo disponible: <strong style={{ color: C.text }}>{fmt(saldo)}</strong>. Compra una cert sin sacar dinero de tu bolsillo — sale directo de tu cuenta.
        </p>

        {loading ? (
          <div style={SS.loading}>Cargando…</div>
        ) : certsDisponibles.length === 0 ? (
          <div style={SS.empty}>
            Tu saldo actual no cubre ninguna certificación disponible. Sigue acumulando o ve a <a href="#certs" onClick={(e) => { e.preventDefault(); window.location.hash = 'certs'; onClose(); }} style={{ color: C.brand, fontWeight: 600 }}>Certificaciones</a> para pagar con tarjeta.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
              Cubres con tu saldo
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 20 }}>
              {certsDisponibles.map(c => (
                <CertOption key={c.id} cert={c} saldo={saldo} buying={buying === c.id} onBuy={() => buy(c.id)} />
              ))}
            </div>
          </>
        )}

        {certsLockedSinSaldo.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: C.mutedLight, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10, marginTop: 18 }}>
              Más caras · sigue acumulando saldo
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
              {certsLockedSinSaldo.map(c => (
                <div key={c.id} style={{
                  padding: '12px 14px',
                  background: '#fafafa', border: `1px solid ${C.border}`, borderRadius: 10,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  opacity: 0.7,
                }}>
                  <span style={{ fontSize: 13, color: C.muted }}>{c.shortName}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.muted, fontFamily: 'var(--font-display)' }}>{c.precioMostrar}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function CertOption({ cert, saldo, buying, onBuy }: { cert: any; saldo: number; buying: boolean; onBuy: () => void }) {
  const precio = cert.precio / 100;
  const remainder = saldo - precio;
  return (
    <div style={{
      background: C.brandSoft, border: `1px solid ${C.brandTint}`, borderRadius: 12,
      padding: '14px 16px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const,
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{cert.shortName}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
          Después de comprar: <strong style={{ color: C.text }}>{fmt(remainder)}</strong> restantes
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: C.brand, letterSpacing: '-0.012em' }}>{cert.precioMostrar}</span>
        <button onClick={onBuy} disabled={buying}
          style={{ ...SS.btnSm, padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: buying ? 0.6 : 1 }}>
          {buying ? 'Procesando…' : 'Comprar'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  fontSize: 14,
  fontFamily: 'inherit',
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  background: '#fafafa',
  outline: 'none',
  boxSizing: 'border-box',
};
