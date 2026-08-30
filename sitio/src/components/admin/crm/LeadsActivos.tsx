// LEADS QUE SE MOVIERON — con un solo lente: ¿quién SÍ está interesado?
//
// Un componente para teléfono y escritorio: el criterio de qué cuenta como
// actividad es una regla de negocio y, escrita dos veces, termina en dos
// números distintos en dos pantallas. Lo que cambia por dispositivo es el
// envase (hoja vs. tarjeta), no el dato.
//
// La primera versión listaba «quién tuvo actividad, de lo más nuevo a lo más
// viejo». Eso contesta QUÉ PASÓ, no A QUIÉN LLAMAR — que es la pregunta real.
// Tres cosas cambian esa lectura, y las tres salieron de mirar los datos:
//
//  1. DE QUIÉN ES LA PELOTA. Medido: 13 leads esperan respuesta suya y 10
//     esperan la NUESTRA. Son dos listas de trabajo distintas y estaban
//     revueltas. Las que esperan por nosotros son las que cuestan dinero cada
//     hora que pasan ahí.
//  2. TEMPERATURA. Abrir un correo es casi ruido; abrir la COTIZACIÓN es
//     alguien mirando el precio. Se pesa por tipo y por frescura, y se resume
//     en tres cajones —caliente, tibio, frío— porque un «7.4» finge una
//     precisión que no existe. El detalle se enseña en el drawer para poder
//     discutirlo en vez de creerle a un número.
//  3. TENDENCIA. Cinco señales el lunes y nada desde entonces NO es lo mismo
//     que dos ayer, aunque sumen parecido. «Enfriándose» es accionable hoy.
import { useEffect, useMemo, useState } from 'react';
import { swrGet } from '../../../lib/crm/swr';
import Sheet from './ui/Sheet';
import EstadoVacio from './ui/EstadoVacio';

export type ActividadItem = {
  tipo: string; de: 'lead' | 'nosotros'; que: string; detalle: string | null; cuando: string;
  ruta: string | null; peso: number;
};
export type Pagina = { ruta: string; n: number; caliente: boolean };
export type Cotizacion = { id: string | null; folio: string | null; total: number; estado: string | null; vistas: number; cuando: string };
export type LeadActivo = {
  id: string; nombre: string; empresa: string | null; whatsapp: string | null; email: string | null;
  ciclo: string | null; etapa: string | null;
  senales: number; puntos: number; temperatura: 'caliente' | 'tibio' | 'frio';
  pelota: 'nosotros' | 'ellos'; horas_esperando: number | null;
  tendencia: 'subiendo' | 'enfriandose' | 'estable';
  tipos: Record<string, number>;
  paginas: Pagina[]; visitas_repetidas: number;
  cotizacion: Cotizacion | null;
  wa_ventana: 'abierta' | 'cerrada' | null;
  su_record: boolean; ritmo_previo: number;
  wa_conversation_id: string | null;
  ultima: ActividadItem | null;
  linea: ActividadItem[];
};
export type ParaRescatar = {
  id: string; nombre: string; empresa: string | null; whatsapp: string | null;
  ciclo: string | null; etapa: string | null; que: string; cuando: string;
  dias_callado: number; wa_conversation_id: string | null;
};
export type DatosActivos = {
  total: number; dias: number; con_senal: number; leads: LeadActivo[];
  empresas: { empresa: string; n: number; nombres: string[] }[];
  rescatar: ParaRescatar[];
  seguimiento: { contestados: number; revivieron: number; pct: number | null };
  conteos: {
    pelota_nosotros: number; pelota_ellos: number; caliente: number; enfriandose: number;
    por_tipo: { tipo: string; etiqueta: string; n: number }[];
  };
};

export function useLeadsActivos(dias = 7) {
  const [datos, setDatos] = useState<DatosActivos | null>(null);
  useEffect(() => {
    swrGet(`/api/crm/reports/leads-activos?dias=${dias}`, (j: any) => {
      if (j?.error || !Array.isArray(j?.leads)) return;   // un 504 no debe vaciar la lista
      setDatos(j as DatosActivos);
    }).catch(() => {});
  }, [dias]);
  return datos;
}

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-MX');

const CICLO: Record<string, string> = {
  lead: 'Lead', lead_calificado: 'Calificado', oportunidad: 'Oportunidad',
  rezagado: 'Rezagado', cliente: 'Cliente', churned: 'Baja', descalificado: 'Descalificado',
};

const TEMP: Record<string, { l: string; bg: string; fg: string }> = {
  caliente: { l: 'Caliente', bg: '#FEE7E3', fg: '#9A3412' },
  tibio: { l: 'Tibio', bg: '#FEF3C7', fg: '#92400E' },
  frio: { l: 'Frío', bg: '#EEEEF3', fg: '#5b5966' },
};

/** «hace 2 h», «ayer», «hace 3 d». En una lista de esta semana la fecha exacta no dice nada. */
export function haceCuanto(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} d`;
}

const diaDe = (iso: string) => {
  const d = new Date(iso), hoy = new Date();
  const mismo = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (mismo(d, hoy)) return 'Hoy';
  if (mismo(d, ayer)) return 'Ayer';
  // Solo la primera letra. `text-transform: capitalize` en CSS toca CADA
  // palabra y dejaba «Miércoles 26 De Ago» —el "De" en mayúscula se lee como
  // un error de alguien que no revisó—. En español solo va el día.
  const t = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/* Filtros. `pelota:nosotros` va primero porque es el que convierte la pantalla
   en una lista de trabajo en vez de un reporte. */
export type Filtro = { k: string; l: string; n: number };

export function filtrosDe(d: DatosActivos | null): Filtro[] {
  if (!d) return [];
  return [
    { k: 'todos', l: 'Todos', n: d.total },
    { k: 'pelota', l: 'Te toca a ti', n: d.conteos.pelota_nosotros },
    { k: 'caliente', l: 'Calientes', n: d.conteos.caliente },
    { k: 'enfriandose', l: 'Enfriándose', n: d.conteos.enfriandose },
    /* Se agrupan por ETIQUETA, no por tipo: `cotizacion_vista` y
       `quote_viewed` son el mismo hecho con dos nombres internos y salían dos
       veces como «Abrió la cotización», una con 7 y otra con 1. Nadie que lea
       la pantalla sabe —ni tiene por qué— que son dos tablas distintas. */
    ...[...d.conteos.por_tipo.filter(t => t.n > 0).reduce((m, t) => {
      const p = m.get(t.etiqueta);
      m.set(t.etiqueta, { tipos: [...(p?.tipos || []), t.tipo], n: (p?.n || 0) + t.n });
      return m;
    }, new Map<string, { tipos: string[]; n: number }>())].map(([etiqueta, v2]) => ({
      k: `tipo:${v2.tipos.join(',')}`, l: etiqueta, n: v2.n,
    })).sort((a, b) => b.n - a.n),
  ].filter(f => f.n > 0 || f.k === 'todos');
}

export function aplicarFiltro(leads: LeadActivo[], f: string): LeadActivo[] {
  if (f === 'todos') return leads;
  if (f === 'pelota') return leads.filter(l => l.pelota === 'nosotros');
  if (f === 'caliente') return leads.filter(l => l.temperatura === 'caliente');
  if (f === 'enfriandose') return leads.filter(l => l.tendencia === 'enfriandose');
  if (f.startsWith('tipo:')) {
    const ts = f.slice(5).split(',');
    return leads.filter(l => ts.some(t => (l.tipos || {})[t] > 0));
  }
  return leads;
}

export function ListaLeadsActivos({ leads, onAbrir, movil }: {
  leads: LeadActivo[]; onAbrir?: (l: LeadActivo) => void; movil?: boolean;
}) {
  if (!leads.length) {
    return <EstadoVacio titulo="Nadie con esa condición"
      pista="Prueba con otro filtro. «Todos» trae a cualquiera que se haya movido en la ventana." />;
  }
  return (
    <div>
      {leads.map(l => {
        const suyo = l.ultima?.de === 'lead';
        const t = TEMP[l.temperatura];
        return (
          <button key={l.id} onClick={() => onAbrir?.(l)}
            style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none',
              cursor: onAbrir ? 'pointer' : 'default', fontFamily: 'inherit',
              padding: movil ? '13px 16px' : '11px 14px', borderBottom: '1px solid #f1f0f5' }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <b style={{ fontSize: movil ? 15 : 13.5, color: '#241d43', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</b>
              {l.empresa && <span style={{ fontSize: 12, color: '#8b8896', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{l.empresa}</span>}
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#8b8896', flexShrink: 0 }}>{l.ultima ? haceCuanto(l.ultima.cuando) : ''}</span>
            </span>

            <span style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* La temperatura va PRIMERO: es lo que decide si sigo leyendo. */}
              <span style={{ fontSize: 10.5, fontWeight: 800, background: t.bg, color: t.fg, borderRadius: 999, padding: '2px 8px' }}>{t.l}</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, background: '#EEF2FF', color: '#4338CA', borderRadius: 999, padding: '2px 8px' }}>
                {CICLO[l.ciclo || ''] || l.ciclo || 'Sin ciclo'}
              </span>
              {l.etapa && <span style={{ fontSize: 10.5, fontWeight: 800, background: '#EEEEF3', color: '#4b5563', borderRadius: 999, padding: '2px 8px', textTransform: 'capitalize' }}>{l.etapa}</span>}
              {l.tendencia === 'enfriandose' && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#8b8896' }}>enfriándose</span>}
              {l.tendencia === 'subiendo' && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0F766E' }}>subiendo</span>}
              {/* Contra SU historia, no contra los demás: dos señales es poco
                  en absoluto y muchísimo para quien nunca daba ninguna. */}
              {l.su_record && <span style={{ fontSize: 10.5, fontWeight: 800, color: '#0F766E' }}>su mejor racha</span>}
            </span>

            {/* Lo MÁS CARO que hizo, no lo más reciente. Si abrió una
                cotización de $58,919 dos veces, eso decide la llamada; que
                además haya entrado al sitio después es un detalle. */}
            {l.cotizacion && l.cotizacion.total > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: '#5B4BD6', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: '#241d43', fontWeight: 700 }}>
                  Abrió {l.cotizacion.folio || 'la cotización'} · {money(l.cotizacion.total)}
                  {l.cotizacion.vistas > 1 && <span style={{ fontWeight: 500, color: '#6b6875' }}> · {l.cotizacion.vistas} veces</span>}
                </span>
              </span>
            )}
            {(!l.cotizacion || !l.cotizacion.total) && l.paginas?.some(p => p.caliente) && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: '#5B4BD6', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: '#241d43', fontWeight: 700 }}>
                  Entró a {l.paginas.filter(p => p.caliente).map(p => p.ruta).join(', ')}
                </span>
              </span>
            )}
            {l.ultima && !(l.cotizacion && l.cotizacion.total > 0) && !l.paginas?.some(p => p.caliente) && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: suyo ? '#5B4BD6' : '#c9c7d2', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: suyo ? '#241d43' : '#6b6875', fontWeight: suyo ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.ultima.que}
                </span>
              </span>
            )}

            {/* La deuda, dicha con todas sus letras. Es la línea que hace que
                alguien deje de leer y abra la conversación. */}
            {l.pelota === 'nosotros' && l.horas_esperando != null && l.horas_esperando >= 1 && (
              <span style={{ display: 'block', marginTop: 5, fontSize: 11.5, fontWeight: 700, color: '#B45309' }}>
                Te toca contestar · {l.horas_esperando < 24 ? `${l.horas_esperando} h` : `${Math.round(l.horas_esperando / 24)} d`} esperando
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ══ DRAWER DEL LEAD ══════════════════════════════════════════════════════
   Al tocar un renglón no basta con «visitó el sitio»: hay que ver TODO lo que
   hizo para decidir con qué abrir la conversación. Y hay que poder abrirla ahí
   mismo — si para escribirle hay que salir, buscarlo en el inbox y volver, no
   se escribe. */
export function DrawerLead({ lead, onCerrar, onWhatsApp }: {
  lead: LeadActivo | null; onCerrar: () => void; onWhatsApp: (l: LeadActivo) => void;
}) {
  if (!lead) return null;
  const t = TEMP[lead.temperatura];
  const suyas = lead.linea.filter(a => a.de === 'lead');
  // El porqué del puntaje, en palabras. Un número sin explicación no se puede
  // discutir, y entonces o se le cree ciegamente o se ignora.
  const razones = Object.entries(lead.tipos || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([tipo, n]) => {
      const q = lead.linea.find(a => a.tipo === tipo)?.que || tipo;
      // Solo la PRIMERA letra: `toLowerCase()` entero convertía «WhatsApp» en
      // «whatsapp», que es el nombre de un producto y se lee como error.
      const frase = q.charAt(0).toLowerCase() + q.slice(1);
      return n > 1 ? `${frase} ×${n}` : frase;
    });

  let diaPrev = '';
  return (
    <Sheet open onClose={onCerrar} title={lead.nombre} width={520}>
      <div style={{ padding: '4px 16px 18px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, background: t.bg, color: t.fg, borderRadius: 999, padding: '3px 9px' }}>{t.l}</span>
          <span style={{ fontSize: 11, fontWeight: 800, background: '#EEF2FF', color: '#4338CA', borderRadius: 999, padding: '3px 9px' }}>{CICLO[lead.ciclo || ''] || lead.ciclo}</span>
          {lead.etapa && <span style={{ fontSize: 11, fontWeight: 800, background: '#EEEEF3', color: '#4b5563', borderRadius: 999, padding: '3px 9px', textTransform: 'capitalize' }}>{lead.etapa}</span>}
          {lead.empresa && <span style={{ fontSize: 12, color: '#8b8896' }}>{lead.empresa}</span>}
        </div>

        {/* POR QUÉ está caliente (o no). En prosa, no en número. */}
        {razones.length > 0 && (
          <div style={{ fontSize: 13, color: '#4b4956', lineHeight: 1.55, marginBottom: 12 }}>
            En estos días: {razones.join(' · ')}.
            {lead.tendencia === 'enfriandose' && ' No ha vuelto a dar señales en los últimos 3 días.'}
            {lead.tendencia === 'subiendo' && ' Está dando más señales que al principio de la semana.'}
          </div>
        )}

        {/* LA COTIZACIÓN, con monto y cuántas veces la abrió. Es el dato que
            decide con qué frase abres la conversación. */}
        {lead.cotizacion && (
          <div style={{ border: '1px solid #ddd8f7', background: '#FAFAFD', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#a5a2af' }}>Cotización</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#241d43', marginTop: 3 }}>
              {lead.cotizacion.folio || 'Sin folio'}{lead.cotizacion.total > 0 ? ` · ${money(lead.cotizacion.total)}` : ''}
            </div>
            <div style={{ fontSize: 12, color: '#6b6875', marginTop: 2 }}>
              La abrió {lead.cotizacion.vistas === 1 ? 'una vez' : `${lead.cotizacion.vistas} veces`} · {haceCuanto(lead.cotizacion.cuando)}
              {lead.cotizacion.estado ? ` · ${lead.cotizacion.estado}` : ''}
            </div>
          </div>
        )}

        {/* QUÉ páginas vio. «Visitó el sitio» no dice nada; /planes sí. */}
        {lead.paginas?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#a5a2af', marginBottom: 5 }}>Qué miró</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {lead.paginas.map(pg => (
                <span key={pg.ruta} style={{ fontSize: 11.5, fontWeight: pg.caliente ? 800 : 600, borderRadius: 999, padding: '3px 9px',
                  background: pg.caliente ? '#FEE7E3' : '#EEEEF3', color: pg.caliente ? '#9A3412' : '#4b5563' }}>
                  {pg.ruta}{pg.n > 1 ? ` ×${pg.n}` : ''}
                </span>
              ))}
            </div>
            {/* Se dice cuántas se descartaron para que el número de señales sea
                defendible: sin esto, «53 señales» parece interés y es una
                pestaña abierta. */}
            {lead.visitas_repetidas > 0 && (
              <div style={{ fontSize: 11, color: '#8b8896', marginTop: 5 }}>
                {lead.visitas_repetidas === 1
                  ? '1 recarga del mismo día no cuenta como señal.'
                  : `${lead.visitas_repetidas} recargas del mismo día no cuentan como señal.`}
              </div>
            )}
          </div>
        )}

        {lead.pelota === 'nosotros' && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, color: '#92400E', marginBottom: 12, lineHeight: 1.5 }}>
            <b>La pelota es tuya.</b> Lo último fue suyo{lead.horas_esperando != null ? ` y lleva ${lead.horas_esperando < 24 ? `${lead.horas_esperando} h` : `${Math.round(lead.horas_esperando / 24)} d`} esperando` : ''}.
          </div>
        )}

        {/* LA VENTANA DE 24 H, ANTES de tocar el botón. Si está cerrada, WhatsApp
            solo deja mandar plantilla: enterarse allá dentro es descubrir un
            callejón después de haber caminado hasta el fondo. */}
        {lead.wa_ventana && (
          <div style={{ fontSize: 12, marginBottom: 8, color: lead.wa_ventana === 'abierta' ? '#0F766E' : '#92400E', fontWeight: 600 }}>
            {lead.wa_ventana === 'abierta'
              ? 'Ventana de 24 h abierta: puedes escribirle libre.'
              : 'Ventana de 24 h cerrada: tendrás que abrir con una plantilla.'}
          </div>
        )}

        {/* La acción, ARRIBA de la línea de tiempo: se viene a escribir, no a leer. */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => onWhatsApp(lead)} disabled={!lead.whatsapp}
            style={{ flex: 1, minHeight: 46, borderRadius: 12, border: 'none', cursor: lead.whatsapp ? 'pointer' : 'not-allowed',
              background: lead.whatsapp ? '#5B4BD6' : '#e8e6f0', color: lead.whatsapp ? '#fff' : '#9b98a8',
              fontWeight: 800, fontSize: 14, fontFamily: 'inherit' }}>
            {lead.whatsapp ? 'Abrir conversación' : 'Sin WhatsApp'}
          </button>
          {/* Con palabra y no con un emoji de teléfono: el estándar del CRM es
              sin iconos decorativos, y además «Llamar» no se puede malinterpretar. */}
          {lead.whatsapp && (
            <a href={`tel:${lead.whatsapp}`}
              style={{ minHeight: 46, padding: '0 16px', borderRadius: 12, border: '1px solid #ddd8f7', color: '#5B4BD6',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
                fontSize: 14, fontWeight: 700, flexShrink: 0 }}>Llamar</a>
          )}
        </div>

        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#a5a2af', marginBottom: 8 }}>
          Todo lo que pasó · {lead.linea.length} {lead.linea.length === 1 ? 'movimiento' : 'movimientos'}
          {suyas.length > 0 && ` · ${suyas.length} ${suyas.length === 1 ? 'suyo' : 'suyos'}`}
        </div>

        {/* Agrupada por día: en una semana, «martes» ubica mejor que una fecha
            completa repetida veinte veces. */}
        {lead.linea.map((a, i) => {
          const dia = diaDe(a.cuando);
          const nuevoDia = dia !== diaPrev; diaPrev = dia;
          const suyo = a.de === 'lead';
          return (
            <div key={i}>
              {nuevoDia && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8b8896', margin: i ? '14px 0 6px' : '0 0 6px' }}>{dia}</div>
              )}
              <div style={{ display: 'flex', gap: 9, padding: '7px 0', borderBottom: '1px solid #f7f6fa' }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: suyo ? '#5B4BD6' : '#d5d3dd', marginTop: 5, flexShrink: 0 }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: suyo ? 700 : 500, color: suyo ? '#241d43' : '#6b6875' }}>{a.que}</span>
                  {a.detalle && a.detalle !== a.que && (
                    <span style={{ display: 'block', fontSize: 12, color: '#8b8896', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detalle}</span>
                  )}
                </span>
                <span style={{ fontSize: 11, color: '#a5a2af', flexShrink: 0 }}>
                  {new Date(a.cuando).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/**
 * A DÓNDE LLEVA «Abrir conversación».
 *
 * El inbox ya sabía recibir enlaces profundos, con dos parámetros propios:
 * `wa_conv` (id exacto de la conversación) y `wa_search` (teléfono, que busca).
 * Se usan ESOS y no uno inventado — un `?tel=` se habría quedado en la URL sin
 * que nadie lo leyera y el botón habría dejado al usuario en la lista, que es
 * justo el paso que se quiere ahorrar.
 *
 * El id sale de la metadata de sus propios mensajes, así que cuando el lead ya
 * escribió alguna vez se abre EXACTO. Si nunca ha escrito no hay conversación
 * que abrir: `wa_nuevo=1` arranca una nueva con su número en vez de dejar una
 * búsqueda vacía que parece decir que el contacto no existe.
 */
export function rutaConversacion(l: LeadActivo): string {
  if (l.wa_conversation_id) return `whatsapp?wa_conv=${encodeURIComponent(l.wa_conversation_id)}`;
  const tel = (l.whatsapp || '').replace(/\D/g, '');
  if (!tel) return `pipeline?contacto=${l.id}`;
  return `whatsapp?wa_search=${encodeURIComponent(tel)}&wa_nuevo=1`;
}

/**
 * LO QUE NO SALE EN LA LISTA. Un lead que abrió tu cotización hace tres
 * semanas y desapareció no cabe en «últimos 7 días» — y es justo el que se
 * está cayendo solo. Se buscan señales FUERTES fuera de la ventana en gente
 * que lleva callada desde entonces.
 *
 * Cuando no hay nadie así no se pinta nada: una sección vacía permanente
 * enseña a ignorar esa zona de la pantalla.
 */
export function ParaRescatarLista({ datos, onAbrirConv, movil }: {
  datos: DatosActivos | null; onAbrirConv: (r: ParaRescatar) => void; movil?: boolean;
}) {
  const rs = datos?.rescatar || [];
  if (!rs.length) return null;
  return (
    <div>
      <div style={{ padding: movil ? '16px 16px 6px' : '14px 0 6px', fontSize: 10.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#a5a2af' }}>
        Se están cayendo solos · {rs.length}
      </div>
      <div style={{ padding: movil ? '0 16px 8px' : '0 0 8px', fontSize: 12, color: '#7c7a86', lineHeight: 1.5 }}>
        Dieron una señal fuerte y llevan días sin volver. No aparecen arriba porque no se movieron esta semana.
      </div>
      {rs.map(r => (
        <button key={r.id} onClick={() => onAbrirConv(r)}
          style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer',
            fontFamily: 'inherit', padding: movil ? '12px 16px' : '10px 14px', borderBottom: '1px solid #f1f0f5' }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <b style={{ fontSize: movil ? 14.5 : 13.5, color: '#241d43' }}>{r.nombre}</b>
            {r.empresa && <span style={{ fontSize: 12, color: '#8b8896', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{r.empresa}</span>}
            <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: '#B45309', flexShrink: 0 }}>{r.dias_callado} d callado</span>
          </span>
          <span style={{ display: 'block', fontSize: 12.5, color: '#6b6875', marginTop: 4 }}>{r.que}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * VARIOS CONTACTOS DE LA MISMA EMPRESA moviéndose no son tres leads sueltos:
 * es una empresa evaluando, y eso se atiende distinto (y se cotiza distinto).
 */
export function EmpresasActivas({ datos, movil }: { datos: DatosActivos | null; movil?: boolean }) {
  const es = datos?.empresas || [];
  if (!es.length) return null;
  return (
    <div style={{ padding: movil ? '12px 16px' : '10px 0' }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#a5a2af', marginBottom: 6 }}>
        Empresas evaluando
      </div>
      {es.map(e => (
        <div key={e.empresa} style={{ fontSize: 12.5, color: '#4b4956', padding: '3px 0' }}>
          <b style={{ color: '#241d43' }}>{e.empresa}</b> · {e.n} personas · {e.nombres.join(', ')}
        </div>
      ))}
    </div>
  );
}

/**
 * ¿SIRVE EL SEGUIMIENTO? De los leads a los que escribimos, cuántos volvieron
 * a moverse después. Es la única cifra de la sección que mide nuestro trabajo
 * y no el de ellos, y por eso vale la pena tenerla a la vista aunque incomode.
 */
export function EfectividadSeguimiento({ datos }: { datos: DatosActivos | null }) {
  const s = datos?.seguimiento;
  if (!s || !s.contestados) return null;
  return (
    <div style={{ padding: '10px 16px', fontSize: 12, color: '#6b6875', lineHeight: 1.5, borderTop: '1px solid #f1f0f5' }}>
      Les escribiste a <b style={{ color: '#241d43' }}>{s.contestados}</b> y volvieron a moverse{' '}
      <b style={{ color: '#241d43' }}>{s.revivieron}</b> ({s.pct}%).
      {s.pct != null && s.pct < 30 && ' Vale la pena revisar con qué los estás abriendo.'}
    </div>
  );
}

/** Rango de la ventana. El 7 no tenía ninguna razón: un ciclo de venta de ERP no cabe en una semana. */
export function RangoDias({ valor, onCambiar }: { valor: number; onCambiar: (d: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[7, 14, 30].map(d => (
        <button key={d} onClick={() => onCambiar(d)}
          style={{ minHeight: 32, padding: '0 11px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            border: `1px solid ${valor === d ? '#5B4BD6' : '#e2e0ea'}`, background: valor === d ? '#5B4BD6' : '#fff', color: valor === d ? '#fff' : '#4b4956' }}>
          {d} d
        </button>
      ))}
    </div>
  );
}

/** Fila de filtros, compartida por la hoja del teléfono y la tarjeta del tablero. */
export function FiltrosActivos({ datos, valor, onCambiar, movil }: {
  datos: DatosActivos | null; valor: string; onCambiar: (v: string) => void; movil?: boolean;
}) {
  const fs = useMemo(() => filtrosDe(datos), [datos]);
  if (!fs.length) return null;
  return (
    <div className="crm-scroll-x" style={{ display: 'flex', gap: 6, padding: movil ? '10px 16px' : '4px 0 10px', overflowX: 'auto' }}>
      {fs.map(f => {
        const on = valor === f.k;
        return (
          <button key={f.k} onClick={() => onCambiar(f.k)}
            style={{ flexShrink: 0, minHeight: movil ? 38 : 30, padding: '0 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
              border: `1px solid ${on ? '#5B4BD6' : '#e2e0ea'}`, background: on ? '#5B4BD6' : '#fff', color: on ? '#fff' : '#4b4956' }}>
            {f.l} <span style={{ opacity: .75, fontWeight: 600 }}>{f.n}</span>
          </button>
        );
      })}
    </div>
  );
}
