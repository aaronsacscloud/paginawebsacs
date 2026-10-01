// Reporte de ENTREGAS: el documento que justifica el trabajo, con su video.
//
// El reporte ejecutivo cuenta el periodo entero —soporte, uso, oportunidades—
// y por eso pasa por la IA que lo redacta. Este contesta una sola pregunta,
// «¿qué me han hecho?», y su contenido son hechos que no hay que redactar: qué
// se pidió, de qué tipo fue, cuándo quedó y dónde está el video. Por eso aquí
// no hay paso de redacción: se genera y ya tiene liga.
//
// Ese video es la razón de existir del documento. Sin él, esto ya lo decía el
// reporte ejecutivo.
import { useEffect, useMemo, useState } from 'react';

const fmtDate = (d?: string | null) => d
  ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '')
  : '';
const iso = (d: Date) => d.toISOString().slice(0, 10);

/* Cómo se le dice al cliente cada tipo. `pendiente` es como el CRM llama por
   dentro a los bugs; en un documento de entregas ese renglón se leería como
   que NO está hecho. Misma traducción que el documento público. */
const TIPO_L: Record<string, string> = {
  personalizacion: 'personalización', ajuste: 'ajuste', pendiente: 'corrección',
  capacitacion: 'capacitación', plugin: 'plugin', modulo: 'módulo', otro: 'mejora',
};

const S = {
  btn: { padding: '8px 15px', border: 'none', borderRadius: 9, fontSize: '0.79rem', fontWeight: 700, cursor: 'pointer', background: '#1E8A63', color: '#fff', fontFamily: 'inherit' } as const,
  btnG: { padding: '7px 13px', border: '1px solid #ddd', borderRadius: 8, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#444', fontFamily: 'inherit' } as const,
  input: { padding: '7px 10px', border: '1.5px solid #e4dffb', borderRadius: 9, fontSize: '0.77rem', outline: 'none', background: '#fdfcff', fontFamily: 'inherit' } as const,
  chip: { fontSize: '0.6rem', fontWeight: 800, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' as const },
  grupo: { fontSize: '0.7rem', fontWeight: 800, color: '#241d43', marginTop: 12, marginBottom: 2 } as const,
  grupoC: { fontWeight: 600, color: '#a5a2af', marginLeft: 4 } as const,
  vacio: { fontSize: '0.75rem', color: '#a5a2af', padding: '6px 0 4px' } as const,
};

/** Un renglón que se palomea: entra o no entra al documento. */
function Fila({ on, onClick, chip, chipColor, titulo, modulo, folio, derecha }: any) {
  return (
    <div onClick={onClick} role="checkbox" aria-checked={on} style={{
      display: 'flex', gap: 9, alignItems: 'center', padding: '8px 8px', borderBottom: '1px solid #f7f6fa',
      cursor: 'pointer', borderRadius: 8, background: on ? '#faf8ff' : '#fff', opacity: on ? 1 : .62,
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: 5, flex: 'none', border: on ? 'none' : '1.5px solid #cfc9e6',
        background: on ? '#9B8CFA' : '#fff', color: '#fff', fontSize: 11, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{on ? '✓' : ''}</span>
      <span style={{ ...S.chip, background: chipColor ? chipColor[0] : '#EEECFE', color: chipColor ? chipColor[1] : '#5B4BD6', textTransform: 'uppercase', letterSpacing: '.04em' }}>{chip}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: '0.79rem', fontWeight: 700, color: '#241d43', lineHeight: 1.35 }}>{titulo}</span>
        {(modulo || folio) && <span style={{ display: 'block', fontSize: '0.67rem', color: '#a5a2af' }}>{[folio, modulo].filter(Boolean).join(' · ')}</span>}
      </span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 'none' }}>{derecha}</span>
    </div>
  );
}

/* La etapa de una orden como se le dice al cliente (misma tabla que el
   reporte de trabajo en curso). */
const ETAPA_L: Record<string, string> = {
  recibida: 'por arrancar', analisis: 'en análisis', desarrollo: 'en desarrollo', pruebas: 'en pruebas',
  devuelta: 'en desarrollo', trabada: 'en desarrollo', espera: 'esperando al cliente', lista: 'lista para revisión',
};

/* `preseleccion`: órdenes del taller que llegan ya palomeadas (las abre el
   «Mandar en entregas» del renglón del taller). */
export default function ReporteEntregas({ companyId, cliente, onCerrar, preseleccion }: any) {
  const hoy = new Date();
  const [desde, setDesde] = useState(iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [hasta, setHasta] = useState(iso(hoy));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [rep, setRep] = useState<any>(null);
  /* POR MÓDULO. Un documento de doce entregas repartidas en cinco partes del
     sistema no contesta «¿cómo va lo del portal?». Los módulos no se piden a
     un endpoint nuevo: se sacan de las mismas mejoras que el reporte va a leer,
     así que lo que ofrece el filtro es exactamente lo que va a salir. */
  const [todas, setTodas] = useState<any[]>([]);
  const [modulos, setModulos] = useState<string[]>([]);   // vacío = todo

  /* LO DEL TALLER (dueño, 1-oct-2026): «que pueda mostrar esto en entregas y
     filtrar lo que quiero mandar». Las órdenes vivas de la cuenta entran a la
     ventana para que el cliente las revise y las ACEPTE en el mismo documento
     donde firma lo entregado. Se piden al mismo endpoint que la pestaña del
     taller, acotado a esta cuenta. */
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  /* Qué va en el documento. Lo entregado del periodo entra por defecto (se
     guarda lo que se QUITA); lo del taller no, salvo lo que ya está «lista»
     o llegó preseleccionado (se guarda lo que se AGREGA). Así, mover las fechas
     no desmarca nada que el consultor ya decidió. */
  const [fuera, setFuera] = useState<Set<string>>(new Set());
  const [dentro, setDentro] = useState<Set<string>>(new Set());

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    Promise.all([
      fetch('/api/crm/mejoras?company_id=' + companyId).then(r => r.json()).catch(() => null),
      fetch('/api/crm/taller?company_id=' + companyId).then(r => r.json()).catch(() => null),
    ]).then(([jm, jt]) => {
      if (!vivo) return;
      setTodas(jm?.data || []);
      const meta = jt?.meta || {};
      const vivas = (jt?.ordenes || [])
        .filter((o: any) => o.etapa !== 'entregada' && !o.archived_at && (!o.company_id || o.company_id === companyId))
        .map((o: any) => ({ ...o, modulo: o.modulo || meta[o.id]?.modulo || null }));
      setOrdenes(vivas);
      const pre = new Set<string>((preseleccion || []).map((x: string) => 'o:' + x));
      for (const o of vivas) if (o.etapa === 'lista') pre.add('o:' + o.id);
      setDentro(pre);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [companyId]);

  const enPeriodo = useMemo(() => (todas || []).filter((m: any) =>
    m.estado === 'entregada' && m.visible_cliente !== false && !m.archived_at &&
    String(m.fecha_entrega || '') >= desde && String(m.fecha_entrega || '') <= hasta), [todas, desde, hasta]);

  const porModulo = useMemo(() => {
    const a: Record<string, number> = {};
    for (const m of [...enPeriodo, ...ordenes]) a[m.modulo || 'Sin módulo'] = (a[m.modulo || 'Sin módulo'] || 0) + 1;
    return Object.entries(a).sort((x, y) => y[1] - x[1]);
  }, [enPeriodo, ordenes]);

  const enModulo = (m: any) => !modulos.length || modulos.includes(m.modulo || 'Sin módulo');
  const listaE = enPeriodo.filter(enModulo);
  const listaO = ordenes.filter(enModulo);
  const va = (k: string) => (k.startsWith('o:') ? dentro.has(k) : !fuera.has(k));
  const alternar = (k: string) => {
    if (k.startsWith('o:')) setDentro(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
    else setFuera(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  };
  const marcarTodo = (si: boolean) => {
    setFuera(si ? new Set() : new Set(listaE.map((m: any) => 'm:' + m.id)));
    setDentro(si ? new Set(listaO.map((o: any) => 'o:' + o.id)) : new Set());
  };
  const vanE = listaE.filter((m: any) => va('m:' + m.id));
  const vanO = listaO.filter((o: any) => va('o:' + o.id));
  const nVan = vanE.length + vanO.length;

  const toggleModulo = (k: string) =>
    setModulos(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));

  const liga = rep ? `${typeof window !== 'undefined' ? window.location.origin : ''}/reporte/${rep.id}` : '';
  const h = rep?.hechos;
  const preset = (d: Date, hs: Date) => { setDesde(iso(d)); setHasta(iso(hs)); };

  async function generar() {
    if (!nVan) { setError('Palomea al menos un renglón para mandar.'); return; }
    setBusy('generando'); setError(''); setAviso(''); setRep(null);
    const r = await fetch('/api/crm/reportes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId, desde, hasta, tipo: 'entregas', modulos,
        // Exactamente lo palomeado: el documento no agrega ni quita nada.
        seleccion: { mejoras: vanE.map((m: any) => m.id), ordenes: vanO.map((o: any) => o.id) },
      }),
    }).then(x => x.json()).catch(() => null);
    setBusy('');
    if (!r || r.error) { setError(r?.error || 'No se pudo generar.'); return; }
    setRep(r);
  }

  async function copiarLiga() {
    try { await navigator.clipboard.writeText(liga); setAviso('Liga copiada.'); }
    catch { setAviso(liga); }
  }

  async function enviar() {
    setBusy('enviando'); setAviso('');
    const r = await fetch('/api/crm/reportes/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rep.id }),
    }).then(x => x.json()).catch(() => null);
    setBusy('');
    if (!r || r.error) { setAviso(r?.error || 'No se pudo enviar.'); return; }
    setAviso(`Enviado a ${r.para}.`);
    setRep((p: any) => ({ ...p, enviado_a: r.para }));
  }

  const sinVideo = h ? Number(h.total || 0) - Number(h.con_video || 0) : 0;

  return (
    <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,32,.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Reporte de entregas" style={{
        background: '#fff', borderRadius: 14, width: 'min(760px, 100%)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 22px 54px rgba(20,15,50,.25)',
      }}>
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #f1eff7' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-.015em' }}>Reporte de entregas</div>
          <div style={{ fontSize: '0.76rem', color: '#8a8590', marginTop: 2 }}>
            {cliente} · lo entregado en el periodo y lo del taller listo para que el cliente lo revise, lo acepte y firme.
          </div>
        </div>

        <div style={{ padding: '12px 18px', display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #f6f5fa' }}>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={S.input} />
          <span style={{ color: '#a5a2af', fontSize: '0.75rem' }}>al</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={S.input} />
          <button style={S.btnG} onClick={() => preset(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), new Date(hoy.getFullYear(), hoy.getMonth(), 0))}>Mes pasado</button>
          <button style={S.btnG} onClick={() => preset(new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1), hoy)}>Trimestre</button>
          <button style={S.btnG} onClick={() => preset(new Date(hoy.getFullYear(), 0, 1), hoy)}>Este año</button>
          <button style={{ ...S.btn, marginLeft: 'auto' }} onClick={generar} disabled={!!busy}>
            {busy === 'generando' ? 'Generando…' : nVan ? `Generar con ${nVan}` : 'Generar'}
          </button>
        </div>

        {/* Los módulos del periodo. Solo se pintan si hay más de uno: con uno
            solo el filtro no puede cambiar nada. Nada marcado = todo. */}
        {porModulo.length > 1 && (
          <div style={{ padding: '10px 18px', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #f6f5fa' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c99a6', marginRight: 2 }}>Módulos</span>
            {porModulo.map(([k, n]) => {
              const on = modulos.includes(k);
              return (
                <button key={k} onClick={() => toggleModulo(k)}
                  style={{
                    border: on ? '1px solid #9B8CFA' : '1px solid #e9e3ee', background: on ? '#EEECFE' : '#fff',
                    color: on ? '#5B4BD6' : '#666', borderRadius: 9, padding: '4px 10px',
                    fontSize: '0.71rem', fontWeight: on ? 800 : 600, fontFamily: 'inherit', cursor: 'pointer',
                  }}>
                  {k} <span style={{ opacity: .7, fontWeight: 700 }}>{n}</span>
                </button>
              );
            })}
            <span style={{ fontSize: '0.69rem', color: '#a5a2af' }}>
              {modulos.length ? `solo ${modulos.length === 1 ? 'ese módulo' : 'esos ' + modulos.length}` : 'sin marcar nada sale todo'}
            </span>
            {modulos.length > 0 && (
              <button onClick={() => setModulos([])} style={{ border: 'none', background: 'none', color: '#8d8a97', fontSize: '0.71rem', fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}>quitar</button>
            )}
          </div>
        )}

        <div style={{ padding: '4px 18px 16px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ marginTop: 12, background: '#FEF0EF', border: '1px solid #f7c9c5', borderRadius: 8, padding: '9px 11px', fontSize: '0.77rem', color: '#C0554E', lineHeight: 1.5 }}>{error}</div>
          )}

          {!rep && busy !== 'generando' && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9c99a6' }}>Qué va en el reporte</span>
                <span style={{ fontSize: '0.72rem', color: '#5B4BD6', fontWeight: 700 }}>{nVan} de {listaE.length + listaO.length}</span>
                <button onClick={() => marcarTodo(true)} style={{ ...S.btnG, padding: '3px 9px', fontSize: '0.69rem', marginLeft: 'auto' }}>Todo</button>
                <button onClick={() => marcarTodo(false)} style={{ ...S.btnG, padding: '3px 9px', fontSize: '0.69rem' }}>Nada</button>
              </div>
              {cargando && <div style={{ padding: '18px 0', color: '#9c99a6', fontSize: '0.8rem' }}>Juntando lo entregado y lo del taller…</div>}

              {!cargando && (<>
                <div style={S.grupo}>Entregado en el periodo <span style={S.grupoC}>{listaE.length}</span></div>
                {!listaE.length && <div style={S.vacio}>Nada entregado entre esas fechas{modulos.length ? ' en esos módulos' : ''}.</div>}
                {listaE.map((m: any) => (
                  <Fila key={m.id} on={va('m:' + m.id)} onClick={() => alternar('m:' + m.id)}
                    chip={TIPO_L[m.categoria] || 'mejora'} titulo={m.titulo} modulo={m.modulo}
                    derecha={<>{m.cortesia && <span style={{ ...S.chip, background: '#EAF8F2', color: '#1E8A63' }}>sin costo</span>}
                      <span style={{ fontSize: '0.7rem', color: '#a5a2af' }}>{fmtDate(m.fecha_entrega)}</span></>} />
                ))}

                <div style={S.grupo}>Del taller · para revisión y aceptación <span style={S.grupoC}>{listaO.length}</span></div>
                {!listaO.length && <div style={S.vacio}>No hay órdenes vivas en el taller{modulos.length ? ' en esos módulos' : ''}.</div>}
                {listaO.map((o: any) => {
                  const tarde = o.fecha_prometida && o.fecha_prometida < iso(hoy);
                  return (
                    <Fila key={o.id} on={va('o:' + o.id)} onClick={() => alternar('o:' + o.id)}
                      chip={o.tipo === 'falla' ? 'falla' : 'mejora'} chipColor={o.tipo === 'falla' ? ['#FEF0EF', '#C0554E'] : null}
                      titulo={o.titulo} modulo={o.modulo} folio={o.folio}
                      derecha={<>
                        <span style={{ ...S.chip, background: o.etapa === 'lista' ? '#EAF8F2' : '#f4f3f7', color: o.etapa === 'lista' ? '#1E8A63' : '#77737f' }}>{ETAPA_L[o.etapa] || o.etapa}</span>
                        {o.fecha_prometida && <span style={{ fontSize: '0.7rem', color: tarde ? '#C0554E' : '#a5a2af', fontWeight: tarde ? 700 : 400 }}>{fmtDate(o.fecha_prometida)}</span>}
                      </>} />
                  );
                })}
                <div style={{ marginTop: 10, fontSize: '0.72rem', color: '#9c99a6', lineHeight: 1.55 }}>
                  Lo del taller sale en el documento como <b>«Para tu aceptación»</b>: el cliente lo marca como
                  revisado y aceptado y firma al final. Lo que esté «lista para revisión» ya viene palomeado.
                </div>
              </>)}
            </div>
          )}
          {busy === 'generando' && <div style={{ padding: '26px 0', color: '#9c99a6', fontSize: '0.85rem' }}>Juntando las entregas…</div>}

          {rep && h && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', paddingBottom: 12, borderBottom: '1px solid #f4f3f7' }}>
                <div><div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9c99a6' }}>Entregas</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E8A63' }}>{h.total}</div></div>
                <div><div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9c99a6' }}>Con video</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: h.con_video ? '#5B4BD6' : '#a5a2af' }}>{h.con_video}</div></div>
                <div><div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9c99a6' }}>Sin costo</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1E8A63' }}>{h.cortesias}</div></div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: '0.58rem', fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9c99a6' }}>Folio</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#5B4BD6', fontFamily: 'ui-monospace, monospace' }}>{rep.folio}</div></div>
              </div>

              {/* El aviso que de verdad cambia lo que haces: si faltan videos,
                  lo útil no es explicar nada, es decir dónde se pegan. */}
              {sinVideo > 0 && (
                <div style={{ marginTop: 12, background: '#FFF9EF', border: '1px solid #f3dfae', borderRadius: 9, padding: '9px 12px', fontSize: '0.77rem', color: '#7a5a10', lineHeight: 1.55 }}>
                  <b>{sinVideo === 1 ? 'Una entrega va sin video' : `${sinVideo} entregas van sin video`}.</b> Salen
                  igual en el documento, con la leyenda «sin video». Si quieres agregárselos, ábrelas en
                  <b> Editar</b>, pega la liga y vuelve a generar el reporte.
                </div>
              )}

              {h.internas > 0 && (
                <div style={{ marginTop: 8, fontSize: '0.73rem', color: '#a5a2af' }}>
                  {h.internas} entrega(s) marcadas como internas no van en el documento.
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                {(h.entregas || []).map((e: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 9, padding: '9px 0', borderBottom: '1px solid #f7f6fa', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, flex: 1, minWidth: 180, lineHeight: 1.4 }}>{e.titulo}</span>
                    <span style={{ ...S.chip, background: '#EEECFE', color: '#5B4BD6' }}>{TIPO_L[e.categoria] || 'mejora'}</span>
                    {e.cortesia && <span style={{ ...S.chip, background: '#EAF8F2', color: '#1E8A63' }}>sin costo</span>}
                    {e.por_aceptar && <span style={{ ...S.chip, background: '#FFF4E5', color: '#9a6a10' }}>para aceptación</span>}
                    <span style={{ fontSize: '0.7rem', color: '#a5a2af', whiteSpace: 'nowrap' }}>{fmtDate(e.fecha)}</span>
                    {e.video
                      ? <a href={e.video} target="_blank" rel="noreferrer" style={{ ...S.chip, background: '#EEECFE', color: '#5B4BD6', textDecoration: 'none' }}>▶ video</a>
                      : <span style={{ ...S.chip, background: '#FFF4E5', color: '#9a6a10' }}>sin video</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 18px 15px', borderTop: '1px solid #f1eff7', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {rep && (<>
            {/* La liga se enseña completa a propósito: se manda por WhatsApp
                tan seguido como por correo. */}
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: '#5B4BD6', background: '#EEECFE', borderRadius: 7, padding: '5px 9px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liga}</span>
            <button style={S.btnG} onClick={copiarLiga}>Copiar liga</button>
            <a style={{ ...S.btnG, textDecoration: 'none', display: 'inline-block' }} href={liga} target="_blank" rel="noreferrer">Verlo como el cliente</a>
            <button style={S.btn} onClick={enviar} disabled={!!busy}>
              {busy === 'enviando' ? 'Enviando…' : rep.enviado_a ? 'Volver a enviar' : 'Enviar por correo'}
            </button>
          </>)}
          {aviso && <span style={{ fontSize: '0.73rem', color: '#1E8A63', fontWeight: 600 }}>{aviso}</span>}
          <button style={{ ...S.btnG, marginLeft: 'auto' }} onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
