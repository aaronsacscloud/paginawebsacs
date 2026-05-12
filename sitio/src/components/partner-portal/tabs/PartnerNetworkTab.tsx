// Red de partners — sistema completo de gestión de red para Master Partners (Lvl 3+).
// Si el partner no tiene el nivel, ve el preview "locked" con call-to-action motivacional.

import { useEffect, useMemo, useState } from 'react';
import { fmt, fmtNum, fmtDate, fmtRel, isDemoMode, apiGet, copyToClipboard } from './utils';
import { SS, C } from './styles';
import { Icon } from './icons';
import { demoPartnerNetwork, demoLeads } from '../../../data/partner-portal-demo';

type Partner = typeof demoPartnerNetwork.partners[number];
type Invitation = typeof demoPartnerNetwork.invitaciones[number];

type Props = {
  user: { id: string; nombre: string; email: string };
};

const TIPO_LABELS: Record<string, string> = {
  embajador: 'Embajador',
  distribuidor: 'Distribuidor',
  integrador: 'Integrador',
  reseller: 'Reseller',
  consultor: 'Consultor',
};

export default function PartnerNetworkTab({ user }: Props) {
  // En real: determinar nivel del partner via certifs + leads stats.
  // En demo mode: usar stats fijo. Soporta override via ?lvl=1 para ver locked.
  const isDemo = isDemoMode();
  const forceLevel = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const u = new URL(window.location.href);
    const v = u.searchParams.get('lvl');
    return v ? Number(v) : null;
  }, []);

  const [leads, setLeads] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/api/partner-portal/leads', isDemo ? demoLeads : undefined).then(l => { setLeads(l); setLoading(false); });
  }, [isDemo]);

  if (loading) return <div style={SS.loading}>Cargando red…</div>;

  // Determinar si está unlocked
  const realSucursales = isDemo
    ? demoPartnerNetwork.stats.sucursales_activas
    : (leads?.deals || []).filter((d: any) => d.stage === 'won').length;
  const realLevel = realSucursales >= 5 ? 3 : realSucursales >= 1 ? 2 : 1;
  const currentLevel = forceLevel ?? (isDemo ? 3 : realLevel);
  const isUnlocked = currentLevel >= 3;

  if (!isUnlocked) {
    // Si forzamos un nivel bajo en demo, usa un conteo demo bajo para que la barra
    // de progreso tenga sentido (en lugar de mostrar 26/5).
    const sucursalesShown = forceLevel !== null ? Math.min(realSucursales, currentLevel === 2 ? 3 : 2) : realSucursales;
    return <LockedView sucursalesActivas={sucursalesShown} currentLevel={currentLevel} />;
  }

  return <UnlockedView user={user} />;
}

// ─── VISTA LOCKED ─────────────────────────────────────────────
function LockedView({ sucursalesActivas, currentLevel }: { sucursalesActivas: number; currentLevel: number }) {
  const remaining = Math.max(0, 5 - sucursalesActivas);
  const progress = Math.min(100, (sucursalesActivas / 5) * 100);

  return (
    <div>
      <h1 style={SS.h1Small}>Red de partners</h1>
      <p style={SS.leadSm}>Invita a otros partners y gana 10% sobre cada venta que cierre tu red — ingreso recurrente sin tope.</p>

      {/* Locked hero — azul SACS gradient */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`,
        color: '#fff',
        borderRadius: 18,
        padding: '52px 56px',
        marginBottom: 36,
        position: 'relative' as const,
        overflow: 'hidden' as const,
        boxShadow: '0 16px 40px -20px rgba(75,123,229,0.45)',
      }}>
        {/* Lock badge */}
        <div style={{
          position: 'absolute' as const, top: 28, right: 28,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', background: 'rgba(255,255,255,0.18)', color: '#fff',
          borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const,
          backdropFilter: 'blur(8px)',
        }}>
          <LockIcon size={12} /> Bloqueado · Lvl 3+
        </div>

        <div style={{ maxWidth: 620 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const }}>
            Master Partner
          </span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 500, color: '#fff', margin: '16px 0 18px', letterSpacing: '-0.025em', lineHeight: 1.12 }}>
            Tu propia red.<br/>10% sobre tu red, recurrente.
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 1.65, margin: 0 }}>
            Cuando completes <strong style={{ color: '#fff' }}>5 sucursales activas</strong>, se activa Master Partner Nv 1 — automáticamente.
            A partir de ahí puedes invitar partners y ganar 10% de cada venta que cierren, mes con mes,
            mientras estén activos.
          </p>
        </div>

        {/* Progress to unlock */}
        <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, flexWrap: 'wrap' as const, gap: 8 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>
              Tu progreso
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em' }}>
              {sucursalesActivas} <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>/ 5 sucursales</span>
            </span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.18)', borderRadius: 999, overflow: 'hidden' as const }}>
            <div style={{
              width: `${progress}%`, height: '100%',
              background: '#fff',
              borderRadius: 999, transition: 'width 0.6s ease-out',
            }} />
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', margin: '16px 0 0', lineHeight: 1.55 }}>
            {remaining === 0
              ? '¡Listo! Se activa en las próximas 24-48h automáticamente.'
              : `Te faltan ${remaining} ${remaining === 1 ? 'sucursal' : 'sucursales'} más para desbloquear. Sigue compartiendo tu link y cerrando clientes.`}
          </p>
        </div>
      </div>

      {/* Preview de lo que verás */}
      <h2 style={SS.h2}>Esto es lo que vas a poder hacer</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Feature Ico={Icon.Share} title="Tu propio link de invitación" desc="Comparte un link único para que partners se unan bajo tu red. SACS valida y aprueba." />
        <Feature Ico={Icon.Customers} title="Lista de partners en tu red" desc="Ve a todos tus partners con sus clientes, MRR, certificaciones y compromisos del mes." />
        <Feature Ico={Icon.TrendingUp} title="10% sobre tu red, recurrente" desc="Cada venta de tus partners genera 10% para ti, mes con mes, sin tope mientras estén activos." />
        <Feature Ico={Icon.Activity} title="Tracking de invitaciones" desc="Ve quién vio tu invitación, cuánto tiempo le dedicó, qué secciones leyó, si aceptó o no." />
      </div>

      {/* Preview blurred mockup */}
      <h2 style={SS.h2}>Vista previa del panel</h2>
      <div style={{
        position: 'relative' as const,
        borderRadius: 16,
        overflow: 'hidden' as const,
        border: `1px solid ${C.border}`,
        background: C.card,
      }}>
        <div style={{
          filter: 'blur(2px)',
          opacity: 0.5,
          pointerEvents: 'none' as const,
          padding: '24px 28px',
        }}>
          <MockUnlockedPreview />
        </div>
        <div style={{
          position: 'absolute' as const, inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.55)',
        }}>
          <div style={{ textAlign: 'center' as const }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 54, height: 54, borderRadius: '50%',
              background: C.brand, color: '#fff',
              marginBottom: 14,
              boxShadow: '0 8px 20px -8px rgba(75,123,229,0.45)',
            }}>
              <LockIcon size={22} />
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 4 }}>
              Disponible en Master Partner
            </div>
            <div style={{ fontSize: 13, color: C.muted }}>
              Sigue construyendo tu cartera — desbloquéalo automáticamente.
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...SS.note, marginTop: 24 }}>
        <strong>Activación automática.</strong> El portal te reconoce y te sube de nivel solo — sin pedir nada.
        Cuando completes tus 5 sucursales activas, recibirás un email y este panel se desbloquea.
      </div>
    </div>
  );
}

function Feature({ Ico, title, desc }: { Ico: (p: any) => JSX.Element; title: string; desc: string }) {
  return (
    <div style={SS.card}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: 10,
        background: 'rgba(75,123,229,0.12)', color: C.accent,
        marginBottom: 14,
      }}>
        <Ico size={18} />
      </span>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55 }}>{desc}</div>
    </div>
  );
}

function MockUnlockedPreview() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'PARTNERS ACTIVOS', value: '5' },
          { label: 'MRR DE LA RED', value: '$14,300' },
          { label: 'MI OVERRIDE/MES', value: '$1,310' },
          { label: 'INVITACIONES', value: '2' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '20px 22px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 10 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {['María González', 'Andrea Vega', 'Roberto Martínez', 'Carlos López'].map((n, i) => (
          <div key={i} style={{ padding: '16px 18px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{n}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Lvl 2 · 8 clientes · $4,200/mes</div>
          </div>
        ))}
      </div>
    </>
  );
}

function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

// ─── VISTA UNLOCKED ─────────────────────────────────────────
function UnlockedView({ user }: { user: { id: string; nombre: string; email: string } }) {
  const data = demoPartnerNetwork;
  const [view, setView] = useState<'partners' | 'invitaciones'>('partners');
  const [filter, setFilter] = useState<'todos' | 'activa' | 'suspendida' | 'sin_clientes'>('todos');
  const [drawerPartner, setDrawerPartner] = useState<Partner | null>(null);
  const [drawerInv, setDrawerInv] = useState<Invitation | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const partnersFiltrados = useMemo(() => {
    return data.partners.filter(p => {
      if (filter === 'todos') return true;
      if (filter === 'activa') return p.estado === 'activa';
      if (filter === 'suspendida') return p.estado === 'suspendida';
      if (filter === 'sin_clientes') return p.clientes_count === 0;
      return true;
    });
  }, [filter, data.partners]);

  const myInviteLink = `https://www.sacscloud.com/p/${(user.nombre || 'andrea').toLowerCase().split(' ')[0]}/invitar`;

  return (
    <div>
      <h1 style={SS.h1Small}>Red de partners</h1>
      <p style={SS.leadSm}>Tus partners y tu comisión del 10% sobre todas las ventas que generan, mes con mes.</p>

      {/* Hero stats */}
      <div style={SS.statGrid}>
        <BigStat label="Partners activos" value={String(data.stats.partners_activos)} hint={`${data.stats.partners_suspendidos} suspendido${data.stats.partners_suspendidos === 1 ? '' : 's'}`} accent={C.green} />
        <BigStat label="Ingreso mensual de la red" value={fmt(data.stats.mrr_red_total)} hint={`${data.partners.reduce((s, p) => s + p.clientes_count, 0)} clientes`} accent={C.accent} />
        <BigStat label="Mi comisión / mes" value={fmt(data.stats.mi_override_mes_total)} hint="10% recurrente · sin tope" accent={C.greenDark} />
        <BigStat label="Invitaciones" value={String(data.stats.invitaciones_pendientes)} hint={`${data.stats.invitaciones_aceptadas_30d} aceptada${data.stats.invitaciones_aceptadas_30d === 1 ? '' : 's'} este mes`} accent={C.amber} />
      </div>

      {/* Invitar partner */}
      <div style={{
        background: '#4B7BE5',
        borderRadius: 16,
        padding: '28px 32px',
        marginTop: 32, marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 24, flexWrap: 'wrap' as const,
      }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
            Master Partner Nv {data.stats.master_partner_sub_level}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em', marginBottom: 6 }}>
            Invita partners. Gana 10% recurrente.
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>
            Cada partner que invitas + se aprueba suma a tu red. Cobras 10% de cada venta que cierren, mes con mes, sin tope.
          </div>
        </div>
        <button onClick={() => setInviteOpen(true)}
          style={{
            padding: '14px 24px',
            background: '#fff',
            color: '#4B7BE5',
            borderRadius: 999,
            fontWeight: 600,
            fontSize: 14,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap' as const,
          }}>
          <Icon.Plus size={16} strokeWidth={2.2} /> Invitar partner
        </button>
      </div>

      {/* Tabs internas */}
      <div style={{ display: 'flex', gap: 6, marginTop: 28, marginBottom: 18, borderBottom: `1px solid ${C.border}` }}>
        <TabBtn active={view === 'partners'} onClick={() => setView('partners')} label={`Partners (${data.partners.length})`} />
        <TabBtn active={view === 'invitaciones'} onClick={() => setView('invitaciones')} label={`Invitaciones (${data.invitaciones.filter(i => i.estado !== 'accepted').length})`} />
      </div>

      {view === 'partners' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 16 }}>
            <Chip active={filter === 'todos'}        onClick={() => setFilter('todos')}        label={`Todos · ${data.partners.length}`} />
            <Chip active={filter === 'activa'}       onClick={() => setFilter('activa')}       label={`Activos · ${data.partners.filter(p => p.estado === 'activa').length}`} />
            <Chip active={filter === 'sin_clientes'} onClick={() => setFilter('sin_clientes')} label={`Sin clientes · ${data.partners.filter(p => p.clientes_count === 0).length}`} />
            <Chip active={filter === 'suspendida'}   onClick={() => setFilter('suspendida')}   label={`Suspendidos · ${data.partners.filter(p => p.estado === 'suspendida').length}`} />
          </div>

          <div style={SS.tableWrap}>
            <table style={SS.table}>
              <thead>
                <tr>
                  <th style={SS.th}>Partner</th>
                  <th style={SS.th}>Nivel</th>
                  <th style={SS.th}>Clientes</th>
                  <th style={SS.th}>Cobro mensual</th>
                  <th style={SS.th}>Mi comisión</th>
                  <th style={SS.th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {partnersFiltrados.map(p => (
                  <tr key={p.id} onClick={() => setDrawerPartner(p)} style={{ cursor: 'pointer' }}>
                    <td style={SS.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar initials={p.avatar_initials} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{p.empresa} · {p.ciudad}</div>
                        </div>
                      </div>
                    </td>
                    <td style={SS.td}>
                      <LevelPill level={p.nivel} tipo={p.tipo} />
                    </td>
                    <td style={SS.td}>
                      <div style={{ fontWeight: 600 }}>{p.clientes_count}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{p.meses_activa}m activo</div>
                    </td>
                    <td style={{ ...SS.td, fontFamily: 'var(--font-display)' }}>{fmt(p.mrr_total)}</td>
                    <td style={{ ...SS.td, fontFamily: 'var(--font-display)', color: C.greenDark, fontWeight: 600 }}>{fmt(p.mi_override_mes)}<span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 4 }}>/mes</span></td>
                    <td style={SS.td}><EstadoPill estado={p.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {partnersFiltrados.length === 0 && (
            <div style={SS.empty}>No hay partners en esta categoría.</div>
          )}

          <div style={{ ...SS.note, marginTop: 24, fontSize: 13 }}>
            <strong>Tip:</strong> los partners sin clientes en su primer mes responden bien a una llamada de bienvenida.
            Los que llevan 1+ mes sin actividad necesitan estrategia conjunta — son los primeros en suspenderse.
          </div>
        </>
      )}

      {view === 'invitaciones' && (
        <>
          <p style={{ ...SS.leadSm, marginTop: 0 }}>Cada invitación que envíes a SACS se aprueba en menos de 48h hábiles. Tracking en vivo de quién la vio y qué tan interesado está.</p>

          {data.invitaciones.length === 0 ? (
            <div style={SS.empty}>Sin invitaciones enviadas. Usa "Invitar partner" para empezar.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              {data.invitaciones.map(inv => (
                <button key={inv.id} onClick={() => setDrawerInv(inv)}
                  style={{
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                    padding: '22px 26px', textAlign: 'left' as const, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const,
                    transition: 'transform 0.12s, box-shadow 0.12s',
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 18px -10px rgba(0,0,0,0.12)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = 'none'; }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: C.text, fontSize: 15 }}>{inv.nombre}</span>
                      <InvStatusPill estado={inv.estado as any} />
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{inv.empresa} · {TIPO_LABELS[inv.tipo] || inv.tipo} · {inv.numero}</div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: C.muted, flexWrap: 'wrap' as const }}>
                      <span><Icon.Calendar size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Enviada {fmtRel(inv.enviada_at)}</span>
                      {inv.vista_at && <span><Icon.Eye size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Vista {fmtRel(inv.vista_at)}</span>}
                      {inv.visitas > 0 && <span><Icon.Activity size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />{inv.visitas} visitas</span>}
                    </div>
                  </div>
                  {inv.interest_score > 0 && (
                    <div style={{ textAlign: 'right' as const }}>
                      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Interés</div>
                      <div style={{
                        fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500,
                        color: inv.interest_score >= 70 ? C.greenDark : inv.interest_score >= 40 ? C.amber : C.muted,
                        letterSpacing: '-0.02em',
                      }}>{inv.interest_score}<span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>/100</span></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Drawer detalle partner */}
      {drawerPartner && <PartnerDrawer partner={drawerPartner} onClose={() => setDrawerPartner(null)} />}

      {/* Drawer detalle invitación */}
      {drawerInv && <InvitationDrawer inv={drawerInv} onClose={() => setDrawerInv(null)} />}

      {/* Drawer crear invitación */}
      {inviteOpen && <InviteDrawer myInviteLink={myInviteLink} onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

function TabBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '12px 18px',
        background: 'transparent',
        color: active ? C.brand : C.muted,
        border: 'none',
        borderBottom: active ? `2px solid ${C.brand}` : '2px solid transparent',
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        marginBottom: -1,
        transition: 'color 0.15s, border-color 0.15s',
      }}>{label}</button>
  );
}

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '8px 14px',
        border: `1px solid ${active ? C.brand : C.border}`,
        background: active ? C.brand : '#fff',
        color: active ? '#fff' : C.text,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 0.15s, border-color 0.15s',
      }}>{label}</button>
  );
}

function BigStat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: string }) {
  return (
    <div style={SS.statCard}>
      <span style={{ position: 'absolute', top: 24, right: 24, width: 6, height: 6, borderRadius: '50%', background: accent }} />
      <div style={SS.statLabel}>{label}</div>
      <div style={SS.statValueSm}>{value}</div>
      {hint && <div style={SS.statHint}>{hint}</div>}
    </div>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span style={{
      flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
      background: 'linear-gradient(135deg, #4B7BE5 0%, #6C5CE7 100%)',
      color: '#fff', fontSize: 13, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      letterSpacing: '-0.005em',
    }}>{initials}</span>
  );
}

function LevelPill({ level, tipo }: { level: number; tipo: string }) {
  const color = level >= 3 ? C.gold : level >= 2 ? C.greenDark : C.muted;
  return (
    <div>
      <span style={{
        display: 'inline-block', padding: '3px 10px', borderRadius: 999,
        fontSize: 11, fontWeight: 700, color, background: `${color}1a`,
        letterSpacing: '0.04em',
      }}>LVL {level}</span>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{TIPO_LABELS[tipo] || tipo}</div>
    </div>
  );
}

function EstadoPill({ estado }: { estado: string }) {
  if (estado === 'activa')      return <Pill color={C.greenDark} bg="rgba(42,181,160,0.12)">Activa</Pill>;
  if (estado === 'suspendida')  return <Pill color={C.red}       bg="rgba(220,38,38,0.10)">Suspendida</Pill>;
  return <Pill color={C.amber} bg="rgba(232,168,56,0.14)">{estado}</Pill>;
}

function InvStatusPill({ estado }: { estado: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired' }) {
  const map = {
    draft:    { label: 'Borrador',   color: C.muted,     bg: '#f5f5f3' },
    sent:     { label: 'Enviada',    color: C.accent,    bg: 'rgba(75,123,229,0.10)' },
    viewed:   { label: 'Vista',      color: C.purple,    bg: 'rgba(108,92,231,0.10)' },
    accepted: { label: 'Aceptada',   color: C.greenDark, bg: 'rgba(42,181,160,0.12)' },
    declined: { label: 'Rechazada',  color: C.red,       bg: 'rgba(220,38,38,0.10)' },
    expired:  { label: 'Expirada',   color: C.mutedLight, bg: '#f5f5f3' },
  };
  const s = map[estado] || map.draft;
  return <Pill color={s.color} bg={s.bg}>{s.label}</Pill>;
}

function Pill({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', padding: '4px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, color, background: bg, letterSpacing: '0.04em',
    }}>{children}</span>
  );
}

// ─── Drawer: detalle del partner ─────────────────────────────
function PartnerDrawer({ partner, onClose }: { partner: Partner; onClose: () => void }) {
  const certNames: Record<string, string> = {
    impl_una_sucursal: 'Implementación · 1 sucursal',
    impl_multisucursal: 'Implementación · Multi-sucursal',
    migracion_datos: 'Migración de datos',
    ia_automatizacion: 'Automatización con IA',
    consultor_ia: 'Consultor en IA',
  };

  return (
    <>
      <div style={SS.drawerBackdrop} onClick={onClose} />
      <div style={{ ...SS.drawer, width: 'min(560px, 100vw)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 8 }}>
          <Icon.Close size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <Avatar initials={partner.avatar_initials} />
          <div>
            <h2 style={{ ...SS.h1Small, margin: 0 }}>{partner.nombre}</h2>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{partner.empresa} · {partner.ciudad}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' as const }}>
          <LevelPill level={partner.nivel} tipo={partner.tipo} />
          <EstadoPill estado={partner.estado} />
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <MiniStat label="Clientes activos" value={String(partner.clientes_count)} />
          <MiniStat label="Cobro mensual" value={fmt(partner.mrr_total)} />
          <MiniStat label="Mi comisión / mes" value={fmt(partner.mi_override_mes)} accent={C.greenDark} />
          <MiniStat label="Total ganado" value={fmt(partner.mi_override_total)} />
        </div>

        {/* Compromisos del mes */}
        <h3 style={SS.h3}>Compromisos del mes</h3>
        <div style={{ ...SS.card, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }}>
              {partner.pts_mes} <span style={{ fontSize: 13, color: C.muted, fontWeight: 400 }}>/ {partner.pts_meta} pts</span>
            </span>
            <span style={{ fontSize: 12, color: partner.pts_mes >= partner.pts_meta ? C.greenDark : C.amber, fontWeight: 600 }}>
              {partner.pts_mes >= partner.pts_meta ? 'Meta cumplida' : 'En riesgo'}
            </span>
          </div>
          <div style={{ ...SS.bar, height: 6 }}>
            <div style={{ ...SS.barFill, width: `${Math.min(100, (partner.pts_mes / partner.pts_meta) * 100)}%` }} />
          </div>
        </div>

        {/* Certificaciones */}
        <h3 style={SS.h3}>Certificaciones tomadas</h3>
        {partner.certs.length === 0 ? (
          <div style={{ ...SS.card, marginBottom: 24, color: C.muted, fontSize: 13 }}>
            Aún sin certificaciones. Está en Lvl {partner.nivel}.
          </div>
        ) : (
          <div style={{ ...SS.card, marginBottom: 24, display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            {partner.certs.map(c => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon.Certificate size={16} color={C.greenDark} />
                <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{certNames[c] || c}</span>
              </div>
            ))}
          </div>
        )}

        {/* Activity */}
        <h3 style={SS.h3}>Actividad</h3>
        <div style={{ ...SS.card, marginBottom: 24 }}>
          <DrawerRow label="Último login" value={fmtRel(partner.ultimo_login)} />
          <DrawerRow label="Meses activo" value={`${partner.meses_activa} ${partner.meses_activa === 1 ? 'mes' : 'meses'}`} />
          <DrawerRow label="Churn risk" value={
            partner.churn_risk === 'alto' ? 'Alto · contactar ya' :
            partner.churn_risk === 'medio' ? 'Medio · seguimiento' : 'Bajo · OK'
          } />
        </div>

        {partner.estado === 'suspendida' && (
          <div style={{ padding: '16px 22px', background: 'rgba(220,38,38,0.06)', border: `1px solid rgba(220,38,38,0.20)`, borderLeft: `4px solid ${C.red}`, borderRadius: 10, fontSize: 13, color: '#8a1f1f', lineHeight: 1.5 }}>
            <strong>Partner suspendido.</strong> 3 meses consecutivos sin alcanzar la meta. Mientras esté suspendido, no te genera comisión.
          </div>
        )}
      </div>
    </>
  );
}

function DrawerRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${C.borderSoft}`, gap: 16 }}>
      <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 500, textAlign: 'right' as const }}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: C.bg, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: accent || C.text, letterSpacing: '-0.018em', lineHeight: 1.15 }}>{value}</div>
    </div>
  );
}

// ─── Drawer: detalle de invitación enviada ─────────────────────
function InvitationDrawer({ inv, onClose }: { inv: Invitation; onClose: () => void }) {
  return (
    <>
      <div style={SS.drawerBackdrop} onClick={onClose} />
      <div style={SS.drawer}>
        <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 8 }}>
          <Icon.Close size={20} />
        </button>

        <InvStatusPill estado={inv.estado as any} />
        <h2 style={{ ...SS.h1Small, margin: '14px 0 4px' }}>{inv.nombre}</h2>
        <p style={{ fontSize: 14, color: C.muted, margin: '0 0 4px' }}>{inv.empresa}</p>
        <p style={{ fontSize: 12, color: C.muted, margin: '0 0 24px', fontFamily: 'SF Mono, Courier New, monospace' }}>{inv.numero}</p>

        {/* Interest score */}
        {inv.interest_score > 0 && (
          <div style={{ ...SS.card, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Nivel de interés</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500,
                color: inv.interest_score >= 70 ? C.greenDark : inv.interest_score >= 40 ? C.amber : C.muted,
                letterSpacing: '-0.02em',
              }}>{inv.interest_score}<span style={{ fontSize: 14, color: C.muted, fontWeight: 400 }}>/100</span></span>
            </div>
            <div style={{ ...SS.bar, height: 6 }}>
              <div style={{
                height: '100%', borderRadius: 999,
                width: `${inv.interest_score}%`,
                background: inv.interest_score >= 70
                  ? 'linear-gradient(90deg, #6CD6C2, #1A8F7A)'
                  : inv.interest_score >= 40 ? '#E8A838' : '#a3a3a3',
              }} />
            </div>
          </div>
        )}

        {/* Timeline tracking */}
        <h3 style={SS.h3}>Timeline</h3>
        <div style={{ ...SS.card, marginBottom: 24 }}>
          <DrawerRow label="Enviada" value={`${fmtDate(inv.enviada_at)} · ${fmtRel(inv.enviada_at)}`} />
          {inv.vista_at && <DrawerRow label="Vista por primera vez" value={`${fmtDate(inv.vista_at)} · ${fmtRel(inv.vista_at)}`} />}
          {inv.ultima_actividad && <DrawerRow label="Última actividad" value={fmtRel(inv.ultima_actividad)} />}
          <DrawerRow label="Visitas totales" value={String(inv.visitas)} />
          <DrawerRow label="Tiempo total" value={`${Math.round((inv.tiempo_total_seg || 0) / 60)} min`} />
        </div>

        {/* Secciones vistas */}
        {inv.secciones_vistas && inv.secciones_vistas.length > 0 && (
          <>
            <h3 style={SS.h3}>Secciones que vio</h3>
            <div style={{ ...SS.card, marginBottom: 24, display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
              {inv.secciones_vistas.map((s: string) => (
                <span key={s} style={{
                  padding: '6px 12px', background: 'rgba(75,123,229,0.10)', color: C.accent,
                  fontSize: 12, fontWeight: 500, borderRadius: 999, letterSpacing: '-0.005em',
                }}>{s}</span>
              ))}
            </div>
          </>
        )}

        {(inv as any).decline_reason && (
          <>
            <h3 style={SS.h3}>Motivo del rechazo</h3>
            <div style={{ ...SS.card, marginBottom: 24, fontSize: 14, color: C.textSoft, lineHeight: 1.6 }}>
              "{(inv as any).decline_reason}"
            </div>
          </>
        )}

        {/* Actions */}
        {(inv.estado === 'sent' || inv.estado === 'viewed') && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
            <button style={SS.btn} onClick={() => alert('Reenviada (demo)')}>Reenviar email</button>
            <button style={SS.btnGhost} onClick={() => alert('Link copiado (demo)')}>Copiar link</button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Drawer: crear nueva invitación ────────────────────────
function InviteDrawer({ myInviteLink, onClose }: { myInviteLink: string; onClose: () => void }) {
  const [step, setStep] = useState<'form' | 'sent'>('form');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [tipo, setTipo] = useState('embajador');
  const [mensaje, setMensaje] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!nombre.trim() || !email.trim()) {
      alert('Nombre y email son requeridos');
      return;
    }
    setSubmitting(true);
    // En demo: simular envío
    setTimeout(() => {
      setSubmitting(false);
      setStep('sent');
    }, 800);
  }

  return (
    <>
      <div style={SS.drawerBackdrop} onClick={onClose} />
      <div style={SS.drawer}>
        <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 8 }}>
          <Icon.Close size={20} />
        </button>

        {step === 'form' ? (
          <>
            <h2 style={SS.h1Small}>Invitar partner</h2>
            <p style={SS.leadSm}>SACS revisa cada invitación y aprueba en menos de 48h hábiles. Tú recibes el 10% de cada venta que generen, mes con mes.</p>

            <Field label="Nombre completo">
              <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} placeholder="Ej. Lucía Torres" />
            </Field>

            <Field label="Email">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="lucia@ejemplo.mx" />
            </Field>

            <Field label="Empresa (opcional)">
              <input value={empresa} onChange={e => setEmpresa(e.target.value)} style={inputStyle} placeholder="Torres Consulting" />
            </Field>

            <Field label="Tipo de partner">
              <select value={tipo} onChange={e => setTipo(e.target.value)} style={inputStyle}>
                <option value="embajador">Embajador</option>
                <option value="distribuidor">Distribuidor autorizado</option>
                <option value="integrador">Integrador certificado</option>
                <option value="reseller">Reseller</option>
                <option value="consultor">Consultor partner</option>
              </select>
            </Field>

            <Field label="Mensaje personal (opcional)">
              <textarea rows={3} value={mensaje} onChange={e => setMensaje(e.target.value)} style={{ ...inputStyle, resize: 'vertical' as const }} placeholder="Hola Lucía, te recomiendo SACS porque..." />
            </Field>

            <div style={{ ...SS.note, marginTop: 14, marginBottom: 18, fontSize: 12 }}>
              SACS te valida la invitación, prepara los documentos legales y le manda el email con los datos. Si acepta, queda en tu red automáticamente.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={submit} disabled={submitting} style={{ ...SS.btn, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Enviando…' : 'Enviar invitación'}
              </button>
              <button onClick={onClose} style={SS.btnGhost}>Cancelar</button>
            </div>

            <h3 style={{ ...SS.h3, marginTop: 32 }}>O comparte tu link directo</h3>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 14 }}>
              Cualquier persona que use este link y SACS le acepte la solicitud, queda automáticamente bajo tu red:
            </p>
            <div style={{
              padding: '14px 16px', background: C.brandSoft, color: C.brandDark,
              fontFamily: 'SF Mono, Courier New, monospace', fontSize: 13,
              borderRadius: 10, wordBreak: 'break-all' as const,
              marginBottom: 12,
              border: `1px solid ${C.brandTint}`,
            }}>
              {myInviteLink}
            </div>
            <button onClick={() => copyToClipboard(myInviteLink).then(ok => ok && alert('Link copiado'))}
              style={SS.btnGhost}>
              <Icon.Copy size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Copiar link
            </button>
          </>
        ) : (
          <>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 54, height: 54, borderRadius: '50%',
              background: 'rgba(42,181,160,0.12)', color: C.greenDark,
              marginBottom: 18,
            }}>
              <Icon.CheckCircle size={26} />
            </div>
            <h2 style={SS.h1Small}>Invitación enviada</h2>
            <p style={SS.leadSm}>Le mandamos a <strong style={{ color: C.text }}>{nombre}</strong> el email con todos los detalles. SACS aprobará en menos de 48h y aparecerá en tu lista de invitaciones aquí.</p>

            <div style={{ ...SS.note, marginTop: 8 }}>
              Te avisaremos por email cuando: <br />
              · La vea por primera vez <br />
              · Acepte o rechace <br />
              · Quede oficialmente en tu red
            </div>

            <div style={{ marginTop: 24 }}>
              <button onClick={onClose} style={SS.btn}>Cerrar</button>
            </div>
          </>
        )}
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
