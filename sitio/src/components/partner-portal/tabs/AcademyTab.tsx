// AcademyTab — vista general de la Academia SACS para partners.
// Muestra los 6 módulos y sus tareas para que el partner conozca lo que
// sus clientes aprenden, y enlaza directo a la academia real en
// app.sacscloud.com.
//
// Filosofía: el partner no toma el curso aquí — solo lo conoce. Toda
// interacción de "ver detalle" abre la academia en otra pestaña.

import { useMemo, useState } from 'react';
import { SS, C } from './styles';
import { Icon } from './icons';
import {
  ACADEMY_MODULES,
  ACADEMY_TOTAL_MODULES,
  ACADEMY_TOTAL_TASKS,
  ACADEMY_TOTAL_MINUTES,
  ACADEMY_DEMO_URL,
  type AcademyModule,
} from '../../../data/academy-modules';

export default function AcademyTab({ user }: { user: { id: string; nombre: string; email: string } }) {
  const [openModule, setOpenModule] = useState<number | null>(null);

  const totalHours = useMemo(() => (ACADEMY_TOTAL_MINUTES / 60).toFixed(1), []);

  return (
    <div>
      {/* Hero */}
      <h1 style={SS.h1Small}>Aprende SACS</h1>
      <p style={SS.leadSm}>
        Conoce a fondo lo que tus clientes aprenden cuando se gradúan de la Academia SACS.
        Si dominas estos módulos, vendes mejor y resuelves dudas antes de que las pregunten.
      </p>

      {/* CTA hero card */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`,
        color: '#fff',
        borderRadius: 18,
        padding: '32px 36px',
        marginBottom: 36,
        boxShadow: '0 12px 32px -16px rgba(75,123,229,0.35)',
        position: 'relative' as const,
        overflow: 'hidden' as const,
      }}>
        {/* Decorative emoji bg */}
        <div style={{
          position: 'absolute' as const, right: -10, top: -10,
          fontSize: 140, opacity: 0.12, lineHeight: 1,
          pointerEvents: 'none' as const,
        }}>🎓</div>

        <div style={{ position: 'relative' as const, zIndex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, opacity: 0.7, marginBottom: 10 }}>
            Academia oficial SACS
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 12 }}>
            {ACADEMY_TOTAL_MODULES} módulos · {ACADEMY_TOTAL_TASKS} tareas · ~{totalHours}h de aprendizaje
          </div>
          <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.55, marginBottom: 22, maxWidth: 560 }}>
            Toda la operación de un negocio de retail con SACS, de cero a profesional.
            Configurar la empresa, preparar el catálogo, punto de venta, puesta en marcha,
            operación diaria y tienda en línea. Tus clientes lo siguen paso a paso —
            tú lo dominas para acompañarlos.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
            <a href={ACADEMY_DEMO_URL} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 22px',
                background: '#fff', color: C.brand,
                borderRadius: 10,
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}>
              Abrir Academia SACS <Icon.ArrowRight size={14} />
            </a>
            <a href="https://app.sacscloud.com" target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 18px',
                background: 'rgba(255,255,255,0.14)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.28)',
                borderRadius: 10,
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
              }}>
              Abrir mi cuenta SACS
            </a>
          </div>
        </div>
      </div>

      {/* Lista de módulos */}
      <h2 style={SS.h2}>Los 6 módulos del programa</h2>
      <p style={{ ...SS.leadSm, marginTop: -8 }}>
        Toca cualquier módulo para ver sus tareas. Cada módulo se completa con tareas guiadas dentro de la academia.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
        {ACADEMY_MODULES.map(m => (
          <ModuleCard
            key={m.num}
            module={m}
            isOpen={openModule === m.num}
            onToggle={() => setOpenModule(openModule === m.num ? null : m.num)}
          />
        ))}
      </div>

      {/* Nota final */}
      <div style={{
        marginTop: 32,
        background: C.brandSoft,
        border: `1px solid ${C.brandTint}`,
        borderRadius: 14,
        padding: '20px 24px',
        display: 'flex', alignItems: 'flex-start', gap: 14,
      }}>
        <span style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: 10,
          background: 'rgba(75,123,229,0.18)', color: C.brand,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon.Sparkle size={16} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.brandDark, marginBottom: 4 }}>
            Sugerencia para partners
          </div>
          <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.55 }}>
            Recorre la academia <strong>antes</strong> de tu primera demo. Aunque no la completes,
            saber qué hay en cada módulo te permite responder en segundos cuando un prospecto pregunta
            "¿cómo configuro X?" o "¿esto soporta Y?". Y si tienes una certificación de SACS, este
            es el contenido base que dominarás a profundidad.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Module card ─────────────────────────────────────────────
function ModuleCard({ module: m, isOpen, onToggle }: {
  module: AcademyModule;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const totalMin = m.tasks.reduce((s, t) => s + (parseInt(t.time, 10) || 0), 0);

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${isOpen ? m.color : C.border}`,
      borderRadius: 16,
      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      overflow: 'hidden' as const,
      transition: 'border-color 0.15s',
    }}>
      {/* Header (toggle) */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '20px 24px',
          background: 'transparent',
          border: 'none', cursor: 'pointer',
          textAlign: 'left' as const,
          fontFamily: 'inherit',
        }}
      >
        {/* Emoji + número */}
        <div style={{
          position: 'relative' as const,
          flexShrink: 0,
          width: 56, height: 56, borderRadius: 14,
          background: `${m.color}14`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26,
        }}>
          {m.emoji}
          <span style={{
            position: 'absolute' as const, bottom: -6, right: -6,
            width: 22, height: 22, borderRadius: '50%',
            background: m.color, color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)',
            border: '2px solid #fff',
          }}>
            {m.num}
          </span>
        </div>

        {/* Texto */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' as const }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: m.color,
              padding: '3px 8px',
              background: `${m.color}14`,
              borderRadius: 999,
              letterSpacing: '0.06em', textTransform: 'uppercase' as const,
            }}>
              Módulo {m.num}
            </span>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
              {m.tasks.length} tareas · ~{totalMin} min
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: C.text, letterSpacing: '-0.015em', lineHeight: 1.3, marginBottom: 4 }}>
            {m.name}
          </div>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
            {m.description}
          </div>
        </div>

        {/* Chevron */}
        <span style={{
          flexShrink: 0,
          color: C.mutedLight,
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}>
          <Icon.ArrowRight size={18} />
        </span>
      </button>

      {/* Tareas expandidas */}
      {isOpen && (
        <div style={{
          borderTop: `1px solid ${C.borderSoft}`,
          padding: '6px 24px 20px',
        }}>
          {m.tasks.map((t, i) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '14px 0',
              borderBottom: i === m.tasks.length - 1 ? 'none' : `1px solid ${C.borderSoft}`,
            }}>
              <span style={{
                flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                background: `${m.color}14`, color: m.color,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)',
                marginTop: 1,
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text, lineHeight: 1.4, marginBottom: 4 }}>
                  {t.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: C.muted, fontWeight: 500 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon.Clock size={11} /> {t.time}
                  </span>
                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: C.mutedLight }} />
                  <span>{t.category}</span>
                </div>
              </div>
            </div>
          ))}

          {/* CTA módulo → academia */}
          <a
            href={ACADEMY_DEMO_URL}
            target="_blank" rel="noopener noreferrer"
            style={{
              marginTop: 14,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 16px',
              background: m.color, color: '#fff',
              borderRadius: 10,
              fontSize: 12, fontWeight: 600, textDecoration: 'none',
            }}
          >
            Ver módulo {m.num} en la academia <Icon.ArrowRight size={12} />
          </a>
        </div>
      )}
    </div>
  );
}
