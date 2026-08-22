// SOPORTE · Lo que la lectura nocturna del chat sacó: peticiones de mejora,
// intenciones de compra, clientes calentándose y elogios citables.
//
// Cada tarjeta enseña la FRASE TEXTUAL del cliente, no un resumen. Es lo único
// que permite decidir en tres segundos si aplica: un resumen generado se lee
// igual de convincente cuando acierta que cuando alucina, y la cita no.
import { useEffect, useState } from 'react';
import { S, Aviso, Cargando, PedirTexto } from '../email/ui';

const VERDE_TINTA = '#1E8A63';
const MORADO = '#9B8CFA';
const TINTA = '#5B4BD6';
const ROJO = '#C0554E';

const TIPO: Record<string, { label: string; franja: string; bg: string; fg: string; destino: string }> = {
  oportunidad: { label: 'Oportunidad', franja: '#4FBF95', bg: '#EAF8F2', fg: VERDE_TINTA, destino: 'Bandeja de Oportunidades' },
  mejora: { label: 'Mejora', franja: MORADO, bg: '#EEECFE', fg: TINTA, destino: 'Consultoría' },
  riesgo: { label: 'Riesgo', franja: ROJO, bg: '#FBECEA', fg: ROJO, destino: 'Bandeja de Oportunidades' },
  testimonio: { label: 'Testimonio', franja: '#7DA6F5', bg: '#E3EDFD', fg: '#2C5FC4', destino: 'Bandeja de Oportunidades' },
  duda: { label: 'Duda', franja: '#B6ABFC', bg: '#F2EFFE', fg: TINTA, destino: 'Consultoría · capacitación' },
};

const fecha = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '';

export default function Hallazgos({ onAbrirCliente, onCambio, sinTope }: { onAbrirCliente: (id: string) => void; onCambio?: () => void; sinTope?: boolean }) {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState('');
  const [vista, setVista] = useState<'pendiente' | 'aceptado' | 'descartado'>('pendiente');
  const [trabajando, setTrabajando] = useState('');
  const [aviso, setAviso] = useState<{ tono: string; msg: string } | null>(null);
  const [descartando, setDescartando] = useState<any>(null);
  // Con el histórico cargado son 28 tarjetas y la sección se come la pantalla:
  // quien entra a Soporte a ver el tablero no viene a revisar la bandeja.
  const [todas, setTodas] = useState(!!sinTope);
  // Con 85 hallazgos, "por revisar" sin filtro es una lista imposible de
  // trabajar: se revisa por tipo, que es como se decide qué hacer con cada uno.
  const [tipo, setTipo] = useState<string>('todos');

  const cargar = (v = vista) => {
    setD(null); setErr('');
    fetch(`/api/crm/soporte/hallazgos?estado=${v}`)
      .then(r => r.json())
      .then(j => { j.error ? setErr(j.error) : setD(j); })
      .catch(() => setErr('Sin conexión'));
  };
  useEffect(() => { setTodas(!!sinTope); cargar(vista); /* eslint-disable-next-line */ }, [vista]);

  async function mover(h: any, estado: 'aceptado' | 'descartado', motivo?: string) {
    if (trabajando) return;
    setTrabajando(h.id); setAviso(null);
    try {
      const r = await fetch('/api/crm/soporte/hallazgos', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: h.id, estado, motivo_descarte: motivo }),
      });
      const j = await r.json();
      if (!r.ok || j.error) { setAviso({ tono: 'malo', msg: j.error || 'No se pudo guardar' }); }
      else {
        setAviso({ tono: 'ok', msg: estado === 'aceptado' ? `Listo: se creó en ${TIPO[h.tipo]?.destino || 'el CRM'}.` : 'Descartado. No vuelve a aparecer.' });
        cargar(vista);
        onCambio?.();
      }
    } catch { setAviso({ tono: 'malo', msg: 'Sin conexión — reintenta.' }); }
    finally { setTrabajando(''); }
  }

  if (err) return <Aviso tono="malo">{err}</Aviso>;
  if (!d) return <Cargando que="lo que salió del chat" />;

  const R = d.resumen || {};
  const filas = d.data || [];
  // En su vista propia no hay tope: para eso es la vista.
  const TOPE = sinTope ? Infinity : 8;
  const porTipo = tipo === 'todos' ? filas : filas.filter((h: any) => h.tipo === tipo);
  const vistas = (todas || sinTope) ? porTipo : porTipo.slice(0, TOPE);
  const chip = (on: boolean) => ({
    border: '1px solid', borderColor: on ? '#cdbdf7' : '#e2e4e9', background: on ? '#EEECFE' : '#fff',
    color: on ? '#6d4bc7' : '#666', borderRadius: 8, padding: '5px 12px', fontSize: '0.74rem',
    fontWeight: on ? 800 : 500, cursor: 'pointer', fontFamily: 'inherit',
  });

  return (
    <div className="sop-card" style={{ background: '#fff', border: '1px solid #eeecf3', borderRadius: 12, padding: '18px 20px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '0.83rem', margin: 0, fontWeight: 800, flex: 1 }}>Lo que salió del chat</h3>
        {R.tasa_aceptacion != null && (
          <span style={{ fontSize: '0.7rem', color: '#b3b1bb', fontWeight: 700 }}>{R.tasa_aceptacion}% de lo detectado se acepta</span>
        )}
      </div>
      <div style={{ fontSize: '0.71rem', color: '#a5a2af', marginTop: 3, marginBottom: 14, lineHeight: 1.55 }}>
        La lectura de las 3 am revisa lo que escribieron los clientes en Intercom y saca lo que vale dinero. Cada tarjeta trae la frase textual: nada se crea hasta que tú lo aceptas.
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <button onClick={() => setVista('pendiente')} style={chip(vista === 'pendiente')}>Por revisar {R.pendientes ? `(${R.pendientes})` : ''}</button>
        <button onClick={() => setVista('aceptado')} style={chip(vista === 'aceptado')}>Aceptados {R.aceptados ? `(${R.aceptados})` : ''}</button>
        <button onClick={() => setVista('descartado')} style={chip(vista === 'descartado')}>Descartados {R.descartados ? `(${R.descartados})` : ''}</button>
      </div>

      {sinTope && filas.length > 12 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <button onClick={() => setTipo('todos')} style={chip(tipo === 'todos')}>Todos ({filas.length})</button>
          {['oportunidad', 'mejora', 'duda', 'riesgo', 'testimonio'].map(k => {
            const n = filas.filter((h: any) => h.tipo === k).length;
            if (!n) return null;
            return <button key={k} onClick={() => setTipo(k)} style={chip(tipo === k)}>{TIPO[k]?.label || k} ({n})</button>;
          })}
        </div>
      )}

      {aviso && <Aviso tono={aviso.tono as any}>{aviso.msg}</Aviso>}

      {!filas.length && (
        <div style={{ fontSize: '0.78rem', color: '#a5a2af', lineHeight: 1.65 }}>
          {vista === 'pendiente'
            ? <>Nada por revisar. La corrida de las 3:15 am lee las conversaciones que se movieron y deja aquí lo que encuentre — lo normal es que la mayoría de los días no encuentre nada, porque casi todo el soporte es operación.</>
            : <>Todavía no hay nada {vista === 'aceptado' ? 'aceptado' : 'descartado'}.</>}
        </div>
      )}

      {vistas.map((h: any) => {
        const t = TIPO[h.tipo] || TIPO.mejora;
        const ligado = !!h.company_id;
        return (
          <div key={h.id} style={{ border: '1px solid #eeecf3', borderLeft: `3px solid ${t.franja}`, borderRadius: 11, padding: '13px 15px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
              <span onClick={() => ligado && onAbrirCliente(h.company_id)}
                style={{ fontWeight: 800, fontSize: '0.82rem', cursor: ligado ? 'pointer' : 'default', color: ligado ? '#1a1a1a' : '#8a8a8a' }}>
                {h.nombre || h.cuenta || 'Sin identificar'}
              </span>
              <span style={{ fontSize: '0.58rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px', textTransform: 'uppercase', letterSpacing: '.05em', background: t.bg, color: t.fg }}>{t.label}</span>
              {h.confianza === 'alta' && <span style={{ fontSize: '0.58rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px', textTransform: 'uppercase', letterSpacing: '.05em', background: '#EEECFE', color: TINTA }}>alta</span>}
              {h.modulo && <span style={{ fontSize: '0.66rem', color: '#a5a2af', fontWeight: 700 }}>{h.modulo}</span>}
              <span style={{ marginLeft: 'auto', fontSize: '0.66rem', color: '#b3b1bb', fontWeight: 700 }}>{fecha(h.detectado_at)}</span>
            </div>

            <div style={{ borderLeft: '2px solid #e4dffb', padding: '2px 0 2px 11px', margin: '8px 0', fontSize: '0.79rem', color: '#3f3b4d', lineHeight: 1.6, fontStyle: 'italic' }}>
              "{h.cita}"
            </div>

            {h.accion && <div style={{ fontSize: '0.73rem', color: '#7d7a88', lineHeight: 1.55 }}>{h.accion}</div>}

            {h.estado === 'pendiente' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 11 }}>
                <button onClick={() => mover(h, 'aceptado')} disabled={!!trabajando}
                  style={{ ...S.btnA, opacity: trabajando ? 0.6 : 1 }}>
                  {trabajando === h.id ? 'Guardando…' : `Aceptar → ${t.destino}`}
                </button>
                <button onClick={() => setDescartando(h)} disabled={!!trabajando} style={{ ...S.btnG, opacity: trabajando ? 0.6 : 1 }}>No aplica</button>
                {!ligado && <span style={{ fontSize: '0.68rem', color: ROJO, fontWeight: 700 }}>Sin cliente ligado: no se puede aceptar todavía</span>}
              </div>
            ) : (
              <div style={{ fontSize: '0.68rem', color: '#b3b1bb', fontWeight: 700, marginTop: 9 }}>
                {h.estado === 'aceptado' ? `Aceptado → ${h.destino === 'mejora' ? 'Consultoría' : 'Bandeja de Oportunidades'}` : `Descartado: ${h.motivo_descarte || 'sin motivo'}`}
                {h.resuelto_por ? ` · ${h.resuelto_por}` : ''}
              </div>
            )}
          </div>
        );
      })}

      {!sinTope && porTipo.length > TOPE && (
        <button onClick={() => setTodas(!todas)} style={{ ...S.btnG, marginTop: 2 }}>
          {todas ? `Ver solo ${TOPE}` : `Ver las ${porTipo.length}`}
        </button>
      )}

      {descartando && (
        <PedirTexto titulo="¿Por qué no aplica?"
          sub="Es lo único que permite afinar la lectura: sin motivo, en tres meses nadie sabrá qué estaba marcando de más."
          etiqueta="Motivo" marcador="Es un bug, no una petición…" boton="Descartar"
          onOk={(v) => { const h = descartando; setDescartando(null); mover(h, 'descartado', v); }}
          onCancelar={() => setDescartando(null)} />
      )}
    </div>
  );
}
