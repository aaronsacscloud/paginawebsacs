// Helpers para email templates de scheduling.
//
// escapeHtml: defense-in-depth. Algunos email clients pueden ejecutar HTML
// embebido. Cualquier campo user-provided (nombre, empresa, email, notas)
// interpolado en strings HTML debe pasar por aquí antes de concatenarse.

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
};

export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[&<>"'/]/g, (c) => HTML_ENTITIES[c] || c);
}

// Sanea atributos href para evitar javascript: / data:
export function safeUrl(url: unknown): string {
  const s = String(url || '').trim();
  if (/^(javascript|data|vbscript):/i.test(s)) return '#';
  return escapeHtml(s);
}
