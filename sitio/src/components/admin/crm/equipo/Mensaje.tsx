// Un mensaje en la lista: quién, cuándo, qué —con su cita, adjuntos, reacciones
// y el resumen de su hilo—. Las acciones aparecen al pasar el ratón; en el
// teléfono, al dejar el dedo (el padre abre la hoja de acciones).
import { useRef, useState } from 'react';
import type { Mensaje as M } from './api';
import { hora, hace } from './api';
import { Avatar, Texto, Emojis, RAPIDOS, Ic, useFuera, abrirFicha } from './ui';

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
  irACrm: (destino: string) => void;   // otra pestaña del CRM (pipeline?lead=…)
  verImagen: (url: string) => void;
  menuMovil: (m: M) => void;
};

export default function Mensaje({ m, yo, seguido, enHilo, resaltado, acc, movil, admin }: {
  m: M; yo: string; seguido: boolean; enHilo?: boolean; resaltado?: boolean; acc: Acciones; movil: boolean;
  /** Un founder puede eliminar mensajes de otros (editar, solo el autor). */
  admin?: boolean;
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
            {m.sistema?.nivel && m.sistema.nivel !== 'info' && <span className={'eq-nivel ' + m.sistema.nivel}>{m.sistema.nivel === 'urgente' ? 'Urgente' : 'Atención'}</span>}
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
            {m.publicacion ? <TarjetaPub r={m.publicacion} /> : m.texto && <Texto t={m.texto} yo={yo} />}
            {(m.citas.length > 0 || m.sistema) && <Pastillas m={m} acc={acc} />}
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
          {(m.mio || admin) && <button onClick={() => acc.borrar(m)} title={m.mio ? 'Eliminar' : 'Eliminar (como founder)'}>{Ic.basura}</button>}
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

/* Las pastillas al registro: el lead, el cliente, la conversación o la pantalla
   de la que habla el mensaje. Mismo criterio que la campana: de lo más concreto
   (la conversación) a lo más vago (una pestaña). */
const ETIQ: Record<string, string> = { lead: 'Lead', cliente: 'Cliente', tarea: 'Tarea', reunion: 'Reunión', cotizacion: 'Cotización', corte: 'Corte', canal: 'Canal', wiki: 'Wiki', pago: 'Pago', cobranza: 'Cobranza' };
// Estos cinco tienen ficha a un lado del chat (la misma info que carga el CRM);
// el resto solo navega a su pestaña.
const CON_FICHA = new Set(['cotizacion', 'cliente', 'lead', 'pago', 'cobranza']);
function destinoCita(c: any): string | null {
  if (c.tipo === 'lead') return `pipeline?lead=${c.id}`;
  if (c.tipo === 'cliente') return `clientes?company=${c.id}`;
  if (c.tipo === 'cotizacion') return 'cotizaciones';   // la pestaña no lee ?id aún
  if (c.tipo === 'tarea') return 'trabajo';
  if (c.tipo === 'wiki') return `wiki?pagina=${c.id}`;
  return null;
}
function Pastillas({ m, acc }: { m: M; acc: Acciones }) {
  const s = m.sistema;
  const abrir = s ? (s.conversation_id && !s.url ? { t: 'Abrir la conversación', d: `whatsapp?wa_conv=${s.conversation_id}` }
    : s.churn_caso_id ? { t: 'Ver el caso', d: `churn?caso=${s.churn_caso_id}` }
    : s.url ? { t: s.tipo?.startsWith('ticket') || s.tipo?.startsWith('soporte') ? 'Abrir el ticket' : 'Abrir', u: s.url }
    : s.destino && !s.contact_id && !s.company_id ? { t: 'Abrir', d: s.destino } : null) : null;
  return (
    <div className="eq-pastillas">
      {m.citas.filter(c => c && c.tipo !== 'reunion' && c.tipo !== 'canal'
        // Las citas escritas con @ ya van como chip dentro del texto: no se repiten abajo.
        && !(m.texto || '').includes(`](${c.tipo}:${c.id})`)).map((c: any, i: number) => {
        const ficha = CON_FICHA.has(c.tipo);
        const d = destinoCita(c);
        return <button key={i} className="eq-pastilla" disabled={!d && !ficha} onClick={() => ficha ? abrirFicha(c.tipo, c.id, c.nombre) : d && acc.irACrm(d)} title={ficha ? 'Ver la ficha' : d ? 'Abrir en el CRM' : undefined}><small>{ETIQ[c.tipo] || c.tipo}</small>{c.nombre || c.id.slice(0, 8)}</button>;
      })}
      {abrir && ('u' in abrir
        ? <a className="eq-pastilla ir" href={abrir.u!} target="_blank" rel="noopener">{abrir.t} →</a>
        : <button className="eq-pastilla ir" onClick={() => acc.irACrm(abrir.d!)}>{abrir.t} →</button>)}
      {s?.que_hacer && <div className="eq-quehacer"><b>Qué hacer:</b> {s.que_hacer}</div>}
    </div>
  );
}

/* La tarjeta de una publicación del canal: tipo, título y avance en vivo. Al
   tocarla se abre la publicación a un lado del chat (Equipo escucha crm:pub). */
const ETIQ_PUB: Record<string, string> = { nota: 'Nota', checklist: 'Checklist', proyecto: 'Proyecto' };
function TarjetaPub({ r }: { r: NonNullable<M['publicacion']> }) {
  const pct = r.n ? Math.round(r.hechos / r.n * 100) : 0;
  return (
    <button className={'eq-pub tarjeta' + (r.estado === 'cerrada' ? ' cerrada' : '')} onClick={() => window.dispatchEvent(new CustomEvent('crm:pub', { detail: { id: r.id } }))}>
      <div className="fila"><span className={'eq-pub-tipo ' + r.tipo}>{ETIQ_PUB[r.tipo] || 'Publicación'}</span><b>{r.titulo}</b></div>
      {r.n > 0 && <div className="eq-pub-barra"><i style={{ width: pct + '%' }} /></div>}
      <div className="meta">
        {r.n > 0 && <span className={r.hechos === r.n ? 'ok' : ''}>{r.hechos}/{r.n}</span>}
        {r.estado === 'cerrada' && <span>Cerrada</span>}
        {r.responsable && <span className="quien">{r.responsable.nombre.split(' ')[0]}</span>}
        {r.vence_at && <span className="fecha">{Ic.reloj}{r.vence_at.slice(5).split('-').reverse().join('/')}</span>}
        <span className="t">Abrir</span>
      </div>
    </button>
  );
}
