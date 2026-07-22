import { useEffect, useState } from 'react';
import { fmt, fmtNum, fmtRel, isDemoMode, apiGet, STAGE_LABELS, copyToClipboard, isDealWon } from './utils';
import { SS, C } from './styles';
import { Icon } from './icons';
import { ensurePushSubscription, checkPushStatus, sendTestPush } from './PWAManager';
import { FIL_TIERS, extraPorPuntos } from '../../../data/filantropia';
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

  // Stages: contar leads únicos por stage final, no doble-contar.
  // Orden de prioridad: deal_ganado > demo_realizada > demo_agendada > prueba > nuevo.
  // OJO: un deal se crea al agendar demo con stage='demo_agendada' — no es cliente
  // hasta que isDealWon(deal) sea true (stage='cerrada_ganada' o closed_at).
  const stage = (() => {
    const dealsByContact: Record<string, any> = {};
    for (const d of deals) if (d.contact_id) dealsByContact[d.contact_id] = d;
    const bookingsByContact: Record<string, any> = {};
    for (const b of bookings) if (b.contact_id) bookingsByContact[b.contact_id] = b;

    let nuevos = 0, prueba = 0, demoAg = 0, demoReal = 0, clientes = 0;
    for (const c of contacts) {
      const dl = dealsByContact[c.id];
      const bk = bookingsByContact[c.id];

      if (dl && isDealWon(dl)) {
        clientes++;
      } else if (bk?.estado === 'realizada' || dl?.stage === 'demo_realizada') {
        demoReal++;
      } else if (
        bk?.estado === 'confirmada' || bk?.estado === 'agendada' ||
        dl?.stage === 'demo_agendada'
      ) {
        demoAg++;
      } else if (c.lifecycle_stage === 'prueba_gratis') {
        prueba++;
      } else {
        nuevos++;
      }
    }
    return { nuevos, prueba, demoAg, demoReal, clientes };
  })();

  // Próxima demo agendada
  const proximaDemo = bookings
    .filter((b: any) => (b.estado === 'agendada' || b.estado === 'confirmada') && new Date(b.fecha).getTime() > Date.now() - 86400000)
    .sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())[0];

  const proximaDemoLabel = (() => {
    if (!proximaDemo?.fecha) return null;
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const [y, mo, d] = proximaDemo.fecha.split('-').map(Number);
    const fecha = `${d} ${months[mo - 1]}`;
    if (!proximaDemo.hora_inicio) return fecha;
    const [h, m] = proximaDemo.hora_inicio.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${fecha} · ${h12}:${String(m).padStart(2, '0')}${ampm}`;
  })();

  // Total generado año
  const totalAno = summary.totalAno || 0;
  const proximoPago = summary.proximoPago || 0;
  const ventasAno = deals.filter((d: any) => isDealWon(d)).length;

  // Puntos del mes
  const puntos = content?.summary?.puntos_mes ?? 0;
  const puntosMeta = content?.summary?.meta ?? 100;
  const puntosPct = content?.summary?.progreso_pct ?? 0;
  // Partner de cobro: sin meta — la card muestra la racha filantrópica
  const esDeCobro = !!content?.summary?.es_de_cobro;
  const filPts = content?.summary?.filantropia_mes ?? 0;
  const filExtra = extraPorPuntos(filPts);
  const filTope = FIL_TIERS[FIL_TIERS.length - 1].pts;
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
      <div data-tour="home-stats" style={SS.statGrid}>
        <StatCard
          label="Próximo pago"
          value={fmt(proximoPago)}
          hint={proximoPago > 0 ? 'Se deposita el día 1' : 'Aún no hay confirmadas'}
          accent={C.green}
          ctaLabel="Ver desglose"
          onCta={() => go('dinero')}
        />
        <StatCard
          label="Total año"
          value={fmt(totalAno)}
          hint={(() => {
            const enCamino = Math.max(0, stage.clientes - ventasAno);
            if (ventasAno === 0 && enCamino === 0) return 'Aún sin ventas';
            if (enCamino === 0) return `${ventasAno} ${ventasAno === 1 ? 'pago liquidado' : 'pagos liquidados'}`;
            return `${ventasAno} liquidados · ${enCamino} en camino`;
          })()}
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
        {esDeCobro ? (
          <StatCard
            label="🕊️ Racha filantrópica"
            value={filExtra > 0 ? `${filPts} pts · +${filExtra}%` : `${filPts} pts`}
            hint={filExtra > 0 ? 'comisión extra este mes · opcional' : 'opcional — sube tu comisión'}
            accent={C.green}
            ctaLabel="Ver mi racha →"
            onCta={() => go('nivel')}
            progress={Math.min(100, Math.round((filPts / filTope) * 100))}
          />
        ) : (
          <StatCard
            label="Puntos del mes"
            value={`${puntos} / ${puntosMeta}`}
            hint={diasRestantes > 0 ? `${diasRestantes} días restantes` : 'Cierre del mes'}
            accent={C.purple}
            ctaLabel="Reportar actividad →"
            onCta={() => go('nivel')}
            progress={Math.min(100, puntosPct)}
          />
        )}
      </div>

      {/* Card promocional · Activa notificaciones (solo si no están activas) */}
      <PushPromoCard />

      {/* Tu link inline */}
      <h2 style={SS.h2}>Tu link único</h2>
      <div data-tour="home-link" style={SS.linkBig}>
        <div style={SS.linkUrl}>{partnerUrl}</div>
        <div style={SS.linkActions}>
          <button style={iconBtnDark} onClick={async () => {
            const ok = await copyToClipboard(partnerUrl);
            if (ok) alert('Link copiado');
          }}>
            <Icon.Copy size={14} /> Copiar
          </button>
          <a style={{ ...iconBtnDark, textDecoration: 'none' }}
            href={`https://wa.me/?text=${encodeURIComponent(`Te paso info sobre SACS, el sistema con el que llevo mi negocio: ${partnerUrl}`)}`}
            target="_blank" rel="noopener">
            <Icon.WhatsApp size={14} /> WhatsApp
          </a>
          <a style={{ ...iconBtnDark, textDecoration: 'none' }}
            href={`mailto:?subject=${encodeURIComponent('Una herramienta que te va a interesar')}&body=${encodeURIComponent(`Llevo un tiempo usando SACS para mi negocio y me ha funcionado muy bien. Te paso el link: ${partnerUrl}`)}`}>
            <Icon.Mail size={14} /> Email
          </a>
          <button style={iconBtnDark} onClick={() => go('compartir')}>
            Más opciones <Icon.ArrowRight size={14} />
          </button>
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
      <div data-tour="home-pipeline" style={SS.pipeRow}>
        <PipelineCard Icon={Icon.Sparkle}    num={stage.nuevos}             label="Nuevos"          sub={stage.nuevos > 0 ? 'Sin contactar' : 'Llegan vía tu link'} onClick={() => go('leads')} accent={C.muted} />
        <PipelineCard Icon={Icon.Gift}       num={stage.prueba}             label="Prueba activa"   sub={stage.prueba > 0 ? 'En período de 14 días' : 'Aún ninguno'}  onClick={() => go('leads')} accent={C.amber} />
        <PipelineCard Icon={Icon.Phone}      num={stage.demoAg}             label="Demo agendada"   sub={proximaDemo ? `${proximaDemo.invitee_nombre?.split(' ')[0] || 'Lead'} · ${proximaDemoLabel}` : 'Por agendar'} onClick={() => go('leads')} accent={C.accent} />
        <PipelineCard Icon={Icon.Handshake}  num={Math.max(0, stage.demoReal)} label="Demo realizada" sub="Esperando propuesta"                                       onClick={() => go('leads')} accent={C.purple} />
        <PipelineCard Icon={Icon.CheckCircle} num={stage.clientes}          label="Clientes"        sub={totalAno > 0 ? `${fmt(totalAno)} generado` : '$0 aún'}      onClick={() => go('clientes')} accent={C.greenDark} />
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
        <button style={{ ...SS.statCta, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={onCta}>
          {ctaLabel.replace(/\s*→\s*$/, '')}
          <Icon.ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Pipeline Card ───
function PipelineCard({ Icon: IconCmp, num, label, sub, onClick, accent }: {
  Icon: (p: any) => JSX.Element; num: number; label: string; sub: string; onClick: () => void; accent: string;
}) {
  return (
    <button onClick={onClick} style={{ ...SS.pipeCard, textAlign: 'left' as const, fontFamily: 'inherit' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 18px -10px rgba(0,0,0,0.12)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, borderRadius: 8,
        background: `${accent}14`, color: accent,
        marginBottom: 10,
      }}>
        <IconCmp size={18} />
      </span>
      <div style={SS.pipeNum}>{num}</div>
      <div style={SS.pipeLbl}>{label}</div>
      <div style={SS.pipeSub}>{sub}</div>
    </button>
  );
}

const iconBtnDark: React.CSSProperties = {
  padding: '10px 16px',
  background: 'rgba(255,255,255,0.10)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.22)',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

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
    if (d.closed_at && isDealWon(d)) {
      out.push({ when: d.closed_at, type: 'sale', text: `${d.nombre || 'Cliente'} firmó contrato`, detail: d.valor_total ? `${fmt(d.valor_total)} — Plan cerrado` : 'Plan cerrado' });
    }
  }
  for (const b of bookings.slice(0, 5)) {
    out.push({
      when: b.created_at || b.fecha,
      type: 'booking',
      text: `${b.invitee_nombre || 'Lead'} agendó demo`,
      detail: b.fecha ? formatBookingSlot(b.fecha, b.hora_inicio) : undefined,
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

function formatBookingSlot(fechaIso?: string | null, hora?: string | null): string {
  if (!fechaIso) return '';
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const [y, mo, d] = fechaIso.split('-').map(Number);
  const fecha = `${d} ${months[mo - 1]}`;
  if (!hora) return fecha;
  const [h, m] = hora.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${fecha} · ${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

function guessLevel(deals: any[], content: any): { current: number; nombre: string } {
  const ventasAno = deals.filter(d => isDealWon(d)).length;
  if (ventasAno >= 10) return { current: 3, nombre: 'Master Partner Nv 1' };
  if (ventasAno >= 1) return { current: 2, nombre: 'Partner Certificado' };
  return { current: 1, nombre: 'Partner Referidor' };
}

// ─── PushPromoCard ──────────────────────────────────────────
// Card "Activa notificaciones" en HomeTab.
// - Solo aparece si push está supported pero NO subscribed
// - Después de activar, se oculta automáticamente
// - Si ya está activo, muestra mini panel con test buttons

function PushPromoCard() {
  const [status, setStatus] = useState<{ supported: boolean; permission: NotificationPermission; subscribed: boolean } | null>(null);
  const [activating, setActivating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    checkPushStatus().then(setStatus);
    const onSub = () => checkPushStatus().then(setStatus);
    window.addEventListener('sacs-push-subscribed', onSub);
    return () => window.removeEventListener('sacs-push-subscribed', onSub);
  }, []);

  if (!status) return null;
  if (!status.supported) return null;
  if (dismissed && !status.subscribed) return null;

  // Si ya está suscrito: panel compacto con test buttons
  if (status.subscribed) {
    return (
      <div style={{
        background: 'rgba(42,181,160,0.06)',
        border: `1px solid rgba(42,181,160,0.22)`,
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 14, flexWrap: 'wrap' as const,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 220 }}>
          <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: 'rgba(42,181,160,0.18)', color: C.greenDark, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon.CheckCircle size={16} />
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.greenDark }}>Notificaciones activas</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Te avisamos en tiempo real cuando confirmen un pago, llegue un lead o agenden demo.</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          <TestPushBtn label="Pago" type="pago" testing={testing} setTesting={setTesting} />
          <TestPushBtn label="Lead" type="lead" testing={testing} setTesting={setTesting} />
          <TestPushBtn label="Demo" type="demo" testing={testing} setTesting={setTesting} />
        </div>
      </div>
    );
  }

  // Si NO está suscrito: card promocional grande
  async function activate() {
    setActivating(true);
    setError(null);
    const r = await ensurePushSubscription();
    setActivating(false);
    if (!r.ok) {
      setError(
        r.error === 'permission_denied' ? 'Permiso denegado · habilita notificaciones en la configuración de tu navegador.'
        : r.error === 'push_not_supported' ? 'Tu navegador no soporta notificaciones push.'
        : r.error === 'vapid_not_configured' || r.error === 'not_configured' ? 'Funcionalidad disponible próximamente · pendiente de configurar en servidor.'
        : r.error || 'No se pudo activar'
      );
    } else {
      checkPushStatus().then(setStatus);
    }
  }

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`,
      color: '#fff',
      borderRadius: 16,
      padding: '24px 28px',
      marginBottom: 32,
      boxShadow: '0 12px 28px -14px rgba(75,123,229,0.40)',
      position: 'relative' as const,
    }}>
      <button onClick={() => setDismissed(true)}
        style={{
          position: 'absolute' as const, top: 12, right: 12,
          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer', padding: 6, borderRadius: 6,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-label="Cerrar"
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'}>
        <Icon.Close size={14} />
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' as const }}>
        <span style={{
          flexShrink: 0, width: 48, height: 48, borderRadius: 14,
          background: 'rgba(255,255,255,0.18)', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 17a3 3 0 01-3 3H5a3 3 0 01-3-3V7a3 3 0 013-3h14a3 3 0 013 3z" />
            <path d="M12 7v6m0 3v.5" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 4, letterSpacing: '-0.012em' }}>
            Entérate en el momento exacto
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.55 }}>
            Activa las notificaciones y recibe un aviso al instante cuando confirmen un pago, llegue un lead nuevo, o agenden una demo. No correos, no apps · directo en tu pantalla.
          </div>
        </div>
        <button onClick={activate} disabled={activating}
          style={{
            padding: '12px 22px', background: '#fff', color: C.brand,
            border: 'none', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' as const,
            opacity: activating ? 0.6 : 1,
            letterSpacing: '-0.005em',
          }}>
          {activating ? 'Activando…' : 'Activar notificaciones'}
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12, color: '#fff', lineHeight: 1.5 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function TestPushBtn({ label, type, testing, setTesting }: { label: string; type: 'pago' | 'lead' | 'demo' | 'partner' | 'achievement'; testing: string | null; setTesting: (s: string | null) => void }) {
  const isLoading = testing === type;
  return (
    <button onClick={async () => {
      setTesting(type);
      const r = await sendTestPush(type);
      setTesting(null);
      if (!r.ok) alert(r.error === 'vapid_not_configured' ? 'Notifs sin VAPID keys configuradas en servidor' : (r.error || 'Error'));
    }}
      disabled={isLoading}
      style={{
        padding: '6px 12px',
        background: '#fff', color: C.greenDark,
        border: `1px solid rgba(42,181,160,0.30)`,
        borderRadius: 999, fontSize: 11, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        opacity: isLoading ? 0.6 : 1,
      }}>
      {isLoading ? '...' : `Probar ${label}`}
    </button>
  );
}
