// El panel de una sala de reunión: la agenda (puntos con votos), la reunión en
// curso (qué se está viendo, acuerdos con responsable), lo que quedó pendiente
// y las actas de las reuniones pasadas. Abajo, las citas con clientes de la
// semana, para que la junta del lunes empiece sabiendo a quién se va a ver.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Canal as C, Persona } from './api';
import { api, hace } from './api';
import type { Senal } from './useRealtime';
import { Ic, Avatar } from './ui';
import Cargando from '../ui/Cargando';

type Quien = { id: string; nombre: string; foto_url: string | null } | null;
type Punto = { id: string; titulo: string; estado: string; votos: number; vote: boolean; arrastres: number; sesion_id: string | null; propuesto_por: Quien; contexto: any[]; created_at: string; mensajes: number; arrastrado?: boolean };
type Acuerdo = { id: string; sesion_id: string; punto_id: string | null; texto: string; responsable: Quien; vence_at: string | null; hecho_at: string | null; tarea_id: string | null };
type Sesion = { id: string; inicio_at: string; fin_at: string | null; asistentes: string[]; asistentes_p: Quien[]; punto_actual_id: string | null; resumen_ia: string | null; acta: any; acuerdos: Acuerdo[]; puntos?: Punto[]; nota_cierre: string | null };
type Cita = { id: string; fecha: string; hora: string; nombre: string; empresa: string | null; con: string | null };
/** Un punto del guion. Texto suelto cuando es de criterio; con `fuente` cuando
 *  es un dato y hay que decir de qué pantalla sale. */
type PuntoGuion = string | { t: string; fuente?: string };
/** Un bloque: quién presenta, cuánto dura y qué muestra, en orden. */
type BloqueGuion = { bloque: string; quien: string; minutos?: number; puntos: PuntoGuion[] };
type Datos = { proxima: string | null; abierta: Sesion | null; agenda: Punto[]; arrastrados: number; pendientes: Acuerdo[]; historial: Sesion[]; citas: Cita[]; guion: BloqueGuion[] | null };

const TZ = 'America/Mexico_City';
// Todo se muestra en hora de México aunque el navegador esté en otra zona.
const fCorta = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '');
const fHora = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const fFecha = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-MX', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', ''); };
const hoyYmd = () => new Date().toLocaleDateString('sv-SE', { timeZone: TZ });
const primero = (n?: string | null) => (n || '').split(' ')[0];

export type SalaProps = {
  canal: C; yo: string; role: string; personas: Persona[]; movil: boolean;
  onCerrar: () => void; onAviso: (m: string) => void;
  onIr: (canalId: string, msgId: string, hiloDe?: string | null) => void;
  registrarSenal: (fn: ((s: Senal) => void) | null) => void;
};

export default function Sala(p: SalaProps) {
  const [d, setD] = useState<Datos | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<'agenda' | 'guion' | 'historial'>('agenda');
  const [nuevo, setNuevo] = useState('');
  const [acordando, setAcordando] = useState<string | null | false>(false);   // id del punto, null = suelto, false = cerrado
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [, tic] = useState(0);
  const t = useRef<any>(null);

  const cargar = useCallback(async () => {
    try { const r = await api.sala(p.canal.id); setD(r); setErr(null); } catch (e: any) { setErr(e.message); }
  }, [p.canal.id]);
  useEffect(() => { setD(null); cargar(); }, [cargar]);
  // Señales: lo que cambie en la sala (o un mensaje de la sesión) refresca el panel.
  useEffect(() => {
    p.registrarSenal(s => {
      if (('canal_id' in s) && s.canal_id === p.canal.id && (s.tipo === 'reunion' || s.tipo === 'msg')) { clearTimeout(t.current); t.current = setTimeout(cargar, 250); }
    });
    return () => p.registrarSenal(null);
  }, [cargar, p.canal.id]);
  useEffect(() => { const i = setInterval(() => tic(x => x + 1), 30_000); return () => clearInterval(i); }, []);

  const accion = async (b: any, ok?: string) => {
    const k = b.punto_id || b.sesion_id || b.acuerdo_id || b.accion; setOcupado(k);
    try { const r = await api.salaAccion(b); if (ok) p.onAviso(ok); await cargar(); return r; }
    catch (e: any) { p.onAviso(e.message); return null; }
    finally { setOcupado(null); }
  };

  const proponer = async () => {
    const titulo = nuevo.trim(); if (titulo.length < 3) return;
    const r = await accion({ accion: 'proponer', canal_id: p.canal.id, titulo }); if (r) setNuevo('');
  };

  const gente = p.personas.filter(x => x.rol !== 'soporte');
  const ab = d?.abierta || null;
  const proximaTxt = d?.proxima ? `${fCorta(d.proxima)} · ${fHora(d.proxima)}` : 'sin día fijo';

  return (
    <>
      <div className="eq-cab">
        {p.movil && <button className="eq-ib" onClick={p.onCerrar} aria-label="Volver">{Ic.atras}</button>}
        <h2>{Ic.sala} Sala</h2>
        <span className="desc">{ab ? 'Reunión en curso' : d ? `Próxima: ${proximaTxt}` : ''}{d && !ab && d.agenda.length ? ` · ${d.agenda.length} ${d.agenda.length === 1 ? 'punto' : 'puntos'}` : ''}{d && !ab && d.arrastrados ? ` · ${d.arrastrados} arrastrado${d.arrastrados === 1 ? '' : 's'}` : ''}</span>
        {!p.movil && <button className="eq-ib" onClick={p.onCerrar} aria-label="Cerrar">{Ic.cerrar}</button>}
      </div>
      <div className="eq-tabs">
        <button className={tab === 'agenda' ? 'on' : ''} onClick={() => setTab('agenda')}>Agenda</button>
        {/* GUION y AGENDA son dos cosas distintas y por eso van en dos pestañas.
            El guion es lo FIJO —quién presenta qué, cada semana—; la agenda es
            lo de ESTA semana, que se propone, se trata y se cierra. Mezclarlos
            haría que el guion se «tratara» y desapareciera en la primera junta. */}
        {!!d?.guion?.length && <button className={tab === 'guion' ? 'on' : ''} onClick={() => setTab('guion')}>Guion</button>}
        <button className={tab === 'historial' ? 'on' : ''} onClick={() => setTab('historial')}>Actas{d?.historial.length ? ` · ${d.historial.length}` : ''}</button>
      </div>
      {!d && !err && <Cargando texto="Abriendo la sala…" />}
      {err && <div className="eq-vacio"><b>No se pudo abrir la sala</b>{err}<button className="eq-btn" onClick={cargar}>Reintentar</button></div>}
      {d && tab === 'guion' && (
        <div className="eq-sala">
          <div className="eq-guion">
            <p className="eq-guion-int">
              Esto es lo que se ve <b>siempre</b> en esta junta, en este orden. Lo que traigas de la semana va en <b>Agenda</b>.
              {/* El total sale de sumar los bloques: si la junta se está yendo
                  de tiempo, se ve aquí antes de empezar y no a la mitad. */}
              {(() => { const m = (d.guion || []).reduce((a, b) => a + (Number(b.minutos) || 0), 0); return m ? <> Dura <b>{m} min</b>.</> : null; })()}
            </p>
            {(d.guion || []).map((b, i) => (
              <div key={i} className="eq-guion-b">
                <div className="eq-guion-h">
                  <span className="q">{b.quien}</span>
                  <b>{b.bloque}</b>
                  {!!b.minutos && <span className="m">{b.minutos} min</span>}
                </div>
                <ol>{(b.puntos || []).map((p, j) => {
                  const t = typeof p === 'string' ? p : p.t;
                  const fuente = typeof p === 'string' ? null : p.fuente;
                  return (
                    <li key={j}>
                      {t}
                      {/* De dónde sale el número. Sin esto cada quien busca por
                          su lado y llegan con cifras distintas —o sin ellas—. */}
                      {fuente && <span className="f">{fuente}</span>}
                    </li>
                  );
                })}</ol>
              </div>
            ))}
          </div>
        </div>
      )}
      {d && tab === 'agenda' && (
        <div className="eq-sala">
          {ab ? (
            <div className="eq-sesion-viva" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <b>En reunión</b>
                <span className="t">{Math.max(1, Math.round((Date.now() - new Date(ab.inicio_at).getTime()) / 60000))} min</span>
                <span style={{ flex: 1 }} />
                <button className="eq-btn p" disabled={ocupado === ab.id} onClick={async () => {
                  const nota = prompt('¿Alguna nota para el acta? (opcional)') ?? null; if (nota === null) return;
                  const r = await accion({ accion: 'cerrar', sesion_id: ab.id, nota }, 'Acta lista y fijada en el canal'); if (r) setTab('historial');
                }}>{Ic.stop} Cerrar reunión</button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <small style={{ color: 'var(--eq-gris)' }}>Asisten:</small>
                {gente.map(g => {
                  const dentro = ab.asistentes.includes(g.id);
                  return <button key={g.id} className={'eq-punto-chip' + (dentro ? ' on' : '')} title={dentro ? 'Quitar de la reunión' : 'Agregar a la reunión'}
                    onClick={() => accion({ accion: 'asistentes', sesion_id: ab.id, asistentes: dentro ? ab.asistentes.filter(x => x !== g.id) : [...ab.asistentes, g.id] })}>
                    <Avatar p={g} size={16} />{g.nombre}</button>;
                })}
              </div>
              {acordando === null ? <FormAcuerdo gente={gente} yo={p.yo} onCancelar={() => setAcordando(false)} onGuardar={async (b) => { const r = await accion({ accion: 'acordar', sesion_id: ab.id, ...b }, 'Acuerdo guardado'); if (r) setAcordando(false); }} />
                : <button className="eq-btn t" style={{ alignSelf: 'flex-start' }} onClick={() => setAcordando(null)}>+ Acuerdo sin punto</button>}
            </div>
          ) : (
            <div className="eq-sesion-viva">
              <div style={{ flex: 1 }}><b>Próxima reunión</b><div className="t">{proximaTxt}{p.canal.regla_reunion ? ` · cada ${['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][p.canal.regla_reunion.dia_iso]}` : ''}</div></div>
              <button className="eq-btn p" disabled={ocupado === 'iniciar'} onClick={() => accion({ accion: 'iniciar', canal_id: p.canal.id }, 'Reunión abierta: lo que se escriba queda en el acta')}>{Ic.play} Iniciar</button>
            </div>
          )}

          <div className="eq-bloque">
            <div className="cab"><b>{ab ? 'Puntos de hoy' : 'Agenda'}</b><span className="n">{d.agenda.length ? `${d.agenda.length}${d.arrastrados ? ` · ${d.arrastrados} arrastrado${d.arrastrados === 1 ? '' : 's'}` : ''}` : 'vacía'}</span></div>
            {d.agenda.map((pt, i) => {
              const tratando = !!ab && ab.punto_actual_id === pt.id;
              const mio = pt.propuesto_por?.id === p.yo || p.role === 'founder';
              const origen = (pt.contexto || []).find((c: any) => c.tipo === 'mensaje');
              return (
                <div key={pt.id} className={'eq-punto' + (tratando ? ' tratando' : '') + (pt.estado === 'acordado' ? ' acordado' : '') + (pt.estado === 'pospuesto' ? ' pospuesto' : '')}>
                  <span className="num">{pt.estado === 'acordado' ? Ic.check : i + 1}</span>
                  <div className="tt">
                    <b>{pt.titulo}</b>
                    <small>
                      {pt.propuesto_por ? `${primero(pt.propuesto_por.nombre)} · ${hace(pt.created_at)}` : hace(pt.created_at)}
                      {pt.arrastres > 0 && <span style={{ color: '#9a6a10', fontWeight: 700 }}> · arrastrado ×{pt.arrastres}</span>}
                      {pt.estado === 'tratado' && ' · tratado'}{pt.estado === 'acordado' && ' · acordado'}{pt.estado === 'pospuesto' && ' · pospuesto'}
                      {origen && <> · <a onClick={() => p.onIr(origen.canal_id, origen.id, origen.hilo_de)} style={{ cursor: 'pointer', color: 'var(--eq-morado-tinta)' }}>desde #{origen.canal}</a></>}
                      {pt.mensajes > 0 && ` · ${pt.mensajes} ${pt.mensajes === 1 ? 'mensaje' : 'mensajes'}`}
                    </small>
                    {ab && (
                      <div className="eq-punto-acc">
                        {!tratando && pt.estado !== 'acordado' && <button className="eq-btn t" onClick={() => accion({ accion: 'tratar', sesion_id: ab.id, punto_id: pt.id })}>Tratar</button>}
                        {tratando && <button className="eq-btn t" onClick={() => accion({ accion: 'tratar', sesion_id: ab.id, punto_id: null })}>Listo</button>}
                        {acordando !== pt.id && <button className="eq-btn" onClick={() => setAcordando(pt.id)}>Acordar</button>}
                        {pt.estado !== 'pospuesto' && pt.estado !== 'acordado' && <button className="eq-btn t" onClick={() => accion({ accion: 'marcar', punto_id: pt.id, estado: 'pospuesto' })}>Posponer</button>}
                        {pt.estado === 'pospuesto' && <button className="eq-btn t" onClick={() => accion({ accion: 'marcar', punto_id: pt.id, estado: 'propuesto' })}>Retomar</button>}
                      </div>
                    )}
                    {!ab && mio && pt.estado === 'propuesto' && (
                      <div className="eq-punto-acc">
                        <button className="eq-btn t" onClick={async () => { const t2 = prompt('Editar el punto', pt.titulo); if (t2 && t2.trim() !== pt.titulo) accion({ accion: 'editar', punto_id: pt.id, titulo: t2.trim() }); }}>Editar</button>
                        <button className="eq-btn t" onClick={() => { if (confirm('¿Retirar este punto de la agenda?')) accion({ accion: 'retirar', punto_id: pt.id }); }}>Retirar</button>
                      </div>
                    )}
                    {acordando === pt.id && ab && <FormAcuerdo gente={gente} yo={p.yo} onCancelar={() => setAcordando(false)} onGuardar={async (b) => { const r = await accion({ accion: 'acordar', sesion_id: ab.id, punto_id: pt.id, ...b }, 'Acuerdo guardado'); if (r) setAcordando(false); }} />}
                  </div>
                  <button className={'votos' + (pt.vote ? ' mio' : '')} title={pt.vote ? 'Quitar mi voto' : 'Votar para verlo primero'} onClick={() => accion({ accion: 'votar', punto_id: pt.id })}>▲ {pt.votos}</button>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 6, padding: 10 }}>
              <input value={nuevo} onChange={e => setNuevo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') proponer(); }} maxLength={120} placeholder={ab ? 'Agregar un punto a la reunión de hoy…' : 'Proponer un punto…'}
                style={{ flex: 1, border: '1.5px solid var(--eq-linea)', borderRadius: 9, padding: '7px 10px', font: 'inherit', outline: 0, minWidth: 0 }} />
              <button className="eq-btn" disabled={nuevo.trim().length < 3 || ocupado === 'proponer'} onClick={proponer}>Proponer</button>
            </div>
          </div>

          {ab && ab.acuerdos.length > 0 && (
            <div className="eq-bloque">
              <div className="cab"><b>Acordado hoy</b><span className="n">{ab.acuerdos.length}</span></div>
              {ab.acuerdos.map(a => <FilaAcuerdo key={a.id} a={a} onToggle={() => accion({ accion: 'hecho', acuerdo_id: a.id, hecho: !a.hecho_at })} />)}
            </div>
          )}

          <div className="eq-bloque">
            <div className="cab"><b>Acuerdos pendientes</b><span className="n">{d.pendientes.length || 'ninguno'}</span></div>
            {d.pendientes.filter(a => !ab || a.sesion_id !== ab.id).map(a => <FilaAcuerdo key={a.id} a={a} onToggle={() => accion({ accion: 'hecho', acuerdo_id: a.id, hecho: !a.hecho_at })} />)}
            {!d.pendientes.length && <div style={{ padding: '10px 12px', color: 'var(--eq-gris)', fontSize: '.8125rem' }}>Todo lo acordado está hecho. Cada acuerdo también vive en Trabajo inteligente de su responsable.</div>}
          </div>

          <div className="eq-bloque">
            <div className="cab"><b>Esta semana con clientes</b><span className="n">{d.citas.length ? `${d.citas.length} ${d.citas.length === 1 ? 'cita' : 'citas'}` : 'sin citas'}</span></div>
            {d.citas.map(c => (
              <div key={c.id} className="eq-punto" style={{ padding: '7px 12px' }}>
                <div className="tt"><b style={{ fontWeight: 600 }}>{c.nombre.trim()}{c.empresa ? <span style={{ color: 'var(--eq-gris)', fontWeight: 500 }}> · {c.empresa}</span> : null}</b><small>{fFecha(c.fecha)} · {c.hora}{c.con ? ` · con ${primero(c.con)}` : ''}</small></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {d && tab === 'historial' && (
        <div className="eq-sala">
          {!d.historial.length && <div className="eq-vacio"><b>Todavía no hay actas</b>Al cerrar la primera reunión aquí queda su acta: puntos, acuerdos, quién estuvo y cuánto duró.</div>}
          {d.historial.length > 0 && (
            <div className="eq-bloque eq-pasadas">
              {d.historial.map((s, i) => <Acta key={s.id} s={s} abierta={i === 0} canalId={p.canal.id} onIr={p.onIr} onToggle={a => accion({ accion: 'hecho', acuerdo_id: a.id, hecho: !a.hecho_at })} onResumen={txt => accion({ accion: 'resumen', sesion_id: s.id, texto: txt }, 'Resumen guardado')} />)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function FilaAcuerdo({ a, onToggle }: { a: Acuerdo; onToggle: () => void }) {
  const vencido = !a.hecho_at && !!a.vence_at && a.vence_at < hoyYmd();
  return (
    <div className={'eq-acuerdo' + (a.hecho_at ? ' hecho' : '')}>
      <button className="chk" style={{ minHeight: 18 }} onClick={onToggle} title={a.hecho_at ? 'Marcar pendiente' : 'Marcar hecho'}>{a.hecho_at ? Ic.check : null}</button>
      <div className="tt">
        <b>{a.texto}</b>
        <small className={vencido ? 'vencido' : ''}>{a.responsable ? primero(a.responsable.nombre) : 'Sin responsable'}{a.vence_at ? ` · para el ${fFecha(a.vence_at)}` : ''}{vencido ? ' · vencido' : ''}{a.hecho_at ? ` · hecho ${hace(a.hecho_at)}` : ''}</small>
      </div>
    </div>
  );
}

function FormAcuerdo({ gente, yo, onGuardar, onCancelar }: { gente: Persona[]; yo: string; onGuardar: (b: { texto: string; responsable_id: string; vence_at?: string }) => Promise<void>; onCancelar: () => void }) {
  const [texto, setTexto] = useState(''); const [resp, setResp] = useState(yo); const [vence, setVence] = useState(''); const [ok, setOk] = useState(false);
  return (
    <div className="eq-form" style={{ padding: '8px 0 2px', gap: 6 }}>
      <input autoFocus value={texto} onChange={e => setTexto(e.target.value)} maxLength={500} placeholder="Qué se acordó" />
      <div className="fila">
        <select value={resp} onChange={e => setResp(e.target.value)} style={{ flex: 1, minWidth: 0 }}>{gente.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select>
        <input type="date" value={vence} onChange={e => setVence(e.target.value)} min={hoyYmd()} style={{ width: 140 }} title="Para cuándo" />
      </div>
      <div className="fila">
        <button className="eq-btn p" disabled={ok || texto.trim().length < 3} onClick={async () => { setOk(true); await onGuardar({ texto: texto.trim(), responsable_id: resp, vence_at: vence || undefined }); setOk(false); }}>Guardar acuerdo</button>
        <button className="eq-btn t" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

function Acta({ s, abierta, canalId, onIr, onToggle, onResumen }: { s: Sesion; abierta: boolean; canalId: string; onIr: SalaProps['onIr']; onToggle: (a: Acuerdo) => void; onResumen: (t: string) => void }) {
  const [edit, setEdit] = useState<string | null>(null);
  const editable = Date.now() - new Date(s.fin_at || s.inicio_at).getTime() < 24 * 3600e3;
  const acta = s.acta || {};
  const puntos: any[] = acta.puntos || s.puntos || [];
  return (
    <details open={abierta}>
      <summary>
        <span>{fCorta(s.inicio_at)} · {fHora(s.inicio_at)}</span>
        <small>{acta.duracion_min ? `${acta.duracion_min} min · ` : ''}{puntos.length} {puntos.length === 1 ? 'punto' : 'puntos'} · {s.acuerdos.length} {s.acuerdos.length === 1 ? 'acuerdo' : 'acuerdos'}</small>
      </summary>
      <div className="cuerpo">
        {edit !== null ? (
          <div className="eq-form" style={{ padding: '4px 0', gap: 6 }}>
            <textarea rows={4} value={edit} onChange={e => setEdit(e.target.value)} maxLength={1500} />
            <div className="fila"><button className="eq-btn p" onClick={() => { onResumen(edit); setEdit(null); }}>Guardar</button><button className="eq-btn t" onClick={() => setEdit(null)}>Cancelar</button></div>
          </div>
        ) : (
          <>
            {s.resumen_ia ? <p style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{s.resumen_ia}</p> : <p style={{ margin: '6px 0', color: 'var(--eq-gris)' }}>Sin resumen.</p>}
            {editable && <button className="eq-btn t" style={{ padding: '3px 8px', fontSize: '.75rem' }} onClick={() => setEdit(s.resumen_ia || '')}>{s.resumen_ia ? 'Editar resumen' : 'Escribir resumen'}</button>}
          </>
        )}
        {puntos.length > 0 && <><h5>Puntos</h5><ul>{puntos.map((pt: any) => (
          <li key={pt.id}>{pt.titulo} <span style={{ color: 'var(--eq-gris)' }}>· {pt.estado === 'pospuesto' ? 'pasó a la siguiente' : pt.estado}</span>
            {pt.primer_mensaje && <> · <a onClick={() => onIr(canalId, pt.primer_mensaje)} style={{ cursor: 'pointer', color: 'var(--eq-morado-tinta)' }}>{pt.mensajes} {pt.mensajes === 1 ? 'mensaje' : 'mensajes'}</a></>}
          </li>))}</ul></>}
        {s.acuerdos.length > 0 && <><h5>Acuerdos</h5><div style={{ margin: '0 -12px' }}>{s.acuerdos.map(a => <FilaAcuerdo key={a.id} a={a} onToggle={() => onToggle(a)} />)}</div></>}
        <h5>Asistieron</h5>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{s.asistentes_p.map(a => a && <span key={a.id} className="eq-punto-chip on"><Avatar p={a} size={16} />{a.nombre}</span>)}</div>
        {s.nota_cierre && <><h5>Nota</h5><p style={{ margin: 0 }}>{s.nota_cierre}</p></>}
      </div>
    </details>
  );
}
