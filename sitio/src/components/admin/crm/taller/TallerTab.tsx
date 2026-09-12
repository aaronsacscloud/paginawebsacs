// El Taller — donde consultoría y desarrollo trabajan la misma lista.
//
// Dos puertas al mismo dato, porque son dos trabajos distintos:
//   · BANDEJA (la tuya): lo único que te toca decidir —lo que ya resolvieron y
//     espera tu OK— y lo que se rompió. Nada más.
//   · LISTA (la de desarrollo): una cola densa agrupada por urgencia, no por
//     etapa. Un tablero de columnas se cayó en la revisión: con un equipo chico
//     no hay a quién repartir, y siete columnas esconden justo lo que se pudre.
//
// Lo que vive aquí es INTERNO: fechas prometidas, rebotes, motivos, SLA, quién
// tardó. Al cliente solo le cruza, desde la ficha, que su mejora se hizo — con
// su fecha y su video.
import { useEffect, useState, useCallback } from 'react';
import Cargando from '../ui/Cargando';
import { confirmar } from '../../../../lib/ui/confirmar';
import { P } from '../../../../lib/crm/paleta';

const ETAPAS: Record<string, string> = {
  recibida: 'Recibida', analisis: 'En análisis', desarrollo: 'En desarrollo',
  pruebas: 'En pruebas', lista: 'Lista para entregar', entregada: 'Entregada',
  devuelta: 'Devuelta', espera: 'Esperando al cliente', trabada: 'Trabada',
};
const MOTIVOS: Record<string, string> = {
  no_resuelve: 'No resuelve', rompe_otra: 'Rompe otra cosa', falta_video: 'Falta el video',
  incompleta: 'Quedó incompleta', mal_entendida: 'Se entendió mal',
};
const COLOR_T: Record<string, string> = { falla: P.rojo, mejora: P.violeta };
const CHIP_T: Record<string, any> = {
  falla: { background: P.rojoAgua, color: P.rojoTinta },
  mejora: { background: P.violetaAgua, color: P.violetaTinta },
};

const hoyISO = () => new Date().toISOString().slice(0, 10);
const dias = (iso?: string | null) => iso == null ? null : Math.floor((Date.now() - Date.parse(iso)) / 86400000);
const diasHasta = (fecha?: string | null) => fecha == null ? null
  : Math.round((Date.parse(fecha + 'T12:00:00') - Date.parse(hoyISO() + 'T12:00:00')) / 86400000);
const fmt = (d?: string | null) => d
  ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }).replace(/\./g, '')
  : '';
const cuentaDe = (o: any) => o?.companies?.nombre_comercial || o?.companies?.nombre || 'Sin cuenta';
const viva = (o: any) => o.etapa !== 'entregada';
const vencida = (o: any) => viva(o) && !!o.fecha_prometida && o.fecha_prometida < hoyISO() && o.etapa !== 'espera';

const S = {
  btn: { padding: '6px 12px', border: 'none', borderRadius: 9, fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', background: P.violeta, color: '#fff', fontFamily: 'inherit' } as const,
  btnSec: { padding: '6px 12px', border: `1.5px solid ${P.violeta}`, borderRadius: 9, fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', background: '#fff', color: P.violetaTinta, fontFamily: 'inherit' } as const,
  btnG: { padding: '6px 11px', border: '1px solid #ddd', borderRadius: 9, fontSize: '0.73rem', fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#4a4a52', fontFamily: 'inherit' } as const,
  btnVerde: { padding: '6px 12px', border: 'none', borderRadius: 9, fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', background: P.verdeTinta, color: '#fff', fontFamily: 'inherit' } as const,
  btnAmbar: { padding: '6px 12px', border: '1.5px solid #f0d3a0', borderRadius: 9, fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', background: '#fff', color: P.ambarTinta, fontFamily: 'inherit' } as const,
  input: { padding: '8px 11px', border: '1.5px solid #e4dffb', borderRadius: 9, fontSize: '0.8rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const, background: '#fdfcff', fontFamily: 'inherit' } as const,
  lbl: { fontSize: '0.6rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: '#a5a2af', marginBottom: 4, display: 'block' } as const,
  caja: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '13px 15px' } as const,
  secT: { fontSize: '0.6rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: '#a5a2af', margin: '16px 0 3px', display: 'flex', alignItems: 'center', gap: 7 } as const,
};

export default function TallerTab() {
  const [cargando, setCargando] = useState(true);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [equipo, setEquipo] = useState<any[]>([]);
  const [sinOrden, setSinOrden] = useState<any[]>([]);
  const [yo, setYo] = useState<any>(null);
  const [vista, setVista] = useState<'bandeja' | 'lista'>('bandeja');
  const [tab, setTab] = useState<'mias' | 'todo' | 'trabadas'>('mias');
  const [abierta, setAbierta] = useState<string>('');
  const [aviso, setAviso] = useState('');
  const [filtro, setFiltro] = useState('');

  const cargar = useCallback(async () => {
    const j = await fetch('/api/crm/taller').then(r => r.json()).catch(() => null);
    if (j && !j.error) { setOrdenes(j.ordenes || []); setEquipo(j.equipo || []); setSinOrden(j.sinOrden || []); setYo(j.yo || null); }
    setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const flash = (t: string) => { setAviso(t); setTimeout(() => setAviso(''), 3200); };

  async function api(body: any, metodo = 'PUT') {
    const j = await fetch('/api/crm/taller', {
      method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(r => r.json()).catch(() => null);
    if (!j || j.error) { flash(j?.error || 'No se pudo guardar'); return null; }
    await cargar();
    return j;
  }

  /* Traer lo que ya está comprometido con el cliente. Sin esto el taller nace
     vacío el primer día y nadie lo vuelve a abrir. */
  async function importar() {
    if (!await confirmar(`Traer ${sinOrden.length} cosas comprometidas al taller`, {
      accion: 'Traerlas', detalle: 'Se crea una orden por cada una, en «Recibida». No se les avisa a los clientes.',
    })) return;
    const j = await api({ accion: 'importar', mejora_ids: sinOrden.map((m: any) => m.id) }, 'POST');
    if (j) flash(`${j.creadas} órdenes creadas`);
  }

  if (cargando) return <Cargando texto="Cargando el taller…" />;

  const vivas = ordenes.filter(viva);
  const esperanOK = vivas.filter(o => o.etapa === 'lista');
  const roto = vivas.filter(o => vencida(o) || o.etapa === 'trabada' || (o.rebotes >= 2 && o.etapa === 'devuelta')
    || (o.etapa === 'espera' && (dias(o.espera_desde) ?? 0) >= 7)
    || (o.tipo === 'falla' && o.prioridad === 'alta' && !o.fecha_prometida && (dias(o.created_at) ?? 0) >= 1));
  const revisionTarde = esperanOK.filter(o => o.revision_vence && o.revision_vence < hoyISO());

  return (
    <div style={{ paddingTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-.02em' }}>Taller</h2>
        <span style={{ fontSize: '0.78rem', color: '#8d8a97' }}>
          {vivas.length} {vivas.length === 1 ? 'orden viva' : 'órdenes vivas'}
          {esperanOK.length ? ` · ${esperanOK.length} esperan tu OK` : ''}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {sinOrden.length > 0 && (
            <button style={S.btnSec} onClick={importar}>Traer del CRM · {sinOrden.length}</button>
          )}
          <button style={vista === 'bandeja' ? S.btn : S.btnG} onClick={() => setVista('bandeja')}>Mi bandeja</button>
          <button style={vista === 'lista' ? S.btn : S.btnG} onClick={() => setVista('lista')}>Lista del taller</button>
        </div>
      </div>

      {aviso && (
        <div style={{ background: P.ambarAgua, border: '1px solid #f2ddb8', borderRadius: 10, padding: '9px 13px', fontSize: '0.8rem', color: P.ambarTinta, marginBottom: 12 }}>{aviso}</div>
      )}

      {vista === 'bandeja'
        ? <Bandeja ordenes={ordenes} vivas={vivas} esperanOK={esperanOK} roto={roto} revisionTarde={revisionTarde}
            abrir={setAbierta} api={api} flash={flash} />
        : <Lista ordenes={vivas} yo={yo} equipo={equipo} tab={tab} setTab={setTab} abrir={setAbierta}
            filtro={filtro} setFiltro={setFiltro} />}

      {abierta && <PanelOrden id={abierta} equipo={equipo} onCerrar={() => setAbierta('')} api={api} flash={flash} />}
    </div>
  );
}

/* ═══════════════════ La bandeja del dueño ═══════════════════
   Tres bloques y una regla: solo el primero tiene botones. Lo demás es para
   enterarse, no para trabajar —eso es la otra pantalla—. */
function Bandeja({ ordenes, vivas, esperanOK, roto, revisionTarde, abrir, api, flash }: any) {
  const [revisando, setRevisando] = useState<any>(null);

  const bloquean = vivas.filter((o: any) => o.tipo === 'falla' && o.prioridad === 'alta').length;
  const entregadas = ordenes.filter((o: any) => o.etapa === 'entregada');
  // Se mide contra la PRIMERA fecha: contra la ya recorrida siempre da 100%.
  const conFecha = entregadas.filter((o: any) => o.fecha_prometida_1 && o.entregada_at);
  const aTiempo = conFecha.filter((o: any) => String(o.entregada_at).slice(0, 10) <= o.fecha_prometida_1);
  const revisiones = entregadas.filter((o: any) => o.dias_revision != null);
  const edad = vivas.length
    ? Math.round(vivas.map((o: any) => dias(o.created_at) || 0).sort((a: number, b: number) => a - b)[Math.floor(vivas.length / 2)])
    : 0;
  const masVieja = vivas.length ? Math.max(...vivas.map((o: any) => dias(o.created_at) || 0)) : 0;

  const porCuenta: Record<string, any> = {};
  vivas.forEach((o: any) => {
    const k = cuentaDe(o);
    porCuenta[k] = porCuenta[k] || { f: 0, m: 0, mal: 0 };
    porCuenta[k][o.tipo === 'falla' ? 'f' : 'm']++;
    if (vencida(o)) porCuenta[k].mal++;
  });

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 13 }}>
        {[
          [String(vivas.length), 'órdenes abiertas', '#1a1a1a', P.violeta],
          [String(bloquean), 'bloquean la operación', bloquean ? P.rojoTinta : '#1a1a1a', P.rojo],
          [String(esperanOK.length), 'esperan tu OK' + (revisionTarde.length ? ` · ${revisionTarde.length} se te pasó` : ''), P.violetaTinta, P.violeta],
          [String(roto.length), 'rompieron el trato', roto.length ? P.rojoTinta : '#1a1a1a', P.rojo],
        ].map(([v, l, col, franja]: any) => (
          <div key={l} style={{ background: '#fff', border: '1px solid #eeeef1', borderLeft: `3px solid ${franja}`, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-.03em', color: col, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
            <div style={{ fontSize: '0.67rem', color: '#8a8a8a', marginTop: 2, lineHeight: 1.35 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* 1 · Lo único con acción */}
      <div style={{ border: `1.5px solid ${P.violetaBorde}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ padding: '11px 14px', background: `linear-gradient(135deg,${P.violetaAgua},rgba(244,168,205,.14))`, fontSize: '0.79rem', fontWeight: 800, color: P.violetaTinta, display: 'flex', gap: 9 }}>
          Esperando tu OK
          <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.7rem', color: '#8d8a97' }}>
            {esperanOK.length ? `${esperanOK.length} · es lo único con acción` : 'nada pendiente'}
          </span>
        </div>
        {esperanOK.length === 0 && (
          <div style={{ padding: '16px 14px', fontSize: '0.82rem', color: '#999', background: '#fff' }}>
            Nada espera tu OK. {vivas.length} abiertas, la más vieja lleva {masVieja} días.
          </div>
        )}
        {esperanOK.map((o: any) => {
          const quedan = diasHasta(o.revision_vence);
          return (
            <div key={o.id} style={{ padding: '12px 14px', borderTop: '1px solid #f5f4f8', background: '#fff', display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => abrir(o.id)}>{o.titulo}</div>
                <div style={{ fontSize: '0.71rem', color: '#8d8a97', marginTop: 3 }}>
                  {cuentaDe(o)} · {o.folio} · {o.tipo} · entregó {o.team_members?.nombre || 'desarrollo'} el {fmt(o.lista_at)}
                  {o.rebotes > 0 && <b style={{ color: P.ambarTinta }}> · {o.rebotes + 1}º intento</b>}
                </div>
                {quedan != null && (
                  <div style={{ fontSize: '0.71rem', marginTop: 4 }}>
                    {quedan >= 0
                      ? <b style={{ color: quedan <= 1 ? P.ambarTinta : P.verdeTinta }}>Te quedan {quedan} día{quedan === 1 ? '' : 's'} para revisar</b>
                      : <b style={{ color: P.rojoTinta }}>Se te pasó por {Math.abs(quedan)} día{Math.abs(quedan) === 1 ? '' : 's'}</b>}
                    <span style={{ color: '#a5a2af' }}> · pidieron {o.dias_revision} días de revisión</span>
                  </div>
                )}
                {(o.video_url || o.verificacion) && (
                  <div style={{ border: '1px solid #e6e3ef', borderRadius: 9, padding: '7px 10px', background: '#faf9fd', fontSize: '0.75rem', marginTop: 8 }}>
                    {o.video_url
                      ? <a href={o.video_url} target="_blank" rel="noreferrer" style={{ color: P.verdeTinta, fontWeight: 700 }}>▶ Ver el video de entrega</a>
                      : <span><b>Cómo verificarlo:</b> {o.verificacion}</span>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <button style={S.btnVerde} onClick={async () => {
                  if (!await confirmar(`Aprobar «${o.titulo}»`, { accion: 'Aprobar', detalle: 'Se cierra en la ficha del cliente con su fecha y su video, y entra al reporte de entregas.' })) return;
                  const j = await api({ accion: 'revisar', id: o.id, veredicto: 'aprobada' }, 'POST');
                  if (j) flash('Aprobada y entregada al cliente');
                }}>Aprobar</button>
                <button style={S.btnAmbar} onClick={() => setRevisando(o)}>Pedir cambios</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2 · Lo que se rompió, incluido lo tuyo */}
      <div style={{ border: '1px solid #f7c9c5', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ padding: '11px 14px', background: P.rojoAgua, fontSize: '0.79rem', fontWeight: 800, color: P.rojoTinta, display: 'flex', gap: 9 }}>
          Se rompió el trato
          <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.7rem', color: '#a07a76' }}>{roto.length + revisionTarde.length}</span>
        </div>
        {roto.length + revisionTarde.length === 0 && (
          <div style={{ padding: '14px', fontSize: '0.82rem', color: '#999', background: '#fff' }}>Nada fuera de tiempo. Así se ve cuando todo va al día.</div>
        )}
        {roto.map((o: any) => {
          const por = o.etapa === 'trabada' ? `trabada · ${o.rebotes} rebotes`
            : o.etapa === 'espera' ? `esperando al cliente · ${dias(o.espera_desde)} d`
            : o.rebotes >= 2 ? `${o.rebotes}º rebote`
            : !o.fecha_prometida ? `falla que bloquea · ${dias(o.created_at)} d sin fecha`
            : `prometida el ${fmt(o.fecha_prometida)} · ${Math.abs(diasHasta(o.fecha_prometida) || 0)} d tarde`;
          return (
            <div key={o.id} onClick={() => abrir(o.id)} style={{ padding: '9px 14px', borderTop: '1px solid #f7f6fa', background: '#fff', display: 'flex', gap: 9, alignItems: 'center', fontSize: '0.78rem', cursor: 'pointer', flexWrap: 'wrap' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: COLOR_T[o.tipo], flex: 'none' }} />
              <b>{cuentaDe(o)}</b> · <span style={{ flex: 1, minWidth: 140 }}>{o.titulo}</span>
              <span style={{ fontSize: '0.71rem', color: '#a5a2af' }}>{por}</span>
            </div>
          );
        })}
        {/* Lo tuyo se ve igual que lo de ellos: un tablero que mide a una sola
            parte se vuelve un arma y deja de usarse. */}
        {revisionTarde.map((o: any) => (
          <div key={'r' + o.id} onClick={() => abrir(o.id)} style={{ padding: '9px 14px', borderTop: '1px solid #f7f6fa', background: '#fff', display: 'flex', gap: 9, alignItems: 'center', fontSize: '0.78rem', cursor: 'pointer', flexWrap: 'wrap' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: P.violeta, flex: 'none' }} />
            <b>{cuentaDe(o)}</b> · <span style={{ flex: 1, minWidth: 140 }}>{o.titulo}</span>
            <span style={{ fontSize: '0.71rem', color: P.rojoTinta, fontWeight: 700 }}>
              lo tuyo: la revisión se te pasó {Math.abs(diasHasta(o.revision_vence) || 0)} d
            </span>
          </div>
        ))}
      </div>

      {/* 3 · Las tres métricas. Dos salen en blanco a propósito hasta que haya
          historia: un número inventado el primer día es peor que un guion. */}
      <div style={S.secT}>Cómo va el taller · el reloj corre para los dos</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
        {[
          [vivas.length ? `${edad} d` : '—', `edad de la cola${masVieja ? ` · la más vieja, ${masVieja} d` : ''}`, P.rojoTinta],
          [conFecha.length >= 3 ? `${Math.round(aTiempo.length / conFecha.length * 100)}%` : '—',
            conFecha.length >= 3 ? `Ellos: entregaron en su fecha (${aTiempo.length} de ${conFecha.length})` : 'Ellos: entregaron en su fecha · faltan entregas para medir', P.verdeTinta],
          [revisiones.length >= 3 ? `${Math.round(revisiones.filter((o: any) => (o.dias_revision || 3) >= 0).length / revisiones.length * 100)}%` : '—',
            revisiones.length >= 3 ? 'Tú: revisaste dentro de la ventana' : 'Tú: revisaste dentro de la ventana · faltan revisiones para medir', P.violetaTinta],
        ].map(([v, l, col]: any) => (
          <div key={l} style={S.caja}>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-.03em', color: v === '—' ? '#b9b6c2' : col, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
            <div style={{ fontSize: '0.68rem', color: '#8a8a8a', marginTop: 3, lineHeight: 1.4 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={S.secT}>Por cuenta</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 9 }}>
        {Object.keys(porCuenta).length === 0 && <div style={{ fontSize: '0.82rem', color: '#999' }}>Todavía no hay órdenes en el taller.</div>}
        {Object.entries(porCuenta).map(([k, v]: any) => {
          const tot = v.f + v.m;
          return (
            <div key={k} style={S.caja}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{k}</div>
              <div style={{ fontSize: '0.68rem', color: '#8a8a8a', marginTop: 2 }}>
                {tot} {tot === 1 ? 'abierta' : 'abiertas'} · {v.f} {v.f === 1 ? 'falla' : 'fallas'} · {v.m} {v.m === 1 ? 'mejora' : 'mejoras'}
                {v.mal > 0 && <b style={{ color: P.rojoTinta }}> · {v.mal} fuera de tiempo</b>}
              </div>
              <div style={{ display: 'flex', height: 5, borderRadius: 99, overflow: 'hidden', marginTop: 7, background: '#f2f0f7' }}>
                <span style={{ width: `${v.f / tot * 100}%`, background: P.rojo }} />
                <span style={{ width: `${v.m / tot * 100}%`, background: P.violeta }} />
              </div>
            </div>
          );
        })}
      </div>

      {revisando && <ModalCambios orden={revisando} onCerrar={() => setRevisando(null)} api={api} flash={flash} />}
    </div>
  );
}

/* Pedir cambios sin motivo no sirve: en texto libre no se puede contar cuál se
   repite, y ese conteo es el que dice si el problema es cómo se pide o cómo se
   entrega. */
function ModalCambios({ orden, onCerrar, api, flash }: any) {
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [yendo, setYendo] = useState(false);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 970, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 440, maxWidth: '100%', boxShadow: '0 22px 54px rgba(16,24,40,.24)' }}>
        <div style={{ padding: '14px 17px', background: '#faf8ff', borderBottom: '1px solid #e6ddfa', fontSize: '0.95rem', fontWeight: 800 }}>Pedir cambios</div>
        <div style={{ padding: '14px 17px' }}>
          <div style={{ fontSize: '0.8rem', color: '#55505f', marginBottom: 11 }}>{orden.titulo}</div>
          <span style={S.lbl}>¿Por qué la devuelves?</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 11 }}>
            {Object.entries(MOTIVOS).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setMotivo(k)}
                style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', borderRadius: 9, padding: '8px 11px', fontSize: '0.8rem',
                  border: `1px solid ${motivo === k ? P.violeta : '#e6e3ef'}`, background: motivo === k ? P.violetaAgua : '#fff', color: motivo === k ? P.violetaTinta : '#3f3c4a', fontWeight: motivo === k ? 700 : 500 }}>
                {l}
              </button>
            ))}
          </div>
          <span style={S.lbl}>Qué le falta (opcional)</span>
          <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3} style={{ ...S.input, resize: 'vertical' }}
            placeholder="Resuelve el caso nuevo, pero no recupera la plantilla que ya se había perdido." />
          <div style={{ display: 'flex', gap: 8, marginTop: 13 }}>
            <button disabled={!motivo || yendo} style={{ ...S.btn, opacity: !motivo || yendo ? .5 : 1 }}
              onClick={async () => {
                setYendo(true);
                const j = await api({ accion: 'revisar', id: orden.id, veredicto: 'cambios', motivo, nota }, 'POST');
                setYendo(false);
                if (j) { flash(j.etapa === 'trabada' ? 'Devuelta · va por su tercer rebote, queda trabada' : 'Devuelta a desarrollo'); onCerrar(); }
              }}>Devolverla</button>
            <button style={S.btnG} onClick={onCerrar}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ La lista de desarrollo ═══════════════════
   Agrupada por lo que toca hacer, no por etapa alfabética. El orden de los
   grupos ES la prioridad. */
function Lista({ ordenes, yo, equipo, tab, setTab, abrir, filtro, setFiltro }: any) {
  const q = filtro.trim().toLowerCase();
  const base = q
    ? ordenes.filter((o: any) => (o.titulo + ' ' + cuentaDe(o) + ' ' + (o.folio || '')).toLowerCase().includes(q))
    : ordenes;
  const mias = base.filter((o: any) => o.asignado_id === yo?.id);
  const trabadas = base.filter((o: any) => o.etapa === 'trabada');

  const sinDueno = base.filter((o: any) => !o.asignado_id).length;
  const sinFecha = base.filter((o: any) => o.tipo === 'falla' && o.prioridad === 'alta' && !o.fecha_prometida).length;
  const tarde = base.filter(vencida).length;
  const devueltas = base.filter((o: any) => o.etapa === 'devuelta').length;
  const esperando = base.filter((o: any) => o.etapa === 'espera').length;

  const lista = tab === 'mias' ? mias : tab === 'trabadas' ? trabadas : base;
  const grupos = tab === 'todo'
    ? Object.entries(lista.reduce((a: any, o: any) => { const k = cuentaDe(o); (a[k] = a[k] || []).push(o); return a; }, {}))
        .map(([l, filas]: any) => ({ l, filas }))
    : [
        { l: 'Devueltas · antes que nada', filas: lista.filter((o: any) => o.etapa === 'devuelta') },
        { l: 'Atrasadas y de hoy', filas: lista.filter((o: any) => o.etapa !== 'devuelta' && (vencida(o) || diasHasta(o.fecha_prometida) === 0)) },
        { l: 'En desarrollo', filas: lista.filter((o: any) => o.etapa === 'desarrollo' && !vencida(o) && diasHasta(o.fecha_prometida) !== 0) },
        { l: 'En pruebas', filas: lista.filter((o: any) => o.etapa === 'pruebas') },
        { l: 'Entregadas, esperando el OK', filas: lista.filter((o: any) => o.etapa === 'lista') },
        { l: 'Sin fecha · ponles fecha', filas: lista.filter((o: any) => ['recibida', 'analisis'].includes(o.etapa)) },
        { l: 'Esperando al cliente · el reloj está detenido', filas: lista.filter((o: any) => o.etapa === 'espera') },
        { l: 'Trabadas', filas: lista.filter((o: any) => o.etapa === 'trabada') },
      ].filter(g => g.filas.length);

  return (
    <div>
      <div style={{ display: 'flex', border: '1px solid #ececec', background: '#fff', borderRadius: 10, overflow: 'hidden', marginBottom: 12, flexWrap: 'wrap' }}>
        {[[sinDueno, 'sin dueño', P.rojoTinta], [sinFecha, 'falla sin fecha', P.ambarTinta], [tarde, 'pasaron su fecha', P.rojoTinta],
          [devueltas, 'devueltas', '#1a1a1a'], [esperando, 'esperando al cliente', '#8d8a97']].map(([v, l, c]: any) => (
          <div key={l} style={{ flex: 1, minWidth: 115, padding: '9px 12px', borderRight: '1px solid #f2f0f6' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: v ? c : '#c9c7d0', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
            <div style={{ fontSize: '0.65rem', color: '#8a8a8a' }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 4, alignItems: 'center' }}>
        {[['mias', `Mis órdenes · ${mias.length}`], ['todo', `Todo el taller · ${base.length}`], ['trabadas', `Trabadas · ${trabadas.length}`]].map(([k, l]: any) => (
          <button key={k} style={tab === k ? S.btn : S.btnG} onClick={() => setTab(k)}>{l}</button>
        ))}
        <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar por cuenta, folio o texto…"
          style={{ ...S.input, width: 260, marginLeft: 'auto', padding: '6px 11px' }} />
      </div>

      {grupos.length === 0 && (
        <div style={{ ...S.caja, marginTop: 12, color: '#999', fontSize: '0.85rem' }}>
          {tab === 'mias' ? 'No tienes órdenes asignadas.' : tab === 'trabadas' ? 'Nada trabado. Aquí caen las que van por su tercer rebote.' : 'El taller está vacío. Usa «Traer del CRM» para bajar lo que ya está comprometido.'}
        </div>
      )}
      {grupos.map((g: any) => (
        <div key={g.l}>
          <div style={S.secT}>{g.l} <span style={{ background: '#f1eff6', borderRadius: 99, padding: '1px 7px', color: '#77738a' }}>{g.filas.length}</span></div>
          {g.filas.map((o: any) => <Renglon key={o.id} o={o} abrir={abrir} />)}
        </div>
      ))}
    </div>
  );
}

/* El renglón. Color en DOS ejes nada más: el tipo (la barra) y la temperatura
   del tiempo (la fecha). Todo lo demás en gris, o deja de leerse de un vistazo. */
function Renglon({ o, abrir }: any) {
  const q = diasHasta(o.fecha_prometida);
  const fecha = o.etapa === 'espera' ? <span style={{ color: '#8d8a97' }}>en pausa</span>
    : o.falta_dato ? <span style={{ color: P.ambarTinta, fontWeight: 700 }}>falta un dato</span>
    : !o.fecha_prometida ? <span style={{ color: P.ambarTinta, fontWeight: 700 }}>sin fecha</span>
    : q != null && q < 0 ? <span style={{ color: P.rojoTinta, fontWeight: 700 }}>{fmt(o.fecha_prometida)}</span>
    : q != null && q <= 1 ? <span style={{ color: P.ambarTinta, fontWeight: 700 }}>{fmt(o.fecha_prometida)}</span>
    : <span style={{ color: '#55505f' }}>{fmt(o.fecha_prometida)}</span>;

  return (
    <div onClick={() => abrir(o.id)} style={{
      display: 'flex', alignItems: 'center', gap: 9, borderTop: '1px solid #f3f1f7',
      minHeight: 44, background: '#fff', cursor: 'pointer', paddingRight: 10,
      opacity: o.etapa === 'espera' ? .62 : 1,
    }}>
      <span style={{ width: 4, alignSelf: 'stretch', flex: 'none', borderRadius: '0 3px 3px 0', background: o.etapa === 'espera' ? '#d8d5e0' : COLOR_T[o.tipo] }} />
      <span style={{ ...CHIP_T[o.tipo], flex: 'none', width: 58, fontSize: '0.55rem', fontWeight: 800, textAlign: 'center', borderRadius: 5, padding: '2px 0', letterSpacing: '.04em' }}>
        {o.tipo.toUpperCase()}
      </span>
      <span style={{ flex: 'none', width: 112, fontSize: '0.73rem', fontWeight: 600, color: '#55505f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cuentaDe(o)}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: '0.81rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.titulo}</span>
      {o.tipo === 'falla' && o.prioridad === 'alta' && <span style={{ flex: 'none', fontSize: '0.68rem', fontWeight: 800, color: P.rojoTinta }}>bloquea</span>}
      {o.rebotes > 0 && <span style={{ flex: 'none', fontSize: '0.68rem', fontWeight: 800, color: o.rebotes >= 3 ? P.rojoTinta : P.ambarTinta }}>↩{o.rebotes}</span>}
      <span style={{ flex: 'none', width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '0.55rem', fontWeight: 800,
        background: o.asignado_id ? P.violetaAgua : '#fff', color: o.asignado_id ? P.violetaTinta : P.ambarTinta,
        border: o.asignado_id ? 'none' : '1.5px dashed #e0b869' }}>
        {o.team_members?.nombre ? o.team_members.nombre.split(' ').map((x: string) => x[0]).slice(0, 2).join('') : '+'}
      </span>
      <span style={{ flex: 'none', width: 62, textAlign: 'right', fontSize: '0.71rem', fontVariantNumeric: 'tabular-nums' }}>{fecha}</span>
      <span style={{ flex: 'none', width: 38, textAlign: 'right', fontSize: '0.69rem', color: '#a5a2af', fontVariantNumeric: 'tabular-nums' }}>{dias(o.created_at)} d</span>
    </div>
  );
}

/* ═══════════════════ La orden por dentro ═══════════════════ */
function PanelOrden({ id, equipo, onCerrar, api, flash }: any) {
  const [d, setD] = useState<any>(null);
  const [texto, setTexto] = useState('');
  const [edit, setEdit] = useState<any>({});
  const [guardando, setGuardando] = useState(false);

  const traer = useCallback(async () => {
    const j = await fetch('/api/crm/taller?id=' + id).then(r => r.json()).catch(() => null);
    if (j && !j.error) { setD(j); setEdit({}); }
  }, [id]);
  useEffect(() => { traer(); }, [traer]);

  if (!d) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 960, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ background: '#fff', width: 720, maxWidth: '100%', padding: 30 }}><Cargando texto="Abriendo la orden…" /></div>
      </div>
    );
  }
  const o = d.orden;
  const v = (k: string) => (k in edit ? edit[k] : o[k]) ?? '';
  const set = (k: string, val: any) => setEdit((p: any) => ({ ...p, [k]: val }));
  const sucio = Object.keys(edit).length > 0;

  async function guarda(extra: any = {}) {
    setGuardando(true);
    const j = await api({ id: o.id, ...edit, ...extra });
    setGuardando(false);
    if (j) { await traer(); return true; }
    return false;
  }
  async function mover(etapa: string) {
    const ok = await guarda({ etapa });
    if (ok) flash(`Pasó a ${ETAPAS[etapa].toLowerCase()}`);
  }

  const quedan = diasHasta(o.revision_vence);
  const SIGUIENTE: Record<string, string[]> = {
    recibida: ['analisis', 'espera'], analisis: ['desarrollo', 'espera'], desarrollo: ['pruebas', 'lista', 'espera'],
    pruebas: ['lista', 'desarrollo'], lista: [], devuelta: ['desarrollo'], espera: ['analisis', 'desarrollo'],
    trabada: ['desarrollo'], entregada: [],
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 960, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ background: '#fbfafd', width: 760, maxWidth: '100%', height: '100%', overflowY: 'auto', boxShadow: '-16px 0 44px rgba(16,24,40,.18)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#faf8ff', borderBottom: '1px solid #e6ddfa', padding: '13px 18px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ fontSize: '0.95rem' }}>{o.folio}</b>
          <span style={{ fontSize: '0.76rem', color: '#8d8a97' }}>{cuentaDe(o)} · {ETAPAS[o.etapa]}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
            {sucio && <button style={{ ...S.btn, opacity: guardando ? .6 : 1 }} disabled={guardando} onClick={() => guarda().then(ok => ok && flash('Guardado'))}>Guardar cambios</button>}
            <button style={S.btnG} onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 13 }}>
          <div>
            <div style={S.caja}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
                <span style={{ ...CHIP_T[o.tipo], fontSize: '0.58rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px' }}>{o.tipo.toUpperCase()}</span>
                {o.prioridad === 'alta' && <span style={{ background: P.rojoAgua, color: P.rojoTinta, fontSize: '0.58rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px' }}>bloquea la operación</span>}
                {o.modulo && <span style={{ background: '#f6f5f9', color: '#6b6b74', fontSize: '0.58rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px' }}>{o.modulo}</span>}
                {o.cobro && <span style={{ background: o.cobro === 'cortesia' ? P.verdeAgua : P.azulAgua, color: o.cobro === 'cortesia' ? P.verdeTinta : P.azulTinta, fontSize: '0.58rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px' }}>{o.cobro}</span>}
                {d.mejoras.length > 1 && <span style={{ background: P.violetaAgua, color: P.violetaTinta, fontSize: '0.58rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px' }}>{d.mejoras.length} cuentas afectadas</span>}
              </div>
              <input value={v('titulo')} onChange={e => set('titulo', e.target.value)} style={{ ...S.input, fontSize: '0.95rem', fontWeight: 700, border: '1.5px solid transparent', background: 'transparent', padding: '2px 0' }} />
              {[['problema', 'Qué pasa hoy'], ['esperado', 'Qué debería pasar'], ['pasos', 'Cómo reproducirlo'], ['criterios', 'Con qué se da por buena']].map(([k, l]) => (
                <div key={k} style={{ marginTop: 11 }}>
                  <span style={S.lbl}>{l}</span>
                  <textarea value={v(k)} onChange={e => set(k, e.target.value)} rows={2} style={{ ...S.input, resize: 'vertical' }} placeholder="—" />
                </div>
              ))}
            </div>

            {/* Lo técnico no se pide en la junta: se completa después, y mientras
                falte algo el reloj no corre. */}
            <div style={{ ...S.caja, marginTop: 12 }}>
              <span style={S.lbl}>Datos para desarrollo · se completan después</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['entorno', 'Entorno y versión'], ['sucursal', 'Sucursal'], ['usuario_caso', 'Usuario y rol'], ['dato_caso', 'Folio o pieza del caso']].map(([k, l]) => (
                  <div key={k}><span style={S.lbl}>{l}</span>
                    <input value={v(k)} onChange={e => set(k, e.target.value)} style={S.input} placeholder="—" /></div>
                ))}
              </div>
              {o.falta_dato && (
                <div style={{ background: P.ambarAgua, border: '1px solid #f2ddb8', borderRadius: 9, padding: '9px 11px', fontSize: '0.76rem', color: P.ambarTinta, marginTop: 10 }}>
                  <b>Desarrollo pidió un dato</b> hace {dias(o.falta_dato_at)} d: {o.falta_dato}
                  <div style={{ marginTop: 7 }}>
                    <button style={S.btnG} onClick={() => guarda({ falta_dato: '' }).then(ok => ok && flash('Listo, el reloj vuelve a correr'))}>Ya quedó</button>
                  </div>
                </div>
              )}
              {!o.falta_dato && (
                <div style={{ marginTop: 9, display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button style={S.btnG} onClick={async () => {
                    const q = window.prompt('¿Qué dato falta para poder trabajarla?');
                    if (q && q.trim()) { const ok = await guarda({ falta_dato: q.trim() }); if (ok) flash('Pedido. El reloj queda congelado.'); }
                  }}>Falta un dato</button>
                  <span style={{ fontSize: '0.7rem', color: '#8d8a97' }}>Pedirlo congela el SLA y avisa a quien la levantó.</span>
                </div>
              )}
            </div>

            <div style={{ ...S.caja, marginTop: 12 }}>
              <span style={S.lbl}>Conversación</span>
              {d.comentarios.length === 0 && <div style={{ fontSize: '0.79rem', color: '#999', padding: '4px 0' }}>Todavía nadie ha escrito aquí.</div>}
              {d.comentarios.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', gap: 9, padding: '8px 0', borderTop: '1px solid #f5f4f8' }}>
                  <span style={{ width: 24, height: 24, flex: 'none', borderRadius: '50%', background: P.violetaAgua, color: P.violetaTinta, fontSize: '0.58rem', fontWeight: 800, display: 'grid', placeItems: 'center' }}>
                    {String(c.autor || '?').split(' ').map((x: string) => x[0]).slice(0, 2).join('')}
                  </span>
                  <div style={{ fontSize: '0.79rem' }}>
                    <b>{c.autor}</b> <span style={{ color: '#a5a2af', fontSize: '0.68rem' }}>{new Date(c.at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <div style={{ color: '#3f3c4a', lineHeight: 1.5 }}>{c.texto}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 7, marginTop: 9 }}>
                <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe aquí, no en WhatsApp…" style={S.input}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && texto.trim()) {
                      const j = await api({ accion: 'comentar', id: o.id, texto }, 'POST');
                      if (j) { setTexto(''); traer(); }
                    }
                  }} />
                <button style={S.btn} onClick={async () => {
                  if (!texto.trim()) return;
                  const j = await api({ accion: 'comentar', id: o.id, texto }, 'POST');
                  if (j) { setTexto(''); traer(); }
                }}>Enviar</button>
              </div>
            </div>
          </div>

          <div>
            {/* El acuerdo de tiempos: la fecha la pone quien hace el trabajo, la
                ventana de revisión la pide quien entrega, y se miden las dos. */}
            <div style={{ ...S.caja, borderColor: P.violetaBorde }}>
              <span style={S.lbl}>El acuerdo de tiempos</span>
              <div style={{ marginBottom: 9 }}>
                <span style={S.lbl}>Fecha de entrega · la pone desarrollo</span>
                <input type="date" value={String(v('fecha_prometida') || '').slice(0, 10)} onChange={e => set('fecha_prometida', e.target.value)} style={S.input} />
                {o.fecha_prometida_1 && o.fecha_prometida !== o.fecha_prometida_1 && (
                  <div style={{ fontSize: '0.68rem', color: P.ambarTinta, marginTop: 4 }}>Se movió: la primera fue el {fmt(o.fecha_prometida_1)} y es contra esa que se mide.</div>
                )}
              </div>
              <div style={{ marginBottom: 9 }}>
                <span style={S.lbl}>Días para que el dueño revise</span>
                <input type="number" min={1} max={30} value={v('dias_revision') || 3} onChange={e => set('dias_revision', e.target.value)} style={S.input} />
              </div>
              {o.etapa === 'lista' && quedan != null && (
                <div style={{ fontSize: '0.74rem', color: quedan < 0 ? P.rojoTinta : quedan <= 1 ? P.ambarTinta : P.verdeTinta, fontWeight: 700 }}>
                  {quedan >= 0 ? `La revisión vence el ${fmt(o.revision_vence)} · quedan ${quedan} d` : `La revisión se pasó ${Math.abs(quedan)} d`}
                </div>
              )}
              <div style={{ marginTop: 9 }}>
                <span style={S.lbl}>Responsable</span>
                <select value={v('asignado_id') || ''} onChange={e => set('asignado_id', e.target.value)} style={S.input}>
                  <option value="">— sin asignar —</option>
                  {equipo.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><span style={S.lbl}>Prioridad</span>
                  <select value={v('prioridad') || 'media'} onChange={e => set('prioridad', e.target.value)} style={S.input}>
                    <option value="alta">Bloquea la operación</option><option value="media">Estorba</option><option value="baja">Cosmético</option>
                  </select></div>
                <div><span style={S.lbl}>Cobro</span>
                  <select value={v('cobro') || ''} onChange={e => set('cobro', e.target.value)} style={S.input}>
                    <option value="">— sin definir —</option><option value="cortesia">Cortesía</option><option value="pagada">Pagada</option>
                  </select></div>
              </div>
            </div>

            <div style={{ ...S.caja, marginTop: 12 }}>
              <span style={S.lbl}>La entrega</span>
              <span style={S.lbl}>Video de entrega</span>
              <input value={v('video_url')} onChange={e => set('video_url', e.target.value)} placeholder="https://…" style={S.input} />
              <div style={{ marginTop: 9 }}>
                <span style={S.lbl}>…o cómo verificarlo (si no lleva video)</span>
                <textarea value={v('verificacion')} onChange={e => set('verificacion', e.target.value)} rows={2} style={{ ...S.input, resize: 'vertical' }} placeholder="Entra a Catálogo → Plantillas y guarda un certificado: las etiquetas siguen ahí." />
              </div>
              <div style={{ fontSize: '0.69rem', color: '#8d8a97', marginTop: 6, lineHeight: 1.45 }}>
                Sin uno de los dos no se puede marcar lista. El video es el que ve el cliente en su reporte.
              </div>
            </div>

            <div style={{ ...S.caja, marginTop: 12 }}>
              <span style={S.lbl}>Mover de etapa</span>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {(SIGUIENTE[o.etapa] || []).map(e => (
                  <button key={e} style={e === 'lista' ? S.btnSec : S.btnG} onClick={() => mover(e)}>{ETAPAS[e]}</button>
                ))}
                {o.etapa === 'lista' && <span style={{ fontSize: '0.74rem', color: '#8d8a97' }}>Está en manos del dueño: se aprueba desde la bandeja.</span>}
                {o.etapa === 'entregada' && <span style={{ fontSize: '0.74rem', color: P.verdeTinta, fontWeight: 700 }}>Entregada y cerrada en la ficha del cliente.</span>}
              </div>
              {o.etapa === 'espera' && (
                <div style={{ marginTop: 9 }}>
                  <span style={S.lbl}>¿Qué se le pidió al cliente?</span>
                  <input value={v('espera_cliente')} onChange={e => set('espera_cliente', e.target.value)} style={S.input} />
                  <div style={{ fontSize: '0.69rem', color: '#8d8a97', marginTop: 5 }}>Lleva {dias(o.espera_desde)} d detenida. Ese tiempo no cuenta contra la fecha.</div>
                </div>
              )}
            </div>

            <div style={{ ...S.caja, marginTop: 12 }}>
              <span style={S.lbl}>Bitácora</span>
              {d.bitacora.map((b: any) => (
                <div key={b.id} style={{ display: 'flex', gap: 8, fontSize: '0.72rem', color: '#6b6b74', padding: '5px 0', borderTop: '1px solid #f5f4f8' }}>
                  <span style={{ color: '#a5a2af', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {new Date(b.at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>{b.nota || (b.a ? `${b.actor} la pasó a ${ETAPAS[b.a]?.toLowerCase() || b.a}` : b.actor)}</span>
                </div>
              ))}
            </div>

            {d.mejoras.length > 0 && (
              <div style={{ ...S.caja, marginTop: 12 }}>
                <span style={S.lbl}>Lo que ve el cliente</span>
                <div style={{ fontSize: '0.76rem', color: '#55505f', lineHeight: 1.5 }}>
                  Al aprobar se cierra{d.mejoras.length > 1 ? 'n' : ''} {d.mejoras.length} renglón{d.mejoras.length > 1 ? 'es' : ''} en su ficha con la fecha y el video.
                  <b> Nada de lo interno —fechas prometidas, rebotes, tiempos— sale en su reporte.</b>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
