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
import { useEffect, useRef, useState, useCallback } from 'react';
import Cargando from '../ui/Cargando';
import KpiCard, { SIN_FECHA } from '../ui/KpiCard';
import { confirmar } from '../../../../lib/ui/confirmar';
import { P } from '../../../../lib/crm/paleta';
import Chispas, { Sello, CSS_CHISPAS, CSS_SELLO } from '../ui/Chispas';

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
  badgeL: { display: 'inline-block', padding: '2px 9px', borderRadius: 99, fontSize: '0.71rem', fontWeight: 700, whiteSpace: 'nowrap' as const } as const,
  caja: { background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: '13px 15px' } as const,
  secT: { fontSize: '0.6rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' as const, color: '#a5a2af', margin: '16px 0 3px', display: 'flex', alignItems: 'center', gap: 7 } as const,
};

export default function TallerTab() {
  const [cargando, setCargando] = useState(true);
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [equipo, setEquipo] = useState<any[]>([]);
  const [sinOrden, setSinOrden] = useState<any[]>([]);
  // El valor de cada cuenta (ARR, entregadas, cuenta de SACS), del mismo viaje.
  const [cuentas, setCuentas] = useState<Record<string, any>>({});
  const [yo, setYo] = useState<any>(null);
  /* Se abre en LA LISTA. «Mi bandeja» abría con cero órdenes asignadas —las 18
     estaban sin dueño— y lo primero que veía quien entraba era «no tienes
     órdenes»: parecía que no había trabajo cuando había dieciocho sin arrancar.
     Sigue existiendo, pero ya no es la puerta. */
  const [vista, setVista] = useState<'bandeja' | 'lista'>('lista');
  const [nueva, setNueva] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [abierta, setAbierta] = useState<string>('');
  const [aviso, setAviso] = useState('');
  const [filtro, setFiltro] = useState('');

  const cargar = useCallback(async () => {
    const j = await fetch('/api/crm/taller').then(r => r.json()).catch(() => null);
    if (j && !j.error) { setOrdenes(j.ordenes || []); setEquipo(j.equipo || []); setSinOrden(j.sinOrden || []); setCuentas(j.cuentas || {}); setYo(j.yo || null); }
    setCargando(false);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  // Las cuentas, para poder levantar una orden desde aquí y ligarla a su ficha.
  useEffect(() => {
    fetch('/api/crm/arr/clientes').then(r => r.json())
      .then(j => setClientes((j.data || [])
        .map((c: any) => ({ id: c.id, n: c.nombre_comercial || c.nombre }))
        .filter((c: any) => c.n)
        .sort((a: any, b: any) => a.n.localeCompare(b.n, 'es'))))
      .catch(() => {});
  }, []);

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
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 24, width: '100%', boxSizing: 'border-box' }}>
      <style>{CSS_CHISPAS + CSS_SELLO}</style>
      <div className="chispas-cab" style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <Chispas />
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-.02em', display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
          Taller <Sello>Aquí se pule cada estrella</Sello>
        </h2>
        <span style={{ fontSize: '0.78rem', color: '#8d8a97' }}>
          {vivas.length} {vivas.length === 1 ? 'orden viva' : 'órdenes vivas'}
          {esperanOK.length ? ` · ${esperanOK.length} ${esperanOK.length === 1 ? 'espera' : 'esperan'} tu OK` : ''}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {sinOrden.length > 0 && (
            <button style={S.btnSec} onClick={importar}>Traer del CRM · {sinOrden.length}</button>
          )}
          <button style={vista === 'lista' ? S.btn : S.btnG} onClick={() => setVista('lista')}>Lista del taller</button>
          <button style={vista === 'bandeja' ? S.btn : S.btnG} onClick={() => setVista('bandeja')}>Mi bandeja</button>
        </div>
      </div>

      {aviso && (
        <div style={{ background: P.ambarAgua, border: '1px solid #f2ddb8', borderRadius: 10, padding: '9px 13px', fontSize: '0.8rem', color: P.ambarTinta, marginBottom: 12 }}>{aviso}</div>
      )}

      {vista === 'bandeja'
        ? <Bandeja ordenes={ordenes} vivas={vivas} esperanOK={esperanOK} roto={roto} revisionTarde={revisionTarde}
            abrir={setAbierta} api={api} flash={flash} />
        : <Lista ordenes={vivas} yo={yo} equipo={equipo} abrir={setAbierta} cuentas={cuentas}
            filtro={filtro} setFiltro={setFiltro} onNueva={() => setNueva(true)} recargar={cargar} api={api} flash={flash} />}

      {abierta && <PanelOrden id={abierta} equipo={equipo} onCerrar={() => setAbierta('')} api={api} flash={flash} />}
      {nueva && <NuevaOrden clientes={clientes} equipo={equipo} onCerrar={() => setNueva(false)}
        onCreada={async (id: string) => { setNueva(false); await cargar(); setAbierta(id); flash('Creada y ligada a la ficha del cliente'); }}
        flash={flash} />}
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
  const masVieja = vivas.length ? Math.max(...vivas.map((o: any) => dias(o.created_at) || 0)) : 0;
  const pctFecha = conFecha.length ? Math.round(aTiempo.length / conFecha.length * 100) : 0;
  // Revisar a tiempo es haber contestado dentro de la ventana que pidió desarrollo.
  const aTiempoRev = revisiones.filter((o: any) => (o.dias_revision ?? 3) >= 0).length;
  const pctRevision = revisiones.length ? Math.round(aTiempoRev / revisiones.length * 100) : 0;

  const porCuenta: Record<string, any> = {};
  vivas.forEach((o: any) => {
    const k = cuentaDe(o);
    porCuenta[k] = porCuenta[k] || { f: 0, m: 0, mal: 0 };
    porCuenta[k][o.tipo === 'falla' ? 'f' : 'm']++;
    if (vencida(o)) porCuenta[k].mal++;
  });

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 14 }}>
        <KpiCard franja={P.violeta} label="Órdenes abiertas" valor={vivas.length}
          sub={masVieja ? `la más vieja lleva ${masVieja} d` : 'el taller está al día'} />
        <KpiCard franja={P.rojo} label="Bloquean la operación" valor={bloquean}
          color={bloquean ? P.rojoTinta : undefined}
          sub={bloquean ? 'fallas que frenan la caja' : 'nada frena la operación'} />
        {/* El FARO de esta pantalla: de las cuatro cifras, es la única que
            depende del dueño. Ver «la tarjeta faro» en ui/KpiCard. */}
        <KpiCard faro franja={P.violeta} label="Esperan tu OK" valor={esperanOK.length}
          color={esperanOK.length ? P.violetaTinta : undefined}
          sub={revisionTarde.length
            ? `${revisionTarde.length} se te pasó de la ventana`
            : revisiones.length >= 3 ? `revisaste a tiempo el ${pctRevision}%`
            : esperanOK.length ? 'dentro de tu ventana de revisión'
            : 'nada por revisar'} />
        <KpiCard franja={P.rojo} label="Rompieron el trato" valor={roto.length}
          color={roto.length ? P.rojoTinta : undefined}
          sub={conFecha.length >= 3 ? `entregaron en su fecha el ${pctFecha}% de las veces`
            : roto.length ? `${roto.length === 1 ? 'una se salió' : 'se salieron'} de lo pactado · hay que empujar`
            : 'todo dentro de lo pactado'} />
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

      <div style={S.secT}>Por cuenta</div>
      <div style={{ border: '1px solid #ececec', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
        {Object.keys(porCuenta).length === 0 && (
          <div style={{ padding: '14px 15px', fontSize: '0.82rem', color: '#999' }}>Todavía no hay órdenes en el taller.</div>
        )}
        {Object.entries(porCuenta).map(([k, v]: any, i: number) => {
          const tot = v.f + v.m;
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 15px', borderTop: i ? '1px solid #f3f1f7' : 'none', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, minWidth: 150 }}>{k}</span>
              <span style={{ display: 'flex', height: 5, borderRadius: 99, overflow: 'hidden', background: '#f2f0f7', flex: 1, minWidth: 120, maxWidth: 260 }}>
                <span style={{ width: `${v.f / tot * 100}%`, background: P.rojo }} />
                <span style={{ width: `${v.m / tot * 100}%`, background: P.violeta }} />
              </span>
              <span style={{ fontSize: '0.73rem', color: '#8a8a8a', marginLeft: 'auto' }}>
                {v.f} {v.f === 1 ? 'falla' : 'fallas'} · {v.m} {v.m === 1 ? 'mejora' : 'mejoras'}
                {v.mal > 0 && <b style={{ color: P.rojoTinta }}> · {v.mal} fuera de tiempo</b>}
              </span>
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

/* ═══════════════════ La bandeja del taller ═══════════════════
   Se abre en LA LISTA y se parte en los tres pasos que ya tiene la orden. Cada
   paso trae las cuentas COLAPSADAS: un renglón por cliente con su número y lo
   que le falta. Se abre solo la que se va a trabajar.

   Antes eran dieciocho folios desplegados, agrupados por cuenta pero todos del
   mismo peso, y cinco tarjetas arriba que repetían en número lo que la lista ya
   traía. Para llegar a la última cuenta había que pasar por las diez de la
   primera, y ningún renglón decía qué hacer con él.

   El orden de los pasos ES la prioridad: lo que no ha arrancado primero, porque
   una orden sin dueño ni fecha no avanza sola. */
const PASOS_L = [
  { k: 1 as const, l: 'Por arrancar', de: 'asignar y poner fecha', etapas: ['recibida'] },
  { k: 2 as const, l: 'En desarrollo', de: 'se está trabajando', etapas: ['analisis', 'desarrollo', 'pruebas', 'devuelta', 'espera', 'trabada'] },
  { k: 3 as const, l: 'Esperan tu OK', de: 'hay que revisarlas', etapas: ['lista'] },
];

/* LAS CUATRO DE ARRIBA. Son las tarjetas Y son el filtro: no hay una tira de
   pestañas debajo repitiendo lo mismo. Antes filtraban tres capas a la vez
   —las tarjetas, ocho vistas guardadas y, dentro de la cuenta, otra barra—, y
   con tres no se sabe cuál está aplicada. Ahora el proceso se cuenta una sola
   vez, con las palabras del dueño: total, por arrancar, en desarrollo y en
   espera de tu OK. */
const VISTAS: { k: string; l: string; sub: string; franja: string; tinta: string; faro?: boolean; f: (o: any) => boolean }[] = [
  { k: 'todas',      l: 'Total',              sub: 'órdenes vivas',           franja: P.violeta, tinta: P.violetaTinta, f: () => true },
  { k: 'arrancar',   l: 'Por arrancar',       sub: 'todavía no las empiezan', franja: P.ambar,   tinta: P.ambarTinta,   f: o => o.etapa === 'recibida' },
  { k: 'desarrollo', l: 'En desarrollo',      sub: 'se están trabajando',     franja: P.azul,    tinta: P.azulTinta,    f: o => ['analisis', 'desarrollo', 'pruebas', 'devuelta', 'trabada'].includes(o.etapa) },
  { k: 'ok',         l: 'En espera de tu OK', sub: 'hay que revisarlas',      franja: P.verde,   tinta: P.verdeTinta, faro: true, f: o => o.etapa === 'lista' },
];

/* AFINAR. Las cuatro tarjetas dicen en qué MOMENTO del proceso está el
   trabajo; esto dice qué le PASA, que es otra pregunta: lo que no tiene fecha,
   lo que ya se venció, lo que nadie tomó y lo que traigo yo. Va en una cajita
   al lado del buscador y no en una tira de pestañas —eso fue justo lo que se
   quitó— porque es un filtro que casi siempre está en «todas»: ocupa un renglón
   cuando no se usa y se nota cuando sí. */
const AFINAR: { k: string; l: string; f: (o: any, yo?: any) => boolean }[] = [
  { k: 'sinfecha', l: 'Sin fecha asignada', f: o => !o.fecha_prometida },
  { k: 'vencidos', l: 'Vencidos',           f: o => vencida(o) },
  { k: 'sindueno', l: 'Sin dueño',          f: o => !o.asignado_id },
  { k: 'mias',     l: 'Solo mías',          f: (o, yo) => !!yo?.id && o.asignado_id === yo.id },
];

/* EL FILTRO DE ADENTRO DE UNA CUENTA. Arriba se elige el momento del proceso
   para toda la lista; aquí adentro se separa la gestión por la etapa en la que
   está, que es la pregunta del proyecto abierto: «de las quince de Rubens,
   ¿cuáles están en análisis y cuáles ni han arrancado?». Al final, después de
   una raya, va «sin fecha»: no es una etapa, es lo que todavía no se puede
   prometer —y por donde se cuela lo que se levantó por error. */
const DENTRO: { k: string; l: string; f: (o: any) => boolean }[] = [
  { k: 'arrancar',   l: 'Por arrancar',  f: o => o.etapa === 'recibida' },
  { k: 'analisis',   l: 'En análisis',   f: o => o.etapa === 'analisis' },
  { k: 'desarrollo', l: 'En desarrollo', f: o => ['desarrollo', 'devuelta', 'trabada'].includes(o.etapa) },
  { k: 'pruebas',    l: 'En pruebas',    f: o => o.etapa === 'pruebas' },
  { k: 'ok',         l: 'Esperan tu OK', f: o => o.etapa === 'lista' },
  { k: 'espera',     l: 'Detenidas',     f: o => o.etapa === 'espera' },
];

/* Cómo se reparte una cuenta en la barra de la tarjeta. Lo que ya arrancó va
   en morado sólido y lo que no, en lila claro: la barra cuenta de un vistazo
   si el proyecto está empezando o ya en marcha, sin leer un número. */
const TRAMOS = [
  { l: 'por arrancar', c: '#ddd6fb', f: (o: any) => o.etapa === 'recibida' },
  { l: 'en análisis',  c: '#c3b6fb', f: (o: any) => o.etapa === 'analisis' },
  { l: 'en desarrollo',c: '#9B8CFA', f: (o: any) => ['desarrollo', 'devuelta', 'trabada'].includes(o.etapa) },
  { l: 'en pruebas',   c: '#7C6BF0', f: (o: any) => o.etapa === 'pruebas' },
  { l: 'esperan tu OK',c: '#4FBF95', f: (o: any) => o.etapa === 'lista' },
  { l: 'detenidas',    c: '#E8A838', f: (o: any) => o.etapa === 'espera' },
];

function Lista({ ordenes, yo, equipo, abrir, filtro, setFiltro, onNueva, recargar, cuentas = {}, api, flash }: any) {
  const [vista, setVista] = useState('todas');
  const [cuenta, setCuenta] = useState<string>('');   // el proyecto abierto
  /* Dentro de un proyecto: la etapa de cada gestión, o lo que no tiene fecha. */
  const [dentro, setDentro] = useState<string>('todas');
  const [afinar, setAfinar] = useState<string>('');   // la cajita de al lado del buscador

  const q = filtro.trim().toLowerCase();
  const texto = q
    ? ordenes.filter((o: any) => (o.titulo + ' ' + cuentaDe(o) + ' ' + (o.folio || '')).toLowerCase().includes(q))
    : ordenes;
  /* El afinado entra ANTES que las tarjetas para que los números de arriba y
     los de abajo digan lo mismo: con «vencidos» puesto, «13 por arrancar» es
     trece vencidas por arrancar, no trece en total. */
  const afin = AFINAR.find(a => a.k === afinar);
  const base = afin ? texto.filter((o: any) => afin.f(o, yo)) : texto;
  const conVista = (k: string) => base.filter(VISTAS.find(x => x.k === k)!.f);
  const lista = conVista(vista);

  /* Una cuenta es un PROYECTO. Antes eran dieciocho folios sueltos agrupados
     por nombre; lo que se trabaja no es una orden, es «lo de Rubens». */
  const resumir = (l: string, filas: any[]) => ({
    l, filas,
    atraso: Math.max(0, ...filas.map((o: any) => { const d = diasHasta(o.fecha_prometida); return d != null && d < 0 ? -d : 0; })),
    sinFecha: filas.filter((o: any) => !o.fecha_prometida).length,
    sinDueno: filas.filter((o: any) => !o.asignado_id).length,
    prox: filas.map((o: any) => o.fecha_prometida).filter(Boolean).sort()[0] || null,
    tramos: TRAMOS.map(t => ({ ...t, n: filas.filter(t.f).length })).filter(t => t.n > 0),
    val: cuentas[filas[0]?.company_id] || null,
  });

  const proyectos = Object.entries(lista.reduce((a: any, o: any) => {
    const k = cuentaDe(o); (a[k] = a[k] || []).push(o); return a;
  }, {})).map(([l, filas]: any) => resumir(l, filas))
    .sort((a, b) => b.atraso - a.atraso || b.sinFecha - a.sinFecha || b.filas.length - a.filas.length);

  /* Al abrir una cuenta se ven TODAS sus gestiones, no solo las del momento
     que esté elegido arriba: adentro el que separa es el filtro de etapas, y
     es justo la pregunta de «qué trae Rubens». */
  const filasCuenta = cuenta ? texto.filter((o: any) => cuentaDe(o) === cuenta) : [];
  const abierto = filasCuenta.length ? resumir(cuenta, filasCuenta) : null;
  const enCuenta = !abierto ? [] : abierto.filas.filter((o: any) =>
    dentro === 'todas' ? true
      : dentro === 'sin' ? !o.fecha_prometida
      : (DENTRO.find(d => d.k === dentro)?.f(o) ?? true));

  /* Quitar una orden levantada por error. Se lleva TAMBIÉN el renglón del
     cliente: dejarlo allá sería un compromiso que nadie va a trabajar y que
     además sale en su reporte. Se archiva, no se borra. */
  async function quitar(o: any) {
    if (!await confirmar(`¿Eliminar «${o.titulo}» del taller?`, {
      accion: 'Eliminarla', peligro: true,
      detalle: 'Se archiva junto con el renglón del cliente. Deja de verse aquí y en su ficha, pero no se borra del historial.',
    })) return;
    const j = await fetch('/api/crm/taller', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id, con_mejora: true }),
    }).then(r => r.json()).catch(() => null);
    if (!j || j.error) { flash?.(j?.error || 'No se pudo quitar'); return; }
    flash?.('Quitada del taller y de la ficha del cliente');
    recargar?.();
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 12 }}>
        {VISTAS.map(v => {
          const n = conVista(v.k).length;
          // «Total» activo no lleva «quitar»: no hay filtro que quitar.
          return (
            <KpiCard key={v.k} franja={v.franja} label={v.l} valor={n} faro={v.faro}
              color={n ? v.tinta : undefined} sub={v.sub} activo={vista === v.k}
              onClick={v.k === 'todas' && vista === 'todas' ? undefined
                : () => { setVista(vista === v.k ? 'todas' : v.k); setCuenta(''); setDentro('todas'); }} />
          );
        })}
      </div>

      {/* Solo el buscador y la acción. Las cuatro tarjetas de arriba ya dicen en
          qué momento del proceso estás; una tira de pestañas aquí abajo sería la
          misma pregunta hecha dos veces. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar por cuenta, folio o texto…"
          style={{ ...S.input, width: 260, padding: '7px 11px' }} />
        {/* La cajita de afinar. Puesta se pinta de morado: un filtro aplicado que
            no se ve es la forma más rápida de creer que faltan órdenes. */}
        <select value={afinar} onChange={e => { setAfinar(e.target.value); setCuenta(''); setDentro('todas'); }}
          style={{
            ...S.input, width: 'auto', minWidth: 170, padding: '7px 11px', cursor: 'pointer',
            ...(afinar ? { border: `1.5px solid ${P.violeta}`, color: P.violetaTinta, fontWeight: 700, background: P.violetaAgua } : null),
          }}>
          <option value="">Todas las órdenes</option>
          {AFINAR.map(a => {
            const n = texto.filter((o: any) => a.f(o, yo)).length;
            return <option key={a.k} value={a.k}>{a.l} · {n}</option>;
          })}
        </select>
        {afinar && (
          <button onClick={() => { setAfinar(''); setCuenta(''); setDentro('todas'); }}
            style={{ border: 'none', background: 'none', color: '#8d8a97', fontSize: '0.75rem', fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}>
            quitar el filtro
          </button>
        )}
        <button style={{ ...S.btn, padding: '8px 14px', fontSize: '0.79rem', marginLeft: 'auto' }} onClick={onNueva}>+ Nueva orden</button>
      </div>

      {proyectos.length === 0 && (
        <div style={{ ...S.caja, color: '#999', fontSize: '0.85rem' }}>
          {q ? 'Nada coincide con lo que buscas.'
             : afin ? `Nada en esta vista con «${afin.l.toLowerCase()}».`
             : 'Nada en esta vista.'}
        </div>
      )}

      {/* El proyecto abierto: sus órdenes, y un camino de vuelta. */}
      {abierto ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            {/* Volver es un icono: el nombre de la cuenta va justo al lado y ya
                dice dónde estás; un botón con texto competía con él. */}
            <button title="Todas las cuentas" aria-label="Todas las cuentas"
              onClick={() => { setCuenta(''); setDentro('todas'); }}
              style={{ border: '1px solid #e9e3ee', background: '#fff', borderRadius: 9, width: 30, height: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#55505f', flex: 'none' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <b style={{ fontSize: '1.05rem', fontWeight: 800 }}>{abierto.l}</b>
            {/* EL VALOR DE LA CUENTA. «14 órdenes» es el mismo renglón para el
                cliente de $200 mil al año y para el de cortesía; al entrar a un
                proyecto hay que saber de quién se trata antes de decidir qué se
                arranca primero. */}
            {abierto.val && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', fontSize: '0.73rem', color: '#8d8a97' }}>
                {abierto.val.arr > 0 && (
                  <span style={{ ...S.badgeL, background: P.verdeAgua, color: P.verdeTinta }}>
                    {'$' + Math.round(abierto.val.arr).toLocaleString('es-MX')} al año
                  </span>
                )}
                {abierto.val.entregadas > 0 && <span>{abierto.val.entregadas} ya entregadas</span>}
                {abierto.val.sacs && <span style={{ fontFamily: 'ui-monospace, monospace' }}>{abierto.val.sacs}</span>}
              </span>
            )}
            <span style={{ fontSize: '0.75rem', color: abierto.atraso ? P.rojoTinta : '#8d8a97', fontWeight: abierto.atraso ? 700 : 400 }}>
              {abierto.atraso ? `${abierto.atraso} días tarde` : abierto.prox ? `la próxima, el ${fmt(abierto.prox)}` : 'sin fecha comprometida'}
            </span>
          </div>

          {/* El filtro de la cuenta: la ETAPA en la que está cada gestión. Solo
              salen las etapas que esta cuenta tiene —un botón en cero es una
              pregunta que no se puede hacer—, y detrás de la raya va «sin
              fecha», que es el otro eje. */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            {(() => {
              const sinF = abierto.filas.filter((o: any) => !o.fecha_prometida).length;
              const ops: any[] = [['todas', 'Todas', abierto.filas.length]];
              DENTRO.forEach(d => {
                const n2 = abierto.filas.filter(d.f).length;
                if (n2) ops.push([d.k, d.l, n2]);
              });
              if (sinF) ops.push(['sin', 'Sin fecha', sinF]);
              return ops.map(([k, l, n2]) => {
                const on = dentro === k;
                const rosa = k === 'sin';
                return (
                  <button key={k} onClick={() => setDentro(k)}
                    style={{
                      border: on ? `1px solid ${P.violeta}` : '1px solid #e9e3ee',
                      background: on ? P.violeta : '#fff',
                      color: on ? '#fff' : '#666', borderRadius: 9, padding: '5px 11px',
                      fontSize: '0.73rem', fontWeight: on ? 800 : 600, fontFamily: 'inherit', cursor: 'pointer',
                      ...(rosa && !on ? SIN_FECHA : null),
                      ...(rosa ? { marginLeft: 9, fontWeight: on ? 800 : 700 } : null),
                    }}>
                    {l} <span style={{ opacity: .75, fontWeight: 700 }}>{n2}</span>
                  </button>
                );
              });
            })()}
          </div>

          {enCuenta.length === 0 && (
            <div style={{ ...S.caja, color: '#999', fontSize: '0.85rem' }}>
              Nada de esta cuenta está ahí en este momento.
            </div>
          )}
          {enCuenta.map((o: any) => (
            <Renglon key={o.id} o={o} abrir={abrir}
              acciones={<MenuFila onEditar={() => abrir(o.id)} onEliminar={() => quitar(o)} />} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 12 }}>
          {proyectos.map((p: any) => (
            <div key={p.l} onClick={() => setCuenta(p.l)}
              style={{ ...S.caja, cursor: 'pointer', transition: 'box-shadow .12s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 14px rgba(16,24,40,.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <b style={{ fontSize: '0.95rem', fontWeight: 800 }}>{p.l}</b>
                <span style={{ background: '#f4f3f7', color: '#77738a', borderRadius: 99, padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700 }}>{p.filas.length}</span>
                <span style={{
                  marginLeft: 'auto', fontSize: '0.69rem', fontWeight: 700, borderRadius: 99, padding: '2px 9px',
                  ...(p.atraso ? { background: P.rojoAgua, color: P.rojoTinta }
                    : p.sinFecha ? SIN_FECHA
                    : { background: P.verdeAgua, color: P.verdeTinta }),
                }}>
                  {p.atraso ? `${p.atraso} ${p.atraso === 1 ? 'día' : 'días'} tarde`
                    : p.sinFecha ? `${p.sinFecha} sin fecha`
                    : p.prox ? `para el ${fmt(p.prox)}` : 'al día'}
                </span>
              </div>
              {/* La barra reparte las órdenes por etapa. No es adorno: dice si el
                  proyecto está arrancando o ya en marcha sin leer un número. */}
              <div style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', background: '#f2f1f6', margin: '11px 0 7px', gap: 2 }}>
                {p.tramos.map((t: any) => <span key={t.l} style={{ flex: t.n, background: t.c }} />)}
              </div>
              <div style={{ fontSize: '0.71rem', color: '#8d8a97' }}>
                {p.tramos.map((t: any) => `${t.n} ${t.l}`).join(' · ')}
                {p.sinDueno ? ` · ${p.sinDueno} sin dueño` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* El renglón. Color en DOS ejes nada más: el tipo (la barra) y la temperatura
   del tiempo (la fecha). Todo lo demás en gris, o deja de leerse de un vistazo. */
function Renglon({ o, abrir, acciones }: any) {
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
      {acciones}
    </div>
  );
}

/* EL MENÚ DE LA FILA. Tres puntitos, y adentro lo que se puede hacer con esa
   orden: abrirla para editarla, o eliminarla del taller.
   Antes «Quitar» era un botón rojo permanente pegado a cada renglón: cinco
   botones destructivos en pantalla al mismo tiempo, cada uno más visible que
   la acción que de verdad se usa —abrir la orden—. Guardado detrás de los tres
   puntos, lo destructivo deja de gritar y sigue estando a un clic. */
function MenuFila({ onEditar, onEliminar }: any) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: any) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', esc); };
  }, [abierto]);

  const item = {
    display: 'block', width: '100%', textAlign: 'left' as const, border: 'none', background: 'none',
    padding: '7px 10px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  };

  return (
    <div ref={caja} style={{ position: 'relative', flex: 'none', marginLeft: 2 }} onClick={e => e.stopPropagation()}>
      <button aria-label="Acciones de la orden" title="Acciones" aria-expanded={abierto}
        onClick={() => setAbierto(x => !x)}
        style={{ border: 'none', background: abierto ? '#f2f1f6' : 'none', borderRadius: 8, width: 26, height: 26, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#8d8a97' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
          <circle cx="7" cy="2.6" r="1.35" /><circle cx="7" cy="7" r="1.35" /><circle cx="7" cy="11.4" r="1.35" />
        </svg>
      </button>
      {abierto && (
        <div role="menu" style={{
          position: 'absolute', right: 0, top: 30, zIndex: 30, minWidth: 138, padding: 5,
          background: '#fff', border: '1px solid #ece9f3', borderRadius: 10, boxShadow: '0 6px 22px rgba(16,24,40,.12)',
        }}>
          <button role="menuitem" style={{ ...item, color: '#55505f' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f7f6fb'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            onClick={() => { setAbierto(false); onEditar(); }}>Editar</button>
          <button role="menuitem" style={{ ...item, color: P.rojoTinta }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = P.rojoAgua; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            onClick={() => { setAbierto(false); onEliminar(); }}>Eliminar</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ La orden por dentro ═══════════════════ */
function PanelOrden({ id, equipo, onCerrar, api, flash }: any) {
  const [d, setD] = useState<any>(null);
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
  /* ══════════ LA ORDEN, EN TRES PASOS ══════════
     La ficha enseñaba todo a todos y nadie sabía qué le tocaba. Cada paso tiene
     UN dueño, y solo se abre el de quien está trabajando; los otros dos se
     doblan a un renglón que se puede abrir. El botón dice a quién se la pasa.

       1 · Lo que se necesita   → lo escribe quien la levanta
       2 · El compromiso y la entrega → lo llena desarrollo
       3 · Tu revisión          → lo cierra el dueño de la cuenta

     El paso sale de la ETAPA, no de un campo nuevo: un segundo lugar donde
     vive «en qué va» es un segundo lugar donde se puede desincronizar. */
  const PASO_DE: Record<string, 1 | 2 | 3> = {
    recibida: 1,
    analisis: 2, desarrollo: 2, pruebas: 2, devuelta: 2, espera: 2, trabada: 2,
    lista: 3, entregada: 3,
  };
  const paso = PASO_DE[o.etapa] || 1;
  const cerrada = o.etapa === 'entregada';

  // Las llaves de cada paso, dichas ANTES de intentarlo y no como un error
  // después. Son los mismos candados que el API ya exige.
  const falta1 = [
    !v('problema') && 'qué pasa hoy',
    !v('esperado') && 'qué debería pasar',
    !v('criterios') && 'con qué se da por buena',
  ].filter(Boolean) as string[];
  const falta2 = [
    !v('fecha_prometida') && 'la fecha de entrega',
    !v('asignado_id') && 'el responsable',
    !v('video_url') && !v('verificacion') && 'el video de la entrega',
  ].filter(Boolean) as string[];

  const PASOS = [
    { n: 1, t: 'Lo que se necesita', de: 'lo escribes tú' },
    { n: 2, t: 'El compromiso y la entrega', de: 'lo llena desarrollo' },
    { n: 3, t: 'Tu revisión', de: 'lo cierras tú' },
  ];

  /* Un renglón doblado: el paso que no toca, resumido en una línea que se puede
     abrir. Es lo que evita que «un paso a la vez» signifique «a ciegas». */
  const Doblado = ({ n, titulo, de, children }: any) => {
    const [abierto, setAbierto] = useState(false);
    return (
      <div style={{ ...S.caja, background: '#FAFAFB', borderColor: '#f0eff4', marginBottom: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...S.lbl, margin: 0, color: n < paso ? P.verdeTinta : '#a5a2af' }}>
            {n} · {titulo}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#a5a2af' }}>{de}</span>
          <button onClick={() => setAbierto(a => !a)}
            style={{ marginLeft: 'auto', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700, color: P.violetaTinta }}>
            {abierto ? 'ocultar' : 'ver'}
          </button>
        </div>
        {abierto && <div style={{ marginTop: 10 }}>{children}</div>}
      </div>
    );
  };

  const Lectura = ({ k, l }: any) => (
    <div style={{ marginTop: 9 }}>
      <span style={S.lbl}>{l}</span>
      <div style={{ fontSize: '0.79rem', color: v(k) ? '#3f3c4a' : '#b5b2bd', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{v(k) || '—'}</div>
    </div>
  );

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 960, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ background: '#fbfafd', width: 760, maxWidth: '100%', height: '100%', overflowY: 'auto', boxShadow: '-16px 0 44px rgba(16,24,40,.18)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#faf8ff', borderBottom: '1px solid #e6ddfa', padding: '13px 18px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ fontSize: '0.95rem' }}>{o.folio}</b>
          <span style={{ fontSize: '0.76rem', color: '#8d8a97' }}>
            {cuentaDe(o)} · {cerrada ? 'entregada' : `paso ${paso} de 3`}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
            {sucio && <button style={{ ...S.btn, opacity: guardando ? .6 : 1 }} disabled={guardando} onClick={() => guarda().then(ok => ok && flash('Guardado'))}>Guardar cambios</button>}
            <button style={S.btnG} onClick={onCerrar}>Cerrar</button>
          </div>
        </div>

        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 7 }}>
            <span style={{ ...CHIP_T[o.tipo], fontSize: '0.58rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px' }}>{o.tipo.toUpperCase()}</span>
            {o.prioridad === 'urgente' && <span style={{ background: P.rojoAgua, color: P.rojoTinta, fontSize: '0.58rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px' }}>urgente</span>}
            {o.modulo && <span style={{ background: '#f6f5f9', color: '#6b6b74', fontSize: '0.58rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px' }}>{o.modulo}</span>}
            {d.mejoras.length > 1 && <span style={{ background: P.violetaAgua, color: P.violetaTinta, fontSize: '0.58rem', fontWeight: 800, borderRadius: 20, padding: '3px 9px' }}>{d.mejoras.length} cuentas</span>}
          </div>
          {/* El nombre SÍ se cambia, y se tiene que ver que se puede. Antes era
              un input sin borde ni fondo: parecía un título y nadie lo tocaba.
              Al guardar, el nombre viaja también al renglón del cliente —son la
              misma cosa vista de dos lados, y dos nombres son dos verdades—. */}
          <div style={{ marginBottom: 14 }}>
            <span style={S.lbl}>Nombre de la mejora · así lo ve el cliente</span>
            <input value={v('titulo')} onChange={e => set('titulo', e.target.value)}
              placeholder="Escribe con qué nombre quieres que aparezca"
              style={{ ...S.input, fontSize: '0.95rem', fontWeight: 700 }} />
          </div>

          {/* El riel de los tres pasos. Sin colores de alarma: el que va se
              marca con el morado del sistema y los hechos con la palomita. */}
          <div style={{ display: 'flex', border: '1px solid #eeeef1', borderRadius: 11, overflow: 'hidden', background: '#fff', marginBottom: 14 }}>
            {PASOS.map((x, i) => {
              const hecho = x.n < paso || cerrada;
              const activo = x.n === paso && !cerrada;
              return (
                <div key={x.n} style={{
                  flex: 1, minWidth: 0, padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'center',
                  borderRight: i < 2 ? '1px solid #f2f1f6' : 'none',
                  background: activo ? '#F7F5FE' : '#fff',
                }}>
                  <span style={{
                    width: 24, height: 24, flex: 'none', borderRadius: 99, display: 'grid', placeItems: 'center',
                    fontSize: '0.72rem', fontWeight: 800,
                    ...(hecho ? { background: P.verdeAgua, color: P.verdeTinta }
                      : activo ? { background: P.violeta, color: '#fff' }
                      : { background: '#f2f1f6', color: '#b5b2bd' }),
                  }}>{hecho ? '✓' : x.n}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, lineHeight: 1.25, color: hecho || activo ? '#1a1a1a' : '#b5b2bd' }}>{x.t}</span>
                    <span style={{ display: 'block', fontSize: '0.62rem', fontWeight: 600, color: '#a5a2af' }}>{x.de}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── PASO 1 ── */}
          {paso === 1 && !cerrada ? (
            <div style={{ ...S.caja, borderColor: P.violetaBorde, boxShadow: '0 2px 12px rgba(155,140,250,.09)', marginBottom: 11 }}>
              <span style={{ ...S.lbl, color: P.violetaTinta }}>1 · Lo que se necesita</span>
              {[['problema', 'Qué pasa hoy'], ['esperado', 'Qué debería pasar'], ['pasos', 'Cómo reproducirlo'], ['criterios', 'Con qué se da por buena']].map(([k, l]) => (
                <div key={k} style={{ marginTop: 10 }}>
                  <span style={S.lbl}>{l}</span>
                  <textarea value={v(k)} onChange={e => set(k, e.target.value)} rows={3} style={{ ...S.input, resize: 'vertical', lineHeight: 1.5 }} placeholder="—" />
                </div>
              ))}
              {/* Lo que el video de entrega TIENE que enseñar. Va aquí, junto al
                  criterio, porque es la misma pregunta vista desde la cámara: el
                  criterio dice cuándo está bien, esto dice qué grabar para
                  probarlo. Sin este campo, desarrollo grababa lo que le parecía y
                  la orden rebotaba por «falta video» aunque el video existiera. */}
              <div style={{ marginTop: 10 }}>
                <span style={S.lbl}>Qué tiene que mostrar el video de entrega</span>
                <textarea value={v('video_pide')} onChange={e => set('video_pide', e.target.value)} rows={3}
                  placeholder={'Uno por renglón, en el orden en que quieres verlo:\ncobrar un anticipo en POS y que salgan los dos tickets\nescanear el ticket chico y que abra el apartado\nla pantalla de configuración con la opción prendida'}
                  style={{ ...S.input, resize: 'vertical', lineHeight: 1.5 }} />
                <div style={{ fontSize: '0.69rem', color: '#8d8a97', marginTop: 5, lineHeight: 1.45 }}>
                  Es lo que vas a revisar en el paso 3. Si no lo pides aquí, el video llega con lo que a ellos les pareció.
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={S.lbl}>Video o evidencia que estás mandando</span>
                <input value={v('evidencia_url')} onChange={e => set('evidencia_url', e.target.value)}
                  placeholder="https://… la pantalla grabada, la foto del ticket" style={S.input} />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 13, flexWrap: 'wrap' }}>
                <button style={{ ...S.btn, padding: '8px 15px', fontSize: '0.8rem', opacity: falta1.length || guardando ? .5 : 1, cursor: falta1.length ? 'not-allowed' : 'pointer' }}
                  disabled={!!falta1.length || guardando}
                  onClick={async () => { const ok = await guarda({ etapa: 'analisis' }); if (ok) flash('Va para desarrollo'); }}>
                  Mandarla a desarrollo
                </button>
                {/* Lo del video se avisa, no se bloquea: una orden a medio
                    escribir que no se puede mandar se queda sin mandar. */}
                <span style={{ fontSize: '0.71rem', color: falta1.length || !v('video_pide') ? P.ambarTinta : '#8d8a97', lineHeight: 1.45 }}>
                  {falta1.length ? `Falta ${falta1.join(', ')}.`
                    : !v('video_pide') ? 'No dijiste qué mostrar en el video: va a llegar con lo que a ellos les parezca.'
                    : 'Desarrollo la recibe con un resumen de esto y con lo que tiene que grabar.'}
                </span>
              </div>
            </div>
          ) : (
            <Doblado n={1} titulo="Lo que se necesita" de="lo escribiste tú">
              <Lectura k="problema" l="Qué pasa hoy" />
              <Lectura k="esperado" l="Qué debería pasar" />
              <Lectura k="pasos" l="Cómo reproducirlo" />
              <Lectura k="criterios" l="Con qué se da por buena" />
              <Lectura k="video_pide" l="Qué tiene que mostrar el video de entrega" />
              <div style={{ marginTop: 9 }}>
                <span style={S.lbl}>Video o evidencia de quien la levantó</span>
                {v('evidencia_url')
                  ? <a href={v('evidencia_url')} target="_blank" rel="noreferrer" style={{ fontSize: '0.79rem', color: P.violetaTinta }}>{v('evidencia_url')}</a>
                  : <div style={{ fontSize: '0.79rem', color: '#b5b2bd' }}>—</div>}
              </div>
            </Doblado>
          )}

          {/* ── PASO 2 ── */}
          {paso === 2 && !cerrada ? (
            <div style={{ ...S.caja, borderColor: P.violetaBorde, boxShadow: '0 2px 12px rgba(155,140,250,.09)', marginBottom: 11 }}>
              <span style={{ ...S.lbl, color: P.violetaTinta }}>2 · El compromiso y la entrega</span>
              <Resumen o={o} api={api} traer={traer} flash={flash} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 12 }}>
                <div><span style={S.lbl}>Fecha de entrega</span>
                  <input type="date" value={String(v('fecha_prometida') || '').slice(0, 10)} onChange={e => set('fecha_prometida', e.target.value)} style={S.input} /></div>
                <div><span style={S.lbl}>Días para que revises</span>
                  <input type="number" min={1} max={30} value={v('dias_revision') || 3} onChange={e => set('dias_revision', e.target.value)} style={S.input} /></div>
                <div><span style={S.lbl}>Responsable</span>
                  <select value={v('asignado_id') || ''} onChange={e => set('asignado_id', e.target.value)} style={S.input}>
                    <option value="">— sin asignar —</option>
                    {equipo.map((q: any) => <option key={q.id} value={q.id}>{q.nombre}</option>)}
                  </select></div>
              </div>
              {o.fecha_prometida_1 && o.fecha_prometida !== o.fecha_prometida_1 && (
                <div style={{ fontSize: '0.7rem', color: '#8d8a97', marginTop: 5 }}>
                  La primera fecha fue el {fmt(o.fecha_prometida_1)} y es contra esa que se mide.
                </div>
              )}

              <div style={{ marginTop: 11 }}>
                <span style={S.lbl}>Prioridad</span>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {[['baja', 'Baja'], ['alta', 'Alta'], ['urgente', 'Urgente']].map(([k, l]) => {
                    const on = (v('prioridad') || 'baja') === k;
                    return (
                      <button key={k} onClick={() => set('prioridad', k)}
                        style={on ? { ...S.btnG, borderColor: P.violeta, background: P.violetaAgua, color: P.violetaTinta, fontWeight: 800 } : S.btnG}>{l}</button>
                    );
                  })}
                  <span style={{ fontSize: '0.7rem', color: '#a5a2af', alignSelf: 'center' }}>urgente = hoy no puede vender</span>
                </div>
              </div>
              <div style={{ marginTop: 11 }}>
                <span style={S.lbl}>Cobro</span>
                <select value={v('cobro') || ''} onChange={e => set('cobro', e.target.value)} style={{ ...S.input, maxWidth: 220 }}>
                  <option value="">— sin definir —</option><option value="cortesia">Cortesía</option><option value="pagada">Pagada</option>
                </select>
              </div>

              <div style={{ marginTop: 11 }}>
                {/* Lo que pidieron ver, a la vista al momento de grabar. No es
                    editable de este lado: es el encargo, no una nota. */}
                {o.video_pide && (
                  <div style={{ background: '#FAFAFB', border: '1px solid #f0eff4', borderRadius: 10, padding: '11px 13px', marginBottom: 10 }}>
                    <span style={{ ...S.lbl, margin: '0 0 5px' }}>El video tiene que mostrar</span>
                    <div style={{ fontSize: '0.79rem', color: '#3f3c4a', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{o.video_pide}</div>
                  </div>
                )}
                <span style={S.lbl}>Video de lo que entregan</span>
                <input value={v('video_url')} onChange={e => set('video_url', e.target.value)} placeholder="https://… la pantalla grabada mostrando que ya quedó" style={S.input} />
                <div style={{ marginTop: 8 }}>
                  <span style={S.lbl}>…o cómo verificarlo, si no lleva video</span>
                  <textarea value={v('verificacion')} onChange={e => set('verificacion', e.target.value)} rows={2} style={{ ...S.input, resize: 'vertical' }} placeholder="Entra a Catálogo → Plantillas y guarda un certificado: las etiquetas siguen ahí." />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 13, flexWrap: 'wrap' }}>
                <button style={{ ...S.btn, padding: '8px 15px', fontSize: '0.8rem', opacity: falta2.length || guardando ? .5 : 1, cursor: falta2.length ? 'not-allowed' : 'pointer' }}
                  disabled={!!falta2.length || guardando}
                  onClick={async () => { const ok = await guarda({ etapa: 'lista' }); if (ok) flash('Lista para tu revisión'); }}>
                  Mandarla a revisión
                </button>
                <span style={{ fontSize: '0.71rem', color: falta2.length ? P.ambarTinta : '#8d8a97', lineHeight: 1.45 }}>
                  {falta2.length ? `Falta ${falta2.join(', ')}.` : `Tendrás ${v('dias_revision') || 3} días para revisarla.`}
                </span>
              </div>

              {/* Lo que detiene el reloj, y lo que se le pidió al cliente. */}
              <div style={{ marginTop: 13, paddingTop: 11, borderTop: '1px solid #f2f1f6', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {o.falta_dato ? (
                  <>
                    <span style={{ fontSize: '0.74rem', color: '#4a4a52' }}>
                      Pediste un dato hace {dias(o.falta_dato_at)} d: <b>{o.falta_dato}</b>
                    </span>
                    <button style={S.btnG} onClick={() => guarda({ falta_dato: '' }).then(ok => ok && flash('Listo, el reloj vuelve a correr'))}>Ya quedó</button>
                  </>
                ) : (
                  <>
                    <button style={S.btnG} onClick={async () => {
                      const q = window.prompt('¿Qué dato falta para poder trabajarla?');
                      if (q && q.trim()) { const ok = await guarda({ falta_dato: q.trim() }); if (ok) flash('Pedido. El reloj queda congelado.'); }
                    }}>Falta un dato</button>
                    <button style={S.btnG} onClick={() => mover('espera')}>Esperando al cliente</button>
                    <span style={{ fontSize: '0.7rem', color: '#a5a2af' }}>las dos congelan el tiempo</span>
                  </>
                )}
              </div>
              {o.etapa === 'espera' && (
                <div style={{ marginTop: 9 }}>
                  <span style={S.lbl}>¿Qué se le pidió al cliente?</span>
                  <input value={v('espera_cliente')} onChange={e => set('espera_cliente', e.target.value)} style={S.input} />
                  <div style={{ fontSize: '0.7rem', color: '#8d8a97', marginTop: 5 }}>Lleva {dias(o.espera_desde)} d detenida. Ese tiempo no cuenta contra la fecha.</div>
                </div>
              )}
            </div>
          ) : (
            <Doblado n={2} titulo="El compromiso y la entrega" de={paso < 2 ? 'cuando la mandes a desarrollo' : 'lo llenó desarrollo'}>
              <div style={{ fontSize: '0.79rem', color: '#3f3c4a', lineHeight: 1.6 }}>
                {o.fecha_prometida ? <>Prometida para el <b>{fmt(o.fecha_prometida)}</b></> : 'Sin fecha todavía'}
                {o.team_members?.nombre && <> · {o.team_members.nombre}</>}
                {o.prioridad && <> · prioridad {o.prioridad}</>}
              </div>
              {o.resumen && <div style={{ fontSize: '0.78rem', color: '#4a4a52', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 8 }}>{o.resumen}</div>}
              {(o.video_url || o.verificacion) && (
                <div style={{ marginTop: 9 }}>
                  <span style={S.lbl}>Lo que entregaron</span>
                  {o.video_url
                    ? <a href={o.video_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.79rem', color: P.violetaTinta }}>{o.video_url}</a>
                    : <div style={{ fontSize: '0.79rem', color: '#3f3c4a', lineHeight: 1.55 }}>{o.verificacion}</div>}
                </div>
              )}
            </Doblado>
          )}

          {/* ── PASO 3 ── */}
          {paso === 3 ? (
            <div style={{ ...S.caja, borderColor: cerrada ? '#ececec' : P.violetaBorde, boxShadow: cerrada ? 'none' : '0 2px 12px rgba(155,140,250,.09)' }}>
              <span style={{ ...S.lbl, color: cerrada ? P.verdeTinta : P.violetaTinta }}>3 · Tu revisión</span>
              {cerrada ? (
                <div style={{ fontSize: '0.8rem', color: '#3f3c4a', lineHeight: 1.6, marginTop: 6 }}>
                  Entregada el <b>{fmt(o.entregada_at)}</b>. Ya aparece en Consultoría del cliente, en «Ya entregado»,
                  con su fecha y su video.
                </div>
              ) : (
                <RevisionPaso o={o} d={d} api={api} traer={traer} flash={flash} quedan={quedan} />
              )}
            </div>
          ) : (
            <Doblado n={3} titulo="Tu revisión" de="cuando desarrollo entregue">
              <div style={{ fontSize: '0.79rem', color: '#3f3c4a', lineHeight: 1.6 }}>
                Verás el video al lado de tu criterio y decides: aprobar —y se marca entregado en la ficha del
                cliente— o pedir cambios con su motivo.
              </div>
            </Doblado>
          )}

          <div style={{ ...S.caja, background: '#FAFAFB', borderColor: '#f0eff4', marginTop: 11 }}>
            <span style={S.lbl}>Lo que ha pasado con esta orden</span>
            {d.bitacora.length === 0 && <div style={{ fontSize: '0.78rem', color: '#b5b2bd' }}>Todavía no se ha movido.</div>}
            {d.bitacora.map((b: any) => (
              <div key={b.id} style={{ display: 'flex', gap: 8, fontSize: '0.72rem', color: '#6b6b74', padding: '5px 0', borderTop: '1px solid #f2f1f6' }}>
                <span style={{ color: '#a5a2af', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(b.at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>{b.nota || (b.a ? `${b.actor} la pasó a ${ETAPAS[b.a]?.toLowerCase() || b.a}` : b.actor)}</span>
              </div>
            ))}
            {d.mejoras.length > 0 && (
              <div style={{ fontSize: '0.73rem', color: '#8d8a97', lineHeight: 1.5, marginTop: 9, paddingTop: 9, borderTop: '1px solid #f2f1f6' }}>
                Al aprobar se cierra{d.mejoras.length > 1 ? 'n' : ''} {d.mejoras.length} renglón{d.mejoras.length > 1 ? 'es' : ''} en la
                ficha del cliente con la fecha y el video. Nada de lo interno —rebotes, tiempos— sale en su reporte.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* El resumen del paso 1, para que desarrollo no tenga que leer 1,900
   caracteres antes de programar. Se genera, se edita y NO reemplaza el
   original: lo que se acordó con el cliente se queda en sus palabras. */
function Resumen({ o, api, traer, flash }: any) {
  const [txt, setTxt] = useState<string>(o.resumen || '');
  const [editando, setEditando] = useState(false);
  const [armando, setArmando] = useState(false);

  async function armar() {
    setArmando(true);
    const j = await fetch('/api/crm/taller', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'resumir', id: o.id }),
    }).then(r => r.json()).catch(() => null);
    setArmando(false);
    if (!j || j.error) { flash(j?.error || 'No se pudo armar el resumen'); return; }
    setTxt(j.resumen); setEditando(false); traer();
  }

  return (
    <div style={{ background: '#FAFAFB', border: '1px solid #f0eff4', borderRadius: 10, padding: '12px 14px', marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
        <span style={{ ...S.lbl, margin: 0 }}>En corto, del paso 1</span>
        <button onClick={armar} disabled={armando}
          style={{ marginLeft: 'auto', border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700, color: P.violetaTinta, opacity: armando ? .5 : 1 }}>
          {armando ? 'armando…' : txt ? 'rehacer' : 'armar el resumen'}
        </button>
        {txt && !armando && (
          <button onClick={() => setEditando(e => !e)}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700, color: '#8d8a97' }}>
            {editando ? 'listo' : 'editar'}
          </button>
        )}
      </div>
      {!txt && !armando && (
        <div style={{ fontSize: '0.76rem', color: '#8d8a97', lineHeight: 1.5 }}>
          Lo de arriba viene largo porque se escribió para dejar constancia. Arma el resumen y programa con eso.
        </div>
      )}
      {txt && !editando && (
        <div style={{ fontSize: '0.79rem', color: '#3f3c4a', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{txt}</div>
      )}
      {txt && editando && (
        <textarea value={txt} onChange={e => setTxt(e.target.value)} rows={7}
          onBlur={() => api({ id: o.id, resumen: txt }).then(() => traer())}
          style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }} />
      )}
    </div>
  );
}

/* La revisión: el video al lado del criterio, y dos salidas. Pedir cambios
   exige motivo de lista cerrada —en texto libre no se puede contar cuál se
   repite, que es justo lo que dice si el problema es cómo se pide o cómo se
   entrega—. */
function RevisionPaso({ o, d, api, traer, flash, quedan }: any) {
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [pidiendo, setPidiendo] = useState(false);

  async function revisar(veredicto: string) {
    const j = await fetch('/api/crm/taller', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'revisar', id: o.id, veredicto, motivo: motivo || undefined, nota: nota || undefined }),
    }).then(r => r.json()).catch(() => null);
    if (!j || j.error) { flash(j?.error || 'No se pudo registrar la revisión'); return; }
    flash(veredicto === 'aprobada' ? 'Entregada y cerrada en la ficha del cliente' : 'Devuelta a desarrollo');
    traer();
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: '0.79rem', color: '#3f3c4a', lineHeight: 1.6 }}>
        Compara lo que entregaron contra lo que pediste. Si está, apruébala: se marca <b>entregado</b> en Consultoría
        del cliente con su fecha y su video.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 11 }}>
        <div>
          <span style={S.lbl}>Con qué se da por buena</span>
          <div style={{ fontSize: '0.78rem', color: '#3f3c4a', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{o.criterios || '—'}</div>
          {o.video_pide && (<>
            <span style={{ ...S.lbl, marginTop: 10 }}>Lo que pediste ver en el video</span>
            <div style={{ fontSize: '0.78rem', color: '#3f3c4a', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{o.video_pide}</div>
          </>)}
        </div>
        <div>
          <span style={S.lbl}>Lo que entregaron</span>
          {o.video_url
            ? <a href={o.video_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: P.violetaTinta, wordBreak: 'break-all' }}>{o.video_url}</a>
            : <div style={{ fontSize: '0.78rem', color: '#3f3c4a', lineHeight: 1.55 }}>{o.verificacion || '—'}</div>}
        </div>
      </div>
      {quedan != null && (
        <div style={{ fontSize: '0.73rem', color: '#8d8a97', marginTop: 9 }}>
          {quedan >= 0 ? `Quedan ${quedan} día${quedan === 1 ? '' : 's'} para revisarla.` : `La revisión se pasó ${Math.abs(quedan)} días.`}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 13, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={{ ...S.btn, padding: '8px 15px', fontSize: '0.8rem' }} onClick={() => revisar('aprobada')}>Aprobar y entregar</button>
        <button style={S.btnG} onClick={() => setPidiendo(p => !p)}>Pedir cambios</button>
      </div>
      {pidiendo && (
        <div style={{ marginTop: 11, paddingTop: 11, borderTop: '1px solid #f2f1f6' }}>
          <span style={S.lbl}>¿Por qué la devuelves?</span>
          <select value={motivo} onChange={e => setMotivo(e.target.value)} style={{ ...S.input, maxWidth: 280 }}>
            <option value="">— elige el motivo —</option>
            <option value="no_resuelve">No resuelve lo que se pidió</option>
            <option value="rompe_otra">Rompió otra cosa</option>
            <option value="falta_video">Falta el video o no se ve</option>
            <option value="incompleta">Quedó incompleta</option>
            <option value="mal_entendida">Se entendió otra cosa</option>
          </select>
          <div style={{ marginTop: 8 }}>
            <span style={S.lbl}>Qué le falta (opcional)</span>
            <input value={nota} onChange={e => setNota(e.target.value)} style={S.input} />
          </div>
          <button style={{ ...S.btnG, marginTop: 9, opacity: motivo ? 1 : .5 }} disabled={!motivo}
            onClick={() => revisar('cambios')}>Devolverla a desarrollo</button>
          <div style={{ fontSize: '0.7rem', color: '#8d8a97', marginTop: 6 }}>
            {(o.rebotes || 0) >= 2 ? 'Va por su tercer rebote: al devolverla se traba hasta que el criterio quede escrito.' : 'Queda contado: es como se sabe si el problema es cómo se pide o cómo se entrega.'}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ Levantar una orden desde el taller ═══════════════════
 * Antes una orden solo podía nacer de un renglón que YA existía en la ficha del
 * cliente. Lo que se detecta trabajando —una falla que salió probando, algo que
 * hay que arreglar y nadie levantó— se quedaba sin registrar, o se capturaba
 * dos veces: una aquí y otra allá.
 *
 * Por eso lo primero que pide es el CLIENTE, y no es opcional: sin él, el
 * trabajo existiría para desarrollo y no para el cliente —no saldría en su
 * ficha, ni en el reporte de entregas, ni se cerraría al aprobarlo—. El
 * endpoint crea las dos cosas y las liga en una sola operación; si algo falla,
 * no queda ninguna a medias.
 *
 * Lo demás es el paso 1 tal cual: lo que se pide aquí es lo mismo que se pide
 * cuando la orden llega de una minuta. Dos formularios distintos para la misma
 * orden son dos maneras de llenarla a medias.
 */
function NuevaOrden({ clientes, equipo, onCerrar, onCreada, flash }: any) {
  const [f, setF] = useState<any>({
    company_id: '', titulo: '', tipo: 'mejora', categoria: 'personalizacion',
    problema: '', esperado: '', pasos: '', criterios: '', video_pide: '',
    fecha_prometida: '', asignado_id: '', prioridad: 'baja', cobro: '', booking_id: '',
  });
  const [guardando, setGuardando] = useState(false);
  /* Las juntas de esa cuenta. Casi todo lo que llega al taller salió de una, y
     colgarlo de la minuta es lo que permite volver a leer QUÉ SE DIJO el día
     que se pidió —seis semanas después, cuando ya nadie se acuerda—. Se cargan
     al elegir el cliente, no antes: sin cuenta no hay juntas que ofrecer. */
  const [juntas, setJuntas] = useState<any[]>([]);
  useEffect(() => {
    if (!f.company_id) { setJuntas([]); return; }
    let vivo = true;
    fetch('/api/scheduling/reuniones?company_id=' + f.company_id)
      .then(r => r.json())
      .then(j => { if (vivo) setJuntas((j.data || []).filter((x: any) => x.fecha).slice(0, 25)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [f.company_id]);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const falta = [!f.company_id && 'el cliente', !f.titulo.trim() && 'el nombre'].filter(Boolean) as string[];

  async function crear() {
    setGuardando(true);
    const j = await fetch('/api/crm/taller', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'nueva', ...f }),
    }).then(r => r.json()).catch(() => null);
    setGuardando(false);
    if (!j || j.error) { flash(j?.error || 'No se pudo crear'); return; }
    onCreada(j.orden.id);
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,.35)', zIndex: 960, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ background: '#fbfafd', width: 620, maxWidth: '100%', height: '100%', overflowY: 'auto', boxShadow: '-16px 0 44px rgba(16,24,40,.18)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#faf8ff', borderBottom: '1px solid #e6ddfa', padding: '13px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <b style={{ fontSize: '0.95rem', flex: 1 }}>Nueva orden</b>
          <button style={S.btnG} onClick={onCerrar}>Cerrar</button>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ ...S.caja, borderColor: P.violetaBorde }}>
            <div><span style={S.lbl}>Cliente</span>
              <select value={f.company_id} onChange={e => set('company_id', e.target.value)} style={S.input}>
                <option value="">— elige la cuenta —</option>
                {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.n}</option>)}
              </select>
              <div style={{ fontSize: '0.69rem', color: '#8d8a97', marginTop: 5, lineHeight: 1.45 }}>
                Queda ligada a su ficha: aparece en su Taller y, al aprobarla, en «Ya entregado» de Consultoría y en
                el reporte de entregas.
              </div>
            </div>
            {/* De qué junta salió. Va aquí, pegado al cliente, porque es parte
                de «de dónde viene esto» y no de «qué hay que hacer». */}
            <div style={{ marginTop: 11 }}><span style={S.lbl}>¿De qué junta salió?</span>
              <select value={f.booking_id} onChange={e => set('booking_id', e.target.value)} style={S.input}
                disabled={!f.company_id}>
                <option value="">{f.company_id ? (juntas.length ? '— no salió de una junta —' : 'esta cuenta no tiene juntas registradas') : 'elige primero el cliente'}</option>
                {juntas.map((j: any) => (
                  <option key={j.id} value={j.id}>
                    {fmt(j.fecha)} · {j.asunto || j.event_types?.nombre || 'Reunión'}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.69rem', color: '#8d8a97', marginTop: 5, lineHeight: 1.45 }}>
                Queda colgada de esa minuta en la ficha del cliente: seis semanas después se puede volver a leer qué
                se dijo el día que se pidió.
              </div>
            </div>
            <div style={{ marginTop: 11 }}><span style={S.lbl}>Nombre de la mejora · así lo ve el cliente</span>
              <input value={f.titulo} onChange={e => set('titulo', e.target.value)}
                placeholder="Impresión de segundo ticket para identificar el apartado" style={{ ...S.input, fontWeight: 700 }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 11 }}>
              <div><span style={S.lbl}>Qué es</span>
                <select value={f.tipo} onChange={e => set('tipo', e.target.value)} style={S.input}>
                  <option value="mejora">Una mejora · no existe todavía</option>
                  <option value="falla">Una falla · ya existe y no funciona</option>
                </select></div>
              <div><span style={S.lbl}>Categoría</span>
                <select value={f.categoria} onChange={e => set('categoria', e.target.value)} style={S.input}>
                  <option value="personalizacion">Personalización</option><option value="ajuste">Ajuste</option>
                  <option value="modulo">Módulo</option><option value="plugin">Plugin</option>
                </select></div>
            </div>
          </div>

          {/* El paso 1, igual que cuando llega de una minuta. */}
          <div style={{ ...S.caja, marginTop: 12 }}>
            <span style={{ ...S.lbl, color: P.violetaTinta }}>1 · Lo que se necesita</span>
            {[['problema', 'Qué pasa hoy'], ['esperado', 'Qué debería pasar'], ['pasos', 'Cómo reproducirlo'], ['criterios', 'Con qué se da por buena']].map(([k, l]) => (
              <div key={k} style={{ marginTop: 10 }}>
                <span style={S.lbl}>{l}</span>
                <textarea value={f[k]} onChange={e => set(k, e.target.value)} rows={2} style={{ ...S.input, resize: 'vertical', lineHeight: 1.5 }} />
              </div>
            ))}
            <div style={{ marginTop: 10 }}>
              <span style={S.lbl}>Qué tiene que mostrar el video de entrega</span>
              <textarea value={f.video_pide} onChange={e => set('video_pide', e.target.value)} rows={2}
                placeholder="Uno por renglón, en el orden en que quieres verlo" style={{ ...S.input, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
          </div>

          <div style={{ ...S.caja, marginTop: 12 }}>
            <span style={S.lbl}>Si ya lo sabes, ponlo desde ahora</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 8 }}>
              <div><span style={S.lbl}>Fecha de entrega</span>
                <input type="date" value={f.fecha_prometida} onChange={e => set('fecha_prometida', e.target.value)} style={S.input} /></div>
              <div><span style={S.lbl}>Responsable</span>
                <select value={f.asignado_id} onChange={e => set('asignado_id', e.target.value)} style={S.input}>
                  <option value="">— sin asignar —</option>
                  {equipo.map((q: any) => <option key={q.id} value={q.id}>{q.nombre}</option>)}
                </select></div>
              <div><span style={S.lbl}>Cobro</span>
                <select value={f.cobro} onChange={e => set('cobro', e.target.value)} style={S.input}>
                  <option value="">— sin definir —</option><option value="cortesia">Cortesía</option><option value="pagada">Pagada</option>
                </select></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <button style={{ ...S.btn, padding: '8px 15px', fontSize: '0.8rem', opacity: falta.length || guardando ? .5 : 1, cursor: falta.length ? 'not-allowed' : 'pointer' }}
              disabled={!!falta.length || guardando} onClick={crear}>
              {guardando ? 'Creando…' : 'Crear y ligar al cliente'}
            </button>
            <span style={{ fontSize: '0.71rem', color: falta.length ? P.ambarTinta : '#8d8a97' }}>
              {falta.length ? `Falta ${falta.join(' y ')}.` : 'Se abre enseguida para que la termines de llenar.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
