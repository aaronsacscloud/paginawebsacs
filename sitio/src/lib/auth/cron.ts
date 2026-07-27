// Autorización de endpoints /api/cron/* (y scheduling/google/sync).
//
// ⚠️ SEGURIDAD: antes la única barrera era ?key=sacs-cron-2026 — una llave
// COMMITEADA en el repo y en vercel.json (viajaba en la URL → queda en logs).
// Cualquiera con ella disparaba los crons (mensajería a clientes, mutación de
// suscripciones, y quote-reminders ecoaba PII). Ahora:
//
//  1) x-vercel-cron: Vercel añade este header a TODA invocación de cron y
//     ELIMINA cualquier header x-vercel-* que venga de un cliente externo → su
//     presencia prueba que la request viene del scheduler de Vercel. Los crons
//     siguen corriendo por schedule sin cambiar nada (no rompe).
//  2) Authorization: Bearer <CRON_SECRET> (env, solo-servidor) para disparos
//     manuales autorizados. Es el método robusto recomendado por Vercel.
//
// Ya NO se acepta ?key=. Rotar la llave vieja y (opcional pero recomendado)
// configurar CRON_SECRET en el entorno.
export function isAuthorizedCron(request: Request): boolean {
  // 1) Invocación del scheduler de Vercel (header no falsificable desde fuera).
  if (request.headers.get('x-vercel-cron') != null) return true;

  // 2) Disparo manual con el secreto de entorno.
  const secret = (import.meta.env.CRON_SECRET || '').trim();
  if (secret) {
    const auth = request.headers.get('authorization') || '';
    if (auth === `Bearer ${secret}`) return true;
  }
  return false;
}
