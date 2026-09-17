// MOTOR DE DEMANDA · Visibilidad en las IAs.
//
// Responde la pregunta del objetivo: cuando alguien del ramo le pregunta a una
// IA qué software usar, ¿aparece Sacs?
//
// La pantalla tiene tres partes y el orden no es casual. Primero el número
// —donde estamos—. Después quién ocupa nuestro lugar, porque saber que no
// apareces sin saber quién sí apareció no sirve para decidir nada. Y al final
// en quién CONFÍA la IA para decirlo: esa tercera lista es la más accionable de
// las tres, porque dice dónde hay que estar.
import { useEffect, useState } from 'react';
import { WRAP } from '../../../../lib/crm/layout';
import { P } from '../../../../lib/crm/paleta';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Cargando from '../ui/Cargando';
import { Kpi, Pastilla, Seccion, Tarjeta, btn } from './ui';

const PLATAFORMA: Record<string, string> = {
  chatgpt: 'ChatGPT', gemini: 'Gemini', claude: 'Claude', perplexity: 'Perplexity', grok: 'Grok',
};

export default function DemandaIA() {
  const isMobile = useIsMobile();
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<'preguntas' | 'quien' | 'donde'>('preguntas');

  useEffect(() => {
    fetch('/api/crm/demanda/demanda?vista=ia&dias=60')
      .then(r => r.json()).then(setD).catch(() => {}).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div style={WRAP}><Cargando /></div>;
  if (!d?.ok) return <div style={WRAP}><Tarjeta franja={P.rojo}>No se pudo leer. {d?.error}</Tarjeta></div>;

  const r = d.resumen || {};
  const nuestras = (d.fuentes || []).filter((f: any) => /sacscloud/i.test(f.dominio));

  return (
    <div style={{ ...WRAP, ...(isMobile ? { padding: '16px 16px 80px' } : {}) }}>
      <h2 style={{ margin: 0, fontSize: 21, color: P.tinta }}>Visibilidad en las IAs</h2>
      <p style={{ margin: '4px 0 0', color: P.suave, fontSize: 13.5, maxWidth: '64ch' }}>
        Le preguntamos a ChatGPT, Gemini, Claude y Perplexity lo mismo que les pregunta un comprador
        de moda — con búsqueda web encendida, que es lo que recibe una persona real.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 12, marginTop: 16 }}>
        <Kpi franja={r.avs >= 30 ? P.verde : r.avs > 0 ? P.ambar : P.rojo}
             titulo="Visibilidad" valor={`${r.avs ?? 0}`} pie="de 100" />
        <Kpi franja={r.menciones ? P.verde : P.rojo} titulo="Veces que aparecemos"
             valor={r.menciones ?? 0} pie={`de ${r.medidas ?? 0} mediciones`} />
        <Kpi franja={P.azul} titulo="Preguntas medidas" valor={r.prompts ?? 0} pie="en 4 plataformas" />
        <Kpi franja={nuestras.length ? P.verde : P.linea} titulo="Citas a nuestro sitio"
             valor={r.citas ?? 0} pie={nuestras.length ? `${nuestras[0].veces} veces` : 'ninguna todavía'} />
      </div>

      {r.medidas > 0 && !r.menciones ? (
        <div style={{ marginTop: 14, background: P.rojoAgua, color: P.rojoTinta, borderRadius: 9, padding: '13px 16px', fontSize: 14 }}>
          <strong>Sacs no aparece en ninguna de las {r.medidas} mediciones.</strong> No es un número bajo:
          es un punto de partida. La serie empieza hoy y contra esto se mide todo lo que venga.
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 6, marginTop: 20, flexWrap: 'wrap' }}>
        {([['preguntas', `Las preguntas (${(d.prompts || []).length})`],
           ['quien', `Quién sale en nuestro lugar (${(d.competidores || []).length})`],
           ['donde', `En quién confía la IA (${(d.fuentes || []).length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setVista(k as any)} style={{ ...btn(vista === k), borderRadius: 999, padding: '7px 15px' }}>{l}</button>
        ))}
      </div>

      {vista === 'preguntas' ? (
        <Seccion titulo="Lo que le preguntan a la IA" aparte={<span style={{ fontSize: 12.5, color: P.suave }}>preguntas enteras, no palabras clave</span>}>
          <div style={{ display: 'grid', gap: 8 }}>
            {(d.prompts || []).map((p: any, i: number) => (
              <Tarjeta key={i} franja={p.menciones ? P.verde : p.medidas ? P.rojo : P.linea} style={{ padding: '12px 15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, color: P.tinta, fontSize: 14 }}>{p.prompt}</div>
                    {p.competidores?.length ? (
                      <div style={{ fontSize: 12.5, color: P.suave, marginTop: 4 }}>
                        contesta con: {p.competidores.slice(0, 5).join(', ')}
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {(p.plataformas || []).map((x: string) => (
                        <Pastilla key={x} tono={{ fondo: P.lineaSuave, tinta: P.suave }}>{PLATAFORMA[x] || x}</Pastilla>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {p.medidas ? (
                      <>
                        <div style={{ fontSize: 18, fontWeight: 700, color: p.menciones ? P.verdeTinta : P.rojoTinta }}>
                          {p.menciones}/{p.medidas}
                        </div>
                        <div style={{ fontSize: 11, color: P.tenue }}>apariciones</div>
                      </>
                    ) : <span style={{ fontSize: 12, color: P.gris }}>sin medir</span>}
                  </div>
                </div>
              </Tarjeta>
            ))}
          </div>
        </Seccion>
      ) : null}

      {vista === 'quien' ? (
        <Seccion titulo="Quién ocupa el lugar que queremos" aparte={<span style={{ fontSize: 12.5, color: P.suave }}>contado sobre las respuestas reales</span>}>
          <div className="crm-scroll-x">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: isMobile ? 420 : undefined }}>
              <thead><tr>{['Producto', 'Veces', 'Plataformas'].map((h, i) => (
                <th key={h} style={{ textAlign: i ? 'right' : 'left', padding: '8px 10px', borderBottom: `1px solid ${P.linea}`, color: P.tenue, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {(d.competidores || []).map((c: any) => (
                  <tr key={c.competidor}>
                    <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, color: P.tinta, fontWeight: 600, textTransform: 'capitalize' }}>{c.competidor}</td>
                    <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.veces}</td>
                    <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, textAlign: 'right', color: P.suave }}>{c.plataformas} de 4</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      ) : null}

      {vista === 'donde' ? (
        <Seccion titulo="En quién confía la IA para contestar"
                 aparte={<span style={{ fontSize: 12.5, color: P.suave }}>aquí es donde hay que estar</span>}>
          <Tarjeta franja={P.violeta} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13.5, color: P.texto }}>
              Estos son los sitios que las IAs citaron al recomendar. Cada uno es una decisión: o
              conseguir estar ahí, o escribir algo tan bueno que citen lo nuestro en su lugar.
            </div>
          </Tarjeta>
          <div style={{ display: 'grid', gap: 6 }}>
            {(d.fuentes || []).map((f: any) => {
              const propio = /sacscloud/i.test(f.dominio);
              return (
                <div key={f.dominio} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center',
                  padding: '9px 14px', borderRadius: 8, background: propio ? P.verdeAgua : P.papel,
                  border: `1px solid ${propio ? P.verde : P.linea}`,
                }}>
                  <span style={{ color: propio ? P.verdeTinta : P.tinta, fontWeight: propio ? 700 : 500, fontSize: 13.5 }}>
                    {f.dominio}{propio ? ' · nuestro' : ''}
                  </span>
                  <span style={{ color: P.suave, fontSize: 12.5, whiteSpace: 'nowrap' }}>
                    {f.veces} {f.veces === 1 ? 'cita' : 'citas'} · {f.plataformas} de 4
                  </span>
                </div>
              );
            })}
          </div>
        </Seccion>
      ) : null}
    </div>
  );
}
