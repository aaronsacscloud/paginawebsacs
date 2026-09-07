// Apagar el aviso del teléfono cuando ya lo leíste en la app.
//
// El push se queda en la pantalla de bloqueo hasta que alguien lo toca. Si
// abriste el hilo desde el CRM y ya leíste el mensaje, ese aviso dejó de ser un
// aviso: es basura que te hace revisar dos veces lo mismo, y es la mitad de la
// sensación de «me llegan demasiadas».
//
// El dueño lo pidió con esas palabras: «la notificación se termina cuando yo ya
// le doy clic o entro y leo el mensaje». Tocarla ya funcionaba —el service
// worker la cierra—; lo que faltaba era el otro camino, el normal: entrar por
// la app.
//
// Nunca lanza y no espera respuesta. Si el navegador no soporta service
// workers, el aviso simplemente se queda: molesto, pero nada se rompe.

/** Los tags tienen que ser LOS MISMOS que puso quien mandó el push
 *  (`lib/crm/push-reglas.ts` → `tagDe`). Si se desincronizan, el aviso no se
 *  apaga y nadie se entera de por qué. */
export const tagAviso = {
  conversacion: (id: string) => `wa-${id}`,
  canal: (id: string) => `equipo-${id}`,
  sala: (id: string) => `sala-${id}`,
};

export function cerrarAviso(tag: string | null | undefined): void {
  if (!tag || typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  try {
    // `ready` y no `controller`: recién cargada la página el controller puede
    // ser null y el mensaje se perdería en silencio justo al abrir, que es
    // cuando más falta hace.
    //
    // ⚠️ SE CIERRAN DESDE LA PÁGINA, NO MANDÁNDOLE UN MENSAJE AL SERVICE WORKER.
    //
    // Antes esto hacía `reg.active.postMessage({tipo:'cerrar-aviso', tag})` y el
    // SW respondía cerrando las notificaciones. Ese salto MATABA la pestaña:
    // entrar a cualquier canal del chat reventaba el renderer al instante (sin
    // error de JS, con el heap en 45 MB — o sea que no era memoria).
    //
    // Aislado el 7-sep-2026 contra producción, tres corridas: bloqueando los
    // service workers → vive; anulando `navigator.serviceWorker.ready` → vive;
    // anulando `ServiceWorker.prototype.postMessage` → vive; tal cual → muere.
    // Pasa con y sin permiso de notificaciones concedido.
    //
    // `getNotifications()` existe igual en el registro del lado de la página, y
    // hace exactamente lo mismo sin el salto entre procesos. El manejador de
    // 'cerrar-aviso' del SW se deja donde está: no estorba, y sigue sirviendo
    // si algún día hace falta cerrar avisos con la pestaña en segundo plano.
    navigator.serviceWorker.ready
      .then(async reg => {
        if (!reg.getNotifications) return;
        const ns = await reg.getNotifications({ tag });
        ns.forEach(n => n.close());
        // El badge se recalcula con lo que quede, igual que hacía el SW.
        const quedan = await reg.getNotifications();
        const nav = navigator as any;
        if (quedan.length) await nav.setAppBadge?.(quedan.length);
        else await nav.clearAppBadge?.();
      })
      .catch(() => {});
  } catch { /* sin service worker no hay nada que apagar */ }
}
