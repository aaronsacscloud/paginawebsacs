import { useEffect, useMemo, useState } from 'react';
import { fmt, fmtNum, fmtRel, isDemoMode, apiGet, copyToClipboard, buildSparkline } from './utils';
import { SS, C } from './styles';
import { Icon } from './icons';
import { demoLinkStats, demoProfile } from '../../../data/partner-portal-demo';

export default function ShareTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [stats, setStats] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet('/api/partner-portal/link-stats', isDemoMode() ? demoLinkStats : undefined),
      apiGet('/api/partner-portal/profile', isDemoMode() ? demoProfile : undefined),
    ]).then(([s, p]) => { setStats(s); setProfile(p); setLoading(false); });
  }, []);

  const partnerUrl: string = profile?.partnerLandingUrl || `https://www.sacscloud.com/p/${(user.nombre || 'tu-link').toLowerCase().split(' ')[0]}`;
  const nombrePartner = user.nombre || profile?.user?.nombre || 'tu partner';

  const sparkPath = useMemo(() => buildSparkline(stats?.daily || [], 600, 80), [stats?.daily]);

  if (loading) return <div style={SS.loading}>Cargando…</div>;

  const total = stats?.total ?? 0;
  const unique = stats?.unique ?? 0;
  const recurring = stats?.recurring ?? 0;
  const linkLeads = 0; // este endpoint no tiene leads cruzados, queda 0 si no hay contacts attribution
  const topRefs = stats?.top_referrers || [];
  const topRef = topRefs[0];

  const cr = total > 0 ? ((unique / total) * 100).toFixed(1) : '0';

  // QR code via api externa gratis (qrserver.com)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(partnerUrl)}`;

  async function handleCopy(text: string, key: string) {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    }
  }

  return (
    <div>
      <h1 style={SS.h1Small}>Compartir</h1>
      <p style={SS.leadSm}>Tu link único, mensajes listos para enviar, y los assets de marca que necesitas.</p>

      {/* Hero link */}
      <div style={SS.linkBig}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Tu link único</div>
        <div style={SS.linkUrl}>{partnerUrl}</div>
        <div style={SS.linkActions}>
          <button style={iconBtnDark} onClick={() => handleCopy(partnerUrl, 'main')}>
            {copied === 'main' ? <Icon.Check size={14} strokeWidth={2.4} /> : <Icon.Copy size={14} />}
            {copied === 'main' ? 'Copiado' : 'Copiar'}
          </button>
          <a style={{ ...iconBtnDark, textDecoration: 'none' }}
            href={`${partnerUrl}?notrack=1`}
            target="_blank" rel="noopener">
            <Icon.Eye size={14} /> Probar mi link
          </a>
          <a style={{ ...iconBtnDark, textDecoration: 'none' }}
            href={`https://wa.me/?text=${encodeURIComponent(`Te paso info sobre SACS, el sistema con el que llevo mi negocio: ${partnerUrl}`)}`}
            target="_blank" rel="noopener">
            <Icon.WhatsApp size={14} /> WhatsApp
          </a>
          <a style={{ ...iconBtnDark, textDecoration: 'none' }}
            href={`mailto:?subject=${encodeURIComponent('Una herramienta que te va a interesar')}&body=${encodeURIComponent(`Llevo un tiempo usando SACS para mi negocio. Te paso el link: ${partnerUrl}`)}`}>
            <Icon.Mail size={14} /> Email
          </a>
          <a style={{ ...iconBtnDark, textDecoration: 'none' }}
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Llevo mi negocio con SACS: ${partnerUrl}`)}`}
            target="_blank" rel="noopener">
            <Icon.Twitter size={14} /> X
          </a>
          <a style={{ ...iconBtnDark, textDecoration: 'none' }}
            href={qrUrl} target="_blank" rel="noopener" download="sacs-qr.png">
            <Icon.QrCode size={14} /> QR
          </a>
        </div>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.12)', fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
          Tu link manda a <strong style={{ color: '#fff', fontWeight: 600 }}>sacscloud.com</strong> con una cookie de atribución de <strong style={{ color: '#fff', fontWeight: 600 }}>90 días</strong>. Cada acción del visitante queda registrada a tu nombre — incluso si regresa días después por otro medio.
        </div>
      </div>

      {/* ─── Cookie de atribución · explicación detallada ─── */}
      <CookieAttributionExplainer />

      {/* Cómo funciona tu link */}
      <h2 style={SS.h2}>Cómo funciona tu link</h2>
      <p style={{ ...SS.leadSm, marginTop: -8 }}>Todas las acciones que haga un visitante quedan atribuidas a ti, automáticamente.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <FlowStep num="1" title="Visitante hace click" desc="Llega a la página principal de SACS (sin landing extra). Su navegador recibe una cookie de partner por 90 días." accent={C.accent} />
        <FlowStep num="2" title="Te aparece su nombre" desc="Cuando entra a registro o prueba gratis, ve un banner: 'Te recomendó [tu nombre]'. Igual que un código de descuento de influencer." accent={C.purple} />
        <FlowStep num="3" title="Todo queda atribuido" desc="Sus visitas, demos agendadas, prueba gratis, plan firmado y pago — TODO aparece en tu portal." accent={C.green} />
        <FlowStep num="4" title="Cobras tu comisión" desc="50% sobre la venta directa, depósito el día 1 del mes siguiente. Sin ambigüedad — el sistema te asigna el crédito automáticamente." accent={C.amber} />
      </div>

      {/* Qué se registra */}
      <h2 style={SS.h2}>Qué queda registrado</h2>
      <div style={SS.card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          <TrackItem Ico={Icon.Eye}         label="Visitas al sitio"        desc="Cada click a tu link, con visitor único" />
          <TrackItem Ico={Icon.Activity}    label="Páginas vistas"           desc="Qué páginas ven (planes, producto, etc)" />
          <TrackItem Ico={Icon.Mail}        label="Formularios"              desc="Si dejan email, WhatsApp o agendan demo" />
          <TrackItem Ico={Icon.Gift}        label="Prueba gratis activada"   desc="14 días para evaluar SACS sin pago" />
          <TrackItem Ico={Icon.Briefcase}   label="Suscripción pagada"       desc="Plan firmado · genera tu comisión" />
          <TrackItem Ico={Icon.TrendingUp}  label="Renovaciones"             desc="Sigues cobrando mientras el cliente esté activo" />
        </div>
      </div>

      <div style={{ ...SS.note, marginTop: 18, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div>
          <strong>Tu atribución es vinculante.</strong> En el momento que el visitante deja su email, agenda demo o se registra a la prueba — la atribución se graba en BD permanentemente. Si paga en 30 días, 6 meses o 2 años después: sigue siendo tuyo.
        </div>
      </div>

      {/* Stats compactas */}
      <div style={SS.statGrid}>
        <SimpleStat label="Visitas (30 días)" value={fmtNum(total)} hint={`${stats?.today ?? 0} hoy`} accent={C.accent} />
        <SimpleStat label="Visitantes únicos" value={fmtNum(unique)} hint={`${fmtNum(recurring)} recurrentes`} accent={C.purple} />
        <SimpleStat label="Conversión" value={`${cr}%`} hint="únicos / visitas" accent={C.green} />
        <SimpleStat label="Top fuente" value={topRef ? topRef.host : '—'} hint={topRef ? `${topRef.count} visitas` : 'Sin datos aún'} accent={C.amber} />
      </div>

      {/* Sparkline */}
      {stats?.daily?.length > 0 && (
        <div style={{ ...SS.card, marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Visitas · últimos 30 días</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, marginTop: 6, letterSpacing: '-0.025em' }}>{fmtNum(total)}</div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, alignSelf: 'flex-end' }}>{stats?.last_visit_at ? `Última: ${fmtRel(stats.last_visit_at)}` : ''}</div>
          </div>
          <svg viewBox="0 0 600 80" preserveAspectRatio="none" style={{ width: '100%', height: 80, display: 'block' }}>
            <path d={sparkPath} fill="none" stroke={C.accent} strokeWidth={2} />
            <path d={`${sparkPath} L 600,80 L 0,80 Z`} fill="url(#fade)" opacity={0.18} />
            <defs>
              <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.accent} stopOpacity="0.6" />
                <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      )}

      {/* Top referrers */}
      {topRefs.length > 0 && (
        <>
          <h2 style={SS.h2}>De dónde viene el tráfico</h2>
          <div style={SS.card}>
            {topRefs.map((r: any, i: number) => {
              const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 70px', gap: 16, alignItems: 'center', padding: '12px 0', borderBottom: i === topRefs.length - 1 ? 'none' : `1px solid ${C.borderSoft}` }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.host}</div>
                  <div style={{ height: 6, background: C.bg, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: C.accent, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, textAlign: 'right' }}>{r.count} · {pct}%</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Brand kit ahora vive en su propia tab (Activos · Brand kit) */}
    </div>
  );
}

// ─── Cookie attribution explainer ─────────────────────────────
// Sección dedicada a explicar al partner cómo funciona la atribución para
// que sienta certeza total. Cubre los 4 escenarios reales:
//   1. Cookie nueva al primer click
//   2. Reseteo a 90 días al volver a entrar por el link
//   3. Atribución vinculante en BD una vez convierte (no depende de cookie)
//   4. Multi-dispositivo / borrar cookies → si re-entra por tu link queda
//      atribuido de nuevo

function CookieAttributionExplainer() {
  return (
    <>
      <h2 style={SS.h2}>Tu cookie de atribución</h2>
      <p style={{ ...SS.leadSm, marginTop: -8 }}>
        Cómo te aseguramos que cada lead tuyo queda registrado a tu nombre — sin ambigüedad y sin que dependa de tu memoria.
      </p>

      <div style={SS.card}>
        {/* Regla principal */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24,
          paddingBottom: 22, borderBottom: `1px solid ${C.borderSoft}`,
        }}>
          <span style={{
            flexShrink: 0,
            width: 54, height: 54, borderRadius: 14,
            background: 'linear-gradient(135deg, #4B7BE5 0%, #6C5CE7 100%)',
            color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em',
          }}>
            90
          </span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              90 días por cada click
            </div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
              Cuando alguien entra a SACS por tu link, su navegador guarda una cookie con tu identificador de partner.
              La cookie dura 90 días — durante ese tiempo, todo lo que haga ese visitante queda atribuido a ti.
            </div>
          </div>
        </div>

        {/* Timeline / casos */}
        <div style={{
          fontSize: 11, color: C.muted, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase' as const,
          marginBottom: 14,
        }}>
          Casos reales
        </div>

        <CaseRow
          icon={<TimelineSimple labels={['Click', '+30d', '+60d', '+90d']} fill={1/3} />}
          title="Cliente entra hoy y vuelve dentro de 30 días por Google"
          desc="Sigue siendo tuyo. La cookie aún está activa (le quedan 60 días). Si agenda demo, paga, o lo que sea — comisión tuya."
          accent={C.green}
          accentLabel="Atribuido"
        />

        <CaseRow
          icon={<TimelineReset />}
          title="Cliente entra hoy y vuelve a dar click en tu link en día 80"
          desc={
            <>
              <strong style={{ color: C.text, fontWeight: 600 }}>El contador se reinicia a 90 días desde el último click.</strong>{' '}
              Cada vez que alguien entra por tu link, la cookie se renueva. Mientras siga consumiendo tu contenido y volviendo, tu atribución se mantiene viva indefinidamente.
            </>
          }
          accent={C.accent}
          accentLabel="Reset · +90 días"
        />

        <CaseRow
          icon={<TimelineLocked />}
          title="Cliente deja email, agenda demo o paga dentro de los 90 días"
          desc={
            <>
              A partir de ese momento, la atribución <strong style={{ color: C.text, fontWeight: 600 }}>queda grabada en la base de datos</strong> — ya no depende del cookie.
              Aunque borre cookies, cambie de dispositivo o pasen 2 años hasta que pague: <strong style={{ color: C.text, fontWeight: 600 }}>sigue siendo tuyo</strong>.
            </>
          }
          accent={C.purple}
          accentLabel="Vinculante en BD"
        />

        <CaseRow
          icon={<TimelineMultiDevice />}
          title="Cliente da click desde su teléfono y luego abre desde la laptop"
          desc="Cada navegador es independiente. Si llega a la laptop por Google directo (sin tu link), no está atribuido en esa sesión. Pero apenas dejé su email o agende demo en cualquiera de los dos, las identidades se unifican y la atribución se mantiene tuya."
          accent={C.amber}
          accentLabel="Multi-dispositivo"
          isLast
        />
      </div>

      {/* Garantía vinculante */}
      <div style={{
        marginTop: 18,
        background: 'rgba(42,181,160,0.06)',
        border: '1px solid rgba(42,181,160,0.22)',
        borderRadius: 14,
        padding: '18px 22px',
        display: 'flex', alignItems: 'flex-start', gap: 14,
      }}>
        <span style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: 10,
          background: 'rgba(42,181,160,0.18)', color: C.greenDark,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon.CheckCircle size={16} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.greenDark, marginBottom: 4 }}>
            Tu atribución es vinculante y verificable
          </div>
          <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.55 }}>
            Cada visita, cookie y conversión queda con timestamp en la base de datos. Puedes ver el rastro completo en{' '}
            <a href="#notificaciones" style={{ color: C.brand, fontWeight: 600 }}>Notificaciones</a> con el momento exacto de cada evento.
            Si crees que algo no cuadra, escríbenos a partners@sacscloud.com con el nombre/email del cliente y revisamos los logs juntos.
          </div>
        </div>
      </div>
    </>
  );
}

function CaseRow({ icon, title, desc, accent, accentLabel, isLast }: {
  icon: React.ReactNode;
  title: string;
  desc: React.ReactNode;
  accent: string;
  accentLabel: string;
  isLast?: boolean;
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '88px 1fr',
      gap: 18, alignItems: 'flex-start',
      padding: '18px 0',
      borderBottom: isLast ? 'none' : `1px solid ${C.borderSoft}`,
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8,
      }}>
        <div style={{ width: '100%' }}>{icon}</div>
        <span style={{
          display: 'inline-block',
          padding: '3px 8px',
          background: `${accent}14`, color: accent,
          borderRadius: 999,
          fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          textAlign: 'center' as const,
          whiteSpace: 'nowrap' as const,
        }}>
          {accentLabel}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6, lineHeight: 1.4 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

// Mini timeline visual (88px wide) con marca de progreso
function TimelineSimple({ labels, fill }: { labels: string[]; fill: number }) {
  return (
    <div>
      <div style={{ position: 'relative' as const, height: 6, background: '#eef0f4', borderRadius: 999, marginBottom: 6 }}>
        <div style={{ position: 'absolute' as const, left: 0, top: 0, height: '100%', width: `${fill * 100}%`, background: C.green, borderRadius: 999 }} />
        <span style={{ position: 'absolute' as const, left: 0, top: -3, width: 12, height: 12, borderRadius: '50%', background: C.green, border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.05)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: C.mutedLight, fontWeight: 600, letterSpacing: '0.04em' }}>
        {labels.map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  );
}

function TimelineReset() {
  return (
    <div>
      <div style={{ position: 'relative' as const, height: 6, background: '#eef0f4', borderRadius: 999, marginBottom: 6, overflow: 'hidden' }}>
        <div style={{ position: 'absolute' as const, left: 0, top: 0, height: '100%', width: '89%', background: C.brand, borderRadius: 999, opacity: 0.4 }} />
        <span style={{ position: 'absolute' as const, left: '89%', top: -3, width: 12, height: 12, borderRadius: '50%', background: C.brand, border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.05)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: C.mutedLight, fontWeight: 600 }}>
        <span>D0</span>
        <span style={{ color: C.brand, fontWeight: 700 }}>D80 ↻</span>
        <span>+90d</span>
      </div>
    </div>
  );
}

function TimelineLocked() {
  return (
    <div>
      <div style={{ position: 'relative' as const, height: 6, background: C.purple, borderRadius: 999, marginBottom: 6, opacity: 0.7 }}>
        <span style={{ position: 'absolute' as const, left: '50%', top: -5, transform: 'translateX(-50%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: C.purple, color: '#fff' }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: C.mutedLight, fontWeight: 600 }}>
        <span>Click</span>
        <span style={{ color: C.purple, fontWeight: 700 }}>BD lock</span>
        <span>∞</span>
      </div>
    </div>
  );
}

function TimelineMultiDevice() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, justifyContent: 'center' }}>
        <span style={{
          width: 22, height: 30, borderRadius: 4, border: `2px solid ${C.amber}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' as const,
        }}>
          <span style={{ fontSize: 7, color: C.amber, fontWeight: 700 }}>📱</span>
        </span>
        <span style={{ alignSelf: 'center', fontSize: 12, color: C.amber, fontWeight: 700 }}>↔</span>
        <span style={{
          width: 32, height: 22, borderRadius: 4, border: `2px solid ${C.amber}`,
          marginTop: 4,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 7, color: C.amber, fontWeight: 700 }}>💻</span>
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', fontSize: 8, color: C.mutedLight, fontWeight: 600 }}>
        <span>Unifica al convertir</span>
      </div>
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

function FlowStep({ num, title, desc, accent }: { num: string; title: string; desc: string; accent: string }) {
  return (
    <div style={{ ...SS.card, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: '50%',
          background: accent, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
        }}>{num}</span>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</div>
      </div>
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>{desc}</div>
    </div>
  );
}

function TrackItem({ Ico, label, desc }: { Ico: (p: any) => JSX.Element; label: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: 8,
        background: 'rgba(75,123,229,0.10)', color: C.accent,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ico size={16} />
      </span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
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

