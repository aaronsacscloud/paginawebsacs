// Onboarding tour interactivo · spotlight estilo Intercom/Driver.js.
// El portal demo sigue visible debajo. Overlay con hueco + tooltip flotante.
// Auto-switch de tabs cuando el step lo requiere.

import { useEffect, useRef, useState } from 'react';
import { C } from './styles';
import { Icon } from './icons';

type Step = {
  tabHash: string;                                    // tab donde debe estar
  target?: string;                                    // data-tour selector. Si no hay target → modal centrado
  title: string | ((name: string) => string);
  desc: string | ((name: string) => string);
  preferPosition?: 'top' | 'bottom' | 'right' | 'left' | 'center';
};

type Rect = { top: number; left: number; width: number; height: number };

type Props = {
  user: { id: string; nombre: string; email: string };
  onComplete: () => void;
};

const PAD = 10;        // padding alrededor del spotlight
const TOOLTIP_W = 360;
const TOOLTIP_GAP = 14;

export default function OnboardingTour({ user, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; arrow?: 'top' | 'bottom' | 'left' | 'right' }>({ top: 0, left: 0 });
  const [ready, setReady] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const firstName = (user.nombre || 'partner').split(' ')[0];
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const isCentered = !current.target;

  // ─── Tab switch automático ──
  useEffect(() => {
    setReady(false);
    setRect(null);
    const currentHash = (window.location.hash || '#home').replace('#', '');
    if (currentHash !== current.tabHash) {
      window.location.hash = current.tabHash;
    }
    // Espera 250ms para que React renderice la tab nueva, luego mide el target
    const t = setTimeout(() => measure(), 280);
    return () => clearTimeout(t);
  }, [step]);

  // ─── Medición del target + reposicionamiento del tooltip ──
  function measure() {
    if (isCentered) {
      setRect(null);
      setReady(true);
      return;
    }
    const sel = `[data-tour="${current.target}"]`;
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) {
      // Si no encuentra el target, lo trata como centrado
      setRect(null);
      setReady(true);
      return;
    }

    // Scroll el target a la vista si está fuera
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    // Espera un frame para que termine el scroll
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const newRect: Rect = {
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        };
        setRect(newRect);
        setTooltipPos(calcTooltipPos(newRect, current.preferPosition));
        setReady(true);
      });
    });
  }

  // Recalcular en resize/scroll
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

  // ─── Lock body scroll ──
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, []);

  // ─── Keyboard nav ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function next() {
    if (step >= STEPS.length - 1) return;
    setStep(s => s + 1);
  }
  function prev() {
    if (step <= 0) return;
    setStep(s => s - 1);
  }
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
  const desc = typeof current.desc === 'function' ? current.desc(firstName) : current.desc;

  return (
    <>
      {/* Overlay con hueco (SVG mask) */}
      <svg
        className="onb-overlay"
        width="100%"
        height="100%"
        style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9998 }}>
        <defs>
          <mask id="onb-cutout">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - PAD}
                y={rect.top - PAD}
                width={rect.width + PAD * 2}
                height={rect.height + PAD * 2}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.65)"
          mask="url(#onb-cutout)"
          style={{ transition: 'opacity 0.3s' }}
        />
        {/* Borde decorativo alrededor del hueco */}
        {rect && (
          <rect
            x={rect.left - PAD}
            y={rect.top - PAD}
            width={rect.width + PAD * 2}
            height={rect.height + PAD * 2}
            rx="12"
            fill="none"
            stroke={C.brand}
            strokeWidth="2"
            style={{ filter: 'drop-shadow(0 0 12px rgba(75,123,229,0.55))' }}
          />
        )}
      </svg>

      {/* Tooltip card */}
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
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 20px 50px -8px rgba(0,0,0,0.25), 0 4px 12px -4px rgba(0,0,0,0.10)',
            zIndex: 9999,
            padding: '22px 24px 18px',
            animation: 'onb-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
          {/* Counter */}
          <div style={{
            fontSize: 10, color: C.brand, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            Paso {step + 1} de {STEPS.length}
          </div>

          {/* Title */}
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: isCentered ? 26 : 19,
            fontWeight: 600,
            color: C.text,
            margin: '0 0 8px',
            letterSpacing: '-0.018em',
            lineHeight: 1.25,
          }}>
            {title}
          </h3>

          {/* Desc */}
          <p style={{
            fontSize: 14,
            color: C.muted,
            lineHeight: 1.55,
            margin: '0 0 18px',
          }}>
            {desc}
          </p>

          {/* Progress bar */}
          <div style={{
            height: 3, background: C.borderSoft,
            borderRadius: 999, overflow: 'hidden', marginBottom: 16,
          }}>
            <div style={{
              height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`,
              background: `linear-gradient(90deg, ${C.brand}, ${C.brandDark})`,
              transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }} />
          </div>

          {/* Footer nav */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <button onClick={prev}
              disabled={isFirst}
              style={{
                padding: '8px 12px',
                background: 'transparent',
                color: isFirst ? C.mutedLight : C.muted,
                border: 'none',
                fontSize: 13, fontWeight: 600,
                cursor: isFirst ? 'default' : 'pointer',
                fontFamily: 'inherit',
                opacity: isFirst ? 0.5 : 1,
              }}>
              ← Anterior
            </button>
            {isLast ? (
              <button onClick={finish}
                style={{
                  padding: '10px 20px',
                  background: C.brand, color: '#fff',
                  border: 'none', borderRadius: 999,
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  letterSpacing: '-0.005em',
                }}>
                Ir a mi cuenta real <Icon.ArrowRight size={14} />
              </button>
            ) : (
              <button onClick={next}
                style={{
                  padding: '10px 20px',
                  background: C.brand, color: '#fff',
                  border: 'none', borderRadius: 999,
                  fontSize: 13, fontWeight: 600,
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
          from { opacity: 0; transform: scale(0.96) translate(var(--tx, 0), var(--ty, 0)); }
          to   { opacity: 1; transform: scale(1) translate(var(--tx, 0), var(--ty, 0)); }
        }
        .onb-tooltip { will-change: transform; }
      ` }} />
    </>
  );
}

// ─── Posicionamiento smart del tooltip ──
function calcTooltipPos(rect: Rect, prefer?: string): { top: number; left: number; arrow?: 'top' | 'bottom' | 'left' | 'right' } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tw = TOOLTIP_W;
  const th = 240; // estimación promedio
  const gap = TOOLTIP_GAP;
  const margin = 16; // margen mínimo a los bordes

  const spaceBelow = vh - (rect.top + rect.height);
  const spaceAbove = rect.top;
  const spaceRight = vw - (rect.left + rect.width);
  const spaceLeft = rect.left;

  // Decide posición preferida (right si el target está en sidebar/izquierda)
  let position: 'bottom' | 'top' | 'right' | 'left' = 'bottom';
  if (prefer === 'right' || (rect.left < 280 && spaceRight > tw + gap)) {
    position = 'right';
  } else if (prefer === 'left' || (rect.left > vw - 280 && spaceLeft > tw + gap)) {
    position = 'left';
  } else if (prefer === 'top' || (spaceBelow < th + gap && spaceAbove > th + gap)) {
    position = 'top';
  } else {
    position = 'bottom';
  }

  let top = 0, left = 0;
  if (position === 'bottom') {
    top = rect.top + rect.height + gap;
    left = rect.left + rect.width / 2 - tw / 2;
  } else if (position === 'top') {
    top = rect.top - th - gap;
    left = rect.left + rect.width / 2 - tw / 2;
  } else if (position === 'right') {
    top = rect.top + rect.height / 2 - th / 2;
    left = rect.left + rect.width + gap;
  } else if (position === 'left') {
    top = rect.top + rect.height / 2 - th / 2;
    left = rect.left - tw - gap;
  }

  // Clamp a los bordes
  if (left < margin) left = margin;
  if (left + tw > vw - margin) left = vw - tw - margin;
  if (top < margin) top = margin;
  if (top + th > vh - margin) top = vh - th - margin;

  return { top, left, arrow: position };
}

// ─── STEPS ──────────────────────────────────────────────

const STEPS: Step[] = [
  {
    tabHash: 'home',
    title: (n) => `Hola, ${n}`,
    desc: 'Te voy a guiar por tu portal en 60 segundos sobre los datos demo. Cuando entres a tu cuenta real, todo se va a ver igual pero con tus propios números.',
  },
  {
    tabHash: 'home',
    target: 'sidebar-home',
    title: 'Tu Inicio',
    desc: 'Tu dashboard principal. Siempre arrancas aquí — todo lo importante en una pantalla.',
    preferPosition: 'right',
  },
  {
    tabHash: 'home',
    target: 'home-stats',
    title: 'Tus 4 números clave',
    desc: 'Próximo pago · total año · nivel actual · puntos del mes. Cambian en tiempo real cuando algo pasa con tus leads o tus pagos.',
    preferPosition: 'bottom',
  },
  {
    tabHash: 'home',
    target: 'home-link',
    title: 'Tu link único',
    desc: 'Comparte esto en redes, WhatsApp, eventos — donde quieras. Cada persona que entra usándolo queda atribuida a ti por 90 días.',
    preferPosition: 'top',
  },
  {
    tabHash: 'home',
    target: 'home-pipeline',
    title: 'Tu pipeline activo',
    desc: 'Aquí ves cuántos prospectos tienes en cada etapa: nuevos, en prueba, demo agendada, demo realizada, ya clientes.',
    preferPosition: 'top',
  },
  {
    tabHash: 'dinero',
    target: 'sidebar-dinero',
    title: 'Dinero · tu cuenta SACS',
    desc: 'Aquí está tu saldo disponible, tu historial de pagos y la opción de retirar o usar el dinero para certificaciones.',
    preferPosition: 'right',
  },
  {
    tabHash: 'dinero',
    target: 'money-hero',
    title: 'Saldo disponible',
    desc: 'El día 30 de cada mes liberamos tus comisiones confirmadas a este saldo. Lo retiras a tu cuenta bancaria o lo usas para comprar una certificación directamente.',
    preferPosition: 'bottom',
  },
  {
    tabHash: 'leads',
    target: 'sidebar-leads',
    title: 'Leads · tus prospectos',
    desc: 'Los que aún no firman plan. Filtrables por etapa, con drawer de detalle al hacer click. Tu pipeline pre-cliente.',
    preferPosition: 'right',
  },
  {
    tabHash: 'clientes',
    target: 'sidebar-clientes',
    title: 'Clientes · los que pagan',
    desc: 'Los clientes activos en su plan. Te generan comisión recurrente mientras estén activos. Ves su MRR, salud, meses activos.',
    preferPosition: 'right',
  },
  {
    tabHash: 'nivel',
    target: 'sidebar-nivel',
    title: 'Mi nivel · 100 puntos al mes',
    desc: 'Reporta tu actividad (reels, demos, eventos) para sumar puntos. 100 puntos al mes te mantienen activa. Subes de nivel automáticamente al cumplir milestones.',
    preferPosition: 'right',
  },
  {
    tabHash: 'home',
    target: 'wa-fab',
    title: 'Soporte por WhatsApp',
    desc: 'Si te trabas en algo, este botón siempre está visible — esquina inferior derecha. Te conecta directo con un humano del equipo. Respondemos en menos de 2 horas hábiles.',
    preferPosition: 'left',
  },
  {
    tabHash: 'home',
    title: (n) => `Listo, ${n}`,
    desc: 'Ya conoces tu portal. El botón abajo te lleva a tu cuenta real con tus propios datos. Empieza por compartir tu link único y agendar tu primera demo.',
  },
];
