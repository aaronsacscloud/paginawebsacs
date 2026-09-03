// Un mensaje en la lista: quién, cuándo, qué —con su cita, adjuntos, reacciones
// y el resumen de su hilo—. Las acciones aparecen al pasar el ratón; en el
// teléfono, al dejar el dedo (el padre abre la hoja de acciones).
import { useRef, useState } from 'react';
import type { Mensaje as M } from './api';
import { hora, hace } from './api';
import { Avatar, Texto, Emojis, RAPIDOS, Ic, useFuera } from './ui';

export type Acciones = {
  reaccionar: (m: M, emoji: string) => void;
  responder: (m: M) => void;
  abrirHilo: (m: M) => void;
  editar: (m: M) => void;
  borrar: (m: M) => void;
  copiarLiga: (m: M) => void;
  fijar: (m: M) => void;
  agendar: (m: M) => void;            // "Llevar a la agenda de…" (una sala)
  irA: (id: string) => void;
  verImagen: (url: string) => void;
  menuMovil: (m: M) => void;
};

export default function Mensaje({ m, yo, seguido, enHilo, resaltado, acc, movil }: {
  m: M; yo: string; seguido: boolean; enHilo?: boolean; resaltado?: boolean; acc: Acciones; movil: boolean;
}) {
  const [emojis, setEmojis] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useFuera(ref, () => setEmojis(false), emojis);
  const pulso = useRef<any>(null);

  const alTocar = movil ? {
    onTouchStart: () => { pulso.current = setTimeout(() => acc.menuMovil(m), 450); },
    onTouchEnd: () => clearTimeout(pulso.current),
    onTouchMove: () => clearTimeout(pulso.current),
  } : {};

  return (
    <div ref={ref} id={'m-' + m.id} className={'eq-msg' + (seguido ? '' : ' inicio') + (resaltado ? ' resaltado' : '') + (emojis ? ' menu' : '') + (m.fijado ? ' fijado' : '')} {...alTocar}
      style={m.pendiente ? { opacity: .55 } : undefined}>
      <div className="gutter">
        {seguido ? <span className="hora-h">{hora(m.created_at)}</span> : <Avatar p={m.autor} size={36} />}
      </div>
      <div className="col">
        {!seguido && (
          <div className="quien">
            <b>{m.autor.nombre}</b>
            <time dateTime={m.created_at} title={new Date(m.created_at).toLocaleString('es-MX')}>{hora(m.created_at)}</time>
            {m.fijado && <span className="eq-fij">{Ic.pin}Fijado</span>}
          </div>
        )}
        {seguido && m.fijado && <span className="eq-fij">{Ic.pin}Fijado</span>}
        {m.responde_a && (
          <div className="eq-cita" onClick={() => acc.irA(m.responde_a!.id)} title="Ir al mensaje">
            {Ic.responder}<b>{m.responde_a.autor?.nombre || ''}</b><span>{m.responde_a.texto.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')}</span>
          </div>
        )}
        {m.borrado ? <div className="borrado">Mensaje eliminado</div> : (
          <>
            {m.texto && <Texto t={m.texto} yo={yo} />}
            {m.fallo && <div style={{ color: '#C0554E', fontSize: '.75rem' }}>No se envió: {m.fallo}</div>}
            {m.editado_at && <span style={{ fontSize: '.6875rem', color: '#9a95ad' }}>(editado)</span>}
            {m.adjuntos.length > 0 && (
              <div className="eq-adj">
                {m.adjuntos.map((a, i) => {
                  if (a.tipo === 'gif') return <a key={i} className="eq-img" onClick={() => a.url && acc.verImagen(a.url)}><img src={a.url} alt="GIF" style={{ maxHeight: 220 }} /></a>;
                  if (a.tipo === 'imagen') return (
                    <a key={i} className="eq-img" onClick={() => a.url && acc.verImagen(a.url)} style={{ width: a.w && a.h ? Math.min(360, a.w * (240 / a.h)) : undefined }}>
                      <img src={a.thumb_url || a.url} alt={a.nombre || 'imagen'} loading="lazy" width={a.w} height={a.h} />
                    </a>
                  );
                  if (a.tipo === 'audio') return (
                    <div key={i} className="eq-audio">
                      <audio controls preload="none" src={a.url} />
                      {a.transcripcion ? <div className="tr"><b>Transcripción</b>{a.transcripcion}</div>
                        : a.transcripcion_estado === 'error' ? <div className="tr pend">No se pudo transcribir</div>
                        : a.transcripcion_estado === 'pendiente' ? <div className="tr pend">Transcribiendo…</div> : null}
                    </div>
                  );
                  return <a key={i} className="eq-img" href={a.url} target="_blank" rel="noopener" style={{ padding: '8px 12px' }}>{a.nombre || 'archivo'}</a>;
                })}
              </div>
            )}
            {(m.reacciones.length > 0) && (
              <div className="eq-rx">
                {m.reacciones.map(r => (
                  <button key={r.emoji} className={r.mia ? 'mia' : ''} title={r.quienes.join(', ')} onClick={() => acc.reaccionar(m, r.emoji)}>{r.emoji} {r.n}</button>
                ))}
                {!movil && <button className="mas" onClick={() => setEmojis(true)} title="Reaccionar">{Ic.emoji}</button>}
              </div>
            )}
            {!enHilo && m.hilo && (
              <button className="eq-hilo" onClick={() => acc.abrirHilo(m)}>
                <span className="avs">{m.hilo.autores.slice(0, 3).map(a => <Avatar key={a.id} p={a} size={18} />)}</span>
                {m.hilo.n} {m.hilo.n === 1 ? 'respuesta' : 'respuestas'}
                <span className="cuando">· {hace(m.hilo.ultima)}</span>
              </button>
            )}
          </>
        )}
      </div>
      {!m.borrado && !m.pendiente && !movil && (
        <div className="eq-acc">
          {RAPIDOS.slice(0, 3).map(e => <button key={e} onClick={() => acc.reaccionar(m, e)} title="Reaccionar">{e}</button>)}
          <button onClick={() => setEmojis(v => !v)} title="Más reacciones">{Ic.emoji}</button>
          <button onClick={() => acc.responder(m)} title="Responder">{Ic.responder}</button>
          {!enHilo && <button onClick={() => acc.abrirHilo(m)} title="Abrir hilo">{Ic.hilo}</button>}
          {m.mio && <button onClick={() => acc.editar(m)} title="Editar">{Ic.editar}</button>}
          {m.mio && <button onClick={() => acc.borrar(m)} title="Eliminar">{Ic.basura}</button>}
          <button onClick={() => acc.copiarLiga(m)} title="Copiar liga">{Ic.liga}</button>
          <button onClick={() => acc.fijar(m)} title={m.fijado ? 'Desfijar' : 'Fijar en el canal'} className={m.fijado ? 'on' : ''}>{Ic.pin}</button>
          <button onClick={() => acc.agendar(m)} title="Llevar a la agenda de una sala">{Ic.sala}</button>
        </div>
      )}
      {emojis && (
        <div style={{ position: 'absolute', right: 16, top: 12, zIndex: 6 }}>
          <div style={{ position: 'relative' }}><Emojis der onPick={e => { acc.reaccionar(m, e); setEmojis(false); }} /></div>
        </div>
      )}
    </div>
  );
}
