// DEMAND ENGINE · el contrato único de las herramientas (N13).
//
// Se define en la etapa 0, mucho antes de construir la primera herramienta, y
// esa anticipación es deliberada. El objetivo final del motor no es que nos
// mencionen: es que alguien le diga a una IA «analiza mi inventario» y el
// trabajo lo haga Sacs. Ese día, la misma función tiene que servir por tres
// puertas distintas:
//
//   · la herramienta gratis de la web  → adquisición
//   · el MCP público                   → la IA ejecuta y nos cita
//   · la API                           → integraciones y partners
//
// Si cada puerta trae su propia implementación, las tres se desincronizan y la
// respuesta que da ChatGPT deja de ser la que da el sitio. Una función, tres
// puertas: eso es lo que este archivo obliga.
import { z } from 'zod';

export type Puerta = 'web' | 'mcp' | 'api';

export type Herramienta<E = any, S = any> = {
  /** Identidad estable: es la URL (/herramientas/<slug>) y el nombre MCP. */
  slug: string;
  nombre: string;
  /** Qué resuelve, en una línea y en lenguaje del ramo. La lee una persona en
   *  la web y un modelo al elegir herramienta: tiene que servir a las dos. */
  descripcion: string;
  entrada: z.ZodType<E>;
  /** Puertas por las que se expone. Una herramienta puede nacer solo en web. */
  puertas: Puerta[];
  /** Qué hace Sacs con esto que la herramienta suelta no puede hacer. Es el
   *  puente honesto al producto, y es obligatorio: una herramienta sin este
   *  campo es un formulario disfrazado de regalo. */
  momento_sacs: string;
  /** Solo lectura y cálculo. Ninguna herramienta pública escribe en el CRM. */
  ejecutar: (entrada: E, ctx: Contexto) => Promise<Resultado<S>>;
  /** Minutos de caché por entrada idéntica (0 = sin caché). */
  cache_min?: number;
};

export type Contexto = {
  puerta: Puerta;
  /** Identidad anónima del navegador, cuando la hay. Nunca datos personales. */
  visitor_id?: string | null;
  contact_id?: string | null;
  ip_pais?: string | null;
};

export type Resultado<S = any> = {
  ok: boolean;
  datos?: S;
  /** Lo que se le enseña a la persona (o lo que la IA va a leer en voz alta). */
  resumen?: string;
  /** De dónde salió cada número. Sin esto no somos citables: una IA cita lo
   *  que puede verificar, y una persona confía en lo que puede rastrear. */
  fuentes?: { que: string; de: string }[];
  siguiente_paso?: { texto: string; url?: string };
  error?: string;
};

const REGISTRO = new Map<string, Herramienta>();

export function definirHerramienta<E, S>(h: Herramienta<E, S>): Herramienta<E, S> {
  if (REGISTRO.has(h.slug)) throw new Error(`[herramienta] «${h.slug}» ya estaba definida`);
  if (!h.momento_sacs?.trim()) throw new Error(`[herramienta] «${h.slug}» sin momento_sacs: no se acepta`);
  REGISTRO.set(h.slug, h as Herramienta);
  return h;
}

export const herramientas = (puerta?: Puerta): Herramienta[] =>
  [...REGISTRO.values()].filter(h => !puerta || h.puertas.includes(puerta));

export const herramientaDe = (slug: string) => REGISTRO.get(slug) || null;

/** Invocación única para las tres puertas: valida, ejecuta y mide. El registro
 *  de uso es parte del contrato, no un añadido de cada puerta — si no se mide,
 *  no se puede saber qué herramienta trae clientes. */
export async function invocar(slug: string, entradaCruda: unknown, ctx: Contexto): Promise<Resultado> {
  const h = herramientaDe(slug);
  if (!h) return { ok: false, error: `No existe la herramienta «${slug}».` };
  if (!h.puertas.includes(ctx.puerta)) return { ok: false, error: `«${slug}» no está disponible por esta vía.` };

  const v = h.entrada.safeParse(entradaCruda);
  if (!v.success) return { ok: false, error: `Datos incompletos: ${v.error.issues.map(i => i.path.join('.') || 'entrada').join(', ')}` };

  const t0 = Date.now();
  try {
    const r = await h.ejecutar(v.data, ctx);
    await registrarUso(h, ctx, r.ok, Date.now() - t0);
    return r;
  } catch (e: any) {
    await registrarUso(h, ctx, false, Date.now() - t0);
    return { ok: false, error: 'No se pudo completar. Inténtalo de nuevo.' };
  }
}

/** Se guarda QUE se usó y CÓMO resultó, nunca lo que la persona subió. */
async function registrarUso(h: Herramienta, ctx: Contexto, ok: boolean, ms: number) {
  try {
    const { supabase } = await import('../supabase');
    await supabase.from('de_herramienta_usos').insert({
      slug: h.slug, puerta: ctx.puerta, visitor_id: ctx.visitor_id || null,
      contact_id: ctx.contact_id || null, ok, ms,
    });
  } catch { /* la tabla llega en la etapa 4; medir no puede romper la herramienta */ }
}
