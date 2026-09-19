// MOTOR DE DEMANDA · Tráfico.
//
// La pantalla que contesta la única pregunta que importa cada mañana: **¿está
// llegando más gente que no nos conocía?**
//
// DOS DECISIONES DE LECTURA, Y LAS DOS CAMBIAN LO QUE SE CONCLUYE
//
// 1. Manda lo SIN MARCA. Quien busca «sacscloud» ya nos conocía: ese clic lo
//    ganó otra cosa —una recomendación, un anuncio, una visita anterior— y
//    contarlo como resultado del contenido es engañarse. El número del motor es
//    el de quien buscó «software para tienda de ropa» y llegó.
//
// 2. Se compara SEMANA contra SEMANA, no día contra día. El tráfico de búsqueda
//    tiene forma de semana: los lunes no se parecen a los domingos. Comparar
//    días sueltos hace ver subidas y caídas que son el calendario y no el
//    trabajo — y tomar decisiones con eso es perseguir ruido.
//
// Y lo que esta pantalla NO promete: el contenido publicado hoy no se ve aquí
// hoy. Un buscador tarda de días a semanas en rastrear e indexar. Por eso abajo
// se enseña cuánto se publicó junto al tráfico: para poder ver el desfase en vez
// de confundirlo con fracaso.
import { useEffect, useState } from 'react';
import { WRAP } from '../../../../lib/crm/layout';
import { P } from '../../../../lib/crm/paleta';
import { useIsMobile } from '../../../../lib/ui/mobile';
import Cargando from '../ui/Cargando';
import { Kpi, Seccion, Tarjeta } from './ui';

type Cambio = { ahora: number; antes: number; delta: number; pct: number | null };
type Datos = {
  serie: Record<string, any>[];
  dias_con_dato: number;
  semana: Record<string, Cambio>;
  hoy: Record<string, number | null> | null;
};

const num = (n: any) => (n == null ? '—' : Number(n).toLocaleString('es-MX'));

/** El signo con su color. Sin datos suficientes no se inventa una flecha. */
function Delta({ c, invertido = false }: { c?: Cambio; invertido?: boolean }) {
  if (!c || c.antes === 0) return <span style={{ color: P.suave, fontSize: '.78rem' }}>sin comparación aún</span>;
  const sube = c.delta > 0;
  const bueno = invertido ? !sube : sube;
  const color = c.delta === 0 ? P.suave : bueno ? P.verdeTinta : P.rojoTinta;
  return (
    <span style={{ color, fontSize: '.82rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
      {c.delta > 0 ? '▲' : c.delta < 0 ? '▼' : '='} {Math.abs(c.delta).toLocaleString('es-MX')}
      {c.pct != null && <span style={{ fontWeight: 500 }}> ({c.pct > 0 ? '+' : ''}{c.pct}%)</span>}
    </span>
  );
}

/** Barras de la serie. Sin librería: son barras, y una librería de gráficas
 *  pesa más que toda esta pantalla. */
function Barras({ serie, campo, color }: { serie: Record<string, any>[]; campo: string; color: string }) {
  const vals = serie.map(d => Number(d[campo]) || 0);
  const max = Math.max(...vals, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64, marginTop: 10 }}>
      {serie.map((d, i) => (
        <div
          key={d.fecha}
          title={`${d.fecha}: ${num(vals[i])}`}
          style={{
            flex: 1, minWidth: 3,
            height: `${Math.max((vals[i] / max) * 100, vals[i] > 0 ? 6 : 2)}%`,
            background: vals[i] > 0 ? color : P.lineaSuave,
            borderRadius: '2px 2px 0 0',
          }}
        />
      ))}
    </div>
  );
}

export default function DemandaTrafico() {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const movil = useIsMobile();

  useEffect(() => {
    fetch('/api/crm/demanda/demanda?vista=serie&dias=60')
      .then(r => r.json())
      .then(j => (j.ok ? setD(j) : setError(j.error || 'no se pudo leer la serie')))
      .catch(e => setError(String(e?.message || e)));
  }, []);

  if (error) return <div style={{ ...WRAP, color: P.rojoTinta }}>No se pudo cargar: {error}</div>;
  if (!d) return <Cargando />;

  const s = d.semana || {};
  const pocos = d.dias_con_dato < 14;

  return (
    <div style={WRAP}>
      <Seccion
        titulo="Cómo va el tráfico"
        aparte={<span style={{ fontSize: '.8rem', color: P.suave }}>7 días contra los 7 anteriores · {d.dias_con_dato} días de historia</span>}
      >
        {pocos && (
          <Tarjeta>
            <p style={{ margin: 0, color: P.ambarTinta, fontSize: '.9rem' }}>
              Solo hay <strong>{d.dias_con_dato} días</strong> de historia. Las comparaciones
              de semana contra semana empiezan a significar algo a partir de catorce, y a
              ser confiables a partir de un mes. Hasta entonces, mira la tendencia y no el
              porcentaje.
            </p>
          </Tarjeta>
        )}

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: movil ? '1fr' : 'repeat(auto-fit, minmax(15rem, 1fr))' }}>
          <Tarjeta>
            <Kpi titulo="Clics de quien NO nos conocía" valor={num(s.clics_sin_marca?.ahora)} />
            <Delta c={s.clics_sin_marca} />
            <p style={{ margin: '.5rem 0 0', fontSize: '.8rem', color: P.suave, lineHeight: 1.5 }}>
              El número del motor. Quien busca «sacscloud» ya nos conocía; ese clic lo ganó
              otra cosa. Este es el de quien buscó su problema y llegó.
            </p>
            {d.serie.length > 1 && <Barras serie={d.serie} campo="clics_sin_marca" color={P.verdeTinta} />}
          </Tarjeta>

          <Tarjeta>
            <Kpi titulo="Veces que aparecimos sin marca" valor={num(s.impresiones_sin_marca?.ahora)} />
            <Delta c={s.impresiones_sin_marca} />
            <p style={{ margin: '.5rem 0 0', fontSize: '.8rem', color: P.suave, lineHeight: 1.5 }}>
              Se mueve antes que los clics: primero Google nos empieza a enseñar, después
              la gente entra. Si esto sube y los clics no, el problema es el título y la
              descripción, no el contenido.
            </p>
            {d.serie.length > 1 && <Barras serie={d.serie} campo="impresiones_sin_marca" color={P.azulTinta} />}
          </Tarjeta>

          <Tarjeta>
            <Kpi titulo="Búsquedas distintas que nos traen gente" valor={num(s.consultas_sin_marca?.ahora)} />
            <Delta c={s.consultas_sin_marca} />
            <p style={{ margin: '.5rem 0 0', fontSize: '.8rem', color: P.suave, lineHeight: 1.5 }}>
              Cuántas preguntas distintas nos encuentran. Crece cuando el contenido cubre
              más terreno, aunque cada una traiga poca gente.
            </p>
            {d.serie.length > 1 && <Barras serie={d.serie} campo="consultas_sin_marca" color={P.violetaTinta} />}
          </Tarjeta>

          <Tarjeta>
            <Kpi titulo="Usos de las herramientas" valor={num(s.herramientas_usos_dia?.ahora)} />
            <Delta c={s.herramientas_usos_dia} />
            <p style={{ margin: '.5rem 0 0', fontSize: '.8rem', color: P.suave, lineHeight: 1.5 }}>
              Quien calcula su curva de tallas con sus números no está leyendo: está
              probando el producto. Es la señal más cercana a una venta de esta pantalla.
            </p>
          </Tarjeta>
        </div>
      </Seccion>

      <Seccion
        titulo="Dónde estamos hoy"
        aparte={<span style={{ fontSize: '.8rem', color: P.suave }}>fotos del día, no sumas de la semana</span>}
      >
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: movil ? '1fr 1fr' : 'repeat(auto-fit, minmax(11rem, 1fr))' }}>
          <Tarjeta><Kpi titulo="Visibilidad en IA (AVS)" valor={d.hoy?.avs != null ? `${d.hoy.avs}/100` : '—'} /></Tarjeta>
          <Tarjeta><Kpi titulo="Demand Capture Score" valor={d.hoy?.dcs != null ? `${d.hoy.dcs}/100` : '—'} /></Tarjeta>
          <Tarjeta><Kpi titulo="Páginas indexables" valor={num(d.hoy?.paginas_indexables)} /></Tarjeta>
          <Tarjeta><Kpi titulo="Publicado por el motor" valor={num(d.hoy?.contenido_publicado)} /></Tarjeta>
          <Tarjeta>
            <Kpi titulo="Del tráfico, sin marca" valor={d.hoy?.pct_sin_marca != null ? `${d.hoy.pct_sin_marca}%` : '—'} />
            <p style={{ margin: '.4rem 0 0', fontSize: '.78rem', color: P.suave, lineHeight: 1.5 }}>
              Qué parte del tráfico llega sin buscarnos por nombre. Subir esto es el
              trabajo: significa que el contenido, y no la marca, está trayendo gente.
            </p>
          </Tarjeta>
        </div>
      </Seccion>

      <Seccion titulo="Cómo leer esta pantalla">
        <Tarjeta>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.88rem', lineHeight: 1.7, color: P.tinta }}>
            <li><strong>Lo que se publica hoy no aparece aquí hoy.</strong> Un buscador tarda de días a semanas en rastrear e indexar. Si publicamos doce páginas esta semana y el tráfico no se mueve, es normal — lo que no es normal es que siga igual dentro de un mes.</li>
            <li><strong>Las impresiones se mueven antes que los clics.</strong> Primero Google nos enseña, después la gente entra. Ver subir las impresiones sin que suban los clics no es un fracaso: es la primera mitad.</li>
            <li><strong>Un mal día no es una señal.</strong> Por eso todo aquí compara semanas enteras. Si un número cae una semana y vuelve la siguiente, era el calendario.</li>
            <li><strong>Search Console tarda dos o tres días</strong> en consolidar sus datos, así que los últimos días de las barras casi siempre se ven más bajos de lo que acabarán siendo.</li>
          </ul>
        </Tarjeta>
      </Seccion>
    </div>
  );
}
