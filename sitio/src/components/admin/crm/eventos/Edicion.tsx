// UNA EDICIÓN POR DENTRO · preparar, capturar, medir y cerrar.
//
// Es la misma pantalla antes, durante y después del evento, y por eso arranca
// con el embudo: registros → contactados → respondieron → demos →
// oportunidades → clientes, y al lado lo que costó. Ese renglón es el que
// decide si el año que entra se vuelve a ir.
import { useEffect, useMemo, useState } from 'react';
import { P, tarjetaKpi } from '../../../../lib/crm/paleta';
import Cargando from '../ui/Cargando';
import Sheet from '../ui/Sheet';
import { useIsMobile } from '../../../../lib/ui/mobile';
import FormRegistro, { sincronizarCola, pendientesDe } from './FormRegistro';
import ModoStand from './ModoStand';
import { Seguimiento, Turnos, Citas, Ruta, AsignarRuta } from './EdicionExtras';
import { ROL_ETIQ, PARTICIPACION_TONO, TEMP_TONO, GIROS, Pastilla, Btn, Campo, INPUT, Seccion, fmt, dinero, rango, relativo, fechaHora, fechaCorta, diasHasta, diaMX, post } from './ui';

type Vista = 'resumen' | 'preparacion' | 'registros' | 'seguimiento' | 'citas' | 'turnos' | 'buscar' | 'gastos' | 'cierre';
const VISTAS: Vista[] = ['resumen', 'preparacion', 'registros', 'seguimiento', 'citas', 'turnos', 'buscar', 'gastos', 'cierre'];
const FASES: [string, string][] = [['antes', 'Antes'], ['durante', 'Durante'], ['despues', 'Después']];

export default function Edicion({ id, onCambio }: { id: string; onCambio: () => void }) {
  const isMobile = useIsMobile();
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const [vista, setVista] = useState<Vista>('resumen');
  const [stand, setStand] = useState(false);
  const [nuevoReg, setNuevoReg] = useState(false);
  const [registrarExp, setRegistrarExp] = useState<any>(null);
  const [pend, setPend] = useState(0);

  const traer = () => fetch(`/api/crm/eventos/edicion?id=${id}`).then(r => r.json()).then(j => { if (j.error) setError(j.error); else { setD(j); setPend(pendientesDe(id)); } }).catch(e => setError(String(e)));
  useEffect(() => { setD(null); traer(); }, [id]);
  // Lo que quedó en el teléfono sin red se manda en cuanto se abre la edición con señal.
  useEffect(() => { sincronizarCola(id).then(k => { if (k) traer(); }); }, [id]);

  const hoy = diaMX();
  const ed = d?.edicion;
  const fase: 'antes' | 'durante' | 'despues' = !ed ? 'antes' : ed.inicio > hoy ? 'antes' : (ed.fin || ed.inicio) >= hoy ? 'durante' : 'despues';
  // La pestaña de inicio sigue al momento: antes se prepara, durante se captura, después se cierra.
  useEffect(() => {
    if (!ed) return;
    // La campana manda a una vista concreta (eventos?edicion=<id>&vista=seguimiento); solo aplica a ESA edición.
    const qs = new URLSearchParams(location.search);
    const pedida = qs.get('vista') as Vista | null;
    if (pedida && VISTAS.includes(pedida) && qs.get('edicion') === ed.id) return setVista(pedida);
    setVista(fase === 'durante' ? 'registros' : fase === 'despues' && !ed.retro?.cerrada_at && ed.participacion !== 'no_vamos' ? 'cierre' : 'resumen');
  }, [ed?.id, fase]);

  const cambiar = async (campos: any) => { try { await post('/api/crm/eventos', { accion: 'guardar_edicion', edicion_id: id, ...campos }); traer(); onCambio(); } catch (e: any) { alert(e.message); } };
  const accion = async (body: any) => { try { const r = await post('/api/crm/eventos/edicion', { edicion_id: id, ...body }); traer(); return r; } catch (e: any) { alert(e.message); } };

  // La lista de a quién buscar se arma sola la primera vez que se abre: es una
  // consulta a las cuentas objetivo, no una decisión, y no duplica.
  const [armada, setArmada] = useState(false);
  useEffect(() => { if (vista === 'buscar' && d && !d.expositores?.length && !armada) { setArmada(true); post('/api/crm/eventos/edicion', { edicion_id: id, accion: 'cargar_expositores' }).then(() => traer()).catch(() => {}); } }, [vista, d?.expositores?.length]);

  const tareasPend = useMemo(() => (d?.tareas || []).filter((t: any) => !t.hecha), [d]);
  const vencidas = tareasPend.filter((t: any) => t.vence && t.vence < hoy);
  const e = d?.embudo;

  if (error) return <div style={{ color: P.rojoTinta }}>{error}</div>;
  if (!d) return <Cargando texto="Cargando la edición…" />;
  const ev = ed.ev_eventos;
  const vamos = ed.participacion === 'vamos' || ed.participacion === 'fuimos';
  // El QR se imprime: siempre al dominio público. Generado desde localhost o desde una
  // preview de Vercel, un QR con esa dirección se muere en la imprenta.
  const urlQr = ed.token_publico ? `https://www.sacscloud.com/e/${ed.token_publico}` : '';
  const urlCita = urlQr ? `${urlQr}/cita` : '';
  const sinContacto = d.registros.filter((r: any) => r.consentimiento && !r.contactado_at && !r.demo_at).length;
  const citasVivas = d.citas.filter((c: any) => c.estado === 'agendada').length;

  const pest: [Vista, string, number | null][] = [
    ['resumen', 'Resumen', null],
    ['preparacion', 'Preparación', tareasPend.length || null],
    ['registros', 'Registros', d.registros.length || null],
    ['seguimiento', 'Seguimiento', sinContacto || null],
    ...(vamos && ed.rol === 'stand' ? [['citas', 'Citas', citasVivas || null] as [Vista, string, number | null], ['turnos', 'Turnos', d.turnos.length || null] as [Vista, string, number | null]] : []),
    ['buscar', 'A quién buscar', d.expositores.filter((x: any) => !x.visitado).length || null],
    ['gastos', 'Gastos', d.gastos.length || null],
    ['cierre', 'Cierre', null],
  ];

  return (
    <div>
      {/* Cabecera: cuándo, dónde, cómo vamos, y lo que urge hoy. */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '.9375rem', fontWeight: 700, color: P.violetaTinta }}>{rango(ed.inicio, ed.fin)}</span>
        <span style={{ fontSize: '.8125rem', color: '#777' }}>{[ed.sede || (ev.ciudad?.includes(',') ? null : ev.sede), ed.ciudad || (ev.ciudad?.includes(',') ? 'sede itinerante' : ev.ciudad)].filter(Boolean).join(' · ')} · {relativo(ed.inicio)}{ed.estado_fecha === 'estimada' ? ' · fecha estimada' : ''}</span>
        <Pastilla tono={PARTICIPACION_TONO[ed.participacion] || PARTICIPACION_TONO.sin_decidir}>{(PARTICIPACION_TONO[ed.participacion] || PARTICIPACION_TONO.sin_decidir).l}{vamos && ed.rol ? ` · ${ROL_ETIQ[ed.rol] || ed.rol}` : ''}{ed.stand_numero ? ` · stand ${ed.stand_numero}` : ''}</Pastilla>
        <span style={{ flex: 1 }} />
        {pend > 0 && <Pastilla tono={{ bg: P.ambarAgua, fg: P.ambarTinta }}>{pend} registros sin mandar (sin red)</Pastilla>}
        {vamos && fase !== 'despues' && <Btn nivel={fase === 'durante' ? 'primario' : 'secundario'} onClick={() => setStand(true)}>Modo stand</Btn>}
      </div>

      {!vamos && ed.participacion !== 'no_vamos' && (
        <div style={{ ...tarjetaKpi(P.ambar), display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: '.875rem', color: '#444', flex: 1, minWidth: 240 }}>Todavía no se decide si vamos a esta edición. Al decir que sí se genera la lista de preparación con sus fechas límite.</span>
          <Btn nivel="primario" onClick={() => cambiar({ participacion: 'vamos', rol: ev.rol_recomendado && ev.rol_recomendado !== 'ninguno' ? ev.rol_recomendado : 'recorrido' })}>Vamos</Btn>
          <Btn nivel="terciario" onClick={() => cambiar({ participacion: 'no_vamos' })}>No vamos</Btn>
        </div>
      )}
      {vencidas.length > 0 && fase !== 'despues' && (
        <div style={{ background: P.rojoAgua, color: P.rojoTinta, borderRadius: 9, padding: '9px 13px', fontSize: '.8125rem', fontWeight: 600, marginBottom: 12, cursor: 'pointer' }} onClick={() => setVista('preparacion')}>
          {vencidas.length === 1 ? 'Una tarea vencida' : `${vencidas.length} tareas vencidas`}: {vencidas.slice(0, 2).map((t: any) => t.titulo).join(' · ')}{vencidas.length > 2 ? ' …' : ''}
        </div>
      )}

      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: `1px solid ${P.linea}`, overflowX: 'auto' }}>
        {pest.map(([v, l, n]) => (
          <button key={v} onClick={() => setVista(v)} style={{ font: 'inherit', fontSize: '.8125rem', fontWeight: vista === v ? 800 : 500, padding: '8px 13px', border: 'none', whiteSpace: 'nowrap', borderBottom: vista === v ? `2px solid ${P.violeta}` : '2px solid transparent', background: vista === v ? P.violetaAgua : 'transparent', color: vista === v ? P.violetaTinta : '#666', borderRadius: '9px 9px 0 0', cursor: 'pointer' }}>
            {l}{n ? <span style={{ marginLeft: 6, fontSize: '.6875rem', fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: vista === v ? '#fff' : P.violetaAgua, color: P.violetaTinta }}>{fmt(n)}</span> : null}
          </button>
        ))}
      </div>

      {vista === 'resumen' && <Resumen ed={ed} e={e} isMobile={isMobile} urlQr={urlQr} onCambiar={cambiar} onIr={setVista} />}

      {vista === 'preparacion' && (
        <Preparacion tareas={d.tareas} hoy={hoy} vamos={vamos} onTarea={(t, hecha) => accion({ accion: 'tarea', id: t.id, hecha })} onBorrar={(t) => accion({ accion: 'borrar_tarea', id: t.id })}
          onAgregar={(titulo, faseT, vence) => accion({ accion: 'agregar_tarea', titulo, fase: faseT, vence })} onRegenerar={() => accion({ accion: 'regenerar_tareas' })} />
      )}

      {vista === 'registros' && (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '.8125rem', color: '#666', flex: 1, minWidth: 200 }}>
              {d.registros.length ? `${fmt(d.registros.length)} personas conocidas aquí · ${fmt(e.con_consentimiento)} dijeron que sí · ${fmt(e.contactados)} ya recibieron bienvenida` : 'Todavía nadie. Cada persona que se registre entra al CRM como contacto con fuente «evento».'}
            </span>
            {urlQr && <Btn chico nivel="terciario" onClick={() => { navigator.clipboard?.writeText(urlQr); alert('Link copiado: ' + urlQr); }}>Copiar link del QR</Btn>}
            <Btn chico nivel="secundario" onClick={() => setNuevoReg(v => !v)}>{nuevoReg ? 'Cerrar' : 'Registrar a alguien'}</Btn>
          </div>
          {nuevoReg && <div style={{ ...tarjetaKpi(P.violeta), marginBottom: 14 }}><FormRegistro edicionId={id} modo="stand" onListo={() => { setNuevoReg(false); traer(); onCambio(); }} onCancelar={() => setNuevoReg(false)} /></div>}
          <ListaRegistros registros={d.registros} isMobile={isMobile} onBorrar={(r) => confirm(`¿Borrar el registro de ${r.nombre || r.empresa || 'esta persona'}? El contacto del CRM se queda.`) && accion({ accion: 'borrar_registro', id: r.id })} />
        </div>
      )}

      {vista === 'seguimiento' && <Seguimiento registros={d.registros} edicion={ed} equipo={d.equipo} isMobile={isMobile} accion={accion} />}
      {vista === 'citas' && <Citas citas={d.citas} invitacion={d.invitacion} edicion={ed} registros={d.registros} urlCita={urlCita} isMobile={isMobile} accion={accion} onCambiarEdicion={cambiar} onListo={() => { traer(); onCambio(); }} />}
      {vista === 'turnos' && <Turnos turnos={d.turnos} equipo={d.equipo} edicion={ed} isMobile={isMobile} accion={accion} />}

      {vista === 'buscar' && (
        <Buscar expositores={d.expositores} evento={ev} equipo={d.equipo} isMobile={isMobile} accion={accion} onCargar={async () => { const r = await accion({ accion: 'cargar_expositores' }); if (r) alert(`${fmt(r.encontradas)} cuentas objetivo exponen en ${ev.nombre}; ${fmt(r.nuevas)} nuevas en la lista.`); }}
          onVisitado={(x, v) => accion({ accion: 'visitado', expositor_id: x.id, visitado: v })} onRegistrar={setRegistrarExp} />
      )}

      {vista === 'gastos' && <Gastos gastos={d.gastos} categorias={d.categorias_gasto} embudo={e} presupuesto={ed.presupuesto} onAgregar={(g) => accion({ accion: 'gasto', ...g })} onBorrar={(g) => confirm('¿Borrar este gasto?') && accion({ accion: 'borrar_gasto', id: g.id })} />}

      {vista === 'cierre' && <Cierre ed={ed} e={e} fase={fase} onGuardar={(r) => accion({ accion: 'retro', ...r }).then(() => onCambio())} />}

      {stand && <ModoStand edicion={ed} registros={d.registros} meta={ed.meta_registros} onCerrar={() => { setStand(false); traer(); onCambio(); }} onNuevo={traer} />}

      <Sheet open={!!registrarExp} onClose={() => setRegistrarExp(null)} width={640} zIndex={950} title={registrarExp ? `Registrar a ${registrarExp.nombre}` : ''}>
        {registrarExp && (
          <div>
            <p style={{ fontSize: '.8125rem', color: '#666', margin: '0 0 12px' }}>Stand {registrarExp.stand || 'sin número'}. La persona queda ligada a la cuenta objetivo: su cadencia fría se cancela y la cuenta pasa a «respondió».</p>
            <FormRegistro edicionId={id} modo="recorrido" precargado={{ empresa: registrarExp.nombre, giro: registrarExp.abm_cuentas?.giro || '', ciudad: registrarExp.abm_cuentas?.ciudad || '', sucursales: registrarExp.abm_cuentas?.sucursales ?? '', stand_visitado: registrarExp.stand || '' }}
              expositorId={registrarExp.id} abmCuentaId={registrarExp.abm_cuenta_id} onListo={() => { setRegistrarExp(null); traer(); onCambio(); }} onCancelar={() => setRegistrarExp(null)} />
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Resumen({ ed, e, isMobile, urlQr, onCambiar, onIr }: { ed: any; e: any; isMobile: boolean; urlQr: string; onCambiar: (c: any) => void; onIr: (v: Vista) => void }) {
  const [f, setF] = useState<any>({ rol: ed.rol || '', stand_numero: ed.stand_numero || '', meta_registros: ed.meta_registros ?? '', meta_demos: ed.meta_demos ?? '', meta_clientes: ed.meta_clientes ?? '', presupuesto: ed.presupuesto ?? '', plantilla_wa: ed.plantilla_wa || '', notas: ed.notas || '', limite_registro: ed.limite_registro || '', url_registro: ed.url_registro || '' });
  useEffect(() => { setF({ rol: ed.rol || '', stand_numero: ed.stand_numero || '', meta_registros: ed.meta_registros ?? '', meta_demos: ed.meta_demos ?? '', meta_clientes: ed.meta_clientes ?? '', presupuesto: ed.presupuesto ?? '', plantilla_wa: ed.plantilla_wa || '', notas: ed.notas || '', limite_registro: ed.limite_registro || '', url_registro: ed.url_registro || '' }); }, [ed.updated_at]);
  const cambiado = JSON.stringify(f) !== JSON.stringify({ rol: ed.rol || '', stand_numero: ed.stand_numero || '', meta_registros: ed.meta_registros ?? '', meta_demos: ed.meta_demos ?? '', meta_clientes: ed.meta_clientes ?? '', presupuesto: ed.presupuesto ?? '', plantilla_wa: ed.plantilla_wa || '', notas: ed.notas || '', limite_registro: ed.limite_registro || '', url_registro: ed.url_registro || '' });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const meta = (n: number, m: any) => m ? ` de ${fmt(Number(m))}` : '';

  const k = (label: string, valor: string, sub: string, franja: string, tinta: string, v?: Vista) => (
    <div onClick={v ? () => onIr(v) : undefined} style={{ ...tarjetaKpi(franja), cursor: v ? 'pointer' : 'default' }}>
      <div style={{ fontSize: '.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: '1.375rem', fontWeight: 800, color: tinta, lineHeight: 1.15, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{valor}</div>
      <div style={{ fontSize: '.6875rem', color: '#888', marginTop: 3 }}>{sub}</div>
    </div>
  );
  return (
    <div>
      <Seccion titulo="El embudo de esta edición">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
          {k('Registros', fmt(e.registros) + meta(e.registros, ed.meta_registros), `${fmt(e.calientes)} calientes · ${fmt(e.quieren_demo)} quieren demo`, P.violeta, P.violetaTinta, 'registros')}
          {k('Contactados', fmt(e.contactados), `de ${fmt(e.con_consentimiento)} que dijeron que sí`, P.azul, P.azulTinta, 'registros')}
          {k('Respondieron', fmt(e.respondieron), e.contactados ? `${Math.round(e.respondieron / e.contactados * 100)}% de los contactados` : 'aún nadie', P.azul, P.azulTinta)}
          {k('Demos', fmt(e.demos) + meta(e.demos, ed.meta_demos), 'reuniones agendadas o hechas', P.ambar, P.ambarTinta)}
          {k('Oportunidades', fmt(e.oportunidades), 'con oportunidad abierta o ganada', P.ambar, P.ambarTinta)}
          {k('Clientes', fmt(e.clientes) + meta(e.clientes, ed.meta_clientes), e.arr ? `${dinero(e.arr)} de ARR` : 'todavía ninguno', P.verde, P.verdeTinta)}
          {k('Costó', dinero(e.costo), e.costo_por_registro ? `${dinero(e.costo_por_registro)} por registro` : ed.presupuesto ? `presupuesto ${dinero(Number(ed.presupuesto))}` : 'sin gastos cargados', P.rojo, P.rojoTinta, 'gastos')}
          {k('Costo por cliente', e.costo_por_cliente ? dinero(e.costo_por_cliente) : '–', e.roi != null ? `retorno ${e.roi > 0 ? '+' : ''}${e.roi}% sobre el ARR` : 'se calcula al cerrar clientes', e.roi != null && e.roi >= 0 ? P.verde : P.rojo, e.roi != null && e.roi >= 0 ? P.verdeTinta : P.rojoTinta)}
        </div>
        {Object.keys(e.por_persona || {}).length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {Object.entries(e.por_persona).sort((a: any, b: any) => b[1] - a[1]).map(([p, n]: any) => <Pastilla key={p} tono={{ bg: P.violetaAgua, fg: P.violetaTinta }}>{p}: {fmt(n)}</Pastilla>)}
            {Object.entries(e.por_dia).sort().map(([dd, n]: any) => <Pastilla key={dd} tono={{ bg: '#f3f3f3', fg: '#555' }}>{fechaCorta(dd)}: {fmt(n)}</Pastilla>)}
          </div>
        )}
      </Seccion>

      {(ed.participacion === 'vamos') && !ed.plantilla_wa && (
        <div style={{ ...tarjetaKpi(P.ambar), fontSize: '.8125rem', color: '#444', lineHeight: 1.5, marginBottom: 14 }}>
          <b style={{ color: P.ambarTinta }}>Sin plantilla de WhatsApp.</b> Quien se registre no recibirá bienvenida por WhatsApp (solo correo, si lo deja). Elige abajo una plantilla aprobada antes del evento.
        </div>
      )}
      {urlQr && (
        <Seccion titulo="El QR del stand">
          <div style={{ ...tarjetaKpi(P.violeta), display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <img alt="QR de registro" width={112} height={112} src={`https://api.qrserver.com/v1/create-qr-code/?size=224x224&margin=0&color=5B4BD6&data=${encodeURIComponent(urlQr)}`} style={{ borderRadius: 8, border: `1px solid ${P.linea}` }} />
            <div style={{ flex: 1, minWidth: 220, fontSize: '.8125rem', color: '#444', lineHeight: 1.5 }}>
              La persona se registra sola desde su teléfono, acepta que le escribamos y recibe la bienvenida al instante. Imprímelo grande en el stand y en las tarjetas.
              <div style={{ marginTop: 6, fontFamily: 'ui-monospace, monospace', fontSize: '.75rem', color: P.violetaTinta, wordBreak: 'break-all' }}>{urlQr}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <Btn chico nivel="secundario" onClick={() => { navigator.clipboard?.writeText(urlQr); }}>Copiar link</Btn>
                <Btn chico nivel="terciario" onClick={() => window.open(urlQr, '_blank')}>Abrir</Btn>
                <Btn chico nivel="terciario" onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&margin=2&color=5B4BD6&data=${encodeURIComponent(urlQr)}`, '_blank')}>QR grande para imprimir</Btn>
              </div>
            </div>
          </div>
        </Seccion>
      )}

      <Seccion titulo="Cómo vamos y qué esperamos" accion={cambiado ? <Btn chico nivel="primario" onClick={() => onCambiar({ ...f, presupuesto: f.presupuesto === '' ? null : Number(f.presupuesto) })}>Guardar</Btn> : undefined}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <Campo label="Cómo vamos"><select style={INPUT} value={f.rol} onChange={x => set('rol', x.target.value)}><option value="">—</option>{Object.entries(ROL_ETIQ).filter(([k]) => k !== 'ninguno').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
          <Campo label="Stand (número)"><input style={INPUT} value={f.stand_numero} onChange={x => set('stand_numero', x.target.value)} /></Campo>
          <Campo label="Meta de registros"><input style={INPUT} type="number" value={f.meta_registros} onChange={x => set('meta_registros', x.target.value)} /></Campo>
          <Campo label="Meta de demos"><input style={INPUT} type="number" value={f.meta_demos} onChange={x => set('meta_demos', x.target.value)} /></Campo>
          <Campo label="Meta de clientes"><input style={INPUT} type="number" value={f.meta_clientes} onChange={x => set('meta_clientes', x.target.value)} /></Campo>
          <Campo label="Presupuesto (MXN)"><input style={INPUT} type="number" value={f.presupuesto} onChange={x => set('presupuesto', x.target.value)} /></Campo>
          <Campo label="Límite para apartar stand"><input style={INPUT} type="date" value={f.limite_registro} onChange={x => set('limite_registro', x.target.value)} /></Campo>
          <Campo label="URL de registro del organizador"><input style={INPUT} value={f.url_registro} onChange={x => set('url_registro', x.target.value)} /></Campo>
          <SelectorPlantilla valor={f.plantilla_wa} onChange={v => set('plantilla_wa', v)} evento={ed.ev_eventos?.nombre} />
        </div>
        <Campo label="Notas de la edición"><textarea style={{ ...INPUT, minHeight: 60, resize: 'vertical', marginTop: 8 }} value={f.notas} onChange={x => set('notas', x.target.value)} /></Campo>
      </Seccion>
    </div>
  );
}

function Preparacion({ tareas, hoy, vamos, onTarea, onBorrar, onAgregar, onRegenerar }: {
  tareas: any[]; hoy: string; vamos: boolean; onTarea: (t: any, hecha: boolean) => void; onBorrar: (t: any) => void; onAgregar: (titulo: string, fase: string, vence: string) => void; onRegenerar: () => void;
}) {
  const [nueva, setNueva] = useState({ titulo: '', fase: 'antes', vence: '' });
  if (!tareas.length) return (
    <div style={{ ...tarjetaKpi(P.ambar), fontSize: '.875rem', color: '#444', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ flex: 1, minWidth: 240 }}>{vamos ? 'Esta edición no tiene lista de preparación.' : 'La lista de preparación se genera al decidir que vamos.'} Trae las tareas típicas con sus fechas límite contadas desde el día del evento (el stand se aparta 4 meses antes).</span>
      {vamos && <Btn nivel="primario" onClick={onRegenerar}>Generar la lista</Btn>}
    </div>
  );
  const hechas = tareas.filter(t => t.hecha).length;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#eee', overflow: 'hidden' }}><div style={{ width: `${tareas.length ? hechas / tareas.length * 100 : 0}%`, height: '100%', background: P.violeta }} /></div>
        <span style={{ fontSize: '.75rem', color: '#777', fontVariantNumeric: 'tabular-nums' }}>{hechas} de {tareas.length}</span>
      </div>
      {FASES.map(([fk, fl]) => {
        const l = tareas.filter(t => t.fase === fk);
        if (!l.length) return null;
        return (
          <Seccion key={fk} titulo={fl}>
            <div style={{ display: 'grid', gap: 4 }}>
              {l.map(t => {
                const dias = t.vence ? diasHasta(t.vence) : null;
                const vencida = !t.hecha && dias != null && dias < 0;
                const pronto = !t.hecha && dias != null && dias >= 0 && dias <= 7;
                return (
                  <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: vencida ? P.rojoAgua : pronto ? P.ambarAgua : 'transparent' }}>
                    <input type="checkbox" checked={!!t.hecha} onChange={x => onTarea(t, x.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer', accentColor: P.violeta }} />
                    <span style={{ flex: 1, fontSize: '.875rem', color: t.hecha ? '#aaa' : '#222', textDecoration: t.hecha ? 'line-through' : 'none' }}>{t.titulo}</span>
                    {t.vence && <span style={{ fontSize: '.6875rem', fontWeight: 700, color: vencida ? P.rojoTinta : pronto ? P.ambarTinta : '#999', whiteSpace: 'nowrap' }}>{t.hecha ? fechaCorta(t.vence) : dias === 0 ? 'hoy' : dias! < 0 ? `venció ${relativo(t.vence)}` : `${fechaCorta(t.vence)} · ${relativo(t.vence)}`}</span>}
                    <button onClick={() => onBorrar(t)} title="Quitar" style={{ font: 'inherit', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: '0 2px' }}>×</button>
                  </div>
                );
              })}
            </div>
          </Seccion>
        );
      })}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'end' }}>
        <input style={INPUT} value={nueva.titulo} onChange={x => setNueva({ ...nueva, titulo: x.target.value })} placeholder="Otra tarea…" onKeyDown={x => { if (x.key === 'Enter' && nueva.titulo.trim()) { onAgregar(nueva.titulo, nueva.fase, nueva.vence); setNueva({ ...nueva, titulo: '' }); } }} />
        <select style={INPUT} value={nueva.fase} onChange={x => setNueva({ ...nueva, fase: x.target.value })}>{FASES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input style={INPUT} type="date" value={nueva.vence} onChange={x => setNueva({ ...nueva, vence: x.target.value })} />
        <Btn nivel="secundario" onClick={() => { if (nueva.titulo.trim()) { onAgregar(nueva.titulo, nueva.fase, nueva.vence); setNueva({ ...nueva, titulo: '' }); } }}>Agregar</Btn>
      </div>
    </div>
  );
}

function ListaRegistros({ registros, isMobile, onBorrar }: { registros: any[]; isMobile: boolean; onBorrar: (r: any) => void }) {
  const [q, setQ] = useState('');
  const [solo, setSolo] = useState<'' | 'caliente' | 'demo' | 'sin_contacto'>('');
  const l = registros.filter(r => {
    if (solo === 'caliente' && r.temperatura !== 'caliente') return false;
    if (solo === 'demo' && !r.quiere_demo) return false;
    if (solo === 'sin_contacto' && (r.bienvenida_wa_at || r.bienvenida_email_at || !r.consentimiento)) return false;
    if (q && !`${r.nombre} ${r.empresa} ${r.whatsapp} ${r.email} ${r.nota}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  if (!registros.length) return null;
  const seg = (v: typeof solo, label: string) => <button onClick={() => setSolo(solo === v ? '' : v)} style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '5px 11px', borderRadius: 99, cursor: 'pointer', border: `1.5px solid ${solo === v ? P.violeta : '#e4e4e4'}`, background: solo === v ? P.violeta : '#fff', color: solo === v ? '#fff' : '#555' }}>{label}</button>;
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        <input style={{ ...INPUT, width: 'auto', minWidth: 200, flex: 1 }} value={q} onChange={x => setQ(x.target.value)} placeholder="Buscar por nombre, negocio, teléfono…" />
        {seg('caliente', 'Calientes')}{seg('demo', 'Quieren demo')}{seg('sin_contacto', 'Dijeron que sí y no les llegó nada')}
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {l.map(r => {
          const c = r.contacts;
          const bienvenida = r.bienvenida_wa_at ? 'WhatsApp enviado' : r.bienvenida_wa_error ? `WhatsApp falló: ${r.bienvenida_wa_error}` : r.bienvenida_email_at ? 'correo enviado' : r.consentimiento ? 'sin bienvenida' : 'no dio permiso';
          const tonoB = r.bienvenida_wa_at || r.bienvenida_email_at ? { bg: P.verdeAgua, fg: P.verdeTinta } : r.consentimiento ? { bg: P.rojoAgua, fg: P.rojoTinta } : { bg: '#f1f1f1', fg: '#777' };
          return (
            <div key={r.id} style={{ ...tarjetaKpi(r.temperatura === 'caliente' ? P.rojo : r.temperatura === 'frio' ? P.azul : P.ambar), padding: '10px 14px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: 8, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <a href={c?.id ? `/admin/crm?tab=pipeline&contact=${c.id}` : undefined} style={{ fontWeight: 700, fontSize: '.9375rem', color: '#222', textDecoration: 'none' }}>{r.nombre || 'Sin nombre'}</a>
                  {r.empresa && <span style={{ fontSize: '.8125rem', color: '#666' }}>{r.empresa}</span>}
                  {r.giro && <Pastilla tono={{ bg: P.violetaAgua, fg: P.violetaTinta }}>{GIROS[r.giro] || r.giro}</Pastilla>}
                  {r.sucursales ? <Pastilla tono={{ bg: P.azulAgua, fg: P.azulTinta }}>{r.sucursales} tiendas</Pastilla> : null}
                  {r.ya_era && <Pastilla tono={{ bg: P.ambarAgua, fg: P.ambarTinta }} titulo="Ya estaba en el CRM antes del evento">ya era {r.ya_era}</Pastilla>}
                </div>
                <div style={{ fontSize: '.75rem', color: '#888', marginTop: 3 }}>
                  {[r.whatsapp, r.email, r.ciudad].filter(Boolean).join(' · ')}{r.sistema_actual ? ` · usa ${r.sistema_actual}` : ''} · {fechaHora(r.capturado_at)} · {r.capturado_por_nombre || (r.modo === 'qr' ? 'por QR' : 'sin nombre')}{r.stand_visitado ? ` · stand ${r.stand_visitado}` : ''}
                </div>
                {r.nota && <div style={{ fontSize: '.8125rem', color: '#444', marginTop: 4 }}>{r.nota}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                <Pastilla tono={TEMP_TONO[r.temperatura] || TEMP_TONO.tibio}>{(TEMP_TONO[r.temperatura] || TEMP_TONO.tibio).l}</Pastilla>
                {r.quiere_demo && <Pastilla tono={{ bg: P.violetaAgua, fg: P.violetaTinta }}>Quiere demo</Pastilla>}
                <Pastilla tono={tonoB} titulo={bienvenida}>{bienvenida.length > 24 ? bienvenida.slice(0, 24) + '…' : bienvenida}</Pastilla>
                {c?.lifecycle_stage && <Pastilla tono={c.lifecycle_stage === 'cliente' ? { bg: P.verdeAgua, fg: P.verdeTinta } : { bg: '#f1f1f1', fg: '#666' }}>{c.lifecycle_stage}{c.reuniones_agendadas ? ' · demo' : ''}</Pastilla>}
                <button onClick={() => onBorrar(r)} title="Borrar el registro" style={{ font: 'inherit', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>×</button>
              </div>
            </div>
          );
        })}
        {!l.length && <div style={{ fontSize: '.8125rem', color: '#999' }}>Nada con ese filtro.</div>}
      </div>
    </div>
  );
}

function Buscar({ expositores, evento, equipo, isMobile, accion, onCargar, onVisitado, onRegistrar }: { expositores: any[]; evento: any; equipo: any[]; isMobile: boolean; accion: (b: any) => Promise<any>; onCargar: () => void; onVisitado: (x: any, v: boolean) => void; onRegistrar: (x: any) => void }) {
  const [q, setQ] = useState('');
  const [ocultarVisitados, setOcultar] = useState(true);
  // Lista plana para buscar un nombre; ruta por pabellón y stand para caminar los pasillos.
  const [modo, setModo] = useState<'lista' | 'ruta'>('lista');
  const l = expositores.filter(x => (!ocultarVisitados || !x.visitado) && (!q || `${x.nombre} ${x.stand || ''} ${x.pabellon || ''}`.toLowerCase().includes(q.toLowerCase())));
  const visitados = expositores.filter(x => x.visitado).length;
  return (
    <div>
      <div style={{ ...tarjetaKpi(P.violeta), fontSize: '.8125rem', color: '#444', lineHeight: 1.5, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ flex: 1, minWidth: 240 }}>
          {expositores.length
            ? <>{fmt(expositores.length)} cuentas objetivo exponen en {evento.nombre}, con su número de stand. Recorre los pasillos con esta lista: al registrar a alguien de un stand, la cuenta pasa a «respondió» y su cadencia fría se cancela. Visitados: <b>{fmt(visitados)}</b>.</>
            : <>Las cuentas objetivo que investigamos guardan en qué feria exponen y en qué stand. Con un clic se arma la lista de a quién buscar en los pasillos.</>}
        </span>
        <Btn nivel="secundario" chico onClick={onCargar}>{expositores.length ? 'Actualizar la lista' : 'Armar la lista'}</Btn>
      </div>
      {expositores.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['lista', 'ruta'] as const).map(v => <button key={v} onClick={() => setModo(v)} style={{ font: 'inherit', fontSize: '.75rem', fontWeight: 700, padding: '5px 11px', borderRadius: 99, cursor: 'pointer', border: `1.5px solid ${modo === v ? P.violeta : '#e4e4e4'}`, background: modo === v ? P.violeta : '#fff', color: modo === v ? '#fff' : '#555' }}>{v === 'lista' ? 'Lista' : 'Ruta por pabellón'}</button>)}
          </div>
          <span style={{ flex: 1 }} />
          {modo === 'ruta' && <AsignarRuta expositores={expositores} equipo={equipo} accion={accion} />}
        </div>
      )}
      {expositores.length > 0 && modo === 'ruta' && <Ruta expositores={expositores} isMobile={isMobile} accion={accion} onRegistrar={onRegistrar} />}
      {expositores.length > 0 && modo === 'lista' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <input style={{ ...INPUT, flex: 1 }} value={q} onChange={x => setQ(x.target.value)} placeholder="Nombre o stand…" />
            <label style={{ fontSize: '.75rem', color: '#666', display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }}><input type="checkbox" checked={ocultarVisitados} onChange={x => setOcultar(x.target.checked)} /> Ocultar visitados</label>
          </div>
          <div style={{ display: 'grid', gap: 5 }}>
            {l.map(x => {
              const c = x.abm_cuentas;
              return (
                <div key={x.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? 'auto 1fr' : 'auto 1fr auto', gap: 10, alignItems: 'center', padding: '8px 12px', borderRadius: 9, border: `1px solid ${P.linea}`, background: x.visitado ? '#fafafa' : '#fff', opacity: x.visitado ? .7 : 1 }}>
                  <div style={{ minWidth: 58, textAlign: 'center', fontWeight: 800, fontSize: '.9375rem', color: P.violetaTinta, fontVariantNumeric: 'tabular-nums' }}>{x.stand || '—'}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '.875rem', color: '#222', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button onClick={() => window.dispatchEvent(new CustomEvent('crm:abm-ficha', { detail: { id: x.abm_cuenta_id } }))} style={{ font: 'inherit', fontWeight: 700, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#222', textAlign: 'left' }}>{x.nombre}</button>
                      {c?.puntaje >= 60 && <Pastilla tono={{ bg: P.ambarAgua, fg: P.ambarTinta }}>caliente {c.puntaje}</Pastilla>}
                      {c?.sucursales ? <Pastilla tono={{ bg: P.azulAgua, fg: P.azulTinta }}>{c.sucursales} tiendas</Pastilla> : null}
                      {c?.etapa && c.etapa !== 'sin_tocar' && <Pastilla tono={{ bg: '#f1f1f1', fg: '#666' }}>{c.etapa.replace('_', ' ')}</Pastilla>}
                    </div>
                    <div style={{ fontSize: '.75rem', color: '#888' }}>{[GIROS[c?.giro] || c?.giro, c?.ciudad, x.pabellon].filter(Boolean).join(' · ')}{!c?.tiene_email && !c?.tiene_wa ? ' · sin ninguna vía: aquí es donde se consigue' : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, gridColumn: isMobile ? '1 / -1' : undefined }}>
                    <Btn chico nivel={x.registro_id ? 'terciario' : 'primario'} onClick={() => onRegistrar(x)}>{x.registro_id ? 'Registrar a otro' : 'Registrar'}</Btn>
                    <Btn chico nivel="terciario" onClick={() => onVisitado(x, !x.visitado)}>{x.visitado ? 'No visitado' : 'Visitado'}</Btn>
                  </div>
                </div>
              );
            })}
            {!l.length && <div style={{ fontSize: '.8125rem', color: '#999' }}>{ocultarVisitados && visitados === expositores.length ? 'Ya se visitaron todos.' : 'Nada con esa búsqueda.'}</div>}
          </div>
        </>
      )}
    </div>
  );
}

function Gastos({ gastos, categorias, embudo, presupuesto, onAgregar, onBorrar }: { gastos: any[]; categorias: Record<string, string>; embudo: any; presupuesto: number | null; onAgregar: (g: any) => void; onBorrar: (g: any) => void }) {
  const [g, setG] = useState({ concepto: '', categoria: 'stand', monto: '', fecha: diaMX(), nota: '' });
  const total = embudo.costo || 0;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
        <div style={tarjetaKpi(P.rojo)}><div style={{ fontSize: '.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>Total</div><div style={{ fontSize: '1.375rem', fontWeight: 800, color: P.rojoTinta }}>{dinero(total)}</div><div style={{ fontSize: '.6875rem', color: '#888' }}>{presupuesto ? `${Math.round(total / Number(presupuesto) * 100)}% del presupuesto de ${dinero(Number(presupuesto))}` : 'sin presupuesto definido'}</div></div>
        {Object.entries(embudo.gastos_por_categoria || {}).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]: any) => (
          <div key={k} style={tarjetaKpi(P.ambar)}><div style={{ fontSize: '.625rem', fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>{categorias[k] || k}</div><div style={{ fontSize: '1.125rem', fontWeight: 800, color: P.ambarTinta }}>{dinero(v)}</div><div style={{ fontSize: '.6875rem', color: '#888' }}>{total ? Math.round(v / total * 100) : 0}%</div></div>
        ))}
      </div>
      <div style={{ ...tarjetaKpi(P.violeta), display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, alignItems: 'end', marginBottom: 12 }}>
        <Campo label="Concepto" ancho={2}><input style={INPUT} value={g.concepto} onChange={x => setG({ ...g, concepto: x.target.value })} placeholder="Stand 9 m² esquina" /></Campo>
        <Campo label="Categoría"><select style={INPUT} value={g.categoria} onChange={x => setG({ ...g, categoria: x.target.value })}>{Object.entries(categorias).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        <Campo label="Monto (MXN)"><input style={INPUT} type="number" inputMode="decimal" value={g.monto} onChange={x => setG({ ...g, monto: x.target.value })} /></Campo>
        <Campo label="Fecha"><input style={INPUT} type="date" value={g.fecha} onChange={x => setG({ ...g, fecha: x.target.value })} /></Campo>
        <Btn nivel="primario" disabled={!g.concepto.trim() || !(Number(g.monto) >= 0) || g.monto === ''} onClick={() => { onAgregar(g); setG({ ...g, concepto: '', monto: '', nota: '' }); }}>Agregar gasto</Btn>
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {gastos.map(x => (
          <div key={x.id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto auto', gap: 10, alignItems: 'center', padding: '7px 10px', borderBottom: `1px solid ${P.lineaSuave}`, fontSize: '.8125rem' }}>
            <span style={{ color: '#888' }}>{fechaCorta(x.fecha)}</span>
            <span><b>{x.concepto}</b> <span style={{ color: '#888' }}>· {categorias[x.categoria] || x.categoria}</span>{x.nota ? <span style={{ color: '#888' }}> · {x.nota}</span> : null}</span>
            <span style={{ fontWeight: 700, color: P.rojoTinta, fontVariantNumeric: 'tabular-nums' }}>{dinero(Number(x.monto))}</span>
            <button onClick={() => onBorrar(x)} style={{ font: 'inherit', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer' }}>×</button>
          </div>
        ))}
        {!gastos.length && <div style={{ fontSize: '.8125rem', color: '#999' }}>Sin gastos todavía. Sin ellos el costo por cliente no existe y la decisión del año que entra vuelve a ser una corazonada.</div>}
      </div>
    </div>
  );
}

function Cierre({ ed, e, fase, onGuardar }: { ed: any; e: any; fase: 'antes' | 'durante' | 'despues'; onGuardar: (r: any) => void }) {
  const r = ed.retro || {};
  // Cerrar antes de que termine es cerrar con los números a medias: se puede leer
  // y anotar, pero el botón de cierre aparece cuando la feria ya pasó.
  const puedeCerrar = fase === 'despues';
  const [f, setF] = useState({ que_funciono: r.que_funciono || '', que_no: r.que_no || '', aprendizajes: r.aprendizajes || '', repetir: r.repetir == null ? '' : r.repetir ? '1' : '0' });
  const meta = (v: number, m: any, l: string) => m ? `${l}: ${fmt(v)} de ${fmt(m)} (${Math.round(v / Number(m) * 100)}%)` : `${l}: ${fmt(v)}`;
  return (
    <div>
      <div style={{ ...tarjetaKpi(P.violeta), marginBottom: 14, fontSize: '.875rem', color: '#333', lineHeight: 1.6 }}>
        <b>Lo que dicen los números:</b> {meta(e.registros, ed.meta_registros, 'registros')} · {meta(e.demos, ed.meta_demos, 'demos')} · {meta(e.clientes, ed.meta_clientes, 'clientes')} · costó {dinero(e.costo)}{e.costo_por_cliente ? ` (${dinero(e.costo_por_cliente)} por cliente)` : ''}{e.roi != null ? ` · retorno ${e.roi}%` : ''}.
        {e.con_consentimiento > e.contactados && <span style={{ color: P.rojoTinta }}> {e.con_consentimiento - e.contactados} personas dijeron que sí y no recibieron nada: revísalas en Registros.</span>}
        {r.cerrada_at && <div style={{ fontSize: '.75rem', color: '#888', marginTop: 4 }}>Cierre hecho por {r.por} el {fechaHora(r.cerrada_at)}.</div>}
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        <Campo label="Qué funcionó"><textarea style={{ ...INPUT, minHeight: 72 }} value={f.que_funciono} onChange={x => setF({ ...f, que_funciono: x.target.value })} placeholder="El QR grande en la mesa, la demo de 3 minutos, el horario de 11 a 2…" /></Campo>
        <Campo label="Qué no"><textarea style={{ ...INPUT, minHeight: 72 }} value={f.que_no} onChange={x => setF({ ...f, que_no: x.target.value })} placeholder="El pabellón, la ubicación del stand, el material que sobró…" /></Campo>
        <Campo label="Qué haríamos distinto la próxima vez"><textarea style={{ ...INPUT, minHeight: 72 }} value={f.aprendizajes} onChange={x => setF({ ...f, aprendizajes: x.target.value })} /></Campo>
        <Campo label="¿Se repite?">
          <div style={{ display: 'flex', gap: 6 }}>
            {[['1', 'Sí, volvemos'], ['0', 'No vale la pena'], ['', 'Sin decidir']].map(([v, l]) => <button key={v} onClick={() => setF({ ...f, repetir: v })} style={{ font: 'inherit', fontSize: '.8125rem', fontWeight: 700, padding: '7px 13px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${f.repetir === v ? P.violeta : '#e4e4e4'}`, background: f.repetir === v ? P.violeta : '#fff', color: f.repetir === v ? '#fff' : '#666' }}>{l}</button>)}
          </div>
        </Campo>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          {!puedeCerrar && <span style={{ fontSize: '.75rem', color: P.ambarTinta }}>La edición se cierra cuando termine ({rango(ed.inicio, ed.fin)}); mientras, las notas se guardan.</span>}
          <Btn nivel={puedeCerrar ? 'primario' : 'secundario'} onClick={() => onGuardar({ ...f, repetir: f.repetir === '' ? null : f.repetir === '1', cerrar: puedeCerrar })}>{r.cerrada_at ? 'Guardar cambios del cierre' : puedeCerrar ? 'Cerrar la edición' : 'Guardar notas'}</Btn>
        </div>
      </div>
    </div>
  );
}

/* ── La plantilla de bienvenida se ELIGE, no se teclea ──
   El nombre a mano se escribía mal, o con una plantilla que Meta ya había pausado, y el
   error salía hasta el día de la feria con 300 registros. Aquí solo aparecen las
   aprobadas, y la vista previa enseña lo que va a leer la persona con su nombre y la
   feria puestos. Una plantilla con más de 2 variables no sirve: no hay con qué llenarlas. */
function SelectorPlantilla({ valor, onChange, evento }: { valor: string; onChange: (v: string) => void; evento?: string }) {
  const [lista, setLista] = useState<any[] | null>(null);
  useEffect(() => { fetch('/api/crm/whatsapp/plantillas?aprobadas=1').then(r => r.json()).then(j => setLista((j.plantillas || []).filter((p: any) => Number(p.variables || 0) <= 2))).catch(() => setLista([])); }, []);
  const p = lista?.find(x => x.nombre === valor);
  const vista = p ? String(p.cuerpo || '').replace('{{1}}', 'Mariana').replace('{{2}}', evento || 'la feria') : '';
  return (
    <Campo label="Bienvenida por WhatsApp" ayuda={p ? `${p.categoria === 'UTILITY' ? 'Utilidad' : 'Marketing'} · ${p.variables} variable${p.variables === 1 ? '' : 's'}: {{1}} nombre${p.variables >= 2 ? ', {{2}} feria' : ''}` : 'vacío = no se manda WhatsApp al registrarse'}>
      <select style={INPUT} value={valor} onChange={x => onChange(x.target.value)}>
        <option value="">Sin bienvenida por WhatsApp</option>
        {valor && lista && !p && <option value={valor}>{valor} (ya no está aprobada)</option>}
        {(lista || []).map(x => <option key={x.nombre} value={x.nombre}>{x.nombre}</option>)}
      </select>
      {vista && <div style={{ fontSize: '.75rem', color: '#555', background: '#f7f7fb', border: `1px solid ${P.linea}`, borderRadius: 8, padding: '8px 10px', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{vista}</div>}
      {lista && !lista.length && <span style={{ fontSize: '.6875rem', color: P.ambarTinta }}>No hay plantillas aprobadas de 1 o 2 variables. Créala en WhatsApp → Plantillas.</span>}
    </Campo>
  );
}
