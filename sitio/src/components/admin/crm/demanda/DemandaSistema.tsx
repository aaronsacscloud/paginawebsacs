// MOTOR DE DEMANDA · Sistema.
//
// La sala de máquinas. Responde tres preguntas y en este orden: ¿está vivo?,
// ¿qué espera de mí?, ¿qué le falta para trabajar?
//
// Esa última es la que suele faltar en un panel de automatización: un motor que
// no puede DECIR lo que necesita se queda callado meses y el hueco se descubre
// por el dato que nunca llegó.
import { useEffect, useState } from 'react';
import { WRAP } from '../../../../lib/crm/layout';
import { P } from '../../../../lib/crm/paleta';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Cargando from '../ui/Cargando';
import { Kpi, Pastilla, Seccion, Tarjeta, TONO_ESTADO, TONO_RIESGO, btn, haceRato } from './ui';

type Vista = 'cola' | 'aprobaciones' | 'falta' | 'ajustes';

export default function DemandaSistema() {
  const isMobile = useIsMobile();
  const [e, setE] = useState<any>(null);
  const [acciones, setAcciones] = useState<any[]>([]);
  const [vista, setVista] = useState<Vista>('cola');
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const traer = async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/crm/demanda/estado').then(r => r.json()),
        fetch('/api/crm/demanda/acciones?limite=120').then(r => r.json()),
      ]);
      setE(r1); setAcciones(r2.acciones || []);
    } catch { /* la pantalla no se cae por un fetch */ }
    setCargando(false);
  };
  useEffect(() => { traer(); const t = setInterval(traer, 30_000); return () => clearInterval(t); }, []);

  const correr = async (que: string, extra: any = {}) => {
    setOcupado(true); setAviso(null);
    try {
      const r = await fetch('/api/crm/demanda/correr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ que, ...extra }),
      }).then(r => r.json());
      setAviso(r.ok
        ? (que === 'worker' ? `Worker: ${r.tomadas} tomadas · ${r.hechas} hechas · ${r.fallidas} reintentan · ${r.muertas} se rindieron` : que === 'ciclo' ? `Ciclo armado: ${r.nuevas} acciones nuevas${r.omitidos?.length ? `, ${r.omitidos.length} fuente(s) omitida(s)` : ''}` : `Encoladas ${r.nuevas} acciones de prueba`)
        : `No se pudo: ${r.error || r.frenado}`);
      await traer();
    } catch (err: any) { setAviso(`No se pudo: ${err?.message || err}`); }
    setOcupado(false);
  };

  const resolver = async (id: string, accion: string, motivo?: string) => {
    setOcupado(true);
    await fetch('/api/crm/demanda/acciones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, accion, motivo }),
    });
    await traer(); setOcupado(false);
  };

  const guardar = async (cuerpo: any) => {
    setOcupado(true);
    const r = await fetch('/api/crm/demanda/ajustes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    }).then(r => r.json());
    if (!r.ok) setAviso(r.error || 'No se pudo guardar');
    await traer(); setOcupado(false);
  };

  if (cargando) return <div style={WRAP}><Cargando /></div>;
  if (!e?.ok) return <div style={WRAP}><Tarjeta franja={P.rojo}>No se pudo leer el estado del motor. {e?.error}</Tarjeta></div>;

  const cola = e.cola || {};
  const salud = e.salud;
  const ultimo = (e.ciclos || [])[0];
  const pres = e.presupuesto || {};
  const apro = e.aprobaciones || [];
  const NIVELES = ['0 · solo observa', '1 · recomienda', '2 · redacta', '3 · ejecuta lo reversible', '4 · autónomo'];

  return (
    <div style={{ ...WRAP, ...(isMobile ? { padding: '16px 16px 80px' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 21, color: P.tinta }}>Sistema</h2>
          <p style={{ margin: '4px 0 0', color: P.suave, fontSize: 13.5 }}>
            La sala de máquinas del motor de demanda: su cola, lo que espera de ti y lo que le falta para trabajar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn()} disabled={ocupado} onClick={() => correr('prueba')}>Prueba de vida</button>
          <button style={btn()} disabled={ocupado} onClick={() => correr('worker')}>Empujar la cola</button>
          <button style={btn(true)} disabled={ocupado} onClick={() => correr('ciclo', { tipo: 'manual' })}>Correr un ciclo</button>
        </div>
      </div>

      {aviso ? (
        <div style={{ marginTop: 12, background: P.violetaAgua, color: P.violetaHondo, borderRadius: 8, padding: '10px 13px', fontSize: 13 }}>{aviso}</div>
      ) : null}

      {e.config?.kill_switch ? (
        <div style={{ marginTop: 12, background: P.rojoAgua, color: P.rojoTinta, borderRadius: 8, padding: '11px 14px', fontSize: 13.5, fontWeight: 600 }}>
          El motor está apagado. No escribe nada hasta que lo enciendas en Ajustes.
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 12, marginTop: 16 }}>
        <Kpi franja={salud?.score >= 85 ? P.verde : salud?.score >= 50 ? P.ambar : P.rojo}
             titulo="Salud" valor={salud ? `${salud.score}` : '—'}
             pie={salud ? `${(salud.incidencias || []).length} incidencia(s)` : 'sin medir todavía'} />
        <Kpi franja={P.azul} titulo="En la cola"
             valor={(cola.lista || 0) + (cola.pendiente || 0) + (cola.corriendo || 0)}
             pie={`${cola.corriendo || 0} corriendo · ${cola.muerta || 0} rendidas`} />
        <Kpi franja={apro.length ? P.ambar : P.linea} titulo="Esperan tu OK" valor={apro.length}
             pie={apro.length ? 'revísalas abajo' : 'nada pendiente'} />
        <Kpi franja={pres.agotado ? P.rojo : pres.restringido ? P.ambar : P.verde} titulo="Gasto del mes"
             valor={`$${Number(pres.gastado || 0).toFixed(2)}`} pie={`de $${pres.tope} · ${pres.pct}%`} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 20, flexWrap: 'wrap' }}>
        {([['cola', 'Cola'], ['aprobaciones', `Aprobaciones${apro.length ? ` (${apro.length})` : ''}`], ['falta', `Lo que me falta${e.falta?.length ? ` (${e.falta.length})` : ''}`], ['ajustes', 'Ajustes']] as [Vista, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setVista(k)} style={{
            ...btn(vista === k), borderRadius: 999, padding: '7px 15px',
          }}>{l}</button>
        ))}
      </div>

      {vista === 'cola' ? (
        <Seccion titulo="La cola" aparte={<span style={{ fontSize: 12.5, color: P.suave }}>
          {ultimo ? `último ciclo ${ultimo.tipo} · ${haceRato(ultimo.inicio)} · ${ultimo.acciones_ok} hechas` : 'todavía no ha corrido ningún ciclo'}
        </span>}>
          {acciones.length === 0 ? (
            <Tarjeta><span style={{ color: P.suave, fontSize: 13.5 }}>La cola está vacía. Arranca con «Prueba de vida» para ver el carril completo, o «Correr un ciclo».</span></Tarjeta>
          ) : (
            <div className="crm-scroll-x">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: isMobile ? 640 : undefined }}>
                <thead>
                  <tr>{['Acción', 'Estado', 'Riesgo', 'Intentos', 'Cuándo', 'Qué pasó', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${P.linea}`, color: P.tenue, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {acciones.map(a => (
                    <tr key={a.id}>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, fontWeight: 600, color: P.tinta, whiteSpace: 'nowrap' }}>{a.tipo}</td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}` }}>
                        <Pastilla tono={TONO_ESTADO[a.estado] || { fondo: P.lineaSuave, tinta: P.suave }}>{(TONO_ESTADO[a.estado]?.label) || a.estado}</Pastilla>
                      </td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}` }}>
                        <Pastilla tono={TONO_RIESGO[a.riesgo] || TONO_RIESGO.LOW}>{a.riesgo}</Pastilla>
                      </td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, color: P.suave, fontVariantNumeric: 'tabular-nums' }}>{a.intentos}/{a.max_intentos}</td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, color: P.suave, whiteSpace: 'nowrap' }}>{haceRato(a.terminada_at || a.iniciada_at || a.created_at)}</td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, color: P.texto, maxWidth: 320 }}>
                        {a.error?.mensaje || a.resultado?.resumen || a.motivo || '—'}
                      </td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}` }}>
                        {['muerta', 'fallida', 'rechazada'].includes(a.estado) ? (
                          <button style={{ ...btn(), padding: '5px 10px', fontSize: 12 }} disabled={ocupado} onClick={() => resolver(a.id, 'reintentar')}>Reintentar</button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Seccion>
      ) : null}

      {vista === 'aprobaciones' ? (
        <Seccion titulo="Lo que espera tu visto bueno">
          {apro.length === 0 ? (
            <Tarjeta franja={P.verde}><span style={{ color: P.suave, fontSize: 13.5 }}>Nada pendiente. El motor está trabajando dentro de lo que le autorizaste.</span></Tarjeta>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {apro.map((a: any) => (
                <Tarjeta key={a.id} franja={(TONO_RIESGO[a.riesgo] || TONO_RIESGO.MEDIUM).tinta}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: P.tinta, fontSize: 14.5 }}>{a.tipo}</div>
                      <div style={{ color: P.texto, fontSize: 13, marginTop: 3 }}>{a.motivo || 'Requiere aprobación.'}</div>
                      <div style={{ color: P.tenue, fontSize: 12, marginTop: 4 }}>{haceRato(a.created_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={btn()} disabled={ocupado} onClick={() => resolver(a.id, 'rechazar', 'rechazada desde el CRM')}>Ahora no</button>
                      <button style={btn(true)} disabled={ocupado} onClick={() => resolver(a.id, 'aprobar')}>Adelante</button>
                    </div>
                  </div>
                </Tarjeta>
              ))}
            </div>
          )}
        </Seccion>
      ) : null}

      {vista === 'falta' ? (
        <Seccion titulo="Lo que me falta para trabajar" aparte={<span style={{ fontSize: 12.5, color: P.suave }}>cada hueco dice qué se pierde</span>}>
          <div style={{ display: 'grid', gap: 10 }}>
            {(e.falta || []).map((f: any) => (
              <Tarjeta key={f.id} franja={f.construido ? P.ambar : P.linea}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, color: P.tinta, fontSize: 14.5 }}>{f.nombre}</div>
                    <div style={{ color: P.texto, fontSize: 13, marginTop: 3 }}>{f.que_falta}</div>
                    {f.impacto ? <div style={{ color: P.suave, fontSize: 12.5, marginTop: 4 }}>{f.impacto}</div> : null}
                  </div>
                  <Pastilla tono={f.construido ? { fondo: P.ambarAgua, tinta: P.ambarTinta } : { fondo: P.lineaSuave, tinta: P.gris }}>
                    {f.construido ? 'listo para conectar' : 'aún no construido'}
                  </Pastilla>
                </div>
              </Tarjeta>
            ))}
            {(e.falta || []).length === 0 ? <Tarjeta franja={P.verde}>No me falta nada: todas las fuentes están conectadas y encendidas.</Tarjeta> : null}
          </div>
        </Seccion>
      ) : null}

      {vista === 'ajustes' ? (
        <>
          {/* LA RAMPA · va ANTES del selector de autonomía a propósito.
              El selector contesta «¿en qué nivel estoy?»; la rampa contesta la
              pregunta útil, que es «¿qué tendría que pasar para subir?». Verlas
              en el orden contrario invita a mover el selector a ojo, que es
              justo lo que estos criterios existen para evitar. */}
          <Seccion titulo="Qué se ha ganado el motor"
            aparte={<span style={{ fontSize: 12.5, color: P.suave }}>baja solo · sube solo si tú lo concedes</span>}>
            <Tarjeta>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, color: P.suave, lineHeight: 1.6, maxWidth: '70ch' }}>
                Si rechazas dos cosas del mismo tipo en 14 días, ese tipo <strong>pierde autonomía
                solo y sin preguntar</strong>. Para subir, en cambio, el motor reúne la evidencia y
                te la enseña: el permiso lo das tú. Equivocarse bajando cuesta unas aprobaciones de
                más; equivocarse subiendo cuesta que publique algo que nadie quería.
              </p>
              {!(e.rampa || []).length ? (
                <div style={{ fontSize: 13.5, color: P.suave }}>Nada evaluable todavía.</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {(e.rampa || []).slice(0, 8).map((r: any) => (
                    <div key={r.tipo_accion} style={{
                      border: `1px solid ${r.se_lo_gano ? P.verdeTinta : P.lineaSuave}`,
                      borderRadius: 9, padding: '10px 12px',
                      background: r.se_lo_gano ? P.verdeAgua : 'transparent',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: P.tinta }}>
                          {r.tipo_accion}
                          <span style={{ color: P.suave, fontWeight: 400 }}> · pide nivel {r.nivel_actual} → {r.nivel_propuesto}</span>
                        </div>
                        {r.se_lo_gano ? (
                          <button disabled={ocupado} style={btn(true)}
                            onClick={() => guardar({ conceder_autonomia: { tipo_accion: r.tipo_accion } })}>
                            Concederlo
                          </button>
                        ) : null}
                      </div>
                      <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 3 }}>
                        {r.criterios.map((c: any, i: number) => (
                          <li key={i} style={{ fontSize: 12.5, color: c.cumple ? P.verdeTinta : P.suave, display: 'flex', gap: 7 }}>
                            <span style={{ fontWeight: 700 }}>{c.cumple ? '✓' : '·'}</span>
                            <span>{c.que} — <span style={{ color: P.tenue }}>{c.medido}</span></span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Tarjeta>
          </Seccion>

          <Seccion titulo="Cómo se comporta">
            <Tarjeta>
              <label style={{ display: 'block', fontSize: 13, color: P.texto, fontWeight: 600 }}>Autonomía</label>
              <p style={{ margin: '3px 0 8px', fontSize: 12.5, color: P.suave }}>
                Hasta dónde puede llegar solo. Cada tipo de acción pide un nivel; lo que pide más de lo que hay aquí, te espera.
              </p>
              <select id="de-autonomia" value={e.config.autonomia_global} disabled={ocupado}
                      onChange={ev => guardar({ config: { autonomia_global: Number(ev.target.value) } })}
                      style={{ padding: '9px 11px', borderRadius: 8, border: `1px solid ${P.linea}`, fontSize: 14, minWidth: 260 }}>
                {NIVELES.map((n, i) => <option key={i} value={i}>{n}</option>)}
              </select>

              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 16, alignItems: 'flex-end' }}>
                <div>
                  <label htmlFor="de-presupuesto" style={{ display: 'block', fontSize: 13, color: P.texto, fontWeight: 600, marginBottom: 4 }}>Presupuesto del mes (USD)</label>
                  <input id="de-presupuesto" type="number" defaultValue={e.config.presupuesto_mensual_usd} min={0} step={10}
                         onBlur={ev => guardar({ config: { presupuesto_mensual_usd: Number(ev.currentTarget.value) } })}
                         style={{ padding: '9px 11px', borderRadius: 8, border: `1px solid ${P.linea}`, fontSize: 14, width: 140 }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: P.texto, minHeight: 38 }}>
                  <input id="de-kill" type="checkbox" checked={!!e.config.kill_switch} disabled={ocupado}
                         onChange={ev => guardar({ config: { kill_switch: ev.target.checked } })} />
                  Apagar el motor (deja de escribir; se sigue viendo todo)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: P.texto, minHeight: 38 }}>
                  <input id="de-simulacion" type="checkbox" checked={e.config.modo === 'simulacion'} disabled={ocupado}
                         onChange={ev => guardar({ config: { modo: ev.target.checked ? 'simulacion' : 'normal' } })} />
                  Modo simulación (decide y muestra, sin publicar)
                </label>
              </div>
            </Tarjeta>
          </Seccion>

          <Seccion titulo="Fuentes" aparte={<span style={{ fontSize: 12.5, color: P.suave }}>encender una que no tiene credencial no hace nada: lo dirá aquí</span>}>
            <div style={{ display: 'grid', gap: 8 }}>
              {(e.conectores || []).map((k: any) => (
                <Tarjeta key={k.id} franja={k.activo && k.disponible ? P.verde : k.disponible ? P.linea : P.ambar} style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, color: P.tinta, fontSize: 14 }}>{k.nombre}</div>
                      <div style={{ fontSize: 12.5, color: P.suave, marginTop: 2 }}>
                        {k.grupo} · {k.cadencia} · dato {k.naturaleza}
                        {k.ultimo_ok_at ? ` · ok ${haceRato(k.ultimo_ok_at)}` : ''}
                        {k.fallos_seguidos ? ` · ${k.fallos_seguidos} fallos seguidos` : ''}
                      </div>
                      {!k.disponible ? <div style={{ fontSize: 12.5, color: P.ambarTinta, marginTop: 3 }}>{k.falta || 'falta credencial o permiso'}</div> : null}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: P.texto, whiteSpace: 'nowrap' }}>
                      <input id={`de-con-${k.id}`} type="checkbox" checked={!!k.activo} disabled={ocupado}
                             onChange={ev => guardar({ conector: { id: k.id, activo: ev.target.checked } })} />
                      encendida
                    </label>
                  </div>
                </Tarjeta>
              ))}
            </div>
          </Seccion>

          <Seccion titulo="Qué puede hacer solo" aparte={<span style={{ fontSize: 12.5, color: P.suave }}>los guardrails no se tocan desde aquí</span>}>
            <div className="crm-scroll-x">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: isMobile ? 560 : undefined }}>
                <thead><tr>{['Acción', 'Riesgo', 'Exige', 'Tope/día', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: `1px solid ${P.linea}`, color: P.tenue, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {(e.politicas || []).map((p: any) => (
                    <tr key={p.tipo_accion}>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${P.lineaSuave}`, color: P.tinta, fontWeight: 600 }}>{p.tipo_accion}</td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${P.lineaSuave}` }}><Pastilla tono={TONO_RIESGO[p.riesgo]}>{p.riesgo}</Pastilla></td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${P.lineaSuave}`, color: P.suave }}>nivel {p.nivel}{p.requiere_aprobacion ? ' + tu OK' : ''}</td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${P.lineaSuave}`, color: P.suave, fontVariantNumeric: 'tabular-nums' }}>{p.tope_dia ?? '—'}</td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${P.lineaSuave}`, color: P.tenue, fontSize: 12 }}>{p.inmutable ? 'guardrail' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Seccion>
        </>
      ) : null}
    </div>
  );
}
