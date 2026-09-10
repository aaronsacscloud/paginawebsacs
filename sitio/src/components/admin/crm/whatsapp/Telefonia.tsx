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
  const deviceRef = useRef<any>(null);
  const vivaRef = useRef<Viva | null>(null); vivaRef.current = viva;
  useTono(!!entrante);

  const asegurarDevice = async (): Promise<any> => {
    if (deviceRef.current) return deviceRef.current;
    const r = await fetch('/api/crm/telefonia/token').then(x => x.json()).catch(() => null);
    if (!r?.token) {
      throw new Error(r?.faltantes?.length
        ? `La telefonía no está configurada (faltan ${r.faltantes.length} datos). Ve a Configuración → WhatsApp → Telefonía.`
        : (r?.error || 'No se pudo abrir la línea telefónica.'));
    }
    setNumero(r.numero);
    if (!DeviceCtor) DeviceCtor = (await import('@twilio/voice-sdk')).Device;
    const device = new DeviceCtor(r.token, { codecPreferences: ['opus', 'pcmu'] });
    device.on('error', (e: any) => setError(explicar(e)));
    device.on('tokenWillExpire', async () => {
      const t = await fetch('/api/crm/telefonia/token').then(x => x.json()).catch(() => null);
      if (t?.token) device.updateToken(t.token);
    });
    device.on('incoming', (call: any) => {
      /* Llamada en espera: si ya estoy hablando, la segunda NO se traga en
         silencio. Antes se hacía `return` y quien llamaba escuchaba el tono
         hasta que Twilio se rendía, sin que nadie en el CRM se enterara. */
      if (vivaRef.current) {
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
  };

  // Latido: mientras el CRM esté abierto, renovamos identidad cada 4 min para
  // que las entrantes nos timbren. Solo si la telefonía está configurada.
  useEffect(() => {
    let vivo = true;
    const latido = () => fetch('/api/crm/telefonia/token').then(r => r.json()).then(j => {
      if (!vivo || !j?.token) return;
      setNumero(j.numero || '');
      asegurarDevice().catch(() => {});   // registrar el Device para RECIBIR
    }).catch(() => {});
    latido();
    const t = setInterval(() => { if (!document.hidden) latido(); }, 4 * 60e3);
    return () => { vivo = false; clearInterval(t); deviceRef.current?.destroy?.(); };
  }, []);

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

  /* Bandera global: Llamadas.tsx (WhatsApp) y esta comparten micrófono y
     oídos. Sin esto se podía arrancar una llamada de WhatsApp encima de una
     telefónica y ninguna de las dos se oía. */
  useEffect(() => {
    const d = document.documentElement.dataset;
    if (viva) d.telLlamada = '1'; else delete d.telLlamada;
  }, [!!viva]);

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

    const terminar = (motivo?: string) => {
      const v = vivaRef.current;
      if (!v || v.call !== call) return;
      const segFinales = v.desde ? Math.round((Date.now() - v.desde) / 1000) : 0;
      setViva(null); setMute(false); setAviso(''); setTeclado(false); setTonos('');
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
   * Dos salidas a propósito:
   *  - En un TELÉFONO no se intercepta: ahí el marcador del sistema es mejor
   *    que una llamada por WebRTC, y además ya trae el micrófono resuelto.
   *  - Sin telefonía configurada tampoco: el enlace sigue funcionando como
   *    siempre y nadie se queda sin poder llamar.
   */
  useEffect(() => {
    const alClic = (ev: MouseEvent) => {
      if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.button !== 0) return;
      const a = (ev.target as HTMLElement | null)?.closest?.('a[href^="tel:"]') as HTMLAnchorElement | null;
      if (!a) return;
      if (!numero) return;                                   // sin config, enlace normal
      if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;  // en el celular, el marcador del sistema

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

  const contestar = () => {
    const c = entrante; if (!c) return;
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

  if (!entrante && !viva && !resumen && !error) return null;

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
              <span style={{ fontSize: 11.5, color: viva.fase === 'en-linea' ? C.emerald300 : '#d1d5db' }}>
                {ETIQUETA[viva.fase]}
                {viva.nombre ? ` · ${telefonoLegible(viva.telefono)}` : ''}
              </span>
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
      {error && (
        <div role="alert" style={{ background: C.rojo50, color: C.rojo700, border: `1px solid ${C.rojo200}`, borderRadius: 12, padding: '10px 12px', fontSize: 11.5, lineHeight: 1.5, width: 'min(320px, calc(100vw - 32px))', boxShadow: '0 10px 30px rgba(0,0,0,.12)' }}>
          {error}
          {/configurada|Configuración/i.test(error) && (
            <a href="/admin/crm?tab=whatsapp&wa_config=telefonia" style={{ display: 'block', marginTop: 6, color: C.rojo700, fontWeight: 800 }}>Abrir Configuración → Telefonía ↗</a>
          )}
          <button onClick={() => setError('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.rojo700, fontWeight: 800, marginLeft: 6, float: 'right' }}>✕</button>
        </div>
      )}
    </div>
  );
}
