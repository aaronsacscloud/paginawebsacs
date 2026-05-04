import { useEffect, useState } from 'react';

type TabId = 'summary' | 'commissions' | 'payments' | 'leads' | 'content' | 'link' | 'profile' | 'actualizaciones' | 'brandkit' | 'cuenta-sacs' | 'certificaciones' | 'agreement';

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

// Translation maps
const ESTADO_ES: Record<string, string> = {
  pending: 'Pendiente',
  earned: 'Confirmada',
  paid: 'Pagada',
  cancelled: 'Cancelada',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};
const TIPO_ES: Record<string, string> = {
  prueba_gratis: 'Prueba gratis',
  demo_completada: 'Demo completada',
  venta_directa: 'Suscripción pagada',
  manual: 'Ajuste manual',
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
  const [counts, setCounts] = useState<{ commissions?: number; leads?: number; participacion?: string }>({});

  // Poll commissions for toasts + counts
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch('/api/partner-portal/pending');
        const data = await res.json();
        if (cancelled || !data.commissions) return;
        setCounts(c => ({ ...c, commissions: data.commissions.length }));
        const newEarned = data.commissions.filter((c: any) => c.status === 'earned' && !seenIds.has(c.id));
        if (newEarned.length > 0) {
          const total = newEarned.reduce((s: number, c: any) => s + Number(c.commission_amount || 0), 0);
          setToast({
            type: 'earned',
            msg: newEarned.length === 1 ? `Nuevo bono confirmado: $${total.toLocaleString('es-MX')}` : `${newEarned.length} bonos confirmados: $${total.toLocaleString('es-MX')}`,
            sub: 'Listo para tu próximo pago',
          });
          const next = new Set(seenIds);
          for (const c of newEarned) next.add(c.id);
          setSeenIds(next);
          try { localStorage.setItem('sacs_seen_commissions', JSON.stringify([...next])); } catch {}
        }
      } catch {/* swallow */}
    }
    const t1 = setTimeout(check, 4000);
    const t2 = setInterval(check, 60000);
    return () => { cancelled = true; clearTimeout(t1); clearInterval(t2); };
  }, [seenIds]);

  // Load lead count + participación once
  useEffect(() => {
    fetch('/api/partner-portal/leads').then(r => r.json()).then(d => {
      setCounts(c => ({ ...c, leads: (d.contacts?.length || 0) + (d.bookings?.length || 0) }));
    }).catch(() => {});
    fetch('/api/partner-portal/content').then(r => r.json()).then(d => {
      if (d?.summary) setCounts(c => ({ ...c, participacion: `${d.summary.puntos_mes}/${d.summary.meta}` }));
    }).catch(() => {});
  }, []);

  // Hash routing
  useEffect(() => {
    const valid: TabId[] = ['summary','commissions','payments','leads','content','link','profile','actualizaciones','brandkit','cuenta-sacs','certificaciones','agreement'];
    const hash = (window.location.hash || '').replace('#', '') as TabId;
    if (valid.includes(hash)) setTab(hash);
    const onHash = () => {
      const h = (window.location.hash || '').replace('#', '') as TabId;
      if (valid.includes(h)) setTab(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function go(t: TabId) {
    setTab(t);
    history.replaceState(null, '', `#${t}`);
    // Reset main scroll on tab change
    requestAnimationFrame(() => {
      const main = document.querySelector('[data-pp-main]') as HTMLElement | null;
      if (main) main.scrollTop = 0;
      else window.scrollTo({ top: 0 });
    });
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/partner/login';
  }

  const tabs: { id: TabId; label: string; badge?: string }[] = [
    { id: 'summary',         label: 'Resumen' },
    { id: 'commissions',     label: 'Comisiones', badge: counts.commissions ? String(counts.commissions) : undefined },
    { id: 'payments',        label: 'Pagos' },
    { id: 'leads',           label: 'Prospectos', badge: counts.leads ? String(counts.leads) : undefined },
    { id: 'link',            label: 'Mi link' },
    { id: 'content',         label: 'Mi participación', badge: counts.participacion },
    { id: 'actualizaciones', label: 'Actualizaciones' },
    { id: 'profile',         label: 'Mi perfil' },
  ];
  const tabsExtra: { id: TabId; label: string }[] = [
    { id: 'agreement',       label: 'Mi acuerdo' },
    { id: 'certificaciones', label: 'Certificaciones' },
    { id: 'brandkit',        label: 'Brand kit' },
    { id: 'cuenta-sacs',     label: 'Tu acceso a SACS' },
  ];

  const initials = (initialUser.nombre || initialUser.email || '?').charAt(0).toUpperCase();

  return (
    <div style={S.root}>
      {/* Topbar */}
      <header style={S.topbar}>
        <a href="/" style={S.brand}>Sacs</a>
        <span style={S.brandSep}>·</span>
        <span style={S.brandSub}>Portal de partner</span>
        <div style={{ flex: 1 }} />
        <span style={S.userName}>{initialUser.nombre || initialUser.email}</span>
        <span style={S.avatar}>{initials}</span>
        <button onClick={logout} style={S.logoutBtn}>Salir</button>
      </header>

      {/* Toast */}
      {toast && (
        <div role="status" style={S.toast}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: toast.type === 'earned' ? '#1A8F7A' : '#3764c4', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 4 }}>
                {toast.type === 'earned' ? 'Bono confirmado' : 'Pago liquidado'}
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

      <div style={S.body}>
        <nav style={S.sidebar} className="pp-sidebar">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              style={{ ...S.sideBtn, ...(tab === t.id ? S.sideBtnActive : {}) }}
            >
              <span>{t.label}</span>
              {t.badge && <em style={{ ...S.sideBadge, ...(tab === t.id ? S.sideBadgeActive : {}) }}>{t.badge}</em>}
            </button>
          ))}
          <div style={S.sideDivider} />
          {tabsExtra.map(t => (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              style={{ ...S.sideBtn, ...(tab === t.id ? S.sideBtnActive : {}) }}
            >
              <span>{t.label}</span>
            </button>
          ))}
          <div style={S.sidebarFoot}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{initialUser.nombre || 'Partner'}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{initialUser.email}</div>
          </div>
        </nav>

        <main style={S.main} className="pp-main" data-pp-main>
          <div style={S.mainInner}>
            {tab === 'summary'         && <SummaryTab go={go} />}
            {tab === 'commissions'     && <CommissionsTab />}
            {tab === 'payments'        && <PaymentsTab />}
            {tab === 'leads'           && <LeadsTab />}
            {tab === 'content'         && <ContentTab />}
            {tab === 'link'            && <LinkTab go={go} />}
            {tab === 'profile'         && <ProfileTab />}
            {tab === 'actualizaciones' && <ActualizacionesTab />}
            {tab === 'brandkit'        && <BrandkitTab />}
            {tab === 'cuenta-sacs'     && <CuentaSacsTab user={initialUser} />}
            {tab === 'certificaciones' && <CertificacionesTab />}
            {tab === 'agreement'       && <AgreementTab user={initialUser} />}
          </div>
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
              fontWeight: tab === t.id ? 600 : 500,
            }}
          >
            <span style={{ fontSize: 11 }}>{t.label}</span>
          </button>
        ))}
      </nav>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 900px) {
          .pp-sidebar { display: none !important; }
          .pp-bottomnav { display: flex !important; }
          .pp-main { padding-bottom: 80px !important; }
        }
        @media (min-width: 901px) {
          .pp-bottomnav { display: none !important; }
        }
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        details summary::-webkit-details-marker { display: none; }
        details summary { list-style: none; }
      ` }} />
    </div>
  );
}

// ─── Tutorial banner ────────────────────────────────────────────
function Tut({ children }: { children: React.ReactNode }) {
  return (
    <div style={S.tut}>
      <div style={S.tutIcon}><i>i</i></div>
      <div style={S.tutBody}>{children}</div>
    </div>
  );
}

// ─── Tab: Summary ───────────────────────────────────────────────
function SummaryTab({ go }: { go: (t: TabId) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/partner-portal/summary').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div style={S.loading}>Cargando…</div>;
  if (!data || data.error) return <div style={S.error}>No se pudo cargar el resumen</div>;

  const isEmpty = (data.leads?.total || 0) === 0 && (data.proximoPago || 0) === 0 && (data.pendiente || 0) === 0;
  const nombre = data.user?.nombre?.split(' ')[0] || 'partner';

  return (
    <div>
      <Tut>
        <strong>Tu pantalla de inicio.</strong> Cada que entres al portal verás el resumen
        de los últimos 30 días: cuánto vas a cobrar pronto, cuánto está pendiente de
        verificar, qué bonos se generaron este mes y de dónde vienen tus mejores leads.
      </Tut>

      <h1 style={S.h1}>Hola, {nombre}</h1>
      <p style={S.lead}>Aquí está el resumen de tu actividad como partner SACS.</p>

      {isEmpty && (
        <div style={S.emptyHint}>
          <strong>Tu portal está listo, pero todavía no hay actividad.</strong>
          <span> Comparte tu link único en redes — cada activación genera un bono que verás aquí en tiempo real.</span>
          <button onClick={() => go('link')} style={{ ...S.btnPrimary, alignSelf: 'flex-start', marginTop: 12 }}>Obtener mi link →</button>
        </div>
      )}

      <h2 style={S.h2}>Tus números este mes</h2>
      <div style={S.kpiGrid}>
        <Kpi label="Próximo pago" value={fmt(data.proximoPago)} accent="#2AB5A0" hint="Confirmadas · se pagan el día 5" />
        <Kpi label="Pendiente verificar" value={fmt(data.pendiente)} accent="#E8A838" hint="En revisión por SACS" />
        <Kpi label="Total año" value={fmt(data.totalAno)} accent="#4B7BE5" />
        <Kpi label="Tu comisión" value={`${data.user?.default_commission_pct ?? 50}%`} accent="#6C5CE7" hint="Sobre cada venta directa" />
      </div>

      <div style={S.note}>
        <strong>Diferencia entre "próximo pago" y "pendiente":</strong> El próximo pago
        es dinero que ya se confirmó como tuyo (confirmada) y se te deposita el día 5 del mes.
        El pendiente son bonos que SACS está validando (ej. revisar que el lead sea real)
        y pasarán a próximo pago cuando se aprueben.
      </div>

      <h2 style={S.h2}>Bonos del mes · breakdown</h2>
      <div style={S.kpiGrid3}>
        <Kpi label="Pruebas gratis" value={String(data.bonosMes?.prueba_gratis_count || 0)}
          hint={`${fmt(data.bonosMes?.prueba_gratis_sum || 0)} en bonos · $500 c/u`} accent="#2AB5A0" />
        <Kpi label="Demos completadas" value={String(data.bonosMes?.demo_completada_count || 0)}
          hint={`${fmt(data.bonosMes?.demo_completada_sum || 0)} en bonos · $300 c/u`} accent="#4B7BE5" />
        <Kpi label="Suscripciones pagadas" value={String(data.bonosMes?.venta_directa_count || 0)}
          hint={`${fmt(data.bonosMes?.venta_directa_sum || 0)} en comisiones · 50% del cierre`} accent="#6C5CE7" />
      </div>

      <h2 style={S.h2}>Tus prospectos atribuidos</h2>
      <div style={S.kpiGrid3}>
        <Kpi label="Leads totales" value={String(data.leads?.total || 0)} />
        <Kpi label="Demos agendados" value={String(data.leads?.bookings || 0)} accent="#4B7BE5" />
        <Kpi label="Demos completados" value={String(data.leads?.bookings_realizadas || 0)} accent="#2AB5A0" />
      </div>

      {data.topFuentes?.length > 0 && (
        <>
          <h2 style={S.h2}>De dónde vienen tus leads</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(() => {
              const totalLeads = (data.topFuentes || []).reduce((s: number, f: any) => s + f.count, 0);
              return (data.topFuentes as any[]).map((f, idx) => {
                const pct = totalLeads > 0 ? Math.round((f.count / totalLeads) * 100) : 0;
                const label = f.fuente === 'partner-link' ? 'Tu link directo'
                  : f.fuente === 'website-form' ? 'Form del sitio'
                  : f.fuente === 'sin-fuente' ? 'Sin clasificar'
                  : f.fuente;
                return (
                  <div key={idx} style={S.barRow}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a', textTransform: 'capitalize' }}>{label}</span>
                    <div style={{ background: '#f5f5f3', borderRadius: 999, height: 8, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ background: 'linear-gradient(90deg, #6CD6C2, #4B7BE5)', height: '100%', width: `${pct}%`, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 13, color: '#555', textAlign: 'right', fontWeight: 600 }}>{f.count} <span style={{ color: '#999' }}>· {pct}%</span></span>
                  </div>
                );
              });
            })()}
          </div>
          <div style={S.note}>
            <strong>¿Por qué importa?</strong> Si Instagram te trae más leads que TikTok,
            sabes dónde vale la pena invertir tu tiempo. Cuando hagas un video que jale, lo verás aquí.
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Commissions ───────────────────────────────────────────
function CommissionsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState('todas');
  const [filterTipo, setFilterTipo] = useState('todos');

  useEffect(() => {
    fetch('/api/partner-portal/pending').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);
  if (loading) return <div style={S.loading}>Cargando…</div>;
  if (!data || data.error) return <div style={S.error}>No se pudo cargar</div>;

  const all = data.commissions || [];
  const counts = {
    todas: all.length,
    pending: all.filter((c: any) => c.status === 'pending').length,
    earned: all.filter((c: any) => c.status === 'earned').length,
    paid: all.filter((c: any) => c.status === 'paid').length,
    cancelled: all.filter((c: any) => c.status === 'cancelled').length,
  };
  const tipoCounts = {
    prueba: all.filter((c: any) => c.tipo === 'prueba_gratis').length,
    demo: all.filter((c: any) => c.tipo === 'demo_completada').length,
    venta: all.filter((c: any) => c.tipo === 'venta_directa').length,
  };

  const filtered = all.filter((c: any) => {
    const matchEstado = filterEstado === 'todas' || c.status === filterEstado;
    const matchTipo = filterTipo === 'todos'
      || (filterTipo === 'prueba' && c.tipo === 'prueba_gratis')
      || (filterTipo === 'demo' && c.tipo === 'demo_completada')
      || (filterTipo === 'venta' && c.tipo === 'venta_directa');
    return matchEstado && matchTipo;
  });

  const tagColor = (status: string) => {
    if (status === 'earned') return { bg: 'rgba(75,123,229,0.12)', color: '#3764c4' };
    if (status === 'pending') return { bg: 'rgba(232,168,56,0.14)', color: '#b07b15' };
    if (status === 'paid') return { bg: 'rgba(42,181,160,0.12)', color: '#1A8F7A' };
    if (status === 'cancelled') return { bg: 'rgba(220,38,38,0.10)', color: '#c62828' };
    return { bg: '#f5f5f7', color: '#666' };
  };

  return (
    <div>
      <Tut>
        <strong>Cada bono y comisión que generas, una por una.</strong> Aparecen en 4
        estados: <em style={{ ...S.tag, ...tagColor('pending'), fontSize: 10, padding: '2px 7px' }}>Pendiente</em> en revisión por SACS,
        <em style={{ ...S.tag, ...tagColor('earned'), fontSize: 10, padding: '2px 7px', marginLeft: 4 }}>Confirmada</em> ya es tuya y entra al próximo pago,
        <em style={{ ...S.tag, ...tagColor('paid'), fontSize: 10, padding: '2px 7px', marginLeft: 4 }}>Pagada</em> ya depositada y
        <em style={{ ...S.tag, ...tagColor('cancelled'), fontSize: 10, padding: '2px 7px', marginLeft: 4 }}>Cancelada</em> rechazada por fraude o duplicado.
      </Tut>

      <h1 style={S.h1}>Comisiones</h1>
      <p style={S.lead}>{all.length} comisiones registradas · <strong style={{ color: '#3764c4' }}>{fmt(data.earnedSum)}</strong> en próximo pago.</p>

      {/* Filtros */}
      <div style={S.filtersRow}>
        <FilterPill active={filterEstado === 'todas'} onClick={() => setFilterEstado('todas')}>Todas ({counts.todas})</FilterPill>
        <FilterPill active={filterEstado === 'pending'} onClick={() => setFilterEstado('pending')}>Pendientes ({counts.pending})</FilterPill>
        <FilterPill active={filterEstado === 'earned'} onClick={() => setFilterEstado('earned')}>Confirmadas ({counts.earned})</FilterPill>
        <FilterPill active={filterEstado === 'paid'} onClick={() => setFilterEstado('paid')}>Pagadas ({counts.paid})</FilterPill>
        {counts.cancelled > 0 && <FilterPill active={filterEstado === 'cancelled'} onClick={() => setFilterEstado('cancelled')}>Canceladas ({counts.cancelled})</FilterPill>}
      </div>
      <div style={{ ...S.filtersRow, marginBottom: 28 }}>
        <span style={S.filterLbl}>Tipo:</span>
        <FilterPill active={filterTipo === 'todos'} onClick={() => setFilterTipo('todos')}>Todos</FilterPill>
        <FilterPill active={filterTipo === 'prueba'} onClick={() => setFilterTipo('prueba')}>Prueba gratis ({tipoCounts.prueba})</FilterPill>
        <FilterPill active={filterTipo === 'demo'} onClick={() => setFilterTipo('demo')}>Demo completada ({tipoCounts.demo})</FilterPill>
        <FilterPill active={filterTipo === 'venta'} onClick={() => setFilterTipo('venta')}>Suscripción pagada ({tipoCounts.venta})</FilterPill>
      </div>

      {filtered.length === 0 ? (
        <div style={S.empty}>
          <strong style={{ display: 'block', color: '#1a1a1a', marginBottom: 6, fontSize: 16 }}>
            {all.length === 0 ? 'Aún no tienes comisiones' : 'No hay comisiones que coincidan con este filtro'}
          </strong>
          {all.length === 0 && <div style={{ marginBottom: 14 }}>Comparte tu link y empieza a generar bonos automáticamente.</div>}
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Fecha</th>
                <th style={S.th}>Prospecto · Plan</th>
                <th style={S.th}>Tipo</th>
                <th style={S.th}>Estado</th>
                <th style={S.thRight}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => {
                const c = tagColor(r.status);
                const isCancelled = r.status === 'cancelled';
                return (
                  <tr key={r.id} style={{ ...S.tr, opacity: isCancelled ? 0.5 : 1 }}>
                    <td style={S.td}>{fmtDate(r.created_at)}</td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600 }}>{r.contact?.nombre || r.deal?.nombre || r.booking?.invitee_nombre || r.nota || '—'}</div>
                      {(r.contact?.email || r.deal?.valor_total) && (
                        <div style={S.subtxt}>
                          {r.contact?.email}
                          {r.deal?.valor_total && ` · Plan: ${fmt(r.deal.valor_total)}/año`}
                        </div>
                      )}
                    </td>
                    <td style={S.td}>{TIPO_ES[r.tipo] || r.tipo}</td>
                    <td style={S.td}>
                      <span style={{ ...S.tag, background: c.bg, color: c.color }}>{ESTADO_ES[r.status] || r.status}</span>
                    </td>
                    <td style={{ ...S.tdRight, fontWeight: 700, textDecoration: isCancelled ? 'line-through' : 'none' }}>{fmt(r.commission_amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={S.footStats}>
        <strong>Pendientes:</strong> {fmt(data.pendingSum)} · <strong>Confirmadas:</strong> {fmt(data.earnedSum)}
      </div>
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
      <Tut>
        <strong>Cada vez que SACS te paga, queda aquí.</strong> Los pagos se hacen el día
        5 de cada mes a la cuenta que registraste en "Mi perfil". Cada payout incluye
        todas las comisiones confirmadas hasta el día 1 — puedes expandir cualquiera
        para ver el desglose con plan contratado y datos del cliente.
      </Tut>

      <h1 style={S.h1}>Historial de pagos</h1>
      <p style={S.lead}>Total recibido de por vida: <strong>{fmt(data.total_paid_lifetime || 0)}</strong></p>

      {(!data.payments || data.payments.length === 0) ? (
        <div style={S.empty}>
          <strong style={{ display: 'block', color: '#1a1a1a', marginBottom: 6, fontSize: 16 }}>Aún no hay pagos liquidados</strong>
          <div>Cuando SACS te transfiera, aparecerá aquí con desglose completo, fecha y referencia bancaria.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.payments.map((p: any, i: number) => (
            <details key={i} style={S.payCard}>
              <summary style={S.paySummary}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: '#1a1a1a' }}>{fmtDate(p.paid_at)}</div>
                  <div style={S.payRef}>Ref: {p.payment_reference}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, color: '#1A8F7A', letterSpacing: '-0.025em' }}>{fmt(p.total)}</div>
              </summary>
              <div style={S.payMetaGrid}>
                <div><div style={S.metaLbl}>Depositado</div><div style={S.metaVal}>{fmtDate(p.paid_at)}</div></div>
                <div><div style={S.metaLbl}>Cuenta</div><div style={S.metaVal}>Tu cuenta registrada</div></div>
                <div><div style={S.metaLbl}>Comisiones</div><div style={S.metaVal}>{p.items?.length || 0} confirmadas</div></div>
                <div><div style={S.metaLbl}>CFDI</div><div style={S.metaVal}>Disponible</div></div>
              </div>
              <div style={S.payList}>
                {p.items?.map((it: any) => (
                  <div key={it.id} style={S.payItem}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: 14 }}>
                        {it.contact?.nombre || it.deal?.nombre || it.booking?.invitee_nombre || it.nota || 'Comisión'}
                      </div>
                      <div style={S.subtxt}>
                        {TIPO_ES[it.tipo] || it.tipo}
                        {it.deal?.valor_total && ` · Plan ${fmt(it.deal.valor_total)}/año`}
                        {it.nota && ` · ${it.nota}`}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 15 }}>{fmt(it.commission_amount)}</div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}

      <div style={S.note}>
        <strong>¿Cómo se calcula cada pago?</strong> El día 1 del mes SACS suma todas
        las comisiones que pasaron a "confirmada" durante el mes anterior. El día 5 te
        llega el depósito a tu CLABE/PayPal/MP con la referencia única que ves arriba.
        Si una comisión llega tarde, entra al pago del mes siguiente.
      </div>
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

  const contacts = data.contacts || [];
  const bookings = data.bookings || [];
  const cliente = contacts.filter((c: any) => c.lifecycle_stage === 'cliente').length;
  const demoRealizada = bookings.filter((b: any) => b.estado === 'realizada').length;
  const demoAgendada = bookings.filter((b: any) => b.estado === 'agendada' || b.estado === 'confirmada').length;
  const prueba = contacts.filter((c: any) => c.lifecycle_stage === 'oportunidad' || c.lifecycle_stage === 'prueba').length;
  const leadNuevo = contacts.filter((c: any) => c.lifecycle_stage === 'lead' || !c.lifecycle_stage).length;

  return (
    <div>
      <Tut>
        <strong>Cada visitante que llega por tu link único, atribuido a ti.</strong>
        Aparece desde que es <em>lead nuevo</em> hasta que cierra como <em>cliente</em>.
        Verás aquí el funnel completo en tiempo real.
      </Tut>

      <h1 style={S.h1}>Tus prospectos</h1>
      <p style={S.lead}>{contacts.length} prospectos atribuidos a tu link · funnel del mes.</p>

      {/* Funnel mini */}
      <div style={S.funnel}>
        <FunnelStep n={contacts.length} lbl="Leads totales" />
        <FunnelArrow />
        <FunnelStep n={prueba} lbl="Prueba activa" />
        <FunnelArrow />
        <FunnelStep n={demoAgendada} lbl="Demo agendada" />
        <FunnelArrow />
        <FunnelStep n={demoRealizada} lbl="Demo realizada" />
        <FunnelArrow />
        <FunnelStep n={cliente} lbl="Cliente" win />
      </div>

      <h2 style={S.h2}>Contactos atribuidos · {contacts.length}</h2>
      {!contacts.length ? (
        <div style={S.empty}>
          <strong style={{ display: 'block', color: '#1a1a1a', marginBottom: 6, fontSize: 16 }}>Sin contactos atribuidos todavía</strong>
          <div>Cuando alguien llegue a SACS por tu link, aparece aquí con su etapa y bono asociado.</div>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Prospecto</th>
                <th style={S.th}>Email</th>
                <th style={S.th}>Etapa</th>
                <th style={S.th}>Plan / Interés</th>
                <th style={S.th}>Llegó</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c: any) => (
                <tr key={c.id} style={S.tr}>
                  <td style={S.td}><strong>{c.nombre}</strong></td>
                  <td style={{ ...S.td, color: '#666', fontSize: 13 }}>{c.email}</td>
                  <td style={S.td}><span style={S.tag}>{c.lifecycle_stage || 'lead'}</span></td>
                  <td style={S.td}>{c.plan_interes || c.interes || '—'}</td>
                  <td style={{ ...S.td, fontSize: 12, color: '#888' }}>{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={S.h2}>Demos agendadas · {bookings.length}</h2>
      {!bookings.length ? (
        <div style={S.empty}>
          <strong style={{ display: 'block', color: '#1a1a1a', marginBottom: 6, fontSize: 16 }}>Sin demos agendados</strong>
          <div>Cuando un prospecto reserve una demo por tu link, aparece aquí. Demo realizada → bono $300 automático.</div>
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
              {bookings.map((b: any) => {
                const stateColor = b.estado === 'realizada' ? { bg: 'rgba(42,181,160,0.12)', color: '#1A8F7A' }
                  : b.estado === 'no_show' ? { bg: 'rgba(220,38,38,0.10)', color: '#c62828' }
                  : { bg: 'rgba(75,123,229,0.12)', color: '#3764c4' };
                return (
                  <tr key={b.id} style={S.tr}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600 }}>{b.invitee_nombre}</div>
                      <div style={S.subtxt}>{b.invitee_email}</div>
                    </td>
                    <td style={S.td}>{fmtDate(b.fecha)} · {b.hora_inicio?.slice(0, 5)}</td>
                    <td style={S.td}><span style={{ ...S.tag, background: stateColor.bg, color: stateColor.color }}>{b.estado}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Content (Mi participación) ────────────────────────────
function ContentTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [catFilter, setCatFilter] = useState<'todos' | 'contenido' | 'filantropia'>('todos');

  const [formUrl, setFormUrl] = useState('');
  const [formTipo, setFormTipo] = useState('');
  const [formPlat, setFormPlat] = useState('');
  const [formDesc, setFormDesc] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/partner-portal/content');
    const d = await res.json();
    setData(d);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!formUrl || !formTipo) {
      setMsg({ text: 'URL y tipo son requeridos.', ok: false });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/partner-portal/content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formUrl, tipo: formTipo, plataforma: formPlat || null, descripcion: formDesc || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error');
      setMsg({ text: '✓ Enviado para revisión. Recibirás email con la decisión.', ok: true });
      setFormUrl(''); setFormDesc(''); setFormPlat(''); setFormTipo('');
      setShowForm(false);
      load();
    } catch (e: any) {
      setMsg({ text: e.message || 'Error al enviar', ok: false });
    } finally { setSubmitting(false); }
  }

  if (loading) return <div style={S.loading}>Cargando…</div>;
  if (!data) return <div style={S.error}>No se pudo cargar.</div>;

  const sum = data.summary;
  const tipos: any[] = data.tipos || [];
  const items: any[] = data.items || [];
  const faltan = Math.max(0, sum.meta - sum.puntos_mes);

  // Filtros de catálogo
  const tiposContenido = tipos.filter(t => (t.categoria || 'contenido') === 'contenido');
  const tiposFilantropia = tipos.filter(t => t.categoria === 'filantropia');
  const tiposFiltrados = catFilter === 'todos' ? tipos
    : catFilter === 'contenido' ? tiposContenido
    : tiposFilantropia;

  // Required total this month (with carryover if any)
  const requiredThis = sum.required_this_month || sum.meta;
  const faltanReal = Math.max(0, requiredThis - sum.puntos_mes);

  return (
    <div>
      <Tut>
        <strong>Tu acuerdo de embajador establece {sum.meta} puntos mínimos al mes.</strong>
        Aquí registras videos, posts y acciones filantrópicas para acumular puntos.
        Si no llegas a la meta, el déficit se carga al siguiente mes. <strong>3 meses
        consecutivos sin meta = baja automática del programa.</strong>
      </Tut>

      <h1 style={S.h1}>Mi participación</h1>
      <p style={S.lead}>
        Mes en curso · cierre el día 1 de cada mes · suma puntos publicando contenido
        o realizando acciones filantrópicas.
      </p>

      {/* Suspended banner */}
      {sum.suspended && (
        <div style={S.statusBannerSuspended}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#c62828', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Cuenta suspendida</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>Tu programa de partner fue suspendido automáticamente</div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            {sum.suspension_reason || `3 meses consecutivos sin alcanzar ${sum.meta} pts/mes.`}
            {' '}Si quieres reactivar tu cuenta, escribe a <a href="mailto:partners@sacscloud.com" style={{ color: '#4B7BE5' }}>partners@sacscloud.com</a> con tu plan de acción.
          </div>
        </div>
      )}

      {/* Final warning banner */}
      {sum.status_level === 'final_warning' && !sum.suspended && (
        <div style={S.statusBannerFinal}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#c62828', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>⚠ Último mes</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>2 meses sin meta — este es tu último mes para evitar suspensión</div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            Necesitas <strong>{requiredThis} pts</strong> este mes ({sum.meta} normales + {sum.carry_deficit} de carry-over). Si no llegas, tu cuenta se suspende automáticamente el día 1 del próximo mes. ¿Necesitas ayuda? Escríbenos.
          </div>
        </div>
      )}

      {/* Warning banner */}
      {sum.status_level === 'warning' && (
        <div style={S.statusBannerWarning}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#b07b15', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>⚠ Mes anterior por debajo</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>El mes pasado quedaste corto por {sum.carry_deficit} pts</div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            Este mes necesitas <strong>{requiredThis} pts</strong> ({sum.meta} normales + {sum.carry_deficit} de carry-over) para no acumular un segundo strike.
          </div>
        </div>
      )}

      {/* Status + Countdown grande */}
      <div style={S.partStatus}>
        <div style={S.partStatusHead}>
          <div>
            <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 }}>Tu progreso este mes</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#888', fontWeight: 400 }}>
              <strong style={{ fontSize: 48, fontWeight: 500, color: '#1a1a1a', letterSpacing: '-0.035em', marginRight: 6, display: 'inline-block', lineHeight: 1 }}>{sum.puntos_mes}</strong>
              / {requiredThis} pts
              {requiredThis > sum.meta && <span style={{ fontSize: 13, color: '#b07b15', marginLeft: 8 }}>(incluye {sum.carry_deficit} de carry-over)</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {faltanReal > 0 ? (
              <>
                <div style={{ fontWeight: 700, color: '#1a1a1a' }}>Te faltan {faltanReal} pts</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Sugerencia: 1 IG Reel (20 pts) + 1 acción filantrópica (15-25 pts)</div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, color: '#1A8F7A' }}>Meta cumplida ✓</div>
                {sum.puntos_acumulados > 0 && <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>+{sum.puntos_acumulados} pts acumulados</div>}
              </>
            )}
          </div>
        </div>
        <div style={S.partBar}>
          <div style={{ ...S.partBarFill, width: `${Math.min(100, sum.progreso_pct)}%`, background: faltanReal === 0 ? 'linear-gradient(90deg, #2AB5A0, #1A8F7A)' : undefined }} />
        </div>
        <div style={{ marginTop: 14, fontSize: 13, color: '#888' }}>
          {sum.pending_count} pendientes · {sum.approved_count} aprobados
          {sum.rejected_count > 0 && <span style={{ color: '#c62828' }}> · {sum.rejected_count} rechazados</span>}
        </div>
      </div>

      {/* Countdown */}
      <div style={S.countdownGrid}>
        <div style={S.countdownCard}>
          <div style={S.countdownNum}>{sum.days_remaining}</div>
          <div style={S.countdownLbl}>días para cerrar el mes</div>
          <div style={S.countdownHint}>Reset: {new Date(sum.reset_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</div>
        </div>
        <div style={S.countdownCard}>
          <div style={S.countdownNum}>{Math.round(((requiredThis - sum.puntos_mes) / Math.max(1, sum.days_remaining)) * 10) / 10}</div>
          <div style={S.countdownLbl}>pts/día requeridos</div>
          <div style={S.countdownHint}>Para llegar a {requiredThis} a tiempo</div>
        </div>
        <div style={S.countdownCard}>
          <div style={S.countdownNum}>{sum.consecutive_failed_months}</div>
          <div style={S.countdownLbl}>strikes activos</div>
          <div style={S.countdownHint}>0 = limpio · 3 = baja automática</div>
        </div>
      </div>

      {/* Filtro de categoría */}
      <h2 style={S.h2}>Cómo sumar puntos</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <FilterPill active={catFilter === 'todos'} onClick={() => setCatFilter('todos')}>Todos ({tipos.length})</FilterPill>
        <FilterPill active={catFilter === 'contenido'} onClick={() => setCatFilter('contenido')}>Contenido ({tiposContenido.length})</FilterPill>
        <FilterPill active={catFilter === 'filantropia'} onClick={() => setCatFilter('filantropia')}>Filantropía ({tiposFilantropia.length})</FilterPill>
      </div>
      {catFilter === 'filantropia' && (
        <div style={S.note}>
          <strong>¿Por qué filantropía cuenta?</strong> Si un mes no puedes generar contenido,
          puedes cubrir tus puntos con acciones que ayudan a otras personas. SACS valida con
          una foto/post como evidencia. Suma exactamente igual a tus 100 pts mensuales.
        </div>
      )}
      <div style={S.puntosGrid}>
        {tiposFiltrados.map(t => (
          <div key={t.id} style={{ ...S.puntosCard, ...(t.categoria === 'filantropia' ? { borderLeft: '3px solid #2AB5A0' } : {}) }}>
            <div style={S.puntosPts}>{t.puntos}</div>
            <div style={S.puntosName}>{t.nombre}</div>
            <div style={S.puntosDesc}>{t.descripcion}</div>
          </div>
        ))}
      </div>

      {/* Form colapsable */}
      <h2 style={S.h2}>Tus piezas publicadas · {items.length}</h2>
      {!showForm && (
        <button onClick={() => setShowForm(true)} style={{ ...S.btnPrimary, marginBottom: 16 }}>+ Registrar nueva pieza</button>
      )}
      {showForm && (
        <form onSubmit={submit} style={S.partForm}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...S.h3, margin: 0 }}>Nueva pieza</h3>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', fontSize: 18, color: '#999', cursor: 'pointer' }}>×</button>
          </div>
          <div style={S.formGrid}>
            <label style={S.field}>
              <span style={S.fieldLbl}>URL del contenido *</span>
              <input type="url" required placeholder="https://www.tiktok.com/@usuario/video/…" value={formUrl} onChange={e => setFormUrl(e.target.value)} style={S.input} />
            </label>
            <label style={S.field}>
              <span style={S.fieldLbl}>Tipo de contenido *</span>
              <select required value={formTipo} onChange={e => setFormTipo(e.target.value)} style={S.input}>
                <option value="">Elige uno…</option>
                {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.puntos} pts)</option>)}
              </select>
            </label>
            <label style={S.field}>
              <span style={S.fieldLbl}>Plataforma</span>
              <select value={formPlat} onChange={e => setFormPlat(e.target.value)} style={S.input}>
                <option value="">Elige una…</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="linkedin">LinkedIn</option>
                <option value="twitter">X / Twitter</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label style={{ ...S.field, gridColumn: '1 / -1' }}>
              <span style={S.fieldLbl}>Descripción corta (opcional)</span>
              <textarea rows={2} value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Tema, palabras clave, contexto…" style={{ ...S.input, resize: 'vertical' }} />
            </label>
          </div>
          <button type="submit" disabled={submitting} style={{ ...S.btnPrimary, marginTop: 14 }}>
            {submitting ? 'Enviando…' : 'Enviar para revisión'}
          </button>
          {msg && (
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, fontSize: 13, background: msg.ok ? 'rgba(42,181,160,0.10)' : 'rgba(229,75,75,0.08)', color: msg.ok ? '#1A8F7A' : '#b93333' }}>
              {msg.text}
            </div>
          )}
        </form>
      )}

      {items.length === 0 ? (
        <div style={S.empty}>
          <strong style={{ display: 'block', color: '#1a1a1a', marginBottom: 6, fontSize: 16 }}>Sin contenido enviado todavía</strong>
          <div>Empieza con un story de 10 puntos — toma 5 minutos.</div>
        </div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Fecha</th>
                <th style={S.th}>Plataforma</th>
                <th style={S.th}>Contenido</th>
                <th style={S.th}>Estado</th>
                <th style={S.thRight}>Puntos</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: any) => {
                const tipoMeta = tipos.find(t => t.id === it.tipo);
                const c = it.estado === 'approved' ? { bg: 'rgba(42,181,160,0.12)', color: '#1A8F7A' }
                  : it.estado === 'rejected' ? { bg: 'rgba(220,38,38,0.10)', color: '#c62828' }
                  : { bg: 'rgba(232,168,56,0.14)', color: '#b07b15' };
                return (
                  <tr key={it.id} style={S.tr}>
                    <td style={S.td}>{fmtDate(it.created_at)}</td>
                    <td style={S.td}>{it.plataforma || '—'}<div style={S.subtxt}>{tipoMeta?.nombre || it.tipo}</div></td>
                    <td style={S.td}>
                      <a href={it.url} target="_blank" rel="noopener" style={{ color: '#4B7BE5', fontSize: 13, wordBreak: 'break-all' }}>
                        {it.url.length > 50 ? it.url.slice(0, 50) + '…' : it.url}
                      </a>
                      {it.descripcion && <div style={S.subtxt}>{it.descripcion}</div>}
                      {it.estado === 'rejected' && it.nota_admin && <div style={{ ...S.subtxt, color: '#c62828' }}>Motivo: {it.nota_admin}</div>}
                    </td>
                    <td style={S.td}>
                      <span style={{ ...S.tag, background: c.bg, color: c.color }}>{ESTADO_ES[it.estado] || it.estado}</span>
                    </td>
                    <td style={{ ...S.tdRight, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                      {it.estado === 'approved' ? `+${it.puntos}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={S.footStats}>
        <strong>Promedio últimos 6 meses:</strong> {Math.round(sum.puntos_mes)} pts/mes · <strong>Cumpliendo el acuerdo</strong>
      </div>
    </div>
  );
}

// ─── Tab: Link ──────────────────────────────────────────────────
function LinkTab({ go }: { go: (t: TabId) => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/partner-portal/profile').then(r => r.json()).then(setProfile);
    fetch('/api/partner-portal/link-stats').then(r => r.json()).then(setStats).catch(() => {});
  }, []);
  const url = profile?.partnerLandingUrl || '';
  const slug = url.replace(/^https?:\/\/[^/]+\/p\//, '');
  const nombre = profile?.user?.nombre?.split(' ')[0] || 'tu asesor';

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const templates = url ? [
    {
      key: 'whatsapp-friend',
      label: 'Para WhatsApp · "Te recomiendo SACS"',
      text: `¡Hola! Te recomiendo SACS, el sistema que uso para mi negocio. Es un POS + inventario + e-commerce + IA todo en uno. Mira aquí 👉 ${url} · Empiezas con prueba gratis 14 días.`,
    },
    {
      key: 'instagram-bio',
      label: 'Para Instagram bio / story',
      text: `Cambié mi POS por SACS y ahora veo todo mi negocio en tiempo real. Inventario, ventas, clientes — todo en una app. Si tienes una tienda, link en mi bio o aquí: ${url}`,
    },
    {
      key: 'email-b2b',
      label: 'Para email frío B2B',
      text: `Hola [nombre], vi que tienes [tipo de retail] en [ciudad]. Quería compartirte SACS — un sistema operativo de retail que reemplaza POS + inventario + e-commerce. Te paso el link: ${url}. Si te late, agendamos demo de 30 min.\n\nSaludos,\n${nombre}`,
    },
    {
      key: 'tiktok-caption',
      label: 'Para TikTok / YouTube descripción',
      text: `Sistema que uso (afiliado): ${url} · 14 días gratis · POS + inventario + IA en una sola plataforma para retail.`,
    },
  ] : [];

  const waShare = url ? `https://wa.me/?text=${encodeURIComponent(`Te recomiendo SACS — sistema de retail moderno. Pruébalo gratis 14 días: ${url}`)}` : '#';
  const emailShare = url ? `mailto:?subject=${encodeURIComponent('Te recomiendo SACS')}&body=${encodeURIComponent(`Hola! Te recomiendo SACS — el sistema operativo para retail moderno. Pruébalo gratis 14 días por mi link: ${url}`)}` : '#';
  const twitterShare = url ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`SACS = el sistema operativo del retail moderno. Pruébalo gratis 14 días por mi link 👇`)}&url=${encodeURIComponent(url)}` : '#';
  const linkedinShare = url ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` : '#';

  return (
    <div>
      <Tut>
        <strong>Tu link único es tu herramienta principal.</strong> Cada vez que alguien
        entra por aquí, queda automáticamente atribuido a ti durante 90 días. Compártelo
        en redes, WhatsApp, email, descripción de YouTube — donde sea.
      </Tut>

      <h1 style={S.h1}>Mi link único</h1>
      <p style={S.lead}>Compártelo y empieza a generar bonos automáticos.</p>

      {url ? (
        <>
          <div style={S.linkCard}>
            <div style={S.linkUrl}>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>https://</span>
              <span style={{ color: '#fff' }}>{url.replace(/^https?:\/\//, '').replace(slug, '')}</span>
              <strong style={{ color: '#6CD6C2', fontWeight: 600 }}>{slug}</strong>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => copyText(url, 'url')} style={{ ...S.btnPrimary, background: '#6CD6C2', color: '#1a1a1a' }}>
                {copied === 'url' ? '✓ Copiado' : 'Copiar link'}
              </button>
              <a href={`${url}?notrack=1`} target="_blank" rel="noopener" style={{ ...S.btnGhostDark, textDecoration: 'none' }}>
                Ver mi landing →
              </a>
            </div>
          </div>

          <LinkStats stats={stats} />

          <div style={S.linkGrid}>
            <div style={S.linkBlock}>
              <h3 style={S.h3}>Compartir directo</h3>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <a href={waShare} target="_blank" rel="noopener" style={S.shareBtn}>WhatsApp</a>
                <a href={emailShare} style={S.shareBtn}>Email</a>
                <a href={twitterShare} target="_blank" rel="noopener" style={S.shareBtn}>X / Twitter</a>
                <a href={linkedinShare} target="_blank" rel="noopener" style={S.shareBtn}>LinkedIn</a>
              </div>
              <div style={{ ...S.note, marginTop: 16 }}>
                Cada botón abre el cliente correspondiente con un mensaje pre-armado que
                puedes editar antes de mandar. Para link en bio (IG/TikTok), usa "Copiar link" arriba.
              </div>
            </div>

            <div style={S.linkBlock}>
              <h3 style={S.h3}>QR code para imprimir</h3>
              <div style={{ background: '#fff', padding: 16, borderRadius: 10, textAlign: 'center', maxWidth: 220, margin: '0 auto' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`}
                  alt="QR de tu link"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&data=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noopener"
                download="sacs-partner-qr.png"
                style={{ ...S.btnGhost, marginTop: 12, display: 'inline-block', textDecoration: 'none' }}
              >
                Descargar PNG · 1200×1200
              </a>
              <div style={{ ...S.note, marginTop: 12 }}>
                Útil para flyers físicos, vinilos en tu local, tarjetas de presentación.
              </div>
            </div>
          </div>

          <h2 style={S.h2}>Plantillas copy-paste por contexto</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {templates.map(tpl => (
              <div key={tpl.key} style={S.template}>
                <div style={S.templateHead}>{tpl.label}</div>
                <div style={S.templateBody}>{tpl.text}</div>
                <button onClick={() => copyText(tpl.text, tpl.key)} style={S.btnGhost}>
                  {copied === tpl.key ? '✓ Copiado' : 'Copiar texto'}
                </button>
              </div>
            ))}
          </div>

          <div style={S.note}>
            <strong>¿Cómo funciona la atribución?</strong> Cuando alguien entra por tu
            link, se le pone una cookie de 90 días. Si en esos 90 días llena prueba
            gratis, agenda demo o compra, queda atribuido a ti automáticamente.
          </div>

          <h2 style={S.h2}>Brand kit y materiales</h2>
          <p style={S.lead}>Logos, colores, captions listos, hashtags. Todo lo que necesitas para crear contenido profesional.</p>
          <button onClick={() => go('brandkit')} style={{ ...S.btnPrimary, display: 'inline-block' }}>
            Abrir brand kit →
          </button>
        </>
      ) : (
        <div style={S.empty}>Cargando…</div>
      )}
    </div>
  );
}

// ─── LinkStats — visitas únicas / recurrentes / hoy / 7d / 30d ──
function LinkStats({ stats }: { stats: any }) {
  if (!stats) {
    return (
      <div style={{ marginTop: 24, padding: 24, background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, color: '#888', fontSize: 14 }}>
        Cargando estadísticas de visitas…
      </div>
    );
  }

  const total = Number(stats.total || 0);
  const unique = Number(stats.unique || 0);
  const recurring = Number(stats.recurring || 0);
  const repeatPct = unique > 0 ? Math.round((recurring / unique) * 100) : 0;
  const last = stats.last_visit_at ? fmtRelative(stats.last_visit_at) : '—';

  // Mini sparkline: últimos 30 días, alto fijo
  const daily: { day: string; visits: number }[] = stats.daily || [];
  const maxV = Math.max(1, ...daily.map(d => d.visits));

  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ ...S.h2, marginTop: 0 }}>Visitas a tu link</h2>
      <p style={{ ...S.lead, margin: '-8px 0 24px' }}>
        Quién entra por <code style={{ background: '#f5f5f3', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>/{stats?.recent?.[0]?.referrer ? '' : ''}</code>tu link, cuántos vuelven y desde dónde llegan.
      </p>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        <div style={S.vigCard}>
          <div style={S.vigLbl}>Visitas totales</div>
          <div style={S.vigVal}>{total.toLocaleString('es-MX')}</div>
          <div style={S.vigHint}>Última: {last}</div>
        </div>
        <div style={S.vigCard}>
          <div style={S.vigLbl}>Visitantes únicos</div>
          <div style={{ ...S.vigVal, color: '#4B7BE5' }}>{unique.toLocaleString('es-MX')}</div>
          <div style={S.vigHint}>Personas distintas (cookie de 1 año)</div>
        </div>
        <div style={S.vigCard}>
          <div style={S.vigLbl}>Recurrentes</div>
          <div style={{ ...S.vigVal, color: '#1A8F7A' }}>{recurring.toLocaleString('es-MX')}</div>
          <div style={S.vigHint}>Volvieron ≥2 veces · {repeatPct}% del total único</div>
        </div>
        <div style={S.vigCard}>
          <div style={S.vigLbl}>Hoy / 7 días / 30 días</div>
          <div style={{ ...S.vigVal, fontSize: 22 }}>
            <span>{stats.today || 0}</span>
            <span style={{ color: '#ddd', margin: '0 8px', fontWeight: 300 }}>·</span>
            <span style={{ color: '#666' }}>{stats.week || 0}</span>
            <span style={{ color: '#ddd', margin: '0 8px', fontWeight: 300 }}>·</span>
            <span style={{ color: '#999' }}>{stats.month || 0}</span>
          </div>
          <div style={S.vigHint}>Ventana móvil de visitas</div>
        </div>
      </div>

      {/* Sparkline */}
      {daily.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: '20px 22px', marginBottom: 22, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Últimos 30 días</div>
            <div style={{ fontSize: 12, color: '#666' }}>Pico: <strong style={{ color: '#1a1a1a' }}>{maxV}</strong> visitas / día</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
            {daily.map(d => {
              const h = d.visits === 0 ? 4 : Math.max(6, Math.round((d.visits / maxV) * 76));
              return (
                <div
                  key={d.day}
                  title={`${d.day}: ${d.visits} visita${d.visits !== 1 ? 's' : ''}`}
                  style={{
                    flex: 1,
                    height: h,
                    background: d.visits === 0 ? '#f0f0ee' : 'linear-gradient(180deg, #4B7BE5, #6CD6C2)',
                    borderRadius: 3,
                    minWidth: 0,
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa', marginTop: 8 }}>
            <span>{fmtShortDate(daily[0]?.day)}</span>
            <span>{fmtShortDate(daily[daily.length - 1]?.day)}</span>
          </div>
        </div>
      )}

      {/* Top referrers + recent */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>De dónde llegan</div>
          {(stats.top_referrers || []).length === 0 ? (
            <div style={{ fontSize: 13, color: '#aaa' }}>Aún no tenemos referrers identificables. Comparte tu link en WhatsApp, Instagram o donde sea para empezar a verlos.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.top_referrers.map((r: any) => (
                <div key={r.host} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f5f5f3' }}>
                  <span style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 500 }}>{r.host}</span>
                  <span style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Últimas visitas</div>
          {(stats.recent || []).length === 0 ? (
            <div style={{ fontSize: 13, color: '#aaa' }}>Aún no hay visitas. Empieza a compartir tu link.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.recent.map((v: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f8f8f5' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{fmtRelative(v.when)}</span>
                    <span style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                      {v.referrer || 'tráfico directo'} · #{v.visitor_short}
                      {v.is_recurring && <span style={{ marginLeft: 6, color: '#1A8F7A', fontWeight: 600 }}>· recurrente</span>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtRelative(iso?: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'hace unos segundos';
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.round(hr / 24);
  if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  const mo = Math.round(d / 30);
  return `hace ${mo} ${mo === 1 ? 'mes' : 'meses'}`;
}

function fmtShortDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace(/\./g, '');
  } catch { return iso; }
}

// ─── Tab: Profile ───────────────────────────────────────────────
function ProfileTab() {
  const [profile, setProfile] = useState<any>(null);
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/partner-portal/profile').then(r => r.json()).then(setProfile);
  }, []);

  if (!profile) return <div style={S.loading}>Cargando…</div>;

  const payout = profile.payout || {};
  const direccion = profile.direccion || {};

  async function changePassword() {
    setPwdMsg('');
    if (newPwd.length < 8) { setPwdMsg('Mínimo 8 caracteres'); return; }
    setSaving(true);
    const res = await fetch('/api/partner-portal/profile', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: curPwd, new_password: newPwd }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) { setPwdMsg('Contraseña actualizada ✓'); setCurPwd(''); setNewPwd(''); }
    else setPwdMsg(data.error || 'Error');
  }

  return (
    <div>
      <Tut>
        <strong>Tus datos personales y de cobro.</strong> Aquí actualizas a dónde te
        pagamos cada mes, tu dirección fiscal para facturas y tu contraseña. Cualquier
        cambio en tus datos de pago aplica a partir del siguiente payout.
      </Tut>

      <h1 style={S.h1}>Mi perfil</h1>
      <p style={S.lead}>Edita tus datos, contraseña y método de cobro.</p>

      <section style={S.perfilSection}>
        <h3 style={S.h3}>Datos personales</h3>
        <div style={S.formGrid}>
          <Field label="Nombre completo" value={profile.user?.nombre || '—'} readOnly />
          <Field label="Email" value={profile.user?.email || '—'} readOnly />
          <Field label="Programa" value={profile.invitation?.tipo || '—'} readOnly />
          <Field label="Comisión" value={`${profile.user?.default_commission_pct ?? 0}%`} readOnly />
        </div>
      </section>

      <section style={S.perfilSection}>
        <h3 style={S.h3}>Método de cobro</h3>
        <p style={S.sectionSub}>Método actual: <strong style={{ color: '#1a1a1a' }}>{(payout.method || 'no configurado').toUpperCase()}</strong>. Para cambiarlo, escribe a partners@sacscloud.com.</p>
        {payout.method === 'clabe' && (
          <div style={S.formGrid}>
            <Field label="Banco" value={payout.banco || '—'} readOnly />
            <Field label="Titular" value={payout.titular || '—'} readOnly />
            <Field label="CLABE (18 dígitos)" value={payout.clabe || '—'} readOnly mono />
            <Field label="RFC" value={payout.rfc || '—'} readOnly />
          </div>
        )}
        {payout.method === 'paypal' && (
          <div style={S.formGrid}>
            <Field label="Email PayPal" value={payout.email || '—'} readOnly />
          </div>
        )}
        {payout.method === 'mercadopago' && (
          <div style={S.formGrid}>
            <Field label="MP ID / Email" value={payout.mp_id || '—'} readOnly />
            <Field label="Titular" value={payout.titular || '—'} readOnly />
          </div>
        )}
      </section>

      <section style={S.perfilSection}>
        <h3 style={S.h3}>Dirección del negocio</h3>
        <div style={S.formGrid}>
          <Field label="Calle" value={direccion.calle || '—'} readOnly />
          <Field label="Colonia" value={direccion.colonia || '—'} readOnly />
          <Field label="CP" value={direccion.cp || '—'} readOnly />
          <Field label="Ciudad" value={direccion.ciudad || '—'} readOnly />
          <Field label="Estado" value={direccion.estado || '—'} readOnly />
        </div>
      </section>

      {profile.firma_base64 && (
        <section style={S.perfilSection}>
          <h3 style={S.h3}>Tu firma del contrato</h3>
          <p style={S.sectionSub}>Firmaste tu acuerdo de partner. Esta firma queda vinculada a tu folio para auditoría.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 18, alignItems: 'center' }}>
            <div style={{ border: '1px solid #ececec', borderRadius: 8, padding: 14, background: '#fafaf8', textAlign: 'center' }}>
              <img src={profile.firma_base64} alt="Tu firma" style={{ maxWidth: '100%', maxHeight: 80 }} />
            </div>
            <div style={{ fontSize: 14, color: '#555', lineHeight: 1.7 }}>
              <div><strong style={{ color: '#1a1a1a' }}>Firmado el</strong> {fmtDate(profile.signed_at)}</div>
              {profile.approved_at && <div><strong style={{ color: '#1a1a1a' }}>Aprobada por SACS el</strong> {fmtDate(profile.approved_at)}</div>}
              {profile.invitation?.numero && <div><strong style={{ color: '#1a1a1a' }}>Folio</strong> {profile.invitation.numero}</div>}
            </div>
          </div>
        </section>
      )}

      <section style={S.perfilSection}>
        <h3 style={S.h3}>Seguridad de la cuenta</h3>
        <div style={{ ...S.formGrid, maxWidth: 500 }}>
          <Field label="Contraseña actual" value={curPwd} onChange={setCurPwd} type="password" />
          <Field label="Nueva contraseña" value={newPwd} onChange={setNewPwd} type="password" placeholder="Mín. 8 caracteres" />
        </div>
        <button onClick={changePassword} disabled={saving} style={{ ...S.btnPrimary, marginTop: 14 }}>
          {saving ? 'Actualizando…' : 'Actualizar contraseña'}
        </button>
        {pwdMsg && <div style={{ marginTop: 10, fontSize: 13, color: pwdMsg.includes('✓') ? '#1A8F7A' : '#c62828' }}>{pwdMsg}</div>}
      </section>
    </div>
  );
}

// ─── Tab: Actualizaciones ───────────────────────────────────────
function ActualizacionesTab() {
  const proximas = [
    { fecha: '26 dic 2026', dia: 'Jueves', hora: '5:00 PM CDMX', tema: 'Cierre de año + planeación 2027', desc: 'Resultados del programa partner, top embajadores y rumbo 2027' },
    { fecha: '30 ene 2027', dia: 'Jueves', hora: '5:00 PM CDMX', tema: 'Lanzamiento SACS Plus 2.0', desc: 'Demo del rediseño completo + nuevas integraciones bancarias' },
    { fecha: '27 feb 2027', dia: 'Jueves', hora: '5:00 PM CDMX', tema: 'Casos de éxito: 5 partners, 5 historias', desc: 'Embajadores top comparten qué les funcionó y por qué' },
  ];
  const grabaciones = [
    { mes: 'Octubre 2026', titulo: 'Atribución end-to-end y casos de cierre de Q3', dur: '62 min', grad: 'linear-gradient(135deg, #4B7BE5, #6C5CE7)' },
    { mes: 'Septiembre 2026', titulo: 'Brand kit v2 y nueva guía de captions por giro', dur: '58 min', grad: 'linear-gradient(135deg, #2AB5A0, #4B7BE5)' },
    { mes: 'Agosto 2026', titulo: 'Lanzamiento del Plan Plus + nueva pricing 2026', dur: '71 min', grad: 'linear-gradient(135deg, #E8A838, #EF4444)' },
    { mes: 'Julio 2026', titulo: 'Onboarding de partners nuevos · ronda Q3', dur: '55 min', grad: 'linear-gradient(135deg, #6C5CE7, #BE185D)' },
    { mes: 'Junio 2026', titulo: 'Demo de Axo Copiloto IA para retail', dur: '49 min', grad: 'linear-gradient(135deg, #1A8F7A, #4B7BE5)' },
    { mes: 'Mayo 2026', titulo: 'Lanzamiento del programa Embajadores SACS', dur: '66 min', grad: 'linear-gradient(135deg, #888, #1a1a1a)' },
  ];

  return (
    <div>
      <Tut>
        <strong>Una sesión en vivo al mes con el equipo SACS.</strong> Updates de
        producto, casos de éxito, Q&amp;A y networking entre embajadores. Si no puedes
        asistir, todas quedan grabadas y disponibles aquí mismo con sus slides.
      </Tut>

      <h1 style={S.h1}>Actualizaciones mensuales</h1>
      <p style={S.lead}>Sesiones en vivo cada último jueves del mes. Próxima en 12 días.</p>

      {/* Próxima sesión destacada */}
      <div style={S.actuNext}>
        <div style={S.actuNextEyebrow}>Próxima sesión</div>
        <div style={S.actuNextGrid}>
          <div>
            <div style={S.actuNextDate}>Jueves 28 nov 2026 · 5:00 PM CDMX</div>
            <div style={S.actuNextTitle}>Producto Q4: nuevos módulos de IA y roadmap 2027</div>
            <div style={S.actuNextDesc}>
              Repasamos los lanzamientos de octubre y noviembre, demo del nuevo
              Orquestador de Agentes y Q&amp;A abierto. Daniela Cruz (Bella Pandita)
              presenta su caso de éxito multisucursal.
            </div>
            <div style={S.actuNextMeta}>
              <span><strong>Duración:</strong> 60 min</span>
              <span><strong>Modalidad:</strong> Zoom · 100 plazas</span>
              <span><strong>Confirmados:</strong> 38 de 100</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a href="#" style={{ ...S.btnPrimary, textAlign: 'center', textDecoration: 'none', padding: '14px 22px' }}>Unirme a Zoom →</a>
            <button type="button" style={{ ...S.btnGhost, textAlign: 'center' }}>Agregar al calendario (.ics)</button>
            <button type="button" style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid transparent', padding: '8px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Recordarme 1h antes</button>
          </div>
        </div>
      </div>

      <h2 style={S.h2}>Próximas sesiones agendadas</h2>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Fecha</th>
              <th style={S.th}>Tema previsto</th>
              <th style={S.th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {proximas.map((p, i) => (
              <tr key={i} style={S.tr}>
                <td style={S.td}>
                  <strong>{p.fecha}</strong>
                  <div style={S.subtxt}>{p.dia} · {p.hora}</div>
                </td>
                <td style={S.td}>
                  <strong>{p.tema}</strong>
                  <div style={S.subtxt}>{p.desc}</div>
                </td>
                <td style={S.td}><a href="#" style={{ color: '#4B7BE5', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Pre-registrarme →</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={S.h2}>Grabaciones de sesiones pasadas</h2>
      <div style={S.recGrid}>
        {grabaciones.map((g, i) => (
          <div key={i} style={S.recCard}>
            <div style={{ ...S.recThumb, background: g.grad }}>
              <span style={S.recPlay}>▶</span>
              <span style={S.recDuration}>{g.dur}</span>
            </div>
            <div style={S.recBody}>
              <div style={S.recMonth}>{g.mes}</div>
              <div style={S.recTitle}>{g.titulo}</div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <a href="#" style={{ color: '#4B7BE5', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Ver grabación</a>
                <a href="#" style={{ color: '#888', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Slides PDF</a>
                <a href="#" style={{ color: '#888', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Notas</a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Brand kit ─────────────────────────────────────────────
function BrandkitTab() {
  return (
    <div>
      <Tut>
        <strong>Tu kit de marca SACS — todo listo para usar.</strong> Logos en alta
        resolución, paleta de colores, tipografía, plantillas de redes y captions
        aprobados por marketing. Descarga lo que necesites y arma contenido que se vea
        profesional sin partir de cero.
      </Tut>

      <h1 style={S.h1}>Brand kit</h1>
      <p style={S.lead}>Assets oficiales para usar en tus posts, videos y materiales como partner.</p>

      <h2 style={S.h2}>Logos · 4 versiones</h2>
      <div style={S.bkLogos}>
        <BkLogo title="Logo principal · negro" sub="PNG, SVG, AI · 4 tamaños" bg="#fff" color="#1a1a1a" />
        <BkLogo title="Logo blanco" sub="Para fondos oscuros" bg="#1a1a1a" color="#fff" />
        <BkLogo title="Logo azul · monocromático" sub="Color de marca" bg="#fff" color="#4B7BE5" />
        <BkLogo title="Logo Partner" sub="Solo embajadores autorizados" bg="#FAFAF8" color="#1a1a1a" partner />
      </div>

      <h2 style={S.h2}>Paleta de colores</h2>
      <div style={S.bkColors}>
        <BkColor hex="#1A1A1A" name="Negro principal" color="#fff" />
        <BkColor hex="#4B7BE5" name="Azul SACS" color="#fff" />
        <BkColor hex="#6CD6C2" name="Verde acento" color="#1a1a1a" />
        <BkColor hex="#FAFAF8" name="Cream fondo" color="#1a1a1a" border />
        <BkColor hex="#6C5CE7" name="Morado acento" color="#fff" />
      </div>

      <h2 style={S.h2}>Tipografía</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={S.bkFont}>
          <div style={{ fontFamily: 'Clash Display, sans-serif', fontSize: 40, fontWeight: 600, color: '#1a1a1a', lineHeight: 1, letterSpacing: '-0.02em' }}>Clash Display</div>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #f0f0ee' }}>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#1a1a1a' }}>Display · headlines</strong>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Weights: 400, 500, 600, 700</div>
          </div>
        </div>
        <div style={S.bkFont}>
          <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 24, fontWeight: 500, color: '#1a1a1a', lineHeight: 1.3 }}>Plus Jakarta Sans</div>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #f0f0ee' }}>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#1a1a1a' }}>Body · texto largo</strong>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Weights: 300, 400, 500, 600, 700, 800</div>
          </div>
        </div>
      </div>

      <h2 style={S.h2}>Captions sugeridos por giro</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <div style={S.template}>
          <div style={S.templateHead}>Para audiencia de retail/moda</div>
          <div style={S.templateBody}>"El sistema que uso para mi boutique se llama SACS. Maneja inventario por talla y color, mis ventas online + físicas en un solo lugar y reportes que sí se entienden. Si tienes una tienda, pruébalo gratis 14 días: link en bio o sacscloud.com"</div>
        </div>
        <div style={S.template}>
          <div style={S.templateHead}>Para restauranteros</div>
          <div style={S.templateBody}>"Cambié mi POS por SACS y ahora veo mi cocina, mis mesas, mis ventas y mi inventario en una sola pantalla. Si tienes restaurante, te toca probarlo: sacscloud.com · 14 días gratis."</div>
        </div>
      </div>

      <div style={S.note}>
        <strong>Reglas de uso:</strong> No modifiques los logos (colores, proporción).
        No los uses en fondos que generen poco contraste. Si quieres usar SACS en tu
        propio material visual, usa el "Logo Partner" (no el principal).
      </div>

      <a href="/partners/brand-kit" target="_blank" rel="noopener" style={{ ...S.btnPrimary, marginTop: 24, display: 'inline-block', textDecoration: 'none' }}>
        Abrir brand kit completo en sitio web →
      </a>
    </div>
  );
}

// ─── Tab: Tu cuenta SACS ────────────────────────────────────────
function CuentaSacsTab({ user }: { user: { email: string; nombre: string } }) {
  const [showPassword, setShowPassword] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  useEffect(() => {
    fetch('/api/partner-portal/profile').then(r => r.json()).then(setProfile);
  }, []);

  const created = profile?.user?.created_at || profile?.invitation?.aceptado_fecha;
  const monthsActive = created ? Math.max(1, Math.floor((Date.now() - new Date(created).getTime()) / (30 * 24 * 3600 * 1000))) : 1;
  const ahorro = monthsActive * (14000 / 12);

  return (
    <div>
      <Tut>
        <strong>Tu Plan Fideliza está incluido en tu acuerdo de partner.</strong>
        Vale $14,000 MXN/año. Mientras seas embajador activo, tu cuenta es
        gratis y con vigencia ilimitada. Aquí ves tu acceso y todo lo que incluye.
      </Tut>

      <h1 style={S.h1}>Tu acceso a SACS</h1>
      <p style={S.lead}>Email, contraseña y todo lo que viene con tu Plan Fideliza, en un solo lugar.</p>

      <div style={S.cuentaPlan}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6CD6C2', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, marginBottom: 8 }}>Plan activo · incluido</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 500, color: '#fff', marginBottom: 6, letterSpacing: '-0.025em' }}>Plan Fideliza</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Valor $14,000 MXN/año · cortesía como embajador SACS</div>
          </div>
          <a href="https://app.sacscloud.com" target="_blank" rel="noopener" style={{ ...S.btnPrimary, background: '#fff', color: '#1a1a1a', textDecoration: 'none' }}>
            Abrir app SACS ↗
          </a>
        </div>
      </div>

      <h2 style={S.h2}>Acceso a tu cuenta</h2>
      <div style={S.accessCard}>
        <div style={S.accessRow}>
          <div style={S.accessLbl}>URL de inicio de sesión</div>
          <div style={S.accessVal}>
            <a href="https://app.sacscloud.com" target="_blank" rel="noopener" style={{ color: '#4B7BE5', textDecoration: 'none' }}>app.sacscloud.com</a>
          </div>
          <button onClick={() => navigator.clipboard.writeText('https://app.sacscloud.com')} style={S.btnGhost}>Copiar</button>
        </div>
        <div style={S.accessRow}>
          <div style={S.accessLbl}>Email</div>
          <div style={{ ...S.accessVal, fontFamily: 'SF Mono, Courier New, monospace', fontSize: 14 }}>{user.email}</div>
          <button onClick={() => navigator.clipboard.writeText(user.email)} style={S.btnGhost}>Copiar</button>
        </div>
        <div style={S.accessRow}>
          <div style={S.accessLbl}>Contraseña</div>
          <div style={{ ...S.accessVal, fontFamily: 'SF Mono, Courier New, monospace', fontSize: 14 }}>
            {showPassword ? '••••••• (ofuscada por seguridad)' : '••••••••••••'}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowPassword(!showPassword)} style={S.btnGhost}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
            <button onClick={() => location.hash = 'profile'} style={S.btnGhost}>Cambiar</button>
          </div>
        </div>
        <a href="https://app.sacscloud.com" target="_blank" rel="noopener" style={S.accessCta}>
          Abrir app.sacscloud.com →
        </a>
      </div>

      <h2 style={S.h2}>Vigencia</h2>
      <div style={S.vigGrid}>
        <div style={S.vigCard}>
          <div style={S.vigLbl}>Cuenta creada</div>
          <div style={S.vigVal}>{fmtDate(created)}</div>
          <div style={S.vigHint}>Hace {monthsActive} {monthsActive === 1 ? 'mes' : 'meses'} como partner</div>
        </div>
        <div style={S.vigCard}>
          <div style={S.vigLbl}>Vigencia</div>
          <div style={S.vigVal}>Ilimitada</div>
          <div style={S.vigHint}>Mientras seas embajador activo</div>
        </div>
        <div style={{ ...S.vigCard, background: 'linear-gradient(135deg, rgba(42,181,160,0.05), rgba(75,123,229,0.03))', borderColor: 'rgba(42,181,160,0.20)' }}>
          <div style={S.vigLbl}>Ahorro acumulado</div>
          <div style={{ ...S.vigVal, color: '#1A8F7A' }}>{fmt(ahorro)}</div>
          <div style={S.vigHint}>{monthsActive} meses × $14K/año = ahorro a la fecha</div>
        </div>
      </div>

      <h2 style={S.h2}>Lo que incluye tu Plan Fideliza</h2>
      <div style={S.inclGrid}>
        <Incl t="Punto de venta multi-sucursal" d="POS móvil, tablet o PC con cobro online y offline. Hasta 3 sucursales en este plan." />
        <Incl t="Inventario omnicanal" d="Stock consolidado entre piso, online y entregas. Variantes, lotes, caducidades." />
        <Incl t="Tienda en línea con tema custom" d="E-commerce con dominio propio, plantillas profesionales y checkout integrado." />
        <Incl t="CRM y programa de lealtad" d="Base de clientes, segmentación, puntos, niveles VIP y portal del cliente." />
        <Incl t="Facturación electrónica CFDI 4.0" d="Factura ilimitada, complementos de pago, validación SAT en tiempo real." />
        <Incl t="Reportes y BI" d="Dashboards en vivo, reportes predictivos, exportación a Excel y Google Sheets." />
        <Incl t="Axo · IA Copiloto" d="Asistente con IA para inventario, marketing, agentic commerce y consultas en lenguaje natural." />
        <Incl t="Marketing por email y WhatsApp" d="Campañas, automations, segmentación y reportes de conversión." />
        <Incl t="Apartados, MSI y promociones" d="Vende a meses sin intereses, apartados largos, descuentos por volumen y combos." />
        <Incl t="API e integraciones" d="Conecta con Stripe, Mercado Pago, Conekta, Shopify, Rappi y más." />
        <Incl t="Soporte prioritario por embajador" d="Cola separada de atención, respuesta <4 hrs, acceso directo a Customer Success." />
        <Incl t="Onboarding personalizado" d="Setup inicial 1:1, capacitación de tu equipo y migración de datos sin costo extra." />
      </div>

      <h2 style={S.h2}>Accesos rápidos al app</h2>
      <div style={S.quickGrid}>
        <Quick href="https://app.sacscloud.com/pos" name="POS" desc="Cobrar venta nueva" />
        <Quick href="https://app.sacscloud.com/inventario" name="Inventario" desc="Productos y stock" />
        <Quick href="https://app.sacscloud.com/ecommerce" name="Tienda online" desc="Tu e-commerce" />
        <Quick href="https://app.sacscloud.com/clientes" name="CRM" desc="Clientes y lealtad" />
        <Quick href="https://app.sacscloud.com/reportes" name="Reportes" desc="Análisis y BI" />
        <Quick href="https://app.sacscloud.com/marketing" name="Marketing" desc="WhatsApp y email" />
      </div>
    </div>
  );
}

// ─── Tab: Certificaciones ───────────────────────────────────────
function CertificacionesTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [paidJustNow, setPaidJustNow] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/partner-portal/certifications').then(r => r.json()).then(d => { setData(d); setLoading(false); });
    // Detect ?paid=cert_id in hash to celebrate after Stripe redirect
    const m = (window.location.hash || '').match(/[?&]paid=([a-z]+)/);
    if (m) {
      setPaidJustNow(m[1]);
      // Clean URL after a delay
      setTimeout(() => {
        history.replaceState(null, '', '#certificaciones');
        // Re-fetch to get updated status
        fetch('/api/partner-portal/certifications').then(r => r.json()).then(d => setData(d));
      }, 500);
    }
  }, []);

  async function buy(certId: string) {
    setBusyId(certId);
    try {
      const res = await fetch('/api/partner-portal/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cert_id: certId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo crear el checkout');
      window.location.href = json.url;
    } catch (e: any) {
      alert('Error: ' + (e.message || e));
      setBusyId(null);
    }
  }

  if (loading) return <div style={S.loading}>Cargando…</div>;
  if (!data) return <div style={S.error}>No se pudieron cargar las certificaciones</div>;

  const certs = data.certifications || [];
  const ownedCount = certs.filter((c: any) => c.unlocked).length;

  return (
    <div>
      <Tut>
        <strong>Sube tu nivel como partner SACS.</strong> Cada certificación te da
        herramientas para cerrar cuentas más complejas y, en el caso de
        Multisucursal, hasta el <strong>60% de comisión</strong> en deals enterprise.
        Pagas una vez y el badge queda permanente en tu portal.
      </Tut>

      <h1 style={S.h1}>Certificaciones</h1>
      <p style={S.lead}>
        {ownedCount === 0
          ? '3 niveles disponibles. Cada uno te abre nuevas capacidades técnicas y comerciales.'
          : `Tienes ${ownedCount} de 3 certificaciones activas. Sigue subiendo de nivel.`}
      </p>

      {paidJustNow && (
        <div style={S.certPaid}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1A8F7A', textTransform: 'uppercase', letterSpacing: '0.1em' }}>✓ Pago confirmado</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6 }}>
            Tu certificación está activa. Recibirás un correo con el link a la sesión y el material.
          </div>
        </div>
      )}

      <div style={S.certGrid}>
        {certs.map((c: any) => (
          <CertCard key={c.id} cert={c} busy={busyId === c.id} onBuy={() => buy(c.id)} />
        ))}
      </div>

      <div style={{ ...S.note, marginTop: 36 }}>
        <strong>¿Cómo funciona el pago?</strong> Procesamos tu pago via Stripe (tarjeta).
        Al confirmarse, tu certificación se desbloquea al instante en este portal y
        recibes un correo con el link a la sesión, materiales y la fecha del próximo
        examen. Si tienes un cupón corporativo o inscripción grupal,
        escribe a <a href="mailto:partners@sacscloud.com" style={{ color: '#4B7BE5' }}>partners@sacscloud.com</a>.
      </div>
    </div>
  );
}

function CertCard({ cert, busy, onBuy }: { cert: any; busy: boolean; onBuy: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const visibleTopics = showAll ? cert.temario : cert.temario.slice(0, 4);
  const hiddenCount = cert.temario.length - 4;

  return (
    <article style={S.certCard}>
      <div style={S.certCover}>
        <img src={cert.cover} alt={cert.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <div style={S.certCoverFade} />
        {!cert.unlocked && (
          <div style={S.certLock}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
        )}
        {cert.unlocked && (
          <div style={S.certBadge}>✓ Activa</div>
        )}
        <div style={S.certCoverBody}>
          <div style={S.certLevel}>{cert.nivel}</div>
          <div style={S.certName}>{cert.shortName}</div>
        </div>
      </div>

      <div style={S.certBody}>
        <div style={S.certPriceRow}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 500, color: '#1a1a1a', letterSpacing: '-0.025em', lineHeight: 1 }}>
              {cert.precioMostrar}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>MXN · pago único · {cert.duracion}</div>
          </div>
          {cert.unlocked ? (
            <span style={{ ...S.certBtn, background: 'rgba(42,181,160,0.12)', color: '#1A8F7A', cursor: 'default' }}>Desbloqueada ✓</span>
          ) : (
            <button onClick={onBuy} disabled={busy} style={{ ...S.certBtn, background: '#1a1a1a', color: '#fff', cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? 'Abriendo Stripe…' : 'Desbloquear'}
            </button>
          )}
        </div>

        <p style={S.certDesc}>{cert.descripcion}</p>

        <div style={S.certSection}>
          <div style={S.certSectionLbl}>Para quién es</div>
          <div style={S.certSectionVal}>{cert.paraQuien}</div>
        </div>

        <div style={S.certSection}>
          <div style={S.certSectionLbl}>Lo que vas a aprender</div>
          <ul style={S.certTopics}>
            {visibleTopics.map((t: string, i: number) => (
              <li key={i} style={S.certTopic}>
                <span style={S.certTopicBullet} />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && !showAll && (
            <button onClick={() => setShowAll(true)} style={S.certMore}>
              + Ver los {hiddenCount} temas restantes
            </button>
          )}
        </div>

        {cert.unlocked && (
          <div style={S.certSection}>
            <div style={S.certSectionLbl}>Beneficios incluidos</div>
            <ul style={S.certTopics}>
              {cert.beneficios.map((b: string, i: number) => (
                <li key={i} style={S.certTopic}>
                  <span style={{ ...S.certTopicBullet, background: '#1A8F7A' }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!cert.unlocked && (
          <div style={S.certBlocked}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Beneficios completos visibles al desbloquear</span>
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Helper components ──────────────────────────────────────────
function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div style={S.kpi}>
      {accent && <div style={{ ...S.kpiDot, background: accent }} />}
      <div style={{ ...S.kpiLabel, paddingLeft: accent ? 16 : 0 }}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
      {hint && <div style={S.kpiHint}>{hint}</div>}
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...S.filter,
        background: active ? '#1a1a1a' : '#fff',
        color: active ? '#fff' : '#666',
        borderColor: active ? '#1a1a1a' : '#f0f0ee',
      }}
    >
      {children}
    </button>
  );
}

function FunnelStep({ n, lbl, win }: { n: number; lbl: string; win?: boolean }) {
  return (
    <div style={{ ...S.funnelStep, ...(win ? S.funnelStepWin : {}) }}>
      <div style={{ ...S.funnelNum, ...(win ? { color: '#1A8F7A' } : {}) }}>{n}</div>
      <div style={S.funnelLbl}>{lbl}</div>
    </div>
  );
}
function FunnelArrow() { return <span style={{ color: '#d0d0d0', fontSize: 20, flexShrink: 0 }}>→</span>; }

function Field({ label, value, onChange, type = 'text', readOnly, mono, placeholder }: { label: string; value: string; onChange?: (v: string) => void; type?: string; readOnly?: boolean; mono?: boolean; placeholder?: string }) {
  return (
    <label style={S.field}>
      <span style={S.fieldLbl}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        placeholder={placeholder}
        style={{ ...S.input, ...(mono ? { fontFamily: 'SF Mono, Courier New, monospace' } : {}), ...(readOnly ? { color: '#555' } : {}) }}
      />
    </label>
  );
}

function BkLogo({ title, sub, bg, color, partner }: { title: string; sub: string; bg: string; color: string; partner?: boolean }) {
  return (
    <div style={S.bkLogo}>
      <div style={{ aspectRatio: '16/9', background: bg, color, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: bg === '#FAFAF8' ? '1px solid #ececec' : 'none', flexDirection: partner ? 'column' : 'row', gap: partner ? 4 : 0 }}>
        <div style={{ fontFamily: 'Clash Display, sans-serif', fontSize: partner ? 24 : 32, fontWeight: 700 }}>Sacs</div>
        {partner && <div style={{ fontSize: 10, fontWeight: 500, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Partner</div>}
      </div>
      <div style={{ marginBottom: 14 }}>
        <strong style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>{title}</strong>
        <span style={{ fontSize: 13, color: '#888' }}>{sub}</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...S.btnGhost, padding: '8px 12px', fontSize: 13 }}>PNG</button>
        <button style={{ ...S.btnGhost, padding: '8px 12px', fontSize: 13 }}>SVG</button>
      </div>
    </div>
  );
}

function BkColor({ hex, name, color, border }: { hex: string; name: string; color: string; border?: boolean }) {
  return (
    <div style={{ aspectRatio: '1', background: hex, color, borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4, boxShadow: '0 1px 2px rgba(0,0,0,0.02)', border: border ? '1px solid #ececec' : 'none' }}>
      <strong style={{ fontFamily: 'SF Mono, Courier New, monospace', fontSize: 14, fontWeight: 600 }}>{hex}</strong>
      <span style={{ fontSize: 12, opacity: 0.85 }}>{name}</span>
    </div>
  );
}

function Incl({ t, d }: { t: string; d: string }) {
  return (
    <div style={S.incl}>
      <div style={S.inclCheck}>✓</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 4, letterSpacing: '-0.005em' }}>{t}</strong>
        <span style={{ fontSize: 13, color: '#666', lineHeight: 1.55 }}>{d}</span>
      </div>
    </div>
  );
}

function Quick({ href, name, desc }: { href: string; name: string; desc: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" style={S.quick}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'; }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>{name}</div>
      <div style={{ fontSize: 13, color: '#888' }}>{desc}</div>
    </a>
  );
}

// ─── Tab: Mi acuerdo ────────────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  embajador: 'Embajador',
  consultor: 'Consultor certificado',
  reseller: 'Reseller',
  influencer: 'Influencer',
  experto: 'Experto / Asesor',
};

function AgreementTab({ user }: { user: { email: string; nombre: string } }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    fetch('/api/partner-portal/profile').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: 40, color: '#888' }}>Cargando tu acuerdo...</div>;
  if (!data?.invitation) {
    return (
      <div>
        <h1 style={S.h1}>Mi acuerdo</h1>
        <div style={{ padding: 24, background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, color: '#666' }}>
          No encontramos un acuerdo activo asociado a tu cuenta. Si crees que es un error, escríbenos a partners@sacscloud.com.
        </div>
      </div>
    );
  }

  const inv = data.invitation;
  const tipo = inv.tipo || 'embajador';
  const tipoLabel = TIPO_LABEL[tipo] || tipo;
  const comisionPct = Number(inv.comision_pct ?? 50);
  const tab = inv.tabulador || {};
  const bonusPrueba = Number(tab.prueba_gratis ?? 250);
  const bonusDemo = Number(tab.demo_completada ?? 300);
  const ventaPct = tab.venta_directa_pct !== undefined ? Number(tab.venta_directa_pct) : comisionPct;

  const signedAt = data.signed_at;
  const approvedAt = data.approved_at || inv.aceptado_fecha;
  const estado = inv.estado;

  // Derivar nombre real del firmante (preferir el que escribió en la invitación)
  const firmanteNombre = inv.nombre || user.nombre || user.email;

  // Status badge
  let badgeBg = '#f5f5f3', badgeText = '#666', badgeLbl = estado;
  if (estado === 'accepted') { badgeBg = 'rgba(42,181,160,0.12)'; badgeText = '#1A8F7A'; badgeLbl = 'Activo · firmado y aprobado'; }
  else if (estado === 'submitted_for_review') { badgeBg = 'rgba(232,168,56,0.12)'; badgeText = '#9C6F1A'; badgeLbl = 'Firmado · en revisión por SACS'; }
  else if (estado === 'expired') { badgeBg = 'rgba(220,38,38,0.10)'; badgeText = '#c62828'; badgeLbl = 'Vencido'; }

  return (
    <div>
      <h1 style={S.h1}>Mi acuerdo</h1>
      <p style={S.lead}>
        Tu contrato firmado con SACS, los beneficios que recibes y los compromisos que aceptaste.
      </p>

      {/* Status banner */}
      <div style={{ padding: '20px 24px', background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: badgeBg, color: badgeText, borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
            {badgeLbl}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: '#1a1a1a', letterSpacing: '-0.02em' }}>
            Programa {tipoLabel} · Folio {inv.numero || '—'}
          </div>
        </div>
        <div style={{ textAlign: 'right' as const, fontSize: 13, color: '#666' }}>
          {signedAt && <div><strong>Firmado:</strong> {fmtDate(signedAt)}</div>}
          {approvedAt && <div style={{ marginTop: 2 }}><strong>Aprobado:</strong> {fmtDate(approvedAt)}</div>}
          {inv.vigencia && <div style={{ marginTop: 2 }}><strong>Vigente hasta:</strong> {fmtDate(inv.vigencia)}</div>}
        </div>
      </div>

      {/* Quick highlights */}
      <h2 style={{ ...S.h2, marginTop: 0 }}>Tu compensación de un vistazo</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 8 }}>
        <div style={S.vigCard}>
          <div style={S.vigLbl}>Comisión venta</div>
          <div style={{ ...S.vigVal, color: '#1A8F7A' }}>{ventaPct}%</div>
          <div style={S.vigHint}>De cada cliente que cierras con tu link</div>
        </div>
        <div style={S.vigCard}>
          <div style={S.vigLbl}>Bono prueba gratis</div>
          <div style={S.vigVal}>${bonusPrueba.toLocaleString('es-MX')}</div>
          <div style={S.vigHint}>Por cada prueba activada vía tu link</div>
        </div>
        <div style={S.vigCard}>
          <div style={S.vigLbl}>Bono demo completada</div>
          <div style={S.vigVal}>${bonusDemo.toLocaleString('es-MX')}</div>
          <div style={S.vigHint}>Por cada demo válida (25min, decisor)</div>
        </div>
        <div style={S.vigCard}>
          <div style={S.vigLbl}>Renovación recurrente</div>
          <div style={{ ...S.vigVal, color: '#4B7BE5' }}>{ventaPct}%</div>
          <div style={S.vigHint}>Mientras el cliente siga activo</div>
        </div>
      </div>

      {/* Beneficios */}
      <h2 style={S.h2}>Beneficios incluidos en tu acuerdo</h2>
      <div style={S.inclGrid}>
        <Incl t="Plan Fideliza SACS gratis" d="Tu cuenta SACS Plan Fideliza ($14,000 MXN/año) gratis mientras estés activo como partner." />
        <Incl t="Portal de partner en vivo" d="Comisiones, pagos y prospectos en tiempo real con métricas y notificaciones." />
        <Incl t="Brand kit oficial" d="Logos, plantillas, captions y assets aprobados para tus publicaciones." />
        <Incl t="Soporte prioritario" d="Cola separada para partners, respuesta &lt;4 horas, contacto directo con Customer Success." />
        <Incl t="Academia y workshops" d="Sesiones mensuales en vivo más biblioteca grabada en la pestaña Actualizaciones." />
        <Incl t="Onboarding de tu cliente" d="Sesión 1:1 y migración de datos sin costo extra para cada cliente referido." />
        <Incl t="Pagos puntuales" d="Comisiones confirmadas se liquidan el día 5 de cada mes a tu método registrado." />
        <Incl t="Tu landing pública" d="Página personalizada con tu nombre y link único de tracking." />
      </div>

      {/* Compromisos */}
      <h2 style={S.h2}>Tus compromisos</h2>
      <div style={S.inclGrid}>
        <Incl t="Representar SACS con honestidad" d="Sin afirmaciones falsas, garantías de resultado o promociones engañosas." />
        <Incl t="Atender leads en &lt;24 horas hábiles" d="Los prospectos que llegan a tu link merecen respuesta rápida." />
        <Incl t="Sesión mensual de actualizaciones" d="60 min al mes (o ver la grabación). Te mantiene al día con producto y campañas." />
        <Incl t="Cumplir mínimo de puntos al mes" d="Según tu programa: contenido o filantropía, 100 puntos mensuales." />
        <Incl t="Mantener confidencialidad" d="Sin divulgar precios negociados, roadmap, métricas internas o datos no públicos." />
      </div>

      {/* Contrato firmado */}
      <h2 style={S.h2}>Contrato firmado</h2>
      <div style={{ background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div style={{ padding: '20px 26px', borderBottom: '1px solid #f5f5f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Acuerdo formal de partner</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.01em' }}>
              Programa {tipoLabel} SACS · {inv.numero || ''}
            </div>
          </div>
          <button
            onClick={() => setShowFull(s => !s)}
            style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, background: showFull ? '#fff' : '#1a1a1a', color: showFull ? '#1a1a1a' : '#fff', border: showFull ? '1px solid #ddd' : 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {showFull ? 'Ocultar contrato completo' : 'Ver contrato completo'}
          </button>
        </div>

        {showFull && (
          <div style={{ padding: '24px 32px', fontSize: 14, lineHeight: 1.7, color: '#333' }}>
            <p>Entre <strong>SACS Cloud, S.A.P.I. de C.V.</strong> ("SACS"), por una parte, y <strong>{firmanteNombre}</strong> ("el Partner"), por la otra parte, se celebra el presente <strong>Acuerdo del Programa Partners SACS</strong> bajo las siguientes condiciones:</p>

            <h4 style={S.contractH4}>1. Programa</h4>
            <p>El Partner queda inscrito en el programa <strong>{tipoLabel}</strong> de SACS con folio <strong>{inv.numero || '—'}</strong>, vigente hasta <strong>{fmtDate(inv.vigencia)}</strong> y renovable automáticamente al cumplir las condiciones de continuidad.</p>

            <h4 style={S.contractH4}>2. Compensación</h4>
            <ul style={S.contractUl}>
              <li><strong>Comisión sobre venta directa:</strong> {ventaPct}% sobre la primera factura de cada cliente cerrado mediante tu link único.</li>
              <li><strong>Bono por prueba gratis:</strong> ${bonusPrueba.toLocaleString('es-MX')} MXN por cada usuario que llega por tu link y activa una prueba gratis válida.</li>
              <li><strong>Bono por demo completada:</strong> ${bonusDemo.toLocaleString('es-MX')} MXN por cada demo válida (25 min mínimo, decisor presente).</li>
              <li><strong>Comisiones recurrentes:</strong> Mientras el cliente referido permanezca activo, mantienes el {ventaPct}% sobre las renovaciones.</li>
            </ul>

            <h4 style={S.contractH4}>3. Liquidación de pagos</h4>
            <p>Las comisiones <em>earned</em> (confirmadas) se liquidan el <strong>día 5 de cada mes</strong> al método de cobro que registraste (CLABE, PayPal o Mercado Pago). Eres responsable del cumplimiento fiscal en tu jurisdicción.</p>

            <h4 style={S.contractH4}>4. Beneficios incluidos</h4>
            <ul style={S.contractUl}>
              <li>Cuenta SACS Plan Fideliza ($14,000 MXN/año) <strong>gratis</strong> mientras estés activo.</li>
              <li>Acceso al portal de partner con métricas en tiempo real, pagos y prospectos.</li>
              <li>Brand kit con logos, plantillas y captions oficiales.</li>
              <li>Soporte prioritario, Academia SACS y workshops mensuales en vivo.</li>
              <li>Sesión de onboarding 1:1 y migración de datos sin costo extra para clientes referidos.</li>
            </ul>

            <h4 style={S.contractH4}>5. Compromisos del Partner</h4>
            <ul style={S.contractUl}>
              <li>Representar la marca SACS de forma profesional y honesta.</li>
              <li>Atender los leads asignados en menos de 24 horas hábiles.</li>
              <li>Asistir a la sesión mensual de actualizaciones (quedan grabadas).</li>
              <li>Cumplir con los compromisos de contenido del programa (mínimo de puntos mensuales).</li>
              <li>No realizar afirmaciones falsas o garantías de resultados sobre SACS.</li>
            </ul>

            <h4 style={S.contractH4}>6. Auditoría y resolución de comisiones</h4>
            <p>SACS se reserva el derecho de auditar cualquier comisión y rechazar las asociadas a leads duplicados, fraudulentos o autoreferenciados. Las rechazadas se marcan como <em>cancelled</em> con motivo y quedan visibles en tu portal.</p>

            <h4 style={S.contractH4}>7. Confidencialidad</h4>
            <p>Te comprometes a no divulgar información confidencial de SACS — precios negociados, roadmap interno, métricas internas o cualquier dato no público — sin autorización escrita.</p>

            <h4 style={S.contractH4}>8. Vigencia y rescisión</h4>
            <p>Este acuerdo tiene una vigencia inicial de <strong>12 meses</strong> a partir de la firma, renovable automáticamente. Cualquiera de las partes puede dar por terminado el acuerdo con <strong>30 días de aviso por escrito</strong>, sin necesidad de causa.</p>

            <h4 style={S.contractH4}>9. Datos y privacidad</h4>
            <p>Autorizas a SACS a procesar tus datos personales para los fines del programa, conforme al <a href="/privacidad" target="_blank" rel="noopener" style={{ color: '#4B7BE5' }}>Aviso de Privacidad</a>.</p>

            <h4 style={S.contractH4}>10. Aceptación</h4>
            <p>Al firmar, declaraste que habías leído íntegramente este acuerdo y que entendías las condiciones de compensación y compromisos. La firma electrónica tiene la misma validez que una firma autógrafa conforme a la NOM-151-SCFI-2016.</p>
          </div>
        )}

        {/* Firma */}
        <div style={{ padding: '24px 32px', background: '#fafafa', borderTop: '1px solid #f0f0ee' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 16 }}>Firma de aceptación</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 28, alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>
                {firmanteNombre}
              </div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
                {signedAt ? `Firmado el ${fmtDate(signedAt)}` : 'Pendiente de firma'}
              </div>
              {approvedAt && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(42,181,160,0.12)', color: '#1A8F7A', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
                  ✓ Aprobado por SACS
                </div>
              )}
            </div>
            <div style={{ background: '#fff', border: '1px solid #e8e8e6', borderRadius: 10, padding: 18, minHeight: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {data.firma_base64 ? (
                <img src={data.firma_base64} alt={`Firma de ${firmanteNombre}`} style={{ maxWidth: '100%', maxHeight: 100, display: 'block' }} />
              ) : (
                <span style={{ fontSize: 13, color: '#aaa' }}>Firma no disponible</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <h2 style={S.h2}>Acciones rápidas</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <a href="#profile" style={S.quick}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>Actualizar payout</div>
          <div style={{ fontSize: 13, color: '#888' }}>CLABE, PayPal o Mercado Pago</div>
        </a>
        <a href="#cuenta-sacs" style={S.quick}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>Tu acceso a SACS</div>
          <div style={{ fontSize: 13, color: '#888' }}>Email, contraseña, app</div>
        </a>
        <a href="mailto:partners@sacscloud.com?subject=Consulta%20sobre%20mi%20acuerdo" style={S.quick}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>Hablar con SACS</div>
          <div style={{ fontSize: 13, color: '#888' }}>partners@sacscloud.com</div>
        </a>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#fafafa', fontFamily: 'var(--font-body)', color: '#1a1a1a' },

  topbar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 24px',
    background: '#fff', borderBottom: '1px solid #ececec',
    position: 'sticky', top: 0, zIndex: 10,
  },
  brand: { fontFamily: 'Clash Display, sans-serif', fontWeight: 700, fontSize: 22, color: '#1a1a1a', textDecoration: 'none', letterSpacing: '-0.02em' },
  brandSep: { color: '#ccc' },
  brandSub: { fontSize: 13, color: '#888', fontWeight: 500 },
  userName: { fontSize: 13, color: '#444', fontWeight: 500 },
  avatar: { width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #4B7BE5, #6C5CE7)', color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoutBtn: { padding: '8px 14px', fontSize: 13, fontWeight: 600, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' },

  body: { display: 'flex', minHeight: 'calc(100vh - 53px)' },
  sidebar: { width: 240, padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 4, borderRight: '1px solid #ececec', background: '#fff', flexShrink: 0 },
  sideBtn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 16px', background: 'transparent', color: '#555', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s', textDecoration: 'none', width: '100%', letterSpacing: '-0.005em' },
  sideBtnActive: { background: '#1a1a1a', color: '#fff' },
  sideBadge: { background: '#f0f0ee', color: '#888', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, fontStyle: 'normal' },
  sideBadgeActive: { background: 'rgba(255,255,255,0.18)', color: '#fff' },
  sideDivider: { height: 1, background: '#ececec', margin: '12px 4px' },
  sidebarFoot: { marginTop: 'auto', padding: 14, borderTop: '1px solid #f0f0ee', background: '#fafafa', borderRadius: 8 },

  main: { flex: 1, overflowY: 'auto', minWidth: 0, background: '#fafafa' },
  mainInner: { padding: '56px 64px 96px', maxWidth: 1040, margin: '0 auto' },

  bottomNav: { display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #ececec', justifyContent: 'space-around', padding: '8px 4px 12px', zIndex: 20 },
  bottomBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' },

  // Tutorial banner
  tut: { display: 'flex', gap: 14, padding: '18px 22px', background: '#fff', border: '1px solid #ececec', borderRadius: 14, marginBottom: 48, alignItems: 'flex-start', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  tutIcon: { flexShrink: 0, width: 24, height: 24, background: '#1a1a1a', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, fontStyle: 'italic', marginTop: 2 },
  tutBody: { fontSize: 14, color: '#555', lineHeight: 1.65, flex: 1, paddingTop: 4 },

  h1: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500, margin: '0 0 8px', letterSpacing: '-0.025em', lineHeight: 1.15 },
  h2: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, margin: '64px 0 24px', letterSpacing: '-0.02em' },
  h3: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: '0 0 16px', letterSpacing: '-0.015em', color: '#1a1a1a' },
  lead: { fontSize: 16, color: '#888', margin: '0 0 56px', lineHeight: 1.5 },

  // KPIs
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 },
  kpiGrid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 },
  kpi: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: '28px 26px', position: 'relative', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  kpiDot: { position: 'absolute', top: 28, left: 26, width: 6, height: 6, borderRadius: '50%' },
  kpiLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 14 },
  kpiValue: { fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500, color: '#1a1a1a', lineHeight: 1, letterSpacing: '-0.035em' },
  kpiHint: { fontSize: 13, color: '#999', marginTop: 10, lineHeight: 1.4 },

  // Notes
  note: { margin: '24px 0 0', padding: '16px 22px', background: 'rgba(75,123,229,0.04)', borderRadius: 10, fontSize: 14, color: '#555', lineHeight: 1.65 },

  // Tables
  tableWrap: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left' as const, padding: '14px 24px', fontWeight: 600, color: '#999', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #f0f0ee', background: '#fafafa' },
  thRight: { textAlign: 'right' as const, padding: '14px 24px', fontWeight: 600, color: '#999', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid #f0f0ee', background: '#fafafa' },
  td: { padding: '18px 24px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'top' },
  tdRight: { padding: '18px 24px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'top', textAlign: 'right' as const, fontFamily: 'var(--font-display)' },
  tr: { transition: 'background 0.1s' },
  tag: { display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#666', background: '#f5f5f7', textTransform: 'uppercase', letterSpacing: '0.06em', fontStyle: 'normal' },
  subtxt: { fontSize: 12, color: '#888', marginTop: 2 },

  // Filters
  filtersRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 16, alignItems: 'center' },
  filterLbl: { fontSize: 11, fontWeight: 600, color: '#999', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginRight: 6 },
  filter: { padding: '8px 14px', border: '1px solid #f0f0ee', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s, color 0.15s, border-color 0.15s' },
  footStats: { marginTop: 28, padding: '16px 22px', background: '#fff', border: '1px solid #f0f0ee', borderRadius: 12, fontSize: 14, color: '#666', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },

  // Empty / loading
  loading: { padding: 40, color: '#888', textAlign: 'center' as const },
  error: { padding: 40, color: '#c62828', textAlign: 'center' as const },
  empty: { padding: 40, background: '#fff', border: '1px dashed #ddd', borderRadius: 12, color: '#888', textAlign: 'center' as const, fontSize: 14 },
  emptyHint: { display: 'flex', flexDirection: 'column' as const, gap: 4, padding: 24, background: 'linear-gradient(120deg, rgba(75,123,229,0.06), rgba(108,92,231,0.04))', border: '1px solid rgba(75,123,229,0.18)', borderRadius: 12, fontSize: 14, color: '#444', lineHeight: 1.55, marginBottom: 32 },

  // Toast
  toast: { position: 'fixed', top: 70, right: 20, zIndex: 100, background: '#fff', border: '1px solid #2AB5A0', borderLeft: '4px solid #2AB5A0', borderRadius: 10, padding: '14px 18px', boxShadow: '0 12px 32px -10px rgba(0,0,0,0.18)', maxWidth: 360, fontFamily: 'var(--font-body)', animation: 'slideInRight 0.3s ease-out' },

  // Buttons
  btnPrimary: { padding: '12px 22px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost: { padding: '10px 16px', background: '#fafafa', color: '#1a1a1a', border: '1px solid #f0f0ee', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhostDark: { padding: '12px 18px', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },

  // Bars (top fuentes)
  barRow: { display: 'grid', gridTemplateColumns: '2fr 3fr 90px', gap: 20, alignItems: 'center', background: '#fff', border: '1px solid #f0f0ee', borderRadius: 12, padding: '18px 22px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },

  // Pay
  payCard: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  paySummary: { padding: '24px 28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, cursor: 'pointer' },
  payRef: { fontSize: 12, color: '#aaa', marginTop: 4, fontFamily: 'SF Mono, Courier New, monospace' },
  payMetaGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '14px 28px', borderTop: '1px solid #f0f0ee', borderBottom: '1px solid #f0f0ee' },
  metaLbl: { fontSize: 10, fontWeight: 600, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 },
  metaVal: { fontSize: 14, color: '#1a1a1a', fontWeight: 500 },
  payList: { padding: '16px 28px 22px' },
  payItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px dashed #f0f0ee', gap: 16 },

  // Funnel
  funnel: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 36, flexWrap: 'wrap' as const },
  funnelStep: { flex: 1, minWidth: 130, background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: '22px 16px', textAlign: 'center' as const, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  funnelStepWin: { background: 'linear-gradient(135deg, rgba(42,181,160,0.08), rgba(75,123,229,0.04))', borderColor: 'rgba(42,181,160,0.25)' },
  funnelNum: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500, color: '#1a1a1a', lineHeight: 1, letterSpacing: '-0.035em' },
  funnelLbl: { fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginTop: 10 },

  // Mi participación
  partStatus: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 16, padding: '32px 36px', marginBottom: 32, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  partStatusHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginBottom: 22, flexWrap: 'wrap' as const },
  partBar: { position: 'relative', height: 12, background: '#f5f5f3', borderRadius: 999, overflow: 'visible' },
  partBarFill: { height: '100%', background: 'linear-gradient(90deg, #6CD6C2 0%, #4B7BE5 100%)', borderRadius: 999, transition: 'width 0.6s ease-out' },

  puntosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  puntosCard: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  puntosPts: { fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 500, color: '#1a1a1a', lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 12 },
  puntosName: { fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 },
  puntosDesc: { fontSize: 12, color: '#888', lineHeight: 1.4 },

  partForm: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: 24, marginBottom: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  field: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  fieldLbl: { fontSize: 11, fontWeight: 600, color: '#999', letterSpacing: '0.08em', textTransform: 'uppercase' as const },
  input: { padding: '13px 16px', fontSize: 15, fontFamily: 'inherit', color: '#1a1a1a', border: '1px solid #ececec', borderRadius: 10, background: '#fafafa', outline: 'none' },

  // Link tab
  linkCard: { background: '#1a1a1a', color: '#fff', borderRadius: 16, padding: '32px 36px', marginBottom: 40 },
  linkUrl: { fontFamily: 'SF Mono, Courier New, monospace', fontSize: 18, marginBottom: 22, wordBreak: 'break-all' as const, lineHeight: 1.5 },
  linkGrid: { display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24, marginBottom: 40 },
  linkBlock: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: 28, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  shareBtn: { background: '#fafafa', border: '1px solid #f0f0ee', color: '#1a1a1a', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 500, cursor: 'pointer', textDecoration: 'none', display: 'inline-block', fontFamily: 'inherit' },

  template: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: 24, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  templateHead: { fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 14 },
  templateBody: { background: '#fafaf8', borderRadius: 10, padding: '16px 18px', fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 14, whiteSpace: 'pre-wrap' as const },

  // Profile
  perfilSection: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: '32px 36px', marginBottom: 22, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  sectionSub: { fontSize: 14, color: '#888', margin: '-8px 0 24px', lineHeight: 1.5 },

  // Cuenta SACS
  cuentaPlan: { background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d44 100%)', color: '#fff', borderRadius: 16, padding: '32px 36px', marginBottom: 32 },
  accessCard: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: '28px 32px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  accessRow: { display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: 24, alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f5f5f3' },
  accessLbl: { fontSize: 12, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontWeight: 600 },
  accessVal: { fontSize: 15, color: '#1a1a1a', fontWeight: 500 },
  accessCta: { display: 'block', marginTop: 18, padding: '14px 20px', background: '#1a1a1a', color: '#fff', borderRadius: 10, textAlign: 'center' as const, textDecoration: 'none', fontWeight: 600, fontSize: 15 },

  vigGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  vigCard: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: '24px 26px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  vigLbl: { fontSize: 11, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 600, marginBottom: 12 },
  vigVal: { fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, color: '#1a1a1a', lineHeight: 1, letterSpacing: '-0.025em', marginBottom: 8 },
  vigHint: { fontSize: 13, color: '#888', lineHeight: 1.4 },

  inclGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 },
  incl: { display: 'flex', gap: 14, padding: '18px 22px', background: '#fff', border: '1px solid #f0f0ee', borderRadius: 12, alignItems: 'flex-start', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  inclCheck: { flexShrink: 0, width: 24, height: 24, background: 'rgba(42,181,160,0.12)', color: '#1A8F7A', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, marginTop: 2 },

  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 },
  quick: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: '24px 22px', textDecoration: 'none', color: '#1a1a1a', transition: 'transform 0.15s, box-shadow 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },

  // Actualizaciones
  actuNext: { background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d44 100%)', color: '#fff', borderRadius: 16, padding: '32px 36px', marginBottom: 32 },
  actuNextEyebrow: { fontSize: 11, fontWeight: 600, color: '#6CD6C2', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 16 },
  actuNextGrid: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 32, alignItems: 'start' as const },
  actuNextDate: { fontSize: 13, color: '#6CD6C2', fontWeight: 600, marginBottom: 8 },
  actuNextTitle: { fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: '#fff', marginBottom: 14, letterSpacing: '-0.02em', lineHeight: 1.25 },
  actuNextDesc: { fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: 18 },
  actuNextMeta: { display: 'flex', flexDirection: 'column' as const, gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.65)' },

  recGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 },
  recCard: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  recThumb: { aspectRatio: '16/9', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  recPlay: { width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', color: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  recDuration: { position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 6 },
  recBody: { padding: '18px 20px 20px' },
  recMonth: { fontSize: 11, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 600, marginBottom: 8 },
  recTitle: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 14, letterSpacing: '-0.005em', lineHeight: 1.35 },

  // Brand kit
  bkLogos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 },
  bkLogo: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: '22px 24px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  bkColors: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 },
  bkFont: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: '32px 28px 24px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },

  // Status banners (warning / final_warning / suspended)
  statusBannerWarning: { padding: '20px 24px', background: 'rgba(232,168,56,0.10)', border: '1px solid rgba(232,168,56,0.30)', borderLeft: '4px solid #E8A838', borderRadius: 12, marginBottom: 24 },
  statusBannerFinal: { padding: '20px 24px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', borderLeft: '4px solid #c62828', borderRadius: 12, marginBottom: 24 },
  statusBannerSuspended: { padding: '24px 28px', background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.40)', borderRadius: 14, marginBottom: 28 },

  // Countdown grid
  countdownGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 32, marginTop: 16 },
  countdownCard: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 14, padding: '22px 24px', textAlign: 'center' as const, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  countdownNum: { fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 500, color: '#1a1a1a', letterSpacing: '-0.035em', lineHeight: 1, marginBottom: 8 },
  countdownLbl: { fontSize: 12, color: '#666', fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 },
  countdownHint: { fontSize: 11, color: '#999' },

  // Certificaciones
  certGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 },
  certCard: { background: '#fff', border: '1px solid #f0f0ee', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'transform 0.18s, box-shadow 0.18s' },
  certCover: { position: 'relative' as const, aspectRatio: '16 / 11', background: '#1a1a1a', overflow: 'hidden' },
  certCoverFade: { position: 'absolute' as const, inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' as const },
  certCoverBody: { position: 'absolute' as const, left: 20, right: 20, bottom: 18, color: '#fff', zIndex: 2 },
  certLevel: { fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const, opacity: 0.85, marginBottom: 6 },
  certName: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.02em' },
  certLock: { position: 'absolute' as const, top: 16, right: 16, zIndex: 2, width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.18)' },
  certBadge: { position: 'absolute' as const, top: 16, right: 16, zIndex: 2, padding: '6px 12px', borderRadius: 999, background: 'rgba(42,181,160,0.95)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const },

  certBody: { padding: '24px 26px 26px', flex: 1, display: 'flex', flexDirection: 'column' as const },
  certPriceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid #f0f0ee' },
  certBtn: { padding: '12px 20px', borderRadius: 10, border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, display: 'inline-block', textAlign: 'center' as const },
  certDesc: { fontSize: 14, color: '#555', lineHeight: 1.6, margin: '0 0 18px' },
  certSection: { marginTop: 14 },
  certSectionLbl: { fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 10 },
  certSectionVal: { fontSize: 13, color: '#555', lineHeight: 1.55 },
  certTopics: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: 8 },
  certTopic: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#444', lineHeight: 1.5 },
  certTopicBullet: { flexShrink: 0, width: 5, height: 5, borderRadius: '50%', background: '#4B7BE5', marginTop: 8 },
  certMore: { marginTop: 12, padding: 0, background: 'transparent', border: 'none', color: '#4B7BE5', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  certBlocked: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, padding: '10px 12px', background: '#fafafa', borderRadius: 8, fontSize: 12, color: '#888', fontWeight: 500 },
  certPaid: { padding: '20px 24px', background: 'linear-gradient(135deg, rgba(42,181,160,0.10), rgba(75,123,229,0.06))', border: '1px solid rgba(42,181,160,0.25)', borderRadius: 12, marginBottom: 28 },

  // Mi acuerdo · contrato
  contractH4: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: '#1a1a1a', margin: '24px 0 8px', letterSpacing: '-0.01em' },
  contractUl: { paddingLeft: 22, margin: '8px 0 12px', display: 'flex', flexDirection: 'column' as const, gap: 6 },
};
