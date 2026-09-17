// DEMAND ENGINE · qué necesita cada fuente para poder trabajar.
//
// La disponibilidad NO se guarda a mano: se calcula mirando el entorno cada vez
// que se pregunta. Una casilla marcada «disponible» en una tabla envejece mal —
// el día que alguien rota una llave, la tabla sigue diciendo que sí y el motor
// falla en silencio. Aquí la fuente de verdad es el entorno del servidor.
import { supabase } from '../supabase';

const env = (k: string): string => String((import.meta as any).env?.[k] || process.env[k] || '').trim();

type Requisito = {
  /** Variables de entorno que TIENEN que existir. */
  llaves?: string[];
  /** Además de la llave, algo que solo puede hacer una persona. */
  gestion?: string;
  /** Qué hay que hacer, escrito para el dueño y no para un programador. */
  comoSeArregla: string;
};

export const REQUISITOS: Record<string, Requisito> = {
  crm: { comoSeArregla: 'Nada: son nuestros propios datos.' },
  autocomplete: { comoSeArregla: 'Nada: es un endpoint público de Google.' },
  competidores: { comoSeArregla: 'Nada: se leen sus sitios públicos.' },
  terceros: { comoSeArregla: 'Nada: se leen los directorios públicos.' },

  /* La credencial YA EXISTE y autentica bien: es la cuenta de servicio
     `google-sheets@sacs3-da4a6.iam.gserviceaccount.com`, la misma que escribe
     en la hoja de leads de TikTok. Faltan dos cosas distintas, y conviene no
     confundirlas porque se arreglan en pantallas distintas:
       (a) ENCENDER la API en el proyecto de Google Cloud `sacs3-da4a6` —
           probado: responde 403 «API has not been used in project 819604817289»;
       (b) DAR DE ALTA esa cuenta como usuario de la propiedad en Search Console.
     Sin (a) no se puede ni preguntar; sin (b) se pregunta y no hay propiedades. */
  gsc: {
    llaves: ['GOOGLE_SERVICE_ACCOUNT_B64'],
    gestion: 'GSC_PROPIEDAD',
    comoSeArregla: '1) Encender «Search Console API» en el proyecto sacs3-da4a6 de Google Cloud. 2) En Search Console → Configuración → Usuarios, agregar google-sheets@sacs3-da4a6.iam.gserviceaccount.com con permiso Completo. 3) Guardar aquí la propiedad (sc-domain:sacscloud.com). Todo gratis.',
  },
  /* NO hay GA4 instalado en el sitio —se mide con PostHog y con nuestra propia
     tabla `contact_visits`, que ya lleva ~8,900 visitas—. Instalar GA4 solo para
     esto sería sumar una etiqueta más y datos duplicados. El conector de
     analítica lee lo nuestro. */
  ga4: {
    comoSeArregla: 'Nada: el sitio no usa GA4. La analítica sale de contact_visits, que es dato propio.',
  },
  pagespeed: { llaves: ['GOOGLE_API_KEY_PSI'], comoSeArregla: 'Encender «PageSpeed Insights API» en el proyecto sacs3-da4a6, crear una llave de API y ponerla en Vercel como GOOGLE_API_KEY_PSI. Gratis.' },
  youtube:   { llaves: ['GOOGLE_API_KEY_YT'],  comoSeArregla: 'Encender «YouTube Data API v3» en el proyecto sacs3-da4a6, crear una llave de API y ponerla en Vercel como GOOGLE_API_KEY_YT. Gratis, 10 mil unidades al día.' },
  reddit:    { llaves: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'], comoSeArregla: 'Crear una app en reddit.com/prefs/apps y poner REDDIT_CLIENT_ID y REDDIT_CLIENT_SECRET en Vercel. Es gratis.' },
  serp:      { llaves: ['DATAFORSEO_LOGIN', 'DATAFORSEO_PASSWORD'], comoSeArregla: 'Abrir cuenta en DataForSEO (pago por uso) y poner DATAFORSEO_LOGIN y DATAFORSEO_PASSWORD en Vercel.' },

  ia_openai:     { llaves: ['OPENAI_API_KEY'],     comoSeArregla: 'Poner OPENAI_API_KEY en Vercel.' },
  ia_gemini:     { llaves: ['GEMINI_API_KEY'],     comoSeArregla: 'Poner GEMINI_API_KEY en Vercel.' },
  ia_anthropic:  { llaves: ['ANTHROPIC_API_KEY'],  comoSeArregla: 'Poner ANTHROPIC_API_KEY en Vercel.' },
  /* ⚠️ La API de Perplexity CAMBIÓ: `sonar` en /chat/completions ya no existe.
     Ahora es `perplexity/sonar` en /v1/responses. La documentación vieja sigue
     circulando, así que si un día responde «model not supported», es esto y no
     la llave. Medido el 17-sep-2026: $0.0008 por pregunta. */
  ia_perplexity: { llaves: ['PERPLEXITY_API_KEY'], comoSeArregla: 'Comprar créditos de API en perplexity.ai/account/api (NO la suscripción Pro, que es para el navegador) y poner la llave como PERPLEXITY_API_KEY en Vercel.' },
  ia_xai:        { llaves: ['XAI_API_KEY'],        comoSeArregla: 'Sacar una llave de la API de xAI (Grok) y ponerla como XAI_API_KEY en Vercel.' },
};

export type Disponibilidad = { disponible: boolean; falta: string | null };

/** ¿Puede trabajar esta fuente AHORA? `config` guarda lo que no es secreto
 *  (un id de propiedad, por ejemplo) y por eso se pasa desde la fila. */
export function revisar(id: string, config: Record<string, any> = {}): Disponibilidad {
  const r = REQUISITOS[id];
  if (!r) return { disponible: false, falta: 'fuente sin requisitos declarados' };

  const sinLlave = (r.llaves || []).filter(k => !env(k));
  if (sinLlave.length) return { disponible: false, falta: `${r.comoSeArregla} (falta ${sinLlave.join(', ')})` };

  if (r.gestion && !config[r.gestion.toLowerCase()] && !config[r.gestion]) {
    return { disponible: false, falta: r.comoSeArregla };
  }
  return { disponible: true, falta: null };
}

/**
 * Repasa todas las fuentes y deja la tabla al día. Se llama al abrir la
 * pantalla y al armar un ciclo: así «lo que me falta» siempre dice la verdad
 * de hoy, no la de la última vez que alguien se acordó de revisarlo.
 */
export async function refrescarDisponibilidad(): Promise<{ id: string; disponible: boolean }[]> {
  const { data } = await supabase.from('de_conectores').select('id, config, disponible, falta');
  const out: { id: string; disponible: boolean }[] = [];
  for (const k of data || []) {
    const d = revisar(k.id, k.config || {});
    out.push({ id: k.id, disponible: d.disponible });
    if (d.disponible !== k.disponible || d.falta !== k.falta) {
      await supabase.from('de_conectores').update({ disponible: d.disponible, falta: d.falta, actualizado_at: new Date().toISOString() }).eq('id', k.id);
    }
  }
  return out;
}

/** Un fallo de fuente no puede parar a las demás, pero sí tiene que contarse:
 *  tres seguidos y la fuente se marca para que el latido la denuncie (N1). */
export async function marcarFallo(id: string, error: string): Promise<void> {
  const { data } = await supabase.from('de_conectores').select('fallos_seguidos').eq('id', id).maybeSingle();
  await supabase.from('de_conectores').update({
    fallos_seguidos: (data?.fallos_seguidos || 0) + 1,
    ultimo_error: String(error).slice(0, 400),
    ultimo_intento_at: new Date().toISOString(),
  }).eq('id', id);
}

export async function marcarOk(id: string, filas?: number): Promise<void> {
  await supabase.from('de_conectores').update({
    fallos_seguidos: 0, ultimo_error: null,
    ultimo_ok_at: new Date().toISOString(), ultimo_intento_at: new Date().toISOString(),
    filas_ultima: filas ?? null,
  }).eq('id', id);
}
