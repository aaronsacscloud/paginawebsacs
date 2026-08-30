// WHATSAPP · El sistema visual del inbox (portado de sacs_inbox, medido del
// código): densidad 9-13px, radios 8/12/16/full, headers de 44px alineados.
//
// Colores por ROL — no por gusto:
//  - Morado del CRM (#9B8CFA/#5B4BD6): acento de UI (selección, foco, enviar).
//  - Emerald: identidad del canal WhatsApp (burbuja saliente, badge, checks).
//  - Azul info: canal correo. Ámbar: nota interna / ventana 24h. Rojo: error.
import type { CSSProperties } from 'react';

export const C = {
  morado: '#5B4BD6', moradoTinta: '#5B4BD6', moradoAgua: '#EEECFE', moradoSuave: '#f7f4ff',
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

/**
 * Popup flotante del composer (bottom-full).
 *
 * El `left` está pensado para escritorio: dice bajo qué icono de la barra cae
 * el popup. En 390 px eso se rompe solo —snippets abría en left 88 con 320 de
 * ancho y su borde derecho caía en 395, fuera de la pantalla y sin scroll que
 * lo alcanzara—. En el teléfono no se intenta corregir el `left`: se le da al
 * popup TODO el ancho del composer, con la clase `wa-pop` (la regla vive junto
 * al resto del móvil, en CrmDashboard). Recortar el left con calc(100vw…) no
 * funciona —el offset se mide contra la barra, no contra la pantalla, así que
 * el número queda corrido por el padding: medido, seguía saliéndose 5 px—.
 * Quien use esta función DEBE poner también className="wa-pop".
 */
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
/* Un mensaje que NO salió tiene que verse como tal, en teléfono y en
   escritorio: a 10 px, el aviso y «Reintentar» se leían igual que la hora y
   se pasaban de largo. */
.wa-fallo .wa-err-msg { font-size: 12px; font-weight: 600; }
.wa-fallo button { min-height: 30px; font-size: 12px; padding: 0 12px; }

  /* ══ Hilo móvil v5: burbujas gris/morado (la referencia manda), sin verdes.
     Los estilos de burbuja son inline: se pisan por atributo. ══ */
  .wa-hilo-m [style*="border-radius: 16px 16px 6px"] { background: #EEECFE !important; color: #1a1a1a !important; border-radius: 18px 18px 6px 18px !important; }
  .wa-hilo-m [style*="border-radius: 16px 16px 16px 6px"] { background: #f2f2f5 !important; border-color: transparent !important; border-radius: 18px 18px 18px 6px !important; }
  .wa-hilo-m [style*="rgb(167, 243, 208)"], .wa-hilo-m [style*="#A7F3D0"] { color: #6B7280 !important; border-left-color: #c9c2f2 !important; }
  .wa-hilo-m [style*="border-radius: 16px 16px 6px"] [style*="rgb(248, 113, 113)"] { color: #DC2626 !important; }
  .wa-hilo-m .wa-citar { display: none !important; }
  /* Sobre burbuja clara, los links y botones "claros" de plantilla se re-tintan */
  .wa-hilo-m [style*="border-radius: 16px 16px 6px"] a { color: #5B4BD6 !important; }
  .wa-hilo-m [style*="border-radius: 16px 16px 6px"] [style*="rgba(255, 255, 255, 0.18)"] { background: rgba(91, 75, 214, 0.10) !important; color: #5B4BD6 !important; }
  .wa-hilo-m [style*="border-radius: 16px 16px 6px"] mark { background: #ddd6fb; }
  /* La banda global ya explica el error: la leyenda repetida por mensaje sobra en el teléfono */
  .wa-hilo-m .wa-err-msg { display: none !important; }
  .wa-hilo-m .wa-err-cola { display: inline !important; font-size: 11.5px !important; }
  /* El fallo cuelga del mensaje, y el mensaje es tuyo: va a la derecha. Y el
     botón se toca con el dedo, así que 44. */
  .wa-hilo-m .wa-fallo { justify-content: flex-end; text-align: right; }
  .wa-hilo-m .wa-fallo button { min-height: 44px !important; padding: 0 16px !important; }
  /* Atajos de plantilla: en el teléfono se tocan con el dedo */
  /* En el teléfono los nombres van completos: si no caben en un renglón,
     bajan al siguiente. Cortados a media palabra no dicen cuál es cuál. */
  .wa-hilo-m .wa-recientes { flex-wrap: wrap !important; overflow: visible; padding-right: 0; }
  .wa-hilo-m .wa-recientes button { flex: 1 1 auto !important; max-width: 100% !important; }
  .wa-hilo-m .wa-recientes button { min-height: 44px !important; font-size: 12.5px !important; padding: 0 14px !important; flex: none; }
  /* Ventana de 24h cerrada: la franja ámbar + "Enviar plantilla" bastan; el campo muerto solo gasta pantalla */
  .wa-hilo-m textarea[disabled] { display: none !important; }
  /* URLs largas dentro de burbuja: una línea con ellipsis (el href queda completo) */
  .wa-hilo-m [style*="border-radius: 16px 16px 6px"] a { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
  /* El menú ⋮ con presencia y área táctil de header */
  .wa-hilo-m [title="Más acciones"] { color: #111827 !important; padding: 10px !important; }
  .wa-hilo-m [title="Más acciones"] svg { width: 20px; height: 20px; }
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
/* La hoja del menú del hilo se toca con el pulgar: 48 px por renglón. Los
   botones venían a 41 (padding + tipografía) y quedaban bajo el estándar. */
.menu-hoja button{min-height:48px}

/* Marca de nota interna en la fila (E8.1). Discreta a propósito: informa, no
   compite con el punto de «te toca contestar». */
.m-nota{flex:none;font-size:9.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  color:#7a7690;background:#f1f0f5;border-radius:999px;padding:1px 6px;line-height:1.5}
html[data-crm-dark="1"] .m-nota{color:#a5a2b5;background:#2b2b33}

/* «N mensajes nuevos»: aparece pegado al fondo del hilo cuando llega algo
   mientras lees hacia arriba (E6.2). */
.wa-bajar{position:absolute;left:50%;transform:translateX(-50%);bottom:96px;z-index:40;
  border:1px solid #c9bcf7;background:#fff;color:#5B4BD6;border-radius:999px;
  min-height:36px;padding:0 16px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;
  box-shadow:0 6px 20px rgba(20,18,40,.14)}
html[data-crm-dark="1"] .wa-bajar{background:#232329;border-color:#3a3550;color:#A78BFA}

/* Atajos de «últimas plantillas usadas»: una sola línea que se desliza, en
   móvil y en escritorio. Apilados hacían crecer la barra ámbar el doble. */
.wa-recientes{flex-wrap:nowrap!important;overflow-x:auto;scrollbar-width:none;padding-right:16px}
.wa-recientes::-webkit-scrollbar{display:none}
.wa-recientes button{flex:none}
/* Aire al final del carrusel: sin esto el último atajo queda rebanado por el
   marco, que se lee como un corte y no como «hay más». */
.wa-recientes::after{content:'';flex:none;width:8px}

/* ── Aviso de mensaje entrante (E2.2) ── */
.wa-aviso{position:fixed;z-index:60;right:20px;bottom:20px;max-width:340px;display:flex;align-items:stretch;gap:0;
  background:#fff;border:1px solid #e6e5ec;border-radius:14px;box-shadow:0 8px 28px rgba(20,18,40,.16);overflow:hidden;
  animation:wa-aviso-in .18s ease-out}
.wa-aviso-m{right:12px;left:12px;bottom:auto;top:calc(8px + env(safe-area-inset-top));max-width:none}
.wa-aviso-ir{flex:1;min-width:0;display:flex;align-items:center;gap:10px;padding:11px 4px 11px 14px;min-height:56px;
  border:none;background:none;cursor:pointer;font-family:inherit;text-align:left;color:inherit}
.wa-aviso-punto{flex:none;width:8px;height:8px;border-radius:99px;background:#5B4BD6}
.wa-aviso-tx{min-width:0;display:flex;flex-direction:column;gap:1px}
.wa-aviso-tx b{font-size:13.5px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wa-aviso-tx span{font-size:12.5px;color:#8f8d98;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wa-aviso-x{flex:none;width:44px;border:none;border-left:1px solid #f0eff4;background:none;color:#8f8d98;
  font-size:20px;line-height:1;cursor:pointer;font-family:inherit}
@keyframes wa-aviso-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.wa-aviso{animation:none}}
html[data-crm-dark="1"] .wa-aviso{background:#232329;border-color:#33333d;box-shadow:0 8px 28px rgba(0,0,0,.5)}
html[data-crm-dark="1"] .wa-aviso-tx b{color:#F2F1F7}
html[data-crm-dark="1"] .wa-aviso-punto{background:#A78BFA}
html[data-crm-dark="1"] .wa-aviso-x{border-left-color:#33333d}
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
