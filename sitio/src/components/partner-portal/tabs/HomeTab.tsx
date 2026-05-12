import { useEffect, useState } from 'react';
import { fmt, fmtNum, fmtRel, isDemoMode, apiGet, STAGE_LABELS, copyToClipboard } from './utils';
import { SS, C } from './styles';
import {
  demoSummary, demoLeads, demoLinkStats, demoContent, demoActivity, demoProfile, demoLevel,
} from '../../../data/partner-portal-demo';

type Props = {
  user: { id: string; nombre: string; email: string };
  go: (tab: 'home' | 'dinero' | 'compartir' | 'nivel') => void;
};

export default function HomeTab({ user, go }: Props) {
  const [summary, setSummary] = useState<any>(null);
  const [leads, setLeads] = useState<any>(null);
  const [linkStats, setLinkStats] = useState<any>(null);
  const [content, setContent] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet('/api/partner-portal/summary', isDemoMode() ? demoSummary : undefined),
      apiGet('/api/partner-portal/leads', isDemoMode() ? demoLeads : undefined),
      apiGet('/api/partner-portal/link-stats', isDemoMode() ? demoLinkStats : undefined),
      apiGet('/api/partner-portal/content', isDemoMode() ? demoContent : undefined),
      apiGet('/api/partner-portal/profile', isDemoMode() ? demoProfile : undefined),
    ]).then(([s, l, ls, c, p]) => {
      setSummary(s); setLeads(l); setLinkStats(ls); setContent(c); setProfile(p);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={SS.loading}>Cargando…</div>;
  if (!summary) return <div style={{ ...SS.loading, color: C.red }}>No se pudo cargar tu portal</div>;

  const nombre = (user.nombre || summary.user?.nombre || '').split(' ')[0] || 'partner';
  const isEmpty = (leads?.contacts?.length || 0) === 0 && (summary.proximoPago || 0) === 0;
  const partnerUrl = profile?.partnerLandingUrl || `https://www.sacscloud.com/p/${(summary.user?.nombre || 'tu-link').toLowerCase().split(' ')[0]}`;

  // Pipeline counts
  const contacts = leads?.contacts || [];
  const bookings = leads?.bookings || [];
  const deals = leads?.deals || [];

  const stage = {
    nuevos:     contacts.filter((c: any) => !c.lifecycle_stage || c.lifecycle_stage === 'lead').length,
    prueba:     contacts.filter((c: any) => c.lifecycle_stage === 'prueba_gratis').length,
    demoAg:     bookings.filter((b: any) => b.estado === 'agendada' || b.estado === 'confirmada').length,
    demoReal:   bookings.filter((b: any) => b.estado === 'realizada').length - deals.filter((d: any) => d.stage === 'won').length,
    clientes:   deals.filter((d: any) => d.stage === 'won' || d.stage === 'pending_payment').length,
  };

  // Próxima demo agendada
  const proximaDemo = bookings
    .filter((b: any) => (b.estado === 'agendada' || b.estado === 'confirmada') && new Date(b.fecha).getTime() > Date.now() - 86400000)
    .sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())[0];

  // Total generado año
  const totalAno = summary.totalAno || 0;
  const proximoPago = summary.proximoPago || 0;
  const ventasAno = deals.filter((d: any) => d.stage === 'won').length;

  // Puntos del mes
  const puntos = content?.summary?.puntos_mes ?? 0;
  const puntosMeta = content?.summary?.meta ?? 100;
  const puntosPct = content?.summary?.progreso_pct ?? 0;
  const diasRestantes = content?.summary?.days_remaining ?? 0;

  // Recent activity
  const recentItems = isDemoMode() ? demoActivity : buildRealActivity(deals, bookings, contacts);

  // Link stats compactas
  const visits = linkStats?.total ?? 0;
  const uniqueV = linkStats?.unique ?? 0;
  const linkLeads = contacts.length;
  const cr = visits > 0 ? ((linkLeads / visits) * 100).toFixed(1) : '0';

  // Nivel actual
  const niveles = isDemoMode() ? demoLevel : guessLevel(deals, content);

  return (
    <div>
      {/* Hero saludo */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={SS.h1}>Hola, {nombre}</h1>
        {isEmpty ? (
          <p style={SS.lead}>Tu portal está listo — comparte tu link único para empezar a generar comisiones.</p>
        ) : (
          <p style={SS.lead}>
            Llevas <strong style={{ color: C.text, fontWeight: 600 }}>{fmt(totalAno)}</strong> generado este año.
            {proximoPago > 0 && <> Tu próximo pago es de <strong style={{ color: C.green, fontWeight: 600 }}>{fmt(proximoPago)}</strong>.</>}
          </p>
        )}
      </div>

      {isEmpty && (
        <div style={SS.emptyHint}>
          <strong>Tu portal está listo, pero todavía no hay actividad.</strong>
          <span> Comparte tu link único en redes — cada activación genera una comisión que verás aquí en tiempo real.</span>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => go('compartir')} style={SS.btn}>Obtener mi link →</button>
            <button onClick={() => copyToClipboard(partnerUrl)} style={SS.btnGhost}>Copiar link</button>
          </div>
        </div>
      )}

      {/* 4 hero stats */}
      <div style={SS.statGrid}>
        <StatCard
          label="Próximo pago"
          value={fmt(proximoPago)}
          hint={proximoPago > 0 ? 'Se deposita el día 1' : 'Aún no hay confirmadas'}
          accent={C.green}
          ctaLabel="Ver desglose →"
          onCta={() => go('dinero')}
        />
        <StatCard
          label="Total año"
          value={fmt(totalAno)}
          hint={`${ventasAno} ${ventasAno === 1 ? 'venta cerrada' : 'ventas cerradas'}`}
          accent={C.accent}
          ctaLabel="Histórico →"
          onCta={() => go('dinero')}
        />
        <StatCard
          label="Mi nivel"
          value={`Lvl ${niveles.current}`}
          hint={niveles.nombre}
          accent={niveles.current >= 3 ? C.gold : niveles.current >= 2 ? C.green : C.muted}
          ctaLabel="Ver progreso →"
          onCta={() => go('nivel')}
        />
        <StatCard
          label="Puntos del mes"
          value={`${puntos} / ${puntosMeta}`}
          hint={diasRestantes > 0 ? `${diasRestantes} días restantes` : 'Cierre del mes'}
          accent={C.purple}
          ctaLabel="Reportar actividad →"
          onCta={() => go('nivel')}
          progress={Math.min(100, puntosPct)}
        />
      </div>

      {/* Tu link inline */}
      <h2 style={SS.h2}>Tu link único</h2>
      <div style={SS.linkBig}>
        <div style={SS.linkUrl}>{partnerUrl}</div>
        <div style={SS.linkActions}>
          <button style={SS.btnDark} onClick={async () => {
            const ok = await copyToClipboard(partnerUrl);
            if (ok) alert('Link copiado');
          }}>🔗 Copiar</button>
          <a style={{ ...SS.btnDark, textDecoration: 'none', display: 'inline-block' }}
            href={`https://wa.me/?text=${encodeURIComponent(`Te paso info sobre SACS, el sistema con el que llevo mi negocio: ${partnerUrl}`)}`}
            target="_blank" rel="noopener">📱 WhatsApp</a>
          <a style={{ ...SS.btnDark, textDecoration: 'none', display: 'inline-block' }}
            href={`mailto:?subject=${encodeURIComponent('Una herramienta que te va a interesar')}&body=${encodeURIComponent(`Llevo un tiempo usando SACS para mi negocio y me ha funcionado muy bien. Te paso el link: ${partnerUrl}`)}`}>✉️ Email</a>
          <button style={SS.btnDark} onClick={() => go('compartir')}>Más opciones →</button>
        </div>
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexWrap: 'wrap', gap: 24, fontSize: 13, color: 'rgba(255,255,255,0.72)' }}>
          <span><strong style={{ color: '#fff', fontWeight: 600 }}>{fmtNum(visits)}</strong> visitas</span>
          <span><strong style={{ color: '#fff', fontWeight: 600 }}>{fmtNum(uniqueV)}</strong> únicos</span>
          <span><strong style={{ color: '#fff', fontWeight: 600 }}>{fmtNum(linkLeads)}</strong> leads</span>
          <span><strong style={{ color: '#fff', fontWeight: 600 }}>{cr}%</strong> conversión</span>
        </div>
      </div>

      {/* Pipeline activo */}
      <h2 style={SS.h2}>Pipeline activo</h2>
      <div style={SS.pipeRow}>
        <PipelineCard icon="🆕" num={stage.nuevos} label="Nuevos" sub={stage.nuevos > 0 ? 'Sin contactar' : 'Llegan via tu link'} onClick={() => go('dinero')} />
        <PipelineCard icon="🎁" num={stage.prueba} label="Prueba activa" sub={stage.prueba > 0 ? 'En período de 14 días' : 'Aún ninguno'} onClick={() => go('dinero')} />
        <PipelineCard icon="📞" num={stage.demoAg} label="Demo agendada" sub={proximaDemo ? `Próx: ${proximaDemo.invitee_nombre?.split(' ')[0] || 'cliente'}` : 'Por agendar'} onClick={() => go('dinero')} />
        <PipelineCard icon="🤝" num={Math.max(0, stage.demoReal)} label="Demo realizada" sub="Esperando propuesta" onClick={() => go('dinero')} />
        <PipelineCard icon="✅" num={stage.clientes} label="Clientes" sub={totalAno > 0 ? `${fmt(totalAno)} generado` : '$0 aún'} onClick={() => go('dinero')} />
      </div>

      {/* Recent activity */}
      {recentItems.length > 0 && (
        <>
          <h2 style={SS.h2}>Últimos movimientos</h2>
          <div style={SS.card}>
            {recentItems.slice(0, 5).map((a, i) => (
              <div key={i} style={{ ...SS.feedItem, ...(i === recentItems.length - 1 ? { borderBottom: 'none' } : {}) }}>
                <span style={{ ...SS.feedDot, background: activityColor(a.type) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={SS.feedText}>{a.text}</div>
                  {a.detail && <div style={SS.feedDetail}>{a.detail}</div>}
                </div>
                <span style={SS.feedWhen}>{fmtRel(a.when)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Stat Card ───
function StatCard({ label, value, hint, accent, ctaLabel, onCta, progress }: {
  label: string; value: string; hint?: string; accent: string;
  ctaLabel?: string; onCta?: () => void; progress?: number;
}) {
  return (
    <div style={SS.statCard}>
      <span style={{ position: 'absolute', top: 24, right: 24, width: 6, height: 6, borderRadius: '50%', background: accent }} />
      <div style={SS.statLabel}>{label}</div>
      <div style={SS.statValue}>{value}</div>
      {hint && <div style={SS.statHint}>{hint}</div>}
      {progress !== undefined && (
        <div style={{ ...SS.bar, marginTop: 12, height: 6 }}>
          <div style={{ ...SS.barFill, width: `${progress}%` }} />
        </div>
      )}
      {ctaLabel && onCta && (
        <button style={SS.statCta} onClick={onCta}>{ctaLabel}</button>
      )}
    </div>
  );
}

// ─── Pipeline Card ───
function PipelineCard({ icon, num, label, sub, onClick }: {
  icon: string; num: number; label: string; sub: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{ ...SS.pipeCard, textAlign: 'left' as const, fontFamily: 'inherit' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 18px -10px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}>
      <span style={SS.pipeIcon}>{icon}</span>
      <div style={SS.pipeNum}>{num}</div>
      <div style={SS.pipeLbl}>{label}</div>
      <div style={SS.pipeSub}>{sub}</div>
    </button>
  );
}

// ─── Helpers ───
function activityColor(type?: string): string {
  switch (type) {
    case 'sale':    return C.green;
    case 'booking': return C.accent;
    case 'trial':   return C.amber;
    case 'demo':    return C.purple;
    default:        return C.muted;
  }
}

function buildRealActivity(deals: any[], bookings: any[], contacts: any[]): Array<{ when: string; type: string; text: string; detail?: string }> {
  const out: Array<{ when: string; type: string; text: string; detail?: string }> = [];
  for (const d of deals.slice(0, 5)) {
    if (d.closed_at) out.push({ when: d.closed_at, type: 'sale', text: `${d.nombre || 'Cliente'} firmó contrato`, detail: d.valor_total ? `${fmt(d.valor_total)} — Plan cerrado` : 'Plan cerrado' });
  }
  for (const b of bookings.slice(0, 5)) {
    out.push({
      when: b.created_at || b.fecha,
      type: 'booking',
      text: `${b.invitee_nombre || 'Lead'} agendó demo`,
      detail: b.fecha ? `${new Date(b.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} · ${b.hora_inicio || ''}` : undefined,
    });
  }
  for (const c of contacts.slice(0, 5)) {
    out.push({
      when: c.created_at,
      type: 'trial',
      text: `${c.nombre || 'Nuevo lead'} llegó vía tu link`,
      detail: c.fuente ? `Fuente: ${c.fuente}` : undefined,
    });
  }
  return out.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime()).slice(0, 5);
}

function guessLevel(deals: any[], content: any): { current: number; nombre: string } {
  const ventasAno = deals.filter(d => d.stage === 'won').length;
  if (ventasAno >= 10) return { current: 3, nombre: 'Master Partner Nv 1' };
  if (ventasAno >= 1) return { current: 2, nombre: 'Partner Certificado' };
  return { current: 1, nombre: 'Partner Referidor' };
}
