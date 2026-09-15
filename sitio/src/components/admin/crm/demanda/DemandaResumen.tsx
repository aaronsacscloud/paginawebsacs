// MOTOR DE DEMANDA · Resumen.
//
// La pantalla que se abre desde el celular para saber, en menos de treinta
// segundos, qué está pasando. En la etapa 0 el motor todavía no tiene demanda
// que resumir, y eso es exactamente lo que dice: qué le falta y qué sigue.
//
// Decir «aún no hay datos» con la razón al lado es más útil que un tablero de
// ceros que parece medido.
import { useEffect, useState } from 'react';
import { WRAP } from '../../../../lib/crm/layout';
import { P } from '../../../../lib/crm/paleta';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Cargando from '../ui/Cargando';
import { Kpi, Seccion, Tarjeta, haceRato } from './ui';

export default function DemandaResumen() {
  const isMobile = useIsMobile();
  const [e, setE] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch('/api/crm/demanda/estado').then(r => r.json()).then(setE).catch(() => {}).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div style={WRAP}><Cargando /></div>;
  if (!e?.ok) return <div style={WRAP}><Tarjeta franja={P.rojo}>No se pudo leer el motor. {e?.error}</Tarjeta></div>;

  const ultimo = (e.ciclos || [])[0];
  const top5 = ultimo?.top5 || [];
  const salud = e.salud;
  const arrancado = (e.ciclos || []).length > 0;

  return (
    <div style={{ ...WRAP, ...(isMobile ? { padding: '16px 16px 80px' } : {}) }}>
      <h2 style={{ margin: 0, fontSize: 21, color: P.tinta }}>Motor de demanda</h2>
      <p style={{ margin: '4px 0 0', color: P.suave, fontSize: 13.5, maxWidth: '62ch' }}>
        Qué está buscando el retail de moda, qué estamos capturando de eso y qué hizo el motor hoy.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0,1fr))', gap: 12, marginTop: 18 }}>
        <Kpi franja={P.violeta} titulo="Captura de demanda" valor="—" pie="llega con las fuentes conectadas" />
        <Kpi franja={P.azul} titulo="Visibilidad en buscadores" valor="—" pie="necesita Search Console" />
        <Kpi franja={P.rosa} titulo="Visibilidad en IA" valor="—" pie="llega en la etapa 3" />
        <Kpi franja={salud?.score >= 85 ? P.verde : P.ambar} titulo="Salud del motor"
             valor={salud ? `${salud.score}` : '—'} pie={ultimo ? `último ciclo ${haceRato(ultimo.inicio)}` : 'aún no corre'} />
      </div>

      <Seccion titulo="Qué hizo el motor">
        {arrancado ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {(e.ciclos || []).slice(0, 5).map((c: any) => (
              <Tarjeta key={c.id} franja={c.estado === 'ok' ? P.verde : c.estado === 'corriendo' ? P.azul : P.ambar} style={{ padding: '11px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: P.tinta, fontSize: 14 }}>Ciclo {c.tipo}</span>
                  <span style={{ color: P.suave, fontSize: 13 }}>
                    {c.acciones_ok} hechas{c.acciones_fallidas ? ` · ${c.acciones_fallidas} fallidas` : ''} · ${Number(c.costo_usd || 0).toFixed(4)} · {haceRato(c.inicio)}
                  </span>
                </div>
              </Tarjeta>
            ))}
          </div>
        ) : (
          <Tarjeta franja={P.ambar}>
            <div style={{ fontSize: 13.5, color: P.texto }}>
              Todavía no ha corrido ningún ciclo. El motor está construido pero sin fuentes conectadas:
              lo que sigue es darle Search Console y la analítica para que empiece a ver demanda de verdad.
            </div>
          </Tarjeta>
        )}
      </Seccion>

      <Seccion titulo="Las siguientes acciones" aparte={<span style={{ fontSize: 12.5, color: P.suave }}>ordenadas por lo que más mueve la aguja</span>}>
        {top5.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {top5.map((t: any, i: number) => (
              <Tarjeta key={i} franja={P.violeta} style={{ padding: '12px 15px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: P.violeta, minWidth: 22, fontVariantNumeric: 'tabular-nums' }}>{t.orden ?? i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: P.tinta, fontSize: 14.5 }}>{t.titulo}</div>
                    {t.por_que ? <div style={{ color: P.texto, fontSize: 13, marginTop: 3 }}>{t.por_que}</div> : null}
                    {t.falta ? <div style={{ color: P.ambarTinta, fontSize: 12.5, marginTop: 3 }}>{t.falta}</div> : null}
                  </div>
                </div>
              </Tarjeta>
            ))}
          </div>
        ) : (
          <Tarjeta><span style={{ color: P.suave, fontSize: 13.5 }}>Se llenan al cerrar el primer ciclo.</span></Tarjeta>
        )}
      </Seccion>

      {(e.falta || []).length ? (
        <Seccion titulo="Lo que le falta al motor">
          <Tarjeta franja={P.ambar}>
            <div style={{ fontSize: 13.5, color: P.texto }}>
              {(e.falta || []).length} fuente(s) sin conectar. Están detalladas en <strong>Sistema → Lo que me falta</strong>,
              cada una con lo que se pierde por no tenerla.
            </div>
          </Tarjeta>
        </Seccion>
      ) : null}
    </div>
  );
}
