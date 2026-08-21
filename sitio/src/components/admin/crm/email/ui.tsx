// Piezas compartidas de la sección Email. Viven aparte porque las usan las
// seis pantallas y duplicarlas garantizaría que se separen con el tiempo.
import type { CSSProperties, ReactNode } from 'react';
import CargandoBase from '../ui/Cargando';

/**
 * Estilo de foco para teclado. Los navegadores lo quitan cuando se define un
 * borde propio, y sin él quien navega con Tab no ve dónde está parado.
 */
export const FOCO = `
  .em-sec button:focus-visible, .em-sec input:focus-visible,
  .em-sec select:focus-visible, .em-sec textarea:focus-visible, .em-sec a:focus-visible {
    outline: 2px solid #9B8CFA; outline-offset: 2px; border-radius: 8px;
  }
  .em-sec input:focus, .em-sec textarea:focus, .em-sec select:focus { border-color: #9B8CFA; }
  @media (prefers-reduced-motion: reduce) { .em-sec * { transition: none !important; animation: none !important; } }
`;

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

/** El mismo gesto que el resto del CRM: los tres corazones. Se conserva la
 *  firma `que` para no tocar los veinte lugares que ya la llaman. */
export function Cargando({ que = 'datos' }: { que?: string }) {
  return <CargandoBase texto={`Cargando ${que}…`} />;
}

/**
 * Copiar al portapapeles CON acuse. Un botón "Copiar" que no cambia a nada
 * deja a la persona sin saber si funcionó, y termina copiando tres veces.
 */
export function BotonCopiar({ texto, etiqueta = 'Copiar', estilo }: { texto: string; etiqueta?: string; estilo?: CSSProperties }) {
  const [copiado, setCopiado] = useEstado(false);
  return (
    <button style={{ ...S.btnG, ...(estilo || {}), color: copiado ? '#1E8A63' : undefined, borderColor: copiado ? '#c5e8d8' : undefined }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(texto); } catch { return; }
        setCopiado(true); setTimeout(() => setCopiado(false), 1600);
      }}>
      {copiado ? '✓ Copiado' : etiqueta}
    </button>
  );
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

// ── Diálogos propios ───────────────────────────────────────────────────
//
// Reemplazan a prompt/alert/confirm del navegador. No es solo estética: los
// nativos no se pueden diseñar, dicen "www.sacscloud.com dice" encima del
// texto, bloquean toda la pestaña, y en móvil se ven como una alerta de
// sistema. Un producto que le pide a alguien confirmar el envío a 200
// personas no puede pedirlo con la misma caja con la que un banner pide
// aceptar cookies.

import { useEffect, useRef, useState as useEstado } from 'react';

export function Modal({ titulo, sub, ancho = 440, onCerrar, children, pie }: {
  titulo: string; sub?: string; ancho?: number; onCerrar: () => void;
  children?: ReactNode; pie?: ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);

  // Escape cierra, y el foco entra al diálogo: sin esto el teclado se queda
  // atrás, en la pantalla que quedó tapada.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', h);
    caja.current?.querySelector<HTMLElement>('input,textarea,button')?.focus();
    return () => window.removeEventListener('keydown', h);
  }, [onCerrar]);

  return (
    <div role="dialog" aria-modal="true" aria-label={titulo}
      onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.38)', zIndex: 970,
               display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div ref={caja} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)',
                               width: ancho, maxWidth: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>{titulo}</h3>
            {sub && <div style={{ fontSize: '0.74rem', color: '#8a8a8a', marginTop: 2, lineHeight: 1.5 }}>{sub}</div>}
          </div>
          <button onClick={onCerrar} aria-label="Cerrar"
            style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 2 }}>✕</button>
        </div>
        {children && <div style={{ padding: '16px 18px', overflowY: 'auto' }}>{children}</div>}
        {pie && <div style={{ padding: '12px 18px', borderTop: '1px solid #f0eff3', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{pie}</div>}
      </div>
    </div>
  );
}

/** Confirmación. `peligro` cambia el color del botón, no solo el texto. */
export function Confirmar({ titulo, mensaje, detalle, confirmar = 'Confirmar', peligro, onSi, onNo }: {
  titulo: string; mensaje: ReactNode; detalle?: ReactNode; confirmar?: string; peligro?: boolean;
  onSi: () => void; onNo: () => void;
}) {
  return (
    <Modal titulo={titulo} onCerrar={onNo} ancho={430}
      pie={<>
        <button onClick={onSi} style={{ ...S.btnP, background: peligro ? '#C0554E' : '#9B8CFA' }}>{confirmar}</button>
        <button onClick={onNo} style={S.btnG}>Cancelar</button>
      </>}>
      <div style={{ fontSize: '0.86rem', lineHeight: 1.6 }}>{mensaje}</div>
      {detalle && <div style={{ fontSize: '0.76rem', color: '#8a8a8a', marginTop: 10, lineHeight: 1.55 }}>{detalle}</div>}
    </Modal>
  );
}

/** Pide un texto. Sustituye a prompt(): valida antes de dejar continuar. */
export function PedirTexto({ titulo, sub, etiqueta, valorInicial = '', marcador, tipo = 'text', boton = 'Guardar', validar, onOk, onCancelar }: {
  titulo: string; sub?: string; etiqueta: string; valorInicial?: string; marcador?: string;
  tipo?: string; boton?: string; validar?: (v: string) => string | null;
  onOk: (v: string) => void; onCancelar: () => void;
}) {
  const [v, setV] = useEstado(valorInicial);
  const [err, setErr] = useEstado<string | null>(null);

  const enviar = () => {
    const limpio = v.trim();
    const problema = validar ? validar(limpio) : (limpio ? null : 'Escribe algo para continuar.');
    if (problema) { setErr(problema); return; }
    onOk(limpio);
  };

  return (
    <Modal titulo={titulo} sub={sub} onCerrar={onCancelar} ancho={430}
      pie={<>
        <button onClick={enviar} style={S.btnP}>{boton}</button>
        <button onClick={onCancelar} style={S.btnG}>Cancelar</button>
      </>}>
      <span style={S.lbl}>{etiqueta}</span>
      <input type={tipo} value={v} placeholder={marcador} style={S.inp} autoFocus
        onChange={e => { setV(e.target.value); setErr(null); }}
        onKeyDown={e => { if (e.key === 'Enter') enviar(); }} />
      {err && <div style={{ fontSize: '0.76rem', color: '#C0554E', marginTop: 7 }}>{err}</div>}
    </Modal>
  );
}

/** Elegir entre opciones. Sustituye al prompt con lista numerada. */
export function Elegir<T>({ titulo, sub, opciones, onElegir, onCancelar }: {
  titulo: string; sub?: string;
  opciones: Array<{ id: string; nombre: string; detalle?: string; valor: T }>;
  onElegir: (v: T) => void; onCancelar: () => void;
}) {
  return (
    <Modal titulo={titulo} sub={sub} onCerrar={onCancelar} ancho={480}
      pie={<button onClick={onCancelar} style={S.btnG}>Cancelar</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {opciones.map(o => (
          <button key={o.id} onClick={() => onElegir(o.valor)}
            style={{ border: '1px solid #e2e4e9', borderRadius: 10, padding: '12px 14px', background: '#fff',
                     textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#c9bcf7'; e.currentTarget.style.background = '#faf8ff'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e4e9'; e.currentTarget.style.background = '#fff'; }}>
            <div style={{ fontSize: '0.87rem', fontWeight: 700 }}>{o.nombre}</div>
            {o.detalle && <div style={{ fontSize: '0.74rem', color: '#8a8a8a', marginTop: 2 }}>{o.detalle}</div>}
          </button>
        ))}
      </div>
    </Modal>
  );
}
