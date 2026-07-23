// Gate server-side para las páginas /admin/*: solo entra el equipo interno
// (rol founder o cs). Un partner logueado o un anónimo se redirige.
//
// Uso en el frontmatter de una página Astro:
//   const gate = await requireFounder(Astro);
//   if (gate) return gate;   // <-- redirect; corta el render
import type { AstroGlobal } from 'astro';
import { getSessionFromRequest } from './session';

export async function requireFounder(Astro: AstroGlobal): Promise<Response | null> {
  const user = await getSessionFromRequest(Astro.request);
  const next = Astro.url.pathname + Astro.url.search;

  // Sin sesión → a login, recordando a dónde iba.
  if (!user) {
    return Astro.redirect('/admin/login?next=' + encodeURIComponent(next));
  }
  // Partner logueado → NO es admin: a su portal.
  if (user.role === 'partner') {
    return Astro.redirect('/partner/portal');
  }
  // founder / cs (equipo interno) → pasa.
  return null;
}
