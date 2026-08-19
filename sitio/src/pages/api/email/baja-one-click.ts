// POST /api/email/baja-one-click?t=<token> — el destino del header RFC 8058.
//
// Es lo que hace funcionar el botón nativo "Cancelar suscripción" de Gmail,
// Outlook y Yahoo. Desde feb-2024 es requisito para remitentes masivos.
//
// SOLO POST, a propósito y por seguridad: los escáneres corporativos
// (Microsoft Safe Links, Proofpoint) visitan con GET todos los links de un
// correo segundos después de entregarlo. Si un GET ejecutara la baja, media
// cartera B2B se daría de baja sola sin que nadie lo tocara. El GET de la
// página pública muestra confirmación; solo un POST ejecuta.
import type { APIRoute } from 'astro';
import { verificar } from '../../../lib/email/token';
import { darDeBaja } from '../../../lib/email/bajas';

export const prerender = false;

// Siempre 200: un proveedor que recibe error puede dejar de mostrar el botón.
const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ url, request }) => {
  let token = url.searchParams.get('t') || '';
  if (!token) {
    // Algunos proveedores mandan el cuerpo `List-Unsubscribe=One-Click`; el
    // token entonces solo viaja en la URL. Se intenta el cuerpo por si acaso.
    const body = await request.text().catch(() => '');
    token = new URLSearchParams(body).get('t') || '';
  }
  const p = verificar(token, ['baja', 'preferencias', 'envio']);
  if (!p) return ok();
  await darDeBaja({ tenantId: p.t, email: p.m, sendId: p.s || null, origen: 'one-click' });
  return ok();
};

// Un GET aquí NO ejecuta nada: manda a la página de confirmación.
export const GET: APIRoute = async ({ url, redirect }) => {
  const t = url.searchParams.get('t') || '';
  return redirect(`/email/baja/${encodeURIComponent(t)}`, 302);
};
