// Styles compartidos para las nuevas tabs del portal.
// Estética minimalista Squareup-inspired: whitespace generoso, azul SACS como
// protagonista en CTAs y heros (no negros), tipografía display para hero stats,
// neutros con accent azul/verde para acciones secundarias.

import type React from 'react';

export const C = {
  bg: '#fafafa',
  card: '#fff',
  border: '#ececec',
  borderSoft: '#f5f5f3',
  text: '#1a1a1a',
  textSoft: '#404040',
  muted: '#737373',
  mutedLight: '#a3a3a3',

  // Brand SACS — azul protagonista
  brand: '#4B7BE5',
  brandDark: '#3764C4',
  brandSoft: '#EEF2FB',
  brandSoftHover: '#E2EAFA',
  brandTint: 'rgba(75,123,229,0.10)',

  // Aliases retrocompat (mantener para no romper imports)
  accent: '#4B7BE5',
  accentDark: '#3764C4',

  // Otros accents semánticos
  green: '#2AB5A0',
  greenDark: '#1A8F7A',
  amber: '#E8A838',
  purple: '#6C5CE7',
  red: '#c62828',
  gold: '#C8A55B',

  // Slate para superficies oscuras (no negro puro)
  slate: '#1E293B',
  slateDeep: '#0F172A',
};

export const SS: Record<string, React.CSSProperties> = {
  // Hero typography
  h1: { fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 500, margin: '0 0 14px', letterSpacing: '-0.028em', lineHeight: 1.1, color: C.text },
  h1Small: { fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500, margin: '0 0 10px', letterSpacing: '-0.025em', lineHeight: 1.12, color: C.text },
  h2: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, margin: '64px 0 24px', letterSpacing: '-0.02em', color: C.text },
  h3: { fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 14px', letterSpacing: '-0.012em', color: C.text },
  lead: { fontSize: 16, color: C.muted, margin: '0 0 44px', lineHeight: 1.6, maxWidth: 620 },
  leadSm: { fontSize: 14, color: C.muted, margin: '0 0 28px', lineHeight: 1.6 },

  // Stat cards (más respiración)
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 },
  statCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 28px 26px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', position: 'relative' },
  statLabel: { fontSize: 11, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 600, marginBottom: 16 },
  statValue: { fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500, color: C.text, lineHeight: 1, letterSpacing: '-0.035em' },
  statValueSm: { fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, color: C.text, lineHeight: 1.05, letterSpacing: '-0.025em' },
  statHint: { fontSize: 13, color: C.mutedLight, marginTop: 12, lineHeight: 1.45 },
  statCta: { marginTop: 16, padding: 0, background: 'transparent', border: 'none', color: C.brand, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.005em' },

  // Generic cards (más padding)
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 32px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  cardLg: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '36px 40px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },

  // Pipeline / kanban
  pipeRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 36 },
  pipeCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 22px 20px', cursor: 'pointer', transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  pipeIcon: { fontSize: 20, marginBottom: 10, display: 'block' },
  pipeNum: { fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 500, color: C.text, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 6 },
  pipeLbl: { fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
  pipeSub: { fontSize: 12, color: C.muted, marginTop: 7, lineHeight: 1.4 },

  // Activity feed
  feedItem: { display: 'flex', gap: 14, padding: '16px 0', borderBottom: `1px solid ${C.borderSoft}`, alignItems: 'flex-start' },
  feedDot: { flexShrink: 0, width: 8, height: 8, borderRadius: '50%', marginTop: 8 },
  feedText: { fontSize: 14, color: C.text, fontWeight: 500, lineHeight: 1.45 },
  feedDetail: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.45 },
  feedWhen: { fontSize: 12, color: C.mutedLight, marginLeft: 'auto', flexShrink: 0, whiteSpace: 'nowrap' as const },

  // Link block — azul SACS solid (no negro)
  linkBig: { background: C.brand, color: '#fff', borderRadius: 18, padding: '32px 36px', marginBottom: 28, boxShadow: '0 12px 32px -16px rgba(75,123,229,0.35)' },
  linkUrl: { fontFamily: 'SF Mono, Courier New, monospace', fontSize: 17, marginBottom: 22, wordBreak: 'break-all' as const, lineHeight: 1.5, color: '#fff' },
  linkActions: { display: 'flex', flexWrap: 'wrap' as const, gap: 10 },

  // Buttons — PRIMARIO ES AZUL SACS
  btn: { padding: '12px 20px', background: C.brand, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.005em', transition: 'background 0.15s' },
  btnSm: { padding: '8px 14px', background: C.brand, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost: { padding: '11px 16px', background: '#fff', color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s, border-color 0.15s' },
  btnDark: { padding: '11px 18px', background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.28)', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },

  // Progress bar
  bar: { position: 'relative', height: 10, background: '#f0f0ee', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', background: `linear-gradient(90deg, #6CD6C2 0%, ${C.brand} 100%)`, borderRadius: 999, transition: 'width 0.6s ease-out' },

  // Tags / pills
  pill: { display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' },

  // Tabular
  tableWrap: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', overflowX: 'auto' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
  th: { textAlign: 'left' as const, padding: '16px 22px', fontWeight: 600, color: C.muted, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.1em', borderBottom: `1px solid ${C.border}`, background: '#fafafa' },
  td: { padding: '18px 22px', borderBottom: `1px solid ${C.borderSoft}`, verticalAlign: 'top' as const, fontSize: 14, color: C.text },

  // Drawer
  drawer: { position: 'fixed' as const, top: 0, right: 0, height: '100vh', width: 'min(520px, 100vw)', background: C.card, boxShadow: '-12px 0 36px -8px rgba(0,0,0,0.18)', zIndex: 200, overflowY: 'auto' as const, padding: '36px 36px 56px' },
  drawerBackdrop: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 199 },

  // Empty state
  empty: { padding: '40px 32px', background: C.card, border: `1px dashed ${C.border}`, borderRadius: 14, color: C.muted, textAlign: 'center' as const, fontSize: 14, lineHeight: 1.6 },
  emptyHint: { padding: 28, background: C.brandSoft, border: `1px solid ${C.brandTint}`, borderRadius: 14, fontSize: 14, color: C.textSoft, lineHeight: 1.6, marginBottom: 32 },

  // Note
  note: { padding: '16px 22px', background: C.brandSoft, borderRadius: 12, fontSize: 13, color: C.textSoft, lineHeight: 1.65 },

  // Loading
  loading: { padding: 48, color: C.muted, textAlign: 'center' as const, fontSize: 14 },
};

// Stage pill helper
export function stagePillStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    color,
    background: `${color}1a`,
  };
}
