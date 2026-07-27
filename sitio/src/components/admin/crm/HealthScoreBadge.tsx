import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { HEALTH_FACTOR_LABELS, HEALTH_FACTOR_MAX } from '../../../lib/crm/health';

// Formato LEGACY (fórmula v1, aún guardado en companies no re-sincronizadas):
// claves recencia/tendencia/modulos/equipo con máximos 40/25/20/15. Se detecta
// por la presencia de 'modulos' y se muestra con SUS máximos para no mentir.
const LEGACY_LABELS: Record<string, string> = { recencia: 'Ventas recientes', tendencia: 'Tendencia 30d', modulos: 'Módulos activos', equipo: 'Equipo operando' };
const LEGACY_MAX: Record<string, number> = { recencia: 40, tendencia: 25, modulos: 20, equipo: 15 };

interface Props {
  score: number | null | undefined;
  factors?: any;
  computed_at?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export default function HealthScoreBadge({ score, factors, computed_at, size = 'md' }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const s = typeof score === 'number' ? score : null;

  // Cerrar al tocar fuera (móvil: no hay mouseleave). Solo mientras está abierto.
  useEffect(() => {
    if (!showTooltip) return;
    const onDoc = (e: Event) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowTooltip(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('touchstart', onDoc); };
  }, [showTooltip]);

  // Clamp del popover al viewport: si se sale por la derecha (card pegada al
  // borde) lo corremos a la izquierda; si entonces se sale por la izquierda, lo
  // pineamos al margen. Imperativo para no re-renderizar en bucle.
  useLayoutEffect(() => {
    const pop = popRef.current;
    if (!showTooltip || !pop) return;
    const margin = 8;
    pop.style.left = '0px'; pop.style.right = 'auto';
    let rect = pop.getBoundingClientRect();
    if (rect.right > window.innerWidth - margin) {
      pop.style.left = `${-(rect.right - (window.innerWidth - margin))}px`;
      rect = pop.getBoundingClientRect();
    }
    if (rect.left < margin) pop.style.left = `${parseFloat(pop.style.left || '0') + (margin - rect.left)}px`;
  }, [showTooltip]);
  const dim = size === 'lg' ? 56 : size === 'sm' ? 32 : 44;
  const fontSize = size === 'lg' ? '1.125rem' : size === 'sm' ? '0.75rem' : '0.9375rem';

  if (s === null) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: dim, height: dim, borderRadius: '50%', background: '#f5f5f5', border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize, fontWeight: 700 }}>—</div>
        <span style={{ fontSize: '0.6875rem', color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sin calcular</span>
      </div>
    );
  }

  const color = s >= 70 ? '#2e7d32' : s >= 40 ? '#e65100' : '#c62828';
  const bg = s >= 70 ? '#e8f5e9' : s >= 40 ? '#fff3e0' : '#ffebee';
  const label = s >= 70 ? 'Saludable' : s >= 40 ? 'Atención' : 'En riesgo';

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}
      onPointerEnter={e => { if (e.pointerType === 'mouse') setShowTooltip(true); }}
      onPointerLeave={e => { if (e.pointerType === 'mouse') setShowTooltip(false); }}>
      <div
        onClick={(e) => { e.stopPropagation(); setShowTooltip(v => !v); }}
        style={{
          width: dim, height: dim, borderRadius: '50%',
          background: bg,
          border: `2px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, fontSize, fontWeight: 800,
          cursor: 'pointer', flexShrink: 0,
        }}>
        {s}
      </div>
      <div>
        <div style={{ fontSize: '0.6875rem', color: '#aaa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Health</div>
        <div style={{ fontSize: '0.8125rem', color, fontWeight: 700 }}>{label}</div>
      </div>

      {showTooltip && factors && (
        <div ref={popRef} onClick={(e) => e.stopPropagation()} style={{
          position: 'absolute', top: dim + 8, left: 0,
          background: '#1a1a1a', color: '#fff',
          borderRadius: 8, padding: 12, width: 260, maxWidth: 'calc(100vw - 16px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          zIndex: 600,
          fontSize: '0.75rem',
        }}>
          <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>Desglose</div>
          {(() => {
            const legacy = 'modulos' in (factors || {});
            const LBL = legacy ? LEGACY_LABELS : HEALTH_FACTOR_LABELS;
            const MAXES = legacy ? LEGACY_MAX : HEALTH_FACTOR_MAX;
            return Object.keys(LBL).map(key => ({ key, LBL, MAXES }));
          })().map(({ key, LBL, MAXES }) => {
            const FACTOR_LABELS = LBL, FACTOR_MAX = MAXES;
            const v = factors[key] || 0;
            const max = FACTOR_MAX[key] || 10;
            const pct = Math.min(100, (v / max) * 100);
            return (
              <div key={key} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>{FACTOR_LABELS[key]}</span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{v}/{max}</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: '#2AB5A0', borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
          {computed_at && (
            <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.4)', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              Calculado: {new Date(computed_at).toLocaleDateString('es-MX')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
