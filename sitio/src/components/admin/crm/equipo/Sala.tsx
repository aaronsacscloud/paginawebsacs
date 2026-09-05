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
type Acuerdo = { id: string; sesion_id: string; punto_id: string | null; texto: string; responsable: Quien; vence_at: string | null; hecho_at: string | null; tarea_id: string | null ; arrastres?: number };
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

/** «en 2 d 5 h» · «en 47 min» · «ahora» · «hace 3 h».
 *  Una fecha obliga a hacer la cuenta en la cabeza; esto no. Es la primera
 *  pregunta al abrir la sala: ¿cuánto falta? */
function faltan(iso: string): { txt: string; cerca: boolean; pasada: boolean } {
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const min = Math.round(abs / 60000), hrs = Math.floor(min / 60), dias = Math.floor(hrs / 24);
  const cuerpo = dias >= 1 ? `${dias} d${hrs % 24 ? ` ${hrs % 24} h` : ''}`
    : hrs >= 1 ? `${hrs} h${min % 60 ? ` ${min % 60} min` : ''}`
    : `${Math.max(1, min)} min`;
  if (ms < 0) return { txt: `empezó hace ${cuerpo}`, cerca: true, pasada: true };
  if (min <= 1) return { txt: 'ahora', cerca: true, pasada: false };
  // «Cerca» = menos de dos horas: es cuando deja de ser un dato y pasa a ser un aviso.
  return { txt: `en ${cuerpo}`, cerca: ms < 2 * 3600e3, pasada: false };
}

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
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  // Confirmar en el MISMO botón («Retirar» → «¿Seguro?») y volver solo a los
  // 4 s: sin diálogo del sistema y sin dejar la app en un estado raro si el
  // dedo se va a otro lado.
  const [retirando, setRetirando] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState<string | null>(null);   // null = no se está cerrando
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
  // Se recalcula con el `tic` de cada 30 s: una cuenta regresiva congelada
  // miente más que no ponerla.
  const cuenta = d?.proxima ? faltan(d.proxima) : null;

  /* LO QUE VIENE DE LA JUNTA PASADA. Va primero y junto —acuerdos que nadie
     cumplió y puntos que no se alcanzaron a ver—: son la misma pregunta
     («¿qué quedó?») y estaban en dos lugares distintos, uno de ellos hasta
     abajo, donde nadie llega. */
  const vienenDeAntes = (d?.pendientes || []).filter(a => !ab || a.sesion_id !== ab.id);
  const arrastrados = (d?.agenda || []).filter(x => x.arrastres > 0);
  const nuevosDeLaSemana = (d?.agenda || []).filter(x => !x.arrastres);

  /* Los puntos agrupados por quién los propuso: en una junta de dos, saber de
     quién es cada punto es la mitad de la información. */
  const porPersona = (() => {
    const m = new Map<string, { quien: Punto['propuesto_por']; puntos: Punto[] }>();
    for (const x of nuevosDeLaSemana) {
      const k = x.propuesto_por?.id || 'sin';
      if (!m.has(k)) m.set(k, { quien: x.propuesto_por, puntos: [] });
      m.get(k)!.puntos.push(x);
    }
    return [...m.values()];
  })();

  return (
    <>
      <div className="eq-cab">
        {p.movil && <button className="eq-ib" onClick={p.onCerrar} aria-label="Volver">{Ic.atras}</button>}
        {/* El nombre de la JUNTA, no la palabra «Sala»: cada canal es una
            reunión, así que al entrar hay que saber a cuál se entró. */}
        <h2>{Ic.sala} {p.canal.descripcion || p.canal.nombre}</h2>
        <span className="desc">
          {ab ? 'Reunión en curso'
            : d?.proxima ? <>{proximaTxt} · <b className={cuenta?.cerca ? 'eq-ya' : undefined}>{cuenta?.txt}</b></>
              : d ? 'sin día fijo' : ''}
        </span>
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
                {/* Cuánto llevamos. Sin esto, a la mitad de la junta nadie sabe
                    si va sobrada o si hay que apurarse — y eso se descubre al
                    final, que es cuando ya no se puede hacer nada. */}
                {d.agenda.length > 0 && (() => {
                  const listos = d.agenda.filter(x => x.estado === 'acordado' || x.estado === 'tratado').length;
                  return <span className="t">{listos} de {d.agenda.length} vistos</span>;
                })()}
                <span style={{ flex: 1 }} />
                <button className="eq-btn p" disabled={ocupado === ab.id} onClick={() => setCerrando(cerrando === null ? '' : null)}>{Ic.stop} Cerrar reunión</button>
              </div>
              {cerrando !== null && (
                <div className="eq-form" style={{ padding: '2px 0 4px', gap: 6 }}>
                  <input autoFocus value={cerrando} maxLength={400} placeholder="Nota para el acta (opcional)"
                    onChange={e => setCerrando(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setCerrando(null); }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="eq-btn p" disabled={ocupado === ab.id} onClick={async () => {
                      const r = await accion({ accion: 'cerrar', sesion_id: ab.id, nota: cerrando || null }, 'Acta lista y fijada en el canal');
                      setCerrando(null); if (r) setTab('historial');
                    }}>Cerrar y levantar el acta</button>
                    <button className="eq-btn t" onClick={() => setCerrando(null)}>Cancelar</button>
                  </div>
                </div>
              )}
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

          {/* ── LO QUE QUEDÓ DE LA JUNTA PASADA · va PRIMERO ──
              Estaba hasta abajo, después de la agenda y de las citas, que es
              donde nadie llega. Y es lo único de la sala que ya se prometió una
              vez: si no se ve al abrir, la junta empieza por lo nuevo y lo
              viejo se arrastra otra semana sin que nadie lo diga. */}
          {(vienenDeAntes.length > 0 || arrastrados.length > 0) && (
            <div className="eq-bloque eq-antes">
              <div className="cab">
                <b>Viene de la junta pasada</b>
                <span className="n">{vienenDeAntes.length + arrastrados.length}</span>
              </div>
              {vienenDeAntes.map(a => (
                <FilaAcuerdo key={a.id} a={a}
                  onToggle={() => accion({ accion: 'hecho', acuerdo_id: a.id, hecho: !a.hecho_at })}
                  /* Un clic: lo que no se cumplió se vuelve acuerdo de HOY, con
                     fecha nueva y el mismo responsable. El viejo sale de
                     pendientes apuntando al nuevo — no se borra ni se da por
                     hecho, porque no se hizo.
                     Solo aparece con la reunión abierta: un acuerdo «de hoy»
                     necesita un hoy. */
                  onArrastrar={ab ? () => accion({ accion: 'arrastrar', acuerdo_id: a.id, sesion_id: ab.id }, 'Pasó a los acuerdos de hoy') : undefined}
                  ocupado={ocupado === a.id} />
              ))}
              {arrastrados.map(pt => (
                <div key={pt.id} className="eq-punto" style={{ padding: '8px 12px' }}>
                  <span className="num" title={`No se alcanzó a ver ${pt.arrastres} ${pt.arrastres === 1 ? 'vez' : 'veces'}`}>↻</span>
                  <div className="tt">
                    <b>{pt.titulo}</b>
                    <small>
                      {pt.propuesto_por ? `${primero(pt.propuesto_por.nombre)} · ` : ''}
                      <span style={{ color: '#9a6a10', fontWeight: 700 }}>sin verse ×{pt.arrastres}</span>
                    </small>
                  </div>
                </div>
              ))}
              {!vienenDeAntes.length && (
                <div className="eq-nota">Los acuerdos de la junta pasada están todos cumplidos.</div>
              )}
            </div>
          )}

          <div className="eq-bloque">
            {/* El nombre dice que esto es lo EXTRA de la semana, no el guion.
                «Agenda» a secas se confundía con los temas de siempre; con dos
                pestañas y dos nombres, cada cosa se lee por lo que es. */}
            <div className="cab">
              <b>{ab ? 'Puntos de hoy' : 'Puntos extra de esta semana'}</b>
              <span className="n">{nuevosDeLaSemana.length || 'ninguno'}</span>
            </div>
            {!nuevosDeLaSemana.length && (
              <div className="eq-nota">
                Nadie ha agregado nada esta semana. La junta corre con su <b>guion</b> de siempre;
                lo que escribas aquí se ve <b>además</b> de eso.
              </div>
            )}

            {/* AGRUPADOS POR QUIÉN LOS PROPUSO. En una junta de dos, saber de
                quién es cada punto es la mitad de la información: dice a quién
                le toca hablar y contra quién se cuenta el tiempo.
                En reunión NO se agrupa: ahí el orden lo manda la prioridad —lo
                arrastrado y lo votado primero—, no de quién es. */}
            {(ab ? [{ quien: null as Punto['propuesto_por'], puntos: nuevosDeLaSemana }] : porPersona).map((g, gi) => (
              <div key={gi}>
                {!ab && porPersona.length > 1 && (
                  <div className="eq-quien">
                    {g.quien ? <><Avatar p={g.quien as any} size={16} />{primero(g.quien.nombre)}</> : 'Sin autor'}
                    <span className="c">{g.puntos.length}</span>
                  </div>
                )}
                {g.puntos.map((pt, i) => {
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
                    {editando?.id === pt.id && (
                      <div className="eq-form" style={{ padding: '6px 0 2px', gap: 6 }}>
                        <input autoFocus value={editando.texto} maxLength={120}
                          onChange={e => setEditando({ id: pt.id, texto: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Escape') setEditando(null);
                            if (e.key === 'Enter' && editando.texto.trim().length >= 3) {
                              if (editando.texto.trim() !== pt.titulo) accion({ accion: 'editar', punto_id: pt.id, titulo: editando.texto.trim() });
                              setEditando(null);
                            }
                          }} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="eq-btn p" disabled={editando.texto.trim().length < 3} onClick={() => {
                            if (editando.texto.trim() !== pt.titulo) accion({ accion: 'editar', punto_id: pt.id, titulo: editando.texto.trim() });
                            setEditando(null);
                          }}>Guardar</button>
                          <button className="eq-btn t" onClick={() => setEditando(null)}>Cancelar</button>
                        </div>
                      </div>
                    )}
                    {!ab && mio && pt.estado === 'propuesto' && !editando && (
                      <div className="eq-punto-acc">
                        {/* `prompt()` y `confirm()` del navegador: fuera. En el
                            teléfono son cuadros del sistema que tapan la
                            pantalla, no se ven como la app y no dejan copiar el
                            texto que se está editando. Editar es en línea y
                            retirar pide confirmación con el mismo botón. */}
                        <button className="eq-btn t" onClick={() => setEditando({ id: pt.id, texto: pt.titulo })}>Editar</button>
                        <button className={'eq-btn t' + (retirando === pt.id ? ' peligro' : '')}
                          onClick={() => { if (retirando === pt.id) { accion({ accion: 'retirar', punto_id: pt.id }); setRetirando(null); } else { setRetirando(pt.id); setTimeout(() => setRetirando(x => x === pt.id ? null : x), 4000); } }}>
                          {retirando === pt.id ? '¿Seguro?' : 'Retirar'}
                        </button>
                      </div>
                    )}
                    {acordando === pt.id && ab && <FormAcuerdo gente={gente} yo={p.yo} onCancelar={() => setAcordando(false)} onGuardar={async (b) => { const r = await accion({ accion: 'acordar', sesion_id: ab.id, punto_id: pt.id, ...b }, 'Acuerdo guardado'); if (r) setAcordando(false); }} />}
                  </div>
                  <button className={'votos' + (pt.vote ? ' mio' : '')} title={pt.vote ? 'Quitar mi voto' : 'Votar para verlo primero'} onClick={() => accion({ accion: 'votar', punto_id: pt.id })}>▲ {pt.votos}</button>
                </div>
              );
                })}
              </div>
            ))}
            <div style={{ padding: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={nuevo} onChange={e => setNuevo(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') proponer(); }} maxLength={120}
                  placeholder={ab ? 'Agregar un punto sobre la marcha…' : 'Un punto extra para esta junta…'}
                  style={{ flex: 1, border: '1.5px solid var(--eq-linea)', borderRadius: 9, padding: '7px 10px', font: 'inherit', outline: 0, minWidth: 0 }} />
                <button className="eq-btn" disabled={nuevo.trim().length < 3 || ocupado === 'proponer'} onClick={proponer}>Proponer</button>
              </div>
              {/* Antes el botón simplemente no hacía nada con menos de 3
                  caracteres, sin decir por qué: se leía como que la app estaba
                  rota. Ahora lo dice, y solo cuando ya empezaste a escribir. */}
              {nuevo.trim().length > 0 && nuevo.trim().length < 3 && (
                <div className="eq-nota" style={{ padding: '6px 2px 0' }}>Escribe al menos 3 letras.</div>
              )}
            </div>
          </div>

          {ab && ab.acuerdos.length > 0 && (
            <div className="eq-bloque">
              <div className="cab"><b>Acordado hoy</b><span className="n">{ab.acuerdos.length}</span></div>
              {ab.acuerdos.map(a => <FilaAcuerdo key={a.id} a={a} onToggle={() => accion({ accion: 'hecho', acuerdo_id: a.id, hecho: !a.hecho_at })} />)}
            </div>
          )}

          {/* «Acuerdos pendientes» ya no vive aquí abajo: subió a «Viene de la
              junta pasada», que es donde se lee al abrir la sala. */}
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

function FilaAcuerdo({ a, onToggle, onArrastrar, ocupado }: {
  a: Acuerdo; onToggle: () => void; onArrastrar?: () => void; ocupado?: boolean;
}) {
  const vencido = !a.hecho_at && !!a.vence_at && a.vence_at < hoyYmd();
  return (
    <div className={'eq-acuerdo' + (a.hecho_at ? ' hecho' : '')}>
      <button className="chk" style={{ minHeight: 18 }} onClick={onToggle} title={a.hecho_at ? 'Marcar pendiente' : 'Marcar hecho'}>{a.hecho_at ? Ic.check : null}</button>
      <div className="tt">
        <b>{a.texto}</b>
        <small className={vencido ? 'vencido' : ''}>
          {a.responsable ? primero(a.responsable.nombre) : 'Sin responsable'}
          {a.vence_at ? ` · para el ${fFecha(a.vence_at)}` : ''}
          {vencido ? ' · vencido' : ''}
          {a.hecho_at ? ` · hecho ${hace(a.hecho_at)}` : ''}
          {/* Cuántas veces se ha pasado a la siguiente. «Se pasó» tres veces
              seguidas significa otra cosa que la primera, y sin el número las
              tres se leen igual. */}
          {!!a.arrastres && <span className="veces"> · pasado ×{a.arrastres}</span>}
        </small>
      </div>
      {onArrastrar && !a.hecho_at && (
        <button className="eq-btn t pasa" disabled={ocupado} onClick={onArrastrar}
          title="No se cumplió: pásalo como acuerdo de la reunión de hoy, con fecha nueva">
          Pasar a hoy
        </button>
      )}
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
