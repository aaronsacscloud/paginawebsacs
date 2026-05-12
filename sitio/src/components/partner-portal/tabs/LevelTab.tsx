import { useEffect, useState } from 'react';
import { fmt, fmtDate, fmtNum, isDemoMode, apiGet } from './utils';
import { SS, C } from './styles';
import { Icon } from './icons';
import { demoContent, demoCertifications, demoProfile, demoLevel, demoSacsAccount, demoLeads } from '../../../data/partner-portal-demo';

type LevelInfo = { current: number; nombre: string };

export default function LevelTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [content, setContent] = useState<any>(null);
  const [certifs, setCertifs] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [leads, setLeads] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [levelModalId, setLevelModalId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet('/api/partner-portal/content', isDemoMode() ? demoContent : undefined),
      apiGet<{ certifications: any[] }>('/api/partner-portal/certifications', isDemoMode() ? { certifications: DEMO_CERT_LIST } : undefined),
      apiGet('/api/partner-portal/profile', isDemoMode() ? demoProfile : undefined),
      apiGet('/api/partner-portal/leads', isDemoMode() ? demoLeads : undefined),
    ]).then(([c, cert, p, l]) => {
      setContent(c); setCertifs(cert); setProfile(p); setLeads(l); setLoading(false);
    });
  }, []);

  if (loading) return <div style={SS.loading}>Cargando tu nivel…</div>;

  // Calcula nivel actual
  const certifsList = certifs?.certifications || [];
  const certsOwned = certifsList.filter((c: any) => c.status === 'paid').length;
  const ventasCerradas = (leads?.deals || []).filter((d: any) => d.stage === 'won').length;
  const level = computeLevel(certsOwned, ventasCerradas);

  const summary = content?.summary || {};
  const puntos = summary.puntos_mes ?? 0;
  const meta = summary.meta ?? 100;
  const progresoPct = summary.progreso_pct ?? 0;
  const diasRest = summary.days_remaining ?? 0;
  const statusLevel = summary.status_level || 'active';
  const consecutiveFailed = summary.consecutive_failed_months ?? 0;

  const invitation = profile?.invitation;
  const signedAt = profile?.signed_at;
  const tipoLabel = invitation?.tipo ? capitalize(invitation.tipo) + ' SACS' : 'Partner SACS';

  return (
    <div>
      <h1 style={SS.h1Small}>Mi nivel</h1>
      <p style={SS.leadSm}>Dónde estás, cómo subes, y todo lo que necesitas para mantenerte activo.</p>

      {/* Hero · tu nivel actual */}
      <div style={{ ...SS.cardLg, background: level.current >= 3 ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d44 100%)' : C.card, color: level.current >= 3 ? '#fff' : C.text, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <span style={{ fontSize: 11, color: level.current >= 3 ? '#C8A55B' : C.muted, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Tu nivel actual</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500, margin: '10px 0 6px', letterSpacing: '-0.025em', color: 'inherit' }}>
              Lvl {level.current} · {level.nombre}
            </h2>
            <p style={{ fontSize: 14, color: level.current >= 3 ? 'rgba(255,255,255,0.7)' : C.muted, margin: 0, lineHeight: 1.55 }}>
              {level.nextDescription}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: level.current >= 3 ? 'rgba(255,255,255,0.55)' : C.muted, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Comisión actual</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500, color: 'inherit', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {level.commission}%
            </div>
            <div style={{ fontSize: 12, color: level.current >= 3 ? 'rgba(255,255,255,0.55)' : C.muted, marginTop: 4 }}>sobre cada venta directa</div>
          </div>
        </div>
      </div>

      {/* Tracker horizontal · single row · clickeable */}
      <div style={{ ...SS.card, marginBottom: 24, padding: '28px 32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
          {LEVELS.map((lv, idx) => {
            const isActive = lv.id === level.current;
            const isPast = lv.id < level.current;
            const isReached = isPast || isActive;
            const accent = lv.id >= 3 ? C.gold : C.green;
            return (
              <button
                key={lv.id}
                onClick={() => setLevelModalId(lv.id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
                  position: 'relative' as const, background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: '4px 4px 8px', fontFamily: 'inherit', borderRadius: 10,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.bg}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                {/* connector line to next */}
                {idx < LEVELS.length - 1 && (
                  <div style={{
                    position: 'absolute' as const, top: 20, left: '50%', right: '-50%',
                    height: 2, background: isPast ? accent : C.border, zIndex: 0,
                  }} />
                )}
                {/* dot */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: isReached ? accent : '#fff',
                  border: isReached ? `2px solid ${accent}` : `2px solid ${C.border}`,
                  color: isReached ? '#fff' : C.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, position: 'relative' as const, zIndex: 1,
                  boxShadow: isActive ? `0 0 0 6px ${accent}1a` : 'none',
                }}>
                  {isPast ? '✓' : lv.id}
                </div>
                <div style={{ marginTop: 12, textAlign: 'center' as const, padding: '0 4px' }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 4 }}>LVL {lv.id}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isReached ? C.text : C.muted, lineHeight: 1.3, marginBottom: 4 }}>{lv.nombre}</div>
                  {isActive ? (
                    <div style={{ fontSize: 11, color: accent, fontWeight: 600 }}>Estás aquí</div>
                  ) : (
                    <div style={{ fontSize: 10, color: C.muted, fontWeight: 500 }}>Ver detalle →</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compromisos del mes */}
      <h2 style={SS.h2}>Compromisos del mes</h2>

      {statusLevel === 'warning' && (
        <div style={{ padding: '16px 22px', background: 'rgba(232,168,56,0.10)', border: `1px solid rgba(232,168,56,0.30)`, borderLeft: `4px solid ${C.amber}`, borderRadius: 10, marginBottom: 18, fontSize: 13, color: '#7a5b1f', lineHeight: 1.5 }}>
          <strong>1er strike.</strong> No alcanzaste la meta el mes pasado. Ponte al día este mes para limpiar tu historial.
        </div>
      )}
      {statusLevel === 'final_warning' && (
        <div style={{ padding: '16px 22px', background: 'rgba(220,38,38,0.06)', border: `1px solid rgba(220,38,38,0.25)`, borderLeft: `4px solid ${C.red}`, borderRadius: 10, marginBottom: 18, fontSize: 13, color: '#8a1f1f', lineHeight: 1.5 }}>
          <strong>Aviso final.</strong> Llevas {consecutiveFailed} meses consecutivos sin meta. Un strike más activa la suspensión automática.
        </div>
      )}

      <div style={SS.cardLg}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500, color: C.text, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {puntos} <span style={{ fontSize: 18, color: C.muted, fontWeight: 400 }}>/ {meta} pts</span>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>
              {diasRest > 0 ? `${diasRest} días restantes del mes` : 'Cierre del mes'}
            </div>
          </div>
        </div>
        <div style={{ ...SS.bar, height: 12 }}>
          <div style={{ ...SS.barFill, width: `${Math.min(100, progresoPct)}%` }} />
        </div>
        {puntos >= meta ? (
          <div style={{ marginTop: 18, padding: '12px 18px', background: 'rgba(42,181,160,0.08)', borderRadius: 10, fontSize: 13, color: C.greenDark, lineHeight: 1.5 }}>
            ✓ <strong>Meta cumplida.</strong> Excelente — ya tienes asegurado tu nivel para el próximo mes.
          </div>
        ) : (
          <div style={{ marginTop: 18, padding: '12px 18px', background: C.bg, borderRadius: 10, fontSize: 13, color: C.textSoft, lineHeight: 1.5 }}>
            Te faltan <strong style={{ color: C.text }}>{Math.max(0, meta - puntos)} pts</strong>. Reporta una actividad y se acreditará en 24-48h.
          </div>
        )}

        {/* 2 botones grandes · visuales */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 22 }}>
          <button onClick={() => setCatalogOpen(true)}
            style={{
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: '20px 22px', textAlign: 'left' as const, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 16,
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 18px -10px rgba(0,0,0,0.12)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = 'none'; }}>
            <span style={{
              flexShrink: 0, width: 44, height: 44, borderRadius: 12,
              background: 'rgba(75,123,229,0.12)', color: C.accent,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon.Book size={22} /></span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>Ver catálogo de tareas</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.4 }}>Explora los 30+ tipos con puntos e ideas</div>
            </div>
          </button>
          <button onClick={() => setReportOpen(true)}
            style={{
              background: C.text, color: '#fff', border: 'none', borderRadius: 12,
              padding: '20px 22px', textAlign: 'left' as const, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 16,
              transition: 'transform 0.12s, box-shadow 0.12s',
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 18px -10px rgba(0,0,0,0.25)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = 'none'; }}>
            <span style={{
              flexShrink: 0, width: 44, height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,0.14)', color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon.Plus size={22} strokeWidth={2} /></span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Reportar actividad</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>Pega el link de lo que hiciste</div>
            </div>
          </button>
        </div>

        {/* Actividades reportadas */}
        {(content?.items?.length || 0) > 0 && (
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Reportadas este mes</div>
            {(content.items || []).slice(0, 5).map((it: any) => (
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.borderSoft}`, gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{it.tipo}{it.plataforma ? ` · ${it.plataforma}` : ''}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.url}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: it.estado === 'approved' ? C.green : it.estado === 'rejected' ? C.red : C.amber }}>
                    {it.estado === 'approved' ? `+${it.puntos} pts` : it.estado === 'rejected' ? 'Rechazado' : 'En revisión'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Certificaciones · resumen + link a la tab dedicada */}
      <h2 style={SS.h2}>Certificaciones · sube a Lvl 2</h2>
      <button
        onClick={() => { window.location.hash = 'certs'; }}
        style={{ ...SS.cardLg, width: '100%', textAlign: 'left' as const, cursor: 'pointer', fontFamily: 'inherit', display: 'block', border: `1px solid ${C.border}`, background: C.card }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px -16px rgba(0,0,0,0.18)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' as const, marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <span style={{ fontSize: 11, color: certsOwned > 0 ? C.greenDark : C.muted, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>
              {certsOwned > 0 ? `${certsOwned} ${certsOwned === 1 ? 'activa' : 'activas'}` : 'Sin certificaciones aún'}
            </span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: C.text, marginTop: 8, lineHeight: 1.25, letterSpacing: '-0.018em' }}>
              5 certificaciones disponibles
            </div>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.55, margin: '6px 0 0', maxWidth: 520 }}>
              Cobras implementaciones, migraciones y consultorías de $5,000 a $60,000. Te quedas con el 100%.
              SACS solo cobra una vez la certificación.
            </p>
          </div>
          <span style={{ ...SS.btn, fontSize: 13, padding: '12px 20px', whiteSpace: 'nowrap' as const, pointerEvents: 'none' as const }}>
            Ver catálogo →
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, paddingTop: 16, borderTop: `1px solid ${C.borderSoft}` }}>
          {certifsList.slice(0, 5).map((c: any) => (
            <span key={c.id} style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 600,
              background: c.unlocked ? 'rgba(42,181,160,0.12)' : C.bg,
              color: c.unlocked ? C.greenDark : C.muted,
              borderRadius: 8,
            }}>
              {c.unlocked && '✓ '}{c.shortName || c.nombre}
            </span>
          ))}
        </div>
      </button>

      {/* Mi acuerdo */}
      <h2 style={SS.h2}>Mi acuerdo</h2>
      <div style={SS.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 0 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Programa</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: C.text }}>{tipoLabel}</div>
            {signedAt && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Firmado el {fmtDate(signedAt)}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={SS.btnGhost} onClick={() => setContractOpen(true)}>Ver compromisos</button>
            {invitation?.id && (
              <a href={`/partners/contrato/${invitation.id}`} target="_blank" rel="noopener" style={{ ...SS.btnGhost, textDecoration: 'none', display: 'inline-block' }}>Ver contrato firmado →</a>
            )}
          </div>
        </div>
      </div>

      {/* Drawer: Compromisos completos */}
      {contractOpen && <ContractDrawer onClose={() => setContractOpen(false)} tipo={invitation?.tipo} />}

      {/* Modal: detalle de un nivel */}
      {levelModalId !== null && <LevelDetailModal lvId={levelModalId} currentLevel={level.current} onClose={() => setLevelModalId(null)} />}

      {/* Drawer: catálogo visual de tareas */}
      {catalogOpen && <CatalogDrawer tipos={content?.tipos || []} onClose={() => setCatalogOpen(false)} onPick={(tipoId) => { setCatalogOpen(false); setReportOpen(true); setTimeout(() => { const ev = new CustomEvent('preset-tipo', { detail: tipoId }); window.dispatchEvent(ev); }, 100); }} />}

      {/* Drawer: reportar actividad (con catálogo visual integrado) */}
      {reportOpen && <ReportDrawer tipos={content?.tipos || []} onClose={() => setReportOpen(false)} onSubmitted={() => { setReportOpen(false); window.location.reload(); }} />}
    </div>
  );
}

// ─── Niveles ───
const LEVELS = [
  { id: 1, nombre: 'Partner Referidor',     requirement: 'Ya iniciaste — vendes vía tu link',     commission: 50 },
  { id: 2, nombre: 'Partner Certificado',   requirement: 'Completa 1 certificación oficial',      commission: 50 },
  { id: 3, nombre: 'Master Partner',        requirement: '5 sucursales activas en tu red',         commission: 50 },
  { id: 4, nombre: 'Founder Circle',        requirement: 'Sostén Master Partner Nv 4 por 12 meses', commission: 50 },
];

function computeLevel(certsOwned: number, ventasCerradas: number): LevelInfo & { commission: number; nextDescription: string } {
  if (isDemoMode()) {
    return {
      current: demoLevel.current,
      nombre: demoLevel.nombre,
      commission: 50,
      nextDescription: `→ Lvl 2 al completar 1 certificación · → Lvl 3 al cerrar 5 sucursales (llevas ${demoLevel.sucursales_activas}/5)`,
    };
  }
  if (ventasCerradas >= 10) {
    return { current: 3, nombre: 'Master Partner Nv 1', commission: 50, nextDescription: 'Sigue creciendo tu red — al sostener Master Partner Nv 4 por 12 meses, entras a Founder Circle.' };
  }
  if (certsOwned >= 1) {
    return { current: 2, nombre: 'Partner Certificado', commission: 50, nextDescription: `→ Lvl 3 al cerrar 5 sucursales (llevas ${ventasCerradas}/5)` };
  }
  return { current: 1, nombre: 'Partner Referidor', commission: 50, nextDescription: certsOwned === 0 ? '→ Lvl 2 al completar 1 certificación · → Lvl 3 al cerrar 5 sucursales' : '' };
}

// ─── Helpers ───
function capitalize(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function stagePill(color: string) { return { display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: '#fff', background: color, letterSpacing: '0.04em' }; }

async function buyCert(certId: string) {
  try {
    const r = await fetch('/api/partner-portal/certifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cert_id: certId }),
    });
    const d = await r.json();
    if (d.url) window.location.href = d.url;
    else alert(d.error || 'No se pudo iniciar la compra');
  } catch (e) {
    alert('Error iniciando la compra');
  }
}

// ─── Sub-componentes ───
function SacsAccountCard() {
  // En real: detecta cuenta_sacs_id en partner_invitations.notas.meta o team_members
  // Por ahora muestra estado motivacional + link
  const active = isDemoMode();
  return (
    <div style={{ ...SS.cardDark, background: active ? 'linear-gradient(135deg, #1A8F7A 0%, #4B7BE5 100%)' : 'linear-gradient(135deg, #1a1a1a 0%, #2d2d44 100%)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Tu cuenta para operar</span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginTop: 8, marginBottom: 6, color: '#fff' }}>
            {active ? 'Plan Fideliza · Activa' : 'Plan Fideliza · pendiente de activar'}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55 }}>
            {active
              ? 'Tu cuenta gratis está al corriente. Úsala para operar tu propio retail y mostrarlo en demos.'
              : 'Te activamos una cuenta SACS Plan Fideliza gratuita para que la uses con tu propio negocio. Llega en 48h hábiles.'}
          </div>
        </div>
        {active && (
          <a href="https://app.sacscloud.com" target="_blank" rel="noopener" style={{ ...SS.btnDark, textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap' }}>
            Entrar a SACS →
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Modal: detalle de un nivel ───
function LevelDetailModal({ lvId, currentLevel, onClose }: { lvId: number; currentLevel: number; onClose: () => void }) {
  const lv = LEVELS.find(l => l.id === lvId);
  if (!lv) return null;
  const isActive = lvId === currentLevel;
  const isPast = lvId < currentLevel;
  const accent = lvId >= 3 ? C.gold : C.green;

  const details = LEVEL_DETAILS[lvId];

  return (
    <>
      <div style={SS.drawerBackdrop} onClick={onClose} />
      <div style={SS.drawer}>
        <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 22, color: C.muted, padding: 8 }}>×</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <span style={{
            width: 48, height: 48, borderRadius: '50%',
            background: isPast || isActive ? accent : '#fff',
            border: isPast || isActive ? `2px solid ${accent}` : `2px solid ${C.border}`,
            color: isPast || isActive ? '#fff' : C.muted,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
          }}>{isPast ? '✓' : lv.id}</span>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>LVL {lv.id}</div>
            <h2 style={{ ...SS.h1Small, margin: '2px 0 0' }}>{lv.nombre}</h2>
          </div>
        </div>

        {isActive && (
          <div style={{ display: 'inline-block', padding: '6px 14px', background: `${accent}1a`, color: accent, borderRadius: 999, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 18 }}>
            ✓ Estás aquí
          </div>
        )}

        <p style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.6, margin: '0 0 24px' }}>{details.descripcion}</p>

        {/* Cómo se activa */}
        <h3 style={SS.h3}>Cómo se {isActive ? 'mantiene' : 'activa'}</h3>
        <ul style={{ listStyle: 'none' as const, padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {details.requisitos.map((r, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{
                flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(42,181,160,0.12)', color: C.greenDark,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12,
              }}>{i + 1}</span>
              <span style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.55 }}>{r}</span>
            </li>
          ))}
        </ul>

        {/* Beneficios */}
        <h3 style={SS.h3}>Lo que ganas</h3>
        <ul style={{ listStyle: 'none' as const, padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {details.beneficios.map((b, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ flexShrink: 0, color: accent, fontWeight: 700, fontSize: 14 }}>✓</span>
              <span style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.55 }}>{b}</span>
            </li>
          ))}
        </ul>

        {/* Auto-reconocimiento */}
        <div style={{ padding: '16px 20px', background: 'rgba(75,123,229,0.06)', borderRadius: 10, fontSize: 13, color: C.textSoft, lineHeight: 1.6, marginTop: 8 }}>
          <strong style={{ color: C.text }}>⚙️ Activación automática.</strong> El portal te reconoce y te sube de nivel solo — no necesitas pedirlo. Cuando cumples los requisitos, tu Lvl {lv.id} se activa en el próximo ciclo (típicamente 24-48h).
        </div>
      </div>
    </>
  );
}

const LEVEL_DETAILS: Record<number, { descripcion: string; requisitos: string[]; beneficios: string[] }> = {
  1: {
    descripcion: 'Tu punto de entrada al programa. Ya tienes tu link único activo y puedes empezar a generar comisiones desde el primer cliente que firme.',
    requisitos: [
      'Tu invitación está aceptada y firmada',
      'Tu link único está activo en sacscloud.com/p/[tu-slug]',
      'Mantén 100 pts/mes de actividad reportada',
    ],
    beneficios: [
      'Comisión 50% sobre cada venta directa',
      'Plan Fideliza activo en tu cuenta SACS · gratis',
      'Acceso al brand kit oficial + plantillas listas',
      'Tu link con cookie de atribución de 90 días',
    ],
  },
  2: {
    descripcion: 'El siguiente nivel desbloquea cobro de servicios profesionales. Implementaciones, migraciones, automatizaciones con IA — el cliente te paga directo y te quedas con el 100%.',
    requisitos: [
      'Completar al menos 1 certificación oficial (desde $7,500)',
      'Aprobar el examen final de la cert',
      'Mantener 100 pts/mes de actividad',
    ],
    beneficios: [
      'Cobras servicios profesionales de $5,000 a $60,000+ por proyecto',
      'Te quedas con el 100% del cobro de servicios — SACS solo cobra la cert una vez',
      'Badge "Partner Certificado" visible en tu portal',
      'Acceso a comunidad privada de partners certificados',
      'Sigues con tu 50% de comisión sobre venta directa',
    ],
  },
  3: {
    descripcion: 'Empiezas a construir tu propia red de partners. Cobras override del 10% sobre todas las ventas que generen los partners que tú trajiste — ingreso recurrente sin tope.',
    requisitos: [
      '5 sucursales activas pagando en tu red (directas o de tus partners)',
      'Al menos 1 certificación oficial activa',
      'Mantener 100 pts/mes de actividad',
    ],
    beneficios: [
      'Override del 10% sobre cada venta de partners en tu red',
      '4 sub-niveles (Nv 1-4) que escalan con el tamaño de tu red',
      'Badge "Master Partner Nv X" + visibilidad en directorio',
      'Acceso prioritario a leads enterprise pre-calificados de SACS',
      'Sigues con 50% comisión directa + servicios al 100%',
    ],
  },
  4: {
    descripcion: 'El círculo más alto del programa. Reservado para partners que sostienen Master Partner Nv 4 por 12 meses consecutivos — los socios estratégicos a largo plazo.',
    requisitos: [
      'Sostener Master Partner Nv 4 por 12 meses consecutivos',
      'Mantener red de 40+ sucursales activas',
      'Mantener 100 pts/mes de actividad',
    ],
    beneficios: [
      'Override del 12% sobre todas las ventas de tu red',
      'Invitación al Founder Circle anual (evento presencial)',
      'Participación en roadmap de producto y feature requests prioritarios',
      'Co-marketing pagado por SACS (campañas conjuntas)',
      'Badge "Founder Circle" + reconocimiento público',
    ],
  },
};

// ─── Drawer: Catálogo visual de tareas ───
function CatalogDrawer({ tipos, onClose, onPick }: { tipos: any[]; onClose: () => void; onPick: (tipoId: string) => void }) {
  const [filter, setFilter] = useState<'todos' | 'contenido' | 'apoyo' | 'filantropia'>('todos');
  const filtered = tipos.filter(t => filter === 'todos' || (t.categoria || 'contenido') === filter);

  return (
    <>
      <div style={SS.drawerBackdrop} onClick={onClose} />
      <div style={{ ...SS.drawer, width: 'min(720px, 100vw)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 22, color: C.muted, padding: 8 }}>×</button>
        <h2 style={SS.h1Small}>Catálogo de tareas</h2>
        <p style={SS.leadSm}>30+ tipos de actividad que suman puntos. Click en cualquiera para reportar tu evidencia.</p>

        {/* Filtros */}
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 22 }}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'contenido', label: 'Contenido' },
            { id: 'apoyo', label: 'Apoyo a la marca' },
            { id: 'filantropia', label: 'Filantropía' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id as any)}
              style={{
                padding: '8px 14px', border: `1px solid ${C.border}`, borderRadius: 999,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: filter === f.id ? C.text : '#fff',
                color: filter === f.id ? '#fff' : C.text,
              }}>{f.label}</button>
          ))}
        </div>

        {/* Grid visual */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {filtered.map(t => (
            <button key={t.id} onClick={() => onPick(t.id)}
              style={{
                background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12,
                overflow: 'hidden' as const, cursor: 'pointer', fontFamily: 'inherit',
                textAlign: 'left' as const, padding: 0, display: 'flex', flexDirection: 'column' as const,
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 18px -10px rgba(0,0,0,0.12)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = 'none'; }}>
              {t.ejemploImage && (
                <div style={{ aspectRatio: '4 / 3', background: '#1a1a1a', overflow: 'hidden' as const, position: 'relative' as const }}>
                  <img src={t.ejemploImage} alt={t.nombre} loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }} />
                  <div style={{ position: 'absolute' as const, top: 8, right: 8, padding: '4px 8px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', borderRadius: 6 }}>
                    +{t.puntos} pts
                  </div>
                </div>
              )}
              <div style={{ padding: '12px 14px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3, marginBottom: 4 }}>{t.nombre}</div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{t.duracion} · {t.esfuerzo}</div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ ...SS.note, marginTop: 24 }}>
          <strong>Click en cualquier tarjeta</strong> para abrir el formulario de reporte con ese tipo pre-seleccionado.
        </div>
      </div>
    </>
  );
}

function ContractDrawer({ onClose, tipo }: { onClose: () => void; tipo?: string }) {
  return (
    <>
      <div style={SS.drawerBackdrop} onClick={onClose} />
      <div style={SS.drawer}>
        <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 22, color: C.muted, padding: 8 }}>×</button>
        <h2 style={SS.h1Small}>Tus compromisos</h2>
        <p style={SS.leadSm}>Resumen de las 19 cláusulas que firmaste. Para el contrato completo, descárgalo desde tu acuerdo.</p>

        <ContractItem n="1" title="Meta mínima mensual">100 pts/mes de actividad documentada (contenido, demos, apoyo a la marca).</ContractItem>
        <ContractItem n="2" title="3-strike system">3 meses consecutivos sin meta → suspensión automática.</ContractItem>
        <ContractItem n="3" title="Meta anual">10 sucursales nuevas activadas por año.</ContractItem>
        <ContractItem n="4" title="Vigencia">12 meses desde firma · renovación automática.</ContractItem>
        <ContractItem n="5" title="Comisiones">50% sobre venta directa · 10% override Master Partner.</ContractItem>
        <ContractItem n="6" title="Pagos">Día 1 del mes · CFDI 1-3 días antes · transferencia/PayPal/Mercado Pago.</ContractItem>
        <ContractItem n="7" title="Filantropía como ruta alterna">Acciones filantrópicas validadas pueden contar como compromisos.</ContractItem>
        <ContractItem n="8" title="Uso de marca">Solo en el contexto autorizado. No prometas funciones que SACS no tiene.</ContractItem>
        <ContractItem n="9" title="Contenido prohibido">Nada ofensivo, discriminatorio, ilegal o que dañe la marca.</ContractItem>
        <ContractItem n="10" title="Confidencialidad">Datos de clientes y de SACS son confidenciales.</ContractItem>
        <ContractItem n="11" title="No competencia">No promover plataformas competidoras durante la vigencia.</ContractItem>
        <ContractItem n="12" title="Cancelación">Cualquiera de las partes puede cancelar con 30 días de aviso.</ContractItem>
      </div>
    </>
  );
}

function ContractItem({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 16, padding: '14px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: C.muted, paddingTop: 2 }}>{n}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.55 }}>{children}</div>
      </div>
    </div>
  );
}

function ReportDrawer({ tipos, onClose, onSubmitted }: { tipos: any[]; onClose: () => void; onSubmitted: () => void }) {
  const [url, setUrl] = useState('');
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [plataforma, setPlataforma] = useState('instagram');
  const [descripcion, setDescripcion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [categoryFilter, setCategoryFilter] = useState<'todos' | 'contenido' | 'apoyo' | 'filantropia'>('todos');

  useEffect(() => {
    const onPreset = (e: any) => {
      const tipoId = e?.detail;
      if (tipoId) {
        setTipoId(tipoId);
        setStep('form');
      }
    };
    window.addEventListener('preset-tipo', onPreset);
    return () => window.removeEventListener('preset-tipo', onPreset);
  }, []);

  const tipoSeleccionado = tipos.find(t => t.id === tipoId);

  async function submit() {
    if (!url.trim()) { setError('URL requerida'); return; }
    if (!tipoId) { setError('Selecciona un tipo'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/partner-portal/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, tipo: tipoId, plataforma, descripcion }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); setSubmitting(false); return; }
      onSubmitted();
    } catch (e: any) {
      setError(e?.message || 'Error');
      setSubmitting(false);
    }
  }

  const filteredTipos = tipos.filter(t => categoryFilter === 'todos' || (t.categoria || 'contenido') === categoryFilter);

  return (
    <>
      <div style={SS.drawerBackdrop} onClick={onClose} />
      <div style={{ ...SS.drawer, width: 'min(720px, 100vw)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 22, color: C.muted, padding: 8 }}>×</button>

        {step === 'pick' && (
          <>
            <h2 style={SS.h1Small}>Reportar actividad</h2>
            <p style={SS.leadSm}>Elige primero qué tipo de actividad realizaste. Luego pegas la URL como evidencia.</p>

            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 22 }}>
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'contenido', label: 'Contenido' },
                { id: 'apoyo', label: 'Apoyo a la marca' },
                { id: 'filantropia', label: 'Filantropía' },
              ].map(f => (
                <button key={f.id} onClick={() => setCategoryFilter(f.id as any)}
                  style={{
                    padding: '8px 14px', border: `1px solid ${C.border}`, borderRadius: 999,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    background: categoryFilter === f.id ? C.text : '#fff',
                    color: categoryFilter === f.id ? '#fff' : C.text,
                  }}>{f.label}</button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {filteredTipos.map(t => (
                <button key={t.id} onClick={() => { setTipoId(t.id); setStep('form'); }}
                  style={{
                    background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12,
                    overflow: 'hidden' as const, cursor: 'pointer', fontFamily: 'inherit',
                    textAlign: 'left' as const, padding: 0, display: 'flex', flexDirection: 'column' as const,
                    transition: 'transform 0.12s, box-shadow 0.12s',
                  }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 8px 18px -10px rgba(0,0,0,0.12)'; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = 'none'; }}>
                  {t.ejemploImage && (
                    <div style={{ aspectRatio: '4 / 3', background: '#1a1a1a', overflow: 'hidden' as const, position: 'relative' as const }}>
                      <img src={t.ejemploImage} alt={t.nombre} loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }} />
                      <div style={{ position: 'absolute' as const, top: 8, right: 8, padding: '4px 8px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', borderRadius: 6 }}>
                        +{t.puntos} pts
                      </div>
                    </div>
                  )}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{t.nombre}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'form' && tipoSeleccionado && (
          <>
            <button onClick={() => { setStep('pick'); setTipoId(null); }}
              style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 13, cursor: 'pointer', padding: '4px 0', marginBottom: 14, fontFamily: 'inherit' }}>
              ← Cambiar tipo
            </button>

            <h2 style={SS.h1Small}>{tipoSeleccionado.nombre}</h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const }}>
              <span style={{ display: 'inline-block', padding: '4px 10px', background: 'rgba(42,181,160,0.12)', color: C.greenDark, fontSize: 12, fontWeight: 700, borderRadius: 999, letterSpacing: '0.04em' }}>
                +{tipoSeleccionado.puntos} pts
              </span>
              <span style={{ fontSize: 12, color: C.muted }}>{tipoSeleccionado.duracion} · {tipoSeleccionado.esfuerzo}</span>
            </div>

            {tipoSeleccionado.ejemploImage && (
              <img src={tipoSeleccionado.ejemploImage} alt={tipoSeleccionado.nombre}
                style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' as const, borderRadius: 10, marginBottom: 14 }} />
            )}

            {tipoSeleccionado.descripcion && (
              <p style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.6, margin: '0 0 22px' }}>{tipoSeleccionado.descripcion}</p>
            )}

            {error && <div style={{ padding: '12px 18px', background: 'rgba(220,38,38,0.06)', border: `1px solid rgba(220,38,38,0.25)`, borderRadius: 10, fontSize: 13, color: C.red, marginBottom: 16 }}>{error}</div>}

            <Field label="URL del contenido / evidencia">
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://instagram.com/reel/..." style={inputStyle} />
            </Field>

            {(tipoSeleccionado.plataformasSugeridas || []).length > 0 && (
              <Field label="Plataforma">
                <select value={plataforma} onChange={e => setPlataforma(e.target.value)} style={inputStyle}>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="twitter">X / Twitter</option>
                  <option value="spotify">Spotify</option>
                  <option value="otro">Otro</option>
                </select>
              </Field>
            )}

            <Field label="Descripción breve (opcional)">
              <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' as const }}
                placeholder={(tipoSeleccionado.ideasContenido || [])[0] || 'Cuéntanos brevemente qué hiciste...'} />
            </Field>

            <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
              <button onClick={submit} disabled={submitting} style={{ ...SS.btn, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Enviando…' : `Enviar · +${tipoSeleccionado.puntos} pts`}
              </button>
              <button onClick={onClose} style={SS.btnGhost}>Cancelar</button>
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
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const DEMO_CERT_LIST = [
  { id: 'impl_una_sucursal', shortName: 'Implementación · 1 sucursal', precioMostrar: '$7,500', duracion: '4h', serviceChargeMostrar: '$5,000 – $12,000', serviceUnit: '/ implementación', nivel: 'Principiante', unlocked: false, status: 'none' },
  { id: 'impl_multisucursal', shortName: 'Implementación · Multi-sucursal', precioMostrar: '$14,000', duracion: '10h', serviceChargeMostrar: '$20,000 – $60,000', serviceUnit: '/ implementación', nivel: 'Intermedio', unlocked: false, status: 'none' },
  { id: 'migracion_datos', shortName: 'Migración de datos', precioMostrar: '$7,500', duracion: '6h', serviceChargeMostrar: '$8,000 – $25,000', serviceUnit: '/ migración', nivel: 'Especialización', unlocked: false, status: 'none' },
  { id: 'ia_automatizacion', shortName: 'Automatización con IA', precioMostrar: '$14,000', duracion: '12h', serviceChargeMostrar: '$15,000 – $45,000', serviceUnit: '/ proyecto', nivel: 'Avanzado', unlocked: false, status: 'none' },
  { id: 'consultor_ia', shortName: 'Consultor en IA', precioMostrar: '$21,000', duracion: '14h', serviceChargeMostrar: '$5,000 – $15,000', serviceUnit: '/ mes', nivel: 'Senior', unlocked: false, status: 'none' },
];

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
