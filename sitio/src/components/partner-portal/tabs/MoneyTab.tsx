// MoneyTab — claridad total de ingresos del partner.
// Foco: cuánto vas a generar este mes, qué está confirmado, qué falta validar,
// qué viene en camino y qué ya está en tu cuenta.
//
// Sin pipeline kanban (eso vive en LeadsTab). Aquí solo dinero.

import { useEffect, useMemo, useState } from 'react';
import { fmt, fmtDate, fmtRel, isDemoMode, apiGet, PLAN_LABELS } from './utils';
import { SS, C } from './styles';
import { Icon } from './icons';
import {
  demoSummary, demoLeads, demoPayments, demoPending, demoProfile,
} from '../../../data/partner-portal-demo';

type MonthRow = {
  id: string;
  cliente: string;
  empresa: string;
  plan: string;
  monto: number;
  estado: 'confirmado' | 'pendiente' | 'proyectado';
  fecha: string;
  nota?: string;
};

export default function MoneyTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [summary, setSummary] = useState<any>(null);
  const [leads, setLeads] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);
  const [pending, setPending] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [filter, setFilter] = useState<'todos' | 'confirmado' | 'pendiente' | 'proyectado'>('todos');

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

  // Filas del mes: confirmados + pendientes + proyectados
  const monthRows: MonthRow[] = useMemo(() => {
    if (!leads || !pending) return [];
    const out: MonthRow[] = [];

    // Confirmados (earned, esperan payout)
    for (const e of (pending.earned || [])) {
      out.push({
        id: e.id,
        cliente: e.contact_nombre || (e.nota || '').split('·')[1]?.trim() || 'Cliente',
        empresa: (e.nota || '').split('·')[0]?.trim() || '—',
        plan: (e.nota || '').split('·')[1]?.trim() || 'Plan',
        monto: Number(e.commission_amount || 0),
        estado: 'confirmado',
        fecha: e.earned_at || '',
        nota: e.nota,
      });
    }

    // Pendientes (en revisión SACS)
    for (const p of (pending.pending || [])) {
      out.push({
        id: p.id,
        cliente: p.contact_nombre || (p.nota || '').split('·')[1]?.trim() || 'Cliente',
        empresa: (p.nota || '').split('·')[0]?.trim() || '—',
        plan: (p.nota || '').split('·')[1]?.trim() || 'Plan',
        monto: Number(p.commission_amount || 0),
        estado: 'pendiente',
        fecha: p.created_at || '',
        nota: p.nota,
      });
    }

    // Proyectados: deals en pending_payment o leads en stage avanzado
    const deals = leads.deals || [];
    for (const d of deals) {
      if (d.stage === 'pending_payment') {
        const c = (leads.contacts || []).find((c: any) => c.id === d.contact_id);
        const monto = Math.round((Number(d.valor_total) || 0) * 0.5);
        if (monto > 0) {
          out.push({
            id: `proj-${d.id}`,
            cliente: c?.nombre || (d.nombre || '').split('·')[0] || 'Cliente',
            empresa: c?.empresa || (d.nombre || '').split('·')[0] || '—',
            plan: (d.nombre || '').split('·')[1]?.trim() || 'Plan',
            monto,
            estado: 'proyectado',
            fecha: d.created_at || '',
            nota: 'Cliente firmó · esperando pago',
          });
        }
      }
    }

    return out.sort((a, b) => {
      // Orden: confirmados primero, luego pendientes, luego proyectados
      const orderMap = { confirmado: 0, pendiente: 1, proyectado: 2 };
      return orderMap[a.estado] - orderMap[b.estado];
    });
  }, [leads, pending]);

  if (loading) return <div style={SS.loading}>Cargando tus números…</div>;
  if (!summary) return <div style={{ ...SS.loading, color: C.red }}>No se pudo cargar</div>;

  const totalPaid       = payments?.total_paid_lifetime ?? 0;
  const proximoPago     = summary.proximoPago ?? 0;
  const pendienteRev    = summary.pendiente ?? 0;
  const pipelineEspera  = monthRows.filter(r => r.estado === 'proyectado').reduce((s, r) => s + r.monto, 0);
  const confirmadoMes   = monthRows.filter(r => r.estado === 'confirmado').reduce((s, r) => s + r.monto, 0);
  const enRevisionMes   = monthRows.filter(r => r.estado === 'pendiente').reduce((s, r) => s + r.monto, 0);
  const totalPotencialMes = confirmadoMes + enRevisionMes + pipelineEspera;

  const filteredRows = filter === 'todos' ? monthRows : monthRows.filter(r => r.estado === filter);

  // Payout
  const payout = profile?.payout || null;
  const payoutLabel = payout?.banco && payout?.clabe ? `${payout.banco} •••${String(payout.clabe).slice(-4)}` : '—';

  const monthName = new Date().toLocaleDateString('es-MX', { month: 'long' });
  const nextMonthName = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('es-MX', { month: 'long' });

  return (
    <div>
      <h1 style={SS.h1Small}>Dinero</h1>
      <p style={SS.leadSm}>Todo lo que has generado, lo que está confirmado, lo que viene en camino y lo que ya está en tu cuenta.</p>

      {/* 4 hero stats */}
      <div style={{ ...SS.statGrid, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <BreakdownCard label="Pagado YTD" value={fmt(totalPaid)} accent={C.greenDark} hint={`${payments?.payments?.length || 0} pagos liquidados`} />
        <BreakdownCard label="Próximo pago" value={fmt(proximoPago)} accent={C.green} hint={`Confirmado · día 1 de ${nextMonthName}`} />
        <BreakdownCard label="Pipeline esperado" value={fmt(pipelineEspera)} accent={C.accent} hint="Proyección de leads activos" />
        <BreakdownCard label="Pendiente revisión" value={fmt(pendienteRev)} accent={C.amber} hint="En revisión por SACS" />
      </div>

      {/* Hero: tu mes en curso */}
      <h2 style={SS.h2}>Tu mes en curso · {capitalize(monthName)}</h2>

      <div style={{
        background: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: '36px 40px',
        marginBottom: 24,
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      }}>
        {/* Total potencial destacado */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' as const, marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: 12 }}>
              Total potencial del mes
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 500, color: C.text, lineHeight: 1, letterSpacing: '-0.035em' }}>
              {fmt(totalPotencialMes)}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
              Suma de confirmados + en revisión + leads cerrados esperando pago.
            </div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: 8 }}>
              Se deposita
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }}>
              1 de {nextMonthName}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{payoutLabel}</div>
          </div>
        </div>

        {/* Breakdown 3 niveles de certidumbre */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <CertaintyBlock
            label="Confirmado"
            value={fmt(confirmadoMes)}
            sub="Listo para depósito"
            accent={C.greenDark}
            level={3}
          />
          <CertaintyBlock
            label="En revisión"
            value={fmt(enRevisionMes)}
            sub="Pasa a confirmado en 24-48h"
            accent={C.amber}
            level={2}
          />
          <CertaintyBlock
            label="Proyectado"
            value={fmt(pipelineEspera)}
            sub="Leads firmados · esperan pago"
            accent={C.accent}
            level={1}
          />
        </div>
      </div>

      {/* Tabla de pagos del mes */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, marginRight: 4 }}>Filtrar:</span>
        <Chip active={filter === 'todos'} onClick={() => setFilter('todos')} label={`Todos · ${monthRows.length}`} />
        <Chip active={filter === 'confirmado'} onClick={() => setFilter('confirmado')} label={`Confirmados · ${monthRows.filter(r => r.estado === 'confirmado').length}`} color={C.greenDark} />
        <Chip active={filter === 'pendiente'} onClick={() => setFilter('pendiente')} label={`En revisión · ${monthRows.filter(r => r.estado === 'pendiente').length}`} color={C.amber} />
        <Chip active={filter === 'proyectado'} onClick={() => setFilter('proyectado')} label={`Proyectados · ${monthRows.filter(r => r.estado === 'proyectado').length}`} color={C.accent} />
      </div>

      {filteredRows.length === 0 ? (
        <div style={SS.empty}>
          {monthRows.length === 0
            ? 'Aún no hay ingresos este mes. Cuando un cliente firme o pague, aparecerá aquí.'
            : 'Sin movimientos en esta categoría.'}
        </div>
      ) : (
        <div style={SS.tableWrap}>
          <table style={SS.table}>
            <thead>
              <tr>
                <th style={SS.th}>Cliente</th>
                <th style={SS.th}>Plan</th>
                <th style={SS.th}>Estado</th>
                <th style={SS.th}>Fecha</th>
                <th style={{ ...SS.th, textAlign: 'right' as const }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(r => (
                <tr key={r.id}>
                  <td style={SS.td}>
                    <div style={{ fontWeight: 600 }}>{r.empresa}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{r.cliente}</div>
                  </td>
                  <td style={SS.td}>{r.plan}</td>
                  <td style={SS.td}>
                    <EstadoPill estado={r.estado} />
                  </td>
                  <td style={SS.td}>{r.fecha ? fmtRel(r.fecha) : '—'}</td>
                  <td style={{ ...SS.td, textAlign: 'right' as const, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                    {fmt(r.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ ...SS.td, fontWeight: 600, background: '#fafafa', borderTop: `2px solid ${C.border}` }}>
                  Total {filter === 'todos' ? 'del mes' : `(${filter})`}
                </td>
                <td style={{ ...SS.td, textAlign: 'right' as const, fontFamily: 'var(--font-display)', fontWeight: 700, background: '#fafafa', borderTop: `2px solid ${C.border}`, fontSize: 16 }}>
                  {fmt(filteredRows.reduce((s, r) => s + r.monto, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Pagos liquidados (acordeón) */}
      <h2 style={SS.h2}>Pagos liquidados</h2>
      <button onClick={() => setPaymentsOpen(o => !o)}
        style={{ ...SS.card, width: '100%', textAlign: 'left' as const, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 28px' }}>
        <div>
          <div style={{ fontWeight: 600, color: C.text, fontSize: 15 }}>
            {(payments?.payments?.length || 0)} pagos · {fmt(totalPaid)} total
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {payments?.payments?.[0]?.paid_at ? `Último pago: ${fmtDate(payments.payments[0].paid_at)}` : 'Sin pagos aún'}
          </div>
        </div>
        <span style={{ color: C.muted, transition: 'transform 0.2s', transform: paymentsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <Icon.ChevronDown size={18} />
        </span>
      </button>

      {paymentsOpen && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(payments?.payments || []).map((p: any) => (
            <div key={p.payment_reference} style={SS.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' as const }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Ref · {p.payment_reference}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, color: C.text, marginTop: 6, letterSpacing: '-0.022em' }}>{fmt(p.total)}</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Liquidado {fmtDate(p.paid_at)}</div>
                </div>
                <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#fff', background: C.greenDark, letterSpacing: '0.04em' }}>Pagado</span>
              </div>
              {p.items?.length > 1 && (
                <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.borderSoft}` }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Conceptos</div>
                  {p.items.map((it: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: C.textSoft }}>
                      <span>{it.nota || it.tipo}</span>
                      <span style={{ fontWeight: 600, color: C.text }}>{fmt(it.commission_amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {(payments?.payments?.length || 0) === 0 && (
            <div style={SS.empty}>Aún no hay pagos liquidados.</div>
          )}
        </div>
      )}

      {/* Cómo se calcula */}
      <h2 style={SS.h2}>Cómo se calcula tu dinero</h2>
      <button onClick={() => setCalcOpen(o => !o)}
        style={{ ...SS.card, width: '100%', textAlign: 'left' as const, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 28px' }}>
        <div>
          <div style={{ fontWeight: 600, color: C.text, fontSize: 15 }}>Reglas del programa</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>50% comisión directa · 10% override Master Partner</div>
        </div>
        <span style={{ color: C.muted, transition: 'transform 0.2s', transform: calcOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <Icon.ChevronDown size={18} />
        </span>
      </button>

      {calcOpen && (
        <div style={{ ...SS.card, marginTop: 14, fontSize: 14, color: C.textSoft, lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 14px' }}><strong style={{ color: C.text }}>Comisión directa:</strong> 50% del valor del plan en el primer mes que el cliente paga. Si el cliente sigue activo, generas comisión recurrente.</p>
          <p style={{ margin: '0 0 14px' }}><strong style={{ color: C.text }}>Override Master Partner:</strong> al alcanzar Lvl 3, ganas 10% adicional de cada venta de partners en tu red.</p>
          <p style={{ margin: '0 0 14px' }}><strong style={{ color: C.text }}>Ciclo de pago:</strong> corte el día 1 del mes. Confirmas tu factura 1-3 días antes. Depósito a tu cuenta el día 1 del mes siguiente.</p>
          <div style={{ marginTop: 18, padding: '16px 20px', background: C.bg, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Tu cuenta de pago</div>
              <div style={{ fontWeight: 600, color: C.text }}>{payoutLabel}</div>
              {payout?.titular && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{payout.titular}</div>}
            </div>
            <button style={SS.btnGhost} onClick={() => {
              const e = new CustomEvent('open-profile-dropdown');
              window.dispatchEvent(e);
            }}>Actualizar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: string }) {
  return (
    <div style={SS.statCard}>
      <span style={{ position: 'absolute', top: 24, right: 24, width: 6, height: 6, borderRadius: '50%', background: accent }} />
      <div style={SS.statLabel}>{label}</div>
      <div style={SS.statValueSm}>{value}</div>
      {hint && <div style={SS.statHint}>{hint}</div>}
    </div>
  );
}

function CertaintyBlock({ label, value, sub, accent, level }: { label: string; value: string; sub: string; accent: string; level: number }) {
  return (
    <div style={{
      padding: '20px 22px',
      background: C.bg,
      borderRadius: 12,
      borderLeft: `3px solid ${accent}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>{label}</span>
        {/* dots de certidumbre */}
        <span style={{ display: 'inline-flex', gap: 3 }}>
          {[1, 2, 3].map(i => (
            <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i <= level ? accent : `${accent}33` }} />
          ))}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: C.text, letterSpacing: '-0.022em', lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>{sub}</div>
    </div>
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

function EstadoPill({ estado }: { estado: 'confirmado' | 'pendiente' | 'proyectado' }) {
  const map = {
    confirmado: { label: 'Confirmado',  color: C.greenDark, bg: 'rgba(42,181,160,0.12)' },
    pendiente:  { label: 'En revisión', color: C.amber,     bg: 'rgba(232,168,56,0.14)' },
    proyectado: { label: 'Proyectado',  color: C.accent,    bg: 'rgba(75,123,229,0.10)' },
  };
  const s = map[estado];
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, letterSpacing: '0.04em',
    }}>{s.label}</span>
  );
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
