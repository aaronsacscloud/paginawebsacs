// MOTOR DE DEMANDA · Resumen.
//
// La pantalla que se abre desde el celular. Tiene que contestar en menos de
// treinta segundos: qué está pasando, qué hizo el motor y qué sigue.
//
// La regla que la mantiene útil: **cada número dice de dónde sale, y lo que no
// se puede medir todavía lo dice en lugar de mostrar un cero**. Un tablero de
// ceros que parecen medidos es peor que uno que admite lo que le falta — el
// primero se cree hasta que alguien lo desmiente, y entonces ya no se cree nada.
import { useEffect, useState } from 'react';
import { WRAP } from '../../../../lib/crm/layout';
import { P } from '../../../../lib/crm/paleta';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Cargando from '../ui/Cargando';
import { Kpi, Seccion, Tarjeta, Pastilla, haceRato } from './ui';

export default function DemandaResumen() {
  const isMobile = useIsMobile();
  const [d, setD] = useState<any>(null);
  const [sis, setSis] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/crm/demanda/demanda?vista=resumen').then(r => r.json()),
      fetch('/api/crm/demanda/estado').then(r => r.json()),
    ]).then(([a, b]) => { setD(a); setSis(b); }).catch(() => {}).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div style={WRAP}><Cargando /></div>;
  if (!d?.ok) return <div style={WRAP}><Tarjeta franja={P.rojo}>No se pudo leer el motor. {d?.error}</Tarjeta></div>;

  const c = d.conteos || {};
  const ciclo = d.ultimo_ciclo;
  const salud = sis?.salud;
  const falta = sis?.falta || [];
  const top5 = d.top5?.length ? d.top5 : (ciclo?.top5 || []);
  const irA = (tab: string) => { window.location.search = `?tab=${tab}`; };

  return (
    <div style={{ ...WRAP, ...(isMobile ? { padding: '16px 16px 80px' } : {}) }}>
      {/* EL DEMAND CAPTURE SCORE · lo primero, y solo.
          Es la única cifra de esta pantalla que junta las cuatro cosas que
          importan. Se enseña con sus cuatro partes abiertas porque un número
          agregado sin su descomposición no se puede accionar: saber que vas en
          3 no dice qué mover; saber que la visibilidad en IA aporta 0 de 40, sí. */}
      {sis?.dcs ? (
        <Tarjeta franja={sis.dcs.dcs >= 50 ? P.verde : sis.dcs.dcs >= 20 ? P.ambar : P.rosa} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{ fontSize: 34, fontWeight: 700, color: P.tinta, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {sis.dcs.dcs}
            </span>
            <span style={{ fontSize: 14, color: P.suave }}>de 100 · qué tanto de la demanda estamos capturando</span>
          </div>
          <div style={{ display: 'grid', gap: 9 }}>
            {Object.entries(sis.dcs.partes).map(([k, p]: any) => (
              <div key={k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, marginBottom: 3 }}>
                  <span style={{ color: P.texto, fontWeight: 600 }}>{k.replace(/_/g, ' ')}</span>
                  <span style={{ color: P.suave, fontVariantNumeric: 'tabular-nums' }}>
                    {((p.valor / 100) * (sis.dcs.partes[k].de ?? 0)).toFixed(1)} de {p.de}
                  </span>
                </div>
                <div style={{ background: P.lineaSuave, borderRadius: 999, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(p.valor, 0.5)}%`, height: '100%', background: P.violetaTinta, borderRadius: 999 }} />
                </div>
                <div style={{ fontSize: 11.5, color: P.tenue, marginTop: 3 }}>{p.nota}</div>
              </div>
            ))}
          </div>
        </Tarjeta>
      ) : null}

      <h2 style={{ margin: 0, fontSize: 21, color: P.tinta }}>Motor de demanda</h2>
      <p style={{ margin: '4px 0 0', color: P.suave, fontSize: 13.5, maxWidth: '64ch' }}>
        Qué está buscando el retail de moda, qué estamos capturando y qué hizo el motor.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 12, marginTop: 18 }}>
        <Kpi franja={P.violeta} titulo="Problemas detectados" valor={c.problemas ?? 0}
             pie={`de ${c.senales ?? 0} mensajes reales`} />
        <Kpi franja={P.verde} titulo="Oportunidades" valor={c.oportunidades ?? 0}
             pie={c.sin_evaluar ? `${c.sin_evaluar} problemas sin evaluar` : 'todo evaluado'} />
        <Kpi franja={P.azul} titulo="Páginas propias" valor={c.paginas ?? 0}
             pie={c.huerfanas ? `${c.huerfanas} sin enlaces entrantes` : 'todas enlazadas'} />
        <Kpi franja={salud?.score >= 85 ? P.verde : P.ambar} titulo="Salud del motor"
             valor={salud ? salud.score : '—'}
             pie={ciclo ? `último ciclo ${haceRato(ciclo.inicio)}` : 'aún no corre un ciclo'} />
      </div>

      {/* Lo que TODAVÍA no se puede medir, dicho como tal. */}
      <Seccion titulo="Lo que aún no se mide">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0,1fr))', gap: 10 }}>
          {[
            { q: 'Visibilidad en buscadores', falta: 'Search Console' },
            { q: 'Visibilidad en las IA', falta: 'llaves de Perplexity y xAI (etapa 3)' },
            { q: 'Captura de demanda', falta: 'atribución completa (etapa 5)' },
          ].map(x => (
            <Tarjeta key={x.q} franja={P.linea} style={{ padding: '11px 14px' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: P.tinta }}>{x.q}</div>
              <div style={{ fontSize: 12.5, color: P.suave, marginTop: 2 }}>falta {x.falta}</div>
            </Tarjeta>
          ))}
        </div>
      </Seccion>

      {top5.length ? (
        <Seccion titulo="Las siguientes acciones" aparte={
          <button onClick={() => irA('de-oportunidades')} style={{ border: 'none', background: 'none', color: P.violetaTinta, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>ver todas →</button>
        }>
          <div style={{ display: 'grid', gap: 8 }}>
            {top5.map((t: any, i: number) => (
              <Tarjeta key={t.id || i} franja={P.violeta} style={{ padding: '12px 15px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: P.violeta, minWidth: 22, fontVariantNumeric: 'tabular-nums' }}>{t.orden ?? i + 1}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, color: P.tinta, fontSize: 14.5 }}>{t.titulo}</div>
                    <div style={{ color: P.texto, fontSize: 13, marginTop: 3 }}>{t.accion_recomendada || t.por_que}</div>
                    {t.evidencia?.senales ? (
                      <div style={{ color: P.tenue, fontSize: 12, marginTop: 3 }}>visto {t.evidencia.senales} veces · esfuerzo {t.esfuerzo || '—'}</div>
                    ) : t.falta ? (
                      <div style={{ color: P.ambarTinta, fontSize: 12.5, marginTop: 3 }}>{t.falta}</div>
                    ) : null}
                  </div>
                  {t.score != null ? (
                    <strong style={{ fontSize: 20, color: P.violetaHondo, fontVariantNumeric: 'tabular-nums' }}>{Math.round(t.score)}</strong>
                  ) : null}
                </div>
              </Tarjeta>
            ))}
          </div>
        </Seccion>
      ) : null}

      {(d.categorias || []).length ? (
        <Seccion titulo="Dónde está la demanda" aparte={
          <button onClick={() => irA('de-explorador')} style={{ border: 'none', background: 'none', color: P.violetaTinta, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>explorar →</button>
        }>
          <div className="crm-scroll-x">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: isMobile ? 460 : undefined }}>
              <thead><tr>{['Área', 'Problemas', 'Veces pedido', 'Score medio'].map((h, i) => (
                <th key={h} style={{ textAlign: i ? 'right' : 'left', padding: '8px 10px', borderBottom: `1px solid ${P.linea}`, color: P.tenue, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {(d.categorias || []).slice(0, 12).map((x: any) => (
                  <tr key={x.categoria}>
                    <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, color: P.tinta, fontWeight: 600 }}>{x.categoria}</td>
                    <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: P.texto }}>{x.n}</td>
                    <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: P.texto }}>{x.senales}</td>
                    <td style={{ padding: '9px 10px', borderBottom: `1px solid ${P.lineaSuave}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: P.suave }}>{x.score_medio ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      ) : null}

      {falta.length ? (
        <Seccion titulo="Lo que le falta al motor" aparte={
          <button onClick={() => irA('de-sistema')} style={{ border: 'none', background: 'none', color: P.violetaTinta, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>ajustes →</button>
        }>
          <Tarjeta franja={P.ambar}>
            <div style={{ fontSize: 13.5, color: P.texto }}>
              <strong>{falta.length} fuentes sin conectar.</strong> Las que más pesan hoy:{' '}
              {falta.slice(0, 3).map((f: any) => f.nombre).join(', ')}.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {falta.slice(0, 8).map((f: any) => (
                <Pastilla key={f.id} tono={{ fondo: P.lineaSuave, tinta: P.suave }}>{f.nombre}</Pastilla>
              ))}
            </div>
          </Tarjeta>
        </Seccion>
      ) : null}
    </div>
  );
}
