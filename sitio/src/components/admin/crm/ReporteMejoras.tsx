// Reporte ejecutivo del periodo: qué se le entregó, qué módulos nuevos arrancó
// y qué se le capacitó.
//
// La IA redacta; los hechos vienen de la base. Por eso, si la IA falla o no
// está configurada, el reporte se muestra igual con los datos crudos: un
// reporte sin narrativa sirve, uno con narrativa inventada cuesta la cuenta.
import { useState } from 'react';

const money = (n?: number | null) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX');
const fmtDate = (d?: string | null) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '') : '';
const iso = (d: Date) => d.toISOString().slice(0, 10);

const S = {
  btn: { padding: '8px 15px', border: 'none', borderRadius: 9, fontSize: '0.79rem', fontWeight: 700, cursor: 'pointer', background: '#9B8CFA', color: '#fff', fontFamily: 'inherit' } as const,
  btnG: { padding: '7px 13px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#444', fontFamily: 'inherit' } as const,
  input: { padding: '7px 10px', border: '1.5px solid #e4dffb', borderRadius: 9, fontSize: '0.77rem', outline: 'none', background: '#fdfcff', fontFamily: 'inherit' } as const,
  sec: { fontSize: '0.62rem', fontWeight: 800, color: '#5B4BD6', textTransform: 'uppercase' as const, letterSpacing: '.07em', margin: '18px 0 8px' } as const,
};

export default function ReporteMejoras({ companyId, cliente, onCerrar }: any) {
  const hoy = new Date();
  const [desde, setDesde] = useState(iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [hasta, setHasta] = useState(iso(hoy));
  const [cargando, setCargando] = useState(false);
  const [rep, setRep] = useState<any>(null);
  const [error, setError] = useState('');

  const preset = (d: Date, h: Date) => { setDesde(iso(d)); setHasta(iso(h)); };

  async function generar() {
    setCargando(true); setError(''); setRep(null);
    const r = await fetch('/api/crm/mejoras/reporte', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId, desde, hasta }),
    }).then(x => x.json()).catch(() => null);
    setCargando(false);
    if (!r || r.error) { setError(r?.error || 'No se pudo generar el reporte.'); return; }
    setRep(r);
  }

  const h = rep?.hechos, n = rep?.narrativa;
  const visibles = (h?.entregadas || []).filter((m: any) => m.visible_cliente);

  function copiar() {
    if (!h) return;
    const L: string[] = [];
    L.push(`${n?.titulo || 'Reporte del periodo'} — ${h.cliente}`);
    L.push(h.periodo.texto);
    if (n?.resumen) L.push('\n' + n.resumen);
    if (visibles.length) {
      L.push('\nMEJORAS ENTREGADAS');
      (n?.entregado?.length ? n.entregado : visibles.map((m: any) => `${m.titulo}${m.descripcion ? ': ' + m.descripcion : ''}`))
        .forEach((t: string, i: number) => L.push(`· ${t}${visibles[i]?.fecha ? ` (${fmtDate(visibles[i].fecha)})` : ''}`));
    }
    if (h.modulos_nuevos?.length) {
      L.push('\nMÓDULOS NUEVOS');
      (n?.modulos?.length ? n.modulos : h.modulos_nuevos.map((m: any) => m.modulo)).forEach((t: string) => L.push(`· ${t}`));
    }
    if (n?.operacion) L.push('\nCÓMO CAMBIÓ TU OPERACIÓN\n' + n.operacion);
    if (n?.siguiente?.length) { L.push('\nLO QUE SIGUE'); n.siguiente.forEach((t: string) => L.push(`· ${t}`)); }
    navigator.clipboard?.writeText(L.join('\n'));
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 962, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 22px 54px rgba(16,24,40,.24)', width: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800 }}>Reporte ejecutivo del periodo</h3>
            <div style={{ fontSize: '0.73rem', color: '#7a6fc9', marginTop: 2 }}>{cliente || ''}</div>
          </div>
          <button onClick={onCerrar} style={{ border: 'none', background: 'none', color: '#9c99a6', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>

        <div style={{ padding: '12px 18px', borderBottom: '1px solid #f1eff7', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={S.input} />
          <span style={{ color: '#a5a2af', fontSize: '0.75rem' }}>al</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={S.input} />
          <button style={S.btnG} onClick={() => preset(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), new Date(hoy.getFullYear(), hoy.getMonth(), 0))}>Mes pasado</button>
          <button style={S.btnG} onClick={() => preset(new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1), hoy)}>Trimestre</button>
          <button style={S.btnG} onClick={() => preset(new Date(hoy.getFullYear(), 0, 1), hoy)}>Este año</button>
          <button style={{ ...S.btn, marginLeft: 'auto' }} onClick={generar} disabled={cargando}>{cargando ? 'Generando…' : 'Generar'}</button>
        </div>

        <div style={{ padding: '4px 18px 16px', overflowY: 'auto', flex: 1 }}>
          {error && <div style={{ marginTop: 12, background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '9px 11px', fontSize: '0.77rem', color: '#C0554E' }}>{error}</div>}
          {!rep && !cargando && !error && (
            <div style={{ padding: '26px 0', color: '#9c99a6', fontSize: '0.82rem', lineHeight: 1.6 }}>
              Elige el periodo y dale a Generar. El reporte junta lo que capturaste en Mejoras con lo que SACS ya sabe
              de la cuenta: qué módulos empezó a usar y cómo cambió su operación.
            </div>
          )}
          {cargando && <div style={{ padding: '26px 0', color: '#9c99a6', fontSize: '0.85rem' }}>Juntando los datos y redactando…</div>}

          {rep && (
            <div>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#9c99a6', letterSpacing: '.1em', textTransform: 'uppercase' }}>{h.cliente}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 300, marginTop: 5, letterSpacing: '-.01em' }}>{n?.titulo || 'Lo que hicimos por ti'}</div>
                <div style={{ fontSize: '0.73rem', color: '#8a8a8a', marginTop: 3 }}>{h.periodo.texto}</div>
              </div>

              {n?.resumen && <div style={{ fontSize: '0.85rem', lineHeight: 1.65, color: '#3f3b4d', marginTop: 12 }}>{n.resumen}</div>}

              {rep.ia_error && (
                <div style={{ marginTop: 12, background: '#FEF6E7', border: '1px solid #f5e2b8', borderRadius: 8, padding: '9px 11px', fontSize: '0.74rem', color: '#9a6a10' }}>
                  La redacción automática falló, pero los datos son reales y están abajo. ({rep.ia_error})
                </div>
              )}

              <div style={S.sec}>Mejoras entregadas ({visibles.length})</div>
              {visibles.length === 0 && <div style={{ fontSize: '0.8rem', color: '#9c99a6' }}>No se entregó ninguna mejora en este periodo.</div>}
              {visibles.map((m: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 9, padding: '8px 0', borderBottom: '1px solid #f7f6fa' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 99, background: '#EAF8F2', color: '#1E8A63', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>✓</span>
                  <div style={{ flex: 1, fontSize: '0.79rem', lineHeight: 1.5 }}>
                    <b>{m.titulo}</b>{n?.entregado?.[i] ? <div style={{ color: '#71717a' }}>{n.entregado[i]}</div> : m.descripcion ? <div style={{ color: '#71717a' }}>{m.descripcion}</div> : null}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#a5a2af', whiteSpace: 'nowrap' }}>{fmtDate(m.fecha)}</span>
                </div>
              ))}

              <div style={S.sec}>Módulos nuevos ({h.modulos_nuevos.length})</div>
              {h.sin_datos_de_uso && (
                <div style={{ fontSize: '0.78rem', color: '#9a6a10', background: '#FEF6E7', border: '1px solid #f5e2b8', borderRadius: 8, padding: '9px 11px' }}>
                  No hay fotos de uso para este periodo, así que no se puede comparar qué módulos arrancó. Las fotos
                  empiezan el 25 de julio de 2026.
                </div>
              )}
              {!h.sin_datos_de_uso && h.modulos_nuevos.length === 0 && (
                <div style={{ fontSize: '0.8rem', color: '#9c99a6' }}>No empezó a usar ningún módulo nuevo en este periodo.</div>
              )}
              {h.modulos_nuevos.map((m: any, i: number) => (
                <div key={m.modulo} style={{ display: 'flex', gap: 9, padding: '8px 0', borderBottom: '1px solid #f7f6fa' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 99, background: '#EEECFE', color: '#5B4BD6', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>+</span>
                  <div style={{ flex: 1, fontSize: '0.79rem', lineHeight: 1.5 }}>
                    <b>{m.modulo}</b>
                    <div style={{ color: '#71717a' }}>
                      {n?.modulos?.[i] || <>
                        {m.docs_30d ? `${m.docs_30d} movimientos en los últimos 30 días. ` : ''}
                        {m.capacitacion ? `Empezó después de la capacitación del ${fmtDate(m.capacitacion.fecha)}.` : ''}
                      </>}
                    </div>
                  </div>
                </div>
              ))}

              <div style={S.sec}>Capacitaciones ({h.reuniones.capacitaciones.length})</div>
              {h.reuniones.capacitaciones.length === 0 && <div style={{ fontSize: '0.8rem', color: '#9c99a6' }}>No hubo sesiones de capacitación en el periodo.</div>}
              {h.reuniones.capacitaciones.map((c: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 9, padding: '7px 0', fontSize: '0.79rem', borderBottom: '1px solid #f7f6fa' }}>
                  <span style={{ color: c.asistio ? '#1E8A63' : '#C0554E', fontWeight: 800, fontSize: '0.7rem', marginTop: 2 }}>{c.asistio ? '✓' : '✕'}</span>
                  <div style={{ flex: 1 }}>
                    {c.asunto || 'Capacitación'}
                    {c.modo && <span style={{ color: '#a5a2af', fontSize: '0.72rem' }}> · {c.modo}</span>}
                    {!c.asistio && <span style={{ color: '#C0554E' }}> · no se presentó</span>}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{fmtDate(c.fecha)}</span>
                </div>
              ))}

              {n?.operacion && (<>
                <div style={S.sec}>Cómo cambió tu operación</div>
                <div style={{ background: '#f6f9ff', border: '1px solid #dbe7fb', borderRadius: 9, padding: '10px 12px', fontSize: '0.79rem', color: '#2C5FC4', lineHeight: 1.55 }}>{n.operacion}</div>
              </>)}

              {(h.en_curso || []).length > 0 && (<>
                <div style={S.sec}>Lo que sigue</div>
                {h.en_curso.map((m: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 9, padding: '7px 0', fontSize: '0.79rem', borderBottom: '1px solid #f7f6fa' }}>
                    <span style={{ color: '#5B4BD6', fontWeight: 800, marginTop: 1 }}>→</span>
                    <div style={{ flex: 1 }}>{n?.siguiente?.[i] || m.titulo}</div>
                    {m.fecha_compromiso && <span style={{ fontSize: '0.68rem', color: '#a5a2af' }}>{fmtDate(m.fecha_compromiso)}</span>}
                  </div>
                ))}
              </>)}

              {/* Lo interno se separa a propósito: lo que se le presume al
                  cliente tiene que ser lo que a él le sirve, no la bitácora. */}
              {n?.atencion && (
                <div style={{ marginTop: 16, background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 9, padding: '10px 12px', fontSize: '0.78rem', color: '#C0554E', lineHeight: 1.55 }}>
                  <b style={{ color: '#8c2f28' }}>Para ti, no para el cliente: </b>{n.atencion}
                </div>
              )}
              {h.entregadas.length > visibles.length && (
                <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#a5a2af' }}>
                  {h.entregadas.length - visibles.length} mejora(s) marcadas como internas no aparecen arriba.
                </div>
              )}
            </div>
          )}
        </div>

        {rep && (
          <div style={{ padding: '12px 18px 15px', borderTop: '1px solid #f1eff7', display: 'flex', gap: 8 }}>
            <button style={S.btn} onClick={copiar}>Copiar como texto</button>
            <button style={{ ...S.btnG, marginLeft: 'auto' }} onClick={onCerrar}>Cerrar</button>
          </div>
        )}
      </div>
    </div>
  );
}
