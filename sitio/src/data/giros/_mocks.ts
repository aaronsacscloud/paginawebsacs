/**
 * Ayudas compartidas para los mocks de UI del SuiteScroll de los giros nuevos (17-sep-2026).
 * Mismo estilo que suite-ropa.ts: HTML/CSS inline con los tokens del sitio, sin imágenes.
 */
export const est = {
  wrap: 'font-family:var(--font-body), system-ui, sans-serif;',
  h: 'font-size:11px;font-weight:800;color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px;',
  celdaOk: 'background:var(--ok-fondo);color:var(--ok-texto);',
  celdaLo: 'background:var(--aviso-fondo);color:var(--aviso-texto);',
  celdaZero: 'background:var(--color-bg-primary);color:#D4D4D4;',
  pie: 'margin:12px 0 0;font-size:11px;color:var(--color-text-tertiary);',
  chip: 'font-size:10.5px;font-weight:700;border:1px solid #DFE3EA;border-radius:999px;padding:4px 10px;color:var(--color-text-secondary);background:#fff;',
};

/** Matriz existencia: filas (nombre + valores) × columnas. `marca` resalta una celda [fila, col]. */
export function mockMatriz(titulo: string, cols: string[], filas: [string, number[]][], pie?: string, marca?: [number, number], umbralBajo = 3) {
  return `<div style="${est.wrap}">
    <p style="${est.h}">${titulo}</p>
    <table style="width:100%;border-collapse:separate;border-spacing:4px;font-size:12px;">
      <tr><th style="text-align:left;font-size:10.5px;color:var(--color-text-tertiary);width:72px;"></th>${cols.map((t) => `<th style="font-size:10.5px;color:var(--color-text-tertiary);font-weight:700;">${t}</th>`).join('')}</tr>
      ${filas.map(([c, v], fi) => `<tr><td style="font-size:11px;font-weight:700;color:var(--color-text-primary);">${c}</td>${v.map((n, i) => {
        const st = n === 0 ? est.celdaZero : n <= umbralBajo ? est.celdaLo : est.celdaOk;
        const m = marca && marca[0] === fi && marca[1] === i ? 'box-shadow:0 0 0 2px var(--color-primary);' : '';
        return `<td style="${st}${m}border-radius:8px;height:30px;text-align:center;font-weight:800;font-variant-numeric:tabular-nums;">${n}</td>`;
      }).join('')}</tr>`).join('')}
    </table>
    ${pie ? `<p style="${est.pie}">${pie}</p>` : ''}
  </div>`;
}

/** Barras horizontales: [etiqueta, valor mostrado, porcentaje 0-100]. */
export function mockBarras(titulo: string, filas: [string, string, number][], pie?: string) {
  return `<div style="${est.wrap}">
    <p style="${est.h}">${titulo}</p>
    ${filas.map(([t, n, p]) => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
      <span style="width:84px;font-size:11.5px;font-weight:800;color:var(--color-text-primary);">${t}</span>
      <div style="flex:1;height:22px;background:var(--color-bg-primary);border-radius:8px;overflow:hidden;"><div style="width:${p}%;height:100%;background:var(--color-primary);"></div></div>
      <span style="width:72px;text-align:right;font-size:11.5px;font-weight:700;color:var(--color-text-secondary);">${n}</span>
    </div>`).join('')}
    ${pie ? `<p style="${est.pie}">${pie}</p>` : ''}
  </div>`;
}

/** Ticket o lista con importes: [concepto, importe]; la última fila va en negritas si `total`. */
export function mockTicket(titulo: string, lineas: [string, string][], total?: [string, string], pie?: string) {
  return `<div style="${est.wrap}">
    <p style="${est.h}">${titulo}</p>
    <div style="border:1px solid #E6E8ED;border-radius:12px;padding:12px 14px;background:#fff;">
      ${lineas.map(([a, b]) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px dashed #E6E8ED;font-size:12.5px;"><span style="color:var(--color-text-primary);">${a}</span><b style="font-variant-numeric:tabular-nums;">${b}</b></div>`).join('')}
      ${total ? `<div style="display:flex;justify-content:space-between;padding:10px 0 2px;font-size:14px;font-weight:800;"><span>${total[0]}</span><span style="font-variant-numeric:tabular-nums;">${total[1]}</span></div>` : ''}
    </div>
    ${pie ? `<p style="${est.pie}">${pie}</p>` : ''}
  </div>`;
}

/** Lista de avisos o renglones con estado: [texto, estado, tono]. */
export function mockLista(titulo: string, filas: [string, string, 'ok' | 'aviso' | 'gris'][], pie?: string) {
  const tono = { ok: est.celdaOk, aviso: est.celdaLo, gris: 'background:var(--color-bg-primary);color:var(--color-text-secondary);' };
  return `<div style="${est.wrap}">
    <p style="${est.h}">${titulo}</p>
    ${filas.map(([t, e, k]) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 12px;margin-bottom:6px;border:1px solid #E6E8ED;border-radius:10px;font-size:12.5px;background:#fff;"><span style="color:var(--color-text-primary);">${t}</span><span style="${tono[k]}font-size:10.5px;font-weight:800;padding:4px 9px;border-radius:999px;white-space:nowrap;">${e}</span></div>`).join('')}
    ${pie ? `<p style="${est.pie}">${pie}</p>` : ''}
  </div>`;
}

/** Calendario de un mes con días marcados: `marcados` = { dia: 'ok'|'aviso'|'lleno' }. */
export function mockCalendario(titulo: string, mes: string, dias: number, marcados: Record<number, 'ok' | 'aviso' | 'lleno'>, pie?: string) {
  const tono = { ok: est.celdaOk, aviso: est.celdaLo, lleno: 'background:var(--color-text-primary);color:#fff;' };
  return `<div style="${est.wrap}">
    <p style="${est.h}">${titulo} · ${mes}</p>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
      ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span style="font-size:10px;font-weight:700;color:var(--color-text-tertiary);text-align:center;">${d}</span>`).join('')}
      ${Array.from({ length: dias }, (_, i) => i + 1).map((d) => `<span style="${marcados[d] ? tono[marcados[d]] : 'background:#fff;border:1px solid #EEF0F3;color:var(--color-text-secondary);'}height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700;">${d}</span>`).join('')}
    </div>
    ${pie ? `<p style="${est.pie}">${pie}</p>` : ''}
  </div>`;
}
