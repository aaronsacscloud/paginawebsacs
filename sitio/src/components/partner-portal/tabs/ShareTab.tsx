import { useEffect, useMemo, useState } from 'react';
import { fmt, fmtNum, fmtRel, isDemoMode, apiGet, copyToClipboard, buildSparkline } from './utils';
import { SS, C } from './styles';
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
  const templates = useMemo(() => buildTemplates(partnerUrl, nombrePartner), [partnerUrl, nombrePartner]);

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
          <button style={SS.btnDark} onClick={() => handleCopy(partnerUrl, 'main')}>
            {copied === 'main' ? '✓ Copiado' : '🔗 Copiar'}
          </button>
          <a style={{ ...SS.btnDark, textDecoration: 'none', display: 'inline-block' }}
            href={`${partnerUrl}?notrack=1`}
            target="_blank" rel="noopener">
            👁️ Probar mi link
          </a>
          <a style={{ ...SS.btnDark, textDecoration: 'none', display: 'inline-block' }}
            href={`https://wa.me/?text=${encodeURIComponent(`Te paso info sobre SACS, el sistema con el que llevo mi negocio: ${partnerUrl}`)}`}
            target="_blank" rel="noopener">📱 WhatsApp</a>
          <a style={{ ...SS.btnDark, textDecoration: 'none', display: 'inline-block' }}
            href={`mailto:?subject=${encodeURIComponent('Una herramienta que te va a interesar')}&body=${encodeURIComponent(`Llevo un tiempo usando SACS para mi negocio. Te paso el link: ${partnerUrl}`)}`}>✉️ Email</a>
          <a style={{ ...SS.btnDark, textDecoration: 'none', display: 'inline-block' }}
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Llevo mi negocio con SACS: ${partnerUrl}`)}`}
            target="_blank" rel="noopener">🐦 Twitter / X</a>
          <a style={{ ...SS.btnDark, textDecoration: 'none', display: 'inline-block' }}
            href={qrUrl} target="_blank" rel="noopener" download="sacs-qr.png">📲 Ver QR</a>
        </div>
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.12)', fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
          Tu link manda a <strong style={{ color: '#fff', fontWeight: 600 }}>sacscloud.com</strong> con un cookie de atribución de <strong style={{ color: '#fff', fontWeight: 600 }}>90 días</strong>. Cada acción del visitante queda registrada a tu nombre — incluso si regresa días después por otro medio.
        </div>
      </div>

      {/* Cómo funciona tu link */}
      <h2 style={SS.h2}>Cómo funciona tu link</h2>
      <p style={{ ...SS.leadSm, marginTop: -8 }}>Todas las acciones que haga un visitante quedan atribuidas a ti, automáticamente.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <FlowStep num="1" title="Visitante hace click" desc="Llega a la página principal de SACS (sin landing extra). Su navegador recibe un cookie de partner por 90 días." accent={C.accent} />
        <FlowStep num="2" title="Te aparece su nombre" desc="Cuando entra a registro o prueba gratis, ve un banner: 'Te recomendó [tu nombre]'. Igual que un código de descuento de influencer." accent={C.purple} />
        <FlowStep num="3" title="Todo queda atribuido" desc="Sus visitas, demos agendadas, prueba gratis, plan firmado y pago — TODO aparece en tu portal." accent={C.green} />
        <FlowStep num="4" title="Cobras tu comisión" desc="50% sobre la venta directa, depósito el día 1 del mes siguiente. Sin ambigüedad — el sistema te asigna el crédito automáticamente." accent={C.amber} />
      </div>

      {/* Qué se registra */}
      <h2 style={SS.h2}>Qué queda registrado</h2>
      <div style={SS.card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          <TrackItem icon="👁️" label="Visitas al sitio" desc="Cada click a tu link, con visitor único" />
          <TrackItem icon="📊" label="Páginas vistas" desc="Qué páginas ven (planes, producto, etc)" />
          <TrackItem icon="📩" label="Formularios" desc="Si dejan email, WhatsApp o agendan demo" />
          <TrackItem icon="🎁" label="Prueba gratis activada" desc="14 días para evaluar SACS sin pago" />
          <TrackItem icon="💳" label="Suscripción pagada" desc="Plan firmado · genera tu comisión" />
          <TrackItem icon="🔁" label="Renovaciones" desc="Sigues cobrando mientras el cliente esté activo" />
        </div>
      </div>

      <div style={{ ...SS.note, marginTop: 18, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <span style={{ flexShrink: 0, fontSize: 20 }}>🔒</span>
        <div>
          <strong>Tu atribución es vinculante.</strong> Si tu link trae un cliente que se registra hoy y paga en 89 días, sigue siendo tuyo. Si trae uno que se registra hoy y paga en 91 días, también sigue siendo tuyo — el cookie expira pero la asignación al partner queda registrada en la base de datos desde el primer click.
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

      {/* Mensajes listos */}
      <h2 style={SS.h2}>Mensajes listos para enviar</h2>
      <p style={{ ...SS.leadSm, marginTop: -8 }}>Tu link ya está incrustado. Copia, pega y manda.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {templates.map(t => (
          <div key={t.id} style={SS.card}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{t.platform}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 12 }}>{t.title}</div>
            <div style={{ background: '#fafaf8', borderRadius: 10, padding: '14px 16px', fontSize: 13, color: C.textSoft, lineHeight: 1.55, marginBottom: 14, whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}>
              {t.body}
            </div>
            <button style={SS.btnGhost} onClick={() => handleCopy(t.body, t.id)}>
              {copied === t.id ? '✓ Copiado' : 'Copiar texto'}
            </button>
          </div>
        ))}
      </div>

      {/* Brand kit */}
      <h2 style={SS.h2}>Brand kit</h2>
      <p style={{ ...SS.leadSm, marginTop: -8 }}>Logos, imágenes y plantillas oficiales de SACS para tus posts y materiales.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <BrandAsset name="Logo SACS · PNG" desc="Versión a color · transparente" href="/brandkit/sacs-logo-color.png" />
        <BrandAsset name="Logo SACS · SVG" desc="Vector escalable" href="/brandkit/sacs-logo.svg" />
        <BrandAsset name="Logo negro · PNG" desc="Para fondos claros" href="/brandkit/sacs-logo-black.png" />
        <BrandAsset name="Foto producto · POS" desc="Vista del dashboard" href="/brandkit/sacs-screenshot-dashboard.png" />
        <BrandAsset name="Foto producto · iPad" desc="POS en operación" href="/brandkit/sacs-screenshot-ipad.png" />
        <BrandAsset name="Banner email signature" desc="600x150 px" href="/brandkit/sacs-email-banner.png" />
        <BrandAsset name="Templates Canva" desc="Reels e historias listas" href="https://www.canva.com/" external />
        <BrandAsset name="Guía de tono · PDF" desc="Cómo hablar de SACS" href="/brandkit/sacs-tone-guide.pdf" />
      </div>

      <div style={{ ...SS.note, marginTop: 32 }}>
        <strong>¿Necesitas algo más?</strong> Si necesitas un asset específico o quieres que diseñemos algo para tu campaña, escríbenos a <a href="mailto:partners@sacscloud.com" style={{ color: C.accent, fontWeight: 600 }}>partners@sacscloud.com</a>.
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

function BrandAsset({ name, desc, href, external }: { name: string; desc: string; href: string; external?: boolean }) {
  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined}
      download={external ? undefined : true}
      style={{ ...SS.card, textDecoration: 'none', color: 'inherit', display: 'block', transition: 'transform 0.12s', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{name}</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>{desc}</div>
      <div style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{external ? 'Abrir →' : 'Descargar →'}</div>
    </a>
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

function TrackItem({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <span style={{ flexShrink: 0, fontSize: 22, lineHeight: 1, marginTop: 2 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}

function buildTemplates(link: string, nombre: string) {
  return [
    {
      id: 'wa-1a1',
      platform: 'WhatsApp · 1:1',
      title: 'Para escribir a alguien directo',
      body: `Hola [nombre],

Te quería platicar sobre SACS — es el sistema con el que llevo mi negocio (POS, inventario, clientes, todo). Lo conocí hace unos meses y desde entonces tengo la operación bajo control.

Te paso el link para que veas: ${link}

Si te interesa, te pueden dar una demo gratis sin compromiso. Yo te puedo conectar.`,
    },
    {
      id: 'email-b2b',
      platform: 'Email · B2B',
      title: 'Cold email a un dueño de negocio',
      body: `Asunto: Una herramienta que está cambiando cómo opero mi negocio

Hola [nombre],

Soy ${nombre}. Te escribo porque llevo unos meses usando SACS — una plataforma operativa para retail (POS + inventario + CRM + reportes) que me ha cambiado cómo manejo mi día a día.

Pensé en ti porque me imagino que tienes retos similares con [inventario, multisucursal, conciliación bancaria, etc].

Te paso el link directo a una demo gratis: ${link}

Si quieres, agendamos 20 minutos para que te lo cuente con detalle. Sin compromiso.

— ${nombre}`,
    },
    {
      id: 'ig-caption',
      platform: 'Instagram / TikTok · Caption',
      title: 'Para post o reel mostrando SACS',
      body: `Llevo mi tienda con SACS y se nota.

POS, inventario, clientes, reportes, todo en un solo lugar. Lo que más me ayudó fue [tu razón aquí — ej. saber qué se vende mejor, no perder ventas por inventario, etc].

Te dejo el link en bio o aquí: ${link}

#retail #emprendedor #pyme #sacscloud`,
    },
    {
      id: 'linkedin',
      platform: 'LinkedIn · Post',
      title: 'Para tu network profesional',
      body: `Llevo ${Math.floor(Math.random() * 5) + 2} meses operando mi negocio con SACS y creo que vale la pena contarlo.

Lo que más me gusta es que centraliza POS, inventario, clientes y reportes en una sola plataforma — sin tener que pegar tres herramientas con cinta adhesiva.

Si están en retail o servicios y quieren ver cómo funciona, les paso el link a una demo gratuita: ${link}

(Sin compromiso. Solo si les hace sentido.)`,
    },
  ];
}
