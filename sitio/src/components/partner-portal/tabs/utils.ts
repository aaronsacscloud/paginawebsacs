// Shared utils para las tabs del portal del partner.

export const fmt = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
export const fmtNum = (n: number) => Math.round(Number(n || 0)).toLocaleString('es-MX');

export function fmtDate(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

export function fmtShort(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  } catch { return '—'; }
}

export function fmtRel(d?: string | null): string {
  if (!d) return '—';
  const t = new Date(d).getTime();
  if (isNaN(t)) return '—';
  const diffMs = Date.now() - t;
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (abs < min) return future ? 'en unos segundos' : 'ahora';
  if (abs < hr) {
    const m = Math.round(abs / min);
    return future ? `en ${m} min` : `hace ${m} min`;
  }
  if (abs < day) {
    const h = Math.round(abs / hr);
    return future ? `en ${h}h` : `hace ${h}h`;
  }
  if (abs < day * 7) {
    const dys = Math.round(abs / day);
    return future ? `en ${dys}d` : `hace ${dys}d`;
  }
  return fmtShort(d);
}

// Un deal cuenta como "ganado/cliente" si su stage es ganado o ya tiene closed_at.
// Soporta ambos: legacy 'won' y schema oficial 'cerrada_ganada'.
export function isDealWon(deal: any): boolean {
  if (!deal) return false;
  if (deal.stage === 'won' || deal.stage === 'cerrada_ganada') return true;
  if (deal.closed_at && deal.stage !== 'cerrada_perdida' && deal.stage !== 'lost') return true;
  return false;
}

// Detecta si estamos en modo demo via query param
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  const u = new URL(window.location.href);
  return u.searchParams.get('demo') === '1';
}

// Fetch wrapper que sustituye con fixtures cuando demo=1
export async function apiGet<T>(url: string, demoFallback?: T): Promise<T> {
  if (isDemoMode() && demoFallback !== undefined) return demoFallback;
  try {
    const r = await fetch(url);
    return await r.json();
  } catch (e) {
    if (demoFallback !== undefined) return demoFallback;
    throw e;
  }
}

// Stage labels y colores
export const STAGE_LABELS: Record<string, string> = {
  lead:             'Nuevo lead',
  prueba_gratis:    'Prueba gratis',
  demo_agendada:    'Demo agendada',
  demo_realizada:   'Demo realizada',
  cliente:          'Cliente firmado',
  pagado:           'Pagado',
};

export const STAGE_COLORS: Record<string, string> = {
  lead:           '#888',
  prueba_gratis:  '#E8A838',
  demo_agendada:  '#4B7BE5',
  demo_realizada: '#6C5CE7',
  cliente:        '#2AB5A0',
  pagado:         '#1A8F7A',
};

export const PLAN_LABELS: Record<string, string> = {
  control:        'Plan Control',
  fideliza:       'Plan Fideliza',
  fideliza_plus:  'Plan Fideliza Plus',
};

// Para sparklines (line chart con SVG inline)
export function buildSparkline(daily: { day: string; visits: number }[], w = 320, h = 60): string {
  if (!daily?.length) return '';
  const max = Math.max(1, ...daily.map(d => d.visits));
  const stepX = w / Math.max(1, daily.length - 1);
  const pts = daily.map((d, i) => {
    const x = i * stepX;
    const y = h - (d.visits / max) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${pts.join(' L')}`;
}

// Copy helper
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}
