// Styles compartidos para las nuevas tabs del portal.
// Estética minimalista (Squarespace-like): mucho whitespace, tipografía display
// para hero stats, neutros con accent azul/verde para CTAs.

import type React from 'react';

export const C = {
  bg: '#fafafa',
  card: '#fff',
  border: '#f0f0ee',
  borderSoft: '#f5f5f3',
  text: '#1a1a1a',
  textSoft: '#555',
  muted: '#888',
  mutedLight: '#aaa',
  accent: '#4B7BE5',
  accentDark: '#3764c4',
  green: '#2AB5A0',
  greenDark: '#1A8F7A',
  amber: '#E8A838',
  purple: '#6C5CE7',
  red: '#c62828',
  gold: '#C8A55B',
};

export const SS: Record<string, React.CSSProperties> = {
  // Hero
  h1: { fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 500, margin: '0 0 12px', letterSpacing: '-0.028em', lineHeight: 1.1, color: C.text },
  h1Small: { fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 500, margin: '0 0 8px', letterSpacing: '-0.025em', lineHeight: 1.12, color: C.text },
  h2: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, margin: '56px 0 22px', letterSpacing: '-0.02em', color: C.text },
  h3: { fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 14px', letterSpacing: '-0.012em', color: C.text },
  lead: { fontSize: 16, color: C.muted, margin: '0 0 40px', lineHeight: 1.55, maxWidth: 600 },
  leadSm: { fontSize: 14, color: C.muted, margin: '0 0 24px', lineHeight: 1.55 },

  // Stat cards (4 across hero)
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 },
  statCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px 24px 22px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', position: 'relative' },
  statLabel: { fontSize: 11, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 600, marginBottom: 14 },
  statValue: { fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500, color: C.text, lineHeight: 1, letterSpacing: '-0.035em' },
  statValueSm: { fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, color: C.text, lineHeight: 1.05, letterSpacing: '-0.025em' },
  statHint: { fontSize: 13, color: C.mutedLight, marginTop: 10, lineHeight: 1.4 },
  statCta: { marginTop: 14, padding: 0, background: 'transparent', border: 'none', color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.005em' },

  // Generic card
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px 28px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  cardLg: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px 36px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  cardDark: { background: '#1a1a1a', color: '#fff', borderRadius: 16, padding: '28px 32px' },

  // Pipeline / kanban
  pipeRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 32 },
  pipeCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 18px 16px', cursor: 'pointer', transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' },
  pipeIcon: { fontSize: 20, marginBottom: 8, display: 'block' },
  pipeNum: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: C.text, lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 4 },
  pipeLbl: { fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em' },
  pipeSub: { fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.35 },

  // Activity feed
  feedItem: { display: 'flex', gap: 14, padding: '14px 0', borderBottom: `1px solid ${C.borderSoft}`, alignItems: 'flex-start' },
  feedDot: { flexShrink: 0, width: 8, height: 8, borderRadius: '50%', marginTop: 8 },
  feedText: { fontSize: 14, color: C.text, fontWeight: 500, lineHeight: 1.4 },
  feedDetail: { fontSize: 13, color: C.muted, marginTop: 3, lineHeight: 1.4 },
  feedWhen: { fontSize: 12, color: C.mutedLight, marginLeft: 'auto', flexShrink: 0, whiteSpace: 'nowrap' as const },

  // Link block
  linkBig: { background: C.text, color: '#fff', borderRadius: 16, padding: '28px 32px', marginBottom: 24 },
  linkUrl: { fontFamily: 'SF Mono, Courier New, monospace', fontSize: 17, marginBottom: 20, wordBreak: 'break-all' as const, lineHeight: 1.5, color: '#fff' },
  linkActions: { display: 'flex', flexWrap: 'wrap' as const, gap: 8 },

  // Buttons
  btn: { padding: '11px 18px', background: C.text, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.005em' },
  btnSm: { padding: '8px 14px', background: C.text, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost: { padding: '10px 14px', background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  btnDark: { padding: '11px 18px', background: 'rgba(255,255,255,0.10)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },

  // Progress bar
  bar: { position: 'relative', height: 10, background: '#f0f0ee', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', background: 'linear-gradient(90deg, #6CD6C2 0%, #4B7BE5 100%)', borderRadius: 999, transition: 'width 0.6s ease-out' },

  // Tags / pills
  pill: { display: 'inline-block', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' },

  // Tabular
  tableWrap: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', overflowX: 'auto' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
  th: { textAlign: 'left' as const, padding: '14px 22px', fontWeight: 600, color: C.muted, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.1em', borderBottom: `1px solid ${C.border}`, background: '#fafafa' },
  td: { padding: '16px 22px', borderBottom: `1px solid ${C.borderSoft}`, verticalAlign: 'top' as const, fontSize: 14, color: C.text },

  // Drawer
  drawer: { position: 'fixed' as const, top: 0, right: 0, height: '100vh', width: 'min(480px, 100vw)', background: C.card, boxShadow: '-12px 0 36px -8px rgba(0,0,0,0.18)', zIndex: 200, overflowY: 'auto' as const, padding: '32px 32px 48px' },
  drawerBackdrop: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 199 },

  // Empty state
  empty: { padding: '36px 28px', background: C.card, border: `1px dashed ${C.border}`, borderRadius: 14, color: C.muted, textAlign: 'center' as const, fontSize: 14, lineHeight: 1.5 },
  emptyHint: { padding: 24, background: 'linear-gradient(120deg, rgba(75,123,229,0.05), rgba(108,92,231,0.04))', border: `1px solid rgba(75,123,229,0.16)`, borderRadius: 14, fontSize: 14, color: '#444', lineHeight: 1.55, marginBottom: 32 },

  // Note
  note: { padding: '14px 20px', background: 'rgba(75,123,229,0.04)', borderRadius: 10, fontSize: 13, color: C.textSoft, lineHeight: 1.6 },

  // Loading
  loading: { padding: 40, color: C.muted, textAlign: 'center' as const, fontSize: 14 },
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
