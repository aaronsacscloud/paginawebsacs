// La ficha de un evento: qué es, quién va, cuánto cuesta, cómo se participa y
// qué tanto encaja. Abajo, sus ediciones (una por fecha) con la decisión de
// cada una. Se lee como un expediente; con «Editar» se vuelve formulario.
import { useEffect, useState } from 'react';
import { P, tarjetaKpi } from '../../../../lib/crm/paleta';
import { TIPO_ETIQ, ROL_ETIQ, DECISION_TONO, PARTICIPACION_TONO, GIROS_EVENTO, Pastilla, Fit, Btn, Campo, INPUT, Seccion, fmt, rango, relativo, post } from './ui';

const CAMPOS_TEXTO: [string, string, number?][] = [
  ['descripcion', 'Qué es el evento', 4], ['perfil_visitante', 'Quién va a comprar (visitantes)', 3], ['perfil_expositor', 'Quién expone', 3],
  ['quien_es_prospecto', 'Quién de los que van es nuestro prospecto', 3], ['fit_por_que', 'Por qué encaja (o no)', 3],
  ['como_participar', 'Cómo se participa (stand, registro, requisitos)', 3], ['costo_stand', 'Costo del stand', 2], ['costo_entrada', 'Costo de entrada', 1],
  ['huecos', 'Lo que no se sabe todavía', 3],
];

export default function EventoFicha({ evento, hoy, onCambio, onEdicion, onCerrar }: {
  evento: any | null; hoy: string; onCambio: () => void; onEdicion: (id: string) => void; onCerrar: () => void;
}) {
  const [editando, setEditando] = useState(!evento);
  const [f, setF] = useState<any>(() => ({ ...(evento || { tipo: 'feria_comercial', giros: [], decision: 'evaluar' }) }));
  const [guardando, setGuardando] = useState(false);
  const [nuevaEd, setNuevaEd] = useState(false);
  const [ed, setEd] = useState<any>({ nombre: '', inicio: '', fin: '', ciudad: evento?.ciudad || '', sede: evento?.sede || '', estado_fecha: 'confirmada', url_registro: '' });
  const [nota, setNota] = useState(evento?.decision_nota || '');
  useEffect(() => { if (evento) { setF({ ...evento }); setNota(evento.decision_nota || ''); } }, [evento?.id, evento?.updated_at]);

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await post('/api/crm/eventos', { accion: 'guardar_evento', evento_id: evento?.id, ...f });
      setEditando(false); onCambio();
      if (!evento) onCerrar();
      return r;
    } catch (e: any) { alert(e.message); } finally { setGuardando(false); }
  };
  const decidir = async (decision: string) => {
    try { await post('/api/crm/eventos', { accion: 'decision', evento_id: evento.id, decision, nota }); onCambio(); } catch (e: any) { alert(e.message); }
  };
  const crearEdicion = async () => {
    if (!ed.nombre.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(ed.inicio)) return alert('Nombre y fecha de inicio son obligatorios.');
    try { await post('/api/crm/eventos', { accion: 'crear_edicion', evento_id: evento.id, ...ed, fin: ed.fin || ed.inicio }); setNuevaEd(false); setEd({ ...ed, nombre: '', inicio: '', fin: '' }); onCambio(); } catch (e: any) { alert(e.message); }
  };
  const participar = async (edicion_id: string, participacion: string) => {
    try { await post('/api/crm/eventos', { accion: 'guardar_edicion', edicion_id, participacion, rol: participacion === 'vamos' ? (evento.rol_recomendado && evento.rol_recomendado !== 'ninguno' ? evento.rol_recomendado : 'recorrido') : undefined }); onCambio(); } catch (e: any) { alert(e.message); }
  };

  if (editando) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          <Campo label="Nombre" ancho={2}><input style={INPUT} value={f.nombre || ''} onChange={e => set('nombre', e.target.value)} placeholder="Intermoda" /></Campo>
          <Campo label="Tipo"><select style={INPUT} value={f.tipo || 'feria_comercial'} onChange={e => set('tipo', e.target.value)}>{Object.entries(TIPO_ETIQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
          <Campo label="Frecuencia"><input style={INPUT} value={f.frecuencia || ''} onChange={e => set('frecuencia', e.target.value)} placeholder="2 veces al año (enero y julio)" /></Campo>
          <Campo label="Ciudad"><input style={INPUT} value={f.ciudad || ''} onChange={e => set('ciudad', e.target.value)} /></Campo>
          <Campo label="Estado"><input style={INPUT} value={f.estado_geo || ''} onChange={e => set('estado_geo', e.target.value)} /></Campo>
          <Campo label="Sede"><input style={INPUT} value={f.sede || ''} onChange={e => set('sede', e.target.value)} placeholder="Expo Guadalajara" /></Campo>
          <Campo label="Organizador"><input style={INPUT} value={f.organizador || ''} onChange={e => set('organizador', e.target.value)} /></Campo>
          <Campo label="Sitio web"><input style={INPUT} value={f.sitio_web || ''} onChange={e => set('sitio_web', e.target.value)} /></Campo>
          <Campo label="Instagram"><input style={INPUT} value={f.instagram || ''} onChange={e => set('instagram', e.target.value)} /></Campo>
          <Campo label="Correo de contacto"><input style={INPUT} value={f.correo_contacto || ''} onChange={e => set('correo_contacto', e.target.value)} /></Campo>
          <Campo label="Teléfono"><input style={INPUT} value={f.telefono || ''} onChange={e => set('telefono', e.target.value)} /></Campo>
          <Campo label="Expositores (n)"><input style={INPUT} type="number" value={f.expositores_n ?? ''} onChange={e => set('expositores_n', e.target.value)} /></Campo>
          <Campo label="Visitantes (n)"><input style={INPUT} type="number" value={f.visitantes_n ?? ''} onChange={e => set('visitantes_n', e.target.value)} /></Campo>
          <Campo label="Fuente de las cifras"><input style={INPUT} value={f.fuente_cifras || ''} onChange={e => set('fuente_cifras', e.target.value)} placeholder="URL" /></Campo>
          <Campo label="Fuente de los costos"><input style={INPUT} value={f.fuente_costos || ''} onChange={e => set('fuente_costos', e.target.value)} placeholder="URL" /></Campo>
          <Campo label="Encaje (1–10)"><input style={INPUT} type="number" min={0} max={10} value={f.fit_puntaje ?? ''} onChange={e => set('fit_puntaje', e.target.value)} /></Campo>
          <Campo label="Cómo ir"><select style={INPUT} value={f.rol_recomendado || ''} onChange={e => set('rol_recomendado', e.target.value)}><option value="">—</option>{Object.entries(ROL_ETIQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
          <Campo label="Prospectos alcanzables" ayuda="cuántos de los que van podríamos conocer"><input style={INPUT} value={f.prospectos_alcanzables || ''} onChange={e => set('prospectos_alcanzables', e.target.value)} placeholder="200–400 dueños de boutique" /></Campo>
          <Campo label="Área de tecnología o servicios"><select style={INPUT} value={f.area_tecnologia == null ? '' : f.area_tecnologia ? '1' : '0'} onChange={e => set('area_tecnologia', e.target.value === '' ? null : e.target.value === '1')}><option value="">No se sabe</option><option value="1">Sí hay</option><option value="0">No hay</option></select></Campo>
        </div>
        <Campo label="Giros a los que sirve">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(GIROS_EVENTO).map(([k, v]) => {
              const on = (f.giros || []).includes(k);
              return <button key={k} type="button" onClick={() => set('giros', on ? f.giros.filter((g: string) => g !== k) : [...(f.giros || []), k])} style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 99, cursor: 'pointer', border: `1.5px solid ${on ? P.violeta : '#e4e4e4'}`, background: on ? P.violeta : '#fff', color: on ? '#fff' : '#555' }}>{v}</button>;
            })}
          </div>
        </Campo>
        {CAMPOS_TEXTO.map(([k, l, rows]) => (
          <Campo key={k} label={l}><textarea style={{ ...INPUT, minHeight: (rows || 2) * 24 + 16, resize: 'vertical' }} value={f[k] || ''} onChange={e => set(k, e.target.value)} /></Campo>
        ))}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {evento && <Btn nivel="terciario" onClick={() => { setEditando(false); setF({ ...evento }); }}>Cancelar</Btn>}
          <Btn nivel="primario" onClick={guardar} disabled={guardando || !String(f.nombre || '').trim()}>{guardando ? 'Guardando…' : evento ? 'Guardar cambios' : 'Crear evento'}</Btn>
        </div>
      </div>
    );
  }

  const e = evento;
  const fuentes: any[] = Array.isArray(e.fuentes) ? e.fuentes : [];
  const proximas = e.ediciones.filter((x: any) => (x.fin || x.inicio) >= hoy);
  const pasadas = e.ediciones.filter((x: any) => (x.fin || x.inicio) < hoy);
  return (
    <div>
      {/* Encabezado: tipo, lugar, encaje y la decisión — lo que se decide en 10 segundos. */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <Pastilla tono={{ bg: P.violetaAgua, fg: P.violetaTinta }}>{TIPO_ETIQ[e.tipo] || e.tipo}</Pastilla>
        <span style={{ fontSize: '.8125rem', color: '#666' }}>{[e.sede, e.ciudad, e.estado_geo].filter(Boolean).join(' · ')}{e.frecuencia ? ` · ${e.frecuencia}` : ''}</span>
        <span style={{ flex: 1 }} />
        <Fit v={e.fit_puntaje} />
        <Btn chico nivel="terciario" onClick={() => setEditando(true)}>Editar</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 18 }}>
        <div style={tarjetaKpi(P.azul)}><Etq>Expositores</Etq><Cifra c={P.azulTinta}>{e.expositores_n ? fmt(e.expositores_n) : '–'}</Cifra><Sub>{e.fuente_cifras ? <a href={e.fuente_cifras} target="_blank" rel="noreferrer" style={{ color: '#888' }}>según el organizador</a> : 'sin cifra pública'}</Sub></div>
        <div style={tarjetaKpi(P.azul)}><Etq>Visitantes</Etq><Cifra c={P.azulTinta}>{e.visitantes_n ? fmt(e.visitantes_n) : '–'}</Cifra><Sub>por edición</Sub></div>
        <div style={tarjetaKpi(P.violeta)}><Etq>Cómo ir</Etq><Cifra c={P.violetaTinta} chica>{ROL_ETIQ[e.rol_recomendado] || 'Por definir'}</Cifra><Sub>{e.prospectos_alcanzables ? e.prospectos_alcanzables.split(/[.;\n]/)[0] : 'prospectos por estimar'}</Sub></div>
        <div style={tarjetaKpi(P.ambar)}><Etq>Costo del stand</Etq><Cifra c={P.ambarTinta} chica>{e.costo_stand ? e.costo_stand.split(/[.;\n]/)[0].slice(0, 42) : 'Por cotizar'}</Cifra><Sub>{e.costo_entrada ? `entrada: ${e.costo_entrada.slice(0, 40)}` : ''}</Sub></div>
      </div>

      <Seccion titulo="La decisión">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'inline-flex', gap: 4 }}>
            {(['ir', 'evaluar', 'no_ir'] as const).map(dd => (
              <button key={dd} onClick={() => decidir(dd)} style={{ font: 'inherit', fontSize: '.8125rem', fontWeight: 700, padding: '7px 13px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${e.decision === dd ? P.violeta : '#e4e4e4'}`, background: e.decision === dd ? P.violeta : '#fff', color: e.decision === dd ? '#fff' : '#666' }}>{DECISION_TONO[dd].l}</button>
            ))}
          </div>
          <input value={nota} onChange={ev => setNota(ev.target.value)} onBlur={() => nota !== (e.decision_nota || '') && decidir(e.decision)} placeholder="Por qué (se guarda al salir del campo)" style={{ ...INPUT, flex: 1, minWidth: 220 }} />
        </div>
        {e.decision_at && <div style={{ fontSize: '.6875rem', color: '#999', marginTop: 6 }}>Decidido el {rango(e.decision_at.slice(0, 10))}</div>}
      </Seccion>

      <Seccion titulo="Ediciones" accion={<Btn chico nivel="secundario" onClick={() => setNuevaEd(v => !v)}>{nuevaEd ? 'Cancelar' : 'Agregar fecha'}</Btn>}>
        {nuevaEd && (
          <div style={{ ...tarjetaKpi(P.violeta), display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 10 }}>
            <Campo label="Nombre de la edición"><input style={INPUT} value={ed.nombre} onChange={x => setEd({ ...ed, nombre: x.target.value })} placeholder="Enero 2027" /></Campo>
            <Campo label="Inicio"><input style={INPUT} type="date" value={ed.inicio} onChange={x => setEd({ ...ed, inicio: x.target.value })} /></Campo>
            <Campo label="Fin"><input style={INPUT} type="date" value={ed.fin} onChange={x => setEd({ ...ed, fin: x.target.value })} /></Campo>
            <Campo label="Fecha"><select style={INPUT} value={ed.estado_fecha} onChange={x => setEd({ ...ed, estado_fecha: x.target.value })}><option value="confirmada">Confirmada</option><option value="estimada">Estimada</option></select></Campo>
            <Campo label="Ciudad"><input style={INPUT} value={ed.ciudad} onChange={x => setEd({ ...ed, ciudad: x.target.value })} /></Campo>
            <Campo label="Sede"><input style={INPUT} value={ed.sede} onChange={x => setEd({ ...ed, sede: x.target.value })} /></Campo>
            <Campo label="URL de registro"><input style={INPUT} value={ed.url_registro} onChange={x => setEd({ ...ed, url_registro: x.target.value })} /></Campo>
            <div style={{ alignSelf: 'end' }}><Btn nivel="primario" onClick={crearEdicion}>Crear edición</Btn></div>
          </div>
        )}
        {!e.ediciones.length && <div style={{ fontSize: '.8125rem', color: '#999' }}>Sin fechas cargadas. Agrega la próxima edición para poder prepararla.</div>}
        <div style={{ display: 'grid', gap: 8 }}>
          {[...proximas, ...pasadas].map((x: any) => {
            const tono = PARTICIPACION_TONO[x.participacion] || PARTICIPACION_TONO.sin_decidir;
            const pasada = (x.fin || x.inicio) < hoy;
            return (
              <div key={x.id} style={{ ...tarjetaKpi(pasada ? '#ddd' : x.participacion === 'vamos' ? P.verde : P.ambar), display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '11px 14px', opacity: pasada ? .8 : 1 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: '.9375rem' }}>{x.nombre} <span style={{ fontWeight: 500, color: '#888', fontSize: '.8125rem' }}>· {rango(x.inicio, x.fin)}{x.estado_fecha === 'estimada' ? ' (estimada)' : ''}</span></div>
                  <div style={{ fontSize: '.75rem', color: '#888', marginTop: 2 }}>{[x.sede || e.sede, x.ciudad || e.ciudad].filter(Boolean).join(' · ')} · {relativo(x.inicio)}{x.registros ? ` · ${x.registros} registros` : ''}</div>
                </div>
                <Pastilla tono={tono}>{tono.l}</Pastilla>
                {!pasada && x.participacion !== 'fuimos' && (
                  <div style={{ display: 'inline-flex', gap: 4 }}>
                    <Btn chico nivel={x.participacion === 'vamos' ? 'terciario' : 'secundario'} onClick={() => participar(x.id, x.participacion === 'vamos' ? 'sin_decidir' : 'vamos')}>{x.participacion === 'vamos' ? 'Ya no vamos' : 'Vamos'}</Btn>
                    {x.participacion !== 'vamos' && x.participacion !== 'no_vamos' && <Btn chico nivel="terciario" onClick={() => participar(x.id, 'no_vamos')}>No vamos</Btn>}
                  </div>
                )}
                <Btn chico nivel="primario" onClick={() => onEdicion(x.id)}>{pasada || x.participacion === 'fuimos' ? 'Ver resultados' : 'Preparar'}</Btn>
              </div>
            );
          })}
        </div>
      </Seccion>

      {e.descripcion && <Texto titulo="Qué es">{e.descripcion}</Texto>}
      {(e.perfil_visitante || e.perfil_expositor) && (
        <Seccion titulo="Quién va">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
            {e.perfil_visitante && <div><b style={{ fontSize: '.75rem', color: '#777' }}>Visitantes (los que compran)</b><Parrafo>{e.perfil_visitante}</Parrafo></div>}
            {e.perfil_expositor && <div><b style={{ fontSize: '.75rem', color: '#777' }}>Expositores</b><Parrafo>{e.perfil_expositor}</Parrafo></div>}
          </div>
        </Seccion>
      )}
      {e.quien_es_prospecto && <Texto titulo="Quién de ahí es nuestro prospecto">{e.quien_es_prospecto}</Texto>}
      {e.fit_por_que && <Texto titulo="Por qué encaja (o no)">{e.fit_por_que}{e.prospectos_alcanzables && e.prospectos_alcanzables.length > 60 ? `\n\nProspectos alcanzables: ${e.prospectos_alcanzables}` : ''}</Texto>}
      {(e.costo_stand || e.costo_entrada || e.como_participar) && (
        <Seccion titulo="Cuánto cuesta y cómo se participa">
          {e.costo_stand && <Parrafo><b>Stand:</b> {e.costo_stand}{e.fuente_costos ? <> · <a href={e.fuente_costos} target="_blank" rel="noreferrer" style={{ color: P.violetaTinta }}>fuente</a></> : null}</Parrafo>}
          {e.costo_entrada && <Parrafo><b>Entrada:</b> {e.costo_entrada}</Parrafo>}
          {e.como_participar && <Parrafo>{e.como_participar}</Parrafo>}
          {e.area_tecnologia != null && <Parrafo>{e.area_tecnologia ? 'Sí tiene área de tecnología o servicios para expositores como nosotros.' : 'No tiene área de tecnología o servicios: un stand de software ahí queda fuera de lugar.'}</Parrafo>}
        </Seccion>
      )}
      {e.huecos && <Texto titulo="Lo que no se sabe todavía" tono={P.ambarTinta}>{e.huecos}</Texto>}
      {(e.sitio_web || e.instagram || e.correo_contacto || e.telefono || e.organizador) && (
        <Seccion titulo="Contacto del organizador">
          <Parrafo>
            {e.organizador && <>{e.organizador} · </>}
            {e.sitio_web && <><a href={/^https?:/.test(e.sitio_web) ? e.sitio_web : `https://${e.sitio_web}`} target="_blank" rel="noreferrer" style={{ color: P.violetaTinta }}>{e.sitio_web.replace(/^https?:\/\//, '')}</a> · </>}
            {e.instagram && <><a href={`https://instagram.com/${e.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" style={{ color: P.violetaTinta }}>{e.instagram}</a> · </>}
            {e.correo_contacto && <><a href={`mailto:${e.correo_contacto}`} style={{ color: P.violetaTinta }}>{e.correo_contacto}</a> · </>}
            {e.telefono}
          </Parrafo>
        </Seccion>
      )}
      {!!fuentes.length && (
        <Seccion titulo="Fuentes">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '.75rem', color: '#666', lineHeight: 1.6 }}>
            {fuentes.map((s: any, i: number) => <li key={i}><a href={s.url || s} target="_blank" rel="noreferrer" style={{ color: P.violetaTinta }}>{s.titulo || s.url || s}</a>{s.que ? ` — ${s.que}` : ''}</li>)}
          </ul>
        </Seccion>
      )}
    </div>
  );
}

const Etq = ({ children }: any) => <div style={{ fontSize: '.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{children}</div>;
const Cifra = ({ children, c, chica }: any) => <div style={{ fontSize: chica ? '.9375rem' : '1.375rem', fontWeight: 800, color: c, marginTop: 3, lineHeight: 1.2 }}>{children}</div>;
// Dos líneas y punto: la investigación llena estos campos con párrafos, y una
// tarjeta de KPI que crece a 300 px deja de ser un KPI. El texto completo va abajo.
const Sub = ({ children }: any) => <div style={{ fontSize: '.6875rem', color: '#888', marginTop: 3, display: '-webkit-box', WebkitLineClamp: '2', lineClamp: '2', WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{children}</div>;
const Parrafo = ({ children }: any) => <p style={{ fontSize: '.875rem', color: '#333', lineHeight: 1.55, margin: '4px 0 8px', whiteSpace: 'pre-line' }}>{children}</p>;
const Texto = ({ titulo, children, tono }: any) => <Seccion titulo={titulo}><p style={{ fontSize: '.875rem', color: tono || '#333', lineHeight: 1.55, margin: 0, whiteSpace: 'pre-line' }}>{children}</p></Seccion>;
