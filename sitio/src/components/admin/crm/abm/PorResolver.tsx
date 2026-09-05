// Lo que necesita que una persona decida.
//
// Con 2,100 cuentas se juntan casos que ningún automatismo debe cerrar solo.
// Si no viven en una pantalla, no se resuelven: se quedan en un comentario que
// nadie vuelve a leer, y mientras tanto o le escribimos a un cliente que ya
// paga, o dejamos fuera a un prospecto bueno por una duda que nadie miró.
import { useEffect, useState } from 'react';
import { P } from '../../../../lib/crm/paleta';
import Cargando from '../ui/Cargando';
import EstadoVacio from '../ui/EstadoVacio';
import { Pastilla, fmt } from './ui';

const CAJA = { background: '#fff', border: `1px solid ${P.linea}`, borderRadius: 10, padding: '15px 17px' };
const H = { fontSize: '.625rem', letterSpacing: '.1em', textTransform: 'uppercase' as const, fontWeight: 800, color: '#999', margin: '0 0 4px' };

export default function PorResolver({ onIr }: { onIr?: (id: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [suc, setSuc] = useState<Record<string, string>>({});

  const traer = () => {
    setCargando(true);
    fetch('/api/crm/abm/pendientes').then(r => r.json()).then(r => { setD(r); setCargando(false); }).catch(() => setCargando(false));
  };
  useEffect(traer, []);

  const pedir = async (body: any) => {
    setTrabajando(body.id);
    try {
      await fetch('/api/crm/abm/pendientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      traer();
    } finally { setTrabajando(null); }
  };

  if (cargando && !d) return <Cargando texto="Buscando lo que necesita decisión…" />;
  const n = (k: string) => (d?.[k] || []).length;
  const total = n('posibles_clientes') + n('por_confirmar') + n('sin_via') + n('whatsapp_muerto') + n('correo_dudoso');
  if (!total) return <EstadoVacio tono="bien" titulo="No hay nada esperando decisión" pista="Cuando el sistema encuentre un caso que no deba resolver solo, aparece aquí." />;

  const btn = (primario = false) => ({
    font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
    border: primario ? 'none' : `1.5px solid ${P.violeta}`, background: primario ? P.violeta : '#fff',
    color: primario ? '#fff' : P.violetaTinta,
  });
  const btnGris = { font: 'inherit', fontSize: '.75rem', fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${P.linea}`, background: '#fff', color: '#666' };

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 900 }}>
      {/* ── Se parece a un cliente nuestro ── */}
      {n('posibles_clientes') > 0 && (
        <div style={{ ...CAJA, borderLeft: `3px solid ${P.rojo}` }}>
          <p style={H}>¿Ya es cliente?</p>
          <p style={{ fontSize: '.8125rem', color: '#666', margin: '0 0 12px' }}>
            El nombre se parece al de un cliente tuyo, pero comparten una sola palabra. No se bloqueó sola:
            bloquear de más pierde un prospecto, no bloquear le manda correo en frío a quien ya te paga.
          </p>
          {(d.posibles_clientes || []).map((c: any) => (
            <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '9px 0', borderTop: `1px solid ${P.linea}` }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <b style={{ fontSize: '.875rem' }}>{c.nombre}</b>
                <div style={{ fontSize: '.75rem', color: '#888' }}>{c.ciudad || 'México'} · {String(c.nota || '').split('⚠').pop()?.trim()}</div>
              </div>
              <button disabled={trabajando === c.id} style={btn()} onClick={() => pedir({ accion: 'resolver_cliente', id: c.id, es_cliente: true })}>Sí, es cliente</button>
              <button disabled={trabajando === c.id} style={btnGris} onClick={() => pedir({ accion: 'resolver_cliente', id: c.id, es_cliente: false })}>No, es otro</button>
            </div>
          ))}
        </div>
      )}

      {/* ── ¿Cadena o dos negocios con el mismo nombre? ── */}
      {n('por_confirmar') > 0 && (
        <div style={{ ...CAJA, borderLeft: `3px solid ${P.ambar}` }}>
          <p style={H}>¿Es una cadena o son homónimos? · {fmt(n('por_confirmar'))}</p>
          <p style={{ fontSize: '.8125rem', color: '#666', margin: '0 0 12px' }}>
            Mismo nombre en estados distintos y sin un sitio que los ligue. Se confirma llamando: si son la misma casa,
            escribe cuántas tiendas tienen y la cuenta pasa a diagnóstico.
          </p>
          {(d.por_confirmar || []).slice(0, 25).map((c: any) => (
            <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '9px 0', borderTop: `1px solid ${P.linea}` }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <b style={{ fontSize: '.875rem' }}>{c.nombre}</b>
                <div style={{ fontSize: '.75rem', color: '#888' }}>{c.ciudad || 'México'} · dice {c.sucursales || '?'} sucursales</div>
              </div>
              <input value={suc[c.id] ?? ''} onChange={e => setSuc({ ...suc, [c.id]: e.target.value })} placeholder="¿cuántas?"
                inputMode="numeric" style={{ font: 'inherit', fontSize: '.8125rem', width: 90, padding: '6px 9px', borderRadius: 8, border: `1px solid ${P.linea}` }} />
              <button disabled={trabajando === c.id} style={btn()} onClick={() => pedir({ accion: 'confirmar_cadena', id: c.id, sucursales: suc[c.id] })}>Confirmar</button>
              <button disabled={trabajando === c.id} style={btnGris} onClick={() => pedir({ accion: 'descartar', id: c.id, motivo: 'son negocios distintos con el mismo nombre' })}>Son distintos</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Sin forma de alcanzarlas ── */}
      {n('sin_via') > 0 && (
        <div style={CAJA}>
          <p style={H}>Investigadas y sin forma de alcanzarlas · {fmt(n('sin_via'))}</p>
          <p style={{ fontSize: '.8125rem', color: '#666', margin: '0 0 12px' }}>
            No tienen correo, ni teléfono, ni WhatsApp. O se les busca contacto, o salen de la lista: una cuenta sin vía
            solo empeora el promedio del tablero.
          </p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {(d.sin_via || []).slice(0, 30).map((c: any) => (
              <button key={c.id} onClick={() => onIr?.(c.id)} title="Abrir la ficha"
                style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 600, padding: '5px 10px', borderRadius: 8, border: `1px solid ${P.linea}`, background: '#fff', color: '#555', cursor: 'pointer' }}>
                {c.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Números que resultaron no tener WhatsApp ── */}
      {n('whatsapp_muerto') > 0 && (
        <div style={CAJA}>
          <p style={H}>Números sin WhatsApp · {fmt(n('whatsapp_muerto'))}</p>
          <p style={{ fontSize: '.8125rem', color: '#666', margin: '0 0 10px' }}>
            Meta ya no deja preguntar si un número tiene WhatsApp: se sabe al mandar el primero. Estos lo intentaron y
            no existen en la red, así que quedaron marcados y nadie va a volver a intentarlo.
          </p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {(d.whatsapp_muerto || []).slice(0, 25).map((c: any) => (
              <Pastilla key={c.id} tono={{ bg: P.rojoAgua, fg: P.rojoTinta }} titulo={c.valor}>
                {c.abm_cuentas?.nombre || c.valor}
              </Pastilla>
            ))}
          </div>
        </div>
      )}

      {/* ── Correos con dominio dudoso ── */}
      {n('correo_dudoso') > 0 && (
        <div style={CAJA}>
          <p style={H}>Correos de dominio dudoso · {fmt(n('correo_dudoso'))}</p>
          <p style={{ fontSize: '.8125rem', color: '#666', margin: '0 0 10px' }}>
            Su dominio existe pero no declara servidor de correo. Puede recibir o no; no arrancan cadencia automática
            porque un rebote duro se paga con la reputación del dominio de envío.
          </p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {(d.correo_dudoso || []).slice(0, 25).map((c: any) => (
              <Pastilla key={c.id} tono={{ bg: P.ambarAgua, fg: P.ambarTinta }} titulo={c.abm_cuentas?.nombre || ''}>{c.valor}</Pastilla>
            ))}
          </div>
        </div>
      )}

      {/* ── Giros sin cadencia escrita ── */}
      {d?.giros_sin_cadencia && Object.keys(d.giros_sin_cadencia).length > 0 && (
        <div style={{ ...CAJA, borderLeft: `3px solid ${P.ambar}` }}>
          <p style={H}>Giros con cuentas y sin cadencia escrita</p>
          <p style={{ fontSize: '.8125rem', color: '#666', margin: '0 0 8px' }}>
            Tienen correo pero nadie ha escrito sus correos: al darle a "escribir la cadencia" van a rebotar.
          </p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {Object.entries(d.giros_sin_cadencia).map(([g, n]: any) => (
              <Pastilla key={g} tono={{ bg: P.ambarAgua, fg: P.ambarTinta }}>{g} · {n}</Pastilla>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
