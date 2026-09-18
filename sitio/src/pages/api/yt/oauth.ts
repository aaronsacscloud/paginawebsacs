// Recibe el regreso de Google al autorizar el canal de YouTube.
//
// POR QUÉ ESTA RUTA EXISTE
// El canal @sacscloud es una CUENTA DE MARCA, y a una cuenta de marca solo se
// llega por el selector de canal de la pantalla de consentimiento web. El flujo
// de dispositivo —el de «entra a google.com/device y teclea este código»— no
// tiene selector: autoriza con la cuenta personal de quien teclea, que no
// administra el canal. Se probó: el token salía válido, leía bien, y al
// escribir devolvía `forbidden`.
//
// Y el flujo de escritorio tampoco sirve aquí: Google retiró el pegado manual
// de códigos (OOB) y ahora exige que la app escuche en `127.0.0.1:PUERTO` —que
// sería el localhost de quien autoriza, no el del servidor—.
//
// QUÉ GUARDA, Y QUÉ NO
// Guarda ÚNICAMENTE el `code` de autorización: dura unos minutos, es de un solo
// uso y sin el `client_secret` no sirve para nada. El secreto vive solo en el
// `.env` del servidor y el canje por el refresh token se hace allá.
//
// Esa división es el punto: si esta fila se filtrara, lo filtrado ya estaría
// vencido. Guardar aquí el refresh token —que no caduca y permite editar el
// canal entero— sería poner la llave buena en el lugar más expuesto.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const pagina = (titulo: string, cuerpo: string, ok: boolean) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${titulo}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FAFAF8;
       font:16px/1.6 system-ui,-apple-system,sans-serif;color:#1A1A1A;padding:24px}
  .c{max-width:26rem;text-align:center}
  .s{font-size:2.6rem;line-height:1;margin-bottom:1rem}
  h1{font-size:1.35rem;margin:0 0 .6rem}
  p{color:#4A4A4A;margin:0}
  @media (prefers-color-scheme:dark){body{background:#17161A;color:#F2F0EA}p{color:#C4C0B6}}
</style></head>
<body><div class="c"><div class="s">${ok ? '✓' : '⚠'}</div>
<h1>${titulo}</h1><p>${cuerpo}</p></div></body></html>`;

export const GET: APIRoute = async ({ url }) => {
  const responder = (t: string, c: string, ok: boolean, status = 200) =>
    new Response(pagina(t, c, ok), { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  const error = url.searchParams.get('error');
  if (error) return responder('No se autorizó', `Google respondió «${error}». Puedes cerrar esta pestaña.`, false, 400);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return responder('Falta información', 'Este enlace no trae el código de autorización.', false, 400);

  /* El `state` lo genera el servidor antes de mandar a autorizar y se guarda
     con vencimiento. Sin comprobarlo, cualquiera que descubra esta URL podría
     hacernos guardar el código de SU cuenta y quedarse esperando a que alguien
     lo canjee. Es la comprobación que convierte esta ruta pública en una que
     solo responde a una autorización que nosotros iniciamos. */
  const { data: cfg } = await supabase.from('de_config').select('umbrales').eq('id', 1).maybeSingle();
  const pend = (cfg?.umbrales as any)?.yt_oauth;

  if (!pend?.state || pend.state !== state)
    return responder('Enlace no reconocido', 'Este enlace no corresponde a ninguna autorización pendiente. Pide uno nuevo.', false, 400);

  if (!pend.hasta || Date.parse(pend.hasta) < Date.now())
    return responder('Se venció el enlace', 'Pasó demasiado tiempo desde que se generó. Pide uno nuevo.', false, 400);

  const u = { ...(cfg!.umbrales as any) };
  u.yt_oauth = { recibido_at: new Date().toISOString(), code };   // el `state` ya no hace falta y no se conserva
  const { error: eGuardar } = await supabase.from('de_config').update({ umbrales: u }).eq('id', 1);

  // Si no se guardó, decirlo: el código vence en minutos y quien autorizó se
  // iría creyendo que quedó hecho.
  if (eGuardar) return responder('No se pudo guardar', 'La autorización sí se dio, pero no quedó registrada. Hay que repetirla.', false, 500);

  return responder('Listo', 'El canal quedó autorizado. Ya puedes cerrar esta pestaña.', true);
};
