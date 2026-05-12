// Onboarding tour interactivo · spotlight estilo Intercom/Driver.js.
// El portal demo sigue visible debajo. Overlay con hueco + tooltip flotante.
// Auto-switch de tabs cuando el step lo requiere.
// 18 pasos con explicaciones detalladas + mini-ilustraciones inline.

import { useEffect, useRef, useState } from 'react';
import { C } from './styles';
import { Icon } from './icons';

type StepBody = {
  intro?: string;
  bullets?: Array<{ icon?: string; label: string; sub?: string; color?: string }>;
  illustration?: React.ReactNode;
  outro?: string;
};

type Step = {
  tabHash: string;
  target?: string;
  emoji?: string;
  title: string | ((name: string) => string);
  desc: string | ((name: string) => string) | StepBody | ((name: string) => StepBody);
  preferPosition?: 'top' | 'bottom' | 'right' | 'left' | 'center';
};

type Rect = { top: number; left: number; width: number; height: number };

type Props = {
  user: { id: string; nombre: string; email: string };
  onComplete: () => void;
};

const PAD = 10;
const TOOLTIP_W = 340;
const TOOLTIP_GAP = 24;

export default function OnboardingTour({ user, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [ready, setReady] = useState(false);
  const [peek, setPeek] = useState(false);   // hold-to-peek: oculta tooltip temporalmente
  const tooltipRef = useRef<HTMLDivElement>(null);

  const firstName = (user.nombre || 'partner').split(' ')[0];
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const isCentered = !current.target;

  useEffect(() => {
    setReady(false);
    setRect(null);
    const currentHash = (window.location.hash || '#home').replace('#', '');
    if (currentHash !== current.tabHash) {
      window.location.hash = current.tabHash;
    }
    const t = setTimeout(() => measure(), 300);
    return () => clearTimeout(t);
  }, [step]);

  function measure() {
    if (isCentered) {
      setRect(null);
      setReady(true);
      return;
    }
    const sel = `[data-tour="${current.target}"]`;
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) {
      setRect(null);
      setReady(true);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const newRect: Rect = { top: r.top, left: r.left, width: r.width, height: r.height };
        setRect(newRect);
        setTooltipPos(calcTooltipPos(newRect, current.preferPosition));
        setReady(true);
      });
    });
  }

  useEffect(() => {
    if (!current.target) return;
    const onResize = () => {
      const el = document.querySelector(`[data-tour="${current.target}"]`) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const nr = { top: r.top, left: r.left, width: r.width, height: r.height };
      setRect(nr);
      setTooltipPos(calcTooltipPos(nr, current.preferPosition));
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [step, current.target]);

  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
      if ((e.key === 'h' || e.key === 'H') && !e.repeat) setPeek(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') setPeek(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  function next() { if (step < STEPS.length - 1) setStep(s => s + 1); }
  function prev() { if (step > 0) setStep(s => s - 1); }
  function finish() {
    try { localStorage.setItem('sacs_onboarding_done', '1'); } catch (_e) {}
    onComplete();
    if (window.location.search.includes('demo=1')) {
      window.location.href = '/partner/portal';
    } else {
      window.location.reload();
    }
  }

  const title = typeof current.title === 'function' ? current.title(firstName) : current.title;
  const descRaw = typeof current.desc === 'function' ? (current.desc as any)(firstName) : current.desc;
  const desc: StepBody = typeof descRaw === 'string' ? { intro: descRaw } : descRaw;

  return (
    <>
      {/* Overlay SVG con hueco · azul SACS tenue */}
      <svg
        className="onb-overlay"
        width="100%" height="100%"
        style={{
          position: 'fixed', inset: 0,
          width: '100vw', height: '100vh',
          pointerEvents: 'none', zIndex: 9998,
          transition: 'opacity 0.25s ease',
          opacity: peek ? 0 : 1,
        }}>
        <defs>
          <mask id="onb-cutout">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - PAD} y={rect.top - PAD}
                width={rect.width + PAD * 2} height={rect.height + PAD * 2}
                rx="12" fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Velo azul SACS tenue · el portal se ve casi al 100% */}
        <rect width="100%" height="100%" fill="rgba(75, 123, 229, 0.16)" mask="url(#onb-cutout)" />
        {rect && (
          <>
            {/* Halo expansivo · glow azul fuera del spotlight */}
            <rect
              x={rect.left - PAD} y={rect.top - PAD}
              width={rect.width + PAD * 2} height={rect.height + PAD * 2}
              rx="12" fill="none"
              stroke={C.brand} strokeWidth="3"
              style={{ filter: 'drop-shadow(0 0 0 4px rgba(75,123,229,0.25)) drop-shadow(0 0 32px rgba(75,123,229,0.55))' }}
            />
            {/* Anillo interior nítido */}
            <rect
              x={rect.left - PAD + 1} y={rect.top - PAD + 1}
              width={rect.width + PAD * 2 - 2} height={rect.height + PAD * 2 - 2}
              rx="11" fill="none"
              stroke="rgba(255,255,255,0.5)" strokeWidth="1"
            />
          </>
        )}
      </svg>

      {/* Confetti final */}
      {isLast && <Confetti />}

      {/* Tooltip card · translúcido con backdrop blur */}
      {ready && (
        <div
          ref={tooltipRef}
          className="onb-tooltip"
          style={{
            position: 'fixed',
            ...(isCentered ? {
              top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            } : {
              top: tooltipPos.top, left: tooltipPos.left,
            }),
            width: TOOLTIP_W,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            background: 'rgba(255,255,255,0.97)',
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            boxShadow: '0 24px 60px -10px rgba(0,0,0,0.20), 0 6px 16px -4px rgba(0,0,0,0.08)',
            zIndex: 9999,
            padding: '20px 22px 18px',
            animation: 'onb-pop 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            opacity: peek ? 0 : 1,
            pointerEvents: peek ? 'none' : 'auto',
            transition: 'opacity 0.18s ease',
          }}>
          {/* Top row: counter + emoji */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              padding: '4px 10px',
              background: C.brandSoft,
              color: C.brand,
              fontSize: 10, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase' as const,
              borderRadius: 999,
            }}>
              Paso {step + 1} / {STEPS.length}
            </div>
            {current.emoji && <span style={{ fontSize: 16 }}>{current.emoji}</span>}
          </div>

          {/* Title */}
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: isCentered ? 28 : 20,
            fontWeight: 600,
            color: C.text,
            margin: '0 0 12px',
            letterSpacing: '-0.020em',
            lineHeight: 1.22,
          }}>
            {title}
          </h3>

          {/* Body */}
          {desc.intro && (
            <p style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.62, margin: '0 0 14px' }}>
              {desc.intro}
            </p>
          )}

          {desc.illustration && (
            <div style={{ margin: '14px 0', display: 'flex', justifyContent: 'center' }}>
              {desc.illustration}
            </div>
          )}

          {desc.bullets && (
            <ul style={{ listStyle: 'none' as const, padding: 0, margin: '4px 0 14px', display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {desc.bullets.map((b, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{
                    flexShrink: 0,
                    width: 24, height: 24, borderRadius: '50%',
                    background: b.color ? `${b.color}1a` : C.brandSoft,
                    color: b.color || C.brand,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    marginTop: 1,
                  }}>
                    {b.icon || `${i + 1}`}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>{b.label}</div>
                    {b.sub && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>{b.sub}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {desc.outro && (
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, margin: '8px 0 14px', fontStyle: 'italic' as const }}>
              {desc.outro}
            </p>
          )}

          {/* Progress bar */}
          <div style={{ height: 3, background: C.borderSoft, borderRadius: 999, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{
              height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`,
              background: `linear-gradient(90deg, ${C.brand}, ${C.brandDark})`,
              transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              borderRadius: 999,
            }} />
          </div>

          {/* Hint hold-to-peek (no en step centrado) */}
          {!isCentered && (
            <div style={{ fontSize: 10, color: C.mutedLight, fontWeight: 500, marginBottom: 12, textAlign: 'center' as const, letterSpacing: '0.02em' }}>
              Mantén <kbd style={{ display: 'inline-block', padding: '1px 6px', background: C.borderSoft, borderRadius: 4, fontSize: 10, fontFamily: 'SF Mono, monospace', color: C.text, fontWeight: 600 }}>H</kbd> para ver mejor el portal
            </div>
          )}

          {/* Nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <button onClick={prev} disabled={isFirst}
              style={{
                padding: '8px 12px', background: 'transparent',
                color: isFirst ? C.mutedLight : C.muted,
                border: 'none', fontSize: 13, fontWeight: 600,
                cursor: isFirst ? 'default' : 'pointer', fontFamily: 'inherit',
                opacity: isFirst ? 0.4 : 1,
              }}>
              ← Anterior
            </button>
            {isLast ? (
              <button onClick={finish}
                style={{
                  padding: '11px 22px', background: C.brand, color: '#fff',
                  border: 'none', borderRadius: 999, fontSize: 13.5, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  letterSpacing: '-0.005em',
                  boxShadow: '0 8px 24px -8px rgba(75,123,229,0.55)',
                }}>
                Ir a mi cuenta real <Icon.ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={next}
                style={{
                  padding: '10px 22px', background: C.brand, color: '#fff',
                  border: 'none', borderRadius: 999, fontSize: 13.5, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  letterSpacing: '-0.005em',
                }}>
                Siguiente <Icon.ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes onb-pop {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes onb-confetti-fall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .onb-tooltip { will-change: transform; }
        .onb-tooltip::-webkit-scrollbar { width: 4px; }
        .onb-tooltip::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
      ` }} />
    </>
  );
}

function calcTooltipPos(rect: Rect, prefer?: string): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tw = TOOLTIP_W;
  const th = 380;  // estimación más realista del tooltip compacto
  const gap = TOOLTIP_GAP;
  const margin = 16;

  const spaceBelow = vh - (rect.top + rect.height);
  const spaceAbove = rect.top;
  const spaceRight = vw - (rect.left + rect.width);
  const spaceLeft = rect.left;

  // Heurística:
  // 1. Si user prefiere posición explícita y cabe → respetar
  // 2. Si target es ANCHO (>480px) — preferir lateral (right o left) para no tapar contenido abajo/arriba
  // 3. Si target está pegado al sidebar (izquierda <280px) → derecha
  // 4. Si target está pegado al borde derecho → izquierda
  // 5. Si target es estrecho y central → arriba o abajo según espacio
  const isWide = rect.width > 480;

  let position: 'bottom' | 'top' | 'right' | 'left' = 'bottom';
  if (prefer === 'right' && spaceRight > tw + gap) position = 'right';
  else if (prefer === 'left' && spaceLeft > tw + gap) position = 'left';
  else if (prefer === 'top' && spaceAbove > th + gap) position = 'top';
  else if (prefer === 'bottom' && spaceBelow > th + gap) position = 'bottom';
  // Sin preferencia: heurística por geometría
  else if (rect.left < 280 && spaceRight > tw + gap) position = 'right';
  else if (rect.left > vw - 280 && spaceLeft > tw + gap) position = 'left';
  // Target ancho → preferir lateral si hay espacio
  else if (isWide && spaceRight > tw + gap) position = 'right';
  else if (isWide && spaceLeft > tw + gap) position = 'left';
  // Default
  else if (spaceBelow < th + gap && spaceAbove > th + gap) position = 'top';
  else position = 'bottom';

  let top = 0, left = 0;
  if (position === 'bottom') { top = rect.top + rect.height + gap; left = rect.left + rect.width / 2 - tw / 2; }
  else if (position === 'top') { top = rect.top - th - gap; left = rect.left + rect.width / 2 - tw / 2; }
  else if (position === 'right') { top = rect.top + rect.height / 2 - th / 2; left = rect.left + rect.width + gap; }
  else if (position === 'left') { top = rect.top + rect.height / 2 - th / 2; left = rect.left - tw - gap; }

  if (left < margin) left = margin;
  if (left + tw > vw - margin) left = vw - tw - margin;
  if (top < margin) top = margin;
  if (top + th > vh - margin) top = vh - th - margin;
  return { top, left };
}

// ─── Confetti SVG decorativo para step final ──
function Confetti() {
  const pieces = Array.from({ length: 40 });
  const colors = [C.brand, C.brandDark, C.green, C.amber, C.purple, '#FF6B9D'];
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998, overflow: 'hidden' as const }}>
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 1.2;
        const dur = 2.4 + Math.random() * 1.4;
        const size = 5 + Math.random() * 8;
        const color = colors[i % colors.length];
        return (
          <div key={i} style={{
            position: 'absolute' as const,
            left: `${left}%`,
            top: -20,
            width: size,
            height: size * 1.6,
            background: color,
            borderRadius: 2,
            animation: `onb-confetti-fall ${dur}s linear ${delay}s infinite`,
          }} />
        );
      })}
    </div>
  );
}

// ─── Mini ilustraciones inline ───

function FlowDiagram({ steps }: { steps: { icon: string; label: string; color: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' as const, maxWidth: '100%' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4,
            minWidth: 60,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: `${s.color}1a`, color: s.color,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700,
            }}>{s.icon}</div>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textAlign: 'center' as const }}>{s.label}</div>
          </div>
          {i < steps.length - 1 && (
            <svg width="14" height="6" viewBox="0 0 14 6" style={{ marginTop: -14 }}>
              <path d="M0 3 L12 3 M9 1 L12 3 L9 5" fill="none" stroke={C.mutedLight} strokeWidth="1.5" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '8px 12px',
      background: `${color}0d`,
      border: `1px solid ${color}33`,
      borderRadius: 10,
      textAlign: 'center' as const,
      flex: 1,
    }}>
      <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color, letterSpacing: '-0.012em' }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── STEPS ───────────────────────────────────────────────

const STEPS: Step[] = [
  // 1. Bienvenida
  {
    tabHash: 'home',
    emoji: '👋',
    title: (n) => `Bienvenida, ${n}`,
    desc: () => ({
      intro: 'Soy tu copiloto en SACS. Te voy a guiar por tu portal usando datos de ejemplo — así sabes exactamente qué vas a ver cuando empieces a trabajar.',
      bullets: [
        { icon: '◉', label: 'Tu dashboard y números clave', color: C.brand },
        { icon: '◇', label: 'Cómo compartir tu link y atribuir prospectos', color: C.purple },
        { icon: '◈', label: 'Cómo recibes tu dinero', color: C.greenDark },
        { icon: '◆', label: 'Cómo subes de nivel y ganas más', color: C.amber },
      ],
      outro: 'Toma ~2 minutos. No te lo puedes saltar — pero después no aparece más.',
    }),
  },

  // 2. Sidebar Inicio
  {
    tabHash: 'home',
    target: 'sidebar-home',
    emoji: '🏠',
    title: 'Tu Inicio',
    desc: 'Tu dashboard principal. Siempre arrancas aquí — todo lo importante de un vistazo: cuánto vas a cobrar, cuánto llevas el año, en qué nivel estás, y qué te falta de actividad este mes.',
    preferPosition: 'right',
  },

  // 3. Stats grid
  {
    tabHash: 'home',
    target: 'home-stats',
    emoji: '📊',
    title: 'Tus 4 números clave',
    desc: () => ({
      intro: 'Cambian en tiempo real cuando algo pasa con tus leads, tus comisiones o tu actividad reportada.',
      bullets: [
        { icon: '💰', label: 'Próximo pago', sub: 'Lo confirmado que se libera el día 30 de este mes.', color: C.greenDark },
        { icon: '📈', label: 'Total año', sub: 'Suma de pagos liquidados + clientes esperando primer pago.', color: C.accent },
        { icon: '🏅', label: 'Mi nivel', sub: 'Tu nivel actual del programa. Sube automáticamente con milestones.', color: C.amber },
        { icon: '✨', label: 'Puntos del mes', sub: 'Actividad reportada. 100 puntos te mantienen activa.', color: C.purple },
      ],
    }),
    preferPosition: 'bottom',
  },

  // 4. Tu link único
  {
    tabHash: 'home',
    target: 'home-link',
    emoji: '🔗',
    title: 'Tu link único de partner',
    desc: () => ({
      intro: 'Este es tu activo principal. Compártelo donde sea — redes, WhatsApp, eventos, email — y cada persona que entra usándolo queda automáticamente atribuida a ti.',
      bullets: [
        { icon: '✓', label: 'Cookie de atribución por 90 días', sub: 'Si alguien hace click hoy y firma en 89 días, sigue siendo tu cliente.', color: C.greenDark },
        { icon: '✓', label: 'Atribución permanente en base de datos', sub: 'Aún después de que expire el cookie, queda registrado a tu nombre.', color: C.greenDark },
        { icon: '✓', label: 'Tracking de visitas en vivo', sub: 'Ves cuántos clicks, únicos, conversión y fuentes en la sección Compartir.', color: C.greenDark },
      ],
    }),
    preferPosition: 'top',
  },

  // 5. Cómo se comparte (sin target específico — explica el link en general)
  {
    tabHash: 'home',
    target: 'home-link',
    emoji: '📲',
    title: 'Maneras de compartirlo',
    desc: () => ({
      intro: 'No es solo copiar y pegar. Aquí tienes 5 formas pensadas según donde estés:',
      bullets: [
        { icon: '📋', label: 'Copiar link plano', sub: 'Para email, mensajes, donde sea texto.', color: C.muted },
        { icon: '💬', label: 'Compartir por WhatsApp', sub: 'Mensaje pre-armado, listo para mandar a un contacto.', color: C.greenDark },
        { icon: '✉️', label: 'Compartir por email', sub: 'Asunto + cuerpo pre-llenado.', color: C.accent },
        { icon: '🐦', label: 'Compartir en redes sociales', sub: 'X, LinkedIn, Instagram con texto sugerido.', color: C.purple },
        { icon: '📲', label: 'Código QR', sub: 'Para imprimir en tarjetas, carteles, productos.', color: C.amber },
      ],
      outro: 'Cuando tengas la cert de Demos · Consultoría Consciente ($3,500), también puedes registrar leads directos sin usar el link — ideal para los clientes que tú conociste en persona.',
    }),
    preferPosition: 'top',
  },

  // 6. Pipeline activo
  {
    tabHash: 'home',
    target: 'home-pipeline',
    emoji: '🚀',
    title: 'Tu pipeline · de prospecto a cliente',
    desc: () => ({
      intro: 'Cada visitante que se convierte en lead avanza por estas 5 etapas. El sistema actualiza automáticamente cuando agendan demo o firman plan.',
      bullets: [
        { icon: '1', label: 'Nuevo lead', sub: 'Aterrizó en tu link, dejó datos pero aún no hay próxima acción.', color: C.muted },
        { icon: '2', label: 'Prueba activa', sub: 'Empezó la prueba gratis de 14 días con su cuenta SACS.', color: C.amber },
        { icon: '3', label: 'Demo agendada', sub: 'Pidió cita con SACS · ves la fecha y hora.', color: C.accent },
        { icon: '4', label: 'Demo realizada', sub: 'Vio el sistema, esperando propuesta o decisión.', color: C.purple },
        { icon: '5', label: 'Cliente firmado', sub: 'Firmó plan y empezó a pagar · te genera comisión recurrente.', color: C.greenDark },
      ],
    }),
    preferPosition: 'top',
  },

  // 7. Sidebar Dinero
  {
    tabHash: 'dinero',
    target: 'sidebar-dinero',
    emoji: '💳',
    title: 'Dinero · tu cuenta SACS',
    desc: 'Aquí está tu saldo disponible, el historial de movimientos y las opciones de retirar o usar tu dinero. Funciona como una cuenta bancaria — al partner le toca decidir qué hacer con su saldo.',
    preferPosition: 'right',
  },

  // 8. Flujo del dinero (con diagrama)
  {
    tabHash: 'dinero',
    target: 'money-hero',
    emoji: '🏦',
    title: 'Cómo se mueve tu dinero',
    desc: () => ({
      intro: 'Cada peso recorre estos 4 estados antes de llegar a tus manos. SACS te paga el día 30 de cada mes — predecible, en tu calendario.',
      illustration: (
        <FlowDiagram steps={[
          { icon: '💳', label: 'Cliente paga', color: C.muted },
          { icon: '🔍', label: 'Revisión 24-48h', color: C.amber },
          { icon: '✓', label: 'Confirmado', color: C.purple },
          { icon: '💰', label: 'Saldo día 30', color: C.greenDark },
        ]} />
      ),
      outro: 'En cada uno ves cuánto dinero tienes en ese estado · transparencia total.',
    }),
    preferPosition: 'bottom',
  },

  // 9. Qué hacer con el saldo
  {
    tabHash: 'dinero',
    target: 'money-hero',
    emoji: '💸',
    title: '2 maneras de usar tu saldo',
    desc: () => ({
      intro: 'Cuando el día 30 libera tu saldo disponible, tú decides qué hacer con él. Ambas opciones son rápidas y desde el portal mismo.',
      bullets: [
        { icon: '🏦', label: 'Retirar a tu cuenta bancaria', sub: 'Llena el formulario una vez, manda factura, recibes depósito al día siguiente de validación.', color: C.brand },
        { icon: '🎓', label: 'Comprar una certificación', sub: 'Sin sacar tarjeta — el monto sale directo de tu saldo. Tu cert se activa al instante.', color: C.purple },
      ],
      outro: 'Puedes combinar — retira parte y usa el resto para una cert que te haga ganar más.',
    }),
    preferPosition: 'bottom',
  },

  // 10. Sidebar Leads
  {
    tabHash: 'leads',
    target: 'sidebar-leads',
    emoji: '👥',
    title: 'Leads · tus prospectos pre-cliente',
    desc: () => ({
      intro: 'Todos los que llegaron por tu link y aún no firman plan. Filtrables por etapa y con drawer de detalle al hacer click.',
      bullets: [
        { icon: '🔍', label: 'Filtros por etapa', sub: 'Ve solo los nuevos, los que están en prueba, o los que tienen demo agendada.', color: C.accent },
        { icon: '📝', label: 'Drawer de detalle', sub: 'Click en cualquier lead para ver historial, fechas, fuente, notas.', color: C.purple },
        { icon: '➕', label: 'Agregar lead directo', sub: 'Si tienes la cert de Demos · Consultoría Consciente, puedes capturar leads que conociste en persona.', color: C.greenDark },
      ],
    }),
    preferPosition: 'right',
  },

  // 11. Sidebar Clientes
  {
    tabHash: 'clientes',
    target: 'sidebar-clientes',
    emoji: '🤝',
    title: 'Clientes · ingresos recurrentes',
    desc: () => ({
      intro: 'Los que ya firmaron plan y pagan mes con mes. Tu ingreso recurrente — mientras estén activos, sigues cobrando.',
      bullets: [
        { icon: '💵', label: 'Cobro mensual visible', sub: 'Cuánto te genera cada cliente por mes en comisión.', color: C.greenDark },
        { icon: '❤️', label: 'Salud de la cuenta', sub: 'Estado al corriente, pago pendiente, o en riesgo de cancelar.', color: C.red },
        { icon: '📊', label: 'Meses activos', sub: 'Antigüedad de cada cliente — los que llevan más tiempo son los más sólidos.', color: C.purple },
      ],
    }),
    preferPosition: 'right',
  },

  // 12. Sidebar Mi nivel
  {
    tabHash: 'nivel',
    target: 'sidebar-nivel',
    emoji: '🏆',
    title: '4 niveles · cómo subes',
    desc: () => ({
      intro: 'Subes automáticamente al completar cada milestone. Tu nivel determina cuánto puedes ganar.',
      bullets: [
        { icon: '1', label: 'Partner Referidor', sub: '50% comisión sobre cada venta directa. Tu punto de partida.', color: C.muted },
        { icon: '2', label: 'Partner Certificado', sub: 'Completa 1 cert profesional · cobras servicios al 100% para ti.', color: C.greenDark },
        { icon: '3', label: 'Master Partner', sub: '5 sucursales activas · ganas 10% adicional sobre todo lo que venda tu red de partners invitados.', color: C.amber },
        { icon: '4', label: 'Founder Circle', sub: 'Sostén Master Partner Nv 4 por 12 meses · acceso a eventos exclusivos y comisión sin tope.', color: C.gold },
      ],
    }),
    preferPosition: 'right',
  },

  // 13. Compromisos del mes
  {
    tabHash: 'nivel',
    target: 'sidebar-nivel',
    emoji: '✨',
    title: '100 puntos al mes te mantienen activa',
    desc: () => ({
      intro: 'Cada mes reportas actividad para sumar puntos. Hay 30+ tipos de tareas con valores distintos — desde un Reel hasta un evento presencial.',
      bullets: [
        { icon: '🎬', label: 'Reel / Story / Post · 20-30 pts', sub: 'Contenido en redes mostrando SACS en tu negocio.', color: C.accent },
        { icon: '🎙️', label: 'Demo en feria o evento · 50-70 pts', sub: 'Presentas SACS a una audiencia presencial.', color: C.purple },
        { icon: '🎤', label: 'Speaking / panel · 70-100 pts', sub: 'Hablas de SACS en un evento del sector.', color: C.amber },
        { icon: '❤️', label: 'Filantropía · 30-100 pts', sub: 'Actividades sociales documentadas (refugios, alimentos, etc.).', color: C.red },
      ],
      outro: '3 meses consecutivos sin la meta = suspensión automática. Pero hay muchas formas de cumplir — eliges las que te quedan.',
    }),
    preferPosition: 'right',
  },

  // 14. Sidebar Certificaciones
  {
    tabHash: 'certs',
    target: 'sidebar-certs',
    emoji: '🎓',
    title: 'Certificaciones · cobras servicios al 100%',
    desc: () => ({
      intro: 'SACS te capacita en métodos profesionales · pagas una sola vez la cert, después cobras servicios al cliente y te quedas con el 100%.',
      bullets: [
        { icon: '🎯', label: 'Demos · Consultoría Consciente · $3,500', sub: 'OBLIGATORIA. Te enseña el método de demos y desbloquea capturar leads directos.', color: C.brand },
        { icon: '🏗️', label: 'Implementación 1 sucursal · $7,500', sub: 'Configurar SACS para un negocio. Cobras $20K-$40K.', color: C.purple },
        { icon: '📦', label: 'Migración de datos · $7,500', sub: 'Mover datos de sistemas viejos a SACS. Cobras $15K-$30K.', color: C.amber },
        { icon: '🏢', label: 'Multi-sucursal · $14,000', sub: 'Implementar SACS en cadenas. Cobras $40K-$100K.', color: C.greenDark },
        { icon: '🤖', label: 'IA Automatización · $14,000', sub: 'Crear automatizaciones para clientes. Cobras $20K-$80K.', color: C.accent },
        { icon: '🧠', label: 'IA Consultor · $21,000', sub: 'Consultoría avanzada con IA. Cobras $50K-$150K.', color: C.red },
      ],
    }),
    preferPosition: 'right',
  },

  // 15. WhatsApp soporte
  {
    tabHash: 'home',
    target: 'wa-fab',
    emoji: '💬',
    title: 'Soporte por WhatsApp · siempre presente',
    desc: () => ({
      intro: 'El botón verde está en todo el portal — esquina inferior derecha. Si te trabas en algo, escríbenos.',
      bullets: [
        { icon: '⏱️', label: 'Respuesta en <2 horas hábiles', sub: 'Lun-vie 9am-7pm CDMX. Te contesta un humano del equipo, no un bot.', color: C.greenDark },
        { icon: '📱', label: 'Mensaje pre-armado', sub: 'Al hacer click, ya viene con tu nombre y email para que el equipo te identifique al instante.', color: C.brand },
        { icon: '🤝', label: 'Soporte de cierre', sub: 'Si tienes un lead caliente y no sabes cómo cerrarlo, te ayudamos en directo por WhatsApp o videollamada.', color: C.purple },
      ],
    }),
    preferPosition: 'left',
  },

  // 16. PWA / Notificaciones
  {
    tabHash: 'home',
    target: 'wa-fab',
    emoji: '📲',
    title: 'Pon tu portal en pantalla de inicio',
    desc: () => ({
      intro: 'Funciona como app — sin descargar nada de App Store. Lo agregas a tu pantalla de inicio y abres con un toque.',
      bullets: [
        { icon: '🔔', label: 'Notificaciones push instantáneas', sub: 'Te avisamos en el momento exacto: pago confirmado, lead nuevo, demo agendada.', color: C.brand },
        { icon: '📶', label: 'Modo offline', sub: 'Ve tu dashboard, leads y clientes sin internet. Se sincroniza al reconectar.', color: C.greenDark },
        { icon: '⚡', label: 'Atajos rápidos', sub: 'Long-press en el ícono para compartir link, ver leads o reportar actividad.', color: C.amber },
      ],
      outro: 'En mobile aparece automáticamente un banner ofreciéndote agregar a inicio.',
    }),
    preferPosition: 'left',
  },

  // 17. Vista previa final · qué sigue
  {
    tabHash: 'home',
    emoji: '🎯',
    title: 'Tus primeros 3 pasos',
    desc: () => ({
      intro: 'Cuando entres a tu cuenta real, esto es lo que recomendamos hacer en orden:',
      bullets: [
        { icon: '1', label: 'Comparte tu link en redes', sub: 'Empieza por tu mejor canal — el que ya usas. WhatsApp, IG, lo que sea.', color: C.brand },
        { icon: '2', label: 'Reporta tu primera actividad', sub: 'Un Reel mostrando tu negocio + SACS suma 20-30 puntos. Arrancas tu marcador del mes.', color: C.purple },
        { icon: '3', label: 'Compra Demos · Consultoría Consciente', sub: '$3,500 una vez, te da el método pro + desbloquea leads directos. Es el unlock más importante.', color: C.greenDark },
      ],
      outro: 'Si te trabas, escríbenos por WhatsApp · estamos contigo.',
    }),
  },

  // 18. Final
  {
    tabHash: 'home',
    emoji: '🚀',
    title: (n) => `Listo, ${n}`,
    desc: () => ({
      intro: 'Ya conoces tu portal completo. El botón abajo te lleva a tu cuenta real con tus propios datos. Tu link único ya está activo y empieza a trackear desde tu primera compartida.',
      outro: 'Bienvenida formalmente al programa de partners SACS · estamos felices de tenerte.',
    }),
  },
];
