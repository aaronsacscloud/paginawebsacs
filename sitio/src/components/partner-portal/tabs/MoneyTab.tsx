import { useEffect, useMemo, useState } from 'react';
import { fmt, fmtDate, fmtNum, fmtRel, isDemoMode, apiGet, STAGE_LABELS, STAGE_COLORS, PLAN_LABELS } from './utils';
import { SS, C, stagePillStyle } from './styles';
import { demoSummary, demoLeads, demoPayments, demoPending, demoProfile } from '../../../data/partner-portal-demo';

type LeadCard = {
  id: string;
  nombre: string;
  empresa: string;
  ciudad?: string;
  fuente?: string;
  plan?: string;
  stage: string;
  commission_est?: number;
  created_at: string;
  bookingId?: string | null;
  bookingFecha?: string | null;
  dealId?: string | null;
  dealValor?: number | null;
  dealClosedAt?: string | null;
};

export default function MoneyTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [summary, setSummary] = useState<any>(null);
  const [leads, setLeads] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'pipeline' | 'table'>('pipeline');
  const [filter, setFilter] = useState<string | null>(null);
  const [drawerLead, setDrawerLead] = useState<LeadCard | null>(null);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet('/api/partner-portal/summary',  isDemoMode() ? demoSummary  : undefined),
      apiGet('/api/partner-portal/leads',    isDemoMode() ? demoLeads    : undefined),
      apiGet('/api/partner-portal/payments', isDemoMode() ? demoPayments : undefined),
      apiGet('/api/partner-portal/profile',  isDemoMode() ? demoProfile  : undefined),
    ]).then(([s, l, p, pr]) => {
      setSummary(s); setLeads(l); setPayments(p); setProfile(pr);
      setLoading(false);
    });
  }, []);

  // Consolida contacts + bookings + deals en un solo array de leads
  const allLeads: LeadCard[] = useMemo(() => {
    if (!leads) return [];
    const contacts = leads.contacts || [];
    const bookings = leads.bookings || [];
    const deals    = leads.deals    || [];

    return contacts.map((c: any) => {
      const bk = bookings.find((b: any) => b.contact_id === c.id);
      const dl = deals.find((d: any) => d.contact_id === c.id);
      let stage = c.lifecycle_stage || 'lead';
      if (dl) {
        stage = dl.stage === 'won' || dl.closed_at ? 'pagado' : 'cliente';
      } else if (bk) {
        stage = bk.estado === 'realizada' ? 'demo_realizada' : 'demo_agendada';
      } else if (c.lifecycle_stage === 'prueba_gratis') {
        stage = 'prueba_gratis';
      } else {
        stage = 'lead';
      }
      const dealValor = dl?.valor_total ? Number(dl.valor_total) : null;
      return {
        id: c.id,
        nombre: c.nombre || 'Sin nombre',
        empresa: c.empresa || '—',
        ciudad: c.ciudad || undefined,
        fuente: c.fuente || undefined,
        plan: c.plan_interes || (dl?.nombre?.split(' · ')[1]) || undefined,
        stage,
        commission_est: dealValor ? Math.round(dealValor * 0.5) : null,
        created_at: c.created_at,
        bookingId: bk?.id || null,
        bookingFecha: bk?.fecha || null,
        dealId: dl?.id || null,
        dealValor,
        dealClosedAt: dl?.closed_at || null,
      } as LeadCard;
    });
  }, [leads]);

  if (loading) return <div style={SS.loading}>Cargando tus números…</div>;
  if (!summary) return <div style={{ ...SS.loading, color: C.red }}>No se pudo cargar</div>;

  // Hero breakdown
  const totalPaid     = payments?.total_paid_lifetime ?? 0;
  const proximoPago   = summary.proximoPago ?? 0;
  const pendiente     = summary.pendiente ?? 0;
  const pipelineEsperado = allLeads
    .filter(l => l.stage === 'demo_agendada' || l.stage === 'demo_realizada' || l.stage === 'prueba_gratis')
    .reduce((acc, l) => acc + (l.commission_est || 1750), 0);

  // Pipeline counts
  const stages = ['lead', 'prueba_gratis', 'demo_agendada', 'demo_realizada', 'cliente', 'pagado'];
  const byStage = stages.map(s => ({ key: s, count: allLeads.filter(l => l.stage === s).length }));

  // Filtered leads para vista tabla
  const filteredLeads = filter ? allLeads.filter(l => l.stage === filter) : allLeads;

  // Payout
  const payout = profile?.payout || null;
  const payoutLabel = payout?.banco && payout?.clabe ? `${payout.banco} •••${String(payout.clabe).slice(-4)}` : '—';

  return (
    <div>
      {/* Hero */}
      <h1 style={SS.h1Small}>Dinero</h1>
      <p style={SS.leadSm}>Todo lo que has generado, lo que está confirmado, lo que viene en camino y lo que ya está en tu cuenta.</p>

      {/* 4 breakdown stats */}
      <div style={{ ...SS.statGrid, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <BreakdownCard label="Pagado YTD" value={fmt(totalPaid)} accent={C.greenDark} hint={`${payments?.payments?.length || 0} pagos liquidados`} />
        <BreakdownCard label="Próximo pago" value={fmt(proximoPago)} accent={C.green} hint="Confirmado · día 1 del mes" />
        <BreakdownCard label="Pipeline esperado" value={fmt(pipelineEsperado)} accent={C.accent} hint="Proyección de leads activos" />
        <BreakdownCard label="Pendiente revisión" value={fmt(pendiente)} accent={C.amber} hint="En revisión por SACS" />
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginTop: 40, marginBottom: 20, alignItems: 'center' }}>
        <h2 style={{ ...SS.h2, margin: 0, flex: 1 }}>Tu pipeline</h2>
        <button
          style={{ ...SS.btnGhost, background: view === 'pipeline' ? C.text : C.bg, color: view === 'pipeline' ? '#fff' : C.text }}
          onClick={() => setView('pipeline')}>Pipeline</button>
        <button
          style={{ ...SS.btnGhost, background: view === 'table' ? C.text : C.bg, color: view === 'table' ? '#fff' : C.text }}
          onClick={() => setView('table')}>Tabla</button>
      </div>

      {view === 'pipeline' && (
        <div>
          {/* Kanban horizontal */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(180px, 1fr))', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {byStage.map(({ key, count }) => {
              const items = allLeads.filter(l => l.stage === key);
              return (
                <div key={key} style={{ minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '0 4px' }}>
                    <span style={{ ...SS.pipeLbl, fontSize: 10 }}>{STAGE_LABELS[key]}</span>
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>· {count}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.length === 0 ? (
                      <div style={{ padding: '14px 12px', background: '#fafafa', border: `1px dashed ${C.border}`, borderRadius: 10, fontSize: 12, color: C.muted, textAlign: 'center' }}>Vacío</div>
                    ) : items.map(l => (
                      <button key={l.id} onClick={() => setDrawerLead(l)}
                        style={{
                          textAlign: 'left' as const, background: C.card, border: `1px solid ${C.border}`,
                          borderTop: `3px solid ${STAGE_COLORS[key]}`,
                          borderRadius: 10, padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3, marginBottom: 4 }}>{l.empresa}</div>
                        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{l.nombre}{l.ciudad ? ` · ${l.ciudad}` : ''}</div>
                        {l.commission_est && (
                          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: C.green }}>{fmt(l.commission_est)}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ ...SS.note, marginTop: 24 }}>
            <strong>Tip:</strong> click en cualquier lead abre el detalle completo con histórico, fechas y notas. Tus comisiones se calculan automáticamente cuando un cliente paga.
          </div>
        </div>
      )}

      {view === 'table' && (
        <div>
          {/* Filtros */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setFilter(null)}
              style={{ ...SS.btnGhost, background: !filter ? C.text : C.bg, color: !filter ? '#fff' : C.text, fontSize: 12 }}>
              Todos · {allLeads.length}
            </button>
            {stages.map(s => {
              const cnt = byStage.find(b => b.key === s)?.count || 0;
              if (cnt === 0) return null;
              const active = filter === s;
              return (
                <button key={s} onClick={() => setFilter(s)}
                  style={{ ...SS.btnGhost, background: active ? STAGE_COLORS[s] : C.bg, color: active ? '#fff' : C.text, fontSize: 12 }}>
                  {STAGE_LABELS[s]} · {cnt}
                </button>
              );
            })}
          </div>

          {filteredLeads.length === 0 ? (
            <div style={SS.empty}>No hay leads en esta etapa.</div>
          ) : (
            <div style={SS.tableWrap}>
              <table style={SS.table}>
                <thead>
                  <tr>
                    <th style={SS.th}>Negocio</th>
                    <th style={SS.th}>Etapa</th>
                    <th style={SS.th}>Plan</th>
                    <th style={SS.th}>Llegó</th>
                    <th style={{ ...SS.th, textAlign: 'right' }}>Tu comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map(l => (
                    <tr key={l.id} onClick={() => setDrawerLead(l)} style={{ cursor: 'pointer' }}>
                      <td style={SS.td}>
                        <div style={{ fontWeight: 600 }}>{l.empresa}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{l.nombre}{l.ciudad ? ` · ${l.ciudad}` : ''}</div>
                      </td>
                      <td style={SS.td}>
                        <span style={stagePillStyle(STAGE_COLORS[l.stage] || C.muted)}>{STAGE_LABELS[l.stage]}</span>
                      </td>
                      <td style={SS.td}>{PLAN_LABELS[l.plan || ''] || (l.plan ? l.plan : '—')}</td>
                      <td style={SS.td}>{fmtRel(l.created_at)}</td>
                      <td style={{ ...SS.td, textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
                        {l.commission_est ? fmt(l.commission_est) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pagos liquidados (acordeón) */}
      <h2 style={SS.h2}>Pagos liquidados</h2>
      <button onClick={() => setPaymentsOpen(o => !o)}
        style={{ ...SS.card, width: '100%', textAlign: 'left' as const, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 26px' }}>
        <div>
          <div style={{ fontWeight: 600, color: C.text, fontSize: 15 }}>
            {(payments?.payments?.length || 0)} pagos · {fmt(totalPaid)} total
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            {payments?.payments?.[0]?.paid_at ? `Último pago: ${fmtDate(payments.payments[0].paid_at)}` : 'Sin pagos aún'}
          </div>
        </div>
        <span style={{ fontSize: 18, color: C.muted, transition: 'transform 0.2s', transform: paymentsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>

      {paymentsOpen && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(payments?.payments || []).map((p: any) => (
            <div key={p.payment_reference} style={SS.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ref · {p.payment_reference}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: C.text, marginTop: 6, letterSpacing: '-0.02em' }}>{fmt(p.total)}</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Liquidado {fmtDate(p.paid_at)}</div>
                </div>
                <span style={{ ...stagePillStyle(C.greenDark), padding: '6px 14px' }}>Pagado</span>
              </div>
              {p.items?.length > 1 && (
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.borderSoft}` }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Conceptos</div>
                  {p.items.map((it: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: C.textSoft }}>
                      <span>{it.nota || it.tipo}</span>
                      <span style={{ fontWeight: 600, color: C.text }}>{fmt(it.commission_amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {(payments?.payments?.length || 0) === 0 && (
            <div style={SS.empty}>Aún no hay pagos liquidados. Cuando un cliente pague su plan, su comisión aparecerá aquí.</div>
          )}
        </div>
      )}

      {/* Cómo se calcula */}
      <h2 style={SS.h2}>Cómo se calcula tu dinero</h2>
      <button onClick={() => setCalcOpen(o => !o)}
        style={{ ...SS.card, width: '100%', textAlign: 'left' as const, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 26px' }}>
        <div>
          <div style={{ fontWeight: 600, color: C.text, fontSize: 15 }}>Reglas del programa</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>50% comisión directa · 10% override Master Partner</div>
        </div>
        <span style={{ fontSize: 18, color: C.muted, transition: 'transform 0.2s', transform: calcOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>

      {calcOpen && (
        <div style={{ ...SS.card, marginTop: 14, fontSize: 14, color: C.textSoft, lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 14px' }}><strong style={{ color: C.text }}>Comisión directa:</strong> 50% del valor del plan en el primer mes que el cliente paga. Si el cliente sigue activo, generas comisión recurrente según las reglas de tu programa.</p>
          <p style={{ margin: '0 0 14px' }}><strong style={{ color: C.text }}>Override Master Partner:</strong> al alcanzar nivel 3, ganas 10% adicional de las ventas de partners en tu red.</p>
          <p style={{ margin: '0 0 14px' }}><strong style={{ color: C.text }}>Ciclo de pago:</strong> corte el día 1 del mes. Confirmas tu factura 1-3 días antes. Depósito a tu cuenta el día 1 del mes siguiente.</p>
          <div style={{ marginTop: 18, padding: '14px 18px', background: C.bg, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Tu cuenta de pago</div>
              <div style={{ fontWeight: 600, color: C.text }}>{payoutLabel}</div>
              {payout?.titular && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{payout.titular}</div>}
            </div>
            <button style={SS.btnGhost} onClick={() => {
              const e = new CustomEvent('open-profile-dropdown');
              window.dispatchEvent(e);
            }}>Actualizar →</button>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerLead && (
        <>
          <div style={SS.drawerBackdrop} onClick={() => setDrawerLead(null)} />
          <div style={SS.drawer}>
            <button onClick={() => setDrawerLead(null)} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 22, color: C.muted, padding: 8 }}>×</button>
            <span style={stagePillStyle(STAGE_COLORS[drawerLead.stage] || C.muted)}>{STAGE_LABELS[drawerLead.stage]}</span>
            <h2 style={{ ...SS.h1Small, margin: '14px 0 4px' }}>{drawerLead.empresa}</h2>
            <p style={{ fontSize: 14, color: C.muted, margin: '0 0 28px' }}>{drawerLead.nombre}{drawerLead.ciudad ? ` · ${drawerLead.ciudad}` : ''}</p>

            <DrawerRow label="Llegó" value={`${fmtRel(drawerLead.created_at)} (${fmtDate(drawerLead.created_at)})`} />
            {drawerLead.fuente && <DrawerRow label="Fuente" value={drawerLead.fuente} />}
            {drawerLead.plan && <DrawerRow label="Plan de interés" value={PLAN_LABELS[drawerLead.plan] || drawerLead.plan} />}
            {drawerLead.bookingFecha && <DrawerRow label="Demo" value={`${fmtDate(drawerLead.bookingFecha)} · ${new Date(drawerLead.bookingFecha) > new Date() ? 'Próxima' : 'Realizada'}`} />}
            {drawerLead.dealValor && <DrawerRow label="Valor de la venta" value={fmt(drawerLead.dealValor)} />}
            {drawerLead.commission_est && <DrawerRow label="Tu comisión estimada" value={fmt(drawerLead.commission_est)} accent={C.green} />}
            {drawerLead.dealClosedAt && <DrawerRow label="Cerrado el" value={fmtDate(drawerLead.dealClosedAt)} />}

            <h3 style={{ ...SS.h3, marginTop: 32 }}>Timeline</h3>
            <Timeline lead={drawerLead} />
          </div>
        </>
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

function DrawerRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${C.borderSoft}`, gap: 16, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 14, color: accent || C.text, fontWeight: accent ? 600 : 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Timeline({ lead }: { lead: LeadCard }) {
  const events: { date: string; label: string; type: string }[] = [];
  events.push({ date: lead.created_at, label: 'Llegó a tu link', type: 'lead' });
  if (lead.bookingFecha && new Date(lead.bookingFecha) < new Date()) {
    events.push({ date: lead.bookingFecha, label: 'Demo realizada', type: 'demo' });
  } else if (lead.bookingFecha) {
    events.push({ date: lead.bookingFecha, label: 'Demo agendada', type: 'booking' });
  }
  if (lead.dealClosedAt) events.push({ date: lead.dealClosedAt, label: 'Cliente firmó plan', type: 'sale' });
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div style={{ paddingLeft: 14, borderLeft: `2px solid ${C.border}` }}>
      {events.map((e, i) => (
        <div key={i} style={{ position: 'relative', padding: '4px 0 18px 16px' }}>
          <span style={{ position: 'absolute', left: -22, top: 6, width: 10, height: 10, borderRadius: '50%', background: C.accent, border: '2px solid #fff', boxShadow: `0 0 0 2px ${C.border}` }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{e.label}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{fmtDate(e.date)} · {fmtRel(e.date)}</div>
        </div>
      ))}
    </div>
  );
}
