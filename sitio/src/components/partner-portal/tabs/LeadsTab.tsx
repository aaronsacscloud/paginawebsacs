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
  const [certs, setCerts] = useState<any[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet('/api/partner-portal/leads', isDemoMode() ? demoLeads : undefined),
      apiGet<{ certifications: any[] }>('/api/partner-portal/certifications', isDemoMode() ? { certifications: [{ id: 'demos_consultoria_consciente', unlocked: false }] } : undefined),
    ]).then(([d, c]) => { setLeads(d); setCerts(c?.certifications || []); setLoading(false); });
  }, []);

  const tieneCertDemos = certs.some(c => c.id === 'demos_consultoria_consciente' && c.unlocked);

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

      {/* Agregar lead directo · solo visible con cert Demos Consciente */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 18, flexWrap: 'wrap' as const,
        background: tieneCertDemos ? C.brandSoft : C.bg,
        border: `1px solid ${tieneCertDemos ? C.brandTint : C.border}`,
        borderRadius: 14, padding: '20px 24px', marginTop: 28,
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Icon.Sparkle size={14} color={tieneCertDemos ? C.brand : C.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: tieneCertDemos ? C.brandDark : C.text }}>
              Captura tus propios leads directos
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            {tieneCertDemos
              ? 'Como certificado en Consultoría Consciente, puedes registrar leads que conociste en persona o por llamada — quedan atribuidos a ti automáticamente.'
              : 'Disponible al completar la certificación "Demos · Consultoría Consciente" ($3,500). Te enseña el método para hacer demos pro y desbloquea esta función.'}
          </div>
        </div>
        {tieneCertDemos ? (
          <button onClick={() => setAddOpen(true)} style={{ ...SS.btn, display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' as const }}>
            <Icon.Plus size={14} strokeWidth={2.2} /> Agregar lead directo
          </button>
        ) : (
          <button onClick={() => { window.location.hash = 'certs'; }}
            style={{ ...SS.btnGhost, display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' as const }}>
            Ver certificación <Icon.ArrowRight size={12} />
          </button>
        )}
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

      {/* Drawer: agregar lead directo */}
      {addOpen && <AddDirectLeadDrawer onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); alert('Lead directo agregado (demo) · aparecerá en tu pipeline en 24h.'); }} />}
    </div>
  );
}

function AddDirectLeadDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [giro, setGiro] = useState('moda');
  const [planInteres, setPlanInteres] = useState('fideliza');
  const [notas, setNotas] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!nombre.trim() || !empresa.trim()) { alert('Nombre y empresa son requeridos'); return; }
    if (!whatsapp.trim() && !email.trim()) { alert('Necesitas al menos WhatsApp o email'); return; }
    setSubmitting(true);
    // En demo no hay endpoint real — onSaved simula
    setTimeout(() => { setSubmitting(false); onSaved(); }, 700);
  }

  return (
    <>
      <div style={SS.drawerBackdrop} onClick={onClose} />
      <div style={SS.drawer}>
        <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 8 }}>
          <Icon.Close size={20} />
        </button>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: C.brandSoft, color: C.brand, borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 14 }}>
          <Icon.Sparkle size={12} /> Lead directo
        </div>
        <h2 style={SS.h1Small}>Agregar lead directo</h2>
        <p style={SS.leadSm}>Captura un prospecto que conociste tú mismo (videollamada, evento, referido). Queda atribuido a ti automáticamente, igual que los que vienen vía tu link.</p>

        <Field label="Nombre completo">
          <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} placeholder="Ej. Carlos Martínez" />
        </Field>
        <Field label="Empresa">
          <input value={empresa} onChange={e => setEmpresa(e.target.value)} style={inputStyle} placeholder="Boutique de Carlos" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="WhatsApp">
            <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} style={inputStyle} placeholder="+52 55 1234 5678" />
          </Field>
          <Field label="Email">
            <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="carlos@ejemplo.mx" type="email" />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Ciudad">
            <input value={ciudad} onChange={e => setCiudad(e.target.value)} style={inputStyle} placeholder="CDMX" />
          </Field>
          <Field label="Giro">
            <select value={giro} onChange={e => setGiro(e.target.value)} style={inputStyle}>
              <option value="moda">Moda y ropa</option>
              <option value="calzado">Calzado</option>
              <option value="accesorios">Accesorios / joyería</option>
              <option value="cosmeticos">Cosméticos y belleza</option>
              <option value="alimentos">Alimentos y gourmet</option>
              <option value="hogar">Hogar y decoración</option>
              <option value="deportes">Deportes</option>
              <option value="otro">Otro</option>
            </select>
          </Field>
        </div>
        <Field label="Plan de interés">
          <select value={planInteres} onChange={e => setPlanInteres(e.target.value)} style={inputStyle}>
            <option value="control">Plan Control</option>
            <option value="fideliza">Plan Fideliza</option>
            <option value="fideliza_plus">Plan Fideliza Plus</option>
          </select>
        </Field>
        <Field label="Notas de la demo (opcional)">
          <textarea rows={3} value={notas} onChange={e => setNotas(e.target.value)} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="Hablamos de... le interesa principalmente..." />
        </Field>

        <div style={{ ...SS.note, marginTop: 14, marginBottom: 18, fontSize: 12 }}>
          El lead queda atribuido a ti como Lead directo. Si firma plan en los próximos 90 días, generas tu comisión normal del 50%.
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={submit} disabled={submitting} style={{ ...SS.btn, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Guardando…' : 'Agregar lead'}
          </button>
          <button onClick={onClose} style={SS.btnGhost}>Cancelar</button>
        </div>
      </div>
    </>
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

function FilterChip({ active, label, onClick, color }: { active: boolean; label: string; onClick: () => void; color?: string }) {
  const accent = color || C.brand;
  return (
    <button onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        border: `1px solid ${active ? accent : C.border}`,
        background: active ? accent : '#fff',
        color: active ? '#fff' : C.text,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        letterSpacing: '-0.005em',
        transition: 'background 0.15s, border-color 0.15s',
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
