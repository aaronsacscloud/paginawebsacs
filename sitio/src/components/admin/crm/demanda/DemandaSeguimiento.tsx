// MOTOR DE DEMANDA · Seguimiento: el loop de contenido visto desde el dueño.
//
// Por cada pieza (aprobada o publicada): en qué va, qué dijo el referee, qué le
// falta según los especialistas —y a quién le toca—, qué autoridad tiene ya
// (indexada, clics, citas en IA, enlaces) y qué piezas hermanas salieron de
// ella. Lo que es del dueño se tacha aquí; lo que es del motor lo hace el motor
// y aparece tachado solo.
import { useEffect, useState } from 'react';
import { WRAP } from '../../../../lib/crm/layout';
import { P } from '../../../../lib/crm/paleta';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Cargando from '../ui/Cargando';
import { Seccion, Tarjeta, Kpi, btn, haceRato } from './ui';

type Pendiente = { id: string; origen: 'seo' | 'geo' | 'autoridad' | 'referee'; titulo: string; detalle: string; quien: 'motor' | 'dueno'; prioridad: number; impacto: string; estado: 'pendiente' | 'hecho' | 'descartado' };
type Pieza = {
  id: string; seccion: string; slug: string; titulo: string; estado: string; url: string; preview: string;
  publicado_at: string | null; actualizado_at: string; palabras: number; pregunta: string | null; giro: string | null; portada: string | null;
  referee: { promedio: number | null; probabilidad_cita: number | null; criterios_ok: number; criterios: number; video_sugerido: string; necesita_del_dueno: string[] } | null;
  especialista: { seo: { score: number; resumen: string }; geo: { score: number; resumen: string }; cuando: string } | null;
  autoridad: { score: number; resumen: string; senales: any; cuando: string } | null;
  pendientes: Pendiente[]; pendientes_abiertos: number;
  angulos: { titulo: string; pregunta: string; tipo: string; seccion: string; slug: string; por_que: string; estado: string }[];
  angulos_generados: string | null;
};
type Totales = { piezas: number; publicadas: number; pendientes_dueno: number; pendientes_motor: number; hechos: number };

const ORIGEN: Record<string, { nombre: string; color: string }> = {
  seo: { nombre: 'SEO', color: P.azulTinta }, geo: { nombre: 'IA y agentes', color: P.violetaTinta }, autoridad: { nombre: 'Autoridad', color: P.verdeTinta }, referee: { nombre: 'Referee', color: P.ambarTinta },
};
const ESTADO: Record<string, string> = { aprobado: 'Aprobada · en bandeja', publicado: 'Publicada', refrescar: 'Por refrescar', borrador: 'Borrador', brief: 'En brief', 'en cola': 'En cola' };

function Score({ n, max = 100 }: { n: number | null | undefined; max?: number }) {
  if (n === null || n === undefined) return <span style={{ color: P.tenue }}>—</span>;
  const pct = n / max;
  const color = pct >= .8 ? P.verdeTinta : pct >= .6 ? P.ambarTinta : P.rojoTinta;
  return <span style={{ fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{n}{max === 100 ? '%' : `/${max}`}</span>;
}

export default function DemandaSeguimiento() {
  const [piezas, setPiezas] = useState<Pieza[] | null>(null);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [verHechos, setVerHechos] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const movil = useIsMobile();

  const cargar = () =>
    fetch('/api/crm/demanda/seguimiento').then(r => r.json()).then(j => { if (j.ok) { setPiezas(j.piezas); setTotales(j.totales); } else setPiezas([]); }).catch(() => setPiezas([]));
  useEffect(() => { cargar(); }, []);

  const marcar = async (p: Pendiente, estado: Pendiente['estado']) => {
    const r = await fetch('/api/crm/demanda/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pendiente_id: p.id, estado }) }).then(x => x.json());
    if (!r.ok) { setAviso(r.error || 'no se pudo'); return; }
    await cargar();
  };
  const pedir = async (id: string, accion: 'especialista' | 'autoridad' | 'angulos' | 'ejecutar_todo') => {
    const r = await fetch('/api/crm/demanda/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, accion }) }).then(x => x.json());
    setAviso(r.ok ? (accion === 'ejecutar_todo' ? 'Encolado: el motor aplica cada pendiente, lo vuelve a juzgar y republica si pasa. Los verás tachados en minutos.' : `Encolado: el motor lo corre en minutos (${accion}).`) : r.error || 'no se pudo');
  };
  const hacerConIA = async (p: Pendiente) => {
    const r = await fetch('/api/crm/demanda/seguimiento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pendiente_id: p.id, accion: 'ejecutar' }) }).then(x => x.json());
    setAviso(r.ok ? `Encolado «${p.titulo}»: el motor lo aplica por parches, lo juzga y republica si pasa.` : r.error || 'no se pudo');
  };

  if (!piezas || !totales) return <Cargando />;

  return (
    <div style={WRAP}>
      <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10 }}>
        <Kpi titulo="Piezas en el loop" valor={totales.piezas} pie={`${totales.publicadas} publicadas`} />
        <Kpi franja={P.ambar} titulo="Te tocan a ti" valor={totales.pendientes_dueno} pie="pendientes que el motor no puede hacer" />
        <Kpi franja={P.violeta} titulo="Le tocan al motor" valor={totales.pendientes_motor} pie="los hace en el ciclo diario" />
        <Kpi franja={P.verde} titulo="Hechos" valor={totales.hechos} pie="tachados" />
      </div>

      {aviso && <p style={{ margin: '12px 0 0', fontSize: '.88rem', color: P.violetaTinta }}>{aviso}</p>}

      <Seccion
        titulo="Cada pieza: qué le falta y qué autoridad tiene"
        aparte={<label style={{ fontSize: '.8rem', color: P.suave, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={verHechos} onChange={e => setVerHechos(e.target.checked)} /> ver lo ya hecho</label>}
      >
        {piezas.length === 0 ? (
          <Tarjeta><p style={{ margin: 0, color: P.suave }}>Todavía no hay piezas aprobadas ni publicadas. Cuando una pase el referee aparece aquí con lo que le falta.</p></Tarjeta>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {piezas.map(p => {
              const abiertaEsta = abierta === p.id;
              const pend = p.pendientes.filter(x => verHechos || x.estado === 'pendiente');
              const porOrigen = ['seo', 'geo', 'autoridad', 'referee'].map(o => ({ o, lista: pend.filter(x => x.origen === o) })).filter(g => g.lista.length);
              const s = p.autoridad?.senales;
              return (
                <Tarjeta key={p.id} franja={p.estado === 'publicado' ? P.verde : P.ambar}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: movil ? 'wrap' : 'nowrap' }}>
                    {p.portada && !movil && <img src={p.portada} alt="" style={{ width: 120, height: 63, objectFit: 'cover', borderRadius: 6, flex: 'none' }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '.98rem', fontWeight: 600, lineHeight: 1.4 }}>{p.titulo}</p>
                      <p style={{ margin: '.3rem 0 0', fontSize: '.83rem', color: P.suave }}>
                        {ESTADO[p.estado] || p.estado} · {p.url} · {p.palabras} palabras{p.giro ? ` · ${p.giro}` : ''}{p.publicado_at ? ` · publicada ${haceRato(p.publicado_at)}` : ''}
                      </p>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: '.82rem', color: P.texto }}>
                        <span>Referee <Score n={p.referee?.promedio ?? null} max={10} /></span>
                        <span>Cita IA <Score n={p.referee?.probabilidad_cita ?? null} /></span>
                        <span>SEO <Score n={p.especialista?.seo?.score ?? null} /></span>
                        <span>Agentes <Score n={p.especialista?.geo?.score ?? null} /></span>
                        <span>Autoridad <Score n={p.autoridad?.score ?? null} /></span>
                        <span style={{ color: p.pendientes_abiertos ? P.ambarTinta : P.verdeTinta, fontWeight: 600 }}>{p.pendientes_abiertos} pendiente{p.pendientes_abiertos === 1 ? '' : 's'}</span>
                      </div>
                      {s && (
                        <p style={{ margin: '.5rem 0 0', fontSize: '.8rem', color: P.suave }}>
                          28 días: {s.clics_28d} clics · {s.impresiones_28d} impresiones · posición {s.posicion_28d ?? '—'} · citada por IAs {s.citas_ia}× · {s.enlaces_hacia} enlaces internos · {s.indexada_gsc === null ? 'indexación sin dato' : s.indexada_gsc ? 'indexada en Google' : 'NO indexada aún'}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flex: 'none', flexWrap: 'wrap' }}>
                      <a href={p.estado === 'publicado' ? p.url : p.preview} target="_blank" rel="noopener noreferrer" style={{ ...btn(), textDecoration: 'none' }}>{p.estado === 'publicado' ? 'Ver' : 'Preview'} ↗</a>
                      <button style={btn(abiertaEsta)} onClick={() => setAbierta(abiertaEsta ? null : p.id)}>{abiertaEsta ? 'Cerrar' : 'Qué le falta'}</button>
                    </div>
                  </div>

                  {abiertaEsta && (
                    <div style={{ marginTop: 14, borderTop: `1px solid ${P.lineaSuave}`, paddingTop: 12, display: 'grid', gap: 14 }}>
                      {p.especialista && (
                        <div style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr 1fr', gap: 10 }}>
                          <div style={{ padding: '10px 12px', borderRadius: 8, background: P.azulAgua }}>
                            <div style={{ fontSize: 11.5, color: P.azulTinta, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700 }}>Especialista SEO · {p.especialista.seo.score}%</div>
                            <p style={{ margin: '.3rem 0 0', fontSize: '.85rem', lineHeight: 1.55 }}>{p.especialista.seo.resumen}</p>
                          </div>
                          <div style={{ padding: '10px 12px', borderRadius: 8, background: P.violetaAgua }}>
                            <div style={{ fontSize: 11.5, color: P.violetaTinta, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700 }}>Especialista IA y agentes · {p.especialista.geo.score}%</div>
                            <p style={{ margin: '.3rem 0 0', fontSize: '.85rem', lineHeight: 1.55 }}>{p.especialista.geo.resumen}</p>
                          </div>
                        </div>
                      )}
                      {p.autoridad && (
                        <div style={{ padding: '10px 12px', borderRadius: 8, background: P.verdeAgua }}>
                          <div style={{ fontSize: 11.5, color: P.verdeTinta, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700 }}>Autoridad · {p.autoridad.score}% · medida {haceRato(p.autoridad.cuando)}</div>
                          <p style={{ margin: '.3rem 0 0', fontSize: '.85rem', lineHeight: 1.55 }}>{p.autoridad.resumen}</p>
                        </div>
                      )}
                      {!p.especialista && <p style={{ margin: 0, fontSize: '.85rem', color: P.suave }}>Los especialistas todavía no la revisan: pasa en el ciclo diario, o pídelo ahora.</p>}

                      {porOrigen.map(g => (
                        <div key={g.o}>
                          <div style={{ fontSize: 11.5, color: ORIGEN[g.o].color, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, marginBottom: 6 }}>{ORIGEN[g.o].nombre}</div>
                          <div style={{ display: 'grid', gap: 6 }}>
                            {g.lista.map(x => (
                              <div key={x.id} style={{ display: 'grid', gridTemplateColumns: movil ? '1fr' : '1fr auto', gap: 8, padding: '8px 10px', borderRadius: 8, background: P.papel, border: `1px solid ${P.lineaSuave}`, opacity: x.estado === 'pendiente' ? 1 : .55 }}>
                                <div>
                                  <div style={{ fontSize: '.86rem', fontWeight: 600, textDecoration: x.estado === 'hecho' ? 'line-through' : 'none' }}>
                                    <span style={{ display: 'inline-block', minWidth: 18, marginRight: 6, fontSize: '.7rem', padding: '1px 5px', borderRadius: 4, background: x.prioridad === 1 ? P.rojoAgua : x.prioridad === 2 ? P.ambarAgua : P.lineaSuave, color: x.prioridad === 1 ? P.rojoTinta : x.prioridad === 2 ? P.ambarTinta : P.suave }}>P{x.prioridad}</span>
                                    <span style={{ fontSize: '.7rem', padding: '1px 6px', borderRadius: 4, background: x.quien === 'dueno' ? P.ambarAgua : P.violetaAgua, color: x.quien === 'dueno' ? P.ambarTinta : P.violetaTinta, marginRight: 6 }}>{x.quien === 'dueno' ? 'te toca' : 'motor'}</span>
                                    {x.titulo}
                                  </div>
                                  <p style={{ margin: '.25rem 0 0', fontSize: '.8rem', color: P.suave, lineHeight: 1.5 }}>{x.detalle}{x.impacto ? <> · <em>{x.impacto}</em></> : null}</p>
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                  {x.estado === 'pendiente' ? (
                                    <>
                                      <button style={{ ...btn(true), padding: '4px 10px', minHeight: 30, fontSize: 12 }} onClick={() => hacerConIA(x)}>Hacerlo con IA</button>
                                      <button style={{ ...btn(), padding: '4px 10px', minHeight: 30, fontSize: 12, color: P.verdeTinta }} onClick={() => marcar(x, 'hecho')}>Hecho</button>
                                      <button style={{ ...btn(), padding: '4px 10px', minHeight: 30, fontSize: 12, color: P.suave }} onClick={() => marcar(x, 'descartado')}>Descartar</button>
                                    </>
                                  ) : (
                                    <button style={{ ...btn(), padding: '4px 10px', minHeight: 30, fontSize: 12 }} onClick={() => marcar(x, 'pendiente')}>Reabrir</button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {p.referee && (p.referee.necesita_del_dueno.length > 0 || p.referee.video_sugerido.startsWith('grabar')) && (
                        <div>
                          <div style={{ fontSize: 11.5, color: P.ambarTinta, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, marginBottom: 6 }}>Lo que el referee te pidió</div>
                          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.82rem', lineHeight: 1.6, color: P.texto }}>
                            {p.referee.necesita_del_dueno.map((x, i) => <li key={i}>{x}</li>)}
                            {p.referee.video_sugerido.startsWith('grabar') && <li>Video: {p.referee.video_sugerido}</li>}
                          </ul>
                        </div>
                      )}

                      <div>
                        <div style={{ fontSize: 11.5, color: P.tenue, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 700, marginBottom: 6 }}>Piezas hermanas (el loop)</div>
                        {p.angulos.length ? (
                          <div style={{ display: 'grid', gap: 4 }}>
                            {p.angulos.map(a => (
                              <div key={a.slug} style={{ fontSize: '.83rem', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                                <span style={{ fontSize: '.7rem', padding: '1px 6px', borderRadius: 4, background: P.lineaSuave, color: P.suave }}>{a.tipo}</span>
                                <span style={{ fontWeight: 600 }}>{a.titulo}</span>
                                <span style={{ color: P.suave }}>/{a.seccion}/{a.slug}/ · {ESTADO[a.estado] || a.estado}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: 0, fontSize: '.83rem', color: P.suave }}>{p.estado === 'publicado' ? 'El motor propone los ángulos derivados en el ciclo diario tras publicar.' : 'Los ángulos derivados se proponen cuando esté publicada.'}</p>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {p.pendientes.some(x => x.estado === 'pendiente' && x.quien === 'motor') && <button style={btn(true)} onClick={() => pedir(p.id, 'ejecutar_todo')}>Hacer todo lo del motor con IA</button>}
                        <button style={btn()} onClick={() => pedir(p.id, 'especialista')}>Revisar con especialistas ahora</button>
                        {p.estado === 'publicado' && <button style={btn()} onClick={() => pedir(p.id, 'autoridad')}>Medir autoridad ahora</button>}
                        {p.estado === 'publicado' && !p.angulos_generados && <button style={btn()} onClick={() => pedir(p.id, 'angulos')}>Proponer ángulos ahora</button>}
                      </div>
                    </div>
                  )}
                </Tarjeta>
              );
            })}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Cómo funciona el loop">
        <Tarjeta>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.88rem', lineHeight: 1.7, color: P.tinta }}>
            <li><strong>Antes de publicar:</strong> además del referee, dos especialistas (SEO para Google/Bing; IA y agentes para ChatGPT, Perplexity, Gemini, Claude y los AI Overviews) dejan aquí lo que aún falta y a quién le toca.</li>
            <li><strong>Ya publicada:</strong> cada semana se mide su autoridad —indexada, clics, posición, citas en IA, enlaces internos— y el especialista propone qué hacer para ganarla (desde qué páginas enlazarla, qué mención conseguir, si cambiar el título).</li>
            <li><strong>El loop:</strong> de cada pieza publicada salen 3-5 ángulos (comparativa, paso a paso, plantilla, error común, caso) que entran como oportunidades al brief y se vuelven piezas hermanas enlazadas entre sí. Así el sitio se vuelve la referencia del tema, no una página suelta.</li>
            <li><strong>«Hacerlo con IA»</strong> aplica ese pendiente por parches sobre la página, la vuelve a pasar por el referee y, si sigue pasando, la republica como versión nueva; si el referee la tumba, se revierte y te lo dice. Lo del motor también se hace solo en el ciclo diario.</li>
            <li><strong>Lo que dice «te toca»</strong> es lo único que el motor no puede hacer: grabar, conseguir una mención, confirmar un dato. Táchalo cuando esté.</li>
          </ul>
        </Tarjeta>
      </Seccion>
    </div>
  );
}
