/**
 * PostHog — analitica de producto del sitio.
 *
 * Para que: el pixel de OpenAI y el de TikTok dicen CUANTA gente llego. Esto
 * dice hasta donde llego cada quien y en que paso se cayo. Es lo que responde
 * "¿donde pierdo a la gente?".
 *
 * La llave de proyecto (phc_) es PUBLICA por diseño: viaja en el HTML de
 * cualquier sitio con PostHog y solo sirve para MANDAR eventos, nunca para
 * leerlos. Por eso va aqui como constante y no como secreto: si viviera en una
 * variable de entorno y alguien olvidara definirla en Vercel, el sitio dejaria
 * de medir en silencio durante semanas. Las llaves que SI son secretas —la
 * personal (phx_) y la secreta de proyecto (phs_)— no aparecen en este repo.
 */
export const POSTHOG_KEY = 'phc_pvEBREWs8DkbPhEuHvPFkiFG84G54CkhaSHvDWoHKbxY';

/** Region del proyecto. Mandar a la region equivocada = eventos que se pierden. */
export const POSTHOG_HOST = 'https://us.i.posthog.com';

/**
 * Manda un evento desde el SERVIDOR.
 *
 * Existe porque los momentos que mas importan —una demo agendada, una
 * suscripcion pagada— se confirman en el backend, y ahi el navegador ya puede
 * haberse cerrado. Ademas un bloqueador de anuncios puede tumbar el pixel pero
 * no esto.
 *
 * NUNCA lanza: que falle la medicion no puede tumbar una reserva.
 *
 * @param distinctId  Identidad estable de la persona. Usa el correo cuando lo
 *                    tengas: asi PostHog une esta conversion con toda la
 *                    navegacion anonima previa de esa misma persona.
 */
export async function capturarEnServidor(
  evento: string,
  distinctId: string,
  propiedades: Record<string, unknown> = {},
): Promise<void> {
  if (!distinctId) return;
  try {
    await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: evento,
        distinct_id: distinctId,
        timestamp: new Date().toISOString(),
        properties: { ...propiedades, $lib: 'sacs-servidor' },
      }),
    });
  } catch (e) {
    console.warn('[posthog] no se pudo registrar', evento, e instanceof Error ? e.message : e);
  }
}
