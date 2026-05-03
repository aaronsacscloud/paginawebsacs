import { useEffect, useState } from 'react';

type TabId = 'summary' | 'commissions' | 'payments' | 'leads' | 'link' | 'profile';

interface Props {
  initialUser: { id: string; nombre: string; email: string };
}

const fmt = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
  } catch { return d; }
};

export default function PortalShell({ initialUser }: Props) {
  const [tab, setTab] = useState<TabId>('summary');
  const [toast, setToast] = useState<{ type: 'earned' | 'paid'; msg: string; sub?: string } | null>(null);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('sacs_seen_commissions');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  // Poll cada 60s for new earned/paid commissions and show toast
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch('/api/partner-portal/pending');
        const data = await res.json();
        if (cancelled || !data.commissions) return;
        const newEarned = data.commissions.filter((c: any) => c.status === 'earned' && !seenIds.has(c.id));
        if (newEarned.length > 0) {
          const total = newEarned.reduce((s: number, c: any) => s + Number(c.commission_amount || 0), 0);
          setToast({
            type: 'earned',
            msg: newEarned.length === 1 ? `Nuevo bono verificado: $${total.toLocaleString('es-MX')}` : `${newEarned.length} bonos nuevos: $${total.toLocaleString('es-MX')}`,
            sub: 'Listo para tu próximo payout',
          });
          const next = new Set(seenIds);
          for (const c of newEarned) next.add(c.id);
          setSeenIds(next);
          try { localStorage.setItem('sacs_seen_commissions', JSON.stringify([...next])); } catch {}
        }
      } catch {/* swallow */}
    }
    // First check after 4s, then every 60s
    const t1 = setTimeout(check, 4000);
    const t2 = setInterval(check, 60000);
    return () => { cancelled = true; clearTimeout(t1); clearInterval(t2); };
  }, [seenIds]);

  // Hash routing: deep-link a tabs (#commissions, etc.)
  useEffect(() => {
    const hash = (window.location.hash || '').replace('#', '') as TabId;
    if (['summary','commissions','payments','leads','link','profile'].includes(hash)) {
      setTab(hash);
    }
    const onHash = () => {
      const h = (window.location.hash || '').replace('#', '') as TabId;
      if (h) setTab(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function go(t: TabId) {
    setTab(t);
    history.replaceState(null, '', `#${t}`);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/partner/login';
  }

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'summary',     label: 'Resumen',      icon: '📊' },
    { id: 'commissions', label: 'Comisiones',   icon: '💰' },
    { id: 'payments',    label: 'Pagos',        icon: '🏦' },
    { id: 'leads',       label: 'Prospectos',   icon: '👥' },
    { id: 'link',        label: 'Mi link',      icon: '🔗' },
    { id: 'profile',     label: 'Mi perfil',    icon: '⚙️' },
  ];

  return (
    <div style={S.root}>
      {/* Topbar */}
      <header style={S.topbar}>
        <a href="/" style={S.brand}>Sacs</a>
        <div style={S.brandSep}>·</div>
        <span style={S.brandSub}>Portal de partner</span>
        <div style={{ flex: 1 }} />
        <span style={S.userName}>{initialUser.nombre || initialUser.email}</span>
        <button onClick={logout} style={S.logoutBtn}>Salir</button>
      </header>

      {/* Toast: nueva commission earned (live polling) */}
      {toast && (
        <div role="status" style={{
          position: 'fixed', top: 70, right: 20, zIndex: 100,
          background: '#fff',
          border: `1px solid ${toast.type === 'earned' ? '#2AB5A0' : '#4B7BE5'}`,
          borderLeft: `4px solid ${toast.type === 'earned' ? '#2AB5A0' : '#4B7BE5'}`,
          borderRadius: 10,
          padding: '14px 18px',
          boxShadow: '0 12px 32px -10px rgba(0,0,0,0.18)',
          maxWidth: 360,
          fontFamily: 'var(--font-body)',
          animation: 'slideInRight 0.3s ease-out',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: toast.type === 'earned' ? '#1A8F7A' : '#3764c4', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 4 }}>
                ✨ {toast.type === 'earned' ? 'Bono verificado' : 'Pago liquidado'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{toast.msg}</div>
              {toast.sub && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{toast.sub}</div>}
            </div>
            <button onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#999', fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
          </div>
          <button
            onClick={() => { go('commissions'); setToast(null); }}
            style={{ marginTop: 10, padding: '6px 12px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Ver detalle →
          </button>
        </div>
      )}

      {/* Sidebar (desktop) + Bottom nav (mobile) */}
      <div style={S.body}>
        <nav style={S.sidebar} className="pp-sidebar">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              style={{
                ...S.sideBtn,
                background: tab === t.id ? '#1a1a1a' : 'transparent',
                color: tab === t.id ? '#fff' : '#444',
              }}
            >
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
          <a href="/partners/brand-kit" target="_blank" rel="noopener" style={{ ...S.sideBtn, color: '#4B7BE5', marginTop: 'auto' }}>
            <span style={{ fontSize: 16 }}>📘</span>
            <span>Brand kit ↗</span>
          </a>
        </nav>

        <main style={S.main}>
          {tab === 'summary'     && <SummaryTab />}
          {tab === 'commissions' && <CommissionsTab />}
          {tab === 'payments'    && <PaymentsTab />}
          {tab === 'leads'       && <LeadsTab />}
          {tab === 'link'        && <LinkTab />}
          {tab === 'profile'     && <ProfileTab />}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav style={S.bottomNav} className="pp-bottomnav">
        {tabs.slice(0, 5).map(t => (
          <button
            key={t.id}
            onClick={() => go(t.id)}
            style={{
              ...S.bottomBtn,
              color: tab === t.id ? '#1a1a1a' : '#999',
            }}
          >
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 10 }}>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Floating "Mi link" button: shortcut a la tab link desde cualquier
          parte del portal. Se oculta cuando el partner ya está en esa tab. */}
      {tab !== 'link' && (
        <button
          onClick={() => go('link')}
          aria-label="Mi link de partner"
          title="Ver y compartir tu link"
          className="pp-fab"
          style={S.fab}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <span style={{ fontSize: 16 }}>🔗</span>
          <span>Mi link</span>
        </button>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 767px) {
          .pp-sidebar { display: none !important; }
          .pp-bottomnav { display: flex !important; }
          .pp-main { padding-bottom: 80px !important; }
          .pp-fab { bottom: 78px !important; }
        }
        @media (min-width: 768px) {
          .pp-bottomnav { display: none !important; }
        }
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      ` }} />
    </div>
  );
}

// ─── Tab: Summary ───────────────────────────────────────────────
function SummaryTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    fetch('/api/partner-portal/summary').then(r => r.json()).then(d => { setData(d); setLoading(false); });
    // Welcome banner first-visit (cookie-based dismissal)
    const dismissed = document.cookie.includes('sacs_welcome_dismissed=1');
    if (!dismissed) setShowWelcome(true);
  }, []);

  function dismissWelcome() {
    document.cookie = `sacs_welcome_dismissed=1; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setShowWelcome(false);
  }

  if (loading) return <div style={S.loading}>Cargando…</div>;
  if (!data || data.error) return <div style={S.error}>No se pudo cargar el resumen</div>;

  // Empty state: si todos los counters son 0, mostrar tour onboarding
  const isEmpty = (data.leads?.total || 0) === 0 && (data.proximoPago || 0) === 0 && (data.pendiente || 0) === 0;

  return (
    <div>
      {showWelcome && (
        <div style={S.welcomeCard}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4B7BE5', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>👋 Bienvenido a tu portal</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
              Hola {data.user?.nombre?.split(' ')[0] || 'partner'}, este es tu centro de control SACS.
            </div>
            <div style={{ fontSize: 14, color: '#555', lineHeight: 1.55, marginBottom: 14 }}>
              Aquí ves todo en tiempo real: cuánto ganaste este mes, próximo pago, prospectos atribuidos a tu link, y desde "Mi link" puedes copiar tu URL única o descargar tu QR.
              <br/><strong>Próximo paso:</strong> ve a la pestaña <em>Mi link</em>, copia tu URL y compártela en tus redes — cada activación = bono.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="#link" onClick={() => location.hash = 'link'} style={{ ...S.btnPrimary, textDecoration: 'none' }}>Ir a Mi link →</a>
              <button onClick={dismissWelcome} style={S.btnGhost}>Entendido, no mostrar otra vez</button>
            </div>
          </div>
          <button onClick={dismissWelcome} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', fontSize: 20, color: '#999', cursor: 'pointer', padding: 4, alignSelf: 'flex-start' }}>×</button>
        </div>
      )}

      <h1 style={S.h1}>Hola, {data.user?.nombre?.split(' ')[0] || 'partner'} 👋</h1>
      <p style={S.lead}>Aquí está el resumen de tu actividad como partner SACS.</p>

      {isEmpty && !showWelcome && (
        <div style={S.emptyHint}>
          <strong>Tu portal está listo, pero todavía no hay actividad.</strong>
          <span> Comparte tu link único en redes — cada activación genera un bono que verás aquí en tiempo real.</span>
          <a href="#link" onClick={() => location.hash = 'link'} style={{ ...S.btnPrimary, textDecoration: 'none', marginTop: 12, alignSelf: 'flex-start' }}>Obtener mi link →</a>
        </div>
      )}

      <div style={S.kpiGrid}>
        <KpiCard label="Próximo pago" value={fmt(data.proximoPago)} accent="#2AB5A0" hint="Comisiones earned, no pagadas todavía" />
        <KpiCard label="Pendiente de verificar" value={fmt(data.pendiente)} accent="#E8A838" hint="En revisión por el equipo SACS" />
        <KpiCard label="Total ganado este año" value={fmt(data.totalAno)} accent="#4B7BE5" />
        <KpiCard label="Tu comisión" value={`${data.user?.default_commission_pct ?? 50}%`} accent="#6C5CE7" hint="Sobre cada venta directa" />
      </div>

      <h2 style={S.h2}>Bonos del mes en curso</h2>
      <div style={S.kpiGrid}>
        <KpiCard label="Pruebas gratis" value={String(data.bonosMes?.prueba_gratis_count || 0)}
          sub={`${fmt(data.bonosMes?.prueba_gratis_sum || 0)} en bonos`} accent="#2AB5A0" />
        <KpiCard label="Demos completadas" value={String(data.bonosMes?.demo_completada_count || 0)}
          sub={`${fmt(data.bonosMes?.demo_completada_sum || 0)} en bonos`} accent="#4B7BE5" />
        <KpiCard label="Ventas directas" value={String(data.bonosMes?.venta_directa_count || 0)}
          sub={`${fmt(data.bonosMes?.venta_directa_sum || 0)} en comisiones`} accent="#6C5CE7" />
      </div>

      <h2 style={S.h2}>Tus prospectos atribuidos</h2>
      <div style={S.kpiGrid}>
        <KpiCard label="Leads totales" value={String(data.leads?.total || 0)} />
        <KpiCard label="Demos agendados" value={String(data.leads?.bookings || 0)} />
        <KpiCard label="Demos completados" value={String(data.leads?.bookings_realizadas || 0)} accent="#2AB5A0" />
      </div>
    </div>
  );
}

// ─── Tab: Commissions ───────────────────────────────────────────
function CommissionsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/partner-portal/pending').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);
  if (loading) return <div style={S.loading}>Cargando…</div>;
  if (!data || data.error) return <div style={S.error}>No se pudo cargar</div>;

  const tipoLabels: Record<string, string> = {
    prueba_gratis: 'Prueba gratis',
    demo_completada: 'Demo completada',
    venta_directa: 'Venta directa',
    manual: 'Ajuste manual',
  };
  const tipoColor: Record<string, string> = {
    prueba_gratis: '#2AB5A0',
    demo_completada: '#4B7BE5',
    venta_directa: '#6C5CE7',
    manual: '#999',
  };

  return (
    <div>
      <h1 style={S.h1}>Comisiones por cobrar</h1>
      <p style={S.lead}>
        <strong style={{ color: '#2AB5A0' }}>{fmt(data.earnedSum)}</strong> earned (próximo pago) ·
        <strong style={{ color: '#E8A838', marginLeft: 8 }}>{fmt(data.pendingSum)}</strong> pendientes de verificar.
      </p>

      {data.commissions?.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
          <strong style={{ display: 'block', color: '#1a1a1a', marginBottom: 6 }}>Aún no tienes comisiones</strong>
          <div style={{ marginBottom: 14 }}>Comparte tu link y empieza a generar bonos automáticamente.</div>
          <a href="#link" onClick={() => location.hash = 'link'} style={{ ...S.btnPrimary, textDecoration: 'none', display: 'inline-block' }}>Compartir mi link →</a>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Tipo</th>
                <th style={S.th}>Descripción</th>
                <th style={S.th}>Monto</th>
                <th style={S.th}>Estado</th>
                <th style={S.th}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(data.commissions || []).map((r: any) => (
                <tr key={r.id} style={S.tr}>
                  <td style={S.td}>
                    <span style={{ ...S.badge, background: tipoColor[r.tipo] + '22', color: tipoColor[r.tipo] }}>
                      {tipoLabels[r.tipo] || r.tipo}
                    </span>
                  </td>
                  <td style={S.td}>
                    {r.contact?.nombre || r.deal?.nombre || r.booking?.invitee_nombre || r.nota || '—'}
                    {r.contact?.email && <div style={S.subtxt}>{r.contact.email}</div>}
                    {r.deal?.valor_total && <div style={S.subtxt}>Deal: {fmt(r.deal.valor_total)}</div>}
                  </td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{fmt(r.commission_amount)}</td>
                  <td style={S.td}>
                    {r.status === 'earned' ? <span style={{ ...S.badge, background: '#2AB5A022', color: '#1e8471' }}>Earned</span>
                    : r.status === 'pending' ? <span style={{ ...S.badge, background: '#E8A83822', color: '#a06600' }}>Pending</span>
                    : r.status}
                  </td>
                  <td style={{ ...S.td, color: '#888', fontSize: 12 }}>{fmtDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Payments ──────────────────────────────────────────────
function PaymentsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/partner-portal/payments').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);
  if (loading) return <div style={S.loading}>Cargando…</div>;

  return (
    <div>
      <h1 style={S.h1}>Historial de pagos</h1>
      <p style={S.lead}>
        Total pagado de por vida: <strong>{fmt(data.total_paid_lifetime || 0)}</strong>
      </p>

      {(!data.payments || data.payments.length === 0) ? (
        <div style={S.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏦</div>
          <strong style={{ display: 'block', color: '#1a1a1a', marginBottom: 6 }}>Aún no hay pagos liquidados</strong>
          <div>Cuando SACS te transfiera, aparecerá aquí con desglose completo, fecha y referencia bancaria.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.payments.map((p: any, i: number) => (
            <details key={i} style={S.payCard}>
              <summary style={S.paySummary}>
                <div>
                  <div style={{ fontWeight: 700, color: '#1a1a1a' }}>{fmtDate(p.paid_at)}</div>
                  <div style={S.subtxt}>{p.payment_reference} · {p.items?.length || 0} conceptos</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#2AB5A0' }}>{fmt(p.total)}</div>
              </summary>
              <div style={{ padding: '12px 16px 16px', borderTop: '1px solid #f0f0f0' }}>
                {p.items?.map((it: any) => (
                  <div key={it.id} style={S.payItem}>
                    <div>
                      <div style={{ fontSize: 13, color: '#1a1a1a' }}>{it.tipo === 'prueba_gratis' ? 'Prueba gratis' : it.tipo === 'demo_completada' ? 'Demo completada' : it.tipo === 'venta_directa' ? 'Venta directa' : it.tipo}</div>
                      <div style={S.subtxt}>{it.nota || '—'}</div>
                    </div>
                    <div style={{ fontWeight: 700 }}>{fmt(it.commission_amount)}</div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Leads ─────────────────────────────────────────────────
function LeadsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/partner-portal/leads').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);
  if (loading) return <div style={S.loading}>Cargando…</div>;

  return (
    <div>
      <h1 style={S.h1}>Tus prospectos</h1>
      <p style={S.lead}>Todos los contactos, demos y deals que vinieron por tu link.</p>

      <h2 style={S.h2}>Contactos ({data.contacts?.length || 0})</h2>
      {!data.contacts?.length ? (
        <div style={S.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
          <strong style={{ display: 'block', color: '#1a1a1a', marginBottom: 6 }}>Sin contactos atribuidos todavía</strong>
          <div style={{ marginBottom: 14 }}>Cuando alguien llegue a SACS por tu link, aparece aquí con su etapa y bono asociado.</div>
          <a href="#link" onClick={() => location.hash = 'link'} style={{ ...S.btnPrimary, textDecoration: 'none', display: 'inline-block' }}>Compartir mi link →</a>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Nombre</th>
                <th style={S.th}>Email</th>
                <th style={S.th}>Etapa</th>
                <th style={S.th}>Plan interés</th>
                <th style={S.th}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.contacts.map((c: any) => (
                <tr key={c.id} style={S.tr}>
                  <td style={S.td}>{c.nombre}</td>
                  <td style={{ ...S.td, color: '#666', fontSize: 13 }}>{c.email}</td>
                  <td style={S.td}><span style={S.tag}>{c.lifecycle_stage || '—'}</span></td>
                  <td style={S.td}>{c.plan_interes || '—'}</td>
                  <td style={{ ...S.td, fontSize: 12, color: '#888' }}>{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={S.h2}>Demos ({data.bookings?.length || 0})</h2>
      {!data.bookings?.length ? (
        <div style={S.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
          <strong style={{ display: 'block', color: '#1a1a1a', marginBottom: 6 }}>Sin demos agendados</strong>
          <div>Cuando un prospecto reserve una demo por tu link, aparece aquí. Marca demo completada → bono $300 automático.</div>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Prospecto</th>
                <th style={S.th}>Fecha</th>
                <th style={S.th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.bookings.map((b: any) => (
                <tr key={b.id} style={S.tr}>
                  <td style={S.td}>
                    <div>{b.invitee_nombre}</div>
                    <div style={S.subtxt}>{b.invitee_email}</div>
                  </td>
                  <td style={S.td}>{fmtDate(b.fecha)} · {b.hora_inicio?.slice(0, 5)}</td>
                  <td style={S.td}>
                    <span style={{ ...S.badge,
                      background: b.estado === 'realizada' ? '#2AB5A022' : b.estado === 'no_show' ? '#E54B4B22' : '#4B7BE522',
                      color: b.estado === 'realizada' ? '#1e8471' : b.estado === 'no_show' ? '#b93333' : '#3764c4' }}>
                      {b.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Link ──────────────────────────────────────────────────
function LinkTab() {
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/partner-portal/profile').then(r => r.json()).then(setProfile);
  }, []);
  const url = profile?.partnerLandingUrl || '';
  const nombre = profile?.user?.nombre?.split(' ')[0] || 'tu asesor';

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  // Plantillas listas para compartir
  const templates = url ? [
    {
      key: 'whatsapp-friend',
      label: 'WhatsApp · amigo',
      text: `Hola! Te recomiendo SACS — el sistema operativo para retail moderno. POS, inventario multi-sucursal, e-commerce, todo en uno. Pruébalo gratis 14 días por mi link: ${url}`,
    },
    {
      key: 'instagram-bio',
      label: 'Instagram bio / story',
      text: `Sistema de retail que sí funciona ↓\n${url}`,
    },
    {
      key: 'email-signature',
      label: 'Firma de email',
      text: `\n—\n${nombre} · Embajador SACS\nProbar SACS gratis 14 días: ${url}`,
    },
    {
      key: 'tiktok-caption',
      label: 'TikTok caption',
      text: `Si tienes una marca de retail en México, esto te va a interesar 👇 SACS = POS + inventario + e-commerce + CRM en un solo lugar. Probarlo gratis 14 días: link en bio (${url}) #SACS #retail #emprendedoresmx`,
    },
  ] : [];

  const waShare = url ? `https://wa.me/?text=${encodeURIComponent(`Te recomiendo SACS — sistema de retail moderno. Pruébalo gratis 14 días: ${url}`)}` : '#';
  const emailShare = url ? `mailto:?subject=${encodeURIComponent('Te recomiendo SACS')}&body=${encodeURIComponent(`Hola! Te recomiendo SACS — el sistema operativo para retail moderno. Pruébalo gratis 14 días por mi link: ${url}`)}` : '#';
  const twitterShare = url ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`SACS = el sistema operativo del retail moderno. Pruébalo gratis 14 días por mi link 👇`)}&url=${encodeURIComponent(url)}` : '#';
  const linkedinShare = url ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` : '#';

  return (
    <div>
      <h1 style={S.h1}>Tu link único</h1>
      <p style={S.lead}>Compártelo en tus redes, WhatsApp, email firma. Cualquier prospecto que llegue por aquí queda atribuido a ti automáticamente — y en cuanto se registre, gana un bono.</p>

      {url ? (
        <>
          <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 14, padding: 28, marginTop: 16 }}>
            <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Tu URL</div>
            <div style={{ fontFamily: 'monospace', fontSize: 16, color: '#1a1a1a', wordBreak: 'break-all', marginBottom: 18 }}>{url}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => copyText(url, 'url')} style={{ ...S.btnPrimary }}>
                {copied === 'url' ? '✓ Copiado' : 'Copiar link'}
              </button>
              <a href={url} target="_blank" rel="noopener" style={{ ...S.btnGhost, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                Ver mi landing →
              </a>
            </div>
          </div>

          {/* Compartir directo */}
          <h2 style={S.h2}>Compartir directo</h2>
          <p style={S.lead}>Un click y se abre la app correspondiente con el mensaje pre-llenado.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={waShare} target="_blank" rel="noopener" style={{ ...shareBtn, background: '#25D366', color: '#fff' }}>
              <span style={{ fontSize: 18 }}>💬</span> WhatsApp
            </a>
            <a href={emailShare} style={{ ...shareBtn, background: '#1a1a1a', color: '#fff' }}>
              <span style={{ fontSize: 18 }}>✉️</span> Email
            </a>
            <a href={twitterShare} target="_blank" rel="noopener" style={{ ...shareBtn, background: '#000', color: '#fff' }}>
              <span style={{ fontSize: 18 }}>𝕏</span> Twitter / X
            </a>
            <a href={linkedinShare} target="_blank" rel="noopener" style={{ ...shareBtn, background: '#0A66C2', color: '#fff' }}>
              <span style={{ fontSize: 18 }}>in</span> LinkedIn
            </a>
            <a href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`} target="_blank" rel="noopener" style={{ ...shareBtn, background: '#fff', color: '#1a1a1a', border: '1px solid #ddd' }}>
              <span style={{ fontSize: 18 }}>▦</span> QR
            </a>
          </div>

          {/* Plantillas copy-paste */}
          <h2 style={S.h2}>Plantillas listas</h2>
          <p style={S.lead}>Mensajes pre-redactados para distintos contextos. Click "copiar" y pega donde quieras.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {templates.map(tpl => (
              <div key={tpl.key} style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{tpl.label}</div>
                  <button onClick={() => copyText(tpl.text, tpl.key)} style={{ ...S.btnGhost, padding: '7px 14px', fontSize: 12 }}>
                    {copied === tpl.key ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
                <div style={{ fontSize: 13, color: '#555', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{tpl.text}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={S.empty}>Cargando…</div>
      )}

      <h2 style={S.h2}>Brand kit y materiales</h2>
      <p style={S.lead}>Logos, colores, captions listos, hashtags. Todo lo que necesitas para crear contenido profesional.</p>
      <a href="/partners/brand-kit" target="_blank" rel="noopener" style={{ ...S.btnPrimary, textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
        Abrir brand kit ↗
      </a>
    </div>
  );
}

// ─── Tab: Profile ───────────────────────────────────────────────
function ProfileTab() {
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  // password form state
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');

  useEffect(() => {
    fetch('/api/partner-portal/profile').then(r => r.json()).then(setProfile);
  }, []);

  if (!profile) return <div style={S.loading}>Cargando…</div>;

  const payout = profile.payout || {};
  const direccion = profile.direccion || {};

  async function save(updates: any) {
    setSaving(true); setMsg('');
    const res = await fetch('/api/partner-portal/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setSaving(false);
    if (res.ok) { setMsg('Guardado ✓'); setTimeout(() => setMsg(''), 2500); }
    else setMsg('Error al guardar');
  }

  async function changePassword() {
    setPwdMsg('');
    if (newPwd.length < 8) { setPwdMsg('Mínimo 8 caracteres'); return; }
    const res = await fetch('/api/partner-portal/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: curPwd, new_password: newPwd }),
    });
    const data = await res.json();
    if (res.ok) { setPwdMsg('Contraseña actualizada ✓'); setCurPwd(''); setNewPwd(''); }
    else setPwdMsg(data.error || 'Error');
  }

  return (
    <div>
      <h1 style={S.h1}>Mi perfil</h1>
      <p style={S.lead}>Tus datos de cobro, dirección y seguridad.</p>

      <section style={S.card}>
        <h2 style={S.cardTitle}>Datos básicos</h2>
        <div style={S.row}><span style={S.rowLabel}>Nombre</span><span>{profile.user?.nombre}</span></div>
        <div style={S.row}><span style={S.rowLabel}>Email</span><span>{profile.user?.email}</span></div>
        <div style={S.row}><span style={S.rowLabel}>Programa</span><span>{profile.invitation?.tipo || '—'}</span></div>
        <div style={S.row}><span style={S.rowLabel}>Comisión</span><span>{profile.user?.default_commission_pct ?? 0}%</span></div>
        <div style={S.row}><span style={S.rowLabel}>Vigencia</span><span>{fmtDate(profile.invitation?.vigencia)}</span></div>
      </section>

      {profile.firma_base64 && (
        <section style={S.card}>
          <h2 style={S.cardTitle}>Tu firma de aceptación</h2>
          <div style={S.subtxt}>
            Firmaste la invitación el <strong style={{ color: '#1a1a1a' }}>{fmtDate(profile.signed_at)}</strong>.
            {profile.approved_at && <> Aprobada por SACS el <strong style={{ color: '#1a1a1a' }}>{fmtDate(profile.approved_at)}</strong>.</>}
          </div>
          <div style={{ marginTop: 14, padding: 16, background: '#fafafa', border: '1px solid #ececec', borderRadius: 8, textAlign: 'center' }}>
            <img src={profile.firma_base64} alt="Tu firma" style={{ maxWidth: '100%', maxHeight: 140 }} />
          </div>
        </section>
      )}

      <section style={S.card}>
        <h2 style={S.cardTitle}>Datos de cobro</h2>
        <div style={S.subtxt}>
          Método actual: <strong style={{ color: '#1a1a1a' }}>{payout.method?.toUpperCase() || '—'}</strong>
        </div>
        {payout.method === 'clabe' && (
          <>
            <div style={S.row}><span style={S.rowLabel}>CLABE</span><span style={{ fontFamily: 'monospace' }}>{payout.clabe || '—'}</span></div>
            <div style={S.row}><span style={S.rowLabel}>Banco</span><span>{payout.banco || '—'}</span></div>
            <div style={S.row}><span style={S.rowLabel}>Titular</span><span>{payout.titular || '—'}</span></div>
            <div style={S.row}><span style={S.rowLabel}>RFC</span><span>{payout.rfc || '—'}</span></div>
          </>
        )}
        {payout.method === 'paypal' && (
          <div style={S.row}><span style={S.rowLabel}>PayPal</span><span>{payout.email || '—'}</span></div>
        )}
        {payout.method === 'mercadopago' && (
          <>
            <div style={S.row}><span style={S.rowLabel}>MP ID</span><span>{payout.mp_id || '—'}</span></div>
            <div style={S.row}><span style={S.rowLabel}>Titular</span><span>{payout.titular || '—'}</span></div>
          </>
        )}
        <div style={{ fontSize: 12, color: '#999', marginTop: 12 }}>
          Para cambiar tu método de cobro, escribe a partners@sacscloud.com.
        </div>
      </section>

      <section style={S.card}>
        <h2 style={S.cardTitle}>Dirección del negocio</h2>
        <div style={S.row}><span style={S.rowLabel}>Calle</span><span>{direccion.calle || '—'}</span></div>
        <div style={S.row}><span style={S.rowLabel}>Colonia</span><span>{direccion.colonia || '—'}</span></div>
        <div style={S.row}><span style={S.rowLabel}>CP</span><span>{direccion.cp || '—'}</span></div>
        <div style={S.row}><span style={S.rowLabel}>Ciudad</span><span>{direccion.ciudad || '—'}</span></div>
        <div style={S.row}><span style={S.rowLabel}>Estado</span><span>{direccion.estado || '—'}</span></div>
      </section>

      <section style={S.card}>
        <h2 style={S.cardTitle}>Cambiar contraseña</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
          <input type="password" placeholder="Contraseña actual" value={curPwd} onChange={e => setCurPwd(e.target.value)} style={S.input} />
          <input type="password" placeholder="Nueva contraseña (mín 8)" value={newPwd} onChange={e => setNewPwd(e.target.value)} style={S.input} />
          <button onClick={changePassword} style={S.btnPrimary} disabled={saving}>Actualizar</button>
          {pwdMsg && <div style={{ fontSize: 13, color: pwdMsg.includes('✓') ? '#1e8471' : '#b93333' }}>{pwdMsg}</div>}
        </div>
      </section>

      {msg && <div style={{ position: 'fixed', bottom: 80, right: 20, padding: '12px 16px', background: '#1a1a1a', color: '#fff', borderRadius: 8, fontSize: 13 }}>{msg}</div>}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────
function KpiCard({ label, value, sub, hint, accent }: { label: string; value: string; sub?: string; hint?: string; accent?: string }) {
  return (
    <div style={{ ...S.kpi, borderLeft: accent ? `3px solid ${accent}` : undefined }}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
      {sub && <div style={S.kpiSub}>{sub}</div>}
      {hint && <div style={{ ...S.subtxt, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#f5f6f8', fontFamily: 'var(--font-body)', color: '#1a1a1a' },
  topbar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 24px',
    background: '#fff', borderBottom: '1px solid #ececec',
    position: 'sticky', top: 0, zIndex: 10,
  },
  brand: { fontFamily: 'Clash Display, sans-serif', fontWeight: 700, fontSize: 22, color: '#1a1a1a', textDecoration: 'none', letterSpacing: '-0.02em' },
  brandSep: { color: '#ccc' },
  brandSub: { fontSize: 13, color: '#888', fontWeight: 500 },
  userName: { fontSize: 13, color: '#444', fontWeight: 600 },
  logoutBtn: { padding: '6px 12px', fontSize: 12, background: 'transparent', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', color: '#666', fontFamily: 'inherit' },

  body: { display: 'flex' },
  sidebar: { width: 220, padding: 16, display: 'flex', flexDirection: 'column', gap: 4, borderRight: '1px solid #ececec', background: '#fff', minHeight: 'calc(100vh - 53px)' },
  sideBtn: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px',
    background: 'transparent', border: 'none',
    borderRadius: 8, cursor: 'pointer', textAlign: 'left',
    fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
    transition: 'background 0.15s', textDecoration: 'none',
  },
  main: { flex: 1, padding: '32px 32px 80px', maxWidth: 1100, margin: '0 auto', width: '100%' },

  bottomNav: {
    display: 'none',
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#fff', borderTop: '1px solid #ececec',
    justifyContent: 'space-around', padding: '8px 4px 12px',
    zIndex: 20,
  },
  bottomBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' },

  h1: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.015em' },
  h2: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, margin: '32px 0 12px', letterSpacing: '-0.01em' },
  lead: { fontSize: 14, color: '#666', margin: '0 0 24px', lineHeight: 1.55 },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  kpi: { background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #ececec' },
  kpiLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 8 },
  kpiValue: { fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.015em', lineHeight: 1.1 },
  kpiSub: { fontSize: 12, color: '#666', marginTop: 4 },

  empty: { padding: 32, background: '#fff', border: '1px dashed #ddd', borderRadius: 12, color: '#888', textAlign: 'center', fontSize: 14 },
  emptyHint: {
    display: 'flex', flexDirection: 'column', gap: 4,
    padding: 20,
    background: 'linear-gradient(120deg, rgba(75,123,229,0.06), rgba(108,92,231,0.04))',
    border: '1px solid rgba(75,123,229,0.18)',
    borderRadius: 12,
    fontSize: 14,
    color: '#444',
    lineHeight: 1.55,
    marginBottom: 24,
  },
  welcomeCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    padding: 24,
    background: '#fff',
    border: '1px solid #ececec',
    borderLeft: '3px solid #4B7BE5',
    borderRadius: 12,
    marginBottom: 28,
    boxShadow: '0 4px 12px -6px rgba(75,123,229,0.12)',
  },
  loading: { padding: 32, color: '#888', textAlign: 'center' },
  error: { padding: 32, color: '#b93333', textAlign: 'center' },

  tableWrap: { overflowX: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #ececec' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '12px 16px', fontWeight: 700, color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #ececec' },
  td: { padding: '14px 16px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'top' },
  tr: { transition: 'background 0.1s' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },
  tag: { display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#666', background: '#f5f5f7' },
  subtxt: { fontSize: 12, color: '#999', marginTop: 2 },

  payCard: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, overflow: 'hidden' },
  paySummary: { padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', listStyle: 'none' },
  payItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', fontSize: 13, borderBottom: '1px dashed #f0f0f0' },

  card: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 20, marginBottom: 14 },
  cardTitle: { fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#1a1a1a' },
  row: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14, borderBottom: '1px solid #f5f5f5' },
  rowLabel: { color: '#888', fontWeight: 600 },
  input: { padding: '11px 14px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, outline: 'none', fontFamily: 'inherit' },
  btnPrimary: { padding: '11px 20px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost: { padding: '11px 18px', background: 'transparent', color: '#1a1a1a', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },

  fab: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    zIndex: 50,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '13px 20px',
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 8px 24px -8px rgba(26,26,46,0.45), 0 4px 12px -4px rgba(26,26,46,0.20)',
    transition: 'transform 0.18s, box-shadow 0.18s, background 0.18s',
  },
};

const shareBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '11px 18px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
  fontFamily: 'inherit',
  transition: 'transform 0.15s, opacity 0.15s',
};
