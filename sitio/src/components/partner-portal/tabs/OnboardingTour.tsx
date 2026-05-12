// Onboarding tour del portal partner · 10 steps full-screen modal-by-modal.
// Estilo Linear / Stripe Atlas — sin spotlight, sin overlays con hueco.
// Cada paso = pantalla limpia con mini-preview del componente del portal.

import { useEffect, useState } from 'react';
import { C, SS } from './styles';
import { Icon } from './icons';

type Props = {
  user: { id: string; nombre: string; email: string };
  onComplete: () => void;
};

export default function OnboardingTour({ user, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  const firstName = (user.nombre || 'partner').split(' ')[0];

  // Bloquea scroll del body mientras está activo
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  // Keyboard nav: solo derecha/izquierda. NO Escape (no se puede cancelar).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function next() {
    if (animating) return;
    if (step >= STEPS.length - 1) return;
    setAnimating(true);
    setTimeout(() => { setStep(s => s + 1); setAnimating(false); }, 200);
  }

  function prev() {
    if (animating) return;
    if (step <= 0) return;
    setAnimating(true);
    setTimeout(() => { setStep(s => s - 1); setAnimating(false); }, 200);
  }

  function finish() {
    try { localStorage.setItem('sacs_onboarding_done', '1'); } catch (_e) {}
    onComplete();
    // Redirige al portal real (sin ?demo=1)
    const target = '/partner/portal';
    if (window.location.pathname === target && window.location.search.includes('demo=1')) {
      window.location.href = target;
    } else {
      window.location.hash = 'home';
      window.location.reload();
    }
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <div className="onb-root">
      {/* Progress bar */}
      <div className="onb-progress">
        <div className="onb-progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="onb-counter">
        Paso <strong>{step + 1}</strong> de {STEPS.length}
      </div>

      {/* Step content */}
      <div className="onb-stage" key={step}>
        <div className="onb-content">
          {/* Eyebrow */}
          {current.eyebrow && (
            <div className="onb-eyebrow">{current.eyebrow}</div>
          )}

          {/* Title */}
          <h1 className="onb-title">{typeof current.title === 'function' ? current.title(firstName) : current.title}</h1>

          {/* Description */}
          <p className="onb-desc">{typeof current.desc === 'function' ? current.desc(firstName) : current.desc}</p>

          {/* Visual / preview */}
          <div className="onb-visual">
            {current.visual(firstName, user)}
          </div>
        </div>
      </div>

      {/* Footer nav */}
      <div className="onb-footer">
        <button
          onClick={prev}
          disabled={isFirst}
          className="onb-btn onb-btn-ghost"
          style={{ visibility: isFirst ? 'hidden' : 'visible' }}>
          ← Anterior
        </button>
        <div className="onb-dots">
          {STEPS.map((_, i) => (
            <span key={i} className="onb-dot" style={{
              background: i === step ? C.brand : i < step ? `${C.brand}66` : C.border,
              transform: i === step ? 'scale(1.4)' : 'scale(1)',
            }} />
          ))}
        </div>
        {isLast ? (
          <button onClick={finish} className="onb-btn onb-btn-primary">
            Ir a mi cuenta real <Icon.ArrowRight size={14} />
          </button>
        ) : (
          <button onClick={next} className="onb-btn onb-btn-primary">
            Siguiente <Icon.ArrowRight size={14} />
          </button>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .onb-root {
          position: fixed; inset: 0; z-index: 9999;
          background: #fafafa;
          font-family: var(--font-body, system-ui);
          color: ${C.text};
          display: flex; flex-direction: column;
          animation: onb-fade-in 0.3s ease-out;
        }
        @keyframes onb-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .onb-progress {
          height: 3px; background: ${C.border};
          position: relative; flex-shrink: 0;
        }
        .onb-progress-fill {
          height: 100%; background: linear-gradient(90deg, ${C.brand}, ${C.brandDark});
          transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .onb-counter {
          position: absolute; top: 18px; right: 24px;
          font-size: 11px; color: ${C.muted}; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
        }
        .onb-counter strong { color: ${C.text}; font-weight: 700; }

        .onb-stage {
          flex: 1;
          overflow-y: auto;
          display: flex; align-items: center; justify-content: center;
          padding: 48px 24px;
          animation: onb-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes onb-slide-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .onb-content {
          max-width: 640px; width: 100%; text-align: center;
        }
        .onb-eyebrow {
          font-size: 11px; color: ${C.brand};
          font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
          margin-bottom: 14px;
        }
        .onb-title {
          font-family: var(--font-display);
          font-size: 42px; font-weight: 500;
          line-height: 1.1; letter-spacing: -0.03em;
          margin: 0 0 16px; color: ${C.text};
        }
        .onb-desc {
          font-size: 17px; color: ${C.muted};
          line-height: 1.55; margin: 0 auto 40px;
          max-width: 540px;
        }
        .onb-visual {
          width: 100%; display: flex; align-items: center; justify-content: center;
        }

        .onb-footer {
          flex-shrink: 0;
          padding: 22px 32px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          border-top: 1px solid ${C.borderSoft};
          background: #fff;
        }
        .onb-btn {
          padding: 12px 22px;
          border-radius: 999px;
          font-family: inherit; font-size: 14px; font-weight: 600;
          letter-spacing: -0.005em;
          cursor: pointer; border: none;
          display: inline-flex; align-items: center; gap: 8px;
          transition: background 0.15s, transform 0.1s;
        }
        .onb-btn:disabled { opacity: 0.5; cursor: default; }
        .onb-btn-primary { background: ${C.brand}; color: #fff; }
        .onb-btn-primary:hover:not(:disabled) { background: ${C.brandDark}; transform: translateY(-1px); }
        .onb-btn-ghost { background: transparent; color: ${C.muted}; }
        .onb-btn-ghost:hover:not(:disabled) { color: ${C.text}; }

        .onb-dots {
          display: flex; gap: 8px; align-items: center;
        }
        .onb-dot {
          width: 6px; height: 6px; border-radius: 50%;
          transition: background 0.3s, transform 0.3s;
        }

        @media (max-width: 720px) {
          .onb-title { font-size: 30px; }
          .onb-desc { font-size: 15px; margin-bottom: 28px; }
          .onb-stage { padding: 36px 18px; }
          .onb-footer { padding: 16px 18px; }
          .onb-btn { padding: 10px 18px; font-size: 13px; }
          .onb-counter { font-size: 10px; right: 16px; }
        }
      ` }} />
    </div>
  );
}

// ─── Mini-previews (reuso de styles del portal) ────────────────────

function MiniCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: '20px 22px',
      boxShadow: '0 8px 24px -16px rgba(0,0,0,0.08)',
      ...style,
    }}>{children}</div>
  );
}

function StatPreview({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: string }) {
  return (
    <MiniCard style={{ position: 'relative', flex: 1, minWidth: 140 }}>
      <span style={{ position: 'absolute', top: 16, right: 16, width: 6, height: 6, borderRadius: '50%', background: accent }} />
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: C.text, letterSpacing: '-0.022em' }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: C.mutedLight, marginTop: 6 }}>{hint}</div>}
    </MiniCard>
  );
}

function Avatar({ initial, large }: { initial: string; large?: boolean }) {
  const s = large ? 120 : 80;
  return (
    <span style={{
      width: s, height: s, borderRadius: '50%',
      background: `linear-gradient(135deg, ${C.brand}, ${C.purple})`,
      color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontSize: large ? 52 : 32, fontWeight: 600,
      boxShadow: `0 20px 50px -16px rgba(75,123,229,0.45)`,
    }}>{initial}</span>
  );
}

// ─── STEPS ────────────────────────────────────────────────

const STEPS: Array<{
  eyebrow?: string;
  title: string | ((name: string) => string);
  desc: string | ((name: string) => string);
  visual: (name: string, user: any) => JSX.Element;
}> = [
  // 1. Bienvenida
  {
    eyebrow: 'Bienvenida al programa',
    title: (n) => `Hola, ${n}`,
    desc: (n) =>
      'Soy Aiko, te voy a guiar por tu portal en 60 segundos. Sin sorpresas, sin opciones que confundan — solo lo que necesitas saber.',
    visual: (n, u) => <Avatar initial={(u.nombre || 'A').charAt(0).toUpperCase()} large />,
  },

  // 2. Inicio
  {
    eyebrow: 'Paso 1 · Tu dashboard',
    title: 'Inicio',
    desc: 'Cada que entras al portal, lo primero que ves. Tus 4 números clave en una sola pantalla: cuánto vas a cobrar, cuánto llevas, en qué nivel estás, qué te falta de actividad.',
    visual: () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, width: '100%', maxWidth: 520 }}>
        <StatPreview label="Próximo pago" value="$3,500" hint="Se deposita el día 1" accent={C.green} />
        <StatPreview label="Total año" value="$17,500" hint="5 liquidados · 9 en camino" accent={C.accent} />
        <StatPreview label="Mi nivel" value="Lvl 1" hint="Partner Referidor" accent={C.muted} />
        <StatPreview label="Puntos del mes" value="87/100" hint="22 días restantes" accent={C.purple} />
      </div>
    ),
  },

  // 3. Tu link único
  {
    eyebrow: 'Paso 2 · Tu herramienta clave',
    title: 'Tu link único',
    desc: 'Cada persona que entra usando este link queda atribuida a ti automáticamente — por 90 días vía cookie y permanente en la base de datos. Sin códigos, sin fricción.',
    visual: (_n, u) => (
      <div style={{
        background: `linear-gradient(135deg, ${C.brand}, ${C.brandDark})`,
        color: '#fff',
        borderRadius: 16,
        padding: '24px 28px',
        width: '100%', maxWidth: 540,
        textAlign: 'left' as const,
        boxShadow: '0 12px 32px -12px rgba(75,123,229,0.35)',
      }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Tu link único</div>
        <div style={{ fontFamily: 'SF Mono, Courier New, monospace', fontSize: 15, marginBottom: 16, wordBreak: 'break-all' as const }}>
          sacscloud.com/p/{(u.nombre || 'andrea').toLowerCase().split(' ')[0]}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          <span style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.14)', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>Copiar</span>
          <span style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.14)', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>WhatsApp</span>
          <span style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.14)', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>Email</span>
        </div>
      </div>
    ),
  },

  // 4. Pipeline activo
  {
    eyebrow: 'Paso 3 · Tus prospectos',
    title: 'Pipeline activo',
    desc: 'Ve en qué etapa está cada prospecto: desde "Nuevo" hasta "Cliente firmado". Cada vez que algo cambia, tu pipeline se actualiza automáticamente.',
    visual: () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, width: '100%', maxWidth: 560 }}>
        {[
          { num: 3, label: 'Nuevos', accent: C.muted },
          { num: 4, label: 'Prueba', accent: C.amber },
          { num: 2, label: 'Demo agendada', accent: C.accent },
          { num: 1, label: 'Demo realizada', accent: C.purple },
          { num: 14, label: 'Clientes', accent: C.greenDark },
        ].map((p, i) => (
          <div key={i} style={{
            background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12,
            padding: '14px 12px', textAlign: 'center' as const,
            boxShadow: '0 4px 12px -8px rgba(0,0,0,0.06)',
          }}>
            <div style={{ width: 18, height: 18, borderRadius: 6, background: `${p.accent}1a`, color: p.accent, margin: '0 auto 8px', fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>•</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, color: C.text, letterSpacing: '-0.025em', lineHeight: 1 }}>{p.num}</div>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginTop: 4 }}>{p.label}</div>
          </div>
        ))}
      </div>
    ),
  },

  // 5. Dinero estilo banco
  {
    eyebrow: 'Paso 4 · Tu cuenta SACS',
    title: 'Dinero, como banco',
    desc: 'Tu saldo, tu próximo pago, tu historial de movimientos. El día 30 de cada mes liberamos tus comisiones confirmadas. Lo retiras a tu cuenta o lo usas para comprar certificaciones — directo.',
    visual: () => (
      <div style={{
        background: `linear-gradient(135deg, ${C.brand}, ${C.brandDark})`,
        color: '#fff',
        borderRadius: 18,
        padding: '28px 32px',
        width: '100%', maxWidth: 540,
        textAlign: 'left' as const,
        boxShadow: '0 16px 40px -20px rgba(75,123,229,0.45)',
      }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: 8 }}>Saldo disponible</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 500, letterSpacing: '-0.04em', lineHeight: 1 }}>$21,830</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 10 }}>Disponible para retirar o usar en una certificación.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.18)' }}>
          <span style={{ padding: '8px 14px', background: '#fff', color: C.brand, borderRadius: 999, fontSize: 12, fontWeight: 600 }}>Retirar a mi cuenta</span>
          <span style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>Usar para certificación</span>
        </div>
      </div>
    ),
  },

  // 6. Leads y Clientes (CRM)
  {
    eyebrow: 'Paso 5 · Tu CRM',
    title: 'Leads y Clientes',
    desc: 'Tus prospectos pre-pago en "Leads". Cuando alguno firma plan y paga, pasa automáticamente a "Clientes" con su MRR, mi comisión recurrente y la salud de su cuenta.',
    visual: () => (
      <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 560, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
        <MiniCard style={{ flex: 1, minWidth: 200, textAlign: 'left' as const }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Leads · 10 en pipeline</div>
          <div style={{ fontSize: 12, color: C.text, marginBottom: 6, fontWeight: 500 }}>Joyería Mariana · Nuevo</div>
          <div style={{ fontSize: 12, color: C.text, marginBottom: 6, fontWeight: 500 }}>Café de Laura · Prueba</div>
          <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>Vázquez Joyas · Demo agendada</div>
        </MiniCard>
        <MiniCard style={{ flex: 1, minWidth: 200, textAlign: 'left' as const }}>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 12 }}>Clientes · 14 activos</div>
          <div style={{ fontSize: 12, color: C.text, marginBottom: 6, fontWeight: 500 }}>Cruz Boutique · $1,750/mes</div>
          <div style={{ fontSize: 12, color: C.text, marginBottom: 6, fontWeight: 500 }}>Castillo Spa · $2,450/mes</div>
          <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>Aguilar Tech · $2,450/mes</div>
        </MiniCard>
      </div>
    ),
  },

  // 7. Mi nivel + compromisos
  {
    eyebrow: 'Paso 6 · Tu nivel',
    title: 'Mi nivel · 100 puntos al mes',
    desc: 'Cada mes generas 100 puntos con contenido en redes, demos, eventos o actividades de apoyo. Te dan certeza de continuidad y subes de nivel automáticamente al cumplir milestones.',
    visual: () => (
      <MiniCard style={{ width: '100%', maxWidth: 540, textAlign: 'left' as const }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: C.text, letterSpacing: '-0.025em' }}>
            87 <span style={{ fontSize: 14, color: C.muted, fontWeight: 400 }}>/ 100 puntos</span>
          </span>
          <span style={{ fontSize: 11, color: C.amber, fontWeight: 600 }}>22 días restantes</span>
        </div>
        <div style={{ height: 10, background: '#f0f0ee', borderRadius: 999, overflow: 'hidden' as const, marginBottom: 14 }}>
          <div style={{ height: '100%', width: '87%', background: `linear-gradient(90deg, #6CD6C2, ${C.brand})`, borderRadius: 999 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[1, 2, 3, 4].map(lv => (
            <div key={lv} style={{ flex: 1, height: 4, borderRadius: 2, background: lv === 1 ? C.green : C.border }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: C.muted, fontWeight: 600 }}>
          <span>Lvl 1 · Referidor</span>
          <span>Lvl 4 · Founder Circle</span>
        </div>
      </MiniCard>
    ),
  },

  // 8. Certificaciones
  {
    eyebrow: 'Paso 7 · Cómo ganar más',
    title: 'Certificaciones',
    desc: 'La primera es "Demos · Consultoría Consciente" ($3,500). Te enseña el método para hacer demos profesionales y desbloquea capturar leads directos en tu portal — clientes que tú mismo conociste, sin link.',
    visual: () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, width: '100%', maxWidth: 540 }}>
        {[
          { name: 'Demos · Consultoría Consciente', precio: '$3,500', highlight: true },
          { name: 'Implementación · 1 sucursal', precio: '$7,500' },
          { name: 'Migración de datos', precio: '$7,500' },
          { name: 'Automatización con IA', precio: '$14,000' },
        ].map((c, i) => (
          <MiniCard key={i} style={{
            textAlign: 'left' as const,
            background: c.highlight ? C.brandSoft : '#fff',
            borderColor: c.highlight ? C.brandTint : C.border,
          }}>
            {c.highlight && (
              <div style={{ display: 'inline-block', padding: '2px 8px', background: C.brand, color: '#fff', borderRadius: 999, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
                Inicial
              </div>
            )}
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>{c.name}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: c.highlight ? C.brand : C.text }}>{c.precio}</div>
          </MiniCard>
        ))}
      </div>
    ),
  },

  // 9. WhatsApp soporte
  {
    eyebrow: 'Paso 8 · Soporte siempre',
    title: 'Si te trabas, escríbenos',
    desc: 'El botón verde de WhatsApp está siempre visible en tu portal — esquina inferior derecha. Respondemos en menos de 2 horas hábiles, directo con un humano del equipo de partners.',
    visual: () => (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '14px 24px', background: '#25D366', color: '#fff',
        borderRadius: 999, fontFamily: 'var(--font-body, system-ui)',
        fontSize: 15, fontWeight: 600,
        boxShadow: '0 12px 28px -8px rgba(37,211,102,0.45)',
      }}>
        <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <path d="M16.04 4.011C9.443 4.011 4.075 9.376 4.072 15.97c-.001 2.108.55 4.166 1.597 5.98L4 28l6.184-1.622a11.954 11.954 0 005.85 1.49h.005c6.595 0 11.962-5.366 11.965-11.96.001-3.196-1.242-6.201-3.5-8.461a11.886 11.886 0 00-8.464-3.436zm0 21.815a9.96 9.96 0 01-5.071-1.388l-.364-.216-3.768.988 1.006-3.672-.237-.376a9.937 9.937 0 01-1.524-5.293c.002-5.478 4.461-9.936 9.944-9.936a9.882 9.882 0 017.029 2.913 9.873 9.873 0 012.91 7.03c-.002 5.479-4.461 9.95-9.925 9.95zm5.452-7.448c-.299-.149-1.769-.873-2.043-.972-.274-.1-.474-.149-.673.15-.2.299-.773.972-.948 1.171-.174.2-.349.224-.648.075-.299-.149-1.262-.465-2.405-1.485-.889-.793-1.49-1.773-1.664-2.071-.174-.299-.018-.46.131-.609.134-.134.299-.349.448-.523.149-.174.199-.299.299-.498.099-.2.05-.374-.025-.523-.075-.149-.673-1.62-.922-2.219-.243-.583-.49-.504-.673-.514-.174-.008-.374-.01-.573-.01a1.097 1.097 0 00-.798.374c-.274.299-1.046 1.022-1.046 2.493s1.07 2.891 1.22 3.09c.149.2 2.107 3.217 5.105 4.512.713.308 1.27.492 1.704.63.715.227 1.367.195 1.882.119.574-.086 1.769-.723 2.018-1.421.249-.698.249-1.297.174-1.421-.074-.124-.273-.199-.572-.348z" />
        </svg>
        WhatsApp
      </div>
    ),
  },

  // 10. Final
  {
    eyebrow: 'Estás listo',
    title: 'Empieza a generar',
    desc: 'Ya conoces tu portal. Entra a tu cuenta real y empieza desde tu primer cliente. Comparte tu link, agenda demos, suma puntos. Estaremos contigo en cada paso.',
    visual: (n, u) => (
      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 18 }}>
        <Avatar initial={(u.nombre || 'A').charAt(0).toUpperCase()} large />
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 18px', background: 'rgba(42,181,160,0.12)', color: C.greenDark,
          borderRadius: 999, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
        }}>
          ✓ Tour completado
        </div>
      </div>
    ),
  },
];
