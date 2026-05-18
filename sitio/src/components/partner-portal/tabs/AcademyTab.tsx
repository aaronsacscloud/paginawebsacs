// AcademyTab — el journey completo del cliente, visualizado.
// Cada módulo tiene una foto ambiental del momento real que vive el cliente,
// más una narrativa de 3 partes (qué siente · qué logra · cómo venderlo) que
// le da al partner el contexto para acompañarlo o pitchearlo.
//
// Enlace final: cada módulo abre la academia real en app.sacscloud.com.

import { useState } from 'react';
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
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>({});

  const totalHours = (ACADEMY_TOTAL_MINUTES / 60).toFixed(1);

  function toggleTasks(num: number) {
    setExpandedTasks(prev => ({ ...prev, [num]: !prev[num] }));
  }

  return (
    <div>
      {/* Hero */}
      <h1 style={SS.h1Small}>Aprende SACS</h1>
      <p style={SS.leadSm}>
        Recorre el journey completo de un cliente en SACS — desde el día 1 hasta su tienda en línea operando.
        Si entiendes lo que vive en cada módulo, lo vendes mejor y lo acompañas como un consultor real.
      </p>

      {/* CTA hero card */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`,
        color: '#fff',
        borderRadius: 18,
        padding: '32px 36px',
        marginBottom: 32,
        boxShadow: '0 12px 32px -16px rgba(75,123,229,0.35)',
        position: 'relative' as const,
        overflow: 'hidden' as const,
      }}>
        <div style={{
          position: 'absolute' as const, right: -10, top: -10,
          fontSize: 140, opacity: 0.12, lineHeight: 1,
          pointerEvents: 'none' as const,
        }}>🎓</div>

        <div style={{ position: 'relative' as const, zIndex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, opacity: 0.7, marginBottom: 10 }}>
            Academia oficial SACS
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 12 }}>
            {ACADEMY_TOTAL_MODULES} módulos · {ACADEMY_TOTAL_TASKS} tareas · ~{totalHours}h de aprendizaje
          </div>
          <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.55, marginBottom: 22, maxWidth: 580 }}>
            Toda la operación de un negocio de retail con SACS, de cero a profesional.
            Cada módulo es una fase real del journey — del día 1 a la tienda en línea operando 24/7.
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

      {/* Journey timeline visual */}
      <JourneyTimeline />

      <h2 style={SS.h2}>El journey de tu cliente, módulo por módulo</h2>
      <p style={{ ...SS.leadSm, marginTop: -8 }}>
        Cada card muestra qué vive el cliente, qué resuelve y cómo lo puedes pitchear. Toca "Ver tareas" para el detalle.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 20 }}>
        {ACADEMY_MODULES.map(m => (
          <ModuleCard
            key={m.num}
            module={m}
            tasksOpen={!!expandedTasks[m.num]}
            onToggleTasks={() => toggleTasks(m.num)}
          />
        ))}
      </div>

      {/* Cierre — sugerencia partner */}
      <div style={{
        marginTop: 36,
        background: C.brandSoft,
        border: `1px solid ${C.brandTint}`,
        borderRadius: 14,
        padding: '24px 26px',
        display: 'flex', alignItems: 'flex-start', gap: 14,
      }}>
        <span style={{
          flexShrink: 0, width: 36, height: 36, borderRadius: 10,
          background: 'rgba(75,123,229,0.18)', color: C.brand,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon.Sparkle size={18} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.brandDark, marginBottom: 6 }}>
            Cómo usar esto al vender
          </div>
          <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.6 }}>
            Cuando tu prospecto pregunte <em>"¿es complicado migrarse?"</em>, ya tienes la respuesta del módulo 4.
            Cuando dude <em>"¿me sirve si solo vendo en tienda?"</em>, el módulo 5 le muestra el valor diario.
            Cuando diga <em>"luego pienso en tienda en línea"</em>, el módulo 6 le enseña que es un canal extra, no un proyecto aparte.
            Hablas con el contexto exacto del momento donde está su negocio.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Journey timeline visual ─────────────────────────────────
function JourneyTimeline() {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: '22px 24px',
      marginBottom: 36,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 16 }}>
        El journey en una mirada
      </div>
      <div style={{
        display: 'flex', alignItems: 'stretch',
        gap: 0, position: 'relative' as const,
      }}>
        {ACADEMY_MODULES.map((m, i) => (
          <div key={m.num} style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', position: 'relative' as const, minWidth: 0 }}>
            {/* Línea conectora */}
            {i < ACADEMY_MODULES.length - 1 && (
              <div style={{
                position: 'absolute' as const,
                top: 18, left: '50%', width: '100%', height: 2,
                background: `linear-gradient(90deg, ${m.color}, ${ACADEMY_MODULES[i + 1].color})`,
                opacity: 0.3, zIndex: 0,
              }} />
            )}
            {/* Círculo */}
            <div style={{
              position: 'relative' as const, zIndex: 1,
              width: 38, height: 38, borderRadius: '50%',
              background: m.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
              border: '3px solid #fff',
              boxShadow: `0 4px 10px -3px ${m.color}66`,
            }}>
              {m.num}
            </div>
            {/* Phase label */}
            <div style={{
              fontSize: 10, fontWeight: 700, color: m.color,
              marginTop: 10, textAlign: 'center' as const,
              letterSpacing: '0.04em', textTransform: 'uppercase' as const,
              lineHeight: 1.3,
              padding: '0 4px',
            }}>
              {m.phase}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Module card ─────────────────────────────────────────────
function ModuleCard({ module: m, tasksOpen, onToggleTasks }: {
  module: AcademyModule;
  tasksOpen: boolean;
  onToggleTasks: () => void;
}) {
  const totalMin = m.tasks.reduce((s, t) => s + (parseInt(t.time, 10) || 0), 0);

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      overflow: 'hidden' as const,
    }}>
      {/* Imagen ambiental */}
      <div style={{
        position: 'relative' as const,
        aspectRatio: '16 / 9',
        background: `linear-gradient(135deg, ${m.color}22, ${m.color}11)`,
        overflow: 'hidden' as const,
      }} className="academy-module-img-wrap">
        <img
          src={m.image}
          alt={`Módulo ${m.num}: ${m.name}`}
          loading="lazy"
          width={1600}
          height={900}
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover' as const,
            display: 'block',
          }}
          onError={(e) => {
            // Fallback visual elegante si la imagen no carga aún
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        {/* Overlay gradient inferior para legibilidad */}
        <div style={{
          position: 'absolute' as const, inset: 0,
          background: `linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55) 100%)`,
          pointerEvents: 'none' as const,
        }} />
        {/* Phase badge */}
        <div style={{
          position: 'absolute' as const,
          top: 16, left: 16,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(6px)',
          borderRadius: 999,
          fontSize: 11, fontWeight: 700,
          color: m.color,
          letterSpacing: '0.06em', textTransform: 'uppercase' as const,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color }} />
          {m.phase}
        </div>
        {/* Número módulo */}
        <div style={{
          position: 'absolute' as const,
          top: 16, right: 16,
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.92)',
          color: m.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
        }}>
          {m.num}
        </div>
        {/* Título en el bottom de la imagen */}
        <div style={{
          position: 'absolute' as const,
          bottom: 18, left: 20, right: 20,
          color: '#fff',
        }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>{m.emoji}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            {m.name}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '24px 26px' }}>
        <div style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.6, marginBottom: 22 }}>
          {m.description}
        </div>

        {/* Story de 3 partes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginBottom: 22 }}>
          <StoryRow
            label="Qué siente el cliente al llegar"
            text={m.clientStory.feeling}
            icon={<EmotionIcon />}
            accent={C.muted}
          />
          <StoryRow
            label="Qué consigue al terminar"
            text={m.clientStory.outcome}
            icon={<Icon.CheckCircle size={16} />}
            accent={C.green}
          />
          <StoryRow
            label="Cómo pitchearlo tú"
            text={m.clientStory.pitch}
            icon={<Icon.Sparkle size={16} />}
            accent={m.color}
          />
        </div>

        {/* Toggle de tareas */}
        <button onClick={onToggleTasks}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            background: tasksOpen ? `${m.color}10` : C.bg,
            border: `1px solid ${tasksOpen ? `${m.color}40` : C.border}`,
            borderRadius: 10,
            fontSize: 13, fontWeight: 600, color: C.text,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon.Activity size={14} color={m.color} />
            {tasksOpen ? 'Ocultar tareas' : 'Ver las ' + m.tasks.length + ' tareas del módulo'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>~{totalMin} min</span>
            <span style={{
              color: m.color,
              transform: tasksOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
              display: 'inline-flex',
            }}>
              <Icon.ArrowRight size={14} />
            </span>
          </span>
        </button>

        {/* Lista de tareas */}
        {tasksOpen && (
          <div style={{ marginTop: 12, paddingTop: 4 }}>
            {m.tasks.map((t, i) => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '14px 4px',
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
          </div>
        )}

        {/* CTA → academia */}
        <a
          href={ACADEMY_DEMO_URL}
          target="_blank" rel="noopener noreferrer"
          style={{
            marginTop: 16,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '11px 18px',
            background: m.color, color: '#fff',
            borderRadius: 10,
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          Ver módulo {m.num} en la academia <Icon.ArrowRight size={13} />
        </a>
      </div>
    </div>
  );
}

function StoryRow({ label, text, icon, accent }: {
  label: string;
  text: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div style={{
      display: 'flex', gap: 14, alignItems: 'flex-start',
      padding: '14px 16px',
      background: C.bg,
      border: `1px solid ${C.borderSoft}`,
      borderRadius: 12,
      borderLeft: `3px solid ${accent}`,
    }}>
      <span style={{
        flexShrink: 0, width: 28, height: 28, borderRadius: 8,
        background: `${accent}14`, color: accent,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
      }}>
        {icon}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: accent,
          letterSpacing: '0.06em', textTransform: 'uppercase' as const,
          marginBottom: 5,
        }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
          {text}
        </div>
      </div>
    </div>
  );
}

function EmotionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}
