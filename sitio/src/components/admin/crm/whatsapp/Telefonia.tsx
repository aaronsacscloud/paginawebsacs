// TELEFONÍA · Llamadas normales (Twilio Voice SDK) desde el navegador, con el
// número mexicano del negocio como caller ID. La grabación y la minuta las
// hace el SERVIDOR (Twilio graba → webhook → Whisper → Claude): aquí se marca,
// se contesta, se cuelga y se ENSEÑA en qué punto va la llamada.
//
// Convive con Llamadas.tsx (WhatsApp), que vive arriba al centro; esta barra
// vive abajo a la derecha para que nunca se encimen.
//
// ── El ciclo completo, que es lo que pinta esta pantalla ────────────────────
//   permiso → conectando → timbrando → en línea → (colgar) → resumen → minuta
// Cada salto tiene su propio texto porque cada uno se siente distinto: no es
// lo mismo «no te dio el micrófono» que «el cliente no contestó», y antes las
// dos se veían igual (la barra simplemente desaparecía).
import { useCallback, useEffect, useRef, useState } from 'react';
import { telefonoLegible, telefonoWhatsApp } from '../../../../lib/telefono';
import { useIsMobile } from '../../../../lib/ui/mobile';
import { C } from './estilo';

let DeviceCtor: any = null;   // import perezoso: el SDK pesa y casi nadie lo usa en cada carga

type Fase = 'permiso' | 'conectando' | 'timbrando' | 'en-linea' | 'cerrando';
type Viva = {
  call: any; telefono: string; nombre: string | null;
  direccion: 'entrante' | 'saliente'; fase: Fase;
  /** Empieza a correr cuando CONTESTAN, no cuando marcamos. */
  desde: number | null;
  sid: string | null;
};
/** MODO SALA · el vendedor está metido en la sala de una sesión de Llamadas
    inteligentes: el servidor marca, el navegador solo escucha (mudo) hasta que
    contesta una persona. Se lleva aparte de `Viva` porque no es UNA llamada:
    es una línea abierta que dura toda la sesión y no genera resumen ni minuta
    propia (eso lo hace cada item de la sesión en el servidor). */
type Sala = { id: string; call: any; enSala: boolean; mute: boolean };
type Resumen = {
  sid: string | null; telefono: string; nombre: string | null;
  seg: number; direccion: 'entrante' | 'saliente';
  desenlace: string; conversationId: string | null;
  minuta: 'no-aplica' | 'esperando' | 'lista' | 'falló'; verificado: boolean;
};

/* ── Errores de Twilio en español ──────────────────────────────────────────
   El SDK devuelve códigos. Un «31401» en pantalla no le sirve a nadie: cada
   uno tiene una causa concreta y una acción concreta. */
function explicar(e: any): string {
  const cod = Number(e?.code || e?.causes?.[0]?.code || 0);
  const txt = String(e?.message || e || '');
  if (cod === 31401 || /NotAllowed|Permission denied/i.test(txt)) return 'El navegador no dio acceso al micrófono. Dale permiso en el candado de la barra de direcciones y vuelve a intentar.';
  if (cod === 31402 || /NotFound|Requested device not found/i.test(txt)) return 'No se encontró ningún micrófono en esta computadora. Conecta uno (o unos audífonos) y vuelve a intentar.';
  if (cod === 31403 || /NotReadable|TrackStart/i.test(txt)) return 'Otro programa está usando el micrófono (Zoom, Meet, Teams). Ciérralo y vuelve a intentar.';
  if (cod === 31205 || cod === 20104) return 'La sesión de telefonía caducó. Recarga la página para volver a llamar.';
  if (cod === 31005 || cod === 31003 || cod === 53405) return 'Se perdió la conexión con la central telefónica. Revisa tu internet y vuelve a intentar.';
  if (cod === 13223 || cod === 13224 || cod === 21217) return 'Twilio rechazó el número marcado: no existe o no se puede llamar a ese destino.';
  if (cod === 20003) return 'Twilio rechazó las credenciales. Hay que revisar la configuración en Configuración → Telefonía.';
  if (cod === 31486) return 'La otra persona está en otra llamada.';
  if (/insufficient funds|balance/i.test(txt)) return 'La cuenta de Twilio se quedó sin saldo. Recárgalo para seguir llamando.';
  return txt || 'La llamada falló por una razón que Twilio no explicó.';
}

/** Desenlace legible a partir de lo que el servidor guardó en el espejo. */
function desenlaceDe(estado: string, seg: number, direccion: string, motivo?: string | null): string {
  if (motivo) return motivo;
  if (estado === 'perdida') return direccion === 'saliente' ? 'No contestó' : 'Perdida — no la alcanzaste a tomar';
  if (estado === 'rechazada') return direccion === 'saliente' ? 'Comunicaba o te colgaron' : 'La rechazaste';
  if (estado === 'fallida') return 'La llamada no se pudo completar';
  if (seg > 0) return 'Llamada terminada';
  return 'Terminada sin conversación';
}

/** Tono de entrante con WebAudio (sin archivos). */
function useTono(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    let ctx: AudioContext | null = null; let vivo = true;
    const sonar = () => {
      if (!vivo) return;
      try {
        ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
        const g = ctx.createGain(); g.gain.value = 0.05; g.connect(ctx.destination);
        const o = ctx.createOscillator(); o.frequency.value = 440; o.connect(g); o.start(); o.stop(ctx.currentTime + 0.9);
        const o2 = ctx.createOscillator(); o2.frequency.value = 480; o2.connect(g); o2.start(ctx.currentTime + 0.15); o2.stop(ctx.currentTime + 0.9);
      } catch { /* pestaña sin permiso de audio */ }
      setTimeout(sonar, 3000);
    };
    sonar();
    return () => { vivo = false; ctx?.close().catch(() => {}); };
  }, [activo]);
}

export default function Telefonia() {
  const [viva, setViva] = useState<Viva | null>(null);
  const [entrante, setEntrante] = useState<any>(null);   // call de Twilio timbrando
  const [espera, setEspera] = useState<any>(null);       // 2ª entrante mientras hablo
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [seg, setSeg] = useState(0);
  const [mute, setMute] = useState(false);
  const [aviso, setAviso] = useState('');                // calidad de red, mic mudo…
  const [error, setError] = useState('');
  const [numero, setNumero] = useState('');
  const [teclado, setTeclado] = useState(false);
  const [tonos, setTonos] = useState('');
  const [nivel, setNivel] = useState(0);            // mejora 2 · cuánto te está oyendo el micrófono
  const [nota, setNota] = useState('');             // mejora 3 · apunte durante la llamada
  const [notaAbierta, setNotaAbierta] = useState(false);
  const [ctx, setCtx] = useState<any>(null);        // mejora 4 · con quién estás hablando
  const esMovil = useIsMobile();
  const wakeRef = useRef<any>(null);
  // El apunte se lee desde el cierre de `terminar`, que se creó antes de la
  // última tecla: sin la ref se guardaría el texto de hace varios caracteres.
  const notaRef = useRef(''); notaRef.current = nota;
  const deviceRef = useRef<any>(null);
  const vivaRef = useRef<Viva | null>(null); vivaRef.current = viva;
  const entranteRef = useRef<any>(null); entranteRef.current = entrante;
  const armandoRef = useRef<Promise<any> | null>(null);   // evita dos Devices a la vez
  const [sala, setSala] = useState<Sala | null>(null);
  const salaRef = useRef<Sala | null>(null); salaRef.current = sala;
  useTono(!!entrante);

  /** Un token fresco del servidor. */
  const tokenNuevo = async () => fetch('/api/crm/telefonia/token').then(x => x.json()).catch(() => null);

  /* ── QUÉ ERRORES SE LE ENSEÑAN A LA GENTE (11-sep-2026) ──────────────────
     El `Device` vive registrado TODO el tiempo que el CRM esté abierto, para
     poder recibir llamadas. Eso significa un WebSocket permanente, y en un
     celular ese WebSocket se cae constantemente: cambia de wifi a datos, la
     pantalla se apaga, el sistema congela la pestaña. El SDK se reconecta solo
     en segundos.
     Yo estaba pintando CADA uno de esos hipos como un cuadro rojo encima del
     tablero, a alguien que ni siquiera estaba llamando. Se vio en producción:
     «AccessTokenInvalid» al abrir la app y «Se perdió la conexión» diez
     segundos después, sin ninguna llamada de por medio.
     Regla nueva: un error del Device solo se enseña si hay una llamada en
     curso o timbrando. Si no, se trata en silencio — que es lo que el usuario
     esperaría que hiciera un teléfono. */
  const errorDeDevice = (e: any) => {
    const cod = Number(e?.code || 0);
    // 20101 = el token caducó o no se validó. Se renueva y se sigue: pasa
    // siempre que el celular deja la app congelada más de una hora.
    if (cod === 20101 || cod === 31205 || cod === 20104) {
      tokenNuevo().then(t => {
        if (!t?.token || !deviceRef.current) return;
        try { deviceRef.current.updateToken(t.token); deviceRef.current.register?.(); } catch { /* se reintenta al siguiente latido */ }
      });
      if (!vivaRef.current && !entranteRef.current) return;
    }
    if (!vivaRef.current && !entranteRef.current) { console.warn('[telefonia] hipo del Device:', cod, e?.message || e); return; }
    setError(explicar(e));
  };

  const asegurarDevice = async (): Promise<any> => {
    if (deviceRef.current) return deviceRef.current;
    /* Dos llamadas a la vez creaban DOS Devices con la misma identidad, y el
       segundo registro tumba al primero: ese es otro camino al 20101. */
    if (armandoRef.current) return armandoRef.current;
    armandoRef.current = (async () => {
    const r = await tokenNuevo();
    if (!r?.token) {
      throw new Error(r?.faltantes?.length
        ? `La telefonía no está configurada (faltan ${r.faltantes.length} datos). Ve a Configuración → WhatsApp → Telefonía.`
        : (r?.error || 'No se pudo abrir la línea telefónica.'));
    }
    setNumero(r.numero);
    if (!DeviceCtor) DeviceCtor = (await import('@twilio/voice-sdk')).Device;
    const device = new DeviceCtor(r.token, { codecPreferences: ['opus', 'pcmu'] });
    device.on('error', errorDeDevice);
    device.on('tokenWillExpire', async () => {
      const t = await tokenNuevo();
      if (t?.token) device.updateToken(t.token);
    });
    device.on('incoming', (call: any) => {
      /* Llamada en espera: si ya estoy hablando, la segunda NO se traga en
         silencio. Antes se hacía `return` y quien llamaba escuchaba el tono
         hasta que Twilio se rendía, sin que nadie en el CRM se enterara. */
      if (vivaRef.current || salaRef.current) {
        setEspera(call);
        const limpiar = () => setEspera((c: any) => (c === call ? null : c));
        call.on('cancel', limpiar); call.on('disconnect', limpiar); call.on('reject', limpiar);
        return;
      }
      setEntrante(call);
      const limpiar = () => setEntrante((c: any) => (c === call ? null : c));
      call.on('cancel', limpiar); call.on('disconnect', limpiar); call.on('reject', limpiar);
    });
    await device.register();
    deviceRef.current = device;
    return device;
    })().finally(() => { armandoRef.current = null; });
    return armandoRef.current;
  };

  // Latido: mientras el CRM esté abierto, renovamos identidad cada 4 min para
  // que las entrantes nos timbren. Solo si la telefonía está configurada.
  useEffect(() => {
    let vivo = true;
    const latido = () => fetch('/api/crm/telefonia/token').then(r => r.json()).then(j => {
      if (!vivo || !j?.token) return;
      setNumero(j.numero || '');
      // Si ya hay Device, se le pone el token fresco; si no, se arma.
      if (deviceRef.current) { try { deviceRef.current.updateToken(j.token); } catch { /* lo reintenta el siguiente */ } }
      else asegurarDevice().catch(() => {});   // registrar el Device para RECIBIR
    }).catch(() => {});
    latido();
    const t = setInterval(() => { if (!document.hidden) latido(); }, 4 * 60e3);
    /* Volver a la app es el momento crítico. En un PWA la pestaña se CONGELA:
       los temporizadores no corren, así que `tokenWillExpire` nunca dispara y
       el token caduca sin que nadie lo renueve. Al reaparecer, el SDK intenta
       usarlo y suelta el 20101 que se vio en pantalla. Renovarlo aquí, antes
       de que lo use, es lo que evita el error en vez de curarlo. */
    const alVolver = () => { if (!document.hidden) latido(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', alVolver); deviceRef.current?.destroy?.(); };
  }, []);

  /* MEJORA 5 · QUE NO SE PIERDA UNA ENTRANTE.
     El tono solo suena si la pestaña tiene permiso de audio, y en el teléfono
     casi nunca la tienes al frente. Se agrega lo que sí atraviesa: una
     notificación del sistema (con permiso) y vibración. La vibración es la que
     de verdad funciona en el celular con la pantalla apagada. */
  useEffect(() => {
    if (!entrante) return;
    const de = telefonoLegible(entrante.parameters?.From || '');
    let aviso: any = null;
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        aviso = new Notification('Llamada entrante', { body: de, tag: 'tel-entrante', requireInteraction: true });
        aviso.onclick = () => { window.focus(); aviso.close(); };
      }
    } catch { /* el navegador no las da */ }
    let vibrando: any = null;
    try {
      if (navigator.vibrate) { navigator.vibrate([400, 300, 400]); vibrando = setInterval(() => navigator.vibrate([400, 300, 400]), 3000); }
    } catch { /* sin motor de vibración */ }
    return () => { clearInterval(vibrando); try { navigator.vibrate?.(0); aviso?.close?.(); } catch { /* ya cerrada */ } };
  }, [entrante]);

  /* El permiso de notificación se pide UNA vez, cuando ya hay telefonía —no al
     entrar al CRM—: pedirlo de golpe al cargar es lo que hace que la gente le
     dé «Bloquear» para siempre. */
  useEffect(() => {
    if (!numero || !('Notification' in window) || Notification.permission !== 'default') return;
    const t = setTimeout(() => { Notification.requestPermission().catch(() => {}); }, 8000);
    return () => clearTimeout(t);
  }, [numero]);

  /* Un aviso que nadie cierra se queda tapando el tablero para siempre. A los
     12 segundos se va solo — salvo el de «sin configurar», que es una tarea
     pendiente de verdad y tiene que quedarse hasta que alguien la vea. */
  useEffect(() => {
    if (!error || /configurada|Configuración/i.test(error)) return;
    const t = setTimeout(() => setError(''), 12000);
    return () => clearTimeout(t);
  }, [error]);

  // Cronómetro: solo corre cuando ya hay conversación de verdad.
  useEffect(() => {
    if (!viva?.desde) { setSeg(0); return; }
    const t = setInterval(() => setSeg(Math.round((Date.now() - viva.desde!) / 1000)), 1000);
    return () => clearInterval(t);
  }, [viva?.desde]);

  /* Cerrar la pestaña con una llamada viva la corta en seco y, si iba a haber
     minuta, la deja a medias. El navegador solo permite pedir confirmación. */
  useEffect(() => {
    if (!viva) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [!!viva]);

  /* MEJORA 1 · LA PANTALLA NO SE APAGA MIENTRAS HABLAS.
     En el teléfono esto no es comodidad: cuando la pantalla se bloquea, el
     navegador suspende la pestaña y la llamada por WebRTC se corta o se queda
     sin audio a los pocos segundos. `wakeLock` se lo impide mientras dure. Se
     vuelve a pedir al regresar a la pestaña porque el sistema lo suelta solo
     cuando la app pasa a segundo plano. */
  useEffect(() => {
    if (!viva) return;
    let vivo = true;
    const pedir = async () => {
      try { if (vivo && (navigator as any).wakeLock) wakeRef.current = await (navigator as any).wakeLock.request('screen'); }
      catch { /* el navegador no lo da; la llamada sigue */ }
    };
    pedir();
    const alVolver = () => { if (!document.hidden) pedir(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', alVolver);
      try { wakeRef.current?.release?.(); } catch { /* ya se soltó */ }
      wakeRef.current = null;
    };
  }, [!!viva]);

  /* Bandera global: Llamadas.tsx (WhatsApp) y esta comparten micrófono y
     oídos. Sin esto se podía arrancar una llamada de WhatsApp encima de una
     telefónica y ninguna de las dos se oía. */
  useEffect(() => {
    const d = document.documentElement.dataset;
    if (viva) d.telLlamada = '1'; else delete d.telLlamada;
  }, [!!viva]);

  /* MEJORA 4 · CON QUIÉN ESTÁS HABLANDO, ANTES DE QUE CONTESTEN.
     En el escritorio la ficha está al lado; en el teléfono la llamada ocupa
     toda la pantalla y no hay dónde mirar. Se pide en cuanto se sabe el número
     —mientras timbra— para que llegue antes que el «bueno». */
  useEffect(() => {
    const tel = viva?.telefono || entrante?.parameters?.From;
    if (!tel) { setCtx(null); return; }
    let vivo = true;
    fetch(`/api/crm/telefonia/contexto?telefono=${encodeURIComponent(tel)}`)
      .then(r => r.json()).then(j => { if (vivo && j?.hay) setCtx(j); }).catch(() => {});
    return () => { vivo = false; };
  }, [viva?.telefono, entrante]);

  /** Al terminar: preguntar al servidor QUÉ pasó y seguir la minuta. */
  const cerrarCon = useCallback((v: Viva, segFinales: number) => {
    const base: Resumen = {
      sid: v.sid, telefono: v.telefono, nombre: v.nombre, seg: segFinales, direccion: v.direccion,
      desenlace: segFinales > 0 ? 'Llamada terminada' : 'Terminada sin conversación',
      conversationId: null, minuta: segFinales >= 20 ? 'esperando' : 'no-aplica', verificado: false,
    };
    setResumen(base);
    if (!v.sid) return;   // sin CallSid no hay a qué preguntarle

    let intentos = 0;
    const sondear = async () => {
      intentos++;
      const j = await fetch(`/api/crm/telefonia/llamada?call_id=${encodeURIComponent(v.sid!)}`).then(r => r.json()).catch(() => null);
      if (j?.existe) {
        const dur = Number(j.duracion_seg || segFinales || 0);
        setResumen(r => r && r.sid === v.sid ? {
          ...r, verificado: true, seg: dur || r.seg,
          desenlace: desenlaceDe(String(j.estado || ''), dur, v.direccion, j.motivo),
          conversationId: j.conversation_id || null,
          minuta: j.minuta_lista ? 'lista' : j.minuta_esperada ? 'esperando' : 'no-aplica',
        } : r);
        if (j.minuta_lista) { document.dispatchEvent(new CustomEvent('wa-refrescar-hilo')); return; }
        if (!j.minuta_esperada && j.estado && !['timbrando', 'aceptada'].includes(j.estado)) return;
      }
      // La grabación tarda: Twilio la sube, se transcribe y se redacta. Se
      // sondea 3 min y luego se deja de prometer algo que no llegó.
      if (intentos < 36) setTimeout(sondear, 5000);
      else setResumen(r => r && r.sid === v.sid && r.minuta === 'esperando' ? { ...r, minuta: 'falló' } : r);
    };
    setTimeout(sondear, 2500);
  }, []);

  /** Manda el apunte al hilo. Silencioso: nunca estorba al colgar. */
  const guardarNota = useCallback((sid: string | null) => {
    const texto = notaRef.current.trim();
    if (!texto || !sid) return;
    fetch('/api/crm/telefonia/nota', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: sid, texto }),
    }).then(() => { document.dispatchEvent(new CustomEvent('wa-refrescar-hilo')); }).catch(() => {});
    setNota(''); setNotaAbierta(false);
  }, []);

  /** Engancha los eventos del `call` de Twilio a la máquina de estados. */
  const enganchar = (call: any, telefono: string, nombre: string | null, direccion: 'entrante' | 'saliente') => {
    const arranque: Viva = {
      call, telefono, nombre, direccion, sid: call.parameters?.CallSid || null,
      // Una ENTRANTE que acabo de contestar ya está en conversación. Una
      // SALIENTE todavía no: falta que el cliente descuelgue.
      fase: direccion === 'entrante' ? 'en-linea' : 'conectando',
      desde: direccion === 'entrante' ? Date.now() : null,
    };
    setViva(arranque);

    call.on('ringing', () => setViva(v => (v?.call === call ? { ...v, fase: 'timbrando' } : v)));
    call.on('accept', (c: any) => setViva(v => (v?.call === call
      ? { ...v, fase: 'en-linea', desde: v.desde || Date.now(), sid: c?.parameters?.CallSid || v.sid }
      : v)));

    /* Aviso de calidad: `warning` avisa de latencia alta, paquetes perdidos o
       —el más útil— que el micrófono lleva rato mandando SILENCIO absoluto,
       que casi siempre es el mic apagado por hardware. */
    call.on('warning', (n: string) => {
      if (n === 'constant-audio-input-level') setAviso('No se oye nada de tu micrófono. ¿Está apagado o silenciado por hardware?');
      else if (/rtt|jitter|packet|mos/i.test(n)) setAviso('Conexión inestable: puede que se corte el audio.');
    });
    call.on('warning-cleared', () => setAviso(''));

    /* MEJORA 2 · EL MEDIDOR DE VOZ.
       En el teléfono la causa número uno de una llamada muerta es que el
       micrófono no está entrando —permiso a medias, otra app que lo tomó, el
       botón físico de silencio— y desde la pantalla no hay forma de saberlo:
       tú escuchas al cliente perfectamente y él no te oye a ti. Esta barrita
       se mueve con TU voz: si no se mueve, el problema es tuyo. */
    call.on('volume', (entrada: number) => setNivel(Math.min(1, Math.max(0, entrada))));

    const terminar = (motivo?: string) => {
      const v = vivaRef.current;
      if (!v || v.call !== call) return;
      const segFinales = v.desde ? Math.round((Date.now() - v.desde) / 1000) : 0;
      /* MEJORA 3 · EL APUNTE NO SE PIERDE AL COLGAR.
         Lo que se escribe mientras se habla es lo más valioso de la llamada y
         es justo lo que se evapora: al colgar hay que buscar la conversación y
         escribirlo de memoria. Se guarda solo, sin botón, en cuanto cuelgas. */
      guardarNota(v.sid || call?.parameters?.CallSid || null);
      setViva(null); setMute(false); setAviso(''); setTeclado(false); setTonos(''); setNivel(0);
      cerrarCon(v, segFinales);
      if (motivo) setResumen(r => (r ? { ...r, desenlace: motivo } : r));
    };
    call.on('disconnect', () => terminar());
    call.on('cancel', () => terminar('Se canceló antes de contestar'));
    call.on('reject', () => terminar('Rechazada'));
    call.on('error', (e: any) => { setError(explicar(e)); terminar(explicar(e)); });
  };

  /**
   * Llamar desde CUALQUIER parte del CRM.
   *
   * Todo el CRM ya pinta el teléfono como `<a href="tel:…">` — en la ficha del
   * contacto, en el drawer 360, en leads, en cobranza, en cotizaciones. En vez
   * de meterle un botón nuevo a veinte componentes (y pelearme con cada uno),
   * se intercepta el clic en cualquiera de esos enlaces y se marca desde el
   * navegador con el número del negocio como identificador.
   *
   * ── POR QUÉ EN EL CELULAR TAMBIÉN SE LLAMA POR AQUÍ (10-sep-2026) ───────
   * Antes el teléfono se salía al marcador del sistema, con el argumento de
   * que ahí el micrófono ya está resuelto. El argumento era cierto y la
   * decisión estaba mal: una llamada desde el marcador del sistema **no se
   * graba, no se transcribe y no genera minuta**, sale con el número personal
   * de quien marca en vez del número del negocio, y no deja rastro en el CRM.
   * O sea, justo desde donde más se trabaja —el celular— se perdía todo lo
   * que hace que esto sirva. Ahora el celular llama por WebRTC igual que el
   * escritorio, con su pantalla propia.
   *
   * La única salida que queda: sin telefonía configurada el enlace `tel:`
   * sigue funcionando como siempre y nadie se queda sin poder llamar.
   */
  useEffect(() => {
    const alClic = (ev: MouseEvent) => {
      if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.button !== 0) return;
      const a = (ev.target as HTMLElement | null)?.closest?.('a[href^="tel:"]') as HTMLAnchorElement | null;
      if (!a) return;
      if (!numero) return;                                   // sin config, enlace normal

      const e164 = telefonoWhatsApp(decodeURIComponent(a.getAttribute('href')!.slice(4)));
      if (!e164) return;                                     // si no se puede normalizar, que abra el marcador

      ev.preventDefault();
      // El nombre, para que la barra de llamada no diga solo un número: se
      // busca en el propio enlace o en la fila que lo contiene.
      const cerca = a.closest('[data-nombre]') as HTMLElement | null;
      const nombre = cerca?.dataset?.nombre
        || a.getAttribute('data-nombre')
        || a.getAttribute('title')
        || null;
      document.dispatchEvent(new CustomEvent('tel-llamar', { detail: { telefono: e164, nombre } }));
    };
    document.addEventListener('click', alClic, true);
    return () => document.removeEventListener('click', alClic, true);
  }, [numero]);

  // Saliente: la disparan el botón del hilo, la lista del inbox y los tel:.
  useEffect(() => {
    const h = async (ev: any) => {
      const { telefono, nombre } = ev.detail || {};
      setError(''); setAviso('');

      // ── Validaciones ANTES de gastar una llamada ────────────────────────
      if (vivaRef.current) { setError('Ya estás en una llamada. Cuelga antes de marcar otra.'); return; }
      if (salaRef.current) { setError('Estás en una sesión de llamadas. Sal de la sala antes de marcar por tu cuenta.'); return; }
      if (document.documentElement.dataset.waLlamada) { setError('Hay una llamada de WhatsApp en curso. Cuelga esa antes de marcar por teléfono.'); return; }
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setError('Este navegador no puede hacer llamadas (hace falta una conexión segura y soporte de micrófono).'); return; }
      const e164 = telefonoWhatsApp(telefono);
      if (!e164) { setError(`«${telefono || 'vacío'}» no es un teléfono válido. Corrígelo en la ficha del contacto.`); return; }
      if (numero && e164 === numero) { setError('Ese es el número del propio negocio: no puedes llamarte a ti mismo.'); return; }

      setResumen(null);
      setViva({ call: null, telefono: e164, nombre: nombre || null, direccion: 'saliente', fase: 'permiso', desde: null, sid: null });
      try {
        /* El micrófono se pide ANTES de marcar, a propósito. Si lo pide el SDK
           a media conexión, el usuario ve «llamando…» mientras el navegador
           espera un permiso que quizá nunca den, y la llamada muere sin
           explicación. Pidiéndolo aquí, el «no» se ve como lo que es. */
        const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        st.getTracks().forEach(t => t.stop());   // solo era la autorización

        setViva(v => (v ? { ...v, fase: 'conectando' } : v));
        const device = await asegurarDevice();
        const call = await device.connect({ params: { To: e164 } });
        enganchar(call, e164, nombre || null, 'saliente');
      } catch (e: any) {
        setViva(null);
        setError(explicar(e));
      }
    };
    document.addEventListener('tel-llamar', h);
    return () => document.removeEventListener('tel-llamar', h);
  }, [numero]);

  /* ── MODO SALA (Llamadas inteligentes) ──────────────────────────────────
     La cabina (Cabina.tsx) manda `tel-sala {sesion_id}`; aquí se abre la
     línea contra `sala:<id>` y se entra MUDO. El servidor va marcando uno por
     uno dentro de la misma conferencia; cuando confirma que contestó una
     persona, la cabina manda `tel-mute {mute:false}` y el vendedor habla. Todo
     lo que pase en la sala se le cuenta a la cabina con `tel-sala-estado`. */
  useEffect(() => {
    const avisar = (detalle: any) => document.dispatchEvent(new CustomEvent('tel-sala-estado', { detail: detalle }));
    const entrar = async (ev: any) => {
      const id = String(ev.detail?.sesion_id || '');
      if (!id) return;
      // `silencioso`: es un reintento automático de la cabina; los errores no se enseñan (ya hay un aviso de «volviendo a entrar»).
      const silencioso = !!ev.detail?.silencioso;
      const fallo = (error: string) => avisar({ sesion_id: id, en_sala: false, error: silencioso ? undefined : error });
      setError(''); setAviso('');
      if (vivaRef.current) { fallo('Ya estás en una llamada. Cuelga antes de empezar la sesión.'); return; }
      if (salaRef.current) {
        if (salaRef.current.id !== id) { fallo('Ya estás en otra sala.'); return; }
        if (salaRef.current.enSala) { avisar({ sesion_id: id, en_sala: true }); return; }
        // Misma sala, pero la conexión quedó a medias (conectando o muerta): se suelta y se vuelve a entrar.
        try { salaRef.current.call?.disconnect(); } catch { /* ya estaba muerta */ }
        setSala(null);
      }
      if (document.documentElement.dataset.waLlamada) { fallo('Hay una llamada de WhatsApp en curso.'); return; }
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { fallo('Este navegador no puede hacer llamadas (hace falta una conexión segura y micrófono).'); return; }
      try {
        const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        st.getTracks().forEach(t => t.stop());
        const device = await asegurarDevice();
        const call = await device.connect({ params: { To: `sala:${id}` } });
        const s: Sala = { id, call, enSala: false, mute: true };
        setSala(s);
        // Mudo desde el primer instante: en la sala se ESCUCHA hasta que haya una persona.
        try { call.mute(true); } catch { /* aún sin pista */ }
        call.on('accept', () => {
          try { call.mute(true); } catch { /* sin pista */ }
          setSala(x => (x && x.call === call ? { ...x, enSala: true, mute: true } : x));
          avisar({ sesion_id: id, en_sala: true });
        });
        call.on('volume', (entrada: number) => setNivel(Math.min(1, Math.max(0, entrada))));
        const salir = (motivo?: string) => {
          if (salaRef.current?.call !== call) return;
          setSala(null); setNivel(0); setAviso('');
          avisar({ sesion_id: id, en_sala: false, error: motivo });
        };
        call.on('disconnect', () => salir());
        call.on('cancel', () => salir('La central cerró la sala.'));
        call.on('reject', () => salir('La central rechazó la sala.'));
        call.on('error', (e: any) => salir(explicar(e)));
      } catch (e: any) {
        // El error se enseña en la cabina (que es la pantalla), no aquí también.
        setSala(null);
        fallo(explicar(e));
      }
    };
    const mudo = (ev: any) => {
      const s = salaRef.current; if (!s?.call) return;
      const m = !!ev.detail?.mute;
      try { s.call.mute(m); } catch { /* sin pista */ }
      setSala(x => (x ? { ...x, mute: m } : x));
    };
    const colgarSala = () => {
      const s = salaRef.current; if (!s) return;
      try { s.call?.disconnect(); } catch { /* ya estaba muerta */ }
      setTimeout(() => { if (salaRef.current?.call === s.call) { setSala(null); avisar({ sesion_id: s.id, en_sala: false }); } }, 1500);
    };
    const consulta = () => { const s = salaRef.current; avisar({ sesion_id: s?.id || null, en_sala: !!s?.enSala, mute: s?.mute ?? true }); };
    document.addEventListener('tel-sala', entrar);
    document.addEventListener('tel-mute', mudo);
    document.addEventListener('tel-colgar-sala', colgarSala);
    document.addEventListener('tel-sala-consulta', consulta);
    return () => {
      document.removeEventListener('tel-sala', entrar);
      document.removeEventListener('tel-mute', mudo);
      document.removeEventListener('tel-colgar-sala', colgarSala);
      document.removeEventListener('tel-sala-consulta', consulta);
    };
  }, []);

  const contestar = () => {
    const c = entrante; if (!c) return;
    if (salaRef.current) { setError('Estás en una sesión de llamadas. Sal de la sala para contestar.'); return; }
    setEntrante(null); setResumen(null);
    try { c.accept(); enganchar(c, c.parameters?.From || 'desconocido', null, 'entrante'); }
    catch (e: any) { setError(explicar(e)); }
  };
  const rechazar = () => { try { entrante?.reject(); } catch { /* ya no existe */ } setEntrante(null); };
  const rechazarEspera = () => { try { espera?.reject(); } catch { /* ya no existe */ } setEspera(null); };
  const colgar = () => {
    const v = vivaRef.current; if (!v) return;
    setViva(x => (x ? { ...x, fase: 'cerrando' } : x));
    try { v.call?.disconnect(); } catch { /* ya estaba muerta */ }
    // Red de seguridad: si `disconnect` no dispara el evento (pasa cuando la
    // llamada murió del otro lado justo antes), no dejamos la barra colgada.
    setTimeout(() => { if (vivaRef.current?.call === v.call) { setViva(null); cerrarCon(v, v.desde ? Math.round((Date.now() - v.desde) / 1000) : 0); } }, 1500);
  };
  const toggleMute = () => {
    const v = vivaRef.current; if (!v?.call) return;
    try { v.call.mute(!mute); setMute(!mute); } catch { /* sin pista de audio */ }
  };
  const marcarTono = (d: string) => {
    const v = vivaRef.current; if (!v?.call || v.fase !== 'en-linea') return;
    try { v.call.sendDigits(d); setTonos(t => (t + d).slice(-16)); } catch { /* no soportado */ }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const quien = (v: { nombre: string | null; telefono: string }) => v.nombre || telefonoLegible(v.telefono);

  const ETIQUETA: Record<Fase, string> = {
    permiso: 'Pidiendo el micrófono…',
    conectando: 'Conectando con la central…',
    timbrando: 'Timbrando…',
    'en-linea': 'En línea',
    cerrando: 'Colgando…',
  };

  const btn = (bg: string, t: string, onClick: () => void, extra?: React.CSSProperties) => (
    <button onClick={onClick} style={{ border: 'none', background: bg, color: '#fff', borderRadius: 999, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, ...extra }}>{t}</button>
  );

  /* Lo que el contexto aporta en una línea: cuántas veces le has marcado y
     cómo acabó la anterior. Es lo que cambia la primera frase. */
  const resumenCtx = (() => {
    if (!ctx) return null;
    const partes: string[] = [];
    if (ctx.empresa) partes.push(ctx.empresa);
    const n = Number(ctx.llamadas?.total || 0);
    if (n) partes.push(`${n}ª llamada`);
    if (ctx.ultima?.buzon) partes.push('la anterior cayó al buzón');
    else if (ctx.ultima?.estado === 'perdida') partes.push('la anterior no contestó');
    return partes.length ? partes.join(' · ') : null;
  })();

  /** La barrita de voz: se mueve con TU micrófono. */
  const Medidor = ({ oscuro = true }: { oscuro?: boolean }) => (
    <span title="Nivel de tu micrófono" style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} style={{
          width: 3, borderRadius: 2, height: 4 + i * 2.4,
          background: nivel * 5 > i ? (mute ? C.rojo400 : C.emerald300) : (oscuro ? 'rgba(255,255,255,.22)' : C.g200),
          transition: 'background .1s',
        }} />
      ))}
    </span>
  );

  const campoNota = (oscuro: boolean) => (
    <textarea value={nota} onChange={e => setNota(e.target.value)} rows={oscuro ? 3 : 2}
      placeholder="Apunta aquí lo que no quieres olvidar… se guarda en la conversación al colgar"
      style={{
        width: '100%', boxSizing: 'border-box', marginTop: 8, resize: 'none',
        border: `1px solid ${oscuro ? 'rgba(255,255,255,.18)' : C.g200}`, borderRadius: 10,
        background: oscuro ? 'rgba(255,255,255,.08)' : '#fff', color: oscuro ? '#fff' : C.g900,
        padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5,
      }} />
  );

  if (!entrante && !viva && !resumen && !error && !sala) return null;

  /* ── LA TARJETA DE LA SALA ──────────────────────────────────────────────
     Chiquita a propósito: la pantalla grande es la cabina. Aquí solo se ve
     que la línea está abierta, si el micrófono está mudo, y la salida. */
  if (sala && !entrante && !viva) {
    return (
      <div data-tel-panel style={{ position: 'fixed', right: esMovil ? 12 : 18, bottom: esMovil ? 'calc(12px + env(safe-area-inset-bottom))' : 90, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        {error && (
          <div role="alert" style={{ background: '#fff', border: '1px solid #f0c4bd', color: '#C0554E', borderRadius: 10, padding: '8px 12px', fontSize: 12, maxWidth: 300, boxShadow: '0 8px 24px rgba(0,0,0,.10)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#C0554E', fontFamily: 'inherit', fontWeight: 700 }}>x</button>
          </div>
        )}
        <div style={{ background: '#1f1b33', color: '#fff', borderRadius: 12, padding: '9px 12px', boxShadow: '0 10px 30px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', gap: 10, minWidth: 250 }}>
          <span className={sala.enSala ? undefined : 'wa-pulso'} style={{ width: 9, height: 9, borderRadius: 999, background: sala.enSala ? (sala.mute ? '#9B8CFA' : '#4FBF95') : '#E8A838', flexShrink: 0 }} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <b style={{ display: 'block', fontSize: 12.5 }}>{sala.enSala ? (sala.mute ? 'En la sala · micrófono mudo' : 'En la sala · te oyen') : 'Entrando a la sala…'}</b>
            <span style={{ fontSize: 11, color: '#c7c3e6' }}>{sala.enSala && !sala.mute ? 'Estás hablando con el cliente' : 'La central marca por ti; escuchas sin que te oigan'}</span>
          </span>
          {sala.enSala && !sala.mute && (
            <span aria-hidden style={{ width: 4, height: 22, borderRadius: 2, background: 'rgba(255,255,255,.18)', position: 'relative', overflow: 'hidden' }}>
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${Math.round(nivel * 100)}%`, background: '#4FBF95', transition: 'height .08s' }} />
            </span>
          )}
          <button onClick={() => document.dispatchEvent(new CustomEvent('tel-colgar-sala'))} title="Salir de la sala"
            style={{ border: 'none', borderRadius: 8, background: 'rgba(239,122,114,.22)', color: '#fca5a1', padding: '6px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Salir</button>
        </div>
      </div>
    );
  }

  /* ── PANTALLA COMPLETA EN EL TELÉFONO ────────────────────────────────────
     La tarjeta de 320 px es de escritorio. En el celular una llamada es LA
     tarea: ocupa todo, los botones son de pulgar (64 px) y no hay nada más
     que tocar por error. Es también donde caben las cinco mejoras sin apretar
     nada: el medidor de voz, el contexto de con quién hablas y el apunte. */
  /* ── EL CIERRE, TAMBIÉN A PANTALLA COMPLETA ──────────────────────────────
     Al colgar en el teléfono aparecía la tarjeta de 320 px del escritorio,
     encajada al fondo, encima del composer y medio transparente: el desenlace
     se leía a la mitad, «Llamar otra vez» era un contorno gris que no parecía
     botón y la ✕ un punto. Se vio en producción.
     Colgar es un momento propio: la pantalla se queda, te dice qué pasó y te
     ofrece lo único que puedes querer hacer ahora —volver a marcar, ir a la
     conversación, o cerrar— con botones de pulgar. Al inbox se vuelve cuando
     TÚ lo decides, no de golpe. */
  if (esMovil && resumen && !viva && !entrante) {
    const listo = resumen.minuta === 'lista';
    return (
      <div data-tel-panel role="dialog" aria-label="Llamada terminada" style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'linear-gradient(170deg, #241f3d 0%, #111827 62%)',
        color: '#fff', display: 'flex', flexDirection: 'column', padding: '28px 22px calc(26px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 9 }}>
          <span style={{
            width: 84, height: 84, borderRadius: 999, marginBottom: 8,
            background: resumen.seg > 0 ? 'rgba(16,185,129,.16)' : 'rgba(255,255,255,.08)',
            color: resumen.seg > 0 ? C.emerald300 : '#c9c5d8',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          }}>{resumen.seg > 0 ? '✓' : '☎'}</span>

          <b style={{ fontSize: 23, lineHeight: 1.2, maxWidth: '92%' }}>{resumen.nombre || telefonoLegible(resumen.telefono)}</b>
          <span style={{ fontSize: 15, color: '#c9c5d8' }}>
            {resumen.desenlace}{resumen.seg > 0 ? ` · ${fmt(resumen.seg)}` : ''}
          </span>
          {!resumen.verificado && <span style={{ fontSize: 12, color: '#8f8aa3' }}>confirmando con la central…</span>}

          {/* La minuta, con su propio espacio: es lo que la gente espera. */}
          <div style={{ marginTop: 16, width: '100%', maxWidth: 340, background: 'rgba(255,255,255,.07)', borderRadius: 14, padding: '14px 16px', fontSize: 13.5, lineHeight: 1.55 }}>
            {resumen.minuta === 'esperando' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', color: '#d6d3e4' }}>
                <span className="wa-pulso" style={{ width: 9, height: 9, borderRadius: 999, background: '#9B8CFA', flexShrink: 0 }} />
                Escribiendo la minuta…
              </span>
            )}
            {listo && <span style={{ color: C.emerald300, fontWeight: 700 }}>Minuta lista · quedó en la conversación</span>}
            {resumen.minuta === 'no-aplica' && (
              <span style={{ color: '#b6b2c6' }}>
                {resumen.seg >= 20 ? 'Sin minuta: no hubo conversación grabada.' : 'Muy corta para minuta — se transcriben de 20 segundos en adelante.'}
              </span>
            )}
            {resumen.minuta === 'falló' && <span style={{ color: C.ambar300 }}>La minuta no llegó. La grabación sí quedó guardada.</span>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {resumen.conversationId && (
            <button onClick={() => { window.location.href = `/admin/crm?tab=whatsapp&wa_conv=${resumen.conversationId}`; }}
              style={{ border: 'none', background: listo ? C.emerald500 : 'rgba(255,255,255,.14)', color: '#fff', borderRadius: 14, padding: '17px 0', fontSize: 15.5, fontWeight: 800, fontFamily: 'inherit', width: '100%' }}>
              Ver la conversación
            </button>
          )}
          <button onClick={() => { setResumen(null); document.dispatchEvent(new CustomEvent('tel-llamar', { detail: { telefono: resumen.telefono, nombre: resumen.nombre } })); }}
            style={{ border: '1px solid rgba(255,255,255,.22)', background: 'transparent', color: '#fff', borderRadius: 14, padding: '16px 0', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', width: '100%' }}>
            Llamar otra vez
          </button>
          <button onClick={() => setResumen(null)}
            style={{ border: 'none', background: 'none', color: '#8f8aa3', borderRadius: 12, padding: '14px 0', fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit', width: '100%' }}>
            Listo
          </button>
        </div>
      </div>
    );
  }

  if (esMovil && (viva || entrante)) {
    return (
      <div data-tel-panel role="dialog" aria-label="Llamada telefónica" style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'linear-gradient(170deg, #241f3d 0%, #111827 62%)',
        color: '#fff', display: 'flex', flexDirection: 'column', padding: '28px 22px calc(26px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 10 }}>
          <span className={viva?.fase === 'en-linea' ? undefined : 'wa-pulso'} style={{
            width: 96, height: 96, borderRadius: 999, marginBottom: 6,
            background: viva?.fase === 'en-linea' ? C.emerald500 : '#9B8CFA',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
          }}>☎</span>

          <b style={{ fontSize: 25, lineHeight: 1.2, maxWidth: '92%' }}>
            {viva ? (viva.nombre || telefonoLegible(viva.telefono)) : (ctx?.nombre || telefonoLegible(entrante?.parameters?.From || ''))}
          </b>
          <span style={{ fontSize: 14, color: '#c9c5d8' }}>
            {telefonoLegible(viva?.telefono || entrante?.parameters?.From || '')}
          </span>

          {/* MEJORA 4 en pantalla: con quién hablas, sin salir de la llamada. */}
          {resumenCtx && <span style={{ fontSize: 12.5, color: '#9B8CFA', fontWeight: 600 }}>{resumenCtx}</span>}
          {ctx?.proximoPaso && viva?.fase !== 'en-linea' && (
            <span style={{ fontSize: 12, color: '#c9c5d8', background: 'rgba(255,255,255,.07)', borderRadius: 10, padding: '8px 12px', maxWidth: 320, lineHeight: 1.5 }}>
              Quedó pendiente: {ctx.proximoPaso}
            </span>
          )}

          <span style={{ fontSize: 15, marginTop: 8, color: viva?.fase === 'en-linea' ? C.emerald300 : '#d1d5db', display: 'inline-flex', alignItems: 'center', gap: 9, fontVariantNumeric: 'tabular-nums' }}>
            {viva ? (viva.fase === 'en-linea' ? fmt(seg) : ETIQUETA[viva.fase]) : 'Te está llamando'}
            {viva?.fase === 'en-linea' && <Medidor />}
          </span>

          {aviso && <span style={{ fontSize: 12, color: C.ambar300, background: 'rgba(251,191,36,.13)', borderRadius: 10, padding: '8px 12px', maxWidth: 320, lineHeight: 1.45 }}>{aviso}</span>}
          {/* Un error DURANTE la llamada tiene que verse aquí: esta pantalla
              tapa todo, así que el aviso de abajo nunca se vería. */}
          {error && (
            <span role="alert" onClick={() => setError('')} style={{ fontSize: 12.5, color: '#fff', background: 'rgba(239,68,68,.9)', borderRadius: 12, padding: '11px 14px', maxWidth: 330, lineHeight: 1.5, cursor: 'pointer' }}>
              {error}
              <b style={{ display: 'block', marginTop: 5, fontSize: 11, opacity: .85 }}>Toca para cerrar</b>
            </span>
          )}
          {espera && <span style={{ fontSize: 12, color: C.ambar300 }}>Otra llamada entrando: {telefonoLegible(espera.parameters?.From || '')}</span>}
        </div>

        {/* MEJORA 3 en pantalla: el apunte, a un toque y sin salir. */}
        {viva?.fase === 'en-linea' && (
          <div style={{ marginBottom: 14 }}>
            <button onClick={() => setNotaAbierta(v => !v)}
              style={{ border: 'none', background: 'rgba(255,255,255,.1)', color: '#fff', borderRadius: 999, padding: '9px 16px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', width: '100%' }}>
              {notaAbierta ? 'Ocultar el apunte' : (nota.trim() ? '📝 Apunte guardado al colgar' : '📝 Apuntar algo')}
            </button>
            {notaAbierta && campoNota(true)}
            {notaAbierta && teclado === false && (
              <button onClick={() => setTeclado(true)}
                style={{ marginTop: 8, border: 'none', background: 'rgba(255,255,255,.07)', color: '#c9c5d8', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontFamily: 'inherit', width: '100%' }}>Abrir teclado de tonos</button>
            )}
          </div>
        )}

        {teclado && viva?.fase === 'en-linea' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(d => (
              <button key={d} onClick={() => marcarTono(d)} style={{ border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', borderRadius: 12, padding: '14px 0', fontSize: 19, fontWeight: 700, fontFamily: 'inherit' }}>{d}</button>
            ))}
          </div>
        )}

        {/* Botonera de pulgar: 64 px, separada del borde. */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          {entrante ? (<>
            <button onClick={rechazar} aria-label="Rechazar" style={{ width: 68, height: 68, borderRadius: 999, border: 'none', background: C.rojo500, color: '#fff', fontSize: 24, fontFamily: 'inherit' }}>✕</button>
            <button onClick={contestar} aria-label="Contestar" style={{ width: 68, height: 68, borderRadius: 999, border: 'none', background: C.emerald500, color: '#fff', fontSize: 24, fontFamily: 'inherit' }}>☎</button>
          </>) : (<>
            <button onClick={toggleMute} aria-label={mute ? 'Activar micrófono' : 'Silenciar'}
              style={{ width: 64, height: 64, borderRadius: 999, border: 'none', background: mute ? C.ambar400 : 'rgba(255,255,255,.14)', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
              {mute ? 'Mic off' : 'Mic'}
            </button>
            <button onClick={colgar} aria-label="Colgar"
              style={{ width: 76, height: 76, borderRadius: 999, border: 'none', background: C.rojo500, color: '#fff', fontSize: 26, fontFamily: 'inherit' }}>☎</button>
            <button onClick={() => setTeclado(t => !t)} aria-label="Teclado" disabled={viva?.fase !== 'en-linea'}
              style={{ width: 64, height: 64, borderRadius: 999, border: 'none', background: teclado ? '#9B8CFA' : 'rgba(255,255,255,.14)', color: '#fff', fontSize: 20, fontFamily: 'inherit', opacity: viva?.fase === 'en-linea' ? 1 : .4 }}>⌨</button>
          </>)}
        </div>

        <div style={{ marginTop: 16, fontSize: 11.5, color: '#8f8aa3', textAlign: 'center', lineHeight: 1.5 }}>
          Se está grabando · al colgar se escribe la minuta sola
        </div>
      </div>
    );
  }


  const tarjeta: React.CSSProperties = {
    background: C.g900, color: '#fff', borderRadius: 16, padding: 14,
    boxShadow: '0 18px 50px rgba(0,0,0,.4)', width: 'min(320px, calc(100vw - 32px))',
  };

  /* Dónde vive esta barra, que no es un capricho:
     - ABAJO A LA DERECHA, no arriba al centro: arriba vive el banner de las
       llamadas de WhatsApp (Llamadas.tsx, top 10). Cuando las dos se prendían
       a la vez salían encimadas y no se entendía cuál era cuál.
     - `bottom: 90` y no 18: en esa esquina ya estaba el botón flotante del
       equipo (58 px de alto pegado abajo). A ras de piso la tarjeta le caía
       justo encima.
     - `zIndex` por arriba de TODO (ese botón usa 899): una llamada en curso es
       lo más urgente de la pantalla; que algo la tape no es una opción. */
  return (
    <div data-tel-panel style={{ position: 'fixed', right: 18, bottom: 90, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>

      {/* ── ENTRANTE ─────────────────────────────────────────────────────── */}
      {entrante && (
        <div role="alert" style={tarjeta}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
            <span className="wa-pulso" style={{ width: 38, height: 38, borderRadius: 999, background: '#9B8CFA', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <b style={{ display: 'block', fontSize: 14 }}>{telefonoLegible(entrante.parameters?.From || '')}</b>
              <span style={{ fontSize: 11.5, color: '#d1d5db' }}>Te está llamando por teléfono</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {btn(C.emerald500, 'Contestar', contestar, { flex: 1 })}
            {btn(C.rojo500, 'Rechazar', rechazar, { flex: 1 })}
          </div>
        </div>
      )}

      {/* ── LLAMADA EN CURSO ─────────────────────────────────────────────── */}
      {viva && (
        <div style={tarjeta}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span
              className={viva.fase === 'en-linea' ? undefined : 'wa-pulso'}
              style={{
                width: 44, height: 44, borderRadius: 999, flexShrink: 0,
                background: viva.fase === 'en-linea' ? C.emerald500 : '#9B8CFA',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
              }}>
              {viva.fase === 'en-linea' ? fmt(seg) : '☎'}
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <b style={{ display: 'block', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quien(viva)}</b>
              <span style={{ fontSize: 11.5, color: viva.fase === 'en-linea' ? C.emerald300 : '#d1d5db', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ETIQUETA[viva.fase]}{viva.nombre ? ` · ${telefonoLegible(viva.telefono)}` : ''}
                </span>
                {viva.fase === 'en-linea' && <Medidor />}
              </span>
              {resumenCtx && <span style={{ display: 'block', fontSize: 11, color: '#9B8CFA', fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumenCtx}</span>}
            </span>
          </div>

          {aviso && (
            <div style={{ marginTop: 10, background: 'rgba(251,191,36,.14)', color: C.ambar300, borderRadius: 9, padding: '7px 10px', fontSize: 11, lineHeight: 1.45 }}>{aviso}</div>
          )}

          {espera && (
            <div style={{ marginTop: 10, background: 'rgba(255,255,255,.09)', borderRadius: 9, padding: '7px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="wa-pulso" style={{ width: 7, height: 7, borderRadius: 999, background: C.ambar400, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>Otra llamada entrando: {telefonoLegible(espera.parameters?.From || '')}</span>
              <button onClick={rechazarEspera} style={{ border: 'none', background: 'none', color: C.rojo300, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Rechazar</button>
            </div>
          )}

          {viva.fase === 'en-linea' && (
            <div style={{ marginTop: 10 }}>
              <button onClick={() => setNotaAbierta(v => !v)}
                style={{ border: 'none', background: 'rgba(255,255,255,.1)', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left' }}>
                {notaAbierta ? '📝 Ocultar el apunte' : (nota.trim() ? '📝 Apunte listo — se guarda al colgar' : '📝 Apuntar algo de esta llamada')}
              </button>
              {notaAbierta && campoNota(true)}
            </div>
          )}

          {teclado && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: '#d1d5db', marginBottom: 6, minHeight: 14, fontVariantNumeric: 'tabular-nums' }}>{tonos || 'Marca las opciones del menú'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(d => (
                  <button key={d} onClick={() => marcarTono(d)} style={{ border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', borderRadius: 8, padding: '9px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{d}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 7, marginTop: 12 }}>
            {btn(mute ? C.ambar400 : 'rgba(255,255,255,.15)', mute ? 'Mic apagado' : 'Silenciar', toggleMute, { flex: 1, padding: '7px 8px' })}
            {viva.fase === 'en-linea' && btn(teclado ? '#9B8CFA' : 'rgba(255,255,255,.15)', 'Teclas', () => setTeclado(t => !t), { flex: 0, padding: '7px 12px' })}
            {btn(C.rojo500, viva.fase === 'en-linea' ? 'Colgar' : 'Cancelar', colgar, { flex: 1, padding: '7px 8px' })}
          </div>

          <div style={{ marginTop: 9, fontSize: 10.5, color: '#9CA3AF', lineHeight: 1.45 }}>
            Se está grabando. Al colgar, si la llamada pasa de 20 segundos, la minuta se escribe sola.
          </div>
        </div>
      )}

      {/* ── RESUMEN + MINUTA ─────────────────────────────────────────────── */}
      {resumen && !viva && (
        <div style={{ ...tarjeta, background: '#fff', color: C.g900, border: `1px solid ${C.g200}`, boxShadow: '0 18px 50px rgba(0,0,0,.16)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ minWidth: 0, flex: 1 }}>
              <b style={{ display: 'block', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quien(resumen)}</b>
              <span style={{ fontSize: 11.5, color: C.g500 }}>
                {resumen.desenlace}{resumen.seg > 0 ? ` · ${fmt(resumen.seg)}` : ''}
                {!resumen.verificado && ' · confirmando…'}
              </span>
            </span>
            <button onClick={() => document.dispatchEvent(new CustomEvent('tel-llamar', { detail: { telefono: resumen.telefono, nombre: resumen.nombre } }))}
              title="Volver a llamar" aria-label="Volver a llamar"
              style={{ border: `1px solid ${C.g200}`, background: '#fff', cursor: 'pointer', color: C.g700, fontSize: 11, fontWeight: 700, borderRadius: 8, padding: '4px 9px', fontFamily: 'inherit', flexShrink: 0 }}>Llamar otra vez</button>
            <button onClick={() => setResumen(null)} aria-label="Cerrar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.g400, fontSize: 15, lineHeight: 1, padding: 2, flexShrink: 0 }}>✕</button>
          </div>

          <div style={{ marginTop: 10, borderTop: `1px solid ${C.g100}`, paddingTop: 10, fontSize: 11.5, lineHeight: 1.5 }}>
            {resumen.minuta === 'esperando' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.g700 }}>
                <span className="wa-pulso" style={{ width: 8, height: 8, borderRadius: 999, background: C.morado, flexShrink: 0 }} />
                Transcribiendo y redactando la minuta… (suele tardar un minuto)
              </span>
            )}
            {resumen.minuta === 'lista' && (
              <>
                <b style={{ color: C.emerald700 }}>Minuta lista.</b> Quedó en la conversación y en la ficha del contacto.
                {resumen.conversationId && (
                  <button onClick={() => { window.location.href = `/admin/crm?tab=whatsapp&wa_conv=${resumen.conversationId}`; }}
                    style={{ display: 'block', marginTop: 8, border: 'none', background: C.emerald600, color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                    Ver en la conversación
                  </button>
                )}
              </>
            )}
            {resumen.minuta === 'no-aplica' && (
              <span style={{ color: C.g500 }}>
                {resumen.seg >= 20
                  ? 'Sin minuta: no llegó a haber conversación grabada.'
                  : 'Muy corta para minuta: se transcriben las llamadas de 20 segundos en adelante.'}
              </span>
            )}
            {resumen.minuta === 'falló' && (
              <span style={{ color: C.ambar700 }}>
                La minuta no llegó en tres minutos. La grabación sí quedó guardada: revísala más tarde en la conversación.
              </span>
            )}
            {!resumen.conversationId && resumen.verificado && resumen.minuta !== 'no-aplica' && (
              <span style={{ display: 'block', marginTop: 8, color: C.g400, fontSize: 10.5 }}>
                Este teléfono no tiene conversación en el inbox, así que la minuta queda solo en el historial de llamadas.
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── ERROR ────────────────────────────────────────────────────────── */}
      {/* ── EL AVISO DE ERROR, QUE SE PUEDA CERRAR DE VERDAD ────────────────
          La ✕ era un carácter suelto sin tamaño: un blanco de diez píxeles
          flotando a la derecha del texto. Con el ratón se acierta; con el
          pulgar no, y en producción se vio — el aviso se quedaba pegado en el
          tablero sin forma de quitarlo. Ahora el botón mide 44 px (el mínimo
          para un dedo), y además TODO el recuadro cierra al tocarlo: cuando
          algo estorba, lo natural es picarle encima. */}
      {error && (
        <div role="alert" onClick={() => setError('')}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', background: C.rojo50, color: C.rojo700, border: `1px solid ${C.rojo200}`, borderRadius: 12, padding: '10px 6px 10px 12px', fontSize: 12, lineHeight: 1.5, width: 'min(340px, calc(100vw - 24px))', boxShadow: '0 10px 30px rgba(0,0,0,.16)' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            {error}
            {/configurada|Configuración/i.test(error) && (
              <a href="/admin/crm?tab=whatsapp&wa_config=telefonia" onClick={e => e.stopPropagation()}
                style={{ display: 'block', marginTop: 6, color: C.rojo700, fontWeight: 800 }}>Abrir Configuración → Telefonía ↗</a>
            )}
          </span>
          <button onClick={e => { e.stopPropagation(); setError(''); }} aria-label="Cerrar el aviso"
            style={{ width: 44, height: 44, marginTop: -10, marginRight: -2, border: 'none', background: 'none', cursor: 'pointer', color: C.rojo700, fontWeight: 800, fontSize: 16, fontFamily: 'inherit', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}
    </div>
  );
}
