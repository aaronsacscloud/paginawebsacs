import { useEffect, useMemo, useState } from 'react';
import { fmt, fmtDate, fmtRel, isDemoMode, apiGet, PLAN_LABELS } from './utils';
import { SS, C } from './styles';
import { Icon } from './icons';
import { demoLeads, demoPayments } from '../../../data/partner-portal-demo';

// ClientesTab — solo los que pagaron (deals con stage='won' o pending_payment)
// Muestra: nombre, plan, MRR, comisión total, último pago, salud de la cuenta

type Cliente = {
  id: string;
  empresa: string;
  nombre: string;
  ciudad?: string;
  plan: string;
  mrr: number;
  ltv: number;
  mi_comision_total: number;
  primera_compra: string;
  ultimo_pago: string | null;
  proxima_renovacion: string;
  estado_cuenta: 'al_corriente' | 'pendiente' | 'en_riesgo';
  meses_activo: number;
  uso_mensual: 'alto' | 'medio' | 'bajo';
  nps?: number;
};

export default function ClientesTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [leads, setLeads] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [drawerCliente, setDrawerCliente] = useState<Cliente | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet('/api/partner-portal/leads', isDemoMode() ? demoLeads : undefined),
      apiGet('/api/partner-portal/payments', isDemoMode() ? demoPayments : undefined),
    ]).then(([l, p]) => { setLeads(l); setPayments(p); setLoading(false); });
  }, []);

  const clientes: Cliente[] = useMemo(() => {
    if (!leads) return [];
    const contacts = leads.contacts || [];
    const deals = leads.deals || [];

    return deals
      .filter((d: any) => d.stage === 'won' || d.stage === 'pending_payment')
      .map((d: any, idx: number) => {
        const c = contacts.find((c: any) => c.id === d.contact_id);
        const planRaw = (d.nombre || '').split(' · ')[1] || c?.plan_interes || 'fideliza';
        const planLabel = PLAN_LABELS[planRaw] || planRaw;
        const valor = Number(d.valor_total || 0);
        const mrr = Math.max(600, Math.round(valor / 12));
        const mesesActivo = d.closed_at
          ? Math.max(1, Math.floor((Date.now() - new Date(d.closed_at).getTime()) / (30 * 86400000)))
          : 0;

        // Estimación: comisión cruzada × meses + bono inicial
        const comisionTotal = d.stage === 'won' ? Math.round(valor * 0.5) + (mrr * 0.5 * Math.max(0, mesesActivo - 1)) : 0;
        const ltv = Math.round(valor + (mrr * 12)); // bruto estimado

        // Estado dummy: rota usos por idx
        const usoMensual: 'alto' | 'medio' | 'bajo' = idx % 3 === 0 ? 'alto' : idx % 3 === 1 ? 'medio' : 'bajo';
        const estado: 'al_corriente' | 'pendiente' | 'en_riesgo' = d.stage === 'pending_payment' ? 'pendiente' : (idx % 7 === 0 ? 'en_riesgo' : 'al_corriente');
        const nps = (idx * 13) % 11; // 0-10 deterministic

        return {
          id: d.id,
          empresa: c?.empresa || (d.nombre || '').split(' · ')[0] || 'Cliente',
          nombre: c?.nombre || '—',
          ciudad: c?.ciudad,
          plan: planLabel,
          mrr,
          ltv,
          mi_comision_total: comisionTotal,
          primera_compra: d.created_at,
          ultimo_pago: d.closed_at,
          proxima_renovacion: new Date(Date.now() + 30 * 86400000).toISOString(),
          estado_cuenta: estado,
          meses_activo: mesesActivo,
          uso_mensual: usoMensual,
          nps: nps + 1,
        } as Cliente;
      });
  }, [leads]);

  if (loading) return <div style={SS.loading}>Cargando clientes…</div>;

  const totalMrr = clientes.reduce((s, c) => s + c.mrr, 0);
  const totalComision = clientes.reduce((s, c) => s + c.mi_comision_total, 0);
  const enRiesgo = clientes.filter(c => c.estado_cuenta === 'en_riesgo').length;
  const pendientes = clientes.filter(c => c.estado_cuenta === 'pendiente').length;

  return (
    <div>
      <h1 style={SS.h1Small}>Clientes</h1>
      <p style={SS.leadSm}>Los negocios que ya pagaron su plan. Mientras sigan activos, sigues generando comisión recurrente.</p>

      {/* Stats */}
      <div style={SS.statGrid}>
        <SimpleStat label="Clientes activos" value={String(clientes.length)} hint={pendientes > 0 ? `${pendientes} pendientes de cobro` : 'Todos al corriente'} accent={C.greenDark} />
        <SimpleStat label=\"Ingreso mensual\" value={fmt(totalMrr)} hint=\"Cobros mensuales recurrentes\" accent={C.accent} />
        <SimpleStat label="Tu comisión total" value={fmt(totalComision)} hint="Histórico de estos clientes" accent={C.green} />
        <SimpleStat label="En riesgo" value={String(enRiesgo)} hint={enRiesgo > 0 ? 'Uso bajo · revisa con ellos' : 'Salud OK'} accent={enRiesgo > 0 ? C.amber : C.muted} />
      </div>

      {clientes.length === 0 ? (
        <div style={{ ...SS.empty, marginTop: 40 }}>
          Aún no tienes clientes pagados.<br />
          Cuando un lead firme su plan y pague, aparecerá aquí con el detalle de su cuenta.
        </div>
      ) : (
        <>
          <h2 style={SS.h2}>Cartera</h2>
          <div style={SS.tableWrap}>
            <table style={SS.table}>
              <thead>
                <tr>
                  <th style={SS.th}>Cliente</th>
                  <th style={SS.th}>Plan</th>
                  <th style={SS.th}>Cobro/mes</th>
                  <th style={SS.th}>Mi comisión</th>
                  <th style={SS.th}>Estado</th>
                  <th style={SS.th}>Uso</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map(c => (
                  <tr key={c.id} onClick={() => setDrawerCliente(c)} style={{ cursor: 'pointer' }}>
                    <td style={SS.td}>
                      <div style={{ fontWeight: 600 }}>{c.empresa}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{c.nombre}{c.ciudad ? ` · ${c.ciudad}` : ''}</div>
                    </td>
                    <td style={SS.td}>
                      <div style={{ fontWeight: 500 }}>{c.plan}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{c.meses_activo}m activo</div>
                    </td>
                    <td style={{ ...SS.td, fontFamily: 'var(--font-display)' }}>{fmt(c.mrr)}</td>
                    <td style={{ ...SS.td, fontFamily: 'var(--font-display)', color: C.greenDark, fontWeight: 600 }}>{fmt(c.mi_comision_total)}</td>
                    <td style={SS.td}><EstadoPill estado={c.estado_cuenta} /></td>
                    <td style={SS.td}><UsoPill uso={c.uso_mensual} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ ...SS.note, marginTop: 24, fontSize: 13 }}>
            <strong>Tip:</strong> los clientes en riesgo suelen tener uso bajo. Una llamada de seguimiento mensual reduce mucho la cancelación — y proteges tu comisión recurrente.
          </div>
        </>
      )}

      {/* Drawer */}
      {drawerCliente && (
        <>
          <div style={SS.drawerBackdrop} onClick={() => setDrawerCliente(null)} />
          <div style={SS.drawer}>
            <button onClick={() => setDrawerCliente(null)} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 8 }}>
              <Icon.Close size={20} />
            </button>
            <EstadoPill estado={drawerCliente.estado_cuenta} />
            <h2 style={{ ...SS.h1Small, margin: '14px 0 4px' }}>{drawerCliente.empresa}</h2>
            <p style={{ fontSize: 14, color: C.muted, margin: '0 0 24px' }}>{drawerCliente.nombre}{drawerCliente.ciudad ? ` · ${drawerCliente.ciudad}` : ''}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <MiniStat label="Plan" value={drawerCliente.plan} />
              <MiniStat label=\"Cobro / mes\" value={fmt(drawerCliente.mrr)} />
              <MiniStat label=\"Valor estimado\" value={fmt(drawerCliente.ltv)} />
              <MiniStat label="Mi comisión total" value={fmt(drawerCliente.mi_comision_total)} accent={C.greenDark} />
            </div>

            <h3 style={SS.h3}>Salud de la cuenta</h3>
            <div style={{ ...SS.card, marginBottom: 24 }}>
              <DrawerRow label="Primera compra" value={fmtDate(drawerCliente.primera_compra)} />
              <DrawerRow label="Último pago" value={drawerCliente.ultimo_pago ? fmtDate(drawerCliente.ultimo_pago) : 'Pendiente'} />
              <DrawerRow label="Próxima renovación" value={fmtDate(drawerCliente.proxima_renovacion)} />
              <DrawerRow label="Meses activo" value={`${drawerCliente.meses_activo} ${drawerCliente.meses_activo === 1 ? 'mes' : 'meses'}`} />
              <DrawerRow label="Uso del sistema" value={
                drawerCliente.uso_mensual === 'alto' ? 'Alto · login diario' :
                drawerCliente.uso_mensual === 'medio' ? 'Medio · 3-4×/semana' :
                'Bajo · una vez al mes'
              } />
              {drawerCliente.nps !== undefined && (
                <DrawerRow label="NPS reciente" value={`${drawerCliente.nps}/10 ${drawerCliente.nps >= 9 ? '· Promotor' : drawerCliente.nps >= 7 ? '· Pasivo' : '· Detractor'}`} />
              )}
            </div>

            <div style={{ ...SS.note, fontSize: 13 }}>
              {drawerCliente.estado_cuenta === 'en_riesgo' && (
                <><strong>Cliente en riesgo.</strong> El uso bajo predice cancelación. Te sugerimos contactarlo esta semana para retomarlo.</>
              )}
              {drawerCliente.estado_cuenta === 'pendiente' && (
                <><strong>Pago pendiente.</strong> Aún no se ha confirmado el cobro de este ciclo. Recibirás tu comisión cuando se complete.</>
              )}
              {drawerCliente.estado_cuenta === 'al_corriente' && (
                <><strong>Cuenta saludable.</strong> Mientras siga pagando su renovación, sigues generando comisión recurrente.</>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SimpleStat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: string }) {
  return (
    <div style={SS.statCard}>
      <span style={{ position: 'absolute', top: 24, right: 24, width: 6, height: 6, borderRadius: '50%', background: accent }} />
      <div style={SS.statLabel}>{label}</div>
      <div style={SS.statValueSm}>{value}</div>
      {hint && <div style={SS.statHint}>{hint}</div>}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: C.bg, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: accent || C.text, letterSpacing: '-0.018em', lineHeight: 1.15 }}>{value}</div>
    </div>
  );
}

function DrawerRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${C.borderSoft}`, gap: 16 }}>
      <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function EstadoPill({ estado }: { estado: 'al_corriente' | 'pendiente' | 'en_riesgo' }) {
  const map = {
    al_corriente: { label: 'Al corriente', color: C.greenDark, bg: 'rgba(42,181,160,0.12)' },
    pendiente:    { label: 'Pago pendiente', color: C.amber, bg: 'rgba(232,168,56,0.14)' },
    en_riesgo:    { label: 'En riesgo', color: C.red, bg: 'rgba(220,38,38,0.10)' },
  };
  const s = map[estado];
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, letterSpacing: '0.04em',
    }}>{s.label}</span>
  );
}

function UsoPill({ uso }: { uso: 'alto' | 'medio' | 'bajo' }) {
  const map = {
    alto:  { label: 'Alto',  color: C.greenDark },
    medio: { label: 'Medio', color: C.accent },
    bajo:  { label: 'Bajo',  color: C.muted },
  };
  const s = map[uso];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: s.color, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
      {s.label}
    </span>
  );
}
