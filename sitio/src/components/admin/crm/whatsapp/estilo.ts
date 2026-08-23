// WHATSAPP · El sistema visual del inbox (portado de sacs_inbox, medido del
// código): densidad 9-13px, radios 8/12/16/full, headers de 44px alineados.
//
// Colores por ROL — no por gusto:
//  - Morado del CRM (#9B8CFA/#5B4BD6): acento de UI (selección, foco, enviar).
//  - Emerald: identidad del canal WhatsApp (burbuja saliente, badge, checks).
//  - Azul info: canal correo. Ámbar: nota interna / ventana 24h. Rojo: error.
import type { CSSProperties } from 'react';

export const C = {
  morado: '#9B8CFA', moradoTinta: '#5B4BD6', moradoAgua: '#EEECFE', moradoSuave: '#f7f4ff',
  emerald600: '#059669', emerald500: '#10B981', emerald300: '#6EE7B7', emerald100: '#D1FAE5', emerald50: '#ECFDF5', emerald700: '#047857', wa: '#25D366',
  sky300: '#7DD3FC',
  azul: '#7DA6F5', azulTinta: '#2C5FC4', azulAgua: '#E3EDFD', azulBorde: '#cfdefa',
  ambar700: '#B45309', ambar500: '#F59E0B', ambar400: '#FBBF24', ambar300: '#FCD34D', ambar200: '#FDE68A', ambar100: '#FEF3C7', ambar50: '#FFFBEB',
  rojo700: '#B91C1C', rojo500: '#EF4444', rojo400: '#F87171', rojo300: '#FCA5A5', rojo200: '#FECACA', rojo50: '#FEF2F2',
  g50: '#F9FAFB', g100: '#F3F4F6', g200: '#E5E7EB', g300: '#D1D5DB', g400: '#9CA3AF', g500: '#6B7280', g700: '#374151', g900: '#111827',
};

/** Alturas/anchos del layout (px) — la firma del look. */
export const L = {
  header: 44,           // h-11: TODOS los headers de columna, alineados al píxel
  sidebar: 224,         // w-56
  sidebarColapsado: 64, // w-16
  lista: 300,           // cede 20px al detalle
  detalle: 400,         // los datos de Info necesitan aire (antes 288 → 340 → 400)
  railito: 44,          // w-11: barra de iconos del panel derecho
};

/** Label de sección: 10-11px, bold, gris, uppercase con tracking. */
export const label = (px = 11): CSSProperties => ({
  fontSize: px, fontWeight: 600, color: C.g400, textTransform: 'uppercase', letterSpacing: '.05em',
});

export const chipBase = (bg: string, fg: string, px = 9): CSSProperties => ({
  fontSize: px, fontWeight: 700, background: bg, color: fg, borderRadius: 999,
  padding: '2px 6px', whiteSpace: 'nowrap', display: 'inline-block', lineHeight: 1.4,
});

/** Botón de icono de toolbar: p-1.5, rounded-lg; activo con acento. */
export const toolBtn = (activo?: boolean, accent?: boolean): CSSProperties => ({
  border: 'none', background: activo ? C.moradoAgua : 'none', cursor: 'pointer',
  padding: 6, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: (activo || accent) ? C.moradoTinta : C.g400, fontFamily: 'inherit', flexShrink: 0,
});

/** Popup flotante del composer (bottom-full). */
export const popup = (w: number, left = 0): CSSProperties => ({
  position: 'absolute', bottom: '100%', marginBottom: 8, left, width: w, zIndex: 950,
  background: '#fff', border: `1px solid ${C.g200}`, borderRadius: 12,
  boxShadow: '0 12px 32px rgba(17,24,39,.14)', overflow: 'hidden',
});

/** Burbujas del hilo. */
export const burbuja = {
  salienteWa: {
    alignSelf: 'flex-end', maxWidth: 'min(70%, 560px)', background: C.emerald600, color: '#fff',
    borderRadius: '16px 16px 6px 16px', padding: '10px 16px', fontSize: 14, lineHeight: 1.5,
  } as CSSProperties,
  entrante: {
    alignSelf: 'flex-start', maxWidth: 'min(70%, 560px)', background: '#fff', color: C.g900,
    border: `1px solid ${C.g200}`, borderRadius: '16px 16px 16px 6px', padding: '10px 16px',
    fontSize: 14, lineHeight: 1.5,
  } as CSSProperties,
  correo: (saliente: boolean): CSSProperties => ({
    alignSelf: saliente ? 'flex-end' : 'flex-start', maxWidth: 'min(78%, 620px)', background: '#fff',
    color: C.g900, border: `1px solid ${C.azulBorde}`, borderRadius: 12, padding: '10px 14px',
    fontSize: 14, lineHeight: 1.55,
    [saliente ? 'borderRight' : 'borderLeft']: `3px solid ${C.azul}`,
  }),
  nota: {
    alignSelf: 'flex-end', maxWidth: '75%', width: '100%', background: C.ambar50,
    border: `2px solid ${C.ambar200}`, borderRadius: 12, padding: '12px 16px',
    fontSize: 13, color: '#7a5a15', lineHeight: 1.5,
  } as CSSProperties,
};

/** Separadores del hilo: día (claro) y conversación resuelta (oscuro con check). */
export const separador = (oscuro?: boolean): { linea: CSSProperties; chip: CSSProperties } => ({
  linea: { flex: 1, height: 1, background: oscuro ? C.g300 : C.g200 },
  chip: {
    fontSize: 11, fontWeight: 500, color: oscuro ? C.g500 : C.g400,
    background: oscuro ? C.g200 : C.g100, padding: '4px 12px', borderRadius: 999, whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', gap: 5,
  },
});

/** Spinner chico inline y mediano de columna. */
export const spinner = (px = 24, color = C.morado): CSSProperties => ({
  width: px, height: px, border: `2px solid ${color}`, borderTopColor: 'transparent',
  borderRadius: 999, animation: 'girar 1s linear infinite', display: 'inline-block',
});

/** CSS global del inbox (keyframes + scrollbars finos). Inyectar una vez. */
export const CSS_INBOX = `
.wa-citar{opacity:0;transition:opacity .15s}
@media (max-width:720px){.wa-solo-desktop{display:none!important}.wa-citar{opacity:1}}
@keyframes wa-pulso{0%,100%{opacity:1}50%{opacity:.3}}
.wa-pulso{animation:wa-pulso 1.2s infinite}
.wa-fila-accion{opacity:0;transition:opacity .15s}
.wa-fila-hover:hover .wa-fila-accion{opacity:1}
.wa-fila-accion:hover{background:#EEECFE;color:#5B4BD6}
.wa-msg:hover .wa-citar{opacity:1}

  @keyframes girar { to { transform: rotate(360deg); } }
  @keyframes pulso { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
  @keyframes ping { 75%,100% { transform: scale(2); opacity: 0; } }
  .wa-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
  .wa-scroll::-webkit-scrollbar-thumb { background: ${C.g200}; border-radius: 99px; }
  .wa-scroll::-webkit-scrollbar-thumb:hover { background: ${C.g300}; }
  .wa-hover-reveal { opacity: 0; max-height: 0; overflow: hidden; transition: all .15s ease; }
  .wa-grupo:hover .wa-hover-reveal { opacity: 1; max-height: 32px; }
  .wa-fila-hover:hover { background: ${C.g50}; }
  .wa-thumb { opacity: 0; transition: opacity .12s; }
  .wa-audio:hover .wa-thumb { opacity: 1; }
  .wa-x-hover { display: none; }
  .wa-staged:hover .wa-x-hover { display: flex; }
  mark.wa-mark { background: #FEF08A; color: #854D0E; border-radius: 3px; padding: 0 2px; }
`;

/** Hora relativa corta para la lista. */
/** "hace 2 h", "hace 3 d" — para textos corridos. */
export function haceCuanto(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'hace un momento';
  if (ms < 3_600_000) return `hace ${Math.floor(ms / 60_000)} min`;
  if (ms < 86_400_000) return `hace ${Math.floor(ms / 3_600_000)} h`;
  return `hace ${Math.floor(ms / 86_400_000)} d`;
}
export function horaRelativa(iso: string): string {
  const d = new Date(iso); const ms = Date.now() - d.getTime();
  if (ms < 60_000) return 'ahora';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min`;
  if (d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return 'ayer';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

export const etiquetaDia = (iso: string): string => {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return 'Hoy';
  if (d.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
};
