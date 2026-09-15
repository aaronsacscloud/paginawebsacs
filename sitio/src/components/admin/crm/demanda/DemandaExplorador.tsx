// MOTOR DE DEMANDA · Explorador.
//
// La pantalla donde se ve QUÉ está intentando resolver el ramo. Cada renglón es
// un problema canónico —no una consulta suelta— con las veces que apareció y de
// dónde salió.
//
// La columna que no puede faltar es la de la evidencia: si un número no se
// puede rastrear hasta el mensaje que lo originó, el tablero se vuelve un
// oráculo y deja de usarse en cuanto alguien desconfíe de una cifra.
import { useEffect, useMemo, useState } from 'react';
import { WRAP } from '../../../../lib/crm/layout';
import { P } from '../../../../lib/crm/paleta';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Cargando from '../ui/Cargando';
import Sheet from '../ui/Sheet';
import { Kpi, Pastilla, Seccion, Tarjeta, btn, haceRato } from './ui';

const TONO_FUENTE: Record<string, { fondo: string; tinta: string }> = {
  whatsapp: { fondo: P.verdeAgua, tinta: P.verdeTinta },
  soporte:  { fondo: P.ambarAgua, tinta: P.ambarTinta },
  mejoras:  { fondo: P.violetaAgua, tinta: P.violetaHondo },
  churn:    { fondo: P.rojoAgua, tinta: P.rojoTinta },
  perdidas: { fondo: P.rosaAgua, tinta: P.rosaTinta },
  agenda:   { fondo: P.azulAgua, tinta: P.azulTinta },
};

export default function DemandaExplorador() {
  const isMobile = useIsMobile();
  const [res, setRes] = useState<any>(null);
  const [problemas, setProblemas] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState('');
  const [abierto, setAbierto] = useState<any>(null);
  const [senales, setSenales] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch('/api/crm/demanda/demanda?vista=resumen').then(r => r.json()).then(setRes).catch(() => {});
  }, []);

  useEffect(() => {
    setCargando(true);
    const p = new URLSearchParams({ vista: 'problemas', limite: '200' });
    if (q.trim()) p.set('q', q.trim());
    if (categoria) p.set('categoria', categoria);
    const t = setTimeout(() => {
      fetch(`/api/crm/demanda/demanda?${p}`).then(r => r.json())
        .then(r => setProblemas(r.problemas || [])).catch(() => {}).finally(() => setCargando(false));
    }, q ? 300 : 0);   // la búsqueda espera a que dejes de teclear
    return () => clearTimeout(t);
  }, [q, categoria]);

  // Al abrir un problema se traen SUS señales: la evidencia, no un resumen.
  useEffect(() => {
    if (!abierto) return;
    setSenales([]);
    fetch(`/api/crm/demanda/demanda?vista=senales&cluster=${abierto.id}&limite=40`)
      .then(r => r.json()).then(r => setSenales(r.senales || [])).catch(() => {});
  }, [abierto?.id]);

  const cats = useMemo(() => (res?.categorias || []).filter((c: any) => c.categoria !== '(sin clasificar)'), [res]);
  const c = res?.conteos || {};

  return (
    <div style={{ ...WRAP, ...(isMobile ? { padding: '16px 16px 80px' } : {}) }}>
      <h2 style={{ margin: 0, fontSize: 21, color: P.tinta }}>Explorador de demanda</h2>
      <p style={{ margin: '4px 0 0', color: P.suave, fontSize: 13.5, maxWidth: '64ch' }}>
        Lo que los negocios de moda están intentando resolver, agrupado por problema. Cada renglón se abre
        con los mensajes reales que lo originaron.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 12, marginTop: 16 }}>
        <Kpi franja={P.violeta} titulo="Problemas" valor={c.problemas ?? '—'}
             pie={c.sin_evaluar ? `${c.sin_evaluar} sin evaluar` : 'todos evaluados'} />
        <Kpi franja={P.azul} titulo="Señales" valor={c.senales ?? '—'} pie="mensajes reales leídos" />
        <Kpi franja={P.rosa} titulo="Formas de preguntarlo" valor={c.consultas ?? '—'} pie="consultas distintas" />
        <Kpi franja={P.verde} titulo="Oportunidades" valor={c.oportunidades ?? '—'} pie="sin revisar" />
      </div>

      {(res?.fuentes || []).length ? (
        <Seccion titulo="De dónde viene">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(res.fuentes || []).map((f: any) => (
              <Tarjeta key={f.fuente} franja={(TONO_FUENTE[f.fuente] || { tinta: P.violeta }).tinta} style={{ padding: '9px 13px' }}>
                <div style={{ fontSize: 12.5, color: P.suave, textTransform: 'capitalize' }}>{f.fuente}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: P.tinta, fontVariantNumeric: 'tabular-nums' }}>{f.n}</div>
              </Tarjeta>
            ))}
          </div>
        </Seccion>
      ) : null}

      <Seccion titulo="Los problemas" aparte={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input id="de-buscar" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar un problema…"
                 style={{ padding: '8px 11px', borderRadius: 8, border: `1px solid ${P.linea}`, fontSize: 13.5, minWidth: 200 }} />
          <select id="de-categoria" value={categoria} onChange={e => setCategoria(e.target.value)}
                  style={{ padding: '8px 11px', borderRadius: 8, border: `1px solid ${P.linea}`, fontSize: 13.5 }}>
            <option value="">Todas las áreas</option>
            {cats.map((x: any) => <option key={x.categoria} value={x.categoria}>{x.categoria} ({x.n})</option>)}
          </select>
        </div>
      }>
        {cargando ? <Cargando /> : problemas.length === 0 ? (
          <Tarjeta><span style={{ color: P.suave, fontSize: 13.5 }}>Nada todavía con ese filtro.</span></Tarjeta>
        ) : (
          <div className="crm-scroll-x">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: isMobile ? 720 : undefined }}>
              <thead><tr>{['Problema', 'Área', 'Veces', 'Formas', 'Score', ''].map(h => (
                <th key={h} style={{ textAlign: h === 'Problema' || h === 'Área' ? 'left' : 'right', padding: '8px 10px', borderBottom: `1px solid ${P.linea}`, color: P.tenue, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {problemas.map(p2 => (
                  <tr key={p2.id} onClick={() => setAbierto(p2)} style={{ cursor: 'pointer' }}>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${P.lineaSuave}`, color: P.tinta, fontWeight: 600, maxWidth: 420 }}>
                      {p2.problema_canonico}
                      {p2.capturado_por?.por_que ? (
                        <div style={{ fontWeight: 400, color: P.suave, fontSize: 12.5, marginTop: 2 }}>{p2.capturado_por.por_que}</div>
                      ) : null}
                    </td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${P.lineaSuave}`, color: P.suave, fontSize: 12.5, whiteSpace: 'nowrap' }}>{p2.categoria || '—'}</td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${P.lineaSuave}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: P.texto }}>{p2.senales_n}</td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${P.lineaSuave}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: P.suave }}>{p2.queries_n}</td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${P.lineaSuave}`, textAlign: 'right' }}>
                      {p2.score_oportunidad != null
                        ? <strong style={{ color: p2.score_oportunidad >= 65 ? P.verdeTinta : p2.score_oportunidad >= 45 ? P.ambarTinta : P.suave, fontVariantNumeric: 'tabular-nums' }}>{Math.round(p2.score_oportunidad)}</strong>
                        : <span style={{ color: P.gris, fontSize: 12 }}>sin evaluar</span>}
                    </td>
                    <td style={{ padding: '10px', borderBottom: `1px solid ${P.lineaSuave}`, color: P.gris, fontSize: 12 }}>ver →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <Sheet open={!!abierto} onClose={() => setAbierto(null)} title={abierto?.problema_canonico || ''}>
        {abierto ? (
          <div style={{ padding: isMobile ? 16 : 20 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {abierto.categoria ? <Pastilla tono={{ fondo: P.violetaAgua, tinta: P.violetaHondo }}>{abierto.categoria}</Pastilla> : null}
              <Pastilla tono={{ fondo: P.azulAgua, tinta: P.azulTinta }}>{abierto.senales_n} veces</Pastilla>
              <Pastilla tono={{ fondo: P.lineaSuave, tinta: P.suave }}>dato {abierto.naturaleza_dominante}</Pastilla>
              {(abierto.icp || []).map((i: string) => <Pastilla key={i} tono={{ fondo: P.rosaAgua, tinta: P.rosaTinta }}>{i}</Pastilla>)}
            </div>

            {abierto.score_oportunidad != null ? (
              <Tarjeta franja={P.violeta} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12.5, color: P.tenue, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Puntaje</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: P.tinta }}>{Math.round(abierto.score_oportunidad)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,150px), 1fr))', gap: 8, marginTop: 10 }}>
                  {[['Es de lo nuestro', abierto.relevancia_sacs], ['Convierte', abierto.potencial_conversion],
                    ['Da para contenido', abierto.potencial_contenido], ['Da para herramienta', abierto.potencial_herramienta],
                    ['Dificultad', abierto.dificultad]].map(([l, v]: any) => v != null ? (
                    <div key={l} style={{ fontSize: 12.5 }}>
                      <span style={{ color: P.suave }}>{l}: </span>
                      <strong style={{ color: P.tinta, fontVariantNumeric: 'tabular-nums' }}>{Math.round(v)}</strong>
                    </div>
                  ) : null)}
                </div>
              </Tarjeta>
            ) : null}

            <h4 style={{ margin: '0 0 8px', fontSize: 14, color: P.tinta }}>De dónde salió ({senales.length})</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              {senales.length === 0 ? <span style={{ color: P.suave, fontSize: 13 }}>Cargando la evidencia…</span> : null}
              {senales.map(s => (
                <div key={s.id} style={{ border: `1px solid ${P.linea}`, borderRadius: 8, padding: '10px 12px', background: P.papel }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    <Pastilla tono={TONO_FUENTE[s.fuente] || { fondo: P.lineaSuave, tinta: P.suave }}>{s.fuente}</Pastilla>
                    <span style={{ fontSize: 12, color: P.tenue }}>{s.tipo_senal} · {haceRato(s.observada_at)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: P.texto, whiteSpace: 'pre-wrap' }}>{(s.texto || s.query_cruda || '').slice(0, 400)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
