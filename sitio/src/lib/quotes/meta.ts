const META_SEP = '\n---META---\n';

export function parseMeta(notas: string | null): { text: string; meta: Record<string, any> } {
  if (!notas) return { text: '', meta: {} };
  const idx = notas.indexOf(META_SEP);
  if (idx === -1) return { text: notas, meta: {} };
  try {
    return { text: notas.slice(0, idx), meta: JSON.parse(notas.slice(idx + META_SEP.length)) };
  } catch {
    return { text: notas, meta: {} };
  }
}

export function serializeMeta(text: string, meta: Record<string, any>): string {
  if (!Object.keys(meta).length) return text;
  return text + META_SEP + JSON.stringify(meta);
}

export function addTimelineEvent(notas: string | null, event: string): string {
  const { text, meta } = parseMeta(notas);
  if (!meta.timeline) meta.timeline = [];
  meta.timeline.push({ event, at: new Date().toISOString() });
  return serializeMeta(text, meta);
}
