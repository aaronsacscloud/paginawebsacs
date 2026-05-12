import { useEffect, useMemo, useState } from 'react';
import { fmt, fmtDate, fmtRel, isDemoMode, apiGet, STAGE_LABELS, STAGE_COLORS, PLAN_LABELS } from './utils';
import { SS, C, stagePillStyle } from './styles';
import { Icon } from './icons';
import { demoLeads, demoProfile } from '../../../data/partner-portal-demo';

// LeadsTab — solo pipeline pre-cliente (excluye pagados, esos viven en ClientesTab)

type Lead = {
  id: string;
  nombre: string;
  empresa: string;
  ciudad?: string;
  fuente?: string;
  plan?: string;
  stage: string;
  commission_est?: number | null;
  created_at: string;
  bookingFecha?: string | null;
};

export default function LeadsTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [leads, setLeads] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    apiGet('/api/partner-portal/leads', isDemoMode() ? demoLeads : undefined)
      .then((d) => { setLeads(d); setLoading(false); });
  }, []);

  const allLeads: Lead[] = useMemo(() => {
    if (!leads) return [];
    const contacts = leads.contacts || [];
    const bookings = leads.bookings || [];
    const deals    = leads.deals    || [];

    return contacts
      .map((c: any) => {
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
        return {
          id: c.id,
          nombre: c.nombre || 'Sin nombre',
          empresa: c.empresa || '—',
          ciudad: c.ciudad || undefined,
          fuente: c.fuente || undefined,
          plan: c.plan_interes || undefined,
          stage,
          commission_est: null,
          created_at: c.created_at,
          bookingFecha: bk?.fecha || null,
        } as Lead;
      })
      // Excluir pagados — esos van a ClientesTab
      .filter((l: Lead) => l.stage !== 'pagado' && l.stage !== 'cliente');
  }, [leads]);

  if (loading) return <div style={SS.loading}>Cargando leads…</div>;

  const preStages = ['lead', 'prueba_gratis', 'demo_agendada', 'demo_realizada'];
  const byStage = preStages.map(s => ({ key: s, count: allLeads.filter(l => l.stage === s).length }));
  const filteredLeads = filter ? allLeads.filter(l => l.stage === filter) : allLeads;

  // Próxima demo agendada
  const proximaDemo = allLeads
    .filter(l => l.stage === 'demo_agendada' && l.bookingFecha && new Date(l.bookingFecha).getTime() > Date.now() - 86400000)
    .sort((a, b) => new Date(a.bookingFecha!).getTime() - new Date(b.bookingFecha!).getTime())[0];

  return (
    <div>
      <h1 style={SS.h1Small}>Leads</h1>
      <p style={SS.leadSm}>Todos los prospectos atribuidos a tu link que aún no han pagado.</p>

      {/* Stats */}
      <div style={SS.statGrid}>
        <SimpleStat label="Total en pipeline" value={String(allLeads.length)} hint={`${preStages.length} etapas`} accent={C.accent} />
        <SimpleStat label="Activos en prueba" value={String(allLeads.filter(l => l.stage === 'prueba_gratis').length)} hint="Día 1–14 de evaluación" accent={C.amber} />
        <SimpleStat label="Demos agendadas" value={String(allLeads.filter(l => l.stage === 'demo_agendada').length)} hint={proximaDemo ? `Próx: ${fmtRel(proximaDemo.bookingFecha)}` : 'Sin demos próximas'} accent={C.purple} />
        <SimpleStat label="En propuesta" value={String(allLeads.filter(l => l.stage === 'demo_realizada').length)} hint="Esperando cierre" accent={C.greenDark} />
      </div>

      {/* Filtros */}
      <h2 style={SS.h2}>Pipeline</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        <FilterChip active={!filter} onClick={() => setFilter(null)} label={`Todos · ${allLeads.length}`} />
        {byStage.map(({ key, count }) => count > 0 && (
          <FilterChip key={key} active={filter === key} onClick={() => setFilter(key)} label={`${STAGE_LABELS[key]} · ${count}`} color={STAGE_COLORS[key]} />
        ))}
      </div>

      {filteredLeads.length === 0 ? (
        <div style={SS.empty}>
          {allLeads.length === 0
            ? 'Aún no hay leads atribuidos. Comparte tu link en redes para empezar.'
            : 'No hay leads en esta etapa.'}
        </div>
      ) : (
        <div style={SS.tableWrap}>
          <table style={SS.table}>
            <thead>
              <tr>
                <th style={SS.th}>Negocio</th>
                <th style={SS.th}>Etapa</th>
                <th style={SS.th}>Plan de interés</th>
                <th style={SS.th}>Fuente</th>
                <th style={SS.th}>Llegó</th>
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
                  <td style={SS.td}>{l.fuente ? capitalize(l.fuente) : '—'}</td>
                  <td style={SS.td}>{fmtRel(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer detalle */}
      {drawerLead && (
        <>
          <div style={SS.drawerBackdrop} onClick={() => setDrawerLead(null)} />
          <div style={SS.drawer}>
            <button onClick={() => setDrawerLead(null)} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 8 }}>
              <Icon.Close size={20} />
            </button>
            <span style={stagePillStyle(STAGE_COLORS[drawerLead.stage] || C.muted)}>{STAGE_LABELS[drawerLead.stage]}</span>
            <h2 style={{ ...SS.h1Small, margin: '14px 0 4px' }}>{drawerLead.empresa}</h2>
            <p style={{ fontSize: 14, color: C.muted, margin: '0 0 28px' }}>{drawerLead.nombre}{drawerLead.ciudad ? ` · ${drawerLead.ciudad}` : ''}</p>

            <DrawerRow label="Llegó" value={`${fmtRel(drawerLead.created_at)} (${fmtDate(drawerLead.created_at)})`} />
            {drawerLead.fuente && <DrawerRow label="Fuente" value={capitalize(drawerLead.fuente)} />}
            {drawerLead.plan && <DrawerRow label="Plan de interés" value={PLAN_LABELS[drawerLead.plan] || drawerLead.plan} />}
            {drawerLead.bookingFecha && (
              <DrawerRow label="Demo" value={`${fmtDate(drawerLead.bookingFecha)} · ${new Date(drawerLead.bookingFecha) > new Date() ? 'Próxima' : 'Realizada'}`} />
            )}

            <div style={{ ...SS.note, marginTop: 24, fontSize: 13 }}>
              Mientras este lead siga en pipeline, sigue siendo tuyo. Si necesitas ayuda para cerrarlo, escríbenos a partners@sacscloud.com.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({ active, label, onClick, color }: { active: boolean; label: string; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        border: `1px solid ${active ? (color || C.text) : C.border}`,
        background: active ? (color || C.text) : '#fff',
        color: active ? '#fff' : C.text,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        letterSpacing: '-0.005em',
      }}>{label}</button>
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

function DrawerRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${C.borderSoft}`, gap: 16, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 14, color: C.text, fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
