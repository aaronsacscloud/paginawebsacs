// LLAMADAS INTELIGENTES · lo común de los webhooks públicos del marcador.
// Todos llegan de Twilio con firma; la URL firmada INCLUYE el query
// (`?item=…`), igual que en /amd. Sin firma válida no se toca nada.
import { firmaValida } from '../../../../lib/telefonia/twilio';
import { BASE } from '../../../../lib/telefonia/marcador';

export const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f-]{36}$/i;

export async function leer(request: Request, url: URL, ruta: string): Promise<{ p: Record<string, string>; item: string | null; sesion: string | null } | Response> {
  const raw = await request.text();
  const p = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;
  if (!firmaValida(`${BASE}/api/telefonia/marcador/${ruta}${url.search}`, p, request.headers.get('x-twilio-signature'))) return json({ ok: false }, 403);
  const item = url.searchParams.get('item'), sesion = url.searchParams.get('sesion');
  return { p, item: item && UUID.test(item) ? item : null, sesion: sesion && UUID.test(sesion) ? sesion : null };
}
