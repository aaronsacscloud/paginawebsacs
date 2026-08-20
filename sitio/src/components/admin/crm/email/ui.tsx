// Piezas compartidas de la sección Email. Viven aparte porque las usan las
// seis pantallas y duplicarlas garantizaría que se separen con el tiempo.
import type { CSSProperties, ReactNode } from 'react';

export const S = {
  wrap: { maxWidth: 1280, margin: '0 auto', padding: 24 } as CSSProperties,
  card: { background: '#fff', border: '1px solid #eeeef1', borderRadius: 12, padding: '16px 18px' } as CSSProperties,
  kl: { fontSize: '0.6rem', fontWeight: 800, color: '#a5a2af', textTransform: 'uppercase', letterSpacing: '.06em' } as CSSProperties,
  kv: { fontSize: '1.75rem', fontWeight: 800, marginTop: 5, letterSpacing: '-.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' } as CSSProperties,
  ks: { fontSize: '0.7rem', color: '#8a8a8a', marginTop: 5, lineHeight: 1.45 } as CSSProperties,
  th: { fontSize: '0.56rem', fontWeight: 800, color: '#b3b1bb', textTransform: 'uppercase', letterSpacing: '.07em', textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #f0eff3' } as CSSProperties,
  td: { padding: '11px 10px', fontSize: '0.79rem', borderBottom: '1px solid #f7f6fa', verticalAlign: 'middle' } as CSSProperties,
  btnP: { border: 'none', borderRadius: 9, padding: '8px 15px', background: '#9B8CFA', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as CSSProperties,
  btnA: { border: '1.5px solid #7DA6F5', borderRadius: 9, padding: '7px 13px', background: '#fff', fontSize: '0.77rem', fontWeight: 700, color: '#2C5FC4', cursor: 'pointer', fontFamily: 'inherit' } as CSSProperties,
  btnG: { border: '1px solid #e2e4e9', borderRadius: 9, padding: '7px 13px', background: '#fff', fontSize: '0.77rem', fontWeight: 600, color: '#555', cursor: 'pointer', fontFamily: 'inherit' } as CSSProperties,
  inp: { border: '1.5px solid #e4dffb', borderRadius: 9, padding: '9px 12px', fontSize: '0.82rem', background: '#fdfcff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' } as CSSProperties,
  lbl: { fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: 4, display: 'block' } as CSSProperties,
};

export const chip = (on: boolean): CSSProperties => ({
  border: '1px solid', borderColor: on ? '#c9bcf7' : '#e2e4e9', background: on ? '#f7f4ff' : '#fff',
  color: on ? '#5B4BD6' : '#555', borderRadius: 9, padding: '7px 12px', fontSize: '0.77rem',
  fontWeight: on ? 700 : 600, cursor: 'pointer', fontFamily: 'inherit',
});

export const TONO: Record<string, { bg: string; fg: string }> = {
  ok: { bg: '#EAF8F2', fg: '#1E8A63' },
  info: { bg: '#E3EDFD', fg: '#2C5FC4' },
  acento: { bg: '#EEECFE', fg: '#5B4BD6' },
  aviso: { bg: '#FFF6E3', fg: '#9A6B15' },
  malo: { bg: '#FEF0EF', fg: '#C0554E' },
  gris: { bg: '#f4f4f6', fg: '#6B7280' },
};

export function Tag({ tono = 'gris', children }: { tono?: keyof typeof TONO | string; children: ReactNode }) {
  const t = TONO[tono] || TONO.gris;
  return <span style={{ fontSize: '0.57rem', fontWeight: 800, background: t.bg, color: t.fg, borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap' }}>{children}</span>;
}

export function Kpi({ etiqueta, valor, sub, tono }: { etiqueta: string; valor: ReactNode; sub?: ReactNode; tono?: string }) {
  return (
    <div style={S.card}>
      <div style={S.kl}>{etiqueta}</div>
      <div style={{ ...S.kv, color: tono ? TONO[tono]?.fg : '#1a1a1a' }}>{valor}</div>
      {sub && <div style={S.ks}>{sub}</div>}
    </div>
  );
}

/** Aviso con jerarquía: lo urgente se ve distinto de lo informativo. */
export function Aviso({ tono = 'aviso', titulo, children, accion }: { tono?: string; titulo?: string; children: ReactNode; accion?: ReactNode }) {
  const t = TONO[tono] || TONO.aviso;
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.fg}33`, borderRadius: 11, padding: '11px 14px', display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
      <div style={{ flex: 1, fontSize: '0.79rem', color: t.fg, lineHeight: 1.55 }}>
        {titulo && <div style={{ fontWeight: 800, marginBottom: 2 }}>{titulo}</div>}
        {children}
      </div>
      {accion}
    </div>
  );
}

/** Estado vacío con UNA acción: dos opciones en una pantalla vacía es ninguna. */
export function Vacio({ titulo, texto, accion }: { titulo: string; texto: string; accion?: ReactNode }) {
  return (
    <div style={{ ...S.card, textAlign: 'center', padding: '44px 24px' }}>
      <div style={{ fontSize: '0.98rem', fontWeight: 800, marginBottom: 6 }}>{titulo}</div>
      <div style={{ fontSize: '0.82rem', color: '#8a8a8a', maxWidth: 420, margin: '0 auto 16px', lineHeight: 1.6 }}>{texto}</div>
      {accion}
    </div>
  );
}

export function Cargando({ que = 'datos' }: { que?: string }) {
  return <div style={{ padding: 40, textAlign: 'center', color: '#a5a2af', fontSize: '0.85rem' }}>Cargando {que}…</div>;
}

export const fmtFecha = (d?: string | null) =>
  d ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
export const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
export const pct = (n?: number | null) => `${Number(n || 0).toFixed(1)}%`;

/** Motivos de rechazo en palabras: "presion" no le dice nada a nadie. */
export const MOTIVO: Record<string, string> = {
  suprimido: 'Se dio de baja o rebotó',
  presion: 'Ya recibió el máximo de la semana',
  presion_empresa: 'Otro contacto de su empresa ya lo recibió',
  role_account: 'Buzón de función (info@, ventas@…)',
  email_invalido: 'El correo no es válido',
  limite_diario: 'Se alcanzó el límite del día',
  sin_configurar: 'Falta configuración de correo',
  error_proveedor: 'El proveedor rechazó el envío',
  'campaña cancelada': 'La campaña se canceló',
};
