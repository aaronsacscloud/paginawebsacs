import { swrGet } from '../../../lib/crm/swr';
// InicioMovil — la pantalla de arranque del CRM en el teléfono (goal "CRM de
// bolsillo", M4). Responde UNA pregunta en 2 segundos: ¿cómo va el negocio y
// qué me toca hoy?
//
// Presupuesto v5 (referee): 4 zonas exactas — saludo · número héroe (una línea
// de contexto) · Hoy (agenda) · Necesita tu atención (cross-tab, por urgencia).
// El estado sano guarda silencio: si no hay vencidas ni tickets, la sección de
// atención simplemente no aparece.
//
// En escritorio este componente no existe: el Dashboard completo sigue igual.
import { useEffect, useState } from 'react';
import Sheet from './ui/Sheet';
import { useLeadsActivos, ListaLeadsActivos, FiltrosActivos, DrawerLead, ParaRescatarLista, EmpresasActivas, EfectividadSeguimiento, RangoDias, aplicarFiltro, rutaConversacion, type LeadActivo } from './LeadsActivos';

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-MX');

export default function InicioMovil({ onIrA }: { onIrA: (tab: string) => void }) {
  const [cobrado, setCobrado] = useState<number | null>(null);
  const [meta, setMeta] = useState<number>(0);
  const [venc, setVenc] = useState<{ monto: number; n: number } | null>(null);
  const [tickets, setTickets] = useState<number | null>(null);
  // Las DOS mitades del seguimiento por WhatsApp: los que ya contestaron y
  // esperan (la pelota está de nuestro lado) y los que no volvieron a
  // responder (la pelota está del suyo y se enfría). Sin esto había que entrar
  // al inbox y contar a ojo cuál de las dos colas estaba creciendo.
  const [wa, setWa] = useState<{ esperan: number; sinResp: number } | null>(null);
  const [reuniones, setReuniones] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  // Quién se movió esta semana. Va aquí y no en el pipeline porque la pregunta
  // que contesta —«¿a quién le toco hoy?»— es de arranque de día, no de
  // gestión: si hay que entrar a otra pantalla a buscarla, no se hace.
  const [diasAct, setDiasAct] = useState(7);
  const activos = useLeadsActivos(diasAct);
  const [verActivos, setVerActivos] = useState(false);
  const [filtroAct, setFiltroAct] = useState('todos');
  const [leadAbierto, setLeadAbierto] = useState<LeadActivo | null>(null);

  useEffect(() => {
    const hoy = new Date();
    const y = hoy.getFullYear(), m = hoy.getMonth();
    const d1 = new Date(y, m, 1).toISOString().slice(0, 10);
    const d2 = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    const h = hoy.toISOString().slice(0, 10);
    // REGLA DE VELOCIDAD: cada dato pinta EN CUANTO llega (caché de la sesión
    // primero, red detrás) — el héroe no espera al más lento de los cuatro.
    swrGet(`/api/crm/reports/tablero?desde=${d1}&hasta=${d2}`, (v: any) => {
      // Shape real del tablero: { cobrado: { monto, n }, ... } — sin kpis ni meta
      setCobrado(Number(v?.cobrado?.monto ?? 0));
      setMeta(Number(v?.recurrente?.arr_hoy ?? 0));
      setCargando(false);
    }).catch(() => setCargando(false));
    // limit=1 porque solo interesan los CONTADORES: el universo se arma igual
    // en el servidor, pero no viajan 50 conversaciones que aquí no se pintan.
    swrGet('/api/crm/whatsapp/inbox?limit=1', (j: any) => {
      const k = j?.counts || {};
      setWa({ esperan: Number(k.no_leidas || 0), sinResp: Number(k.sin_respuesta || 0) });
    }).catch(() => {});
    swrGet('/api/crm/cobranza', (c: any) => {
      const k = c?.kpis || {};
      setVenc(k.vencido > 0 ? { monto: k.vencido, n: k.vencido_n || 0 } : null);
    }).catch(() => {});
    swrGet('/api/crm/soporte/dashboard?dias=14', (sv: any) => {
      const pend = Number(sv?.totales?.abiertos || 0);
      setTickets(pend > 0 ? pend : null);
    }).catch(() => {});
    swrGet(`/api/scheduling/reuniones?from=${h}&to=${h}`, (r: any) => {
      const lista = r?.reuniones || (Array.isArray(r) ? r : []);
      setReuniones(lista.slice(0, 3));
    }).catch(() => {});
  }, []);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  // Sin coma, como la referencia: "jueves 27 de agosto".
  const _f = new Date();
  const fecha = _f.toLocaleDateString('es-MX', { weekday: 'long' }) + ' ' + _f.getDate() + ' de ' + _f.toLocaleDateString('es-MX', { month: 'long' });

  return (
    <div className="m-lienzo" style={{ background: '#fff', minHeight: '60vh' }}>
      {/* saludo + avatar (referencia: misma fila, avatar 44px a la derecha) */}
      <div className="m-hdr" style={{ alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#8f8d98' }}>{fecha}</div>
          <div className="m-tt">{saludo}</div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F3F4F6', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '1.02rem' }}>A</div>
      </div>

      {/* héroe: lo cobrado del mes */}
      <div className="m-hero">
        <div className="m-hl">Cobrado del mes</div>
        {cargando && cobrado == null
          ? <div className="m-skel" style={{ width: 170, height: 38, margin: '4px 0' }} />
          : <div className="m-hv">{money(cobrado || 0)}</div>}
        {meta > 0 && cobrado != null && (
          <div className="m-hd">ARR {money(meta)}</div>
        )}
      </div>

      {/* Hoy */}
      <div className="m-sec">Hoy <span className="m-vt" onClick={() => onIrA('reuniones')}>Agenda ›</span></div>
      {cargando && !reuniones.length && <div className="m-skel" style={{ height: 52, margin: '4px 20px' }} />}
      {!cargando && reuniones.length === 0 && (
        <div style={{ padding: '12px 24px 22px', fontSize: '0.94rem', color: '#9CA3AF', borderBottom: '1px solid #efeef2' }}>Sin reuniones hoy.</div>
      )}
      {reuniones.map((r: any, i: number) => (
        <div key={r.id || i} className="m-row" onClick={() => onIrA('reuniones')}>
          <div style={{ flex: 'none', width: 56, fontWeight: 600, fontSize: '0.9rem', color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
            {(r.hora_inicio || '').slice(0, 5) || '—'}
          </div>
          <div className="m-tx">
            <div className="m-n1">{r.asunto || r.invitee_nombre || 'Reunión'}</div>
            <div className="m-n2">{r.invitee_nombre && r.asunto ? r.invitee_nombre : (r.google_meet_link ? 'Google Meet' : 'agenda')}</div>
          </div>
        </div>
      ))}

      {/* Necesita tu atención — solo habla la excepción */}
      {(venc || tickets || wa?.esperan || wa?.sinResp || !!activos?.total) && <div className="m-sec">Necesita tu atención</div>}
      {/* Primero los que YA contestaron: ahí la pelota es nuestra y cada hora
          que pasa cuesta. Después los que no respondieron, que es seguimiento. */}
      {!!wa?.esperan && (
        <div className="m-row" onClick={() => onIrA('whatsapp?bandeja=nocontestadas')}>
          <div className="m-tx">
            <div className="m-n1">{wa.esperan} {wa.esperan === 1 ? 'lead contestó' : 'leads contestaron'} y esperan</div>
            <div className="m-n2">la respuesta te toca a ti</div>
          </div>
          <div className="m-fin" style={{ alignSelf: 'center' }}><div className="m-m2">›</div></div>
        </div>
      )}
      {!!wa?.sinResp && (
        <div className="m-row" onClick={() => onIrA('whatsapp?bandeja=sinrespuesta')}>
          <div className="m-tx">
            <div className="m-n1">{wa.sinResp} sin respuesta de ellos</div>
            <div className="m-n2">les escribiste y no volvieron</div>
          </div>
          <div className="m-fin" style={{ alignSelf: 'center' }}><div className="m-m2">›</div></div>
        </div>
      )}
      {/* Después de WhatsApp —donde la pelota ya es nuestra— y antes de
          tickets: esto no es urgente, es la lista de a quién conviene tocar.
          Se dice cuántos hicieron algo ELLOS, que es el número accionable; el
          total va en la segunda línea para no perderlo. */}
      {!!activos?.total && (
        <div className="m-row" onClick={() => setVerActivos(true)}>
          <div className="m-tx">
            <div className="m-n1">{activos.total} lead{activos.total > 1 ? 's' : ''} con actividad</div>
            <div className="m-n2">
              últimos 7 días{activos.con_senal ? ` · ${activos.con_senal} ${activos.con_senal === 1 ? 'se movió' : 'se movieron'} por su cuenta` : ''}
            </div>
          </div>
          <div className="m-fin" style={{ alignSelf: 'center' }}><div className="m-m2">›</div></div>
        </div>
      )}
      {tickets != null && (
        <div className="m-row" onClick={() => onIrA('soporte')}>
          <div className="m-tx">
            <div className="m-n1">{tickets} ticket{tickets > 1 ? 's' : ''} de soporte abierto{tickets > 1 ? 's' : ''}</div>
            <div className="m-n2">esperando respuesta</div>
          </div>
          <div className="m-fin" style={{ alignSelf: 'center' }}><div className="m-m2">›</div></div>
        </div>
      )}
      {venc && (
        <div className="m-row" onClick={() => onIrA('pagos')}>
          <div className="m-tx">
            <div className="m-n1">Cobranza vencida</div>
            <div className="m-n2">{venc.n} cuenta{venc.n > 1 ? 's' : ''}</div>
          </div>
          <div className="m-fin"><div className="m-m1" style={{ color: '#C0554E' }}>{money(venc.monto)}</div></div>
        </div>
      )}
      <div style={{ height: 24 }} />

      <Sheet open={verActivos} onClose={() => setVerActivos(false)}
        title="Leads con actividad"
        headerActions={<RangoDias valor={diasAct} onCambiar={setDiasAct} />}>
        {/* Los filtros van pegados arriba: son la diferencia entre un reporte
            y una lista de trabajo. «Te toca a ti» es el que se usa a diario. */}
        <FiltrosActivos movil datos={activos} valor={filtroAct} onCambiar={setFiltroAct} />
        <ListaLeadsActivos movil leads={aplicarFiltro(activos?.leads || [], filtroAct)}
          onAbrir={setLeadAbierto} />
        <EfectividadSeguimiento datos={activos} />
        <EmpresasActivas movil datos={activos} />
        <ParaRescatarLista movil datos={activos}
          onAbrirConv={(r) => {
            setVerActivos(false);
            const ruta = r.wa_conversation_id
              ? `whatsapp?wa_conv=${encodeURIComponent(r.wa_conversation_id)}`
              : r.whatsapp ? `whatsapp?wa_search=${encodeURIComponent(r.whatsapp.replace(/\D/g, ''))}&wa_nuevo=1`
              : `pipeline?contacto=${r.id}`;
            setTimeout(() => onIrA(ruta), 140);
          }} />
        <div style={{ height: 20 }} />
      </Sheet>

      {/* El drawer NO cierra la hoja: al volver del detalle se sigue donde se
          estaba, con el mismo filtro puesto. Perder el sitio en una lista de
          treinta es lo que hace que se deje de usar. */}
      <DrawerLead lead={leadAbierto} onCerrar={() => setLeadAbierto(null)}
        onWhatsApp={(l) => {
          // El salto va DESPUÉS de cerrar, no antes. Cerrar una hoja dispara
          // `history.back()` (useDrawerHistory), y aquí se cierran dos: si se
          // navega primero, esos dos back() se llevan por delante los
          // parámetros recién puestos y el inbox abre en la lista en vez de en
          // la conversación. Medido: la URL llegaba a /admin/crm pelada.
          setLeadAbierto(null); setVerActivos(false);
          setTimeout(() => onIrA(rutaConversacion(l)), 140);
        }} />
    </div>
  );
}
