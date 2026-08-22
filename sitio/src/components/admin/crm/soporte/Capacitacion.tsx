// SOPORTE · Capacitación: de qué NO se está entendiendo el sistema.
//
// Sale de los hallazgos tipo `duda` — lo que el cliente preguntó de algo que el
// sistema SÍ hace. La frontera con "mejora" es la que importa: mejora es que el
// producto no puede, duda es que sí puede y el cliente no supo.
//
// Se ordena por CLIENTES DISTINTOS, no por número de dudas. Un cliente que
// pregunta cinco veces lo mismo es un problema de atención de ese cliente;
// cinco clientes preguntando una vez es un hueco de capacitación. Ordenar por
// volumen manda a armar el workshop equivocado.
import { useEffect, useState } from 'react';
import { S, Aviso, Cargando, fmtFecha } from '../email/ui';

const VERDE_TINTA = '#1E8A63';
const MORADO = '#9B8CFA';
const TINTA = '#5B4BD6';

export default function Capacitacion({ onAbrirCliente }: { onAbrirCliente: (id: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/crm/soporte/capacitacion')
      .then(r => r.json())
      .then(j => { if (vivo) { j.error ? setErr(j.error) : setD(j); } })
      .catch(() => { if (vivo) setErr('Sin conexión'); });
    return () => { vivo = false; };
  }, []);

  if (err) return <Aviso tono="malo">{err}</Aviso>;
  if (!d) return <Cargando que="las dudas repetidas" />;

  const R = d.resumen || {};
  const grupos = d.grupos || [];
  const maxCli = Math.max(1, ...grupos.map((g: any) => g.clientes));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="sop-kpis">
        <div style={{ background: '#fff', border: '1px solid #eeecf3', borderLeft: `3px solid ${MORADO}`, borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.08em' }}>Dudas detectadas</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: 8, letterSpacing: '-.025em' }}>{R.dudas || 0}</div>
          <div style={{ fontSize: '0.7rem', marginTop: 5, color: '#9c99a6' }}>de {R.clientes || 0} cliente{R.clientes === 1 ? '' : 's'} distintos</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #eeecf3', borderLeft: `3px solid ${R.para_workshop ? '#4FBF95' : '#B6ABFC'}`, borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.08em' }}>Ameritan workshop</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: 8, letterSpacing: '-.025em', color: R.para_workshop ? VERDE_TINTA : undefined }}>{R.para_workshop || 0}</div>
          <div style={{ fontSize: '0.7rem', marginTop: 5, color: '#9c99a6' }}>módulos con 3 o más clientes preguntando</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #eeecf3', borderLeft: '3px solid #B6ABFC', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#9c99a6', textTransform: 'uppercase', letterSpacing: '.08em' }}>Módulos tocados</div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: 8, letterSpacing: '-.025em' }}>{R.modulos || 0}</div>
          <div style={{ fontSize: '0.7rem', marginTop: 5, color: '#9c99a6' }}>{R.sin_clasificar ? `${R.sin_clasificar} dudas sin módulo` : 'todas con módulo'}</div>
        </div>
      </div>

      {!grupos.length && (
        <div className="sop-card" style={{ background: '#fff', border: '1px solid #eeecf3', borderRadius: 12, padding: '18px 20px' }}>
          <h3 style={{ fontSize: '0.83rem', margin: 0, fontWeight: 800 }}>Todavía no hay dudas clasificadas</h3>
          <div style={{ fontSize: '0.78rem', color: '#a5a2af', marginTop: 6, lineHeight: 1.65 }}>
            La lectura nocturna del chat separa lo que el cliente <b>pidió</b> (mejora) de lo que <b>no supo hacer</b> (duda).
            Esta vista se llena con lo segundo. Si está vacía es porque todavía no ha corrido con el tipo nuevo.
          </div>
        </div>
      )}

      {grupos.map((g: any) => {
        const ab = abierto === g.modulo;
        return (
          <div key={g.modulo} className="sop-card" style={{ background: '#fff', border: '1px solid #eeecf3', borderRadius: 12, padding: '16px 18px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '0.86rem', margin: 0, fontWeight: 800, color: g.sin_clasificar ? '#8a8a8a' : '#1a1a1a' }}>{g.modulo}</h3>
              {g.amerita_workshop && (
                <span style={{ fontSize: '0.58rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px', textTransform: 'uppercase', letterSpacing: '.05em', background: '#EAF8F2', color: VERDE_TINTA }}>amerita workshop</span>
              )}
              <div style={{ flex: 1, minWidth: 90, maxWidth: 200, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 6, background: '#f3f2f7', borderRadius: 3 }}>
                  <div style={{ width: `${(g.clientes / maxCli) * 100}%`, height: '100%', background: g.amerita_workshop ? '#4FBF95' : MORADO, borderRadius: 3 }} />
                </div>
              </div>
              <span style={{ fontSize: '0.76rem', fontWeight: 800 }}>{g.clientes} cliente{g.clientes === 1 ? '' : 's'}</span>
              <span style={{ fontSize: '0.72rem', color: '#a5a2af' }}>{g.n} duda{g.n === 1 ? '' : 's'}</span>
              <button onClick={() => setAbierto(ab ? null : g.modulo)} style={{ ...S.btnG, marginLeft: 'auto' }}>
                {ab ? 'Ocultar' : 'Ver qué preguntaron'}
              </button>
            </div>

            <div style={{ fontSize: '0.72rem', color: '#a5a2af', marginTop: 7 }}>
              {g.nombres.join(' · ')}
            </div>

            {ab && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f4f3f7' }}>
                {g.dudas.map((x: any) => (
                  <div key={x.id} style={{ padding: '10px 0', borderTop: '1px solid #f7f6fa' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span onClick={() => x.company_id && onAbrirCliente(x.company_id)}
                        style={{ fontWeight: 700, fontSize: '0.78rem', cursor: x.company_id ? 'pointer' : 'default', color: x.company_id ? TINTA : '#8a8a8a' }}>{x.nombre}</span>
                      <span style={{ fontSize: '0.78rem', flex: 1, minWidth: 200 }}>{x.titulo}</span>
                      <span style={{ fontSize: '0.66rem', color: '#b3b1bb', fontWeight: 700 }}>{fmtFecha(x.detectado_at)}</span>
                    </div>
                    <div style={{ borderLeft: '2px solid #e4dffb', padding: '2px 0 2px 11px', marginTop: 6, fontSize: '0.76rem', color: '#3f3b4d', lineHeight: 1.6, fontStyle: 'italic' }}>
                      "{x.cita}"
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {grupos.length > 0 && (
        <div style={{ fontSize: '0.73rem', color: '#a5a2af', lineHeight: 1.65, padding: '0 2px' }}>
          El orden va por <b>clientes distintos</b>, no por número de dudas: un cliente que pregunta cinco veces lo mismo
          es un tema de atención de ese cliente; cinco clientes preguntando una vez es un hueco de capacitación.
          A partir de tres clientes se marca como candidato a workshop.
        </div>
      )}
    </div>
  );
}
