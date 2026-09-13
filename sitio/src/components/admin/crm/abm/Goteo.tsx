// Envíos progresivos: la base entra a su cadencia de a poco, N cuentas por día.
//
// Existe por Villa Hidalgo: 185 proveedores que se conocen. Si a todos les
// llega el mismo correo el mismo día, en el grupo de WhatsApp se preguntan de
// dónde salió la base. Aquí se enciende la opción, se ve cuántas van, cuáles
// entran mañana y qué pasó cada día. Lo que MANDA sigue siendo el cartero con
// su cupo; esto solo decide quién entra a la fila hoy.
import { useEffect, useState } from 'react';
import { P, tarjetaKpi } from '../../../../lib/crm/paleta';
import { GIROS } from '../../../../lib/crm/abm-giros';
import Cargando from '../ui/Cargando';
import EstadoVacio from '../ui/EstadoVacio';
import { Pastilla, fecha, fmt } from './ui';

const ESTADO: Record<string, { l: string; bg: string; fg: string }> = {
  activo:    { l: 'Activo',    bg: P.verdeAgua,   fg: P.verdeTinta },
  pausado:   { l: 'En pausa',  bg: P.ambarAgua,   fg: P.ambarTinta },
  terminado: { l: 'Terminado', bg: P.violetaAgua, fg: P.violetaTinta },
};

export default function Goteo() {
  const [d, setD] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ t: string; mal?: boolean } | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState({ cadencia_id: '', cuentas_dia: 10, ciudad: '', con_ia: true });
  const [abierto, setAbierto] = useState<string | null>(null);

  const traer = () => {
    fetch('/api/crm/abm/goteo').then(r => r.json()).then(r => { setD(r); setCargando(false); }).catch(() => setCargando(false));
  };
  useEffect(traer, []);

  const pedir = async (body: any, clave: string, ok?: string) => {
    setTrabajando(clave); setAviso(null);
    try {
      const r = await fetch('/api/crm/abm/goteo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) setAviso({ t: j?.error || 'No se pudo', mal: true });
      else if (body.accion === 'enrolar_ahora') {
        const l = (j.lotes || [])[0];
        setAviso(l ? { t: l.cuentas ? `Entraron ${l.cuentas} cuentas${l.sin_ia ? ` (${l.sin_ia} sin IA)` : ''}. Salen en la próxima corrida del cartero.` : (l.motivo || 'No entró ninguna'), mal: !l.cuentas } : { t: 'Hoy ya había corrido' });
      } else if (ok) setAviso({ t: ok });
      traer();
    } finally { setTrabajando(null); }
  };

  if (cargando && !d) return <Cargando texto="Cargando los envíos progresivos…" />;
  const m = d?.motor || {};
  const motorListo = m.pausado === 'no' && !(m.faltas || []).length;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* El motor: sin él encendido, ningún goteo enrola ni ningún correo sale. */}
      <div style={{ ...tarjetaKpi(motorListo ? P.verde : P.ambar), display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: '.625rem', letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', fontWeight: 700 }}>El cartero</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: motorListo ? P.verdeTinta : P.ambarTinta, lineHeight: 1.2 }}>
            {m.pausado === 'no' ? (motorListo ? 'Encendido' : 'Encendido, pero no puede mandar') : m.pausado === 'auto' ? 'Pausa automática, se levanta mañana' : 'Pausado'}
          </div>
          <div style={{ fontSize: '.75rem', color: '#888', marginTop: 3 }}>
            {m.remitente ? `Sale por ${m.remitente}` : 'Sin remitente de correo en frío'} · rampa de {m.cupo_inicial} a {m.tope_diario} correos al día · corre de lunes a viernes a las 10 y a la 1 (CDMX)
            {m.pausado_nota ? ` · ${m.pausado_nota}` : ''}
          </div>
          {(m.faltas || []).map((f: string) => (
            <div key={f} style={{ fontSize: '.75rem', color: P.ambarTinta, marginTop: 5 }}>{f}</div>
          ))}
        </div>
        <button disabled={!!trabajando} onClick={() => {
          const enciende = m.pausado !== 'no';
          if (enciende && !window.confirm('Al encender el cartero salen los correos aprobados de TODAS las cuentas y cada goteo activo enrola su lote del día. ¿Encender?')) return;
          pedir({ accion: 'motor', pausado: enciende ? 'no' : 'si' }, 'motor', enciende ? 'Cartero encendido' : 'Cartero pausado');
        }} style={btn(m.pausado !== 'no')}>{m.pausado !== 'no' ? 'Encender el cartero' : 'Pausar el cartero'}</button>
      </div>

      {aviso && (
        <div style={{ fontSize: '.8125rem', color: aviso.mal ? P.rojoTinta : P.verdeTinta, background: aviso.mal ? P.rojoAgua : P.verdeAgua, borderRadius: 8, padding: '8px 12px' }}>{aviso.t}</div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '.9375rem', fontWeight: 800 }}>Envíos progresivos</div>
          <div style={{ fontSize: '.75rem', color: '#888' }}>Una base entra a su cadencia de a poco: cada día hábil, las N cuentas mejor puntuadas que todavía no tienen correo. Quien lo enciende firma la aprobación de todos sus correos.</div>
        </div>
        {!nuevo && <button onClick={() => setNuevo(true)} style={btn(false)}>Nuevo goteo</button>}
      </div>

      {nuevo && (
        <div style={{ border: `1px solid ${P.linea}`, borderRadius: 10, padding: '14px 16px', background: '#fff', display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
            <label style={lbl}>Cadencia
              <select value={form.cadencia_id} onChange={e => setForm({ ...form, cadencia_id: e.target.value })} style={inp}>
                <option value="">Elige una…</option>
                {(d?.cadencias || []).map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label style={lbl}>Cuentas por día
              <input type="number" min={1} max={100} value={form.cuentas_dia} onChange={e => setForm({ ...form, cuentas_dia: Number(e.target.value) })} style={inp} />
            </label>
            <label style={lbl}>Solo de esta ciudad (opcional)
              <input value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} placeholder="Villa Hidalgo" style={inp} />
            </label>
          </div>
          <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.con_ia} onChange={e => setForm({ ...form, con_ia: e.target.checked })} />
            Adaptar cada correo con IA a los datos de la cuenta (si la IA falla, sale con la plantilla del giro)
          </label>
          <div style={{ display: 'flex', gap: 7 }}>
            <button disabled={!form.cadencia_id || !!trabajando} onClick={() => {
              pedir({ accion: 'crear', cadencia_id: form.cadencia_id, cuentas_dia: form.cuentas_dia, filtro: { ciudad: form.ciudad }, con_ia: form.con_ia }, 'crear', 'Goteo creado: enrola su primer lote en la próxima corrida del cartero');
              setNuevo(false);
            }} style={btn(true)}>Encender el goteo</button>
            <button onClick={() => setNuevo(false)} style={btn(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {!(d?.goteos || []).length && !nuevo && (
        <EstadoVacio titulo="Ningún goteo todavía" pista="Crea uno para que una base entre a su cadencia de a poco." accion="Nuevo goteo" onAccion={() => setNuevo(true)} />
      )}

      {(d?.goteos || []).map((g: any) => {
        const est = ESTADO[g.estado] || ESTADO.activo;
        const t = g.toques || {};
        const enviados = t.enviado || 0, enFila = (t.aprobado || 0) + (t.programado || 0) + (t.enviando || 0);
        const ver = abierto === g.id;
        return (
          <div key={g.id} style={{ border: `1px solid ${P.linea}`, borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '14px 17px', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '.9375rem', fontWeight: 800 }}>{g.nombre}</div>
                <Pastilla tono={est}>{est.l}</Pastilla>
                <span style={{ fontSize: '.75rem', color: '#888' }}>
                  {g.cadencia?.nombre} · {GIROS[g.cadencia?.giro] || g.cadencia?.giro}{g.filtro?.ciudad ? ` · ${g.filtro.ciudad}` : ''}{g.autor ? ` · encendido por ${g.autor}` : ''}
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {g.estado === 'activo' && (
                    <button disabled={!!trabajando} onClick={() => {
                      if (!window.confirm(`Escribir y aprobar ahora la cadencia de ${Math.min(g.cuentas_dia, g.quedan)} cuentas. Salen en la próxima corrida del cartero. ¿Seguir?`)) return;
                      pedir({ accion: 'enrolar_ahora', id: g.id }, g.id);
                    }} style={btn(true)}>{trabajando === g.id ? 'Escribiendo…' : 'Enrolar el lote de hoy'}</button>
                  )}
                  {g.estado === 'activo' && <button disabled={!!trabajando} onClick={() => pedir({ accion: 'pausar', id: g.id }, g.id, 'Goteo en pausa')} style={btn(false)}>Pausar</button>}
                  {g.estado === 'pausado' && <button disabled={!!trabajando} onClick={() => pedir({ accion: 'reanudar', id: g.id }, g.id, 'Goteo reanudado')} style={btn(true)}>Reanudar</button>}
                  <button onClick={() => setAbierto(ver ? null : g.id)} style={btn(false)}>{ver ? 'Cerrar' : 'Ver detalle'}</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
                {kpi('Por día', g.cuentas_dia, 'cuentas nuevas, de lunes a viernes', P.violeta, P.violetaTinta)}
                {kpi('Ya entraron', fmt(g.enroladas || 0), g.ultimo_lote ? `último lote el ${fecha(g.ultimo_lote)}` : 'todavía ninguna', P.verde, P.verdeTinta)}
                {kpi('Quedan', fmt(g.quedan || 0), `de ${fmt(g.base || 0)} en la base · ${Math.ceil((g.quedan || 0) / Math.max(1, g.cuentas_dia))} días hábiles`, P.azul, P.azulTinta)}
                {kpi('Correos', `${fmt(enviados)} / ${fmt(enFila)}`, 'enviados / en la fila', P.ambar, P.ambarTinta)}
              </div>

              {g.nota && <div style={{ fontSize: '.8125rem', color: '#666', lineHeight: 1.5 }}>{g.nota}</div>}
            </div>

            {ver && (
              <div style={{ borderTop: `1px solid ${P.lineaSuave}`, padding: '14px 17px', display: 'grid', gap: 14, background: '#fbfbfd' }}>
                <div>
                  <div style={{ fontSize: '.6875rem', letterSpacing: '.06em', textTransform: 'uppercase', color: '#999', fontWeight: 700, marginBottom: 6 }}>
                    {g.estado === 'terminado' ? 'Ya no entra nadie' : 'El siguiente lote'}
                  </div>
                  {(g.siguientes || []).length ? (
                    <div style={{ display: 'grid', gap: 4 }}>
                      {g.siguientes.map((c: any) => (
                        <div key={c.id} style={{ display: 'flex', gap: 8, fontSize: '.8125rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <a href="#" onClick={e => { e.preventDefault(); window.dispatchEvent(new CustomEvent('crm:abm-ficha', { detail: { id: c.id } })); }}
                            style={{ fontWeight: 700, color: P.violetaTinta, textDecoration: 'none' }}>{c.nombre}</a>
                          <span style={{ color: '#888', fontSize: '.75rem' }}>{c.ciudad || ''} · {c.correo} · {c.puntaje ?? 0} pts</span>
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ fontSize: '.8125rem', color: '#888' }}>No queda ninguna cuenta elegible.</div>}
                </div>

                <div>
                  <div style={{ fontSize: '.6875rem', letterSpacing: '.06em', textTransform: 'uppercase', color: '#999', fontWeight: 700, marginBottom: 6 }}>Día por día</div>
                  {(g.lotes || []).length ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {g.lotes.map((l: any, i: number) => (
                        <div key={i} style={{ fontSize: '.8125rem', display: 'grid', gap: 2 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700 }}>{fecha(l.fecha)}</span>
                            <span style={{ color: l.cuentas ? P.verdeTinta : P.ambarTinta, fontWeight: 700 }}>{l.cuentas ? `${l.cuentas} cuentas` : 'nadie'}</span>
                            {l.sin_ia ? <span style={{ color: '#888', fontSize: '.75rem' }}>{l.sin_ia} sin IA</span> : null}
                            {l.motivo && <span style={{ color: '#888', fontSize: '.75rem' }}>{l.motivo}</span>}
                          </div>
                          {(l.detalle || []).length ? (
                            <div style={{ color: '#777', fontSize: '.75rem', lineHeight: 1.5 }}>
                              {l.detalle.map((x: any) => x.error ? `${x.nombre} (no entró: ${x.error})` : x.nombre).join(' · ')}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ fontSize: '.8125rem', color: '#888' }}>Todavía no ha corrido ningún día.</div>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const kpi = (etiqueta: string, valor: any, pie: string, color: string, tinta: string) => (
  <div style={tarjetaKpi(color)}>
    <div style={{ fontSize: '.625rem', letterSpacing: '.08em', textTransform: 'uppercase', color: '#999', fontWeight: 700 }}>{etiqueta}</div>
    <div style={{ fontSize: '1.375rem', fontWeight: 800, color: tinta, lineHeight: 1.15 }}>{valor}</div>
    <div style={{ fontSize: '.6875rem', color: '#888' }}>{pie}</div>
  </div>
);

const lbl: any = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.75rem', fontWeight: 700, color: '#555' };
const inp: any = { font: 'inherit', fontSize: '.875rem', fontWeight: 500, padding: '8px 11px', borderRadius: 8, border: '1px solid #e0dee8', background: '#fff' };
const btn = (primario: boolean) => ({
  font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
  border: primario ? 'none' : `1.5px solid ${P.violeta}`,
  background: primario ? P.violeta : '#fff', color: primario ? '#fff' : P.violetaTinta,
});
