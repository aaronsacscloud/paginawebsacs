// La caja de escribir. Enter manda, Shift+Enter baja de línea. @ abre la lista
// del equipo, el emoji y el GIF salen de sus botones, las imágenes entran por
// botón, pegado o arrastre, y el micrófono graba, sube y transcribe antes de
// mandar. Lo que se sube va DIRECTO al bucket con una URL firmada (Vercel no
// deja pasar cuerpos de más de 4.5 MB por la función).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Adjunto, GrupoMencion, ItemMencion, Mensaje, Persona, TipoCita } from './api';
import { api } from './api';
import { Emojis, Ic, useFuera, textoPlano, Avatar } from './ui';

type Candidato = { k: string; persona?: Persona; item?: ItemMencion; grupo?: string };
const sinAcentos = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const TIPO_CORTO: Record<TipoCita, string> = { cotizacion: 'Cot', cliente: 'Cliente', lead: 'Lead', pago: 'Pago', cobranza: 'Cobranza' };
const TIPO_LARGO: Record<TipoCita, string> = { cotizacion: 'cotización', cliente: 'cliente', lead: 'lead', pago: 'pago', cobranza: 'cobranza' };
const PALABRAS: [RegExp, TipoCita][] = [
  [/^cotizaci[oó]n(es)?$|^cot$/i, 'cotizacion'], [/^clientes?$|^cuenta$/i, 'cliente'], [/^leads?$|^prospecto$/i, 'lead'],
  [/^pagos?$/i, 'pago'], [/^cobranza$|^deuda$|^vencidos?$/i, 'cobranza'],
];
/** "cotización bella" → { tipo: 'cotizacion', texto: 'bella' }; "bella" → { tipo: null, texto: 'bella' }. */
function partirConsulta(q: string): { tipo: TipoCita | null; texto: string } {
  const [primera, ...resto] = q.split(/\s+/);
  const tipo = PALABRAS.find(([re]) => re.test(primera))?.[1] || null;
  if (tipo) return { tipo, texto: resto.join(' ').trim() };
  return { tipo: null, texto: q.trim() };
}

type Pend = { key: string; tipo: 'imagen' | 'audio' | 'gif'; estado: 'subiendo' | 'transcribiendo' | 'listo' | 'error'; preview?: string; adj?: Adjunto; err?: string };

export type CajaProps = {
  canalId: string;
  placeholder: string;
  personas: Persona[];
  yoId: string;
  respondeA: Mensaje | null;
  onQuitarResp: () => void;
  editando: Mensaje | null;
  onCancelarEdicion: () => void;
  onEnviar: (texto: string, adjuntos: Adjunto[]) => Promise<void>;
  onEditar: (id: string, texto: string) => Promise<void>;
  onAviso: (m: string) => void;
  autoFoco?: boolean;
  bloqueada?: string | null;
};

// ── Miniatura y reducción de imagen en el navegador (sin sharp) ────────────
async function cargarImagen(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((ok, no) => { img.onload = () => ok(); img.onerror = () => no(new Error('No es una imagen')); img.src = url; });
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}
function encoger(img: HTMLImageElement, max: number, calidad: number): Promise<{ blob: Blob; w: number; h: number }> {
  const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * r), h = Math.round(img.naturalHeight * r);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return new Promise(ok => c.toBlob(b => ok({ blob: b!, w, h }), 'image/jpeg', calidad));
}
async function subirBlob(tipo: 'imagen' | 'audio' | 'thumb', blob: Blob, nombre?: string): Promise<string> {
  const { path, url } = await api.subir({ tipo, mime: blob.type, bytes: blob.size, nombre });
  const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': blob.type, 'x-upsert': 'true' }, body: blob });
  if (!r.ok) throw new Error(`No se pudo subir (${r.status})`);
  return path;
}

export default function Caja(p: CajaProps) {
  const [texto, setTexto] = useState('');
  const [pend, setPend] = useState<Pend[]>([]);
  const [pop, setPop] = useState<null | 'emoji' | 'gif'>(null);
  const [gifQ, setGifQ] = useState('');
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string; w: number; h: number }[]>([]);
  const [gifSinLlave, setGifSinLlave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [men, setMen] = useState<{ desde: number; q: string; sel: number } | null>(null);
  // Lo que el servidor trae para el @ (cotizaciones, clientes, leads, pagos,
  // cobranza). Las personas se filtran aquí; lo demás se pide con pausa corta.
  const [grupos, setGrupos] = useState<GrupoMencion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [grab, setGrab] = useState<{ desde: number; niveles: number[] } | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const marco = useRef<HTMLDivElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const rec = useRef<{ mr: MediaRecorder; chunks: Blob[]; stream: MediaStream; ctx?: AudioContext; raf?: number } | null>(null);
  useFuera(marco, () => setPop(null), !!pop);

  // Al editar, la caja se llena con el mensaje; al cancelar, se vacía.
  useEffect(() => {
    if (p.editando) { setTexto(p.editando.texto); setPend([]); setTimeout(() => ta.current?.focus(), 0); }
    else setTexto('');
  }, [p.editando?.id]);
  useEffect(() => { if (p.autoFoco) ta.current?.focus(); }, [p.canalId]);
  useEffect(() => { if (p.respondeA) ta.current?.focus(); }, [p.respondeA?.id]);

  // Altura que crece con el texto.
  useEffect(() => {
    const el = ta.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = Math.min(200, el.scrollHeight) + 'px';
  }, [texto]);

  // GIFs: buscar con pausa de 350 ms.
  useEffect(() => {
    if (pop !== 'gif') return;
    const t = setTimeout(() => {
      api.gifs(gifQ).then(r => { setGifs(r.gifs || []); setGifSinLlave(!!r.sin_llave); }).catch(() => setGifs([]));
    }, gifQ ? 350 : 0);
    return () => clearTimeout(t);
  }, [gifQ, pop]);

  // "@cotización bella" → tipo cotizacion + texto "bella"; "@bella" → todo.
  const consulta = useMemo(() => men ? partirConsulta(men.q) : null, [men?.q]);

  useEffect(() => {
    if (!consulta) { setGrupos([]); setBuscando(false); return; }
    const { tipo, texto } = consulta;
    if (!tipo && texto.length < 2) { setGrupos([]); setBuscando(false); return; }
    let vivo = true; setBuscando(true);
    const t = setTimeout(() => {
      api.menciones(texto, tipo).then(r => { if (vivo) { setGrupos(r.grupos || []); setBuscando(false); } }).catch(() => { if (vivo) { setGrupos([]); setBuscando(false); } });
    }, 180);
    return () => { vivo = false; clearTimeout(t); };
  }, [consulta?.tipo, consulta?.texto]);

  // Una sola lista plana para las flechas: personas primero, luego cada grupo.
  const candidatos = useMemo<Candidato[]>(() => {
    if (!men || !consulta) return [];
    const q = consulta.texto.toLowerCase();
    const personas: Candidato[] = consulta.tipo ? [] : p.personas.filter(x => x.id !== p.yoId && sinAcentos(x.nombre).includes(sinAcentos(q))).slice(0, 5).map(per => ({ k: 'p:' + per.id, persona: per }));
    const items: Candidato[] = grupos.flatMap(g => g.items.map(it => ({ k: it.tipo + ':' + it.id, item: it, grupo: g.etiqueta })));
    return [...personas, ...items];
  }, [men, consulta, grupos, p.personas, p.yoId]);

  const listo = !enviando && !grab && (texto.trim().length > 0 || pend.some(x => x.estado === 'listo')) && !pend.some(x => x.estado === 'subiendo' || x.estado === 'transcribiendo');

  const insertar = (s: string) => {
    const el = ta.current; if (!el) { setTexto(t => t + s); return; }
    const a = el.selectionStart, b = el.selectionEnd;
    const nuevo = texto.slice(0, a) + s + texto.slice(b);
    setTexto(nuevo);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + s.length; });
  };

  // Persona: @[Nombre](uuid). Cotización/cliente/lead/pago/cobranza:
  // @[Nombre](tipo:uuid). El servidor saca de ahí las citas del mensaje.
  const elegirMencion = (c: Candidato) => {
    if (!men) return;
    const el = ta.current!;
    const nombre = (c.persona ? c.persona.nombre : c.item!.nombre).replace(/[\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
    const ficha = c.persona ? `@[${nombre}](${c.persona.id}) ` : `@[${nombre}](${c.item!.tipo}:${c.item!.id}) `;
    const nuevo = texto.slice(0, men.desde) + ficha + texto.slice(el.selectionStart);
    setTexto(nuevo); setMen(null);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = men.desde + ficha.length; });
  };

  // Tocar "@cotización" en la pista: deja la palabra puesta y lista lo reciente.
  const elegirTipo = (t: TipoCita) => {
    if (!men) return;
    const el = ta.current!;
    const palabra = `@${TIPO_LARGO[t]} `;
    const nuevo = texto.slice(0, men.desde) + palabra + texto.slice(el.selectionStart);
    setTexto(nuevo); setMen({ desde: men.desde, q: TIPO_LARGO[t] + ' ', sel: 0 });
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = men.desde + palabra.length; });
  };

  const alEscribir = (v: string) => {
    setTexto(v);
    const el = ta.current; const pos = el ? el.selectionStart : v.length;
    const antes = v.slice(0, pos);
    // Con la palabra del tipo adelante se permite UN espacio: "@cotización bella".
    const m = /(^|\s)@((?:cotizaci[oó]n(?:es)?|cot|clientes?|cuenta|leads?|prospecto|pagos?|cobranza|deuda|vencidos?)(?:\s[^\s@]{0,30})?|[^\s@]{0,30})$/i.exec(antes);
    if (m) setMen({ desde: pos - m[2].length - 1, q: m[2], sel: 0 });
    else setMen(null);
  };

  const teclas = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Esc con el selector de @ abierto solo lo cierra: no debe llegar al widget (que cerraría el chat entero).
    if (men && e.key === 'Escape') { e.stopPropagation(); setMen(null); return; }
    if (men && candidatos.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMen({ ...men, sel: (men.sel + 1) % candidatos.length }); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMen({ ...men, sel: (men.sel - 1 + candidatos.length) % candidatos.length }); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const c = candidatos[men.sel] || candidatos[0]; if (c) elegirMencion(c); return; }
    }
    if (e.key === 'Escape') { if (p.editando) { e.stopPropagation(); p.onCancelarEdicion(); } else if (p.respondeA) { e.stopPropagation(); p.onQuitarResp(); } return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
  };

  const enviar = async () => {
    if (!listo) return;
    setEnviando(true);
    try {
      if (p.editando) { await p.onEditar(p.editando.id, texto.trim()); }
      else {
        await p.onEnviar(texto.trim(), pend.filter(x => x.estado === 'listo' && x.adj).map(x => x.adj!));
        setPend([]);
      }
      setTexto(''); setMen(null); setPop(null);
      ta.current?.focus();
    } catch (e: any) { p.onAviso(e.message || 'No se pudo enviar'); }
    finally { setEnviando(false); }
  };

  // ── Imágenes ──
  const agregarImagen = async (file: File) => {
    if (!/^image\/(jpeg|png|webp|gif|heic)/i.test(file.type)) { p.onAviso('Solo imágenes (JPG, PNG, WebP, GIF)'); return; }
    if (file.size > 10 * 1024 * 1024) { p.onAviso('La imagen pesa más de 10 MB'); return; }
    if (pend.length >= 6) { p.onAviso('Máximo 6 adjuntos por mensaje'); return; }
    const key = 'i' + Date.now() + Math.random();
    const preview = URL.createObjectURL(file);
    setPend(v => [...v, { key, tipo: 'imagen', estado: 'subiendo', preview }]);
    try {
      const img = await cargarImagen(file);
      // El original se reduce a 2000 px (una captura de pantalla no necesita
      // más) y la miniatura a 480: lo que se ve en el chat pesa poco.
      const esGif = file.type === 'image/gif';
      const grande = esGif ? { blob: file, w: img.naturalWidth, h: img.naturalHeight } : await encoger(img, 2000, 0.86);
      const chica = await encoger(img, 480, 0.8);
      const [path, thumb] = await Promise.all([subirBlob('imagen', grande.blob, file.name), subirBlob('thumb', chica.blob)]);
      setPend(v => v.map(x => x.key === key ? { ...x, estado: 'listo', adj: { tipo: 'imagen', path, thumb, nombre: file.name.slice(0, 120), bytes: grande.blob.size, w: grande.w, h: grande.h } } : x));
    } catch (e: any) {
      setPend(v => v.map(x => x.key === key ? { ...x, estado: 'error', err: e.message } : x));
      p.onAviso(e.message || 'No se pudo subir la imagen');
    }
  };
  const alPegar = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []).filter(i => i.kind === 'file' && i.type.startsWith('image/'));
    if (!items.length) return;
    e.preventDefault();
    for (const it of items) { const f = it.getAsFile(); if (f) agregarImagen(new File([f], f.name || `captura-${Date.now()}.png`, { type: f.type })); }
  };
  const alSoltar = (e: React.DragEvent) => {
    e.preventDefault();
    for (const f of Array.from(e.dataTransfer?.files || [])) agregarImagen(f);
  };

  // ── Audio ──
  const empezarGrabacion = async () => {
    if (grab) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(m => (window as any).MediaRecorder?.isTypeSupported?.(m)) || '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
      const chunks: Blob[] = [];
      mr.ondataavailable = ev => { if (ev.data.size) chunks.push(ev.data); };
      mr.start(500);
      // Onda: el nivel del micrófono cada 100 ms para que se vea que graba.
      let ctx: AudioContext | undefined; let raf: number | undefined;
      try {
        ctx = new AudioContext(); const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        const tick = () => { an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += Math.abs(v - 128); setGrab(g => g ? { ...g, niveles: [...g.niveles.slice(-39), Math.min(1, (s / buf.length) / 24)] } : g); raf = window.setTimeout(tick, 100) as any; };
        tick();
      } catch { /* sin onda */ }
      rec.current = { mr, chunks, stream, ctx, raf };
      setGrab({ desde: Date.now(), niveles: [] });
    } catch { p.onAviso('No hay permiso para el micrófono'); }
  };
  const pararGrabacion = (mandar: boolean) => {
    const r = rec.current; if (!r) return;
    rec.current = null;
    const desde = grab?.desde || Date.now();
    setGrab(null);
    if (r.raf) clearTimeout(r.raf); r.ctx?.close().catch(() => null);
    r.mr.onstop = async () => {
      r.stream.getTracks().forEach(t => t.stop());
      if (!mandar) return;
      const blob = new Blob(r.chunks, { type: r.mr.mimeType || 'audio/webm' });
      const duracion_s = Math.round((Date.now() - desde) / 1000);
      if (duracion_s < 1 || blob.size < 1000) { p.onAviso('Audio demasiado corto'); return; }
      const key = 'a' + Date.now();
      setPend(v => [...v, { key, tipo: 'audio', estado: 'subiendo' }]);
      try {
        const path = await subirBlob('audio', blob, `audio-${duracion_s}s`);
        setPend(v => v.map(x => x.key === key ? { ...x, estado: 'transcribiendo' } : x));
        let transcripcion: string | null = null; let estado: 'ok' | 'error' = 'ok';
        try { const t = await api.transcribir(path); transcripcion = t.texto || null; if (!t.texto) estado = 'error'; } catch { estado = 'error'; }
        const adj: Adjunto = { tipo: 'audio', path, bytes: blob.size, duracion_s, transcripcion, transcripcion_estado: estado };
        setPend(v => v.map(x => x.key === key ? { ...x, estado: 'listo', adj } : x));
        // El audio se manda solo, en cuanto está: es lo que uno espera de una nota de voz.
        await p.onEnviar(texto.trim(), [adj]);
        setPend(v => v.filter(x => x.key !== key)); setTexto('');
      } catch (e: any) {
        setPend(v => v.map(x => x.key === key ? { ...x, estado: 'error', err: e.message } : x));
        p.onAviso(e.message || 'No se pudo subir el audio');
      }
    };
    r.mr.stop();
  };
  useEffect(() => () => { if (rec.current) { try { rec.current.mr.stop(); rec.current.stream.getTracks().forEach(t => t.stop()); } catch { /* nada */ } } }, []);

  const elegirGif = (g: { id: string; url: string; preview: string; w: number; h: number }) => {
    setPend(v => [...v, { key: 'g' + g.id, tipo: 'gif', estado: 'listo', preview: g.preview, adj: { tipo: 'gif', url: g.url, w: g.w, h: g.h } }]);
    setPop(null); ta.current?.focus();
  };

  const seg = grab ? Math.floor((Date.now() - grab.desde) / 1000) : 0;
  const [, tic] = useState(0);
  useEffect(() => { if (!grab) return; const t = setInterval(() => tic(x => x + 1), 500); return () => clearInterval(t); }, [!!grab]);
  useEffect(() => { if (grab && seg >= 300) pararGrabacion(true); }, [seg]);

  return (
    <div className="eq-caja" onDrop={alSoltar} onDragOver={e => e.preventDefault()}>
      <div className="marco" ref={marco}>
        {p.editando && (
          <div className="eq-resp"><b>Editando</b><span>{textoPlano(p.editando.texto)}</span><button type="button" onClick={p.onCancelarEdicion} title="Cancelar">×</button></div>
        )}
        {p.respondeA && !p.editando && (
          <div className="eq-resp">{Ic.responder}<span>Respondiendo a <b>{p.respondeA.autor.nombre}</b> · {textoPlano(p.respondeA.texto) || (p.respondeA.adjuntos[0]?.tipo === 'audio' ? 'audio' : 'imagen')}</span><button type="button" onClick={p.onQuitarResp} title="Quitar">×</button></div>
        )}
        {pend.length > 0 && (
          <div className="eq-pre">
            {pend.map(x => (
              <div key={x.key} className="it">
                {x.preview ? <img src={x.preview} alt="" style={{ opacity: x.estado === 'listo' ? 1 : .5 }} /> : <span>{x.tipo === 'audio' ? (x.estado === 'transcribiendo' ? 'Transcribiendo…' : x.estado === 'subiendo' ? 'Subiendo audio…' : 'Audio') : x.estado}</span>}
                {x.estado !== 'listo' && x.preview && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.6875rem', fontWeight: 700, color: '#5B4BD6' }}>{x.estado === 'error' ? 'Error' : 'Subiendo…'}</span>}
                <button type="button" className="x" onClick={() => setPend(v => v.filter(y => y.key !== x.key))} title="Quitar">×</button>
              </div>
            ))}
          </div>
        )}
        {grab ? (
          <div className="eq-grab">
            <span className="pt" /><span className="t">{Math.floor(seg / 60)}:{String(seg % 60).padStart(2, '0')}</span>
            <div className="onda">{grab.niveles.map((n, i) => <i key={i} style={{ height: 3 + n * 22 }} />)}</div>
            <button type="button" className="eq-btn t" onClick={() => pararGrabacion(false)}>Cancelar</button>
            <button type="button" className="eq-btn p" onClick={() => pararGrabacion(true)}>Enviar audio</button>
          </div>
        ) : (
          <textarea ref={ta} rows={1} value={texto} placeholder={p.bloqueada || p.placeholder} disabled={!!p.bloqueada}
            onChange={e => alEscribir(e.target.value)} onKeyDown={teclas} onPaste={alPegar} onClick={() => setMen(null)} />
        )}
        {men && consulta && (
          <div className="eq-pop eq-menciones" onMouseDown={e => e.preventDefault()}>
            {candidatos.map((c, i) => {
              const cab = c.grupo && (i === 0 || candidatos[i - 1].grupo !== c.grupo) ? <div key={'g' + c.grupo} className="grupo">{c.grupo}</div> : null;
              return [cab, c.persona
                ? <button key={c.k} type="button" className={i === men.sel ? 'sel' : ''} onClick={() => elegirMencion(c)}><Avatar p={c.persona} size={22} />{c.persona.nombre}</button>
                : <button key={c.k} type="button" className={'it' + (i === men.sel ? ' sel' : '')} onClick={() => elegirMencion(c)}><span className={'tip ' + c.item!.tipo}>{TIPO_CORTO[c.item!.tipo]}</span><span className="dos"><b>{c.item!.nombre}</b>{c.item!.sub && <small>{c.item!.sub}</small>}</span></button>];
            })}
            {!candidatos.length && (buscando ? <div className="vacio">Buscando…</div> : (consulta.tipo || consulta.texto.length >= 2) ? <div className="vacio">Nada con ese nombre</div> : null)}
            {!consulta?.tipo && consulta!.texto.length < 4 && (
              <div className="pista">{(Object.keys(TIPO_LARGO) as TipoCita[]).map(t => <button key={t} type="button" onClick={() => elegirTipo(t)}>@{TIPO_LARGO[t]}</button>)}</div>
            )}
          </div>
        )}
        {pop === 'emoji' && <Emojis onPick={e => { insertar(e); setPop(null); }} />}
        {pop === 'gif' && (
          <div className="eq-pop eq-gifs">
            <input autoFocus placeholder="Buscar en Tenor…" value={gifQ} onChange={e => setGifQ(e.target.value)} />
            {gifSinLlave ? <div className="vacio">Falta la llave de Tenor (TENOR_API_KEY)</div>
              : gifs.length ? <div className="grid">{gifs.map(g => <button key={g.id} type="button" onClick={() => elegirGif(g)}><img src={g.preview} alt="" loading="lazy" /></button>)}</div>
              : <div className="vacio">{gifQ ? 'Nada con eso' : 'Escribe algo para buscar'}</div>}
          </div>
        )}
        {!grab && (
          <div className="barra">
            <button type="button" className={'eq-ib' + (pop === 'emoji' ? ' on' : '')} title="Emoji" onClick={() => setPop(v => v === 'emoji' ? null : 'emoji')} disabled={!!p.bloqueada}>{Ic.emoji}</button>
            {!p.editando && <button type="button" className={'eq-ib' + (pop === 'gif' ? ' on' : '')} title="GIF" onClick={() => setPop(v => v === 'gif' ? null : 'gif')} disabled={!!p.bloqueada}>{Ic.gif}</button>}
            {!p.editando && <button type="button" className="eq-ib" title="Imagen" onClick={() => fileIn.current?.click()} disabled={!!p.bloqueada}>{Ic.imagen}</button>}
            {!p.editando && <button type="button" className="eq-ib" title="Grabar audio" onClick={empezarGrabacion} disabled={!!p.bloqueada}>{Ic.mic}</button>}
            <input ref={fileIn} type="file" accept="image/*" multiple hidden onChange={e => { for (const f of Array.from(e.target.files || [])) agregarImagen(f); e.target.value = ''; }} />
            <span className="esp" />
            <button type="button" className="enviar" disabled={!listo} onClick={enviar} title={p.editando ? 'Guardar' : 'Enviar (Enter)'}>{p.editando ? Ic.check : Ic.enviar}</button>
          </div>
        )}
      </div>
    </div>
  );
}
