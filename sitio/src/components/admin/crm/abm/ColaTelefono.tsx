// La cola de teléfono. Una tarjeta a la vez, con lo que sabemos del negocio,
// el guion de UNA pregunta y tres botones.
//
// Aquí no se vende: se pregunta con quién hablar y cuál es su correo. De las
// 433 cuentas sin correo, 343 tienen teléfono — y el correo es el único canal
// que se automatiza, así que esta llamada es la que desatasca todo lo demás.
import { useEffect, useState } from 'react';
import { P, tarjetaKpi } from '../../../../lib/crm/paleta';
import Cargando from '../ui/Cargando';
import EstadoVacio from '../ui/EstadoVacio';
import { Pastilla, Puntaje, fmt } from './ui';

const RESULTADOS = [
  { v: 'dieron_datos', l: 'Me dieron con quién', tono: 'bueno' },
  { v: 'contesto', l: 'Contestaron, sin datos', tono: 'neutro' },
  { v: 'volver_llamar', l: 'Volver a llamar', tono: 'neutro' },
  { v: 'no_contesto', l: 'No contestaron', tono: 'neutro' },
  { v: 'no_interesa', l: 'No les interesa', tono: 'malo' },
];

export default function ColaTelefono({ onCambio }: { onCambio?: () => void }) {
  const [cola, setCola] = useState<any[]>([]);
  const [i, setI] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [captura, setCaptura] = useState<{ nombre: string; cargo: string; email: string; whatsapp: string } | null>(null);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const traer = () => {
    setCargando(true);
    fetch('/api/crm/abm/cola?limite=40').then(r => r.json())
      .then(r => { setCola(r.cola || []); setI(0); setCargando(false); }).catch(() => setCargando(false));
  };
  useEffect(traer, []);

  const c = cola[i];
  const registrar = async (resultado: string) => {
    if (!c) return;
    setGuardando(true); setFallo(null);
    try {
      const r = await fetch('/api/crm/abm/cola', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuenta_id: c.id, resultado, nota, ...(captura || {}) }),
      });
      // Si no se guardó, NO se avanza: el vendedor acaba de colgar y perdería
      // lo que le dijeron sin enterarse.
      if (!r.ok) { const j = await r.json().catch(() => ({})); setFallo(j?.error || 'No se pudo guardar. Vuelve a intentar.'); return; }
      setCaptura(null); setNota('');
      if (i + 1 >= cola.length) traer(); else setI(i + 1);
      onCambio?.();
    } catch {
      setFallo('No se pudo guardar. Revisa la conexión y vuelve a intentar.');
    } finally { setGuardando(false); }
  };

  if (cargando) return <Cargando texto="Armando la cola de llamadas…" />;
  if (!c) return (
    <EstadoVacio tono="bien" titulo="Ya llamaste a todos los de hoy"
      pista="Cuando el vigilante encuentre teléfonos nuevos, o alguien capture uno, la cola se vuelve a llenar." />
  );

  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 760 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: '.8125rem', color: '#777' }}>{i + 1} de {cola.length} en la cola de hoy</span>
        <button onClick={() => setI(Math.min(cola.length - 1, i + 1))} style={{ marginLeft: 'auto', font: 'inherit', fontSize: '.75rem', fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: '1px solid #e6e4ee', background: '#fff', color: '#666', cursor: 'pointer' }}>
          Saltar
        </button>
      </div>

      <div style={{ ...tarjetaKpi(P.violeta), padding: '18px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{c.nombre}</h2>
            <p style={{ margin: '4px 0 0', fontSize: '.8125rem', color: '#666' }}>
              {c.giro_nombre} · {c.ciudad || 'México'}
            </p>
          </div>
          <Puntaje v={c.puntaje || 0} ancho={70} />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
          {c.sucursales ? <Pastilla tono={{ bg: P.azulAgua, fg: P.azulTinta }}>{c.sucursales} sucursales</Pastilla> : null}
          {c.google_rating ? <Pastilla tono={{ bg: P.verdeAgua, fg: P.verdeTinta }}>{Number(c.google_rating).toFixed(1)} ★{c.google_resenas ? ` · ${fmt(c.google_resenas)}` : ''}</Pastilla> : null}
          {c.plataforma_web ? <Pastilla tono={{ bg: P.violetaAgua, fg: P.violetaTinta }} titulo={c.plataforma_web} max={230}>{c.plataforma_web}</Pastilla> : null}
        </div>
        {c.senal_expansion && <p style={{ fontSize: '.8125rem', color: '#555', margin: '0 0 8px', lineHeight: 1.5 }}><b style={{ color: P.verdeTinta }}>Crece:</b> {c.senal_expansion}</p>}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          {c.telefono && <a href={`tel:${String(c.telefono).replace(/[^\d+]/g, '')}`} style={enlace(P.violeta)}>Llamar {c.telefono}</a>}
          {c.whatsapp && <a href={c.whatsapp.startsWith('http') ? c.whatsapp : `https://wa.me/${String(c.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noopener" style={enlaceSuave()}>WhatsApp</a>}
        </div>
      </div>

      <div style={{ background: P.violetaAgua, borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ fontSize: '.625rem', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 800, color: P.violetaTinta, marginBottom: 6 }}>Lo que hay que decir</div>
        <p style={{ margin: 0, fontSize: '.9375rem', color: '#3a3550', lineHeight: 1.6 }}>{c.guion}</p>
      </div>

      {captura && (
        <div style={{ display: 'grid', gap: 8, background: '#fff', border: '1px solid #ececec', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#666' }}>Lo que nos dijeron</div>
          {(['nombre', 'cargo', 'email', 'whatsapp'] as const).map(k => (
            <input key={k} value={captura[k]} onChange={e => setCaptura({ ...captura, [k]: e.target.value })}
              placeholder={k === 'nombre' ? '¿Con quién hay que hablar?' : k === 'cargo' ? 'Su cargo' : k === 'email' ? 'Su correo (esto es lo que más sirve)' : 'Su WhatsApp directo'}
              style={{ font: 'inherit', fontSize: '.875rem', padding: '9px 11px', borderRadius: 8, border: '1px solid #e0dee8' }} />
          ))}
        </div>
      )}

      <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Qué pasó en la llamada…"
        style={{ font: 'inherit', fontSize: '.8125rem', padding: '9px 11px', borderRadius: 8, border: '1px solid #e0dee8', resize: 'vertical' }} />

      {fallo && (
        <div style={{ fontSize: '.8125rem', color: P.rojoTinta, background: P.rojoAgua, borderRadius: 8, padding: '9px 12px' }}>{fallo}</div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {RESULTADOS.map(r => (
          <button key={r.v} disabled={guardando}
            onClick={() => { if (r.v === 'dieron_datos' && !captura) { setCaptura({ nombre: '', cargo: '', email: '', whatsapp: '' }); return; } registrar(r.v); }}
            style={{
              font: 'inherit', fontSize: '.8125rem', fontWeight: 700, padding: '9px 15px', borderRadius: 9, cursor: 'pointer',
              border: r.tono === 'bueno' ? 'none' : r.tono === 'malo' ? '1px solid #f0c4bd' : '1px solid #e0dee8',
              background: r.tono === 'bueno' ? P.violeta : '#fff',
              color: r.tono === 'bueno' ? '#fff' : r.tono === 'malo' ? P.rojoTinta : '#555',
            }}>
            {r.v === 'dieron_datos' && !captura ? 'Me dieron con quién…' : r.l}
          </button>
        ))}
      </div>
    </div>
  );
}

const enlace = (color: string) => ({
  fontSize: '.875rem', fontWeight: 700, color: '#fff', background: color,
  padding: '9px 15px', borderRadius: 9, textDecoration: 'none', display: 'inline-block',
});
/** Secundario, de puro borde: dos botones sólidos juntos compiten, y el verde
 *  claro con letra blanca no llega ni a 3:1 de contraste. */
const enlaceSuave = () => ({
  fontSize: '.875rem', fontWeight: 700, color: P.verdeTinta, background: '#fff',
  border: `1.5px solid ${P.verde}`, padding: '8px 15px', borderRadius: 9,
  textDecoration: 'none', display: 'inline-block',
});
