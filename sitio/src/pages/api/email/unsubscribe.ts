// GET /api/email/unsubscribe — RUTA LEGACY, ya no ejecuta nada.
//
// ⚠️ POR QUÉ SE NEUTRALIZÓ.
//
// La versión anterior daba de baja con un GET, sin token y sin firma:
//   GET /api/email/unsubscribe?email=<quien sea>&confirmed=1
// Eso es dos agujeros a la vez. Uno: cualquiera podía dar de baja a cualquiera
// escribiendo la URL. Dos —y este pasa SOLO, sin atacante— los escáneres de
// seguridad corporativos (Microsoft Safe Links, Proofpoint) abren con GET todos
// los links de cada correo que entregan; con este endpoito vivo, la cartera B2B
// se daba de baja sola a los segundos de recibir.
//
// Además escribía en `email_unsubscribes`, que el pipeline nuevo tuvo que
// aprender a leer aparte para no ignorar esas bajas.
//
// Los correos ya entregados siguen trayendo este enlace, así que la ruta no se
// borra: manda a la página nueva, que confirma con GET y solo ejecuta con POST.
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ url, redirect }) => {
  const email = url.searchParams.get('email') || '';
  // Sin token no se puede identificar el envío; la página pide confirmación
  // explícita y desde ahí sí se procesa (con POST).
  return redirect(`/email/baja/legacy?e=${encodeURIComponent(email)}`, 302);
};

export const POST: APIRoute = async ({ url, redirect }) => {
  const email = url.searchParams.get('email') || '';
  return redirect(`/email/baja/legacy?e=${encodeURIComponent(email)}`, 302);
};
