// SECUENCIAS · El reporte correo por correo.
//
// El total de una cadencia («120 enviados, 38 abiertos») no deja decidir nada: si
// el correo del día 4 no lo abre nadie, el promedio lo esconde. Esta pantalla abre
// el embudo por pieza —llegó, rebotó, lo abrieron, cuántas veces, hicieron clic— y
// deja bajar a la lista de contactos de UN correo para ver quién y con qué interés.
//
// Las aperturas TOTALES van junto a los que abrieron a propósito: tres personas que
// lo abren cinco veces cada una es una señal distinta a quince que lo abren una vez.
import { useEffect, useState } from 'react';
import type React from 'react';
import Cargando from './ui/Cargando';
import { P } from '../../../lib/crm/paleta';

const COLOR: Record<string, string> = {
  'rebotó': P.rojoTinta, 'hizo clic': P.verdeTinta, 'abrió': P.violetaTinta,
  'entregado': '#7a7a85', 'enviado': '#a5a2af',
};
const pct = (a: number, b: number) => (b ? `${Math.round(a / b * 100)}%` : '—');
const celda: React.CSSProperties = { padding: '9px 10px', fontSize: '0.78rem', borderBottom: '1px solid #f0eef7', textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const encabezado: React.CSSProperties = { ...celda, fontSize: '0.62rem', fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '2px solid #e4dffb' };

export default function ReporteSecuencia({ id, nombre, alCerrar }: { id: string; nombre: string; alCerrar: () => void }) {
  const [d, setD] = useState<any>(null);
  const [paso, setPaso] = useState<string | null>(null);

  useEffect(() => {
    setD(null);
    fetch(`/api/crm/secuencia-reporte?id=${id}${paso ? `&paso=${paso}` : ''}`)
      .then(r => r.json()).then(setD).catch(() => setD({ error: 'No se pudo cargar' }));
  }, [id, paso]);

  if (!d) return <Cargando texto="Cargando el reporte…" />;
  if (d.error) return <div style={{ padding: 16, color: P.rojoTinta }}>{d.error}</div>;
  const correos = d.correos || [];
  const abierto = correos.find((c: any) => c.template_id === paso);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={alCerrar} style={{ border: '1px solid #ddd', background: '#fff', borderRadius: 9, padding: '8px 14px', fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer' }}>← Secuencias</button>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{nombre}</h3>
        <span style={{ fontSize: '0.78rem', color: '#8f8d98' }}>{d.miembros} contactos dentro</span>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #ececec', borderRadius: 10, background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead><tr>
            <th style={{ ...encabezado, textAlign: 'left' }}>Correo</th>
            <th style={encabezado}>Enviados</th>
            <th style={encabezado}>Llegaron</th>
            <th style={encabezado}>Rebotes</th>
            <th style={encabezado}>Lo abrieron</th>
            <th style={encabezado}>Aperturas</th>
            <th style={encabezado}>Clic</th>
            <th style={encabezado} />
          </tr></thead>
          <tbody>
            {correos.map((c: any) => (
              <tr key={c.template_id} style={{ background: paso === c.template_id ? P.violetaAgua : undefined }}>
                <td style={{ ...celda, textAlign: 'left' }}>
                  <b style={{ color: P.violetaTinta }}>Día {c.dia}</b>
                  <div style={{ color: '#555', fontSize: '0.76rem' }}>{c.asunto}</div>
                </td>
                <td style={celda}>{c.enviados}</td>
                <td style={celda}>{c.entregados} <span style={{ color: '#a5a2af' }}>{pct(c.entregados, c.enviados)}</span></td>
                <td style={{ ...celda, color: c.rebotes ? P.rojoTinta : '#c9c7d0' }}>{c.rebotes}</td>
                <td style={celda}><b style={{ color: P.violetaTinta }}>{c.abiertos}</b> <span style={{ color: '#a5a2af' }}>{pct(c.abiertos, c.entregados)}</span></td>
                <td style={{ ...celda, color: '#8f8d98' }}>{c.aperturas}</td>
                <td style={celda}><b style={{ color: c.con_clic ? P.verdeTinta : '#c9c7d0' }}>{c.con_clic}</b> <span style={{ color: '#a5a2af' }}>{pct(c.con_clic, c.entregados)}</span></td>
                <td style={celda}>
                  <button onClick={() => setPaso(paso === c.template_id ? null : c.template_id)}
                    style={{ border: '1.5px solid ' + P.violeta, color: P.violetaTinta, background: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
                    {paso === c.template_id ? 'Ocultar' : 'Ver quién'}
                  </button>
                </td>
              </tr>
            ))}
            {!correos.length && <tr><td colSpan={8} style={{ ...celda, textAlign: 'center', color: '#8f8d98' }}>Todavía no sale ningún correo de esta secuencia.</td></tr>}
          </tbody>
        </table>
      </div>

      {paso && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>
            Día {abierto?.dia} · {abierto?.asunto}
            <span style={{ fontWeight: 500, color: '#8f8d98' }}> — {(d.contactos || []).length} contactos</span>
          </h4>
          <div style={{ overflowX: 'auto', border: '1px solid #ececec', borderRadius: 10, background: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead><tr>
                <th style={{ ...encabezado, textAlign: 'left' }}>Contacto</th>
                <th style={{ ...encabezado, textAlign: 'left' }}>Estado</th>
                <th style={encabezado}>Aperturas</th>
                <th style={encabezado}>Clics</th>
                <th style={{ ...encabezado, textAlign: 'left' }}>Qué tocó</th>
              </tr></thead>
              <tbody>
                {(d.contactos || []).map((c: any, i: number) => (
                  <tr key={i}>
                    <td style={{ ...celda, textAlign: 'left' }}>
                      {c.nombre}{c.empresa ? <span style={{ color: '#8f8d98' }}> · {c.empresa}</span> : null}
                    </td>
                    <td style={{ ...celda, textAlign: 'left', color: COLOR[c.estado] || '#555', fontWeight: 700 }}>
                      {c.estado}{c.motivo_rebote ? <span style={{ fontWeight: 400, color: '#8f8d98' }}> · {String(c.motivo_rebote).slice(0, 40)}</span> : null}
                    </td>
                    <td style={celda}>{c.aperturas || '—'}</td>
                    <td style={{ ...celda, color: c.clics ? P.verdeTinta : '#c9c7d0', fontWeight: c.clics ? 700 : 400 }}>{c.clics || '—'}</td>
                    <td style={{ ...celda, textAlign: 'left', color: '#8f8d98', fontSize: '0.72rem' }}>
                      {(c.ligas || []).map((l: string, j: number) => <div key={j}>{String(l).replace(/^https?:\/\/(www\.)?/, '').slice(0, 46)}</div>)}
                    </td>
                  </tr>
                ))}
                {!(d.contactos || []).length && <tr><td colSpan={5} style={{ ...celda, textAlign: 'center', color: '#8f8d98' }}>Ese correo todavía no le ha salido a nadie.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
